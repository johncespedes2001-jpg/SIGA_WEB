'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('buscar estudiantes no elimina matrículas seleccionadas de la misma clase', () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'public', 'script.js'), 'utf8');
  const match = source.match(/  const syncRoster=\(\)=>\{[^\n]+\};/);
  assert.ok(match, 'Debe existir el filtro de la matrícula.');
  const rows = [
    { dataset: { semester: 'I', group: 'I-A' }, textContent: 'Ana García', hidden: false },
    { dataset: { semester: 'I', group: 'I-A' }, textContent: 'Luis Rojas', hidden: false },
    { dataset: { semester: 'II', group: 'II-A' }, textContent: 'María Salas', hidden: false },
  ];
  const fields = rows.map((row) => ({ checked: false, closest: () => row }));
  const nodes = { '#class-student-search': { value: '' }, '#class-student-count': {}, '#class-student-result': {} };
  const form = {
    elements: { semester: { value: 'I' }, group: { value: 'I-A' } },
    querySelector: (selector) => nodes[selector],
    querySelectorAll: (selector) => selector.includes(':checked') ? fields.filter((field) => field.checked) : fields,
  };
  const normalizeGroup = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  const context = vm.createContext({ form, normalizeGroup });
  const sync = vm.runInContext(match[0] + ' syncRoster;', context);
  fields[0].checked = true;
  sync();
  nodes['#class-student-search'].value = 'Luis';
  sync();
  assert.equal(rows[0].hidden, true);
  assert.equal(rows[1].hidden, false);
  assert.equal(fields[0].checked, true);
  assert.equal(nodes['#class-student-count'].textContent, '1 seleccionado');
  form.elements.semester.value = 'II';
  form.elements.group.value = 'II-A';
  sync();
  assert.equal(fields[0].checked, false);
});
test('la búsqueda de vínculos encuentra nombres con y sin tilde sin cambiar las selecciones', () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'public', 'script.js'), 'utf8');
  const normalizer = source.match(/  const normalizeFamilySearch=\(value\)=>[^\n]+;/);
  const filter = source.match(/  const filterFamilyStudents=\(\)=>\{[^\n]+\};/);
  assert.ok(normalizer && filter, 'Debe existir la búsqueda familiar.');
  const rows = [{ textContent: 'García 12345678', hidden: false, checked: true }, { textContent: 'López 87654321', hidden: false, checked: false }];
  const result = {};
  const familySearch = { value: 'garcia' };
  const form = { querySelectorAll: () => rows, querySelector: () => result };
  const context = vm.createContext({ form, familySearch });
  const run = vm.runInContext(normalizer[0] + filter[0] + ' filterFamilyStudents;', context);
  run();
  assert.equal(rows[0].hidden, false);
  assert.equal(rows[1].hidden, true);
  assert.equal(rows[0].checked, true);
  assert.match(result.textContent, /1 estudiante encontrado/);
  familySearch.value = '87654321';
  run();
  assert.equal(rows[1].hidden, false);
  assert.equal(rows[0].checked, true);
});

test('el foco de la barra lateral contrasta con los colores de fondo declarados', () => {
  const css = fs.readFileSync(require('node:path').join(__dirname, '..', 'public', 'styles.css'), 'utf8');
  assert.match(css, /\.sidebar :where\([^}]+outline:3px solid #b3d8ff!important/);
  const luminance = (hex) => {
    const rgb = hex.match(/../g).map((part) => parseInt(part, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  for (const background of ['102e5d', '0b2146', '081832']) {
    const [high, low] = [luminance('b3d8ff'), luminance(background)].sort((a, b) => b - a);
    assert.ok((high + 0.05) / (low + 0.05) >= 3, 'Contraste insuficiente para el foco sobre #' + background);
  }
});