'use strict';

// Ejecuta las pruebas sin abrir puertos ni acceder a datos institucionales.
const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const testFiles = readdirSync(join(process.cwd(), 'tests'))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join('tests', name));

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: process.cwd(),
  env: { ...process.env, SIGA_TEST_IN_MEMORY_HTTP: 'true' },
  stdio: 'inherit',
  shell: false,
});

process.exitCode = Number.isInteger(result.status) ? result.status : 1;
