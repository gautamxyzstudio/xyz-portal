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
  ],
};