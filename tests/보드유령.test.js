/* 유령 줄 회귀 — 「표에 안 뜨는데 파일엔 있는 보드 줄」 (마찰 F322 · F330 · F331).
 *
 * 사고의 모양: 「이게 표 줄인가」를 세 곳이 각자 적었다 — `tools/lib/보드.js`(엄격: 날짜 필요) ·
 * `.claude/hooks/board-guard.js`(느슨) · `tools/board-move.js`(느슨). 그래서 규격 밖 줄
 * (`| 08-11 | …` · 5칸)은 **가드는 통과시키고 조립기는 안 읽는다.** 새는 방향이 「없는 줄」이라
 * 증상이 0이고, 세 세션이 차례로 밟았다(c9eb0956 · fe43f4b4 → 그 모양을 베낀 82e5d71d · d3139ff6).
 *
 * 여기서 못박는 것 셋:
 *   ① **정의가 하나다** — `줄들`·`유령들` 이 모든 표줄을 남김없이·겹침없이 가른다(파티션).
 *      파티션이 깨지는 순간이 곧 세 번째 정의가 생긴 순간이다.
 *   ② **탐지력은 픽스처가 진다** — 실저장소에는 「거짓양성 0」만 건다(맹점 ②:
 *      버그가 아직 있을 것을 요구하는 회귀는 고치는 순간 빨개진다).
 *   ③ **자기 처방을 막지 않는다**(F103) — deny 가 시키는 규격대로 고친 줄은 통과해야 한다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 보드 = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));
const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'board-guard.js');
const MOVE = path.join(__dirname, '..', 'tools', 'board-move.js');
const BOARDJS = path.join(__dirname, '..', 'tools', 'board.js');
const REPO = path.resolve(__dirname, '..');

/* 사람이 실제로 쓴 모양 그대로다(맹점 ①) — 아래 둘은 저장소에서 실제로 난 줄을 줄인 것이다.
 *   · 짧은 날짜  : F322(c9eb0956) · F331(fe43f4b4 → 82e5d71d 가 그 모양을 베꼈다)
 *   · 5칸(세션 열): F330(d3139ff6) — `fe43f4b4.md:5` 는 **둘 다**였다. */
const 바른줄 = (트랙) => `| 2026-08-12 | ${트랙} | Code.js \`local_deadbeef\` | 작업중 |`;
const 짧은날짜 = (트랙) => `| 08-12 | ${트랙} | Code.js \`local_deadbeef\` | 작업중 |`;
const 다섯칸 = (트랙) => `| 2026-08-12 | deadbeef | ${트랙} | Code.js | 작업중 |`;
const 들여쓴줄 = (트랙) => ` ${바른줄(트랙)}`;

function 저장소(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ghost-'));
  const 폴더 = path.join(dir, 'docs', '_ops', '보드');
  fs.mkdirSync(폴더, { recursive: true });
  for (const [이름, 내용] of Object.entries(파일들 || {})) {
    fs.writeFileSync(path.join(폴더, `${이름}.md`), 내용, 'utf8');
  }
  return dir;
}

/** 훅을 띄워 판정을 받는다. deny 면 그 사유, 아니면 null. */
function 판정(input, cwd) {
  const 읽기 = (out) => {
    if (!String(out || '').trim()) return null;
    try {
      const h = JSON.parse(out).hookSpecificOutput || {};
      return h.permissionDecision === 'deny' ? String(h.permissionDecisionReason || '') : null;
    } catch (_) { return null; }
  };
  try {
    return 읽기(execFileSync('node', [HOOK], {
      input: JSON.stringify(input), encoding: 'utf8', stdio: 'pipe', cwd: cwd || process.cwd(),
    }));
  } catch (e) { return 읽기((e && e.stdout) || ''); }
}

// ── ⓪ 훅이 «실제로 돈다» ─────────────────────────────────────────────
/* 🔴 정의를 한 곳으로 모으다 실제로 밟은 자리다(2026-08-12): `function isDataRow` 를
 *   `const isDataRow = 보드lib.표줄` 로 바꿨더니 톱레벨 `countRows` 호출이 **TDZ** 에 걸려
 *   훅이 통째로 죽었다. 죽은 훅은 stdout 이 비어 하네스가 **통과**로 읽는다(F239) — 즉
 *   가드가 막던 것이 전부 통과한다. `node --check` 는 구문만 보므로 이 부류에 눈이 멀다. */
