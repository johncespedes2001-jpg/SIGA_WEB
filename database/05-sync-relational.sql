:setvar DatabaseName "SIGA"

USE [$(DatabaseName)];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE OR ALTER PROCEDURE dbo.SincronizarEstadoRelacional
  @DatosJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  IF ISJSON(@DatosJson) <> 1 THROW 51000, 'El estado de SIGA no contiene JSON válido.', 1;

  MERGE dbo.Programas AS destino
  USING (
    SELECT IdPublico, Nombre, Estado
    FROM OPENJSON(@DatosJson, '$.programs') WITH (
      IdPublico nvarchar(30) '$.id', Nombre nvarchar(180) '$.name', Estado nvarchar(20) '$.state'
    )
  ) AS origen ON destino.IdPublico = origen.IdPublico
  WHEN MATCHED THEN UPDATE SET Nombre = origen.Nombre, Estado = origen.Estado, FechaActualizacion = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT (IdPublico, Nombre, Estado) VALUES (origen.IdPublico, origen.Nombre, origen.Estado);

  MERGE dbo.Usuarios AS destino
  USING (
    SELECT a.IdPublico, p.ProgramaId, a.Nombre, a.Correo, NULLIF(a.NombreUsuario, N'') AS NombreUsuario,
      ISNULL(NULLIF(a.TipoDocumento, N''), N'DNI') AS TipoDocumento, NULLIF(a.Documento, N'') AS Documento, NULLIF(a.CodigoInstitucional, N'') AS CodigoInstitucional,
      NULLIF(a.Cargo, N'') AS Cargo, NULLIF(a.Telefono, N'') AS Telefono,
      NULLIF(a.CorreoContacto, N'') AS CorreoContacto, NULLIF(a.Direccion, N'') AS Direccion,
      NULLIF(a.Biografia, N'') AS Biografia, a.HashContrasena, NULLIF(a.ArchivoFoto, N'') AS ArchivoFoto,
      a.Estado, a.VersionSesion
    FROM OPENJSON(@DatosJson, '$.accounts') WITH (
      IdPublico nvarchar(40) '$.id', Nombre nvarchar(180) '$.name', Correo nvarchar(254) '$.email',
      NombreUsuario nvarchar(100) '$.username', TipoDocumento nvarchar(10) '$.documentType', Documento nvarchar(30) '$.document',
      CodigoInstitucional nvarchar(40) '$.institutionalCode', Cargo nvarchar(120) '$.position',
      Telefono nvarchar(30) '$.phone', CorreoContacto nvarchar(254) '$.contactEmail',
      Direccion nvarchar(250) '$.address', Biografia nvarchar(500) '$.bio',
      HashContrasena nvarchar(300) '$.passwordHash', ArchivoFoto nvarchar(260) '$.photoFile',
      Estado nvarchar(20) '$.state', Programa nvarchar(180) '$.program', VersionSesion int '$.sessionVersion'
    ) a
    LEFT JOIN dbo.Programas p ON p.Nombre = a.Programa
  ) AS origen ON destino.IdPublico = origen.IdPublico
  WHEN MATCHED THEN UPDATE SET ProgramaId = origen.ProgramaId, Nombre = origen.Nombre, Correo = origen.Correo,
    NombreUsuario = origen.NombreUsuario, TipoDocumento = origen.TipoDocumento, Documento = origen.Documento, CodigoInstitucional = origen.CodigoInstitucional,
    Cargo = origen.Cargo, Telefono = origen.Telefono, CorreoContacto = origen.CorreoContacto,
    Direccion = origen.Direccion, Biografia = origen.Biografia, HashContrasena = origen.HashContrasena,
    ArchivoFoto = origen.ArchivoFoto, Estado = origen.Estado, VersionSesion = ISNULL(origen.VersionSesion, 0),
    FechaActualizacion = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT (IdPublico, ProgramaId, Nombre, Correo, NombreUsuario, TipoDocumento, Documento,
    CodigoInstitucional, Cargo, Telefono, CorreoContacto, Direccion, Biografia, HashContrasena,
    ArchivoFoto, Estado, VersionSesion)
    VALUES (origen.IdPublico, origen.ProgramaId, origen.Nombre, origen.Correo, origen.NombreUsuario,
      origen.TipoDocumento, origen.Documento, origen.CodigoInstitucional, origen.Cargo, origen.Telefono, origen.CorreoContacto,
      origen.Direccion, origen.Biografia, origen.HashContrasena, origen.ArchivoFoto, origen.Estado,
      ISNULL(origen.VersionSesion, 0));

  DELETE ur
  FROM dbo.UsuariosRoles ur
  INNER JOIN dbo.Usuarios u ON u.UsuarioId = ur.UsuarioId
  WHERE EXISTS (SELECT 1 FROM OPENJSON(@DatosJson, '$.accounts') a WHERE JSON_VALUE(a.value, '$.id') = u.IdPublico);

  ;WITH Cuentas AS (
    SELECT value, JSON_VALUE(value, '$.id') IdPublico, JSON_VALUE(value, '$.role') RolPrincipal
    FROM OPENJSON(@DatosJson, '$.accounts')
  ), RolesCuenta AS (
    SELECT IdPublico, RolPrincipal ClaveRol, CAST(1 AS bit) EsPrincipal FROM Cuentas
    UNION ALL
    SELECT c.IdPublico, r.value, CAST(CASE WHEN r.value = c.RolPrincipal THEN 1 ELSE 0 END AS bit)
    FROM Cuentas c CROSS APPLY OPENJSON(c.value, '$.roles') r
  ), RolesUnicos AS (
    SELECT IdPublico, ClaveRol, CAST(MAX(CAST(EsPrincipal AS tinyint)) AS bit) EsPrincipal
    FROM RolesCuenta WHERE ClaveRol IS NOT NULL GROUP BY IdPublico, ClaveRol
  )
  INSERT dbo.UsuariosRoles (UsuarioId, RolId, EsPrincipal)
  SELECT u.UsuarioId, r.RolId, ru.EsPrincipal
  FROM RolesUnicos ru INNER JOIN dbo.Usuarios u ON u.IdPublico = ru.IdPublico
  INNER JOIN dbo.Roles r ON r.ClaveRol = ru.ClaveRol;

  DELETE pnu
  FROM dbo.PreferenciasNotificacionUsuario pnu
  INNER JOIN dbo.Usuarios u ON u.UsuarioId = pnu.UsuarioId
  WHERE EXISTS (SELECT 1 FROM OPENJSON(@DatosJson, '$.accounts') a WHERE JSON_VALUE(a.value, '$.id') = u.IdPublico);
  INSERT dbo.PreferenciasNotificacionUsuario (UsuarioId, ClavePreferencia, EstaHabilitado)
  SELECT DISTINCT u.UsuarioId, pref.value, 1
  FROM OPENJSON(@DatosJson, '$.accounts') a
  INNER JOIN dbo.Usuarios u ON u.IdPublico = JSON_VALUE(a.value, '$.id')
  CROSS APPLY OPENJSON(a.value, '$.notificationPreferences') pref
  WHERE NULLIF(pref.value, N'') IS NOT NULL;

  MERGE dbo.Personal AS destino
  USING (
    SELECT s.IdPublico, u.UsuarioId, p.ProgramaId, ISNULL(NULLIF(s.TipoDocumento, N''), N'DNI') TipoDocumento, s.Documento, s.Nombre, s.Correo,
      s.NombreCargo, NULLIF(s.NombreTurno, N'') NombreTurno, NULLIF(s.PuntoControl, N'') PuntoControl, s.Estado
    FROM OPENJSON(@DatosJson, '$.staff') WITH (
      IdPublico nvarchar(40) '$.id', CuentaId nvarchar(40) '$.accountId', TipoDocumento nvarchar(10) '$.documentType', Documento nvarchar(30) '$.document',
      Nombre nvarchar(180) '$.name', Correo nvarchar(254) '$.email', NombreCargo nvarchar(80) '$.role',
      Programa nvarchar(180) '$.program', NombreTurno nvarchar(40) '$.shift', PuntoControl nvarchar(100) '$.pointOfControl',
      Estado nvarchar(20) '$.state'
    ) s LEFT JOIN dbo.Usuarios u ON u.IdPublico = s.CuentaId LEFT JOIN dbo.Programas p ON p.Nombre = s.Programa
  ) AS origen ON destino.IdPublico = origen.IdPublico
  WHEN MATCHED THEN UPDATE SET UsuarioId = origen.UsuarioId, ProgramaId = origen.ProgramaId, TipoDocumento = origen.TipoDocumento, Documento = origen.Documento,
    Nombre = origen.Nombre, Correo = origen.Correo, NombreCargo = origen.NombreCargo, NombreTurno = origen.NombreTurno,
    PuntoControl = origen.PuntoControl, Estado = origen.Estado, FechaActualizacion = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT (IdPublico, UsuarioId, ProgramaId, TipoDocumento, Documento, Nombre, Correo, NombreCargo, NombreTurno, PuntoControl, Estado)
    VALUES (origen.IdPublico, origen.UsuarioId, origen.ProgramaId, origen.TipoDocumento, origen.Documento, origen.Nombre, origen.Correo,
      origen.NombreCargo, origen.NombreTurno, origen.PuntoControl, origen.Estado);

  MERGE dbo.Estudiantes AS destino
  USING (
    SELECT e.IdPublico, cuenta.UsuarioId, p.ProgramaId, tutor.UsuarioId TutorUsuarioId, ISNULL(NULLIF(e.TipoDocumento, N''), N'DNI') TipoDocumento, e.Documento,
      e.Nombre, e.Correo, e.Semestre, ISNULL(NULLIF(e.NombreGrupo, N''), N'Sin grupo') NombreGrupo, e.Estado
    FROM OPENJSON(@DatosJson, '$.students') WITH (
      IdPublico nvarchar(40) '$.id', TipoDocumento nvarchar(10) '$.documentType', Documento nvarchar(30) '$.document', Nombre nvarchar(180) '$.name',
      Correo nvarchar(254) '$.email', Semestre nvarchar(20) '$.semester', NombreGrupo nvarchar(40) '$.group',
      TutorId nvarchar(40) '$.tutorId', Programa nvarchar(180) '$.program', Estado nvarchar(30) '$.state'
    ) e INNER JOIN dbo.Programas p ON p.Nombre = e.Programa
    LEFT JOIN dbo.Personal tutorPersonal ON tutorPersonal.IdPublico = e.TutorId
    LEFT JOIN dbo.Usuarios tutor ON tutor.UsuarioId = tutorPersonal.UsuarioId
    OUTER APPLY (
      SELECT TOP (1) u.UsuarioId FROM OPENJSON(@DatosJson, '$.accounts') a
      INNER JOIN dbo.Usuarios u ON u.IdPublico = JSON_VALUE(a.value, '$.id')
      WHERE JSON_VALUE(a.value, '$.studentId') = e.IdPublico
    ) cuenta
  ) AS origen ON destino.IdPublico = origen.IdPublico
  WHEN MATCHED THEN UPDATE SET UsuarioId = origen.UsuarioId, ProgramaId = origen.ProgramaId,
    TutorUsuarioId = origen.TutorUsuarioId, TipoDocumento = origen.TipoDocumento, Documento = origen.Documento, Nombre = origen.Nombre,
    CorreoInstitucional = origen.Correo, Semestre = origen.Semestre, NombreGrupo = origen.NombreGrupo,
    EstadoMatricula = origen.Estado, FechaActualizacion = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT (IdPublico, UsuarioId, ProgramaId, TutorUsuarioId, TipoDocumento, Documento, Nombre,
    CorreoInstitucional, Semestre, NombreGrupo, EstadoMatricula)
    VALUES (origen.IdPublico, origen.UsuarioId, origen.ProgramaId, origen.TutorUsuarioId, origen.TipoDocumento, origen.Documento,
      origen.Nombre, origen.Correo, origen.Semestre, origen.NombreGrupo, origen.Estado);

  DELETE v FROM dbo.VinculosApoderadoEstudiante v
  INNER JOIN dbo.Usuarios u ON u.UsuarioId = v.ApoderadoUsuarioId
  WHERE EXISTS (SELECT 1 FROM OPENJSON(@DatosJson, '$.accounts') a WHERE JSON_VALUE(a.value, '$.id') = u.IdPublico);
  INSERT dbo.VinculosApoderadoEstudiante (ApoderadoUsuarioId, EstudianteId, Parentesco, EsPrincipal, Estado)
  SELECT u.UsuarioId, e.EstudianteId, COALESCE(NULLIF(JSON_VALUE(a.value, '$.relationship'), N''), N'Apoderado'),
    CAST(CASE WHEN ids.[key] = 0 THEN 1 ELSE 0 END AS bit), N'Activo'
  FROM OPENJSON(@DatosJson, '$.accounts') a
  INNER JOIN dbo.Usuarios u ON u.IdPublico = JSON_VALUE(a.value, '$.id')
  CROSS APPLY OPENJSON(a.value, '$.studentIds') ids
  INNER JOIN dbo.Estudiantes e ON e.IdPublico = ids.value
  WHERE JSON_VALUE(a.value, '$.role') = N'padre';

  MERGE dbo.Clases AS destino
  USING (
    SELECT c.IdPublico, p.ProgramaId, u.UsuarioId DocenteUsuarioId, c.NombreCurso, c.NombreGrupo,
      NULLIF(c.NombreSeccion, N'') NombreSeccion, c.Semestre, NULLIF(c.NombreAula, N'') NombreAula, c.Horario,
      NULLIF(c.DiaSemana, N'') DiaSemana, COALESCE(NULLIF(c.Modalidad, N''), N'Presencial') Modalidad
    FROM OPENJSON(@DatosJson, '$.classes') WITH (
      IdPublico nvarchar(40) '$.id', DocenteId nvarchar(40) '$.teacherId', NombreCurso nvarchar(180) '$.course',
      NombreGrupo nvarchar(40) '$.group', NombreSeccion nvarchar(20) '$.section', Semestre nvarchar(20) '$.semester',
      Programa nvarchar(180) '$.program', NombreAula nvarchar(100) '$.room', Horario nvarchar(120) '$.schedule',
      DiaSemana nvarchar(20) '$.day', Modalidad nvarchar(20) '$.modality'
    ) c INNER JOIN dbo.Programas p ON p.Nombre = c.Programa INNER JOIN dbo.Usuarios u ON u.IdPublico = c.DocenteId
  ) AS origen ON destino.IdPublico = origen.IdPublico
  WHEN MATCHED THEN UPDATE SET ProgramaId = origen.ProgramaId, DocenteUsuarioId = origen.DocenteUsuarioId,
    NombreCurso = origen.NombreCurso, NombreGrupo = origen.NombreGrupo, NombreSeccion = origen.NombreSeccion,
    Semestre = origen.Semestre, NombreAula = origen.NombreAula, Horario = origen.Horario,
    DiaSemana = origen.DiaSemana, Modalidad = origen.Modalidad,
    Estado = N'Activo', FechaActualizacion = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT (IdPublico, ProgramaId, DocenteUsuarioId, NombreCurso, NombreGrupo,
    NombreSeccion, Semestre, NombreAula, Horario, DiaSemana, Modalidad)
    VALUES (origen.IdPublico, origen.ProgramaId, origen.DocenteUsuarioId, origen.NombreCurso, origen.NombreGrupo,
      origen.NombreSeccion, origen.Semestre, origen.NombreAula, origen.Horario, origen.DiaSemana, origen.Modalidad);

  DELETE m FROM dbo.MatriculasClase m
  WHERE EXISTS (SELECT 1 FROM OPENJSON(@DatosJson, '$.classes') c INNER JOIN dbo.Clases cl ON cl.IdPublico = JSON_VALUE(c.value, '$.id') WHERE cl.ClaseId = m.ClaseId);
  INSERT dbo.MatriculasClase (ClaseId, EstudianteId, Estado)
  SELECT DISTINCT c.ClaseId, e.EstudianteId, N'Activo'
  FROM OPENJSON(@DatosJson, '$.classes') cj
  INNER JOIN dbo.Clases c ON c.IdPublico = JSON_VALUE(cj.value, '$.id')
  CROSS APPLY OPENJSON(cj.value, '$.studentIds') ids
  INNER JOIN dbo.Estudiantes e ON e.IdPublico = ids.value;

  MERGE dbo.RegistrosAsistencia AS destino
  USING (
    SELECT a.IdPublico, c.ClaseId, e.EstudianteId, u.UsuarioId, a.FechaAsistencia, a.EstadoAsistencia
    FROM OPENJSON(@DatosJson, '$.teacherAttendance') WITH (
      IdPublico nvarchar(40) '$.id', DocenteId nvarchar(40) '$.teacherId', ClaseId nvarchar(40) '$.classId',
      EstudianteId nvarchar(40) '$.studentId', FechaAsistencia date '$.date', EstadoAsistencia nvarchar(20) '$.state'
    ) a INNER JOIN dbo.Clases c ON c.IdPublico = a.ClaseId INNER JOIN dbo.Estudiantes e ON e.IdPublico = a.EstudianteId
    INNER JOIN dbo.Usuarios u ON u.IdPublico = a.DocenteId
  ) AS origen ON destino.IdPublico = origen.IdPublico
  WHEN MATCHED THEN UPDATE SET EstadoAsistencia = origen.EstadoAsistencia, FechaActualizacion = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT (IdPublico, ClaseId, EstudianteId, RegistradoPorUsuarioId, FechaAsistencia, EstadoAsistencia)
    VALUES (origen.IdPublico, origen.ClaseId, origen.EstudianteId, origen.UsuarioId, origen.FechaAsistencia, origen.EstadoAsistencia);
END;
GO
