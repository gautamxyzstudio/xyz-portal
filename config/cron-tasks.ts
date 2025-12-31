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
//   missingCheckoutReminder: {
//   task: async ({ strapi }) => {
//     try {
//       const now = new Date();

//       // 🕡 Only after 6:30 PM IST
//       const grace = new Date();
//       grace.setHours(13, 57, 0, 0);
//       if (now < grace) return;

//       const today = now.toISOString().split('T')[0];

//       const records = await strapi.entityService.findMany(
//         'api::daily-attendance.daily-attendance',
//         {
//           filters: {
//             Date: today,
//             in: { $notNull: true },
//             out: { $null: true },
//             status: 'present',
//           },
//           populate: { user: true },
//         }
//       );

//       if (!records.length) return;

//       // 👥 HR emails
//       const hrRole = await strapi.db
//         .query('plugin::users-permissions.role')
//         .findOne({ where: { name: 'Hr' } });

//       const hrUsers = hrRole
//         ? await strapi.db
//             .query('plugin::users-permissions.user')
//             .findMany({ where: { role: hrRole.id } })
//         : [];

//       const hrEmails = hrUsers.map(u => u.email).filter(Boolean);

//       for (const record of records) {
//         const user = record.user;
//         if (!user?.email) continue;

//         // ⛔ 30-min throttle
//         if (
//           record.last_checkout_reminder &&
//           now.getTime() -
//             new Date(record.last_checkout_reminder).getTime() <
//             30 * 60 * 1000
//         ) {
//           continue;
//         }

//         // 📧 SEND EMAIL
//         await strapi.plugin('email').service('email').send({
//           to: user.email,
//           cc: hrEmails,
//           subject: '⚠️ Checkout Pending Reminder',
//           html: `
//             <p>Hello <b>${user.username}</b>,</p>
//             <p>You have not checked out today.</p>
//             <p><b>Office time:</b> 9:00 AM – 6:00 PM</p>
//             <p>Please checkout immediately.</p>
//             <br/>
//             <p style="font-size:12px;color:gray;">
//               Automated reminder every 30 minutes until checkout.
//             </p>
//           `,
//         });

//         // 📝 Update timestamp
//         await strapi.entityService.update(
//           'api::daily-attendance.daily-attendance',
//           record.id,
//           {
//             data: {
//               last_checkout_reminder: now,
//             },
//           }
//         );
//       }
//     } catch (error) {
//       strapi.log.error('❌ Missing checkout cron failed:', error);
//     }
//   },
//   options: {
//     rule: '*/1 * * * *',
//     tz: 'Asia/Kolkata',
//   },
// },


