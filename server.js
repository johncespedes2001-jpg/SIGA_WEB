'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const { execFile } = require('child_process');
const { promisify } = require('util');
const express = require('express');
const compression = require('compression');
const multer = require('multer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { openSqlServerStore } = require('./database/sqlserver-store');
const { unitsForProgramSemester, planForProgram } = require('./study-plan-catalog');

const app = express();
const preferredPort = Number(process.env.PORT) || 3000;
const bindHost = String(process.env.SIGA_BIND_HOST || '127.0.0.1').trim();
const publicDirectory = path.join(__dirname, 'public');
const dataDirectory = process.env.SIGA_DATA_DIR ? path.resolve(process.env.SIGA_DATA_DIR) : path.join(__dirname, 'data');
const profilePhotoDirectory = path.join(dataDirectory, 'profile-photos');
const tutorEvidenceDirectory = path.join(dataDirectory, 'tutor-evidence');
const familyEvidenceDirectory = path.join(dataDirectory, 'family-evidence');
const guardEvidenceDirectory = path.join(dataDirectory, 'guard-evidence');
const studentEvidenceDirectory = path.join(dataDirectory, 'student-evidence');
const quarantineDirectory = path.join(dataDirectory, 'upload-quarantine');
const templateDirectory = path.join(__dirname, 'templates');
const databasePath = path.join(dataDirectory, 'siga.json');
const securityStatePath = path.join(dataDirectory, 'security-state.json');
const usageMetricsPath = path.join(dataDirectory, 'usage-metrics.json');
const storageProvider = String(process.env.SIGA_STORAGE || 'json').trim().toLowerCase();
if (!['json', 'sqlserver'].includes(storageProvider)) throw new Error('SIGA_STORAGE debe ser json o sqlserver.');
let sqlServerStore = null;
let sqlSaveQueue = Promise.resolve();
const requestContext = new AsyncLocalStorage();
const revokedSessions = new Map();
const loginAttempts = new Map();
const usageMetrics = new Map();
let usageMetricsDirty = false;
const sessionDuration = 8 * 60 * 60 * 1000;
const attendanceCorrectionDays = 7;
const maximumImportRows = 2000;
const maximumImportColumns = 50;
const databaseSchemaVersion = 5;
const demoMode = process.env.SIGA_DEMO_MODE === 'true';
const institutionStart = process.env.SIGA_INSTITUTION_START || '07:00';
const institutionEnd = process.env.SIGA_INSTITUTION_END || '21:00';
const execFileAsync = promisify(execFile);

function booleanEnvironment(name, fallback = false) {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(value);
}

function productionConfigurationErrors() {
  if (process.env.NODE_ENV !== 'production') return [];
  const errors = [];
  if (storageProvider !== 'sqlserver') errors.push('SIGA_STORAGE debe ser sqlserver.');
  if (!booleanEnvironment('SIGA_SQL_ENCRYPT', true)) errors.push('SIGA_SQL_ENCRYPT debe ser true.');
  if (booleanEnvironment('SIGA_SQL_TRUST_CERTIFICATE', false)) errors.push('SIGA_SQL_TRUST_CERTIFICATE debe ser false.');
  if (demoMode) errors.push('SIGA_DEMO_MODE debe ser false.');
  const placeholder = (value) => /CAMBIAR|PENDIENTE|EJEMPLO|example\./i.test(String(value || ''));
  if (!String(process.env.SIGA_SESSION_SECRET || '').trim() || placeholder(process.env.SIGA_SESSION_SECRET)) errors.push('SIGA_SESSION_SECRET debe ser un secreto real definido fuera del código.');
  if (!process.env.SIGA_SQL_CONNECTION_STRING && (!process.env.SIGA_SQL_PASSWORD || placeholder(process.env.SIGA_SQL_PASSWORD))) errors.push('SIGA_SQL_PASSWORD debe ser un secreto real.');
  const trustProxy = String(process.env.SIGA_TRUST_PROXY || '').trim().toLowerCase();
  if (!trustProxy || ['false', 'no', 'off', '0'].includes(trustProxy)) errors.push('SIGA_TRUST_PROXY debe identificar el proxy HTTPS confiable.');
  try {
    const publicUrl = new URL(String(process.env.SIGA_PUBLIC_BASE_URL || ''));
    if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || placeholder(publicUrl.hostname)) throw new Error();
  } catch {
    errors.push('SIGA_PUBLIC_BASE_URL debe ser una URL HTTPS válida.');
  }
  for (const name of ['SIGA_ANTIMALWARE_COMMAND', 'SIGA_ALERT_WEBHOOK', 'SIGA_LEGAL_NAME', 'SIGA_LEGAL_ADDRESS', 'SIGA_PRIVACY_EMAIL', 'SIGA_RETENTION_NOTICE', 'SIGA_DATA_RECIPIENTS']) {
    if (!String(process.env[name] || '').trim() || placeholder(process.env[name])) errors.push(`${name} debe contener el valor institucional definitivo.`);
  }
  try { if (new URL(process.env.SIGA_ALERT_WEBHOOK).protocol !== 'https:') throw new Error(); }
  catch { errors.push('SIGA_ALERT_WEBHOOK debe ser una URL HTTPS válida.'); }
  return errors;
}

function escapeHtmlText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function operationalAlert(event, details = {}) {
  const webhook = String(process.env.SIGA_ALERT_WEBHOOK || '').trim();
  if (!webhook) return;
  const payload = { text: `SIGA · ${event}`, event, occurredAt: new Date().toISOString(), ...details };
  fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) })
    .catch((error) => console.error(JSON.stringify({ level: 'error', event: 'alert_delivery_failed', message: error.message })));
}
const timeToMinutes = (value) => Number(String(value).slice(0, 2)) * 60 + Number(String(value).slice(3, 5));
const defaultPrograms = [
  'Enfermería Técnica',
  'Acuicultura y Procesamiento Pesquero',
  'Mecatrónica Automotriz',
  'Arquitectura de Plataformas y Servicios de Tecnologías de Información',
];
let programs = [...defaultPrograms];
const states = ['Activo', 'Inactivo'];
const attendanceStates = ['Presente', 'Tardanza', 'Ausente', 'Permiso', 'Retiro'];
const guardShifts = ['Mañana', 'Tarde', 'Noche', 'Rotativo'];
const documentTypes = ['DNI', 'CE'];
const staffRoles = ['Docente', 'Coordinador', 'Padre o apoderado', 'Administrador', 'Vigilante'];
const roleKeys = { Docente: 'docente', Coordinador: 'coordinador', Tutor: 'tutor', 'Padre o apoderado': 'padre', Administrador: 'administrador', Vigilante: 'vigilante' };
const roleImportProfiles = {
  teachers: { role: 'Docente', filename: 'SIGA_plantilla_docentes.xlsx' },
  coordinators: { role: 'Coordinador', filename: 'SIGA_plantilla_coordinadores.xlsx' },
  parents: { role: 'Padre o apoderado', filename: 'SIGA_plantilla_apoderados.xlsx' },
  administrators: { role: 'Administrador', filename: 'SIGA_plantilla_administradores.xlsx', institutional: true },
  guards: { role: 'Vigilante', filename: 'SIGA_plantilla_vigilantes.xlsx', institutional: true },
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const asyncRoute = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);

function configuredPassword(name) {
  const value = String(process.env[name] || '');
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(value)) {
    throw new Error(`${name} debe contener una contraseña segura de al menos 10 caracteres.`);
  }
  return value;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function seedDatabase() {
  if (!demoMode) throw new Error('El modo de demostración no está habilitado.');
  const passwords = {
    administrator: configuredPassword('SIGA_DEMO_ADMIN_PASSWORD'),
    teacher: configuredPassword('SIGA_DEMO_TEACHER_PASSWORD'),
    coordinator: configuredPassword('SIGA_DEMO_COORDINATOR_PASSWORD'),
    tutor: configuredPassword('SIGA_DEMO_TUTOR_PASSWORD'),
    parent: configuredPassword('SIGA_DEMO_PARENT_PASSWORD'),
    guard: configuredPassword('SIGA_DEMO_GUARD_PASSWORD'),
    student: configuredPassword('SIGA_DEMO_STUDENT_PASSWORD'),
    secondStudent: configuredPassword('SIGA_DEMO_SECOND_STUDENT_PASSWORD'),
  };
  return {
    schemaVersion: databaseSchemaVersion,
    programs: defaultPrograms.map((name, index) => ({ id: `PRO-${String(index + 1).padStart(3, '0')}`, name, state: 'Activo' })),
    nextIds: { student: 5, staff: 10, class: 6 },
    accounts: [
      { id: 'USR-001', name: 'Administrador SIGA', email: 'admin@siga.edu.pe', username: 'admin.siga', document: '', institutionalCode: 'ADM-001', position: 'Administrador del sistema', phone: '', address: '', bio: '', role: 'administrador', passwordHash: hashPassword(passwords.administrator), state: 'Activo' },
      { id: 'USR-002', name: 'Rosa Verónica Agurto Ortiz', email: 'docente@siga.edu.pe', username: 'rosa.agurto', document: '40123456', institutionalCode: 'DOC-001', position: 'Docente', phone: '', address: '', bio: '', role: 'docente', roles: ['docente', 'tutor'], program: programs[3], passwordHash: hashPassword(passwords.teacher), state: 'Activo' },
      { id: 'USR-003', name: 'Ana Rodríguez Silva', email: 'coordinador@siga.edu.pe', username: 'ana.rodriguez', document: '43456789', institutionalCode: 'COO-001', position: 'Coordinadora académica', phone: '', address: '', bio: '', role: 'coordinador', roles: ['coordinador', 'docente'], program: programs[2], passwordHash: hashPassword(passwords.coordinator), state: 'Activo' },
      { id: 'USR-004', name: 'Luis Torres Peña', email: 'tutor@siga.edu.pe', username: 'luis.torres', document: '44567890', institutionalCode: 'TUT-001', position: 'Docente con función de tutor', phone: '', address: '', bio: '', role: 'docente', roles: ['docente', 'tutor'], program: programs[1], passwordHash: hashPassword(passwords.tutor), state: 'Activo' },
      { id: 'USR-005', name: 'Elena Ruiz Castro', email: 'padre@siga.edu.pe', username: 'elena.ruiz', document: '45678901', position: 'Madre y apoderada', phone: '987 654 321', address: '', bio: '', notificationPreferences: ['Asistencia','Boletas','Reuniones'], role: 'padre', studentIds: ['EST-002'], passwordHash: hashPassword(passwords.parent), state: 'Activo' },
      { id: 'USR-006', name: 'Julio Salazar Vega', email: 'vigilante@siga.edu.pe', username: 'julio.salazar', document: '46789012', institutionalCode: 'VIG-001', position: 'Vigilante', phone: '', role: 'vigilante', shift: 'Mañana', pointOfControl: 'Puerta principal', passwordHash: hashPassword(passwords.guard), state: 'Activo' },
      { id: 'USR-007', studentId: 'EST-003', name: 'Diego Mendoza Ruiz', email: 'estudiante@siga.edu.pe', contactEmail: 'diego.personal@example.com', username: 'diego.mendoza', phone: '987 111 222', notificationPreferences: ['Asistencia','Boletas','Avisos'], role: 'estudiante', passwordHash: hashPassword(passwords.student), state: 'Activo' },
      { id: 'USR-008', studentId: 'EST-002', name: 'Valeria Cruz Jiménez', email: 'valeria.estudiante@siga.edu.pe', contactEmail: 'valeria.personal@example.com', username: 'valeria.cruz', phone: '987 333 444', notificationPreferences: ['Asistencia','Boletas','Tutoría'], role: 'estudiante', passwordHash: hashPassword(passwords.secondStudent), state: 'Activo' },
      { id: 'USR-009', name: 'Carmen Soto Rojas', email: 'carmen.tutoria@instituto.edu.pe', username: 'carmen.soto', document: '48901234', institutionalCode: 'DOC-003', position: 'Docente con función de tutor', phone: '', address: '', bio: '', role: 'docente', roles: ['docente', 'tutor'], program: programs[0], passwordHash: hashPassword(passwords.tutor), state: 'Activo' },
    ],
    students: [
      { id: 'EST-001', document: '74851236', name: 'Jairo Céspedes', email: 'jairo@instituto.edu.pe', semester: 'III', group: 'III-A', tutorId: 'PER-001', program: programs[3], state: 'Activo' },
      { id: 'EST-002', document: '73564821', name: 'Valeria Cruz Jiménez', email: 'valeria@instituto.edu.pe', semester: 'IV', group: 'IV-A', tutorId: 'PER-009', program: programs[0], state: 'Activo' },
      { id: 'EST-003', document: '72459631', name: 'Diego Mendoza Ruiz', email: 'diego@instituto.edu.pe', semester: 'II', group: 'II-A', tutorId: '', program: programs[2], state: 'Activo' },
      { id: 'EST-004', document: '75123648', name: 'Lucía Álvarez Peña', email: 'lucia@instituto.edu.pe', semester: 'VI', group: 'VI-A', tutorId: 'PER-005', program: programs[1], state: 'Activo' },
    ],
    staff: [
      { id: 'PER-001', accountId: 'USR-002', document: '40123456', name: 'Rosa Verónica Agurto Ortiz', email: 'rosa@instituto.edu.pe', role: 'Docente', program: programs[3], state: 'Activo', shift: '' },
      { id: 'PER-002', accountId: 'USR-001', document: '41234567', name: 'Carlos Huamán Ríos', email: 'carlos@instituto.edu.pe', role: 'Administrador', program: 'Institucional', state: 'Activo', shift: '' },
      { id: 'PER-003', document: '42345678', name: 'María García López', email: 'maria@instituto.edu.pe', role: 'Docente', program: programs[0], state: 'Activo', shift: '' },
      { id: 'PER-004', accountId: 'USR-003', document: '43456789', name: 'Ana Rodríguez Silva', email: 'ana@instituto.edu.pe', role: 'Coordinador', program: programs[2], state: 'Activo', shift: '' },
      { id: 'PER-005', accountId: 'USR-004', document: '44567890', name: 'Luis Torres Peña', email: 'luis.tutor@instituto.edu.pe', role: 'Docente', roles: ['docente', 'tutor'], program: programs[1], state: 'Activo', shift: '' },
      { id: 'PER-006', accountId: 'USR-005', document: '45678901', name: 'Elena Ruiz Castro', email: 'elena.familia@instituto.edu.pe', role: 'Padre o apoderado', program: programs[0], state: 'Activo', shift: '' },
      { id: 'PER-007', accountId: 'USR-006', document: '46789012', name: 'Julio Salazar Vega', email: 'julio.vigilancia@instituto.edu.pe', role: 'Vigilante', program: 'Institucional', state: 'Activo', shift: 'Mañana' },
      { id: 'PER-008', document: '47890123', name: 'Mónica Flores Díaz', email: 'monica.vigilancia@instituto.edu.pe', role: 'Vigilante', program: 'Institucional', state: 'Activo', shift: 'Tarde' },
      { id: 'PER-009', accountId: 'USR-009', document: '48901234', name: 'Carmen Soto Rojas', email: 'carmen.tutoria@instituto.edu.pe', role: 'Docente', roles: ['docente', 'tutor'], program: programs[0], state: 'Activo', shift: '' },
    ],
    attendance: [
      { date: '2026-10-01', program: programs[0], semester: 'IV', state: 'Presente', total: 46 },
      { date: '2026-10-01', program: programs[0], semester: 'IV', state: 'Tardanza', total: 4 },
      { date: '2026-10-01', program: programs[1], semester: 'VI', state: 'Presente', total: 34 },
      { date: '2026-10-01', program: programs[1], semester: 'VI', state: 'Ausente', total: 3 },
      { date: '2026-10-02', program: programs[2], semester: 'II', state: 'Presente', total: 39 },
      { date: '2026-10-02', program: programs[2], semester: 'II', state: 'Tardanza', total: 5 },
      { date: '2026-10-02', program: programs[3], semester: 'III', state: 'Presente', total: 52 },
      { date: '2026-10-02', program: programs[3], semester: 'III', state: 'Ausente', total: 4 },
    ],
    classes: [
      { id: 'CLS-001', teacherId: 'USR-002', course: 'Desarrollo de aplicaciones web', group: 'III-A', section: 'A', semester: 'III', program: programs[3], room: 'Laboratorio 04', schedule: '08:00–09:30', studentIds: ['EST-001'] },
      { id: 'CLS-002', teacherId: 'USR-002', course: 'Base de datos', group: 'III-A', section: 'A', semester: 'III', program: programs[3], room: 'Laboratorio 02', schedule: '09:45–11:15', studentIds: ['EST-001'] },
      { id: 'CLS-003', teacherId: 'USR-003', course: 'Sistemas eléctricos del automóvil', group: 'II-A', section: 'A', semester: 'II', program: programs[2], room: 'Taller 02', schedule: '10:00–11:30', studentIds: ['EST-003'] },
      { id: 'CLS-004', teacherId: 'USR-004', course: 'Procesamiento de recursos hidrobiológicos', group: 'VI-A', section: 'A', semester: 'VI', program: programs[1], room: 'Laboratorio 03', schedule: '14:00–15:30', studentIds: ['EST-004'] },
      { id: 'CLS-005', teacherId: 'USR-002', course: 'Cuidados técnicos de enfermería', group: 'IV-A', section: 'A', semester: 'IV', program: programs[0], room: 'Aula 06', schedule: '08:00–09:30', studentIds: ['EST-002'] },
    ],
    teacherAttendance: [
      { id: 'ASI-001', teacherId: 'USR-002', classId: 'CLS-001', studentId: 'EST-001', date: '2026-10-08', state: 'Presente', updatedAt: '2026-10-08T08:12:00.000Z' },
      { id: 'ASI-002', teacherId: 'USR-002', classId: 'CLS-002', studentId: 'EST-001', date: '2026-10-08', state: 'Tardanza', updatedAt: '2026-10-08T10:02:00.000Z' },
      { id: 'ASI-003', teacherId: 'USR-003', classId: 'CLS-003', studentId: 'EST-003', date: '2026-10-11', state: 'Presente', updatedAt: '2026-10-11T15:10:00.000Z' },
      { id: 'ASI-004', teacherId: 'USR-004', classId: 'CLS-004', studentId: 'EST-004', date: '2026-10-11', state: 'Presente', updatedAt: '2026-10-11T14:08:00.000Z' },
      { id: 'ASI-005', teacherId: 'USR-002', classId: 'CLS-005', studentId: 'EST-002', date: '2026-10-15', state: 'Presente', updatedAt: '2026-10-15T09:31:00.000Z' },
      { id: 'ASI-006', teacherId: 'USR-002', classId: 'CLS-005', studentId: 'EST-002', date: '2026-10-16', state: 'Tardanza', updatedAt: '2026-10-16T09:40:00.000Z' },
      { id: 'ASI-007', teacherId: 'USR-002', classId: 'CLS-005', studentId: 'EST-002', date: '2026-10-17', state: 'Ausente', updatedAt: '2026-10-17T10:00:00.000Z' },
    ],
    attendanceAudit: [],
    exitRequests: [
      { id: 'SOL-024', teacherId: 'USR-002', classId: 'CLS-001', studentId: 'EST-001', reason: 'Cita médica', date: '2026-10-08', time: '16:20', source: 'Docente', status: 'Autorizada', authorizedBy: 'Coordinación académica', qrCode: 'SIGA-SOL-024-AUTORIZADA', createdAt: '2026-10-08T13:30:00.000Z' },
      { id: 'SOL-025', teacherId: 'USR-002', classId: 'CLS-002', studentId: 'EST-001', reason: 'Motivo familiar', date: '2026-10-09', time: '12:30', source: 'Docente', status: 'Pendiente de coordinación', authorizedBy: '', qrCode: '', createdAt: '2026-10-08T15:10:00.000Z' },
      { id: 'SOL-026', requestedBy: 'USR-008', teacherId: '', classId: 'CLS-005', studentId: 'EST-002', reason: 'Cita de control médico', type: 'Temporal', date: '2026-10-18', time: '12:45', source: 'Estudiante', status: 'Autorizada', decisionReason: '', authorizedBy: 'Coordinación académica', authorizedById: 'USR-003', authorizedAt: '2026-10-18T14:20:00.000Z', qrCode: 'SIGA-SOL-026-AUTORIZADA', createdAt: '2026-10-18T13:55:00.000Z' },
    ],
    permanenceIncidents: [
      { id: 'INC-017', studentId: 'EST-003', program: programs[2], date: '2026-10-10', type: 'Asistencia', description: 'Dos tardanzas consecutivas durante la semana.', responsible: 'Coordinación académica', evidence: 'Registro consolidado de asistencia', status: 'Abierta', createdBy: 'USR-003', createdAt: '2026-10-10T16:00:00.000Z', updatedAt: '2026-10-10T16:00:00.000Z' },
    ],
    coordinatorAudit: [],
    exitValidations: [],
    guardAttempts: [
      { id: 'GAT-001', exitId: '', qrCode: 'SIGA-CODIGO-NO-REGISTRADO', studentId: '', student: 'No identificado', result: 'Rechazada', reason: 'QR inexistente', guardId: 'USR-006', guardName: 'Julio Salazar Vega', shift: 'Mañana', pointOfControl: 'Puerta principal', date: '2026-10-18T13:20:00.000Z' },
    ],
    guardIncidents: [
      { id: 'SEG-001', studentId: 'EST-001', exitId: 'SOL-025', date: '2026-10-18T13:24:00.000Z', type: 'Intento de salida no autorizada', description: 'Se presentó una solicitud todavía pendiente de evaluación por Coordinación.', priority: 'Media', evidenceFile: '', evidenceName: '', status: 'Abierta', createdBy: 'USR-006', createdByName: 'Julio Salazar Vega', pointOfControl: 'Puerta principal', updatedAt: '2026-10-18T13:24:00.000Z' },
    ],
    guardAlertReviews: [],
    guardAccessEntries: [
      { id: 'ING-001', guardId: 'USR-006', studentId: 'EST-001', pointOfControl: 'Puerta principal', date: '2026-10-18T12:10:00.000Z' },
      { id: 'ING-002', guardId: 'USR-006', studentId: 'EST-002', pointOfControl: 'Puerta principal', date: '2026-10-18T12:18:00.000Z' },
      { id: 'ING-003', guardId: 'USR-006', studentId: 'EST-003', pointOfControl: 'Puerta principal', date: '2026-10-18T12:22:00.000Z' },
    ],
    tutorCases: [
      { id: 'TCA-001', tutorId: 'USR-002', studentId: 'EST-001', date: '2026-10-08', type: 'Asistencia', description: 'Se registró una tardanza y requiere seguimiento preventivo.', priority: 'Media', actions: 'Conversación inicial con el estudiante.', responsible: 'Rosa Verónica Agurto Ortiz', evidenceFile: '', evidenceName: '', status: 'En seguimiento', createdAt: '2026-10-08T16:00:00.000Z', updatedAt: '2026-10-08T16:00:00.000Z' },
      { id: 'TCA-002', tutorId: 'USR-004', studentId: 'EST-004', date: '2026-10-09', type: 'Académica', description: 'Seguimiento preventivo del avance académico.', priority: 'Baja', actions: 'Programar reunión individual.', responsible: 'Luis Torres Peña', evidenceFile: '', evidenceName: '', status: 'Abierto', createdAt: '2026-10-09T15:00:00.000Z', updatedAt: '2026-10-09T15:00:00.000Z' },
      { id: 'TCA-003', tutorId: '', studentId: 'EST-002', date: '2026-10-16', type: 'Asistencia', description: 'Seguimiento compartido por una tardanza registrada durante la semana.', priority: 'Baja', actions: 'Reforzar puntualidad y confirmar el horario de ingreso.', responsible: 'Carmen Soto Rojas', evidenceFile: '', evidenceName: '', status: 'En seguimiento', sharedWithFamily: true, sharedWithStudent: true, familyNextStep: '2026-10-23', createdAt: '2026-10-16T16:00:00.000Z', updatedAt: '2026-10-16T16:00:00.000Z' },
    ],
    tutorAudit: [
      { id: 'TAU-001', entity: 'case', entityId: 'TCA-001', action: 'Creación', detail: 'Caso registrado para seguimiento.', userId: 'USR-002', userName: 'Rosa Verónica Agurto Ortiz', date: '2026-10-08T16:00:00.000Z' },
    ],
    tutorAlerts: [],
    tutorMessages: [
      { id: 'COM-001', tutorId: 'USR-002', studentId: 'EST-001', subject: 'Seguimiento de asistencia', message: 'Se recomienda revisar la puntualidad de esta semana.', recipients: 'Estudiante y apoderado', date: '2026-10-08', sentAt: '2026-10-08T16:10:00.000Z' },
    ],
    tutorMeetings: [
      { id: 'REU-001', tutorId: 'USR-002', studentId: 'EST-001', date: '2026-10-15', time: '16:00', participants: 'Estudiante y apoderado', agreements: 'Revisar puntualidad y hábitos de estudio.', followUp: 'Verificar asistencia en siete días.', status: 'Programada', createdAt: '2026-10-08T16:15:00.000Z' },
      { id: 'REU-002', tutorId: '', studentId: 'EST-002', date: '2026-10-22', time: '17:00', modality: 'Presencial', topic: 'Seguimiento de asistencia y puntualidad', responsible: 'Carmen Soto Rojas', participants: 'Estudiante y apoderado', agreements: '', followUp: 'Revisar los acuerdos después de la reunión.', status: 'Pendiente de confirmación', createdAt: '2026-10-17T18:10:00.000Z' },
    ],
    tutorJustifications: [
      { id: 'JUS-001', studentId: 'EST-001', date: '2026-10-08', reason: 'Cita médica', evidenceName: 'Constancia médica', status: 'Pendiente', observation: '', derivedBy: '', createdAt: '2026-10-08T12:00:00.000Z' },
      { id: 'JUS-002', studentId: 'EST-002', startDate: '2026-10-17', endDate: '2026-10-17', date: '2026-10-17', type: 'Ausencia', reason: 'Salud', description: 'Malestar general comunicado a Tutoría.', contact: '987 654 321', evidenceName: '', status: 'En revisión', observation: 'La documentación será revisada por Tutoría.', derivedBy: '', createdBy: 'USR-005', createdAt: '2026-10-17T13:00:00.000Z' },
    ],
    notifications: [
      { id: 'NOT-001', userId: 'USR-002', title: 'Boleta autorizada', message: 'La solicitud SOL-024 fue autorizada por Coordinación.', date: '2026-10-08T14:00:00.000Z', read: false },
      { id: 'NOT-002', userId: 'USR-002', title: 'Asistencia guardada', message: 'El registro de Desarrollo de aplicaciones web está actualizado.', date: '2026-10-08T08:15:00.000Z', read: true },
      { id: 'NOT-003', userId: 'USR-005', studentId: 'EST-002', title: 'Boleta de salida autorizada', message: 'La solicitud SOL-026 de Valeria fue aprobada por Coordinación.', date: '2026-10-18T14:20:00.000Z', read: false },
      { id: 'NOT-004', userId: 'USR-005', studentId: 'EST-002', title: 'Reunión pendiente de confirmación', message: 'Confirme la reunión de Tutoría programada para el 22 de octubre.', date: '2026-10-17T18:10:00.000Z', read: false },
    ],
    notices: [
      { id: 'AVI-001', title: 'Reunión informativa del periodo', message: 'Convocatoria dirigida a estudiantes y familias.', audience: 'Todos', date: '2026-10-08T13:00:00.000Z' },
      { id: 'AVI-002', title: 'Campaña de permanencia estudiantil', message: 'Orientación y acompañamiento disponibles en Tutoría.', audience: 'Todos', date: '2026-10-07T15:30:00.000Z' },
      { id: 'AVI-003', studentId: 'EST-002', title: 'Recordatorio de puntualidad', message: 'Revise el horario de ingreso correspondiente al grupo IV-A.', audience: 'Familia', date: '2026-10-16T14:00:00.000Z' },
    ],
    familyAudit: [],
    studentAudit: [],
  };
}

