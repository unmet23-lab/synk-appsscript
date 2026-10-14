import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { SCENARIOS, MAX_SESSIONS, defaultPractice, practiceDetails } from '../domain.mjs';

// 실제 app.mjs의 계정 연결·화면 이동·작성 중 판단 코드를 그대로 잘라 vm에서 돌린다.
const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
function between(start, end) {
  const from = typeof start === 'string' ? source.indexOf(start) : source.search(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `app.mjs에서 ${start} ~ ${end} 구간을 찾지 못했어요.`);
  return source.slice(from, to);
}
const detailsSource = between('const details = ', 'const elementList');
const renderSource = between('function render(', 'function paintNav(');
const draftSource = between('function captureHomeDraft()', 'function setSaving(');
const accountSource = between(/notebook\s*=\s*createAccountNotebook\(/, 'void notebook.start();');

function fixture(scenario = 'interview') {
  const selectedPractice = defaultPractice(scenario), defaults = practiceDetails({ scenario, practice: selectedPractice });
  const setup = { elements: { ...Object.fromEntries(['counterpart', 'goal'].map(key => [key, { value: defaults[key] }])), realAt: { value: '' } } };
  let confirms = 0;
  const context = {
    SCENARIOS, MAX_SESSIONS, scenario, selectedPractice, practiceDetails, current: null, page: 'home', stage: 'answer', feedback: null, retryIndex: 0,
    homeDraft: null, sessions: [], imported: null, deletePending: false, followupId: null, bookReturn: 'home', voiceMs: 0, usedVoice: false,
    // 처음 화면 폼(#setup)은 처음 화면에만 그려진다.
    app: { innerHTML: '', querySelector: selector => selector === '#setup' && context.page === 'home' ? setup : null, querySelectorAll: () => [] },
    // home()은 보관한 입력(homeDraft)이 있으면 그 값을, 없으면 고른 연습의 기본값을 입력칸에 넣는다.
    PAGES: new Proxy({}, { get: (_target, name) => () => {
      if (name === 'home') { const d = practiceDetails({ scenario: context.scenario, practice: context.selectedPractice }); for (const key of ['counterpart', 'goal']) setup.elements[key].value = context.homeDraft?.[key] ?? d[key]; setup.elements.realAt.value = context.homeDraft?.realAt ?? ''; }
      return '';
    } }),
    imports: { invalidate() {} }, voice: { state: 'idle', dispose() {} },
    paintNav() {}, paintMic() {}, paintReplay() {}, syncFollowupFields() {}, paintAccount() {},
    document: { querySelector: () => null, body: { classList: { toggle() {} } }, documentElement: { dataset: {} } },
    window: { confirm: () => { confirms++; return false; }, scrollTo() {} },
    createAccountNotebook: options => ({ options }),
  };
  vm.createContext(context); vm.runInContext(detailsSource + renderSource + draftSource + accountSource, context);
  return { context, setup, navigate: () => context.notebook.options.beforeNavigate(), confirms: () => confirms };
}

for (const [field, value] of [['counterpart', '아직 시작하지 않은 counterpart'], ['goal', '아직 시작하지 않은 goal'], ['realAt', '2026-10-20']]) test(`account refresh asks before discarding the edited home ${field}`, () => {
  const f = fixture(); f.setup.elements[field].value = value;
  assert.equal(f.navigate(), false); assert.equal(f.confirms(), 1);
  assert.equal(f.setup.elements[field].value, value);
});

test('unchanged defaults allow account navigation without an unnecessary warning', () => {
  const f = fixture(); assert.equal(f.navigate(), true); assert.equal(f.confirms(), 0);
  // 기본값 그대로 작품집 탭을 열어도 보관할 입력이 없으니 묻지 않는다.
  f.context.navigate('book'); assert.equal(f.context.page, 'book'); assert.equal(f.context.homeDraft, null);
  assert.equal(f.navigate(), true); assert.equal(f.confirms(), 0);
});

test('the selected scenario is retained on account replacement and its defaults do not count as a draft', () => {
  const scenario = Object.keys(SCENARIOS).find(key => key !== 'interview'), f = fixture(scenario);
  assert.equal(f.navigate(), true); assert.equal(f.confirms(), 0);
  f.context.notebook.options.applyState({ sessions: [] }); assert.equal(f.context.scenario, scenario);
  assert.equal(f.navigate(), true); assert.equal(f.confirms(), 0);
});

for (const field of ['counterpart', 'goal']) test(`the same home ${field} remains protected while the growth book is open`, () => {
  const f = fixture(), typed = field === 'goal' ? '책을 닫고 이어 쓸 목표' : '책을 닫고 이어 쓸 상대';
  f.setup.elements[field].value = typed;
  f.context.navigate('book');
  assert.equal(f.context.page, 'book'); assert.equal(f.context.app.querySelector('#setup'), null);
  assert.equal(f.navigate(), false); assert.equal(f.confirms(), 1);
  assert.equal(f.context.homeDraft[field], typed);
  // 작품집을 닫고 처음 화면으로 돌아오면 같은 입력이 다시 칸에 들어가고, 계속 보호된다.
  f.context.navigate('home');
  assert.equal(f.context.page, 'home'); assert.equal(f.setup.elements[field].value, typed); assert.equal(f.context.homeDraft, null);
  assert.equal(f.navigate(), false); assert.equal(f.confirms(), 2);
});

test('approving the existing confirmation allows the requested account navigation', () => {
  const f = fixture(); f.setup.elements.goal.value = '이번 목표'; f.context.window.confirm = () => true;
  assert.equal(f.navigate(), true);
  f.context.navigate('book'); assert.equal(f.navigate(), true);
});

test('explicit practice choices survive account replacement without pretending they are saved personal input', () => {
  const f = fixture();
  f.context.selectedPractice = { counterpart: 'lead', goal: 'transition' };
  const defaults = practiceDetails({ scenario: 'interview', practice: f.context.selectedPractice });
  for (const key of ['counterpart', 'goal']) f.setup.elements[key].value = defaults[key];
  assert.equal(f.navigate(), true);
  f.context.notebook.options.applyState({ sessions: [] });
  assert.deepEqual(f.context.selectedPractice, { counterpart: 'lead', goal: 'transition' });
  for (const key of ['counterpart', 'goal']) assert.equal(f.setup.elements[key].value, defaults[key]);
  f.setup.elements.goal.value = '새 역할에 꼭 전할 나의 실제 준비';
  assert.equal(f.navigate(), false);
});
