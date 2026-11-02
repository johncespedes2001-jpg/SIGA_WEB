'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const relationalSchema = fs.readFileSync(path.join(root, 'database', 'mariadb', '03-relational-schema.sql'), 'utf8');
const relationalSync = fs.readFileSync(path.join(root, 'database', 'mariadb-relational-sync.js'), 'utf8');

test('MariaDB persiste entradas y salidas QR con auditoría', () => {
  assert.match(relationalSchema, /CREATE TABLE IF NOT EXISTS registros_acceso/);
  assert.match(relationalSchema, /CREATE TABLE IF NOT EXISTS bitacora_auditoria/);
  assert.match(relationalSync, /list\(state, 'guardAccessEntries'\)/);
  assert.match(relationalSync, /item\.type === 'Salida' \? 'Salida' : 'Entrada'/);
  assert.match(relationalSync, /'Acceso QR'/);
});

test('MariaDB conserva las validaciones de boletas especiales', () => {
  assert.match(relationalSchema, /CREATE TABLE IF NOT EXISTS validaciones_salida/);
  assert.match(relationalSync, /list\(state, 'exitValidations'\)/);
  assert.match(relationalSync, /'Boleta QR'/);
});
