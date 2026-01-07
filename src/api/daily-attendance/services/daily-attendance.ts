/**
 * daily-attendance service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService(
  'api::daily-attendance.daily-attendance',
  ({ strapi }) => ({

    /* =====================================================
      MARK ABSENT USERS (END OF DAY CRON)
    ===================================================== */
    async markAbsentUsers() {
      try {
        const today = new Date().toISOString().split('T')[0];

        const absentEntries = await strapi.entityService.findMany(
          'api::daily-attendance.daily-attendance',
          {
            filters: {
              Date: today,
              in: { $null: true },          // no check-in
              status: { $ne: 'leave' },     // skip leave
            },
            populate: {
              user: true,
            },
          }
        );

        const updated = [];

        for (const entry of absentEntries) {
          // 🚫 Skip Admin / HR
          if (
            entry.user?.user_type === 'Admin' ||
            entry.user?.user_type === 'Hr'
          ) {
            continue;
          }

          const updatedEntry = await strapi.entityService.update(
            'api::daily-attendance.daily-attendance',
            entry.id,
            {
              data: {
                status: 'absent',
                notes: entry.notes
                  ? `${entry.notes} | Marked absent (no check-in)`
                  : 'Marked absent (no check-in)',
              },
            }
          );

          updated.push({
            id: updatedEntry.id,
            user: entry.user?.id,
          });
        }

        return {
          success: true,
          date: today,
          totalAbsent: updated.length,
          updated,
        };
      } catch (error) {
        strapi.log.error('❌ markAbsentUsers failed:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    },

  })
);
