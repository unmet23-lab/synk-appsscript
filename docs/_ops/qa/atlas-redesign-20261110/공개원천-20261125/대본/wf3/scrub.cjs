// 공개 파일 주석의 검수자 이름을 지운다(설계 주인 11-20 — 빌드 관문을 건너뛰지 않고 master 원천에서 고친다).
//   node scrub.cjs [--쓰기]   (워크트리 뿌리에서) — 쓰기 없이는 바뀔 줄만 보인다
// 바꾸는 꼴: 「Fable 5.2 끝 판 F1」 → 「끝 판 F1」, 「Fable 끝 판」 → 「끝 판」, 「설계 검토 Fable F5」 → 「설계 검토 F5」, 「아르곤 A1」 → 「검수 A1」.
// 주석 안의 이름만 바꾼다. 주석 밖에서 걸리면 멈추고 보인다. 줄끝(CRLF · LF)은 파일 그대로 둔다.
const fs = require('node:fs'), path = require('node:path');
const GATE = /suno|higgsfield|nano banana|midjourney|gpt[- ]image|edge[-_ ]tts|elevenlabs|typecast|gemini-[0-9][\w.-]*tts|ko-KR-[A-Za-z]+Neural|made with (suno|udio)|gpt[- ]?이미지|지피티|codex|seedance|\bkling|demucs|타입캐스트|힉스필드|나노 ?바나나|synk-vendor|(?<![\w.-])\.tmp[\\/]|(?<![가-힣])(?:클로드|제미나이|수노|페이블|아르곤|아스트라)|\b(?:fable|argon)\b/i;
const SW = 'experiences/synk-world-app', BO = 'experiences/brand-opening';
const FILES = [
  ...['world-atlas-next', 'world-practice-next', 'world-today', 'world-position-next', 'world-diagnostic-next', 'world-mock-next', 'world-position-next-view', 'world-plan-next', 'world-lookback-next', 'world-me-next', 'world-month-answer', 'world-old-engine-doors', 'world-atlas-game', 'app-shell', 'life-progress', 'world-learning-ui', 'life-ui', 'world-life-next', 'world-session', 'world-client', 'world-reminder-device', 'world-account', 'device-records', 'world-learning-map', 'world-learning-plan', 'world-exam-plan', 'world-position-ui', 'operating-mode', 'life-standalone-entry'].map(n => `${SW}/${n}.mjs`),
  `${SW}/life-ui.css`,
  ...['world-strings', 'home', 'home-tutor-lines', 'home-tutor', 'world-lang'].map(n => `${BO}/${n}.mjs`), `${BO}/home.css`,
  ...['blank-slice', 'entry-check', 'korean-racing', 'korean-rhythm', 'korean-runner', 'order-rush', 'snap-words', 'subway-rush', 'talk-rally'].map(g => `experiences/${g}/kit/atlas-next.mjs`),
];
const RULES = [
  [/Fable 5\.2 ?/g, ''],
  [/\bFable (?=[가-힣])/g, ''],
  [/ Fable(?= ?[A-Z]{1,2}\d)/g, ''],
  [/ · Fable(?=\))/g, ''],
  [/\(Fable$/, '('],
  [/\(Fable\)/g, ''],
  [/아르곤 ?/g, '검수 '],
];
const write = process.argv.includes('--쓰기');
let changedLines = 0, files = 0;
const stops = [];
for (const file of FILES) {
  if (!fs.existsSync(file)) { console.log('없음', file); continue; }
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let inBlock = false, touched = 0, carry52 = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const startsBlock = line.includes('/*'), endsBlock = line.includes('*/');
    const comment = inBlock || /^\s*(\/\/|\*|\/\*)/.test(line) || (() => { const m = line.match(GATE); if (!m) return false; const at = line.search(GATE); const slash = line.indexOf('//'); const open = line.lastIndexOf('/*', at); return (slash >= 0 && slash < at) || (open >= 0 && open < at); })();
    if (startsBlock && !endsBlock) inBlock = true; else if (endsBlock) inBlock = false;
    // 앞 줄이 「(Fable」로 끝났으면 이 줄 머리의 「5.2 」를 뗀다(줄을 넘겨 쓴 이름).
    if (carry52) { carry52 = false; const cut = line.replace(/^(\s*\/\/\s*)5\.2 /, '$1'); if (cut !== line) { lines[i] = cut; touched++; changedLines++; if (!write) console.log(`${path.basename(file)}:${i + 1}\n  - ${line.trim().slice(0, 170)}\n  + ${cut.trim().slice(0, 170)}`); continue; } }
    if (/\(Fable$/.test(line)) carry52 = true;
    if (!GATE.test(line)) continue;
    if (!comment) { stops.push(`${file}:${i + 1}: ${line.trim().slice(0, 160)}`); continue; }
    let next = line;
    for (const [from, to] of RULES) next = next.replace(from, to);
    next = next.replace(/\(\s+/g, '(').replace(/ {2,}(?=\S)/g, (m, off) => (off === 0 || /^\s*$/.test(next.slice(0, off)) ? m : ' '));
    if (GATE.test(next)) { stops.push(`${file}:${i + 1}: (규칙 뒤에도 남음) ${next.trim().slice(0, 160)}`); continue; }
    if (next !== line) { touched++; changedLines++; if (!write) console.log(`${path.basename(file)}:${i + 1}\n  - ${line.trim().slice(0, 170)}\n  + ${next.trim().slice(0, 170)}`); lines[i] = next; }
  }
  if (touched) { files++; if (write) fs.writeFileSync(file, lines.join(eol)); }
}
console.log(`${write ? '썼다' : '미리 보기'} — 파일 ${files} · 줄 ${changedLines} · 멈춘 줄 ${stops.length}`);
for (const s of stops) console.log('  멈춤', s);
if (stops.length) process.exitCode = 1;
