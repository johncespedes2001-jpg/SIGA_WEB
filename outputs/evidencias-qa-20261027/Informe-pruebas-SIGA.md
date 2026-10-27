# Informe de pruebas internas y evidencias — SIGA Web

Fecha: 27 de octubre de 2026, hora de Lima. Alcance: pruebas disponibles en este equipo. Este informe no constituye aprobación institucional ni certificación de seguridad o accesibilidad.

## Resultado

**Pendiente para carga oficial.** Se ejecutaron 96 pruebas automatizadas con resultado 96 aprobadas, 0 fallidas y 0 omitidas. Las pruebas del servidor utilizan datos ficticios temporales y almacenamiento JSON aislado; no prueban por sí mismas SQL Server de producción, conexiones de red reales ni todos los recorridos manuales.

## Evidencias guardadas

1. `01-pruebas-automatizadas.txt`: resultado detallado, nombres y estado de las 96 pruebas. Incluye importación y validación de plantillas, piloto de diez estudiantes ficticios, duplicados, rechazo sin importación parcial, controles de sesiones y permisos de los roles, horarios y QR.
2. `02-pruebas-visuales.json`: mediciones y comprobaciones del navegador. Se probaron acceso y ventanas concretas a 320, 375, 768 y 1366 píxeles, búsqueda y conservación de selecciones, selección de perfil con teclado y foco de navegación.
3. `01-acceso-movil.png`: captura del acceso con datos ficticios a 375 píxeles.
4. `02-vinculos-escritorio.png`: captura de los vínculos con estudiantes ficticios. Los datos de la imagen son simulados.
5. `03-matricula-escritorio.png`: captura del formulario de matrícula con estudiantes ficticios. Los datos de la imagen son simulados.
6. `03-verificacion-sintaxis.txt`: comprobación sintáctica del servidor, frontend y almacenamiento SQL.

Las pruebas visuales sirven archivos reales del proyecto a un navegador con respuestas de API simuladas. No demuestran el funcionamiento completo de la interfaz contra la base real. Los PNG son capturas de pruebas, no de usuarios reales.

## Resultados por área

| Área | Resultado | Alcance y límites |
|---|---|---|
| Carga de estudiantes | Aprobado en entorno aislado | Se compararon diez filas ficticias y sus campos; se comprobó un lote repetido y uno con una fila duplicada y otra válida. No se ha conciliado un Excel oficial ni una importación masiva en SQL real. |
| Plantillas | Aprobado en pruebas automatizadas | Se comprobaron seis archivos y sus encabezados/listas. La prueba no valida el contenido que el usuario haya editado en sus copias descargadas. |
| Roles y permisos | Aprobado en pruebas automatizadas | Se comprobaron rutas y restricciones de administrador, coordinador, docente/tutoría, estudiante, apoderado y vigilante con cuentas ficticias. No equivale a UAT firmado por representantes. |
| Sesiones y QR | Aprobado en pruebas automatizadas | Se verificaron rechazo de firmas manipuladas y otras condiciones cubiertas en el registro de pruebas. El servidor real necesita reiniciarse para cargar los cambios de código recientes. |
| Responsive y teclado | Aprobado parcialmente | Acceso, modal de vínculos y modal de matrícula en Chrome con las resoluciones indicadas. No se revisaron todos los roles ni navegadores. |
| Narrador | Confirmación del usuario | El usuario confirmó el funcionamiento en la pantalla de acceso. No existe captura grabada de audio ni prueba manual del resto de pantallas. |
| SQL Server: registro individual | Observado previamente | En la conversación se verificó que EST-008, creado desde SIGA, aparecía en dbo.EstadoAplicacion y tras recargar la página. No se guardó captura de esa consulta en este paquete y no se reinició el servidor en esa prueba. |
| SQL Server: respaldo/restauración | Observado previamente | Se creó y verificó SIGA-QA-20261027-7c294.bak; se restauró SIGA_QA_7c294 y DBCC CHECKDB terminó sin errores observados. Se encontraron 29 tablas y el registro de prueba. No se guardó captura de SSMS en este paquete. La copia y la base restaurada contienen datos de la base real y requieren acceso restringido. |
| Integraciones externas | Pendiente | No hay prueba de correo, hosting o servicios externos reales. |
| UAT | Pendiente | Faltan personas representantes de los roles, tareas sin ayuda y aprobación del responsable institucional. |

## Hallazgos y correcciones

- SQL Server Express rechazó COMPRESSION en un intento real de respaldo. Se creó y verificó una copia sin compresión, se restauró en otra base y se retiró COMPRESSION de database/backup.ps1. El script actualizado se revisó sintácticamente, pero no se ejecutó completo como script.
- Una representación no canónica de la firma de sesión podía decodificarse a los mismos bytes. Se reforzó la validación de firmas de sesión y QR; se añadieron casos específicos. No se demostró que esto permitiera falsificar una firma ni obtener acceso sin una firma válida.
- La base de prueba SIGA_QA_7c294 y el archivo .bak se conservaron. No se ha confirmado que exista una copia externa ni se ha probado la restauración en otro equipo.

## Pendientes para Go/No-Go

- Realizar UAT y obtener aprobación por escrito de la institución.
- Conciliar datos de un piloto oficial autorizado contra su fuente antes de cualquier carga general.
- Probar restauración y recuperación conforme al procedimiento institucional; verificar copia externa y responsables.
- Probar interrupciones, volumen esperado y concurrencia; no se ha establecido el volumen objetivo.
- Probar dispositivos y navegadores adicionales, y accesibilidad con lector de pantalla en las pantallas de cada rol.
- Revisar seguridad, HTTPS, configuración e integraciones en el hosting real.
- Acordar quién elimina o conserva el estudiante ficticio EST-008, la base restaurada de prueba y los archivos asociados.

## Reproducibilidad

Desde la carpeta del proyecto: definir SIGA_TEST_IN_MEMORY_HTTP=true y ejecutar `npm test`. Para la prueba visual se requiere Playwright y Chrome disponibles; `tests/visual-browser-check.js` admite SIGA_VISUAL_EVIDENCE_DIR para guardar capturas. Las pruebas automatizadas no deben configurarse contra la base real.
