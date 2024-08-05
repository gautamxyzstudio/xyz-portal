const fs = require('fs');
const path = require('path');
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
    // Middleware to log file uploads
    bootstrap: () => {
        const uploadFolder = env('UPLOAD_PATH');
        // Ensure the upload folder exists
        if (!fs.existsSync(uploadFolder)) {
            fs.mkdirSync(uploadFolder, { recursive: true });
        }
        // Log existing files in the upload folder at startup
        const logFiles = () => {
            fs.readdir(uploadFolder, (err, files) => {
                if (err) {
                    console.error('Error reading upload folder:', err);
                }
                else {
                    console.log('Current files in upload folder:', files);
                }
            });
        };
        logFiles();
        // Monitor and log file deletions
        fs.watch(uploadFolder, (eventType, filename) => {
            if (eventType === 'rename' && !fs.existsSync(path.join(uploadFolder, filename))) {
                console.log(`File deleted: ${filename}`);
            }
        });
    },
});
