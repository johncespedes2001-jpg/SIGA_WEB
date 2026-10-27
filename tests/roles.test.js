'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

const testDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'siga-test-'));
process.env.SIGA_DATA_DIR = testDataDirectory;
// La suite siempre usa un almacén temporal: nunca debe consumir ni modificar SQL Server real.
process.env.SIGA_STORAGE = 'json';
process.env.SIGA_INSTITUTION_START = '00:00';
process.env.SIGA_INSTITUTION_END = '23:59';
process.env.SIGA_DEMO_MODE = 'true';
process.env.SIGA_DISABLE_REQUEST_LOGS = 'true';
process.env.SIGA_TRUST_PROXY = 'false';
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
  if (resolved.startsWith(path.resolve(os.tmpdir()))) fs.rmSync(resolved, { recursive: true, force: true });
});

test('la configuración textual false no habilita un proxy de confianza', () => {
  assert.equal(app.get('trust proxy'), false);
});

async function login(email, password, role) {
  const response = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, role }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: body.user.csrf, user: body.user };
}

async function loginTutorMode() {
  const session = await login('tutor@siga.edu.pe', 'SigaTutor2026!', 'docente');
  const switched = await request(session, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'tutor' }) });
  assert.equal(switched.status, 200);
  return session;
}

async function request(session, url, options = {}) {
  const headers = { ...(options.headers || {}), cookie: session.cookie };
  if (options.body && !(options.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (options.method && options.method !== 'GET') headers['x-csrf-token'] = session.csrf;
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  const refreshedCookie = response.headers.get('set-cookie');
  if (refreshedCookie) {
    session.cookie = refreshedCookie.split(';')[0];
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.clone().json();
      if (body.user?.csrf) session.csrf = body.user.csrf;
    }
  }
  return response;
}

test('el Administrador consulta estudiantes pero no puede registrarlos', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const list = await request(admin, '/api/admin/students');
  assert.equal(list.status, 200);
  const create = await request(admin, '/api/admin/students', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(create.status, 403);
});

test('el Administrador no retira Tutoría ni elimina a un Docente con tutorados', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const directory = await (await request(admin, '/api/admin/staff')).json();
  const tutor = directory.items.find((item) => item.id === 'PER-009');
  assert.ok(tutor);
  const payload = { documentType: tutor.documentType || 'DNI', document: tutor.document, name: tutor.name, email: tutor.email, role: 'Docente', program: tutor.program, state: 'Activo', roles: ['docente'] };
  const removeTutorMode = await request(admin, `/api/admin/staff/${tutor.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  assert.equal(removeTutorMode.status, 409);
  const removeAccount = await request(admin, `/api/admin/staff/${tutor.id}`, { method: 'DELETE' });
  assert.equal(removeAccount.status, 409);
});
test('el Administrador gestiona el catálogo de programas sin dejar relaciones huérfanas', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const catalog = await (await request(admin, '/api/admin/programs')).json();
  const linkedProgram = catalog.items.find((item) => item.linkedRecords > 0);
  const protectedUpdate = await request(admin, `/api/admin/programs/${linkedProgram.id}`, { method: 'PUT', body: JSON.stringify({ name: linkedProgram.name, state: 'Inactivo' }) });
  assert.equal(protectedUpdate.status, 409);
  const created = await request(admin, '/api/admin/programs', { method: 'POST', body: JSON.stringify({ name: 'Programa temporal de prueba' }) });
  const createdBody = await created.json();
  assert.equal(created.status, 201);
  assert.equal(createdBody.item.linkedRecords, 0);
  const updated = await request(admin, `/api/admin/programs/${createdBody.item.id}`, { method: 'PUT', body: JSON.stringify({ name: 'Programa temporal actualizado', state: 'Inactivo' }) });
  assert.equal(updated.status, 200);
  const removed = await request(admin, `/api/admin/programs/${createdBody.item.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
});

test('las rutas API inexistentes responden JSON 404', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const response = await request(admin, '/api/ruta-inexistente');
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
});

test('las páginas y recursos inexistentes responden 404 sin mostrar el acceso', async () => {
  const response = await fetch(`${baseUrl}/pagina-que-no-existe`);
  const html = await response.text();
  assert.equal(response.status, 404);
  assert.match(html, /Esta página no existe/);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});

test('los recursos estáticos usan validación de caché y las API no se almacenan', async () => {
  const stylesheet = await fetch(`${baseUrl}/styles.css`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('cache-control'), /max-age/);
  assert.ok(stylesheet.headers.get('etag'));
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.headers.get('cache-control'), 'no-store, max-age=0');
});

test('una cookie de sesión manipulada es rechazada', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  // Cambiar solo los bits de relleno produce la misma firma binaria con una codificación no canónica.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const lastIndex = alphabet.indexOf(admin.cookie.at(-1));
  assert.ok(lastIndex >= 0);
  const tampered = `${admin.cookie.slice(0, -1)}${alphabet[lastIndex ^ 1]}`;
  const response = await fetch(`${baseUrl}/api/session`, { headers: { cookie: tampered } });
  assert.equal(response.status, 401);
});

test('las operaciones de escritura rechazan solicitudes sin token CSRF', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const response = await fetch(`${baseUrl}/api/admin/programs`, { method: 'POST', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'No debe crearse' }) });
  assert.equal(response.status, 403);
});

test('el inicio de sesión limita intentos repetidos por cuenta e IP', async () => {
  for (let index = 0; index < 5; index += 1) {
    const response = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'intento.invalido@siga.edu.pe', password: 'Incorrecta2026!', role: 'docente' }) });
    assert.equal(response.status, 401);
  }
  const blocked = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'intento.invalido@siga.edu.pe', password: 'Incorrecta2026!', role: 'docente' }) });
  assert.equal(blocked.status, 429);
});

test('los reportes administrativos usan la asistencia registrada por el Docente', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const response = await request(admin, '/api/admin/reports');
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.equal(report.byState.find((item) => item.state === 'Presente').total, 4);
  assert.equal(report.byState.find((item) => item.state === 'Tardanza').total, 2);
});

