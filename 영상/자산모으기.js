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

/* 🔑 `--공방만` — 공방 펠트 요소만 옮긴다(2026-09-05).
 *   왜 필요한가: ① 컷맞추기가 죽으면 그 뒤 절이 «하나도» 안 돈다. 09-05 에 실제로 밟았다
 *   (「몽글 눈자리가 몸의 101.5% 다」). 그건 그 트랙이 고칠 일인데, 그 사이 공방 요소를
 *   영상에 못 넣는 것은 다른 병이다. 그래서 갈라 돌 수 있게 둔다.
 *   ⚠ 영상을 굽기 «전»에는 깃발 없이 전량을 돌린다 — 이 깃발은 «공방만 급할 때»의 문이다. */
const 공방만 = process.argv.includes('--공방만');

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

/* ── ① 가이드 누끼 — «복사»가 아니라 «맞춰서» 놓는다 ───────────────────────
 * 🔴 08-26 유호님 「까몽이 눈 감을때 털이 변하는데 왜그런거야?」 —
 *   컷 셋이 따로 구운 렌더라 털이 서로 다르고, 깜빡임이 컷을 갈아끼우면 털이 통째로 바뀐다.
 *   그래서 여기서 그냥 복사하지 않고 `컷맞추기.js` 를 지난다 — 눈 밖은 전부 본체 것으로 덮는다.
 *   ⚠ 전엔 이 자리가 `복사()` 두 벌이었다. 그대로 두면 «어느 게 public 에 놓이나»의 주인이 둘이 되고,
 *     다음 세션이 복사 쪽을 집는다(이 저장소가 가장 자주 앓는 병이다). 그래서 **지웠다.**
 *   컷 목록·경로는 여전히 마스코트자산.js 창구가 쥔다(컷맞추기가 그것을 부른다). */
if (!공방만) {
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, '컷맞추기.js')], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`컷맞추기 실패 — 가이드 그림이 안 놓였다
${r.stdout || ''}${r.stderr || ''}`);
  }
  process.stdout.write(r.stdout);
  옮김 += 6;
}

/* ── ①-c 4D 깊이 격자 ─────────────────────────────────────────────────────
   그림이 바뀌면 깊이도 바뀐다 — 누끼를 다시 굽거나 가이드를 더하면 여기가 자동으로 따라온다.
   산출은 `public/깊이/` — git 밖이다(그림에서 다시 나오므로 「없는 것은 낡을 수 없다」). */
if (!공방만) {
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, '깊이뽑기.js')], {
    encoding: 'utf8',
  });
  if (r.status !== 0) 빠진것.push('4D 깊이 뽑기 실패 — ' + String(r.stderr || '').slice(0, 200));
}

/* ── ② 브랜드 폰트 ──────────────────────────────────────────────────────────
   🔴 SUIT 는 한글만(키릴 0/7) · Inter Tight 는 키릴만(한글 0/4)이다.
   한·몽 병기 자막은 한 줄 안에 둘이 섞이므로 **둘 다** 있어야 한다. */
/* 🔴 목록을 여기 다시 적지 않는다 — 정본은 `src/킷/폰트벌.json` 하나다
 *   (2026-09-03 · codex P2 `9e833d1ba653` 채택 수리).
 *   그 파일의 머리말은 이미 「킷 다리 폰트.ts(등록) · 자산모으기.js(복사) · 발행검사.js ②(cmap)
 *   셋이 이 한 표를 본다」고 «선언»했는데, 셋 중 복사기만 제 목록을 따로 들고 있었다.
 *   그래서 표에서 파일을 더하거나 이름을 바꾸면 등록·검사는 새 목록을 쓰고 public/폰트 에는
 *   옛 아홉만 깔려, 렌더에서 조용히 폴백이 났다. 값이 두 곳에 살면 반드시 갈린다. */
