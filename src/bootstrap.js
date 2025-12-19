'use strict';

const fixGoogleCloudFolder = require('./fix-google-cloud-folder');

module.exports = async ({ strapi }) => {
  await fixGoogleCloudFolder(strapi);
};
