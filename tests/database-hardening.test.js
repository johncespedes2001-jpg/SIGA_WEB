'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'database', 'mariadb', '02-schema.sql'), 'utf8');
const relationalSchema = fs.readFileSync(path.join(root, 'database', 'mariadb', '03-relational-schema.sql'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'database', 'mariadb-relational-sync.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'database', 'mariadb-store.js'), 'utf8');

test('MariaDB valida el estado y los tipos de documento', () => {
  assert.match(schema, /JSON_VALID\(datos_json\)/i);
  for (const entity of ['usuarios', 'personal', 'estudiantes']) {
    assert.match(relationalSchema, new RegExp(`ck_${entity}_tipo_documento`, 'i'));
  }
  assert.match(relationalSchema, /tipo_documento IN \('DNI','CE'\)/i);
});

test('la persistencia confirma o revierte la proyección completa en una transacción', () => {
  assert.match(store, /beginTransaction\(\)/);
  assert.match(store, /syncRelationalProjection/);
  assert.match(store, /connection\.commit\(\)/);
  assert.match(store, /connection\.rollback\(\)/);
  assert.ok(store.indexOf('syncRelationalProjection') < store.indexOf('connection.commit()'));
});

test('las colecciones operativas tienen persistencia relacional', () => {
  const collections = [
    'accounts', 'students', 'staff', 'classes', 'teacherAttendance', 'attendanceAudit',
    'exitRequests', 'permanenceIncidents', 'coordinatorAudit', 'exitValidations',
    'guardAttempts', 'guardIncidents', 'guardAlertReviews', 'guardAccessEntries',
    'tutorCases', 'tutorAudit', 'tutorAlerts', 'tutorMessages', 'tutorMeetings',
    'tutorJustifications', 'notifications', 'notices', 'familyAudit', 'studentAudit', 'adminAudit',
  ];
  for (const collection of collections) assert.ok(sync.includes(`'${collection}'`), `falta sincronizar ${collection}`);
});

test('las tablas institucionales usan InnoDB y claves e índices explícitos', () => {
  assert.match(relationalSchema, /ENGINE=InnoDB/);
  assert.match(relationalSchema, /PRIMARY KEY/);
  assert.match(relationalSchema, /UNIQUE KEY uq_usuarios_correo/);
  assert.match(relationalSchema, /CONSTRAINT fk_/);
});
