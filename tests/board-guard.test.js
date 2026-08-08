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

/** 판정을 **한 곳에서만** 만든다 — 두 도우미가 각자 출력을 읽으면 갈라지고, 갈라진 쪽은
 *  조용히 틀린다(CLAUDE.md 신뢰성 ④). decide 는 판정의 얇은 껍데기다. */
function decide(payload, env) {
  return 판정(payload, env).결정;
}

/** 차단 사유까지 본다 — 「막았다」만으로는 **왜** 막았는지·안내가 맞는지 못 잰다.
 *  `cwd` 는 **상대경로 입력**을 재기 위한 자리다(F204) — 상대경로는 실행 위치에서 풀린다. */
function 판정(payload, env, cwd) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env: 환경(env), ...(cwd ? { cwd } : {}) });
  if (!out.trim()) return { 결정: 'allow', 사유: '', 알림: '' };
  const j = JSON.parse(out);
  const h = j.hookSpecificOutput || {};
  /* 🔑 `permissionDecision` 이 없는 출력은 **알림만** 낸 것이다(F235 수리) — 결정이 없으면 통과다.
   *   그대로 `undefined` 를 돌려주면 「통과」가 두 모양(빈 출력 · 알림 출력)이 되고, 검사가
   *   그 중 하나만 알면 새는 방향으로 조용히 틀린다. 여기서 한 모양으로 모은다. */
  return { 결정: h.permissionDecision || 'allow', 사유: String(h.permissionDecisionReason || ''), 알림: String(j.systemMessage || '') };
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

/* ── ④ 커밋 여부는 자리를 안 바꾼다 (F203 의 진짜 원인) ──────────────────────
 * 첫 판은 재료가 `git diff HEAD` 뿐이라 **커밋된 착수 선언이 안 보였다.** 이 저장소는 보드를
 * 상시 커밋하므로(지나가는 세션이 남의 줄까지 동승시킨다) 보호 창이 「다음 커밋까지」였다.
 * 실측 08-07: `d2453563` 의 F123 선언이 `ceab9d3` 로 커밋된 **뒤에** `41ae1a64` 가 같은 F123 을
 * 선언했고 ④ 는 조용했다. 그래서 여기서만 남의 줄을 **커밋해 두고** 잰다. */
