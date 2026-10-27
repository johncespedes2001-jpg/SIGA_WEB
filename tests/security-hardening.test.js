'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'siga-security-test-'));
process.env.SIGA_DATA_DIR = testDataDirectory;
process.env.SIGA_STORAGE = 'json';
process.env.SIGA_DEMO_MODE = 'true';
process.env.SIGA_DISABLE_REQUEST_LOGS = 'true';
process.env.SIGA_DEMO_ADMIN_PASSWORD = 'SigaAdmin2026!';
process.env.SIGA_DEMO_TEACHER_PASSWORD = 'SigaDocente2026!';
process.env.SIGA_DEMO_COORDINATOR_PASSWORD = 'SigaCoordinador2026!';
process.env.SIGA_DEMO_TUTOR_PASSWORD = 'SigaTutor2026!';
process.env.SIGA_DEMO_PARENT_PASSWORD = 'SigaPadre2026!';
process.env.SIGA_DEMO_GUARD_PASSWORD = 'SigaVigilante2026!';
process.env.SIGA_DEMO_STUDENT_PASSWORD = 'SigaEstudiante2026!';
process.env.SIGA_DEMO_SECOND_STUDENT_PASSWORD = 'SigaValeria2026!';

const { evidenceExtension } = require('../server');
const root = path.resolve(__dirname, '..');

test.after(() => fs.rmSync(testDataDirectory, { recursive: true, force: true }));

test('las evidencias rechazan PDF con acciones o JavaScript embebido', () => {
  assert.equal(evidenceExtension(Buffer.from('%PDF-1.7\ncontenido\n%%EOF')), 'pdf');
  assert.equal(evidenceExtension(Buffer.from('%PDF-1.7\n/JavaScript /JS(alert)\n%%EOF')), '');
  assert.equal(evidenceExtension(Buffer.from('%PDF-1.7\n/OpenAction 1 0 R\n%%EOF')), '');
  assert.equal(evidenceExtension(Buffer.from('%PDF-1.7\nsin final')), '');
});

test('la política de contenido no autoriza scripts de CDN', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const clientSource = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
  assert.doesNotMatch(serverSource, /script-src[^\n]+(?:code\.jquery\.com|cdn\.jsdelivr\.net)/);
  assert.doesNotMatch(clientSource, /sigaVendorLibraries|code\.jquery\.com|chart\.umd|bootstrap\.bundle/);
});

test('los textos ya no usan tamaños inferiores a 0.70rem', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
  assert.doesNotMatch(css, /font-size:\.(?:[0-6](?:\d+)?)rem/);
});

test('el acceso usa una imagen optimizada y publica el aviso de privacidad', () => {
  const clientSource = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
  const optimizedImage = path.join(root, 'public', 'assets', 'images', 'siga-login-hero.jpg');
  assert.match(clientSource, /siga-login-hero\.jpg/);
  assert.ok(fs.statSync(optimizedImage).size < 500 * 1024);
  assert.ok(fs.existsSync(path.join(root, 'public', 'privacidad.html')));
});