test('el Docente debe enviar una sola asistencia por cada estudiante activo', async () => {
  const teacher = await login('docente@siga.edu.pe', 'SigaDocente2026!', 'docente');
  const classesResponse = await request(teacher, '/api/teacher/classes');
  const classes = (await classesResponse.json()).items;
  const studentsResponse = await request(teacher, '/api/teacher/students');
  const students = (await studentsResponse.json()).items;
  const today = (await (await request(teacher, '/api/teacher/dashboard')).json()).today;
  const duplicate = [{ studentId: students[0].id, state: 'Presente' }, { studentId: students[0].id, state: 'Ausente' }];
  const response = await request(teacher, '/api/teacher/attendance', { method: 'PUT', body: JSON.stringify({ classId: classes[0].id, date: today, entries: duplicate }) });
  assert.equal(response.status, 400);
});

test('el Docente solo puede modificar datos personales autorizados', async () => {
  const teacher = await login('docente@siga.edu.pe', 'SigaDocente2026!', 'docente');
  const response = await request(teacher, '/api/account', { method: 'PUT', body: JSON.stringify({ name: 'Nombre alterado', email: 'otro@example.com', phone: '999111222', bio: 'Perfil actualizado' }) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.user.name, 'Rosa Verónica Agurto Ortiz');
  assert.equal(result.user.email, 'docente@siga.edu.pe');
  assert.equal(result.user.phone, '999111222');
});

test('el Docente consulta solicitudes creadas por estudiantes de sus clases', async () => {
  const student = await login('valeria.estudiante@siga.edu.pe', 'SigaValeria2026!', 'estudiante');
  const today = (await (await request(student, '/api/student/dashboard')).json()).today;
  const requestedDate = new Date(`${today}T12:00:00-05:00`);
  requestedDate.setDate(requestedDate.getDate() + 1);
  const tomorrow = requestedDate.toISOString().slice(0, 10);
  const created = await request(student, '/api/student/exits', { method: 'POST', body: JSON.stringify({ type: 'Temporal', reason: 'Control médico de prueba', date: tomorrow, time: '11:30' }) });
  const item = (await created.json()).item;
  assert.equal(created.status, 201);
  const teacher = await login('docente@siga.edu.pe', 'SigaDocente2026!', 'docente');
  const exits = await request(teacher, '/api/teacher/exits');
  const body = await exits.json();
  assert.equal(exits.status, 200);
  assert.ok(body.items.some((record) => record.id === item.id && record.source === 'Estudiante'));
});

test('Coordinación autoriza una solicitud real de su programa y genera QR', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const dashboard = await request(coordinator, '/api/coordinator/dashboard');
  const today = (await dashboard.json()).today;
  const requestedDate = new Date(`${today}T12:00:00-05:00`);
  requestedDate.setDate(requestedDate.getDate() + 1);
  const tomorrow = requestedDate.toISOString().slice(0, 10);
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const limaClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const [clockHour, clockMinute] = limaClock.split(':').map(Number);
  const currentMinutes = clockHour * 60 + clockMinute;
  const previousTestMinutes = 18 * 60 + 30;
  const safeMinutes = Math.abs(currentMinutes - previousTestMinutes) <= 60 ? currentMinutes - 120 : currentMinutes;
  const currentTime = `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`;
  const created = await request(student, '/api/student/exits', { method: 'POST', body: JSON.stringify({ type: 'Temporal', reason: 'Cita médica programada', date: tomorrow, time: currentTime }) });
  const createdItem = (await created.json()).item;
  assert.equal(created.status, 201);
  const exitsResponse = await request(coordinator, '/api/coordinator/exits');
  const exits = await exitsResponse.json();
  const pending = exits.items.find((item) => item.id === createdItem.id);
  assert.ok(pending);
  const approve = await request(coordinator, `/api/coordinator/exits/${pending.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Autorizada' }) });
  const result = await approve.json();
  assert.equal(approve.status, 200);
  assert.equal(result.item.status, 'Autorizada');
  assert.match(result.item.qrCode, new RegExp(`^SIGA-${createdItem.id}-`));
});

test('el Coordinador solo obtiene estudiantes e incidencias de su programa', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const studentsResponse = await request(coordinator, '/api/coordinator/students');
  const students = await studentsResponse.json();
  assert.equal(studentsResponse.status, 200);
  assert.ok(students.items.length > 0);
  assert.ok(students.items.every((item) => item.program === students.program));
  const permanenceResponse = await request(coordinator, '/api/coordinator/permanence');
  const permanence = await permanenceResponse.json();
  assert.ok(permanence.items.every((item) => item.program === permanence.program));
});

test('el Coordinador registra estudiantes y crea su cuenta dentro de su programa', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const created = await request(coordinator, '/api/coordinator/students', { method: 'POST', body: JSON.stringify({ documentType: 'CE', document: 'CE70998877', name: 'Estudiante Nuevo SIGA', email: 'nuevo.estudiante@siga.edu.pe', semester: 'II', group: 'II-B', program: 'Enfermería Técnica', state: 'Activo', tutorId: '', password: 'NuevoSiga2026!' }) });
  const result = await created.json();
  assert.equal(created.status, 201);
  assert.equal(result.item.documentType, 'CE');
  assert.equal(result.item.document, 'CE70998877');
  assert.equal(result.item.program, 'Mecatrónica Automotriz');
  assert.equal(result.item.group, 'II-B');
  const studentSession = await login('nuevo.estudiante@siga.edu.pe', 'NuevoSiga2026!', 'estudiante');
  assert.equal(studentSession.user.role, 'estudiante');

  const invalidDni = await request(coordinator, '/api/coordinator/students', { method: 'POST', body: JSON.stringify({ documentType: 'DNI', document: 'ABC12345', name: 'Documento Inválido', email: 'documento.invalido@siga.edu.pe', semester: 'II', group: 'II-B', state: 'Activo', tutorId: '', password: 'NuevoSiga2026!' }) });
  assert.equal(invalidDni.status, 400);
  assert.match((await invalidDni.json()).error, /DNI debe contener exactamente 8 dígitos/);
});

test('la carga Excel del Coordinador valida el programa e importa cuentas estudiantiles', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const invalidWorkbook = new ExcelJS.Workbook();
  const invalidSheet = invalidWorkbook.addWorksheet('Estudiantes');
  invalidSheet.addRow(['Tipo de documento','Documento','Nombres','Correo','Semestre','Grupo','Programa','Estado','Contraseña inicial']);
  invalidSheet.addRow(['DNI','70110000','Fuera de Programa','fuera@siga.edu.pe','III','III-A','Enfermería Técnica','Activo','Importado2026!']);
  const invalidForm = new FormData();
  invalidForm.append('file', new Blob([await invalidWorkbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'estudiantes.xlsx');
  const rejected = await request(coordinator, '/api/coordinator/students/import', { method: 'POST', body: invalidForm });
  assert.equal(rejected.status, 422);
  assert.match((await rejected.json()).errors[0].message, /Solo puede importar estudiantes de Mecatrónica Automotriz/);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Estudiantes');
  sheet.addRow(['Tipo de documento','Documento','Nombres','Correo','Semestre','Grupo','Programa','Estado','Contraseña inicial']);
  sheet.addRow(['CE','CE70112233','Importado SIGA','importado@siga.edu.pe','III','III-A','Mecatrónica Automotriz','Activo','Importado2026!']);
  const form = new FormData();
  form.append('file', new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'estudiantes.xlsx');
  const imported = await request(coordinator, '/api/coordinator/students/import', { method: 'POST', body: form });
  const result = await imported.json();
  assert.equal(imported.status, 200);
  assert.equal(result.imported, 1);
  const importedStudents = await (await request(coordinator, '/api/coordinator/students')).json();
  const importedStudent = importedStudents.items.find((item) => item.email === 'importado@siga.edu.pe');
  assert.equal(importedStudent.documentType, 'CE');
  assert.equal(importedStudent.document, 'CE70112233');
  const studentSession = await login('importado@siga.edu.pe', 'Importado2026!', 'estudiante');
  assert.equal(studentSession.user.role, 'estudiante');
});

test('el Coordinador puede registrar y cerrar incidencias con auditoría', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const students = await (await request(coordinator, '/api/coordinator/students')).json();
  const create = await request(coordinator, '/api/coordinator/permanence', { method: 'POST', body: JSON.stringify({ studentId: students.items[0].id, date: '2026-10-11', type: 'Académica', description: 'Seguimiento de evaluación pendiente.', responsible: 'Coordinación académica', evidence: 'Acta de seguimiento', status: 'Abierta' }) });
  const incident = (await create.json()).item;
  assert.equal(create.status, 201);
  const close = await request(coordinator, `/api/coordinator/permanence/${incident.id}/state`, { method: 'PATCH', body: JSON.stringify({ state: 'Cerrada', note: 'Caso atendido y verificado.' }) });
  assert.equal(close.status, 200);
  const list = await (await request(coordinator, `/api/coordinator/permanence?search=${incident.id}`)).json();
  assert.equal(list.items[0].status, 'Cerrada');
  assert.ok(list.items[0].history.length >= 2);
});

test('la cuenta multirol cambia entre Coordinador y Docente sin iniciar otra sesión', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const switchToTeacher = await request(coordinator, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'docente' }) });
  assert.equal(switchToTeacher.status, 200);
  const classes = await request(coordinator, '/api/teacher/classes');
  const classData = await classes.json();
  assert.equal(classes.status, 200);
  assert.ok(classData.items.some((item) => item.id === 'CLS-003'));
  const switchBack = await request(coordinator, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'coordinador' }) });
  assert.equal(switchBack.status, 200);
});

test('el Docente con función de tutor solo consulta estudiantes expresamente asignados', async () => {
  const tutor = await loginTutorMode();
  const response = await request(tutor, '/api/tutor/students');
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.tutor === 'Luis Torres Peña'));
  assert.ok(result.items.some((item) => item.id === 'EST-004'));
  const outsideScope = await request(tutor, '/api/tutor/students/EST-001');
  assert.equal(outsideScope.status, 404);
});

test('la cuenta Docente con tutoría alterna ambos modos y conserva su alcance', async () => {
  const tutor = await loginTutorMode();
  assert.ok(tutor.user.roles.includes('docente'));
  const switchToTeacher = await request(tutor, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'docente' }) });
  assert.equal(switchToTeacher.status, 200);
  const classesResponse = await request(tutor, '/api/teacher/classes');
  const classes = await classesResponse.json();
  assert.equal(classesResponse.status, 200);
  assert.deepEqual(classes.items.map((item) => item.id), ['CLS-004']);
  const switchBack = await request(tutor, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'tutor' }) });
  assert.equal(switchBack.status, 200);
  const students = await (await request(tutor, '/api/tutor/students')).json();
  assert.deepEqual(students.items.map((item) => item.id), ['EST-004']);
});

test('el Docente en modo Tutor registra permanencia con auditoría y no cierra sin sustento', async () => {
  const tutor = await loginTutorMode();
  const form = new FormData();
  form.append('studentId', 'EST-004');
  form.append('date', '2026-10-12');
  form.append('type', 'Asistencia');
  form.append('priority', 'Alta');
  form.append('description', 'Ausencias reiteradas que requieren seguimiento de Tutoría.');
  form.append('actions', 'Contacto preventivo con el estudiante.');
  form.append('responsible', 'Luis Torres Peña');
  form.append('status', 'Abierto');
  const created = await request(tutor, '/api/tutor/cases', { method: 'POST', body: form });
  const createdBody = await created.json();
  assert.equal(created.status, 201);
  const rejectedClose = await request(tutor, `/api/tutor/cases/${createdBody.item.id}/state`, { method: 'PATCH', body: JSON.stringify({ status: 'Cerrado', comment: '' }) });
  assert.equal(rejectedClose.status, 400);
  const closed = await request(tutor, `/api/tutor/cases/${createdBody.item.id}/state`, { method: 'PATCH', body: JSON.stringify({ status: 'Cerrado', comment: 'Se verificó el retorno regular y se informó al apoderado.' }) });
  assert.equal(closed.status, 200);
  const list = await (await request(tutor, `/api/tutor/cases?search=${createdBody.item.id}`)).json();
  assert.equal(list.items[0].status, 'Cerrado');
  assert.ok(list.items[0].history.some((entry) => entry.action === 'Estado: Cerrado'));
});

test('la cuenta Docente multirol abre y regresa del modo Tutor sin otra sesión', async () => {
  const teacher = await login('docente@siga.edu.pe', 'SigaDocente2026!', 'docente');
  const toTutor = await request(teacher, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'tutor' }) });
  assert.equal(toTutor.status, 200);
  const tutorDashboard = await request(teacher, '/api/tutor/dashboard');
  const tutorData = await tutorDashboard.json();
  assert.equal(tutorDashboard.status, 200);
  assert.ok(tutorData.summary.students > 0);
  const toTeacher = await request(teacher, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'docente' }) });
  assert.equal(toTeacher.status, 200);
  const classes = await request(teacher, '/api/teacher/classes');
  assert.equal(classes.status, 200);
});

test('el Estudiante solo consulta su propia asistencia', async () => {
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const response = await request(student, '/api/student/attendance');
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.student.id, 'EST-003');
  assert.ok(result.rows.every((item) => item.studentId === 'EST-003'));
});

test('el Estudiante consulta únicamente su perfil, clases y tutoría autorizada', async () => {
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const profileResponse = await request(student, '/api/student/profile');
  const profile = await profileResponse.json();
  assert.equal(profileResponse.status, 200);
  assert.equal(profile.student.id, 'EST-003');
  const classes = await (await request(student, '/api/student/classes')).json();
  assert.ok(classes.items.every((item) => item.id === 'CLS-003'));
  const forbidden = await request(student, '/api/admin/students');
  assert.equal(forbidden.status, 403);
});

test('el Estudiante solo actualiza contacto y preferencias autorizadas', async () => {
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const update = await request(student, '/api/student/profile', { method: 'PUT', body: JSON.stringify({ contactEmail: 'diego.contacto@example.com', phone: '999111333', preferences: ['Asistencia','Boletas','No permitida'], program: 'Programa alterado' }) });
  const result = await update.json();
  assert.equal(update.status, 200);
  assert.equal(result.account.contactEmail, 'diego.contacto@example.com');
  const profile = await (await request(student, '/api/student/profile')).json();
  assert.equal(profile.student.program, 'Mecatrónica Automotriz');
  assert.deepEqual(profile.preferences, ['Asistencia','Boletas']);
});

test('el Estudiante envía justificaciones propias con trazabilidad', async () => {
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const today = (await (await request(student, '/api/student/dashboard')).json()).today;
  const created = await request(student, '/api/student/justifications', { method: 'POST', body: JSON.stringify({ type: 'Tardanza', reason: 'Atención médica', description: 'La atención médica ocasionó el retraso registrado.', startDate: today, endDate: today }) });
  const result = await created.json();
  assert.equal(created.status, 201);
  assert.equal(result.item.studentId, 'EST-003');
  assert.equal(result.item.status, 'Enviada');
  const items = await (await request(student, '/api/student/justifications')).json();
  assert.ok(items.items.some((item) => item.id === result.item.id));
});

test('el Estudiante solicita salida pero solo Coordinación genera su QR', async () => {
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const today = (await (await request(student, '/api/student/dashboard')).json()).today;
  const createdResponse = await request(student, '/api/student/exits', { method: 'POST', body: JSON.stringify({ type: 'Temporal', reason: 'Trámite documentario', description: 'Salida para realizar un trámite previamente programado.', date: today, time: '20:00' }) });
  const created = (await createdResponse.json()).item;
  assert.equal(createdResponse.status, 201);
  assert.equal(created.qrCode, '');
  const forbidden = await request(student, `/api/coordinator/exits/${created.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Autorizada' }) });
  assert.equal(forbidden.status, 403);
  const approved = await request(coordinator, `/api/coordinator/exits/${created.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Autorizada' }) });
  assert.equal(approved.status, 200);
  const qr = await request(student, `/api/student/exits/${created.id}/qr.svg`);
  assert.equal(qr.status, 200);
  assert.match(qr.headers.get('content-type'), /image\/svg/);
});

test('el Padre o apoderado solo consulta a sus estudiantes vinculados', async () => {
  const parent = await login('padre@siga.edu.pe', 'SigaPadre2026!', 'padre');
  const dashboardResponse = await request(parent, '/api/parent/dashboard');
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboardResponse.status, 200);
  assert.deepEqual(dashboard.students.map((item) => item.id), ['EST-002']);

  const attendanceResponse = await request(parent, '/api/parent/attendance');
  const attendance = await attendanceResponse.json();
  assert.equal(attendanceResponse.status, 200);
  assert.ok(attendance.rows.every((item) => item.studentId === 'EST-002'));
});

test('el padrón familiar muestra tutor y rechaza estudiantes ajenos', async () => {
  const parent = await login('padre@siga.edu.pe', 'SigaPadre2026!', 'padre');
  const childrenResponse = await request(parent, '/api/parent/children');
  const children = await childrenResponse.json();
  assert.equal(childrenResponse.status, 200);
  assert.deepEqual(children.items.map((item) => item.id), ['EST-002']);
  assert.equal(children.items[0].tutor, 'Carmen Soto Rojas');
  const outsideScope = await request(parent, '/api/parent/attendance?student=EST-001');
  assert.equal(outsideScope.status, 404);
});

test('el Apoderado envía justificaciones solo para un estudiante vinculado', async () => {
  const parent = await login('padre@siga.edu.pe', 'SigaPadre2026!', 'padre');
  const valid = await request(parent, '/api/parent/justifications', {
    method: 'POST',
    body: JSON.stringify({ studentId: 'EST-002', type: 'Ausencia', startDate: '2026-10-18', endDate: '2026-10-18', reason: 'Atención médica', description: 'Consulta médica informada oportunamente a Tutoría.', contact: '987654321' }),
  });
  const created = await valid.json();
  assert.equal(valid.status, 201);
  assert.equal(created.item.status, 'Enviada');
  assert.equal(created.item.studentId, 'EST-002');

  const forbidden = await request(parent, '/api/parent/justifications', {
    method: 'POST',
    body: JSON.stringify({ studentId: 'EST-001', type: 'Ausencia', startDate: '2026-10-18', endDate: '2026-10-18', reason: 'Atención médica', description: 'Intento fuera del vínculo familiar registrado.', contact: '987654321' }),
  });
  assert.equal(forbidden.status, 404);
});

test('el Apoderado consulta su QR pero no puede decidir sobre salidas', async () => {
  const parent = await login('padre@siga.edu.pe', 'SigaPadre2026!', 'padre');
  const exitsResponse = await request(parent, '/api/parent/exits');
  const exits = await exitsResponse.json();
  assert.equal(exitsResponse.status, 200);
  assert.ok(exits.items.length > 0);
  assert.ok(exits.items.every((item) => item.studentId === 'EST-002'));
  assert.ok(exits.items.every((item) => !Object.hasOwn(item, 'qrCode')));
  assert.equal(exits.items.find((item) => item.id === 'SOL-026').hasQr, false);
  const qr = await request(parent, '/api/parent/exits/SOL-026/qr.svg');
  assert.equal(qr.status, 404);
  const foreignQr = await request(parent, '/api/parent/exits/SOL-024/qr.svg');
  assert.equal(foreignQr.status, 404);
  const createExit = await request(parent, '/api/student/exits', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(createExit.status, 403);
  const decideExit = await request(parent, '/api/coordinator/exits/SOL-026', { method: 'PATCH', body: JSON.stringify({ status: 'Autorizada' }) });
  assert.equal(decideExit.status, 403);
});

test('las confirmaciones de reunión y el perfil familiar quedan limitados a la cuenta', async () => {
  const parent = await login('padre@siga.edu.pe', 'SigaPadre2026!', 'padre');
  const confirm = await request(parent, '/api/parent/meetings/REU-002', { method: 'PATCH', body: JSON.stringify({ action: 'Confirmar' }) });
  assert.equal(confirm.status, 409);
  assert.match((await confirm.json()).error, /ya pasó/);
  const foreignMeeting = await request(parent, '/api/parent/meetings/REU-001', { method: 'PATCH', body: JSON.stringify({ action: 'Confirmar' }) });
  assert.equal(foreignMeeting.status, 404);
  const profile = await request(parent, '/api/parent/profile', { method: 'PUT', body: JSON.stringify({ email: 'padre@siga.edu.pe', phone: '999888777', preferences: ['Asistencia','Boletas','No permitida'] }) });
  const profileBody = await profile.json();
  assert.equal(profile.status, 200);
  assert.equal(profileBody.user.phone, '999888777');
  assert.deepEqual(profileBody.preferences, ['Asistencia','Boletas']);
});

test('Vigilancia valida una boleta QR autorizada una sola vez', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const dashboard = await (await request(coordinator, '/api/coordinator/dashboard')).json();
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const createdResponse = await request(student, '/api/student/exits', {
    method: 'POST',
    body: JSON.stringify({ type: 'Temporal', reason: 'Validación segura en control de acceso', date: dashboard.today, time: currentTime }),
  });
  const created = (await createdResponse.json()).item;
  assert.equal(createdResponse.status, 201);

  const approvedResponse = await request(coordinator, `/api/coordinator/exits/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Autorizada' }),
  });
  const approved = (await approvedResponse.json()).item;
  assert.equal(approvedResponse.status, 200);

  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const first = await request(guard, '/api/guard/validate', { method: 'POST', body: JSON.stringify({ code: approved.qrCode }) });
  assert.equal(first.status, 200);
  const repeated = await request(guard, '/api/guard/validate', { method: 'POST', body: JSON.stringify({ code: approved.qrCode }) });
  assert.equal(repeated.status, 409);
});

test('Vigilancia consulta un QR inválido y conserva el intento rechazado', async () => {
  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const lookup = await request(guard, '/api/guard/lookup', { method: 'POST', body: JSON.stringify({ code: 'SIGA-QR-INEXISTENTE', pointOfControl: 'Puerta principal' }) });
  const lookupBody = await lookup.json();
  assert.equal(lookup.status, 200);
  assert.equal(lookupBody.valid, false);
  assert.equal(lookupBody.status, 'No encontrada');
  const history = await (await request(guard, '/api/guard/history?result=Rechazada')).json();
  assert.ok(history.items.some((item) => item.code === 'SIGA-QR-INEXISTENTE'));
});

test('Vigilancia recibe únicamente la información mínima durante una consulta', async () => {
  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const lookup = await request(guard, '/api/guard/lookup', { method: 'POST', body: JSON.stringify({ code: 'SIGA-SOL-026-AUTORIZADA' }) });
  const body = await lookup.json();
  assert.equal(lookup.status, 200);
  assert.equal(body.item.student, 'Valeria Cruz Jiménez');
  assert.equal('document' in body.item, false);
  assert.equal('email' in body.item, false);
});

test('el Vigilante registra incidencias pero no puede decidir autorizaciones', async () => {
  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const incident = await request(guard, '/api/guard/incidents', { method: 'POST', body: JSON.stringify({ studentId: 'EST-003', exitId: 'SOL-TEST', type: 'Identidad no coincidente', description: 'La identidad presentada no coincide con la boleta consultada.', priority: 'Alta', pointOfControl: 'Puerta principal' }) });
  assert.equal(incident.status, 201);
  const forbidden = await request(guard, '/api/coordinator/exits/SOL-026', { method: 'PATCH', body: JSON.stringify({ status: 'Autorizada' }) });
  assert.equal(forbidden.status, 403);
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const visible = await (await request(coordinator, '/api/coordinator/security-incidents')).json();
  assert.ok(visible.items.some((item) => item.studentId === 'EST-003' && item.type === 'Identidad no coincidente'));
});

test('los reportes de Vigilancia consolidan validaciones, rechazos e incidencias', async () => {
  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const response = await request(guard, '/api/guard/reports');
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.ok(report.summary.validated >= 1);
  assert.ok(report.summary.rejected >= 1);
  assert.ok(report.summary.incidents >= 1);
  const workbook = await request(guard, '/api/guard/reports.xlsx');
  assert.equal(workbook.status, 200);
  assert.match(workbook.headers.get('content-type'), /spreadsheet/);
});

test('la política del navegador permite usar la cámara QR solo desde SIGA', async () => {
  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const response = await request(guard, '/pages/vigilante/validar-qr.html');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.doesNotMatch(response.headers.get('permissions-policy'), /camera=\(\)/);
});

test('el Coordinador asigna horarios visibles solo para el Docente y estudiantes matriculados', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const catalogResponse = await request(coordinator, '/api/coordinator/classes');
  const catalog = await catalogResponse.json();
  assert.equal(catalogResponse.status, 200);
  assert.ok(catalog.teachers.length > 0);
  assert.ok(catalog.students.length > 0);
  const planResponse = await request(coordinator, '/api/coordinator/study-plan');
  const plan = await planResponse.json();
  const semester = catalog.students[0].semester;
  const officialUnits = plan.semesters[semester];
  assert.equal(planResponse.status, 200);
  assert.ok(officialUnits.length > 0);
  const invalidUnit = await request(coordinator, '/api/coordinator/classes', { method: 'POST', body: JSON.stringify({ course: 'Curso escrito manualmente', semester, group: catalog.students[0].group || 'I-A', section: 'Z', teacherId: catalog.teachers[0].id, day: 'Sábado', schedule: '20:00–20:30', room: 'Laboratorio 99', modality: 'Presencial', studentIds: [] }) });
  assert.equal(invalidUnit.status, 400);
  const createdResponse = await request(coordinator, '/api/coordinator/classes', { method: 'POST', body: JSON.stringify({ course: officialUnits[0], semester, group: catalog.students[0].group || 'I-A', section: 'A', teacherId: catalog.teachers[0].id, day: 'Lunes', schedule: '18:00–19:30', room: 'Laboratorio 03', modality: 'Presencial', studentIds: [catalog.students[0].id] }) });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201);
  assert.deepEqual(created.item.studentIds, [catalog.students[0].id]);
  assert.equal(created.item.day, 'Lunes');
  assert.equal(created.item.schedule, '18:00–19:30');
  const conflict = await request(coordinator, '/api/coordinator/classes', { method: 'POST', body: JSON.stringify({ course: officialUnits[1] || officialUnits[0], semester, group: catalog.students[0].group || 'I-A', section: 'B', teacherId: catalog.teachers[0].id, day: 'Lunes', schedule: '18:30–19:00', room: 'Laboratorio 09', modality: 'Presencial', studentIds: [] }) });
  assert.equal(conflict.status, 409);
  const teacherMode = await request(coordinator, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'docente' }) });
  assert.equal(teacherMode.status, 200);
  const teacherClasses = await (await request(coordinator, '/api/teacher/classes')).json();
  assert.ok(teacherClasses.items.some((item) => item.id === created.item.id && item.schedule === '18:00–19:30'));
  const coordinatorMode = await request(coordinator, '/api/account/switch-role', { method: 'POST', body: JSON.stringify({ role: 'coordinador' }) });
  assert.equal(coordinatorMode.status, 200);
  const student = await login('estudiante@siga.edu.pe', 'SigaEstudiante2026!', 'estudiante');
  const studentClasses = await (await request(student, '/api/student/classes')).json();
  assert.ok(studentClasses.items.some((item) => item.id === created.item.id));
  const unrelatedStudent = await login('valeria.estudiante@siga.edu.pe', 'SigaValeria2026!', 'estudiante');
  const unrelatedClasses = await (await request(unrelatedStudent, '/api/student/classes')).json();
  assert.ok(!unrelatedClasses.items.some((item) => item.id === created.item.id));
  const removed = await request(coordinator, `/api/coordinator/classes/${created.item.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
});

test('el Administrador controla los vínculos entre apoderados y estudiantes', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const linksResponse = await request(admin, '/api/admin/family-links');
  const links = await linksResponse.json();
  assert.equal(linksResponse.status, 200);
  assert.ok(links.parents.length > 0);
  assert.ok(links.students.length > 0);
  const parent = links.parents[0];
  const student = links.students.at(-1);
  const update = await request(admin, `/api/admin/family-links/${parent.id}`, { method: 'PUT', body: JSON.stringify({ relationship: 'Apoderado verificado', studentIds: [student.id] }) });
  const result = await update.json();
  assert.equal(update.status, 200);
  assert.deepEqual(result.account.studentIds, [student.id]);
});

test('Vigilancia registra ingresos por QR firmado sin exponer el padrón completo', async () => {
  const guard = await login('vigilante@siga.edu.pe', 'SigaVigilante2026!', 'vigilante');
  const student = await login('valeria.estudiante@siga.edu.pe', 'SigaValeria2026!', 'estudiante');
  const credentialResponse = await request(student, '/api/student/access-qr');
  const credential = await credentialResponse.json();
  assert.equal(credentialResponse.status, 200);
  assert.match(credential.code, /^SIGA-ACCESS\./);
  const qrAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const alternate = qrAlphabet[qrAlphabet.indexOf(credential.code.at(-1)) ^ 1];
  const nonCanonical = `${credential.code.slice(0, -1)}${alternate}`;
  const nonCanonicalResponse = await request(guard, '/api/guard/access-scan', { method: 'POST', body: JSON.stringify({ code: nonCanonical, pointOfControl: 'Puerta principal' }) });
  assert.equal(nonCanonicalResponse.status, 400);
  const rejected = await request(guard, '/api/guard/access-scan', { method: 'POST', body: JSON.stringify({ code: `${credential.code}alterado`, pointOfControl: 'Puerta principal' }) });
  assert.equal(rejected.status, 400);
  const entry = await request(guard, '/api/guard/access-scan', { method: 'POST', body: JSON.stringify({ code: credential.code, pointOfControl: 'Puerta principal' }) });
  const entryBody = await entry.json();
  assert.equal(entry.status, 201);
  assert.equal(entryBody.movement.type, 'Entrada');
  const movementsResponse = await request(guard, '/api/guard/access-movements');
  const movements = await movementsResponse.json();
  assert.equal(movementsResponse.status, 200);
  assert.equal(movements.entryMethod, 'unified-qr');
  assert.equal(movements.policy.authorizedTicket, 'Retiros especiales autorizados por Coordinación');
  assert.ok(movements.items.some((item) => item.type === 'Entrada' && item.student === credential.student.name && item.source === 'QR diario · acceso ordinario'));
  assert.ok(!movements.items.some((item) => item.document === credential.student.id));
  const duplicate = await request(guard, '/api/guard/access-scan', { method: 'POST', body: JSON.stringify({ code: credential.code, pointOfControl: 'Puerta principal' }) });
  assert.equal(duplicate.status, 409);
  const incidents = await request(guard, '/api/guard/incidents');
  const scoped = await incidents.json();
  assert.deepEqual(scoped.students, []);
});

test('un docente de empleabilidad importado aparece en los programas autorizados', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const template = await request(admin, '/api/admin/templates/teachers');
  assert.equal(template.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
  const sheet = workbook.worksheets[0];
  sheet.getCell('K6').value = 'Programa adicional 1';
  sheet.getRow(7).values = ['DNI','70118875','Docente','Empleabilidad','empleabilidad.prueba@siga.edu.pe','Enfermería Técnica','No','empleabilidad.prueba','Importado2026!','Activo','Mecatrónica Automotriz'];
  const form = new FormData();
  form.append('file', new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'docentes.xlsx');
  const imported = await request(admin, '/api/admin/import/teachers', { method: 'POST', body: form });
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).imported, 1);
  const staff = await (await request(admin, '/api/admin/staff?role=Docente')).json();
  const teacher = staff.items.find((item) => item.email === 'empleabilidad.prueba@siga.edu.pe');
  assert.deepEqual(teacher.additionalPrograms, ['Mecatrónica Automotriz']);
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const classes = await (await request(coordinator, '/api/coordinator/classes')).json();
  assert.ok(classes.teachers.some((item) => item.id === teacher.accountId));
  const teacherSession = await login('empleabilidad.prueba@siga.edu.pe', 'Importado2026!', 'docente');
  const teacherClasses = await (await request(teacherSession, '/api/teacher/classes')).json();
  assert.equal(teacherClasses.items.length, 0);
});
test('la carga de empleabilidad acepta el Excel anterior y limita el acceso a clases asignadas', async () => {
  const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
  const template = await request(admin, '/api/admin/templates/teachers');
  assert.equal(template.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
  const sheet = workbook.worksheets[0];
  sheet.getRow(7).values = ['DNI','70118876','Docente','Transversal','transversal.prueba@siga.edu.pe','Empleabilidad','No','transversal.prueba','Importado2026!','Activo'];
  const form = new FormData();
  form.append('file', new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'docentes.xlsx');
  const imported = await request(admin, '/api/admin/import/teachers', { method: 'POST', body: form });
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).imported, 1);
  const staff = await (await request(admin, '/api/admin/staff?role=Docente')).json();
  const teacher = staff.items.find((item) => item.email === 'transversal.prueba@siga.edu.pe');
  assert.equal(teacher.program, 'Empleabilidad');
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const classes = await (await request(coordinator, '/api/coordinator/classes')).json();
  assert.ok(classes.teachers.some((item) => item.id === teacher.accountId));
  const session = await login('transversal.prueba@siga.edu.pe', 'Importado2026!', 'docente');
  const assigned = await (await request(session, '/api/teacher/classes')).json();
  assert.equal(assigned.items.length, 0);
  assert.equal((await request(session, '/api/coordinator/classes')).status, 403);
});
test('piloto Excel de diez estudiantes ficticios conserva datos y rechaza lotes duplicados sin importar parcialmente', async () => {
  const coordinator = await login('coordinador@siga.edu.pe', 'SigaCoordinador2026!', 'coordinador');
  const template = await request(coordinator, '/api/coordinator/students/template');
  assert.equal(template.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
  const sheet = workbook.worksheets[0];
  const expected = Array.from({ length: 10 }, (_, index) => ({
    documentType: index === 1 ? 'CE' : 'DNI',
    document: index === 1 ? 'PRUEBA27100001' : String(12000 + index).padStart(8, '0'),
    name: index === 0 ? 'María Núñez Prueba' : `Estudiante Ficticio Piloto ${index + 1}`,
    email: `piloto.${index + 1}@example.test`,
    semester: ['I', 'II', 'III', 'IV', 'V', 'VI'][index % 6],
    group: `PRUEBA-${index + 1}`,
    program: 'Mecatrónica Automotriz',
    state: index % 2 ? 'Inactivo' : 'Activo',
  }));
  expected.forEach((item, index) => {
    sheet.getRow(index + 7).values = [item.documentType, item.document, item.name, item.email, item.semester, item.group, item.program, item.state, 'SoloPrueba2026!'];
  });
  async function upload(book) {
    const form = new FormData();
    form.append('file', new Blob([await book.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'piloto.xlsx');
    return request(coordinator, '/api/coordinator/students/import', { method: 'POST', body: form });
  }
  const imported = await upload(workbook);
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).imported, 10);
  const roster = await (await request(coordinator, '/api/coordinator/students')).json();
  for (const expectedItem of expected) {
    const actual = roster.items.find((item) => item.email === expectedItem.email);
    assert.ok(actual, `Falta ${expectedItem.email}`);
    for (const [field, value] of Object.entries(expectedItem)) assert.equal(actual[field], value, `${expectedItem.email}: ${field}`);
  }
  const repeated = await upload(workbook);
  assert.equal(repeated.status, 422);
  assert.equal((await repeated.json()).errors.length, 10);
  const mixed = new ExcelJS.Workbook();
  const mixedSheet = mixed.addWorksheet('Estudiantes');
  mixedSheet.addRow(['Tipo de documento','Documento','Nombres','Correo','Semestre','Grupo','Programa','Estado','Contraseña inicial']);
  mixedSheet.addRow(['DNI','00012999','Fila Nueva Ficticia','piloto.nuevo@example.test','I','PRUEBA','Mecatrónica Automotriz','Activo','SoloPrueba2026!']);
  mixedSheet.addRow(['DNI',expected[0].document,'Fila Duplicada Ficticia','piloto.duplicado@example.test','I','PRUEBA','Mecatrónica Automotriz','Activo','SoloPrueba2026!']);
  const rejected = await upload(mixed);
  assert.equal(rejected.status, 422);
  assert.equal((await rejected.json()).validRows, 1);
  const after = await (await request(coordinator, '/api/coordinator/students')).json();
  assert.equal(after.items.some((item) => item.email === 'piloto.nuevo@example.test'), false);
});

const staffRegistrationProfiles = [
  {role:'Administrador', key:'administrador', type:'administrators', institutional:true},
  {role:'Coordinador', key:'coordinador', type:'coordinators'},
  {role:'Docente', key:'docente', type:'teachers'},
  {role:'Padre o apoderado', key:'padre', type:'parents'},
  {role:'Vigilante', key:'vigilante', type:'guards', institutional:true},
];
for (const [index, profile] of staffRegistrationProfiles.entries()) {
  test(`registro y carga Excel de ${profile.role}: creación, validaciones, edición y estado`, async () => {
    const admin = await login('admin@siga.edu.pe', 'SigaAdmin2026!', 'administrador');
    const payload = { documentType:'DNI', document:String(88000000+index), name:`Persona Ficticia ${profile.key}`, email:`crud.${profile.key}@example.test`, username:`crud.${profile.key}`, role:profile.role, program:profile.institutional?'Institucional':'Mecatrónica Automotriz', state:'Activo', password:'PruebaSegura2026!', ...(profile.role==='Vigilante'?{shift:'Mañana'}:{}) };
    const send = (method,url,body) => request(admin,url,{method,body:JSON.stringify(body)});
    const invalid = await send('POST','/api/admin/staff',{...payload,document:'12A45678'});
    assert.equal(invalid.status,400);
    const blank = await send('POST','/api/admin/staff',{...payload,name:''});
    assert.equal(blank.status,400);
    const create = await send('POST','/api/admin/staff',payload);
    assert.equal(create.status,201,`${profile.role}: ${await create.clone().text()}`);
    const item=(await create.json()).item;
    const duplicate=await send('POST','/api/admin/staff',payload); assert.equal(duplicate.status,409);
    const edited=await send('PUT',`/api/admin/staff/${item.id}`,{...payload,password:'',name:`Persona Ficticia Editada ${profile.key}`});
    assert.equal(edited.status,200,`${profile.role}: ${await edited.clone().text()}`);
    const directory=await (await request(admin,'/api/admin/staff')).json();
    assert.equal(directory.items.find(x=>x.id===item.id).name,`Persona Ficticia Editada ${profile.key}`);
    const disabled=await send('PATCH',`/api/admin/staff/${item.id}/state`,{state:'Inactivo'}); assert.equal(disabled.status,200);
    const inactiveLogin=await fetch(`${baseUrl}/api/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:payload.email,password:payload.password,role:profile.key})}); assert.notEqual(inactiveLogin.status,200);
    const enabled=await send('PATCH',`/api/admin/staff/${item.id}/state`,{state:'Activo'}); assert.equal(enabled.status,200);
    const session=await login(payload.email,payload.password,profile.key); assert.equal(session.user.role,profile.key);
    const removed=await request(admin,`/api/admin/staff/${item.id}`,{method:'DELETE'}); assert.equal(removed.status,204);
    const template=await request(admin,`/api/admin/templates/${profile.type}`); assert.equal(template.status,200);
    const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
    const sheet=workbook.worksheets[0]; const common=['DNI',String(88100000+index),'Nombre','Ficticio',`excel.${profile.key}@example.test`];
    const suffix=[`excel.${profile.key}`,'PruebaSegura2026!','Activo'];
    const row=profile.role==='Docente'?[...common,'Mecatrónica Automotriz','Sí',...suffix]:profile.role==='Vigilante'?[...common,...suffix,'Mañana']:profile.institutional?[...common,...suffix]:[...common,'Mecatrónica Automotriz',...suffix];
    sheet.getRow(7).values=row;
    const upload=async()=>{const form=new FormData();form.append('file',new Blob([await workbook.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'prueba.xlsx');return request(admin,`/api/admin/import/${profile.type}`,{method:'POST',body:form});};
    const imported=await upload(); assert.equal(imported.status,200,`${profile.role}: ${await imported.clone().text()}`); assert.equal((await imported.json()).imported,1);
    const newDirectory=await (await request(admin,'/api/admin/staff')).json();
    const importedItem=newDirectory.items.find(x=>x.email===`excel.${profile.key}@example.test`); assert.equal(importedItem.role,profile.role);
    if(profile.role==='Docente') assert.ok(importedItem.roles.includes('tutor'));
    const repeated=await upload(); assert.equal(repeated.status,422);
  });
}

