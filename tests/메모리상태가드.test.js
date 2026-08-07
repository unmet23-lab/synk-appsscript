/* 메모리상태가드 회귀 (F108) — 해소를 적는 순간 같은 파일의 남은 ⏳ 가 실제로 눈앞에 오는가.
 *
 * 세 층 전부 본다(CLAUDE.md 「가드는 로직보다 등록층에서 샌다」):
 *   · 로직 — 발동 조건 넷이 각각 **혼자서** 발동을 막는가(하나만 검사하면 나머지 셋은 공허하다)
 *   · 등록층 — settings.json 에 실제로 걸려 있고, 라우팅이 훅보다 넓은가
 *   · 자기 처방(F103) — 메시지가 시키는 대로 하면 **통과**하는가. 따를 수 없는 처방은 우회를 만든다.
 *
 * 탐지력은 픽스처가 진다 — 실저장소 메모리는 repo 밖이라 CI 에 없다(없으면 skip 으로 드러낸다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'memory-status-guard.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');
const guard = require(HOOK);

const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mem-status-t-'));
test.after(() => { try { fs.rmSync(임시, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } });

let seq = 0;
const 새세션 = () => `t${process.pid}-${(seq += 1)}`;

/** 픽스처 메모리 폴더 하나 — 폴더마다 갈라 놔야 검사끼리 안 섞인다. */
function 메모리(파일들) {
  const dir = fs.mkdtempSync(path.join(임시, 'mem-'));
  for (const [name, body] of Object.entries(파일들)) fs.writeFileSync(path.join(dir, name), body, 'utf8');
  return dir;
}

/** 훅을 **서브프로세스로** 부른다 — require 로 로직만 부르면 stdin·표시파일·종료코드를 다 건너뛴다. */
function 호출(opts) {
  const 입력 = JSON.stringify({
    tool_name: opts.tool || 'Edit',
    session_id: opts.session || 새세션(),
    tool_input: opts.input,
  });
  const out = execFileSync(process.execPath, [HOOK], {
    input: 입력,
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_MEMORY_DIR: opts.dir,
      SYNK_MEMORY_STATUS_DIR: opts.markDir || path.join(임시, 'marks'),
    },
  });
  if (!out.trim()) return { decision: 'allow', reason: '' };
  const j = JSON.parse(out);
  return { decision: j.hookSpecificOutput.permissionDecision, reason: j.hookSpecificOutput.permissionDecisionReason };
}

const 미결본문 = [
  '# 트랙',
  '',
  '- ⏳유호 = 목소리폼 미션ID 문항 승인 — 폼이 유호님 작성물이라 제안만.',
  '- ⏳ 남은 것 = 인쇄 육안 확인.',
  '',
].join('\n');

// ── ① 대상 판정 ─────────────────────────────────────────────────────────────

test('메모리 토픽 .md 는 대상이고, 인덱스·repo 파일·비 md 는 아니다', () => {
  const dir = 'C:/x/.claude/projects/slug/memory';
  assert.ok(guard.대상인가(`${dir}/hw-schema-audit-2026-08-05.md`, dir));
  assert.ok(!guard.대상인가(`${dir}/MEMORY.md`, dir), '인덱스는 지도다 — memory-index-guard 몫');
  assert.ok(!guard.대상인가(`${dir}/note.txt`, dir));
  assert.ok(!guard.대상인가('C:/repo/docs/세션보드.md', dir), 'repo 문서는 대상이 아니다');
  assert.ok(!guard.대상인가(`${dir}sibling/x.md`, dir), '접두어만 같은 옆 폴더를 삼키면 안 된다');
});

/* 인덱스는 **두 파일**이다(F184 쪼개기) — 이름을 여기 다시 적지 않고 등록층을 그대로 돈다.
 * 한 이름만 알면 지도.md 가 토픽으로 읽혀, 압축 편집마다 「남은 ⏳ 를 닫아라」가 헛 발화한다. */
