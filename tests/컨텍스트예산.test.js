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
const { spawnSync } = require('node:child_process'); // git 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

const ROOT = path.resolve(__dirname, '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');
const STOP_HOOK = path.join(HOOKS, 'context-budget.js');
const END_HOOK = path.join(HOOKS, 'session-end-handoff.js');
const START_HOOK = path.join(HOOKS, 'session-handoff.js');
const STAMP_HOOK = path.join(HOOKS, 'edit-stamp.js');
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
  const r = 훅띄우기(hook, {
    input: JSON.stringify(payload), encoding: 'utf8', timeout: 20000,
    // 세 변수를 **다** 비운다 — `board-id` 통로가 HOST→(REMOTE|SESSION) 로 폴백하므로(F634), 하나만 비우면 이 검사가 «도는 기계»에 따라 갈린다(클라우드엔 나머지 둘이 실재한다 · F296·F628 그 자리).
    env: {
      ...process.env,
      SYNK_CTXBUDGET_DIR: stateDir,
      CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '',
      ...(env || {}),
    },
  });
  const out = (r.stdout || '').trim();
  /* ⚠ 훅 stdout 은 **두 통로**다 — JSON(구조화 제어)이거나 plain text(SessionStart 의 컨텍스트
   *   주입 · F661 ㈐ 로 session-handoff 가 이쪽으로 옮겼다). 무조건 파싱하면 plain text 회차가
   *   `SyntaxError` 로 죽고, 그 증상은 「훅이 깨졌다」로 보여 진짜 고장과 안 갈린다.
   *   그래서 파싱은 «될 때만» 하고, 원문(`out`)은 언제나 그대로 돌려준다. */
  let json = null;
  try { json = out ? JSON.parse(out) : null; } catch (_) { json = null; }
  return { status: r.status, stderr: r.stderr || '', out, json, msg: json ? String(json.systemMessage || '') : '' };
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

/* 사다리 값은 **여기 하나에서** 나온다 — 테스트마다 숫자를 박아 두면 임계를 옮길 때마다
 * 그 자리 전부가 같이 빨개진다(2026-08-12 실측: 유호님이 임계를 올리자 9건이 깨졌다).
 *   큰 창(1M): 🟡 은퇴(WARN=HARD=300k) · 🔴 300k · 다음 400k · ⚫ 500k
 *   🟡 는 **작은 창에서만** 산다(win×0.60) — 그 검사는 haiku 테스트가 진다. */
const 침묵 = 210_000;    // 임계 아래 — 옛 🟡 자리(지금은 조용해야 한다)
const 첫울음 = 310_000;  // 🔴 첫 도달
const 작은창 = 'claude-haiku-4-5-20251001';
const 작은창_노랑 = 130_000; // haiku 200k 창의 65% → 🟡(win×0.60=120k)

function endHook(stateDir, cwd, sid, reason, env) {
  return run(END_HOOK, { session_id: sid || 'S1', hook_event_name: 'SessionEnd', cwd, reason: reason || 'prompt_input_exit' }, stateDir, env);
}

function startHook(stateDir, cwd, source) {
  return run(START_HOOK, { session_id: 'NEW', hook_event_name: 'SessionStart', cwd, source: source || 'startup' }, stateDir);
}

function batons(stateDir) {
  try { return fs.readdirSync(stateDir).filter((f) => f.startsWith('handoff-')); } catch (_) { return []; }
}

/** 편집 도장을 찍는다 — **진짜 생산자**(edit-stamp)를 띄운다.
 *  파일명 규칙을 테스트가 다시 적으면 그 순간 갈라지고, 갈라진 쪽 증상은 「무기록」이라
 *  **양쪽 회귀가 다 초록**으로 보인다(맹점 ④). 그래서 형식을 아는 자리는 여기도 0개다.
 *  ⚠ `CLAUDE_PROJECT_DIR` 을 반드시 덮는다 — 안 덮으면 edit-stamp 의 ROOT 가 **실저장소**가 된다. */
function stamp(stateDir, cwd, sid, rel) {
  return run(STAMP_HOOK, {
    session_id: sid, hook_event_name: 'PostToolUse', cwd,
    tool_name: 'Write', tool_input: { file_path: path.join(cwd, rel) },
  }, stateDir, { CLAUDE_PROJECT_DIR: cwd });
}

// ── 측정 ────────────────────────────────────────────────────────────────────

test('임계 아래에서는 조용하다 — 평소 작업을 방해하지 않는다', () => {
  // 131세션 시뮬레이션으로 정한 무릎: 🔴300k·⚫500k. 150k 아래 세션 32개를 다
  // 합쳐도 전체 비용의 1.1% 라, 그 자리에서 울리는 건 비용과 무관한 소음이다.
  // 🔑 210k·285k 가 여기 있는 이유 — 유호님 확정 08-12 로 🟡(200k)이 큰 창에서 은퇴했다.
  //   옛 🟡 대역이 **실제로 조용한지**를 못박지 않으면 되돌아와도 아무도 모른다.
  for (const c of [40_000, 150_000, 199_000, 침묵, 285_000, 299_000]) {
    assert.strictEqual(stop(c).json, null, `${c} 토큰에서 말을 걸었다 — 300k 아래는 조용해야 한다`);
  }
});