test('🔴 훅이 죽지 않는다 — 죽은 훅은 조용히 통과로 읽힌다(F239)', () => {
  const dir = 저장소({ mine0000: `${바른줄('내 트랙')}\n` });
  const 내파일 = path.join(dir, 'docs', '_ops', '보드', 'mine0000.md');
  const 판들 = [
    { tool_name: 'Write', tool_input: { file_path: 내파일, content: `${바른줄('내 트랙')}\n` } },
    { tool_name: 'Edit', tool_input: { file_path: 내파일, old_string: '내 트랙', new_string: '내 트랙 갱신' } },
  ];
  for (const input of 판들) {
    let err = '';
    try {
      execFileSync('node', [HOOK], { input: JSON.stringify(input), encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { err = String((e && e.stderr) || ''); }
    assert.strictEqual(err.trim(), '', `훅이 죽었다(${input.tool_name}) — 이 자리는 통과와 같은 모양이다:\n${err}`);
  }
});

// ── ① 정의가 하나다 (파티션) ─────────────────────────────────────────
test('🔑 `데이터행` 은 `표줄` 에서 파생된다 — 둘이 갈리면 그 차집합이 유령이다', () => {
  const 표본 = [
    바른줄('가'), 짧은날짜('나'), 다섯칸('다'), 들여쓴줄('라'),
    '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
    '', '# 제목', '보통 문장', '표가 아닌 | 파이프',
  ];
  for (const l of 표본) {
    assert.strictEqual(
      보드.데이터행(l), 보드.표줄(l) && 보드.유령사유(l).length === 0,
      `판정이 갈렸다(세 번째 정의가 생겼다는 뜻이다): ${JSON.stringify(l)}`
    );
  }
});

test('🔑 `줄들` + `유령들` = 모든 표줄 — 남김없이·겹침없이 (파티션이 깨지면 줄이 사라진다)', () => {
  const dir = 저장소({
    aaaa1111: `${바른줄('바른')}\n${짧은날짜('짧은')}\n`,
    bbbb2222: `${다섯칸('다섯')}\n${들여쓴줄('들여')}\n`,
  });
  const 산 = 보드.줄들(dir).map((r) => r.줄.trim());
  const 유령 = 보드.유령들(dir).map((r) => r.줄.trim());
  assert.deepStrictEqual(산, [바른줄('바른')], '규격 통과 줄이 표에 안 실렸다');
  assert.strictEqual(유령.length, 3, `유령 3개(짧은 날짜·5칸·들여쓰기)를 다 못 잡았다: ${JSON.stringify(유령)}`);
  assert.strictEqual(new Set([...산, ...유령]).size, 4, '같은 줄이 양쪽에 들었다(겹침)');
});

test('유령은 **왜** 유령인지 말한다 — 사유가 없으면 다음 세션이 같은 모양을 또 쓴다', () => {
  assert.match(보드.유령사유(짧은날짜('가')).join(' '), /YYYY-MM-DD/);
  assert.match(보드.유령사유(다섯칸('가')).join(' '), /칸이 5개/);
  assert.match(보드.유령사유(들여쓴줄('가')).join(' '), /시작하지 않는다/);
  assert.deepStrictEqual(보드.유령사유(바른줄('가')), [], '멀쩡한 줄에 사유가 붙었다(거짓양성)');
  assert.deepStrictEqual(보드.유령사유('그냥 문장'), [], '표줄이 아닌 것을 유령으로 셌다');
});

test('🔑 백틱 안의 `|` 는 칸막이가 아니다 — 칸 수 검사가 명령줄 인용에서 거짓양성을 내면 안 된다', () => {
  const 줄 = '| 2026-08-12 | **트랙** | `node a.js 2>&1|tee b` | 작업중 |';
  assert.deepStrictEqual(보드.유령사유(줄), [], `칸 가르기가 공용 통로를 안 쓴다: ${JSON.stringify(보드.유령사유(줄))}`);
});

// ── ② 가드가 «쓰는 순간» 막는다 ──────────────────────────────────────
for (const [이름, 만들기, 짚을것] of [
  ['짧은 날짜(F322·F331)', 짧은날짜, /YYYY-MM-DD/],
  ['5칸(F330)', 다섯칸, /칸이 5개/],
]) {
  test(`🔴 ${이름} 로 선언하면 막는다 — 안 막으면 증상이 0이다`, () => {
    const dir = 저장소({ peer0000: `${바른줄('남의 트랙')}\n` });
    const 내파일 = path.join(dir, 'docs', '_ops', '보드', 'mine1111.md');
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${만들기('내 트랙')}\n` } });
    assert.ok(r, '유령 줄을 그대로 통과시켰다 — 이 줄은 보드에도 board-move 후보에도 인계문에도 안 뜬다');
    assert.match(r, 짚을것, '무엇이 틀렸는지 안 짚었다 — 처방 없는 차단은 우회를 부른다');
  });
}

test('🔴 F103 자기 처방 — deny 가 시킨 규격대로 고친 줄은 통과한다', () => {
  const dir = 저장소({ peer0000: `${바른줄('남의 트랙')}\n` });
  const 내파일 = path.join(dir, 'docs', '_ops', '보드', 'mine2222.md');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${바른줄('내 트랙')}\n` } });
  assert.strictEqual(r, null, `차단 사유가 시키는 모양을 그 가드가 막는다 — 그러면 우회가 정상 통로가 된다: ${r}`);
});

test('내 파일에 **이미 있던** 유령은 막지 않고 드러낸다 (F233·F234·F235 와 같은 규칙)', () => {
  const 이미 = 짧은날짜('옛 트랙');
  const dir = 저장소({ mine3333: `${이미}\n` });
  const 내파일 = path.join(dir, 'docs', '_ops', '보드', 'mine3333.md');
  const r = 판정({
    tool_name: 'Edit',
    tool_input: { file_path: 내파일, old_string: '옛 트랙', new_string: '옛 트랙 갱신' },
  });
  /* 갱신하면 줄이 바뀌므로 그건 「내가 바꾼 줄」이라 막히는 게 맞다 — 여기서 재는 것은
   * **손 안 댄 유령**이 다른 편집을 막지 않는가다. 그래서 다른 줄을 더해 본다. */
  assert.ok(r, '유령 줄을 고치는(=여전히 유령인) 편집이 통과했다');
  const r2 = 판정({
    tool_name: 'Write',
    tool_input: { file_path: 내파일, content: `${이미}\n${바른줄('새 트랙')}\n` },
  });
  assert.strictEqual(r2, null, '손 안 댄 유령이 내 다른 줄의 선언을 막았다(F235 축 — 따를 수 있는 처방만 남겨야 한다)');
});

// ── ③ 이미 써진 유령을 «찾을 수 있는가» ──────────────────────────────
test('🔑 `node tools/board.js` 가 유령을 드러낸다 — 표만 내면 그 줄은 영원히 안 보인다', () => {
  const dir = 저장소({ dead1234: `${바른줄('보이는 트랙')}\n${짧은날짜('숨은 트랙')}\n` });
  const r = execFileSync('node', [BOARDJS], {
    encoding: 'utf8', stdio: 'pipe', env: { ...process.env, SYNK_BOARD_ROOT: dir },
  });
  // stdout(표)은 파싱 대상이라 건드리지 않는다 — 경고는 stderr 다.
  assert.ok(!r.includes('숨은 트랙'), '유령이 표에 실렸다 — 조립기 규격이 흔들린 것이다');
  assert.ok(r.includes('보이는 트랙'), '멀쩡한 줄이 표에서 빠졌다');
});

test('🔑 board-move 가 유령을 **후보로 본다** — 못 보면 주인 죽은 유령은 영원히 안 치워진다(F103)', () => {
  const dir = 저장소({ dead1234: `${바른줄('보이는 트랙')}\n${짧은날짜('숨은 트랙')}\n` });
  const archive = path.join(dir, '세션보드_아카이브.md');
  fs.writeFileSync(archive, '# 아카이브\n\n---\n\n', 'utf8');
  const r = execFileSync('node', [MOVE, '--dry', '숨은 트랙'], {
    encoding: 'utf8', stdio: 'pipe',
    env: { ...process.env, SYNK_BOARD_ROOT: dir, SYNK_BOARD_ARCHIVE: archive },
  });
  assert.match(r, /숨은 트랙/, '유령이 board-move 후보에 안 들었다');
  assert.match(r, /유령/, '유령을 조용히 옮기려 했다 — 규격 밖이었다는 사실이 아무 데도 안 남는다');
});

// ── 실저장소 — **거짓양성만** 잰다 (맹점 ②) ──────────────────────────
test('실저장소: 표에 실린 줄은 하나도 유령으로 안 걸린다 (거짓양성 0)', () => {
  const 산 = 보드.줄들(REPO);
  assert.ok(산 !== null, '보드 폴더를 못 읽었다');
  const 잘못 = 산.filter((r) => 보드.유령사유(r.줄).length);
  assert.deepStrictEqual(잘못.map((r) => `${r.파일}:${r.줄번호}`), [],
    '조립기가 렌더하는 줄을 유령으로 셌다 — 규격이 실사용보다 좁다');
});

/* 🚫 「실저장소 유령 = 0」 은 걸지 않는다. 그건 **버그가 아직 있을 것을 요구하는** 회귀의
 *   거울상이다 — 지금 0으로 못 박으면 남의 세션이 유령을 하나 쓰는 순간(그 세션은 이미
 *   ⑨ 로 막히지만, 폰·클라우드처럼 훅이 안 도는 자리가 있다) 이 파일이 **남의 결함으로**
 *   빨개지고, 그 적색은 내 배포 게이트를 막는다. 유령의 존재는 `tools/board.js` 가 알린다. */
