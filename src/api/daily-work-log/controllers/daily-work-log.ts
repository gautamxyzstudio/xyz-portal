import { factories } from "@strapi/strapi";

const STANDARD_MINUTES = 480; // 8 hours

export default factories.createCoreController(
  "api::daily-work-log.daily-work-log",
  ({ strapi }) => ({

    /**
     * EMPLOYEE: Create or Update (Upsert) Daily Work Log
     */
    async upsert(ctx) {
      const { user, date, tasks } = ctx.request.body;

      if (!user || !date || !Array.isArray(tasks)) {
        return ctx.badRequest("user, date and tasks are required");
      }

      // 1️⃣ Calculate totals from tasks
      const totalEstimated = tasks.reduce(
        (sum, t) => sum + (t.estimated_minutes || 0),
        0
      );

      const totalActual = tasks.reduce(
        (sum, t) => sum + (t.actual_minutes || 0),
        0
      );

      const regularMinutes = Math.min(totalActual, STANDARD_MINUTES);
      const overtimeMinutes = Math.max(totalActual - STANDARD_MINUTES, 0);

      const status = totalActual >= STANDARD_MINUTES
        ? "completed"
        : "incomplete";

      // 2️⃣ Find existing daily log (same user + date)
      const existing = await strapi.entityService.findMany(
        "api::daily-work-log.daily-work-log",
        {
          filters: { user, date },
          populate: { daily_tasks: true },
          limit: 1
        }
      );

      let dailyLog;

      // 3️⃣ Update or Create daily-work-log
      if (existing.length > 0) {
        dailyLog = existing[0];

        // delete old tasks
        for (const task of dailyLog.daily_tasks || []) {
          await strapi.entityService.delete(
            "api::daily-task.daily-task",
            task.id
          );
        }

        dailyLog = await strapi.entityService.update(
          "api::daily-work-log.daily-work-log",
          dailyLog.id,
          {
            data: {
              total_estimated_minutes: totalEstimated,
              total_actual_minutes: totalActual,
              regular_minutes: regularMinutes,
              overtime_minutes: overtimeMinutes,
              status
            }
          }
        );
      } else {
        dailyLog = await strapi.entityService.create(
          "api::daily-work-log.daily-work-log",
          {
            data: {
              user,
              date,
              total_estimated_minutes: totalEstimated,
              total_actual_minutes: totalActual,
              regular_minutes: regularMinutes,
              overtime_minutes: overtimeMinutes,
              status
            }
          }
        );
      }

      // 4️⃣ Create daily tasks
      for (const task of tasks) {
        await strapi.entityService.create(
          "api::daily-task.daily-task",
          {
            data: {
              daily_work_log: dailyLog.id,
              task_name: task.task_name,
              estimated_minutes: task.estimated_minutes || 0,
              actual_minutes: task.actual_minutes || 0,
              task_status: task.task_status || "pending"
            }
          }
        );
      }

      ctx.body = {
        success: true,
        daily_work_log_id: dailyLog.id
      };
    },

    /**
     * HR: Get Daily Logs with Tasks
     */
    async hrList(ctx) {
      const { start, end, user } = ctx.query;

      const logs = await strapi.entityService.findMany(
        "api::daily-work-log.daily-work-log",
        {
          filters: {
            ...(user && { user }),
            ...(start && end && {
              date: { $between: [start, end] }
            })
          },
          populate: {
            user: true,
            daily_tasks: true
          },
          sort: { date: "desc" }
        }
      );

      ctx.body = logs;
    }
  })
);
