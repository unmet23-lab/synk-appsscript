// board-guard 훅 회귀 테스트 — 세션보드 비대화 차단 장치가 살아있는지 검사한다.
// 실 세션보드 파일에 의존하지 않는다(임시 디렉터리에 같은 이름의 파일을 만들어 검사).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'board-guard.js');
const LONG = '가'.repeat(260);

// 임시 보드(11줄) — 줄 수 검사가 실제 저장소 상태에 흔들리지 않게 한다
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-'));
const BOARD = path.join(TMP, '세션보드.md');
const ARCHIVE = path.join(TMP, '세션보드_아카이브.md');
/* 🔑 픽스처 줄은 **주인 지문을 달고 있다** — 새 줄에 지문·해시를 요구하는 검사 ③(F165)이
 *   있고, 이 파일의 나머지 검사는 ①칸 길이·②줄 수를 재는 것이라 ③에 걸리면 무엇을 쟀는지
 *   흐려진다. ③ 자체는 아래 전용 검사에서 픽스처로 조준한다. */
const row = (i) => `| 2026-08-01 | 트랙${i} | Code.js \`local_deadbeef\` | 완료 |`;
const activeRow = (i) => `| 2026-08-01 | 트랙${i} | Code.js \`local_deadbeef\` | 작업중 |`;
const table = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...Array.from({ length: n }, (_, i) => row(i))].join('\n');
const activeTable = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...Array.from({ length: n }, (_, i) => activeRow(i))].join('\n');
fs.writeFileSync(BOARD, table(11), 'utf8');

/** env 를 **명시로** 받는다 — 검사 ③(F165)은 세션 id 가 있을 때만 도는데, 그러면 CI 에서
 *  「통과」와 「미실행」이 같은 모양이 된다. 픽스처가 환경을 고정해 그 둘을 가른다. */
const 환경 = (env) => (env ? { ...process.env, ...env } : process.env);

function decide(payload, env) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env: 환경(env) });
  if (!out.trim()) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

/** 차단 사유까지 본다 — 「막았다」만으로는 **왜** 막았는지·안내가 맞는지 못 잰다. */
function 판정(payload, env) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env: 환경(env) });
  if (!out.trim()) return { 결정: 'allow', 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput;
  return { 결정: h.permissionDecision, 사유: String(h.permissionDecisionReason || '') };
}

test('칸 200자 초과는 차단', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: `| 2026-08-01 | 트랙 | Code.js | ${LONG} |` } }),
    'deny'
  );
});

test('정상 길이 1줄 추가는 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: '| 2026-08-01 | 새 트랙 | Code.js | 작업중 (`local_deadbeef`) |' } }),
    'allow'
  );
});

test('전체 18줄 초과 Write는 차단', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: table(20) } }), 'deny');
});

test('완료 줄 16개는 통과 (완료는 전체 상한까지 허용)', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: table(16) } }), 'allow');
});

test('활성 13줄은 전체가 상한 이내여도 차단', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: activeTable(13) } }), 'deny');
});

test('활성 12줄은 통과 (경계값)', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: activeTable(12) } }), 'allow');
});

test('Edit 증분으로 전체 상한을 넘겨도 차단', () => {
  const many = Array.from({ length: 15 }, (_, i) => row(i)).join('\n');
  assert.strictEqual(decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: many } }), 'deny');
});

test('Edit 증분으로 활성 상한을 넘겨도 차단', () => {
  const many = Array.from({ length: 13 }, (_, i) => activeRow(i)).join('\n');
  assert.strictEqual(decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: many } }), 'deny');
});

test('아카이브 파일은 검사 대상이 아니다', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: ARCHIVE, content: `| a | b | c | ${LONG} |` } }), 'allow');
});

test('보드가 아닌 파일은 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: path.join(TMP, 'Code.js'), old_string: 'a', new_string: `| x | y | z | ${LONG} |` } }),
    'allow'
  );
});

