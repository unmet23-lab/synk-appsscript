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
/* 부정 어휘·안내문은 **훅이 쓰는 그 정본**에서 가져온다 — 여기 다시 적으면 두 벌이 되고,
 * 갈라진 쪽의 증상은 「말한 표기가 실제로는 안 통한다」다(F384 가 닫은 바로 그 자리). */
const 보드lib = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));
const LONG = '가'.repeat(260);

/** 보드 정본은 `docs/_ops/보드/<지문>.md` 의 세션별 파일이다(F250) — 픽스처도 그 자리에 만든다.
 *  훅은 이 경로 모양(`/docs/_ops/보드/*.md`)으로 대상을 가리고, 그 위 세 단계를 저장소 루트로 삼아
 *  **남의 세션 파일**을 읽는다. 한 파일에 다 넣던 옛 픽스처는 그 두 가지를 다 못 시험한다. */
function 보드파일(root, 이름) {
  const p = path.join(root, 'docs', '_ops', '보드', `${이름 || 'aaaa1111'}.md`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

// 임시 보드(11줄) — 줄 수 검사가 실제 저장소 상태에 흔들리지 않게 한다
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-'));
const BOARD = 보드파일(TMP);
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
const GBOARD = 보드파일(GIT, 'bbbb2222');
const GBOARD상대 = 'docs/_ops/보드/bbbb2222.md';
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
  git('add', GBOARD상대);
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

/* 🔴 [④·#Q] 대기열 영구 ID — 유호 채택 08-14. 규약이 「집으면 트랙 칸에 그 #Q 를 적는다」라
 *   괄호 속 표기가 곧 선점이다(표식 `머리` 와 달리 칸 어디서든 · 파일이 갈려도 같은 일감이다). */
test('🔴 [④·#Q] 남이 잡은 대기열 ID 는 이름·파일이 전부 갈려도 자리다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 남 = '| 2026-08-07 | **과제선택 7회차 처분**(대기열 #Q49 · 새 선언) | **appsscript: tools/남의파일.js** | 🔵**착수**(`local_82404266`) |';
  const r = 남을바꿔(남, 내줄('**상태 기반 과제 선택 — 전혀 다른 이름**(대기열 #Q49)', '**appsscript: tools/내파일.js**'));
  assert.strictEqual(r.결정, 'deny', '🔴 같은 #Q49 를 두 세션이 각자 판다 — ID 조인의 존재 이유가 통째로 사라진다');
  assert.match(r.사유, /#Q49/, '무엇이 겹쳤는지 안 말하면 비켜날 자리를 못 고른다');
});

test('🔴 [④·#Q·거짓양성] 🚫 스팬의 ID 는 비켜남 명시다 — 자리로 세면 비켜난 쪽이 벌을 받는다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 남 = '| 2026-08-07 | **과제선택 7회차 처분**(대기열 #Q49) | **appsscript: tools/남의파일.js** | 🔵**착수**(`local_82404266`) |';
  const r = 남을바꿔(남, 내줄('**다른 트랙** · 🚫#Q49 — 그 줄은 안 집는다', '**appsscript: tools/내파일.js**'));
  assert.strictEqual(r.결정, 'allow', `🔴 🚫#Q49 를 선점으로 셌다 — 비켜남 표기가 곧 차단 사유가 된다: ${r.사유.slice(0, 120)}`);
});

test('🔴 [④·#Q·거짓양성] `#Q4` 와 `#Q49` 는 다른 자리다 — 접두가 걸리면 한 자리 ID 가 두 자리 전부를 잠근다', { skip: git있음 ? false : 'git 없음' }, () => {
  const 남 = '| 2026-08-07 | **남의 트랙**(대기열 #Q4) | **appsscript: tools/남의파일.js** | 🔵**착수**(`local_82404266`) |';
  const r = 남을바꿔(남, 내줄('**내 트랙**(대기열 #Q49)', '**appsscript: tools/내파일.js**'));
  assert.strictEqual(r.결정, 'allow', `🔴 #Q4 가 #Q49 를 잠갔다: ${r.사유.slice(0, 120)}`);
});

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
  const b = 보드파일(dir, 'cccc3333');
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync(b, `${머리}\n${기존}\n${남의줄들.join('\n')}\n`, 'utf8');
  g('init', '-q'); g('config', 'user.email', 'test@synk.local'); g('config', 'user.name', 'test');
  g('add', '.'); g('commit', '-qm', '보드: 착수 선언들', '--no-verify');
  const 경로 = 상대로 ? 'docs/_ops/보드/cccc3333.md' : b;
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
  const 없는보드 = path.join(TMP, '없는폴더', 'docs', '_ops', '보드', 'aaaa1111.md');
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

/* ── 🔴 F384 — 가드가 **무엇을 부정으로 읽는지 스스로 말한다** (2026-08-13) ──────────
 *
 * 실측(local_c84a3b8a · 2026-08-12): 첫 보드 선언에서 만지지 «않을» 파일을 관례대로 정직하게
 * 적었다가(`⚠남의 산 작업본 \`a\`·\`b\` 무접촉`) 겹침으로 차단됐다. 급소는 차단이 아니라
 * **첫 반응이 그 표기를 지우는 것**이었다 — 가드가 자기가 읽는 부정 표기를 어디에도 안 말했고,
 * 세션에게 남은 길은 정보를 지우는 것뿐이었다(F103 · F221 이 기록해 둔 그 우회의 재발).
 *
 * 그래서 여기서 못박는 것 셋:
 *   ① **말하는 것과 읽는 것이 같다** — 안내문의 모든 표기가 실제로 걷힌다(따를 수 있는 처방).
 *   ② **차단문이 그 안내를 싣는다** — 막힌 자리에서 지우기 말고 다시 쓰는 길이 보여야 한다.
 *   ③ **넓히다 반대로 새지 않는다** — 새 낱말이 「불변식」 같은 다른 뜻까지 먹으면 안 된다.
 */

test('🔴 [F384·①] 안내문이 말하는 부정 표기는 **전부 실제로 걷힌다** — 못 쓰는 처방을 내밀지 않는다', () => {
  const 안내 = 보드lib.비켜남표기안내();
  for (const w of 보드lib.부정어휘) {
    assert.ok(안내.includes(w.보기), `안내문이 "${w.보기}" 를 안 말한다 — 가드가 아는 것을 숨기면 사람은 표기를 지운다`);
    const 칸 = `\`내가판다.js\` · \`남의것.js\` ${w.예}`;
    const 남은 = 보드lib.만지는텍스트(칸);
    assert.ok(!남은.includes('남의것.js'),
      `"${w.예}" 를 안내문에 싣고도 안 걷었다 — 말한 대로 적었는데 또 막히면 그게 F103 이다\n  결과: ${남은}`);
    assert.ok(남은.includes('내가판다.js'), `"${w.예}" 가 **앞의 진짜 자리까지** 먹었다 — 새는 방향이다(F354 ②)`);
  }
});

test('🔴 [F384·탐지] 신고 원문의 「무접촉」과 실측 최다 누락 「불변」이 실제로 걷힌다', () => {
  /* 위 ① 은 **목록을 순회**하므로 낱말이 빠지면 그냥 덜 도는 것이라 못 잡는다 — 실측한 사실은
   * 글자로 못박는다(가드 맹점 ②). 실측 2026-08-13 · 만지는 파일 칸 752개: 무접촉 1 · 불변 8
   * (목록에 이미 있던 「무변경」 7 보다 흔한데 빠져 있었다). */
  assert.ok(!보드lib.만지는텍스트('`내것.js` · `prompts/교정.md` 무접촉').includes('교정.md'),
    '🔴 신고 원문의 표기(무접촉)를 여전히 선점으로 읽는다 — F384 가 그대로 재현된다');
  assert.ok(!보드lib.만지는텍스트('`내것.js` · `lib/라디오.js` 불변').includes('라디오.js'),
    '🔴 「불변」(실측 8건 · 최다 누락)을 선점으로 읽는다');
});

test('🔴 [F384·①] 🚫 도 안내문이 말한다 — 실측에서 4:1 로 지배적인 관례다', () => {
  assert.ok(보드lib.비켜남표기안내().includes(보드lib.금지표식));
});

test('🔴 [F384·②] 겹침 차단문이 **비켜남 표기 안내를 그대로 싣는다**', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 붙임(내줄('**진짜로 같은 파일을 판다**', '**SYNK-talk: supabase/functions/tasks/index.ts**'));
  assert.strictEqual(r.결정, 'deny', '전제가 깨졌다 — 이 픽스처는 겹침으로 막혀야 한다');
  assert.ok(r.사유.includes(보드lib.비켜남표기안내()),
    `🔴 차단문이 「무엇을 부정으로 읽는지」를 안 말한다 — 세션에게 남는 길은 표기를 지우는 것뿐이다(F384)\n${r.사유.slice(-400)}`);
});

test('🔴 [F384·③·거짓양성] 「불변식」은 부정이 아니다 — 낱말을 넓히다 뜻이 다른 자리를 먹지 않는다', () => {
  /* ⚠ 경계를 **정확히** 짚는다: `불변식③` 은 꼬리 글자가 우연히 막아 줘서 넓힌 변이도 통과한다
   *   (실측 — 변이 `불변식?` 이 그 픽스처에서 살아남았다). 꼬리 없는 「교차 불변식」이 진짜 경계다. */
  for (const 칸 of ['`tests/이벤트검증.test.js`(교차 불변식③)', '`tests/이벤트검증.test.js`(교차 불변식)']) {
    const 남은 = 보드lib.만지는텍스트(칸);
    assert.match(남은, /이벤트검증\.test\.js/, `🔴 「불변식」을 「불변」으로 읽어 진짜 자리를 지웠다 — 새는 방향이다: ${칸}`);
    assert.match(남은, /불변식/, `🔴 「불변식」 구절을 부정으로 접었다 — 그건 뜻이 다른 낱말이다: ${칸}`);
  }
});

test('🔴 [F384·③·거짓양성] 새 낱말이 **앞 구절의 경로**를 안 먹는다 — 실제 보드 표기 그대로', () => {
  /* 실측에서 뽑은 모양 둘. 조각 단위로 넓히면 96/303 자리가 함께 떨어진다(그래서 구절 단위다). */
  assert.match(보드lib.만지는텍스트('`docs/SYNK_철학.md`(부록 A 칸 실측 갱신만·게이트 문면 불변)'), /SYNK_철학\.md/);
  assert.match(보드lib.만지는텍스트('**as**: `tools/lib/보드.js`·`tools/보드수거.js`·이 줄 (talk 0 · 배포 0)'), /보드수거\.js/);
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
  const p = 보드파일(fs.mkdtempSync(path.join(os.tmpdir(), 'boardf235-')), 'dddd4444');
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
  /* 알림도 **그대로 실행할 수 있어야** 한다(F103) — 트랙 이름을 손으로 옮겨 적게 하면
   * 따옴표·백틱이 셸을 깬다. 문구는 ②의 이관처방과 같은 통로에서 나온다. */
  const 명령 = (r.알림.match(/board-move\.js "([^"]*)"/g) || []);
  assert.ok(명령.length >= 1, `알림이 「누가」만 말하고 「어떻게 치우나」를 안 줬다:\n${r.알림.slice(0, 300)}`);
  for (const c of 명령) assert.ok(!/[`]/.test(c), `알림의 명령에 셸을 깨는 글자가 남았다: ${c}`);
});

/* ── F234 — ② 도 **내가 늘린 것만** 막는다 ────────────────────────────────────
 * ①과 같은 병이 줄 수 검사에도 있었다: 만석 판을 물려받으면 **줄을 안 늘리는 유지보수 편집**
 * (내 종결 줄 상태 갱신)까지 막혔다. 처방은 「완료 줄을 아카이브로 옮겨라」인데 옮길 완료 줄의
 * 주인이 전부 살아 있으면 board-move 가 원칙⑥으로 거부한다 — 따를 수 있는 처방이 0이 된다.
 * 아래 둘은 조건 하나만 다르다(늘리지 않는 편집 · 늘리는 편집). 탐지력은 둘째가 진다. */
const 만석보드 = (n = 20) => {
  const p = 보드파일(fs.mkdtempSync(path.join(os.tmpdir(), 'boardf234-')), 'eeee5555');
  fs.writeFileSync(p, `${table(n)}\n`, 'utf8');
  return p;
};

test('🔴 [F234] 이미 만석인 판에서 **줄을 안 늘리는 갱신**은 통과한다', () => {
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 만석보드(), old_string: '| 트랙3 |', new_string: '| 트랙3 종결 |' } });
  assert.strictEqual(r.결정, 'allow',
    `🔴 F234 재발 — 남이 넘겨 놓은 만석 때문에 내 종결 줄 갱신이 막혔다(옮길 완료 줄의 주인이 살아 있으면 처방이 0개다):\n${r.사유.slice(0, 300)}`);
  assert.match(r.알림, /셀 수 있는 줄 20줄/, '차단을 뺐으면 물려받은 위반을 말은 해야 한다 — 침묵은 상한을 없앤 것과 같다');
  /* #Q66 의 탐지력 짝 — **진짜** 물려받은 위반은 그 머리글·그 건수로 계속 나와야 한다.
   * 아래 「셈 설명은 위반으로 안 센다」와 짝이고, 가르다 이쪽까지 지우면 여기가 빨개진다. */
  assert.match(r.알림, /물려받은 보드 위반/,
    `🔴 진짜 물려받은 위반이 「위반」 머리글을 잃었다 — 셈 설명과 가르다 이쪽까지 지웠다(#Q66):\n${r.알림.slice(0, 300)}`);
});

test('🔴 [F234] 만석에서 **줄을 늘리면** 그대로 막는다 (탐지력)', () => {
  const 판 = 만석보드();
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 판, old_string: row(3), new_string: `${row(3)}\n${row(99)}` } });
  assert.strictEqual(r.결정, 'deny', '🔴 만석 면제가 우회문이 됐다 — 판이 계속 커지는 것을 아무도 안 막는다');
  assert.match(r.사유, /줄이 된다/, `줄 수가 아니라 딴 사유로 막혔다:\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F235] 편집 전 판을 못 읽으면 **전량 차단으로 돌아간다** (폴백이 느슨해지지 않는다)', () => {
  const 없는보드 = path.join(TMP, '없는폴더F235', 'docs', '_ops', '보드', 'aaaa1111.md');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 없는보드, content: ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', 남의과길이줄, ''].join('\n') } });
  assert.strictEqual(r.결정, 'deny',
    '🔴 이전 판을 못 읽자 전부 「남의 것」으로 세어 과길이가 통과했다 — 폴백이 느슨해지는 쪽이면 그게 곧 구멍이다');
});

/* ── F278 — ②의 처방을 **내기 전에 돌려 본다.** 하나도 안 돌면 첫 선언은 막지 않는다 ────
 * 실사고 2026-08-09 11:03: 새 세션(이 세션)의 첫 선언이 「19줄이 된다」로 막혔고, 딸려 나온
 * 명령 5개 중 하나는 board-move 원칙⑥(주인이 아직 살아 있다)에 걸려 **애초에 실행이 안 됐다.**
 * F278 신고일엔 5개 전부가 그랬다. 그러면 남는 문은 BYPASS 아니면 「선언 포기」뿐이고,
 * 포기는 track-collision 의 첫 처방(보드에서 상대 줄을 읽는다)을 상대편에서 원리상 불가능하게
 * 만든다 — 내 트랙이 보드에 없기 때문이다(F103→F141→F229→F266 과 같은 축).
 *
 * 탐지력은 **여기 픽스처가 진다** — 실저장소는 살아있는 세션이 매 실행마다 달라 초록이 우연이 된다.
 * 세 갈래를 조건 하나씩 바꿔 가른다: ①전부 막힘+첫 선언 ②전부 막힘+내 줄 이미 있음 ③일부만 막힘. */
const { spawnSync: 실행 } = require('child_process');
/* 🔴 박동을 디스크에 쓰는 픽스처다 — 공유 폴더면 남의 sweep 이 지우고 내 가짜 세션이 남의
 *   판정에 섞인다. 사유 전문 = tests/lib/상태격리.js */
const { 격리된store } = require('./lib/상태격리');
const store = 격리된store(__filename);
const hasGit = 실행('git', ['--version'], { encoding: 'utf8' }).status === 0;
const 남세션278 = 'local_f278aaaa-1111-2222-3333-444455556666';
const 내세션278 = 'local_f278bbbb-1111-2222-3333-444455556666';
const 지문278 = (sid) => sid.replace(/^local_/, '').slice(0, 8);
const 새줄278 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;

/** 만석(18줄) 판 + 완료 줄 주인이 **살아 있는** 세션 파일.
 *  원칙⑥의 재료 중 가장 정확한 것이 **파일 이름**(F246)이라 커밋 없이도 판정이 선다.
 *  줄 구성은 활성 11 + 완료 7 = 18 — 내 줄 1개를 더해도 활성 상한(12)에 안 걸려야
 *  **전체 상한(②)만** 재는 실험이 된다(둘을 같이 건드리면 무엇이 막았는지 못 가른다). */
function F278픽스처({ 내줄 = null, 죽은완료 = false, 활성수 = 11, 대기수 = 0, 완료수 = 7 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardf278-'));
  const g = (...a) => 실행('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'a.js'), '// x\n', 'utf8');
  g('add', '--', 'a.js'); g('commit', '-q', '-m', '초기');

  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', '세션보드_아카이브.md'),
    ['# 아카이브', '', '---', '', '| 2026-08-01 | **옛 트랙** | c.js | 완료 |', ''].join('\n'), 'utf8');

  const 완료줄 = ['갑', '을', '병', '정', '무', '기', '경'].slice(0, 완료수).map(
    (n) => `| 2026-08-01 | **완료트랙${n}** | a.js | 완료 (\`local_${지문278(남세션278)}\`) |`);
  const 활성줄 = Array.from({ length: 활성수 },
    (_, i) => `| 2026-08-01 | **활성트랙${i}가** | b${i}.js | 작업중 (\`local_${지문278(남세션278)}\`) |`);
  /* 🔑 F395 — **활성이되 어느 세션도 못 닫는 줄**(과녁이 유호님 답에 있다). 상태 칸의 `⏳` 하나가
   *   가르는 축이고, 낱말(「대기」)은 활성 어휘라 이 줄들은 여전히 «활성»이다(그게 핵심이다). */
  const 대기줄 = Array.from({ length: 대기수 },
    (_, i) => `| 2026-08-01 | **대기트랙${i}가** | w${i}.js | ⏳유호=처분 대기 (\`local_${지문278(남세션278)}\`) |`);
  fs.writeFileSync(보드파일(dir, 지문278(남세션278)), `${[...완료줄, ...활성줄, ...대기줄].join('\n')}\n`, 'utf8');

  /* 주인이 **죽은** 완료 줄 하나 — 이게 있으면 처방이 비지 않으므로 면제가 열려선 안 된다.
   * 파일 이름이 곧 주인이라, 박동을 안 만드는 것만으로 「죽었다」가 된다. */
  if (죽은완료) {
    fs.writeFileSync(보드파일(dir, 'f278dead'),
      '| 2026-08-01 | **죽은주인트랙** | d.js | 완료 (`local_f278dead`) |\n', 'utf8');
  }

  const 내파일 = 보드파일(dir, 지문278(내세션278));
  if (내줄) fs.writeFileSync(내파일, `${내줄}\n`, 'utf8');

  /* 🔴 **board-move 스텁**(F296) — 이 다섯이 재는 것은 board-move 의 *속도*가 아니라
   *   훅이 그 종료 코드를 어떻게 읽는가다. 실물은 후보당 git·보드 조립을 지나 ~2초가 들어,
   *   부하가 높은 CI 에서 훅의 8초 제한을 넘기면 훅이 **다른 사유**를 내고 다섯이 통째로
   *   거짓 적색이 됐다(실측 15,046ms · 주인 없는 적색은 남의 배포 게이트를 막는다).
   *   스텁은 종료 계약만 흉내낸다 — 그 계약이 진짜인지는 아래 [F296] 계약 시험이 실물로 진다.
   * 🔑 부른 문구를 로그에 남긴다 — 이음매 이름이 어긋나 훅이 **실물을 부르면** 로그가 비고,
   *   그러면 이 다섯은 다시 느려진 채 조용히 초록이 된다(미측정을 통과로 세지 않는다). */
  const 스텁 = path.join(dir, 'board-move-stub.js');
  const 스텁로그 = path.join(dir, 'stub.log');
  fs.writeFileSync(스텁, [
    "'use strict';",
    "const fs = require('fs');",
    "const 문구 = process.argv[2] || '';",
    'fs.appendFileSync(process.env.SYNK_STUB_LOG, String(문구) + String.fromCharCode(10));',
    "process.exit(String(문구).includes('죽은주인') ? 0 : 6);",
  ].join('\n'), 'utf8');

  const 최상위 = g('rev-parse', '--show-toplevel').stdout.trim();
  const 박동 = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(남세션278)}.json`);
  fs.mkdirSync(store.stateDir(), { recursive: true });
  fs.writeFileSync(박동, JSON.stringify({ touched: [] }), 'utf8');
  return { dir, 내파일, 박동, 스텁환경: { SYNK_BOARD_MOVE_BIN: 스텁, SYNK_STUB_LOG: 스텁로그 }, 스텁로그 };
}
const 박동치우기 = (p) => { try { fs.unlinkSync(p); } catch (_) { /* 이미 없으면 됐다 */ } };
const 내환경278 = { CLAUDE_CODE_HOST_SESSION_ID: 내세션278 };

/** 스텁이 **실제로 불렸나** — 0건이면 훅이 실물을 불렀다는 뜻이라 이 검사는 공회전이다. */
function 스텁호출수(로그) {
  try { return fs.readFileSync(로그, 'utf8').split('\n').filter(Boolean).length; } catch (_) { return 0; }
}
const 스텁이돌았다 = (로그) => assert.ok(스텁호출수(로그) > 0,
  '🔴 스텁이 한 번도 안 불렸다 — 이음매(SYNK_BOARD_MOVE_BIN)가 끊겼고 훅은 실물을 돌렸다. 이 검사는 다시 부하에 흔들린다(F296)');

/** 🔑 검증이 **답을 못 받은** 판은 초록도 적색도 아니다 — skip 으로 드러낸다(F296 안전판 ①).
 *  본선은 위 스텁이다. 둘 다 있어야 「부하가 판정을 바꾸는」 자리가 남지 않는다.
 *
 *  ⚠ **이 검사가 `스텁이돌았다` 보다 먼저다.** 답을 못 받았다는 것은 스폰이 죽었다는 뜻이라
 *    스텁이 로그를 적기 전에 끊긴다 — 순서를 뒤집으면 「이음매가 끊겼다」는 **엉뚱한 적색**이
 *    뜬다(실측: 제한 1ms 대조에서 여섯이 그 모양으로 깨졌다). 대가는 하나 — 이음매가 끊긴
 *    채로 실물마저 늦은 판은 적색 대신 skip 이 된다. 그건 옳다: 그 판은 아무것도 못 잰다. */
function 미실행이면건너뛴다(t, r) {
  if (!/답을 못 했다/.test(`${r.사유}\n${r.알림}`)) return false;
  t.skip('board-move 검증이 제한 안에 답을 못 했다 — 이 판정은 부하 층이라 못 낸다(F296)');
  return true;
}

test('🔴 [F278] 옮길 수 있는 완료 줄이 0이면 **첫 선언 1줄은 통과한다**', { skip: !hasGit && 'git 없음' }, (t) => {
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처();
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${새줄278}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;   // 🔑 **순서가 뜻이다** — 아래 주석
    스텁이돌았다(스텁로그);
    assert.strictEqual(r.결정, 'allow',
      `🔴 F278 재발 — 새 세션이 자기 트랙을 **선언조차** 못 한다. 처방(board-move)은 주인이 살아 있어 전부 거절되므로 따를 수 있는 문이 0이다:\n${r.사유.slice(0, 400)}`);
    assert.match(r.알림, /첫 선언/, '면제를 조용히 열었다 — 침묵은 상한이 없는 것과 같다');
  } finally { 박동치우기(박동); }
});

test('🔴 [F278] 그래도 **내 줄이 이미 있으면** 새 줄 추가는 막는다 (면제가 우회문이 되지 않는다)', { skip: !hasGit && 'git 없음' }, (t) => {
  const 기존 = `| 2026-08-09 | **내 첫 트랙** | z.js | 완료 (\`local_${지문278(내세션278)}\`) |`;
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 내줄: 기존 });
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존}\n${새줄278}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;   // 🔑 **순서가 뜻이다** — 아래 주석
    스텁이돌았다(스텁로그);
    assert.strictEqual(r.결정, 'deny', '🔴 첫 선언 면제가 「줄을 계속 늘려도 된다」로 번졌다');
    assert.match(r.사유, /첫 선언 1줄/, `막은 이유가 F278 면제 경계라고 말하지 않는다:\n${r.사유.slice(0, 300)}`);
  } finally { 박동치우기(박동); }
});

