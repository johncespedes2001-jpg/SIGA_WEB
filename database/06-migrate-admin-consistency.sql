:setvar DatabaseName "SIGA"

USE [$(DatabaseName)];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.EstadoAplicacion', N'U') IS NULL
  THROW 51000, 'No existe dbo.EstadoAplicacion. Ejecute primero 02-schema.sql.', 1;

BEGIN TRANSACTION;

DECLARE @datos nvarchar(max);
SELECT @datos = DatosJson
FROM dbo.EstadoAplicacion WITH (UPDLOCK, HOLDLOCK)
WHERE EstadoAplicacionId = 1;

IF @datos IS NULL OR ISJSON(@datos) <> 1
  THROW 51000, 'El estado de SIGA no existe o no contiene JSON valido.', 1;

DECLARE @cuentas TABLE (Indice int PRIMARY KEY, Datos nvarchar(max) NOT NULL);
DECLARE @personal TABLE (Indice int PRIMARY KEY, Datos nvarchar(max) NOT NULL);
DECLARE @estudiantes TABLE (Indice int PRIMARY KEY, Datos nvarchar(max) NOT NULL);

INSERT @cuentas (Indice, Datos)
SELECT CONVERT(int, [key]), value FROM OPENJSON(@datos, '$.accounts');

INSERT @personal (Indice, Datos)
SELECT CONVERT(int, [key]), value FROM OPENJSON(@datos, '$.staff');

INSERT @estudiantes (Indice, Datos)
SELECT CONVERT(int, [key]), value FROM OPENJSON(@datos, '$.students');

-- Tutor deja de ser una cuenta independiente: se conserva como funcion del docente.
UPDATE c
SET Datos = JSON_MODIFY(
              JSON_MODIFY(
                JSON_MODIFY(c.Datos, '$.role', 'docente'),
                '$.position',
                CASE
                  WHEN NULLIF(JSON_VALUE(c.Datos, '$.position'), '') IS NULL
                    OR JSON_VALUE(c.Datos, '$.position') LIKE N'Tutor%'
                  THEN N'Docente con funcion de tutor'
                  ELSE JSON_VALUE(c.Datos, '$.position')
                END),
              '$.roles', JSON_QUERY(N'["docente","tutor"]'))
FROM @cuentas c
WHERE JSON_VALUE(c.Datos, '$.role') = 'tutor';

UPDATE c
SET Datos = JSON_MODIFY(c.Datos, '$.roles', JSON_QUERY(N'["docente","tutor"]'))
FROM @cuentas c
WHERE EXISTS (
  SELECT 1 FROM OPENJSON(c.Datos, '$.roles') r WHERE r.value = 'tutor'
)
AND NOT EXISTS (
  SELECT 1 FROM OPENJSON(c.Datos, '$.roles') r WHERE r.value = 'docente'
);

UPDATE p
SET Datos = JSON_MODIFY(
              JSON_MODIFY(p.Datos, '$.role', 'Docente'),
              '$.roles', JSON_QUERY(N'["docente","tutor"]'))
FROM @personal p
WHERE JSON_VALUE(p.Datos, '$.role') = 'Tutor';

UPDATE p
SET Datos = JSON_MODIFY(p.Datos, '$.roles', JSON_QUERY(N'["docente","tutor"]'))
FROM @personal p
WHERE EXISTS (
  SELECT 1 FROM OPENJSON(p.Datos, '$.roles') r WHERE r.value = 'tutor'
)
AND NOT EXISTS (
  SELECT 1 FROM OPENJSON(p.Datos, '$.roles') r WHERE r.value = 'docente'
);

-- Un registro activo sin cuenta no debe mostrarse como usuario con acceso.
UPDATE p
SET Datos = JSON_MODIFY(p.Datos, '$.state', 'Inactivo')
FROM @personal p
WHERE JSON_VALUE(p.Datos, '$.state') = 'Activo'
AND NOT EXISTS (
  SELECT 1
  FROM @cuentas c
  WHERE JSON_VALUE(c.Datos, '$.id') = JSON_VALUE(p.Datos, '$.accountId')
     OR LOWER(JSON_VALUE(c.Datos, '$.email')) = LOWER(JSON_VALUE(p.Datos, '$.email'))
);

