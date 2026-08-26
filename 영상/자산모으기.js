#!/usr/bin/env node
/**
 * Remotion 이 삼킬 자산을 «정본에서 파생해» `영상/public/` 에 모은다.
 *
 * 🔑 왜 스크립트인가 — 경로를 손으로 적으면 정본이 둘이 된다.
 *   마스코트 그림의 경로는 `tools/lib/마스코트자산.js` 가 알고(그것도 스스로 안 알고
 *   `docs/디자인_토큰.json` 에서 파생한다), 폰트·소리는 `docs/브랜드_폰트/`·`docs/브랜드_사운드킷/`
 *   이 쥔다. 이 파일은 «옮기기»만 하고 아무 것도 새로 정하지 않는다.
 *
 * 🔑 왜 `영상/public/` 이 git 밖인가 — 여기 있는 것은 전부 사본이다. 사본은 낡는다.
 *   정본을 고치고 이걸 다시 안 돌리면 영상만 옛 그림을 문다. 그래서 추적하지 않고,
 *   대신 굽기 전에 «항상» 다시 돌린다(`node 영상/자산모으기.js`).
 *   같은 판단이 `docs/인쇄본/`·`docs/Loom_자산/구움/` 에 이미 서 있다.
 *
 * 쓰기: node 영상/자산모으기.js
 */
const fs = require('fs');
const path = require('path');

const 저장소 = path.resolve(__dirname, '..');
const 공개 = path.join(__dirname, 'public');

const 마스코트 = require(path.join(저장소, 'tools', 'lib', '마스코트자산.js'));

let 옮김 = 0;
let 건너뜀 = 0;
const 빠진것 = [];

function 복사(원본절대, 목적상대) {
  const 목적 = path.join(공개, 목적상대);
  if (!fs.existsSync(원본절대)) {
    빠진것.push(원본절대.replace(저장소 + path.sep, ''));
    return;
  }
  fs.mkdirSync(path.dirname(목적), { recursive: true });
  const 새것 = fs.statSync(원본절대);
  if (fs.existsSync(목적) && fs.statSync(목적).mtimeMs >= 새것.mtimeMs) {
    건너뜀 += 1;
    return;
  }
  fs.copyFileSync(원본절대, 목적);
  옮김 += 1;
}

/* ── ① 몽글 누끼 ────────────────────────────────────────────────────────────
   ⚠ «있는 것만» 옮긴다. 감정 어휘는 11인데 그림은 3뿐이고, 모듈은 없는 표정을
   부르면 조용히 폴백하지 않고 **던진다**(의도된 설계). 그래서 먼저 물어본다. */
const 쓸수있는표정 = ['본체', '눈감음', '눈웃음'];
for (const 표정 of 쓸수있는표정) {
  복사(path.join(저장소, 마스코트.경로(표정, { 누끼: true })), `몽글/${표정}.png`);
}

/* ── ①-b 까몽 누끼 — 가이드 상대역 ────────────────────────────────────────
   까몽도 컷이 셋뿐이라 몽글과 같은 목록을 쓴다(토큰 `캐릭터.까몽` 이 「표정 어휘는 몽글과
   같은 지도를 쓴다」로 못 박아 둔 덕). 경로는 손으로 안 적는다 — 마스코트자산.js 창구를 지난다. */
for (const 컷 of 마스코트.까몽컷) {
  복사(path.join(저장소, 마스코트.까몽경로(컷, { 누끼: true })), `까몽/${컷}.png`);
}

/* ── ② 브랜드 폰트 ──────────────────────────────────────────────────────────
   🔴 SUIT 는 한글만(키릴 0/7) · Inter Tight 는 키릴만(한글 0/4)이다.
   한·몽 병기 자막은 한 줄 안에 둘이 섞이므로 **둘 다** 있어야 한다. */
const 폰트벌 = [
  ['SUIT', ['SUIT-Regular.otf', 'SUIT-Medium.otf', 'SUIT-SemiBold.otf', 'SUIT-ExtraBold.otf', 'SUIT-Heavy.otf']],
  ['InterTight', ['InterTight-Regular.ttf', 'InterTight-Medium.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Bold.ttf']],
];
for (const [갈래, 파일들] of 폰트벌) {
  for (const f of 파일들) 복사(path.join(저장소, 'docs', '브랜드_폰트', 갈래, f), `폰트/${f}`);
}

