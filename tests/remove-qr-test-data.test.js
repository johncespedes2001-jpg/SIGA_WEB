'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { removeTestRecord } = require('../operations/remove-qr-test-data');

test('la limpieza QR elimina solo el estudiante de prueba y sus movimientos', () => {
  const source = {
    accounts: [
      { id: 'USR-TEST', email: 'prueba.qr@siga.edu.pe', studentId: 'EST-TEST' },
      { id: 'USR-KEEP', email: 'oficial@siga.edu.pe', studentIds: ['EST-TEST', 'EST-KEEP'] },
    ],
    students: [
      { id: 'EST-TEST', document: '79990001', name: 'Prueba QR Accesos' },
      { id: 'EST-KEEP', document: '12345678', name: 'Estudiante Oficial' },
    ],
    staff: [],
    classes: [{ id: 'CLS-1', studentIds: ['EST-TEST', 'EST-KEEP'] }],
    guardAccessEntries: [{ id: 'ING-1', studentId: 'EST-TEST', guardId: 'USR-GUARD' }],
    notifications: [{ id: 'NOT-1', userId: 'USR-TEST', studentId: 'EST-TEST' }],
  };
  const { database } = removeTestRecord(source);
  assert.equal(database.accounts.length, 1);
  assert.equal(database.students.length, 1);
  assert.deepEqual(database.accounts[0].studentIds, ['EST-KEEP']);
  assert.deepEqual(database.classes[0].studentIds, ['EST-KEEP']);
  assert.equal(database.guardAccessEntries.length, 0);
  assert.equal(database.notifications.length, 0);
  assert.equal(source.accounts.length, 2, 'La simulación no muta el estado original.');
});
