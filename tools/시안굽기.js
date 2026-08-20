#!/usr/bin/env node
/* 시안굽기 — 홈페이지 시안을 **자립형 HTML 한 장**으로 굽는다(이미지를 파일 안에 심는다).
 *
 * 왜 있나(= 상대경로로 두면 안 되는 이유):
 *   시안은 채팅 첨부·메일·카톡으로 «파일 하나»로 건너간다. 그런데 `<img src="../캐릭터/…">` 는
 *   그 폴더가 함께 가야만 뜬다 — 파일만 열면 **그림이 전부 깨진다**.
 *   실측 2026-08-15: 유호님이 「이미지가 오류나서 안 보여」. 구 시안(`빌드.js`)이 webp 2장을
 *   base64 로 심어 자립형을 낸 것도 같은 이유였다 — 이 도구는 그 처방을 임의 시안으로 넓힌 것이다.
 *
 * 무엇을 하나:
 *   ① `<img src>` 의 상대경로를 repo 기준으로 풀어 **ffmpeg 로 webp 리사이즈** 후 data URI 로 심는다.
 *      폭은 `data-굽기폭="720"` 으로 태그마다 지정한다(없으면 기본 720 — 화면에 뜨는 크기의 2배쯤).
 *   ② 마스코트 그림에는 **`data-synk-mascot` 을 자동으로 단다.**
 *      🔑 브랜드렌더린트는 마스코트를 `src` 경로(`펠트코랄_0815/`)로 찾는다 — data URI 로 바꾸면
 *      경로가 사라져 **그 검사가 통째로 눈을 감는다**(그 파일 주석이 이 함정을 명시한다).
 *      속성을 안 달면 「마스코트 바닥 0」이 «깨끗함»이 아니라 «해당 없음»이 되는데 출력은 똑같이 초록이다.
 *   ③ 원본은 안 건드린다 — 굽는 판은 `_자립형.html` 꼬리를 단 별도 파일이다.
 *
 * ⚠ 폰트는 안 심는다 — CDN 2곳(구 시안과 같은 의존)이고, 심으면 파일이 수 MB 가 된다.
 *   인터넷이 없는 자리에서 열면 시스템 폰트로 떨어진다(레이아웃은 산다).
 *
 * 사용법:
 *   node tools/시안굽기.js docs/홈페이지_시안/병합판.html
 *   node tools/시안굽기.js docs/홈페이지_시안/*.html
 * 종료 코드: 0=성공 · 1=실패(원본 이미지 없음·ffmpeg 없음 — 조용히 넘어가지 않는다) */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { 마스코트경로다 } = require('./lib/마스코트자산');

const ROOT = path.resolve(__dirname, '..');
const 기본폭 = 720;

function ffmpeg있나() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

/* 이미지 한 장 → webp data URI. 실패는 던진다(빈 문자열로 돌려주면 그림 없는 판이 조용히 나간다). */
function 구워서심기(절대경로, 폭) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-bake-')), 'o.webp');
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', 절대경로,
    '-vf', `scale=${폭}:-1`, '-c:v', 'libwebp', '-quality', '84', tmp,
  ]);
  const b64 = fs.readFileSync(tmp).toString('base64');
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  return { uri: `data:image/webp;base64,${b64}`, 바이트: Buffer.byteLength(b64) };
}

function 굽기(파일) {
  const src = path.resolve(ROOT, 파일);
  const html = fs.readFileSync(src, 'utf8');
  const 폴더 = path.dirname(src);
  let 센것 = 0, 총바이트 = 0, 마스코트단것 = 0, 마스코트총 = 0;

  const 나온판 = html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = tag.match(/\ssrc=["']([^"']+)["']/);
    if (!m) return tag;
    const 경로 = m[1];
    if (/^(data:|https?:)/.test(경로)) return tag;          // 이미 심겼거나 외부 — 손대지 않는다

    const 절대 = path.resolve(폴더, decodeURIComponent(경로));
    if (!fs.existsSync(절대)) throw new Error(`원본 이미지가 없다: ${경로} (${절대})`);

    const 폭m = tag.match(/\sdata-굽기폭=["'](\d+)["']/);
    const { uri, 바이트 } = 구워서심기(절대, 폭m ? Number(폭m[1]) : 기본폭);
    센것++; 총바이트 += 바이트;

    let 새태그 = tag.replace(m[0], ` src="${uri}"`);
    /* 마스코트면 린트가 볼 수 있게 표식을 단다 — 경로가 사라지기 «전에» 판정한다. */
    if (마스코트경로다(경로)) {
      마스코트총++;
      if (!/data-synk-mascot/.test(새태그)) {
        새태그 = 새태그.replace(/^<img\b/, '<img data-synk-mascot');
        마스코트단것++;
      }
    }
    return 새태그;
  });

  const out = src.replace(/\.html$/, '_자립형.html');
  fs.writeFileSync(out, 나온판);
  const kb = (n) => (n / 1024).toFixed(0) + 'KB';
  console.log(`✅ ${path.relative(ROOT, out)}`);
  /* ⚠ 「단 것 0장」만 내면 «눈을 감았다»와 «달 필요가 없었다»가 같은 모양이 된다 — 분모와 함께 낸다.
   *   (실측 08-15: 소스에 손으로 표식을 박은 판이 「0장」으로 찍혀 두 번 재게 만들었다.) */
  console.log(`   심은 그림 ${센것}장 · 그림 합 ${kb(총바이트)} · 파일 ${kb(Buffer.byteLength(나온판))}` +
              ` · 마스코트 ${마스코트총}장 = 자동 표식 ${마스코트단것} + 소스에 이미 있던 것 ${마스코트총 - 마스코트단것}`);
  if (마스코트총 === 0) {
    console.log('   ⚠ 마스코트 0장 — 이 판에 마스코트가 없거나, 경로가 `tools/lib/마스코트자산.js` 목록 밖이다(린트도 같이 눈을 감는다).');
  }
  if (센것 === 0) console.log('   ⚠ 심은 그림이 0장이다 — 이 판은 애초에 그림이 없거나 이미 자립형이다.');
  return out;
}

const 인자 = process.argv.slice(2);
if (!인자.length) { console.error('쓸 파일을 달라: node tools/시안굽기.js docs/홈페이지_시안/병합판.html'); process.exit(1); }
if (!ffmpeg있나()) { console.error('🔴 ffmpeg 가 없다 — 굽지 않고 멈춘다(그림 깨진 판을 내보내지 않는다).'); process.exit(1); }
try { 인자.forEach(굽기); }
catch (e) { console.error('🔴 굽기 실패 —', e.message); process.exit(1); }
