// synkbrief · yuhobuilds 유튜브 배너 B 굽기 (2026-11-19, 유호님 「A 걸고 B 짓기」)
// 두 채널의 실제 편에서 고른 장면 한 컷을 바탕으로 깔고, 글은 지금 건 판(A)의 줄을 그대로 쓴다.
// 유튜브는 2560×1440이고, 모든 기기에서 보이는 가운데 1546×423(x507~2053, y508~931)에 얼굴과 글을 함께 넣는다.
// 길은 PULSE 배너 C(굽기_PULSE유튜브.mjs)와 같다: 같은 컷을 판 전체에 흐리게 깔고, 컷 가장자리는 부드럽게 지운다.
//   node docs/마케팅/프로필점검_20261118/시안/굽기_B장면.mjs [판 이름…]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 마케팅 = path.resolve(여기, '../..');
const W = 2560, H = 1440, 띠 = { 위: 508, 아래: 931, 왼: 507, 오른: 2053 };

const 글 = {
  brief: { 머리: 'SYNK 브리핑 · SYNK SHIFT', 머리색: '#9cc0ff', 제목: ['AI 때문에', '실제로 벌어진 일'], 아래: '재연으로 보고, 지키는 법은 한 줄로' },
  builds: { 머리: '유호 · SYNK 대표', 머리색: '#f5c445', 제목: ['개발을 몰랐던 사람이', 'AI로 회사를 만드는 중'], 아래: '날린 돈과 시간, 고친 방법까지' },
};

// 얼굴: 컷 안의 얼굴 가운데(fx, fy)와 머리끝~턱 높이(fh, 컷 px). 얼굴이 판에서 높이 얼굴px가 되게 키우고, 가운데를 (목표x, 720)에 둔다.
const 판들 = {
  'brief-B1_사장님전화': { 글: 'brief', 파일: 'synkbrief_사장님목소리_20261118/게시/blog/01_전화_재연.jpg', fx: 470, fy: 640, fh: 500, 얼굴px: 330, 목표x: 1720 },
  'brief-B2_영상통화': { 글: 'brief', 파일: 'synkbrief_영상통화연인_20261113/게시/blog/01_통화_재연.jpg', fx: 600, fy: 560, fh: 280, 얼굴px: 240, 목표x: 1640 },
  'brief-B3_올려다봄': { 글: 'brief', 파일: 'synkbrief_없는판결_20261111/게시/blog/03_올려다봄_재연.jpg', fx: 650, fy: 830, fh: 620, 얼굴px: 340, 목표x: 1760 },
  'builds-B1_55초늦음': { 글: 'builds', 파일: 'yuhobuilds_제출55초_20261110/게시/맹검/f_1.0.jpg', fx: 520, fy: 1010, fh: 620, 얼굴px: 340, 목표x: 1760, 위가림: 700 },
  'builds-B2_화면멈춤': { 글: 'builds', 파일: 'yuhobuilds_제출55초_20261110/게시/맹검/f_11.0.jpg', fx: 540, fy: 960, fh: 720, 얼굴px: 340, 목표x: 1760, 위가림: 640 },
  'builds-B3_맡겼거든요': { 글: 'builds', 파일: 'yuhobuilds_제출55초_20261110/게시/맹검/f_5.6.jpg', fx: 540, fy: 1000, fh: 620, 얼굴px: 340, 목표x: 1760, 위가림: 560 },
};

function 크기(p) {
  const b = fs.readFileSync(p);
  // JPEG SOF에서 너비 · 높이를 읽는다
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1]; const len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  throw new Error('크기를 못 읽음 ' + p);
}

