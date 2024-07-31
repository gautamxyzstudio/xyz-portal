module.exports = ({ env }) => ({
    upload: {
        config: {
            provider: 'local',
            providerOptions: {
                sizeLimit: 1000000, // Maximum file size in bytes
            },
            actionOptions: {
                upload: {},
                delete: {},
            },
        },
    },
});
