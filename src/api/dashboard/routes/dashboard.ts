export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/stats",
      handler: "dashboard.stats",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/dashboard/stats/present",
      handler: "dashboard.present",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/dashboard/stats/absent",
      handler: "dashboard.absent",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/dashboard/stats/leave",
      handler: "dashboard.leave",
      config: {
        auth: {},
      },
    },
  ],
};