test('🔴 [F278] 첫 선언이라도 **한 번에 2줄**이면 막는다 (면제는 1줄이다)', { skip: !hasGit && 'git 없음' }, (t) => {
  /* 남의 활성을 10으로 줄인다 — 내 줄 2개를 더해도 활성이 12(상한)라 ①이 먼저 막지 않는다.
   * 조건은 **하나만** 바뀐다(내 줄 1→2). 둘째를 완료로 두면 그 줄 자체가 처방 후보가 되어
   * 「명령이 있어서 막혔다」와 「면제 경계라 막혔다」가 섞인다 — 그래서 둘 다 활성으로 둔다. */
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 활성수: 10 });
  try {
    const 둘째 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${새줄278}\n${둘째}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;   // 🔑 **순서가 뜻이다** — 아래 주석
    스텁이돌았다(스텁로그);
    assert.strictEqual(r.결정, 'deny', '🔴 면제가 「첫 편집이면 몇 줄이든」으로 번졌다 — 판이 계속 커진다');
    assert.match(r.사유, /첫 선언 1줄/, `막은 이유가 F278 면제 경계라고 말하지 않는다:\n${r.사유.slice(0, 300)}`);
  } finally { 박동치우기(박동); }
});

/* ── F278-b — **활성 상한에서도** 같은 구멍이 난다 ────────────────────────────
 * 전체 상한만 열어 두면 판이 활성으로 찰 때 F278 이 그대로 되산다. 활성 상한의 처방 둘은
 * 새 세션에겐 원리상 둘 다 막혀 있다: 「끝난 트랙 상태를 완료로 갱신」=남의 줄(F073 금지),
 * 「내 줄을 합쳐라」=합칠 줄이 없다. 조건 하나만 바꿔 두 갈래를 가른다. */
