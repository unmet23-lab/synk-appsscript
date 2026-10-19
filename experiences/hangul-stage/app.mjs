// 한글 단계 MVP 화면(docs/한글단계_설계.md). 글을 못 읽어도 시범·그림·소리로 할 수 있게 만든다.
// 2026-10-19 화면 언어 1판: 안내·이유 한 줄·마무리·글자 설명은 WORLD에서 고른 화면 언어(lang.mjs), 한글 글자·낱말은 늘 한국어다.
// 한국어 화면의 글은 예전과 같다(조사가 붙는 글은 원래 식 그대로 만든다). 판단은 core.mjs, 아틀라스 기록은 learning.mjs, 소리는 audio.mjs가 맡는다.
import { createPack, compose, decompose } from './pack.mjs';
import { josa } from './kit/josa.mjs';
import { readProgress, planSession, answer, meet, finishSession, view, retryItem, canPlayMore, sessionsToday, letterOf, readableWords, graduationReady, graduate, SETTINGS } from './core.mjs';
import { createCoach, isHosted, progressKey, createRecorder } from './learning.mjs';
import * as audio from './audio.mjs';
import { SONGS, songById, cueAt, EXTRA_CONSONANTS, tileLetters, lettersIn } from './songs.mjs';
import {hangulSupport} from '../brand-opening/game-tutor-support.mjs';
import { t as tr, currentLang as langNow, translatePage, STRINGS } from './lang.mjs';
// 한국어면 원래 식(조사 포함)을, 아니면 표의 글을 쓴다.
const say = (key, vars, korean) => langNow() === 'ko' && korean !== undefined ? korean : tr(key, vars);
const unitLabel = u => langNow() === 'ko' || !STRINGS['unit.' + u.id] ? u.label : tr('unit.' + u.id);

let gameTutor=null;
const tutorEvent=(kind,detail)=>gameTutor?.emit(kind,detail);
// WORLD 안(같은 출처의 .game-frame iframe)에서만: 공통 소리·진동·연출 설정(world-sound), 「우리 동네로」, 허브 링크 숨김.
// 단독(LAB) 화면에서는 이 모듈이 없을 수 있어 부르지 않는다. 불러오지 못하면 소리 없이 조용히 넘어간다.
const IN_WORLD = (() => { try { return !!window.frameElement?.classList?.contains('game-frame'); } catch { return false; } })();
if (IN_WORLD) document.documentElement.dataset.host = 'world';
let worldSound = null;
if (IN_WORLD) import('../brand-opening/world-sound.mjs').then(m => { worldSound = m; m.bindTaps(document); }).catch(() => {});
// 효과음은 하나로: WORLD 안에서는 world-sound(설정의 효과음 스위치)만, 단독 화면은 브랜드 사운드킷(audio.effect) 그대로.
const pickSound = () => { if (IN_WORLD) worldSound?.play('select'); };
function judge(correct, react = null) {
  if (IN_WORLD) { worldSound?.verdict(correct, { react }); return; }
  if (correct) audio.effect('earn');
  try { react?.(correct); } catch { /* 반응은 없어도 된다 */ }
}
// 결과 한 장의 연출(200ms 페이드 + 소리 한 번). 설정의 「보상 연출」이 꺼져 있으면 결과만 보인다.
const celebrate = () => !IN_WORLD || worldSound?.getPref('celebrate') !== false;
function finishSound(gotSomething) {
  if (!IN_WORLD) { audio.effect('achieve'); return; }
  if (!worldSound || !celebrate()) return;
  worldSound.play(gotSomething ? 'reward' : 'done'); worldSound.haptic('done');
}
// 「우리 동네로」: WORLD 홈이 동네로 돌아가기(goTown)를 알면 그걸, 아니면 놀이 판의 닫기 단추를 대신 누른다(사용자가 닫기를 누른 것과 같은 길 — 진도는 회차 끝에 이미 저장됐다).
function backToRoom() {
  try { const town = window.parent.__synkHome?.goTown; if (town) { town(); return true; } const close = window.parent.document.getElementById('panel-close'); if (close) { close.click(); return true; } } catch { /* 다른 출처 */ }
  return false;
}
// WORLD 첫 실행의 「한글을 읽을 수 있어요?」 답을 이 단계의 결과로 바꾼다(졸업·건너뛰기 → reads, 다시 배우기 → new).
// 그 답이 홈 추천의 「한글부터」를 끝내거나 다시 켠다. WORLD 밖이나 다른 출처면 조용히 넘어간다.
function tellWorld(answer, via) {
  if (!IN_WORLD) return;
  try { const result = window.parent.__synkHome?.setHangulReading?.(answer, via); result?.catch?.(() => {}); } catch { /* 다른 출처 */ }
}
// 졸업 뒤 WORLD의 생활 한국어 첫 레슨으로(놀이 판을 닫고 그 레슨을 연다).
const FIRST_LIFE_LESSON = 'greetings-expressions';
function toFirstLesson() {
  try { const start = window.parent.__synkHome?.startLifeLesson; if (start) { start(FIRST_LIFE_LESSON); return true; } } catch { /* 다른 출처 */ }
  return false;
}
const pad2 = n => String(n).padStart(2, '0');

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
// 화면 전환 움직임: WORLD 설정의 「움직임 줄이기」(같은 출처의 저장값)도 따른다(style.css의 html[data-reduced]). 판정·시범 순서는 그대로다.
try { if (localStorage.getItem('synk.world.maru.reduced') === 'true') document.documentElement.dataset.reduced = 'true'; } catch { /* 저장소를 못 쓰면 기기 설정만 따른다 */ }
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
const isFinal = id => pack.byId.get(id)?.role === 'final';
const nameOf = id => (isFinal(id) ? tr('final', { glyph: glyph(id) }) : glyph(id));
// 졸업 뒤 미니게임으로: 공통 서버(학습 허브와 같은 출처)에서 열었을 때만 허브로 잇는다. WORLD 안에서는 위의 게임 목록을 쓴다.
const HUB = !hosted && location.pathname.startsWith('/hangul-stage/') ? '../learning-hub/' : null;

if (new URLSearchParams(location.search).get('qa') === 'silent') audio.setSilent(true);
audio.initAudio();
translatePage();

function show(id) { for (const s of ['home', 'session', 'finish', 'graduation', 'song']) $(s).hidden = s !== id; scrollTo(0, 0);
  if (id === 'finish' || id === 'graduation') { const m = $(id); m.classList.remove('enter'); if (celebrate() && !still()) { void m.offsetWidth; m.classList.add('enter'); } } if(id==='home')tutorEvent('lobby');else if(id==='session')tutorEvent('playing');else if(id==='finish')tutorEvent('finish'); }

