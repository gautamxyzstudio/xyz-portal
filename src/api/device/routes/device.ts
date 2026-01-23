export default {
  routes: [
    // CRUD
    { method: 'POST', path: '/devices', handler: 'device.create' },
    { method: 'GET', path: '/devices', handler: 'device.find' },
    { method: 'GET', path: '/devices/:id', handler: 'device.findOne' },
    { method: 'PUT', path: '/devices/:id', handler: 'device.update' },
    { method: 'DELETE', path: '/devices/:id', handler: 'device.delete' },

    // Custom
    { method: 'PUT', path: '/devices/:id/assign', handler: 'device.assignDevice' },
    { method: 'GET', path: '/devices/my', handler: 'device.myDevices' },
  ],
};