/* ── 2026-08-01 실사고 회귀 ────────────────────────────────────────────────
 * 위 케이스들은 전부 new_string을 `|`로 시작하는 **완전한 행**으로 만든다.
 * 그런데 보드를 갱신하는 실제 모양은 **상태 칸 하나만 갈아끼우는 것**이고, 그 조각은
 * `|`로 시작하지 않아 isDataRow를 통과하지 못해 칸 검사가 통째로 건너뛰어졌다.
 * 같은 날 274자(ab2c60d)·213자(aa68ac7) 두 번이 그대로 통과했고 둘 다 사람이 눈으로 잡았다.
 * 아래 4건은 그 구멍을 못박는다 — 실패하면 가드가 다시 죽은 것이다. */

test('[회귀] 상태 칸만 부분 교체해도 200자 초과는 차단 — 실사고 경로', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '완료 |', new_string: `${LONG} |` } }),
    'deny'
  );
});

test('[회귀] 상태 칸만 부분 교체하고 길이가 정상이면 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '완료 |', new_string: '완료 — 라이브 검증까지 끝 |' } }),
    'allow'
  );
});

test('[회귀] 파이프가 전혀 없는 조각으로 칸을 부풀려도 차단', () => {
  // 결과 파일을 계산하므로 조각의 생김새와 무관하게 잡힌다
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '트랙0', new_string: LONG } }),
    'deny'
  );
});

test('[회귀] replace_all 부분 교체도 검사한다', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '완료', new_string: LONG, replace_all: true } }),
    'deny'
  );
});

/* [2026-08-03 회귀] 보드의 실제 표기는 굵은 **완료**인데 판정은 `/^완료/`였다.
 * 그래서 완료 줄이 전부 '활성'으로 세어져 활성 상한이 전체 상한처럼 굳었다 — 실제로 새 세션이
 * 자기 줄을 못 넣고 막혔다. 위 테스트들이 못 잡은 이유가 핵심이다: **아무도 안 쓰는 표기(`완료`)로만
 * 검사했다.** 가드가 지켜야 하는 건 문법이 아니라 사람이 실제로 쓰는 표기다. */
const boldRow = (i) => `| 2026-08-01 | 트랙${i} | Code.js \`local_deadbeef\` | **완료** — 라이브 v9.1${i} |`;
const boldTable = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
  ...Array.from({ length: n }, (_, i) => boldRow(i))].join('\n');

test('[회귀] 굵게 쓴 **완료**도 완료로 센다 — 활성 상한을 잡아먹지 않는다', () => {
  assert.strictEqual(
    decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: boldTable(16) } }),
    'allow',
    '**완료** 16줄이 차단됐다 — 완료 줄이 활성으로 세어지고 있다'
  );
});

test('[회귀] **완료** 보드에 활성 1줄 추가는 통과한다 — 실제로 막혔던 경로', () => {
  const board = boldTable(12) + '\n';
  fs.writeFileSync(BOARD, board, 'utf8');
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: activeRow(99) } }),
    'allow'
  );
  fs.writeFileSync(BOARD, table(11), 'utf8'); // 뒤 테스트를 위해 원복
});

test('[회귀] 미완료는 완료가 아니다 — 장식 제거가 판정을 뒤집으면 안 된다', () => {
  const rows = Array.from({ length: 13 }, (_, i) => `| 2026-08-01 | 트랙${i} | Code.js | **미완료** |`);
  const t = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...rows].join('\n');
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: t } }), 'deny');
});

/* ── 2026-08-04 재발 (F094) ────────────────────────────────────────────────
 * 위 08-03 수리는 장식(`**`)을 떼고 `/^완료/`로 봤다. 그런데 그 뒤 실제 표기는
 * `**✅전량 종결**`·`**✅라이브 [v9.183]**`·`**✅종결**(sha)` 로 갈라졌고 **완료로 시작하지 않는다.**
 * 실측(2026-08-04 실보드 14줄): 옛 판정 활성 **11** vs 새 판정 활성 **3** — 오분류 8건 전부 ✅ 종결 줄.
 * 활성 상한 12 코앞이라 새 세션이 자기 줄을 못 넣었다(이 세션이 그걸 밟았다).
 *
 * 🔑 **같은 자리 2번째**다. 접두를 하나씩 더하는 방식이면 3번째가 반드시 온다 —
 *   원인은 접두가 아니라 「무엇으로 **시작**하는가」로 판정한 것이다. 그래서 어휘 목록으로 바꿨고,
 *   아래 마지막 검사가 **안내와 판정이 갈라지지 않는지**까지 본다(F094 의 재발 원인이
 *   「처방을 따를 수 없어 표기가 갈라진다」이므로, 안내대로 쓴 표기는 반드시 통과해야 한다). */
const 종결표기 = [
  '**✅전량 종결** — ⑥⑦ 검증 + 흔적 정리',
  '**✅라이브 [v9.183]**(82acb6e·양 프로젝트) — 적대 리뷰가 HIGH 3건',
  '**✅종결**(d4cc639) — 파일당 고유 hex 12색 수렴',
  '**✅상담 세트 종결** — 1·2·3·5·10번(5종 6파일)',
  '**완료·라이브 [v9.156]+원격 실행 종결**(5161bd7) — 닫기 9/9',
];
const 표기표 = (문구, n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
  ...Array.from({ length: n }, (_, i) => `| 2026-08-04 | 트랙${i} | Code.js \`local_deadbeef\` | ${문구} |`)].join('\n');

test('[회귀·F094] ✅ 접두가 붙은 종결 줄을 완료로 센다 — 실보드에서 실제로 쓰는 표기 전부', () => {
  for (const 문구 of 종결표기) {
    assert.strictEqual(
      decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 표기표(문구, 16) } }),
      'allow',
      `종결 줄 16개가 차단됐다 — 활성으로 세어지고 있다: ${문구}`
    );
  }
});

test('🔴 [회귀·F094] 활성 어휘가 이긴다 — 「라이브 검증 중」을 완료로 뒤집지 않는다', () => {
  /* 어휘 매칭을 넓히면 반대 방향으로 샌다: 활성 줄이 완료로 세어지면 보드가 **조용히** 늘어난다.
   * 조용한 누수가 시끄러운 누수보다 나쁘므로, 활성 어휘를 우선으로 못박는다. */
  for (const 문구 of ['**✅라이브 검증 중**', '**종결 예정** — 아직 안 끝났다', '**작업중** — 라이브 반영 대기']) {
    assert.strictEqual(
      decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 표기표(문구, 13) } }),
      'deny',
      `활성 13줄인데 통과했다 — 완료로 뒤집혔다: ${문구}`
    );
  }
});

test('🔴 [회귀·F094] 첫 구절만 본다 — 뒤쪽 서술의 완료 어휘가 활성 줄을 뒤집지 않는다', () => {
  /* 상태 칸의 뒤쪽은 **경과 서술**이라 「라이브 반영은 다음 판」·「…로 종결한 트랙을 이어받는다」처럼
   * 완료 어휘가 자연스럽게 섞인다. 전체를 보면 진행 중인 줄이 완료로 세어져 보드가 조용히 늘어난다.
   * (첫 구절에 활성 어휘가 없는 표기를 골랐다 — 활성 어휘가 먼저 잡으면 이 검사가 헛돈다.) */
  assert.strictEqual(
    decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 표기표('**설계만** — 라이브 반영은 다음 판, 종결은 그때', 13) } }),
    'deny',
    '뒤쪽 서술의 완료 어휘를 보고 활성 줄을 완료로 셌다'
  );
});

test('🔴 [회귀·F094] 막을 때 **무엇을 활성으로 셌는지** 보여준다 — 오분류가 보여야 다음이 없다', () => {
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 표기표('**작업중** — 진행 중', 13) } });
  assert.strictEqual(r.결정, 'deny');
  assert.match(r.사유, /지금 활성으로 센 줄/, '무엇을 활성으로 셌는지 안 보여준다 — 08-03·08-04 두 번 다 사람이 대조할 수가 없었다');
  assert.match(r.사유, /트랙0/, '활성 목록에 실제 줄이 안 실렸다');
  assert.match(r.사유, /완료로 세는 표기/, '무엇을 쓰면 되는지 안 알려준다 — 따를 수 없는 처방이 표기를 갈라놓는다');
});

/* ── ③ 주인 표식 (마찰 F165 · 2026-08-07 실사고) ────────────────────────────
 * 지문도 해시도 없는 줄은 인계문이 「내 줄 없음」으로 읽어 다음 세션이 자기 트랙을 잃고,
 * board-move 는 주인 생사를 못 봐 살아있는 세션의 줄을 아카이브로 옮긴다(F146).
 * 환경변수는 **명시로 고정**한다 — 안 하면 CI(비어 있음)와 로컬(있음)의 결과가 갈린다. */
const 나 = { CLAUDE_CODE_HOST_SESSION_ID: 'local_3fd8f6db-8bee-47b1-a3d1-b156f732f5e9' };
const 이름없는줄 = '| 2026-08-07 | 이름없는 트랙 | a.js | 작업중 — 누가 하는지 안 적음 |';

test('🔴 [F165] 지문도 해시도 없는 새 줄은 차단', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n${이름없는줄}` } }, 나);
  assert.strictEqual(r.결정, 'deny', '🔴 주인 없는 줄이 그대로 들어갔다 — F165 가 그대로다');
  assert.match(r.사유, /local_3fd8f6db/, '내 지문을 안 알려준다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)');
});

test('🔴 [F165] 자기 처방 — 차단 사유가 시키는 그대로 쓰면 통과한다', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n${이름없는줄}` } }, 나);
  const 지문 = (r.사유.match(/local_[0-9a-f]{8}/) || [])[0];
  assert.ok(지문, `사유에서 지문을 못 뽑았다: ${r.사유.slice(0, 120)}`);
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n| 2026-08-07 | 이름없는 트랙 | a.js | 작업중 (\`${지문}\`) |` } }, 나),
    'allow', '시킨 대로 썼는데 막힌다'
  );
  // 커밋 해시가 이미 적힌 줄도 통과한다(옛 관행을 깨지 않는다)
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n| 2026-08-07 | 해시 트랙 | a.js | ✅종결(5e5b03f) |` } }, 나),
    'allow', '해시가 적힌 줄까지 막는다'
  );
});

/* 🔴 [2026-08-07 실측] **접두를 뗀 지문**이 「해시」로 통과하던 자리 — F165 가 다른 문으로 재발했다.
 * 상태 칸에 `` `b6cb681a` `` 라고 적으면 이 가드는 hex 8자리를 커밋 해시로 보고 통과시키는데,
 * 읽는 쪽(board-id.줄의지문)은 `local_` 접두가 붙은 것만 지문으로 세서 인계문이 「내 줄 못 찾았다」를 낸다.
 * 쓰는 쪽이 받는 표기가 읽는 쪽보다 넓으면 그 틈은 언제나 **통과**로 샌다(CLAUDE.md 가드 맹점 ③). */
test('🔴 [F165-b] `local_` 접두를 뗀 내 지문은 해시로 쳐 주지 않는다', () => {
  const 접두없음 = '| 2026-08-07 | 접두 뺀 트랙 | a.js | 🔵착수(지문 `3fd8f6db`) |';
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n${접두없음}` } }, 나);
  assert.strictEqual(r.결정, 'deny',
    '🔴 접두 없는 지문이 통과했다 — 가드는 초록인데 인계문은 그 줄의 주인을 못 읽는다');
  assert.match(r.사유, /접두/, '무엇이 틀렸는지(접두) 안 말하면 같은 자리를 또 밟는다');
  // 자기 처방 — 사유가 시키는 대로 접두를 붙이면 통과한다(F103)
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n| 2026-08-07 | 접두 뺀 트랙 | a.js | 🔵착수(지문 \`local_3fd8f6db\`) |` } }, 나),
    'allow', '접두를 붙였는데도 막힌다 — 따를 수 없는 처방이다'
  );
  // 거짓양성 0: **남의** 짧은 해시는 그대로 통과한다(막는 건 내 지문 한 가지뿐이다)
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n| 2026-08-07 | 해시 트랙 | a.js | ✅종결(5e5b03f) |` } }, 나),
    'allow', '🔴 평범한 커밋 해시 줄까지 막았다 — 일상 통로를 막는 가드는 꺼진다'
  );
});

test('🔴 [F165] 상태 칸 갱신은 지문 없이도 통과 — 트랙 칸이 같으면 새 줄이 아니다', () => {
  /* 보드 편집의 가장 흔한 모양이다. 여기서 막으면 가드가 일상 통로를 막는 거짓양성이 된다. */
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(0), new_string: '| 2026-08-01 | 트랙0 | Code.js | ✅종결 — 다음 없음 |' } }, 나),
    'allow', '🔴 상태 갱신을 새 줄로 셌다 — 갱신마다 막힌다'
  );
});

test('🔴 [F165] 세션 id 를 모르는 환경(클라우드·CI)에는 요구하지 않는다', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: row(10), new_string: `${row(10)}\n${이름없는줄}` } }, { CLAUDE_CODE_HOST_SESSION_ID: '' }),
    'allow', '내 지문을 알 수 없는 세션에 지문을 요구했다 — 따를 수 없는 처방이다(F103)'
  );
});

test('🔴 [회귀·F094] 안내와 판정이 갈라지지 않는다 — 안내에 적힌 어휘로 쓰면 반드시 통과한다', () => {
  /* 이 검사가 핵심이다. 훅이 말하는 완료 어휘를 **훅의 출력에서 뽑아** 그대로 써 보고,
   * 그게 실제로 완료로 세어지는지 본다. 목록이 두 곳에 살면 여기서 깨진다. */
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 표기표('**작업중**', 13) } });
  const 어휘 = [...r.사유.matchAll(/「([^」]+)」/g)].map((m) => m[1]);
  const 완료칸 = r.사유.split('활성으로 세는 표기')[0];
  const 완료어휘 = 어휘.filter((w) => 완료칸.includes(`「${w}」`));
  assert.ok(완료어휘.length >= 2, `안내에서 완료 어휘를 못 뽑았다: ${JSON.stringify(어휘)}`);
  for (const w of 완료어휘) {
    assert.strictEqual(
      decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 표기표(`**✅${w}**`, 16) } }),
      'allow',
      `안내가 「${w}」를 완료라 해 놓고 실제로는 활성으로 센다 — 시킨 대로 썼는데 막힌다`
    );
  }
});

/* ── ④ 자리 겹침 — 남이 이미 선언한 트랙을 다시 잡는다 (2026-08-07 실측) ────────
 * 여기서만 **진짜 git 저장소**를 만든다. 선점은 커밋이 아니라 `git diff HEAD` 로만 드러나서
 * (F161), 저장소 없이 재면 훅이 조용히 통과하고 **「통과」와 「미실행」이 같은 모양**이 된다.
 * 위쪽 검사들이 쓰는 BOARD 는 git 밖이라 이 규칙이 안 도는 것이 정상이고, 그래서 탐지 능력은
 * 이 픽스처가 통째로 진다(실저장소는 아래 거짓양성 검사만 본다). */
const GIT = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-git-'));
const GBOARD = path.join(GIT, '세션보드.md');
const 머리 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'].join('\n');
const 기존 = '| 2026-08-07 | 기존 트랙 | tools/기존.js `local_11111111` | ✅종결 |';
/* 남의 **미커밋** 선언 — 실측 그대로다(`82404266` 이 ②-20 을 잡고 3분 뒤 다른 세션이 겹쳤다). */
const 남의줄 = '| 2026-08-07 | **②-20 `/tasks` 가 스냅샷을 통째로 돌려준다** | **SYNK-talk: supabase/functions/tasks/index.ts · tests** | 🔵**착수**(`local_82404266`) |';

let git있음 = true;
try {
  const git = (...a) => execFileSync('git', ['-C', GIT, ...a], { encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync(GBOARD, `${머리}\n${기존}\n`, 'utf8');
  git('init', '-q');
  git('config', 'user.email', 'test@synk.local');
  git('config', 'user.name', 'test');
  git('add', '세션보드.md');
  git('commit', '-qm', 'base', '--no-verify');
  fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${남의줄}\n`, 'utf8'); // 선언은 여기서 미커밋으로만 산다
} catch (_) {
  git있음 = false; // git 이 없는 환경 — skip 으로 **드러낸다**(조용한 통과 금지)
}

