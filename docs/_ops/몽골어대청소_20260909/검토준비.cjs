'use strict';
// 2026-09-09 대청소의 일회성 정적 자료 추출. 제품 코드 실행/모델 호출/원장 수정 없음.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const sweep = require(path.join(root, 'tools/몽골어출구.js'));
const rows = fs.readFileSync(path.join(root, 'docs/_ops/몽골어검문.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const latest = new Map(rows.map(row => [row.번역지문, row]));
const redact = text => text
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
  .replace(/https?:\/\/[^\s'"<>]+/g, '[URL]')
  .replace(/(?:AIza|sk-|AQ\.)[A-Za-z0-9_.-]{16,}/g, '[REDACTED]');
const fileLines = new Map();
const inventory = [...sweep.모으기()].map(([fingerprint, entry], index) => {
  const locations = entry.자리.map(location => {
    const match = /^(.*):(\d+)$/.exec(location);
    const filename = match[1]; const line = Number(match[2]);
    if (!fileLines.has(filename)) fileLines.set(filename, fs.readFileSync(path.join(root, filename), 'utf8').split(/\r?\n/));
    const lines = fileLines.get(filename);
    return {file: filename, line, context: lines.slice(Math.max(0, line - 3), line + 2).map(redact).join('\n')};
  });
  const result = latest.get(fingerprint);
  return {id: String(index + 1).padStart(4, '0'), fingerprint, text: entry.글, previous: result ? {reason: result.사유, layers: result.층} : null, locations};
});
fs.writeFileSync(path.join(__dirname, '조각과문맥.json'), JSON.stringify(inventory, null, 2) + '\n');
const contentLines = fileLines.get('엔진_콘텐츠AI.js');
const pairs = inventory.map(entry => {
  const matched = [];
  for (const location of entry.locations) {
    if (location.file !== '엔진_콘텐츠AI.js') continue;
    const row = contentLines[location.line - 1];
    const key = /^\s*"((?:HW|QZ|BT)\d+)":/.exec(row)?.[1];
    if (!key) continue;
    const regex = new RegExp('^\\s*\\[([\\\"\u0027])' + key + '\\1,');
    contentLines.forEach((source, index) => {
      if (regex.test(source) && /[가-힣]/.test(source)) matched.push({key, file: location.file, line: index + 1, source: redact(source)});
    });
  }
  return {id: entry.id, koreanRows: matched};
});
fs.writeFileSync(path.join(__dirname, '한국어짝.json'), JSON.stringify(pairs, null, 2) + '\n');
const batchSize = 75;
for (let offset = 0; offset < inventory.length; offset += batchSize) {
  fs.writeFileSync(path.join(__dirname, `검토묶음-${String(offset / batchSize + 1).padStart(2, '0')}.json`), JSON.stringify(inventory.slice(offset, offset + batchSize), null, 2) + '\n');
}
console.log(JSON.stringify({count: inventory.length, batches: Math.ceil(inventory.length / batchSize), files: fileLines.size, koreanPairs: pairs.filter(row => row.koreanRows.length).length}));
