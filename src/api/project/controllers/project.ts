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
    async myProjects(ctx: any) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Login required");
      }

      /* =====================
         Fetch user's projects
      ====================== */

      const projects = await strapi.entityService.findMany(
        "api::project.project",
        {
          filters: {
            users_permissions_users: {
              id: user.id,
            },
          },
          fields: ["id", "title", "description"],
          populate: {
            logo: true, // ✅ project logo
          },
        }
      );

      /* =====================
         Fetch user info + photo
      ====================== */

      const users = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: { id: user.id },
          fields: ["id", "username"],
          populate: {
            user_detial: {
              populate: {
                Photo: true, // ✅ user photo
              },
            },
          },
          limit: 1,
        }
      );

      const me = users[0] as any;

      return {
        user: {
          id: me.id,
          username: me.username,
          photo: me.user_detial?.Photo || [],
        },
        projects,
      };
    },


    /* =====================================================
       HR → SINGLE USER PROJECTS AND ALL PROJECTS
    ===================================================== */

    async userProjects(ctx: any) {
      const authUser = ctx.state.user;
      const { username } = ctx.query as { username?: string };

      if (!authUser) {
        return ctx.unauthorized("Login required");
      }

      if (!["Hr", "Management"].includes(authUser.user_type)) {
        return ctx.forbidden("Only HR and Management can access this");
      }

      /* ==================================================
         CASE 1: HR passes username
      =================================================== */

      if (username) {
        const users = await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          {
            filters: { username },
            fields: ["id", "username"],
            populate: {
              user_detial: {
                populate: { Photo: true },
              },
            },
            limit: 1,
          }
        );

        if (!users.length) {
          return ctx.notFound("User not found");
        }

        const user = users[0] as any;

        const projects = await strapi.entityService.findMany(
          "api::project.project",
          {
            filters: {
              users_permissions_users: {
                id: user.id,
              },
            },
            populate: {
              logo: true,
            },
          }
        );

        return {
          user: {
            username: user.username,
            photo:
              user.user_detial?.Photo?.length > 0
                ? user.user_detial.Photo[0]
                : null,
          },
          projects,
        };
      }

      /* ==================================================
         CASE 2: ALL projects + users + ONLY photo
      =================================================== */

      const projects = await strapi.entityService.findMany(
        "api::project.project",
        {
          populate: {
            logo: true,
            users_permissions_users: {
              fields: ["id", "username"],
              populate: {
                user_detial: {
                  populate: { Photo: true },
                },
              },
            },
          },
        }
      );

      // 🔥 THIS IS THE IMPORTANT FIX
      const fixedProjects = projects.map((project: any) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        publishedAt: project.publishedAt,
        logo: project.logo,

        users_permissions_users: project.users_permissions_users.map((u: any) => ({
          id: u.id,
          username: u.username,
          photo:
            u.user_detial?.Photo?.length > 0
              ? u.user_detial.Photo[0]
              : null,
        })),
      }));

      return {
        projects: fixedProjects,
      };
    }


  })
);

