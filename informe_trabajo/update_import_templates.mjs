import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/JAIRO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/package.json",
);
const { FileBlob, SpreadsheetFile, Workbook } = require("@oai/artifact-tool");
const JSZip = require("jszip");

const root = "D:/SIGA_WEB/SIGA-Web";
const templateDir = path.join(root, "templates");
const outputDir = process.env.SIGA_TEMPLATE_OUTPUT_DIR || path.join(root, "outputs", "plantillas-carga-masiva-20261022");
const previewDir = path.join(root, "informe_trabajo", "template_previews_after");
const programs = [
  "Enfermería Técnica",
  "Acuicultura y Procesamiento Pesquero",
  "Mecatrónica Automotriz",
  "Arquitectura de Plataformas y Servicios de Tecnologías de Información",
];

const commonAccountInstructions = [
  "1. Reemplace la fila 7 por el primer registro y agregue los demás usuarios desde la fila 8. No cambie los encabezados.",
  "2. Use las listas desplegables para Tipo de documento, Programa, Estado, Semestre, Turno o Función de tutor cuando correspondan.",
  "3. DNI: 8 dígitos. CE: 9 a 15 letras o números. Usuario: 3 a 64 caracteres (minúsculas, números, punto, guion o _). Contraseña: mínimo 10 caracteres con mayúscula, minúscula, número y símbolo.",
];

const configurations = [
  {
    filename: "SIGA_plantilla_administradores.xlsx",
    sheetName: "Importar administradores",
    title: "SIGA - Importación masiva de administradores",
    color: "#2F6CBD",
    headers: ["Tipo de documento", "Documento", "Nombres", "Apellidos", "Correo", "Usuario", "Contraseña inicial", "Estado"],
    example: ["DNI", "44567890", "Carlos Alberto", "Huamán Ríos", "administrador.ejemplo@iestpcmvo.edu.pe", "administrador.ejemplo", "ClaveSegura2026!", "Activo"],
    widths: [20, 18, 24, 24, 38, 25, 25, 16],
  },
  {
    filename: "SIGA_plantilla_apoderados.xlsx",
    sheetName: "Importar apoderados",
    title: "SIGA - Importación masiva de padres o apoderados",
    color: "#2F9650",
    headers: ["Tipo de documento", "Documento", "Nombres", "Apellidos", "Correo", "Programa de estudios", "Usuario", "Contraseña inicial", "Estado"],
    example: ["CE", "CE43456789", "Elena Isabel", "Ruiz Castro", "apoderado.ejemplo@iestpcmvo.edu.pe", "Enfermería Técnica", "apoderado.ejemplo", "ClaveSegura2026!", "Activo"],
    widths: [20, 18, 24, 24, 38, 58, 25, 25, 16],
  },
  {
    filename: "SIGA_plantilla_coordinadores.xlsx",
    sheetName: "Importar coordinadores",
    title: "SIGA - Importación masiva de coordinadores",
    color: "#6B4FD3",
    headers: ["Tipo de documento", "Documento", "Nombres", "Apellidos", "Correo", "Programa de estudios", "Usuario", "Contraseña inicial", "Estado"],
    example: ["DNI", "41234567", "María Elena", "Ejemplo Salazar", "coordinador.ejemplo@iestpcmvo.edu.pe", "Mecatrónica Automotriz", "coordinador.ejemplo", "ClaveSegura2026!", "Activo"],
    widths: [20, 18, 24, 24, 38, 58, 25, 25, 16],
  },
  {
    filename: "SIGA_plantilla_docentes.xlsx",
    sheetName: "Importar docentes",
    title: "SIGA - Importación masiva de docentes",
    color: "#1A9191",
    headers: ["Tipo de documento", "Documento", "Nombres", "Apellidos", "Correo", "Programa de estudios", "Función de tutor", "Usuario", "Contraseña inicial", "Estado"],
    example: ["CE", "CE40123456", "Rosa Verónica", "Agurto Ortiz", "docente.ejemplo@iestpcmvo.edu.pe", "Arquitectura de Plataformas y Servicios de Tecnologías de Información", "Sí", "docente.ejemplo", "ClaveSegura2026!", "Activo"],
    widths: [20, 18, 24, 24, 38, 58, 20, 25, 25, 16],
  },
  {
    filename: "SIGA_plantilla_vigilantes.xlsx",
    sheetName: "Importar vigilantes",
    title: "SIGA - Importación masiva de vigilantes",
    color: "#CC4B5A",
    headers: ["Tipo de documento", "Documento", "Nombres", "Apellidos", "Correo", "Usuario", "Contraseña inicial", "Estado", "Turno"],
    example: ["CE", "CE45678901", "Julio César", "Salazar Vega", "vigilante.ejemplo@iestpcmvo.edu.pe", "vigilante.ejemplo", "ClaveSegura2026!", "Activo", "Mañana"],
    widths: [20, 18, 24, 24, 38, 25, 25, 16, 18],
  },
  {
    filename: "SIGA_plantilla_estudiantes.xlsx",
    sheetName: "Importar estudiantes",
    title: "SIGA - Importación masiva de estudiantes",
    color: "#2563EB",
    headers: ["Tipo de documento", "Documento", "Nombres", "Correo", "Semestre", "Grupo", "Programa", "Estado", "Contraseña inicial"],
    example: ["DNI", "72459631", "Diego Mendoza Ruiz", "estudiante.ejemplo@iestpcmvo.edu.pe", "II", "II-A", "Mecatrónica Automotriz", "Activo", "ClaveSegura2026!"],
    widths: [20, 18, 30, 38, 16, 18, 58, 16, 25],
  },
];

