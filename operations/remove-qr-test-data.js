'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { configuredProvider, openConfiguredStore } = require('../database/store');

const email = 'prueba.qr@siga.edu.pe';
const documentNumber = '79990001';
const confirmation = 'ELIMINAR_PRUEBA_QR';
const execute = process.argv.includes('--execute');
const supplied = process.argv.find((item) => item.startsWith('--confirm='))?.slice('--confirm='.length);
const arrays = ['teacherAttendance', 'attendanceAudit', 'exitRequests', 'permanenceIncidents', 'coordinatorAudit', 'exitValidations', 'guardAttempts', 'guardIncidents', 'guardAlertReviews', 'guardAccessEntries', 'tutorCases', 'tutorAudit', 'tutorAlerts', 'tutorMessages', 'tutorMeetings', 'tutorJustifications', 'notifications', 'notices', 'familyAudit', 'studentAudit', 'adminAudit', 'passwordRecoveryRequests', 'securityAudit'];

function removeTestRecord(source) {
  const database = structuredClone(source);
  const account = (database.accounts || []).find((item) => String(item.email || '').toLowerCase() === email);
  if (!account) throw new Error('No se encontró la cuenta de prueba QR solicitada.');
  const student = (database.students || []).find((item) => String(item.id) === String(account.studentId) || String(item.document) === documentNumber);
  if (!student || String(student.document) !== documentNumber) throw new Error('La cuenta no está vinculada al estudiante de prueba esperado.');
  const accountId = String(account.id);
  const studentId = String(student.id);
  database.accounts = (database.accounts || []).filter((item) => String(item.id) !== accountId);
  database.students = (database.students || []).filter((item) => String(item.id) !== studentId);
  database.staff = (database.staff || []).filter((item) => String(item.accountId || '') !== accountId);
  database.classes = (database.classes || []).map((item) => ({ ...item, studentIds: (item.studentIds || []).filter((id) => String(id) !== studentId) }));
  for (const key of arrays) {
    if (!Array.isArray(database[key])) continue;
    database[key] = database[key].filter((item) => ![
      item.studentId, item.accountId, item.userId, item.requestedBy, item.createdBy, item.createdById, item.sentBy,
    ].map((value) => String(value || '')).includes(studentId) && ![
      item.studentId, item.accountId, item.userId, item.requestedBy, item.createdBy, item.createdById, item.sentBy,
    ].map((value) => String(value || '')).includes(accountId));
  }
  for (const item of database.accounts) {
    if (Array.isArray(item.studentIds)) item.studentIds = item.studentIds.filter((id) => String(id) !== studentId);
    if (String(item.studentId || '') === studentId) item.studentId = '';
  }
  return { database, accountId, studentId };
}

async function main() {
  if (configuredProvider() !== 'mariadb') throw new Error('SIGA_STORAGE debe ser mariadb.');
  const store = await openConfiguredStore();
  try {
    const original = await store.load();
    if (!original) throw new Error('No existe el estado institucional de SIGA en MariaDB.');
    const result = removeTestRecord(original);
    console.log(`Se eliminarán solo la cuenta ${email}, el estudiante ${result.studentId} y sus registros asociados.`);
    if (!execute || supplied !== confirmation) {
      console.log(`Simulación finalizada. Para ejecutar use: --execute --confirm=${confirmation}`);
      return;
    }
    const backups = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(backups, { recursive: true });
    const snapshot = path.join(backups, `SIGA-before-qr-test-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(snapshot, JSON.stringify(original, null, 2), { encoding: 'utf8', flag: 'wx' });
    await store.save(result.database);
    const verified = await store.load();
    if ((verified.accounts || []).some((item) => String(item.email || '').toLowerCase() === email)
      || (verified.students || []).some((item) => String(item.document || '') === documentNumber)) {
      throw new Error('MariaDB no confirmó la eliminación completa de la prueba QR.');
    }
    console.log(`Limpieza completada y verificada. Copia lógica: ${snapshot}`);
    console.log(`Comprobante: ${crypto.createHash('sha256').update(JSON.stringify(result.database)).digest('hex').slice(0, 12)}`);
  } finally { await store.close(); }
}

if (require.main === module) main().catch((error) => { console.error(`No se eliminó la prueba QR: ${error.message}`); process.exitCode = 1; });
module.exports = { removeTestRecord };
