// 찰칵 낱말 문항에 낱말 태그를 붙인다(결함 4). 대상 폴더(proto 또는 작업본)를 첫 인자로 받는다.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'experiences/snap-words/learning.mjs');
let text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const table = { library: 'w0600', dorm: 'w0743', cafeteria: 'w0553', bank: 'w0039', bookstore: 'w0762', post: 'w0040', pharmacy: 'w0801',
  office: 'w0605', university: 'w0733', stop: 'w0776', cat: 'w0042', bike: 'w0035', tree: 'w0050', building: 'w0391', toilet: 'w0619',
  stairs: 'w1737', entrance: 'w1715', umbrella: 'w0025', sofa: 'w0723', menu: 'w0752' };
const lines = Object.entries(table).map(([id, w]) => `${id}: 'ko.word.${w}'`);
const block = `// 낱말 태그(11-10 Atlas 검수 결함 4): 문항이 어느 낱말을 묻는지 Core가 알게 한다. 값은 Strata TOPIK I 지도의 낱말 마디\n` +
  `// (국립국어원 학습용 어휘 A · B, strata/topik-i.words.json)이고 learning.test.mjs가 한국어 낱말과 마디 이름이 같은지 본다.\n` +
  `// 목록 밖 낱말(band life · notice)은 마디가 없어 태그가 없다.\n` +
  `export const WORD_CONCEPT = Object.freeze({\n  ${lines.reduce((rows, line) => { const last = rows.at(-1); if (last && last.length + line.length < 120) rows[rows.length - 1] = `${last}, ${line}`; else rows.push(line); return rows; }, []).join(',\n  ')},\n});\n`;
const anchor = `export const SKILL = Object.freeze(`;
if (!text.includes(anchor) || text.includes('WORD_CONCEPT')) throw new Error('anchor');
text = text.replace(anchor, block.replace(/\n/g, eol) + anchor);
const from = `responseFormat: FORMAT, audioRequired: sound, confounded: false, conceptIds: [] };`;
if (!text.includes(from)) throw new Error('metadata');
text = text.replace(from, `responseFormat: FORMAT, audioRequired: sound, confounded: false, conceptIds: WORD_CONCEPT[word] ? [WORD_CONCEPT[word]] : [] };`);
fs.writeFileSync(file, text);
console.log('고침 snap-words', Object.keys(table).length);