const accountRoleTemplates = new Set([
  "SIGA_plantilla_administradores.xlsx",
  "SIGA_plantilla_coordinadores.xlsx",
  "SIGA_plantilla_docentes.xlsx",
  "SIGA_plantilla_vigilantes.xlsx",
]);
const remainingTemplates = new Set([
  "SIGA_plantilla_apoderados.xlsx",
  "SIGA_plantilla_estudiantes.xlsx",
]);

const selectedConfigurations = process.argv.includes("--only-teachers")
  ? configurations.filter((item) => item.filename === "SIGA_plantilla_docentes.xlsx")
  : process.argv.includes("--only-students")
  ? configurations.filter((item) => item.filename === "SIGA_plantilla_estudiantes.xlsx")
  : process.argv.includes("--remaining")
    ? configurations.filter((item) => remainingTemplates.has(item.filename))
  : process.argv.includes("--roles")
    ? configurations.filter((item) => accountRoleTemplates.has(item.filename))
    : configurations;

function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function setValidation(sheet, headerMap, name, values) {
  const index = headerMap.get(name);
  if (index === undefined) return;
  const letter = columnLetter(index);
  sheet.getRange(`${letter}7:${letter}506`).dataValidation = {
    rule: { type: "list", values },
  };
}

function normalizeSpreadsheetXml(xml) {
  const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  if (!xml.includes(`xmlns:x="${namespace}"`)) return xml;
  return xml
    .replace(`xmlns:x="${namespace}"`, `xmlns="${namespace}"`)
    .replace(/(<\/?)(x:)/g, "$1");
}

