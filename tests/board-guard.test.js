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
const row = (i) => `| 2026-08-01 | 트랙${i} | Code.js | 완료 |`;
const activeRow = (i) => `| 2026-08-01 | 트랙${i} | Code.js | 작업중 |`;
const table = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...Array.from({ length: n }, (_, i) => row(i))].join('\n');
const activeTable = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...Array.from({ length: n }, (_, i) => activeRow(i))].join('\n');
fs.writeFileSync(BOARD, table(11), 'utf8');

function decide(payload) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  if (!out.trim()) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

/** 차단 사유까지 본다 — 「막았다」만으로는 **왜** 막았는지·안내가 맞는지 못 잰다. */
function 판정(payload) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
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
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: '| 2026-08-01 | 새 트랙 | Code.js | 작업중 |' } }),
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
const boldRow = (i) => `| 2026-08-01 | 트랙${i} | Code.js | **완료** — 라이브 v9.1${i} |`;
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
  ...Array.from({ length: n }, (_, i) => `| 2026-08-04 | 트랙${i} | Code.js | ${문구} |`)].join('\n');

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
