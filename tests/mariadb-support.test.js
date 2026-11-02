'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'database', 'mariadb-store.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'database', 'mariadb', '02-schema.sql'), 'utf8');
const relationalSchema = fs.readFileSync(path.join(root, 'database', 'mariadb', '03-relational-schema.sql'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'database', 'verify-mariadb.js'), 'utf8');
const restoreTest = fs.readFileSync(path.join(root, 'operations', 'restore-mariadb-test.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { projectRelationalState, syncRelationalProjection, columns, insertOrder } = require('../database/mariadb-relational-sync');
const { encryptBuffer, decryptBuffer, unprotectDeterministic, protectJson, unprotectJson } = require('../database/data-protection');

test('MariaDB está declarado como proveedor institucional', () => {
  assert.match(server, /\['json', 'mariadb'\]/);
  assert.equal(packageJson.dependencies.mysql2, '^3.15.3');
});

test('el esquema MariaDB usa InnoDB, utf8mb4 y valida el JSON', () => {
  assert.match(schema, /ENGINE=InnoDB/i);
  assert.match(schema, /CHARACTER SET utf8mb4/i);
  assert.match(schema, /JSON_VALID\(datos_json\)/i);
  assert.match(schema, /revision BIGINT UNSIGNED/i);
});

test('el adaptador MariaDB confirma o revierte cada escritura', () => {
  assert.match(store, /beginTransaction\(\)/);
  assert.match(store, /revision = revision \+ 1/);
  assert.match(store, /AND revision = \?/);
  assert.match(store, /connection\.commit\(\)/);
  assert.match(store, /connection\.rollback\(\)/);
  assert.match(store, /SIGA_WRITE_CONFLICT/);
  assert.ok(store.indexOf('syncRelationalProjection') < store.indexOf('connection.commit()'));
});

test('MariaDB contiene las 27 tablas de dominio y dos vistas institucionales', () => {
  assert.equal((relationalSchema.match(/^CREATE TABLE IF NOT EXISTS/gm) || []).length, 27);
  assert.equal((relationalSchema.match(/^CREATE OR REPLACE VIEW/gm) || []).length, 2);
  for (const table of insertOrder) assert.match(relationalSchema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
});

test('la proyección relacional cubre todas las colecciones principales sin filas incompletas', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'data', 'siga.json'), 'utf8'));
  const projected = projectRelationalState(fixture);
  assert.equal(projected.usuarios.length, fixture.accounts.length);
  assert.equal(projected.estudiantes.length, fixture.students.length);
  assert.equal(projected.personal.length, fixture.staff.length);
  assert.equal(projected.clases.length, fixture.classes.length);
  assert.equal(projected.registros_acceso.length, fixture.guardAccessEntries.length);
  for (const table of insertOrder) {
    assert.ok(Array.isArray(projected[table]), `${table} debe proyectarse`);
    for (const row of projected[table]) assert.equal(row.length, columns[table].length, `${table} tiene una fila incompleta`);
  }
});

test('MariaDB remota requiere TLS en producción', () => {
  assert.match(server, /SIGA_MARIADB_SSL debe ser true cuando MariaDB está en otro servidor/);
  assert.match(store, /rejectUnauthorized/);
});

test('el usuario operativo MariaDB recibe privilegios mínimos y nunca GRANT ALL', () => {
  const setup = fs.readFileSync(path.join(root, 'operations', 'configure-mariadb-app-user.js'), 'utf8');
  assert.match(setup, /GRANT SELECT, INSERT, UPDATE, DELETE/);
  assert.doesNotMatch(setup, /GRANT ALL/i);
  assert.doesNotMatch(setup, /CREATE USER.*root/i);
});

test('la sincronización MariaDB modifica únicamente las filas que cambiaron', async () => {
  const original = {
    schemaVersion: 5,
    programs: [{ id: 'PRO-001', name: 'Programa', state: 'Activo' }],
    accounts: [{
      id: 'USR-001', name: 'Administrador', email: 'admin@siga.edu.pe', username: 'admin',
      documentType: 'DNI', document: '12345678', role: 'administrador', roles: ['administrador'],
      passwordHash: 'salt:hash', state: 'Activo',
    }],
  };
  const changed = structuredClone(original);
  changed.accounts[0].name = 'Administrador institucional';
  const calls = [];
  const connection = { query: async (sql, parameters = []) => { calls.push({ sql, parameters }); return [[], []]; } };

  const result = await syncRelationalProjection(connection, changed, projectRelationalState(original));

  assert.equal(calls.some(({ sql }) => /^DELETE FROM/i.test(sql)), false);
  const writes = calls.filter(({ sql }) => /^INSERT/i.test(sql));
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INTO `usuarios`/);
  assert.equal(result.mutations.usuarios.insertedOrUpdated, 1);
  assert.equal(Object.values(result.mutations).reduce((total, item) => total + item.deleted, 0), 0);
});

