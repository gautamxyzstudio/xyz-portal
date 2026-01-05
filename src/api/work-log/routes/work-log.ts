// /**
//  * work-log router
//  */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::work-log.work-log');

// export default factories.createCoreRouter("api::work-log.work-log", {
//   config: {
//     create: { policies: ["global::is-authenticated"] },
//     update: { policies: ["global::is-authenticated"] },
//   },
//   routes: [
//     {
//       method: "POST",
//       path: "/work-logs/today",
//       handler: "work-log.createToday",
//       config: {
//         policies: ["global::is-authenticated"],
//       },
//     },
//   ],
// });
