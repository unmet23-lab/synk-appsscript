// PULSE 유튜브 배너 시안 굽기 (2026-11-18, 프로필 점검)
// X · 링크드인 시안(../../PULSE_해외타깃_20261111/배너커버_시안_20261117)과 같은 컷 · 같은 로고 · 같은 제목으로 유튜브 크기만 새로 짠다.
// 그 폴더의 재료는 읽기만 한다. 유튜브는 2560×1440이고, 모든 기기에서 보이는 가운데 1546×423(x507~2053, y508~931)에 얼굴과 글을 함께 넣는다.
//   node docs/마케팅/프로필점검_20261118/시안/굽기_PULSE유튜브.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 재료 = path.join(저장소, 'docs/마케팅/PULSE_해외타깃_20261111/배너커버_시안_20261117/재료');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 글꼴 = b64(path.join(저장소, 'docs/브랜드_폰트/NotoSerifDisplay/NotoSerifDisplay-Light-latin.woff2'));
const 로고 = b64(path.join(재료, 'SYNK-PULSE-Paper-1200.png'));
const 제목 = ['AI models', 'can look real.', 'We make them act.'];
const W = 2560, H = 1440, 띠 = { 위: 508, 아래: 931, 왼: 507, 오른: 2053 };

// 11-18 첫 판은 휴대폰 공통 자리(1546×423)에서 얼굴 왼쪽이 잘려 컷을 오른쪽으로 옮겼다(B 187→330, C 220→360).
// 11-18 카본 맹검(B 기각 4 · C 고쳐서 냄 7)으로 C를 고쳤다: 얼굴 위아래가 띠에 잘려 배를 0.8→0.68로, 글 밑에 반쯤 걸리던 등불은 컷 오른쪽을 가려 뺐고,
// 판 가장자리의 문지른 액자 티는 같은 컷을 판 전체에 흐리게 깐 바탕으로 이었다. 승인 로고는 그대로 두고 54→62px로 키웠다.
// 배: 컷 1px → 판 px, 자리: 컷의 왼쪽 위가 판의 어디에 오나
const 판들 = {
  'YT-B_올려다봄': { 파일: 'dodam18_lookup.jpg', 배: 1.1, x: 330, y: 238, 어둠: 'linear-gradient(90deg, rgba(8,10,14,.9) 0%, rgba(8,10,14,0) 17%, rgba(8,10,14,0) 47%, rgba(8,10,14,.66) 55%, rgba(8,10,14,.9) 66%, rgba(8,10,14,.96) 100%)' },
  'YT-C_등불': { 파일: 'dodam25_lamp.jpg', 배: 0.68, x: 430, y: 406, 오른가림: 1300, 어둠: 'linear-gradient(90deg, rgba(8,8,10,.9) 0%, rgba(8,8,10,0) 18%, rgba(8,8,10,0) 51%, rgba(8,8,10,.45) 57%, rgba(8,8,10,.62) 100%)' },
};
const 글 = { 왼: 1340, 폭: 700, 제목px: 74, 로고px: 62 };

function html(p) {
  const 그림 = b64(path.join(재료, p.파일));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:'PULSE Serif';src:url(data:font/woff2;base64,${글꼴}) format('woff2');font-weight:300}
html,body{margin:0;background:#08080a}
.판{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#08080a}
.바탕{position:absolute;inset:0;background:url(data:image/jpeg;base64,${그림}) center/cover no-repeat;filter:blur(70px) brightness(.2);transform:scale(1.15)}
.컷{position:absolute;left:${p.x}px;top:${p.y}px;width:${1920 * p.배}px;height:${1080 * p.배}px;background:url(data:image/jpeg;base64,${그림}) 0 0/100% 100% no-repeat;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 160px,#000 calc(100% - 160px),transparent 100%),linear-gradient(90deg,transparent 0,#000 160px,#000 ${p.오른가림 ? p.오른가림 * p.배 - 120 : 1920 * p.배 - 160}px,transparent ${p.오른가림 ? p.오른가림 * p.배 + 60 : 1920 * p.배}px);-webkit-mask-composite:source-in;mask-composite:intersect}
.어둠{position:absolute;inset:0;background:${p.어둠}}
.결{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,8,10,.25),rgba(8,8,10,0) 30%,rgba(8,8,10,0) 70%,rgba(8,8,10,.3))}
.글{position:absolute;left:${글.왼}px;width:${글.폭}px;top:${띠.위}px;height:${띠.아래 - 띠.위}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;color:#FBF7F0}
.로고{display:block;height:${글.로고px}px;width:auto;margin:0 0 ${글.로고px * 0.7}px}
h1{margin:0;font:300 ${글.제목px}px/1.04 'PULSE Serif',serif;letter-spacing:-0.012em;white-space:nowrap}
</style></head><body><div class="판"><div class="바탕"></div><div class="컷"></div><div class="결"></div><div class="어둠"></div>
<div class="글"><img class="로고" src="data:image/png;base64,${로고}" alt="SYNK PULSE"><h1>${제목.join('<br>')}</h1></div></div></body></html>`;
}

const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
try {
  fs.mkdirSync(path.join(여기, 'out'), { recursive: true });
  for (const [이름, p] of Object.entries(판들)) {
    const 임시 = path.join(여기, `._굽는중_${process.pid}.html`);
    fs.writeFileSync(임시, html(p), 'utf8');
    const 쪽 = await 브라우저.newPage({ viewport: { width: W, height: H } });
    await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
    await 쪽.evaluate(() => document.fonts.ready);
    await 쪽.waitForTimeout(200);
    const 잼 = await 쪽.evaluate(() => { const h = document.querySelector('h1').getBoundingClientRect(); const g = document.querySelector('.로고').getBoundingClientRect(); const 줄 = Math.round(h.height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)); return { 줄, 왼: Math.round(Math.min(h.left, g.left)), 오른: Math.round(Math.max(h.right, g.right)), 위: Math.round(g.top), 아래: Math.round(h.bottom) }; });
    if (잼.줄 !== 3 || 잼.왼 < 띠.왼 || 잼.오른 > 띠.오른 || 잼.위 < 띠.위 || 잼.아래 > 띠.아래) throw new Error(`${이름}: 글이 모든 기기 공통 자리를 벗어난다 ${JSON.stringify(잼)}`);
    const 낼 = path.join(여기, 'out', `PULSE-${이름}.png`);
    await 쪽.screenshot({ path: 낼, clip: { x: 0, y: 0, width: W, height: H } });
    await 쪽.close();
    fs.rmSync(임시, { force: true });
    console.log(`[굽기] ${path.relative(저장소, 낼)} · 글 자리 ${JSON.stringify(잼)}`);
  }
} finally {
  await 브라우저.close();
}
