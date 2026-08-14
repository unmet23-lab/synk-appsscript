/* 보드수거 회귀 — 「마감한 주인의 완료 줄을 기계가 거둔다」(F368 의 남은 절반).
 *
 * 앞 절반(F368 · `tests/보드주인.test.js`)이 **탐지**를 세웠다. 남은 것은 **치우는 손**이었고,
 * 그 손이 사람이라 아무도 안 치웠다 — 실측 2026-08-12: 표 18줄 중 15줄이 마감한 주인의 것.
 *
 * 여기서 못박는 것 다섯:
 *   ① **세 조건이 동시에 참인 줄만** 거둔다 — 완료 ∩ 주인없음 ∩ 🎫없음.
 *      새는 방향이 앞 절반과 **반대**다: 거기선 「주인 있음」으로 틀리는 게 사고였는데(낡은 🎫 를
 *      집는다), 여기선 「완료·주인없음」으로 틀리면 **산 트랙의 줄이 아카이브로 나간다**(F146).
 *   ② **🎫 는 안 거둔다** — 완료 줄에도 이어받기 일감이 붙는다. 그걸 자동으로 치우면 일감이
 *      **조용히** 사라진다. 조용한 누수가 시끄러운 비용보다 나쁘다(board-guard 가 쓰는 그 원칙).
 *   ③ **못 잼과 0건을 가른다**(F207) — 생사를 못 재면 `null` 이고 **한 줄도 안 거둔다.**
 *      여기서 0건으로 접으면 「아무도 안 살아 있다」로 읽혀 산 세션의 줄을 통째로 쓸어낸다.
 *   ④ **종료 코드를 갈라 읽는다** — board-move 의 6(거절)은 정상 판정이고, 1(실패)·답없음은
 *      아니다. 셋을 한 덩어리로 세면 「거뒀다」와 「못 돌았다」가 같은 모양이 된다(F207 축).
 *   ⑤ **탐지력은 픽스처가 진다** — 실저장소엔 불변식(거짓양성 0)만 건다(가드 맹점 ②).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const 수거 = require(path.join(REPO, 'tools', '보드수거.js'));
const 보드 = require(path.join(REPO, 'tools', 'lib', '보드.js'));
const 소유자 = require(path.join(REPO, 'tools', '작업본소유자.js'));
const 보드id = require(path.join(REPO, '.claude', 'hooks', 'lib', 'board-id.js'));
/* 자식은 **공용 통로**로 띄운다 — 직접 spawnSync 하면 「안 떴다」가 stdout 빈 문자열이 되어
 * 통과를 기대하는 검사(여기선 「아무 말도 안 한다」 묶음)가 **조용히 초록**이 된다.
 * `tests/훅통로.test.js` 가 저장소를 훑어 옛 형태를 금지한다 — 내가 그 적색을 냈다. */
const { 훅띄우기 } = require(path.join(REPO, 'tests', 'lib', '훅띄우기.js'));
const BOARDJS = path.join(REPO, 'tools', 'board.js');
const 수거JS = path.join(REPO, 'tools', '보드수거.js');

const 머리 = '# 보드\n\n| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |\n|---|---|---|---|\n';

/* 사람이 실제로 쓰는 모양 그대로다(가드 맹점 ① — 검사는 실제 표기로 한다).
 * 아래 넷은 이 저장소에서 실제로 난 줄을 줄인 것이다. */
const 완료줄 = '| 2026-08-12 | **반쪽 게이트 착지** | tools/codex-review.js | ✅**종결** `e9f62bc2` — 초록 재고 착지 |';
const 티켓완료 = '| 2026-08-12 | **조율값 2벌** | tools/board-move.js | ✅**종결** — 회귀 +18 · 🎫**다음=보드 자기 줄 갱신** |';
const 활성줄 = '| 2026-08-12 | **설계 v3 재심문** | docs/설계.md | ▶작업중 (`local_deadbeef`) — 3회차 |';
const 라이브줄 = '| 2026-08-12 | **명부 스윕** | Code.js | ✅**라이브** [v9.217] `c0f148aa` |';

function 저장소(파일들, 아카이브 = '# 아카이브\n\n---\n\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-sweep-'));
  fs.mkdirSync(path.join(dir, 'docs', '_ops', '보드'), { recursive: true });
  for (const [이름, 내용] of Object.entries(파일들 || {})) {
    fs.writeFileSync(path.join(dir, 'docs', '_ops', '보드', `${이름}.md`), 내용, 'utf8');
  }
  fs.writeFileSync(path.join(dir, 'docs', '세션보드_아카이브.md'), 아카이브, 'utf8');
  return dir;
}

