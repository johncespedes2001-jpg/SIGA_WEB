'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function databaseConfiguration() {
  return {
    host: String(process.env.SIGA_MARIADB_HOST || '127.0.0.1').trim(),
    port: String(process.env.SIGA_MARIADB_PORT || '3306').trim(),
    database: String(process.env.SIGA_MARIADB_DATABASE || 'siga').trim(),
    user: String(process.env.SIGA_MARIADB_USER || '').trim(),
    password: String(process.env.SIGA_MARIADB_PASSWORD || ''),
  };
}

function commandCandidate(kind) {
  const configured = String(process.env[kind === 'dump' ? 'SIGA_MARIADB_DUMP_COMMAND' : 'SIGA_MARIADB_CLIENT_COMMAND'] || '').trim();
  if (configured) return configured;
  const xampp = kind === 'dump' ? 'C:\\xampp\\mysql\\bin\\mysqldump.exe' : 'C:\\xampp\\mysql\\bin\\mysql.exe';
  if (process.platform === 'win32' && fs.existsSync(xampp)) return xampp;
  return kind === 'dump' ? 'mysqldump' : 'mysql';
}

function commonArguments(configuration) {
  return [
    `--host=${configuration.host}`,
    `--port=${configuration.port}`,
    `--user=${configuration.user}`,
    '--default-character-set=utf8mb4',
  ];
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, MYSQL_PWD: options.password || '' },
      windowsHide: true,
      stdio: [options.input ? 'pipe' : 'ignore', options.output ? 'pipe' : 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      if (options.output) options.output.write(chunk);
      else stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.once('error', reject);
    child.once('close', (code) => {
      const finish = () => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${path.basename(command)} terminó con código ${code}: ${stderr.trim()}`));
      };
      if (options.output) options.output.end(finish);
      else finish();
    });
    if (options.input) options.input.pipe(child.stdin);
  });
}

module.exports = { databaseConfiguration, commandCandidate, commonArguments, run };
