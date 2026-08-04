/**
 * 세션 인계 시스템 회귀 — context-budget(Stop) · session-end-handoff(SessionEnd) · session-handoff(SessionStart)
 *
 * 왜 있나 — 이 셋은 **막지 않는** 계기판·배달부라 고장 나도 아무것도 안 깨진다.
 *   조용히 죽어도 화면은 평소와 똑같다(= 가드가 새는 방향은 언제나 「통과」).
 *   실제로 08-04 하루에 결함 5종이 실측됐고, 그중 셋은 이 파일이 없었으면 못 봤다:
 *     ① 바통 전역 1개 → 🔴에 닿은 세션 셋 중 마지막이 이겨 **남의 트랙 인계문**이 들어갔다
 *     ② 프로젝트 격리 0 → 다른 저장소 세션의 인계문까지 물 수 있었다
 *     ③ 상태 파일 무한 누적 · ④ 평범한 종료엔 인계 없음 · ⑤ 🔴 뒤 완전 침묵
 *
 * 탐지 능력은 **픽스처가 진다** — 실저장소·실세션에 기대지 않는다(CI에서 깨지거나 조용히 미실행된다).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');
const STOP_HOOK = path.join(HOOKS, 'context-budget.js');
const END_HOOK = path.join(HOOKS, 'session-end-handoff.js');
const START_HOOK = path.join(HOOKS, 'session-handoff.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');

/** usage 레코드 한 줄. 세 항목의 **합**이 컨텍스트다(하나만 크면 안 걸려야 한다). */
function line(read, create, inp, model) {
  return JSON.stringify({
    type: 'assistant',
    message: {
      model: model || 'claude-opus-5',
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
let seq = 0;
test.before(() => { tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-handoff-')); });
test.after(() => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* 무해 */ } });

function newDir(tag) { return fs.mkdtempSync(path.join(tmpRoot, `${tag}-`)); }

function run(hook, payload, stateDir, env) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify(payload), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, SYNK_CTXBUDGET_DIR: stateDir, CLAUDE_CODE_HOST_SESSION_ID: '', ...(env || {}) },
  });
  const out = (r.stdout || '').trim();
  return { status: r.status, stderr: r.stderr || '', json: out ? JSON.parse(out) : null, msg: out ? String(JSON.parse(out).systemMessage || '') : '' };
}

/** Stop 훅 — 컨텍스트 ctx 로 한 번 돌린다 */
function stop(ctx, o) {
  const opt = o || {};
  const tp = path.join(tmpRoot, `t${seq++}.jsonl`);
  fs.writeFileSync(tp, (opt.lines || [line(ctx - 2500, 2000, 500, opt.model)]).join('\n') + '\n');
  return run(STOP_HOOK, {
    session_id: opt.sid || 'S1', hook_event_name: 'Stop',
    transcript_path: 'transcript_path' in opt ? opt.transcript_path : tp,
    cwd: opt.cwd || newDir('proj'),
  }, opt.stateDir || newDir('state'), opt.env);
}

function endHook(stateDir, cwd, sid, reason, env) {
  return run(END_HOOK, { session_id: sid || 'S1', hook_event_name: 'SessionEnd', cwd, reason: reason || 'prompt_input_exit' }, stateDir, env);
}

function startHook(stateDir, cwd, source) {
  return run(START_HOOK, { session_id: 'NEW', hook_event_name: 'SessionStart', cwd, source: source || 'startup' }, stateDir);
}

function batons(stateDir) {
  try { return fs.readdirSync(stateDir).filter((f) => f.startsWith('handoff-')); } catch (_) { return []; }
}

// ── 측정 ────────────────────────────────────────────────────────────────────

test('임계 아래에서는 조용하다 — 평소 작업을 방해하지 않는다', () => {
  // 131세션 시뮬레이션으로 정한 무릎: 🟡200k·🔴300k·⚫500k. 150k 아래 세션 32개를 다
  // 합쳐도 전체 비용의 1.1% 라, 그 자리에서 울리는 건 비용과 무관한 소음이다.
  for (const c of [40_000, 150_000, 199_000]) {
    assert.strictEqual(stop(c).json, null, `${c} 토큰에서 말을 걸었다 — 200k 아래는 조용해야 한다`);
  }
});