function initialDatabase() {
  if (demoMode) return seedDatabase();
  const password = configuredPassword('SIGA_BOOTSTRAP_ADMIN_PASSWORD');
  const email = String(process.env.SIGA_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const name = String(process.env.SIGA_BOOTSTRAP_ADMIN_NAME || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 3) throw new Error('Para crear una base institucional defina SIGA_BOOTSTRAP_ADMIN_NAME y SIGA_BOOTSTRAP_ADMIN_EMAIL.');
  return {
    schemaVersion: databaseSchemaVersion,
    programs: defaultPrograms.map((programName, index) => ({ id: `PRO-${String(index + 1).padStart(3, '0')}`, name: programName, state: 'Activo' })),
    nextIds: { student: 1, staff: 1, class: 1 },
    accounts: [{ id: `USR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name, email, username: email.split('@')[0], document: '', institutionalCode: 'ADM-001', position: 'Administrador del sistema', phone: '', address: '', bio: '', role: 'administrador', roles: ['administrador'], passwordHash: hashPassword(password), state: 'Activo' }],
  };
}

fs.mkdirSync(dataDirectory, { recursive: true });
fs.mkdirSync(profilePhotoDirectory, { recursive: true });
fs.mkdirSync(tutorEvidenceDirectory, { recursive: true });
fs.mkdirSync(familyEvidenceDirectory, { recursive: true });
fs.mkdirSync(guardEvidenceDirectory, { recursive: true });
fs.mkdirSync(studentEvidenceDirectory, { recursive: true });
const sessionSecretPath = path.join(dataDirectory, '.session-secret');
const configuredSessionSecret = String(process.env.SIGA_SESSION_SECRET || '').trim();
if (configuredSessionSecret && configuredSessionSecret.length < 43) throw new Error('SIGA_SESSION_SECRET debe contener al menos 256 bits codificados de forma segura.');
if (!configuredSessionSecret && !fs.existsSync(sessionSecretPath)) {
  fs.writeFileSync(sessionSecretPath, crypto.randomBytes(48).toString('base64url'), { flag: 'wx', mode: 0o600 });
}
const sessionSecret = configuredSessionSecret || fs.readFileSync(sessionSecretPath, 'utf8').trim();
const productionErrors = productionConfigurationErrors();
if (productionErrors.length) {
  throw new Error(`Configuración de producción rechazada:\n- ${productionErrors.join('\n- ')}`);
}

function persistSecurityState() {
  const temporaryPath = `${securityStatePath}.${process.pid}.tmp`;
  const state = {
    revokedSessions: [...revokedSessions.entries()],
    loginAttempts: [...loginAttempts.entries()],
  };
  fs.writeFileSync(temporaryPath, JSON.stringify(state), { mode: 0o600 });
  try {
    fs.renameSync(temporaryPath, securityStatePath);
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EEXIST'].includes(error.code)) throw error;
    fs.copyFileSync(temporaryPath, securityStatePath);
    fs.unlinkSync(temporaryPath);
  }
}

function loadSecurityState() {
  if (!fs.existsSync(securityStatePath)) return;
  try {
    const state = JSON.parse(fs.readFileSync(securityStatePath, 'utf8'));
    const now = Date.now();
    for (const [id, expiresAt] of state.revokedSessions || []) {
      if (Number(expiresAt) > now) revokedSessions.set(String(id), Number(expiresAt));
    }
    for (const [key, attempt] of state.loginAttempts || []) {
      if (Number(attempt?.resetAt) > now) loginAttempts.set(String(key), { count: Number(attempt.count) || 0, resetAt: Number(attempt.resetAt) });
    }
  } catch (error) {
    console.warn(`No se pudo recuperar el estado de seguridad: ${error.message}`);
  }
}

function loginAttemptKey(request, identifier) {
  return crypto.createHmac('sha256', sessionSecret)
    .update(`${request.ip}|${identifier || 'sin-identificador'}`)
    .digest('hex');
}

loadSecurityState();

function loadUsageMetrics() {
  if (!fs.existsSync(usageMetricsPath)) return;
  try {
    const items = JSON.parse(fs.readFileSync(usageMetricsPath, 'utf8'));
    for (const item of Array.isArray(items) ? items : []) {
      if (item?.key && Number.isFinite(item.count)) usageMetrics.set(item.key, item);
    }
  } catch (error) {
    console.warn(`No se pudieron recuperar las métricas internas: ${error.message}`);
  }
}

function persistUsageMetrics() {
  if (!usageMetricsDirty) return;
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const [key, item] of usageMetrics.entries()) if (new Date(item.date).getTime() < cutoff) usageMetrics.delete(key);
  const temporaryPath = `${usageMetricsPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify([...usageMetrics.values()], null, 2), { mode: 0o600 });
  try {
    fs.renameSync(temporaryPath, usageMetricsPath);
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EEXIST'].includes(error.code)) throw error;
    fs.copyFileSync(temporaryPath, usageMetricsPath);
    fs.unlinkSync(temporaryPath);
  }
  usageMetricsDirty = false;
}

function usageMetricName(request) {
  if (request.path === '/api/login') return 'login';
  const api = request.path.match(/^\/api\/(admin|coordinator|teacher|tutor|student|parent|guard)\/([^/]+)/);
  if (api) return `${api[1]}/${api[2]}`;
  const page = request.path.match(/^\/pages\/([^/]+)\/([^/.]+)/);
  if (page) return `page/${page[1]}/${page[2]}`;
  return '';
}

function recordUsageMetric(request, statusCode, durationMs) {
  const name = usageMetricName(request);
  if (!name) return;
  const date = limaDate();
  const status = `${Math.floor(statusCode / 100)}xx`;
  const key = `${date}|${request.method}|${name}|${status}`;
  const current = usageMetrics.get(key) || { key, date, method: request.method, event: name, status, count: 0, totalDurationMs: 0, maximumDurationMs: 0 };
  current.count += 1;
  current.totalDurationMs = Number((current.totalDurationMs + durationMs).toFixed(1));
  current.maximumDurationMs = Math.max(current.maximumDurationMs, Number(durationMs.toFixed(1)));
  usageMetrics.set(key, current);
  usageMetricsDirty = true;
}

loadUsageMetrics();
const processLockPath = path.join(dataDirectory, '.siga.lock');
function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
if (storageProvider === 'json') {
  if (fs.existsSync(processLockPath)) {
    const previousPid = Number(fs.readFileSync(processLockPath, 'utf8'));
    if (previousPid !== process.pid && processIsRunning(previousPid)) throw new Error(`Otra instancia de SIGA ya utiliza esta base de datos (PID ${previousPid}).`);
  }
  fs.writeFileSync(processLockPath, String(process.pid), { flag: 'w' });
  process.once('exit', () => {
    try { if (fs.existsSync(processLockPath) && fs.readFileSync(processLockPath, 'utf8') === String(process.pid)) fs.unlinkSync(processLockPath); } catch {}
  });
}
const databaseBackupPath = `${databasePath}.bak`;
let database;
if (fs.existsSync(databasePath)) {
  try {
    database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  } catch (error) {
    if (!fs.existsSync(databaseBackupPath)) throw new Error(`No se pudo abrir la base de datos SIGA: ${error.message}`);
    database = JSON.parse(fs.readFileSync(databaseBackupPath, 'utf8'));
    if (storageProvider === 'json') fs.copyFileSync(databaseBackupPath, databasePath);
    console.warn('SIGA recuperó la base de datos desde la copia de seguridad.');
  }
} else {
  database = initialDatabase();
  if (storageProvider === 'json') fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));
}
if (!Array.isArray(database.passwordRecoveryRequests)) database.passwordRecoveryRequests = [];
if (!Array.isArray(database.securityAudit)) database.securityAudit = [];
const saveDatabase = () => {
  if (storageProvider === 'sqlserver') {
    if (!sqlServerStore) return Promise.resolve();
    const snapshot = JSON.parse(JSON.stringify(database));
    const operation = sqlSaveQueue
      .then(() => sqlServerStore.save(snapshot))
      .catch(async (error) => {
        if (error.code === 'SIGA_WRITE_CONFLICT') {
          const latest = await sqlServerStore.load();
          if (latest) {
            database = latest;
            programs = (database.programs || []).filter((item) => item.state !== 'Inactivo').map((item) => item.name);
          }
        }
        throw error;
      });
    sqlSaveQueue = operation.catch((error) => {
      console.error(JSON.stringify({ level: 'error', event: 'database_save_failed', message: error.message, code: error.code || '' }));
      operationalAlert('database_save_failed', { code: error.code || '' });
    });
    const context = requestContext.getStore();
    if (context) context.pendingSaves.push(operation);
    return operation;
  }
  const temporaryPath = `${databasePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(database, null, 2));
  if (fs.existsSync(databasePath)) fs.copyFileSync(databasePath, databaseBackupPath);
  try {
    fs.renameSync(temporaryPath, databasePath);
  } catch (error) {
    // Windows y algunas carpetas sincronizadas pueden bloquear el rename.
    if (!['EPERM', 'EACCES', 'EEXIST'].includes(error.code)) throw error;
    fs.copyFileSync(temporaryPath, databasePath);
    fs.unlinkSync(temporaryPath);
  }
  return Promise.resolve();
};

function migrateIndependentTutorAccounts() {
  let changed = false;
  for (const account of Array.isArray(database.accounts) ? database.accounts : []) {
    const previousRoles = accountRoles(account);
    if (account.role === 'tutor') {
      account.role = 'docente';
      if (!account.position || /^Tutor/i.test(account.position)) account.position = 'Docente con función de tutor';
      changed = true;
    }
    if (previousRoles.includes('tutor')) {
      const roles = [...new Set(['docente', 'tutor', ...previousRoles.filter((role) => role !== 'docente' && role !== 'tutor')])];
      if (JSON.stringify(account.roles || []) !== JSON.stringify(roles)) {
        account.roles = roles;
        changed = true;
      }
    }
  }
  for (const item of Array.isArray(database.staff) ? database.staff : []) {
    const account = linkedAccountForStaff(item);
    const hasTutorFunction = item.role === 'Tutor' || accountRoles(account || item).includes('tutor');
    if (!hasTutorFunction) continue;
    if (item.role === 'Tutor') {
      item.role = 'Docente';
      changed = true;
    }
    const roles = [...new Set(['docente', 'tutor', ...(Array.isArray(item.roles) ? item.roles : [])])];
    if (JSON.stringify(item.roles || []) !== JSON.stringify(roles)) {
      item.roles = roles;
      changed = true;
    }
  }
  return changed;
}

function activeTutorAccountForStaff(item) {
  if (!item || item.state !== 'Activo') return null;
  const account = linkedAccountForStaff(item);
  if (!account || account.state !== 'Activo') return null;
  const roles = accountRoles(account);
  return roles.includes('docente') && roles.includes('tutor') ? account : null;
}

function normalizeTutorAssignments() {
  let changed = false;
  for (const student of Array.isArray(database.students) ? database.students : []) {
    if (!student.tutorId) continue;
    const tutor = (Array.isArray(database.staff) ? database.staff : []).find((item) => item.id === student.tutorId);
    const account = activeTutorAccountForStaff(tutor);
    if (!account || tutor.program !== student.program || account.program !== student.program) {
      student.tutorId = '';
      changed = true;
    }
  }
  return changed;
}

function normalizeStaffAccountConsistency() {
  let changed = false;
  for (const item of Array.isArray(database.staff) ? database.staff : []) {
    const account = (item.accountId ? (database.accounts || []).find((candidate) => candidate.id === item.accountId) : null)
      || (database.accounts || []).find((candidate) => String(candidate.email || '').toLowerCase() === String(item.email || '').toLowerCase());
    if (!account) {
      if (item.state === 'Activo') { item.state = 'Inactivo'; changed = true; }
      continue;
    }
    if (item.accountId !== account.id) { item.accountId = account.id; changed = true; }
    for (const key of ['name', 'email', 'documentType', 'document', 'state']) {
      if (account[key] && item[key] !== account[key]) {
        item[key] = account[key];
        changed = true;
      }
    }
    const assignedProgram = item.program === 'Institucional' ? '' : String(item.program || '');
    if (account.program !== assignedProgram) {
      account.program = assignedProgram;
      changed = true;
    }
    const additionalPrograms = item.role === 'Docente' && Array.isArray(item.additionalPrograms) ? item.additionalPrograms : [];
    if (JSON.stringify(account.additionalPrograms || []) !== JSON.stringify(additionalPrograms)) {
      account.additionalPrograms = [...additionalPrograms];
      changed = true;
    }
    if (item.role === 'Vigilante') {
      const shift = String(item.shift || account.shift || '');
      const pointOfControl = String(item.pointOfControl || account.pointOfControl || 'Puerta principal');
      if (item.shift !== shift) { item.shift = shift; changed = true; }
      if (item.pointOfControl !== pointOfControl) { item.pointOfControl = pointOfControl; changed = true; }
      if (account.shift !== shift) { account.shift = shift; changed = true; }
      if (account.pointOfControl !== pointOfControl) { account.pointOfControl = pointOfControl; changed = true; }
    }
  }
  return changed;
}

async function initializePersistence() {
  if (storageProvider !== 'sqlserver') return;
  sqlServerStore = await openSqlServerStore();
  const storedDatabase = await sqlServerStore.load();
  if (storedDatabase) {
    database = storedDatabase;
    if (!Array.isArray(database.passwordRecoveryRequests)) database.passwordRecoveryRequests = [];
    if (!Array.isArray(database.securityAudit)) database.securityAudit = [];
    if (!Array.isArray(database.adminAudit)) database.adminAudit = [];
    migrateIndependentTutorAccounts();
    normalizeStaffAccountConsistency();
    normalizeTutorAssignments();
    database.schemaVersion = databaseSchemaVersion;
    await sqlServerStore.save(database);
  } else {
    await sqlServerStore.save(database);
  }
  programs = (database.programs || [])
    .filter((item) => item.state !== 'Inactivo')
    .map((item) => item.name);
  console.log(`SIGA conectado a SQL Server. Esquema lógico ${database.schemaVersion || 1}.`);
}

async function closePersistence() {
  persistUsageMetrics();
  await sqlSaveQueue.catch(() => {});
  if (sqlServerStore) await sqlServerStore.close();
  sqlServerStore = null;
}

// Vincula registros antiguos con sus cuentas sin depender permanentemente del correo.
let migratedDatabase = false;
if (demoMode && process.env.SIGA_RUN_LEGACY_DEMO_MIGRATIONS === 'true') {
database.accounts.forEach((account) => {
  if (!Array.isArray(account.roles) || !account.roles.length) {
    account.roles = [account.role];
    migratedDatabase = true;
  }
  if (account.id === 'USR-002') {
    if (account.name === 'Docente SIGA') account.name = 'Rosa Verónica Agurto Ortiz';
    if (!account.roles.includes('tutor')) account.roles.push('tutor');
    if (!account.program) account.program = programs[3];
    if (!account.username) account.username = 'rosa.agurto';
    if (!account.institutionalCode) account.institutionalCode = 'DOC-001';
    if (!account.position) account.position = 'Docente';
    migratedDatabase = true;
  }
  if (account.role === 'coordinador' && !account.program) {
    account.program = programs[2];
    migratedDatabase = true;
  }
  if (account.id === 'USR-003') {
    if (account.name === 'Coordinador SIGA') account.name = 'Ana Rodríguez Silva';
    if (!account.roles.includes('docente')) account.roles.push('docente');
    if (!account.username) account.username = 'ana.rodriguez';
    if (!account.document) account.document = '43456789';
    if (!account.institutionalCode) account.institutionalCode = 'COO-001';
    if (!account.position) account.position = 'Coordinadora académica';
    migratedDatabase = true;
  }
  if (account.id === 'USR-007' && !account.studentId) {
    account.studentId = 'EST-003';
    migratedDatabase = true;
  }
});
const defaults = seedDatabase();
if (!database.accounts.some((item) => item.id === 'USR-008')) {
  database.accounts.push(defaults.accounts.find((item) => item.id === 'USR-008'));
  migratedDatabase = true;
}
if (!database.accounts.some((item) => item.id === 'USR-009')) {
  database.accounts.push(defaults.accounts.find((item) => item.id === 'USR-009'));
  migratedDatabase = true;
}
for (const studentAccountId of ['USR-007', 'USR-008']) {
  const account = database.accounts.find((item) => item.id === studentAccountId);
  const fallback = defaults.accounts.find((item) => item.id === studentAccountId);
  if (!account || !fallback) continue;
  const linkedStudent = database.students.find((item) => item.id === account.studentId);
  if (linkedStudent && (account.name === 'Estudiante SIGA' || !account.name)) { account.name = linkedStudent.name; migratedDatabase = true; }
  for (const key of ['username', 'contactEmail', 'phone']) {
    if (!account[key]) { account[key] = fallback[key]; migratedDatabase = true; }
  }
  if (!Array.isArray(account.notificationPreferences)) {
    account.notificationPreferences = [...fallback.notificationPreferences];
    migratedDatabase = true;
  }
}
for (const key of ['classes', 'teacherAttendance', 'attendanceAudit', 'exitRequests', 'permanenceIncidents', 'coordinatorAudit', 'exitValidations', 'guardAttempts', 'guardIncidents', 'guardAlertReviews', 'guardAccessEntries', 'tutorCases', 'tutorAudit', 'tutorAlerts', 'tutorMessages', 'tutorMeetings', 'tutorJustifications', 'notifications', 'notices', 'familyAudit', 'studentAudit']) {
  if (!Array.isArray(database[key])) {
    database[key] = defaults[key];
    migratedDatabase = true;
  }
}
const parentAccount = database.accounts.find((item) => item.id === 'USR-005');
if (parentAccount && (!Array.isArray(parentAccount.studentIds) || !parentAccount.studentIds.length)) {
  parentAccount.studentIds = ['EST-002'];
  migratedDatabase = true;
}
if (parentAccount) {
  const familyDefaults = defaults.accounts.find((item) => item.id === 'USR-005');
  for (const key of ['username','document','position','phone']) {
    if (!parentAccount[key]) { parentAccount[key] = familyDefaults[key]; migratedDatabase = true; }
  }
  if (!Array.isArray(parentAccount.notificationPreferences)) {
    parentAccount.notificationPreferences = [...familyDefaults.notificationPreferences];
    migratedDatabase = true;
  }
}
const guardAccount = database.accounts.find((item) => item.id === 'USR-006');
if (guardAccount) {
  const guardDefaults = defaults.accounts.find((item) => item.id === 'USR-006');
  for (const key of ['username','document','institutionalCode','position','shift','pointOfControl']) {
    if (!guardAccount[key]) { guardAccount[key] = guardDefaults[key]; migratedDatabase = true; }
  }
}
if (!database.classes.some((item) => item.id === 'CLS-003')) {
  database.classes.push(defaults.classes.find((item) => item.id === 'CLS-003'));
  migratedDatabase = true;
}
if (!database.teacherAttendance.some((item) => item.id === 'ASI-003')) {
  database.teacherAttendance.push(defaults.teacherAttendance.find((item) => item.id === 'ASI-003'));
  migratedDatabase = true;
}
const coordinatorStudentRecord = database.students.find((item) => item.id === 'EST-003');
if (coordinatorStudentRecord && !coordinatorStudentRecord.group) {
  coordinatorStudentRecord.group = 'II-A';
  coordinatorStudentRecord.tutorId = coordinatorStudentRecord.tutorId || '';
  migratedDatabase = true;
}
const familyStudentRecord = database.students.find((item) => item.id === 'EST-002');
if (familyStudentRecord) {
  if (!familyStudentRecord.group) { familyStudentRecord.group = 'IV-A'; migratedDatabase = true; }
  if (!familyStudentRecord.tutorId) { familyStudentRecord.tutorId = 'PER-009'; migratedDatabase = true; }
}
const familySeedRecords = {
  staff: ['PER-009'],
  classes: ['CLS-005'],
  teacherAttendance: ['ASI-005','ASI-006','ASI-007'],
  exitRequests: ['SOL-026'],
  tutorCases: ['TCA-003'],
  tutorMeetings: ['REU-002'],
  tutorJustifications: ['JUS-002'],
  notifications: ['NOT-003','NOT-004'],
  notices: ['AVI-003'],
};
for (const [collection, ids] of Object.entries(familySeedRecords)) {
  for (const id of ids) {
    if (!database[collection].some((item) => item.id === id)) {
      const source = defaults[collection].find((item) => item.id === id);
      if (source) { database[collection].push(source); migratedDatabase = true; }
    }
  }
}
const sharedStudentCase = database.tutorCases.find((item) => item.id === 'TCA-003');
if (sharedStudentCase && sharedStudentCase.sharedWithStudent !== true) {
  sharedStudentCase.sharedWithStudent = true;
  migratedDatabase = true;
}
if (database.nextIds && Number(database.nextIds.staff || 0) < 10) { database.nextIds.staff = 10; migratedDatabase = true; }
if (!database.nextIds) { database.nextIds = { student: 5, staff: 10, class: 6 }; migratedDatabase = true; }
if (Number(database.nextIds.class || 0) < 6) { database.nextIds.class = 6; migratedDatabase = true; }
const tutorAssignments = { 'EST-001': { group: 'III-A', tutorId: 'PER-001' }, 'EST-004': { group: 'VI-A', tutorId: 'PER-005' } };
database.students.forEach((item) => {
  const assignment = tutorAssignments[item.id];
  if (!assignment) return;
  if (!item.group) { item.group = assignment.group; migratedDatabase = true; }
  if (!item.tutorId) { item.tutorId = assignment.tutorId; migratedDatabase = true; }
});
const tutorAccount = database.accounts.find((item) => item.id === 'USR-004');
if (tutorAccount) {
  const tutorDefaults = defaults.accounts.find((item) => item.id === 'USR-004');
  for (const key of ['name','username','document','institutionalCode','position','program']) if (!tutorAccount[key] || tutorAccount.name === 'Tutor SIGA') { tutorAccount[key] = tutorDefaults[key]; migratedDatabase = true; }
  const tutorRoles = accountRoles(tutorAccount);
  if (!tutorRoles.includes('docente')) { tutorAccount.roles = [...tutorRoles, 'docente']; migratedDatabase = true; }
}
for (const classItem of defaults.classes.filter((item) => item.teacherId === 'USR-004')) {
  if (!database.classes.some((item) => item.id === classItem.id)) { database.classes.push(classItem); migratedDatabase = true; }
}
for (const attendanceItem of defaults.teacherAttendance.filter((item) => item.teacherId === 'USR-004')) {
  if (!database.teacherAttendance.some((item) => item.id === attendanceItem.id)) { database.teacherAttendance.push(attendanceItem); migratedDatabase = true; }
}
database.staff.forEach((item) => {
  if (item.accountId) return;
  const account = database.accounts.find((candidate) => candidate.email.toLowerCase() === item.email.toLowerCase());
  if (account) {
    item.accountId = account.id;
    migratedDatabase = true;
  }
});
const primaryTeacher = database.staff.find((item) => item.id === 'PER-001');
if (primaryTeacher && !primaryTeacher.accountId) {
  primaryTeacher.accountId = 'USR-002';
  migratedDatabase = true;
}
const legacyAccountLinks = { 'PER-002': 'USR-001', 'PER-004': 'USR-003', 'PER-005': 'USR-004', 'PER-006': 'USR-005', 'PER-007': 'USR-006', 'PER-009': 'USR-009' };
database.staff.forEach((item) => {
  if (!item.accountId && legacyAccountLinks[item.id] && database.accounts.some((account) => account.id === legacyAccountLinks[item.id])) {
    item.accountId = legacyAccountLinks[item.id];
    migratedDatabase = true;
  }
});
}

const databaseCollections = [
  'accounts','students','staff','classes','teacherAttendance','attendanceAudit','exitRequests',
  'permanenceIncidents','coordinatorAudit','exitValidations','guardAttempts','guardIncidents',
  'guardAlertReviews','guardAccessEntries','tutorCases','tutorAudit','tutorAlerts','tutorMessages',
  'tutorMeetings','tutorJustifications','notifications','notices','familyAudit','studentAudit','adminAudit',
];
for (const key of databaseCollections) {
  if (!Array.isArray(database[key])) { database[key] = []; migratedDatabase = true; }
}
if (!database.nextIds || typeof database.nextIds !== 'object') {
  database.nextIds = { student: 1, staff: 1, class: 1 };
  migratedDatabase = true;
}
if (!Array.isArray(database.programs)) {
  const usedNames = new Set([
    ...defaultPrograms,
    ...database.students.map((item) => item.program),
    ...database.staff.map((item) => item.program),
    ...database.classes.map((item) => item.program),
  ].filter((name) => name && name !== 'Institucional'));
  database.programs = [...usedNames].map((name, index) => ({ id: `PRO-${String(index + 1).padStart(3, '0')}`, name, state: 'Activo' }));
  migratedDatabase = true;
}
database.accounts.forEach((account) => {
  if (!Array.isArray(account.roles) || !account.roles.length) { account.roles = [account.role]; migratedDatabase = true; }
  if (account.role === 'padre' && !Array.isArray(account.studentIds)) { account.studentIds = []; migratedDatabase = true; }
  if (account.role === 'estudiante' && !account.studentId) {
    const student = database.students.find((item) => String(item.email).toLowerCase() === String(account.email).toLowerCase());
    if (student) { account.studentId = student.id; migratedDatabase = true; }
  }
  const linkedStudent = account.studentId ? database.students.find((item) => item.id === account.studentId) : null;
  const linkedStaff = database.staff.find((item) => item.accountId === account.id || String(item.email).toLowerCase() === String(account.email).toLowerCase());
  const identity = linkedStudent || linkedStaff;
  if (!account.document && identity?.document) { account.document = identity.document; migratedDatabase = true; }
  if (!account.documentType && (account.document || identity?.documentType)) { account.documentType = identity?.documentType || 'DNI'; migratedDatabase = true; }
});
database.staff.forEach((item) => {
  if (!item.documentType) { item.documentType = 'DNI'; migratedDatabase = true; }
  if (item.accountId) return;
  const account = database.accounts.find((candidate) => String(candidate.email).toLowerCase() === String(item.email).toLowerCase());
  if (account) { item.accountId = account.id; migratedDatabase = true; }
});
if (migrateIndependentTutorAccounts()) migratedDatabase = true;
if (normalizeStaffAccountConsistency()) migratedDatabase = true;
database.students.forEach((item) => {
  if (!item.documentType) { item.documentType = 'DNI'; migratedDatabase = true; }
  if (typeof item.group !== 'string') { item.group = ''; migratedDatabase = true; }
  if (typeof item.tutorId !== 'string') { item.tutorId = ''; migratedDatabase = true; }
});
if (normalizeTutorAssignments()) migratedDatabase = true;
if (database.schemaVersion !== databaseSchemaVersion) { database.schemaVersion = databaseSchemaVersion; migratedDatabase = true; }
programs = database.programs.filter((item) => item.state === 'Activo').map((item) => item.name);
if (migratedDatabase) saveDatabase();

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeSession(token) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest();
  let received;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (received.toString('base64url') !== signature || received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session || typeof session !== 'object') return null;
    return session;
  } catch {
    return null;
  }
}

function encodeStudentAccessQr(studentId, date = limaDate()) {
  const payload = Buffer.from(JSON.stringify({ studentId, date, purpose: 'student-access', version: 1 })).toString('base64url');
  const signedValue = `SIGA-ACCESS.${payload}`;
  const signature = crypto.createHmac('sha256', sessionSecret).update(signedValue).digest('base64url');
  return `${signedValue}.${signature}`;
}

function decodeStudentAccessQr(code) {
  const [prefix, payload, signature, extra] = String(code || '').trim().split('.');
  if (prefix !== 'SIGA-ACCESS' || !payload || !signature || extra) return null;
  const signedValue = `${prefix}.${payload}`;
  const expected = crypto.createHmac('sha256', sessionSecret).update(signedValue).digest();
  let received;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (received.toString('base64url') !== signature || received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded?.purpose !== 'student-access' || decoded?.version !== 1 || decoded?.date !== limaDate() || !decoded?.studentId) return null;
    return decoded;
  } catch {
    return null;
  }
}

function currentSession(request) {
  const token = parseCookies(request).siga_session;
  const session = decodeSession(token);
  if (!session || session.expiresAt < Date.now() || revokedSessions.has(session.id)) return null;
  const account = database.accounts.find((item) => item.id === session.userId);
  if (!account || Number(account.sessionVersion || 0) !== Number(session.version || 0)) return null;
  return { ...session, token };
}

function accountRoles(account) {
  return [...new Set([...(Array.isArray(account.roles) ? account.roles : []), account.role].filter(Boolean))];
}

function limaDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function limaTime(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function revokeSessions(userId) {
  const account = database.accounts.find((item) => item.id === userId);
  if (!account) return;
  account.sessionVersion = Number(account.sessionVersion || 0) + 1;
}

function createSession(response, account, request, activeRole = account.role) {
  const session = { id: crypto.randomUUID(), userId: account.id, role: activeRole, csrf: crypto.randomBytes(24).toString('hex'), version: Number(account.sessionVersion || 0), expiresAt: Date.now() + sessionDuration };
  const token = encodeSession(session);
  const secure = request.secure;
  response.setHeader('Set-Cookie', `siga_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDuration / 1000}${secure ? '; Secure' : ''}`);
  return { ...session, token };
}

function requireAuth(request, response, next) {
  const session = currentSession(request);
  if (!session) return response.status(401).json({ error: 'Sesión no válida. Inicie sesión nuevamente.' });
  const account = database.accounts.find((item) => item.id === session.userId);
  if (!account || account.state !== 'Activo') {
    response.setHeader('Set-Cookie', 'siga_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return response.status(401).json({ error: 'La cuenta ya no está activa. Inicie sesión nuevamente.' });
  }
  if (!accountRoles(account).includes(session.role)) session.role = account.role;
  request.session = session;
  request.account = account;
  next();
}

function requireAdmin(request, response, next) {
  requireAuth(request, response, () => {
    if (request.session.role !== 'administrador' || !accountRoles(request.account).includes('administrador')) return response.status(403).json({ error: 'Acceso reservado al Administrador.' });
    next();
  });
}

function requireRole(role, message) {
  return (request, response, next) => requireAuth(request, response, () => {
    if (request.session.role !== role || !accountRoles(request.account).includes(role)) return response.status(403).json({ error: message || 'No tiene permisos para realizar esta operación.' });
    next();
  });
}

const requireCoordinator = requireRole('coordinador', 'Acceso reservado al Coordinador.');
const requireTutor = requireRole('tutor', 'Acceso reservado al Tutor.');

function requireCsrf(request, response, next) {
  if (!request.session || request.get('x-csrf-token') !== request.session.csrf) return response.status(403).json({ error: 'La solicitud de seguridad no es válida.' });
  next();
}

function publicAccount(account, csrf, activeRole = account.role) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    username: account.username || '',
    document: account.document || '',
    documentType: account.documentType || 'DNI',
    institutionalCode: account.institutionalCode || '',
    position: account.position || '',
    phone: account.phone || '',
    address: account.address || '',
    bio: account.bio || '',
    program: account.program || '',
    shift: account.shift || '',
    pointOfControl: account.pointOfControl || '',
    notificationPreferences: Array.isArray(account.notificationPreferences) ? account.notificationPreferences : [],
    role: activeRole,
    roles: accountRoles(account),
    state: account.state,
    photoUrl: account.photoFile ? '/api/account/photo' : '',
    csrf,
  };
}

function imageExtension(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return '';
}

function evidenceExtension(buffer) {
  const image = imageExtension(buffer);
  if (image) return image;
  if (buffer.length < 12 || buffer.subarray(0, 5).toString() !== '%PDF-') return '';
  const ending = buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1');
  if (!ending.includes('%%EOF')) return '';
  // Las evidencias no requieren acciones, adjuntos ni JavaScript embebido.
  const source = buffer.toString('latin1');
  if (/\/(?:JavaScript|JS|OpenAction|Launch|EmbeddedFile|RichMedia)\b/i.test(source)) return '';
  return 'pdf';
}

function antimalwareArguments(filePath) {
  const raw = String(process.env.SIGA_ANTIMALWARE_ARGS_JSON || '["--no-summary","{file}"]');
  let values;
  try { values = JSON.parse(raw); } catch { throw new Error('SIGA_ANTIMALWARE_ARGS_JSON debe ser un arreglo JSON válido.'); }
  if (!Array.isArray(values) || !values.every((item) => typeof item === 'string')) throw new Error('SIGA_ANTIMALWARE_ARGS_JSON debe contener únicamente textos.');
  return values.map((item) => item.replaceAll('{file}', filePath));
}

async function scanEvidence(buffer) {
  const command = String(process.env.SIGA_ANTIMALWARE_COMMAND || '').trim();
  if (!command) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('El servicio de análisis antimalware no está configurado.');
      error.code = 'SIGA_ANTIMALWARE_UNAVAILABLE';
      throw error;
    }
    return;
  }
  fs.mkdirSync(quarantineDirectory, { recursive: true });
  const temporaryPath = path.join(quarantineDirectory, `${crypto.randomUUID()}.upload`);
  await fs.promises.writeFile(temporaryPath, buffer, { flag: 'wx', mode: 0o600 });
  try {
    await execFileAsync(command, antimalwareArguments(temporaryPath), { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
  } catch (cause) {
    const error = new Error(cause.code === 'ENOENT' ? 'El servicio antimalware no está disponible.' : 'El archivo fue rechazado por el control antimalware.');
    error.code = cause.code === 'ENOENT' ? 'SIGA_ANTIMALWARE_UNAVAILABLE' : 'SIGA_ANTIMALWARE_REJECTED';
    throw error;
  } finally {
    await fs.promises.unlink(temporaryPath).catch(() => {});
  }
}

async function storeEvidence(file, directory, prefix) {
  if (!file) return { evidenceFile: '', evidenceName: '' };
  const extension = evidenceExtension(file.buffer);
  if (!extension) return { error: 'La evidencia debe ser una imagen o un PDF válido y sin contenido activo.' };
  await scanEvidence(file.buffer);
  const filename = `${prefix}-${crypto.randomUUID()}.${extension}`;
  await fs.promises.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx', mode: 0o600 });
  return { evidenceFile: filename, evidenceName: path.basename(file.originalname).slice(0, 120) };
}

function removeProfilePhoto(account) {
  if (!account.photoFile) return;
  const filename = path.basename(account.photoFile);
  const target = path.join(profilePhotoDirectory, filename);
  if (fs.existsSync(target)) fs.unlinkSync(target);
  delete account.photoFile;
}

function normalizeDocumentType(value) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  return ['CE', 'CARNET DE EXTRANJERIA', 'CARNE DE EXTRANJERIA'].includes(normalized) ? 'CE' : normalized;
}

function normalizeDocument(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function validateIdentityDocument(body) {
  body.documentType = normalizeDocumentType(body.documentType);
  body.document = normalizeDocument(body.document);
  if (!documentTypes.includes(body.documentType)) return 'Seleccione DNI o Carné de extranjería.';
  if (body.documentType === 'DNI' && !/^\d{8}$/.test(body.document)) return 'El DNI debe contener exactamente 8 dígitos numéricos.';
  if (body.documentType === 'CE' && !/^[A-Z0-9]{9,15}$/.test(body.document)) return 'El Carné de Extranjería debe contener más de 8 caracteres y tener un formato válido.';
  return '';
}

function teacherPrograms(item) {
  if (item?.program === 'Empleabilidad' && (item.role === 'Docente' || accountRoles(item).includes('docente'))) return [...programs];
  return [...new Set([item?.program, ...(Array.isArray(item?.additionalPrograms) ? item.additionalPrograms : [])].filter((value) => programs.includes(value)))];
}

function validateAdditionalPrograms(body) {
  const values = body.additionalPrograms === undefined ? [] : body.additionalPrograms;
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !programs.includes(value))) return 'Seleccione programas adicionales válidos.';
  if (values.length && body.role !== 'Docente') return 'Los programas adicionales solo están disponibles para docentes.';
  if (new Set(values).size !== values.length || values.includes(body.program)) return 'No repita el programa principal ni los programas adicionales.';
  if (body.program === 'Empleabilidad' && values.length) return 'Empleabilidad ya comprende todos los programas; deje vacíos los programas adicionales.';
  body.additionalPrograms = values;
  return '';
}

function validatePerson(body, type) {
  if (type === 'staff' && body.role === 'Docente' && normalizedHeader(body.program) === 'empleabilidad') body.program = 'Empleabilidad';
  const required = ['name', 'documentType', 'document', 'email', 'state'];
  if (type === 'student') required.push('program', 'semester');
  if (type === 'staff') required.push('role', 'program');
  const missing = required.filter((key) => !String(body[key] || '').trim());
  if (missing.length) return `Complete los campos: ${missing.join(', ')}.`;
  const documentError = validateIdentityDocument(body);
  if (documentError) return documentError;
  if (!/^\S+@\S+\.\S+$/.test(body.email)) return 'Ingrese un correo válido.';
  if (!states.includes(body.state)) return 'El estado debe ser Activo o Inactivo.';
  const transversalTeacher = type === 'staff' && body.role === 'Docente' && body.program === 'Empleabilidad';
  if (body.program !== 'Institucional' && !transversalTeacher && !programs.includes(body.program)) return 'Seleccione un programa de estudios válido.';
  if (type === 'staff') {
    if (!staffRoles.includes(body.role)) return 'Seleccione un rol institucional válido.';
    const additionalError = validateAdditionalPrograms(body);
    if (additionalError) return additionalError;
    const institutionalRole = ['Administrador', 'Vigilante'].includes(body.role);
    if (institutionalRole && body.program !== 'Institucional') return 'Administradores y vigilantes deben usar el ámbito Institucional.';
    if (!institutionalRole && !transversalTeacher && !programs.includes(body.program)) return 'Seleccione el programa académico correspondiente al rol.';
    if (transversalTeacher && allowedAcademicRoles(body, body.role).some((role) => role === 'coordinador' || role === 'tutor')) return 'Un docente de Empleabilidad requiere un programa de estudios para ejercer coordinación o tutoría.';
    if (body.role === 'Vigilante' && body.shift && !guardShifts.includes(body.shift)) return 'Seleccione un turno válido para Vigilancia.';
    if (body.role === 'Vigilante' && String(body.pointOfControl || '').trim().length > 80) return 'El punto de control no debe superar 80 caracteres.';
  }
  return '';
}

function validPassword(password) {
  return String(password || '').length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function allowedAcademicRoles(body, primaryRole) {
  const allowed = new Set(['docente', 'coordinador', 'tutor']);
  const primary = roleKeys[primaryRole];
  if (!allowed.has(primary)) return primary ? [primary] : [];
  const requested = Array.isArray(body.roles) ? body.roles.map((role) => roleKeys[String(role)] || String(role).toLowerCase()) : [];
  const roles = new Set([primary, ...requested.filter((role) => allowed.has(role))]);
  if (roles.has('tutor')) roles.add('docente');
  return [...roles];
}

function accountFromStaff(item, password) {
  const role = roleKeys[item.role];
  return {
    id: `USR-${crypto.randomUUID().slice(0, 8)}`,
    name: item.name,
    email: item.email,
    username: item.username || '',
    documentType: item.documentType,
    document: item.document,
    institutionalCode: item.institutionalCode || '',
    position: item.position || item.role,
    phone: item.phone || '',
    program: item.program === 'Institucional' ? '' : item.program,
    additionalPrograms: item.role === 'Docente' ? item.additionalPrograms || [] : [],
    shift: item.role === 'Vigilante' ? item.shift || '' : '',
    pointOfControl: item.role === 'Vigilante' ? item.pointOfControl || 'Puerta principal' : '',
    role,
    roles: allowedAcademicRoles(item, item.role),
    passwordHash: hashPassword(password),
    state: item.state,
  };
}

function accountFromStudent(item, password) {
  return { id: `USR-${crypto.randomUUID().slice(0, 8)}`, studentId: item.id, name: item.name, email: item.email, username: item.email.split('@')[0], documentType: item.documentType, document: item.document, program: item.program, role: 'estudiante', roles: ['estudiante'], passwordHash: hashPassword(password), state: item.state };
}

function linkedAccountForStudent(item) {
  return database.accounts.find((account) => account.studentId === item.id) || database.accounts.find((account) => account.email.toLowerCase() === item.email.toLowerCase() && accountRoles(account).includes('estudiante'));
}

function linkedAccountForStaff(item) {
  return database.accounts.find((account) => account.id === item.accountId) || database.accounts.find((account) => account.email.toLowerCase() === item.email.toLowerCase());
}

function activeAdministratorCount(excludedId = '') {
  return database.accounts.filter((account) => account.id !== excludedId && accountRoles(account).includes('administrador') && account.state === 'Activo').length;
}

function accountDocumentConflict(document, excludedAccountId = '') {
  const normalized = normalizeDocument(document);
  return Boolean(normalized && database.accounts.some((account) => account.id !== excludedAccountId && normalizeDocument(account.document) === normalized));
}

function adminAuditLog(request, entity, entityId, action, detail) {
  database.adminAudit.unshift({
    id: `AAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    entity,
    entityId,
    action,
    detail,
    userId: request.account.id,
    userName: request.account.name,
    date: new Date().toISOString(),
  });
}

