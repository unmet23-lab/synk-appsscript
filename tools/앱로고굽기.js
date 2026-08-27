#!/usr/bin/env node
/**
 * 앱 로고 굽기 — 정본 SVG 를 SYNK-talk 의 자산 PNG 로 (유호 08-25 「탈크 앱에 syn< 배선」)
 *
 * 왜 자산으로 굽나: talk 은 **react-native-svg 를 안 들인다**(기호.js 규율 — 기호 하나 때문에
 *   네이티브 모듈을 들이면 빌드·EAS 표면이 넓어진다). 그리고 `syn` 글자를 텍스트로 그릴 수도
 *   없다 — talk 에 실린 폰트는 SUIT·DM Mono 뿐이고 **Inter Tight 가 없다**(테마.js 실측).
 *   ⇒ 워드마크는 굽는다. 기호.js 주석이 예고한 그 길이고, 마스코트와 같은 문법이다.
 *
 * 🔑 **정본에서만 굽는다** — 이 파일은 좌표를 하나도 안 갖는다(사본 금지). 로고정본.js 가 고쳐지면
 *   이 명령을 다시 돌리는 것이 갱신 절차다.
 *
 * ■ 왜 1024 인가 (유호 08-25 「1800px 로 안 굽는 이유가 뭐야?」 — 실측으로 답)
 *   Expo 는 `imageWidth`(dp)로 표시한다. 지금 230dp 이므로 **가장 촘촘한 4x 기기에서도
 *   실제로 그려지는 건 920px** 이다. 1024 로 구우면 그 기기가 하는 일은 «축소»이고,
 *   확대가 아니라 축소라 선명하다. 1800 으로 올려 둘 다 920 으로 줄여 나란히 확대해 봤더니
 *   **눈에 보이는 차이가 없었다**(08-25 실측 · 알록판으로 쟀다 — 실땀이 가장 미세한 디테일).
 *   대가만 남는다: 284KB → 704KB(2.5배)가 앱 번들에 그대로 실린다.
 *   ⇒ 앱 자산은 1024. 다만 벡터라 언제든 더 크게 뽑을 수 있으니 `--너비` 를 열어 둔다
 *     (스토어 이미지·마케팅처럼 큰 원본이 필요한 자리용).
 *
 * 사용: node tools/앱로고굽기.js            (굽고 talk/assets 에 쓴다)
 *      node tools/앱로고굽기.js --확인      (쓰지 않고 크기만 보고)
 *      node tools/앱로고굽기.js --너비 1800 (고해상도 마스터가 필요할 때)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const 로고 = require('./lib/로고정본.js');

const 크롬 = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* 🔴 워크트리에서 `__dirname/../..` 은 `.claude/worktrees/` 를 가리킨다 — 거기엔 형제가 없고
 *   증상은 「talk 에 못 썼다」가 아니라 **엉뚱한 자리에 조용히 굽는 것**이다(08-26 실측:
 *   `…/.claude/worktrees/SYNK-talk` · 존재 false). 자리는 통로 하나가 답한다. */
const talk = require('../.claude/hooks/lib/형제저장소.js').형제경로(path.resolve(__dirname, '..'));
const 확인만 = process.argv.includes('--확인');
const 너비인자 = process.argv.indexOf('--너비');
const 기본너비 = 너비인자 > -1 ? Number(process.argv[너비인자 + 1]) : 1024;

/* 구울 것 — 앱이 로고를 «보이는» 자리.
 * 🔑 **스플래시는 알록판이다**(유호 픽 ② 08-25 — 「스플래시까지 알록」). 알록의 조건인
 *   «110px↑ 큰 판»을 스플래시는 항상 만족하고(230dp), 앱을 켤 때마다 수놓은 로고가 뜬다.
 *   상시 코랄 규율은 그대로 — 넓힌 것은 이 자리 하나다.
 * 배경 투명 · 정사각 캔버스는 Expo 관례라 PNG 합성 단계에서 맞춘다.
 *
 * 🔴 **08-28 — 과녁이 한 칸뿐이라 아이콘 넷이 그물 밖에 있었다.**
 *   이 도구가 `splash-icon.png` 하나만 굽는 동안, 같은 폴더의 `icon`·`android-icon-{foreground,
 *   background,monochrome}`·`favicon` 다섯 칸은 **평면 「S.」** 로 남아 있었다. 「S.」는 로고 정본
 *   (`lib/로고정본.js`)에 **없는 마크**다 — 정본은 대외 `synk`(어센더 k)·앱 `syn<`(꺾쇠 T4) 둘뿐이다.
 *   ⇒ 학생이 SYNK 를 «처음 보는 자리»(폰 홈 화면)가 퇴역 마크였고, 앱을 열면 펠트 `syn<` 가 떴다.
 *   같은 날 3b 세션이 홈페이지 헤더에서 «같은 병의 같은 얼굴»을 잡았다(도구 과녁이 `docs/발표물`
 *   하나뿐이라 홈페이지가 밖에 있었다). **정본을 정하는 것만으로는 안 닫힌다 — 과녁이 정본을
 *   실어 나르는 자리를 «전부» 덮어야 닫힌다.**
 *
 * ■ 아이콘 마크는 왜 «도장»인가 (정본 함수 `로고.도장` · 내가 만든 그림이 아니다)
 *   정사각 아이콘은 정사각 마크를 부른다. 워드마크는 가로가 길어(194:128) 정사각에 넣으면
 *   레터박스가 되고 48dp 런처에서 못 읽는다. 도장은 원반이라 꽉 차고, 코랄 신호 + 펠트 결 +
 *   기호 `<` 셋을 한 판에 진다. 후보 비교는 `--후보` 가 낸다(유호님 눈이 판정 축 · 08-28 대기).
 *   ⚠ 안드로이드 적응형 아이콘은 바깥 33%가 «잘릴 수 있다» — 전경은 62% 안에 앉힌다. */