test('단계 3종 — 🟡 200k · 🔴 300k · ⚫ 500k', () => {
  assert.match(stop(210_000).msg, /🟡/);
  assert.match(stop(310_000).msg, /🔴/);
  // ⚫ 가 없으면 🔴 뒤로는 900k 를 넘겨도 무소식이었다(08-04 결함 ⑤)
  const last = stop(520_000);
  assert.match(last.msg, /⚫/, '500k 를 넘겼는데 마지막 경고가 없다');
  assert.match(last.msg, /한참 지났다/, '⚫ 문구가 🔴 와 구별되지 않는다');
});

test('🔑 퍼센트가 거짓 안심을 주지 않는다 — 창이 아니라 턴당 재읽기를 앞세운다', () => {
  // opus·fable 만 쓰면 창이 늘 1M 이라, 끊어야 할 지점에서도 「31%」로 보인다(유호님 조건, 08-04).
  // 실제 근거는 창 점유율이 아니라 **한 턴마다 그만큼을 통째로 다시 읽는다**는 것이다.
  const m = stop(310_000, { model: 'claude-opus-5' }).msg;
  const head = m.split('\n')[0];
  assert.match(head, /한 턴마다 310k 를 다시 읽는다/, '턴당 재읽기 비용이 첫 줄에 없다');
  assert.match(head, /창은 기준이 아니다/, '창 퍼센트가 기준으로 오해될 여지를 안 막았다');
  // 퍼센트가 절대값보다 먼저 나오면 「31%밖에 안 찼네」로 읽힌다
  assert.ok(head.indexOf('310k') < head.indexOf('31%'), '퍼센트가 절대값보다 앞에 나온다');
});

test('🔑 창이 작은 모델도 울린다 — 절대값만 쓰면 haiku 는 영원히 침묵한다', () => {
  // 임계를 200k 로 올리자마자 생긴 구멍: haiku 는 창이 200k 라 200k 를 넘을 수가 없다.
  // 두 축(비용=절대값 · 용량=창 비율) 중 먼저 걸리는 쪽을 쓴다 → 200k 창이면 120k/150k/180k.
  const h = (c) => stop(c, { model: 'claude-haiku-4-5-20251001' });
  assert.strictEqual(h(110_000).json, null, 'haiku 창의 55% 인데 울렸다');
  assert.match(h(130_000).msg, /🟡/, 'haiku 가 창의 65% 인데 침묵한다 — 절대값만 보고 있다');
  assert.match(h(160_000).msg, /🔴/, 'haiku 가 창의 80% 인데 🔴 가 아니다');
  assert.match(h(190_000).msg, /⚫/, 'haiku 가 창의 95% 인데 ⚫ 가 아니다');
  // 큰 창은 비용 축 그대로 — 비율로만 잡으면 1M 의 60% = 600k 라 너무 늦다
  assert.strictEqual(stop(190_000, { model: 'claude-opus-5' }).json, null, 'opus 190k 에서 울렸다');
});

test('컨텍스트는 세 항목의 합이다 — 한 항목만으로는 못 넘는다', () => {
  const v = stop(0, { lines: [line(100_000, 100_000, 15_000)] });
  assert.ok(v.json, '100k+100k+15k = 215k 인데 조용하다 — 합산이 아니라 한 항목만 보고 있다');
  assert.match(v.msg, /215k/, `합산값이 안 보인다: ${v.msg}`);
});

test('🔑 마지막 usage 를 읽는다 — 컴팩트로 컨텍스트가 내려가면 신호도 꺼진다', () => {
  const v = stop(0, { lines: [line(350_000, 2_000, 500), line(70_000, 3_000, 500)] });
  assert.strictEqual(v.json, null, '컴팩트 후 73.5k 인데 아직 경고한다 — 옛 값을 보고 있다');
});

test('usage 없는 줄·깨진 줄이 섞여도 마지막 usage 를 찾아낸다', () => {
  const v = stop(0, {
    lines: [JSON.stringify({ type: 'user' }), line(230_000, 2_000, 500), JSON.stringify({ type: 'user' }), '', '{망가진'],
  });
  assert.ok(v.json, '뒤에 잡음이 붙자 못 찾았다 — 역방향 탐색이 첫 실패에서 멈춘다');
});

