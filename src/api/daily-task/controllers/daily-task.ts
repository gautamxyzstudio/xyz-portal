import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::daily-task.daily-task",
  ({ strapi }) => ({

    /**
     * EMPLOYEE: Create single task
     */
    async createTask(ctx) {
      const {
        daily_work_log,
        task_name,
        estimated_minutes = 0,
        actual_minutes = 0,
        task_status = "pending"
      } = ctx.request.body;

      if (!daily_work_log || !task_name) {
        return ctx.badRequest("daily_work_log and task_name are required");
      }

      const task = await strapi.entityService.create(
        "api::daily-task.daily-task",
        {
          data: {
            daily_work_log,
            task_name,
            estimated_minutes,
            actual_minutes,
            task_status
          }
        }
      );

      ctx.body = task;
    },

    /**
     * EMPLOYEE: Update task
     */
    async updateTask(ctx) {
      const { id } = ctx.params;
      const data = ctx.request.body;

      const task = await strapi.entityService.update(
        "api::daily-task.daily-task",
        id,
        { data }
      );

      ctx.body = task;
    },

    /**
     * EMPLOYEE: Delete task
     */
    async deleteTask(ctx) {
      const { id } = ctx.params;

      await strapi.entityService.delete(
        "api::daily-task.daily-task",
        id
      );

      ctx.body = { success: true };
    },

    /**
     * HR: List tasks (filters supported)
     */
    async hrList(ctx) {
      const { status, start, end, user } = ctx.query;

      const tasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        {
          filters: {
            ...(status && { task_status: status }),
            ...(start && end && {
              daily_work_log: {
                date: { $between: [start, end] },
                ...(user && { user })
              }
            })
          },
          populate: {
            daily_work_log: {
              populate: { user: true }
            }
          },
          sort: { createdAt: "desc" }
        }
      );

      ctx.body = tasks;
    },

    /**
     * HR: Task Status Count (Pie / Donut Chart)
     */
    async statusStats(ctx) {
      const { start, end } = ctx.query;

      const tasks = await strapi.entityService.findMany(
        "api::daily-task.daily-task",
        {
          filters: {
            daily_work_log: {
              date: { $between: [start, end] }
            }
          }
        }
      );

      const stats = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        blocked: 0
      };

      tasks.forEach(task => {
        stats[task.task_status]++;
      });

      ctx.body = stats;
    }
  })
);
