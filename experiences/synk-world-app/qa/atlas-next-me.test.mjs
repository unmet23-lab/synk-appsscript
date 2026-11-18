// 「나」 칸(Atlas 재설계 단계 4-5 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §22-6 · §22-9 WORLD). 목록의 거름 · 나눔 · 순서(meUnits)와
// 학습 화면의 몫 — 새 길 홈 코치가 엔진 판일 때만 서고, 「이미 알아요」 · 「다시 배울래요」는 코치의 tell로 적고, 되돌리기는 그 사건을 빼며, 「연습
// 기록 비우기」는 입구의 clearPractice를 부른다. 옛 엔진의 두 문(셸 배선 — 올리기 대기열 · 옛 손님 기록 비우기)도 본다. 변형은
// qa/position-mutants.mjs의 「나 칸」 갈래에 있다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { sourceStatements } from '../../../tests/lib/source-statements.cjs';
import { positionPlanner } from '../world-atlas-next.mjs';

// 변형 시험(qa/position-mutants.mjs의 「나 칸」 갈래)은 깬 사본을 환경 변수로 넘긴다 — 목록(SYNK_ME_NEXT_MODULE), 학습 화면(SYNK_LEARNING_UI_MODULE),
// 옛 엔진의 두 문(SYNK_OLD_DOORS_MODULE). 그 밖에는 원본이다.
const load = (env, fallback) =>
  import(process.env[env] ? pathToFileURL(process.env[env]).href : fallback);
const { meUnits } = await load('SYNK_ME_NEXT_MODULE', '../world-me-next.mjs');
const { createWorldEducation } = await load('SYNK_LEARNING_UI_MODULE', '../world-learning-ui.mjs');
const { oldEngineDoors } = await load('SYNK_OLD_DOORS_MODULE', '../world-old-engine-doors.mjs');
const { worldPosition } = await import('../world-position-kit.mjs');
const { worldLearning } = await import('../world-learning-map.mjs');

const row = (unit, state, more = {}) => ({
  unit,
  kind: 'word',
  label: null,
  last: 'good',
  state,
  lapses: 0,
  lastAt: 1000,
  ...more,
});

test('meUnits — 흔들림 · 또렷함 · 직접 말함만 나누고 익히는 중은 싣지 않는다. 이름이 없는 단위는 목록과 수에서 빼고 그 수를 센다(N3)', () => {
  const names = new Map([
    ['u.a', { label: '가' }],
    ['u.b', { label: '나' }],
    ['u.c', { label: '다' }],
    ['u.l', { label: '라' }],
  ]);
  const me = meUnits(
    {
      units: [
        row('u.a', 'shaky'),
        row('u.b', 'clear', { label: '요약의 이름' }),
        row('u.c', 'said', { last: 'known' }),
        row('u.l', 'learning'),
        row('family:x', 'shaky'),
        row('u.nameless', 'clear'),
        row('u.own', 'said', { label: '스스로' }),
      ],
    },
    names,
  );
  assert.deepEqual(
    me.shaky.map(r => r.unit),
    ['u.a'],
  );
  assert.deepEqual(
    me.clear.map(r => [r.unit, r.label]),
    [['u.b', '나']],
    '이름은 「내 위치」와 같은 단위 길의 이름이 앞선다',
  );
  assert.deepEqual(
    me.said.map(r => [r.unit, r.label]),
    [
      ['u.c', '다'],
      ['u.own', '스스로'],
    ],
    '단위 길에 이름이 없으면 요약 줄의 이름을 쓴다',
  );
  assert.deepEqual(me.counts, { shaky: 1, clear: 1, said: 2 });
  assert.equal(me.unnamed, 2, 'family: 단위와 이름 없는 단위 둘이 빠졌다');
});

test('meUnits — 흔들리는 말은 놓친 수가 많은 것부터, 같으면 마지막 자리가 오래된 것부터. 나머지 둘은 이름 차례다', () => {
  const me = meUnits({
    units: [
      // 놓친 수가 같은 둘은 이름 차례(셋 → 하나)와 마지막 자리 차례(하나 → 셋)가 다르다.
      row('u.1', 'shaky', { label: '하나', lapses: 1, lastAt: 2000 }),
      row('u.2', 'shaky', { label: '둘', lapses: 3, lastAt: 9000 }),
      row('u.3', 'shaky', { label: '셋', lapses: 1, lastAt: 5000 }),
      row('u.4', 'clear', { label: '다리' }),
      row('u.5', 'clear', { label: '가방' }),
      row('u.6', 'said', { label: '사과' }),
      row('u.7', 'said', { label: '바다' }),
    ],
  });
  assert.deepEqual(
    me.shaky.map(r => r.label),
    ['둘', '하나', '셋'],
  );
  assert.deepEqual(
    me.clear.map(r => r.label),
    ['가방', '다리'],
  );
  assert.deepEqual(
    me.said.map(r => r.label),
    ['바다', '사과'],
  );
});

test('meUnits — 요약이 없거나 꼴이 아니면 빈 목록이다. 홈 플래너에 실려 셸이 같은 함수를 부른다', () => {
  assert.deepEqual(meUnits(null), {
    shaky: [],
    clear: [],
    said: [],
    counts: { shaky: 0, clear: 0, said: 0 },
    unnamed: 0,
  });
  // 깬 목록 사본을 받은 변형 시험에서는 플래너가 원본을 실으므로 같은 함수인지 보지 않는다.
  if (!process.env.SYNK_ME_NEXT_MODULE) assert.equal(positionPlanner.meUnits, meUnits);
});

