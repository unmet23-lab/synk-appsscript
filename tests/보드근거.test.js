/* 보드근거 회귀 — 「이 죽은 줄, 정말 끝났나」의 근거 후보 수집 (대기열 #Q93 ㉡ · 2026-08-16).
 *
 * 이 장치가 새는 방향은 **「통과」**다: 후보 목록이 그럴듯하게 나오면 사람이 그대로 믿고
 * `--미완확인` 을 쓴다 — 그러면 미완 트랙이 완료의 얼굴로 아카이브에 들어간다(원칙⑦이
 * 막으려던 바로 그 사고 · F240 유입 경로). 그래서 여기서 못박는 것 다섯:
 *
 *   ① **못 쟀다(null) ≠ 찾을 게 없었다([])** — 첫 판이 이 둘을 뭉쳐, 경로 표기가 없는 줄에도
 *      「git 실패·시간초과」를 냈다. 같은 출력이 못본곳에는 「경로 표기가 없다」라고 적어
 *      **두 말이 정면으로 어긋났다**(실사용 첫 호출이 잡았다 · F207 축). 이 파일의 1번 검사가 그 못이다.
 *   ② **주인 판정은 트레일러로만** — 「남의 세션이 이어서 했다」가 이 수집의 유일한 강한 신호인데,
 *      그것을 시각·author 로 추정하면 F041 이 그대로 재발한다. 트레일러가 없으면 `남의것=false`
 *      (모름을 「남이 했다」로 읽지 않는다 — 새는 방향이 통과라 미탐 쪽을 택한다).
 *   ③ **🚫비켜남 경로는 안 찾는다** — 그 줄이 「안 만진다」고 적은 자리의 커밋을 근거로 들면
 *      남의 트랙 작업이 이 트랙의 완료 증거로 둔갑한다. 판정은 `보드lib.만지는텍스트` 하나에서 온다.
 *   ④ **자기 파일은 승계가 아니다** — 자기 줄이 자기 지문을 적는 건 규약(주인 표식)이라 전부 걸린다.
 *   ⑤ **탐지력은 픽스처가 진다** — git 을 주입해 실저장소 상태·시간대·이력에 안 기댄다(F296).
 *      실저장소에는 거짓양성만 건다(가드 맹점 ②): 안 죽는다 · 못본곳은 언제나 비지 않는다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* 주석 제거는 통로가 하나다 — 지역 사본은 저마다 다르게 틀린다(F401·#Q114). */
const { 코드만, 파일소스 } = require('./lib/소스검사.js');

const REPO = path.resolve(__dirname, '..');
const 근거 = require(path.join(REPO, 'tools', 'lib', '보드근거.js'));
const 보드lib = require(path.join(REPO, 'tools', 'lib', '보드.js'));

const 머리 = '# 보드\n\n| 날짜 | 트랙 | 만질 파일 | 상태/다음 |\n|---|---|---|---|\n';
const 줄 = (트랙, 파일, 상태, 날짜 = '2026-08-14') => `| ${날짜} | ${트랙} | ${파일} | ${상태} |`;

/** 픽스처 보드 폴더를 세우고 root 를 돌려준다. */
function 판세우기(파일맵) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardev-'));
  const dir = 보드lib.폴더(root);
  fs.mkdirSync(dir, { recursive: true });
  for (const [이름, 줄들] of Object.entries(파일맵)) {
    fs.writeFileSync(path.join(dir, 이름), 머리 + 줄들.join('\n') + '\n', 'utf8');
  }
  return root;
}

/** git 대역 — 인자를 기록하고 정해진 값을 돌려준다. `null` 은 「못 쟀다」. */
function 가짜git(응답) {
  const 부른것 = [];
  const fn = (args) => { 부른것.push(args); return typeof 응답 === 'function' ? 응답(args) : 응답; };
  fn.부른것 = 부른것;
  return fn;
}

const 커밋줄 = (해시, 날짜, 제목, 지문 = '') => `${해시}\t${날짜}\t${제목}\t${지문}`;

/* ── ① 못 쟀다 ≠ 찾을 게 없었다 (이 파일이 태어난 이유) ─────────────────── */

test('경로 표기가 없으면 «못 쟀다»가 아니라 «찾을 게 없었다»다', () => {
  const root = 판세우기({ 'aaaaaaaa.md': [줄('**트랙**', '이 줄', '작업중')] });
  const r = 근거.근거후보(줄('**트랙**', '이 줄', '작업중'),
    { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null });
  assert.deepStrictEqual(r.경로, [], '경로 후보는 빈 배열이어야 한다(null 이면 「못 쟀다」로 읽힌다)');
  const 글 = 근거.근거글(r);
  assert.ok(!/경로 후속 커밋 — \*\*못 쟀다\*\*/.test(글), '찾을 게 없었는데 「못 쟀다」라고 말했다');
  assert.ok(/경로 표기가 없다/.test(글), '못 본 곳에 이유가 적혀야 한다');
});

