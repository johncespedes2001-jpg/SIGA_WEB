'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const clientSource = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
const database = JSON.parse(fs.readFileSync(path.join(root, 'data', 'siga.json'), 'utf8'));
const parentPages = fs.readdirSync(path.join(root, 'public', 'pages', 'padre')).filter((item) => item.endsWith('.html')).sort();

test('el portal familiar contiene todas sus vistas y cada una tiene enrutamiento', () => {
  assert.deepEqual(parentPages, ['asistencia.html','avisos.html','boletas.html','cuenta.html','hijos.html','justificaciones.html','qr-salida.html','resumen.html','reuniones.html','seguimiento.html']);
  for (const page of parentPages) {
    const key = page.replace('.html', '');
    assert.ok(clientSource.includes("if (pageKey === '" + key + "')"), 'Falta el enrutamiento de ' + key + '.');
  }
});

test('el alcance familiar solo proyecta datos necesarios y asistencia académicamente válida', () => {
  assert.ok(serverSource.includes('function guardianStudentDetails(request)'));
  assert.ok(!serverSource.includes('documentType: student.documentType'));
  assert.ok(!serverSource.includes('email: student.email'));
  assert.ok(!serverSource.includes('return { ...student, tutor: activeTutorAccountForStaff'));
  assert.ok(serverSource.includes('course.studentIds.includes(item.studentId)'));
  assert.ok(serverSource.includes('course.program === student.program'));
});

test('los filtros de asistencia rechazan fechas, estados y estudiantes fuera del vínculo', () => {
  assert.ok(serverSource.includes('function parentAttendanceQueryError(request)'));
  assert.ok(serverSource.includes("if ((from && !validIsoDate(from)) || (to && !validIsoDate(to)))"));
  assert.ok(serverSource.includes('if (state && !attendanceStates.includes(state))'));
  assert.ok(serverSource.includes("queryError.includes('vinculado') ? 404 : 400"));
  assert.ok(clientSource.includes('name="from" type="date" max="${localIsoDate()}"'));
  assert.ok(clientSource.includes('name="to" type="date" max="${localIsoDate()}"'));
});

test('las alertas de asistencia se calculan por estudiante y no mezclan hermanos', () => {
  assert.ok(serverSource.includes('const groups = new Map();'));
  assert.ok(serverSource.includes('groups.get(item.studentId).push(item)'));
  assert.ok(serverSource.includes('groups.forEach((studentRows) =>'));
  assert.ok(serverSource.includes('Ausencias consecutivas · ${name}'));
});

test('las justificaciones familiares protegen matrícula, fechas y duplicados', () => {
  assert.ok(serverSource.includes("student.state !== 'Activo'"));
  assert.ok(serverSource.includes('startDate > limaDate() || endDate > limaDate()'));
  assert.ok(serverSource.includes('Ya existe una justificación en trámite'));
  assert.ok(serverSource.includes("students: students.filter((item) => item.state === 'Activo')"));
  assert.ok(clientSource.includes('name="startDate" type="date" value="${localIsoDate()}" max="${localIsoDate()}"'));
  assert.ok(clientSource.includes('name="endDate" type="date" value="${localIsoDate()}" max="${localIsoDate()}"'));
});

test('las boletas no exponen el secreto QR y solo muestran códigos vigentes', () => {
  assert.ok(serverSource.includes('const { qrCode, ...publicItem } = item;'));
  assert.ok(serverSource.includes("hasQr: Boolean(qrCode && displayStatus === 'Aprobada')"));
  assert.ok(!serverSource.includes("displayStatus, hasQr: Boolean(qrCode && displayStatus === 'Aprobada'), validation:"));
  assert.ok(serverSource.includes("familyExitStatus(item) !== 'Aprobada'"));
  assert.ok(clientSource.includes('data.items.filter((item)=>item.hasQr)'));
  assert.ok(clientSource.includes('item.hasQr?'));
});

test('las reuniones respetan el ciclo de vida y evitan respuestas repetidas', () => {
  assert.ok(serverSource.includes("item.date < limaDate()"));
  assert.ok(serverSource.includes("['Realizada','Cancelada'].includes(item.status)"));
  assert.ok(serverSource.includes('La reunión ya tiene una respuesta registrada.'));
  assert.ok(serverSource.includes('Ya existe una solicitud de reprogramación en trámite.'));
  assert.ok(serverSource.includes('proposedDate === item.date'));
  assert.ok(clientSource.includes('item.canConfirm?'));
  assert.ok(clientSource.includes("item.canReschedule?'':'disabled aria-disabled=\"true\"'"));
});

test('avisos, seguimiento y perfil conservan privacidad y validación', () => {
  assert.ok(serverSource.includes('function familyMessageVisible(item)'));
  assert.ok(serverSource.includes('function familyNoticeItems(request)'));
  assert.ok(serverSource.includes("const familyNoticeAudiences = ['Todos','Familia','Apoderado','Padre o apoderado']"));
  assert.ok(serverSource.includes(".toLowerCase().includes('apoderado')"));
  assert.ok(serverSource.includes('item.sharedWithFamily === true'));
  assert.ok(serverSource.includes("!/^[0-9+\\s()-]{6,20}$/.test(phone)"));
  assert.ok(!serverSource.includes('if (document && database.accounts.some'));
  assert.ok(clientSource.includes('pattern="[0-9+() -]{6,20}"'));
  assert.ok(clientSource.includes('Seleccione una fotografía antes de guardarla.'));
});

test('los vínculos familiares almacenados apuntan a cuentas y estudiantes existentes', () => {
  const studentIds = new Set(database.students.map((item) => item.id));
  const parents = database.accounts.filter((item) => item.role === 'padre' || (item.roles || []).includes('padre'));
  assert.ok(parents.length > 0, 'Debe existir al menos una cuenta familiar.');
  for (const parent of parents) {
    assert.ok(Array.isArray(parent.studentIds), 'La cuenta ' + parent.id + ' debe declarar studentIds.');
    assert.equal(new Set(parent.studentIds).size, parent.studentIds.length, 'La cuenta ' + parent.id + ' contiene vínculos duplicados.');
    for (const studentId of parent.studentIds) assert.ok(studentIds.has(studentId), 'Vínculo inexistente: ' + studentId + '.');
  }
});

test('las clases y asistencias almacenadas no filtran datos académicos ajenos', () => {
  const students = new Map(database.students.map((item) => [item.id, item]));
  const classes = new Map(database.classes.map((item) => [item.id, item]));
  for (const row of database.teacherAttendance) {
    const student = students.get(row.studentId);
    const course = classes.get(row.classId);
    assert.ok(student, 'Asistencia con estudiante inexistente: ' + row.id + '.');
    assert.ok(course, 'Asistencia con clase inexistente: ' + row.id + '.');
    assert.ok(course.studentIds.includes(row.studentId), 'Asistencia fuera de matrícula: ' + row.id + '.');
    assert.equal(course.program, student.program, 'Asistencia cruza programas en ' + row.id + '.');
  }
});