/* ── ②-b 로고 ───────────────────────────────────────────────────────────────
   🔑 로고는 PNG 가 아니라 «실행되는 SVG» 다 — `tools/lib/로고정본.js` 가 런타임에 만든다.
   그 파일 머리말이 이유를 적어 뒀다: 「왜 렌더판 PNG 를 버렸나: 구움/ 은 git 밖이라
   남의 기계에서 로고가 «사라졌다»」. 여기서도 PNG 를 만들지 않고 SVG 를 그대로 떨군다 —
   해상도 무제한이라 1080 폭에서도 안 깨진다. */
/* ⚠ `표준형()` 은 module.exports 에 «없다»(exports = SYN·K·CHEV·기호선·색·defs·워드마크·
   워드마크안쪽·기호·도장·알록대안). 표준형 21종을 통째로 내는 통로는 **CLI `--json` 하나**다 —
   그 파일 32줄이 그렇게 적어 뒀다. 그래서 require 가 아니라 CLI 를 부른다. */
let 로고표준형 = null;
try {
  const 냄 = require('child_process').execFileSync(
    process.execPath,
    [path.join(저장소, 'tools', 'lib', '로고정본.js'), '--json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  로고표준형 = JSON.parse(냄);
} catch (e) {
  빠진것.push(`로고정본 --json 실행 실패: ${String(e).slice(0, 120)}`);
}
if (로고표준형) {
  /* 라이트 지면(Paper 바탕)에 얹을 것만 — 다크판은 이 영상에 쓸 자리가 없다 */
  for (const 이름 of ['펠트라이트', '민라이트', '단색라이트', '꺾쇠라이트', '알록synk', '알록꺾쇠']) {
    const svg = 로고표준형[이름];
    if (!svg) {
      빠진것.push(`로고정본 표준형 「${이름}」`);
      continue;
    }
    /* 🔴 `xmlns` 를 여기서 «넣어준다» — 정본이 내는 SVG 에는 그게 없다.
       인라인(HTML 안에 그대로 박는 길)에서는 없어도 브라우저가 읽지만, **standalone .svg 파일**로
       두면 xmlns 없이는 못 읽는다. 실측: Remotion 이 「Error loading image with src: …민라이트.svg」로
       렌더를 통째로 취소했다. 정본을 고치지 않고 이 통로에서만 채운다 —
       인라인으로 쓰는 다른 소비자(발표물·인쇄물)는 지금 그대로 잘 돌고 있다. */
    const 파일용 = svg.replace(
      /^<svg /,
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ',
    );
    const 목적 = path.join(공개, '로고', `${이름}.svg`);
    fs.mkdirSync(path.dirname(목적), { recursive: true });
    const 옛 = fs.existsSync(목적) ? fs.readFileSync(목적, 'utf8') : null;
    if (옛 === 파일용) 건너뜀 += 1;
    else {
      fs.writeFileSync(목적, 파일용, 'utf8');
      옮김 += 1;
    }
  }
} else {
  빠진것.push('로고정본 --json 이 아무 것도 안 냈다');
}

/* ── ③ 소리 ────────────────────────────────────────────────────────────────
   사운드킷 정본 규칙 넷(토큰 `사운드.규칙`)이 이 파일들에 이미 구워져 있다:
   400ms 이하 · **실패음 없음** · 사인·트라이앵글만 · C 펜타토닉 안.
   영상이 새 소리를 만들지 않는다 — 있는 것을 고를 뿐이다. */
const 소리방 = path.join(저장소, 'docs', '브랜드_사운드킷');
if (fs.existsSync(소리방)) {
  for (const f of fs.readdirSync(소리방)) {
    if (f.toLowerCase().endsWith('.wav')) 복사(path.join(소리방, f), `소리/${f}`);
  }
}
복사(path.join(저장소, 'docs', '홍보물', 'BGM_개정판_깔림만.wav'), '소리/BGM_깔림.wav');

/* ── ③-c 배경음악 — «구워서» 가져온다(옹알이와 같은 규율) ──────────────────
   🔴 옛 `BGM_깔림.wav` 는 저장소가 **다시 못 만드는** 물건이고(커밋 2c06e7a8), 실측하니
   곡이 아니라 패드였다(변동계수 0.308 · 온셋 1.13개/초). 유호님이 「영상에 배경음악이 없다」고
   하신 것이 그 뜻이다 — 레벨은 정상인데 «음악»으로 안 들린다.
   그래서 릴이 쓸 곡은 저장소가 **짓는다**: `영상/BGM만들기.js` · 씨앗 고정 · 의존성 0 ·
   C 펜타토닉·사인/트라이앵글(토큰 사운드.규칙 ③④). 커밋할 산출물은 안 만든다. */
{
  const 임시 = path.join(__dirname, '.BGM굽기');
  const r = require('child_process').spawnSync(
    process.execPath,
    [path.join(__dirname, 'BGM만들기.js'), '--out', 임시],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    빠진것.push('BGM 합성 실패 — ' + String(r.stderr || '').slice(0, 200));
  } else {
    for (const 결 of ['경쾌', '산뜻']) {
      const 원 = path.join(임시, `BGM_${결}.wav`);
      if (fs.existsSync(원)) 복사(원, `소리/BGM_${결}.wav`);
      else 빠진것.push(`BGM_${결}.wav`);
    }
    fs.rmSync(임시, { recursive: true, force: true });
  }
}

/* ── ③-b 옹알이 — «구워서» 가져온다(사본이 아니라 재생성) ──────────────────
   🔑 옹알이 7종은 이 저장소에 wav 로 «한 번도» 커밋된 적이 없다. `tools/감각층소리합성.js` 가
   `--out` 인자로만 쓰였고 고정 산출 자리가 없었기 때문이다. 그런데 그 도구는 **씨앗이 고정**
   (SEED_BASE 20260815)이라 같은 명령이면 바이트 동일본이 나온다 — 즉 «잃은 것»이 아니라
   «안 구운» 것이다. 그래서 커밋할 산출물을 새로 만들지 않고 굽기 때마다 여기서 다시 낸다
   (`public/` 은 통째로 git 밖 · 이 저장소 규율 「없는 것은 낡을 수 없다」와 같은 자리).
   🔴 옹알이는 **말이 아니다** — 낱말·음소 0 · TTS 0 · 음높이 곡선만(유호 귀검수 4회 통과판 v5).
      그래서 「무언의 선생님」과 안 부딪힌다. 유호 지시 08-26 「옹알이하는 느낌으로 말하는 느낌만」. */
const 옹알이이름 = ['만족', '만족2', '궁금', '반김', '간지럼', '잠깸', '잠꼬대'];
for (const 가이드 of ['몽글', '까몽']) {
  const 임시 = path.join(__dirname, `.옹알이굽기_${가이드}`);
  const r = require('child_process').spawnSync(
    process.execPath,
    [path.join(저장소, 'tools', '감각층소리합성.js'), '--out', 임시, '--가이드', 가이드],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    빠진것.push(`옹알이(${가이드}) 합성 실패 — ` + String(r.stderr || '').slice(0, 200));
    continue;
  }
  for (let i = 0; i < 옹알이이름.length; i++) {
    const 원 = path.join(임시, 'M', `murmur_${i + 1}.wav`);
    if (fs.existsSync(원)) 복사(원, `옹알이_${가이드}/${옹알이이름[i]}.wav`);
    else 빠진것.push(`옹알이(${가이드}) ${옹알이이름[i]}`);
  }
  fs.rmSync(임시, { recursive: true, force: true });
}

/* ── 보고 — 「합계 = 갈래 + 갈래」로 센다 ───────────────────────────────── */
console.log(`자산 모으기 — 합계 ${옮김 + 건너뜀 + 빠진것.length} = 옮김 ${옮김} + 최신이라 건너뜀 ${건너뜀} + 빠짐 ${빠진것.length}`);
if (빠진것.length) {
  console.error('🔴 정본에 없는 파일 — 영상이 그 자리에서 죽는다(조용한 폴백 없음):');
  for (const p of 빠진것) console.error('   · ' + p);
  process.exit(1);
}
