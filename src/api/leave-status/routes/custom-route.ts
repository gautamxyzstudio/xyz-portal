// module.exports = {
//   routes: [
//     {
//       method: 'POST',
//       path: '/leave-status/:id/approve',
//       handler: 'custom-controller.approve',
//     },
//     {
//       method: 'POST',
//       path: '/leave-status/:id/reject',
//       handler: 'custom-controller.reject',
//     },
//     {
//       method: 'GET',
//       path: '/leave-status/all',
//       handler: 'custom-controller.all',
//     },

//   ],
// };

// "use strict";

// module.exports = {
//   routes: [
//     {
//       method: "POST",
//       path: "/leave-status/:id/approve",
//       handler: "custom-controller.approve",
//       config: {
//         auth: false,
//       },
//     },
//     {
//       method: "POST",
//       path: "/leave-status/:id/reject",
//       handler: "custom-controller.reject",
//       config: {
//         auth: false,
//       },
//     },
//     {
//       method: "GET",
//       path: "/leave-status/all",
//       handler: "custom-controller.all",
//       config: {
//         auth: false,
//       },
//     },
//   ],
// };

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
    // {
    //   method: "POST",
    //   path: "/leave-status/send",
    //   handler: "custom-controller.send",
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
