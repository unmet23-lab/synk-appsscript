// 엔진 규칙 시험 파일을 10월 자료 표본(tests/fixtures/path-travel-catalog-20261009)으로
// 돌리도록 머리의 정적 import를 동적 import로 바꾼다. node: 내장 모듈은 그대로 둔다.
// 쓰는 법: node experiences/path-travel/qa/recheck-20261107/use-snapshot-in-tests.mjs tests/<파일>…
import fs from 'node:fs';

const HOOK = "import './fixtures/path-travel-catalog-20261009/use-snapshot.mjs';";
const toDynamic = (clause, from) => {
  clause = clause.trim();
  if (!clause) return `await import('${from}');`;
  const parts = [], named = clause.match(/\{([\s\S]*)\}/);
  const head = clause.replace(/\{[\s\S]*\}/, '').replace(/,\s*$/, '').trim();
  if (head.startsWith('* as ')) return `const ${head.slice(5).trim()} = await import('${from}');`;
  if (head) parts.push(`default: ${head.replace(/,$/, '').trim()}`);
  if (named) parts.push(...named[1].split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ': ')));
  return `const { ${parts.join(', ')} } = await import('${from}');`;
};
for (const file of process.argv.slice(2)) {
  const raw = fs.readFileSync(file, 'utf8'), crlf = raw.includes('\r\n'), src = raw.replace(/\r\n/g, '\n');
  if (src.includes(HOOK)) { console.log('skip (already)', file); continue; }
  const re = /^import\s+([\s\S]*?)\s*from\s*'([^']+)';[ \t]*\n|^import\s+'([^']+)';[ \t]*\n/gm;
  const keep = [], moved = [];
  // Only the leading block of import statements is rewritten; comments stay where they are.
  const block = src.match(/^(?:import[\s\S]*?;[ \t]*\n)+/);
  const header = block ? block[0] : '';
  for (const m of header.matchAll(re)) {
    const from = m[2] ?? m[3], clause = m[3] ? '' : m[1];
    if (from.startsWith('node:')) keep.push(m[0].trimEnd()); else moved.push(toDynamic(clause, from));
  }
  const rest = src.slice(header.length);
  const out = [...keep, HOOK, ...moved].join('\n') + '\n' + rest;
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
  console.log('converted', file, 'kept', keep.length, 'moved', moved.length);
}
