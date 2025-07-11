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
        var _a;
        try {
            const { id } = ctx.params;
            // Find the leave request
            const leaveRequest = await strapi.entityService.findOne('api::leave-status.leave-status', id, {
                populate: ['user'],
            });
            if (!leaveRequest) {
                return ctx.notFound('Leave request not found');
            }
            // Update the status to approved
            const updatedLeave = await strapi.entityService.update('api::leave-status.leave-status', id, {
                data: {
                    status: 'approved',
                },
            });
            // Calculate leave days
            const leaveDays = calculateLeaveDays(leaveRequest.start_date, leaveRequest.end_date, leaveRequest.leave_type, leaveRequest.is_first_half);
            console.log('Debug - Leave Request:', {
                id: leaveRequest.id,
                leaveType: leaveRequest.leave_type,
                isPaid: leaveRequest.is_paid,
                startDate: leaveRequest.start_date,
                endDate: leaveRequest.end_date,
                leaveDays: leaveDays,
                hasUser: !!leaveRequest.user,
                userId: (_a = leaveRequest.user) === null || _a === void 0 ? void 0 : _a.id,
            });
            // Update user's leave balance (skip for short leave)
            if (leaveRequest.user &&
                leaveDays > 0 &&
                leaveRequest.leave_type !== 'short_leave') {
                const userId = leaveRequest.user.id;
                console.log('Debug - Updating balance for user:', userId);
                const currentUser = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
                console.log('Debug - Current user data:', {
                    userId: currentUser === null || currentUser === void 0 ? void 0 : currentUser.id,
                    currentBalance: currentUser === null || currentUser === void 0 ? void 0 : currentUser.leave_balance,
                    currentUnpaidBalance: currentUser === null || currentUser === void 0 ? void 0 : currentUser.unpaid_leave_balance,
                });
                if (currentUser) {
                    const currentBalance = currentUser.leave_balance || 0;
                    const currentUnpaidBalance = currentUser.unpaid_leave_balance || 0;
                    // Calculate new balances - deduct from regular balance first, then unpaid if needed
                    let newBalance = currentBalance;
                    let newUnpaidBalance = currentUnpaidBalance;
                    if (currentBalance >= leaveDays) {
                        // Enough regular leave balance
                        newBalance = currentBalance - leaveDays;
                    }
                    else {
                        // Not enough regular leave balance, use unpaid leave for remaining days
                        const remainingDays = leaveDays - currentBalance;
                        newBalance = 0;
                        newUnpaidBalance = Math.max(0, currentUnpaidBalance - remainingDays);
                    }
                    console.log('Debug - Balance calculation:', {
                        currentBalance,
                        currentUnpaidBalance,
                        leaveDays,
                        isPaid: leaveRequest.is_paid,
                        newBalance,
                        newUnpaidBalance,
                    });
                    // Update user's leave balance
                    await strapi.entityService.update('plugin::users-permissions.user', userId, {
                        data: {
                            leave_balance: newBalance,
                            unpaid_leave_balance: newUnpaidBalance,
                        },
                    });
                }
            }
            else {
                console.log('Debug - Skipping balance update:', {
                    hasUser: !!leaveRequest.user,
                    leaveDays,
                    leaveType: leaveRequest.leave_type,
                    isShortLeave: leaveRequest.leave_type === 'short_leave',
                });
            }
            return ctx.send({
                message: 'Leave request approved successfully',
                data: updatedLeave,
                leaveDaysDeducted: leaveDays,
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
