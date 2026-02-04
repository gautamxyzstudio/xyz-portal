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
      path: "/projects",
      handler: "project.userProjects",
      config: { auth: {} },
    },
  ],
};
