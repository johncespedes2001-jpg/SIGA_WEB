'use strict';

const { connectionOptions } = require('./mariadb-store');
const { inspectMariaDbRelational } = require('./mariadb-integrity');
const { unprotectJson } = require('./data-protection');

async function main() {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool(connectionOptions());
  try {
    const [serverRows] = await pool.query('SELECT VERSION() AS version, DATABASE() AS databaseName, @@character_set_database AS characterSet, @@collation_database AS collationName');
    const [tableRows] = await pool.query(`
      SELECT COUNT(*) AS tablesFound
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'estado_aplicacion'
    `);
    const [schemaRows] = await pool.query(`
      SELECT
        SUM(table_type = 'BASE TABLE') AS tablesFound,
        SUM(table_type = 'VIEW') AS viewsFound
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);
    const [stateRows] = await pool.query(`
      SELECT COUNT(*) AS statesFound,
             COALESCE(MAX(version_esquema), 0) AS schemaVersion,
             COALESCE(MAX(revision), 0) AS revision,
             COALESCE(MAX(JSON_VALID(datos_json)), 1) AS jsonValid
      FROM estado_aplicacion
    `);
    const [payloadRows] = await pool.query('SELECT datos_json FROM estado_aplicacion WHERE estado_aplicacion_id = 1');
    let relational = { status: 'VACIO', mismatches: [], counts: {} };
    if (payloadRows.length) {
      const payload = Buffer.isBuffer(payloadRows[0].datos_json) ? payloadRows[0].datos_json.toString('utf8') : String(payloadRows[0].datos_json);
      relational = await inspectMariaDbRelational(pool, unprotectJson(payload));
    }
    const schemaReady = Number(schemaRows[0].tablesFound) >= 28 && Number(schemaRows[0].viewsFound) >= 2;
    const stateValid = Number(tableRows[0].tablesFound) === 1 && Number(stateRows[0].jsonValid) === 1;
    const report = {
      check: 'SIGA MariaDB local',
      status: schemaReady && stateValid && relational.status !== 'REVISAR' ? 'OK' : 'REVISAR',
      server: serverRows[0],
      schema: { tablesFound: Number(schemaRows[0].tablesFound), viewsFound: Number(schemaRows[0].viewsFound) },
      table: stateRows[0],
      relational,
    };
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'OK') process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`VERIFICACIÓN MARIADB NO COMPLETADA: ${error.message}`);
  process.exitCode = 1;
});