test('🔴 [F278] 활성이 이미 상한이어도 **첫 선언 1줄은 통과한다**', { skip: !hasGit && 'git 없음' }, (t) => {
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 활성수: 12 });
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${새줄278}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;   // 🔑 **순서가 뜻이다** — 아래 주석
    스텁이돌았다(스텁로그);
    assert.strictEqual(r.결정, 'allow',
      `🔴 활성 축으로 F278 이 되살았다 — 새 세션이 선언조차 못 한다:\n${r.사유.slice(0, 300)}`);
    assert.match(r.알림, /도는 트랙 13줄/, '면제를 조용히 열었다 — 침묵은 상한이 없는 것과 같다');
  } finally { 박동치우기(박동); }
});

test('🔴 [F278] 활성 상한에서 **내 줄이 이미 있으면** 새 활성 줄은 막는다 (탐지력)', { skip: !hasGit && 'git 없음' }, (t) => {
  const 기존 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 내줄: 기존, 활성수: 11 });
  try {
    const 둘째 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존}\n${둘째}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    /* 🔑 여기엔 `스텁이돌았다` 를 안 건다 — 이 검사의 판정은 **활성 상한**이고 그 길은 board-move 를
     *   아예 안 지난다(스텁은 속도 때문에 끼운 것뿐이다). 이음매가 끊겼는지는 board-move 의 답으로
     *   판정하는 다섯이 진다 — 안 재는 자리에 단언을 걸면 그 적색은 무엇을 뜻하는지 알 수 없다. */
    assert.strictEqual(r.결정, 'deny', '🔴 활성 면제가 「계속 늘려도 된다」로 번졌다');
    assert.match(r.사유, /도는 트랙\*{0,2}이 13줄/, `활성 상한이 아니라 딴 사유로 막혔다:\n${r.사유.slice(0, 300)}`);
  } finally { 박동치우기(박동); }
});

/* ── F395 — 상한이 재는 것은 「도는 트랙」이지 「유호님 답이 밀린 줄」이 아니다 ──────────
 * 실측(2026-08-13 · 실보드): 활성 15줄(상한 12)인데 그중 5줄이 `⏳`·`⏸` 였다 — 상표 접수·카피
 * 확정·킷 A/B 처분처럼 **과녁이 저장소 밖**에 있어 어느 세션도 못 닫는 줄이다. 그 줄들이 분모에
 * 있으면 상한은 영구 초과가 되고, 새 세션이 따를 수 있는 처방은 0이 된다(끝난 트랙 상태 갱신 =
 * 남의 줄이라 F073 금지 · 내 줄 합치기 = 합칠 줄이 없다). 가드가 스스로 「따를 수 있는 처방이
 * 없다」고 적어 두었던 자리 = F103 그 모양.
 *
 * 🔑 아래 둘은 **조건 하나만** 다르다(작업중 10 vs 11) — 대기 5줄·완료 0줄·내 줄 1개는 같다.
 *   그래야 통과가 「대기를 뺐기 때문」임이 판정되고, 부수 조건이 바뀌면 대조가 판정을 못 낸다. */
test('🔴 [F395] 활성이 상한을 넘어도 **초과분이 전부 ⏳ 대기면** 새 줄이 통과한다', { skip: !hasGit && 'git 없음' }, (t) => {
  const 기존 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 내줄: 기존, 활성수: 10, 대기수: 5, 완료수: 0 });
  try {
    const 둘째 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존}\n${둘째}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.strictEqual(r.결정, 'allow',
      `🔴 유호님 답이 밀린 줄이 상한을 먹었다 — 세션이 선언을 못 한다(F395):\n${r.사유.slice(0, 400)}`);
    /* 셈에서 빠지는 것과 **말에서 빠지는 것**은 다르다 — 침묵하면 「상한이 헐거워졌다」로 읽힌다. */
    assert.match(r.알림 || '', /대기 5줄/, '대기를 조용히 뺐다 — 뺀 사실이 어디에도 안 보이면 아무도 대기 줄을 안 치운다');
  } finally { 박동치우기(박동); }
});

/* ── F372 — 상한이 재는 것은 「도는 트랙」이지 **「죽은 채 쌓인 줄」**이 아니다 ─────────────
 * F395 와 같은 축의 남은 한 갈래다. 주인이 죽은 줄도 **어느 세션도 못 닫는다**: 남의 활성 줄
 * 편집은 F073 이 금지하고, board-move 는 원칙⑦로 거절하고, `보드수거` 는 완료행만 본다.
 * 실측 2026-08-14(이 수리를 연 자리): 표 18줄 중 주인 죽은 줄 14, 도는 11 중 7이 죽은 주인.
 *
 * 🔑 아래 셋은 **조건 하나씩만** 다르다 — 판이(활성 11·내 줄 1·새 줄 1) 전부 같고 갈리는 것은
 *   박동뿐이다. ㉠내 것만 → 남의 줄은 죽음 ㉡둘 다 → 남의 줄은 삶 ㉢남의 것만 → **생사 못 잼**.
 *   부수 조건이 함께 바뀌면 대조가 판정을 못 낸다(F281). */
function 박동찍기(dir, sid) {
  const 최상위 = 실행('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  const p = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(sid)}.json`);
  fs.mkdirSync(store.stateDir(), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ touched: [] }), 'utf8');
  return p;
}
const 기존372 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
const 둘째372 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;

test('🔴 [F372] 도는 트랙이 상한을 넘어도 **초과분 주인이 죽었으면** 새 줄이 통과한다', { skip: !hasGit && 'git 없음' }, (t) => {
  const { dir, 내파일, 박동, 스텁환경 } = F278픽스처({ 내줄: 기존372, 활성수: 11, 대기수: 0, 완료수: 0 });
  박동치우기(박동);                       // ㉠ 남의 세션은 죽었다
  const 내박동 = 박동찍기(dir, 내세션278);   //    나는 살아 있다 → 생사를 «쟀다»
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존372}\n${둘째372}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.strictEqual(r.결정, 'allow',
      `🔴 죽은 채 쌓인 줄이 상한을 먹었다 — 아무도 못 닫는 줄이라 처방이 0이 된다(F372):\n${r.사유.slice(0, 400)}`);
    assert.match(r.알림 || '', /주인이 죽은 11줄/,
      '죽은 줄을 조용히 뺐다 — 뺀 사실이 안 보이면 「상한이 헐거워졌다」로 읽힌다(F395 가 못박은 축)');
  } finally { 박동치우기(내박동); }
});

test('🔴 [F372] 그 줄들의 주인이 **살아 있으면** 그대로 막는다 (탐지력 — 박동 하나만 다르다)', { skip: !hasGit && 'git 없음' }, (t) => {
  const { dir, 내파일, 박동, 스텁환경 } = F278픽스처({ 내줄: 기존372, 활성수: 11, 대기수: 0, 완료수: 0 });
  const 내박동 = 박동찍기(dir, 내세션278);   // ㉡ 남의 박동(위 `박동`)을 **안 지운다**
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존372}\n${둘째372}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.strictEqual(r.결정, 'deny', '🔴 죽음 제외가 「상한이 사라졌다」로 번졌다 — 산 주인의 줄까지 뺐다');
    assert.match(r.사유, /도는 트랙\*{0,2}이 13줄/, `활성 상한이 아니라 딴 사유로 막혔다:\n${r.사유.slice(0, 300)}`);
  } finally { 박동치우기(내박동); 박동치우기(박동); }
});

/* 🔴 F372 신고문의 ⚠ 그대로 — **생사 측정 실패 시 전량 폴백**. 이 시험이 이 수리의 첫 판을
 * 실제로 잡았다: 픽스처엔 세션 기록이 없어 `세션들()` 이 빈 집합을 주는데, 그것을 「다 죽었다」로
 * 읽어 줄 전부가 빠지고 **상한이 통째로 사라졌다**(deny → allow). 빈 집합은 「다 죽었다」가
 * 아니라 「못 쟀다」다 — 가르는 재료는 나 자신이다(나는 지금 살아 있다). F207 축. */
test('🔴 [F372] **생사를 못 재면** 죽음 제외를 안 한다 — 전량 폴백 (박동 하나만 다르다)', { skip: !hasGit && 'git 없음' }, (t) => {
  const { 내파일, 박동, 스텁환경 } = F278픽스처({ 내줄: 기존372, 활성수: 11, 대기수: 0, 완료수: 0 });
  // ㉢ 내 박동을 **안 찍는다** → 산 세션 집합에 내가 없다 = 그 집합을 못 믿는다
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존372}\n${둘째372}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.strictEqual(r.결정, 'deny',
      '🔴 생사를 못 재는 기계에서 상한이 조용히 풀렸다 — 새는 방향은 언제나 「통과」다(F372 ⚠)');
  } finally { 박동치우기(박동); }
});

/* 🔄 **이 검사는 축이 뒤집혔다** — ✅유호 픽 2026-08-16 ㉮(「규칙 숫자의 뜻을 고친다」).
 *
 * 옛 판정: *「죽은 줄도 전체 상한에서는 그대로 센다 — 안 그러면 보드가 죽은 줄로 무한히 부풀고
 * 치우라 말할 자리가 사라진다」*. 그 걱정 자체는 옳았지만 **전제가 실측으로 틀렸다**: 전체 상한은
 * 그 압력을 지지 못했다. 실측 2026-08-16 — 전체 36줄(도는 1 · 대기 22 · 죽은 11)로 여러 날
 * 만석이었는데 아무도 죽은 줄을 안 치웠다. 상한이 내미는 처방이 「완료 줄을 옮겨라」인데 완료
 * 줄이 0개라 **따를 수 없는 처방**이었기 때문이다(F103). 압력이 아니라 소음이었다.
 *
 * 🔑 그래서 이 자리가 재는 것을 바꾼다 — **「막느냐」가 아니라 「보이느냐」**다. 죽은 줄은 분모에서
 *   빠지되 **그 수를 반드시 소리 내야** 한다. 침묵하면 옛 판정이 걱정하던 바로 그 상태(무한히
 *   부풀고 치우라 말할 자리 없음)가 실제로 온다 — 그때 이 검사가 빨개진다. */
