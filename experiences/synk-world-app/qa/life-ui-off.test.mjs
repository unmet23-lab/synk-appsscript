// 스위치가 꺼진 판(새 길 입구 없음 — 셸이 learning.next를 넘기지 않은 문서 · 생활 단독 묶음, 12/10까지의 라이브)의 생활 화면은 4-2 앞 그대로다:
// 옛 거울에 보임 · 답을 적고 시도마다 옛 코치를 준비하며, 다음 복습 때는 시각까지(dayLabel), 「곧 돌아올 표현」 목록이 있고, 혼자 맞힌 복습은
// 「잘 기억했어요」, 홈 「이 표현 같이 연습」은 때가 된 표현의 복습 판(6개까지)을 연다. Fable 5.2 합친 끝 판 F6 (가)
// (atlas-redesign-stage4-acct-life-final-20261113 — 검수자 탐침-화면 · 탐침-묶음과 변형 아홉을 시험으로 옮김). 화면은 가짜 문서 위에 세우고
// (틀은 life-ui-path.test.mjs의 lifeOn), 단추는 그린 글의 data-life-* 그대로 누른다. 시계는 node:test의 Date 흉내로 돌린다.
import assert from 'node:assert/strict';
import test from 'node:test';

const listeners = new Map();
const node = () => ({
  style: { setProperty() {} },
  dataset: {},
  scrollTop: 0,
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  append() {},
  prepend() {},
  remove() {},
  setAttribute() {},
  getAttribute: () => null,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  focus() {},
});
const panel = { ...node(), open: true };
const content = node();
// 누르기는 문서에 걸린 click 듣개로 간다(생활 화면이 document.addEventListener('click')로 단추를 받는다). 닫힌 화면은 듣개를 뗀다.
globalThis.document = {
  hidden: false,
  head: node(),
  body: node(),
  documentElement: { ...node(), lang: 'ko' },
  querySelector: sel => (sel === '#world-panel' ? panel : sel === '#panel-content' ? content : null),
  querySelectorAll: () => [],
  createElement: () => node(),
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  },
  removeEventListener(type, fn) {
    listeners.get(type)?.delete(fn);
  },
};
globalThis.Image = class {
  set src(value) {
    this.source = value;
  }
  decode() {
    return Promise.resolve();
  }
};
globalThis.getComputedStyle = () => ({ position: 'relative' });
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });

const { createLifeExperience } = await import('../life-ui.mjs');
const { createLifeProgress } = await import('../life-progress.mjs');
const { LESSONS, lessonById } = await import('../life-content.mjs');
const { t, formatDate } = await import('../../brand-opening/world-lang.mjs');

const MINUTE = 60000;
const DAY = 86400000;
// 낮 12시(한국 시각) — 1분 · 하루 뒤가 날 경계를 넘지 않는다.
const START = Date.UTC(2026, 10, 13, 3, 0, 0);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}
// 부른 일을 적는 기록부(옛 거울 · 새 판 겉 같은 겉). 답은 넘긴 값까지 남긴다.
function recorder(name, log) {
  const shown = [];
  const answers = [];
  return {
    shown: (...args) => {
      shown.push(args[0]);
      log.push(`${name}:shown`);
      return null;
    },
    help: () => log.push(`${name}:help`),
    delivery: () => log.push(`${name}:delivery`),
    answer: (slot, value) => {
      answers.push({ slot, ...value });
      log.push(`${name}:answer`);
      return null;
    },
    guided: () => log.push(`${name}:guided`),
    release() {},
    metrics: () => ({ slots: shown.length, presented: 0, answered: answers.length }),
    dispose() {},
    seen: shown,
    answers,
  };
}
// life-ui-path.test.mjs의 lifeOn 틀 — 이 파일은 entry: false(셸이 새 길 입구를 넘기지 않은 문서)로만 쓴다. 판 겉을 만든 수(counts.next)를 센다.
function lifeOn({ progress, state = { now: 'old' }, entry = true }) {
  const log = [];
  const oldTrail = recorder('old', log);
  const newTrail = recorder('next', log);
  const counts = { prepare: 0, ask: 0, trail: 0, next: 0 };
  const shows = [];
  let practice = null;
  const home = {
    showPanel: (title, html) => shows.push({ title, html }),
    closePanel() {},
    updateLearning: (value, options) => {
      practice = options?.preparePractice ?? practice;
    },
    mountLifeTutor: () => null,
    attachPanelResource() {},
    toast() {},
    state: { reduced: true },
  };
  const ui = createLifeExperience({
    home,
    getProgress: () => progress,
    asset: path => path,
    learning: {
      coach: () => null,
      prepare: () => {
        counts.prepare += 1;
      },
      life: {
        createLifeTrail: () => {
          counts.trail += 1;
          return oldTrail;
        },
        createLifeNext: () => {
          counts.next += 1;
          return newTrail;
        },
        lifeItem: ({ question }) => ({ itemKey: question.id }),
        lessonSlot: (attempt, id) => `${attempt}:${id}`,
        reviewSlot: (run, id) => `${run}:${id}`,
      },
      ...(entry
        ? {
            next: {
              coach: () => {
                counts.ask += 1;
                return Promise.resolve(null);
              },
              retired: () => () => {},
              note() {},
              nextAt: () => null,
              state: () => state.now,
            },
          }
        : {}),
    },
  });
  return { ui, log, oldTrail, newTrail, counts, shows, practice: () => practice };
}