test('git 이 죽으면 «못 쟀다»(null)이고 그렇게 말한다', () => {
  const root = 판세우기({ 'aaaaaaaa.md': [줄('**트랙**', '`tools/x.js`', '작업중')] });
  const r = 근거.근거후보(줄('**트랙**', '`tools/x.js`', '작업중'),
    { root, 지문: 'aaaaaaaa', git: 가짜git(null), 형제: null });
  assert.strictEqual(r.경로, null, 'git 실패는 빈 배열이 아니라 null 이다');
  assert.ok(/못 쟀다/.test(근거.근거글(r)), '「못 쟀다」를 말해야 한다 — 침묵하면 0건으로 읽힌다');
});

/* 두 갈래를 **따로** 못박는다 — 위 검사는 경로만 지나가고(#Qnn 이 없어 번호 루프가 안 돈다)
 * 번호 갈래의 같은 접힘을 못 본다. 변이가 그 사각을 이름 대고 잡았다. */
test('git 이 죽으면 번호 갈래도 «못 쟀다»다 (경로와 따로 센다)', () => {
  const row = 줄('**#Q38 트랙**', '`tools/x.js`', '작업중');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git: 가짜git(null), 형제: null });
  assert.strictEqual(r.번호, null, '번호 갈래도 null 이어야 한다');
  assert.ok(/③ 번호 커밋 — \*\*못 쟀다\*\*/.test(근거.근거글(r)), '③ 갈래가 스스로 「못 쟀다」를 말해야 한다');
});

/* ── ② 주인 판정은 트레일러로만 ────────────────────────────────────────── */

test('남의 세션 트레일러가 붙은 커밋만 «남의것»이다', () => {
  const row = 줄('**트랙**', '`tools/x.js`', '작업중');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const git = 가짜git([
    커밋줄('1111111', '2026-08-15', '남이 이어서 끝냈다', 'local_bbbbbbbb-1111-2222-3333-444444444444'),
    커밋줄('2222222', '2026-08-15', '내가 낸 것', 'local_aaaaaaaa-1111-2222-3333-444444444444'),
    커밋줄('3333333', '2026-08-15', '트레일러 없음'),
  ].join('\n'));
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git, 형제: null });
  const c = r.경로[0].커밋;
  assert.strictEqual(c[0].남의것, true, '다른 지문 = 남의것');
  assert.strictEqual(c[1].남의것, false, '같은 지문 = 자기 것');
  assert.strictEqual(c[2].남의것, false, '트레일러 없음을 「남이 했다」로 읽으면 안 된다(F041)');
});

/* ── ③ 🚫비켜남 경로는 안 찾는다 ───────────────────────────────────────── */

test('🚫 로 비켜난 경로는 근거로 캐지 않는다', () => {
  const 칸 = '`tools/산다.js` · 🚫`tools/비켜났다.js` 무접촉';
  const 뽑힌 = 근거.경로뽑기(칸);
  assert.ok(뽑힌.includes('tools/산다.js'), '살아 있는 경로는 찾아야 한다');
  /* ⚠ `!includes('tools/비켜났다.js')` 로는 못 잡는다 — 비켜남을 안 떼면 토큰이 `🚫tools/…`
   *   라서 **문자열이 달라 그냥 통과한다**(변이가 이 사각을 잡았다). 이름으로 재야 한다. */
  assert.ok(!뽑힌.some((p) => p.includes('비켜났다')),
    `🚫 경로를 캐면 남의 작업이 이 트랙의 완료 증거로 둔갑한다 — 뽑힌 것: ${JSON.stringify(뽑힌)}`);
});

test('글로브·중괄호는 디렉터리까지만 자른다', () => {
  assert.deepStrictEqual(근거.경로뽑기('`docs/엔진/*.html`'), ['docs/엔진']);
  assert.ok(근거.경로뽑기('`docs/캐릭터/펠트_0815/`').includes('docs/캐릭터/펠트_0815'));
  assert.deepStrictEqual(근거.경로뽑기('경로 없음 · 이 줄'), [], '경로가 아닌 말을 경로로 읽으면 안 된다');
});

/* ── ④ 승계 — 남의 줄이 내 지문을 인용했나 ─────────────────────────────── */