test('🔄 [F372·경계·유호 픽 ㉮] 죽은 줄은 전체 상한에서도 빠진다 — 대신 그 수를 «반드시» 소리 낸다', { skip: !hasGit && 'git 없음' }, (t) => {
  const { dir, 내파일, 박동, 스텁환경 } = F278픽스처({ 내줄: 기존372, 활성수: 11, 대기수: 0, 완료수: 7 });
  박동치우기(박동);                        // 남의 줄 18개(완료 7 + 활성 11) 전부 죽은 주인
  const 내박동 = 박동찍기(dir, 내세션278);
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존372}\n${둘째372}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.notStrictEqual(r.결정, 'deny',
      `🔴 죽은 줄이 전체 상한 분모에 아직 남아 있다 — 유호 픽 ㉮ 가 안 걸렸다(그러면 「완료 줄을 옮겨라」라는 따를 수 없는 처방이 영구로 돌아온다 · F103):\n${(r.사유 || '').slice(0, 300)}`);
    assert.match(String(r.알림 || ''), /죽은\s*\d+\s*줄|주인이 죽은/,
      `🔴 분모에서는 뺐는데 **어디에도 안 세어졌다** — 그러면 보드가 죽은 줄로 무한히 부풀고 치우라 말할 자리가 사라진다(옛 판정이 걱정한 바로 그 상태):\n${(r.알림 || '(알림 없음)').slice(0, 300)}`);
  } finally { 박동치우기(내박동); }
});

test('🔴 [F395] 그래도 **도는 트랙**이 상한을 넘으면 막는다 (탐지력 — 조건 하나만 다르다)', { skip: !hasGit && 'git 없음' }, (t) => {
  const 기존 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 내줄: 기존, 활성수: 11, 대기수: 5, 완료수: 0 });
  try {
    const 둘째 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존}\n${둘째}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.strictEqual(r.결정, 'deny', '🔴 대기 제외가 「상한이 사라졌다」로 번졌다');
    assert.match(r.사유, /도는 트랙\*{0,2}이 13줄/, `활성 상한이 아니라 딴 사유로 막혔다:\n${r.사유.slice(0, 300)}`);
  } finally { 박동치우기(박동); }
});

/* 🔄 **축이 뒤집혔다** — ✅유호 픽 2026-08-16 ㉮. 위 F372 짝(1030행)과 **같은 이유·같은 규격**이다:
 *   대기 줄도 어느 세션도 못 닫는 줄이라(과녁이 저장소 밖 · F395) 분모에서 빠지되, **그 수는
 *   반드시 소리 내야** 한다. 침묵하면 옛 판정이 걱정하던 「대기 줄로만 무한히 부풂」이 실제로
 *   오고, 그때 이 검사가 빨개진다. 재는 것이 「막느냐」에서 「보이느냐」로 옮겨간 자리다. */
test('🔄 [F395·유호 픽 ㉮] 대기 줄은 전체 상한에서도 빠진다 — 대신 그 수를 «반드시» 소리 낸다', { skip: !hasGit && 'git 없음' }, (t) => {
  const 기존 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 내줄: 기존, 활성수: 0, 대기수: 17, 완료수: 0 });
  try {
    const 둘째 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존}\n${둘째}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;
    assert.notStrictEqual(r.결정, 'deny',
      `🔴 대기 줄이 전체 상한 분모에 아직 남아 있다 — 유호 픽 ㉮ 가 안 걸렸다:\n${(r.사유 || '').slice(0, 300)}`);
    assert.match(String(r.알림 || ''), /대기\s*\d+\s*줄/,
      `🔴 분모에서는 뺐는데 **어디에도 안 세어졌다** — 그러면 보드가 대기 줄로만 무한히 부푼다(옛 판정이 걱정한 바로 그 상태):\n${(r.알림 || '(알림 없음)').slice(0, 300)}`);
  } finally { 박동치우기(박동); }
});

/* ── #Q66 — 「왜 통과했나」를 **위반으로 세지 않는다** (F372 잔여 · 2026-08-14) ──────────────
 * F395·F372 가 분모에서 뺀 뒤에도 그 «설명»이 위반 목록에 실려, 모든 세션이 「물려받은 보드
 * 위반 1건」을 안고 시작했다(이 수리를 연 세션이 자기 편집에서 두 번 밟았다). 대기열 #Q66 이
 * 「그 소음 때문에 진짜 초과도 안 읽힌다 — 상한이 있으나 마나」로 적은 자리가 정확히 여기다.
 * 곁들여 위반 목록에 딸린 처방은 뺀 줄에 **원리상 안 듣는다**(⏳ 는 유호님 답이 과녁 · F103).
 *
 * 🔑 아래 둘은 **채널만** 다르다 — 셈도 결정도 안 건드렸다는 것을 같은 픽스처로 못박는다:
 *   ㉠ 뺀 사실은 계속 말한다(침묵하면 「상한이 헐거워졌다」로 읽힌다 · F395 가 세운 축)
 *   ㉡ 그런데 그것이 「위반」 머리글에 세어지면 안 된다.
 * 탐지력 짝은 위 F234 시험(`/셀 수 있는 줄 20줄/`)이 진다 — **진짜** 물려받은 위반은 그 머리글로 계속 나온다. */
test('🔴 [#Q66] 뺀 사실은 말하되 **「위반」으로 세지 않는다** — 그 소음이 진짜 초과를 묻는다',
  { skip: !hasGit && 'git 없음' }, (t) => {
    const 기존 = `| 2026-08-09 | **내 첫 트랙** | z.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
    const { 내파일, 박동, 스텁환경 } = F278픽스처({ 내줄: 기존, 활성수: 10, 대기수: 5, 완료수: 0 });
    try {
      const 둘째 = `| 2026-08-09 | **내 둘째 트랙** | y.js | 작업중 (\`local_${지문278(내세션278)}\`) |`;
      const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${기존}\n${둘째}\n` } }, { ...내환경278, ...스텁환경 });
      if (미실행이면건너뛴다(t, r)) return;
      assert.strictEqual(r.결정, 'allow', `이 검사는 통과하는 자리에서 «말»을 재는 것이다:\n${r.사유.slice(0, 200)}`);
      assert.match(r.알림 || '', /대기 5줄/,
        '㉠ 뺀 사실이 사라졌다 — 조용히 빼면 「상한이 헐거워졌다」로 읽히고 아무도 대기 줄을 안 치운다(F395)');
      assert.doesNotMatch(r.알림 || '', /물려받은 보드 위반/,
        `🔴 ㉡ 통과 설명을 「위반」으로 셌다 — 모든 세션이 위반 1건을 안고 시작하고, 진짜 초과가 와도 같은 머리글·같은 건수에 묻힌다(#Q66):\n${(r.알림 || '').slice(0, 400)}`);
    } finally { 박동치우기(박동); }
  });

/* 판정 정본은 `tools/lib/보드.js` 다 — 여기 셋은 git 없이 그 함수만 잰다(가드는 파생일 뿐).
 * 🔴 급소는 두 번째다: 대기를 «완료»로 접으면 `tools/보드수거.js` 가 아카이브로 가져가고,
 *   그 방향은 조용하다 — 유호님 답이 오는 날 그 트랙은 보드에도 인계문에도 없다. */
test('🔴 [F395] 대기 판정은 상태 칸만 보고, 완료 판정을 물들이지 않는다', () => {
  const 보드lib = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));
  const 대기줄 = '| 2026-08-01 | **트랙** | a.js | ⏳유호=처분 대기 (`local_aaaabbbb`) |';
  const 인용줄 = '| 2026-08-01 | **⏳ 딴 줄을 가리키는 인용** | a.js | 작업중 (`local_aaaabbbb`) |';
  assert.strictEqual(보드lib.대기행(대기줄), true, '상태 칸의 ⏳ 를 못 읽는다');
  assert.strictEqual(보드lib.완료행(대기줄), false,
    '🔴 대기를 완료로 접었다 — 보드수거가 유호님 답을 기다리는 트랙을 조용히 아카이브로 가져간다');
  assert.strictEqual(보드lib.활성행(대기줄), true, '대기 줄은 여전히 활성이다(빠지는 것은 상한 분모뿐)');
  assert.strictEqual(보드lib.대기행(인용줄), false,
    '🔴 트랙 칸의 ⏳ 를 셌다 — 남의 대기를 인용한 줄이 제 상한에서 빠진다');
});

/* 🔑 **답을 못 받은 것**과 **거절당한 것**은 다르다. 스폰이 답을 못 주는 자리(타임아웃)는
 * 픽스처로 만들 손잡이가 없어 그 성질이 회귀 밖에 있었다 — 그래서 board-guard 에 제한 시간
 * 이음매를 뒀다(`SYNK_BOARD_MOVE_TIMEOUT_MS`). 1ms 면 모든 검증이 답 없이 끝난다. */
test('🔴 [F278] 검증이 **답을 못 받으면** 차단을 유지한다 (타임아웃을 「옮길 게 없다」로 읽지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { 내파일, 박동 } = F278픽스처();
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${새줄278}\n` } },
      { ...내환경278, SYNK_BOARD_MOVE_TIMEOUT_MS: '1' });
    assert.strictEqual(r.결정, 'deny',
      '🔴 검증이 답을 못 받았는데 「치울 게 없다」로 읽고 면제를 열었다 — 미실행이 통과와 같은 모양이 됐다(F207 축)');
  } finally { 박동치우기(박동); }
});

/* ── 🔴 F296 — 거짓 적색 둘을 각각 못박는다 (2026-08-09 실측) ──────────────────
 * 신고: F278 회귀 다섯이 **부하에 따라** 빨개졌다. 급소는 코드가 아니라 **자식이 제 시간에 못 돈
 * 것**이고, 훅은 그때 「판정 불가 → 차단 유지」로 *다른 사유*를 내므로 사유를 보는 단언이 깨진다.
 * 실측 재현: `SYNK_BOARD_MOVE_TIMEOUT_MS=1` 이면 같은 다섯이 전부 같은 모양으로 깨진다.
 *
 * 처방 둘을 나눠 잰다 — 하나로 뭉치면 무엇이 고친 것인지 못 가른다:
 *   ②본선 = 그 다섯이 **실물 대신 스텁**을 돌린다(위 `F278픽스처`). 재는 대상은 board-move 의
 *           속도가 아니라 훅이 종료 코드를 읽는 방식이다. → 아래 「계약 시험」이 그 대가를 낸다:
 *           스텁이 흉내내는 **6** 이 실물의 진짜 계약인지 실물로 한 번 못박는다.
 *   ①안전판 = 답을 못 받은 것을 **사유가 밝힌다**. 안 밝히면 처방 목록이 「돌려 보고 낸 것」이라는
 *           약속과 어긋난 채 조용히 섞이고, 회귀는 「적색」과 「판정 불가」를 못 가른다.
 * 🚫 제한 올리기는 처방이 아니다 — 부하에는 상한이 없다(F249 에서 이미 죽은 길). */
test('🔴 [F296] 계약 시험 — **실물** board-move 는 살아있는 주인의 줄에 종료 6 을 낸다 (스텁이 흉내내는 그 값)', { skip: !hasGit && 'git 없음' }, () => {
  const { dir, 박동 } = F278픽스처();
  try {
    const r = 실행(process.execPath, [path.join(__dirname, '..', 'tools', 'board-move.js'), '완료트랙갑', '--dry'], {
      encoding: 'utf8',
      cwd: dir,
      env: {
        ...process.env,
        SYNK_BOARD: 보드파일(dir, 지문278(남세션278)),
        SYNK_BOARD_ARCHIVE: path.join(dir, 'docs', '세션보드_아카이브.md'),
        CLAUDE_CODE_HOST_SESSION_ID: 내세션278,
      },
    });
    assert.strictEqual(r.status, 6,
      `🔴 종료 계약이 갈라졌다 — 훅은 **6 만** 「거절」로 세는데 실물이 다른 값을 냈다. 스텁을 쓰는 F278 회귀 다섯은 이 갈라짐을 못 본다:\n${r.stdout}\n${r.stderr}`);
  } finally { 박동치우기(박동); }
});

test('🔴 [F296] 답을 못 받은 검증을 **사유가 밝힌다** (미실행이 처방에 조용히 섞이지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { 내파일, 박동 } = F278픽스처({ 죽은완료: true });
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${새줄278}\n` } },
      { ...내환경278, SYNK_BOARD_MOVE_TIMEOUT_MS: '1' });
    assert.strictEqual(r.결정, 'deny', '판정 불가인데 통과시켰다');
    assert.match(r.사유, /답을 못 했다/,
      `🔴 답을 못 받은 후보를 처방에 넣고도 그 사실을 안 밝혔다 — 사람은 「돌려 본 명령」으로 읽고 실행했다가 거절당한다(F278 이 만든 그 자리):\n${r.사유.slice(0, 400)}`);
  } finally { 박동치우기(박동); }
});

