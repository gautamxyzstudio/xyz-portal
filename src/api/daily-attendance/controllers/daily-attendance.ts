const getISTDate = () =>
  new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  )
    .toISOString()
    .slice(0, 10);

export default {

  /* =====================================================
     📋 GET ALL ATTENDANCE (PAGINATED + SEARCH)
     -----------------------------------------------------*/

async findAll(ctx) {
  const { page = 1, pageSize = 10, startDate, endDate, search } = ctx.query;

  const filters: any = {};

  /* ===============================
     📅 Date range filter
  =============================== */
  if (startDate || endDate) {
    filters.Date = {};
    if (startDate) filters.Date.$gte = startDate;
    if (endDate) filters.Date.$lte = endDate;
  }

  /* ===============================
     🚫 Show ONLY real attendance
     (records created by check-in)
  =============================== */
  filters.in = { $notNull: true };

  /* ===============================
     🔍 Search filter
  =============================== */
  if (search) {
    filters.$or = [
      {
        user: {
          user_detial: {
            empCode: { $containsi: search },
          },
        },
      },
      {
        user: {
          user_detial: {
            firstName: { $containsi: search },
          },
        },
      },
      {
        user: {
          user_detial: {
            lastName: { $containsi: search },
          },
        },
      },
      {
        user: {
          username: { $containsi: search },
        },
      },
    ];
  }

  /* ===============================
     📥 Fetch attendance
  =============================== */
  const attendance = await strapi.entityService.findMany(
    'api::daily-attendance.daily-attendance',
    {
      filters,
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      populate: {
        user: {
          populate: {
            user_detial: {
              populate: {
                Photo: true,
              },
            },
          },
        },
      },
      sort: { Date: 'desc' }, // latest first
    }
  );

  /* ===============================
     📊 Pagination count
  =============================== */
  const total = await strapi.entityService.count(
    'api::daily-attendance.daily-attendance',
    { filters }
  );

  ctx.body = {
    data: attendance,
    meta: {
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        pageCount: Math.ceil(total / Number(pageSize)),
        total,
      },
    },
  };
},


/* =====================================================
   👤 GET ATTENDANCE OF A SINGLE USER
===================================================== */
async findByUser(ctx) {
  const { userId } = ctx.params;
  const { fromDate, toDate } = ctx.query;

  if (!userId) {
    return ctx.badRequest('User ID is required');
  }

  const filters: any = {
    user: userId,
  };

  /* ===============================
     📅 Date range filter
  =============================== */
  if (fromDate || toDate) {
    filters.Date = {};
    if (fromDate) filters.Date.$gte = fromDate;
    if (toDate) filters.Date.$lte = toDate;
  }

  /* ===============================
     🚫 Only real attendance (checked-in)
  =============================== */
  filters.in = { $notNull: true };

  const attendance = await strapi.entityService.findMany(
    'api::daily-attendance.daily-attendance',
    {
      filters,
      sort: { Date: 'desc' }, // latest first
      populate: {
        user: {
          populate: {
            user_detial: true,
          },
        },
      },
    }
  );

  ctx.body = attendance;
},

  /* =====================================================
     📅 GET TODAY'S ATTENDANCE FOR A USER (IST SAFE)
  ===================================================== */
  async findToday(ctx) {
    const { id } = ctx.params;

    const attendance = await strapi.entityService.findMany(
      "api::daily-attendance.daily-attendance",
      {
        filters: {
          Date: getISTDate(),
          user: id,
        },
        sort: { Date: "desc" },
      }
    );

    ctx.body = attendance;
  },

  /* =====================================================
     ✅ CHECK-IN 
     -----------------------------------------------------
      Attendance is created ONLY when user checks in
  ===================================================== */
 async checkIn(ctx) {   
  try {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Login required');

    const { date, in: inTimeRaw } = ctx.request.body.data || {};
    if (!inTimeRaw) return ctx.badRequest('Check-in time is required');

    // ⏱ Normalize time (HH:mm:ss.SSS)
    const inTime =
      inTimeRaw.length === 5 ? `${inTimeRaw}:00.000` : inTimeRaw;

    // ⛔ Block early check-in (before 08:40 AM)
    const [hours, minutes] = inTime.split(':').map(Number);
    if (hours * 60 + minutes < 8 * 60 + 40) {
      return ctx.badRequest('Check-in allowed only after 8:40 AM');
    }

    // 👤 Fetch user
    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      userId
    );

    // 🚫 Admin / HR excluded
    if (user.user_type === 'Admin' || user.user_type === 'Hr') {
      return ctx.badRequest('Attendance not required for Admin/HR');
    }

    const today = date || getISTDate();

    // 🔍 Check if attendance already exists for today
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

    // 🚫 BLOCK second check-in
    if (existing.length && existing[0].in) {
      return ctx.badRequest('You have already checked in for today');
    }

    // 🆕 Create attendance (only once)
    const attendance = await strapi.entityService.create(
      'api::daily-attendance.daily-attendance',
      {
        data: {
          user: userId,
          Date: today,
          in: inTime,
          out: null,
          status: 'present',
          publishedAt: new Date(),
        },
      }
    );

    ctx.body = attendance;
  } catch (error) {
    strapi.log.error('Check-in failed:', error);
    ctx.throw(500, 'Check-in failed');
  }
},

  /* =====================================================
     ⏹ CHECK-OUT  
  ==================================================== */
  async checkOut(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const { out: outTimeRaw } = ctx.request.body.data;
      if (!outTimeRaw) return ctx.badRequest('Checkout time required');

      const outTime =
        outTimeRaw.length === 5 ? `${outTimeRaw}:00.000` : outTimeRaw;

      const today = getISTDate();

      const records = await strapi.entityService.findMany(
        'api::daily-attendance.daily-attendance',
        {
          filters: { user: userId, Date: today },
          limit: 1,
        }
      );

      if (!records.length) {
        return ctx.badRequest('No check-in found for today');
      }

      const attendance = records[0];

      if (!attendance.in) {
        return ctx.badRequest('User has not checked in');
      }

      // 🛑 Safe check for time field
      if (
        attendance.out &&
        attendance.out !== '' &&
        attendance.out !== '00:00:00'
      ) {
        return ctx.badRequest('Already checked out');
      }

      const updated = await strapi.entityService.update(
        'api::daily-attendance.daily-attendance',
        attendance.id,
        {
          data: {
            out: outTime,
            last_checkout_reminder: null, // 🛑 stop reminder emails
            publishedAt: new Date(),
          },
        }
      );

      ctx.body = updated;
    } catch (error) {
      strapi.log.error('Checkout failed:', error);
      ctx.throw(500, 'Checkout failed');
    }
  },

  /* =====================================================
     🚫 MANUAL UPDATE (DISABLED)

     Prevents bypassing check-in / check-out rules
  ===================================================== */
  async updateAttendance(ctx) {
    return ctx.forbidden(
      'Manual attendance update is disabled. Use check-in/check-out APIs.'
    );
  },


};
