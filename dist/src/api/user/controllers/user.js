"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    async find(ctx) {
        const { user_type } = ctx.params;
        let filters = {};
        filters = {
            user_type: {
                $ne: 'Admin',
            },
        };
        const user = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: filters,
            populate: {
                role: true,
                user_detial: {
                    populate: {
                        Photo: true,
                    },
                },
            },
        });
        ctx.body = user;
    },
    async findSingleUser(ctx) {
        const { id } = ctx.params; // get authenticated user's id from token
        if (!id) {
            return ctx.unauthorized("You're not authenticated");
        }
        const user = await strapi.entityService.findOne('plugin::users-permissions.user', id, {
            populate: {
                role: true,
                user_detial: {
                    populate: {
                        Photo: true,
                    },
                },
            },
        });
        if (!user) {
            return ctx.notFound('User not found');
        }
        delete user.password;
        delete user.resetPasswordToken;
        delete user.confirmationToken;
        return user;
    },
    // async findSingleUser(ctx) {
    //   try {
    //     const { id } = ctx.state.user;
    //     if (!id) {
    //       return ctx.badRequest('User not authenticated');
    //     }
    //     const user = await strapi.entityService.findOne(
    //       'plugin::users-permissions.user',
    //       id,
    //       {
    //         populate: {
    //           user_details: {
    //             populate: {
    //               Photo: true, // or whatever fields you want to populate inside user_details
    //             },
    //           },
    //         },
    //       }
    //     );
    //     if (!user) {
    //       return ctx.notFound('User not found');
    //     }
    //     ctx.send(user);
    //   } catch (error) {
    //     console.error('Error fetching user:', error);
    //     return ctx.internalServerError('An error occurred while fetching user');
    //   }
    // },
    // async findSingleUser(ctx) {
    //   const { id } = ctx.state.user;
    //   if (!id) {
    //     return ctx.badRequest('User not authenticated');
    //   }
    //   const user = await strapi.entityService.findOne(
    //     'plugin::users-permissions.user',
    //     id,
    //     {
    //       populate: {
    //         user_details: {
    //           populate: {
    //             Photo: true,
    //           },
    //         },
    //       },
    //     }
    //   );
    //   ctx.body = user;
    // },
};
