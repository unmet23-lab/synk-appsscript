// 공개 파일 주석의 검수자 이름 GPT를 지운다(공개.js AI 이름 검사 — 「화면·데이터·주석에 도구 이름을 남기지 않는 원칙」, 11-20 선택 공개 1단계).
//   node scrub-gpt.cjs [--뿌리=<저장소 뿌리>] [--쓰기]   — 쓰기 없이는 바뀔 줄만 보인다
// 바꾸는 꼴: 「GPT GB1」 → 「GB1」, 「GPT 다시 검토 GA7」 → 「다시 검토 GA7」, 「GPT · 카본 합친 끝 판」 → 「카본 합친 끝 판」, 「F3 → GPT GA1」 → 「F3 → GA1」,
//   「검수 GPT -c GA2」 → 「검수 -c GA2」, 「검수 GPT — …」 → 「검수 — …」, 「검수 GPT)」 → 「검수)」.
// 주석 안의 이름만 바꾼다. 주석 밖에서 걸리면 멈추고 보인다. 줄끝(CRLF · LF)과 띄어쓰기는 그 자리 말고는 그대로 둔다.
const fs = require('node:fs'), path = require('node:path');
const GATE = /\bgpt\b/i;
const SW = 'experiences/synk-world-app';
const ROOT = process.argv.find(a => a.startsWith('--뿌리='))?.slice('--뿌리='.length) || '.';
const FILES = ['world-atlas-next', 'world-today', 'world-month-answer', 'world-old-engine-doors', 'world-atlas-game', 'app-shell', 'world-learning-ui', 'life-ui', 'life-progress'].map(n => path.join(ROOT, `${SW}/${n}.mjs`));
const RULES = [
  [/GPT · /g, ''],
  [/ · GPT(?=[)\s,·])/g, ''],
  [/ → GPT (?=[A-Z]{1,2}\d)/g, ' → '],
  [/\bGPT (?=[A-Z]{1,2}\d)/g, ''],
  [/\bGPT (?=[가-힣])/g, ''],
  [/\bGPT (?=-[a-z] )/g, ''],
  [/ GPT(?= —|\))/g, ''],
  [/, GPT(?=[)\s])/g, ''],
  [/\(GPT\)/g, ''],
];
const write = process.argv.includes('--쓰기');
let changedLines = 0, files = 0;
const stops = [];
for (const file of FILES) {
  if (!fs.existsSync(file)) { console.log('없음', file); continue; }
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let inBlock = false, touched = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const startsBlock = line.includes('/*'), endsBlock = line.includes('*/');
    const comment = inBlock || /^\s*(\/\/|\*|\/\*)/.test(line) || (() => { if (!GATE.test(line)) return false; const at = line.search(GATE); const slash = line.indexOf('//'); const open = line.lastIndexOf('/*', at); return (slash >= 0 && slash < at) || (open >= 0 && open < at); })();
    if (startsBlock && !endsBlock) inBlock = true; else if (endsBlock) inBlock = false;
    if (!GATE.test(line)) continue;
    if (!comment) { stops.push(`${file}:${i + 1}: ${line.trim().slice(0, 160)}`); continue; }
    let next = line;
    for (const [from, to] of RULES) next = next.replace(from, to);
    if (GATE.test(next)) { stops.push(`${file}:${i + 1}: (규칙 뒤에도 남음) ${next.trim().slice(0, 160)}`); continue; }
    if (next !== line) { touched++; changedLines++; if (!write) console.log(`${path.basename(file)}:${i + 1}\n  - ${line.trim().slice(0, 170)}\n  + ${next.trim().slice(0, 170)}`); lines[i] = next; }
  }
  if (touched) { files++; if (write) fs.writeFileSync(file, lines.join(eol)); }
}
console.log(`${write ? '썼다' : '미리 보기'} — 파일 ${files} · 줄 ${changedLines} · 멈춘 줄 ${stops.length}`);
for (const s of stops) console.log('  멈춤', s);
if (stops.length) process.exitCode = 1;
