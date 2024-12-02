'use strict';

/**
 * emp-detail controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::emp-detail.emp-detail', ({ strapi }) => ({
  async find(ctx) {
    ctx.query.populate = {
      Photo: true, // Populate the Photo media field
      leave_status: true, // Populate the one-to-one leave_status relation
      daily_attendances: true, // Populate the one-to-many daily_attendances relation
    };

    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  async findOne(ctx) {
    ctx.query.populate = {
      Photo: true, // Populate the Photo media field
      leave_status: true, // Populate the one-to-one leave_status relation
      daily_attendances: true, // Populate the one-to-many daily_attendances relation
    };

    const { data, meta } = await super.findOne(ctx);
    return { data, meta };
  },
}));
