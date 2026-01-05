import { Context } from "koa";

export default {
  async stats(ctx: Context) {
    try {
      /* ============================
         📅 Date Helpers
      ============================ */
      const today = new Date().toISOString().split("T")[0];
      const startOfDay = new Date(`${today}T00:00:00.000Z`);
      const endOfDay = new Date(`${today}T23:59:59.999Z`);

      /* ============================
         👥 Total Active Employees
      ============================ */
      const totalEmployees = await strapi.db
        .query("plugin::users-permissions.user")
        .count({
          where: { blocked: false },
        });

      /* ============================
         ✅ Employees Present Today
      ============================ */
      const presentEmployees = await strapi.db
        .query("api::daily-attendance.daily-attendance")
        .count({
          where: {
            date: { $between: [startOfDay, endOfDay] },
            in: { $notNull: true },
          },
        });

      /* ============================
         🌴 Employees On Leave Today
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
         ❌ Employees Absent Today
      ============================ */
      const absentEmployees = Math.max(
        totalEmployees - presentEmployees - employeesOnLeave,
        0
      );

      ctx.body = {
        totalEmployees,
        presentEmployees,
        employeesOnLeave,
        absentEmployees,
      };
    } catch (error) {
      strapi.log.error("Dashboard Stats Error", error);
      ctx.throw(500, "Unable to fetch dashboard stats");
    }
  },
};
