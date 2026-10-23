'use strict';
// Authored grammar data is independent of the retired Apps Script engine.
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const 원천파일 = 'strata/grammar-bank.json';
function 뱅크읽기(소스) {
  const data = 소스 == null ? JSON.parse(fs.readFileSync(path.join(ROOT, 원천파일), 'utf8'))
    : typeof 소스 === 'string' ? JSON.parse(소스) : structuredClone(소스);
  const rows = data?.GRAMMAR_BANK, bands = data?.LEVEL_TOPIK_BAND;
  const grade = n => Number.isInteger(n) && n >= 1 && n <= 5;
  if (!Array.isArray(rows) || !rows.length || rows.some(g => !Array.isArray(g) || g.length !== 6
    || !/^G\d{3}$/.test(g[0]) || typeof g[1] !== 'string' || typeof g[2] !== 'string'
    || !grade(g[3]) || g[4] !== null && !grade(g[4]) || !['요', '표'].includes(g[5]))
    || new Set(rows.map(g => g[0])).size !== rows.length
    || !bands || typeof bands !== 'object' || Array.isArray(bands)
    || Object.keys(bands).length !== 6 || [1, 2, 3, 4, 5, 6].some(level =>
      !Array.isArray(bands[level]) || !bands[level].length || !bands[level].every(grade)))
    throw new TypeError('문법 뱅크 자료 규격 오류');
  return data;
}
module.exports = { ROOT, 원천파일, 뱅크읽기 };
