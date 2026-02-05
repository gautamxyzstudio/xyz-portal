import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::leave-balance.leave-balance',
  ({ strapi }) => ({

    // =====================================
    // 👤 Logged-in user → own balance only
    // =====================================
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
          publicationState: 'live',
          limit: 1,
        }
      );

      let balance = balances[0];

      // Auto-create yearly balance for THIS user
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
              unpaid_balance: 0,
              publishedAt: new Date(), // ✅ required
            },
          }
        );
      }

      return {
        year: balance.year,
        el_balance: balance.el_balance,
        cl_balance: balance.cl_balance,
        sl_balance: balance.sl_balance,
        unpaid_balance: balance.unpaid_balance,
      };
    },

    // =====================================
    // 👨‍💼 Admin / HR → all users balances
    // =====================================

    async allBalances(ctx) {
      const year =
        ctx.query.year ? Number(ctx.query.year) : new Date().getFullYear();

      const balances = await strapi.entityService.findMany(
        'api::leave-balance.leave-balance',
        {
          filters: { year },
          populate: ['user'],
          publicationState: 'live',
          sort: { createdAt: 'asc' },
        } as any
      );

      return (balances as any[]).map((balance) => ({
        user: {
          id: balance.user?.id,
          username: balance.user?.username,
          email: balance.user?.email,
        },
        year: balance.year,
        el_balance: balance.el_balance,
        cl_balance: balance.cl_balance,
        sl_balance: balance.sl_balance,
        unpaid_balance: balance.unpaid_balance,
      }));
    }


  })
);


