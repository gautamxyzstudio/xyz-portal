"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    async findAll(ctx) {
        const { page = 1, pageSize = 10 } = ctx.query;
        const attendance = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
            start: (page - 1) * pageSize,
            limit: pageSize,
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
        });
        const total = await strapi.entityService.count('api::daily-attendance.daily-attendance');
        ctx.body = {
            data: attendance,
            meta: {
                pagination: {
                    page: Number(page),
                    pageSize: Number(pageSize),
                    pageCount: Math.ceil(total / pageSize),
                    total,
                },
            },
        };
        return ctx.body;
    },
    async find(ctx) {
        const { id } = ctx.params;
        const attendance = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
            filters: {
                user: id,
            },
        });
        ctx.body = attendance;
        return attendance;
    },
    async findToday(ctx) {
        const { id } = ctx.params;
        const attendance = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
            filters: {
                Date: new Date().toISOString().split('T')[0],
                user: id,
            },
        });
        ctx.body = attendance;
        return attendance;
    },
    async checkIn(ctx) {
        const { user, date, in: inTime } = ctx.request.body.data;
        console.log('Incoming data request:', ctx.request.body);
        // First check if attendance entry exists for today
        const today = date || new Date().toISOString().split('T')[0];
        const existingEntry = await strapi.entityService.findMany('api::daily-attendance.daily-attendance', {
            filters: {
                user: user,
                Date: today,
            },
        });
        let attendance;
        if (existingEntry.length > 0) {
            // Update existing entry
            attendance = await strapi.entityService.update('api::daily-attendance.daily-attendance', existingEntry[0].id, {
                data: {
                    in: inTime,
                    status: 'present',
                    notes: 'User checked in successfully',
                },
            });
        }
        else {
            // Create new entry
            attendance = await strapi.entityService.create('api::daily-attendance.daily-attendance', {
                data: {
                    user: user,
                    Date: today,
                    in: inTime,
                    status: 'present',
                    notes: 'User checked in successfully',
                },
            });
        }
        console.log('Attendance Response:', attendance);
        ctx.body = attendance;
        return attendance;
    },
    async checkOut(ctx) {
        const { id, out } = ctx.request.body.data;
        if (!id || !out) {
            return ctx.badRequest('Missing required fields: user or out');
        }
        const attendance = await strapi.entityService.update('api::daily-attendance.daily-attendance', id, {
            data: {
                out,
                notes: 'User checked out successfully',
            },
        });
        ctx.body = attendance;
        return attendance;
    },
    async updateAttendance(ctx) {
        const { id, out: outTime, in: inTime, status, notes, } = ctx.request.body.data;
        const attendance = await strapi.entityService.update('api::daily-attendance.daily-attendance', id, {
            data: {
                out: outTime,
                in: inTime,
                status: status,
                notes: notes,
            },
        });
        ctx.body = attendance;
        return attendance;
    },
    // Cron job endpoints
    async createDailyEntries(ctx) {
        try {
            const result = await strapi
                .service('api::daily-attendance.daily-attendance')
                .createDailyAttendanceEntries();
            ctx.body = result;
            return result;
        }
        catch (error) {
            ctx.throw(500, error.message);
        }
    },
    async markAbsentUsers(ctx) {
        try {
            const result = await strapi
                .service('api::daily-attendance.daily-attendance')
                .markAbsentUsers();
            ctx.body = result;
            return result;
        }
        catch (error) {
            ctx.throw(500, error.message);
        }
    },
    async getAttendanceStats(ctx) {
        try {
            const { startDate, endDate } = ctx.query;
            if (!startDate || !endDate) {
                return ctx.badRequest('Missing required parameters: startDate and endDate');
            }
            const result = await strapi
                .service('api::daily-attendance.daily-attendance')
                .getAttendanceStats(startDate, endDate);
            ctx.body = result;
            return result;
        }
        catch (error) {
            ctx.throw(500, error.message);
        }
    },
    // Manual trigger for testing
    async triggerDailyCron(ctx) {
        try {
            // Create daily entries
            const createResult = await strapi
                .service('api::daily-attendance.daily-attendance')
                .createDailyAttendanceEntries();
            ctx.body = {
                message: 'Daily cron job triggered successfully',
                createEntries: createResult,
                timestamp: new Date().toISOString(),
            };
            return ctx.body;
        }
        catch (error) {
            ctx.throw(500, error.message);
        }
    },
    // Manual trigger for end of day processing
    async triggerEndOfDayCron(ctx) {
        try {
            // Mark absent users
            const markAbsentResult = await strapi
                .service('api::daily-attendance.daily-attendance')
                .markAbsentUsers();
            ctx.body = {
                message: 'End of day cron job triggered successfully',
                markAbsent: markAbsentResult,
                timestamp: new Date().toISOString(),
            };
            return ctx.body;
        }
        catch (error) {
            ctx.throw(500, error.message);
        }
    },
};
