export default {
  routes: [
    {
      method: "GET",
      path: "/daily-tasks/by-date",
      handler: "daily-task.byDate",
      config: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
  ],
};
