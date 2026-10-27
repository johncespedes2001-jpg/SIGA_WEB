'use strict';

module.exports = {
  apps: [{
    name: 'siga-web',
    script: './server.js',
    cwd: __dirname + '/..',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    kill_timeout: 15000,
    listen_timeout: 15000,
    time: true,
    env: { NODE_ENV: 'production' },
  }],
};
