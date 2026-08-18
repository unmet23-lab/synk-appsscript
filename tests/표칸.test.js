// 표 칸 가르기 회귀 — 백틱 안의 파이프는 칸막이가 아니다.
//
// 지키려는 성질: ①공용 통로가 백틱·이모지에서 자리를 안 밀린다 ②그 통로를 쓰는 세 읽는이가
// 실제로 안 밀린다(보드 200자 가드 · 인계문 상태 칸 · 트랙 충돌 파일 칸) ③옛 통로가 다시 안 생긴다.
//
// 왜 세 곳을 한 파일에서 재나 — 원인이 한 줄짜리 하나이고 새는 방향이 셋 다 「통과」라서다.
// 사연·실측은 tools/lib/표.js 머리말.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* 주석 제거는 통로가 하나다 — 지역 사본은 저마다 다르게 틀린다(F401·#Q114). */
const { 코드만 } = require('./lib/소스검사.js');

const { 훅띄우기 } = require('./lib/훅띄우기.js');
const 표 = require('../tools/lib/표.js');
const { boardTrack } = require('../.claude/hooks/lib/session-report.js');

const ROOT = path.join(__dirname, '..');
const BOARD_GUARD = path.join(ROOT, '.claude', 'hooks', 'board-guard.js');

/* 실사고에서 온 줄 — F193 보드 줄이 상태 칸 안에서 `\|` 를 인용했다. */
const 파이프 = '`2>&1|docs/세션보드.md`';

// ── ① 공용 통로 자체 ────────────────────────────────────────────────
test('칸나누기 — 백틱 안 파이프는 칸막이가 아니다', () => {
  assert.deepEqual(
    표.칸나누기(`| 날짜 | 트랙 | 파일 | 종결 — 장부가 ${파이프} 를 칸으로 셌다 |`),
    ['날짜', '트랙', '파일', `종결 — 장부가 ${파이프} 를 칸으로 셌다`],
  );
});

/* 🔴 백틱 범위가 **뒤에 오는 진짜 칸막이보다 앞**에 있어야 길이 보존을 잰다 —
 * 코드가 마지막 칸에만 있으면 덮은 판이 짧아져도 앞쪽 파이프 자리가 그대로라 통과한다
 * (첫 판이 그렇게 짜여 「길이를 안 지킨다」 변이를 놓쳤다). 보드 줄이 실제로 이 모양이다. */
test('칸나누기 — 코드 범위 뒤에 오는 칸도 안 밀린다 (덮을 때 길이를 지킨다)', () => {
  assert.deepEqual(
    표.칸나누기(`| 날짜 | 트랙 ${파이프} 인용 | 파일 | 상태 |`),
    ['날짜', `트랙 ${파이프} 인용`, '파일', '상태'],
  );
});

test('칸나누기 — 이모지가 앞에 있어도 자리가 안 밀린다 (UTF-16 자리로만 센다)', () => {
  const 칸 = 표.칸나누기(`| 날짜 | 🔴트랙 ${파이프} | 파일 | ✅종결 끝 |`);
  assert.equal(칸.length, 4, '서로게이트 쌍에서 덮은 판과 원문의 자리가 어긋났다');
  assert.equal(칸[3], '✅종결 끝');
});

test('칸안전 — 날 파이프만 치환하고 백틱 안은 남긴다', () => {
  assert.equal(표.칸안전('a | b — 원인은 `x|y`'), 'a / b — 원인은 `x|y`');
});

// ── ② 읽는이 셋 (행동) ─────────────────────────────────────────────
test('🔴 board-guard — 밀린 칸 때문에 200자 초과 상태 칸을 놓치지 않는다', () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pyocan-'));
  const BOARD = path.join(TMP, 'docs', '_ops', '보드', 'sess.md');   // 보드 정본은 세션별 파일(F250)
  fs.mkdirSync(path.dirname(BOARD), { recursive: true });
  fs.writeFileSync(BOARD, ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'].join('\n'), 'utf8');

  /* 상태 칸 하나가 200자를 넘는데, 그 안에 백틱 파이프가 있다. 날 split 으로 가르면
   * 두 조각(각 200자 미만)이 되어 **가드가 조용히 통과시킨다** — 새는 방향이다.
   * 🔑 양쪽을 반씩 나눠야 잰다 — 한쪽에 몰면 그 조각만으로도 200자를 넘어 옛 통로도 막는다. */
  const 긴상태 = `${'가'.repeat(120)} ${파이프} ${'나'.repeat(120)}`;
  const r = 훅띄우기(BOARD_GUARD, {
    input: JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: BOARD, old_string: 'x', new_string: `| 2026-08-07 | 트랙 | Code.js | ${긴상태} |` },
    }),
    encoding: 'utf8',
  });
  assert.ok(r.stdout.trim(), '가드가 아무 말도 안 했다 — 밀린 칸 조각이 200자 밑이라 통과했다');
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('🔴 session-report.boardTrack — 상태 칸이 파이프 자리에서 안 잘린다', () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pyocan-'));
  fs.mkdirSync(path.join(TMP, 'docs', '_ops', '보드'), { recursive: true });
  const 꼬리 = '를 칸으로 세 해소 칸을 못 채웠다';
  fs.writeFileSync(path.join(TMP, 'docs', '_ops', '보드', 'sess.md'), [
    '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |',
    '|---|---|---|---|',
    `| 2026-08-07 | 내 트랙 | tools/friction.js | ✅종결(**5b4cfd3**) — 장부가 ${파이프} ${꼬리} |`,
  ].join('\n'), 'utf8');

  const t = boardTrack(TMP, ['5b4cfd3 커밋 제목'], 'local_deadbeef');
  assert.ok(t, '내 줄을 못 찾았다');
  assert.equal(t.track, '내 트랙', '트랙 칸 자리가 밀렸다');
  assert.ok(t.state.includes(꼬리), '인계문 「상태/다음」이 파이프 자리에서 잘렸다 — 다음 세션이 받는 첫 화면이다');
});

