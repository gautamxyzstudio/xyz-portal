import { factories } from "@strapi/strapi";
import { Context } from "koa";

/* ================= CONSTANTS ================= */
const THIRTY_MIN = 30 * 60 * 1000;
const LUNCH_START = 13;
const LUNCH_END = 14

/* ================= TIME HELPERS (IST SAFE) ================= */
const getNow = () => new Date();

const getWorkDateIST = () => {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};



const isLunchTime = (d: Date) => {
  const istHour = new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  ).getHours();

  return istHour >= 13 && istHour < 14;
};


/* ================= TASK HELPERS ================= */
type WorkTask = {
  task_id: number;
  task_title: string;
  task_description?: string; // OPTIONAL
  status: "in-progress" | "hold" | "completed";
  project: {
    id: number;
    title: string;
  } | null;
  createdAt: string;
  time_spent: number;
  is_running: boolean;
  last_started_at: string | null;
  work_sessions: {
    start: string;
    end: string | null;
  }[];
};


/* ▶️ Pause a task */
const pauseTask = (task: WorkTask, now: Date) => {
  if (!Array.isArray(task.work_sessions)) {
    task.work_sessions = [];
  }

  if (!task.is_running || !task.last_started_at) return;

  const elapsed = Math.floor(
    (now.getTime() - new Date(task.last_started_at).getTime()) / 1000
  );

  task.time_spent = (task.time_spent || 0) + elapsed;
  task.is_running = false;
  task.last_started_at = null;

  const sessions = task.work_sessions;
  const lastSession =
    sessions && sessions.length > 0
      ? sessions[sessions.length - 1]
      : null;

  if (lastSession && !lastSession.end) {
    lastSession.end = now.toISOString();
  }
};

/* ▶️ Start / Resume a task */
const startTask = (task: WorkTask, now: Date) => {
  /* 🔒 NEVER start completed task */
  if (task.status === "completed") return;

  if (task.is_running) return;

  task.is_running = true;
  task.last_started_at = now.toISOString();

  if (!Array.isArray(task.work_sessions)) {
    task.work_sessions = [];
  }

  task.work_sessions.push({
    start: now.toISOString(),
    end: null,
  });
};