function 커밋된판(남의줄들, 편집, { 상대로 = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-committed-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  const b = path.join(dir, 'docs', '세션보드.md');
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync(b, `${머리}\n${기존}\n${남의줄들.join('\n')}\n`, 'utf8');
  g('init', '-q'); g('config', 'user.email', 'test@synk.local'); g('config', 'user.name', 'test');
  g('add', '.'); g('commit', '-qm', '보드: 착수 선언들', '--no-verify');
  const 경로 = 상대로 ? 'docs/세션보드.md' : b;
  try {
    return 판정({ tool_name: 'Edit', tool_input: { file_path: 경로, ...편집 } }, 나, 상대로 ? dir : undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('🔴 [④·F203] **커밋된** 착수 선언도 자리다 — 보드는 상시 커밋된다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 커밋된판([남의줄], { old_string: 남의줄, new_string: `${남의줄}\n${내줄('**②-20 — 내가 또 판다**', '**SYNK-talk: lib/스냅샷.js**')}` });
  assert.strictEqual(r.결정, 'deny', '🔴 남의 선언이 커밋되는 순간 자리가 풀렸다 — 보호 창이 「보드가 다음에 커밋될 때까지」다');
  assert.match(r.사유, /local_82404266/, '누가 잡았는지 안 말하면 생사를 확인할 수 없다');
});

test('🔴 [④·거짓양성] 내가 커밋해 둔 **내 줄**은 나를 막지 않는다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 내옛줄 = 내줄('**②-20 어제 잡아둔 내 트랙**', '**SYNK-talk: supabase/functions/tasks/index.ts**');
  const r = 커밋된판([내옛줄], { old_string: 내옛줄, new_string: `${내옛줄}\n${내줄('**②-20 이어서 다른 각도**', '**SYNK-talk: lib/스냅샷.js**')}` });
  assert.strictEqual(r.결정, 'allow', `🔴 내 줄이 나를 막았다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다: ${r.사유.slice(0, 120)}`);
});

/* 🔴 [④·F204 · 옆 세션 `27ada329` 실측 인계] `file_path` 가 **상대경로**로 들어오면 ④ 가 통째로
 *   꺼져 있었다 — 첫 판의 `git -C <dirname> diff HEAD -- <상대경로>` 가 경로를 두 번 풀어
 *   `docs/docs/세션보드.md` 를 찾았고, git 은 오류가 아니라 **빈 결과(status 0)** 를 냈다.
 *   「남의 선언 0건」과 「못 쟀다」가 같은 모양이 된 자리다. 지금은 git 을 안 부르니 원인이 없다. */
for (const 상대로 of [false, true]) {
  test(`🔴 [④·F204] 보드 경로가 ${상대로 ? '**상대**' : '절대'}경로여도 자리를 본다`, { skip: git있음 ? false : 'git 없음' }, () => {
    const r = 커밋된판([남의줄], { old_string: 남의줄, new_string: `${남의줄}\n${내줄('**②-20 — 내가 또 판다**', '**SYNK-talk: lib/스냅샷.js**')}` }, { 상대로 });
    assert.strictEqual(r.결정, 'deny', `🔴 ${상대로 ? '상대' : '절대'}경로에서 ④ 가 꺼졌다 — 꺼진 가드와 「겹침 없음」은 같은 모양이다`);
  });
}

test('🔴 [④·F103] 죽은 세션의 줄이면 **치우는 법**을 알려준다 (막기만 하면 우회한다)', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 커밋된판([남의줄], { old_string: 남의줄, new_string: `${남의줄}\n${내줄('**②-20 — 내가 또 판다**', '**SYNK-talk: lib/스냅샷.js**')}` });
  assert.match(r.사유, /board-move/, '치우는 명령을 안 주면 죽은 세션의 줄이 그 자리를 영영 잠근다');
});

test('🔴 [④·거짓양성] 상태 칸 갱신은 남의 선언이 있어도 통과한다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 보드 편집의 대부분이 이 모양이다. 여기서 막으면 가드가 일상 통로를 막는다. */
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 기존, new_string: 기존.replace('✅종결', '🔵작업중') } }, 나);
  assert.strictEqual(r.결정, 'allow', `🔴 상태 갱신을 새 선언으로 셌다: ${r.사유.slice(0, 120)}`);
});

/* ── ② 만석 처방은 **그대로 실행되는가** (F103 맹점 ③ · 2026-08-07 실측) ─────────────
 * ②는 오래 「오래된 완료 줄부터 옮겨라」만 냈다 — 어느 줄인지도, board-move 에 줄 문구도
 * 없이. 문구 고르기는 손일이고(부분문자열 유일 매칭 · 굵게·백틱·「」가 섞여 셸에서도 깨진다)
 * 그래서 아무도 안 치우고 만석이 유지돼 **다음 세션이 선언을 못 한다.** 실측: 그 자리에서
 * 선언이 막혔고, 손으로 고른 문구 2개 중 1개가 빗나갔다. ①(활성 상한)은 이미 목록을 냈다.
 *
 * 🔑 매칭을 여기서 **재현하지 않는다** — 처방을 board-move 에 그대로 되먹인다. 같은 판정을
 *   두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 「처방대로 했는데 못 찾는다」다. */
const MOVE = path.join(__dirname, '..', 'tools', 'board-move.js');

/* ⚠ 추출은 **줄 단위**다. 처음엔 `board-move\.js "([^"]+)"` 로 뽑았는데, 문구 안에 `"` 가
 *   남으면 정규식이 거기서 끊겨 **위반을 스스로 지운다** — 아래 따옴표 변이가 그래서 초록이었다.
 *   가드는 자기 전처리에도 눈이 먼다(CLAUDE.md 가드 맹점). 양끝 인용만 벗기고 안쪽은 그대로 본다. */
const 처방문구 = (사유) => 사유.split('\n')
  .filter((l) => l.includes('board-move.js '))
  .map((l) => l.slice(l.indexOf('board-move.js ') + 'board-move.js '.length).trim().replace(/^"|"$/g, ''));

test('🔴 만석 처방을 board-move 가 실제로 집는다 — 따를 수 없는 처방은 처방이 아니다 (F103)', () => {
  const 판 = table(20);
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 판 } });
  assert.strictEqual(r.결정, 'deny');
  const 문구 = 처방문구(r.사유);
  assert.ok(문구.length >= 3,
    `처방에 실행할 명령이 ${문구.length}개뿐이다 — 「옮겨라」만 남으면 아무도 안 옮긴다:\n${r.사유}`);

  const 픽 = fs.mkdtempSync(path.join(os.tmpdir(), 'boardmove-'));
  fs.writeFileSync(path.join(픽, 'b.md'), 판, 'utf8');
  fs.writeFileSync(path.join(픽, 'a.md'), '# 아카이브\n\n---\n', 'utf8');
  /* 던지는 형태로 띄운다 — 반환형(`spawnSync(process.execPath …)`)은 미실행을 「통과」로
   * 읽는 옛 통로라 이 저장소가 파일 단위로 금지한다(tests/훅통로.test.js). */
  for (const needle of 문구) {
    try {
      execFileSync(process.execPath, [MOVE, '--dry', needle], {
        encoding: 'utf8', stdio: 'pipe',
        env: { ...process.env, SYNK_BOARD: path.join(픽, 'b.md'), SYNK_BOARD_ARCHIVE: path.join(픽, 'a.md') },
      });
    } catch (e) {
      assert.fail(`처방이 준 문구를 board-move 가 못 쓴다: "${needle}"\n${e.stderr || e.message}`);
    }
  }
  fs.rmSync(픽, { recursive: true, force: true });
});

/* 🔑 픽스처는 **더러운 줄을 앞에** 둔다 — 트랙 칸이 공통 머리말로 시작해 따옴표·백틱 뒤에서야
 *   갈리는 판이다. 자르지 않으면 그 글자가 needle 에 들어가고, 자르면 그 줄은 유일 문구가 없어
 *   처방에서 빠진다(뒤의 깨끗한 줄이 대신 나온다). 깨끗한 줄만 있는 판으로는 두 동작이 같은
 *   모양이라 **변이가 안 잡힌다** — 실제로 첫 판이 그래서 초록이었다. */
test('🔑 처방 문구에 셸을 깨는 글자가 없다 — 따옴표·백틱 앞에서 자른다', () => {
  const 꾸민 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
    ...Array.from({ length: 5 }, (_, i) => `| 2026-08-01 | 공통 머리말 "${i}" 꼬리 | Code.js | 완료 |`),
    ...Array.from({ length: 5 }, (_, i) => `| 2026-08-01 | 공통 머리말 \`b${i}\` 꼬리 | Code.js | 완료 |`),
    ...Array.from({ length: 10 }, (_, i) => `| 2026-08-01 | **깨끗한 트랙 ${i} 이름** | Code.js | 완료 |`)].join('\n');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 꾸민 } });
  const 문구 = 처방문구(r.사유);
  assert.ok(문구.length >= 3,
    `유일 문구가 없는 줄이 앞에 있다고 처방이 비었다(${문구.length}개) — 뒤의 깨끗한 줄이 나와야 한다:\n${r.사유}`);
  for (const n of 문구) assert.ok(!/["`]/.test(n), `처방 문구에 셸을 깨는 글자가 남았다: ${n}`);
});

/* ── 🔴 F221 — ④ 가 **두 방향으로 다** 샜다 (2026-08-08 실측) ─────────────────
 * 위 ④ 검사들은 전부 「겹치면 막는가」만 봤다. 실제로 새던 자리는 그 바깥 둘이었다:
 *   ⓐ **거짓통과** — ①②(칸·줄수)가 먼저 `deny` 하고 끝내서, **만석이면 ④ 가 침묵**한다.
 *      비대칭이 뿌리다: 만석은 되돌릴 수 있는 불편이고 겹침은 되돌릴 수 없는 손해인데
 *      되돌릴 수 있는 쪽이 앞을 막았다. 만석은 이 저장소의 일상이라(F224) 창이 넓다.
 *   ⓑ **거짓차단** — 「만지는 파일」 칸의 `🚫경로=남세션`(=안 만진다는 명시)을 선점으로 셌다.
 *      비켜났다고 적을수록 막히니 사람이 그 표기를 지워서 통과시킨다 — 우회가 정상 통로가 된다(F103).
 * 둘 다 오늘 내 선언에서 실측됐다: 만석에만 막혀 「0분 전 남이 같은 트랙」을 못 들었고,
 * 다음 시도는 `🚫tools/board-move.js=local_0a3a2a04` 를 적었다는 이유로 막혔다.  */

test('🔴 [F221·ⓐ] 만석이어도 **겹침을 먼저** 말한다 — 되돌릴 수 없는 쪽이 앞이다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 완료 줄로 채워 전체 상한(18)만 넘긴다 — 활성 상한은 안 건드려야 무엇이 가렸는지가 한 갈래로 남는다. */
  const 채움 = Array.from({ length: 17 }, (_, i) => `| 2026-08-01 | 채움${i} | tools/채움${i}.js \`local_99999999\` | ✅종결 |`).join('\n');
  fs.writeFileSync(GBOARD, `${머리}\n${채움}\n${남의줄}\n`, 'utf8');
  try {
    const 겹치는내줄 = 내줄('**②-20 — 같은 항목을 내가 또 판다**', '**SYNK-talk: lib/스냅샷.js**');
    const r = 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 남의줄, new_string: `${남의줄}\n${겹치는내줄}` } }, 나);
    assert.strictEqual(r.결정, 'deny', '겹침도 만석도 있는데 통과했다');
    assert.match(r.사유, /남이 이미 선언했다/,
      `🔴 만석 사유가 겹침을 가렸다 — 줄을 옮기면 풀리는 불편이 중복 구현을 덮었다:\n${r.사유.slice(0, 200)}`);
    assert.match(r.사유, /local_82404266/, '누가 잡았는지 안 말하면 생사를 확인할 수 없다');
  } finally {
    fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${남의줄}\n`, 'utf8');
  }
});

test('🔴 [F221·ⓐ] 겹침이 없으면 만석은 그대로 막는다 — 순서만 바꿨지 힘을 안 뺐다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 채움 = Array.from({ length: 17 }, (_, i) => `| 2026-08-01 | 채움${i} | tools/채움${i}.js \`local_99999999\` | ✅종결 |`).join('\n');
  fs.writeFileSync(GBOARD, `${머리}\n${채움}\n${남의줄}\n`, 'utf8');
  try {
    const 안겹치는내줄 = 내줄('**전혀 다른 트랙**', '**appsscript: tools/전혀다른.js**');
    const r = 판정({ tool_name: 'Edit', tool_input: { file_path: GBOARD, old_string: 남의줄, new_string: `${남의줄}\n${안겹치는내줄}` } }, 나);
    assert.strictEqual(r.결정, 'deny', '🔴 보류로 미룬 만석 사유가 통째로 사라졌다 — 순서를 바꾸며 검사를 껐다');
    assert.match(r.사유, /상한 18줄/, `만석 사유가 아니라 딴 것이 나왔다:\n${r.사유.slice(0, 200)}`);
  } finally {
    fs.writeFileSync(GBOARD, `${머리}\n${기존}\n${남의줄}\n`, 'utf8');
  }
});

/* 🔴 보류는 **미룬 사유**라, 중간에 조용히 빠져나가는 문이 있으면 그 사유가 통째로 사라진다.
 * 즉시 `deny` 였을 때는 없던 실패 모드고, 새는 방향은 언제나 「통과」다. 변이 시험이 이 자리를
 * 회귀 공백으로 지목했다(다른 어떤 검사도 안 울었다) — 수리와 같은 커밋에 못 박는다. */
test('🔴 [F221] 보드 파일을 못 읽어도 ①의 보류를 삼키지 않는다', () => {
  const 없는보드 = path.join(TMP, '없는폴더', '세션보드.md');
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 없는보드, old_string: 'x', new_string: `| 2026-08-01 | 트랙 | Code.js | ${LONG} |` } });
  assert.strictEqual(r.결정, 'deny',
    '🔴 파일을 못 읽는다는 이유로 칸 초과가 통과했다 — 미룬 사유가 조용히 버려지는 문이다');
});

test('🔴 [F221·ⓑ] 「만지는 파일」 칸의 `🚫경로` 는 안 만진다는 명시지 선점이 아니다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 붙임(내줄('**다른 트랙 — 남의 자리는 비켜났다**',
    '**appsscript: .claude/hooks/board-guard.js**(🚫supabase/functions/tasks/index.ts=`local_82404266` · 🚫보드 외 docs)'));
  assert.strictEqual(r.결정, 'allow',
    `🔴 비켜났다고 적었더니 막혔다 — 관습을 정직하게 쓸수록 벌받으면 사람은 표기를 지운다(F103):\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F221·ⓑ] `🚫` 하나가 **같은 칸의 진짜 선언**까지 면제하지 않는다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 전처리에 눈이 머는 자리 — 칸에 `🚫` 가 있다고 통째로 건너뛰면 `🚫` 만 적으면 무사통과가 된다. */
  const r = 붙임(내줄('**진짜로 같은 파일을 판다**',
    '**SYNK-talk: supabase/functions/tasks/index.ts** · 🚫보드 외 docs'));
  assert.strictEqual(r.결정, 'deny', '🔴 `🚫` 한 조각이 칸 전체를 면제시켰다 — 우회 주문이 생겼다');
  assert.match(r.사유, /tasks\/index\.ts/, '겹친 경로를 안 보여주면 무엇을 비켜야 할지 모른다');
});

/* ── F233·F234·F235·F237 — ① 은 **내가 바꾼 줄만** 막는다 ────────────────────────
 * 하루에 네 번 신고된 자리다(F237 은 F235 의 중복 신고). 남의 활성 줄 하나가 200자를 넘으면
 * 그 순간부터 **아무 세션도 자기 줄을 못 고쳤다** — 내 칸이 통과해도 막힌다. 처방문은
 * 「문장을 줄이거나 아카이브로 옮겨라」인데 줄일 대상이 남의 미커밋 줄이라 F073 이 금지한다.
 * 따를 수 있는 처방이 하나도 없어서(F103 축) 실제로 **갱신 포기**가 났다: 소급불가 ①-2 는
 * 종결됐는데 보드 줄은 4회 연속 차단돼 「🔵착수」로 커밋됐고, 다음 세션이 끝난 트랙을
 * 이어받으려 했다 — 인계 3통로 중 보드 줄이 끊긴 것이다.
 *
 * 🔑 아래 다섯 검사는 **조건을 하나씩만** 바꾼다(사고 · 탐지력 · 우회문 · 알림 · 폴백 방향).
 *   특히 둘째와 셋째가 짝이다 — 재는 범위를 좁히는 수리는 탐지력을 깎거나 우회문을 열기 쉽다. */
const 남의과길이줄 = `| 2026-08-08 | **남의 트랙 XYZ** | docs/기타.md \`local_03d66152\` | ✅${'정본 박음 — '.repeat(30)} |`;
const 내줄F235 = (상태) => `| 2026-08-08 | **내 트랙 되듣기** | SYNK-talk: src/말하기화면.js \`local_deadbeef\` | ${상태} |`;

/** 남의 과길이 줄 + 내 짧은 줄이 함께 있는 보드. 매번 새 임시 파일이라 검사끼리 안 섞인다. */
function 섞인보드(남의줄 = 남의과길이줄, 상태 = '🔵착수') {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'boardf235-')), '세션보드.md');
  fs.writeFileSync(p, ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', 남의줄, 내줄F235(상태), ''].join('\n'), 'utf8');
  return p;
}

test('🔴 [F235] 남이 넣어둔 200자 초과 칸이 **내 줄 갱신을 막지 않는다**', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 섞인보드(), old_string: '🔵착수', new_string: '✅종결 (`local_deadbeef`)' } });
  assert.strictEqual(r.결정, 'allow',
    `🔴 F235 재발 — 남의 칸 때문에 내 종결 줄이 막혔다. 처방은 남의 줄을 줄이라는 것이고 F073 이 그걸 금지한다(따를 수 있는 처방이 0):\n${r.사유.slice(0, 300)}`);
});

