'use strict';

/*
 * Limpieza controlada para volver a realizar pruebas con usuarios nuevos.
 * Conserva exclusivamente las cuentas indicadas y el catálogo académico.
 * Debe ejecutarse con SIGA detenido y requiere --execute --confirm.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { configuredProvider, openConfiguredStore } = require('../database/store');

const preservedEmails = new Set([
  'admin@siga.edu.pe',
  'coordinador@siga.edu.pe',
  'docente@siga.edu.pe',
  'padre@siga.edu.pe',
  'vigilante@siga.edu.pe',
  'estudiante@siga.edu.pe',
]);
const confirmation = 'CONSERVAR_SOLO_SEIS_CUENTAS';
const requestedExecution = process.argv.includes('--execute');
const provisionMissingGuard = process.argv.includes('--provision-missing-vigilante');
const suppliedConfirmation = process.argv.find((argument) => argument.startsWith('--confirm='))?.slice('--confirm='.length);

const emptiedCollections = [
  'classes', 'teacherAttendance', 'attendanceAudit', 'exitRequests', 'permanenceIncidents',
  'coordinatorAudit', 'exitValidations', 'guardAttempts', 'guardIncidents', 'guardAlertReviews',
  'guardAccessEntries', 'tutorCases', 'tutorAudit', 'tutorAlerts', 'tutorMessages',
  'tutorMeetings', 'tutorJustifications', 'notifications', 'notices', 'familyAudit',
  'studentAudit', 'adminAudit', 'passwordRecoveryRequests', 'securityAudit',
];

function normalEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function createTestGuard(password) {
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(String(password || ''))) {
    throw new Error('Para crear la cuenta de Vigilante indique SIGA_TEST_VIGILANTE_PASSWORD con una contraseña segura de al menos 10 caracteres.');
  }
  const accountId = `USR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    account: {
      id: accountId,
      name: 'Vigilante de pruebas SIGA',
      email: 'vigilante@siga.edu.pe',
      username: 'vigilante.siga',
      documentType: 'DNI',
      document: '46789012',
      institutionalCode: 'VIG-PRUEBA',
      position: 'Vigilante',
      phone: '',
      address: '',
      bio: '',
      role: 'vigilante',
      roles: ['vigilante'],
      program: '',
      additionalPrograms: [],
      shift: 'Mañana',
      pointOfControl: 'Puerta principal',
      passwordHash: passwordHash(password),
      state: 'Activo',
    },
    staff: {
      id: `PER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      accountId,
      documentType: 'DNI',
      document: '46789012',
      name: 'Vigilante de pruebas SIGA',
      email: 'vigilante@siga.edu.pe',
      role: 'Vigilante',
      program: 'Institucional',
      shift: 'Mañana',
      pointOfControl: 'Puerta principal',
      state: 'Activo',
    },
  };
}

function clearState(source, options = {}) {
  const database = structuredClone(source);
  const accounts = Array.isArray(database.accounts) ? database.accounts : [];
  const keptAccounts = accounts.filter((account) => preservedEmails.has(normalEmail(account.email)));
  let foundEmails = new Set(keptAccounts.map((account) => normalEmail(account.email)));
  let missing = [...preservedEmails].filter((email) => !foundEmails.has(email));
  let provisionedGuard = null;
  if (options.provisionMissingGuard && missing.length === 1 && missing[0] === 'vigilante@siga.edu.pe') {
    provisionedGuard = createTestGuard(options.guardPassword);
    keptAccounts.push(provisionedGuard.account);
    foundEmails = new Set(keptAccounts.map((account) => normalEmail(account.email)));
    missing = [...preservedEmails].filter((email) => !foundEmails.has(email));
  }
  if (missing.length) throw new Error(`No se encontraron las cuentas que se solicitó conservar: ${missing.join(', ')}.`);

  const keptAccountIds = new Set(keptAccounts.map((account) => String(account.id)));
  const studentIds = new Set();
  for (const account of keptAccounts) {
    if (account.studentId) studentIds.add(String(account.studentId));
    for (const studentId of Array.isArray(account.studentIds) ? account.studentIds : []) studentIds.add(String(studentId));
  }

  database.accounts = keptAccounts;
  database.students = (Array.isArray(database.students) ? database.students : [])
    .filter((student) => studentIds.has(String(student.id)) || preservedEmails.has(normalEmail(student.email)));
  const validStudentIds = new Set(database.students.map((student) => String(student.id)));
  database.accounts.forEach((account) => {
    if (account.studentId && !validStudentIds.has(String(account.studentId))) account.studentId = '';
    if (Array.isArray(account.studentIds)) account.studentIds = account.studentIds.filter((studentId) => validStudentIds.has(String(studentId)));
  });
  database.staff = (Array.isArray(database.staff) ? database.staff : [])
    .filter((staff) => keptAccountIds.has(String(staff.accountId)) || preservedEmails.has(normalEmail(staff.email)));
  const keptStaffAccountByEmail = new Map(database.accounts.map((account) => [normalEmail(account.email), account.id]));
  database.staff.forEach((staff) => {
    const accountId = keptStaffAccountByEmail.get(normalEmail(staff.email));
    if (accountId) staff.accountId = accountId;
  });
  if (provisionedGuard) database.staff.push(provisionedGuard.staff);
  for (const key of emptiedCollections) database[key] = [];
  // Se mantienen los siguientes correlativos para evitar reutilizar códigos ya entregados.
  if (!database.nextIds || typeof database.nextIds !== 'object') database.nextIds = { student: 1, staff: 1, class: 1 };
  return { database, provisionedGuard: Boolean(provisionedGuard) };
}

function summarize(database) {
  return {
    cuentas: Array.isArray(database.accounts) ? database.accounts.length : 0,
    estudiantes: Array.isArray(database.students) ? database.students.length : 0,
    personal: Array.isArray(database.staff) ? database.staff.length : 0,
    programas: Array.isArray(database.programs) ? database.programs.length : 0,
  };
}

async function main() {
  if (configuredProvider() !== 'mariadb') throw new Error('SIGA_STORAGE debe ser mariadb.');
  const store = await openConfiguredStore();
  try {
    const original = await store.load();
    if (!original) throw new Error('MariaDB no contiene datos de SIGA para limpiar.');
    const result = clearState(original, {
      provisionMissingGuard,
      guardPassword: process.env.SIGA_TEST_VIGILANTE_PASSWORD,
    });
    const cleaned = result.database;
    const before = summarize(original);
    const after = summarize(cleaned);
    console.log(`Estado actual: ${before.cuentas} cuentas, ${before.estudiantes} estudiantes, ${before.personal} personal.`);
    console.log(`Después de la limpieza: ${after.cuentas} cuentas, ${after.estudiantes} estudiantes, ${after.personal} personal.`);
    console.log(`Cuentas conservadas: ${[...preservedEmails].join(', ')}`);
    if (result.provisionedGuard) console.log('La cuenta de Vigilante faltante se creará como cuenta de prueba activa.');

    if (!requestedExecution || suppliedConfirmation !== confirmation) {
      console.log(`Simulación finalizada. Para ejecutar use: --execute --confirm=${confirmation}`);
      return;
    }

    const backupDirectory = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(backupDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(backupDirectory, `SIGA-before-test-reset-${timestamp}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(original, null, 2), { encoding: 'utf8', flag: 'wx' });

    const payload = JSON.stringify(cleaned);
    await store.save(cleaned);
    const verification = await store.load();
    if (!verification || verification.accounts?.length !== preservedEmails.size
      || verification.accounts.some((item) => !preservedEmails.has(normalEmail(item.email)))) {
      throw new Error('MariaDB no confirmó las seis cuentas conservadas.');
    }

    const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12);
    console.log(`Limpieza completada. Copia lógica: ${snapshotPath}`);
    console.log(`Estado conservado verificado: ${digest}`);
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se realizó ninguna limpieza: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { clearState, preservedEmails };