// ── 입구 ──────────────────────────────────────────────
function tile(l, { onTap = true } = {}) {
  const state = l.shown || l.state;
  const b = el('button', { class: `tile ${state}${l.role === 'final' ? ' final' : ''}`, type: 'button', 'aria-label': `${l.role === 'final' ? tr('final', { glyph: l.glyph }) : l.glyph} ${tr('state.' + state)}`, disabled: state === 'unmet' }, l.glyph);
  if (onTap && state !== 'unmet') b.addEventListener('click', () => audio.say(l.voice));
  return b;
}
// 첫 화면 노래 카드의 작은 글자(그 노래가 가르치는 것)
const SONG_GLYPHS = { 'vowel-dance': 'ㅏㅓㅗㅜ', 'geu-a-ga': 'ㄱ+ㅏ', batchim: '아+ㄴ', 'compound-dance': 'ㅗ+ㅏ' };
function renderHome() {
  const at = now(), v = view(progress, pack, at);
  const more = canPlayMore(progress, at), today = sessionsToday(progress, at);
  // 졸업 뒤에는 헷갈리기 쉬운 글자의 짧은 몸풀기다(설계 §8).
  const amount = v.graduated ? Math.min(progress.amount, SETTINGS.warmup) : progress.amount;
  // 포스터의 큰 글자는 지금 만날 글자 묶음(글을 아직 못 읽어도 무엇을 할지 보인다). 졸업 뒤에는 몸풀기.
  const nowUnit = v.units.find(u => u.status === 'now');
  const nowIndex = v.units.indexOf(nowUnit);
  $('hero-tag').textContent = v.graduated ? 'HANGUL · GRADUATED' : nowUnit ? `HANGUL · ROAD ${pad2(nowIndex + 1)} / ${pad2(v.units.length)}` : 'HANGUL STAGE';
  const heroWord = v.graduated ? tr('heroGraduated') : nowUnit ? [...nowUnit.glyphs].slice(0, 3).join(' ') : tr('heroTitle');
  $('hero-title').textContent = heroWord;
  $('hero-title').dataset.kind = !v.graduated && nowUnit ? 'glyphs' : 'word';
  $('hero-lede').textContent = v.graduated ? tr('lede.graduated') : nowUnit ? tr('lede.now', { unit: unitLabel(nowUnit) }) : tr('lede.default');
  $('start-label').textContent = tr(!more ? 'start.doneToday' : v.graduated ? 'start.warmup' : today ? 'start.again' : v.started ? 'start.continue' : 'start.start');
  $('start-sub').textContent = more ? tr('start.sub', { n: amount, min: { 5: 2, 10: 3, 15: 4 }[amount] }) : tr('start.subDone');
  $('start').disabled = !more || !audio.voiceReady();
  // 허브 링크는 공통 서버에서 혼자 열었을 때만. WORLD 안에서는 위 놀이 목록을 쓴다(게스트도).
  $('games').hidden = !(v.graduated && HUB && !IN_WORLD);
  if (HUB) $('games').href = HUB;
  $('games-note').hidden = !(v.graduated && (hosted || IN_WORLD));
  $('effects').hidden = IN_WORLD; // WORLD 안에서는 설정 시트의 효과음 스위치가 정한다
  const STATUS = Object.fromEntries(['done', 'now', 'started', 'next', 'later'].map(key => [key, tr('road.' + key)]));
  $('road').replaceChildren(...v.units.map((u, i) => el('li', { class: `${u.status}${u.final ? ' final' : ''}`, 'aria-label': `${i + 1}. ${unitLabel(u)} · ${STATUS[u.status]}` },
    el('span', { class: 'stop', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'glyphs', 'aria-hidden': 'true' }, [...u.glyphs].slice(0, 3).join('') + (u.glyphs.length > 3 ? '…' : '')))));
  const current = v.units.find(u => u.status === 'now');
  $('road-now').textContent = v.graduated ? tr('road.graduated') : current ? tr('road.current', { unit: unitLabel(current) }) : v.units.every(u => u.status === 'done' || u.status === 'later') ? tr('road.allLearned') : '';
  // 글자 상자는 모음 · 자음 · 받침으로 나눠 보인다. 받침은 첫소리와 모양이 같아 묶음 이름으로 가른다.
  const GROUPS = [['vowel', tr('group.vowel')], ['consonant', tr('group.consonant')], ['final', tr('group.final')]];
  $('box').replaceChildren(...GROUPS.map(([role, label]) => el('div', { class: 'box-group' },
    el('h3', {}, label), el('div', { class: 'box' }, v.letters.filter(l => l.role === role).map(l => tile(l))))));
  $('amounts-block').hidden = !!v.graduated;
  // 노래로 배우기: 처음 온 사람의 입구이자 언제든 복습(조사 10-04 — 노래는 입구·복습·보상, 읽게 만드는 것은 연습).
  $('songs').replaceChildren(...SONGS.map(s => el('button', { class: 'song-card', type: 'button', 'aria-label': tr('song.listen', { title: s.title }), onclick: () => openSong(s.id) },
    el('span', { class: 'song-glyphs', 'aria-hidden': 'true' }, SONG_GLYPHS[s.id] || ''),
    el('span', { class: 'song-name' }, el('b', {}, s.title), el('small', {}, durationText(s.duration))))));
  $('signs').replaceChildren(...v.signs.map(s => {
    const b = el('button', { class: `sign${s.readable ? ' readable' : ''}`, type: 'button', disabled: !s.readable, 'aria-label': s.readable ? tr('sign.read', { text: s.text }) : tr('sign.hazy') },
      el('span', { class: 'plaque' }, el('span', { class: 'word', 'aria-hidden': 'true' }, s.syllables.map(x => el('span', { class: x.clear ? '' : 'hazy' }, x.text)))),
      el('small', {}, tr(s.readable ? 'sign.tap' : 'sign.notYet')));
    if (s.readable) b.addEventListener('click', () => audio.say(s.text));
    return b;
  }));
  $('plate').replaceChildren(...v.plate.map(s => el('div', { class: 'syl', 'aria-label': s.text },
    s.cells.map(c => el('span', { class: `cell${c.filled ? ' filled' : ''}${c.later ? ' later' : ''}`, 'aria-hidden': 'true' }, c.glyph)))));
  $('amounts').replaceChildren(...[5, 10, 15].map(n => el('button', { class: 'amount', type: 'button', role: 'radio', 'aria-checked': String(progress.amount === n),
    onclick: () => { progress = readProgress({ ...progress, amount: n }); save(); renderHome(); } }, tr('amount', { n }))));
  $('skip').hidden = progress.skipped || !!v.graduated;
  $('skipped-note').hidden = !progress.skipped;
  $('save-note').hidden = saved;
  $('save-note').textContent = tr(KEY ? 'saveNote.failed' : 'saveNote.none');
  $('effects').setAttribute('aria-pressed', String(audio.effectsEnabled()));
}
audio.onVoice(() => {
  const s = audio.voiceStatus(), note = $('voice-note');
  note.hidden = !(s === 'missing' || s === 'unsupported');
  note.textContent = tr(s === 'unsupported' ? 'voice.unsupported' : 'voice.missing');
  if (!$('home').hidden) renderHome();
});
$('start').addEventListener('click', () => startSession());
$('effects').addEventListener('click', () => { audio.setEffects(!audio.effectsEnabled()); renderHome(); });
$('skip').addEventListener('click', () => { $('sheet').hidden = false; $('sheet-stay').focus(); });
$('sheet-stay').addEventListener('click', () => { $('sheet').hidden = true; });
$('sheet-skip').addEventListener('click', () => { progress = readProgress({ ...progress, skipped: true }); save(); $('sheet').hidden = true; renderHome(); tellWorld('reads', 'skip'); });
$('unskip').addEventListener('click', () => { progress = readProgress({ ...progress, skipped: false }); save(); renderHome(); tellWorld('new', 'unskip'); });

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
    wrongRun: 0, retries: 0, retried: new Set(), open: [], missed: new Set() };
  show('session'); renderStep();
}
function bar() { $('bar').style.width = `${Math.round((S.answered / Math.max(1, S.total)) * 100)}%`; $('count').textContent = `${pad2(S.answered)} / ${pad2(S.total)}`; }
function dock(...kids) { $('dock').replaceChildren(...kids); }
function cta(label, { tone = 'coral', disc = '', onClick, disabled = false } = {}) {
  return el('button', { class: `felt-cta ${tone}`, type: 'button', disabled, onclick: onClick }, el('span', { class: 'cta-text' }, el('b', {}, label)), el('span', { class: `disc ${disc}`, 'aria-hidden': 'true' }));
}
function prompt(text, { mini = true } = {}) { return el('p', { class: 'prompt' }, mini ? el('img', { class: 'mini', src: 'assets/brand/mongle-curious.webp', alt: '' }) : null, text); }
function nextStep() { audio.stop(); S.open = []; S.index += 1; if (S.index >= S.steps.length) endSession(); else renderStep(); }
function renderStep() {
  scrollTo(0, 0); $('stage').scrollTop = 0; // 새 장은 맨 위에서(긴 만나기 카드를 내려 본 뒤 다음 장이 중간부터 보이지 않게, 가로 화면은 무대 안 스크롤)
  bar();
  const step = S.steps[S.index];
  if (step.kind === 'reason') return renderReason();
  if (step.kind === 'meet') return renderMeet(step.letter);
  const item = step.item;
  ({ listen_pick: renderListen, pair: renderListen, teach: renderListen, see_pick: renderSee, build: renderBuild, match: renderMatch })[item.type](item);
}