missingCheckoutReminder: {
  task: async ({ strapi }) => {
    try {
      const now = new Date();
      strapi.log.info(
        `🔥 missingCheckoutReminder STARTED at ${now.toISOString()}`
      );

      // 🕡 Grace time check
      const grace = new Date();
      grace.setHours(1, 57, 0, 0);

      if (now < grace) {
        strapi.log.info(
          `⏳ Skipped — before grace time (${grace.toISOString()})`
        );
        return;
      }

      strapi.log.info('⏰ Passed grace time');

      const today = now.toISOString().split('T')[0];
      strapi.log.info(`📅 Checking attendance for date: ${today}`);

      // 🔍 Fetch records
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

      strapi.log.info(`📊 Pending checkout records found: ${records.length}`);

      if (!records.length) {
        strapi.log.info('ℹ️ No pending checkout users. Exiting.');
        return;
      }

      // 👥 Fetch HR emails
      const hrRole = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({ where: { name: 'Hr' } });

      if (!hrRole) {
        strapi.log.warn('⚠️ HR role not found');
      }

      const hrUsers = hrRole
        ? await strapi.db
            .query('plugin::users-permissions.user')
            .findMany({ where: { role: hrRole.id } })
        : [];

      const hrEmails = hrUsers.map(u => u.email).filter(Boolean);
      strapi.log.info(`👥 HR emails: ${JSON.stringify(hrEmails)}`);

      // 📧 Send emails
      for (const record of records) {
        const user = record.user;

        if (!user?.email) {
          strapi.log.warn(
            `⚠️ User ${user?.username || 'unknown'} has no email`
          );
          continue;
        }

        // ⛔ Throttle check
        if (
          record.last_checkout_reminder &&
          now.getTime() -
            new Date(record.last_checkout_reminder).getTime() <
            30 * 60 * 1000
        ) {
          strapi.log.info(
            `⛔ Throttled for ${user.email} (last reminder too recent)`
          );
          continue;
        }

        strapi.log.info(`📧 Sending checkout reminder to ${user.email}`);

        await strapi.plugin('email').service('email').send({
          to: user.email,
          cc: hrEmails,
          subject: '⚠️ Checkout Pending Reminder',
          html: `
            <p>Hello <b>${user.username}</b>,</p>
            <p>You have not checked out today.</p>
            <p><b>Office time:</b> 9:00 AM – 6:00 PM</p>
            <p>Please checkout immediately.</p>
          `,
        });

        strapi.log.info(`✅ Email sent to ${user.email}`);

        // 📝 Update reminder timestamp
        await strapi.entityService.update(
          'api::daily-attendance.daily-attendance',
          record.id,
          {
            data: {
              last_checkout_reminder: now,
            },
          }
        );

        strapi.log.info(
          `📝 Updated last_checkout_reminder for record ${record.id}`
        );
      }
    } catch (error) {
      strapi.log.error(
        '❌ Missing checkout cron failed:',
        error
      );
    }
  },

  options: {
    rule: '*/1 * * * *', // every minute (TEST)
    tz: 'Asia/Kolkata',
  },
},

  /* =========================================================
     📢 EMPLOYEE ANNOUNCEMENTS
  ========================================================= */

  employeeAnnouncements: {
    task: async ({ strapi }) => {
      try {
        const now = new Date();

        // ⛔ Before 5 AM → do nothing
        if (now.getHours() < 5) return;

        const todayISO = now.toISOString().split('T')[0];
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const startOfDay = new Date(`${todayISO}T00:00:00.000Z`);
        const endOfDay = new Date(`${todayISO}T23:59:59.999Z`);

        /* ============================
           🎉 JOINING (ON USER CREATION)
        ============================ */

        const newJoiners = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              joining_announced: false,
              joining_date: { $between: [startOfDay, endOfDay] },
            },
            limit: 10,
          });

        for (const user of newJoiners) {
          await strapi.entityService.create(
            'api::announcement.announcement',
            {
              data: {
                Title: '🎉 New Employee Joined',
                Description: `Please welcome <b>${user.username}</b> to the team!`,
                Date: now,
                publishedAt: new Date(),
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
        /* ============================
           🎂 BIRTHDAY (date_of_birth)
        ============================ */

        const birthdayUsers = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              date_of_birth: { $notNull: true },
            },
          });

        const birthdayNames = birthdayUsers
          .filter(user => {
            const dob = new Date(user.date_of_birth);
            return (
              dob.getDate() === day &&
              dob.getMonth() + 1 === month
            );
          })
          .map(user => user.username);

        if (birthdayNames.length > 0) {
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
                  publishedAt: new Date(),
                },
              }
            );

            strapi.log.info(
              `🎂 Birthday announcement created for: ${birthdayNames.join(', ')}`
            );
          }
        }

        /* ============================
   🎊 ANNIVERSARY (ONLY IF EXISTS)
============================ */

        const anniversaryUsers = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: { joining_date: { $notNull: true } },
          });

        const anniversaryPeople = anniversaryUsers
          .map(user => {
            const joinDate = new Date(user.joining_date);

            // calculate completed years safely
            let yearsCompleted = year - joinDate.getFullYear();
            if (
              month < joinDate.getMonth() + 1 ||
              (
                month === joinDate.getMonth() + 1 &&
                day < joinDate.getDate()
              )
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

        if (anniversaryPeople.length > 0) {
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
                  )}</b> for completing <b>${anniversaryPeople.length === 1
                      ? anniversaryPeople[0].match(/\d+/)[0]
                      : 'their'
                    } years with us</b>!`,
                  Date: now,
                  publishedAt: new Date(),
                },
              }
            );

            strapi.log.info(
              `🎊 Anniversary announcement created for ${anniversaryPeople.join(', ')}`
            );
          }
        }


        return { success: true };
      } catch (error) {
        strapi.log.error('❌ Error in employeeAnnouncements cron:', error);
        return { success: false, error: error.message };
      }
    },
    options: {
      rule: '*/1 * * * *', // every minute (after 5 AM it behaves like event)
      tz: 'Asia/Kolkata',
    },
  },
};