test('인덱스 목록은 memory-graph 하나에서 파생한다 — 지도.md 도 대상이 아니다', () => {
  const dir = 'C:/x/.claude/projects/slug/memory';
  const { INDEX_FILES } = require('../tools/memory-graph.js');
  assert.ok(INDEX_FILES.length >= 2, '인덱스가 한 파일로 되돌아가면 이 검사가 무의미해진다');
  for (const n of INDEX_FILES) {
    assert.ok(!guard.대상인가(`${dir}/${n}`, dir), `${n} 은 인덱스다 — 토픽으로 읽으면 안 된다`);
  }
});

// ── ② 발동 — 조건 넷이 각각 혼자서 막는가 ───────────────────────────────────

test('해소를 적는데 ⏳ 가 남아 있으면 막고 남은 줄을 보여준다', () => {
  const dir = 메모리({ 't.md': 미결본문 });
  const r = 호출({
    dir,
    input: { file_path: path.join(dir, 't.md'), old_string: '# 트랙', new_string: '# 트랙\n\n- ✅ 라이브 반영 종결 [v9.190]' },
  });
  assert.strictEqual(r.decision, 'deny');
  assert.match(r.reason, /살아 있는 ⏳ 가 2줄/);
  assert.match(r.reason, /목소리폼 미션ID/, '남은 줄의 내용이 있어야 판정을 할 수 있다');
  // 행 번호는 안 쓴다 — 이 창의 번호는 「편집 후」 기준이라 디스크와 어긋나고, 곧 밀린다.
  assert.ok(!/\d+행/.test(r.reason), '행 번호를 근거로 주면 엉뚱한 줄을 고치러 간다');
});

test('해소 표기가 없는 편집은 조용히 통과한다 (조건②)', () => {
  const dir = 메모리({ 't.md': 미결본문 });
  const r = 호출({ dir, input: { file_path: path.join(dir, 't.md'), old_string: '# 트랙', new_string: '# 트랙 — 배경 보강' } });
  assert.strictEqual(r.decision, 'allow');
});

test('남은 ⏳ 가 없으면 통과한다 (조건③)', () => {
  const dir = 메모리({ 't.md': '# 트랙\n\n- ✅ 다 끝났다.\n' });
  const r = 호출({ dir, input: { file_path: path.join(dir, 't.md'), old_string: '다 끝났다.', new_string: '다 끝났다 — 종결.' } });
  assert.strictEqual(r.decision, 'allow');
});

test('이번 편집이 ⏳ 를 줄였으면 통과한다 — 제자리 갱신을 이미 한 것이다 (조건④)', () => {
  const dir = 메모리({ 't.md': 미결본문 });
  const r = 호출({
    dir,
    input: {
      file_path: path.join(dir, 't.md'),
      old_string: '- ⏳유호 = 목소리폼 미션ID 문항 승인',
      new_string: '- ✅유호 = 목소리폼 미션ID 문항 승인 — 라이브 종결',
    },
  });
  assert.strictEqual(r.decision, 'allow', '제자리 갱신을 한 세션을 또 막으면 그게 거짓양성이다');
});

test('편집을 적용한 **뒤**로 판정한다 — 편집 전 본문으로 세면 안 된다', () => {
  // 편집이 ⏳ 두 줄을 다 지우면(해소 표기 포함) 남은 게 0이라 통과여야 한다
  const dir = 메모리({ 't.md': 미결본문 });
  const r = 호출({
    dir,
    tool: 'Write',
    input: { file_path: path.join(dir, 't.md'), content: '# 트랙\n\n- ✅ 전부 종결.\n' },
  });
  assert.strictEqual(r.decision, 'allow');
});

// ── ③ 판정 단일원천 — 큐가 안 배달하는 줄은 「남은 것」이 아니다 ─────────────

