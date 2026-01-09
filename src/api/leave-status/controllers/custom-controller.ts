import { factories } from "@strapi/strapi";

const moduleUid = "api::leave-status.leave-status";

export default factories.createCoreController(moduleUid, ({ strapi }) => ({
  /* ======================================================
     CREATE LEAVE
  ====================================================== */
async create(ctx) {
  try {
    const data = ctx.request.body?.data || {};
    const userId = ctx.state.user?.id;

    if (!userId) return ctx.unauthorized("Login required");

    data.user = userId;
    data.status = "pending";
    data.publishedAt = new Date();

    /* ================= SHORT LEAVE (ONCE PER MONTH) ================= */
    if (data.leave_category === "short_leave") {
      const start = new Date(data.start_date);
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

      const count = await strapi.entityService.count(moduleUid, {
        filters: {
          user: userId,
          leave_category: "short_leave",
          status: { $ne: "declined" },
          start_date: { $between: [monthStart, monthEnd] },
        },
      });

      if (count >= 1) {
        return ctx.badRequest("Short leave already used this month");
      }
    }

    /* ================= DAY-WISE GENERATION ================= */
    const leaveDays = [];
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayIndex = d.getDay();
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = d.toISOString().split("T")[0];

      // Weekend → Holiday
      if (dayIndex === 0 || dayIndex === 6) {
        leaveDays.push({
          date: dateStr,
          day: dayName,
          leave_type: "Holiday",
          editable: false,
          approval_status: "approved",
          duration: 0,
        });
        continue;
      }

      // Half Day
      if (data.leave_category === "half_day") {
        leaveDays.push({
          date: dateStr,
          day: dayName,
          leave_type: data.leave_type,
          editable: true,
          approval_status: "pending",
          duration: 0.5,
          half_day_type: data.half_day_type,
        });
        break;
      }

      // Full Day
      leaveDays.push({
        date: dateStr,
        day: dayName,
        leave_type: data.leave_type,
        editable: true,
        approval_status: "pending",
        duration: 1,
      });
    }

    /* ================= TOTAL DAYS ================= */
    const totalDays = leaveDays.reduce(
      (sum, d) => sum + Number(d.duration || 0),
      0
    );

    data.leave_days = leaveDays;
    data.days = totalDays;

    const leave = await strapi.entityService.create(moduleUid, {
      data,
      populate: ["user"],
    });

    /* ================= EMAIL TO HR (FIXED) ================= */
    const hrUsers = await strapi.db
      .query("plugin::users-permissions.user")
      .findMany({
        where: {
          user_type: { $eqi: "Hr" }, // ✅ ONLY FIX
        },
        select: ["email", "username"],
      });

    for (const hr of hrUsers) {
      if (!hr.email) continue;

      await strapi.plugin("email").service("email").send({
        to: hr.email,
        subject: `New Leave Request from ${leave.user.username}`,
        html: `
          <p>Hello ${hr.username},</p>
          <p><strong>${leave.user.username}</strong> has applied for leave.</p>
          <ul>
            <li><strong>Title:</strong> ${leave.title}</li>
            <li><strong>From:</strong> ${leave.start_date}</li>
            <li><strong>To:</strong> ${leave.end_date}</li>
          </ul>
        `,
      });
    }

    return ctx.send({ message: "Leave request submitted", leave });
  } catch (err) {
    return ctx.badRequest(err.message);
  }
},


  /* ======================================================
     HR UPDATE + APPROVE / REJECT
  ====================================================== */
  async hrUpdateAndApproveLeave(ctx) {
    const { id } = ctx.params;
    const { days, status, decline_reason } = ctx.request.body;
    const user = ctx.state.user;

    if (!user || user.user_type !== "Hr") {
      return ctx.unauthorized("Only HR can take action");
    }

    const leave: any = await strapi.entityService.findOne(moduleUid, id, {
      populate: ["user"],
    });

    if (!leave || leave.status !== "pending") {
      return ctx.badRequest("Invalid leave");
    }

    /* ================= MERGE DAY-WISE CHANGES ================= */
    const finalDays = leave.leave_days.map((day) => {
      const hrDay = days?.find((d) => d.date === day.date);

      // Non-editable days (holiday/weekend)
      if (!day.editable) {
        return { ...day, approval_status: "approved" };
      }

      return {
        ...day,
        leave_type: hrDay?.leave_type ?? day.leave_type,
        approval_status: hrDay?.approval_status ?? "approved",
      };
    });

    /* ================= RECALCULATE TOTAL LEAVE DAYS ================= */
    const approvedTotalDays = finalDays.reduce((sum, d) => {
      if (d.approval_status === "approved" && d.leave_type !== "Holiday") {
        return sum + Number(d.duration || 0);
      }
      return sum;
    }, 0);

    /* ================= BALANCE DEDUCTION ================= */
    if (status === "approved" && leave.leave_category !== "short_leave") {
      const approvedDays = finalDays.filter(
        (d) => d.approval_status === "approved" && d.leave_type !== "Holiday"
      );

      const year = new Date().getFullYear();

      let [balance]: any[] = await strapi.entityService.findMany(
        "api::leave-balance.leave-balance",
        { filters: { user: leave.user.id, year } }
      );

      if (!balance) {
        balance = await strapi.entityService.create(
          "api::leave-balance.leave-balance",
          {
            data: {
              user: leave.user.id,
              year,
              el_balance: 4,
              cl_balance: 4,
              sl_balance: 4,
              unpaid_balance: 0,
              publishedAt: new Date(),
            },
          }
        );
      }

      for (const day of approvedDays) {
        const deduction = Number(day.duration || 1);

        switch (day.leave_type) {
          case "EL":
            balance.el_balance >= deduction
              ? (balance.el_balance -= deduction)
              : (balance.unpaid_balance += deduction);
            break;
          case "CL":
            balance.cl_balance >= deduction
              ? (balance.cl_balance -= deduction)
              : (balance.unpaid_balance += deduction);
            break;
          case "SL":
            balance.sl_balance >= deduction
              ? (balance.sl_balance -= deduction)
              : (balance.unpaid_balance += deduction);
            break;
          case "un-paid":
            balance.unpaid_balance += deduction;
            break;
        }
      }

      await strapi.entityService.update(
        "api::leave-balance.leave-balance",
        balance.id,
        { data: balance }
      );
    }

    /* ================= UPDATE LEAVE ================= */
    const updatedLeave = await strapi.entityService.update(moduleUid, id, {
      data: {
        leave_days: finalDays, // ✅ JSON array
        days: approvedTotalDays, // ✅ decimal
        status,
        decline_reason: status === "declined" ? decline_reason : null,
      },
    });

    /* ================= EMAIL TO EMPLOYEE ================= */
    if (leave.user?.email) {
      const approvedDays = finalDays.filter(
        (d) => d.approval_status === "approved" && d.leave_type !== "Holiday"
      );
      const rejectedDays = finalDays.filter(
        (d) => d.approval_status === "rejected"
      );

      const isPartial = approvedDays.length && rejectedDays.length;

      let subject = "Leave Update";
      let html = `
      <p>Hello ${leave.user.username},</p>
      <p><strong>Title:</strong> ${leave.title}</p>
      <p><strong>From:</strong> ${leave.start_date}</p>
      <p><strong>To:</strong> ${leave.end_date}</p>
    `;

      if (status === "declined") {
        subject = "Leave Declined";
        html += `<p><strong>Reason:</strong> ${decline_reason}</p>`;
      } else {
        subject = isPartial ? "Leave Partially Approved" : "Leave Approved";

        if (approvedDays.length) {
          html += `<p><strong>Approved Days:</strong></p><ul>`;
          approvedDays.forEach((d) => {
            html += `<li>${d.date} (${d.leave_type})</li>`;
          });
          html += `</ul>`;
        }

        if (rejectedDays.length) {
          html += `<p><strong>Rejected Days:</strong></p><ul>`;
          rejectedDays.forEach((d) => {
            html += `<li>${d.date}</li>`;
          });
          html += `</ul>`;
        }
      }

      await strapi.plugin("email").service("email").send({
        to: leave.user.email,
        subject,
        html,
      });
    }

    return ctx.send({
      message: "Leave processed successfully",
      leave: updatedLeave,
    });
  },

  /* ======================================================
  FIND ALL LEAVES
====================================================== */

async findUserAllLeaves(ctx) {
  try {
    const loggedInUser = ctx.state.user;
    if (!loggedInUser) {
      return ctx.unauthorized("Token missing or invalid");
    }

    const { startDate, endDate, username } = ctx.query;

    const filters: any = {
      $and: [],
    };

    /* ===============================
       👤 EMPLOYEE: ONLY OWN LEAVES
    =============================== */
    if (loggedInUser.user_type !== "Hr") {
      filters.$and.push({
        user: loggedInUser.id,
      });
    }

    /* ===============================
       📅 DATE RANGE (OVERLAP)
    =============================== */
    if (startDate && endDate) {
      filters.$and.push(
        { start_date: { $lte: endDate } },
        { end_date: { $gte: startDate } }
      );
    }

    /* ===============================
       👩‍💼 HR: FILTER BY USERNAME
    =============================== */
    if (username && loggedInUser.user_type === "Hr") {
      filters.$and.push({
        user: {
          $or: [
            { search: { $containsi: username } },
            {
              user_detial: {
                name: { $containsi: username },
              },
            },
          ],
        },
      });
    }

    // 🔥 IMPORTANT: remove empty $and
    if (filters.$and.length === 0) {
      delete filters.$and;
    }

    const data = await strapi.entityService.findMany(
      "api::leave-status.leave-status",
      {
        filters,
        populate: {
          user: {
            populate: {
              user_detial: true,
            },
          },
        },
        sort: { id: "desc" },
      }
    );

    return {
      message:
        loggedInUser.user_type === "Hr"
          ? "Leave records fetched (HR access)"
          : "Logged-in user's leave requests",
      count: data.length,
      data,
    };
  } catch (error) {
    ctx.throw(500, error);
  }
}

}));
