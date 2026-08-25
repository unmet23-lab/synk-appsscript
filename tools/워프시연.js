#!/usr/bin/env node
/* 2D 워프 시연 굽기 — 정본 «사진»을 격자로 나눠 정점만 움직여 살아 움직이게 한다.
 *
 * ■ 왜 이 통로인가 (유호 확정 08-26 「이 버전 2d live 느낌이랄까? 정본에 추가해줘」)
 *   3D 로 다시 지으면 재질이 매번 「고무·왁스」로 읽혀 반려됐다(08-15 probe2 실측 · 08-26 눈검수).
 *   진범은 렌더 방식이 아니라 **없는 정보를 지어내는 것**이었다 — 옆·뒤가 사진에 없으니
 *   무엇을 쓰든 창작이 되고, 창작한 펠트는 가짜로 읽힌다.
 *   ⇒ 이 통로는 지어내지 않는다. **사진 픽셀을 그대로 두고 «정점»만 움직인다**(Live2D 원리).
 *      그래서 재질이 100% 사진이다 — 털·색·실땀 전부 원본.
 *
 * ■ 대가(틀릴 때의 모습) — 정직하게
 *   · 옆·뒤로 크게 도는 것은 **안 된다**(정면 ±40° 안). 360° 가 꼭 필요한 자리는 다른 통로가 맡는다.
 *   · 홍조처럼 «색을 덧칠하는» 어휘는 뺐다 — 사진을 안 건드리는 것이 이 통로의 값이다.
 *   · 격자를 너무 크게 흔들면 사진이 «고무»로 읽힌다. 진폭 상한이 곧 이 통로의 품질선이다.
 *
 * ■ 🔑 경로를 여기 적지 않는다
 *   그림 «경로»의 주인은 `tools/lib/마스코트자산.js` 하나다. 두 곳에 적으면 그 순간 주인이 둘이
 *   되고, 그것이 마스코트 10벌 공존을 만든 병이다(정본 머리말 참조). 이 도구는 그 창구만 부른다.
 *
 * ■ 실측 교훈 둘이 코드에 박혀 있다 (템플릿 `tools/lib/워프시연_템플릿.html`)
 *   ① **생명감 상태 기계에 rAF 금지** — 상태는 setInterval(100ms), 그림만 rAF
 *      (감각층 v2 에서 홍조·살랑·잠들기가 rAF 안에 있다가 탭 스로틀에서 통째로 죽었다).
 *   ② **rAF 는 숨은 탭에서 «아예» 안 돈다** — 그래서 그리기를 rAF 에서 떼어 두고
 *      로드 직후·탭 복귀 시 정지 화면 한 장을 남긴다(08-26 실측: document.hidden 이면 프레임 0).
 *
 * 쓰기:
 *   node tools/워프시연.js                       → docs/캐릭터/생명공방_0826/살아움직이는몽글.html
 *   node tools/워프시연.js 출력=<경로.html>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const 자산 = require('./lib/마스코트자산.js');

const 인자 = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.includes('=')).map((a) => a.split(/=(.+)/).slice(0, 2))
);

const 뿌리 = path.join(__dirname, '..');
const 템플릿경로 = path.join(__dirname, 'lib', '워프시연_템플릿.html');
const 출력 = path.resolve(뿌리, 인자['출력'] || 'docs/캐릭터/생명공방_0826/살아움직이는몽글.html');

/* 자리 이름 → 정본 표정. 값을 늘리려면 템플릿의 IMGS 키도 같이 는다. */
const 쓰는컷 = { __IMG_BODY__: '본체', __IMG_SHUT__: '눈감음', __IMG_SMILE__: '눈웃음' };

let html = fs.readFileSync(템플릿경로, 'utf8');
const 잰것 = [];

for (const [자리, 표정] of Object.entries(쓰는컷)) {
  const 절대 = 자산.절대경로(표정, { 누끼: true });   // 🔑 경로의 주인은 마스코트자산.js 하나
  if (!fs.existsSync(절대)) throw new Error(`정본 컷이 없다: ${표정} → ${절대}`);
  const buf = fs.readFileSync(절대);
  html = html.replace(자리, 'data:image/png;base64,' + buf.toString('base64'));
  잰것.push(`${표정} ${(buf.length / 1024).toFixed(0)}KB`);
}

const 남은자리 = html.match(/__IMG_[A-Z]+__/g);
if (남은자리) throw new Error(`치환 안 된 자리가 남았다: ${남은자리.join(', ')}`);

/* 조용한 실패를 막는 자 — 통과 못 하면 굽지 않는다. */
const 검사 = {
  'JS 문법': () => { new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]); return true; },
  'CSS 중괄호 균형': () => {
    const s = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    return (s.match(/{/g) || []).length === (s.match(/}/g) || []).length;
  },
  '셀렉터 안 @media 없음': () => !/,\s*@media/.test(html),
  '한글 keyframes 없음': () => !/@keyframes\s+[^\x00-\x7F]/.test(html),  // 08-24 실측: 한글이면 애니메이션이 «생성되지 않는다»
  '정지 프레임 보강': () => /visibilitychange/.test(html) && /ready >= 3\) 그리기\(0\)/.test(html),
  '상태는 타이머': () => /setInterval\(/.test(html),
  '16MB 이내': () => html.length <= 16 * 1024 * 1024,
};
const 실패 = [];
for (const [이름, fn] of Object.entries(검사)) {
  let ok = false;
  try { ok = fn(); } catch (e) { ok = false; }
  console.log(`${ok ? '✅' : '🔴'} ${이름}`);
  if (!ok) 실패.push(이름);
}
if (실패.length) { console.error(`\n검사 ${실패.length}건 실패 — 굽지 않는다: ${실패.join(', ')}`); process.exit(1); }

fs.mkdirSync(path.dirname(출력), { recursive: true });
fs.writeFileSync(출력, html);
console.log(`\n구움 → ${path.relative(뿌리, 출력).replace(/\\/g, '/')}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`컷 ${잰것.length}장: ${잰것.join(' · ')}`);
