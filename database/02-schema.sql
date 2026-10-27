:setvar DatabaseName "SIGA"

USE [$(DatabaseName)];
GO
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.Programas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Programas (
    ProgramaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Programas PRIMARY KEY,
    IdPublico nvarchar(30) NOT NULL CONSTRAINT UQ_Programas_IdPublico UNIQUE,
    Nombre nvarchar(180) NOT NULL CONSTRAINT UQ_Programas_Nombre UNIQUE,
    Estado nvarchar(20) NOT NULL CONSTRAINT DF_Programas_Estado DEFAULT N'Activo',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Programas_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Programas_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Programas_Estado CHECK (Estado IN (N'Activo', N'Inactivo'))
  );
END;
GO

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    RolId smallint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    ClaveRol nvarchar(30) NOT NULL CONSTRAINT UQ_Roles_ClaveRol UNIQUE,
    Nombre nvarchar(80) NOT NULL CONSTRAINT UQ_Roles_Nombre UNIQUE,
    Descripcion nvarchar(250) NULL,
    EstaActivo bit NOT NULL CONSTRAINT DF_Roles_EstaActivo DEFAULT 1
  );
END;
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Usuarios (
    UsuarioId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Usuarios_IdPublico UNIQUE,
    ProgramaId bigint NULL,
    Nombre nvarchar(180) NOT NULL,
    Correo nvarchar(254) NOT NULL,
    NombreUsuario nvarchar(100) NULL,
    TipoDocumento nvarchar(10) NOT NULL CONSTRAINT DF_Usuarios_TipoDocumento DEFAULT N'DNI',
    Documento nvarchar(30) NULL,
    CodigoInstitucional nvarchar(40) NULL,
    Cargo nvarchar(120) NULL,
    Telefono nvarchar(30) NULL,
    CorreoContacto nvarchar(254) NULL,
    Direccion nvarchar(250) NULL,
    Biografia nvarchar(500) NULL,
    HashContrasena nvarchar(300) NOT NULL,
    ArchivoFoto nvarchar(260) NULL,
    Estado nvarchar(20) NOT NULL CONSTRAINT DF_Usuarios_Estado DEFAULT N'Activo',
    VersionSesion int NOT NULL CONSTRAINT DF_Usuarios_VersionSesion DEFAULT 1,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Usuarios_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Usuarios_Programas FOREIGN KEY (ProgramaId) REFERENCES dbo.Programas(ProgramaId),
    CONSTRAINT UQ_Usuarios_Correo UNIQUE (Correo),
    CONSTRAINT CK_Usuarios_Estado CHECK (Estado IN (N'Activo', N'Inactivo', N'Bloqueado')),
    CONSTRAINT CK_Usuarios_TipoDocumento CHECK (TipoDocumento IN (N'DNI', N'CE'))
  );
  CREATE UNIQUE INDEX UX_Usuarios_NombreUsuario ON dbo.Usuarios(NombreUsuario) WHERE NombreUsuario IS NOT NULL;
  CREATE UNIQUE INDEX UX_Usuarios_Documento ON dbo.Usuarios(Documento) WHERE Documento IS NOT NULL AND Documento <> N'';
END;
GO

IF COL_LENGTH(N'dbo.Usuarios', N'TipoDocumento') IS NULL
  ALTER TABLE dbo.Usuarios ADD TipoDocumento nvarchar(10) NOT NULL CONSTRAINT DF_Usuarios_TipoDocumento DEFAULT N'DNI' WITH VALUES;
GO
IF OBJECT_ID(N'dbo.CK_Usuarios_TipoDocumento', N'C') IS NULL
  ALTER TABLE dbo.Usuarios ADD CONSTRAINT CK_Usuarios_TipoDocumento CHECK (TipoDocumento IN (N'DNI', N'CE'));
GO

IF OBJECT_ID(N'dbo.UsuariosRoles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UsuariosRoles (
    UsuarioId bigint NOT NULL,
    RolId smallint NOT NULL,
    EsPrincipal bit NOT NULL CONSTRAINT DF_UsuariosRoles_EsPrincipal DEFAULT 0,
    FechaAsignacion datetime2(3) NOT NULL CONSTRAINT DF_UsuariosRoles_FechaAsignacion DEFAULT SYSUTCDATETIME(),
    AsignadoPorUsuarioId bigint NULL,
    CONSTRAINT PK_UsuariosRoles PRIMARY KEY (UsuarioId, RolId),
    CONSTRAINT FK_UsuariosRoles_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_UsuariosRoles_Roles FOREIGN KEY (RolId) REFERENCES dbo.Roles(RolId),
    CONSTRAINT FK_UsuariosRoles_AsignadoPor FOREIGN KEY (AsignadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId)
  );
  CREATE UNIQUE INDEX UX_UsuariosRoles_Principal ON dbo.UsuariosRoles(UsuarioId) WHERE EsPrincipal = 1;
