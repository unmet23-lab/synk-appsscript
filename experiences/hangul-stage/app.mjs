// 한글 단계 MVP 화면(docs/한글단계_설계.md, 2026-10-03 한국어 MVP). 한국어만 쓰고, 글을 못 읽어도
// 시범·그림·소리로 할 수 있게 만든다. 판단은 core.mjs, 아틀라스 기록은 learning.mjs, 소리는 audio.mjs가 맡는다.
import { createPack, compose, decompose, josa } from './pack.mjs';
import { readProgress, planSession, answer, meet, finishSession, view, retryItem, canPlayMore, sessionsToday, letterOf, readableWords, graduationReady, graduate, SETTINGS } from './core.mjs';
import { createCoach, isHosted, progressKey, createRecorder } from './learning.mjs';
import * as audio from './audio.mjs';
import { SONGS, songById, cueAt, EXTRA_CONSONANTS, tileLetters, lettersIn } from './songs.mjs';

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
const isFinal = id => pack.byId.get(id)?.role === 'final';
const nameOf = id => (isFinal(id) ? `받침 ${glyph(id)}` : glyph(id));
// 졸업 뒤 미니게임으로: 공통 서버(학습 허브와 같은 출처)에서 열었을 때만 허브로 잇는다. WORLD 안에서는 위의 게임 목록을 쓴다.
const HUB = !hosted && location.pathname.startsWith('/hangul-stage/') ? '../learning-hub/' : null;

if (new URLSearchParams(location.search).get('qa') === 'silent') audio.setSilent(true);
audio.initAudio();

function show(id) { for (const s of ['home', 'session', 'finish', 'graduation', 'song']) $(s).hidden = s !== id; scrollTo(0, 0); }

