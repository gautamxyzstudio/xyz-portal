module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/users/:user_type',
      handler: 'user.find',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/user/:id',
      handler: 'user.findSingleUser',
      config: {
        policies: [],
      },
    },
  ],
};