// ── 학습 화면의 몫 — 가짜 홈 코치(엔진 판)와 진짜 홈 플래너의 position(unitRoutes · meUnits) ──

const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
};

function setup({ phase = 'engine', atlasNext = {}, coach: given = null } = {}) {
  const told = [];
  const excluded = [];
  const coach = given ?? {
    watch: () => () => {},
    responses: () => ({ complete: true, rows: [] }),
    itemUnits: () => [],
    summary: () => ({
      units: [
        row('u.shaky', 'shaky', { label: '흔들림' }),
        row('u.clear', 'clear', { label: '또렷함' }),
        row('u.said', 'said', { label: '말함', last: 'known' }),
      ],
    }),
    tell(unit, kind) {
      told.push([unit, kind]);
      return { id: `tell-${told.length}`, type: 'self.reported' };
    },
    exclude(eventId) {
      excluded.push(eventId);
      return { id: `x-${eventId}` };
    },
    untell(eventId) {
      excluded.push(eventId);
      return { event: { id: `x-${eventId}` }, stored: Promise.resolve(!eventId.startsWith('fail')) };
    },
  };
  let onChange = null;
  const today = {
    items: [],
    minutes: 0,
    line: null,
    empty: { code: 'done', text: null },
    capped: false,
    cappedText: null,
    firstDay: false,
    state: 'engine',
    redrawAt: null,
  };
  const planner = {
    todayKey: () => '2026-10-22',
    say: () => null,
    position: positionPlanner,
    createWorldTodayPlan: () => ({
      status: 'empty',
      selected: null,
      selectedKind: null,
      reason: '',
      resume: null,
      candidates: [],
      examPlan: null,
      today,
    }),
    watchHomePlan: options => {
      onChange = options.onChange;
      // 코치는 판과 상관없이 준다 — 학습 화면이 판(엔진인가)을 스스로 보는지 가린다.
      return {
        phase: () => (typeof phase === 'function' ? phase() : phase),
        coach: () => coach,
        redrawAt() {},
        dispose() {},
      };
    },
  };
  const homeNext = {
    judge: () => null,
    answers: () => null,
    openGames: () => null,
    coach: async () => null,
    retired: () => () => {},
    painted() {},
    planner: async () => planner,
    life: () => 'engine',
  };
  const storage = memory();
  const progress = {
    owner: 'account-a',
    learningProfile: () => ({ profile: { status: 'active', revision: 1, consent: true } }),
    learningProfileValues: () => ({ audio: 'off' }),
    status: () => ({ phase: 'synced', rejected: false, scoped: true, message: '' }),
    exportSnapshot: () => ({}),
    flush: async () => {},
    hangulReading: () => ({ answer: 'reads' }),
  };
  const home = {
    updateStudy() {},
    toast() {},
    closePanel() {},
    attachPanelResource() {},
    showPanel() {},
  };
  const target = {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    document: { querySelector: () => null },
  };
  const education = createWorldEducation({
    home,
    getProgress: () => progress,
    engine: worldLearning,
    createPlan: () => ({ selected: null, reason: '' }),
    launchGame() {},
    startLesson() {},
    startReview() {},
    position: worldPosition,
    responses: true,
    target,
    atlasNext,
    homeNext,
  });
  const ready = async () => {
    for (let tick = 0; tick < 20 && !onChange; tick += 1)
      await new Promise(resolve => setTimeout(resolve, 0));
  };
  return { education, told, excluded, ready, change: () => onChange?.() };
}

test('학습 화면 — 「나」는 새 길 홈 코치가 엔진 판일 때만 서고, 확인 중이거나 지금 판이면 null이다', async () => {
  const engine = setup();
  await engine.ready();
  const me = engine.education.me();
  assert.deepEqual(
    [me.shaky.map(r => r.unit), me.clear.map(r => r.unit), me.said.map(r => r.unit)],
    [['u.shaky'], ['u.clear'], ['u.said']],
  );
  const checking = setup({ phase: 'checking' });
  await checking.ready();
  assert.equal(checking.education.me(), null, '확인 중이면 칸이 서지 않는다');
});

test('학습 화면 — 「이미 알아요」 · 「다시 배울래요」는 코치의 tell로 적고 사건 번호를 준다. 되돌리기는 그 사건을 뺀다', async () => {
  const env = setup();
  await env.ready();
  assert.equal(env.education.tellMe('u.shaky', 'known'), 'tell-1');
  assert.equal(env.education.tellMe('u.clear', 'relearn'), 'tell-2');
  assert.deepEqual(env.told, [
    ['u.shaky', 'known'],
    ['u.clear', 'relearn'],
  ]);
  assert.equal(await env.education.undoMe('tell-2'), true, '저장되면 참으로 풀린다');
  assert.deepEqual(env.excluded, ['tell-2'], '되돌리기는 tell이 돌려준 사건을 코치의 untell로 뺀다');
  assert.equal(await env.education.undoMe('fail-1'), false, '저장되지 않으면 거짓이다(4-5 끝 판 GPT GB4)');
  assert.equal(await env.education.undoMe(null), false);
  assert.equal(env.education.tellMe('u.x', 'maybe'), null, '본인 말이 아닌 값은 적지 않는다');
});

