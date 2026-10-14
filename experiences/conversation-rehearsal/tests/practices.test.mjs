import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { PRACTICES, SCENARIOS, DIRECTIONS, defaultPractice, practiceDetails, createSession, getTurn, appendTurn, retryTurn, archive, parseArchive } from '../domain.mjs';
import { saveSessions, loadSaved } from '../storage.mjs';
import { bookContent } from '../book.mjs';
import { validatePersonalState } from '../../synk-account/src/personal-data.mjs';

function complete(scenario = 'request', practice = { counterpart: 'manager', goal: 'deadline' }, focus = 'pressure') {
  let session = createSession({ scenario, practice, counterpart: '내가 적은 상대', goal: '내가 직접 정한 목표', id: 'practice-test' });
  for (let i = 0; i < 3; i++) session = appendTurn(session, { answer: `내 답변 ${i}`, review: 'stuck', focus });
  return session;
}

test('all 28 explicit contexts (7 situations × 2 counterparts × 2 goals) complete each of three direction branches with usable hints and replayable prompts', () => {
  let paths = 0;
  for (const [scenario, options] of Object.entries(PRACTICES)) {
    for (const counterpart of Object.keys(options.counterparts)) for (const goal of Object.keys(options.goals)) {
      const practice = { counterpart, goal }, prompts = new Set();
      for (const focus of Object.keys(DIRECTIONS)) {
        const session = complete(scenario, practice, focus), restored = parseArchive(JSON.stringify(archive([session]))).sessions[0];
        assert.deepEqual(restored.practice, practice);
        const expected = options.goals[goal];
        for (let i = 0; i < 3; i++) {
          const turn = getTurn(restored, i);
          assert.ok(turn.prompt.includes(expected.turns[turn.id].prompt));
          assert.ok(turn.hint.includes(options.counterparts[counterpart].hint));
          assert.equal(turn.prompt, getTurn(session, i).prompt);
        }
        prompts.add(getTurn(session, 1).prompt); paths++;
      }
      assert.equal(prompts.size, 3);
    }
  }
  assert.equal(paths, 84);
});

test('counterpart changes authored reactions and goal changes the task; free text is never inferred', () => {
  const a = complete(), same = { ...a, counterpart: '면접관', goal: '이 문구를 보고 면접으로 바꾸지 않기' };
  assert.deepEqual(getTurn(a, 0), getTurn(same, 0));
  assert.deepEqual(getTurn(a, 1), getTurn(same, 1));
  const colleague = complete('request', { counterpart: 'colleague', goal: 'deadline' });
  assert.notEqual(getTurn(a, 0).prompt, getTurn(colleague, 0).prompt);
  assert.notEqual(getTurn(a, 1).prompt, getTurn(colleague, 1).prompt);
  const help = complete('request', { counterpart: 'manager', goal: 'help' });
  for (let i = 0; i < 3; i++) assert.notEqual(getTurn(a, i).prompt, getTurn(help, i).prompt);
  assert.notEqual(practiceDetails(a).check, practiceDetails(help).check);
});

test('schema 1 legacy records retain their original dialogue; new contexts survive device, JSON and account validation', () => {
  const legacy = complete('request', undefined);
  // Explicitly build a record predating authored context choices.
  delete legacy.practice;
  assert.equal(getTurn(legacy, 1).prompt, SCENARIOS.request.turns.pressure.prompt);
  const modern = complete(); modern.id = 'modern';
  const data = archive([legacy, modern]);
  assert.deepEqual(validatePersonalState('rehearsal', data), data);
  const storage = new Map(), adapter = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  assert.equal(saveSessions(adapter, data.sessions).ok, true);
  const restored = loadSaved(adapter).sessions;
  assert.equal(Object.hasOwn(restored[0], 'practice'), false);
  assert.deepEqual(restored[1].practice, modern.practice);
  assert.equal(getTurn(restored[1], 1).prompt, getTurn(modern, 1).prompt);
});

test('foreign, missing, extra and prototype context keys are rejected before archive/account import', () => {
  for (const practice of [null, [], {}, { counterpart: 'manager' }, { counterpart: 'lead', goal: 'deadline' }, { counterpart: 'manager', goal: 'transition' }, { counterpart: 'manager', goal: 'deadline', inferred: true }, JSON.parse('{"counterpart":"manager","goal":"deadline","__proto__":{}}')]) {
    assert.throws(() => createSession({ scenario: 'request', counterpart: '상대', goal: '목표', practice }));
    const data = archive([complete()]); data.sessions[0].practice = practice;
    assert.throws(() => parseArchive(JSON.stringify(data)));
    assert.throws(() => validatePersonalState('rehearsal', data));
  }
});

