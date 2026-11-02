'use strict';

const { projectRelationalState, syncRelationalProjection } = require('./mariadb-relational-sync');
const { dataEncryptionKey, protectJson, unprotectJson } = require('./data-protection');

let mysqlPromise;
try {
  mysqlPromise = require('mysql2/promise');
} catch (error) {
  error.message = `Falta el controlador MariaDB/MySQL. Ejecute "npm install mysql2" antes de usar SIGA_STORAGE=mariadb. ${error.message}`;
  throw error;
}

function booleanFromEnvironment(name, fallback) {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(value);
}

function positiveIntegerFromEnvironment(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} debe ser un entero positivo.`);
  return value;
}

function connectionOptions() {
  const host = String(process.env.SIGA_MARIADB_HOST || '127.0.0.1').trim();
  const database = String(process.env.SIGA_MARIADB_DATABASE || 'siga').trim();
  const user = String(process.env.SIGA_MARIADB_USER || '').trim();
  const password = String(process.env.SIGA_MARIADB_PASSWORD || '');
  const port = Number(process.env.SIGA_MARIADB_PORT || 3306);
  if (!host || !database || !user) throw new Error('Defina SIGA_MARIADB_HOST, SIGA_MARIADB_DATABASE y SIGA_MARIADB_USER.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SIGA_MARIADB_PORT no es válido.');
  if (process.env.NODE_ENV === 'production' && !password) throw new Error('SIGA_MARIADB_PASSWORD es obligatorio en producción.');
  if (process.env.NODE_ENV === 'production' && user.toLowerCase() === 'root') throw new Error('SIGA_MARIADB_USER no puede ser root en producción. Cree un usuario exclusivo con privilegios sobre la base SIGA.');

  const sslEnabled = booleanFromEnvironment('SIGA_MARIADB_SSL', false);
  const ssl = sslEnabled ? {
    rejectUnauthorized: booleanFromEnvironment('SIGA_MARIADB_SSL_REJECT_UNAUTHORIZED', true),
  } : undefined;
  if (ssl && process.env.SIGA_MARIADB_SSL_CA) ssl.ca = String(process.env.SIGA_MARIADB_SSL_CA).replace(/\\n/g, '\n');

  return {
    host,
    port,
    database,
    user,
    password,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: positiveIntegerFromEnvironment('SIGA_MARIADB_POOL_SIZE', 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: true,
    ssl,
  };
}

async function ensureCompatibilityTable(pool) {
  const [existing] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'estado_aplicacion'
  `);
  if (Number(existing[0]?.total || 0) > 0) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estado_aplicacion (
      estado_aplicacion_id TINYINT UNSIGNED NOT NULL,
      version_esquema INT UNSIGNED NOT NULL,
      datos_json LONGTEXT NOT NULL,
      revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
      fecha_actualizacion DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
      PRIMARY KEY (estado_aplicacion_id),
      CONSTRAINT ck_estado_aplicacion_unico CHECK (estado_aplicacion_id = 1),
      CONSTRAINT ck_estado_aplicacion_json CHECK (JSON_VALID(datos_json))
    ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
}

async function openMariaDbStore() {
  const pool = mysqlPromise.createPool(connectionOptions());
  await pool.query('SELECT 1 AS connection_test;');
  await ensureCompatibilityTable(pool);
  let loadedRevision = null;
  let loadedProjection = null;
  const maximumStateBytes = positiveIntegerFromEnvironment('SIGA_MARIADB_MAX_STATE_MB', 64) * 1024 * 1024;
  const slowSaveMilliseconds = positiveIntegerFromEnvironment('SIGA_MARIADB_SLOW_SAVE_MS', 1000);

  return {
    async load() {
      const [rows] = await pool.execute(
        'SELECT datos_json, revision FROM estado_aplicacion WHERE estado_aplicacion_id = ?',
        [1],
      );
      if (!rows.length) {
        loadedRevision = null;
        loadedProjection = null;
        return null;
      }
      loadedRevision = Number(rows[0].revision);
      const payload = Buffer.isBuffer(rows[0].datos_json) ? rows[0].datos_json.toString('utf8') : String(rows[0].datos_json);
      if (Buffer.byteLength(payload, 'utf8') > maximumStateBytes) {
        throw new Error('El estado almacenado supera SIGA_MARIADB_MAX_STATE_MB. Archive información histórica antes de iniciar SIGA.');
      }
      const state = unprotectJson(payload);
      loadedProjection = projectRelationalState(state);
      if (dataEncryptionKey(false)) {
        const [protectedRows] = await pool.query("SELECT correo FROM usuarios LIMIT 1");
        if (protectedRows.length && !String(protectedRows[0].correo || '').startsWith('enc:v1:')) loadedProjection = null;
      }
      return state;
    },

    async save(databaseState) {
      const payload = protectJson(databaseState);
      const payloadBytes = Buffer.byteLength(payload, 'utf8');
      if (payloadBytes > maximumStateBytes) {
        const error = new Error('La operación supera el límite seguro del estado MariaDB. Archive información histórica antes de continuar.');
        error.code = 'SIGA_STATE_TOO_LARGE';
        throw error;
      }
      const schemaVersion = Number(databaseState.schemaVersion || 1);
      const connection = await pool.getConnection();
      const startedAt = Date.now();
      let nextRevision = loadedRevision;
      try {
        await connection.beginTransaction();
        if (loadedRevision === null) {
          try {
            await connection.execute(
              `INSERT INTO estado_aplicacion
                (estado_aplicacion_id, version_esquema, datos_json, revision, fecha_actualizacion)
               VALUES (?, ?, ?, 1, UTC_TIMESTAMP(3))`,
              [1, schemaVersion, payload],
            );
            nextRevision = 1;
          } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') throw error;
            const conflict = new Error('Los datos fueron creados por otra instancia. Recargue la página y vuelva a intentarlo.');
            conflict.code = 'SIGA_WRITE_CONFLICT';
            throw conflict;
          }
        } else {
          const [result] = await connection.execute(
            `UPDATE estado_aplicacion
                SET version_esquema = ?, datos_json = ?, revision = revision + 1,
                    fecha_actualizacion = UTC_TIMESTAMP(3)
              WHERE estado_aplicacion_id = ? AND revision = ?`,
            [schemaVersion, payload, 1, loadedRevision],
          );
          if (result.affectedRows !== 1) {
            const conflict = new Error('Los datos fueron modificados por otra instancia. Recargue la página y vuelva a intentarlo.');
            conflict.code = 'SIGA_WRITE_CONFLICT';
            throw conflict;
          }
          nextRevision = loadedRevision + 1;
        }
        const synchronization = await syncRelationalProjection(connection, databaseState, loadedProjection);
        await connection.commit();
        loadedRevision = nextRevision;
        loadedProjection = synchronization.projected;
        const duration = Date.now() - startedAt;
        if (duration >= slowSaveMilliseconds) {
          console.warn(JSON.stringify({ level: 'warn', event: 'database_slow_save', provider: 'mariadb', durationMs: duration, payloadBytes }));
        }
      } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }
    },

    async rebuildProjection(databaseState) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const synchronization = await syncRelationalProjection(connection, databaseState, null);
        await connection.commit();
        loadedProjection = synchronization.projected;
        return synchronization;
      } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }
    },

    async ping() {
      await pool.query('SELECT 1 AS connection_test;');
    },

    async close() {
      await pool.end();
    },
  };
}

module.exports = { openMariaDbStore, connectionOptions };