/** 남의 줄 아래에 내 줄을 한 줄 붙이는 편집. */
const 붙임 = (내줄) => 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 남의줄, new_string: `${남의줄}\n${내줄}` } }, 나);
const 내줄 = (트랙, 파일) => `| 2026-08-07 | ${트랙} | ${파일} | 🔵**착수**(\`local_3fd8f6db\`) |`;

test('🔴 [④] 남이 잡은 **항목 표식**을 다시 잡으면 막는다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 붙임(내줄('**②-20 — 정답이 학생에게 간다**(같은 항목을 내가 또 판다)', '**SYNK-talk: lib/스냅샷.js**'));
  assert.strictEqual(r.결정, 'deny', '🔴 같은 항목을 두 세션이 각자 파는 것을 통과시켰다 — 중복 구현은 되돌릴 수 없다');
  assert.match(r.사유, /②-20/, '무엇이 겹쳤는지 안 말하면 비켜날 자리를 못 고른다');
  assert.match(r.사유, /local_82404266/, '누가 잡았는지 안 말하면 생사를 확인할 수 없다');
});

test('🔴 [④] 항목 번호가 없어도 **같은 파일**을 선언하면 막는다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 붙임(내줄('**응답에서 정답 빼기**(표식 없는 트랙)', '**SYNK-talk: supabase/functions/tasks/index.ts**'));
  assert.strictEqual(r.결정, 'deny', '🔴 같은 파일을 둘이 고치는 선언이 통과했다 — 커밋에서 부딪친다');
  assert.match(r.사유, /tasks\/index\.ts/, '겹친 경로를 안 보여주면 무엇을 비켜야 할지 모른다');
});

test('🔴 [④·거짓양성] 본문에서 **언급만** 한 표식은 선점이 아니다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 오늘 이 트랙의 보드 줄이 정확히 이 모양이다 — 남의 겹침을 근거로 적으면서 그 번호를 인용한다.
   * 문장 어디서나 표식을 세면 **남을 언급만 해도 막혀서** 가드가 곧 우회 대상이 된다. */
  const r = 붙임(내줄('**보드 선언 겹침을 아무도 안 막는다**(지금 `②-20` 을 두 세션이 각자 판다)', '**appsscript: .claude/hooks/board-guard.js**'));
  assert.strictEqual(r.결정, 'allow', `🔴 인용을 선점으로 셌다 — 남을 언급만 해도 막힌다: ${r.사유.slice(0, 120)}`);
});

/** 남의 선언을 바꿔 끼우고 재 본다(원래 줄로 되돌린다). */
function 남을바꿔(대신, 내것) {
  fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${대신}\n`, 'utf8');
  try {
    return 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 대신, new_string: `${대신}\n${내것}` } }, 나);
  } finally {
    fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${남의줄}\n`, 'utf8');
  }
}

/* 🔴 [④·F203] 장부 번호가 **F099 에서 멈춰 있었다.** 표식을 `F0\d{2}` 로 적어둬서 F100 이후
 *   104개(장부는 그날 F203)가 자리로 안 세졌다 — 파일까지 갈리면 신호가 통째로 0 이 되고,
 *   그때 두 세션이 같은 트랙을 조용히 판다(08-07 실사고: `F123` 을 둘이 나란히 선언).
 *   ⚠ 여기 픽스처가 옛 정규식이 아는 번호(F050·F094)만 쓰던 것이 구멍을 덮은 절반이다.
 *   그래서 **번호대를 바꿔가며** 잰다 — 자라는 쪽은 늘 F0NN 밖이다. */
