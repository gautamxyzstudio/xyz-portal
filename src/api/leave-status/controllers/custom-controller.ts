// const { createCoreController } = require("@strapi/strapi").factories;
// const moduleUid = "api::leave-status.leave-status";

// /* ======================================================
//    Helper: calculate leave days
// ====================================================== */
// function calculateLeaveDays(startDate, endDate, leaveDuration) {
//   if (!startDate || !endDate) return 0;

//   if (leaveDuration === "short_leave") return 0;
//   if (leaveDuration === "half_day") return 0.5;

//   // full day → business days
//   const start = new Date(startDate);
//   const end = new Date(endDate);
//   let days = 0;
//   const current = new Date(start);

//   while (current <= end) {
//     const day = current.getDay();
//     if (day !== 0 && day !== 6) days++;
//     current.setDate(current.getDate() + 1);
//   }
//   return days;
// }

// module.exports = createCoreController(moduleUid, ({ strapi }) => ({

//   /* =============================
//      CREATE LEAVE 
//   ================================ */
//   // async create(ctx) {
//   //   try {
//   //     const data = ctx.request.body.data || {};
//   //     const userId = ctx.state.user?.id;

//   //     if (!userId) return ctx.unauthorized("Login required");

//   //     data.user = userId;
//   //     data.status = "pending";
//   //     data.publishedAt = new Date();

//   //     /* ================= HALF DAY ================= */
//   //     if (data.leave_duration === "half_day") {
//   //       if (!data.half_day_type)
//   //         return ctx.badRequest("Select first or second half");

//   //       if (data.start_date !== data.end_date)
//   //         return ctx.badRequest("Half day must be single date");
//   //     }

//   //     /* ================= SHORT LEAVE ================= */
//   //     if (data.leave_duration === "short_leave") {
//   //       if (!data.short_leave_time_from || !data.short_leave_time_to)
//   //         return ctx.badRequest("Time required for short leave");

//   //       const from = new Date(`1970-01-01T${data.short_leave_time_from}`);
//   //       const to = new Date(`1970-01-01T${data.short_leave_time_to}`);
//   //       const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
//   //       // 🔥 FIXED FLOAT COMPARISON
//   //       if (Math.abs(diff - 2) > 0.01)
//   //         return ctx.badRequest("Short leave must be exactly 2 hours");

//   //       if (data.start_date !== data.end_date)
//   //         return ctx.badRequest("Short leave must be single date");

//   //       // 🔥 SHORT LEAVE ONCE PER MONTH CHECK
//   //       const start = new Date(data.start_date);
//   //       const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
//   //       const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

//   //       const count = await strapi.entityService.count(
//   //         "api::leave-status.leave-status",
//   //         {
//   //           filters: {
//   //             user: userId,
//   //             leave_duration: "short_leave",
//   //             status: { $ne: "declined" },
//   //             start_date: { $between: [monthStart, monthEnd] },
//   //           },
//   //         }
//   //       );

//   //       if (count >= 1)
//   //         return ctx.badRequest("Short leave already used this month");
//   //     }

//   //     /* ================= CLEAN UNUSED FIELDS ================= */
//   //     if (data.leave_duration !== "half_day") data.half_day_type = null;

//   //     if (data.leave_duration !== "short_leave") {
//   //       data.short_leave_time_from = null;
//   //       data.short_leave_time_to = null;
//   //     }

//   //     const leave = await strapi.entityService.create(
//   //       "api::leave-status.leave-status",
//   //       { data, populate: ["user"] }
//   //     );

//   //     /* ================= EMAIL TO HR (UNCHANGED) ================= */
//   //     const hrRole = await strapi.db
//   //       .query("plugin::users-permissions.role")
//   //       .findOne({ where: { name: "Hr" } });

//   //     if (hrRole) {
//   //       const hrUsers = await strapi.db
//   //         .query("plugin::users-permissions.user")
//   //         .findMany({
//   //           where: { role: { id: hrRole.id } },
//   //           select: ["email", "username"],
//   //         });

//   //       for (const hr of hrUsers) {
//   //         if (!hr.email) continue;

//   //         await strapi.plugin("email").service("email").send({
//   //           to: hr.email,
//   //           subject: `New Leave Request from ${leave.user.username}`,
//   //           html: `
//   //           <p>Hello ${hr.username},</p>
//   //           <p>New leave request submitted:</p>
//   //           <ul>
//   //             <li>Employee: ${leave.user.username}</li>
//   //             <li>Type: ${leave.leave_type}</li>
//   //             <li>Title : ${leave.title}</li>
//   //             <li>Description : ${leave.description}</li>
//   //             <li>Duration: ${leave.leave_duration}</li>
//   //             <li>From: ${leave.start_date}</li>
//   //             <li>To: ${leave.end_date}</li>
//   //           </ul>
//   //         `,
//   //         });
//   //       }
//   //     }

