'use strict';
// 코드 실행 없이 구문 트리에서 같은 배열 위치/객체 키의 한국어 짝을 읽는다.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const acorn = require(path.join(root, '영상/node_modules/acorn'));
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, '조각과문맥.json'), 'utf8'));
const byText = new Map(inventory.map(row => [row.text, row]));
const vars = new Map();
for (const file of ['Code.js', '엔진_콘텐츠AI.js', '엔진_폼리포트.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = acorn.parse(source, {ecmaVersion: 'latest', locations: true});
  for (const statement of ast.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const decl of statement.declarations) if (decl.id.type === 'Identifier') vars.set(decl.id.name, {node: decl.init, file});
  }
}
const output = [];
function visit(mn, ko, info, trail = []) {
  if (!mn || !ko) return;
  if (mn.type === 'Literal' && ko.type === 'Literal' && typeof mn.value === 'string' && typeof ko.value === 'string') {
    const item = byText.get(mn.value.trim()) || byText.get(mn.raw.slice(1, -1).trim());
    if (item && /[가-힣]/.test(ko.value)) output.push({id: item.id, mn: item.text, ko: ko.value, mapping: `${info.mnName}[${trail.join('][')}] ↔ ${info.koName}[${trail.join('][')}]`, koFile: info.koFile, koLine: ko.loc.start.line});
  } else if (mn.type === 'ArrayExpression' && ko.type === 'ArrayExpression') {
    mn.elements.forEach((node, index) => visit(node, ko.elements[index], info, [...trail, index]));
  } else if (mn.type === 'ObjectExpression' && ko.type === 'ObjectExpression') {
    for (const prop of mn.properties) {
      const key = prop.key.name || prop.key.value;
      const match = ko.properties.find(value => (value.key.name || value.key.value) === key);
      if (match) visit(prop.value, match.value, info, [...trail, key]);
    }
  }
}
for (const name of ['MN_FORTUNES', 'MN_SPEAK', 'MN_STORY_GRAMMAR', 'MN_STORY_TITLES', 'MN_STORY_SCENES', 'MN_STORY_EMOTIONS', 'MN_GUIDE_SPEAK']) {
  const mn = vars.get(name); const koName = name.slice(3); const ko = vars.get(koName);
  if (!mn || !ko) continue;
  visit(mn.node, ko.node, {mnName: name, koName, koFile: ko.file});
}
fs.writeFileSync(path.join(__dirname, '병렬한국어짝.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({mapped: output.length, unique: new Set(output.map(row => row.id)).size}));
