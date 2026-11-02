'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { configuredProvider, openConfiguredStore } = require('../database/store');
const { connectionOptions: mariaDbConnectionOptions } = require('../database/mariadb-store');
const { inspectMariaDbRelational } = require('../database/mariadb-integrity');
const { inspectLogicalState } = require('./audit-database');

const requiredInstitutionalValues = [
  'SIGA_LEGAL_NAME', 'SIGA_LEGAL_ADDRESS', 'SIGA_PRIVACY_EMAIL',
  'SIGA_RETENTION_NOTICE', 'SIGA_DATA_RECIPIENTS',
];

async function main() {
  const errors = [];
  const provider = configuredProvider();
  for (const key of requiredInstitutionalValues) {
    if (!String(process.env[key] || '').trim()) errors.push(`${key} no está configurado.`);
  }
  if (provider !== 'mariadb') {
    errors.push('SIGA_STORAGE debe ser mariadb.');
    console.log(JSON.stringify({
      check: 'SIGA - autorización previa para datos oficiales',
      generatedAt: new Date().toISOString(),
      database: '',
      status: 'NO_AUTORIZADO',
      errors,
    }, null, 2));
    process.exitCode = 2;
    return;
  }
  if (String(process.env.SIGA_MARIADB_USER || '').trim().toLowerCase() === 'root') errors.push('SIGA_MARIADB_USER no puede ser root para cargar datos oficiales.');
    try {
      require('../database/data-protection').dataEncryptionKey(true);
    } catch (error) {
      errors.push(error.message);
    }
    const restoreProofPath = path.resolve(process.env.SIGA_MARIADB_RESTORE_PROOF || path.join(__dirname, '..', 'backups', 'mariadb', 'restore-verification.json'));
    try {
      const proof = JSON.parse(fs.readFileSync(restoreProofPath, 'utf8'));
      const age = Date.now() - new Date(proof.verifiedAt).getTime();
      if (proof.status !== 'OK' || proof.cleanup !== 'COMPLETADA' || proof.encryptionVerified !== true || !Number.isFinite(age) || age < 0 || age > 30 * 24 * 60 * 60 * 1000) {
        errors.push('La prueba de restauración MariaDB no es válida o tiene más de 30 días.');
      }
    } catch {
      errors.push('No existe un comprobante reciente de restauración MariaDB. Ejecute db:mariadb-restore-test.');
    }
    const store = await openConfiguredStore();
    try {
      const database = await store.load();
      if (!database) errors.push('MariaDB no contiene el estado institucional de SIGA.');
      if (database) {
        const logical = inspectLogicalState(database);
        errors.push(...logical.errors);
        const mysql = require('mysql2/promise');
        const pool = mysql.createPool(mariaDbConnectionOptions());
        try {
          const relational = await inspectMariaDbRelational(pool, database);
          for (const item of relational.mismatches) errors.push(`${item.table} no coincide: esperado ${item.expected}, actual ${item.actual}.`);
          for (const [name, total] of Object.entries(relational.orphans)) if (total > 0) errors.push(`${name} debe ser 0 y actualmente es ${total}.`);
          if (relational.schema.tablesFound < 28) errors.push(`MariaDB debe contener 28 tablas y actualmente contiene ${relational.schema.tablesFound}.`);
          if (relational.schema.viewsFound < 2) errors.push(`MariaDB debe contener 2 vistas y actualmente contiene ${relational.schema.viewsFound}.`);
        } finally {
          await pool.end();
        }
        const controlled = new Set(['admin@siga.edu.pe', 'coordinador@siga.edu.pe', 'docente@siga.edu.pe', 'padre@siga.edu.pe', 'vigilante@siga.edu.pe', 'estudiante@siga.edu.pe', 'prueba.qr@siga.edu.pe']);
        const controlledAccounts = (database.accounts || []).filter((item) => controlled.has(String(item.email || '').trim().toLowerCase()));
        if (controlledAccounts.length) errors.push(`Permanecen ${controlledAccounts.length} cuenta(s) de prueba o control.`);
      }
      const report = {
        check: 'SIGA - autorización previa para datos oficiales',
        generatedAt: new Date().toISOString(),
        database: process.env.SIGA_MARIADB_DATABASE || 'siga',
        provider: 'mariadb',
        status: errors.length ? 'NO_AUTORIZADO' : 'AUTORIZADO',
        errors,
      };
      console.log(JSON.stringify(report, null, 2));
      if (errors.length) process.exitCode = 2;
    } finally {
      await store.close();
    }
}

main().catch((error) => {
  console.error(`PREVALIDACIÓN NO COMPLETADA: ${error.message}`);
  process.exitCode = 1;
});

