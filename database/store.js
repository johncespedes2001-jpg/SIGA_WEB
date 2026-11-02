'use strict';

function configuredProvider() {
  return String(process.env.SIGA_STORAGE || 'json').trim().toLowerCase();
}

async function openConfiguredStore() {
  const provider = configuredProvider();
  if (provider === 'mariadb') {
    const { openMariaDbStore } = require('./mariadb-store');
    return openMariaDbStore();
  }
  throw new Error('Esta operación requiere SIGA_STORAGE=mariadb.');
}

module.exports = { configuredProvider, openConfiguredStore };
