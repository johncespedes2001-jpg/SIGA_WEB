'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { connectionOptions } = require('./mariadb-store');

async function main() {
  const {
    waitForConnections: _waitForConnections,
    connectionLimit: _connectionLimit,
    queueLimit: _queueLimit,
    ...baseOptions
  } = connectionOptions();
  const options = { ...baseOptions, multipleStatements: true };
  const connection = await mysql.createConnection(options);
  try {
    for (const filename of ['02-schema.sql', '03-relational-schema.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, 'mariadb', filename), 'utf8');
      await connection.query(sql);
    }
    const [tables] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    `);
    const [views] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM information_schema.views
      WHERE table_schema = DATABASE()
    `);
    console.log(JSON.stringify({
      check: 'SIGA - esquema relacional MariaDB',
      status: Number(tables[0].total) >= 28 && Number(views[0].total) >= 2 ? 'OK' : 'REVISAR',
      tables: Number(tables[0].total),
      views: Number(views[0].total),
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`INSTALACIÓN MARIADB NO COMPLETADA: ${error.message}`);
  process.exitCode = 1;
});
