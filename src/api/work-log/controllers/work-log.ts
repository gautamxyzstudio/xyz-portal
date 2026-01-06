import { factories } from "@strapi/strapi";
import { Context } from "koa";

export default factories.createCoreController(
  "api::work-log.work-log",
  ({ strapi }) => ({

    // =====================================================
    // CREATE OR GET TODAY'S WORK LOG (ACCEPT TASKS)
    // =====================================================
    async createToday(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const today = new Date().toISOString().split("T")[0];

      // 🔒 READ TASKS ONLY FOR FIRST-TIME CREATION
      const body = ctx.request.body?.data || {};
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];

      const allowedStatus = ["in-progress", "completed", "hold"];

      // 1️⃣ Find or create Daily Task (ONE per day)
      const dailyTasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        {
          filters: { date: today },
          limit: 1,
        }
      );

      let dailyTask: any;
      if (!dailyTasks.length) {
        dailyTask = await strapi.entityService.create(
          "api::daily-task.daily-task",
          {
            data: { date: today },
          }
        );
      } else {
        dailyTask = dailyTasks[0];
      }

      // 2️⃣ Find existing Work Log (ONE per user per day)
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

      // ✅ CASE 1: CREATE (FIRST TIME TODAY)
      if (!workLogs.length) {
        let totalEstimated = 0;
        let totalActual = 0;

        for (const task of incomingTasks) {
          if (task.status && !allowedStatus.includes(task.status)) {
            return ctx.badRequest(`Invalid task status: ${task.status}`);
          }

          totalEstimated += Number(task.estimated_time || 0);
          totalActual += Number(task.actual_time || 0);
        }

        workLog = await strapi.entityService.create(
          "api::work-log.work-log",
          {
            data: {
              user: userId,
              daily_task: dailyTask.id,
              tasks: incomingTasks,
              total_estimated_time: totalEstimated,
              total_actual_time: totalActual,
            },
          }
        );
      }
      // 🔒 CASE 2: ALREADY EXISTS → JUST RETURN IT (NO UPDATE)
      else {
        workLog = workLogs[0];
      }

      return {
        date: today,
        work_log: workLog,
      };
    },

    // =====================================================
    // UPDATE WORK LOG (ONLY actual_time + status)
    // =====================================================
    async updateWorkLog(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { tasks } = ctx.request.body?.data || {};

      if (!userId) return ctx.unauthorized("Login required");
      if (!Array.isArray(tasks)) {
        return ctx.badRequest("Tasks must be an array");
      }

      const allowedStatus = ["in-progress", "completed", "hold"];

      // 1️⃣ Fetch work log
      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        id,
        { populate: ["user"] }
      );

      if (!workLog) return ctx.notFound("Work log not found");
      if (workLog.user.id !== userId) {
        return ctx.forbidden("You can update only your own work log");
      }

      const existingTasks = Array.isArray(workLog.tasks)
        ? [...workLog.tasks]
        : [];

      // 2️⃣ Update ONLY allowed fields per task
      for (const incoming of tasks) {
        const index = existingTasks.findIndex(
          (t) => t.id === incoming.id
        );

        if (index === -1) {
          return ctx.badRequest(`Task not found: ${incoming.id}`);
        }

        // ✅ status
        if (incoming.status) {
          if (!allowedStatus.includes(incoming.status)) {
            return ctx.badRequest(`Invalid status: ${incoming.status}`);
          }
          existingTasks[index].status = incoming.status;
        }

        // ✅ actual_time
        if (incoming.actual_time !== undefined) {
          if (Number(incoming.actual_time) < 0) {
            return ctx.badRequest("Actual time must be >= 0");
          }
          existingTasks[index].actual_time = Number(incoming.actual_time);
        }

        // ❌ estimated_time is intentionally ignored
      }

      // 3️⃣ Recalculate totals
      let totalEstimated = 0;
      let totalActual = 0;

      for (const task of existingTasks) {
        totalEstimated += Number(task.estimated_time || 0);
        totalActual += Number(task.actual_time || 0);
      }

      // 4️⃣ Save
      const updated = await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        {
          data: {
            tasks: existingTasks,
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

    //  =====================================================
    // ADD TASK IN EXISTING WORK LOG 
    // =====================================================

    async addTask(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { task } = ctx.request.body?.data || {};

      if (!userId) return ctx.unauthorized("Login required");
      if (!task) return ctx.badRequest("Task is required");

      const allowedStatus = ["in-progress", "completed", "hold"];

      if (!allowedStatus.includes(task.status)) {
        return ctx.badRequest(`Invalid task status: ${task.status}`);
      }

      // 1️⃣ Fetch work log
      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        id,
        { populate: ["user"] }
      );

      if (!workLog) return ctx.notFound("Work log not found");
      if (workLog.user.id !== userId) {
        return ctx.forbidden("You can update only your own work log");
      }

      const existingTasks = Array.isArray(workLog.tasks)
        ? workLog.tasks
        : [];

      // 2️⃣ Auto-generate task ID if missing
      const newTask = {
        id: task.id || `task-${Date.now()}`,
        task_description: task.task_description || "",
        status: task.status,
        estimated_time: Number(task.estimated_time || 0),
        actual_time: Number(task.actual_time || 0),
      };

      const updatedTasks = [...existingTasks, newTask];

      // 3️⃣ Recalculate totals
      let totalEstimated = 0;
      let totalActual = 0;

      for (const t of updatedTasks) {
        totalEstimated += Number(t.estimated_time || 0);
        totalActual += Number(t.actual_time || 0);
      }

      // 4️⃣ Save
      const updated = await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        {
          data: {
            tasks: updatedTasks,
            total_estimated_time: totalEstimated,
            total_actual_time: totalActual,
          },
        }
      );

      return {
        message: "Task added successfully",
        work_log: updated,
      };
    },

  })
);
