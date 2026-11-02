'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

const testDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'siga-parent-import-'));
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
const { app } = require('../server');

let server;
let baseUrl;
const originalFetch = global.fetch;

test.before(async () => {
  if (process.env.SIGA_TEST_IN_MEMORY_HTTP === 'true') {
    global.fetch = require('./in-memory-http')(app);
    baseUrl = 'http://siga-test.invalid';
    return;
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  global.fetch = originalFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  const resolved = path.resolve(testDataDirectory);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('siga-parent-import-')) fs.rmSync(resolved, { recursive: true, force: true });
});

async function login(email, password, role) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: body.user.csrf };
}

async function parentWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Importar apoderados');
  sheet.getRow(6).values = [
    'Tipo de documento', 'Documento', 'Nombres', 'Apellidos', 'Correo',
    'Usuario', 'Contraseña inicial', 'Estado', 'Documento del estudiante', 'Nombre del estudiante', 'Programa de estudios', 'Semestre', 'Parentesco o vínculo',
  ];
  sheet.getRow(7).values = [
    'DNI', '76000001', 'Familia', 'Prueba', 'familia.prueba@example.test',
    'familia.prueba', 'ClaveFamilia2026!', 'Activo', '72459631', 'Diego Mendoza Ruiz', 'Mecatrónica Automotriz', 'II', 'Madre',
  ];
  sheet.getRow(8).values = [
    'DNI', '76000001', 'Familia', 'Prueba', 'familia.prueba@example.test',
    'familia.prueba', 'ClaveFamilia2026!', 'Activo', '73564821', 'Valeria Cruz Jiménez', 'Enfermería Técnica', 'IV', 'Madre',
  ];
  return workbook.xlsx.writeBuffer();
}

test('la carga masiva de apoderados crea la cuenta y vincula estudiantes por documento', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const workbook = await parentWorkbook();
  const form = new FormData();
  form.append('file', new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'apoderados.xlsx');
  const imported = await fetch(`${baseUrl}/api/admin/import/parents`, {
    method: 'POST',
    headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
    body: form,
  });
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).imported, 1);

  const familyLinks = await fetch(`${baseUrl}/api/admin/family-links`, { headers: { cookie: admin.cookie } });
  assert.equal(familyLinks.status, 200);
  const parents = (await familyLinks.json()).parents;
  const parent = parents.find((item) => item.email === 'familia.prueba@example.test');
  assert.ok(parent);
  assert.deepEqual(parent.students.map((student) => student.id).sort(), ['EST-002', 'EST-003']);
  assert.equal(parent.relationship, 'Madre');

  const parentSession = await login('familia.prueba@example.test', 'ClaveFamilia2026!', 'padre');
  const children = await fetch(`${baseUrl}/api/parent/children`, { headers: { cookie: parentSession.cookie } });
  assert.equal(children.status, 200);
  assert.equal((await children.json()).items.length, 2);
});
