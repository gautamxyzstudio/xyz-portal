

export default {
  async afterCreate(event) {
    const { result } = event;

    // Safety check
    if (!result || !result.id) return;

    const userId = result.id;
    const username = result.username || 'New Employee';
    const year = new Date().getFullYear();

    /* ==============================
       1️⃣ CREATE LEAVE BALANCE
    ============================== */

    const existing = await strapi.entityService.findMany(
      'api::leave-balance.leave-balance',
      {
        filters: {
          user: userId,
          year,
        },
        limit: 1,
      }
    );

    if (existing.length === 0) {
      await strapi.entityService.create(
        'api::leave-balance.leave-balance',
        {
          data: {
            user: userId,
            year,
            sl_balance: 4,
            el_balance: 4,
            cl_balance: 4,
            unpaid_balance: 0,
            publishedAt: new Date(), // required
          },
        }
      );
    }

  },

};
