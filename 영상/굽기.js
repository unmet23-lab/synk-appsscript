#!/usr/bin/env node
/**
 * 영상 굽기 — **조용한 실패를 종료코드로 바꾸는** 통로.
 *
 * 🔴 왜 `npx remotion render` 를 그냥 부르지 않나 — 그 명령은 이 질문에 답하지 못한다.
 *   실측: 없는 호스트의 웹폰트를 걸었더니 노란 «경고»만 뜨고 **종료코드 0** 으로 그림이 나왔다.
 *   없는 폰트 «이름» 을 쓴 경우엔 경고조차 없었다. 즉 산출물은 「에러」가 아니라
 *   **「서체가 틀린 영상」** 이고, 사람이 눈으로 안 보면 못 잡는다.
 *   이 저장소가 이미 같은 병을 여러 번 앓았다(트랙 §0: 「끊긴 굽기는 성공처럼 보인다」).
 *
 * 🔴 판정은 파일 «시각»으로 한다 — 수나 존재로는 못 잡는다.
 *   옛 산출물이 그 자리에 남아 있으면 `existsSync && size>0` 도 「몇 개인가」도 전부 성공으로 읽는다.
 *   그래서 굽기 시작 시각을 기억해 두고, 산출물이 그보다 «새로운지» 본다.
 *
 * 쓰기:  node 영상/굽기.js <컴포지션id> [출력파일명]
 * 보기:  node 영상/굽기.js --목록
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const 산출방 = path.join(방, 'out');

/* 「무엇으로 구웠나」의 계산은 `씨앗.js` 한 곳에 산다 — 복제했다가 이음쇠 한 글자가 갈려
   가드가 100% 거짓 빨간불이 났다(08-26 실측). 그 까닭은 그 파일 머리말에 있다. */
const { 씨앗해시, 씨앗파일 } = require('./씨앗.js');

/** 로그에 이 중 하나라도 뜨면 «그림이 나와도» 실패로 친다. */
const 실패신호 = [
  'Failed to load resource',
  'Browser failed to load',
  'Failed to fetch',
  'net::ERR_',
  'Could not load font',
  'Font failed',
  'delayRender',
];