async function makeExcelJsCompatible(rawBytes) {
  const archive = await JSZip.loadAsync(rawBytes);
  const xmlFiles = Object.keys(archive.files).filter(
    (name) => name.endsWith(".xml") && !archive.files[name].dir,
  );

  for (const name of xmlFiles) {
    const entry = archive.file(name);
    if (!entry) continue;
    const original = await entry.async("string");
    const normalized = normalizeSpreadsheetXml(original);
    if (normalized !== original) archive.file(name, normalized);
  }

  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function assertImportCompatibility(filename, bytes, expectedSheetName) {
  const appRequire = createRequire(path.join(root, "package.json"));
  const ExcelJS = appRequire("exceljs");
  const importedWorkbook = new ExcelJS.Workbook();
  await importedWorkbook.xlsx.load(bytes);
  const importedSheet = importedWorkbook.worksheets[0];
  if (!importedSheet || importedSheet.name !== expectedSheetName) {
    throw new Error(`La plantilla ${filename} no conserva la hoja esperada.`);
  }
}

if (process.argv.includes("--verify")) {
  const verifiedPreviewDir = path.join(root, "informe_trabajo", "template_previews_verified");
  await fs.mkdir(verifiedPreviewDir, { recursive: true });
  for (const configuration of selectedConfigurations) {
    const savedPath = path.join(outputDir, configuration.filename);
    const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(savedPath));
    const sheet = workbook.worksheets.getItemAt(0);
    const lastColumn = columnLetter(configuration.headers.length - 1);
    const inspection = await workbook.inspect({
      kind: "table",
      sheetId: sheet.name,
      range: `A1:${lastColumn}8`,
      include: "values,formulas",
      tableMaxRows: 8,
      tableMaxCols: 12,
      maxChars: 6000,
    });
    console.log(`\nVERIFICADA ${configuration.filename}\n${inspection.ndjson}`);
    const preview = await workbook.render({
      sheetName: sheet.name,
      range: `A1:${lastColumn}10`,
      scale: 1.5,
      format: "png",
    });
    await fs.writeFile(
      path.join(verifiedPreviewDir, configuration.filename.replace(/\.xlsx$/i, ".png")),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
  console.log(`Verificadas ${selectedConfigurations.length} plantillas exportadas.`);
  process.exit(0);
}

await fs.mkdir(templateDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

for (const configuration of selectedConfigurations) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add(configuration.sheetName);
  const lastColumn = columnLetter(configuration.headers.length - 1);
  const headerMap = new Map(configuration.headers.map((header, index) => [header, index]));

  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(6);
  sheet.tabColor = configuration.color;
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.mergeCells(`A3:${lastColumn}3`);
  sheet.mergeCells(`A4:${lastColumn}4`);
  sheet.getRange("A1").values = [[configuration.title]];
  sheet.getRange("A2:A4").values = commonAccountInstructions.map((text) => [text]);
  sheet.getRange(`A6:${lastColumn}6`).values = [configuration.headers];
  sheet.getRange(`A7:${lastColumn}7`).values = [configuration.example];

  sheet.getRange(`A1:${lastColumn}1`).format = {
    fill: configuration.color,
    font: { name: "Arial", size: 16, bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${lastColumn}4`).format = {
    fill: "#F4F7FB",
    font: { name: "Arial", size: 10, color: "#536783" },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(`A6:${lastColumn}6`).format = {
    fill: "#173B7A",
    font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#173B7A" },
  };
  sheet.getRange(`A7:${lastColumn}506`).format = {
    fill: "#FFF9E8",
    font: { name: "Arial", size: 10, color: "#17243D" },
    verticalAlignment: "center",
  };
  sheet.getRange(`A7:${lastColumn}7`).format = {
    fill: "#EAF2FF",
    font: { name: "Arial", size: 10, italic: true, color: "#415778" },
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: "#B8C9E6" },
  };
  sheet.getRange("A1").format.rowHeight = 34;
  sheet.getRange("A2:A3").format.rowHeight = 23;
  sheet.getRange("A4").format.rowHeight = 38;
  sheet.getRange("A5").format.rowHeight = 8;
  sheet.getRange(`A6:${lastColumn}6`).format.rowHeight = 30;
  sheet.getRange(`A7:${lastColumn}506`).format.rowHeight = 22;

  configuration.widths.forEach((width, index) => {
    const letter = columnLetter(index);
    sheet.getRange(`${letter}:${letter}`).format.columnWidth = width;
  });
  sheet.getRange("A7:B506").format.numberFormat = "@";

  setValidation(sheet, headerMap, "Tipo de documento", ["DNI", "CE"]);
  setValidation(sheet, headerMap, "Estado", ["Activo", "Inactivo"]);
  setValidation(sheet, headerMap, "Programa de estudios", programs);
  setValidation(sheet, headerMap, "Programa", programs);
  setValidation(sheet, headerMap, "Semestre", ["I", "II", "III", "IV", "V", "VI"]);
  setValidation(sheet, headerMap, "Turno", ["Mañana", "Tarde", "Noche", "Rotativo"]);
  setValidation(sheet, headerMap, "Función de tutor", ["Sí", "No"]);

  workbook.recalculate();
  const inspection = await workbook.inspect({
    kind: "table",
    sheetId: sheet.name,
    range: `A1:${lastColumn}8`,
    include: "values,formulas",
    tableMaxRows: 8,
    tableMaxCols: 12,
    maxChars: 6000,
  });
  console.log(`\n--- ${configuration.filename} ---\n${inspection.ndjson}`);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
    options: { useRegex: true, maxResults: 100 },
    summary: `Errores de ${configuration.filename}`,
  });
  console.log(errors.ndjson);

  const preview = await workbook.render({
    sheetName: sheet.name,
    range: `A1:${lastColumn}10`,
    scale: 1.5,
    format: "png",
  });
  await fs.writeFile(
    path.join(previewDir, configuration.filename.replace(/\.xlsx$/i, ".png")),
    new Uint8Array(await preview.arrayBuffer()),
  );

  const output = await SpreadsheetFile.exportXlsx(workbook);
  const appPath = path.join(templateDir, configuration.filename);
  const deliverablePath = path.join(outputDir, configuration.filename);
  const rawPath = path.join(outputDir, `.raw-${configuration.filename}`);
  await output.save(rawPath);
  const compatibleBytes = await makeExcelJsCompatible(await fs.readFile(rawPath));
  await assertImportCompatibility(configuration.filename, compatibleBytes, configuration.sheetName);
  await fs.writeFile(appPath, compatibleBytes);
  await fs.writeFile(deliverablePath, compatibleBytes);
  await fs.unlink(rawPath);
}

console.log(`Actualizadas ${selectedConfigurations.length} plantillas en la aplicación y en ${outputDir}.`);
