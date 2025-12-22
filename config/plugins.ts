const path = require('path');

module.exports = ({ env }) => ({
  upload: {
    provider: 'local',
    providerOptions: {
      sizeLimit: 10000000,
    },
    actionOptions: {
      upload: {
        path: env('UPLOAD_PATH', path.join('/data/uploads')),
      },
    },
  },

  email: {
    config: {
      provider: "nodemailer",   // ✔ Official Strapi SMTP provider
      providerOptions: {
        host: env("SMTP_HOST", "smtp-relay.brevo.com"),
        port: env.int("SMTP_PORT", 587),
        secure: false,
        auth: {
          user: env("SMTP_USERNAME"),
          pass: env("SMTP_PASSWORD"),
        },
      },
      settings: {
        defaultFrom: env("SMTP_FROM_EMAIL"),
        defaultReplyTo: env("SMTP_REPLYTO_EMAIL"),
      },
    },
  },
});