test('학습 화면 — 「연습 기록 비우기」는 입구의 clearPractice를 부르고 그 결과를 준다. 입구가 없으면 null이다', async () => {
  const calls = [];
  const env = setup({
    atlasNext: {
      clearPractice: async options => {
        calls.push(options ?? null);
        return { ok: true, path: 'upload', revision: 2, partial: false };
      },
    },
  });
  await env.ready();
  assert.deepEqual(await env.education.clearPractice(), {
    ok: true,
    path: 'upload',
    revision: 2,
    partial: false,
  });
  assert.deepEqual(await env.education.clearPractice({ allowSkipped: 3 }), {
    ok: true,
    path: 'upload',
    revision: 2,
    partial: false,
  });
  assert.deepEqual(calls, [null, { allowSkipped: 3 }], '학생이 확인한 수를 그대로 넘긴다(F4)');
  const bare = setup({ atlasNext: {} });
  await bare.ready();
  assert.equal(await bare.education.clearPractice(), null);
});

// ── 옛 엔진의 두 문(셸 배선 — world-old-engine-doors.mjs, 4-5 §22-4 · 4-5 코드 검수 GPT GA1) ──

function fakeOldGame({ leased = true, log, chosen = null }) {
  const listeners = new Set();
  const game = {
    leased,
    resets: 0,
    chosen,
    // 손님이 고른 화면 값(.presentation) — 옛 reset이 .flow · .today와 함께 지운다(atlas/game-flow.js clear).
    presentation: () => (game.chosen ? { ...game.chosen } : null),
    setPresentation(value) {
      game.chosen = value ? { ...value } : null;
      return true;
    },
    disposed: false,
    summary: () => ({ storage: { available: game.leased } }),
    // 옛 코치는 기록의 알림(storage-ready 등)을 syncPort로 낸다(atlas/game-learning.js).
    syncPort: {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    reset() {
      if (!game.leased)
        throw Object.assign(new Error('busy'), { code: 'STORAGE_BUSY' });
      game.resets += 1;
      log.events = [];
      game.chosen = null;
    },
    dispose() {
      game.disposed = true;
    },
    grant() {
      game.leased = true;
      for (const listener of [...listeners]) listener({ kind: 'storage-ready' });
    },
  };
  return game;
}

test('옛 엔진의 비우는 문 — 쓰기 임대를 기다린 뒤 check가 오면 임대를 쥔 채 옛 로그를 다시 읽어 참일 때만 비우고, 거짓이면 kept다(GA1)', async () => {
  const log = { events: ['old-1'] };
  let game = null;
  let leased = false; // 첫 옛 코치만 임대를 늦게 받는다
  const doors = oldEngineDoors({
    openGame: () => {
      game = fakeOldGame({ leased, log });
      return game;
    },
    host: () => null,
    leaseWaitMs: 1000,
  });
  // 임대가 늦게 와도 기다린다. 그사이 다른 탭이 옮기지 않은 기록을 더했다 — 다시 읽은 값으로 판단한다.
  const pending = doors.clear({ check: value => value.length === 1, read: () => [...log.events] });
  log.events.push('after-1');
  game.grant();
  assert.equal(await pending, 'kept', '다시 읽은 로그가 판단을 넘지 못하면 비우지 않는다');
  assert.deepEqual(log.events, ['old-1', 'after-1']);
  assert.equal(game.disposed, true, '연 옛 코치를 닫는다');
  leased = true;
  // check가 참이면 비운다. check 없이 부르면(손님 비우기) 그대로 비운다.
  assert.equal(await doors.clear({ check: () => true, read: () => [...log.events] }), 'cleared');
  assert.equal(game.resets, 1);
  log.events = ['old-2'];
  assert.equal(await doors.clear(), 'cleared');
  assert.deepEqual(log.events, []);
});

test('옛 엔진의 비우는 문 — 손님이 고른 화면 값은 남긴다(옛 reset이 지우는 .presentation을 임대 안에서 읽어 두었다 다시 쓴다 — 설계 주인 답 5 · 4-5 Opus 대체 설계 검토 F2)', async () => {
  const log = { events: ['old-1'] };
  const chosen = { support: 'hint', motion: 'reduced' };
  let game = null;
  const doors = oldEngineDoors({
    openGame: () => {
      game = fakeOldGame({ leased: true, log, chosen });
      return game;
    },
    host: () => null,
  });
  assert.equal(await doors.clear({ check: () => true, read: () => [...log.events] }), 'cleared');
  assert.deepEqual(log.events, [], '옛 로그는 비웠다');
  assert.deepEqual(game.presentation(), chosen, '고른 화면 값은 그대로다');
  // 고른 값이 없으면 다시 쓰지 않는다.
  log.events = ['old-2'];
  const bare = oldEngineDoors({
    openGame: () => {
      game = fakeOldGame({ leased: true, log });
      return game;
    },
    host: () => null,
  });
  assert.equal(await bare.clear(), 'cleared');
  assert.equal(game.presentation(), null);
});

test('옛 엔진의 비우는 문 — 한도 안에 임대를 못 받으면 STORAGE_BUSY로 던지고 비우지 않는다', async () => {
  const log = { events: ['old-1'] };
  let game = null;
  const doors = oldEngineDoors({
    openGame: () => {
      game = fakeOldGame({ leased: false, log });
      return game;
    },
    host: () => null,
    leaseWaitMs: 20,
  });
  await assert.rejects(doors.clear(), error => error.code === 'STORAGE_BUSY');
  assert.deepEqual(log.events, ['old-1']);
  assert.equal(game.disposed, true);
});

test('옛 엔진의 올리는 문 — 옛 학습 호스트의 다시 보내기 뒤 대기열이 비었을 때만 참이다. 호스트가 없으면 거짓이다', async () => {
  let queued = 2;
  const host = { retry: async () => ({ phase: queued ? 'offline' : 'idle', queued }) };
  const doors = oldEngineDoors({ openGame: () => assert.fail('열지 않는다'), host: () => host });
  assert.equal(await doors.flush(), false, '남은 것이 있으면 거짓 — 입구가 아무것도 지우지 않는다');
  queued = 0;
  assert.equal(await doors.flush(), true);
  const none = oldEngineDoors({ openGame: () => null, host: () => null });
  assert.equal(await none.flush(), false, '옛 호스트가 없으면 올렸는지 모른다');
});

test('옛 엔진의 올리는 문 — 대기열 0은 동기화가 막힘 · 쉼 · 오류 없이 섰을 때만 믿는다. 다른 탭이 쓰기 임대를 쥐면 이 탭이 마지막으로 읽은 0은 낡은 값이다(4-5 Opus 대체 설계 검토 F1)', async () => {
  let state = null;
  const doors = oldEngineDoors({
    openGame: () => assert.fail('열지 않는다'),
    host: () => ({ retry: async () => state }),
  });
  // 다른 탭이 임대를 쥐었다 — 옛 동기화는 공유 대기열을 다시 읽지 않고 이 탭의 낡은 수를 offline · STORAGE_BUSY와 함께 준다.
  state = { phase: 'offline', code: 'STORAGE_BUSY', queued: 0 };
  assert.equal(await doors.flush(), false, '다른 탭이 쥔 대기열은 올렸는지 모른다');
  state = { phase: 'blocked', code: 'EVENT_RUN_CONFLICT', queued: 0 };
  assert.equal(await doors.flush(), false, '막힌 동기화의 0은 믿지 않는다');
  state = { phase: 'syncing', code: null, queued: 0 };
  assert.equal(await doors.flush(), false, '아직 도는 중이다');
  state = { phase: 'synced', code: null, queued: 0 };
  assert.equal(await doors.flush(), true, '다 올린 뒤다');
  state = { phase: 'idle', code: null, queued: 0 };
  assert.equal(await doors.flush(), true, '쉬는 상태의 빈 대기열이다');
});

test('옛 엔진의 올리는 문 — 서버가 사건을 받지 않아 옛 동기화가 막혔으면 그 수를 UNSENT_SKIPPED로 알린다. 계정 · 인증 까닭의 막힘이나 막히지 않은 오류는 거짓이다(4-5 Opus 대체 설계 검토 F4)', async () => {
  let state = null;
  // 막힌 뒤에 든 답이 없으면 기록부에서 다시 센 수가 대기열의 수다(GC1).
  const doors = oldEngineDoors({
    openGame: () => assert.fail('열지 않는다'),
    host: () => ({ retry: async () => state, unsent: () => state.queued }),
  });
  state = { phase: 'blocked', code: 'INVALID_EVENTS', queued: 3 };
  assert.deepEqual(await doors.flush(), { ok: false, code: 'UNSENT_SKIPPED', skipped: 3 });
  state = { phase: 'blocked', code: 'EVENT_RUN_CONFLICT', queued: 2 };
  assert.deepEqual(await doors.flush(), { ok: false, code: 'UNSENT_SKIPPED', skipped: 2 });
  state = { phase: 'blocked', code: 'SESSION_REVOKED', queued: 2 };
  assert.equal(await doors.flush(), false, '계정 까닭의 막힘은 사건 탓이 아니다');
  state = { phase: 'offline', code: 'INVALID_EVENTS', queued: 2 };
  assert.equal(await doors.flush(), false, '막히지 않았으면 다시 해 볼 일이다');
  state = { phase: 'blocked', code: 'INVALID_EVENTS', queued: 0 };
  assert.equal(await doors.flush(), false, '남은 것이 없는 막힘은 셀 것이 없다');
});

test('옛 엔진의 올리는 문 — 막힌 동기화의 대기열 수는 막힌 때의 수라, 그 뒤에 든 답까지 기록부에서 다시 센 수를 알린다. 셀 수 없으면(쓰기 임대 없음 · 다시 세지 못하는 호스트) 아무것도 지우지 않는다(4-5 끝 판 GPT GC1)', async () => {
  const state = { phase: 'blocked', code: 'EVENT_CONFLICT', queued: 1 };
  let counted = 2;
  const doors = oldEngineDoors({
    openGame: () => assert.fail('열지 않는다'),
    host: () => ({ retry: async () => state, unsent: () => counted }),
  });
  assert.deepEqual(await doors.flush(), { ok: false, code: 'UNSENT_SKIPPED', skipped: 2 }, '막힌 뒤에 든 답까지 센다');
  counted = null;
  assert.equal(await doors.flush(), false, '다른 탭이 쓰기 임대를 쥐어 셀 수 없으면 거짓');
  counted = 0;
  assert.equal(await doors.flush(), false, '다시 센 수가 없으면 셀 것이 없다');
  const old = oldEngineDoors({ openGame: () => assert.fail('열지 않는다'), host: () => ({ retry: async () => state }) });
  assert.equal(await old.flush(), false, '다시 세지 못하는 호스트면 거짓');
});

test('옛 엔진의 비우는 문 — wait 0이면 쓰기 임대를 기다리지 않고 곧바로 STORAGE_BUSY다(남은 걸음 — 4-5 Opus 대체 설계 검토 F7)', async () => {
  const log = { events: [{ id: 'x' }] };
  const game = fakeOldGame({ leased: false, log });
  const doors = oldEngineDoors({ openGame: () => game, host: () => null, leaseWaitMs: 60_000 });
  const started = Date.now();
  await assert.rejects(doors.clear({ wait: 0 }), error => error.code === 'STORAGE_BUSY');
  assert.ok(Date.now() - started < 1000, '기다리지 않았다');
  assert.equal(game.resets, 0);
  assert.equal(game.disposed, true);
});

// ── 앱의 배선(app-shell.mjs — 브라우저 셸이라 원문으로 본다, atlas-next-mock-shell.test.mjs와 같은 꼴). 변형 시험은 깬 앱 원문을 SYNK_APP_SHELL_SOURCE로 넘긴다 ──

test('앱의 배선 — 입구에 옛 엔진의 두 문을 넘기고, 감싸기가 clearPractice를 잇고, 「내 계정」 시트가 응답 목록 뒤에 「나」 칸을 그린다. 비우기는 한 번 더 묻고 결과를 알린다', () => {
  const source = fs.readFileSync(
    process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /const oldDoorsOf=m=>m\.oldEngineDoors\?\.\(\{openGame:\(\)=>worldLearning\.engine\.createGame\(\{gameId:'world-home',storage:window\.localStorage\}\),host:\(\)=>window\.SYNKLearningHost\|\|null\}\);/,
    '옛 손님 코치와 옛 학습 호스트로 두 문을 짓는다',
  );
  assert.match(source, /trail:trailOf\(m\),oldEngine:oldDoorsOf\(m\)\}\);/, '입구에 두 문을 넘긴다');
  assert.doesNotMatch(
    source,
    /^import[^\n]*world-old-engine-doors/m,
    '두 문은 입구 모듈이 함께 싣는다 — 새 길이 꺼진 셸은 받지 않는다',
  );
  assert.match(
    source,
    /async clearPractice\(options\)\{if\(disposed\)return null;const entry=await load\(\);return disposed\?null:entry\.clearPractice\(options\);\}/,
    '감싸기가 학생이 확인한 수(allowSkipped)를 입구에 넘긴다(F4)',
  );
  assert.match(
    source,
    /const education=life\.education,owner=client\.snapshot\?\.accountId\|\|'guest',same=\(\)=>life\.education===education&&\(client\.snapshot\?\.accountId\|\|'guest'\)===owner;/,
    '다시 묻고 다시 부르는 것은 처음 누른 로그인의 학습 화면에만 한다(4-5 코드 다시 검수 GPT -c GA1)',
  );
  assert.match(
    source,
    /for\(let asks=0;asks<3&&result\?\.code==='UNSENT_SKIPPED'&&Number\.isSafeInteger\(result\.skipped\)&&result\.skipped>0;asks\+=1\)\{\r?\n  if\(!same\(\)\|\|!window\.confirm\(meText\('me\.clearSkippedAsk',\{n:result\.skipped\}\)\)\|\|!same\(\)\)return;\r?\n  try\{result=await education\.clearPractice\(\{allowSkipped:result\.skipped\}\);\}/,
    '지금 보낼 수 없는 기록의 수를 알리고 한 번 더 묻는다. 그사이 수가 늘었으면 새 수로 다시 묻는다(F4 · GPT -c GA4)',
  );
  assert.match(source, /\$\{responsesSection\(\)\}\$\{meSection\(true\)\}<div id="world-classroom-lessons">/);
  assert.match(source, /mountResponses\(\);refreshResponses\(\);mountMe\(\);waitMe\(\);/);
  assert.match(source, /if\(!window\.confirm\(meText\('me\.clearAsk'\)\)\)return;/, '비우기 전에 한 번 더 묻는다');
  assert.match(
    source,
    /result\?\.code==='UNSENT'\?'me\.clearUnsent'/,
    '못 올린 기록이 있어 멈춘 것을 따로 알린다',
  );
  assert.match(
    source,
    /\n if\(operating\)try\{await account\.restore\(\);\}catch\{[^}]*\}\r?\n(?: \/\/[^\n]*\r?\n)* if\(!sheetOpen\(view\)\)return;\r?\n if\(sheet\?\.hasDraft\?\.\(\)\)\{redrawMeParts\(\);return;\}\r?\n profile\(\);/,
    '결과와 상관없이 계정 설정 스냅샷을 새로 받아 시트를 다시 그린다(§22-4 · 4-5 Opus 대체 설계 검토 F8) — 그 시트가 열려 있을 때만, 원고가 있으면 칸만(4-5 끝 판 GPT GB1)',
  );
});

