'use strict';
const identityValidationScript = document.createElement('script');
identityValidationScript.src = '/identity-validation.js?v=20261023-1';
identityValidationScript.defer = true;
document.head.append(identityValidationScript);

// Interfaz web multiperfil del Sistema Integrado de Gestión de Asistencia.
const roles = Object.freeze({
  administrador: {
    name: 'Administrador', code: 'AD', tone: 'blue', icon: 'settings',
    description: 'Gestiona usuarios, programas, carga masiva, reportes y configuración operativa.',
    greeting: 'Control integral de la operación institucional',
    pages: [['resumen','Dashboard','RS'],['programas','Programas','PR'],['estudiantes','Estudiantes','ES'],['personal','Personal académico','PA'],['vinculos','Vínculos familiares','VF'],['vigilantes','Vigilantes','VI'],['carga-excel','Importación Excel','EX'],['reportes','Reportes','RE'],['configuracion','Seguridad','CF'],['cuenta','Mi cuenta','CU']],
  },
  docente: {
    name: 'Docente', code: 'DO', tone: 'teal', icon: 'book',
    description: 'Registra asistencia y consulta estudiantes, boletas y reportes de sus clases.',
    greeting: 'Seguimiento diario de clases y asistencia',
    pages: [['resumen','Inicio','RS'],['horario','Mi horario','HO'],['asistencia','Asistencia','AS'],['estudiantes','Mis estudiantes','ES'],['boletas','Boletas de salida','BO'],['reportes','Reportes','RE'],['cuenta','Mi perfil','CU']],
  },
  coordinador: {
    name: 'Coordinador', code: 'CO', tone: 'violet', icon: 'graduation',
    description: 'Supervisa su programa, permisos, permanencia y solicitudes de salida.',
    greeting: 'Supervisión académica del programa de estudios',
    pages: [['resumen','Dashboard','RS'],['estudiantes','Estudiantes','ES'],['clases','Asignar cursos y docentes','CL'],['horarios','Horarios docentes','HO'],['permisos','Permisos','PE'],['justificaciones','Justificaciones','JU'],['permanencia','Permanencia','PM'],['seguridad','Seguridad','SE'],['reportes','Reportes','RE'],['cuenta','Mi perfil','CU']],
  },
  tutor: {
    name: 'Tutor', code: 'TU', tone: 'amber', icon: 'heart',
    description: 'Acompaña el seguimiento académico y la permanencia de estudiantes asignados.',
    greeting: 'Acompañamiento y seguimiento del estudiante',
    pages: [['resumen','Inicio','RS'],['estudiantes','Mis estudiantes','ES'],['asistencia','Asistencia','AS'],['permanencia','Permanencia','PM'],['alertas','Alertas','AL'],['comunicacion','Comunicación','CO'],['justificaciones','Justificaciones','JU'],['reportes','Reportes','RE'],['cuenta','Mi perfil','CU']],
  },
  padre: {
    name: 'Padre o apoderado', code: 'PA', tone: 'green', icon: 'family',
    description: 'Acompaña la asistencia, comunicación y bienestar de sus estudiantes vinculados.',
    greeting: 'Acompañamiento familiar seguro y cercano',
    pages: [['resumen','Inicio','RS'],['hijos','Mis hijos','MH'],['asistencia','Asistencia','AS'],['justificaciones','Justificaciones','JU'],['boletas','Boletas de salida','BO'],['qr-salida','QR de salida','QR'],['avisos','Avisos','AV'],['reuniones','Reuniones','RU'],['seguimiento','Seguimiento','SG'],['cuenta','Mi perfil','CU']],
  },
  vigilante: {
    name: 'Vigilante', code: 'VI', tone: 'red', icon: 'shield',
    description: 'Controla el acceso físico, valida boletas oficiales y registra incidencias de seguridad.',
    greeting: 'Control seguro de ingreso y salida',
    pages: [['resumen','Inicio','RS'],['accesos','Entradas y salidas','EA'],['validar-qr','Validar salida','QR'],['salidas','Boletas autorizadas','SA'],['historial','Historial','HI'],['alertas','Alertas','AL'],['consulta','Consulta mínima','CM'],['incidencias','Incidencias','IN'],['reportes','Reportes','RE'],['cuenta','Mi perfil','CU']],
  },
  estudiante: {
    name: 'Estudiante', code: 'ES', tone: 'blue', icon: 'student',
    description: 'Consulta su jornada, asistencia, clases y solicitudes dentro de un espacio personal protegido.',
    greeting: 'Tu jornada académica en un solo lugar',
    pages: [['resumen','Inicio','RS'],['perfil','Mi perfil','PF'],['mi-asistencia','Mi asistencia','AS'],['mis-clases','Mi horario','HO'],['solicitar-salida','Solicitar salida','SS'],['mis-boletas','Mis boletas','MB'],['qr-salida','Mis códigos QR','QR'],['justificaciones','Justificaciones','JU'],['avisos','Avisos','AV'],['tutoria','Tutoría','TU'],['cuenta','Cuenta y sesión','CU']],
  },
});

// Compatibilidad con páginas antiguas: nunca contienen datos simulados.
const students = [];
const staff = [];
const exitRows = [];

const content = document.querySelector('#page-content');
const pageTitle = document.querySelector('#page-title');
const pageSubtitle = document.querySelector('#page-subtitle');
const identity = document.querySelector('#role-identity');
const navigation = document.querySelector('#role-navigation');
const sidebarGuide = document.querySelector('#sidebar-guide');
if (localStorage.getItem('siga_theme') === 'dark') document.body.classList.add('theme-dark');

const pageIcons = Object.freeze({
  resumen:'grid', programas:'graduation', estudiantes:'users', personal:'family', vinculos:'family', vigilantes:'shield', 'carga-excel':'upload', reportes:'chart', configuracion:'settings', cuenta:'student', clases:'book', horarios:'calendar', horario:'calendar', seguridad:'shield',
  asistencia:'check', boletas:'file', permisos:'clipboard', permanencia:'graduation', seguimiento:'chart', incidencias:'alert', accesos:'login',
  reuniones:'calendar', comunicacion:'send', alertas:'bell', justificaciones:'file', avisos:'bell', hijos:'family', 'qr-salida':'scan', 'validar-qr':'scan', salidas:'exit', historial:'clock', consulta:'student', incidencias:'alert',
  'mi-asistencia':'check', 'solicitar-salida':'send', 'mis-permisos':'clipboard', 'mis-boletas':'file', perfil:'student', tutoria:'heart', 'mis-clases':'book',
});
const metricIcons = Object.freeze({ RO:'shield', MO:'grid', PR:'graduation', QA:'check', ES:'users', TA:'clock', AU:'alert', PE:'clipboard', IN:'alert', AS:'check', TU:'users', SG:'chart', RU:'calendar', JU:'file', SA:'exit', QR:'scan', HI:'clock', AL:'shield', SO:'send', AV:'bell' });
const icon = (name, className = 'ui-icon') => `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="/assets/icons.svg#icon-${name}"></use></svg>`;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function decisionDialog({ title, message, input = false, required = false, defaultValue = '', confirmLabel = 'Confirmar' }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'record-dialog decision-dialog';
    const headingId = `decision-dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dialog.setAttribute('aria-labelledby', headingId);
    const form = document.createElement('form');
    form.method = 'dialog';

    const header = document.createElement('header');
    const heading = document.createElement('h2');
    heading.id = headingId;
    heading.textContent = title;
    const close = document.createElement('button');
    close.className = 'dialog-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar');
    close.textContent = '×';
    header.append(heading, close);

    const body = document.createElement('div');
    body.className = 'decision-dialog-body';
    const copy = document.createElement('p');
    copy.textContent = message;
    body.append(copy);

    let field = null;
    let feedback = null;
    if (input) {
      field = document.createElement('textarea');
      field.name = 'decisionValue';
      field.rows = 4;
      field.value = defaultValue;
      field.required = required;
      field.setAttribute('aria-label', message);
      feedback = document.createElement('p');
      feedback.className = 'form-message';
      feedback.setAttribute('aria-live', 'polite');
      body.append(field, feedback);
    }

    const footer = document.createElement('footer');
    const cancel = document.createElement('button');
    cancel.className = 'secondary-action';
    cancel.type = 'button';
    cancel.textContent = 'Cancelar';
    const confirm = document.createElement('button');
    confirm.className = 'primary-action';
    confirm.type = 'submit';
    confirm.textContent = confirmLabel;
    footer.append(cancel, confirm);
    form.append(header, body, footer);
    dialog.append(form);
    document.body.append(dialog);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    close.addEventListener('click', () => finish(input ? null : false));
    cancel.addEventListener('click', () => finish(input ? null : false));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(input ? null : false); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input && required && !field.value.trim()) {
        field.setAttribute('aria-invalid', 'true');
        feedback.textContent = 'Este dato es obligatorio.';
        field.focus();
        return;
      }
      finish(input ? field.value.trim() : true);
    });
    dialog.showModal();
    (field || confirm).focus();
  });
}

const confirmAction = (message, title = 'Confirmar acción') => decisionDialog({ title, message });
const promptAction = (message, options = {}) => decisionDialog({
  title: options.title || 'Registrar observación',
  message,
  input: true,
  required: Boolean(options.required || message === 'Observación para el historial:'),
  defaultValue: options.defaultValue || '',
  confirmLabel: options.confirmLabel || 'Guardar',
});

const localIsoDate = (offsetDays = 0) => {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  const shifted = new Date(Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day')) + offsetDays));
  return shifted.toISOString().slice(0, 10);
};
function applyDynamicStyles(root = content) {
  root.querySelectorAll('[data-gauge]').forEach((element) => element.style.setProperty('--gauge',`${Number(element.dataset.gauge) || 0}deg`));
  root.querySelectorAll('[data-progress]').forEach((element) => element.style.setProperty('--progress',`${Number(element.dataset.progress) || 0}%`));
  root.querySelectorAll('[data-present][data-tardy]').forEach((element) => { element.style.setProperty('--present',`${Number(element.dataset.present) || 0}%`); element.style.setProperty('--tardy',`${Number(element.dataset.tardy) || 0}%`); });
  root.querySelectorAll('[data-chart-height]').forEach((element) => { element.style.height = `${Number(element.dataset.chartHeight) || 0}%`; });
  root.querySelectorAll('[data-score]').forEach((element) => element.style.setProperty('--score',String(Number(element.dataset.score) || 0)));
}
function enhanceResponsiveTables(root = content) {
  root.querySelectorAll('.data-table').forEach((table) => {
    const labels = [...table.querySelectorAll('thead th')].map((item) => item.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => [...row.children].forEach((cell, index) => {
      if (!cell.dataset.label) cell.dataset.label = labels[index] || 'Dato';
    }));
  });
}
const statusClass = (value) => ['Activo','Autorizada','Aprobada','Presente','Revisada','Registrada','Confirmada por apoderado','Válida','Validada'].includes(value) ? 'success' : ['Pendiente','Pendiente de validar','Enviada','Pendiente de confirmación','Pendiente de coordinación','En revisión','Tardanza','Permiso','Abierto','En seguimiento','Seguimiento pendiente','Observada','Observada por Tutoría','Reprogramación solicitada','Derivada','Derivada a Coordinación','Fuera de horario'].includes(value) ? 'warning' : ['Rechazada','Vencida','No encontrada','No autorizada','Ausente'].includes(value) ? 'danger' : ['Inactivo','Usada','Cerrada','Cerrado','Retiro'].includes(value) ? 'muted' : 'info';
const status = (value) => `<span class="status-pill ${statusClass(value)}">${escapeHtml(value)}</span>`;
const panelHeading = (kicker, heading, note = '') => `<div class="panel-heading"><div><p class="section-kicker">${kicker}</p><h2>${heading}</h2></div>${note ? `<p>${note}</p>` : ''}</div>`;
const metric = (label, value, detail, tone, symbol) => `<article class="metric-card metric-${tone}">
  <div class="metric-card-top"><span class="metric-icon tone-${tone}">${icon(metricIcons[symbol])}</span><span class="metric-badge"><i></i> Actualizado</span></div>
  <div class="metric-value"><strong class="${String(value).length > 8 ? 'word' : ''}">${value}</strong><span>${label}</span></div>
  <small>${detail}</small><span class="metric-line" aria-hidden="true"><i></i></span>
</article>`;
const rowsTable = (headers, rows) => `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const pageHref = (roleKey, pageKey) => `/pages/${roleKey}/${pageKey}.html`;
const tableToolbar = (placeholder = 'Buscar en la tabla') => `<div class="table-toolbar"><label>${icon('scan')}<input class="table-search" type="search" placeholder="${placeholder}" aria-label="${placeholder}"></label><span class="table-count" aria-live="polite"></span></div>`;
let currentUser = null;
let csrfToken = '';

function resolveRoute() {
  const declaredRole = document.body.dataset.role;
  const declaredPage = document.body.dataset.page;
  if (declaredRole && roles[declaredRole]) {
    const declaredPages = roles[declaredRole].pages.map(([key]) => key);
    return {
      roleKey: declaredRole,
      pageKey: declaredPages.includes(declaredPage) ? declaredPage : 'resumen',
    };
  }

  const parts = location.pathname.split('/').filter(Boolean);
  const roleKey = parts[0] && roles[parts[0]] ? parts[0] : null;
  if (!roleKey) return { roleKey: null, pageKey: null };
  const available = roles[roleKey].pages.map(([key]) => key);
  return { roleKey, pageKey: available.includes(parts[1]) ? parts[1] : 'resumen' };
}

function renderShell(roleKey, pageKey) {
  if (!roleKey) {
    identity.className = 'role-identity home-mode';
    identity.innerHTML = `<span class="role-avatar">${icon('users')}</span><span><strong>Acceso por perfiles</strong><span>Seleccione un rol institucional</span></span>`;
    navigation.innerHTML = `<p class="nav-label">Plataforma</p><ul class="nav-list"><li><a class="nav-link is-current" href="/index.html"><span class="nav-symbol">${icon('login')}</span>Iniciar sesión</a></li></ul>`;
    sidebarGuide.innerHTML = `<p class="sidebar-guide-label">Ruta de acceso</p><ol class="sidebar-steps"><li><span>1</span><div><strong>Seleccione su rol</strong><small>Elija el perfil institucional</small></div></li><li><span>2</span><div><strong>Ingrese sus datos</strong><small>Usuario y contraseña</small></div></li></ol>`;
    pageTitle.textContent = 'Acceso SIGA';
    pageSubtitle.textContent = 'Ingrese con sus credenciales institucionales';
    document.title = 'SIGA | Acceso por roles';
    return;
  }
  const role = roles[roleKey];
  const currentPage = role.pages.find(([key]) => key === pageKey);
  const isAdmin = roleKey === 'administrador';
  const isTeacher = roleKey === 'docente';
  const isTutor = roleKey === 'tutor';
  const isStudent = roleKey === 'estudiante';
  identity.className = `role-identity${isAdmin ? ' admin-role-identity' : isTeacher ? ' teacher-role-identity' : isTutor ? ' tutor-role-identity' : isStudent ? ' student-role-identity' : ''}`;
  identity.innerHTML = `<span class="role-avatar ${isAdmin ? 'admin-role-avatar' : isTeacher ? 'teacher-role-avatar' : isTutor ? 'tutor-role-avatar' : isStudent ? 'student-role-avatar' : ''}">${icon(isAdmin ? 'shield' : role.icon)}${isAdmin || isTeacher || isTutor || isStudent ? `<i>${icon('check')}</i>` : ''}</span><span class="role-identity-copy">${isAdmin ? '<small>Cuenta administrativa</small>' : isTeacher ? '<small>Cuenta académica</small>' : isTutor ? '<small>Acompañamiento académico</small>' : isStudent ? '<small>Cuenta estudiantil</small>' : ''}<strong>${role.name}</strong><span>${isAdmin ? 'Control institucional' : isTeacher ? 'Gestión de clases' : isTutor ? 'Tutoría estudiantil' : isStudent ? 'Portal personal' : 'Perfil institucional'}</span></span>`;
  navigation.innerHTML = `<p class="nav-label">Páginas del perfil</p><ul class="nav-list">${role.pages.map(([key,label]) => `<li><a class="nav-link ${key === pageKey ? 'is-current' : ''}" href="${pageHref(roleKey,key)}"><span class="nav-symbol">${icon(pageIcons[key])}</span>${label}</a></li>`).join('')}</ul>`;
  sidebarGuide.innerHTML = `<div class="sidebar-session"><span class="sidebar-session-icon">${icon('shield')}</span><div><small>Sesión actual</small><strong>${role.name}</strong></div></div><div class="sidebar-session-meta"><span>${role.name}</span><button class="sidebar-logout" type="button" data-action="logout">Cerrar sesión</button></div>`;
  pageTitle.textContent = currentPage[1];
  pageSubtitle.textContent = `${role.name} · ${role.greeting}`;
  document.title = `SIGA | ${role.name} · ${currentPage[1]}`;
}

function setupMobileNavigation() {
  if (document.body.dataset.view === 'login') return;
  const topbar = document.querySelector('.topbar');
  const sidebar = document.querySelector('.sidebar');
  if (!topbar || !sidebar || document.querySelector('#mobile-nav-toggle')) return;
  const button = document.createElement('button');
  button.id = 'mobile-nav-toggle';
  button.className = 'mobile-nav-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Abrir menú de navegación');
  button.setAttribute('aria-controls', 'role-navigation');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = icon('grid');
  topbar.prepend(button);
  const backdrop = document.createElement('button');
  backdrop.className = 'mobile-nav-backdrop';
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', 'Cerrar menú de navegación');
  document.body.append(backdrop);
  let focusBeforeOpen = null;
  const close = (restoreFocus = true) => {
    const wasOpen = document.body.classList.contains('nav-open');
    document.body.classList.remove('nav-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Abrir menú de navegación');
    if (wasOpen && restoreFocus) (focusBeforeOpen || button).focus();
  };
  const toggle = () => {
    const open = !document.body.classList.contains('nav-open');
    document.body.classList.toggle('nav-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
    if (open) {
      focusBeforeOpen = document.activeElement;
      window.requestAnimationFrame(() => sidebar.querySelector('a,button')?.focus());
    } else {
      button.focus();
    }
  };
  button.addEventListener('click', toggle);
  backdrop.addEventListener('click', close);
  navigation?.addEventListener('click', (event) => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (event.key === 'Escape') return close();
    if (event.key !== 'Tab') return;
    const focusable = [button, ...sidebar.querySelectorAll('a[href],button:not([disabled]),select,input,[tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 780) close(false); });
}

function refreshSessionIdentity() {
  if (!currentUser || !roles[currentUser.role]) return;
  const role = roles[currentUser.role];
  const isAdmin = currentUser.role === 'administrador';
  const isTeacher = currentUser.role === 'docente';
  const isTutor = currentUser.role === 'tutor';
  const isStudent = currentUser.role === 'estudiante';
  const photo = currentUser.photoUrl ? `<img src="${currentUser.photoUrl}?v=${Date.now()}" alt="Foto de ${escapeHtml(currentUser.name)}">` : icon(isAdmin ? 'shield' : role.icon);
  identity.className = `role-identity${isAdmin ? ' admin-role-identity' : isTeacher ? ' teacher-role-identity' : isTutor ? ' tutor-role-identity' : isStudent ? ' student-role-identity' : ''}`;
  identity.innerHTML = `<span class="role-avatar ${isAdmin ? 'admin-role-avatar' : isTeacher ? 'teacher-role-avatar' : isTutor ? 'tutor-role-avatar' : isStudent ? 'student-role-avatar' : ''} ${currentUser.photoUrl ? 'has-photo' : ''}">${photo}${(isAdmin || isTeacher || isTutor || isStudent) && !currentUser.photoUrl ? `<i>${icon('check')}</i>` : ''}</span><span class="role-identity-copy">${isAdmin ? '<small>Cuenta administrativa</small>' : isTeacher ? '<small>Cuenta académica</small>' : isTutor ? '<small>Acompañamiento académico</small>' : isStudent ? '<small>Cuenta estudiantil</small>' : ''}<strong>${escapeHtml(currentUser.name)}</strong><span>${isAdmin ? 'Control institucional' : isTeacher ? 'Gestión de clases' : isTutor ? 'Tutoría estudiantil' : isStudent ? 'Portal personal' : role.name}</span></span>`;
  sidebarGuide.innerHTML = `<div class="sidebar-session"><span class="sidebar-session-icon">${icon('shield')}</span><div><small>Sesión actual</small><strong>${escapeHtml(currentUser.name)}</strong></div></div><div class="sidebar-session-meta"><span>${escapeHtml(currentUser.position || role.name)}</span><button class="sidebar-logout" type="button" data-action="logout">Cerrar sesión</button></div>`;
}

async function configureUserTools() {
  if (!currentUser) return;
  const isTeacher = currentUser.role === 'docente';
  const isCoordinator = currentUser.role === 'coordinador';
  const isTutor = currentUser.role === 'tutor';
  const hasAcademicTools = isTeacher || isCoordinator || isTutor;
  const hasProfilePage = roles[currentUser.role].pages.some(([key]) => key === 'cuenta');
  let topbar = document.querySelector('.topbar-meta');
  if (!topbar) {
    topbar = document.createElement('div');
    topbar.className = 'topbar-meta';
    document.querySelector('.topbar')?.append(topbar);
  }
  const availableRoles = (currentUser.roles || [currentUser.role]).filter((key) => roles[key]);
  topbar.innerHTML = `<div class="user-tools">
    <button class="topbar-icon-button" id="teacher-theme-toggle" type="button" aria-label="Cambiar tema">${icon('settings')}</button>
    <div class="notification-center"><button class="topbar-icon-button" id="notification-toggle" type="button" aria-label="Ver notificaciones">${icon('bell')}<span class="notification-count" hidden>0</span></button><div class="notification-popover" id="notification-popover" hidden><header><strong>Notificaciones</strong><button type="button" id="mark-notifications">Marcar leídas</button></header><div id="notification-list"><p class="empty-notice">Cargando notificaciones…</p></div></div></div>
    ${availableRoles.length > 1 ? `<label class="role-switcher"><span>Modo</span><select id="active-role-select">${availableRoles.map((key) => `<option value="${key}" ${key === currentUser.role ? 'selected' : ''}>${escapeHtml(roles[key].name)}</option>`).join('')}</select></label>` : ''}
    ${hasProfilePage ? `<a class="teacher-profile-link" href="${pageHref(currentUser.role,'cuenta')}">${currentUser.photoUrl ? `<img src="${currentUser.photoUrl}?v=${Date.now()}" alt="Foto de perfil">` : icon('student')}<span><strong>${escapeHtml(currentUser.name.split(/\s+/)[0])}</strong><small>Mi perfil</small></span></a><button class="topbar-icon-button topbar-logout-button" type="button" data-action="logout" data-confirm-logout="true" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('exit')}<span>Salir</span></button>` : `<button class="topbar-icon-button topbar-logout-button" type="button" data-action="logout" data-confirm-logout="true" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('exit')}<span>Salir</span></button>`}
  </div>`;
  const renderNotifications = (data) => {
    const badge = topbar.querySelector('.notification-count');
    badge.textContent = data.unread;
    badge.hidden = data.unread === 0;
    topbar.querySelector('#notification-list').innerHTML = data.items.length ? data.items.map((item) => `<article class="notification-item ${item.read ? '' : 'is-unread'}"><span>${icon(item.read ? 'check' : 'bell')}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><time>${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.date))}</time></div></article>`).join('') : '<p class="empty-notice">No tiene notificaciones.</p>';
  };
  try { renderNotifications(await api('/api/notifications')); } catch (error) { topbar.querySelector('#notification-list').innerHTML = `<p class="empty-notice">${escapeHtml(error.message)}</p>`; }
  topbar.querySelector('#notification-toggle').addEventListener('click', () => { const popover=topbar.querySelector('#notification-popover'); popover.hidden=!popover.hidden; });
  topbar.querySelector('#mark-notifications').addEventListener('click', async () => { try { await api('/api/notifications/read',{method:'PATCH'}); renderNotifications(await api('/api/notifications')); } catch(error){notify(error.message,'error');} });
  topbar.querySelector('#teacher-theme-toggle').addEventListener('click', () => { document.body.classList.toggle('theme-dark'); localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light'); });
  topbar.querySelector('#active-role-select')?.addEventListener('change', async (event) => {
    event.target.disabled = true;
    try { const result=await api('/api/account/switch-role',{method:'POST',body:JSON.stringify({role:event.target.value})}); window.location.href=result.redirect; }
    catch(error){event.target.disabled=false; event.target.value=currentUser.role; notify(error.message,'error');}
  });
}

function renderHome() {
  content.innerHTML = `
    <section class="login-experience">
      <aside class="login-visual-panel">
        <figure class="login-hero-media">
          <img src="/assets/images/siga-login-hero.jpg?v=20261024" alt="SIGA, Sistema Integrado de Gestión de Asistencia del IESTP Contralmirante Manuel Villar Olivera" width="1514" height="1039" decoding="async" fetchpriority="high">
        </figure>
        <div class="login-visual-footer">
          <div class="profile-preview" id="profile-preview">
            <span class="profile-preview-icon" id="profile-preview-icon">${icon('users')}</span>
            <div>
              <small>Perfil seleccionado</small>
              <strong id="profile-preview-name">Elija un rol</strong>
              <p id="profile-preview-description">Seleccione cómo desea ingresar a SIGA.</p>
            </div>
          </div>
          <p class="visual-caption"><span></span> Acceso institucional seguro y personalizado</p>
        </div>
      </aside>

      <div class="login-workspace">
        <header class="workspace-heading">
          <div><p class="section-kicker">Acceso al sistema</p><h2>Bienvenido de nuevo</h2></div>
          <span class="workspace-status">${icon('shield')}Conexión institucional</span>
        </header>

        <section class="role-selector login-role-selector" aria-labelledby="role-selector-title">
          <div class="section-heading compact-heading">
            <div><span class="step-number">1</span><h3 id="role-selector-title">Seleccione su perfil</h3></div>
            <p>Su espacio se adapta automáticamente al rol elegido.</p>
          </div>
          <div class="role-cards login-role-grid" role="radiogroup" aria-label="Roles institucionales">
            ${Object.entries(roles).filter(([key]) => key !== 'tutor').map(([key,role]) => `<button class="role-card role-option tone-${role.tone}" type="button" role="radio" aria-checked="false" data-role="${key}"><span class="role-card-icon">${icon(role.icon)}</span><span class="role-card-copy"><strong>${role.name}</strong></span><span class="role-check" aria-hidden="true">${icon('check')}</span></button>`).join('')}
          </div>
        </section>

        <form class="login-card" id="login-form">
          <input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" hidden>
          <div class="login-card-heading compact-heading">
            <div><span class="step-number">2</span><h3>Ingrese sus credenciales</h3></div>
            <p>Utilice los datos de su cuenta institucional.</p>
          </div>
          <div class="credential-grid">
            <label class="input-group" for="login-user">
              <span>Usuario</span>
              <span class="input-control"><i>${icon('users')}</i><input id="login-user" name="username" type="text" autocomplete="username" placeholder="Usuario o correo institucional" required></span>
            </label>
            <label class="input-group" for="login-password">
              <span>Contraseña</span>
              <span class="password-control input-control">
                <i>${icon('lock')}</i>
                <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Ingrese su contraseña" required>
                <button class="password-toggle" type="button" aria-label="Mostrar contraseña" aria-pressed="false">${icon('eye')}</button>
              </span>
            </label>
          </div>
          <div class="login-card-footer">
            <div><p class="login-feedback" id="login-feedback" aria-live="polite">Seleccione un perfil para continuar.</p><button class="login-recovery-link" id="open-recovery" type="button">¿Olvidó su contraseña?</button></div>
            <button class="login-submit" type="submit"><span>Ingresar a SIGA</span>${icon('login')}</button>
          </div>
        </form>
        <dialog class="record-dialog recovery-dialog" id="recovery-dialog"><form id="recovery-form">
          <header><div><p class="section-kicker">Recuperación segura</p><h2>Solicitar restablecimiento</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header>
          <div class="dialog-fields"><label class="wide">Usuario, correo o documento<input name="identifier" autocomplete="username" maxlength="160" required></label><p class="wide">Administración verificará la solicitud. Por seguridad, SIGA no confirma si el dato pertenece a una cuenta.</p></div>
          <p class="dialog-message" aria-live="polite"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Enviar solicitud</button></footer>
        </form></dialog>
      </div>
    </section>`;

  setupLogin();
}

function setupLogin() {
  const form = document.querySelector('#login-form');
  const roleButtons = [...document.querySelectorAll('.role-option')];
  const userInput = document.querySelector('#login-user');
  const passwordInput = document.querySelector('#login-password');
  const passwordToggle = document.querySelector('.password-toggle');
  const feedback = document.querySelector('#login-feedback');
  const experience = document.querySelector('.login-experience');
  const preview = document.querySelector('#profile-preview');
  const previewIcon = document.querySelector('#profile-preview-icon');
  const previewName = document.querySelector('#profile-preview-name');
  const previewDescription = document.querySelector('#profile-preview-description');
  const recoveryDialog = document.querySelector('#recovery-dialog');
  const recoveryForm = document.querySelector('#recovery-form');
  let selectedRoleKey = '';

  const selectRole = (button, moveToCredentials) => {
      selectedRoleKey = button.dataset.role;
      roleButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-checked', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      feedback.classList.remove('is-error');
      feedback.textContent = `Rol seleccionado: ${roles[selectedRoleKey].name}.`;
      experience.dataset.tone = roles[selectedRoleKey].tone;
      preview.classList.add('is-selected');
      previewIcon.innerHTML = icon(roles[selectedRoleKey].icon);
      previewName.textContent = roles[selectedRoleKey].name;
      previewDescription.textContent = roles[selectedRoleKey].description;
      if (moveToCredentials) userInput.focus();
  };
  roleButtons.forEach((button, index) => {
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener('click', () => selectRole(button, true));
    button.addEventListener('keydown', (event) => {
      const keys = ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const current = roleButtons.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? roleButtons.length - 1
        : ['ArrowRight','ArrowDown'].includes(event.key) ? (current + 1) % roleButtons.length
          : (current - 1 + roleButtons.length) % roleButtons.length;
      selectRole(roleButtons[next], false);
      roleButtons[next].focus();
    });
  });

  passwordToggle.addEventListener('click', () => {
    const revealing = passwordInput.type === 'password';
    passwordInput.type = revealing ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(revealing));
    passwordToggle.setAttribute('aria-label', revealing ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  document.querySelector('#open-recovery').addEventListener('click', () => recoveryDialog.showModal());
  recoveryDialog.querySelector('.dialog-close').addEventListener('click', () => recoveryDialog.close());
  recoveryDialog.querySelector('.dialog-cancel').addEventListener('click', () => recoveryDialog.close());
  recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!recoveryForm.reportValidity()) return;
    const submit = recoveryForm.querySelector('[type="submit"]');
    const message = recoveryForm.querySelector('.dialog-message');
    submit.disabled = true;
    try {
      const response = await fetch('/api/password-recovery/request', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(recoveryForm))) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No fue posible enviar la solicitud.');
      message.textContent = result.message;
      recoveryForm.reset();
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedRoleKey) {
      feedback.classList.add('is-error');
      feedback.textContent = 'Seleccione un rol antes de iniciar sesión.';
      roleButtons[0].focus();
      return;
    }
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    feedback.classList.remove('is-error');
    feedback.textContent = 'Verificando credenciales…';
    try {
      const response = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email:userInput.value, password:passwordInput.value, role:selectedRoleKey, website:form.elements.website.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No fue posible iniciar sesión.');
      window.location.href = result.redirect;
    } catch (error) {
      feedback.classList.add('is-error');
      feedback.textContent = error.message;
      submit.disabled = false;
    }
  });
}

function renderRoleBanner(role) {
  return `<section class="role-banner">
    <div class="banner-orbit orbit-one" aria-hidden="true"></div><div class="banner-orbit orbit-two" aria-hidden="true"></div>
    <div class="role-banner-copy">
      <span class="live-label"><i></i> Centro de control · ${role.name}</span>
      <h2>${role.greeting}</h2>
      <p>${role.description}</p>
      <div class="banner-tags"><span>${icon('shield')} Acceso protegido</span><span>${icon('check')} Información actualizada</span></div>
    </div>
    <div class="banner-overview">
      <span class="overview-label">Vista general</span>
      <strong>${role.pages.length}</strong>
      <span>módulos habilitados</span>
      <div class="overview-pulse"><i></i>Sistema operativo</div>
    </div>
  </section>`;
}

async function api(url, options = {}) {
  const headers = {...(options.headers || {})};
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (options.method && options.method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(url, {...options, headers});
  if (response.status === 401) {
    window.location.href = '/index.html?session=required';
    throw new Error('La sesión finalizó.');
  }
  if (response.status === 204) return null;
  const result = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) { const error = new Error(result.error || 'No fue posible completar la operación.'); error.details = result; throw error; }
  return result;
}

const programOptions = (items, selected = '', institutional = false) => `${institutional ? '<option>Institucional</option>' : ''}${items.map((item) => `<option ${item === selected ? 'selected' : ''}>${item}</option>`).join('')}`;
const stateOptions = (selected = 'Activo') => ['Activo','Inactivo'].map((item) => `<option ${item === selected ? 'selected' : ''}>${item}</option>`).join('');
const documentTypeOptions = (selected = 'DNI') => [['DNI','DNI'],['CE','Carné de extranjería']].map(([value,label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
const identityDocument = (item) => `<span class="document-identity"><small>${escapeHtml(item.documentType || 'DNI')}</small><strong>${escapeHtml(item.document || '')}</strong></span>`;

async function renderAdminDashboard() {
  const data = await api('/api/admin/dashboard');
  const cards = [
    ['Estudiantes',data.summary.students,'users','blue','Padrón activo'],['Docentes',data.summary.teachers,'book','teal','Personal docente'],['Coordinadores',data.summary.coordinators,'graduation','violet','Gestión académica'],
    ['Docentes tutores',data.summary.tutors,'heart','amber','Función de tutoría'],['Vigilantes',data.summary.guards,'shield','red','Control de acceso'],['Administradores',data.summary.administrators,'settings','green','Gestión del sistema'],
  ];
  const max = Math.max(...data.attendance.byProgram.map((item) => item.total),1);
  const totalAttendance = data.attendance.byState.reduce((sum,item) => sum + item.total,0);
  const presentTotal = data.attendance.byState.find((item) => item.state === 'Presente')?.total || 0;
  const tardyTotal = data.attendance.byState.find((item) => item.state === 'Tardanza')?.total || 0;
  const attendanceRate = totalAttendance ? Math.round(presentTotal / totalAttendance * 100) : 0;
  const presentRate = totalAttendance ? Math.round(presentTotal / totalAttendance * 100) : 0;
  const tardyEnd = totalAttendance ? Math.round((presentTotal + tardyTotal) / totalAttendance * 100) : 0;
  const today = new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  const firstName = (currentUser?.name || 'Administrador').split(/\s+/)[0];
  const initials = (currentUser?.name || 'AD').split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase();
  const avatar = currentUser?.photoUrl ? `<img src="${currentUser.photoUrl}?v=${Date.now()}" alt="Foto del Administrador">` : `<span>${escapeHtml(initials)}</span>`;
  content.innerHTML = `<section class="dashboard-command">
      <div class="dashboard-command-copy"><span class="dashboard-live"><i></i> Centro de control en línea</span><p class="dashboard-date">${escapeHtml(today)}</p><h2>Buen día, ${escapeHtml(firstName)}.</h2><p>Supervise la comunidad educativa, la asistencia y las operaciones institucionales desde un solo lugar.</p>
        <div class="dashboard-command-actions"><a class="command-primary" href="${pageHref('administrador','personal')}">${icon('users')} Gestionar personal</a><a class="command-secondary" href="${pageHref('administrador','reportes')}">${icon('chart')} Ver reportes</a></div>
      </div>
      <div class="dashboard-admin-card"><div class="dashboard-admin-avatar">${avatar}</div><span><small>Sesión del Administrador</small><strong>${escapeHtml(currentUser?.name || 'Administrador')}</strong><em>${escapeHtml(currentUser?.position || 'Gestión institucional')}</em></span><a href="${pageHref('administrador','cuenta')}" aria-label="Editar mi perfil">→</a></div>
      <div class="attendance-gauge" data-gauge="${attendanceRate * 3.6}"><div><strong>${attendanceRate}%</strong><span>asistencia</span></div><p><i></i> Jornada institucional</p></div>
    </section>
    <section class="dashboard-shortcuts" aria-label="Accesos rápidos"><a href="${pageHref('administrador','personal')}"><span class="tone-blue">${icon('users')}</span><strong>Personal</strong><small>Administrar cuentas</small><b>→</b></a><a href="${pageHref('administrador','carga-excel')}"><span class="tone-teal">${icon('upload')}</span><strong>Carga masiva</strong><small>Importar desde Excel</small><b>→</b></a><a href="${pageHref('administrador','reportes')}"><span class="tone-violet">${icon('chart')}</span><strong>Reportes</strong><small>Analizar indicadores</small><b>→</b></a><a href="${pageHref('administrador','cuenta')}"><span class="tone-amber">${icon('student')}</span><strong>Mi cuenta</strong><small>Perfil y seguridad</small><b>→</b></a></section>
    <section class="dashboard-section-heading"><div><p class="section-kicker">Resumen institucional</p><h2>Comunidad registrada</h2></div><span>${cards.length} indicadores sincronizados</span></section>
    <section class="dashboard-metric-grid">${cards.map(([label,value,iconName,tone,detail]) => `<article class="dashboard-metric metric-accent-${tone}"><header><span class="metric-icon tone-${tone}">${icon(iconName)}</span><span class="dashboard-metric-state"><i></i> Activos</span></header><div><strong>${value}</strong><span>${label}</span><p>${detail}</p></div><footer>${icon('check')} Datos sincronizados</footer></article>`).join('')}</section>
    <div class="dashboard-insights">
      <section class="panel program-insight"><div class="insight-heading"><div><p class="section-kicker">Asistencia académica</p><h2>Participación por programa</h2></div><span>${totalAttendance} registros</span></div><div class="program-bars">${data.attendance.byProgram.map((item,index) => `<article><div class="program-bar-label"><span><i>0${index+1}</i>${escapeHtml(item.program)}</span><strong>${item.total}</strong></div><div class="program-bar-track"><span data-progress="${Math.max(6,Math.round(item.total/max*100))}"></span></div></article>`).join('')}</div><a class="insight-link" href="${pageHref('administrador','reportes')}">Explorar reporte completo <span>→</span></a></section>
      <section class="panel state-insight"><div class="insight-heading"><div><p class="section-kicker">Resumen acumulado</p><h2>Estado de asistencia</h2></div><span>Histórico registrado</span></div><div class="attendance-overview"><div class="attendance-donut" data-present="${presentRate}" data-tardy="${tardyEnd}"><div><strong>${totalAttendance}</strong><span>registros</span></div></div><div class="attendance-legend">${data.attendance.byState.map((item,index) => `<article class="legend-${index}"><i></i><span><strong>${item.state}</strong><small>${Math.round(item.total/Math.max(totalAttendance,1)*100)}% del total</small></span><b>${item.total}</b></article>`).join('')}</div></div><div class="attendance-callout">${icon('check')}<span><strong>${attendanceRate}% de asistencia efectiva</strong><small>Indicador calculado con todos los registros almacenados.</small></span></div></section>
    </div>`;
  applyDynamicStyles();
}

const managerConfig = {
  students: { title:'Gestión de estudiantes', kicker:'Registro académico', endpoint:'/api/admin/students', singular:'estudiante', exportUrl:'/api/admin/export/students.xlsx', roles:[], readOnly:true },
  coordinatorStudents: { title:'Gestión de estudiantes', kicker:'Registro académico', endpoint:'/api/coordinator/students', singular:'estudiante', exportUrl:'/api/coordinator/students.xlsx', templateUrl:'/api/coordinator/students/template?v=20261023-fixed-7', importUrl:'/api/coordinator/students/import', roles:[], readOnly:false },
  staff: { title:'Gestión de personal', kicker:'Cuentas institucionales', endpoint:'/api/admin/staff', singular:'cuenta', newLabel:'Nueva cuenta', export:'staff', roles:['Docente','Coordinador','Padre o apoderado','Administrador'], roleMeta:{ Docente:['Docentes','book','teal'], Coordinador:['Coordinadores','graduation','violet'], 'Padre o apoderado':['Padres o apoderados','users','green'], Administrador:['Administradores','settings','indigo'] } },
  guards: { title:'Gestión de vigilantes', kicker:'Control de acceso', endpoint:'/api/admin/staff', singular:'vigilante', export:'staff', templateUrl:'/api/admin/templates/guards', importUrl:'/api/admin/import/guards', roles:['Vigilante'] },
};

function managerForm(type, programsList, tutors = []) {
  const config = managerConfig[type];
  const newLabel = config.newLabel || `Nuevo ${config.singular}`;
  const student = type === 'students' || type === 'coordinatorStudents';
  const coordinatorStudent = type === 'coordinatorStudents';
  const guard = type === 'guards';
  return `<dialog class="record-dialog" id="record-dialog"><form id="record-form">
    <header><div><p class="section-kicker">${config.kicker}</p><h2 id="record-dialog-title">${newLabel}</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></header>
    <input type="hidden" name="id"><div class="dialog-fields">
      <label>Tipo de documento<select name="documentType" required>${documentTypeOptions()}</select></label><label>Número de documento<input name="document" maxlength="8" inputmode="numeric" pattern="[0-9]{8}" placeholder="8 dígitos" required></label><label>Nombres completos<input name="name" required></label><label>Correo institucional<input name="email" type="email" required></label>
      ${student ? `<label>Semestre<select name="semester">${['I','II','III','IV','V','VI'].map((item) => `<option>${item}</option>`).join('')}</select></label><label>Programa<select name="program">${programOptions(programsList)}</select></label>` : ''}
      ${coordinatorStudent ? `<label>Grupo o sección<input name="group" maxlength="30" placeholder="Ej. III-A" required></label><label>Tutor asignado<select name="tutorId"><option value="">Sin tutor asignado</option>${tutors.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="wide">Contraseña inicial o nueva<input name="password" type="password" minlength="10" autocomplete="new-password" placeholder="Mayúscula, minúscula, número y símbolo"></label>` : ''}
      ${!student && !guard ? `<label>Rol principal<select name="role">${config.roles.map((item) => `<option>${item}</option>`).join('')}</select></label><label>Programa principal<select name="program">${programOptions(programsList)}</select></label><fieldset class="wide multi-role-field" data-teacher-programs><legend>Docente de empleabilidad u otros programas</legend><p>Seleccione los programas adicionales donde podrá recibir cursos. La tutoría y la coordinación conservan su programa principal.</p>${programsList.map((program)=>`<label><input type="checkbox" name="additionalPrograms" value="${escapeHtml(program)}"><span class="additional-role-option">${escapeHtml(program)}</span></label>`).join('')}</fieldset><fieldset class="wide multi-role-field" data-academic-role-options><legend>Funciones adicionales para esta cuenta</legend><p>La tutoría se habilita dentro de una cuenta Docente; no crea una cuenta Tutor independiente.</p>${[['Docente','book','Permite gestionar únicamente las clases que le sean asignadas.'],['Coordinador','graduation','Permite administrar el programa académico asignado.'],['Tutor','heart','Habilita el modo Tutor para acompañar únicamente a sus tutorados.']].map(([roleName,iconName,description])=>`<label data-additional-role="${roleName}"><input type="checkbox" name="roles" value="${roleName}"><span class="additional-role-option">${icon(iconName)}<span><strong>${roleName === 'Tutor' ? 'Habilitar función de tutor' : `Habilitar modo ${roleName}`}</strong><small>${description}</small></span></span></label>`).join('')}</fieldset>` : ''}
      ${guard ? `<input type="hidden" name="role" value="Vigilante"><input type="hidden" name="program" value="Institucional"><label>Turno<select name="shift">${['Mañana','Tarde','Noche','Rotativo'].map((item) => `<option>${item}</option>`).join('')}</select></label><label>Punto de control<input name="pointOfControl" maxlength="80" value="Puerta principal" placeholder="Ej. Puerta principal" required></label>` : ''}
      ${!student ? '<label class="wide">Contraseña de acceso<input name="password" type="password" minlength="10" autocomplete="new-password" placeholder="Mayúscula, minúscula, número y símbolo"></label>' : ''}
      <label>Estado<select name="state">${stateOptions()}</select></label>
    </div><p class="dialog-message" aria-live="polite"></p><footer><button type="button" class="secondary-action dialog-cancel">Cancelar</button><button type="submit" class="primary-action">Guardar cambios</button></footer>
  </form></dialog>`;
}

async function renderAdminManager(type) {
  const config = managerConfig[type];
  const studentManager = type === 'students' || type === 'coordinatorStudents';
  const canEdit = !config.readOnly;
  const initialUrl = type === 'guards' ? `${config.endpoint}?role=Vigilante` : type === 'staff' ? `${config.endpoint}?scope=personnel` : config.endpoint;
  const initial = await api(initialUrl);
  const recoveryData = type === 'staff' ? await api('/api/admin/password-recovery') : { items: [] };
  let recoveryItems = recoveryData.items;
  let items = initial.items;
  const programsList = initial.programs;
  const coordinatorGroups = initial.groups || [];
  const coordinatorTutors = initial.tutors || [];
  let activeRole = '';
  const activeStaff = studentManager ? items.filter((item) => item.state === 'Activo').length : items.filter((item) => item.hasAccess).length;
  const uniquePrograms = new Set(items.map((item) => item.program).filter((program) => program && program !== 'Institucional')).size;
  const uniqueShifts = new Set(items.map((item) => item.shift).filter(Boolean)).size;
  const overviewConfig = studentManager
    ? ['student','Padrón académico',type === 'students' ? 'Información estudiantil, clara y disponible' : 'Gestión académica de su programa',type === 'students' ? 'Consulte la comunidad estudiantil por programa, semestre y estado. Este módulo permanece en modo solo lectura.' : 'Registre, actualice e importe estudiantes correspondientes a su programa de estudios.',[['Estudiantes',items.length,'registrados'],['Activos',activeStaff,'matriculados'],['Programas',uniquePrograms,'académicos']]]
    : type === 'guards'
      ? ['shield','Control de acceso','Seguridad organizada por turnos','Administre al personal de vigilancia, sus cuentas institucionales y la cobertura de cada turno.',[['Vigilantes',items.length,'registrados'],['Activos',activeStaff,'con acceso'],['Turnos',uniqueShifts,'asignados']]]
      : ['family','Directorio institucional','El talento que impulsa SIGA','Administre perfiles, accesos y programas académicos desde un directorio organizado por responsabilidades.',[['Cuentas',items.length,'registradas'],['Activas',activeStaff,'con acceso'],['Roles',config.roles.length,'institucionales']]];
  const managerOverview = `<section class="staff-command manager-command manager-command-${type}">
    <div class="staff-command-icon">${icon(overviewConfig[0])}</div><div class="staff-command-copy"><span>${overviewConfig[1]}</span><h2>${overviewConfig[2]}</h2><p>${overviewConfig[3]}</p></div>
    <div class="staff-command-stats">${overviewConfig[4].map(([label,total,detail]) => `<article><strong>${total}</strong><span>${label}</span><small>${detail}</small></article>`).join('')}</div>
  </section>`;
  const recoveryPanel = type === 'staff' && recoveryItems.length ? `<section class="panel recovery-requests" aria-labelledby="recovery-title"><div class="insight-heading"><div><p class="section-kicker">Seguridad de cuentas</p><h2 id="recovery-title">Solicitudes de recuperación</h2></div><span>${recoveryItems.length} pendiente${recoveryItems.length===1?'':'s'}</span></div><div class="recovery-request-list">${recoveryItems.map((item)=>`<article><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)} · ${escapeHtml(item.role)}</small></div><button class="secondary-action" type="button" data-recovery="${item.id}">${icon('lock')} Restablecer</button></article>`).join('')}</div></section>` : '';
  const roleClassifier = type === 'staff' ? `<div class="role-classifier" role="group" aria-label="Filtrar el directorio por rol">
    <button type="button" class="role-filter-card role-tone-blue is-active" data-role-scope="" aria-pressed="true"><span class="role-filter-icon tone-blue">${icon('users')}</span><span class="role-filter-copy"><strong>Todo el personal</strong><span>Vista general</span></span></button>
    ${config.roles.map((roleName) => { const [label,iconName,tone] = config.roleMeta[roleName]; return `<button type="button" class="role-filter-card role-tone-${tone}" data-role-scope="${roleName}" aria-pressed="false"><span class="role-filter-icon tone-${tone}">${icon(iconName)}</span><span class="role-filter-copy"><strong>${label}</strong><span>Ver perfiles</span></span></button>`; }).join('')}
  </div>` : '';
  const searchControl = `<label class="manager-search">${icon('scan')}<span class="visually-hidden">Buscar registros</span><input name="search" type="search" aria-label="Buscar por nombre, documento o correo" placeholder="Buscar por nombre, documento o correo"></label>`;
  const exportBase = config.exportUrl || `/api/admin/export/${config.export}.xlsx`;
  content.innerHTML = `${managerOverview}${recoveryPanel}<section class="panel manager-panel directory-manager-panel ${type}-manager-panel">${panelHeading(config.kicker,type === 'staff' ? 'Directorio del personal' : studentManager ? 'Directorio estudiantil' : 'Directorio de vigilancia',config.readOnly ? 'Consulta protegida en modo solo lectura.' : 'Busque, filtre y administre los registros institucionales.')}
    ${roleClassifier}<div class="manager-toolbar"><form class="manager-filters manager-filters-${type}" aria-label="Filtros del directorio">${searchControl}${type === 'guards' ? '' : `<select name="program" aria-label="Filtrar por programa"><option value="">Todos los programas</option>${programOptions(programsList,'',!studentManager)}${type==='staff'?'<option>Empleabilidad</option>':''}</select>`}${studentManager ? `<select name="semester" aria-label="Filtrar por semestre"><option value="">Todos los semestres</option>${['I','II','III','IV','V','VI'].map((item) => `<option>${item}</option>`).join('')}</select>` : ''}${type === 'coordinatorStudents' ? `<select name="group" aria-label="Filtrar por grupo"><option value="">Todos los grupos</option>${coordinatorGroups.map((item) => `<option>${escapeHtml(item)}</option>`).join('')}</select><select name="tutor" aria-label="Filtrar por tutor"><option value="">Todos los tutores</option>${coordinatorTutors.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select>` : ''}<select name="state" aria-label="Filtrar por estado"><option value="">Todos los estados</option><option>Activo</option><option>Inactivo</option></select></form>
      <div class="manager-actions">${type === 'staff' ? `<a class="secondary-action manager-action manager-action-import bulk-action" href="${pageHref('administrador','carga-excel')}?type=teachers">${icon('upload')}<span>Carga masiva</span></a>` : ''}${config.templateUrl ? `<a class="secondary-action manager-action manager-action-template" href="${config.templateUrl}">${icon('file')}<span>Descargar plantilla</span></a><button class="secondary-action manager-action manager-action-import bulk-action" type="button" data-manager="import">${icon('upload')}<span>Carga masiva</span></button><input id="manager-import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>` : ''}<a class="secondary-action manager-action manager-action-export manager-export" href="${exportBase}">${icon('file')}<span>Exportar Excel</span></a>${canEdit ? `<button class="primary-action manager-action manager-action-create" type="button" data-manager="new">${icon('users')}<span>Registrar ${config.singular}</span></button>` : ''}</div></div>
    ${config.importUrl ? `<div class="manager-import-feedback" hidden aria-live="polite"></div>` : ''}
    <div class="table-wrap staff-table-wrap"><table class="data-table manager-table staff-directory-table"><thead><tr>${(type === 'coordinatorStudents' ? ['Código','Estudiante','Documento','Semestre y grupo','Tutor','Asistencia','Estado','Acciones'] : studentManager ? ['Código','Estudiante','Documento','Programa','Semestre','Estado',...(canEdit ? ['Acciones'] : [])] : type === 'guards' ? ['Código','Personal','Documento','Rol','Turno','Estado','Acciones'] : ['Código','Personal','Documento','Rol','Programa','Estado','Acciones']).map((item) => `<th>${item}</th>`).join('')}</tr></thead><tbody></tbody></table></div><p class="manager-count" aria-live="polite"></p>
  </section>${managerForm(type,programsList,coordinatorTutors)}${type === 'staff' ? `<dialog class="record-dialog" id="recovery-reset-dialog"><form id="recovery-reset-form"><header><div><p class="section-kicker">Acceso institucional</p><h2>Restablecer contraseña</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><input type="hidden" name="id"><div class="dialog-fields"><p class="wide" id="recovery-account-name"></p><label class="wide">Nueva contraseña temporal<input name="password" type="password" minlength="10" autocomplete="new-password" required><small>Incluya mayúscula, minúscula, número y símbolo.</small></label></div><p class="dialog-message" aria-live="polite"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Restablecer y cerrar sesiones</button></footer></form></dialog>` : ''}`;
  const tableBody = content.querySelector('.manager-table tbody');
  const count = content.querySelector('.manager-count');
  const dialog = content.querySelector('#record-dialog');
  const form = content.querySelector('#record-form');
  const filters = content.querySelector('.manager-filters');
  const recoveryDialog = content.querySelector('#recovery-reset-dialog');
  const recoveryForm = content.querySelector('#recovery-reset-form');
  const personTone = (item) => type === 'staff' ? config.roleMeta[item.role]?.[2] || 'blue' : 'red';
  const personInitials = (name) => String(name).split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase();
  const accountStatus = (item) => `${status(item.state)}${item.hasAccess ? '' : '<small class="table-subcopy account-access-warning">Sin cuenta de acceso activa</small>'}`;
  const rowHtml = (item) => type === 'coordinatorStudents' ? `<tr><td><span class="staff-code">${item.id}</span></td><td><div class="personnel-cell"><span class="personnel-avatar tone-violet">${escapeHtml(personInitials(item.name))}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></span></div></td><td>${identityDocument(item)}</td><td><span class="semester-badge">${escapeHtml(item.semester)}</span><small class="table-subcopy">${escapeHtml(item.group)}</small></td><td>${escapeHtml(item.tutor)}</td><td><span class="attendance-rate-chip">${item.attendanceRate}%</span><small class="table-subcopy">${item.attendanceRecords} registros</small></td><td>${status(item.state)}</td><td>${recordActions(item)}</td></tr>` : studentManager ? `<tr><td><span class="staff-code">${item.id}</span></td><td><div class="personnel-cell"><span class="personnel-avatar tone-blue">${escapeHtml(personInitials(item.name))}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></span></div></td><td>${identityDocument(item)}</td><td><span class="academic-program">${icon('graduation')}${escapeHtml(item.program)}</span></td><td><span class="semester-badge">${escapeHtml(item.semester)}</span></td><td>${status(item.state)}</td>${canEdit ? `<td>${recordActions(item)}</td>` : ''}</tr>` : `<tr><td><span class="staff-code">${item.id}</span></td><td><div class="personnel-cell"><span class="personnel-avatar tone-${personTone(item)}">${escapeHtml(personInitials(item.name))}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></span></div></td><td>${identityDocument(item)}</td><td><span class="personnel-role role-${personTone(item)}">${icon(config.roleMeta?.[item.role]?.[1] || 'shield')}${escapeHtml(item.role)}</span>${type !== 'guards' && item.role !== 'Docente' && (item.roles||[]).includes('docente') ? `<small class="additional-role-badge">${icon('book')} Modo Docente habilitado</small>` : ''}</td>${type === 'guards' ? '' : `<td><span class="personnel-program">${escapeHtml([item.program,...(item.additionalPrograms||[])].join(' · '))}</span></td>`}${type === 'guards' ? `<td><select class="shift-select" data-id="${item.id}">${['Mañana','Tarde','Noche','Rotativo'].map((value) => `<option ${value === item.shift ? 'selected' : ''}>${value}</option>`).join('')}</select></td>` : ''}<td>${accountStatus(item)}</td><td>${recordActions(item)}</td></tr>`;
  function recordActions(item) {
    const safeName=escapeHtml(item.name);
    const toggleLabel=item.state === 'Activo' ? 'Desactivar' : 'Activar';
    const protectedSelf=Boolean(item.isCurrentAccount && item.role === 'Administrador');
    const missingAccount=item.state !== 'Activo' && item.accessState === 'Sin cuenta';
    const protectedHint=protectedSelf ? 'La cuenta administrativa en uso se protege desde el servidor.' : missingAccount ? 'Edite el registro y defina una contraseña antes de activarlo.' : '';
    const toggleDisabled=protectedSelf || missingAccount;
    return `<div class="record-actions"><button class="record-edit" type="button" data-record="edit" data-id="${item.id}" aria-label="Editar ${safeName}" title="Editar">${icon('file')}<span>Editar</span></button><button class="record-toggle" type="button" data-record="toggle" data-id="${item.id}" aria-label="${toggleLabel} ${safeName}" title="${toggleDisabled ? protectedHint : toggleLabel}" ${toggleDisabled ? 'disabled' : ''}>${icon(item.state === 'Activo' ? 'lock' : 'check')}<span>${toggleLabel}</span></button><button class="record-delete" type="button" data-record="delete" data-id="${item.id}" aria-label="Eliminar ${safeName}" title="${protectedSelf ? protectedHint : 'Eliminar'}" ${protectedSelf ? 'disabled' : ''}>${icon('alert')}<span>Eliminar</span></button></div>`;
  }
  function draw() { tableBody.innerHTML = items.map(rowHtml).join('') || `<tr><td colspan="8" class="empty-cell">No se encontraron registros.</td></tr>`; count.textContent = `${items.length} registro${items.length === 1 ? '' : 's'}`; }
  function queryParams() { const params = new URLSearchParams(new FormData(filters)); if (type === 'guards') params.set('role','Vigilante'); if (type === 'staff') { params.set('scope','personnel'); if (activeRole) params.set('role',activeRole); } return params; }
  function updateExportLink() { const params = queryParams(); content.querySelector('.manager-export').href = `${exportBase}?${params}`; }
  async function refresh() { const params = queryParams(); const data = await api(`${config.endpoint}?${params}`); items = data.items; draw(); updateExportLink(); }
  function syncStaffProgram(role, selected = '') {
    if (type !== 'staff') return;
    const institutional = ['Administrador','Vigilante'].includes(role);
    const academic = ['Docente','Coordinador'].includes(role);
    const field = form.elements.program;
    const options = role === 'Docente' ? [...programsList, 'Empleabilidad'] : programsList;
    field.innerHTML = institutional ? '<option>Institucional</option>' : programOptions(options);
    field.value = institutional ? 'Institucional' : (options.includes(selected) ? selected : options[0] || '');
    const transversal = role === 'Docente' && field.value === 'Empleabilidad';
    const extraField = form.querySelector('[data-teacher-programs]');
    if (extraField) {
      extraField.hidden = role !== 'Docente' || transversal;
      extraField.querySelectorAll('input').forEach((input) => {
        input.disabled = role !== 'Docente' || transversal || input.value === field.value;
        if (input.disabled) input.checked = false;
      });
    }
    const rolesField = form.querySelector('[data-academic-role-options]');
    if (rolesField) {
      rolesField.hidden = !academic || transversal;
      rolesField.querySelectorAll('[data-additional-role]').forEach((option) => {
        const isPrimary = option.dataset.additionalRole === role;
        option.hidden = isPrimary;
        const input = option.querySelector('input');
        input.disabled = transversal;
        if (isPrimary || !academic || transversal) input.checked = false;
      });
    }
  }
  function syncDocumentField() { const ce=form.elements.documentType.value==='CE'; const field=form.elements.document; field.required=true; field.maxLength=ce?15:8; field.minLength=ce?9:8; field.pattern=ce?'[A-Za-z0-9]{9,15}':'[0-9]{8}'; field.inputMode=ce?'text':'numeric'; field.placeholder=ce?'Más de 8 letras o números':'8 dígitos'; field.title=ce?'El Carné de Extranjería debe contener más de 8 caracteres y tener un formato válido.':'El DNI debe contener exactamente 8 dígitos numéricos.'; }
  function openRecord(item = {}) { form.reset(); form.elements.id.value = item.id || ''; [...form.elements].forEach((field) => { if (field.name && field.name !== 'roles' && field.name !== 'additionalPrograms' && item[field.name] !== undefined) field.value = item[field.name]; }); if (!item.documentType) form.elements.documentType.value='DNI'; syncDocumentField(); form.querySelectorAll('[name="roles"]').forEach((field)=>{field.checked=(item.roles||[]).includes(({Docente:'docente',Coordinador:'coordinador',Tutor:'tutor'})[field.value]);}); if (form.elements.role) syncStaffProgram(item.role || form.elements.role.value,item.program || ''); form.querySelectorAll('[name="additionalPrograms"]').forEach((field)=>{field.checked=!field.disabled&&(item.additionalPrograms||[]).includes(field.value);}); if (form.elements.password) { form.elements.password.value = ''; form.elements.password.required = !item.id || !item.accountId; form.elements.password.placeholder = item.id && item.accountId ? 'Déjela vacía para conservarla' : 'Defina una contraseña segura para vincular la cuenta'; } content.querySelector('#record-dialog-title').textContent = item.id ? `Editar ${config.singular}` : (config.newLabel || `Nuevo ${config.singular}`); form.querySelector('button[type="submit"]').textContent=item.id?'Guardar cambios':`Crear ${config.singular}`; dialog.showModal(); }
  function openManagerRecord(item = {}) { openRecord(item); if (type === 'coordinatorStudents' && form.elements.password) { const editing=Boolean(item.id); form.elements.password.disabled=editing; form.elements.password.required=!editing; form.elements.password.closest('label').hidden=editing; form.elements.state.disabled=editing; form.elements.state.closest('label').hidden=editing; } }
  let timer;
  filters.addEventListener('submit', (event) => event.preventDefault());
  filters.addEventListener('input', () => { updateExportLink(); clearTimeout(timer); timer = setTimeout(() => refresh().catch((error) => notify(error.message,'error')),250); });
  filters.addEventListener('change', () => refresh().catch((error) => notify(error.message,'error')));
  content.querySelector('.role-classifier')?.addEventListener('click', (event) => { const button = event.target.closest('[data-role-scope]'); if (!button) return; activeRole = button.dataset.roleScope; content.querySelectorAll('.role-filter-card').forEach((item) => { const selected = item === button; item.classList.toggle('is-active',selected); item.setAttribute('aria-pressed',String(selected)); }); const bulk = content.querySelector('.bulk-action'); const importTypes = { Docente:'teachers',Coordinador:'coordinators','Padre o apoderado':'parents',Administrador:'administrators' }; if (bulk && type === 'staff') bulk.href = `${pageHref('administrador','carga-excel')}?type=${importTypes[activeRole] || 'teachers'}`; refresh().catch((error) => notify(error.message,'error')); });
  content.querySelector('[data-manager="new"]')?.addEventListener('click', () => openManagerRecord());
  form.elements.role?.addEventListener('change', () => syncStaffProgram(form.elements.role.value));
  form.elements.program?.addEventListener('change', () => { if (type === 'staff') syncStaffProgram(form.elements.role.value, form.elements.program.value); });
  form.elements.documentType.addEventListener('change', syncDocumentField);
  const managerImportFile = content.querySelector('#manager-import-file');
  const importButton = content.querySelector('[data-manager="import"]');
  const importFeedback = content.querySelector('.manager-import-feedback');
  importButton?.addEventListener('click', () => managerImportFile.click());
  managerImportFile?.addEventListener('change', async () => {
    const file = managerImportFile.files[0];
    if (!file) return;
    const values = new FormData(); values.append('file',file);
    importButton.disabled = true;
    importButton.innerHTML = `${icon('clock')} Validando…`;
    importFeedback.hidden = false;
    importFeedback.className = 'manager-import-feedback is-loading';
    importFeedback.innerHTML = `${icon('scan')} <span><strong>Revisando ${escapeHtml(file.name)}</strong><small>Validamos columnas, duplicados, programa, grupo y credenciales.</small></span>`;
    try {
      const result = await api(config.importUrl,{method:'POST',body:values});
      importFeedback.className = 'manager-import-feedback is-success';
      importFeedback.innerHTML = `${icon('check')} <span><strong>${escapeHtml(result.message)}</strong><small>Las cuentas ya pueden acceder con el correo y la contraseña inicial de la plantilla.</small></span>`;
      notify(result.message); await refresh();
    } catch (error) {
      const rows=error.details?.errors || [];
      importFeedback.className = 'manager-import-feedback is-error';
      importFeedback.innerHTML = `${icon('alert')}<span><strong>${escapeHtml(error.message)}</strong>${rows.length ? `<ul>${rows.map((item)=>`<li>Fila ${item.row}: ${escapeHtml(item.message)}</li>`).join('')}</ul>` : '<small>Revise que el archivo corresponda a la plantilla oficial .xlsx.</small>'}</span>`;
      notify(error.message,'error');
    } finally {
      managerImportFile.value=''; importButton.disabled=false; importButton.innerHTML=`${icon('upload')} Carga masiva`;
    }
  });
  content.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  content.querySelector('.dialog-cancel').addEventListener('click', () => dialog.close());
  content.querySelector('.recovery-requests')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recovery]');
    if (!button) return;
    const item = recoveryItems.find((record) => record.id === button.dataset.recovery);
    if (!item) return;
    recoveryForm.reset(); recoveryForm.elements.id.value = item.id;
    content.querySelector('#recovery-account-name').textContent = `${item.name} · ${item.email}`;
    recoveryDialog.showModal(); recoveryForm.elements.password.focus();
  });
  recoveryDialog?.querySelector('.dialog-close').addEventListener('click', () => recoveryDialog.close());
  recoveryDialog?.querySelector('.dialog-cancel').addEventListener('click', () => recoveryDialog.close());
  recoveryForm?.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!recoveryForm.reportValidity()) return;
    const id=recoveryForm.elements.id.value; const password=recoveryForm.elements.password.value;
    try { const result=await api(`/api/admin/password-recovery/${id}`,{method:'PATCH',body:JSON.stringify({password})}); notify(result.message); recoveryDialog.close(); await renderAdminManager(type); }
    catch(error){ recoveryForm.querySelector('.dialog-message').textContent=error.message; }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const formData = new FormData(form); const values = Object.fromEntries(formData); values.roles=formData.getAll('roles'); if(type==='staff')values.additionalPrograms=formData.getAll('additionalPrograms'); const id = values.id; delete values.id; if(type==='coordinatorStudents'&&id)values.state=items.find((item)=>item.id===id)?.state;
    try { const result = await api(id ? `${config.endpoint}/${id}` : config.endpoint,{method:id?'PUT':'POST',body:JSON.stringify(values)}); notify(result.message); dialog.close(); await refresh(); } catch (error) { form.querySelector('.dialog-message').textContent = error.message; }
  });
  tableBody.addEventListener('change', async (event) => { if (!event.target.matches('.shift-select')) return; try { const result = await api(`/api/admin/staff/${event.target.dataset.id}/shift`,{method:'PATCH',body:JSON.stringify({shift:event.target.value})}); notify(result.message); await refresh(); } catch (error) { notify(error.message,'error'); await refresh(); } });
  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-record]'); if (!button) return;
    const item = items.find((record) => record.id === button.dataset.id); if (!item) return;
    if (button.dataset.record === 'edit') return openManagerRecord(item);
    if (button.dataset.record === 'delete' && !await confirmAction(`¿Eliminar ${item.name}? Esta acción no se puede deshacer.`)) return;
    try {
      if (button.dataset.record === 'delete') { await api(`${config.endpoint}/${item.id}`,{method:'DELETE'}); notify('Registro eliminado.'); }
      if (button.dataset.record === 'toggle') { const result = await api(`${config.endpoint}/${item.id}/state`,{method:'PATCH',body:JSON.stringify({state:item.state === 'Activo' ? 'Inactivo' : 'Activo'})}); notify(result.message); }
      await refresh();
    } catch (error) { notify(error.message,'error'); }
  });
  draw(); updateExportLink();
}

async function renderAdminImport() {
  const templateCards = [
    ['teachers','book','teal','Docentes','Programa, credenciales, estado y función de tutor.'],
    ['coordinators','graduation','violet','Coordinadores','Programa, usuario y credenciales de acceso.'],
    ['parents','family','green','Padres o apoderados','Vinculación por programa y acceso institucional.'],
    ['administrators','settings','blue','Administradores','Cuenta administrativa y credenciales seguras.'],
    ['guards','shield','red','Vigilantes','Cuenta institucional, estado y turno asignado.'],
  ];
  content.innerHTML = `<section class="import-command"><span class="import-command-icon">${icon('upload')}</span><div><p class="section-kicker text-on-dark">Carga inteligente</p><h2>De Excel a SIGA, en tres pasos</h2><p>Importe cuentas institucionales de forma segura, ordenada y con validación previa.</p></div><span class="import-command-badge">${icon('shield')} Proceso protegido</span></section>
  <section class="import-steps" aria-label="Pasos para la carga masiva"><article><b>01</b><span><strong>Descargue</strong><small>Elija la plantilla oficial.</small></span><i>${icon('file')}</i></article><article><b>02</b><span><strong>Complete</strong><small>Registre una persona por fila.</small></span><i>${icon('clipboard')}</i></article><article><b>03</b><span><strong>Importe</strong><small>SIGA verificará cada dato.</small></span><i>${icon('check')}</i></article></section>
  <div class="import-workspace"><section class="panel template-library">${panelHeading('Biblioteca de formatos','Plantillas por rol','Descargue el formato específico para cada tipo de cuenta.')}<div class="template-grid role-template-grid">${templateCards.map(([key,iconName,tone,label,description]) => `<article class="template-card template-${tone}"><span class="template-icon tone-${tone}">${icon(iconName)}</span><div><small>Plantilla de ${label.toLowerCase()}</small><strong>${label}</strong><p>${description}</p></div><a class="secondary-action" href="/api/admin/templates/${key}">${icon('file')} Descargar .xlsx</a></article>`).join('')}</div><div class="template-note">${icon('shield')}<span><strong>Estudiantes no incluidos</strong><small>La carga de estudiantes corresponde exclusivamente al Coordinador.</small></span></div></section>
  <section class="panel import-upload-panel">${panelHeading('Validación automática','Cargar plantilla','Seleccione el mismo rol del archivo que va a importar.')}<form class="import-form" id="admin-import-form"><label>Tipo de registros<select name="type">${templateCards.map(([key,,,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><div class="upload-zone"><input class="file-input-visually" id="admin-excel-file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><label for="admin-excel-file">${icon('upload')}<span><strong>Seleccione su archivo Excel</strong><small id="selected-file-name">Formato .xlsx · máximo 2 MB</small></span><b>Examinar</b></label></div><button class="primary-action import-submit" type="submit">${icon('check')} Validar e importar archivo</button><p class="form-message" aria-live="polite"></p></form><div class="import-results"></div></section></div>`;
  const form = content.querySelector('#admin-import-form');
  const fileInput = content.querySelector('#admin-excel-file');
  fileInput.addEventListener('change', () => { content.querySelector('#selected-file-name').textContent = fileInput.files[0]?.name || 'Formato .xlsx · máximo 2 MB'; content.querySelector('.upload-zone').classList.toggle('has-file',Boolean(fileInput.files[0])); });
  const requestedType = new URLSearchParams(window.location.search).get('type');
  if (templateCards.some(([key]) => key === requestedType)) form.elements.type.value = requestedType;
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const message = form.querySelector('.form-message');
    if (fileInput.files[0]?.size > 2 * 1024 * 1024) { message.textContent = 'El archivo Excel supera el límite de 2 MB.'; fileInput.focus(); return; }
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const values = new FormData(form); const type = values.get('type'); values.delete('type');
    message.textContent = 'Validando filas…';
    try { const result = await api(`/api/admin/import/${type}`,{method:'POST',body:values}); message.textContent = result.message; const destination = pageHref('administrador','personal'); content.querySelector('.import-results').innerHTML = `<div class="success-box">${icon('check')}<span><strong>${result.imported} registros incorporados</strong><a href="${destination}">Ver registros importados</a></span></div>`; notify(result.message); form.reset(); form.elements.type.value = type; content.querySelector('#selected-file-name').textContent = 'Formato .xlsx · máximo 2 MB'; content.querySelector('.upload-zone').classList.remove('has-file'); }
    catch (error) { message.textContent = error.message; const rows = error.details?.errors || []; content.querySelector('.import-results').innerHTML = rows.length ? `<div class="error-panel" role="alert"><strong>Corrija estas filas antes de importar:</strong><ul>${rows.map((item) => `<li>Fila ${item.row}: ${escapeHtml(item.message)}</li>`).join('')}</ul></div>` : ''; notify(error.message,'error'); }
    finally { submitButton.disabled = false; }
  });
}

async function renderAdminReports() {
  const dashboard = await api('/api/admin/students');
  content.innerHTML = `<section class="report-command"><span class="report-command-icon">${icon('chart')}</span><div><p class="section-kicker text-on-dark">Inteligencia institucional</p><h2>Datos que orientan decisiones</h2><p>Explore la asistencia, compare programas y exporte información consolidada.</p></div><div class="report-export"><a id="report-excel" href="/api/admin/reports.xlsx">${icon('file')} Excel</a><a id="report-pdf" href="/api/admin/reports.pdf">${icon('clipboard')} PDF</a></div></section>
  <section class="panel report-filter-panel"><div class="report-filter-heading"><span>${icon('scan')}</span><div><strong>Filtros del reporte</strong><small>Combine criterios para obtener una vista precisa.</small></div></div><form class="report-filters" id="report-filters"><label><span>Programa</span><select name="program"><option value="">Todos los programas</option>${programOptions(dashboard.programs)}</select></label><label><span>Semestre</span><select name="semester"><option value="">Todos</option>${['I','II','III','IV','V','VI'].map((item) => `<option>${item}</option>`).join('')}</select></label><label><span>Desde</span><input name="from" type="date"></label><label><span>Hasta</span><input name="to" type="date"></label><label><span>Estado</span><select name="state"><option value="">Todos</option><option>Presente</option><option>Tardanza</option><option>Ausente</option></select></label><button class="primary-action" type="submit">${icon('check')} Aplicar filtros</button></form></section><div class="report-results page-spacer" id="report-results"></div>`;
  const form = content.querySelector('#report-filters');
  const draw = async () => {
    const query = new URLSearchParams(new FormData(form)); const data = await api(`/api/admin/reports?${query}`); const max = Math.max(...data.byProgram.map((item) => item.total),1);
    const total = data.byState.reduce((sum,item) => sum + item.total,0); const present = data.byState.find((item) => item.state === 'Presente')?.total || 0; const tardy = data.byState.find((item) => item.state === 'Tardanza')?.total || 0; const rate = total ? Math.round(present/total*100) : 0; const presentRate=total?Math.round(present/total*100):0; const tardyEnd=total?Math.round((present+tardy)/total*100):0;
    content.querySelector('#report-results').innerHTML = `<section class="report-kpi-grid"><article class="report-kpi kpi-blue"><span>${icon('chart')}</span><div><small>Registros analizados</small><strong>${total}</strong><p>Asistencia consolidada</p></div></article><article class="report-kpi kpi-green"><span>${icon('check')}</span><div><small>Asistencia efectiva</small><strong>${rate}%</strong><p>Del periodo seleccionado</p></div></article><article class="report-kpi kpi-violet"><span>${icon('student')}</span><div><small>Estudiantes</small><strong>${data.students}</strong><p>Según programa y semestre</p></div></article><article class="report-kpi kpi-amber"><span>${icon('family')}</span><div><small>Personal</small><strong>${data.staff}</strong><p>Según alcance académico</p></div></article></section>
    <div class="report-insight-grid"><section class="panel report-program-panel"><div class="insight-heading"><div><p class="section-kicker">Comparación académica</p><h2>Asistencia por programa</h2></div><span>${data.byProgram.length} programas</span></div><div class="program-bars report-program-bars">${data.byProgram.map((item,index) => `<article><div class="program-bar-label"><span><i>0${index+1}</i>${escapeHtml(item.program)}</span><strong>${item.total}</strong></div><div class="program-bar-track"><span data-progress="${Math.max(4,Math.round(item.total/max*100))}"></span></div></article>`).join('')}</div></section>
    <section class="panel report-state-panel"><div class="insight-heading"><div><p class="section-kicker">Distribución</p><h2>Estado de asistencia</h2></div><span>${rate}% presente</span></div><div class="report-donut-layout"><div class="attendance-donut report-donut" data-present="${presentRate}" data-tardy="${tardyEnd}"><div><strong>${total}</strong><span>registros</span></div></div><div class="attendance-legend">${data.byState.map((item,index) => `<article class="legend-${index}"><i></i><span><strong>${item.state}</strong><small>${Math.round(item.total/Math.max(total,1)*100)}% del total</small></span><b>${item.total}</b></article>`).join('')}</div></div></section></div>
    <div class="report-detail-grid"><section class="panel report-detail-panel"><div class="insight-heading"><div><p class="section-kicker">Padrón académico</p><h2>Estudiantes por estado</h2></div></div><div class="report-summary-list">${data.studentByState.map((item) => `<article><span>${status(item.state)}</span><strong>${item.total}</strong></article>`).join('')}</div></section><section class="panel report-detail-panel"><div class="insight-heading"><div><p class="section-kicker">Directorio institucional</p><h2>Personal por rol</h2></div></div><div class="report-summary-list">${data.staffByRole.map((item) => `<article><span>${escapeHtml(item.role)}</span><strong>${item.total}</strong></article>`).join('') || '<p class="empty-cell">No hay personal para el filtro seleccionado.</p>'}</div></section></div>
    <section class="panel permanence-report"><div class="insight-heading"><div><p class="section-kicker">Seguimiento preventivo</p><h2>Permanencia por programa</h2></div><span>Calculada a partir de ausencias</span></div><div class="permanence-grid">${data.permanence.map((item) => `<article><div><strong>${escapeHtml(item.program)}</strong><span>${item.absences} ausencias de ${item.total} registros</span></div><b class="risk-${item.level.toLowerCase()}">${item.absenceRate}% · ${item.level}</b></article>`).join('')}</div></section>`;
    content.querySelector('#report-excel').href = `/api/admin/reports.xlsx?${query}`; content.querySelector('#report-pdf').href = `/api/admin/reports.pdf?${query}`; applyDynamicStyles(content.querySelector('#report-results'));
  };
  form.addEventListener('submit',(event) => { event.preventDefault(); draw().catch((error) => notify(error.message,'error')); });
  await draw();
}

async function renderAdminPrograms() {
  let data = await api('/api/admin/programs');
  content.innerHTML = `<section class="program-command"><span>${icon('graduation')}</span><div><p class="section-kicker text-on-dark">Estructura académica</p><h2>Programas de estudios</h2><p>Administre el catálogo utilizado por estudiantes, personal, clases y reportes.</p></div><button class="command-primary" id="new-program" type="button">${icon('graduation')} Nuevo programa</button></section>
  <section class="panel page-spacer">${panelHeading('Catálogo institucional','Programas registrados','Los cambios de nombre se sincronizan con todos los registros relacionados.')}<div class="program-admin-grid" id="program-admin-list"></div></section>
  <dialog class="record-dialog" id="program-dialog"><form id="program-form"><header><div><p class="section-kicker">Gestión académica</p><h2 id="program-dialog-title">Nuevo programa</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><input name="id" type="hidden"><div class="dialog-fields"><label class="wide">Nombre del programa<input name="name" minlength="3" maxlength="120" required></label><label>Estado<select name="state"><option>Activo</option><option>Inactivo</option></select></label></div><p class="dialog-message" aria-live="polite"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Guardar programa</button></footer></form></dialog>`;
  const list=content.querySelector('#program-admin-list');const dialog=content.querySelector('#program-dialog');const form=content.querySelector('#program-form');
  const draw=()=>{list.innerHTML=data.items.length?data.items.map((item)=>`<article class="program-admin-card"><header><span>${icon('graduation')}</span><div><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.name)}</h3></div>${status(item.state)}</header><div class="program-usage"><span><strong>${item.usage.students}</strong>Estudiantes</span><span><strong>${item.usage.staff}</strong>Personal</span><span><strong>${item.usage.classes}</strong>Clases</span><span><strong>${item.usage.accounts}</strong>Cuentas</span></div><footer><button class="secondary-action" data-program-edit="${item.id}" type="button">${icon('file')} Editar</button><button class="danger-action" data-program-delete="${item.id}" type="button" ${item.linkedRecords?'disabled title="Tiene registros vinculados"':''}>${icon('alert')} Eliminar</button></footer></article>`).join(''):'<p class="empty-notice">No hay programas registrados.</p>';};
  const open=(item={})=>{form.reset();form.elements.id.value=item.id||'';form.elements.name.value=item.name||'';form.elements.state.value=item.state||'Activo';content.querySelector('#program-dialog-title').textContent=item.id?'Editar programa':'Nuevo programa';form.querySelector('.dialog-message').textContent='';dialog.showModal();};
  content.querySelector('#new-program').addEventListener('click',()=>open());dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());
  list.addEventListener('click',async(event)=>{const edit=event.target.closest('[data-program-edit]');const remove=event.target.closest('[data-program-delete]');if(edit){open(data.items.find((item)=>item.id===edit.dataset.programEdit));return;}if(!remove||remove.disabled)return;const item=data.items.find((record)=>record.id===remove.dataset.programDelete);if(!item||!await confirmAction(`¿Eliminar el programa ${item.name}?`))return;try{await api(`/api/admin/programs/${item.id}`,{method:'DELETE'});notify('Programa eliminado.');data=await api('/api/admin/programs');draw();}catch(error){notify(error.message,'error');}});
  form.addEventListener('submit',async(event)=>{event.preventDefault();const id=form.elements.id.value;const payload={name:form.elements.name.value,state:form.elements.state.value};try{const result=await api(id?`/api/admin/programs/${id}`:'/api/admin/programs',{method:id?'PUT':'POST',body:JSON.stringify(payload)});notify(result.message);dialog.close();data=await api('/api/admin/programs');draw();}catch(error){form.querySelector('.dialog-message').textContent=error.message;}});draw();
}

async function renderAdminFamilyLinks() {
  let data=await api('/api/admin/family-links');
  content.innerHTML=`<section class="family-link-hero"><span>${icon('family')}</span><div><p class="section-kicker text-on-dark">Protección por vínculo</p><h2>Familias y estudiantes vinculados</h2><p>Defina exactamente qué estudiantes puede consultar cada padre o apoderado.</p></div><b>${data.parents.length} cuentas familiares</b></section><section class="panel page-spacer">${panelHeading('Acceso familiar','Vínculos autorizados','Cada modificación queda registrada en la auditoría institucional.')}<div class="family-link-grid" id="family-link-list"></div></section><dialog class="record-dialog family-link-dialog" id="family-link-dialog"><form id="family-link-form"><header><div class="family-dialog-heading"><span class="family-dialog-icon">${icon('family')}</span><div><p class="section-kicker">Permisos familiares</p><h2 id="family-link-title">Editar vínculos</h2></div></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><input type="hidden" name="accountId"><div class="dialog-fields"><label class="wide">Parentesco o vínculo<input name="relationship" maxlength="60" required placeholder="Madre, padre, apoderado legal..."></label><fieldset class="wide family-student-picker" aria-describedby="family-picker-help"><legend>Estudiantes autorizados</legend><div class="family-picker-intro"><p id="family-picker-help">Seleccione únicamente vínculos formalmente verificados.</p><strong class="family-selected-count" aria-live="polite">0 seleccionados</strong></div><div class="picker-tools"><label>Buscar estudiante<input type="search" id="family-student-search" placeholder="Nombre o documento" autocomplete="off"></label><p id="family-search-result" aria-live="polite"></p></div><div class="family-student-options">${data.students.map((student)=>`<label><input type="checkbox" name="studentIds" value="${student.id}"><span class="family-student-avatar" aria-hidden="true">${tutorInitials(student.name)}</span><span class="family-student-identity"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.document)} · ${escapeHtml(student.program)}</small></span>${status(student.state)}</label>`).join('')}</div><div class="picker-selection"><strong>Vínculos seleccionados</strong><ul id="family-selection-summary" aria-label="Estudiantes seleccionados"></ul><p id="family-selection-empty">Ninguno seleccionado.</p></div></fieldset></div><p class="dialog-message" aria-live="polite"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">${icon('shield')} Guardar vínculos</button></footer></form></dialog>`;
  const list=content.querySelector('#family-link-list');const dialog=content.querySelector('#family-link-dialog');const form=content.querySelector('#family-link-form');const selectedCount=dialog.querySelector('.family-selected-count');
  const updateSelectedCount=()=>{const selected=[...form.querySelectorAll('[name="studentIds"]:checked')];const total=selected.length;selectedCount.textContent=`${total} seleccionado${total===1?'':'s'}`;const summary=form.querySelector('#family-selection-summary');summary.replaceChildren(...selected.map((field)=>{const item=document.createElement('li');item.textContent=field.closest('label').querySelector('strong').textContent;return item;}));form.querySelector('#family-selection-empty').hidden=total>0;};
  const familySearch=form.querySelector('#family-student-search');
  const normalizeFamilySearch=(value)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
  const filterFamilyStudents=()=>{const query=normalizeFamilySearch(familySearch.value);let visible=0;form.querySelectorAll('.family-student-options > label').forEach((row)=>{const match=normalizeFamilySearch(row.textContent).includes(query);row.hidden=!match;if(match)visible++;});form.querySelector('#family-search-result').textContent=query?(visible?`${visible} estudiante${visible===1?'':'s'} encontrado${visible===1?'':'s'}.`:'No hay estudiantes que coincidan con la búsqueda.') : '';};
  familySearch.addEventListener('input',filterFamilyStudents);
  const draw=()=>{list.innerHTML=data.parents.length?data.parents.map((parent)=>`<article class="family-link-card"><header><span>${tutorInitials(parent.name)}</span><div><strong>${escapeHtml(parent.name)}</strong><small>${escapeHtml(parent.email)}</small></div>${status(parent.state)}</header><p><b>${escapeHtml(parent.relationship)}</b> · ${parent.students.length} estudiante${parent.students.length===1?'':'s'} vinculado${parent.students.length===1?'':'s'}</p><div class="family-link-students">${parent.students.map((student)=>`<span>${icon('student')}<strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.program)}</small></span>`).join('')||'<em>Sin estudiantes vinculados</em>'}</div><button class="secondary-action" type="button" data-family-edit="${parent.id}">${icon('file')} Administrar vínculo</button></article>`).join(''):'<p class="empty-notice">No existen cuentas de padres o apoderados.</p>';};
  list.addEventListener('click',(event)=>{const button=event.target.closest('[data-family-edit]');if(!button)return;const parent=data.parents.find((item)=>item.id===button.dataset.familyEdit);if(!parent)return;form.reset();form.elements.accountId.value=parent.id;form.elements.relationship.value=parent.relationship;form.querySelectorAll('[name="studentIds"]').forEach((field)=>{field.checked=parent.studentIds.includes(field.value);});content.querySelector('#family-link-title').textContent=`Vínculos de ${parent.name}`;updateSelectedCount();filterFamilyStudents();dialog.showModal();});
  form.addEventListener('change',(event)=>{if(event.target.matches('[name="studentIds"]'))updateSelectedCount();});
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async(event)=>{event.preventDefault();const studentIds=[...form.querySelectorAll('[name="studentIds"]:checked')].map((item)=>item.value);try{const result=await api(`/api/admin/family-links/${form.elements.accountId.value}`,{method:'PUT',body:JSON.stringify({relationship:form.elements.relationship.value,studentIds})});notify(result.message);dialog.close();data=await api('/api/admin/family-links');draw();}catch(error){form.querySelector('.dialog-message').textContent=error.message;}});draw();
}

async function renderAdminSecurity() {
  const [data,incidentData] = await Promise.all([api('/api/admin/security-status'),api('/api/admin/security-incidents')]);
  const appearance = { authentication:['lock','blue'], roles:['shield','violet'], csrf:['check','teal'], session:['clock','amber'] };
  const expires = new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.sessionExpiresAt));
  content.innerHTML = `<section class="security-command"><div class="security-shield">${icon('shield')}<i>${icon('check')}</i></div><div class="security-command-copy"><span>Centro de protección</span><h2>Controles administrativos verificados</h2><p>El estado se obtiene de la sesión y de los mecanismos de protección configurados en el servidor.</p><div><b><i></i> ${data.active} controles operativos</b><b>${icon('lock')} Sesión verificada</b></div></div><div class="security-score"><span>Controles activos</span><strong>${data.active}<small>/${data.total}</small></strong><p>Sesión válida hasta ${escapeHtml(expires)}</p></div></section>
  <section class="security-section"><div class="dashboard-section-heading"><div><p class="section-kicker">Capas de seguridad</p><h2>Protección del panel administrativo</h2></div><span>${data.active === data.total ? 'Estado saludable' : 'Requiere atención'}</span></div><div class="security-grid">${data.controls.map((control) => { const [iconName,tone]=appearance[control.key] || ['shield','blue']; return `<article class="security-control control-${tone} ${control.active ? '' : 'is-inactive'}"><header><span class="security-control-icon">${icon(iconName)}<i>${icon(control.active ? 'check' : 'alert')}</i></span><span class="security-control-status"><i></i> ${control.active ? 'Control activo' : 'Revisar control'}</span></header><div class="security-control-copy"><strong>${escapeHtml(control.title)}</strong><p>${escapeHtml(control.description)}</p></div><footer>${icon('shield')}<span><strong>${control.active ? 'Protección activa' : 'Atención requerida'}</strong><small>Estado verificado por el servidor</small></span></footer></article>`; }).join('')}</div></section>
  <section class="security-advice"><span>${icon('alert')}</span><div><strong>Recomendación de seguridad</strong><p>Cambie periódicamente su contraseña y cierre la sesión cuando termine de administrar la plataforma.</p></div><a href="${pageHref('administrador','cuenta')}">Revisar mi cuenta →</a></section><section class="panel page-spacer">${panelHeading('Supervisión operativa','Incidencias de seguridad','Revise y cierre eventos reportados por Vigilancia.')}<div class="security-incident-list" id="admin-security-incidents"></div></section>`;
  const host=content.querySelector('#admin-security-incidents');let incidents=incidentData.items;
  const draw=()=>{host.innerHTML=incidents.length?incidents.map((item)=>`<article><span class="guard-priority priority-${String(item.priority).toLowerCase()}">${escapeHtml(item.priority)}</span><div><header><strong>${escapeHtml(item.id)} · ${escapeHtml(item.type)}</strong>${status(item.status)}</header><p>${escapeHtml(item.description)}</p><small>${escapeHtml(item.createdByName)} · ${escapeHtml(item.pointOfControl)} · ${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(item.date))}</small>${item.evidenceName?`<a class="evidence-link" href="/api/admin/security-incidents/${item.id}/evidence" target="_blank">${icon('file')} Revisar evidencia</a>`:''}${item.reviewNote?`<em>Conclusión: ${escapeHtml(item.reviewNote)}</em>`:''}</div><footer>${item.status==='Abierta'?`<button class="secondary-action" data-security-state="En revisión" data-id="${item.id}" type="button">Tomar caso</button>`:''}${item.status!=='Cerrada'?`<button class="primary-action" data-security-state="Cerrada" data-id="${item.id}" type="button">Cerrar incidencia</button>`:''}</footer></article>`).join(''):'<p class="empty-notice">No hay incidencias de seguridad registradas.</p>';};
  host.addEventListener('click',async(event)=>{const button=event.target.closest('[data-security-state]');if(!button)return;const closing=button.dataset.securityState==='Cerrada';const note=await promptAction(closing?'Registre la conclusión del caso:':'Observación inicial (opcional):',{required:closing});if(note===null||closing&&!note.trim())return;try{const result=await api(`/api/admin/security-incidents/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:button.dataset.securityState,note})});notify(result.message);incidents=(await api('/api/admin/security-incidents')).items;draw();}catch(error){notify(error.message,'error');}});draw();
}

async function renderAdminAccount() {
  const data = await api('/api/account');
  const user = data.user;
  const value = (key) => escapeHtml(user[key] || '');
  const initials = user.name.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase();
  const portrait = user.photoUrl ? `<img src="${user.photoUrl}?v=${Date.now()}" alt="Foto del Administrador">` : `<span>${escapeHtml(initials || 'AD')}</span>`;
  content.innerHTML = `<section class="admin-profile-hero">
    <div class="admin-profile-photo" id="admin-profile-photo">${portrait}</div>
    <div class="admin-profile-summary"><p class="section-kicker text-on-dark">Perfil institucional</p><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.position || 'Administrador del sistema')}</p><div><span>${icon('shield')} ${escapeHtml(user.institutionalCode || user.id)}</span><span>${status(user.state)}</span></div></div>
    <form class="profile-photo-form" id="photo-form"><input id="photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden required><label class="secondary-action" for="photo-input">Seleccionar foto</label><button class="primary-action" type="submit">Guardar foto</button>${user.photoUrl ? '<button class="danger-action" id="remove-photo" type="button">Eliminar foto</button>' : ''}<small>JPG, PNG o WebP · máximo 2 MB</small><p class="form-message" aria-live="polite"></p></form>
  </section>
  <div class="split-grid profile-layout"><section class="panel">${panelHeading('Datos del perfil','Información del Administrador','Mantenga actualizados sus datos personales e institucionales.')}<form class="account-form profile-details-grid" id="profile-form">
    <label>Nombre completo<input name="name" value="${value('name')}" maxlength="120" required></label><label>Tipo de documento<select name="documentType">${documentTypeOptions(user.documentType || 'DNI')}</select></label>
    <label>Número de documento<input name="document" value="${value('document')}" maxlength="15" placeholder="Número de documento"></label><label>Usuario de acceso<input name="username" value="${value('username')}" maxlength="64" placeholder="administrador.siga"></label>
    <label>Código institucional<input name="institutionalCode" value="${value('institutionalCode')}" maxlength="30" placeholder="ADM-001"></label>
    <label>Cargo institucional<input name="position" value="${value('position')}" maxlength="80" placeholder="Administrador del sistema"></label><label>Correo institucional<input name="email" type="email" value="${value('email')}" required></label>
    <label>Teléfono<input name="phone" type="tel" value="${value('phone')}" maxlength="20" placeholder="+51 999 999 999"></label><label>Estado de cuenta<input value="${value('state')}" readonly></label>
    <label class="wide">Dirección<input name="address" value="${value('address')}" maxlength="160" placeholder="Dirección del Administrador"></label><label class="wide">Presentación<textarea name="bio" maxlength="300" rows="4" placeholder="Información profesional o responsabilidades principales">${value('bio')}</textarea></label>
    <div class="profile-form-footer wide"><span>ID de cuenta: <strong>${escapeHtml(user.id)}</strong></span><button class="primary-action" type="submit">Guardar información</button></div><p class="form-message wide" aria-live="polite"></p>
  </form></section><section class="panel">${panelHeading('Preferencias','Seguridad y apariencia')}<form class="account-form" id="password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><small>Use mayúscula, minúscula, número y símbolo.</small><button class="primary-action" type="submit">Cambiar contraseña</button><p class="form-message"></p></form><div class="theme-control"><span><strong>Tema de la plataforma</strong><small>Alterne entre apariencia clara y oscura.</small></span><button class="secondary-action" id="theme-toggle" type="button">Cambiar tema</button></div></section></div>`;
  const profileForm=content.querySelector('#profile-form');
  const syncProfileDocument=()=>{const ce=profileForm.elements.documentType.value==='CE';const field=profileForm.elements.document;field.required=true;field.maxLength=ce?15:8;field.minLength=ce?9:8;field.pattern=ce?'[A-Za-z0-9]{9,15}':'[0-9]{8}';field.inputMode=ce?'text':'numeric';field.placeholder=ce?'Más de 8 letras o números':'8 dígitos';field.title=ce?'El Carné de Extranjería debe contener más de 8 caracteres y tener un formato válido.':'El DNI debe contener exactamente 8 dígitos numéricos.';};
  profileForm.elements.documentType.addEventListener('change',syncProfileDocument);syncProfileDocument();
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try { const result = await api('/api/account',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); form.querySelector('.form-message').textContent=result.message; currentUser=result.user; csrfToken=result.user.csrf; refreshSessionIdentity(); notify(result.message); }
    catch(error){form.querySelector('.form-message').textContent=error.message;}
  });
  content.querySelector('#password-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form=event.currentTarget;
    try { const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); form.querySelector('.form-message').textContent=result.message; notify(result.message); form.reset(); }
    catch(error){form.querySelector('.form-message').textContent=error.message;}
  });
  const photoInput = content.querySelector('#photo-input');
  photoInput.addEventListener('change', () => { const file=photoInput.files[0]; if (!file) return; if (file.size > 2*1024*1024) return notify('La fotografía no debe superar 2 MB.','error'); const preview=URL.createObjectURL(file); content.querySelector('#admin-profile-photo').innerHTML=`<img src="${preview}" alt="Vista previa de la foto">`; });
  content.querySelector('#photo-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form=event.currentTarget; if (!form.reportValidity()) return;
    try { const result=await api('/api/account/photo',{method:'POST',body:new FormData(form)}); currentUser=result.user; csrfToken=result.user.csrf; refreshSessionIdentity(); notify(result.message); await renderAdminAccount(); }
    catch(error){form.querySelector('.form-message').textContent=error.message;}
  });
  content.querySelector('#remove-photo')?.addEventListener('click', async () => { try { const result=await api('/api/account/photo',{method:'DELETE'}); currentUser=result.user; csrfToken=result.user.csrf; refreshSessionIdentity(); notify(result.message); await renderAdminAccount(); } catch(error){notify(error.message,'error');} });
  content.querySelector('#theme-toggle').addEventListener('click', () => { document.body.classList.toggle('theme-dark'); localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light'); });
}

const roleMetrics = {
  administrador: [['Roles','7','Perfiles diferenciados','blue','RO'],['Módulos','7','Cobertura principal','teal','MO'],['Programas','4','Segmentación académica','amber','PR'],['Calidad','Aprobada','APK validado','violet','QA']],
  docente: [['Estudiantes','24','Grupo asignado','blue','ES'],['Presentes','21','Registro diario','green','PR'],['Tardanzas','2','Registro diario','amber','TA'],['Ausentes','1','Registro diario','red','AU']],
  coordinador: [['Estudiantes','126','Programa asignado','blue','ES'],['Permisos','3','Pendientes de revisión','amber','PE'],['Incidencias','5','En seguimiento','violet','IN'],['Asistencia','87%','Promedio del programa','green','AS']],
  tutor: [['Tutorados','18','Estudiantes asignados','blue','TU'],['Seguimientos','12','Registros del periodo','teal','SG'],['Incidencias','3','Abiertas','amber','IN'],['Reuniones','2','Programadas','violet','RU']],
  padre: [['Asistencia','92%','Promedio acumulado','green','AS'],['Tardanzas','2','Periodo actual','amber','TA'],['Justificaciones','1','En revisión','blue','JU'],['Reuniones','1','Próxima convocatoria','violet','RU']],
  vigilante: [['Salidas hoy','4','Autorizadas','green','SA'],['Pendientes','1','Por validar','amber','PE'],['QR válidos','4','Verificados','blue','QR'],['Alertas','0','Sin incidencias','teal','AL']],
  estudiante: [['Asistencia','92%','Periodo actual','green','AS'],['Tardanzas','2','Acumuladas','amber','TA'],['Solicitudes','1','Pendiente','blue','SO'],['Avisos','3','Institucionales','violet','AV']],
};

function pageDescription(key, roleKey) {
  const descriptions = {
    estudiantes:'Consulta del padrón y datos académicos visibles.',personal:'Gestión visual de cuentas y programas.','carga-excel':'Plantillas, reglas y validaciones de importación.',
    reportes:'Indicadores por programa y estado.',configuracion:'Arquitectura, seguridad y reglas operativas.',asistencia:'Estados de presencia, tardanza y ausencia.',
    boletas:'Consulta de boletas oficiales de salida.',permisos:'Revisión de solicitudes y autorizaciones.',permanencia:'Incidencias, evidencias y responsables.',
    seguimiento:'Acompañamiento académico de tutorados.',incidencias:'Casos abiertos y estado de atención.',reuniones:'Convocatorias y agenda institucional.',
    justificaciones:'Solicitudes y documentos de sustento.',avisos:'Comunicaciones académicas e institucionales.','validar-qr':'Comprobación visual del código autorizado.',
    salidas:'Boletas autorizadas para el turno actual.',historial:'Registro de validaciones realizadas.','mi-asistencia':'Resumen personal del periodo.',
    'solicitar-salida':'Registro de la solicitud de retiro.','mis-permisos':'Estado de solicitudes enviadas.',
  };
  return descriptions[key] || `Página del perfil ${roles[roleKey].name}.`;
}

function renderSummary(roleKey) {
  const role = roles[roleKey];
  const activities = {
    administrador: [['EX','Plantilla de personal revisada','Validación de Estado y Programa','Hoy'],['US','Cuenta institucional activa','Acceso confirmado','Ayer'],['RE','Reporte consolidado disponible','Información actualizada','02 oct']],
    docente: [['AS','Asistencia de clase','Arquitectura de Plataformas','08:00'],['BO','Boleta consultada','Salida autorizada','Ayer'],['RE','Resumen semanal','Información actualizada','30 sep']],
    coordinador: [['PE','Solicitud por revisar','Motivo familiar','Hace 20 min'],['PM','Incidencia en seguimiento','Evidencia registrada','Ayer'],['ES','Padrón actualizado','III semestre','02 oct']],
    tutor: [['SG','Seguimiento académico','Tutorado con observación','Hoy'],['RU','Reunión familiar','Convocatoria programada','Mañana'],['IN','Incidencia registrada','En seguimiento','Ayer']],
    padre: [['AV','Nuevo aviso institucional','Reunión de apoderados','Hoy'],['AS','Resumen de asistencia','Periodo actual','Ayer'],['JU','Justificación recibida','En revisión','01 oct']],
    vigilante: [['QR','Código validado','Salida autorizada','16:20'],['SA','Boleta oficial verificada','Sin observaciones','15:45'],['HI','Turno sin alertas','Control normal','14:00']],
    estudiante: [['SO','Solicitud enviada','Motivo familiar','Hoy'],['AV','Aviso institucional','Reunión informativa','Ayer'],['AS','Resumen actualizado','Asistencia del periodo','01 oct']],
  }[roleKey];
  const capabilities = role.pages.slice(1).map(([key,label]) => `<a class="capability" href="${pageHref(roleKey,key)}"><span class="capability-icon">${icon(pageIcons[key])}</span><span class="capability-copy"><strong>${label}</strong><span>${pageDescription(key,roleKey)}</span></span><span class="capability-state">Disponible</span><span class="capability-arrow" aria-hidden="true">→</span></a>`).join('');
  content.innerHTML = `${renderRoleBanner(role)}
    <section class="summary-section-heading"><div><p class="section-kicker">Pulso institucional</p><h2>Indicadores de la jornada</h2></div><span>Actualización reciente</span></section>
    <section class="metric-grid ${roleKey === 'tutor' ? 'tutor-metric-grid' : ''}">${roleMetrics[roleKey].map((item) => metric(...item)).join('')}</section>
    <div class="dashboard-grid ${roleKey === 'tutor' ? 'tutor-dashboard-grid' : ''}">
      <section class="panel activity-panel">${panelHeading('Bitácora del sistema','Actividad reciente','Movimientos más relevantes del perfil')}
        <ul class="activity-list">${activities.map(([symbol,name,desc,time]) => `<li class="activity-item"><span class="timeline-dot" aria-hidden="true"></span><span class="item-icon">${icon(metricIcons[symbol] || 'bell')}</span><span><strong>${name}</strong><span>${desc}</span></span><time>${time}</time><span class="activity-arrow" aria-hidden="true">→</span></li>`).join('')}</ul>
      </section>
      <section class="panel capability-panel">${panelHeading('Navegación inteligente','Accesos rápidos','Ingrese directamente a sus espacios de trabajo')}<div class="capability-grid">${capabilities}</div></section>
    </div>`;
}

function renderStudents(roleKey) {
  const rows = students.map(([initials,name,semester,program,state]) => `<tr><td><span class="avatar-cell"><span class="mini-avatar">${initials}</span><span><strong>${name}</strong><small>Acompañamiento activo</small></span></span></td><td><span class="semester-chip">${semester}</span></td><td><strong class="program-name">${program}</strong></td><td><span class="tutoring-badge">${icon('heart')} Tutor asignado</span></td><td>${status(state)}</td></tr>`);
  if (roleKey === 'tutor') {
    content.innerHTML = `<section class="tutor-module-intro"><span>${icon('users')}</span><div><p class="section-kicker text-on-dark">Gestión académica</p><h2>Estudiantes tutorados</h2><p>Consulte la situación académica de los estudiantes que tiene asignados.</p></div><div class="tutor-intro-stats"><span><strong>${students.length}</strong> estudiantes activos</span><span><strong>${new Set(students.map((item)=>item[3])).size}</strong> programas</span></div></section><section class="panel tutor-directory-panel">${panelHeading('Padrón de tutoría','Directorio de estudiantes','Información organizada por semestre y programa')} ${tableToolbar('Buscar estudiante, semestre o programa')}${rowsTable(['Estudiante','Semestre','Programa','Acompañamiento','Estado'],rows)}</section>`;
    return;
  }
  const heading = roleKey === 'tutor' ? 'Estudiantes tutorados' : roleKey === 'docente' ? 'Estudiantes de la clase' : 'Padrón de estudiantes';
  content.innerHTML = `<section class="panel">${panelHeading('Gestión académica',heading,'Información organizada por semestre y programa.')} ${tableToolbar('Buscar estudiante o programa')}${rowsTable(['Estudiante','Semestre','Programa','Tutoría','Estado'],rows)}</section>`;
}

function renderStaff() {
  const rows = staff.map(([initials,name,role,program,state]) => `<tr><td><span class="avatar-cell"><span class="mini-avatar">${initials}</span><strong>${name}</strong></span></td><td>${role}</td><td>${program}</td><td>usuario@instituto.edu.pe</td><td>${status(state)}</td></tr>`);
  content.innerHTML = `<section class="panel">${panelHeading('Administración','Personal académico','Cuentas organizadas por rol, programa y estado.')} ${tableToolbar('Buscar personal, rol o programa')}${rowsTable(['Personal','Rol','Programa','Cuenta','Estado'],rows)}</section>`;
}

function renderAttendance(personal = false) {
  const rows = [['08:00–09:30','Desarrollo de aplicaciones','Presente'],['09:45–11:15','Base de datos','Presente'],['11:30–13:00','Experiencias formativas','Tardanza'],['14:00–15:30','Seguridad informática','Pendiente']].map(([time,course,state]) => `<tr><td>${time}</td><td><strong>${course}</strong></td><td>Aula 04</td><td>${personal ? status(state) : `<select class="inline-select" aria-label="Estado de ${course}">${['Presente','Tardanza','Ausente','Pendiente'].map((option) => `<option ${option === state ? 'selected' : ''}>${option}</option>`).join('')}</select>`}</td></tr>`);
  content.innerHTML = `<div class="split-grid"><section class="panel">${panelHeading('Estados del periodo',personal ? 'Mi asistencia' : 'Resumen de asistencia','Información actualizada')}<div class="attendance-layout"><div class="donut"><div class="donut-center"><strong>92%</strong><span>asistencia</span></div></div><div class="legend"><div class="legend-row"><i class="legend-dot green-dot"></i><span>Presencias</span><strong>23</strong></div><div class="legend-row"><i class="legend-dot amber-dot"></i><span>Tardanzas</span><strong>2</strong></div><div class="legend-row"><i class="legend-dot red-dot"></i><span>Ausencias</span><strong>1</strong></div></div></div></section><section class="panel">${panelHeading('Comparativo','Asistencia por programa')}<div class="progress-list"><div class="progress-row"><span>Enfermería</span><div class="progress-track"><div class="progress-fill w-92"></div></div><strong>92%</strong></div><div class="progress-row"><span>Acuicultura</span><div class="progress-track"><div class="progress-fill w-86"></div></div><strong>86%</strong></div><div class="progress-row"><span>Mecatrónica</span><div class="progress-track"><div class="progress-fill w-78"></div></div><strong>78%</strong></div><div class="progress-row"><span>Plataformas TI</span><div class="progress-track"><div class="progress-fill w-92"></div></div><strong>92%</strong></div></div></section></div><section class="panel page-spacer">${panelHeading('Detalle diario','Horario y estado','Información del horario institucional.')} ${rowsTable(['Horario','Unidad didáctica','Ambiente','Estado'],rows)}</section>`;
}

function renderExitTable(titleText = 'Solicitudes y autorizaciones', pageKey = '') {
  const canResolve = pageKey === 'permisos';
  const savedRequests = JSON.parse(localStorage.getItem('siga_requests') || '[]');
  const savedStates = JSON.parse(localStorage.getItem('siga_request_states') || '{}');
  const records = [...savedRequests.map((item) => [item.id,item.student,item.reason,savedStates[item.id] || item.state,item.time]), ...exitRows.map(([id,name,reason,state,time]) => [id,name,reason,savedStates[id] || state,time])];
  const rows = records.map(([id,name,reason,state,time]) => `<tr data-request="${id}"><td><strong>${id}</strong></td><td>${name}</td><td>${reason}</td><td class="request-state">${status(state)}</td><td>${time}</td>${canResolve ? `<td><div class="row-actions"><button type="button" data-action="resolve-request" data-state="Autorizada" ${state !== 'Pendiente' ? 'disabled' : ''}>Aprobar</button><button type="button" data-action="resolve-request" data-state="Rechazada" ${state !== 'Pendiente' ? 'disabled' : ''}>Rechazar</button></div></td>` : ''}</tr>`);
  const headers = ['Solicitud','Estudiante','Motivo','Estado','Registro',...(canResolve ? ['Acciones'] : [])];
  content.innerHTML = `<section class="panel">${panelHeading('Control de salida',titleText,'El QR aparece únicamente cuando la solicitud está autorizada.')} ${tableToolbar('Buscar solicitud o estudiante')}${rowsTable(headers,rows)}</section><section class="panel page-spacer">${panelHeading('Proceso institucional','Flujo de autorización')}<ol class="workflow"><li class="workflow-step"><strong>Solicitud</strong><span>El estudiante o un Docente autorizado registra el motivo y horario.</span></li><li class="workflow-step"><strong>Revisión</strong><span>El Coordinador del programa evalúa la solicitud.</span></li><li class="workflow-step is-key"><strong>Autorización</strong><span>La aprobación genera la boleta y el código QR.</span></li><li class="workflow-step"><strong>Validación</strong><span>Vigilancia comprueba identidad, vigencia y uso único.</span></li></ol></section>`;
}

async function renderCoordinatorDashboard() {
  const data = await api('/api/coordinator/dashboard');
  const firstName = data.coordinator.name.split(/\s+/)[0];
  const cards = [
    ['Estudiantes',data.summary.students,'users','blue','Padrón activo'],['Asistieron hoy',data.summary.present,'check','teal','Registro del día'],['Tardanzas',data.summary.late,'clock','amber','Registro del día'],
    ['Ausentes',data.summary.absent,'alert','red','Registro del día'],['Permanencia',data.summary.incidents,'heart','violet','Casos activos'],['Solicitudes',data.summary.pendingExits,'clipboard','green','Pendientes de decisión'],
  ];
  content.innerHTML = `<section class="coordinator-command"><div><span class="dashboard-live"><i></i> Coordinación académica</span><p class="dashboard-date">${escapeHtml(teacherDate(data.today))}</p><h2>Buen día, ${escapeHtml(firstName)}.</h2><p>Organice cursos, docentes y horarios exclusivamente de <strong>${escapeHtml(data.program)}</strong>.</p><div class="dashboard-command-actions coordinator-academic-actions"><a class="command-primary" href="${pageHref('coordinador','clases')}">${icon('book')} Asignar cursos</a><a class="command-secondary" href="${pageHref('coordinador','horarios')}">${icon('calendar')} Asignar horarios</a><a class="command-secondary" href="${pageHref('coordinador','permisos')}">${icon('clipboard')} Revisar permisos</a></div></div><aside><span>${icon('graduation')}</span><div><small>Programa asignado</small><strong>${escapeHtml(data.program)}</strong><p>${data.team.teachers} docentes · ${data.team.tutors} tutores</p></div></aside></section>
  <section class="coordinator-planning-strip" aria-label="Planificación académica"><div><span>${icon('book')}</span><p><small>Paso 1</small><strong>Asignar cursos y docentes</strong><em>Registre la unidad didáctica, el docente y los estudiantes matriculados.</em></p><a href="${pageHref('coordinador','clases')}">Gestionar cursos ${icon('exit')}</a></div><div><span>${icon('calendar')}</span><p><small>Paso 2</small><strong>Publicar horarios</strong><em>Defina día, horas, aula y modalidad para cada curso.</em></p><a href="${pageHref('coordinador','horarios')}">Gestionar horarios ${icon('exit')}</a></div></section>
  <section class="dashboard-section-heading"><div><p class="section-kicker">Pulso del programa</p><h2>Indicadores de hoy</h2></div><span>Datos limitados a su ámbito académico</span></section><section class="dashboard-metric-grid coordinator-metrics">${cards.map(([label,value,iconName,tone,detail])=>`<article class="dashboard-metric metric-accent-${tone}"><header><span class="metric-icon tone-${tone}">${icon(iconName)}</span><span class="dashboard-metric-state"><i></i> Actualizado</span></header><div><strong>${value}</strong><span>${label}</span><p>${detail}</p></div><footer>${icon('shield')} Alcance verificado</footer></article>`).join('')}</section>
  <section class="panel page-spacer coordinator-shortcuts">${panelHeading('Navegación inteligente','Continúe su trabajo','Acceda a las tareas principales del programa.')}<div class="capability-grid">${[['clases','book','Asignar cursos y docentes','Cree cursos y seleccione al Docente responsable.'],['horarios','calendar','Horarios docentes','Publique día, hora, aula y modalidad.'],['permisos','clipboard','Permisos','Autorice o rechace solicitudes de salida.'],['justificaciones','file','Justificaciones','Resuelva casos derivados.'],['permanencia','heart','Permanencia','Gestione incidencias y su historial.'],['estudiantes','users','Estudiantes','Consulte el padrón académico.'],['reportes','chart','Reportes','Analice asistencia y permanencia.']].map(([page,iconName,title,copy])=>`<a class="capability" href="${pageHref('coordinador',page)}"><span class="capability-icon">${icon(iconName)}</span><strong>${title}</strong><small>${copy}</small><b>→</b></a>`).join('')}</div></section>`;
  const teamSummary=content.querySelector('.coordinator-command aside p');
  if(teamSummary)teamSummary.textContent=data.team.teachers+' docentes · '+data.team.tutors+' docentes con tutoría';
}

async function renderCoordinatorClasses() {
  let data;let studyPlanCatalog;[data,studyPlanCatalog]=await Promise.all([api('/api/coordinator/classes'),fetch('/study-plan-catalog.json?v=20261023-study-plan-3',{credentials:'same-origin'}).then(async(response)=>{if(!response.ok)throw new Error('No fue posible cargar el plan de estudios.');return response.json();})]);
  const normalizePlanName=(value)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
  const planKey=Object.keys(studyPlanCatalog).find((key)=>normalizePlanName(key)===normalizePlanName(data.program));
  const studyPlan={program:data.program,semesters:studyPlanCatalog[planKey]||{}};
  const teacherAvailability=data.teachers.length?`<p class="coordinator-availability is-ready">${icon('check')} ${data.teachers.length} Docente${data.teachers.length===1?'':'s'} disponible${data.teachers.length===1?'':'s'} para asignación.</p>`:`<div class="coordinator-availability is-warning">${icon('alert')} <span><strong>No hay Docentes disponibles en este programa.</strong><small>Administración debe registrar al Docente, asignarle ${escapeHtml(data.program)} y mantener su cuenta activa.</small></span></div>`;
  content.innerHTML=`<section class="coordinator-module-hero class-hero"><span>${icon('book')}</span><div><p class="section-kicker text-on-dark">Organización académica</p><h2>Asignar cursos y docentes</h2><p>Seleccione una unidad didáctica oficial y el Docente responsable dentro de ${escapeHtml(data.program)}.</p></div><button class="command-primary" id="new-class" type="button" ${data.teachers.length?'':'disabled'}>${icon('book')} Asignar curso</button></section>${teacherAvailability}<section class="panel page-spacer">${panelHeading('Oferta académica','Cursos del programa','Las unidades didácticas se cargan automáticamente según el semestre del plan de estudios.')}<form class="coordinator-filter-grid" id="class-filters"><label class="wide">${icon('scan')}<input name="search" type="search" aria-label="Buscar curso, grupo, docente o aula" placeholder="Buscar curso, grupo, docente o aula"></label><label>Semestre<select name="semester"><option value="">Todos</option>${['I','II','III','IV','V','VI'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Docente<select name="teacher"><option value="">Todos</option>${data.teachers.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label></form><div class="class-management-grid" id="class-list"></div></section><dialog class="record-dialog class-dialog" id="class-dialog"><form id="class-form"><header><div><p class="section-kicker">Planificación académica</p><h2 id="class-title">Asignar curso a Docente</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><input name="id" type="hidden"><div class="dialog-fields"><label>Semestre<select name="semester" required>${['I','II','III','IV','V','VI'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="wide">Unidad didáctica<select name="course" required aria-describedby="course-plan-help"></select><small id="course-plan-help">Lista oficial de ${escapeHtml(studyPlan.program)}.</small></label><label>Grupo<input name="group" maxlength="30" required placeholder="Ej. III-A"></label><label>Sección<input name="section" maxlength="20" required placeholder="Ej. A"></label><label>Docente responsable<select name="teacherId" required><option value="">Seleccione un Docente</option>${data.teachers.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Día<select name="day">${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Horario<input name="schedule" required placeholder="08:00–09:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9][–-]([01][0-9]|2[0-3]):[0-5][0-9]"></label><label>Aula o enlace<input name="room" maxlength="80" required></label><label>Modalidad<select name="modality"><option>Presencial</option><option>Virtual</option><option>Híbrida</option></select></label><fieldset class="wide class-student-picker"><legend>Estudiantes matriculados</legend><p>Marque únicamente a quienes llevarán esta unidad didáctica.</p><div class="picker-tools"><label>Buscar estudiante<input type="search" id="class-student-search" placeholder="Nombre del estudiante" autocomplete="off"></label><p id="class-student-result" aria-live="polite"></p><strong id="class-student-count" aria-live="polite">0 seleccionados</strong></div>${data.students.map((student)=>`<label data-semester="${student.semester}" data-group="${escapeHtml(student.group)}"><input name="studentIds" type="checkbox" value="${student.id}"><span class="class-student-avatar" aria-hidden="true">${escapeHtml(tutorInitials(student.name))}</span><span class="class-student-copy"><strong>${escapeHtml(student.name)}</strong><small>Semestre ${escapeHtml(student.semester)} · ${escapeHtml(student.group)}</small></span><span class="class-student-state"><b>Seleccionar</b><em>${icon('check')} Matriculado</em></span></label>`).join('')}</fieldset></div><p class="dialog-message"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Guardar curso y asignación</button></footer></form></dialog>`;
  const list=content.querySelector('#class-list');const filters=content.querySelector('#class-filters');const dialog=content.querySelector('#class-dialog');const form=content.querySelector('#class-form');const dialogFields=form.querySelector('.dialog-fields');const courseHelp=form.querySelector('#course-plan-help');let items=data.items;
  ['day','schedule','room','modality'].forEach((name)=>{const field=form.elements[name];field.disabled=true;field.closest('label').hidden=true;});
  const syncCourseOptions=(selected='')=>{const semester=form.elements.semester.value;const units=studyPlan.semesters[semester]||[];const legacy=selected&&!units.includes(selected)?`<option value="${escapeHtml(selected)}">${escapeHtml(selected)} (registro anterior)</option>`:'';form.elements.course.innerHTML=`<option value="">Seleccione una unidad didáctica</option>${units.map((unit)=>`<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join('')}${legacy}`;form.elements.course.value=selected;form.elements.course.disabled=!units.length&&!legacy;courseHelp.textContent=units.length?`${units.length} unidades didácticas oficiales disponibles para el semestre ${semester}.`:`No se encontraron unidades para ${studyPlan.program} en el semestre ${semester}.`;courseHelp.classList.toggle('is-empty',!units.length);};
  const normalizeGroup=(value)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
  const syncRoster=()=>{const semester=form.elements.semester.value;const group=normalizeGroup(form.elements.group.value);const query=normalizeGroup(form.querySelector('#class-student-search').value);let eligible=0;let visible=0;form.querySelectorAll('[name="studentIds"]').forEach((field)=>{const row=field.closest('label');const matchesClass=row.dataset.semester===semester&&Boolean(group)&&normalizeGroup(row.dataset.group)===group;if(!matchesClass)field.checked=false;else eligible++;const matchesSearch=!query||normalizeGroup(row.textContent).includes(query);row.hidden=!(matchesClass&&matchesSearch);if(!row.hidden)visible++;});const total=form.querySelectorAll('[name="studentIds"]:checked').length;form.querySelector('#class-student-count').textContent=`${total} seleccionado${total===1?'':'s'}`;form.querySelector('#class-student-result').textContent=!group?'Ingrese el grupo para ver estudiantes.':!eligible?'No hay estudiantes activos para este semestre y grupo.':!visible?'No hay estudiantes que coincidan con la búsqueda.':`${visible} estudiante${visible===1?'':'s'} visible${visible===1?'':'s'}.`;};
  const draw=()=>{list.innerHTML=items.length?items.map((item)=>{const students=item.students||[];const day=item.day||'Día por definir';const schedule=item.schedule||'Horario por definir';const room=item.room||'Ambiente por definir';const modality=item.modality||'Modalidad por definir';return `<article class="class-management-card"><header><span>${icon('book')}</span><div><small>${escapeHtml(item.id)} · ${escapeHtml(item.semester||'Sin semestre')} semestre</small><h3>${escapeHtml(item.course||'Curso sin nombre')}</h3><p>${escapeHtml(item.group||'Sin grupo')} · ${escapeHtml(item.section||'Sin sección')}</p></div><b>${students.length} estudiante${students.length===1?'':'s'}</b></header><dl><div><dt>Docente</dt><dd>${escapeHtml(item.teacher||'Sin docente asignado')}</dd></div><div><dt>Horario</dt><dd>${escapeHtml(day)} · ${escapeHtml(schedule)}</dd></div><div><dt>Ambiente</dt><dd>${escapeHtml(room)} · ${escapeHtml(modality)}</dd></div></dl><div class="class-roster-preview">${students.length?students.slice(0,4).map((student)=>`<span>${tutorInitials(student.name)}<b>${escapeHtml(student.name)}</b></span>`).join(''):'<small class="class-roster-empty">Aún no hay estudiantes matriculados.</small>'}${students.length>4?`<em>+${students.length-4}</em>`:''}</div><footer><button class="secondary-action" data-class-edit="${item.id}" type="button">${icon('file')} Editar y matricular</button><button class="danger-action" data-class-delete="${item.id}" type="button">${icon('alert')} Eliminar</button></footer></article>`;}).join(''):(Object.values(Object.fromEntries(new FormData(filters))).some((value)=>String(value).trim())?coordinatorEmptyState('book','Sin clases para estos filtros','No se encontraron coincidencias con los criterios seleccionados.',`<button class="secondary-action" type="button" data-empty-action="clear-class-filters">Limpiar filtros</button>`):coordinatorEmptyState('book','Aún no hay clases','Cuando registre una clase aparecerá en este espacio.',data.teachers.length?`<button class="primary-action" type="button" data-empty-action="new-class">${icon('book')} Crear primera clase</button>`:''));};
  let latestClassQuery=0;
  const load=async()=>{const query=++latestClassQuery;try{const result=await api(`/api/coordinator/classes?${new URLSearchParams(new FormData(filters))}`);if(query!==latestClassQuery)return;data=result;items=data.items;draw();}catch(error){if(query!==latestClassQuery)return;list.innerHTML=`<section class="error-panel" role="alert"><strong>No se pudieron cargar las clases.</strong><p>${escapeHtml(error.message)}</p><button class="secondary-action" type="button" data-empty-action="retry-class-filters">Reintentar</button></section>`;}};
  let timer;filters.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250);});filters.addEventListener('change',()=>{clearTimeout(timer);load();});
  const open=(item={})=>{if(!data.teachers.length){notify('No hay Docentes activos asignados a este programa.','error');return;}form.reset();form.elements.id.value=item.id||'';form.elements.semester.value=item.semester||'I';syncCourseOptions(item.course||'');['group','section','teacherId','day','schedule','room','modality'].forEach((key)=>{if(item[key]!==undefined)form.elements[key].value=item[key];});syncRoster();form.querySelectorAll('[name="studentIds"]').forEach((field)=>{field.checked=(item.studentIds||[]).includes(field.value)&&!field.closest('label').hidden;});syncRoster();content.querySelector('#class-title').textContent=item.id?'Editar curso, Docente y matrícula':'Asignar curso a Docente';dialog.showModal();requestAnimationFrame(()=>{dialogFields.scrollTop=0;form.elements.semester.focus({preventScroll:true});});};
  form.elements.semester.addEventListener('change',()=>{syncCourseOptions();syncRoster();});
  form.elements.group.addEventListener('input',syncRoster);
  form.querySelector('#class-student-search').addEventListener('input',syncRoster);
  form.addEventListener('change',(event)=>{if(event.target.matches('[name="studentIds"]'))syncRoster();});
  content.querySelector('#new-class').addEventListener('click',()=>open());dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());list.addEventListener('click',async(event)=>{if(event.target.closest('[data-empty-action="clear-class-filters"]')){filters.reset();await load();return;}if(event.target.closest('[data-empty-action="retry-class-filters"]')){await load();return;}if(event.target.closest('[data-empty-action="new-class"]'))return open();const edit=event.target.closest('[data-class-edit]');const remove=event.target.closest('[data-class-delete]');if(edit)return open(items.find((item)=>item.id===edit.dataset.classEdit));if(!remove||!await confirmAction('¿Eliminar esta clase? Solo será posible si no tiene historial asociado.'))return;try{await api(`/api/coordinator/classes/${remove.dataset.classDelete}`,{method:'DELETE'});notify('Clase eliminada.');await load();}catch(error){notify(error.message,'error');}});
  form.addEventListener('submit',async(event)=>{event.preventDefault();if(!form.reportValidity())return;const formData=new FormData(form);const values=Object.fromEntries(formData);values.studentIds=formData.getAll('studentIds');const id=values.id;delete values.id;try{const result=await api(id?`/api/coordinator/classes/${id}`:'/api/coordinator/classes',{method:id?'PUT':'POST',body:JSON.stringify(values)});notify(result.message);dialog.close();await load();}catch(error){form.querySelector('.dialog-message').textContent=error.message;}});draw();
}

async function renderCoordinatorSchedules() {
  const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  let data=await api('/api/coordinator/classes');const hours=data.policies||{institutionStart:'07:00',institutionEnd:'21:00'};
  const scheduleAvailability=data.items.length?`<p class="coordinator-availability is-ready">${icon('check')} ${data.items.length} curso${data.items.length===1?'':'s'} disponible${data.items.length===1?'':'s'} para programar.</p>`:`<div class="coordinator-availability is-warning">${icon('alert')} <span><strong>Primero debe asignar un curso a un Docente.</strong><small>Cuando exista un curso podrá definir su día, hora, aula y modalidad.</small></span><a href="${pageHref('coordinador','clases')}">Asignar primer curso</a></div>`;
  content.innerHTML=`<section class="coordinator-module-hero schedule-hero"><span>${icon('calendar')}</span><div><p class="section-kicker text-on-dark">Programación académica</p><h2>Asignación de horarios</h2><p>Defina el horario de cada clase de ${escapeHtml(data.program)}. Cada Docente y estudiante verá únicamente sus propias asignaciones.</p></div><a class="command-secondary" href="${pageHref('coordinador','clases')}">${icon('book')} Gestionar clases</a></section>
  ${scheduleAvailability}
  <section class="schedule-privacy-note"><span>${icon('shield')}</span><div><strong>Visibilidad protegida por matrícula</strong><p>Coordinación administra el programa completo; los Docentes reciben solo sus clases y los estudiantes solo aquellas en las que están matriculados.</p></div></section>
  <section class="panel page-spacer">${panelHeading('Agenda del programa','Horario semanal','Seleccione un curso para asignar o modificar su programación.')}<form class="schedule-filter-bar" id="schedule-filters"><label>Docente<select name="teacher"><option value="">Todos los Docentes</option>${data.teachers.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Día<select name="day"><option value="">Toda la semana</option>${days.map((item)=>`<option>${item}</option>`).join('')}</select></label><button class="primary-action" id="assign-schedule" type="button" ${data.items.length?'':'disabled'}>${icon('calendar')} Asignar horario</button></form><div class="schedule-management-grid" id="schedule-management-grid"></div></section>
  <dialog class="record-dialog schedule-dialog" id="schedule-dialog"><form id="schedule-form"><header><div><p class="section-kicker">Horario de clase</p><h2>Asignar Docente y horario</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><div class="dialog-fields"><label class="wide">Clase<select name="classId" required><option value="">Seleccione una clase</option>${data.items.map((item)=>`<option value="${item.id}">${escapeHtml(item.course)} · ${escapeHtml(item.group)}</option>`).join('')}</select></label><label class="wide">Docente<select name="teacherId" required>${data.teachers.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Día<select name="day" required>${days.map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Hora de inicio<input name="startTime" type="time" min="${hours.institutionStart}" max="${hours.institutionEnd}" required></label><label>Hora de fin<input name="endTime" type="time" min="${hours.institutionStart}" max="${hours.institutionEnd}" required></label><label>Aula o enlace<input name="room" maxlength="80" required></label><label>Modalidad<select name="modality"><option>Presencial</option><option>Virtual</option><option>Híbrida</option></select></label></div><div class="schedule-audience" id="schedule-audience"></div><p class="dialog-message" aria-live="polite"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">${icon('check')} Guardar horario</button></footer></form></dialog>`;
  const grid=content.querySelector('#schedule-management-grid');const filters=content.querySelector('#schedule-filters');const dialog=content.querySelector('#schedule-dialog');const form=content.querySelector('#schedule-form');const audience=content.querySelector('#schedule-audience');
  const timeParts=(value='')=>String(value).replace('-', '–').split('–');
  const selectedClass=()=>data.items.find((item)=>item.id===form.elements.classId.value);
  const showAudience=()=>{const item=selectedClass();audience.innerHTML=item?`${icon('users')} <span><strong>${item.students.length} estudiante${item.students.length===1?'':'s'} recibirán este horario</strong><small>${escapeHtml(item.course)} · ${escapeHtml(item.group)}</small></span>`:'';};
  const fill=(item)=>{if(!item)return;const [startTime='',endTime='']=timeParts(item.schedule);form.elements.classId.value=item.id;form.elements.teacherId.value=item.teacherId;form.elements.day.value=item.day||'Lunes';form.elements.startTime.value=startTime;form.elements.endTime.value=endTime;form.elements.room.value=item.room||'';form.elements.modality.value=item.modality||'Presencial';showAudience();};
  const open=(item)=>{if(!data.items.length){notify('Primero debe asignar un curso a un Docente.','error');return;}form.reset();form.querySelector('.dialog-message').textContent='';if(item)fill(item);else fill(data.items[0]);dialog.showModal();};
  const draw=()=>{const values=Object.fromEntries(new FormData(filters));const order=new Map(days.map((day,index)=>[day,index]));const items=data.items.filter((item)=>(!values.teacher||item.teacherId===values.teacher)&&(!values.day||item.day===values.day)).sort((a,b)=>(order.get(a.day)??99)-(order.get(b.day)??99)||String(a.schedule).localeCompare(String(b.schedule)));grid.innerHTML=items.length?items.map((item)=>`<article class="schedule-assignment-card"><header><span>${escapeHtml(item.day||'Día pendiente')}</span><strong>${escapeHtml(item.schedule||'Horario pendiente')}</strong></header><div class="schedule-course-mark">${icon('book')}</div><div><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.course)}</h3><p>${escapeHtml(item.teacher)}</p><dl><span>${icon('graduation')} ${escapeHtml(item.group)}</span><span>${icon('grid')} ${escapeHtml(item.room)}</span><span>${icon('users')} ${item.students.length} matriculados</span></dl></div><button class="secondary-action" data-schedule-edit="${item.id}" type="button">${icon('calendar')} Editar horario</button></article>`).join(''):coordinatorEmptyState('calendar','No hay horarios para estos filtros','Cambie el Docente o el día seleccionado, o asigne un horario a una clase.');};
  filters.addEventListener('change',draw);content.querySelector('#assign-schedule').addEventListener('click',()=>open());grid.addEventListener('click',(event)=>{const button=event.target.closest('[data-schedule-edit]');if(button)open(data.items.find((item)=>item.id===button.dataset.scheduleEdit));});form.elements.classId.addEventListener('change',()=>fill(selectedClass()));dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async(event)=>{event.preventDefault();const item=selectedClass();const message=form.querySelector('.dialog-message');if(!item)return;message.textContent='';const values={...item,teacherId:form.elements.teacherId.value,day:form.elements.day.value,schedule:`${form.elements.startTime.value}–${form.elements.endTime.value}`,room:form.elements.room.value,modality:form.elements.modality.value,studentIds:item.studentIds};delete values.teacher;delete values.students;try{const result=await api(`/api/coordinator/classes/${item.id}`,{method:'PUT',body:JSON.stringify(values)});notify(result.message);dialog.close();data=await api('/api/coordinator/classes');draw();}catch(error){message.textContent=error.message;}});draw();
}

async function renderCoordinatorJustifications() {
  let data=await api('/api/coordinator/justifications');
  content.innerHTML=`<section class="coordinator-module-hero justification-hero"><span>${icon('file')}</span><div><p class="section-kicker text-on-dark">Resolución institucional</p><h2>Justificaciones derivadas</h2><p>Revise evidencias y emita una decisión final dentro de su programa.</p></div></section><section class="panel page-spacer">${panelHeading('Bandeja de revisión','Justificaciones estudiantiles','Aprobar u observar registra responsable, fecha y comentario.')}<form class="coordinator-filter-grid" id="justification-filters"><label>Estado<select name="status"><option value="">Todos</option>${data.statuses.map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="wide">Estudiante<select name="student"><option value="">Todos</option>${data.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label></form><div class="coordinator-justification-grid" id="coordinator-justifications"></div></section>`;
  const form=content.querySelector('#justification-filters');const host=content.querySelector('#coordinator-justifications');let items=data.items;
  const draw=()=>{host.innerHTML=items.length?items.map((item)=>`<article><header><span>${escapeHtml(item.id)}</span>${status(item.status)}</header><div class="case-student"><span>${tutorInitials(item.student)}</span><div><strong>${escapeHtml(item.student)}</strong><small>${teacherDate(item.date)} · ${escapeHtml(item.reason)}</small></div></div><p>${escapeHtml(item.description||item.observation||'Sin descripción adicional')}</p>${item.evidenceName?`<a class="evidence-link" href="/api/coordinator/justifications/${item.id}/evidence" target="_blank">${icon('file')} Revisar evidencia: ${escapeHtml(item.evidenceName)}</a>`:'<small>Sin evidencia adjunta.</small>'}${item.resolvedByName?`<div class="alert-action"><small>Resolución de ${escapeHtml(item.resolvedByName)}</small><span>${escapeHtml(item.observation)}</span></div>`:''}<footer>${['Aprobada','Observada'].includes(item.status)?status('Revisada'):`<button class="primary-action" data-justification-state="Aprobada" data-id="${item.id}" type="button">${icon('check')} Aprobar</button><button class="danger-action" data-justification-state="Observada" data-id="${item.id}" type="button">${icon('alert')} Observar</button>`}</footer></article>`).join(''):coordinatorEmptyState('file','Sin justificaciones para esta vista','No hay resultados con los filtros seleccionados.',`<button class="secondary-action" type="button" data-clear-justification>Limpiar filtros</button>`);};
  const load=async()=>{data=await api(`/api/coordinator/justifications?${new URLSearchParams(new FormData(form))}`);items=data.items;draw();};form.addEventListener('change',()=>load().catch((error)=>notify(error.message,'error')));host.addEventListener('click',async(event)=>{if(event.target.closest('[data-clear-justification]')){form.reset();await load().catch((error)=>notify(error.message,'error'));return;}const button=event.target.closest('[data-justification-state]');if(!button)return;const observed=button.dataset.justificationState==='Observada';const observation=await promptAction(observed?'Indique qué debe corregirse o aclararse:':'Comentario de aprobación (opcional):',{required:observed});if(observation===null||observed&&!observation.trim())return;try{const result=await api(`/api/coordinator/justifications/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:button.dataset.justificationState,observation})});notify(result.message);await load();}catch(error){notify(error.message,'error');}});draw();
}

async function renderCoordinatorSecurity() {
  let data=await api('/api/coordinator/security-incidents');
  content.innerHTML=`<section class="coordinator-module-hero security-review-hero"><span>${icon('shield')}</span><div><p class="section-kicker text-on-dark">Protección del programa</p><h2>Incidencias reportadas en puerta</h2><p>Solo se muestran eventos vinculados con estudiantes de su programa.</p></div></section><section class="panel page-spacer">${panelHeading('Seguimiento operativo','Casos de seguridad','Coordine la atención y documente la conclusión de cada caso.')}<div class="security-incident-list" id="coordinator-security-list"></div></section>`;
  const host=content.querySelector('#coordinator-security-list');const draw=()=>{host.innerHTML=data.items.length?data.items.map((item)=>`<article><span class="guard-priority priority-${String(item.priority).toLowerCase()}">${escapeHtml(item.priority)}</span><div><header><strong>${escapeHtml(item.student)} · ${escapeHtml(item.type)}</strong>${status(item.status)}</header><p>${escapeHtml(item.description)}</p><small>${escapeHtml(item.createdByName)} · ${escapeHtml(item.pointOfControl)} · ${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(item.date))}</small>${item.evidenceName?`<a class="evidence-link" href="/api/coordinator/security-incidents/${item.id}/evidence" target="_blank">${icon('file')} Revisar evidencia</a>`:''}${item.reviewNote?`<em>${escapeHtml(item.reviewNote)}</em>`:''}</div><footer>${item.status==='Abierta'?`<button class="secondary-action" data-coordinator-security="En revisión" data-id="${item.id}" type="button">Tomar caso</button>`:''}${item.status!=='Cerrada'?`<button class="primary-action" data-coordinator-security="Cerrada" data-id="${item.id}" type="button">Cerrar</button>`:''}</footer></article>`).join(''):'<p class="empty-notice">No existen incidencias vinculadas con su programa.</p>';};host.addEventListener('click',async(event)=>{const button=event.target.closest('[data-coordinator-security]');if(!button)return;const closing=button.dataset.coordinatorSecurity==='Cerrada';const note=await promptAction(closing?'Registre la conclusión del caso:':'Observación inicial (opcional):',{required:closing});if(note===null||closing&&!note.trim())return;try{const result=await api(`/api/coordinator/security-incidents/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:button.dataset.coordinatorSecurity,note})});notify(result.message);data=await api('/api/coordinator/security-incidents');draw();}catch(error){notify(error.message,'error');}});draw();
}

function coordinatorQrVisual(id, code) {
  return `<img class="official-qr" src="/api/coordinator/exits/${encodeURIComponent(id)}/qr.svg" alt="Código QR oficial ${escapeHtml(code)}" width="88" height="88">`;
}

function coordinatorEmptyState(iconName, title, copy, action = '') {
  return `<section class="coordinator-empty-state" role="status"><span class="coordinator-empty-icon">${icon(iconName)}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>${action}</section>`;
}

async function renderCoordinatorExits() {
  content.innerHTML = `<section class="coordinator-module-hero permission-hero"><span>${icon('clipboard')}</span><div><p class="section-kicker text-on-dark">Flujo institucional</p><h2>Permisos y solicitudes de salida</h2><p>La autorización genera una boleta oficial; Vigilancia valida el QR en la salida.</p></div></section><section class="panel page-spacer">${panelHeading('Revisión de coordinación','Solicitudes del programa','Confirme cuidadosamente las decisiones importantes.')}<div class="permission-tabs" role="group" aria-label="Filtrar solicitudes"><button class="is-active" type="button" data-exit-filter="">Todas</button><button type="button" data-exit-filter="Pendiente de coordinación">Pendientes</button><button type="button" data-exit-filter="Autorizada">Autorizadas</button><button type="button" data-exit-filter="Rechazada">Rechazadas</button></div><div id="coordinator-exit-list" class="boleta-list"><p class="empty-notice">Cargando solicitudes…</p></div></section>`;
  const host = content.querySelector('#coordinator-exit-list');
  let items = [];
  let activeFilter = '';
  const draw = async () => {
    const data = await api('/api/coordinator/exits');
    items = data.items;
    const visible = activeFilter ? items.filter((item)=>item.status === activeFilter) : items;
    const counters = {'':items.length,'Pendiente de coordinación':items.filter((item)=>item.status==='Pendiente de coordinación').length,'Autorizada':items.filter((item)=>item.status==='Autorizada').length,'Rechazada':items.filter((item)=>item.status==='Rechazada').length};
    const tabLabels = {'':'Todas','Pendiente de coordinación':'Pendientes','Autorizada':'Autorizadas','Rechazada':'Rechazadas'};
    content.querySelectorAll('[data-exit-filter]').forEach((button)=>{const key=button.dataset.exitFilter;button.innerHTML=`<span>${tabLabels[key]}</span><b>${counters[key]||0}</b>`;});
    host.innerHTML = visible.length ? visible.map((item) => `<article class="boleta-card ${item.status === 'Autorizada' ? 'is-authorized' : item.status === 'Rechazada' ? 'is-rejected' : 'is-pending'}"><header><div><span>${escapeHtml(item.id)}</span><strong>${escapeHtml(item.student)}</strong><p>${escapeHtml(item.course)}${item.group ? ` · ${escapeHtml(item.group)}` : ''}</p></div>${status(item.status)}</header><div class="boleta-details"><span><small>Motivo</small>${escapeHtml(item.reason)}</span><span><small>Tipo de retiro</small>${escapeHtml(item.withdrawalType || 'No especificado')}</span><span><small>Fecha y hora</small>${teacherDate(item.date)} · ${escapeHtml(item.time)}</span><span><small>Registrada por</small>${escapeHtml(item.teacher)}</span></div>${item.status === 'Pendiente de coordinación' ? `<div class="row-actions coordinator-decision"><button class="primary-action" type="button" data-exit-decision="Autorizada" data-id="${item.id}">${icon('check')} Autorizar y generar QR</button><button class="danger-action" type="button" data-exit-decision="Rechazada" data-id="${item.id}">${icon('alert')} Rechazar</button></div>` : item.status === 'Autorizada' ? `<div class="official-ticket"><div><span>Boleta oficial de salida</span><strong>${escapeHtml(item.qrCode)}</strong><small>Validación final a cargo de Vigilancia.</small></div>${coordinatorQrVisual(item.id,item.qrCode)}</div>` : `<p class="pending-ticket is-rejected">${icon('alert')} <span><strong>Solicitud rechazada</strong>${escapeHtml(item.decisionReason || 'Sin motivo registrado.')}</span></p>`}</article>`).join('') : coordinatorEmptyState('clipboard','No hay solicitudes en esta vista',activeFilter ? 'El programa no tiene solicitudes con el estado seleccionado.' : 'Cuando se registre una solicitud de salida aparecerá aquí para su revisión.');
  };
  content.querySelector('.permission-tabs').addEventListener('click',(event)=>{const button=event.target.closest('[data-exit-filter]');if(!button)return;activeFilter=button.dataset.exitFilter;content.querySelectorAll('[data-exit-filter]').forEach((item)=>item.classList.toggle('is-active',item===button));const data={items};const visible=activeFilter?data.items.filter((item)=>item.status===activeFilter):data.items;host.innerHTML='<p class="loading-state">Actualizando vista…</p>';draw().catch((error)=>notify(error.message,'error'));});
  host.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-exit-decision]');
    if (!button) return;
    const decision = button.dataset.exitDecision;
    if (!await confirmAction(decision === 'Autorizada' ? '¿Autorizar la salida y generar la boleta QR?' : '¿Rechazar esta solicitud de salida?')) return;
    const reason = decision === 'Rechazada' ? await promptAction('Indique el motivo del rechazo:',{required:true}) : '';
    if (decision === 'Rechazada' && !String(reason || '').trim()) return notify('Debe indicar el motivo del rechazo.','error');
    button.disabled = true;
    try { const result = await api(`/api/coordinator/exits/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:decision,reason})}); notify(result.message); await draw(); }
    catch (error) { button.disabled = false; notify(error.message,'error'); }
  });
  await draw();
}

async function renderCoordinatorPermanence() {
  const initial = await api('/api/coordinator/permanence');
  content.innerHTML = `<section class="coordinator-module-hero permanence-hero"><span>${icon('heart')}</span><div><p class="section-kicker text-on-dark">Permanencia estudiantil</p><h2>Incidencias con seguimiento</h2><p>Registre evidencias, responsables y cambios con auditoría.</p></div><button class="command-primary" type="button" id="new-incident">${icon('alert')} Nueva incidencia</button></section><section class="panel page-spacer">${panelHeading('Seguimiento del programa','Registro de incidencias','Consulte, actualice, atienda o cierre cada caso.')}<form class="coordinator-filter-grid incident-filters" id="incident-filters"><label class="wide">${icon('scan')}<input name="search" type="search" aria-label="Buscar código, estudiante, tipo o responsable" placeholder="Buscar código, estudiante, tipo o responsable"></label><label>Estudiante<select name="student"><option value="">Todos</option>${initial.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Tipo<select name="type"><option value="">Todos</option>${initial.types.map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Estado<select name="state"><option value="">Todos</option>${initial.states.map((item)=>`<option>${item}</option>`).join('')}</select></label></form><div id="incident-results"></div></section>
  <dialog class="record-dialog incident-dialog" id="incident-dialog"><form id="incident-form"><header><div><p class="section-kicker">Permanencia</p><h2 id="incident-title">Nueva incidencia</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><input name="id" type="hidden"><div class="dialog-fields"><label>Estudiante<select name="studentId" required>${initial.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Fecha<input name="date" type="date" max="${localIsoDate()}" value="${localIsoDate()}" required></label><label>Tipo<select name="type">${initial.types.map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="wide">Descripción<textarea name="description" rows="4" maxlength="600" required></textarea></label><label>Responsable<input name="responsible" maxlength="120" value="${escapeHtml(currentUser.name)}" required></label><label>Evidencia o referencia<input name="evidence" maxlength="300" placeholder="Documento, enlace o descripción"></label></div><p class="dialog-message"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Guardar incidencia</button></footer></form></dialog>`;
  const host=content.querySelector('#incident-results');const filters=content.querySelector('#incident-filters');const dialog=content.querySelector('#incident-dialog');const form=content.querySelector('#incident-form');let items=initial.items;
  const draw=(records)=>{host.innerHTML=records.length?`<div class="incident-card-grid">${records.map((item)=>`<article class="incident-record"><header><span>${escapeHtml(item.id)}</span>${status(item.status)}</header><div class="incident-record-copy"><small>${teacherDate(item.date)} · ${escapeHtml(item.type)}</small><h3>${escapeHtml(item.student)}</h3><p>${escapeHtml(item.description)}</p></div><dl><div><dt>Responsable</dt><dd>${escapeHtml(item.responsible)}</dd></div><div><dt>Evidencia</dt><dd>${escapeHtml(item.evidence||'Sin evidencia adjunta')}</dd></div></dl><details><summary>Historial (${item.history.length})</summary>${item.history.map((audit)=>`<p><strong>${escapeHtml(audit.action)}</strong><span>${escapeHtml(audit.userName)} · ${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(audit.date))}</span><small>${escapeHtml(audit.reason||'Sin observación')}</small></p>`).join('')||'<p>Sin cambios anteriores.</p>'}</details><footer><button class="secondary-action" type="button" data-incident-edit="${item.id}" ${item.status==='Cerrada'?'hidden':''}>${icon('file')} Editar</button>${item.status==='Abierta'?`<button class="secondary-action" type="button" data-incident-state="Atendida" data-id="${item.id}">${icon('check')} Marcar atendida</button>`:''}${item.status!=='Cerrada'?`<button class="primary-action" type="button" data-incident-state="Cerrada" data-id="${item.id}">${icon('lock')} Cerrar caso</button>`:''}</footer></article>`).join('')}</div>`:coordinatorEmptyState('heart','Sin incidencias registradas','No hay casos que coincidan con estos filtros. Puede limpiar los criterios o registrar una nueva incidencia.',`<button class="primary-action" type="button" data-empty-action="new-incident">${icon('alert')} Registrar incidencia</button>`);};
  const load=async()=>{const data=await api(`/api/coordinator/permanence?${new URLSearchParams(new FormData(filters))}`);items=data.items;draw(items);};let timer;filters.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load().catch((error)=>notify(error.message,'error')),250);});filters.addEventListener('change',()=>load().catch((error)=>notify(error.message,'error')));
  const open=(item={})=>{form.reset();form.elements.id.value=item.id||'';form.elements.date.value=item.date||localIsoDate();['studentId','type','description','responsible','evidence'].forEach((key)=>{if(item[key]!==undefined)form.elements[key].value=item[key];});if(!item.id)form.elements.responsible.value=currentUser.name;content.querySelector('#incident-title').textContent=item.id?'Editar incidencia':'Nueva incidencia';dialog.showModal();};
  content.querySelector('#new-incident').addEventListener('click',()=>open());content.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());content.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async(event)=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));const id=values.id;delete values.id;try{const result=await api(id?`/api/coordinator/permanence/${id}`:'/api/coordinator/permanence',{method:id?'PUT':'POST',body:JSON.stringify(values)});notify(result.message);dialog.close();await load();}catch(error){form.querySelector('.dialog-message').textContent=error.message;}});
  host.addEventListener('click',async(event)=>{if(event.target.closest('[data-empty-action="new-incident"]'))return open();const edit=event.target.closest('[data-incident-edit]');if(edit)return open(items.find((item)=>item.id===edit.dataset.incidentEdit));const button=event.target.closest('[data-incident-state]');if(!button)return;const state=button.dataset.incidentState;if(!await confirmAction(`¿Marcar esta incidencia como ${state.toLowerCase()}?`))return;const note=await promptAction('Observación para el historial:','')||'';try{const result=await api(`/api/coordinator/permanence/${button.dataset.id}/state`,{method:'PATCH',body:JSON.stringify({state,note})});notify(result.message);await load();}catch(error){notify(error.message,'error');}});draw(items);
}

async function renderCoordinatorReports() {
  const students=(await api('/api/coordinator/students')).items;
  content.innerHTML=`<section class="coordinator-module-hero report-hero"><span>${icon('chart')}</span><div><p class="section-kicker text-on-dark">Análisis del programa</p><h2>Reportes de Coordinación</h2><p>Asistencia, permisos y permanencia dentro de su alcance académico.</p></div><div class="teacher-report-downloads"><a id="coordinator-report-xlsx" class="secondary-action" href="/api/coordinator/reports.xlsx">${icon('file')} Excel</a><a id="coordinator-report-pdf" class="command-primary" href="/api/coordinator/reports.pdf">${icon('clipboard')} PDF</a></div></section><section class="panel page-spacer"><form class="coordinator-report-filters" id="coordinator-report-filters"><label>Semestre<select name="semester"><option value="">Todos</option>${['I','II','III','IV','V','VI'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Estudiante<select name="student"><option value="">Todos</option>${students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><label>Asistencia<select name="state"><option value="">Todos los estados</option>${teacherStateOptions()}</select></label><label>Permanencia<select name="incidentState"><option value="">Todos los estados</option><option>Abierta</option><option>Atendida</option><option>Cerrada</option></select></label><button class="primary-action" type="submit">${icon('scan')} Aplicar filtros</button></form></section><div id="coordinator-report-results" class="page-spacer"></div>`;
  const form=content.querySelector('#coordinator-report-filters');const host=content.querySelector('#coordinator-report-results');
  const load=async()=>{const query=new URLSearchParams(new FormData(form));host.innerHTML='<div class="loading-state">Analizando información del programa…</div>';try{const data=await api(`/api/coordinator/reports?${query}`);content.querySelector('#coordinator-report-xlsx').href=`/api/coordinator/reports.xlsx?${query}`;content.querySelector('#coordinator-report-pdf').href=`/api/coordinator/reports.pdf?${query}`;const max=Math.max(...data.byState.map((item)=>item.total),1);host.innerHTML=`<section class="coordinator-report-summary"><article><span>${icon('clipboard')}</span><div><small>Asistencia</small><strong>${data.attendance.length}</strong><p>registros analizados</p></div></article><article><span>${icon('exit')}</span><div><small>Permisos</small><strong>${data.exits.length}</strong><p>solicitudes del periodo</p></div></article><article><span>${icon('heart')}</span><div><small>Permanencia</small><strong>${data.incidents.length}</strong><p>incidencias filtradas</p></div></article></section><div class="report-insight-grid"><section class="panel">${panelHeading('Asistencia','Distribución por estado',data.program)}<div class="teacher-state-chart">${data.byState.map((item)=>`<article><span><i data-chart-height="${Math.max(8,Math.round(item.total/max*100))}"></i></span><strong>${item.total}</strong><small>${escapeHtml(item.state)}</small></article>`).join('')}</div></section><section class="panel">${panelHeading('Permanencia','Estado de incidencias','Seguimiento auditado')}<div class="report-summary-list">${data.incidentByState.map((item)=>`<article><span>${status(item.state)}</span><strong>${item.total}</strong></article>`).join('')}</div><div class="report-summary-list permission-summary">${data.exitStates.map((item)=>`<article><span>${status(item.state)}</span><strong>${item.total}</strong></article>`).join('')}</div></section></div>${data.attendance.length?`<section class="panel page-spacer">${panelHeading('Detalle','Registros de asistencia','Resultados de los filtros aplicados')}${rowsTable(['Fecha','Estudiante','Curso','Grupo','Estado'],data.attendance.map((item)=>`<tr><td>${teacherDate(item.date)}</td><td>${escapeHtml(item.student)}</td><td>${escapeHtml(item.course)}</td><td>${escapeHtml(item.group)}</td><td>${status(item.state)}</td></tr>`))}</section>`:''}`;applyDynamicStyles(host);}catch(error){host.innerHTML=`<section class="panel error-panel"><h2>No fue posible generar el reporte</h2><p>${escapeHtml(error.message)}</p></section>`;}};
  form.addEventListener('submit',(event)=>{event.preventDefault();load();});form.addEventListener('change',load);await load();
}

async function renderCoordinatorAccount() {
  const user=(await api('/api/account')).user;const value=(key)=>escapeHtml(user[key]||'');const portrait=user.photoUrl?`<img src="${user.photoUrl}?v=${Date.now()}" alt="Foto del Coordinador">`:`<span>${escapeHtml(user.name.split(/\s+/).slice(0,2).map((part)=>part[0]).join(''))}</span>`;
  content.innerHTML=`<section class="teacher-profile-hero coordinator-profile-hero"><div class="teacher-profile-avatar" id="coordinator-profile-avatar">${portrait}</div><div><p class="section-kicker text-on-dark">Perfil de Coordinación</p><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.position||'Coordinador')} · ${escapeHtml(user.program||'Programa por asignar')}</p><span>${icon('shield')} ${escapeHtml(user.institutionalCode||user.id)}</span></div><form id="coordinator-photo-form"><input id="coordinator-photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden required><label class="secondary-action" for="coordinator-photo-input">Elegir foto</label><button class="command-primary" type="submit">Guardar</button></form></section><div class="split-grid profile-layout"><section class="panel">${panelHeading('Información institucional','Datos del Coordinador','Los datos institucionales son de consulta; puede actualizar teléfono, dirección y presentación.')}<form class="account-form profile-details-grid" id="coordinator-profile-form"><label>Nombre completo<input value="${value('name')}" readonly></label><label>Usuario<input value="${value('username')}" readonly></label><label>Correo institucional<input value="${value('email')}" readonly></label><label>Código institucional<input value="${value('institutionalCode')}" readonly></label><label class="wide">Programa de estudios<input value="${value('program')}" readonly></label><label>Teléfono<input name="phone" value="${value('phone')}" maxlength="20" autocomplete="tel"></label><label>Dirección<input name="address" value="${value('address')}" maxlength="160"></label><label class="wide">Presentación<textarea name="bio" maxlength="300" rows="4">${value('bio')}</textarea></label><button class="primary-action wide" type="submit">Guardar datos autorizados</button><p class="form-message wide"></p></form></section><section class="panel">${panelHeading('Seguridad y sesión','Preferencias de cuenta')}<form class="account-form" id="coordinator-password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><small>Use 10 caracteres, mayúscula, minúscula, número y símbolo.</small><button class="primary-action" type="submit">Cambiar contraseña</button><p class="form-message"></p></form><div class="theme-control"><span><strong>Tema de la plataforma</strong><small>Alterne entre modo claro y oscuro.</small></span><button class="secondary-action" id="coordinator-account-theme" type="button">Cambiar tema</button></div><button class="danger-action teacher-account-logout" data-action="logout" type="button">Cerrar sesión de forma segura</button></section></div>`;
  content.querySelector('#coordinator-profile-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;currentUser=result.user;notify(result.message);refreshSessionIdentity();}catch(error){form.querySelector('.form-message').textContent=error.message;}});content.querySelector('#coordinator-password-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;form.reset();notify(result.message);}catch(error){form.querySelector('.form-message').textContent=error.message;}});const input=content.querySelector('#coordinator-photo-input');input.addEventListener('change',()=>{const file=input.files[0];if(file&&file.size>2*1024*1024){input.value='';notify('La foto no debe superar 2 MB.','error');return;}if(file)content.querySelector('#coordinator-profile-avatar').innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Vista previa">`;});content.querySelector('#coordinator-photo-form').addEventListener('submit',async(event)=>{event.preventDefault();if(!input.files[0])return notify('Seleccione una foto válida antes de guardar.','error');try{const result=await api('/api/account/photo',{method:'POST',body:new FormData(event.currentTarget)});currentUser=result.user;csrfToken=result.user.csrf;notify(result.message);refreshSessionIdentity();await renderCoordinatorAccount();}catch(error){notify(error.message,'error');}});content.querySelector('#coordinator-account-theme').addEventListener('click',()=>{document.body.classList.toggle('theme-dark');localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light');});
}

function renderReports() {
  content.innerHTML = `<section class="metric-grid">${metric('Asistencia','87%','Promedio del periodo','green','AS')}${metric('Presentes','126','Registro actual','blue','PR')}${metric('Tardanzas','12','Registro actual','amber','TA')}${metric('Ausentes','7','Registro actual','red','AU')}</section><div class="split-grid"><section class="panel">${panelHeading('Indicadores','Asistencia por programa','Resumen institucional')}<div class="report-bars"><div class="report-bar"><div class="h-82"></div><span>ENF</span></div><div class="report-bar"><div class="h-68"></div><span>ACU</span></div><div class="report-bar"><div class="h-74"></div><span>MEC</span></div><div class="report-bar"><div class="h-58"></div><span>TI</span></div></div></section><section class="panel">${panelHeading('Distribución','Estados de asistencia')}<div class="attendance-layout compact-attendance"><div class="donut compact-donut"><div class="donut-center"><strong>145</strong><span>registros</span></div></div><div class="legend"><div class="legend-row"><i class="legend-dot green-dot"></i><span>Presentes</span><strong>126</strong></div><div class="legend-row"><i class="legend-dot amber-dot"></i><span>Tardanzas</span><strong>12</strong></div><div class="legend-row"><i class="legend-dot red-dot"></i><span>Ausentes</span><strong>7</strong></div></div></div><button class="secondary-action" type="button" data-action="export-report">Exportar reporte CSV</button></section></div>`;
}

function renderExcel() {
  content.innerHTML = `<div class="split-grid"><section class="panel">${panelHeading('Importación masiva','Plantillas disponibles','Archivos para la gestión institucional')}<div class="template-grid"><article class="template-card"><strong>Plantilla de estudiantes</strong><span>Semestre, programa, tutor y estado de matrícula.</span><button class="secondary-action" type="button" data-action="download-template" data-template="estudiantes">Descargar plantilla</button></article><article class="template-card"><strong>Plantilla de personal</strong><span>Docentes, coordinadores, tutores y usuarios institucionales.</span><button class="secondary-action" type="button" data-action="download-template" data-template="personal">Descargar plantilla</button></article><article class="template-card"><strong>Plantilla de familias</strong><span>Vínculos protegidos entre apoderados y estudiantes.</span><button class="secondary-action" type="button" data-action="download-template" data-template="familias">Descargar plantilla</button></article><article class="template-card"><strong>Importar archivo Excel</strong><span id="file-feedback">Seleccione el archivo institucional correspondiente.</span><input id="excel-file" type="file" accept=".xlsx,.xls,.csv" hidden><button class="secondary-action" type="button" data-action="choose-file">Seleccionar archivo</button></article></div></section><section class="panel">${panelHeading('Reglas automáticas','Validación antes de guardar')}<ul class="check-list"><li class="check-item"><span class="item-icon">01</span><span><strong>Estado normalizado</strong><span>Solo Activo o Inactivo.</span></span></li><li class="check-item"><span class="item-icon">02</span><span><strong>Programa validado</strong><span>Una de las cuatro opciones institucionales.</span></span></li><li class="check-item"><span class="item-icon">03</span><span><strong>Duplicados prevenidos</strong><span>Verificación previa de usuarios y documentos.</span></span></li><li class="check-item"><span class="item-icon">04</span><span><strong>Cuenta aprovisionada</strong><span>Alta controlada del perfil institucional.</span></span></li></ul></section></div>`;
}

function renderConfiguration() {
  content.innerHTML = `<section class="panel">${panelHeading('Arquitectura técnica','Servicios implementados','Componentes reales de esta instalación local.')}<div class="tech-stack"><article class="tech-card"><span class="tech-symbol">UI</span><span><strong>HTML, CSS y JavaScript</strong><span>Interfaz responsive, accesible y separada por perfiles.</span></span></article><article class="tech-card"><span class="tech-symbol">EX</span><span><strong>Node.js y Express</strong><span>API institucional, sesiones, validaciones y control por rol.</span></span></article><article class="tech-card"><span class="tech-symbol">JS</span><span><strong>Persistencia JSON local</strong><span>Almacenamiento atómico para la versión de evaluación e intranet.</span></span></article><article class="tech-card"><span class="tech-symbol">SV</span><span><strong>Excel, PDF y QR</strong><span>Importación, reportes y boletas oficiales generadas en servidor.</span></span></article></div></section><section class="panel page-spacer">${panelHeading('Restricciones operativas','Seguridad por perfil')}<div class="capability-grid"><article class="capability"><strong>Acceso por rol</strong><span>Cada perfil visualiza únicamente sus funciones autorizadas.</span></article><article class="capability"><strong>Segmentación por programa</strong><span>Coordinadores, docentes y tutores limitados a su ámbito.</span></article><article class="capability"><strong>Auditoría</strong><span>Asistencias, permisos, permanencia y salidas dejan trazabilidad.</span></article><article class="capability"><strong>Archivos protegidos</strong><span>Las evidencias se entregan únicamente a sesiones autorizadas.</span></article></div></section>`;
}

function renderPermanence(roleKey) {
  const incidents = [['INC-018','Valeria Cruz Jiménez','Académica','En seguimiento','Tutor'],['INC-017','Diego Mendoza Ruiz','Asistencia','Abierta','Coordinador'],['INC-014','Jairo Céspedes','Permanencia','Cerrada','Tutor']];
  const rows = incidents.map(([id,name,type,state,owner]) => `<tr><td><span class="incident-code">${icon('alert')}<strong>${id}</strong></span></td><td><span class="incident-student"><span>${escapeHtml(name.split(/\s+/).slice(0,2).map((part)=>part[0]).join(''))}</span><strong>${name}</strong></span></td><td><span class="incident-type">${type}</span></td><td>${status(state)}</td><td><span class="owner-badge">${icon(owner === 'Tutor' ? 'heart' : 'graduation')} ${owner}</span></td></tr>`);
  if (roleKey === 'tutor') {
    const open = incidents.filter((item)=>item[3] !== 'Cerrada').length;
    content.innerHTML = `<section class="tutor-module-intro tutor-incident-intro"><span>${icon('alert')}</span><div><p class="section-kicker text-on-dark">Seguimiento institucional</p><h2>Incidencias y permanencia</h2><p>Identifique los casos que requieren acompañamiento y su responsable actual.</p></div><div class="tutor-intro-stats"><span><strong>${incidents.length}</strong> casos registrados</span><span><strong>${open}</strong> requieren atención</span></div></section><section class="incident-summary"><article><span>${icon('alert')}</span><div><strong>${open}</strong><small>Casos activos</small></div></article><article><span>${icon('check')}</span><div><strong>${incidents.length-open}</strong><small>Casos cerrados</small></div></article><article><span>${icon('users')}</span><div><strong>2</strong><small>Responsables</small></div></article></section><section class="panel tutor-incidents-panel">${panelHeading('Registro de casos','Incidencias asignadas','Evidencias, estados y responsables')} ${tableToolbar('Buscar por código, estudiante o tipo')}${rowsTable(['Caso','Estudiante','Tipo','Estado','Responsable'],rows)}</section>`;
    return;
  }
  content.innerHTML = `<section class="panel">${panelHeading('Seguimiento institucional','Incidencias y permanencia','Evidencias y responsables institucionales.')} ${tableToolbar('Buscar incidencia o estudiante')}${rowsTable(['Código','Estudiante','Tipo','Estado','Responsable'],rows)}</section>`;
}

function renderFollowUp() {
  const followUp = [['JC','Jairo Céspedes',92,'Consolidado','Sin alertas'],['VC','Valeria Cruz',86,'Estable','Seguimiento regular'],['DM','Diego Mendoza',64,'Requiere atención','Prioridad de acompañamiento'],['LA','Lucía Álvarez',78,'En progreso','Revisar permanencia']];
  const average = Math.round(followUp.reduce((sum,item)=>sum+item[2],0)/followUp.length);
  content.innerHTML = `<section class="tutor-followup-hero"><div><p class="section-kicker text-on-dark">Tutoría académica</p><h2>Panorama de seguimiento</h2><p>Compare el avance e identifique rápidamente a quién debe priorizar.</p></div><div class="followup-overview"><span>${icon('chart')}</span><div><strong>${average}%</strong><small>avance promedio</small></div></div></section><section class="panel tutor-followup-panel">${panelHeading('Indicadores del periodo','Avance por estudiante','El color señala el nivel de atención recomendado')}<div class="tutor-progress-grid">${followUp.map(([initials,name,score,state,detail])=>`<article class="tutor-score-card ${score>=85?'score-high':score>=75?'score-medium':'score-alert'}"><div class="score-ring" data-score="${score}"><span><strong>${score}%</strong><small>avance</small></span></div><div class="score-copy"><span class="score-avatar">${initials}</span><div><h3>${name}</h3><p>${detail}</p></div></div><footer><span>${state}</span><b>${score<70?icon('alert'):icon('check')} ${score<70?'Priorizar':'Seguimiento activo'}</b></footer></article>`).join('')}</div><div class="followup-legend"><span><i class="legend-high"></i> 85% o más: consolidado</span><span><i class="legend-medium"></i> 70%–84%: en progreso</span><span><i class="legend-alert"></i> Menos de 70%: requiere atención</span></div></section>`;
  applyDynamicStyles();
}

function renderMeetings(roleKey) {
  const meetings = [['calendar','Reunión de apoderados','Informe de avance académico del periodo.','General','08 oct','17:00'],['student','Tutoría individual','Seguimiento de asistencia y permanencia.','Individual','10 oct','15:30'],['graduation','Coordinación académica','Revisión de incidencias abiertas.','Coordinación','14 oct','09:00']];
  content.innerHTML = `${roleKey === 'tutor' ? `<section class="tutor-module-intro tutor-meeting-intro"><span>${icon('calendar')}</span><div><p class="section-kicker text-on-dark">Comunicación y acompañamiento</p><h2>Agenda de reuniones</h2><p>Organice los próximos encuentros con familias, estudiantes y Coordinación.</p></div><div class="next-meeting"><small>Próxima reunión</small><strong>Hoy · 17:00</strong></div></section>` : ''}<section class="panel tutor-meetings-panel">${panelHeading('Agenda institucional','Reuniones programadas','Próximos encuentros confirmados')}<div class="meeting-agenda">${meetings.map(([iconName,title,description,type,date,time],index)=>`<article class="meeting-card meeting-tone-${index+1}"><span class="meeting-icon">${icon(iconName)}</span><div class="meeting-copy"><span class="meeting-type">${type}</span><strong>${title}</strong><p>${description}</p></div><time><small>${date}</small><strong>${time}</strong></time><span class="meeting-state">${icon('check')} Programada</span></article>`).join('')}</div></section>`;
}

function renderNotices() {
  content.innerHTML = `<section class="panel">${panelHeading('Comunicaciones','Avisos institucionales','Información vigente')}<ul class="notice-list"><li class="notice-item"><span class="item-icon">01</span><span><strong>Reunión informativa del periodo</strong><span>Convocatoria dirigida a estudiantes y familias.</span></span><time>Hoy</time></li><li class="notice-item"><span class="item-icon">02</span><span><strong>Actualización de horario académico</strong><span>Revise la programación correspondiente a su programa.</span></span><time>Ayer</time></li><li class="notice-item"><span class="item-icon">03</span><span><strong>Campaña de permanencia estudiantil</strong><span>Orientación y acompañamiento disponibles.</span></span><time>01 oct</time></li></ul></section>`;
}

function renderJustifications() {
  const rows = [['JUS-012','Cita médica','02 oct','En revisión'],['JUS-009','Motivo familiar','25 sep','Aprobada'],['JUS-006','Trámite documentario','18 sep','Aprobada']].map(([id,reason,date,state]) => `<tr><td><strong>${id}</strong></td><td>${reason}</td><td>${date}</td><td>${status(state)}</td></tr>`);
  content.innerHTML = `<section class="panel">${panelHeading('Asistencia','Justificaciones presentadas','Consulta institucional.')} ${tableToolbar('Buscar justificación')}${rowsTable(['Código','Motivo','Fecha','Estado'],rows)}</section>`;
}

function renderQr() {
  content.innerHTML = `<div class="split-grid"><section class="panel">${panelHeading('Validación','Código QR de salida','Ingrese el código de una boleta oficial autorizada.')}<div class="qr-preview"><div><div class="qr-frame">${Array.from({length:49},()=>'<span></span>').join('')}</div><div class="qr-copy"><strong>Validación de salida</strong><span id="qr-feedback">Ingrese un código para verificarlo</span></div><form class="qr-form" id="qr-form"><input id="qr-code" name="code" placeholder="Código: SOL-024" autocomplete="off" required><button class="primary-action" type="submit">Validar código</button></form></div></div></section><section class="panel">${panelHeading('Criterios de control','Resultado esperado')}<ul class="check-list"><li class="check-item"><span class="item-icon">01</span><span><strong>Solicitud autorizada</strong><span>La boleta debe provenir del coordinador.</span></span></li><li class="check-item"><span class="item-icon">02</span><span><strong>QR vigente</strong><span>El código debe corresponder al día y estudiante.</span></span></li><li class="check-item"><span class="item-icon">03</span><span><strong>Identidad verificada</strong><span>Los datos deben coincidir con la boleta oficial.</span></span></li></ul></section></div>`;
}

const studentHero = (iconName, kicker, title, description, action = '') => `<section class="student-hero"><span>${icon(iconName)}</span><div><p class="section-kicker text-on-dark">${kicker}</p><h2>${title}</h2><p>${description}</p></div>${action}</section>`;
const studentDisplayStatus = (item) => item.displayStatus || (item.status === 'Autorizada' ? 'Aprobada' : item.status === 'Pendiente de coordinación' ? 'Pendiente' : item.status);

function studentExitCards(items, qrOnly = false) {
  const visible = qrOnly ? items.filter((item) => studentDisplayStatus(item) === 'Aprobada') : items;
  if (!visible.length) return `<div class="student-empty"><span>${icon(qrOnly ? 'scan' : 'file')}</span><h3>${qrOnly ? 'No tiene códigos QR vigentes' : 'No tiene solicitudes registradas'}</h3><p>${qrOnly ? 'El QR aparecerá aquí después de la aprobación de Coordinación.' : 'Cuando envíe una solicitud podrá seguir su estado en este espacio.'}</p></div>`;
  return `<div class="student-ticket-grid">${visible.map((item) => { const display = studentDisplayStatus(item); return `<article class="student-ticket status-${display.toLowerCase().replace('á','a')}"><header><div><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.withdrawalType || 'Salida autorizada')}</h3></div>${status(display)}</header><dl><div><dt>Fecha y hora</dt><dd>${teacherDate(item.date)} · ${escapeHtml(item.time)}</dd></div><div><dt>Motivo</dt><dd>${escapeHtml(item.reason)}</dd></div><div><dt>Decisión</dt><dd>${item.authorizedAt ? new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.authorizedAt)) : 'Aún no evaluada'}</dd></div><div><dt>Coordinación</dt><dd>${escapeHtml(item.authorizedBy || 'Pendiente')}</dd></div></dl>${item.description ? `<p class="student-ticket-note">${escapeHtml(item.description)}</p>` : ''}${item.decisionReason ? `<blockquote>${escapeHtml(item.decisionReason)}</blockquote>` : ''}${display === 'Aprobada' ? `<div class="student-ticket-qr"><img src="/api/student/exits/${encodeURIComponent(item.id)}/qr.svg" alt="Código QR oficial de ${escapeHtml(item.id)}" width="132" height="132"><div><span>Boleta oficial vigente</span><strong>${escapeHtml(item.qrCode)}</strong><p>Presente este código al vigilante. Solo puede utilizarse una vez.</p></div></div>` : `<div class="student-ticket-state">${icon(display === 'Rechazada' || display === 'Vencida' ? 'alert' : display === 'Usada' ? 'check' : 'clock')}<span><strong>${escapeHtml(display)}</strong>${display === 'Pendiente' ? 'Coordinación todavía debe evaluar la solicitud.' : display === 'Usada' ? 'La salida ya fue validada por Vigilancia.' : display === 'Vencida' ? 'La autorización ya no se encuentra vigente.' : 'Revise el comentario de Coordinación.'}</span></div>`}</article>`; }).join('')}</div>`;
}

async function renderExitRequest(showForm = true) {
  const today = localIsoDate();
  let data = await api('/api/student/exits');
  if (!showForm) {
    content.innerHTML = `${studentHero('file','Historial personal','Mis solicitudes y boletas','Consulte cada decisión de Coordinación. Las solicitudes enviadas no pueden modificarse.')}<section class="panel student-section-panel">${panelHeading('Seguimiento','Historial de salidas',`${data.items.length} solicitudes encontradas`)}<div id="student-exit-list">${studentExitCards(data.items)}</div></section>`;
    return;
  }
  content.innerHTML = `${studentHero('send','Solicitud responsable','Solicitar permiso de salida','Complete los datos con precisión. El envío queda pendiente hasta la decisión de Coordinación.','<span class="student-hero-badge">Horario habilitado · 07:00–21:00</span>')}<div class="student-request-layout page-spacer"><section class="panel student-form-panel">${panelHeading('Nueva solicitud','Datos de la salida','No se permiten solicitudes duplicadas para el mismo periodo.')}<form class="account-form" id="exit-request-form"><div class="form-pair"><label>Estudiante<input value="${escapeHtml(data.student.name)}" readonly></label><label>Tipo de retiro<select name="type"><option>Temporal</option><option>Definitivo</option><option>Emergencia</option></select></label></div><div class="form-pair"><label>Fecha<input name="date" type="date" min="${today}" value="${today}" required></label><label>Hora solicitada<input name="time" type="time" min="07:00" max="21:00" required></label></div><label>Motivo<input name="reason" maxlength="120" placeholder="Ej. Cita médica o emergencia familiar" required></label><label>Descripción adicional<textarea name="description" rows="4" maxlength="500" placeholder="Agregue información útil para Coordinación"></textarea></label><label>Contacto de emergencia <span class="optional-label">opcional</span><input name="emergencyContact" maxlength="120" placeholder="Nombre y teléfono"></label><button class="primary-action" type="submit">${icon('send')} Enviar solicitud</button><p class="form-message" aria-live="polite"></p></form></section><aside class="student-flow-card"><p class="section-kicker text-on-dark">Flujo institucional</p><h2>Su QR se activa solo después de la aprobación</h2><ol><li><span>${icon('send')}</span><div><strong>Usted solicita</strong><small>La solicitud queda pendiente y no autoriza la salida.</small></div></li><li><span>${icon('shield')}</span><div><strong>Coordinación decide</strong><small>Aprueba o rechaza con trazabilidad.</small></div></li><li><span>${icon('scan')}</span><div><strong>Vigilancia valida</strong><small>El QR aprobado se usa una sola vez.</small></div></li></ol></aside></div><section class="panel student-section-panel">${panelHeading('Actividad reciente','Últimas solicitudes','Seguimiento de sus envíos')}<div id="student-exit-list">${studentExitCards(data.items.slice(0,3))}</div></section>`;
  content.querySelector('#exit-request-form').addEventListener('submit', async (event) => { event.preventDefault(); const form=event.currentTarget; const button=form.querySelector('button[type="submit"]'); const message=form.querySelector('.form-message'); button.disabled=true; message.textContent='Enviando solicitud…'; try { const result=await api('/api/student/exits',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); notify(result.message); form.reset(); form.elements.date.value=today; data=await api('/api/student/exits'); content.querySelector('#student-exit-list').innerHTML=studentExitCards(data.items.slice(0,3)); message.textContent=result.message; } catch(error) { message.textContent=error.message; notify(error.message,'error'); } finally { button.disabled=false; } });
}

async function renderStudentDashboard() {
  const data = await api('/api/student/dashboard');
  const stateTotal = (state) => data.summary.byState.find((item) => item.state === state)?.total || 0;
  content.innerHTML = `<section class="student-welcome"><div><span class="student-live"><i></i> Jornada personal · ${teacherDate(data.today)}</span><p class="section-kicker text-on-dark">Portal estudiantil</p><h2>Hola, ${escapeHtml(data.student.name.split(' ')[0])}</h2><p>Organice su jornada, revise su asistencia y gestione sus solicitudes desde un espacio seguro.</p><div class="student-welcome-tags"><span>${icon('graduation')} ${escapeHtml(data.student.program)}</span><span>${icon('book')} ${escapeHtml(data.student.semester)} · ${escapeHtml(data.student.group || 'Sin grupo')}</span></div><a class="student-primary-cta" href="${pageHref('estudiante','solicitar-salida')}">${icon('send')} Solicitar salida</a></div><aside><span>${icon(data.todayState === 'Presente' ? 'check' : data.todayState === 'Tardanza' ? 'clock' : 'calendar')}</span><small>Asistencia de hoy</small><strong>${escapeHtml(data.todayState)}</strong><p>${data.todaySummary.total ? 'Registro confirmado por el Docente' : 'Aún no se registra asistencia'}</p></aside></section><section class="summary-section-heading"><div><p class="section-kicker">Mi avance</p><h2>Resumen académico</h2></div><span>Datos personales actualizados</span></section><section class="student-kpi-grid"><article class="student-kpi blue"><span>${icon('chart')}</span><div><small>Asistencia</small><strong>${data.summary.attendanceRate}%</strong><p>${data.summary.total} registros</p></div></article><article class="student-kpi teal"><span>${icon('check')}</span><div><small>Presentes</small><strong>${stateTotal('Presente')}</strong><p>del periodo</p></div></article><article class="student-kpi amber"><span>${icon('clock')}</span><div><small>Tardanzas</small><strong>${stateTotal('Tardanza')}</strong><p>por revisar</p></div></article><article class="student-kpi violet"><span>${icon('file')}</span><div><small>Solicitudes</small><strong>${data.exits.pending}</strong><p>pendientes</p></div></article></section><div class="student-dashboard-grid"><section class="panel">${panelHeading('Agenda académica','Próximas clases','Cursos asignados a su matrícula')}<div class="student-class-preview">${data.upcomingClasses.length ? data.upcomingClasses.map((item)=>`<article><time><strong>${escapeHtml(item.day)}</strong><small>${escapeHtml(item.schedule)}</small></time><span>${icon('book')}</span><div><strong>${escapeHtml(item.course)}</strong><p>${escapeHtml(item.room)} · ${escapeHtml(item.teacher)}</p></div></article>`).join('') : '<p class="empty-notice">No hay clases asignadas.</p>'}</div><a class="student-panel-link" href="${pageHref('estudiante','mis-clases')}">Ver horario completo →</a></section><section class="panel">${panelHeading('Atención','Alertas personales','Señales calculadas con su asistencia')}<div class="student-alert-list">${data.alerts.map((item)=>`<article class="${item.tone}"><span>${icon(item.tone === 'green' ? 'check' : item.tone === 'amber' ? 'clock' : 'alert')}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div></article>`).join('')}</div><div class="student-exit-mini"><div><small>Salidas</small><strong>${data.exits.approved} aprobadas · ${data.exits.rejected} rechazadas</strong></div><a href="${pageHref('estudiante','mis-boletas')}">Ver boletas</a></div></section></div><section class="student-bottom-grid"><article class="panel">${panelHeading('Comunicaciones','Avisos recientes','Mensajes para su cuenta')}<div class="student-notice-preview">${data.notices.length ? data.notices.map((item)=>`<div><span>${icon('bell')}</span><p><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></p><time>${teacherDate(String(item.date).slice(0,10))}</time></div>`).join('') : '<p class="empty-notice">No hay avisos recientes.</p>'}</div></article><article class="student-quick-card"><p class="section-kicker text-on-dark">Accesos rápidos</p><h2>Continúe su jornada</h2><nav><a href="${pageHref('estudiante','mi-asistencia')}">${icon('check')}<span><strong>Mi asistencia</strong><small>Historial y alertas</small></span></a><a href="${pageHref('estudiante','solicitar-salida')}">${icon('send')}<span><strong>Solicitar salida</strong><small>Enviar a Coordinación</small></span></a><a href="${pageHref('estudiante','qr-salida')}">${icon('scan')}<span><strong>Mi QR</strong><small>Boletas vigentes</small></span></a><a href="${pageHref('estudiante','justificaciones')}">${icon('file')}<span><strong>Justificaciones</strong><small>Enviar evidencia</small></span></a></nav></article></section>`;
}

async function renderStudentAttendance() {
  content.innerHTML = `${studentHero('chart','Seguimiento personal','Mi asistencia','Visualice su porcentaje, tendencias y alertas. Los registros solo pueden ser ingresados por el Docente.')}<section class="panel student-filter-panel"><div class="student-period-buttons"><button type="button" data-period="day">Hoy</button><button type="button" data-period="week">Semana</button><button type="button" data-period="month">Mes</button><button class="is-active" type="button" data-period="all">Periodo</button></div><form class="connected-filters" id="student-attendance-filters"><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><label>Estado<select name="state"><option value="">Todos los estados</option>${attendanceStatesForFilter().replace('<option>Retiro</option>','')}</select></label><button class="primary-action" type="submit">${icon('scan')} Consultar</button></form></section><div id="student-attendance-results" class="page-spacer"></div>`;
  const form=content.querySelector('#student-attendance-filters'); const host=content.querySelector('#student-attendance-results');
  const setPeriod=(period)=>{const now=new Date(`${localIsoDate()}T12:00:00`);form.elements.to.value=period==='all'?'':localIsoDate();if(period==='day')form.elements.from.value=localIsoDate();else if(period==='week'){now.setDate(now.getDate()-6);form.elements.from.value=now.toISOString().slice(0,10);}else if(period==='month')form.elements.from.value=`${localIsoDate().slice(0,8)}01`;else{form.elements.from.value='';form.elements.to.value='';}content.querySelectorAll('[data-period]').forEach((button)=>button.classList.toggle('is-active',button.dataset.period===period));};
  const load=async()=>{host.innerHTML='<p class="loading-state">Analizando su asistencia…</p>';try{const data=await api(`/api/student/attendance?${new URLSearchParams(new FormData(form))}`);const get=(state)=>data.byState.find((item)=>item.state===state)?.total||0;const max=Math.max(...data.byState.map((item)=>item.total),1);host.innerHTML=`<section class="student-attendance-kpis"><article><span>${icon('chart')}</span><div><small>Asistencia efectiva</small><strong>${data.attendanceRate}%</strong><p>${data.total} registros consultados</p></div></article><article><span>${icon('check')}</span><div><small>Presentes</small><strong>${get('Presente')}</strong><p>registros</p></div></article><article><span>${icon('clock')}</span><div><small>Tardanzas</small><strong>${get('Tardanza')}</strong><p>registros</p></div></article><article><span>${icon('alert')}</span><div><small>Ausencias</small><strong>${get('Ausente')}</strong><p>registros</p></div></article></section><div class="student-attendance-layout"><section class="panel">${panelHeading('Distribución','Estados de asistencia','Comparación del periodo')}<div class="family-state-chart">${data.byState.filter((item)=>item.state!=='Retiro').map((item)=>`<article><span><i data-chart-height="${Math.max(5,Math.round(item.total/max*100))}"></i></span><strong>${item.total}</strong><small>${escapeHtml(item.state)}</small></article>`).join('')}</div></section><section class="panel">${panelHeading('Alertas','Indicadores de riesgo','Recomendaciones personales')}<div class="student-alert-list">${data.alerts.map((item)=>`<article class="${item.tone}"><span>${icon(item.tone==='green'?'check':item.tone==='amber'?'clock':'alert')}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div></article>`).join('')}</div></section></div><section class="panel student-section-panel">${panelHeading('Detalle','Historial personal',`${data.rows.length} registros encontrados`)}${data.rows.length?rowsTable(['Fecha','Curso','Grupo','Estado'],data.rows.map((item)=>`<tr><td>${teacherDate(item.date)}</td><td><strong>${escapeHtml(item.course)}</strong></td><td>${escapeHtml(item.group)}</td><td>${status(item.state)}</td></tr>`)):'<p class="empty-notice">No existen registros para los filtros seleccionados.</p>'}</section>`;applyDynamicStyles(host);enhanceResponsiveTables(host);}catch(error){host.innerHTML=`<section class="panel error-panel"><h2>No fue posible consultar la asistencia</h2><p>${escapeHtml(error.message)}</p></section>`;}};
  content.querySelectorAll('[data-period]').forEach((button)=>button.addEventListener('click',()=>{setPeriod(button.dataset.period);load();})); form.addEventListener('submit',(event)=>{event.preventDefault();load();}); await load();
}

async function renderStudentProfile(settingsOnly = false) {
  let data = await api('/api/student/profile');
  const preferences = ['Asistencia','Boletas','Justificaciones','Avisos','Tutoría'];
  const identityCard = `<section class="student-profile-card"><div class="student-profile-avatar">${data.account.photoUrl ? `<img src="${data.account.photoUrl}?v=${Date.now()}" alt="Foto de ${escapeHtml(data.student.name)}">` : tutorInitials(data.student.name)}</div><div><p class="section-kicker text-on-dark">Identidad académica</p><h2>${escapeHtml(data.student.name)}</h2><p>${escapeHtml(data.student.program)}</p><div><span>${icon('graduation')} ${escapeHtml(data.student.semester)} semestre</span><span>${icon('book')} Grupo ${escapeHtml(data.student.group || 'Sin asignar')}</span><span>${icon('users')} ${escapeHtml(data.student.tutor.name)}</span></div></div><form id="student-photo-form"><label>${icon('student')} Cambiar foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></form></section>`;
  content.innerHTML = `${identityCard}<div class="student-profile-layout page-spacer">${settingsOnly ? '' : `<section class="panel">${panelHeading('Información académica','Datos institucionales','Estos datos son de solo lectura.')}<dl class="student-profile-data"><div><dt>Nombres y apellidos</dt><dd>${escapeHtml(data.student.name)}</dd></div><div><dt>Correo institucional</dt><dd>${escapeHtml(data.account.email)}</dd></div><div><dt>Programa de estudios</dt><dd>${escapeHtml(data.student.program)}</dd></div><div><dt>Semestre y grupo</dt><dd>${escapeHtml(data.student.semester)} · ${escapeHtml(data.student.group||'Sin grupo')}</dd></div><div><dt>Tutor asignado</dt><dd>${escapeHtml(data.student.tutor.name)}</dd></div><div><dt>Estado de matrícula</dt><dd>${status(data.student.state)}</dd></div></dl></section>`}<section class="panel">${panelHeading('Datos autorizados',settingsOnly?'Preferencias y contacto':'Actualizar contacto','Solo puede cambiar su correo personal, teléfono y preferencias.')}<form class="account-form" id="student-profile-form"><label>Correo personal<input name="contactEmail" type="email" value="${escapeHtml(data.account.contactEmail||'')}" required></label><label>Teléfono<input name="phone" value="${escapeHtml(data.account.phone||'')}" maxlength="20" required></label><fieldset class="student-preferences"><legend>Recibir notificaciones de</legend>${preferences.map((item)=>`<label><input name="preferences" type="checkbox" value="${item}" ${data.preferences.includes(item)?'checked':''}><span>${icon(item==='Asistencia'?'check':item==='Boletas'?'scan':item==='Tutoría'?'heart':'bell')} ${item}</span></label>`).join('')}</fieldset><button class="primary-action" type="submit">${icon('check')} Guardar cambios</button><p class="form-message" aria-live="polite"></p></form></section>${settingsOnly ? `<section class="panel">${panelHeading('Seguridad','Cambiar contraseña','Las demás sesiones se cerrarán automáticamente.')}<form class="account-form" id="student-password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="10" required><small>10 caracteres, mayúscula, minúscula, número y símbolo.</small></label><button class="primary-action" type="submit">${icon('shield')} Actualizar contraseña</button><p class="form-message"></p></form><div class="student-session-actions"><button type="button" id="student-theme-action">${icon('settings')} Cambiar tema claro/oscuro</button><button type="button" data-action="logout">${icon('exit')} Cerrar sesión segura</button></div></section>` : ''}</div>`;
  const profileForm=content.querySelector('#student-profile-form'); profileForm.addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const message=form.querySelector('.form-message');const payload={contactEmail:form.elements.contactEmail.value,phone:form.elements.phone.value,preferences:[...form.querySelectorAll('[name="preferences"]:checked')].map((item)=>item.value)};try{const result=await api('/api/student/profile',{method:'PUT',body:JSON.stringify(payload)});message.textContent=result.message;notify(result.message);}catch(error){message.textContent=error.message;notify(error.message,'error');}});
  content.querySelector('#student-photo-form input')?.addEventListener('change',async(event)=>{if(!event.target.files[0])return;const formData=new FormData();formData.append('photo',event.target.files[0]);try{const result=await api('/api/account/photo',{method:'POST',body:formData});notify(result.message);location.reload();}catch(error){notify(error.message,'error');}});
  const passwordForm=content.querySelector('#student-password-form'); passwordForm?.addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const message=form.querySelector('.form-message');try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});message.textContent=result.message;notify(result.message);form.reset();}catch(error){message.textContent=error.message;notify(error.message,'error');}});
  content.querySelector('#student-theme-action')?.addEventListener('click',()=>{document.body.classList.toggle('theme-dark');localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light');});
}

async function renderStudentQr() {
  const [data,access]=await Promise.all([api('/api/student/exits'),api('/api/student/access-qr').catch(()=>null)]);
  const accessCard=access?`<article class="student-access-credential"><div class="student-access-qr"><img src="/api/student/access-qr.svg?date=${encodeURIComponent(access.validDate)}" alt="Código QR diario de acceso de ${escapeHtml(access.student.name)}" width="176" height="176"><span>Válido: ${teacherDate(access.validDate)}</span></div><div><p class="section-kicker">Credencial diaria</p><h3>Un mismo QR para el acceso ordinario</h3><p>Preséntelo al personal de Vigilancia en cada acceso normal. Los retiros especiales deben usar la boleta autorizada por Coordinación.</p><dl><div><dt>Estudiante</dt><dd>${escapeHtml(access.student.name)}</dd></div><div><dt>Programa</dt><dd>${escapeHtml(access.student.program)}</dd></div></dl><small>${icon('shield')} Está firmado por SIGA y vence al terminar el día.</small><div class="student-access-manual"><label for="student-access-manual-code">Código para ingreso manual</label><textarea id="student-access-manual-code" rows="3" readonly spellcheck="false">${escapeHtml(access.code)}</textarea><p>Seleccione y copie el código completo para entregarlo a Vigilancia.</p></div></div></article>`:`<p class="guard-access-compatibility">El QR diario de entrada y salida estará disponible después de reiniciar una vez el servidor de SIGA.</p>`;
  content.innerHTML=`${studentHero('scan','Acceso seguro','Mi QR de entrada y salida','Use la misma credencial diaria en ambos movimientos. Las boletas autorizadas continúan disponibles para salidas especiales.','<span class="student-hero-badge">QR diario</span>')}<section class="panel student-section-panel">${panelHeading('Control institucional','Mi QR diario','Vigilancia escanea el mismo código al ingresar y al retirarse.')} ${accessCard}</section><section class="panel student-section-panel">${panelHeading('Salida especial autorizada','Boletas QR disponibles','Estas boletas se usan únicamente cuando Coordinación autoriza una solicitud de salida.')} ${studentExitCards(data.items,true)}</section><section class="student-qr-help"><span>${icon('shield')}</span><div><strong>Funcionamiento automático</strong><p>El primer escaneo ordinario registra entrada y el siguiente registra salida. Si existe un retiro especial autorizado, Vigilancia debe escanear la boleta oficial en “Validar salida”.</p></div></section>`;
}

async function renderStudentJustifications() {
  let data=await api('/api/student/justifications');
  content.innerHTML=`${studentHero('file','Sustento académico','Justificaciones','Envíe una justificación por ausencia o tardanza y consulte la respuesta institucional.')}<div class="student-justification-layout page-spacer"><section class="panel student-form-panel">${panelHeading('Nuevo envío','Registrar justificación','Puede adjuntar una imagen o PDF de hasta 5 MB.')}<form class="account-form" id="student-justification-form"><div class="form-pair"><label>Tipo<select name="type"><option>Ausencia</option><option>Tardanza</option></select></label><label>Motivo<input name="reason" maxlength="120" required></label></div><div class="form-pair"><label>Desde<input name="startDate" type="date" value="${localIsoDate()}" required></label><label>Hasta<input name="endDate" type="date" value="${localIsoDate()}" required></label></div><label>Descripción<textarea name="description" rows="4" maxlength="700" required></textarea></label><label>Evidencia adjunta<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small>Opcional · imagen o PDF</small></label><button class="primary-action" type="submit">${icon('send')} Enviar a Tutoría</button><p class="form-message"></p></form></section><section class="panel">${panelHeading('Seguimiento','Mis justificaciones','Estados y comentarios del Tutor o Coordinador')}<div id="student-justification-list"></div></section></div>`;
  const list=content.querySelector('#student-justification-list');
  const draw=()=>{
    if (!data.items.length) {
      list.innerHTML=`<div class="student-empty"><span>${icon('file')}</span><h3>Sin justificaciones</h3><p>Sus envíos aparecerán aquí.</p></div>`;
      return;
    }
    list.innerHTML=data.items.map((item)=>{
      const start=item.startDate||item.date;
      const period=item.endDate&&item.endDate!==start?`${teacherDate(start)} al ${teacherDate(item.endDate)}`:teacherDate(start);
      const evidence=item.evidenceName?`<a href="/api/student/justifications/${encodeURIComponent(item.id)}/evidence" target="_blank" rel="noopener">${escapeHtml(item.evidenceName)}</a>`:'Sin archivo';
      const observation=item.observation?`<blockquote><strong>Comentario institucional</strong>${escapeHtml(item.observation)}</blockquote>`:'';
      return `<article class="student-justification-card"><header><span><small>${escapeHtml(item.id)}</small><strong>${escapeHtml(item.type||'Justificación')}</strong></span>${status(item.status)}</header><h3>${escapeHtml(item.reason)}</h3><p>${escapeHtml(item.description||'Sin descripción adicional')}</p><dl><div><dt>Periodo</dt><dd>${period}</dd></div><div><dt>Evidencia</dt><dd>${evidence}</dd></div></dl>${observation}</article>`;
    }).join('');
  };
  draw();
  content.querySelector('#student-justification-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');const message=form.querySelector('.form-message');button.disabled=true;message.textContent='Enviando justificación…';try{const result=await api('/api/student/justifications',{method:'POST',body:new FormData(form)});notify(result.message);form.reset();form.elements.startDate.value=localIsoDate();form.elements.endDate.value=localIsoDate();data=await api('/api/student/justifications');draw();message.textContent=result.message;}catch(error){message.textContent=error.message;notify(error.message,'error');}finally{button.disabled=false;}});
}

async function renderStudentNotices() {
  let data=await api('/api/student/notices');
  content.innerHTML=`${studentHero('bell','Centro de información','Avisos y notificaciones','Consulte asistencia, solicitudes, reuniones y comunicaciones dirigidas únicamente a su cuenta.','<span class="student-hero-badge" id="student-unread-badge">${data.unread} sin leer</span>')}<section class="panel student-section-panel">${panelHeading('Bandeja personal','Comunicaciones recientes','Marque cada aviso como leído cuando lo revise.')}<div class="student-notice-list" id="student-notice-list"></div></section>`;
  const list=content.querySelector('#student-notice-list');
  const draw=()=>{
    content.querySelector('#student-unread-badge').textContent=`${data.unread} sin leer`;
    if (!data.items.length) {
      list.innerHTML=`<div class="student-empty"><span>${icon('bell')}</span><h3>Sin comunicaciones</h3><p>No hay avisos disponibles para su cuenta.</p></div>`;
      return;
    }
    list.innerHTML=data.items.map((item)=>{
      const action=item.read?'':`<button type="button" data-notice-read="${escapeHtml(item.id)}">Marcar leído</button>`;
      const date=new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.date));
      return `<article class="${item.read?'':'is-unread'}"><span>${icon(item.read?'check':'bell')}</span><div><header><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.audience||'Personal')}</small></header><p>${escapeHtml(item.message)}</p><time>${date}</time></div>${action}</article>`;
    }).join('');
  };
  draw();
  list.addEventListener('click',async(event)=>{const button=event.target.closest('[data-notice-read]');if(!button)return;button.disabled=true;try{await api(`/api/student/notices/${encodeURIComponent(button.dataset.noticeRead)}/read`,{method:'PATCH'});data=await api('/api/student/notices');draw();}catch(error){button.disabled=false;notify(error.message,'error');}});
}

async function renderStudentFollowUp() {
  const data=await api('/api/student/follow-up');
  const meetings=data.meetings.length?data.meetings.map((item)=>{
    const agreements=item.agreements?`<blockquote><b>Acuerdos</b>${escapeHtml(item.agreements)}</blockquote>`:'';
    const followUp=item.followUp?`<small>Próxima acción: ${escapeHtml(item.followUp)}</small>`:'';
    return `<article><time><strong>${teacherDate(item.date)}</strong><small>${escapeHtml(item.time)}</small></time><span>${icon('calendar')}</span><div><header><strong>${escapeHtml(item.topic)}</strong>${status(item.status)}</header><p>${escapeHtml(item.modality)} · ${escapeHtml(item.responsible)}</p>${agreements}${followUp}</div></article>`;
  }).join(''):'<p class="empty-notice">No tiene reuniones registradas.</p>';
  const cases=data.cases.length?data.cases.map((item)=>`<article><header><span>${icon('graduation')} ${escapeHtml(item.type)}</span>${status(item.status)}</header><p>${escapeHtml(item.actions||'Sin acciones comunicadas')}</p><dl><div><dt>Responsable</dt><dd>${escapeHtml(item.responsible)}</dd></div><div><dt>Próximo seguimiento</dt><dd>${item.nextFollowUp?teacherDate(item.nextFollowUp):'Por coordinar'}</dd></div></dl></article>`).join(''):`<div class="student-empty"><span>${icon('check')}</span><h3>Sin seguimientos compartidos</h3><p>No existen casos autorizados para mostrar.</p></div>`;
  const tutorBadge=`<span class="student-hero-badge">Tutor · ${escapeHtml(data.tutor.name)}</span>`;
  content.innerHTML=`${studentHero('heart','Acompañamiento autorizado','Tutoría y permanencia','Solo se muestran acuerdos, compromisos y seguimientos compartidos expresamente con usted.',tutorBadge)}<div class="student-followup-layout page-spacer"><section class="panel">${panelHeading('Agenda de tutoría','Reuniones y acuerdos','Próximos compromisos registrados')}<div class="student-meeting-list">${meetings}</div></section><section class="panel">${panelHeading('Permanencia','Seguimientos compartidos','No se muestran observaciones internas del personal')}<div class="student-case-list">${cases}</div></section></div>`;
}

async function renderStudentClasses() {
  const initial=await api('/api/student/classes');
  content.innerHTML=`${studentHero('book','Agenda académica','Mi horario','Revise cursos, docentes, aulas y horarios correspondientes únicamente a su matrícula.')}<section class="panel student-filter-panel"><form class="connected-filters" id="student-class-filters"><label>Día<select name="day"><option value="">Toda la semana</option>${initial.days.map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Periodo<select name="period"><option value="">Periodo actual</option>${initial.periods.map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><button class="primary-action" type="submit">${icon('scan')} Filtrar horario</button></form></section><section class="student-schedule" id="student-schedule"></section>`;
  const form=content.querySelector('#student-class-filters');
  const host=content.querySelector('#student-schedule');
  const draw=(items)=>{
    if (!items.length) {
      host.innerHTML=`<div class="student-empty"><span>${icon('calendar')}</span><h3>Sin clases para este filtro</h3><p>Pruebe con otro día o periodo.</p></div>`;
      return;
    }
    host.innerHTML=items.map((item)=>`<article><header><span>${escapeHtml(item.day)}</span><strong>${escapeHtml(item.schedule)}</strong></header><div class="student-course-icon">${icon('book')}</div><div><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.course)}</h3><p>${escapeHtml(item.teacher)}</p><dl><span>${icon('graduation')} ${escapeHtml(item.group)}</span><span>${icon('grid')} ${escapeHtml(item.room)}</span><span>${icon('check')} ${escapeHtml(item.modality)}</span></dl></div></article>`).join('');
  };
  draw(initial.items);
  form.addEventListener('submit',async(event)=>{event.preventDefault();try{const data=await api(`/api/student/classes?${new URLSearchParams(new FormData(form))}`);draw(data.items);}catch(error){notify(error.message,'error');}});
}

const attendanceStatesForFilter = () => ['Presente','Tardanza','Ausente','Permiso','Retiro'].map((item)=>`<option>${item}</option>`).join('');

async function renderConnectedNotices(endpoint, titleText, subtitleText) {
  const data=await api(endpoint);
  content.innerHTML=`<section class="panel">${panelHeading('Comunicaciones',titleText,subtitleText)}<div class="connected-notice-list page-spacer">${data.items.length?data.items.map((item)=>`<article><span>${icon('bell')}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${escapeHtml(item.audience||'Institucional')}</small><time>${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.date))}</time></div></article>`).join(''):'<p class="empty-notice">No hay comunicaciones disponibles.</p>'}</div></section>`;
}

async function renderParentDashboard() {
  const data=await api('/api/parent/dashboard');
  const childCards=data.children.map((item)=>`<article class="family-dashboard-card"><header><span class="family-avatar">${tutorInitials(item.name)}</span><div><small>${escapeHtml(item.program)}</small><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.semester)} semestre · ${escapeHtml(item.group||'Sin grupo')}</p></div>${status(item.state)}</header><div class="family-today-state"><span>${icon(item.todayAttendance==='Presente'?'check':item.todayAttendance==='Tardanza'?'clock':item.todayAttendance==='Ausente'?'alert':'calendar')}</span><div><small>Asistencia de hoy</small><strong>${escapeHtml(item.todayAttendance)}</strong></div></div><div class="family-alert ${item.alerts[0]?.tone||'green'}"><b>${icon(item.alerts[0]?.tone==='red'?'alert':'bell')}</b><span><strong>${escapeHtml(item.alerts[0]?.title||'Seguimiento al día')}</strong><small>${escapeHtml(item.alerts[0]?.message||'Sin alertas pendientes.')}</small></span></div><dl class="family-mini-stats"><div><dt>Pendientes</dt><dd>${item.exitSummary.pending}</dd></div><div><dt>Aprobadas</dt><dd>${item.exitSummary.approved}</dd></div><div><dt>Rechazadas</dt><dd>${item.exitSummary.rejected}</dd></div></dl><div class="family-next-meeting"><span>${icon('calendar')}</span><div><small>Próxima reunión</small><strong>${item.nextMeeting?`${teacherDate(item.nextMeeting.date)} · ${escapeHtml(item.nextMeeting.time)}`:'Sin reuniones próximas'}</strong></div></div><footer><a href="${pageHref('padre','asistencia')}?student=${encodeURIComponent(item.id)}">${icon('check')} Asistencia</a><a href="${pageHref('padre','justificaciones')}?student=${encodeURIComponent(item.id)}">${icon('file')} Justificar</a><a href="${pageHref('padre','boletas')}?student=${encodeURIComponent(item.id)}">${icon('exit')} Boletas</a><a href="${pageHref('padre','avisos')}?student=${encodeURIComponent(item.id)}">${icon('bell')} Mensajes</a></footer></article>`).join('');
  content.innerHTML=`<section class="parent-hero"><div><span class="parent-live"><i></i> Portal familiar protegido</span><h2>Hola, ${escapeHtml(data.parent.name.split(' ')[0])}</h2><p>Acompañe la jornada académica de sus estudiantes desde un espacio seguro y fácil de entender.</p><div class="parent-hero-tags"><span>${icon('shield')} Vínculo familiar verificado</span><span>${icon('users')} ${data.children.length} estudiante${data.children.length===1?'':'s'} vinculado${data.children.length===1?'':'s'}</span></div></div><aside><span>${icon('bell')}</span><strong>${data.notices.filter((item)=>!item.read).length}</strong><p>avisos recientes</p><a href="${pageHref('padre','avisos')}">Revisar mensajes →</a></aside></section><section class="summary-section-heading"><div><p class="section-kicker">Resumen familiar</p><h2>Estado de sus estudiantes</h2></div><span>Actualización institucional</span></section><div class="family-dashboard-grid">${childCards||'<section class="panel"><p class="empty-notice">No hay estudiantes vinculados a esta cuenta. Comuníquese con Secretaría.</p></section>'}</div><section class="family-quick-panel"><div><p class="section-kicker">Accesos rápidos</p><h2>¿Qué desea consultar?</h2></div><nav><a href="${pageHref('padre','asistencia')}">${icon('check')}<span><strong>Asistencia</strong><small>Presencias, tardanzas y ausencias</small></span></a><a href="${pageHref('padre','justificaciones')}">${icon('file')}<span><strong>Justificar</strong><small>Enviar sustento a Tutoría</small></span></a><a href="${pageHref('padre','boletas')}">${icon('exit')}<span><strong>Boletas</strong><small>Consultar decisiones de Coordinación</small></span></a><a href="${pageHref('padre','avisos')}">${icon('bell')}<span><strong>Mensajes</strong><small>Avisos y comunicaciones</small></span></a></nav></section>`;
}

async function renderParentChildren() {
  const data=await api('/api/parent/children');
  content.innerHTML=`<section class="parent-section-hero"><span>${icon('family')}</span><div><p class="section-kicker text-on-dark">Vínculos autorizados</p><h2>Mis hijos o estudiantes</h2><p>Esta lista se genera únicamente con los vínculos familiares registrados por el instituto.</p></div><b>${data.items.length} vinculado${data.items.length===1?'':'s'}</b></section><section class="family-children-grid page-spacer">${data.items.map((item)=>`<article class="family-child-card"><header><span>${tutorInitials(item.name)}</span>${status(item.state)}</header><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.program)}</p><dl><div><dt>Semestre y grupo</dt><dd>${escapeHtml(item.semester)} · ${escapeHtml(item.group||'Sin grupo')}</dd></div><div><dt>Tutor asignado</dt><dd>${escapeHtml(item.tutor)}</dd></div><div><dt>Estado de matrícula</dt><dd>${escapeHtml(item.state)}</dd></div><div><dt>Asistencia acumulada</dt><dd>${item.attendance.attendanceRate}%</dd></div></dl><footer><a class="primary-action" href="${pageHref('padre','asistencia')}?student=${encodeURIComponent(item.id)}">Consultar su información</a></footer></article>`).join('')||'<section class="panel"><p class="empty-notice">No existen estudiantes vinculados.</p></section>'}</section>`;
}

async function renderParentAttendance() {
  const initial=await api('/api/parent/attendance');
  const requested=new URLSearchParams(window.location.search).get('student')||'';
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('chart')}</span><div><p class="section-kicker text-on-dark">Seguimiento diario</p><h2>Asistencia académica</h2><p>Consulte tendencias y alertas sin modificar los registros del Docente.</p></div></section><section class="panel parent-filter-panel">${panelHeading('Filtros','Seleccione un estudiante y periodo','Solo se mostrarán estudiantes vinculados a su cuenta.')}<div class="family-period-buttons"><button type="button" data-period="day">Hoy</button><button type="button" data-period="week">Últimos 7 días</button><button type="button" data-period="month">Este mes</button><button type="button" data-period="all" class="is-active">Periodo académico</button></div><form class="connected-filters" id="parent-attendance-filters"><label>Estudiante<select name="student"><option value="">Todos mis estudiantes</option>${initial.students.map((item)=>`<option value="${item.id}" ${item.id===requested?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><label>Estado<select name="state"><option value="">Todos los estados</option>${attendanceStatesForFilter().replace('<option>Retiro</option>','')}</select></label><button class="primary-action" type="submit">${icon('scan')} Consultar</button></form></section><div id="parent-attendance-results" class="page-spacer"></div>`;
  const form=content.querySelector('#parent-attendance-filters');const host=content.querySelector('#parent-attendance-results');
  const setPeriod=(period)=>{const now=new Date(`${localIsoDate()}T12:00:00`);form.elements.to.value=period==='all'?'':localIsoDate();if(period==='day')form.elements.from.value=localIsoDate();else if(period==='week'){now.setDate(now.getDate()-6);form.elements.from.value=now.toISOString().slice(0,10);}else if(period==='month')form.elements.from.value=`${localIsoDate().slice(0,8)}01`;else{form.elements.from.value='';form.elements.to.value='';}content.querySelectorAll('[data-period]').forEach((button)=>button.classList.toggle('is-active',button.dataset.period===period));};
  const draw=async()=>{host.innerHTML='<p class="loading-state">Analizando la asistencia…</p>';try{const data=await api(`/api/parent/attendance?${new URLSearchParams(new FormData(form))}`);const get=(state)=>data.byState.find((item)=>item.state===state)?.total||0;const max=Math.max(...data.byState.map((item)=>item.total),1);host.innerHTML=`<section class="family-attendance-kpis"><article><span>${icon('chart')}</span><div><small>Asistencia efectiva</small><strong>${data.attendanceRate}%</strong><p>${data.total} registros consultados</p></div></article><article><span>${icon('check')}</span><div><small>Presentes</small><strong>${get('Presente')}</strong><p>Registros del periodo</p></div></article><article><span>${icon('clock')}</span><div><small>Tardanzas</small><strong>${get('Tardanza')}</strong><p>Requieren puntualidad</p></div></article><article><span>${icon('alert')}</span><div><small>Ausencias</small><strong>${get('Ausente')}</strong><p>Registros a revisar</p></div></article></section><div class="family-attendance-layout"><section class="panel">${panelHeading('Distribución','Tendencia de asistencia','Comparación por estado')}<div class="family-state-chart">${data.byState.filter((item)=>item.state!=='Retiro').map((item)=>`<article><span><i data-chart-height="${Math.max(5,Math.round(item.total/max*100))}"></i></span><strong>${item.total}</strong><small>${escapeHtml(item.state)}</small></article>`).join('')}</div></section><section class="panel">${panelHeading('Alertas','Atención familiar','Señales calculadas a partir del periodo')}<div class="family-alert-list">${data.alerts.map((item)=>`<article class="${item.tone}"><span>${icon(item.tone==='red'?'alert':item.tone==='amber'?'clock':'check')}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div></article>`).join('')}</div></section></div><section class="panel page-spacer">${panelHeading('Detalle','Historial consultado',`${data.rows.length} registros encontrados`)}${data.rows.length?rowsTable(['Estudiante','Fecha','Curso','Grupo','Estado'],data.rows.map((item)=>`<tr><td><strong>${escapeHtml(item.student)}</strong></td><td>${teacherDate(item.date)}</td><td>${escapeHtml(item.course)}</td><td>${escapeHtml(item.group)}</td><td>${status(item.state)}</td></tr>`)):'<p class="empty-notice">No hay registros para los filtros seleccionados.</p>'}</section>`;applyDynamicStyles(host);}catch(error){host.innerHTML=`<section class="panel error-panel"><h2>No fue posible consultar la asistencia</h2><p>${escapeHtml(error.message)}</p></section>`;}};
  content.querySelectorAll('[data-period]').forEach((button)=>button.addEventListener('click',()=>{setPeriod(button.dataset.period);draw();}));form.addEventListener('submit',(event)=>{event.preventDefault();draw();});await draw();
}

async function renderParentJustifications() {
  let data=await api('/api/parent/justifications');
  const requested=new URLSearchParams(window.location.search).get('student')||'';
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('file')}</span><div><p class="section-kicker text-on-dark">Sustento familiar</p><h2>Justificaciones</h2><p>Envíe información verificable y consulte la respuesta de Tutoría o Coordinación.</p></div></section><div class="family-justification-layout page-spacer"><section class="panel family-form-panel">${panelHeading('Nueva justificación','Registrar ausencia o tardanza','Todos los envíos quedan auditados.')}<form class="account-form" id="parent-justification-form"><label>Estudiante<select name="studentId" required>${data.students.map((item)=>`<option value="${item.id}" ${item.id===requested?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><div class="form-pair"><label>Tipo<select name="type" required><option>Ausencia</option><option>Tardanza</option></select></label><label>Motivo<input name="reason" maxlength="120" placeholder="Ej. Salud o emergencia familiar" required></label></div><div class="form-pair"><label>Desde<input name="startDate" type="date" value="${localIsoDate()}" max="${localIsoDate()}" required></label><label>Hasta<input name="endDate" type="date" value="${localIsoDate()}" max="${localIsoDate()}" required></label></div><label>Descripción<textarea name="description" rows="4" maxlength="700" placeholder="Explique brevemente lo ocurrido" required></textarea></label><label>Evidencia adjunta<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small>Imagen o PDF · máximo 5 MB</small></label><label>Teléfono o correo de contacto<input name="contact" value="${escapeHtml(currentUser.phone||currentUser.email)}" maxlength="120" required></label><button class="primary-action" type="submit">${icon('send')} Enviar a Tutoría</button><p class="form-message" aria-live="polite"></p></form></section><section class="panel">${panelHeading('Seguimiento','Solicitudes enviadas','Estados y comentarios institucionales')}<div id="parent-justification-list"></div></section></div>`;
  const list=content.querySelector('#parent-justification-list');const draw=()=>{list.innerHTML=data.items.length?data.items.map((item)=>`<article class="family-justification-card"><header><span><small>${escapeHtml(item.id)}</small><strong>${escapeHtml(item.student)}</strong></span>${status(item.status)}</header><dl><div><dt>Tipo y motivo</dt><dd>${escapeHtml(item.type||'Justificación')} · ${escapeHtml(item.reason)}</dd></div><div><dt>Periodo</dt><dd>${teacherDate(item.startDate||item.date)}${item.endDate&&item.endDate!==(item.startDate||item.date)?` al ${teacherDate(item.endDate)}`:''}</dd></div></dl>${item.description?`<p>${escapeHtml(item.description)}</p>`:''}${item.evidenceName?`<a href="/api/parent/justifications/${encodeURIComponent(item.id)}/evidence" target="_blank" rel="noopener">${icon('file')} Ver evidencia: ${escapeHtml(item.evidenceName)}</a>`:''}${item.observation?`<blockquote><strong>Comentario institucional</strong>${escapeHtml(item.observation)}</blockquote>`:''}</article>`).join(''):'<p class="empty-notice">Todavía no ha enviado justificaciones.</p>';enhanceResponsiveTables(list);};draw();content.querySelector('#parent-justification-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const message=form.querySelector('.form-message');const button=form.querySelector('button[type="submit"]');button.disabled=true;message.textContent='Enviando justificación…';try{const result=await api('/api/parent/justifications',{method:'POST',body:new FormData(form)});notify(result.message);form.reset();form.elements.startDate.value=localIsoDate();form.elements.endDate.value=localIsoDate();form.elements.contact.value=currentUser.phone||currentUser.email;data=await api('/api/parent/justifications');draw();message.textContent=result.message;}catch(error){message.textContent=error.message;notify(error.message,'error');}finally{button.disabled=false;}});
}

async function renderParentMeetings() {
  let data=await api('/api/parent/meetings');
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('calendar')}</span><div><p class="section-kicker text-on-dark">Agenda familiar</p><h2>Reuniones de Tutoría</h2><p>Confirme su participación o solicite una nueva fecha cuando sea necesario.</p></div></section><section class="panel page-spacer">${panelHeading('Próximos encuentros','Reuniones programadas','Los acuerdos aparecerán después de cada reunión.')}<div class="family-meeting-list" id="family-meeting-list"></div></section><dialog class="record-dialog family-dialog" id="meeting-reschedule-dialog"><form method="dialog"><button class="dialog-close" value="cancel" aria-label="Cerrar">×</button></form><form class="account-form" id="meeting-reschedule-form"><input type="hidden" name="id"><p class="section-kicker">Solicitud de cambio</p><h2>Reprogramar reunión</h2><label>Nueva fecha propuesta<input name="proposedDate" type="date" min="${localIsoDate()}" required></label><label>Motivo<textarea name="message" rows="4" maxlength="400" required></textarea></label><button class="primary-action" type="submit">Enviar solicitud</button><p class="form-message"></p></form></dialog>`;
  const list=content.querySelector('#family-meeting-list');const dialog=content.querySelector('#meeting-reschedule-dialog');const draw=()=>{list.innerHTML=data.items.length?data.items.map((item)=>`<article class="family-meeting-card"><span class="family-meeting-date"><b>${teacherDate(item.date).split(' ')[0]}</b><small>${teacherDate(item.date)}</small></span><div><header><span>${escapeHtml(item.student)}</span>${status(item.status)}</header><h3>${escapeHtml(item.topic)}</h3><p>${icon('calendar')} ${escapeHtml(item.modality)} · ${escapeHtml(item.time)} · ${escapeHtml(item.responsible)}</p><dl><div><dt>Motivo</dt><dd>${escapeHtml(item.topic)}</dd></div><div><dt>Acuerdos</dt><dd>${escapeHtml(item.agreements||'Se registrarán después de la reunión.')}</dd></div>${item.followUp?`<div><dt>Seguimiento</dt><dd>${escapeHtml(item.followUp)}</dd></div>`:''}</dl></div><footer>${item.canConfirm?`<button class="primary-action" type="button" data-meeting-confirm="${item.id}">${icon('check')} Confirmar</button>`:''}<button class="secondary-action" type="button" ${item.canReschedule?'':'disabled aria-disabled="true"'} data-meeting-reschedule="${item.id}">${icon('calendar')} Reprogramar</button></footer></article>`).join(''):'<p class="empty-notice">No existen reuniones programadas.</p>';};draw();list.addEventListener('click',async(event)=>{const confirmButton=event.target.closest('[data-meeting-confirm]');const rescheduleButton=event.target.closest('[data-meeting-reschedule]');if(confirmButton){if(!await confirmAction('¿Confirma su asistencia a esta reunión?'))return;try{const result=await api(`/api/parent/meetings/${confirmButton.dataset.meetingConfirm}`,{method:'PATCH',body:JSON.stringify({action:'Confirmar'})});notify(result.message);data=await api('/api/parent/meetings');draw();}catch(error){notify(error.message,'error');}}if(rescheduleButton){const form=content.querySelector('#meeting-reschedule-form');form.reset();form.elements.id.value=rescheduleButton.dataset.meetingReschedule;form.elements.proposedDate.min=localIsoDate();dialog.showModal();}});content.querySelector('#meeting-reschedule-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api(`/api/parent/meetings/${form.elements.id.value}`,{method:'PATCH',body:JSON.stringify({action:'Reprogramar',proposedDate:form.elements.proposedDate.value,message:form.elements.message.value})});notify(result.message);dialog.close();data=await api('/api/parent/meetings');draw();}catch(error){form.querySelector('.form-message').textContent=error.message;}});
}

async function renderParentExits() {
  const data=await api('/api/parent/exits');const requested=new URLSearchParams(window.location.search).get('student')||'';
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('exit')}</span><div><p class="section-kicker text-on-dark">Consulta sin autorización</p><h2>Solicitudes y boletas de salida</h2><p>El estudiante solicita, Coordinación decide y Vigilancia valida la salida física.</p></div></section><section class="family-flow-strip"><article><span>${icon('student')}</span><div><small>Paso 1</small><strong>Estudiante solicita</strong></div></article><article><span>${icon('shield')}</span><div><small>Paso 2</small><strong>Coordinación decide</strong></div></article><article><span>${icon('scan')}</span><div><small>Paso 3</small><strong>Vigilancia valida</strong></div></article></section><section class="panel page-spacer">${panelHeading('Seguimiento','Estado de las solicitudes','El apoderado únicamente consulta; no puede aprobar ni generar boletas.')}<div class="family-boleta-toolbar"><label>Estudiante<select id="family-exit-student"><option value="">Todos mis estudiantes</option>${data.students.map((item)=>`<option value="${item.id}" ${item.id===requested?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Estado<select id="family-exit-status"><option value="">Todos los estados</option><option>Pendiente</option><option>Aprobada</option><option>Rechazada</option><option>Usada</option><option>Vencida</option></select></label></div><div class="family-boleta-list" id="family-boleta-list"></div></section>`;
  const list=content.querySelector('#family-boleta-list');const draw=()=>{const student=content.querySelector('#family-exit-student').value;const state=content.querySelector('#family-exit-status').value;const items=data.items.filter((item)=>(!student||item.studentId===student)&&(!state||item.displayStatus===state));list.innerHTML=items.length?items.map((item)=>`<article class="family-boleta-card"><header><span><small>${escapeHtml(item.id)}</small><strong>${escapeHtml(item.student)}</strong></span>${status(item.displayStatus)}</header><div class="family-boleta-main"><span>${icon('calendar')}</span><dl><div><dt>Fecha y hora</dt><dd>${teacherDate(item.date)} · ${escapeHtml(item.time)}</dd></div><div><dt>Motivo</dt><dd>${escapeHtml(item.reason)}</dd></div><div><dt>Decisión de Coordinación</dt><dd>${escapeHtml(item.decisionReason||item.authorizedBy||'Pendiente de evaluación')}</dd></div></dl></div><footer><span>${item.displayStatus==='Aprobada'?'La aprobación generó una boleta oficial.':item.displayStatus==='Usada'?'Salida validada por Vigilancia.':item.displayStatus==='Vencida'?'La vigencia de esta boleta terminó.':'Esta solicitud aún no autoriza la salida.'}</span>${item.hasQr?`<a href="${pageHref('padre','qr-salida')}?id=${encodeURIComponent(item.id)}">${icon('scan')} Ver QR</a>`:''}</footer></article>`).join(''):'<p class="empty-notice">No hay solicitudes con esos filtros.</p>';};content.querySelector('#family-exit-student').addEventListener('change',draw);content.querySelector('#family-exit-status').addEventListener('change',draw);draw();
}

async function renderParentQr() {
  const data=await api('/api/parent/exits');const qrItems=data.items.filter((item)=>item.hasQr);const requested=new URLSearchParams(window.location.search).get('id')||qrItems[0]?.id||'';
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('scan')}</span><div><p class="section-kicker text-on-dark">Boleta oficial</p><h2>QR de salida</h2><p>Presente este código únicamente en el control de Vigilancia.</p></div></section><section class="panel page-spacer">${panelHeading('Documento digital','Seleccione una boleta','Solo se muestran boletas generadas por Coordinación.')}<label class="family-qr-select">Boleta autorizada<select id="family-qr-select">${qrItems.map((item)=>`<option value="${item.id}" ${item.id===requested?'selected':''}>${escapeHtml(item.id)} · ${escapeHtml(item.student)} · ${teacherDate(item.date)}</option>`).join('')}</select></label><div id="family-qr-view"></div></section>`;
  const view=content.querySelector('#family-qr-view');const select=content.querySelector('#family-qr-select');const draw=()=>{const item=qrItems.find((record)=>record.id===select.value);if(!item){view.innerHTML='<p class="empty-notice">No existen boletas QR disponibles.</p>';return;}const valid=item.displayStatus==='Aprobada';view.innerHTML=`<article class="family-qr-card ${valid?'is-valid':'is-expired'}"><div class="family-qr-code"><img src="/api/parent/exits/${encodeURIComponent(item.id)}/qr.svg" alt="Código QR de la boleta ${escapeHtml(item.id)}"><span>${escapeHtml(item.id)}</span></div><div class="family-qr-copy"><span class="family-validity">${icon(valid?'check':'clock')} ${valid?'Boleta vigente':item.displayStatus}</span><h3>${escapeHtml(item.student)}</h3><p>${escapeHtml(item.program)}</p><dl><div><dt>Fecha autorizada</dt><dd>${teacherDate(item.date)}</dd></div><div><dt>Hora</dt><dd>${escapeHtml(item.time)}</dd></div><div><dt>Motivo</dt><dd>${escapeHtml(item.reason)}</dd></div><div><dt>Estado</dt><dd>${escapeHtml(item.displayStatus)}</dd></div></dl><div class="family-qr-warning">${icon('shield')}<span><strong>Validación obligatoria</strong><small>El vigilante debe escanear este QR al momento de la salida. El apoderado no puede validarlo.</small></span></div></div></article>`;};if(select){select.addEventListener('change',draw);draw();}else view.innerHTML='<p class="empty-notice">No existen boletas QR disponibles.</p>';
}

async function renderParentNotices() {
  let data=await api('/api/parent/notices');
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('bell')}</span><div><p class="section-kicker text-on-dark">Centro de comunicaciones</p><h2>Avisos y notificaciones</h2><p>Asistencia, reuniones, justificaciones y comunicados en un solo lugar.</p></div><b id="family-unread-count">${data.unread} sin leer</b></section><section class="panel page-spacer">${panelHeading('Bandeja familiar','Mensajes recientes','Marque como leído cada aviso cuando lo revise.')}<div class="family-notice-filters"><button type="button" class="is-active" data-notice-filter="all">Todos</button><button type="button" data-notice-filter="unread">Sin leer</button><button type="button" data-notice-filter="institutional">Institucionales</button></div><div class="family-notice-feed" id="family-notice-feed"></div></section>`;
  const feed=content.querySelector('#family-notice-feed');let filter='all';const draw=()=>{const items=data.items.filter((item)=>filter==='all'||filter==='unread'&&!item.read||filter==='institutional'&&item.audience==='Todos');feed.innerHTML=items.length?items.map((item)=>`<article class="${item.read?'is-read':'is-unread'}"><span>${icon(item.title.toLowerCase().includes('reunión')?'calendar':item.title.toLowerCase().includes('salida')?'exit':'bell')}</span><div><header><strong>${escapeHtml(item.title)}</strong>${!item.read?'<i>Nuevo</i>':''}</header><p>${escapeHtml(item.message)}</p><small>${item.student?`${escapeHtml(item.student)} · `:''}${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.date))}</small></div>${!item.read?`<button type="button" data-notice-read="${item.id}">${icon('check')} Marcar leído</button>`:''}</article>`).join(''):'<p class="empty-notice">No hay avisos en esta vista.</p>';};content.querySelectorAll('[data-notice-filter]').forEach((button)=>button.addEventListener('click',()=>{filter=button.dataset.noticeFilter;content.querySelectorAll('[data-notice-filter]').forEach((item)=>item.classList.toggle('is-active',item===button));draw();}));feed.addEventListener('click',async(event)=>{const button=event.target.closest('[data-notice-read]');if(!button)return;try{const result=await api(`/api/parent/notices/${button.dataset.noticeRead}/read`,{method:'PATCH'});notify(result.message);data=await api('/api/parent/notices');content.querySelector('#family-unread-count').textContent=`${data.unread} sin leer`;draw();}catch(error){notify(error.message,'error');}});draw();
}

async function renderParentFollowUp() {
  const data=await api('/api/parent/follow-up');
  content.innerHTML=`<section class="parent-section-hero compact"><span>${icon('graduation')}</span><div><p class="section-kicker text-on-dark">Permanencia estudiantil</p><h2>Seguimiento compartido</h2><p>Solo se muestran observaciones y compromisos autorizados para la familia.</p></div></section><section class="family-privacy-note">${icon('lock')}<span><strong>Privacidad protegida</strong><small>Los casos internos y la información confidencial no aparecen en este espacio.</small></span></section><section class="family-follow-grid page-spacer">${data.items.map((item)=>`<article class="family-follow-card"><header><span>${escapeHtml(item.type)}</span>${status(item.status)}</header><h3>${escapeHtml(item.student)}</h3><p>${teacherDate(item.date)} · ${escapeHtml(item.responsible)}</p><dl><div><dt>Acciones acordadas</dt><dd>${escapeHtml(item.actions||'Sin acciones compartidas')}</dd></div><div><dt>Próximo seguimiento</dt><dd>${item.nextFollowUp?teacherDate(item.nextFollowUp):'Por definir'}</dd></div></dl><footer>${icon('shield')} Información autorizada por el instituto</footer></article>`).join('')||'<section class="panel"><p class="empty-notice">No hay seguimientos autorizados para compartir.</p></section>'}</section>`;
}

async function renderParentAccount() {
  const data=await api('/api/parent/profile');const options=['Asistencia','Boletas','Justificaciones','Reuniones','Avisos'];const portrait=data.user.photoUrl?`<img src="${data.user.photoUrl}?v=${Date.now()}" alt="Foto de ${escapeHtml(data.user.name)}">`:`<span>${tutorInitials(data.user.name)}</span>`;
  content.innerHTML=`<section class="parent-profile-hero"><div class="parent-profile-avatar" id="parent-profile-avatar">${portrait}</div><div><p class="section-kicker text-on-dark">Cuenta familiar</p><h2>${escapeHtml(data.user.name)}</h2><p>${escapeHtml(data.user.position||'Padre o apoderado')} · ${data.linkedStudents} estudiante${data.linkedStudents===1?'':'s'} vinculado${data.linkedStudents===1?'':'s'}</p></div><div class="role-profile-actions"><form class="role-photo-form" id="parent-photo-form"><input id="parent-photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden required><label class="secondary-action" for="parent-photo-input">${icon('student')} Elegir foto</label><button type="submit">Guardar foto</button></form><button type="button" id="parent-account-theme">${icon('settings')} Cambiar tema</button></div></section><div class="family-profile-layout page-spacer"><section class="panel">${panelHeading('Datos de contacto','Información actualizable','Los cambios quedan registrados en la auditoría familiar.')}<form class="account-form" id="parent-profile-form"><label>Nombres y apellidos<input value="${escapeHtml(data.user.name)}" disabled></label><label>Documento<input value="${escapeHtml(data.user.documentType||'DNI')} · ${escapeHtml(data.user.document||'No registrado')}" disabled></label><label>Correo electrónico<input name="email" type="email" value="${escapeHtml(data.user.email)}" required></label><label>Teléfono<input name="phone" type="tel" inputmode="tel" pattern="[0-9+() -]{6,20}" value="${escapeHtml(data.user.phone)}" maxlength="20" required></label><fieldset class="family-preferences"><legend>Preferencias de notificación</legend>${options.map((item)=>`<label><input type="checkbox" name="preferences" value="${item}" ${data.preferences.includes(item)?'checked':''}><span>${escapeHtml(item)}</span></label>`).join('')}</fieldset><button class="primary-action" type="submit">${icon('check')} Guardar cambios</button><p class="form-message"></p></form></section><section class="panel">${panelHeading('Seguridad','Cambiar contraseña','Las demás sesiones se cerrarán automáticamente.')}<form class="account-form" id="parent-password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><small>Use mayúscula, minúscula, número y símbolo.</small><button class="secondary-action" type="submit">${icon('lock')} Actualizar contraseña</button><p class="form-message"></p></form><div class="family-security-summary"><span>${icon('shield')}</span><div><strong>Sesión protegida</strong><p>Acceso limitado a vínculos familiares verificados.</p></div></div></section></div>`;
  content.querySelector('#parent-profile-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const preferences=[...form.querySelectorAll('[name="preferences"]:checked')].map((item)=>item.value);try{const result=await api('/api/parent/profile',{method:'PUT',body:JSON.stringify({email:form.elements.email.value,phone:form.elements.phone.value,preferences})});currentUser={...currentUser,...result.user};refreshSessionIdentity();form.querySelector('.form-message').textContent=result.message;notify(result.message);}catch(error){form.querySelector('.form-message').textContent=error.message;}});content.querySelector('#parent-password-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;form.reset();notify(result.message);}catch(error){form.querySelector('.form-message').textContent=error.message;}});const parentPhotoInput=content.querySelector('#parent-photo-input');parentPhotoInput.addEventListener('change',()=>{const file=parentPhotoInput.files[0];if(!file)return;if(file.size>2*1024*1024){parentPhotoInput.value='';notify('La fotografía no debe superar 2 MB.','error');return;}content.querySelector('#parent-profile-avatar').innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Vista previa de la foto">`;});content.querySelector('#parent-photo-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;if(!parentPhotoInput.files[0]){notify('Seleccione una fotografía antes de guardarla.','error');return;}if(!form.reportValidity())return;try{const result=await api('/api/account/photo',{method:'POST',body:new FormData(form)});currentUser=result.user;csrfToken=result.user.csrf;refreshSessionIdentity();notify(result.message);await renderParentAccount();}catch(error){notify(error.message,'error');}});content.querySelector('#parent-account-theme').addEventListener('click',()=>{document.body.classList.toggle('theme-dark');localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light');});
}

async function renderGuardDashboard() {
  const data=await api('/api/guard/dashboard');
  const firstName=String(data.guard.name||'Vigilante').split(/\s+/)[0];
  content.innerHTML=`<section class="guard-command"><div><span class="guard-live"><i></i> Turno ${escapeHtml(data.guard.shift||'institucional')}</span><p>${teacherDate(data.today)} · ${escapeHtml(data.guard.pointOfControl||'Puerta principal')}</p><h2>Control de acceso listo, ${escapeHtml(firstName)}.</h2><p>Consulte la boleta, confirme la identidad y registre cada resultado desde un solo flujo seguro.</p><a class="guard-main-action" href="${pageHref('vigilante','validar-qr')}">${icon('scan')} Validar QR ahora <b>→</b></a></div><aside>${icon('shield')}<span><small>Punto de control</small><strong>${escapeHtml(data.guard.pointOfControl||'Puerta principal')}</strong><p>Sesión protegida y auditable</p></span></aside></section>
  <section class="guard-section-heading"><div><p class="section-kicker">Pulso del turno</p><h2>Operación de hoy</h2></div><span>Actualización en tiempo real</span></section>
  <section class="guard-kpi-grid">${[['Salidas autorizadas',data.summary.authorized,'Pendientes para hoy','green','exit'],['Salidas validadas',data.summary.validated,'Durante este turno','blue','check'],['Ingresos registrados',data.summary.entries,'En su punto de control','teal','login'],['Intentos rechazados',data.summary.rejected,'Salidas bloqueadas','red','alert'],['Incidencias pendientes',data.summary.incidents,'Requieren seguimiento','amber','shield']].map(([label,value,copy,tone,iconName])=>`<article class="guard-kpi guard-${tone}"><span>${icon(iconName)}</span><div><strong>${value}</strong><h3>${label}</h3><p>${copy}</p></div></article>`).join('')}</section>
  <div class="guard-dashboard-grid"><section class="panel guard-recent">${panelHeading('Bitácora operativa','Últimas validaciones','Resultados recientes del control de acceso.')}<div class="guard-timeline">${data.recent.length?data.recent.map((item)=>`<article><span class="guard-result-dot ${item.result==='Validada'?'is-valid':'is-rejected'}">${icon(item.result==='Validada'?'check':'alert')}</span><div><strong>${escapeHtml(item.student)}</strong><p>${escapeHtml(item.exitId||item.code)} · ${escapeHtml(item.pointOfControl)}</p></div><time>${new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}).format(new Date(item.date))}</time>${status(item.result)}</article>`).join(''):'<p class="empty-notice">Todavía no hay validaciones en este turno.</p>'}</div></section><section class="guard-fast-panel"><span>${icon('scan')}</span><p class="section-kicker text-on-dark">Acción prioritaria</p><h2>Lectura rápida en puerta</h2><p>Use la cámara o escriba el código. SIGA mostrará únicamente los datos mínimos necesarios.</p><a href="${pageHref('vigilante','validar-qr')}">Abrir lector QR ${icon('exit')}</a><small>${icon('lock')} Una boleta se utiliza una sola vez.</small></section></div><section class="panel guard-access-shortcut page-spacer"><span>${icon('login')}</span><div><p class="section-kicker">Control diario</p><h2>Entradas y salidas de estudiantes</h2><p>Use un solo lector: el QR diario registra automáticamente entrada o salida según el último movimiento.</p></div><a class="primary-action" href="${pageHref('vigilante','accesos')}">${icon('scan')} Abrir control QR</a></section>`;
}

async function renderGuardAccess() {
  const profile=await api('/api/guard/profile');
  const point=profile.user.pointOfControl||'Puerta principal';
  content.innerHTML=`<section class="guard-list-hero access"><span>${icon('scan')}</span><div><p class="section-kicker text-on-dark">Control QR de accesos</p><h2>Entradas y salidas de estudiantes</h2><p>Un solo lector identifica automáticamente si corresponde registrar una entrada o una salida.</p></div><b>${escapeHtml(point)}</b></section>
  <section class="guard-access-actions unified page-spacer"><article class="panel guard-access-action entry">${panelHeading('Entrada y salida por QR','Escanear credencial diaria','El estudiante presenta el mismo QR en ambos movimientos.')}<div class="guard-entry-qr-layout"><div class="guard-camera-box compact"><video id="guard-entry-camera" playsinline muted></video><div id="guard-entry-camera-placeholder">${icon('scan')}<strong>Lector de entrada y salida</strong><span>Active la cámara y enfoque el QR diario.</span></div><button type="button" id="guard-entry-camera-toggle">${icon('scan')} Activar cámara</button></div><form id="guard-entry-form"><label>Código QR diario<input name="code" autocomplete="off" minlength="20" maxlength="320" required placeholder="SIGA-ACCESS..."></label><label>Punto de control<input name="pointOfControl" maxlength="80" value="${escapeHtml(point)}" required></label><button class="primary-action" type="submit">${icon('scan')} Validar y registrar movimiento</button><p class="form-message" aria-live="polite">SIGA registrará un movimiento ordinario. Las salidas especiales se validan únicamente con la boleta oficial.</p></form></div></article></section>
  <article class="panel guard-boleta-shortcut"><span>${icon('clipboard')}</span><div><p class="section-kicker">Salida especial</p><h2>¿El estudiante tiene una boleta autorizada?</h2><p>Use el lector de boletas cuando Coordinación haya autorizado una solicitud de retiro especial.</p></div><a class="secondary-action" href="${pageHref('vigilante','validar-qr')}">${icon('scan')} Validar boleta QR</a></article>
  <section class="guard-access-summary" id="guard-access-summary" aria-live="polite"></section>
  <section class="panel guard-access-log">${panelHeading('Trazabilidad del turno','Bitácora de entradas y salidas','Cada movimiento muestra responsable, hora y punto de control.')}<form class="guard-access-filters" id="guard-access-filters"><label>Buscar<input name="search" type="search" placeholder="Estudiante o documento"></label><label>Movimiento<select name="type"><option value="">Todos</option><option value="Entrada">Entradas</option><option value="Salida">Salidas</option></select></label><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><button class="secondary-action" type="submit">${icon('scan')} Aplicar filtros</button></form><div id="guard-access-table"></div></section>`;
  const filters=content.querySelector('#guard-access-filters');
  const table=content.querySelector('#guard-access-table');
  const summary=content.querySelector('#guard-access-summary');
  const entryForm=content.querySelector('#guard-entry-form');
  let accessBackendReady=true;let entryCameraStream=null;let entryScanning=false;
  const stopEntryCamera=()=>{entryCameraStream?.getTracks().forEach((track)=>track.stop());entryCameraStream=null;entryScanning=false;const video=content.querySelector('#guard-entry-camera');if(video)video.srcObject=null;const placeholder=content.querySelector('#guard-entry-camera-placeholder');if(placeholder)placeholder.hidden=false;const toggle=content.querySelector('#guard-entry-camera-toggle');if(toggle)toggle.innerHTML=`${icon('scan')} Activar cámara`;};
  const loadAccessData=async(query)=>{try{const data=await api(`/api/guard/access-movements?${query}`);accessBackendReady=data.entryMethod==='unified-qr';return {...data,compatibility:!accessBackendReady};}catch(error){accessBackendReady=false;const [dashboard,history]=await Promise.all([api('/api/guard/dashboard'),api(`/api/guard/history?${query}`)]);const exits=history.items.filter((item)=>item.result==='Validada').map((item)=>({id:item.id,type:'Salida',student:item.student,document:'Protegido',program:'Consulta mínima',date:item.date,pointOfControl:item.pointOfControl,guardName:item.guardName||profile.user.name,source:`Boleta ${item.exitId||'oficial'}`}));return {items:exits,summary:{entries:dashboard.summary.entries,exits:dashboard.summary.validated,inside:Math.max(0,dashboard.summary.entries-dashboard.summary.validated)},compatibility:true};}};
  const load=async()=>{const query=new URLSearchParams(new FormData(filters));const data=await loadAccessData(query);summary.innerHTML=`<article><span>${icon('login')}</span><div><strong>${data.summary.entries}</strong><p>Entradas de hoy</p></div></article><article><span>${icon('exit')}</span><div><strong>${data.summary.exits}</strong><p>Salidas de hoy</p></div></article><article><span>${icon('student')}</span><div><strong>${data.summary.inside}</strong><p>Estudiantes dentro</p></div></article>`;table.innerHTML=`${data.compatibility?'<p class="guard-access-compatibility">Reinicie una vez el servidor de SIGA para activar el lector unificado de entrada y salida.</p>':''}${data.items.length?rowsTable(['Movimiento','Estudiante','Documento','Programa','Fecha y hora','Punto de control','Responsable'],data.items.map((item)=>`<tr><td><span class="guard-movement movement-${item.type.toLowerCase()}">${icon(item.type==='Entrada'?'login':'exit')} ${escapeHtml(item.type)}</span></td><td><strong>${escapeHtml(item.student)}</strong><small class="table-subcopy">${escapeHtml(item.source)}</small></td><td>${escapeHtml(item.document)}</td><td>${escapeHtml(item.program)}</td><td>${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(item.date))}</td><td>${escapeHtml(item.pointOfControl)}</td><td>${escapeHtml(item.guardName)}</td></tr>`)):'<p class="empty-notice">No existen movimientos para los filtros seleccionados.</p>'}`;enhanceResponsiveTables(table);};
  filters.addEventListener('submit',(event)=>{event.preventDefault();load().catch((error)=>notify(error.message,'error'));});
  filters.addEventListener('change',()=>load().catch((error)=>notify(error.message,'error')));
  entryForm.addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const button=form.querySelector('button');const message=form.querySelector('.form-message');if(!accessBackendReady){message.textContent='Reinicie una vez el servidor de SIGA para activar el lector QR de entrada y salida.';notify(message.textContent,'error');return;}button.disabled=true;const payload=Object.fromEntries(new FormData(form));try{const result=await api('/api/guard/access-scan',{method:'POST',body:JSON.stringify(payload)});message.textContent=`${result.student.name} · ${result.student.program}. ${result.message}`;notify(result.message);form.elements.code.value='';await load();}catch(error){message.textContent=error.message;notify(error.message,'error');}finally{button.disabled=false;}});
  content.querySelector('#guard-entry-camera-toggle').addEventListener('click',async()=>{if(entryCameraStream){stopEntryCamera();return;}const message=entryForm.querySelector('.form-message');if(!navigator.mediaDevices?.getUserMedia){message.textContent='La cámara no está disponible. Ingrese el código del QR manualmente.';return;}if(!('BarcodeDetector' in window)){message.textContent='Este navegador no ofrece lectura QR automática. Ingrese el código manualmente.';return;}try{entryCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const video=content.querySelector('#guard-entry-camera');video.srcObject=entryCameraStream;await video.play();content.querySelector('#guard-entry-camera-placeholder').hidden=true;content.querySelector('#guard-entry-camera-toggle').textContent='Detener cámara';entryScanning=true;const detector=new BarcodeDetector({formats:['qr_code']});const scan=async()=>{if(!entryScanning)return;try{const codes=await detector.detect(video);if(codes[0]?.rawValue){entryForm.elements.code.value=codes[0].rawValue;stopEntryCamera();entryForm.requestSubmit();return;}}catch{}requestAnimationFrame(scan);};scan();}catch{message.textContent='No se pudo abrir la cámara. Revise el permiso o ingrese el código manualmente.';}});
  window.addEventListener('pagehide',stopEntryCamera,{once:true});
  await load();
}

function guardLookupCard(data, lookupOnly=false) {
  const tone=data.valid?'valid':['Fuera de horario'].includes(data.status)?'warning':'invalid';
  if(!data.item)return `<article class="guard-lookup-card is-${tone}"><span class="guard-lookup-symbol">${icon('alert')}</span><div class="guard-lookup-main"><header>${status(data.status)}<strong>${escapeHtml(data.reason)}</strong></header><p>Revise el código o registre una incidencia si existe un intento de salida.</p><a class="guard-inline-link" href="${pageHref('vigilante','incidencias')}?type=QR%20inválido&code=${encodeURIComponent(data.code)}">${icon('shield')} Registrar incidencia</a></div></article>`;
  return `<article class="guard-lookup-card is-${tone}"><div class="guard-student-avatar">${escapeHtml(data.item.initials)}</div><div class="guard-lookup-main"><header>${status(data.status)}<strong>${escapeHtml(data.reason)}</strong></header><h3>${escapeHtml(data.item.student)}</h3><p>${escapeHtml(data.item.program)}</p><dl><div><dt>Boleta</dt><dd>${escapeHtml(data.item.id)}</dd></div><div><dt>Fecha y hora</dt><dd>${teacherDate(data.item.date)} · ${escapeHtml(data.item.time)}</dd></div><div><dt>Motivo</dt><dd>${escapeHtml(data.item.reason)}</dd></div><div><dt>Autorizó</dt><dd>${escapeHtml(data.item.authorizedBy)}</dd></div></dl>${data.valid&&!lookupOnly?`<div class="guard-confirm-actions"><button class="guard-confirm-button" type="button" data-guard-confirm>${icon('check')} Confirmar y registrar salida</button><button class="guard-mismatch-button" type="button" data-guard-mismatch>${icon('alert')} La identidad no coincide</button></div>`:!data.valid?`<a class="guard-inline-link" href="${pageHref('vigilante','incidencias')}?student=${encodeURIComponent(data.item.studentId)}&exit=${encodeURIComponent(data.item.id)}">${icon('shield')} Registrar incidencia de seguridad</a>`:''}</div></article>`;
}

async function renderGuardValidation(lookupOnly=false) {
  const profile=await api('/api/guard/profile');
  content.innerHTML=`<section class="guard-validation-hero"><span>${icon(lookupOnly?'student':'scan')}</span><div><p class="section-kicker text-on-dark">${lookupOnly?'Consulta protegida':'Validación oficial'}</p><h2>${lookupOnly?'Información mínima del estudiante':'Escanee, consulte y confirme'}</h2><p>${lookupOnly?'La información solo aparece al consultar una boleta.':'La salida nunca se registra sin una confirmación explícita.'}</p></div><b>${escapeHtml(profile.user.pointOfControl||'Puerta principal')}</b></section><div class="guard-validation-layout page-spacer"><section class="panel guard-scanner-panel">${panelHeading('Paso 1','Leer o ingresar código','Consulte la boleta antes de tomar una decisión.')}<div class="guard-camera-box"><video id="guard-camera" playsinline muted></video><div id="guard-camera-placeholder">${icon('scan')}<strong>Lector QR</strong><span>Active la cámara trasera para escanear.</span></div><button type="button" id="guard-camera-toggle">${icon('scan')} Activar cámara</button></div><div class="guard-divider"><span>o ingrese el código</span></div><form class="guard-code-form" id="guard-validate-form"><label>Código de boleta<input name="code" autocomplete="off" placeholder="SIGA-SOL-000-AUTORIZADA" minlength="5" maxlength="120" required></label><label>Punto de control<input name="pointOfControl" value="${escapeHtml(profile.user.pointOfControl||'Puerta principal')}" maxlength="80" required></label><button class="primary-action" type="submit">${icon('scan')} Consultar boleta</button></form><p class="guard-camera-help" id="guard-camera-help">Si la cámara no está disponible, use el código impreso debajo del QR.</p></section><section class="guard-result-panel"><div id="guard-validation-empty"><span>${icon('shield')}</span><h3>Esperando una consulta</h3><p>Aquí aparecerán el estado y los datos mínimos del estudiante.</p></div><div id="guard-validation-result" aria-live="polite"></div></section></div><section class="guard-protocol-strip"><article>${icon('clipboard')}<span><strong>Coordinación autoriza</strong><small>Vigilancia no modifica la boleta.</small></span></article><article>${icon('student')}<span><strong>Identidad verificada</strong><small>Compare los datos antes de confirmar.</small></span></article><article>${icon('lock')}<span><strong>Uso único</strong><small>La validación queda auditada.</small></span></article></section>`;
  const form=content.querySelector('#guard-validate-form');const result=content.querySelector('#guard-validation-result');const empty=content.querySelector('#guard-validation-empty');let currentLookup=null;let cameraStream=null;let scanning=false;
  const stopCamera=()=>{cameraStream?.getTracks().forEach((track)=>track.stop());cameraStream=null;scanning=false;content.querySelector('#guard-camera').srcObject=null;content.querySelector('#guard-camera-placeholder').hidden=false;content.querySelector('#guard-camera-toggle').innerHTML=`${icon('scan')} Activar cámara`;};
  const submitLookup=async()=>{const button=form.querySelector('[type="submit"]');button.disabled=true;empty.hidden=true;result.innerHTML='<p class="loading-state">Consultando la boleta oficial…</p>';try{currentLookup=await api('/api/guard/lookup',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});result.innerHTML=guardLookupCard(currentLookup,lookupOnly);}catch(error){result.innerHTML=`<p class="attendance-message is-error">${icon('alert')} ${escapeHtml(error.message)}</p>`;notify(error.message,'error');}finally{button.disabled=false;}};
  form.addEventListener('submit',async(event)=>{event.preventDefault();await submitLookup();});
  result.addEventListener('click',async(event)=>{const confirmButton=event.target.closest('[data-guard-confirm]');const mismatchButton=event.target.closest('[data-guard-mismatch]');if(confirmButton&&currentLookup?.valid){if(!await confirmAction(`¿Confirma la salida de ${currentLookup.item.student}? Esta acción utilizará la boleta.`))return;confirmButton.disabled=true;try{const data=await api('/api/guard/validate',{method:'POST',body:JSON.stringify({code:currentLookup.code,pointOfControl:form.elements.pointOfControl.value,confirmed:true})});result.innerHTML=`<article class="guard-success-state"><span>${icon('check')}</span><div><p>Salida validada</p><h3>${escapeHtml(data.item.student)}</h3><strong>${escapeHtml(data.item.id)} · ${escapeHtml(data.validation.pointOfControl)}</strong><small>Registrada a las ${new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}).format(new Date(data.validation.date))}</small></div></article>`;form.elements.code.value='';notify(data.message);}catch(error){notify(error.message,'error');await submitLookup();}}if(mismatchButton&&currentLookup){mismatchButton.disabled=true;try{const data=await api('/api/guard/reject',{method:'POST',body:JSON.stringify({code:currentLookup.code,reason:'Identidad no coincidente',pointOfControl:form.elements.pointOfControl.value})});result.innerHTML=`<article class="guard-blocked-state">${icon('alert')}<div><h3>Salida bloqueada</h3><p>${escapeHtml(data.message)}</p><a href="${pageHref('vigilante','incidencias')}?student=${encodeURIComponent(currentLookup.item.studentId)}&exit=${encodeURIComponent(currentLookup.item.id)}&type=Identidad%20no%20coincidente">Registrar incidencia →</a></div></article>`;notify(data.message,'error');}catch(error){notify(error.message,'error');mismatchButton.disabled=false;}}});
  content.querySelector('#guard-camera-toggle').addEventListener('click',async()=>{if(cameraStream){stopCamera();return;}const help=content.querySelector('#guard-camera-help');if(!navigator.mediaDevices?.getUserMedia){help.textContent='La cámara no está disponible. Ingrese el código manualmente.';return;}if(!('BarcodeDetector' in window)){help.textContent='Este navegador no ofrece lectura QR automática. Use el código manual.';return;}try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const video=content.querySelector('#guard-camera');video.srcObject=cameraStream;await video.play();content.querySelector('#guard-camera-placeholder').hidden=true;content.querySelector('#guard-camera-toggle').textContent='Detener cámara';scanning=true;const detector=new BarcodeDetector({formats:['qr_code']});const scan=async()=>{if(!scanning)return;try{const codes=await detector.detect(video);if(codes[0]?.rawValue){form.elements.code.value=codes[0].rawValue;stopCamera();await submitLookup();return;}}catch{}requestAnimationFrame(scan);};scan();}catch{help.textContent='No se pudo abrir la cámara. Revise el permiso o ingrese el código manualmente.';}});window.addEventListener('pagehide',stopCamera,{once:true});
}

async function renderGuardExits(history=false) {
  if(history)return renderGuardHistory();
  const initial=await api('/api/guard/exits');
  content.innerHTML=`<section class="guard-list-hero"><span>${icon('exit')}</span><div><p class="section-kicker text-on-dark">Consulta operativa</p><h2>Boletas autorizadas</h2><p>Información de solo lectura emitida por Coordinación.</p></div><b>${initial.items.length} boletas</b></section><section class="panel page-spacer">${panelHeading('Filtros del turno','Localice una autorización','Vigilancia no puede cambiar ninguna decisión.')}<form class="guard-filter-grid" id="guard-exit-filters"><label>Fecha<input name="date" type="date"></label><label>Estado<select name="state"><option value="">Todos</option><option>Pendiente de validar</option><option>Usada</option><option>Vencida</option><option>Fuera de horario</option></select></label><label>Programa<select name="program"><option value="">Todos los programas</option>${initial.programs.map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label class="wide">Estudiante o código<input name="search" type="search" placeholder="Buscar estudiante o SOL-..."></label><button class="primary-action" type="submit">${icon('scan')} Aplicar filtros</button></form></section><section class="guard-ticket-grid page-spacer" id="guard-ticket-list"></section>`;
  const form=content.querySelector('#guard-exit-filters');const list=content.querySelector('#guard-ticket-list');const draw=(items)=>{list.innerHTML=items.length?items.map((item)=>`<article class="guard-ticket-card"><header><span class="guard-student-avatar">${escapeHtml(item.initials)}</span><div><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.student)}</h3><p>${escapeHtml(item.program)}</p></div>${status(item.displayStatus)}</header><dl><div><dt>Hora autorizada</dt><dd>${teacherDate(item.date)} · ${escapeHtml(item.time)}</dd></div><div><dt>Motivo</dt><dd>${escapeHtml(item.reason)}</dd></div><div><dt>Autorizó</dt><dd>${escapeHtml(item.authorizedBy||'Coordinación académica')}</dd></div></dl><footer>${icon('lock')} Autorización de solo lectura</footer></article>`).join(''):'<section class="panel"><p class="empty-notice">No hay boletas para los filtros seleccionados.</p></section>';};form.addEventListener('submit',async(event)=>{event.preventDefault();const query=new URLSearchParams(new FormData(form));try{draw((await api(`/api/guard/exits?${query}`)).items);}catch(error){notify(error.message,'error');}});draw(initial.items);
}

async function renderGuardHistory(){
  const load=async(query='')=>api(`/api/guard/history${query?`?${query}`:''}`);const initial=await load();
  content.innerHTML=`<section class="guard-list-hero history"><span>${icon('clock')}</span><div><p class="section-kicker text-on-dark">Auditoría de vigilancia</p><h2>Historial de validaciones</h2><p>Cada resultado conserva fecha, usuario y punto de control.</p></div></section><section class="panel page-spacer"><form class="guard-filter-grid compact" id="guard-history-filters"><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><label>Resultado<select name="result"><option value="">Todos</option><option>Validada</option><option>Rechazada</option></select></label><label class="wide">Estudiante<input name="student" type="search" placeholder="Buscar por nombre"></label><button class="primary-action" type="submit">${icon('scan')} Filtrar</button></form><div id="guard-history-table"></div></section>`;
  const host=content.querySelector('#guard-history-table');const draw=(items)=>{host.innerHTML=items.length?rowsTable(['Fecha y hora','Estudiante','Boleta','Resultado','Motivo','Punto de control'],items.map((item)=>`<tr><td>${new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(item.date))}</td><td><strong>${escapeHtml(item.student)}</strong></td><td>${escapeHtml(item.exitId||item.code)}</td><td>${status(item.result)}</td><td>${escapeHtml(item.reason||'Validación conforme')}</td><td>${escapeHtml(item.pointOfControl)}</td></tr>`)):'<p class="empty-notice">No existen validaciones para el filtro seleccionado.</p>';enhanceResponsiveTables(host);};content.querySelector('#guard-history-filters').addEventListener('submit',async(event)=>{event.preventDefault();try{draw((await load(new URLSearchParams(new FormData(event.currentTarget)).toString())).items);}catch(error){notify(error.message,'error');}});draw(initial.items);
}

async function renderGuardAlerts(){
  let data=await api('/api/guard/alerts');
  content.innerHTML=`<section class="guard-list-hero alerts"><span>${icon('bell')}</span><div><p class="section-kicker text-on-dark">Atención operativa</p><h2>Alertas del control de acceso</h2><p>Revise eventos críticos sin eliminar su historial.</p></div><b id="guard-alert-count"></b></section><section class="guard-alert-grid page-spacer" id="guard-alert-list"></section>`;
  const host=content.querySelector('#guard-alert-list');const count=content.querySelector('#guard-alert-count');const draw=()=>{count.textContent=`${data.items.filter((item)=>!item.reviewed).length} pendientes`;host.innerHTML=data.items.length?data.items.map((item)=>`<article class="guard-alert-card tone-${item.tone} ${item.reviewed?'is-reviewed':''}"><span>${icon(item.tone==='red'?'alert':item.tone==='amber'?'clock':'shield')}</span><div><header><strong>${escapeHtml(item.type)}</strong>${item.reviewed?status('Revisada'):'<i>Nueva</i>'}</header><p>${escapeHtml(item.message)}</p><small>${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(item.date))}</small></div>${item.reviewed?'':`<button type="button" data-alert-review="${item.id}">${icon('check')} Marcar revisada</button>`}</article>`).join(''):'<section class="panel"><p class="empty-notice">No hay alertas operativas.</p></section>';};host.addEventListener('click',async(event)=>{const button=event.target.closest('[data-alert-review]');if(!button)return;button.disabled=true;try{const result=await api(`/api/guard/alerts/${button.dataset.alertReview}/review`,{method:'PATCH'});notify(result.message);data=await api('/api/guard/alerts');draw();}catch(error){notify(error.message,'error');button.disabled=false;}});draw();
}

async function renderGuardIncidents(){
  const params=new URLSearchParams(location.search);const data=await api(`/api/guard/incidents${params.get('student')?`?student=${encodeURIComponent(params.get('student'))}`:''}`);
  content.innerHTML=`<section class="guard-list-hero incidents"><span>${icon('shield')}</span><div><p class="section-kicker text-on-dark">Seguridad institucional</p><h2>Incidencias en puerta</h2><p>Registre el evento con datos concretos para Coordinación y Administración.</p></div><button class="guard-hero-button" type="button" id="guard-new-incident">${icon('alert')} Nueva incidencia</button></section><div class="guard-incident-layout page-spacer"><section class="panel"><form class="guard-incident-form" id="guard-incident-form"><div class="panel-heading"><div><p class="section-kicker">Registro auditable</p><h2>Detalle de la incidencia</h2></div><p>Los campos obligatorios ayudan a una revisión rápida.</p></div><label>Estudiante identificado<select name="studentId"><option value="">No identificado</option>${data.students.map((item)=>`<option value="${item.id}" ${params.get('student')===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Código de boleta<input name="exitId" value="${escapeHtml(params.get('exit')||'')}" maxlength="30" placeholder="Opcional"></label><label>Tipo<select name="type" required>${['QR inválido','Identidad no coincidente','Intento de salida no autorizada','Incidente en puerta','Otro'].map((item)=>`<option ${params.get('type')===item?'selected':''}>${item}</option>`).join('')}</select></label><label>Prioridad<select name="priority"><option>Baja</option><option selected>Media</option><option>Alta</option></select></label><label class="full">Descripción<textarea name="description" minlength="8" maxlength="800" placeholder="Describa qué ocurrió y qué acción se tomó" required></textarea></label><label class="full">Evidencia opcional<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small>PDF o imagen, máximo 5 MB.</small></label><button class="primary-action" type="submit">${icon('shield')} Registrar incidencia</button><p class="form-message"></p></form></section><section class="panel guard-incident-list">${panelHeading('Seguimiento','Incidencias registradas','La resolución corresponde al personal autorizado.')}<div id="guard-incidents">${data.items.map((item)=>`<article><span class="guard-priority priority-${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span><div><header><strong>${escapeHtml(item.id)} · ${escapeHtml(item.type)}</strong>${status(item.status)}</header><p>${escapeHtml(item.student)} · ${escapeHtml(item.pointOfControl)}</p><small>${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(item.date))}</small></div></article>`).join('')||'<p class="empty-notice">No hay incidencias registradas.</p>'}</div></section></div>`;
  content.querySelector('#guard-new-incident').addEventListener('click',()=>content.querySelector('#guard-incident-form').scrollIntoView({behavior:'smooth'}));content.querySelector('#guard-incident-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const button=form.querySelector('button');button.disabled=true;try{const result=await api('/api/guard/incidents',{method:'POST',body:new FormData(form)});form.querySelector('.form-message').textContent=result.message;notify(result.message);await renderGuardIncidents();}catch(error){form.querySelector('.form-message').textContent=error.message;notify(error.message,'error');button.disabled=false;}});
}

async function renderGuardReports(){
  const initial=await api('/api/guard/reports');
  content.innerHTML=`<section class="guard-list-hero reports"><span>${icon('chart')}</span><div><p class="section-kicker text-on-dark">Inteligencia operativa</p><h2>Reportes de control de acceso</h2><p>Analice resultados por periodo, turno y punto de control.</p></div><div class="guard-export-actions"><a id="guard-report-xlsx" href="/api/guard/reports.xlsx">${icon('file')} Excel</a><a id="guard-report-pdf" href="/api/guard/reports.pdf">${icon('clipboard')} PDF</a></div></section><section class="panel page-spacer"><form class="guard-filter-grid compact" id="guard-report-filters"><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><label>Turno<select name="shift"><option value="">Todos</option><option>Mañana</option><option>Tarde</option><option>Noche</option></select></label><label>Resultado<select name="result"><option value="">Todos</option><option>Validada</option><option>Rechazada</option></select></label><button class="primary-action" type="submit">${icon('scan')} Aplicar filtros</button></form></section><div id="guard-report-results"></div>`;
  const host=content.querySelector('#guard-report-results');const draw=(data)=>{const max=Math.max(data.summary.validated,data.summary.rejected,data.summary.expired,data.summary.incidents,1);host.innerHTML=`<section class="guard-report-kpis">${[['Validadas',data.summary.validated,'green','check'],['Rechazadas',data.summary.rejected,'red','alert'],['Vencidas',data.summary.expired,'amber','clock'],['Incidencias',data.summary.incidents,'blue','shield']].map(([label,value,tone,iconName])=>`<article class="guard-${tone}"><span>${icon(iconName)}</span><div><strong>${value}</strong><p>${label}</p></div></article>`).join('')}</section><div class="guard-report-layout"><section class="panel">${panelHeading('Comparación visual','Resultados del periodo','Escala proporcional de actividad.')}<div class="guard-report-bars">${[['Validadas',data.summary.validated,'green'],['Rechazadas',data.summary.rejected,'red'],['Vencidas',data.summary.expired,'amber'],['Incidencias',data.summary.incidents,'blue']].map(([label,value,tone])=>`<article><div><span>${label}</span><strong>${value}</strong></div><i><b class="bar-${tone}" data-progress="${Math.round(value/max*100)}"></b></i></article>`).join('')}</div></section><section class="panel">${panelHeading('Equipo y puntos','Actividad registrada','Validaciones e intentos por responsable.')}<div class="guard-activity-list">${data.activity.map((item)=>`<article><span>${icon('shield')}</span><div><strong>${escapeHtml(item.guard)}</strong><p>${escapeHtml(item.pointOfControl)}</p></div><b>${item.validated} válidas · ${item.rejected} rechazadas</b></article>`).join('')||'<p class="empty-notice">No hay actividad para este periodo.</p>'}</div></section></div>`;applyDynamicStyles(host);};content.querySelector('#guard-report-filters').addEventListener('submit',async(event)=>{event.preventDefault();const query=new URLSearchParams(new FormData(event.currentTarget));try{const data=await api(`/api/guard/reports?${query}`);content.querySelector('#guard-report-xlsx').href=`/api/guard/reports.xlsx?${query}`;content.querySelector('#guard-report-pdf').href=`/api/guard/reports.pdf?${query}`;draw(data);}catch(error){notify(error.message,'error');}});draw(initial);
}

async function renderGuardAccount(){
  const data=await api('/api/guard/profile');const user=data.user;const portrait=user.photoUrl?`<img src="${user.photoUrl}?v=${Date.now()}" alt="Foto de ${escapeHtml(user.name)}">`:`<span>${tutorInitials(user.name)}</span>`;
  content.innerHTML=`<section class="guard-profile-hero"><div class="guard-profile-avatar" id="guard-profile-avatar">${portrait}</div><div><p class="section-kicker text-on-dark">Cuenta de vigilancia</p><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.shift||'Turno no asignado')} · ${escapeHtml(user.pointOfControl||'Punto no asignado')}</p></div><div class="role-profile-actions"><form class="role-photo-form" id="guard-photo-form"><input id="guard-photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden required><label class="secondary-action" for="guard-photo-input">${icon('student')} Elegir foto</label><button type="submit">Guardar foto</button></form><button type="button" id="guard-account-theme">${icon('settings')} Cambiar tema</button></div></section><div class="guard-profile-layout page-spacer"><section class="panel">${panelHeading('Datos institucionales','Perfil del vigilante','Información asignada por Administración.')}<dl class="guard-profile-data"><div><dt>Nombre completo</dt><dd>${escapeHtml(user.name)}</dd></div><div><dt>Código</dt><dd>${escapeHtml(user.institutionalCode||'No registrado')}</dd></div><div><dt>Correo</dt><dd>${escapeHtml(user.email)}</dd></div><div><dt>Turno asignado</dt><dd>${escapeHtml(user.shift||'No asignado')}</dd></div><div><dt>Punto de control</dt><dd>${escapeHtml(user.pointOfControl||'No asignado')}</dd></div><div><dt>Cuenta</dt><dd>${status(user.state)}</dd></div></dl><div class="guard-profile-stats"><span><strong>${data.validations}</strong> validaciones</span><span><strong>${data.rejected}</strong> bloqueos</span></div></section><section class="panel">${panelHeading('Seguridad','Actualizar contraseña','Las demás sesiones se cerrarán automáticamente.')}<form class="account-form" id="guard-password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><small>Use mayúscula, minúscula, número y símbolo.</small><button class="primary-action" type="submit">${icon('lock')} Cambiar contraseña</button><p class="form-message"></p></form></section></div>`;
  content.querySelector('#guard-account-theme').addEventListener('click',()=>{document.body.classList.toggle('theme-dark');localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light');});content.querySelector('#guard-password-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;form.reset();notify(result.message);}catch(error){form.querySelector('.form-message').textContent=error.message;notify(error.message,'error');}});const guardPhotoInput=content.querySelector('#guard-photo-input');guardPhotoInput.addEventListener('change',()=>{const file=guardPhotoInput.files[0];if(!file)return;if(file.size>2*1024*1024){guardPhotoInput.value='';notify('La fotografía no debe superar 2 MB.','error');return;}content.querySelector('#guard-profile-avatar').innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Vista previa de la foto">`;});content.querySelector('#guard-photo-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;try{const result=await api('/api/account/photo',{method:'POST',body:new FormData(form)});currentUser=result.user;csrfToken=result.user.csrf;refreshSessionIdentity();notify(result.message);await renderGuardAccount();}catch(error){notify(error.message,'error');}});
}

function notify(message, tone = 'success') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live','polite');
    document.body.appendChild(region);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `${icon(tone === 'success' ? 'check' : 'alert')}<span>${escapeHtml(message)}</span>`;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function downloadFile(filename) {
  const link = document.createElement('a');
  link.href = `/downloads/${filename}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function setupPageInteractions(pageKey) {
  const search = document.querySelector('.table-search');
  if (search) {
    const rows = [...document.querySelectorAll('.data-table tbody tr')];
    const count = document.querySelector('.table-count');
    const filter = () => {
      const term = search.value.trim().toLowerCase();
      let visible = 0;
      rows.forEach((row) => { const show = row.textContent.toLowerCase().includes(term); row.hidden = !show; if (show) visible += 1; });
      count.textContent = `${visible} registro${visible === 1 ? '' : 's'}`;
    };
    search.addEventListener('input', filter);
    filter();
  }

  document.querySelectorAll('.inline-select').forEach((select) => {
    const storageKey = `siga_attendance_${select.getAttribute('aria-label')}`;
    const savedValue = localStorage.getItem(storageKey);
    if (savedValue) select.value = savedValue;
    select.addEventListener('change', () => {
      localStorage.setItem(storageKey, select.value);
      notify(`Asistencia actualizada: ${select.value}.`);
    });
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'logout') {
      if (button.dataset.confirmLogout === 'true' && !await confirmAction('¿Desea cerrar su sesión de SIGA?')) return;
      button.disabled = true;
      button.setAttribute('aria-busy','true');
      try { await api('/api/logout',{method:'POST'}); } catch (error) { /* La cookie se elimina al volver al acceso. */ }
      window.location.href = '/index.html';
      return;
    }
    if (action === 'export-report') {
      downloadFile('reporte-asistencia.csv');
      notify('Reporte descargado correctamente.');
    }
    if (action === 'download-template') {
      const type = button.dataset.template;
      downloadFile(`plantilla-${type}.csv`);
      notify(`Plantilla de ${type} descargada.`);
    }
    if (action === 'choose-file') document.querySelector('#excel-file')?.click();
    if (action === 'resolve-request') {
      const row = button.closest('tr');
      row.querySelector('.request-state').innerHTML = status(button.dataset.state);
      row.querySelectorAll('[data-action="resolve-request"]').forEach((item) => { item.disabled = true; });
      const states = JSON.parse(localStorage.getItem('siga_request_states') || '{}');
      states[row.dataset.request] = button.dataset.state;
      localStorage.setItem('siga_request_states', JSON.stringify(states));
      notify(`Solicitud ${row.dataset.request} ${button.dataset.state.toLowerCase()}.`);
    }
  });

  document.querySelector('#excel-file')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    document.querySelector('#file-feedback').textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    notify('Archivo seleccionado y listo para procesar.');
  });

  document.querySelector('#qr-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = document.querySelector('#qr-code').value.trim().toUpperCase();
    const record = exitRows.find(([id,,,state]) => id === code && state === 'Autorizada');
    const feedback = document.querySelector('#qr-feedback');
    feedback.textContent = record ? `${record[1]} · salida autorizada` : 'Código no autorizado o inexistente';
    feedback.className = record ? 'is-success' : 'is-error';
    notify(record ? 'Código validado correctamente.' : 'No fue posible autorizar la salida.', record ? 'success' : 'error');
  });
}

const teacherStateOptions = (selected = '') => ['Presente','Tardanza','Ausente','Permiso','Retiro'].map((item) => `<option value="${item}" ${item === selected ? 'selected' : ''}>${item}</option>`).join('');
const teacherAttendanceStates = [
  { value: 'Presente', icon: 'check', hint: 'A tiempo' },
  { value: 'Tardanza', icon: 'clock', hint: 'Llegó tarde' },
  { value: 'Ausente', icon: 'alert', hint: 'No asistió' },
  { value: 'Permiso', icon: 'shield', hint: 'Justificado' },
  { value: 'Retiro', icon: 'exit', hint: 'Salió antes' },
];
const teacherStateButtons = (selected = '', disabled = false) => teacherAttendanceStates.map((item) => `<button class="attendance-state-button state-${item.value.toLowerCase()} ${item.value === selected ? 'is-selected' : ''}" type="button" data-attendance-option data-state="${item.value}" aria-pressed="${item.value === selected}" title="${item.value}: ${item.hint}" ${disabled ? 'disabled' : ''}><span>${icon(item.icon)}</span><strong>${item.value}</strong><small>${item.hint}</small></button>`).join('');const teacherDate = (value) => value ? new Intl.DateTimeFormat('es-PE',{dateStyle:'medium'}).format(new Date(`${value}T12:00:00`)) : '';

async function renderTeacherSchedule() {
  const data=await api('/api/teacher/classes');
  const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const order=new Map(days.map((day,index)=>[day,index]));
  const items=[...data.items].sort((a,b)=>(order.get(a.day)??99)-(order.get(b.day)??99)||String(a.schedule).localeCompare(String(b.schedule)));
  content.innerHTML=`<section class="teacher-context teacher-schedule-hero"><span>${icon('calendar')}</span><div><p class="section-kicker">Agenda personal</p><h2>Mi horario docente</h2><p>Coordinación publica aquí únicamente las clases asignadas a su cuenta.</p></div><span class="context-badge">${icon('shield')} Vista privada</span></section><section class="teacher-schedule-summary"><article><span>${icon('book')}</span><div><strong>${items.length}</strong><small>Clases asignadas</small></div></article><article><span>${icon('calendar')}</span><div><strong>${new Set(items.map((item)=>item.day).filter(Boolean)).size}</strong><small>Días programados</small></div></article><article><span>${icon('users')}</span><div><strong>${items.reduce((total,item)=>total+Number(item.studentCount||0),0)}</strong><small>Matrículas visibles</small></div></article></section><section class="panel teacher-private-schedule">${panelHeading('Programación semanal','Horario de mis clases','No se muestran horarios de otros Docentes.')}<div class="role-schedule-grid">${items.length?items.map((item)=>`<article><time><span>${escapeHtml(item.day||'Día pendiente')}</span><strong>${escapeHtml(item.schedule||'Horario pendiente')}</strong></time><div class="role-schedule-icon">${icon('book')}</div><div><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.course)}</h3><p>${escapeHtml(item.group)} · ${escapeHtml(item.room)} · ${escapeHtml(item.modality||'Presencial')}</p><span>${icon('users')} ${item.studentCount} estudiante${item.studentCount===1?'':'s'}</span></div><a class="secondary-action" href="${pageHref('docente','asistencia')}?classId=${encodeURIComponent(item.id)}">${icon('check')} Tomar asistencia</a></article>`).join(''):'<p class="empty-notice">Coordinación todavía no le ha asignado clases ni horarios.</p>'}</div></section>`;
}

async function renderTeacherDashboard() {
  const data = await api('/api/teacher/dashboard');
  const firstName = data.teacher.name.split(/\s+/)[0];
  const cards = [
    ['Estudiantes asignados',data.summary.students,'users','blue','Padrón de sus clases'],
    ['Presentes',data.summary.present,'check','teal','Registros de hoy'],
    ['Tardanzas',data.summary.late,'clock','amber','Registros de hoy'],
    ['Ausentes',data.summary.absent,'alert','red','Registros de hoy'],
  ];
  content.innerHTML = `<section class="teacher-hero"><div><span class="teacher-live"><i></i> Jornada docente · ${teacherDate(data.today)}</span><h2>Buen día, ${escapeHtml(firstName)}.</h2><p>Registre la asistencia, consulte sus grupos y mantenga el seguimiento académico desde un solo espacio.</p><div class="teacher-hero-meta"><span>${icon('graduation')} ${escapeHtml(data.teacher.program || 'Programa por asignar')}</span><span>${icon('book')} ${data.classes.length} clases asignadas</span></div><a class="teacher-primary-cta" href="${pageHref('docente','asistencia')}">${icon('check')} Registrar asistencia</a></div><div class="teacher-focus-card"><span>${icon('bell')}</span><strong>${data.pendingExits}</strong><p>solicitudes pendientes de coordinación</p><a href="${pageHref('docente','boletas')}">Revisar boletas →</a></div></section>
  <section class="teacher-heading"><div><p class="section-kicker">Resumen del día</p><h2>Control de asistencia</h2></div><span>Actualizado desde sus clases</span></section>
  <section class="teacher-metrics">${cards.map(([label,value,iconName,tone,detail]) => `<article class="dashboard-metric metric-accent-${tone}"><header><span class="metric-icon tone-${tone}">${icon(iconName)}</span><span class="dashboard-metric-state"><i></i> Jornada actual</span></header><div><strong>${value}</strong><span>${label}</span><p>${detail}</p></div><footer>${icon('check')} Información de sus clases</footer></article>`).join('')}</section>
  <div class="teacher-dashboard-grid"><section class="panel teacher-schedule">${panelHeading('Agenda académica','Clases asignadas','Organizadas por horario y grupo')}<div class="teacher-class-list">${data.classes.map((item) => `<article><span class="class-time">${icon('calendar')}<small>${escapeHtml(item.day||'Día pendiente')}</small><b>${escapeHtml(item.schedule)}</b></span><div class="class-main"><strong>${escapeHtml(item.course)}</strong><p><span>${escapeHtml(item.group)}</span><span>${escapeHtml(item.room)}</span></p></div><span class="class-enrollment">${icon('users')}<b>${item.studentCount}</b> estudiante${item.studentCount === 1 ? '' : 's'}</span><a href="${pageHref('docente','asistencia')}?classId=${encodeURIComponent(item.id)}">${icon('check')} Tomar asistencia</a></article>`).join('') || '<p class="empty-notice">No hay clases asignadas.</p>'}</div><a class="student-panel-link" href="${pageHref('docente','horario')}">Ver horario completo →</a></section>
  <section class="panel teacher-actions">${panelHeading('Accesos rápidos','Continúe su trabajo','Módulos frecuentes')}<a class="action-students" href="${pageHref('docente','estudiantes')}"><span>${icon('users')}</span><div><strong>Mis estudiantes</strong><p>Consulte el padrón asignado.</p><small>Ver estudiantes</small></div><b>→</b></a><a class="action-reports" href="${pageHref('docente','reportes')}"><span>${icon('chart')}</span><div><strong>Reportes</strong><p>Analice y exporte resultados.</p><small>Abrir reportes</small></div><b>→</b></a><a class="action-profile" href="${pageHref('docente','cuenta')}"><span>${icon('student')}</span><div><strong>Mi perfil</strong><p>Actualice sus datos autorizados.</p><small>Gestionar perfil</small></div><b>→</b></a></section></div>`;
}

async function renderTeacherStudents() {
  const data = await api('/api/teacher/students');
  const initials=(name)=>name.split(/\s+/).slice(0,2).map((part)=>part[0]).join('').toUpperCase();
  content.innerHTML = `<section class="teacher-context teacher-student-hero"><span>${icon('graduation')}</span><div><p class="section-kicker">Ámbito académico</p><h2>${escapeHtml(data.program || 'Programa asignado')}</h2><p>Una vista clara de los estudiantes que pertenecen exclusivamente a sus clases.</p></div><span class="context-badge">${icon('shield')} Consulta protegida</span></section><section class="teacher-student-overview"><article><span>${icon('users')}</span><div><strong>${data.items.length}</strong><small>Estudiantes asignados</small></div></article><article><span>${icon('book')}</span><div><strong>${new Set(data.items.flatMap((item)=>item.classes.map((course)=>course.course))).size}</strong><small>Cursos con matrícula</small></div></article><article><span>${icon('check')}</span><div><strong>${data.items.filter((item)=>item.state==='Activo').length}</strong><small>Estudiantes activos</small></div></article></section><section class="panel teacher-directory-panel teacher-card-directory">${panelHeading('Padrón docente','Directorio de estudiantes',`${data.items.length} registro${data.items.length===1?'':'s'} dentro de su alcance`)}<div class="teacher-student-toolbar"><label>${icon('scan')}<input id="teacher-student-search" type="search" aria-label="Buscar estudiantes asignados" placeholder="Buscar por estudiante, documento, curso o grupo"></label><span>${icon('shield')} Solo lectura</span></div><div class="teacher-student-grid" id="teacher-student-grid"></div></section>`;
  const host=content.querySelector('#teacher-student-grid');
  const draw=(items)=>{host.innerHTML=items.length?items.map((item)=>`<article class="teacher-student-card"><header><span class="teacher-student-avatar">${escapeHtml(initials(item.name))}</span>${status(item.state)}</header><div class="teacher-student-name"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.email)}</p></div><dl><div><dt>${icon('file')} Documento</dt><dd>${escapeHtml(item.documentType||'DNI')} · ${escapeHtml(item.document)}</dd></div><div><dt>${icon('graduation')} Semestre</dt><dd>${escapeHtml(item.semester)}</dd></div></dl><div class="teacher-student-courses"><small>Clases asignadas</small>${item.classes.map((course)=>`<span>${icon('book')}<b>${escapeHtml(course.course)}</b><em>${escapeHtml(course.group)}</em></span>`).join('')}</div><footer><span>${icon('shield')} Información académica protegida</span></footer></article>`).join(''):'<p class="empty-notice">No se encontraron estudiantes con esa búsqueda.</p>';};
  const search=content.querySelector('#teacher-student-search');search.addEventListener('input',()=>{const term=search.value.trim().toLowerCase();draw(data.items.filter((item)=>[item.name,item.document,item.email,...item.classes.flatMap((course)=>[course.course,course.group])].join(' ').toLowerCase().includes(term)));});draw(data.items);
}

async function renderTeacherAttendance() {
  const classData = await api('/api/teacher/classes');
  const classes = classData.items;
  const requested = new URLSearchParams(location.search).get('classId');
  const today = localIsoDate();
  const correctionStart = localIsoDate(-Number(classData.policies?.attendanceCorrectionDays || 7));
  content.innerHTML = `<section class="teacher-context attendance-context"><span>${icon('check')}</span><div><p class="section-kicker">Registro académico</p><h2>Asistencia de la clase</h2><p>Seleccione una clase, revise la lista y confirme los estados en tres pasos.</p></div><div class="attendance-steps"><span class="is-active"><b>1</b> Preparar</span><span><b>2</b> Registrar</span><span><b>3</b> Confirmar</span></div></section>
  <section class="panel attendance-workspace"><form class="teacher-filter-bar" id="teacher-attendance-filter"><div class="teacher-filter-intro"><span>${icon('book')}</span><div><strong>Prepare la lista</strong><small>Puede registrar o corregir asistencia de los últimos ${classData.policies?.attendanceCorrectionDays || 7} días.</small></div></div><label>Clase, curso o grupo<select name="classId" ${classes.length ? '' : 'disabled'}>${classes.map((item)=>`<option value="${item.id}" ${item.id === requested ? 'selected' : ''}>${escapeHtml(item.course)} · ${escapeHtml(item.group)} · ${escapeHtml(item.schedule)}</option>`).join('')}</select></label><label>Fecha<input name="date" type="date" min="${correctionStart}" max="${today}" value="${today}" required></label><button class="secondary-action" type="submit" ${classes.length ? '' : 'disabled'}>${icon('scan')} Cargar estudiantes</button></form><div id="attendance-feedback" class="loading-state">${classes.length ? 'Seleccione una clase para comenzar.' : 'Coordinación todavía no le ha asignado clases.'}</div><div id="teacher-attendance-list"></div></section>`;
  const form = content.querySelector('#teacher-attendance-filter');
  const host = content.querySelector('#teacher-attendance-list');
  const feedback = content.querySelector('#attendance-feedback');
  const updateSummary = () => {
    const selects=[...host.querySelectorAll('[data-attendance-state]')];
    const counts=Object.fromEntries(['Presente','Tardanza','Ausente','Permiso','Retiro'].map((state)=>[state,selects.filter((select)=>select.value===state).length]));
    const summary=host.querySelector('.attendance-save-summary');
    if(summary) summary.innerHTML=Object.entries(counts).map(([state,total])=>`<span class="summary-${state.toLowerCase()}"><strong>${total}</strong>${state}</span>`).join('');
  };
  const load = async () => {
    if (!form.elements.classId.value) return;
    feedback.className='loading-state'; feedback.textContent='Cargando estudiantes asignados…'; host.innerHTML='';
    try {
      const params=new URLSearchParams({classId:form.elements.classId.value,date:form.elements.date.value});
      const data=await api(`/api/teacher/attendance?${params}`);
      const policyMessage = data.editable ? (data.saved ? `Puede revisar y corregir hasta el ${teacherDate(data.correctionDeadline)}.` : 'Complete el estado de cada estudiante antes de guardar.') : `El periodo de corrección de ${data.correctionDays} días finalizó. Solicite apoyo de Coordinación.`;
      feedback.className=`attendance-message ${data.editable && data.saved ? 'is-saved' : ''} ${data.editable ? '' : 'is-error'}`;
      feedback.innerHTML=`${icon(data.editable?(data.saved?'check':'clock'):'shield')}<span><strong>${data.editable?(data.saved?'Registro encontrado':'Nuevo registro'):'Registro de solo lectura'}</strong>${policyMessage}</span>`;
      host.innerHTML=`<div class="attendance-class-card"><span class="attendance-course-icon">${icon('book')}</span><div><span>${escapeHtml(data.course.id)}</span><h3>${escapeHtml(data.course.course)}</h3><p><b>${escapeHtml(data.course.group)}</b><b>${escapeHtml(data.course.room)}</b><b>${escapeHtml(data.course.schedule)}</b></p></div><strong>${data.students.length}<small>estudiantes en lista</small></strong></div><form id="attendance-entry-form"><div class="attendance-list-heading"><div><strong>Estudiantes asignados</strong><small>${data.editable?'Marque un estado para cada estudiante.':'Consulte los estados registrados; la edición está cerrada.'}</small></div><span>${icon(data.editable?'check':'shield')} ${data.editable?'Selección directa':'Solo lectura'}</span></div><div class="attendance-student-list">${data.students.map((student)=>`<article><span class="attendance-avatar">${escapeHtml(student.name.split(/\s+/).slice(0,2).map((part)=>part[0]).join(''))}</span><div class="attendance-student"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.document)} · ${escapeHtml(student.email)}</small></div><fieldset class="attendance-state-picker"><legend>Estado de asistencia</legend><input type="hidden" data-attendance-state data-student="${student.id}" value="${escapeHtml(student.attendance || '')}"><div class="attendance-state-options" role="group" aria-label="Estado de asistencia de ${escapeHtml(student.name)}">${teacherStateButtons(student.attendance,!data.editable)}</div></fieldset></article>`).join('') || '<p class="empty-notice">No hay estudiantes activos en esta clase. Coordinación debe revisar la matrícula.</p>'}</div>${data.students.length && data.editable ? `<div class="attendance-save-bar"><div><strong class="summary-title">Resumen antes de guardar</strong><div class="attendance-save-summary"></div></div><div><p class="form-message" aria-live="polite"></p><button class="primary-action" type="submit">${icon('check')} ${data.saved?'Actualizar asistencia':'Guardar asistencia'}</button></div></div>` : ''}</form>`;
      if(data.editable) host.querySelectorAll('[data-attendance-option]').forEach((button)=>button.addEventListener('click',()=>{const picker=button.closest('.attendance-state-picker');const input=picker.querySelector('[data-attendance-state]');input.value=button.dataset.state;picker.classList.remove('is-invalid');picker.querySelectorAll('[data-attendance-option]').forEach((option)=>{const selected=option===button;option.classList.toggle('is-selected',selected);option.setAttribute('aria-pressed',String(selected));});updateSummary();}));
      updateSummary();
      host.querySelector('#attendance-entry-form')?.addEventListener('submit',async(event)=>{event.preventDefault();const submit=event.currentTarget.querySelector('[type="submit"]');const message=event.currentTarget.querySelector('.form-message');const controls=[...host.querySelectorAll('[data-attendance-state]')];const entries=controls.map((control)=>({studentId:control.dataset.student,state:control.value}));const missing=controls.filter((control)=>!control.value);host.querySelectorAll('.attendance-state-picker').forEach((picker)=>picker.classList.remove('is-invalid'));if(missing.length){missing.forEach((control)=>control.closest('.attendance-state-picker')?.classList.add('is-invalid'));message.textContent=`Seleccione el estado de ${missing.length} estudiante${missing.length===1?'':'s'} antes de guardar.`;missing[0].closest('.attendance-state-picker')?.querySelector('button')?.focus();return;}submit.disabled=true;submit.innerHTML=`${icon('clock')} Guardando…`;try{const result=await api('/api/teacher/attendance',{method:'PUT',body:JSON.stringify({classId:data.course.id,date:data.date,entries})});message.textContent=result.message;notify(result.message);await load();}catch(error){message.textContent=`${error.message} Puede reintentar.`;notify(error.message,'error');submit.disabled=false;submit.innerHTML=`${icon('check')} Reintentar guardado`;}});
    } catch(error){feedback.className='attendance-message is-error';feedback.textContent=`${error.message} Revise la selección y vuelva a intentarlo.`;}
  };
  form.addEventListener('submit',(event)=>{event.preventDefault();load();});
  form.addEventListener('change',load);
  if(classes.length) await load();
}
function qrVisual(id, code) {
  return `<img class="official-qr" src="/api/teacher/exits/${encodeURIComponent(id)}/qr.svg" alt="Código QR oficial ${escapeHtml(code)}" width="88" height="88">`;
}

async function renderTeacherExits() {
  const classData=await api('/api/teacher/classes');
  const classes=classData.items;
  const students=(await api('/api/teacher/students')).items;
  const today=localIsoDate();
  const hours=classData.policies || {institutionStart:'07:00',institutionEnd:'21:00'};
  const eligibleStudents=(classId)=>students.filter((item)=>item.classes.some((course)=>course.id===classId));
  const firstClass=classes.find((item)=>eligibleStudents(item.id).length)?.id || classes[0]?.id || '';
  const canRequest=Boolean(firstClass && eligibleStudents(firstClass).length);
  const requestForm=canRequest?`<form class="teacher-exit-form" id="teacher-exit-form"><label>Clase<select name="classId" required>${classes.map((item)=>`<option value="${item.id}" ${item.id===firstClass?'selected':''}>${escapeHtml(item.course)} · ${escapeHtml(item.group)}</option>`).join('')}</select></label><label>Estudiante<select name="studentId" required></select></label><label class="wide">Motivo<textarea name="reason" maxlength="300" rows="3" placeholder="Explique claramente el motivo de la salida" required></textarea></label><label>Fecha<input name="date" type="date" min="${today}" value="${today}" required></label><label>Hora<input name="time" type="time" min="${hours.institutionStart}" max="${hours.institutionEnd}" required><small>Horario institucional: ${hours.institutionStart}–${hours.institutionEnd}</small></label><div class="wide form-submit-row"><p class="form-message" aria-live="polite"></p><button class="primary-action" type="submit">${icon('send')} Enviar solicitud</button></div></form>`:`<p class="empty-notice">No hay estudiantes activos matriculados en sus clases. Coordinación debe revisar la asignación antes de registrar una salida.</p>`;
  content.innerHTML=`<div class="teacher-exit-layout"><section class="panel teacher-request-panel">${panelHeading('Nueva solicitud','Registrar retiro','Coordinación realiza la autorización final.')}<div class="request-guidance"><span>${icon('send')}</span><div><strong>Complete la solicitud de salida</strong><p>Solo se muestran estudiantes matriculados en la clase seleccionada.</p></div></div>${requestForm}</section><aside class="teacher-flow-card"><p class="section-kicker text-on-dark">Flujo institucional</p><h2>Del registro a la salida segura</h2><p class="flow-intro">Identifique fácilmente quién interviene en cada etapa.</p><ol><li><span>${icon('file')}</span><div><small>Solicitud</small><strong>Registrada por el docente</strong><p>Queda pendiente de evaluación.</p></div></li><li><span>${icon('shield')}</span><div><small>Autorización</small><strong>Revisada por Coordinación</strong><p>Genera la boleta oficial y su QR.</p></div></li><li><span>${icon('scan')}</span><div><small>Control de salida</small><strong>Validada por Vigilancia</strong><p>El QR confirma que puede retirarse.</p></div></li></ol></aside></div><section class="panel page-spacer teacher-boletas">${panelHeading('Seguimiento','Solicitudes y boletas','Estados actualizados de sus clases')}<div class="boleta-legend"><span class="legend-authorized">${icon('check')} Autorizada: salida permitida</span><span class="legend-pending">${icon('clock')} Pendiente: aún no permite la salida</span></div><div id="teacher-exit-list" class="boleta-list"></div></section>`;
  const list=content.querySelector('#teacher-exit-list');
  const draw=async()=>{const data=await api('/api/teacher/exits');list.innerHTML=data.items.length?data.items.map((item)=>`<article class="boleta-card ${item.status==='Autorizada'?'is-authorized':'is-pending'}"><header><div><span>${escapeHtml(item.id)}</span><strong>${escapeHtml(item.student)}</strong><p>${escapeHtml(item.course)}</p></div>${status(item.status)}</header><div class="boleta-details"><span><small>Motivo</small>${escapeHtml(item.reason)}</span><span><small>Fecha y hora</small>${teacherDate(item.date)} · ${escapeHtml(item.time)}</span><span><small>Registrada por</small>${escapeHtml(item.source)}</span><span><small>Autorización</small>${escapeHtml(item.authorizedBy || 'Pendiente')}</span></div>${item.status==='Autorizada'?`<div class="official-ticket"><div><span>Boleta oficial de salida</span><strong>${escapeHtml(item.qrCode)}</strong><small>Presente este código en el control de salida.</small></div>${qrVisual(item.id,item.qrCode)}</div>`:`<p class="pending-ticket">${icon('clock')} <span><strong>Esperando autorización</strong> Esta solicitud todavía no permite la salida.</span></p>`}</article>`).join(''):'<p class="empty-notice">No hay solicitudes registradas.</p>';};
  const form=content.querySelector('#teacher-exit-form');
  if(form){
    const classSelect=form.elements.classId;
    const studentSelect=form.elements.studentId;
    const submit=form.querySelector('[type="submit"]');
    const message=form.querySelector('.form-message');
    const updateStudents=()=>{const items=eligibleStudents(classSelect.value);studentSelect.innerHTML=items.length?items.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.document)}</option>`).join(''):'<option value="">Sin estudiantes matriculados</option>';studentSelect.disabled=!items.length;submit.disabled=!items.length;message.textContent=items.length?'':'La clase seleccionada no tiene estudiantes activos matriculados.';};
    classSelect.addEventListener('change',updateStudents);
    updateStudents();
    form.addEventListener('submit',async(event)=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Enviando…';try{const result=await api('/api/teacher/exits',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});message.textContent=result.message;notify(result.message);form.elements.reason.value='';form.elements.time.value='';await draw();}catch(error){message.textContent=`${error.message} Puede reintentar.`;notify(error.message,'error');}finally{button.disabled=!eligibleStudents(classSelect.value).length;button.innerHTML=`${icon('send')} Enviar solicitud`;}});
  }
  await draw();
}
async function renderTeacherReports() {
  const classes=(await api('/api/teacher/classes')).items;
  content.innerHTML=`<section class="teacher-context report-context"><span>${icon('chart')}</span><div><p class="section-kicker">Análisis académico</p><h2>Reportes de asistencia</h2><p>Visualice tendencias y exporte únicamente la información de sus grupos.</p></div><div class="teacher-report-downloads"><a id="teacher-report-xlsx" class="secondary-action" href="/api/teacher/reports.xlsx">${icon('file')} Excel</a><a id="teacher-report-pdf" class="primary-action" href="/api/teacher/reports.pdf">${icon('file')} PDF</a></div></section><section class="panel teacher-report-filter-panel"><div class="report-filter-intro"><span>${icon('scan')}</span><div><strong>Personalice la consulta</strong><small>Combine los filtros para obtener información más precisa.</small></div></div><form class="teacher-report-filters" id="teacher-report-filters"><label>Curso<select name="course"><option value="">Todos mis cursos</option>${classes.map((item)=>`<option value="${item.id}">${escapeHtml(item.course)}</option>`).join('')}</select></label><label>Grupo<select name="group"><option value="">Todos los grupos</option>${[...new Set(classes.map((item)=>item.group))].map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label>Semestre<select name="semester"><option value="">Todos</option>${[...new Set(classes.map((item)=>item.semester))].map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><label>Estado<select name="state"><option value="">Todos los estados</option>${teacherStateOptions()}</select></label><button class="primary-action" type="submit">${icon('scan')} Aplicar filtros</button></form></section><div id="teacher-report-results" class="page-spacer"></div>`;
  const form=content.querySelector('#teacher-report-filters');const host=content.querySelector('#teacher-report-results');
  const load=async()=>{const params=new URLSearchParams(new FormData(form));content.querySelector('#teacher-report-xlsx').href=`/api/teacher/reports.xlsx?${params}`;content.querySelector('#teacher-report-pdf').href=`/api/teacher/reports.pdf?${params}`;host.innerHTML='<div class="loading-state">Generando indicadores…</div>';try{const data=await api(`/api/teacher/reports?${params}`);const total=Math.max(data.total,1);const present=data.byState.find((item)=>item.state==='Presente')?.total||0;const late=data.byState.find((item)=>item.state==='Tardanza')?.total||0;const presentPct=Math.round(present/total*100);const latePct=Math.round(late/total*100);host.innerHTML=`<section class="teacher-report-kpis"><article class="report-rate"><span>${icon('chart')}</span><div><small>Índice de asistencia</small><strong>${data.attendanceRate}%</strong><p>Asistencia registrada</p></div></article><article class="report-records"><span>${icon('clipboard')}</span><div><small>Resultado de filtros</small><strong>${data.total}</strong><p>Registros encontrados</p></div></article><article class="report-classes"><span>${icon('book')}</span><div><small>Cobertura académica</small><strong>${data.byClass.filter((item)=>item.total).length}</strong><p>Clases con actividad</p></div></article></section><div class="split-grid teacher-report-insights"><section class="panel state-chart-panel">${panelHeading('Lectura visual','Radiografía de asistencia','Distribución del periodo seleccionado')}<div class="teacher-donut-layout"><div class="teacher-report-donut" data-present="${presentPct}" data-tardy="${latePct}"><span><strong>${data.attendanceRate}%</strong><small>asistencia</small></span></div><div class="teacher-report-legend">${data.byState.map((item)=>`<article class="state-${item.state.toLowerCase()}"><i></i><span><strong>${escapeHtml(item.state)}</strong><small>${data.total?Math.round(item.total/data.total*100):0}% del total</small></span><b>${item.total}</b></article>`).join('')}</div></div></section><section class="panel class-activity-panel">${panelHeading('Clases asignadas','Actividad por curso','Registros dentro del periodo')}<div class="teacher-class-report">${data.byClass.map((item)=>`<article><span class="class-report-icon">${icon('book')}</span><div><strong>${escapeHtml(item.course)}</strong><small>${escapeHtml(item.group)} · seguimiento del curso</small></div><span class="class-report-total"><b>${item.total}</b> registros</span></article>`).join('')||'<p class="empty-notice">Sin clases para los filtros seleccionados.</p>'}</div></section></div>`;applyDynamicStyles(host);}catch(error){host.innerHTML=`<section class="panel error-panel"><h2>No fue posible generar el reporte</h2><p>${escapeHtml(error.message)}</p><button class="secondary-action" id="report-retry">Reintentar</button></section>`;host.querySelector('#report-retry')?.addEventListener('click',load);}};
  form.addEventListener('submit',(event)=>{event.preventDefault();load();});form.addEventListener('change',load);await load();
}

async function renderTeacherAccount() {
  const user=(await api('/api/account')).user;
  const value=(key)=>escapeHtml(user[key]||'');
  const portrait=user.photoUrl?`<img src="${user.photoUrl}?v=${Date.now()}" alt="Foto del Docente">`:`<span>${escapeHtml(user.name.split(/\s+/).slice(0,2).map((part)=>part[0]).join(''))}</span>`;
  content.innerHTML=`<section class="teacher-profile-hero"><div class="teacher-profile-avatar" id="teacher-profile-avatar">${portrait}</div><div><p class="section-kicker text-on-dark">Perfil docente</p><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.position||'Docente')} · ${escapeHtml(user.program||'Programa por asignar')}</p><span>${icon('shield')} ${escapeHtml(user.institutionalCode||user.id)}</span></div><form id="teacher-photo-form"><input id="teacher-photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden required><label class="secondary-action" for="teacher-photo-input">Elegir foto</label><button class="primary-action" type="submit">Guardar</button></form></section><div class="split-grid profile-layout"><section class="panel">${panelHeading('Información institucional','Datos del docente','Los datos institucionales son de consulta; puede actualizar teléfono y presentación.')}<form class="account-form profile-details-grid" id="teacher-profile-form"><label>Nombre completo<input value="${value('name')}" readonly></label><label>Usuario<input value="${value('username')}" readonly></label><label>Correo institucional<input value="${value('email')}" readonly></label><label>Código institucional<input value="${value('institutionalCode')}" readonly></label><label class="wide">Programa de estudios<input value="${value('program')}" readonly></label><label>Teléfono<input name="phone" value="${value('phone')}" maxlength="20" autocomplete="tel"></label><label class="wide">Presentación<textarea name="bio" maxlength="300" rows="4">${value('bio')}</textarea></label><button class="primary-action wide" type="submit">Guardar datos autorizados</button><p class="form-message wide"></p></form></section><section class="panel">${panelHeading('Seguridad y apariencia','Preferencias de cuenta')}<form class="account-form" id="teacher-password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><small>Use 10 caracteres, mayúscula, minúscula, número y símbolo.</small><button class="primary-action" type="submit">Cambiar contraseña</button><p class="form-message"></p></form><div class="theme-control"><span><strong>Tema de la plataforma</strong><small>Alterne entre modo claro y oscuro.</small></span><button class="secondary-action" id="teacher-account-theme" type="button">Cambiar tema</button></div><button class="danger-action teacher-account-logout" data-action="logout" type="button">Cerrar sesión de forma segura</button></section></div>`;
  content.querySelector('#teacher-profile-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const payload={phone:form.elements.phone.value,bio:form.elements.bio.value};try{const result=await api('/api/account',{method:'PUT',body:JSON.stringify(payload)});form.querySelector('.form-message').textContent=result.message;currentUser=result.user;notify(result.message);refreshSessionIdentity();}catch(error){form.querySelector('.form-message').textContent=error.message;}});
  content.querySelector('#teacher-password-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;notify(result.message);form.reset();}catch(error){form.querySelector('.form-message').textContent=error.message;}});
  const photoInput=content.querySelector('#teacher-photo-input');photoInput.addEventListener('change',()=>{const file=photoInput.files[0];if(file&&file.size<=2*1024*1024)content.querySelector('#teacher-profile-avatar').innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Vista previa">`;else if(file){photoInput.value='';notify('La fotografía no debe superar 2 MB.','error');}});content.querySelector('#teacher-photo-form').addEventListener('submit',async(event)=>{event.preventDefault();try{const result=await api('/api/account/photo',{method:'POST',body:new FormData(event.currentTarget)});currentUser=result.user;csrfToken=result.user.csrf;notify(result.message);refreshSessionIdentity();await renderTeacherAccount();}catch(error){notify(error.message,'error');}});content.querySelector('#teacher-account-theme').addEventListener('click',()=>{document.body.classList.toggle('theme-dark');localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light');});
}

const tutorInitials = (name) => String(name || '').split(/\s+/).slice(0,2).map((part)=>part[0]).join('').toUpperCase();
const tutorHero = (iconName,kicker,title,copy,extra='') => `<section class="tutor-command"><span class="tutor-command-icon">${icon(iconName)}</span><div><p class="section-kicker text-on-dark">${kicker}</p><h2>${title}</h2><p>${copy}</p></div>${extra}</section>`;

async function openTutorStudent(id) {
  const data=await api(`/api/tutor/students/${encodeURIComponent(id)}`); const student=data.student;
  const dialog=document.createElement('dialog'); dialog.className='record-dialog tutor-student-dialog';
  dialog.innerHTML=`<article><header><div><p class="section-kicker">Ficha de tutoría</p><h2>${escapeHtml(student.name)}</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><section class="student-profile-strip"><span>${tutorInitials(student.name)}</span><div><strong>${escapeHtml(student.program)}</strong><small>${escapeHtml(student.semester)} · ${escapeHtml(student.group||'Sin grupo')} · ${escapeHtml(student.email)}</small></div>${status(student.state)}</section><div class="tutor-detail-grid"><section><h3>Historial de asistencia</h3>${data.attendance.length?data.attendance.slice(0,8).map((item)=>`<div class="tutor-detail-row"><span>${teacherDate(item.date)} · ${escapeHtml(item.course)}</span>${status(item.state)}</div>`).join(''):'<p class="empty-notice">Sin registros de asistencia.</p>'}</section><section><h3>Incidencias y observaciones</h3>${data.cases.length?data.cases.map((item)=>`<div class="tutor-detail-row"><span><strong>${escapeHtml(item.type)}</strong><small>${escapeHtml(item.description)}</small></span>${status(item.status)}</div>`).join(''):'<p class="empty-notice">Sin casos de permanencia.</p>'}</section></div></article>`;
  document.body.append(dialog); dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close()); dialog.addEventListener('close',()=>dialog.remove()); dialog.showModal();
}

async function renderTutorDashboard() {
  const data=await api('/api/tutor/dashboard'); const firstName=data.tutor.name.split(/\s+/)[0];
  const cards=[['Tutorados',data.summary.students,'users','blue','Estudiantes asignados'],['Presentes',data.summary.present,'check','green','Registro de hoy'],['Tardanzas',data.summary.late,'clock','amber','Registro de hoy'],['Ausentes',data.summary.absent,'alert','red','Registro de hoy'],['Alertas',data.summary.alerts,'bell','violet','Requieren revisión'],['Permanencia',data.summary.cases,'heart','teal','Casos pendientes']];
  const teacherMode=(data.tutor.roles||[]).includes('docente')?`<button class="tutor-mode-button" id="open-teacher-mode" type="button">${icon('book')} Abrir modo Docente</button>`:'';
  content.innerHTML=`${tutorHero('heart','Centro de acompañamiento',`Buen día, ${escapeHtml(firstName)}.`,`Supervise únicamente a los estudiantes asignados a su tutoría.`,teacherMode)}<section class="dashboard-section-heading"><div><p class="section-kicker">Resumen del día</p><h2>Indicadores de tutoría</h2></div><span>${teacherDate(data.today)}</span></section><section class="dashboard-metric-grid tutor-dashboard-metrics">${cards.map(([label,value,iconName,tone,detail])=>`<article class="dashboard-metric metric-accent-${tone}"><header><span class="metric-icon tone-${tone}">${icon(iconName)}</span><span class="dashboard-metric-state"><i></i> Actualizado</span></header><div><strong>${value}</strong><span>${label}</span><p>${detail}</p></div><footer>${icon('shield')} Alcance asignado</footer></article>`).join('')}</section><div class="tutor-home-grid"><section class="panel">${panelHeading('Atención prioritaria','Alertas recientes','Riesgos detectados automáticamente')}${data.alerts.length?data.alerts.map((item)=>`<article class="tutor-alert-line severity-${String(item.severity).toLowerCase().replace('í','i')}"><span>${icon('alert')}</span><div><strong>${escapeHtml(item.student)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.detail)}</small></div><b>${escapeHtml(item.severity)}</b></article>`).join(''):'<p class="empty-notice">No hay alertas pendientes.</p>'}</section><section class="panel tutor-quick-panel">${panelHeading('Navegación','Accesos rápidos','Continúe con las tareas frecuentes')}<div class="tutor-quick-grid">${[['estudiantes','users','Mis estudiantes','Consulte fichas e historial.'],['permanencia','heart','Permanencia','Registre y actualice casos.'],['alertas','bell','Alertas','Revise riesgos y derive casos.']].map(([page,iconName,title,copy])=>`<a href="${pageHref('tutor',page)}"><span>${icon(iconName)}</span><strong>${title}</strong><small>${copy}</small><b>→</b></a>`).join('')}</div></section></div>`;
  content.querySelector('#open-teacher-mode')?.addEventListener('click',async()=>{try{const result=await api('/api/account/switch-role',{method:'POST',body:JSON.stringify({role:'docente'})});window.location.href=result.redirect;}catch(error){notify(error.message,'error');}});
}

async function renderTutorStudents() {
  const initial=await api('/api/tutor/students');
  content.innerHTML=`${tutorHero('users','Padrón asignado','Mis estudiantes','Consulte asistencia, incidencias y observaciones sin acceder a otros grupos.')}<section class="panel page-spacer">${panelHeading('Directorio de tutoría','Estudiantes asignados',`${initial.items.length} estudiantes dentro de su alcance`)}<form class="tutor-filter-grid" id="tutor-student-filters"><label class="wide">${icon('scan')}<input name="search" type="search" placeholder="Buscar estudiante, documento o programa"></label><label>Semestre<select name="semester"><option value="">Todos</option>${initial.semesters.map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label>Grupo<select name="group"><option value="">Todos</option>${initial.groups.map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label>Estado<select name="state"><option value="">Todos</option><option>Activo</option><option>Inactivo</option></select></label></form><div id="tutor-student-list"></div></section>`;
  const form=content.querySelector('#tutor-student-filters'); const host=content.querySelector('#tutor-student-list'); let items=initial.items;
  const draw=()=>{host.innerHTML=items.length?rowsTable(['Estudiante','Programa','Semestre y grupo','Asistencia','Tutor','Acción'],items.map((item)=>`<tr><td><div class="personnel-cell"><span class="personnel-avatar tone-amber">${tutorInitials(item.name)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.document)} · ${escapeHtml(item.email)}</small></span></div></td><td>${escapeHtml(item.program)}</td><td><span class="semester-badge">${escapeHtml(item.semester)}</span><small class="table-subcopy">${escapeHtml(item.group||'Sin grupo')}</small></td><td>${status(item.attendanceState)}<small class="table-subcopy">${item.attendanceRate}% · ${escapeHtml(item.risk)}</small></td><td>${escapeHtml(item.tutor)}</td><td><button class="secondary-action tutor-open-student" type="button" data-id="${item.id}">${icon('eye')} Ver ficha</button></td></tr>`)):'<p class="empty-notice">No hay estudiantes para los filtros seleccionados.</p>';};
  const load=async()=>{const data=await api(`/api/tutor/students?${new URLSearchParams(new FormData(form))}`);items=data.items;draw();}; let timer; form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load().catch((error)=>notify(error.message,'error')),250);});form.addEventListener('change',()=>load().catch((error)=>notify(error.message,'error')));host.addEventListener('click',(event)=>{const button=event.target.closest('.tutor-open-student');if(button)openTutorStudent(button.dataset.id).catch((error)=>notify(error.message,'error'));});draw();
}

async function renderTutorAttendance() {
  const students=(await api('/api/tutor/students')).items; const today=localIsoDate();
  content.innerHTML=`${tutorHero('chart','Consulta académica','Asistencia de tutorados','Analice porcentajes y tendencias; el registro general corresponde al Docente.')}<section class="panel page-spacer"><form class="tutor-attendance-filters" id="tutor-attendance-filters"><label>Periodo<select id="tutor-range"><option value="day">Día</option><option value="week">Semana</option><option value="month" selected>Mes</option><option value="custom">Personalizado</option></select></label><label>Estudiante<select name="student"><option value="">Todos</option>${students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Desde<input name="from" type="date"></label><label>Hasta<input name="to" type="date" value="${today}"></label><label>Estado<select name="state"><option value="">Todos</option>${['Presente','Tardanza','Ausente','Permiso'].map((item)=>`<option>${item}</option>`).join('')}</select></label><button class="primary-action" type="submit">${icon('scan')} Consultar</button></form></section><div id="tutor-attendance-results" class="page-spacer"></div>`;
  const form=content.querySelector('#tutor-attendance-filters'); const range=content.querySelector('#tutor-range'); const host=content.querySelector('#tutor-attendance-results');
  const setRange=()=>{const end=new Date(`${today}T12:00:00`);const start=new Date(end);if(range.value==='week')start.setDate(start.getDate()-6);if(range.value==='month')start.setDate(1);if(range.value==='day'){}if(range.value!=='custom'){form.elements.from.value=start.toISOString().slice(0,10);form.elements.to.value=today;}};
  const load=async()=>{host.innerHTML='<div class="loading-state">Analizando asistencia…</div>';try{const params=new URLSearchParams(new FormData(form));const data=await api(`/api/tutor/attendance?${params}`);const max=Math.max(...data.byState.map((item)=>item.total),1);host.innerHTML=`<section class="tutor-attendance-summary"><article><span>${icon('chart')}</span><div><small>Asistencia efectiva</small><strong>${data.attendanceRate}%</strong><p>${data.total} registros consultados</p></div></article>${data.byState.map((item)=>`<article><span>${icon(item.state==='Presente'?'check':item.state==='Tardanza'?'clock':'alert')}</span><div><small>${escapeHtml(item.state)}</small><strong>${item.total}</strong><p>registros</p></div></article>`).join('')}</section><div class="report-insight-grid"><section class="panel">${panelHeading('Tendencia','Distribución de asistencia','Comparación por estado')}<div class="teacher-state-chart">${data.byState.map((item)=>`<article><span><i data-chart-height="${Math.max(8,Math.round(item.total/max*100))}"></i></span><strong>${item.total}</strong><small>${escapeHtml(item.state)}</small></article>`).join('')}</div></section><section class="panel">${panelHeading('Riesgo','Asistencia por estudiante','Menos de 75% requiere atención')}<div class="tutor-risk-list">${data.perStudent.map((item)=>`<article class="${item.risk?'is-risk':''}"><span><strong>${escapeHtml(item.name)}</strong><small>${item.records} registros</small></span><b>${item.rate}%</b></article>`).join('')||'<p class="empty-notice">Sin registros en el periodo.</p>'}</div></section></div>${data.rows.length?`<section class="panel page-spacer">${panelHeading('Detalle','Historial consultado','Información registrada por los Docentes')}${rowsTable(['Fecha','Estudiante','Curso','Grupo','Estado'],data.rows.map((item)=>`<tr><td>${teacherDate(item.date)}</td><td>${escapeHtml(item.student)}</td><td>${escapeHtml(item.course)}</td><td>${escapeHtml(item.group)}</td><td>${status(item.state)}</td></tr>`))}</section>`:''}`;applyDynamicStyles(host);}catch(error){host.innerHTML=`<section class="panel error-panel"><h2>No fue posible consultar la asistencia</h2><p>${escapeHtml(error.message)}</p></section>`;}};
  range.addEventListener('change',()=>{setRange();load();});form.addEventListener('submit',(event)=>{event.preventDefault();load();});form.addEventListener('change',(event)=>{if(event.target!==range)load();});setRange();await load();
}

async function renderTutorPermanence() {
  const initial=await api('/api/tutor/cases'); let items=initial.items;
  content.innerHTML=`${tutorHero('heart','Acompañamiento documentado','Permanencia estudiantil','Registre acciones, evidencias y cada cambio dentro de una bitácora auditable.',`<button class="tutor-mode-button" id="new-tutor-case" type="button">${icon('file')} Nuevo caso</button>`)}<section class="panel page-spacer">${panelHeading('Gestión de casos','Seguimiento de permanencia','El cierre exige evidencia o comentario final.')}<form class="tutor-filter-grid" id="tutor-case-filters"><label class="wide">${icon('scan')}<input name="search" type="search" placeholder="Buscar caso, estudiante o responsable"></label><label>Tipo<select name="type"><option value="">Todos</option>${initial.types.map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Prioridad<select name="priority"><option value="">Todas</option>${initial.priorities.map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Estado<select name="state"><option value="">Todos</option>${initial.states.map((item)=>`<option>${item}</option>`).join('')}</select></label></form><div class="tutor-case-grid" id="tutor-case-list"></div></section><dialog class="record-dialog tutor-case-dialog" id="tutor-case-dialog"><form id="tutor-case-form"><header><div><p class="section-kicker">Permanencia</p><h2 id="tutor-case-title">Nuevo caso</h2></div><button class="dialog-close" type="button" aria-label="Cerrar">×</button></header><input name="id" type="hidden"><div class="dialog-fields"><label>Estudiante<select name="studentId" required>${initial.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Fecha<input name="date" type="date" max="${localIsoDate()}" value="${localIsoDate()}" required></label><label>Tipo<select name="type">${initial.types.map((item)=>`<option>${item}</option>`).join('')}</select></label><label>Prioridad<select name="priority">${initial.priorities.map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="wide">Descripción<textarea name="description" rows="4" maxlength="800" required></textarea></label><label class="wide">Acciones tomadas<textarea name="actions" rows="3" maxlength="800"></textarea></label><label>Responsable<input name="responsible" value="${escapeHtml(currentUser.name)}" maxlength="120" required></label><fieldset class="wide case-sharing-options"><legend>Información autorizada para compartir</legend><p>Las notas internas permanecen privadas. Comparta solo el resumen que corresponda.</p><label><input name="sharedWithStudent" type="checkbox"><span>Visible para el estudiante</span></label><label><input name="sharedWithFamily" type="checkbox"><span>Visible para el padre o apoderado</span></label></fieldset><label class="wide">Próximo seguimiento compartido<input name="familyNextStep" type="date"></label><label class="wide">Evidencia adjunta<input name="evidence" type="file" accept=".pdf,image/jpeg,image/png,image/webp"><small>PDF, JPG, PNG o WebP · máximo 5 MB</small></label></div><p class="dialog-message"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Guardar caso</button></footer></form></dialog>`;
  const filters=content.querySelector('#tutor-case-filters');const list=content.querySelector('#tutor-case-list');const dialog=content.querySelector('#tutor-case-dialog');const form=content.querySelector('#tutor-case-form');
  const draw=()=>{list.innerHTML=items.length?items.map((item)=>`<article class="tutor-case-card priority-${String(item.priority).toLowerCase().replace('í','i')}"><header><span>${escapeHtml(item.id)}</span>${status(item.status)}</header><div class="case-student"><span>${tutorInitials(item.student)}</span><div><strong>${escapeHtml(item.student)}</strong><small>${escapeHtml(item.semester)} · ${escapeHtml(item.group)}</small></div><b>${escapeHtml(item.priority)}</b></div><h3>${escapeHtml(item.type)}</h3><p>${escapeHtml(item.description)}</p><dl><div><dt>Acciones</dt><dd>${escapeHtml(item.actions||'Sin acciones registradas')}</dd></div><div><dt>Responsable</dt><dd>${escapeHtml(item.responsible)}</dd></div></dl>${item.evidenceName?`<a class="evidence-link" href="/api/tutor/cases/${item.id}/evidence">${icon('file')} ${escapeHtml(item.evidenceName)}</a>`:''}<details><summary>Historial (${item.history.length})</summary>${item.history.map((entry)=>`<p><strong>${escapeHtml(entry.action)}</strong><span>${escapeHtml(entry.detail)}</span><small>${escapeHtml(entry.userName)} · ${teacherDate(entry.date)}</small></p>`).join('')||'<p>Sin movimientos.</p>'}</details><footer><button class="secondary-action" data-case-comment="${item.id}" type="button">Comentar</button><button class="secondary-action" data-case-state="${item.id}" data-next="En seguimiento" type="button">Seguimiento</button><button class="secondary-action" data-case-state="${item.id}" data-next="Derivado" type="button">Derivar</button><button class="primary-action" data-case-state="${item.id}" data-next="Cerrado" type="button">Cerrar</button></footer></article>`).join(''):'<p class="empty-notice">No hay casos para estos filtros.</p>';};
  const load=async()=>{const data=await api(`/api/tutor/cases?${new URLSearchParams(new FormData(filters))}`);items=data.items;draw();};let timer;filters.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load().catch((error)=>notify(error.message,'error')),250);});filters.addEventListener('change',()=>load().catch((error)=>notify(error.message,'error')));
  content.querySelector('#new-tutor-case').addEventListener('click',()=>{form.reset();form.elements.date.value=localIsoDate();form.elements.responsible.value=currentUser.name;dialog.showModal();});dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async(event)=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;const values=new FormData(form);values.delete('id');try{const result=await api('/api/tutor/cases',{method:'POST',body:values});notify(result.message);dialog.close();await load();}catch(error){form.querySelector('.dialog-message').textContent=error.message;}finally{button.disabled=false;}});
  list.addEventListener('click',async(event)=>{const commentButton=event.target.closest('[data-case-comment]');const stateButton=event.target.closest('[data-case-state]');if(!commentButton&&!stateButton)return;const id=(commentButton||stateButton).dataset.caseComment||(commentButton||stateButton).dataset.caseState;const promptText=stateButton?.dataset.next==='Cerrado'?'Comentario de cierre (obligatorio si no existe evidencia):':'Registre una observación para el historial:';const comment=await promptAction(promptText,'');if(comment===null)return;try{const result=commentButton?await api(`/api/tutor/cases/${id}/comments`,{method:'POST',body:JSON.stringify({comment})}):await api(`/api/tutor/cases/${id}/state`,{method:'PATCH',body:JSON.stringify({status:stateButton.dataset.next,comment})});notify(result.message);await load();}catch(error){notify(error.message,'error');}});draw();
}

async function renderTutorAlerts() {
  const initial=await api('/api/tutor/alerts');let items=initial.items;
  content.innerHTML=`${tutorHero('bell','Detección temprana','Alertas de tutoría','Revise riesgos automáticos, registre acciones y derive los casos que requieren intervención.',`<button class="tutor-mode-button" id="new-tutor-alert" type="button">${icon('alert')} Alerta manual</button>`)}<section class="panel page-spacer">${panelHeading('Bandeja de alertas','Prioridades de seguimiento','Las alertas automáticas se actualizan con la asistencia y los casos abiertos.')}<div class="permission-tabs" id="tutor-alert-tabs"><button class="is-active" data-reviewed="" type="button">Todas</button><button data-reviewed="false" type="button">Pendientes</button><button data-reviewed="true" type="button">Revisadas</button></div><div class="tutor-alert-grid" id="tutor-alert-list"></div></section><dialog class="record-dialog" id="tutor-alert-dialog"><form id="tutor-alert-form"><header><div><p class="section-kicker">Alerta manual</p><h2>Registrar observación</h2></div><button class="dialog-close" type="button">×</button></header><div class="dialog-fields"><label>Estudiante<select name="studentId">${initial.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Nivel<select name="severity">${['Baja','Media','Alta','Crítica'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="wide">Tipo<input name="type" maxlength="120" required></label><label class="wide">Detalle<textarea name="detail" rows="4" maxlength="500" required></textarea></label></div><p class="dialog-message"></p><footer><button class="secondary-action dialog-cancel" type="button">Cancelar</button><button class="primary-action" type="submit">Registrar alerta</button></footer></form></dialog>`;
  const list=content.querySelector('#tutor-alert-list');const tabs=content.querySelector('#tutor-alert-tabs');let reviewed='';
  const draw=()=>{list.innerHTML=items.length?items.map((item)=>`<article class="tutor-alert-card severity-${String(item.severity).toLowerCase().replace('í','i')} ${item.reviewed?'is-reviewed':''}"><header><span>${icon(item.automatic?'bell':'alert')} ${item.automatic?'Automática':'Manual'}</span><b>${escapeHtml(item.severity)}</b></header><h3>${escapeHtml(item.student)}</h3><strong>${escapeHtml(item.type)}</strong><p>${escapeHtml(item.detail)}</p>${item.action?`<div class="alert-action"><small>Acción registrada</small><span>${escapeHtml(item.action)}</span></div>`:''}<footer>${item.reviewed?status('Revisada'):`<button class="secondary-action" data-alert-review="${item.id}" type="button">Marcar revisada</button>`}<button class="primary-action" data-alert-derive="${item.id}" type="button" ${item.derived?'disabled':''}>${item.derived?'Derivada':'Derivar a Coordinación'}</button></footer></article>`).join(''):'<p class="empty-notice">No hay alertas en esta categoría.</p>';};
  const load=async()=>{const data=await api(`/api/tutor/alerts?reviewed=${reviewed}`);items=data.items;draw();};tabs.addEventListener('click',(event)=>{const button=event.target.closest('button');if(!button)return;reviewed=button.dataset.reviewed;tabs.querySelectorAll('button').forEach((item)=>item.classList.toggle('is-active',item===button));load().catch((error)=>notify(error.message,'error'));});
  list.addEventListener('click',async(event)=>{const review=event.target.closest('[data-alert-review]');const derive=event.target.closest('[data-alert-derive]');if(!review&&!derive)return;const action=await promptAction(derive?'Indique por qué deriva el caso:':'Registre la acción realizada:','');if(!action)return;try{const result=await api(`/api/tutor/alerts/${(review||derive).dataset.alertReview||(review||derive).dataset.alertDerive}`,{method:'PATCH',body:JSON.stringify({reviewed:Boolean(review),derived:Boolean(derive),action})});notify(result.message);await load();}catch(error){notify(error.message,'error');}});
  const dialog=content.querySelector('#tutor-alert-dialog');const form=content.querySelector('#tutor-alert-form');content.querySelector('#new-tutor-alert').addEventListener('click',()=>dialog.showModal());dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-cancel').addEventListener('click',()=>dialog.close());form.addEventListener('submit',async(event)=>{event.preventDefault();try{const result=await api('/api/tutor/alerts',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});notify(result.message);form.reset();dialog.close();await load();}catch(error){form.querySelector('.dialog-message').textContent=error.message;}});draw();
}

async function renderTutorCommunication() {
  const initial=await api('/api/tutor/communication');
  content.innerHTML=`${tutorHero('send','Vínculo académico','Comunicación y reuniones','Mantenga trazabilidad de avisos, acuerdos y compromisos de seguimiento.')}<div class="tutor-communication-grid page-spacer"><section class="panel">${panelHeading('Nuevo aviso','Enviar comunicación','Seleccione al estudiante y sus destinatarios.')}<form class="account-form" id="tutor-message-form"><label>Estudiante<select name="studentId">${initial.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Destinatarios<select name="recipients"><option>Estudiante</option><option>Apoderado</option><option>Estudiante y apoderado</option></select></label><label>Fecha<input name="date" type="date" max="${localIsoDate()}" value="${localIsoDate()}" required></label><label>Asunto<input name="subject" maxlength="120" required></label><label>Mensaje<textarea name="message" rows="5" maxlength="1000" required></textarea></label><button class="primary-action" type="submit">${icon('send')} Enviar aviso</button><p class="form-message"></p></form></section><section class="panel">${panelHeading('Tutoría','Registrar reunión','Guarde participantes, acuerdos y seguimiento.')}<form class="account-form" id="tutor-meeting-form"><label>Estudiante<select name="studentId">${initial.students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Fecha<input name="date" type="date" max="${localIsoDate()}" value="${localIsoDate()}" required></label><label>Hora<input name="time" type="time" required></label><label>Participantes<input name="participants" maxlength="180" required></label><label>Acuerdos<textarea name="agreements" rows="4" maxlength="1000" required></textarea></label><label>Seguimiento pendiente<textarea name="followUp" rows="3" maxlength="600"></textarea></label><button class="primary-action" type="submit">${icon('calendar')} Registrar reunión</button><p class="form-message"></p></form></section></div><div class="tutor-communication-history"><section class="panel">${panelHeading('Registro de envío','Avisos enviados','Historial de comunicaciones')}<div id="tutor-message-history"></div></section><section class="panel">${panelHeading('Agenda de tutoría','Reuniones registradas','Acuerdos y tareas pendientes')}<div id="tutor-meeting-history"></div></section></div>`;
  const messageHost=content.querySelector('#tutor-message-history');const meetingHost=content.querySelector('#tutor-meeting-history');let data=initial;
  const draw=()=>{messageHost.innerHTML=data.messages.length?data.messages.map((item)=>`<article class="communication-record"><span>${icon('send')}</span><div><strong>${escapeHtml(item.subject)}</strong><small>${escapeHtml(item.recipients)} · ${teacherDate(item.date)}</small><p>${escapeHtml(item.message)}</p></div></article>`).join(''):'<p class="empty-notice">Aún no hay avisos enviados.</p>';meetingHost.innerHTML=data.meetings.length?data.meetings.map((item)=>`<article class="communication-record"><span>${icon('calendar')}</span><div><strong>${teacherDate(item.date)} · ${escapeHtml(item.time)}</strong><small>${escapeHtml(item.participants)} · ${escapeHtml(item.status)}</small><p>${escapeHtml(item.agreements)}</p>${item.followUp?`<b>Seguimiento: ${escapeHtml(item.followUp)}</b>`:''}</div></article>`).join(''):'<p class="empty-notice">Aún no hay reuniones registradas.</p>';};const reload=async()=>{data=await api('/api/tutor/communication');draw();};
  for(const [selector,endpoint] of [['#tutor-message-form','/api/tutor/messages'],['#tutor-meeting-form','/api/tutor/meetings']])content.querySelector(selector).addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');button.disabled=true;try{const result=await api(endpoint,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});notify(result.message);form.reset();if(form.elements.date)form.elements.date.value=localIsoDate();await reload();}catch(error){form.querySelector('.form-message').textContent=error.message;}finally{button.disabled=false;}});draw();
}

async function renderTutorJustifications() {
  let data=await api('/api/tutor/justifications');
  content.innerHTML=`${tutorHero('file','Revisión documentaria','Justificaciones','Registre observaciones y derive a Coordinación cuando se requiera aprobación institucional.')}<section class="panel page-spacer">${panelHeading('Bandeja asignada','Justificaciones recibidas','El Tutor observa o deriva; no emite la aprobación institucional.')}<div class="tutor-justification-grid" id="tutor-justification-list"></div></section>`;
  const host=content.querySelector('#tutor-justification-list');
  const draw=()=>{host.innerHTML=data.items.length?data.items.map((item)=>`<article class="justification-card"><header><span>${escapeHtml(item.id)}</span>${status(item.status)}</header><div class="case-student"><span>${tutorInitials(item.student)}</span><div><strong>${escapeHtml(item.student)}</strong><small>${teacherDate(item.date)}</small></div></div><h3>${escapeHtml(item.reason)}</h3><p>${item.evidenceName?`${icon('file')} ${escapeHtml(item.evidenceName)}`:'Sin evidencia adjunta'}</p>${item.observation?`<div class="alert-action"><small>Observación de Tutoría</small><span>${escapeHtml(item.observation)}</span></div>`:''}<footer><button class="secondary-action" data-justification="${item.id}" data-derive="false" type="button">Registrar observación</button><button class="primary-action" data-justification="${item.id}" data-derive="true" type="button">Derivar a Coordinación</button></footer></article>`).join(''):'<p class="empty-notice">No hay justificaciones asignadas.</p>';};
  host.addEventListener('click',async(event)=>{const button=event.target.closest('[data-justification]');if(!button)return;const observation=await promptAction(button.dataset.derive==='true'?'Indique por qué requiere aprobación de Coordinación:':'Escriba la observación de Tutoría:','');if(!observation)return;try{const result=await api(`/api/tutor/justifications/${button.dataset.justification}`,{method:'PATCH',body:JSON.stringify({observation,derive:button.dataset.derive==='true'})});notify(result.message);data=await api('/api/tutor/justifications');draw();}catch(error){notify(error.message,'error');}});draw();
}

async function renderTutorReports() {
  const students=(await api('/api/tutor/students')).items;
  content.innerHTML=`${tutorHero('chart','Analítica de tutoría','Reportes y seguimiento','Asistencia, riesgos, permanencia y alertas dentro de su alcance autorizado.',`<div class="teacher-report-downloads"><a id="tutor-report-xlsx" class="secondary-action" href="/api/tutor/reports.xlsx">${icon('file')} Excel</a><a id="tutor-report-pdf" class="tutor-mode-button" href="/api/tutor/reports.pdf">${icon('clipboard')} PDF</a></div>`)}<section class="panel page-spacer"><form class="tutor-report-filters" id="tutor-report-filters"><label>Periodo<select name="semester"><option value="">Todos los semestres</option>${[...new Set(students.map((item)=>item.semester))].map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label>Grupo<select name="group"><option value="">Todos los grupos</option>${[...new Set(students.map((item)=>item.group).filter(Boolean))].map((item)=>`<option>${escapeHtml(item)}</option>`).join('')}</select></label><label>Estudiante<select name="student"><option value="">Todos</option>${students.map((item)=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Desde<input name="from" type="date" max="${localIsoDate()}"></label><label>Hasta<input name="to" type="date" max="${localIsoDate()}"></label><button class="primary-action" type="submit">${icon('scan')} Aplicar</button></form></section><div id="tutor-report-results" class="page-spacer"></div>`;
  const form=content.querySelector('#tutor-report-filters');const host=content.querySelector('#tutor-report-results');
  const load=async()=>{const params=new URLSearchParams(new FormData(form));host.innerHTML='<div class="loading-state">Preparando reporte de tutoría…</div>';try{const data=await api(`/api/tutor/reports?${params}`);content.querySelector('#tutor-report-xlsx').href=`/api/tutor/reports.xlsx?${params}`;content.querySelector('#tutor-report-pdf').href=`/api/tutor/reports.pdf?${params}`;const max=Math.max(...data.byAttendance.map((item)=>item.total),1);host.innerHTML=`<section class="tutor-report-kpis"><article><span>${icon('users')}</span><div><small>Estudiantes</small><strong>${data.students.length}</strong><p>asignados</p></div></article><article><span>${icon('alert')}</span><div><small>En riesgo</small><strong>${data.alerts.filter((item)=>!item.reviewed).length}</strong><p>alertas pendientes</p></div></article><article><span>${icon('heart')}</span><div><small>Permanencia</small><strong>${data.cases.filter((item)=>item.status!=='Cerrado').length}</strong><p>casos activos</p></div></article><article><span>${icon('check')}</span><div><small>Seguimientos</small><strong>${data.followUps}</strong><p>acciones auditadas</p></div></article></section><div class="report-insight-grid"><section class="panel">${panelHeading('Asistencia','Distribución por estado','Registros de estudiantes asignados')}<div class="teacher-state-chart">${data.byAttendance.map((item)=>`<article><span><i data-chart-height="${Math.max(8,Math.round(item.total/max*100))}"></i></span><strong>${item.total}</strong><small>${escapeHtml(item.state)}</small></article>`).join('')}</div></section><section class="panel">${panelHeading('Permanencia','Casos por estado','Seguimiento del periodo')}<div class="report-summary-list">${data.byCaseState.map((item)=>`<article><span>${status(item.state)}</span><strong>${item.total}</strong></article>`).join('')}</div><div class="tutor-alert-balance"><span>Alertas atendidas <strong>${data.alertSummary.reviewed}</strong></span><span>Pendientes <strong>${data.alertSummary.pending}</strong></span></div></section></div>`;applyDynamicStyles(host);}catch(error){host.innerHTML=`<section class="panel error-panel"><h2>No fue posible generar el reporte</h2><p>${escapeHtml(error.message)}</p></section>`;}};
  form.addEventListener('submit',(event)=>{event.preventDefault();load();});form.addEventListener('change',load);await load();
}

async function renderTutorAccount() {
  const user=(await api('/api/account')).user;const value=(key)=>escapeHtml(user[key]||'');const portrait=user.photoUrl?`<img src="${user.photoUrl}?v=${Date.now()}" alt="Foto del Tutor">`:`<span>${tutorInitials(user.name)}</span>`;
  content.innerHTML=`<section class="teacher-profile-hero tutor-profile-hero"><div class="teacher-profile-avatar" id="tutor-profile-avatar">${portrait}</div><div><p class="section-kicker text-on-dark">Perfil de Tutoría</p><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.position||'Tutor académico')} · ${escapeHtml(user.program||'Programa asignado')}</p><span>${icon('shield')} ${escapeHtml(user.institutionalCode||user.id)}</span></div><form id="tutor-photo-form"><input id="tutor-photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden required><label class="secondary-action" for="tutor-photo-input">Elegir foto</label><button class="tutor-mode-button" type="submit">Guardar</button></form></section><div class="split-grid profile-layout"><section class="panel">${panelHeading('Información institucional','Datos del Tutor','La información institucional es de consulta.')}<form class="account-form profile-details-grid" id="tutor-profile-form"><label>Nombre completo<input value="${value('name')}" readonly></label><label>Usuario<input value="${value('username')}" readonly></label><label>Correo institucional<input value="${value('email')}" readonly></label><label>Código institucional<input value="${value('institutionalCode')}" readonly></label><label class="wide">Programa de estudios<input value="${value('program')}" readonly></label><label>Teléfono<input name="phone" value="${value('phone')}" maxlength="20" autocomplete="tel"></label><label>Dirección<input name="address" value="${value('address')}" maxlength="160"></label><label class="wide">Presentación<textarea name="bio" maxlength="300" rows="4">${value('bio')}</textarea></label><button class="primary-action wide" type="submit">Guardar datos autorizados</button><p class="form-message wide"></p></form></section><section class="panel">${panelHeading('Seguridad y sesión','Preferencias de cuenta')}<form class="account-form" id="tutor-password-form"><label>Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><small>Use 10 caracteres, mayúscula, minúscula, número y símbolo.</small><button class="primary-action" type="submit">Cambiar contraseña</button><p class="form-message"></p></form><div class="theme-control"><span><strong>Tema de la plataforma</strong><small>Alterne entre modo claro y oscuro.</small></span><button class="secondary-action" id="tutor-account-theme" type="button">Cambiar tema</button></div><button class="danger-action teacher-account-logout" data-action="logout" type="button">Cerrar sesión de forma segura</button></section></div>`;
  content.querySelector('#tutor-profile-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;currentUser=result.user;refreshSessionIdentity();notify(result.message);}catch(error){form.querySelector('.form-message').textContent=error.message;}});content.querySelector('#tutor-password-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.querySelector('.form-message').textContent=result.message;form.reset();notify(result.message);}catch(error){form.querySelector('.form-message').textContent=error.message;}});const input=content.querySelector('#tutor-photo-input');input.addEventListener('change',()=>{const file=input.files[0];if(file&&file.size<=2*1024*1024)content.querySelector('#tutor-profile-avatar').innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Vista previa">`;});content.querySelector('#tutor-photo-form').addEventListener('submit',async(event)=>{event.preventDefault();try{const result=await api('/api/account/photo',{method:'POST',body:new FormData(event.currentTarget)});currentUser=result.user;csrfToken=result.user.csrf;refreshSessionIdentity();notify(result.message);await renderTutorAccount();}catch(error){notify(error.message,'error');}});content.querySelector('#tutor-account-theme').addEventListener('click',()=>{document.body.classList.toggle('theme-dark');localStorage.setItem('siga_theme',document.body.classList.contains('theme-dark')?'dark':'light');});
}

function renderGeneric(pageKey, roleKey) {
  const pageName = roles[roleKey].pages.find(([key]) => key === pageKey)[1];
  content.innerHTML = `<section class="panel">${panelHeading('Página del perfil',pageName,'Información del módulo.')}<div class="capability"><strong>${pageName}</strong><span>${pageDescription(pageKey,roleKey)}</span></div></section>`;
}

async function renderPage(roleKey, pageKey) {
  if (!roleKey) return renderHome();
  if (roleKey === 'docente') {
    if (pageKey === 'resumen') return renderTeacherDashboard();
    if (pageKey === 'horario') return renderTeacherSchedule();
    if (pageKey === 'asistencia') return renderTeacherAttendance();
    if (pageKey === 'estudiantes') return renderTeacherStudents();
    if (pageKey === 'boletas') return renderTeacherExits();
    if (pageKey === 'reportes') return renderTeacherReports();
    if (pageKey === 'cuenta') return renderTeacherAccount();
  }
  if (roleKey === 'administrador') {
    if (pageKey === 'resumen') return renderAdminDashboard();
    if (pageKey === 'programas') return renderAdminPrograms();
    if (pageKey === 'estudiantes') return renderAdminManager('students');
    if (pageKey === 'personal') return renderAdminManager('staff');
    if (pageKey === 'vinculos') return renderAdminFamilyLinks();
    if (pageKey === 'vigilantes') return renderAdminManager('guards');
    if (pageKey === 'carga-excel') return renderAdminImport();
    if (pageKey === 'reportes') return renderAdminReports();
    if (pageKey === 'configuracion') return renderAdminSecurity();
    if (pageKey === 'cuenta') return renderAdminAccount();
  }
  if (roleKey === 'coordinador') {
    if (pageKey === 'resumen') return renderCoordinatorDashboard();
    if (pageKey === 'estudiantes') return renderAdminManager('coordinatorStudents');
    if (pageKey === 'clases') return renderCoordinatorClasses();
    if (pageKey === 'horarios') return renderCoordinatorSchedules();
    if (pageKey === 'permisos') return renderCoordinatorExits();
    if (pageKey === 'justificaciones') return renderCoordinatorJustifications();
    if (pageKey === 'permanencia') return renderCoordinatorPermanence();
    if (pageKey === 'seguridad') return renderCoordinatorSecurity();
    if (pageKey === 'reportes') return renderCoordinatorReports();
    if (pageKey === 'cuenta') return renderCoordinatorAccount();
  }
  if (roleKey === 'tutor') {
    if (pageKey === 'resumen') return renderTutorDashboard();
    if (pageKey === 'estudiantes') return renderTutorStudents();
    if (pageKey === 'asistencia') return renderTutorAttendance();
    if (pageKey === 'permanencia') return renderTutorPermanence();
    if (pageKey === 'alertas') return renderTutorAlerts();
    if (pageKey === 'comunicacion') return renderTutorCommunication();
    if (pageKey === 'justificaciones') return renderTutorJustifications();
    if (pageKey === 'reportes') return renderTutorReports();
    if (pageKey === 'cuenta') return renderTutorAccount();
  }
  if (roleKey === 'estudiante') {
    if (pageKey === 'resumen') return renderStudentDashboard();
    if (pageKey === 'perfil') return renderStudentProfile(false);
    if (pageKey === 'mi-asistencia') return renderStudentAttendance();
    if (pageKey === 'solicitar-salida') return renderExitRequest(true);
    if (pageKey === 'mis-boletas') return renderExitRequest(false);
    if (pageKey === 'qr-salida') return renderStudentQr();
    if (pageKey === 'justificaciones') return renderStudentJustifications();
    if (pageKey === 'avisos') return renderStudentNotices();
    if (pageKey === 'tutoria') return renderStudentFollowUp();
    if (pageKey === 'mis-clases') return renderStudentClasses();
    if (pageKey === 'cuenta') return renderStudentProfile(true);
  }
  if (roleKey === 'padre') {
    if (pageKey === 'resumen') return renderParentDashboard();
    if (pageKey === 'hijos') return renderParentChildren();
    if (pageKey === 'asistencia') return renderParentAttendance();
    if (pageKey === 'justificaciones') return renderParentJustifications();
    if (pageKey === 'boletas') return renderParentExits();
    if (pageKey === 'qr-salida') return renderParentQr();
    if (pageKey === 'reuniones') return renderParentMeetings();
    if (pageKey === 'avisos') return renderParentNotices();
    if (pageKey === 'seguimiento') return renderParentFollowUp();
    if (pageKey === 'cuenta') return renderParentAccount();
  }
  if (roleKey === 'vigilante') {
    if (pageKey === 'resumen') return renderGuardDashboard();
    if (pageKey === 'accesos') return renderGuardAccess();
    if (pageKey === 'validar-qr') return renderGuardValidation();
    if (pageKey === 'salidas') return renderGuardExits(false);
    if (pageKey === 'historial') return renderGuardExits(true);
    if (pageKey === 'alertas') return renderGuardAlerts();
    if (pageKey === 'consulta') return renderGuardValidation(true);
    if (pageKey === 'incidencias') return renderGuardIncidents();
    if (pageKey === 'reportes') return renderGuardReports();
    if (pageKey === 'cuenta') return renderGuardAccount();
  }
  if (pageKey === 'resumen') return renderSummary(roleKey);
  if (pageKey === 'estudiantes') return renderStudents(roleKey);
  if (pageKey === 'personal') return renderStaff();
  if (['asistencia','mi-asistencia'].includes(pageKey)) return renderAttendance(pageKey === 'mi-asistencia');
  if (pageKey === 'carga-excel') return renderExcel();
  if (pageKey === 'reportes') return renderReports();
  if (pageKey === 'configuracion') return renderConfiguration();
  if (['permisos','salidas','historial','mis-permisos','boletas'].includes(pageKey)) return renderExitTable(pageKey === 'historial' ? 'Historial de validaciones' : pageKey === 'mis-permisos' ? 'Estado de mis solicitudes' : pageKey === 'boletas' ? 'Boletas oficiales de salida' : 'Solicitudes y salidas', pageKey);
  if (pageKey === 'permanencia' || pageKey === 'incidencias') return renderPermanence(roleKey);
  if (pageKey === 'seguimiento') return renderFollowUp();
  if (pageKey === 'reuniones') return renderMeetings(roleKey);
  if (pageKey === 'avisos') return renderNotices();
  if (pageKey === 'justificaciones') return renderJustifications();
  if (pageKey === 'validar-qr') return renderQr();
  if (pageKey === 'solicitar-salida') return renderExitRequest();
  return renderGeneric(pageKey,roleKey);
}

const route = resolveRoute();
function setupSkipLink() {
  if (document.querySelector('.skip-link')) return;
  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#page-content';
  skip.textContent = 'Saltar al contenido principal';
  document.body.prepend(skip);
  content.setAttribute('tabindex', '-1');
}
async function initialize() {
  setupSkipLink();
  renderShell(route.roleKey, route.pageKey);
  setupMobileNavigation();
  if (!route.roleKey) return renderHome();
  try {
    const session = await api('/api/session');
    currentUser = session.user;
    csrfToken = session.user.csrf;
    if (currentUser.role !== route.roleKey) return window.location.replace(pageHref(currentUser.role,'resumen'));
    refreshSessionIdentity();
    await configureUserTools();
    const tableObserver = new MutationObserver(() => enhanceResponsiveTables());
    tableObserver.observe(content, { childList: true, subtree: true });
    await renderPage(route.roleKey, route.pageKey);
    content.querySelectorAll('.dialog-close').forEach((button) => { if (!button.getAttribute('aria-label')) button.setAttribute('aria-label','Cerrar'); });
    if (route.roleKey === 'padre' && route.pageKey === 'boletas') {
      const firstStep = content.querySelector('.family-flow-strip article:first-child strong');
      if (firstStep) firstStep.textContent = 'Estudiante o Docente registra';
    }
    enhanceResponsiveTables();
    setupPageInteractions(route.pageKey);
  } catch (error) {
    content.innerHTML = `<section class="panel error-panel"><h2>No fue posible cargar esta página</h2><p>${escapeHtml(error.message)}</p><a class="primary-action" href="/index.html">Volver al acceso</a></section>`;
  }
}
initialize();