function staffDependencies(accountId, staffId = '') {
  const classes = accountId ? database.classes.filter((item) => item.teacherId === accountId).length : 0;
  const attendance = accountId ? database.teacherAttendance.filter((item) => item.teacherId === accountId).length : 0;
  const exits = accountId ? database.exitRequests.filter((item) => item.teacherId === accountId).length : 0;
  const tutorAssignments = staffId ? database.students.filter((item) => item.tutorId === staffId).length : 0;
  return { classes, attendance, exits, tutorAssignments, total: classes + attendance + exits + tutorAssignments };
}

function filteredRecords(records, query) {
  const search = String(query.search || '').toLowerCase();
  return records.filter((item) => (!search || Object.values(item).some((value) => String(value).toLowerCase().includes(search))) && (!query.program || item.program === query.program || (item.additionalPrograms || []).includes(query.program)) && (!query.semester || item.semester === query.semester) && (!query.state || item.state === query.state) && (!query.role || item.role === query.role));
}

function attendanceReport(query = {}) {
  const normalizedAttendance = database.teacherAttendance.map((item) => {
    const course = database.classes.find((candidate) => candidate.id === item.classId);
    return { date: item.date, program: course?.program || '', semester: course?.semester || '', state: item.state, total: 1 };
  }).filter((item) => item.program);
  const scopedEntries = normalizedAttendance.filter((item) => (!query.program || item.program === query.program || (item.additionalPrograms || []).includes(query.program)) && (!query.semester || item.semester === query.semester) && (!query.from || item.date >= query.from) && (!query.to || item.date <= query.to));
  const entries = scopedEntries.filter((item) => !query.state || item.state === query.state);
  const byProgram = programs.map((program) => ({ program, total: entries.filter((item) => item.program === program).reduce((sum, item) => sum + item.total, 0) }));
  const byState = attendanceStates.map((state) => ({ state, total: entries.filter((item) => item.state === state).reduce((sum, item) => sum + item.total, 0) }));
  const students = database.students.filter((item) => (!query.program || item.program === query.program || (item.additionalPrograms || []).includes(query.program)) && (!query.semester || item.semester === query.semester));
  const staff = database.staff.filter((item) => (!query.program || item.program === query.program || item.program === 'Institucional'));
  const studentByState = states.map((state) => ({ state, total: students.filter((item) => item.state === state).length }));
  const staffByRole = staffRoles.map((role) => ({ role, total: staff.filter((item) => item.role === role).length })).filter((item) => item.total > 0);
  const permanence = programs.map((program) => {
    const programEntries = scopedEntries.filter((item) => item.program === program);
    const total = programEntries.reduce((sum, item) => sum + item.total, 0);
    const absences = programEntries.filter((item) => item.state === 'Ausente').reduce((sum, item) => sum + item.total, 0);
    const absenceRate = total ? Math.round((absences / total) * 100) : 0;
    return { program, total, absences, absenceRate, level: absenceRate >= 10 ? 'Alerta' : absenceRate >= 5 ? 'Seguimiento' : 'Estable' };
  });
  return { entries, byProgram, byState, students: students.length, staff: staff.length, studentByState, staffByRole, permanence };
}

function addTemplateValidation(sheet, programColumn, stateColumn, roleColumn = '', allowedPrograms = programs, documentTypeColumn = 'A', startRow = 7, endRow = 506) {
  const lists = sheet.workbook.addWorksheet('Listas', { state: 'veryHidden' });
  states.forEach((value, index) => { lists.getCell(`A${index + 1}`).value = value; });
  allowedPrograms.forEach((value, index) => { lists.getCell(`B${index + 1}`).value = value; });
  staffRoles.forEach((value, index) => { lists.getCell(`C${index + 1}`).value = value; });
  documentTypes.forEach((value, index) => { lists.getCell(`D${index + 1}`).value = value; });
  ['I', 'II', 'III', 'IV', 'V', 'VI'].forEach((value, index) => { lists.getCell(`E${index + 1}`).value = value; });
  for (let row = startRow; row <= endRow; row += 1) {
    sheet.getCell(`${documentTypeColumn}${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Listas!$D$1:$D$${documentTypes.length}`], showErrorMessage: true, error: 'Seleccione DNI o CE.' };
    sheet.getCell(`${programColumn}${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Listas!$B$1:$B$${allowedPrograms.length}`], showErrorMessage: true, error: 'Seleccione el programa autorizado.' };
    sheet.getCell(`${stateColumn}${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Listas!$A$1:$A$${states.length}`], showErrorMessage: true, error: 'Seleccione Activo o Inactivo.' };
    if (roleColumn) sheet.getCell(`${roleColumn}${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Listas!$C$1:$C$${staffRoles.length}`], showErrorMessage: true, error: 'Seleccione un rol institucional.' };
    if (!roleColumn) sheet.getCell(`E${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Listas!$E$1:$E$6'], showErrorMessage: true, error: 'Seleccione un semestre de I a VI.' };
  }
}

async function sendTemplate(response, type, allowedPrograms = programs) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type === 'students' ? 'Estudiantes' : 'Personal');
  const headers = type === 'students' ? ['Tipo de documento', 'Documento', 'Nombres', 'Correo', 'Semestre', 'Grupo', 'Programa', 'Estado', 'Contraseña inicial'] : ['Tipo de documento', 'Documento', 'Nombres', 'Correo', 'Rol', 'Programa', 'Estado', 'Turno', 'Contraseña inicial'];
  const lastColumn = headers.length;
  const title = type === 'students' ? 'SIGA - Importación masiva de estudiantes' : 'SIGA - Importación masiva de personal';
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.mergeCells(3, 1, 3, lastColumn);
  sheet.mergeCells(4, 1, 4, lastColumn);
  sheet.getCell('A1').value = title;
  sheet.getCell('A2').value = '1. Reemplace la fila 7 por el primer registro y agregue los demás usuarios desde la fila 8. No cambie los encabezados.';
  sheet.getCell('A3').value = '2. Use las listas desplegables para Tipo de documento, Programa, Estado, Semestre o Turno cuando correspondan.';
  sheet.getCell('A4').value = '3. DNI: 8 dígitos. CE: de 9 a 15 letras o números. La contraseña debe incluir mayúscula, minúscula, número y símbolo.';
  sheet.getRow(6).values = headers;
  sheet.getRow(7).values = type === 'students'
    ? ['DNI', '72459631', 'Diego Mendoza Ruiz', 'estudiante.ejemplo@instituto.edu.pe', 'II', 'II-A', allowedPrograms[0] || '', 'Activo', 'ClaveSegura2026!']
    : ['DNI', '44567890', 'Nombre de ejemplo', 'personal.ejemplo@instituto.edu.pe', 'Docente', allowedPrograms[0] || '', 'Activo', 'Mañana', 'ClaveSegura2026!'];
  sheet.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];
  sheet.getRow(1).height = 34;
  sheet.getRow(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: type === 'students' ? 'FF2563EB' : 'FF2F6CBD' } };
  [2, 3, 4].forEach((rowNumber) => {
    const row = sheet.getRow(rowNumber);
    row.height = 23;
    row.font = { name: 'Arial', size: 10, color: { argb: 'FF536783' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } };
    row.alignment = { vertical: 'middle' };
  });
  sheet.getRow(5).height = 8;
  sheet.getRow(6).height = 30;
  sheet.getRow(6).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B7A' } };
  sheet.getRow(6).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getRow(7).height = 22;
  sheet.getRow(7).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF415778' } };
  sheet.getRow(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FF' } };
  sheet.columns.forEach((column, index) => { column.width = [20, 18, 30, 38, 18, 58, 16, 18, 25][index] || 24; });
  for (let row = 8; row <= 506; row += 1) {
    sheet.getRow(row).height = 22;
    sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E8' } };
  }
  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(2).numFmt = '@';
  addTemplateValidation(sheet, type === 'students' ? 'G' : 'F', type === 'students' ? 'H' : 'G', type === 'staff' ? 'E' : '', allowedPrograms);

  const filename = type === 'students'
    ? 'SIGA_plantilla_estudiantes.xlsx'
    : 'SIGA_plantilla_personal.xlsx';
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  await workbook.xlsx.write(response);
  response.end();
}

function cellText(row, index) {
  const value = row.getCell(index).value;
  if (value && typeof value === 'object' && 'text' in value) return String(value.text).trim();
  return String(value ?? '').trim();
}

function normalizedHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function importHeaderMap(row) {
  const headers = new Map();
  row.eachCell((cell, column) => { headers.set(normalizedHeader(cellText(row, column)), column); });
  return headers;
}

function valueFromHeaders(row, headers, ...names) {
  const key = names.map(normalizedHeader).find((name) => headers.has(name));
  return key ? cellText(row, headers.get(key)) : '';
}

function emptyStudentImportRow(row, headers, program) {
  const populated = [];
  row.eachCell((cell, column) => {
    if (cellText(row, column)) populated.push({ column, value: cellText(row, column) });
  });
  // Plantillas anteriores rellenaban el programa en filas sin estudiante.
  return populated.length === 0 || (populated.length === 1 && populated[0].column === headers.get('programa') && populated[0].value === program);
}

function importedStaffRoles(profileRole, tutorFunction = '') {
  if (profileRole === 'Docente' && normalizedHeader(tutorFunction) === 'si') return ['docente', 'tutor'];
  if (profileRole === 'Docente') return ['docente'];
  return undefined;
}

function validateExcelFile(file) {
  if (!file) return 'Seleccione un archivo Excel.';
  if (path.extname(file.originalname).toLowerCase() !== '.xlsx') return 'El archivo debe usar el formato Excel .xlsx.';
  if (file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) return 'El contenido no corresponde a un archivo Excel válido.';
  return '';
}

function validateWorksheetSize(sheet) {
  if (sheet.rowCount > maximumImportRows) return `La plantilla supera el máximo de ${maximumImportRows} filas.`;
  if (sheet.columnCount > maximumImportColumns) return `La plantilla supera el máximo de ${maximumImportColumns} columnas.`;
  return '';
}

app.disable('x-powered-by');
{
  const rawTrustProxy = String(process.env.SIGA_TRUST_PROXY || '').trim();
  const normalizedTrustProxy = rawTrustProxy.toLowerCase();
  if (['true', 'yes', 'on'].includes(normalizedTrustProxy)) app.set('trust proxy', 1);
  else if (/^\d+$/.test(normalizedTrustProxy)) app.set('trust proxy', Number(normalizedTrustProxy));
  else if (rawTrustProxy && !['false', 'no', 'off'].includes(normalizedTrustProxy)) app.set('trust proxy', rawTrustProxy);
}
app.use((request, response, next) => {
  if (process.env.NODE_ENV !== 'production' || request.secure) return next();
  const publicBaseUrl = new URL(process.env.SIGA_PUBLIC_BASE_URL);
  return response.redirect(308, `${publicBaseUrl.origin}${request.originalUrl}`);
});
app.use(express.json({ limit: '1mb' }));
app.use(compression({ threshold: 1024 }));
app.use((request, response, next) => requestContext.run({ pendingSaves: [] }, () => {
  const deferUntilSaved = (original, args) => {
    const context = requestContext.getStore();
    const pending = context ? context.pendingSaves.splice(0) : [];
    if (!pending.length) return original.apply(response, args);
    Promise.all(pending)
      .then(() => original.apply(response, args))
      .catch(next);
    return response;
  };
  const originalJson = response.json;
  const originalSend = response.send;
  response.json = function delayedJson(...args) { return deferUntilSaved(originalJson, args); };
  response.send = function delayedSend(...args) { return deferUntilSaved(originalSend, args); };
  next();
}));
app.use((request, response, next) => {
  request.id = String(request.get('x-request-id') || crypto.randomUUID()).slice(0, 100);
  response.setHeader('X-Request-Id', request.id);
  if (request.path.startsWith('/api/') || request.path === '/health') response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  // Vigilancia necesita la cámara del mismo origen para leer códigos QR.
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; '));
  if (request.secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  const startedAt = process.hrtime.bigint();
  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    recordUsageMetric(request, response.statusCode, durationMs);
    if (process.env.SIGA_DISABLE_REQUEST_LOGS !== 'true') {
      console.log(JSON.stringify({ level: 'info', event: 'http_request', requestId: request.id, method: request.method, path: request.path, status: response.statusCode, durationMs: Number(durationMs.toFixed(1)) }));
    }
  });
  next();
});

const securityCleanupTimer = setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, expiresAt] of revokedSessions.entries()) if (expiresAt < now) { revokedSessions.delete(id); changed = true; }
  for (const [key, attempt] of loginAttempts.entries()) if (attempt.resetAt < now) { loginAttempts.delete(key); changed = true; }
  if (changed) persistSecurityState();
}, 10 * 60 * 1000);
securityCleanupTimer.unref();

const usageMetricsTimer = setInterval(() => {
  try { persistUsageMetrics(); } catch (error) { console.error(JSON.stringify({ level: 'error', event: 'usage_metrics_save_failed', message: error.message })); }
}, 60 * 1000);
usageMetricsTimer.unref();

app.post('/api/password-recovery/request', (request, response) => {
  const identifier = String(request.body.identifier || '').trim().toLowerCase();
  const key = loginAttemptKey(request, `recovery:${identifier}`);
  const attempt = loginAttempts.get(key) || { count: 0, resetAt: Date.now() + 60 * 60 * 1000 };
  if (Date.now() > attempt.resetAt) Object.assign(attempt, { count: 0, resetAt: Date.now() + 60 * 60 * 1000 });
  if (attempt.count >= 3) return response.status(429).json({ error: 'Espere antes de enviar otra solicitud.' });
  attempt.count += 1;
  loginAttempts.set(key, attempt);
  persistSecurityState();
  const account = database.accounts.find((item) => item.state === 'Activo' && [item.email, item.username, item.document].some((value) => String(value || '').trim().toLowerCase() === identifier));
  if (account && !database.passwordRecoveryRequests.some((item) => item.accountId === account.id && item.status === 'Pendiente')) {
    database.passwordRecoveryRequests.unshift({ id: `REC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, accountId: account.id, requestedAt: new Date().toISOString(), status: 'Pendiente', resolvedAt: '', resolvedBy: '' });
    database.securityAudit.unshift({ id: `SEC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, action: 'Solicitud de recuperación', accountId: account.id, date: new Date().toISOString() });
    saveDatabase();
  }
  return response.status(202).json({ message: 'Si la cuenta existe y está activa, la solicitud fue enviada a Administración. No se muestran datos de la cuenta por seguridad.' });
});

app.post('/api/login', (request, response) => {
  const identifier = String(request.body.email || '').trim().toLowerCase();
  const key = loginAttemptKey(request, identifier);
  const attempt = loginAttempts.get(key) || { count: 0, resetAt: Date.now() + 10 * 60 * 1000 };
  if (Date.now() > attempt.resetAt) Object.assign(attempt, { count: 0, resetAt: Date.now() + 10 * 60 * 1000 });
  if (attempt.count >= 5) return response.status(429).json({ error: 'Demasiados intentos. Espere unos minutos.' });
  const role = String(request.body.role || '');
  if (String(request.body.website || '').trim()) {
    attempt.count += 1;
    loginAttempts.set(key, attempt);
    persistSecurityState();
    return response.status(401).json({ error: 'Credenciales o perfil incorrectos.' });
  }
  if (role === 'tutor') return response.status(400).json({ error: 'Ingrese como Docente y active el modo Tutor desde su cuenta.' });
  const account = database.accounts.find((item) => (item.email.toLowerCase() === identifier || String(item.username || '').toLowerCase() === identifier) && accountRoles(item).includes(role));
  if (!account || account.state !== 'Activo' || !verifyPassword(String(request.body.password || ''), account.passwordHash)) {
    attempt.count += 1;
    loginAttempts.set(key, attempt);
    persistSecurityState();
    return response.status(401).json({ error: 'Credenciales o perfil incorrectos.' });
  }
  if (loginAttempts.delete(key)) persistSecurityState();
  const session = createSession(response, account, request, role);
  response.json({ user: publicAccount(account, session.csrf, role), redirect: `/pages/${role}/resumen.html` });
});

app.get('/api/session', requireAuth, (request, response) => response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role) }));
app.post('/api/account/switch-role', requireAuth, requireCsrf, (request, response) => {
  const role = String(request.body.role || '');
  if (!accountRoles(request.account).includes(role)) return response.status(403).json({ error: 'Ese rol no está asignado a su cuenta.' });
  const session = createSession(response, request.account, request, role);
  response.json({ user: publicAccount(request.account, session.csrf, role), redirect: `/pages/${role}/resumen.html`, message: `Modo ${role} activado.` });
});
app.post('/api/logout', requireAuth, requireCsrf, (request, response) => {
  revokedSessions.set(request.session.id, request.session.expiresAt);
  persistSecurityState();
  response.setHeader('Set-Cookie', 'siga_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  response.sendStatus(204);
});

const requireTeacher = requireRole('docente', 'Acceso reservado al Docente.');
const requireStudent = requireRole('estudiante', 'Acceso reservado al Estudiante.');
const requireParent = requireRole('padre', 'Acceso reservado al Padre o apoderado.');
const requireGuard = requireRole('vigilante', 'Acceso reservado a Vigilancia.');

function teacherClasses(request) {
  return database.classes.filter((item) => item.teacherId === request.account.id);
}

function teacherClass(request, classId) {
  return teacherClasses(request).find((item) => item.id === classId);
}

function teacherStudents(request) {
  const classes = teacherClasses(request);
  const allowed = new Set(classes.flatMap((item) => item.studentIds));
  return database.students.filter((item) => allowed.has(item.id) && item.state === 'Activo');
}

function teacherExitItems(request) {
  const classes = teacherClasses(request);
  const classIds = new Set(classes.map((item) => item.id));
  const studentIds = new Set(classes.flatMap((item) => item.studentIds));
  return database.exitRequests.filter((item) => {
    const student = database.students.find((record) => record.id === item.studentId);
    if (!student || !studentIds.has(item.studentId)) return false;
    const assignedClasses = classes.filter((course) => course.studentIds.includes(item.studentId) && course.program === student.program);
    if (!assignedClasses.length) return false;
    if (item.source === 'Estudiante') return true;
    return item.teacherId === request.account.id && classIds.has(item.classId) && assignedClasses.some((course) => course.id === item.classId);
  }).map((item) => {
    const relatedClass = database.classes.find((course) => course.id === item.classId) || classes.find((course) => course.studentIds.includes(item.studentId));
    return { ...item, student: database.students.find((student) => student.id === item.studentId)?.name || item.studentId, course: relatedClass?.course || 'Solicitud del estudiante' };
  });
}

function teacherReportQueryError(request) {
  const query = request.query || {};
  const classes = teacherClasses(request);
  if ((query.from && !validIsoDate(query.from)) || (query.to && !validIsoDate(query.to))) return 'Seleccione fechas válidas para el reporte.';
  if (invalidReportRange(query)) return 'La fecha inicial no puede ser posterior a la fecha final.';
  if (query.course && !classes.some((item) => item.id === query.course)) return 'El curso seleccionado no está asignado al docente.';
  if (query.group && !classes.some((item) => item.group === query.group)) return 'El grupo seleccionado no está asignado al docente.';
  if (query.semester && !classes.some((item) => item.semester === query.semester)) return 'El semestre seleccionado no pertenece a sus clases.';
  if (query.state && !attendanceStates.includes(query.state)) return 'El estado de asistencia seleccionado no es válido.';
  const filtered = classes.filter((item) => (!query.course || item.id === query.course) && (!query.group || item.group === query.group) && (!query.semester || item.semester === query.semester));
  if ((query.course || query.group || query.semester) && !filtered.length) return 'La combinación de curso, grupo y semestre no corresponde a sus clases.';
  return '';
}

function teacherReport(request) {
  const query = request.query || {};
  const classes = teacherClasses(request).filter((item) => (!query.course || item.id === query.course) && (!query.group || item.group === query.group) && (!query.semester || item.semester === query.semester));
  const classIds = new Set(classes.map((item) => item.id));
  const rows = database.teacherAttendance.filter((item) => item.teacherId === request.account.id && classIds.has(item.classId) && (!query.from || item.date >= query.from) && (!query.to || item.date <= query.to) && (!query.state || item.state === query.state));
  const byState = attendanceStates.map((state) => ({ state, total: rows.filter((item) => item.state === state).length }));
  const byClass = classes.map((item) => ({ id: item.id, course: item.course, group: item.group, total: rows.filter((row) => row.classId === item.id).length }));
  const enriched = rows.map((item) => ({ ...item, student: database.students.find((student) => student.id === item.studentId)?.name || item.studentId, course: database.classes.find((course) => course.id === item.classId)?.course || item.classId }));
  const present = byState.find((item) => item.state === 'Presente').total;
  return { rows: enriched, byState, byClass, total: rows.length, attendanceRate: rows.length ? Math.round(present / rows.length * 100) : 0 };
}

app.get('/api/teacher/dashboard', requireTeacher, (request, response) => {
  const classes = teacherClasses(request);
  const students = teacherStudents(request);
  const today = limaDate();
  const todayRows = database.teacherAttendance.filter((item) => item.teacherId === request.account.id && item.date === today && classes.some((course) => course.id === item.classId));
  const count = (state) => new Set(todayRows.filter((item) => item.state === state).map((item) => item.studentId)).size;
  response.json({
    teacher: publicAccount(request.account, request.session.csrf, request.session.role),
    summary: { students: students.length, present: count('Presente'), late: count('Tardanza'), absent: count('Ausente') },
    classes: classes.map((item) => ({ ...item, studentCount: students.filter((student) => item.studentIds.includes(student.id)).length })),
    pendingExits: teacherExitItems(request).filter((item) => item.status === 'Pendiente de coordinación').length,
    unreadNotifications: database.notifications.filter((item) => item.userId === request.account.id && !item.read).length,
    today,
  });
});

app.get('/api/teacher/classes', requireTeacher, (request, response) => {
  const students = teacherStudents(request);
  response.json({ items: teacherClasses(request).map((item) => ({ ...item, studentCount: students.filter((student) => item.studentIds.includes(student.id)).length })), policies: { attendanceCorrectionDays, institutionStart, institutionEnd } });
});

app.get('/api/teacher/students', requireTeacher, (request, response) => {
  const classes = teacherClasses(request);
  const items = teacherStudents(request).map((student) => ({ ...student, classes: classes.filter((item) => item.studentIds.includes(student.id)).map((item) => ({ id: item.id, course: item.course, group: item.group })) }));
  response.json({ items, program: request.account.program });
});

app.get('/api/teacher/attendance', requireTeacher, (request, response) => {
  const course = teacherClass(request, String(request.query.classId || ''));
  const date = String(request.query.date || limaDate());
  if (!course) return response.status(404).json({ error: 'La clase seleccionada no está asignada al docente.' });
  if (!validIsoDate(date)) return response.status(400).json({ error: 'Seleccione una fecha válida.' });
  const students = database.students.filter((item) => course.studentIds.includes(item.id) && item.program === course.program && item.state === 'Activo');
  const records = database.teacherAttendance.filter((item) => item.teacherId === request.account.id && item.classId === course.id && item.date === date);
  const today = limaDate();
  const ageInDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  const editable = date <= today && ageInDays <= attendanceCorrectionDays;
  const correctionDeadline = new Date(Date.parse(`${date}T00:00:00Z`) + attendanceCorrectionDays * 86400000).toISOString().slice(0, 10);
  response.json({ course, date, students: students.map((student) => ({ ...student, attendance: records.find((record) => record.studentId === student.id)?.state || '' })), saved: records.length > 0, editable, correctionDays: attendanceCorrectionDays, correctionDeadline });
});

app.put('/api/teacher/attendance', requireTeacher, requireCsrf, (request, response) => {
  const course = teacherClass(request, String(request.body.classId || ''));
  const date = String(request.body.date || '');
  const entries = Array.isArray(request.body.entries) ? request.body.entries : [];
  if (!course) return response.status(404).json({ error: 'La clase seleccionada no está asignada al docente.' });
  if (!validIsoDate(date)) return response.status(400).json({ error: 'Seleccione una fecha válida.' });
  const today = limaDate();
  const ageInDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  if (date > today) return response.status(400).json({ error: 'No puede registrar asistencia en una fecha futura.' });
  if (ageInDays > attendanceCorrectionDays) return response.status(409).json({ error: `El periodo de corrección es de ${attendanceCorrectionDays} días. Solicite apoyo de Coordinación.` });
  const assignedStudents = database.students.filter((item) => course.studentIds.includes(item.id) && item.program === course.program && item.state === 'Activo');
  if (!assignedStudents.length) return response.status(409).json({ error: 'La clase no tiene estudiantes activos asignados. Coordinación debe revisar la matrícula.' });
  const assignedIds = new Set(assignedStudents.map((item) => item.id));
  const receivedIds = new Set(entries.map((entry) => entry.studentId));
  const invalidEntry = entries.some((entry) => !assignedIds.has(entry.studentId) || !attendanceStates.includes(entry.state));
  if (invalidEntry || entries.length !== assignedStudents.length || receivedIds.size !== entries.length || assignedStudents.some((student) => !receivedIds.has(student.id))) {
    return response.status(400).json({ error: 'Registre una sola vez el estado de todos los estudiantes activos asignados.' });
  }
  const updatedAt = new Date().toISOString();
  for (const entry of entries) {
    let record = database.teacherAttendance.find((item) => item.teacherId === request.account.id && item.classId === course.id && item.studentId === entry.studentId && item.date === date);
    const previousState = record?.state || '';
    if (record) Object.assign(record, { state: entry.state, updatedAt });
    else {
      record = { id: `ASI-${crypto.randomUUID().slice(0, 8)}`, teacherId: request.account.id, classId: course.id, studentId: entry.studentId, date, state: entry.state, updatedAt };
      database.teacherAttendance.push(record);
    }
    if (previousState !== entry.state) database.attendanceAudit.unshift({ id: `AUD-${crypto.randomUUID().slice(0, 8)}`, attendanceId: record.id, teacherId: request.account.id, classId: course.id, studentId: entry.studentId, date, previousState, nextState: entry.state, changedAt: updatedAt });
  }
  database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8)}`, userId: request.account.id, title: 'Asistencia guardada', message: `${course.course} · ${date}`, date: updatedAt, read: false });
  saveDatabase();
  const summary = attendanceStates.map((state) => ({ state, total: entries.filter((entry) => entry.state === state).length }));
  response.json({ message: `Asistencia guardada correctamente. Puede corregirla durante ${attendanceCorrectionDays} días mientras conserve acceso a la clase.`, summary });
});

app.get('/api/teacher/exits', requireTeacher, (request, response) => {
  response.json({ items: teacherExitItems(request) });
});

app.get('/api/teacher/exits/:id/qr.svg', requireTeacher, asyncRoute(async (request, response) => {
  const item = teacherExitItems(request).find((record) => record.id === request.params.id);
  if (!item || item.status !== 'Autorizada' || !item.qrCode) return response.status(404).json({ error: 'La boleta todavía no tiene un QR autorizado.' });
  const svg = await QRCode.toString(item.qrCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c1c34', light: '#ffffff' } });
  response.type('image/svg+xml').send(svg);
}));

app.post('/api/teacher/exits', requireTeacher, requireCsrf, (request, response) => {
  const course = teacherClass(request, String(request.body.classId || ''));
  const studentId = String(request.body.studentId || '');
  const reason = String(request.body.reason || '').trim();
  const date = String(request.body.date || '');
  const time = String(request.body.time || '');
  const student = database.students.find((item) => item.id === studentId && item.state === 'Activo');
  if (!course || !student || student.program !== course.program || !course.studentIds.includes(studentId)) return response.status(403).json({ error: 'Seleccione un estudiante activo matriculado en la clase y programa asignados.' });
  if (!reason || reason.length > 300 || !validIsoDate(date) || date < limaDate() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return response.status(400).json({ error: 'Complete motivo, fecha y hora con datos válidos y no anteriores a hoy.' });
  const requestedMinutes = timeToMinutes(time);
  if (requestedMinutes < timeToMinutes(institutionStart) || requestedMinutes > timeToMinutes(institutionEnd)) return response.status(400).json({ error: `La hora solicitada debe estar dentro del horario institucional de ${institutionStart} a ${institutionEnd}.` });
  const duplicate = database.exitRequests.some((record) => record.studentId === studentId && record.date === date && record.status !== 'Rechazada' && Math.abs(timeToMinutes(record.time) - requestedMinutes) <= 60);
  if (duplicate) return response.status(409).json({ error: 'Ya existe una solicitud activa para este estudiante en el mismo periodo.' });
  const item = { id: `SOL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, teacherId: request.account.id, classId: course.id, studentId, reason, date, time, source: 'Docente', status: 'Pendiente de coordinación', authorizedBy: '', qrCode: '', createdAt: new Date().toISOString() };
  database.exitRequests.unshift(item);
  database.accounts.filter((account) => accountRoles(account).includes('coordinador') && account.program === student.program).forEach((account) => database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8)}`, userId: account.id, title: 'Nueva solicitud de salida', message: `${request.account.name} registró una solicitud para ${student.name}.`, date: item.createdAt, read: false }));
  saveDatabase();
  response.status(201).json({ item, message: 'Solicitud registrada y enviada a Coordinación. Aún no es una boleta autorizada.' });
});

function sessionStudent(request) {
  return database.students.find((item) => item.id === request.account.studentId) || database.students.find((item) => item.email.toLowerCase() === request.account.email.toLowerCase());
}