function html(이름, p) {
  const 그림경로 = path.join(마케팅, p.파일);
  const { w, h } = 크기(그림경로);
  const 배 = p.얼굴px / p.fh;
  const cw = w * 배, ch = h * 배;
  const left = p.목표x - p.fx * 배, top = 720 - p.fy * 배;
  const 그림 = fs.readFileSync(그림경로).toString('base64');
  const g = 글[p.글];
  // 컷 위쪽에 원래 편의 자막이 있으면(위가림, 컷 px) 그 아래부터만 보이게 지운다
  const 위 = p.위가림 ? (p.위가림 * 배) : 0;
  const 마스크 = `linear-gradient(180deg,transparent 0,transparent ${위}px,#000 ${위 + 260}px,#000 calc(100% - 340px),transparent 100%),linear-gradient(90deg,transparent 0,#000 ${Math.round(cw * 0.3)}px,#000 calc(100% - ${Math.round(cw * 0.26)}px),transparent 100%)`;
  return { 배, cw, ch, left, top, 문서: `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../../디자인/SNS키트/kit.css"><style>
html,body{margin:0;background:#0b0c10}
.판{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#0b0c10;font-family:var(--k-sans)}
.바탕{position:absolute;inset:0;background:url(data:image/jpeg;base64,${그림}) center/cover no-repeat;filter:blur(90px) brightness(.42) saturate(.95);transform:scale(1.25)}
.컷{position:absolute;left:${left}px;top:${top}px;width:${cw}px;height:${ch}px;background:url(data:image/jpeg;base64,${그림}) 0 0/100% 100% no-repeat;-webkit-mask-image:${마스크};-webkit-mask-composite:source-in;mask-composite:intersect}
.어둠{position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,10,14,.9) 0%,rgba(9,10,14,.82) 38%,rgba(9,10,14,.45) 50%,rgba(9,10,14,0) 60%,rgba(9,10,14,0) 84%,rgba(9,10,14,.35) 100%)}
.결{position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,10,14,.35),rgba(9,10,14,0) 32%,rgba(9,10,14,0) 68%,rgba(9,10,14,.4))}
.글{position:absolute;left:600px;width:760px;top:${띠.위}px;height:${띠.아래 - 띠.위}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;color:#fff}
.머리{margin:0;font:700 40px/1.1 var(--k-mono);letter-spacing:.08em;color:${g.머리색}}
h1{margin:16px 0 0;font:900 86px/1.08 var(--k-sans);letter-spacing:-.045em;white-space:nowrap}
h1 span{display:block}
.아래{margin:18px 0 0;font:600 42px/1.25 var(--k-sans);letter-spacing:-.02em;opacity:.86}
</style></head><body><div class="판"><div class="바탕"></div><div class="컷"></div><div class="결"></div><div class="어둠"></div>
<div class="글"><p class="머리">${g.머리}</p><h1>${g.제목.map((s) => `<span>${s}</span>`).join('')}</h1><p class="아래">${g.아래}</p></div></div></body></html>` };
}

const 고른 = process.argv.slice(2);
const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const 검사 = {};
try {
  fs.mkdirSync(path.join(여기, 'out'), { recursive: true });
  for (const [이름, p] of Object.entries(판들)) {
    if (고른.length && !고른.includes(이름)) continue;
    const { 배, cw, ch, left, top, 문서 } = html(이름, p);
    const 임시 = path.join(여기, `._굽는중_${process.pid}.html`);
    fs.writeFileSync(임시, 문서, 'utf8');
    const 쪽 = await 브라우저.newPage({ viewport: { width: W, height: H } });
    await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
    await 쪽.evaluate(() => document.fonts.ready);
    await 쪽.waitForTimeout(300);
    const 잼 = await 쪽.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = [r('.머리'), r('h1'), r('.아래')]; return { 왼: Math.round(Math.min(...a.map((x) => x.left))), 오른: Math.round(Math.max(...a.map((x) => x.right))), 위: Math.round(a[0].top), 아래: Math.round(a[2].bottom), 글꼴: getComputedStyle(document.querySelector('h1')).fontFamily }; });
    const 얼굴 = { 왼: Math.round(p.목표x - (p.fh * 0.42) * 배), 오른: Math.round(p.목표x + (p.fh * 0.42) * 배), 위: Math.round(720 - p.얼굴px / 2), 아래: Math.round(720 + p.얼굴px / 2) };
    const 안 = (b) => b.왼 >= 띠.왼 && b.오른 <= 띠.오른 && b.위 >= 띠.위 && b.아래 <= 띠.아래;
    검사[이름] = { 글: 잼, 얼굴, 글안: 안(잼), 얼굴안: 안(얼굴), 컷: { 배: +배.toFixed(3), left: Math.round(left), top: Math.round(top), w: Math.round(cw), h: Math.round(ch) } };
    if (!안(잼)) throw new Error(`${이름}: 글이 모든 기기 공통 자리를 벗어난다 ${JSON.stringify(잼)}`);
    if (!안(얼굴)) throw new Error(`${이름}: 얼굴이 모든 기기 공통 자리를 벗어난다 ${JSON.stringify(얼굴)}`);
    const 낼 = path.join(여기, 'out', `B-${이름}.png`);
    await 쪽.screenshot({ path: 낼, clip: { x: 0, y: 0, width: W, height: H } });
    await 쪽.close();
    fs.rmSync(임시, { force: true });
    console.log('구움', path.relative(여기, 낼), JSON.stringify(검사[이름]));
  }
} finally { await 브라우저.close(); }
const 검사파일 = path.join(여기, 'out', 'B-검사.json');
const 앞 = fs.existsSync(검사파일) ? JSON.parse(fs.readFileSync(검사파일, 'utf8')) : {};
fs.writeFileSync(검사파일, JSON.stringify({ ...앞, ...검사 }, null, 2) + '\n');
