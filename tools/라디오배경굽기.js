#!/usr/bin/env node
/* 라디오배경굽기 — 24시간 라디오의 «장르별 정지 화면»을 굽는다. (유호 확정 2026-09-02)
 *
 * ■ 왜 «정지 화면»이 화면의 전부인가 — 송출이 `-c copy` 라서다.
 *   팩을 사전 인코딩해 재인코딩 0 으로 미는 구조(설계 §7-7)에서는 방송 중에 그림을 합성할 수 없다.
 *   그런데 유호님 지시(「한 장르 쭉 … 장르마다 마스코트를 변경」)는 그 제약 «안에서» 정확히 풀린다:
 *   **곡마다 배경이 이미 박혀 있으므로**, 장르별 배경으로 인코딩해 두면 블록이 넘어갈 때
 *   화면이 저절로 바뀐다. CPU 0 을 지키면서 DJ 가 교대한다.
 *   (talk `bots/송출/인코딩.sh` 가 곡 이름 꼬리 `-<장르>-air` 를 읽어 `<배경폴더>/<장르>.png` 를 고른다.)
 *
 * ■ 재질은 «빌려 온다» — `tools/배너굽기.js` 의 양모천을 그대로 require 한다.
 *   🔑 같은 천을 두 도구가 각자 조립하면 그 자리에서 결이 갈린다(마스코트 10벌의 그 병).
 *
 * ■ 「학생은 보지 않고 듣는다」(이 트랙의 판정 자) — 그래서 화면에 뜻을 안 싣는다.
 *   상시로 두는 것은 셋뿐: ①마스코트 ②구석 「이 노래는 SYNK가 만들었습니다」 ③장르 색.
 *   곡 제목·시계·가사는 두지 않는다 — 안 보면 손해인 것이 아니고, 정지 화면이라 낡는다.
 *
 * 쓰기:
 *   node tools/라디오배경굽기.js                 전 장르 + 시안 지면
 *   node tools/라디오배경굽기.js --장르 citypop  한 장만
 *   출력 = docs/라디오/배경/<장르>.png (1280×720) · 시안 = 같은 폴더 시안.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { 색, 워드마크 } = require('./lib/로고정본.js');
const { 양모천svg } = require('./배너굽기.js');
const 마스코트자산 = require('./lib/마스코트자산.js');

const ROOT = path.resolve(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs/라디오/배경');
const W = 1280, H = 720;                       // 720p 단일 규격(설계 §7-7 확정)

/* ── 장르 셋 — 색은 킷 램프 안에서만 고른다(철칙 ④: 주연 1실 + 조연 1실) ──────────
 * 🔑 «장르마다 다른 색»이 유호님 픽이다(09-02) — 블록이 바뀌면 색이 통째로 바뀌어
 *   「지금 무슨 결인지」가 소리보다 먼저 눈에 든다.
 * ⚠ 전자(house)는 **마린을 기다린다**(유호 확정 09-02) — 가이드가 몽글·까몽 둘뿐이라
 *   얼굴 없이 켜지 않는다. 여기 정의는 두되 `대기: true` 라 기본 굽기에서 빠진다. */
