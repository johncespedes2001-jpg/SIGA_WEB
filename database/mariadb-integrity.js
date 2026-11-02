'use strict';

const { projectRelationalState, insertOrder } = require('./mariadb-relational-sync');

async function inspectMariaDbRelational(pool, logicalState) {
  const [schemaRows] = await pool.query(`
    SELECT
      SUM(table_type = 'BASE TABLE') AS tables_found,
      SUM(table_type = 'VIEW') AS views_found
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);
  const expected = projectRelationalState(logicalState);
  const counts = {};
  const mismatches = [];
  for (const table of insertOrder) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    const actual = Number(rows[0].total);
    const expectedCount = expected[table].length;
    counts[table] = actual;
    if (actual !== expectedCount) mismatches.push({ table, expected: expectedCount, actual });
  }

  const [orphanRows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM estudiantes e LEFT JOIN programas p ON p.programa_id=e.programa_id WHERE p.programa_id IS NULL) AS estudiantes_sin_programa,
      (SELECT COUNT(*) FROM matriculas_clase m LEFT JOIN clases c ON c.clase_id=m.clase_id LEFT JOIN estudiantes e ON e.estudiante_id=m.estudiante_id WHERE c.clase_id IS NULL OR e.estudiante_id IS NULL) AS matriculas_huerfanas,
      (SELECT COUNT(*) FROM registros_asistencia a LEFT JOIN clases c ON c.clase_id=a.clase_id LEFT JOIN estudiantes e ON e.estudiante_id=a.estudiante_id WHERE c.clase_id IS NULL OR e.estudiante_id IS NULL) AS asistencias_huerfanas,
      (SELECT COUNT(*) FROM registros_acceso a LEFT JOIN usuarios u ON u.usuario_id=a.vigilante_usuario_id LEFT JOIN estudiantes e ON e.estudiante_id=a.estudiante_id WHERE u.usuario_id IS NULL OR e.estudiante_id IS NULL) AS accesos_huerfanos,
      (SELECT COUNT(*) FROM vinculos_apoderado_estudiante v LEFT JOIN usuarios u ON u.usuario_id=v.apoderado_usuario_id LEFT JOIN estudiantes e ON e.estudiante_id=v.estudiante_id WHERE u.usuario_id IS NULL OR e.estudiante_id IS NULL) AS vinculos_huerfanos
  `);
  const orphans = Object.fromEntries(Object.entries(orphanRows[0]).map(([key, value]) => [key, Number(value)]));
  const orphanTotal = Object.values(orphans).reduce((sum, value) => sum + value, 0);
  const tablesFound = Number(schemaRows[0].tables_found);
  const viewsFound = Number(schemaRows[0].views_found);
  return {
    status: tablesFound >= 28 && viewsFound >= 2 && !mismatches.length && orphanTotal === 0 ? 'OK' : 'REVISAR',
    schema: { tablesFound, viewsFound },
    counts,
    mismatches,
    orphans,
  };
}

module.exports = { inspectMariaDbRelational };
