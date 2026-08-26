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

/* ── 산출물이 «소스보다 낡았나» ────────────────────────────────────────────
   눈으로 보고 판정했는데 그게 옛 판이면 판정 전체가 헛것이다. 저장소 상습 함정의 영상판. */
function 최신mtime(뿌리) {
  let 값 = 0;
  for (const e of fs.readdirSync(뿌리, { withFileTypes: true })) {
    const p = path.join(뿌리, e.name);
    값 = Math.max(값, e.isDirectory() ? 최신mtime(p) : fs.statSync(p).mtimeMs);
  }
  return 값;
}
const 영상시각 = fs.statSync(영상).mtimeMs;
const 소스시각 = 최신mtime(path.join(방, 'src'));
if (소스시각 > 영상시각 + 1000) {
  console.error(
    `🔴 소스가 영상보다 새롭다 — 이 그림으로 판정하면 옛 판을 판정하는 것이다.\n` +
      `   영상 ${new Date(영상시각).toLocaleString('ko-KR')} · 소스 ${new Date(소스시각).toLocaleString('ko-KR')}\n` +
      `   먼저: node 영상/굽기.js ${path.parse(이름).name}`,
  );
  process.exit(1);
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
const 훅프레임 = FPS * 3;
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
