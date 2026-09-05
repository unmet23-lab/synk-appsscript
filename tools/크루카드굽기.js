#!/usr/bin/env node
/**
 * 크루카드 굽기 — 지면 «안»에 구워 넣는 자산 전부(몽글 3표정 + 펠트 천) (2026-09-02 · 유호 지시 「중간중간 마스코트를 넣어도 되는거고」).
 *
 * ■ 왜 도구인가
 *   크루카드는 라이브 접수 폼이라 **바깥 파일을 못 부른다** — `doGet` 이 HTML 한 장만 서빙하고,
 *   `<img src="docs/캐릭터/...">` 는 Apps Script 샌드박스에서 404 다. 그래서 그림은 지면 «안»에 있어야 한다.
 *   그런데 정본 누끼 PNG 는 617~696KB 라 그대로 심으면 카드가 2MB 가 된다.
 *   ⇒ **쓸 크기로 줄여 webp 로 굽고 data URI 로 심는다**(실측: 200px 한 장 ≈ 6.8KB · 세 장 17KB).
 *
 * ■ 멱등 — 늘 먼저 뜯고 다시 심는다. 두 번 돌려도 블록이 안 쌓인다.
 *   🔑 심는 자리는 **`<style data-loom>` «앞»**이다. 뒤에 두면 다음 `지면얹기 --적용` 이 loom 블록을
 *      그 뒤에 또 붙여 순서가 흔들리고, 특정도 동점에서 어느 쪽이 이기는지가 실행 순서에 매달린다.
 *
 * ■ 🔑 렌더린트가 눈을 감지 않게
 *   `브랜드렌더린트` 는 마스코트를 **`src` 경로**로 알아본다(그 패턴의 주인 = `lib/마스코트자산.패턴소스`
 *   — 09-05 판올림 뒤로는 `정본_4K/`). data URI 로 바꾸면
 *   그 경로가 사라져서 「마스코트 바닥 0」이 «깨끗함»이 아니라 «해당 없음»이 되는데 **출력은 똑같이 초록**이다.
 *   ⇒ 심는 요소에 `data-synk-mascot` 을 단다(`시안굽기.js` 가 세운 규약과 같은 자리).
 *   ⚠ 이 도구는 CSS 만 심는다 — 마크업(`<i class="몽글" data-몽글="…">`)은 지면이 손으로 쥔다.
 *      까닭: 어느 자리에 어느 표정이 서는지는 «편집 판단»이라 도구가 정할 것이 아니다.
 *
 * ■ 표정 배치 (지면이 쥐는 값 · 여기 적힌 것은 «구울 목록»뿐)
 *   눈웃음 = 표지 환영 리본 · 놀람 = Part 06 K-컬처(설렘) · 눈감음 = Part 08 서약(약속을 지켜본다)
 *
 * 쓰기:
 *   node tools/크루카드굽기.js            # 정본 두 벌에 심는다
 *   node tools/크루카드굽기.js --확인      # 낡았으면 exit 1 (아무것도 안 쓴다)
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { 경로: 마스코트경로 } = require('./lib/마스코트자산.js');

const { 인자게이트 } = require('./lib/인자게이트.js');
const 플래그오류 = 인자게이트('크루카드굽기', process.argv.slice(2), ['--확인']);
if (플래그오류) { console.error(플래그오류); process.exit(2); }

/** 판 — 블록 표식에 실어서, 굽는 규격이 바뀌면 `--확인` 이 낡음을 잡게 한다. */
const 판 = 'v1';

/** 구울 목록 — [표정, 굽는 폭]. 폭은 «지면에서 그려지는 크기 × 2~3»(레티나). */
const 목록 = [
  ['눈웃음', 120],   // 표지 리본 아이콘 ≈ 38px
  ['놀람', 240],     // Part 06 ≈ 96px
  ['눈감음', 200],   // Part 08 서약 ≈ 76px
];

const 대상 = ['crewcard/카드_kr.html', 'crewcard/카드_mn.html'];

/** 이미지 한 장 → webp data URI. 실패는 던진다 — 빈 문자열을 돌려주면 그림 없는 카드가 조용히 나간다. */
function 구워서심기(절대경로, 폭) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-몽글-'));
  const tmp = path.join(방, 'o.webp');
  try {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-i', 절대경로,
      '-vf', `scale=${폭}:-1`, '-c:v', 'libwebp', '-quality', '86', tmp,
    ]);
    return `data:image/webp;base64,${fs.readFileSync(tmp).toString('base64')}`;
  } finally {
    fs.rmSync(방, { recursive: true, force: true });
  }
}

