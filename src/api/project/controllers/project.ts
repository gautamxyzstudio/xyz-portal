/**
 * project controller
 */

/**
 * project controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::project.project",
  ({ strapi }) => ({

    /* =====================================================
       EMPLOYEE → OWN PROJECTS
    ===================================================== */
    async myProjects(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Login required");
      }

      const projects = await strapi.entityService.findMany(
        "api::project.project",
        {
          filters: {
            users_permissions_users: {
              id: user.id,
            },
          },
          fields: ["id", "title"],
        }
      );

      return projects;
    },

    /* =====================================================
       HR → SINGLE USER PROJECTS
    ===================================================== */
    async userProjects(ctx) {
      const authUser = ctx.state.user;
      const { userId } = ctx.params;

      if (!authUser) {
        return ctx.unauthorized("Login required");
      }

      // ✅ Only HR allowed
      if (authUser.user_type !== "Hr") {
        return ctx.forbidden("Only HR can access this");
      }

      const projects = await strapi.entityService.findMany(
        "api::project.project",
        {
          filters: {
            users_permissions_users: {
              id: Number(userId),
            },
          },
          fields: ["id", "title"],
        }
      );

      return projects;
    },

  })
);

