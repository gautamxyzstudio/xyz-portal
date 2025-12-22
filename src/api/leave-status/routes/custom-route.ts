

export default {
  routes: [
    {
      method: "POST",
      path: "/leave-status/:id/approve",
      handler: "custom-controller.approve",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/leave-status/:id/reject",
      handler: "custom-controller.reject",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/leave-statuses",
      handler: "custom-controller.create",
    },

    {
      method: "GET",
      path: "/leave-statuses/all",
      handler: "custom-controller.findAll",
      config: {
        auth: {
          scope: ["api::leave-status.leave-status"],
        },
      },
    },
  ],
};
