/**
 * context-budget 훅 회귀 — 「끊을 지점」 신호가 실제로 켜지고, 아닐 때 안 켜진다
 *
 * 왜 있나 — 이 훅은 **막지 않는** 계기판이라 고장 나도 아무것도 안 깨진다.
 *   즉 조용히 죽어도 화면은 평소와 똑같다(= 가드가 새는 방향은 언제나 「통과」).
 *   그래서 탐지 능력을 픽스처로 못박는다.
 *
 * 탐지 능력은 **픽스처가 진다** — 실저장소·실세션 트랜스크립트에 기대지 않는다.
 *   실환경 의존 검사(git 트리 상태 등)는 CI에서 깨지거나 조용히 미실행된다(CLAUDE.md).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'context-budget.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');

/** usage 레코드 한 줄. 세 항목의 **합**이 컨텍스트다(하나만 크면 안 걸려야 한다). */
function line(read, create, inp) {
  return JSON.stringify({
    type: 'assistant',
    message: {
      usage: {
        input_tokens: inp || 0,
        cache_read_input_tokens: read || 0,
        cache_creation_input_tokens: create || 0,
        output_tokens: 500,
      },
    },
  });
}

let tmpRoot;
test.before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ctxbudget-'));
});
test.after(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 무해 */ }
});

let seq = 0;
/** 픽스처 트랜스크립트를 만들고 훅을 돌려 stdout 을 판정으로 돌려준다 */
function runHook(lines, opts) {
  const o = opts || {};
  const tp = path.join(tmpRoot, `t${seq++}.jsonl`);
  fs.writeFileSync(tp, lines.join('\n') + '\n');
  const input = JSON.stringify({
    session_id: 'ctxbudget-test',
    hook_event_name: 'Stop',
    transcript_path: 'transcript_path' in o ? o.transcript_path : tp,
    cwd: o.cwd || path.join(tmpRoot, 'not-a-git-repo'),
  });
  // 발화는 단계당 1회라 카운터가 남는다 — 기본은 **호출마다 새 폴더**로 격리하고,
  // 중복 억제를 검사하는 테스트만 stateDir 를 공유해 넘긴다.
  const stateDir = o.stateDir || fs.mkdtempSync(path.join(tmpRoot, 'state-'));
  const r = spawnSync(process.execPath, [HOOK], {
    input, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, SYNK_CTXBUDGET_DIR: stateDir },
  });
  const out = (r.stdout || '').trim();
  if (!out) return { silent: true, status: r.status, msg: '' };
  const j = JSON.parse(out);
  return { silent: false, status: r.status, msg: String(j.systemMessage || ''), json: j };
}

test('임계 아래에서는 조용하다 — 평소 작업을 방해하지 않는다', () => {
  for (const ctx of [40_000, 90_000, 119_000]) {
    const v = runHook([line(ctx - 1000, 500, 500)]);
    assert.ok(v.silent, `${ctx} 토큰에서 말을 걸었다 — 임계(120k) 아래는 조용해야 한다`);
  }
});

test('120k 초과에서 🟡 신호를 낸다', () => {
  const v = runHook([line(125_000, 2_000, 500)]);
  assert.ok(!v.silent, '127.5k 인데 조용하다 — 신호가 안 켜졌다');
  assert.match(v.msg, /🟡/, '경고 단계 표식이 없다');
  assert.match(v.msg, /트랙을 닫을 준비/, '무엇을 하라는지가 없다');
});

test('150k 초과에서 🔴「지금 끊을 지점」으로 올라간다', () => {
  const v = runHook([line(155_000, 3_000, 500)]);
  assert.match(v.msg, /🔴/, '위험 단계 표식이 없다');
  assert.match(v.msg, /지금 끊을 지점/, '종료 지시가 없다');
});

test('컨텍스트는 세 항목의 합이다 — 한 항목만으로는 못 넘는다', () => {
  // 각각은 임계 아래지만 합치면 135k. 합산을 빠뜨리면 이 케이스가 조용해진다.
  const v = runHook([line(60_000, 60_000, 15_000)]);
  assert.ok(!v.silent, '60k+60k+15k = 135k 인데 조용하다 — 합산이 아니라 한 항목만 보고 있다');
  assert.match(v.msg, /135k/, `합산값이 안 보인다: ${v.msg}`);
});

