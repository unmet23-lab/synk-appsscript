#!/usr/bin/env node
/**
 * FB 카드 굽기 — 페이스북 첫 게시물의 표지 카드를 «펠트 정본»으로 굽는다. (유호 지시 09-07)
 *
 * ■ 왜 새로 짓나 (재굽기가 아니다)
 *   지금 발행 대기 중인 `docs/홍보물/FB_첫게시물_카드_v3.png` 는 **퇴역한 마스코트**로 만들어졌다 —
 *   젤리·유리 재질의 빨간 유령이다. 마스코트 정본이 08-19 에 펠트로 확정되면서 씨앗 파일
 *   (`마스코트_누끼/본체.png`·`본채깜찍.png`)이 폴더째 사라졌다. 그래서 «다시 굽기»가 성립하지
 *   않는다 — 원천도 도구도 없다. 이 파일이 그 자리를 채우는 첫 도구다.
 *   ⇒ memory `fb-first-post-assets` · 브랜드 컨셉 = `felt-is-the-brand-concept`
 *
 * ■ 글자층은 그대로 산다
 *   「안녕하세요 / annyeonghaseyo / 16 + 1 / Улаанбаатар · 2027.02」은 유호님 확정 문안이고
 *   재질과 무관하다. 바뀌는 것은 **그림층뿐**이다.
 *   🔑 `16 + 1` = 나만의 선생님 열여섯(학생 1인당) + 교실의 사람 선생님 한 명.
 *      마스코트는 «열여섯» 쪽이다(F427 — 이 숫자를 뒤집어 물었던 적이 있다).
 *
 * ■ CSS 로 펠트를 흉내내지 않는다
 *   재질은 전부 «구운 자산»에서 온다(잉크천 바탕 · 코랄 매듭점 · 몽글 본체).
 *   그림자·질감을 CSS 로 만들면 그 순간 브랜드가 갈린다 → memory `loom-baked-assets-only-for-ui`.
 *
 * ■ 자립형이다 — 자산을 전부 지면 «안»에 심는다
 *   4K 원본을 그대로 심으면 카드가 20MB 가 되므로 ffmpeg 로 쓸 크기까지 줄여 webp 로 심는다
 *   (`tools/시안굽기.js` 와 같은 처방).
 *   🔴 **서체는 «안» 심는다**(09-07 정정 · 유호 지시 「당연히 고쳐줘」). 여기 「서체도 지면 안에 심는다」고
 *   적혀 있었지만 코드는 줄곧 «빼는» 함수를 부르고 있었고, 실제 `@font-face` 는 0개였다.
 *   ✅ 그리고 그것이 맞다 — 이 카드의 글자는 전부 «오려낸 펠트 그림»이라 서체로 그려지는 글자가 없다.
 *      실측: 서체를 심고 똑같이 다시 구운 판의 sha256 이 지금 카드와 한 글자도 다르지 않다.
 *   ⚠ 그림이 아닌 «진짜 글자»를 이 카드에 넣게 되면 그날 `브랜드폰트.심기` 를 함께 세운다 —
 *      이름만 부르면 바깥 서체가 발행 때 조용히 사라져 시스템 고딕으로 떨어진다.
 *
 * 쓰는 법:
 *   node tools/FB카드굽기.js              → docs/홍보물/FB_첫게시물_카드_v4.png + _src 지면
 *   node tools/FB카드굽기.js --지면만     → 지면(HTML)만 짓고 굽지 않는다
 *   node tools/FB카드굽기.js --라이트    → 밝은 천 판(모래펠트 · 글자는 잉크)
 *   node tools/FB카드굽기.js --out <경로> → 저장 위치
 *   node tools/FB카드굽기.js --몽글 <경로> → 마스코트 판을 갈아 물린다(견줄 때)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 로고 = require('./lib/로고정본.js');
const 브랜드폰트 = require('./lib/브랜드폰트.js');

const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    a[v[i].slice(2)] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();

const W = 1080, H = 1080;
const 지면경로 = path.join(루트, 'docs', '홍보물', '_src_FB첫게시물_카드.html');
const 나갈곳 = path.resolve(인자['out'] || path.join(루트, 'docs', '홍보물', 'FB_첫게시물_카드_v4.png'));

/* ── 색 — 정본에서 온다(글자 사본 금지) ────────────────────────────────── */
const 토큰 = require(path.join(루트, 'docs', '디자인_토큰.json'));
const 킷 = (토큰.색 && 토큰.색.킷) || 토큰.킷;
const 색 = (이름) => {
  const c = 킷.find((x) => x.이름 === 이름);
  if (!c) throw new Error(`디자인_토큰.json 에 «${이름}» 이 없다 — 색 이름이 바뀌었다`);
  return c.hex;
};