test('취소선으로 닫힌 ⏳ 와 헤더 ⏳ 는 남은 것으로 세지 않는다 (큐와 같은 판정 하나)', () => {
  const 본문 = [
    '## ⏳ 남은 것',
    '',
    '- ~~⏳유호 승인 대기 = clasp push~~ → ✅ 해소.',
    '',
  ].join('\n');
  assert.deepStrictEqual(guard.살아있는(본문), [], '헤더는 구획 이름, 취소선은 철회 — 둘 다 배달되지 않는다');
  const dir = 메모리({ 't.md': 본문 });
  const r = 호출({ dir, input: { file_path: path.join(dir, 't.md'), old_string: '## ⏳ 남은 것', new_string: '## ⏳ 남은 것\n\n- ✅ 완료' } });
  assert.strictEqual(r.decision, 'allow');
});

test('큐의 줄판정과 같은 함수를 쓴다 — 훅이 자기 정규식을 따로 갖지 않는다', () => {
  const 원본 = fs.readFileSync(HOOK, 'utf8');
  assert.match(원본, /require\([^)]*decision-queue[^)]*\)/, '판정은 decision-queue 에서 파생해야 갈라지지 않는다');
  assert.ok(!/includes\('⏳'\)|\/⏳\//.test(원본.replace(/^\s*[/*].*$/gm, '')), '훅 로직이 ⏳ 를 직접 세면 두 판정이 갈라진다');
});

// ── ④ 편집 적용기 ───────────────────────────────────────────────────────────

test('Edit·replace_all·MultiEdit 를 실제로 적용해서 본다', () => {
  assert.strictEqual(guard.편집후('Edit', { old_string: 'a', new_string: 'b' }, 'a a'), 'b a');
  assert.strictEqual(guard.편집후('Edit', { old_string: 'a', new_string: 'b', replace_all: true }, 'a a'), 'b b');
  assert.strictEqual(guard.편집후('MultiEdit', { edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'b', new_string: 'c' }] }, 'a'), 'c');
  assert.strictEqual(guard.편집후('Write', { content: 'z' }, 'a'), 'z');
});

// ── ⑤ 세션·파일당 1회 ───────────────────────────────────────────────────────

test('같은 세션·같은 파일은 1회만 막고, 다른 파일은 다시 뜬다', () => {
  const dir = 메모리({ 'a.md': 미결본문, 'b.md': 미결본문 });
  const markDir = path.join(임시, `marks-${새세션()}`);
  const s = 새세션();
  const 편집 = (f) => ({ file_path: path.join(dir, f), old_string: '# 트랙', new_string: '# 트랙\n- ✅ 종결' });
  assert.strictEqual(호출({ dir, session: s, markDir, input: 편집('a.md') }).decision, 'deny');
  assert.strictEqual(호출({ dir, session: s, markDir, input: 편집('a.md') }).decision, 'allow', '재실행은 통과해야 한다 — 막는 게 목적이 아니다');
  assert.strictEqual(호출({ dir, session: s, markDir, input: 편집('b.md') }).decision, 'deny', '파일이 다르면 남은 ⏳ 도 다르다');
});

// ── ⑥ 등록층 — 새는 방향은 언제나 「통과」다 ────────────────────────────────

test('settings.json PreToolUse 에 Edit|Write|MultiEdit 로 등록돼 있다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const 훅들 = (s.hooks.PreToolUse || []).flatMap((g) => (g.hooks || []).map((h) => ({ matcher: g.matcher || '', cmd: String(h.command || '') })));
  const 내것 = 훅들.filter((h) => h.cmd.includes('memory-status-guard.js'));
  assert.strictEqual(내것.length, 1, '등록이 0이면 훅은 존재만 하고 안 돈다(F127)');
  for (const t of ['Edit', 'Write', 'MultiEdit']) assert.ok(내것[0].matcher.includes(t), `매처가 ${t} 를 안 잡는다`);
});

