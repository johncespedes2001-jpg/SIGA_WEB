'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { PassThrough } = require('node:stream');
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
const { sendTemplate, emptyStudentImportRow, teacherPrograms, validateAdditionalPrograms, validatePerson } = require('../server');

const templateDirectory = path.resolve(__dirname, '..', 'templates');
const programs = [
  'Enfermería Técnica',
  'Acuicultura y Procesamiento Pesquero',
  'Mecatrónica Automotriz',
  'Arquitectura de Plataformas y Servicios de Tecnologías de Información',
];

const templates = [
  {
    filename: 'SIGA_plantilla_apoderados.xlsx',
    sheetName: 'Importar apoderados',
    headers: ['Tipo de documento', 'Documento', 'Nombres', 'Apellidos', 'Correo', 'Programa de estudios', 'Usuario', 'Contraseña inicial', 'Estado'],
    validations: { A7: ['DNI', 'CE'], F7: programs, I7: ['Activo', 'Inactivo'] },
  },
  {
    filename: 'SIGA_plantilla_administradores.xlsx',
    sheetName: 'Importar administradores',
    headers: ['Tipo de documento', 'Documento', 'Nombres', 'Apellidos', 'Correo', 'Usuario', 'Contraseña inicial', 'Estado'],
    validations: { A7: ['DNI', 'CE'], H7: ['Activo', 'Inactivo'] },
  },
  {
    filename: 'SIGA_plantilla_coordinadores.xlsx',
    sheetName: 'Importar coordinadores',
    headers: ['Tipo de documento', 'Documento', 'Nombres', 'Apellidos', 'Correo', 'Programa de estudios', 'Usuario', 'Contraseña inicial', 'Estado'],
    validations: { A7: ['DNI', 'CE'], F7: programs, I7: ['Activo', 'Inactivo'] },
  },
  {
    filename: 'SIGA_plantilla_docentes.xlsx',
    sheetName: 'Importar docentes',
    headers: ['Tipo de documento', 'Documento', 'Nombres', 'Apellidos', 'Correo', 'Programa de estudios', 'Función de tutor', 'Usuario', 'Contraseña inicial', 'Estado'],
    validations: { A7: ['DNI', 'CE'], F7: programs, G7: ['Sí', 'No'], J7: ['Activo', 'Inactivo'] },
  },
  {
    filename: 'SIGA_plantilla_vigilantes.xlsx',
    sheetName: 'Importar vigilantes',
    headers: ['Tipo de documento', 'Documento', 'Nombres', 'Apellidos', 'Correo', 'Usuario', 'Contraseña inicial', 'Estado', 'Turno'],
    validations: { A7: ['DNI', 'CE'], H7: ['Activo', 'Inactivo'], I7: ['Mañana', 'Tarde', 'Noche', 'Rotativo'] },
  },
  {
    filename: 'SIGA_plantilla_estudiantes.xlsx',
    sheetName: 'Importar estudiantes',
    headers: ['Tipo de documento', 'Documento', 'Nombres', 'Correo', 'Semestre', 'Grupo', 'Programa', 'Estado', 'Contraseña inicial'],
    validations: { A7: ['DNI', 'CE'], E7: ['I', 'II', 'III', 'IV', 'V', 'VI'], G7: programs, H7: ['Activo', 'Inactivo'] },
  },
];

function validationValues(cell) {
  const formula = cell.dataValidation.formulae?.[0];
  assert.equal(typeof formula, 'string', `La celda ${cell.address} debe tener una lista desplegable.`);
  return formula.replace(/^"|"$/g, '').split(',');
}

for (const definition of templates) {
  test(`la plantilla ${definition.filename} es compatible con el importador`, async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(templateDirectory, definition.filename));
    const sheet = workbook.worksheets[0];

    assert.equal(sheet.name, definition.sheetName);
    assert.deepEqual(sheet.getRow(6).values.slice(1), definition.headers);
    assert.match(String(sheet.getCell('A4').value), /CE: 9 a 15 letras o números/);
    assert.match(String(sheet.getCell('A4').value), /Usuario: 3 a 64 caracteres/);
    assert.match(String(sheet.getCell('A4').value), /Contraseña: mínimo 10 caracteres/);
    assert.equal(sheet.views[0].ySplit, 6);

    for (const [address, expectedValues] of Object.entries(definition.validations)) {
      assert.deepEqual(validationValues(sheet.getCell(address)), expectedValues);
    }
  });
}