//   //     return ctx.send({ message: "Leave request submitted", leave });
//   //   } catch (err) {
//   //     console.error(err);
//   //     return ctx.badRequest(err.message);
//   //   }
//   // },

//   async create(ctx) {
//   try {
//     const data = ctx.request.body.data || {};
//     const userId = ctx.state.user?.id;

//     if (!userId) return ctx.unauthorized("Login required");

//     data.user = userId;
//     data.status = "pending";
//     data.publishedAt = new Date();

//     /* ================= HALF DAY ================= */
//     if (data.leave_duration === "half_day") {
//       if (!data.half_day_type)
//         return ctx.badRequest("Select first or second half");

//       if (data.start_date !== data.end_date)
//         return ctx.badRequest("Half day must be single date");
//     }

//     /* ================= SHORT LEAVE ================= */
//     if (data.leave_duration === "short_leave") {
//       if (!data.short_leave_time_from || !data.short_leave_time_to)
//         return ctx.badRequest("Time required for short leave");

//       const from = new Date(`1970-01-01T${data.short_leave_time_from}`);
//       const to = new Date(`1970-01-01T${data.short_leave_time_to}`);
//       const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60);

//       if (Math.abs(diff - 2) > 0.01)
//         return ctx.badRequest("Short leave must be exactly 2 hours");

//       if (data.start_date !== data.end_date)
//         return ctx.badRequest("Short leave must be single date");

//       const start = new Date(data.start_date);
//       const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
//       const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

//       const count = await strapi.entityService.count(
//         "api::leave-status.leave-status",
//         {
//           filters: {
//             user: userId,
//             leave_duration: "short_leave",
//             status: { $ne: "declined" },
//             start_date: { $between: [monthStart, monthEnd] },
//           },
//         }
//       );

//       if (count >= 1)
//         return ctx.badRequest("Short leave already used this month");
//     }

//     /* ================= CLEAN UNUSED FIELDS ================= */
//     if (data.leave_duration !== "half_day") data.half_day_type = null;

//     if (data.leave_duration !== "short_leave") {
//       data.short_leave_time_from = null;
//       data.short_leave_time_to = null;
//     }

//   /* ================= DAY-WISE LEAVE GENERATION ================= */
// let days = [];

// const start = new Date(data.start_date);
// const end = new Date(data.end_date);

// for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
//   const dayIndex = d.getDay(); // 0 = Sun, 6 = Sat
//   const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

//   if (dayIndex === 0 || dayIndex === 6) {
//     days.push({
//       date: d.toISOString().split("T")[0],
//       day: dayName,
//       leave_type: "Holiday",
//       editable: false,
//     });
//   } else {
//     days.push({
//       date: d.toISOString().split("T")[0],
//       day: dayName,
//       leave_type: data.leave_type, // EL / CL / SL
//       editable: true,
//     });
//   }
// }

// data.days = days; // ⭐ THIS IS REQUIRED

//     /* ================= CREATE LEAVE ================= */
//     const leave = await strapi.entityService.create(
//       "api::leave-status.leave-status",
//       { data, populate: ["user"] }
//     );

//     /* ================= EMAIL TO HR ================= */
//     const hrRole = await strapi.db
//       .query("plugin::users-permissions.role")
//       .findOne({ where: { name: "Hr" } });

//     if (hrRole) {
//       const hrUsers = await strapi.db
//         .query("plugin::users-permissions.user")
//         .findMany({
//           where: { role: { id: hrRole.id } },
//           select: ["email", "username"],
//         });

//       for (const hr of hrUsers) {
//         if (!hr.email) continue;

//         await strapi.plugin("email").service("email").send({
//           to: hr.email,
//           subject: `New Leave Request from ${leave.user.username}`,
//           html: `
//             <p>Hello ${hr.username},</p>
//             <p>New leave request submitted:</p>
//             <ul>
//               <li>Employee: ${leave.user.username}</li>
//               <li>Type: ${leave.leave_type}</li>
//               <li>Title: ${leave.title}</li>
//               <li>Description: ${leave.description}</li>
//               <li>Duration: ${leave.leave_duration}</li>
//               <li>From: ${leave.start_date}</li>
//               <li>To: ${leave.end_date}</li>
//             </ul>
//           `,
//         });
//       }
//     }

//     return ctx.send({ message: "Leave request submitted", leave });
//   } catch (err) {
//     console.error(err);
//     return ctx.badRequest(err.message);
//   }
// },


//   /* ======================================================
//      APPROVE LEAVE (BALANCE + EMAIL)
//   ====================================================== */
//   async approve(ctx) {
//     try {
//       const { id } = ctx.params;

