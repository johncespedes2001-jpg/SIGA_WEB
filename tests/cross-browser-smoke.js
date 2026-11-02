'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const engines = String(process.env.SIGA_CROSS_BROWSER_ENGINES || 'chromium,chrome')
  .split(',')
  .map((engine) => engine.trim().toLowerCase())
  .filter(Boolean);
const script = path.join(__dirname, 'page-audit-browser.js');
const results = [];

for (const engine of engines) {
  const run = spawnSync(process.execPath, [script], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      SIGA_BROWSER_ENGINE: engine,
      SIGA_AUDIT_PAGES: 'resumen.html',
      SIGA_PAGE_AUDIT_OUTPUT_DIR: path.join('outputs', 'cross-browser', engine),
    },
    encoding: 'utf8',
  });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  results.push({ engine, status: run.status, signal: run.signal || null });
}

console.log(JSON.stringify({ check: 'SIGA cross-browser smoke', results }, null, 2));
if (results.some((result) => result.status !== 0)) process.exitCode = 1;
