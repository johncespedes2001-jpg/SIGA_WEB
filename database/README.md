# Base de datos MariaDB/MySQL de SIGA

SIGA utiliza exclusivamente MariaDB/MySQL para la persistencia institucional. El modo `json` existe solo para pruebas automatizadas aisladas.

## Esquema

Los archivos vigentes están en `database/mariadb/`:

- `01-create-database.sql`: crea la base local de XAMPP.
- `02-schema.sql`: crea y protege `estado_aplicacion`.
- `03-relational-schema.sql`: crea las 28 tablas y dos vistas de dominio.

En cPanel cree primero la base y el usuario desde el panel. Después importe `02-schema.sql` y `03-relational-schema.sql` dentro de la base seleccionada. No use `01-create-database.sql` en cPanel porque el proveedor asigna nombres con prefijo.

## Configuración

Defina `SIGA_STORAGE=mariadb` y las variables `SIGA_MARIADB_*` de `.env.example`. La aplicación debe usar un usuario exclusivo con acceso solamente a la base de SIGA; no utilice `root`.

En XAMPP puede preparar y verificar el entorno con:

```powershell
npm run db:mariadb-setup
npm run db:mariadb-verify
npm run start:mariadb-local
```

Cada escritura actualiza `estado_aplicacion` y la proyección relacional dentro de la misma transacción InnoDB. Si una tabla no puede sincronizarse, se revierte toda la operación.

## Auditoría y datos oficiales

Antes de cargar datos oficiales ejecute:

```powershell
npm run db:audit
npm run data:preflight
```

La auditoría comprueba las 28 tablas, las dos vistas, conteos, relaciones, huérfanos, duplicados y coherencia con el estado lógico.

## Respaldo y restauración

```powershell
npm run db:mariadb-backup
npm run db:mariadb-restore-test
```

El respaldo incluye SHA-256 y cifrado. La prueba de restauración crea una base temporal, valida el esquema y la integridad, y después elimina únicamente esa base temporal.

Para ejecutar instalación, verificación, respaldo, restauración, QA y prevalidación local en una sola operación:

```powershell
npm run qa:local-complete
```

No elimine `SIGA_DATA_ENCRYPTION_KEY` cuando existan datos cifrados. No almacene contraseñas reales dentro del código o del repositorio.
