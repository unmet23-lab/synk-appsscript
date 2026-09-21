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
const { 씨앗쪽지, 씨앗파일 } = require('./씨앗.js');

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
const 자리인자 = 인자.filter((a) => !a.startsWith('--'));
const 컴포지션 = 자리인자[0];

// 폐기된 원고는 자산 생성·검사·렌더를 시작하기 전에 거절한다.
if (인자.includes('--전량') || /^(clip|count)-/i.test(컴포지션 || '') ||
    인자.includes('--준비끝') || 인자.includes('--가이드')) {
  console.error('옛 리드크루·카운트다운과 --전량 경로는 폐기되었습니다. 새 콘텐츠의 원문과 entry를 사용하세요(영상/README.md).');
  console.error('자산 생성·콘텐츠 검사·렌더는 실행하지 않았습니다.');
  process.exit(2);
}
if (인자.some((a) => a.startsWith('--') && !['--목록', '--검사건너뜀'].includes(a))) {
  console.error('지원하지 않는 옵션입니다. 영상/README.md의 현재 실행 경로를 확인하세요.');
  process.exit(2);
}

if (인자.includes('--목록')) {
  const { 종료 } = 실행(['compositions', 'src/index.ts']);
  process.exit(종료 === 0 ? 0 : 1);
}

if (!컴포지션) {
  console.error('쓰기: node 영상/굽기.js <컴포지션id> [출력파일명]');
  console.error('  ⚠ 컴포지션 id 는 한글을 못 쓴다(Remotion 규약) — `node 영상/굽기.js --목록` 으로 본다.');
  process.exit(2);
}
/* 🔴 표지는 **한 장짜리 정지화**다 — mp4 로 구우면 0.05MB 짜리 «1프레임 영상»이 나온다.
   전엔 그 통로가 `--전량` 안에만 있어서(`remotion still`), 낱개로 부르면 조용히 mp4 가 났다.
   08-27 실측으로 잡았다: 손으로 표지를 굽자 `clip-01-2-kamong-cover.mp4 — 0.05MB` 가 났다.
   ⇒ 통로를 여기로 끌어와 «어느 쪽으로 불러도 같은 것»이 나게 한다. 판정은 id 가 한다 —
     표지 id 는 두 지면 다 «클립 id + -cover» 로 통일돼 있다(Root.tsx). */
const 표지다 = 컴포지션.endsWith('-cover');
const 출력 = 자리인자[1] || `${컴포지션}.${표지다 ? 'png' : 'mp4'}`;
const 출력경로 = path.join(산출방, 출력);

/* 호환용 생성물만 비운다. 옛 원고를 읽거나 콘텐츠를 검증하지 않는다. */
const 빈목록 = spawnSync(process.execPath, [path.join(방, '대본읽기.js'), '--빈목록'], {
  encoding: 'utf8', shell: false,
});
process.stdout.write(빈목록.stdout || '');
if (빈목록.status !== 0) {
  process.stderr.write(빈목록.stderr || '');
  console.error('호환용 빈 목록을 준비하지 못해 렌더를 시작하지 않습니다.');
  process.exit(1);
}

/* 공용 소리표는 대본과 독립적으로 유지한다. */
try {
  require('./소리어휘.js').소리표쓰기();
} catch (e) {
  console.error(`소리표를 준비하지 못해 렌더를 시작하지 않습니다: ${e.message}`);
  process.exit(1);
}

/* 기존 기본 컴포지션에 필요한 공용 자산과 검사는 유지한다. */
const 모으기 = spawnSync(process.execPath, [path.join(방, '자산모으기.js')], {
  encoding: 'utf8', shell: false,
});
process.stdout.write(모으기.stdout || '');
if (모으기.status !== 0) {
  process.stderr.write(모으기.stderr || '');
  console.error('자산이 모자라 렌더를 시작하지 않습니다.');
  process.exit(1);
}

if (인자.includes('--검사건너뜀')) {
  console.warn('발행검사를 건너뜁니다(--검사건너뜀). 이 영상은 해당 검사를 통과한 결과가 아닙니다.');
} else {
  const 검사 = spawnSync(process.execPath, [path.join(방, '발행검사.js')], {
    encoding: 'utf8', shell: false,
  });
  process.stdout.write(검사.stdout || '');
  if (검사.status !== 0) {
    process.stderr.write(검사.stderr || '');
    console.error('발행검사를 통과하지 못해 렌더를 시작하지 않습니다.');
    process.exit(1);
  }
}

