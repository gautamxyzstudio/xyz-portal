export default {
  routes: [
    // {
    //   method: "POST",
    //   path: "/leave-statuses/:id/approve",
    //   handler: "custom-controller.approve",
    //   config: {
    //     auth: false,
    //   },
    // },
    // {
    //   method: "POST",
    //   path: "/leave-statuses/:id/reject",
    //   handler: "custom-controller.reject",
    //   config: {
    //     auth: false,
    //   },
    // },
    {
      method: "POST",
      path: "/leave-statuses",
      handler: "custom-controller.create",
    },

    {
      method: "GET",
      path: "/leave-statuses/my-leaves",
      handler: "custom-controller.findUserAllLeaves",
    },

    {
      method: "PUT",
      path: "/leave-statuses/:id/hr-update-and-approve-leave",
      handler: "custom-controller.hrUpdateAndApproveLeave",
    }
  ],
};
