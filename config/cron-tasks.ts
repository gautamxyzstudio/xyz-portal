module.exports = {
  /* =========================================================
     🕕 DAILY ATTENDANCE 
  ========================================================= */

  createDailyAttendance: {
    task: async ({ strapi }) => {
      try {
        strapi.log.info('🕕 Starting daily attendance entries creation...');
        const result = await strapi
          .service('api::daily-attendance.daily-attendance')
          .createDailyAttendanceEntries();
        return result;
      } catch (error) {
        strapi.log.error('❌ Error in createDailyAttendance cron:', error);
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '0 6 * * *',
      tz: 'Asia/Kolkata',
    },
  },

  markAbsentUsers: {
    task: async ({ strapi }) => {
      try {
        return await strapi
          .service('api::daily-attendance.daily-attendance')
          .markAbsentUsers();
      } catch (error) {
        strapi.log.error('❌ Error in markAbsentUsers cron:', error);
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '0 22 * * *',
      tz: 'Asia/Kolkata',
    },
  },

  weeklyAttendanceReport: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        const end = new Date(now);
        end.setDate(now.getDate() - 1);

        return await strapi
          .service('api::daily-attendance.daily-attendance')
          .getAttendanceStats(
            start.toISOString().split('T')[0],
            end.toISOString().split('T')[0]
          );
      } catch (error) {
        strapi.log.error('❌ Error in weeklyAttendanceReport cron:', error);
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '0 7 * * 1',
      tz: 'Asia/Kolkata',
    },
  },

  /* =========================================================
      CHECKOUT REMINDER
  ========================================================= */

  missingCheckoutReminder: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        strapi.log.info('🔥 missingCheckoutReminder STARTED');

        /* =====================================================
           ⏰ Allow only after 6:30 PM IST
        ===================================================== */
        const minutesNow = now.getHours() * 60 + now.getMinutes();
        if (minutesNow < 18 * 60 + 0) {
          strapi.log.info('⏳ Before 6:30 PM, skipping');
          return;
        }

        const today = now.toISOString().split('T')[0];

        /* =====================================================
           📋 Users who checked in but NOT checked out
        ===================================================== */
        const records = await strapi.entityService.findMany(
          'api::daily-attendance.daily-attendance',
          {
            filters: {
              Date: today,
              in: { $notNull: true },
              out: { $null: true },
              status: 'present',
            },
            populate: { user: true },
          }
        );

        strapi.log.info(`📊 Pending checkout users: ${records.length}`);
        if (!records.length) return;

        /* =====================================================
           👥 FETCH ONLY HR (USING user_type)
        ===================================================== */
        const hrUsers = await strapi.entityService.findMany(
          'plugin::users-permissions.user',
          {
            filters: {
              user_type: 'Hr',   // ✅ ONLY DIMPLE MATCHES
            },
            fields: ['email', 'username'],
          }
        );

        const hrEmails = hrUsers.map(u => u.email).filter(Boolean);
        strapi.log.info(`👥 HR emails (FINAL): ${JSON.stringify(hrEmails)}`);

        /* =====================================================
           📧 Send email (employee + HR)
        ===================================================== */
        for (const record of records) {
          const user = record.user;
          if (!user?.email) continue;

          // ⛔ 30-minute throttle
          if (
            record.last_checkout_reminder &&
            now.getTime() -
            new Date(record.last_checkout_reminder).getTime() <
            30 * 60 * 1000
          ) {
            strapi.log.info(`⛔ Throttled for ${user.email}`);
            continue;
          }

          // ❌ Prevent duplicate if HR forgets checkout
          const ccHr = hrEmails.filter(email => email !== user.email);

          await strapi.plugin('email').service('email').send({
            to: user.email,      // 👤 employee
            cc: ccHr,            // 👥 ONLY HR (dimple)
            subject: '⚠️ Checkout Pending – Action Required',
            html: `
            <p>Dear <b>${user.username}</b>,</p>

            <p>You have <b>not checked out</b> today.</p>

            <p><b>Office time:</b> 9:00 AM – 6:00 PM</p>

            <p>Please complete your checkout immediately.</p>

            <br/>
            <p style="font-size:12px;color:gray;">
              Automated reminder sent every 30 minutes after 6:30 PM
              until checkout.
            </p>
          `,
          });

          await strapi.entityService.update(
            'api::daily-attendance.daily-attendance',
            record.id,
            {
              data: { last_checkout_reminder: now },
            }
          );

          strapi.log.info(`✅ Reminder sent to ${user.email}`);
        }
      } catch (error) {
        strapi.log.error('❌ Missing checkout cron failed:', error);
      }
    },

    /* =====================================================
       🔁 Run every 30 minutes
    ===================================================== */
    options: {
      rule: '*/30 * * * *',
      tz: 'Asia/Kolkata',
    },
  },



  /* =========================================================
     📢 EMPLOYEE ANNOUNCEMENTS
  ========================================================= */


  /* ===================================================
      🎉 NEW EMPLOYEE JOINED 
    =================================================== */

  joiningAnnouncementCron: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();

        if (now.getHours() < 5) return;

        const todayISO = now.toISOString().split('T')[0];
        const startOfDay = new Date(`${todayISO}T00:00:00.000Z`);
        const endOfDay = new Date(`${todayISO}T23:59:59.999Z`);

        const newJoiners = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              joining_announced: false,
              joining_date: { $between: [startOfDay, endOfDay] },
            },
          });

        for (const user of newJoiners) {
          await strapi.entityService.create(
            'api::announcement.announcement',
            {
              data: {
                Title: '🎉 New Employee Joined',
                Description: `Please welcome <b>${user.username}</b> to the team!`,
                Date: now,
                publishedAt: now,
              },
            }
          );

          await strapi.db
            .query('plugin::users-permissions.user')
            .update({
              where: { id: user.id },
              data: { joining_announced: true },
            });

          strapi.log.info(`🎉 Joining announcement for ${user.username}`);
        }
      } catch (error) {
        strapi.log.error('❌ Error in joiningAnnouncementCron:', error);
      }
    },
    options: {
      rule: '*/2 * * * *', // ⏱ every 2 minutes
      tz: 'Asia/Kolkata',
    },
  },

  /* ===================================================
           🎂 BIRTHDAY (ONLY IF EXISTS)
        =================================================== */

  birthdayAnnouncementCron: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        const todayISO = now.toISOString().split('T')[0];
        const day = now.getDate();
        const month = now.getMonth() + 1;

        const birthdayUsers = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: { date_of_birth: { $notNull: true } },
          });

        const birthdayNames = birthdayUsers
          .filter(user => {
            const dob = new Date(user.date_of_birth);
            return dob.getDate() === day && dob.getMonth() + 1 === month;
          })
          .map(user => user.username);

        if (birthdayNames.length === 0) return;

        const exists = await strapi.db
          .query('api::announcement.announcement')
          .findOne({
            where: {
              Title: '🎂 Happy Birthday!',
              Date: todayISO,
            },
          });

        if (!exists) {
          await strapi.entityService.create(
            'api::announcement.announcement',
            {
              data: {
                Title: '🎂 Happy Birthday!',
                Description: `🎉 Wishing a very happy birthday to <b>${birthdayNames.join(
                  ', '
                )}</b>!`,
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
      rule: '0 5 * * *', // ⏰ 5 AM daily
      tz: 'Asia/Kolkata',
    },
  },


  /* ===================================================
     🎊 WORK ANNIVERSARY (ONLY IF EXISTS)
  =================================================== */

  anniversaryAnnouncementCron: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();
        const todayISO = now.toISOString().split('T')[0];
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const anniversaryUsers = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: { joining_date: { $notNull: true } },
          });

        const anniversaryPeople = anniversaryUsers
          .map(user => {
            const joinDate = new Date(user.joining_date);
            let yearsCompleted = year - joinDate.getFullYear();

            if (
              month < joinDate.getMonth() + 1 ||
              (month === joinDate.getMonth() + 1 &&
                day < joinDate.getDate())
            ) {
              yearsCompleted--;
            }

            if (
              joinDate.getDate() === day &&
              joinDate.getMonth() + 1 === month &&
              yearsCompleted > 0
            ) {
              return `${user.username} (${yearsCompleted} ${yearsCompleted === 1 ? 'year' : 'years'
                })`;
            }
            return null;
          })
          .filter(Boolean);

        if (anniversaryPeople.length === 0) return;

        const exists = await strapi.db
          .query('api::announcement.announcement')
          .findOne({
            where: {
              Title: '🎊 Work Anniversary',
              Date: todayISO,
            },
          });

        if (!exists) {
          await strapi.entityService.create(
            'api::announcement.announcement',
            {
              data: {
                Title: '🎊 Work Anniversary',
                Description: `🎉 Congratulations to <b>${anniversaryPeople.join(
                  ', '
                )}</b> for completing <b>their years with us</b>!`,
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
      rule: '0 5 * * *', // ⏰ 5 AM daily
      tz: 'Asia/Kolkata',
    },
  },

  /* ===================================================================
      🗑 DELETE JOINING , BIRTHDAY AND ANIVERSARY ANNOUNCEMENT AT 5 AM 
    =================================================================== */

  announcementCleanupCron: {
    task: async ({ strapi }) => {
      try {
        const todayISO = new Date().toISOString().split('T')[0];

        const twentyFourHoursAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        );

        const old24hAnnouncements = await strapi.entityService.findMany(
          'api::announcement.announcement',
          {
            filters: {
              Title: { $in: ['🎂 Happy Birthday!', '🎊 Work Anniversary'] },
              publishedAt: { $lt: twentyFourHoursAgo },
            },
            limit: 100,
          }
        );

        for (const a of old24hAnnouncements) {
          await strapi.entityService.delete(
            'api::announcement.announcement',
            a.id
          );
        }

        const oldJoiningAnnouncements = await strapi.entityService.findMany(
          'api::announcement.announcement',
          {
            filters: {
              Title: '🎉 New Employee Joined',
              Date: { $lt: todayISO },
            },
            limit: 100,
          }
        );

        for (const a of oldJoiningAnnouncements) {
          await strapi.entityService.delete(
            'api::announcement.announcement',
            a.id
          );
        }
      } catch (error) {
        strapi.log.error('❌ Error in announcementCleanupCron:', error);
      }
    },
    options: {
      rule: '0 4 * * *', // ⏰ 4 AM daily
      tz: 'Asia/Kolkata',
    },
  },

};
