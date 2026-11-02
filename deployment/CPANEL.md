# Publicación de SIGA en cPanel con MariaDB

Esta guía corresponde a SIGA con Node.js 20 y MariaDB. La base local de XAMPP es un entorno de ensayo: no se sube la carpeta `data/`, una copia de XAMPP ni credenciales locales.

## 1. Preparar una base limpia

En cPanel cree una base MariaDB, un usuario exclusivo y asígnelo únicamente a esa base. No use `root`. Importe `database/mariadb/02-schema.sql` y luego `database/mariadb/03-relational-schema.sql` desde phpMyAdmin. El usuario usado por la aplicación necesita `SELECT`, `INSERT`, `UPDATE` y `DELETE`; las operaciones de instalación se realizan con el usuario autorizado por cPanel.

## 2. Crear la aplicación Node.js

- Versión: Node.js 20.20.2 o una versión 20 posterior.
- Modo: `Production`.
- Raíz: una carpeta privada como `siga-web`, no `public_html`.
- URL: el dominio o subdominio asignado.
- Archivo de inicio: `server.js`.

Suba el paquete generado y ejecute `npm ci --omit=dev --ignore-scripts`. El archivo `npm-shrinkwrap.json` incluido fija exactamente las versiones que superaron la auditoría local. No suba `.env`, `data`, `backups`, `tests`, `outputs` ni `.git`. El paquete utiliza exclusivamente MariaDB/MySQL.

Antes de instalar, confirme que la cuenta dispone de espacio e inodos suficientes. Si cPanel muestra `TAR_ENTRY_ERROR`, `Unknown system error -122` o deja la aplicación en estado incompleto, no repita la instalación: solicite al proveedor que revise la cuota de disco e inodos y que elimine únicamente el entorno virtual Node incompleto de esta aplicación. Después recree la aplicación y vuelva a ejecutar `npm ci --omit=dev --ignore-scripts`.

## 3. Variables de entorno

Configure en el panel, sin guardarlas en Git:

```text
NODE_ENV=production
SIGA_STORAGE=mariadb
SIGA_MARIADB_HOST=localhost
SIGA_MARIADB_PORT=3306
SIGA_MARIADB_DATABASE=PREFIJO_siga
SIGA_MARIADB_USER=PREFIJO_siga_app
SIGA_MARIADB_PASSWORD=CONTRASEÑA_GENERADA_POR_CPanel
SIGA_MARIADB_SSL=false
SIGA_SESSION_SECRET=SECRETO_BASE64URL_DE_48_BYTES_O_MÁS
SIGA_DATA_ENCRYPTION_KEY=CLAVE_BASE64URL_DE_32_BYTES
SIGA_RETENTION_DAYS=365
SIGA_DEMO_MODE=false
SIGA_BOOTSTRAP_ADMIN_NAME=Administrador institucional
SIGA_BOOTSTRAP_ADMIN_EMAIL=CORREO_INSTITUCIONAL_REAL
SIGA_BOOTSTRAP_ADMIN_PASSWORD=CONTRASEÑA_INICIAL_SEGURA
SIGA_TRUST_PROXY=1
SIGA_PUBLIC_BASE_URL=https://sigaiestpcmvo.com
```

La clave `SIGA_DATA_ENCRYPTION_KEY` no se puede cambiar después de cargar datos o archivos sin ejecutar una migración de claves. Guárdela también en el inventario seguro de recuperación institucional.

## 4. Arranque y verificación

Reinicie la aplicación desde cPanel. Verifique `/health`, acceso del administrador, cambio obligatorio de contraseña, cierre de sesión y una operación reversible. Si falla el arranque, revise el log de la aplicación; no habilite `root` ni quite las validaciones de producción.

La publicación solo se considera terminada cuando `/health` devuelve HTTP 200 con estado `ok`, el log de errores permanece limpio y la operación reversible aparece en MariaDB.

Antes de autorizar datos oficiales, ejecute `npm run test:cross-browser` en el entorno de QA. La comprobación incluida recorre las páginas iniciales de todos los perfiles con Chromium y Google Chrome. Edge, Firefox y WebKit pueden añadirse cuando estén instalados definiendo `SIGA_CROSS_BROWSER_ENGINES=chromium,chrome,edge,firefox,webkit`.

## 5. Respaldo y rollback

Active el respaldo de bases de datos del proveedor. Antes de cada publicación exporte MariaDB desde cPanel y conserve el paquete anterior. El rollback consiste en restaurar el paquete anterior y, solo si la versión nueva modificó datos de forma incompatible, restaurar el respaldo previo.

## 6. Separación de datos

La base local `siga` permanece como staging. Producción comienza con una base nueva y solo el administrador institucional real. Así las cuentas y estudiantes ficticios usados en pruebas nunca llegan al hosting.
