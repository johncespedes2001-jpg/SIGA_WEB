'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { clearState, preservedEmails } = require('../operations/reset-test-users');

const account = (email, id, role, extras = {}) => ({
  id, email, role, roles: [role], state: 'Activo', ...extras,
});

test('la limpieza conserva solamente las seis cuentas, sus vínculos y los catálogos', () => {
  const source = {
    schemaVersion: 5,
    programs: [{ id: 'PRO-001', name: 'Mecatrónica Automotriz', state: 'Activo' }],
    nextIds: { student: 28, staff: 44, class: 12 },
    accounts: [
      account('admin@siga.edu.pe', 'USR-001', 'administrador'),
      account('coordinador@siga.edu.pe', 'USR-002', 'coordinador'),
      account('docente@siga.edu.pe', 'USR-003', 'docente'),
      account('padre@siga.edu.pe', 'USR-004', 'padre', { studentIds: ['EST-001'] }),
      account('vigilante@siga.edu.pe', 'USR-005', 'vigilante'),
      account('estudiante@siga.edu.pe', 'USR-006', 'estudiante', { studentId: 'EST-001' }),
      account('eliminar@siga.edu.pe', 'USR-007', 'docente'),
    ],
    students: [
      { id: 'EST-001', email: 'estudiante@siga.edu.pe', state: 'Activo' },
      { id: 'EST-002', email: 'eliminar@siga.edu.pe', state: 'Activo' },
    ],
    staff: [
      { id: 'PER-001', accountId: 'USR-003', email: 'docente@siga.edu.pe', state: 'Activo' },
      { id: 'PER-002', accountId: 'USR-007', email: 'eliminar@siga.edu.pe', state: 'Activo' },
    ],
    classes: [{ id: 'CLS-001' }],
    notifications: [{ id: 'NOT-001' }],
    securityAudit: [{ id: 'SEC-001' }],
  };

  const result = clearState(source).database;

  assert.equal(result.accounts.length, preservedEmails.size);
  assert.deepEqual(new Set(result.accounts.map((item) => item.email)), preservedEmails);
  assert.deepEqual(result.students.map((item) => item.id), ['EST-001']);
  assert.deepEqual(result.staff.map((item) => item.id), ['PER-001']);
  assert.deepEqual(result.classes, []);
  assert.deepEqual(result.notifications, []);
  assert.deepEqual(result.securityAudit, []);
  assert.deepEqual(result.programs, source.programs);
  assert.deepEqual(result.nextIds, source.nextIds);
  assert.equal(source.accounts.length, 7, 'la simulación no modifica el estado original');
});

test('la limpieza puede crear únicamente el Vigilante faltante cuando se solicita', () => {
  const accounts = [...preservedEmails]
    .filter((email) => email !== 'vigilante@siga.edu.pe')
    .map((email, index) => account(email, `USR-${index + 1}`, email === 'estudiante@siga.edu.pe' ? 'estudiante' : 'docente'));
  const result = clearState({ accounts, students: [], staff: [] }, {
    provisionMissingGuard: true,
    guardPassword: 'SigaVigilante2026!',
  });

  assert.equal(result.provisionedGuard, true);
  assert.equal(result.database.accounts.length, preservedEmails.size);
  assert.equal(result.database.accounts.find((item) => item.email === 'vigilante@siga.edu.pe').role, 'vigilante');
  assert.equal(result.database.staff.filter((item) => item.role === 'Vigilante').length, 1);
});

test('la limpieza se detiene si falta una cuenta que debe conservarse', () => {
  assert.throws(
    () => clearState({ accounts: [account('admin@siga.edu.pe', 'USR-001', 'administrador')] }),
    /No se encontraron las cuentas/,
  );
});
