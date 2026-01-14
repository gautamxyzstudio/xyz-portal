export default {
  routes: [
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
      handler: "custom-controller.hrUpdateAndApproveLeave"
    },
  ],

};