test('🔑 마지막 usage 를 읽는다 — 컴팩트로 컨텍스트가 내려가면 신호도 꺼진다', () => {
  // 이 훅의 유일한 「조용해져야 하는」 상태 변화다. 앞줄만 보거나 최대값을 쓰면
  // 컴팩트 직후에도 계속 「끊어라」를 외쳐 신호가 무의미해진다.
  const v = runHook([
    line(175_000, 2_000, 500), // 컴팩트 직전
    line(70_000, 3_000, 500),  // 컴팩트 직후 — 실제 API 가 받은 양이 내려간다
  ]);
  assert.ok(v.silent, `컴팩트 후 73.5k 인데 아직 경고한다 — 마지막 usage 가 아니라 옛 값을 보고 있다: ${v.msg}`);
});

test('usage 없는 줄이 섞여도 마지막 usage 를 찾아낸다', () => {
  const v = runHook([
    JSON.stringify({ type: 'user', message: { content: 'x' } }),
    line(130_000, 2_000, 500),
    JSON.stringify({ type: 'user', message: { content: 'y' } }),
    '', // 빈 줄
    '{망가진 JSON',
  ]);
  assert.ok(!v.silent, '뒤에 usage 없는 줄들이 붙자 못 찾았다 — 역방향 탐색이 첫 실패에서 멈춘다');
  assert.match(v.msg, /132\.5k|133k/, `합산값이 이상하다: ${v.msg}`);
});

test('트랜스크립트가 없거나 usage 가 하나도 없으면 조용히 통과한다 (거짓양성 0)', () => {
  assert.ok(runHook([], { transcript_path: path.join(tmpRoot, '없는파일.jsonl') }).silent,
    '없는 트랜스크립트에 반응했다');
  assert.ok(runHook([], { transcript_path: '' }).silent, '빈 경로에 반응했다');
  assert.ok(runHook([JSON.stringify({ type: 'user', message: { content: 'x' } })]).silent,
    'usage 가 없는데 반응했다');
});

test('git 을 못 부르는 위치에서도 죽지 않고, 미커밋을 「0건」으로 단정하지 않는다', () => {
  const v = runHook([line(155_000, 1_000, 500)], { cwd: path.join(tmpRoot, 'not-a-git-repo') });
  assert.strictEqual(v.status, 0, '비-git 위치에서 훅이 실패 종료했다 — 계기판이 작업을 방해하면 안 된다');
  assert.doesNotMatch(v.msg, /잃는 게 없다/,
    'git 판정 불가인데 「미커밋 0건」 쪽 문구를 냈다 — 모름과 0건은 다르다');
  assert.match(v.msg, /미커밋 확인/, '판정 불가일 때 확인을 시키지 않는다');
});

test('미커밋이 있으면 커밋을 먼저 시키고, 없으면 끊어도 된다고 말한다', (t) => {
  const g = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음 — 미커밋 분기 검사 건너뜀');

  const repo = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패 — 분기 검사 건너뜀');

  const clean = runHook([line(155_000, 1_000, 500)], { cwd: repo });
  assert.match(clean.msg, /잃는 게 없다/, `미커밋 0건인데 안전 문구가 없다: ${clean.msg}`);

  fs.writeFileSync(path.join(repo, '새파일.txt'), 'x');
  const dirty = runHook([line(155_000, 1_000, 500)], { cwd: repo });
  assert.match(dirty.msg, /미커밋 1건 먼저 커밋/, `미커밋 1건을 못 셌다: ${dirty.msg}`);
});

