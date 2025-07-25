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
    const { user, date, in: inTime } = ctx.request.body.data;
    console.log('Incoming data request:', ctx.request.body);

    // Check if user is Admin or Hr (should not have attendance tracking)
    const userDetails = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      user
    );
    if (userDetails.user_type === 'Admin' || userDetails.user_type === 'Hr') {
      return ctx.badRequest(
        'Attendance tracking is not required for Admin and Hr users'
      );
    }

    // First check if attendance entry exists for today
    const today = date || new Date().toISOString().split('T')[0];
    const existingEntry = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          user: user,
          Date: today,
        },
      }
    );

    let attendance;
    if (existingEntry.length > 0) {
      // Update existing entry
      attendance = await strapi.entityService.update(
        'api::daily-attendance.daily-attendance',
        existingEntry[0].id,
        {
          data: {
            in: inTime,
            status: 'present',
            notes: 'User checked in successfully',
          },
        }
      );
    } else {
      // Create new entry
      attendance = await strapi.entityService.create(
        'api::daily-attendance.daily-attendance',
        {
          data: {
            user: user,
            Date: today,
            in: inTime,
            status: 'present',
            notes: 'User checked in successfully',
          },
        }
      );
    }

    console.log('Attendance Response:', attendance);

    ctx.body = attendance;
    return attendance;
  },
  async checkOut(ctx) {
    const { id, out } = ctx.request.body.data;

    if (!id || !out) {
      return ctx.badRequest('Missing required fields: user or out');
    }

    const attendance = await strapi.entityService.update(
      'api::daily-attendance.daily-attendance',
      id,
      {
        data: {
          out,
          notes: 'User checked out successfully',
        },
      }
    );

    ctx.body = attendance;
    return attendance;
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
