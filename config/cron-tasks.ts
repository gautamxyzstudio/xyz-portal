module.exports = {
  // 🕕 Daily attendance creation - 6:00 AM every day
  createDailyAttendance: {
    task: async ({ strapi }) => {
      try {
        strapi.log.info('🕕 Starting daily attendance entries creation...');
        const result = await strapi
          .service('api::daily-attendance.daily-attendance')
          .createDailyAttendanceEntries();

        if (result.success) {
          strapi.log.info(
            `✅ Daily attendance entries created for ${result.totalUsers} users`
          );
          strapi.log.info(
            `📊 Created: ${result.createdEntries.length}, Errors: ${result.errors.length}`
          );
        } else {
          strapi.log.error('❌ Failed to create entries:', result.error);
        }

        return result;
      } catch (error) {
        strapi.log.error(
          '❌ Error in createDailyAttendanceEntries cron:',
          error
        );
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '0 6 * * *',
      tz: 'Asia/Kolkata',
    },
  },

  // 🚨 TEST - Every 1 minute
  testEveryMinute: {
    task: async ({ strapi }) => {
      strapi.log.info('🚨 TEST CRON: Running every minute...');
    },
    options: {
      rule: '*/1 * * * *',
      tz: 'Asia/Kolkata',
    },
  },

  // 🕙 Mark absent users - 10:00 PM every day
  markAbsentUsers: {
    task: async ({ strapi }) => {
      try {
        strapi.log.info('🕙 Starting end-of-day attendance processing...');
        const result = await strapi
          .service('api::daily-attendance.daily-attendance')
          .markAbsentUsers();

        if (result.success) {
          strapi.log.info(`✅ Marked absent: ${result.totalAbsent} users`);
        } else {
          strapi.log.error('❌ Failed to mark absent users:', result.error);
        }

        return result;
      } catch (error) {
        strapi.log.error('❌ Error in markAbsentUsers cron:', error);
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '0 22 * * *',
      tz: 'Asia/Kolkata',
    },
  },

  // 📅 Weekly report - Every Monday at 7:00 AM
  weeklyAttendanceReport: {
    task: async ({ strapi }) => {
      try {
        strapi.log.info('📅 Generating weekly attendance report...');

        const now = new Date();
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - 7);
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - 1);

        const startDate = lastWeekStart.toISOString().split('T')[0];
        const endDate = lastWeekEnd.toISOString().split('T')[0];

        const result = await strapi
          .service('api::daily-attendance.daily-attendance')
          .getAttendanceStats(startDate, endDate);

        if (result.success) {
          strapi.log.info(`📊 Weekly report for ${startDate} to ${endDate}`);
          strapi.log.info(
            `📈 Present: ${result.stats.present}, Absent: ${result.stats.absent}, Late: ${result.stats.late}`
          );
        } else {
          strapi.log.error(
            '❌ Failed to generate weekly report:',
            result.error
          );
        }

        return result;
      } catch (error) {
        strapi.log.error('❌ Error in getAttendanceStats cron:', error);
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '0 7 * * 1',
      tz: 'Asia/Kolkata',
    },
  },
};
