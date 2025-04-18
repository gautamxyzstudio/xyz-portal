"use strict";
/**
 * daily-attendance controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::daily-attendance.daily-attendance', ({ strapi }) => ({
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
