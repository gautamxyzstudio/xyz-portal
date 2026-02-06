/**
 * asset service
 */

"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::asset.asset", ({ strapi }) => ({
  async update(entityId, params) {
    const data = params.data || {};

    const isAssigned =
      data.AssignedTo &&
      (
        data.AssignedTo.connect ||
        (Array.isArray(data.AssignedTo.set) &&
          data.AssignedTo.set.length > 0)
      );

    const isUnassigned =
      data.AssignedTo === null ||
      data.AssignedTo.disconnect ||
      (Array.isArray(data.AssignedTo?.set) &&
        data.AssignedTo.set.length === 0);

    if (isAssigned) {
      data.Available = false;
    }

    if (isUnassigned) {
      data.Available = true;
    }

    return await super.update(entityId, {
      ...params,
      data,
    });
  },
}));

