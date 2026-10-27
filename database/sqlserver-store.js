'use strict';

const sql = require('mssql');

function booleanFromEnvironment(name, fallback) {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(value);
}

function connectionOptions() {
  const connectionString = String(process.env.SIGA_SQL_CONNECTION_STRING || '').trim();
  if (connectionString) {
    if (process.env.NODE_ENV === 'production') {
      const encrypted = /(?:^|;)\s*Encrypt\s*=\s*(?:true|yes|mandatory|strict)\s*(?:;|$)/i.test(connectionString);
      const validatesCertificate = /(?:^|;)\s*TrustServerCertificate\s*=\s*(?:false|no)\s*(?:;|$)/i.test(connectionString);
      if (!encrypted || !validatesCertificate) throw new Error('En producción, SIGA_SQL_CONNECTION_STRING debe usar Encrypt=true y TrustServerCertificate=false.');
    }
    return connectionString;
  }

  const server = String(process.env.SIGA_SQL_SERVER || '').trim();
  const user = String(process.env.SIGA_SQL_USER || '').trim();
  const password = String(process.env.SIGA_SQL_PASSWORD || '');
  if (!server) throw new Error('Defina SIGA_SQL_SERVER o SIGA_SQL_CONNECTION_STRING para usar SQL Server.');
  if (!user || !password) throw new Error('Defina SIGA_SQL_USER y SIGA_SQL_PASSWORD. No coloque credenciales dentro del código.');

  const port = Number(process.env.SIGA_SQL_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SIGA_SQL_PORT no es válido.');

  return {
    server,
    port,
    database: String(process.env.SIGA_SQL_DATABASE || 'SIGA').trim(),
    user,
    password,
    connectionTimeout: 15000,
    requestTimeout: 30000,
    pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
    options: {
      // La conexión institucional debe cifrarse y validar la identidad de SQL Server.
      // El desarrollo local puede cambiarlo explícitamente en .env cuando todavía
      // no dispone de un certificado emitido por una autoridad confiable.
      encrypt: booleanFromEnvironment('SIGA_SQL_ENCRYPT', true),
      trustServerCertificate: booleanFromEnvironment('SIGA_SQL_TRUST_CERTIFICATE', false),
      enableArithAbort: true,
    },
  };
}

async function ensureCompatibilityTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.EstadoAplicacion', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.EstadoAplicacion (
        EstadoAplicacionId tinyint NOT NULL CONSTRAINT PK_EstadoAplicacion PRIMARY KEY,
        VersionEsquema int NOT NULL,
        DatosJson nvarchar(max) NOT NULL,
        FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_EstadoAplicacion_FechaActualizacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_EstadoAplicacion_Unico CHECK (EstadoAplicacionId = 1),
        CONSTRAINT CK_EstadoAplicacion_Json CHECK (ISJSON(DatosJson) = 1)
      );
    END;
  `);
}

async function openSqlServerStore() {
  const pool = await new sql.ConnectionPool(connectionOptions()).connect();
  await ensureCompatibilityTable(pool);
  let loadedRevision = null;
  let relationalSyncAvailable = null;
  const relationalSyncRequired = booleanFromEnvironment('SIGA_REQUIRE_RELATIONAL_SYNC', false);

  return {
    async load() {
      const result = await pool.request()
        .input('stateId', sql.TinyInt, 1)
        .query('SELECT DatosJson, FechaActualizacion FROM dbo.EstadoAplicacion WHERE EstadoAplicacionId = @stateId;');
      if (!result.recordset.length) {
        loadedRevision = null;
        return null;
      }
      loadedRevision = result.recordset[0].FechaActualizacion;
      return JSON.parse(result.recordset[0].DatosJson);
    },

    async save(database) {
      const payload = JSON.stringify(database);
      const schemaVersion = Number(database.schemaVersion || 1);
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        if (relationalSyncAvailable !== false) {
          try {
            await new sql.Request(transaction)
              .input('payload', sql.NVarChar(sql.MAX), payload)
              .query('EXEC dbo.SincronizarEstadoRelacional @DatosJson = @payload;');
            relationalSyncAvailable = true;
          } catch (error) {
            if (!relationalSyncRequired && [229, 2812].includes(Number(error.number))) {
              relationalSyncAvailable = false;
              console.warn('Sincronización relacional pendiente: ejecute db:setup y db:configure-app con una cuenta administradora.');
            } else {
              throw error;
            }
          }
        }
        const request = new sql.Request(transaction)
          .input('stateId', sql.TinyInt, 1)
          .input('schemaVersion', sql.Int, schemaVersion)
          .input('payload', sql.NVarChar(sql.MAX), payload);
        let result;
        if (loadedRevision) {
          result = await request
            .input('expectedRevision', sql.DateTime2(3), loadedRevision)
            .query(`
              UPDATE dbo.EstadoAplicacion WITH (UPDLOCK)
                SET VersionEsquema = @schemaVersion,
                    DatosJson = @payload,
                    FechaActualizacion = DATEADD(millisecond, 1,
                      CASE WHEN SYSUTCDATETIME() > FechaActualizacion
                        THEN SYSUTCDATETIME() ELSE FechaActualizacion END)
                OUTPUT inserted.FechaActualizacion
                WHERE EstadoAplicacionId = @stateId
                  AND FechaActualizacion = @expectedRevision;
            `);
          if (!result.recordset.length) {
            const conflict = new Error('Los datos fueron modificados por otra instancia. Recargue la página y vuelva a intentarlo.');
            conflict.code = 'SIGA_WRITE_CONFLICT';
            throw conflict;
          }
        } else {
          result = await request.query(`
            INSERT dbo.EstadoAplicacion (EstadoAplicacionId, VersionEsquema, DatosJson)
              OUTPUT inserted.FechaActualizacion
              VALUES (@stateId, @schemaVersion, @payload);
          `);
        }
        const nextRevision = result.recordset[0].FechaActualizacion;
        await transaction.commit();
        loadedRevision = nextRevision;
      } catch (error) {
        await transaction.rollback().catch(() => {});
        throw error;
      }
    },

    async close() {
      await pool.close();
    },
  };
}

module.exports = { openSqlServerStore };
