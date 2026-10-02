// SYNK Atlas lab: the real engine (the shared game bundle) on three kinds of content.
// Nothing here is a second engine: Flow, TemperFlow, VellumFlow and Ask come from atlas/.
import { FLOW_RUSH, LEVEL_WORDS } from '/order-rush/learning.mjs';
import { FLOW_RHYTHM } from '/korean-rhythm/personalization.mjs';

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
  const check = () => (globalThis.SynkLearning?.Flow && globalThis.SynkComputerRules && globalThis.SynkComputerContent ? resolve() : setTimeout(check, 30));
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
const NUMBERS = Flow.defineContent({ id: 'atlas-lab.numbers', version: 1, target: 0.75, items: { levels: [1, 2, 3], weight: 2 }, knobs: [
  { id: 'choices', kind: 'content', label: '고를 수', values: [2, 3, 4], start: 0 },
  { id: 'seconds', kind: 'pace', label: '제한 시간', values: [8, 6.5, 5, 4, 3.2, 2.6], start: 2 }] });
const WORDS = { 'raise.pace': '조금 더 빠르게 해 볼게요.', 'raise.content': '조금 더 헷갈리는 수도 섞을게요.', 'ease.pace': '시간을 조금 더 드릴게요.', 'ease.content': '조금 더 쉬운 수로 갈게요.' };
const LEVEL_TEXT = { 1: '차이가 큰 수', 2: '차이가 보통인 수', 3: '세 자리, 차이가 작은 수' };
let run = null, round = 0, current = null, timer = null, started = 0;
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
    const value = s.values[knob.id], text = knob.id === Flow.ITEM ? LEVEL_TEXT[value] : knob.id === 'seconds' ? `${value}초` : `${value}개`;
    return el('div', {}, el('dt', { text: knob.id === Flow.ITEM ? '숫자 차이' : knob.label }), el('dd', { text }));
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
    $('try-line').textContent = run.settings().adaptive ? `열 번 중 ${changes}번 설정을 바꿨어요. 다시 하면 처음부터 맞춰요.` : '정해진 설정으로 열 번 답했어요. 설정은 그대로였어요.';
    $('try-start').hidden = false; return;
  }
  round += 1;
  const s = run.settings(), level = s.level, count = s.values.choices, seconds = s.values.seconds;
  const set = numbers(level, count), answer = Math.max(...set);
  current = { answer, seconds, level, done: false };
  $('tiles').replaceChildren(...set.map(value => {
    const b = el('button', { type: 'button', class: 'tile', text: String(value) });
    b.addEventListener('click', () => respond(value === answer ? 'success' : 'fail', b));
    return b;
  }));
  started = performance.now();
  timer = setInterval(() => {
    const used = (performance.now() - started) / 1000 / seconds;
    $('timer-fill').style.transform = `scaleX(${Math.max(0, 1 - used)})`;
    if (used >= 1) respond('timeout');
  }, 50);
}
function respond(outcome, button = null) {
  if (!current || current.done) return;
  current.done = true; clearInterval(timer);
  const pressure = Math.min(1, (performance.now() - started) / 1000 / current.seconds);
  if (button) button.classList.add(outcome === 'success' ? 'right' : 'wrong');
  const out = run.observe({ outcome, pressure, level: current.level, latencyMs: Math.round(performance.now() - started) });
  const line = out.change ? VellumFlow.line(out.change, { words: WORDS }) : null;
  $('try-line').textContent = line ? line.text : outcome === 'success' ? '맞아요.' : outcome === 'timeout' ? '시간이 지났어요.' : '아쉬워요. 더 큰 수가 있었어요.';
  $('history').prepend(el('li', { class: outcome, text: `${round}. ${outcome === 'success' ? '맞힘' : outcome === 'timeout' ? '시간 지남' : '틀림'}${out.change ? ` → ${out.change.direction > 0 ? '올림' : '내림'}: ${out.change.knob === Flow.ITEM ? '숫자 차이' : NUMBERS.knobs.find(k => k.id === out.change.knob).label}` : ''}` }));
  showEngine();
  setTimeout(nextRound, 650);
}
$('try-start').addEventListener('click', () => {
  run = Flow.start({ spec: NUMBERS, now: new Date().toISOString(), declared: $('try-fixed').checked ? { mode: 'fixed' } : {} });
  round = 0; $('history').replaceChildren(); $('try-start').hidden = true; showEngine(); nextRound();
});
run = Flow.start({ spec: NUMBERS, now: new Date().toISOString() }); showEngine();