/* ── ① 무엇을 거두나 ────────────────────────────────────────────── */

test('☠️ 완료 ∩ 주인없음 줄을 대상으로 잡는다 — 픽스처에 산 세션은 하나도 없다(탐지력)', () => {
  const root = 저장소({ '0badc0de': 머리 + 완료줄 + '\n' });
  const r = 수거.조사(root);
  assert.notStrictEqual(r, null, '생사를 쟀어야 한다');
  assert.strictEqual(r.대상.length, 1);
  assert.strictEqual(r.대상[0].지문, '0badc0de');
  assert.ok(r.대상[0].문구, 'board-move 에 넘길 유일 문구를 골랐어야 한다');
});

test('🔑 「✅라이브」도 완료다 — F094 가 두 번 난 자리(완료로 시작하지 않는 표기)', () => {
  const root = 저장소({ '0badc0de': 머리 + 라이브줄 + '\n' });
  assert.strictEqual(수거.조사(root).대상.length, 1);
});

test('☠️ 🎫 가 든 완료 줄은 **안 거둔다** — 일감이 조용히 사라지는 쪽이 더 나쁘다', () => {
  const root = 저장소({ '0badc0de': 머리 + 티켓완료 + '\n' });
  const r = 수거.조사(root);
  assert.strictEqual(r.대상.length, 0, '🎫 줄을 거두면 이어받기 일감이 사라진다');
  assert.strictEqual(r.티켓.length, 1, '남긴 이유가 보고에 서야 한다(조용히 건너뛰면 안 보인다)');
});

test('☠️ 활성 줄은 주인이 없어도 안 거둔다 — 낡은 🎫 문제는 치우기로 푸는 게 아니다', () => {
  const root = 저장소({ '0badc0de': 머리 + 활성줄 + '\n' });
  const r = 수거.조사(root);
  assert.strictEqual(r.대상.length, 0);
  assert.strictEqual(r.티켓.length, 0);
});

test('🔑 한 파일에 섞여 있어도 완료만 고른다(같은 주인·같은 파일)', () => {
  const root = 저장소({ '0badc0de': 머리 + [완료줄, 활성줄, 티켓완료].join('\n') + '\n' });
  const r = 수거.조사(root);
  assert.strictEqual(r.대상.length, 1);
  assert.ok(r.대상[0].줄.includes('반쪽 게이트'), '완료이면서 🎫 없는 그 줄이어야 한다');
});

test('☠️ 「라이브 검증 중」처럼 두 어휘가 겹치면 **활성이 이긴다** — 여기서 지면 산 트랙이 지워진다', () => {
  /* 판정 정본(`tools/lib/보드.js` 활성행)의 우선순위 조항. 그 조항이 태어난 곳은 상한 계산이라
   * 틀려도 「상한이 빡빡해진다」로 끝났는데, **이제 그 판정이 줄을 아카이브로 내보낸다** —
   * 우선순위가 사라지면 이 줄이 완료로 읽혀 도는 트랙이 통째로 사라진다(F146 의 모양).
   * 그래서 판정이 board-guard 에서 이사 온 뒤의 **새 소비자 쪽에서** 다시 못박는다. */
  const 겹침 = '| 2026-08-12 | **명부 스윕 검증** | Code.js | ▶라이브 검증 중 · v9.217 |';
  const root = 저장소({ '0badc0de': 머리 + 겹침 + '\n' });
  assert.strictEqual(보드.활성행(겹침), true, '활성 어휘가 이겨야 한다');
  assert.strictEqual(수거.조사(root).대상.length, 0, '거두면 도는 트랙의 줄이 사라진다');
});

test('☠️ 유령(규격 밖 줄)은 대상이 아니다 — 조립기가 못 읽는 줄을 치울 대상으로 세지 않는다', () => {
  /* 날짜 칸이 짧아 표에서 통째로 빠지는 줄(F322·F330·F331). 치우는 것은 board-move 의
   * 손잡이로 남기고(그쪽은 유령도 후보로 본다), 자동 수거는 **판정이 확실한 것만** 가져간다. */
  const 유령 = '| 08-12 | **반쪽 게이트 착지** | x.js | ✅종결 |';
  const root = 저장소({ '0badc0de': 머리 + 유령 + '\n' });
  assert.strictEqual(수거.조사(root).대상.length, 0);
});