/* 🔑 **거짓양성 방향도 막는다** — 답을 다 받은 판에서 이 문구가 뜨면 그 경고는 곧 소음이 되고,
 *   소음이 된 경고는 진짜일 때도 안 읽힌다. 종료 코드 1(=「돌았고 못 옮긴다」)이 못받음으로
 *   세어지지 않는지가 이 검사의 조준점이다(그 자리가 가장 헷갈린다).
 * 🔴 이 검사도 **스텁으로 조준한다** — 실물을 돌리면 이 검사 자체가 F296 의 다음 희생자다
 *   (부하로 실물이 늦으면 「경고가 안 뜬다」가 빨개진다). 재는 것은 1 을 어떻게 세는가지
 *   실물이 얼마나 빠른가가 아니다. */
const 스텁1 = path.join(TMP, 'board-move-stub-1.js');
const 스텁1로그 = path.join(TMP, 'stub1.log');
fs.writeFileSync(스텁1, [
  "'use strict';",
  "require('fs').appendFileSync(process.env.SYNK_STUB_LOG, String(process.argv[2] || '') + String.fromCharCode(10));",
  'process.exit(1);   // 「돌았고 못 옮긴다」 — 답이지 미실행이 아니다',
].join('\n'), 'utf8');

test('🔴 [F296] 답을 받은 판에서는 그 경고가 **안 뜬다** (종료 1 은 「못 받음」이 아니다)', () => {
  const 판 = 만석보드();
  /* 제한을 **이 검사가 정한다** — 조준점이 「1 을 어떻게 세는가」라 답을 받는 것이 전제다.
   * 밖에서 제한을 1ms 로 눌러 놓으면(대조 실험이 그렇게 한다) 스텁조차 답을 못 하고,
   * 그러면 이 검사는 재려던 것 대신 타임아웃을 재게 된다. 실물이 아니라 스텁이라 무해하다. */
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 판, old_string: row(3), new_string: `${row(3)}\n${row(99)}` } },
    { SYNK_BOARD_MOVE_BIN: 스텁1, SYNK_STUB_LOG: 스텁1로그, SYNK_BOARD_MOVE_TIMEOUT_MS: '30000' });
  스텁이돌았다(스텁1로그);
  assert.strictEqual(r.결정, 'deny', '판정 불가인데 통과시켰다');
  assert.ok(!/답을 못 했다/.test(r.사유),
    `🔴 board-move 가 **답한** 것(종료 1)을 「답을 못 했다」로 셌다 — 경고가 늘 켜지면 아무도 안 읽는다:\n${r.사유.slice(0, 300)}`);
});

/* 🔑 **「board-move 가 거절했다」와 「board-move 가 못 돌았다」를 가르는가.**
 * 이 둘을 뭉치면(=0 이외 전부를 실행 불가로 세면) 환경 고장이 「옮길 게 없다」로 읽혀 상한이
 * 조용히 풀린다 — 새는 방향이다. 아래 픽스처엔 아카이브 파일도 git 저장소도 없어 board-move 가
 * **1** 로 죽는다. 그때 처방은 비면 안 되고 차단도 그대로여야 한다. */
test('🔴 [F278] board-move 가 아예 못 도는 자리에서는 **처방이 비지 않는다** (미측정을 「없다」로 세지 않는다)', () => {
  const 판 = 만석보드();
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: 판, old_string: row(3), new_string: `${row(3)}\n${row(99)}` } });
  assert.strictEqual(r.결정, 'deny', '판정 불가인데 통과시켰다');
  assert.match(r.사유, /board-move\.js "/,
    `🔴 board-move 가 못 돈 것을 「옮길 완료 줄이 없다」로 읽었다 — 종료 코드 6(거절)만 실행 불가로 세야 한다:\n${r.사유.slice(0, 300)}`);
});

test('🔴 [F278] 옮길 수 있는 완료 줄이 **하나라도 있으면** 막고, 처방엔 그것만 낸다', { skip: !hasGit && 'git 없음' }, (t) => {
  const { 내파일, 박동, 스텁환경, 스텁로그 } = F278픽스처({ 죽은완료: true });
  try {
    const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${새줄278}\n` } }, { ...내환경278, ...스텁환경 });
    if (미실행이면건너뛴다(t, r)) return;   // 🔑 **순서가 뜻이다** — 아래 주석
    스텁이돌았다(스텁로그);
    assert.strictEqual(r.결정, 'deny', '🔴 치울 수 있는 줄이 있는데 면제가 열렸다 — 상한이 사라진다');
    const 명령 = (r.사유.match(/board-move\.js "([^"]*)"/g) || []);
    assert.ok(명령.some((c) => c.includes('죽은주인')), `처방에 **실제로 도는** 명령이 없다:\n${r.사유.slice(0, 400)}`);
    assert.ok(!명령.some((c) => c.includes('완료트랙')),
      `🔴 주인이 살아 있어 board-move 가 거절할 명령을 그대로 냈다 — 이것이 F278 의 본체다:\n${명령.join(' / ')}`);
  } finally { 박동치우기(박동); }
});

/* ── 🔴 F283 — **문구를 뽑을 수 없는 줄**은 처방에서 영원히 사라진다 (2026-08-09 실측) ────
 * F278 은 「어느 줄을 내미나」였고 이것은 그 앞 단계 — 「그 줄의 문구를 뽑을 수 있나」다.
 * 옛 판은 트랙 칸을 따옴표·백틱으로 자른 뒤 **첫 조각**만 봤다. 트랙 칸이 백틱으로 시작하면
 * 첫 조각에 남는 게 굵게 장식뿐이라 비고 → null → 그 줄은 처방 목록에 **영영 안 나온다.**
 * 실측: 그날 보드의 완료 줄 10개 중 1개(`submissions.audio_duration_sec` 트랙)가 그 상태였고,
 * 하필 손으로도 문구 고르기가 가장 어려운 줄이라 **기계도 사람도 못 치우는 자리**였다.
 * 🔑 픽스처는 완료 줄을 **전부** 그 모양으로 둔다 — 하나라도 깨끗한 줄이 섞이면 그것이 대신
 *   나와서 옛 판도 초록이 된다(F283 이 신고된 실판이 그 반대 모양이라 1건만 샜다). */
const 백틱보드 = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
  ...Array.from({ length: n }, (_, i) => `| 2026-08-01 | **\`열${String(i).padStart(2, '0')}_길이\` 가 영구 빈 칸** — 공통 꼬리 | Code.js | 완료 |`)].join('\n');

test('🔴 [F283] 트랙 칸이 **백틱으로 시작해도** 이관 문구를 뽑는다 (못 뽑으면 그 줄은 영원히 안 치워진다)', () => {
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 백틱보드(20) } });
  assert.strictEqual(r.결정, 'deny', '만석인데 통과시켰다 — 이 검사의 분모가 사라진다');
  const 문구 = 처방문구(r.사유);
  assert.ok(문구.length >= 3,
    `🔴 완료 줄 20개가 전부 백틱으로 시작한다고 처방이 ${문구.length}개다 — 기계도 사람도 못 치우는 자리가 된다(F103 축):\n${r.사유.slice(0, 400)}`);
  assert.ok(문구.every((n) => n.includes('열')),
    `뽑힌 문구가 백틱 **안쪽**에서 안 나왔다 — 무엇을 쟀는지 흐려진다: ${문구.join(' / ')}`);
});

/* 🔑 백틱 **안쪽**을 후보로 삼은 대가를 여기서 못박는다 — 그 안은 코드라 `$`·`\` 가 산다.
 *   자르는 글자를 안 늘리면 `` `$CLAUDE_PROJECT_DIR` `` 같은 칸이 셸에서 변수로 확장된다
 *   (bash·PowerShell 둘 다 큰따옴표 안에서 `$` 를 푼다 · F064 가 이미 그 계열의 실사고다). */
test('🔑 [F283] 처방 문구에 셸을 깨는 글자가 없다 — 백틱 안의 `$`·`\\` 까지 자른다', () => {
  const 위험 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
    ...Array.from({ length: 6 }, (_, i) => `| 2026-08-01 | **\`$CLAUDE_PROJECT_DIR/열${String(i).padStart(2, '0')}\`** — 꼬리 | Code.js | 완료 |`),
    ...Array.from({ length: 14 }, (_, i) => `| 2026-08-01 | **깨끗한 트랙 ${i} 이름** | Code.js | 완료 |`)].join('\n');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: BOARD, content: 위험 } });
  const 문구 = 처방문구(r.사유);
  assert.ok(문구.length >= 3, `처방이 비었다(${문구.length}개) — 무엇을 쟀는지 흐려진다:\n${r.사유.slice(0, 300)}`);
  for (const n of 문구) assert.ok(!/["`$\\]/.test(n), `🔴 처방 문구에 셸을 깨는 글자가 남았다: ${n}`);
});

/* ── 🔴 F285 — **놓은 자리**(🎫)가 이어받기를 막는다 (2026-08-09 실측) ──────────────
 * 🎫 는 주인이 「나는 이걸 안 한다」고 스스로 놓은 줄이고, CLAUDE.md 가 이어받기 금지의
 * **유일한 예외**로 못박은 표식이다. 그런 줄을 ④ 가 선점으로 세면 뜻이 정확히 뒤집힌다 —
 * 이어받으라고 내건 것이 이어받기를 막는다. 실측 2026-08-09: `ff81ee7c` 의 🎫 줄이 파일 칸에
 * **맥락으로** 적어둔 `tests/C0계약.test.js`(그나마 낡은 정보였다) 때문에 산 세션 `af79333d`
 * 가 45분째 선언을 못 하고 `board-move --dry` 로 주인이 죽기만 기다렸다. F221(🚫)의 ⚠판이다.
 * 🔑 픽스처는 그 실물을 그대로 쓴다 — 파일 칸의 맥락 언급까지(그게 자리로 세어진 자리다). */
const 티켓줄 = (상태) => `| 2026-08-07 | 🎫 **급수 1~2 골라서 답하기가 설계에만 있고 생산자 0** | **SYNK-talk: lib/오늘과제.js · docs/말하기_설계.md §6**(⚠과제 형식은 C0 계약에 걸린다 — talk \`tests/C0계약.test.js\` 미커밋) | ${상태} |`;
const 이어받는줄 = 내줄('**C0 계약 가드를 L0 정본에 편입한다**', '**SYNK-talk: tests/C0계약.test.js**');

test('🔴 [F285] 🎫 「안 잡는다」 줄은 자리를 잡고 있는 게 아니다 — 이어받기가 통과한다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 남을바꿔(티켓줄('🎫**이어받아도 된다** — 실측만 하고 안 잡는다(`local_82404266`)'), 이어받는줄);
  assert.strictEqual(r.결정, 'allow',
    `🔴 놓은 자리를 선점으로 셌다 — 이어받으라고 내건 줄이 이어받기를 막는다(열리는 문이 「주인 죽음 대기」뿐이다):\n${r.사유.slice(0, 300)}`);
  assert.match(r.알림, /선점이 아니다/,
    '🔴 조용히 비켜 줬다 — 면제는 드러내야 다음 세션이 ④ 가 이 자리를 봤는지 안다(F278 과 같은 규칙)');
  // 자리는 소문자로 정규화돼 있다(`자리들`) — 대소문자로 재면 이 검사만 조용히 빨개진다
  assert.match(r.알림, /c0계약\.test\.js/i, '어느 자리가 겹쳤는지 안 말하면 낡은 언급인지 확인할 수 없다');
});

