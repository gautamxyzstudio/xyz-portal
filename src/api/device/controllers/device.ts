import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::device.device',
  ({ strapi }) => ({

    // ✅ CREATE
    async create(ctx) {
      return await super.create(ctx);
    },

    // ✅ FIND ALL
    async find(ctx) {
      return await super.find(ctx);
    },

    // ✅ FIND BY ID
    async findOne(ctx) {
      const { id } = ctx.params;

      const device = await strapi.entityService.findOne(
        'api::device.device',
        id
      );

      if (!device) {
        return ctx.notFound('Device not found');
      }

      return device;
    },

    // ✅ UPDATE
    async update(ctx) {
      const { id } = ctx.params;

      const device = await strapi.entityService.findOne(
        'api::device.device',
        id
      );

      if (!device) {
        return ctx.notFound('Device not found');
      }

      return await super.update(ctx);
    },

    // ✅ DELETE (SAFE DELETE)
    async delete(ctx) {
      const { id } = ctx.params;

      const device = await strapi.entityService.findOne(
        'api::device.device',
        id
      );

      if (!device) {
        return ctx.notFound('Device not found');
      }

      if (device.status === 'assigned') {
        return ctx.badRequest('Assigned device cannot be deleted');
      }

      return await super.delete(ctx);
    },

    // 🔥 ASSIGN DEVICE
    async assignDevice(ctx) {
      const { id } = ctx.params;
      const { userId } = ctx.request.body;

      if (!userId) {
        return ctx.badRequest('userId is required');
      }

      const device = await strapi.entityService.findOne(
        'api::device.device',
        id
      );

      if (!device) {
        return ctx.notFound('Device not found');
      }

      const updatedDevice = await strapi.entityService.update(
        'api::device.device',
        id,
        {
          data: {
            assigned_to: userId,
            status: 'assigned',
            assigned_date: new Date(),
          },
        }
      );

      return {
        message: 'Device assigned successfully',
        data: updatedDevice,
      };
    },

    // 👤 MY DEVICES
    async myDevices(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized();
      }

      return await strapi.entityService.findMany(
        'api::device.device',
        {
          filters: {
            assigned_to: user.id,
          },
        }
      );
    },
  })
);
