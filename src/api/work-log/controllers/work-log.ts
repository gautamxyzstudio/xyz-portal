import { factories } from "@strapi/strapi";
import { Context } from "koa";

/* ================= CONSTANTS ================= */
const THIRTY_MIN = 30 * 60 * 1000;
const LUNCH_START = 13;
const LUNCH_END = 14;

/* ================= HELPERS ================= */
const getISTNow = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

const isLunchTime = (d: Date) =>
  d.getHours() >= LUNCH_START && d.getHours() < LUNCH_END;

/* ▶️ Pause a task */
const pauseTask = (task: any, now: Date) => {
  if (!task.is_running || !task.last_started_at) return;

  const elapsed = Math.floor(
    (now.getTime() - new Date(task.last_started_at).getTime()) / 1000
  );

  task.time_spent = (task.time_spent || 0) + elapsed;
  task.is_running = false;
  task.last_started_at = null;
};

/* ▶️ Start / Resume a task */
const startTask = (task: any, now: Date) => {
  if (task.is_running) return;

  task.is_running = true;
  task.last_started_at = now.toISOString();
};

/* ⏱ Calculate total time (including running task) */
const calcTotalTime = (tasks: any[], now: Date) => {
  let total = 0;

  for (const task of tasks) {
    total += task.time_spent || 0;

    if (task.is_running && task.last_started_at) {
      total += Math.floor(
        (now.getTime() - new Date(task.last_started_at).getTime()) / 1000
      );
    }
  }

  return total;
};