test('retry and growth book preserve the chosen scene and original answer across export/import', () => {
  const original = complete(), retried = retryTurn(original, 1, '마감이 고정이면 우선순위를 상의하고 싶어요.', 'easy');
  const restored = parseArchive(JSON.stringify(archive([retried]))).sessions[0], html = bookContent([restored]);
  assert.equal(restored.turns[1].answer, original.turns[1].answer);
  assert.deepEqual(restored.practice, original.practice);
  assert.ok(html.includes(practiceDetails(original).label));
  for (let i = 0; i < 3; i++) assert.ok(html.includes(getTurn(original, i).prompt));
  assert.ok(html.includes(retried.turns[1].retry));
  assert.ok(!html.includes(SCENARIOS.request.turns.pressure.prompt));
});

// 새 처음 화면은 상황·상대·목표를 data-scenario·data-counterpart·data-goal 단추(aria-pressed)로 고른다. 실제 app.mjs의 클릭 처리 코드를 그대로 잘라 돌린다.
const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
function between(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `app.mjs에서 ${start} ~ ${end} 구간을 찾지 못했어요.`);
  return source.slice(from, to);
}
const detailsSource = between('const details = ', 'const elementList');
const clickSource = between("document.addEventListener('click', async", 'function paintTheme()');
function setupFixture() {
  const scenario = 'interview', selectedPractice = defaultPractice(scenario), initial = practiceDetails({ scenario, practice: selectedPractice });
  const setup = { elements: Object.fromEntries(['counterpart', 'goal'].map(key => [key, { value: initial[key] }])) };
  const scenarioButtons = Object.keys(SCENARIOS).map(id => ({ dataset: { scenario: id }, pressed: String(id === scenario), setAttribute(name, value) { if (name === 'aria-pressed') this.pressed = value; } }));
  const choices = { innerHTML: '' };
  let click;
  const c = {
    scenario, selectedPractice, practiceDetails, defaultPractice, error: message => { throw new Error(message); },
    practiceChoices: () => JSON.stringify(c.selectedPractice),
    app: { querySelector: selector => selector === '#setup' ? setup : selector === '#practice-choices' ? choices : null, querySelectorAll: selector => selector === '[data-scenario]' ? scenarioButtons : [] },
    document: { addEventListener: (_name, callback) => { click = callback; } },
  };
  vm.createContext(c); vm.runInContext(detailsSource + clickSource, c);
  const press = (key, value) => click({ target: { closest: selector => selector === '[data-nav]' ? null : { tagName: 'BUTTON', dataset: { [key]: value } } } });
  return { c, setup, choices, scenarioButtons, change: (name, value) => press({ counterpartKind: 'counterpart', goalKind: 'goal', scenario: 'scenario' }[name], value) };
}
test('changing authored choices updates suggested notes but preserves personal text, including a scenario change', async () => {
  const f = setupFixture();
  await f.change('counterpartKind', 'lead');
  assert.equal(f.setup.elements.counterpart.value, '실무 팀장');
  assert.deepEqual(JSON.parse(f.choices.innerHTML), { counterpart: 'lead', goal: defaultPractice('interview').goal });
  await f.change('goalKind', 'transition');
  assert.equal(f.setup.elements.goal.value, PRACTICES.interview.goals.transition.goal);
  assert.deepEqual(JSON.parse(f.choices.innerHTML), { counterpart: 'lead', goal: 'transition' });
  f.setup.elements.counterpart.value = '내가 만나기로 한 상대'; f.setup.elements.goal.value = '직접 작성 중인 목표';
  await f.change('goalKind', 'experience'); await f.change('scenario', 'request');
  assert.equal(f.setup.elements.counterpart.value, '내가 만나기로 한 상대');
  assert.equal(f.setup.elements.goal.value, '직접 작성 중인 목표');
  assert.equal(f.c.scenario, 'request');
  assert.deepEqual(JSON.parse(JSON.stringify(f.c.selectedPractice)), defaultPractice('request'));
  assert.deepEqual(JSON.parse(f.choices.innerHTML), defaultPractice('request'));
  assert.deepEqual(f.scenarioButtons.filter(button => button.pressed === 'true').map(button => button.dataset.scenario), ['request']);
});