const 장르들 = {
  citypop: {
    이름: '시티팝', 가이드: '몽글', 표정: '눈웃음',
    /* 따뜻한 저녁 — 코랄 여린 단이 바닥, 잉크가 글자. 몽글(코랄 펠트)이 이 위에서 또렷하다. */
    바탕: 색['Coral Wash'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Coral Soft'], 어둡나: false },
  },
  calm: {
    이름: '차분', 가이드: '까몽', 표정: '눈웃음',
    /* 밤 — 까몽이 검은 털이라 순검정 위에서는 사라진다. 잉크(따뜻한 먹)에 앉히고
     * 천의 보풀을 Deep Wool 로 올려 윤곽이 살게 한다. */
    바탕: 색['Ink'], 글자: 색['Paper'], 보조: 색['Stone'],
    천: { 보풀: 색['Deep Wool'], 그늘: 색['Ink Deep'], 어둡나: true },
  },
  house: {
    이름: '전자', 가이드: '마린', 표정: '눈웃음', 대기: true,
    바탕: 색['Lapis Soft'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Lapis Soft'], 어둡나: false },
  },
};

/** 가이드 누끼 — 경로는 `lib/마스코트자산.js` 한 창구에서만 온다. */
function 가이드img(가이드, 표정) {
  const p = 가이드 === '까몽'
    ? path.join(ROOT, 마스코트자산.까몽경로(표정, { 누끼: true }))
    : 마스코트자산.절대경로(표정, { 누끼: true });
  return `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" alt="" data-synk-mascot>`;
}

/* 액자 실측(알파 bbox · 09-01) — 몽글은 캔버스의 57.3%만 채우고 까몽은 91.2%다.
 * 같은 폭을 주면 까몽이 1.5배로 커진다 ⇒ 그림 높이를 같게 맞추는 배율은 0.558/0.859 ≈ 0.650. */
const 액자보정 = { 몽글: 1, 까몽: 0.650, 마린: 1 };

function 지면(키) {
  const a = 장르들[키];
  /* 🔴 첫 판은 340px 이라 화면의 17~26% 밖에 안 됐다(09-02 눈검증) — 24시간 켜 두는 화면의
   *   주인공이 그만하면 «구석에 놓인 아이콘»으로 읽힌다. 600 이면 그림 높이가 335px ≈ 화면의 46% 다.
   *   🔑 폭이 아니라 «그림 높이»를 기준으로 잡는다 — 액자 몫이 가이드마다 달라(몽글 .558 · 까몽 .859)
   *     폭을 같이 주면 크기가 갈린다. 보정을 곱해야 둘이 같은 크기로 선다. */
  const 배율 = 액자보정[a.가이드] || 1;
  const 폭 = Math.round(600 * 배율);
  return `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR');unicode-range:U+300C-300D;}
  html,body{margin:0;padding:0;background:${a.바탕};}
  .판{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${a.바탕};
    font-family:'SYNK Bracket','Inter Tight',system-ui,'Malgun Gothic',sans-serif;}
  .천{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block;}
  /* 조명 — 광원은 위(42%). 배너와 같은 문법이라 두 지면이 한 빛을 받는다. */
  .결{position:absolute;inset:0;z-index:1;
    background:
      radial-gradient(ellipse 58% 74% at 50% 42%, ${a.천.어둡나 ? 'rgba(251,247,240,0.05)' : 'rgba(255,255,255,0.55)'} 0%, transparent 62%),
      radial-gradient(ellipse 118% 148% at 50% 46%, transparent 0%, transparent 52%, ${a.천.어둡나 ? 'rgba(0,0,0,0.45)' : 'rgba(43,35,32,0.12)'} 100%);}
  /* 마스코트 — 화면의 주인공. 가운데보다 «조금 위»에 두어 아래에 숨 쉴 자리를 남긴다. */
  .얼굴{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:2;width:${폭}px;
    filter:drop-shadow(0 22px 34px rgba(43,35,32,${a.천.어둡나 ? '0.5' : '0.22'}));}
  .얼굴 img{width:100%;height:auto;display:block;}
  /* 구석 표기 — 설계 §8-2 상시 4층의 하나. 작게, 늘 같은 자리에. */
  .구석{position:absolute;left:0;right:0;bottom:44px;z-index:3;text-align:center;}
  .로고{width:104px;margin:0 auto 10px;}
  .로고 svg{width:100%;height:auto;display:block;}
  .만든이{font-size:19px;font-weight:500;letter-spacing:-.01em;color:${a.보조};margin:0;}
</style>
<div class="판">
  ${양모천svg({ ...a.천, w: W, h: H })}<div class="결"></div>
  <div class="얼굴">${가이드img(a.가이드, a.표정)}</div>
  <div class="구석">
    <div class="로고">${워드마크({ 판: a.천.어둡나 ? '다크' : '라이트', 표현: '펠트', 색갈래: '코랄' })}</div>
    <p class="만든이">이 노래는 SYNK가 만들었습니다</p>
  </div>
</div>`;
}

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다');
  return 후보[0];
}

function 굽기(키) {
  const src = path.join(낼곳, `_${키}.html`);
  const png = path.join(낼곳, `${키}.png`);
  fs.writeFileSync(src, 지면(키), 'utf8');
  spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`,
    'file:///' + src.replace(/\\/g, '/')], { encoding: 'utf8' });
  if (!fs.existsSync(png)) throw new Error(`굽기 실패: ${키}`);
  fs.unlinkSync(src);
  return { 키, png, 바이트: fs.statSync(png).size };
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--장르');
  const 하나 = i >= 0 ? argv[i + 1] : null;
  const 모름 = argv.filter((x) => x.startsWith('--') && x !== '--장르');
  if (모름.length) { console.error(`[라디오배경굽기] 모르는 플래그 ${모름.join(' ')} — 아는 것은 --장르 뿐이다.`); process.exit(1); }
  if (하나 && !장르들[하나]) throw new Error(`모르는 장르: ${하나} (있는 것: ${Object.keys(장르들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });
  const 목록 = 하나 ? [하나] : Object.keys(장르들).filter((k) => !장르들[k].대기);
  const 뺀것 = Object.keys(장르들).filter((k) => 장르들[k].대기);
  for (const k of 목록) {
    const r = 굽기(k);
    console.log(`✅ ${k.padEnd(8)} ${장르들[k].이름} · ${장르들[k].가이드} · ${W}×${H} · ${(r.바이트 / 1024).toFixed(0)}KB`);
  }
  if (!하나 && 뺀것.length) {
    console.log(`⏳ 대기 = ${뺀것.map((k) => `${k}(${장르들[k].가이드})`).join(' · ')} — 얼굴이 아직 없어 안 굽는다(유호 확정 09-02)`);
  }
  console.log(`\n[라디오배경굽기] ${목록.length}장 · ${path.relative(ROOT, 낼곳)}`);
}

if (require.main === module) main();
module.exports = { 장르들 };
