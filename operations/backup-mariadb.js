'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { databaseConfiguration, commandCandidate, commonArguments, run } = require('./mariadb-cli');

function argument(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function sha256(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const configuration = databaseConfiguration();
  if (!configuration.user) throw new Error('Defina SIGA_MARIADB_USER antes de crear el respaldo.');
  const project = path.resolve(__dirname, '..');
  const backupDirectory = path.resolve(argument('directory', path.join(project, 'backups', 'mariadb')));
  const retentionDays = Number(argument('retention-days', '30'));
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error('--retention-days debe ser un entero positivo.');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const filename = path.join(backupDirectory, `SIGA-MariaDB-${stamp}.sql`);
  const output = fs.createWriteStream(filename, { flags: 'wx', mode: 0o600 });
  const args = [
    ...commonArguments(configuration), '--single-transaction', '--routines', '--triggers', '--events',
    '--hex-blob', '--skip-comments', configuration.database,
  ];
  try {
    await run(commandCandidate('dump'), args, { password: configuration.password, output });
  } catch (error) {
    output.destroy();
    fs.rmSync(filename, { force: true });
    throw error;
  }
  const stats = fs.statSync(filename);
  if (stats.size < 1024) throw new Error('El respaldo resultó demasiado pequeño y no se considera válido.');
  const digest = await sha256(filename);
  fs.writeFileSync(`${filename}.sha256`, `${digest}  ${path.basename(filename)}\n`, { mode: 0o600 });

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(backupDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^SIGA-MariaDB-.*\.sql(?:\.sha256)?$/.test(entry.name)) continue;
    const target = path.join(backupDirectory, entry.name);
    if (fs.statSync(target).mtimeMs < cutoff) fs.rmSync(target, { force: true });
  }
  console.log(JSON.stringify({ status: 'OK', database: configuration.database, file: filename, bytes: stats.size, sha256: digest, retentionDays }, null, 2));
}

main().catch((error) => { console.error(`RESPALDO MARIADB NO COMPLETADO: ${error.message}`); process.exitCode = 1; });