test('라우팅이 훅보다 넓다 — 앞단 필터가 메모리 경로를 걸러내지 않는다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const cmd = (s.hooks.PreToolUse || [])
    .flatMap((g) => g.hooks || [])
    .map((h) => String(h.command || ''))
    .find((c) => c.includes('memory-status-guard.js'));
  const 필터 = /case\s+"\$IN"\s+in\s+([^)]*)\)/.exec(cmd);
  if (!필터) return; // 필터가 없으면 훅이 전부 본다 — 가장 넓다
  assert.match(필터[1], /\*memory\*|\*\.md\*/, '앞단 case 필터가 훅보다 좁으면 그 자체가 구멍이다(가드 맹점③)');
});

test('실행 불가는 통과가 아니라 deny 로 드러낸다 (F044)', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const cmd = (s.hooks.PreToolUse || [])
    .flatMap((g) => g.hooks || [])
    .map((h) => String(h.command || ''))
    .find((c) => c.includes('memory-status-guard.js'));
  assert.match(cmd, /CLAUDE_PROJECT_DIR:-\$PWD/, '로컬 절대경로로 박으면 다른 기계에서 통째로 죽는다');
  assert.match(cmd, /permissionDecision\\?":\\?"deny/, 'node·훅 파일이 없을 때 조용히 통과하면 안 된다');
});

// ── ⑦ 자기 처방 (F103) — 시키는 대로 하면 통과하는가 ────────────────────────

