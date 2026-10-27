const fs = require('node:fs');
const path = require('node:path');
const { FileBlob, SpreadsheetFile } = require('@oai/artifact-tool');
const ExcelJS = require('exceljs');

(async () => {
  const root = path.resolve('templates');
  const files = fs.readdirSync(root).filter((x) => x.endsWith('.xlsx')).sort();
  const results = [];
  for (const file of files) {
    const filePath = path.join(root, file);
    const artifact = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
    const summary = await artifact.inspect({ kind: 'sheet,table,definedName', maxChars: 9000, tableMaxRows: 10, tableMaxCols: 15, tableMaxCellChars: 140 });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    const headers = sheet.getRow(6).values.slice(1).map((value) => String(value || ''));
    const sample = sheet.getRow(7).values.slice(1, headers.length + 1).map((value) => String(value || ''));
    const validations = {};
    for (let col = 1; col <= headers.length; col += 1) {
      const addresses = [];
      let signature = '';
      let missing = 0;
      for (let row = 7; row <= 506; row += 1) {
        const cell = sheet.getCell(row, col);
        if (cell.dataValidation?.type) {
          const current = JSON.stringify(cell.dataValidation);
          if (!signature) signature = current;
          if (signature !== current) addresses.push(cell.address + ':different');
        } else {
          missing += 1;
        }
      }
      if (signature || missing < 500) validations[headers[col - 1]] = { signature: signature ? JSON.parse(signature) : null, missing, differences: addresses.slice(0, 10) };
    }
    const formulas = [];
    sheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) formulas.push(cell.address);
    }));
    results.push({
      file,
      size: fs.statSync(filePath).size,
      sheets: workbook.worksheets.map((item) => ({ name: item.name, state: item.state, rows: item.rowCount, columns: item.columnCount })),
      firstSheet: sheet.name,
      merges: Object.keys(sheet._merges || {}),
      freeze: sheet.views,
      headers,
      sample,
      validations,
      formulas,
      artifactInspect: summary.ndjson,
    });
  }
  process.stdout.write(JSON.stringify(results, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });