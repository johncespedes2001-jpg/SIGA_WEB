-- Proyección relacional completa de SIGA para MariaDB 10.4+.
-- Los identificadores públicos de la aplicación son las claves primarias para
-- Los identificadores públicos de la aplicación son las claves primarias.

CREATE TABLE IF NOT EXISTS programas (
  programa_id VARCHAR(30) NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (programa_id),
  UNIQUE KEY uq_programas_nombre (nombre),
  CONSTRAINT ck_programas_estado CHECK (estado IN ('Activo','Inactivo'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  clave_rol VARCHAR(30) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  descripcion VARCHAR(250) NULL,
  esta_activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (clave_rol),
  UNIQUE KEY uq_roles_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  usuario_id VARCHAR(40) NOT NULL,
  programa_id VARCHAR(30) NULL,
  nombre VARCHAR(512) NOT NULL,
  correo VARCHAR(600) NOT NULL,
  nombre_usuario VARCHAR(384) NULL,
  tipo_documento VARCHAR(10) NOT NULL DEFAULT 'DNI',
  documento VARCHAR(192) NULL,
  codigo_institucional VARCHAR(192) NULL,
  cargo VARCHAR(120) NULL,
  telefono VARCHAR(192) NULL,
  correo_contacto VARCHAR(600) NULL,
  direccion TEXT NULL,
  biografia TEXT NULL,
  hash_contrasena VARCHAR(300) NOT NULL,
  archivo_foto VARCHAR(260) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
  version_sesion INT NOT NULL DEFAULT 1,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (usuario_id),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_nombre_usuario (nombre_usuario),
  UNIQUE KEY uq_usuarios_documento (documento),
  KEY ix_usuarios_programa (programa_id),
  CONSTRAINT fk_usuarios_programas FOREIGN KEY (programa_id) REFERENCES programas(programa_id),
  CONSTRAINT ck_usuarios_estado CHECK (estado IN ('Activo','Inactivo','Bloqueado')),
  CONSTRAINT ck_usuarios_tipo_documento CHECK (tipo_documento IN ('DNI','CE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios_roles (
  usuario_id VARCHAR(40) NOT NULL,
  clave_rol VARCHAR(30) NOT NULL,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  fecha_asignacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (usuario_id, clave_rol),
  KEY ix_usuarios_roles_rol (clave_rol),
  CONSTRAINT fk_usuarios_roles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
  CONSTRAINT fk_usuarios_roles_rol FOREIGN KEY (clave_rol) REFERENCES roles(clave_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preferencias_notificacion_usuario (
  usuario_id VARCHAR(40) NOT NULL,
  clave_preferencia VARCHAR(60) NOT NULL,
  esta_habilitado TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, clave_preferencia),
  CONSTRAINT fk_preferencias_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personal (
  personal_id VARCHAR(40) NOT NULL,
  usuario_id VARCHAR(40) NULL,
  programa_id VARCHAR(30) NULL,
  tipo_documento VARCHAR(10) NOT NULL DEFAULT 'DNI',
  documento VARCHAR(192) NOT NULL,
  nombre VARCHAR(512) NOT NULL,
  correo VARCHAR(600) NOT NULL,
  nombre_cargo VARCHAR(80) NOT NULL,
  nombre_turno VARCHAR(40) NULL,
  punto_control VARCHAR(100) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (personal_id),
  UNIQUE KEY uq_personal_documento (documento),
  UNIQUE KEY uq_personal_correo (correo),
  KEY ix_personal_usuario (usuario_id),
  KEY ix_personal_programa (programa_id),
  CONSTRAINT fk_personal_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_personal_programa FOREIGN KEY (programa_id) REFERENCES programas(programa_id),
  CONSTRAINT ck_personal_estado CHECK (estado IN ('Activo','Inactivo')),
  CONSTRAINT ck_personal_tipo_documento CHECK (tipo_documento IN ('DNI','CE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estudiantes (
  estudiante_id VARCHAR(40) NOT NULL,
  usuario_id VARCHAR(40) NULL,
  programa_id VARCHAR(30) NOT NULL,
  tutor_usuario_id VARCHAR(40) NULL,
  tipo_documento VARCHAR(10) NOT NULL DEFAULT 'DNI',
  documento VARCHAR(192) NOT NULL,
  nombre VARCHAR(512) NOT NULL,
  correo_institucional VARCHAR(600) NOT NULL,
  semestre VARCHAR(20) NOT NULL,
  nombre_grupo VARCHAR(40) NOT NULL,
  estado_matricula VARCHAR(30) NOT NULL DEFAULT 'Activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (estudiante_id),
  UNIQUE KEY uq_estudiantes_documento (documento),
  UNIQUE KEY uq_estudiantes_correo (correo_institucional),
  KEY ix_estudiantes_programa_grupo (programa_id, semestre, nombre_grupo, estado_matricula),
  KEY ix_estudiantes_tutor (tutor_usuario_id, estado_matricula),
  CONSTRAINT fk_estudiantes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_estudiantes_programa FOREIGN KEY (programa_id) REFERENCES programas(programa_id),
  CONSTRAINT fk_estudiantes_tutor FOREIGN KEY (tutor_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT ck_estudiantes_estado CHECK (estado_matricula IN ('Activo','Inactivo','Retirado','Egresado')),
  CONSTRAINT ck_estudiantes_tipo_documento CHECK (tipo_documento IN ('DNI','CE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vinculos_apoderado_estudiante (
  apoderado_usuario_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  parentesco VARCHAR(60) NOT NULL,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (apoderado_usuario_id, estudiante_id),
  CONSTRAINT fk_vinculos_apoderado FOREIGN KEY (apoderado_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_vinculos_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clases (
  clase_id VARCHAR(40) NOT NULL,
  programa_id VARCHAR(30) NOT NULL,
  docente_usuario_id VARCHAR(40) NOT NULL,
  nombre_curso VARCHAR(180) NOT NULL,
  nombre_grupo VARCHAR(40) NOT NULL,
  nombre_seccion VARCHAR(20) NULL,
  semestre VARCHAR(20) NOT NULL,
  nombre_aula VARCHAR(100) NULL,
  horario VARCHAR(120) NOT NULL,
  dia_semana VARCHAR(20) NULL,
  modalidad VARCHAR(20) NOT NULL DEFAULT 'Presencial',
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clase_id),
  KEY ix_clases_docente (docente_usuario_id, estado),
  KEY ix_clases_programa (programa_id, semestre, nombre_grupo),
  CONSTRAINT fk_clases_programa FOREIGN KEY (programa_id) REFERENCES programas(programa_id),
  CONSTRAINT fk_clases_docente FOREIGN KEY (docente_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matriculas_clase (
  clase_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
  fecha_matricula DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clase_id, estudiante_id),
  KEY ix_matriculas_estudiante (estudiante_id, estado),
  CONSTRAINT fk_matriculas_clase FOREIGN KEY (clase_id) REFERENCES clases(clase_id),
  CONSTRAINT fk_matriculas_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registros_asistencia (
  asistencia_id VARCHAR(40) NOT NULL,
  clase_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  registrado_por_usuario_id VARCHAR(40) NOT NULL,
  fecha_asistencia DATE NOT NULL,
  estado_asistencia VARCHAR(20) NOT NULL,
  observacion TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (asistencia_id),
  UNIQUE KEY uq_asistencia_clase_estudiante_fecha (clase_id, estudiante_id, fecha_asistencia),
  KEY ix_asistencia_estudiante_fecha (estudiante_id, fecha_asistencia),
  CONSTRAINT fk_asistencia_clase FOREIGN KEY (clase_id) REFERENCES clases(clase_id),
  CONSTRAINT fk_asistencia_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_asistencia_usuario FOREIGN KEY (registrado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auditoria_asistencia (
  auditoria_id VARCHAR(80) NOT NULL,
  asistencia_id VARCHAR(40) NOT NULL,
  modificado_por_usuario_id VARCHAR(40) NOT NULL,
  estado_anterior VARCHAR(20) NULL,
  estado_nuevo VARCHAR(20) NOT NULL,
  motivo TEXT NULL,
  fecha_cambio DATETIME(3) NOT NULL,
  PRIMARY KEY (auditoria_id),
  CONSTRAINT fk_auditoria_asistencia FOREIGN KEY (asistencia_id) REFERENCES registros_asistencia(asistencia_id),
  CONSTRAINT fk_auditoria_asistencia_usuario FOREIGN KEY (modificado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitudes_salida (
  solicitud_salida_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  clase_id VARCHAR(40) NULL,
  solicitado_por_usuario_id VARCHAR(40) NOT NULL,
  autorizado_por_usuario_id VARCHAR(40) NULL,
  origen_solicitud VARCHAR(30) NOT NULL,
  tipo_salida VARCHAR(40) NULL,
  motivo TEXT NOT NULL,
  descripcion_adicional TEXT NULL,
  fecha_solicitada DATE NOT NULL,
  hora_solicitada TIME NOT NULL,
  estado VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
  motivo_decision TEXT NULL,
  fecha_decision DATETIME(3) NULL,
  hash_token_qr BINARY(32) NULL,
  codigo_qr VARCHAR(512) NULL,
  vigente_desde DATETIME(3) NULL,
  vigente_hasta DATETIME(3) NULL,
  fecha_uso DATETIME(3) NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (solicitud_salida_id),
  UNIQUE KEY uq_solicitudes_codigo_qr (codigo_qr),
  KEY ix_solicitudes_estudiante_fecha (estudiante_id, fecha_solicitada, estado),
  CONSTRAINT fk_solicitudes_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_solicitudes_clase FOREIGN KEY (clase_id) REFERENCES clases(clase_id),
  CONSTRAINT fk_solicitudes_solicitante FOREIGN KEY (solicitado_por_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_solicitudes_autorizador FOREIGN KEY (autorizado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS validaciones_salida (
  validacion_id VARCHAR(40) NOT NULL,
  solicitud_salida_id VARCHAR(40) NULL,
  vigilante_usuario_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NULL,
  punto_control VARCHAR(100) NOT NULL,
  resultado VARCHAR(30) NOT NULL,
  motivo_rechazo VARCHAR(300) NULL,
  fecha_validacion DATETIME(3) NOT NULL,
  PRIMARY KEY (validacion_id),
  KEY ix_validaciones_vigilante_fecha (vigilante_usuario_id, fecha_validacion),
  CONSTRAINT fk_validaciones_solicitud FOREIGN KEY (solicitud_salida_id) REFERENCES solicitudes_salida(solicitud_salida_id),
  CONSTRAINT fk_validaciones_vigilante FOREIGN KEY (vigilante_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_validaciones_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS justificaciones (
  justificacion_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  enviado_por_usuario_id VARCHAR(40) NOT NULL,
  revisado_por_usuario_id VARCHAR(40) NULL,
  tipo_asistencia VARCHAR(30) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT NOT NULL,
  descripcion TEXT NULL,
  informacion_contacto VARCHAR(512) NULL,
  archivo_evidencia VARCHAR(260) NULL,
  nombre_original_evidencia TEXT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Enviada',
  observacion TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (justificacion_id),
  KEY ix_justificaciones_estudiante_fecha (estudiante_id, fecha_inicio, estado),
  CONSTRAINT fk_justificaciones_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_justificaciones_envio FOREIGN KEY (enviado_por_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_justificaciones_revision FOREIGN KEY (revisado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incidencias_permanencia (
  incidencia_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  programa_id VARCHAR(30) NOT NULL,
  creado_por_usuario_id VARCHAR(40) NOT NULL,
  responsable_usuario_id VARCHAR(40) NULL,
  fecha_incidencia DATE NOT NULL,
  tipo_incidencia VARCHAR(60) NOT NULL,
  descripcion TEXT NOT NULL,
  archivo_evidencia VARCHAR(260) NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Abierta',
  compartido_familia TINYINT(1) NOT NULL DEFAULT 0,
  compartido_estudiante TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (incidencia_id),
  KEY ix_incidencias_programa_estado (programa_id, estado, fecha_incidencia),
  CONSTRAINT fk_incidencias_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_incidencias_programa FOREIGN KEY (programa_id) REFERENCES programas(programa_id),
  CONSTRAINT fk_incidencias_creador FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_incidencias_responsable FOREIGN KEY (responsable_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_incidencias (
  historial_id VARCHAR(80) NOT NULL,
  incidencia_id VARCHAR(40) NOT NULL,
  usuario_id VARCHAR(40) NOT NULL,
  nombre_accion VARCHAR(60) NOT NULL,
  estado_anterior VARCHAR(30) NULL,
  estado_nuevo VARCHAR(30) NULL,
  comentario TEXT NOT NULL,
  fecha_creacion DATETIME(3) NOT NULL,
  PRIMARY KEY (historial_id),
  CONSTRAINT fk_historial_incidencia FOREIGN KEY (incidencia_id) REFERENCES incidencias_permanencia(incidencia_id),
  CONSTRAINT fk_historial_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS casos_tutoria (
  caso_tutoria_id VARCHAR(40) NOT NULL,
  tutor_usuario_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  fecha_caso DATE NOT NULL,
  tipo_caso VARCHAR(60) NOT NULL,
  prioridad VARCHAR(20) NOT NULL,
  descripcion TEXT NOT NULL,
  acciones_realizadas TEXT NULL,
  archivo_evidencia VARCHAR(260) NULL,
  nombre_original_evidencia TEXT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Abierto',
  compartido_familia TINYINT(1) NOT NULL DEFAULT 0,
  compartido_estudiante TINYINT(1) NOT NULL DEFAULT 0,
  proxima_fecha_seguimiento DATE NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (caso_tutoria_id),
  KEY ix_casos_tutor_estado (tutor_usuario_id, estado, fecha_caso),
  CONSTRAINT fk_casos_tutor FOREIGN KEY (tutor_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_casos_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comentarios_caso_tutoria (
  comentario_id VARCHAR(80) NOT NULL,
  caso_tutoria_id VARCHAR(40) NOT NULL,
  usuario_id VARCHAR(40) NOT NULL,
  texto_comentario TEXT NOT NULL,
  es_evidencia_cierre TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME(3) NOT NULL,
  PRIMARY KEY (comentario_id),
  CONSTRAINT fk_comentarios_caso FOREIGN KEY (caso_tutoria_id) REFERENCES casos_tutoria(caso_tutoria_id),
  CONSTRAINT fk_comentarios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alertas (
  alerta_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NULL,
  usuario_asignado_id VARCHAR(40) NULL,
  creado_por_usuario_id VARCHAR(40) NULL,
  tipo_alerta VARCHAR(80) NOT NULL,
  titulo VARCHAR(512) NOT NULL,
  descripcion TEXT NULL,
  prioridad VARCHAR(20) NOT NULL DEFAULT 'Media',
  estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
  accion_realizada TEXT NULL,
  fecha_revision DATETIME(3) NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (alerta_id),
  CONSTRAINT fk_alertas_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_alertas_asignado FOREIGN KEY (usuario_asignado_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_alertas_creador FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mensajes (
  mensaje_id VARCHAR(40) NOT NULL,
  remitente_usuario_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NULL,
  asunto VARCHAR(512) NOT NULL,
  cuerpo LONGTEXT NOT NULL,
  alcance_destinatario VARCHAR(120) NOT NULL,
  fecha_envio DATETIME(3) NOT NULL,
  PRIMARY KEY (mensaje_id),
  CONSTRAINT fk_mensajes_remitente FOREIGN KEY (remitente_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_mensajes_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reuniones (
  reunion_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  responsable_usuario_id VARCHAR(40) NOT NULL,
  fecha_reunion DATE NOT NULL,
  hora_reunion TIME NOT NULL,
  modalidad VARCHAR(30) NOT NULL DEFAULT 'Presencial',
  tema VARCHAR(600) NOT NULL,
  participantes TEXT NULL,
  acuerdos TEXT NULL,
  seguimiento TEXT NULL,
  estado VARCHAR(40) NOT NULL DEFAULT 'Programada',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (reunion_id),
  CONSTRAINT fk_reuniones_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_reuniones_responsable FOREIGN KEY (responsable_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones (
  notificacion_id VARCHAR(40) NOT NULL,
  usuario_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NULL,
  titulo VARCHAR(512) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo_notificacion VARCHAR(60) NULL,
  esta_leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME(3) NOT NULL,
  fecha_lectura DATETIME(3) NULL,
  PRIMARY KEY (notificacion_id),
  KEY ix_notificaciones_usuario_lectura (usuario_id, esta_leida, fecha_creacion),
  CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_notificaciones_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avisos (
  aviso_id VARCHAR(40) NOT NULL,
  programa_id VARCHAR(30) NULL,
  estudiante_id VARCHAR(40) NULL,
  creado_por_usuario_id VARCHAR(40) NULL,
  titulo VARCHAR(512) NOT NULL,
  mensaje TEXT NOT NULL,
  audiencia VARCHAR(80) NOT NULL,
  fecha_publicacion DATETIME(3) NOT NULL,
  fecha_expiracion DATETIME(3) NULL,
  PRIMARY KEY (aviso_id),
  CONSTRAINT fk_avisos_programa FOREIGN KEY (programa_id) REFERENCES programas(programa_id),
  CONSTRAINT fk_avisos_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_avisos_creador FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incidencias_seguridad (
  incidencia_seguridad_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NULL,
  solicitud_salida_id VARCHAR(40) NULL,
  creado_por_usuario_id VARCHAR(40) NOT NULL,
  tipo_incidencia VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad VARCHAR(20) NOT NULL,
  archivo_evidencia VARCHAR(260) NULL,
  punto_control VARCHAR(100) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Abierta',
  fecha_creacion DATETIME(3) NOT NULL,
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (incidencia_seguridad_id),
  CONSTRAINT fk_seguridad_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id),
  CONSTRAINT fk_seguridad_solicitud FOREIGN KEY (solicitud_salida_id) REFERENCES solicitudes_salida(solicitud_salida_id),
  CONSTRAINT fk_seguridad_creador FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registros_acceso (
  registro_acceso_id VARCHAR(40) NOT NULL,
  vigilante_usuario_id VARCHAR(40) NOT NULL,
  estudiante_id VARCHAR(40) NOT NULL,
  punto_control VARCHAR(100) NOT NULL,
  tipo_movimiento VARCHAR(20) NOT NULL DEFAULT 'Entrada',
  fecha_registro DATETIME(3) NOT NULL,
  PRIMARY KEY (registro_acceso_id),
  KEY ix_accesos_fecha (fecha_registro, punto_control),
  KEY ix_accesos_estudiante_fecha (estudiante_id, fecha_registro),
  CONSTRAINT fk_accesos_vigilante FOREIGN KEY (vigilante_usuario_id) REFERENCES usuarios(usuario_id),
  CONSTRAINT fk_accesos_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  bitacora_id VARCHAR(100) NOT NULL,
  usuario_id VARCHAR(40) NULL,
  clave_rol VARCHAR(30) NULL,
  nombre_entidad VARCHAR(80) NOT NULL,
  id_publico_entidad VARCHAR(60) NULL,
  nombre_accion VARCHAR(80) NOT NULL,
  detalle TEXT NULL,
  direccion_ip VARCHAR(256) NULL,
  agente_usuario TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL,
  PRIMARY KEY (bitacora_id),
  KEY ix_bitacora_entidad_fecha (nombre_entidad, id_publico_entidad, fecha_creacion),
  KEY ix_bitacora_usuario_fecha (usuario_id, fecha_creacion),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Amplía instalaciones existentes creadas antes del cifrado de campos.
ALTER TABLE usuarios
  MODIFY nombre VARCHAR(512) NOT NULL,
  MODIFY correo VARCHAR(600) NOT NULL,
  MODIFY nombre_usuario VARCHAR(384) NULL,
  MODIFY documento VARCHAR(192) NULL,
  MODIFY codigo_institucional VARCHAR(192) NULL,
  MODIFY telefono VARCHAR(192) NULL,
  MODIFY correo_contacto VARCHAR(600) NULL,
  MODIFY direccion TEXT NULL,
  MODIFY biografia TEXT NULL;
ALTER TABLE personal MODIFY documento VARCHAR(192) NOT NULL, MODIFY nombre VARCHAR(512) NOT NULL, MODIFY correo VARCHAR(600) NOT NULL;
ALTER TABLE estudiantes MODIFY documento VARCHAR(192) NOT NULL, MODIFY nombre VARCHAR(512) NOT NULL, MODIFY correo_institucional VARCHAR(600) NOT NULL;
ALTER TABLE registros_asistencia MODIFY observacion TEXT NULL;
ALTER TABLE auditoria_asistencia MODIFY motivo TEXT NULL;
ALTER TABLE solicitudes_salida MODIFY motivo TEXT NOT NULL, MODIFY descripcion_adicional TEXT NULL, MODIFY motivo_decision TEXT NULL, MODIFY codigo_qr VARCHAR(512) NULL;
ALTER TABLE justificaciones MODIFY motivo TEXT NOT NULL, MODIFY descripcion TEXT NULL, MODIFY informacion_contacto VARCHAR(512) NULL, MODIFY nombre_original_evidencia TEXT NULL, MODIFY observacion TEXT NULL;
ALTER TABLE incidencias_permanencia MODIFY descripcion TEXT NOT NULL;
ALTER TABLE historial_incidencias MODIFY comentario TEXT NOT NULL;
ALTER TABLE casos_tutoria MODIFY descripcion TEXT NOT NULL, MODIFY acciones_realizadas TEXT NULL, MODIFY nombre_original_evidencia TEXT NULL;
ALTER TABLE comentarios_caso_tutoria MODIFY texto_comentario TEXT NOT NULL;
ALTER TABLE alertas MODIFY titulo VARCHAR(512) NOT NULL, MODIFY descripcion TEXT NULL, MODIFY accion_realizada TEXT NULL;
ALTER TABLE mensajes MODIFY asunto VARCHAR(512) NOT NULL;
ALTER TABLE reuniones MODIFY tema VARCHAR(600) NOT NULL, MODIFY participantes TEXT NULL, MODIFY acuerdos TEXT NULL, MODIFY seguimiento TEXT NULL;
ALTER TABLE notificaciones MODIFY titulo VARCHAR(512) NOT NULL, MODIFY mensaje TEXT NOT NULL;
ALTER TABLE avisos MODIFY titulo VARCHAR(512) NOT NULL, MODIFY mensaje TEXT NOT NULL;
ALTER TABLE incidencias_seguridad MODIFY descripcion TEXT NOT NULL;
ALTER TABLE bitacora_auditoria MODIFY detalle TEXT NULL, MODIFY direccion_ip VARCHAR(256) NULL, MODIFY agente_usuario TEXT NULL;

CREATE OR REPLACE VIEW vw_resumen_asistencia_estudiante AS
SELECT e.estudiante_id, e.nombre AS nombre_estudiante, p.nombre AS nombre_programa,
       COUNT(a.asistencia_id) AS total_registros,
       SUM(a.estado_asistencia = 'Presente') AS total_presentes,
       SUM(a.estado_asistencia = 'Tardanza') AS total_tardanzas,
       SUM(a.estado_asistencia = 'Ausente') AS total_ausentes,
       ROUND(100 * SUM(a.estado_asistencia = 'Presente') / NULLIF(COUNT(a.asistencia_id), 0), 2) AS porcentaje_asistencia
FROM estudiantes e
JOIN programas p ON p.programa_id = e.programa_id
LEFT JOIN registros_asistencia a ON a.estudiante_id = e.estudiante_id
GROUP BY e.estudiante_id, e.nombre, p.nombre;

CREATE OR REPLACE VIEW vw_boletas_salida_vigentes AS
SELECT s.solicitud_salida_id, e.estudiante_id, e.nombre AS nombre_estudiante,
       p.nombre AS nombre_programa, s.fecha_solicitada, s.hora_solicitada,
       s.motivo, s.estado, s.vigente_desde, s.vigente_hasta, s.codigo_qr
FROM solicitudes_salida s
JOIN estudiantes e ON e.estudiante_id = s.estudiante_id
JOIN programas p ON p.programa_id = e.programa_id
WHERE s.estado = 'Autorizada' AND s.fecha_uso IS NULL;
