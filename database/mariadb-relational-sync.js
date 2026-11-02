'use strict';

const crypto = require('node:crypto');
const { protectDeterministic } = require('./data-protection');

const roleDefinitions = [
  ['administrador', 'Administrador', 'Configuración institucional, personal, programas, seguridad y reportes.'],
  ['docente', 'Docente', 'Clases, estudiantes asignados, asistencia, boletas y reportes docentes.'],
  ['coordinador', 'Coordinador', 'Gestión académica y permanencia de su programa de estudios.'],
  ['tutor', 'Tutor', 'Función de acompañamiento asignada a una cuenta docente.'],
  ['padre', 'Padre o apoderado', 'Consulta de estudiantes formalmente vinculados.'],
  ['vigilante', 'Vigilante', 'Control físico de ingreso y salida mediante QR.'],
  ['estudiante', 'Estudiante', 'Consulta y gestión de la información académica personal.'],
];

const deletionOrder = [
  'bitacora_auditoria', 'validaciones_salida', 'registros_acceso', 'incidencias_seguridad',
  'avisos', 'notificaciones', 'reuniones', 'mensajes', 'alertas',
  'comentarios_caso_tutoria', 'casos_tutoria', 'historial_incidencias',
  'incidencias_permanencia', 'justificaciones', 'solicitudes_salida',
  'auditoria_asistencia', 'registros_asistencia', 'matriculas_clase', 'clases',
  'vinculos_apoderado_estudiante', 'estudiantes', 'personal',
  'preferencias_notificacion_usuario', 'usuarios_roles', 'usuarios', 'programas', 'roles',
];

const insertOrder = [
  'roles', 'programas', 'usuarios', 'usuarios_roles', 'preferencias_notificacion_usuario',
  'personal', 'estudiantes', 'vinculos_apoderado_estudiante', 'clases', 'matriculas_clase',
  'registros_asistencia', 'auditoria_asistencia', 'solicitudes_salida', 'justificaciones',
  'incidencias_permanencia', 'historial_incidencias', 'casos_tutoria',
  'comentarios_caso_tutoria', 'alertas', 'mensajes', 'reuniones', 'notificaciones',
  'avisos', 'incidencias_seguridad', 'registros_acceso', 'validaciones_salida',
  'bitacora_auditoria',
];

