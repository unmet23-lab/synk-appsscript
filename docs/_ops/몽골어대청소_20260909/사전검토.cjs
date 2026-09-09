'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const spell = require(path.join(root, 'tools/lib/몽골어맞춤법.js'));
const list = JSON.parse(fs.readFileSync(path.join(__dirname, '교정확정.json'), 'utf8')).map(row => ({...row, newText: row.finalText}));
(async () => {
  const chunks = []; let chunk = []; let length = 0;
  for (const row of list) {
    if (length + row.newText.length + 1 > 800 && chunk.length) {chunks.push(chunk); chunk = []; length = 0;}
    chunk.push(row); length += row.newText.length + 1;
  }
  if (chunk.length) chunks.push(chunk);
  const results = [];
  for (const [index, items] of chunks.entries()) {
    if (index) await new Promise(resolve => setTimeout(resolve, 3000));
    const result = await spell.맞춤법검사(items.map(row => row.newText).join('\n'), {제안받기: false});
    results.push({ids: items.map(row => row.id), result, error: result === null ? spell.맞춤법검사.마지막사유 || null : null});
    console.log(JSON.stringify(results.at(-1)));
    if (result === null) break;
  }
  const evidence = {checkedAt: new Date().toISOString(), source: 'spellcheck.mn (기존 맞춤법검사 함수)', groups: results, inputs: list.map(row => ({id: row.id, text: row.newText}))};
  fs.writeFileSync(path.join(__dirname, '사전결과.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({count: list.length, groups: results.length, expectedGroups: chunks.length}));
  if (results.some(row => row.result === null) || results.length !== chunks.length) process.exitCode = 1;
})();
