'use strict';
// 선택 공개 1단계 후보 원천 27개의 주석에서 검수 모델 이름 「카본」을 지운다(셋째 검수 카본 C3 · 본 검수 F2와 같은 원칙 — 화면 · 데이터 · 주석에
// 도구 이름을 남기지 않는다). 모든 자리가 주석 안이고 뒤가 빈칸이라 「카본 」을 지우면 검수 번호만 남는다(「(카본 A6)」 → 「(A6)」).
// 줄끝(CRLF/LF)은 그대로 둔다. 주석 밖에 있거나 다른 꼴이면 아무것도 쓰지 않고 멈춘다.
//   node scrub-karbon.cjs <뿌리> [--실행]
const fs = require('node:fs'), path = require('node:path');
const root = process.argv[2], run = process.argv.includes('--실행');
const NEW = ['world-atlas-next', 'world-practice-next', 'world-today', 'world-position-next', 'world-diagnostic-next', 'world-mock-next', 'world-position-next-view', 'world-plan-next', 'world-lookback-next', 'world-me-next', 'world-month-answer', 'world-old-engine-doors', 'world-atlas-game'].map(n => `experiences/synk-world-app/${n}.mjs`);
const SHARED = ['experiences/synk-world-app/app-shell.mjs', 'experiences/synk-world-app/world-learning-ui.mjs', 'experiences/synk-world-app/life-ui.mjs', 'experiences/synk-world-app/life-progress.mjs', 'experiences/synk-world-app/life-ui.css', 'experiences/brand-opening/world-strings.mjs', 'experiences/brand-opening/home.mjs', 'experiences/brand-opening/home-tutor-lines.mjs', 'experiences/brand-opening/home-tutor.mjs', 'experiences/brand-opening/home.css', 'experiences/brand-opening/world-lang.mjs', 'experiences/synk-world-app/world-client.mjs', 'experiences/synk-world-app/world-reminder-device.mjs', 'experiences/synk-world-app/world-session.mjs'];
let bad = 0, total = 0;
const out = [];
for (const rel of [...SHARED, ...NEW]) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  let inBlock = false, n = 0;
  lines.forEach((line, i) => {
    let at = -1;
    while ((at = line.indexOf('카본', at + 1)) >= 0) {
      const start = line.indexOf('/*'), end = line.indexOf('*/');
      const comment = line.slice(0, at).includes('//') || inBlock || (start >= 0 && start < at && (end < 0 || end > at));
      if (!comment || line[at + 2] !== ' ') { console.log(`${rel}:${i + 1} 주석 밖이거나 다른 꼴 — ${line.trim().slice(0, 120)}`); bad++; }
      n++;
    }
    const start = line.indexOf('/*'), end = line.indexOf('*/');
    if (start >= 0 && (end < 0 || end < start)) inBlock = true;
    if (end >= 0 && (start < 0 || end > start)) inBlock = false;
  });
  const next = text.replace(/카본 /g, '');
  if (next.includes('카본')) { console.log(`${rel}: 카본이 남았다`); bad++; }
  total += n;
  if (n) out.push([file, next, n]);
}
if (bad) { console.log('멈춤 — 쓰지 않았다'); process.exit(1); }
if (run) for (const [file, next] of out) fs.writeFileSync(file, next);
console.log(`${run ? '씀' : '시험 통과'} 파일 ${out.length}개 · 지운 자리 ${total}${run ? '' : '(--실행으로 씀)'}`);