/* ── ③ 못 잼과 0건 ─────────────────────────────────────────────── */

test('🔑 생사를 못 재면 `null` — 「거둘 것 0건」이 아니다(F207)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-sweep-none-'));
  assert.strictEqual(수거.조사(dir), null, '보드 폴더가 없으면 판정 불가여야 한다');
});

test('☠️ 못 쟀을 때 CLI 는 **한 줄도 안 거두고 그 사실을 말한다** — 침묵하면 미실행이 통과가 된다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-sweep-none2-'));
  const r = 훅띄우기([수거JS, '--hook'], {
    encoding: 'utf8', env: { ...process.env, SYNK_BOARD_ROOT: dir },
  });
  assert.match(String(r.stdout), /못 쟀다/);
});

/* ── ④ 종료 코드를 갈라 읽는다 ──────────────────────────────────── */

/** board-move 자리에 **아무 코드로나 죽는 스텁**을 끼운다(F296 이 판 이음매와 같은 축):
 *  여기서 재는 것은 board-move 의 동작이 아니라 **수거가 종료 코드를 어떻게 읽는가**다. */
function 스텁(root, code) {
  const p = path.join(root, `stub-${code}.js`);
  fs.writeFileSync(p, `process.exit(${code});\n`, 'utf8');
  return p;
}

test('☠️ 6(원칙⑥ · 주인이 되살아났다)은 「거절」이지 실패가 아니다', () => {
  const root = 저장소({ '0badc0de': 머리 + 완료줄 + '\n' });
  process.env.SYNK_BOARD_MOVE_BIN = 스텁(root, 6);
  try {
    const r = 수거.조사(root);
    assert.strictEqual(수거.옮기기(r.대상[0], root), '거절');
  } finally { delete process.env.SYNK_BOARD_MOVE_BIN; }
});

test('☠️ 1(못 옮겼다)은 「실패」다 — 6 과 뭉치면 고장이 정상 판정으로 읽힌다', () => {
  const root = 저장소({ '0badc0de': 머리 + 완료줄 + '\n' });
  process.env.SYNK_BOARD_MOVE_BIN = 스텁(root, 1);
  try {
    const r = 수거.조사(root);
    assert.strictEqual(수거.옮기기(r.대상[0], root), '실패');
  } finally { delete process.env.SYNK_BOARD_MOVE_BIN; }
});

test('☠️ 답이 **안 오면** 「못받음」이다 — 통과로도 실패로도 접지 않는다', () => {
  /* 진짜 무응답을 만든다(안 끝나는 자식). ⚠ F296 의 「시간 제한이 CI 에서 거짓 적색」과는
   * 방향이 반대라 안전하다 — 여기서는 느릴수록 타임아웃이 **더 확실히** 난다. */
  const root = 저장소({ '0badc0de': 머리 + 완료줄 + '\n' });
  const 멈춤 = path.join(root, 'stub-hang.js');
  fs.writeFileSync(멈춤, 'setInterval(() => {}, 1000);\n', 'utf8');
  process.env.SYNK_BOARD_MOVE_BIN = 멈춤;
  process.env.SYNK_BOARD_SWEEP_TIMEOUT_MS = '400';
  try {
    const r = 수거.조사(root);
    assert.strictEqual(수거.옮기기(r.대상[0], root), '못받음');
  } finally {
    delete process.env.SYNK_BOARD_MOVE_BIN;
    delete process.env.SYNK_BOARD_SWEEP_TIMEOUT_MS;
  }
});

test('🔑 실행 자체가 안 되는 것은 「실패」다 — `node` 가 status 1 로 **답을 준** 자리다', () => {
  /* 첫 판은 이걸 「못받음」으로 기대해 빨개졌다. 가르는 재료는 「돌았나」가 아니라 **답이 왔나**다:
   * 파일이 없으면 node 가 돌아서 1 로 죽고, 그건 board-move 가 1 로 죽은 것과 같은 층이다. */
  const root = 저장소({ '0badc0de': 머리 + 완료줄 + '\n' });
  process.env.SYNK_BOARD_MOVE_BIN = path.join(root, '없는파일.js');
  try {
    const r = 수거.조사(root);
    assert.strictEqual(수거.옮기기(r.대상[0], root), '실패');
  } finally { delete process.env.SYNK_BOARD_MOVE_BIN; }
});

/* ── 계약: 진짜 board-move 로 한 왕복 ──────────────────────────── */

