'use strict';
const $ = id => document.getElementById(id);
// Each entry names only ability/difficulty/format cells its game really has (catalog.test.mjs):
// a cell no game can fill would stay "unseen" for ever and keep suggesting the same game.
const catalog = [
  { id: 'racing-reading', label: '읽기부터 짧게 확인하기', href: '/korean-racing/?learning=reading', skillIds: ['ko.reading.grammar','ko.reading.main'], difficulty: 1, modality: 'reading', responseFormat: 'single-choice' },
  { id: 'racing-listening', label: '들리는 뜻 따라 달리기', href: '/korean-racing/?learning=listening', skillIds: ['ko.listening.detail'], difficulty: 1, modality: 'listening', responseFormat: 'single-choice' },
  { id: 'order', label: '주문의 조건을 듣고 준비하기', href: '/order-rush/', skillIds: ['ko.listening.negation'], difficulty: 2, modality: 'listening', responseFormat: 'cup-compose' },
  { id: 'rhythm', label: '다른 목소리로 뜻 확인하기', href: '/korean-rhythm/', skillIds: ['ko.listening.detail','ko.listening.negation'], difficulty: 1, modality: 'listening', responseFormat: 'binary-choice' },
  { id: 'reading-entry-check', label: '안내문을 읽고 손님 입장 검사하기', href: '/entry-check/', skillIds: ['ko.reading.detail','ko.reading.negation','ko.reading.condition'], difficulty: 1, modality: 'reading', responseFormat: 'single-choice' },
  { id: 'reading-story-classroom', label: '이야기를 읽고 친구들과 교실 정리하기', href: '/story-classroom/?reading=1', skillIds: ['ko.reading.detail'], difficulty: 1, modality: 'reading', responseFormat: 'action' },
  { id: 'reading-blank-slice', label: '빈칸에 맞는 낱말 베기', href: '/blank-slice/', skillIds: ['ko.reading.vocabulary','ko.reading.grammar'], difficulty: 1, modality: 'reading', responseFormat: 'single-choice' },
];
let coach;
try { coach = SynkLearning.createGame({ gameId: 'learning-hub', storage: localStorage }); }
catch { $('reason').textContent = '기록을 연결하지 못했어요. 아래에서 원하는 게임을 골라 주세요.'; }
const labels = { checking: '새 표현으로 더 확인해요', practice: '다시 연습할 표현이 있어요', supported: '도움을 받으며 연습했어요', 'recent-independent': '최근 새 문항을 혼자 수행했어요', review: '다시 살펴볼 때예요' };
const formats = { 'single-choice': '보기 고르기', 'binary-choice': 'O/X 판단', 'cup-compose': '주문 조합', action: '행동 연습', unknown: '이전 연습' };
function render() {
  if (!coach) return;
  try {
    const plan = coach.recommend(catalog, { audioAvailable: $('audio').checked });
    $('recommend-title').textContent = plan.selected?.label || '원하는 게임을 골라 주세요';
    $('reason').textContent = plan.reason;
    $('start').href = plan.selected?.href || '/korean-racing/';
    const summary = coach.summary(), observed = summary.skills.filter(s => s.status !== 'unseen');
    $('empty').hidden = observed.length > 0; $('skills').replaceChildren();
    for (const skill of observed) {
      const li = document.createElement('li'), note = document.createElement('span'); li.textContent = skill.label;
      note.textContent = `${formats[skill.responseFormat] || '연습'} · ${labels[skill.status]}`; li.append(note); $('skills').append(li);
    }
    $('storage').textContent = summary.storage.warning || '이 브라우저에 저장돼요. 함께 쓰는 기기라면 다른 사람이 시작하기 전에 기록을 지워 주세요.';
  } catch { $('reason').textContent = '기록을 확인하지 못했어요. 아래의 기본 게임은 계속 이용할 수 있어요.'; }
}
// Today's condition (Atlas design §8-3): pressed only by the person, kept until the end of the day,
// never stored as a trait and never shown to anyone else. Games start gentler on a tired day.
const todayNotes = { good: '좋아요. 평소처럼 시작해요.', okay: '알겠어요. 평소처럼 시작해요.', tired: '알겠어요. 오늘은 게임이 더 어려워지지 않고, 힌트를 줄이자는 말도 하지 않아요.', no_time: '짧게 해도 괜찮아요. 멈추면 그때까지 기록돼요.' };
const todayDefault = '누르지 않아도 괜찮아요. 고르면 오늘 하루만 게임 시작 속도에 반영해요.';
function renderToday() {
  let value = null;
  try { value = coach?.today?.() ?? null; } catch { value = null; }
  document.querySelectorAll('[data-today]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.today === value)));
  $('today-note').textContent = value ? todayNotes[value] : todayDefault;
}
document.querySelectorAll('[data-today]').forEach(b => b.addEventListener('click', () => {
  if (!coach?.setToday) return;
  try { coach.setToday(coach.today() === b.dataset.today ? null : b.dataset.today); } catch { /* the choice is only for today */ }
  renderToday();
}));
// The help style (Core personalization vocabulary, Flow.declaredFrom): pressed only by the person,
// kept on this device until pressed again or the record is cleared, and every game's hint and
// help timing follows it. It is a choice, never a measure of ability.
const helpNotes = { step: '단계별로 도와 드릴게요. 게임마다 힌트와 도움이 가장 먼저 나와요. 다시 누르면 지워요.',
  choose: '그때그때 맞춰 드릴게요. 막히면 도움이 먼저 나오고, 도움을 줄이는 건 여쭤본 뒤에만 해요.',
  independent: '혼자 해 보시도록 힌트와 도움을 가장 늦게 보여 드려요. 틀려도 도움이 끼어들지 않아요. 다시 누르면 지워요.' };
const helpDefault = '고르지 않아도 괜찮아요. 고르면 이 기기에 기억해서 모든 게임의 힌트·도움 시점에 적용해요.';
function renderHelp() {
  let value = null;
  try { value = coach?.presentation?.()?.support ?? null; } catch { value = null; }
  document.querySelectorAll('[data-help]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.help === value)));
  $('help-note').textContent = value ? helpNotes[value] : helpDefault;
}
document.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => {
  if (!coach?.setPresentation) return;
  try { const current = coach.presentation()?.support ?? null; coach.setPresentation(current === b.dataset.help ? null : { support: b.dataset.help }); } catch { /* kept only where this browser can store it */ }
  renderHelp();
}));
$('audio').addEventListener('change', render);
$('reset').addEventListener('click', () => { if (window.confirm('이 브라우저에서 여러 게임이 함께 쓰는 학습 기록을 지울까요?')) { coach?.reset(); render(); renderToday(); renderHelp(); } });
const refreshAll = () => { render(); renderToday(); renderHelp(); };
addEventListener('pageshow', refreshAll); addEventListener('focus', refreshAll); addEventListener('storage', refreshAll); refreshAll();
