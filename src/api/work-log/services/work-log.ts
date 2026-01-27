// // /**
// //  * work-log service
// //  */

// import { factories } from '@strapi/strapi';

// export default factories.createCoreService('api::work-log.work-log');

import { factories } from "@strapi/strapi";

/* ================= IST HELPERS ================= */
const getISTDate = () => {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default factories.createCoreService(
  "api::work-log.work-log",
  ({ strapi }) => ({
    /* =====================================================
       ✅ CREATE TODAY WORKLOG (SAFE, IDPOTENT)
       Called ONLY from check-in
    ===================================================== */
    async createTodayForUser(userId: number) {
      const today = getISTDate();

      // 🔒 Prevent duplicate
      const existing = await strapi.db.query("api::work-log.work-log").findOne({
        where: { user: userId, work_date: today },
      });

      if (existing) return existing;

      /* ================= DAILY MEETING ================= */
      const DAILY_MEETING_TASK = () => ({
        task_id: 1,
        task_key: "DAILY_MEETING",
        task_title: "Daily Meeting",
        status: "in-progress",
        project: null,
        createdAt: new Date().toISOString(),
        time_spent: 0,
        is_running: false,
        last_started_at: null,
        work_sessions: [],
      });

      /* ================= CARRY FORWARD ================= */
      const lastWorkLog = await strapi.db
        .query("api::work-log.work-log")
        .findOne({
          where: {
            user: userId,
            work_date: { $ne: today },
          },
          orderBy: { work_date: "desc" },
        });

      let tasks: any[] = [DAILY_MEETING_TASK()];

      if (lastWorkLog?.tasks && Array.isArray(lastWorkLog.tasks)) {
        const carried = lastWorkLog.tasks
          .filter(
            (t) => t.task_key !== "DAILY_MEETING" && t.status !== "completed",
          )
          .map((t, idx) => ({
            ...t,
            task_id: idx + 2,
            createdAt: new Date().toISOString(),
            time_spent: 0,
            is_running: false,
            last_started_at: null,
            work_sessions: [],
          }));

        tasks.push(...carried);
      }

      /* ================= CREATE WORKLOG ================= */
      return await strapi.entityService.create("api::work-log.work-log", {
        data: {
          user: userId,
          work_date: today,
          tasks,
          active_task_id: null,
          total_time_taken: 0,
        },
      });
    },
  }),
);
