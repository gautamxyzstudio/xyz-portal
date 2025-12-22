const { createCoreController } = require("@strapi/strapi").factories;
const moduleUid = "api::leave-status.leave-status";

// ------------------------------------------------------------------
// Helper: calculate business days
// ------------------------------------------------------------------
function calculateLeaveDays(
  startDate,
  endDate,
  leaveType,
  isFirstHalf = false
) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  let businessDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays++;
    current.setDate(current.getDate() + 1);
  }

  switch (leaveType) {
    case "short_leave":
      return 0.25;
    case "half_day":
      return 0.5;
    case "full_day":
      return businessDays;
    default:
      return businessDays;
  }
}

module.exports = createCoreController(moduleUid, ({ strapi }) => ({
  async create(ctx) {
    try {
      const data = ctx.request.body.data || {};

      // 1️⃣ Get logged-in user
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized("You must be logged in to apply for leave");
      }

      // 2️⃣ Attach user to leave request
      data.user = userId;

      // 3️⃣ Create leave request and populate user relation
      const leave = await strapi.entityService.create(
        "api::leave-status.leave-status",
        {
          data,
          populate: ["user"],
        }
      );

      // 4️⃣ Fetch Strapi internal HR role
      const hrRole = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { name: "Hr" } });

      if (!hrRole) {
        console.warn("❌ HR role 'Hr' not found. No emails sent.");
        return ctx.send({
          message: "Leave created but HR role missing",
          leave,
        });
      }

      // 5️⃣ Fetch all HR users using correct Strapi v4 syntax
      const hrUsers = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          where: { role: { id: hrRole.id } }, // FIXED HERE
          select: ["email", "username"],
        });

      if (!hrUsers.length) {
        console.warn("❌ No users assigned to HR role. No email sent.");
      }

      // 6️⃣ Send emails to all HR users
      for (const hr of hrUsers) {
        if (!hr.email) continue;

        try {
          await strapi
            .plugin("email")
            .service("email")
            .send({
              to: hr.email,
              subject: `New Leave Request from ${leave.user.username}`,
              html: `
            <p>Hello ${hr.username},</p>
            <p>A new leave request has been submitted:</p>
            <ul>
              <li><strong>Employee:</strong> ${leave.user.username}</li>
              <li><strong>Title:</strong> ${leave.title}</li>
              <li><strong>Leave Type:</strong> ${leave.leave_type}</li>
              <li><strong>Start Date:</strong> ${leave.start_date}</li>
              <li><strong>End Date:</strong> ${leave.end_date}</li>
              <li><strong>Description:</strong> ${leave.description}</li>
            </ul>
          `,
            });
        } catch (err) {
          console.error(
            `❌ Failed to send email to HR (${hr.email}):`,
            err.message
          );
        }
      }

      return ctx.send({ message: "Leave request created successfully", leave });
    } catch (err) {
      console.error("💥 Error creating leave request:", err);
      return ctx.badRequest("Error creating leave request", {
        error: err.message,
      });
    }
  },
   async findAll(ctx) {
    try {
      const data = await strapi.entityService.findMany("api::leave-status.leave-status", {
        populate: {
          user: true,
        },
        sort: { createdAt: "desc" }
      });

      return { message: "All Leave Requests", data };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  // =======================================================================
  // APPROVE LEAVE
  // =======================================================================
  async approve(ctx) {
    try {
      const { id } = ctx.params;

      const leaveRequest = await strapi.entityService.findOne(
        "api::leave-status.leave-status",
        id,
        { populate: ["user"] }
      );

      if (!leaveRequest) return ctx.notFound("Leave request not found");
      if (!leaveRequest.user)
        return ctx.badRequest("No user found in leave request");

      const user = leaveRequest.user;

      // ------------------------------------------------------------------
      // Calculate leave days correctly
      // ------------------------------------------------------------------
      const leaveDuration = leaveRequest.leave_duration;
      const leaveType = leaveRequest.leave_type;

      const leaveDays = calculateLeaveDays(
        leaveRequest.start_date,
        leaveRequest.end_date,
        leaveDuration,
        leaveRequest.is_first_half
      );

      // ------------------------------------------------------------------
      // Update user leave balances
      // ------------------------------------------------------------------
      const userData = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        user.id,
        { fields: ["leave_balance", "unpaid_leave_balance"] }
      );

      let newLeaveBalance = userData.leave_balance || 0;
      let newUnpaidBalance = userData.unpaid_leave_balance || 0;

      if (leaveType === "Casual") {
        if (newLeaveBalance >= leaveDays) newLeaveBalance -= leaveDays;
        else {
          newUnpaidBalance += leaveDays - newLeaveBalance;
          newLeaveBalance = 0;
        }
      } else if (leaveType === "UnPaid") {
        newUnpaidBalance += leaveDays;
      }

      await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        {
          data: {
            leave_balance: newLeaveBalance,
            unpaid_leave_balance: newUnpaidBalance,
          },
        }
      );

      // ------------------------------------------------------------------
      // Update leave request status
      // ------------------------------------------------------------------
      await strapi.entityService.update("api::leave-status.leave-status", id, {
        data: { status: "approved", publishedAt: new Date() },
      });

      // ======================================================================
      // SEND EMAIL TO EMPLOYEE
      // ======================================================================
      if (user.email) {
        await strapi
          .plugin("email")
          .service("email")
          .send({
            to: user.email,
            subject: "Leave Approved",
            html: `
           <p>Hello ${user.username},</p>
           <p>Your leave request "<b>${leaveRequest.title}</b>" has been approved.</p>
           <p><b>Leave Days:</b> ${leaveDays}</p>
           <p>Description : <b>${leaveRequest.description}</b></p>
          <p>Leave Type : <b>${leaveRequest.leave_type}</b></p>
           <p>start Date : <b>${leaveRequest.start_date}</b></p>
           <p>End Date : <b>${leaveRequest.end_date}</b></p>

          `,
          });
      }

      return ctx.send({
        message: "Leave approved successfully",
        leaveDays,
        newLeaveBalance,
        newUnpaidBalance,
      });
    } catch (error) {
      console.error("Approve Error:", error);
      return ctx.badRequest(error.message);
    }
  },

  // =======================================================================
  // REJECT LEAVE
  // =======================================================================
  async reject(ctx) {
    try {
      const { id } = ctx.params;
      const { decline_reason } = ctx.request.body;

      const leaveRequest = await strapi.entityService.findOne(
        "api::leave-status.leave-status",
        id,
        { populate: ["user"] }
      );

      await strapi.entityService.update("api::leave-status.leave-status", id, {
        data: { status: "declined", decline_reason },
      });

      if (leaveRequest.user?.email) {
        await strapi
          .plugin("email")
          .service("email")
          .send({
            to: leaveRequest.user.email,
            subject: "Leave Declined",
            html: `
           <p>Your leave "<b>${leaveRequest.title}</b>" has been declined.</p>
           <p>Description : <b>${leaveRequest.description}</b></p>
           <p>Leave Type : <b>${leaveRequest.leave_type}</b></p>
           <p>start Date : <b>${leaveRequest.start_date}</b></p>
           <p>End Date : <b>${leaveRequest.end_date}</b></p>
           <p>Reason: ${decline_reason}</p>
          `,
          });
      }

      return ctx.send({ message: "Leave declined" });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },
}));