function 블록만들기() {
  const 줄 = 목록.map(([표정, 폭]) => {
    const 절대 = path.join(ROOT, 마스코트경로(표정, { 누끼: true }));
    if (!fs.existsSync(절대)) throw new Error(`마스코트 누끼가 없다: ${절대}`);
    return `    --몽글-${표정}:url("${구워서심기(절대, 폭)}");`;
  }).join('\n');

  /* 펠트 천 — Part 06 의 라임 밑줄에 «결»을 준다.
   * 🔑 주인은 loom 하나다(`기본천()`). 여기는 창구일 뿐 — 값을 베껴 적지 않는다.
   *   `지면얹기` 가 천을 안 싣는 것은 이 지면에 `.오브` 가 없어서고, 그건 맞는 판정이다
   *   (오브를 안 쓰는데 오브용 천을 실을 이유가 없다). 밑줄 하나 때문에 «오브가 있다»고
   *   거짓말하는 대신, 쓰는 자리가 제 손으로 문다. */
  const 천 = require('./lib/loom.js').기본천();
  if (!천) throw new Error('loom 기본천이 비었다 — 펠트 타일의 주인이 사라졌다');

  return `<style data-몽글="${판}">
  /* ── 지면 «안»에 구운 자산 (node tools/크루카드굽기.js · 손 편집 금지)
     몽글 정본 = 정본_4K (경로의 주인 = tools/lib/마스코트자산.js · 09-05 판올림) ·
     펠트 천 = loom 기본천 (주인 = tools/lib/loom.js).
     ⚠ 표정을 늘리거나 크기를 바꿀 땐 그 도구의 \`목록\` 을 고치고 다시 돌린다. */
  :root{
${줄}
    --펠트결:${천};
  }
  .몽글{
    display:inline-block;flex:none;
    background-repeat:no-repeat;background-position:center bottom;background-size:contain;
    /* 접지 — 누끼라 그냥 얹으면 «스티커»가 된다. 바닥 그림자 한 겹으로 세운다. */
    filter:drop-shadow(0 6px 10px rgba(43,35,32,.20)) drop-shadow(0 1px 2px rgba(43,35,32,.10));
  }
${목록.map(([표정]) => `  .몽글[data-몽글="${표정}"]{background-image:var(--몽글-${표정});}`).join('\n')}
  /* 종이 — 배경 그래픽이 기본 꺼짐이라 안 찍힌다. 장식이므로 «일부러» 안 켠다(카드의 라임 원과 같은 처지). */
</style>`;
}

const 뜯기정규식 = /\r?\n?<style data-몽글="[^"]*">[\s\S]*?<\/style>/g;

/** 심을 자리 — `<style data-loom` «앞». 없으면 마지막 `</style>` 뒤. */
function 끼울자리(html) {
  const i = html.search(/<style data-loom=/);
  if (i >= 0) return i;
  const j = html.lastIndexOf('</style>');
  if (j >= 0) return j + '</style>'.length;
  return -1;
}

function 심기(html, 블록) {
  const 벗은판 = html.replace(뜯기정규식, '');
  const 자리 = 끼울자리(벗은판);
  if (자리 < 0) throw new Error('`<style data-loom>` 도 `</style>` 도 없다 — 심을 자리가 없다');
  /* CRLF 지면이다 — 블록도 CRLF 로 넣는다. 섞이면 재현 대조가 한 바이트에 갈린다. */
  const 씨 = ('\n' + 블록).replace(/\r?\n/g, '\r\n');
  return 벗은판.slice(0, 자리) + 씨 + 벗은판.slice(자리);
}

function main() {
  const 확인만 = process.argv.includes('--확인');
  const 블록 = 블록만들기();
  console.log(`■ 크루카드 굽기 — 몽글 ${목록.length}표정 + 펠트 천 · 블록 ${(Buffer.byteLength(블록, 'utf8') / 1024).toFixed(1)}KB`);

  let 낡음 = 0;
  for (const rel of 대상) {
    const p = path.join(ROOT, rel);
    const 원본 = fs.readFileSync(p, 'utf8');
    const 새판 = 심기(원본, 블록);
    if (새판 === 원본) { console.log(`  ✅ ${rel} — 이미 최신`); continue; }
    낡음++;
    if (확인만) { console.log(`  🔴 ${rel} — 낡았다(다시 심어야 한다)`); continue; }
    fs.writeFileSync(p, 새판, 'utf8');
    console.log(`  ✍ ${rel} — 심었다 (${(Buffer.byteLength(새판, 'utf8') / 1024).toFixed(0)}KB)`);
  }

  /* 0 은 분모와 함께 쓴다 — 몇 벌을 봤는지 안 밝히면 미실행이 통과와 같은 모양이다. */
  console.log(`\n${확인만 && 낡음 ? '🔴' : '✅'} 지면 ${대상.length}벌 · ${확인만 ? `낡음 ${낡음}` : `심음 ${낡음} + 그대로 ${대상.length - 낡음}`}`);
  if (!확인만 && 낡음) console.log('   다음: node tools/지면얹기.js --적용 → node tools/크루카드사본.js');
  if (확인만 && 낡음) process.exitCode = 1;
}

main();