test('다른 보드 파일이 이 지문을 인용하면 승계 후보다 (자기 파일은 뺀다)', () => {
  const row = 줄('**내 트랙**', '이 줄', '작업중 (`local_aaaaaaaa`)');
  const root = 판세우기({
    'aaaaaaaa.md': [row],
    'cccccccc.md': [줄('**후속 트랙**(`aaaaaaaa` 승계)', '이 줄', '✅착지 — 앞 줄의 남은 칸을 닫았다')],
    'dddddddd.md': [줄('**무관 트랙**', '이 줄', '진행중')],
  });
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null });
  assert.strictEqual(r.승계.length, 1, '승계 줄 1건이어야 한다');
  assert.strictEqual(r.승계[0].파일, 'cccccccc.md');
  assert.ok(/앞 줄의 남은 칸을 닫았다/.test(r.승계[0].발췌), '발췌는 상태 칸에서 와야 한다');
});

test('보드 폴더를 못 읽으면 승계 0건이라 말하지 않는다', () => {
  const 없는root = path.join(os.tmpdir(), 'boardev-없음-' + process.pid);
  const r = 근거.근거후보(줄('**트랙**', '이 줄', '작업중'),
    { root: 없는root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null });
  assert.ok(r.못본곳.some((m) => /보드 폴더를 못 읽었다/.test(m)), '미측정을 0건으로 뭉개면 안 된다');
});

/* ── ⑤ 번호 조인 키 ────────────────────────────────────────────────────── */

test('트랙 칸의 #Qnn 으로 커밋 제목을 찾는다', () => {
  const row = 줄('**#Q38 검수 콘솔**(대기열 P1)', '이 줄', '작업중');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const git = 가짜git((args) => (args.includes('--grep')
    ? 커밋줄('9999999', '2026-08-15', 'fix: 반박 수리 [대기열 P1 #Q38]', 'local_bbbbbbbb-x')
    : ''));
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git, 형제: null });
  assert.strictEqual(r.번호.length, 1);
  assert.strictEqual(r.번호[0].번호, '#Q38');
  assert.strictEqual(r.번호[0].커밋[0].남의것, true);
  assert.ok(git.부른것.some((a) => a.includes('#Q38')), '#Q38 로 실제 검색해야 한다');
});

test('트랙 칸에 번호가 없으면 그 갈래를 못 본 곳으로 적는다', () => {
  const row = 줄('**번호 없는 트랙**', '이 줄', '작업중');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null });
  assert.deepStrictEqual(r.번호, []);
  assert.ok(r.못본곳.some((m) => /#Qnn/.test(m)));
});

/* ── ⑥ 해시 조상 판정 · 장부 열림 (`a92e1e36` 이 ㉠ 2차에서 실제로 쓴 재료 둘) ───── */

test('상태 칸의 해시가 HEAD 조상인지 갈라 말한다 (조상 아님은 미완의 «반증»이다)', () => {
  const row = 줄('**트랙**', '이 줄', '✅닫았다 `aaa1111` · ▶남은 건 `bbb2222`');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const git = 가짜git((args) => {
    if (args[0] === 'cat-file') return '';                       // 둘 다 실재
    if (args[0] === 'merge-base') return args.includes('aaa1111') ? '' : null;
    return '';
  });
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git, 형제: null, 열림: [] });
  assert.deepStrictEqual(r.해시.map((h) => [h.해시, h.판정]), [['aaa1111', '조상'], ['bbb2222', '아님']]);
  const 글 = 근거.근거글(r);
  assert.ok(/aaa1111 ✔/.test(글) && /bbb2222 ✖/.test(글), '조상 여부를 눈에 보이게 갈라야 한다');
});

test('이 저장소에 없는 해시를 「조상 아님」과 뭉치지 않는다', () => {
  const row = 줄('**트랙**', '이 줄', '✅ talk `ccc3333` 로 닫음');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const r = 근거.근거후보(row,
    { root, 지문: 'aaaaaaaa', git: 가짜git((a) => (a[0] === 'cat-file' ? null : '')), 형제: null, 열림: [] });
  assert.strictEqual(r.해시[0].판정, '없음', '형제 저장소 커밋을 「이 가지에 안 왔다」로 읽으면 오탐이다');
});

test('상태 칸의 F번호가 아직 열려 있으면 미완의 증거로 낸다', () => {
  const row = 줄('**트랙**', '이 줄', '✅F463 닫음 · F473 보류');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const r = 근거.근거후보(row,
    { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null, 열림: ['F473'] });
  assert.deepStrictEqual(r.장부, [{ 번호: 'F463', 열림: false }, { 번호: 'F473', 열림: true }]);
  assert.ok(/F473 🔴 아직 열림/.test(근거.근거글(r)), '열린 장부는 눈에 띄게 말해야 한다');
});

