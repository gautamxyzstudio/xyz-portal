/**
 * notification controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::notification.notification'as any,
  ({ strapi }) => ({
    
    // ✅ custom API
    async myNotifications(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Login required");
      }

      const notifications = await strapi.entityService.findMany(
        "api::notification.notification" as any,
        {
          filters: {
            users_permissions_user: user.id,
            publishedAt: { $notNull: true },
          },
          sort: { createdAt: "desc" },
        }
      );

      return ctx.send(notifications);
    },

  })
);