-- Sincroniza identidad, estado, programa y asignacion del vigilante entre ambas vistas.
DECLARE @indicePersonal int, @registroPersonal nvarchar(max), @indiceCuenta int, @registroCuenta nvarchar(max);
DECLARE personal_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Indice, Datos FROM @personal ORDER BY Indice;
OPEN personal_cursor;
FETCH NEXT FROM personal_cursor INTO @indicePersonal, @registroPersonal;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @indiceCuenta = NULL;
  SET @registroCuenta = NULL;
  SELECT TOP (1) @indiceCuenta = c.Indice, @registroCuenta = c.Datos
  FROM @cuentas c
  WHERE JSON_VALUE(c.Datos, '$.id') = JSON_VALUE(@registroPersonal, '$.accountId')
     OR LOWER(JSON_VALUE(c.Datos, '$.email')) = LOWER(JSON_VALUE(@registroPersonal, '$.email'))
  ORDER BY CASE WHEN JSON_VALUE(c.Datos, '$.id') = JSON_VALUE(@registroPersonal, '$.accountId') THEN 0 ELSE 1 END;

  IF @indiceCuenta IS NOT NULL
  BEGIN
    SET @registroPersonal = JSON_MODIFY(@registroPersonal, '$.accountId', JSON_VALUE(@registroCuenta, '$.id'));
    IF NULLIF(JSON_VALUE(@registroCuenta, '$.name'), '') IS NOT NULL
      SET @registroPersonal = JSON_MODIFY(@registroPersonal, '$.name', JSON_VALUE(@registroCuenta, '$.name'));
    IF NULLIF(JSON_VALUE(@registroCuenta, '$.email'), '') IS NOT NULL
      SET @registroPersonal = JSON_MODIFY(@registroPersonal, '$.email', JSON_VALUE(@registroCuenta, '$.email'));
    IF NULLIF(JSON_VALUE(@registroCuenta, '$.documentType'), '') IS NOT NULL
      SET @registroPersonal = JSON_MODIFY(@registroPersonal, '$.documentType', JSON_VALUE(@registroCuenta, '$.documentType'));
    IF NULLIF(JSON_VALUE(@registroCuenta, '$.document'), '') IS NOT NULL
      SET @registroPersonal = JSON_MODIFY(@registroPersonal, '$.document', JSON_VALUE(@registroCuenta, '$.document'));
    IF NULLIF(JSON_VALUE(@registroCuenta, '$.state'), '') IS NOT NULL
      SET @registroPersonal = JSON_MODIFY(@registroPersonal, '$.state', JSON_VALUE(@registroCuenta, '$.state'));

    SET @registroCuenta = JSON_MODIFY(
      @registroCuenta,
      '$.program',
      CASE WHEN JSON_VALUE(@registroPersonal, '$.program') = 'Institucional'
        THEN '' ELSE COALESCE(JSON_VALUE(@registroPersonal, '$.program'), '') END);

    IF JSON_VALUE(@registroPersonal, '$.role') = 'Vigilante'
    BEGIN
      DECLARE @turno nvarchar(100) = COALESCE(NULLIF(JSON_VALUE(@registroPersonal, '$.shift'), ''), JSON_VALUE(@registroCuenta, '$.shift'), '');
      DECLARE @punto nvarchar(200) = COALESCE(NULLIF(JSON_VALUE(@registroPersonal, '$.pointOfControl'), ''), NULLIF(JSON_VALUE(@registroCuenta, '$.pointOfControl'), ''), N'Puerta principal');
      SET @registroPersonal = JSON_MODIFY(JSON_MODIFY(@registroPersonal, '$.shift', @turno), '$.pointOfControl', @punto);
      SET @registroCuenta = JSON_MODIFY(JSON_MODIFY(@registroCuenta, '$.shift', @turno), '$.pointOfControl', @punto);
    END;

    UPDATE @cuentas SET Datos = @registroCuenta WHERE Indice = @indiceCuenta;
    UPDATE @personal SET Datos = @registroPersonal WHERE Indice = @indicePersonal;
  END;

  FETCH NEXT FROM personal_cursor INTO @indicePersonal, @registroPersonal;
