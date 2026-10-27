'use strict';

// Catálogo institucional transcrito de los planes de estudio proporcionados.
// Cada unidad didáctica se limita al programa y semestre en que fue publicada.
const studyPlanUnits = {
  'Arquitectura de Plataformas y Servicios de Tecnologías de Información': {
    I: [
      'Fundamentos y Diseño de Redes de Comunicación',
      'Seguridad y Optimización de Redes de Comunicación',
      'Mantenimiento de Equipos Informáticos',
      'Sistemas Operativos',
      'Lengua',
      'Ofimática',
    ],
    II: [
      'Instalación y Configuración de Redes de Comunicación',
      'Reparación de Equipos de Cómputo',
      'Auditoría Informática',
      'Lenguaje Técnico',
      "Herramientas y Aplicaciones TIC's",
    ],
    III: [
      'Organización de Recursos TI',
      'Programación de Software',
      'Algoritmos y Programación de Computadoras',
      'Base de Datos',
      'Comunicación Oral en Inglés',
      'Ética del Profesional Técnico',
      'Gestión de Conflictos',
    ],
    IV: [
      'Administración de Base de Datos',
      'Gestión de Cambios en los Proyectos',
      'Análisis y Diseño de Sistemas',
      'Mantenimiento de Sistemas de Información',
      'Administración de Servidores de Red',
      'Comunicación Escrita en Inglés',
      'Innovación Tecnológica',
    ],
    V: [
      'Marketing Digital y Comercio Electrónico',
      'Arquitectura y Diseño Web',
      'Programación de Aplicaciones Móviles',
      'Proyecto de Innovación Tecnológica',
      'Oportunidades de Negocio',
    ],
    VI: [
      'Multimedia en Plataformas TI',
      'Administración de Aplicaciones Móviles',
      'Taller de Programación Web',
      'Proyecto Integrador de Software',
      'Solución de Problemas',
      'Plan de Negocio',
    ],
  },
  'Mecatrónica Automotriz': {
    I: [
      'Mantenimiento Programado del Vehículo Automotriz',
      'Sistemas de Fluidos y Lubricantes',
      'Dibujo Mecánico',
      'Mecánica y Metrología',
      'Electricidad y Electrónica Automotriz',
      'Lengua',
      'Ofimática',
    ],
    II: [
      'Sistemas de Carga y Arranque con Asistencia Electrónica',
      'Sistema de Encendido Eléctrico y Electrónico Automotriz',
      'Sistema de Calefacción, Aire Acondicionado y Confort',
      'Sistema de Iluminación y Accesorios',
      'Lenguaje Técnico',
      "Herramientas y Aplicaciones TIC's",
    ],
    III: [
      'Sistemas de Suspensión con Asistencia Electrónica',
      'Sistema de Dirección con Asistencia Electrónica',
      'Mecánica Aplicada a Mecanismos Automotrices',
      'Sistemas de Frenos con Asistencia Electrónica',
      'Comunicación Oral en Inglés',
      'Ética del Profesional Técnico',
      'Gestión de Conflictos',
    ],
    IV: [
      'Mantenimiento del Mecanismo de Embrague con Asistencia Electrónica',
      'Caja de Velocidades con Asistencia Electrónica',
      'Mecanismo Diferencial',
      'Comunicación Escrita en Inglés',
      'Innovación Tecnológica',
    ],
    V: [
      'Configuración de los Sistemas Electrónicos del Vehículo',
      'Motor de Combustión Interna Otto',
      'Laboratorio de Sistemas de Inyección Electrónica Otto',
      'Conducción de Vehículos Menores',
      'Proyecto de Innovación Tecnológica',
      'Oportunidades de Negocio',
    ],
    VI: [
      'Motor de Combustión Interna Diésel',
      'Conducción de Vehículos Automotrices',
      'Conversión de Sistemas de Combustible a Sistema Dual',
      'Laboratorio de Sistemas de Inyección Electrónica Diésel',
      'Solución de Problemas',
      'Plan de Negocio',
    ],
  },
  'Acuicultura y Procesamiento Pesquero': {
    I: [
      'Planificación y Organización de Procesos',
      'Normas de Sanidad e Inocuidad',
      'Buenas Prácticas de Manufactura y Procedimientos Operativos Estandarizados',
      'Trazabilidad de Productos Pesqueros y Acuícolas',
      'Microbiología Aplicada',
      'Lengua',
      'Ofimática',
    ],
    II: [
      'Bioseguridad e Higiene',
      'Sistema HACCP',
      'Gestión de Calidad y Certificaciones',
      'Biotecnología Aplicada',
      'Lenguaje Técnico',
      "Herramientas y Aplicaciones TIC's",
    ],
    III: [
      'Planificación y Organización Acuícola',
      'Infraestructura e Instalaciones Pesqueras',
      'Cultivo de Peces',
      'Cultivo de Moluscos',
      'Nutrición y Alimentación',
      'Legislación Pesquera y Acuícola',
      'Comunicación Oral en Inglés',
      'Ética del Profesional Técnico',
      'Gestión de Conflictos',
    ],
    IV: [
      'Patología y Sanidad Acuícola',
      'Reproducción y Genética de Organismos Acuáticos',
      'Cultivo de Crustáceos',
      'Manejo de Calidad de Agua y Suelo',
      'Comunicación Escrita en Inglés',
      'Innovación Tecnológica',
    ],
    V: [
      'Conservación de Productos Hidrobiológicos',
      'Tecnología de Productos Curados y Sub Productos de la Pesca',
      'Tecnología de Pastas y Conservas',
      'Maquinaria, Equipos e Instalaciones de Procesamiento',
      'Proyecto de Innovación Tecnológica',
      'Oportunidades de Negocio',
    ],
    VI: [
      'Tecnología de Productos Congelados',
      'Tecnología de Productos Innovadores y Valor Agregado',
      'Análisis y Ensayos Bromatológicos',
      'Gestión Ambiental de la Industria Pesquera',
      'Solución de Problemas',
      'Plan de Negocio',
    ],
  },
  'Enfermería Técnica': {
    I: [
      'Terminología en Salud',
      'Técnicas de la Comunicación en Salud',
      'Anatomía y Fisiología',
      'Primeros Auxilios',
      'Lengua',
      'Ofimática',
    ],
    II: [
      'Salud Pública y Comunitaria',
      'Epidemiología y Vigilancia Activa',
      'Salud Ocupacional',
      'Enfermería en Inmunizaciones',
      'Lenguaje Técnico',
      "Herramientas y Aplicaciones TIC's",
    ],
    III: [
      'Enfermería Básica Ambulatoria y Hospitalaria',
      'Muestras Biológicas',
      'Bioseguridad y Esterilización',
      'Administración de Medicamentos',
      'Comunicación Oral en Inglés',
      'Ética del Profesional Técnico',
      'Gestión de Conflictos',
    ],
    IV: [
      'Nutrición y Dietoterapia',
      'Atención al Usuario con Patologías',
      'Procedimientos Invasivos y No Invasivos',
      'Atención al Usuario Quirúrgico',
      'Operaciones Administrativas y Documentación Sanitaria',
      'Comunicación Escrita en Inglés',
      'Innovación Tecnológica',
    ],
    V: [
      'Enfermería en Salud Materna Neonatal',
      'Enfermería en Salud del Niño y Adolescente',
      'Enfermería en Salud del Adulto Mayor',
      'Enfermería en Salud Mental',
      'Psicología del Paciente Discapacitado',
      'Proyecto de Innovación Tecnológica',
      'Oportunidades de Negocio',
    ],
    VI: [
      'Fisioterapia y Rehabilitación',
      'Salud Bucal',
      'Medicina Alternativa',
      'Atención al Usuario Oncológico',
      'Farmacología',
      'Solución de Problemas',
      'Plan de Negocio',
    ],
  },
};

for (const semesters of Object.values(studyPlanUnits)) {
  for (const units of Object.values(semesters)) Object.freeze(units);
  Object.freeze(semesters);
}
Object.freeze(studyPlanUnits);

function unitsForProgramSemester(program, semester) {
  return [...(studyPlanUnits[String(program || '')]?.[String(semester || '')] || [])];
}

function planForProgram(program) {
  const plan = studyPlanUnits[String(program || '')] || {};
  return Object.fromEntries(Object.entries(plan).map(([semester, units]) => [semester, [...units]]));
}

module.exports = { studyPlanUnits, unitsForProgramSemester, planForProgram };
