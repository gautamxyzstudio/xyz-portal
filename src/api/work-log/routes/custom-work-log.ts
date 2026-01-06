export default {
  routes: [
    {
      method: "POST",
      path: "/work-logs/today",
      handler: "work-log.createToday",
      config: {
        auth: {}, // ✅ REQUIRED FORMAT
      },
    },
  ],

};