export default factories.createCoreController(
  "api::work-log.work-log",
  ({ strapi }) => ({

    /* =====================================================
       CREATE / GET TODAY WORK LOG + DAILY TASK
    ===================================================== */
    async createToday(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const today = getISTNow().toISOString().slice(0, 10);

      let dailyTask;
      const dailyTasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        { filters: { date: today }, limit: 1 }
      );

      if (dailyTasks.length) {
        dailyTask = dailyTasks[0];
      } else {
        dailyTask = await strapi.entityService.create(
          "api::daily-task.daily-task",
          { data: { date: today } }
        );
      }

      const existing = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters: { user: userId, work_date: today },
          limit: 1,
        }
      );

      if (existing.length) {
        return { work_log: existing[0], daily_task: dailyTask };
      }

      const body = ctx.request.body?.data || {};
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];

      const tasks = incomingTasks.map((t, i) => ({
        task_id: i + 1,
        task_title: t.task_title || "",
        task_description: t.task_description || "",
        status: t.status || "hold",
        createdAt: new Date().toISOString(),
        time_spent: 0,
        is_running: false,
        last_started_at: null,
      }));

      const workLog = await strapi.entityService.create(
        "api::work-log.work-log",
        {
          data: {
            user: userId,
            work_date: today,
            daily_task: dailyTask.id,
            tasks,
            active_task_id: null,
            total_time_taken: 0,
          },
        }
      );

      return { work_log: workLog, daily_task: dailyTask };
    },

    /* =====================================================
       ADD TASK
    ===================================================== */
    async addTask(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { task_title, task_description, status } =
        ctx.request.body?.data || {};

      const allowedStatus = ["in-progress", "hold", "completed"];
      if (!allowedStatus.includes(status)) {
        return ctx.badRequest("Invalid status");
      }

      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        id,
        { populate: ["user"] }
      );

      if (!workLog || workLog.user.id !== userId) {
        return ctx.forbidden();
      }

      const tasks = workLog.tasks || [];
      const nextId =
        tasks.length > 0 ? Math.max(...tasks.map(t => t.task_id)) + 1 : 1;

      tasks.push({
        task_id: nextId,
        task_title,
        task_description,
        status,
        createdAt: new Date().toISOString(),
        time_spent: 0,
        is_running: false,
        last_started_at: null,
      });

      return await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        { data: { tasks } }
      );
    },

    /* =====================================================
       UPDATE TASK (30 MIN RULE)
    ===================================================== */
    async updateTask(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { task_id, task_title, task_description, status } =
        ctx.request.body?.data || {};

      const allowedStatus = ["in-progress", "hold", "completed"];
      if (status && !allowedStatus.includes(status)) {
        return ctx.badRequest("Invalid status");
      }

      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        id,
        { populate: ["user"] }
      );

      if (!workLog || workLog.user.id !== userId) {
        return ctx.forbidden();
      }

      const task = workLog.tasks.find(t => t.task_id === task_id);
      if (!task) return ctx.badRequest("Task not found");

      if (
        Date.now() - new Date(task.createdAt).getTime() > THIRTY_MIN &&
        (task_title !== undefined || task_description !== undefined)
      ) {
        return ctx.forbidden("Editable only within 30 minutes");
      }

      if (task_title !== undefined) task.task_title = task_title;
      if (task_description !== undefined)
        task.task_description = task_description;
      if (status !== undefined) task.status = status;

      return await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        { data: { tasks: workLog.tasks } }
      );
    },

    /* =====================================================
       START / SWITCH TIMER (PAUSE / RESUME)
    ===================================================== */
    async startTaskTimer(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const { workLogId, task_id } = ctx.request.body;
      const now = getISTNow();

      /* ================= CHECK CHECKOUT ================= */
      const today = now.toISOString().slice(0, 10);

      const attendance = await strapi.entityService.findMany(
        "api::daily-attendance.daily-attendance",
        {
          filters: { user: userId, Date: today },
          limit: 1,
        }
      );

      if (!attendance.length) {
        return ctx.badRequest("You have not checked in today");
      }

      if (attendance[0].out && attendance[0].out !== "00:00:00") {
        return ctx.badRequest("You have already checked out. Tasks cannot be started.");
      }

      /* ================= LUNCH CHECK ================= */
      if (isLunchTime(now)) {
        return ctx.badRequest("Timers paused between 1–2 PM");
      }

      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        workLogId,
        { populate: ["user"] }
      );

      if (!workLog || workLog.user.id !== userId) {
        return ctx.forbidden();
      }

      /* ================= PAUSE ALL TASKS ================= */
      for (const t of workLog.tasks) {
        pauseTask(t, now);
      }

      /* ================= START SELECTED TASK ================= */
      const task = workLog.tasks.find(t => t.task_id === task_id);
      if (!task) return ctx.badRequest("Task not found");

      startTask(task, now);

      const totalTime = calcTotalTime(workLog.tasks, now);

      return await strapi.entityService.update(
        "api::work-log.work-log",
        workLogId,
        {
          data: {
            tasks: workLog.tasks,
            active_task_id: task_id,
            total_time_taken: totalTime,
          },
        }
      );
    },

    /* =====================================================
       STOP ALL TIMERS (MANUAL / CHECKOUT)
    ===================================================== */
    async stopTaskTimer(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { workLogId } = ctx.request.body;
      const now = getISTNow();

      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        workLogId,
        { populate: ["user"] }
      );

      if (!workLog || workLog.user.id !== userId) {
        return ctx.forbidden();
      }

      for (const t of workLog.tasks) {
        pauseTask(t, now);
      }

      const totalTime = calcTotalTime(workLog.tasks, now);

      return await strapi.entityService.update(
        "api::work-log.work-log",
        workLogId,
        {
          data: {
            tasks: workLog.tasks,
            active_task_id: null,
            total_time_taken: totalTime,
          },
        }
      );
    },

    /* =====================================================
       SINGLE USER / HR WORK LOGS
    ===================================================== */
    async userWorkLogs(ctx: Context) {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized("Login required");

      let { userId, startDate, endDate } = ctx.query as any;

      if (!userId) userId = authUser.id;

      if (authUser.user_type !== "Hr" && Number(userId) !== authUser.id) {
        return ctx.forbidden("You can only view your own work logs");
      }

      const filters: any = { user: userId };

      if (startDate && endDate) {
        filters.work_date = { $gte: startDate, $lte: endDate };
      }

      const workLogs = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters,
          sort: { work_date: "asc" },
          populate: { daily_task: { fields: ["date"] } },
        }
      );

      return {
        userId,
        startDate: startDate || null,
        endDate: endDate || null,
        count: workLogs.length,
        work_logs: workLogs,
      };
    },

  })
);