const columns = {
  roles: ['clave_rol', 'nombre', 'descripcion', 'esta_activo'],
  programas: ['programa_id', 'nombre', 'estado'],
  usuarios: ['usuario_id', 'programa_id', 'nombre', 'correo', 'nombre_usuario', 'tipo_documento', 'documento', 'codigo_institucional', 'cargo', 'telefono', 'correo_contacto', 'direccion', 'biografia', 'hash_contrasena', 'archivo_foto', 'estado', 'version_sesion'],
  usuarios_roles: ['usuario_id', 'clave_rol', 'es_principal'],
  preferencias_notificacion_usuario: ['usuario_id', 'clave_preferencia', 'esta_habilitado'],
  personal: ['personal_id', 'usuario_id', 'programa_id', 'tipo_documento', 'documento', 'nombre', 'correo', 'nombre_cargo', 'nombre_turno', 'punto_control', 'estado'],
  estudiantes: ['estudiante_id', 'usuario_id', 'programa_id', 'tutor_usuario_id', 'tipo_documento', 'documento', 'nombre', 'correo_institucional', 'semestre', 'nombre_grupo', 'estado_matricula'],
  vinculos_apoderado_estudiante: ['apoderado_usuario_id', 'estudiante_id', 'parentesco', 'es_principal', 'estado'],
  clases: ['clase_id', 'programa_id', 'docente_usuario_id', 'nombre_curso', 'nombre_grupo', 'nombre_seccion', 'semestre', 'nombre_aula', 'horario', 'dia_semana', 'modalidad', 'estado'],
  matriculas_clase: ['clase_id', 'estudiante_id', 'estado'],
  registros_asistencia: ['asistencia_id', 'clase_id', 'estudiante_id', 'registrado_por_usuario_id', 'fecha_asistencia', 'estado_asistencia', 'observacion', 'fecha_creacion', 'fecha_actualizacion'],
  auditoria_asistencia: ['auditoria_id', 'asistencia_id', 'modificado_por_usuario_id', 'estado_anterior', 'estado_nuevo', 'motivo', 'fecha_cambio'],
  solicitudes_salida: ['solicitud_salida_id', 'estudiante_id', 'clase_id', 'solicitado_por_usuario_id', 'autorizado_por_usuario_id', 'origen_solicitud', 'tipo_salida', 'motivo', 'descripcion_adicional', 'fecha_solicitada', 'hora_solicitada', 'estado', 'motivo_decision', 'fecha_decision', 'hash_token_qr', 'codigo_qr', 'vigente_desde', 'vigente_hasta', 'fecha_uso', 'fecha_creacion', 'fecha_actualizacion'],
  validaciones_salida: ['validacion_id', 'solicitud_salida_id', 'vigilante_usuario_id', 'estudiante_id', 'punto_control', 'resultado', 'motivo_rechazo', 'fecha_validacion'],
  justificaciones: ['justificacion_id', 'estudiante_id', 'enviado_por_usuario_id', 'revisado_por_usuario_id', 'tipo_asistencia', 'fecha_inicio', 'fecha_fin', 'motivo', 'descripcion', 'informacion_contacto', 'archivo_evidencia', 'nombre_original_evidencia', 'estado', 'observacion', 'fecha_creacion', 'fecha_actualizacion'],
  incidencias_permanencia: ['incidencia_id', 'estudiante_id', 'programa_id', 'creado_por_usuario_id', 'responsable_usuario_id', 'fecha_incidencia', 'tipo_incidencia', 'descripcion', 'archivo_evidencia', 'estado', 'compartido_familia', 'compartido_estudiante', 'fecha_creacion', 'fecha_actualizacion'],
  historial_incidencias: ['historial_id', 'incidencia_id', 'usuario_id', 'nombre_accion', 'estado_anterior', 'estado_nuevo', 'comentario', 'fecha_creacion'],
  casos_tutoria: ['caso_tutoria_id', 'tutor_usuario_id', 'estudiante_id', 'fecha_caso', 'tipo_caso', 'prioridad', 'descripcion', 'acciones_realizadas', 'archivo_evidencia', 'nombre_original_evidencia', 'estado', 'compartido_familia', 'compartido_estudiante', 'proxima_fecha_seguimiento', 'fecha_creacion', 'fecha_actualizacion'],
  comentarios_caso_tutoria: ['comentario_id', 'caso_tutoria_id', 'usuario_id', 'texto_comentario', 'es_evidencia_cierre', 'fecha_creacion'],
  alertas: ['alerta_id', 'estudiante_id', 'usuario_asignado_id', 'creado_por_usuario_id', 'tipo_alerta', 'titulo', 'descripcion', 'prioridad', 'estado', 'accion_realizada', 'fecha_revision', 'fecha_creacion'],
  mensajes: ['mensaje_id', 'remitente_usuario_id', 'estudiante_id', 'asunto', 'cuerpo', 'alcance_destinatario', 'fecha_envio'],
  reuniones: ['reunion_id', 'estudiante_id', 'responsable_usuario_id', 'fecha_reunion', 'hora_reunion', 'modalidad', 'tema', 'participantes', 'acuerdos', 'seguimiento', 'estado', 'fecha_creacion', 'fecha_actualizacion'],
  notificaciones: ['notificacion_id', 'usuario_id', 'estudiante_id', 'titulo', 'mensaje', 'tipo_notificacion', 'esta_leida', 'fecha_creacion', 'fecha_lectura'],
  avisos: ['aviso_id', 'programa_id', 'estudiante_id', 'creado_por_usuario_id', 'titulo', 'mensaje', 'audiencia', 'fecha_publicacion', 'fecha_expiracion'],
  incidencias_seguridad: ['incidencia_seguridad_id', 'estudiante_id', 'solicitud_salida_id', 'creado_por_usuario_id', 'tipo_incidencia', 'descripcion', 'prioridad', 'archivo_evidencia', 'punto_control', 'estado', 'fecha_creacion', 'fecha_actualizacion'],
  registros_acceso: ['registro_acceso_id', 'vigilante_usuario_id', 'estudiante_id', 'punto_control', 'tipo_movimiento', 'fecha_registro'],
  bitacora_auditoria: ['bitacora_id', 'usuario_id', 'clave_rol', 'nombre_entidad', 'id_publico_entidad', 'nombre_accion', 'detalle', 'direccion_ip', 'agente_usuario', 'fecha_creacion'],
};

