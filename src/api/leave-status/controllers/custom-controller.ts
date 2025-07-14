const { createCoreController } = require('@strapi/strapi').factories;
const moduleUid = 'api::leave-status.leave-status';

// Helper function to calculate leave days
function calculateLeaveDays(
  startDate,
  endDate,
  leaveType,
  isFirstHalf = false
) {
  if (!startDate || !endDate) return 0;

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

    const leaveRequest = await strapi.entityService.findOne(
      'api::leave-status.leave-status',
      id,
      { populate: ['user'] }
    );

    if (!leaveRequest) return ctx.notFound('Leave request not found');
    if (!leaveRequest.user) return ctx.badRequest('Leave request has no associated user');
    if (leaveRequest.status === 'approved') {
      return ctx.badRequest('Leave request is already approved');
    }

    const userId = leaveRequest.user.id;
    const leaveDuration = leaveRequest.leave_duration || 'full_day';
    const leaveType = leaveRequest.leave_type || 'Casual';

    // 1. Calculate leave days
    let leaveDays = 1;
    if (leaveDuration === 'short_leave') leaveDays = 0.25;
    else if (leaveDuration === 'half_day') leaveDays = 0.5;
    else {
      leaveDays = calculateLeaveDays(
        leaveRequest.start_date,
        leaveRequest.end_date,
        leaveRequest.is_first_half
      );
    }

    // 2. Count approved short_leaves in current year
    let shortLeavesUsed = 0;
    if (leaveDuration === 'short_leave') {
      const currentYear = new Date().getFullYear();
      const approvedShortLeaves = await strapi.entityService.findMany('api::leave-status.leave-status', {
        filters: {
          user: userId,
          status: 'approved',
          leave_duration: 'short_leave',
          start_date: {
            $gte: `${currentYear}-01-01`,
            $lte: `${currentYear}-12-31`,
          },
        },
        fields: ['id'],
      });
      shortLeavesUsed = approvedShortLeaves.length;
    }

    // 3. Fetch user leave balances
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['leave_balance', 'unpaid_leave_balance'],
    });

    let newLeaveBalance = user.leave_balance || 0;
    let newUnpaidBalance = user.unpaid_leave_balance || 0;

    // 4. Apply leave deduction rules
    if (leaveDuration === 'short_leave') {
      if (shortLeavesUsed >= 1) {
        if (newLeaveBalance >= 0.25) {
          newLeaveBalance -= 0.25;
        } else {
          newUnpaidBalance += 0.25;
        }
      } else {
        console.log('✅ First short_leave this year — free');
      }
    } else if (leaveType === 'Casual') {
      if (newLeaveBalance >= leaveDays) {
        newLeaveBalance -= leaveDays;
      } else {
        const unpaidPortion = leaveDays - newLeaveBalance;
        newLeaveBalance = 0;
        newUnpaidBalance += unpaidPortion;
      }
    } else if (leaveType === 'UnPaid') {
      newUnpaidBalance += leaveDays;
    }

    // 5. Update user leave balances
    await strapi.entityService.update('plugin::users-permissions.user', userId, {
      data: {
        leave_balance: newLeaveBalance,
        unpaid_leave_balance: newUnpaidBalance,
      },
    });

    // 6. Approve and publish the leave
    const updatedLeave = await strapi.entityService.update(
      'api::leave-status.leave-status',
      id,
      {
        data: {
          status: 'approved',
          publishedAt: new Date(), // in case draftAndPublish is enabled
        },
      }
    );

    ctx.body = {
      message: '✅ Leave approved and balances updated',
      leaveType,
      leaveDuration,
      leaveDays,
      shortLeavesUsed,
      new_leave_balance: newLeaveBalance,
      new_unpaid_leave_balance: newUnpaidBalance,
    };
  } catch (error) {
    console.error('❌ Error approving leave:', error);
    return ctx.badRequest('Error approving leave request', { error: error.message });
  }
}

,
  // Reject leave request
  async reject(ctx) {
    try {
      const { id } = ctx.params;
      const { decline_reason } = ctx.request.body;

      // Find the leave request
      const leaveRequest = await strapi.entityService.findOne(
        'api::leave-status.leave-status',
        id,
        {
          populate: ['user'],
        }
      );

      if (!leaveRequest) {
        return ctx.notFound('Leave request not found');
      }

      // Update the status to declined with reason (if provided)
      const updateData: any = {
        status: 'declined',
      };

      if (decline_reason) {
        updateData.decline_reason = decline_reason;
      }

      const updatedLeave = await strapi.entityService.update(
        'api::leave-status.leave-status',
        id,
        {
          data: updateData,
        }
      );

      return ctx.send({
        message: 'Leave request rejected successfully',
        data: updatedLeave,
      });
    } catch (error) {
      return ctx.badRequest('Error rejecting leave request', {
        error: error.message,
      });
    }
  },

  // Get all leave requests with pagination, filtering, and search
  async all(ctx) {
    const {
      page = 1,
      pageSize = 10,
      startDate,
      endDate,
      search,
      leave_type,
    } = ctx.query;

    // Build filters object
    const filters: any = {};

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
    const populate: any = {
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

    const leaveRequests = await strapi.entityService.findMany(
      'api::leave-status.leave-status',
      {
        filters,
        start: (page - 1) * pageSize,
        limit: pageSize,
        populate,
        sort: { createdAt: 'desc' },
      }
    );

    const total = await strapi.entityService.count(
      'api::leave-status.leave-status',
      {
        filters,
      }
    );

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
