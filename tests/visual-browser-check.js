'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', 'public');
const evidenceDir = process.env.SIGA_VISUAL_EVIDENCE_DIR;
const program = 'Mecatrónica Automotriz';
const students = [
  { id: 'T-1', name: 'Ana García Prueba', document: '12345678', program, semester: 'I', group: 'I-A', state: 'Activo' },
  { id: 'T-2', name: 'Luis Prueba', document: '87654321', program, semester: 'I', group: 'I-A', state: 'Activo' },
];
const parents = [{ id: 'P-1', name: 'Familia Prueba', email: 'familia@example.test', state: 'Activo', relationship: 'Apoderado', students: [students[0]], studentIds: ['T-1'] }];
const users = {
  administrador: { id: 'A-1', name: 'Administración Prueba', role: 'administrador', roles: ['administrador'], csrf: 'test' },
  coordinador: { id: 'C-1', name: 'Coordinación Prueba', role: 'coordinador', roles: ['coordinador'], csrf: 'test', program },
  estudiante: { id: 'E-1', name: 'Estudiante Prueba', role: 'estudiante', roles: ['estudiante'], csrf: 'test' },
};
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const findings = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  let role = 'administrador';
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'siga-test.invalid') return route.abort();
    if (url.pathname.startsWith('/api/')) {
      let body;
      if (url.pathname === '/api/session') body = { user: users[role] };
      else if (url.pathname === '/api/notifications') body = { unread: 0, items: [] };
      else if (url.pathname === '/api/student/exits') body = { items: [] };
      else if (url.pathname === '/api/student/access-qr') body = { code: 'SIGA-ACCESS.codigo-ficticio.prueba-firmada', validDate: '2026-10-27', student: { name: 'Estudiante Prueba', program } };
      else if (url.pathname === '/api/student/access-qr.svg') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>' });
      else if (url.pathname === '/api/admin/family-links') body = { parents, students };
      else if (url.pathname === '/api/coordinator/classes') body = { items: [], teachers: [{ id: 'D-1', name: 'Docente Prueba' }], students, program, policies: {} };
      else return route.fulfill({ status: 404, json: { error: 'Servicio ficticio no disponible.' } });
      return route.fulfill({ status: 200, json: body });
    }
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const target = path.resolve(root, '.' + requested);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return route.fulfill({ status: 404, body: 'No encontrado' });
    return route.fulfill({ status: 200, contentType: mime[path.extname(target)] || 'application/octet-stream', body: fs.readFileSync(target) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 375, 768, 1366]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('http://siga-test.invalid/index.html');
    await page.waitForSelector('.role-option');
    const count = await page.locator('.role-option').count();
    const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, grid: getComputedStyle(document.querySelector('.login-role-grid')).display }));
    assert.equal(count, 6);
    findings.push({ section: 'Acceso', width, ...metrics });
    assert.ok(metrics.document <= width + 1, 'Desbordamiento horizontal en acceso ' + width);
    if (width <= 375) {
      assert.equal(metrics.grid, 'grid');
      const rolesFit = await page.locator('.role-option').evaluateAll((elements) => elements.every((element) => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }));
      assert.ok(rolesFit, 'Hay perfiles cortados en el acceso de ' + width);
    }
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://siga-test.invalid/index.html');
  await page.waitForSelector('.role-option');
  await page.locator('.role-option').first().focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.role-option').nth(1).getAttribute('aria-checked'), 'true');
  findings.push({ section: 'Acceso', teclado: 'Selección con flechas correcta' });
  const accessibilitySession = await context.newCDPSession(page);
  const accessibilityTree = await accessibilitySession.send('Accessibility.getFullAXTree');
  const accessibleRoles = accessibilityTree.nodes.filter((node) => node.role?.value === 'radio' && node.name?.value);
  assert.equal(accessibleRoles.length, 6, 'Los seis perfiles deben tener nombre accesible y rol de selección');
  assert.ok(accessibleRoles.some((node) => node.properties?.some((property) => property.name === 'checked' && property.value?.value === 'true')), 'El perfil elegido debe comunicar su estado accesible');
  await accessibilitySession.detach();
  findings.push({ section: 'Accesibilidad del acceso', arbol: 'Seis perfiles con nombre y estado de selección' });
  if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, '01-acceso-movil.png'), fullPage: true });

  role = 'administrador';
  await page.goto('http://siga-test.invalid/pages/administrador/vinculos.html');
  await page.waitForSelector('[data-family-edit]');
  await page.locator('[data-family-edit]').click();
  await page.locator('#family-student-search').fill('garcia');
  assert.equal(await page.locator('.family-student-options > label:visible').count(), 1);
  assert.equal(await page.locator('[name="studentIds"]:checked').count(), 1);
  assert.match(await page.locator('#family-selection-summary').innerText(), /García/);
  await page.locator('#family-student-search').fill('87654321');
  assert.equal(await page.locator('.family-student-options > label:visible').count(), 1);
  assert.equal(await page.locator('[name="studentIds"]:checked').count(), 1);
  const familyDialog = await page.locator('#family-link-dialog').boundingBox();
  assert.ok(familyDialog && familyDialog.x >= 0 && familyDialog.x + familyDialog.width <= 376, 'Diálogo familiar fuera de la pantalla');
  const familySearchSize = await page.locator('#family-student-search').boundingBox();
  assert.ok(familySearchSize && familySearchSize.height >= 44, 'El buscador familiar debe tener al menos 44 px de alto');
  for (const width of [320, 768, 1366]) {
    await page.setViewportSize({ width, height: 800 });
    const dialogBox = await page.locator('#family-link-dialog').boundingBox();
    assert.ok(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= width + 1, 'Diálogo familiar fuera de pantalla ' + width);
    assert.equal(await page.locator('[name="studentIds"]:checked').count(), 1);
  }
  findings.push({ section: 'Vínculos', search: 'Nombre sin tilde y documento; selección conservada', modal: 'Cabe en 320, 375, 768 y 1366 px' });
  if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, '02-vinculos-escritorio.png'), fullPage: true });
  await page.locator('#family-link-dialog .dialog-cancel').click();
  await page.setViewportSize({ width: 1366, height: 800 });
  const sidebarLink = page.locator('.sidebar .nav-link').first();
  await page.locator('.sidebar .brand').focus();
  for (let index = 0; index < 20 && !(await sidebarLink.evaluate((element) => element === document.activeElement)); index += 1) await page.keyboard.press('Tab');
  assert.equal(await sidebarLink.evaluate((element) => element === document.activeElement), true, 'No fue posible llegar a la navegación con Tab');
  const focus = await sidebarLink.evaluate((element) => ({ color: getComputedStyle(element).outlineColor, width: getComputedStyle(element).outlineWidth }));
  assert.equal(focus.color, 'rgb(179, 216, 255)');
  assert.equal(focus.width, '3px');
  await page.locator('#teacher-theme-toggle').click();
  assert.equal(await page.locator('body').evaluate((element) => element.classList.contains('theme-dark')), true);
  await page.locator('.sidebar .brand').focus();
  for (let index = 0; index < 20 && !(await sidebarLink.evaluate((element) => element === document.activeElement)); index += 1) await page.keyboard.press('Tab');
  assert.equal(await sidebarLink.evaluate((element) => getComputedStyle(element).outlineColor), 'rgb(179, 216, 255)');
  findings.push({ section: 'Navegación', focus, darkMode: 'Activado y con foco visible' });

  role = 'coordinador';
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://siga-test.invalid/pages/coordinador/clases.html');
  await page.waitForSelector('#new-class');
  await page.locator('#new-class').click();
  await page.locator('#class-form [name=group]').fill('I-A');
  await page.locator('#class-form [value="T-1"]').check();
  await page.locator('#class-student-search').fill('Luis');
  assert.equal(await page.locator('#class-form [value="T-1"]').isChecked(), true);
  assert.equal(await page.locator('#class-form [value="T-2"]').isVisible(), true);
  assert.match(await page.locator('#class-student-count').innerText(), /1 seleccionado/);
  const classDialog = await page.locator('#class-dialog').boundingBox();
  assert.ok(classDialog && classDialog.x >= 0 && classDialog.x + classDialog.width <= 376, 'Diálogo de clase fuera de pantalla');
  const classSearchSize = await page.locator('#class-student-search').boundingBox();
  assert.ok(classSearchSize && classSearchSize.height >= 44, 'El buscador de matrícula debe tener al menos 44 px de alto');
  for (const width of [320, 768, 1366]) {
    await page.setViewportSize({ width, height: 800 });
    const dialogBox = await page.locator('#class-dialog').boundingBox();
    assert.ok(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= width + 1, 'Diálogo de clase fuera de pantalla ' + width);
    assert.equal(await page.locator('#class-form [value="T-1"]').isChecked(), true);
  }
  findings.push({ section: 'Matrícula', search: 'Búsqueda conserva selección', modal: 'Cabe en 320, 375, 768 y 1366 px' });
  if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, '03-matricula-escritorio.png'), fullPage: true });

  role = 'estudiante';
  for (const width of [320, 375, 1366]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('http://siga-test.invalid/pages/estudiante/qr-salida.html');
    const manualCode = page.locator('#student-access-manual-code');
    await manualCode.waitFor();
    assert.equal(await manualCode.inputValue(), 'SIGA-ACCESS.codigo-ficticio.prueba-firmada');
    assert.equal(await manualCode.getAttribute('readonly'), '');
    assert.equal(await page.locator('label[for="student-access-manual-code"]').innerText(), 'Código para ingreso manual');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'La credencial desborda en ' + width);
  }
  findings.push({ section: 'Código diario', result: 'Código completo visible y seleccionable en 320, 375 y 1366 px' });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, findings }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });