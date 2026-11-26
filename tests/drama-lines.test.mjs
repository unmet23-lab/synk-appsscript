// 서울행 「내 팬」 대사별 칭찬의 줄 결과(experiences/seoul-arrival/팬설계.md 13-2)를 실제 1화 기록기(createRecorder)가 남긴 사건으로 본다.
// 손으로 쓴 사건이 아니라 1화가 쓰는 Atlas 게임 · 시계 · 저장으로 만든다. 훑기는 1화 revisitFacts와 함께 쓴다(tests/drama-review.test.mjs가 그쪽을 본다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import PILOT from '../experiences/drama/pilot/content.mjs';
import { lineResults, pickLines, scanPresentations, judgePresentation, NOTE_ORDER } from '../experiences/synk-world-app/drama-lines.mjs';

const require = createRequire(import.meta.url);
const Drama = require('../experiences/drama/pilot/learning-entry.cjs');
const LINES = PILOT.scene.filter((x) => x.type === 'student');
const [L6, L7, L8] = LINES.map((x) => x.id);
const GOAL = LINES.find((x) => x.goal)?.id;
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const ok = (kind, note) => ({ kind: 'result', data: { status: 'ok', transcript: 'x', observation: { kind, note: note || null, sure: kind === 'pass' }, trail: { correct: kind === 'pass', assessable: false } } });
const NOTE = (kind) => ok('note', kind === 'missing' ? { kind, word: '편의점' } : { kind, want: 'polite', got: 'plain', at: 'x' });
const TAKE = {
  pass: ok('pass'), ending: NOTE('ending'), length: NOTE('length'), missing: NOTE('missing'), hold: ok('pending'),
  unheard: { kind: 'result', data: { status: 'no_speech', transcript: '', trail: { correct: null, assessable: false, reason: 'unanswered' } } },
  unclear: { kind: 'result', data: { status: 'unclear', transcript: 'hello', trail: { correct: null, assessable: false } } },
  down: { kind: 'down' },
};
const T0 = Date.parse('2026-11-26T03:00:00Z');

// rounds: [{at, lines: {lineId: [걸음…]}}] — 걸음은 TAKE의 이름, 'answer'(대사 전체 보기), 'exclude'(「제가 한 말과 달라요」), 'retake:<걸음>'(테이크 2).
function record(rounds) {
  const box = { now: T0 }, mem = memory();
  let coach = null;
  const owner = { createGame: (meta, factory) => (coach = factory({ gameId: meta.gameId, clock: () => new Date(box.now).toISOString(), storage: mem })) };
  const rec = Drama.createRecorder({ owner });
  for (const round of rounds) {
    box.now = round.at;
    for (const s of LINES) {
      const steps = round.lines[s.id]; if (!steps) continue;
      const line = rec.open({ lineId: s.id, skillId: s.skill, phase: 'scene' });
      let retake = null;
      for (const step of steps) {
        if (step === 'answer') line.help('answer');
        else if (step === 'exclude') line.excludeLast();
        else if (step.startsWith('retake:')) { retake ||= rec.open({ lineId: s.id, skillId: s.skill, phase: 'retake' }); retake.take(TAKE[step.slice(7)]); }
        else line.take(TAKE[step]);
      }
      box.now += 1000;
    }
  }
  return coach.events();
}
const one = (steps) => lineResults(record([{ at: T0, lines: { [L6]: steps } }]))[0] || null;

test('줄 결과: 표의 네 갈래', () => {
  assert.deepEqual(one(['pass']), { line: L6, result: 'clean' });
  assert.deepEqual(one(['ending', 'pass']), { line: L6, result: 'fixed', kind: 'ending' });
  assert.deepEqual(one(['length', 'hold', 'pass']), { line: L6, result: 'fixed', kind: 'length' }, '판정 보류는 건너뛴다');
  assert.deepEqual(one(['unheard', 'pass']), { line: L6, result: 'heard' });
  assert.deepEqual(one(['missing', 'missing']), { line: L6, result: 'todo', kind: 'missing' });
  assert.deepEqual(one(['ending', 'unheard', 'length']), { line: L6, result: 'todo', kind: 'length' }, 'note → 안 들림 → note: 마지막 판정');
  assert.deepEqual(one(['unheard', 'ending', 'ending', 'ending']), { line: L6, result: 'todo', kind: 'ending' }, '안 들림 → note 셋');
  assert.deepEqual(one(['ending', 'pass', 'length']), { line: L6, result: 'todo', kind: 'length' }, '마지막 판정이 note면 칭찬하지 않는다');
});

