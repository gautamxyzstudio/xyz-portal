export default {
  routes: [
    {
      method: "GET",
      path: "/notifications/my",
      handler: "notification.myNotifications",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/notifications/:id/read",
      handler: "notification.markAsRead",
      config: {
        auth: {},
      },
    }
  ],
};