/**
 * leave-balance router
 */

// import { factories } from '@strapi/strapi';

// export default factories.createCoreRouter(
//   'api::leave-balance.leave-balance' as any
// );


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