function 실행(인자들, { 조용히 = false } = {}) {
  const r = spawnSync('npx', ['remotion', ...인자들], {
    cwd: 방,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const 로그 = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (!조용히) process.stdout.write(로그);
  return { 종료: r.status, 로그 };
}

const 인자 = process.argv.slice(2);

if (인자.includes('--목록')) {
  const { 종료 } = 실행(['compositions', 'src/index.ts']);
  process.exit(종료 === 0 ? 0 : 1);
}

/* ── `--전량` — 대본이 세운 편을 «전부» 굽는다 ────────────────────────────
   45편이면 45번 손으로 치던 자리다. 한 편이 실패해도 멈추지 않고 끝까지 굽고 마지막에 센다 —
   중간에 죽으면 「몇 편이 됐나」를 아무도 모르고, 그 침묵이 성공처럼 읽힌다. */
if (인자.includes('--전량')) {
  const 읽기 = spawnSync(process.execPath, [path.join(방, '대본읽기.js')], { encoding: 'utf8', shell: false });
  process.stdout.write(읽기.stdout || '');
  if (읽기.status !== 0) {
    process.stderr.write(읽기.stderr || '');
    console.error('🔴 대본 검사가 막았다 — 한 편도 굽지 않는다.');
    process.exit(1);
  }
  /* 🔴 통로가 둘이면 한쪽이 조용히 뒤처진다 — 리드크루 클립과 카운트다운을 «같이» 센다.
     여기서 카운트다운을 빼면 「전량 구웠다」가 참인 채로 카운트다운만 옛 판이 된다. */
  const 목록읽기 = (f) => {
    const p = path.join(방, 'src', '클립', '생성', f);
    if (!fs.existsSync(p)) return [];
    const m = fs.readFileSync(p, 'utf8').match(/= (\[[\s\S]*\]);/);
    return m ? JSON.parse(m[1]) : [];
  };
  const 목록 = [
    ...목록읽기('대본클립들.ts').map((c) => ({ ...c, 표지: `cover-${c.편}-${c.화}` })),
    ...목록읽기('카운트다운들.ts').map((c) => ({ ...c, 표지: `${c.id}-cover` })),
  ];
  const 실패 = [];
  for (const [i, c] of 목록.entries()) {
    console.log(`\n── [${i + 1}/${목록.length}] ${c.id} — ${c.제목}`);
    const r = spawnSync(process.execPath, [__filename, c.id], { encoding: 'utf8', shell: false, stdio: 'inherit' });
    if (r.status !== 0) 실패.push(c.id);
  }
  /* 표지도 같이 — 릴에 «직접 지정»하는 썸네일이라 없으면 플랫폼이 첫 프레임(거의 빈 화면)을 쓴다.
     정지화라 편당 몇 초다. 여기서 안 구우면 「영상은 열 편인데 표지는 한 편」이 조용히 선다. */
  for (const c of 목록) {
    const r = spawnSync('npx', ['remotion', 'still', 'src/index.ts', c.표지, `out/${c.표지}.png`], {
      cwd: 방, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status !== 0 || !fs.existsSync(path.join(산출방, `${c.표지}.png`))) 실패.push(c.표지);
  }
  console.log(
    `\n전량 굽기 끝 — 영상 ${목록.length} + 표지 ${목록.length} = ${목록.length * 2}개 중 ` +
      `성공 ${목록.length * 2 - 실패.length} · 실패 ${실패.length}${실패.length ? ' (' + 실패.join(' ') + ')' : ''}`,
  );
  process.exit(실패.length ? 1 : 0);
}

const 컴포지션 = 인자[0];
if (!컴포지션) {
  console.error('쓰기: node 영상/굽기.js <컴포지션id> [출력파일명]');
  console.error('       node 영상/굽기.js --전량      — 대본이 세운 편 전부');
  console.error('  ⚠ 컴포지션 id 는 한글을 못 쓴다(Remotion 규약) — `node 영상/굽기.js --목록` 으로 본다.');
  process.exit(2);
}
const 출력 = 인자[1] || `${컴포지션}.mp4`;
const 출력경로 = path.join(산출방, 출력);

/* ── ⓪ 대본을 «먼저» 다시 읽는다 ─────────────────────────────────────────
   `src/클립/생성/` 은 산출물이라 대본 md 를 고치면 낡는다. 사람이 「다시 읽기」를 기억할 필요가
   없게 굽기가 매번 부른다(저장소 상습 함정: 「정본은 고쳤는데 산출물을 안 구웠다」).
   자막 글 검사(이모지 수·키릴/한글 섞임·소리 배치)도 여기서 같이 돈다 — 실패면 굽지 않는다. */
const 읽기 = spawnSync(process.execPath, [path.join(방, '대본읽기.js')], {
  encoding: 'utf8',
  shell: false,
});
process.stdout.write(읽기.stdout || '');
if (읽기.status !== 0) {
  process.stderr.write(읽기.stderr || '');
  console.error('🔴 대본 검사가 막았다 — 굽기를 시작하지 않는다.');
  process.exit(1);
}

/* ── ① 자산을 «먼저» 다시 모은다 ─────────────────────────────────────────
   public/ 은 사본이라 정본을 고치면 낡는다. 굽기 직전에 항상 새로 맞춘다. */
const 모으기 = spawnSync(process.execPath, [path.join(방, '자산모으기.js')], {
  encoding: 'utf8',
  shell: false,
});
process.stdout.write(모으기.stdout || '');
if (모으기.status !== 0) {
  process.stderr.write(모으기.stderr || '');
  console.error('🔴 자산이 모자라 굽기를 시작하지 않는다.');
  process.exit(1);
}

/* ── ② 시작 시각을 기억한다(파일 «시각» 판정용) ───────────────────────── */
const 시작 = Date.now();

/* ── ③ 굽는다 ────────────────────────────────────────────────────────── */
console.log(`\n굽는다 — ${컴포지션} → out/${출력}`);
const { 종료, 로그 } = 실행(['render', 'src/index.ts', 컴포지션, `out/${출력}`]);

/* ── ④ 세 겹으로 판정한다 ────────────────────────────────────────────── */
const 문제 = [];

if (종료 !== 0) 문제.push(`종료코드 ${종료}`);

for (const 신호 of 실패신호) {
  if (로그.includes(신호)) 문제.push(`로그에 「${신호}」 — 자원이 안 실렸다(그래도 그림은 나온다)`);
}

if (!fs.existsSync(출력경로)) {
  문제.push('산출물이 없다');
} else {
  const st = fs.statSync(출력경로);
  if (st.mtimeMs < 시작 - 1000) {
    문제.push(`산출물이 «이번 굽기 것이 아니다» — ${new Date(st.mtimeMs).toLocaleString('ko-KR')} 판이 그대로 남았다`);
  }
  if (st.size < 10 * 1024) 문제.push(`산출물이 ${st.size}B 로 너무 작다`);
}

if (문제.length) {
  console.error('\n🔴 굽기 실패로 판정한다 — 「그림이 나왔다」는 통과의 근거가 아니다:');
  for (const p of 문제) console.error('   · ' + p);
  process.exit(1);
}

/* ── ⑤ «무엇으로 구웠나»를 옆에 적어 둔다 ────────────────────────────────
   🔴 프레임뽑기의 낡음 가드가 처음에는 **파일 시각**을 봤는데, 그러면 내용이 하나도 안 바뀌어도
   («되돌린 편집»·체크아웃·A/B 로 잠깐 뒤집었다 원복) 전량이 「낡았다」로 빨개진다.
   이 저장소가 이미 배운 자리다 — 로고주입 `--check` 가 CRLF/LF 때문에 «늘 빨간불»이었고,
   「늘 실패하는 가드는 신호로서 죽는다」로 고쳤다(결정.md 08-22).
   그래서 시각이 아니라 **씨앗의 내용 해시**를 남긴다. 시각은 거짓말하지만 해시는 안 한다. */
fs.writeFileSync(씨앗파일(출력경로), 씨앗해시(), 'utf8');

const st = fs.statSync(출력경로);
console.log(
  `\n✅ ${출력} — ${(st.size / 1024 / 1024).toFixed(2)}MB · ${((Date.now() - 시작) / 1000).toFixed(1)}초`,
);
console.log('   ⚠ 여기까지는 «기계가 볼 수 있는 것»만 통과했다. 두부(□□□)와 서체는 눈으로 본다:');
console.log(`      node 영상/프레임뽑기.js ${출력}`);