test('장부 열림 목록을 못 읽으면 «0건»이 아니라 미측정이다', () => {
  const row = 줄('**트랙**', '이 줄', '✅F463 닫음');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null, 열림: null });
  assert.strictEqual(r.장부, null);
  assert.ok(/⑤ 장부 F번호 — \*\*못 쟀다\*\*/.test(근거.근거글(r)));
  assert.ok(r.못본곳.some((m) => /장부 열림 목록을 못 읽었다/.test(m)));
});

test('해시 표기가 없으면 그 갈래를 못 본 곳으로 적는다', () => {
  const row = 줄('**트랙**', '이 줄', '작업중 — 해시 없음');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const r = 근거.근거후보(row, { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null, 열림: [] });
  assert.deepStrictEqual(r.해시, []);
  assert.ok(r.못본곳.some((m) => /커밋 해시 표기가 없다/.test(m)));
});

/* ── ⑦ 후보 0건은 「끝났다」가 아니다 ──────────────────────────────────── */

test('후보가 하나도 없으면 「여기서는 안 보인다」로 말한다', () => {
  const row = 줄('**트랙**', '이 줄', '작업중');
  const root = 판세우기({ 'aaaaaaaa.md': [row] });
  const 글 = 근거.근거글(근거.근거후보(row, { root, 지문: 'aaaaaaaa', git: 가짜git(''), 형제: null }));
  assert.ok(/후보 0건/.test(글) && /여기서는 안 보인다/.test(글),
    '0건을 「끝났다」로 읽히게 두면 이 장치가 사고를 만든다');
  assert.ok(/판정이 아니다/.test(글), '머리줄이 「후보」임을 매번 말해야 한다');
});

/* ── ⑦ 실저장소 — 거짓양성만 (탐지력은 위 픽스처가 진다 · F296) ─────────── */

test('실저장소 보드 줄에 돌려도 안 죽고, 못 본 곳은 언제나 비지 않는다', () => {
  const 줄들 = 보드lib.줄들(REPO);
  if (!줄들 || !줄들.length) return;                       // 못 읽으면 skip — fail 이 아니다
  const 대상 = 줄들.slice(0, 2);
  for (const r of 대상) {
    const 지문 = path.basename(r.파일, '.md');
    /* 장부도 주입한다 — 안 주면 `friction.js` 를 자식으로 띄워 실저장소 상태·시간에 기댄다(F296). */
    const 결과 = 근거.근거후보(r.줄, { root: REPO, 지문, git: 가짜git(''), 형제: null, 열림: [] });
    assert.ok(Array.isArray(결과.못본곳) && 결과.못본곳.length >= 1,
      '못 본 곳이 비면 「전부 봤다」로 읽힌다 — repo 밖(유호님 답)은 원리상 못 본다');
    /* 건수만 세면 **다른 줄이 채워 준 항목**에 가려 이 줄이 사라진다(변이가 잡았다).
     * 「유호님 답은 여기서 원리상 안 보인다」가 이 장치의 가장 중요한 한계 고백이다 —
     * ㉠ 2차에서 `48a93cf9`·`8a244e32` 가 정확히 그 자리에서 안 옮겨졌다. 이름으로 못박는다. */
    assert.ok(결과.못본곳.some((m) => /유호님 답/.test(m)),
      '「유호님 답은 못 본다」는 언제나 적혀야 한다 — 빠지면 목록이 전수처럼 읽힌다');
    assert.doesNotThrow(() => 근거.근거글(결과));
  }
});

/* ── ⑧ 열린 장부 번호를 «어디서» 얻나 (F614 · 2026-08-18) ────────────────────
 *
 * 옛 판은 `node tools/friction.js --open` 을 자식으로 띄우고 그 **stdout 에서** `F\d{2,4}` 를
 * 긁었다. 그 출력은 신고문 전문을 싣고, 이 저장소의 신고문은 서로를 상시 인용한다 —
 * 그래서 **인용이 열림으로 둔갑했다**(실측 08-18: 긁힘 49 · 진짜 14 · 헛것 35 · 놓침 0).
 *
 * 🔑 새는 방향은 「부풀기」다. 부푼 목록은 이미 처분된 번호를 「아직 열림 — 미완의 증거다」로
 *   내밀어, 사람이 **끝난 줄을 안 치우게** 만든다(F372·F395 와 같은 방향 · 아무도 안 운다).
 *
 * 🔑 **탐지력은 아래 픽스처가 진다**(가드 맹점 ② · F296). 실저장소에는 거짓양성만 건다 —
 *   실장부의 열림 건수는 매일 바뀌므로 그 숫자를 검사에 박으면 내일 CI 가 빨개진다.
 */

