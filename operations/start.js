'use strict';

const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const provider = String(process.env.SIGA_STORAGE || '').trim().toLowerCase();
const databaseHost = String(process.env.SIGA_MARIADB_HOST || '').trim().toLowerCase();
const hasMariaDbConnection = [
  'SIGA_MARIADB_HOST',
  'SIGA_MARIADB_DATABASE',
  'SIGA_MARIADB_USER',
  'SIGA_MARIADB_PASSWORD'
].every((name) => String(process.env[name] || '').trim());

const usesLocalMariaDb = process.platform === 'win32' && (
  provider !== 'mariadb' ||
  !hasMariaDbConnection ||
  ['', '127.0.0.1', 'localhost', '::1'].includes(databaseHost)
);

if (!usesLocalMariaDb) {
  require(path.join(projectRoot, 'server.js'));
} else {
  console.log('Preparando MariaDB local de XAMPP antes de iniciar SIGA...');
  const script = path.join(__dirname, 'start-mariadb-local.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    script
  ], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });

  child.on('error', (error) => {
    console.error(`No se pudo iniciar SIGA localmente: ${error.message}`);
    process.exitCode = 1;
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`SIGA se detuvo por la señal ${signal}.`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = Number.isInteger(code) ? code : 1;
  });
}
