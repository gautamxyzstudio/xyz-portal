export default {
  routes: [
    {
      method: "POST",
      path: "/work-logs/today",
      handler: "work-log.createToday",
      config: { auth: {} }
    },
    {
      method: "GET",
      path: "/work-logs/today",
      handler: "work-log.getToday",
      config: { auth: {} }
    },
    {
      method: "POST",
      path: "/work-logs/:id/add-task",
      handler: "work-log.addTask",
      config: { auth: {} }
    },
    {
      method: "PUT",
      path: "/work-logs/:id/update-task",
      handler: "work-log.updateTask",
      config: { auth: {} }
    },
    {
      method: "POST",
      path: "/work-logs/start-timer",
      handler: "work-log.startTaskTimer",
      config: { auth: {} }
    },
    {
      method: "POST",
      path: "/work-logs/stop-timer",
      handler: "work-log.stopTaskTimer",
      config: { auth: {} }
    },
    {
      method: "GET",
      path: "/work-logs/userWorkLogs",
      handler: "work-log.userWorkLogs",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/work-logs/completed",
      handler: "work-log.completedTasks",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/work-logs/task-summary",
      handler: "work-log.taskSummary",
      config: {
        auth: {}
      },
    },
  ]
};