const primaryKeys = {
  roles: ['clave_rol'],
  programas: ['programa_id'],
  usuarios: ['usuario_id'],
  usuarios_roles: ['usuario_id', 'clave_rol'],
  preferencias_notificacion_usuario: ['usuario_id', 'clave_preferencia'],
  personal: ['personal_id'],
  estudiantes: ['estudiante_id'],
  vinculos_apoderado_estudiante: ['apoderado_usuario_id', 'estudiante_id'],
  clases: ['clase_id'],
  matriculas_clase: ['clase_id', 'estudiante_id'],
  registros_asistencia: ['asistencia_id'],
  auditoria_asistencia: ['auditoria_id'],
  solicitudes_salida: ['solicitud_salida_id'],
  justificaciones: ['justificacion_id'],
  incidencias_permanencia: ['incidencia_id'],
  historial_incidencias: ['historial_id'],
  casos_tutoria: ['caso_tutoria_id'],
  comentarios_caso_tutoria: ['comentario_id'],
  alertas: ['alerta_id'],
  mensajes: ['mensaje_id'],
  reuniones: ['reunion_id'],
  notificaciones: ['notificacion_id'],
  avisos: ['aviso_id'],
  incidencias_seguridad: ['incidencia_seguridad_id'],
  registros_acceso: ['registro_acceso_id'],
  validaciones_salida: ['validacion_id'],
  bitacora_auditoria: ['bitacora_id'],
};

const protectedColumns = {
  usuarios: ['nombre', 'correo', 'nombre_usuario', 'documento', 'codigo_institucional', 'telefono', 'correo_contacto', 'direccion', 'biografia'],
  personal: ['documento', 'nombre', 'correo'],
  estudiantes: ['documento', 'nombre', 'correo_institucional'],
  registros_asistencia: ['observacion'],
  auditoria_asistencia: ['motivo'],
  solicitudes_salida: ['motivo', 'descripcion_adicional', 'motivo_decision', 'codigo_qr'],
  justificaciones: ['motivo', 'descripcion', 'informacion_contacto', 'nombre_original_evidencia', 'observacion'],
  incidencias_permanencia: ['descripcion'],
  historial_incidencias: ['comentario'],
  casos_tutoria: ['descripcion', 'acciones_realizadas', 'nombre_original_evidencia'],
  comentarios_caso_tutoria: ['texto_comentario'],
  alertas: ['titulo', 'descripcion', 'accion_realizada'],
  mensajes: ['asunto', 'cuerpo'],
  reuniones: ['tema', 'participantes', 'acuerdos', 'seguimiento'],
  notificaciones: ['titulo', 'mensaje'],
  avisos: ['titulo', 'mensaje'],
  incidencias_seguridad: ['descripcion'],
  bitacora_auditoria: ['detalle', 'direccion_ip', 'agente_usuario'],
};

function protectProjectedRows(rows) {
  for (const [table, names] of Object.entries(protectedColumns)) {
    const indexes = names.map((name) => [name, columns[table].indexOf(name)]).filter(([, index]) => index >= 0);
    rows[table] = rows[table].map((row) => {
      const protectedRow = [...row];
      for (const [name, index] of indexes) protectedRow[index] = protectDeterministic(protectedRow[index], `${table}.${name}`);
      return protectedRow;
    });
  }
  return rows;
}

function list(state, key) {
  return Array.isArray(state?.[key]) ? state[key] : [];
}

function nullable(value) {
  const result = String(value ?? '').trim();
  return result || null;
}

function flag(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true' ? 1 : 0;
}

