#!/usr/bin/env node
'use strict';
/**
 * 칩 띠 대조 사진 — 「가운데 조각을 반복해서 깔 때 이음매가 보이나」 (2026-09-03)
 *
 * ══ 왜 사진인가 ═══════════════════════════════════════════════════════════
 *   이 판정은 «화면에서만» 답이 나온다. 조각 그림을 나란히 놓아 봐야 안 보이고,
 *   CSS 로 실제로 이어 붙여야 이음매가 드러난다. 그래서 크롬으로 한 장 찍는다.
 *   (지면에도 같은 것이 있지만 24px 로 앉아 눈에 안 걸린다 — 그래서 확대 줄을 함께 낸다.)
 *
 * ══ 09-03 에 여기까지 좁혔다 ══════════════════════════════════════════════
 *   ① 처음 본 것: 「한국어 학원」에 세로 선 하나, 긴 이름에는 다섯 개.
 *   ② 마구리 좌우가 뒤바뀐 것을 찾아 바꿔 써 봤다 — **여전히 알약이 늘어섰다.**
 *   ③ 마구리를 아예 빼고 가운데만 깔았다 — 같았다. 해상도를 두 배로(600px) 올려도,
 *      위아래 여백을 잘라내도(130%) 같았다. 늘리기만 한 덩이로 이어졌다.
 *   ④ 알파를 «열별로» 재니 좌우 끝까지 769px 균일 — 좌우 «변»은 곧다.
 *   ⇒ 남은 용의자 하나: **위아래 모서리 라운드**가 창(±0.60) 안쪽까지 들어온다.
 *      크리스 0.62 의 서브서프가 만드는 라운드가 폭 0.92 에서는 프레임 안에 남는다.
 *      그래서 반복할 때 그 코너가 주기적으로 나타나 알약 경계로 읽힌다.
 *   ⇒ 처방: 몸을 창보다 훨씬 넓게 두어 코너를 프레임 «밖»으로 보낸다(「몸폭=」 을 열었다).
 *
 * 통로: node tools/칩띠대조.js [나갈파일.png]
 */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 현행방 = path.join(루트, 'docs', '캐릭터', '요소공방_0822', '부품형태');
const 후보방 = path.join(루트, 'docs', '캐릭터', '요소공방_0822', '띠_0903');

/** 크롬 — 찍는 자. 저장소에 이미 두 곳이 같은 후보를 쓴다(배너굽기·발표물린트). */
function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다 — 찍을 자가 없다');
  return 후보[0];
}

/** png → webp data URI. 폭을 크게 잡는다(줄이면 경계가 흐려져 «이음매»가 가짜로 부드러워진다). */
function uri(파일, 폭 = 300) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `띠-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '95', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
}

const 판들 = [
  { 이름: '지금 판 · 몸폭 0.92', 파일: path.join(현행방, 'D2_태그중.png'), 곁: '코너 라운드가 창 안에 들어온다' },
  { 이름: '몸폭 1.6', 파일: path.join(후보방, 'T16_태그중_몸폭1.6.png'), 곁: '창의 2.7배' },
  { 이름: '몸폭 2.4', 파일: path.join(후보방, 'T24_태그중_몸폭2.4.png'), 곁: '창의 4배' },
  { 이름: '몸폭 3.6', 파일: path.join(후보방, 'T36_태그중_몸폭3.6.png'), 곁: '창의 6배' },
];

function main() {
  const 나갈곳 = process.argv[2] || path.join(os.tmpdir(), '칩띠대조.png');
  const 있는것 = 판들.map((p) => ({ ...p, uri: uri(p.파일) })).filter((p) => {
    if (!p.uri) console.log(`  🟡 없다 — ${path.relative(루트, p.파일)}`);
    return p.uri;
  });
  if (!있는것.length) { console.error('🔴 잴 그림이 하나도 없다.'); process.exit(1); }

  const 글 = ['펠트', '한국어 학원', '아주 긴 분류 이름도 마구리가 안 늘어난다'];
  const 줄 = (u, 큰) => 글.map((t) =>
    `<span class="chip${큰 ? ' big' : ''}" style="background:url(${u}) left center/auto 100% repeat-x">${t}</span>`).join('');

  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0E0F13;color:#E4E4E7;font:15px/1.5 "Malgun Gothic",sans-serif;padding:24px 30px}
h2{font-size:17px;margin:0 0 3px;letter-spacing:-.02em}
p.k{margin:0 0 12px;font-size:12.5px;color:#9CA3AF}
.row{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:0 0 4px}
.col{display:flex;flex-direction:column;gap:11px;align-items:flex-start}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 12px;font-size:12.5px;font-weight:700;color:#2B2320;letter-spacing:-.02em}
.chip.big{height:88px;padding:0 32px;font-size:29px}
.lab{font-size:12px;color:#9CA3AF;margin:11px 0 5px}
.sec{border-top:1px solid #23252C;margin-top:19px;padding-top:17px}
</style>
${있는것.map((p, i) => `<div class="${i ? 'sec' : ''}"><h2>${p.이름}</h2><p class="k">${p.곁}</p>
  <div class="lab">실제로 앉는 크기 (24px)</div><div class="row">${줄(p.uri, false)}</div>
  <div class="lab">크게 열어 본 것 — 이음매가 보이는지</div><div class="col">${줄(p.uri, true)}</div></div>`).join('')}`;

  const 임시 = path.join(os.tmpdir(), `칩띠-${process.pid}.html`);
  fs.writeFileSync(임시, html, 'utf8');
  /* 🔴 2026-09-04 — 옛 산출을 먼저 지운다(codex `53ead1688473`).
   *   판정이 `existsSync(나갈곳)` 하나였는데, 어제 찍은 그림이 그 자리에 있으면 **오늘 크롬이 죽어도 초록**이었다.
   *   「없앤 뒤에 생겼나」로 물어야 그 자리가 참을 말한다(zero-is-a-success-face-taxonomy 계열). */
  try { fs.unlinkSync(나갈곳); } catch { /* 없으면 그만 */ }
  const 높이 = 140 + 있는것.length * 470;   /* 판당 = 머리 + 실크기줄 + 큰줄 셋. 09-03 에 360 으로 잡았다가 마지막 판이 잘렸다 */
  let r;
  // 크롬을 못 찾으면 여기서 던진다 — 임시 HTML 은 finally 가 치운다(안 그러면 tmp 에 쌓인다).
  try {
    r = spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=2', `--window-size=1060,${높이}`,
      `--screenshot=${나갈곳}`, `file:///${임시.replace(/\\/g, '/')}`], { encoding: 'utf8' });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
  if (!fs.existsSync(나갈곳)) { console.error('🔴 못 찍었다:', ((r && r.stderr) || '').slice(0, 300)); process.exit(1); }
  console.log(`■ 칩 띠 대조  ${나갈곳}  (${Math.round(fs.statSync(나갈곳).size / 1024)}KB · 판 ${있는것.length}/${판들.length})`);
}

module.exports = { 판들, uri, 크롬 };
if (require.main === module) main();
