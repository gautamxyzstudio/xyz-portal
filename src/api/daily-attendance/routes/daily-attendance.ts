module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/daily-attendance/all',
      handler: 'daily-attendance.findAll',
    },
    {
      method: 'GET',
      path: '/daily-attendance/:id',
      handler: 'daily-attendance.find',
    },
    {
      method: 'GET',
      path: '/daily-attendance/today/:id',
      handler: 'daily-attendance.findToday',
    },
    {
      method: 'POST',
      path: '/daily-attendance/check-in',
      handler: 'daily-attendance.checkIn',
    },
    {
      method: 'POST',
      path: '/daily-attendance/check-out',
      handler: 'daily-attendance.checkOut',
    },
    {
      method: 'PUT',
      path: '/daily-attendance/update-attendance',
      handler: 'daily-attendance.updateAttendance',
    },
    // Cron job routes
    {
      method: 'POST',
      path: '/daily-attendance/cron/create-daily-entries',
      handler: 'daily-attendance.createDailyEntries',
    },
    {
      method: 'POST',
      path: '/daily-attendance/cron/mark-absent-users',
      handler: 'daily-attendance.markAbsentUsers',
    },
    {
      method: 'GET',
      path: '/daily-attendance/stats',
      handler: 'daily-attendance.getAttendanceStats',
    },
    // Manual trigger routes for testing
    {
      method: 'POST',
      path: '/daily-attendance/cron/trigger-daily',
      handler: 'daily-attendance.triggerDailyCron',
    },
    {
      method: 'POST',
      path: '/daily-attendance/cron/trigger-end-of-day',
      handler: 'daily-attendance.triggerEndOfDayCron',
    },
  ],
};