test('🔴 [F285·분모] 🎫 가 **어디에도 없는** 같은 줄은 여전히 막는다 — 힘을 뺀 게 아니라 축을 좁혔다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 여기가 이 수리의 분모다. 이게 초록이 아니면 ④ 가 통째로 죽은 것이고, 그때는 파일 칸의
   * 맥락 언급 전부가 자리에서 빠진 것이라 두 세션이 같은 파일을 조용히 판다. */
  const r = 남을바꿔(티켓줄('🔵**착수**(`local_82404266`)').replace('🎫 **급수', '**급수'), 이어받는줄);
  assert.strictEqual(r.결정, 'deny',
    '🔴 🎫 가 없는 줄까지 놓아 줬다 — ④ 가 통째로 죽었다(같은 파일을 두 세션이 각자 판다)');
});

test('🔴 [F285·좁힘] 🎫 가 **트랙 칸에만** 있으면 놓은 게 아니다 — 규약이 못박은 자리는 상태 칸이다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 넓게 틀리면 두 세션이 같은 자리를 조용히 판다(되돌릴 수 없다). 좁게 틀리면 막히고,
   * 막히는 것은 보인다 — 그래서 판정 자리를 상태 칸 하나로 둔다. */
  const r = 남을바꿔(티켓줄('🔵**착수**(`local_82404266`)'), 이어받는줄);
  assert.strictEqual(r.결정, 'deny',
    '🔴 트랙 칸의 🎫 까지 놓은 것으로 셌다 — 표식을 문장 어디서나 세면 언급만으로 자리가 풀린다');
});

/* ── 🔴 F291 — **내 파일의 내 줄**이 나를 「남의 활성 줄」로 막는다 (2026-08-09 실측) ────────
 * ④ 는 «트랙 칸이 바뀌면 새 선언»으로 센다(③ 과 같은 규칙 · 상태 칸 갱신을 새 줄로 세지
 * 않으려고 그렇게 정했다). 그런데 «누구 줄인가»는 ④ 만 **지문으로** 따로 판정했다 —
 * 지문은 줄에 적혀 있을 때만 주인을 말하는데 ③ 은 지문 없는 줄을 정상으로 인정한다
 * (클라우드·폰). 그래서 같은 훅 안에 「남의 것」이 두 벌 살았고, 갈라진 쪽이 조용히 틀렸다:
 * **내 트랙 이름을 고치는 순간 내 옛 줄이 나를 막았고**, 사유는 「비켜나라」 — 자기 트랙을
 * 버리라는 오답이다(F103: 따를 수 없는 처방은 우회를 정상 통로로 만든다).
 *
 * ⚠ 신고문의 축(**Write 는 막히고 Edit 는 통과**)은 실측에서 **오진이었다** — 둘 다 똑같이
 *   막힌다. Edit 가 통과하는 것처럼 보인 이유는 도구 차이가 아니라 Edit 가 보통 **상태 칸만**
 *   갈아 트랙 칸을 바이트 그대로 남기기 때문이다. 그래서 수리 축은 라우팅이 아니라 소유 판별이다.
 *
 * 🔑 아래 넷은 **한 축씩만** 다르다 — 한 갈래만 재면 「고쳤다」와 「구멍을 냈다」가 같은 모양이다. */
const F291 = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-f291-'));
const 내지문291 = 'cccc3333';
const 남지문291 = 'dddd4444';
const 내파일291 = 보드파일(F291, 내지문291);
const 남파일291 = 보드파일(F291, 남지문291);
const 나291 = { CLAUDE_CODE_HOST_SESSION_ID: `local_${내지문291}-0000-0000-0000-000000000000` };

/* 지문이 **없는** 내 옛 줄 — ③ 이 정상으로 인정하는 모양이다(클라우드·폰은 지문을 모른다). */
const 옛트랙291 = '**어떤 트랙 — 처음 적은 이름**';
const 내옛줄291 = `| 2026-08-09 | ${옛트랙291} | **tools/어떤것.js · tests/어떤것.test.js** | 🔵작업중 |`;
/* 같은 트랙을 **이름만 고쳐** 다시 적는다(범위 조정 — 보드 갱신의 흔한 모양). */
const 내새줄291 = `| 2026-08-09 | **어떤 트랙 — 처음 적은 이름(범위 조정)** | **tools/어떤것.js · tests/어떤것.test.js** | 🔵작업중 (\`local_${내지문291}\`) |`;
const 남의활성291 = `| 2026-08-09 | **전혀 다른 트랙** | **tools/어떤것.js** | 🔵**착수**(\`local_${남지문291}\`) |`;

const 씀291 = (파일, 내용) => fs.writeFileSync(파일, 내용, 'utf8');

test('🔴 [F291] **내 파일의 내 줄**은 트랙 칸을 고쳐도 나를 막지 않는다 (지문이 없어도)', () => {
  씀291(내파일291, `${내옛줄291}\n`);
  씀291(남파일291, '');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일291, content: `${내새줄291}\n` } }, 나291);
  assert.strictEqual(r.결정, 'allow',
    `🔴 내 옛 줄이 나를 막았다 — 사유가 「비켜나라」라 세션이 자기 트랙을 버린다:\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F291·탐지력] **남의 파일**의 활성 줄과 겹치면 여전히 막는다 (면제는 내 파일까지다)', () => {
  씀291(내파일291, `${내옛줄291}\n`);
  씀291(남파일291, `${남의활성291}\n`);
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일291, content: `${내새줄291}\n` } }, 나291);
  assert.strictEqual(r.결정, 'deny',
    '🔴 ④ 가 통째로 죽었다 — 남이 선언한 파일을 내가 또 판다(중복 구현은 되돌릴 수 없다)');
  assert.match(r.사유, new RegExp(남지문291), '누가 잡았는지 안 말하면 생사를 확인할 수 없다');
});

test('🔴 [F291·구멍] **남의 보드 파일**에 내 선언을 쓰면 면제가 안 붙는다', () => {
  /* 면제를 「편집 중인 파일의 줄」로만 걸면 여기가 새 구멍이 된다 — 남의 파일에 쓰는 순간
   * 그 세션의 선언이 통째로 면제된다. 그래서 면제는 **파일 이름이 내 지문일 때만** 붙는다. */
  씀291(내파일291, '');
  씀291(남파일291, `${남의활성291}\n`);
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 남파일291, content: `${남의활성291}\n${내새줄291}\n` } }, 나291);
  assert.strictEqual(r.결정, 'deny',
    '🔴 남의 보드 파일에 쓰면 그 세션의 선언이 통째로 면제됐다 — 고친 자리가 새 구멍이 됐다');
});

test('🔴 [F291·처방] 지문을 모르는 세션은 막히되 **무엇을 하면 열리는지** 말한다', () => {
  /* 지문이 없으면 자기 파일을 지목할 수 없어 옛 동작대로 막힌다(좁게 틀리는 쪽 · 막히는 것은
   * 보인다). 그때 사유가 「비켜나라」로 끝나면 그건 자기 트랙을 버리라는 오답이고, 따를 수
   * 없는 처방은 우회를 정상 통로로 만든다(F103). 그래서 갈래를 나눠 처방까지 내는지 잰다. */
  씀291(내파일291, `${내옛줄291}\n`);
  씀291(남파일291, '');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일291, content: `${내새줄291}\n` } },
    { CLAUDE_CODE_HOST_SESSION_ID: '' });
  assert.strictEqual(r.결정, 'deny', '지문을 모르는데 놓아 줬다 — 주인을 증명할 길이 없는 자리다');
  assert.match(r.사유, /지금 편집 중인 파일/,
    '🔴 내 옛 줄일 수 있다는 사실을 안 말했다 — 세션은 「비켜나라」만 읽고 자기 트랙을 버린다');
  assert.match(r.사유, /트랙을 버리지 않는다/,
    '🔴 처방이 없다 — 막기만 하고 여는 법을 안 주면 우회가 정상 통로가 된다(F103)');
});

test('🔴 [F291·섞임] 내 옛 줄과 **남의 줄이 같이** 겹치면 어느 쪽이 내 것인지 줄마다 가른다', () => {
  /* 처방 문단은 「섞여 있다」까지만 말한다 — 목록이 둘 이상이면 **어느 항목이 내 옛 줄인지**는
   * 줄마다 붙는 표시만 안다. 그게 없으면 세션은 남의 줄까지 「내 것이겠지」로 읽고 밀고 나가거나
   * (되돌릴 수 없는 중복 구현), 반대로 자기 줄까지 남의 것으로 읽고 트랙을 버린다. 둘 다 새는 쪽이다.
   * 🔑 지문을 모르는 세션에서만 이 섞임이 생긴다 — 지문이 있으면 내 옛 줄은 위에서 이미 빠진다. */
  씀291(내파일291, `${내옛줄291}\n`);
  씀291(남파일291, `${남의활성291}\n`);
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일291, content: `${내새줄291}\n` } },
    { CLAUDE_CODE_HOST_SESSION_ID: '' });
  assert.strictEqual(r.결정, 'deny', '남의 활성 줄과 겹치는데 통과했다');
  assert.match(r.사유, new RegExp(남지문291), '남의 겹침을 안 보여주면 무엇을 비켜야 할지 모른다');
  const 표시 = /이 줄은 \*\*지금 편집 중인 파일\*\*에 있다/g;
  assert.strictEqual((r.사유.match(표시) || []).length, 1,
    `🔴 내 옛 줄에만 붙어야 할 표시가 ${(r.사유.match(표시) || []).length}개다 — 0이면 가릴 수 없고, 2면 남의 줄까지 내 것으로 읽힌다:\n${r.사유.slice(0, 300)}`);
});

/* ── ⑦ 옛 글자 — 쓰는 순간 (F298 · 2026-08-09) ─────────────────────────────
 * 실사고: 보드 상태 칸이 좁아 낱말 대신 한자 한 자를 썼고, 그게 커밋돼 저장소가 적색이 됐다.
 * Actions 결제 정지로 원격 CI 가 죽어 있는 동안 clasp-guard 는 지름길 없이 작업본 전체를 도니
 * 그 한 글자가 **모든 세션의 clasp push** 를 막았다. 있던 두 층은 이 자리를 못 막는다 —
 * 채팅 가드는 발화만 보고, 문서문자 테스트는 **커밋 뒤**에 잡는다.
 * 더 고약한 축: 그 위반을 **신고하면서 글자를 그대로 인용해** 같은 적색이 한 벌 더 났다. */
const 옛한자 = String.fromCodePoint(0x5C3A);
const 새보드 = (이름) => {
  const p = 보드파일(fs.mkdtempSync(path.join(os.tmpdir(), 'boardglyph-')), 이름);
  fs.writeFileSync(p, '', 'utf8');
  return p;
};

test('🔴 [F298] 옛 글자가 든 보드 편집은 쓰는 순간 막는다', () => {
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 새보드('bbbb2222'),
    content: `| 2026-08-09 | 트랙 | tools/x.js \`local_deadbeef\` | 내 ${옛한자}대가 틀렸다 |\n` } });
  assert.strictEqual(r.결정, 'deny', '옛 글자가 든 보드 줄을 통과시켰다 — 커밋되면 전원의 배포가 막힌다');
  assert.match(r.사유, /U\+5C3A/, '어느 글자인지 U+ 표기로 안 짚으면 고칠 자리를 못 찾는다');
});

test('🔴 [F298] 차단 사유문 자체가 그 글자를 담지 않는다 — 신고가 새 위반이 되는 자리', () => {
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 새보드('cccc3333'),
    content: `| 2026-08-09 | 트랙 | tools/x.js \`local_deadbeef\` | ${옛한자} |\n` } });
  assert.ok(!r.사유.includes(옛한자) && !r.알림.includes(옛한자),
    '가드가 낸 글에 그 글자가 들어 있다 — 그걸 복사해 신고하면 같은 적색이 번진다(실측 2벌)');
});