// ── 입구 ──────────────────────────────────────────────
function tile(l, { onTap = true } = {}) {
  const state = l.shown || l.state;
  const b = el('button', { class: `tile ${state}${l.role === 'final' ? ' final' : ''}`, type: 'button', 'aria-label': `${l.role === 'final' ? '받침 ' : ''}${l.glyph} ${STATE_WORD[state]}`, disabled: state === 'unmet' }, l.glyph);
  if (onTap && state !== 'unmet') b.addEventListener('click', () => audio.say(l.voice));
  return b;
}
function renderHome() {
  const at = now(), v = view(progress, pack, at);
  const more = canPlayMore(progress, at), today = sessionsToday(progress, at);
  // 졸업 뒤에는 헷갈리기 쉬운 글자의 짧은 몸풀기다(설계 §8).
  const amount = v.graduated ? Math.min(progress.amount, SETTINGS.warmup) : progress.amount;
  $('hero-title').textContent = v.graduated ? '한글을 읽어요' : '가나다부터';
  $('hero-lede').textContent = v.graduated ? '한글 단계를 졸업했어요. 헷갈리기 쉬운 글자를 가끔 짧게 풀어요.' : '소리를 듣고, 글자를 보고, 음절을 만들며 혼자 배워요.';
  $('start-label').textContent = !more ? '내일 또 만나요' : v.graduated ? '몸풀기' : today ? '한 번 더' : v.started ? '이어서 배우기' : '시작';
  $('start-sub').textContent = more ? `${amount}문제 · ${{ 5: 2, 10: 3, 15: 4 }[amount]}분쯤` : '오늘은 여기까지 했어요';
  $('start').disabled = !more || !audio.voiceReady();
  $('games').hidden = !(v.graduated && HUB);
  if (HUB) $('games').href = HUB;
  $('games-note').hidden = !(v.graduated && hosted);
  const STATUS = { done: '다 익힘', now: '지금', started: '배우는 중', next: '다음', later: '준비 중' };
  $('road').replaceChildren(...v.units.map((u, i) => el('li', { class: `${u.status}${u.final ? ' final' : ''}`, 'aria-label': `${i + 1}. ${u.label} · ${STATUS[u.status]}` },
    el('span', { class: 'stop', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'glyphs', 'aria-hidden': 'true' }, [...u.glyphs].slice(0, 3).join('') + (u.glyphs.length > 3 ? '…' : '')))));
  const current = v.units.find(u => u.status === 'now');
  $('road-now').textContent = v.graduated ? '졸업' : current ? `지금: ${current.label}` : v.units.every(u => u.status === 'done' || u.status === 'later') ? '한글 글자를 다 익혔어요' : '';
  // 글자 상자는 모음 · 자음 · 받침으로 나눠 보인다. 받침은 첫소리와 모양이 같아 묶음 이름으로 가른다.
  const GROUPS = [['vowel', '모음'], ['consonant', '자음'], ['final', '받침']];
  $('box').replaceChildren(...GROUPS.map(([role, label]) => el('div', { class: 'box-group' },
    el('h3', {}, label), el('div', { class: 'box' }, v.letters.filter(l => l.role === role).map(l => tile(l))))));
  $('amounts-block').hidden = !!v.graduated;
  // 노래로 배우기: 처음 온 사람의 입구이자 언제든 복습(조사 10-04 — 노래는 입구·복습·보상, 읽게 만드는 것은 연습).
  $('songs').replaceChildren(...SONGS.map(s => el('button', { class: 'song-card', type: 'button', 'aria-label': `${s.title} 노래 듣기`, onclick: () => openSong(s.id) },
    el('span', { class: 'song-glyphs', 'aria-hidden': 'true' }, s.id === 'vowel-dance' ? 'ㅏㅓㅗㅜ' : 'ㄱ+ㅏ'),
    el('span', { class: 'song-name' }, el('b', {}, s.title), el('small', {}, durationText(s.duration))))));
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
  $('skip').hidden = progress.skipped || !!v.graduated;
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
function prompt(text, { mini = true } = {}) { return el('p', { class: 'prompt' }, mini ? el('img', { class: 'mini', src: 'assets/brand/mongle-curious.webp', alt: '' }) : null, text); }
function nextStep() { audio.stop(); S.open = []; S.index += 1; if (S.index >= S.steps.length) endSession(); else renderStep(); }
function renderStep() {
  bar();
  const step = S.steps[S.index];
  if (step.kind === 'reason') return renderReason();
  if (step.kind === 'meet') return renderMeet(step.letter);
  const item = step.item;
  ({ listen_pick: renderListen, pair: renderListen, teach: renderListen, see_pick: renderSee, build: renderBuild, match: renderMatch })[item.type](item);
}

// 글자 칩. 받침 칩은 아래에 받침 자리 표시가 붙는다(모양만으로는 첫소리와 같아서).
function chipRow(glyphs, finals = []) {
  return el('div', { class: 'chips', 'aria-label': glyphs.map((g, i) => (finals[i] ? `받침 ${g}` : g)).join(' ') },
    glyphs.map((g, i) => el('span', { class: `chip${finals[i] ? ' final' : ''}`, 'aria-hidden': 'true' }, g)));
}
function renderReason() {
  const r = S.plan.reason;
  $('stage').replaceChildren(el('section', { class: 'reason paper' },
    el('img', { class: 'mongle', src: 'assets/brand/mongle-curious.webp', alt: '' }),
    el('p', {}, r.text),
    r.letters.length ? chipRow(r.letters, r.finals) : null));
  dock(cta('시작', { disc: 'play', onClick: nextStep }));
}

// 만나기 카드(설계 §4): 글자가 크게 놓이고 소리가 두 번 난다 → 따라 쓰기(판정 없음) → 그 글자가 든 음절·낱말.
function examplesFor(id) {
  const l = pack.byId.get(id), known = new Set([...pack.letters.filter(x => letterOf(progress, x.id).state !== 'unmet').map(x => x.id), id]);
  const consonants = [...known].filter(x => pack.byId.get(x).role === 'consonant' && x !== 'c-ng');
  const vowels = [...known].filter(x => pack.byId.get(x).role === 'vowel');
  let list;
  if (id === 'c-ng') list = vowels.slice(0, 3).map(v => pack.syllable(null, v));
  else if (l.role === 'final') list = pack.FINAL_FRAME.initials.filter(c => c && known.has(c)).slice(0, 3).map(c => pack.syllable(c, 'v-a', id)); // 소리 목록의 받침 틀 안에서
  else if (l.role === 'vowel') list = [pack.syllable(null, id), ...(l.alone ? [] : l.compound ? (COMPOUND_WITH[id] || []).filter(c => known.has(c)) : consonants.slice(-2)).map(c => pack.syllable(c, id))];
  else list = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-i'].filter(v => known.has(v)).slice(0, 3).map(v => pack.syllable(id, v));
  const word = readableWords(pack, known).find(w => w.letters.includes(id) && [...w.text].length <= 3);
  return [...new Set([...list, ...(word ? [word.text] : [])])].slice(0, 4);
}
// 받침의 소리 길잡이. ㄷ·ㅅ·ㅈ은 받침에서 소리가 같고(대표음), ㄱ·ㄷ·ㅂ은 터뜨리지 않고 막는다(설계 §3).
const FINAL_NOTE = {
  'f-ng': '받침 ㅇ은 소리가 있어요. 소리가 없는 첫소리 ㅇ과 달라요.',
  'f-g': '받침 ㄱ은 소리를 막고 끝내요. 터뜨리지 않아요.',
  'f-d': '받침 ㄷ은 소리를 막고 끝내요. 터뜨리지 않아요.',
  'f-b': '받침 ㅂ은 입을 다물고 끝내요. 터뜨리지 않아요.',
  'f-s': '받침 ㅅ은 받침 ㄷ과 같은 소리로 읽어요.',
  'f-j': '받침 ㅈ도 받침 ㄷ과 같은 소리로 읽어요.',
};
// 거센소리(U5): 짝인 예사소리에 획을 더한 글자다(글자 만든 원리 — 조사 10-04: 제자원리 순서로 배운 외국인의 자모 점수가 높았다).
// [짝 자음, 모양도 획 하나 더한 것인지]. ㅍ은 ㅂ과 소리 짝이지만 모양은 획 하나 차이가 아니다.
const ASPIRATED = { 'c-k': ['c-g', true], 'c-t': ['c-d', true], 'c-p': ['c-b', false], 'c-ch': ['c-j', true] };
const ASPIRATED_NOTE = { 'c-k': 'ㄱ에 획을 하나 더하면 ㅋ. 숨을 세게 내보내요.', 'c-t': 'ㄷ에 획을 하나 더하면 ㅌ. 숨을 세게 내보내요.',
  'c-p': 'ㅍ은 ㅂ보다 숨을 세게 내보내요.', 'c-ch': 'ㅈ에 획을 하나 더하면 ㅊ. 숨을 세게 내보내요.' };
// 된소리(U8): 짝인 예사소리를 둘 쓴 글자다. [예사소리, 거센소리(ㅆ은 없음)] — 세 소리(가 · 카 · 까)를 눌러 견준다.
const TENSE = { 'c-kk': ['c-g', 'c-k'], 'c-tt': ['c-d', 'c-t'], 'c-pp': ['c-b', 'c-p'], 'c-ss': ['c-s', null], 'c-jj': ['c-j', 'c-ch'] };
const TENSE_NOTE = { 'c-kk': 'ㄱ을 둘 쓰면 ㄲ. 목에 힘을 주고, 숨은 내보내지 않아요.', 'c-tt': 'ㄷ을 둘 쓰면 ㄸ. 목에 힘을 주고, 숨은 내보내지 않아요.',
  'c-pp': 'ㅂ을 둘 쓰면 ㅃ. 목에 힘을 주고, 숨은 내보내지 않아요.', 'c-ss': 'ㅅ을 둘 쓰면 ㅆ. ㅅ보다 힘을 주어 단단하게 내요.',
  'c-jj': 'ㅈ을 둘 쓰면 ㅉ. 목에 힘을 주고, 숨은 내보내지 않아요.' };
// 겹모음(U9): 아는 모음 둘을 합친 글자다 — 두 소리를 빨리 이어 말하면 그 소리(ㅗ + ㅏ = ㅘ, 오 + 아 → 와).
// ㅒ·ㅖ는 ㅐ·ㅔ에 획을 더한 글자(ㅏ가 ㅑ가 되는 원리)라 [짝 모음, null]. ㅚ는 ㅗ와 ㅣ를 합쳤지만 소리는 [웨]처럼 난다.
const COMPOUND = { 'v-wa': ['v-o', 'v-a'], 'v-wo': ['v-u', 'v-eo'], 'v-wi': ['v-u', 'v-i'], 'v-ui': ['v-eu', 'v-i'], 'v-oe': ['v-o', 'v-i'],
  'v-wae': ['v-o', 'v-ae'], 'v-we': ['v-u', 'v-e'], 'v-ye': ['v-e', null], 'v-yae': ['v-ae', null] };
const COMPOUND_NOTE = { 'v-wa': '오와 아를 빨리 이어 말하면 와.', 'v-wo': '우와 어를 빨리 이어 말하면 워.', 'v-wi': '우와 이를 빨리 이어 말하면 위.',
  'v-ui': '으와 이를 빨리 이어 말하면 의.', 'v-oe': 'ㅗ와 ㅣ를 합쳤지만, 소리는 「우에」를 빨리 말한 소리예요.', 'v-wae': '오와 애를 빨리 이어 말하면 왜.',
  'v-we': '우와 에를 빨리 이어 말하면 웨.', 'v-ye': 'ㅔ에 획을 하나 더하면 ㅖ. ㅓ가 ㅕ가 되는 것과 같아요.', 'v-yae': 'ㅐ에 획을 하나 더하면 ㅒ. ㅏ가 ㅑ가 되는 것과 같아요.' };
// 겹모음 만나기 카드의 음절 보기는 흔히 쓰는 음절로(과·화, 뭐·줘, 귀·쥐, 회·되, 돼·꽤, 궤).
const COMPOUND_WITH = { 'v-wa': ['c-g', 'c-h'], 'v-wo': ['c-m', 'c-j'], 'v-wi': ['c-g', 'c-j'], 'v-oe': ['c-h', 'c-d'], 'v-wae': ['c-d', 'c-kk'], 'v-we': ['c-g'] };
// 지금의 한국어에서 소리가 같은 모음.
const SAME_SOUND_GROUPS = [['v-ae', 'v-e'], ['v-yae', 'v-ye'], ['v-oe', 'v-wae', 'v-we']];
function noteFor(id) {
  if (id === 'c-ng') return '첫소리 ㅇ은 소리가 없어요. 아는 ㅏ와 같은 소리예요.';
  if (ASPIRATED_NOTE[id]) return ASPIRATED_NOTE[id];
  if (TENSE_NOTE[id]) return TENSE_NOTE[id];
  if (isFinal(id)) return FINAL_NOTE[id] || (pack.letters.some(x => x.role === 'final' && x.id !== id && letterOf(progress, x.id).state !== 'unmet') ? null : '받침은 글자 아래에 붙는 끝소리예요.');
  // 소리가 같은 모음(ㅐ·ㅔ, ㅒ·ㅖ, ㅚ·ㅙ·ㅞ): 같은 소리의 글자를 이미 만났으면 그것부터 짚는다.
  const same = (SAME_SOUND_GROUPS.find(g => g.includes(id)) || []).filter(x => x === id || letterOf(progress, x).state !== 'unmet');
  if (same.length > 1) return `${same.length === 2 ? `${glyph(same[0])}와 ${glyph(same[1])}` : same.map(glyph).join('·')}는 소리가 같아요. 낱말마다 쓰는 글자가 정해져 있어요.`;
  return COMPOUND_NOTE[id] || null;
}
function renderMeet(id) {
  const l = pack.byId.get(id);
  progress = meet(progress, [id], now()); save(); S.met.push(id);
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': `${l.glyph} 소리 듣기` });
  speak.addEventListener('click', () => play(speak, l.voice));
  const note = noteFor(id);
  const pad = tracePad(l.glyph);
  // 자음 그림 연상: 글자 모양이 든 그림과 그 소리로 시작하는 낱말(첫 글자를 강조). 누르면 낱말을 듣는다.
  const mn = pack.mnemonics[id];
  // 받침은 그 받침으로 끝나는 낱말이라 「손 = 소 + ㄴ」처럼 받침이 붙는 모습을 함께 보인다.
  const splitFinal = word => { const last = [...word].at(-1), dd = decompose(last); return dd ? `${[...word].slice(0, -1).join('')}${compose(dd.initial, dd.medial)} + ${l.glyph}` : ''; };
  // 강조할 음절: 그 글자가 든 첫 음절(자음은 첫소리, 모음은 가운뎃소리 — 사과의 「과」).
  const chars = mn ? [...mn.word] : [];
  const hit = Math.max(0, chars.findIndex(ch => { const dd = decompose(ch); return dd && (l.role === 'vowel' ? dd.medial === l.jamo : dd.initial === l.jamo); }));
  const mnemonic = mn ? el('button', { class: `mnemonic${l.role === 'final' ? ' final' : ''}`, type: 'button', 'aria-label': `${mn.word} 듣기`, onclick: () => audio.say(mn.word) },
    el('img', { src: mn.img, alt: '' }),
    l.role === 'final'
      ? el('span', { class: 'mn-word', 'aria-hidden': 'true' }, el('b', {}, mn.word), el('small', { class: 'mn-split' }, splitFinal(mn.word)))
      : el('span', { class: 'mn-word', 'aria-hidden': 'true' }, chars.slice(0, hit).join(''), el('b', {}, chars[hit]), chars.slice(hit + 1).join('')),
    icon('speaker')) : null;
  // 짝 글자에서 오는 글자: 거센소리 「ㄱ + 획 = ㅋ」, 된소리 「ㄱ + ㄱ = ㄲ」, 겹모음 「ㅗ + ㅏ = ㅘ」(ㅒ·ㅖ는 「ㅐ + 획」). 글자는 눌러 듣는다(자음은 가, 모음은 아).
  const sound = x => el('button', { class: 'example', type: 'button', 'aria-label': `${pack.byId.get(x).voice} 듣기`, onclick: () => audio.say(pack.byId.get(x).voice) },
    el('span', { class: 'derive-glyph' }, glyph(x)), el('small', {}, pack.byId.get(x).voice));
  const op = t => el('span', { class: 'op', 'aria-hidden': 'true' }, t);
  const stroke = () => el('span', { class: 'piece stroke-piece', 'aria-hidden': 'true' });
  const asp = ASPIRATED[id], tense = TENSE[id], comp = COMPOUND[id];
  const derive = asp ? el('div', { class: 'derive', 'aria-label': asp[1] ? `${glyph(asp[0])}에 획을 더하면 ${l.glyph}` : `${glyph(asp[0])}과 ${l.glyph}${josa(l.glyph, '은', '는')} 짝` },
    sound(asp[0]), asp[1] ? [op('+'), stroke(), op('=')] : null, sound(id))
    : tense ? el('div', { class: 'derive', 'aria-label': `${glyph(tense[0])}을 둘 쓰면 ${l.glyph}` },
      sound(tense[0]), op('+'), el('span', { class: 'piece twin-piece', 'aria-hidden': 'true' }, glyph(tense[0])), op('='), sound(id))
    : comp ? el('div', { class: 'derive', 'aria-label': comp[1] ? `${glyph(comp[0])}와 ${glyph(comp[1])}를 합치면 ${l.glyph}` : `${glyph(comp[0])}에 획을 더하면 ${l.glyph}` },
      sound(comp[0]), op('+'), comp[1] ? sound(comp[1]) : stroke(), op('='), sound(id))
    : null;
  // 된소리는 세 소리(가 · 카 · 까)를 눌러 견준다 — 예사·거센·된소리는 오래 가는 어려움이다(설계 §8).
  const trio = tense?.[1] ? el('div', { class: 'trio', 'aria-label': `${[tense[0], tense[1], id].map(x => pack.byId.get(x).voice).join(' · ')} 세 소리 견주기` },
    el('span', { class: 'row-tag', 'aria-hidden': 'true' }, '세 소리'), [tense[0], tense[1], id].map(sound)) : null;
  // 받침은 「아 + ㄴ = 안」처럼 붙는 자리와 소리를 함께 보인다. 양쪽 음절은 눌러 들을 수 있다.
  const sum = l.role === 'final' ? el('div', { class: 'sum', 'aria-label': `아에 받침 ${l.glyph}을 붙이면 ${l.voice}` },
    el('button', { class: 'example', type: 'button', 'aria-label': '아 듣기', onclick: () => audio.say(pack.syllable(null, 'v-a')) }, pack.syllable(null, 'v-a')),
    el('span', { class: 'op', 'aria-hidden': 'true' }, '+'), el('span', { class: 'piece final-piece', 'aria-hidden': 'true' }, l.glyph),
    el('span', { class: 'op', 'aria-hidden': 'true' }, '='),
    el('button', { class: 'example', type: 'button', 'aria-label': `${l.voice} 듣기`, onclick: () => audio.say(l.voice) }, l.voice)) : null;
  $('stage').replaceChildren(el('section', { class: `meet paper${l.role === 'final' ? ' final' : ''}` },
    l.role === 'final' ? el('span', { class: 'role-tag' }, '받침') : null,
    el('div', { class: 'glyph', 'aria-label': `새 ${l.role === 'final' ? '받침' : '글자'} ${l.glyph}` }, l.glyph),
    speak,
    mnemonic,
    derive,
    trio,
    sum,
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
  progress = answer(progress, { focus: item.focus, correct, perLetter, assisted, replays, confused, at: now(), sessionId: S.sessionId, counts, word: !!item.word });
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

// 듣고 고르기 · 짝 고르기(헷갈리는 짝 둘 중 들린 쪽) · 몽글에게 가르쳐 주기(몽글이 잘못 든 글자를 바로잡아 준다).
// 셋 다 소리를 듣고 고르는 같은 문항이고 정오를 똑같이 센다. 모양만 다르다.
const LISTEN_PROMPT = { pair: '헷갈리는 두 소리예요. 들은 쪽을 골라요', teach: '몽글이 헷갈려요. 들은 것을 골라 알려 줘요' };
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
  const options = item.options.map(o => el('button', { class: `opt${o.none ? ' none' : ''}`, type: 'button', 'aria-label': o.none ? `${o.text}, 받침 없음` : o.text }, el('span', { class: `big${item.word ? ' word' : ''}` }, o.text)));
  options.forEach((b, i) => b.addEventListener('click', () => choose(item.options[i], b)));
  const head = item.type === 'teach'
    ? el('div', { class: 'teach' }, el('img', { class: 'mongle', src: 'assets/brand/mongle-curious.webp', alt: '' }),
      el('div', { class: 'held', 'aria-label': `몽글이 든 글자 ${item.wrong}` }, el('span', { class: 'big' }, item.wrong), el('span', { class: 'q', 'aria-hidden': 'true' }, '?')))
    : null;
  // 가르쳐 주기는 몽글이 크게 나오니 안내 줄의 작은 몽글은 뺀다. replaceChildren은 null을 글자로 넣어 빈 자리는 걸러 낸다.
  $('stage').replaceChildren(...[prompt(LISTEN_PROMPT[item.type] || (item.word ? '소리를 듣고 맞는 낱말을 골라요' : '소리를 듣고 맞는 글자를 골라요'), { mini: !head }), head,
    el('div', { class: 'speak-row' }, speak, slowOffer(state, item.target.text, speak)), el('div', { class: `options${item.type === 'pair' ? ' pair' : ''}` }, options)].filter(Boolean));
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
    if (correct && item.type === 'teach') audio.effect('joy');
    feedback(correct, correct ? (item.type === 'teach' ? '몽글이 알았어요' : '맞아요') : '이 소리예요');
    if (!correct) { await audio.say(o.text); await audio.wait(250); await audio.say(item.target.text); }
  }
  if (!withDemo(item.type, state, () => [{ node: speak, run: () => hear() }, { node: options[item.options.findIndex(x => x.text === item.target.text)] }]))
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
    feedback(correct, correct ? '맞아요' : `${item.target.text}${josa(item.target.text, '은', '는')} 이 소리예요`);
    if (!correct) { await audio.say(o.text); await audio.wait(250); }
    await audio.say(item.target.text);
  }
  const i = item.options.findIndex(x => x.text === item.target.text);
  withDemo('see_pick', state, () => [{ node: options[i], run: async () => { options[i].classList.add('picked'); await play(null, item.options[i].text); } }, { node: confirm }],
    () => options[i].classList.remove('picked'));
}

// 음절 만들기: 들린 음절을 자음 조각과 모음 조각으로, 받침이 있으면 받침 조각까지 골라 만든다.
function renderBuild(item) {
  const t = item.target, withFinal = !!item.pieces.finals, state = { pid: rec.present(item), assisted: false, replays: 0, plays: 0, c: null, v: null, f: null, answered: false };
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
  const piece = (id, kind) => el('button', { class: `piece${kind === 'f' ? ' final-piece' : ''}`, type: 'button', 'aria-pressed': 'false', 'aria-label': nameOf(id), onclick: () => select(kind, id) }, glyph(id));
  const cs = item.pieces.consonants.map(id => piece(id, 'c')), vs = item.pieces.vowels.map(id => piece(id, 'v')), fs = (item.pieces.finals || []).map(id => piece(id, 'f'));
  const rows = { c: [cs, item.pieces.consonants], v: [vs, item.pieces.vowels], f: [fs, item.pieces.finals || []] };
  const ready = () => !!(state.c && state.v && (!withFinal || state.f));
  function select(kind, id) {
    if (state.answered) return;
    state[kind] = id;
    const [buttons, ids] = rows[kind];
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(ids[i] === id)));
    // 조각을 고르는 대로 글자가 합쳐져 보인다(자음·모음이 서기 전에는 고른 조각만, 받침은 그 아래에 붙는다).
    slot.textContent = state.c && state.v ? pack.syllable(state.c, state.v, state.f) : [state.c, state.v, state.f].filter(Boolean).map(glyph).join(' ') || '?';
    slot.classList.toggle('empty', !state.c && !state.v && !state.f);
    confirm.disabled = !ready();
  }
  $('stage').replaceChildren(prompt('들은 소리를 만들어요'), el('div', { class: 'speak-row' }, speak, slowOffer(state, t.text, speak)), slot,
    el('div', { class: 'pieces' }, el('div', { class: 'piece-row', 'aria-label': '자음' }, cs), el('div', { class: 'piece-row', 'aria-label': '모음' }, vs),
      withFinal ? el('div', { class: 'piece-row finals', 'aria-label': '받침' }, el('span', { class: 'row-tag', 'aria-hidden': 'true' }, '받침'), fs) : null));
  dock(confirm);
  async function submit() {
    if (state.answered || !ready()) return;
    state.answered = true; S.open = [];
    const cOk = state.c === t.consonant, vOk = state.v === t.vowel, fOk = !withFinal || state.f === t.final, correct = cOk && vOk && fOk;
    const made = pack.syllable(state.c, state.v, withFinal ? state.f : null);
    for (const b of [...cs, ...vs, ...fs]) b.disabled = true;
    slot.textContent = t.text; slot.classList.remove('empty');
    rec.answer(state.pid, correct);
    settle(item, { correct, assisted: state.assisted, replays: state.replays, perLetter: { [t.consonant]: cOk, [t.vowel]: vOk, ...(withFinal ? { [t.final]: fOk } : {}) },
      confused: [...(cOk ? [] : [[t.consonant, state.c]]), ...(vOk ? [] : [[t.vowel, state.v]]), ...(fOk ? [] : [[t.final, state.f]])] });
    feedback(correct, correct ? '맞아요' : `${made}${josa(made, '이', '가')} 아니라 ${t.text}${josa(t.text, '이에요', '예요')}`);
    if (!correct) { await audio.say(made); await audio.wait(250); await audio.say(t.text); }
  }
  const pieceOf = kind => { const [buttons, ids] = rows[kind]; return buttons[ids.indexOf(t[{ c: 'consonant', v: 'vowel', f: 'final' }[kind]])]; };
  const demoSteps = () => [{ node: speak, run: () => hear() }, { node: pieceOf('c'), run: async () => select('c', t.consonant) }, { node: pieceOf('v'), run: async () => select('v', t.vowel) },
    ...(withFinal ? [{ node: pieceOf('f'), run: async () => select('f', t.final) }] : []), { node: slot }];
  if (!withDemo(withFinal ? 'build_final' : 'build', state, demoSteps,
    () => { state.c = state.v = state.f = null; for (const b of [...cs, ...vs, ...fs]) b.setAttribute('aria-pressed', 'false'); slot.textContent = '?'; slot.classList.add('empty'); confirm.disabled = true; }))
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
  $('tomorrow').replaceChildren(...(v.tomorrow.length ? [el('p', {}, '다음에 만날 글자'), chipRow(v.tomorrow, v.tomorrowFinals)]
    : [el('p', {}, v.allMet ? '한글 글자를 다 만났어요.' : '')]));
  $('again').hidden = !canPlayMore(progress, at);
  // 노래로 복습: 오늘 자음을 다뤘으면 「그 아 가」, 아니면 「모음 댄스」.
  const songId = [...S.met, ...S.practiced].some(id => pack.byId.get(id)?.role === 'consonant') ? 'geu-a-ga' : 'vowel-dance';
  $('finish-song').dataset.song = songId;
  $('finish-song-label').textContent = `노래로 복습 · ${songById(songId).title} 30초`;
  audio.effect('achieve');
  S = null;
  // 졸업(설계 §8): 조건이 서는 회차 끝에 한 번. 졸업 장면을 먼저 보이고, 그 뒤는 짧은 몸풀기다.
  if (graduationReady(progress, pack)) { progress = graduate(progress, at); save(); return showGraduation(); }
  show('finish');
}
// 졸업 장면: 마스코트는 움직이지 않는다. 몽글 소리와 함께 명패(익힌 칸만 채워진 그대로 — 남은 칸은 졸업 뒤에 채워진다)와
// 이제 읽을 수 있는 받침 낱말이 놓인다.
const GRAD_WORDS = ['한국어', '안녕', '사랑', '김밥'];
function showGraduation() {
  const v = view(progress, pack, now());
  $('grad-plate').replaceChildren(...v.plate.map(s => el('div', { class: 'syl', 'aria-label': s.text }, s.cells.map(c => el('span', { class: `cell${c.filled ? ' filled' : ''}`, 'aria-hidden': 'true' }, c.glyph)))));
  const known = new Set(v.letters.filter(l => l.state !== 'unmet').map(l => l.id));
  const words = readableWords(pack, known).filter(w => w.letters.some(isFinal));
  const shown = [...GRAD_WORDS.map(t => words.find(w => w.text === t)).filter(Boolean), ...words].filter((w, i, all) => all.indexOf(w) === i).slice(0, 4);
  $('grad-words').replaceChildren(...shown.map(w => el('button', { class: 'example', type: 'button', 'aria-label': `${w.text} 듣기`, onclick: () => audio.say(w.text) }, w.text, icon('speaker'))));
  $('grad-games').hidden = !HUB; if (HUB) $('grad-games').href = HUB;
  $('grad-note').hidden = !hosted;
  show('graduation');
  setTimeout(() => audio.effect('joy'), 700);
}
$('again').addEventListener('click', () => startSession());
$('finish-song').addEventListener('click', () => openSong($('finish-song').dataset.song, 'review'));
$('grad-done').addEventListener('click', () => { renderHome(); show('home'); });
$('done').addEventListener('click', () => { renderHome(); show('home'); });
$('quit').addEventListener('click', () => {
  audio.stop();
  for (const pid of S?.open || []) rec.leave(pid);
  if (S && S.answered >= 3) progress = finishSession(progress, { day: S.plan.day, sessionNo: S.sessionNo, total: S.answered, independent: S.independent });
  save(); rec.flush(); S = null; renderHome(); show('home');
});

