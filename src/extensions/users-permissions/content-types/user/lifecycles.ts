export default {
  async afterCreate(event) {
    const { result } = event;

    // Safety check
    if (!result || !result.id) return;

    const userId = result.id;
    const year = new Date().getFullYear();

    // Check if balance already exists (extra safety)
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

    if (existing.length > 0) {
      return;
    }

    // Create leave balance for this user
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
          publishedAt: new Date(), // ✅ required for draft & publish
        },
      }
    );
  },
};
