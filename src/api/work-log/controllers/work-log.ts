/**
 * work-log controller
 */

// import { factories } from '@strapi/strapi'

// export default factories.createCoreController('api::work-log.work-log');

/**
 * work-log controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";

export default factories.createCoreController(
  "api::work-log.work-log",
  ({ strapi }) => ({

    // =====================================================
    // CREATE OR GET TODAY'S WORK LOG
    // =====================================================
    async createToday(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const today = new Date().toISOString().split("T")[0];

      // 1️⃣ Find or create Daily Task (ONE per day)
      const dailyTasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        { filters: { date: today }, limit: 1 }
      );

      let dailyTask: any;
      if (!dailyTasks.length) {
        dailyTask = await strapi.entityService.create(
          "api::daily-task.daily-task",
          { data: { date: today } }
        );
      } else {
        dailyTask = dailyTasks[0];
      }

      // 2️⃣ Find or create Work Log (ONE per user per day)
      const workLogs = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters: {
            user: userId,
            daily_task: dailyTask.id,
          },
          limit: 1,
        }
      );

      let workLog: any;
      if (!workLogs.length) {
        workLog = await strapi.entityService.create(
          "api::work-log.work-log",
          {
            data: {
              user: userId,
              daily_task: dailyTask.id,
              tasks: [],
              total_estimated_time: 0,
              total_actual_time: 0,
            },
          }
        );
      } else {
        workLog = workLogs[0];
      }

      return {
        date: today,
        work_log: workLog,
      };
    },

    // =====================================================
    // UPDATE WORK LOG (TASKS / STATUS / ACTUAL TIME)
    // TOTALS AUTO-CALCULATED
    // =====================================================
    async update(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { tasks } = ctx.request.body.data || {};

      if (!userId) return ctx.unauthorized("Login required");
      if (!Array.isArray(tasks)) {
        return ctx.badRequest("Tasks must be an array");
      }

      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        id,
        { populate: ["user"] }
      );

      if (!workLog) return ctx.notFound("Work log not found");
      if (workLog.user.id !== userId) {
        return ctx.forbidden("You can update only your own work log");
      }

      const allowedStatus = ["in-progress", "completed", "hold"];
      let totalEstimated = 0;
      let totalActual = 0;

      for (const task of tasks) {
        if (!allowedStatus.includes(task.status)) {
          return ctx.badRequest(`Invalid task status: ${task.status}`);
        }
        totalEstimated += Number(task.estimated_time || 0);
        totalActual += Number(task.actual_time || 0);
      }

      const updated = await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        {
          data: {
            tasks,
            total_estimated_time: totalEstimated,
            total_actual_time: totalActual,
          },
        }
      );

      return {
        message: "Work log updated successfully",
        work_log: updated,
      };
    },
  })
);
