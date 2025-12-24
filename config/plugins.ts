const path = require('path');

module.exports = ({ env }) => ({
    upload: {
  config: {
    provider: path.resolve(
      process.cwd(),
      "src/providers/upload-google-cloud-storage"
    ),
    providerOptions: {
      baseUrl: env("MEDIA_BASE_URL"),
      projectId: env("GCS_PROJECT_ID"),
      bucket: env("GCS_BUCKET_NAME"),
      keyFilename: path.resolve(
        process.cwd(),
        "config/Keys/gcs-key.json"
      ),
    },

    // 🔴 FULLY disable Sharp & thumbnails (Windows fix)
    breakpoints:{},
    responsiveDimensions: false,
  },
},

// ==========================
  // EMAIL
  // ==========================
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

  
  // ==========================
  // 🚫 DISABLE DOCUMENTATION
  // ==========================
  documentation: {
    enabled: false,
  },
});
