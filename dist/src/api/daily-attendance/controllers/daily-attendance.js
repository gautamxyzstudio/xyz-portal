"use strict";
/**
 * daily-attendance controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::daily-attendance.daily-attendance', ({ strapi }) => ({
    async find(ctx) {
        // Populate emp_detail and its Photo relation
        ctx.query.populate = {
            emp_detail: {
                populate: {
                    Photo: true
                }
            }
        };
        // Call the default core action
        const { data, meta } = await super.find(ctx);
        // Log the result for debugging
        // console.log('find result:', data);
        // Return the response
        return { data, meta };
    },
    async findOne(ctx) {
        // Populate emp_detail and its Photo relation
        ctx.query.populate = {
            emp_detail: {
                populate: {
                    Photo: true
                }
            }
        };
        // Call the default core action
        const { data, meta } = await super.findOne(ctx);
        return { data, meta };
    },
}));