test('색 3종 — 🔴 300k · ⚫ 500k (🟡 는 작은 창 전용)', () => {
  // 🔑 유호님이 실제로 밟은 자리(285k 스크린샷) — 🟡 은 AI 를 안 깨우는데도 전문을 쏟고 있었다.
  //   큰 창에선 그 대역이 통째로 조용해졌지만(위 테스트), 🟡 자체는 **작은 창에 그대로 산다**.
  //   그래서 「🟡 이 전문을 안 쏟는가」는 없어진 검사가 아니라 **자리를 옮긴** 검사다.
  const 노랑 = stop(작은창_노랑, { model: 작은창 });
  assert.match(노랑.msg, /🟡/, '작은 창의 🟡 까지 사라졌다 — 비율 축이 죽었다');
  assert.ok(!노랑.msg.includes('다음 세션 인계문'),
    '🟡 이 인계문 전문을 화면에 쏟는다 — 복사 가능한 실물은 AI 블록 한 벌뿐이어야 한다');
  assert.match(stop(첫울음).msg, /🔴/);
  assert.match(stop(410_000).msg, /🔴/, '400k 가 아직 ⚫ 이면 마지막 색을 너무 일찍 쓴다');
  assert.match(stop(410_000).msg, /한참 지났다/, '3단계 문구가 앞 단계와 구별되지 않는다');
  // ⚫ 가 없으면 🔴 뒤로는 900k 를 넘겨도 무소식이었다(08-04 결함 ⑤)
  assert.match(stop(520_000).msg, /⚫/, '500k 를 넘겼는데 마지막 색이 아니다');
});

/* 🔴 **줄 수가 곧 증상이다** — `systemMessage` 는 줄마다 `Stop says:` 접두가 붙어 찍힌다.
 *   유호님 08-12 스크린샷: 한 발화가 `Stop says:` 9줄로 쏟아졌고 그중 하나는 **빈 줄**이었다
 *   (`\n\n` 이 만든 것 — 접두만 덩그러니). 같은 자리 4번째 수리인데 앞 셋이 다 「전문을 빼면
 *   된다」로 갔다: 전문은 빠졌고 그 자리에 안내 4줄이 들어앉아 화면은 그대로였다.
 *   **그래서 여기서 재는 것은 내용이 아니라 줄 수다** — 다음 사람이 한 줄 더 붙이면 빨개진다.
 *   ⚠ **여유를 안 둔다.** 상한을 4(=지금 3줄 + 한 줄)로 뒀더니 「한 줄쯤」이 그대로 통과했다
 *   (변이 실측 08-12). 지난 네 판이 전부 그 「한 줄쯤」으로 늘어난 것이라, 여유 칸은 증식
 *   경로 그 자체다. 늘리려면 이 수를 «의도적으로» 고쳐야 한다 — 그게 유호님 화면을 한 번
 *   더 보게 만드는 유일한 마찰이다. */
const 줄상한 = 3;

test(`🔴 화면 줄 수 — 줄마다 \`Stop says:\` 가 붙는다 (빈 줄 0 · 상한 ${줄상한}줄 · 전 단계)`, () => {
  // 🟡 은 큰 창에서 은퇴했으므로 그 자리는 **작은 창**으로 잰다 — 단계를 하나도 빼지 않는다.
  for (const [c, model] of [[첫울음], [410_000], [520_000], [작은창_노랑, 작은창]]) {
    const 줄 = stop(c, model ? { model } : undefined).msg.split('\n');
    assert.ok(줄.length <= 줄상한,
      `${c}: systemMessage 가 ${줄.length}줄이다(상한 ${줄상한}) — 줄마다 \`Stop says:\` 가 찍혀 화면이 접힌다.\n`
      + `  줄을 늘리는 대신 \`steps\` 문장 안으로 넣어라(안내 «목차»는 08-12 에 통째로 뺐다).`);
    assert.deepEqual(줄.filter((l) => l.trim() === ''), [],
      `${c}: 빈 줄이 있다 — 화면엔 \`Stop says:\` 접두만 남는 순수 노이즈다(\`\\n\\n\` 을 찾아라)`);
  }
});

test('🔴 인계 통로 «목차»를 화면에 안 낸다 — 통로는 `/close` 한 줄이 진다 (유호 08-12)', () => {
  for (const [c, model] of [[첫울음], [410_000], [520_000], [작은창_노랑, 작은창]]) {
    const m = stop(c, model ? { model } : undefined).msg;
    for (const 조각 of ['docs/_ops/인계문.md', '--no-save', '자동 입력', '인계문은']) {
      assert.ok(!m.includes(조각),
        `${c}: 화면에 인계 통로 안내(「${조각}」)가 돌아왔다 — 지운 건 실물이 아니라 그 목차다.\n`
        + '  실물은 🔴 wake 의 blockOrder(복사 버튼 붙는 AI 블록)가 내고, 부르는 말은 `/close` 하나다.');
    }
    assert.ok(m.includes('/close'), `${c}: 끊는 한 줄(\`/close\`)까지 사라졌다 — 목차를 지우다 통로를 지웠다`);
  }
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
  const v = stop(0, { lines: [line(150_000, 150_000, 15_000)] });
  assert.ok(v.json, '150k+150k+15k = 315k 인데 조용하다 — 합산이 아니라 한 항목만 보고 있다');
  assert.match(v.msg, /315k/, `합산값이 안 보인다: ${v.msg}`);
});

test('🔑 마지막 usage 를 읽는다 — 컴팩트로 컨텍스트가 내려가면 신호도 꺼진다', () => {
  const v = stop(0, { lines: [line(350_000, 2_000, 500), line(70_000, 3_000, 500)] });
  assert.strictEqual(v.json, null, '컴팩트 후 73.5k 인데 아직 경고한다 — 옛 값을 보고 있다');
});