test('la plantilla descargable de Coordinación incluye semestres y no crea filas con solo programa', async () => {
  const program = 'Mecatrónica Automotriz';
  const response = new PassThrough();
  const chunks = [];
  response.setHeader = () => {};
  response.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => { response.on('end', resolve); response.on('error', reject); });
  await sendTemplate(response, 'students', [program]);
  await finished;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.concat(chunks));
  const sheet = workbook.worksheets[0];
  const lists = workbook.getWorksheet('Listas');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((row) => lists.getCell('E' + row).value), ['I','II','III','IV','V','VI']);
  for (const row of [7, 8, 250, 506]) {
    assert.equal(sheet.getCell('E' + row).dataValidation.formulae[0], 'Listas!$E$1:$E$6');
    assert.equal(sheet.getCell('G' + row).dataValidation.formulae[0], 'Listas!$B$1:$B$1');
  }
  assert.equal(sheet.getCell('G7').value, program);
  assert.equal(sheet.getCell('G8').value, null);
  assert.equal(sheet.getCell('G506').value, null);
});

test('el importador ignora filas de programas precargados antiguos pero detecta registros incompletos', () => {
  const sheet = new ExcelJS.Workbook().addWorksheet('Estudiantes');
  const headers = new Map([['programa', 7]]);
  const program = 'Mecatrónica Automotriz';
  assert.equal(emptyStudentImportRow(sheet.getRow(8), headers, program), true);
  sheet.getCell('G8').value = program;
  assert.equal(emptyStudentImportRow(sheet.getRow(8), headers, program), true);
  sheet.getCell('C8').value = 'Estudiante incompleto';
  assert.equal(emptyStudentImportRow(sheet.getRow(8), headers, program), false);
  sheet.getCell('C8').value = null;
  sheet.getCell('G8').value = 'Enfermería Técnica';
  assert.equal(emptyStudentImportRow(sheet.getRow(8), headers, program), false);
});
test('los programas adicionales se restringen a docentes y no admiten duplicados ni nombres inválidos', () => {
  const valid = { role: 'Docente', program: programs[0], additionalPrograms: [programs[1], programs[2]] };
  assert.equal(validateAdditionalPrograms(valid), '');
  assert.deepEqual(teacherPrograms(valid), [programs[0], programs[1], programs[2]]);
  assert.notEqual(validateAdditionalPrograms({ ...valid, additionalPrograms: [programs[0]] }), '');
  assert.notEqual(validateAdditionalPrograms({ ...valid, additionalPrograms: [programs[1], programs[1]] }), '');
  assert.notEqual(validateAdditionalPrograms({ ...valid, additionalPrograms: ['Programa inexistente'] }), '');
  assert.notEqual(validateAdditionalPrograms({ ...valid, role: 'Administrador' }), '');
  assert.equal(validateAdditionalPrograms({ role: 'Docente', program: programs[0] }), '');
});
test('un docente de empleabilidad puede estar disponible para todos los programas sin conceder otros roles', () => {
  const base = { role: 'Docente', program: ' empleabilidad ', documentType: 'DNI', document: '12345678', name: 'Docente Ejemplo', email: 'docente@example.edu.pe', state: 'Activo', roles: ['docente'], additionalPrograms: [] };
  assert.equal(validatePerson(base, 'staff'), '');
  assert.equal(base.program, 'Empleabilidad');
  assert.deepEqual(teacherPrograms(base), programs);
  assert.deepEqual(teacherPrograms({ role: 'docente', program: 'Empleabilidad' }), programs);
  assert.notEqual(validatePerson({ ...base, roles: ['docente', 'tutor'] }, 'staff'), '');
  assert.notEqual(validatePerson({ ...base, roles: ['docente', 'coordinador'] }, 'staff'), '');
  assert.notEqual(validatePerson({ ...base, role: 'Coordinador', roles: ['coordinador'] }, 'staff'), '');
  assert.notEqual(validatePerson({ ...base, additionalPrograms: [programs[0]] }, 'staff'), '');
});