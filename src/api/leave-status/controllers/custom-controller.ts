const { createCoreController } = require("@strapi/strapi").factories;
const moduleUid = "api::leave-status.leave-status";

/* ======================================================
   Helper: calculate leave days
====================================================== */
function calculateLeaveDays(startDate, endDate, leaveDuration) {
  if (!startDate || !endDate) return 0;

  if (leaveDuration === "short_leave") return 0;
  if (leaveDuration === "half_day") return 0.5;

  // full day → business days
  const start = new Date(startDate);
  const end = new Date(endDate);
  let days = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) days++;
    current.setDate(current.getDate() + 1);
  }
  return days;
}

module.exports = createCoreController(moduleUid, ({ strapi }) => ({

  /* ======================================================
     CREATE LEAVE (EMAIL TO HR KEPT)
  ====================================================== */
  async create(ctx) {
    try {
      const data = ctx.request.body.data || {};
      const userId = ctx.state.user?.id;

      if (!userId) return ctx.unauthorized("Login required");

      data.user = userId;
      data.status = "pending";
      data.publishedAt = new Date();

      /* ================= HALF DAY ================= */
      if (data.leave_duration === "half_day") {
        if (!data.half_day_type)
          return ctx.badRequest("Select first or second half");

        if (data.start_date !== data.end_date)
          return ctx.badRequest("Half day must be single date");
      }

      /* ================= SHORT LEAVE ================= */
      if (data.leave_duration === "short_leave") {
        if (!data.short_leave_time_from || !data.short_leave_time_to)
          return ctx.badRequest("Time required for short leave");

        const from = new Date(`1970-01-01T${data.short_leave_time_from}`);
        const to = new Date(`1970-01-01T${data.short_leave_time_to}`);
        const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
        // 🔥 FIXED FLOAT COMPARISON
        if (Math.abs(diff - 2) > 0.01)
          return ctx.badRequest("Short leave must be exactly 2 hours");

        if (data.start_date !== data.end_date)
          return ctx.badRequest("Short leave must be single date");

        // 🔥 SHORT LEAVE ONCE PER MONTH CHECK
        const start = new Date(data.start_date);
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

        const count = await strapi.entityService.count(
          "api::leave-status.leave-status",
          {
            filters: {
              user: userId,
              leave_duration: "short_leave",
              status: { $ne: "declined" },
              start_date: { $between: [monthStart, monthEnd] },
            },
          }
        );

        if (count >= 1)
          return ctx.badRequest("Short leave already used this month");
      }

      /* ================= CLEAN UNUSED FIELDS ================= */
      if (data.leave_duration !== "half_day") data.half_day_type = null;

      if (data.leave_duration !== "short_leave") {
        data.short_leave_time_from = null;
        data.short_leave_time_to = null;
      }

      const leave = await strapi.entityService.create(
        "api::leave-status.leave-status",
        { data, populate: ["user"] }
      );

      /* ================= EMAIL TO HR (UNCHANGED) ================= */
      const hrRole = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { name: "Hr" } });

      if (hrRole) {
        const hrUsers = await strapi.db
          .query("plugin::users-permissions.user")
          .findMany({
            where: { role: { id: hrRole.id } },
            select: ["email", "username"],
          });

        for (const hr of hrUsers) {
          if (!hr.email) continue;

          await strapi.plugin("email").service("email").send({
            to: hr.email,
            subject: `New Leave Request from ${leave.user.username}`,
            html: `
            <p>Hello ${hr.username},</p>
            <p>New leave request submitted:</p>
            <ul>
              <li>Employee: ${leave.user.username}</li>
              <li>Type: ${leave.leave_type}</li>
              <li>Title : ${leave.title}</li>
              <li>Description : ${leave.description}</li>
              <li>Duration: ${leave.leave_duration}</li>
              <li>From: ${leave.start_date}</li>
              <li>To: ${leave.end_date}</li>
            </ul>
          `,
          });
        }
      }

      return ctx.send({ message: "Leave request submitted", leave });
    } catch (err) {
      console.error(err);
      return ctx.badRequest(err.message);
    }
  },

  /* ======================================================
     APPROVE LEAVE (BALANCE + EMAIL)
  ====================================================== */
  async approve(ctx) {
    try {
      const { id } = ctx.params;

      const leave = await strapi.entityService.findOne(
        "api::leave-status.leave-status",
        id,
        { populate: ["user"] }
      );

      if (!leave || !leave.user)
        return ctx.badRequest("Invalid leave request");

      const leaveDays = calculateLeaveDays(
        leave.start_date,
        leave.end_date,
        leave.leave_duration
      );

      /* ---------- SHORT LEAVE (ONCE PER MONTH) ---------- */
      if (leave.leave_duration === "short_leave") {
        const start = new Date(leave.start_date);
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

        const count = await strapi.entityService.count(
          "api::leave-status.leave-status",
          {
            filters: {
              user: leave.user.id,
              leave_duration: "short_leave",
              status: "approved",
              start_date: { $between: [monthStart, monthEnd] },
            },
          }
        );

        if (count >= 1)
          return ctx.badRequest("Short leave already used this month");

        await strapi.entityService.update(
          "api::leave-status.leave-status",
          id,
          { data: { status: "approved" } }
        );
      } else {
        /* ---------- FETCH / CREATE LEAVE BALANCE ---------- */
        const year = new Date().getFullYear();
        let [balance] = await strapi.entityService.findMany(
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
              },
            }
          );
        }

        const map = { EL: "el_balance", CL: "cl_balance", SL: "sl_balance" };
        const field = map[leave.leave_type];
        let available = field ? balance[field] : 0;

        if (!field || available < leaveDays) {
          balance.unpaid_balance += leaveDays - Math.max(available, 0);
          if (field) balance[field] = 0;
        } else {
          balance[field] -= leaveDays;
        }

        await strapi.entityService.update(
          "api::leave-balance.leave-balance",
          balance.id,
          { data: balance }
        );

        await strapi.entityService.update(
          "api::leave-status.leave-status",
          id,
          { data: { status: "approved" } }
        );
      }

      /* ---------- EMAIL TO EMPLOYEE ---------- */
      if (leave.user.email) {
        await strapi.plugin("email").service("email").send({
          to: leave.user.email,
          subject: "Leave Approved",
          html: `
          <p>Hello ${leave.user.username},</p>
          <p>Your leave request for <strong> ${leave.title} </strong>has been approved.</p>
          <p> <strong>Leave Days </strong>: ${leaveDays}</p>
          <p><strong>From </strong>: ${leave.start_date}</p>
          <p><strong>To </strong>: ${leave.end_date}</p>
        `,
        });
      }

      return ctx.send({ message: "Leave approved successfully" });
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  /* ======================================================
     REJECT LEAVE (EMAIL KEPT)
  ====================================================== */
  async reject(ctx) {
    try {
      const { id } = ctx.params;
      const { decline_reason } = ctx.request.body;

      await strapi.entityService.update(
        "api::leave-status.leave-status",
        id,
        { data: { status: "declined", decline_reason } }
      );

      const leave = await strapi.entityService.findOne(
        "api::leave-status.leave-status",
        id,
        { populate: ["user"] }
      );

      if (leave?.user?.email) {
        await strapi.plugin("email").service("email").send({
          to: leave.user.email,
          subject: "Leave Declined",
          html: `
         <p>Hello ${leave.user.username},</p>
          <p>Your leave request for <strong> ${leave.title} </strong>has been declined.</p>
          <p><strong>From </strong>: ${leave.start_date}</p>
          <p><strong>To </strong>: ${leave.end_date}</p>
          <p> <strong>Reason </strong>: ${leave.decline_reason}</p>
        `,
        });
      }

      return ctx.send({ message: "Leave declined" });
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  /* ======================================================
     FIND ALL LEAVES
  ====================================================== */
async findUserAllLeaves(ctx) {
  try {
    // ✅ User extracted from JWT token
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("Token missing or invalid");
    }

    const data = await strapi.entityService.findMany(
      "api::leave-status.leave-status",
      {
        filters: {
          user: user.id, // 🔐 filter by logged-in user
        },
        populate: {
          user: true,
        },
        sort: { createdAt: "desc" },
      }
    );

    return {
      message: "Logged-in user's leave requests",
      data,
    };
  } catch (error) {
    ctx.throw(500, error);
  }
}

}));
