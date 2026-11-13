// 생활 화면(life-ui.mjs)이 새 길 입구를 받은 문서에서도 시도마다 그때의 판으로 기록부를 고르는가(단계 4 계획 §19-3 7 — 열 때마다 입구에
// 묻는다), 홈 「이 표현 같이 연습」이 엔진 판정일 때만 새 길 방식인가, 확인 중에 연 복습 화면이 판정이 서면 다시 그려지는가.
// GPT · 카본 합친 끝 판(atlas-redesign-stage4-acct-life-final-20261113) GB1 · GB2 · B1 · B2. 화면은 가짜 문서 위에 세운다(그리기 내용은
// 보인 글만 본다).
import assert from 'node:assert/strict';
import test from 'node:test';

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
const panel = node();
const content = node();
globalThis.document ??= {
  hidden: false,
  head: node(),
  body: node(),
  documentElement: { ...node(), lang: 'ko' },
  querySelector: sel => (sel === '#world-panel' ? panel : sel === '#panel-content' ? content : null),
  querySelectorAll: () => [],
  createElement: () => node(),
  addEventListener() {},
  removeEventListener() {},
};
globalThis.getComputedStyle ??= () => ({ position: 'relative' });
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });

const { createLifeExperience } = await import('../life-ui.mjs');
const { createLifeProgress } = await import('../life-progress.mjs');
const { LESSONS } = await import('../life-content.mjs');
const { t } = await import('../../brand-opening/world-lang.mjs');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}
// 부른 일을 적는 기록부(옛 거울 · 새 판 겉 같은 겉).
function recorder(name, log) {
  const shown = [];
  return {
    shown: (...args) => {
      shown.push(args[0]);
      log.push(`${name}:shown`);
      return null;
    },
    help: () => log.push(`${name}:help`),
    delivery: () => log.push(`${name}:delivery`),
    answer: () => {
      log.push(`${name}:answer`);
      return null;
    },
    guided: () => log.push(`${name}:guided`),
    release() {},
    metrics: () => ({ slots: shown.length, presented: 0, answered: 0 }),
    dispose() {},
    seen: shown,
  };
}
// 틀린 본문항 하나 — 그 복습이 진도에 선다. 시계는 진짜 시각(화면의 「이 표현 같이 연습」이 Date.now()로 견준다).
function missedProgress() {
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage() });
  progress.summary([], LESSONS);
  const lesson = LESSONS[0];
  progress.startLesson(lesson);
  const [q1] = lesson.questions;
  progress.recordAnswer({ lessonId: lesson.id, questionId: q1.id, correct: false });
  return { progress, lesson, question: q1, reviewId: q1.review.id };
}
function lifeOn({ progress, state = { now: 'old' }, entry = true }) {
  const log = [];
  const oldTrail = recorder('old', log);
  const newTrail = recorder('next', log);
  const counts = { prepare: 0, ask: 0 };
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
    state: {},
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
        createLifeTrail: () => oldTrail,
        createLifeNext: () => newTrail,
        lifeItem: ({ question }) => ({ itemKey: question.id }),
        lessonSlot: (attempt, id) => `${attempt}:${id}`,
        reviewSlot: (run, id) => `${run}:${id}`,
      },
      // entry: false — 셸이 새 길 입구를 넘기지 않은 문서(스위치 꺼짐 · 생활 단독 묶음 — 라이브 지금 판)
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

test('지금 판으로 정해진 문서(새 길 입구는 있음)의 복습은 옛 거울에 적고 옛 코치를 준비하며 입구에 다시 묻는다 — 새 길이 되면 다음 시도부터 새 판 겉(카본 B1 · GPT GB2)', () => {
  const { progress } = missedProgress();
  progress.setDueSource(null); // 지금 판 — 진도 간격 그대로
  const state = { now: 'old' };
  const w = lifeOn({ progress, state });
  // 틀린 것은 1분 뒤 돌아온다 — 바로 열려면 레슨 결과의 「새 장면으로 다시 보기」처럼 고른 복습으로
  const id = Object.keys(progress.exportSnapshot().reviews)[0];
  w.ui.reviewStart(null, [id], { soon: true });
  assert.ok(w.log.includes('old:shown'), '옛 거울에 보임을 적는다');
  assert.ok(!w.log.includes('next:shown'), '새 판 겉에는 적지 않는다');
  assert.equal(w.counts.prepare, 1, '지금 판이면 옛 코치를 준비한다');
  assert.equal(w.counts.ask, 1, '지금 판이면 입구에 판을 다시 묻는다(열 때마다)');
  assert.equal(w.ui.metrics().trail.record, 'old');
  // 입구가 새 길이 되었다 — 다음 시도부터 새 판 겉
  state.now = 'engine';
  w.log.length = 0;
  w.ui.reviewStart(null, [id], { soon: true });
  assert.ok(w.log.includes('next:shown'), '새 길이면 새 판 겉');
  assert.ok(!w.log.includes('old:shown'));
  assert.equal(w.counts.prepare, 1, '새 길이면 옛 코치를 준비하지 않는다');
  assert.equal(w.ui.metrics().trail.record, 'next');
  w.ui.dispose();
});