test('🔑 위임이 실제로 돈다 — 줄이 보드에서 빠지고 아카이브에 선다(원자성은 board-move 회귀가 진다)', () => {
  const root = 저장소({ '0badc0de': 머리 + 완료줄 + '\n' + 활성줄 + '\n' });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });

  const r = 수거.조사(root);
  assert.strictEqual(수거.옮기기(r.대상[0], root), '옮김');

  const 보드파일 = path.join(root, 'docs', '_ops', '보드', '0badc0de.md');
  /* ⚠ 대상은 **보드 마크다운**이다 — `코드만()` 으로 감싸지 않는다(갈래 ⓒ 비JS · 대기열 #Q72). */
  assert.ok(!fs.readFileSync(보드파일, 'utf8').includes('반쪽 게이트'), '보드에서 빠져야 한다');
  assert.ok(fs.readFileSync(path.join(root, 'docs', '세션보드_아카이브.md'), 'utf8').includes('반쪽 게이트'),
    '아카이브에 서야 한다 — 유실이 아니라 이동이다');
  assert.ok(fs.readFileSync(보드파일, 'utf8').includes('설계 v3'), '활성 줄은 그대로여야 한다');
});

/* ── ② 되찾기 — 되살아난 세션이 자기 줄을 찾는 자리 ─────────────── */

const 아카이브머리 = '# 아카이브\n\n---\n\n';

test('☠️ 보드에 내 줄이 없고 아카이브에 있으면 `board.js` 가 알린다 (F146 의 되찾기)', () => {
  const 내줄 = '| 2026-08-12 | **거둬진 트랙** | x.js | ✅종결 (`local_0badc0de`) |';
  const root = 저장소({ 'feedfeed': 머리 + 활성줄 + '\n' }, 아카이브머리 + 내줄 + '\n');
  const r = 훅띄우기(BOARDJS, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BOARD_ROOT: root, SYNK_BOARD_ARCHIVE: path.join(root, 'docs', '세션보드_아카이브.md'),
      CLAUDE_CODE_HOST_SESSION_ID: 'local_0badc0de-1111-2222-3333-444444444444' },
  });
  assert.match(String(r.stderr), /아카이브에 1건/);
  /* ⚠ 「아카이브」라는 낱말로 재지 않는다 — 표 **머리말**에 board-move 안내로 원래 들어 있어
   *   그 단정은 코드가 맞아도 빨개진다(첫 판이 그렇게 빨개졌다). 재는 것은 되찾기 표식이다. */
  assert.ok(!String(r.stdout).includes('🔁'), 'stdout 은 표뿐이다 — 파싱하는 곳이 넷이다');
});

test('☠️ 보드에 내 줄이 **있으면** 아무 말도 안 한다 — 매번 옛 트랙을 들이밀면 소음이 된다', () => {
  const 내줄 = '| 2026-08-12 | **거둬진 트랙** | x.js | ✅종결 (`local_0badc0de`) |';
  const root = 저장소({ '0badc0de': 머리 + 활성줄 + '\n' }, 아카이브머리 + 내줄 + '\n');
  const r = 훅띄우기(BOARDJS, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BOARD_ROOT: root, SYNK_BOARD_ARCHIVE: path.join(root, 'docs', '세션보드_아카이브.md'),
      CLAUDE_CODE_HOST_SESSION_ID: 'local_0badc0de-1111-2222-3333-444444444444' },
  });
  assert.ok(!/아카이브에/.test(String(r.stderr)), '내 줄이 살아 있으면 되찾기 안내는 소음이다');
});

test('☠️ **유령**도 내 줄로 센다 — 규격 밖이라 표에 안 뜰 뿐 선언은 있다(거짓 안내 금지)', () => {
  const 내줄 = '| 2026-08-12 | **거둬진 트랙** | x.js | ✅종결 (`local_0badc0de`) |';
  const 유령 = '| 08-12 | **내 유령 선언** | x.js | ▶작업중 |';
  const root = 저장소({ '0badc0de': 머리 + 유령 + '\n' }, 아카이브머리 + 내줄 + '\n');
  const r = 훅띄우기(BOARDJS, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BOARD_ROOT: root, SYNK_BOARD_ARCHIVE: path.join(root, 'docs', '세션보드_아카이브.md'),
      CLAUDE_CODE_HOST_SESSION_ID: 'local_0badc0de-1111-2222-3333-444444444444' },
  });
  assert.ok(!/아카이브에/.test(String(r.stderr)), '유령을 「내 줄 0」으로 읽으면 거짓말을 한다');
});

