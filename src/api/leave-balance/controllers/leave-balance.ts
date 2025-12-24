// import { factories } from '@strapi/strapi';

// export default factories.createCoreController(
//   'api::leave-balance.leave-balance' as any
// );



import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::leave-balance.leave-balance' as any,
  ({ strapi }) => ({

    // ===============================
    // Logged-in user's leave balance
    // ===============================
    async myBalance(ctx) {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('Login required');
      }

      const year = new Date().getFullYear();

      const balances = await strapi.entityService.findMany(
        'api::leave-balance.leave-balance',
        {
          filters: {
            user: userId,
            year,
          },
        }
      );

      let balance = balances[0];

      // Auto-create yearly balance
      if (!balance) {
        balance = await strapi.entityService.create(
          'api::leave-balance.leave-balance',
          {
            data: {
              user: userId,
              year,
              el_balance: 4,
              cl_balance: 4,
              sl_balance: 4,
              unpaid_balance: 0, // ✅ correct field name
            },
          }
        );
      }

      return {
        year,
        el_balance: balance.el_balance,
        cl_balance: balance.cl_balance,
        sl_balance: balance.sl_balance,
        unpaid_balance: balance.unpaid_balance,
      };
    },

  })
);