test('🔑 AI 를 깨우지 않는다 — additionalContext 를 내지 않는다', () => {
  // 신설 당일 실측된 자기모순: additionalContext 는 AI 에게 주입돼 새 턴을 깨우고,
  // Stop 훅이라 그 턴이 끝나면 또 발화한다 → 유호님 입력 없이 144k→147k→148k→149k 로 4연속.
  // 컨텍스트를 아끼려는 훅이 컨텍스트를 먹는다. systemMessage(유호님 화면)만 낸다.
  const v = runHook([line(155_000, 1_000, 500)]);
  assert.ok(!v.silent, '경고가 안 나왔다');
  assert.strictEqual(v.json.hookSpecificOutput, undefined,
    'hookSpecificOutput 이 붙었다 — additionalContext 는 AI 턴을 깨워 무한 루프가 된다');
  assert.ok(v.json.systemMessage, '유호님 화면용 systemMessage 가 없다');
});

test('🔑 단계당 1회만 발화한다 — 같은 단계에서 두 번째부터는 조용하다', () => {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'dedup-'));
  const first = runHook([line(125_000, 2_000, 500)], { stateDir: dir });
  assert.ok(!first.silent, '첫 발화가 없다');
  for (let i = 0; i < 3; i++) {
    const again = runHook([line(126_000 + i * 1000, 2_000, 500)], { stateDir: dir });
    assert.ok(again.silent, `같은 🟡 단계에서 ${i + 2}번째로 또 떴다 — 경고가 배경 소음이 된다`);
  }
});

test('🟡 뒤 🔴 로 올라가면 한 번 더 말한다 (단계 상승은 놓치지 않는다)', () => {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'esc-'));
  assert.match(runHook([line(125_000, 2_000, 500)], { stateDir: dir }).msg, /🟡/);
  const up = runHook([line(158_000, 2_000, 500)], { stateDir: dir });
  assert.ok(!up.silent, '🔴 로 올라갔는데 조용하다 — 중복 억제가 단계 상승까지 삼켰다');
  assert.match(up.msg, /🔴/, '단계 표식이 안 올라갔다');
  assert.ok(runHook([line(160_000, 2_000, 500)], { stateDir: dir }).silent, '🔴 도 1회여야 한다');
});

test('🔑 인계 문구가 붙는다 — 새 세션에 그대로 붙여넣을 수 있어야 한다', () => {
  const v = runHook([line(155_000, 1_000, 500)]);
  assert.match(v.msg, /새 세션 열고 아래를 그대로 붙여넣으세요/, '인계 블록이 없다');
  assert.match(v.msg, /세션보드\.md/, '보드 주소가 없다 — 인계되는 셋 중 하나다');
  assert.match(v.msg, /메모리/, '메모리 언급이 없다');
  assert.match(v.msg, /미커밋/, '미커밋 상태가 인계 문구에 없다');
});

test('인계 문구는 Session-Id 트레일러로 이 세션 커밋을 찾는다 (author·시각으로 추정하지 않는다)', (t) => {
  const g = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');

  const repo = fs.mkdtempSync(path.join(tmpRoot, 'sid-'));
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  g(['config', 'user.email', 't@t'], repo);
  g(['config', 'user.name', 't'], repo);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'x');
  g(['add', 'a.txt'], repo);
  g(['commit', '-m', '내 커밋이다\n\nSession-Id: sid-MINE'], repo);
  fs.writeFileSync(path.join(repo, 'b.txt'), 'y');
  g(['add', 'b.txt'], repo);
  g(['commit', '-m', '남의 커밋이다\n\nSession-Id: sid-OTHER'], repo);

  const tp = path.join(tmpRoot, 'sid.jsonl');
  fs.writeFileSync(tp, line(155_000, 1_000, 500) + '\n');
  const run = (env) => {
    const r = spawnSync(process.execPath, [HOOK], {
      // 훅 입력의 session_id 는 **내부 에이전트 id** — 트레일러에 박히는 값이 아니다.
      input: JSON.stringify({ session_id: 'agent-내부id', hook_event_name: 'Stop', transcript_path: tp, cwd: repo }),
      encoding: 'utf8',
      env: { ...process.env, SYNK_CTXBUDGET_DIR: fs.mkdtempSync(path.join(tmpRoot, 'sid-state-')), ...env },
    });
    return JSON.parse((r.stdout || '').trim()).systemMessage;
  };

  // 🔑 트레일러와 **같은 원천**(CLAUDE_CODE_HOST_SESSION_ID)을 써야 자기 커밋을 찾는다.
  //   처음엔 입력의 session_id 로 찾다가 하나도 못 찾았다(08-04 실측). id 가 둘인 게 원인.
  const mine = run({ CLAUDE_CODE_HOST_SESSION_ID: 'sid-MINE' });
  assert.match(mine, /내 커밋이다/, `호스트 세션 id 로도 자기 커밋을 못 찾았다: ${mine}`);
  assert.doesNotMatch(mine, /남의 커밋이다/, '남의 세션 커밋을 인계 문구에 넣었다 — 트레일러로 갈라야 한다');

  // 내부 에이전트 id 로는 못 찾는 게 정상이고, 그때 「없음」을 솔직히 말해야 한다(빈칸·거짓 아님)
  const none = run({ CLAUDE_CODE_HOST_SESSION_ID: '' });
  assert.match(none, /커밋 없음/, `못 찾았으면 못 찾았다고 해야 한다: ${none}`);
});