test('🔑 창 크기는 모델마다 다르다 — 200k 고정은 5배 틀렸다 (F058)', () => {
  assert.match(stop(310_000, { model: 'claude-opus-5' }).msg, /창 1000k/, 'opus 창이 1M 이 아니다');
  assert.match(stop(310_000, { model: 'claude-sonnet-5' }).msg, /창 1000k/, 'sonnet 창이 1M 이 아니다');
  // 작은 창 모델은 그 창을 넘을 수 없으므로 창 안쪽 값으로 잰다
  assert.match(stop(160_000, { model: 'claude-haiku-4-5-20251001' }).msg, /창 200k/, 'haiku 창이 200k 가 아니다');
  // 모르는 모델은 **작은 쪽** — 크게 잡으면 퍼센트가 작아 보여 늦게 알린다
  assert.match(stop(160_000, { model: 'claude-미래-9' }).msg, /창 200k/, '모르는 모델을 큰 창으로 가정했다');
  // 어떤 모델에서도 퍼센트가 100 을 넘으면 계기판이 아니다
  const pct = (m, c) => Number(/(\d+)%/.exec(stop(c, { model: m }).msg)[1]);
  assert.ok(pct('claude-opus-5', 310_000) <= 100, 'opus 퍼센트가 100 초과');
  assert.ok(pct('claude-haiku-4-5-20251001', 190_000) <= 100, 'haiku 퍼센트가 100 초과');
  assert.ok(pct('claude-미래-9', 190_000) <= 100, '모르는 모델 퍼센트가 100 초과');
});

test('트랜스크립트가 없거나 usage 가 없으면 조용히 통과한다 (거짓양성 0)', () => {
  assert.strictEqual(stop(0, { transcript_path: path.join(tmpRoot, '없음.jsonl') }).json, null);
  assert.strictEqual(stop(0, { transcript_path: '' }).json, null);
  assert.strictEqual(stop(0, { lines: [JSON.stringify({ type: 'user' })] }).json, null);
});

// ── 발화 억제 ───────────────────────────────────────────────────────────────

test('🔑 AI 를 깨우지 않는다 — additionalContext 를 내지 않는다', () => {
  // 08-04 실측: additionalContext 는 AI 턴을 깨우고, Stop 훅이라 그 턴이 끝나면 또 발화한다.
  // 유호님 입력 없이 144k→147k→148k→149k 4연속. 컨텍스트를 아끼려는 훅이 컨텍스트를 먹었다.
  const v = stop(310_000);
  assert.strictEqual(v.json.hookSpecificOutput, undefined,
    'hookSpecificOutput 이 붙었다 — additionalContext 는 AI 턴을 깨워 무한 루프가 된다');
  assert.ok(v.json.systemMessage, '유호님 화면용 systemMessage 가 없다');
});

test('🔑 단계당 1회 · 상승은 놓치지 않는다 (세션당 최대 3번)', () => {
  const st = newDir('dedup'); const cwd = newDir('proj');
  const at = (c) => stop(c, { stateDir: st, cwd, sid: 'SAME' });
  assert.ok(at(210_000).json, '첫 🟡 이 없다');
  for (let i = 0; i < 3; i++) assert.strictEqual(at(215_000 + i * 1000).json, null, `🟡 에서 ${i + 2}번째로 또 떴다`);
  assert.match(at(305_000).msg, /🔴/, '🔴 로 올라갔는데 조용하다');
  assert.strictEqual(at(320_000).json, null, '🔴 도 1회여야 한다');
  assert.match(at(520_000).msg, /⚫/, '⚫ 로 올라갔는데 조용하다');
  assert.strictEqual(at(600_000).json, null, '⚫ 도 1회여야 한다');
});

// ── 인계 문구 ───────────────────────────────────────────────────────────────

