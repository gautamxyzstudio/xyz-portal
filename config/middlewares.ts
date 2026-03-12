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

   {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "https://storage.googleapis.com",
            "https://mozart-app.s3.ap-southeast-2.amazonaws.com",
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "https://storage.googleapis.com",
            "https://mozart-app.s3.ap-southeast-2.amazonaws.com",
          ],
        },
      },
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