const buttonsOf = html =>
  [...html.matchAll(/<button\b([^>]*)>/g)].map(match => {
    const attributes = {};
    for (const a of match[1].matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) attributes[a[1]] = a[2] ?? '';
    return attributes;
  });
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function press(attributes) {
  const dataset = {};
  for (const [name, value] of Object.entries(attributes)) if (name.startsWith('data-')) dataset[camel(name.slice(5))] = value;
  const button = { hasAttribute: name => name in attributes, getAttribute: name => attributes[name] ?? null, dataset, focus() {} };
  for (const fn of [...(listeners.get('click') ?? [])]) fn({ target: { closest: sel => (sel === 'button' ? button : null) }, preventDefault() {}, stopPropagation() {} });
}
const last = w => w.shows.at(-1)?.html ?? '';
const live = (w, key) => buttonsOf(last(w)).find(b => `data-life-${key}` in b && !('disabled' in b)) ?? null;
const choices = w => buttonsOf(last(w)).filter(b => 'data-life-choice' in b && !('disabled' in b));
const tally = (w, entry) => w.log.filter(value => value === entry).length;
const korean = (lesson, q) => lesson.expressions.find(e => e.id === q.expressionId)?.korean ?? q.choices.find(c => c.id === q.answerId).text;
// 목록 한 칸(<li><strong>표현</strong><small>말</small></li>) — 말 앞의 LED는 뺀다.
const rows = html =>
  [...html.matchAll(/<li><strong lang="ko">([^<]*)<\/strong>(?:<small>(?:<i [^>]*><\/i>)?([^<]*)<\/small>)?<\/li>/g)].map(m => ({ korean: m[1], note: m[2] ?? '' }));
const section = (html, marker) => new RegExp(`<section [^>]*${marker}[^>]*>([\\s\\S]*?)</section>`).exec(html)?.[1] ?? null;

// 레슨 한 판을 결과 화면까지 — wrong에 든 문항 차례는 틀리게, 나머지는 맞게 고른다.
function playLesson(w, lesson, { wrong = [] } = {}) {
  w.ui.start(lesson.id);
  for (let guard = 0; guard < 80; guard += 1) {
    const begin = live(w, 'begin') ?? live(w, 'scene-next');
    if (begin) {
      press(begin);
      continue;
    }
    if (choices(w).length) {
      const q = lesson.questions[w.ui.metrics().step];
      press({ 'data-life-choice': wrong.includes(lesson.questions.indexOf(q)) ? q.choices.find(c => c.id !== q.answerId).id : q.answerId });
      continue;
    }
    const next = live(w, 'question-next');
    if (!next) break;
    press(next);
  }
  assert.equal(w.ui.metrics().phase, 'complete', `${lesson.id}: 결과 화면까지 간다`);
}
// 열린 복습 회차를 끝까지 — 모두 맞힌다(새 상황 문항의 정답).
function playReview(w) {
  for (let guard = 0; guard < 40; guard += 1) {
    if (choices(w).length) {
      const snapshot = w.ui.metrics().progress;
      const run = snapshot.activeReview;
      const record = snapshot.reviews[run.ids.find(id => !run.answers[id])];
      press({ 'data-life-choice': lessonById(record.lessonId).questions.find(q => q.id === record.questionId).review.answerId });
      continue;
    }
    const next = live(w, 'question-next');
    if (!next) break;
    press(next);
  }
  assert.equal(w.shows.at(-1).title, t('life.reviewResultTitle'), '복습 결과 화면까지 간다');
}

