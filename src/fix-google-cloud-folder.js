'use strict';

module.exports = async (strapi) => {
  try {
    strapi.log.info('🔧 Fixing google-cloud folder mismatch...');

    // Find google-cloud folder
    const folder = await strapi.query('plugin::upload.folder').findOne({
      where: { name: 'google-cloud' },
    });

    if (!folder) {
      strapi.log.error('❌ google-cloud folder not found');
      return;
    }

    strapi.log.info(`✅ Folder ID: ${folder.id}`);

    // Fix ALL files that belong to this folder
    const files = await strapi.query('plugin::upload.file').findMany({
      where: {
        folderPath: '/1', // numeric path
      },
    });

    if (!files.length) {
      strapi.log.info('ℹ️ No files found with folderPath /2');
      return;
    }

    strapi.log.info(`🔁 Updating ${files.length} file(s)...`);

    for (const file of files) {
      await strapi.query('plugin::upload.file').update({
        where: { id: file.id },
        data: {
          folder: 2,        // 🔥 MUST MATCH
          folderPath: '/1', // 🔥 MUST MATCH
        },
      });
    }

    strapi.log.info('🎉 google-cloud folder mismatch fixed!');
  } catch (err) {
    strapi.log.error('❌ Error fixing folder mismatch:', err);
  }
};