test('🔑 아카이브를 못 읽으면 「없다」가 아니라 「판정 못 했다」다 (F207)', () => {
  const root = 저장소({ 'feedfeed': 머리 + 활성줄 + '\n' });
  fs.rmSync(path.join(root, 'docs', '세션보드_아카이브.md'));
  const r = 훅띄우기(BOARDJS, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BOARD_ROOT: root, SYNK_BOARD_ARCHIVE: path.join(root, 'docs', '세션보드_아카이브.md'),
      CLAUDE_CODE_HOST_SESSION_ID: 'local_0badc0de-1111-2222-3333-444444444444' },
  });
  assert.match(String(r.stderr), /못 읽어/);
});

test('🔑 지문이 없으면 아무것도 안 찾는다 — 8자리 꼴이 아닌 입력에 부분일치로 새지 않는다', () => {
  const root = 저장소({ 'feedfeed': 머리 + 활성줄 + '\n' }, 아카이브머리 + 완료줄 + '\n');
  assert.deepStrictEqual(보드.아카이브된줄들(root, ''), []);
  assert.deepStrictEqual(보드.아카이브된줄들(root, 'zzz'), []);
});

/* ── ⑤ 실저장소 — 불변식만(탐지력은 위 픽스처가 진다) ──────────── */

test('☠️ 실저장소 거짓양성 — 대상에 **산 세션의 줄**이 하나도 없다', () => {
  const r = 수거.조사(REPO);
  if (r === null) return;   // 생사를 못 재는 판은 위 픽스처가 진다(여기선 skip 과 같다)
  const 산지문 = new Set(소유자.세션들(REPO).filter(소유자.선언살았나).map((s) => 보드id.지문(s.sid)));
  const 샌것 = r.대상.filter((c) => 산지문.has(c.지문));
  assert.deepStrictEqual(샌것.map((c) => c.지문), [], '산 주인의 줄이 대상에 들면 그 세션이 트랙을 잃는다(F146)');
});

test('☠️ 실저장소 불변식 — 대상에 🎫 도 활성 줄도 하나도 없다', () => {
  const r = 수거.조사(REPO);
  if (r === null) return;
  assert.deepStrictEqual(r.대상.filter((c) => c.줄.includes('🎫')).map((c) => c.문구), []);
  assert.deepStrictEqual(r.대상.filter((c) => 보드.활성행(c.줄)).map((c) => c.문구), []);
});

test('🔑 파티션 — 대상은 언제나 표 줄의 부분집합이다(치울 줄을 지어내지 않는다)', () => {
  const r = 수거.조사(REPO);
  if (r === null) return;
  const 표줄들 = new Set((보드.줄들(REPO) || []).map((x) => x.줄));
  for (const c of r.대상) assert.ok(표줄들.has(c.줄), `표에 없는 줄을 대상으로 잡았다: ${c.문구}`);
});

/* ── ⑥ 승계 규약이 만든 쌍둥이 줄 — 규약을 지킬수록 안 치워졌다 (F405 · 2026-08-13) ──────
 *
 * `board-guard` ④ 는 「죽은 세션의 트랙을 이어받으면 트랙 칸을 **바이트 그대로** 옮겨 적어라」고
 * 시킨다(그래야 중복 구현 검사에 안 걸린다). 그런데 `이관문구` 는 트랙 칸에서 **표 전체에서
 * 유일한** 부분문자열을 찾으므로, 승계로 바이트가 같아진 두 줄은 어떤 needle 도 유일하지 않아
 * 늘 `null` 이었다 — 실측 2026-08-13: `표 16줄 · 완료 4줄 → 거둘 수 있는 것 0건 · 문구를 못
 * 고른 것 1건(34297acc)`. **규약을 지킨 줄만 영영 남는다**(F103 축 — 따를 수 없는 처방).
 *
 * ⚠ 고치는 방향이 새면 **엉뚱한 줄을 옮긴다.** 그래서 좁힌 문구는 board-move 에 파일을 못박아
 *   넘기는 통로(`옮기기()` 의 `SYNK_BOARD`)에게만 준다 — 문구만으로 부르는 통로(사람이 손으로
 *   치거나 board-guard 처방문이 내미는 명령)의 폴백은 **지금 동작(전역 유일) 그대로**여야 한다.
 */

