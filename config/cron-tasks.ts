
module.exports = {
  /* =========================================================
     🕕 DAILY ATTENDANCE 
  ========================================================= */
  markAbsentUsers: {
    task: async ({ strapi }) => {
      try {
        const getISTDate = (): string => {
          return new Date(
            new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
          )
            .toISOString()
            .slice(0, 10);
        };

        const today = getISTDate();
        strapi.log.info(`🕙 Mark Absent Cron Started for ${today}`);

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
          // 1️⃣ Check existing attendance
          const existingAttendance = await strapi.entityService.findMany(
            'api::daily-attendance.daily-attendance',
            {
              filters: { user: user.id, Date: today },
              limit: 1,
            }
          );

          if (existingAttendance.length) continue;

          // 2️⃣ Check approved leave
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

          // 3️⃣ Create absent record
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

        strapi.log.info('✅ Mark Absent Cron Completed');
      } catch (error) {
        strapi.log.error('❌ markAbsentUsers cron failed:', error);
      }
    },

    options: {
      rule: '0 22 * * *', // 10 PM IST
      tz: 'Asia/Kolkata',
    },
  },


  /* =========================================================
     🥗 LUNCH BREAK – AUTO STOP TASK TIMERS (1 PM IST)
  ========================================================= */
  lunchBreakStopTaskTimers: {
    task: async ({ strapi }) => {
      try {
        const now = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
        );

        strapi.log.info('🥗 Lunch break cron started – stopping task timers');

        const workLogs = await strapi.entityService.findMany(
          'api::work-log.work-log',
          {
            fields: ['id', 'tasks'],
          }
        );

        for (const workLog of workLogs) {
          const tasks = workLog.tasks || [];
          let changed = false;

          for (const task of tasks) {
            const lastSession =
              Array.isArray(task.sessions) && task.sessions.length
                ? task.sessions[task.sessions.length - 1]
                : null;

            if (lastSession && !lastSession.end) {
              lastSession.end = now.toISOString();
              lastSession.duration = Math.floor(
                (now.getTime() - new Date(lastSession.start).getTime()) / 1000
              );
              changed = true;
            }
          }

          if (changed) {
            await strapi.entityService.update(
              'api::work-log.work-log',
              workLog.id,
              {
                data: {
                  tasks,
                  active_task_id: null,
                },
              }
            );
          }
        }

        strapi.log.info('✅ Lunch break cron completed');
      } catch (error) {
        strapi.log.error('❌ Lunch break cron failed:', error);
      }
    },

    options: {
      rule: '0 13 * * *', // ⏰ 1:00 PM IST
      tz: 'Asia/Kolkata',
    },
  },

  /* =========================================================
      CHECKOUT REMINDER
  ========================================================= */

  // missingCheckoutReminder: {
  //   task: async ({ strapi }) => {
  //     try {
  //       strapi.log.info('🔥 missingCheckoutReminder STARTED');

  //       const istNow = new Date(
  //         new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  //       );

  //       const minutesNow =
  //         istNow.getHours() * 60 + istNow.getMinutes();

  //       // ✅ 6:30 PM IST
  //       if (minutesNow < 15 * 60 + 15) {
  //         strapi.log.info('⏳ Before 6:30 PM IST, skipping');
  //         return;
  //       }

  //       const today = istNow.toISOString().slice(0, 10);

  //       const records = await strapi.entityService.findMany(
  //         'api::daily-attendance.daily-attendance',
  //         {
  //           filters: {
  //             Date: today,
  //             in: { $notNull: true },
  //             status: 'present',
  //             out: '00:00:00.000',
  //           },
  //           populate: { user: true },
  //         }
  //       );

  //       if (!records.length) return;

  //       const hrUsers = await strapi.entityService.findMany(
  //         'plugin::users-permissions.user',
  //         {
  //           filters: { user_type: 'Hr' },
  //           fields: ['email'],
  //         }
  //       );

  //       const hrEmails = hrUsers.map(u => u.email).filter(Boolean);

  //       for (const record of records) {
  //         const user = record.user;
  //         if (!user?.email) continue;

  //         if (
  //           record.last_checkout_reminder &&
  //           istNow.getTime() -
  //             new Date(record.last_checkout_reminder).getTime() <
  //             30 * 60 * 1000
  //         ) {
  //           continue;
  //         }

  //         await strapi.plugin('email').service('email').send({
  //           to: user.email,
  //           cc: hrEmails.filter(e => e !== user.email),
  //           subject: '⚠️ Checkout Pending – Action Required',
  //           html: `
  //             <p>Dear <b>${user.username}</b>,</p>
  //             <p>You have <b>not checked out</b> today.</p>
  //             <p>Please complete checkout immediately.</p>
  //           `,
  //         });

  //         await strapi.entityService.update(
  //           'api::daily-attendance.daily-attendance',
  //           record.id,
  //           {
  //             data: { last_checkout_reminder: istNow },
  //           }
  //         );
  //       }
  //     } catch (error) {
  //       strapi.log.error('❌ Missing checkout cron failed:', error);
  //     }
  //   },

  //   options: {
  //     rule: '*/15 * * * *',
  //     tz: 'Asia/Kolkata',
  //   },
  // },


  /* =========================================================
   📢 EMPLOYEE ANNOUNCEMENTS
  ========================================================= */

  joiningAnnouncementCron: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        if (now.getHours() < 5) return;

        const todayISO = now.toISOString().split('T')[0];
        const startOfDay = new Date(`${todayISO}T00:00:00.000Z`);
        const endOfDay = new Date(`${todayISO}T23:59:59.999Z`);

        const newJoiners = await strapi.entityService.findMany(
          'api::emp-detail.emp-detail',
          {
            filters: {
              joining_announced: false,
              joinig_date: { $between: [startOfDay, endOfDay] },
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
                Date: now,
                publishedAt: now,
              },
            }
          );

          await strapi.entityService.update(
            'api::emp-detail.emp-detail',
            emp.id,
            { data: { joining_announced: true } }
          );

          strapi.log.info(`🎉 Joining announcement for ${emp.user_detail.username}`);
        }
      } catch (error) {
        strapi.log.error('❌ Error in joiningAnnouncementCron:', error);
      }
    },
    options: {
      rule: '*/2 * * * *',
      tz: 'Asia/Kolkata',
    },
  },


  // /* ===================================================
  //          🎂 BIRTHDAY (ONLY IF EXISTS)
  //       =================================================== */

  birthdayAnnouncementCron: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        const todayISO = now.toISOString().split('T')[0];
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
            const dob = new Date(emp.date_of_birth);
            return dob.getDate() === day && dob.getMonth() + 1 === month;
          })
          .map(emp => emp.user_detail.username);

        if (!birthdayNames.length) return;

        const exists = await strapi.entityService.findOne(
          'api::announcement.announcement',
          {
            filters: {
              Title: 'Happy Birthday!',
              Date: todayISO,
            },
          }
        );

        if (!exists) {
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
        }
      } catch (error) {
        strapi.log.error('❌ Error in birthdayAnnouncementCron:', error);
      }
    },
    options: {
      rule: '0 5 * * *',
      tz: 'Asia/Kolkata',
    },
  },



  // /* ===================================================
  //    🎊 WORK ANNIVERSARY (ONLY IF EXISTS)
  // =================================================== */

  anniversaryAnnouncementCron: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        const todayISO = now.toISOString().split('T')[0];
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const employees = await strapi.entityService.findMany(
          'api::emp-detail.emp-detail',
          {
            filters: { joinig_date: { $notNull: true } },
            populate: { user_detail: true },
          }
        );

        const anniversaryPeople = employees
          .map(emp => {
            if (!emp.user_detail) return null;

            const joinDate = new Date(emp.joinig_date);
            let years = year - joinDate.getFullYear();

            if (
              month < joinDate.getMonth() + 1 ||
              (month === joinDate.getMonth() + 1 && day < joinDate.getDate())
            ) {
              years--;
            }

            if (
              joinDate.getDate() === day &&
              joinDate.getMonth() + 1 === month &&
              years > 0
            ) {
              return `${emp.user_detail.username} (${years} ${years === 1 ? 'year' : 'years'})`;
            }

            return null;
          })
          .filter(Boolean);

        if (!anniversaryPeople.length) return;

        const exists = await strapi.entityService.findOne(
          'api::announcement.announcement',
          {
            filters: {
              Title: 'Work Anniversary',
              Date: todayISO,
            },
          }
        );

        if (!exists) {
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
        }
      } catch (error) {
        strapi.log.error('❌ Error in anniversaryAnnouncementCron:', error);
      }
    },
    options: {
      rule: '0 5 * * *',
      tz: 'Asia/Kolkata',
    },
  },


  // /* ===================================================================
  //     🗑 DELETE JOINING , BIRTHDAY AND ANIVERSARY ANNOUNCEMENT AT 5 AM 
  //   =================================================================== */

  announcementCleanupCron: {
    task: async ({ strapi }) => {
      try {
        /* ==========================================
           📅 Start of Today (IST)
        ========================================== */
        const todayIST = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
        );
        todayIST.setHours(0, 0, 0, 0);

        /* ==========================================
           🗑 Delete ONLY system announcements
        ========================================== */
        const oldAnnouncements = await strapi.entityService.findMany(
          'api::announcement.announcement',
          {
            filters: {
              Title: {
                $in: [
                  'Happy Birthday!',
                  'Work Anniversary',
                  'New Employee Joined',
                ],
              },
              createdAt: { $lt: todayIST },
            },
            fields: ['id', 'Title'],
            limit: 300,
          }
        );

        if (!oldAnnouncements.length) return;

        for (const a of oldAnnouncements) {
          await strapi.entityService.delete(
            'api::announcement.announcement',
            a.id
          );
        }

        strapi.log.info(
          `🗑 Auto-deleted ${oldAnnouncements.length} system announcements`
        );
      } catch (error) {
        strapi.log.error('❌ Error in announcementCleanupCron:', error);
      }
    },
    options: {
      rule: '30 5 * * *', // ⏰ 5:10 AM IST (after creation)
      tz: 'Asia/Kolkata',
    },
  },


};
