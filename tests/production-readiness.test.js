'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const project = path.join(__dirname, '..');
const os = require('node:os');
const testDataDirectory = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'siga-template-test-'));
process.env.SIGA_DATA_DIR = testDataDirectory;
process.env.SIGA_STORAGE = 'json';
process.env.SIGA_DEMO_MODE = 'true';
process.env.SIGA_DISABLE_REQUEST_LOGS = 'true';
process.env.SIGA_DEMO_ADMIN_PASSWORD = 'SigaAdmin2026!';
process.env.SIGA_DEMO_TEACHER_PASSWORD = 'SigaDocente2026!';
process.env.SIGA_DEMO_COORDINATOR_PASSWORD = 'SigaCoordinador2026!';
process.env.SIGA_DEMO_TUTOR_PASSWORD = 'SigaTutor2026!';
process.env.SIGA_DEMO_PARENT_PASSWORD = 'SigaPadre2026!';
process.env.SIGA_DEMO_GUARD_PASSWORD = 'SigaVigilante2026!';
process.env.SIGA_DEMO_STUDENT_PASSWORD = 'SigaEstudiante2026!';
process.env.SIGA_DEMO_SECOND_STUDENT_PASSWORD = 'SigaValeria2026!';
test.after(() => {
  const resolved = path.resolve(testDataDirectory);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('siga-template-test-')) {
    require('node:fs').rmSync(resolved, { recursive: true, force: true });
  }
});
const { productionConfigurationErrors, applyTechnicalRetention, antimalwareArguments, importedStaffRoles } = require('../server');

test('la carga de Docentes asigna Tutor únicamente cuando la plantilla indica Sí', () => {
  assert.deepEqual(importedStaffRoles('Docente', 'Sí'), ['docente', 'tutor']);
  assert.deepEqual(importedStaffRoles('Docente', 'si'), ['docente', 'tutor']);
  assert.deepEqual(importedStaffRoles('Docente', 'No'), ['docente']);
});

test('Tutor ya no se admite como tipo de cuenta independiente', () => {
  assert.equal(importedStaffRoles('Tutor'), undefined);
  assert.equal(importedStaffRoles('Administrador'), undefined);
  assert.equal(fs.existsSync(path.join(project, 'templates', 'SIGA_plantilla_tutores.xlsx')), false);
  const browserScript = fs.readFileSync(path.join(project, 'public', 'script.js'), 'utf8');
  assert.match(browserScript, /filter\(\(\[key\]\) => key !== 'tutor'\)/);
  assert.doesNotMatch(browserScript, /\['tutors','heart'/);
});

test('producción rechaza una configuración incompleta o insegura', () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const errors = productionConfigurationErrors();
    assert.ok(errors.some((item) => item.includes('SIGA_STORAGE')));
    assert.ok(errors.some((item) => item.includes('SIGA_PUBLIC_BASE_URL')));
    assert.ok(errors.some((item) => item.includes('SIGA_ANTIMALWARE_COMMAND')));
    assert.ok(errors.some((item) => item.includes('SIGA_ALERT_WEBHOOK')));
  } finally {
    if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original;
  }
});

test('los argumentos antimalware sustituyen la ruta sin usar un shell', () => {
  const original = process.env.SIGA_ANTIMALWARE_ARGS_JSON;
  process.env.SIGA_ANTIMALWARE_ARGS_JSON = '["--no-summary","{file}"]';
  try { assert.deepEqual(antimalwareArguments('C:\\quarantine\\sample.upload'), ['--no-summary', 'C:\\quarantine\\sample.upload']); }
  finally { if (original === undefined) delete process.env.SIGA_ANTIMALWARE_ARGS_JSON; else process.env.SIGA_ANTIMALWARE_ARGS_JSON = original; }
});

test('la retención técnica elimina bitácoras vencidas sin borrar el historial académico', () => {
  const previous = process.env.SIGA_RETENTION_DAYS;
  process.env.SIGA_RETENTION_DAYS = '365';
  try {
    const old = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString();
    const state = {
      securityAudit: [{ id: 'OLD', date: old }],
      notifications: [{ id: 'READ', read: true, date: old }, { id: 'UNREAD', read: false, date: old }],
      passwordRecoveryRequests: [{ id: 'DONE', status: 'Atendida', requestedAt: old }, { id: 'OPEN', status: 'Pendiente', requestedAt: old }],
      attendance: [{ id: 'ACADEMIC', date: old }],
      students: [{ id: 'STUDENT' }],
    };
    assert.equal(applyTechnicalRetention(state), true);
    assert.deepEqual(state.securityAudit, []);
    assert.deepEqual(state.notifications.map((item) => item.id), ['UNREAD']);
    assert.deepEqual(state.passwordRecoveryRequests.map((item) => item.id), ['OPEN']);
    assert.equal(state.attendance.length, 1);
    assert.equal(state.students.length, 1);
  } finally {
    if (previous === undefined) delete process.env.SIGA_RETENTION_DAYS; else process.env.SIGA_RETENTION_DAYS = previous;
  }
});

test('el paquete excluye datos, respaldos, pruebas e informes', () => {
  const rules = fs.readFileSync(path.join(project, '.npmignore'), 'utf8');
  for (const required of ['data/', 'backups/', 'tests/', 'informe_trabajo/', 'outputs/', '.playwright-browsers/', '.env*']) assert.match(rules, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('el despliegue fija exactamente las dependencias aprobadas', () => {
  const shrinkwrapPath = path.join(project, 'npm-shrinkwrap.json');
  assert.ok(fs.existsSync(shrinkwrapPath), 'Falta npm-shrinkwrap.json en el paquete de producción.');
  const shrinkwrap = JSON.parse(fs.readFileSync(shrinkwrapPath, 'utf8'));
  assert.equal(shrinkwrap.lockfileVersion, 3);
  assert.equal(shrinkwrap.packages[''].name, 'siga-web');
  assert.deepEqual(shrinkwrap.packages[''].dependencies, require('../package.json').dependencies);
});

test('los recursos principales incluyen compresión Brotli y Gzip verificable', () => {
  for (const relative of ['public/script.js', 'public/styles.css']) {
    const source = fs.readFileSync(path.join(project, relative));
    const gzip = fs.readFileSync(path.join(project, `${relative}.gz`));
    const brotli = fs.readFileSync(path.join(project, `${relative}.br`));
    assert.deepEqual(zlib.gunzipSync(gzip), source, `${relative}.gz no coincide con el original`);
    assert.deepEqual(zlib.brotliDecompressSync(brotli), source, `${relative}.br no coincide con el original`);
    assert.ok(gzip.length < source.length * 0.35, `${relative}.gz no reduce suficientemente el tamaño`);
    assert.ok(brotli.length < source.length * 0.3, `${relative}.br no reduce suficientemente el tamaño`);
  }
});

test('existen páginas legales y errores personalizados', () => {
  for (const file of ['privacidad.html', 'cookies.html', 'terminos.html', '403.html', '404.html', '500.html']) assert.ok(fs.existsSync(path.join(project, 'public', file)), file);
});