const 폰트벌선언 = require(path.join(__dirname, 'src', '킷', '폰트벌.json'));
for (const v of 폰트벌선언.벌 || []) {
  const 조각 = String(v.정본 || '').split('/').filter(Boolean);
  if (!조각.length) continue;
  복사(path.join(저장소, 'docs', '브랜드_폰트', ...조각), `폰트/${조각[조각.length - 1]}`);
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

/* ── ③-b2 받아 온 배경음악 — 유호님이 폴더에 넣은 것을 그대로 옮긴다 ────────
   🔑 유호님 판정 08-26: 「배경음은 무료 배경음 사용하는게 더 좋아보이는데?」
   그래서 «지은 곡»(아래 ③-c)과 «받은 곡»이 나란히 선다. 고르는 자리는 `연출.배경음악` 하나다.
   폴더 안내는 `docs/홍보물/BGM/README.md` — 유호님이 파일만 넣으면 여기가 알아서 집는다. */
{
  const 받은방 = path.join(저장소, 'docs', '홍보물', 'BGM');
  if (fs.existsSync(받은방)) {
    for (const f of fs.readdirSync(받은방)) {
      if (/\.(mp3|wav|m4a|ogg)$/i.test(f)) 복사(path.join(받은방, f), `소리/받은BGM/${f}`);
    }
  }
}

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

/* ── ④ 공방 펠트 요소 ──────────────────────────────────────────────────────
 * 유호 확정 09-05 「영상에도 삽입해서 쓸수있게」.
 * 🔑 **여기서 «무엇이 있나»를 새로 정하지 않는다** — 정본은 `docs/공방/계획.json` 과
 *   `docs/Loom_자산/구움/` 이고, 이 절은 옮기고 «목록만 파생»한다(폰트벌.json 과 같은 규율).
 *   자산이 늘어도 이 코드를 안 고친다.
 * ⚠ 원본 PNG 는 안 옮긴다(한 장 5~19MB). 다듬어 담은 판(.avif/.webp)만 간다 —
 *   AVIF 는 Remotion 이 크롬으로 렌더하므로 그대로 읽힌다(09-05 실측).
 * ⚠ 「다시 굽기」 묶음처럼 파일이 다른 폴더에 사는 것은 조용히 건너뛴다(경로가 안 맞으면 넘어간다). */
{
  const 계획경로 = path.join(저장소, 'docs', '공방', '계획.json');
  const 굽는방 = path.join(저장소, 'docs', 'Loom_자산', '구움');
  const 목록 = [];
  if (fs.existsSync(계획경로)) {
    const 계획 = JSON.parse(fs.readFileSync(계획경로, 'utf8'));
    for (const 통로 of Object.values(계획)) {
      if (!통로 || typeof 통로 !== 'object' || !Array.isArray(통로.묶음)) continue;
      for (const 묶 of 통로.묶음) {
        for (const 것 of 묶.것들 || []) {
          const 파일 = String(것.파일 || '');
          if (것.상태 !== '구웠다' || !파일) continue;
          if (!/[.](avif|webp)$/i.test(파일)) continue;          // 아직 안 다듬은 원본은 건너뛴다
          const 원 = path.join(굽는방, path.basename(파일));
          if (!fs.existsSync(원)) continue;
          복사(원, `공방/${path.basename(파일)}`);
          목록.push({ 이름: 것.이름, 묶음: 묶.이름, 파일: `공방/${path.basename(파일)}` });
        }
      }
    }
  }
  fs.mkdirSync(path.join(공개, '공방'), { recursive: true });
  fs.writeFileSync(path.join(공개, '공방', '목록.json'),
    JSON.stringify({ _파생: '자산모으기.js ④ 가 docs/공방/계획.json 에서 뽑는다 — 손으로 고치지 않는다',
      벌: 목록 }, null, 2) + String.fromCharCode(10), 'utf8');
  console.log(`공방 펠트 요소 ${목록.length}종 — public/공방/ · 목록.json`);
}

/* ── 보고 — 「합계 = 갈래 + 갈래」로 센다 ───────────────────────────────── */
console.log(`자산 모으기 — 합계 ${옮김 + 건너뜀 + 빠진것.length} = 옮김 ${옮김} + 최신이라 건너뜀 ${건너뜀} + 빠짐 ${빠진것.length}`);
if (빠진것.length) {
  console.error('🔴 정본에 없는 파일 — 영상이 그 자리에서 죽는다(조용한 폴백 없음):');
  for (const p of 빠진것) console.error('   · ' + p);
  process.exit(1);
}