test('🔑 창 크기는 모델마다 다르다 — 200k 고정은 5배 틀렸다 (F058)', () => {
  // 실측: opus-4-8 999,167 · opus-5 997,026 · fable-5 897,285 · sonnet-5 674,888 · haiku 189,467.
  // 200k 로 박아 두면 「223k / 200k (112%)」 처럼 100%를 넘는 계기판이 나온다.
  const at = (model) => {
    const tp = path.join(tmpRoot, `w-${seq++}.jsonl`);
    fs.writeFileSync(tp, JSON.stringify({
      type: 'assistant',
      message: { model, usage: { input_tokens: 500, cache_read_input_tokens: 152_000, cache_creation_input_tokens: 2_000 } },
    }) + '\n');
    const r = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ session_id: `w-${model}`, hook_event_name: 'Stop', transcript_path: tp, cwd: tmpRoot }),
      encoding: 'utf8',
      env: { ...process.env, SYNK_CTXBUDGET_DIR: fs.mkdtempSync(path.join(tmpRoot, 'w-state-')) },
    });
    return JSON.parse((r.stdout || '').trim()).systemMessage;
  };
  assert.match(at('claude-opus-5'), /\/ 1000k/, 'opus 창이 1M 이 아니다');
  assert.match(at('claude-sonnet-5'), /\/ 1000k/, 'sonnet 창이 1M 이 아니다');
  assert.match(at('claude-haiku-4-5-20251001'), /\/ 200k/, 'haiku 창이 200k 가 아니다');
  // 모르는 모델은 **작은 쪽** — 크게 잡으면 퍼센트가 작아 보여 늦게 알린다
  assert.match(at('claude-미래모델-9'), /\/ 200k/, '모르는 모델을 큰 창으로 가정했다');
  // 어떤 모델이든 퍼센트가 100 을 넘으면 계기판이 아니다
  for (const m of ['claude-opus-5', 'claude-haiku-4-5-20251001', 'claude-미래모델-9']) {
    const p = Number(/\((\d+)%\)/.exec(at(m))[1]);
    assert.ok(p <= 100, `${m}: ${p}% — 100을 넘었다`);
  }
});

test('🔑 바통은 🔴 에서만 떨어진다 (다음 세션이 옛 인계문을 물지 않게)', () => {
  const y = fs.mkdtempSync(path.join(tmpRoot, 'baton-y-'));
  runHook([line(125_000, 2_000, 500)], { stateDir: y });
  assert.ok(!fs.existsSync(path.join(y, 'handoff.json')), '🟡 인데 바통을 떨궜다 — 아직 끊을 때가 아니다');

  const r = fs.mkdtempSync(path.join(tmpRoot, 'baton-r-'));
  const v = runHook([line(155_000, 2_000, 500)], { stateDir: r });
  const baton = path.join(r, 'handoff.json');
  assert.ok(fs.existsSync(baton), '🔴 인데 바통이 없다 — 다음 세션이 이어받을 게 없다');
  assert.match(JSON.parse(fs.readFileSync(baton, 'utf8')).message, /이어서 작업한다/, '바통 내용이 인계문이 아니다');
  assert.match(v.msg, /자동으로 입력/, '🔴 안내에 자동 입력 설명이 없다');
});

