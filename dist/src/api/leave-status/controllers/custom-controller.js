const { createCoreController } = require('@strapi/strapi').factories;
const moduleUid = 'api::leave-status.leave-status';
// Helper function to calculate leave days
function calculateLeaveDays(startDate, endDate, leaveType, isFirstHalf = false) {
    if (!startDate || !endDate)
        return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Calculate business days (excluding weekends)
    let businessDays = 0;
    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // 0 = Sunday, 6 = Saturday
            businessDays++;
        }
        current.setDate(current.getDate() + 1);
    }
    // Adjust based on leave type
    switch (leaveType) {
        case 'short_leave':
            return 0.25; // 2 hours = 0.25 days
        case 'half_day':
            return 0.5;
        case 'full_day':
            return businessDays;
        default:
            return businessDays;
    }
}
module.exports = createCoreController(moduleUid, ({ strapi }) => ({
    // Approve leave request
    async approve(ctx) {
        try {
            const { id } = ctx.params;
            // 1. Get leave request
            const leaveRequest = await strapi.entityService.findOne('api::leave-status.leave-status', id, { populate: ['user'] });
            if (!leaveRequest) {
                return ctx.notFound('Leave request not found');
            }
            const user = leaveRequest.user;
            if (!user) {
                return ctx.badRequest('Leave request has no associated user');
            }
            // 2. Update leave status to approved
            const updatedLeave = await strapi.entityService.update('api::leave-status.leave-status', id, { data: { status: 'approved' } });
            // 3. Calculate number of leave days
            const leaveDays = calculateLeaveDays(leaveRequest.start_date, leaveRequest.end_date, leaveRequest.is_first_half);
            console.log('Debug - Calculated leave days:', leaveDays);
            // 4. Update user balances based on leave type
            const userId = user.id;
            const currentUser = await strapi.entityService.findOne('plugin::users-permissions.user', userId, { fields: ['leave_balance', 'unpaid_leave_balance'] });
            let newBalance = currentUser.leave_balance || 0;
            let newUnpaidBalance = currentUser.unpaid_leave_balance || 0;
            if (leaveRequest.leave_type === 'Casual') {
                newBalance = Math.max(0, newBalance - leaveDays);
            }
            else if (leaveRequest.leave_type === 'UnPaid') {
                newUnpaidBalance += leaveDays;
            }
            else {
                console.log('Debug - Leave type not affecting balance:', leaveRequest.leave_type);
            }
            // 5. Update user record
            await strapi.entityService.update('plugin::users-permissions.user', userId, {
                data: {
                    leave_balance: newBalance,
                    unpaid_leave_balance: newUnpaidBalance,
                },
            });
            return ctx.send({
                message: 'Leave request approved successfully',
                data: updatedLeave,
                leaveDaysDeducted: leaveDays,
                leaveType: leaveRequest.leave_type,
            });
        }
        catch (error) {
            console.error('❌ Error in approve function:', error);
            return ctx.badRequest('Error approving leave request', {
                error: error.message,
            });
        }
    },
    // Reject leave request
    async reject(ctx) {
        try {
            const { id } = ctx.params;
            const { decline_reason } = ctx.request.body;
            // Find the leave request
            const leaveRequest = await strapi.entityService.findOne('api::leave-status.leave-status', id, {
                populate: ['user'],
            });
            if (!leaveRequest) {
                return ctx.notFound('Leave request not found');
            }
            // Update the status to declined with reason (if provided)
            const updateData = {
                status: 'declined',
            };
            if (decline_reason) {
                updateData.decline_reason = decline_reason;
            }
            const updatedLeave = await strapi.entityService.update('api::leave-status.leave-status', id, {
                data: updateData,
            });
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
    // Get all leave requests with pagination, filtering, and search
    async all(ctx) {
        const { page = 1, pageSize = 10, startDate, endDate, search, leave_type, } = ctx.query;
        // Build filters object
        const filters = {};
        // Add leave type filter if provided
        if (leave_type) {
            filters.leave_type = leave_type;
        }
        // Add date range filter if startDate and/or endDate are provided
        if (startDate || endDate) {
            filters.$or = [
                {
                    start_date: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
                {
                    end_date: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
            ];
        }
        // Build populate object with search functionality
        const populate = {
            user: {
                populate: {
                    user_detial: {
                        populate: {
                            Photo: true,
                        },
                    },
                },
            },
        };
        // Add search filter if search term is provided
        if (search) {
            filters.$or = [
                ...(filters.$or || []),
                {
                    user: {
                        user_detial: {
                            empCode: {
                                $containsi: search,
                            },
                        },
                    },
                },
                {
                    user: {
                        user_detial: {
                            firstName: {
                                $containsi: search,
                            },
                        },
                    },
                },
                {
                    user: {
                        user_detial: {
                            lastName: {
                                $containsi: search,
                            },
                        },
                    },
                },
                {
                    user: {
                        username: {
                            $containsi: search,
                        },
                    },
                },
                {
                    title: {
                        $containsi: search,
                    },
                },
                {
                    description: {
                        $containsi: search,
                    },
                },
            ];
        }
        const leaveRequests = await strapi.entityService.findMany('api::leave-status.leave-status', {
            filters,
            start: (page - 1) * pageSize,
            limit: pageSize,
            populate,
            sort: { createdAt: 'desc' },
        });
        const total = await strapi.entityService.count('api::leave-status.leave-status', {
            filters,
        });
        ctx.body = {
            data: leaveRequests,
            meta: {
                pagination: {
                    page: Number(page),
                    pageSize: Number(pageSize),
                    pageCount: Math.ceil(total / pageSize),
                    total,
                },
            },
        };
        return ctx.body;
    },
}));
