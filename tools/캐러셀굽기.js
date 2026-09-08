#!/usr/bin/env node
/**
 * 캐러셀 굽기 — 인스타 캐러셀 카드 한 장을 «펠트 정본»으로 굽는다. (유호 지시 2026-09-08)
 *
 * ■ 왜 새 도구인가
 *   `tools/FB카드굽기.js` 는 페이스북 첫 게시물 «한 장»에 붙박이로 짜여 있다(문안·자리·크기 고정).
 *   캐러셀은 같은 틀 위에 장이 여러 개 서고, 원고가 카드마다 다르다. 그래서 «틀»과 «원고»를 가른다.
 *   굽는 통로(크롬 헤드리스)와 자산 심기는 FB카드굽기 와 같은 처방을 쓴다.
 *
 * ■ 재질은 «구운 자산»에서만 온다
 *   바탕·장식·진행 점은 전부 공방에서 구운 펠트다. CSS 로 그림자·질감을 만들면 그 순간 브랜드가
 *   갈린다(memory `loom-baked-assets-only-for-ui`).
 *   ⇒ 쓰는 자산은 `영상/public/공방/목록.json` 묶음 「캐러셀 부품」·「천·바탕」·「장식 조각」.
 *
 * ■ 몽골어가 주인공이다
 *   이 카드를 보는 사람은 몽골 학생이다. 몽골어를 크게, 한국어를 작게 둔다.
 *   키릴은 Inter Tight, 한글은 SUIT 가 그린다(`docs/브랜드_폰트_정본.md`).
 *
 * ■ 크기 = 1080×1350 (4:5)
 *   인스타에서 세로로 가장 크게 서는 비율이다. 정사각(1:1)보다 화면을 25% 더 먹는다.
 *
 * 쓰는 법:
 *   node tools/캐러셀굽기.js --카드 비자표지            → docs/홍보물/캐러셀_비자_01.png
 *   node tools/캐러셀굽기.js --카드 비자표지 --지면만   → 지면(HTML)만 짓고 굽지 않는다
 *   node tools/캐러셀굽기.js --카드 비자표지 --out <경로>
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 브랜드폰트 = require('./lib/브랜드폰트.js');
const 마스코트 = require('./lib/마스코트자산.js');   // 경로 정본은 이 파일 하나다
const 토큰 = require(path.join(루트, 'docs', '디자인_토큰.json'));

const 인자 = (() => {
  const a = process.argv.slice(2); const o = {};
  for (let i = 0; i < a.length; i += 1) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    o[k] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[i += 1] : true;
  }
  return o;
})();

const W = 1080, H = 1350;

/* 색은 토큰이 정본이다 — 여기 값을 적지 않는다(적으면 킷과 갈린다). */
const 킷 = (토큰.색 && 토큰.색.킷) || 토큰.킷;
function 색(이름) {
  const c = 킷.find((x) => x.이름 === 이름);
  if (!c) throw new Error(`디자인_토큰.json 에 «${이름}» 이 없다 — 색 이름이 바뀌었다`);
  return c.hex;
}

/* ── 자산 심기 (FB카드굽기 와 같은 처방) ────────────────────────────────── */
function ffmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (r.status === 0) return 'ffmpeg';
  throw new Error('ffmpeg 를 못 찾았다 — 자산을 줄일 수 없다(4K 원본을 그대로 심으면 카드가 20MB 가 된다)');
}

