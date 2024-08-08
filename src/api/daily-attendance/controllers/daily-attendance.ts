/**
 * daily-attendance controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::daily-attendance.daily-attendance', ({ strapi }) => ({
  async find(ctx) {
    ctx.query.populate = {
      ...ctx.query.populate,
      emp_details: {
        populate: {
          Photo: true
        }
      }
    };

    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  async findOne(ctx) {
    ctx.query.populate = {
      ...ctx.query.populate,
      emp_details: {
        populate: {
          Photo: true
        }
      }
    };

    const data = await super.findOne(ctx);
    return { data };
  },
}));