test('새 모듈 둘(world-me-next.mjs · world-old-engine-doors.mjs)은 입구 모듈이 정적으로 받는다 — 리허설 서버와 공개 묶음의 새 길 목록에 함께 싣는다', async () => {
  const entry = await import('../world-atlas-next.mjs');
  assert.equal(typeof entry.oldEngineDoors, 'function', '입구 모듈이 두 문을 다시 내보낸다');
  if (!process.env.SYNK_OLD_DOORS_MODULE) assert.equal(entry.oldEngineDoors, oldEngineDoors);
  const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const build = fs.readFileSync(new URL('../../../tools/build-world-app-public.mjs', import.meta.url), 'utf8');
  for (const name of ['world-me-next.mjs', 'world-old-engine-doors.mjs']) {
    assert.ok(server.includes(`'/${name}'`), `리허설 서버가 ${name}을 낸다`);
    assert.ok(build.includes(`'${name}'`), `공개 묶음이 ${name}을 싣는다`);
  }
});

// ── 4-5 끝 판 처리 — 셸 원문(app-shell.mjs)의 블록을 그대로 vm에서 돌린다. 화면 · 입구는 시험용 짝이다 ──

const shellSource = () =>
  fs.readFileSync(process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url), 'utf8');
const deferred = () => {
  let resolve = null;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
function shellSandbox(names, context) {
  const statements = sourceStatements(shellSource());
  vm.createContext(context);
  vm.runInContext(names.map(name => statements.declaration(name)).join('\n'), context);
  return context;
}

test('학습 화면 — 확인 중에 「나」 칸을 물으면 홈 코치가 선 뒤 한 번 알린다. 기다리는 사이 다시 물으면 같은 약속이고, 닫으면 거짓이다(4-5 끝 판 GPT GB5)', async () => {
  let phase = 'checking';
  const env = setup({ phase: () => phase });
  await env.ready();
  let settled = null;
  const pending = env.education.meReady().then(value => {
    settled = value;
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settled, null, '확인 중에는 기다린다');
  assert.equal(env.education.meReady(), env.education.meReady(), '기다리는 사이 다시 물으면 같은 약속이다');
  phase = 'engine';
  env.change();
  await Promise.race([pending, new Promise(resolve => setTimeout(resolve, 2000))]);
  assert.equal(settled, true, '홈 코치가 엔진 판으로 서면 칸을 그릴 수 있다');
  assert.equal(await env.education.meReady(), true, '엔진 판이면 곧 참이다');
  const two = setup({ phase: 'checking' });
  await two.ready();
  let closed = null;
  const waiting = two.education.meReady().then(value => {
    closed = value;
  });
  two.education.dispose();
  await Promise.race([waiting, new Promise(resolve => setTimeout(resolve, 2000))]);
  assert.equal(closed, false, '닫으면 거짓으로 끝낸다');
});

test('앱의 비우기 — 비우는 사이 다시 누르면 묻지 않는다. 누른 시트가 닫혔으면 다시 열지 않고, 쓰던 반 과제 원고가 있으면 시트 대신 칸만 고친다(4-5 끝 판 카본 B3 · GPT GB1)', async () => {
  const run = async ({ draft = false, close = null } = {}) => {
    const calls = [];
    const confirms = [];
    const pending = deferred();
    const button = { disabled: false, isConnected: true };
    const view = { isConnected: true, querySelector: selector => (selector === '[data-me-clear]' ? button : null) };
    let kind = 'world-profile';
    const education = {
      clearPractice: () => {
        calls.push('clear');
        return pending.promise;
      },
    };
    const context = shellSandbox(['clearingPractice', 'clearPracticeNow', 'sheetOpen'], {
      window: {
        confirm: text => {
          confirms.push(text);
          return true;
        },
      },
      $: selector => (selector === '#panel-content .ws-me' && view.isConnected ? view : null),
      meText: key => key,
      life: { education },
      client: { snapshot: { accountId: 'a' } },
      home: { toast: text => calls.push(`toast:${text}`), openPanel: () => kind },
      operating: true,
      account: {
        restore: async () => {
          calls.push('restore');
        },
      },
      sheet: { hasDraft: () => draft },
      profile: () => calls.push('profile'),
      redrawMeParts: () => calls.push('parts'),
    });
    const first = context.clearPracticeNow();
    // 두 번째 누름은 기다리지 않는다 — 겹침 막이가 빠진 변형에서는 첫 비우기를 기다리며 멈춘다.
    await Promise.race([context.clearPracticeNow(), new Promise(resolve => setTimeout(resolve, 50))]);
    assert.equal(button.disabled, true, '비우는 사이 단추를 막는다');
    close?.({ view, shut: () => (kind = '') });
    pending.resolve({ ok: true });
    await first;
    return { calls, confirms, button };
  };
  const plain = await run();
  assert.deepEqual(plain.confirms, ['me.clearAsk'], '비우는 사이 다시 누른 것은 묻지 않는다');
  assert.deepEqual(plain.calls, ['clear', 'toast:me.clearDone', 'restore', 'profile']);
  assert.equal(plain.button.disabled, false, '끝나면 단추를 푼다');
  const draft = await run({ draft: true });
  assert.deepEqual(draft.calls.slice(-2), ['restore', 'parts'], '원고가 있으면 시트를 다시 그리지 않고 칸만 고친다');
  const closing = await run({ close: ({ shut }) => shut() });
  assert.deepEqual(closing.calls.slice(-1), ['restore'], '닫는 중(닫기 전환)이면 시트를 다시 열지 않는다');
  const gone = await run({
    close: ({ view }) => {
      view.isConnected = false;
    },
  });
  assert.deepEqual(gone.calls.slice(-1), ['restore'], '시트가 사라졌으면 그리지 않는다');
});

test('앱의 「나」 칸 — 확인 중에 연 시트는 홈 코치가 선 뒤 칸을 제자리(반 수업 앞)에 넣는다. 그사이 닫았거나 이미 칸이 있으면 넣지 않는다(4-5 끝 판 GPT GB5)', async () => {
  const run = async ({ ready = true, close = false, present = false } = {}) => {
    const inserted = [];
    const mounted = [];
    const wait = deferred();
    const view = { isConnected: true };
    const anchor = { insertAdjacentHTML: (where, html) => inserted.push([where, html]) };
    let kind = 'world-profile';
    const nodes = {
      '#panel-content .ws-me': view,
      '#panel-content [data-world-me]': present ? {} : null,
      '#panel-content #world-classroom-lessons': anchor,
    };
    const context = shellSandbox(['waitMe', 'sheetOpen'], {
      life: { education: { meReady: () => wait.promise } },
      $: selector => nodes[selector] ?? null,
      home: { openPanel: () => kind },
      meSection: () => '<section data-world-me></section>',
      mountMe: () => mounted.push('me'),
    });
    context.waitMe();
    if (close) kind = '';
    wait.resolve(ready);
    await wait.promise;
    await null;
    return { inserted, mounted };
  };
  const done = await run();
  assert.deepEqual(done.inserted, [['beforebegin', '<section data-world-me></section>']]);
  assert.deepEqual(done.mounted, ['me'], '넣은 칸의 단추를 잇는다');
  assert.deepEqual((await run({ ready: false })).inserted, [], '엔진 판으로 서지 않았으면 넣지 않는다');
  assert.deepEqual((await run({ close: true })).inserted, [], '닫는 중이면 넣지 않는다');
  assert.deepEqual((await run({ present: true })).inserted, [], '이미 칸이 있으면 기다리지 않는다');
});

test('앱의 「나」 칸 — 제목의 수는 보이는 줄(되돌리기 줄 포함)로, 「더 보기」는 되돌리기로 가린 단위를 뺀 줄로 센다. 되돌리기 줄이 있으면 빈 안내를 쓰지 않는다(4-5 끝 판 카본 B2)', () => {
  const rows = (prefix, n) =>
    Array.from({ length: n }, (_, i) => ({ unit: `${prefix}${i}`, label: `${prefix}${i}`, lastAt: 1 }));
  let me = { shaky: [], clear: [], said: [] };
  const context = shellSandbox(['ME_PAGE', 'meUndo', 'meSection'], {
    meNow: () => me,
    meText: (key, values) => (values ? `${key}=${values.n ?? values.label}` : key),
    escape: String,
    t: key => key,
    Date,
  });
  vm.runInContext("meUndo={unit:'s0',eventId:'e1',label:'s0',state:'said',at:Date.now()};", context);
  // 하나뿐인 목록에서 「다시 배울래요」 — 그 단위가 세 목록 밖으로 빠졌다.
  let html = context.meSection();
  assert.match(html, /<h4>me\.said=1<\/h4>/, '되돌리기 줄 하나가 보이면 1이다(0개 제목이 아니다)');
  assert.match(html, /me\.note/, '되돌리기 줄이 있으면 「아직 나눠 보여 줄 말이 없어요」를 쓰지 않는다');
  assert.doesNotMatch(html, /me\.empty/);
  // 그 단위가 흔들리는 말(다섯 줄)로 옮겨 가 가려졌다 — 보이는 줄은 다섯이고 「더 보기」가 없다.
  me = { shaky: [...rows('k', 5), { unit: 's0', label: 's0', lastAt: 0 }], clear: [], said: [] };
  html = context.meSection();
  assert.match(html, /<h4>me\.shaky=5<\/h4>/, '가린 단위는 수에 넣지 않는다');
  assert.doesNotMatch(html, /data-me-more="shaky"/, '숨긴 줄이 없으면 「더 보기」도 없다');
  assert.match(html, /<h4>me\.said=1<\/h4>/);
});

test('앱의 「내가 남긴 응답」 — 「더 보기」는 학생이 누른 때만 펼친 것으로 보고 다시 그린 칸에 잇는다. 서버 읽기 뒤 다시 그리면 초점을 같은 응답으로 돌려준다(4-5 끝 판 GPT GB6 · GB7 · 카본 B1)', () => {
  const source = shellSource();
  const context = shellSandbox(['responsesOpened', 'openResponses'], {});
  const responsesOpened = vm.runInContext('responsesOpened', context); // const 선언은 맥락의 칸이 아니다
  const hidden = [{ hidden: true }, { hidden: true }];
  let removed = 0;
  const box = {
    dataset: {},
    querySelectorAll: selector => (selector === '[data-response-later]' ? hidden : []),
    querySelector: selector => (selector === '[data-responses-more]' ? { remove: () => (removed += 1) } : null),
  };
  assert.equal(responsesOpened(box), false, '단추가 없던 짧은 목록도 누르기 전에는 펼친 것이 아니다');
  context.openResponses(box);
  assert.equal(responsesOpened(box), true);
  assert.deepEqual([hidden.map(row => row.hidden), removed], [[false, false], 1], '숨긴 줄을 펴고 단추를 걷는다');
  assert.doesNotMatch(source, /const open=!box\.querySelector\('\[data-responses-more\]'\)/, '단추가 없음을 펼침으로 보지 않는다');
  assert.match(source, /const open=responsesOpened\(box\),focused=box\.contains\(document\.activeElement\)\?document\.activeElement:null,keep=focused\?\.dataset\?\.responseRemove\?\?null;/);
  assert.match(
    source,
    /if\(focused&&next\)\(\[\.\.\.next\.querySelectorAll\('\[data-response-remove\]'\)\]\.find\(button=>button\.dataset\.responseRemove===keep&&!button\.closest\('\[hidden\]'\)\)\|\|next\.querySelector\('h3'\)\)\?\.focus\?\.\(\{preventScroll:true\}\);/,
    '초점이 칸 안에 있었으면 같은 응답의 단추로, 없으면 칸 제목으로',
  );
  assert.match(source, /if\(open&&next\)openResponses\(next\);/, '펼친 채면 다시 그린 칸도 편다');
});

test('앱의 「나」 칸 되돌리기 — 저장이 끝난 뒤에 칸을 다시 그리고, 저장되지 않으면 되돌리기를 남긴 채 알린다. 기다리는 사이 다시 누르면 한 번만 뺀다(4-5 끝 판 GPT GB4)', async () => {
  const run = async answer => {
    const calls = [];
    const pending = deferred();
    let handler = null;
    const box = { isConnected: true, addEventListener: (type, fn) => (handler = fn) };
    const undo = { disabled: false, dataset: { meUndo: 'tell-9' } };
    const context = shellSandbox(['meUndo', 'mountMe'], {
      $: selector => (selector === '#panel-content [data-world-me]' ? box : null),
      life: {
        education: {
          undoMe: id => {
            calls.push(`undo:${id}`);
            return pending.promise;
          },
        },
      },
      home: { toast: text => calls.push(`toast:${text}`) },
      meText: key => key,
      redrawMe: () => calls.push('redraw'),
      clearPracticeNow: () => calls.push('clear'),
      meNow: () => null,
    });
    vm.runInContext("meUndo={unit:'u1',eventId:'tell-9',label:'u1',state:'said',at:0};", context);
    context.mountMe();
    const click = () => handler({ target: { closest: selector => (selector === '[data-me-undo]' ? undo : null) } });
    click();
    click();
    assert.equal(undo.disabled, true, '기다리는 사이 단추를 막는다');
    pending.resolve(answer);
    await pending.promise;
    await new Promise(resolve => setTimeout(resolve, 0));
    return { calls, undo, left: vm.runInContext('meUndo', context) };
  };
  const saved = await run(true);
  assert.deepEqual(saved.calls, ['undo:tell-9', 'redraw'], '저장된 뒤에 한 번 그린다');
  assert.equal(saved.left, null, '되돌리기를 걷는다');
  const failed = await run(false);
  assert.deepEqual(failed.calls, ['undo:tell-9', 'toast:me.toldFailed'], '저장되지 않으면 알리고 다시 그리지 않는다');
  assert.equal(failed.undo.disabled, false, '되돌리기를 다시 누를 수 있다');
  assert.equal(failed.left?.eventId, 'tell-9', '되돌리기를 남긴다');
});

test('옛 동기화의 다시 세기(unsent)는 새 길의 올리는 문만 부른다 — 스위치가 꺼진 지금 판에서는 부르는 곳이 없다(4-5 끝 판 GPT GC1 · 설계 주인 11-19 새벽 조건)', async () => {
  const { execFileSync } = await import('node:child_process');
  const { readFileSync } = await import('node:fs');
  const root = new URL('../../../', import.meta.url);
  // 배포되는 코드 — 시험 · 문서 · 임시 자리를 빼고, 새 엔진(packages/atlas)도 뺀다(그 unsent는 새 기록부의 다른 읽기다).
  const shipped = execFileSync('git', ['ls-files', '-z', '--', '*.js', '*.mjs', '*.cjs'], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 })
    .split('\0')
    .filter(name => name && !/^(docs|tests|packages\/atlas|\.tmp)\//.test(name) && !/\/(qa|tests?)\//.test(name));
  const callers = [];
  const doorImporters = [];
  for (const name of shipped) {
    let text;
    try {
      text = readFileSync(new URL(name, root), 'utf8');
    } catch {
      continue;
    }
    if (text.includes('world-old-engine-doors') && /(from|import\()\s*['"][^'"]*world-old-engine-doors\.mjs['"]/.test(text)) doorImporters.push(name);
    if (!text.includes('unsent')) continue;
    // 옛 학습 호스트의 넘겨주기(호스트의 unsent가 옛 동기화의 unsent를 부른다 — 생성 사본 · 묶음에도 같은 글이 든다)는 따로 센다.
    // 묶음은 이름을 sync2처럼 바꿀 수 있다.
    const passthrough = /typeof sync\d*\?\.unsent === 'function'/.test(text);
    // 받는 쪽이 이름 · 부름 · 꺾쇠로 끝나고 선택적 연결(?.)이어도 센다 — host?.unsent?.() · host().unsent() · list[0].unsent().
    for (const call of text.match(/[\w$)\]]+\??\.unsent\??\.?\(/g) ?? [])
      if (!(passthrough && /^sync\d*\.unsent\($/.test(call))) callers.push(`${name} · ${call}`);
  }
  assert.deepEqual(callers, ['experiences/synk-world-app/world-old-engine-doors.mjs · owner.unsent?.('], '옛 동기화의 셈을 부르는 곳은 올리는 문뿐이다');
  assert.deepEqual(doorImporters, ['experiences/synk-world-app/world-atlas-next.mjs'], '올리는 문은 새 길 입구만 들인다');
  const shell = readFileSync(new URL('experiences/synk-world-app/app-shell.mjs', root), 'utf8');
  assert.ok(!/^\s*import[^(]*['"]\.\/world-atlas-next\.mjs['"]/m.test(shell), '셸은 새 길 입구를 정적으로 들이지 않는다');
  assert.match(shell, /import\('\.\/world-atlas-next\.mjs'\)/, '셸은 새 길 입구를 처음 쓸 때 받는다');
  assert.match(shell, /const atlasNext=atlasNextOn&&/, '새 길 입구는 스위치(atlasNext)가 켜졌을 때만 만든다');
});
