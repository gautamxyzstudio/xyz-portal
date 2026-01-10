export default {
  async find(ctx) {
    const { user_type } = ctx.params;
    let filters = {};

    filters = {
      user_type: {
        $ne: 'Admin',
      },
    };

    const user = await strapi.entityService.findMany(
      'plugin::users-permissions.user',
      {
        filters: filters,
        populate: {
          role: true,
          user_detial: {
            populate: {
              Photo: true,
              coverImage:true
            },
          },
        },
      }
    );
    ctx.body = user;
  },
  async updateLeaveBalance(ctx) {
    const { id } = ctx.params;
    const { leave_balance, unpaid_leave_balance } = ctx.request.body;

    await strapi.entityService.update('plugin::users-permissions.user', id, {
    });
    ctx.body = {
      message: 'Leave balance updated successfully',
      leave_balance,
      unpaid_leave_balance,
    };
  },
  async getLeaveBalance(ctx) {
    const { id } = ctx.params;

    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      id
    );
  },
  async findSingleUser(ctx) {
    const { id } = ctx.params; // get authenticated user's id from token

    if (!id) {
      return ctx.unauthorized("You're not authenticated");
    }

    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      id,
      {
        populate: {
          role: true,
          user_detial: {
            populate: {
              Photo: true,
              coverImage:true
            },
          },
        },
      }
    );

    if (!user) {
      return ctx.notFound('User not found');
    }

    delete user.password;
    delete user.resetPasswordToken;
    delete user.confirmationToken;

    return user;
  },
};