function dateOnly(value) {
  const text = nullable(value);
  if (!text) return null;
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function timeOnly(value) {
  const text = nullable(value);
  if (!text) return null;
  const match = text.match(/^(\d{2}:\d{2})(?::\d{2})?/);
  return match ? `${match[1]}:00` : null;
}

function dateTime(value, fallback) {
  const candidate = nullable(value);
  const parsed = candidate ? new Date(candidate) : new Date(fallback);
  if (Number.isNaN(parsed.getTime())) return dateTime(fallback, Date.now());
  return parsed.toISOString().replace('T', ' ').replace('Z', '');
}

function stableId(prefix, item, index) {
  if (nullable(item?.id)) return String(item.id).slice(0, 100);
  const digest = crypto.createHash('sha256').update(`${prefix}:${index}:${JSON.stringify(item)}`).digest('hex').slice(0, 32);
  return `${prefix}-${digest}`;
}

function allowed(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function projectRelationalState(state) {
  const generatedAt = new Date().toISOString();
  const rows = Object.fromEntries(Object.keys(columns).map((table) => [table, []]));
  rows.roles = roleDefinitions.map(([key, name, description]) => [key, name, description, 1]);

  const programs = list(state, 'programs').filter((item) => nullable(item.id) && nullable(item.name));
  const programByName = new Map(programs.map((item) => [String(item.name), String(item.id)]));
  rows.programas = programs.map((item) => [item.id, item.name, allowed(item.state, ['Activo', 'Inactivo'], 'Activo')]);

  const accounts = list(state, 'accounts').filter((item) => nullable(item.id) && nullable(item.email) && nullable(item.passwordHash));
  const accountIds = new Set(accounts.map((item) => String(item.id)));
  const accountByStudent = new Map(accounts.filter((item) => nullable(item.studentId)).map((item) => [String(item.studentId), String(item.id)]));
  rows.usuarios = accounts.map((item) => [
    item.id, programByName.get(String(item.program || '')) || null, item.name || 'Usuario SIGA', String(item.email).toLowerCase(),
    nullable(item.username), allowed(item.documentType, ['DNI', 'CE'], 'DNI'), nullable(item.document),
    nullable(item.institutionalCode), nullable(item.position), nullable(item.phone), nullable(item.contactEmail),
    nullable(item.address), nullable(item.bio), item.passwordHash, nullable(item.photoFile),
    allowed(item.state, ['Activo', 'Inactivo', 'Bloqueado'], 'Activo'), Number.isInteger(item.sessionVersion) ? item.sessionVersion : 1,
  ]);

  for (const account of accounts) {
    const assigned = [...new Set([account.role, ...(Array.isArray(account.roles) ? account.roles : [])].filter(Boolean))];
    for (const role of assigned) {
      if (!roleDefinitions.some(([key]) => key === role)) continue;
      rows.usuarios_roles.push([account.id, role, role === account.role ? 1 : 0]);
    }
    for (const preference of [...new Set(Array.isArray(account.notificationPreferences) ? account.notificationPreferences : [])]) {
      if (nullable(preference)) rows.preferencias_notificacion_usuario.push([account.id, String(preference), 1]);
    }
  }

  const staff = list(state, 'staff').filter((item) => nullable(item.id) && nullable(item.document) && nullable(item.email));
  const staffById = new Map(staff.map((item) => [String(item.id), item]));
  rows.personal = staff.map((item) => [
    item.id, accountIds.has(String(item.accountId)) ? item.accountId : null,
    programByName.get(String(item.program || '')) || null, allowed(item.documentType, ['DNI', 'CE'], 'DNI'),
    item.document, item.name || 'Personal SIGA', String(item.email).toLowerCase(), item.role || 'Docente',
    nullable(item.shift), nullable(item.pointOfControl), allowed(item.state, ['Activo', 'Inactivo'], 'Activo'),
  ]);

  const students = list(state, 'students').filter((item) => nullable(item.id) && programByName.has(String(item.program || '')));
  const studentIds = new Set(students.map((item) => String(item.id)));
  const tutorAccount = (student) => {
    const tutor = staffById.get(String(student.tutorId || ''));
    return tutor && accountIds.has(String(tutor.accountId)) ? String(tutor.accountId) : null;
  };
  rows.estudiantes = students.map((item) => [
    item.id, accountByStudent.get(String(item.id)) || null, programByName.get(String(item.program)), tutorAccount(item),
    allowed(item.documentType, ['DNI', 'CE'], 'DNI'), item.document, item.name || 'Estudiante SIGA',
    String(item.email || '').toLowerCase(), item.semester || 'I', item.group || 'Sin grupo',
    allowed(item.state, ['Activo', 'Inactivo', 'Retirado', 'Egresado'], 'Activo'),
  ]);

  for (const account of accounts.filter((item) => item.role === 'padre')) {
    const linked = [...new Set(Array.isArray(account.studentIds) ? account.studentIds : [])].filter((id) => studentIds.has(String(id)));
    linked.forEach((studentId, index) => rows.vinculos_apoderado_estudiante.push([
      account.id, studentId, nullable(account.relationship) || 'Apoderado', index === 0 ? 1 : 0, 'Activo',
    ]));
  }

  const classes = list(state, 'classes').filter((item) => nullable(item.id) && accountIds.has(String(item.teacherId)) && programByName.has(String(item.program || '')));
  const classIds = new Set(classes.map((item) => String(item.id)));
  rows.clases = classes.map((item) => [
    item.id, programByName.get(String(item.program)), item.teacherId, item.course || 'Unidad didáctica', item.group || 'Sin grupo',
    nullable(item.section), item.semester || 'I', nullable(item.room), item.schedule || 'Por definir', nullable(item.day),
    nullable(item.modality) || 'Presencial', allowed(item.state, ['Activo', 'Inactivo'], 'Activo'),
  ]);
  for (const item of classes) {
    for (const studentId of [...new Set(Array.isArray(item.studentIds) ? item.studentIds : [])]) {
      if (studentIds.has(String(studentId))) rows.matriculas_clase.push([item.id, studentId, 'Activo']);
    }
  }

  const attendance = list(state, 'teacherAttendance').filter((item) => nullable(item.id) && classIds.has(String(item.classId)) && studentIds.has(String(item.studentId)) && accountIds.has(String(item.teacherId)) && dateOnly(item.date));
  const attendanceIds = new Set(attendance.map((item) => String(item.id)));
  rows.registros_asistencia = attendance.map((item) => [
    item.id, item.classId, item.studentId, item.teacherId, dateOnly(item.date),
    allowed(item.state, ['Presente', 'Tardanza', 'Ausente', 'Permiso', 'Retiro'], 'Ausente'),
    nullable(item.observation), dateTime(item.createdAt || item.updatedAt, generatedAt), dateTime(item.updatedAt || item.createdAt, generatedAt),
  ]);
  list(state, 'attendanceAudit').forEach((item, index) => {
    if (!attendanceIds.has(String(item.attendanceId)) || !accountIds.has(String(item.teacherId))) return;
    rows.auditoria_asistencia.push([
      stableId('AUD-ASIS', item, index), item.attendanceId, item.teacherId, nullable(item.previousState), item.nextState || 'Ausente',
      nullable(item.reason), dateTime(item.changedAt || item.date, generatedAt),
    ]);
  });

  const exitRequests = list(state, 'exitRequests').filter((item) => nullable(item.id) && studentIds.has(String(item.studentId)) && dateOnly(item.date));
  const exitIds = new Set(exitRequests.map((item) => String(item.id)));
  const studentAccount = (studentId) => accountByStudent.get(String(studentId)) || null;
  for (const item of exitRequests) {
    const requestedBy = [item.requestedBy, item.teacherId, studentAccount(item.studentId)].find((id) => accountIds.has(String(id)));
    if (!requestedBy) continue;
    const qr = nullable(item.qrCode);
    rows.solicitudes_salida.push([
      item.id, item.studentId, classIds.has(String(item.classId)) ? item.classId : null, requestedBy,
      accountIds.has(String(item.authorizedById)) ? item.authorizedById : null,
      item.source === 'Docente' ? 'Docente' : 'Estudiante', nullable(item.type || item.withdrawalType), item.reason || 'Sin motivo',
      nullable(item.description), dateOnly(item.date), timeOnly(item.time) || '00:00:00',
      allowed(item.status, ['Pendiente', 'En revisión', 'Autorizada', 'Rechazada', 'Usada', 'Vencida', 'Anulada'], 'Pendiente'),
      nullable(item.decisionReason), item.authorizedAt ? dateTime(item.authorizedAt, generatedAt) : null,
      qr ? crypto.createHash('sha256').update(qr).digest() : null, qr,
      item.validFrom ? dateTime(item.validFrom, generatedAt) : null, item.validUntil ? dateTime(item.validUntil, generatedAt) : null,
      item.usedAt ? dateTime(item.usedAt, generatedAt) : null, dateTime(item.createdAt, generatedAt), dateTime(item.updatedAt || item.authorizedAt || item.createdAt, generatedAt),
    ]);
  }

  list(state, 'tutorJustifications').forEach((item) => {
    if (!nullable(item.id) || !studentIds.has(String(item.studentId))) return;
    const sender = accountIds.has(String(item.createdBy)) ? item.createdBy : studentAccount(item.studentId);
    const start = dateOnly(item.startDate || item.date);
    if (!sender || !start) return;
    const status = item.status === 'Derivada a Coordinación' ? 'Derivada' : allowed(item.status, ['Enviada', 'En revisión', 'Aprobada', 'Observada', 'Derivada', 'Rechazada'], 'Enviada');
    rows.justificaciones.push([
      item.id, item.studentId, sender, accountIds.has(String(item.derivedBy)) ? item.derivedBy : null,
      nullable(item.type) || 'Ausencia', start, dateOnly(item.endDate || item.startDate || item.date) || start,
      item.reason || 'Sin motivo', nullable(item.description), nullable(item.contact), nullable(item.evidenceFile),
      nullable(item.evidenceName), status, nullable(item.observation), dateTime(item.createdAt, generatedAt), dateTime(item.updatedAt || item.createdAt, generatedAt),
    ]);
  });

  const incidents = list(state, 'permanenceIncidents').filter((item) => nullable(item.id) && studentIds.has(String(item.studentId)) && programByName.has(String(item.program || '')) && accountIds.has(String(item.createdBy)) && dateOnly(item.date));
  const incidentIds = new Set(incidents.map((item) => String(item.id)));
  rows.incidencias_permanencia = incidents.map((item) => [
    item.id, item.studentId, programByName.get(String(item.program)), item.createdBy,
    accountIds.has(String(item.responsibleId)) ? item.responsibleId : null, dateOnly(item.date), item.type || 'Seguimiento',
    item.description || 'Sin descripción', nullable(item.evidenceFile || item.evidence),
    allowed(item.status, ['Abierta', 'En seguimiento', 'Derivada', 'Atendida', 'Cerrada'], 'Abierta'),
    flag(item.sharedWithFamily), flag(item.sharedWithStudent), dateTime(item.createdAt, generatedAt), dateTime(item.updatedAt || item.createdAt, generatedAt),
  ]);
  list(state, 'coordinatorAudit').forEach((item, index) => {
    if (item.entity !== 'incident' || !incidentIds.has(String(item.entityId)) || !accountIds.has(String(item.userId))) return;
    rows.historial_incidencias.push([
      stableId('HIS-INC', item, index), item.entityId, item.userId, String(item.action || 'Registro').slice(0, 60),
      nullable(item.previousState), nullable(item.nextState), nullable(item.reason || item.comment || item.detail) || 'Sin comentario',
      dateTime(item.date, generatedAt),
    ]);
  });

  const cases = [];
  list(state, 'tutorCases').forEach((item) => {
    if (!nullable(item.id) || !studentIds.has(String(item.studentId))) return;
    const tutor = accountIds.has(String(item.tutorId)) ? item.tutorId : tutorAccount(students.find((student) => String(student.id) === String(item.studentId)) || {});
    if (!tutor) return;
    cases.push(item.id);
    rows.casos_tutoria.push([
      item.id, tutor, item.studentId, dateOnly(item.date) || dateOnly(generatedAt), item.type || 'Seguimiento',
      allowed(item.priority, ['Baja', 'Media', 'Alta', 'Crítica'], 'Media'), item.description || 'Sin descripción',
      nullable(item.actions), nullable(item.evidenceFile), nullable(item.evidenceName),
      allowed(item.status, ['Abierto', 'En seguimiento', 'Derivado', 'Cerrado'], 'Abierto'), flag(item.sharedWithFamily),
      flag(item.sharedWithStudent), dateOnly(item.familyNextStep), dateTime(item.createdAt, generatedAt), dateTime(item.updatedAt || item.createdAt, generatedAt),
    ]);
  });
  const caseIds = new Set(cases.map(String));
  list(state, 'tutorAudit').forEach((item, index) => {
    if (item.entity !== 'case' || !caseIds.has(String(item.entityId)) || !accountIds.has(String(item.userId)) || !nullable(item.detail)) return;
    rows.comentarios_caso_tutoria.push([
      stableId('COM-CASO', item, index), item.entityId, item.userId, item.detail,
      String(item.action || '').toLowerCase().includes('cerr') ? 1 : 0, dateTime(item.date, generatedAt),
    ]);
  });

  list(state, 'tutorAlerts').forEach((item) => {
    if (!nullable(item.id) || !accountIds.has(String(item.tutorId))) return;
    rows.alertas.push([
      item.id, studentIds.has(String(item.studentId)) ? item.studentId : null, item.tutorId, item.tutorId,
      item.type || 'Alerta de tutoría', String(item.title || item.type || 'Alerta de tutoría').slice(0, 180),
      nullable(item.detail), allowed(item.severity, ['Baja', 'Media', 'Alta', 'Crítica'], 'Media'),
      item.derived ? 'Derivada' : (item.reviewed ? 'Revisada' : 'Pendiente'), nullable(item.action),
      item.updatedAt ? dateTime(item.updatedAt, generatedAt) : null, dateTime(item.createdAt, generatedAt),
    ]);
  });

  list(state, 'tutorMessages').forEach((item) => {
    if (!nullable(item.id) || !accountIds.has(String(item.tutorId))) return;
    rows.mensajes.push([item.id, item.tutorId, studentIds.has(String(item.studentId)) ? item.studentId : null, item.subject || 'Mensaje', item.message || '', item.recipients || 'Estudiante', dateTime(item.sentAt || item.date, generatedAt)]);
  });
  list(state, 'tutorMeetings').forEach((item) => {
    if (!nullable(item.id) || !studentIds.has(String(item.studentId))) return;
    const tutor = accountIds.has(String(item.tutorId)) ? item.tutorId : tutorAccount(students.find((student) => String(student.id) === String(item.studentId)) || {});
    if (!tutor || !dateOnly(item.date)) return;
    rows.reuniones.push([
      item.id, item.studentId, tutor, dateOnly(item.date), timeOnly(item.time) || '00:00:00', item.modality === 'Virtual' ? 'Virtual' : 'Presencial',
      item.topic || 'Seguimiento de tutoría', nullable(item.participants), nullable(item.agreements), nullable(item.followUp),
      nullable(item.status) || 'Programada', dateTime(item.createdAt, generatedAt), dateTime(item.updatedAt || item.createdAt, generatedAt),
    ]);
  });

  list(state, 'notifications').forEach((item) => {
    if (!nullable(item.id) || !accountIds.has(String(item.userId))) return;
    rows.notificaciones.push([
      item.id, item.userId, studentIds.has(String(item.studentId)) ? item.studentId : null,
      item.title || 'Notificación', item.message || '', nullable(item.type), flag(item.read), dateTime(item.date, generatedAt),
      item.read ? dateTime(item.readAt || item.date, generatedAt) : null,
    ]);
  });
  list(state, 'notices').forEach((item) => {
    if (!nullable(item.id)) return;
    rows.avisos.push([
      item.id, programByName.get(String(item.program || '')) || null, studentIds.has(String(item.studentId)) ? item.studentId : null,
      accountIds.has(String(item.createdBy)) ? item.createdBy : null, item.title || 'Aviso', item.message || '',
      item.audience || 'Institucional', dateTime(item.date, generatedAt), item.expiresAt ? dateTime(item.expiresAt, generatedAt) : null,
    ]);
  });

  list(state, 'guardIncidents').forEach((item) => {
    if (!nullable(item.id) || !accountIds.has(String(item.createdBy))) return;
    rows.incidencias_seguridad.push([
      item.id, studentIds.has(String(item.studentId)) ? item.studentId : null, exitIds.has(String(item.exitId)) ? item.exitId : null,
      item.createdBy, item.type || 'Incidencia', item.description || 'Sin descripción',
      allowed(item.priority, ['Baja', 'Media', 'Alta', 'Crítica'], 'Media'), nullable(item.evidenceFile),
      nullable(item.pointOfControl) || 'Puerta principal', allowed(item.status, ['Abierta', 'En revisión', 'Cerrada'], 'Abierta'),
      dateTime(item.date, generatedAt), dateTime(item.updatedAt || item.date, generatedAt),
    ]);
  });
  list(state, 'guardAccessEntries').forEach((item) => {
    if (!nullable(item.id) || !accountIds.has(String(item.guardId)) || !studentIds.has(String(item.studentId))) return;
    rows.registros_acceso.push([item.id, item.guardId, item.studentId, nullable(item.pointOfControl) || 'Puerta principal', item.type === 'Salida' ? 'Salida' : 'Entrada', dateTime(item.date, generatedAt)]);
  });
  list(state, 'exitValidations').forEach((item) => {
    if (!nullable(item.id) || !accountIds.has(String(item.guardId))) return;
    const exit = exitRequests.find((candidate) => String(candidate.id) === String(item.exitId));
    rows.validaciones_salida.push([
      item.id, exitIds.has(String(item.exitId)) ? item.exitId : null, item.guardId,
      exit && studentIds.has(String(exit.studentId)) ? exit.studentId : null, nullable(item.pointOfControl) || 'Puerta principal',
      item.result === 'Rechazada' ? 'Rechazada' : 'Validada', nullable(item.reason), dateTime(item.date, generatedAt),
    ]);
  });

  const auditSources = [
    ['attendanceAudit', 'asistencia'], ['coordinatorAudit', 'coordinador'], ['guardAttempts', 'vigilante'],
    ['guardAlertReviews', 'vigilante'], ['tutorAudit', 'tutor'], ['familyAudit', 'padre'],
    ['studentAudit', 'estudiante'], ['adminAudit', 'administrador'], ['securityAudit', 'seguridad'],
  ];
  for (const [collection, role] of auditSources) {
    list(state, collection).forEach((item, index) => {
      const id = stableId(`BIT-${collection}`, item, index);
      const userId = [item.userId, item.guardId, item.tutorId, item.createdBy].find((candidate) => accountIds.has(String(candidate))) || null;
      rows.bitacora_auditoria.push([
        id, userId, role, String(item.entity || item.type || collection).slice(0, 80),
        nullable(item.entityId || item.exitId || item.studentId), String(item.action || item.result || item.status || 'Registro').slice(0, 80),
        nullable(item.detail || item.reason || item.comment || item.message), null, null,
        dateTime(item.date || item.updatedAt || item.createdAt, generatedAt),
      ]);
    });
  }
  for (const row of rows.registros_acceso) {
    rows.bitacora_auditoria.push([`BIT-ACCESO-${row[0]}`, row[1], 'vigilante', 'Acceso QR', row[0], row[4], `Acceso ordinario por QR en ${row[3]}`, null, null, row[5]]);
  }
  for (const row of rows.validaciones_salida) {
    rows.bitacora_auditoria.push([`BIT-BOLETA-${row[0]}`, row[2], 'vigilante', 'Boleta QR', row[0], row[5], `Validación de salida en ${row[4]}`, null, null, row[7]]);
  }

  return protectProjectedRows(rows);
}

function canonicalValue(value) {
  if (Buffer.isBuffer(value)) return `buffer:${value.toString('hex')}`;
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (value === undefined) return null;
  return value;
}

function rowKey(table, row) {
  const indexes = primaryKeys[table].map((name) => columns[table].indexOf(name));
  return JSON.stringify(indexes.map((index) => canonicalValue(row[index])));
}

function rowsEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => JSON.stringify(canonicalValue(value)) === JSON.stringify(canonicalValue(right[index])));
}

