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
 *   ④ **로컬 `<script src>` 도 심는다**(08-28). 그림만 심으면 첨부로 건너간 판에서 스크립트가
 *      조용히 죽는다 — 그림처럼 «깨져 보이지» 않고 기능만 사라져 아무도 모른다. 외부 CDN 은 안 건드린다.
 *
 *   ⑤ **브랜드 서체(SUIT)도 심는다**(09-03 · 구 판정 「폰트는 안 심는다」를 뒤집었다).
 *      구 사유는 «심으면 파일이 수 MB» 였는데 그 수가 틀렸다 — 실측 +0.81MB 다. 그리고
 *      **읽는 사람이 받는 바이트는 안 늘어난다**: CDN 도 unicode-range 쪼개기 없이 같은 610KB
 *      woff2 를 통째로 줬다(09-03 대조). 인라인은 그 바이트를 옮길 뿐 더하지 않는다.
 *      뒤집은 진짜 사유 둘: ⓐ 아티팩트 뷰어의 CSP 가 스타일시트를 Google Fonts 에서만 받아
 *      **발행하면 브랜드 서체가 에러 없이 사라졌다** ⓑ 인터넷 없는 자리에서도 같다.
 *      자립형의 계약이 «파일 하나»라면 서체도 그 안에 있어야 한다 — 정본 tools/lib/브랜드폰트.js.
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
/* 자립형의 계약은 «파일 하나»다 — 서체도 그 안에 든다(정본 = 이 모듈 하나). */
const 브랜드폰트 = require('./lib/브랜드폰트.js');

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

  /* ── 스크립트도 심는다 (08-28 신설) ────────────────────────────────────────
   * 왜: 자립형은 «파일 하나»가 계약이다. 그림만 심고 `<script src>` 를 두고 가면 첨부로 건너간
   * 판에서 그 스크립트만 조용히 죽는다 — 그림처럼 «깨져 보이지» 않고 **기능만 사라져서** 아무도 모른다.
   * 그래서 홈페이지 4D 엔진을 지면에 통째로 박는 대신 파일로 두고 여기서 심는다(정본이 둘이 되는 것을 막는다). */
  let 심은스크립트 = 0, 스크립트바이트 = 0;
  const 나온판2 = 나온판.replace(/<script\b([^>]*)\ssrc=["']([^"']+)["']([^>]*)><\/script>/g,
    (tag, 앞, 경로, 뒤) => {
      if (/^(data:|https?:|\/\/)/.test(경로)) return tag;   // 외부 CDN — 손대지 않는다
      const 절대 = path.resolve(폴더, decodeURIComponent(경로));
      if (!fs.existsSync(절대)) throw new Error(`원본 스크립트가 없다: ${경로} (${절대})`);
      const 몸 = fs.readFileSync(절대, 'utf8');
      if (/<\/script/i.test(몸)) throw new Error(`스크립트 안에 </script 가 있다 — 심으면 판이 갈린다: ${경로}`);
      심은스크립트++; 스크립트바이트 += Buffer.byteLength(몸);
      return `<script${앞}${뒤}>\n/* ↓ 심은 파일: ${경로} — 정본은 그쪽이다. 여기를 고치지 마라. */\n${몸}\n</script>`;
    });

  /* 서체를 심는다(⑤) — 바깥에서 부르는 줄을 걷고 그 자리에 woff2 를 넣는다. 멱등이다. */
  const 서체 = 브랜드폰트.심기(나온판2);
  const 나온판3 = 서체.html;

  const out = src.replace(/\.html$/, '_자립형.html');
  fs.writeFileSync(out, 나온판3);
  const kb = (n) => (n / 1024).toFixed(0) + 'KB';
  console.log(`✅ ${path.relative(ROOT, out)}`);
  /* ⚠ 「단 것 0장」만 내면 «눈을 감았다»와 «달 필요가 없었다»가 같은 모양이 된다 — 분모와 함께 낸다.
   *   (실측 08-15: 소스에 손으로 표식을 박은 판이 「0장」으로 찍혀 두 번 재게 만들었다.) */
  console.log(`   심은 그림 ${센것}장 · 그림 합 ${kb(총바이트)} · 스크립트 ${심은스크립트}벌 ${kb(스크립트바이트)}` +
              ` · 서체 SUIT ${서체.바뀜 ? '심음' : '이미 있음'}(${서체.자리})` +
              ` · 파일 ${kb(Buffer.byteLength(나온판3))}` +
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
