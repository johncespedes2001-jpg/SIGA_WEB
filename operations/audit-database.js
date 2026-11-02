'use strict';

/*
 * Auditoría de solo lectura para la base de datos activa de SIGA.
 * No inserta, actualiza, elimina, sincroniza ni repara información.
 */

const { configuredProvider, openConfiguredStore } = require('../database/store');
const { connectionOptions: mariaDbConnectionOptions } = require('../database/mariadb-store');
const { inspectMariaDbRelational } = require('../database/mariadb-integrity');

function array(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function inspectLogicalState(database) {
  const warnings = [];
  const errors = [];
  const accounts = array(database.accounts);
  const students = array(database.students);
  const staff = array(database.staff);
  const programs = new Set(array(database.programs).map((item) => String(item.name || '').trim()));
  const accountIds = new Set(accounts.map((item) => item.id));
  const studentIds = new Set(students.map((item) => item.id));
  const staffIds = new Set(staff.map((item) => item.id));

  const duplicatedEmails = uniqueValues(accounts.map((item) => item.email)).length !== accounts.filter((item) => String(item.email || '').trim()).length;
  if (duplicatedEmails) errors.push('Hay correos duplicados en el estado lógico.');

  for (const account of accounts) {
    const roles = new Set(array(account.roles).concat(account.role || []).filter(Boolean));
    if (roles.has('tutor') && !roles.has('docente')) errors.push(`La cuenta ${account.id} tiene Tutoría sin rol Docente.`);
    if (account.role === 'estudiante' && account.studentId && !studentIds.has(account.studentId)) errors.push(`La cuenta ${account.id} referencia un estudiante inexistente.`);
    const document = String(account.document || '').trim().toUpperCase();
    if (document && !((account.documentType || 'DNI') === 'DNI' ? /^\d{8}$/.test(document) : /^[A-Z0-9]{9,15}$/.test(document))) errors.push(`La cuenta ${account.id} tiene un documento inválido.`);
  }

  for (const item of staff) {
    if (item.accountId && !accountIds.has(item.accountId)) errors.push(`El personal ${item.id} referencia una cuenta inexistente.`);
    const isInstitutional = ['Administrador', 'Vigilante'].includes(item.role);
    const isEmployabilityTeacher = item.role === 'Docente' && item.program === 'Empleabilidad';
    if (!isInstitutional && !isEmployabilityTeacher && item.program && !programs.has(item.program)) errors.push(`El personal ${item.id} tiene un programa inexistente.`);
    const document = String(item.document || '').trim().toUpperCase();
    if (!((item.documentType || 'DNI') === 'DNI' ? /^\d{8}$/.test(document) : /^[A-Z0-9]{9,15}$/.test(document))) errors.push(`El personal ${item.id} tiene un documento inválido.`);
  }

  for (const student of students) {
    if (student.program && !programs.has(student.program)) errors.push(`El estudiante ${student.id} tiene un programa inexistente.`);
    if (student.tutorId && !staffIds.has(student.tutorId)) warnings.push(`El estudiante ${student.id} conserva un tutor que ya no figura en Personal.`);
    const document = String(student.document || '').trim().toUpperCase();
    if (!((student.documentType || 'DNI') === 'DNI' ? /^\d{8}$/.test(document) : /^[A-Z0-9]{9,15}$/.test(document))) errors.push(`El estudiante ${student.id} tiene un documento inválido.`);
  }

  for (const item of array(database.classes)) {
    if (item.teacherId && !accountIds.has(item.teacherId)) errors.push(`La clase ${item.id} referencia un docente inexistente.`);
    for (const studentId of array(item.studentIds)) if (!studentIds.has(studentId)) errors.push(`La clase ${item.id} contiene una matrícula inexistente.`);
  }

  for (const entry of array(database.guardAccessEntries)) {
    if (entry.studentId && !studentIds.has(entry.studentId)) errors.push(`El acceso ${entry.id} referencia un estudiante inexistente.`);
    if (entry.guardId && !accountIds.has(entry.guardId)) errors.push(`El acceso ${entry.id} referencia un vigilante inexistente.`);
  }

  return {
    logicalCounts: {
      cuentas: accounts.length,
      estudiantes: students.length,
      personal: staff.length,
      clases: array(database.classes).length,
      accesosQr: array(database.guardAccessEntries).length,
      validacionesSalida: array(database.exitValidations).length,
    },
    errors,
    warnings,
  };
}

async function main() {
  if (configuredProvider() !== 'mariadb') throw new Error('SIGA_STORAGE debe ser mariadb para auditar la base institucional.');
  const store = await openConfiguredStore();
  try {
    const logicalDatabase = await store.load();
    if (!logicalDatabase) throw new Error('estado_aplicacion no contiene el registro institucional 1.');
    const logical = inspectLogicalState(logicalDatabase);
    const payload = JSON.stringify(logicalDatabase);
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool(mariaDbConnectionOptions());
    let relational;
    try {
      relational = await inspectMariaDbRelational(pool, logicalDatabase);
    } finally {
      await pool.end();
    }
    const relationalErrors = relational.mismatches.map((item) => `${item.table}: esperado ${item.expected}, actual ${item.actual}`);
    for (const [name, total] of Object.entries(relational.orphans)) if (total > 0) relationalErrors.push(`${name}: ${total}`);
    if (relational.schema.tablesFound < 28) relationalErrors.push(`Tablas relacionales: ${relational.schema.tablesFound}/28`);
    if (relational.schema.viewsFound < 2) relationalErrors.push(`Vistas relacionales: ${relational.schema.viewsFound}/2`);
    const result = {
      audit: 'SIGA MariaDB - solo lectura',
      generatedAt: new Date().toISOString(),
      connection: { provider: 'MariaDB', database: process.env.SIGA_MARIADB_DATABASE || 'siga', status: 'ONLINE' },
      state: {
        schemaVersion: Number(logicalDatabase.schemaVersion || 1),
        jsonBytes: Buffer.byteLength(payload, 'utf8'),
        jsonValid: true,
      },
      logical: logical.logicalCounts,
      relational,
      integrity: { relationalErrors, logicalErrors: logical.errors, warnings: logical.warnings },
      status: relationalErrors.length || logical.errors.length ? 'REVISAR' : logical.warnings.length ? 'OK_CON_ADVERTENCIAS' : 'OK',
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'REVISAR') process.exitCode = 2;
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`AUDITORÍA NO COMPLETADA: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { inspectLogicalState, main };