test('꺼진 판(새 길 입구 없음)을 처음부터 끝까지 — 옛 거울 · 옛 코치 준비 · 다음 복습 때(시각까지) · 「곧 돌아올 표현」 · 「잘 기억했어요」 · 홈 연습 판 6개(Fable 5.2 합친 끝 판 F6 (가))', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => Date.now() });
  const w = lifeOn({ progress, entry: false });
  // 시도 하나를 열 때마다 옛 코치 준비는 꼭 한 번이다(입구가 없는 지금 판은 늘 옛 거울 · 옛 코치 준비 — 4-2 앞과 같다).
  const attempt = (label, fn) => {
    const before = w.counts.prepare;
    fn();
    assert.equal(w.counts.prepare - before, 1, `${label}: 시도마다 옛 코치를 한 번 준비한다`);
  };
  try {
    // ① 첫 레슨 — 첫 문항은 틀린다. 문항마다 옛 거울에 보임 · 답을 적고(새 판 겉은 만들지도 않는다), 답은 저장된 판정 그대로다.
    const [first, story, apply] = ['greetings-expressions', 'greetings-story', 'greetings-apply'].map(lessonById);
    attempt('첫 레슨', () => playLesson(w, first, { wrong: [0] }));
    assert.equal(tally(w, 'old:shown'), first.questions.length, '레슨 문항마다 옛 거울에 보임');
    assert.equal(tally(w, 'old:answer'), first.questions.length, '레슨 답마다 옛 거울에 답');
    assert.deepEqual(w.oldTrail.answers.map(a => a.correct), [false, true, true], '옛 거울의 답은 저장된 판정 그대로');
    assert.ok(!w.log.some(entry => entry.startsWith('next:')), '새 판 겉에는 아무것도 적지 않는다');
    assert.equal(w.counts.next, 0, '입구가 없으면 판 겉(createLifeNext)을 만들지 않는다');
    assert.equal(w.counts.trail, 1, '옛 거울은 하나');
    assert.equal(w.counts.ask, 0);

    // ② 복습 첫 화면 — 돌아온 것이 없으면 다음 복습 때를 시각까지(「1분 뒤」 · 「내일 {시각}」 — 새 길의 「오늘 중 · 내일쯤」이 아니다)와 「곧 돌아올 표현」 목록.
    w.ui.review();
    const screen = last(w);
    const minute = t('life.when.minutes', { n: 1 });
    const tomorrow = t('life.when.tomorrow', { time: formatDate(START + DAY, { hour: 'numeric', minute: '2-digit' }) });
    assert.ok(screen.includes(t('life.reviewSubOpens', { date: minute })), '다음 복습 때는 지금 판 꼴(dayLabel)로');
    const upcoming = section(screen, 'data-upcoming');
    assert.ok(upcoming !== null, '「곧 돌아올 표현」 목록이 있다');
    assert.deepEqual(
      rows(upcoming).map(row => [row.korean, row.note]),
      [
        [korean(first, first.questions[0]), minute],
        [korean(first, first.questions[2]), tomorrow],
        [korean(first, first.questions[1]), tomorrow],
      ],
      '돌아올 때가 이른 것부터 · 같은 때면 복습 id 차례 · 때는 시각까지',
    );
    for (const key of ['life.reviewChecking', 'life.when.todayDay', 'life.when.tomorrowDay'])
      assert.ok(!screen.includes(t(key)), `지금 판 복습 화면에 ${key} 글이 없다`);
    for (const at of [START + MINUTE, START + DAY])
      assert.ok(!screen.includes(t('life.when.aroundDay', { date: formatDate(at, { month: 'short', day: 'numeric' }) })), '「○월 ○일쯤」 꼴이 없다');
    // 열린 복습 화면은 진도가 바뀌어도 다시 그리지 않는다(15초 타이머 · 셸의 새로 하기 — 지금 판 그대로).
    const painted = w.shows.length;
    t0.mock.timers.tick(MINUTE + 1000);
    w.ui.refresh();
    assert.equal(w.shows.length, painted, '지금 판은 열린 복습 화면을 다시 그리지 않는다');

    // ③ 1분 뒤 돌아온 복습을 혼자 맞힌다 — 결과는 「잘 기억했어요」(새 길의 「하루 안에 한 번 더」가 아니다). 복습 문항도 옛 거울에.
    const shownBefore = tally(w, 'old:shown');
    const answeredBefore = tally(w, 'old:answer');
    attempt('돌아온 복습', () => w.ui.reviewStart());
    assert.equal(w.ui.metrics().phase, 'review');
    playReview(w);
    assert.equal(tally(w, 'old:shown') - shownBefore, 1, '복습 문항도 옛 거울에 보임');
    assert.equal(tally(w, 'old:answer') - answeredBefore, 1, '복습 답도 옛 거울에');
    assert.deepEqual(rows(last(w)), [{ korean: korean(first, first.questions[0]), note: t('life.reviewRemembered') }], '혼자 맞힌 복습은 「잘 기억했어요」');
    assert.ok(!last(w).includes(t('life.reviewAgainSoon')) && !last(w).includes(t('life.reviewSoon')));

    // ④ 두 레슨 더(어려운 표현 둘 — 이야기 · 적용 레슨의 첫 문항을 놓친다). 적용 레슨의 것이 늦게 돌아온다.
    attempt('이야기 레슨', () => playLesson(w, story, { wrong: [0] }));
    t0.mock.timers.tick(1000);
    attempt('적용 레슨', () => playLesson(w, apply, { wrong: [0] }));
    const hardId = apply.questions[0].review.id;
    // ⑤ 때가 안 된 어려운 표현의 홈 연습은 안내만 열고 복습 판을 만들지 않는다.
    const before = progress.exportSnapshot().activeReview;
    attempt('때가 안 된 표현의 홈 연습', () => assert.equal(w.practice()(apply.questions[0].id), true, '안내 연습은 연다'));
    assert.deepEqual(progress.exportSnapshot().activeReview, before, '때가 안 된 표현은 복습 판을 만들지 않는다');
    assert.ok(w.log.includes('old:guided') && !w.log.includes('next:guided'), '안내 연습은 옛 거울에');

    // ⑥ 이틀 뒤 — 아홉 복습이 모두 돌아왔다. 적용 레슨의 어려운 표현을 홈에서 연습하면 그 표현을 첫 자리로 한 6개까지의 판이 열린다.
    t0.mock.timers.tick(2 * DAY);
    assert.equal(progress.dueReviews().length, 9);
    assert.notEqual(progress.dueReviews()[0].id, hardId, '간격표 차례로는 첫 자리가 아니다');
    attempt('때가 된 표현의 홈 연습', () => assert.equal(w.practice()(apply.questions[0].id), true));
    const run = progress.exportSnapshot().activeReview;
    assert.equal(run?.ids.length, 6, '6개까지의 판');
    assert.equal(run.ids[0], hardId, '그 표현이 첫 자리');
    assert.equal(new Set(run.ids).size, 6);
    assert.ok(run.ids.every(id => progress.exportSnapshot().reviews[id].dueAt <= Date.now()), '판은 때가 된 복습만');
    assert.equal(run.pendingHelp?.[hardId], true, '미리 본 그 표현은 도움으로');

    // ⑦ 그 판을 끝까지 — 미리 본 표현은 「조금 뒤 다시 나와요」, 혼자 맞힌 다른 표현은 「잘 기억했어요」.
    attempt('홈에서 연 복습 판', () => w.ui.reviewStart());
    assert.equal(w.ui.metrics().progress.activeReview.id, run.id, '열린 판을 그대로 잇는다');
    playReview(w);
    const notes = Object.fromEntries(rows(last(w)).map(row => [row.korean, row.note]));
    assert.equal(notes[korean(apply, apply.questions[0])], t('life.reviewSoon'), '미리 본 표현은 조금 뒤 다시');
    const alone = Object.entries(notes).filter(([, note]) => note !== t('life.reviewSoon'));
    assert.ok(alone.length >= 1);
    for (const [expression, note] of alone) assert.equal(note, t('life.reviewRemembered'), `${expression}: 혼자 맞히면 「잘 기억했어요」`);
    assert.ok(!last(w).includes(t('life.reviewAgainSoon')), '지금 판 결과에 「하루 안에 한 번 더」가 없다');
    assert.equal(tally(w, 'old:answer'), 3 * 3 + 1 + 6, '레슨 아홉 · 복습 일곱의 답이 모두 옛 거울에');
    assert.equal(w.counts.next, 0);
    assert.ok(!w.log.some(entry => entry.startsWith('next:')));
  } finally {
    w.ui.dispose();
  }
});

