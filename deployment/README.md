# Despliegue de producción de SIGA

SIGA debe publicarse detrás de un proxy HTTPS. Node escucha únicamente en `127.0.0.1:3000` y no debe exponerse directamente a Internet.

## Requisitos

- Node.js 20 LTS o una versión LTS posterior compatible con `package.json`.
- MariaDB 10.4 o posterior, o MySQL compatible, con una base y un usuario exclusivo para SIGA.
- Proxy HTTPS (IIS, Nginx o equivalente) con renovación automática del certificado.
- ClamAV, Microsoft Defender CLI u otro motor que devuelva código 0 solo para archivos limpios.
- Almacenamiento externo separado para respaldos.

## Publicación

1. Genere y revise el paquete con `npm run release:inspect`.
2. Copie únicamente el contenido aprobado; nunca `.env`, `data`, `backups`, informes o pruebas.
3. Ejecute `npm ci --omit=dev` en el servidor.
4. Cree `.env` desde `.env.example` y reemplace todos los valores `CAMBIAR` o de ejemplo.
5. Proteja `.env` para que solo Administradores, SYSTEM y la cuenta del servicio puedan leerlo.
6. Ejecute `npm run check` y la suite de pruebas en staging.
7. En cPanel siga `deployment/CPANEL.md`. En un VPS configure el proxy; el ejemplo Nginx está en esta carpeta.
8. En cPanel reinicie la aplicación Node.js desde el panel. En un VPS inicie una sola instancia con PM2.
9. Compruebe `/health`, la redirección HTTP a HTTPS, HSTS y la cookie `Secure`.
10. Instale las tareas de respaldo y monitoreo y realice una restauración completa.
11. Archive la aprobación de los activos institucionales y revise `THIRD_PARTY_NOTICES.md`.

## Validación de capacidad

Ejecute `k6 run -e SIGA_BASE_URL=https://dominio-institucional operations/k6-health-smoke.js` y complemente el resultado con recorridos autenticados de cada rol, Lighthouse/WebPageTest y una prueba con el volumen concurrente esperado. Los umbrales incluidos exigen menos de 1 % de errores y latencia p95 inferior a 500 ms para salud; no sustituyen la prueba funcional autenticada.

## Rollback

Mantenga el paquete anterior. Antes de publicar, exporte MariaDB y conserve esa copia fuera del servidor. Si falla una prueba crítica, detenga SIGA, restaure el paquete anterior y restaure la base únicamente si la migración modificó datos incompatibles.

No use `root` como usuario de la aplicación ni desactive los controles de arranque para resolver errores de configuración.
