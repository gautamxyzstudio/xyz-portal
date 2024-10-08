/**
 * daily-attendance controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::daily-attendance.daily-attendance', ({ strapi }) => ({
  async find(ctx) {
    ctx.query.populate = {
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
      emp_details: {
        populate: {
          Photo: true
        }
      }
    };

    const { data, meta } = await super.findOne(ctx);
    return { data, meta };
  },

  async create(ctx) {
    const response = await super.create(ctx);
    const entity = await strapi.entityService.findOne(
      'api::daily-attendance.daily-attendance',
      response.data.id,
      { populate: { emp_details: { populate: { Photo: true } } } }
    );
    return { data: entity };
  },

  async update(ctx) {
    const response = await super.update(ctx);
    const entity = await strapi.entityService.findOne(
      'api::daily-attendance.daily-attendance',
      response.data.id,
      { populate: { emp_details: { populate: { Photo: true } } } }
    );
    return { data: entity };
  }
}));