test('생활 단독 묶음 — setupLife 한 번: IndexedDB · /atlas/ 없이 옛 코치(world-life)가 옛 기기 기록 열쇠에 적는다(Fable 5.2 합친 끝 판 F6 (가))', async () => {
  const values = new Map();
  const localStorage = {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
  const touched = { idb: 0, atlas: 0 };
  const saved = Object.fromEntries(['localStorage', 'indexedDB', 'window', 'addEventListener', 'removeEventListener', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: localStorage });
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    get() {
      touched.idb += 1;
      return undefined;
    },
  });
  // 그 밖의 받기(카페 소리 목록 · 진단 문항)는 없는 것으로 — 단독 묶음은 받지 못해도 레슨이 간다.
  globalThis.fetch = async url => {
    if (String(url).includes('/atlas/')) touched.atlas += 1;
    return new Response('', { status: 404 });
  };
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  let ui = null;
  let education = null;
  try {
    const bundle = await import('../../brand-opening/content/life-standalone.mjs');
    const shows = [];
    const home = {
      showPanel: (title, html) => shows.push({ title, html }),
      openPanel() {},
      closePanel() {},
      updateLearning() {},
      updateStudy() {},
      mountLifeTutor: () => null,
      tutor: () => ({}),
      attachPanelResource() {},
      toast() {},
      goTown() {},
      connectEducation: value => {
        education = value;
      },
      openLearningGame() {},
      state: { reduced: true },
    };
    ui = bundle.setupLife(home, path => `asset/${path}`);
    const w = { ui, shows };
    const lesson = lessonById('greetings-expressions');
    playLesson(w, lesson, { wrong: [0] });
    ui.review();
    assert.ok(section(last(w), 'data-upcoming') !== null, '단독 묶음의 복습 첫 화면에도 「곧 돌아올 표현」');
    assert.ok(last(w).includes(t('life.reviewSubOpens', { date: t('life.when.minutes', { n: 1 }) })), '다음 복습 때는 시각까지');
    assert.ok(!last(w).includes(t('life.reviewChecking')));
    for (let i = 0; i < 10; i += 1) await new Promise(resolve => setTimeout(resolve, 0));
    const events = JSON.parse(values.get('synk.atlas.learning.v1.device') ?? '{"events":[]}').events;
    assert.deepEqual(
      events.filter(event => event.type === 'practice.presented').map(event => event.itemKey),
      lesson.questions.map(q => `life.${q.id}`),
      '옛 코치가 레슨 문항마다 보임을 옛 기기 기록 열쇠에 적었다',
    );
    assert.equal(events.filter(event => event.type === 'practice.attempted').length, lesson.questions.length, '답도 적었다');
    assert.ok(events.some(event => event.type === 'decision.made' && event.experienceId === 'world-life'), '경험은 world-life(옛 거울)');
    assert.ok(events.every(event => event.schema !== 2), '2판 사건이 없다');
    assert.ok(values.has('synk.life-korean.progress.v1:guest'), '진도는 지금 판 저장소에');
    assert.deepEqual(touched, { idb: 0, atlas: 0 }, 'IndexedDB · /atlas/를 건드리지 않는다');
  } finally {
    education?.dispose?.();
    ui?.dispose();
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