test('메시지가 시키는 --check 명령이 실제로 돈다', () => {
  const dir = 메모리({ 't.md': 미결본문 });
  const 파일 = path.join(dir, 't.md');
  const r = 호출({ dir, input: { file_path: 파일, old_string: '# 트랙', new_string: '# 트랙\n- ✅ 종결' } });
  const m = /node (\.claude[^\n"]*?) --check "([^"]+)"/.exec(r.reason);
  assert.ok(m, '처방에 실행 가능한 명령이 있어야 한다');
  let out; let code = 0;
  try { out = execFileSync(process.execPath, [path.join(ROOT, m[1]), '--check', m[2]], { encoding: 'utf8' }); }
  catch (e) { out = String(e.stdout || ''); code = e.status; }
  assert.strictEqual(code, 1, '살아 있는 ⏳ 가 있으면 1 로 끝난다(0=없음)');
  assert.match(out, /살아 있는 ⏳ 2건/, '훅이 센 숫자와 --check 가 센 숫자가 같아야 한다 — 잴 통로는 하나다(F052)');
});

test('처방대로 그 줄을 제자리에서 ⏳→✅ 로 고치면 통과한다 — 처방이 자기 가드에 안 막힌다', () => {
  const dir = 메모리({ 't.md': 미결본문 });
  const markDir = path.join(임시, `marks-처방-${새세션()}`);
  const s = 새세션();
  const 파일 = path.join(dir, 't.md');
  assert.strictEqual(호출({ dir, session: s, markDir, input: { file_path: 파일, old_string: '# 트랙', new_string: '# 트랙\n- ✅ 종결' } }).decision, 'deny');
  // 세션이 처방을 따른다: 남은 줄을 제자리에서 닫는다 (표시가 이미 있어도, 조건④ 만으로도 통과해야 한다)
  const 처방 = 호출({
    dir,
    session: 새세션(),
    markDir: path.join(임시, `marks-처방2-${새세션()}`),
    input: { file_path: 파일, old_string: '- ⏳ 남은 것 = 인쇄 육안 확인.', new_string: '- ✅ 남은 것 = 인쇄 육안 확인 — 완료.' },
  });
  assert.strictEqual(처방.decision, 'allow', '처방을 따를 수 없으면 우회가 정상 통로가 된다(F103)');
});

// ── ⑧ 실저장소 — 거짓양성만 본다(메모리는 repo 밖이라 CI 엔 없다) ───────────

test('실저장소 메모리에서 --check 가 크래시 없이 돈다', (t) => {
  const { memoryDir } = require(path.join(ROOT, 'tools', 'memory-graph.js'));
  const dir = memoryDir();
  if (!fs.existsSync(dir)) return t.skip('메모리 폴더가 없다 — repo 밖 상태라 CI 에선 정상(통과와 미실행을 가른다)');
  const 파일 = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'MEMORY.md').slice(0, 5);
  for (const f of 파일) {
    const 남은 = guard.살아있는(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.ok(Array.isArray(남은), `${f} 판정이 배열이 아니다`);
  }
});

/* ── ⑨ 파일명 정책 (F181) ────────────────────────────────────────────────────
 * 인덱스 링크의 `-YYYY-MM-DD` 11자가 매 세션 전량 로드에 곱해진다. 한 번 걷어내도
 * 다음 세션이 습관대로 날짜를 붙이면 한 줄씩 되돌아온다 — 그래서 걷어낸 그 자리에 장치를 둔다. */

test('새 메모리 파일명에 날짜 접미사를 달면 막고, 날짜 뗀 이름을 처방한다', () => {
  const dir = 메모리({});
  const r = 호출({ dir, tool: 'Write', input: { file_path: path.join(dir, 'foo-2026-08-08.md'), content: '# foo\n' } });
  assert.strictEqual(r.decision, 'deny');
  assert.match(r.reason, /`foo\.md`/, '처방에 쓸 이름이 그대로 있어야 따라할 수 있다');
});

test('이미 있는 날짜 파일을 고치는 것은 막지 않는다 — 옛 메모리가 인질이 되면 훅을 끈다', () => {
  const dir = 메모리({ 'app-feature-audit-2026-07-27.md': '# 옛 메모\n' });
  const r = 호출({
    dir,
    input: { file_path: path.join(dir, 'app-feature-audit-2026-07-27.md'), old_string: '# 옛 메모', new_string: '# 옛 메모 — 보강' },
  });
  assert.strictEqual(r.decision, 'allow');
});

test('처방대로 날짜 뗀 이름으로 쓰면 통과한다 — 처방이 자기 가드에 안 막힌다 (F103)', () => {
  const dir = 메모리({});
  const 막힘 = 호출({ dir, tool: 'Write', input: { file_path: path.join(dir, 'bar-2026-08-08.md'), content: '# bar\n' } });
  const 시킨이름 = /`([^`]+\.md)`/.exec(막힘.reason);
  assert.ok(시킨이름, '처방에 파일명이 있어야 한다');
  const r = 호출({ dir, tool: 'Write', input: { file_path: path.join(dir, 시킨이름[1]), content: '# bar\n' } });
  assert.strictEqual(r.decision, 'allow', '따를 수 없는 처방은 우회를 정상 통로로 만든다');
});

test('날짜가 아닌 이름·연월만·인덱스는 이 판정에 안 걸린다', () => {
  assert.ok(guard.날짜파일명('/m/foo-2026-08-08.md'));
  assert.ok(!guard.날짜파일명('/m/foo.md'));
  assert.ok(!guard.날짜파일명('/m/foo-2026-07.md'), '연월만 붙은 옛 이름은 이번 정책 밖이다');
  assert.ok(!guard.날짜파일명('/m/v2-plan.md'), '이름 안의 숫자를 날짜로 읽으면 안 된다');
  assert.strictEqual(guard.날짜뗀이름('/m/foo-2026-08-08.md'), 'foo.md');
});

test('실저장소 인덱스에 날짜 링크가 없다 — 되돌아왔으면 여기서 드러난다', (t) => {
  const { memoryDir } = require(path.join(ROOT, 'tools', 'memory-graph.js'));
  const 인덱스 = path.join(memoryDir(), 'MEMORY.md');
  if (!fs.existsSync(인덱스)) return t.skip('메모리 인덱스가 없다 — repo 밖이라 CI 에선 정상');
  const 날짜링크 = (fs.readFileSync(인덱스, 'utf8').match(/\]\([^)\s]*-\d{4}-\d{2}-\d{2}\.md\)/g) || []);
  assert.deepStrictEqual(날짜링크, [], `인덱스 링크에 날짜가 ${날짜링크.length}건 되돌아왔다 — 줄마다 11자가 매 세션 곱해진다(F181)`);
});
