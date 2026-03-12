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

        const [sy, sm, sd] = data.start_date.split("-").map(Number);
        const start = new Date(sy, sm - 1, sd);

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

      const [sy2, sm2, sd2] = data.start_date.split("-").map(Number);
      const start = new Date(sy2, sm2 - 1, sd2);

      const [ey2, em2, ed2] = data.end_date.split("-").map(Number);
      const end = new Date(ey2, em2 - 1, ed2);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {

        const dayIndex = d.getDay();

        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

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

      /* ================= EMAIL TO HR ================= */

      const users = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          select: ["email", "username", "user_type"],
        });

      const hrUsers = users.filter((u) => u.user_type === "Hr");

      console.log("HR USERS:", hrUsers);

      for (const hr of hrUsers) {
        if (!hr.email) continue;

        await strapi.plugin("email").service("email").send({
          to: hr.email,
          subject: `Leave Application – ${leave.user.username}`,

          html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<style>
@media only screen and (max-width: 600px){

  .container{
    width:100% !important;
  }

  .padding{
    padding:20px !important;
  }

  .title{
    font-size:20px !important;
    line-height:28px !important;
  }

  .stack td{
    display:block;
    width:100% !important;
  }

  .logo{
    width:120px !important;
  }

}
</style>

</head>
 
<body style="margin:0;padding:0;background-color:#f7f7f7;">
 
<table border="0" width="100%" style="table-layout:fixed;background-color:#f7f7f7;">
<tr>
<td align="center">
 
<table border="0" cellpadding="0" cellspacing="0" width="600"
       class="container"
       style="max-width:600px;width:100%;background-color:#ffffff;">
 
<!-- HEADER -->
<tr>
<td class="padding" style="padding:10px 40px;background-color:#181818;" align="center">
<img src="https://astroshahriar.com/wp-content/uploads/2026/01/logo.png"
     alt="Logo"
     class="logo"
     width="150"
     style="display:block;height:auto;max-width:100%;">
</td>
</tr>
 
<!-- MAIN CONTENT -->
<tr>
<td align="center" class="padding" style="padding:40px 40px 20px 40px;">
 
<h2 class="title"
style="font-family:Arial,sans-serif;
font-size:22px;
color:#000000;
margin:0 0 20px 0;
line-height:32px;
text-transform:uppercase;
font-weight:900;">

Leave Application Notification
</h2>
 
<p style="font-family:Arial;font-size:14px;color:#000000;text-align:left;">

Hello <strong>${hr.username}</strong>,
</p>
 
<p style="font-family:Arial;font-size:14px;color:#000000;text-align:left;">
<strong>${leave.user.username}</strong> has submitted a leave request.

Please review the details below:
</p>
 
<table width="100%" cellpadding="6" cellspacing="0"
       class="stack"
       style="border-collapse:collapse;font-family:Arial;font-size:14px;">
<tr>
<td width="40%"><strong>Title</strong></td>
<td>${leave.title}</td>
</tr>
<tr>
<td><strong>Leave Type</strong></td>
<td>${leave.leave_type}</td>
</tr>
<tr>
<td><strong>Duration</strong></td>
<td>${leave.days} day(s)</td>
</tr>
<tr>
<td><strong>Period</strong></td>
<td>${leave.start_date} → ${leave.end_date}</td>
</tr>
<tr>
<td><strong>Description</strong></td>
<td>${leave.description || "N/A"}</td>
</tr>
</table>
 
</td>
</tr>
 
<!-- FOOTER -->
<tr>
<td align="center" class="padding" style="padding:30px 40px;background-color:#181818;">
 
<img src="https://astroshahriar.com/wp-content/uploads/2026/01/logo.png"
     width="200"
     style="display:block;margin:0 auto;height:auto;max-width:100%;">
 
<p style="font-family:Arial;
font-size:20px;
color:#ffffff;
margin:10px 0 5px;
font-weight:bold;
text-transform:uppercase;">

STAY CONNECTED
</p>
 
<table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
<tr>
<td style="padding:0 5px;">
<a href="#" target="_blank">
<img src="https://astroshahriar.com/wp-content/uploads/2026/01/fb-1.png"
     width="24" height="24" alt="Facebook"
     style="display:block;">
</a>
</td>
<td style="padding:0 5px;">
<a href="#" target="_blank">
<img src="https://astroshahriar.com/wp-content/uploads/2026/01/insta-1.png"
     width="24" height="24" alt="Instagram"
     style="display:block;">
</a>
</td>
</tr>
</table>
 
</td>
</tr>
 
</table>
</td>
</tr>
</table>
 
</body>
</html>
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

    if (!user || !["Hr", "Management"].includes(user.user_type)) {
      return ctx.unauthorized("Only HR or Management can take action");
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

      const year = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      ).getFullYear();
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
 await strapi.entityService.update(moduleUid, id, {
  data: {
    leave_days: finalDays,
    days: approvedTotalDays,
    status,
    decline_reason: status === "declined" ? decline_reason : null,
    approved_by: user.id,
  },
});

const updatedLeave = await strapi.entityService.findOne(moduleUid, id, {
  populate: ["approved_by"],
} as any);

    /* ================= EMAIL TO EMPLOYEE ================= */
    if (leave.user?.email) {
      const approvedDays = finalDays.filter(
        (d) => d.approval_status === "approved" && d.leave_type !== "Holiday"
      );

      const declinedDays = finalDays.filter(
        (d) => d.approval_status === "declined"
      );

      const isPartial = approvedDays.length && declinedDays.length;
      const isAllApproved = approvedDays.length && !declinedDays.length;
      const isAllDeclined = !approvedDays.length && declinedDays.length;

      let subject = "";
      let bodyContent = "";

      /* ================= SUBJECT ================= */
      if (isPartial) {
        subject = "Leave Request Status – Partially Approved";
      } else if (isAllApproved) {
        subject = "Leave Approval Confirmation";
      } else {
        subject = "Leave Request Status – Declined";
      }

      /* ================= BODY CONTENT ================= */

      // PARTIALLY APPROVED
      if (isPartial) {
        bodyContent = `
      <p>Dear Mr. ${leave.user.username},</p>

      <p>
        This is to inform you that your leave request for the period mentioned below
        has been partially approved after careful review.
      </p>

      <p><strong>Approved Leave Details</strong></p>
      <p>The following leave days have been approved:</p>
      <ul>
        ${approvedDays.map(d => `<li>${d.date} – ${d.leave_type}</li>`).join("")}
      </ul>

      <p><strong>Declined Leave Details</strong></p>
      <p>The following leave days have been declined:</p>
      <ul>
        ${declinedDays.map(d => `<li>${d.date} – ${d.leave_type}</li>`).join("")}
      </ul>

      <p><strong>Reason for Partial Decline:</strong></p>
      <p>
        Due to operational requirements and work commitments during the latter part
        of the requested period, approval could not be granted for all requested dates.
      </p>

      <p>
        We request you to plan your work accordingly for the declined dates.
        If required, you may discuss alternative leave dates with your HR Department.
      </p>
    `;
      }

      // FULLY APPROVED
      if (isAllApproved) {
        bodyContent = `
      <p>Hello ${leave.user.username},</p>

      <p>
        This is to inform you that your leave request has been approved.
        Please find the details below:
      </p>

      <p>
        <strong>Leave Duration:</strong><br/>
        From ${leave.start_date} to ${leave.end_date}<br/>
        <strong>Total Approved Days:</strong> ${approvedDays.length} Days
      </p>

      <p><strong>Approved Leave Details:</strong></p>
      <ul>
        ${approvedDays.map(d => `<li>${d.date} – ${d.leave_type}</li>`).join("")}
      </ul>

      <p>
        If you have any questions or require further assistance,
        please feel free to contact the HR team.
      </p>

      <p>Wishing you a smooth leave period.</p>
    `;
      }

      // FULLY DECLINED
      if (isAllDeclined) {
        bodyContent = `
      <p>Dear Mr. ${leave.user.username},</p>

      <p>
        This is to inform you that your leave request for the period mentioned below
        has been reviewed and declined due to the stated reason.
      </p>

      <p>
        <strong>Requested Leave Period:</strong><br/>
        From ${leave.start_date} to ${leave.end_date}
      </p>

      <p><strong>Reason for Decline:</strong></p>
      <p>
        ${decline_reason ||
          "Due to operational requirements and ongoing project commitments during the requested period, we are unable to approve the leave at this time."}
      </p>

      <p>
        If you have any questions or require further assistance,
        please feel free to contact the HR team.
      </p>
    `;
      }

      /* ================= FINAL EMAIL TEMPLATE ================= */

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<style>
@media only screen and (max-width: 600px) {

  .container {
    width: 100% !important;
  }

  .content-padding {
    padding: 20px !important;
  }

  .footer-padding {
    padding: 25px 20px !important;
  }

  .logo {
    width: 120px !important;
  }

  .footer-logo {
    width: 160px !important;
  }

  .text {
    font-size: 14px !important;
    line-height: 22px !important;
  }

}
</style>

</head>

<body style="margin:0;padding:0;background-color:#f7f7f7;">

<table border="0" width="100%" style="table-layout:fixed;background-color:#f7f7f7;">
<tr>
<td align="center">

<table border="0" cellpadding="0" cellspacing="0" width="600"
       class="container"
       style="max-width:600px;width:100%;background-color:#ffffff;">

<!-- HEADER -->
<tr>
<td class="content-padding" style="padding:10px 40px;background-color:#181818;" align="center">
<img
  src="https://astroshahriar.com/wp-content/uploads/2026/01/logo.png"
  alt="Logo"
  width="150"
  class="logo"
  style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;"
/>
</td>
</tr>

<!-- MAIN CONTENT -->
<tr>
<td class="content-padding text"
    style="padding:40px;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:#000;">
${bodyContent}

<p style="margin-top:30px;">
Regards,<br/>
<strong>Human Resources Department</strong><br/>
XYZ Studio
</p>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td align="center"
    class="footer-padding"
    style="padding:30px 40px;background-color:#181818;">

<img
  src="https://astroshahriar.com/wp-content/uploads/2026/01/logo.png"
  width="200"
  class="footer-logo"
  style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;"
/>

<p style="font-family:Arial;
          font-size:20px;
          color:#ffffff;
          margin:10px 0 5px;
          font-weight:bold;
          text-transform:uppercase;">
Stay Connected
</p>

<table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
<tr>
<td style="padding:0 5px;">
<a href="#" target="_blank">
<img
  src="https://astroshahriar.com/wp-content/uploads/2026/01/fb-1.png"
  width="24"
  height="24"
  alt="Facebook"
  style="display:block;border:0;"
/>
</a>
</td>

<td style="padding:0 5px;">
<a href="#" target="_blank">
<img
  src="https://astroshahriar.com/wp-content/uploads/2026/01/insta-1.png"
  width="24"
  height="24"
  alt="Instagram"
  style="display:block;border:0;"
/>
</a>
</td>
</tr>
</table>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

      await strapi.plugin("email").service("email").send({
        to: leave.user.email,
        subject,
        html,
      });

      return ctx.send({
        success: true,
        message: "Leave updated successfully",
        data: updatedLeave,
      });

    }

  },

  /* ======================================================
     FIND ALL LEAVES (PAGINATED)
  ====================================================== */
  async findUserAllLeaves(ctx) {
    try {
      const loggedInUser = ctx.state.user;
      if (!loggedInUser) {
        return ctx.unauthorized("Token missing or invalid");
      }

      const {
        page = 1,
        pageSize = 10,
        startDate,
        endDate,
        username,
      } = ctx.query;

      const filters: any = { $and: [] };

      /* ===============================
       👤 EMPLOYEE: ONLY OWN LEAVES
    =============================== */
      if (!["Hr", "Management"].includes(loggedInUser.user_type)) {
        filters.$and.push({ user: loggedInUser.id });
      }

      /* ===============================
   🚫 HR SHOULD NOT SEE PENDING
=============================== */
      if (["Hr", "Management"].includes(loggedInUser.user_type)) {
        filters.$and.push({
          status: { $ne: "pending" },
        });
      }

      /* ===============================
       📅 DATE RANGE (OVERLAP)
    =============================== */
      if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) dateFilter.$lte = startDate;
        if (endDate) dateFilter.$gte = endDate;

        filters.$and.push(
          { start_date: { $lte: endDate || startDate } },
          { end_date: { $gte: startDate || endDate } }
        );
      }

      /* ===============================
       👩‍💼 HR: SEARCH USER
    =============================== */
      if (username && ["Hr", "Management"].includes(loggedInUser.user_type)) {
        filters.$and.push({
          $or: [
            {
              user: {
                username: { $containsi: username },
              },
            },
            {
              user: {
                user_detial: {
                  name: { $containsi: username },
                },
              },
            },
          ],
        });
      }

      if (filters.$and.length === 0) delete filters.$and;

      /* ===============================
       📥 FETCH LEAVES (PAGINATED)
    =============================== */
      const leaves = await strapi.entityService.findMany(
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
          start: (Number(page) - 1) * Number(pageSize),
          limit: Number(pageSize),
        }
      );

      /* ===============================
       📊 TOTAL COUNT
    =============================== */
      const total = await strapi.entityService.count(
        "api::leave-status.leave-status",
        { filters }
      );

      ctx.body = {
        data: leaves,
        meta: {
          pagination: {
            page: Number(page),
            pageSize: Number(pageSize),
            pageCount: Math.ceil(total / Number(pageSize)),
            total,
          },
        },
      };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

}));