function rowMap(table, rows) {
  return new Map((rows || []).map((row) => [rowKey(table, row), row]));
}

async function upsertRows(connection, table, tableColumns, rows) {
  if (!rows.length) return;
  const chunkSize = 200;
  const keyColumns = new Set(primaryKeys[table]);
  const updateColumns = tableColumns.filter((name) => !keyColumns.has(name));
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => `(${tableColumns.map(() => '?').join(',')})`).join(',');
    const duplicateClause = updateColumns.length
      ? ` ON DUPLICATE KEY UPDATE ${updateColumns.map((name) => `\`${name}\`=VALUES(\`${name}\`)`).join(',')}`
      : '';
    const ignore = updateColumns.length ? '' : ' IGNORE';
    const sql = `INSERT${ignore} INTO \`${table}\` (${tableColumns.map((name) => `\`${name}\``).join(',')}) VALUES ${placeholders}${duplicateClause}`;
    await connection.query(sql, chunk.flat());
  }
}

async function deleteRows(connection, table, rows) {
  if (!rows.length) return;
  const keys = primaryKeys[table];
  const indexes = keys.map((name) => columns[table].indexOf(name));
  const chunkSize = 100;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const conditions = chunk.map(() => `(${keys.map((name) => `\`${name}\` <=> ?`).join(' AND ')})`).join(' OR ');
    const parameters = chunk.flatMap((row) => indexes.map((index) => row[index]));
    await connection.query(`DELETE FROM \`${table}\` WHERE ${conditions}`, parameters);
  }
}