// ── 노래 ──────────────────────────────────────────────
// 노래 시각에 맞춰 글자를 켠다: 모음은 크게 + 동작 화살표, 합치기는 「ㄱ + ㅏ = 가」 세 걸음, 후렴은 글자 줄을 차례로.
// 몽글은 움직이지 않는다. 글자 진도·아틀라스 기록에는 넣지 않는다(설계 §6 장단 — 세지 않는다).
function durationText(sec) { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return m ? `${m}분 ${s}초` : `${s}초`; }
const MOVE_WORD = { right: '오른쪽', left: '왼쪽', up: '위로', down: '아래', wide: '옆으로 쭉', tall: '차렷',
  right2: '오른쪽 두 번', left2: '왼쪽 두 번', up2: '위로 두 번', down2: '아래 두 번' };
const consonantGlyph = id => pack.byId.get(id)?.glyph || EXTRA_CONSONANTS[id]?.[0] || '';
// 자음 + 모음 음절. ㅇ은 소리 없는 첫소리, 거센소리(ㅊㅋㅌㅍ)는 아직 길에 없어 유니코드 번호로 만든다.
function songSyllable(c, v = 'v-a') {
  if (c === 'c-ng') return pack.syllable(null, v);
  if (pack.byId.has(c)) return pack.syllable(c, v);
  return compose(EXTRA_CONSONANTS[c][1], pack.byId.get(v).jamo);
}
const consonantSound = c => (c === 'c-ng' ? '쉿' : songSyllable(c, 'v-eu')); // 그 느 드 … 츠 크 트 프
function moveIcon(move) {
  const dir = move.replace('2', ''), two = move.endsWith('2');
  const arrows = dir === 'wide' ? ['left', 'right'] : dir === 'tall' ? ['up', 'down'] : two ? [dir, dir] : [dir];
  return el('span', { class: `move ${dir}${two ? ' two' : ''}`, 'aria-hidden': 'true' }, arrows.map(d => el('span', { class: `arrow ${d}` })));
}
function songStage(cue) {
  if (!cue) return [el('img', { class: 'song-mongle', src: 'assets/brand/mongle-smile.webp', alt: '' })];
  if (cue.kind === 'line') return [el('p', { class: 'song-text' }, cue.text)];
  if (cue.kind === 'vowel') {
    const l = pack.byId.get(cue.letter);
    return [el('div', { class: 'song-vowel', 'aria-label': `${l.glyph} ${l.voice}` }, el('span', { class: 'song-tile big', 'data-i': '0' }, l.glyph), moveIcon(cue.move)),
      el('p', { class: 'song-cue' }, `${MOVE_WORD[cue.move]} ${l.voice}!`)];
  }
  if (cue.kind === 'sweep') {
    const texts = cue.letters.map(id => (cue.syllables ? songSyllable(id) : cue.consonant ? songSyllable(cue.consonant, id) : pack.byId.get(id).glyph));
    return [el('div', { class: `song-row n${texts.length}`, 'aria-label': texts.join(' ') }, texts.map((t, i) => el('span', { class: 'song-tile', 'data-i': String(i) }, t)))];
  }
  if (cue.kind === 'blend') {
    const c = cue.consonant, v = pack.byId.get(cue.vowel), made = songSyllable(c, cue.vowel);
    const part = (i, glyph, sound, extra = '', pic = null) => el('span', { class: 'part', 'data-i': String(i) }, pic ? el('img', { class: 'song-mn', src: pic, alt: '' }) : null,
      el('span', { class: `song-tile${extra}` }, glyph), el('small', {}, sound));
    return [el('div', { class: 'song-blend', 'aria-label': `${consonantGlyph(c)} 더하기 ${v.glyph}는 ${made}` },
      part(0, consonantGlyph(c), consonantSound(c), '', pack.mnemonics[c]?.img || null), el('span', { class: 'op', 'aria-hidden': 'true' }, '+'),
      part(1, v.glyph, v.voice), el('span', { class: 'op', 'aria-hidden': 'true' }, '='), part(2, made, made, ' result'))];
  }
  return [];
}
let SP = null;
function renderSongAt(t) {
  if (!SP) return null;
  const { song } = SP, { cue, step } = cueAt(song, t);
  SP.t = t; SP.step = step;
  // 진행 막대: 30초 복습은 그 구간 안에서, 노래 듣기는 노래 전체에서.
  $('song-bar').style.width = `${Math.min(100, Math.max(0, ((t - SP.from) / (SP.to - SP.from)) * 100))}%`;
  // 회차 끝 장단은 구간 끝에서 멈추고, 이 노래에 나온 아는 글자 수를 보인다(점수 아님).
  if (SP.mode === 'review' && t >= SP.to) {
    if (!SP.done) {
      SP.done = true; SP.key = 'done'; SP.audio.pause(); cancelAnimationFrame(SP.raf);
      const met = [...lettersIn(song, SP.from, SP.to)].filter(id => SP.known.has(id));
      $('song-stage').replaceChildren(el('img', { class: 'song-mongle', src: 'assets/brand/mongle-smile.webp', alt: '' }), el('p', { class: 'song-text' }, `아는 글자 ${met.length}개가 노래에 나왔어요`));
      $('song-line').textContent = '';
      $('song-hint').textContent = '글자를 더 배우면 노래에서 더 많이 켜져요';
      $('song-play-label').textContent = '다시 듣기';
      $('song-play').querySelector('.disc').classList.add('play');
    }
    return { cue: null, step: -1, done: true };
  }
  const key = cue ? String(song.cues.indexOf(cue)) : 'none';
  if (key !== SP.key) {
    SP.key = key;
    $('song-stage').replaceChildren(...songStage(cue));
    // 장단: 아직 만나지 않은 글자의 칸은 옅게 두고 켜지 않는다.
    if (SP.mode === 'review' && cue) for (const n of $('song-stage').querySelectorAll('[data-i]')) {
      if (!tileLetters(cue, Number(n.dataset.i)).every(id => SP.known.has(id))) n.classList.add('unmet');
    }
    // 가사 줄은 글자가 보이는 장면(줄 켜기·합치기)에서만 — 모음·가사 장면은 이미 크게 글로 보인다.
    $('song-line').textContent = cue && (cue.kind === 'sweep' || cue.kind === 'blend') ? cue.text : '';
    // 따라 하기 안내: 모음은 몸으로(손을 뻗는다), 글자 줄·합치기는 켜진 글자를 누른다.
    $('song-hint').textContent = !cue || cue.kind === 'line' ? '' : cue.kind === 'vowel' ? '손도 같이 뻗어 봐요' : '켜진 글자를 박자에 맞춰 눌러 봐요';
  }
  for (const n of $('song-stage').querySelectorAll('[data-i]')) {
    const i = Number(n.dataset.i), lit = !n.classList.contains('unmet');
    n.classList.toggle('on', lit && i === step); n.classList.toggle('done', lit && i < step);
  }
  return { cue, step };
}
// mode: listen(첫 화면 — 노래 전체, 모든 글자가 켜진다) · review(회차 끝 30초 장단 — 만난 글자만 켜진다).
function openSong(id, mode = 'listen') {
  const song = songById(id);
  if (!song) return;
  audio.stop(); closeSong(false);
  const a = new Audio(song.src);
  a.preload = 'auto';
  const [from, to] = mode === 'review' && song.review ? song.review : [0, song.duration];
  const known = new Set(pack.letters.filter(l => letterOf(progress, l.id).state !== 'unmet').map(l => l.id));
  SP = { song, audio: a, key: null, raf: 0, mode, from, to, known, done: false };
  if (from > 0) a.currentTime = from; // 메타데이터 전이면 시작 위치로 잡힌다
  a.addEventListener('ended', () => { setSongPlaying(false); renderSongAt(song.duration); });
  a.addEventListener('error', () => { $('song-note').hidden = false; });
  $('song-title').textContent = mode === 'review' ? `${song.title} · 30초 복습` : song.title;
  $('song-note').hidden = true;
  show('song'); renderSongAt(from); setSongPlaying(false);
}
function setSongPlaying(on) {
  if (!SP) return;
  const a = SP.audio;
  cancelAnimationFrame(SP.raf);
  if (on) {
    if (SP.mode === 'review' && (SP.done || a.currentTime >= SP.to || a.currentTime < SP.from)) { a.currentTime = SP.from; SP.done = false; SP.key = null; }
    else if (a.ended) a.currentTime = 0;
    // 재생을 청하면 곧바로 화면을 노래 시각에 맞춰 돌린다(소리 장치가 늦게 깨도 화면은 기다리지 않는다).
    a.play().catch(() => { $('song-note').hidden = false; setSongPlaying(false); });
    SP.raf = requestAnimationFrame(tick);
  } else a.pause();
  $('song-play-label').textContent = on ? '잠깐 멈춤' : a.ended || SP.done ? '다시 듣기' : a.currentTime > SP.from + 0.05 ? '이어 듣기' : '노래 시작';
  $('song-play').querySelector('.disc').classList.toggle('play', !on);
}
function tick() { if (!SP) return; renderSongAt(SP.audio.currentTime); if (!SP.audio.paused) SP.raf = requestAnimationFrame(tick); }
function closeSong(goHome = true) {
  if (SP) { cancelAnimationFrame(SP.raf); SP.audio.pause(); SP = null; }
  if (goHome) { renderHome(); show('home'); }
}
$('song-play').addEventListener('click', () => setSongPlaying(!!SP && SP.audio.paused));
$('song-close').addEventListener('click', () => closeSong());
// 따라 누르기(설계 §6 장단 「타일을 따라 누른다. 채점하지 않는다」): 지금 켜진 글자를 누르면 잠깐 빛난다. 점수·실패 표시는 없다.
$('song-stage').addEventListener('click', e => {
  const tile = e.target.closest('[data-i]');
  if (!tile || !SP || tile.classList.contains('unmet') || Number(tile.dataset.i) !== SP.step) return;
  tile.classList.remove('hit'); void tile.offsetWidth; tile.classList.add('hit');
  setTimeout(() => tile.classList.remove('hit'), 450);
});

// 화면 점검(?qa=silent)에서만: 지금 단계와 진도를 읽게 한다(qa/flow.cjs). 노래는 소리 없이 시각만 옮겨 그린다. 보통 화면에는 없다.
if (audio.voiceStatus() === 'silent') window.__hangulQA = Object.freeze({ step: () => (S ? S.steps[S.index] : null), progress: () => progress, key: KEY,
  songAt: t => { const r = renderSongAt(t); return r && { kind: r.cue?.kind || null, step: r.step, text: r.cue?.text || '', done: !!r.done }; }, song: () => SP?.song.id || null, songMode: () => SP?.mode || null, songTime: () => (SP ? SP.audio.currentTime : null), songSeek: t => { if (SP) SP.audio.currentTime = t; } });

renderHome(); show('home');
