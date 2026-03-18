/**
 * notification controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
    'api::notification.notification' as any,
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

        async markAsRead(ctx) {
            try {
                const user = ctx.state.user;
                if (!user) return ctx.unauthorized("Login required");

                const { id } = ctx.params;

                // find notification
                const notification: any = await strapi.entityService.findOne(
                    "api::notification.notification" as any,
                    id,
                    {
                        populate: ["users_permissions_user"],
                    }
                );

                if (!notification) {
                    return ctx.notFound("Notification not found");
                }

                // security check (user should own notification)
                if (
                    notification.users_permissions_user?.id !== user.id
                ) {
                    return ctx.unauthorized("Not your notification");
                }

                // update
                const updated = await strapi.entityService.update(
                    "api::notification.notification" as any,
                    id,
                    {
                        data: {
                            isRead: true,
                        },
                    }
                );

                return ctx.send({
                    message: "Notification marked as read",
                    data: updated,
                });
            } catch (err) {
                return ctx.badRequest(err.message);
            }
        }

    })
);
