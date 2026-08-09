/* 보드 정본이 세션별 파일로 갈린 뒤의 회귀 (F250).
 *
 * 옛 `tests/board-guard.test.js` 는 **한 파일 안**의 상한·칸 길이를 잰다. 여기가 재는 것은
 * 그 위층이다 — 여러 파일에서 표가 조립되는가, 「폴더를 못 읽음」과 「비었다」가 갈리는가,
 * 그리고 옛 파일로 가는 길이 막히되 **그 가드가 시키는 일까지 막지는 않는가**(F103).
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

function 저장소(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardfolder-'));
  const 폴더 = path.join(dir, 'docs', '_ops', '보드');
  fs.mkdirSync(폴더, { recursive: true });
  for (const [이름, 내용] of Object.entries(파일들 || {})) {
    fs.writeFileSync(path.join(폴더, `${이름}.md`), 내용, 'utf8');
  }
  return dir;
}

const 행 = (날짜, 트랙, 상태) => `| ${날짜} | ${트랙} | Code.js \`local_deadbeef\` | ${상태} |`;

/** 훅을 띄워 판정을 받는다. deny 면 그 사유, 아니면 null. */
function 판정(input, cwd) {
  try {
    const out = execFileSync('node', [HOOK], {
      input: JSON.stringify(input), encoding: 'utf8', stdio: 'pipe', cwd: cwd || process.cwd(),
    });
    if (!out.trim()) return null;
    const j = JSON.parse(out);
    const h = j.hookSpecificOutput || {};
    return h.permissionDecision === 'deny' ? String(h.permissionDecisionReason || '') : null;
  } catch (e) {
    const out = String((e && e.stdout) || '');
    if (!out.trim()) return null;
    try {
      const h = JSON.parse(out).hookSpecificOutput || {};
      return h.permissionDecision === 'deny' ? String(h.permissionDecisionReason || '') : null;
    } catch (_) { return null; }
  }
}

// ── 조립 ────────────────────────────────────────────────────────────
test('🔑 표는 세션 파일 여럿에서 조립된다 — 그리고 디스크에 안 쓴다', () => {
  const dir = 저장소({ aaaa1111: 행('2026-08-02', '나중', '작업중') + '\n', bbbb2222: 행('2026-08-01', '먼저', '완료') + '\n' });
  const t = 보드.텍스트(dir);
  const 행들 = t.split('\n').filter(보드.데이터행);
  assert.strictEqual(행들.length, 2);
  assert.match(행들[0], /먼저/, '날짜 오름차순이 아니다 — 정렬 기준이 파일 mtime 으로 새면 기계마다 표가 달라진다');
  assert.match(행들[1], /나중/);
  assert.ok(!fs.existsSync(path.join(dir, 'docs', '세션보드.md')), '조립이 파생 파일을 만들었다 — 그러면 충돌이 자리만 옮긴다');
});

test('🔑 정렬은 파일 mtime 이 아니라 **날짜 칸**이다 (체크아웃마다 순서가 뒤집히면 안 된다)', () => {
  const dir = 저장소({});
  const 폴더 = path.join(dir, 'docs', '_ops', '보드');
  // 늦은 날짜를 **먼저** 쓴다 — mtime 순이면 여기서 뒤집힌다
  fs.writeFileSync(path.join(폴더, 'zzzz9999.md'), 행('2026-08-09', '늦은날', '작업중') + '\n', 'utf8');
  fs.writeFileSync(path.join(폴더, 'aaaa0000.md'), 행('2026-08-01', '이른날', '작업중') + '\n', 'utf8');
  const 행들 = 보드.줄들(dir).map((r) => r.줄);
  assert.match(행들[0], /이른날/);
  assert.match(행들[1], /늦은날/);
});

// ── 「못 읽음」 ≠ 「비었다」 ──────────────────────────────────────────
test('🔑 폴더가 없으면 null 이다 — 인계문이 그 차이로 「내 줄이 정말 없다」를 단정한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardfolder-none-'));
  assert.strictEqual(보드.줄들(dir), null);
  assert.strictEqual(보드.텍스트(dir), null);
});

test('폴더가 있고 파일이 0개면 **빈 표**다 (null 아님) — 둘을 뭉개면 못 본 것을 없다고 말한다', () => {
  const dir = 저장소({});
  const t = 보드.텍스트(dir);
  assert.notStrictEqual(t, null);
  assert.strictEqual(t.split('\n').filter(보드.데이터행).length, 0);
});

