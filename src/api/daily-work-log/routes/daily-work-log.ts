export default {
  routes: [
    /**
     * EMPLOYEE: Submit / Update Daily Work Log
     */
    {
      method: "POST",
      path: "/daily-work-logs/upsert",
      handler: "daily-work-log.upsert"
    },

    /**
     * HR: View Daily Logs with Tasks
     */
    {
      method: "GET",
      path: "/daily-work-logs/hr",
      handler: "daily-work-log.hrList"
    }
  ]
};