test('registro de estudiante: edición, rechazo de duplicados, estado y eliminación aislada', async()=>{
  const coordinator=await login('coordinador@siga.edu.pe','SigaCoordinador2026!','coordinador');
  const data={documentType:'CE',document:'PRUEBA99112233',name:'Estudiante Ficticio CRUD',email:'crud.estudiante@example.test',semester:'I',group:'I-TEST',state:'Activo',password:'PruebaSegura2026!'};
  const send=(method,url,body)=>request(coordinator,url,{method,body:JSON.stringify(body)});
  const invalid=await send('POST','/api/coordinator/students',{...data,document:'CORTO'});assert.equal(invalid.status,400);
  const create=await send('POST','/api/coordinator/students',data);assert.equal(create.status,201);
  const student=(await create.json()).item;
  assert.equal((await send('POST','/api/coordinator/students',data)).status,409);
  const edit=await send('PUT',`/api/coordinator/students/${student.id}`,{...student,name:'Estudiante Ficticio Editado'});assert.equal(edit.status,200);
  const off=await send('PATCH',`/api/coordinator/students/${student.id}/state`,{state:'Inactivo'});assert.equal(off.status,200);
  const on=await send('PATCH',`/api/coordinator/students/${student.id}/state`,{state:'Activo'});assert.equal(on.status,200);
  await login(data.email,data.password,'estudiante');
  assert.equal((await request(coordinator,`/api/coordinator/students/${student.id}`,{method:'DELETE'})).status,204);
});