function studentAuditLog(request, entity, entityId, action, detail) {
  database.studentAudit.unshift({ id: `SAU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity, entityId, action, detail, userId: request.account.id, studentId: sessionStudent(request)?.id || '', date: new Date().toISOString() });
}

function studentTutor(student) {
  const tutor = database.staff.find((item) => item.id === student.tutorId);
  return activeTutorAccountForStaff(tutor) ? { id: tutor.id, name: tutor.name, email: tutor.email } : { id: '', name: 'Sin tutor asignado', email: '' };
}

function studentClassItems(student, query = {}) {
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  return database.classes.filter((item) => item.studentIds.includes(student.id)).map((item, index) => {
    const teacher = database.accounts.find((account) => account.id === item.teacherId) || database.staff.find((staff) => staff.accountId === item.teacherId);
    const day = item.day || days[index % days.length];
    return { id: item.id, course: item.course, group: item.group, section: item.section, semester: item.semester, room: item.room, schedule: item.schedule, day, modality: item.modality || 'Presencial', teacher: teacher?.name || 'Docente por asignar' };
  }).filter((item) => (!query.day || item.day === query.day) && (!query.period || item.semester === query.period));
}

function studentExitStatus(item) {
  if (database.exitValidations.some((record) => record.exitId === item.id)) return 'Usada';
  if (item.status === 'Autorizada') {
    const assessment = guardTicketStatus(item);
    if (assessment.status === 'Válida') return 'Aprobada';
    if (assessment.status === 'Fuera de horario') return 'Fuera de horario';
    if (assessment.status === 'Vencida') return 'Vencida';
  }
  if (item.status === 'Rechazada') return 'Rechazada';
  return 'Pendiente';
}

function studentExitItems(request) {
  const student = sessionStudent(request);
  if (!student) return [];
  return database.exitRequests.filter((item) => item.studentId === student.id).map((item) => ({ ...item, displayStatus: studentExitStatus(item), validation: database.exitValidations.find((record) => record.exitId === item.id) || null })).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
}

function studentAttendanceAlerts(rows) {
  const ordered = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const summary = attendanceSummary(rows);
  const late = rows.filter((item) => item.state === 'Tardanza').length;
  const alerts = [];
  if (ordered.slice(0, 2).length === 2 && ordered.slice(0, 2).every((item) => item.state === 'Ausente')) alerts.push({ tone: 'red', title: 'Ausencias consecutivas', message: 'Tiene dos ausencias consecutivas registradas.' });
  if (late >= 2) alerts.push({ tone: 'amber', title: 'Tardanzas frecuentes', message: `Tiene ${late} tardanzas en el periodo consultado.` });
  if (rows.length >= 3 && summary.attendanceRate < 75) alerts.push({ tone: 'red', title: 'Asistencia por mejorar', message: `Su asistencia efectiva es ${summary.attendanceRate}%.` });
  if (!alerts.length) alerts.push({ tone: 'green', title: 'Asistencia en orden', message: 'No hay alertas críticas en el periodo consultado.' });
  return alerts;
}

app.get('/api/student/exits', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  response.json({ student, items: studentExitItems(request) });
});

app.get('/api/student/access-qr', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student || student.state !== 'Activo') return response.status(403).json({ error: 'La cuenta no está vinculada a un estudiante activo.' });
  response.json({ code: encodeStudentAccessQr(student.id), validDate: limaDate(), student: { id: student.id, name: student.name, program: student.program } });
});

app.get('/api/student/access-qr.svg', requireStudent, asyncRoute(async (request, response) => {
  const student = sessionStudent(request);
  if (!student || student.state !== 'Activo') return response.status(403).json({ error: 'La cuenta no está vinculada a un estudiante activo.' });
  const svg = await QRCode.toString(encodeStudentAccessQr(student.id), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c1c34', light: '#ffffff' } });
  response.set('Cache-Control', 'no-store, max-age=0');
  response.type('image/svg+xml').send(svg);
}));

app.post('/api/student/exits', requireStudent, requireCsrf, (request, response) => {
  const student = sessionStudent(request);
  const reason = String(request.body.reason || '').trim();
  const description = String(request.body.description || '').trim();
  const emergencyContact = String(request.body.emergencyContact || '').trim();
  const withdrawalType = String(request.body.type || '').trim();
  const date = String(request.body.date || '');
  const time = String(request.body.time || '');
  if (!student || student.state !== 'Activo') return response.status(403).json({ error: 'La cuenta no está vinculada a un estudiante activo.' });
  if (!['Temporal', 'Definitivo', 'Emergencia'].includes(withdrawalType)) return response.status(400).json({ error: 'Seleccione un tipo de retiro válido.' });
  if (!reason || reason.length > 120 || description.length > 500 || emergencyContact.length > 120 || !validIsoDate(date) || date < limaDate() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return response.status(400).json({ error: 'Complete motivo, tipo, fecha y hora con datos válidos.' });
  const requestedMinutes = timeToMinutes(time);
  if (requestedMinutes < timeToMinutes(institutionStart) || requestedMinutes > timeToMinutes(institutionEnd)) return response.status(400).json({ error: `La hora solicitada debe estar dentro del horario institucional de ${institutionStart} a ${institutionEnd}.` });
  const duplicate = database.exitRequests.some((item) => item.studentId === student.id && item.date === date && item.status !== 'Rechazada' && Math.abs(timeToMinutes(item.time) - requestedMinutes) <= 60);
  if (duplicate) return response.status(409).json({ error: 'Ya existe una solicitud activa para el mismo periodo. Revise sus boletas antes de enviar otra.' });
  const item = { id: `SOL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, teacherId: '', requestedBy: request.account.id, classId: '', studentId: student.id, reason, description, emergencyContact, withdrawalType, date, time, source: 'Estudiante', status: 'Pendiente de coordinación', decisionReason: '', authorizedBy: '', qrCode: '', createdAt: new Date().toISOString() };
  database.exitRequests.unshift(item);
  database.accounts.filter((account) => accountRoles(account).includes('coordinador') && account.program === student.program).forEach((account) => database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8)}`, userId: account.id, title: 'Nueva solicitud de salida', message: `${student.name} registró la solicitud ${item.id}.`, date: item.createdAt, read: false }));
  studentAuditLog(request, 'exitRequest', item.id, 'Creación', `${date} ${time} · ${withdrawalType}`);
  saveDatabase();
  response.status(201).json({ item, message: 'Solicitud enviada a Coordinación. La salida aún no está autorizada.' });
});

app.get('/api/student/exits/:id/qr.svg', requireStudent, asyncRoute(async (request, response) => {
  const student = sessionStudent(request);
  const item = database.exitRequests.find((record) => record.id === request.params.id && record.studentId === student?.id);
  if (!item || item.status !== 'Autorizada' || !item.qrCode) return response.status(404).json({ error: 'No existe un QR oficial para esta solicitud.' });
  const svg = await QRCode.toString(item.qrCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c1c34', light: '#ffffff' } });
  response.type('image/svg+xml').send(svg);
}));

function attendanceForStudents(studentIds, query = {}) {
  const allowed = new Set(studentIds);
  const students = new Map(database.students.map((item) => [item.id, item]));
  const classes = new Map(database.classes.map((item) => [item.id, item]));
  return database.teacherAttendance
    .filter((item) => {
      const student = students.get(item.studentId);
      const course = classes.get(item.classId);
      return allowed.has(item.studentId) && student && course && course.studentIds.includes(item.studentId) && course.program === student.program && (!query.from || item.date >= query.from) && (!query.to || item.date <= query.to) && (!query.state || item.state === query.state);
    })
    .map((item) => {
      const student = students.get(item.studentId);
      const course = classes.get(item.classId);
      return { ...item, student: student.name, course: course.course, group: course.group || '', semester: student.semester || '' };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function attendanceSummary(rows) {
  const byState = attendanceStates.map((state) => ({ state, total: rows.filter((item) => item.state === state).length }));
  const eligible = rows.filter((item) => item.state !== 'Permiso');
  const attended = eligible.filter((item) => ['Presente', 'Tardanza'].includes(item.state)).length;
  return { total: rows.length, attendanceRate: eligible.length ? Math.round((attended / eligible.length) * 100) : 0, byState };
}

function dailyAttendanceState(rows) {
  if (!rows.length) return 'Sin registro';
  for (const state of ['Ausente', 'Retiro', 'Tardanza', 'Permiso', 'Presente']) if (rows.some((item) => item.state === state)) return state;
  return 'Sin registro';
}

function publicNoticesFor(userId, studentIds = [], allowedAudiences = ['Todos','Estudiante']) {
  const linked = new Set(studentIds);
  const institutional = database.notices.filter((item) => item.userId === userId || (linked.has(item.studentId) && allowedAudiences.includes(item.audience)) || (!item.studentId && allowedAudiences.includes(item.audience)));
  const direct = database.notifications.filter((item) => item.userId === userId).map((item) => ({ ...item, audience: 'Cuenta' }));
  return [...institutional, ...direct].sort((a, b) => b.date.localeCompare(a.date));
}

app.get('/api/student/dashboard', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  const rows = attendanceForStudents([student.id]);
  const todayRows = rows.filter((item) => item.date === limaDate());
  const exits = studentExitItems(request);
  const classes = studentClassItems(student);
  const meetings = database.tutorMeetings.filter((item) => item.studentId === student.id && item.date >= limaDate()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  response.json({ student: { ...student, tutor: studentTutor(student) }, today: limaDate(), summary: attendanceSummary(rows), todaySummary: attendanceSummary(todayRows), todayState: dailyAttendanceState(todayRows), alerts: studentAttendanceAlerts(rows), exits: { pending: exits.filter((item) => item.displayStatus === 'Pendiente').length, approved: exits.filter((item) => item.displayStatus === 'Aprobada').length, rejected: exits.filter((item) => item.displayStatus === 'Rechazada').length }, upcomingClasses: classes.slice(0, 4), nextMeeting: meetings[0] || null, notices: studentNoticeItems(request).slice(0, 4) });
});

app.get('/api/student/attendance', requireStudent, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  const rows = attendanceForStudents([student.id], request.query);
  response.json({ student, rows, alerts: studentAttendanceAlerts(rows), ...attendanceSummary(rows) });
});

function studentNoticeItems(request) {
  const student = sessionStudent(request);
  if (!student) return [];
  const readIds = new Set(Array.isArray(request.account.readNoticeIds) ? request.account.readNoticeIds : []);
  const tutorMessages = database.tutorMessages.filter((item) => item.studentId === student.id && item.recipients.includes('Estudiante')).map((item) => ({ id: item.id, studentId: item.studentId, title: item.subject, message: item.message, date: item.sentAt, audience: 'Tutoría', read: readIds.has(item.id) }));
  return [...publicNoticesFor(request.account.id, [student.id]), ...tutorMessages].map((item) => ({ ...item, read: item.userId === request.account.id ? Boolean(item.read) : readIds.has(item.id) })).sort((a, b) => b.date.localeCompare(a.date));
}

app.get('/api/student/notices', requireStudent, (request, response) => {
  if (!sessionStudent(request)) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  const items = studentNoticeItems(request);
  response.json({ items, unread: items.filter((item) => !item.read).length });
});

app.patch('/api/student/notices/:id/read', requireStudent, requireCsrf, (request, response) => {
  if (!studentNoticeItems(request).some((item) => item.id === request.params.id)) return response.status(404).json({ error: 'La notificación no está disponible para esta cuenta.' });
  const direct = database.notifications.find((item) => item.id === request.params.id && item.userId === request.account.id);
  if (direct) direct.read = true;
  else {
    request.account.readNoticeIds = Array.isArray(request.account.readNoticeIds) ? request.account.readNoticeIds : [];
    if (!request.account.readNoticeIds.includes(request.params.id)) request.account.readNoticeIds.push(request.params.id);
  }
  studentAuditLog(request, 'notice', request.params.id, 'Lectura', 'Notificación marcada como leída.');
  saveDatabase();
  response.json({ message: 'Notificación marcada como leída.' });
});

app.get('/api/student/profile', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  response.json({ student: { ...student, tutor: studentTutor(student) }, account: { ...publicAccount(request.account, request.session.csrf, request.session.role), contactEmail: request.account.contactEmail || '' }, preferences: request.account.notificationPreferences || [] });
});

app.put('/api/student/profile', requireStudent, requireCsrf, (request, response) => {
  const contactEmail = String(request.body.contactEmail || '').trim().toLowerCase();
  const phone = String(request.body.phone || '').trim();
  const allowed = ['Asistencia', 'Boletas', 'Justificaciones', 'Avisos', 'Tutoría'];
  const preferences = Array.isArray(request.body.preferences) ? [...new Set(request.body.preferences.filter((item) => allowed.includes(item)))] : [];
  if (!/^\S+@\S+\.\S+$/.test(contactEmail) || phone.length < 6 || phone.length > 20) return response.status(400).json({ error: 'Ingrese un correo personal y teléfono válidos.' });
  request.account.contactEmail = contactEmail;
  request.account.phone = phone;
  request.account.notificationPreferences = preferences;
  studentAuditLog(request, 'profile', request.account.id, 'Actualización', 'Correo personal, teléfono o preferencias actualizados.');
  saveDatabase();
  response.json({ account: { ...publicAccount(request.account, request.session.csrf, request.session.role), contactEmail }, message: 'Datos personales actualizados correctamente.' });
});

app.get('/api/student/classes', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  const items = studentClassItems(student, request.query);
  response.json({ items, periods: [...new Set(studentClassItems(student).map((item) => item.semester))], days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] });
});

app.get('/api/student/justifications', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  const items = database.tutorJustifications.filter((item) => item.studentId === student.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  response.json({ items });
});

app.post('/api/student/justifications', requireStudent, requireCsrf, upload.single('evidence'), asyncRoute(async (request, response) => {
  const student = sessionStudent(request);
  const type = String(request.body.type || '').trim();
  const reason = String(request.body.reason || '').trim();
  const description = String(request.body.description || '').trim();
  const startDate = String(request.body.startDate || '');
  const endDate = String(request.body.endDate || startDate);
  if (!student || student.state !== 'Activo') return response.status(403).json({ error: 'La cuenta no está vinculada a un estudiante activo.' });
  if (!['Ausencia', 'Tardanza'].includes(type) || !validIsoDate(startDate) || !validIsoDate(endDate) || startDate > endDate || reason.length < 3 || reason.length > 120 || description.length < 5 || description.length > 700) return response.status(400).json({ error: 'Complete tipo, fechas, motivo y descripción válidos.' });
  const evidence = await storeEvidence(request.file, studentEvidenceDirectory, request.account.id);
  if (evidence.error) return response.status(400).json({ error: evidence.error });
  const { evidenceFile, evidenceName } = evidence;
  const item = { id: `JUS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, studentId: student.id, startDate, endDate, date: startDate, type, reason, description, contact: request.account.phone || request.account.contactEmail || request.account.email, evidenceFile, evidenceName, evidenceSource: 'student', status: 'Enviada', observation: '', derivedBy: '', createdBy: request.account.id, createdAt: new Date().toISOString() };
  database.tutorJustifications.unshift(item);
  studentAuditLog(request, 'justification', item.id, 'Envío', `${type} · ${startDate} a ${endDate}`);
  saveDatabase();
  response.status(201).json({ item, message: 'Justificación enviada a Tutoría para revisión.' });
}));

app.get('/api/student/justifications/:id/evidence', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  const item = database.tutorJustifications.find((record) => record.id === request.params.id && record.studentId === student?.id && record.evidenceSource === 'student');
  if (!item?.evidenceFile) return response.sendStatus(404);
  const target = path.join(studentEvidenceDirectory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});

app.get('/api/student/follow-up', requireStudent, (request, response) => {
  const student = sessionStudent(request);
  if (!student) return response.status(404).json({ error: 'La cuenta no está vinculada a un estudiante.' });
  const meetings = database.tutorMeetings.filter((item) => item.studentId === student.id).map((item) => ({ id: item.id, date: item.date, time: item.time, modality: item.modality || 'Presencial', topic: item.topic || 'Reunión de tutoría', responsible: item.responsible || studentTutor(student).name, agreements: item.agreements || '', followUp: item.followUp || '', status: item.status })).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const cases = database.tutorCases.filter((item) => item.studentId === student.id && item.sharedWithStudent === true).map((item) => ({ id: item.id, type: item.type, date: item.date, responsible: item.responsible, actions: item.actions, status: item.status, nextFollowUp: item.familyNextStep || '', updatedAt: item.updatedAt })).sort((a, b) => b.date.localeCompare(a.date));
  response.json({ meetings, cases, tutor: studentTutor(student) });
});

const familyNoticeAudiences = ['Todos','Familia','Apoderado','Padre o apoderado'];

function guardianStudents(request) {
  const ids = new Set(Array.isArray(request.account.studentIds) ? request.account.studentIds : []);
  return database.students.filter((item) => ids.has(item.id));
}

function guardianStudentDetails(request) {
  return guardianStudents(request).map((student) => {
    const tutor = database.staff.find((item) => item.id === student.tutorId);
    return {
      id: student.id,
      name: student.name,
      semester: student.semester,
      group: student.group,
      program: student.program,
      state: student.state,
      tutor: activeTutorAccountForStaff(tutor) ? tutor.name : 'Sin tutor asignado'
    };
  });
}

function familyAuditLog(request, entity, entityId, action, detail) {
  database.familyAudit.unshift({ id: `FAU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity, entityId, action, detail, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
}

function familyAttendanceAlerts(rows) {
  const absences = rows.filter((item) => item.state === 'Ausente').length;
  const tardies = rows.filter((item) => item.state === 'Tardanza').length;
  const groups = new Map();
  rows.forEach((item) => {
    if (!groups.has(item.studentId)) groups.set(item.studentId, []);
    groups.get(item.studentId).push(item);
  });
  const alerts = [];
  groups.forEach((studentRows) => {
    const ordered = [...studentRows].sort((a, b) => b.date.localeCompare(a.date));
    const name = ordered[0]?.student || 'Estudiante';
    const childTardies = ordered.filter((item) => item.state === 'Tardanza').length;
    const summary = attendanceSummary(ordered);
    if (ordered.slice(0, 2).length === 2 && ordered.slice(0, 2).every((item) => item.state === 'Ausente')) alerts.push({ tone: 'red', title: `Ausencias consecutivas · ${name}`, message: 'Se registraron dos ausencias consecutivas.' });
    if (childTardies >= 2) alerts.push({ tone: 'amber', title: `Tardanzas frecuentes · ${name}`, message: `${childTardies} tardanzas registradas en el periodo consultado.` });
    if (ordered.length >= 3 && summary.attendanceRate < 75) alerts.push({ tone: 'red', title: `Asistencia por debajo del nivel esperado · ${name}`, message: `Asistencia actual: ${summary.attendanceRate}%.` });
  });
  if (!alerts.length) alerts.push({ tone: 'green', title: 'Seguimiento al día', message: 'No hay alertas críticas de asistencia en el periodo.' });
  return { absences, tardies, alerts };
}

function familyExitStatus(item) {
  return studentExitStatus(item);
}

function familyExitItems(request) {
  const students = new Map(guardianStudentDetails(request).map((item) => [item.id, item]));
  return database.exitRequests.filter((item) => students.has(item.studentId)).map((item) => {
    const { qrCode, ...publicItem } = item;
    const displayStatus = familyExitStatus(item);
    return { ...publicItem, student: students.get(item.studentId).name, program: students.get(item.studentId).program, displayStatus, hasQr: Boolean(qrCode && displayStatus === 'Aprobada') };
  }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
}

function parentAttendanceQueryError(request) {
  const { from, to, state, student } = request.query;
  if ((from && !validIsoDate(from)) || (to && !validIsoDate(to))) return 'Ingrese fechas válidas.';
  if (from && to && from > to) return 'La fecha inicial no puede ser posterior a la fecha final.';
  if (state && !attendanceStates.includes(state)) return 'Seleccione un estado de asistencia válido.';
  if (student && !guardianStudents(request).some((item) => item.id === student)) return 'El estudiante no está vinculado a esta cuenta.';
  return '';
}

app.get('/api/parent/dashboard', requireParent, (request, response) => {
  const students = guardianStudentDetails(request);
  const rows = attendanceForStudents(students.map((item) => item.id));
  const exits = familyExitItems(request);
  const meetings = database.tutorMeetings.filter((item) => students.some((student) => student.id === item.studentId));
  const children = students.map((student) => {
    const childRows = rows.filter((item) => item.studentId === student.id);
    const today = childRows.filter((item) => item.date === limaDate());
    const childExits = exits.filter((item) => item.studentId === student.id);
    const nextMeeting = meetings.filter((item) => item.studentId === student.id && item.date >= limaDate() && !['Realizada','Cancelada'].includes(item.status)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0] || null;
    return { ...student, todayAttendance: dailyAttendanceState(today), todaySummary: attendanceSummary(today), alerts: familyAttendanceAlerts(childRows).alerts, exitSummary: { pending: childExits.filter((item) => item.displayStatus === 'Pendiente').length, approved: childExits.filter((item) => item.displayStatus === 'Aprobada').length, rejected: childExits.filter((item) => item.displayStatus === 'Rechazada').length }, nextMeeting };
  });
  response.json({ parent: publicAccount(request.account, request.session.csrf, request.session.role), students, children, summary: attendanceSummary(rows), pendingJustifications: database.tutorJustifications.filter((item) => students.some((student) => student.id === item.studentId) && ['Enviada','En revisión','Pendiente','Derivada a Coordinación'].includes(item.status)).length, notices: familyNoticeItems(request).slice(0, 5), exits: exits.slice(0, 4) });
});

app.get('/api/parent/children', requireParent, (request, response) => {
  const items = guardianStudentDetails(request).map((student) => ({ ...student, attendance: attendanceSummary(attendanceForStudents([student.id])) }));
  response.json({ items });
});

app.get('/api/parent/attendance', requireParent, (request, response) => {
  const queryError = parentAttendanceQueryError(request);
  if (queryError) return response.status(queryError.includes('vinculado') ? 404 : 400).json({ error: queryError });
  const students = guardianStudentDetails(request);
  const selectedId = String(request.query.student || '');
  const ids = selectedId ? [selectedId] : students.map((item) => item.id);
  const rows = attendanceForStudents(ids, request.query);
  response.json({ students, rows, ...attendanceSummary(rows), ...familyAttendanceAlerts(rows) });
});

app.get('/api/parent/justifications', requireParent, (request, response) => {
  const students = guardianStudentDetails(request);
  const ids = new Set(students.map((item) => item.id));
  const items = database.tutorJustifications.filter((item) => ids.has(item.studentId)).map((item) => ({ ...item, student: students.find((student) => student.id === item.studentId)?.name || item.studentId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  response.json({ students: students.filter((item) => item.state === 'Activo'), items });
});

app.post('/api/parent/justifications', requireParent, requireCsrf, upload.single('evidence'), asyncRoute(async (request, response) => {
  const student = guardianStudents(request).find((item) => item.id === String(request.body.studentId || ''));
  const type = String(request.body.type || '').trim();
  const reason = String(request.body.reason || '').trim();
  const description = String(request.body.description || '').trim();
  const contact = String(request.body.contact || '').trim();
  const startDate = String(request.body.startDate || request.body.date || '');
  const endDate = String(request.body.endDate || startDate);
  if (!student) return response.status(404).json({ error: 'El estudiante no está vinculado a esta cuenta.' });
  if (student.state !== 'Activo') return response.status(409).json({ error: 'No puede enviar justificaciones para una matrícula inactiva.' });
  if (!['Ausencia','Tardanza'].includes(type) || !validIsoDate(startDate) || !validIsoDate(endDate) || startDate > endDate || startDate > limaDate() || endDate > limaDate() || reason.length < 3 || reason.length > 120 || description.length < 5 || description.length > 700 || contact.length < 6 || contact.length > 120) return response.status(400).json({ error: 'Complete tipo, fechas no futuras, motivo, descripción y contacto válidos.' });
  const duplicate = database.tutorJustifications.some((item) => item.studentId === student.id && item.type === type && item.startDate === startDate && item.endDate === endDate && ['Enviada','Pendiente','En revisión','Derivada a Coordinación'].includes(item.status));
  if (duplicate) return response.status(409).json({ error: 'Ya existe una justificación en trámite para este estudiante, tipo y periodo.' });
  const evidence = await storeEvidence(request.file, familyEvidenceDirectory, request.account.id);
  if (evidence.error) return response.status(400).json({ error: evidence.error });
  const { evidenceFile, evidenceName } = evidence;
  const item = { id: `JUS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, studentId: student.id, startDate, endDate, date: startDate, type, reason, description, contact, evidenceFile, evidenceName, evidenceSource: 'family', status: 'Enviada', observation: '', derivedBy: '', createdBy: request.account.id, createdAt: new Date().toISOString() };
  database.tutorJustifications.unshift(item);
  familyAuditLog(request, 'justification', item.id, 'Envío', `${type} · ${student.name} · ${startDate} a ${endDate}`);
  saveDatabase();
  response.status(201).json({ item, message: 'Justificación enviada a Tutoría para revisión.' });
}));

app.get('/api/parent/justifications/:id/evidence', requireParent, (request, response) => {
  const ids = new Set(guardianStudents(request).map((item) => item.id));
  const item = database.tutorJustifications.find((record) => record.id === request.params.id && ids.has(record.studentId));
  if (!item?.evidenceFile) return response.sendStatus(404);
  const evidenceDirectory = item.evidenceSource === 'student' ? studentEvidenceDirectory : familyEvidenceDirectory;
  const target = path.join(evidenceDirectory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});

app.get('/api/parent/exits', requireParent, (request, response) => response.json({ items: familyExitItems(request), students: guardianStudentDetails(request) }));

app.get('/api/parent/exits/:id/qr.svg', requireParent, asyncRoute(async (request, response) => {
  const studentIds = new Set(guardianStudents(request).map((item) => item.id));
  const item = database.exitRequests.find((record) => record.id === request.params.id && studentIds.has(record.studentId));
  if (!item || item.status !== 'Autorizada' || familyExitStatus(item) !== 'Aprobada' || !item.qrCode) return response.status(404).json({ error: 'No existe una boleta QR vigente para este estudiante.' });
  const svg = await QRCode.toString(item.qrCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c1c34', light: '#ffffff' } });
  response.type('image/svg+xml').send(svg);
}));

app.get('/api/parent/meetings', requireParent, (request, response) => {
  const students = guardianStudentDetails(request);
  const ids = new Set(students.map((item) => item.id));
  const items = database.tutorMeetings.filter((item) => ids.has(item.studentId)).map((item) => {
    const canRespond = item.date >= limaDate() && !['Realizada','Cancelada'].includes(item.status);
    return {
      ...item,
      student: students.find((student) => student.id === item.studentId)?.name || item.studentId,
      modality: item.modality || 'Presencial',
      topic: item.topic || 'Reunión de tutoría',
      responsible: item.responsible || database.staff.find((staff) => staff.id === item.tutorId || staff.accountId === item.tutorId)?.name || 'Tutoría académica',
      canConfirm: canRespond && !['Confirmada por apoderado','Reprogramación solicitada'].includes(item.status),
      canReschedule: canRespond && item.status !== 'Reprogramación solicitada'
    };
  }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  response.json({ items });
});

app.patch('/api/parent/meetings/:id', requireParent, requireCsrf, (request, response) => {
  const ids = new Set(guardianStudents(request).map((item) => item.id));
  const item = database.tutorMeetings.find((record) => record.id === request.params.id && ids.has(record.studentId));
  const action = String(request.body.action || '');
  const message = String(request.body.message || '').trim();
  const proposedDate = String(request.body.proposedDate || '');
  if (!item) return response.status(404).json({ error: 'La reunión no pertenece a un estudiante vinculado.' });
  if (!['Confirmar','Reprogramar'].includes(action)) return response.status(400).json({ error: 'Seleccione una acción válida.' });
  if (item.date < limaDate()) return response.status(409).json({ error: 'La reunión ya pasó y no admite nuevas respuestas.' });
  if (['Realizada','Cancelada'].includes(item.status)) return response.status(409).json({ error: 'La reunión ya está cerrada y no admite cambios.' });
  if (action === 'Confirmar' && ['Confirmada por apoderado','Reprogramación solicitada'].includes(item.status)) return response.status(409).json({ error: 'La reunión ya tiene una respuesta registrada.' });
  if (action === 'Reprogramar' && item.status === 'Reprogramación solicitada') return response.status(409).json({ error: 'Ya existe una solicitud de reprogramación en trámite.' });
  if (action === 'Reprogramar' && (!validIsoDate(proposedDate) || proposedDate < limaDate() || proposedDate === item.date || message.length < 5 || message.length > 400)) return response.status(400).json({ error: 'Indique otra fecha vigente y un motivo de 5 a 400 caracteres.' });
  item.status = action === 'Confirmar' ? 'Confirmada por apoderado' : 'Reprogramación solicitada';
  item.parentResponse = action === 'Confirmar' ? 'Asistencia confirmada' : message;
  item.proposedDate = action === 'Reprogramar' ? proposedDate : '';
  item.parentRespondedAt = new Date().toISOString();
  familyAuditLog(request, 'meeting', item.id, action, action === 'Confirmar' ? 'Asistencia confirmada.' : `${proposedDate} · ${message}`);
  saveDatabase();
  response.json({ item, message: action === 'Confirmar' ? 'Asistencia a la reunión confirmada.' : 'Solicitud de reprogramación enviada.' });
});

function familyMessageVisible(item) {
  return String(item.recipients || '').toLowerCase().includes('apoderado');
}

function familyNoticeItems(request) {
  const students = guardianStudentDetails(request);
  const ids = new Set(students.map((item) => item.id));
  const readIds = new Set(Array.isArray(request.account.readNoticeIds) ? request.account.readNoticeIds : []);
  const tutorMessages = database.tutorMessages.filter((item) => ids.has(item.studentId) && familyMessageVisible(item)).map((item) => ({ id: item.id, studentId: item.studentId, title: item.subject, message: item.message, date: item.sentAt, audience: item.recipients, read: readIds.has(item.id) }));
  return [...publicNoticesFor(request.account.id, [...ids], familyNoticeAudiences), ...tutorMessages].map((item) => ({ ...item, student: item.studentId ? students.find((student) => student.id === item.studentId)?.name || '' : '', read: item.userId === request.account.id ? Boolean(item.read) : readIds.has(item.id) })).sort((a, b) => b.date.localeCompare(a.date));
}

app.get('/api/parent/notices', requireParent, (request, response) => {
  const items = familyNoticeItems(request);
  response.json({ items, unread: items.filter((item) => !item.read).length });
});

app.patch('/api/parent/notices/:id/read', requireParent, requireCsrf, (request, response) => {
  const visible = new Set(familyNoticeItems(request).map((item) => item.id));
  if (!visible.has(request.params.id)) return response.status(404).json({ error: 'Aviso no disponible para esta cuenta.' });
  const direct = database.notifications.find((item) => item.id === request.params.id && item.userId === request.account.id);
  if (direct) direct.read = true;
  else {
    request.account.readNoticeIds = Array.isArray(request.account.readNoticeIds) ? request.account.readNoticeIds : [];
    if (!request.account.readNoticeIds.includes(request.params.id)) request.account.readNoticeIds.push(request.params.id);
  }
  familyAuditLog(request, 'notice', request.params.id, 'Lectura', 'Aviso marcado como leído.');
  saveDatabase(); response.json({ message: 'Aviso marcado como leído.' });
});

app.get('/api/parent/follow-up', requireParent, (request, response) => {
  const students = guardianStudentDetails(request);
  const ids = new Set(students.map((item) => item.id));
  const items = database.tutorCases.filter((item) => ids.has(item.studentId) && item.sharedWithFamily === true).map((item) => ({ id: item.id, studentId: item.studentId, student: students.find((student) => student.id === item.studentId)?.name || item.studentId, type: item.type, date: item.date, responsible: item.responsible, actions: item.actions, status: item.status, nextFollowUp: item.familyNextStep || '', updatedAt: item.updatedAt })).sort((a, b) => b.date.localeCompare(a.date));
  response.json({ items });
});

app.get('/api/parent/profile', requireParent, (request, response) => response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role), preferences: request.account.notificationPreferences || [], linkedStudents: guardianStudents(request).length }));

app.put('/api/parent/profile', requireParent, requireCsrf, (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase();
  const phone = String(request.body.phone || '').trim();
  const allowed = ['Asistencia','Boletas','Justificaciones','Reuniones','Avisos'];
  const preferences = Array.isArray(request.body.preferences) ? [...new Set(request.body.preferences.filter((item) => allowed.includes(item)))] : [];
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^[0-9+\s()-]{6,20}$/.test(phone)) return response.status(400).json({ error: 'Ingrese un correo y teléfono válidos.' });
  if (database.accounts.some((account) => account.id !== request.account.id && account.email.toLowerCase() === email)) return response.status(409).json({ error: 'El correo ya pertenece a otra cuenta.' });
  const previousEmail = request.account.email;
  Object.assign(request.account, { email, phone, notificationPreferences: preferences });
  const linkedStaff = database.staff.find((item) => item.accountId === request.account.id || item.email.toLowerCase() === previousEmail.toLowerCase());
  if (linkedStaff) { linkedStaff.accountId = request.account.id; linkedStaff.email = email; }
  familyAuditLog(request, 'profile', request.account.id, 'Actualización', 'Correo, teléfono y preferencias actualizados.');
  saveDatabase();
  response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role), preferences, message: 'Datos de contacto y preferencias actualizados.' });
});

function guardExitItems() {
  return database.exitRequests.filter((item) => item.status === 'Autorizada').map((item) => {
    const student = database.students.find((candidate) => candidate.id === item.studentId);
    const validation = database.exitValidations.find((candidate) => candidate.exitId === item.id);
    return { ...item, student: student?.name || item.studentId, initials: String(student?.name || item.studentId).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), program: student?.program || '', validation: validation || null };
  }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
}

function guardPoint(request, value = '') {
  return String(value || request.account.pointOfControl || 'Puerta principal').trim().slice(0, 80);
}

function guardTicketStatus(item, now = new Date()) {
  if (!item) return { valid: false, status: 'No encontrada', reason: 'El código no existe en el registro institucional.' };
  const validation = database.exitValidations.find((record) => record.exitId === item.id || record.qrCode === item.qrCode);
  if (validation) return { valid: false, status: 'Usada', reason: `La boleta ya fue utilizada el ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(validation.date))}.`, validation };
  if (item.status !== 'Autorizada') return { valid: false, status: item.status === 'Rechazada' ? 'Rechazada' : 'No autorizada', reason: item.status === 'Rechazada' ? 'Coordinación rechazó esta solicitud.' : 'La solicitud todavía no fue autorizada por Coordinación.' };
  const today = limaDate(now);
  if (item.date < today) return { valid: false, status: 'Vencida', reason: 'La fecha autorizada de esta boleta ya venció.' };
  if (item.date > today) return { valid: false, status: 'Fuera de horario', reason: 'La boleta corresponde a una fecha posterior.' };
  const [hour, minute] = String(item.time || '00:00').split(':').map(Number);
  const [currentHour, currentMinute] = limaTime(now).split(':').map(Number);
  const difference = currentHour * 60 + currentMinute - (hour * 60 + minute);
  if (difference < -180 || difference > 240) return { valid: false, status: 'Fuera de horario', reason: 'La consulta está fuera de la ventana permitida para la hora autorizada.' };
  return { valid: true, status: 'Válida', reason: 'Boleta autorizada y disponible para una única validación.' };
}

function guardLookup(code) {
  const normalized = String(code || '').trim().toUpperCase();
  const item = database.exitRequests.find((record) => String(record.qrCode || '').toUpperCase() === normalized || String(record.id || '').toUpperCase() === normalized);
  const assessment = guardTicketStatus(item);
  if (!item) return { code: normalized, item: null, ...assessment };
  const student = database.students.find((record) => record.id === item.studentId);
  return {
    code: normalized,
    item: {
      id: item.id,
      qrCode: item.qrCode,
      studentId: item.studentId,
      student: student?.name || item.studentId,
      initials: String(student?.name || item.studentId).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      program: student?.program || '',
      date: item.date,
      time: item.time,
      reason: item.reason,
      authorizedBy: item.authorizedBy || 'Coordinación académica',
    },
    ...assessment,
  };
}

