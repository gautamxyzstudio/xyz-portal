/**
 * daily-task controller
 */

// import { factories } from '@strapi/strapi'

// export default factories.createCoreController('api::daily-task.daily-task');

/**
 * daily-task controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";

export default factories.createCoreController(
  "api::daily-task.daily-task",
  ({ strapi }) => ({

    // =====================================================
    // GET DAILY TASK WITH ALL WORK LOGS (HR / ADMIN)
    // =====================================================
    async byDate(ctx: Context) {
      const { date } = ctx.query as { date?: string };

      if (!date) {
        return ctx.badRequest("date is required (YYYY-MM-DD)");
      }

      const dailyTasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        {
          filters: { date },
          populate: {
            work_logs: {
              populate: ["user"],
            },
          },
          limit: 1,
        }
      );

      if (!dailyTasks.length) {
        return ctx.notFound("Daily task not found");
      }

      return dailyTasks[0];
    },
  })
);
