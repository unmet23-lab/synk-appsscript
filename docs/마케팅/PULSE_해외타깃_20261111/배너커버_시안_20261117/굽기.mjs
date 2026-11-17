// PULSE X 배너 · 링크드인 커버 시안 굽기 (2026-11-17)
// 판마다 컷 한 장(승인 작품의 자막 없는 컷 원본) + 승인 PULSE 로고(어두운 바탕용 Paper) + 제목 문장을 한 판으로 굽는다.
// 글꼴은 영어 PULSE 화면의 제목 서체 Noto Serif Display Light(글꼴 B)를 파일째 심는다(바깥 CDN 없음).
//   node docs/마케팅/PULSE_해외타깃_20261111/배너커버_시안_20261117/굽기.mjs [판 이름…]
// 결과: 판/<이름>.png(올릴 크기 그대로 — X 1500×500, 링크드인 1584×396)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 글꼴 = {
  serif: b64(path.join(저장소, 'docs/브랜드_폰트/NotoSerifDisplay/NotoSerifDisplay-Light-latin.woff2')),
};
const 로고 = b64(path.join(여기, '재료/SYNK-PULSE-Paper-1200.png'));
// 크레딧은 판에 넣지 않는다(출처 기록)
const 컷 = {
  lookup: { 파일: '재료/dodam18_lookup.jpg', 크레딧: 'Dodam Heavy Industries “We Send This One Off” · cut 18' },
  lamp: { 파일: '재료/dodam25_lamp.jpg', 크레딧: 'Dodam Heavy Industries “We Send This One Off” · cut 25' },
  sunset: { 파일: '재료/dodam36_sunset.jpg', 크레딧: 'Dodam Heavy Industries “We Send This One Off” · cut 36' },
};
const 제목 = ['AI models', 'can look real.', 'We make them act.'];

// 판: 크기, 컷, 컷 자르기(원본 픽셀 — x, y, 폭; 높이는 판 비율), 글 묶음 자리(판 비율), 어둡게 하는 띠
// 11-17 GPT 맹검 두 번의 지적을 반영한 셋째 판이다.
// - 첫 판: 작품 이름 줄 뺌(휴대폰에서 안 읽힘), 제목 줄바꿈 금지(X-A에서 「act.」가 넷째 줄로 떨어졌다), 링크드인 제목과 로고를 키움.
// - 둘째 판: 격납고(A)는 두 번 모두 「기계가 주인공이라 We make them act와 어긋난다」로 기각돼 뺐다.
//   대신 표정 연기가 보이는 얼굴 컷 둘을 넣었다 — X는 25번(밤 실내, 등불, 얼굴이 글 쪽을 본다), 링크드인은 36번(노을, 얼굴이 가로 45~72%라 늘이지 않아도 휴대폰 가림 7~47%를 피한다).
//   셋째 판 맹검(기각 0)의 공통 지적 「작은 PULSE 글자의 결이 거칠다」는 승인 로고의 실땀이라 바꾸지 않고 로고를 키웠다(X 38→44, LI-B 32→36, LI-C 28→30).
//   LI-B의 왼쪽은 둘째 판의 「뒤집어 흐리게 잇기」가 「늘린 배경」으로 더 나쁘게 읽혀 첫 판의 어둠 잇기로 되돌렸다.
const 판들 = {
  'X-B_올려다봄': { w: 1500, h: 500, 컷: 'lookup', 자르기: { x: 0, y: 170, 폭: 1920 }, 글: { 왼: 0.6, 위: 0.2, 폭: 0.36 }, 크기: { 제목: 58, 로고: 44 }, 어둠: 'linear-gradient(90deg, rgba(8,10,14,0) 40%, rgba(8,10,14,.62) 58%, rgba(8,10,14,.86) 100%)' },
  'X-C_등불': { w: 1500, h: 500, 컷: 'lamp', 자르기: { x: 0, y: 160, 폭: 1920 }, 글: { 왼: 0.625, 위: 0.2, 폭: 0.35 }, 크기: { 제목: 58, 로고: 44 }, 어둠: 'linear-gradient(90deg, rgba(8,8,10,0) 52%, rgba(8,8,10,.35) 62%, rgba(8,8,10,.55) 100%)' },
  // 링크드인은 휴대폰에서 프로필 사진이 가로 7~47%를 다 덮는다(11-05 실측) — 얼굴을 가운데 오른쪽으로 옮기려고 컷을 오른쪽으로 민다(x 음수)
  'LI-B_올려다봄': { w: 1584, h: 396, 컷: 'lookup', 자르기: { x: -430, y: 215, 폭: 2050 }, 왼흐림: 330, 글: { 왼: 0.68, 위: '가운데', 폭: 0.3 }, 크기: { 제목: 52, 로고: 36 }, 어둠: 'linear-gradient(90deg, rgba(8,10,14,.35) 0%, rgba(8,10,14,0) 40%, rgba(8,10,14,0) 54%, rgba(8,10,14,.7) 67%, rgba(8,10,14,.9) 100%)' },
  'LI-C_노을': { w: 1584, h: 396, 컷: 'sunset', 자르기: { x: 0, y: 230, 폭: 1920 }, 글: { 왼: 0.735, 위: '가운데', 폭: 0.25 }, 크기: { 제목: 44, 로고: 30 }, 어둠: 'linear-gradient(90deg, rgba(10,10,14,0) 64%, rgba(10,10,14,.72) 75%, rgba(10,10,14,.88) 100%)' },
};

