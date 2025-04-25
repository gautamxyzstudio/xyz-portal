module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/daily-attendance/all',
            handler: 'daily-attendance.findAll',
        },
        {
            method: 'GET',
            path: '/daily-attendance/:id',
            handler: 'daily-attendance.find',
        },
        {
            method: 'GET',
            path: '/daily-attendance/today/:id',
            handler: 'daily-attendance.findToday',
        },
        {
            method: 'POST',
            path: '/daily-attendance/check-in',
            handler: 'daily-attendance.checkIn',
        },
        {
            method: 'POST',
            path: '/daily-attendance/check-out',
            handler: 'daily-attendance.checkOut',
        },
        {
            method: 'PUT',
            path: '/daily-attendance/update-attendance',
            handler: 'daily-attendance.updateAttendance',
        },
    ],
};