test('[F103] U+ 표기로 고쳐 쓴 줄은 통과한다 — 처방을 따를 수 있어야 가드다', () => {
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 새보드('dddd4444'),
    content: '| 2026-08-09 | 트랙 | tools/x.js `local_deadbeef` | 내 잣대가 틀렸다(U+5C3A 제거) |\n' } });
  assert.notStrictEqual(r.결정, 'deny', `가드가 시킨 표기까지 막았다: ${r.사유.slice(0, 200)}`);
});

test('[F298·범위] 남이 이미 넣어 둔 글자는 내 무관한 편집을 막지 않는다', () => {
  /* 결과 파일 전체를 재면 남의 옛 글자가 내 편집을 영원히 막는다 — 내 파일에만 쓰는 규약상
   * 나는 그 줄을 고칠 수도 없으니, 그건 따를 수 없는 처방이다. 재는 것은 내가 새로 넣는 글뿐이다. */
  const p = 새보드('eeee5555');
  fs.writeFileSync(p, `| 2026-08-09 | 옛 트랙 | a.js \`local_deadbeef\` | ${옛한자} 남아있음 |\n`, 'utf8');
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: p,
    old_string: '옛 트랙', new_string: '새 트랙' } });
  assert.notStrictEqual(r.결정, 'deny',
    `남의 글자 때문에 내 무관한 편집이 막혔다 — 새는 방향이 아니라 **얼어붙는** 방향이다: ${r.사유.slice(0, 200)}`);
});

/* ── ⑧ 트랙 제목 충돌 — 선언하는 «순간» 막는가 (F340 · 2026-08-12 실측) ────────────────────
 *
 * 탐지력은 **여기 픽스처가 진다** — 실저장소는 살아있는 세션이 매 실행마다 달라 초록이 우연이 된다.
 * 제목은 그날 실제로 충돌한 두 줄을 «그대로» 쓴다(사람이 쓰는 표기로 검사한다 — 가드의 첫 맹점).
 * 가르는 조건은 **하나뿐**이다: 겹친 줄의 주인이 살았나. 그래서 박동 하나만 켜고 끄며 대조한다. */
const 남세션340 = 'local_f340aaaa-1111-2222-3333-444455556666';
const 내세션340 = 'local_f340bbbb-1111-2222-3333-444455556666';
const 지문340 = (sid) => sid.replace(/^local_/, '').slice(0, 8);
const 남제목340 = '**⓪de6b34d5 재검수→배포(210~214)→as 명부스윕**(9a710cd8 🎫 인계 · 새 선언 · 남의 줄 무변경)';
const 내제목340 = '**⓪de6b34d5 재검수→라이브 배포(v9.210~214)→as 명부스윕**(`9a710cd8` 🎫 인계 · 새 선언)';
const 딴제목340 = '**미니게임 ⓑ 실왕복 실행 — ⑫⑬확장→리허설 deliver 재배포→게임 갈래 실측**(대기열 P0)';

/* 옵션 셋은 **⑧-b(F381) 회귀가 쓰는 자리**다 — 기본값을 그대로 두면 위 F340 검사는 한 글자도
 * 안 바뀐다(같은 픽스처를 두 벌로 복사하면 갈라지고, 갈라진 쪽이 조용히 안 돈다). */
function F340픽스처(제목, 옵션 = {}) {
  const 남제목 = 옵션.남제목 || 남제목340;
  const 내상태 = 옵션.내상태 || null;
  const 남상태 = 옵션.남상태 || null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardf340-'));
  const g = (...a) => 실행('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'a.js'), '// x\n', 'utf8');
  g('add', '--', 'a.js'); g('commit', '-q', '-m', '초기');
  fs.writeFileSync(보드파일(dir, 지문340(남세션340)),
    `| 2026-08-12 | ${남제목} | 검수 장부 | ${남상태 || `작업중 (\`local_${지문340(남세션340)}\`)`} |\n`, 'utf8');
  const 최상위 = g('rev-parse', '--show-toplevel').stdout.trim();
  const 박동 = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(남세션340)}.json`);
  const 내줄 = `| 2026-08-12 | ${제목} | 검수 장부 | ${내상태 || `작업중 (\`local_${지문340(내세션340)}\`)`} |`;
  return {
    박동,
    켜기: () => {
      fs.mkdirSync(store.stateDir(), { recursive: true });
      fs.writeFileSync(박동, JSON.stringify({ touched: [] }), 'utf8');
    },
    쓰기: () => 판정(
      { tool_name: 'Write', tool_input: { file_path: 보드파일(dir, 지문340(내세션340)), content: `${내줄}\n` } },
      { CLAUDE_CODE_HOST_SESSION_ID: 내세션340 }
    ),
  };
}

test('[F340] 살아있는 세션이 이미 선언한 트랙을 다시 선언하면 차단된다', { skip: !hasGit && 'git 없음' }, () => {
  const f = F340픽스처(내제목340);
  f.켜기();
  try {
    const r = f.쓰기();
    assert.strictEqual(r.결정, 'deny',
      `막았어야 한다 — 이게 안 막히면 20~32분짜리 이종 검수가 두 번 탄다: ${r.사유.slice(0, 200)}`);
    assert.match(r.사유, /f340aaaa/, '겹친 세션 지문을 보여줘야 어디로 비켜날지 안다');
  } finally { 박동치우기(f.박동); }
});

/* 🔑 처방을 그 가드에 되먹여 본다(F103) — 「다른 것을 골라 선언한다」가 실제로 통과해야
 *   처방이 따를 수 있는 것이다. 안 그러면 우회가 정상 통로가 된다. */
test('[F340] 처방대로 «다른 트랙»을 선언하면 통과한다 (거짓양성이 곧 우회 손버릇이 된다)', { skip: !hasGit && 'git 없음' }, () => {
  const f = F340픽스처(딴제목340);
  f.켜기();
  try {
    const r = f.쓰기();
    assert.notStrictEqual(r.결정, 'deny',
      `겹치지 않는 트랙이 막혔다 — 처방을 따를 수 없게 된다: ${r.사유.slice(0, 200)}`);
  } finally { 박동치우기(f.박동); }
});

/* 죽은 세션의 줄을 이어받는 것은 🎫 의 **정상 통로**다 — 여기서 막으면 인계가 통째로 죽는다.
 * 표식(🎫)으로는 못 가른다: 08-12 충돌에선 두 줄 다 「🎫 인계」라고 적혀 있었다. */
test('[F340] 같은 제목이어도 그 세션이 죽었으면 막지 않는다 (인계는 정상 통로)', { skip: !hasGit && 'git 없음' }, () => {
  const f = F340픽스처(내제목340);
  박동치우기(f.박동);
  const r = f.쓰기();
  assert.notStrictEqual(r.결정, 'deny',
    `죽은 줄 인계가 막혔다 — 🎫 통로가 통째로 죽는다: ${r.사유.slice(0, 200)}`);
});

/* ── ⑧-b 같은 🎫 를 둘이 집었다 — ⑧ 이 제목으로 못 잡은 구멍 (F381 · 2026-08-12 실측) ────────
 *
 * 제목 둘은 그날 실제로 나란히 선 두 줄을 **글자 그대로** 옮긴 것이다. ⑧ 판정에 그대로 먹이면
 * 겹침률 **0.375**(문턱 0.75)라 안 울린다 — 한쪽이 🎫 를 통째로 적고 다른 쪽이 한 조각만 적어
 * 공유 낱말이 소수파가 됐기 때문이다. 두 줄이 **공유하는 정확한 이름**은 출처 지문 `955e8a16` 뿐이다.
 *
 * ⚠ 탐지력은 이 픽스처가 진다 — 실보드는 매 실행마다 살아있는 세션이 달라 초록이 우연이 된다. */
const 내제목381 = '**선생님 피드백 UX(반 단위) — 유호 신규 지시 08-12**(`955e8a16` 🎫 인계 · 정본이 남긴 선행 실측 3(ⓐ반 물리·ⓑGlide 화면·ⓒ역할 경계)부터 · 새 선언 · 남의 줄 무변경)';
const 남제목381 = '**G2 ㉡ 서버판정 + 「맞음」 큐 자동하강 + 선생님 피드백 UX(반 단위) — «한 벌» 설계**(`955e8a16` 🎫 인계 · 유호 신규 지시 08-12 · 새 선언 · 남의 줄 무변경)';
const 딴티켓381 = '**⓪de6b34d5 재검수→배포(210~214)→as 명부스윕**(`9a710cd8` 🎫 인계 · 새 선언 · 남의 줄 무변경)';

test('[F381] 제목이 안 겹쳐도 같은 🎫 출처면 알린다 — ⑧ 이 0.375 로 놓친 자리', { skip: !hasGit && 'git 없음' }, () => {
  const f = F340픽스처(내제목381, { 남제목: 남제목381 });
  f.켜기();
  try {
    const r = f.쓰기();
    assert.match(r.알림, /955e8a16/,
      `같은 🎫 를 둘이 집었는데 조용했다 — 이게 안 울리면 설계 2벌이 각자 끝까지 간다: ${r.알림.slice(0, 200)}`);
    assert.match(r.알림, /f340aaaa/, '누구와 겹쳤는지를 보여줘야 조율할 상대를 안다');
  } finally { 박동치우기(f.박동); }
});

/* 🔑 처방을 그 가드에 되먹인다(F103) — 「나눠 맡으려면 조각을 제목에 적어라」가 실제로 통과해야
 *   따를 수 있는 처방이다. 하나의 🎫 가 두 벌인 경우가 실재했다(「㉡ 한 벌 + 피드백 UX」). */
test('[F381] 그래도 **막지는 않는다** — 🎫 하나를 갈라 맡는 것은 정상 통로', { skip: !hasGit && 'git 없음' }, () => {
  const f = F340픽스처(내제목381, { 남제목: 남제목381 });
  f.켜기();
  try {
    const r = f.쓰기();
    assert.notStrictEqual(r.결정, 'deny',
      `갈라 맡기가 막혔다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다: ${r.사유.slice(0, 200)}`);
  } finally { 박동치우기(f.박동); }
});

test('[F381·거짓양성] 🎫 출처가 다르면 조용하다', { skip: !hasGit && 'git 없음' }, () => {
  const f = F340픽스처(딴티켓381, { 남제목: 남제목381 });
  f.켜기();
  try {
    const r = f.쓰기();
    assert.ok(!/같은 🎫/.test(r.알림),
      `다른 🎫 를 집었는데 울었다 — 거짓양성이 곧 우회 손버릇이 된다: ${r.알림.slice(0, 200)}`);
  } finally { 박동치우기(f.박동); }
});

/* 🔴 뜻이 반대인 자리를 섞지 않는가. 트랙 칸의 🎫 = 「물려받았다」 · 상태 칸의 🎫 = 「나는 안 한다」.
 *   섞으면 일감을 **내놓는** 줄마다 울어 경고가 통째로 무의미해진다(그런 줄이 보드에 상시 8건이다). */
test('[F381] 상태 칸의 🎫(내놓기)로는 안 운다 — 트랙 칸에서만 읽는다', { skip: !hasGit && 'git 없음' }, () => {
  const 상태 = '작업중 — 🎫 다음=`955e8a16` 재검수';
  const f = F340픽스처('**딴 트랙 A — 명부 스윕**(새 선언)', {
    남제목: '**딴 트랙 B — 라디오 인제스트**(새 선언)', 내상태: 상태, 남상태: 상태,
  });
  f.켜기();
  try {
    const r = f.쓰기();
    assert.ok(!/같은 🎫/.test(r.알림),
      `상태 칸의 내놓기 🎫 로 울었다 — 그러면 8줄이 상시 경고가 된다: ${r.알림.slice(0, 200)}`);
  } finally { 박동치우기(f.박동); }
});

/* ── F343 — repo **밖** 공유 자원도 자리다: `clasp push` = 라이브 Apps Script ────────────
 * ④ 는 자리를 ①표식 머리 ②파일 **경로** 둘로만 셌다. 둘 다 repo **안**을 가리킨다. 그런데
 * 이 저장소에서 가장 비싼 공유 자원인 라이브 Apps Script 에는 경로가 없다 — `clasp push` 는
 * HEAD 가 아니라 작업본을 통째로 민다(F310·F273).
 * 🔴 실측 2026-08-12: 활성 줄에 `clasp push` 를 선언한 배포 트랙이 **동시에 3개**였는데 ④ 는
 *   한 번도 안 울었다. 먼저 민 세션이 남의 검수 과녁을 낡게 만든다(F342 가 인접 축에서 신고).
 *   CLAUDE.md 세션 규약은 「조율 단위는 repo 밖 공유 자원(…배포키…)도 포함」이라 이미 못박혀
 *   있었다 — 규약이 아니라 **가드가 그 축을 안 본 것**이고, 새는 방향은 언제나 「통과」다.
 * 🔑 탐지력은 이 픽스처가 진다. 실저장소에서 재면 안 되는 이유는 아래 거짓양성 검사들이다 —
 *   비켜남 표기(`배포 0`)와 🚫 스팬이 실제 보드에 흔해서, 좁게 틀리면 관습이 죽는다(F221). */
const 배포남의줄 = '| 2026-08-12 | **①v9.215 명부스윕 라이브 완주** | 검수 장부(도구)·clasp push(v9.215)·메모리 | 🔵**착수**(`local_52a7abc6`) |';

function 배포보드(남의줄들 = [배포남의줄], 지문 = 'eeee5555') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-f343-'));
  const p = 보드파일(root, 지문);
  const g = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync(p, `${머리}\n${기존}\n`, 'utf8');
  g('init', '-q'); g('config', 'user.email', 'test@synk.local'); g('config', 'user.name', 'test');
  g('add', `docs/_ops/보드/${지문}.md`); g('commit', '-qm', 'base', '--no-verify');
  fs.writeFileSync(p, `${머리}\n${기존}\n${남의줄들.join('\n')}\n`, 'utf8');
  return { 파일: p, 끝줄: 남의줄들[남의줄들.length - 1] };
}
/** 남의 배포 선언 아래에 내 줄을 붙인다 — 내 지문은 그 보드 파일명과 달라 「내 파일」 면제를 안 탄다. */
const 배포붙임 = (내줄, 보드 = 배포보드()) => 판정(
  { tool_name: 'Edit', tool_input: { file_path: 보드.파일, old_string: 보드.끝줄, new_string: `${보드.끝줄}\n${내줄}` } },
  { CLAUDE_CODE_HOST_SESSION_ID: 'local_3fd8f6db' });

test('🔴 [F343·탐지력] 남이 잡은 **라이브 배포**(clasp push)를 또 잡으면 막는다 — 경로가 없는 자원이다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 배포붙임('| 2026-08-12 | **⓪재검수 → 배포** | 검수 장부(도구가 씀)·clasp push(215+216) | 🔵**착수**(`local_3fd8f6db`) |');
  assert.strictEqual(r.결정, 'deny',
    `🔴 같은 라이브를 두 세션이 나란히 미는 선언이 통과했다 — 먼저 미는 쪽이 남의 검수 과녁을 낡게 만든다:\n${r.사유.slice(0, 200)}`);
  assert.match(r.사유, /clasp/, '무엇이 겹쳤는지 안 말하면 비켜날 자리를 못 고른다');
  assert.match(r.사유, /local_52a7abc6/, '누가 잡았는지 안 말하면 생사를 확인할 수 없다');
});

test('🔴 [F343·거짓양성] `배포 0` 은 **안 민다는 선언**이다 — 자리가 아니다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 이 표기는 실제 보드에 흔하다(실측: `배포 0`·`라이브 배포 0` 두 모양). 비켜났다고 적을수록
   * 막히면 사람은 그 표기를 지우고, 그 순간 조율 재료가 통째로 사라진다(F221 과 같은 축). */
  const r = 배포붙임('| 2026-08-12 | **문서만 고치는 트랙** | `docs/설계.md` (엔진 0 · talk 0 · 라이브 배포 0 · 운영 0) | 🔵**착수**(`local_3fd8f6db`) |');
  assert.strictEqual(r.결정, 'allow',
    `🔴 「안 민다」고 적었더니 막혔다 — 정직하게 쓸수록 벌받으면 관습이 죽는다(F103):\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F343·거짓양성] 🚫 스팬 안의 `clasp push` 는 비켜남 명시다', { skip: git있음 ? false : 'git 없음' }, () => {
  const r = 배포붙임('| 2026-08-12 | **다른 트랙 — 배포는 비켜났다** | `tools/board.js` · 🚫clasp push=`local_52a7abc6` 점유 | 🔵**착수**(`local_3fd8f6db`) |');
  assert.strictEqual(r.결정, 'allow',
    `🔴 🚫 로 비켜난 자리를 선점으로 셌다 — F221 을 공유자원 축에서 그대로 재현했다:\n${r.사유.slice(0, 200)}`);
});

