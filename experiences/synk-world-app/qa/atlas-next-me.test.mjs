// 「나」 칸(Atlas 재설계 단계 4-5 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §22-6 · §22-9 WORLD). 목록의 거름 · 나눔 · 순서(meUnits)와
// 학습 화면의 몫 — 새 길 홈 코치가 엔진 판일 때만 서고, 「이미 알아요」 · 「다시 배울래요」는 코치의 tell로 적고, 되돌리기는 그 사건을 빼며, 「연습
// 기록 비우기」는 입구의 clearPractice를 부른다. 옛 엔진의 두 문(셸 배선 — 올리기 대기열 · 옛 손님 기록 비우기)도 본다. 변형은
// qa/position-mutants.mjs의 「나 칸」 갈래에 있다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
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
        phase: () => phase,
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
  return { education, told, excluded, ready };
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
  assert.equal(env.education.undoMe('tell-2'), true);
  assert.deepEqual(env.excluded, ['tell-2'], '되돌리기는 tell이 돌려준 사건을 뺀다');
  assert.equal(env.education.undoMe(null), false);
  assert.equal(env.education.tellMe('u.x', 'maybe'), null, '본인 말이 아닌 값은 적지 않는다');
});

test('학습 화면 — 「연습 기록 비우기」는 입구의 clearPractice를 부르고 그 결과를 준다. 입구가 없으면 null이다', async () => {
  const calls = [];
  const env = setup({
    atlasNext: {
      clearPractice: async () => {
        calls.push('clear');
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
  assert.deepEqual(calls, ['clear']);
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
    /async clearPractice\(\)\{if\(disposed\)return null;const entry=await load\(\);return disposed\?null:entry\.clearPractice\(\);\}/,
  );
  assert.match(source, /\$\{responsesSection\(\)\}\$\{meSection\(true\)\}<div id="world-classroom-lessons">/);
  assert.match(source, /mountResponses\(\);refreshResponses\(\);mountMe\(\);/);
  assert.match(source, /if\(!window\.confirm\(meText\('me\.clearAsk'\)\)\)return;/, '비우기 전에 한 번 더 묻는다');
  assert.match(
    source,
    /result\?\.code==='UNSENT'\?'me\.clearUnsent'/,
    '못 올린 기록이 있어 멈춘 것을 따로 알린다',
  );
  assert.match(
    source,
    /\n if\(operating\)try\{await account\.restore\(\);\}catch\{[^}]*\}\r?\n if\(\$\('#panel-content \.ws-me'\)\)profile\(\);/,
    '결과와 상관없이 계정 설정 스냅샷을 새로 받아 시트를 다시 그린다(§22-4 · 4-5 Opus 대체 설계 검토 F8)',
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
