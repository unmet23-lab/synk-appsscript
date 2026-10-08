// SYNK Atlas lab: the real engine (the shared game bundle) on three kinds of content.
// Nothing here is a second engine: Flow, TemperFlow, VellumFlow and Ask come from atlas/.
import { FLOW_RUSH, LEVEL_WORDS } from '/order-rush/learning.mjs';
import { FLOW_RHYTHM } from '/korean-rhythm/personalization.mjs';
import { createComputerConsultation } from './consultation.mjs';
import { createComputerInterpretation } from './interpretation.mjs';
import { createComputerModelHost } from './model-host.mjs';
import { mountMatchingLab } from './matching-ui.mjs';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value; else if (key === 'text') node.textContent = value; else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
};
const ready = () => new Promise(resolve => {
  const check = () => (globalThis.SynkLearning?.Flow && globalThis.SynkComputerRules && globalThis.SynkComputerContent && globalThis.SynkAtlasInterpretation && globalThis.SynkTemperOutcomes ? resolve() : setTimeout(check, 30));
  check();
});
await ready();
const { Flow, TemperFlow, VellumFlow, Ask } = globalThis.SynkLearning;

// ---------- ① Seven people, one content ----------
const READING = { id: 'atlas-lab.reading', version: 1, target: 0.75, items: { levels: [1, 2, 3], weight: 2 }, knobs: [
  { id: 'choices', kind: 'content', label: '보기 수', values: [2, 3, 4], start: 1 },
  { id: 'hint', kind: 'support', label: '힌트', values: ['먼저 보여 줌', '보통', '늦게 보여 줌'], start: 1 }] };