test('🔑 인계문은 Session-Id 트레일러로 이 세션 커밋만 집는다 (author·시각으로 추정하지 않는다)', (t) => {
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');
  const repo = newDir('sid');
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  g(['config', 'user.email', 't@t'], repo); g(['config', 'user.name', 't'], repo);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'x'); g(['add', 'a.txt'], repo);
  g(['commit', '-m', '내 커밋이다\n\nSession-Id: sid-MINE'], repo);
  fs.writeFileSync(path.join(repo, 'b.txt'), 'y'); g(['add', 'b.txt'], repo);
  g(['commit', '-m', '남의 커밋이다\n\nSession-Id: sid-OTHER'], repo);

  // 🔑 훅 입력의 session_id 는 **내부 에이전트 id** — 트레일러에 박히는 건 호스트 id 다.
  //   전자로 찾으면 자기 커밋을 하나도 못 찾는다(08-04 실측).
  const mine = stop(310_000, { cwd: repo, sid: 'agent-내부id', env: { CLAUDE_CODE_HOST_SESSION_ID: 'sid-MINE' } });
  assert.match(mine.msg, /내 커밋이다/, `호스트 id 로도 자기 커밋을 못 찾았다: ${mine.msg}`);
  assert.doesNotMatch(mine.msg, /남의 커밋이다/, '남의 세션 커밋을 인계문에 넣었다');

  const none = stop(310_000, { cwd: repo, sid: 'agent-내부id' });
  assert.match(none.msg, /커밋 없음/, '못 찾았으면 못 찾았다고 해야 한다(빈칸·거짓 금지)');
});

test('미커밋 판정 — 모름(git 불가)과 0건을 구별한다', () => {
  const v = stop(310_000, { cwd: path.join(tmpRoot, '없는경로-git아님') });
  assert.strictEqual(v.status, 0, 'git 을 못 부르는 위치에서 훅이 실패 종료했다');
  assert.doesNotMatch(v.msg, /잃는 게 없다/, '판정 불가인데 「미커밋 0건」 쪽 문구를 냈다');
  assert.match(v.msg, /미커밋 확인/, '판정 불가일 때 확인을 시키지 않는다');
});

// ── 바통: 다중 세션·다중 프로젝트 격리 (08-04 결함 ①②) ──────────────────────

test('바통은 🔴 부터 떨어진다 — 🟡 에선 아직 아니다', () => {
  const y = newDir('by'); stop(210_000, { stateDir: y, sid: 'A' });
  assert.strictEqual(batons(y).length, 0, '🟡 인데 바통을 떨궜다');
  const r = newDir('br'); stop(310_000, { stateDir: r, sid: 'A' });
  assert.strictEqual(batons(r).length, 1, '🔴 인데 바통이 없다 — 다음 세션이 이어받을 게 없다');
});

