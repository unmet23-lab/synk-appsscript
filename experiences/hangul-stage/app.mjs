// 한글 단계 MVP 화면(docs/한글단계_설계.md, 2026-10-03 한국어 MVP). 한국어만 쓰고, 글을 못 읽어도
// 시범·그림·소리로 할 수 있게 만든다. 판단은 core.mjs, 아틀라스 기록은 learning.mjs, 소리는 audio.mjs가 맡는다.
import { createPack } from './pack.mjs';
import { readProgress, planSession, answer, meet, finishSession, view, retryItem, canPlayMore, sessionsToday, letterOf, readableWords } from './core.mjs';
import { createCoach, isHosted, progressKey, createRecorder } from './learning.mjs';
import * as audio from './audio.mjs';

const $ = id => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid);
  return n;
}
const icon = name => el('span', { class: 'icon', style: `--m:var(--i-${name})`, 'aria-hidden': 'true' });
const now = () => new Date().toISOString();
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = ms => new Promise(r => setTimeout(r, ms));

const L = window.SynkLearning;
if (!L?.layer) { $('error').hidden = false; throw new Error('hangul-stage: learning bundle missing'); }
const pack = createPack(L.layer);
const coach = createCoach();
const hosted = isHosted(coach);
const KEY = progressKey(window, coach);
const rec = createRecorder(coach);
let progress = load(), saved = !!KEY;
function load() { if (!KEY) return readProgress(null); try { return readProgress(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return readProgress(null); } }
function save() { if (!KEY) { saved = false; return; } try { localStorage.setItem(KEY, JSON.stringify(progress)); saved = true; } catch { saved = false; } }
const glyph = id => pack.byId.get(id).glyph;
const STATE_WORD = { unmet: '아직 안 만남', met: '만남', learning: '익히는 중', mastered: '익힘' };

if (new URLSearchParams(location.search).get('qa') === 'silent') audio.setSilent(true);
audio.initAudio();

function show(id) { for (const s of ['home', 'session', 'finish']) $(s).hidden = s !== id; scrollTo(0, 0); }

// ── 입구 ──────────────────────────────────────────────
function tile(l, { onTap = true } = {}) {
  const state = l.shown || l.state;
  const b = el('button', { class: `tile ${state}`, type: 'button', 'aria-label': `${l.glyph} ${STATE_WORD[state]}`, disabled: state === 'unmet' }, l.glyph);
  if (onTap && state !== 'unmet') b.addEventListener('click', () => audio.say(l.voice));
  return b;
}
function renderHome() {
  const at = now(), v = view(progress, pack, at);
  const more = canPlayMore(progress, at), today = sessionsToday(progress, at);
  $('start-label').textContent = !more ? '내일 또 만나요' : today ? '한 번 더' : v.started ? '이어서 배우기' : '시작';
  $('start-sub').textContent = more ? `${progress.amount}문제 · ${{ 5: 2, 10: 3, 15: 4 }[progress.amount]}분쯤` : '오늘은 여기까지 했어요';
  $('start').disabled = !more || !audio.voiceReady();
  const STATUS = { done: '다 익힘', now: '지금', started: '배우는 중', next: '다음', later: '준비 중' };
  $('road').replaceChildren(...v.units.map((u, i) => el('li', { class: u.status, 'aria-label': `${i + 1}. ${u.label} · ${STATUS[u.status]}` },
    el('span', { class: 'stop', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'glyphs', 'aria-hidden': 'true' }, [...u.glyphs].slice(0, 3).join('') + (u.glyphs.length > 3 ? '…' : '')))));
  const current = v.units.find(u => u.status === 'now');
  $('road-now').textContent = current ? `지금: ${current.label}` : v.units.every(u => u.status === 'done' || u.status === 'later') ? '네 단원을 다 익혔어요' : '';
  $('box').replaceChildren(...v.letters.map(l => tile(l)));
  $('signs').replaceChildren(...v.signs.map(s => {
    const b = el('button', { class: `sign${s.readable ? ' readable' : ''}`, type: 'button', disabled: !s.readable, 'aria-label': s.readable ? `${s.text} 간판, 눌러서 듣기` : '아직 흐린 간판' },
      el('span', { class: 'plaque' }, el('span', { class: 'word', 'aria-hidden': 'true' }, s.syllables.map(x => el('span', { class: x.clear ? '' : 'hazy' }, x.text)))),
      el('small', {}, s.readable ? '눌러서 듣기' : '아직 흐려요'));
    if (s.readable) b.addEventListener('click', () => audio.say(s.text));
    return b;
  }));
  $('plate').replaceChildren(...v.plate.map(s => el('div', { class: 'syl', 'aria-label': s.text },
    s.cells.map(c => el('span', { class: `cell${c.filled ? ' filled' : ''}${c.later ? ' later' : ''}`, 'aria-hidden': 'true' }, c.glyph)))));
  $('amounts').replaceChildren(...[5, 10, 15].map(n => el('button', { class: 'amount', type: 'button', role: 'radio', 'aria-checked': String(progress.amount === n),
    onclick: () => { progress = readProgress({ ...progress, amount: n }); save(); renderHome(); } }, `${n}문제`)));
  $('skip').hidden = progress.skipped;
  $('skipped-note').hidden = !progress.skipped;
  $('save-note').hidden = saved;
  $('save-note').textContent = KEY ? '이 기기에 진도를 저장하지 못했어요. 이번 접속에서만 이어져요.' : '이 화면에서는 진도가 저장되지 않아요.';
  $('effects').setAttribute('aria-pressed', String(audio.effectsEnabled()));
}
audio.onVoice(() => {
  const s = audio.voiceStatus(), note = $('voice-note');
  note.hidden = !(s === 'missing' || s === 'unsupported');
  note.textContent = s === 'unsupported' ? '이 브라우저는 소리를 낼 수 없어요. 다른 브라우저로 열어 주세요.'
    : '이 기기에서 한국어 소리를 낼 수 없어요. 기기 설정에서 한국어 음성을 받으면 소리가 나요.';
  if (!$('home').hidden) renderHome();
});
$('start').addEventListener('click', () => startSession());
$('effects').addEventListener('click', () => { audio.setEffects(!audio.effectsEnabled()); renderHome(); });
$('skip').addEventListener('click', () => { $('sheet').hidden = false; $('sheet-stay').focus(); });
$('sheet-stay').addEventListener('click', () => { $('sheet').hidden = true; });
$('sheet-skip').addEventListener('click', () => { progress = readProgress({ ...progress, skipped: true }); save(); $('sheet').hidden = true; renderHome(); });
$('unskip').addEventListener('click', () => { progress = readProgress({ ...progress, skipped: false }); save(); renderHome(); });

// ── 한 회차 ──────────────────────────────────────────────
let S = null;
function startSession() {
  if (!audio.voiceReady()) return;
  audio.warm();
  const at = now(), sessionNo = sessionsToday(progress, at);
  const plan = planSession(progress, pack, { now: at, scope: hosted ? 'account' : 'device', sessionNo });
  const before = view(progress, pack, at);
  S = { plan, sessionNo, sessionId: `${plan.day}#${sessionNo}`, steps: [{ kind: 'reason' }, ...plan.steps], index: 0,
    total: plan.steps.filter(s => s.kind === 'item').length, answered: 0, independent: 0, met: [], practiced: new Set(),
    masteredBefore: new Set(before.letters.filter(l => l.shown === 'mastered').map(l => l.id)), readableBefore: new Set(before.signs.filter(s => s.readable).map(s => s.text)),
    wrongRun: 0, retries: 0, retried: new Set(), open: [] };
  show('session'); renderStep();
}
function bar() { $('bar').style.width = `${Math.round((S.answered / Math.max(1, S.total)) * 100)}%`; }
function dock(...kids) { $('dock').replaceChildren(...kids); }
function cta(label, { tone = 'coral', disc = '', onClick, disabled = false } = {}) {
  return el('button', { class: `felt-cta ${tone}`, type: 'button', disabled, onclick: onClick }, el('span', { class: 'cta-text' }, el('b', {}, label)), el('span', { class: `disc ${disc}`, 'aria-hidden': 'true' }));
}
function prompt(text) { return el('p', { class: 'prompt' }, el('img', { class: 'mini', src: 'assets/brand/mongle-curious.webp', alt: '' }), text); }
function nextStep() { audio.stop(); S.open = []; S.index += 1; if (S.index >= S.steps.length) endSession(); else renderStep(); }
function renderStep() {
  bar();
  const step = S.steps[S.index];
  if (step.kind === 'reason') return renderReason();
  if (step.kind === 'meet') return renderMeet(step.letter);
  const item = step.item;
  ({ listen_pick: renderListen, see_pick: renderSee, build: renderBuild, match: renderMatch })[item.type](item);
}

function renderReason() {
  const r = S.plan.reason;
  $('stage').replaceChildren(el('section', { class: 'reason paper' },
    el('img', { class: 'mongle', src: 'assets/brand/mongle-curious.webp', alt: '' }),
    el('p', {}, r.text),
    r.letters.length ? el('div', { class: 'chips', 'aria-label': r.letters.join(' ') }, r.letters.map(g => el('span', { class: 'chip', 'aria-hidden': 'true' }, g))) : null));
  dock(cta('시작', { disc: 'play', onClick: nextStep }));
}

// 만나기 카드(설계 §4): 글자가 크게 놓이고 소리가 두 번 난다 → 따라 쓰기(판정 없음) → 그 글자가 든 음절·낱말.
function examplesFor(id) {
  const l = pack.byId.get(id), known = new Set([...pack.letters.filter(x => letterOf(progress, x.id).state !== 'unmet').map(x => x.id), id]);
  const consonants = [...known].filter(x => pack.byId.get(x).role === 'consonant' && x !== 'c-ng');
  const vowels = [...known].filter(x => pack.byId.get(x).role === 'vowel');
  let list;
  if (id === 'c-ng') list = vowels.slice(0, 3).map(v => pack.syllable(null, v));
  else if (l.role === 'vowel') list = [pack.syllable(null, id), ...consonants.slice(-2).map(c => pack.syllable(c, id))];
  else list = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-i'].filter(v => known.has(v)).slice(0, 3).map(v => pack.syllable(id, v));
  const word = readableWords(pack, known).find(w => w.letters.includes(id) && [...w.text].length <= 3);
  return [...new Set([...list, ...(word ? [word.text] : [])])].slice(0, 4);
}
function noteFor(id) {
  if (id === 'c-ng') return '첫소리 ㅇ은 소리가 없어요. 아는 ㅏ와 같은 소리예요.';
  const other = { 'v-ae': 'v-e', 'v-e': 'v-ae' }[id];
  if (other && letterOf(progress, other).state !== 'unmet') return `${glyph('v-ae')}와 ${glyph('v-e')}는 소리가 같아요. 낱말마다 쓰는 글자가 정해져 있어요.`;
  return null;
}
function renderMeet(id) {
  const l = pack.byId.get(id);
  progress = meet(progress, [id], now()); save(); S.met.push(id);
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': `${l.glyph} 소리 듣기` });
  speak.addEventListener('click', () => play(speak, l.voice));
  const note = noteFor(id);
  const pad = tracePad(l.glyph);
  $('stage').replaceChildren(el('section', { class: 'meet paper' },
    el('div', { class: 'glyph', 'aria-label': `새 글자 ${l.glyph}` }, l.glyph),
    speak,
    note ? el('p', { class: 'note' }, note) : null,
    el('div', { class: 'trace-head' }, el('span', {}, '따라 써 봐요'), el('button', { class: 'redo', type: 'button', 'aria-label': '다시 쓰기', onclick: () => pad.clear() })),
    pad.node,
    el('div', { class: 'examples' }, examplesFor(id).map(t => el('button', { class: 'example', type: 'button', 'aria-label': `${t} 듣기`, onclick: () => audio.say(t) }, t, icon('speaker'))))));
  dock(cta('다음', { onClick: nextStep }));
  setTimeout(() => play(speak, l.voice, true), 350);
}
async function play(button, text, twice = false, opts = {}) {
  button?.classList.add('playing');
  const ok = twice ? await audio.sayTwice(text) : await audio.say(text, opts);
  button?.classList.remove('playing');
  return ok;
}
// 실로 따라 쓰기: 손가락이 지나간 자리에 실이 놓이고 손을 떼면 매듭이 지어진다. 판정하지 않는다.
function tracePad(g) {
  const wrap = el('div', { class: 'trace' }), canvas = el('canvas', { 'aria-label': `${g} 따라 쓰는 칸` });
  wrap.append(canvas);
  const ctx = canvas.getContext('2d');
  let ready = false, drawing = false, last = null;
  function size() {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!r.width) return;
    canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
    ctx.setTransform(d, 0, 0, d, 0, 0); base(r); ready = true;
  }
  function base(r = canvas.getBoundingClientRect()) {
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.fillStyle = '#eadfd2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(r.width * 0.72)}px SUIT, "Malgun Gothic", sans-serif`;
    ctx.fillText(g, r.width / 2, r.height / 2 + r.width * 0.03);
  }
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => { if (!ready) size(); drawing = true; last = point(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = point(e);
    ctx.strokeStyle = '#f96859'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  });
  const end = () => { if (!drawing) return; drawing = false; if (last) { ctx.fillStyle = '#ae322a'; ctx.beginPath(); ctx.arc(last.x, last.y, 7, 0, Math.PI * 2); ctx.fill(); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  requestAnimationFrame(size); document.fonts?.ready.then(() => { if (ready) base(); else size(); });
  return { node: wrap, clear: () => (ready ? base() : size()) };
}

// ── 문항 공통 ──
const done = item => { if (item.target.letter) S.practiced.add(item.target.letter); for (const id of item.focus) S.practiced.add(id); };
function settle(item, { correct, assisted, replays = 0, perLetter = null, confused = [], counts = true, listening = true }) {
  progress = answer(progress, { focus: item.focus, correct, perLetter, assisted, replays, confused, at: now(), sessionId: S.sessionId, counts });
  save();
  if (counts) { S.answered += 1; if (correct && !assisted) S.independent += 1; bar(); }
  if (listening) S.wrongRun = correct ? 0 : S.wrongRun + 1;
  done(item);
  // 틀린 글자는 회차 안에서 한 번 더(두 칸 뒤, 회차에 두 번까지, 같은 글자는 한 번).
  const letter = item.target.letter;
  if (!correct && letter && !S.retried.has(letter) && S.retries < 2) {
    const again = retryItem(progress, pack, letter, { now: now(), scope: hosted ? 'account' : 'device', sessionNo: S.sessionNo, n: S.retries + 1, avoid: item.type });
    if (again) { S.retried.add(letter); S.retries += 1; S.total += 1; S.steps.splice(Math.min(S.index + 3, S.steps.length), 0, { kind: 'item', item: again }); bar(); }
  }
}
function feedback(correct, text) {
  if (correct) audio.effect('earn');
  dock(el('p', { class: `say${correct ? ' good' : ''}`, role: 'status' }, text), cta('다음', { onClick: nextStep }));
  setTimeout(() => $('dock').querySelector('.felt-cta')?.focus({ preventScroll: true }), 30);
}
// 막힌 순간(설계 §8): 소리 문항에서 이어서 두 번 틀리면 천천히 다시 들을지 한 번 묻는다. 받아들이면 도움받은 문항이 된다.
function slowOffer(state, text, button) {
  if (S.wrongRun < 2) return null;
  const b = el('button', { class: 'slow', type: 'button' }, icon('speaker'), '천천히 듣기');
  b.addEventListener('click', async () => { if (!state.assisted) { state.assisted = true; rec.helped(state.pid); } await play(button, text, false, { slow: true }); });
  return b;
}
// 시범(설계 §2 「보여 주는 안내가 먼저다」): 그 꼴이 처음 나올 때 한 번, 몽글의 손가락이 소리를 누르고 맞는 것을 고른다.
// 화면을 그리는 순간부터 시범이 끝날 때까지 누를 수 없다. 시범이 답을 보여 준 문항은 도움받은 문항으로 남는다.
// 움직임 줄이기에서는 손가락 없이 차례로 테두리만 보인다. 시범을 하면 true.
function withDemo(type, state, steps, after = () => {}) {
  if (progress.demoSeen.includes(type)) return false;
  progress = readProgress({ ...progress, demoSeen: [...progress.demoSeen, type] }); save();
  $('stage').inert = true; $('dock').inert = true;
  (async () => {
    await pause(300);
    await demo(steps());
    state.assisted = true;
    for (const pid of [].concat(state.pid ?? [])) rec.shown(pid);
    after();
  })();
  return true;
}
async function demo(steps) {
  const stage = $('stage'), pointer = $('pointer');
  stage.inert = true; $('dock').inert = true;
  const at = node => { const r = node.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  try {
    if (!still()) { pointer.hidden = false; pointer.style.transition = 'none'; const [x, y] = at(stage); pointer.style.transform = `translate(${x}px,${y + 120}px)`; await pause(30); pointer.style.transition = ''; }
    for (const s of steps) {
      if (!s.node?.isConnected) continue;
      s.node.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' });
      if (!still()) { const [x, y] = at(s.node); pointer.style.transform = `translate(${x}px,${y}px)`; await pause(800); }
      s.node.classList.add('demo-ring');
      await (s.run ? s.run() : pause(500));
      await pause(still() ? 700 : 350);
      s.node.classList.remove('demo-ring');
    }
  } finally { pointer.hidden = true; stage.inert = false; $('dock').inert = false; }
}

// 듣고 고르기
function renderListen(item) {
  const state = { pid: rec.present(item), assisted: false, replays: 0, plays: 0, answered: false };
  S.open = [state.pid];
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': '소리 듣기' });
  const hear = async (opts = {}) => {
    if (state.plays > 0) { state.replays += 1; rec.replay(state.pid); }
    state.plays += 1;
    const ok = await play(speak, item.target.text, false, opts);
    if (state.plays === 1) rec.delivered(state.pid, ok);
  };
  speak.addEventListener('click', () => hear());
  const options = item.options.map(o => el('button', { class: 'opt', type: 'button', 'aria-label': o.text }, el('span', { class: `big${item.word ? ' word' : ''}` }, o.text)));
  options.forEach((b, i) => b.addEventListener('click', () => choose(item.options[i], b)));
  $('stage').replaceChildren(prompt(item.word ? '소리를 듣고 맞는 낱말을 골라요' : '소리를 듣고 맞는 글자를 골라요'),
    el('div', { class: 'speak-row' }, speak, slowOffer(state, item.target.text, speak)), el('div', { class: 'options' }, options));
  dock();
  async function choose(o, b) {
    if (state.answered) return;
    state.answered = true; S.open = [];
    const correct = o.text === item.target.text;
    options.forEach(x => { x.disabled = true; });
    const right = options[item.options.findIndex(x => x.text === item.target.text)];
    right.classList.add('right'); if (!correct) b.classList.add('wrong');
    rec.answer(state.pid, correct);
    settle(item, { correct, assisted: state.assisted, replays: state.replays, confused: correct ? [] : [[item.target.letter, o.letter]] });
    feedback(correct, correct ? '맞아요' : '이 소리예요');
    if (!correct) { await audio.say(o.text); await audio.wait(250); await audio.say(item.target.text); }
  }
  if (!withDemo('listen_pick', state, () => [{ node: speak, run: () => hear() }, { node: options[item.options.findIndex(x => x.text === item.target.text)] }]))
    pause(300).then(() => { if (!state.answered) hear(); });
}

// 보고 고르기: 글자를 보고, 보기를 눌러 소리를 들은 뒤 맞는 소리를 고른다.
function renderSee(item) {
  const state = { pid: rec.present(item), assisted: false, picked: null, answered: false };
  S.open = [state.pid];
  const options = item.options.map((o, i) => el('button', { class: 'opt sound', type: 'button', 'aria-label': `${i + 1}번 소리` }, icon('speaker'), el('span', { class: 'num' }, String(i + 1))));
  const confirm = cta('확인', { disc: 'check', disabled: true, onClick: () => submit() });
  options.forEach((b, i) => b.addEventListener('click', async () => {
    if (state.answered) return;
    state.picked = i; options.forEach((x, j) => x.classList.toggle('picked', j === i)); confirm.disabled = false;
    await play(null, item.options[i].text);
  }));
  $('stage').replaceChildren(prompt('글자를 보고 맞는 소리를 골라요'), el('div', { class: `shown paper${item.word ? ' word' : ''}`, 'aria-label': item.target.text }, item.target.text),
    el('div', { class: 'options' }, options));
  dock(confirm);
  async function submit() {
    if (state.answered || state.picked == null) return;
    state.answered = true; S.open = [];
    const o = item.options[state.picked], correct = o.text === item.target.text;
    options.forEach(x => { x.disabled = true; x.classList.remove('picked'); });
    options[item.options.findIndex(x => x.text === item.target.text)].classList.add('right');
    if (!correct) options[state.picked].classList.add('wrong');
    rec.answer(state.pid, correct);
    settle(item, { correct, assisted: state.assisted, confused: correct ? [] : [[item.target.letter, o.letter]], listening: false });
    feedback(correct, correct ? '맞아요' : `${item.target.text}는 이 소리예요`);
    if (!correct) { await audio.say(o.text); await audio.wait(250); }
    await audio.say(item.target.text);
  }
  const i = item.options.findIndex(x => x.text === item.target.text);
  withDemo('see_pick', state, () => [{ node: options[i], run: async () => { options[i].classList.add('picked'); await play(null, item.options[i].text); } }, { node: confirm }],
    () => options[i].classList.remove('picked'));
}

// 음절 만들기: 들린 음절을 자음 조각과 모음 조각으로 만든다.
function renderBuild(item) {
  const t = item.target, state = { pid: rec.present(item), assisted: false, replays: 0, plays: 0, c: null, v: null, answered: false };
  S.open = [state.pid];
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': '소리 듣기' });
  const hear = async (opts = {}) => {
    if (state.plays > 0) { state.replays += 1; rec.replay(state.pid); }
    state.plays += 1;
    const ok = await play(speak, t.text, false, opts);
    if (state.plays === 1) rec.delivered(state.pid, ok);
  };
  speak.addEventListener('click', () => hear());
  const slot = el('div', { class: 'slot paper empty', 'aria-live': 'polite' }, '?');
  const confirm = cta('확인', { disc: 'check', disabled: true, onClick: () => submit() });
  const piece = (id, kind) => el('button', { class: 'piece', type: 'button', 'aria-pressed': 'false', 'aria-label': glyph(id), onclick: () => select(kind, id) }, glyph(id));
  const cs = item.pieces.consonants.map(id => piece(id, 'c')), vs = item.pieces.vowels.map(id => piece(id, 'v'));
  function select(kind, id) {
    if (state.answered) return;
    state[kind] = id;
    for (const b of kind === 'c' ? cs : vs) b.setAttribute('aria-pressed', String(b.getAttribute('aria-label') === glyph(id)));
    // 조각을 고르는 대로 글자가 합쳐져 보인다(자음 하나만 고르면 그 조각만).
    slot.textContent = state.c && state.v ? pack.syllable(state.c, state.v) : state.c ? glyph(state.c) : state.v ? glyph(state.v) : '?';
    slot.classList.toggle('empty', !state.c && !state.v);
    confirm.disabled = !(state.c && state.v);
  }
  $('stage').replaceChildren(prompt('들은 소리를 만들어요'), el('div', { class: 'speak-row' }, speak, slowOffer(state, t.text, speak)), slot,
    el('div', { class: 'pieces' }, el('div', { class: 'piece-row', 'aria-label': '자음' }, cs), el('div', { class: 'piece-row', 'aria-label': '모음' }, vs)));
  dock(confirm);
  async function submit() {
    if (state.answered || !state.c || !state.v) return;
    state.answered = true; S.open = [];
    const cOk = state.c === t.consonant, vOk = state.v === t.vowel, correct = cOk && vOk, made = pack.syllable(state.c, state.v);
    for (const b of [...cs, ...vs]) b.disabled = true;
    slot.textContent = t.text; slot.classList.remove('empty');
    rec.answer(state.pid, correct);
    settle(item, { correct, assisted: state.assisted, replays: state.replays, perLetter: { [t.consonant]: cOk, [t.vowel]: vOk },
      confused: [...(cOk ? [] : [[t.consonant, state.c]]), ...(vOk ? [] : [[t.vowel, state.v]])] });
    feedback(correct, correct ? '맞아요' : `${made}가 아니라 ${t.text}예요`);
    if (!correct) { await audio.say(made); await audio.wait(250); await audio.say(t.text); }
  }
  const c = cs[item.pieces.consonants.indexOf(t.consonant)], v = vs[item.pieces.vowels.indexOf(t.vowel)];
  if (!withDemo('build', state, () => [{ node: speak, run: () => hear() }, { node: c, run: async () => select('c', t.consonant) }, { node: v, run: async () => select('v', t.vowel) }, { node: slot }],
    () => { state.c = state.v = null; for (const b of [...cs, ...vs]) b.setAttribute('aria-pressed', 'false'); slot.textContent = '?'; slot.classList.add('empty'); confirm.disabled = true; }))
    pause(300).then(() => { if (!state.answered) hear(); });
}

// 짝 맞추기: 소리 카드를 눌러 듣고 맞는 글자 카드를 고른다(순서는 아무렇게나). 시간 제한이 없다.
function renderMatch(item) {
  const pairs = new Map(item.cards.map(c => [c.letter, { pid: rec.present(item, c.letter), heard: false, missed: false, matched: false }]));
  const state = { pid: [...pairs.values()].map(p => p.pid), assisted: false, sel: { sound: null, letter: null }, left: pairs.size };
  S.open = state.pid.slice();
  const letterCards = item.cards.map(c => el('button', { class: 'card', type: 'button', 'aria-pressed': 'false', 'aria-label': `글자 ${c.text}` }, c.text));
  const soundCards = item.sounds.map((c, i) => el('button', { class: 'card', type: 'button', 'aria-pressed': 'false', 'aria-label': `${i + 1}번 소리` }, icon('speaker'), el('span', { class: 'num' }, String(i + 1))));
  letterCards.forEach((b, i) => b.addEventListener('click', () => pickCard('letter', item.cards[i].letter, b)));
  soundCards.forEach((b, i) => b.addEventListener('click', () => pickCard('sound', item.sounds[i].letter, b)));
  $('stage').replaceChildren(prompt('소리와 글자를 짝지어요'), el('div', { class: 'match' }, el('div', { class: 'col', 'aria-label': '소리' }, soundCards), el('div', { class: 'col', 'aria-label': '글자' }, letterCards)));
  dock();
  async function pickCard(kind, letter, button) {
    const p = pairs.get(letter);
    if (p.matched) return;
    for (const b of kind === 'sound' ? soundCards : letterCards) b.setAttribute('aria-pressed', String(b === button));
    state.sel[kind] = { letter, button };
    // 소리가 끝까지 난 뒤에 짝을 본다: 듣기 전에 고른 답은 소리 문항의 근거가 되지 않는다.
    if (kind === 'sound') {
      state.playing = audio.say(pack.byId.get(letter).voice).then(ok => { if (!p.heard) { p.heard = true; rec.delivered(p.pid, ok); } });
    }
    await state.playing;
    if (state.sel[kind]?.button !== button) return;
    const { sound, letter: card } = state.sel;
    if (!sound || !card) return;
    state.sel = { sound: null, letter: null };
    sound.button.setAttribute('aria-pressed', 'false'); card.button.setAttribute('aria-pressed', 'false');
    if (sound.letter === card.letter) {
      const q = pairs.get(card.letter); q.matched = true; state.left -= 1;
      sound.button.classList.add('matched'); card.button.classList.add('matched'); sound.button.disabled = card.button.disabled = true;
      audio.effect('earn');
      const firstTry = !q.missed;
      rec.answer(q.pid, firstTry); S.open = S.open.filter(x => x !== q.pid);
      progress = answer(progress, { focus: [card.letter], correct: firstTry, assisted: state.assisted, at: now(), sessionId: S.sessionId, counts: false }); save();
      if (!state.left) finishMatch();
    } else {
      pairs.get(sound.letter).missed = true; pairs.get(card.letter).missed = true;
      progress = answer(progress, { focus: [], confused: [[sound.letter, card.letter]], correct: false, at: now(), sessionId: S.sessionId, counts: false }); save();
      for (const b of [sound.button, card.button]) { b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 650); }
    }
  }
  function finishMatch() {
    const clean = [...pairs.values()].every(p => !p.missed);
    // 짝 맞추기 한 판은 회차의 한 문항이다. 「최근 스무 문항」에는 모든 짝을 첫 시도에 맞혔는지로 한 번 센다.
    progress = answer(progress, { focus: [], correct: clean, assisted: state.assisted, at: now(), sessionId: S.sessionId }); save();
    S.answered += 1; if (clean && !state.assisted) S.independent += 1; bar(); done(item);
    S.wrongRun = clean ? 0 : S.wrongRun + 1;
    feedback(true, clean ? '다 맞췄어요' : '다 찾았어요');
  }
  const first = item.sounds[0].letter;
  withDemo('match', state, () => [{ node: soundCards[0], run: () => audio.say(pack.byId.get(first).voice) }, { node: letterCards[item.cards.findIndex(c => c.letter === first)] }]);
}

// ── 마무리 ──────────────────────────────────────────────
function endSession() {
  progress = finishSession(progress, { day: S.plan.day, sessionNo: S.sessionNo, total: S.answered, independent: S.independent }); save();
  rec.flush();
  const at = now(), v = view(progress, pack, at);
  const byId = new Map(v.letters.map(l => [l.id, l]));
  const shownToday = S.met.length ? S.met : [...S.practiced].filter(id => byId.has(id)).slice(0, 8);
  $('finish-title').textContent = S.met.length ? '오늘 만난 글자예요' : '오늘 연습한 글자예요';
  $('finish-letters').replaceChildren(...shownToday.map(id => tile(byId.get(id))));
  const mastered = v.letters.filter(l => l.shown === 'mastered' && !S.masteredBefore.has(l.id));
  const signs = v.signs.filter(s => s.readable && !S.readableBefore.has(s.text));
  $('finish-extra').replaceChildren(...[
    mastered.length ? el('p', {}, '새로 익힌 글자') : null,
    mastered.length ? el('div', { class: 'finish-letters' }, mastered.map(l => tile(l))) : null,
    ...signs.map(s => el('button', { class: 'sign readable', type: 'button', 'aria-label': `${s.text} 간판, 눌러서 듣기`, onclick: () => audio.say(s.text) },
      el('span', { class: 'plaque' }, el('span', { class: 'word', 'aria-hidden': 'true' }, s.text)), el('small', {}, '이제 읽을 수 있어요')))].filter(Boolean)); // replaceChildren은 null을 글자로 넣는다
  $('tomorrow').replaceChildren(...(v.tomorrow.length ? [el('p', {}, '다음에 만날 글자'), el('div', { class: 'chips' }, v.tomorrow.map(g => el('span', { class: 'chip', 'aria-hidden': 'true' }, g)))]
    : [el('p', {}, v.allMet ? '네 단원의 글자를 다 만났어요. 다음 단원은 준비 중이에요.' : '')]));
  $('again').hidden = !canPlayMore(progress, at);
  audio.effect('achieve');
  S = null; show('finish');
}
$('again').addEventListener('click', () => startSession());
$('done').addEventListener('click', () => { renderHome(); show('home'); });
$('quit').addEventListener('click', () => {
  audio.stop();
  for (const pid of S?.open || []) rec.leave(pid);
  if (S && S.answered >= 3) progress = finishSession(progress, { day: S.plan.day, sessionNo: S.sessionNo, total: S.answered, independent: S.independent });
  save(); rec.flush(); S = null; renderHome(); show('home');
});

// 화면 점검(?qa=silent)에서만: 지금 단계와 진도를 읽게 한다(qa/flow.cjs). 보통 화면에는 없다.
if (audio.voiceStatus() === 'silent') window.__hangulQA = Object.freeze({ step: () => (S ? S.steps[S.index] : null), progress: () => progress, key: KEY });

renderHome(); show('home');
