# SQL Server para SIGA

Esta carpeta contiene la base de datos SQL Server y el adaptador de persistencia del backend.

## Contenido

- `01-create-database.sql`: crea la base de datos y habilita lecturas consistentes.
- `02-schema.sql`: crea tablas, relaciones, restricciones, índices y vistas.
- `03-seed-catalogs.sql`: registra los siete roles y los cuatro programas iniciales.
- `04-verify.sql`: comprueba la instalación.
- `05-sync-relational.sql`: sincroniza el estado operativo con las tablas relacionales principales.
- `backup.ps1`: crea una copia con checksum, la verifica y aplica retención.
- `setup.ps1`: ejecuta todos los scripts en el orden correcto.
- `sqlserver-store.js`: conecta Node.js con SQL Server sin guardar credenciales en el código.

## Crear la base de datos

Abra PowerShell desde la raíz del proyecto y use el nombre real de su instancia:

```powershell
powershell -ExecutionPolicy Bypass -File .\database\setup.ps1 -ServerInstance ".\SQLEXPRESS"
```

Para una instancia predeterminada puede usar `localhost`. Si usa autenticación SQL, defina primero las credenciales en variables de entorno y agregue `-UseSqlAuthentication`:

```powershell
$env:SIGA_SQL_USER = "siga_app"
$env:SIGA_SQL_PASSWORD = "una-contraseña-segura"
powershell -ExecutionPolicy Bypass -File .\database\setup.ps1 -ServerInstance "localhost" -UseSqlAuthentication
```

## Activar SQL Server en el backend

Copie `.env.example` como referencia y defina las variables en la terminal o en el administrador de secretos del servidor. `npm start` carga `.env` mediante la opción nativa de Node.js; el archivo está excluido de Git y nunca debe compartirse.

```powershell
$env:SIGA_STORAGE = "sqlserver"
$env:SIGA_SQL_SERVER = "localhost"
$env:SIGA_SQL_DATABASE = "SIGA"
$env:SIGA_SQL_USER = "siga_app"
$env:SIGA_SQL_PASSWORD = "una-contraseña-segura"
npm start
```

También puede definir `SIGA_SQL_CONNECTION_STRING` y omitir los parámetros separados.

### Configuración local automatizada

Para la instancia local `SIGA2025`, habilite TCP/IP en el Administrador de configuración de SQL Server, asigne `1433` a `IPAll` y reinicie el servicio. Después ejecute:

```powershell
npm run db:enable-tcp
npm run db:configure-app -- -ServerInstance ".\SIGA2025"
```

`db:enable-tcp` requiere abrir PowerShell o Visual Studio Code como Administrador.

El comando crea un inicio de sesión exclusivo `siga_app`, le concede acceso al estado compatible y al procedimiento de sincronización, valida la conexión TCP y genera un `.env` privado con contraseña SQL y secreto de sesión aleatorios. No use la cuenta `sa` desde la aplicación.

## Estrategia de migración

El backend conserva un estado compatible para no romper la lógica validada de los siete roles. En la misma transacción, `dbo.SincronizarEstadoRelacional` actualiza programas, usuarios, roles, preferencias, personal, estudiantes, vínculos familiares, clases, matrículas y asistencia. `dbo.EstadoAplicacion` permanece como respaldo de compatibilidad durante la migración gradual de los módulos restantes.

Cada escritura espera la confirmación de SQL Server antes de responder y compara `FechaActualizacion` para impedir que dos procesos sobrescriban silenciosamente el trabajo del otro.

El modo predeterminado continúa siendo `json`, por lo que las pruebas automatizadas y una instalación de desarrollo siguen funcionando sin SQL Server.

## Seguridad

- No escriba usuarios ni contraseñas reales dentro de los archivos del proyecto.
- Use un usuario SQL exclusivo para SIGA y conceda únicamente permisos sobre la base `SIGA`.
- En producción use `SIGA_SQL_ENCRYPT=true` y `SIGA_SQL_TRUST_CERTIFICATE=false`, con un certificado cuyo nombre coincida con el servidor y cuya autoridad sea confiable para el equipo que ejecuta SIGA.
- Mantenga respaldos periódicos y restrinja el acceso a evidencias y fotografías.

## Copia verificada

Ejecute desde una consola con permisos administrativos de SQL Server:

```powershell
npm run db:backup -- -ServerInstance ".\SIGA2025" -RetentionDays 30
```

La copia se crea en el directorio predeterminado de SQL Server, se valida con `RESTORE VERIFYONLY` y elimina únicamente copias `SIGA-*.bak` más antiguas que la retención indicada.