test('줄 결과: 칭찬하지 않는 경우', () => {
  assert.equal(one(['unclear', 'pass']), null, '한국어인지 못 가린 첫 시도는 안 들림이 아니다');
  assert.equal(one(['down', 'pass']), null, '서버 사정 뒤 통과는 시도 1이 통과가 아니다');
  assert.equal(one(['answer', 'pass']), null, '대사 전체를 보고 통과');
  assert.equal(one(['ending', 'answer', 'pass']), null, '고친 통과 앞에 대사 전체를 봄');
  assert.equal(one(['unheard', 'answer', 'pass']), null, '안 들림 뒤 대사 전체를 보고 통과');
  assert.equal(one(['hold']), null, '판정이 없는 줄');
  assert.equal(one([]), null, '시도가 없는 줄');
});

test('줄 결과: 뺀 시도와 같은 ms의 도움', () => {
  assert.equal(one(['pass', 'exclude', 'pass']), null, '뺀 시도가 있는 보임은 clean이 아니다');
  assert.equal(one(['ending', 'exclude', 'pass']), null, '뺀 시도가 있는 보임은 시도 1이 남지 않아 칭찬하지 않는다');
  // 같은 시각(ms)의 도움과 판정: 시계를 멈춘 채 판정 → 도움 차례면 판정 앞에 도움이 없다
  const events = record([{ at: T0, lines: { [L6]: ['pass', 'answer'] } }]);
  const p = [...scanPresentations(events).values()].find((x) => x.phase === 'scene');
  assert.equal(new Set(events.filter((e) => e.presentationId === p.id).map((e) => e.at)).size, 1, '모두 같은 ms');
  assert.deepEqual(judgePresentation(p), { result: 'clean' }, '판정 뒤에 본 도움은 그 판정을 무르지 않는다');
});

test('줄 결과: 테이크 2는 넣지 않고, 장면 보임만 본다', () => {
  const events = record([{ at: T0, lines: { [L6]: ['ending', 'retake:pass'] } }]);
  assert.deepEqual(lineResults(events), [{ line: L6, result: 'todo', kind: 'ending' }]);
});

test('판의 경계: 완주 시각으로 가르고, 앞 판도 같은 방식으로 센다', () => {
  const W1 = T0 + 10000, W2 = T0 + 30000;
  const round1 = { at: T0, lines: { [L6]: ['ending', 'pass'], [L7]: ['pass'], [L8]: ['unheard', 'pass'] } };
  const round2 = { at: T0 + 20000, lines: { [L6]: ['pass'], [L7]: ['length', 'length'], [L8]: ['pass'] } };
  const both = record([round1, round2]);
  assert.deepEqual(lineResults(both, { until: W1 }), [{ line: L6, result: 'fixed', kind: 'ending' }, { line: L7, result: 'clean' }, { line: L8, result: 'heard' }], '앞 판');
  assert.deepEqual(lineResults(both, { since: W1, until: W2 }), [{ line: L6, result: 'clean' }, { line: L7, result: 'todo', kind: 'length' }, { line: L8, result: 'clean' }], '이번 판');
  // 둘째 판 중간에 닫기: 첫 완주의 판은 그 뒤의 보임과 섞이지 않는다
  const half = record([round1, { at: T0 + 20000, lines: { [L6]: ['missing'] } }]);
  assert.deepEqual(lineResults(half, { until: W1 }), lineResults(both, { until: W1 }));
  // 앞 완주 뒤에 보이지 않은 줄은 이번 판에 없다(앞 판의 결과를 끌어오지 않는다)
  assert.deepEqual(lineResults(half, { since: W1, until: W2 }), [{ line: L6, result: 'todo', kind: 'missing' }]);
});

