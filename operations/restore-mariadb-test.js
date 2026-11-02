'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { databaseConfiguration, commandCandidate, commonArguments, run } = require('./mariadb-cli');
const { dataEncryptionKey, unprotectJson } = require('../database/data-protection');

function argument(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function latestBackup(directory) {
  if (!fs.existsSync(directory)) return '';
  return fs.readdirSync(directory)
    .filter((name) => /^SIGA-MariaDB-.*\.sql$/.test(name))
    .map((name) => ({ name, time: fs.statSync(path.join(directory, name)).mtimeMs }))
    .sort((left, right) => right.time - left.time)
    .map((entry) => path.join(directory, entry.name))[0] || '';
}

async function main() {
  const configuration = databaseConfiguration();
  if (!configuration.user) throw new Error('Defina SIGA_MARIADB_USER antes de probar la restauración.');
  const project = path.resolve(__dirname, '..');
  const directory = path.resolve(argument('directory', path.join(project, 'backups', 'mariadb')));
  const backup = path.resolve(argument('backup', latestBackup(directory)) || '');
  if (!backup || !fs.existsSync(backup)) throw new Error('No se encontró un respaldo MariaDB para restaurar.');
  const testDatabase = `siga_restore_${crypto.randomBytes(6).toString('hex')}`;
  const client = commandCandidate('client');
  const base = commonArguments(configuration);
  const execute = (sql, database) => run(client, [...base, '--batch', '--skip-column-names', '--execute', sql, ...(database ? [database] : [])], { password: configuration.password });
  let result;
  try {
    await execute(`CREATE DATABASE \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await run(client, [...base, testDatabase], { password: configuration.password, input: fs.createReadStream(backup) });
    const verification = await execute(`
      SELECT CONCAT(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'), '|',
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='VIEW'), '|',
        (SELECT COUNT(*) FROM estado_aplicacion), '|',
        (SELECT COALESCE(SUM(JSON_VALID(datos_json)),0) FROM estado_aplicacion)
      );`, testDatabase);
    const [tables, views, states, validJson] = verification.stdout.trim().split('|').map(Number);
    if (tables < 28 || views < 2 || states !== 1 || validJson !== 1) {
      throw new Error(`Restauración incompleta: tablas=${tables}, vistas=${views}, estados=${states}, JSON válido=${validJson}.`);
    }
    const mysql = require('mysql2/promise');
    const restored = await mysql.createConnection({
      host: configuration.host,
      port: Number(configuration.port),
      user: configuration.user,
      password: configuration.password,
      database: testDatabase,
    });
    let logicalState;
    try {
      const [payloadRows] = await restored.query('SELECT datos_json FROM estado_aplicacion WHERE estado_aplicacion_id = 1');
      const payload = Buffer.isBuffer(payloadRows[0]?.datos_json) ? payloadRows[0].datos_json.toString('utf8') : String(payloadRows[0]?.datos_json || '');
      const envelope = JSON.parse(payload);
      if (dataEncryptionKey(false) && envelope?.sigaEncrypted !== 1) throw new Error('El respaldo restaurado contiene el estado SIGA sin cifrar.');
      logicalState = unprotectJson(payload);
    } finally {
      await restored.end();
    }
    if (!logicalState || !Number.isInteger(Number(logicalState.schemaVersion))) throw new Error('El respaldo se restauró, pero el estado lógico cifrado no pudo validarse.');
    result = { status: 'OK', verifiedAt: new Date().toISOString(), backup, restoredDatabase: testDatabase, tables, views, states, validJson, schemaVersion: Number(logicalState.schemaVersion), encryptionVerified: true };
  } finally {
    await execute(`DROP DATABASE IF EXISTS \`${testDatabase}\`;`).catch(() => {});
  }
  result.cleanup = 'COMPLETADA';
  const verificationFile = path.join(directory, 'restore-verification.json');
  fs.writeFileSync(verificationFile, JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...result, verificationFile }, null, 2));
}

main().catch((error) => { console.error(`PRUEBA DE RESTAURACIÓN MARIADB NO COMPLETADA: ${error.message}`); process.exitCode = 1; });