// ── 옛 파일로 가는 길 ────────────────────────────────────────────────
test('🔑 옛 `세션보드.md` 에 표 행을 쓰면 막는다 — 조립된 표에 안 실려 선언이 증발한다', () => {
  const dir = 저장소({});
  const p = path.join(dir, 'docs', '세션보드.md');
  fs.writeFileSync(p, '# 스텁\n', 'utf8');
  const r = 판정({ tool_name: 'Edit', tool_input: { file_path: p, old_string: '# 스텁', new_string: `# 스텁\n${행('2026-08-08', '새 트랙', '작업중')}` } });
  assert.ok(r, '옛 파일에 표 행을 쓰는데 통과했다');
  assert.match(r, /docs\/_ops\/보드/, '처방이 새 자리를 안 가리킨다');
});

test('🔴 F103 자기 처방 — 옛 파일을 스텁으로 바꾸거나 지우는 편집은 통과한다', () => {
  const dir = 저장소({});
  const p = path.join(dir, 'docs', '세션보드.md');
  fs.writeFileSync(p, `# 세션보드\n\n${행('2026-08-01', '옛 줄', '완료')}\n`, 'utf8');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: p, content: '# 세션보드 — 여기가 아니다\n\n정본은 docs/_ops/보드/ 다.\n' } });
  assert.strictEqual(r, null, '이 가드가 시키는 이주를 이 가드가 막는다 — 그러면 우회가 정상 통로가 된다');
});

// ── 상한은 표 전체를 재되, 남의 위반으로 나를 막지 않는다 ──────────────
test('🔑 상한은 **남의 세션 파일까지** 합쳐 잰다 — 내 파일엔 내 줄만 있다', () => {
  const 남 = {};
  for (let i = 0; i < 13; i++) 남[`peer${i}`] = 행('2026-08-01', `트랙${i}`, '작업중') + '\n';
  const dir = 저장소(남);
  const 내파일 = path.join(dir, 'docs', '_ops', '보드', 'mine0001.md');
  /* 🔑 내 줄을 **이미 하나** 둔다 (F278 · 2026-08-09). 상한은 「세션의 첫 선언 1줄」을 비켜 주므로
   *   빈 파일에서 재면 이 검사가 **상한이 아니라 그 면제**를 재게 된다(측정 대상이 바뀐다).
   *   여기서 지키려는 성질은 그대로다 — 남의 세션 파일 줄이 내 판정에 합쳐지는가. 합쳐지지
   *   않으면 활성은 2로 보여 아래 차단이 안 난다. 면제 자체의 탐지는 tests/board-guard 가 진다. */
  const 첫줄 = 행('2026-08-08', '내 첫 트랙', '작업중');
  fs.writeFileSync(내파일, `${첫줄}\n`, 'utf8');
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: `${첫줄}\n${행('2026-08-08', '내 둘째 트랙', '작업중')}\n` } });
  assert.ok(r, '남의 활성 13줄 위에 내가 1줄을 더했는데 상한이 안 걸렸다 — 파일이 갈리면서 전체를 못 재게 된 것이다');
  assert.match(r, /활성/);
});

test('🔴 F233 축 — 내 파일이 아직 없어도(첫 선언) 남의 위반이 나를 막는 쪽으로 세지 않는다', () => {
  // 남의 완료 줄 17개 = 전체 상한(18) 직전. 내 첫 선언 1줄은 18줄이라 아직 통과여야 한다.
  const 남 = {};
  for (let i = 0; i < 17; i++) 남[`peer${i}`] = 행('2026-08-01', `트랙${i}`, '완료') + '\n';
  const dir = 저장소(남);
  const 내파일 = path.join(dir, 'docs', '_ops', '보드', 'mine0002.md');   // ← 아직 없는 파일
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 내파일, content: 행('2026-08-08', '내 트랙', '작업중') + '\n' } });
  assert.strictEqual(r, null, '내 첫 선언이 남의 줄 때문에 막혔다 — 편집 전 판에 남의 줄이 안 붙은 것이다');
});

test('🔴 F204 축 — 상대경로로 들어와도 대상으로 본다 (앞의 `/` 를 요구하면 통째로 샌다)', () => {
  const dir = 저장소({ peer0: 행('2026-08-01', '남', '작업중') + '\n' });
  const 상대 = 'docs/_ops/보드/mine0003.md';
  fs.writeFileSync(path.join(dir, 상대), '', 'utf8');
  const 긴칸 = '가'.repeat(260);
  const r = 판정({ tool_name: 'Write', tool_input: { file_path: 상대, content: `| 2026-08-08 | ${긴칸} | Code.js \`local_deadbeef\` | 작업중 |\n` } }, dir);
  assert.ok(r, '상대경로라 검사를 통째로 건너뛰었다');
  assert.match(r, /칸 길이/);
});
