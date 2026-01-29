export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
  name: 'strapi::cors',
  config: {
    origin: [
      'http://localhost:5173',
      'https://xyzportal.thexyzstudio.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true,
  },
},
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
