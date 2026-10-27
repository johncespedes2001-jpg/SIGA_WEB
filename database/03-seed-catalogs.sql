:setvar DatabaseName "SIGA"

USE [$(DatabaseName)];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'administrador')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'administrador', N'Administrador', N'Configuración institucional, personal, programas, seguridad y reportes.');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'docente')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'docente', N'Docente', N'Clases, estudiantes asignados, asistencia, boletas y reportes docentes.');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'coordinador')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'coordinador', N'Coordinador', N'Gestión académica y permanencia de su programa de estudios.');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'tutor')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'tutor', N'Tutor', N'Acompañamiento y seguimiento de estudiantes asignados.');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'padre')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'padre', N'Padre o apoderado', N'Consulta de estudiantes formalmente vinculados.');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'vigilante')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'vigilante', N'Vigilante', N'Control físico de ingreso y salida mediante QR.');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE ClaveRol = N'estudiante')
  INSERT dbo.Roles (ClaveRol, Nombre, Descripcion) VALUES (N'estudiante', N'Estudiante', N'Consulta y gestión de la información académica personal.');

IF NOT EXISTS (SELECT 1 FROM dbo.Programas WHERE IdPublico = N'PRO-001')
  INSERT dbo.Programas (IdPublico, Nombre) VALUES (N'PRO-001', N'Enfermería Técnica');
IF NOT EXISTS (SELECT 1 FROM dbo.Programas WHERE IdPublico = N'PRO-002')
  INSERT dbo.Programas (IdPublico, Nombre) VALUES (N'PRO-002', N'Acuicultura y Procesamiento Pesquero');
IF NOT EXISTS (SELECT 1 FROM dbo.Programas WHERE IdPublico = N'PRO-003')
  INSERT dbo.Programas (IdPublico, Nombre) VALUES (N'PRO-003', N'Mecatrónica Automotriz');
IF NOT EXISTS (SELECT 1 FROM dbo.Programas WHERE IdPublico = N'PRO-004')
  INSERT dbo.Programas (IdPublico, Nombre) VALUES (N'PRO-004', N'Arquitectura de Plataformas y Servicios de Tecnologías de Información');

COMMIT TRANSACTION;
GO