/* 실제로 났던 모양 그대로: 트랙 칸만 바이트가 같고 나머지 칸은 다르다(가드 맹점 ①). */
const 승계갑 = '| 2026-08-13 | **과제선택 5회차 «전건 처분»** | docs/설계.md | ✅**②집행 종결** `4e745055` |';
const 승계을 = '| 2026-08-13 | **과제선택 5회차 «전건 처분»** | docs/처분표.md | ✅**①판정 종결** `c4fcf299` |';

test('☠️ 승계로 트랙 칸이 같아진 두 줄도 거둔다 — 옛 판은 둘 다 「문구를 못 골랐다」였다', () => {
  const root = 저장소({ '0badc0de': 머리 + 승계갑 + '\n', 'deadbea7': 머리 + 승계을 + '\n' });
  const r = 수거.조사(root);
  assert.notStrictEqual(r, null, '생사를 쟀어야 한다');
  assert.strictEqual(r.문구없음.length, 0, '규약대로 승계한 줄이 영영 안 치워지면 안 된다');
  assert.strictEqual(r.대상.length, 2);
});

test('☠️ 좁힌 문구는 **그 파일 안에서** 정확히 1줄에 걸린다 — board-move 가 SYNK_BOARD 로 재는 그 수', () => {
  const root = 저장소({ '0badc0de': 머리 + 승계갑 + '\n', 'deadbea7': 머리 + 승계을 + '\n' });
  for (const c of 수거.조사(root).대상) {
    const 그파일 = fs.readFileSync(path.join(root, 'docs', '_ops', '보드', c.파일), 'utf8')
      .split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter(보드.표줄);
    assert.strictEqual(그파일.filter((l) => l.includes(c.문구)).length, 1,
      `"${c.문구}" 가 ${c.파일} 안에서 유일하지 않다 — board-move 가 그 줄을 특정 못 한다`);
  }
});

test('☠️ 파일을 **안 넘기면** 여전히 전역 유일만 받는다 — 처방문의 명령은 SYNK_BOARD 없이 돈다', () => {
  assert.strictEqual(보드.이관문구(승계갑, [승계갑, 승계을]), null,
    '전역에서 유일하지 않은 문구를 사람이 칠 명령에 넣으면 board-move 가 「세션 파일 2개에 걸린다」로 죽는다');
});

test('☠️ 그 줄이 **그 파일에 없으면** 안 고른다 — 좁히다 엉뚱한 줄을 짚는 방향(F405 ⚠)', () => {
  assert.strictEqual(보드.이관문구(승계갑, [승계갑, 승계을], [승계을]), null,
    '승계갑의 조각이 승계을 하나에 걸려 「유일」로 보인다 — 그걸 받으면 남의 줄을 옮긴다');
});

test('🔑 전역에서 유일하면 그 문구가 먼저다 — 파일부터 재면 남이 못 쓰는 짧은 문구가 나온다', () => {
  /* 두 트랙 칸이 4글자 앞머리를 공유한다: 파일 안에서만 재면 그 앞머리로 충분해 보이지만,
   * 사람·board-guard 처방문은 SYNK_BOARD 없이 그 문구를 치므로 **전역에서** 유일해야 한다. */
  const 갑 = '| 2026-08-13 | **알파 브라보** | a.js | ✅종결 |';
  const 을 = '| 2026-08-13 | **알파 브델타** | b.js | ✅종결 |';
  assert.strictEqual(보드.이관문구(갑, [갑, 을]), '알파 브라보*');
  assert.strictEqual(보드.이관문구(갑, [갑, 을], [갑]), '알파 브라보*',
    '파일을 넘겼다고 전역 유일 문구를 버리면 처방문의 명령이 「세션 파일 2개에 걸린다」로 죽는다');
});

test('☠️ 같은 파일의 **유령**과 겹치면 문구를 안 고른다 — 못 쓸 명령을 만드느니 스킵이 낫다', () => {
  /* board-move 의 파일 안 검색은 `표줄`(유령 포함)로 센다 — 유령과 겹치는 needle 을 주면
   * 「2줄에 걸린다」로 죽는다. 옛 판은 유령을 분모에서 빼 그 needle 을 「유일」로 뽑았다. */
  const 유령후속 = '| 08-13 | **과제선택 5회차 «전건 처분»** 후속 | x.js | ✅종결 |';
  const root = 저장소({ '0badc0de': 머리 + 승계갑 + '\n' + 유령후속 + '\n' });
  const r = 수거.조사(root);
  assert.strictEqual(r.대상.length, 0);
  assert.strictEqual(r.문구없음.length, 1, '못 고른 사실이 보고에 서야 한다(조용히 건너뛰면 안 보인다)');
});
