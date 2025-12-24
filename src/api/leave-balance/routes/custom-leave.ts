export default {
  routes: [
    {
      method: 'GET',
      path: '/leave-balances/me',
      handler: 'leave-balance.myBalance',
      config: {
        policies: [],
      },
    },
  ],
};
