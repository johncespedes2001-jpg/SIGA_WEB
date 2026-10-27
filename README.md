# SIGA Web Multiperfil

Plataforma web del Sistema Integrado de Gestión de Asistencia del IESTP Contralmirante Manuel Villar Olivera.

## Ejecutar en Visual Studio Code

1. Abra esta carpeta en Visual Studio Code.
2. Abra la terminal integrada.
3. Ejecute:

```bash
npm install
npm start
```

También puede presionar `F5` y elegir **Iniciar SIGA Web** después de ejecutar `npm install` una vez.

La terminal mostrará la dirección disponible. Normalmente será `http://127.0.0.1:3000`. Si ese puerto está ocupado, el servidor probará automáticamente `3001`, `3002` y los siguientes.

Si estaba abierta una versión anterior, detenga el servidor con `Ctrl + C`, vuelva a ejecutar `npm start` y actualice el navegador con `Ctrl + F5`. Los documentos y las API no se almacenan; los recursos estáticos usan ETag y caché corta para mejorar el rendimiento.

> `npm install` y `npm start` son dos comandos separados. Ejecute el primero, espere a que termine y después ejecute el segundo.

## Base de datos SQL Server

SIGA admite dos proveedores de persistencia:

- `json`: modo local predeterminado para desarrollo y pruebas.
- `sqlserver`: modo institucional con almacenamiento transaccional en Microsoft SQL Server.

Para crear o actualizar el esquema SQL Server desde PowerShell sin borrar los datos:

```powershell
npm run db:setup -- -ServerInstance ".\SIGA2025"
```

Después configure `SIGA_STORAGE=sqlserver` y las variables `SIGA_SQL_SERVER`, `SIGA_SQL_DATABASE`, `SIGA_SQL_USER` y `SIGA_SQL_PASSWORD` antes de ejecutar `npm start`. Consulte [database/README.md](database/README.md) y `.env.example`; las credenciales reales nunca deben guardarse dentro del repositorio.

En producción, SQL Server debe presentar un certificado válido y la aplicación debe usar `SIGA_SQL_ENCRYPT=true` y `SIGA_SQL_TRUST_CERTIFICATE=false`. El valor `true` para confiar en el certificado se admite únicamente como excepción temporal en una instalación local sin PKI institucional.

## Acceso y datos de demostración

Las credenciales ya no están incorporadas en el código ni en esta documentación. Una base existente conserva sus cuentas y contraseñas derivadas con sal segura. Para crear una base nueva de demostración debe activar `SIGA_DEMO_MODE=true` y definir contraseñas seguras en las variables `SIGA_DEMO_ADMIN_PASSWORD`, `SIGA_DEMO_TEACHER_PASSWORD`, `SIGA_DEMO_COORDINATOR_PASSWORD`, `SIGA_DEMO_TUTOR_PASSWORD`, `SIGA_DEMO_PARENT_PASSWORD`, `SIGA_DEMO_GUARD_PASSWORD`, `SIGA_DEMO_STUDENT_PASSWORD` y `SIGA_DEMO_SECOND_STUDENT_PASSWORD` antes de ejecutar `npm start`.

Para una instalación institucional nueva, mantenga desactivado el modo demo y defina `SIGA_BOOTSTRAP_ADMIN_NAME`, `SIGA_BOOTSTRAP_ADMIN_EMAIL` y `SIGA_BOOTSTRAP_ADMIN_PASSWORD`. SIGA creará solamente la cuenta administrativa inicial; el resto de cuentas se registra desde la plataforma.

No habilite el modo de demostración en un despliegue institucional. Las cuentas multirol conservan el cambio Coordinador/Docente y el modo Tutor de los Docentes asignados sin iniciar otra sesión.

## Roles y páginas

