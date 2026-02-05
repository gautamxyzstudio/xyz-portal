import { factories } from "@strapi/strapi";
import { Context } from "koa";
import crypto from "crypto";

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
  task_key: string;                // 👈 permanent identity
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

const DAILY_MEETING_TASK = (): WorkTask => ({
  task_id: 1,
  task_key: "DAILY_MEETING",        // 👈 fixed key (never carried)
  task_title: "Daily Meeting",
  status: "in-progress",
  project: null,
  createdAt: new Date().toISOString(),
  time_spent: 0,
  is_running: false,
  last_started_at: null,
  work_sessions: [],
});

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
       CREATE TODAY WORK LOG + DAILY TASK
    ===================================================== */
    async createToday(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const today = getWorkDateIST();
      const body = ctx.request.body?.data || {};
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];

      /* =====================================================
   1️⃣ CHECK ATTENDANCE FIRST
===================================================== */
      const attendance = await strapi.entityService.findMany(
        "api::daily-attendance.daily-attendance",
        {
          filters: {
            user: userId,
            Date: today,
            in: { $notNull: true }, // ✅ must be checked-in
          },
          limit: 1,
        }
      );

      //  check attendance
      if (!attendance.length) {
        return {
          work_log: {
            id: null,
            tasks: [],
            work_date: today,
            has_attendance: false,
          },
        };
      }


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
            task_key: crypto.randomUUID(), // 👈 ADD

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

      /* ================= CARRY FORWARD (FINAL FIX) ================= */

      // 🔥 Get LAST worklog BEFORE today
      const lastWorkLog = await strapi.db
        .query("api::work-log.work-log")
        .findOne({
          where: {
            user: userId,
            work_date: { $ne: today }, // ✅ exclude today
          },
          orderBy: { work_date: "desc" },
        });

      /* 1️⃣ Always add today's Daily Meeting */
      let finalTasks: WorkTask[] = [DAILY_MEETING_TASK()];

      /* 2️⃣ Carry forward ALL unfinished tasks (NOT completed, NOT meeting) */
      if (lastWorkLog?.tasks && Array.isArray(lastWorkLog.tasks)) {
        const carried = (lastWorkLog.tasks as WorkTask[])
          .filter(
            (t) =>
              t.task_key !== "DAILY_MEETING" && // 🚫 never carry meeting
              t.status !== "completed"          // ✅ carry paused + in-progress
          )
          .map((t, idx) => ({
            ...t,
            task_id: idx + 2,
            createdAt: new Date().toISOString(),
            time_spent: 0,          // ⬅ reset daily counter
            is_running: false,
            last_started_at: null,
            work_sessions: [],
          }));

        finalTasks.push(...carried);
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
            tasks: finalTasks as any,
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
     GET TODAY WORK LOG + DAILY TASK
  ===================================================== */

    async getToday(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const today = getWorkDateIST();

      /* ================= CHECK ATTENDANCE ================= */
      const attendance = await strapi.entityService.findMany(
        "api::daily-attendance.daily-attendance",
        {
          filters: {
            user: userId,
            Date: today,
            in: { $notNull: true },
          },
          limit: 1,
        }
      );

      const attendanceOut = attendance[0]?.out || null;

      if (!attendance.length) {
        return {
          work_log: {
            id: null,
            tasks: [],
            work_date: today,
            has_attendance: false,
          },
        };
      }

      /* ================= FETCH WORKLOG ================= */
      const workLogs = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters: {
            user: userId,
            work_date: today,
          },
          limit: 1,
          populate: {
            user: {
              fields: ["id", "username", "email"],
              populate: {
                user_detial: {
                  populate: ["Photo"],
                },
              },
            },
          },
        }
      );

      const workLog = workLogs?.[0];

      /* ================= ATTENDANCE EXISTS, WORKLOG NOT YET CREATED ================= */
      if (!workLog) {
        return {
          work_log: {
            id: null,
            tasks: [],
            work_date: today,
            user: {
              id: userId, // 👈 minimal safe user object
            },
            has_attendance: true,
            out: attendanceOut,
          },
        };
      }

      /* ================= NORMAL RETURN ================= */
      return {
        work_log: {
          ...workLog,
          has_attendance: true,
          out: attendanceOut,
        },
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
        task_key: crypto.randomUUID(),
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

      const { userId, username, startDate, endDate } = ctx.query as any;

      const filters: any = {};
      let resolvedUserId = userId;

      // 🔍 HR: resolve username → userId
      if (["Hr", "Management"].includes(authUser.user_type) && username && !userId) {
        const users = (await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          {
            filters: { username },
            fields: ["id"],
            limit: 1,
          }
        )) as { id: number }[];

        if (!users.length) {
          return ctx.badRequest("User not found with this username");
        }

        resolvedUserId = users[0].id; // ✅ NO RED LINE
      }

      // 🔐 Normal user → only self
      if (!["Hr", "Management"].includes(authUser.user_type)) {
        filters.user = authUser.id;
      }


      // 👩‍💼 HR → resolved user
      if (["Hr", "Management"].includes(authUser.user_type) && resolvedUserId) {
        filters.user = resolvedUserId;
      }

      // 📅 Date filter
      if (startDate && endDate) {
        filters.work_date = { $between: [startDate, endDate] };
      } else if (startDate) {
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
              populate: {
                user_detial: {
                  populate: { Photo: true },
                },
              },
            },
          },
        }
      );

      return {
        user: username || resolvedUserId || "ALL",
        startDate,
        endDate,
        count: workLogs.length,
        work_logs: workLogs,
      };
    },

    /* =====================================================
   GET ALL COMPLETED TASKS (ALL WORKLOGS)
===================================================== */
    async completedTasks(ctx: Context) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      // 🔹 Fetch ALL worklogs for this user
      const workLogs = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters: { user: userId },
          sort: { work_date: "desc" },
          populate: {
            tasks: {
              filters: { status: "completed" },
              populate: {
                project: {
                  fields: ["id", "title"],
                },
              },
            },
          } as any,
        }
      );

      // 🔹 Flatten completed tasks safely
      const completedTasks = workLogs.flatMap((wl: any) =>
        Array.isArray(wl.tasks)
          ? wl.tasks.map((t: any) => ({
            ...t,
            work_date: wl.work_date, // 👈 attach date
          }))
          : []
      );

      return completedTasks;
    },


    async taskSummary(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized("Login required");

      const workLogs = await strapi.entityService.findMany(
        "api::work-log.work-log",
        {
          filters: { user: userId },
          sort: { work_date: "asc" },
        }
      );

      const summaryMap = new Map();

      for (const wl of workLogs as any[]) {
        const date = wl.work_date;

        for (const task of wl.tasks || []) {
          if (!summaryMap.has(task.task_key)) {
            summaryMap.set(task.task_key, {
              task_key: task.task_key,
              task_title: task.task_title,
              project: task.project,
              total_time: 0,
              days: [],
            });
          }

          const entry = summaryMap.get(task.task_key);

          entry.total_time += task.time_spent || 0;

          entry.days.push({
            date,
            time_spent: task.time_spent || 0,
          });
        }
      }

      return Array.from(summaryMap.values());
    }


  })
);
