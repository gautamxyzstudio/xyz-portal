"use strict";
/**
 * leave-status controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController("api::leave-status.leave-status", ({ strapi }) => ({
    // -------------------------------
    // GET ALL
    // -------------------------------
    async findAll(ctx) {
        try {
            const data = await strapi.entityService.findMany("api::leave-status.leave-status", {
                populate: { user: true },
                sort: { createdAt: "desc" },
            });
            return {
                message: "All Leave Statuses",
                data,
            };
        }
        catch (error) {
            ctx.throw(500, error);
        }
    },
    // -------------------------------
    // GET BY ID
    // -------------------------------
    async findOne(ctx) {
        try {
            const { id } = ctx.params;
            const data = await strapi.entityService.findOne("api::leave-status.leave-status", id, {
                populate: { user: true },
            });
            if (!data)
                return ctx.notFound("Leave status not found");
            return { message: "Leave Status Details", data };
        }
        catch (error) {
            ctx.throw(500, error);
        }
    },
    // -------------------------------
    // CREATE
    // -------------------------------
    async create(ctx) {
        try {
            const body = ctx.request.body.data;
            const created = await strapi.entityService.create("api::leave-status.leave-status", {
                data: body,
            });
            return {
                message: "Leave Status Created Successfully",
                data: created,
            };
        }
        catch (error) {
            ctx.throw(500, error);
        }
    },
    // -------------------------------
    // DELETE
    // -------------------------------
    async delete(ctx) {
        try {
            const { id } = ctx.params;
            const deleted = await strapi.entityService.delete("api::leave-status.leave-status", id);
            return {
                message: "Leave Status Deleted Successfully",
                deleted,
            };
        }
        catch (error) {
            ctx.throw(500, error);
        }
    },
}));
