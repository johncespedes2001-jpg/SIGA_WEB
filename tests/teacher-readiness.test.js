'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const clientSource = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
const database = JSON.parse(fs.readFileSync(path.join(root, 'data', 'siga.json'), 'utf8'));
const roles = (account) => [...new Set([...(account.roles || []), account.role].filter(Boolean))];

test('el panel y las boletas comparten el mismo alcance docente', () => {
  assert.match(serverSource, /function teacherExitItems\(request\)/);
  assert.match(serverSource, /pendingExits: teacherExitItems\(request\)/);
  assert.match(serverSource, /response\.json\(\{ items: teacherExitItems\(request\) \}\)/);
  assert.match(serverSource, /teacherExitItems\(request\)\.find/);
});

test('la asistencia aplica periodo de corrección y rechaza clases vacías', () => {
  assert.match(serverSource, /editable = date <= today && ageInDays <= attendanceCorrectionDays/);
  assert.match(serverSource, /La clase no tiene estudiantes activos asignados/);
  assert.match(clientSource, /min="\$\{correctionStart\}" max="\$\{today\}"/);
  assert.match(clientSource, /teacherStateButtons\(student\.attendance,!data\.editable\)/);
});

test('las salidas solo ofrecen estudiantes matriculados en la clase elegida', () => {
  assert.match(serverSource, /student\.program !== course\.program/);
  assert.match(clientSource, /eligibleStudents=\(classId\)=>students\.filter/);
  assert.match(clientSource, /classSelect\.addEventListener\('change',updateStudents\)/);
});

test('los reportes docentes validan fechas, curso, grupo, semestre y estado', () => {
  assert.match(serverSource, /function teacherReportQueryError\(request\)/);
  assert.match(serverSource, /El curso seleccionado no está asignado al docente/);
  assert.match(serverSource, /El estado de asistencia seleccionado no es válido/);
  assert.equal((serverSource.match(/const queryError = teacherReportQueryError\(request\);/g) || []).length, 3);
});

test('todas las clases tienen un docente autorizado y matrículas del mismo programa', () => {
  for (const course of database.classes) {
    const teacher = database.accounts.find((account) => account.id === course.teacherId);
    assert.ok(teacher, `La clase ${course.id} debe tener docente.`);
    assert.ok(roles(teacher).includes('docente'), `La cuenta ${teacher.id} debe incluir el rol docente.`);
    assert.equal(teacher.state, 'Activo', `El docente ${teacher.id} debe estar activo.`);
    for (const studentId of course.studentIds || []) {
      const student = database.students.find((item) => item.id === studentId);
      assert.ok(student, `La matrícula ${studentId} debe existir.`);
      assert.equal(student.program, course.program, `La matrícula ${studentId} debe pertenecer al programa de ${course.id}.`);
    }
  }
});

test('la asistencia almacenada no contiene duplicados y respeta el alcance de clase', () => {
  const keys = new Set();
  for (const row of database.teacherAttendance) {
    const course = database.classes.find((item) => item.id === row.classId);
    assert.ok(course, `La asistencia ${row.id} debe apuntar a una clase existente.`);
    assert.equal(row.teacherId, course.teacherId, `La asistencia ${row.id} debe pertenecer al docente de la clase.`);
    assert.ok(course.studentIds.includes(row.studentId), `El estudiante de ${row.id} debe estar matriculado en la clase.`);
    const key = `${row.teacherId}|${row.classId}|${row.studentId}|${row.date}`;
    assert.ok(!keys.has(key), `No debe repetirse la asistencia ${key}.`);
    keys.add(key);
  }
});