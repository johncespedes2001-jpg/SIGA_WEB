'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const clientSource = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
const database = JSON.parse(fs.readFileSync(path.join(root, 'data', 'siga.json'), 'utf8'));
const normalizeGroup = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('es');
const permanenceStart = clientSource.indexOf('async function renderCoordinatorPermanence()');
const permanenceEnd = clientSource.indexOf('async function renderCoordinatorReports()');
const coordinatorPermanenceSource = clientSource.slice(permanenceStart, permanenceEnd);

test('Coordinación limita asistencia y permisos a matrículas válidas de su programa', () => {
  assert.ok(serverSource.includes('classMap.get(item.classId).studentIds.includes(item.studentId)'));
  assert.ok(serverSource.includes('studentMap.has(item.studentId)'));
  assert.ok(serverSource.includes("if (item.source === 'Estudiante') return true;"));
  assert.ok(serverSource.includes('course && course.studentIds.includes(item.studentId)'));
});

test('las clases validan cohorte, duplicados, jornada y cruces institucionales', () => {
  assert.ok(serverSource.includes("item.semester === semester && normalizeAcademicGroup(item.group) === normalizeAcademicGroup(group)"));
  assert.ok(serverSource.includes('const duplicateOffering = coordinatorClasses(request).find'));
  assert.ok(serverSource.includes('startMinutes < timeToMinutes(institutionStart)'));
  assert.ok(serverSource.includes('const teacherConflict = database.classes.find'));
  assert.ok(serverSource.includes("const roomConflict = modality !== 'Virtual' && database.classes.find"));
  assert.ok(clientSource.includes('const syncRoster='));
  assert.ok(clientSource.includes('data-group="${escapeHtml(student.group)}"'));
});

test('el padrón separa edición de datos y cambio de estado', () => {
  assert.ok(serverSource.includes('if (values.state !== item.state) return response.status(403)'));
  assert.ok(serverSource.includes('const incompatibleClass = coordinatorClasses(request).find'));
  assert.ok(clientSource.includes('form.elements.state.disabled=editing'));
  assert.ok(clientSource.includes('values.state=items.find'));
});

test('permanencia y seguridad conservan estados finales', () => {
  assert.ok(serverSource.includes('date > limaDate()'));
  assert.ok(serverSource.includes("validateIncident(request, request.body, 'Abierta')"));
  assert.ok(serverSource.includes('Una incidencia cerrada conserva su información final'));
  assert.ok(serverSource.includes('if (nextState === item.status)'));
  assert.ok((serverSource.match(/Una incidencia cerrada conserva su estado final/g) || []).length >= 3);
  assert.ok(!coordinatorPermanenceSource.includes('<label>Estado<select name="status">'));
});

test('justificaciones requieren revisión previa del tutor', () => {
  assert.ok(serverSource.includes("const visibleStatuses = new Set(['En revisión', 'Derivada a Coordinación', 'Aprobada', 'Observada'])"));
  assert.ok(serverSource.includes("!['Derivada a Coordinación', 'En revisión'].includes(scoped.status)"));
  assert.ok(serverSource.includes("&& ['En revisión','Derivada a Coordinación'].includes(item.status)"));
});

test('reportes validan todos los filtros e incluyen permisos en Excel', () => {
  assert.ok(serverSource.includes('function coordinatorReportQueryError(request)'));
  assert.equal(serverSource.split('const queryError = coordinatorReportQueryError(request);').length - 1, 3);
  assert.ok(serverSource.includes("workbook.addWorksheet('Permisos')"));
  assert.ok(serverSource.includes('El estudiante seleccionado no pertenece al programa'));
  assert.ok(clientSource.includes('name="from" type="date" max="${localIsoDate()}"'));
});

test('la respuesta del equipo no expone documentos ni credenciales', () => {
  assert.ok(serverSource.includes('items: items.map((item) => ({ id: item.id, name: item.name, role: item.role, program: item.program, state: item.state }))'));
});

test('los datos almacenados respetan programa, semestre y grupo de cada clase', () => {
  for (const course of database.classes) {
    for (const studentId of course.studentIds || []) {
      const student = database.students.find((item) => item.id === studentId);
      assert.ok(student, 'Debe existir el estudiante ' + studentId + '.');
      assert.equal(student.program, course.program, 'Programa incoherente en ' + course.id + '.');
      assert.equal(student.semester, course.semester, 'Semestre incoherente en ' + course.id + '.');
      assert.equal(normalizeGroup(student.group), normalizeGroup(course.group), 'Grupo incoherente en ' + course.id + '.');
    }
  }
});

test('no existen ofertas académicas duplicadas por cohorte', () => {
  const keys = new Set();
  for (const course of database.classes) {
    const key = [course.program, course.semester, normalizeGroup(course.group), normalizeGroup(course.section), course.course].join('|');
    assert.ok(!keys.has(key), 'Oferta duplicada: ' + key);
    keys.add(key);
  }
});