test('접힌 기록 · 다른 게임 · 빈 입력', () => {
  const events = record([{ at: T0, lines: { [L6]: ['pass'], [L7]: ['pass'] } }]);
  const folded = events.filter((e) => !(e.type === 'practice.presented' && e.itemKey === L6));
  assert.deepEqual(lineResults(folded), [{ line: L7, result: 'clean' }], '보임이 접힌 줄은 말하지 않는다');
  const other = events.map((e) => (e.type === 'decision.made' ? { ...e, experienceId: 'world-home' } : e));
  assert.deepEqual(lineResults(other), [], '다른 게임의 결정은 세지 않는다');
  assert.deepEqual(lineResults(null), []);
  assert.deepEqual(lineResults([{ type: 'practice.attempted' }]), []);
});

test('누가 무엇을 말하나: 칭찬은 fixed → clean(목표 줄) → heard, 남은 일은 코치 노트 차례', () => {
  assert.equal(GOAL, L7, '목표 줄');
  assert.deepEqual(NOTE_ORDER, ['ending', 'length', 'missing']);
  const r = (line, result, kind) => (kind ? { line, result, kind } : { line, result });
  assert.deepEqual(pickLines([r(L6, 'clean'), r(L7, 'fixed', 'length'), r(L8, 'fixed', 'ending')], { goal: GOAL }).praise, r(L7, 'fixed', 'length'), 'fixed는 대본 차례');
  assert.deepEqual(pickLines([r(L6, 'clean'), r(L7, 'clean'), r(L8, 'heard')], { goal: GOAL }).praise, r(L7, 'clean'), 'clean은 목표 줄 먼저');
  assert.deepEqual(pickLines([r(L6, 'clean'), r(L8, 'clean')], { goal: GOAL }).praise, r(L6, 'clean'), '목표 줄이 없으면 대본 차례');
  assert.deepEqual(pickLines([r(L6, 'heard'), r(L7, 'todo', 'ending')], { goal: GOAL }), { praise: r(L6, 'heard'), todo: r(L7, 'todo', 'ending') });
  assert.deepEqual(pickLines([r(L6, 'todo', 'missing'), r(L7, 'todo', 'length'), r(L8, 'todo', 'length')], { goal: GOAL }).todo, r(L7, 'todo', 'length'), '끝맺음 → 길이 → 빠진 말, 같으면 목표 줄');
  assert.deepEqual(pickLines([r(L6, 'todo', 'length'), r(L8, 'todo', 'length')], { goal: GOAL }).todo, r(L6, 'todo', 'length'), '같은 갈래 · 목표 줄 밖이면 대본 차례');
  assert.deepEqual(pickLines([], { goal: GOAL }), { praise: null, todo: null });
});

test('서울행 통로: 부모 창은 이 모듈만 읽고, 1화 묶음 · 공개 목록에 함께 실린다', async () => {
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(read('experiences/synk-world-app/seoul-entry.mjs'), /import \{lineResults\} from '\.\/drama-lines\.mjs';/);
  assert.match(read('experiences/drama/pilot/learning-entry.cjs'), /require\('\.\.\/\.\.\/synk-world-app\/drama-lines\.mjs'\)/);
  assert.match(read('experiences/drama/pilot/atlas-learning.js'), /function lineResults\(/, '1화 묶음을 다시 만들었다');
  assert.match(read('tools/build-world-app-public.mjs'), /'seoul-record\.mjs','drama-lines\.mjs'/);
  assert.match(read('experiences/synk-world-app/server.mjs'), /'\/drama-lines\.mjs'/);
  assert.match(read('experiences/seoul-arrival/qa/공개묶음.cjs'), /'drama-lines\.mjs'/);
  // 의존이 없는 모듈이다(부모 창이 1화 묶음 · Atlas를 따라 부르지 않는다)
  assert.doesNotMatch(read('experiences/synk-world-app/drama-lines.mjs'), /^\s*import\s/m);
});
