// // /**
// //  * work-log service
// //  */

// import { factories } from '@strapi/strapi';

// export default factories.createCoreService('api::work-log.work-log');

import { factories } from "@strapi/strapi";

/* ================= IST HELPERS ================= */
const getISTDate = () => {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
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

      // 🔒 Prevent duplicate worklog
      const existing = await strapi.db
        .query("api::work-log.work-log")
        .findOne({
          where: { user: userId, work_date: today },
        });

      if (existing) return existing;

      /* 🔒 DAILY TASK (shared by date) */
      let dailyTask = await strapi.db
        .query("api::daily-task.daily-task")
        .findOne({ where: { date: today } });

      if (!dailyTask) {
        dailyTask = await strapi.entityService.create(
          "api::daily-task.daily-task",
          { data: { date: today } }
        );
      }

      /* ✅ CREATE WORKLOG */
      return await strapi.entityService.create(
        "api::work-log.work-log",
        {
          data: {
            user: userId,
            work_date: today,
            daily_task: dailyTask.id,
            tasks: [],
            active_task_id: null,
            total_time_taken: 0,
          },
        }
      );
    },

  })
);