// 글자 칩. 받침 칩은 아래에 받침 자리 표시가 붙는다(모양만으로는 첫소리와 같아서).
function chipRow(glyphs, finals = []) {
  return el('div', { class: 'chips', 'aria-label': glyphs.map((g, i) => (finals[i] ? tr('final', { glyph: g }) : g)).join(' ') },
    glyphs.map((g, i) => el('span', { class: `chip${finals[i] ? ' final' : ''}`, 'aria-hidden': 'true' }, g)));
}
function renderReason() {
  const r = S.plan.reason;
  $('stage').replaceChildren(el('section', { class: 'reason paper' },
    el('img', { class: 'mongle', src: 'assets/brand/mongle-curious.webp', alt: '' }),
    el('p', {}, reasonText(r)),
    r.letters.length ? chipRow(r.letters, r.finals) : null));
  dock(cta(tr('start.start'), { disc: 'play', onClick: nextStep }));
}
// 이유 한 줄의 화면 언어 글(한국어는 core.mjs가 만든 글 그대로).
function reasonText(r) {
  if (langNow() === 'ko') return r.text;
  if (r.kind === 'pair') return tr('reason.pair.' + (r.when || 'before'));
  if (r.kind === 'new') return tr(r.finalOnly ? 'reason.newFinals' : 'reason.new', { n: r.count || r.letters.length });
  return STRINGS['reason.' + r.kind] ? tr('reason.' + r.kind) : r.text;
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
  if (id === 'c-ng') return say('note.c-ng', null, '첫소리 ㅇ은 소리가 없어요. 아는 ㅏ와 같은 소리예요.');
  if (ASPIRATED_NOTE[id]) return say('note.' + id, null, ASPIRATED_NOTE[id]);
  if (TENSE_NOTE[id]) return say('note.' + id, null, TENSE_NOTE[id]);
  if (isFinal(id)) return FINAL_NOTE[id] ? say('note.' + id, null, FINAL_NOTE[id]) : (pack.letters.some(x => x.role === 'final' && x.id !== id && letterOf(progress, x.id).state !== 'unmet') ? null : say('note.finalIntro', null, '받침은 글자 아래에 붙는 끝소리예요.'));
  // 소리가 같은 모음(ㅐ·ㅔ, ㅒ·ㅖ, ㅚ·ㅙ·ㅞ): 같은 소리의 글자를 이미 만났으면 그것부터 짚는다.
  const same = (SAME_SOUND_GROUPS.find(g => g.includes(id)) || []).filter(x => x === id || letterOf(progress, x).state !== 'unmet');
  if (same.length > 1) return say('note.sameSound', { letters: same.map(glyph).join(' · ') }, `${same.length === 2 ? `${glyph(same[0])}와 ${glyph(same[1])}` : same.map(glyph).join('·')}는 소리가 같아요. 낱말마다 쓰는 글자가 정해져 있어요.`);
  return COMPOUND_NOTE[id] ? say('note.' + id, null, COMPOUND_NOTE[id]) : null;
}
function renderMeet(id) {
  const l = pack.byId.get(id);
  progress = meet(progress, [id], now()); save(); S.met.push(id);
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': tr('listenSound', { text: l.glyph }) });
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
  const mnemonic = mn ? el('button', { class: `mnemonic${l.role === 'final' ? ' final' : ''}`, type: 'button', 'aria-label': tr('listenTo', { text: mn.word }), onclick: () => audio.say(mn.word) },
    el('img', { src: mn.img, alt: '' }),
    l.role === 'final'
      ? el('span', { class: 'mn-word', 'aria-hidden': 'true' }, el('b', {}, mn.word), el('small', { class: 'mn-split' }, splitFinal(mn.word)))
      : el('span', { class: 'mn-word', 'aria-hidden': 'true' }, chars.slice(0, hit).join(''), el('b', {}, chars[hit]), chars.slice(hit + 1).join('')),
    icon('speaker')) : null;
  // 짝 글자에서 오는 글자: 거센소리 「ㄱ + 획 = ㅋ」, 된소리 「ㄱ + ㄱ = ㄲ」, 겹모음 「ㅗ + ㅏ = ㅘ」(ㅒ·ㅖ는 「ㅐ + 획」). 글자는 눌러 듣는다(자음은 가, 모음은 아).
  const sound = x => el('button', { class: 'example', type: 'button', 'aria-label': tr('listenTo', { text: pack.byId.get(x).voice }), onclick: () => audio.say(pack.byId.get(x).voice) },
    el('span', { class: 'derive-glyph' }, glyph(x)), el('small', {}, pack.byId.get(x).voice));
  const op = t => el('span', { class: 'op', 'aria-hidden': 'true' }, t);
  const stroke = () => el('span', { class: 'piece stroke-piece', 'aria-hidden': 'true' });
  const asp = ASPIRATED[id], tense = TENSE[id], comp = COMPOUND[id];
  const derive = asp ? el('div', { class: 'derive', 'aria-label': asp[1] ? say('derive.stroke', { a: glyph(asp[0]), b: l.glyph }, `${glyph(asp[0])}에 획을 더하면 ${l.glyph}`) : say('derive.pair', { a: glyph(asp[0]), b: l.glyph }, `${glyph(asp[0])}과 ${l.glyph}${josa(l.glyph, '은', '는')} 짝`) },
    sound(asp[0]), asp[1] ? [op('+'), stroke(), op('=')] : null, sound(id))
    : tense ? el('div', { class: 'derive', 'aria-label': say('derive.twin', { a: glyph(tense[0]), b: l.glyph }, `${glyph(tense[0])}을 둘 쓰면 ${l.glyph}`) },
      sound(tense[0]), op('+'), el('span', { class: 'piece twin-piece', 'aria-hidden': 'true' }, glyph(tense[0])), op('='), sound(id))
    : comp ? el('div', { class: 'derive', 'aria-label': comp[1] ? say('derive.combine', { a: glyph(comp[0]), b: glyph(comp[1]), c: l.glyph }, `${glyph(comp[0])}와 ${glyph(comp[1])}를 합치면 ${l.glyph}`) : say('derive.stroke', { a: glyph(comp[0]), b: l.glyph }, `${glyph(comp[0])}에 획을 더하면 ${l.glyph}`) },
      sound(comp[0]), op('+'), comp[1] ? sound(comp[1]) : stroke(), op('='), sound(id))
    : null;
  // 된소리는 세 소리(가 · 카 · 까)를 눌러 견준다 — 예사·거센·된소리는 오래 가는 어려움이다(설계 §8).
  const trio = tense?.[1] ? el('div', { class: 'trio', 'aria-label': tr('trio', { sounds: [tense[0], tense[1], id].map(x => pack.byId.get(x).voice).join(' · ') }) },
    el('span', { class: 'row-tag', 'aria-hidden': 'true' }, tr('trioTag')), [tense[0], tense[1], id].map(sound)) : null;
  // 받침은 「아 + ㄴ = 안」처럼 붙는 자리와 소리를 함께 보인다. 양쪽 음절은 눌러 들을 수 있다.
  const sum = l.role === 'final' ? el('div', { class: 'sum', 'aria-label': say('sum', { glyph: l.glyph, voice: l.voice }, `아에 받침 ${l.glyph}을 붙이면 ${l.voice}`) },
    el('button', { class: 'example', type: 'button', 'aria-label': tr('listenTo', { text: pack.syllable(null, 'v-a') }), onclick: () => audio.say(pack.syllable(null, 'v-a')) }, pack.syllable(null, 'v-a')),
    el('span', { class: 'op', 'aria-hidden': 'true' }, '+'), el('span', { class: 'piece final-piece', 'aria-hidden': 'true' }, l.glyph),
    el('span', { class: 'op', 'aria-hidden': 'true' }, '='),
    el('button', { class: 'example', type: 'button', 'aria-label': tr('listenTo', { text: l.voice }), onclick: () => audio.say(l.voice) }, l.voice)) : null;
  $('stage').replaceChildren(el('section', { class: `meet paper${l.role === 'final' ? ' final' : ''}` },
    l.role === 'final' ? el('span', { class: 'role-tag' }, tr('tag.final')) : null,
    el('div', { class: 'glyph', 'aria-label': tr(l.role === 'final' ? 'newFinal' : 'newLetter', { glyph: l.glyph }) }, l.glyph),
    speak,
    mnemonic,
    derive,
    trio,
    sum,
    note ? el('p', { class: 'note' }, note) : null,
    el('div', { class: 'trace-head' }, el('span', {}, tr('trace')), el('button', { class: 'redo', type: 'button', 'aria-label': tr('traceRedo'), onclick: () => pad.clear() })),
    pad.node,
    el('div', { class: 'examples' }, examplesFor(id).map(t => el('button', { class: 'example', type: 'button', 'aria-label': tr('listenTo', { text: t }), onclick: () => audio.say(t) }, t, icon('speaker'))))));
  dock(cta(tr('next'), { onClick: nextStep }));
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
  const wrap = el('div', { class: 'trace' }), canvas = el('canvas', { 'aria-label': tr('traceArea', { glyph: g }) });
  wrap.append(canvas);
  // 소프트웨어 캔버스: WORLD가 이 iframe의 위 모서리를 둥글게 자르는데, GPU 캔버스(합성 층)가 있으면 크로뮴이 그 모서리를 밝게 비춘다(10-14 측정).
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const extent = 260, strokes = [];
  let ready = false, drawing = false, last = null, current = null;
  function size() {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!r.width) return;
    const width = Math.round(r.width * d), height = Math.round(r.height * d);
    if (ready && canvas.width === width && canvas.height === height) return;
    canvas.width = width; canvas.height = height;
    ctx.setTransform(width / extent, 0, 0, height / extent, 0, 0); ready = true; redraw();
  }
  function base() {
    ctx.clearRect(0, 0, extent, extent);
    ctx.fillStyle = '#dcdcd6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; // 중성 종이(style.css --paper) 위의 옅은 본
    ctx.font = `900 ${Math.round(extent * 0.72)}px SUIT, "Malgun Gothic", sans-serif`;
    ctx.fillText(g, extent / 2, extent / 2 + extent * 0.03);
  }
  function line(a, b) {
    ctx.strokeStyle = '#f96859'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function knot(p) { ctx.fillStyle = '#ae322a'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); }
  function redraw() {
    base();
    for (const stroke of strokes) {
      for (let i = 1; i < stroke.points.length; i++) line(stroke.points[i - 1], stroke.points[i]);
      if (stroke.ended) knot(stroke.points.at(-1));
    }
  }
  // Keep ink in a fixed coordinate space so rotating or resizing preserves it
  // and the next pointer event still lands directly beneath the fingertip.
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * extent / r.width, y: (e.clientY - r.top) * extent / r.height }; };
  canvas.addEventListener('pointerdown', e => { if (!ready) size(); drawing = true; last = point(e); current = { points: [last], ended: false }; strokes.push(current); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = point(e);
    line(last, p); current.points.push(p); last = p;
  });
  const end = () => { if (!drawing) return; drawing = false; if (last) { current.ended = true; knot(last); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end);
  const observer = new ResizeObserver(() => { if (!canvas.isConnected) { observer.disconnect(); return; } size(); });
  observer.observe(canvas);
  requestAnimationFrame(size); document.fonts?.ready.then(() => { if (!canvas.isConnected) return; if (ready) redraw(); else size(); });
  return { node: wrap, clear: () => { drawing = false; last = null; current = null; strokes.length = 0; if (ready) redraw(); else size(); } };
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
function feedback(correct, text, support=[], { reason = '', react = null, quiet = false } = {}) {
  tutorEvent(correct?'success':'retry',{answer:true,support});
  if (!quiet) judge(correct, react);
  // 판정 띠: 아래에서 올라오는 어두운 띠 하나 — LED 점 + 한 줄 + 이유 한 줄. 문제 칸 전체를 칠하지 않는다.
  dock(el('p', { class: `say${correct ? ' good' : ''}`, role: 'status' }, el('b', {}, text), reason ? el('span', {}, reason) : null), cta(tr('next'), { onClick: nextStep }));
  setTimeout(() => $('dock').querySelector('.felt-cta')?.focus({ preventScroll: true }), 30);
}
// 막힌 순간(설계 §8): 소리 문항에서 이어서 두 번 틀리면 천천히 다시 들을지 한 번 묻는다. 받아들이면 도움받은 문항이 된다.
function slowOffer(state, text, button, talker = 0) {
  if (S.wrongRun < 2) return null;
  const b = el('button', { class: 'slow', type: 'button' }, icon('speaker'), tr('slow'));
  b.addEventListener('click', async () => { if (!state.assisted) { state.assisted = true; rec.helped(state.pid); } await play(button, text, false, { slow: true, talker }); });
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
function renderListen(item) {
  const state = { pid: rec.present(item), assisted: false, replays: 0, plays: 0, heard:false, answered: false };
  S.open = [state.pid];
  // 여러 목소리로 듣고 고르기(HVPT, 10-09): 그 음절을 가진 목소리가 여럿이면 문항마다 한 목소리(문항 번호로 정해짐)로 묻고 답한다.
  const talker = audio.talkerFor(item.target.text, item.id || item.target.text);
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': tr('speak') });
  const hear = async (opts = {}) => {
    if (state.plays > 0) { state.replays += 1; rec.replay(state.pid); }
    state.plays += 1;
    const ok = await play(speak, item.target.text, false, { ...opts, talker });
    if(ok)state.heard=true;
    if (state.plays === 1) rec.delivered(state.pid, ok);
  };
  speak.addEventListener('click', () => hear());
  const options = item.options.map(o => el('button', { class: `opt${o.none ? ' none' : ''}`, type: 'button', 'aria-label': o.none ? tr('noFinal', { text: o.text }) : o.text }, el('span', { class: `big${item.word ? ' word' : ''}` }, o.text)));
  options.forEach((b, i) => b.addEventListener('click', () => choose(item.options[i], b)));
  // 문제 글자 자리: 소리만 들리는 동안은 큰 「?」, 답을 내면 정답 글자가 포스터 크기로 남는다(가르쳐 주기는 몽글이 든 글자가 그 자리).
  const ask = item.type === 'teach' ? null : el('div', { class: `ask${item.word ? ' word' : ''}` }, el('span', { class: 'ask-glyph', 'aria-hidden': 'true' }, '?'), el('div', { class: 'speak-row' }, speak, slowOffer(state, item.target.text, speak, talker)));
  const head = item.type === 'teach'
    ? el('div', { class: 'teach' }, el('img', { class: 'mongle', src: 'assets/brand/teach-curious.webp', alt: '', width: 320, height: 320 }),
      el('div', { class: 'held', 'aria-label': tr('held', { letter: item.wrong }) }, el('span', { class: 'big' }, item.wrong), el('span', { class: 'q', 'aria-hidden': 'true' }, '?')))
    : null;
  // 가르쳐 주기는 몽글이 크게 나오니 안내 줄의 작은 몽글은 뺀다. replaceChildren은 null을 글자로 넣어 빈 자리는 걸러 낸다.
  $('stage').replaceChildren(...[prompt(tr(item.type === 'pair' ? 'prompt.pair' : item.type === 'teach' ? 'prompt.teach' : item.word ? 'prompt.word' : 'prompt.letter'), { mini: !head }), head,
    ask || el('div', { class: 'speak-row' }, speak, slowOffer(state, item.target.text, speak, talker)), el('div', { class: `options${item.type === 'pair' ? ' pair' : ''}` }, options)].filter(Boolean));
  dock();
  async function choose(o, b) {
    if (state.answered) return;
    state.answered = true; S.open = [];
    const correct = o.text === item.target.text;
    options.forEach(x => { x.disabled = true; });
    const right = options[item.options.findIndex(x => x.text === item.target.text)];
    right.classList.add('right'); if (!correct) b.classList.add('wrong');
    if (ask) { ask.querySelector('.ask-glyph').textContent = item.target.text; ask.classList.add('revealed'); }
    if (!correct) S.missed.add(item.target.letter);
    rec.answer(state.pid, correct);
    settle(item, { correct, assisted: state.assisted, replays: state.replays, confused: correct ? [] : [[item.target.letter, o.letter]] });
    if (correct && item.type === 'teach' && !IN_WORLD) audio.effect('joy');
    // 가르쳐 주기의 몽글은 맞히면 웃는 얼굴로 한 번 바뀐다(WORLD에서는 설정의 「친구들의 반응」을 따른다).
    const mongle = head?.querySelector('.mongle');
    const react = mongle ? ok => { if (ok) mongle.src = 'assets/brand/teach-smile.webp'; } : null;
    feedback(correct, correct ? tr(item.type === 'teach' ? 'mongleGotIt' : 'ok') : tr('answerIs', { target: item.target.text }),correct?[]:hangulSupport({id:item.id,target:item.target.text,selected:o.text,options:item.options,heard:state.heard}),
      { react, reason: correct ? (item.type === 'teach' ? say('why.heard', { target: item.target.text }, `‘${item.target.text}’${josa(item.target.text, '을', '를')} 들었어요.`) : tr('why.sound', { target: item.target.text })) : say('why.compare', { chosen: o.text }, `고른 ‘${o.text}’${josa(o.text, '과', '와')} 정답 소리를 차례로 들려줘요.`) });
    if (!correct) { await audio.say(o.text, { talker }); await audio.wait(250); await audio.say(item.target.text, { talker }); }
    // 여러 목소리 음절은 맞혀도 정답 소리를 같은 목소리로 한 번 더(HVPT — 고르자마자 정답 소리를 들려준다)
    else if (audio.talkerCount(item.target.text) > 1) { await audio.wait(250); await audio.say(item.target.text, { talker }); }
  }
  if (!withDemo(item.type, state, () => [{ node: speak, run: () => hear() }, { node: options[item.options.findIndex(x => x.text === item.target.text)] }]))
    pause(300).then(() => { if (!state.answered) hear(); });
}

// 보고 고르기: 글자를 보고, 보기를 눌러 소리를 들은 뒤 맞는 소리를 고른다.
function renderSee(item) {
  const state = { pid: rec.present(item), assisted: false, picked: null, heardOptions:new Set(), answered: false };
  S.open = [state.pid];
  const options = item.options.map((o, i) => el('button', { class: 'opt sound', type: 'button', 'aria-label': tr('soundN', { n: i + 1 }) }, icon('speaker'), el('span', { class: 'num' }, String(i + 1))));
  const confirm = cta(tr('check'), { disc: 'check', disabled: true, onClick: () => submit() });
  options.forEach((b, i) => b.addEventListener('click', async () => {
    if (state.answered) return;
    state.picked = i; options.forEach((x, j) => x.classList.toggle('picked', j === i)); confirm.disabled = false; // 고르면 그 소리가 바로 난다(고르기 효과음은 소리와 겹쳐 넣지 않는다)
    if(await play(null, item.options[i].text))state.heardOptions.add(i);
  }));
  $('stage').replaceChildren(prompt(tr('prompt.see')), el('div', { class: `shown paper${item.word ? ' word' : ''}`, 'aria-label': item.target.text }, item.target.text),
    el('div', { class: 'options' }, options));
  dock(confirm);
  async function submit() {
    if (state.answered || state.picked == null) return;
    state.answered = true; S.open = [];
    const o = item.options[state.picked], correct = o.text === item.target.text;
    options.forEach(x => { x.disabled = true; x.classList.remove('picked'); });
    options[item.options.findIndex(x => x.text === item.target.text)].classList.add('right');
    if (!correct) { options[state.picked].classList.add('wrong'); S.missed.add(item.target.letter); }
    rec.answer(state.pid, correct);
    settle(item, { correct, assisted: state.assisted, confused: correct ? [] : [[item.target.letter, o.letter]], listening: false });
    feedback(correct, correct ? tr('ok') : say('thisSound', { target: item.target.text }, `${item.target.text}${josa(item.target.text, '은', '는')} 이 소리예요`),correct?[]:hangulSupport({id:item.id,target:item.target.text,selected:o.text,options:item.options,heard:state.heardOptions.has(state.picked)}),
      { reason: correct ? tr('why.again', { target: item.target.text }) : tr('why.compareSound') });
    if (!correct) { await audio.say(o.text); await audio.wait(250); }
    await audio.say(item.target.text);
  }
  const i = item.options.findIndex(x => x.text === item.target.text);
  withDemo('see_pick', state, () => [{ node: options[i], run: async () => { options[i].classList.add('picked'); await play(null, item.options[i].text); } }, { node: confirm }],
    () => options[i].classList.remove('picked'));
}

// 음절 만들기: 들린 음절을 자음 조각과 모음 조각으로, 받침이 있으면 받침 조각까지 골라 만든다.
function renderBuild(item) {
  const t = item.target, withFinal = !!item.pieces.finals, state = { pid: rec.present(item), assisted: false, replays: 0, plays: 0, heard:false, c: null, v: null, f: null, answered: false };
  S.open = [state.pid];
  const speak = el('button', { class: 'speak', type: 'button', 'aria-label': tr('speak') });
  const hear = async (opts = {}) => {
    if (state.plays > 0) { state.replays += 1; rec.replay(state.pid); }
    state.plays += 1;
    const ok = await play(speak, t.text, false, opts);
    if(ok)state.heard=true;
    if (state.plays === 1) rec.delivered(state.pid, ok);
  };
  speak.addEventListener('click', () => hear());
  const slot = el('div', { class: 'slot paper empty', 'aria-live': 'polite' }, '?');
  const confirm = cta(tr('check'), { disc: 'check', disabled: true, onClick: () => submit() });
  const piece = (id, kind) => el('button', { class: `piece${kind === 'f' ? ' final-piece' : ''}`, type: 'button', 'aria-pressed': 'false', 'aria-label': nameOf(id), onclick: () => select(kind, id) }, glyph(id));
  const cs = item.pieces.consonants.map(id => piece(id, 'c')), vs = item.pieces.vowels.map(id => piece(id, 'v')), fs = (item.pieces.finals || []).map(id => piece(id, 'f'));
  const rows = { c: [cs, item.pieces.consonants], v: [vs, item.pieces.vowels], f: [fs, item.pieces.finals || []] };
  const ready = () => !!(state.c && state.v && (!withFinal || state.f));
  function select(kind, id) {
    if (state.answered) return;
    state[kind] = id; pickSound();
    const [buttons, ids] = rows[kind];
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(ids[i] === id)));
    // 조각을 고르는 대로 글자가 합쳐져 보인다(자음·모음이 서기 전에는 고른 조각만, 받침은 그 아래에 붙는다).
    slot.textContent = state.c && state.v ? pack.syllable(state.c, state.v, state.f) : [state.c, state.v, state.f].filter(Boolean).map(glyph).join(' ') || '?';
    slot.classList.toggle('empty', !state.c && !state.v && !state.f);
    confirm.disabled = !ready();
  }
  $('stage').replaceChildren(prompt(tr('prompt.build')), el('div', { class: 'speak-row' }, speak, slowOffer(state, t.text, speak)), slot,
    el('div', { class: 'pieces' }, el('div', { class: 'piece-row', 'aria-label': tr('group.consonant') }, cs), el('div', { class: 'piece-row', 'aria-label': tr('group.vowel') }, vs),
      withFinal ? el('div', { class: 'piece-row finals', 'aria-label': tr('group.final') }, el('span', { class: 'row-tag', 'aria-hidden': 'true' }, tr('tag.final')), fs) : null));
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
    const wrongPart = !cOk ? t.consonant : !vOk ? t.vowel : !fOk ? t.final : null;
    if (wrongPart) S.missed.add(wrongPart);
    feedback(correct, correct ? tr('ok') : say('notButIs', { made, target: t.text }, `${made}${josa(made, '이', '가')} 아니라 ${t.text}${josa(t.text, '이에요', '예요')}`),correct?[]:hangulSupport({id:item.id,target:t.text,selected:made,options:[made,t.text],heard:state.heard}),
      { reason: correct ? say('why.built', { target: t.text }, `‘${t.text}’${josa(t.text, '을', '를')} 만들었어요.`) : tr('why.compareBuilt') });
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
  const letterCards = item.cards.map(c => el('button', { class: 'card', type: 'button', 'aria-pressed': 'false', 'aria-label': tr('letterN', { text: c.text }) }, c.text));
  const soundCards = item.sounds.map((c, i) => el('button', { class: 'card', type: 'button', 'aria-pressed': 'false', 'aria-label': tr('soundN', { n: i + 1 }) }, icon('speaker'), el('span', { class: 'num' }, String(i + 1))));
  letterCards.forEach((b, i) => b.addEventListener('click', () => pickCard('letter', item.cards[i].letter, b)));
  soundCards.forEach((b, i) => b.addEventListener('click', () => pickCard('sound', item.sounds[i].letter, b)));
  $('stage').replaceChildren(prompt(tr('prompt.match')), el('div', { class: 'match' }, el('div', { class: 'col', 'aria-label': tr('col.sounds') }, soundCards), el('div', { class: 'col', 'aria-label': tr('col.letters') }, letterCards)));
  dock();
  async function pickCard(kind, letter, button) {
    const p = pairs.get(letter);
    if (p.matched) return;
    for (const b of kind === 'sound' ? soundCards : letterCards) b.setAttribute('aria-pressed', String(b === button));
    state.sel[kind] = { letter, button };
    if (kind === 'letter') pickSound();
    // 소리가 끝까지 난 뒤에 짝을 본다: 듣기 전에 고른 답은 소리 문항의 근거가 되지 않는다.
    if (kind === 'sound') {
      state.playing = audio.say(pack.byId.get(letter).voice).then(ok => { if(ok)p.delivered=true; if (!p.heard) { p.heard = true; rec.delivered(p.pid, ok); } });
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
      judge(true);
      tutorEvent('success',{answer:true});
      const firstTry = !q.missed;
      rec.answer(q.pid, firstTry); S.open = S.open.filter(x => x !== q.pid);
      progress = answer(progress, { focus: [card.letter], correct: firstTry, assisted: state.assisted, at: now(), sessionId: S.sessionId, counts: false }); save();
      if (!state.left) finishMatch();
    } else {
      tutorEvent('retry',{answer:true,support:hangulSupport({id:item.id+'-'+sound.letter,target:glyph(sound.letter),selected:glyph(card.letter),options:item.cards.map(c=>c.text),glyph:pack.byId.get(sound.letter).voice,heard:pairs.get(sound.letter).delivered===true})});
      judge(false); S.missed.add(sound.letter);
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
    feedback(true, tr(clean ? 'allMatched' : 'allFound'), [], { quiet: true, reason: tr(clean ? 'why.matchedClean' : 'why.matchedFound', { n: pairs.size }) });
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
  // 결과 한 장(조사 ⑦): 큰 한글 한 줄 + 오늘 만난 글자(눌러 듣기) + 다시 볼 글자 하나 + 얻은 것 + 흰 알약 하나.
  $('finish-title').textContent = S.met.length ? tr('finish.newLetters', { n: S.met.length }) : tr('finish.questions', { n: S.answered });
  $('finish-tag').textContent = `RESULT · ${pad2(S.answered)} ITEMS`;
  $('finish-letters').replaceChildren(...shownToday.map(id => tile(byId.get(id))));
  const missedId = [...S.missed].find(id => byId.has(id) && byId.get(id).state !== 'unmet');
  $('finish-review').hidden = !missedId;
  $('finish-review').replaceChildren(...(missedId ? [el('p', {}, tr('finish.reviewTitle')), el('div', { class: 'finish-row-body' }, tile(byId.get(missedId)), el('span', { class: 'finish-row-note' }, tr('finish.reviewNote')))] : []));
  const mastered = v.letters.filter(l => l.shown === 'mastered' && !S.masteredBefore.has(l.id));
  const signs = v.signs.filter(s => s.readable && !S.readableBefore.has(s.text));
  $('finish-extra').replaceChildren(...[
    mastered.length ? el('p', {}, tr('finish.mastered')) : null,
    mastered.length ? el('div', { class: 'finish-letters' }, mastered.map(l => tile(l))) : null,
    ...signs.map(s => el('button', { class: 'sign readable', type: 'button', 'aria-label': tr('sign.read', { text: s.text }), onclick: () => audio.say(s.text) },
      el('span', { class: 'plaque' }, el('span', { class: 'word', 'aria-hidden': 'true' }, s.text)), el('small', {}, tr('finish.canRead'))))].filter(Boolean)); // replaceChildren은 null을 글자로 넣는다
  $('tomorrow').replaceChildren(...(v.tomorrow.length ? [el('p', {}, tr('finish.tomorrow')), chipRow(v.tomorrow, v.tomorrowFinals)]
    : [el('p', {}, v.allMet ? tr('finish.allMet') : '')]));
  $('again').hidden = !canPlayMore(progress, at);
  $('done-label').textContent = tr(IN_WORLD ? 'finish.toTown' : 'finish.toStart');
  // 노래로 복습: 오늘 겹모음을 다뤘으면 「겹모음 댄스」, 받침이면 「받침 노래」, 자음이면 「그 아 가」, 아니면 「모음 댄스」.
  const today = [...S.met, ...S.practiced].map(id => pack.byId.get(id)).filter(Boolean);
  const todayRoles = new Set(today.map(l => l.role));
  const songId = today.some(l => l.compound) ? 'compound-dance' : todayRoles.has('final') ? 'batchim' : todayRoles.has('consonant') ? 'geu-a-ga' : 'vowel-dance';
  $('finish-song').dataset.song = songId;
  $('finish-song-label').textContent = tr('finish.song', { title: songById(songId).title });
  finishSound(mastered.length > 0 || signs.length > 0);
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
  $('grad-words').replaceChildren(...shown.map(w => el('button', { class: 'example', type: 'button', 'aria-label': tr('listenTo', { text: w.text }), onclick: () => audio.say(w.text) }, w.text, icon('speaker'))));
  $('grad-games').hidden = !HUB || IN_WORLD; if (HUB) $('grad-games').href = HUB;
  $('grad-note').hidden = !(hosted || IN_WORLD);
  // WORLD 안: 졸업이 「한글부터」를 끝내고, 주 단추는 생활 한국어 첫 레슨으로 잇는다(우리 동네로는 둘째 단추).
  const lifeNext = IN_WORLD && (() => { try { return typeof window.parent.__synkHome?.startLifeLesson === 'function'; } catch { return false; } })();
  $('grad-life').hidden = !lifeNext;
  $('grad-done').classList.toggle('coral', !lifeNext); $('grad-done').classList.toggle('cream', !!lifeNext);
  $('grad-done-label').textContent = tr(IN_WORLD ? 'finish.toTown' : 'finish.toStart');
  tellWorld('reads', 'graduation');
  show('graduation');
  if (IN_WORLD) finishSound(true); else setTimeout(() => audio.effect('joy'), 700);
}
$('again').addEventListener('click', () => startSession());
$('finish-song').addEventListener('click', () => openSong($('finish-song').dataset.song, 'review'));
// 끝 → 홈: WORLD 안에서는 한 번에 우리 동네로(동네로 돌아가기 · 없으면 놀이 판 닫기), 단독 화면에서는 한글 입구로.
$('grad-done').addEventListener('click', () => { if (IN_WORLD && backToRoom()) return; renderHome(); show('home'); });
$('grad-life').addEventListener('click', () => { if (IN_WORLD && toFirstLesson()) return; renderHome(); show('home'); });
$('done').addEventListener('click', () => { if (IN_WORLD && backToRoom()) return; renderHome(); show('home'); });
$('quit').addEventListener('click', () => {
  audio.stop();
  for (const pid of S?.open || []) rec.leave(pid);
  if (S && S.answered >= 3) progress = finishSession(progress, { day: S.plan.day, sessionNo: S.sessionNo, total: S.answered, independent: S.independent });
  save(); rec.flush(); S = null; renderHome(); show('home');
});

// ── 노래 ──────────────────────────────────────────────
// 노래 시각에 맞춰 글자를 켠다: 모음은 크게 + 동작 화살표, 합치기는 「ㄱ + ㅏ = 가」 세 걸음, 후렴은 글자 줄을 차례로.
// 몽글은 움직이지 않는다. 글자 진도·아틀라스 기록에는 넣지 않는다(설계 §6 장단 — 세지 않는다).
// 노래 카드의 길이는 모노 숫자(1:26)로 — 글을 아직 못 읽어도 읽힌다.
function durationText(sec) { const t = Math.round(sec), m = Math.floor(t / 60), s = t % 60; return `${m}:${String(s).padStart(2, '0')}`; }
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
  // 노래 앞(신호 없음): 이 노래가 가르치는 글자를 크게 둔다(입구 노래 카드와 같은 글자).
  if (!cue) return [el('span', { class: 'song-idle', 'aria-hidden': 'true' }, SONG_GLYPHS[SP?.song.id] || '')];
  if (cue.kind === 'line') return [el('p', { class: 'song-text' }, cue.text)];
  if (cue.kind === 'vowel') {
    const l = pack.byId.get(cue.letter);
    return [el('div', { class: 'song-vowel', 'aria-label': `${l.glyph} ${l.voice}` }, el('span', { class: 'song-tile big', 'data-i': '0' }, l.glyph), moveIcon(cue.move)),
      el('p', { class: 'song-cue' }, `${MOVE_WORD[cue.move]} ${l.voice}!`)];
  }
  if (cue.kind === 'sweep') {
    const texts = cue.texts || cue.letters.map(id => (cue.syllables ? songSyllable(id) : cue.consonant ? songSyllable(cue.consonant, id) : pack.byId.get(id).glyph));
    return [el('div', { class: `song-row n${texts.length}`, 'aria-label': texts.join(' ') }, texts.map((t, i) => el('span', { class: 'song-tile', 'data-i': String(i) }, t)))];
  }
  const part = (i, glyph, sound, extra = '', pic = null) => el('span', { class: 'part', 'data-i': String(i) }, pic ? el('img', { class: 'song-mn', src: pic, alt: '' }) : null,
    el('span', { class: `song-tile${extra}` }, glyph), el('small', {}, sound));
  const op = sign => el('span', { class: 'op', 'aria-hidden': 'true' }, sign);
  // 떠올리기 줄(cue.ask)의 결과 칸: 노래가 답을 부를 때(그 칸이 켜질 때)까지 「?」(style.css .part.ask)
  const answer = (made, ask) => (ask ? [el('span', { class: 'ask-q' }, '?'), el('span', { class: 'ask-a' }, made)] : made);
  const result = (made, ask, pic = null) => { const p = part(2, answer(made, ask), answer(made, ask), ' result', pic); if (ask) p.classList.add('ask'); return p; };
  if (cue.kind === 'blend') {
    const c = cue.consonant, v = pack.byId.get(cue.vowel), made = songSyllable(c, cue.vowel);
    return [el('div', { class: 'song-blend', 'aria-label': cue.ask ? `${consonantGlyph(c)} 더하기 ${v.glyph}는?` : `${consonantGlyph(c)} 더하기 ${v.glyph}는 ${made}` },
      part(0, consonantGlyph(c), consonantSound(c), '', pack.mnemonics[c]?.img || null), op('+'),
      part(1, v.glyph, v.voice), op('='), result(made, !!cue.ask))];
  }
  // 겹모음 합치기(겹모음 댄스): 오 + 아 = 와 · 고 + 아 = 과. 칸은 노래가 부르는 음절 그대로다.
  if (cue.kind === 'compound') {
    const [a, b, made] = cue.texts;
    return [el('div', { class: 'song-blend', 'aria-label': cue.ask ? `${a} 더하기 ${b}는?` : `${a} 더하기 ${b}는 ${made}` },
      part(0, a, a), op('+'), part(1, b, b), op('='), result(made, !!cue.ask))];
  }
  // 받침 합치기(받침 노래): 바탕 음절 + 받침 = 음절. 받침 칸은 받침 표시(아래 짧은 줄)와 받침 소리(은·을·음·응), 낱말이면 결과 칸 위에 그림.
  if (cue.kind === 'batchim') {
    const f = pack.byId.get(cue.final);
    return [el('div', { class: 'song-blend', 'aria-label': `${cue.base}에 받침 ${f.glyph}을 붙이면 ${cue.made}` },
      part(0, cue.base, cue.base), op('+'), part(1, f.glyph, pack.syllable(null, 'v-eu', cue.final), ' final'), op('='),
      part(2, cue.made, cue.made, ' result', cue.pic || null))];
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
    $('song-line').textContent = cue && ['sweep', 'blend', 'batchim', 'compound'].includes(cue.kind) ? cue.text : '';
    // 따라 하기 안내: 모음은 몸으로(손을 뻗는다), 글자 줄·합치기는 켜진 글자를 누른다.
    $('song-hint').textContent = !cue || cue.kind === 'line' ? '' : cue.kind === 'vowel' ? '손도 같이 뻗어 봐요' : '켜진 글자를 박자에 맞춰 눌러 봐요';
  }
  for (const n of $('song-stage').querySelectorAll('[data-i]')) {
    const i = Number(n.dataset.i), lit = !n.classList.contains('unmet');
    n.classList.toggle('on', lit && i === step); n.classList.toggle('done', lit && i < step);
  }
  // 떠올리기 줄: 가사 줄도 답을 부를 때까지 물음만(「그 더하기 아는?」 → 「그 더하기 아는? 가!」)
  if (cue?.ask) { const text = step >= 2 ? cue.text : cue.ask; if ($('song-line').textContent !== text) $('song-line').textContent = text; }
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

// ?qa=silent is silent; ?qa=inspect reads the same step with actual MP3 playback.
// These existing QA controls never replace a learner response or grading.
if (audio.voiceStatus() === 'silent'||new URLSearchParams(location.search).get('qa')==='inspect') window.__hangulQA = Object.freeze({ step: () => (S ? S.steps[S.index] : null), progress: () => progress, key: KEY,
  songAt: t => { const r = renderSongAt(t); return r && { kind: r.cue?.kind || null, step: r.step, text: r.cue?.text || '', done: !!r.done }; }, song: () => SP?.song.id || null, songMode: () => SP?.mode || null, songTime: () => (SP ? SP.audio.currentTime : null), songSeek: t => { if (SP) SP.audio.currentTime = t; } });

renderHome(); show('home');

if(globalThis.parent&&globalThis.parent!==globalThis)void import('../brand-opening/game-tutor-channel.mjs').then(({connectGameTutor})=>{
 gameTutor=connectGameTutor('hangul',{onHelp:()=>audio.pauseForTutor(),onHelpClose:()=>audio.resumeFromTutor(),onPracticeComplete:()=>{if(!$('home').hidden&&!$('start').disabled)startSession();}});tutorEvent(S?'playing':'lobby');
}).catch(()=>{});
