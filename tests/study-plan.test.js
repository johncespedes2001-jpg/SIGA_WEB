'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { studyPlanUnits, unitsForProgramSemester, planForProgram } = require('../study-plan-catalog');
const publicCatalog = require('../public/study-plan-catalog.json');

const expectedTotals = {
  'Arquitectura de Plataformas y Servicios de Tecnologías de Información': 36,
  'Mecatrónica Automotriz': 37,
  'Acuicultura y Procesamiento Pesquero': 40,
  'Enfermería Técnica': 40,
};

test('el catálogo contiene seis semestres para los cuatro programas', () => {
  assert.deepEqual(publicCatalog, studyPlanUnits);
  assert.deepEqual(Object.keys(studyPlanUnits), Object.keys(expectedTotals));
  for (const [program, semesters] of Object.entries(studyPlanUnits)) {
    assert.deepEqual(Object.keys(semesters), ['I', 'II', 'III', 'IV', 'V', 'VI']);
    assert.equal(Object.values(semesters).flat().length, expectedTotals[program]);
    assert.ok(Object.values(semesters).every((units) => units.length > 0));
  }
});

test('las unidades se consultan únicamente por programa y semestre', () => {
  assert.ok(unitsForProgramSemester('Mecatrónica Automotriz', 'I').includes('Mantenimiento Programado del Vehículo Automotriz'));
  assert.ok(!unitsForProgramSemester('Mecatrónica Automotriz', 'II').includes('Mantenimiento Programado del Vehículo Automotriz'));
  assert.deepEqual(unitsForProgramSemester('Programa inexistente', 'I'), []);
  const plan = planForProgram('Enfermería Técnica');
  plan.I.push('Alteración externa');
  assert.ok(!studyPlanUnits['Enfermería Técnica'].I.includes('Alteración externa'));
});
