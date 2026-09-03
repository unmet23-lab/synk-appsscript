#!/usr/bin/env node
/**
 * 구운 영상에서 프레임 몇 장을 뽑아 «눈으로 볼 수 있게» 한 장으로 붙인다.
 *
 * 🔑 이것이 검증의 마지막 겹이다. 앞의 `굽기.js` 가 잡는 것은 «기계가 볼 수 있는 것»뿐이고,
 *   두부(□□□)·틀린 서체·깨진 구도는 로그에 한 줄도 안 남는다. 사람이 봐야 한다.
 *   특히 볼 것: 한글과 몽골 키릴(Ө Ү ө ү)이 네모칸이 아니라 «글자»로 보이는가.
 *
 * 🔴 뽑는 «자리»를 시계로 정하지 않는다 — 장면 데이터에서 정한다.
 *   첫 판은 길이를 n등분해 3·9·15·21·27초를 뽑았는데, 3.0초가 하필 훅과 첫 장면의 **컷 경계**라
 *   두 자막이 겹쳐 뜬 «읽을 수 없는» 그림이었다(08-26 실측 — 증거 5장 중 1장이 거기 쓰였다).
 *   지금은 훅과 장면 여섯의 **한가운데**를 하나씩 뽑는다 — 장면 수만큼 증거가 나오고 경계는 안 밟는다.
 *
 * 쓰기: node 영상/프레임뽑기.js <영상파일명> [장수]
 *   장수를 주면 옛 방식(고르게 n등분)으로 돌아간다 — 장면 데이터가 없는 영상에 쓴다.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const 산출방 = path.join(방, 'out');
/* 「무엇으로 구웠나」의 계산은 `씨앗.js` 한 곳 — 여기서 다시 짜지 않는다(복제가 곧 갈림이다) */
const { 씨앗해시, 씨앗파일, 씨앗읽기, 판 } = require('./씨앗.js');
const 생성경로 = path.join(방, 'src', '클립', '생성', '대본클립들.ts');
const 카운트다운경로 = path.join(방, 'src', '클립', '생성', '카운트다운들.ts');
const 이름 = process.argv[2];
const 장수인자 = process.argv[3] ? Number(process.argv[3]) : null;

if (!이름) {
  console.error('쓰기: node 영상/프레임뽑기.js <영상파일명> [장수]');
  process.exit(2);
}

const 영상 = path.join(산출방, 이름);
if (!fs.existsSync(영상)) {
  console.error(`🔴 없는 파일: ${영상}`);
  process.exit(1);
}

function ffprobe(인자들) {
  const r = spawnSync('ffprobe', 인자들, { encoding: 'utf8' });
  return (r.stdout || '').trim();
}
function ffmpeg(인자들) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...인자들], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr || '');
    process.exit(1);
  }
}

/* ── 산출물이 «지금 소스로 구운 것인가» ────────────────────────────────────
   눈으로 보고 판정했는데 그게 옛 판이면 판정 전체가 헛것이다. 저장소 상습 함정의 영상판.

   🔴 첫 판은 **파일 시각**으로 쟀는데, 그러면 내용이 하나도 안 바뀌어도 빨개진다 — 되돌린 편집,
   체크아웃, A/B 로 잠깐 뒤집었다 원복(08-26 실측: 로고 두 판 대조 뒤 영상 12편 전량이 «낡음»으로
   찍혔는데 `git status` 는 깨끗했다). 이 저장소가 이미 배운 자리다: 로고주입 `--check` 가
   CRLF/LF 때문에 늘 빨간불이었고 「**늘 실패하는 가드는 신호로서 죽는다**」로 고쳤다(결정.md 08-22).
   그래서 이제 **내용 해시**를 본다 — 굽기가 `<영상>.씨앗` 에 적어 둔다. */
/* 🔴 씨앗은 «편마다» 갈린다 — 그 편의 id 를 넘겨야 이 대조가 뜻을 갖는다
 *   (2026-09-03 · codex P1 `fb48934599b9` 채택 수리 · 굽기 쪽 짝).
 *   앞판은 인자 없이 불러 90벌이 같은 값이었다. 그러면 옆 편의 대본만 고쳐도 이 영상이
 *   「낡음」으로 찍혀 굽기를 다시 시킨다 — 늘 빨간 가드는 신호로서 죽는다(결정.md 08-22, 위 참조).
 * 🔑 판도 함께 가른다 — 「셈법 자체가 바뀐 것」과 「소스가 바뀐 것」은 처방이 다르다.
 *   앞엣것은 그냥 다시 구우면 되고, 뒤엣것은 무엇이 바뀌었나부터 본다. */
const 쪽지경로 = 씨앗파일(영상);
const 편id = path.parse(이름).name;
if (fs.existsSync(쪽지경로)) {
  const 구운 = 씨앗읽기(fs.readFileSync(쪽지경로, 'utf8'));
  const 지금씨앗 = 씨앗해시(편id);
  if (구운.판 && 구운.판 !== 판) {
    console.error(
      `🔴 씨앗 셈법이 바뀐 뒤로 안 구웠다(쪽지 ${구운.판} · 지금 ${판}) — 값을 견줄 수 없다.\n` +
        `   먼저: node 영상/굽기.js ${편id}`,
    );
    process.exit(1);
  }
  if (구운.해시 !== 지금씨앗) {
    console.error(
      `🔴 소스가 바뀐 뒤로 안 구웠다 — 이 그림으로 판정하면 옛 판을 판정하는 것이다.\n` +
        `   구울 때 ${String(구운.해시 || '(못 읽음)').slice(0, 12)} · 지금 ${지금씨앗.slice(0, 12)}\n` +
        `   먼저: node 영상/굽기.js ${편id}`,
    );
    process.exit(1);
  }
} else {
  /* 씨앗이 없는 것은 «이 가드가 서기 전에» 구운 영상이다. 조용히 통과시키지 않고 한 줄 남긴다 —
     못 잰 것을 「괜찮다」로 적으면 그게 바로 이 저장소가 반복해 앓는 무늬다. */
  console.warn(`⚠ ${path.basename(영상)}.씨앗 이 없다 — 「지금 소스로 구운 것인지」를 **안 재봤다**(다시 구우면 선다).`);
}