function html(이름) {
  const p = 판들[이름];
  const c = 컷[p.컷];
  const 그림 = b64(path.join(여기, c.파일));
  const 배 = p.w / p.자르기.폭; // 원본 1px → 판 px
  const bgW = 1920 * 배, bgX = -p.자르기.x * 배, bgY = -p.자르기.y * 배;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:'PULSE Serif';src:url(data:font/woff2;base64,${글꼴.serif}) format('woff2');font-weight:300}
html,body{margin:0;background:#08080a}
.판{position:relative;width:${p.w}px;height:${p.h}px;overflow:hidden;background:#08080a}
.컷{position:absolute;left:${bgX}px;top:${bgY}px;width:${bgW}px;height:${1080 * 배}px;background:url(data:image/jpeg;base64,${그림}) 0 0/100% 100% no-repeat${p.왼흐림 ? `;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 ${p.왼흐림}px);mask-image:linear-gradient(90deg,transparent 0,#000 ${p.왼흐림}px)` : ''}}
.채움{position:absolute;left:${bgX - bgW}px;top:${bgY}px;width:${bgW}px;height:${1080 * 배}px;background:url(data:image/jpeg;base64,${그림}) 0 0/100% 100% no-repeat;transform:scaleX(-1);filter:blur(18px) brightness(.62)}
.어둠{position:absolute;inset:0;background:${p.어둠}}
.결{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,8,10,.18),rgba(8,8,10,0) 30%,rgba(8,8,10,0) 70%,rgba(8,8,10,.22))}
.글{position:absolute;left:${p.글.왼 * p.w}px;width:${p.글.폭 * p.w}px;color:#FBF7F0;${p.글.위 === '가운데' ? 'top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start' : `top:${p.글.위 * p.h}px`}}
.로고{display:block;height:${p.크기.로고}px;width:auto;margin:0 0 ${p.크기.로고 * 0.75}px}
h1{margin:0;font:300 ${p.크기.제목}px/1.04 'PULSE Serif',serif;letter-spacing:-0.012em;white-space:nowrap}
</style></head><body><div class="판">${p.왼채움 ? '<div class="채움"></div>' : ''}<div class="컷"></div><div class="결"></div><div class="어둠"></div>
<div class="글"><img class="로고" src="data:image/png;base64,${로고}" alt="SYNK PULSE"><h1>${제목.join('<br>')}</h1></div></div></body></html>`;
}

const 고를 = process.argv.slice(2);
const 이름들 = 고를.length ? 고를 : Object.keys(판들);
const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
try {
  for (const 이름 of 이름들) {
    const p = 판들[이름];
    if (!p) throw new Error('없는 판 ' + 이름);
    const 임시 = path.join(여기, `._굽는중_${process.pid}.html`);
    fs.writeFileSync(임시, html(이름), 'utf8');
    for (const [배, 꼬리] of [[1, '']]) {
      const 쪽 = await 브라우저.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 배 });
      await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
      await 쪽.evaluate(() => document.fonts.ready);
      const 실린글꼴 = await 쪽.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
      await 쪽.waitForTimeout(200);
      const 잼 = await 쪽.evaluate(() => { const h = document.querySelector('h1').getBoundingClientRect(); const 줄 = Math.round(h.height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)); const g = document.querySelector('.로고'); const 로고비 = +((g.getBoundingClientRect().width / g.getBoundingClientRect().height) / (g.naturalWidth / g.naturalHeight)).toFixed(3); return { 오른끝: Math.round(h.right), 위: Math.round(h.top), 아래: Math.round(h.bottom), 줄, 로고비 }; });
      if (Math.abs(잼.로고비 - 1) > 0.01) throw new Error(`${이름}: 로고가 늘어났다(가로세로비 ${잼.로고비}배)`);
      if (잼.줄 !== 제목.length || 잼.오른끝 > p.w - 28 || 잼.위 < 16 || 잼.아래 > p.h - 16) throw new Error(`${이름}: 제목이 판 안에 세 줄로 들지 않는다 ${JSON.stringify(잼)}`);
      const 낼 = path.join(여기, '판', `${이름}${꼬리}.png`);
      await 쪽.screenshot({ path: 낼, clip: { x: 0, y: 0, width: p.w, height: p.h } });
      await 쪽.close();
      console.log(`[굽기] ${path.relative(저장소, 낼)} · 글꼴 ${실린글꼴.join(', ')} · 제목 ${JSON.stringify(잼)}`);
    }
    fs.rmSync(임시, { force: true });
  }
} finally {
  await 브라우저.close();
}
