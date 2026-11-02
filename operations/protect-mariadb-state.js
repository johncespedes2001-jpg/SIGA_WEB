'use strict';

const { dataEncryptionKey } = require('../database/data-protection');
const { openMariaDbStore } = require('../database/mariadb-store');

async function main() {
  dataEncryptionKey(true);
  const store = await openMariaDbStore();
  try {
    const state = await store.load();
    if (!state) throw new Error('MariaDB no contiene un estado SIGA para proteger.');
    await store.save(state);
    console.log(JSON.stringify({ check: 'Protección de datos MariaDB', status: 'OK', schemaVersion: Number(state.schemaVersion || 1), encrypted: true }, null, 2));
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  console.error(`PROTECCIÓN MARIADB NO COMPLETADA: ${error.message}`);
  process.exitCode = 1;
});