test('usage 없는 줄·깨진 줄이 섞여도 마지막 usage 를 찾아낸다', () => {
  const v = stop(0, {
    lines: [JSON.stringify({ type: 'user' }), line(330_000, 2_000, 500), JSON.stringify({ type: 'user' }), '', '{망가진'],
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

test('🔑 AI 는 🔴 첫 도달에만 깨운다 — 정리는 자동으로, 루프는 없이', () => {
  // 두 실패를 동시에 막는 테스트다.
  //  ① 08-04 오전: additionalContext 가 AI 턴을 깨우고 Stop 훅이라 그 턴 끝에 또 발화 →
  //     유호님 입력 없이 144k→147k→148k→149k 4연속. 아끼려던 훅이 컨텍스트를 먹었다.
  //  ② 08-04 저녁: 그래서 아예 안 깨웠더니 유호님이 매번 직접 정리해야 했다 —
  //     "지금은 자동화가 아니야. 억지로 내가 신경써야."
  // 처방은 「깨우지 않기」가 아니라 **세션당 1회로 못 박기**다.
  const st = newDir('wake'); const cwd = newDir('p-wake');
  const at = (c) => stop(c, { stateDir: st, cwd, sid: 'W' });

  // 큰 창에선 🟡 이 은퇴해 임계 아래가 통째로 침묵이다 — 깨우기는커녕 말도 걸지 않아야 한다.
  assert.strictEqual(at(침묵).json, null, '임계 아래에서 말을 걸었다 — 깨우기 전에 소음부터 났다');

  const hard = at(첫울음);
  assert.ok(hard.json.hookSpecificOutput, '🔴 인데 AI 를 안 깨웠다 — 유호님이 직접 정리해야 한다');
  assert.strictEqual(hard.json.hookSpecificOutput.hookEventName, 'Stop');
  const inj = hard.json.hookSpecificOutput.additionalContext;
  assert.match(inj, /\/close/, '깨우면서 무엇을 하라고 안 알려준다');
  assert.match(inj, /유호님이 방금 시킨 일이 아니라/, '자동 발동임을 안 밝히면 유호님 지시로 오인한다');
  assert.match(inj, /새 작업을 시작하지 않는다/, '깨운 AI 가 새 일을 벌이면 컨텍스트가 더 는다');
  // F096 — 깨워진 AI 가 「창 닫으세요」만 말하고 복붙할 실물을 화면에 안 냈다.
  //   지시문구를 화면에 내는 실행 한 줄이 **wake 본문 안에** 있어야 한다(파일 경로 안내는 대체가 안 된다).
  assert.match(inj, /node tools\/인계문\.js/, '깨운 AI 에게 지시문구를 화면에 낼 실행 한 줄이 없다 — 유호님이 복붙할 실물이 안 나온다(F096)');
  assert.match(inj, /코드 블록/, '지시문구를 「코드 블록으로」 내라는 지정이 없다 — 프로즈에 묻히면 복사할 실물이 아니다');
  assert.ok(hard.json.systemMessage, '유호님 화면용 systemMessage 가 없다');

  // 🔑 인계문 전문은 **화면에 한 벌만** — 그리고 그 한 벌은 복사 버튼이 붙는 AI 코드 블록이다
  //   (유호님 확정 08-12 "복붙하기 쉽게 되있는거 그거 하나만 떴으면").
  //   ⚠ F122 와 다른 축이다 — 그건 훅이 «둘»이라 겹친 것이고 blockOrder 표식이 닫았다.
  //     이건 한 훅 «안»에서 두 통로가 같은 글을 내는 것이라 그 표식에 안 걸렸다.
  assert.ok(!hard.msg.includes('다음 세션 인계문'),
    'systemMessage 가 인계문 전문을 실었다 — AI 블록과 합쳐 화면에 두 벌이 나간다');
  assert.match(hard.msg, /\/close/, '전문을 양보했으면 어디서 받는지를 가리켜야 한다(F096)');
  /* 🔑 **경로 «문구»가 아니라 파일 «실물»을 잰다** (축 이동 08-12 — 유호님 화면 4번째 지적).
   *   옛 검사는 systemMessage 에 `인계문.md` 라는 글자가 있는지 봤다. 그건 프로즈고, 프로즈를
   *   지키려니 화면에 안내 4줄이 상주해 `Stop says:` 가 9번 찍혔다 — **막으려던 것(전문 유실)은
   *   글자가 아니라 파일이 막는다.** 그래서 「썼다고 말하는가」 대신 「썼는가」를 본다.
   *   이게 F096 의 약화가 아니라 강화다: 옛 검사는 문구만 있고 파일이 0 이어도 초록이었다. */
  const 사본 = path.join(cwd, 'docs', '_ops', '인계문.md');
  assert.ok(fs.existsSync(사본),
    `파일 사본이 «실제로» 안 써졌다(${사본}) — 블록이 안 나오면 전문이 통째로 사라진다(F096)`);
  assert.ok(fs.readFileSync(사본, 'utf8').includes('인계문'),
    '사본 파일이 비었다 — 파일이 있다는 것과 전문이 담겼다는 것은 다른 판정이다');

  // 여기가 루프 방지의 핵심 — 단계가 올라가도 **두 번은 안 깨운다**
  for (const c of [410_000, 520_000, 910_000]) {
    const v = at(c);
    assert.ok(v.json, `${c} 에서 단계가 올랐는데 화면 문구도 없다`);
    assert.strictEqual(v.json.hookSpecificOutput, undefined,
      `${c} 에서 AI 를 또 깨웠다 — [훅→AI턴→Stop→훅] 무한 루프의 입구다`);
    // 🔑 **단계와 무관하게** systemMessage 는 전문을 안 싣는다 — 통로의 문제지 단계의 문제가 아니다.
    //   첫 판(08-12 오전)은 wake 만 껐다가 🟡·반복 발화에서 그대로 새어 유호님 화면에 다시 나타났다.
    //   대신 받는 길을 반드시 가리킨다(F096 — 안내만 남기고 실물이 0 이 되면 그게 원래 마찰이다).
    assert.ok(!v.msg.includes('다음 세션 인계문'),
      `${c} 의 systemMessage 가 인계문 전문을 쏟았다 — 화면에서 접히고 복사 버튼도 없는 통로다`);
    assert.match(v.msg, /인계문\.js|\/close/, `${c} 에서 전문을 받을 길을 안 가리켰다`);
  }
});

test('🔑 컴팩트로 내려가면 단계도 내려간다 — 안 내리면 다음 사이클이 통째로 침묵한다', () => {
  // 08-04 실측(유호님 "다른 화면들에서도 되는지 확인해줘"로 발견): 760k 까지 갔다가
  // 컴팩트로 174k 가 된 세션의 stage 가 4로 남아 있었다. 그 상태로는 다시
  // 300·400·500·600k 를 넘어도 전부 억제되고 **700k 에 닿아야** 입을 연다 —
  // 컴팩트 한 번이 알림 400k 구간을 통째로 삼킨다.
  const st = newDir('drop'); const cwd = newDir('p-drop');
  const at = (c) => stop(c, { stateDir: st, cwd, sid: 'COMPACT' });

  assert.match(at(760_000).msg, /⚫/, '760k 에서 안 울렸다(전제 실패)');
  assert.strictEqual(at(174_000).json, null, '내려가는 길에 말을 걸었다 — 줄어든 건 알릴 일이 아니다');

  // 여기가 핵심 — 카운터가 안 내려갔으면 아래 셋이 전부 조용하다
  const back = at(310_000);
  assert.match(back.msg, /🔴/, '컴팩트 뒤 다시 300k 를 넘었는데 침묵한다 — 단계가 안 내려갔다');
  assert.ok(back.json.hookSpecificOutput, '새 사이클인데 AI 정리가 안 붙었다 — 컴팩트 뒤엔 다시 깨워야 한다');
  assert.match(at(410_000).msg, /한참 지났다/, '400k 도 침묵한다');
  assert.match(at(520_000).msg, /⚫/, '500k 도 침묵한다');
});

test('🔑 단계당 1회 · 상승은 놓치지 않는다', () => {
  const st = newDir('dedup'); const cwd = newDir('proj');
  const at = (c) => stop(c, { stateDir: st, cwd, sid: 'SAME' });
  assert.strictEqual(at(침묵).json, null, '임계 아래에서 떴다');
  assert.match(at(305_000).msg, /🔴/, '첫 🔴 이 없다');
  for (let i = 0; i < 3; i++) assert.strictEqual(at(320_000 + i * 1000).json, null, `같은 단계(300~400k)에서 ${i + 2}번째로 또 떴다`);
  assert.match(at(410_000).msg, /한참 지났다/, '다음 단계(400k)로 올라갔는데 조용하다');
  assert.match(at(520_000).msg, /⚫/, '⚫ 로 올라갔는데 조용하다');
  assert.strictEqual(at(560_000).json, null, '같은 단계(500~600k)에서 두 번 떴다');
});

test('🔑 🔴 위로 100k 마다 다시 운다 — 침묵 구간이 가장 비싼 구간이었다', () => {
  // 08-04 실측: 단계당 1회라 300k 에서 울면 500k 까지 무신호, ⚫ 뒤로는 영구 침묵이었다.
  // 세 세션이 600k·771k·786k 까지 아무 신호 없이 올라갔다. 유호님 지시도 뒤집혔다 —
  // "너무 많이 뜨게는 하지 마" → **"조금 더 떠도 될 것 같다. 뜬지 안 뜬지 체크를 못했나?"**
  const st = newDir('repeat'); const cwd = newDir('p-repeat');
  const at = (c) => stop(c, { stateDir: st, cwd, sid: 'LONG' });
  const fired = [];
  for (let c = 210_000; c <= 950_000; c += 10_000) if (at(c).json) fired.push(c);

  // 300·400·…·900k = 7회(🟡 은퇴로 옛 첫 발화 210k 가 빠졌다 · 유호 확정 08-12).
  // 실측에서 무신호였던 600~900k 구간이 여기 들어와야 한다 — 그 축은 손대지 않았다.
  assert.deepStrictEqual(
    fired.map((c) => Math.round(c / 1000)),
    [300, 400, 500, 600, 700, 800, 900],
    `발화 지점이 100k 격자와 다르다: ${fired.map((c) => Math.round(c / 1000) + 'k')}`
  );
  assert.ok(batons(st).length >= 1, '재발화 구간에서 바통을 안 떨궜다 — 창을 그냥 닫으면 인계가 끊긴다');
});

test('창이 작은 모델도 창 안에서 여러 번 운다 (haiku 200k)', () => {
  // 절대값 격자(100k)를 그대로 쓰면 haiku 는 창이 200k 라 두 번째가 창 밖이 된다.
  // STEP 도 창 비율로 접혀야 한다 — HARD 150k · STEP 40k → 150k·190k.
  const st = newDir('h-rep'); const cwd = newDir('p-h-rep');
  const at = (c) => stop(c, { stateDir: st, cwd, sid: 'H', model: 'claude-haiku-4-5-20251001' });
  assert.match(at(155_000).msg, /🔴/, 'haiku 가 창의 78% 인데 조용하다');
  assert.strictEqual(at(180_000).json, null, 'haiku STEP(40k) 안인데 또 떴다');
  assert.match(at(195_000).msg, /⚫/, 'haiku 가 창의 97% 인데 두 번째가 없다 — 절대 격자만 보고 있다');
});

test('🔑 절차 나열이 아니라 한 줄 실행을 준다 — 경고 8번에도 786k 까지 갔다', () => {
  // 부족한 건 알림이 아니라 **끊는 비용**이었다(유호님 확정 08-04). 커밋·보드·메모리 셋을
  // 손으로 하려니 매번 「나중에」가 됐다. 그래서 경고는 실행 한 줄을 준다.
  for (const [c, model] of [[첫울음], [520_000], [작은창_노랑, 작은창]]) {
    assert.match(stop(c, model ? { model } : undefined).msg, /\/close/,
      `${c} 경고에 끊기를 실행할 한 줄이 없다`);
  }
});

test('🔑 훅이 가리키는 /close 스킬이 실재한다 — 문구만 있고 스킬이 없으면 아무 일도 안 일어난다', () => {
  // 「라우팅은 훅보다 넓어야 한다」와 같은 계열: 훅이 아무리 정확해도 가리키는 곳이 비면
  // 유호님이 `/close` 를 쳤을 때 조용히 아무 일도 안 일어난다(새는 방향은 언제나 「통과」).
  assert.match(fs.readFileSync(STOP_HOOK, 'utf8'), /\/close/, '훅이 /close 를 안 가리킨다');
  const skill = path.join(ROOT, '.claude', 'skills', 'close', 'SKILL.md');
  assert.ok(fs.existsSync(skill), '훅은 /close 를 가리키는데 스킬 파일이 없다');
  const s = fs.readFileSync(skill, 'utf8');
  assert.match(s, /^name: close$/m, '스킬 이름이 close 가 아니다 — 그 이름으로는 안 불린다');
  // 인계되는 셋(커밋·보드 줄·메모리)을 다 다뤄야 「한 번에 끝난다」가 참이 된다
  for (const [needle, what] of [[/board-move\.js/, '보드 줄 이관'], [/MEMORY\.md/, '메모리'], [/git commit -F/, '범위 지정 커밋']]) {
    assert.match(s, needle, `/close 스킬에 ${what} 절차가 없다 — 인계가 반쪽이 된다`);
  }
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
  // ⚠ 인계문 **내용**을 재는 검사라 «어느 통로로 나갔는지»에 매이면 안 된다 — 깨우는 발화에서는
  //   전문이 systemMessage 가 아니라 additionalContext 에 산다(전문 한 벌 규칙 · 08-12). 둘을 합쳐 본다.
  const 전문 = (r) => `${r.msg}\n${String(r.json?.hookSpecificOutput?.additionalContext || '')}`;

  const mine = stop(310_000, { cwd: repo, sid: 'agent-내부id', env: { CLAUDE_CODE_HOST_SESSION_ID: 'sid-MINE' } });
  assert.match(전문(mine), /내 커밋이다/, `호스트 id 로도 자기 커밋을 못 찾았다: ${전문(mine)}`);
  assert.doesNotMatch(전문(mine), /남의 커밋이다/, '남의 세션 커밋을 인계문에 넣었다');

  const none = stop(310_000, { cwd: repo, sid: 'agent-내부id' });
  assert.match(전문(none), /커밋 없음/, '못 찾았으면 못 찾았다고 해야 한다(빈칸·거짓 금지)');
});

test('🔑 인계문은 형제 저장소(SYNK-talk)의 커밋·미커밋도 본다 — F142', (t) => {
  // 실사고 2026-08-07: talk 에 7커밋을 한 세션의 인계문이 「커밋 없음」으로 나갔다.
  // 트랙 절반이 형제에서 도는데 세션 저장소만 읽었다 — 다음 세션이 직전 작업을 못 찾는다.
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');

  // 좌표 규칙은 `<root>/../<이름>` — 픽스처도 그 모양으로 짓는다.
  const parent = newDir('형제');
  const repo = path.join(parent, 'main');
  const talk = path.join(parent, 'SYNK-talk');
  fs.mkdirSync(repo); fs.mkdirSync(talk);
  for (const c of [repo, talk]) {
    if (g(['init'], c).status !== 0) return t.skip('git init 실패');
    g(['config', 'user.email', 't@t'], c); g(['config', 'user.name', 't'], c);
  }
  fs.writeFileSync(path.join(repo, 'a.txt'), 'x'); g(['add', 'a.txt'], repo);
  g(['commit', '-m', '세션 저장소 커밋\n\nSession-Id: sid-MINE'], repo);
  fs.writeFileSync(path.join(talk, 'b.txt'), 'y'); g(['add', 'b.txt'], talk);
  g(['commit', '-m', '형제 저장소 커밋\n\nSession-Id: sid-MINE'], talk);

  // 이음매를 명시한다 — 주변 환경의 SYNK_OWNER_SIBLINGS 에 좌우되면 안 된다.
  const 원래 = process.env.SYNK_OWNER_SIBLINGS;
  process.env.SYNK_OWNER_SIBLINGS = '../SYNK-talk';
  try {
    const report = require(path.join(HOOKS, 'lib', 'session-report.js'));
    const commits = report.myCommits(repo, 'sid-MINE');
    assert.ok(commits.some((c) => /형제 저장소 커밋/.test(c)),
      `형제 저장소 커밋을 못 봤다 — 「커밋 없음」으로 넘어간다: ${JSON.stringify(commits)}`);
    assert.ok(commits.some((c) => /\(SYNK-talk\)/.test(c)),
      '어느 저장소 커밋인지 표시가 없다 — 새 세션이 엉뚱한 저장소를 연다');

    // 🔑 표식은 해시 **뒤**에 붙어야 한다. 앞에 붙이면 boardTrack 의 해시 추출이 죽고
    //   보드 줄 인계가 통째로 사라진다(보드는 talk 해시도 적는다).
    const talk해시 = String(g(['rev-parse', '--short', 'HEAD'], talk).stdout || '').trim();
    fs.mkdirSync(path.join(repo, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', '_ops', '보드', 'sess.md'),
      `| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n| 2026-08-07 | 형제 트랙 | talk | ✅종결(${talk해시}) · 다음=X |\n`);
    const track = report.boardTrack(repo, commits);
    assert.ok(track && /형제 트랙/.test(track.track),
      `형제 해시로 보드 줄을 못 찾았다 — 표식이 해시를 가렸다: ${JSON.stringify(track)}`);

    // 미커밋도 같은 사각이다 — 형제에 남긴 작업본이 「0건 = 끊어도 된다」로 보이면 안 된다.
    // 절대값이 아니라 **증분**으로 본다(세션 저장소 쪽 잡파일에 검사가 흔들리지 않게).
    const 전 = report.dirtyCount(repo);
    fs.writeFileSync(path.join(talk, 'c.txt'), 'z');
    assert.strictEqual(report.dirtyCount(repo), 전 + 1,
      '형제 저장소의 미커밋을 안 셌다 — 인계문이 「미커밋 0건」이라 말한다');

    /* 🔴 **형제를 못 읽은 것도 「모름」이다** (반박 패스 실측 2026-08-07 · 옛 `|| 0` 이 여기서 샜다).
     *   형제에 미커밋 3건이 있는데 그 저장소의 git 이 실패하면 총합이 조용히 `0` 이 됐다 —
     *   인계문이 「미커밋 0건」이라 말하면 다음 세션은 **끊어도 된다**고 읽는다.
     *   `.git` 존재 검사를 통과하고 git 만 실패하는 모양은 실재한다(아래가 그 실제 모양 —
     *   끊긴 워크트리 링크 · `index.lock` 경합 · timeout 도 같은 자리로 떨어진다).
     *   🔑 이 계열 전체가 「못 읽음 → 0건」으로 조용히 새던 것이라, 여기 한 곳만 그 번역을
     *      남겨 두면 하필 **인계 통로**에서 되살아난다. */
    fs.rmSync(path.join(talk, '.git'), { recursive: true, force: true });
    fs.writeFileSync(path.join(talk, '.git'), 'gitdir: /존재하지않는곳\n');
    assert.strictEqual(report.dirtyCount(repo), null,
      '형제를 못 읽었는데 숫자를 냈다 — 「못 읽음」을 0 으로 접으면 침묵과 같아지고, '
      + '미추적은 이력·stash·reflog 어디에도 없는 유일한 무보호 상태다(F025)');
  } finally {
    if (원래 === undefined) delete process.env.SYNK_OWNER_SIBLINGS;
    else process.env.SYNK_OWNER_SIBLINGS = 원래;
  }
});

test('🔑 보드 줄이 없으면 「찾아라」도 「멈춰라」도 아니라 판정과 다음 수로 넘긴다 (F170)', (t) => {
  // 실사고 2026-08-07: 트랙 없이 끝난 세션(d3bf3daf — 커밋이 인계문 수거·보드 아카이브뿐)의
  // 인계문이 「보드를 열어 **내 트랙 줄을 찾고** 이어라」로 나갔다. 없는 줄을 찾으라고 시키면
  // 다음 세션은 보드 전문을 뒤지다 손에 잡히는 뒷정리로 그 자리를 채운다 — 인계가 아니다.
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');

  const repo = newDir('보드없음');
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  g(['config', 'user.email', 't@t'], repo); g(['config', 'user.name', 't'], repo);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'x'); g(['add', 'a.txt'], repo);
  g(['commit', '-m', '뒷정리 커밋\n\nSession-Id: sid-MINE'], repo);
  const 해시 = String(g(['rev-parse', '--short', 'HEAD'], repo).stdout || '').trim();

  const report = require(path.join(HOOKS, 'lib', 'session-report.js'));
  const 보드 = path.join(repo, 'docs', '_ops', '보드', 'sess.md');
  fs.mkdirSync(path.dirname(보드), { recursive: true });
  const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';

  // ① 내 해시가 없는 보드 — 남의 줄만 있다.
  fs.writeFileSync(보드, `${머리}| 2026-08-07 | 남의 트랙 | x | ✅종결(deadbee) · 다음=Z |\n`);

  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'sid-MINE';
  try {
    const a = report.buildHandoff(repo, null, { dirty: 0 });
    assert.match(a, /트랙 없이 끝난 세션|못 찾았다/,
      `보드에 내 줄이 없는데 그 판정을 안 말한다:\n${a}`);
    assert.doesNotMatch(a, /트랙 줄을 찾고/,
      `없는 줄을 「찾아라」로 시킨다 — 다음 세션이 없는 것을 뒤진다:\n${a}`);
    // 🔴 F170 — 「찾아라」를 걷어낸 자리에 「멈춰라」가 들어와 있었다. 트랙 없는 세션의 옳은
    //    다음 수는 멈춤이 아니라 새 트랙이다(세션 셋이 이 문구로 탔다).
    assert.doesNotMatch(a, /멈춰라/, `🔴 트랙 없이 끝난 세션에 「멈춰라」가 나갔다:\n${a}`);
    assert.match(a, /새 트랙/, `다음 수를 안 줬다 — 「없다」로만 끝나면 새 세션이 되훑는다:\n${a}`);
    assert.doesNotMatch(a, /남의 트랙/, '남의 보드 줄을 내 트랙으로 실었다(F073)');

    // ② 같은 보드에 내 해시가 들어오면 반대 방향 — 「못 찾았다」가 아니라 상태/다음이 실려야 한다.
    //    (한쪽만 검사하면 문구를 통째로 지워도 초록이다.)
    fs.appendFileSync(보드, `| 2026-08-07 | 내 트랙 | y | ✅종결(${해시}) · 다음=S1 배달 |\n`);
    const b = report.buildHandoff(repo, null, { dirty: 0 });
    assert.match(b, /내 트랙/, `내 해시가 보드에 있는데 줄을 못 실었다:\n${b}`);
    assert.match(b, /다음=S1 배달/, '상태/다음 칸이 안 실렸다 — 주소만 있고 내용이 없다');
    assert.doesNotMatch(b, /못 찾았다/, '줄을 찾았는데 못 찾았다고 말한다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
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
  // 실제로 변이(최신 대신 가장 오래된 것 선택)를 넣었을 때 초록으로 통과했다(08-04 변이 실측).
  const order = ['SESS-A', 'SESS-B', 'SESS-C'];
  for (const f of batons(st)) {
    const p = path.join(st, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const idx = order.indexOf(j.sessionId);
    fs.writeFileSync(p, JSON.stringify({ ...j, at: Date.now() - (order.length - idx) * 60_000, message: `${j.message}\n· 표식:${j.sessionId}` }));
  }

  const got = startHook(st, cwd);
  // ⚠ 인계문은 이제 **plain-text stdout** 으로 나간다(F661 ㈐) — 유호님의 첫 발화 자리를 안 쓴다.
  assert.ok(got.out, '바통이 셋인데 아무것도 못 집었다');
  assert.match(got.out, /표식:SESS-C/,
    '가장 최근 바통이 아닌 것을 집었다 — 직전 세션이 아니라 옛 트랙을 이어간다');

  // 🔑 뒤처진 바통을 **함께 지우면 그 트랙은 영영 안 이어진다.** 08-04 실사고: 창을 여러 개
  //   쓰는 이 환경에선 300k 를 넘긴 세션이 동시에 여럿이라, 새 창 하나가 열릴 때마다 다른
  //   트랙의 인계문이 통째로 삭제됐다(1분 차이로 뒤엣것이 앞엣것을 밀어냈다).
  assert.match(got.out, /2건이 \*\*아직 대기/, '남은 인계문이 있다는 걸 안 알렸다');
  assert.strictEqual(batons(st).length, 2, '집지 않은 바통까지 지웠다 — 그 트랙은 영영 안 이어진다');

  // 창을 더 열면 남은 것을 **최신 순으로 하나씩** 이어받는다
  assert.match(startHook(st, cwd).out, /표식:SESS-B/,
    '두 번째 창이 다음 바통을 못 받았다');
  assert.match(startHook(st, cwd).out, /표식:SESS-A/,
    '세 번째 창이 마지막 바통을 못 받았다');
  assert.strictEqual(batons(st).length, 0, '다 소비했는데 파일이 남았다');
  assert.strictEqual(startHook(st, cwd).out, '', '다 소비했는데 또 물었다');
});

test('🔑 다른 저장소의 바통은 물지 않는다 (결함 ②)', () => {
  const st = newDir('proj-iso');
  const mine = newDir('repo-mine');
  const other = newDir('repo-other');
  stop(310_000, { stateDir: st, cwd: other, sid: 'OTHER' });
  assert.strictEqual(batons(st).length, 1, '남의 저장소 바통이 안 떨어졌다(전제 실패)');

  assert.strictEqual(startHook(st, mine).out, '', '다른 저장소 세션의 인계문을 물었다');
  assert.strictEqual(batons(st).length, 1, '남의 저장소 바통을 지워버렸다 — 그 세션이 이어받을 걸 뺏었다');
  assert.ok(startHook(st, other).out, '자기 저장소 바통은 물어야 한다');
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
  assert.strictEqual(startHook(stale, cwd).out, '', '12시간 넘은 바통을 물었다');

  const live = newDir('live'); const c2 = newDir('p-live');
  stop(310_000, { stateDir: live, cwd: c2, sid: 'X' });
  assert.strictEqual(startHook(live, c2, 'resume').out, '', 'resume 은 컨텍스트가 살아 있어 중복 지시가 된다');
  assert.strictEqual(startHook(live, c2, 'compact').out, '', 'compact 도 이어지는 세션이다');
  assert.ok(startHook(live, c2, 'startup').out, 'startup 은 물어야 한다');

  assert.strictEqual(startHook(newDir('empty'), newDir('p-empty')).out, '', '바통도 없는데 반응했다');
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

  // 내가 편집한 파일이 미커밋으로 남은 세션 = 일한 세션 → 바통을 남긴다(Stop 훅은 한 번도 안 돌았다)
  fs.writeFileSync(path.join(repo, '작업중.txt'), 'x');
  stamp(st, repo, 'END-1', '작업중.txt');   // 실제로 Write 를 쓴 세션이면 도장이 찍혀 있다
  const v = endHook(st, repo, 'END-1');
  assert.ok(v.json, '내 편집이 미커밋인데 인계를 안 남겼다 — 평상시 세션이 통째로 안 이어진다');
  assert.strictEqual(batons(st).length, 1, '바통이 없다');
  assert.match(startHook(st, repo).out, /이어서 작업한다/,
    '새 세션이 그 바통을 컨텍스트로 물지 않았다');
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

test('🔑 «남의» 미커밋으로는 일한 세션이 되지 않는다 (2026-08-12 유호님 신고 · 실측 10/55건)', (t) => {
  /* 옛 판정은 `git status` 전체를 셌다. 이 저장소는 세션이 동시에 여덟씩 돌아 미커밋이 0 이 된
   * 적이 없어, 위 「일 안 한 세션」 게이트가 **원리상 한 번도 안 닫혔다** — 실측 인계문 55건 중
   * 10건이 커밋 0·트랙 0이었고(예 `8a384d90`: 남의 미커밋 12건), 그게 다음 창에 「이어서
   * 작업한다」로 박혀 없는 트랙을 이어받게 했다. 위 두 테스트는 이 자리를 못 본다 —
   * 하나는 「내 편집」, 하나는 「깨끗한 저장소」라 **남의 미커밋만 있는 판**이 둘 사이에 있었다. */
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');
  const repo = newDir('other-repo');
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  const st = newDir('other-state');

  fs.writeFileSync(path.join(repo, '남의작업.txt'), 'x');   // 저장소는 더럽다 — 하지만 남의 것이다
  stamp(st, repo, 'OTHER-SESSION', '남의작업.txt');          // 도장 통로는 살아 있다(남이 찍었다)

  assert.strictEqual(endHook(st, repo, 'ME').json, null,
    '남의 미커밋 때문에 「일한 세션」이 됐다 — 다음 창이 없는 트랙을 물게 된다');
  assert.strictEqual(batons(st).length, 0, '바통 파일이 생겼다');
});

test('🔑 도장 통로가 죽으면 옛 판정으로 폴백한다 — 새는 방향은 「남긴다」여야 한다', (t) => {
  /* 이 게이트의 파국 모드는 「통과」가 아니라 **「무기록」**이다. edit-stamp 가 등록에서 빠지거나
   * 죽으면 도장이 0 이 되고, 그때 「도장 없음 = 일 안 했다」로 읽으면 **모든 세션이 조용히
   * 바통을 잃는다** — 화면엔 아무 표도 안 난다. 그래서 통로 생사를 따로 재고, 안 보이면
   * 저장소 전체 판정으로 되돌아간다. 바통 하나 더 남는 쪽이 인계를 통째로 잃는 쪽보다 싸다. */
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음');
  const repo = newDir('nostamp-repo');
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패');
  const st = newDir('nostamp-state');

  fs.writeFileSync(path.join(repo, '작업중.txt'), 'x');       // 미커밋은 있는데 도장은 **하나도** 없다
  assert.ok(endHook(st, repo, 'NOSTAMP').json,
    '도장 통로가 죽었는데 바통까지 잃었다 — 인계가 통째로 조용히 멈춘다');
  assert.strictEqual(batons(st).length, 1, '폴백이 바통을 안 남겼다');
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

/* ── 죽음 도장 (F252 · 2026-08-08 실사고) ─────────────────────────────────────
 * 살았나/죽었나를 심장박동 하나로 재던 탓에, 유호님 답을 기다리며 **쉬는 세션**이 죽은 세션과
 * 같은 모양이 됐고 그 세션의 미커밋 11파일이 ⚪유물로 커밋됐다. 침묵으로 죽음을 추정하는 대신
 * SessionEnd 가 도장을 찍는다 — 읽는 쪽(`tools/작업본소유자.js`)이 ⚪를 낼 유일한 근거다. */
const store = require(path.join(HOOKS, 'lib', 'handoff-store.js'));
function 만진기록(st, cwd, sid, 내용) {
  // 이름 규칙은 track-collision 이 쓰는 것과 같다 — 도장은 **기존 파일에만** 찍히므로 먼저 놓는다.
  const p = path.join(st, `track-${store.projectKey(cwd)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({ baseline: 'x', touched: ['a.js'], at: Date.now(), ...(내용 || {}) }));
  return p;
}

test('🔴 SessionEnd 는 죽음에 도장을 찍는다 — 침묵을 죽음으로 추정하지 않게 (F252)', () => {
  const st = newDir('stamp'); const cwd = newDir('p-stamp');
  const p = 만진기록(st, cwd, 'STAMP-1');
  fs.writeFileSync(path.join(cwd, 'x.txt'), 'x');
  endHook(st, cwd, 'STAMP-1');
  assert.ok(Number(JSON.parse(fs.readFileSync(p, 'utf8')).끝남) > 0,
    '정상 종료했는데 도장이 없다 — 그 세션의 유물은 영영 ❔에 갇히고 F025(미추적=무보호)로 돌아간다');
});

test('🔑 도장은 「일한 세션」 게이트 위에 있다 — 조용히 안 찍히는 세션이 생기면 안 된다', () => {
  const st = newDir('stamp2'); const cwd = newDir('p-stamp2');
  const p = 만진기록(st, cwd, 'STAMP-2');
  // 커밋도 미커밋도 없는 세션 = 바통은 안 남긴다. 그래도 **도장은 찍힌다**(목적이 다르다).
  assert.strictEqual(endHook(st, cwd, 'STAMP-2').json, null, '전제가 깨졌다 — 이 세션은 바통을 남기면 안 된다');
  assert.ok(Number(JSON.parse(fs.readFileSync(p, 'utf8')).끝남) > 0,
    '바통 게이트 안에 도장이 들어갔다 — 일 안 한 세션의 만진 기록이 영영 「끝났는지 모름」으로 남는다');
});

test('🔴 resume·compact 는 세션이 이어지는 것이라 도장을 안 찍는다', () => {
  const st = newDir('stamp3'); const cwd = newDir('p-stamp3');
  for (const r of ['resume', 'compact']) {
    const p = 만진기록(st, cwd, `STAMP-${r}`);
    endHook(st, cwd, `STAMP-${r}`, r);
    assert.strictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).끝남, undefined,
      `${r} 에서 도장을 찍었다 — 살아서 이어지는 세션의 작업본이 ⚪ 유물로 떨어진다(F252 재현)`);
  }
});

/* 「만진 기록이 없으면 빈 파일을 만들지 않는다」는 여기서 **안 잰다** — 변이로 실측하니
 * 바로 뒤 `store.sweep()` 이 `at` 없는 파일을 그 자리에서 지워, 만들어도 초록이 나온다.
 * 못 잡는 검사를 두면 그건 탐지가 아니라 거짓 초록이다(맹점 ②). 그 성질은 markEnded 가
 * 기존 파일만 읽어 쓰는 구현으로 지고 있고, 깨지면 증상은 sweep 잡파일 하나뿐이다. */

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
