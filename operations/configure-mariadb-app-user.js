'use strict';

const mysql = require('mysql2/promise');

function identifier(value, label) {
  const text = String(value || '').trim();
  if (!/^[a-zA-Z0-9_]+$/.test(text)) throw new Error(`${label} solo puede contener letras, números y guion bajo.`);
  return `\`${text}\``;
}

function accountPart(value, label) {
  const text = String(value || '').trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(text)) throw new Error(`${label} contiene caracteres no permitidos.`);
  return text;
}

async function main() {
  const database = accountPart(process.env.SIGA_MARIADB_DATABASE || 'siga', 'SIGA_MARIADB_DATABASE');
  const appUser = accountPart(process.env.SIGA_MARIADB_APP_USER || 'siga_app', 'SIGA_MARIADB_APP_USER');
  const appPassword = String(process.env.SIGA_MARIADB_APP_PASSWORD || '');
  if (appPassword.length < 20) throw new Error('SIGA_MARIADB_APP_PASSWORD debe tener al menos 20 caracteres.');
  const connection = await mysql.createConnection({
    host: process.env.SIGA_MARIADB_ADMIN_HOST || '127.0.0.1',
    port: Number(process.env.SIGA_MARIADB_ADMIN_PORT || 3306),
    user: process.env.SIGA_MARIADB_ADMIN_USER || 'root',
    password: process.env.SIGA_MARIADB_ADMIN_PASSWORD || '',
  });
  try {
    const escapedPassword = connection.escape(appPassword);
    for (const host of ['127.0.0.1', 'localhost']) {
      const account = `'${appUser}'@'${host}'`;
      await connection.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${escapedPassword}`);
      await connection.query(`ALTER USER ${account} IDENTIFIED BY ${escapedPassword}`);
      await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${identifier(database, 'base de datos')}.* TO ${account}`);
    }
    await connection.query('FLUSH PRIVILEGES');
    console.log(JSON.stringify({ check: 'Usuario MariaDB de SIGA', status: 'OK', user: appUser, privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`No se pudo configurar el usuario MariaDB de SIGA: ${error.message}`);
  process.exitCode = 1;
});
