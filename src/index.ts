export default {
  register() {},

  async bootstrap({ strapi }) {

    strapi.db.lifecycles.subscribe({
      models: ["api::emp-detail.emp-detail"],

      async afterUpdate(event) {
        const { result } = event;

        const emp = await strapi.entityService.findOne(
          "api::emp-detail.emp-detail",
          result.id,
          { populate: ["user_detail"] }
        );

        if (!emp?.user_detail?.id) return;

        const userId = emp.user_detail.id;
        const blocked = !emp.status;

        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: {
              blocked: blocked,
            },
          }
        );

        console.log("✅ User blocked updated:", blocked);
      },
    });

  },
};