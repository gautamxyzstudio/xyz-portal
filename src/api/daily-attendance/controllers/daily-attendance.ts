export default {
  async findAll(ctx) {
    const { page = 1, pageSize = 10, startDate, endDate, search } = ctx.query;

    // Build filters object
    const filters: any = {};

    // Add date range filter if startDate and/or endDate are provided
    if (startDate || endDate) {
      filters.Date = {};
      if (startDate) {
        filters.Date.$gte = startDate;
      }
      if (endDate) {
        filters.Date.$lte = endDate;
      }
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
      ];
    }

    const attendance = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters,
        start: (page - 1) * pageSize,
        limit: pageSize,
        populate,
      }
    );

    const total = await strapi.entityService.count(
      'api::daily-attendance.daily-attendance',
      {
        filters,
      }
    );

    ctx.body = {
      data: attendance,
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

  async find(ctx) {
    const { id } = ctx.params;
    const attendance = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          user: id,
        },
      }
    );
    ctx.body = attendance;
    return attendance;
  },

  async findToday(ctx) {
    const { id } = ctx.params;
    const attendance = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          Date: new Date().toISOString().split('T')[0],
          user: id,
        },
      }
    );
    ctx.body = attendance;
    return attendance;
  },

async checkIn(ctx) {
  try {
    // 🔐 Get logged-in user from token
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('Login required');
    }

    const { date, in: inTimeRaw } = ctx.request.body.data;

    if (!inTimeRaw) {
      return ctx.badRequest('Check-in time is required');
    }

    // ⏱ Normalize time to HH:mm:ss.SSS
    const inTime =
      inTimeRaw.length === 5 ? `${inTimeRaw}:00.000` : inTimeRaw;

    // ⛔ BLOCK CHECK-IN BEFORE 8:40 AM (VALIDATE GIVEN TIME)
    const [hours, minutes] = inTime.split(':').map(Number);
    const inMinutes = hours * 60 + minutes;
    const minAllowed = 8 * 60 + 40; // 08:40 AM

    if (inMinutes < minAllowed) {
      return ctx.badRequest('Check-in is allowed only after 8:40 AM');
    }

    // 👤 Fetch user details
    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      userId
    );

    // 🚫 Block Admin & HR
    if (user.user_type === 'Admin' || user.user_type === 'Hr') {
      return ctx.badRequest(
        'Attendance tracking is not required for Admin and Hr users'
      );
    }

    // 📅 Today
    const today = date || new Date().toISOString().split('T')[0];

    // 🔍 Check existing attendance for today
    const existing = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          user: userId,
          Date: today,
        },
        limit: 1,
      }
    );

    let attendance;

    if (existing.length > 0) {
      // 🔄 Update existing record
      attendance = await strapi.entityService.update(
        'api::daily-attendance.daily-attendance',
        existing[0].id,
        {
          data: {
            in: inTime,
            status: 'present',
            notes: 'User checked in successfully',
            publishedAt: new Date(), // ✅ AUTO-PUBLISH
          },
        }
      );
    } else {
      // 🆕 Create new record
      attendance = await strapi.entityService.create(
        'api::daily-attendance.daily-attendance',
        {
          data: {
            user: userId,
            Date: today,
            in: inTime,
            status: 'present',
            notes: 'User checked in successfully',
            publishedAt: new Date(), // ✅ ENSURE PUBLISHED
          },
        }
      );
    }

    ctx.body = attendance;
    return attendance;
  } catch (error) {
    strapi.log.error('Check-in failed:', error);
    ctx.throw(500, 'Check-in failed');
  }
},