/** 그림 한 장을 폭 N 으로 줄여 webp data URI 로. 투명은 지킨다. */
function 심기(상대경로, 폭) {
  const src = path.isAbsolute(상대경로) ? 상대경로 : path.join(루트, 상대경로);
  if (!fs.existsSync(src)) throw new Error(`자산이 없다: ${상대경로}`);
  const 임시 = path.join(os.tmpdir(), `synk-car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`);
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

/** 공방 자산의 저장소 경로. 목록.json 의 `파일` 값은 `공방/…` 로 시작한다. */
const 공방 = (파일) => path.join('영상', 'public', 파일);

/* 🔴 **부품은 «누끼 판»을 쓴다**(09-08 실측).
 *   공방 원본(`영상/public/공방/공방_*.avif`)은 `yuv420p` 라 **알파가 없다** — 검은 바탕이 그대로
 *   구워져 있어 크림 천 위에 얹으면 검은 네모가 뜬다. 첫 판에서 셋이 다 그렇게 나왔다.
 *   ⇒ `tools/AI누끼.py`(rembg · 색이 아니라 «형태»를 본다)로 걷어 `docs/Loom_자산/누끼/` 에 두었다.
 *   🔑 색으로 가르는 자(`흰배경걷기.py`)를 쓰면 크림 보풀을 배경으로 읽어 파먹는다
 *     (memory `felt-parts-bake-as-one-sheet`). */
const 누끼 = (이름) => path.join('docs', 'Loom_자산', '누끼', `${이름}.webp`);

/* ── 카드 원고 ──────────────────────────────────────────────────────────
 * 🔑 원고는 여기 살고 «틀»은 아래 지면짓기() 가 진다. 카드가 늘면 이 표에만 줄을 더한다.
 *   근거 문서 = `.claude/skills/synk-content/references/캐러셀/비자막히는자리_v1.md`
 *   몽골어는 그 문서 §1-2(다섯 겹 검문 통과판)에서 그대로 가져온다 — 여기서 새로 짓지 않는다. */
const 카드들 = {
  비자표지: {
    쪽: 1, 총쪽: 8,
    큰수: '20',
    수뒤: 'сургууль',
    몽골: '2026 оны 2-р улирлаас эхлэн нэг жилийн турш эдгээр сургуульд элсэгчид оюутны виз авахад хүндрэлтэй болно.',
    한국: '2026년 2학기부터 1년 동안, 이 대학들은 유학생 비자를 받기 어렵습니다.',
    꼬리: 'Хууль зүйн яам · Боловсролын яам 2026.02.12',
  },
};

/* ── 지면 ──────────────────────────────────────────────────────────────── */
function 지면짓기(카드) {
  const 바탕 = 심기(공방('공방/펠트_종이바탕.webp'), W);
  const 띠 = 심기(누끼('공방_구분띠스티치'), 900);
  const 점켬 = 심기(누끼('공방_진행점켜짐'), 96);
  const 점끔 = 심기(누끼('공방_진행점꺼짐'), 96);
  /* 마스코트 정본은 이미 알파를 가졌다(4096² rgba) — 누끼를 다시 뜰 자리가 아니다. */
  const 몽글 = 심기(마스코트.절대경로('본체', { 누끼: true }), 560);

  const 점들 = Array.from({ length: 카드.총쪽 }, (_, i) => (
    `<img class="점" src="${i + 1 === 카드.쪽 ? 점켬.uri : 점끔.uri}" alt="">`
  )).join('');

  const 원고 = `<!doctype html><html lang="mn"><head><meta charset="utf-8">
<style>
  /* 🚫 CSS 로 펠트를 흉내내지 않는다 — 재질은 위 자산이 진다. 여기는 «자리»만 정한다. */
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{position:relative;background:${색('Paper')}}
  .바탕{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  /* 🔑 내용을 세로 가운데로 — 첫 판은 위로 붙어 아래가 통째로 비었다(09-08 눈으로 잡음) */
  .판{position:absolute;inset:0;display:flex;flex-direction:column;
      padding:120px 88px 150px;justify-content:center}

  /* 큰 수 — 이 카드의 «신호»이고, 신호는 코랄 하나다(킷 3규칙) */
  .수줄{display:flex;align-items:baseline;gap:34px}
  .수{font:800 300px/0.86 'Inter Tight',sans-serif;color:${색('Coral 3')};
      letter-spacing:-.04em;font-feature-settings:'tnum' 1}
  .수뒤{font:700 76px/1 'Inter Tight',sans-serif;color:${색('Ink')};letter-spacing:-.01em}

  .띠{width:904px;margin:40px 0 44px;opacity:.92}

  /* 몽골어가 주인공 — 키릴은 Inter Tight 가 그린다 */
  .몽골{font:500 46px/1.42 'Inter Tight',sans-serif;color:${색('Ink')};
        letter-spacing:-.005em;max-width:904px}
  /* 한국어는 조연 — 한글은 SUIT 가 그린다. 폭을 몽골어와 맞춰야 줄이 안 잘린다 */
  .한국{margin-top:34px;font:500 29px/1.5 'SYNK KR','SUIT Variable',sans-serif;
        color:${색('Ash Wool')};max-width:660px}

  /* 브랜드 얼굴 — 아래 오른쪽에 앉힌다. 글자와 안 겹치게 바닥 줄 위로 띄운다 */
  .몽글{position:absolute;right:72px;bottom:118px;width:268px;display:block}
  .바닥{position:absolute;left:88px;right:88px;bottom:76px;
        display:flex;align-items:center;justify-content:space-between}
  .꼬리{font:500 24px/1.4 'Inter Tight',sans-serif;color:${색('Ash Wool')}}
  .점들{display:flex;gap:14px;align-items:center}
  .점{width:16px;height:16px;display:block}
</style></head><body>

<img class="바탕" src="${바탕.uri}" alt="">

<div class="판">
  <div class="수줄">
    <span class="수">${카드.큰수}</span>
    <span class="수뒤">${카드.수뒤}</span>
  </div>
  <img class="띠" src="${띠.uri}" alt="">
  <p class="몽골">${카드.몽골}</p>
  <p class="한국">${카드.한국}</p>
</div>

<img class="몽글" src="${몽글.uri}" alt="">

<div class="바닥">
  <span class="꼬리">${카드.꼬리}</span>
  <span class="점들">${점들}</span>
</div>

</body></html>`;

  const 잰것 = { 바탕: 바탕.KB, 띠: 띠.KB, 점: 점켬.KB + 점끔.KB, 몽글: 몽글.KB };
  return { 원고, 잰것 };
}

/* ── 크롬 ──────────────────────────────────────────────────────────────── */
function 크롬() {
  return [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    .filter((p) => p && fs.existsSync(p))[0] || null;
}

function 굽기(지면, out) {
  const exe = 크롬();
  if (!exe) {
    console.error('SKIP: 크롬을 못 찾았다 — **안 구웠다**(성공 아님). CHROME_PATH 로 지정할 수 있다.');
    return 2;
  }
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-캐러셀-'));
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
  const 이름 = 인자['카드'];
  if (!이름 || !카드들[이름]) {
    console.error(`🔴 --카드 <이름> 이 필요하다. 있는 것: ${Object.keys(카드들).join(' · ')}`);
    process.exit(1);
  }
  const 카드 = 카드들[이름];
  const { 원고, 잰것 } = 지면짓기(카드);

  /* 🔴 서체를 지면 «안»에 심는다 — 이 카드는 «진짜 글자»를 쓴다(FB 첫게시물 카드는 글자가 전부
     그림이라 안 심었다). 이름만 부르면 헤드리스 크롬에 그 서체가 없어 시스템 고딕으로 조용히
     떨어지고, 그러면 브랜드가 픽셀에서 갈린다. */
  const 심은 = 브랜드폰트.심기(원고);
  const 낼원고 = 심은.html;

  const 지면경로 = path.join(루트, 'docs', '홍보물', `_src_캐러셀_${이름}.html`);
  fs.mkdirSync(path.dirname(지면경로), { recursive: true });
  fs.writeFileSync(지면경로, 낼원고, 'utf8');
  console.log(`■ 지면  ${path.relative(루트, 지면경로)}  (${Math.round(낼원고.length / 1024)}KB)`);
  console.log(`   심은 자산 — 바탕 ${잰것.바탕}KB · 띠 ${잰것.띠}KB · 진행 점 ${잰것.점}KB · 몽글 ${잰것.몽글}KB`);
  console.log(`   서체 심김 = ${브랜드폰트.심겼나(낼원고) ? '✅' : '🔴 안 심겼다'}`);

  if (인자['지면만']) return;

  const 나갈곳 = path.resolve(인자['out'] || path.join(루트, 'docs', '홍보물', `캐러셀_${이름}.png`));
  fs.mkdirSync(path.dirname(나갈곳), { recursive: true });
  const 코드 = 굽기(지면경로, 나갈곳);
  if (코드 === 0) {
    const KB = Math.round(fs.statSync(나갈곳).size / 1024);
    console.log(`■ 카드  ${path.relative(루트, 나갈곳)}  ${W}×${H}  ${KB}KB`);
  }
  process.exit(코드);
}

main();