async function readExistingKeys(connection) {
  const result = {};
  for (const table of insertOrder) {
    const keys = primaryKeys[table];
    const [rows] = await connection.query(`SELECT ${keys.map((name) => `\`${name}\``).join(',')} FROM \`${table}\``);
    const indexes = keys.map((name) => columns[table].indexOf(name));
    result[table] = rows.map((record) => {
      const row = Array(columns[table].length).fill(undefined);
      keys.forEach((name, index) => { row[indexes[index]] = record[name]; });
      return row;
    });
  }
  return result;
}

async function syncRelationalProjection(connection, state, previousProjection = null) {
  const projected = projectRelationalState(state);
  const previous = previousProjection || await readExistingKeys(connection);
  const mutations = {};

  for (const table of deletionOrder) {
    const before = rowMap(table, previous[table]);
    const after = rowMap(table, projected[table]);
    const removed = [...before.entries()].filter(([key]) => !after.has(key)).map(([, row]) => row);
    await deleteRows(connection, table, removed);
    mutations[table] = { insertedOrUpdated: 0, deleted: removed.length };
  }

  for (const table of insertOrder) {
    const before = rowMap(table, previous[table]);
    const changed = projected[table].filter((row) => !rowsEqual(before.get(rowKey(table, row)), row));
    await upsertRows(connection, table, columns[table], changed);
    mutations[table].insertedOrUpdated = changed.length;
  }

  return {
    projected,
    counts: Object.fromEntries(insertOrder.map((table) => [table, projected[table].length])),
    mutations,
  };
}

module.exports = { projectRelationalState, syncRelationalProjection, columns, primaryKeys, protectedColumns, insertOrder, deletionOrder };
