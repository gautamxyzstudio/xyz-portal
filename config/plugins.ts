module.exports = ({ env }) => ({
  upload: {
    provider: 'local',
    providerOptions: {
      sizeLimit: 1000000, // optional, default is 1MB
    },
    actionOptions: {
      upload: {
        folder: env('UPLOAD_PATH'),
      },
    },
  },
});