const CONTENTS = { cafe: FLOW_RUSH, rhythm: FLOW_RHYTHM, reading: READING };
const ITEM_WORDS = { cafe: LEVEL_WORDS, reading: { 1: '쉬운 문항', 2: '보통 문항', 3: '어려운 문항' } };
function settingWords(key, spec, values) {
  return spec.knobs.map(knob => {
    const value = values[knob.id];
    if (knob.id === Flow.ITEM) return `${ITEM_WORDS[key]?.[value] ?? `난도 ${value}`}`;
    if (knob.id === 'window') return `판정 폭 ×${value}`;
    if (knob.id === 'queueMax') return `대기 ${value}명`;
    if (key === 'cafe') return `${knob.label} ${value}초`;
    return `${knob.label} ${value}${knob.id === 'choices' ? '개' : ''}`;
  }).join(' · ');
}
function chart(adapted, fixed, target) {
  const w = 300, h = 120, pad = 6, x = i => pad + i * (w - pad * 2) / (adapted.length - 1), y = v => h - pad - v * (h - pad * 2);
  const line = values => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="성공 정도 변화"><rect x="${pad}" y="${y(Math.min(1, target + 0.15))}" width="${w - pad * 2}" height="${y(target - 0.15) - y(Math.min(1, target + 0.15))}" class="band"/>`
    + `<line x1="${pad}" x2="${w - pad}" y1="${y(target)}" y2="${y(target)}" class="aim"/><path d="${line(fixed)}" class="fixed"/><path d="${line(adapted)}" class="adapted"/></svg>`;
  const box = el('div', { class: 'chart' }); box.innerHTML = svg; return box;
}
function renderPeople(key) {
  const spec = Flow.defineContent(CONTENTS[key]);
  const report = TemperFlow.simulate({ spec, steps: 60, seed: `lab-${key}` });
  $('people').replaceChildren(...report.personas.map(p => el('article', { class: 'person' },
    el('h3', { text: p.label }), chart(p.path, p.fixedPath, report.target),
    el('p', { class: 'score' }, el('span', { class: 'adapted', text: `맞춤 ${Math.round(p.adapted.inBand * 100)}%` }), el('span', { class: 'fixed', text: `정해진 구성 ${Math.round(p.fixed.inBand * 100)}%` })),
    el('p', { class: 'mini', text: `끝난 설정 · ${settingWords(key, spec, p.final)}` }),
    // Honest limits: when even the easiest settings stay too hard, the content itself must change.
    p.adapted.floorTooHard >= 10 && p.adapted.inBand < 0.5 ? el('p', { class: 'floor', text: '가장 쉬운 설정도 아직 어려워요. 더 쉬운 연습을 권할 자리예요.' })
      : Math.abs(p.adapted.inBand - p.fixed.inBand) <= 0.15 && p.fixed.inBand >= 0.8 ? el('p', { class: 'mini', text: '처음 구성이 이미 잘 맞는 사람이에요. 맞춤도 그 근처에 머물러요.' }) : null)));
}
document.querySelectorAll('[data-content]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-content]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  renderPeople(button.dataset.content);
}));
renderPeople('cafe');

// ---------- ② Try it: pick the bigger number ----------
const NUMBERS = Flow.defineContent({ id: 'atlas-lab.numbers', version: 2, target: 0.75, items: { levels: [1, 2, 3], weight: 2 }, knobs: [
  { id: 'choices', kind: 'content', label: '고를 수', values: [2, 3, 4], start: 0 },
  { id: 'seconds', kind: 'pace', label: '제한 시간', values: [8, 6.5, 5, 4, 3.2, 2.6], start: 2 },
  { id: 'hint', kind: 'support', label: '힌트', values: ['바로 보여 줌', '절반 지나면', '보여 주지 않음'], start: 1 }] });
const WORDS = { 'raise.pace': '조금 더 빠르게 해 볼게요.', 'raise.content': '조금 더 헷갈리는 수도 섞을게요.', 'ease.pace': '시간을 조금 더 드릴게요.', 'ease.content': '조금 더 쉬운 수로 갈게요.', 'ease.support': '힌트를 조금 더 일찍 보여 드릴게요.' };
const LEVEL_TEXT = { 1: '차이가 큰 수', 2: '차이가 보통인 수', 3: '세 자리, 차이가 작은 수' };
// When the hint (compare the first digits) appears, as a share of the time limit.
const HINT_AFTER = { '바로 보여 줌': 0, '절반 지나면': 0.5, '보여 주지 않음': Infinity };
let run = null, round = 0, current = null, timer = null, started = 0;
// Knobs held by the help style the person chose (Core personalization vocabulary, Flow.declaredFrom).
let chosen = { knobs: {} };
const random = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
function numbers(level, count) {
  const out = new Set();
  const base = level === 3 ? random(120, 980) : random(10, 90);
  const spread = level === 1 ? [18, 60] : level === 2 ? [4, 14] : [1, 8];
  out.add(base);
  while (out.size < count) {
    const step = random(spread[0], spread[1]) * (Math.random() < 0.5 ? -1 : 1);
    const value = [...out][Math.floor(Math.random() * out.size)] + step;
    if (value > 0 && value < (level === 3 ? 1000 : 100)) out.add(value);
  }
  return [...out].sort(() => Math.random() - 0.5);
}
function showEngine() {
  const s = run.settings();
  $('knobs').replaceChildren(...NUMBERS.knobs.map(knob => {
    const value = s.values[knob.id], text = knob.id === Flow.ITEM ? LEVEL_TEXT[value] : knob.id === 'seconds' ? `${value}초` : knob.id === 'hint' ? value : `${value}개`;
    const held = Object.hasOwn(chosen.knobs, knob.id) ? ' · 고른 대로' : '';
    return el('div', {}, el('dt', { text: knob.id === Flow.ITEM ? '숫자 차이' : knob.label }), el('dd', { text: text + held }));
  }));
  // The aim is the content's; the expectation is the engine's current estimate, not a score.
  $('target').textContent = s.adaptive ? `${Math.round(NUMBERS.target * 100)}%` : '맞추지 않음';
  $('expected').textContent = `${Math.round(s.expected * 100)}%`;
}
function nextRound() {
  clearInterval(timer);
  if (round >= 10) {
    $('tiles').replaceChildren(); $('timer-fill').style.transform = 'scaleX(0)';
    const changes = run.changes().filter(c => c.phase === 'response').length;
    const held = Object.hasOwn(chosen.knobs, 'hint') ? ' 힌트는 고른 도움 방식대로 두었어요.' : '';
    $('try-line').textContent = run.settings().adaptive ? `열 번 중 ${changes}번 설정을 바꿨어요.${held} 다시 하면 처음부터 맞춰요.` : `정해진 설정으로 열 번 답했어요. 설정은 그대로였어요.${held}`;
    $('try-start').hidden = false; return;
  }
  round += 1;
  const s = run.settings(), level = s.level, count = s.values.choices, seconds = s.values.seconds, hintAfter = HINT_AFTER[s.values.hint];
  const set = numbers(level, count), answer = Math.max(...set);
  current = { answer, seconds, level, done: false, hinted: false };
  $('tiles').classList.remove('hinted');
  $('tiles').replaceChildren(...set.map(value => {
    const digits = String(value);
    const b = el('button', { type: 'button', class: 'tile' }, el('b', { class: 'lead-digit', text: digits[0] }), digits.slice(1));
    b.addEventListener('click', () => respond(value === answer ? 'success' : 'fail', b));
    return b;
  }));
  // The hint is on screen before the answer, so that answer counts as helped (Flow `assisted`).
  const showHint = () => {
    if (current.hinted || current.done) return;
    current.hinted = true; $('tiles').classList.add('hinted'); $('try-line').textContent = '앞자리부터 비교해 보세요.';
  };
  if (hintAfter === 0) showHint();
  started = performance.now();
  timer = setInterval(() => {
    const used = (performance.now() - started) / 1000 / seconds;
    $('timer-fill').style.transform = `scaleX(${Math.max(0, 1 - used)})`;
    if (used >= hintAfter) showHint();
    if (used >= 1) respond('timeout');
  }, 50);
}
function respond(outcome, button = null) {
  if (!current || current.done) return;
  current.done = true; clearInterval(timer);
  const pressure = Math.min(1, (performance.now() - started) / 1000 / current.seconds);
  if (button) button.classList.add(outcome === 'success' ? 'right' : 'wrong');
  const out = run.observe({ outcome, pressure, level: current.level, assisted: current.hinted, latencyMs: Math.round(performance.now() - started) });
  const line = out.change ? VellumFlow.line(out.change, { words: WORDS }) : null;
  $('try-line').textContent = line ? line.text : outcome === 'success' ? '맞아요.' : outcome === 'timeout' ? '시간이 지났어요.' : '아쉬워요. 더 큰 수가 있었어요.';
  $('history').prepend(el('li', { class: outcome, text: `${round}. ${outcome === 'success' ? '맞힘' : outcome === 'timeout' ? '시간 지남' : '틀림'}${out.change ? ` → ${out.change.direction > 0 ? '올림' : '내림'}: ${out.change.knob === Flow.ITEM ? '숫자 차이' : NUMBERS.knobs.find(k => k.id === out.change.knob).label}` : ''}` }));
  showEngine();
  setTimeout(nextRound, 650);
}
$('try-start').addEventListener('click', () => {
  // The chosen help style holds the hint knob; everything else still follows the answers.
  chosen = Flow.declaredFrom(NUMBERS, { support: $('try-support').value });
  run = Flow.start({ spec: NUMBERS, now: new Date().toISOString(), declared: $('try-fixed').checked ? { ...chosen, mode: 'fixed' } : chosen });
  round = 0; $('history').replaceChildren(); $('try-start').hidden = true; showEngine(); nextRound();
});
run = Flow.start({ spec: NUMBERS, now: new Date().toISOString() }); showEngine();

// ---------- ③ Consultation: ask when a better-informed decision has value ----------
const C = globalThis.SynkComputerContent, R = globalThis.SynkComputerRules;
const consultation = createComputerConsultation({ Ask, content: C, rules: R });
const interpretation = createComputerInterpretation({ Interpretation: globalThis.SynkAtlasInterpretation, content: C });
const modelHost = createComputerModelHost({ disabled: document.querySelector('[data-model-host]')?.dataset.modelHost === 'disabled' });
const usesStep = C.steps.find(step => step.id === 'uses');
let answers = { uses: [] };
let extractionMs = null, interpretationError = '';
let aiPending = null, aiRetry = null, aiGeneration = 0, aiNotice = '', modelOrigin = null;
let privacyPending = false, privacyNotice = '';
function cancelAI(message = '', preserveRetry = false) {
  aiGeneration += 1;
  aiPending?.abort(); aiPending = null;
  if (!preserveRetry) aiRetry = null;
  aiNotice = message;
}
function syncConsultation() {
  const state = interpretation.snapshot(); answers = state.answers;
  for (const button of $('uses').querySelectorAll('[data-use]')) button.setAttribute('aria-pressed', String(answers.uses.includes(button.dataset.use)));
  renderInterpretation(state); renderConsult();
}
function applyManual(about, value) { cancelAI(aiPending ? '직접 고른 답이 바뀌어 이전 AI 응답을 반영하지 않아요.' : ''); interpretation.setManual(about, value); syncConsultation(); }
function reviewProposal(id, action, value) {
  cancelAI(aiPending ? '확인 내용이 바뀌어 이전 AI 응답을 반영하지 않아요.' : '');
  try { interpretation.review(id, action, value); interpretationError = ''; }
  catch { interpretationError = '이 제안을 반영하지 못했어요. 원문을 다시 정리하거나 아래에서 직접 골라 주세요.'; }
  syncConsultation();
}
function renderInterpretation(state) {
  $('interpret-extract').disabled = !state.text.trim(); $('interpret-clear').disabled = !state.text;
  $('interpret-extract').textContent = '이 기기에서 정리';
  const host = modelHost.state();
  $('interpret-ai').disabled = !host.available || !state.text.trim() || !!aiPending || privacyPending;
  $('interpret-ai').textContent = aiRetry && !aiPending ? 'AI 다시 시도' : 'AI로 정리';
  $('interpret-cancel').hidden = !aiPending;
  document.querySelector('.interpret-input').setAttribute('aria-busy', String(!!aiPending));
  const sessionMissing = ['session-required', 'admin-required', 'unauthorized', 'forbidden'].includes(host.reason);
  $('model-host-status').textContent = host.state === 'disabled' ? '공유판은 이 기기에서만 정리해요. AI 호스트에 연결하지 않아요.'
    : host.state === 'checking' || host.state === 'idle' ? 'AI 연결을 확인하고 있어요.'
    : host.available ? `AI 연결: ${host.providerLabel} · ${host.modelLabel}`
    : sessionMissing ? 'AI 정리는 승인된 관리자 로그인에서 사용할 수 있어요. 로그인한 뒤 새로고침해 주세요.' : 'AI 호스트에 연결되지 않았어요. 이 기기에서 정리하거나 아래에서 직접 골라 주세요.';
  $('model-host-disclosure').textContent = host.state === 'disabled' ? '이 공유판에서는 원문을 외부로 보내지 않아요.'
    : `‘AI로 정리’를 누르면 입력한 원문을 ${host.available ? host.providerLabel : '연결된 AI 제공자'}에게 보내요. 원문 인용이 담긴 응답은 서버에 암호화해 최대 24시간 보관해요. AI 제안도 직접 확인한 뒤에만 추천에 반영돼요.`;
  const privacy = modelHost.privacyState();
  $('model-privacy').hidden = host.state === 'disabled';
  $('interpret-delete-server').disabled = !privacy.canDelete || privacyPending;
  $('interpret-delete-server').textContent = privacyPending ? '서버 응답을 지우고 있어요' : '서버에 보관된 내 AI 응답 지우기';
  $('model-privacy').setAttribute('aria-busy', String(privacyPending));
  $('model-privacy-status').textContent = privacyPending ? '서버 응답 삭제를 확인하고 있어요.' : privacyNotice || (privacy.canDelete
    ? `내 서버 응답 ${privacy.storedResponses}개 · 처리 중 ${privacy.pendingResponses}개. 인용 응답은 최대 ${privacy.retentionHours}시간 뒤 만료돼요.`
    : privacy.state === 'idle' ? '서버의 AI 응답 보관 상태를 확인하고 있어요.'
    : privacy.reason === 'session-required' ? '내 서버 응답을 지우려면 회사 계정으로 로그인한 뒤 새로고침해 주세요. 관리자 권한이나 AI 활성 설정은 필요하지 않아요.'
    : '서버 응답 보관 상태를 확인하지 못했어요. 연결 상태를 확인한 뒤 새로고침해 주세요.');
  const reviewed = state.proposals.filter(proposal => ['confirm', 'correct'].includes(proposal.review?.action)).length;
  $('interpret-status').textContent = aiPending ? 'AI가 원문을 정리하고 있어요. 현재 확인한 답은 그대로 유지해요.' : interpretationError || aiNotice || (state.mode
    ? `${modelOrigin ? 'AI 제안' : '이 기기에서 정리한 제안'} ${state.proposals.length}개 중 ${reviewed}개를 확인·수정했어요. ${state.held.length}개 문장은 보류했어요. 직접 고른 답이 우선해요.`
    : '정리한 제안은 항목별로 확인하거나 수정한 뒤에만 추천에 반영돼요.');
  $('interpret-proposals').replaceChildren(...state.proposals.map(proposal => {
    const field = interpretation.catalog.fields.find(item => item.id === proposal.field);
    const display = value => field.options.find(option => option.id === value)?.label || String(value);
    const effective = state.understanding.fields.find(item => item.id === field.id);
    const active = !!proposal.review && effective.evidence.includes(`i.${proposal.review.id}`) && effective.usable;
    const manual = Object.hasOwn(state.manual, field.id) || Object.hasOwn(state.manual, field.about);
    const card = el('article', { class: 'interpret-proposal', 'data-proposal': proposal.id, 'data-field': field.id },
      el('h3', { text: field.label }), ...proposal.evidence.map(evidence => el('blockquote', { text: evidence.quote })),
      el('p', { class: 'proposal-value', text: `제안: ${display(proposal.value)}` }));
    const status = manual ? '직접 고른 답이 우선 적용돼요.' : active ? (proposal.review.action === 'correct' ? `수정해서 반영: ${display(effective.value)}` : '확인해서 반영했어요.')
      : ['reject', 'withdraw'].includes(proposal.review?.action) ? '추천에서 제외했어요.'
      : proposal.status === 'conflict' ? '서로 다른 제안이 있어요. 현재 값을 직접 골라 수정해 주세요.'
      : proposal.status === 'blocked' ? '현재 내 조건인지 확인이 필요해요. 직접 선택해 주세요.' : '아직 추천에 반영하지 않았어요.';
    card.append(el('p', { class: 'mini', text: status }));
    const actions = el('div', { class: 'interpret-actions' });
    if (active) {
      const withdraw = el('button', { type: 'button', class: 'slab', text: '확인 취소', 'aria-label': `${field.label} 확인 취소` });
      withdraw.addEventListener('click', () => reviewProposal(proposal.id, 'withdraw')); actions.append(withdraw);
    } else {
      const confirm = el('button', { type: 'button', class: 'slab', text: '확인', 'aria-label': `${field.label} 확인` });
      confirm.disabled = proposal.status !== 'pending';
      confirm.addEventListener('click', () => reviewProposal(proposal.id, 'confirm')); actions.append(confirm);
    }
    const correct = el('button', { type: 'button', class: 'slab', text: '수정', 'aria-label': `${field.label} 수정` });
    correct.disabled = proposal.reasons.some(reason => ['other-subject', 'source-excluded', 'source-expired', 'future-source'].includes(reason));
    const reject = el('button', { type: 'button', class: 'slab', text: '제외', 'aria-label': `${field.label} 제외` });
    reject.addEventListener('click', () => reviewProposal(proposal.id, active ? 'withdraw' : 'reject'));
    actions.append(correct, reject); card.append(actions);
    const select = el('select', { 'aria-label': `${field.label} 수정할 값` }, ...field.options.map((option, index) => el('option', { value: String(index), text: option.label })));
    select.value = String(field.options.findIndex(option => option.id === (active ? effective.value : proposal.value)));
    const apply = el('button', { type: 'button', class: 'slab', text: '수정한 값으로 반영' });
    const correction = el('div', { class: 'interpret-correction' }, select, apply); correction.hidden = true;
    correct.addEventListener('click', () => { correction.hidden = !correction.hidden; if (!correction.hidden) select.focus(); });
    apply.addEventListener('click', () => reviewProposal(proposal.id, 'correct', field.options[Number(select.value)].id));
    card.append(correction); return card;
  }));
  $('interpret-held').replaceChildren(...state.held.map(item => el('p', { class: 'mini', text: `보류: “${item.quote}” — ${item.reason}` })));
}
$('consult-text').addEventListener('input', event => {
  cancelAI(aiPending ? '원문이 바뀌어 이전 AI 응답을 반영하지 않아요.' : ''); modelOrigin = null;
  interpretation.setText(event.target.value); interpretationError = ''; extractionMs = null; syncConsultation();
});
$('interpret-extract').addEventListener('click', () => {
  cancelAI();
  const start = performance.now();
  try { interpretation.analyze(); interpretationError = ''; extractionMs = performance.now() - start; modelOrigin = null; }
  catch { interpretationError = '지금은 조건을 정리하지 못했어요. 아래에서 직접 골라 주세요.'; }
  syncConsultation();
});
$('interpret-clear').addEventListener('click', () => {
  cancelAI(aiPending ? '원문을 지워 이전 AI 응답을 반영하지 않아요.' : ''); modelOrigin = null;
  $('consult-text').value = ''; interpretation.clearText(); interpretationError = ''; extractionMs = null; syncConsultation();
});
$('interpret-ai').addEventListener('click', async () => {
  if (aiPending || privacyPending || !modelHost.state().available || !interpretation.snapshot().text.trim()) return;
  const current = interpretation.snapshot();
  try {
    if (!aiRetry || aiRetry.revision !== current.revision || aiRetry.text !== current.text) aiRetry = modelHost.prepare(interpretation.buildExtractionRequest());
  } catch { interpretationError = 'AI 요청을 준비하지 못했어요. 이 기기에서 정리하거나 아래에서 직접 골라 주세요.'; syncConsultation(); return; }
  const controller = new AbortController(), generation = ++aiGeneration;
  aiPending = controller; interpretationError = ''; aiNotice = ''; syncConsultation();
  try {
    const response = await modelHost.extract(aiRetry, { signal: controller.signal });
    if (generation !== aiGeneration || controller.signal.aborted) return;
    interpretation.ingest(response); modelOrigin = modelHost.state(); extractionMs = null; aiRetry = null;
    privacyNotice = ''; modelHost.refreshPrivacy().then(() => syncConsultation());
  } catch (error) {
    if (generation !== aiGeneration) return;
    if (error.code === 'response-removed') aiRetry = null;
    interpretationError = error.code === 'response-removed' ? '이전 서버 응답이 삭제되거나 만료됐어요. 기존 확인은 유지했어요. ‘AI로 정리’를 다시 누르면 새 요청으로 비용이 생길 수 있어요.'
      : error.code === 'timeout' ? 'AI 응답을 기다리는 시간이 지났어요. 기존 확인은 유지했어요. 원하면 다시 시도해 주세요.'
      : error.code === 'session-required' ? 'AI 연결의 로그인 권한을 확인하지 못했어요. 기존 확인은 유지했어요.'
      : 'AI 응답을 반영하지 못했어요. 기존 확인은 유지했어요. 다시 시도하거나 이 기기에서 정리해 주세요.';
  } finally { if (generation === aiGeneration) { aiPending = null; syncConsultation(); } }
});
$('interpret-cancel').addEventListener('click', () => {
  cancelAI('응답 기다리기를 취소했어요. 이미 전송한 요청은 서버에서 처리될 수 있어요.', true); syncConsultation();
});
$('interpret-delete-server').addEventListener('click', async () => {
  if (privacyPending || !modelHost.privacyState().canDelete) return;
  cancelAI('서버 응답 삭제를 요청해 이전 AI 응답을 더 이상 반영하지 않아요.');
  privacyPending = true; privacyNotice = ''; interpretationError = ''; syncConsultation();
  try {
    const result = await modelHost.deleteResponses();
    privacyNotice = `서버에 보관된 내 AI 응답 ${result.deletedResponses}개를 지웠어요.${result.cancelledPendingResponses ? ` 처리 중 ${result.cancelledPendingResponses}개 응답도 보관하지 않아요.` : ''} 이 화면의 원문·확인한 답과 서버의 비용·중복 요청 방지 기록은 남아요.`;
  } catch (error) {
    privacyNotice = error.code === 'session-required' ? '로그인 권한을 확인하지 못해 삭제 완료를 확인할 수 없어요. 다시 로그인해 주세요.'
      : '서버 응답 삭제를 확인하지 못했어요. 지워졌다고 처리하지 않았어요. 연결을 확인한 뒤 다시 눌러 주세요.';
  } finally { privacyPending = false; syncConsultation(); }
});
function renderRequiredReview(completion, qs) {
  const pending = completion.unresolvedRequiredFields.filter(id => !['uses', 'budget'].includes(id));
  $('required-review').hidden = completion.status === 'not-started' || !pending.length;
  const previous = $('required-field').value;
  $('required-field').replaceChildren(...pending.map(id => el('option', { value: id, text: qs.find(q => q.id === id).title })));
  if (pending.includes(previous)) $('required-field').value = previous;
  const renderOptions = () => {
    $('required-options').replaceChildren();
    const q = qs.find(item => item.id === $('required-field').value);
    if (!q) return;
    const multiple = q.selection === 'multiple';
    const selected = new Set(multiple && Array.isArray(answers[q.about]) ? answers[q.about] : []);
    const confirm = multiple ? el('button', { type: 'button', class: 'slab', text: '선택한 작업으로 확인', 'data-required-confirm': '' }) : null;
    if (confirm) confirm.disabled = !selected.size;
    for (const option of q.displayOptions || q.options) {
      const b = el('button', { type: 'button', class: 'slab', text: option.label, 'data-required-answer': option.id,
        'aria-pressed': String(multiple ? selected.has(option.id) : answers[q.about] === option.id) });
      b.addEventListener('click', () => {
        if (multiple) {
          if (selected.has(option.id)) selected.delete(option.id); else selected.add(option.id);
          b.setAttribute('aria-pressed', String(selected.has(option.id))); confirm.disabled = !selected.size;
        } else applyManual(q.about, option.value ?? option.id);
      });
      $('required-options').append(b);
    }
    if (confirm) {
      confirm.addEventListener('click', () => {
        if (selected.size) applyManual(q.about, q.displayOptions.filter(option => selected.has(option.id)).map(option => option.id));
      });
      $('required-options').append(confirm);
    }
  };
  $('required-field').onchange = renderOptions;
  renderOptions();
}
function renderConsult() {
  const flat = { ...answers }, result = consultation.choose(flat), qs = result.questions;
  const completion = result.completion;
  const r = consultation.compute(flat);
  $('advice').textContent = answers.uses.length ? r.headline.title : '하고 싶은 일을 고르면 추천이 나와요.';
  $('advice-sub').textContent = answers.uses.length ? consultation.summary(r) : '';
  $('completion-status').textContent = completion.status === 'not-started' ? '' : completion.status === 'ready' ? '필수 확인 완료' : '임시 사양 안내';
  $('completion-status').dataset.status = completion.status;
  $('completion-details').textContent = completion.status === 'not-started' ? '' : completion.status === 'ready'
    ? '사양 안내에 필요한 기본 조건을 확인했어요. 위의 주의사항과 아래 가정도 함께 확인해 주세요.'
    : `더 확인할 항목: ${completion.fields.filter(field => completion.unresolvedRequiredFields.includes(field.id)).map(field => field.title).join(' · ')}. 아래에서 직접 답할 수 있어요.`;
  $('completion-assumptions').textContent = completion.assumptions.map(item => item.text).join(' ');
  renderRequiredReview(completion, qs);
  const budgetKnown = completion.budget.state === 'known';
  $('advice-scope').textContent = !answers.uses.length ? '' : budgetKnown
    ? '선택한 예산 구간으로 확인한 사양 안내예요. 실제 판매 가격과 구입 조건은 별도로 확인해 주세요.'
    : completion.path === 'reuse' ? '지금 컴퓨터를 계속 쓰거나 상태를 점검하는 안내에는 구매 예산이 필요하지 않아요.'
      : '예산 미확인 · 현재 추천은 사양 안내예요. 구입을 검토할 때는 예산을 먼저 알려 주세요.';
  $('budget-review').hidden = !answers.uses.length;
  $('budget-status').textContent = budgetKnown ? '선택한 예산을 바꿀 수도 있어요.' : '예산을 알게 되면 여기서 직접 확인하거나 바꿀 수 있어요.';
  $('budget-options').replaceChildren(...C.steps.find(step => step.id === 'budget').options.map(option => {
    const b = el('button', { type: 'button', class: 'slab', text: option.label, 'aria-pressed': String(answers.budget === option.id), 'data-budget': option.id });
    b.addEventListener('click', () => applyManual('budget', option.id)); return b;
  }));
  const skipped = answers.uses.length ? result.ranked.filter(entry => entry.skippable) : [];
  $('skipped').replaceChildren(...skipped.map(entry => el('li', { text: qs.find(q => q.id === entry.id).title })));
  const remaining = qs.filter(q => !Object.hasOwn(flat, q.about)).length, answeredCount = qs.length - remaining;
  $('count').textContent = answers.uses.length ? `지금 조건의 질문 ${qs.length}개 중 ${answeredCount}개에 답했고, 남은 ${remaining}개 가운데 ${skipped.length}개는 현재 기준에서 건너뛰어요.` : '';
  $('ask').replaceChildren();
  if (!answers.uses.length) return;
  if (result.status !== 'ask') { $('ask').append(el('p', { class: 'done', text: completion.status === 'ready'
    ? '현재 기준에서 추천 조건을 더 잘 맞출 질문이 없어요. 확인된 조건의 사양과 주의사항을 함께 볼 수 있어요.'
    : '아직 모르는 필수 항목은 임시 조건으로 남겨 두었어요. 확인되면 결과의 확인 항목에서 바꿔 주세요.' })); return; }
  const q = qs.find(item => item.id === result.question.id);
  const card = el('div', { class: 'ask-card' }, el('p', { class: 'eyebrow', text: '지금 물어볼 질문' }), el('h3', { text: q.title }),
    el('p', { class: 'mini', text: result.reason === 'required-input-confirmation'
      ? '사양 안내를 마무리하기 전에 필요한 기본 조건을 확인해요. 추천 사양이 같아도 직접 확인할 항목이에요.'
      : '작업에 부족하거나 필요 이상으로 큰 사양, 놓친 확인 사항을 줄이는 데 도움이 되는 질문이에요.' }));
  const options = el('div', { class: 'chips' });
  const multiple = q.selection === 'multiple', selected = new Set();
  const confirm = multiple ? el('button', { type: 'button', class: 'slab', text: '선택한 작업으로 확인', disabled: '' }) : null;
  if (multiple) card.append(el('p', { class: 'mini', text: '여러 개면 모두 고른 뒤 확인해 주세요.' }));
  for (const option of q.displayOptions || q.options) {
    const b = el('button', { type: 'button', class: 'chip', text: option.label, ...(multiple ? { 'aria-pressed': 'false' } : {}) });
    b.addEventListener('click', () => {
      if (multiple) {
        if (selected.has(option.id)) selected.delete(option.id); else selected.add(option.id);
        b.setAttribute('aria-pressed', String(selected.has(option.id)));
        confirm.disabled = selected.size === 0;
      } else applyManual(q.about, option.value ?? option.id);
    });
    options.append(b);
  }
  card.append(options);
  if (confirm) {
    confirm.addEventListener('click', () => {
      if (!selected.size) return;
      applyManual(q.about, q.displayOptions.filter(option => selected.has(option.id)).map(option => option.id));
    });
    card.append(el('p', {}, confirm));
  }
  $('ask').append(card);
}
$('uses').replaceChildren(...usesStep.options.map(option => {
  const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-use': option.id, text: option.label });
  b.addEventListener('click', () => {
    cancelAI(aiPending ? '직접 고른 답이 바뀌어 이전 AI 응답을 반영하지 않아요.' : '');
    const on = !answers.uses.includes(option.id);
    interpretation.setManualMember(`uses.${option.id}`, on); syncConsultation();
  });
  return b;
}));
syncConsultation();
modelHost.connect().then(host => {
  if (host.hostDetected) { const back = document.querySelector('a.back'); if (back) { back.href = '/'; back.textContent = '← 작업공간으로'; } }
  syncConsultation();
});
const matchingLab = mountMatchingLab({ Domain: globalThis.SynkAtlasDomain, Ask, TemperOutcomes: globalThis.SynkTemperOutcomes });
window.synkAtlasLab = { matching: () => matchingLab.snapshot(), simulate: key => TemperFlow.simulate({ spec: CONTENTS[key], steps: 60, seed: `lab-${key}` }), answers: () => ({ ...answers }), consult: () => consultation.choose({ ...answers }), run: () => run && { settings: run.settings(), changes: run.changes() },
  interpretation: () => interpretation.snapshot(),
  interpretationTiming: () => extractionMs,
  buildExtractionRequest: () => { const request = interpretation.buildExtractionRequest(); syncConsultation(); return request; },
  ingestProposals: response => { interpretation.ingest(response); extractionMs = null; syncConsultation(); },
};
