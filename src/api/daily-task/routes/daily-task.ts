export default {
  routes: [

    /**
     * EMPLOYEE
     */
    {
      method: "POST",
      path: "/daily-tasks",
      handler: "daily-task.createTask"
    },
    {
      method: "PUT",
      path: "/daily-tasks/:id",
      handler: "daily-task.updateTask"
    },
    {
      method: "DELETE",
      path: "/daily-tasks/:id",
      handler: "daily-task.deleteTask"
    },

    /**
     * HR
     */
    {
      method: "GET",
      path: "/daily-tasks/hr",
      handler: "daily-task.hrList"
    },
    {
      method: "GET",
      path: "/charts/task-status",
      handler: "daily-task.statusStats"
    }
  ]
};
