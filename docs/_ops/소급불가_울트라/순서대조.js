/* 헤더보정_ 를 걸어도 «안전한가»를 재는 자
 * 위험 = 코드 i번째 칸 이름 ≠ 라이브 i번째 칸 이름 (덮어쓰면 그 열의 데이터가 엉뚱한 이름 밑에 놓인다) */
const fs = require('fs');
const path = require('path');
/* 09-07 — 어느 폴더에서 불러도 돌게 뿌리를 스스로 찾는다(짝 = 같은 폴더의 헤더대조.js). */
const 여기 = __dirname;
const ROOT = path.resolve(여기, '..', '..', '..');
let src = '';
for (const f of fs.readdirSync(ROOT).filter(f => /\.js$/.test(f) && !/^_/.test(f))) src += fs.readFileSync(path.join(ROOT, f), 'utf8');
const live = JSON.parse(fs.readFileSync(path.join(여기, '라이브시트_헤더.json'), 'utf8'));

function get(key) {
  const m = new RegExp('const\\s+' + key + '\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;').exec(src);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map(x => (x[1] !== undefined ? x[1] : x[2]));
}

const pairs = [
  ['VOICE_LOG_HEADERS', 'voice_log'],
  ['HW_FEEDBACK_HEADERS', 'hw_feedback'],
  ['TALK_LOG_HEADERS', 'talk_log'],
  ['QUIZ_LOG_HEADERS', 'quiz_log'],
  ['JACKET_HEADERS', 'jacket_grants'],
];

for (const [key, tab] of pairs) {
  const code = get(key) || [];
  const L = (live[tab] && live[tab].headers || []).map(s => String(s).trim());
  console.log('▸ ' + tab + ' (' + key + ') · 코드 ' + code.length + ' ↔ 라이브 ' + L.length);
  let bad = 0, add = 0;
  const n = Math.max(code.length, L.length);
  for (let i = 0; i < n; i++) {
    const c = code[i] === undefined ? null : code[i];
    const l = L[i] === undefined ? null : L[i];
    if (c === l) continue;
    if (l === null || l === '') { add++; console.log('   ＋ ' + (i + 1) + '열 새로 씀: [' + c + ']'); }
    else if (c === null) { console.log('   ⛔ ' + (i + 1) + '열 라이브에만 있음: [' + l + '] — 코드 정본 밖'); }
    else { bad++; console.log('   ⚠ ' + (i + 1) + '열 덮어씀: 코드[' + c + '] ↔ 라이브[' + l + ']'); }
  }
  console.log('   → 새로 쓰는 칸 ' + add + ' · 🔴덮어쓰는 칸 ' + bad + (bad ? '  ← 이대로 부르면 위험' : '  ← 안전'));
}