/* ⏱ Calculate total time (including running task) */
const calcTotalTime = (tasks: WorkTask[], now: Date) => {
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

      const today = getWorkDateIST();
      const body = ctx.request.body?.data || {};
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];

      /* =====================================================
         1️⃣ CHECK IF WORK LOG ALREADY EXISTS
         (DO NOT create DailyTask if it exists)
      ===================================================== */
      let existingWorkLog = await strapi.db
        .query("api::work-log.work-log")
        .findOne({
          where: {
            work_date: today, // ✅ FIX
            user: userId,
          },

        });

      if (existingWorkLog) {
        const dailyTask = existingWorkLog.daily_task
          ? await strapi.entityService.findOne(
            "api::daily-task.daily-task",
            existingWorkLog.daily_task
          )
          : null;

        return {
          work_log: existingWorkLog,
          daily_task: dailyTask,
        };
      }

      /* =====================================================
         2️⃣ FETCH USER-ASSIGNED PROJECTS
      ===================================================== */
      const userProjects = await strapi.entityService.findMany(
        "api::project.project",
        {
          filters: {
            users_permissions_users: userId,
          },
          fields: ["id", "title"],
        }
      );

      const allowedProjectMap = new Map(
        userProjects.map((p: any) => [p.id, p])
      );

      /* =====================================================
         3️⃣ BUILD TASKS (VALIDATION + DEFAULTS)
      ===================================================== */
      const allowedStatus = ["in-progress", "hold", "completed"];

      let tasks: WorkTask[] = [];

      try {
        tasks = incomingTasks.map((t: any, i: number) => {
          if (!t.task_title || !String(t.task_title).trim()) {
            throw new Error("Task title is required");
          }

          const projectId = t.project;

          if (
            projectId !== undefined &&
            !allowedProjectMap.has(projectId)
          ) {
            throw new Error(
              `Project ${projectId} is not assigned to this user`
            );
          }

          const project = projectId
            ? {
              id: projectId,
              title: allowedProjectMap.get(projectId).title,
            }
            : null;

          return {
            task_id: i + 1,
            task_title: String(t.task_title).trim(),
            status: allowedStatus.includes(t.status)
              ? t.status
              : "in-progress", // ✅ default
            project,
            createdAt: new Date().toISOString(),
            time_spent: 0,
            is_running: false,
            last_started_at: null,
            work_sessions: [],

          };
        });
      } catch (err: any) {
        return ctx.badRequest(err.message);
      }

      // 🔒 DAILY TASK: one per date (shared by all users)
      let dailyTask = await strapi.db
        .query("api::daily-task.daily-task")
        .findOne({
          where: { date: today },
        });

      if (!dailyTask) {
        try {
          dailyTask = await strapi.entityService.create(
            "api::daily-task.daily-task",
            { data: { date: today } }
          );
        } catch (err: any) {
          // 🔁 Another request created it at the same time
          dailyTask = await strapi.db
            .query("api::daily-task.daily-task")
            .findOne({
              where: { date: today },
            });
        }
      }


      /* =====================================================
         5️⃣ CREATE WORK LOG
      ===================================================== */
      const workLog = await strapi.entityService.create(
        "api::work-log.work-log",
        {
          data: {
            user: userId,
            work_date: today,
            daily_task: dailyTask.id,
            tasks: tasks as any,
            active_task_id: null,
            total_time_taken: 0,
          },
        }
      );

      return {
        work_log: workLog,
        daily_task: dailyTask,
      };
    },

    /* =====================================================
       ADD TASK
    ===================================================== */

    async addTask(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const { id } = ctx.params; // workLogId
      const { task_title, status, project } = ctx.request.body?.data || {};

      if (!task_title || !String(task_title).trim()) {
        return ctx.badRequest("Task title is required");
      }

      const allowedStatus = ["in-progress", "hold", "completed"];
      const finalStatus = allowedStatus.includes(status)
        ? status
        : "in-progress";

      /* ===== FETCH WORK LOG ===== */
      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        id,
        { populate: ["user"] }
      );

      if (!workLog || workLog.user.id !== userId) {
        return ctx.forbidden();
      }

      /* ===== VALIDATE PROJECT ===== */
      let projectData: { id: number; title: string } | null = null;

      if (project !== undefined && project !== null) {
        const assignedProject = await strapi.db
          .query("api::project.project")
          .findOne({
            where: {
              id: project,
              users_permissions_users: { id: userId },
            },
            select: ["id", "title"],
          });

        if (!assignedProject) {
          return ctx.badRequest("Project is not assigned to this user");
        }

        projectData = {
          id: assignedProject.id,
          title: assignedProject.title,
        };
      }

      /* ===== LOAD TASKS SAFELY ===== */
      const tasks: WorkTask[] = Array.isArray(workLog.tasks)
        ? (workLog.tasks as WorkTask[])
        : [];

      const nextId =
        tasks.length > 0
          ? Math.max(...tasks.map(t => t.task_id)) + 1
          : 1;

      /* ===== CREATE TASK (FINAL, CORRECT) ===== */
      const newTask = {
        task_id: nextId,
        task_title: String(task_title).trim(),
        status: finalStatus,
        project: projectData,
        createdAt: new Date().toISOString(),
        time_spent: 0,
        is_running: false,
        last_started_at: null,
        work_sessions: [],

      } as WorkTask;

      tasks.push(newTask);

      return await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        { data: { tasks: tasks as any } }
      );
    },


    /* =====================================================
       UPDATE TASK (30 MIN RULE)
    ===================================================== */
    async updateTask(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { task_id, task_title, status } = ctx.request.body?.data || {};

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

      const tasks = (workLog.tasks || []) as WorkTask[];
      const task = tasks.find(t => t.task_id === task_id);

      if (!task) {
        return ctx.badRequest("Task not found");
      }

      /* 🔒 Title editable only within 30 minutes */
      const isEditingTitle = task_title !== undefined;

      if (
        isEditingTitle &&
        Date.now() - new Date(task.createdAt).getTime() > THIRTY_MIN
      ) {
        return ctx.forbidden("Task title editable only within 30 minutes");
      }

      /* ✅ Apply updates */
      if (task_title !== undefined) {
        task.task_title = task_title;
      }

      if (status !== undefined) {
        task.status = status; // ✅ allowed anytime
      }

      // 🛑 Auto-stop when completed
      if (status === "completed") {
        pauseTask(task, getNow());

      }

      return await strapi.entityService.update(
        "api::work-log.work-log",
        id,
        { data: { tasks: tasks as any } }
      );
    },

    /* =====================================================
       START / SWITCH TIMER
    ===================================================== */
    async startTaskTimer(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const { workLogId, task_id } = ctx.request.body;
      const now = getNow();
      const today = getWorkDateIST();


      /* ===== CHECK ATTENDANCE ===== */
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
        return ctx.badRequest("You have already checked out");
      }

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

      const tasks = (workLog.tasks || []) as WorkTask[];

      for (const t of tasks) {
        pauseTask(t, now);
      }

      const task = tasks.find(t => t.task_id === task_id);
      if (!task) return ctx.badRequest("Task not found");

      /* 🔒 BLOCK COMPLETED TASKS */
      if (task.status === "completed") {
        return ctx.badRequest("Completed tasks cannot be started again");
      }

      startTask(task, now);

      const totalTime = calcTotalTime(tasks, now);

      return await strapi.entityService.update(
        "api::work-log.work-log",
        workLogId,
        {
          data: {
            tasks: tasks as any,
            active_task_id: task_id,
            total_time_taken: totalTime,
          },
        }
      );
    },

    /* =====================================================
       STOP ALL TIMERS
    ===================================================== */
    async stopTaskTimer(ctx: Context) {
      const userId = ctx.state.user?.id;
      const { workLogId } = ctx.request.body;
      const now = getNow();

      const workLog: any = await strapi.entityService.findOne(
        "api::work-log.work-log",
        workLogId,
        { populate: ["user"] }
      );

      if (!workLog || workLog.user.id !== userId) {
        return ctx.forbidden();
      }

      const tasks = (workLog.tasks || []) as WorkTask[];

      for (const t of tasks) {
        pauseTask(t, now);
      }

      const totalTime = calcTotalTime(tasks, now);

      return await strapi.entityService.update(
        "api::work-log.work-log",
        workLogId,
        {
          data: {
            tasks: tasks as any,
            active_task_id: null,
            total_time_taken: totalTime,
          },
        }
      );
    },

    /* =====================================================
       USER / HR WORK LOGS
    ===================================================== */
    async userWorkLogs(ctx: Context) {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized("Login required");

      const { userId, startDate, endDate } = ctx.query as any;

      const filters: any = {};

      // 🔐 Normal user → only self
      if (authUser.user_type !== "Hr") {
        filters.user = authUser.id;
      }

      // 👩‍💼 HR → optional user filter
      if (authUser.user_type === "Hr" && userId) {
        filters.user = userId;
      }

      // 📅 Date filter (safe, IST-friendly)
      if (startDate) {
        filters.work_date = startDate;
      }

      const workLogs = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters,
          sort: { work_date: "asc" },
          populate: {
            user: {
              fields: ["id", "username", "email", "user_type"],
            },
          },
        }
      );

      return {
        date: startDate,
        userId: userId || "ALL",
        count: workLogs.length,
        work_logs: workLogs,
      };
    }

  })
);
