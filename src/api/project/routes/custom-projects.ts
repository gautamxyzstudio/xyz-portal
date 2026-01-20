export default {
  routes: [
    {
      method: "GET",
      path: "/projects/myProjects",
      handler: "project.myProjects",
      config: { auth: {}},
    },
    {
      method: "GET",
      path: "/projects/user/:userId",
      handler: "project.userProjects",
      config: { auth: {} },
    },
  ],
};
