/**
 * 「바탕화면을 번호로 가리키지 마라」가 **쓰는 순간** 발동하는지 — #Q74 회귀.
 *
 * 무엇이 병이었나 (2026-08-14 실사고): 규칙을 무는 장치가 `tests/운영자료.test.js` **하나뿐**이었고
 * 그건 커밋 뒤에만 발화한다. 그래서 세션 `f8fd4dd0` 가 자기 보드 줄에 번호 참조를 적고 죽자
 *   ① 그 한 줄이 `tools/test-ci.js` 를 적색으로 만들었고,
 *   ② 원격 CI 는 Actions 소진으로 0건이라 그 로컬 모사가 유일한 진실 층이라
 *      **저장소 전체의 `/deploy`** 가 막혔고,
 *   ③ 그런데 **아무도 못 고쳤다** — 남의 보드 파일은 F250·F073 이 편집을 금지하고
 *      `board-move` 는 원칙 ⑦(미완 이관 금지)로 아카이브도 거절한다.
 * 고칠 수 있는 사람과 발견하는 사람이 **반드시 달라지는** 구조였다(F298·F351 과 같은 병).
 *
 * 그래서 이 파일이 재는 것은 «정규식이 잡느냐»가 아니다 — 그건 `운영자료.test.js` 픽스처 몫이다.
 * 여기는 **발동 시점과 단일 출처**를 잰다: 쓰는 순간 막는가 · 신고문은 통과시키는가 ·
 * 남의 위반으로 내 편집을 막지는 않는가 · 판정이 두 벌로 갈라지지 않았는가.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'board-guard.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-번호참조훅-'));
const BOARD = path.join(TMP, 'docs', '_ops', '보드', 'aaaa1111.md');
fs.mkdirSync(path.dirname(BOARD), { recursive: true });

/* 픽스처 줄은 board-guard 의 **다른** 검사(칸 200자·줄 수·F165 지문)를 이미 통과하는 모양이라야
 * 한다 — 안 그러면 「막혔다」가 무엇 때문인지 못 가른다. board-guard.test.js 의 모양을 그대로 쓴다. */
const 줄 = (상태) => `| 2026-08-01 | 트랙 | Code.js \`local_deadbeef\` | ${상태} |`;
const 머리 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'];

/** 차단 사유까지 본다 — 「막았다」만으로는 **왜** 막았는지·안내가 맞는지 못 잰다. */
function 판정(payload) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  if (!out.trim()) return { 결정: 'allow', 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput || {};
  return { 결정: h.permissionDecision || 'allow', 사유: String(h.permissionDecisionReason || '') };
}

/* ⚠ `old_string` 은 **줄 전체**여야 한다. 조각(`'작업중'`)으로 주면 치환 결과가 칸이 늘어난
 *   기형 줄이 되고, 그러면 유령 줄 검사가 먼저 막아 **이 파일이 무엇을 쟀는지 흐려진다**
 *   (첫 판이 그렇게 틀렸다 — 「막혔다」는 같은 모양이라 초록으로 착각하기 쉬운 자리다). */
const 편집 = (구상태, 신상태) => 판정({
  tool_name: 'Edit',
  tool_input: { file_path: BOARD, old_string: 줄(구상태), new_string: 줄(신상태) },
});

test('쓰는 순간 막는다 — 그리고 어느 표기인지 대 준다', () => {
  fs.writeFileSync(BOARD, [...머리, 줄('작업중')].join('\n'), 'utf8');
  const r = 편집('작업중', '✅종결 — 산출물은 바탕화면 35번');
  assert.strictEqual(r.결정, 'deny', `안 막혔다 — 실제 사유:\n${r.사유}`);
  assert.match(r.사유, /바탕화면 35번/, `무엇이 걸렸는지 안 대 주면 받는 사람이 못 고친다:\n${r.사유}`);
});

/* 🔴 CLAUDE.md 가드 4맹점 ③ — **자기 처방을 막지 않는지.** 차단 사유가 시키는 대로 적었을 때
 *   통과하지 않으면 그 가드는 우회를 정상 통로로 만든다(F103). 이 가드가 특히 위험한 이유는
 *   처방이 두 갈래라서다 — 그 자리를 «가리키는» 사람과 위반을 «신고하는» 사람의 답이 다르다.
 *   실측 08-14: 신고문이 위반을 두 개 더 만들었다(샌 자리 1곳 → 2곳). */