/* ── ② 시작 시각을 기억한다(파일 «시각» 판정용) ───────────────────────── */
const 시작 = Date.now();

/* ── ③ 굽는다 ────────────────────────────────────────────────────────── */
console.log(`\n굽는다 — ${컴포지션} → out/${출력}`);
const { 종료, 로그 } = 실행([표지다 ? 'still' : 'render', 'src/index.ts', 컴포지션, `out/${출력}`]);

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
  /* 표지는 정지화 한 장이라 30KB 대다 — 영상 잣대(10KB)로는 «빈 PNG»도 통과한다. */
  const 최소 = 표지다 ? 20 * 1024 : 10 * 1024;
  if (st.size < 최소) 문제.push(`산출물이 ${st.size}B 로 너무 작다(${표지다 ? '표지' : '영상'} 하한 ${최소}B)`);
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
/* ── ④-b 마스터 — 완성본의 소리 크기를 마지막에 한 번 맞춘다 ───────────────
   🔴 구운 릴이 전부 −18~−20 LUFS 였다 = 피드에서 혼자 조용한 영상이다.
   층(옹알이·BGM)마다 볼륨을 올려 고치면 유호님이 귀로 잡으신 «둘의 균형»이 깨진다.
   그래서 층은 그대로 두고 완성본에 **게인 한 번**을 건다(근거는 `영상/마스터.js` 머리말).
   🔑 여기 두는 까닭: 통로가 하나여야 «어떤 굽기든» 이 단을 지난다. 밖에 두면 단독 굽기 한 번이
      조용히 안 지나가고, 그것이 「어떤 건 크고 어떤 건 작다」가 된다.
   🔑 씨앗«보다 먼저» 돈다 — 마스터가 파일을 다시 쓰므로 순서가 뒤바뀌면 안 된다. */
if (출력.endsWith('.mp4')) {
  const m = spawnSync(process.execPath, [path.join(방, '마스터.js'), 출력], {
    encoding: 'utf8',
    shell: false,
  });
  process.stdout.write(m.stdout || '');
  if (m.status !== 0) {
    process.stderr.write(m.stderr || '');
    console.error('🔴 마스터 단이 실패했다 — 소리 크기를 못 맞춘 채로 「구웠다」고 하지 않는다.');
    process.exit(1);
  }
}

/* 🔴 «어느 편을» 구웠는지 씨앗에 넣는다 (2026-09-03 · codex P1 `fb48934599b9` 채택 수리).
 *   앞판은 `씨앗해시()` 를 인자 없이 불러 **클립 90벌이 전부 같은 값**을 받았다. 그러면
 *   한 편의 대본만 고쳐도 다른 89편의 씨앗까지 같이 움직여, 「이 그림이 지금 소스로 구운 것인가」가
 *   편별로는 아무것도 못 가린다 — 안 바뀐 편이 낡음으로 찍히고, 바뀐 편이 최신으로 지나간다.
 *   `씨앗해시(id)` 는 그 편의 대본 기록까지 섞으므로 편마다 갈린다.
 * 🔑 쪽지도 «판 표기»가 있는 꼴로 쓴다 — `씨앗쪽지` 는 「v2 <해시>」를 낸다. 짝인 `씨앗읽기` 가
 *   판 없는 옛 쪽지를 v1 으로 읽어 주므로, 앞서 구운 영상도 「판이 다르다」로 말할 수 있다.
 *   그 둘은 씨앗.js 에 서 있었는데 아무도 안 불렀다(정의만 있고 통로가 없던 자리). */
fs.writeFileSync(씨앗파일(출력경로), 씨앗쪽지(컴포지션), 'utf8');

const st = fs.statSync(출력경로);
console.log(
  `\n✅ ${출력} — ${(st.size / 1024 / 1024).toFixed(2)}MB · ${((Date.now() - 시작) / 1000).toFixed(1)}초`,
);
console.log('   ⚠ 여기까지는 «기계가 볼 수 있는 것»만 통과했다. 두부(□□□)와 서체는 눈으로 본다:');
console.log(`      node 영상/프레임뽑기.js ${출력}`);