async checkOut(ctx) {
  try {
    // 🔐 Logged-in user
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized('Login required');
    }

    // ✅ Safe body parsing
    const body = ctx.request.body?.data || ctx.request.body;
    if (!body) {
      return ctx.badRequest('Request body is required');
    }

    const { out: outTimeRaw } = body;
    if (!outTimeRaw) {
      return ctx.badRequest('Checkout time is required');
    }

    // ⏱ Normalize time to HH:mm:ss.SSS
    const outTime =
      outTimeRaw.length === 5 ? `${outTimeRaw}:00.000` : outTimeRaw;

    // 📅 Today
    const today = new Date().toISOString().split('T')[0];

    // 🔍 Find today’s attendance for THIS user
    const records = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          user: userId,
          Date: today,
        },
        limit: 1,
      }
    );

    if (!records.length) {
      return ctx.badRequest('No check-in found for today');
    }

    const attendance = records[0];

    // 🚫 Prevent checkout without check-in
    if (!attendance.in) {
      return ctx.badRequest('User has not checked in yet');
    }

    // 🚫 Prevent double checkout
    if (attendance.out) {
      return ctx.badRequest('User has already checked out');
    }

    // ✅ Update checkout
    const updated = await strapi.entityService.update(
      'api::daily-attendance.daily-attendance',
      attendance.id,
      {
        data: {
          out: outTime,
          notes: 'User checked out successfully',
          last_checkout_reminder: null, // 🛑 stop reminder emails
          publishedAt: new Date(), // ✅ ensure published
        },
      }
    );

    ctx.body = updated;
    return updated;
  } catch (error) {
    strapi.log.error('Checkout failed:', error);
    ctx.throw(500, 'Checkout failed');
  }
},

  async updateAttendance(ctx) {
    const { id, out, in: inTime } = ctx.request.body.data;
    if (!id || !out || !inTime) {
      return ctx.badRequest('Missing required fields: id, out, or in');
    }
    const attendance = await strapi.entityService.update(
      'api::daily-attendance.daily-attendance',
      id,
      {
        data: { out, in: inTime },
      }
    );
    ctx.body = attendance;
    return attendance;
  },

  // Cron job endpoints
  async createDailyEntries(ctx) {
    try {
      const result = await strapi
        .service('api::daily-attendance.daily-attendance')
        .createDailyAttendanceEntries();
      ctx.body = result;
      return result;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async markAbsentUsers(ctx) {
    try {
      const result = await strapi
        .service('api::daily-attendance.daily-attendance')
        .markAbsentUsers();
      ctx.body = result;
      return result;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async getAttendanceStats(ctx) {
    try {
      const { startDate, endDate } = ctx.query;

      if (!startDate || !endDate) {
        return ctx.badRequest(
          'Missing required parameters: startDate and endDate'
        );
      }

      const result = await strapi
        .service('api::daily-attendance.daily-attendance')
        .getAttendanceStats(startDate, endDate);
      ctx.body = result;
      return result;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  // Manual trigger for testing
  async triggerDailyCron(ctx) {
    try {
      // Create daily entries
      const createResult = await strapi
        .service('api::daily-attendance.daily-attendance')
        .createDailyAttendanceEntries();

      ctx.body = {
        message: 'Daily cron job triggered successfully',
        createEntries: createResult,
        timestamp: new Date().toISOString(),
      };
      return ctx.body;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  // Manual trigger for end of day processing
  async triggerEndOfDayCron(ctx) {
    try {
      // Mark absent users
      const markAbsentResult = await strapi
        .service('api::daily-attendance.daily-attendance')
        .markAbsentUsers();

      ctx.body = {
        message: 'End of day cron job triggered successfully',
        markAbsent: markAbsentResult,
        timestamp: new Date().toISOString(),
      };
      return ctx.body;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  // Debug endpoint to check table structure
  async debugTable(ctx) {
    try {
      // Try to get a single record to see the structure
      const records = await strapi.entityService.findMany(
        'api::daily-attendance.daily-attendance',
        {
          limit: 1,
        }
      );

      ctx.body = {
        success: true,
        recordCount: records.length,
        sampleRecord: records[0] || null,
        tableInfo: 'Daily attendance table structure check',
      };
    } catch (error) {
      console.error('Debug table error:', error);
      ctx.body = {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  },

  // Method to check and potentially fix table structure
  async checkTableStructure(ctx) {
    try {
      // Try to get table info using raw query
      const result = await strapi.db.connection.raw(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'daily_attendances' 
        ORDER BY ordinal_position;
      `);

      ctx.body = {
        success: true,
        tableStructure: result.rows || result,
        message: 'Table structure retrieved successfully',
      };
    } catch (error) {
      console.error('Error checking table structure:', error);
      ctx.body = {
        success: false,
        error: error.message,
        message: 'Failed to retrieve table structure',
      };
    }
  },
};
