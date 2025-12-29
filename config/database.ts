module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', 'strapi'),
      pool: {
        min: 2,
        max: 20,           // ✅ SAFE VALUE
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000,
      },
    },
    debug: false,
  },
});


