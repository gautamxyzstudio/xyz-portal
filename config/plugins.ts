const path = require('path');

module.exports = ({ env }) => ({
  upload: {
    provider: 'local',
    providerOptions: {
      sizeLimit: 1000000, // optional, default is 1MB
    },
    actionOptions: {
      upload: {
        // Set the path to the mounted volume directory
        path: path.join('/data/uploads'),
      },
    },
  },
});
