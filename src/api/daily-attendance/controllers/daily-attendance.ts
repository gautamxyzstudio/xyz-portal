/* =====================================================
   🕒 IST HELPERS
===================================================== */

const getISTNow = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

const getISTDate = () => {
  const ist = getISTNow();
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isLunchTime = (date = getISTNow()) => {
  const hour = date.getHours();
  return hour >= 15 && hour < 16;
};

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
    const { id } = ctx.params;
    const { fromDate, toDate } = ctx.query;

    if (!id) {
      return ctx.badRequest('User ID is required');
    }

    const filters: any = {
      user: id,
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
      if (!userId) return ctx.unauthorized("Login required");

      const body = ctx.request.body?.data || ctx.request.body || {};
      const { date, in: inTimeRaw } = body;

      const today = date || getISTDate();

      const existing = await strapi.entityService.findMany(
        "api::daily-attendance.daily-attendance",
        {
          filters: { user: userId, Date: today },
          limit: 1,
        }
      );

      if (existing.length) {
        const record = existing[0];

        if (record.out)
          return ctx.badRequest("You have already checked out");

        if (!record.is_checked_in) {
          const istNow = getISTNow();
          if (isLunchTime(istNow)) {
            return ctx.badRequest(
              "Lunch break (1:00–2:00 PM). You can join after 2:00 PM."
            );
          }

          const resumed = await strapi.entityService.update(
            "api::daily-attendance.daily-attendance",
            record.id,
            {
              data: {
                checkin_started_at: new Date().toISOString(),
                is_checked_in: true,
              },
            }
          );

          ctx.body = resumed;
          return;
        }

        return ctx.badRequest("Already checked in");
      }

      if (!inTimeRaw)
        return ctx.badRequest("Check-in time is required");

      const inTime =
        typeof inTimeRaw === "string" && inTimeRaw.length === 5
          ? `${inTimeRaw}:00`
          : inTimeRaw;

      const [hours, minutes] = inTime.split(":").map(Number);
      if (hours * 60 + minutes < 8 * 60 + 40)
        return ctx.badRequest("Check-in allowed only after 8:40 AM");

      const attendance = await strapi.entityService.create(
        "api::daily-attendance.daily-attendance",
        {
          data: {
            user: userId,
            Date: today,
            in: inTime,
            out: null,
            status: "present",
            attendance_seconds: 0,
            checkin_started_at: new Date().toISOString(),
            is_checked_in: true,
            publishedAt: new Date(),
          },
        }
      );

      ctx.body = attendance;
    } catch (err) {
      strapi.log.error("Check-in failed", err);
      ctx.throw(500, "Check-in failed");
    }
  },

  /* =====================================================
     ⏹ CHECK-OUT  
  ==================================================== */

async checkOut(ctx) {
  try {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized("Login required");

    const body = ctx.request.body?.data || ctx.request.body || {};
    const { out: outTimeRaw } = body as { out?: string };

    if (!outTimeRaw) return ctx.badRequest("Checkout time required");

    // HH:mm:ss
    const outTime =
      typeof outTimeRaw === "string" && outTimeRaw.length === 5
        ? `${outTimeRaw}:00`
        : outTimeRaw;

    /* ================= IST DATE & TIME ================= */
    const getISTNow = () =>
      new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );

    const getISTDate = () => {
      const d = getISTNow();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const istNow = getISTNow();
    const today = getISTDate(); // ✅ FIXED

    /* ================= ATTENDANCE ================= */
    const records = await strapi.entityService.findMany(
      "api::daily-attendance.daily-attendance",
      {
        filters: { user: userId, Date: today },
        limit: 1,
      }
    );

    if (!records.length) {
      return ctx.badRequest("No check-in found for today");
    }

    const attendance = records[0];

    if (!attendance.in) {
      return ctx.badRequest("User has not checked in");
    }

    if (attendance.out) {
      return ctx.badRequest("Already checked out");
    }

    /* ================= STOP TASK TIMERS ================= */
    const workLogs = await strapi.entityService.findMany(
      "api::work-log.work-log",
      {
        filters: { user: userId, work_date: today },
        limit: 1,
      }
    );

    if (workLogs.length) {
      const workLog = workLogs[0];
      const tasks = (workLog.tasks || []) as any[];

      let totalTimeTaken = 0;

      for (const task of tasks) {
        if (task.is_running && task.last_started_at) {
          const elapsed = Math.floor(
            (istNow.getTime() -
              new Date(task.last_started_at).getTime()) / 1000
          );

          task.time_spent = (task.time_spent || 0) + elapsed;
          task.is_running = false;
          task.last_started_at = null;
        }

        totalTimeTaken += task.time_spent || 0;
      }

      await strapi.entityService.update(
        "api::work-log.work-log",
        workLog.id,
        {
          data: {
            tasks,
            active_task_id: null,
            total_time_taken: totalTimeTaken,
          },
        }
      );
    }

    /* ================= ACCUMULATE ATTENDANCE TIME ================= */
    let attendanceSeconds = attendance.attendance_seconds || 0;

    if (attendance.is_checked_in && attendance.checkin_started_at) {
      const elapsed = Math.floor(
        (istNow.getTime() -
          new Date(attendance.checkin_started_at).getTime()) / 1000
      );
      attendanceSeconds += elapsed;
    }

    /* ================= UPDATE ATTENDANCE ================= */
    const updatedAttendance = await strapi.entityService.update(
      "api::daily-attendance.daily-attendance",
      attendance.id,
      {
        data: {
          out: outTime,
          attendance_seconds: attendanceSeconds,
          last_checkout_reminder: null,
          checkin_started_at: null,
          is_checked_in: false,
        },
      }
    );

    ctx.body = updatedAttendance;
  } catch (error) {
    strapi.log.error("Checkout failed:", error);
    ctx.throw(500, "Checkout failed");
  }
},


  /* =====================================================
     MANUAL ATTENDENCE UPDATE
  ===================================================== */
  async updateAttendance(ctx) {
    try {
      const loggedInUser = ctx.state.user;

      if (!loggedInUser) {
        return ctx.unauthorized("Login required");
      }

      // 👤 Fetch logged-in user
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        loggedInUser.id
      );

      // ✅ Allow Admin + HR only
      if (!["Admin", "Hr"].includes(user.user_type)) {
        return ctx.forbidden(
          "Manual attendance update is allowed only for Admin or HR"
        );
      }

      const { id } = ctx.params;

      // 🔧 Support both wrapped & direct payload
      let data = ctx.request.body?.data || ctx.request.body;

      // 🛡 Ensure payload is an object
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return ctx.badRequest("Invalid JSON payload");
        }
      }

      if (!id || !data || Object.keys(data).length === 0) {
        return ctx.badRequest("Attendance ID and update data are required");
      }

      /* =================================================
         ⏱ NORMALIZE TIME FIELDS (CRITICAL FIX)
         Strapi time fields require HH:mm:ss
      ================================================= */
      if (data.in && typeof data.in === "string" && data.in.length === 5) {
        data.in = `${data.in}:00`;
      }

      if (data.out && typeof data.out === "string" && data.out.length === 5) {
        data.out = `${data.out}:00`;
      }

      // ✅ Update attendance
      const updatedAttendance = await strapi.entityService.update(
        "api::daily-attendance.daily-attendance",
        id,
        { data }
      );

      ctx.body = updatedAttendance;
    } catch (error) {
      strapi.log.error("Admin/HR attendance update failed:", error);
      ctx.throw(500, "Failed to update attendance");
    }
  }

};
