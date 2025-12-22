"use strict";
//  * leave-status controller
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::leave-status.leave-status', ({ strapi }) => ({
    // Approve leave request
    async approve(ctx) {
        var _a;
        try {
            const { id } = ctx.params;
            // Find the leave request
            const leaveRequest = await strapi.entityService.findOne('api::leave-status.leave-status', id, { populate: ['user'] });
            if (!leaveRequest) {
                return ctx.notFound('Leave request not found');
            }
            // Update the status to approved
            const updatedLeave = await strapi.entityService.update('api::leave-status.leave-status', id, { data: { status: 'approved' } });
            // Send email to the employee
            if ((_a = leaveRequest.user) === null || _a === void 0 ? void 0 : _a.email) {
                await strapi.plugin('email').service('email').send({
                    to: leaveRequest.user.email,
                    subject: 'Your leave request has been approved',
                    text: `Your leave "${leaveRequest.title}" has been approved.`,
                    html: `<p>Your leave "<strong>${leaveRequest.title}</strong>" has been approved.</p>`,
                });
            }
            return ctx.send({
                message: 'Leave request approved successfully',
                data: updatedLeave,
            });
        }
        catch (error) {
            return ctx.badRequest('Error approving leave request', {
                error: error.message,
            });
        }
    },
    // Reject leave request
    async reject(ctx) {
        var _a;
        try {
            const { id } = ctx.params;
            const { decline_reason } = ctx.request.body;
            if (!decline_reason) {
                return ctx.badRequest('Decline reason is required');
            }
            // Find the leave request
            const leaveRequest = await strapi.entityService.findOne('api::leave-status.leave-status', id, { populate: ['user'] });
            if (!leaveRequest) {
                return ctx.notFound('Leave request not found');
            }
            // Update the status to declined with reason
            const updatedLeave = await strapi.entityService.update('api::leave-status.leave-status', id, { data: { status: 'declined', decline_reason } });
            // Send email to the employee
            if ((_a = leaveRequest.user) === null || _a === void 0 ? void 0 : _a.email) {
                await strapi.plugin('email').service('email').send({
                    to: leaveRequest.user.email,
                    subject: 'Your leave request has been declined',
                    text: `Your leave "${leaveRequest.title}" has been declined. Reason: ${decline_reason}`,
                    html: `<p>Your leave "<strong>${leaveRequest.title}</strong>" has been declined.<br/>Reason: ${decline_reason}</p>`,
                });
            }
            return ctx.send({
                message: 'Leave request rejected successfully',
                data: updatedLeave,
            });
        }
        catch (error) {
            return ctx.badRequest('Error rejecting leave request', {
                error: error.message,
            });
        }
    },
}));
