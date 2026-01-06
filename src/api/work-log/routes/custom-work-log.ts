export default {
  routes: [
    {
      method: "POST",
      path: "/work-logs/today",
      handler: "work-log.createToday",
      config: {
        auth: {}, 
      },
    },
    {
      method: "POST",
      path: "/work-logs/:id/add-task",
      handler: "work-log.addTask",
      config: { auth: {} },
    },
     {
      method: "PUT",
      path: "/work-logs/:id",
      handler: "work-log.updateWorkLog",
      config: {
        auth: {}, 
      },
    },
  ],

};