/** 장부 모듈 흉내 — 신고문 칸이 «다른 번호를 인용하는» 실제 형태를 그대로 담는다. */
const 가짜장부 = (rows) => ({
  read: () => ({ rows }),
  열렸나: (r) => !String(r.resolved || '').trim(),
});

test('🔴 신고문이 인용한 번호는 «열림»이 아니다 — 옛 정규식 통로가 세 배로 부풀던 자리', () => {
  const rows = [
    { id: 'F400', resolved: '✅ a1b2c3d 로 닫음' },
    { id: 'F604', resolved: '', signal: '전수 감사 — F400·F435·F436·F493·F562·F543 계열이 여기엔 안 왔다' },
    { id: 'F435', resolved: '✅ 해소' },
    { id: 'F543', resolved: '⏸ 유호 판정 대기 — F493 과 같은 축' },
  ];
  const 뽑힌 = 근거.열림뽑기(가짜장부(rows));
  assert.deepStrictEqual(뽑힌, ['F604'],
    '열린 건 F604 하나다 — 그 신고문에 인용된 F400·F435·F436·F493·F562·F543 이 섞이면 옛 병이다');
  for (const 헛것 of ['F435', 'F436', 'F493', 'F562', 'F543']) {
    assert.ok(!뽑힌.includes(헛것), `${헛것} 은 인용일 뿐인데 열림으로 셌다 — 부풀기 재발`);
  }
});

test('🔴 보류(⏸)는 열림이 아니다 — 판정을 여기서 다시 적지 않고 장부의 술어를 그대로 쓴다', () => {
  const 장부 = require(path.join(REPO, 'tools', 'friction.js'));
  const rows = [
    { id: 'F001', resolved: '' },
    { id: 'F002', resolved: '⏸ 유호 판정 대기' },
    { id: 'F003', resolved: '✅ 고침' },
  ];
  /* 흉내가 아니라 **실제 술어**를 끼운다 — 두 곳에 적으면 갈라진다(신뢰성 ④). */
  assert.deepStrictEqual(근거.열림뽑기({ read: () => ({ rows }), 열렸나: 장부.열렸나 }), ['F001']);
});

test('🔴 옛 통로를 되살릴 수 없다 — 이 파일은 friction.js 를 자식으로 띄우지 않는다', () => {
  /* 주석의 언급은 위반이 아니다(그 사연을 적은 머리말이 자기 검사에 걸리면 안 된다).
   * 코드에서 `friction.js` 를 프로세스로 부르는 형태만 본다.
   * 🔑 통로를 쓴다 — 지역 사본(`(^|[^:])\/\/…`)은 `://` 만 지켜서, 위 주석이 말한
   *   「문자열의 언급」은 정작 못 지켰다(`'// 참고'` 를 주석으로 먹는다). */
  const 코드 = 코드만(파일소스(path.join(REPO, 'tools', 'lib', '보드근거.js')));
  assert.ok(!/execFileSync\s*\(\s*process\.execPath/.test(코드),
    'friction.js 를 자식 프로세스로 띄워 stdout 을 긁으면 F614 가 그대로 재발한다');
  assert.ok(!/--open/.test(코드), '`--open` 출력을 긁는 통로가 코드에 되살아났다');
});

test('못 잼과 0건을 가른다 — 이 저장소가 아닌 root 는 null 이다', () => {
  const 없는곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'noledger-'));
  assert.strictEqual(근거.열림장부(없는곳), null,
    '빈 배열로 뭉개면 「열린 장부가 없다」로 읽혀 미완 줄이 완료의 얼굴로 나간다(F207)');
});

test('실저장소 — 열림 목록이 장부 모듈의 판정과 «글자 그대로» 같다 (거짓양성만 · 건수는 안 박는다)', () => {
  const 장부 = require(path.join(REPO, 'tools', 'friction.js'));
  const 얻은것 = 근거.열림장부(REPO);
  if (얻은것 === null) return;                              // 못 읽으면 skip — fail 이 아니다(F296)
  const 진짜 = 장부.read().rows.filter(장부.열렸나).map((r) => r.id);
  assert.deepStrictEqual(얻은것, 진짜,
    '이 둘이 갈라지면 「열린 장부」라는 이름이 두 뜻을 갖는다 — 갈라짐 자체가 결함이다');
  assert.ok(얻은것.every((id) => /^F\d+$/.test(id)), '행 id 가 아닌 것이 섞였다');
});