test('🔴 [F343·🎫] 남이 **놓은**(🎫) 배포 자리는 이어받기가 통과한다', { skip: git있음 ? false : 'git 없음' }, () => {
  /* 🎫 는 「나는 이걸 안 한다」고 스스로 놓은 것이다(F285). 공유자원 축을 새로 넣으면서 그 통로를
   * 막으면, 이어받으라고 내건 것이 이어받기를 막는 자리가 된다 — 뜻이 정확히 뒤집힌다. */
  const 놓은줄 = '| 2026-08-12 | **①v9.215 명부스윕** | 검수 장부·clasp push(v9.215) | ✅수리 완료 · 🎫**다음=재검수 후 clasp push** |';
  const r = 배포붙임('| 2026-08-12 | **⓪재검수 → 배포** | clasp push(215+216) | 🔵**착수**(`local_3fd8f6db`) |', 배포보드([놓은줄]));
  assert.notStrictEqual(r.결정, 'deny',
    `🔴 🎫 로 내건 배포 자리를 이어받는 것이 막혔다 — 새 축이 인계 통로를 죽였다:\n${r.사유.slice(0, 200)}`);
});

/* 🔴 **처방-가드 결속** — 이 가드가 «막는» 파일을 처방이 「거기 써라」로 가리키면 안 된다 (F103).
 *
 * 실사고 2026-08-12(`abf11783` 실측): 보드가 세션별 파일로 갈린(F250 · 08-08) **나흘 뒤에도**
 *   `/close`·`/deploy`·`/evolve` 스킬과 `context-budget` 훅이 옛 `docs/세션보드.md` 를 그대로
 *   가리키고 있었다. 따라 하면 이 가드가 deny 를 낸다 — **따를 수 없는 처방은 우회를 정상
 *   통로로 만든다.** 가장 나쁜 자리는 `/deploy` 1단계였다: 「그 파일에서 남의 '작업중' 선언을
 *   보라」인데 그 파일은 안내 스텁이라 선언이 **원리상 0** 이다. 조율 검사가 늘 통과했고,
 *   새는 방향은 여기서도 「통과」였다.
 *
 * 🔑 금지할 글자를 여기 «단정»하지 않는다 — **가드에게 먼저 물어서** 전제를 세운다. 언젠가
 *   그 파일이 다시 정본이 되면 ①이 먼저 빨개져 ②의 금지도 같이 재검토하게 된다.
 * 🔑 검사 대상은 **처방하는 문서**뿐이다(스킬 3 + 깨우는 훅 1). 가드 내부·차단 사유·금지 목록·
 *   이력 주석은 그 이름을 «써야» 일하므로 여기 안 넣는다 — 넣으면 제외 목록이 폭발한다.
 * 🚫 예외 표기(「옛 …」 같은 꼬리표)로 통과시키기 — 이 넷은 그 이름을 적을 이유가 0 이고,
 *    한 칸이라도 열면 다음 이주 때 그 칸으로 되돌아온다. */
test('🔴 [F103] 처방 문서가 「가드가 막는 보드 파일」을 가리키지 않는다', () => {
  const 스텁 = 'docs/세션보드.md';

  // ① 전제 — 정말 막히는가. 안 막히면 ②의 금지는 근거가 없다.
  const 전제 = 판정({
    tool_name: 'Write',
    tool_input: { file_path: path.join(TMP, ...스텁.split('/')), content: table(3) },
  });
  assert.strictEqual(전제.결정, 'deny',
    `${스텁} 가 더 이상 안 막힌다 — 이 검사의 전제가 바뀌었다(아래 금지도 같이 재검토한다)`);

  // ② 그러면 어떤 처방도 거기 쓰라고 시키면 안 된다.
  const ROOT = path.join(__dirname, '..');
  for (const rel of [
    '.claude/skills/close/SKILL.md',
    '.claude/skills/deploy/SKILL.md',
    '.claude/skills/evolve/SKILL.md',
    '.claude/hooks/context-budget.js',
  ]) {
    const 본문 = fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
    const 줄 = 본문.split('\n').filter((l) => l.includes(스텁));
    /* ⚠ 메시지는 **미리 만들어지지 않게** 한다 — assert 의 message 인자는 통과할 때도 평가돼서
     *   `줄[0]` 을 그대로 쓰면 초록이어야 할 자리에서 TypeError 로 죽는다(첫 판에 실측). */
    assert.deepStrictEqual(줄, [],
      `${rel} 가 «${스텁}» 를 가리킨다 — 따라 하면 board-guard 가 막는다(F103).\n`
      + `  정본은 \`docs/_ops/보드/<지문>.md\` 이고 표는 \`node tools/board.js\` 로 본다.\n`
      + `  걸린 줄: ${(줄[0] || '').trim().slice(0, 160)}`);
  }
});

/* ── ⑧-c · F495 「주인을 못 잰 보드 파일」이 **제3칸**으로 서는가 (2026-08-16) ──────────────
 * 무엇이 새던 자리인가: `board-id.파일지문()` 은 이름이 `<8자리 hex>.md` 가 아니면 `''` 을 내는데,
 * 소비자(`원칙7처방`·상한 셈의 F372 빼기)가 그 빈 값을 **「죽지 않았다」로 접었다.** 칸이
 * 「살았다 / 죽었다」 둘뿐이라 「못 쟀다」가 산 쪽으로 접히고, 그 방향은 영구 잠금이다 —
 * 주인이 죽어도 죽은 줄 목록에 안 떠서 board-move 처방을 아무도 못 받는다.
 *
 * ⚠ 왜 **픽스처로만** 재나: 실저장소에는 지금 어긋난 이름이 1건 실재한다(`local_008484b1.md`).
 *   실저장소에 대고 「그 알림이 없다」를 걸면 그 줄이 고쳐지는 순간 빨개지는 회귀가 된다 —
 *   버그가 아직 있을 것을 요구하는 회귀의 거울상이다. 탐지력은 픽스처가 지고 실저장소에는
 *   아무것도 안 건다(CLAUDE.md 가드 맹점 ②). */
const 표머리F495 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'].join('\n') + '\n';

test('🔴 F495 탐지력 — 지문 꼴이 아닌 보드 파일을 **이름을 대고** 드러낸다(막지는 않는다)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f495-detect-'));
  fs.writeFileSync(보드파일(root, 'local_008484b1'), 표머리F495 + activeRow(1) + '\n', 'utf8');
  const 내파일 = 보드파일(root, 'aaaa1111');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: 표머리F495 + activeRow(2) + '\n' } });
  assert.strictEqual(r.결정, 'allow',
    '막으면 안 된다 — ⑧-c 는 드러내는 층이다. 생성 deny 는 비지문 이름을 «아직 없는 파일 + 통과 기대»로 넣는 남의 픽스처를 죽인다(맹점 ③)');
  assert.match(r.알림, /못 잰/, '「못 쟀다」 칸이 안 섰다 — 살았다/죽었다 둘로 접히면 F495 그대로다');
  assert.match(r.알림, /local_008484b1\.md/, '이름을 안 대면 어느 파일인지 못 찾아 처방이 안 돈다');
  assert.match(r.알림, /git mv/, '고치는 명령이 없으면 따를 수 없는 처방이다(F103)');
});

test('🟢 F495 거짓양성 0 — 보드 파일 이름이 전부 지문 꼴이면 그 알림은 안 뜬다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f495-clean-'));
  fs.writeFileSync(보드파일(root, 'bbbb2222'), 표머리F495 + activeRow(1) + '\n', 'utf8');
  const 내파일 = 보드파일(root, 'aaaa1111');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: 표머리F495 + activeRow(2) + '\n' } });
  assert.doesNotMatch(r.알림, /못 잰/, '멀쩡한 이름에 대고 짖으면 그 알림은 곧 안 읽힌다');
});
