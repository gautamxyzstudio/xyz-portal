"use strict";
/**
 * daily-attendance service
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreService('api::daily-attendance.daily-attendance', ({ strapi }) => ({
    // Create attendance entries for all active users at start of day
    async createDailyAttendanceEntries() {
        try {
            const today = new Date().toISOString().split('T')[0];
            // Get all active users (not blocked) excluding Admin and Hr roles
            const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: {
                    blocked: false,
                    confirmed: true,
                    user_type: {
                        $notIn: ['Admin', 'Hr'],
                    },
                },
                populate: {
                    user_detial: true,
                },
            });
            const createdEntries = [];
            const errors = [];
            for (const user of users) {
                try {
                    // Check if attendance entry already exists for today
                    const existingEntry = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
                        filters: {
                            user: {
                                id: user.id,
                            },
                            Date: today,
                        },
                    });
                    if (existingEntry.length === 0) {
                        // Create new attendance entry with default status as 'absent'
                        const attendanceEntry = await strapi.entityService.create('api::daily-attendance.daily-attendance', {
                            data: {
                                user: user.id,
                                Date: today,
                                status: 'absent',
                                notes: 'Auto-generated entry - awaiting check-in',
                            },
                        });
                        createdEntries.push({
                            userId: user.id,
                            username: user.username,
                            entryId: attendanceEntry.id,
                        });
                    }
                }
                catch (error) {
                    errors.push({
                        userId: user.id,
                        username: user.username,
                        error: error.message,
                    });
                }
            }
            return {
                success: true,
                createdEntries,
                errors,
                totalUsers: users.length,
                date: today,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    },
    // Mark users as absent who didn't check in by end of day
    async markAbsentUsers() {
        var _a;
        try {
            const today = new Date().toISOString().split('T')[0];
            // Find all attendance entries for today that are still marked as 'absent'
            const absentEntries = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
                filters: {
                    Date: today,
                    status: 'absent',
                },
                populate: {
                    user: {
                        populate: {
                            user_detial: true,
                        },
                    },
                },
            });
            const updatedEntries = [];
            const errors = [];
            for (const entry of absentEntries) {
                try {
                    // Update status to 'absent' and add note
                    const updatedEntry = await strapi.entityService.update('api::daily-attendance.daily-attendance', entry.id, {
                        data: {
                            status: 'absent',
                            notes: entry.notes
                                ? `${entry.notes} - Marked absent at end of day`
                                : 'Marked absent at end of day - no check-in recorded',
                        },
                    });
                    updatedEntries.push({
                        entryId: entry.id,
                        userId: entry.user.id,
                        username: entry.user.username,
                    });
                }
                catch (error) {
                    errors.push({
                        entryId: entry.id,
                        userId: (_a = entry.user) === null || _a === void 0 ? void 0 : _a.id,
                        error: error.message,
                    });
                }
            }
            return {
                success: true,
                updatedEntries,
                errors,
                totalAbsent: absentEntries.length,
                date: today,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    },
    // Update attendance status when user checks in
    async updateStatusOnCheckIn(attendanceId) {
        try {
            const updatedEntry = await strapi.entityService.update('api::daily-attendance.daily-attendance', attendanceId, {
                data: {
                    status: 'present',
                    notes: 'User checked in successfully',
                },
            });
            return {
                success: true,
                entry: updatedEntry,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    },
    // Get attendance statistics for a date range
    async getAttendanceStats(startDate, endDate) {
        try {
            const entries = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
                filters: {
                    Date: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
                populate: {
                    user: {
                        populate: {
                            user_detial: true,
                        },
                    },
                },
            });
            const stats = {
                total: entries.length,
                present: entries.filter((e) => e.status === 'present').length,
                absent: entries.filter((e) => e.status === 'absent').length,
                late: entries.filter((e) => e.status === 'late').length,
                halfDay: entries.filter((e) => e.status === 'half-day').length,
                leave: entries.filter((e) => e.status === 'leave').length,
            };
            return {
                success: true,
                stats,
                entries,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    },
}));
