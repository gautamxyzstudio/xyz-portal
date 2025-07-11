module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/leave-status/:id/approve',
            handler: 'custom-controller.approve',
        },
        {
            method: 'POST',
            path: '/leave-status/:id/reject',
            handler: 'custom-controller.reject',
        },
        {
            method: 'GET',
            path: '/leave-status/all',
            handler: 'custom-controller.all',
        },
    ],
};
