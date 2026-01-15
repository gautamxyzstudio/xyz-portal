const getISTNow = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

const getISTDate = () => {
  const d = getISTNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ABSENT_CUTOFF_HOUR = 10;

export default {
  async stats(ctx) {
    try {
      const now = getISTNow();
      const today = getISTDate();
      const currentHour = now.getHours();

      /* ============================
         👥 Total Active Employees
      ============================ */
      const totalEmployees = await strapi.db
        .query("plugin::users-permissions.user")
        .count({
          where: {
            blocked: false,
            user_type: "Employee",
          },
        });

      /* ============================
         🌴 Employees On Leave
         (FULL / HALF / SHORT — ALL INCLUDED)
      ============================ */
      const employeesOnLeave = await strapi.db
        .query("api::leave-status.leave-status")
        .count({
          where: {
            status: "approved",
            start_date: { $lte: today },
            end_date: { $gte: today },
          },
        });

      /* ============================
         ✅ Employees Present
         (Checked in today)
      ============================ */
      const presentEmployees = await strapi.db
        .query("api::daily-attendance.daily-attendance")
        .count({
          where: {
            Date: today,
            in: { $notNull: true },
          },
        });

      /* ============================
         ❌ Absent / ⏳ Pending
      ============================ */
      const notCheckedIn =
        totalEmployees - presentEmployees - employeesOnLeave;

      const absentEmployees =
        currentHour >= ABSENT_CUTOFF_HOUR
          ? Math.max(notCheckedIn, 0)
          : 0;

      const pendingEmployees =
        currentHour < ABSENT_CUTOFF_HOUR
          ? Math.max(notCheckedIn, 0)
          : 0;

      ctx.body = {
        date: today,
        time: now.toLocaleTimeString("en-IN"),
        officeHours: "9:00 AM – 6:00 PM",
        cutoffTime: "10:00 AM",
        totalEmployees,
        presentEmployees,
        employeesOnLeave,
        absentEmployees,
        pendingEmployees,
      };
    } catch (error) {
      strapi.log.error("Dashboard Stats Error", error);
      ctx.throw(500, "Unable to fetch dashboard stats");
    }
  },
};
