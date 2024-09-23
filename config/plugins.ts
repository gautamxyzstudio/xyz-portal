const path = require('path');

module.exports = ({ env }) => ({
  upload: {
    provider: 'local',
    providerOptions: {
      sizeLimit: 10000000, // optional, default is 10MB
    },
    actionOptions: {
      upload: {
        // Set the path using an environment variable
        path: env('UPLOAD_PATH', path.join('/data/uploads')),
      },
    },
  },
});