function recordGuardAttempt(request, lookup, reason = lookup.reason) {
  const item = lookup.item;
  const attempt = {
    id: `GAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    exitId: item?.id || '',
    qrCode: lookup.code,
    studentId: item?.studentId || '',
    student: item?.student || 'No identificado',
    result: 'Rechazada',
    reason: String(reason || 'Validación bloqueada').slice(0, 220),
    guardId: request.account.id,
    guardName: request.account.name,
    shift: request.account.shift || '',
    pointOfControl: guardPoint(request, request.body?.pointOfControl),
    date: new Date().toISOString(),
  };
  database.guardAttempts.unshift(attempt);
  return attempt;
}

function guardHistory(request, query = {}) {
  const successes = database.exitValidations.filter((item) => item.guardId === request.account.id).map((item) => {
    const exit = database.exitRequests.find((record) => record.id === item.exitId);
    const student = database.students.find((record) => record.id === exit?.studentId);
    return { id: item.id, exitId: item.exitId, code: item.qrCode, student: student?.name || exit?.studentId || 'No identificado', studentId: exit?.studentId || '', result: 'Validada', reason: '', pointOfControl: item.pointOfControl || 'Puerta principal', shift: item.shift || '', guardId: item.guardId, guardName: item.guardName, date: item.date };
  });
  const rejected = database.guardAttempts.filter((item) => item.guardId === request.account.id).map((item) => ({ ...item, code: item.qrCode }));
  return [...successes, ...rejected].filter((item) => (!query.from || limaDate(new Date(item.date)) >= query.from) && (!query.to || limaDate(new Date(item.date)) <= query.to) && (!query.result || item.result === query.result) && (!query.shift || item.shift === query.shift) && (!query.student || String(item.student || '').toLowerCase().includes(String(query.student).toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
}

function guardAccessMovements(request, query = {}) {
  const ownerId=request.account.id;
  const access=database.guardAccessEntries.filter((item)=>item.guardId===ownerId).map((item)=>{
    const student=database.students.find((candidate)=>candidate.id===item.studentId);
    const document=String(student?.document||'');
    return { id:item.id,type:item.type==='Salida'?'Salida':'Entrada',studentId:item.studentId,student:student?.name||'No identificado',document:document?`${student?.documentType||'DNI'} · ••••${document.slice(-4)}`:'No registrado',program:student?.program||'',pointOfControl:item.pointOfControl||'Puerta principal',guardName:item.guardName||request.account.name,shift:item.shift||'',date:item.date,source:item.movementKind === 'Acceso ordinario' ? 'QR diario · acceso ordinario' : 'QR diario verificado' };
  });
  const exits=database.exitValidations.filter((item)=>item.guardId===ownerId).map((item)=>{
    const requestItem=database.exitRequests.find((candidate)=>candidate.id===item.exitId);
    const student=database.students.find((candidate)=>candidate.id===requestItem?.studentId);
    const document=String(student?.document||'');
    return { id:item.id,type:'Salida',studentId:student?.id||'',student:student?.name||'No identificado',document:document?`${student?.documentType||'DNI'} · ••••${document.slice(-4)}`:'No registrado',program:student?.program||'',pointOfControl:item.pointOfControl||'Puerta principal',guardName:item.guardName||request.account.name,shift:item.shift||'',date:item.date,source:`Boleta ${item.exitId||'oficial'}` };
  });
  const matches=(item)=>{const day=limaDate(new Date(item.date));const search=String(query.search||'').trim().toLowerCase();return (!query.type||item.type===query.type)&&(!query.from||day>=query.from)&&(!query.to||day<=query.to)&&(!search||`${item.student} ${item.document}`.toLowerCase().includes(search));};
  return [...access,...exits].filter(matches).sort((a,b)=>b.date.localeCompare(a.date));
}

function guardAlerts(request) {
  const reviews = new Set(database.guardAlertReviews.filter((item) => item.guardId === request.account.id).map((item) => item.alertId));
  const attemptAlerts = database.guardAttempts.filter((item) => item.guardId === request.account.id).map((item) => ({ id: `ATT-${item.id}`, type: item.reason.includes('usada') || item.reason.includes('utilizada') ? 'QR ya utilizado' : item.reason.includes('horario') ? 'Validación fuera de horario' : item.reason.includes('existe') ? 'QR inválido' : 'Intento rechazado', message: `${item.student}: ${item.reason}`, date: item.date, tone: 'red', reviewed: reviews.has(`ATT-${item.id}`) }));
  const expiredAlerts = guardExitItems().filter((item) => guardTicketStatus(item).status === 'Vencida').map((item) => ({ id: `EXP-${item.id}`, type: 'QR vencido', message: `Boleta ${item.id}`, date: `${item.date}T23:59:00.000Z`, tone: 'amber', reviewed: reviews.has(`EXP-${item.id}`) }));
  const incidentAlerts = database.guardIncidents.filter((item) => item.createdBy === request.account.id).map((item) => ({ id: `INC-${item.id}`, type: 'Incidencia registrada', message: `${item.type} · ${item.pointOfControl}`, date: item.date, tone: item.priority === 'Alta' ? 'red' : 'blue', reviewed: reviews.has(`INC-${item.id}`) }));
  return [...attemptAlerts, ...expiredAlerts, ...incidentAlerts].sort((a, b) => b.date.localeCompare(a.date));
}

function guardReport(request) {
  const rows = guardHistory(request, request.query || {});
  const expired = guardExitItems().filter((item) => guardTicketStatus(item).status === 'Vencida' && (!request.query.from || item.date >= request.query.from) && (!request.query.to || item.date <= request.query.to));
  const incidents = database.guardIncidents.filter((item) => item.createdBy === request.account.id && (!request.query.from || limaDate(new Date(item.date)) >= request.query.from) && (!request.query.to || limaDate(new Date(item.date)) <= request.query.to));
  const activityMap = new Map();
  rows.forEach((item) => {
    const key = `${item.guardName || 'Vigilancia'}|${item.pointOfControl || 'Puerta principal'}`;
    const current = activityMap.get(key) || { guard: item.guardName || 'Vigilancia', pointOfControl: item.pointOfControl || 'Puerta principal', validated: 0, rejected: 0 };
    if (item.result === 'Validada') current.validated += 1; else current.rejected += 1;
    activityMap.set(key, current);
  });
  return { rows, expired, incidents, summary: { validated: rows.filter((item) => item.result === 'Validada').length, rejected: rows.filter((item) => item.result === 'Rechazada').length, expired: expired.length, incidents: incidents.length }, activity: [...activityMap.values()] };
}

app.get('/api/guard/dashboard', requireGuard, (request, response) => {
  const items = guardExitItems();
  const today = limaDate();
  const recent = guardHistory(request).slice(0, 6);
  response.json({ guard: publicAccount(request.account, request.session.csrf, request.session.role), today, summary: { authorized: items.filter((item) => item.date === today).length, validated: database.exitValidations.filter((item) => item.guardId === request.account.id && limaDate(new Date(item.date)) === today).length, entries: database.guardAccessEntries.filter((item) => item.guardId === request.account.id && item.type !== 'Salida' && limaDate(new Date(item.date)) === today).length, rejected: database.guardAttempts.filter((item) => item.guardId === request.account.id && limaDate(new Date(item.date)) === today).length, incidents: database.guardIncidents.filter((item) => item.createdBy === request.account.id && item.status !== 'Cerrada').length }, recent });
});

app.get('/api/guard/access-movements', requireGuard, (request, response) => {
  const today=limaDate();
  const all=guardAccessMovements(request);
  const latestByStudent=new Map();
  all.filter((item)=>limaDate(new Date(item.date))===today).sort((a,b)=>a.date.localeCompare(b.date)).forEach((item)=>latestByStudent.set(item.studentId,item));
  response.json({ entryMethod:'unified-qr',policy:{ dailyQr:'Entradas y salidas ordinarias',authorizedTicket:'Retiros especiales autorizados por Coordinación' },items:guardAccessMovements(request,request.query||{}),summary:{ entries:all.filter((item)=>item.type==='Entrada'&&limaDate(new Date(item.date))===today).length,exits:all.filter((item)=>item.type==='Salida'&&limaDate(new Date(item.date))===today).length,inside:[...latestByStudent.values()].filter((item)=>item.type==='Entrada').length } });
});

function recordGuardAccessMovement(request, response) {
  const decoded = decodeStudentAccessQr(request.body.code);
  if (!decoded) return response.status(400).json({ error: 'El QR de acceso no es válido o ya venció. Solicite al estudiante abrir el QR del día.' });
  const student = database.students.find((item) => item.id === decoded.studentId && item.state === 'Activo');
  if (!student) return response.status(404).json({ error: 'El QR no corresponde a un estudiante activo.' });
  const today = limaDate();
  const movements = [
    ...database.guardAccessEntries.filter((item) => item.studentId === student.id && limaDate(new Date(item.date)) === today).map((item) => ({ type: item.type === 'Salida' ? 'Salida' : 'Entrada', date: item.date })),
    ...database.exitValidations.filter((item) => {
      const exit = database.exitRequests.find((candidate) => candidate.id === item.exitId);
      return exit?.studentId === student.id && limaDate(new Date(item.date)) === today;
    }).map((item) => ({ type: 'Salida', date: item.date }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (movements[0] && Date.now() - new Date(movements[0].date).getTime() < 15000) return response.status(409).json({ error: 'Este QR acaba de registrarse. Espere unos segundos antes de volver a escanearlo.' });
  const type = movements[0]?.type === 'Entrada' ? 'Salida' : 'Entrada';
  const authorizedSpecialExit = type === 'Salida' ? guardExitItems().find((item) => item.studentId === student.id && guardTicketStatus(item).valid) : null;
  if (authorizedSpecialExit) return response.status(409).json({ error: `El estudiante tiene la boleta ${authorizedSpecialExit.id} autorizada para un retiro especial. Use “Validar salida” y escanee la boleta oficial.` });
  const movement = { id: `${type === 'Entrada' ? 'ING' : 'SAL'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type, movementKind: 'Acceso ordinario', studentId: student.id, guardId: request.account.id, guardName: request.account.name, shift: request.account.shift || '', pointOfControl: guardPoint(request, request.body.pointOfControl), date: new Date().toISOString() };
  database.guardAccessEntries.unshift(movement);
  saveDatabase();
  response.status(201).json({ movement, student: { id: student.id, name: student.name, initials: student.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), program: student.program }, message: `${type} registrada correctamente.` });
}

app.post('/api/guard/access-scan', requireGuard, requireCsrf, recordGuardAccessMovement);
app.post('/api/guard/entries', requireGuard, requireCsrf, recordGuardAccessMovement);

app.get('/api/guard/exits', requireGuard, (request, response) => {
  let items = guardExitItems().map((item) => ({ ...item, displayStatus: item.validation ? 'Usada' : guardTicketStatus(item).status === 'Válida' ? 'Pendiente de validar' : guardTicketStatus(item).status }));
  const query = request.query || {};
  items = items.filter((item) => (!query.date || item.date === query.date) && (!query.state || item.displayStatus === query.state) && (!query.program || item.program === query.program || (item.additionalPrograms || []).includes(query.program)) && (!query.search || `${item.student} ${item.id}`.toLowerCase().includes(String(query.search).toLowerCase())));
  response.json({ items, programs: [...new Set(guardExitItems().map((item) => item.program).filter(Boolean))] });
});

app.post('/api/guard/lookup', requireGuard, requireCsrf, (request, response) => {
  const code = String(request.body.code || '').trim();
  if (code.length < 5 || code.length > 120) return response.status(400).json({ error: 'Ingrese un código de boleta válido.' });
  const lookup = guardLookup(code);
  if (!lookup.valid) recordGuardAttempt(request, lookup);
  saveDatabase();
  response.json(lookup);
});

app.post('/api/guard/validate', requireGuard, requireCsrf, (request, response) => {
  const lookup = guardLookup(request.body.code);
  if (!lookup.valid) {
    recordGuardAttempt(request, lookup);
    saveDatabase();
    return response.status(lookup.status === 'No encontrada' ? 404 : 409).json({ error: lookup.reason, status: lookup.status });
  }
  const item = database.exitRequests.find((record) => record.id === lookup.item.id);
  const validation = { id: `VAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, exitId: item.id, qrCode: item.qrCode, guardId: request.account.id, guardName: request.account.name, shift: request.account.shift || '', pointOfControl: guardPoint(request, request.body.pointOfControl), result: 'Validada', date: new Date().toISOString() };
  database.exitValidations.unshift(validation);
  item.validatedAt = validation.date;
  item.validatedBy = request.account.name;
  saveDatabase();
  response.json({ item: lookup.item, validation, message: 'Salida validada correctamente. La boleta quedó marcada como utilizada.' });
});

app.post('/api/guard/reject', requireGuard, requireCsrf, (request, response) => {
  const lookup = guardLookup(request.body.code);
  const allowed = ['Identidad no coincidente','Intento de salida no autorizada','Incidente en puerta','Otro'];
  const reason = String(request.body.reason || 'Identidad no coincidente');
  if (!allowed.includes(reason)) return response.status(400).json({ error: 'Seleccione un motivo de bloqueo válido.' });
  const attempt = recordGuardAttempt(request, lookup, reason);
  saveDatabase();
  response.status(201).json({ item: attempt, message: 'Salida bloqueada e intento registrado en el historial.' });
});

app.get('/api/guard/history', requireGuard, (request, response) => response.json({ items: guardHistory(request, request.query) }));

app.get('/api/guard/alerts', requireGuard, (request, response) => response.json({ items: guardAlerts(request) }));

app.patch('/api/guard/alerts/:id/review', requireGuard, requireCsrf, (request, response) => {
  const alert = guardAlerts(request).find((item) => item.id === request.params.id);
  if (!alert) return response.status(404).json({ error: 'La alerta ya no está disponible.' });
  if (!database.guardAlertReviews.some((item) => item.alertId === alert.id && item.guardId === request.account.id)) database.guardAlertReviews.unshift({ id: `GAR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, alertId: alert.id, guardId: request.account.id, reviewedAt: new Date().toISOString() });
  saveDatabase();
  response.json({ message: 'Alerta marcada como revisada; el historial se conserva.' });
});

app.get('/api/guard/incidents', requireGuard, (request, response) => {
  const items = database.guardIncidents.filter((item) => item.createdBy === request.account.id).map((item) => ({ ...item, student: database.students.find((student) => student.id === item.studentId)?.name || 'No identificado' })).sort((a, b) => b.date.localeCompare(a.date));
  const selected = request.query.student ? database.students.find((item) => item.id === request.query.student) : null;
  response.json({ items, students: selected ? [{ id: selected.id, name: selected.name }] : [] });
});

app.post('/api/guard/incidents', requireGuard, requireCsrf, upload.single('evidence'), asyncRoute(async (request, response) => {
  const studentId = String(request.body.studentId || '');
  const type = String(request.body.type || '');
  const description = String(request.body.description || '').trim();
  const priority = String(request.body.priority || 'Media');
  const exitId = String(request.body.exitId || '').trim().toUpperCase();
  const types = ['QR inválido','Identidad no coincidente','Intento de salida no autorizada','Incidente en puerta','Otro'];
  if (studentId && !database.students.some((item) => item.id === studentId)) return response.status(404).json({ error: 'El estudiante indicado no existe.' });
  if (!types.includes(type) || description.length < 8 || description.length > 800 || !['Baja','Media','Alta'].includes(priority)) return response.status(400).json({ error: 'Complete tipo, descripción y prioridad con datos válidos.' });
  const evidence = await storeEvidence(request.file, guardEvidenceDirectory, 'SEG');
  if (evidence.error) return response.status(400).json({ error: evidence.error });
  const { evidenceFile, evidenceName } = evidence;
  const item = { id: `SEG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, studentId, exitId, date: new Date().toISOString(), type, description, priority, evidenceFile, evidenceName, status: 'Abierta', createdBy: request.account.id, createdByName: request.account.name, pointOfControl: guardPoint(request, request.body.pointOfControl), updatedAt: new Date().toISOString() };
  database.guardIncidents.unshift(item);
  saveDatabase();
  response.status(201).json({ item, message: 'Incidencia de seguridad registrada y enviada para revisión.' });
}));

app.get('/api/guard/incidents/:id/evidence', requireGuard, (request, response) => {
  const item = database.guardIncidents.find((record) => record.id === request.params.id && record.createdBy === request.account.id);
  if (!item?.evidenceFile) return response.sendStatus(404);
  const target = path.join(guardEvidenceDirectory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});

app.get('/api/coordinator/security-incidents', requireCoordinator, (request, response) => {
  const allowedStudents = new Set(database.students.filter((item) => item.program === coordinatorProgram(request)).map((item) => item.id));
  response.json({ items: database.guardIncidents.filter((item) => item.studentId && allowedStudents.has(item.studentId)).map((item) => ({ ...item, student: database.students.find((student) => student.id === item.studentId)?.name || item.studentId })) });
});

app.patch('/api/coordinator/security-incidents/:id', requireCoordinator, requireCsrf, (request, response) => {
  const allowedStudents = new Set(database.students.filter((item) => item.program === coordinatorProgram(request)).map((item) => item.id));
  const item = database.guardIncidents.find((record) => record.id === request.params.id && allowedStudents.has(record.studentId));
  const status = String(request.body.status || '');
  const note = String(request.body.note || '').trim();
  if (!item || !['En revisión', 'Cerrada'].includes(status)) return response.status(400).json({ error: 'Incidencia o estado no válido.' });
  if (item.status === 'Cerrada') return response.status(409).json({ error: 'Una incidencia cerrada conserva su estado final.' });
  if (status === 'Cerrada' && note.length < 3) return response.status(400).json({ error: 'Registre una conclusión antes de cerrar la incidencia.' });
  item.status = status; item.reviewNote = note; item.reviewedBy = request.account.name; item.updatedAt = new Date().toISOString();
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'securityIncident', entityId: item.id, action: status, reason: note, userId: request.account.id, userName: request.account.name, date: item.updatedAt });
  saveDatabase(); response.json({ item, message: `Incidencia marcada como ${status.toLowerCase()}.` });
});

app.get('/api/coordinator/security-incidents/:id/evidence', requireCoordinator, (request, response) => {
  const allowedStudents = new Set(database.students.filter((item) => item.program === coordinatorProgram(request)).map((item) => item.id));
  const item = database.guardIncidents.find((record) => record.id === request.params.id && allowedStudents.has(record.studentId));
  if (!item?.evidenceFile) return response.sendStatus(404);
  const target = path.join(guardEvidenceDirectory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});

app.get('/api/admin/security-incidents', requireAdmin, (request, response) => response.json({ items: database.guardIncidents }));

app.patch('/api/admin/security-incidents/:id', requireAdmin, requireCsrf, (request, response) => {
  const item = database.guardIncidents.find((record) => record.id === request.params.id);
  const status = String(request.body.status || '');
  const note = String(request.body.note || '').trim();
  if (!item || !['En revisión', 'Cerrada'].includes(status)) return response.status(400).json({ error: 'Incidencia o estado no válido.' });
  if (item.status === 'Cerrada') return response.status(409).json({ error: 'Una incidencia cerrada conserva su estado final.' });
  if (status === 'Cerrada' && note.length < 3) return response.status(400).json({ error: 'Registre una conclusión antes de cerrar la incidencia.' });
  item.status = status; item.reviewNote = note; item.reviewedBy = request.account.name; item.updatedAt = new Date().toISOString();
  saveDatabase(); response.json({ item, message: `Incidencia marcada como ${status.toLowerCase()}.` });
});

app.get('/api/admin/security-incidents/:id/evidence', requireAdmin, (request, response) => {
  const item = database.guardIncidents.find((record) => record.id === request.params.id);
  if (!item?.evidenceFile) return response.sendStatus(404);
  const target = path.join(guardEvidenceDirectory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});

app.get('/api/guard/reports', requireGuard, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  response.json(guardReport(request));
});

app.get('/api/guard/reports.xlsx', requireGuard, asyncRoute(async (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const report = guardReport(request); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Control de acceso');
  sheet.addRow(['SIGA - Reporte de control de acceso']); sheet.addRow(['Vigilante', request.account.name]); sheet.addRow(['Turno', request.account.shift || '']); sheet.addRow(['Punto de control', request.account.pointOfControl || '']); sheet.addRow([]); sheet.addRow(['Fecha y hora','Estudiante','Boleta','Resultado','Motivo','Punto de control']);
  report.rows.forEach((item) => sheet.addRow([item.date,item.student,item.exitId,item.result,item.reason,item.pointOfControl]));
  sheet.columns.forEach((column) => { column.width = 24; });
  response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition','attachment; filename="reporte-vigilancia-siga.xlsx"'); await workbook.xlsx.write(response); response.end();
}));

app.get('/api/guard/reports.pdf', requireGuard, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const report = guardReport(request); response.setHeader('Content-Type','application/pdf'); response.setHeader('Content-Disposition','attachment; filename="reporte-vigilancia-siga.pdf"'); const document = new PDFDocument({ margin: 48, size: 'A4' }); document.pipe(response);
  document.fontSize(18).fillColor('#163c71').text('SIGA - Control de acceso'); document.moveDown().fontSize(11).fillColor('#12213d').text(`Vigilante: ${request.account.name}`).text(`Turno: ${request.account.shift || 'No asignado'}`).text(`Punto de control: ${request.account.pointOfControl || 'No asignado'}`); document.moveDown().fontSize(13).text('Resumen'); document.fontSize(10).text(`Salidas validadas: ${report.summary.validated}`).text(`Intentos rechazados: ${report.summary.rejected}`).text(`Boletas vencidas: ${report.summary.expired}`).text(`Incidencias: ${report.summary.incidents}`); document.moveDown().fontSize(13).text('Actividad'); report.rows.slice(0, 30).forEach((item) => document.fontSize(9).text(`${item.date} · ${item.student} · ${item.result}${item.reason ? ` · ${item.reason}` : ''}`)); document.end();
});

app.get('/api/guard/profile', requireGuard, (request, response) => response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role), validations: database.exitValidations.filter((item) => item.guardId === request.account.id).length, rejected: database.guardAttempts.filter((item) => item.guardId === request.account.id).length }));

app.get('/api/teacher/reports', requireTeacher, (request, response) => {
  const queryError = teacherReportQueryError(request);
  if (queryError) return response.status(400).json({ error: queryError });
  response.json({ ...teacherReport(request), classes: teacherClasses(request) });
});

app.get('/api/teacher/reports.xlsx', requireTeacher, asyncRoute(async (request, response) => {
  const queryError = teacherReportQueryError(request);
  if (queryError) return response.status(400).json({ error: queryError });
  const report = teacherReport(request);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Asistencia docente');
  sheet.addRow(['Fecha', 'Curso', 'Estudiante', 'Estado']);
  report.rows.forEach((item) => sheet.addRow([item.date, item.course, item.student, item.state]));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5BB5' } };
  sheet.columns = [{ width: 15 }, { width: 38 }, { width: 34 }, { width: 18 }];
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename="reporte-docente-siga.xlsx"');
  await workbook.xlsx.write(response); response.end();
}));

app.get('/api/teacher/reports.pdf', requireTeacher, (request, response) => {
  const queryError = teacherReportQueryError(request);
  if (queryError) return response.status(400).json({ error: queryError });
  const report = teacherReport(request);
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="reporte-docente-siga.pdf"');
  const document = new PDFDocument({ margin: 48, size: 'A4' });
  document.pipe(response);
  document.fontSize(18).fillColor('#173b7a').text('SIGA - Reporte de asistencia docente');
  document.moveDown().fontSize(11).fillColor('#12213d').text(`Docente: ${request.account.name}`).text(`Programa: ${request.account.program}`).text(`Registros: ${report.total} · Asistencia: ${report.attendanceRate}%`);
  document.moveDown().fontSize(13).text('Distribución por estado');
  report.byState.forEach((item) => document.fontSize(10).text(`${item.state}: ${item.total}`));
  document.moveDown().fontSize(13).text('Detalle');
  report.rows.forEach((item) => document.fontSize(9).text(`${item.date} · ${item.course} · ${item.student} · ${item.state}`));
  document.end();
});

function coordinatorExitItems(request) {
  const program = coordinatorProgram(request);
  const classes = new Map(database.classes.filter((item) => item.program === program).map((item) => [item.id, item]));
  const students = new Set(database.students.filter((student) => student.program === program).map((student) => student.id));
  return database.exitRequests.filter((item) => {
    if (!students.has(item.studentId)) return false;
    if (item.source === 'Estudiante') return true;
    const course = classes.get(item.classId);
    return Boolean(course && course.studentIds.includes(item.studentId));
  }).map((item) => ({
    ...item,
    student: database.students.find((student) => student.id === item.studentId)?.name || item.studentId,
    course: classes.get(item.classId)?.course || 'Solicitud del estudiante',
    group: classes.get(item.classId)?.group || '',
    teacher: database.accounts.find((account) => account.id === (item.requestedBy || item.teacherId))?.name || item.source,
  }));
}

app.get('/api/coordinator/exits', requireCoordinator, (request, response) => {
  const program = coordinatorProgram(request);
  if (!program) return response.status(400).json({ error: 'La cuenta del Coordinador no tiene un programa asignado.' });
  response.json({ items: coordinatorExitItems(request), program });
});

app.patch('/api/coordinator/exits/:id', requireCoordinator, requireCsrf, (request, response) => {
  const nextStatus = String(request.body.status || '');
  const decisionReason = String(request.body.reason || '').trim();
  if (!['Autorizada', 'Rechazada'].includes(nextStatus)) return response.status(400).json({ error: 'Seleccione una decisión válida.' });
  if (nextStatus === 'Rechazada' && (!decisionReason || decisionReason.length > 300)) return response.status(400).json({ error: 'Indique el motivo del rechazo.' });
  const allowedIds = new Set(coordinatorExitItems(request).map((item) => item.id));
  const item = database.exitRequests.find((record) => record.id === request.params.id && allowedIds.has(record.id));
  if (!item) return response.status(404).json({ error: 'La solicitud no pertenece al programa del coordinador.' });
  if (item.status !== 'Pendiente de coordinación') return response.status(409).json({ error: 'La solicitud ya fue evaluada y no puede volver a modificarse.' });
  if (item.requestedBy === request.account.id || item.teacherId === request.account.id) return response.status(403).json({ error: 'El Coordinador no puede autorizar una solicitud registrada por su propia cuenta.' });
  if (nextStatus === 'Autorizada') {
    const today = limaDate();
    const elapsed = timeToMinutes(limaTime()) - timeToMinutes(item.time);
    if (item.date < today || (item.date === today && elapsed > 240)) return response.status(409).json({ error: 'La solicitud ya está fuera de la ventana de validación y no puede autorizarse.' });
  }
  item.status = nextStatus;
  item.decisionReason = decisionReason;
  item.authorizedBy = request.account.name;
  item.authorizedById = request.account.id;
  item.authorizedAt = new Date().toISOString();
  item.qrCode = nextStatus === 'Autorizada' ? `SIGA-${item.id}-${crypto.randomUUID().slice(0, 12).toUpperCase()}` : '';
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'exitRequest', entityId: item.id, action: nextStatus, reason: decisionReason, userId: request.account.id, userName: request.account.name, date: item.authorizedAt });
  const requesterId = item.requestedBy || item.teacherId;
  database.notifications.unshift({
    id: `NOT-${crypto.randomUUID().slice(0, 8)}`,
    userId: requesterId,
    title: nextStatus === 'Autorizada' ? 'Boleta autorizada' : 'Solicitud rechazada',
    message: `La solicitud ${item.id} fue ${nextStatus.toLowerCase()} por Coordinación.`,
    date: item.authorizedAt,
    read: false,
  });
  const studentAccount = database.accounts.find((account) => account.studentId === item.studentId && account.id !== requesterId);
  if (studentAccount) database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8)}`, userId: studentAccount.id, studentId: item.studentId, title: nextStatus === 'Autorizada' ? 'Boleta de salida autorizada' : 'Solicitud de salida rechazada', message: `Coordinación ${nextStatus === 'Autorizada' ? 'aprobó' : 'rechazó'} la solicitud ${item.id}.`, date: item.authorizedAt, read: false });
  database.accounts.filter((account) => accountRoles(account).includes('padre') && Array.isArray(account.studentIds) && account.studentIds.includes(item.studentId)).forEach((account) => {
    database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8)}`, userId: account.id, studentId: item.studentId, title: nextStatus === 'Autorizada' ? 'Boleta de salida autorizada' : 'Solicitud de salida rechazada', message: `La solicitud ${item.id} fue ${nextStatus.toLowerCase()} por Coordinación.`, date: item.authorizedAt, read: false });
  });
  saveDatabase();
  response.json({ item: coordinatorExitItems(request).find((record) => record.id === item.id), message: nextStatus === 'Autorizada' ? 'Salida autorizada y boleta QR generada.' : 'Solicitud rechazada.' });
});

app.get('/api/coordinator/exits/:id/qr.svg', requireCoordinator, asyncRoute(async (request, response) => {
  const item = coordinatorExitItems(request).find((record) => record.id === request.params.id);
  if (!item || item.status !== 'Autorizada' || !item.qrCode) return response.status(404).json({ error: 'La boleta no tiene un QR autorizado.' });
  const svg = await QRCode.toString(item.qrCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c1c34', light: '#ffffff' } });
  response.type('image/svg+xml').send(svg);
}));

function coordinatorJustifications(request, query = {}) {
  const students = new Map(database.students.filter((item) => item.program === coordinatorProgram(request)).map((item) => [item.id, item]));
  const visibleStatuses = new Set(['En revisión', 'Derivada a Coordinación', 'Aprobada', 'Observada']);
  return database.tutorJustifications
    .filter((item) => students.has(item.studentId) && visibleStatuses.has(item.status) && (!query.status || item.status === query.status) && (!query.student || item.studentId === query.student))
    .map((item) => ({ ...item, student: students.get(item.studentId).name, program: students.get(item.studentId).program }))
    .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
}

app.get('/api/coordinator/justifications', requireCoordinator, (request, response) => {
  response.json({ items: coordinatorJustifications(request, request.query), students: enrichedCoordinatorStudents(request).map((item) => ({ id: item.id, name: item.name })), statuses: ['En revisión', 'Derivada a Coordinación', 'Aprobada', 'Observada'] });
});

app.patch('/api/coordinator/justifications/:id', requireCoordinator, requireCsrf, (request, response) => {
  const scoped = coordinatorJustifications(request).find((item) => item.id === request.params.id);
  const status = String(request.body.status || '');
  const observation = String(request.body.observation || '').trim();
  if (!scoped) return response.status(404).json({ error: 'La justificación no pertenece a su programa.' });
  if (!['Aprobada', 'Observada'].includes(status)) return response.status(400).json({ error: 'Seleccione una resolución válida.' });
  if (!['Derivada a Coordinación', 'En revisión'].includes(scoped.status)) return response.status(409).json({ error: 'La justificación ya tiene una resolución final.' });
  if (status === 'Observada' && observation.length < 3) return response.status(400).json({ error: 'Indique el motivo de la observación.' });
  if (observation.length > 600) return response.status(400).json({ error: 'La observación no debe superar 600 caracteres.' });
  const item = database.tutorJustifications.find((record) => record.id === scoped.id);
  item.status = status;
  item.observation = observation || 'Justificación aprobada por Coordinación.';
  item.resolvedBy = request.account.id;
  item.resolvedByName = request.account.name;
  item.resolvedAt = new Date().toISOString();
  item.updatedAt = item.resolvedAt;
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'justification', entityId: item.id, action: status, reason: item.observation, userId: request.account.id, userName: request.account.name, date: item.resolvedAt });
  if (item.createdBy) database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, userId: item.createdBy, studentId: item.studentId, title: `Justificación ${status.toLowerCase()}`, message: `${item.id}: ${item.observation}`, date: item.resolvedAt, read: false });
  saveDatabase();
  response.json({ item, message: `Justificación marcada como ${status.toLowerCase()}.` });
});

app.get('/api/coordinator/justifications/:id/evidence', requireCoordinator, (request, response) => {
  const item = coordinatorJustifications(request).find((record) => record.id === request.params.id);
  if (!item?.evidenceFile) return response.sendStatus(404);
  const directory = item.evidenceSource === 'student' ? studentEvidenceDirectory : familyEvidenceDirectory;
  const target = path.join(directory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});

app.get('/api/notifications', requireAuth, (request, response) => {
  const items = database.notifications.filter((item) => item.userId === request.account.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  response.json({ items, unread: items.filter((item) => !item.read).length });
});

app.patch('/api/notifications/read', requireAuth, requireCsrf, (request, response) => {
  database.notifications.forEach((item) => { if (item.userId === request.account.id) item.read = true; });
  saveDatabase(); response.json({ message: 'Notificaciones marcadas como leídas.' });
});

const tutorCaseTypes = ['Académica', 'Asistencia', 'Conducta', 'Económica', 'Familiar', 'Otra'];
const tutorCasePriorities = ['Baja', 'Media', 'Alta', 'Crítica'];
const tutorCaseStates = ['Abierto', 'En seguimiento', 'Derivado', 'Cerrado'];

function tutorStaffIds(request) {
  return database.staff.filter((item) => item.accountId === request.account.id || item.email.toLowerCase() === request.account.email.toLowerCase()).map((item) => item.id);
}

function tutorStudents(request, query = {}) {
  const staffIds = new Set(tutorStaffIds(request));
  const search = String(query.search || '').trim().toLowerCase();
  return database.students.filter((item) => staffIds.has(item.tutorId) || item.tutorAccountId === request.account.id)
    .filter((item) => (!search || [item.name,item.document,item.email,item.program,item.group].some((value) => String(value || '').toLowerCase().includes(search))) && (!query.semester || item.semester === query.semester) && (!query.group || item.group === query.group) && (!query.state || item.state === query.state));
}

function tutorStudent(request, id) {
  return tutorStudents(request).find((item) => item.id === id);
}

function tutorAttendance(request, query = {}) {
  const students = new Map(tutorStudents(request).map((item) => [item.id, item]));
  const classes = new Map(database.classes.map((item) => [item.id, item]));
  return database.teacherAttendance.filter((item) => students.has(item.studentId))
    .filter((item) => !query.student || item.studentId === query.student)
    .filter((item) => !query.from || item.date >= query.from)
    .filter((item) => !query.to || item.date <= query.to)
    .filter((item) => !query.state || item.state === query.state)
    .map((item) => ({ ...item, student: students.get(item.studentId).name, semester: students.get(item.studentId).semester, group: students.get(item.studentId).group || '', course: classes.get(item.classId)?.course || 'Registro académico' }))
    .filter((item) => (!query.semester || item.semester === query.semester) && (!query.group || item.group === query.group))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function tutorCaseHistory(id) {
  return database.tutorAudit.filter((item) => item.entity === 'case' && item.entityId === id).sort((a, b) => b.date.localeCompare(a.date));
}

function tutorCases(request, query = {}) {
  const studentMap = new Map(tutorStudents(request).map((item) => [item.id, item]));
  const search = String(query.search || '').trim().toLowerCase();
  return database.tutorCases.filter((item) => studentMap.has(item.studentId))
    .map((item) => ({ ...item, student: studentMap.get(item.studentId).name, semester: studentMap.get(item.studentId).semester, group: studentMap.get(item.studentId).group || '', history: tutorCaseHistory(item.id) }))
    .filter((item) => (!search || [item.id,item.student,item.type,item.description,item.actions,item.responsible].some((value) => String(value || '').toLowerCase().includes(search))) && (!query.student || item.studentId === query.student) && (!query.type || item.type === query.type) && (!query.priority || item.priority === query.priority) && (!query.state || item.status === query.state));
}

function tutorAudit(request, entity, entityId, action, detail) {
  database.tutorAudit.unshift({ id: `TAU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity, entityId, action, detail: String(detail || '').trim(), userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
}

function notifyCoordinators(student, title, message) {
  database.accounts.filter((account) => accountRoles(account).includes('coordinador') && account.program === student.program).forEach((account) => database.notifications.unshift({ id: `NOT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, userId: account.id, title, message, date: new Date().toISOString(), read: false }));
}

function createCoordinatorIncidentFromTutor(request, source, sourceType) {
  const student = tutorStudent(request, source.studentId);
  if (!student) return null;
  const linkKey = sourceType === 'case' ? 'tutorCaseId' : 'tutorAlertId';
  const existing = database.permanenceIncidents.find((item) => item[linkKey] === source.id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const type = incidentTypes.includes(source.type) ? source.type : (String(source.type || '').toLowerCase().includes('asistencia') || String(source.type || '').toLowerCase().includes('tardanza') || String(source.type || '').toLowerCase().includes('inasistencia') ? 'Asistencia' : 'Otra');
  const item = {
    id: `INC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    studentId: student.id,
    program: student.program,
    date: source.date || limaDate(),
    type,
    description: source.description || source.detail || `Derivación de Tutoría: ${source.type}`,
    responsible: 'Coordinación académica',
    evidence: source.evidenceName || '',
    status: 'Abierta',
    source: 'Tutoría',
    [linkKey]: source.id,
    createdBy: request.account.id,
    createdAt: now,
    updatedAt: now,
  };
  database.permanenceIncidents.unshift(item);
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'incident', entityId: item.id, action: 'Recibida de Tutoría', reason: source.id, userId: request.account.id, userName: request.account.name, date: now });
  return item;
}

function automaticTutorAlerts(request) {
  const items = [];
  const cases = tutorCases(request);
  for (const student of tutorStudents(request)) {
    const rows = tutorAttendance(request, { student: student.id });
    const rate = attendanceSummary(rows).attendanceRate;
    const absences = rows.filter((item) => item.state === 'Ausente').length;
    const tardies = rows.filter((item) => item.state === 'Tardanza').length;
    let consecutive = 0;
    for (const row of rows) { if (row.state === 'Ausente') consecutive += 1; else break; }
    if (consecutive >= 2) items.push({ id: `AUTO-ABS-${student.id}`, studentId: student.id, student: student.name, type: 'Inasistencias consecutivas', severity: 'Crítica', detail: `${consecutive} ausencias consecutivas detectadas.`, automatic: true });
    if (tardies >= 3) items.push({ id: `AUTO-TAR-${student.id}`, studentId: student.id, student: student.name, type: 'Tardanzas frecuentes', severity: 'Alta', detail: `${tardies} tardanzas en el periodo consultado.`, automatic: true });
    if (rows.length && rate < 75) items.push({ id: `AUTO-RISK-${student.id}`, studentId: student.id, student: student.name, type: 'Bajo nivel de asistencia', severity: rate < 60 ? 'Crítica' : 'Alta', detail: `Asistencia acumulada de ${rate}%.`, automatic: true });
    const openCases = cases.filter((item) => item.studentId === student.id && item.status !== 'Cerrado').length;
    if (openCases) items.push({ id: `AUTO-CASE-${student.id}`, studentId: student.id, student: student.name, type: 'Incidencias abiertas', severity: 'Media', detail: `${openCases} caso${openCases === 1 ? '' : 's'} pendiente${openCases === 1 ? '' : 's'} de atención.`, automatic: true });
    const latest = database.tutorAudit.filter((item) => item.userId === request.account.id && String(item.detail || '').includes(student.name)).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest && !cases.some((item) => item.studentId === student.id)) items.push({ id: `AUTO-NOFOLLOW-${student.id}`, studentId: student.id, student: student.name, type: 'Sin seguimiento reciente', severity: 'Media', detail: 'No se registran acciones de tutoría recientes.', automatic: true });
  }
  return items;
}

