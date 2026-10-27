'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
const { productionConfigurationErrors, antimalwareArguments, importedStaffRoles } = require('../server');

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

test('el paquete excluye datos, respaldos, pruebas e informes', () => {
  const rules = fs.readFileSync(path.join(project, '.npmignore'), 'utf8');
  for (const required of ['data/', 'backups/', 'tests/', 'informe_trabajo/', 'outputs/', '.env*']) assert.match(rules, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('existen páginas legales y errores personalizados', () => {
  for (const file of ['privacidad.html', 'cookies.html', 'terminos.html', '403.html', '404.html', '500.html']) assert.ok(fs.existsSync(path.join(project, 'public', file)), file);
});