test('확인 중인 문서의 시도는 새 판 겉으로 — 코치가 서면 흘려보내고, 옛 코치는 준비하지 않는다', () => {
  const { progress } = missedProgress();
  progress.setDueSource(() => ({ state: 'checking' }));
  const w = lifeOn({ progress, state: { now: 'checking' } });
  const id = Object.keys(progress.exportSnapshot().reviews)[0];
  w.ui.reviewStart(null, [id], { soon: true });
  assert.ok(w.log.includes('next:shown'));
  assert.ok(!w.log.includes('old:shown'));
  assert.equal(w.counts.prepare, 0);
  assert.equal(w.counts.ask, 0, '확인 중에는 입구를 따로 묻지 않는다(새 판 겉이 코치를 청한다)');
  w.ui.dispose();
});

test('홈 「이 표현 같이 연습」 — 엔진 판정일 때만 그 표현 하나를 간격 없이 열고, 지금 판 · 확인 중이면 돌아올 때가 안 된 표현의 복습을 만들지 않는다(카본 B2)', () => {
  for (const [path, expected] of [
    ['old', false],
    ['checking', false],
    ['engine', true],
  ]) {
    const { progress, question } = missedProgress();
    // 그 복습을 한 번 놓쳐 「어려운 표현」(lapses > 0 · streak 0)으로 — 다음 복습은 아직 오지 않았다
    const id = question.review.id;
    progress.startReview(1, id, null, { ids: [id] });
    progress.answerReview({ id, correct: false });
    const record = progress.exportSnapshot().reviews[id];
    assert.ok(record.lapses > 0 && record.streak === 0, '어려운 표현');
    assert.ok(record.dueAt > Date.now(), '다음 복습은 아직');
    assert.equal(progress.exportSnapshot().activeReview?.ids?.some(x => !progress.exportSnapshot().activeReview.answers[x]) ?? false, false);
    if (path === 'old') progress.setDueSource(null);
    else if (path === 'checking') progress.setDueSource(() => ({ state: 'checking' }));
    else progress.setDueSource(() => ({ state: 'engine', ids: [], nextAt: null, times: [], upcoming: [] }));
    const w = lifeOn({ progress, state: { now: path } });
    w.ui.refresh();
    const prepare = w.practice();
    assert.equal(typeof prepare, 'function', '홈이 받은 연습 준비');
    assert.equal(prepare(question.id), true, `${path}: 안내 연습은 연다`);
    const active = progress.exportSnapshot().activeReview;
    assert.equal(Boolean(active?.ids?.includes(id) && !active.answers[id]), expected, `${path}: 복습 판을 만드는가`);
    w.ui.dispose();
  }
});

test('확인 중에 연 복습 화면은 판정이 서면 다시 그려진다 — 진도가 바뀌어 셸이 화면을 새로 할 때(GPT GB1)', () => {
  const { progress, reviewId } = missedProgress();
  progress.setDueSource(() => ({ state: 'checking' }));
  const w = lifeOn({ progress, state: { now: 'checking' } });
  w.ui.review();
  const checking = t('life.reviewChecking');
  assert.ok(w.shows.at(-1).html.includes(checking), '처음에는 확인 중');
  const painted = w.shows.length;
  w.ui.refresh();
  assert.equal(w.shows.length, painted, '판정이 그대로면 다시 그리지 않는다');
  progress.setDueSource(() => ({ state: 'engine', ids: [reviewId], nextAt: null, times: [Date.now()], upcoming: [] }));
  w.ui.refresh(); // 셸은 진도가 바뀌면 화면을 새로 한다(app-shell refreshLife → ui.refresh)
  assert.ok(w.shows.length > painted, '판정이 서면 다시 그린다');
  assert.ok(!w.shows.at(-1).html.includes(checking), '더는 확인 중이 아니다');
  assert.ok(w.shows.at(-1).html.includes('data-life-review-start') || w.shows.at(-1).html.includes('REVIEW · 01'), '돌아온 복습 하나');
  w.ui.dispose();
});

test('지금 판(새 길 입구 없음 — 라이브)의 복습 화면은 진도가 바뀌어도 다시 그리지 않는다 — 12/10까지 지금 판 그대로(15초 타이머 · 셸의 새로 하기)', () => {
  const { progress, reviewId } = missedProgress();
  const w = lifeOn({ progress, entry: false });
  w.ui.review();
  const painted = w.shows.length;
  const before = w.ui.summary();
  // 그 복습을 맞혀 다음 때를 미룬다 — 지금 판 요약의 다음 때가 바뀐다
  progress.startReview(1, reviewId, null, { ids: [reviewId] });
  progress.answerReview({ id: reviewId, correct: true });
  const after = w.ui.summary();
  assert.notEqual(after.nextReviewAt, before.nextReviewAt, '시험이 판정 바뀜을 실제로 만든다');
  w.ui.refresh();
  assert.equal(w.shows.length, painted, '지금 판은 열린 복습 화면을 다시 그리지 않는다');
  assert.ok(!w.log.includes('next:shown'), '새 판 겉은 쓰지 않는다');
  w.ui.dispose();
});