function tutorAlerts(request, query = {}) {
  const allowed = new Set(tutorStudents(request).map((item) => item.id));
  const saved = database.tutorAlerts.filter((item) => item.tutorId === request.account.id && allowed.has(item.studentId));
  const savedMap = new Map(saved.map((item) => [item.id, item]));
  const generated = automaticTutorAlerts(request).map((item) => ({ reviewed: false, action: '', derived: false, ...item, ...(savedMap.get(item.id) || {}) }));
  const generatedIds = new Set(generated.map((item) => item.id));
  return [...generated, ...saved.filter((item) => !generatedIds.has(item.id)).map((item) => ({ ...item, automatic: false }))]
    .filter((item) => (!query.reviewed || String(Boolean(item.reviewed)) === query.reviewed) && (!query.severity || item.severity === query.severity) && (!query.student || item.studentId === query.student));
}

async function saveTutorEvidence(file, id) {
  return storeEvidence(file, tutorEvidenceDirectory, id);
}

function validateTutorCase(request, body) {
  const student = tutorStudent(request, String(body.studentId || ''));
  const date = String(body.date || '');
  const type = String(body.type || '');
  const priority = String(body.priority || '');
  const status = String(body.status || 'Abierto');
  const description = String(body.description || '').trim();
  const actions = String(body.actions || '').trim();
  const responsible = String(body.responsible || request.account.name).trim();
  const sharedWithFamily = body.sharedWithFamily === true || body.sharedWithFamily === 'on' || body.sharedWithFamily === 'true';
  const sharedWithStudent = body.sharedWithStudent === true || body.sharedWithStudent === 'on' || body.sharedWithStudent === 'true';
  const familyNextStep = String(body.familyNextStep || '').trim();
  if (!student) return { error: 'Seleccione un estudiante asignado a su tutoría.' };
  if (!validIsoDate(date) || !tutorCaseTypes.includes(type) || !tutorCasePriorities.includes(priority) || !tutorCaseStates.includes(status)) return { error: 'Seleccione fecha, tipo, prioridad y estado válidos.' };
  if (description.length < 10 || description.length > 800 || actions.length > 800 || !responsible || responsible.length > 120) return { error: 'Complete una descripción de al menos 10 caracteres y revise la longitud de los campos.' };
  if (familyNextStep && !validIsoDate(familyNextStep)) return { error: 'Seleccione una fecha válida para el próximo seguimiento.' };
  return { values: { studentId: student.id, date, type, description, priority, actions, responsible, status, sharedWithFamily, sharedWithStudent, familyNextStep } };
}

app.get('/api/tutor/dashboard', requireTutor, (request, response) => {
  const students = tutorStudents(request);
  const todayRows = tutorAttendance(request, { from: limaDate(), to: limaDate() });
  const count = (state) => new Set(todayRows.filter((item) => item.state === state).map((item) => item.studentId)).size;
  const alerts = tutorAlerts(request).filter((item) => !item.reviewed);
  const cases = tutorCases(request).filter((item) => item.status !== 'Cerrado');
  response.json({ tutor: publicAccount(request.account, request.session.csrf, request.session.role), today: limaDate(), summary: { students: students.length, present: count('Presente'), late: count('Tardanza'), absent: count('Ausente'), alerts: alerts.length, cases: cases.length }, alerts: alerts.slice(0, 4), recentCases: cases.slice(0, 4) });
});

app.get('/api/tutor/students', requireTutor, (request, response) => {
  const items = tutorStudents(request, request.query).map((student) => {
    const rows = tutorAttendance(request, { student: student.id });
    const present = rows.filter((item) => item.state === 'Presente').length;
    const last = rows[0];
    return { ...student, tutor: request.account.name, attendanceState: last?.state || 'Sin registro', attendanceRate: rows.length ? Math.round(present / rows.length * 100) : 0, attendanceRecords: rows.length, risk: rows.length && Math.round(present / rows.length * 100) < 75 ? 'En riesgo' : 'Estable' };
  });
  const all = tutorStudents(request);
  response.json({ items, semesters: [...new Set(all.map((item) => item.semester))].sort(), groups: [...new Set(all.map((item) => item.group).filter(Boolean))].sort(), tutor: request.account.name });
});

app.get('/api/tutor/students/:id', requireTutor, (request, response) => {
  const student = tutorStudent(request, request.params.id);
  if (!student) return response.status(404).json({ error: 'El estudiante no pertenece a su tutoría.' });
  response.json({ student: { ...student, tutor: request.account.name }, attendance: tutorAttendance(request, { student: student.id }), cases: tutorCases(request, { student: student.id }), observations: database.tutorAudit.filter((item) => item.userId === request.account.id && item.detail).filter((item) => item.entityId === student.id || tutorCaseHistory(item.entityId).some((audit) => audit.detail.includes(student.name))).slice(0, 20) });
});

app.get('/api/tutor/attendance', requireTutor, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const rows = tutorAttendance(request, request.query);
  const statesList = ['Presente','Tardanza','Ausente','Permiso'];
  const byState = statesList.map((state) => ({ state, total: rows.filter((item) => item.state === state).length }));
  const trends = [...new Set(rows.map((item) => item.date))].sort().map((date) => ({ date, present: rows.filter((item) => item.date === date && item.state === 'Presente').length, total: rows.filter((item) => item.date === date).length }));
  const perStudent = tutorStudents(request, request.query).map((student) => { const entries = rows.filter((item) => item.studentId === student.id); const rate = attendanceSummary(entries).attendanceRate; return { id: student.id, name: student.name, records: entries.length, rate, risk: Boolean(entries.length && rate < 75) }; });
  response.json({ rows, byState, trends, perStudent, total: rows.length, attendanceRate: attendanceSummary(rows).attendanceRate });
});

app.get('/api/tutor/cases', requireTutor, (request, response) => response.json({ items: tutorCases(request, request.query), students: tutorStudents(request).map((item) => ({ id: item.id, name: item.name })), types: tutorCaseTypes, priorities: tutorCasePriorities, states: tutorCaseStates }));

app.post('/api/tutor/cases', requireTutor, requireCsrf, upload.single('evidence'), asyncRoute(async (request, response) => {
  const validation = validateTutorCase(request, request.body);
  if (validation.error) return response.status(400).json({ error: validation.error });
  const id = `TCA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const evidence = await saveTutorEvidence(request.file, id);
  if (evidence.error) return response.status(400).json({ error: evidence.error });
  const now = new Date().toISOString();
  const item = { id, tutorId: request.account.id, ...validation.values, ...evidence, createdAt: now, updatedAt: now };
  database.tutorCases.unshift(item); tutorAudit(request, 'case', id, 'Creación', `Caso creado para ${tutorStudent(request, item.studentId).name}.`); saveDatabase();
  response.status(201).json({ item, message: 'Caso de permanencia registrado correctamente.' });
}));

app.put('/api/tutor/cases/:id', requireTutor, requireCsrf, upload.single('evidence'), asyncRoute(async (request, response) => {
  const item = tutorCases(request).find((record) => record.id === request.params.id);
  if (!item) return response.status(404).json({ error: 'Caso no encontrado dentro de su tutoría.' });
  const target = database.tutorCases.find((record) => record.id === item.id);
  const validation = validateTutorCase(request, request.body);
  if (validation.error) return response.status(400).json({ error: validation.error });
  const evidence = await saveTutorEvidence(request.file, target.id);
  if (evidence.error) return response.status(400).json({ error: evidence.error });
  Object.assign(target, validation.values, request.file ? evidence : {}, { updatedAt: new Date().toISOString() });
  tutorAudit(request, 'case', target.id, 'Actualización', 'Datos del caso actualizados.'); saveDatabase();
  response.json({ item: target, message: 'Caso actualizado correctamente.' });
}));

app.patch('/api/tutor/cases/:id/state', requireTutor, requireCsrf, (request, response) => {
  const scoped = tutorCases(request).find((record) => record.id === request.params.id);
  if (!scoped) return response.status(404).json({ error: 'Caso no encontrado dentro de su tutoría.' });
  const status = String(request.body.status || '');
  const comment = String(request.body.comment || '').trim();
  if (!tutorCaseStates.includes(status)) return response.status(400).json({ error: 'Seleccione un estado válido.' });
  if (status === 'Cerrado' && !comment && !scoped.evidenceName) return response.status(400).json({ error: 'Para cerrar el caso registre un comentario de cierre o adjunte evidencia.' });
  const target = database.tutorCases.find((item) => item.id === scoped.id);
  target.status = status; target.updatedAt = new Date().toISOString();
  tutorAudit(request, 'case', target.id, `Estado: ${status}`, comment || 'Cambio de estado registrado.');
  if (status === 'Derivado') { const student = tutorStudent(request, target.studentId); createCoordinatorIncidentFromTutor(request, target, 'case'); notifyCoordinators(student, 'Caso derivado por Tutoría', `${student.name} · ${target.type} · ${target.id}`); }
  saveDatabase(); response.json({ item: target, message: `Caso marcado como ${status.toLowerCase()}.` });
});

app.post('/api/tutor/cases/:id/comments', requireTutor, requireCsrf, (request, response) => {
  const item = tutorCases(request).find((record) => record.id === request.params.id);
  const comment = String(request.body.comment || '').trim();
  if (!item || comment.length < 3 || comment.length > 600) return response.status(400).json({ error: 'Ingrese un comentario válido de hasta 600 caracteres.' });
  tutorAudit(request, 'case', item.id, 'Comentario', comment); saveDatabase(); response.status(201).json({ message: 'Comentario agregado al historial.' });
});

app.get('/api/tutor/cases/:id/evidence', requireTutor, (request, response) => {
  const item = tutorCases(request).find((record) => record.id === request.params.id);
  if (!item?.evidenceFile) return response.sendStatus(404);
  const target = path.join(tutorEvidenceDirectory, path.basename(item.evidenceFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.download(target, item.evidenceName || path.basename(target));
});

app.get('/api/tutor/alerts', requireTutor, (request, response) => response.json({ items: tutorAlerts(request, request.query), students: tutorStudents(request).map((item) => ({ id: item.id, name: item.name })) }));

app.post('/api/tutor/alerts', requireTutor, requireCsrf, (request, response) => {
  const student = tutorStudent(request, String(request.body.studentId || ''));
  const type = String(request.body.type || '').trim(); const detail = String(request.body.detail || '').trim(); const severity = String(request.body.severity || 'Media');
  if (!student || type.length < 3 || detail.length < 5 || detail.length > 500 || !tutorCasePriorities.includes(severity)) return response.status(400).json({ error: 'Complete estudiante, tipo, nivel y detalle de la alerta.' });
  const item = { id: `ALT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, tutorId: request.account.id, studentId: student.id, student: student.name, type, detail, severity, reviewed: false, action: '', derived: false, automatic: false, createdAt: new Date().toISOString() };
  database.tutorAlerts.unshift(item); tutorAudit(request, 'alert', item.id, 'Creación', `Alerta manual para ${student.name}.`); saveDatabase(); response.status(201).json({ item, message: 'Alerta manual registrada.' });
});

app.patch('/api/tutor/alerts/:id', requireTutor, requireCsrf, (request, response) => {
  const current = tutorAlerts(request).find((item) => item.id === request.params.id);
  if (!current) return response.status(404).json({ error: 'Alerta no encontrada.' });
  const action = String(request.body.action || '').trim(); const reviewed = Boolean(request.body.reviewed); const derived = Boolean(request.body.derived);
  if ((reviewed || derived) && action.length < 3) return response.status(400).json({ error: 'Registre la acción realizada antes de continuar.' });
  let target = database.tutorAlerts.find((item) => item.id === current.id && item.tutorId === request.account.id);
  if (!target) { target = { ...current, tutorId: request.account.id, createdAt: current.createdAt || new Date().toISOString() }; database.tutorAlerts.unshift(target); }
  Object.assign(target, { reviewed, action, derived, updatedAt: new Date().toISOString() });
  tutorAudit(request, 'alert', target.id, derived ? 'Derivación' : reviewed ? 'Revisión' : 'Actualización', action);
  if (derived) { const student = tutorStudent(request, target.studentId); createCoordinatorIncidentFromTutor(request, target, 'alert'); notifyCoordinators(student, 'Alerta derivada por Tutoría', `${student.name} · ${target.type}: ${action}`); }
  saveDatabase(); response.json({ item: target, message: derived ? 'Alerta derivada a Coordinación.' : 'Alerta actualizada.' });
});

app.get('/api/tutor/communication', requireTutor, (request, response) => response.json({ messages: database.tutorMessages.filter((item) => item.tutorId === request.account.id), meetings: database.tutorMeetings.filter((item) => item.tutorId === request.account.id), students: tutorStudents(request).map((item) => ({ id: item.id, name: item.name })) }));

app.post('/api/tutor/messages', requireTutor, requireCsrf, (request, response) => {
  const student = tutorStudent(request, String(request.body.studentId || '')); const subject = String(request.body.subject || '').trim(); const message = String(request.body.message || '').trim(); const recipients = String(request.body.recipients || ''); const date = String(request.body.date || limaDate());
  if (!student || subject.length < 3 || subject.length > 120 || message.length < 5 || message.length > 1000 || !['Estudiante','Apoderado','Estudiante y apoderado'].includes(recipients) || !validIsoDate(date)) return response.status(400).json({ error: 'Complete correctamente el aviso y sus destinatarios.' });
  const item = { id: `COM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, tutorId: request.account.id, studentId: student.id, subject, message, recipients, date, sentAt: new Date().toISOString() };
  database.tutorMessages.unshift(item); tutorAudit(request, 'message', item.id, 'Envío', `Aviso enviado a ${recipients}: ${student.name}.`); saveDatabase(); response.status(201).json({ item, message: 'Aviso registrado y enviado correctamente.' });
});

app.post('/api/tutor/meetings', requireTutor, requireCsrf, (request, response) => {
  const student = tutorStudent(request, String(request.body.studentId || '')); const date = String(request.body.date || ''); const time = String(request.body.time || ''); const participants = String(request.body.participants || '').trim(); const agreements = String(request.body.agreements || '').trim(); const followUp = String(request.body.followUp || '').trim();
  if (!student || !validIsoDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || participants.length < 3 || agreements.length < 5 || agreements.length > 1000 || followUp.length > 600) return response.status(400).json({ error: 'Complete fecha, hora, participantes y acuerdos de la reunión.' });
  const item = { id: `REU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, tutorId: request.account.id, studentId: student.id, date, time, participants, agreements, followUp, status: followUp ? 'Seguimiento pendiente' : 'Registrada', createdAt: new Date().toISOString() };
  database.tutorMeetings.unshift(item); tutorAudit(request, 'meeting', item.id, 'Registro', `Reunión registrada con ${student.name}.`); saveDatabase(); response.status(201).json({ item, message: 'Reunión registrada correctamente.' });
});

app.get('/api/tutor/justifications', requireTutor, (request, response) => {
  const students = new Map(tutorStudents(request).map((item) => [item.id, item]));
  const items = database.tutorJustifications.filter((item) => students.has(item.studentId)).map((item) => ({ ...item, student: students.get(item.studentId).name }));
  response.json({ items });
});

app.patch('/api/tutor/justifications/:id', requireTutor, requireCsrf, (request, response) => {
  const students = new Map(tutorStudents(request).map((item) => [item.id, item]));
  const item = database.tutorJustifications.find((record) => record.id === request.params.id && students.has(record.studentId));
  const observation = String(request.body.observation || '').trim(); const derive = Boolean(request.body.derive);
  if (!item || observation.length < 3 || observation.length > 600) return response.status(400).json({ error: 'Registre una observación válida.' });
  item.observation = observation; item.status = derive ? 'Derivada a Coordinación' : 'En revisión'; item.updatedAt = new Date().toISOString(); item.derivedBy = derive ? request.account.id : '';
  tutorAudit(request, 'justification', item.id, derive ? 'Derivación' : 'Observación', observation);
  if (derive) notifyCoordinators(students.get(item.studentId), 'Justificación derivada por Tutoría', `${students.get(item.studentId).name} · ${item.id}`);
  saveDatabase(); response.json({ item, message: derive ? 'Justificación derivada a Coordinación.' : 'Observación registrada.' });
});

function tutorReport(request, query = {}) {
  const attendance = tutorAttendance(request, query);
  const cases = tutorCases(request).filter((item) => (!query.semester || item.semester === query.semester) && (!query.group || item.group === query.group));
  const alerts = tutorAlerts(request).filter((item) => !query.student || item.studentId === query.student);
  const students = tutorStudents(request, query);
  return { students, attendance, cases, alerts, byAttendance: ['Presente','Tardanza','Ausente','Permiso'].map((state) => ({ state, total: attendance.filter((item) => item.state === state).length })), byCaseState: tutorCaseStates.map((state) => ({ state, total: cases.filter((item) => item.status === state).length })), alertSummary: { reviewed: alerts.filter((item) => item.reviewed).length, pending: alerts.filter((item) => !item.reviewed).length }, followUps: database.tutorAudit.filter((item) => item.userId === request.account.id).length };
}

app.get('/api/tutor/reports', requireTutor, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  response.json(tutorReport(request, request.query));
});

