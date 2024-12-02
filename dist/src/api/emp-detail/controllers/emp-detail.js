'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * emp-detail controller
 */
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::emp-detail.emp-detail', ({ strapi }) => ({
    async find(ctx) {
        ctx.query.populate = {
            Photo: true,
            leave_status: true,
            daily_attendances: true, // Populate the one-to-many daily_attendances relation
        };
        const { data, meta } = await super.find(ctx);
        return { data, meta };
    },
    async findOne(ctx) {
        ctx.query.populate = {
            Photo: true,
            leave_status: true,
            daily_attendances: true, // Populate the one-to-many daily_attendances relation
        };
        const { data, meta } = await super.findOne(ctx);
        return { data, meta };
    },
}));