END;
GO

IF OBJECT_ID(N'dbo.PreferenciasNotificacionUsuario', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PreferenciasNotificacionUsuario (
    UsuarioId bigint NOT NULL,
    ClavePreferencia nvarchar(60) NOT NULL,
    EstaHabilitado bit NOT NULL CONSTRAINT DF_PreferenciasNotificacionUsuario_EstaHabilitado DEFAULT 1,
    CONSTRAINT PK_PreferenciasNotificacionUsuario PRIMARY KEY (UsuarioId, ClavePreferencia),
    CONSTRAINT FK_PreferenciasNotificacionUsuario_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.Personal', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Personal (
    PersonalId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Personal PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Personal_IdPublico UNIQUE,
    UsuarioId bigint NULL,
    ProgramaId bigint NULL,
    TipoDocumento nvarchar(10) NOT NULL CONSTRAINT DF_Personal_TipoDocumento DEFAULT N'DNI',
    Documento nvarchar(30) NOT NULL,
    Nombre nvarchar(180) NOT NULL,
    Correo nvarchar(254) NOT NULL,
    NombreCargo nvarchar(80) NOT NULL,
    NombreTurno nvarchar(40) NULL,
    PuntoControl nvarchar(100) NULL,
    Estado nvarchar(20) NOT NULL CONSTRAINT DF_Personal_Estado DEFAULT N'Activo',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Personal_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Personal_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Personal_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_Personal_Programas FOREIGN KEY (ProgramaId) REFERENCES dbo.Programas(ProgramaId),
    CONSTRAINT UQ_Personal_Documento UNIQUE (Documento),
    CONSTRAINT UQ_Personal_Correo UNIQUE (Correo),
    CONSTRAINT CK_Personal_Estado CHECK (Estado IN (N'Activo', N'Inactivo')),
    CONSTRAINT CK_Personal_TipoDocumento CHECK (TipoDocumento IN (N'DNI', N'CE'))
  );
END;
GO

IF COL_LENGTH(N'dbo.Personal', N'TipoDocumento') IS NULL
  ALTER TABLE dbo.Personal ADD TipoDocumento nvarchar(10) NOT NULL CONSTRAINT DF_Personal_TipoDocumento DEFAULT N'DNI' WITH VALUES;
GO
IF OBJECT_ID(N'dbo.CK_Personal_TipoDocumento', N'C') IS NULL
  ALTER TABLE dbo.Personal ADD CONSTRAINT CK_Personal_TipoDocumento CHECK (TipoDocumento IN (N'DNI', N'CE'));
GO

IF OBJECT_ID(N'dbo.Estudiantes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Estudiantes (
    EstudianteId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Estudiantes PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Estudiantes_IdPublico UNIQUE,
    UsuarioId bigint NULL,
    ProgramaId bigint NOT NULL,
    TutorUsuarioId bigint NULL,
    TipoDocumento nvarchar(10) NOT NULL CONSTRAINT DF_Estudiantes_TipoDocumento DEFAULT N'DNI',
    Documento nvarchar(30) NOT NULL,
    Nombre nvarchar(180) NOT NULL,
    CorreoInstitucional nvarchar(254) NOT NULL,
    Semestre nvarchar(20) NOT NULL,
    NombreGrupo nvarchar(40) NOT NULL,
    EstadoMatricula nvarchar(30) NOT NULL CONSTRAINT DF_Estudiantes_EstadoMatricula DEFAULT N'Activo',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Estudiantes_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Estudiantes_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Estudiantes_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_Estudiantes_Programas FOREIGN KEY (ProgramaId) REFERENCES dbo.Programas(ProgramaId),
    CONSTRAINT FK_Estudiantes_Tutor FOREIGN KEY (TutorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT UQ_Estudiantes_Documento UNIQUE (Documento),
    CONSTRAINT UQ_Estudiantes_Correo UNIQUE (CorreoInstitucional),
    CONSTRAINT CK_Estudiantes_Estado CHECK (EstadoMatricula IN (N'Activo', N'Inactivo', N'Retirado', N'Egresado')),
    CONSTRAINT CK_Estudiantes_TipoDocumento CHECK (TipoDocumento IN (N'DNI', N'CE'))
  );
  CREATE INDEX IX_Estudiantes_ProgramaGrupo ON dbo.Estudiantes(ProgramaId, Semestre, NombreGrupo, EstadoMatricula);
  CREATE INDEX IX_Estudiantes_Tutor ON dbo.Estudiantes(TutorUsuarioId, EstadoMatricula);
END;
GO

IF COL_LENGTH(N'dbo.Estudiantes', N'TipoDocumento') IS NULL
  ALTER TABLE dbo.Estudiantes ADD TipoDocumento nvarchar(10) NOT NULL CONSTRAINT DF_Estudiantes_TipoDocumento DEFAULT N'DNI' WITH VALUES;
GO
IF OBJECT_ID(N'dbo.CK_Estudiantes_TipoDocumento', N'C') IS NULL
  ALTER TABLE dbo.Estudiantes ADD CONSTRAINT CK_Estudiantes_TipoDocumento CHECK (TipoDocumento IN (N'DNI', N'CE'));
GO

IF OBJECT_ID(N'dbo.VinculosApoderadoEstudiante', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VinculosApoderadoEstudiante (
    ApoderadoUsuarioId bigint NOT NULL,
    EstudianteId bigint NOT NULL,
    Parentesco nvarchar(60) NOT NULL,
    EsPrincipal bit NOT NULL CONSTRAINT DF_VinculosApoderadoEstudiante_EsPrincipal DEFAULT 0,
    Estado nvarchar(20) NOT NULL CONSTRAINT DF_VinculosApoderadoEstudiante_Estado DEFAULT N'Activo',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_VinculosApoderadoEstudiante_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_VinculosApoderadoEstudiante PRIMARY KEY (ApoderadoUsuarioId, EstudianteId),
    CONSTRAINT FK_VinculosApoderadoEstudiante_Apoderado FOREIGN KEY (ApoderadoUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_VinculosApoderadoEstudiante_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT CK_VinculosApoderadoEstudiante_Estado CHECK (Estado IN (N'Activo', N'Inactivo'))
  );
END;
GO

IF OBJECT_ID(N'dbo.Clases', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Clases (
    ClaseId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Clases PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Clases_IdPublico UNIQUE,
    ProgramaId bigint NOT NULL,
    DocenteUsuarioId bigint NOT NULL,
    NombreCurso nvarchar(180) NOT NULL,
    NombreGrupo nvarchar(40) NOT NULL,
    NombreSeccion nvarchar(20) NULL,
    Semestre nvarchar(20) NOT NULL,
    NombreAula nvarchar(100) NULL,
    Horario nvarchar(120) NOT NULL,
    DiaSemana nvarchar(20) NULL,
    Modalidad nvarchar(20) NOT NULL CONSTRAINT DF_Clases_Modalidad DEFAULT N'Presencial',
    Estado nvarchar(20) NOT NULL CONSTRAINT DF_Clases_Estado DEFAULT N'Activo',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Clases_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Clases_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Clases_Programas FOREIGN KEY (ProgramaId) REFERENCES dbo.Programas(ProgramaId),
    CONSTRAINT FK_Clases_Docente FOREIGN KEY (DocenteUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_Clases_Estado CHECK (Estado IN (N'Activo', N'Inactivo'))
  );
  CREATE INDEX IX_Clases_Docente ON dbo.Clases(DocenteUsuarioId, Estado);
  CREATE INDEX IX_Clases_Programa ON dbo.Clases(ProgramaId, Semestre, NombreGrupo);
END;
GO

IF COL_LENGTH(N'dbo.Clases', N'DiaSemana') IS NULL
  ALTER TABLE dbo.Clases ADD DiaSemana nvarchar(20) NULL;
GO

IF COL_LENGTH(N'dbo.Clases', N'Modalidad') IS NULL
  ALTER TABLE dbo.Clases ADD Modalidad nvarchar(20) NOT NULL CONSTRAINT DF_Clases_Modalidad DEFAULT N'Presencial' WITH VALUES;
GO

IF OBJECT_ID(N'dbo.MatriculasClase', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MatriculasClase (
    ClaseId bigint NOT NULL,
    EstudianteId bigint NOT NULL,
    Estado nvarchar(20) NOT NULL CONSTRAINT DF_MatriculasClase_Estado DEFAULT N'Activo',
    FechaMatricula datetime2(3) NOT NULL CONSTRAINT DF_MatriculasClase_FechaMatricula DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MatriculasClase PRIMARY KEY (ClaseId, EstudianteId),
    CONSTRAINT FK_MatriculasClase_Clase FOREIGN KEY (ClaseId) REFERENCES dbo.Clases(ClaseId),
    CONSTRAINT FK_MatriculasClase_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT CK_MatriculasClase_Estado CHECK (Estado IN (N'Activo', N'Inactivo', N'Retirado'))
  );
  CREATE INDEX IX_MatriculasClase_Estudiante ON dbo.MatriculasClase(EstudianteId, Estado);
END;
GO

IF OBJECT_ID(N'dbo.RegistrosAsistencia', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.RegistrosAsistencia (
    AsistenciaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_RegistrosAsistencia PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_RegistrosAsistencia_IdPublico UNIQUE,
    ClaseId bigint NOT NULL,
    EstudianteId bigint NOT NULL,
    RegistradoPorUsuarioId bigint NOT NULL,
    FechaAsistencia date NOT NULL,
    EstadoAsistencia nvarchar(20) NOT NULL,
    Observacion nvarchar(500) NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_RegistrosAsistencia_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_RegistrosAsistencia_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_RegistrosAsistencia_Clase FOREIGN KEY (ClaseId) REFERENCES dbo.Clases(ClaseId),
    CONSTRAINT FK_RegistrosAsistencia_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_RegistrosAsistencia_Usuario FOREIGN KEY (RegistradoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT UQ_RegistrosAsistencia_ClaseEstudianteFecha UNIQUE (ClaseId, EstudianteId, FechaAsistencia),
    CONSTRAINT CK_RegistrosAsistencia_Estado CHECK (EstadoAsistencia IN (N'Presente', N'Tardanza', N'Ausente', N'Permiso', N'Retiro'))
  );
  CREATE INDEX IX_RegistrosAsistencia_EstudianteFecha ON dbo.RegistrosAsistencia(EstudianteId, FechaAsistencia DESC);
  CREATE INDEX IX_RegistrosAsistencia_ClaseFecha ON dbo.RegistrosAsistencia(ClaseId, FechaAsistencia DESC, EstadoAsistencia);
END;
GO

IF OBJECT_ID(N'dbo.AuditoriaAsistencia', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditoriaAsistencia (
    AuditoriaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditoriaAsistencia PRIMARY KEY,
    AsistenciaId bigint NOT NULL,
    ModificadoPorUsuarioId bigint NOT NULL,
    EstadoAnterior nvarchar(20) NULL,
    EstadoNuevo nvarchar(20) NOT NULL,
    Motivo nvarchar(500) NULL,
    FechaCambio datetime2(3) NOT NULL CONSTRAINT DF_AuditoriaAsistencia_FechaCambio DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AuditoriaAsistencia_Asistencia FOREIGN KEY (AsistenciaId) REFERENCES dbo.RegistrosAsistencia(AsistenciaId),
    CONSTRAINT FK_AuditoriaAsistencia_Usuario FOREIGN KEY (ModificadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId)
  );
END;
GO

IF OBJECT_ID(N'dbo.SolicitudesSalida', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SolicitudesSalida (
    SolicitudSalidaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SolicitudesSalida PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_SolicitudesSalida_IdPublico UNIQUE,
    EstudianteId bigint NOT NULL,
    ClaseId bigint NULL,
    SolicitadoPorUsuarioId bigint NOT NULL,
    AutorizadoPorUsuarioId bigint NULL,
    OrigenSolicitud nvarchar(30) NOT NULL,
    TipoSalida nvarchar(40) NULL,
    Motivo nvarchar(500) NOT NULL,
    DescripcionAdicional nvarchar(1000) NULL,
    FechaSolicitada date NOT NULL,
    HoraSolicitada time(0) NOT NULL,
    Estado nvarchar(40) NOT NULL CONSTRAINT DF_SolicitudesSalida_Estado DEFAULT N'Pendiente',
    MotivoDecision nvarchar(500) NULL,
    FechaDecision datetime2(3) NULL,
    HashTokenQr varbinary(32) NULL,
    CodigoQr nvarchar(120) NULL,
    VigenteDesde datetime2(3) NULL,
    VigenteHasta datetime2(3) NULL,
    FechaUso datetime2(3) NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_SolicitudesSalida_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_SolicitudesSalida_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SolicitudesSalida_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_SolicitudesSalida_Clase FOREIGN KEY (ClaseId) REFERENCES dbo.Clases(ClaseId),
    CONSTRAINT FK_SolicitudesSalida_SolicitadoPor FOREIGN KEY (SolicitadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_SolicitudesSalida_AutorizadoPor FOREIGN KEY (AutorizadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_SolicitudesSalida_Origen CHECK (OrigenSolicitud IN (N'Estudiante', N'Docente')),
    CONSTRAINT CK_SolicitudesSalida_Estado CHECK (Estado IN (N'Pendiente', N'En revisión', N'Autorizada', N'Rechazada', N'Usada', N'Vencida', N'Anulada'))
  );
  CREATE UNIQUE INDEX UX_SolicitudesSalida_CodigoQr ON dbo.SolicitudesSalida(CodigoQr) WHERE CodigoQr IS NOT NULL;
  CREATE INDEX IX_SolicitudesSalida_FlujoPrograma ON dbo.SolicitudesSalida(EstudianteId, FechaSolicitada DESC, Estado);
END;
GO

IF OBJECT_ID(N'dbo.ValidacionesSalida', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ValidacionesSalida (
    ValidacionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ValidacionesSalida PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_ValidacionesSalida_IdPublico UNIQUE,
    SolicitudSalidaId bigint NULL,
    VigilanteUsuarioId bigint NOT NULL,
    EstudianteId bigint NULL,
    PuntoControl nvarchar(100) NOT NULL,
    Resultado nvarchar(30) NOT NULL,
    MotivoRechazo nvarchar(300) NULL,
    FechaValidacion datetime2(3) NOT NULL CONSTRAINT DF_ValidacionesSalida_FechaValidacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ValidacionesSalida_SolicitudSalida FOREIGN KEY (SolicitudSalidaId) REFERENCES dbo.SolicitudesSalida(SolicitudSalidaId),
    CONSTRAINT FK_ValidacionesSalida_Vigilante FOREIGN KEY (VigilanteUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_ValidacionesSalida_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT CK_ValidacionesSalida_Resultado CHECK (Resultado IN (N'Validada', N'Rechazada'))
  );
  CREATE INDEX IX_ValidacionesSalida_VigilanteFecha ON dbo.ValidacionesSalida(VigilanteUsuarioId, FechaValidacion DESC);
END;
GO

IF OBJECT_ID(N'dbo.Justificaciones', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Justificaciones (
    JustificacionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Justificaciones PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Justificaciones_IdPublico UNIQUE,
    EstudianteId bigint NOT NULL,
    EnviadoPorUsuarioId bigint NOT NULL,
    RevisadoPorUsuarioId bigint NULL,
    TipoAsistencia nvarchar(30) NOT NULL,
    FechaInicio date NOT NULL,
    FechaFin date NOT NULL,
    Motivo nvarchar(300) NOT NULL,
    Descripcion nvarchar(1000) NULL,
    InformacionContacto nvarchar(150) NULL,
    ArchivoEvidencia nvarchar(260) NULL,
    NombreOriginalEvidencia nvarchar(260) NULL,
    Estado nvarchar(30) NOT NULL CONSTRAINT DF_Justificaciones_Estado DEFAULT N'Enviada',
    Observacion nvarchar(1000) NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Justificaciones_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Justificaciones_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Justificaciones_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_Justificaciones_EnviadoPor FOREIGN KEY (EnviadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_Justificaciones_RevisadoPor FOREIGN KEY (RevisadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_Justificaciones_RangoFechas CHECK (FechaFin >= FechaInicio),
    CONSTRAINT CK_Justificaciones_Estado CHECK (Estado IN (N'Enviada', N'En revisión', N'Aprobada', N'Observada', N'Derivada', N'Rechazada'))
  );
  CREATE INDEX IX_Justificaciones_EstudianteFecha ON dbo.Justificaciones(EstudianteId, FechaInicio DESC, Estado);
END;
GO

IF OBJECT_ID(N'dbo.IncidenciasPermanencia', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.IncidenciasPermanencia (
    IncidenciaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_IncidenciasPermanencia PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_IncidenciasPermanencia_IdPublico UNIQUE,
    EstudianteId bigint NOT NULL,
    ProgramaId bigint NOT NULL,
    CreadoPorUsuarioId bigint NOT NULL,
    ResponsableUsuarioId bigint NULL,
    FechaIncidencia date NOT NULL,
    TipoIncidencia nvarchar(60) NOT NULL,
    Descripcion nvarchar(1500) NOT NULL,
    ArchivoEvidencia nvarchar(260) NULL,
    Estado nvarchar(30) NOT NULL CONSTRAINT DF_IncidenciasPermanencia_Estado DEFAULT N'Abierta',
    CompartidoFamilia bit NOT NULL CONSTRAINT DF_IncidenciasPermanencia_CompartidoFamilia DEFAULT 0,
    CompartidoEstudiante bit NOT NULL CONSTRAINT DF_IncidenciasPermanencia_CompartidoEstudiante DEFAULT 0,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_IncidenciasPermanencia_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_IncidenciasPermanencia_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_IncidenciasPermanencia_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_IncidenciasPermanencia_Programa FOREIGN KEY (ProgramaId) REFERENCES dbo.Programas(ProgramaId),
    CONSTRAINT FK_IncidenciasPermanencia_CreadoPor FOREIGN KEY (CreadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_IncidenciasPermanencia_Responsable FOREIGN KEY (ResponsableUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_IncidenciasPermanencia_Estado CHECK (Estado IN (N'Abierta', N'En seguimiento', N'Derivada', N'Atendida', N'Cerrada'))
  );
  CREATE INDEX IX_IncidenciasPermanencia_ProgramaEstado ON dbo.IncidenciasPermanencia(ProgramaId, Estado, FechaIncidencia DESC);
END;
GO

IF OBJECT_ID(N'dbo.HistorialIncidencias', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.HistorialIncidencias (
    HistorialId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_HistorialIncidencias PRIMARY KEY,
    IncidenciaId bigint NOT NULL,
    UsuarioId bigint NOT NULL,
    NombreAccion nvarchar(60) NOT NULL,
    EstadoAnterior nvarchar(30) NULL,
    EstadoNuevo nvarchar(30) NULL,
    Comentario nvarchar(1500) NOT NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_HistorialIncidencias_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_HistorialIncidencias_Incidencia FOREIGN KEY (IncidenciaId) REFERENCES dbo.IncidenciasPermanencia(IncidenciaId),
    CONSTRAINT FK_HistorialIncidencias_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId)
  );
END;
GO

IF OBJECT_ID(N'dbo.CasosTutoria', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CasosTutoria (
    CasoTutoriaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_CasosTutoria PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_CasosTutoria_IdPublico UNIQUE,
    TutorUsuarioId bigint NOT NULL,
    EstudianteId bigint NOT NULL,
    FechaCaso date NOT NULL,
    TipoCaso nvarchar(60) NOT NULL,
    Prioridad nvarchar(20) NOT NULL,
    Descripcion nvarchar(1500) NOT NULL,
    AccionesRealizadas nvarchar(1500) NULL,
    ArchivoEvidencia nvarchar(260) NULL,
    NombreOriginalEvidencia nvarchar(260) NULL,
    Estado nvarchar(30) NOT NULL CONSTRAINT DF_CasosTutoria_Estado DEFAULT N'Abierto',
    CompartidoFamilia bit NOT NULL CONSTRAINT DF_CasosTutoria_CompartidoFamilia DEFAULT 0,
    CompartidoEstudiante bit NOT NULL CONSTRAINT DF_CasosTutoria_CompartidoEstudiante DEFAULT 0,
    ProximaFechaSeguimiento date NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_CasosTutoria_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_CasosTutoria_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CasosTutoria_Tutor FOREIGN KEY (TutorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_CasosTutoria_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT CK_CasosTutoria_Prioridad CHECK (Prioridad IN (N'Baja', N'Media', N'Alta', N'Crítica')),
    CONSTRAINT CK_CasosTutoria_Estado CHECK (Estado IN (N'Abierto', N'En seguimiento', N'Derivado', N'Cerrado'))
  );
  CREATE INDEX IX_CasosTutoria_TutorEstado ON dbo.CasosTutoria(TutorUsuarioId, Estado, FechaCaso DESC);
END;
GO

IF OBJECT_ID(N'dbo.ComentariosCasoTutoria', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ComentariosCasoTutoria (
    ComentarioId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ComentariosCasoTutoria PRIMARY KEY,
    CasoTutoriaId bigint NOT NULL,
    UsuarioId bigint NOT NULL,
    TextoComentario nvarchar(1500) NOT NULL,
    EsEvidenciaCierre bit NOT NULL CONSTRAINT DF_ComentariosCasoTutoria_Cierre DEFAULT 0,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_ComentariosCasoTutoria_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ComentariosCasoTutoria_Caso FOREIGN KEY (CasoTutoriaId) REFERENCES dbo.CasosTutoria(CasoTutoriaId),
    CONSTRAINT FK_ComentariosCasoTutoria_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId)
  );
END;
GO

IF OBJECT_ID(N'dbo.Alertas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Alertas (
    AlertaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Alertas PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Alertas_IdPublico UNIQUE,
    EstudianteId bigint NULL,
    UsuarioAsignadoId bigint NULL,
    CreadoPorUsuarioId bigint NULL,
    TipoAlerta nvarchar(80) NOT NULL,
    Titulo nvarchar(180) NOT NULL,
    Descripcion nvarchar(1000) NULL,
    Prioridad nvarchar(20) NOT NULL CONSTRAINT DF_Alertas_Prioridad DEFAULT N'Media',
    Estado nvarchar(30) NOT NULL CONSTRAINT DF_Alertas_Estado DEFAULT N'Pendiente',
    AccionRealizada nvarchar(1000) NULL,
    FechaRevision datetime2(3) NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Alertas_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Alertas_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_Alertas_UsuarioAsignado FOREIGN KEY (UsuarioAsignadoId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_Alertas_CreadoPor FOREIGN KEY (CreadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_Alertas_Estado CHECK (Estado IN (N'Pendiente', N'Revisada', N'Derivada', N'Cerrada'))
  );
END;
GO

IF OBJECT_ID(N'dbo.Mensajes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Mensajes (
    MensajeId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Mensajes PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Mensajes_IdPublico UNIQUE,
    RemitenteUsuarioId bigint NOT NULL,
    EstudianteId bigint NULL,
    Asunto nvarchar(180) NOT NULL,
    Cuerpo nvarchar(max) NOT NULL,
    AlcanceDestinatario nvarchar(120) NOT NULL,
    FechaEnvio datetime2(3) NOT NULL CONSTRAINT DF_Mensajes_FechaEnvio DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Mensajes_Remitente FOREIGN KEY (RemitenteUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_Mensajes_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId)
  );
END;
GO

IF OBJECT_ID(N'dbo.Reuniones', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Reuniones (
    ReunionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reuniones PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Reuniones_IdPublico UNIQUE,
    EstudianteId bigint NOT NULL,
    ResponsableUsuarioId bigint NOT NULL,
    FechaReunion date NOT NULL,
    HoraReunion time(0) NOT NULL,
    Modalidad nvarchar(30) NOT NULL CONSTRAINT DF_Reuniones_Modalidad DEFAULT N'Presencial',
    Tema nvarchar(300) NOT NULL,
    Participantes nvarchar(500) NULL,
    Acuerdos nvarchar(1500) NULL,
    Seguimiento nvarchar(1000) NULL,
    Estado nvarchar(40) NOT NULL CONSTRAINT DF_Reuniones_Estado DEFAULT N'Programada',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Reuniones_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_Reuniones_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Reuniones_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_Reuniones_Responsable FOREIGN KEY (ResponsableUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_Reuniones_Modalidad CHECK (Modalidad IN (N'Presencial', N'Virtual'))
  );
END;
GO

IF OBJECT_ID(N'dbo.Notificaciones', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Notificaciones (
    NotificacionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notificaciones PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Notificaciones_IdPublico UNIQUE,
    UsuarioId bigint NOT NULL,
    EstudianteId bigint NULL,
    Titulo nvarchar(180) NOT NULL,
    Mensaje nvarchar(1000) NOT NULL,
    TipoNotificacion nvarchar(60) NULL,
    EstaLeida bit NOT NULL CONSTRAINT DF_Notificaciones_EstaLeida DEFAULT 0,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_Notificaciones_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaLectura datetime2(3) NULL,
    CONSTRAINT FK_Notificaciones_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_Notificaciones_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId)
  );
  CREATE INDEX IX_Notificaciones_UsuarioLectura ON dbo.Notificaciones(UsuarioId, EstaLeida, FechaCreacion DESC);
END;
GO

IF OBJECT_ID(N'dbo.Avisos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Avisos (
    AvisoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Avisos PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_Avisos_IdPublico UNIQUE,
    ProgramaId bigint NULL,
    EstudianteId bigint NULL,
    CreadoPorUsuarioId bigint NULL,
    Titulo nvarchar(180) NOT NULL,
    Mensaje nvarchar(1500) NOT NULL,
    Audiencia nvarchar(80) NOT NULL,
    FechaPublicacion datetime2(3) NOT NULL CONSTRAINT DF_Avisos_FechaPublicacion DEFAULT SYSUTCDATETIME(),
    FechaExpiracion datetime2(3) NULL,
    CONSTRAINT FK_Avisos_Programa FOREIGN KEY (ProgramaId) REFERENCES dbo.Programas(ProgramaId),
    CONSTRAINT FK_Avisos_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_Avisos_CreadoPor FOREIGN KEY (CreadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId)
  );
END;
GO

IF OBJECT_ID(N'dbo.IncidenciasSeguridad', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.IncidenciasSeguridad (
    IncidenciaSeguridadId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_IncidenciasSeguridad PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_IncidenciasSeguridad_IdPublico UNIQUE,
    EstudianteId bigint NULL,
    SolicitudSalidaId bigint NULL,
    CreadoPorUsuarioId bigint NOT NULL,
    TipoIncidencia nvarchar(100) NOT NULL,
    Descripcion nvarchar(1500) NOT NULL,
    Prioridad nvarchar(20) NOT NULL,
    ArchivoEvidencia nvarchar(260) NULL,
    PuntoControl nvarchar(100) NOT NULL,
    Estado nvarchar(30) NOT NULL CONSTRAINT DF_IncidenciasSeguridad_Estado DEFAULT N'Abierta',
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_IncidenciasSeguridad_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_IncidenciasSeguridad_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_IncidenciasSeguridad_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId),
    CONSTRAINT FK_IncidenciasSeguridad_SolicitudSalida FOREIGN KEY (SolicitudSalidaId) REFERENCES dbo.SolicitudesSalida(SolicitudSalidaId),
    CONSTRAINT FK_IncidenciasSeguridad_CreadoPor FOREIGN KEY (CreadoPorUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT CK_IncidenciasSeguridad_Estado CHECK (Estado IN (N'Abierta', N'En revisión', N'Cerrada'))
  );
END;
GO

IF OBJECT_ID(N'dbo.RegistrosAcceso', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.RegistrosAcceso (
    RegistroAccesoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_RegistrosAcceso PRIMARY KEY,
    IdPublico nvarchar(40) NOT NULL CONSTRAINT UQ_RegistrosAcceso_IdPublico UNIQUE,
    VigilanteUsuarioId bigint NOT NULL,
    EstudianteId bigint NOT NULL,
    PuntoControl nvarchar(100) NOT NULL,
    FechaRegistro datetime2(3) NOT NULL CONSTRAINT DF_RegistrosAcceso_FechaRegistro DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_RegistrosAcceso_Vigilante FOREIGN KEY (VigilanteUsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
    CONSTRAINT FK_RegistrosAcceso_Estudiante FOREIGN KEY (EstudianteId) REFERENCES dbo.Estudiantes(EstudianteId)
  );
  CREATE INDEX IX_RegistrosAcceso_Fecha ON dbo.RegistrosAcceso(FechaRegistro DESC, PuntoControl);
END;
GO

IF OBJECT_ID(N'dbo.BitacoraAuditoria', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.BitacoraAuditoria (
    BitacoraId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_BitacoraAuditoria PRIMARY KEY,
    UsuarioId bigint NULL,
    ClaveRol nvarchar(30) NULL,
    NombreEntidad nvarchar(80) NOT NULL,
    IdPublicoEntidad nvarchar(60) NULL,
    NombreAccion nvarchar(80) NOT NULL,
    Detalle nvarchar(2000) NULL,
    DireccionIp nvarchar(64) NULL,
    AgenteUsuario nvarchar(500) NULL,
    FechaCreacion datetime2(3) NOT NULL CONSTRAINT DF_BitacoraAuditoria_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_BitacoraAuditoria_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId)
  );
  CREATE INDEX IX_BitacoraAuditoria_EntidadFecha ON dbo.BitacoraAuditoria(NombreEntidad, IdPublicoEntidad, FechaCreacion DESC);
  CREATE INDEX IX_BitacoraAuditoria_UsuarioFecha ON dbo.BitacoraAuditoria(UsuarioId, FechaCreacion DESC);
END;
GO

IF OBJECT_ID(N'dbo.EstadoAplicacion', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EstadoAplicacion (
    EstadoAplicacionId tinyint NOT NULL CONSTRAINT PK_EstadoAplicacion PRIMARY KEY,
    VersionEsquema int NOT NULL,
    DatosJson nvarchar(max) NOT NULL,
    FechaActualizacion datetime2(3) NOT NULL CONSTRAINT DF_EstadoAplicacion_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_EstadoAplicacion_Unico CHECK (EstadoAplicacionId = 1),
    CONSTRAINT CK_EstadoAplicacion_Json CHECK (ISJSON(DatosJson) = 1)
  );
END;
GO

CREATE OR ALTER VIEW dbo.vw_ResumenAsistenciaEstudiante
AS
  SELECT
    s.EstudianteId,
    s.IdPublico AS EstudianteIdPublico,
    s.Nombre AS NombreEstudiante,
    p.Nombre AS NombrePrograma,
    COUNT_BIG(ar.AsistenciaId) AS TotalRegistros,
    SUM(CASE WHEN ar.EstadoAsistencia = N'Presente' THEN 1 ELSE 0 END) AS TotalPresentes,
    SUM(CASE WHEN ar.EstadoAsistencia = N'Tardanza' THEN 1 ELSE 0 END) AS TotalTardanzas,
    SUM(CASE WHEN ar.EstadoAsistencia = N'Ausente' THEN 1 ELSE 0 END) AS TotalAusentes,
    CAST(100.0 * SUM(CASE WHEN ar.EstadoAsistencia = N'Presente' THEN 1 ELSE 0 END) / NULLIF(COUNT(ar.AsistenciaId), 0) AS decimal(5,2)) AS PorcentajeAsistencia
  FROM dbo.Estudiantes s
  INNER JOIN dbo.Programas p ON p.ProgramaId = s.ProgramaId
  LEFT JOIN dbo.RegistrosAsistencia ar ON ar.EstudianteId = s.EstudianteId
  GROUP BY s.EstudianteId, s.IdPublico, s.Nombre, p.Nombre;
GO

CREATE OR ALTER VIEW dbo.vw_BoletasSalidaVigentes
AS
  SELECT
    er.SolicitudSalidaId,
    er.IdPublico,
    s.IdPublico AS EstudianteIdPublico,
    s.Nombre AS NombreEstudiante,
    p.Nombre AS NombrePrograma,
    er.FechaSolicitada,
    er.HoraSolicitada,
    er.Motivo,
    er.Estado,
    er.VigenteDesde,
    er.VigenteHasta,
    er.CodigoQr
  FROM dbo.SolicitudesSalida er
  INNER JOIN dbo.Estudiantes s ON s.EstudianteId = er.EstudianteId
  INNER JOIN dbo.Programas p ON p.ProgramaId = s.ProgramaId
  WHERE er.Estado = N'Autorizada' AND er.FechaUso IS NULL;
GO