const 길이 = Number(
  ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 영상]),
);
if (!길이) {
  console.error('🔴 길이를 못 읽었다 — 영상이 온전하지 않을 수 있다.');
  process.exit(1);
}

/* ── 뽑을 자리 정하기 ───────────────────────────────────────────────────── */
const FPS = 30;
/**
 * 훅 길이 — **클립 데이터에서 뺀다.** 전체에서 칸 합을 빼면 그것이 훅이다.
 *
 * 🔴 여기 `FPS * 3` 이 박혀 있었다. 장면형이 훅을 2.5초(75f)로 줄이자 이 도구가 옛 값으로 자리를
 *   계산해 **뽑는 시각이 전부 0.5초씩 밀렸다** — 그런데 칸이 1.3~3.4초라 뽑힌 그림은 여전히
 *   «그 칸 안»이어서 **띠만 보고는 못 잡는다.** 리드크루클립.tsx 의 같은 상수와 함께
 *   이종 검수가 잡았다(08-27 · 그쪽은 마지막 0.5초가 잘리는 쪽이 증상이었다).
 * 🔑 뺄셈으로 두면 형식이 하나 더 생겨도 이 파일은 안 고친다 — 상수를 둘로 두는 것이 병이었다.
 */
const 훅길이 = (c) =>
  c.순위들
    ? c.전체프레임 - c.순위들.reduce((a, r) => a + r.프레임, 0) - c.마무리프레임
    : c.전체프레임 - c.장면들.reduce((a, s) => a + s.프레임, 0);
let 자리 = [];
let 이름표 = [];

function 읽기(경로) {
  if (!fs.existsSync(경로)) return [];
  const m = fs.readFileSync(경로, 'utf8').match(/= (\[[\s\S]*\]);/);
  return m ? JSON.parse(m[1]) : [];
}

const 클립 = (() => {
  if (장수인자) return null; /* 장수를 직접 준 것은 「옛 방식으로 가라」는 뜻이다 */
  const id = path.parse(이름).name;
  return 읽기(생성경로).find((c) => c.id === id) || 읽기(카운트다운경로).find((c) => c.id === id) || null;
})();

if (클립 && 클립.순위들) {
  /* 카운트다운 릴 — 훅 + 순위 다섯 + 마무리 = 일곱 칸. 리드크루 클립과 칸 이름만 다르다. */
  const 훅프레임 = 훅길이(클립);
  자리.push(훅프레임 / 2 / FPS);
  이름표.push('훅');
  let ㄱ = 훅프레임;
  for (const r of 클립.순위들) {
    자리.push((ㄱ + r.프레임 / 2) / FPS);
    이름표.push(`${r.순}위`);
    ㄱ += r.프레임;
  }
  자리.push((ㄱ + 클립.마무리프레임 / 2) / FPS);
  이름표.push('마무리');
} else if (클립) {
  const 훅프레임 = 훅길이(클립);
  자리.push(훅프레임 / 2 / FPS);
  이름표.push('훅');
  let ㄱ = 훅프레임;
  for (const s of 클립.장면들) {
    자리.push((ㄱ + s.프레임 / 2) / FPS);
    이름표.push(s.라벨);
    ㄱ += s.프레임;
  }
} else {
  const 장수 = 장수인자 || 5;
  자리 = Array.from({ length: 장수 }, (_, i) => ((i + 0.5) / 장수) * 길이);
  이름표 = 자리.map((s) => s.toFixed(1) + 's');
}

const 조각 = [];
자리.forEach((초, i) => {
  const 나온것 = path.join(산출방, `_프레임_${i}.png`);
  ffmpeg(['-ss', String(초), '-i', 영상, '-frames:v', '1', '-vf', 'scale=360:-1', 나온것]);
  조각.push(나온것);
});

const 붙인것 = path.join(산출방, `${path.parse(이름).name}_프레임.png`);
ffmpeg([
  ...조각.flatMap((p) => ['-i', p]),
  '-filter_complex',
  `${조각.map((_, i) => `[${i}:v]`).join('')}hstack=inputs=${조각.length}`,
  붙인것,
]);
for (const p of 조각) fs.unlinkSync(p);

console.log(`✅ ${path.relative(process.cwd(), 붙인것)}`);
console.log(
  `   길이 ${길이.toFixed(1)}초 · ${자리.length}장 · ${
    클립 ? '장면 한가운데' : '고르게(장면 데이터 없음)'
  } · ${이름표.map((n, i) => `${n} ${자리[i].toFixed(1)}s`).join(' · ')}`,
);
console.log('   👀 볼 것: 한글·키릴이 □□□ 가 아닌가 · 서체가 SUIT/Inter Tight 인가 · 구도가 잘리지 않았나');
