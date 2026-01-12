/**
 * daily-task controller
 */
 import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::daily-task.daily-task",
  ({ strapi }) => ({

    // =====================================================
    // GET DAILY TASK WITH ALL WORK LOGS (HR / ADMIN)
    // =====================================================

    async byDate(ctx) {
      const { startDate, endDate } = ctx.query;

      /* ================= VALIDATION ================= */
      if (!startDate || !endDate) {
        return ctx.badRequest(
          "Both 'startDate' and 'endDate' are required (YYYY-MM-DD)"
        );
      }

      /* ================= FETCH DAILY TASKS ================= */
      const dailyTasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        {
          filters: {
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
          sort: { date: "asc" },
          populate: {
            work_logs: {
              populate: {
                user: {
                  fields: ["id", "username", "email"],
                },
              },
            },
          },
        }
      );

      if (!dailyTasks.length) {
        return ctx.notFound("No Daily Tasks found in this date range");
      }

      return {
        startDate,
        endDate,
        count: dailyTasks.length,
        daily_tasks: dailyTasks,
      };
    },

  })
);
