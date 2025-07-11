"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cronTasks = require('./cron-tasks');
exports.default = ({ env }) => ({
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    app: {
        keys: env.array('APP_KEYS'),
    },
    webhooks: {
        populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
    },
    cron: {
        enabled: true,
        tasks: cronTasks,
    },
});