END;
CLOSE personal_cursor;
DEALLOCATE personal_cursor;

-- Elimina asignaciones de tutor que ya no cumplen acceso, estado o programa.
UPDATE e
SET Datos = JSON_MODIFY(e.Datos, '$.tutorId', '')
FROM @estudiantes e
WHERE NULLIF(JSON_VALUE(e.Datos, '$.tutorId'), '') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM @personal p
  JOIN @cuentas c
    ON JSON_VALUE(c.Datos, '$.id') = JSON_VALUE(p.Datos, '$.accountId')
    OR LOWER(JSON_VALUE(c.Datos, '$.email')) = LOWER(JSON_VALUE(p.Datos, '$.email'))
  WHERE JSON_VALUE(p.Datos, '$.id') = JSON_VALUE(e.Datos, '$.tutorId')
    AND JSON_VALUE(p.Datos, '$.state') = 'Activo'
    AND JSON_VALUE(c.Datos, '$.state') = 'Activo'
    AND EXISTS (SELECT 1 FROM OPENJSON(c.Datos, '$.roles') r WHERE r.value = 'docente')
    AND EXISTS (SELECT 1 FROM OPENJSON(c.Datos, '$.roles') r WHERE r.value = 'tutor')
    AND JSON_VALUE(p.Datos, '$.program') = JSON_VALUE(e.Datos, '$.program')
    AND JSON_VALUE(c.Datos, '$.program') = JSON_VALUE(e.Datos, '$.program')
);

DECLARE @cuentasJson nvarchar(max) = COALESCE((SELECT '[' + STRING_AGG(CONVERT(nvarchar(max), Datos), ',') WITHIN GROUP (ORDER BY Indice) + ']' FROM @cuentas), '[]');
DECLARE @personalJson nvarchar(max) = COALESCE((SELECT '[' + STRING_AGG(CONVERT(nvarchar(max), Datos), ',') WITHIN GROUP (ORDER BY Indice) + ']' FROM @personal), '[]');
DECLARE @estudiantesJson nvarchar(max) = COALESCE((SELECT '[' + STRING_AGG(CONVERT(nvarchar(max), Datos), ',') WITHIN GROUP (ORDER BY Indice) + ']' FROM @estudiantes), '[]');

SET @datos = JSON_MODIFY(@datos, '$.accounts', JSON_QUERY(@cuentasJson));
SET @datos = JSON_MODIFY(@datos, '$.staff', JSON_QUERY(@personalJson));
SET @datos = JSON_MODIFY(@datos, '$.students', JSON_QUERY(@estudiantesJson));
SET @datos = JSON_MODIFY(@datos, '$.schemaVersion', 5);
IF JSON_QUERY(@datos, '$.passwordRecoveryRequests') IS NULL SET @datos = JSON_MODIFY(@datos, '$.passwordRecoveryRequests', JSON_QUERY('[]'));
IF JSON_QUERY(@datos, '$.securityAudit') IS NULL SET @datos = JSON_MODIFY(@datos, '$.securityAudit', JSON_QUERY('[]'));
IF JSON_QUERY(@datos, '$.adminAudit') IS NULL SET @datos = JSON_MODIFY(@datos, '$.adminAudit', JSON_QUERY('[]'));

IF ISJSON(@datos) <> 1
  THROW 51000, 'La migracion produjo un estado JSON no valido.', 1;

IF OBJECT_ID(N'dbo.SincronizarEstadoRelacional', N'P') IS NOT NULL
  EXEC dbo.SincronizarEstadoRelacional @DatosJson = @datos;

UPDATE dbo.EstadoAplicacion
SET VersionEsquema = 5,
    DatosJson = @datos,
    FechaActualizacion = SYSUTCDATETIME()
WHERE EstadoAplicacionId = 1;

COMMIT TRANSACTION;

SELECT VersionEsquema, FechaActualizacion
FROM dbo.EstadoAplicacion
WHERE EstadoAplicacionId = 1;
GO
