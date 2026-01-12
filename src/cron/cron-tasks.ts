module.exports = {

    /* =========================================================
       🕕 DAILY ATTENDANCE 
    ========================================================= */
    markAbsentUsers: {
        task: async ({ strapi }) => {
            try {
                const getISTDate = () => {
                    return new Date(
                        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
                    )
                        .toISOString()
                        .slice(0, 10);
                };

                const today = getISTDate();

                const users = await strapi.entityService.findMany(
                    'plugin::users-permissions.user',
                    {
                        filters: {
                            user_type: { $notIn: ['Admin', 'Hr'] },
                            blocked: false,
                        },
                        fields: ['id'],
                    }
                );

                for (const user of users) {
                    const existingAttendance = await strapi.entityService.findMany(
                        'api::daily-attendance.daily-attendance',
                        {
                            filters: { user: user.id, Date: today },
                            limit: 1,
                        }
                    );

                    if (existingAttendance.length) continue;

                    const leave = await strapi.entityService.findMany(
                        'api::leave-status.leave-status',
                        {
                            filters: {
                                user: user.id,
                                status: 'approved',
                                start_date: { $lte: today },
                                end_date: { $gte: today },
                            },
                            limit: 1,
                        }
                    );

                    if (leave.length) continue;

                    await strapi.entityService.create(
                        'api::daily-attendance.daily-attendance',
                        {
                            data: {
                                user: user.id,
                                Date: today,
                                status: 'absent',
                                out: '00:00:00.000',
                                publishedAt: new Date(),
                            },
                        }
                    );
                }
            } catch (error) {
                strapi.log.error('❌ markAbsentUsers cron failed:', error);
            }
        },
        options: {
            rule: '0 22 * * *',
            tz: 'Asia/Kolkata',
        },
    },

    /* =========================================================
  📢 EMPLOYEE ANNOUNCEMENTS
 ========================================================= */

    joiningAnnouncementCron: {
        task: async ({ strapi }) => {
            try {
                /* ==========================================
                   🔔 CRON TRIGGER LOG
                ========================================== */
                strapi.log.info('➡️ Joining announcement cron triggered');

                /* ==========================================
                   🕰 IST DATE (SAFE)
                ========================================== */
                const nowIST = new Date(
                    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
                );

                // YYYY-MM-DD (REQUIRED for type: "date")
                const todayIST = nowIST.toISOString().slice(0, 10);

                strapi.log.info(`📅 IST Today: ${todayIST}`);

                /* ==========================================
                   🔍 FIND NEW JOINED EMPLOYEES
                ========================================== */
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

                strapi.log.info(`👀 New joiners found: ${newJoiners.length}`);

                /* ==========================================
                   🎉 CREATE ANNOUNCEMENTS
                ========================================== */
                for (const emp of newJoiners) {
                    if (!emp.user_detail) {
                        strapi.log.warn(`⚠️ Emp ${emp.id} has no linked user`);
                        continue;
                    }

                    await strapi.entityService.create(
                        'api::announcement.announcement',
                        {
                            data: {
                                Title: 'New Employee Joined',
                                Description: `Please welcome <b>${emp.user_detail.username}</b> to the team!`,
                                Date: todayIST,
                                publishedAt: nowIST
                            },
                        }
                    );

                    await strapi.entityService.update(
                        'api::emp-detail.emp-detail',
                        emp.id,
                        {
                            data: { joining_announced: true },
                        }
                    );

                    strapi.log.info(
                        `🎉 Announcement created for ${emp.user_detail.username}`
                    );
                }
            } catch (error) {
                strapi.log.error('❌ Error in joiningAnnouncementCron:', error);
            }
        },

        options: {
            rule: '*/10 * * * *', // ⏱ every 5 minutes
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

                strapi.log.info(
                    `🎂 Birthday cron running for ${day}-${month}`
                );

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

                        // ✅ SAFE DATE COMPARISON (NO JS Date conversion)
                        const [_, dobMonth, dobDay] = emp.date_of_birth
                            .split('-')
                            .map(Number);

                        return dobDay === day && dobMonth === month;
                    })
                    .map(emp => emp.user_detail.username);

                strapi.log.info(
                    `🎯 Birthdays today: ${birthdayNames.length}`
                );

                if (!birthdayNames.length) return;

                // ✅ Prevent duplicate for TODAY
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

                if (exists.length) {
                    strapi.log.info('⛔ Birthday announcement already exists today');
                    return;
                }

                await strapi.entityService.create(
                    'api::announcement.announcement',
                    {
                        data: {
                            Title: 'Happy Birthday!',
                            Description: `🎉 Wishing a very happy birthday to <b>${birthdayNames.join(
                                ', '
                            )}</b>!`,
                            Date: now,
                            publishedAt: now,
                        },
                    }
                );

                strapi.log.info('🎉 Birthday announcement CREATED');
            } catch (error) {
                strapi.log.error('❌ birthdayAnnouncementCron failed:', error);
            }
        },

        options: {
            rule: '10 7 * * *', // your schedule
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
                        const joinDate = new Date(emp.joinig_date);
                        let years = year - joinDate.getFullYear();

                        if (
                            month < joinDate.getMonth() + 1 ||
                            (month === joinDate.getMonth() + 1 &&
                                day < joinDate.getDate())
                        ) {
                            years--;
                        }

                        return joinDate.getDate() === day &&
                            joinDate.getMonth() + 1 === month &&
                            years > 0
                            ? `${emp.user_detail.username} (${years} ${years === 1 ? 'year' : 'years'
                            })`
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
                            Description: `🎉 Congratulations to <b>${anniversaryPeople.join(
                                ', '
                            )}</b> for completing their years with us!`,
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

                if (hour < 13 || hour >= 14) return;

                const today = now.toISOString().slice(0, 10);

                /* ===== FETCH TODAY WORK LOGS ===== */
                const workLogs = await strapi.entityService.findMany(
                    "api::work-log.work-log",
                    {
                        filters: { work_date: today },
                        populate: { user: true },
                        limit: -1,
                    }
                );

                for (const log of workLogs) {
                    let changed = false;

                    for (const task of log.tasks || []) {
                        if (task.is_running && task.last_started_at) {
                            const elapsed = Math.floor(
                                (now.getTime() -
                                    new Date(task.last_started_at).getTime()) /
                                1000
                            );

                            task.time_spent = (task.time_spent || 0) + elapsed;
                            task.is_running = false;
                            task.last_started_at = null;
                            changed = true;
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

                console.log("✅ Lunch auto-pause executed");
            } catch (err) {
                console.error("❌ Lunch auto-pause failed", err);
            }
        },
        options: {
            rule: "*/5 * * * *",
            tz: 'Asia/Kolkata',
        },
    },

    /* ======================================
       CHECKOUT REMINDER 
       ========================================= */

    checkoutReminder: {
        task: async ({ strapi }) => {
            try {
                const istNow = new Date(
                    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
                );

                const hours = istNow.getHours();
                const minutes = istNow.getMinutes();
                const today = istNow.toISOString().slice(0, 10);

                strapi.log.info(
                    `[CheckoutReminder] Cron running at ${istNow.toLocaleTimeString("en-IN")}`
                );

                /* ================= TIME GATE ================= */

                if (hours < 18 || (hours === 18 && minutes < 15)) return;

                /* ================= ACTIVE ATTENDANCE ================= */
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

                /* ================= HR USERS ================= */
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

                /* ================= SEND REMINDERS ================= */
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
                        to: userEmail,   // employee
                        cc: hrEmails,    // HR
                        subject: "Checkout Reminder – Working After Office Hours",
                        html: `<p>Dear <b>${attendance.user.username}</b></p>

<p>This is to inform you that your checkout has not been completed in the employee portal. <br/>
Please complete the checkout at your convenience. </p>

`,
                    });

                    await strapi.entityService.update(
                        "api::daily-attendance.daily-attendance",
                        attendance.id,
                        {
                            data: {
                                last_checkout_reminder: istNow,
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
        options: {
            rule: "*/15 * * * *",
            tz: "Asia/Kolkata",
        },
    },


}



