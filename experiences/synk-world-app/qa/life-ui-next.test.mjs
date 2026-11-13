// 새 길(셸이 learning.next를 넘긴 문서 — 4-2)의 생활 화면을 진짜 판정(world-life-next.mjs lifeDue)과 함께 돌려, Fable 5.2 합친 끝 판
// (atlas-redesign-stage4-acct-life-final-20261113)에서 고친 동작을 못박는다 — lifeDue ①(놓친 복습은 혼자 맞힐 때까지 · 그 답 1분 뒤) ·
// F3(앞선 날의 도움 판은 새 판으로 — 요약 dueRenew · 홈 튜터 tryAlone) · F5(돌아온 표현 수는 표현 글로 묶은 수) · F7(새 판 겉 prepare() ·
// 판이 바뀌면 첫 문항 전 화면도 닫힘) · 넘친 #6(튜터 창이 열려 있으면 다시 그리기를 미룸 · 허브 · 팩은 엔진으로 서는 때 한 번 · 초점은 같은
// 생활 단추로) · #7(확인 중 복습 첫 화면은 튜터 단계 없음) · #5 · #9(새 길 화면 글 — 날까지만 · 「하루 안에 한 번 더」 · 확인 중 · 설정 도움의
// helpBy). 틀은 life-ui-off.test.mjs(가짜 문서 · 클릭 듣개 · press · playLesson · playReview · node:test의 Date 흉내)이고, 홈은 실제
// 홈(brand-opening/home.mjs)처럼 판을 열 때 · 닫을 때 앞 화면 자원을 버린다 — 「우리 동네로」로 나가면 생활 화면이 닫힌 것이다.
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
// 초점을 받은 단추(넘친 #6 — 다시 그린 뒤 같은 생활 단추로). 찾기는 마지막으로 그린 판의 글(painted)에 있는 것만 — 생활 단추(data-life-*,
// 값까지) · 머리 · 문제 제목 — 돌려준다(그린 글에 없는 단추를 늘 돌려주면 단추가 사라진 회귀를 못 잡는다, 카본 Fable 처리 다시 검수 B1).
// 초점은 [이름] · [이름="값"] 꼴로 적고, 판 안의 요소인지는 inPanel 표지로 가린다(content.contains).
const focused = [];
let painted = '';
const attrsOf = name =>
  [...painted.matchAll(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`, 'g'))].map(match => match[1] ?? '');
const content = {
  ...node(),
  contains: element => element?.inPanel === true,
  querySelector: selector =>
    /^\.(?:life-heading|life-question-title)$/.test(selector) && painted.includes(selector.slice(1))
      ? { ...node(), focus: () => focused.push(selector) }
      : null,
  querySelectorAll: selector => {
    const name = /^\[(data-life-[a-z-]+)\]$/.exec(selector)?.[1];
    if (!name) return [];
    return attrsOf(name).map(value => ({
      ...node(),
      getAttribute: key => (key === name ? value : null),
      focus: () => focused.push(value ? `[${name}="${value}"]` : `[${name}]`),
    }));
  },
};
// 누르기는 문서에 걸린 click 듣개로 간다(생활 화면이 document.addEventListener('click')로 단추를 받는다). 닫힌 화면은 듣개를 뗀다.
globalThis.document = {
  hidden: false,
  head: node(),
  body: node(),
  activeElement: null,
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
const { lifeDue } = await import('../world-life-next.mjs');
const { LESSONS, lessonById } = await import('../life-content.mjs');
const { t, formatDate } = await import('../../brand-opening/world-lang.mjs');
const { homeTutorRecommendation } = await import('../../brand-opening/home-tutor-lines.mjs');
const { lifeTutorKind } = await import('../../brand-opening/life-tutor-lines.mjs');

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
// 낮 12시(한국 시각) — 몇 분 · 며칠 뒤가 날 경계를 넘지 않는다(UTC인 CI에서는 03시).
const START = Date.UTC(2026, 10, 13, 3, 0, 0);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}
const freshProgress = () => createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => Date.now() });
// 진짜 판정을 넣는다 — lifeDue에 진도 · 원고 차례와 시험이 정한 생활 단위(unitsOf) · 기억 줄(memory — 코치 summary().units) · 돌아온
// 단위(due — 코치 due()). 돌려준 judge의 memory · due를 바꾸면 다음 판정부터 그 값이다(코치의 보기가 바뀐 것).
function engine(progress, { unitsOf = () => [], memory = [], due = [] } = {}) {
  const judge = { memory, due };
  judge.on = () =>
    progress.setDueSource((state, now) => ({
      state: 'engine',
      ...lifeDue({ snapshot: state, lessons: LESSONS, unitsOf, memory: judge.memory, due: judge.due, now }),
    }));
  judge.on();
  return judge;
}
const checking = progress => progress.setDueSource(() => ({ state: 'checking' }));

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
// life-ui-off.test.mjs의 lifeOn 틀 — 이 파일은 늘 입구(learning.next)를 넘긴다. 판(state.now)은 시험이 바꾼다: 'engine' · 'checking' · 'old'.
// 새 판 겉은 prepare()가 있는 겉(world-life-next.mjs createLifeNext)이고, 화면이 넘긴 겉 옵션(onRetired 등)은 nextOptions()로 꺼낸다.
// 홈: 판을 열면(showPanel) · 닫으면(closePanel) 앞 화면 자원을 버린다(home.mjs openPanel · closePanel · attachPanelResource). 튜터 겉의
// metrics()는 tutorWindow.metrics(「표현 도움」 · 「연습하기」 창)이고, mountLifeTutor에 넘긴 것은 tutors에 쌓인다.
function lifeOn({ progress, state = { now: 'engine' }, nextAt = () => null, presentation = null }) {
  const log = [];
  const oldTrail = recorder('old', log);
  const newTrail = { ...recorder('next', log), prepare: () => log.push('next:prepare') };
  const counts = { prepare: 0, ask: 0, closes: 0 };
  const shows = [];
  const toasts = [];
  const tutors = [];
  const tutorWindow = { metrics: {} };
  let practice = null;
  let complete = null;
  let nextOptions = null;
  let resource = null;
  const drop = () => {
    const previous = resource;
    resource = null;
    previous?.dispose?.();
  };
  const home = {
    showPanel: (title, html) => {
      drop();
      shows.push({ title, html });
      painted = html;
    },
    closePanel() {
      counts.closes += 1;
      drop();
    },
    updateLearning: (value, options) => {
      practice = options?.preparePractice ?? practice;
      complete = options?.completePractice ?? complete;
    },
    mountLifeTutor: options => {
      tutors.push(options);
      return { metrics: () => tutorWindow.metrics, update() {}, react() {}, dispose() {} };
    },
    attachPanelResource(value) {
      if (value === resource) return;
      const previous = resource;
      resource = value;
      previous?.dispose?.();
    },
    toast: message => toasts.push(message),
    state: { reduced: true },
  };
  const ui = createLifeExperience({
    home,
    getProgress: () => progress,
    asset: path => path,
    presentation,
    learning: {
      coach: () => null,
      prepare: () => {
        counts.prepare += 1;
      },
      life: {
        createLifeTrail: () => oldTrail,
        createLifeNext: options => {
          nextOptions = options;
          return newTrail;
        },
        lifeItem: ({ question }) => ({ itemKey: question.id }),
        lessonSlot: (attempt, id) => `${attempt}:${id}`,
        reviewSlot: (run, id) => `${run}:${id}`,
      },
      next: {
        coach: () => {
          counts.ask += 1;
          return Promise.resolve(null);
        },
        retired: () => () => {},
        note() {},
        nextAt: id => nextAt(id),
        state: () => state.now,
      },
    },
  });
  return {
    ui,
    log,
    oldTrail,
    newTrail,
    counts,
    shows,
    toasts,
    tutors,
    tutorWindow,
    practice: () => practice,
    complete: () => complete,
    nextOptions: () => nextOptions,
  };
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
const notes = html => Object.fromEntries(rows(html).map(row => [row.korean, row.note]));
const section = (html, marker) => new RegExp(`<section [^>]*${marker}[^>]*>([\\s\\S]*?)</section>`).exec(html)?.[1] ?? null;
const posterWord = html => /<h3 class="life-poster-word">([^<]*)<\/h3>/.exec(html)?.[1] ?? null;
const posterLabel = html => /<small class="life-poster-label">([^<]*)<\/small>/.exec(html)?.[1] ?? null;
// 화면이 다시 그릴지 가르는 판정 표지(life-ui reviewSign과 같은 칸) — 시험이 판정 바뀜을 실제로 만들었는지 본다.
const sign = s => [s.dueState ?? '', s.dueCount, (s.dueIds || []).join(','), s.nextReviewAt ?? ''].join('|');
const tutorPick = (w, progress) =>
  homeTutorRecommendation({ owner: 'guest', summary: w.ui.summary(), snapshot: progress.exportSnapshot(), lessons: LESSONS, now: Date.now() });
// 결과 화면의 「우리 동네로」 — 판을 닫는다(생활 화면은 닫힌 것: 맥락 · 열린 화면이 비워진다).
function goHome(w) {
  const button = live(w, 'home');
  assert.ok(button, '「우리 동네로」 단추가 있다');
  press(button);
  assert.equal(w.ui.metrics().shown, false, '판을 닫았다');
}

// 레슨 한 판을 결과 화면까지 — wrong에 든 문항 차례는 틀리게, help에 든 차례는 해설(사람이 연 도움)을 연 뒤 맞게, 나머지는 맞게 고른다.
function playLesson(w, lesson, { wrong = [], help = [] } = {}) {
  w.ui.start(lesson.id);
  const opened = new Set();
  for (let guard = 0; guard < 80; guard += 1) {
    const begin = live(w, 'begin') ?? live(w, 'scene-next');
    if (begin) {
      press(begin);
      continue;
    }
    if (choices(w).length) {
      const index = w.ui.metrics().step;
      const q = lesson.questions[index];
      if (help.includes(index) && !opened.has(index)) {
        opened.add(index);
        press({ 'data-life-help': '' });
        continue;
      }
      press({ 'data-life-choice': wrong.includes(index) ? q.choices.find(c => c.id !== q.answerId).id : q.answerId });
      continue;
    }
    const next = live(w, 'question-next');
    if (!next) break;
    press(next);
  }
  assert.equal(w.ui.metrics().phase, 'complete', `${lesson.id}: 결과 화면까지 간다`);
}
// 열린 복습 회차를 끝까지 — how(그 복습 기록)가 'right'(혼자 맞힘) · 'wrong'(틀림) · 'help'(해설을 열고 맞힘)를 고른다.
function playReview(w, how = () => 'right') {
  const opened = new Set();
  for (let guard = 0; guard < 40; guard += 1) {
    if (choices(w).length) {
      const snapshot = w.ui.metrics().progress;
      const run = snapshot.activeReview;
      const id = run.ids.find(x => !run.answers[x]);
      const record = snapshot.reviews[id];
      const q = lessonById(record.lessonId).questions.find(x => x.id === record.questionId).review;
      const way = how(record);
      if (way === 'help' && !opened.has(id)) {
        opened.add(id);
        press({ 'data-life-help': '' });
        continue;
      }
      press({ 'data-life-choice': way === 'wrong' ? q.choices.find(c => c.id !== q.answerId).id : q.answerId });
      continue;
    }
    const next = live(w, 'question-next');
    if (!next) break;
    press(next);
  }
  assert.equal(w.shows.at(-1).title, t('life.reviewResultTitle'), '복습 결과 화면까지 간다');
}

test('lifeDue ① — 놓친 복습(lapses > 0 · streak 0)은 혼자 맞힐 때까지 남고, 돌아오는 때는 그 기록의 lastAt + 1분(아직이면 곧 돌아올 것)이다 — 다시 하기로 본문항 답이 비워져도 같다(Fable 5.2 합친 끝 판 F1 · F2)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress); // 생활 단위가 없는 복습 — ①로만 돌아온다
  const w = lifeOn({ progress });
  const lesson = lessonById('greetings-expressions');
  const id = lesson.questions[0].review.id;
  const record = () => progress.exportSnapshot().reviews[id];
  // 그 복습이 지금 돌아왔나 · 곧 돌아올 때 · 「다음 복습」 때
  const where = () => {
    const s = w.ui.summary();
    return { due: s.dueIds.includes(id), at: s.dueUpcoming.find(row => row.id === id)?.at ?? null, next: s.nextReviewAt };
  };
  try {
    playLesson(w, lesson, { wrong: [0] });
    goHome(w);
    assert.equal(w.ui.summary().dueState, 'engine');
    assert.deepEqual(where(), { due: false, at: START + MINUTE, next: START + MINUTE }, '놓친 본문항 답 — 그 답 1분 뒤에 돌아올 것');
    w.ui.review();
    assert.deepEqual(rows(section(last(w), 'data-upcoming') ?? ''), [{ korean: korean(lesson, lesson.questions[0]), note: t('life.when.todayDay') }], '「곧 돌아올 표현」 — 날까지만');
    t0.mock.timers.tick(MINUTE);
    assert.deepEqual(where(), { due: true, at: null, next: null }, '1분 뒤 돌아왔다');
    assert.deepEqual(w.ui.summary().dueTimes, [START + MINUTE], '돌아온 때는 답 시각 + 1분(고정 — 지금 시각이 아니다)');

    // 복습을 틀린다 — 아직 놓친 것(lapses 2): 그 답 1분 뒤 다시
    w.ui.reviewStart();
    playReview(w, () => 'wrong');
    assert.deepEqual([record().lapses, record().streak], [2, 0]);
    assert.deepEqual(where(), { due: false, at: START + 2 * MINUTE, next: START + 2 * MINUTE });
    goHome(w);
    t0.mock.timers.tick(MINUTE);
    // 해설을 열고 맞힌다 — 도움 받은 답도 놓친 것(lapses 3)
    assert.equal(where().due, true);
    w.ui.reviewStart();
    playReview(w, () => 'help');
    assert.deepEqual([record().lapses, record().streak], [3, 0]);
    assert.deepEqual(where(), { due: false, at: START + 3 * MINUTE, next: START + 3 * MINUTE });
    goHome(w);
    t0.mock.timers.tick(MINUTE);

    // 마친 레슨을 다시 하기로 연다 — 본문항 답이 비워져도 놓친 복습은 그대로 돌아와 있다
    w.ui.start(lesson.id);
    assert.deepEqual(progress.lessonState(lesson.id).answers, {}, '다시 하기 — 본문항 답이 비었다');
    assert.equal(where().due, true, '다시 하기로 비워져도 놓친 복습은 남는다');
    // 다시 하기에서 맞힌 본문항 답은 간격을 당기지 않고(dueAt 그대로) 놓침도 풀지 않는다 — 돌아오는 때는 그 답(lastAt) + 1분
    playLesson(w, lesson);
    goHome(w);
    assert.ok(record().dueAt <= Date.now(), '진도의 간격(dueAt)으로는 이미 때가 지났다');
    assert.deepEqual([record().lapses, record().streak, record().lastAt], [3, 0, Date.now()]);
    assert.deepEqual(where(), { due: false, at: Date.now() + MINUTE, next: Date.now() + MINUTE }, '①은 lastAt + 1분 — 간격(dueAt)을 읽지 않는다');
    t0.mock.timers.tick(MINUTE);

    // 혼자 맞히면 ①에서 빠진다(생활 단위가 없어 더는 돌아오지 않는다)
    assert.equal(where().due, true);
    w.ui.reviewStart();
    playReview(w);
    assert.deepEqual([record().lapses, record().streak], [3, 1]);
    assert.deepEqual(where(), { due: false, at: null, next: null }, '혼자 맞힌 뒤에는 돌아오지 않는다');
  } finally {
    w.ui.dispose();
  }
});

// F3 한 바퀴 — 레슨에서 한 문항을 놓치고 → 2분 뒤 홈 튜터 「다시 살필 표현」(difficult) → 홈 「이 표현 같이 연습」이 그 표현 하나의 판(도움
// 표시)을 열고 → 안내 연습 성공을 적고 그 판은 답하지 않는다 → 다음 날 문서를 다시 열면 요약 dueRenew · 홈 튜터 「오늘은 네가 먼저」(recall ·
// tryAlone)이고 복습은 새 판(도움 표시 없음)으로 열려 혼자 맞힌 답이 그대로 적힌다(streak 1) → 홈 튜터가 더는 「다시 살필 표현」이 아니다.
function helpedDayThenAlone(t0, { unit }) {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  const greetings = ['greetings-expressions', 'greetings-story', 'greetings-apply'].map(lessonById);
  const hello = greetings.map(lesson => lesson.questions.find(q => q.expressionId === 'greet-hello'));
  const helloIds = hello.map(q => q.review.id);
  const missed = hello[0];
  // (가) 인사 팩 「안녕하세요.」의 복습 셋(표현 · 이야기 · 적용 레슨)을 한 생활 단위로 — 기억 줄에 그 단위를 두고, 다음 날 돌아온 단위에도 넣어
  // ③이 그 단위의 다른 장면을 고를 수 있게 한다. (나) 생활 단위 없는 복습.
  const judge = unit
    ? engine(progress, {
        unitsOf: review => (helloIds.includes(review.id) ? ['unit-hello'] : []),
        memory: [{ unit: 'unit-hello', lastAt: START - DAY, dueAt: START + 3 * DAY }],
      })
    : engine(progress, { unitsOf: () => [] });
  let helpedRun = null;
  let w = lifeOn({ progress });
  try {
    playLesson(w, greetings[0], { wrong: [0] });
    goHome(w);
    if (unit)
      for (const lesson of greetings.slice(1)) {
        playLesson(w, lesson);
        goHome(w);
      }
    t0.mock.timers.tick(2 * MINUTE);
    const difficult = tutorPick(w, progress);
    assert.deepEqual([difficult.kind, difficult.id], ['difficult', missed.id], '2분 뒤 홈 튜터 — 다시 살필 표현');
    const prepared = tally(w, 'next:prepare');
    assert.equal(w.practice()(missed.id), true, '홈 「이 표현 같이 연습」');
    assert.equal(tally(w, 'next:prepare') - prepared, 1, 'F7 — 홈 안내 연습도 새 판 겉으로 열면 그 자리에서 prepare()');
    assert.ok(w.log.includes('next:guided'), '안내 연습은 새 판 겉에');
    helpedRun = progress.exportSnapshot().activeReview;
    assert.deepEqual(helpedRun.ids, [missed.review.id], '그 표현 하나의 판');
    assert.deepEqual(helpedRun.pendingHelp, { [missed.review.id]: true }, '미리 본 도움 표시');
    assert.equal(w.complete()(missed.id, 'marin').duplicate, false, '안내 연습 성공을 적는다');
    assert.equal(w.ui.summary().dueRenew, false, '같은 날에는 그 판을 잇는다(dueRenew 아님)');
    assert.equal(progress.startReview().id, helpedRun.id, '같은 날 — 그 판 그대로');
  } finally {
    w.ui.dispose();
  }

  // 다음 날 — 그 판은 답하지 않은 채 문서를 다시 연다
  t0.mock.timers.tick(DAY);
  if (unit) {
    judge.memory = [{ unit: 'unit-hello', lastAt: START - DAY, dueAt: Date.now() - HOUR }];
    judge.due = [{ unit: 'unit-hello' }];
  }
  w = lifeOn({ progress });
  try {
    const s = w.ui.summary();
    assert.equal(s.dueRenew, true, '요약 dueRenew — 앞선 날의 도움 판은 새 판으로');
    assert.deepEqual(s.dueIds, [missed.review.id], unit ? '①이 그 단위를 센다 — ③이 다른 장면으로 바꾸지 않는다' : '놓친 것이 돌아왔다');
    const recall = tutorPick(w, progress);
    assert.deepEqual([recall.kind, recall.id, recall.memory?.tryAlone], ['recall', missed.id, true], '홈 튜터 — 오늘은 네가 먼저(tryAlone)');
    const prepared = tally(w, 'next:prepare');
    w.ui.reviewStart();
    assert.equal(tally(w, 'next:prepare') - prepared, 1, 'F7 — 복습도 새 판 겉으로 열면 prepare()');
    const run = progress.exportSnapshot().activeReview;
    assert.notEqual(run.id, helpedRun.id, '앞선 날의 판을 잇지 않고 새 판');
    assert.deepEqual([run.ids, run.pendingHelp], [[missed.review.id], {}], '새 판에는 도움 표시가 없다');
    playReview(w);
    assert.equal(progress.exportSnapshot().activeReview.answers[missed.review.id].helped, false, '혼자 맞힌 답 그대로');
    assert.equal(progress.exportSnapshot().reviews[missed.review.id].streak, 1, '그 기록 streak 1');
    const after = tutorPick(w, progress);
    assert.notEqual(after.kind, 'difficult', '홈 튜터가 더는 「다시 살필 표현」이 아니다');
    if (unit) {
      assert.deepEqual(w.ui.summary().dueIds, [hello[1].review.id], '③ — 그 단위의 다른 장면(이야기 레슨)이 돌아온다');
      assert.equal(after.kind, 'review');
    } else assert.deepEqual(w.ui.summary().dueIds, [], '생활 단위가 없으면 더는 돌아오지 않는다');
  } finally {
    w.ui.dispose();
  }
}

test('F3 (가) 장면이 셋인 생활 단위 — 앞선 날 안내 연습이 연 도움 판은 다음 날 새 판으로: dueRenew · 홈 튜터 tryAlone · 혼자 맞힘 streak 1 · 그 뒤 ③은 다른 장면(Fable 5.2 합친 끝 판 F3)', t0 => {
  helpedDayThenAlone(t0, { unit: true });
});

test('F3 (나) 생활 단위 없는 복습 — 앞선 날 안내 연습이 연 도움 판은 다음 날 새 판으로: dueRenew · 홈 튜터 tryAlone · 혼자 맞힘 streak 1(Fable 5.2 합친 끝 판 F3)', t0 => {
  helpedDayThenAlone(t0, { unit: false });
});

test('F3 맞은편 — 판정을 넣지 않은 진도(입구는 있고 지금 판)는 앞선 날의 도움 판을 그대로 잇는다 — 요약에 dueRenew가 없다(4-2 앞과 같다)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  const lesson = lessonById('greetings-expressions');
  const missed = lesson.questions[0];
  const state = { now: 'old' };
  let helped = null;
  let w = lifeOn({ progress, state });
  try {
    playLesson(w, lesson, { wrong: [0] });
    goHome(w);
    t0.mock.timers.tick(2 * MINUTE);
    assert.equal(w.practice()(missed.id), true);
    helped = progress.exportSnapshot().activeReview;
    assert.deepEqual(helped.pendingHelp, { [missed.review.id]: true });
  } finally {
    w.ui.dispose();
  }
  t0.mock.timers.tick(DAY);
  w = lifeOn({ progress, state });
  try {
    assert.ok(!('dueRenew' in w.ui.summary()), '지금 판 요약에는 dueRenew가 없다');
    w.ui.reviewStart();
    assert.equal(progress.exportSnapshot().activeReview.id, helped.id, '앞선 날의 판을 잇는다');
    playReview(w);
    assert.equal(progress.exportSnapshot().activeReview.answers[missed.review.id].helped, true, '그 판의 도움 표시대로 적힌다');
    assert.equal(progress.exportSnapshot().reviews[missed.review.id].streak, 0);
    assert.equal(tally(w, 'next:prepare'), 0, '지금 판 시도는 판 겉을 준비하지 않는다');
  } finally {
    w.ui.dispose();
  }
});

test('F5 — 같은 표현(「안녕하세요.」)을 두 레슨에서 놓치면 돌아온 장면은 둘 · 표현은 하나: 요약 dueCount 2 · dueExpressions 1, 복습 첫 화면 REVIEW · 01 · 목록 한 줄 · 부제 새 장면 2개, 결과 「표현 1개를 다시 만났어요」(Fable 5.2 합친 끝 판 F5)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress, { unitsOf: () => [] });
  const w = lifeOn({ progress });
  try {
    const [first, story] = ['greetings-expressions', 'greetings-story'].map(lessonById);
    const hello = korean(first, first.questions[0]);
    playLesson(w, first, { wrong: [0] });
    goHome(w);
    playLesson(w, story, { wrong: [story.questions.findIndex(q => q.expressionId === 'greet-hello')] });
    goHome(w);
    t0.mock.timers.tick(MINUTE);
    const s = w.ui.summary();
    assert.deepEqual([s.dueState, s.dueCount, s.dueExpressions], ['engine', 2, 1], '장면 둘 · 표현 하나');
    w.ui.review();
    const screen = last(w);
    assert.equal(posterLabel(screen), 'REVIEW · 01');
    assert.equal(posterWord(screen), t('life.reviewWordCount', { n: 1 }));
    assert.ok(screen.includes(t('life.reviewSubScenes', { n: 2 })), '부제는 장면 수(2)');
    assert.deepEqual(rows(screen).map(row => row.korean), [hello], '목록은 표현 한 줄');
    assert.ok(live(w, 'review-start'));
    // 허브의 「지금 할 일」도 표현 수
    w.ui.packs();
    assert.ok(last(w).includes('REVIEW · 01') && last(w).includes(t('life.backSub', { n: 1 })));
    w.ui.reviewStart();
    assert.equal(progress.exportSnapshot().activeReview.ids.length, 2, '복습 판은 장면 둘');
    playReview(w);
    assert.ok(last(w).includes(t('life.reviewMet', { n: 1 })), '결과 — 표현 1개를 다시 만났어요');
    assert.deepEqual(rows(last(w)).map(row => row.korean), [hello]);
  } finally {
    w.ui.dispose();
  }
});

test('F7 — 새 판 겉으로 여는 시도(레슨 start · 홈 안내 연습 · reviewStart)는 그 자리에서 prepare()를 부르고, 판이 바뀌면(onRetired) 첫 문항 전 레슨 화면(소개 · 이야기)도 닫는다 — 다음 시도는 그때의 판으로(Fable 5.2 합친 끝 판 F7)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress);
  const state = { now: 'engine' };
  const w = lifeOn({ progress, state });
  const lesson = lessonById('greetings-expressions');
  try {
    const retire = w.nextOptions()?.onRetired;
    assert.equal(typeof retire, 'function', '새 판 겉에 판 바뀜 듣개(onRetired)를 넘긴다');
    // ① 소개 화면(첫 문항 전)에서 판이 바뀐다
    w.ui.start(lesson.id);
    assert.equal(w.ui.metrics().phase, 'intro');
    assert.equal(w.ui.metrics().trail.record, 'next');
    assert.equal(tally(w, 'next:prepare'), 1, '레슨을 새 판 겉으로 열면 prepare()');
    assert.deepEqual([w.counts.prepare, w.counts.ask], [0, 0], '옛 코치 준비 · 입구 다시 묻기는 없다');
    retire();
    assert.equal(w.counts.closes, 1, '열린 소개 화면을 닫는다(home.closePanel)');
    assert.deepEqual(w.toasts, [t('life.next.changed')]);
    assert.equal(w.ui.metrics().shown, false);
    // ② 이야기 장면(첫 문항 전)에서 판이 바뀐다
    w.ui.start(lesson.id);
    assert.equal(tally(w, 'next:prepare'), 2);
    press(live(w, 'begin'));
    assert.equal(w.ui.metrics().phase, 'story');
    retire();
    assert.equal(w.counts.closes, 2, '열린 이야기 장면을 닫는다');
    assert.deepEqual(w.toasts, [t('life.next.changed'), t('life.next.changed')]);
    assert.ok(!w.log.some(entry => entry === 'next:shown' || entry === 'next:answer'), '문항은 아직 보이지 않았다');
    // ③ 판이 지금 판으로 내려갔다 — 다음 시도는 옛 거울 · 옛 코치 준비 · 입구에 다시 묻기(그 레슨은 하던 자리에서 이어진다)
    state.now = 'old';
    playLesson(w, lesson, { wrong: [0] });
    assert.equal(w.ui.metrics().trail.record, 'old');
    assert.equal(tally(w, 'next:prepare'), 2, '옛 거울로 연 시도는 판 겉을 준비하지 않는다');
    assert.deepEqual([w.counts.prepare, w.counts.ask], [1, 1], '옛 코치 준비 · 입구에 다시 묻기 한 번');
    assert.deepEqual([tally(w, 'old:shown'), tally(w, 'old:answer')], [lesson.questions.length, lesson.questions.length]);
    assert.ok(!w.log.some(entry => entry === 'next:shown' || entry === 'next:answer'), '새 판 겉에는 적지 않는다');
    goHome(w);
    // ④ 다시 새 길 — 홈 안내 연습 · 복습도 새 판 겉으로 열면 prepare()
    state.now = 'engine';
    t0.mock.timers.tick(MINUTE);
    assert.equal(w.practice()(lesson.questions[0].id), true);
    assert.equal(tally(w, 'next:prepare'), 3, '홈 안내 연습');
    assert.ok(w.log.includes('next:guided') && !w.log.includes('old:guided'));
    w.ui.reviewStart();
    assert.equal(tally(w, 'next:prepare'), 4, '복습');
    assert.equal(w.ui.metrics().trail.record, 'next');
    assert.equal(tally(w, 'next:shown'), 1, '복습 문항은 새 판 겉에');
    assert.deepEqual([w.counts.prepare, w.counts.ask], [1, 1], '새 판 겉 시도는 옛 코치를 준비하지 않는다');
  } finally {
    w.ui.dispose();
  }
});

test('넘친 #6 · #7 — 확인 중에 연 복습 첫 화면: 튜터 단계 없음(library) → 판정이 서면 다시 그림(reviewDue) · 튜터 창이 열려 있으면 미룸 · 초점은 같은 생활 단추로 · 허브 · 팩은 엔진으로 서는 때 한 번만(Fable 5.2 합친 끝 판 넘친 #6 · #7)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  const lesson = lessonById('greetings-expressions');
  // 「감사합니다.」만 생활 단위가 있다 — 기억 줄을 넣고 빼면 「다음 복습」 때가 바뀐다(판정이 또 바뀜).
  const judge = engine(progress, { unitsOf: review => (review.questionId === 'greetings-expressions-thanks' ? ['unit-thanks'] : []) });
  const thanksLine = [{ unit: 'unit-thanks', lastAt: START - DAY, dueAt: START + 2 * DAY }];
  checking(progress);
  const state = { now: 'checking' };
  const w = lifeOn({ progress, state });
  try {
    playLesson(w, lesson, { wrong: [0] });
    goHome(w);
    t0.mock.timers.tick(2 * MINUTE);

    // 확인 중 복습 첫 화면 — 튜터 단계를 넘기지 않는다(#7)
    w.ui.review();
    assert.ok(last(w).includes(t('life.reviewChecking')));
    let tutor = w.tutors.at(-1);
    assert.equal(tutor.state.phase, undefined, '#7 — 확인 중에는 튜터 단계 없음(tutorPhase null)');
    assert.equal(lifeTutorKind(tutor.state), 'library');
    const painted = w.shows.length;
    w.ui.refresh();
    assert.equal(w.shows.length, painted, '판정이 그대로면 다시 그리지 않는다');

    // 판정이 엔진으로 섰다 — 튜터 「표현 도움」 · 「연습하기」 창이 열려 있으면 미룬다(#6)
    state.now = 'engine';
    judge.on();
    for (const open of [{ guideOpen: true }, { practice: { id: lesson.questions[0].id } }]) {
      w.tutorWindow.metrics = open;
      w.ui.refresh();
      assert.equal(w.shows.length, painted, `튜터 창(${Object.keys(open)[0]})이 열려 있으면 다시 그리지 않는다`);
    }
    // 창이 닫혔다 — 다음 새로 하기에 다시 그린다. 초점은 같은 생활 단추로, 자리는 그대로.
    w.tutorWindow.metrics = {};
    document.activeElement = { inPanel: true, attributes: [{ name: 'class' }, { name: 'data-life-next' }] };
    content.scrollTop = 120;
    focused.length = 0;
    w.ui.refresh();
    assert.equal(w.shows.length, painted + 1, '창이 닫힌 뒤 새로 하기에 다시 그린다');
    assert.equal(posterLabel(last(w)), 'REVIEW · 01');
    assert.ok(!last(w).includes(t('life.reviewChecking')));
    tutor = w.tutors.at(-1);
    assert.equal(tutor.state.phase, 'reviewDue', '#7 — 엔진으로 다시 그리면 돌아온 것이 있을 때의 단계');
    assert.equal(lifeTutorKind(tutor.state), 'reviewDue');
    assert.deepEqual(focused, ['[data-life-next]'], '다시 그린 뒤 같은 data-life-* 단추에 초점');
    assert.equal(content.scrollTop, 120, '자리는 그대로');

    // 엔진 → 엔진: 판정이 바뀌면 다시 그린다 — 초점이 「복습 시작하기」에 있었으면 그 단추로
    document.activeElement = { inPanel: true, attributes: [{ name: 'data-life-review-start' }] };
    focused.length = 0;
    let before = sign(w.ui.summary());
    judge.memory = thanksLine;
    assert.notEqual(sign(w.ui.summary()), before, '시험이 판정 바뀜을 실제로 만든다');
    w.ui.refresh();
    assert.equal(w.shows.length, painted + 2);
    assert.deepEqual(focused, ['[data-life-review-start]']);
    // 판 밖에 있던 초점은 옮기지 않는다
    document.activeElement = { inPanel: false, attributes: [{ name: 'data-life-review-start' }] };
    focused.length = 0;
    judge.memory = [];
    w.ui.refresh();
    assert.equal(w.shows.length, painted + 3);
    assert.deepEqual(focused, [], '판 밖의 초점은 그대로');
    document.activeElement = null;

    // 확인 중에 연 허브 · 팩 — 엔진으로 서는 때 한 번 다시 그리고, 그 뒤 판정이 또 바뀌어도 다시 그리지 않는다(#6)
    // 이름이 같은 단추가 여럿(팩의 레슨 목록)이면 값까지 같은 단추로 — 첫 레슨 단추로 가면 엔터가 다른 레슨을 열었다(카본 A2 · GPT GA2)
    const secondLesson = 'greetings-story';
    for (const [label, open, keep, value = '', first = false] of [
      ['허브', () => w.ui.packs(), '[data-life-stories]'],
      ['팩', () => w.ui.pack('greetings'), '[data-life-packs]'],
      ['팩 · 둘째 레슨', () => w.ui.pack('greetings'), '[data-life-lesson]', secondLesson],
      // 같은 값의 단추가 다시 그린 판에 없으면 같은 이름의 첫 단추로(닫기 단추로 옮겨 가지 않는다)
      ['팩 · 없는 레슨', () => w.ui.pack('greetings'), '[data-life-lesson]', 'gone-lesson', true],
    ]) {
      state.now = 'checking';
      checking(progress);
      open();
      const opened = w.shows.length;
      const title = last(w);
      if (label.startsWith('팩')) assert.ok(title.includes(t('life.seeReviews')), '확인 중 팩 화면에도 「복습 보기」');
      else assert.ok(!title.includes('REVIEW · '), '확인 중 허브에는 복습 포스터가 없다');
      w.ui.refresh();
      assert.equal(w.shows.length, opened, `${label}: 확인 중 그대로면 다시 그리지 않는다`);
      state.now = 'engine';
      judge.on();
      const name = keep.slice(1, -1);
      if (value && !first) assert.ok(attrsOf(name).indexOf(value) > 0, `${label}: 시험의 단추는 같은 이름의 첫 단추가 아니다(가르는 값)`);
      if (first) assert.equal(attrsOf(name).indexOf(value), -1, `${label}: 그 값의 단추는 판에 없다(가르는 값)`);
      document.activeElement = { inPanel: true, attributes: [{ name: 'class', value: 'life-card' }, { name, value }] };
      focused.length = 0;
      w.ui.refresh();
      assert.equal(w.shows.length, opened + 1, `${label}: 엔진으로 서면 한 번 다시 그린다`);
      const expected = first ? `[${name}="${attrsOf(name)[0]}"]` : value ? `[${name}="${value}"]` : keep;
      assert.deepEqual(focused, [expected], `${label}: 초점은 같은 생활 단추로`);
      if (label === '허브') assert.equal(posterLabel(last(w)), 'REVIEW · 01', '허브: 돌아온 복습 포스터');
      else assert.ok(last(w).includes(t('life.seeReviews')));
      document.activeElement = null;
      before = sign(w.ui.summary());
      judge.memory = judge.memory.length ? [] : thanksLine;
      assert.notEqual(sign(w.ui.summary()), before, '시험이 판정 바뀜을 실제로 만든다');
      w.ui.refresh();
      assert.equal(w.shows.length, opened + 1, `${label}: 그 뒤 판정이 또 바뀌어도 다시 그리지 않는다`);
    }
  } finally {
    document.activeElement = null;
    w.ui.dispose();
  }
});

test('넘친 #5 · #9 — 새 길 복습 첫 화면의 때는 날까지만(오늘 중 · 내일쯤 · ○월 ○일쯤): 「곧 돌아올 표현」은 dueUpcoming으로 · 「다음 복습 {date}」도 날까지 · 확인 중에는 목록 · 날짜 없이 확인 중 글', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  const lesson = lessonById('greetings-expressions');
  const [hello, thanks, name] = ['greet-hello', 'greet-thanks', 'greet-name'].map(id => lesson.questions.find(q => q.expressionId === id));
  // 표현 레슨의 복습 셋은 각자 생활 단위 — 「저는 몽글이에요.」 단위만 기억 줄이 있다(사흘 뒤에 돌아옴).
  const units = new Map([hello, thanks, name].map(q => [q.review.id, [`unit-${q.expressionId}`]]));
  engine(progress, { unitsOf: review => units.get(review.id) ?? [], memory: [{ unit: `unit-${name.expressionId}`, lastAt: START - DAY, dueAt: START + 3 * DAY }] });
  const w = lifeOn({ progress });
  const around = at => t('life.when.aroundDay', { date: formatDate(at, { month: 'short', day: 'numeric' }) });
  const clock = at => formatDate(at, { hour: 'numeric', minute: '2-digit' });
  try {
    playLesson(w, lesson, { wrong: [lesson.questions.indexOf(hello)] });
    goHome(w);
    const s = w.ui.summary();
    assert.deepEqual(
      s.dueUpcoming.map(row => [row.id, row.at]),
      [
        [hello.review.id, START + MINUTE],
        [thanks.review.id, START + DAY],
        [name.review.id, START + 3 * DAY],
      ],
      '판정의 「곧 돌아올 것」 — ① 놓친 것 · ② 처음 만나는 장면 · 기억 줄의 다음 때',
    );
    // 복습 첫 화면 — 돌아온 것이 없으면 「곧 돌아올 표현」을 dueUpcoming으로, 때는 날까지만
    w.ui.review();
    let screen = last(w);
    assert.deepEqual(
      rows(section(screen, 'data-upcoming') ?? ''),
      [
        { korean: korean(lesson, hello), note: t('life.when.todayDay') },
        { korean: korean(lesson, thanks), note: t('life.when.tomorrowDay') },
        { korean: korean(lesson, name), note: around(START + 3 * DAY) },
      ],
      '오늘 중 · 내일쯤 · ○월 ○일쯤',
    );
    assert.equal(posterWord(screen), t('life.reviewWordNext'));
    assert.ok(screen.includes(t('life.reviewSubOpens', { date: t('life.when.todayDay') })), '「{date}에 열려요」도 날까지');
    assert.ok(!screen.includes(t('life.when.minutes', { n: 1 })), '분 글이 없다');
    for (const at of [START + MINUTE, START + DAY, START + 3 * DAY]) assert.ok(!screen.includes(clock(at)), `시각 글이 없다(${clock(at)})`);
    assert.equal(lifeTutorKind(w.tutors.at(-1).state), 'reviewNext');
    // 허브의 「다음 복습 {date}」도 날까지
    w.ui.packs();
    assert.ok(last(w).includes(t('life.reviewNext', { date: t('life.when.todayDay') })), '허브 — 다음 복습 오늘 중');
    assert.ok(!last(w).includes(t('life.reviewNext', { date: t('life.when.minutes', { n: 1 }) })));

    // 1분 뒤 놓친 것을 혼자 맞히면 다음은 내일쯤
    t0.mock.timers.tick(MINUTE);
    w.ui.reviewStart();
    playReview(w);
    w.ui.review();
    screen = last(w);
    assert.deepEqual(rows(section(screen, 'data-upcoming') ?? ''), [
      { korean: korean(lesson, thanks), note: t('life.when.tomorrowDay') },
      { korean: korean(lesson, name), note: around(START + 3 * DAY) },
    ]);
    assert.ok(screen.includes(t('life.reviewSubOpens', { date: t('life.when.tomorrowDay') })), '내일쯤에 열려요');
    assert.ok(!screen.includes(clock(START + DAY)), '시각 글이 없다');
    w.ui.packs();
    assert.ok(last(w).includes(t('life.reviewNext', { date: t('life.when.tomorrowDay') })), '허브 — 다음 복습 내일쯤');

    // 확인 중 — 목록 · 날짜 없이 확인 중 글(옛 간격표의 「곧 돌아올 표현」도 그리지 않는다)
    checking(progress);
    w.ui.review();
    screen = last(w);
    assert.ok(screen.includes(t('life.reviewChecking')));
    assert.equal(posterLabel(screen), 'REVIEW');
    assert.equal(posterWord(screen), t('life.reviewWordNext'), '확인 중 포스터는 「다음 복습」(「아직 복습이 없어요」가 아니다)');
    assert.equal(section(screen, 'data-upcoming'), null, '「곧 돌아올 표현」이 없다');
    assert.deepEqual(rows(screen), [], '목록이 없다');
    assert.ok(!screen.includes(t('life.reviewSubOpens', { date: '' })), '날짜가 없다');
    for (const key of ['life.when.todayDay', 'life.when.tomorrowDay', 'life.reviewSubNone']) assert.ok(!screen.includes(t(key)), `확인 중 화면에 ${key} 글이 없다`);
    assert.ok(!screen.includes(around(START + 3 * DAY)));
  } finally {
    w.ui.dispose();
  }
});

test('넘친 #9 — 새 길 복습 결과 줄: 혼자 맞힌 표현은 그 생활 단위의 다음 때(learning.next.nextAt)가 하루 안이면 「하루 안에 한 번 더」, 하루 밖 · 모름이면 「잘 기억했어요」, 틀림 · 도움은 「조금 뒤 다시 나와요」', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress);
  const lesson = lessonById('greetings-expressions');
  const [hello, thanks, name] = ['greet-hello', 'greet-thanks', 'greet-name'].map(id => lesson.questions.find(q => q.expressionId === id));
  const nextAt = new Map();
  const w = lifeOn({ progress, nextAt: id => nextAt.get(id) ?? null });
  try {
    playLesson(w, lesson, { wrong: [0, 1, 2] });
    goHome(w);
    t0.mock.timers.tick(MINUTE);
    assert.equal(w.ui.summary().dueCount, 3);
    // 첫 판: 「안녕하세요.」 혼자(다음 때 2시간 뒤 — 하루 안) · 「저는 몽글이에요.」 해설을 열고 맞힘 · 「감사합니다.」 틀림
    nextAt.set(hello.review.id, Date.now() + 2 * HOUR);
    nextAt.set(name.review.id, Date.now() + 2 * HOUR);
    w.ui.reviewStart();
    playReview(w, record => (record.questionId === hello.id ? 'right' : record.questionId === name.id ? 'help' : 'wrong'));
    assert.deepEqual(notes(last(w)), {
      [korean(lesson, hello)]: t('life.reviewAgainSoon'),
      [korean(lesson, name)]: t('life.reviewSoon'),
      [korean(lesson, thanks)]: t('life.reviewSoon'),
    });
    goHome(w);
    // 둘째 판(1분 뒤 — 도움 · 틀림은 다시 돌아온다): 둘 다 혼자 — 「감사합니다.」 다음 때 이틀 뒤(하루 밖) · 「저는 몽글이에요.」 다음 때 모름
    t0.mock.timers.tick(MINUTE);
    nextAt.set(thanks.review.id, Date.now() + 2 * DAY);
    nextAt.delete(name.review.id);
    w.ui.reviewStart();
    assert.deepEqual(progress.exportSnapshot().activeReview.ids.slice().sort(), [name.review.id, thanks.review.id].sort());
    playReview(w);
    assert.deepEqual(notes(last(w)), {
      [korean(lesson, name)]: t('life.reviewRemembered'),
      [korean(lesson, thanks)]: t('life.reviewRemembered'),
    });
    assert.ok(!last(w).includes(t('life.reviewAgainSoon')));
  } finally {
    w.ui.dispose();
  }
});

test("넘친 #9 — 「한 단계씩 도움받기」(presentation support: step)가 편 도움과 함께 낸 레슨 답은 새 판 겉 answer에 helpBy: 'setting'(시범 답), 사람이 직접 연 해설은 'user'", t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress);
  const w = lifeOn({ progress, presentation: () => ({ support: 'step' }) });
  const lesson = lessonById('greetings-expressions');
  try {
    playLesson(w, lesson, { help: [1] });
    assert.deepEqual(
      w.newTrail.answers.map(answer => [answer.correct, answer.helped, answer.helpBy]),
      [
        [true, true, 'setting'],
        [true, true, 'user'],
        [true, true, 'setting'],
      ],
    );
    assert.equal(tally(w, 'old:answer'), 0, '새 길 시도의 답은 새 판 겉에만');
    // 진도도 같은 뜻 — 설정이 편 도움과 함께 맞힌 답은 놓침이 아니고, 사람이 연 해설은 놓침
    const reviews = progress.exportSnapshot().reviews;
    assert.deepEqual(
      lesson.questions.map(q => reviews[q.review.id].lapses),
      [0, 1, 0],
    );
  } finally {
    w.ui.dispose();
  }
});

test('F3 (다) 같은 문서에서 날을 넘김 — 어제 안내 연습에서 본 표현은 오늘 새 판의 도움이 아니다: 새 판에 도움 표시 없음 · 혼자 맞힘 · 튜터가 「어려운 표현」으로 돌아가지 않음(화면 exposedTransfers의 때 → 진도 markReviewHelp seenAt)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress, { unitsOf: () => [] });
  const lesson = lessonById('greetings-expressions');
  const missed = lesson.questions[0];
  const w = lifeOn({ progress });
  try {
    playLesson(w, lesson, { wrong: [0] });
    goHome(w);
    t0.mock.timers.tick(2 * MINUTE);
    w.practice()(missed.id);
    w.complete()(missed.id, 'marin');
    const helped = progress.exportSnapshot().activeReview;
    assert.equal(helped.pendingHelp[missed.review.id], true, '같은 날 안내 연습이 연 판에는 도움 표시');
    t0.mock.timers.tick(DAY); // 문서는 그대로 열려 있다
    w.ui.refresh();
    assert.equal(w.ui.summary().dueRenew, true);
    const recall = tutorPick(w, progress);
    assert.equal(recall.kind, 'recall');
    assert.equal(recall.memory?.tryAlone, true);
    w.ui.reviewStart();
    const run = progress.exportSnapshot().activeReview;
    assert.notEqual(run.id, helped.id, '새 판');
    assert.deepEqual(run.pendingHelp, {}, '어제 본 표현은 오늘 판의 도움이 아니다');
    playReview(w);
    const after = progress.exportSnapshot();
    assert.equal(after.activeReview.answers[missed.review.id].helped, false, '혼자 맞힌 답');
    assert.equal(after.reviews[missed.review.id].streak, 1);
    assert.notEqual(tutorPick(w, progress).kind, 'difficult', '어려운 표현에서 벗어남');
  } finally {
    w.ui.dispose();
  }
});
