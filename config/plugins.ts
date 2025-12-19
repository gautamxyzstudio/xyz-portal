const path = require('path');

module.exports = ({ env }) => ({
  // upload: {
  //   provider: 'local',
  //   providerOptions: {
  //     sizeLimit: 10000000, // optional, default is 10MB
  //   },
  //   actionOptions: {
  //     upload: {
  //       // Set the path using an environment variable
  //       path: env('UPLOAD_PATH', path.join('/data/uploads')),
  //     },
  //   },
  // },

  
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
          keyFilename: path.resolve(process.cwd(), "config/Keys/gcs-key.json"),
        },

        // Disable sharp thumbnails (Windows fix)
        breakpoints: {},
        imageManipulation: {
          enabled: false,
        },
      },
    },
});