- Administrador: dashboard, catálogo de programas, consulta de estudiantes en modo solo lectura, gestión de personal y vigilantes, importación Excel de personal, reportes, seguridad y cuenta.
- Docente: dashboard diario, asistencia editable por clase, estudiantes asignados, boletas de salida, reportes y perfil.
- Coordinador: resumen, gestión de estudiantes de su programa, asignación de cursos a Docentes, matrículas, horarios, permisos, permanencia y reportes.
- Docente con función de tutor: desde su cuenta Docente puede abrir el modo Tutor con estudiantes asignados, asistencia de consulta, permanencia, alertas, comunicación, justificaciones y reportes.
- Padre o apoderado: inicio familiar, hijos vinculados, asistencia, justificaciones, boletas, QR de salida, avisos, reuniones, seguimiento compartido y perfil.
- Vigilante: inicio de turno, validación QR con consulta previa, boletas autorizadas, historial, alertas, consulta mínima, incidencias, reportes y perfil.
- Estudiante: inicio personal, perfil, asistencia, solicitud de salida, historial de boletas, QR vigente, justificaciones, avisos, tutoría autorizada, clases y configuración de cuenta.

Las 64 vistas activas están creadas como archivos HTML independientes dentro de `public/pages/<rol>/`. La página `public/index.html` funciona como inicio de sesión y punto de entrada.

## Estructura de las páginas

```text
public/
├── assets/
│   ├── icons.svg
│   └── images/
│       └── logo-iestp.jpg
├── index.html
├── script.js
├── styles.css
└── pages/
    ├── administrador/
    ├── docente/
    ├── coordinador/
    ├── tutor/
    ├── padre/
    ├── vigilante/
    └── estudiante/
```

## Alcance