app.get('/api/tutor/reports.xlsx', requireTutor, asyncRoute(async (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const report = tutorReport(request, request.query); const workbook = new ExcelJS.Workbook(); const summary = workbook.addWorksheet('Resumen');
  summary.addRow(['SIGA - Reporte de tutoría']); summary.addRow(['Tutor', request.account.name]); summary.addRow(['Estudiantes asignados', report.students.length]); summary.addRow(['Seguimientos registrados', report.followUps]); summary.addRow([]); summary.addRow(['Asistencia','Total']); report.byAttendance.forEach((item) => summary.addRow([item.state,item.total])); summary.addRow([]); summary.addRow(['Permanencia','Total']); report.byCaseState.forEach((item) => summary.addRow([item.state,item.total]));
  const detail = workbook.addWorksheet('Asistencia'); detail.addRow(['Fecha','Estudiante','Curso','Grupo','Estado']); report.attendance.forEach((item) => detail.addRow([item.date,item.student,item.course,item.group,item.state]));
  [summary,detail].forEach((sheet) => { sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC47A12'}}; sheet.columns.forEach((column) => { column.width=24; }); });
  response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.setHeader('Content-Disposition','attachment; filename="reporte-tutoria-siga.xlsx"'); await workbook.xlsx.write(response); response.end();
}));

app.get('/api/tutor/reports.pdf', requireTutor, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const report = tutorReport(request, request.query); response.setHeader('Content-Type','application/pdf'); response.setHeader('Content-Disposition','attachment; filename="reporte-tutoria-siga.pdf"'); const document=new PDFDocument({margin:48,size:'A4'}); document.pipe(response);
  document.fontSize(18).fillColor('#9A5A08').text('SIGA - Reporte de tutoría'); document.moveDown().fontSize(11).fillColor('#12213d').text(`Tutor: ${request.account.name}`).text(`Estudiantes asignados: ${report.students.length}`).text(`Seguimientos: ${report.followUps}`); document.moveDown().fontSize(13).text('Asistencia'); report.byAttendance.forEach((item)=>document.fontSize(10).text(`${item.state}: ${item.total}`)); document.moveDown().fontSize(13).text('Permanencia'); report.byCaseState.forEach((item)=>document.fontSize(10).text(`${item.state}: ${item.total}`)); document.moveDown().fontSize(13).text('Alertas'); document.fontSize(10).text(`Atendidas: ${report.alertSummary.reviewed}`).text(`Pendientes: ${report.alertSummary.pending}`); document.end();
});

app.get('/api/admin/password-recovery', requireAdmin, (request, response) => {
  const items = database.passwordRecoveryRequests
    .filter((item) => item.status === 'Pendiente')
    .map((item) => {
      const account = database.accounts.find((candidate) => candidate.id === item.accountId);
      return account ? { id: item.id, accountId: account.id, name: account.name, email: account.email, role: account.role, requestedAt: item.requestedAt } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  response.json({ items });
});

app.patch('/api/admin/password-recovery/:id', requireAdmin, requireCsrf, (request, response) => {
  const recovery = database.passwordRecoveryRequests.find((item) => item.id === request.params.id && item.status === 'Pendiente');
  if (!recovery) return response.status(404).json({ error: 'La solicitud ya no está pendiente.' });
  const account = database.accounts.find((item) => item.id === recovery.accountId && item.state === 'Activo');
  if (!account) return response.status(404).json({ error: 'La cuenta activa ya no está disponible.' });
  const password = String(request.body.password || '');
  if (!validPassword(password)) return response.status(400).json({ error: 'La nueva contraseña debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' });
  account.passwordHash = hashPassword(password);
  revokeSessions(account.id);
  recovery.status = 'Resuelta';
  recovery.resolvedAt = new Date().toISOString();
  recovery.resolvedBy = request.account.id;
  database.securityAudit.unshift({ id: `SEC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, action: 'Contraseña restablecida', accountId: account.id, userId: request.account.id, date: recovery.resolvedAt });
  saveDatabase();
  response.json({ message: 'Contraseña restablecida y sesiones anteriores revocadas.' });
});

app.get('/api/admin/dashboard', requireAdmin, (request, response) => {
  const activeAccountFor = (item) => {
    const account = linkedAccountForStaff(item);
    return item.state === 'Activo' && account?.state === 'Activo' ? account : null;
  };
  const count = (role) => database.staff.filter((item) => item.role === role && activeAccountFor(item)).length;
  const tutoringTeachers = database.staff.filter((item) => item.role === 'Docente' && accountRoles(activeAccountFor(item) || {}).includes('tutor')).length;
  response.json({ summary: { students: database.students.filter((item) => item.state === 'Activo').length, teachers: count('Docente'), coordinators: count('Coordinador'), tutors: tutoringTeachers, guards: count('Vigilante'), administrators: count('Administrador') }, attendance: attendanceReport(request.query) });
});

function programUsage(name) {
  return {
    students: database.students.filter((item) => item.program === name).length,
    staff: database.staff.filter((item) => item.program === name || (item.additionalPrograms || []).includes(name)).length,
    classes: database.classes.filter((item) => item.program === name).length,
    accounts: database.accounts.filter((item) => item.program === name || (item.additionalPrograms || []).includes(name)).length,
  };
}

function refreshPrograms() {
  programs = database.programs.filter((item) => item.state === 'Activo').map((item) => item.name);
}

function programPayload(item) {
  const usage = programUsage(item.name);
  return { ...item, usage, linkedRecords: Object.values(usage).reduce((sum, value) => sum + value, 0) };
}

app.get('/api/admin/programs', requireAdmin, (request, response) => {
  response.json({ items: database.programs.map(programPayload) });
});

app.post('/api/admin/programs', requireAdmin, requireCsrf, (request, response) => {
  const name = String(request.body.name || '').trim();
  if (name.length < 3 || name.length > 120) return response.status(400).json({ error: 'Ingrese un nombre de programa entre 3 y 120 caracteres.' });
  if (normalizedHeader(name) === 'empleabilidad') return response.status(400).json({ error: 'Empleabilidad es un ámbito docente transversal, no un programa de estudios.' });
  if (database.programs.some((item) => item.name.localeCompare(name, 'es', { sensitivity: 'accent' }) === 0)) return response.status(409).json({ error: 'El programa ya está registrado.' });
  const item = { id: `PRO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name, state: 'Activo' };
  database.programs.push(item);
  database.adminAudit.unshift({ id: `AAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity: 'program', entityId: item.id, action: 'Creación', detail: name, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
  refreshPrograms();
  saveDatabase();
  response.status(201).json({ item: programPayload(item), message: 'Programa registrado correctamente.' });
});

app.put('/api/admin/programs/:id', requireAdmin, requireCsrf, (request, response) => {
  const item = database.programs.find((record) => record.id === request.params.id);
  if (!item) return response.sendStatus(404);
  const name = String(request.body.name || '').trim();
  const state = String(request.body.state || 'Activo');
  if (name.length < 3 || name.length > 120 || !states.includes(state)) return response.status(400).json({ error: 'Ingrese un nombre y estado válidos.' });
  if (normalizedHeader(name) === 'empleabilidad') return response.status(400).json({ error: 'Empleabilidad es un ámbito docente transversal, no un programa de estudios.' });
  if (database.programs.some((record) => record.id !== item.id && record.name.localeCompare(name, 'es', { sensitivity: 'accent' }) === 0)) return response.status(409).json({ error: 'El programa ya está registrado.' });
  const usage = programUsage(item.name);
  if (state === 'Inactivo' && Object.values(usage).some(Boolean)) return response.status(409).json({ error: 'El programa tiene estudiantes, personal, cuentas o clases vinculadas. Manténgalo activo mientras conserve registros.' });
  const previousName = item.name;
  if (name !== previousName) {
    for (const collection of [database.students, database.staff, database.classes, database.accounts, database.permanenceIncidents]) {
      collection.forEach((record) => {
        if (record.program === previousName) record.program = name;
        if (Array.isArray(record.additionalPrograms)) record.additionalPrograms = record.additionalPrograms.map((program) => program === previousName ? name : program);
      });
    }
  }
  Object.assign(item, { name, state });
  database.adminAudit.unshift({ id: `AAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity: 'program', entityId: item.id, action: 'Actualización', detail: `${previousName} → ${name} · ${state}`, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
  refreshPrograms();
  saveDatabase();
  response.json({ item: programPayload(item), message: 'Programa actualizado y relaciones sincronizadas.' });
});

app.delete('/api/admin/programs/:id', requireAdmin, requireCsrf, (request, response) => {
  const index = database.programs.findIndex((record) => record.id === request.params.id);
  if (index < 0) return response.sendStatus(404);
  const item = database.programs[index];
  if (Object.values(programUsage(item.name)).some(Boolean)) return response.status(409).json({ error: 'No puede eliminar un programa con registros vinculados.' });
  database.programs.splice(index, 1);
  database.adminAudit.unshift({ id: `AAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity: 'program', entityId: item.id, action: 'Eliminación', detail: item.name, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
  refreshPrograms();
  saveDatabase();
  response.sendStatus(204);
});

app.get('/api/admin/students', requireAdmin, (request, response) => response.json({ items: filteredRecords(database.students, request.query), programs }));
const studentsReadOnly = (request, response) => response.status(403).json({ error: 'El Administrador solo puede visualizar y exportar estudiantes.' });
app.post('/api/admin/students', requireAdmin, requireCsrf, studentsReadOnly);
app.put('/api/admin/students/:id', requireAdmin, requireCsrf, studentsReadOnly);
app.patch('/api/admin/students/:id/state', requireAdmin, requireCsrf, studentsReadOnly);
app.delete('/api/admin/students/:id', requireAdmin, requireCsrf, studentsReadOnly);

function coordinatorProgram(request) {
  if (programs.includes(request.account.program)) return request.account.program;
  const record = database.staff.find((item) => item.accountId === request.account.id || item.email.toLowerCase() === request.account.email.toLowerCase());
  return programs.includes(record?.program) ? record.program : '';
}

function coordinatorAuditLog(request, entity, entityId, action, reason = '') {
  database.coordinatorAudit.unshift({ id: 'CAU-' + crypto.randomUUID().slice(0, 8), entity, entityId, action, reason, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
}

function coordinatorStudent(request, id) {
  const program = coordinatorProgram(request);
  return database.students.find((item) => item.id === id && item.program === program);
}

function coordinatorTutorStaff(request) {
  const program = coordinatorProgram(request);
  return database.staff.filter((item) => {
    if (item.program !== program) return false;
    const account = activeTutorAccountForStaff(item);
    return Boolean(account && account.program === program);
  });
}

function validCoordinatorTutor(request, tutorId) {
  return !tutorId || coordinatorTutorStaff(request).some((item) => item.id === tutorId);
}

function coordinatorClasses(request) {
  const program = coordinatorProgram(request);
  return database.classes.filter((item) => item.program === program);
}

function coordinatorAttendance(request, query = {}) {
  const classMap = new Map(coordinatorClasses(request).map((item) => [item.id, item]));
  const studentMap = new Map(database.students.filter((item) => item.program === coordinatorProgram(request)).map((item) => [item.id, item]));
  return database.teacherAttendance
    .filter((item) => classMap.has(item.classId) && classMap.get(item.classId).studentIds.includes(item.studentId) && studentMap.has(item.studentId))
    .filter((item) => !query.semester || classMap.get(item.classId).semester === query.semester)
    .filter((item) => !query.student || item.studentId === query.student)
    .filter((item) => !query.from || item.date >= query.from)
    .filter((item) => !query.to || item.date <= query.to)
    .filter((item) => !query.state || item.state === query.state)
    .map((item) => ({ ...item, course: classMap.get(item.classId).course, group: classMap.get(item.classId).group, semester: classMap.get(item.classId).semester, student: studentMap.get(item.studentId).name }));
}

function enrichedCoordinatorStudents(request, query = {}) {
  const program = coordinatorProgram(request);
  const classes = coordinatorClasses(request);
  const attendance = coordinatorAttendance(request);
  const search = String(query.search || '').trim().toLowerCase();
  return database.students.filter((item) => item.program === program)
    .map((student) => {
      const studentClasses = classes.filter((item) => item.studentIds.includes(student.id));
      const rows = attendance.filter((item) => item.studentId === student.id);
      const tutor = coordinatorTutorStaff(request).find((item) => item.id === student.tutorId);
      return { ...student, group: student.group || studentClasses[0]?.group || 'Sin grupo', tutor: tutor?.name || 'Sin tutor asignado', attendanceRate: attendanceSummary(rows).attendanceRate, attendanceRecords: rows.length };
    })
    .filter((item) => (!search || [item.name,item.document,item.email,item.group,item.tutor].some((value) => String(value).toLowerCase().includes(search))) && (!query.semester || item.semester === query.semester) && (!query.group || item.group === query.group) && (!query.state || item.state === query.state) && (!query.tutor || item.tutorId === query.tutor));
}

app.get('/api/coordinator/dashboard', requireCoordinator, (request, response) => {
  const program = coordinatorProgram(request);
  if (!program) return response.status(400).json({ error: 'La cuenta del Coordinador no tiene un programa asignado.' });
  const students = enrichedCoordinatorStudents(request);
  const todayRows = coordinatorAttendance(request, { from: limaDate(), to: limaDate() });
  const count = (state) => new Set(todayRows.filter((item) => item.state === state).map((item) => item.studentId)).size;
  const incidents = database.permanenceIncidents.filter((item) => item.program === program && item.status !== 'Cerrada');
  const pendingExits = coordinatorExitItems(request).filter((item) => item.status === 'Pendiente de coordinación').length;
  const pendingJustifications = database.tutorJustifications.filter((item) => database.students.some((student) => student.id === item.studentId && student.program === program) && ['En revisión','Derivada a Coordinación'].includes(item.status)).length;
  const securityIncidents = database.guardIncidents.filter((item) => item.status !== 'Cerrada' && database.students.some((student) => student.id === item.studentId && student.program === program)).length;
  response.json({ coordinator: publicAccount(request.account, request.session.csrf, request.session.role), program, summary: { students: students.filter((item) => item.state === 'Activo').length, present: count('Presente'), late: count('Tardanza'), absent: count('Ausente'), incidents: incidents.length, pendingExits, pendingJustifications, securityIncidents }, team: { teachers: coordinatorTeachers(request).length, tutors: coordinatorTutorStaff(request).length }, today: limaDate() });
});

app.get('/api/coordinator/team', requireCoordinator, (request, response) => {
  const program = coordinatorProgram(request);
  const items = database.staff.filter((item) => {
    const account = linkedAccountForStaff(item);
    const roles = accountRoles(account || item);
    const inProgram = item.program === program || (roles.includes('docente') && teacherPrograms(account || item).includes(program));
    return inProgram && (item.role === 'Docente' || roles.includes('docente') || roles.includes('tutor'));
  });
  response.json({ items: items.map((item) => ({ id: item.id, name: item.name, role: item.role, program: item.program, state: item.state })), program });
});

function coordinatorTeachers(request) {
  const program = coordinatorProgram(request);
  return database.accounts.filter((account) => account.state === 'Activo' && teacherPrograms(account).includes(program) && accountRoles(account).includes('docente')).map((account) => ({ id: account.id, name: account.name }));
}

function coordinatorClassItems(request, query = {}) {
  const teachers = new Map(coordinatorTeachers(request).map((item) => [item.id, item]));
  const students = new Map(database.students.filter((item) => item.program === coordinatorProgram(request)).map((item) => [item.id, item]));
  const search = String(query.search || '').trim().toLowerCase();
  return coordinatorClasses(request).map((item) => ({
    ...item,
    teacher: teachers.get(item.teacherId)?.name || 'Docente no disponible',
    students: item.studentIds.filter((id) => students.has(id)).map((id) => ({ id, name: students.get(id).name })),
  })).filter((item) => (!search || [item.course, item.group, item.section, item.teacher, item.room].some((value) => String(value || '').toLowerCase().includes(search))) && (!query.semester || item.semester === query.semester) && (!query.teacher || item.teacherId === query.teacher));
}

function normalizeAcademicGroup(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
}

function validateCoordinatorClass(request, body, existingId = '') {
  const program = coordinatorProgram(request);
  const existingClass = existingId ? coordinatorClasses(request).find((item) => item.id === existingId) : null;
  const course = String(body.course || '').trim();
  const group = String(body.group || '').trim();
  const section = String(body.section || '').trim();
  const semester = String(body.semester || '');
  const teacherId = String(body.teacherId || '');
  const studentIds = [...new Set(Array.isArray(body.studentIds) ? body.studentIds.map(String) : [])];
  const validTeacher = coordinatorTeachers(request).some((item) => item.id === teacherId);
  if (course.length < 3 || course.length > 120 || !group || group.length > 30 || !section || section.length > 20) return { error: 'Complete curso, grupo y sección con longitudes válidas.' };
  if (!['I','II','III','IV','V','VI'].includes(semester)) return { error: 'Seleccione un semestre válido.' };
  const officialUnits = unitsForProgramSemester(program, semester);
  const unchangedLegacyUnit = existingClass?.course === course && existingClass?.semester === semester;
  if (!officialUnits.includes(course) && !unchangedLegacyUnit) return { error: 'Seleccione una unidad didáctica oficial del programa y semestre.' };
  if (!validTeacher) return { error: 'Seleccione un Docente activo de su programa.' };

  const allowedStudents = new Set(database.students
    .filter((item) => item.program === program && item.state === 'Activo' && item.semester === semester && normalizeAcademicGroup(item.group) === normalizeAcademicGroup(group))
    .map((item) => item.id));
  if (studentIds.some((id) => !allowedStudents.has(id))) return { error: 'Cada estudiante debe estar activo y pertenecer al mismo programa, semestre y grupo de la clase.' };

  const duplicateOffering = coordinatorClasses(request).find((record) => record.id !== existingId
    && record.course === course
    && record.semester === semester
    && normalizeAcademicGroup(record.group) === normalizeAcademicGroup(group)
    && normalizeAcademicGroup(record.section) === normalizeAcademicGroup(section));
  if (duplicateOffering) return { error: 'La unidad ' + course + ' ya está registrada para ' + group + ', sección ' + section + '.', status: 409 };

  const scheduleWasSubmitted = ['day', 'schedule', 'room', 'modality'].some((key) => Object.hasOwn(body, key));
  let day = scheduleWasSubmitted ? String(body.day || '') : String(existingClass?.day || '');
  let schedule = scheduleWasSubmitted ? String(body.schedule || '').trim() : String(existingClass?.schedule || '');
  let room = scheduleWasSubmitted ? String(body.room || '').trim() : String(existingClass?.room || '');
  let modality = scheduleWasSubmitted ? String(body.modality || 'Presencial') : String(existingClass?.modality || '');
  if (!scheduleWasSubmitted && !existingClass) {
    day = '';
    schedule = '';
    room = '';
    modality = '';
  }
  if (!scheduleWasSubmitted && existingClass && (!day || !schedule || !room || !modality)) {
    day = '';
    schedule = '';
    room = '';
    modality = '';
  }
  const hasSchedule = Boolean(day || schedule || room || modality);
  if (!hasSchedule) return { values: { teacherId, course, group, section, semester, program, room: '', schedule: '', day: '', modality: '', studentIds } };
  if (!day || !schedule || !room || !modality || room.length > 80) return { error: 'Complete día, horario, aula o enlace y modalidad.' };
  if (!['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].includes(day) || !['Presencial','Virtual','Híbrida'].includes(modality)) return { error: 'Seleccione día y modalidad válidos.' };
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9][–-]([01][0-9]|2[0-3]):[0-5][0-9]$/.test(schedule)) return { error: 'Use un horario válido, por ejemplo 08:00–09:30.' };
  const normalizedSchedule = schedule.replace('-', '–');
  const [startTime, endTime] = normalizedSchedule.split('–');
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (endMinutes <= startMinutes) return { error: 'La hora de fin debe ser posterior a la hora de inicio.' };
  if (startMinutes < timeToMinutes(institutionStart) || endMinutes > timeToMinutes(institutionEnd)) return { error: 'El horario debe estar dentro de la jornada institucional de ' + institutionStart + ' a ' + institutionEnd + '.' };
  const overlaps = (record) => {
    if (record.id === existingId || record.day !== day || !/^([01]\d|2[0-3]):[0-5]\d[–-]([01]\d|2[0-3]):[0-5]\d$/.test(String(record.schedule || ''))) return false;
    const [recordStart, recordEnd] = String(record.schedule).replace('-', '–').split('–').map(timeToMinutes);
    return startMinutes < recordEnd && endMinutes > recordStart;
  };
  const teacherConflict = database.classes.find((record) => record.teacherId === teacherId && overlaps(record));
  if (teacherConflict) return { error: 'El Docente ya tiene la clase ' + teacherConflict.course + ' en ese horario.', status: 409 };
  const roomConflict = modality !== 'Virtual' && database.classes.find((record) => record.modality !== 'Virtual' && String(record.room || '').localeCompare(room, 'es', { sensitivity: 'accent' }) === 0 && overlaps(record));
  if (roomConflict) return { error: 'El ambiente ' + room + ' ya está ocupado por ' + roomConflict.course + ' en ese horario.', status: 409 };
  const studentConflict = database.classes.find((record) => record.studentIds.some((id) => studentIds.includes(id)) && overlaps(record));
  if (studentConflict) return { error: 'Uno o más estudiantes ya tienen la clase ' + studentConflict.course + ' en ese horario.', status: 409 };
  return { values: { teacherId, course, group, section, semester, program, room, schedule: normalizedSchedule, day, modality, studentIds } };
}
app.get('/api/coordinator/classes', requireCoordinator, (request, response) => {
  response.json({ items: coordinatorClassItems(request, request.query), teachers: coordinatorTeachers(request), students: enrichedCoordinatorStudents(request).filter((item) => item.state === 'Activo').map((item) => ({ id: item.id, name: item.name, semester: item.semester, group: item.group })), program: coordinatorProgram(request), policies: { institutionStart, institutionEnd } });
});

app.get('/api/coordinator/study-plan', requireCoordinator, (request, response) => {
  const program = coordinatorProgram(request);
  response.json({ program, semesters: planForProgram(program) });
});

app.post('/api/coordinator/classes', requireCoordinator, requireCsrf, (request, response) => {
  const validation = validateCoordinatorClass(request, request.body);
  if (validation.error) return response.status(validation.status || 400).json({ error: validation.error });
  const item = { id: `CLS-${String(database.nextIds.class++).padStart(3, '0')}`, ...validation.values };
  database.classes.push(item);
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'class', entityId: item.id, action: 'Creada', reason: item.course, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
  saveDatabase(); response.status(201).json({ item, message: 'Clase creada y asignaciones guardadas.' });
});

app.put('/api/coordinator/classes/:id', requireCoordinator, requireCsrf, (request, response) => {
  const item = coordinatorClasses(request).find((record) => record.id === request.params.id);
  if (!item) return response.status(404).json({ error: 'La clase no pertenece a su programa.' });
  const validation = validateCoordinatorClass(request, request.body, item.id);
  if (validation.error) return response.status(validation.status || 400).json({ error: validation.error });
  const hasHistory = database.teacherAttendance.some((record) => record.classId === item.id) || database.exitRequests.some((record) => record.classId === item.id);
  const sameStudentIds = item.studentIds.length === validation.values.studentIds.length && item.studentIds.every((id) => validation.values.studentIds.includes(id));
  const academicIdentityChanged = item.teacherId !== validation.values.teacherId || item.course !== validation.values.course || item.semester !== validation.values.semester || normalizeAcademicGroup(item.group) !== normalizeAcademicGroup(validation.values.group) || normalizeAcademicGroup(item.section) !== normalizeAcademicGroup(validation.values.section) || !sameStudentIds;
  if (hasHistory && academicIdentityChanged) return response.status(409).json({ error: 'La clase tiene historial. Puede actualizar su horario, pero no cambiar curso, Docente, cohorte ni matrículas.' });
  Object.assign(item, validation.values);
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'class', entityId: item.id, action: 'Actualizada', reason: `${item.course} · ${item.studentIds.length} estudiantes`, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
  saveDatabase(); response.json({ item, message: 'Clase y matrícula actualizadas.' });
});

app.delete('/api/coordinator/classes/:id', requireCoordinator, requireCsrf, (request, response) => {
  const item = coordinatorClasses(request).find((record) => record.id === request.params.id);
  if (!item) return response.status(404).json({ error: 'La clase no pertenece a su programa.' });
  if (database.teacherAttendance.some((record) => record.classId === item.id) || database.exitRequests.some((record) => record.classId === item.id)) return response.status(409).json({ error: 'La clase tiene asistencia o solicitudes relacionadas. Retire sus estudiantes o conserve el historial.' });
  database.classes = database.classes.filter((record) => record.id !== item.id);
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'class', entityId: item.id, action: 'Eliminada', reason: item.course, userId: request.account.id, userName: request.account.name, date: new Date().toISOString() });
  saveDatabase(); response.sendStatus(204);
});

app.get('/api/coordinator/students', requireCoordinator, (request, response) => {
  const program = coordinatorProgram(request);
  if (!program) return response.status(400).json({ error: 'La cuenta del Coordinador no tiene un programa asignado.' });
  const items = enrichedCoordinatorStudents(request, request.query);
  const groups = [...new Set(enrichedCoordinatorStudents(request).map((item) => item.group))].sort();
  const tutors = coordinatorTutorStaff(request).map((item) => ({ id: item.id, name: item.name }));
  response.json({ items, programs: [program], groups, tutors, program });
});

app.get('/api/coordinator/students.xlsx', requireCoordinator, asyncRoute(async (request, response) => {
  const program = coordinatorProgram(request);
  if (!program) return response.status(400).json({ error: 'La cuenta del Coordinador no tiene un programa asignado.' });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Estudiantes');
  sheet.addRow(['Código','Tipo de documento','Documento','Nombres','Correo','Semestre','Grupo','Programa','Tutor','Estado']);
  filteredRecords(database.students, { ...request.query, program }).forEach((item) => {
    const tutor = coordinatorTutorStaff(request).find((staff) => staff.id === item.tutorId);
    sheet.addRow([item.id,item.documentType || 'DNI',item.document,item.name,item.email,item.semester,item.group || '',item.program,tutor?.name || '',item.state]);
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B7A' } };
  sheet.columns.forEach((column) => { column.width = 24; });
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename="estudiantes-programa-siga.xlsx"');
  await workbook.xlsx.write(response); response.end();
}));

app.get('/api/coordinator/students/template', requireCoordinator, asyncRoute(async (request, response) => {
  const program = coordinatorProgram(request);
  if (!program) return response.status(400).json({ error: 'La cuenta del Coordinador no tiene un programa asignado.' });
  return sendTemplate(response, 'students', [program]);
}));

app.post('/api/coordinator/students/import', requireCoordinator, requireCsrf, excelUpload.single('file'), asyncRoute(async (request, response) => {
  const program = coordinatorProgram(request);
  if (!program) return response.status(400).json({ error: 'La cuenta del Coordinador no tiene un programa asignado.' });
  const fileError = validateExcelFile(request.file);
  if (fileError) return response.status(400).json({ error: fileError });
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(request.file.buffer); }
  catch { return response.status(400).json({ error: 'No fue posible leer el archivo Excel. Descargue nuevamente la plantilla oficial.' }); }
  const sheet = workbook.worksheets[0];
  if (!sheet) return response.status(400).json({ error: 'El archivo no contiene una hoja de datos.' });
  const sizeError = validateWorksheetSize(sheet);
  if (sizeError) return response.status(413).json({ error: sizeError });
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    const values = row.values.map(normalizedHeader);
    if (!headerRow && values.includes('nombres') && values.includes('documento')) headerRow = rowNumber;
  });
  if (!headerRow) return response.status(400).json({ error: 'La plantilla no contiene los encabezados esperados.' });
  const headers = importHeaderMap(sheet.getRow(headerRow));
  const requiredHeaders = ['tipo de documento','documento','nombres','correo','semestre','grupo','programa','estado','contrasena inicial'];
  const missingHeaders = requiredHeaders.filter((name) => !headers.has(name));
  if (missingHeaders.length) return response.status(400).json({ error: `Faltan columnas obligatorias: ${missingHeaders.join(', ')}.` });
  const errors = [];
  const accepted = [];
  const seenEmails = new Set();
  const seenDocuments = new Set();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow || emptyStudentImportRow(row, headers, program)) return;
    const item = {
      documentType: valueFromHeaders(row, headers, 'tipo de documento', 'tipo documento'),
      document: valueFromHeaders(row, headers, 'documento'),
      name: valueFromHeaders(row, headers, 'nombres'),
      email: valueFromHeaders(row, headers, 'correo').toLowerCase(),
      semester: valueFromHeaders(row, headers, 'semestre').toUpperCase(),
      group: valueFromHeaders(row, headers, 'grupo'),
      program: valueFromHeaders(row, headers, 'programa'),
      state: valueFromHeaders(row, headers, 'estado'),
      password: valueFromHeaders(row, headers, 'contraseña inicial', 'contrasena inicial'),
    };
    const validation = validatePerson(item, 'student');
    const semesterError = !['I','II','III','IV','V','VI'].includes(item.semester) ? 'Seleccione un semestre válido.' : '';
    const groupError = !item.group || item.group.length > 30 ? 'Complete un grupo válido de hasta 30 caracteres.' : '';
    const programError = item.program !== program ? `Solo puede importar estudiantes de ${program}.` : '';
    const passwordError = !validPassword(item.password) ? 'La contraseña inicial debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' : '';
    const duplicate = seenEmails.has(item.email) || seenDocuments.has(item.document) || database.students.some((existing) => existing.email.toLowerCase() === item.email || existing.document === item.document) || database.accounts.some((account) => account.email.toLowerCase() === item.email);
    if (validation || semesterError || groupError || programError || passwordError || duplicate) errors.push({ row: rowNumber, message: duplicate ? 'Documento o correo duplicado.' : validation || semesterError || groupError || programError || passwordError });
    else { item.group = item.group.trim(); seenEmails.add(item.email); seenDocuments.add(item.document); accepted.push(item); }
  });
  if (errors.length) return response.status(422).json({ error: 'Se encontraron filas con errores.', errors, validRows: accepted.length });
  if (!accepted.length) return response.status(400).json({ error: 'La plantilla no contiene estudiantes para importar.' });
  accepted.forEach((item) => {
    item.id = `EST-${String(database.nextIds.student++).padStart(3, '0')}`;
    const password = item.password;
    delete item.password;
    database.students.push(item);
    database.accounts.push(accountFromStudent(item, password));
    coordinatorAuditLog(request, 'student', item.id, 'Importado', item.name);
  });
  saveDatabase(); response.json({ message: `${accepted.length} estudiantes importados correctamente.`, imported: accepted.length, errors: [] });
}));

app.post('/api/coordinator/students', requireCoordinator, requireCsrf, (request, response) => {
  const program = coordinatorProgram(request);
  const values = { ...request.body, program };
  const error = validatePerson(values, 'student');
  if (error) return response.status(400).json({ error });
  if (!['I','II','III','IV','V','VI'].includes(values.semester)) return response.status(400).json({ error: 'Seleccione un semestre válido.' });
  if (!String(values.group || '').trim() || String(values.group).length > 30) return response.status(400).json({ error: 'Complete un grupo válido de hasta 30 caracteres.' });
  if (!validCoordinatorTutor(request, values.tutorId)) return response.status(400).json({ error: 'Seleccione un tutor activo de su programa.' });
  if (!validPassword(values.password)) return response.status(400).json({ error: 'La contraseña inicial debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' });
  if (database.students.some((item) => item.email.toLowerCase() === values.email.toLowerCase() || item.document === values.document) || database.accounts.some((account) => account.email.toLowerCase() === values.email.toLowerCase())) return response.status(409).json({ error: 'El documento o correo ya está registrado.' });
  const { password, ...studentValues } = values;
  const item = { id: `EST-${String(database.nextIds.student++).padStart(3, '0')}`, tutorId: '', ...studentValues, group: String(studentValues.group).trim() };
  database.students.push(item);
  database.accounts.push(accountFromStudent(item, password));
  coordinatorAuditLog(request, 'student', item.id, 'Creado', item.name);
  saveDatabase(); response.status(201).json({ item, message: 'Estudiante y cuenta de acceso registrados correctamente.' });
});

app.put('/api/coordinator/students/:id', requireCoordinator, requireCsrf, (request, response) => {
  const item = coordinatorStudent(request, request.params.id);
  if (!item) return response.sendStatus(404);
  const values = { ...request.body, program: coordinatorProgram(request) };
  if (String(values.password || '').trim()) return response.status(403).json({ error: 'La contraseña no se modifica desde el padrón. Use el flujo administrado de recuperación.' });
  const error = validatePerson(values, 'student');
  if (error) return response.status(400).json({ error });
  if (!['I','II','III','IV','V','VI'].includes(values.semester)) return response.status(400).json({ error: 'Seleccione un semestre válido.' });
  if (!String(values.group || '').trim() || String(values.group).length > 30) return response.status(400).json({ error: 'Complete un grupo válido de hasta 30 caracteres.' });
  if (!validCoordinatorTutor(request, values.tutorId)) return response.status(400).json({ error: 'Seleccione un tutor activo de su programa.' });
  if (values.state !== item.state) return response.status(403).json({ error: 'Use la acción Activar o Desactivar para cambiar el estado y sincronizar el acceso.' });
  const incompatibleClass = coordinatorClasses(request).find((course) => course.studentIds.includes(item.id)
    && (course.semester !== values.semester || normalizeAcademicGroup(course.group) !== normalizeAcademicGroup(values.group)));
  if (incompatibleClass) return response.status(409).json({ error: 'Retire al estudiante de ' + incompatibleClass.course + ' antes de cambiar su semestre o grupo.' });
  const linkedAccount = linkedAccountForStudent(item);
  if (!linkedAccount) return response.status(409).json({ error: 'El estudiante no tiene una cuenta vinculada. Administración debe regularizar su acceso.' });
  const duplicate = database.students.some((student) => student.id !== item.id && (student.email.toLowerCase() === values.email.toLowerCase() || student.document === values.document));
  const accountDuplicate = database.accounts.some((account) => account.id !== linkedAccount?.id && account.email.toLowerCase() === values.email.toLowerCase());
  if (duplicate || accountDuplicate) return response.status(409).json({ error: 'El documento o correo ya está registrado.' });
  const { password: ignoredPassword, ...studentValues } = values;
  Object.assign(item, studentValues, { group: String(studentValues.group).trim() });
  Object.assign(linkedAccount, { studentId: item.id, name: item.name, email: item.email, documentType: item.documentType, document: item.document, program: item.program, state: item.state });
  coordinatorAuditLog(request, 'student', item.id, 'Actualizado', item.name);
  saveDatabase(); response.json({ item, message: 'Estudiante y cuenta actualizados correctamente.' });
});

app.patch('/api/coordinator/students/:id/state', requireCoordinator, requireCsrf, (request, response) => {
  const item = coordinatorStudent(request, request.params.id);
  if (!item || !states.includes(request.body.state)) return response.status(400).json({ error: 'Estudiante o estado no válido.' });
  if (item.state === request.body.state) return response.status(409).json({ error: 'El estudiante ya tiene el estado seleccionado.' });
  const linkedAccount = linkedAccountForStudent(item);
  if (!linkedAccount) return response.status(409).json({ error: 'El estudiante no tiene una cuenta vinculada. Administración debe regularizar su acceso.' });
  item.state = request.body.state;
  linkedAccount.state = item.state;
  if (item.state === 'Inactivo') revokeSessions(linkedAccount.id);
  coordinatorAuditLog(request, 'student', item.id, item.state, item.name);
  saveDatabase(); response.json({ item, message: `Estudiante ${item.state.toLowerCase()} y acceso sincronizado.` });
});

app.delete('/api/coordinator/students/:id', requireCoordinator, requireCsrf, (request, response) => {
  const item = coordinatorStudent(request, request.params.id);
  if (!item) return response.sendStatus(404);
  const usedInClass = database.classes.some((course) => course.studentIds.includes(item.id));
  const usedInAttendance = database.teacherAttendance.some((record) => record.studentId === item.id);
  const usedInExit = database.exitRequests.some((record) => record.studentId === item.id);
  if (usedInClass || usedInAttendance || usedInExit) return response.status(409).json({ error: 'El estudiante tiene clases, asistencias o solicitudes relacionadas. Desactívelo para conservar el historial.' });
  const linkedAccount = linkedAccountForStudent(item);
  coordinatorAuditLog(request, 'student', item.id, 'Eliminado', item.name);
  database.students = database.students.filter((student) => student.id !== item.id);
  if (linkedAccount) { database.accounts = database.accounts.filter((account) => account.id !== linkedAccount.id); revokeSessions(linkedAccount.id); }
  saveDatabase(); response.sendStatus(204);
});

const incidentTypes = ['Asistencia', 'Académica', 'Conducta', 'Salud', 'Económica', 'Familiar', 'Otra'];
const incidentStates = ['Abierta', 'Atendida', 'Cerrada'];

function coordinatorIncidents(request, query = {}) {
  const program = coordinatorProgram(request);
  const search = String(query.search || '').trim().toLowerCase();
  return database.permanenceIncidents.filter((item) => item.program === program)
    .map((item) => ({ ...item, student: database.students.find((student) => student.id === item.studentId)?.name || item.studentId, history: database.coordinatorAudit.filter((audit) => audit.entity === 'incident' && audit.entityId === item.id).sort((a, b) => b.date.localeCompare(a.date)) }))
    .filter((item) => (!search || [item.id,item.student,item.type,item.description,item.responsible].some((value) => String(value).toLowerCase().includes(search))) && (!query.student || item.studentId === query.student) && (!query.type || item.type === query.type) && (!query.state || item.status === query.state) && (!query.from || item.date >= query.from) && (!query.to || item.date <= query.to));
}

function validateIncident(request, body, status = 'Abierta') {
  const student = coordinatorStudent(request, String(body.studentId || ''));
  const date = String(body.date || '');
  const type = String(body.type || '');
  const description = String(body.description || '').trim();
  const responsible = String(body.responsible || '').trim();
  const evidence = String(body.evidence || '').trim();
  if (!student) return { error: 'Seleccione un estudiante de su programa.' };
  if (!validIsoDate(date) || date > limaDate() || !incidentTypes.includes(type) || !incidentStates.includes(status)) return { error: 'Seleccione una fecha no futura y un tipo válido.' };
  if (!description || description.length > 600 || !responsible || responsible.length > 120 || evidence.length > 300) return { error: 'Complete descripción y responsable sin superar la longitud permitida.' };
  return { values: { studentId: student.id, program: coordinatorProgram(request), date, type, description, responsible, evidence, status } };
}

app.get('/api/coordinator/permanence', requireCoordinator, (request, response) => {
  response.json({ items: coordinatorIncidents(request, request.query), students: enrichedCoordinatorStudents(request).map((item) => ({ id: item.id, name: item.name })), types: incidentTypes, states: incidentStates, program: coordinatorProgram(request) });
});

app.post('/api/coordinator/permanence', requireCoordinator, requireCsrf, (request, response) => {
  const validation = validateIncident(request, request.body, 'Abierta');
  if (validation.error) return response.status(400).json({ error: validation.error });
  const now = new Date().toISOString();
  const item = { id: `INC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, ...validation.values, createdBy: request.account.id, createdAt: now, updatedAt: now };
  database.permanenceIncidents.unshift(item);
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'incident', entityId: item.id, action: 'Creada', reason: item.description, userId: request.account.id, userName: request.account.name, date: now });
  saveDatabase(); response.status(201).json({ item, message: 'Incidencia registrada con historial de auditoría.' });
});

app.put('/api/coordinator/permanence/:id', requireCoordinator, requireCsrf, (request, response) => {
  const item = database.permanenceIncidents.find((record) => record.id === request.params.id && record.program === coordinatorProgram(request));
  if (!item) return response.status(404).json({ error: 'Incidencia no encontrada en su programa.' });
  if (item.status === 'Cerrada') return response.status(409).json({ error: 'Una incidencia cerrada conserva su información final.' });
  const validation = validateIncident(request, request.body, item.status);
  if (validation.error) return response.status(400).json({ error: validation.error });
  Object.assign(item, validation.values, { updatedAt: new Date().toISOString() });
  database.coordinatorAudit.unshift({ id: 'CAU-' + crypto.randomUUID().slice(0, 8), entity: 'incident', entityId: item.id, action: 'Actualizada', reason: 'Datos descriptivos actualizados', userId: request.account.id, userName: request.account.name, date: item.updatedAt });
  saveDatabase(); response.json({ item, message: 'Incidencia actualizada y cambio auditado.' });
});
app.patch('/api/coordinator/permanence/:id/state', requireCoordinator, requireCsrf, (request, response) => {
  const item = database.permanenceIncidents.find((record) => record.id === request.params.id && record.program === coordinatorProgram(request));
  const nextState = String(request.body.state || '');
  const note = String(request.body.note || '').trim();
  if (!item || !incidentStates.includes(nextState)) return response.status(400).json({ error: 'Incidencia o estado no válido.' });
  if (item.status === 'Cerrada') return response.status(409).json({ error: 'Una incidencia cerrada conserva su estado final.' });
  if (nextState === item.status) return response.status(409).json({ error: 'La incidencia ya tiene el estado seleccionado.' });
  if (nextState === 'Cerrada' && note.length < 3) return response.status(400).json({ error: 'Registre una conclusión antes de cerrar la incidencia.' });
  const previous = item.status;
  item.status = nextState;
  item.updatedAt = new Date().toISOString();
  database.coordinatorAudit.unshift({ id: `CAU-${crypto.randomUUID().slice(0, 8)}`, entity: 'incident', entityId: item.id, action: `${previous} → ${nextState}`, reason: note, userId: request.account.id, userName: request.account.name, date: item.updatedAt });
  saveDatabase(); response.json({ item, message: `Incidencia marcada como ${nextState.toLowerCase()}.` });
});

function coordinatorReportQueryError(request) {
  const query = request.query || {};
  if (query.from && !validIsoDate(query.from)) return 'La fecha inicial no es válida.';
  if (query.to && !validIsoDate(query.to)) return 'La fecha final no es válida.';
  if (invalidReportRange(query)) return 'La fecha inicial no puede ser posterior a la fecha final.';
  if (query.semester && !['I','II','III','IV','V','VI'].includes(query.semester)) return 'El semestre seleccionado no es válido.';
  if (query.student && !coordinatorStudent(request, query.student)) return 'El estudiante seleccionado no pertenece al programa.';
  if (query.state && !attendanceStates.includes(query.state)) return 'El estado de asistencia seleccionado no es válido.';
  if (query.incidentState && !incidentStates.includes(query.incidentState)) return 'El estado de permanencia seleccionado no es válido.';
  return '';
}

function coordinatorReport(request) {
  const query = request.query || {};
  const scopedStudents = enrichedCoordinatorStudents(request).filter((item) => (!query.semester || item.semester === query.semester) && (!query.student || item.id === query.student));
  const scopedStudentIds = new Set(scopedStudents.map((item) => item.id));
  const attendance = coordinatorAttendance(request, query);
  const byState = attendanceStates.map((state) => ({ state, total: attendance.filter((item) => item.state === state).length }));
  const exits = coordinatorExitItems(request).filter((item) => scopedStudentIds.has(item.studentId) && (!query.from || item.date >= query.from) && (!query.to || item.date <= query.to));
  const exitStates = ['Pendiente de coordinación','Autorizada','Rechazada'].map((state) => ({ state, total: exits.filter((item) => item.status === state).length }));
  const incidents = coordinatorIncidents(request, { ...query, state: query.incidentState || '' }).filter((item) => scopedStudentIds.has(item.studentId));
  const incidentByState = incidentStates.map((state) => ({ state, total: incidents.filter((item) => item.status === state).length }));
  const bySemester = [...new Set(scopedStudents.map((item) => item.semester))].sort().map((semester) => ({ semester, total: attendance.filter((item) => item.semester === semester).length }));
  return { program: coordinatorProgram(request), attendance, byState, exits, exitStates, incidents, incidentByState, bySemester, students: scopedStudents };
}

app.get('/api/coordinator/reports', requireCoordinator, (request, response) => {
  const queryError = coordinatorReportQueryError(request);
  if (queryError) return response.status(400).json({ error: queryError });
  response.json(coordinatorReport(request));
});

app.get('/api/coordinator/reports.xlsx', requireCoordinator, asyncRoute(async (request, response) => {
  const queryError = coordinatorReportQueryError(request);
  if (queryError) return response.status(400).json({ error: queryError });
  const report = coordinatorReport(request);
  const workbook = new ExcelJS.Workbook();
  const attendanceSheet = workbook.addWorksheet('Asistencia');
  attendanceSheet.addRow(['Fecha','Estudiante','Curso','Grupo','Semestre','Estado']);
  report.attendance.forEach((item) => attendanceSheet.addRow([item.date,item.student,item.course,item.group,item.semester,item.state]));
  const permissionsSheet = workbook.addWorksheet('Permisos');
  permissionsSheet.addRow(['Código','Fecha','Hora','Estudiante','Curso','Grupo','Estado','Motivo','Decisión']);
  report.exits.forEach((item) => permissionsSheet.addRow([item.id,item.date,item.time,item.student,item.course,item.group,item.status,item.reason,item.decisionReason || '']));
  const permanenceSheet = workbook.addWorksheet('Permanencia');
  permanenceSheet.addRow(['Código','Fecha','Estudiante','Tipo','Responsable','Estado','Descripción','Evidencia']);
  report.incidents.forEach((item) => permanenceSheet.addRow([item.id,item.date,item.student,item.type,item.responsible,item.status,item.description,item.evidence]));
  [attendanceSheet,permissionsSheet,permanenceSheet].forEach((sheet) => { sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6844C6' } }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address }; sheet.columns.forEach((column) => { column.width = 24; }); });
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename="reporte-coordinacion-siga.xlsx"');
  await workbook.xlsx.write(response); response.end();
}));

app.get('/api/coordinator/reports.pdf', requireCoordinator, (request, response) => {
  const queryError = coordinatorReportQueryError(request);
  if (queryError) return response.status(400).json({ error: queryError });
  const report = coordinatorReport(request);
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="reporte-coordinacion-siga.pdf"');
  const document = new PDFDocument({ margin: 46, size: 'A4' });
  document.pipe(response);
  document.fontSize(18).fillColor('#5233a5').text('SIGA - Reporte de Coordinación');
  document.moveDown().fontSize(11).fillColor('#12213d').text('Programa: ' + report.program).text('Asistencias analizadas: ' + report.attendance.length).text('Incidencias: ' + report.incidents.length).text('Solicitudes de salida: ' + report.exits.length);
  document.moveDown().fontSize(13).text('Asistencia por estado'); report.byState.forEach((item) => document.fontSize(10).text(item.state + ': ' + item.total));
  document.moveDown().fontSize(13).text('Permanencia'); report.incidentByState.forEach((item) => document.fontSize(10).text(item.state + ': ' + item.total));
  document.moveDown().fontSize(13).text('Permisos'); report.exitStates.forEach((item) => document.fontSize(10).text(item.state + ': ' + item.total));
  document.end();
});
app.get('/api/admin/staff', requireAdmin, (request, response) => {
  const source = request.query.scope === 'personnel' ? database.staff.filter((item) => item.role !== 'Vigilante') : database.staff;
  response.json({ items: filteredRecords(source, request.query).map((item) => {
    const account = linkedAccountForStaff(item);
    return {
      ...item,
      roles: accountRoles(account || {}).filter((role) => ['docente','coordinador','tutor'].includes(role)),
      hasAccess: Boolean(account && account.state === 'Activo' && item.state === 'Activo'),
      accessState: !account ? 'Sin cuenta' : account.state,
      isCurrentAccount: account?.id === request.account.id,
    };
  }), programs });
});
app.post('/api/admin/staff', requireAdmin, requireCsrf, (request, response) => {
  if (request.body.role === 'Vigilante') {
    request.body.pointOfControl = String(request.body.pointOfControl || 'Puerta principal').trim();
  }
  const error = validatePerson(request.body, 'staff');
  if (error) return response.status(400).json({ error });
  if (!validPassword(request.body.password)) return response.status(400).json({ error: 'La contraseña inicial debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' });
  const email = String(request.body.email || '').toLowerCase();
  const username = String(request.body.username || '').toLowerCase();
  const duplicate = database.staff.some((item) => item.email.toLowerCase() === email || normalizeDocument(item.document) === request.body.document)
    || database.accounts.some((account) => account.email.toLowerCase() === email)
    || accountDocumentConflict(request.body.document)
    || Boolean(username && database.accounts.some((account) => String(account.username || '').toLowerCase() === username));
  if (duplicate) return response.status(409).json({ error: 'El documento, correo o usuario ya está registrado.' });
  const { password, ...values } = request.body;
  const item = { id: `PER-${String(database.nextIds.staff++).padStart(3, '0')}`, shift: '', pointOfControl: '', ...values, roles: allowedAcademicRoles(request.body, values.role) };
  const account = accountFromStaff(item, password);
  item.accountId = account.id;
  database.staff.push(item);
  database.accounts.push(account);
  adminAuditLog(request, 'staff', item.id, 'Creación', `${item.name} · ${item.role}`);
  saveDatabase(); response.status(201).json({ item: { ...item, hasAccess: item.state === 'Activo', accessState: item.state }, message: 'Cuenta institucional creada correctamente.' });
});
app.put('/api/admin/staff/:id', requireAdmin, requireCsrf, (request, response) => {
  const item = database.staff.find((staff) => staff.id === request.params.id);
  if (!item) return response.sendStatus(404);
  if (request.body.role === 'Vigilante') {
    request.body.pointOfControl = String(request.body.pointOfControl || item.pointOfControl || 'Puerta principal').trim();
  }
  if (request.body.additionalPrograms === undefined) request.body.additionalPrograms = item.additionalPrograms || [];
  const error = validatePerson(request.body, 'staff');
  if (error) return response.status(400).json({ error });
  if (request.body.password && !validPassword(request.body.password)) return response.status(400).json({ error: 'La nueva contraseña debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' });
  const linkedAccount = linkedAccountForStaff(item);
  const email = String(request.body.email || '').toLowerCase();
  const username = String(request.body.username || '').toLowerCase();
  const duplicate = database.staff.some((staff) => staff.id !== item.id && (staff.email.toLowerCase() === email || normalizeDocument(staff.document) === request.body.document));
  const accountDuplicate = database.accounts.some((account) => account.id !== linkedAccount?.id && (
    account.email.toLowerCase() === email
    || normalizeDocument(account.document) === request.body.document
    || Boolean(username && String(account.username || '').toLowerCase() === username)
  ));
  if (duplicate || accountDuplicate || accountDocumentConflict(request.body.document, linkedAccount?.id)) return response.status(409).json({ error: 'El documento, correo o usuario ya está registrado.' });
  const { password, ...values } = request.body;
  if (!linkedAccount && !password) return response.status(400).json({ error: 'Este registro antiguo no tiene una cuenta vinculada. Ingrese una contraseña para crearla.' });
  const removesAdministrativeAccess = linkedAccount && accountRoles(linkedAccount).includes('administrador') && linkedAccount.state === 'Activo' && (values.role !== 'Administrador' || values.state !== 'Activo');
  if (removesAdministrativeAccess && linkedAccount.id === request.account.id) return response.status(400).json({ error: 'No puede retirar su propio acceso administrativo.' });
  if (removesAdministrativeAccess && activeAdministratorCount(linkedAccount.id) === 0) return response.status(400).json({ error: 'Debe permanecer al menos un Administrador activo.' });
  const nextRole = roleKeys[values.role];
  const selectedRoles = allowedAcademicRoles(request.body, values.role);
  const currentRoles = accountRoles(linkedAccount || item);
  const dependencies = staffDependencies(linkedAccount?.id, item.id);
  if (currentRoles.includes('tutor') && dependencies.tutorAssignments && (!selectedRoles.includes('tutor') || values.state !== 'Activo' || values.program !== item.program)) {
    return response.status(409).json({ error: `Este Docente tiene ${dependencies.tutorAssignments} estudiante(s) asignado(s) en Tutoría. Reasígnelos antes de retirar la función, cambiar el programa o desactivar la cuenta.` });
  }
  if (currentRoles.includes('docente') && !selectedRoles.includes('docente') && dependencies.total) return response.status(409).json({ error: 'La cuenta tiene clases, tutorados o historial docente relacionado. Mantenga la capacidad Docente o desactive la cuenta si corresponde.' });
  const nextPrograms = teacherPrograms(values);
  const incompatibleClass = linkedAccount && database.classes.find((course) => course.teacherId === linkedAccount.id && !nextPrograms.includes(course.program));
  if (incompatibleClass) return response.status(409).json({ error: 'El docente tiene clases asignadas en un programa que intenta retirar. Reasígnelas primero.' });
  Object.assign(item, values, { roles: selectedRoles });
  if (linkedAccount) {
    const scopeChanged = linkedAccount.role !== nextRole || linkedAccount.program !== (item.program === 'Institucional' ? '' : item.program) || JSON.stringify(linkedAccount.additionalPrograms || []) !== JSON.stringify(item.additionalPrograms || []) || JSON.stringify(accountRoles(linkedAccount).sort()) !== JSON.stringify([...selectedRoles].sort());
    Object.assign(linkedAccount, {
      name: item.name,
      email: item.email,
      documentType: item.documentType,
      document: item.document,
      program: item.program === 'Institucional' ? '' : item.program,
      additionalPrograms: item.role === 'Docente' ? item.additionalPrograms || [] : [],
      shift: item.role === 'Vigilante' ? item.shift || '' : '',
      pointOfControl: item.role === 'Vigilante' ? item.pointOfControl || 'Puerta principal' : '',
      role: nextRole,
      roles: selectedRoles,
      state: item.state,
    });
    if (password) linkedAccount.passwordHash = hashPassword(password);
    if (password || scopeChanged) {
      revokeSessions(linkedAccount.id);
      if (linkedAccount.id === request.account.id) createSession(response, linkedAccount, request, request.session.role);
    }
    item.accountId = linkedAccount.id;
  } else if (password) {
    const account = accountFromStaff(item, password);
    item.accountId = account.id;
    database.accounts.push(account);
  }
  adminAuditLog(request, 'staff', item.id, 'Actualización', `${item.name} · ${item.role} · ${item.state}`);
  const account = linkedAccountForStaff(item);
  saveDatabase(); response.json({ item: { ...item, hasAccess: Boolean(account && account.state === 'Activo' && item.state === 'Activo'), accessState: account?.state || 'Sin cuenta' }, message: 'Cuenta actualizada.' });
});
app.patch('/api/admin/staff/:id/state', requireAdmin, requireCsrf, (request, response) => {
  const item = database.staff.find((staff) => staff.id === request.params.id);
  if (!item || !states.includes(request.body.state)) return response.status(400).json({ error: 'Registro o estado no válido.' });
  const linkedAccount = linkedAccountForStaff(item);
  if (request.body.state === 'Activo' && !linkedAccount) return response.status(409).json({ error: 'Edite el registro y defina una contraseña antes de activar la cuenta.' });
  const dependencies = staffDependencies(linkedAccount?.id, item.id);
  if (request.body.state !== 'Activo' && dependencies.tutorAssignments) return response.status(409).json({ error: `Este Docente tiene ${dependencies.tutorAssignments} estudiante(s) asignado(s) en Tutoría. Reasígnelos antes de desactivar la cuenta.` });
  if (linkedAccount && accountRoles(linkedAccount).includes('administrador') && linkedAccount.state === 'Activo' && request.body.state !== 'Activo') {
    if (linkedAccount.id === request.account.id) return response.status(400).json({ error: 'No puede desactivar su propia cuenta administrativa.' });
    if (activeAdministratorCount(linkedAccount.id) === 0) return response.status(400).json({ error: 'Debe permanecer al menos un Administrador activo.' });
  }
  item.state = request.body.state;
  if (linkedAccount) {
    linkedAccount.state = item.state;
    if (item.state !== 'Activo') revokeSessions(linkedAccount.id);
  }
  adminAuditLog(request, 'staff', item.id, `Estado: ${item.state}`, `${item.name} · ${item.role}`);
  saveDatabase(); response.json({ item, message: `Cuenta ${item.state.toLowerCase()}.` });
});
app.patch('/api/admin/staff/:id/shift', requireAdmin, requireCsrf, (request, response) => {
  const item = database.staff.find((staff) => staff.id === request.params.id && staff.role === 'Vigilante');
  if (!item || !guardShifts.includes(request.body.shift)) return response.status(400).json({ error: 'Vigilante o turno no válido.' });
  item.shift = request.body.shift;
  const linkedAccount = linkedAccountForStaff(item);
  if (linkedAccount) linkedAccount.shift = item.shift;
  adminAuditLog(request, 'staff', item.id, 'Turno actualizado', `${item.name} · ${item.shift}`);
  saveDatabase(); response.json({ item: { ...item, hasAccess: Boolean(linkedAccount && linkedAccount.state === 'Activo' && item.state === 'Activo'), accessState: linkedAccount?.state || 'Sin cuenta' }, message: 'Turno actualizado y sincronizado con la cuenta.' });
});
app.delete('/api/admin/staff/:id', requireAdmin, requireCsrf, (request, response) => {
  const index = database.staff.findIndex((staff) => staff.id === request.params.id);
  if (index < 0) return response.sendStatus(404);
  const target = database.staff[index];
  const linkedAccount = linkedAccountForStaff(target);
  if (linkedAccount?.id === request.account.id) return response.status(400).json({ error: 'No puede eliminar su propia cuenta administrativa.' });
  if (linkedAccount && accountRoles(linkedAccount).includes('administrador') && linkedAccount.state === 'Activo' && activeAdministratorCount(linkedAccount.id) === 0) return response.status(400).json({ error: 'Debe permanecer al menos un Administrador activo.' });
  const dependencies = staffDependencies(linkedAccount?.id, target.id);
  if (dependencies.total) return response.status(409).json({ error: 'La cuenta tiene clases, estudiantes tutorados, asistencias o solicitudes relacionadas. Reasigne sus dependencias o desactívela para conservar el historial.' });
  const [removed] = database.staff.splice(index, 1);
  adminAuditLog(request, 'staff', removed.id, 'Eliminación', `${removed.name} · ${removed.role}`);
  if (linkedAccount) {
    revokeSessions(linkedAccount.id);
    database.accounts = database.accounts.filter((account) => account.id !== linkedAccount.id);
  }
  saveDatabase(); response.sendStatus(204);
});

app.get('/api/admin/family-links', requireAdmin, (request, response) => {
  const parents = database.accounts.filter((account) => accountRoles(account).includes('padre')).map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    document: account.document || '',
    relationship: account.relationship || 'Apoderado',
    state: account.state,
    studentIds: Array.isArray(account.studentIds) ? account.studentIds : [],
    students: database.students.filter((student) => (account.studentIds || []).includes(student.id)).map((student) => ({ id: student.id, name: student.name, program: student.program })),
  }));
  response.json({ parents, students: database.students.map((student) => ({ id: student.id, name: student.name, document: student.document, program: student.program, state: student.state })) });
});

app.put('/api/admin/family-links/:accountId', requireAdmin, requireCsrf, (request, response) => {
  const account = database.accounts.find((item) => item.id === request.params.accountId && accountRoles(item).includes('padre'));
  const studentIds = [...new Set(Array.isArray(request.body.studentIds) ? request.body.studentIds.map(String) : [])];
  const relationship = String(request.body.relationship || 'Apoderado').trim();
  if (!account) return response.status(404).json({ error: 'La cuenta familiar no existe.' });
  if (!relationship || relationship.length > 60) return response.status(400).json({ error: 'Indique un parentesco válido.' });
  if (studentIds.some((id) => !database.students.some((student) => student.id === id))) return response.status(400).json({ error: 'Uno de los estudiantes seleccionados no existe.' });
  const previous = Array.isArray(account.studentIds) ? [...account.studentIds] : [];
  account.studentIds = studentIds;
  account.relationship = relationship;
  database.familyAudit.unshift({ id: `FAU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, entity: 'familyLink', entityId: account.id, action: 'Vínculos actualizados', detail: `${previous.join(',') || 'Sin vínculos'} → ${studentIds.join(',') || 'Sin vínculos'}`, userId: request.account.id, date: new Date().toISOString() });
  saveDatabase(); response.json({ account: { id: account.id, studentIds, relationship }, message: 'Vínculos familiares actualizados y auditados.' });
});

app.get('/api/admin/export/:type.xlsx', requireAdmin, asyncRoute(async (request, response) => {
  const type = request.params.type;
  if (!['students', 'staff'].includes(type)) return response.sendStatus(404);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type === 'students' ? 'Estudiantes' : 'Personal');
  const headers = type === 'students' ? ['Código','Tipo de documento','Documento','Nombres','Correo','Semestre','Programa','Estado'] : ['Código','Tipo de documento','Documento','Nombres','Correo','Rol','Programa','Estado','Turno'];
  sheet.addRow(headers);
  const staffSource = request.query.scope === 'personnel' ? database.staff.filter((item) => item.role !== 'Vigilante') : database.staff;
  const source = filteredRecords(type === 'students' ? database.students : staffSource, request.query);
  source.forEach((item) => sheet.addRow(type === 'students' ? [item.id,item.documentType || 'DNI',item.document,item.name,item.email,item.semester,item.program,item.state] : [item.id,item.documentType || 'DNI',item.document,item.name,item.email,item.role,item.program,item.state,item.shift]));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B7A' } };
  sheet.columns.forEach((column) => { column.width = 24; });
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', `attachment; filename="${type === 'students' ? 'estudiantes' : 'personal'}-siga.xlsx"`);
  await workbook.xlsx.write(response); response.end();
}));

app.get('/api/admin/templates/:type', requireAdmin, asyncRoute(async (request, response) => {
  const profile = roleImportProfiles[request.params.type];

  if (profile) return response.download(path.join(templateDirectory, profile.filename));
  if (request.params.type === 'staff') return sendTemplate(response, request.params.type);
  return response.sendStatus(404);
}));
app.post('/api/admin/import/:type', requireAdmin, requireCsrf, excelUpload.single('file'), asyncRoute(async (request, response) => {
  const type = request.params.type;
  const profile = roleImportProfiles[type];
  if (!profile && type !== 'staff') return response.status(400).json({ error: 'Seleccione un tipo de importación válido.' });
  const fileError = validateExcelFile(request.file);
  if (fileError) return response.status(400).json({ error: fileError });
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(request.file.buffer); }
  catch { return response.status(400).json({ error: 'No fue posible leer el archivo Excel. Descargue nuevamente la plantilla oficial.' }); }
  const sheet = workbook.worksheets[0];
  if (!sheet) return response.status(400).json({ error: 'El archivo no contiene una hoja de datos.' });
  const sizeError = validateWorksheetSize(sheet);
  if (sizeError) return response.status(413).json({ error: sizeError });
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    const values = row.values.map(normalizedHeader);
    if (!headerRow && values.includes('nombres') && values.includes('correo')) headerRow = rowNumber;
  });
  if (!headerRow) return response.status(400).json({ error: 'La plantilla no contiene los encabezados esperados.' });
  const headers = importHeaderMap(sheet.getRow(headerRow));
  const requiredHeaders = profile ? ['nombres','apellidos','tipo de documento','documento','correo','usuario','contrasena inicial','estado'] : ['tipo de documento','documento','nombres','correo','rol','programa','estado','contrasena inicial'];
  if (profile?.role !== 'Administrador' && profile?.role !== 'Vigilante') requiredHeaders.push('programa de estudios');
  if (profile?.role === 'Docente') requiredHeaders.push('funcion de tutor');
  if (profile?.role === 'Vigilante') requiredHeaders.push('turno');
  const missingHeaders = requiredHeaders.filter((name) => !headers.has(name));
  if (missingHeaders.length) return response.status(400).json({ error: `Faltan columnas obligatorias: ${missingHeaders.join(', ')}.` });
  const errors = [];
  const accepted = [];
  const seenEmails = new Set();
  const seenDocuments = new Set();
  const seenUsernames = new Set();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow || row.values.every((value) => !value)) return;
    const firstNames = valueFromHeaders(row, headers, 'nombres');
    const lastNames = valueFromHeaders(row, headers, 'apellidos');
    const username = valueFromHeaders(row, headers, 'usuario').toLowerCase();
    const tutorFunction = normalizedHeader(valueFromHeaders(row, headers, 'función de tutor', 'funcion de tutor'));
    const item = {
      documentType: valueFromHeaders(row, headers, 'tipo de documento', 'tipo documento'),
      document: valueFromHeaders(row, headers, 'documento'),
      name: lastNames ? `${firstNames} ${lastNames}`.trim() : firstNames,
      email: valueFromHeaders(row, headers, 'correo').toLowerCase(),
      role: profile?.role || valueFromHeaders(row, headers, 'rol'),
      program: profile?.institutional ? 'Institucional' : valueFromHeaders(row, headers, 'programa de estudios', 'programa'),
      additionalPrograms: profile?.role === 'Docente' ? [1, 2, 3].map((number) => valueFromHeaders(row, headers, 'programa adicional ' + number)).filter(Boolean) : [],
      username,
      password: valueFromHeaders(row, headers, 'contraseña inicial', 'contrasena inicial', 'contraseña', 'contrasena'),
      state: valueFromHeaders(row, headers, 'estado'),
      shift: profile?.role === 'Vigilante' ? valueFromHeaders(row, headers, 'turno') : '',
      pointOfControl: profile?.role === 'Vigilante' ? 'Puerta principal' : '',
      roles: importedStaffRoles(profile?.role, tutorFunction),
    };
    const validation = validatePerson(item, 'staff');
    const duplicate = seenEmails.has(item.email) || seenDocuments.has(item.document) || database.staff.some((existing) => existing.email.toLowerCase() === item.email || normalizeDocument(existing.document) === item.document) || database.accounts.some((account) => account.email.toLowerCase() === item.email || normalizeDocument(account.document) === item.document);
    const usernameError = profile && (!/^[a-z0-9._-]{3,64}$/.test(item.username) || seenUsernames.has(item.username) || database.accounts.some((account) => String(account.username || '').toLowerCase() === item.username)) ? 'El usuario no es válido o ya está registrado.' : '';
    const passwordError = !validPassword(item.password) ? 'La contraseña inicial no cumple los requisitos de seguridad.' : '';
    const shiftError = item.role === 'Vigilante' && !guardShifts.includes(item.shift) ? 'Seleccione un turno válido.' : '';
    const tutorFunctionError = profile?.role === 'Docente' && !['si', 'no'].includes(tutorFunction) ? 'Seleccione Sí o No en Función de tutor.' : '';
    if (validation || duplicate || usernameError || passwordError || shiftError || tutorFunctionError) errors.push({ row: rowNumber, message: duplicate ? 'Documento o correo duplicado.' : validation || usernameError || passwordError || shiftError || tutorFunctionError });
    else { seenEmails.add(item.email); seenDocuments.add(item.document); if (item.username) seenUsernames.add(item.username); accepted.push(item); }
  });
  if (errors.length) return response.status(422).json({ error: 'Se encontraron filas con errores.', errors, validRows: accepted.length });
  if (!accepted.length) return response.status(400).json({ error: 'La plantilla no contiene registros para importar.' });
  accepted.forEach((item) => {
    item.id = `PER-${String(database.nextIds.staff++).padStart(3, '0')}`;
    const password = item.password;
    delete item.password;
    const account = accountFromStaff(item, password);
    item.accountId = account.id;
    database.staff.push(item);
    database.accounts.push(account);
    adminAuditLog(request, 'staff', item.id, 'Importación Excel', `${item.name} · ${item.role}`);
  });
  saveDatabase(); response.json({ message: `${accepted.length} registros importados correctamente.`, imported: accepted.length, errors: [] });
}));

function invalidReportRange(query) {
  return query.from && query.to && query.from > query.to;
}

app.get('/api/admin/reports', requireAdmin, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  response.json(attendanceReport(request.query));
});
app.get('/api/admin/reports.xlsx', requireAdmin, asyncRoute(async (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const report = attendanceReport(request.query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reporte');
  sheet.addRow(['Programa', 'Total de registros']);
  report.byProgram.forEach((item) => sheet.addRow([item.program, item.total]));
  sheet.addRow([]); sheet.addRow(['Estado de asistencia', 'Total']); report.byState.forEach((item) => sheet.addRow([item.state, item.total]));
  sheet.addRow([]); sheet.addRow(['Estado de estudiantes', 'Total']); report.studentByState.forEach((item) => sheet.addRow([item.state, item.total]));
  sheet.addRow([]); sheet.addRow(['Rol de personal', 'Total']); report.staffByRole.forEach((item) => sheet.addRow([item.role, item.total]));
  sheet.addRow([]); sheet.addRow(['Programa', 'Ausencias', 'Tasa de ausencia', 'Nivel de permanencia']); report.permanence.forEach((item) => sheet.addRow([item.program, item.absences, `${item.absenceRate}%`, item.level]));
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 64 }, { width: 20 }];
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename="reporte-siga.xlsx"');
  await workbook.xlsx.write(response); response.end();
}));
app.get('/api/admin/reports.pdf', requireAdmin, (request, response) => {
  if (invalidReportRange(request.query)) return response.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final.' });
  const report = attendanceReport(request.query);
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="reporte-siga.pdf"');
  const document = new PDFDocument({ margin: 48, size: 'A4' });
  document.pipe(response);
  document.fontSize(18).fillColor('#173b7a').text('SIGA - Reporte institucional');
  document.moveDown().fontSize(11).fillColor('#12213d').text(`Estudiantes registrados: ${report.students}`).text(`Personal registrado: ${report.staff}`);
  document.moveDown().fontSize(13).text('Asistencia por programa');
  report.byProgram.forEach((item) => document.fontSize(10).text(`${item.program}: ${item.total}`));
  document.moveDown().fontSize(13).text('Asistencia por estado');
  report.byState.forEach((item) => document.fontSize(10).text(`${item.state}: ${item.total}`));
  document.moveDown().fontSize(13).text('Estudiantes por estado');
  report.studentByState.forEach((item) => document.fontSize(10).text(`${item.state}: ${item.total}`));
  document.moveDown().fontSize(13).text('Personal por rol');
  report.staffByRole.forEach((item) => document.fontSize(10).text(`${item.role}: ${item.total}`));
  document.moveDown().fontSize(13).text('Seguimiento de permanencia');
  report.permanence.forEach((item) => document.fontSize(9).text(`${item.program}: ${item.absences} ausencias · ${item.absenceRate}% · ${item.level}`));
  document.end();
});

app.get('/api/admin/security-status', requireAdmin, (request, response) => {
  const controls = [
    { key: 'authentication', active: typeof crypto.scryptSync === 'function', title: 'Autenticación protegida', description: 'Las contraseñas se derivan con scrypt y una sal aleatoria; no se almacenan en texto plano.' },
    { key: 'roles', active: request.session.role === 'administrador', title: 'Acceso por rol', description: 'La sesión actual fue verificada como administrativa.' },
    { key: 'csrf', active: Boolean(request.session.csrf), title: 'Formularios protegidos', description: 'La sesión cuenta con token para operaciones de escritura.' },
    { key: 'session', active: request.session.expiresAt > Date.now(), title: 'Sesión temporal', description: 'La sesión tiene vencimiento automático configurado.' },
  ];
  response.json({ controls, active: controls.filter((item) => item.active).length, total: controls.length, sessionExpiresAt: request.session.expiresAt });
});

app.get('/api/account', requireAuth, (request, response) => response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role) }));
app.put('/api/account', requireAuth, requireCsrf, (request, response) => {
  const previousEmail = request.account.email;
  const canEditInstitutionalData = request.session.role === 'administrador' && accountRoles(request.account).includes('administrador');
  const name = canEditInstitutionalData ? String(request.body.name || '').trim() : request.account.name;
  const email = canEditInstitutionalData ? String(request.body.email || '').trim().toLowerCase() : request.account.email;
  const username = canEditInstitutionalData ? String(request.body.username || '').trim().toLowerCase() : String(request.account.username || '');
  const documentType = canEditInstitutionalData ? normalizeDocumentType(request.body.documentType) : String(request.account.documentType || 'DNI');
  const document = canEditInstitutionalData ? String(request.body.document || '').trim() : String(request.account.document || '');
  const institutionalCode = canEditInstitutionalData ? String(request.body.institutionalCode || '').trim() : String(request.account.institutionalCode || '');
  const position = canEditInstitutionalData ? String(request.body.position || '').trim() : String(request.account.position || '');
  const phone = String(request.body.phone || '').trim();
  const address = String(request.body.address || '').trim();
  const bio = String(request.body.bio || '').trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return response.status(400).json({ error: 'Ingrese un nombre y correo válidos.' });
  if (canEditInstitutionalData) {
    const identity = { documentType, document };
    const documentError = validateIdentityDocument(identity);
    if (documentError) return response.status(400).json({ error: documentError });
  }
  if (username && !/^[a-z0-9._-]{3,64}$/.test(username)) return response.status(400).json({ error: 'El usuario debe tener de 3 a 64 caracteres: minúsculas, números, punto, guion o guion bajo.' });
  if (document.length > 15 || institutionalCode.length > 30 || position.length > 80 || phone.length > 20 || address.length > 160 || bio.length > 300) return response.status(400).json({ error: 'Uno de los datos supera la longitud permitida.' });
  if (database.accounts.some((account) => account.id !== request.account.id && account.email.toLowerCase() === email)) return response.status(409).json({ error: 'El correo ya pertenece a otra cuenta.' });
  if (username && database.accounts.some((account) => account.id !== request.account.id && String(account.username || '').toLowerCase() === username)) return response.status(409).json({ error: 'El usuario ya pertenece a otra cuenta.' });
  const normalizedDocument = normalizeDocument(document);
  if (normalizedDocument && database.accounts.some((account) => account.id !== request.account.id && normalizeDocument(account.document) === normalizedDocument)) return response.status(409).json({ error: 'El documento ya pertenece a otra cuenta.' });
  Object.assign(request.account, { name, email, username, documentType, document: normalizedDocument, institutionalCode, position, phone, address, bio });
  const linkedStaff = database.staff.find((item) => item.accountId === request.account.id || item.email.toLowerCase() === previousEmail.toLowerCase());
  if (linkedStaff && canEditInstitutionalData) {
    linkedStaff.accountId = request.account.id;
    linkedStaff.name = name;
    linkedStaff.email = email;
    if (document) {
      linkedStaff.documentType = documentType;
      linkedStaff.document = normalizedDocument;
    }
  }
  saveDatabase(); response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role), message: 'Información de la cuenta actualizada.' });
});
app.get('/api/account/photo', requireAuth, (request, response) => {
  if (!request.account.photoFile) return response.sendStatus(404);
  const target = path.join(profilePhotoDirectory, path.basename(request.account.photoFile));
  if (!fs.existsSync(target)) return response.sendStatus(404);
  response.sendFile(target);
});
app.post('/api/account/photo', requireAuth, requireCsrf, upload.single('photo'), asyncRoute(async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Seleccione una fotografía.' });
  if (request.file.size > 2 * 1024 * 1024) return response.status(400).json({ error: 'La fotografía no debe superar 2 MB.' });
  const extension = imageExtension(request.file.buffer);
  if (!extension) return response.status(400).json({ error: 'Use una imagen JPG, PNG o WebP válida.' });
  await scanEvidence(request.file.buffer);
  const filename = `${request.account.id}-${crypto.randomUUID()}.${extension}`;
  await fs.promises.writeFile(path.join(profilePhotoDirectory, filename), request.file.buffer, { flag: 'wx', mode: 0o600 });
  removeProfilePhoto(request.account);
  request.account.photoFile = filename;
  saveDatabase();
  response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role), message: 'Foto de perfil actualizada.' });
}));
app.delete('/api/account/photo', requireAuth, requireCsrf, (request, response) => {
  removeProfilePhoto(request.account);
  saveDatabase();
  response.json({ user: publicAccount(request.account, request.session.csrf, request.session.role), message: 'Foto de perfil eliminada.' });
});
app.post('/api/account/password', requireAuth, requireCsrf, (request, response) => {
  const current = String(request.body.current || '');
  const password = String(request.body.password || '');
  if (!verifyPassword(current, request.account.passwordHash)) return response.status(400).json({ error: 'La contraseña actual no es correcta.' });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password)) return response.status(400).json({ error: 'Use 10 caracteres, mayúscula, minúscula, número y símbolo.' });
  request.account.passwordHash = hashPassword(password);
  revokeSessions(request.account.id);
  const refreshedSession = createSession(response, request.account, request, request.session.role);
  saveDatabase(); response.json({ user: publicAccount(request.account, refreshedSession.csrf, refreshedSession.role), message: 'Contraseña actualizada correctamente. Las otras sesiones fueron cerradas.' });
});

app.get('/api/admin/usage-metrics', requireAdmin, (request, response) => {
  const days = Math.min(90, Math.max(1, Number(request.query.days) || 30));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const items = [...usageMetrics.values()]
    .filter((item) => new Date(item.date).getTime() >= cutoff)
    .map(({ key, totalDurationMs, ...item }) => ({ ...item, averageDurationMs: item.count ? Number((totalDurationMs / item.count).toFixed(1)) : 0 }))
    .sort((left, right) => right.date.localeCompare(left.date) || left.event.localeCompare(right.event));
  response.json({ privacy: 'Métricas agregadas sin nombres, documentos, correos ni direcciones IP.', days, items });
});

app.get('/health', (request, response) => {
  const available = storageProvider !== 'sqlserver' || Boolean(sqlServerStore);
  response.status(available ? 200 : 503).json({ status: available ? 'ok' : 'unavailable' });
});

app.use('/api', (request, response) => response.status(404).json({ error: 'La ruta solicitada no existe.' }));

app.use('/pages/:role', (request, response, next) => {
  const session = currentSession(request);
  if (!session) return response.redirect('/index.html?session=required');
  const account = database.accounts.find((item) => item.id === session.userId);
  if (!account || account.state !== 'Activo') {
    response.setHeader('Set-Cookie', 'siga_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return response.redirect('/index.html?session=required');
  }
  if (session.role !== request.params.role || !accountRoles(account).includes(request.params.role)) return response.status(403).sendFile(path.join(publicDirectory, '403.html'));
  next();
});

app.get(['/privacidad', '/privacidad.html'], (request, response, next) => {
  fs.promises.readFile(path.join(publicDirectory, 'privacidad.html'), 'utf8')
    .then((template) => {
      const values = {
        SIGA_LEGAL_NAME: process.env.SIGA_LEGAL_NAME || 'IESTP Contralmirante Manuel Villar Olivera',
        SIGA_LEGAL_ADDRESS: process.env.SIGA_LEGAL_ADDRESS || 'Consulte la dirección institucional vigente en mesa de partes.',
        SIGA_PRIVACY_EMAIL: process.env.SIGA_PRIVACY_EMAIL || 'Mesa de partes institucional',
        SIGA_RETENTION_NOTICE: process.env.SIGA_RETENTION_NOTICE || 'Los datos se conservan durante la relación académica y los plazos exigidos por la normativa y el archivo institucional.',
        SIGA_DATA_RECIPIENTS: process.env.SIGA_DATA_RECIPIENTS || 'Áreas académicas, administrativas y de seguridad autorizadas de la institución; no se realizan transferencias comerciales.',
      };
      const html = Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, escapeHtmlText(value)), template);
      response.type('html').setHeader('Cache-Control', 'no-store, max-age=0');
      response.send(html);
    })
    .catch(next);
});
app.get('/robots.txt', (request, response) => response.type('text/plain').send('User-agent: *\nDisallow: /\n'));
app.use('/assets', express.static(path.join(publicDirectory, 'assets'), { etag: true, maxAge: '30d', immutable: false }));
app.use(express.static(publicDirectory, {
  extensions: ['html'],
  etag: true,
  maxAge: '1h',
  setHeaders(response, filePath) {
    if (filePath.endsWith('.html')) response.setHeader('Cache-Control', 'no-store, max-age=0');
  },
}));
app.use((request, response) => {
  if (request.method === 'GET' || request.method === 'HEAD') return response.status(404).sendFile(path.join(publicDirectory, '404.html'));
  return response.sendStatus(404);
});
app.use((error, request, response, next) => {
  console.error(JSON.stringify({ level: 'error', event: 'request_failed', requestId: request.id || '', message: error.message, code: error.code || '', stack: process.env.NODE_ENV === 'production' ? undefined : error.stack }));
  if (!['LIMIT_FILE_SIZE', 'SIGA_ANTIMALWARE_REJECTED', 'SIGA_WRITE_CONFLICT'].includes(error.code)) operationalAlert('request_failed', { requestId: request.id || '', method: request.method, path: request.path, code: error.code || '' });
  if (error.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'El archivo supera el tamaño máximo permitido para este módulo.' });
  if (error.code === 'SIGA_ANTIMALWARE_REJECTED') return response.status(422).json({ error: error.message });
  if (error.code === 'SIGA_ANTIMALWARE_UNAVAILABLE') return response.status(503).json({ error: error.message });
  if (error.code === 'SIGA_WRITE_CONFLICT') return response.status(409).json({ error: error.message });
  if (!request.path.startsWith('/api/') && request.accepts('html')) return response.status(500).sendFile(path.join(publicDirectory, '500.html'));
  return response.status(500).json({ error: 'No fue posible completar la operación.' });
});

function startServer(port, attemptsRemaining = 10) {
  const server = app.listen(port, bindHost, () => console.log(`SIGA Web disponible en http://${bindHost}:${port}`));
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsRemaining > 0 && !process.env.PORT) {
      console.warn(`El puerto ${port} está ocupado. Intentando con ${port + 1}...`);
      return startServer(port + 1, attemptsRemaining - 1);
    }
    console.error('No se pudo iniciar SIGA Web:', error.message);
    process.exitCode = 1;
  });
}

if (require.main === module) {
  initializePersistence()
    .then(() => startServer(preferredPort))
    .catch((error) => {
      console.error('No se pudo iniciar la persistencia de SIGA:', error.message);
      process.exitCode = 1;
    });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      closePersistence()
        .catch((error) => console.error('Error al cerrar SQL Server:', error.message))
        .finally(() => process.exit(0));
    });
  }
}

module.exports = { app, startServer, initializePersistence, closePersistence, limaDate, validIsoDate, evidenceExtension, productionConfigurationErrors, antimalwareArguments, importedStaffRoles, sendTemplate, emptyStudentImportRow, teacherPrograms, validateAdditionalPrograms, validatePerson };