// ---------- ③ Consultation: ask only what changes the advice ----------
const C = globalThis.SynkComputerContent, R = globalThis.SynkComputerRules;
const usesStep = C.steps.find(step => step.id === 'uses');
let answers = { uses: [] };
const structured = flat => {
  const input = {};
  for (const [about, value] of Object.entries(flat)) {
    const [step, field] = about.split('.');
    if (field) input[step] = { ...(input[step] || {}), [field]: value }; else input[step] = value;
  }
  return input;
};
const advice = flat => {
  const r = R.compute(structured(flat));
  return { content: [r.headline.title, r.form.pick, r.ram.value, r.gpu.kind, r.gpu.vram ?? null, r.storage.valueText, r.os.pick] };
};
function questions() {
  const list = [];
  for (const step of C.steps) {
    if (step.id === 'uses' || (step.when && !step.when(structured(answers)))) continue;
    const title = step.short || step.eyebrow || step.id;
    if (step.type === 'single') list.push({ id: step.id, about: step.id, title, options: step.options.map(o => ({ id: o.id, label: o.label })) });
    else if (step.type === 'group') for (const field of step.fields) list.push({ id: `${step.id}.${field.id}`, about: `${step.id}.${field.id}`, title: `${title} · ${field.label}`, options: field.options.map(o => ({ id: o.id, label: o.label })) });
    else if (step.type === 'multi') list.push({ id: step.id, about: step.id, title, options: step.options.map(o => ({ id: o.id, label: o.label, value: [o.id] })) });
  }
  return list;
}
function renderConsult() {
  const qs = questions(), flat = { ...answers };
  const result = Ask.choose({ questions: qs, decide: advice, answers: flat, budget: 99 });
  const r = R.compute(structured(flat));
  $('advice').textContent = answers.uses.length ? r.headline.title : '하고 싶은 일을 고르면 추천이 나와요.';
  $('advice-sub').textContent = answers.uses.length ? r.headline.sub : '';
  const skipped = answers.uses.length ? result.ranked.filter(entry => entry.skippable) : [];
  $('skipped').replaceChildren(...skipped.map(entry => el('li', { text: qs.find(q => q.id === entry.id).title })));
  const answeredCount = Object.keys(answers).filter(key => key !== 'uses').length;
  $('count').textContent = answers.uses.length ? `전체 질문 ${qs.length + answeredCount}개 중 지금까지 ${answeredCount}개에 답했고, 남은 ${qs.length}개 가운데 ${skipped.length}개는 묻지 않아도 돼요.` : '';
  $('ask').replaceChildren();
  if (!answers.uses.length) return;
  if (result.status !== 'ask') { $('ask').append(el('p', { class: 'done', text: '추천을 바꿀 질문이 더 없어요. 여기서 추천을 보여 드려요.' })); return; }
  const q = qs.find(item => item.id === result.question.id);
  const card = el('div', { class: 'ask-card' }, el('p', { class: 'eyebrow', text: '지금 물어볼 질문' }), el('h3', { text: q.title }),
    el('p', { class: 'mini', text: `답에 따라 추천이 달라져요(가능한 추천 ${result.ranked[0].distinct}가지).` }));
  const options = el('div', { class: 'chips' });
  for (const option of q.options) {
    const b = el('button', { type: 'button', class: 'chip', text: option.label });
    b.addEventListener('click', () => { answers = { ...answers, [q.about]: option.value ?? option.id }; renderConsult(); });
    options.append(b);
  }
  card.append(options); $('ask').append(card);
}
$('uses').replaceChildren(...usesStep.options.map(option => {
  const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', text: option.label });
  b.addEventListener('click', () => {
    const on = !answers.uses.includes(option.id);
    answers = { uses: on ? [...answers.uses, option.id] : answers.uses.filter(id => id !== option.id) };
    b.setAttribute('aria-pressed', String(on)); renderConsult();
  });
  return b;
}));
renderConsult();
window.synkAtlasLab = { simulate: key => TemperFlow.simulate({ spec: CONTENTS[key], steps: 60, seed: `lab-${key}` }), answers: () => ({ ...answers }), run: () => run && { settings: run.settings(), changes: run.changes() } };
