import { factories } from "@strapi/strapi";
import { Context } from "koa";

export default factories.createCoreController(
  "api::work-log.work-log",
  ({ strapi }) => ({

    // =====================================================
    // CREATE OR GET TODAY'S WORK LOG (AUTO TASK IDS)
    // =====================================================
    async createToday(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const today = new Date().toISOString().split("T")[0];
      const body = ctx.request.body?.data || {};
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];

      const allowedStatus = ["in-progress", "completed", "hold"];

      // 1️⃣ Find Daily Task
      const dailyTasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        {
          filters: { date: today },
          limit: 1,
        }
      );

      // ✅ FIX: explicit typing to avoid TS error
      let dailyTask: any;

      if (dailyTasks.length) {
        dailyTask = dailyTasks[0];
      } else {
        dailyTask = await strapi.entityService.create(
          "api::daily-task.daily-task",
          {
            data: { date: today },
          }
        );
      }

      // 2️⃣ Find existing Work Log
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

      // 🔒 Already exists → return it
      if (workLogs.length) {
        return {
          date: today,
          work_log: workLogs[0],
        };
      }

      // 3️⃣ Create first work log with sequential task ids
      let totalEstimated = 0;
      let totalActual = 0;

      const tasksWithIds = incomingTasks.map((task, index) => {
        if (task.status && !allowedStatus.includes(task.status)) {
          throw new Error(`Invalid task status: ${task.status}`);
        }

        totalEstimated += Number(task.estimated_time || 0);
        totalActual += Number(task.actual_time || 0);

        return {
          id: index + 1, // ✅ 1,2,3...
          task_title: task.task_title || "",
          task_description: task.task_description || "",
          status: task.status,
          estimated_time: Number(task.estimated_time || 0),
          actual_time: Number(task.actual_time || 0),
        };
      });

      const workLog = await strapi.entityService.create(
        "api::work-log.work-log",
        {
          data: {
            user: userId,
            daily_task: dailyTask.id,
            tasks: tasksWithIds,
            total_estimated_time: totalEstimated,
            total_actual_time: totalActual,
          },
        }
      );

      return {
        date: today,
        work_log: workLog,
      };
    },

    // =====================================================
    // UPDATE WORK LOG (status + actual_time only)
    // =====================================================
    // async updateWorkLog(ctx: Context) {
    //   const userId = ctx.state.user?.id;
    //   const { id } = ctx.params;
    //   const { tasks } = ctx.request.body?.data || {};

    //   if (!userId) return ctx.unauthorized("Login required");
    //   if (!Array.isArray(tasks)) {
    //     return ctx.badRequest("Tasks must be an array");
    //   }

    //   const allowedStatus = ["in-progress", "completed", "hold"];

    //   const workLog: any = await strapi.entityService.findOne(
    //     "api::work-log.work-log",
    //     id,
    //     { populate: ["user"] }
    //   );

    //   if (!workLog) return ctx.notFound("Work log not found");
    //   if (workLog.user.id !== userId) {
    //     return ctx.forbidden("You can update only your own work log");
    //   }

    //   const existingTasks = Array.isArray(workLog.tasks)
    //     ? [...workLog.tasks]
    //     : [];

    //   for (const incoming of tasks) {
    //     if (incoming.id === undefined) {
    //       return ctx.badRequest("Task id is required");
    //     }

    //     const index = existingTasks.findIndex(
    //       (t) => Number(t.id) === Number(incoming.id)
    //     );

    //     if (index === -1) {
    //       return ctx.badRequest(`Task not found: ${incoming.id}`);
    //     }

    //     // 🚫 BLOCK UNAUTHORIZED FIELD CHANGES
    //     if (
    //       incoming.estimated_time !== undefined ||
    //       incoming.task_title !== undefined ||
    //       incoming.task_description !== undefined
    //     ) {
    //       return ctx.forbidden(
    //         "You are not allowed to change estimated time, title or description"
    //       );
    //     }

    //     // ✅ status (allowed)
    //     if (incoming.status !== undefined) {
    //       if (!allowedStatus.includes(incoming.status)) {
    //         return ctx.badRequest(`Invalid status: ${incoming.status}`);
    //       }
    //       existingTasks[index].status = incoming.status;
    //     }

    //     // ✅ actual_time (allowed)
    //     if (incoming.actual_time !== undefined) {
    //       if (Number(incoming.actual_time) < 0) {
    //         return ctx.badRequest("Actual time must be >= 0");
    //       }
    //       existingTasks[index].actual_time = Number(incoming.actual_time);
    //     }
    //   }

    //   // 🔢 Recalculate totals (estimated stays same)
    //   let totalEstimated = 0;
    //   let totalActual = 0;

    //   for (const task of existingTasks) {
    //     totalEstimated += Number(task.estimated_time || 0);
    //     totalActual += Number(task.actual_time || 0);
    //   }

    //   const updated = await strapi.entityService.update(
    //     "api::work-log.work-log",
    //     id,
    //     {
    //       data: {
    //         tasks: existingTasks,
    //         total_estimated_time: totalEstimated,
    //         total_actual_time: totalActual,
    //       },
    //     }
    //   );

    //   return {
    //     message: "Work log updated successfully",
    //     work_log: updated,
    //   };
    // },

async updateWorkLog(ctx: Context) {
  const userId = ctx.state.user?.id;
  const { id } = ctx.params;
  const { tasks } = ctx.request.body?.data || {};

  if (!userId) return ctx.unauthorized("Login required");
  if (!Array.isArray(tasks)) {
    return ctx.badRequest("Tasks must be an array");
  }

  const allowedStatus = ["in-progress", "completed", "hold"];
  const THIRTY_MIN = 30 * 60 * 1000;
  const now = Date.now();

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

  /* ================= VALIDATION PHASE ================= */
  for (const incoming of tasks) {
    if (incoming.id === undefined) {
      return ctx.badRequest("Task id is required");
    }

    const existingTask = existingTasks.find(
      (t) => Number(t.id) === Number(incoming.id)
    );

    if (!existingTask) {
      return ctx.badRequest(`Task not found: ${incoming.id}`);
    }

    // 🛡 Auto-fix missing createdAt
    if (!existingTask.createdAt) {
      existingTask.createdAt = workLog.createdAt;
    }

    const createdAtTime = new Date(existingTask.createdAt).getTime();
    const within30Min = now - createdAtTime <= THIRTY_MIN;

    /* 🚫 estimated_time */
    if (incoming.estimated_time !== undefined) {
      return ctx.forbidden(
        `Task ${incoming.id}: estimated time cannot be edited`
      );
    }

    /* 📝 task_title */
    if (incoming.task_title !== undefined && !within30Min) {
      return ctx.forbidden(
        `Task ${incoming.id}: title can only be edited within 30 minutes`
      );
    }

    /* 📝 task_description */
    if (incoming.task_description !== undefined && !within30Min) {
      return ctx.forbidden(
        `Task ${incoming.id}: description can only be edited within 30 minutes`
      );
    }

    /* 🚦 status */
    if (
      incoming.status !== undefined &&
      !allowedStatus.includes(incoming.status)
    ) {
      return ctx.badRequest(
        `Task ${incoming.id}: invalid status "${incoming.status}"`
      );
    }

    /* ⏱ actual_time */
    if (
      incoming.actual_time !== undefined &&
      Number(incoming.actual_time) < 0
    ) {
      return ctx.badRequest(
        `Task ${incoming.id}: actual time must be >= 0`
      );
    }
  }

  /* ================= UPDATE PHASE ================= */
  for (const incoming of tasks) {
    const index = existingTasks.findIndex(
      (t) => Number(t.id) === Number(incoming.id)
    );

    const existingTask = existingTasks[index];

    if (incoming.task_title !== undefined) {
      existingTask.task_title = incoming.task_title;
    }

    if (incoming.task_description !== undefined) {
      existingTask.task_description = incoming.task_description;
    }

    if (incoming.status !== undefined) {
      existingTask.status = incoming.status;
    }

    if (incoming.actual_time !== undefined) {
      existingTask.actual_time = Number(incoming.actual_time);
    }
  }

  /* ================= RECALCULATE TOTALS ================= */
  let totalEstimated = 0;
  let totalActual = 0;

  for (const task of existingTasks) {
    totalEstimated += Number(task.estimated_time || 0);
    totalActual += Number(task.actual_time || 0);
  }

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


    // =====================================================
    // ADD TASK (AUTO NEXT ID)
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

      const lastId =
        existingTasks.length > 0
          ? Math.max(...existingTasks.map((t) => Number(t.id)))
          : 0;

      const newTask = {
        id: lastId + 1,
        task_title: task.task_title || "",
        task_description: task.task_description || "",
        status: task.status,
        estimated_time: Number(task.estimated_time || 0),
        actual_time: Number(task.actual_time || 0),
      };

      const updatedTasks = [...existingTasks, newTask];

      let totalEstimated = 0;
      let totalActual = 0;

      for (const t of updatedTasks) {
        totalEstimated += Number(t.estimated_time || 0);
        totalActual += Number(t.actual_time || 0);
      }

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