test('자기 처방이 통과한다 — 사유가 시키는 두 갈래를 그대로 적어 본다', () => {
  fs.writeFileSync(BOARD, [...머리, 줄('작업중')].join('\n'), 'utf8');
  for (const 상태 of [
    '✅종결 — 산출물은 운영 「이해 대장 (어디가 비었나)」',   // ▶가리키려는 것이면
    '🔴적색 — 남의 줄이 바탕화면을 «35번» 같은 번호로 가리킨다', // ▶신고하려는 것이면
    '🔴그 줄의 「35번」 표기가 밀렸다',
  ]) {
    const r = 편집('작업중', 상태);
    assert.strictEqual(r.결정, 'allow',
      `처방을 따른 표기가 막혔다 — 그러면 그건 따를 수 없는 처방이다:\n${상태}\n${r.사유}`);
  }
});

/* 🔴 재는 것은 `incoming`(내가 새로 넣는 글)뿐이다. 결과 파일 전체를 재면 **남이 이미 넣어 둔**
 *   번호가 내 무관한 편집을 영원히 막는다 — 이 트랙을 낳은 그 사고를 가드가 그대로 재현하는 꼴이다.
 *   (첫 판이 실제로 이렇게 틀릴 뻔했다: ⑦ 옛 글자가 같은 규약을 주석으로 남겨 둔 이유다.) */
test('남이 이미 적어 둔 번호로 내 편집을 막지 않는다 — incoming 만 잰다', () => {
  fs.writeFileSync(BOARD, [...머리, 줄('작업중 — 바탕화면 35번')].join('\n'), 'utf8');
  const r = 편집('작업중 — 바탕화면 35번', '✅종결 — 운영 「이해 대장 (어디가 비었나)」');
  assert.strictEqual(r.결정, 'allow',
    `남의 옛 위반이 내 깨끗한 편집을 막는다 — 따를 수 없는 처방이다(F103):\n${r.사유}`);
});

test('Write 로 통째 쓸 때도 막는다 — Edit 만 보면 가장 흔한 통로가 뚫린다', () => {
  fs.writeFileSync(BOARD, [...머리, 줄('작업중')].join('\n'), 'utf8');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: [...머리, 줄('✅ 바탕화면 35번')].join('\n') } });
  assert.strictEqual(r.결정, 'deny', `Write 통로가 뚫려 있다:\n${r.사유}`);
});

/* 🔑 판정이 두 벌이 되면 갈라지고, 갈라지는 방향은 언제나 「통과」다(CLAUDE.md 신뢰성 ④).
 *   #Q74 이전이 정확히 그 상태로 갈 뻔했다 — 스위트가 정규식을 들고 있어서 훅은 사본을 만들
 *   수밖에 없는 자리였다. 다시 갈라지면 여기가 빨개진다. */
test('판정은 1벌 — 훅도 스위트도 같은 모듈에서 읽는다', () => {
  for (const [이름, p] of [['board-guard', HOOK], ['tests/운영자료.test.js', path.join(ROOT, 'tests', '운영자료.test.js')]]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.match(src, /require\([^)]*번호참조\.js['"]\)/,
      `${이름} 이 판정을 자기 안에 다시 적었다 — 두 벌은 반드시 갈라진다`);
    assert.doesNotMatch(src, /바탕화면\\s\*/,
      `${이름} 에 정규식이 또 적혀 있다 — 범위는 .claude/hooks/lib/번호참조.js 하나에만 산다`);
  }
});

/* 🔴 「가드는 로직보다 등록층에서 샌다 — 새는 방향은 언제나 통과」(CLAUDE.md 신뢰성).
 *   위 칸이 전부 초록이어도 훅이 이 파일에 대해 안 뜨면 아무것도 안 막는다. */
test('등록 — board-guard 가 보드 파일 경로에 실제로 걸려 있다', () => {
  const 설정 = fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8');
  assert.match(설정, /board-guard\.js/, 'board-guard 가 등록돼 있지 않다 — 규칙만 있고 발동이 없다');
});
