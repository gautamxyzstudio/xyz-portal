export default [
  'strapi::logger',
  'strapi::errors',

  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://portal.xyz.studio',
        'https://xyzportal.thexyzstudio.com',
        'https://www.xyz.studio',
        'https://xyz.studio',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  },

  'strapi::security',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

