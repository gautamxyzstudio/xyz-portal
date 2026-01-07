
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
                Title: 'New Employee Joined',
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
              Title: 'Happy Birthday!',
              Date: todayISO,
            },
          });

        if (!exists) {
          await strapi.entityService.create(
            'api::announcement.announcement',
            {
              data: {
                Title: 'Happy Birthday!',
                Description: `🎉 &nbsp; Wishing a very happy birthday to <b>${birthdayNames.join(
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
              Title: 'Work Anniversary',
              Date: todayISO,
            },
          });

        if (!exists) {
          await strapi.entityService.create(
            'api::announcement.announcement',
            {
              data: {
                Title: 'Work Anniversary',
                Description: `🎉 &nbsp; Congratulations to <b>${anniversaryPeople.join(
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
              Title: { $in: ['Happy Birthday!', 'Work Anniversary'] },
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
              Title: 'New Employee Joined',
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
