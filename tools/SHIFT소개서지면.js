#!/usr/bin/env node
'use strict';
/**
 * SHIFT 소개서 지면 — 정본 글 한 벌을 **펠트 부품을 입은 한 장**으로 굽는다.
 *
 * ■ 왜 있나 (2026-09-03 · 유호 지시 「synk shift 소개서 만들어줘」)
 *   글은 이미 있었다 — `docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt`(09-03 `2afe65d78`).
 *   없던 것은 **디자인된 지면**이다: 엔진은 소개서 지면이 일곱 벌인데 SHIFT 는 글만 있었다.
 *   ⇒ 글을 새로 쓰지 않는다. **정본을 읽어 지면으로 굽는다.**
 *
 * ■ 🔴 이 통로가 지는 규율 하나 — 손으로 안 고친다
 *   산출물(`docs/SHIFT/SYNK_SHIFT_소개서.html`)을 손으로 고치면 다음 굽기가 되돌린다
 *   (`발표물빌드.js`·`지면재현.test.js` 와 같은 규율). 글을 고칠 자리는 «정본 txt» 하나다.
 *
 * ■ ⚠ 세운 함정 둘 (같은 날 다른 자리에서 밟았다)
 *   ① `loom.css()` 는 **색을 «바깥이 준다»고 본다** — 킷 `:root` 를 이 지면이 함께 실어야 한다.
 *      안 실으면 흰 바탕에 부품만 뜨는, «거의 맞는 얼굴로 틀린» 판이 된다(09-03 실측).
 *   ② `.룸` 컨테이너가 없으면 맨요소(목록·표) 부품이 **어디에도 안 닿는다**(loom얹기 머리말).
 *
 * ■ 형제와 갈리지 않게 — `tools/소개서지면.js` 는 소개서 «셋»을 탭 하나로 묶어 읽는 지면이다.
 *   이쪽은 SHIFT «한 벌»을 부품 입혀 내놓는 지면이라 과녁이 다르다. 둘 다 같은 정본 txt 를 읽는다.
 *
 * 쓰는 법: node tools/SHIFT소개서지면.js [나갈 파일]
 *          (기본 = docs/SHIFT/SYNK_SHIFT_소개서.html)
 */
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.resolve(__dirname, '..');
const { 바꾸기 } = require('./lib/마크다운을html로.js');
const loom = require('./lib/loom.js');
const 토큰 = require(path.join(뿌리, 'docs', '디자인_토큰.json'));

const 정본 = path.join(뿌리, 'docs', '정본', 'SYNK SHIFT', 'SYNK SHIFT 소개서.txt');

/** 킷 색·서체 — 퇴역 대기는 뺀다(새 산출물에 쓰지 않는 것을 실으면 쓰게 된다). */
function 킷블록() {
  const 색 = 토큰.색.킷
    .filter((c) => !/퇴역|retire/i.test(String(c.팔레트) + String(c.직책)))
    .map((c) => '  --' + c.이름.trim().toLowerCase().replace(/\s+/g, '-') + ': ' + c.hex + ';');
  return [':root{', ...색,
    '  --글꼴: ' + 토큰.서체.본문스택 + ';',
    '  --모노: ' + 토큰.서체.모노스택 + ';',
    '}', 토큰.서체.낫표교정].join('\n');
}

function 굽기(낼곳) {
  const md = fs.readFileSync(정본, 'utf8');
  const { 본문 } = 바꾸기(md);

  /* 머리 = 첫 제목 한 줄. 본문에서 떼어 내 표지로 세운다(같은 글이 두 번 안 나오게). */
  const 제목 = (md.match(/^#\s+(.+)$/m) || [, 'SYNK SHIFT 소개서'])[1].trim();
  const 몸 = 본문.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '');

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${제목}</title>
<!-- 🔴 생성물이다. 손으로 고치지 마라 — 글의 정본은 docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt 하나이고,
     이 지면은 node tools/SHIFT소개서지면.js 가 굽는다. 여기 고친 것은 다음 굽기가 되돌린다. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap">
<style>
${킷블록()}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--글꼴);
     font-size:17px;line-height:1.72;-webkit-font-smoothing:antialiased}
.판{max-width:760px;margin:0 auto;padding:56px 22px 110px}
.표지{padding-bottom:34px;margin-bottom:14px;border-bottom:2px solid var(--ink)}
.눈썹{font-family:var(--모노);font-size:12px;letter-spacing:.18em;color:var(--coral-3);margin:0 0 12px}
h1{font-size:42px;line-height:1.14;font-weight:700;letter-spacing:-.025em;margin:0;text-wrap:balance}
.룸 h2{margin-top:56px}
.룸 h3{margin-top:34px}
.룸 p{margin:0 0 18px}
.룸 blockquote{margin:26px 0;padding:20px 24px;background:var(--coral-wash);
     border-radius:12px;border:1px solid var(--coral-soft);font-size:19px;line-height:1.6}
.룸 blockquote p:last-child{margin-bottom:0}
.룸 table{width:100%;border-collapse:collapse;margin:24px 0;font-size:15.5px}
.룸 th,.룸 td{padding:11px 14px;text-align:left;vertical-align:top}
.룸 th{font-size:12px;font-family:var(--모노);letter-spacing:.08em;color:var(--deep-wool)}
.룸 li{margin:0 0 8px}
.룸 hr{border:0;height:1px;background:var(--stitch);margin:44px 0}
.룸 strong{font-weight:700}
.꼬리{margin-top:64px;padding-top:20px;border-top:1px solid var(--oat);
      font-size:13.5px;color:var(--ash-wool);line-height:1.65}
@media (max-width:640px){ body{font-size:16px} h1{font-size:32px} .판{padding:38px 18px 80px} }
${loom.css({ 지면: '밝은부품' })}
</style></head>
<body>
<div class="판">
  <header class="표지">
    <p class="눈썹">SYNK SHIFT · 한국 법인</p>
    <h1>${제목.replace(/\s*소개서$/, '')}</h1>
  </header>
  <div class="룸">
${몸}
  </div>
  <p class="꼬리">이 지면은 정본 글에서 구워집니다 — 글을 고치실 자리는
    <code>docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt</code> 하나입니다.
    다시 구우려면 <code>node tools/SHIFT소개서지면.js</code>.</p>
</div>
</body></html>`;

  fs.mkdirSync(path.dirname(낼곳), { recursive: true });
  fs.writeFileSync(낼곳, html, 'utf8');
  return { 낼곳, 크기: Buffer.byteLength(html), 부품: (html.match(/\/\*loom부품:/g) || []).length };
}

if (require.main === module) {
  const 낼곳 = process.argv[2] || path.join(뿌리, 'docs', 'SHIFT', 'SYNK_SHIFT_소개서.html');
  const r = 굽기(낼곳);
  console.log(`✅ ${path.relative(뿌리, r.낼곳)}  (${(r.크기 / 1024).toFixed(0)}KB · 부품 ${r.부품}종)`);
  console.log('   글의 정본 = docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt — 이 지면은 손으로 안 고친다.');
}
module.exports = { 굽기, 정본 };