const 아이콘몸 = 로고.도장({ px: 1000 });
/** 정사각 캔버스 «안»에 마크를 비율로 앉힌다 — 적응형 안전지대(62%)를 지키는 자리.
 * 🔴 `칸` 은 «그 항목의 폭»이지 기본너비가 아니다 — 08-28 실측: favicon(64px)에 1024 지면을
 *   짜 놓고 64×64 창으로 찍었더니 **왼쪽 위 모서리만 잘려 새까만 사각형**이 나왔다.
 *   크롬 스크린샷은 «창 크기»만 찍는다(그 함정은 앱 모션 갈래에서도 한 번 밟았다). */
const 앉힘 = (svg, 채움, 바탕 = 'transparent', 칸 = 기본너비) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:${바탕}}
 .판{width:${칸}px;height:${칸}px;display:flex;align-items:center;justify-content:center}
 .판 svg{width:${Math.round(칸 * 채움)}px;height:auto;display:block}</style>
<div class="판">${svg}</div>`;

const 굽기 = [
  { 이름: 'splash-icon.png', svg: 로고.워드마크({ 판: '다크', 신호: '꺾쇠', 색갈래: '알록' }), 폭: 기본너비, 정사각: true },
  /* iOS·일반 아이콘 — 알파를 못 쓰는 자리라 Ink 판을 «칠해서» 굽는다(app.json 의 배경색과 같은 값). */
  { 이름: 'icon.png', 판: 앉힘(아이콘몸, 0.80, '#080605') },
  /* 적응형 전경 — 배경은 아래 background 가 진다. 62%: 바깥 33% 가 마스크에 잘려도 도장이 온전하다. */
  { 이름: 'android-icon-foreground.png', 판: 앉힘(아이콘몸, 0.62) },
  { 이름: 'android-icon-background.png', 판: `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0}div{width:${기본너비}px;height:${기본너비}px;background:#080605}</style><div></div>` },
  /* 단색(테마 아이콘) — 런처가 제 색으로 칠하므로 «실루엣»만 옳으면 된다. 기호 단독이 그 자리다. */
  { 이름: 'android-icon-monochrome.png', 판: 앉힘(로고.기호({ px: 1000, 색값: '#FFFFFF', 그늘값: '#FFFFFF', 땀색: '#FFFFFF' }), 0.52) },
  /* 파비콘은 «크게 굽고 줄인다» — 64px 로 바로 찍으면 크롬이 SVG 를 55px 로 그려 결이 뭉갠다.
   * 512 로 굽고 PIL LANCZOS 로 줄이면 실땀 점선이 살아 남는다(같은 문법이 스플래시 정사각 합성). */
  { 이름: 'favicon.png', 판: 앉힘(아이콘몸, 0.86, '#080605', 512), 폭: 512, 줄임: 64 },
];

const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-로고-'));
let 쓴것 = 0;
for (const g of 굽기) {
  /* 두 갈래다 — `svg` 를 준 것은 viewBox 비율 그대로(락업은 가로가 길다 194:128),
   * `판` 을 준 것은 **이미 정사각으로 짠 지면**이라 그대로 찍는다(아이콘 갈래). */
  const 폭 = g.폭 || 기본너비;
  const 높이 = g.판 ? 폭
    : Math.round(폭 * (() => { const vb = g.svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number); return vb[3] / vb[2]; })());
  const html = g.판 || `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}svg{width:${폭}px;height:${높이}px;display:block}</style>
${g.svg}`;
  const hp = path.join(임시, g.이름.replace('.png', '.html'));
  const pp = path.join(임시, g.이름);
  fs.writeFileSync(hp, html);
  execFileSync(크롬, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', `--screenshot=${pp}`,
    `--window-size=${폭},${높이}`, `file:///${hp.replace(/\\/g, '/')}`], { stdio: 'pipe' });

  const 목표 = path.join(talk, 'assets', g.이름);
  console.log(`  ${g.이름} — ${폭}×${높이}${g.정사각 ? ' → 정사각 합성 필요' : ''}`);
  if (!확인만) {
    if (g.정사각) {
      /* Expo 관례상 정사각 캔버스 — 파이썬(PIL)로 중앙 합성. talk 에 파이썬 의존을 안 남기려고
         굽는 쪽(이 저장소)에서 끝낸다. */
      const py = `
import io
from PIL import Image
src = Image.open(r"${pp}").convert("RGBA")
n = max(src.size)
canvas = Image.new("RGBA", (n, n), (0, 0, 0, 0))
canvas.paste(src, ((n - src.width) // 2, (n - src.height) // 2), src)
canvas.save(r"${목표}")
print("saved", canvas.size)`;
      const pyf = path.join(임시, 'sq.py');
      fs.writeFileSync(pyf, py);
      console.log('   ', execFileSync('python', [pyf], { encoding: 'utf8' }).trim());
    } else if (g.줄임) {
      const py = `
from PIL import Image
im = Image.open(r"${pp}").convert("RGBA").resize((${g.줄임}, ${g.줄임}), Image.LANCZOS)
im.save(r"${목표}")
print("resized", im.size)`;
      const pyf = path.join(임시, 'rs.py');
      fs.writeFileSync(pyf, py);
      console.log('   ', execFileSync('python', [pyf], { encoding: 'utf8' }).trim());
    } else {
      fs.copyFileSync(pp, 목표);
    }
    쓴것++;
  }
}
console.log(확인만 ? '[앱로고굽기] --확인 — 쓰지 않았다' : `[앱로고굽기] ${쓴것}개 → SYNK-talk/assets`);