test('🔴 [F235] 그래도 **내가** 만든 200자 초과는 그대로 막는다 (탐지력)', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 섞인보드(), old_string: '🔵착수', new_string: LONG } });
  assert.strictEqual(r.결정, 'deny', '🔴 재는 범위를 좁히다가 탐지력을 통째로 껐다 — 200자 규칙이 사라졌다');
  assert.match(r.사유, /칸 길이 초과/, `칸 길이가 아니라 딴 사유로 막혔다:\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F235] 남의 줄이라도 **이 편집이** 길게 만들면 막는다 (면제가 우회문이 되지 않는다)', () => {
  const 남짧은 = '| 2026-08-08 | **남의 트랙 XYZ** | docs/기타.md `local_03d66152` | ✅종결 |';
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 섞인보드(남짧은), old_string: '✅종결 |', new_string: `${LONG} |` } });
  assert.strictEqual(r.결정, 'deny',
    '🔴 「남의 줄이면 면제」로 새게 만들었다 — 남의 줄에 본문을 쏟으면 통과하는 우회가 열렸다');
});

test('🔴 [F235] 이미 있던 과길이 칸을 **조용히 넘기지 않는다** — 주인과 함께 알린다', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 섞인보드(), old_string: '🔵착수', new_string: '✅종결 (`local_deadbeef`)' } });
  assert.strictEqual(r.결정, 'allow', '이 검사는 통과하는 자리에서 알림을 재는 것이다');
  assert.match(r.알림, /03d66152/,
    `🔴 알림에 주인이 없다 — 조율할 상대를 모르면 아무도 못 치우고, 차단을 뺀 자리에 침묵만 남는다(F237 처방②):\n${r.알림.slice(0, 200)}`);
  assert.match(r.알림, /막지 않았다/, '차단이 아니라는 것을 말해야 한다 — 안 그러면 알림이 차단으로 읽힌다');
});

/* ── F234 — ② 도 **내가 늘린 것만** 막는다 ────────────────────────────────────
 * ①과 같은 병이 줄 수 검사에도 있었다: 만석 판을 물려받으면 **줄을 안 늘리는 유지보수 편집**
 * (내 종결 줄 상태 갱신)까지 막혔다. 처방은 「완료 줄을 아카이브로 옮겨라」인데 옮길 완료 줄의
 * 주인이 전부 살아 있으면 board-move 가 원칙⑥으로 거부한다 — 따를 수 있는 처방이 0이 된다.
 * 아래 둘은 조건 하나만 다르다(늘리지 않는 편집 · 늘리는 편집). 탐지력은 둘째가 진다. */
const 만석보드 = (n = 20) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'boardf234-')), '세션보드.md');
  fs.writeFileSync(p, `${table(n)}\n`, 'utf8');
  return p;
};

test('🔴 [F234] 이미 만석인 판에서 **줄을 안 늘리는 갱신**은 통과한다', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 만석보드(), old_string: '| 트랙3 |', new_string: '| 트랙3 종결 |' } });
  assert.strictEqual(r.결정, 'allow',
    `🔴 F234 재발 — 남이 넘겨 놓은 만석 때문에 내 종결 줄 갱신이 막혔다(옮길 완료 줄의 주인이 살아 있으면 처방이 0개다):\n${r.사유.slice(0, 300)}`);
  assert.match(r.알림, /전체 20줄/, '차단을 뺐으면 물려받은 위반을 말은 해야 한다 — 침묵은 상한을 없앤 것과 같다');
});

test('🔴 [F234] 만석에서 **줄을 늘리면** 그대로 막는다 (탐지력)', () => {
  const 판 = 만석보드();
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 판, old_string: row(3), new_string: `${row(3)}\n${row(99)}` } });
  assert.strictEqual(r.결정, 'deny', '🔴 만석 면제가 우회문이 됐다 — 판이 계속 커지는 것을 아무도 안 막는다');
  assert.match(r.사유, /줄이 된다/, `줄 수가 아니라 딴 사유로 막혔다:\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F235] 편집 전 판을 못 읽으면 **전량 차단으로 돌아간다** (폴백이 느슨해지지 않는다)', () => {
  const 없는보드 = path.join(TMP, '없는폴더F235', '세션보드.md');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 없는보드, content: ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', 남의과길이줄, ''].join('\n') } });
  assert.strictEqual(r.결정, 'deny',
    '🔴 이전 판을 못 읽자 전부 「남의 것」으로 세어 과길이가 통과했다 — 폴백이 느슨해지는 쪽이면 그게 곧 구멍이다');
});
