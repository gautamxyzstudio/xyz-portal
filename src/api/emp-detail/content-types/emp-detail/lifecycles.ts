export default {
  async afterUpdate(event: any) {
    console.log("🔥 LIFECYCLE TRIGGERED", event.params.data);

    const { result, params } = event;

    // Detect status change
    const statusChanged = params.data?.status !== undefined;

    if (!statusChanged) return;

    try {
      /* ==============================
         1️⃣ GET EMP WITH USER
      ============================== */
      const emp = await strapi.entityService.findOne(
        'api::emp-detail.emp-detail',
        result.id,
        {
          populate: ['user_detail'],
        }
      );

      const userId = (emp as any)?.user_detail?.id;

      if (!userId) {
        console.log("❌ No user found");
        return;
      }

      const isActive = params.data.status === true;

      /* ==============================
         2️⃣ SYNC BLOCK STATUS
      ============================== */
      await strapi.entityService.update(
        'plugin::users-permissions.user',
        userId,
        {
          data: {
            blocked: !isActive, // 🔥 main logic
          },
        }
      );

      console.log(
        isActive
          ? `✅ User unblocked: ${userId}`
          : `🚫 User blocked: ${userId}`
      );

      /* ==============================
         3️⃣ IF INACTIVE → REMOVE FROM PROJECTS
      ============================== */
      if (!isActive) {
        const projects = await strapi.entityService.findMany(
          'api::project.project',
          {
            filters: {
              users_permissions_users: userId,
            },
            populate: ['users_permissions_users'],
          }
        );

        for (const project of projects) {
          const users = (project as any).users_permissions_users || [];

          const updatedUsers = users
            .filter((u: any) => u.id !== userId)
            .map((u: any) => u.id);

          await strapi.entityService.update(
            'api::project.project',
            project.id,
            {
              data: {
                users_permissions_users: updatedUsers,
              },
            }
          );
        }

        console.log("✅ User removed from all projects");
      }
    } catch (err) {
      console.error("❌ Lifecycle error:", err);
    }
  },
};