for (const 번호 of ['F094', 'F123', 'F203']) {
  test(`🔴 [④·F203] 남이 잡은 장부 번호 \`${번호}\` 는 파일이 갈려도 자리다`, { skip: git있음 ? false : 'git 없음' }, () => {
    const 남 = `| 2026-08-07 | **${번호} — 남이 먼저 잡은 트랙** | **appsscript: tools/남의파일.js** | 🔵**착수**(\`local_82404266\`) |`;
    const r = 남을바꿔(남, 내줄(`**${번호} — 내가 또 잡는다**`, '**appsscript: tools/내파일.js**'));
    assert.strictEqual(r.결정, 'deny', `🔴 \`${번호}\` 를 자리로 안 셌다 — 같은 트랙을 두 세션이 각자 판다(중복 구현은 되돌릴 수 없다)`);
    assert.match(r.사유, new RegExp(번호), '무엇이 겹쳤는지 안 말하면 비켜날 자리를 못 고른다');
  });
}

test('🔴 [④·거짓양성] 홑 이름은 자리로 안 센다 — `Code.js` 는 규약상 병행 가능하다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* CLAUDE.md 가 「`Code.js` 는 함수·열 구역이 안 겹치면 병행 가능」이라고 못박았다. 경로 없는
   * 홑 이름을 자리로 세면 그 병행이 통째로 막히고, `index.ts` 는 저장소에 7벌이라 더 나쁘다. */
  const 남 = '| 2026-08-07 | **엔진 열 추가** | **Code.js** | 🔵**착수**(`local_82404266`) |';
  const r = 남을바꿔(남, 내줄('**출석 함수 손보기**(다른 구역)', '**Code.js**'));
  assert.strictEqual(r.결정, 'allow', `🔴 홑 이름을 자리로 셌다 — 규약이 허용한 병행을 막는다: ${r.사유.slice(0, 120)}`);
});

test('🔴 [④·거짓양성] 공용 장부는 자리가 아니다 — 모든 세션이 규약상 만진다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 남 = '| 2026-08-07 | **F196 채번** | **appsscript: docs/세션보드.md · docs/_ops/마찰신호.md** | 🔵**착수**(`local_82404266`) |';
  const r = 남을바꿔(남, 내줄('**전혀 다른 트랙**', '**appsscript: docs/세션보드.md · docs/_ops/마찰신호.md**'));
  assert.strictEqual(r.결정, 'allow', `🔴 보드·장부 겹침을 충돌로 셌다 — 매 세션 막혀서 가드가 곧 꺼진다: ${r.사유.slice(0, 120)}`);
});

test('🔴 [④] ✅종결한 남의 줄은 자리를 잡고 있는 게 아니다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 끝난줄 = 남의줄.replace('🔵**착수**', '✅**종결**');
  fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${끝난줄}\n`, 'utf8');
  try {
    const r = 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 끝난줄, new_string: `${끝난줄}\n${내줄('**②-20 이어받기**', '**SYNK-talk: supabase/functions/tasks/index.ts**')}` } }, 나);
    assert.strictEqual(r.결정, 'allow', `🔴 치우기를 기다리는 완료 줄이 자리를 계속 잡았다: ${r.사유.slice(0, 120)}`);
  } finally {
    fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${남의줄}\n`, 'utf8');
  }
});

test('🔴 [④·F103] 차단 사유가 시키는 대로 비켜나면 통과한다', { skip: git있음 ? false : 'git 없음' }, () => {
  assert.strictEqual(붙임(내줄('**②-20 다시 잡기**', '**SYNK-talk: supabase/functions/tasks/index.ts**')).결정, 'deny');
  const r = 붙임(내줄('**F196 — 폰 세션 채번**(다른 트랙으로 비켜났다)', '**appsscript: tools/friction.js · tests/마찰신호.test.js**'));
  assert.strictEqual(r.결정, 'allow', `🔴 비켜났는데도 막힌다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다: ${r.사유.slice(0, 120)}`);
});

test('🔴 [④·거짓양성] 상태 칸 갱신은 남의 선언이 있어도 통과한다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 보드 편집의 대부분이 이 모양이다. 여기서 막으면 가드가 일상 통로를 막는다. */
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 기존, new_string: 기존.replace('✅종결', '🔵작업중') } }, 나);
  assert.strictEqual(r.결정, 'allow', `🔴 상태 갱신을 새 선언으로 셌다: ${r.사유.slice(0, 120)}`);
});
