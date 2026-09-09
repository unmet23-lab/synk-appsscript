'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, '조각과문맥.json'), 'utf8'));
const idPairs = JSON.parse(fs.readFileSync(path.join(__dirname, '한국어짝.json'), 'utf8'));
const parallel = JSON.parse(fs.readFileSync(path.join(__dirname, '병렬한국어짝.json'), 'utf8'));
const candidates = new Map();
for (const name of fs.readdirSync(__dirname).filter(name => /^검토결과-\d+\.json$/.test(name)).sort()) {
  for (const row of JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'))) {
    if (row.status === 'correct') candidates.set(row.id, {id: row.id, newText: row.newText, reasons: [row.reasonKo], evidence: [name]});
  }
}
for (const name of fs.readdirSync(__dirname).filter(name => /^뜻결과-.*\.json$/.test(name)).sort()) {
  for (const row of JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')).issues) {
    if (!row.suggestedMn) continue;
    const current = candidates.get(row.id);
    candidates.set(row.id, {id: row.id, newText: row.suggestedMn, reasons: [...(current?.reasons || []), row.reasonKo], evidence: [...(current?.evidence || []), name]});
  }
}
const output = [...candidates.values()].sort((a,b) => a.id.localeCompare(b.id)).map(row => {
  const item = inventory.find(item => item.id === row.id);
  return {...row, oldText: item.text, locations: item.locations, koreanRows: idPairs.find(item => item.id === row.id)?.koreanRows || [], parallelKorean: parallel.filter(item => item.id === row.id)};
});
const manual = JSON.parse(fs.readFileSync(path.join(__dirname, '추가편집판정.json'), 'utf8'));
for (const item of manual) {
  let current = output.find(row => row.id === item.id);
  if (!current) {
    const source = inventory.find(row => row.id === item.id);
    current = {id: item.id, oldText: source.text, newText: source.text, reasons: [], evidence: [], locations: source.locations, koreanRows: idPairs.find(row => row.id === item.id)?.koreanRows || [], parallelKorean: parallel.filter(row => row.id === item.id)};
    output.push(current);
  }
  if (item.useOriginal) current.newText = current.oldText;
  if (!current.newText.includes(item.from)) throw new Error(`추가 교정의 원래 문구 없음: ${item.id}`);
  current.newText = current.newText.replaceAll(item.from, item.to);
  current.reasons.push(item.reason); current.evidence.push('추가편집판정.json');
}
output.sort((a,b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(__dirname, '교정후보.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({candidates: output.length}));