test('🔑 세션이 여러 개여도 서로 덮지 않는다 — 최신 하나만 이어받는다 (결함 ①)', () => {
  // 실사고: 🔴에 닿은 세션이 셋인 날, 내 인계문이 「구글폼 접수」 트랙 것으로 덮였다.
  const st = newDir('multi'); const cwd = newDir('one-proj');
  for (const sid of ['SESS-A', 'SESS-B', 'SESS-C']) stop(310_000, { stateDir: st, cwd, sid });
  assert.strictEqual(batons(st).length, 3, `세션별로 갈라지지 않았다: ${batons(st)}`);

  // 셋을 **구별 가능하게** 만든다. 이게 없으면 「최신을 집는가」를 검사하는 척만 하게 된다 —
  // 실제로 변이(최신 대신 최古 선택)를 넣었을 때 초록으로 통과했다(08-04 변이 실측).
  const order = ['SESS-A', 'SESS-B', 'SESS-C'];
  for (const f of batons(st)) {
    const p = path.join(st, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const idx = order.indexOf(j.sessionId);
    fs.writeFileSync(p, JSON.stringify({ ...j, at: Date.now() - (order.length - idx) * 60_000, message: `${j.message}\n· 표식:${j.sessionId}` }));
  }

  const got = startHook(st, cwd);
  assert.ok(got.json, '바통이 셋인데 아무것도 못 집었다');
  assert.match(got.json.hookSpecificOutput.initialUserMessage, /표식:SESS-C/,
    '가장 최근 바통이 아닌 것을 집었다 — 직전 세션이 아니라 옛 트랙을 이어간다');
  assert.match(got.msg, /더 오래된 바통 2건은 버렸다/, '뒤처진 바통을 안 버렸다 — 다음 세션이 또 문다');
  assert.strictEqual(batons(st).length, 0, '집은 뒤에도 바통이 남았다 — 일회용이어야 한다');
  assert.strictEqual(startHook(st, cwd).json, null, '두 번째 세션도 뭔가를 물었다');
});

test('🔑 다른 저장소의 바통은 물지 않는다 (결함 ②)', () => {
  const st = newDir('proj-iso');
  const mine = newDir('repo-mine');
  const other = newDir('repo-other');
  stop(310_000, { stateDir: st, cwd: other, sid: 'OTHER' });
  assert.strictEqual(batons(st).length, 1, '남의 저장소 바통이 안 떨어졌다(전제 실패)');

  assert.strictEqual(startHook(st, mine).json, null, '다른 저장소 세션의 인계문을 물었다');
  assert.strictEqual(batons(st).length, 1, '남의 저장소 바통을 지워버렸다 — 그 세션이 이어받을 걸 뺏었다');
  assert.ok(startHook(st, other).json, '자기 저장소 바통은 물어야 한다');
});

test('오래된 바통·resume·compact·무바통은 조용히 통과한다 (거짓양성 0)', () => {
  const stale = newDir('stale');
  const cwd = newDir('p-stale');
  stop(310_000, { stateDir: stale, cwd, sid: 'OLD' });
  // at 을 12시간 넘게 되돌린다 — 트랙이 이미 바뀐 인계문은 이어받으면 방해다
  for (const f of batons(stale)) {
    const p = path.join(stale, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    fs.writeFileSync(p, JSON.stringify({ ...j, at: Date.now() - 13 * 60 * 60 * 1000 }));
  }
  assert.strictEqual(startHook(stale, cwd).json, null, '12시간 넘은 바통을 물었다');

  const live = newDir('live'); const c2 = newDir('p-live');
  stop(310_000, { stateDir: live, cwd: c2, sid: 'X' });
  assert.strictEqual(startHook(live, c2, 'resume').json, null, 'resume 은 컨텍스트가 살아 있어 중복 지시가 된다');
  assert.strictEqual(startHook(live, c2, 'compact').json, null, 'compact 도 이어지는 세션이다');
  assert.ok(startHook(live, c2, 'startup').json, 'startup 은 물어야 한다');

  assert.strictEqual(startHook(newDir('empty'), newDir('p-empty')).json, null, '바통도 없는데 반응했다');
});

test('🔑 상태 파일이 무한히 쌓이지 않는다 (결함 ③) · 옛 형식은 즉시 버린다', () => {
  const st = newDir('sweep'); const cwd = newDir('p-sweep');
  fs.writeFileSync(path.join(st, 'handoff.json'), JSON.stringify({ at: Date.now(), message: '옛 전역 바통' }));
  fs.writeFileSync(path.join(st, '11111111-2222-3333-4444-555555555555.json'), JSON.stringify({ stage: 2, at: Date.now() }));
  fs.writeFileSync(path.join(st, 'stage-deadbeef01-OLD.json'), JSON.stringify({ stage: 1, at: Date.now() - 25 * 60 * 60 * 1000 }));

  startHook(st, cwd); // take() 가 sweep 을 부른다
  const left = fs.readdirSync(st);
  assert.ok(!left.includes('handoff.json'), '트랙이 섞이던 옛 전역 바통이 남았다');
  assert.ok(!left.some((f) => /^[0-9a-f-]{36}\.json$/.test(f)), '프로젝트 키 없는 옛 카운터가 남았다');
  assert.ok(!left.includes('stage-deadbeef01-OLD.json'), '하루 지난 카운터가 안 지워졌다');
});

// ── SessionEnd: 평범한 종료에도 인계 (결함 ④) ───────────────────────────────

test('🔑 임계에 안 닿고 끝나도 인계된다 — 자동화의 핵심 (결함 ④)', (t) => {
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');
  const repo = newDir('end-repo');
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  const st = newDir('end-state');

  // 미커밋이 있는 세션 = 일한 세션 → 바통을 남긴다(Stop 훅은 한 번도 안 돌았다)
  fs.writeFileSync(path.join(repo, '작업중.txt'), 'x');
  const v = endHook(st, repo, 'END-1');
  assert.ok(v.json, '미커밋이 있는데 인계를 안 남겼다 — 평상시 세션이 통째로 안 이어진다');
  assert.strictEqual(batons(st).length, 1, '바통이 없다');
  assert.match(startHook(st, repo).json.hookSpecificOutput.initialUserMessage, /이어서 작업한다/,
    '새 세션이 그 바통을 첫 메시지로 물지 않았다');
});

test('일 안 한 세션은 바통을 남기지 않는다 (다음 세션이 엉뚱한 지시를 물지 않게)', (t) => {
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');
  const repo = newDir('clean-repo');
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  const st = newDir('clean-state');
  assert.strictEqual(endHook(st, repo, 'END-2').json, null, '커밋도 미커밋도 임계도 없는데 바통을 남겼다');
  assert.strictEqual(batons(st).length, 0, '바통 파일이 생겼다');
});

test('SessionEnd — resume·compact 는 세션이 이어지는 것이라 바통을 남기지 않는다', () => {
  const st = newDir('end-res'); const cwd = newDir('p-end-res');
  fs.writeFileSync(path.join(cwd, 'x.txt'), 'x');
  for (const r of ['resume', 'compact']) {
    assert.strictEqual(endHook(st, cwd, 'S', r).json, null, `${r} 에서 바통을 남겼다`);
  }
  assert.strictEqual(batons(st).length, 0);
});

test('두 겹이 서로 덮는다 — 같은 세션의 Stop 바통과 SessionEnd 바통은 하나로 합쳐진다', () => {
  // 창을 강제로 닫으면 SessionEnd 가 못 돈다 → Stop 이 🔴에서 미리 떨군 게 보험이다.
  // 둘 다 돌면 파일이 둘이 아니라 **하나(나중 것)**여야 한다 — 안 그러면 뒤처진 바통이 쌓인다.
  const st = newDir('two'); const cwd = newDir('p-two');
  stop(310_000, { stateDir: st, cwd, sid: 'SAME' });
  fs.writeFileSync(path.join(cwd, 'y.txt'), 'y');
  endHook(st, cwd, 'SAME');
  assert.strictEqual(batons(st).length, 1, `같은 세션인데 바통이 ${batons(st).length}개 — 세션별 1개여야 한다`);
});

// ── 등록층 ──────────────────────────────────────────────────────────────────

test('등록층 — 세 훅이 각자의 이벤트에 등록돼 있고, 앞단에서 좁히는 필터가 없다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const find = (event, file) => ((s.hooks && s.hooks[event]) || [])
    .filter((e) => (e.hooks || []).some((h) => new RegExp(`hooks/${file}\\.js`).test(String(h.command || ''))));

  for (const [event, file] of [['Stop', 'context-budget'], ['SessionEnd', 'session-end-handoff'], ['SessionStart', 'session-handoff']]) {
    const found = find(event, file);
    assert.strictEqual(found.length, 1, `${file} 이 ${event} 에 등록돼 있지 않다 — 파일만 있으면 안 돈다`);
    const cmd = found[0].hooks.map((h) => String(h.command)).find((c) => c.includes(file));
    // 「라우팅은 훅보다 넓어야 한다」 — 앞단 case 필터는 판정층을 둘로 갈라 조용히 샌다(F053)
    assert.doesNotMatch(cmd, /case "\$IN" in/, `${file}: 앞단 case 필터가 붙었다`);
    assert.match(cmd, /\$\{CLAUDE_PROJECT_DIR:-\$PWD\}/, `${file}: 등록이 로컬 절대경로다 — 다른 기계에서 죽는다(F044)`);
  }

  // SessionStart 매처는 새로 여는 경로를 다 잡되, 이어지는 세션(resume)은 잡으면 안 된다
  const m = find('SessionStart', 'session-handoff')[0].matcher;
  for (const v of ['startup', 'clear']) assert.ok(new RegExp(m).test(v), `매처가 ${v} 를 안 잡는다`);
  assert.ok(!new RegExp(m).test('resume'), '매처가 resume 까지 잡는다 — 이어붙인 세션에 중복 지시가 간다');
});

test('공용 통로가 하나다 — 훅들이 바통 경로를 각자 조립하지 않는다', () => {
  // 경로 규칙이 훅마다 따로 있으면 한 곳만 고쳐도 조용히 갈라진다(그게 결함 ①②의 형태였다).
  for (const f of ['context-budget.js', 'session-end-handoff.js', 'session-handoff.js']) {
    const src = fs.readFileSync(path.join(HOOKS, f), 'utf8');
    assert.match(src, /require\(path\.join\(__dirname, 'lib', 'handoff-store\.js'\)\)/, `${f} 가 공용 통로를 안 쓴다`);
    assert.doesNotMatch(src, /handoff-\$\{|'handoff-'/, `${f} 가 바통 파일명을 직접 조립한다`);
  }
});
