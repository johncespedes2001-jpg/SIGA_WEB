'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const project = path.resolve(__dirname, '..');
const assets = ['public/script.js', 'public/styles.css'];
const report = [];

for (const relative of assets) {
  const sourcePath = path.join(project, relative);
  const source = fs.readFileSync(sourcePath);
  const gzip = zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION });
  const brotli = zlib.brotliCompressSync(source, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT },
  });
  fs.writeFileSync(`${sourcePath}.gz`, gzip);
  fs.writeFileSync(`${sourcePath}.br`, brotli);
  report.push({ file: relative, raw: source.length, gzip: gzip.length, brotli: brotli.length });
}

console.log(JSON.stringify({ check: 'SIGA production assets', status: 'OK', files: report }, null, 2));
