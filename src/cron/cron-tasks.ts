module.exports = {
    /* =========================================================
  📢 EMPLOYEE ANNOUNCEMENTS
 ========================================================= */

    joiningAnnouncementCron: {
  task: async ({ strapi }) => {
    try {
      strapi.log.info('➡️ Joining announcement cron triggered');

      const nowIST = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
      );

      // ✅ SAFE IST DATE
      const yyyy = nowIST.getFullYear();
      const mm = String(nowIST.getMonth() + 1).padStart(2, '0');
      const dd = String(nowIST.getDate()).padStart(2, '0');
      const todayIST = `${yyyy}-${mm}-${dd}`;

      strapi.log.info(`📅 IST Today: ${todayIST}`);

      const newJoiners = await strapi.entityService.findMany(
        'api::emp-detail.emp-detail',
        {
          filters: {
            joining_announced: false,
            joinig_date: todayIST,
          },
          populate: { user_detail: true },
        }
      );

      for (const emp of newJoiners) {
        if (!emp.user_detail) continue;

        await strapi.entityService.create(
          'api::announcement.announcement',
          {
            data: {
              Title: 'New Employee Joined',
              Description: `Please welcome <b>${emp.user_detail.username}</b> to the team!`,
              Date: todayIST,
              publishedAt: new Date(), // UTC is fine
            },
          }
        );

        await strapi.entityService.update(
          'api::emp-detail.emp-detail',
          emp.id,
          { data: { joining_announced: true } }
        );
      }
    } catch (error) {
      strapi.log.error('❌ Error in joiningAnnouncementCron:', error);
    }
  },
  options: {
    rule: '*/5 * * * *',
    tz: 'Asia/Kolkata',
  },
},


    /* =========================================================
       🎂 BIRTHDAY ANNOUNCEMENT
    ========================================================= */
   birthdayAnnouncementCron: {
  task: async ({ strapi }) => {
    try {
      const now = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
      );

      const day = now.getDate();
      const month = now.getMonth() + 1;

      const employees = await strapi.entityService.findMany(
        'api::emp-detail.emp-detail',
        {
          filters: { date_of_birth: { $notNull: true } },
          populate: { user_detail: true },
        }
      );

      const birthdayNames = employees
        .filter(emp => {
          if (!emp.date_of_birth || !emp.user_detail) return false;

          const [, dobMonth, dobDay] = emp.date_of_birth
            .split('-')
            .map(Number);

          return dobDay === day && dobMonth === month;
        })
        .map(emp => emp.user_detail.username);

      if (!birthdayNames.length) return;

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const exists = await strapi.entityService.findMany(
        'api::announcement.announcement',
        {
          filters: {
            Title: 'Happy Birthday!',
            createdAt: { $between: [startOfToday, endOfToday] },
          },
          limit: 1,
        }
      );

      if (exists.length) return;

      await strapi.entityService.create(
        'api::announcement.announcement',
        {
          data: {
            Title: 'Happy Birthday!',
            Description: `🎉 Wishing a very happy birthday to <b>${birthdayNames.join(', ')}</b>!`,
            Date: now,
            publishedAt: now,
          },
        }
      );
    } catch (error) {
      strapi.log.error('❌ birthdayAnnouncementCron failed:', error);
    }
  },
  options: {
    rule: '10 7 * * *',
    tz: 'Asia/Kolkata',
  },
},


    /* =========================================================
       🎊 WORK ANNIVERSARY 
    ========================================================= */
  anniversaryAnnouncementCron: {
  task: async ({ strapi }) => {
    try {
      const now = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
      );

      const day = now.getDate();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const employees = await strapi.entityService.findMany(
        'api::emp-detail.emp-detail',
        {
          filters: { joinig_date: { $notNull: true } },
          populate: { user_detail: true },
        }
      );

      const anniversaryPeople = employees
        .map(emp => {
          if (!emp.joinig_date || !emp.user_detail) return null;

          const [joinYear, joinMonth, joinDay] = emp.joinig_date
            .split('-')
            .map(Number);

          const years =
            year -
            joinYear -
            (month < joinMonth || (month === joinMonth && day < joinDay)
              ? 1
              : 0);

          return joinDay === day && joinMonth === month && years > 0
            ? `${emp.user_detail.username} (${years} ${years === 1 ? 'year' : 'years'})`
            : null;
        })
        .filter(Boolean);

      if (!anniversaryPeople.length) return;

      const exists = await strapi.entityService.findMany(
        'api::announcement.announcement',
        {
          filters: {
            Title: 'Work Anniversary',
            createdAt: { $between: [startOfToday, endOfToday] },
          },
          limit: 1,
        }
      );

      if (exists.length) return;

      await strapi.entityService.create(
        'api::announcement.announcement',
        {
          data: {
            Title: 'Work Anniversary',
            Description: `🎉 Congratulations to <b>${anniversaryPeople.join(', ')}</b> for completing their years with us!`,
            Date: now,
            publishedAt: now,
          },
        }
      );
    } catch (error) {
      strapi.log.error('❌ anniversaryAnnouncementCron failed:', error);
    }
  },
  options: {
    rule: '0 7 * * *',
    tz: 'Asia/Kolkata',
  },
},

    /* ===================================================================
        🗑 DELETE ALL ANNOUNCEMENTS OLDER THAN 2 DAYS
     =================================================================== */
    announcementCleanupCron: {
        task: async ({ strapi }) => {
            try {
                strapi.log.info('🕒 announcementCleanupCron executed');

                /* ==========================================
                   📅 Calculate cutoff (IST, 2 days old)
                ========================================== */
                const nowIST = new Date(
                    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
                );

                // Start of today (IST)
                const startOfToday = new Date(nowIST);
                startOfToday.setHours(0, 0, 0, 0);

                // Start of day, 2 days ago (IST)
                const cutoffDate = new Date(startOfToday);
                cutoffDate.setDate(cutoffDate.getDate() - 2);

                /* ==========================================
                   🗑 Delete ALL announcements older than 2 days
                ========================================== */
                const oldAnnouncements = await strapi.entityService.findMany(
                    'api::announcement.announcement',
                    {
                        publicationState: 'preview',
                        filters: {
                            Date: { $lt: cutoffDate },
                        },
                        fields: ['id', 'title', 'createdAt'],
                        limit: 500,
                    }
                );

                for (const a of oldAnnouncements) {
                    await strapi.entityService.delete(
                        'api::announcement.announcement',
                        a.id
                    );
                }

                strapi.log.info(
                    `🗑 Deleted ${oldAnnouncements.length} announcements older than 2 days`
                );
            } catch (error) {
                strapi.log.error('❌ Error in announcementCleanupCron:', error);
            }
        },
        options: {
            rule: '0 8 * * *',
            tz: 'Asia/Kolkata',
        },
    },

    /* =================================
         LUNCH TIME AUTO-PAUSE TASKS
      ========================================== */
    lunchAutoPause: {
        task: async ({ strapi }) => {
            try {
                /* ===== IST TIME ===== */
                const now = new Date(
                    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
                );

                const hour = now.getHours();

                // ⏸ Only between 1:00 PM and 1:59 PM
                if (hour < 15 || hour >= 16) return;

                /* ================================
                   ✅ FIX 1: SAFE IST DATE (NO UTC)
                ================================= */
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, "0");
                const dd = String(now.getDate()).padStart(2, "0");
                const today = `${yyyy}-${mm}-${dd}`; // <-- FIXED

                // 🔵 START LOG
                strapi.log.info(
                    `🕐 [Lunch AutoPause] Started at ${now.toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                    })}`
                );

                /* =====================================================
                   🧩 PAUSE TASK TIMERS
                ===================================================== */
              const workLogs = await strapi.entityService.findMany(
                    "api::work-log.work-log",
                    {
                        filters: { work_date: today },
                        populate: { user: true },
                        limit: -1,
                    }
                );

                let pausedTasksCount = 0;

                for (const log of workLogs) {
                    let changed = false;

                    for (const task of log.tasks || []) {
                        if (task.is_running && task.last_started_at) {
                            const elapsed = Math.floor(
                                (now.getTime() - new Date(task.last_started_at).getTime()) / 1000
                            );

                            task.time_spent = (task.time_spent || 0) + elapsed;
                            task.is_running = false;
                            task.last_started_at = null;
                            changed = true;
                            pausedTasksCount++;
                        }
                    }

                    if (changed) {
                        await strapi.entityService.update(
                            "api::work-log.work-log",
                            log.id,
                            {
                                data: {
                                    tasks: log.tasks,
                                    active_task_id: null,
                                },
                            }
                        );
                    }
                }

                /* =====================================================
                   ⏸ PAUSE CHECK-IN TIMER
                ===================================================== */
                const runningAttendances = await strapi.entityService.findMany(
                    "api::daily-attendance.daily-attendance",
                    {
                        filters: {
                            Date: today,
                            is_checked_in: true,
                            checkin_started_at: { $notNull: true },
                            last_paused_at: { $null: true }, // 🛡 only pause once
                        },
                        limit: -1,
                    }
                );

                let pausedCheckinsCount = 0;

                for (const attendance of runningAttendances) {
                    const startedAt = new Date(attendance.checkin_started_at);
                    if (isNaN(startedAt.getTime())) continue;

                    const elapsedSeconds = Math.floor(
                        (now.getTime() - startedAt.getTime()) / 1000
                    );

                    const totalSeconds =
                        (attendance.attendance_seconds || 0) + elapsedSeconds;

                    await strapi.entityService.update(
                        "api::daily-attendance.daily-attendance",
                        attendance.id,
                        {
                            data: {
                                attendance_seconds: totalSeconds,
                                checkin_started_at: null,
                                is_checked_in: false,
                                last_paused_at: new Date().toISOString(),
                            },
                        }
                    );

                    pausedCheckinsCount++;
                }

                // 🟢 SUCCESS LOG
                strapi.log.info(
                    `✅ [Lunch AutoPause] Completed | Tasks paused: ${pausedTasksCount} | Check-ins paused: ${pausedCheckinsCount}`
                );
            } catch (err) {
                // 🔴 ERROR LOG
                strapi.log.error("❌ [Lunch AutoPause] Failed", err);
            }
        },
        options: {
            rule: "*/5 * * * *",
            tz: "Asia/Kolkata",
        },
    },

    /* ======================================
       CHECKOUT REMINDER 
       ========================================= */

    checkoutReminder: {
        task: async ({ strapi }) => {
            try {
                /* =====================================================
                   🕒 IST NOW (SAFE)
                ===================================================== */
                const istNow = new Date(
                    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
                );

                const hours = istNow.getHours();
                const minutes = istNow.getMinutes();

                /* =====================================================
                   📅 SAFE IST DATE (NO toISOString BUG)
                ===================================================== */
                const yyyy = istNow.getFullYear();
                const mm = String(istNow.getMonth() + 1).padStart(2, "0");
                const dd = String(istNow.getDate()).padStart(2, "0");
                const today = `${yyyy}-${mm}-${dd}`;

                strapi.log.info(
                    `[CheckoutReminder] Cron running at ${istNow.toLocaleTimeString("en-IN")}`
                );

                /* =====================================================
                   ⏱ TIME GATE — AFTER 6:15 PM IST ONLY
                ===================================================== */
                if (hours < 18 || (hours === 18 && minutes < 15)) return;

                /* =====================================================
                   👤 ACTIVE ATTENDANCE (NOT CHECKED OUT)
                ===================================================== */
                const attendances = await strapi.entityService.findMany(
                    "api::daily-attendance.daily-attendance",
                    {
                        filters: {
                            Date: today,
                            in: { $notNull: true },
                            out: { $null: true },
                        },
                        populate: { user: true },
                    }
                );

                if (!attendances.length) return;

                /* =====================================================
                   👥 HR USERS (CC)
                ===================================================== */
                const hrUsers = await strapi.entityService.findMany(
                    "plugin::users-permissions.user",
                    {
                        filters: {
                            role: { name: "Hr" },
                            user_type: "Hr",
                        },
                    }
                );

                const hrEmails = hrUsers.map(u => u.email).filter(Boolean);

                /* =====================================================
                   ✉️ SEND REMINDERS
                ===================================================== */
                for (const attendance of attendances) {
                    const lastReminder = attendance.last_checkout_reminder
                        ? new Date(attendance.last_checkout_reminder)
                        : null;

                    // ⏱ 30-minute rule
                    if (
                        lastReminder &&
                        istNow.getTime() - lastReminder.getTime() < 30 * 60 * 1000
                    ) {
                        continue;
                    }

                    const userEmail = attendance.user?.email;
                    if (!userEmail) continue;

                    await strapi.plugin("email").service("email").send({
                        to: userEmail,        // employee
                        cc: hrEmails,         // HR
                        subject: "Checkout Reminder – Working After Office Hours",

                        /* =====================================================
                           📧 HTML EMAIL (INLINE, FIXED)
                        ===================================================== */
                        html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
</head>

<body style="margin:0;padding:0;background-color:#f7f7f7;">

<table border="0" width="100%" style="table-layout:fixed;background-color:#f7f7f7;">
<tr>
<td align="center">

<table border="0" cellpadding="0" cellspacing="0" width="600"
       style="max-width:600px;background-color:#ffffff;">

<tr>
<td style="padding:10px 40px;background-color:#181818;" align="center">
<img src="https://astroshahriar.com/wp-content/uploads/2026/01/logo.png"
     alt="Logo" width="150" style="display:block;height:auto;">
</td>
</tr>

<tr>
<td align="center" style="padding:40px 40px 20px 40px;">

<h2 style="
  font-family:Arial,sans-serif;
  font-size:22px;
  color:#000000;
  margin:0 0 20px 0;
  line-height:32px;
  text-transform:uppercase;
  font-weight:900;
">
Checkout Reminder
</h2>

<p style="font-family:Arial;font-size:14px;color:#000000;text-align:left;">
Hello <strong>${attendance.user.username}</strong>,
</p>

<p style="font-family:Arial;font-size:14px;color:#000000;text-align:left;">
This is to inform you that your checkout has not been completed in the employee portal.<br/>
Please complete the checkout at your convenience.
</p>

</td>
</tr>

<tr>
<td align="center" style="padding:30px 40px;background-color:#181818;">
<img src="https://astroshahriar.com/wp-content/uploads/2026/01/logo.png"
     width="200" style="display:block;margin:0 auto;height:auto;">
</td>
</tr>

</table>
</td>
</tr>
</table>

</body>
</html>
`,
                    });

                    /* =====================================================
                       🕓 SAVE REMINDER TIME (UTC)
                    ===================================================== */
                    await strapi.entityService.update(
                        "api::daily-attendance.daily-attendance",
                        attendance.id,
                        {
                            data: {
                                last_checkout_reminder: new Date().toISOString(),
                            },
                        }
                    );

                    strapi.log.info(
                        `[CheckoutReminder] Reminder sent to ${attendance.user.username}`
                    );
                }
            } catch (error) {
                strapi.log.error("[CheckoutReminder] FAILED");
                strapi.log.error(error);
            }
        },

        /* =====================================================
           ⏱ CRON SCHEDULE
        ===================================================== */
        options: {
            rule: "*/15 * * * *", // every 15 minutes
            tz: "Asia/Kolkata",
        },
    },

}



