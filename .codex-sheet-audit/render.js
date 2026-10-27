const fs = require('node:fs');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { FileBlob, SpreadsheetFile } = require('@oai/artifact-tool');

(async () => {
  const root = path.resolve('templates');
  const output = path.resolve('.codex-sheet-audit/previews');
  await fsp.mkdir(output, { recursive: true });
  const files = fs.readdirSync(root).filter((x) => x.endsWith('.xlsx')).sort();
  for (const file of files) {
    const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(root, file)));
    const sheet = workbook.worksheets.getItemAt(0);
    const preview = await workbook.render({ sheetName: sheet.name, range: 'A1:J12', scale: 1.2, format: 'png' });
    await fsp.writeFile(path.join(output, file.replace('.xlsx', '.png')), new Uint8Array(await preview.arrayBuffer()));
  }
  console.log(output);
})().catch((error) => { console.error(error); process.exitCode = 1; });