//       const leave = await strapi.entityService.findOne(
//         "api::leave-status.leave-status",
//         id,
//         { populate: ["user"] }
//       );

//       if (!leave || !leave.user)
//         return ctx.badRequest("Invalid leave request");

//       const leaveDays = calculateLeaveDays(
//         leave.start_date,
//         leave.end_date,
//         leave.leave_duration
//       );

//       /* ---------- SHORT LEAVE (ONCE PER MONTH) ---------- */
//       if (leave.leave_duration === "short_leave") {
//         const start = new Date(leave.start_date);
//         const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
//         const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

//         const count = await strapi.entityService.count(
//           "api::leave-status.leave-status",
//           {
//             filters: {
//               user: leave.user.id,
//               leave_duration: "short_leave",
//               status: "approved",
//               start_date: { $between: [monthStart, monthEnd] },
//             },
//           }
//         );

//         if (count >= 1)
//           return ctx.badRequest("Short leave already used this month");

//         await strapi.entityService.update(
//           "api::leave-status.leave-status",
//           id,
//           { data: { status: "approved" } }
//         );
//       } else {
//         /* ---------- FETCH / CREATE LEAVE BALANCE ---------- */
//         const year = new Date().getFullYear();
//         let [balance] = await strapi.entityService.findMany(
//           "api::leave-balance.leave-balance",
//           { filters: { user: leave.user.id, year } }
//         );

//         if (!balance) {
//           balance = await strapi.entityService.create(
//             "api::leave-balance.leave-balance",
//             {
//               data: {
//                 user: leave.user.id,
//                 year,
//                 el_balance: 4,
//                 cl_balance: 4,
//                 sl_balance: 4,
//                 unpaid_balance: 0,
//               },
//             }
//           );
//         }

//         const map = { EL: "el_balance", CL: "cl_balance", SL: "sl_balance" };
//         const field = map[leave.leave_type];
//         let available = field ? balance[field] : 0;

//         if (!field || available < leaveDays) {
//           balance.unpaid_balance += leaveDays - Math.max(available, 0);
//           if (field) balance[field] = 0;
//         } else {
//           balance[field] -= leaveDays;
//         }

//         await strapi.entityService.update(
//           "api::leave-balance.leave-balance",
//           balance.id,
//           { data: balance }
//         );

//         await strapi.entityService.update(
//           "api::leave-status.leave-status",
//           id,
//           { data: { status: "approved" } }
//         );
//       }

//       /* ---------- EMAIL TO EMPLOYEE ---------- */
//       if (leave.user.email) {
//         await strapi.plugin("email").service("email").send({
//           to: leave.user.email,
//           subject: "Leave Approved",
//           html: `
//           <p>Hello ${leave.user.username},</p>
//           <p>Your leave request for <strong> ${leave.title} </strong>has been approved.</p>
//           <p> <strong>Leave Days </strong>: ${leaveDays}</p>
//           <p><strong>From </strong>: ${leave.start_date}</p>
//           <p><strong>To </strong>: ${leave.end_date}</p>
//         `,
//         });
//       }

//       return ctx.send({ message: "Leave approved successfully" });
//     } catch (err) {
//       return ctx.badRequest(err.message);
//     }
//   },

//   /* ======================================================
//      REJECT LEAVE (EMAIL KEPT)
//   ====================================================== */
//   async reject(ctx) {
//     try {
//       const { id } = ctx.params;
//       const { decline_reason } = ctx.request.body;

//       await strapi.entityService.update(
//         "api::leave-status.leave-status",
//         id,
//         { data: { status: "declined", decline_reason } }
//       );

//       const leave = await strapi.entityService.findOne(
//         "api::leave-status.leave-status",
//         id,
//         { populate: ["user"] }
//       );

//       if (leave?.user?.email) {
//         await strapi.plugin("email").service("email").send({
//           to: leave.user.email,
//           subject: "Leave Declined",
//           html: `
//          <p>Hello ${leave.user.username},</p>
//           <p>Your leave request for <strong> ${leave.title} </strong>has been declined.</p>
//           <p><strong>From </strong>: ${leave.start_date}</p>
//           <p><strong>To </strong>: ${leave.end_date}</p>
//           <p> <strong>Reason </strong>: ${leave.decline_reason}</p>
//         `,
//         });
//       }

//       return ctx.send({ message: "Leave declined" });
//     } catch (err) {
//       return ctx.badRequest(err.message);
//     }
//   },

//   /* ======================================================
//      FIND ALL LEAVES
//   ====================================================== */
// async findUserAllLeaves(ctx) {
//   try {
//     // ✅ User extracted from JWT token
//     const user = ctx.state.user;

//     if (!user) {
//       return ctx.unauthorized("Token missing or invalid");
//     }

//     const data = await strapi.entityService.findMany(
//       "api::leave-status.leave-status",
//       {
//         filters: {
//           user: user.id, // 🔐 filter by logged-in user
//         },
//         populate: {
//           user: true,
//         },
//         sort: { createdAt: "desc" },
//       }
//     );

//     return {
//       message: "Logged-in user's leave requests",
//       data,
//     };
//   } catch (error) {
//     ctx.throw(500, error);
//   }
// },


//   /* ======================================================
//     HR UPDATE AND APPROVE OR REJECT LEAVE
//   ====================================================== */

//     async hrUpdateAndApproveLeave(ctx) {
//       const { id } = ctx.params;
//       const { days, status } = ctx.request.body;
//       const user = ctx.state.user;

//       if (!user || user.user_type !== "Hr") {
//         return ctx.unauthorized("Only HR can take action");
//       }

//       if (!["approved", "declined"].includes(status)) {
//         return ctx.badRequest("Invalid status");
//       }

//       const leave = await strapi.entityService.findOne(
//         "api::leave-status.leave-status",
//         id
//       );

//       if (!leave) return ctx.notFound("Leave not found");

//       if (leave.status !== "pending") {
//         return ctx.badRequest("Leave already processed");
//       }

//       /* ================= MERGE DAY-WISE CHANGES ================= */

//       const finalDays = leave.days.map((day) => {
//         const hrDay = days.find((d) => d.date === day.date);

//         // Holiday → locked & auto approved
//         if (!day.editable) {
//           return {
//             ...day,
//             approval_status: "approved",
//           };
//         }

//         return {
//           ...day,
//           leave_type: hrDay?.leave_type ?? day.leave_type,
//           approval_status: hrDay?.approval_status ?? "approved",
//         };
//       });

//       /* ================= SAVE EVERYTHING ================= */

//       const updatedLeave = await strapi.entityService.update(
//         "api::leave-status.leave-status",
//         id,
//         {
//           data: {
//             days: finalDays,
//             status,
//           },
//         }
//       );

//       return ctx.send({
//         message: "Leave processed successfully",
//         leave: updatedLeave,
//       });
//     },

// }));



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
      if (data.leave_duration === "short_leave") {
        const start = new Date(data.start_date);
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);

        const count = await strapi.entityService.count(moduleUid, {
          filters: {
            user: userId,
            leave_duration: "short_leave",
            status: { $ne: "declined" },
            start_date: { $between: [monthStart, monthEnd] },
          },
        });

        if (count >= 1) {
          return ctx.badRequest("Short leave already used this month");
        }
      }

      /* ================= DAY-WISE GENERATION ================= */
      const days: any[] = [];
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayIndex = d.getDay();
        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
        const dateStr = d.toISOString().split("T")[0];

        // Weekend → Holiday
        if (dayIndex === 0 || dayIndex === 6) {
          days.push({
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
        if (data.leave_duration === "half_day") {
          days.push({
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
        days.push({
          date: dateStr,
          day: dayName,
          leave_type: data.leave_type,
          editable: true,
          approval_status: "pending",
          duration: 1,
        });
      }

      data.days = days;

      const leave = await strapi.entityService.create(moduleUid, {
        data,
        populate: ["user"],
      });

      /* ================= EMAIL TO HR ================= */
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
              <p><strong>${leave.user.username}</strong> has applied for leave.</p>
              <ul>
                <li><strong>Title:</strong> ${leave.title}</li>
                <li><strong>From:</strong> ${leave.start_date}</li>
                <li><strong>To:</strong> ${leave.end_date}</li>
              </ul>
            `,
          });
        }
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
    const finalDays = leave.days.map((day) => {
      const hrDay = days?.find((d) => d.date === day.date);

      if (!day.editable) {
        return { ...day, approval_status: "approved" };
      }

      return {
        ...day,
        leave_type: hrDay?.leave_type ?? day.leave_type,
        approval_status: hrDay?.approval_status ?? "approved",
      };
    });

    /* ================= BALANCE DEDUCTION ================= */
    if (status === "approved" && leave.leave_duration !== "short_leave") {

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
        const deduction = day.duration || 1;

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
        }
      }

      await strapi.entityService.update(
        "api::leave-balance.leave-balance",
        balance.id,
        { data: balance }
      );
    }

    const updatedLeave = await strapi.entityService.update(moduleUid, id, {
      data: {
        days: finalDays,
        status,
        decline_reason: status === "declined" ? decline_reason : null,
      },
    });

    /* ================= EMAIL TO EMPLOYEE (ALWAYS) ================= */
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
  },


}));