test('la sincronización MariaDB elimina por clave y nunca vacía una tabla completa', async () => {
  const original = {
    schemaVersion: 5,
    programs: [{ id: 'PRO-001', name: 'Programa', state: 'Activo' }],
    accounts: [{
      id: 'USR-001', name: 'Administrador', email: 'admin@siga.edu.pe', username: 'admin',
      documentType: 'DNI', document: '12345678', role: 'administrador', roles: ['administrador'],
      passwordHash: 'salt:hash', state: 'Activo',
    }],
  };
  const changed = { ...structuredClone(original), accounts: [] };
  const calls = [];
  const connection = { query: async (sql, parameters = []) => { calls.push({ sql, parameters }); return [[], []]; } };

  await syncRelationalProjection(connection, changed, projectRelationalState(original));

  const deletes = calls.filter(({ sql }) => /^DELETE FROM/i.test(sql));
  assert.ok(deletes.length >= 2);
  for (const { sql, parameters } of deletes) {
    assert.match(sql, / WHERE /i);
    assert.ok(parameters.length > 0);
  }
});

test('el estado y los archivos privados pueden cifrarse con AES-256-GCM', () => {
  const previous = process.env.SIGA_DATA_ENCRYPTION_KEY;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.SIGA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64url');
  process.env.NODE_ENV = 'production';
  try {
    const state = { accounts: [{ email: 'privado@siga.edu.pe', document: '12345678' }] };
    const payload = protectJson(state);
    assert.doesNotMatch(payload, /privado@siga\.edu\.pe|12345678/);
    assert.deepEqual(unprotectJson(payload), state);
    const protectedFile = encryptBuffer(Buffer.from('evidencia privada'));
    assert.notEqual(protectedFile.toString('utf8'), 'evidencia privada');
    assert.equal(decryptBuffer(protectedFile).toString('utf8'), 'evidencia privada');
  } finally {
    if (previous === undefined) delete process.env.SIGA_DATA_ENCRYPTION_KEY;
    else process.env.SIGA_DATA_ENCRYPTION_KEY = previous;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test('el verificador descifra el estado antes de comparar la proyección relacional', () => {
  assert.match(verifier, /unprotectJson\(payload\)/);
  assert.doesNotMatch(verifier, /inspectMariaDbRelational\(pool, JSON\.parse\(payload\)\)/);
});

test('la restauración comprueba que el estado cifrado también puede recuperarse', () => {
  assert.match(restoreTest, /unprotectJson\(payload\)/);
  assert.match(restoreTest, /sigaEncrypted !== 1/);
  assert.match(restoreTest, /encryptionVerified: true/);
});

test('la proyección relacional cifra datos identificativos de forma estable', () => {
  const previous = process.env.SIGA_DATA_ENCRYPTION_KEY;
  process.env.SIGA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64url');
  try {
    const state = {
      programs: [{ id: 'PRO-001', name: 'Programa', state: 'Activo' }],
      accounts: [{ id: 'USR-001', name: 'Persona Privada', email: 'persona@siga.edu.pe', document: '12345678', documentType: 'DNI', role: 'administrador', passwordHash: 'salt:hash', state: 'Activo' }],
    };
    const first = projectRelationalState(state).usuarios[0];
    const second = projectRelationalState(state).usuarios[0];
    const emailIndex = columns.usuarios.indexOf('correo');
    assert.match(first[emailIndex], /^enc:v1:/);
    assert.equal(first[emailIndex], second[emailIndex]);
    assert.equal(unprotectDeterministic(first[emailIndex], 'usuarios.correo'), 'persona@siga.edu.pe');
  } finally {
    if (previous === undefined) delete process.env.SIGA_DATA_ENCRYPTION_KEY;
    else process.env.SIGA_DATA_ENCRYPTION_KEY = previous;
  }
});