/* ── 자산을 쓸 크기로 줄여 data URI 로 ─────────────────────────────────── */
function ffmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (r.status === 0) return 'ffmpeg';
  throw new Error('ffmpeg 를 못 찾았다 — 자산을 줄일 수 없다(원본 4K 를 그대로 심으면 카드가 20MB 가 된다)');
}

/** 그림 한 장을 폭 N 으로 줄여 webp data URI 로. 투명은 지킨다. */
function 심기(상대경로, 폭) {
  const src = path.isAbsolute(상대경로) ? 상대경로 : path.join(루트, 상대경로);
  if (!fs.existsSync(src)) throw new Error(`자산이 없다: ${상대경로}`);
  const 임시 = path.join(os.tmpdir(), `synk-fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`);
  const r = spawnSync(ffmpeg(), ['-y', '-i', src, '-vf', `scale=${폭}:-1:flags=lanczos`,
    '-c:v', 'libwebp', '-lossless', '0', '-q:v', '88', '-pix_fmt', 'yuva420p', 임시],
    { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(임시)) {
    throw new Error(`ffmpeg 실패(${상대경로}): ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  }
  const b64 = fs.readFileSync(임시).toString('base64');
  fs.unlinkSync(임시);
  return { uri: `data:image/webp;base64,${b64}`, KB: Math.round(b64.length * 0.75 / 1024) };
}

/** 「안녕하세요」를 «구운 펠트 천에서 오려» 만든다 — 디지털 서체 대신(유호 지적 09-07
 *  「우리 글자 구운건 언제 쓰려고?」). 오리는 자 = tools/펠트글자.py(09-05 유호 확정 통로).
 *  천은 바탕과 반대로 고른다 — 밝은 바탕에는 먹색 글자, 어두운 바탕에는 모래 글자. */
function 펠트글자(글, 천, 크기, 자간 = 0.05) {
  const 낼곳 = path.join(os.tmpdir(), `synk-글자-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  const r = spawnSync('python', [path.join(루트, 'tools', '펠트글자.py'), 글,
    '--천', 천, '--크기', String(크기), '--자간', String(자간), '--낼곳', 낼곳],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 300000 });
  if (!fs.existsSync(낼곳)) {
    throw new Error(`펠트글자.py 가 «${글}» 를 못 냈다: ${(r.stderr || r.stdout || '').split('\n').slice(-3).join(' ')}`);
  }
  const b64 = fs.readFileSync(낼곳).toString('base64');
  const png = fs.readFileSync(낼곳);
  const 폭 = png.readUInt32BE(16), 높 = png.readUInt32BE(20);
  fs.unlinkSync(낼곳);
  return { uri: `data:image/png;base64,${b64}`, 폭, 높, KB: Math.round(b64.length * 0.75 / 1024) };
}

/** 「16 + 1」처럼 «천이 섞인 한 줄»을 만든다 — «+» 만 브랜드 코랄 천이다.
 *  붙이는 일은 그림 쪽에서 끝낸다(tools/펠트글귀.py) — 지면에서 조각을 나란히 놓으면
 *  조각마다 여백이 달라 기준선이 어긋난다. */
function 펠트글귀(조각들, 크기) {
  const 낼곳 = path.join(os.tmpdir(), `synk-글귀-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  const r = spawnSync('python', [path.join(루트, 'tools', '펠트글귀.py'),
    '--조각', ...조각들, '--크기', String(크기), '--낼곳', 낼곳],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 600000 });
  if (!fs.existsSync(낼곳)) {
    throw new Error(`펠트글귀.py 가 못 냈다: ${(r.stderr || r.stdout || '').split(/\r?\n/).slice(-3).join(' ')}`);
  }
  const png = fs.readFileSync(낼곳);
  const out = { uri: `data:image/png;base64,${png.toString('base64')}`,
                폭: png.readUInt32BE(16), 높: png.readUInt32BE(20),
                KB: Math.round(png.length / 1024) };
  fs.unlinkSync(낼곳);
  return out;
}

/** 자산 안에서 «그림이 실제로 있는 자리»를 잰다(0~1 비율).
 *  몽글 본체는 정사각 캔버스 안에 몸이 떠 있어서, 화면에 얹은 상자와 «보이는 몸»의 자리가 다르다.
 *  그 차이를 모르고 자리를 손으로 박으면 위아래 글자와 겹친다(유호 지적 09-07
 *  「알파벳 안녕하세요가 약간 몽글이 머리 끝이랑 겹치네」). */
function 그림자리(상대경로) {
  const src = path.isAbsolute(상대경로) ? 상대경로 : path.join(루트, 상대경로);
  const 코드 = 'import sys;from PIL import Image;'
    + 'b=Image.open(sys.argv[1]).convert("RGBA").getbbox();'
    + 'im=Image.open(sys.argv[1]);'
    + 'print(b[0]/im.width,b[1]/im.height,b[2]/im.width,b[3]/im.height)';
  const r = spawnSync('python', ['-c', 코드, src],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 120000 });
  const 값 = String(r.stdout || '').trim().split(/\s+/).map(Number);
  if (값.length !== 4 || 값.some(Number.isNaN)) {
    throw new Error(`그림 자리를 못 쟀다(${상대경로}): ${(r.stderr || '').slice(-200)}`);
  }
  return { 왼: 값[0], 위: 값[1], 오른: 값[2], 아래: 값[3] };
}

/* ── 지면 ──────────────────────────────────────────────────────────────── */
function 지면짓기() {
  /* 🔴 바탕은 «띠»가 아니라 «천»이어야 한다 — `DK1_띠_잉크천` 은 이름 그대로 가로 밴드라
     화면에 깔면 위아래로 회색 줄이 생긴다(09-07 첫 판에서 실제로 그렇게 나왔다).
     🔴 그리고 «어두운 천»에서는 몽글의 밝은 잔털이 «오려낸 흰 선»으로 읽힌다(유호 지적 09-07 ·
     실측: 가장자리에서 안쪽 40칸까지 채도가 45→117 로 서서히 오른다 = 누끼 잔재가 아니라
     실제 보풀 광채다). 밝은 천에서는 그 잔털이 바탕에 이어져 선이 사라진다. */
  const 라이트 = !!인자['라이트'];
  /* 🔑 천은 «.avif» 를 쓴다 — 저장소가 쥐는 것이 그 꼴이다(.gitignore 가 구움 폴더의 png 는
     막고 avif 만 예외로 둔다). png 를 가리키면 이 기계에서만 굽히고 다른 기계에서는 죽는다. */
  const 바탕 = 심기(라이트 ? 'docs/Loom_자산/구움/공방_모래펠트.avif'
                        : 'docs/Loom_자산/구움/공방_먹색펠트.avif', 1400);
  /* --몽글 로 다른 판을 물릴 수 있다 — 가장자리 처방을 견줄 때 쓴다(09-07). */
  const 몽글 = 심기(인자['몽글'] || 'docs/캐릭터/정본_4K/몽글_본체.png', 1000);
  /* 인사말은 오려 만든 펠트 글자다. 천은 바탕과 반대로 골라 읽히게 한다. */
  /* 🔴 글자 천은 «밝기»로 고른다 — 모래펠트로 오렸더니 글자가 묻혔다(유호 지적 09-07
     「글씨랑 숫자가 강조되는게 좀 죽는것같다」). 실측: 어두운 바탕과의 대비가 흰 서체 15.3 대
     모래펠트 6.0 으로 절반 아래였다. 크림 양모 펠트(펠트_종이바탕)는 250,247,239 라
     흰 서체와 «같은» 15.3 이 나온다 — 재질은 펠트로 두고 또렷함만 되찾는 자리다. */
  const 인사천 = 라이트 ? '공방_먹색펠트.avif' : '펠트_종이바탕.webp';
  /* 🔑 자간 0.05 — 보풀이 획 밖으로 번져서, 폰트가 알맞다고 보는 간격이 펠트에서는 붙어
     보인다(09-07 첫 판에서 「녕」 받침이 「하」에 닿았다). */
  const 인사 = 펠트글자('안녕하세요', 인사천, 200, 0.05);
  const 인사폭 = 580;                                    // 카드 위 실제 폭(px)
  const 인사높 = Math.round(인사.높 * 인사폭 / 인사.폭);
  /* 「16 + 1」 — 숫자는 인사말과 같은 천, «+» 만 브랜드 코랄 천이다(유호 지시 09-07
     「펠트로 해보자」 · 코랄 천은 그날 새로 구웠다 · 336원). */
  const 수 = 펠트글귀([`16:${인사천}`, '+:공방_코랄펠트.avif:150', `1:${인사천}`], 220);
  const 수폭 = 384;
  const 수높 = Math.round(수.높 * 수폭 / 수.폭);

  /* ── 세로 자리는 «위에서 아래로» 사슬로 푼다 ──────────────────────────────
     손으로 박은 수를 쓰면 글자 하나만 길어져도 아래가 밀려 겹친다. 09-07 에 실제로
     로마자가 몽글 머리에 닿았다. 그래서 아래 값들은 전부 «앞 요소가 끝나는 자리»에서 나온다. */
  const 인사자리 = 190;
  const 로마자리 = 인사자리 + 인사높 + 16;
  const 로마높 = 30;                                   // font-size 23 + 줄 여백
  const 몽글폭 = 470;
  const 몽글틀 = 그림자리(인자['몽글'] || 'docs/캐릭터/정본_4K/몽글_본체.png');
  const 몸위여백 = 몽글폭 * 몽글틀.위;                   // 상자 위쪽의 «빈 곳»
  const 몸아래여백 = 몽글폭 * (1 - 몽글틀.아래);
  const 숨틈 = 46;                                     // 로마자 아래와 몽글 «몸» 사이
  const 몽글가운데 = 로마자리 + 로마높 + 숨틈 - 몸위여백 + 몽글폭 / 2;
  const 수자리 = Math.round(몽글가운데 + 몽글폭 / 2 - 몸아래여백 + 34);
  const 자리자리 = 수자리 + 수높 + 34;
  const 잰것 = { 바탕이름: 라이트 ? '모래펠트' : '먹색펠트', 바탕: 바탕.KB,
              몽글: 몽글.KB, 인사천: 인사천.replace('공방_', '').replace('.avif', ''),
              인사: 인사.KB, 수: 수.KB };

  /* 🚫 원판(젤리)의 «빛 점 아치»는 옮기지 않았다. 그건 네온 문법이고, 펠트에서 그 자리를
     채울 구운 부품(매듭점·반짝임)은 낱개가 커서 열둘을 늘어놓으면 시끄럽다.
     ⇒ 카드 한 장은 천의 결과 마스코트 하나로 선다. 다시 넣고 싶으면 «점 하나짜리» 부품을
       먼저 굽는다 — CSS 로 그리지 않는다(memory `loom-baked-assets-only-for-ui`). */

  const 원고 = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>SYNK · FB 첫 게시물 카드 1080×1080</title>
<!-- 🔴 손으로 고치지 않는다 — 이 파일은 \`node tools/FB카드굽기.js\` 가 짓는다.
     값 원천: 색 = docs/디자인_토큰.json · 로고 = tools/lib/로고정본.js · 서체 = tools/lib/브랜드폰트.js
     문안은 유호님 확정본이다(FB_첫게시물_올리는법.md 와 같은 문장). -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300..800&family=DM+Mono:wght@300;400;500&display=swap">
<style>
/*@FONTS@*/
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
/* 🔴 여기 맨 앞에 있던 «SUIT» 를 09-07 에 걷었다 (유호 지시 「당연히 고쳐줘」).
   이 카드의 큰 글자(「안녕하세요」·「16 + 1」)는 펠트 천에서 오려낸 그림이고, 남은 작은 글자
   (로마자·자리때)는 아래에서 Inter Tight 를 따로 부른다 ⇒ SUIT 로 그려지는 글자가 한 자도 없었다.
   그런데 이름이 여기 남아 있어서 지면폰트 시험이 「이름만 부르고 안 싣는 지면」으로 매번 울었고,
   그 빨강 하나가 저장소 전체 초록을 요구하는 배포 게이트를 막고 있었다.
   📏 실측으로 갈랐다 — 서체를 심고 똑같이 다시 구운 판의 sha256 이 지금 카드와 한 글자도 다르지 않다
      (4a4b39e78455c561…). 그래서 «심기»가 아니라 «안 쓰는 이름 걷기»가 참인 처방이다.
   🔓 되살릴 자리 = 이 카드에 «그림이 아닌 진짜 한글 글자»를 넣게 되는 날. 그때는 이름만 되돌리지 말고
      브랜드폰트의 심기로 실제 서체까지 함께 싣는다(이름만 부르면 시스템 고딕으로 조용히 떨어진다).
   ⚠ 이 주석은 템플릿 문자열 «안»이다 — 백틱을 쓰면 지면이 통째로 깨진다(09-07 에 한 번 깼다). */
body{position:relative;background:${라이트 ? 색('Paper') : 색('Ink Deep')};
  font-family:'Inter Tight',system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}

/* 바탕 — 구운 펠트 천. 글자가 읽히게 눌러 주되 결은 남긴다. */
.천{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  filter:${라이트 ? 'brightness(1.06) saturate(.92)' : 'brightness(.62) saturate(.9)'}}
.그늘{position:absolute;inset:0;
  background:${라이트
    ? 'radial-gradient(118% 88% at 50% 50%, rgba(251,247,240,0) 0%, rgba(251,247,240,.5) 92%)'
    : 'radial-gradient(118% 88% at 50% 50%, rgba(8,6,5,0) 0%, rgba(8,6,5,.86) 88%)'}}

/* 로고 — viewBox 181×128 이라 높이는 폭의 0.707 배다(폭 150 → 높이 106). */
.로고{position:absolute;top:64px;left:50%;transform:translateX(-50%);width:150px;display:block}

/* 인사말 — 오려 만든 펠트 글자(그림이다. 서체가 아니다). */
.인사{position:absolute;top:${인사자리}px;left:50%;transform:translateX(-50%);
  width:${인사폭}px;height:${인사높}px;display:block}
.로마{position:absolute;top:${로마자리}px;line-height:${로마높}px;left:0;right:0;text-align:center;
  font-family:'DM Mono',ui-monospace,Consolas,monospace;
  font-size:23px;letter-spacing:.34em;color:${라이트 ? 색('Deep Wool') : 색('Ash Wool')}}

/* 마스코트 — 몽글 본체(펠트 정본). 그림자는 자산이 이미 가지고 있다. */
.몽글{position:absolute;left:50%;top:${Math.round(몽글가운데)}px;transform:translate(-50%,-50%);
  width:${몽글폭}px;display:block}

/* 숫자 — 오려 만든 펠트 글귀. «+» 만 코랄 천이다. */
.수{position:absolute;top:${수자리}px;left:50%;transform:translateX(-50%);
  width:${수폭}px;height:${수높}px;display:block}

/* 자리·때 — 숫자 아래에 붙지 않게 «숫자가 끝나는 자리»에서 띄운다. */
.자리{position:absolute;top:${자리자리}px;left:0;right:0;text-align:center;
  font-family:'Inter Tight',system-ui,sans-serif;font-weight:400;
  font-size:27px;letter-spacing:.03em;color:${라이트 ? 색('Deep Wool') : 색('Ash Wool')}}
</style></head><body>

<img class="천" src="${바탕.uri}" alt="">
<div class="그늘"></div>

${로고.워드마크({ 판: 라이트 ? '라이트' : '다크', 표현: '펠트', 클래스: '로고' })}

<img class="인사" src="${인사.uri}" alt="안녕하세요">
<div class="로마">annyeonghaseyo</div>

<img class="몽글" src="${몽글.uri}" alt="펠트 마스코트 몽글">

<img class="수" src="${수.uri}" alt="16 + 1">
<div class="자리">Улаанбаатар · 2027.02</div>

</body></html>
`;
  return {
    원고, 잰것,
    자리: {
      인사: 인사자리, 인사폭, 인사높,
      로마: 로마자리, 로마높,
      몽글가운데, 몽글폭,
      수: 수자리, 수폭, 수높,
      자리: 자리자리,
    },
  };
}

/* ── 크롬 ──────────────────────────────────────────────────────────────── */
function 크롬() {
  const 후보 = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter((p) => p && fs.existsSync(p));
  return 후보[0] || null;
}

function 굽기(지면, out) {
  const exe = 크롬();
  if (!exe) {
    console.error('SKIP: 크롬을 못 찾았다 — **안 구웠다**(성공 아님). CHROME_PATH 로 지정할 수 있다.');
    return 2;
  }
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fb카드-'));
  const r = spawnSync(exe, ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${W},${H}`, `--screenshot=${out}`, `--user-data-dir=${방}`,
    'file:///' + 지면.replace(/\\/g, '/')], { encoding: 'utf8', timeout: 120000 });
  try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 임시방은 남아도 해가 없다 */ }
  if (!fs.existsSync(out)) {
    console.error('크롬이 그림을 안 냈다:', (r.stderr || '').split('\n').slice(-5).join('\n'));
    return 1;
  }
  return 0;
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
function main() {
  const { 원고, 잰것, 자리 } = 지면짓기();

  /* 🔴 09-07 정정 — 여기 주석이 「서체를 지면 안에 심는다」였는데 **코드는 정반대**였다.
     `브랜드폰트.원고로()` 는 이름 그대로 «원고로 되돌리는» 함수라 심은 서체를 도로 뺀다
     (게다가 인자를 하나만 받아서 `{자리}` 는 그냥 버려지고 있었다).
     그래서 이 지면의 `@font-face` 는 줄곧 0개였고, 아래 「자립형」 줄이 그 위에 거짓 초록을 찍었다.
     ✅ 부르는 함수는 그대로 둔다 — 이 카드는 글자가 전부 그림이라 서체가 필요 없고, 원고를 가볍게
        두는 것이 맞다(814KB 차이). **틀린 것은 코드가 아니라 주석과 그 아래 보고였다.** */
  const 낼원고 = 브랜드폰트.원고로(원고);
  fs.mkdirSync(path.dirname(지면경로), { recursive: true });
  fs.writeFileSync(지면경로, 낼원고, 'utf8');
  console.log(`■ 지면  ${path.relative(루트, 지면경로)}  (${Math.round(낼원고.length / 1024)}KB)`);
  console.log(`   심은 자산 — ${잰것.바탕이름} ${잰것.바탕}KB · 몽글 ${잰것.몽글}KB · 오린 글자(${잰것.인사천}) ${잰것.인사}KB · 오린 숫자 ${잰것.수}KB`);

  /* 🔑 자리표를 내보낸다 — 영상 티저가 «같은 값»을 문다.
     티저의 마지막 프레임은 이 카드와 같은 그림이어야 뜻이 산다(6초를 본 눈에 남는 그림과
     피드에 뜨는 표지가 같아야 한다). 두 곳이 자리를 따로 알면 그날 바로 갈린다. */
  /* 🔴 `영상/public/` 은 .gitignore 가 막는 파생물 폴더다 — 거기 쓰면 다른 기계에서 영상 빌드가
     «파일이 없다»로 죽는다. 그래서 저장소가 쥐는 자리에 둔다(영상 킷이 디자인 토큰을 그렇게 문다). */
  const 자리표경로 = path.join(루트, 'docs', '홍보물', '카드_자리.json');
  {
    fs.writeFileSync(자리표경로, JSON.stringify({
      _왜: 'tools/FB카드굽기.js 가 쓴다. 손으로 고치지 않는다 — 카드를 다시 구우면 덮인다.',
      캔버스: { 폭: W, 높이: H },
      로고: { 위: 64, 폭: 150 },
      인사: { 위: 자리.인사, 폭: 자리.인사폭, 높이: 자리.인사높 },
      로마: { 위: 자리.로마, 높이: 자리.로마높, 크기: 23 },
      몽글: { 가운데: Math.round(자리.몽글가운데), 폭: 자리.몽글폭 },
      수: { 위: 자리.수, 폭: 자리.수폭, 높이: 자리.수높 },
      자리때: { 위: 자리.자리, 크기: 27 },
    }, null, 2) + require('os').EOL, 'utf8');
    console.log(`   자리표 → ${path.relative(루트, 자리표경로)} (영상 티저가 이 값을 문다)`);
  }

  if (인자['지면만']) { console.log('   (--지면만 이라 굽지 않았다)'); return 0; }

  const 코드 = 굽기(지면경로, 나갈곳);
  if (코드 !== 0) return 코드;

  const b = fs.readFileSync(나갈곳);
  const 폭 = b.readUInt32BE(16), 높 = b.readUInt32BE(20);
  console.log(`■ 카드  ${path.relative(루트, 나갈곳)}  (${폭}×${높} · ${Math.round(b.length / 1024)}KB)`);
  if (폭 !== W || 높 !== H) {
    console.error(`🔴 크기가 다르다 — ${W}×${H} 를 시켰는데 ${폭}×${높} 이 나왔다`);
    return 1;
  }
  /* 🔴 09-07 정정 — 여기 「자산·서체가 전부 지면 안에 있다」고 **말만** 찍고 있었다.
     서체는 0개였는데도 그 줄이 매번 초록으로 떴다(memory zero-is-a-success-face-taxonomy).
     ⇒ 말하지 말고 **세어서** 찍는다. 서체가 없는 것은 이 카드에서 «정상»이다(글자가 전부 그림이라서).
        그러니 없다고 울지 않고, 대신 「그림이 아닌 글자를 넣는 날 심어야 한다」를 그 자리에 남긴다. */
  const 서체안에 = 브랜드폰트.심겼나(낼원고);
  console.log(`   ✅ 자립형 — 자산이 전부 지면 안에 있다(바깥 참조는 Google Fonts 미리보기 한 줄뿐)`);
  console.log(`   ${서체안에 ? '· 서체도 안에 심겼다' : '· 서체는 안 심었다 — 이 카드의 글자는 전부 오려낸 그림이라 안 쓴다(그림 아닌 글자를 넣는 날 심는다)'}`);
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { 지면짓기, 굽기 };
