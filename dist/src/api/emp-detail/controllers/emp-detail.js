"use strict";
/**
 * emp-detail controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::emp-detail.emp-detail', ({ strapi }) => ({
    async find(ctx) {
        // Populate Photo and daily_attendances relations
        ctx.query.populate = {
            Photo: true,
            daily_attendances: true,
        };
        // Call the default core action
        const { data, meta } = await super.find(ctx);
        // Log the result for debugging
        console.log('find result:', data);
        // Check if daily_attendances is populated
        data.forEach(entry => {
            if (!entry.daily_attendances) {
                console.warn('daily_attendances not populated for entry:', entry.id);
            }
        });
        // Return the response
        return { data, meta };
    },
    async findOne(ctx) {
        // Populate Photo and daily_attendances relations
        ctx.query.populate = {
            Photo: true,
            daily_attendances: true,
        };
        // Call the default core action
        const { data, meta } = await super.findOne(ctx);
        // Log the result for debugging
        console.log('findOne result:', data);
        // Check if daily_attendances is populated
        if (!data.daily_attendances) {
            console.warn('daily_attendances not populated for entry:', data.id);
        }
        // Return the response
        return { data, meta };
    },
}));
