:setvar DatabaseName "SIGA"

USE [$(DatabaseName)];
GO
SET NOCOUNT ON;

SELECT DB_NAME() AS NombreBaseDatos, compatibility_level AS NivelCompatibilidad
FROM sys.databases
WHERE name = DB_NAME();

SELECT COUNT(*) AS CantidadTablas
FROM sys.tables
WHERE schema_id = SCHEMA_ID(N'dbo');

SELECT ClaveRol, Nombre, EstaActivo FROM dbo.Roles ORDER BY RolId;
SELECT IdPublico, Nombre, Estado FROM dbo.Programas ORDER BY ProgramaId;

SELECT
  CASE WHEN OBJECT_ID(N'dbo.EstadoAplicacion', N'U') IS NOT NULL THEN N'OK' ELSE N'FALTA' END AS EstadoAplicacion,
  CASE WHEN OBJECT_ID(N'dbo.RegistrosAsistencia', N'U') IS NOT NULL THEN N'OK' ELSE N'FALTA' END AS RegistrosAsistencia,
  CASE WHEN OBJECT_ID(N'dbo.SolicitudesSalida', N'U') IS NOT NULL THEN N'OK' ELSE N'FALTA' END AS SolicitudesSalida,
  CASE WHEN OBJECT_ID(N'dbo.BitacoraAuditoria', N'U') IS NOT NULL THEN N'OK' ELSE N'FALTA' END AS BitacoraAuditoria;
GO