test('🔴 track-collision — 파일 칸 자리에 상태 칸 조각이 오지 않는다', () => {
  /* 훅 전체는 git·세션 환경을 타므로, 훅이 의존하는 **자리 계약**을 여기서 못박는다:
   * 칸나누기는 양끝 파이프를 버리므로 [날짜, 트랙, 파일, 상태] 이고 훅은 칸[1]·칸[2] 를 읽는다. */
  const 줄 = `| 2026-08-07 | 내 트랙 | tools/friction.js · tests/마찰신호.test.js | ✅종결 ${파이프} 끝 |`;
  const 칸 = 표.칸나누기(줄);
  assert.equal(칸[1], '내 트랙');
  assert.ok(칸[2].includes('tests/마찰신호.test.js'), '파일 칸이 밀려 겹침 판정이 엉뚱한 칸을 잰다');
  const 소스 = fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'track-collision.js'), 'utf8');
  assert.match(소스, /트랙: 칸\[1\], 파일칸: 칸\[2\]/, '훅이 읽는 자리가 위 계약과 갈라졌다');
});

// ── ③ 옛 통로 금지 ─────────────────────────────────────────────────
/* 🔑 대상을 **손으로 적지 않는다**(F253 축②). 손 목록이던 시절 `tools/작업본소유자.js` 가
 *   그 목록에 없어서 F119 의 동시 수리 넷에서 통째로 빠졌고, 1년 뒤가 아니라 **다음 날**
 *   보드 선점 탐지가 조용히 오독하는 것으로 드러났다. 새 읽는이가 늘어도 목록은 안 늘어난다 —
 *   즉 새는 방향이 「대상 아님」이고, 그건 가드가 아니라 가드의 모양이다.
 *   그래서 이 절은 tools/ · .claude/hooks/ 의 **모든** .js 를 훑는다: 표를 읽든 안 읽든
 *   이 두 폴더에서 `.split('|')` 은 쓰지 않는다(문자열 alternation 이 필요하면 정규식으로 적는다).
 *   Apps Script 엔진(저장소 루트 `Code.js`·`엔진_*.js`)은 대상이 아니다 — 거기 파이프는
 *   마크다운 표가 아니라 시트 셀 값의 구분자다. */
const 훑는곳 = ['tools', path.join('.claude', 'hooks')];
function js파일들(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((d) => (
    d.isDirectory() ? js파일들(path.join(rel, d.name))
      : (d.name.endsWith('.js') ? [path.join(rel, d.name)] : [])));
}

test('옛 통로 금지 — tools·hooks 어디에도 날 split 으로 되돌아간 자리가 없다', () => {
  const 대상 = 훑는곳.flatMap(js파일들);
  /* 🔴 분모부터 말한다 — 경로가 어긋나 0개를 훑어도 아래 deepEqual 은 초록이다(미실행=통과). */
  assert.ok(대상.length > 40, `훑은 파일이 ${대상.length}개다 — 경로가 어긋나 검사가 안 돌았다`);

  /* 주석·머리말의 인용만 빼고 본다 — 「/ 나 * 가 앞에 없는 줄」로 걸렀더니 옛 통로가
   * `.replace(/^\|/, '')` 의 정규식 슬래시 때문에 주석으로 분류돼 그냥 빠져나갔다(변이 실측). */
  const 코드줄 = (src) => 코드만(src).split('\n');
  const 되돌아간것 = 대상.filter((rel) => 코드줄(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
    .some((l) => l.includes(".split('|')")));
  assert.deepEqual(되돌아간것, [],
    '표를 날 split 으로 가르는 자리가 다시 생겼다 — 백틱 안 파이프에서 칸이 밀리고 새는 방향은 「통과」다');
});
