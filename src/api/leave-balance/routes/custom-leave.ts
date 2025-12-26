export default {
  routes: [
    {
      method: 'GET',
      path: '/leave-balance/me',
      handler: 'leave-balance.myBalance',
    },
    {
      method: 'GET',
      path: '/leave-balance/all',
      handler: 'leave-balance.allBalances',
    },
  ],
};