// ── session-handoff (SessionStart) ──────────────────────────────────────────
const HANDOFF_HOOK = path.join(ROOT, '.claude', 'hooks', 'session-handoff.js');
function runHandoff(stateDir, source) {
  const r = spawnSync(process.execPath, [HANDOFF_HOOK], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: source || 'startup', cwd: ROOT }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_CTXBUDGET_DIR: stateDir },
  });
  const out = (r.stdout || '').trim();
  return out ? JSON.parse(out) : null;
}

test('🔑 새 세션이 바통을 첫 메시지로 물고 시작한다 — 그리고 바통은 사라진다', () => {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'ho-'));
  runHook([line(155_000, 2_000, 500)], { stateDir: dir });

  const first = runHandoff(dir);
  assert.ok(first, '바통이 있는데 아무것도 안 냈다');
  assert.strictEqual(first.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(first.hookSpecificOutput.initialUserMessage, /이어서 작업한다/, '첫 메시지가 인계문이 아니다');

  // 안 지우면 며칠 뒤 새 세션이 옛 인계문을 물고 시작한다 — 그게 이 검사의 이유다
  assert.strictEqual(runHandoff(dir), null, '두 번째 세션도 같은 바통을 물었다 — 일회용이어야 한다');
});

test('오래된 바통·resume·바통 없음은 조용히 통과한다 (거짓양성 0)', () => {
  const stale = fs.mkdtempSync(path.join(tmpRoot, 'stale-'));
  fs.writeFileSync(path.join(stale, 'handoff.json'),
    JSON.stringify({ at: 1, message: '아주 오래된 인계문' })); // at=1 → TTL 훨씬 초과
  assert.strictEqual(runHandoff(stale), null, '12시간 넘은 바통을 물었다 — 트랙이 이미 바뀌었다');

  const res = fs.mkdtempSync(path.join(tmpRoot, 'res-'));
  runHook([line(155_000, 2_000, 500)], { stateDir: res });
  assert.strictEqual(runHandoff(res, 'resume'), null, 'resume 은 컨텍스트가 살아 있어 인계문이 중복 지시가 된다');

  assert.strictEqual(runHandoff(fs.mkdtempSync(path.join(tmpRoot, 'none-'))), null, '바통도 없는데 반응했다');
});

test('등록층 — session-handoff 가 SessionStart(startup·clear)에 등록돼 있다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const found = ((s.hooks && s.hooks.SessionStart) || [])
    .filter((e) => (e.hooks || []).some((h) => /hooks\/session-handoff\.js/.test(String(h.command || ''))));
  assert.strictEqual(found.length, 1, 'session-handoff 가 SessionStart 에 등록돼 있지 않다');
  for (const m of ['startup', 'clear']) {
    assert.ok(new RegExp(found[0].matcher).test(m), `매처가 ${m} 를 안 잡는다 — 그 경로로 연 세션은 인계를 못 받는다`);
  }
  assert.ok(!new RegExp(found[0].matcher).test('resume'), 'resume 까지 잡는다 — 이어붙인 세션에 중복 지시가 간다');
});

test('등록층 — Stop 에 등록돼 있고, 앞단에서 좁히는 필터가 없다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const entries = (s.hooks && s.hooks.Stop) || [];
  const cmds = entries.flatMap((e) => (e.hooks || []).map((h) => String(h.command || '')));
  const mine = cmds.filter((c) => /hooks\/context-budget\.js/.test(c));
  assert.strictEqual(mine.length, 1, 'context-budget 이 Stop 이벤트에 등록돼 있지 않다 — 파일만 있으면 안 돈다');
  // 「라우팅은 훅보다 넓어야 한다」 — Stop 은 거를 tool_input 이 없으므로 case 필터 자체가 구멍이다
  assert.doesNotMatch(mine[0], /case "\$IN" in/,
    '앞단 case 필터가 붙었다 — 판정층이 둘이 되면 조용히 샌다(F053)');
  assert.match(mine[0], /\$\{CLAUDE_PROJECT_DIR:-\$PWD\}/,
    '등록이 로컬 절대경로다 — 다른 기계에서 통째로 죽는다(F044)');
});
