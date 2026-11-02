'use strict';

/*
 * Transición controlada desde las seis cuentas de ensayo hacia una base lista
 * para carga oficial. Conserva el catálogo de programas y una sola cuenta
 * administradora, con correo institucional y contraseña nueva. No actúa si
 * encuentra cuentas ajenas al conjunto de control para evitar borrar datos reales.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openConfiguredStore } = require('../database/store');

const controlledEmails = new Set([
  'admin@siga.edu.pe',
  'coordinador@siga.edu.pe',
  'docente@siga.edu.pe',
  'padre@siga.edu.pe',
  'vigilante@siga.edu.pe',
  'estudiante@siga.edu.pe',
]);
const confirmation = 'PREPARAR_DATOS_OFICIALES';
const operationalCollections = [
  'students', 'staff', 'classes', 'teacherAttendance', 'attendanceAudit',
  'exitRequests', 'permanenceIncidents', 'coordinatorAudit', 'exitValidations',
  'guardAttempts', 'guardIncidents', 'guardAlertReviews', 'guardAccessEntries',
  'tutorCases', 'tutorAudit', 'tutorAlerts', 'tutorMessages', 'tutorMeetings',
  'tutorJustifications', 'notifications', 'notices', 'familyAudit',
  'studentAudit', 'adminAudit', 'passwordRecoveryRequests', 'securityAudit',
];

function argument(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3).trim();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{14,}$/.test(String(value || ''));
}

function generatePassword() {
  return `Sg!9${crypto.randomBytes(18).toString('base64url')}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function summary(database) {
  return {
    accounts: Array.isArray(database.accounts) ? database.accounts.length : 0,
    students: Array.isArray(database.students) ? database.students.length : 0,
    staff: Array.isArray(database.staff) ? database.staff.length : 0,
    classes: Array.isArray(database.classes) ? database.classes.length : 0,
  };
}

async function main() {
  const execute = process.argv.includes('--execute');
  const suppliedConfirmation = argument('confirm');
  const adminEmail = normalizeEmail(argument('admin-email') || process.env.SIGA_BOOTSTRAP_ADMIN_EMAIL || 'administrador@iestpcmvo.edu.pe');
  const adminName = String(argument('admin-name') || process.env.SIGA_BOOTSTRAP_ADMIN_NAME || 'Administrador SIGA').trim();
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error('Indique un correo institucional válido para el administrador.');
  if (controlledEmails.has(adminEmail)) throw new Error('El correo administrador nuevo no puede ser una cuenta de control de SIGA.');
  if (adminName.length < 3) throw new Error('Indique el nombre institucional del administrador.');

  const store = await openConfiguredStore();
  try {
    const original = await store.load();
    if (!original) throw new Error('No existe un estado de SIGA para preparar.');
    const accounts = Array.isArray(original.accounts) ? original.accounts : [];
    const unexpected = accounts.filter((item) => !controlledEmails.has(normalizeEmail(item.email)));
    if (unexpected.length) {
      throw new Error(`Se encontraron ${unexpected.length} cuenta(s) no controladas. La transición se detuvo para proteger posibles datos reales.`);
    }
    const administrator = accounts.find((item) => normalizeEmail(item.email) === 'admin@siga.edu.pe' && item.role === 'administrador');
    if (!administrator) throw new Error('No se encontró la cuenta administradora controlada que debe conservarse.');

    console.log('Estado actual:', summary(original));
    console.log(`Plan: conservar el catálogo académico, vaciar datos de ensayo y convertir admin@siga.edu.pe en ${adminEmail}.`);
    if (!execute || suppliedConfirmation !== confirmation) {
      console.log(`Simulación finalizada. Para ejecutar use --execute --confirm=${confirmation}.`);
      return;
    }

    const password = String(process.env.SIGA_OFFICIAL_ADMIN_PASSWORD || '') || generatePassword();
    if (!validPassword(password)) throw new Error('SIGA_OFFICIAL_ADMIN_PASSWORD debe tener al menos 14 caracteres, mayúscula, minúscula, número y símbolo.');
    const cleaned = structuredClone(original);
    cleaned.accounts = [{
      ...administrator,
      name: adminName,
      email: adminEmail,
      username: adminEmail.split('@')[0],
      document: '',
      role: 'administrador',
      roles: ['administrador'],
      studentId: undefined,
      studentIds: undefined,
      passwordHash: hashPassword(password),
      state: 'Activo',
    }];
    for (const collection of operationalCollections) cleaned[collection] = [];
    cleaned.nextIds = { student: 1, staff: 1, class: 1 };

    const backupDirectory = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(backupDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(backupDirectory, `SIGA-before-official-data-${timestamp}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(original, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await store.save(cleaned);

    console.log('TRANSICIÓN COMPLETADA');
    console.log(`Copia lógica previa: ${snapshotPath}`);
    console.log(`Administrador: ${adminEmail}`);
    console.log(`Contraseña inicial (se muestra una sola vez): ${password}`);
    console.log('Inicie sesión y cambie inmediatamente la contraseña desde Mi cuenta.');
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  console.error(`TRANSICIÓN NO REALIZADA: ${error.message}`);
  process.exitCode = 1;
});