- HTML, CSS y JavaScript sin frameworks de interfaz.
- Node.js y Express.js para servir todas las rutas.
- Diseño responsive para escritorio y móvil.
- Menú lateral transformado en un panel móvil accesible, con cierre por botón, fondo o tecla Escape.
- Logotipo institucional integrado en el login, la barra lateral y el favicon.
- Iconos SVG integrados en roles, navegación y tarjetas de indicadores.
- Navegación entre páginas habilitada.
- Autenticación con contraseñas derivadas mediante `scrypt` y sal aleatoria, sesión protegida, límite de intentos, token CSRF, revalidación de cuentas activas y control de acceso por rol.
- Los bloqueos de autenticación y cierres de sesión se conservan entre reinicios en `data/security-state.json`; las claves de intento se anonimizan con HMAC y el archivo completo está excluido del repositorio.
- Métricas internas agregadas de uso, errores y duración, sin nombres, documentos, correos ni direcciones IP. El Administrador puede consultarlas mediante `GET /api/admin/usage-metrics`.
- Aviso público de privacidad disponible en `/privacidad.html`.
- Dashboard administrativo renovado con bienvenida personalizada, indicador circular de asistencia, accesos rápidos, métricas visuales y gráficos compactos por programa y estado.
- Interfaces renovadas para Estudiantes, Vigilantes, Importación Excel, Reportes y Seguridad, con jerarquía visual, indicadores, gráficos y flujos de trabajo más claros.
- Consulta, búsqueda, filtros y exportación de estudiantes en modo solo lectura.
- Registro, edición, activación, desactivación, eliminación, importación y exportación de estudiantes desde el perfil Coordinador, limitado a su programa asignado y sincronizado con la cuenta de acceso del Estudiante.
- Altas, búsquedas, filtros, edición, activación, desactivación y eliminación de personal y vigilantes.
- Personal académico clasificado por Docentes, Coordinadores, Padres o apoderados y Administradores; los Docentes con función de tutor se identifican dentro del mismo perfil.
- Directorio visual de personal con resumen del equipo, filtros por rol, avatares, etiquetas institucionales y acciones diferenciadas.
- Creación de cuentas institucionales para personal y vigilantes, con contraseña inicial segura.
- Asignación de turnos a vigilantes.
- Plantilla Excel de estudiantes con semestre, grupo, programa bloqueado al ámbito del Coordinador, estado y contraseña inicial; valida cada fila antes de crear el padrón y las cuentas.
- Plantillas Excel con listas desplegables para programa y estado.
- Plantillas Excel específicas para Docentes, Coordinadores, Padres o apoderados, Administradores y Vigilantes. La plantilla Docentes incluye la columna `Función de tutor`.
- La carga de Estudiantes no está disponible para el Administrador; corresponde exclusivamente al Coordinador.
- Acceso directo a **Carga masiva** desde Personal académico, sin registrar cuentas una por una.
- Validación previa de filas, campos obligatorios, duplicados, programas, estados, roles y contraseñas.
- Importación masiva y exportación de datos en Excel.
- Reportes filtrables por programa, semestre, fechas y estado, con apartados de asistencia, estudiantes, personal y permanencia, exportables a Excel y PDF.
- Protección para impedir que se desactive o elimine la propia cuenta administrativa y para conservar al menos un Administrador activo.
- Perfil completo del Administrador con fotografía, datos personales e institucionales, cambio de contraseña, tema claro/oscuro y cierre seguro de sesión.
- Módulo Docente conectado al servidor con clases y estudiantes limitados por asignación y programa de estudios.
- Registro y corrección de asistencia con los estados Presente, Tardanza, Ausente, Permiso y Retiro, además de resumen previo al guardado.
- La asistencia exige exactamente un estado por cada estudiante activo de la clase, rechaza duplicados y conserva una bitácora de cambios.
- Los reportes del Administrador se calculan con los registros de asistencia creados por los Docentes.
- Solicitudes de salida diferenciadas de la boleta oficial; Coordinación solo revisa solicitudes de su programa y el QR se genera al autorizar.
- Reportes docentes filtrables por curso, grupo, semestre, fechas y estado, con exportación real a Excel y PDF.
- Perfil docente, fotografía, cambio de contraseña, notificaciones, modo claro/oscuro y cierre seguro de sesión.
- Cuenta multirol: la cuenta Docente incluida puede alternar entre Docente y Tutor sin volver a iniciar sesión, conservando los permisos de cada modo.
- Dashboard de Coordinación con indicadores diarios, equipo del programa y accesos rápidos.
- Catálogo oficial de unidades didácticas de los cuatro planes de estudio, filtrado por programa y semestre para asignar cursos sin escritura manual.
- Padrón del Coordinador segmentado por programa, con filtros de semestre, grupo, estado y tutor, además del porcentaje de asistencia.
- Solicitudes reales enviadas por el Estudiante y revisadas por Coordinación; los rechazos exigen motivo y las autorizaciones generan boleta y QR.
- Portal Estudiante con alcance individual: once pantallas responsive, horario de clases, alertas de asistencia, justificaciones con evidencia, notificaciones leídas, seguimiento compartido y datos personales autorizados.
- Las solicitudes del Estudiante validan el horario institucional y bloquean duplicados del mismo periodo; el QR solo aparece después de la aprobación y deja de estar disponible al usarse o vencer.
- Permanencia con creación, edición, atención y cierre de incidencias, evidencia, responsable e historial de auditoría.
- Reportes de Coordinación por semestre, estudiante, fechas y estado, exportables a Excel y PDF.
- Perfil del Coordinador con fotografía, datos autorizados, contraseña, tema claro/oscuro, notificaciones y cierre seguro.
- Cuenta multirol del Coordinador: puede alternar entre Coordinador y Docente conservando el alcance de cada modo.
- Módulo Tutor completo con dashboard diario, padrón estrictamente asignado, ficha individual, consulta de asistencia por periodo, alertas de riesgo y permanencia auditable.
- Los casos de permanencia incluyen tipo, prioridad, acciones, responsable, evidencia, estados, comentarios e historial; no se pueden cerrar sin evidencia o comentario final.
- Comunicación con estudiantes y apoderados, registro de reuniones y acuerdos, revisión de justificaciones y derivación a Coordinación.
- Reportes de Tutoría filtrables y exportables a Excel y PDF, sin exponer datos de estudiantes no asignados.
- Perfil de Tutoría dentro de la cuenta Docente, con fotografía, datos autorizados, contraseña, notificaciones, tema claro/oscuro y cierre seguro.
- Cambio Docente/Tutor disponible únicamente para Docentes con la función asignada, con aislamiento de datos en ambos modos.
- Portal familiar completo con tarjetas por estudiante vinculado, asistencia por periodo, alertas de riesgo, justificaciones con evidencia, reuniones confirmables, avisos y preferencias de notificación.
- Solicitudes y boletas separadas por responsabilidad: el Estudiante solicita, Coordinación decide, el Apoderado consulta y Vigilancia valida el QR; el servidor impide que el Apoderado apruebe o genere boletas.
- Seguimiento familiar limitado a casos autorizados para compartir, con protección de estudiantes ajenos y bitácora de justificaciones, reuniones y actualizaciones de perfil.
- Módulo Vigilante optimizado para puerta: lectura QR con cámara o código manual, consulta previa, confirmación explícita, uso único y registro del punto de control.
- Los intentos inválidos, usados, vencidos, fuera de horario o con identidad no coincidente se bloquean y quedan en la bitácora; las incidencias pueden adjuntar evidencia y son visibles para Coordinación o Administración según sus permisos.
- Boletas, historial, alertas y reportes de Vigilancia son filtrables; las exportaciones autorizadas están disponibles en PDF y Excel sin exponer datos académicos o familiares.
- Diseño visual unificado entre Administrador y Docente: misma jerarquía de encabezados, paneles, tarjetas, tablas, filtros, botones y navegación responsive, con acento turquesa para distinguir el espacio académico.
- Rediseño Docente 3.0: dashboard operativo, directorio visual de estudiantes, asistencia guiada en tres pasos, flujo de boletas reforzado y reportes con gráfico circular accesible.
- Búsqueda instantánea en estudiantes, personal, solicitudes e incidencias.
- Registro de asistencia mediante botones directos con iconos para Presente, Tardanza, Ausente, Permiso y Retiro.
- Solicitudes, aprobaciones, rechazos y boletas almacenados en el servidor.
- Las cuentas de personal se vinculan al acceso institucional; desactivar una cuenta revoca sus sesiones y los registros con historial no pueden eliminarse.
- Los campos institucionales del Docente son de solo lectura también en el servidor; solo puede actualizar sus datos autorizados.
- Validación de códigos de salida autorizados.
- El código QR se valida contra el servidor, solo funciona para la fecha autorizada y no puede reutilizarse.
- Los módulos Estudiante, Padre o apoderado y Vigilante consultan información real del servidor y respetan su alcance de datos.
- La corrección de asistencia docente rechaza fechas futuras y registros fuera del periodo permitido de siete días.
- Las tablas se convierten en fichas legibles en celular y los controles mantienen tamaños táctiles accesibles.
- Persistencia configurable: SQL Server para la instalación institucional y `data/siga.json` para desarrollo o pruebas locales.
- SQL Server confirma cada escritura antes de responder al usuario, detecta conflictos entre instancias y sincroniza programas, usuarios, roles, personal, estudiantes, vínculos, clases, matrículas y asistencia con el esquema relacional.
- Las sesiones están firmadas con HMAC, sobreviven a reinicios cuando se conserva `SIGA_SESSION_SECRET` y se invalidan por versión al cambiar contraseñas o desactivar cuentas.
- Los recursos estáticos usan compresión, ETag y caché; las API, páginas privadas y respuestas de salud mantienen `no-store`.
- El modo JSON conserva escritura protegida con archivo temporal y respaldo para carpetas de Windows que bloquean el renombrado.

## Verificación

Ejecute las validaciones de sintaxis y las pruebas de lógica, permisos, sesión, caché, configuración y seguridad con:

```bash
npm run check
npm test
```

## Publicación y operación

SIGA rechaza el arranque en modo producción si detecta SQL Server sin validación de certificado, proxy HTTPS no declarado, secretos de ejemplo, datos legales incompletos o falta de motor antimalware. Complete `.env.example`, proteja `.env` y ejecute `npm run production:preflight` antes de cada despliegue.

La carpeta `deployment/` contiene el proxy HTTPS de referencia, supervisión de proceso, procedimiento de publicación y rollback. `database/install-backup-task.ps1` instala el respaldo diario con copia externa obligatoria; `database/restore-test.ps1` realiza una restauración completa temporal y `DBCC CHECKDB`. `operations/` contiene monitoreo HTTPS e intervención ante incidentes.

La publicación definitiva todavía requiere que la institución proporcione dominio, certificado, datos legales, canal de privacidad, almacenamiento externo, motor antimalware y responsables de soporte reales. Esos datos no deben inventarse ni almacenarse en el repositorio.
