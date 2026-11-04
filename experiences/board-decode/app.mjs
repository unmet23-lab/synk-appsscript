// 게시판 해독 — 흐름 · 화면(설계 experiences/board-decode/설계.md). 규칙은 core.mjs, 원고는 content.mjs, 소리는 sfx.mjs가 맡는다.
// 1인칭이다: 내 모습은 나오지 않고, 화면이 곧 내가 보는 게시판 + 내 휴대폰 대화다. 사진에는 글자가 없고 글은 전부 여기서 얹는다.
// 수첩 · 앨범은 이 게임의 저장소에만 둔다(설계 6절).
import { ROUNDS, WORDS, PICS } from './content.mjs';
import { STORE_KEY, ROUND_IDS, roundOf, normalizeSave, startRound, currentAsk, answer, applyPatch, closeScene, setMemo, memoShown, memoChoices, finishRound, otherScenes, peekScene, nextRoundId, noticeLines, makeRng } from './core.mjs';
import { createSound } from './sfx.mjs';
import { STR } from './strings.mjs';

const query = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const app = $('#app'), live = $('#live');
const rng = query.has('seed') ? makeRng(Number(query.get('seed'))) : Math.random;

const lang = (() => { const q = query.get('lang'); if (q) return q; try { return localStorage.getItem('synk.world.lang') || 'ko'; } catch { return 'ko'; } })();
document.documentElement.lang = lang;
const t = (key, vars = {}) => { const s = STR[key]; let text = s?.[lang] ?? s?.en ?? s?.ko ?? key; for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v); return text; };
const pick = (o) => (o && typeof o === 'object' ? o[lang] ?? o.en ?? o.ko : o);

// ── 앱 설정 · 저장 ─────────────────────────────────────────────
const parentRoot = () => { try { return window.parent?.document?.documentElement || null; } catch { return null; } };
// WORLD 앱 설정의 효과음 · 진동 — world-sound.mjs PREF_KEYS와 같은 열쇠(기본 켜짐).
const hostOff = (key) => { try { return localStorage.getItem(key) === 'false'; } catch { return false; } };
const hostMuted = () => hostOff('synk.world.sound');
const reduced = () => { try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch { /* 없는 환경 */ } return parentRoot()?.dataset?.motion === 'reduced'; };
if (reduced()) document.documentElement.classList.add('reduced');
const accountKey = (() => { try { return window.parent?.SYNKLearningHost?.status?.()?.accountKey || 'device'; } catch { return 'device'; } })();
const saveKey = `${STORE_KEY}:${accountKey}`;
const save = (() => { try { return normalizeSave(JSON.parse(localStorage.getItem(saveKey) || 'null')); } catch { return normalizeSave(null); } })();
function persist() { try { localStorage.setItem(saveKey, JSON.stringify(save)); } catch { /* 저장을 못 해도 판은 그대로 돈다 */ } }
let soundOn = (() => { try { return localStorage.getItem('synk.board-decode.sound') !== 'off'; } catch { return true; } })();
const sound = createSound({ canPlay: () => soundOn && !hostMuted() });
document.addEventListener('visibilitychange', () => { if (document.hidden) sound.pause(); else sound.resume(); });
const buzz = (ms = 10) => { if (hostOff('synk.world.haptic')) return; try { navigator.vibrate?.(ms); } catch { /* 없는 기기 */ } };
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 160) : ms));
const photo = (name) => `assets/photo/${name}.webp`;
const say = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };
const preload = (names) => { for (const n of new Set(names)) { const i = new Image(); i.src = photo(n); } };

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10z" fill="currentColor"/><path d="M16 10l5 5m0-5l-5 5"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>',
};

// ── 상태 ─────────────────────────────────────────────────────────
let S = null;              // core 판 상태
let view = 'intro';
let picked = query.get('round') && ROUND_IDS.includes(query.get('round')) ? query.get('round') : nextRoundId(save);
let busy = false, combo = 0, lastRound = null, panel = null, panelFrom = null, peek = null, endShown = false;
const ui = { clue: null, clueIdx: 0, memoNew: null, memoChoices: {}, sweep: [], drop: false, hint: false, seen: new Set() };

// ── 포커스 ───────────────────────────────────────────────────────
// 화면을 innerHTML로 다시 그리면 누른 단추가 사라져 포커스가 문서 맨 앞으로 튄다. 그릴 때마다 다음 자리를 정해 준다. 마우스 · 터치로는 표시가 보이지 않는다.
const focusOn = (target) => { (typeof target === 'string' ? $(target) : target)?.focus({ preventScroll: true }); };
const focusWord = (w) => focusOn(`[data-w="${CSS.escape(w)}"]`);
/** 수첩 · 장면이 위에 있으면 그 뒤는 키보드 · 화면 읽기로 닿지 않게 한다. */
function syncModal() {
  const top = $('.panel') || $('#over .scene');
  for (const el of app.children) el.inert = !!top && !el.contains(top);
}

// ── 입구 ─────────────────────────────────────────────────────────
function paintIntro() {
  preload(ROUNDS.map((r) => r.board));
  view = 'intro';
  const strips = Array.from({ length: 6 }, (_, i) => `<button data-tear="${i}" aria-label="${esc(t('lobby.strip'))}">${esc(t('lobby.strip'))}</button>`).join('');
  app.innerHTML = `<section class="intro" id="intro" style="background-image:url(${photo('board-dorm')})">
    <div class="poster"><small>새솔대 학생회관 알림</small><h1>${esc(t('title'))}</h1><p>${esc(t('lobby.sub'))}</p>
      <div class="tear-h">${ICON.down}${esc(t('lobby.tear'))}</div><div class="fringe">${strips}</div></div>
    <div class="rounds" role="group" aria-label="${esc(t('lobby.pick'))}">${ROUNDS.map((r) => `<button data-pick="${r.id}" aria-pressed="${r.id === picked}"${save.done[r.id] ? ` aria-label="${esc(pick(r.title))} · ${esc(t('lobby.done'))}"` : ''}>${save.done[r.id] ? '<i class="tick"></i>' : ''}${esc(pick(r.title))}</button>`).join('')}</div>
    <div class="lobby-links"><button data-panel="book">${esc(t('lobby.book', { n: Object.keys(save.words).length }))}</button><button data-panel="album">${esc(t('lobby.album', { n: Object.keys(save.album).length }))}</button></div>
    ${hostMuted() ? '' : `<div class="hint-sound">${esc(t('lobby.sound'))}</div>`}
  </section>${panelHtml()}`;
  syncModal();
}

// ── 판 화면 ──────────────────────────────────────────────────────
function inline(text) {
  return esc(text).replace(/\[\[([^\]]+)\]\]/g, (_, w) => {
    const solved = S.got.includes(w) || !!save.words[w];
    const memo = memoShown(S, w);
    const memoHtml = memo ? `<span class="memo ${S.got.includes(w) ? 'right' : ''} ${ui.memoNew === w ? 'new' : ''}">${esc(memo)}</span>` : '';
    return `<button class="w ${solved ? 'ink' : ''} ${ui.sweep.includes(w) ? 'sweep' : ''} ${ui.clue === w ? 'on' : ''}" data-w="${esc(w)}" aria-label="${esc(w)}${memo ? ` — ${esc(memo)}` : ''}">${esc(w)}${memoHtml}</button>`;
  });
}
function noticeHtml(round, notice, focus, entering) {
  const patchKey = S.patched ? S.patch.after : null;
  const rows = noticeLines(round, S.fork, notice).map((l) => {
    if (typeof l === 'string') return `<p>${inline(l)}</p>`;
    if (l.big) return `<span class="big">${esc(l.big)}</span>`;
    if (patchKey && l.key === patchKey) return `<div class="patch ${ui.drop ? 'drop' : ''}"><b class="mark">정정</b>${inline(S.patch.line)}${ui.drop ? '<i class="ring"></i>' : ''}</div>`;
    return l.text.startsWith('· ') ? `<p class="li">${inline(l.text)}</p>` : `<p>${inline(l.text)}</p>`;
  }).join('');
  const dim = focus && round.notices.length > 1 && notice.id !== focus;
  return `<article class="notice ${notice.style} ${dim ? 'dim' : ''} ${entering ? 'in' : ''}" data-notice="${notice.id}">
    <div class="org"><span>${esc(notice.org)}</span>${notice.no ? `<span>${esc(notice.no)}</span>` : ''}</div>
    <h3>${esc(notice.title)}</h3>${rows}${notice.foot ? `<div class="foot">${esc(notice.foot)}</div>` : ''}${notice.seal ? `<span class="seal">${esc(notice.seal)}</span>` : ''}</article>`;
}
function paintBoard(entering = false) {
  const round = roundOf(S.roundId), box = $('#board');
  if (!box) return;
  const ask = currentAsk(S), scrolled = box.scrollTop;
  box.innerHTML = `${ui.hint ? `<div class="first-hint">${esc(t('hint.first'))}</div>` : ''}<div class="notices">${round.notices.map((n) => noticeHtml(round, n, ask?.focus, entering)).join('')}</div>
    <div class="scraps" aria-hidden="true">${round.scraps.map((s) => `<div class="scrap">${s.sub ? `<b>${esc(s.text)}</b>${esc(s.sub)}` : esc(s.text)}${s.fringe ? '<div class="fr"><i></i><i></i><i></i><i></i><i></i></div>' : ''}</div>`).join('')}</div>`;
  box.scrollTop = scrolled;
  ui.memoNew = null; ui.sweep = []; ui.drop = false;
}
function paintTop() {
  const round = roundOf(S.roundId), words = [...new Set([...round.slots.flatMap((s) => s.keys.map((k) => S.fork[k] || k)), ...(S.patched ? [S.patch.key] : [])])];
  $('#top').innerHTML = `<button class="icon" data-back aria-label="${esc(t('bar.back'))}">${ICON.back}</button>
    <span class="where">${esc(pick(round.where))} · ${esc(pick(round.when))}</span>
    <button class="book-btn" data-panel="book" aria-label="${esc(t('bar.book'))} ${S.got.length} / ${words.length}">${esc(t('bar.book'))} <span class="dots">${words.map((w) => `<i class="${S.got.includes(w) ? 'on' : ''} ${ui.sweep.includes(w) ? 'pop' : ''}"></i>`).join('')}</span></button>
    ${hostMuted() ? '' : `<button class="icon" data-sound aria-label="${esc(t('bar.sound'))}" aria-pressed="${soundOn}">${soundOn ? ICON.on : ICON.off}</button>`}`;
}
function clueHtml() {
  const w = ui.clue;
  if (!w) return '';
  const d = WORDS[w], text = d.clues[Math.min(ui.clueIdx, d.clues.length - 1)];
  const line = esc(text).replace(/\[\[([^\]]+)\]\]/g, (_, m) => `<b>${esc(m)}</b>`);
  const solved = S.got.includes(w) || !!save.words[w];
  const choices = solved ? [] : (ui.memoChoices[w] ||= memoChoices(w, rng));
  const guess = solved ? '' : `<div class="row" role="group" aria-label="${esc(t('clue.guess'))}"><span class="lab">${esc(t('clue.guess'))}</span>${choices.map((c) => `<button class="chip pen ${S.memo[w] === c ? 'on' : ''}" data-memo="${esc(c)}" aria-pressed="${S.memo[w] === c}">${esc(c)}</button>`).join('')}</div>`;
  const more = ui.clueIdx < d.clues.length - 1 ? `<button class="chip ghost" data-more>${esc(t('clue.more'))}</button>` : (S.helped[w] || solved ? '' : `<button class="chip ghost" data-easy>${esc(t('clue.easy'))}</button>`);
  const easy = S.helped[w] || solved ? `<p class="easy">${esc(w)} = ${esc(d.easy)}</p>` : '';
  return `<section class="clue" tabindex="-1" aria-label="${esc(t('clue.head'))}"><div class="h">${esc(t('clue.head'))} · <b>${esc(w)}</b><button data-clue-x>${esc(t('clue.close'))}</button></div>
    <div class="card"><svg viewBox="0 0 70 50" fill="none" aria-hidden="true">${PICS[d.pic] || ''}</svg><p>${line}</p></div>${easy}${guess}${more ? `<div class="row">${more}</div>` : ''}</section>`;
}
/** 단서 카드 글을 화면 읽기로도 읽어 주고 포커스를 카드로 옮긴다. */
function enterClue() {
  if (!ui.clue) return;
  const d = WORDS[ui.clue];
  say(d.clues[Math.min(ui.clueIdx, d.clues.length - 1)].replace(/\[\[|\]\]/g, ''));
  focusOn('.clue');
}
function closeClue() {
  const w = ui.clue;
  ui.clue = null; paintBoard(); paintClue();
  if (w) focusWord(w);
}
function paintClue() {
  const box = $('#clue-slot');
  if (!box) return;
  box.innerHTML = clueHtml();
  keepWordInView();
}
/** 단서 카드가 눌렀던 말을 가리면 게시판을 밀어 말이 보이게 한다. */
function keepWordInView() {
  const board = $('#board'), clue = $('.clue');
  if (!board) return;
  board.style.paddingBottom = clue ? `${clue.offsetHeight + 24}px` : '';
  if (!clue || !ui.clue) return;
  const el = board.querySelector(`[data-w="${CSS.escape(ui.clue)}"]`);
  if (!el) return;
  const over = el.getBoundingClientRect().bottom + 10 - clue.getBoundingClientRect().top;
  if (over > 0) board.scrollBy({ top: over, behavior: reduced() ? 'auto' : 'smooth' });
}
function paintDock({ noOptions = false, freshBubble = true } = {}) {
  const ask = currentAsk(S), box = $('#dock-in');
  if (!box) return;
  const lead = S.phase === 'ask' && S.slot === 0 && !S.after ? S.open : (S.after && !noOptions ? S.after : '');
  const body = noOptions ? esc(S.after || '') : `${lead ? `${esc(lead)}<br>` : ''}${esc(ask?.say || '')}`;
  box.innerHTML = `${S.sent ? `<div class="mine"><span>${esc(S.sent)}</span></div>` : ''}
    <div class="say"><img src="assets/taeo.webp" alt=""><div class="bb" style="${freshBubble ? '' : 'animation:none'}"><span class="who">${esc(t('who.taeo'))}</span>${body}</div></div>
    ${noOptions || !ask ? '' : `<div class="opts">${ask.opts.map((o, i) => `<button class="opt" data-reply="${i}">${esc(o.t)}</button>`).join('')}</div>`}`;
  say(ask && !noOptions ? `${lead} ${ask.say}`.trim() : S.after || '');
}
function paintGame() {
  view = 'game';
  const round = roundOf(S.roundId), [size, pos] = round.crop.split('|');
  app.innerHTML = `<section class="game"><div class="top" id="top"></div>
    <div class="board" id="board" style="background-image:url(${photo(round.board)});--bg-size:${size};--bg-pos:${pos}"></div>
    <div class="dock-wrap"><div id="clue-slot"></div><footer class="dock"><div class="dock-in" id="dock-in"></div></footer></div>
  </section><div id="over"></div>${panelHtml()}`;
  paintTop(); paintBoard(true); paintDock(); paintClue(); syncModal();
}
function sceneHtml(o, { repeat = false, ending = false } = {}) {
  return `<div class="scene ${repeat ? 'again' : ''}" data-scene-x role="button" tabindex="0" aria-label="${esc(o.title)}. ${esc(o.line)}">
    <img src="${photo(o.pic)}" alt=""><div class="veil"></div>
    <div class="tx"><h2>${esc(o.title)}</h2><p>${esc(o.line)}</p><div class="again-tx">${esc(t(ending ? 'scene.close' : 'scene.again'))}</div></div></div>`;
}
function showScene(o, opts) {
  const over = $('#over');
  if (!over) return;
  over.innerHTML = sceneHtml(o, opts);
  syncModal();
  $('.scene', over)?.focus({ preventScroll: true });
}
function start(id, { replay = false } = {}) {
  sound.wake(); sound.room();
  S = startRound(id, save, { rng });
  if (replay) S.open = '공지 새로 붙었대요 ㅋㅋ 한 번만 더 봐 줘요.';
  ui.clue = null; ui.clueIdx = 0; ui.memoChoices = {}; ui.seen = new Set(); ui.hint = !Object.keys(save.words).length && !save.done[id];
  combo = 0; lastRound = id; peek = null; endShown = false; panel = null;
  const round = roundOf(id);
  preload([round.board, round.hero, ...round.slots.flatMap((s) => s.opts.map((o) => o.pic)), ...Object.values(round.patches).flatMap((p) => p.opts.map((o) => o.pic).filter(Boolean))]);
  paintGame();
  sound.play('tape'); buzz(8);
  setTimeout(() => { if (S && S.roundId === id) sound.play('message'); }, reduced() ? 80 : 420);
}

// ── 끝 ───────────────────────────────────────────────────────────
function paintEnd() {
  view = 'end';
  const round = roundOf(S.roundId), p = S.patch;
  const ask = S.fork[round.ask];
  const tiles = otherScenes(S);   // 정정 쪽지 장면까지 다 보인다 — 앨범에 들어오는 길은 여기뿐이다
  const next = nextRoundId(save, S.roundId);
  app.innerHTML = `<section class="end ${endShown ? '' : 'first'}" id="end" tabindex="-1"><div class="hero"><img src="${photo(round.hero)}" alt=""></div><div class="body">
      <div><h2>${esc(p.win)}</h2><p class="react">${esc(p.react)} 「근데 ‘${esc(ask)}’${/[가-힣]/.test(ask) && (ask.charCodeAt(ask.length - 1) - 0xac00) % 28 ? '이' : '가'} 무슨 말이었어요?」</p></div>
      <div><h3>${esc(t('end.words'))}</h3><div class="words">${S.got.map((w, i) => `<div class="wd" style="animation-delay:${200 + i * 160}ms"><b>${esc(w)}</b><span>${esc(WORDS[w].easy)}</span></div>`).join('')}</div></div>
      <div><h3>${esc(t('end.other'))}</h3><div class="tiles">${tiles.map((o) => { const seen = !!save.album[o.title]; return `<button class="tile ${seen ? 'seen' : ''}" data-peek="${esc(o.title)}" aria-label="${esc(seen ? o.title : t('end.peek'))}"><img src="${photo(o.pic)}" alt=""><span>${esc(seen ? o.title : t('end.peek'))}</span></button>`; }).join('')}</div></div>
      <div class="row-end"><button data-replay>${esc(t('end.again'))}</button><button class="p" data-next="${next}">${esc(t('end.next'))}</button></div>
    </div></section><div id="over">${peek ? sceneHtml(peek, { ending: true }) : ''}</div>${panelHtml()}`;
  if (!endShown && !reduced()) S.got.forEach((_, k) => setTimeout(() => sound.play('stamp'), 200 + k * 160));
  endShown = true;
  syncModal();
}

// ── 수첩 · 앨범 ──────────────────────────────────────────────────
function allAlbum() {
  const seen = new Map();
  for (const r of ROUNDS) {
    for (const o of [...r.slots.flatMap((s) => s.opts), ...Object.values(r.patches).flatMap((p) => p.opts.filter((x) => !x.ok))]) if (!seen.has(o.title)) seen.set(o.title, { ...o, round: r });
  }
  return [...seen.values()];
}
function panelHtml() {
  if (!panel) return '';
  const tabs = `<div class="tabs"><button data-panel="book" aria-pressed="${panel === 'book'}">${esc(t('panel.book'))}</button><button data-panel="album" aria-pressed="${panel === 'album'}">${esc(t('panel.album'))}</button><button class="x" data-panel-x>${esc(t('panel.close'))}</button></div>`;
  let body;
  if (panel === 'book') {
    // 저장은 판이 끝날 때 하지만, 맞힌 말은 그 자리에서 수첩으로 날아 들어가므로 판 도중에도 보여 준다.
    const words = Object.entries({ ...save.words, ...Object.fromEntries((S?.got || []).filter((w) => !save.words[w]).map((w) => [w, { round: S.roundId }])) });
    body = words.length ? words.map(([w, m]) => `<div class="nb"><svg viewBox="0 0 70 50" fill="none" aria-hidden="true">${PICS[WORDS[w].pic] || ''}</svg><div><b>${esc(w)}</b><span>${esc(WORDS[w].easy)}</span><small>${esc(pick(roundOf(m.round).title))}</small></div></div>`).join('') : `<p class="empty">${esc(t('panel.bookEmpty'))}</p>`;
  } else {
    const list = allAlbum();
    body = `<p class="empty">${esc(t('panel.albumHint'))}</p><div class="tiles">${list.map((o) => { const seen = !!save.album[o.title]; return seen ? `<button class="tile seen" data-album="${esc(o.title)}" aria-label="${esc(o.title)}"><img src="${photo(o.pic)}" alt="" loading="lazy"><span>${esc(o.title)}</span></button>` : `<div class="tile shut" aria-hidden="true"><img src="${photo(o.pic)}" alt="" loading="lazy"><span>${esc(pick(o.round.title))}</span></div>`; }).join('')}</div>`;
  }
  return `<section class="panel" data-panel-bg role="dialog" aria-modal="true" aria-label="${esc(t(panel === 'book' ? 'panel.book' : 'panel.album'))}"><div class="sheet">${tabs}<div class="scroll" tabindex="0">${body}</div></div></section>`;
}
function repaintPanel() {
  $('.panel')?.remove();
  if (panel) app.insertAdjacentHTML('beforeend', panelHtml());
  if (view === 'intro') { for (const b of document.querySelectorAll('[data-pick]')) b.setAttribute('aria-pressed', String(b.dataset.pick === picked)); }
  syncModal();
}
function openPanel(name, from) {
  if (!panel) panelFrom = from;
  panel = name; sound.play('paper'); repaintPanel();
  focusOn(`.panel [data-panel="${name}"]`);
}
function closePanel() {
  panel = null; repaintPanel();
  if (panelFrom?.isConnected) focusOn(panelFrom);
  panelFrom = null;
}

// ── 맞힌 말이 수첩으로 ──────────────────────────────────────────
function flyWords(words) {
  if (reduced()) return;
  const target = $('.dots')?.getBoundingClientRect();
  if (!target) return;
  words.forEach((w, i) => {
    const from = document.querySelector(`[data-w="${CSS.escape(w)}"]`)?.getBoundingClientRect();
    if (!from) return;
    const chip = document.createElement('span');
    chip.className = 'fly'; chip.textContent = w; chip.setAttribute('aria-hidden', 'true');
    document.body.append(chip);
    const a = chip.animate([
      { transform: `translate(${from.left}px,${from.top - 4}px) scale(1)`, opacity: 1 },
      { transform: `translate(${from.left + (target.left - from.left) * 0.55}px,${from.top - 34}px) scale(1.06)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${target.left}px,${target.top - 2}px) scale(.45)`, opacity: 0.2 },
    ], { duration: 520, delay: i * 90, easing: 'cubic-bezier(.34,.80,.34,1)', fill: 'both' });
    a.onfinish = () => chip.remove(); a.oncancel = () => chip.remove();
  });
}

// ── 답장 ─────────────────────────────────────────────────────────
async function reply(i) {
  const ask = currentAsk(S); if (!ask) return;
  const opt = ask.opts[i], res = answer(S, opt);
  if (!res.right) {
    combo = 0; sound.play('scene');
    showScene(opt, { repeat: ui.seen.has(opt.title) }); ui.seen.add(opt.title); say(`${opt.title}. ${opt.line}`);
    return;
  }
  busy = true;
  sound.right(combo); combo += 1; buzz(10);
  ui.sweep = res.words || []; ui.clue = null;
  flyWords(res.words || []);
  paintTop(); paintBoard(); paintClue();
  if (res.finished) {
    paintDock({ noOptions: true });
    await wait(900);
    finishRound(S, save); persist();
    sound.play('open'); paintEnd(); busy = false;
    say(S.patch.win); focusOn('#end'); return;
  }
  if (res.patchNext) {
    paintDock({ noOptions: true });
    await wait(1100);
    applyPatch(S); ui.drop = true;
    sound.play('tape'); buzz(14);
    paintBoard(); paintTop(); paintDock();
    $('.patch')?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    focusOn('.opt');
    await wait(380); sound.play('message'); busy = false; return;
  }
  paintDock(); focusOn('.opt'); await wait(240); sound.play('message'); busy = false;
}

// ── 누름 ─────────────────────────────────────────────────────────
app.addEventListener('click', async (e) => {
  const b = e.target.closest('button,[data-scene-x],[data-panel-bg]');
  if (!b) return;
  sound.wake();
  if (b.dataset.panelBg !== undefined && e.target === b) { closePanel(); return; }
  if (b.hasAttribute('data-panel-x')) { closePanel(); return; }
  if (b.hasAttribute('data-sound')) { soundOn = !soundOn; try { localStorage.setItem('synk.board-decode.sound', soundOn ? 'on' : 'off'); } catch { /* 저장 못 함 */ } sound.refresh(); if (soundOn) sound.play('open'); paintTop(); focusOn('[data-sound]'); return; }
  if (b.hasAttribute('data-scene-x')) {
    const was = peek;
    $('#over').innerHTML = ''; peek = null; if (S && S.scene) closeScene(S);
    if (view === 'end') { paintEnd(); if (was) focusOn(`[data-peek="${CSS.escape(was.title)}"]`); }
    else if (view === 'intro') { paintIntro(); focusOn('.lobby-links [data-panel="album"]'); }
    else { syncModal(); focusOn('.opt'); }
    return;
  }
  if (busy) return;   // 전환 중(뜯는 동안 · 다음 칸 · 끝 화면으로 가는 동안)에는 판을 바꾸거나 새 창을 열지 않는다
  if (b.dataset.panel) { openPanel(b.dataset.panel, b); return; }
  if (b.dataset.album) { const found = allAlbum().find((x) => x.title === b.dataset.album); if (found) { const o = { ...found, ...save.album[found.title] }; peek = o; panel = null; repaintPanel(); if (!$('#over')) app.insertAdjacentHTML('beforeend', '<div id="over"></div>'); showScene(o, { ending: true }); sound.play('scene'); } return; }
  if (b.dataset.pick) { picked = b.dataset.pick; sound.play('tap'); repaintPanel(); return; }
  if (b.dataset.tear != null) {
    busy = true;
    b.classList.add('torn'); sound.play('tear'); buzz(12);
    await wait(380);
    $('#intro')?.classList.add('leave');
    await wait(380);
    busy = false; start(picked); return;
  }
  if (b.hasAttribute('data-back')) { S = null; picked = lastRound || picked; paintIntro(); return; }
  if (b.dataset.w) {
    const w = b.dataset.w;
    if (ui.hint) ui.hint = false;
    sound.play('paper');
    if (ui.clue === w) { closeClue(); return; }
    ui.clue = w; ui.clueIdx = 0;
    paintBoard(); paintClue(); enterClue(); return;
  }
  if (b.hasAttribute('data-clue-x')) { closeClue(); return; }
  if (b.hasAttribute('data-more')) { ui.clueIdx += 1; sound.play('paper'); paintClue(); enterClue(); return; }
  if (b.hasAttribute('data-easy')) { S.helped[ui.clue] = true; sound.play('paper'); paintClue(); say(`${ui.clue} = ${WORDS[ui.clue].easy}`); focusOn('.clue'); return; }
  if (b.dataset.memo) { const memo = b.dataset.memo; setMemo(S, ui.clue, memo); ui.memoNew = ui.clue; sound.play('pencil'); say(t('clue.memo')); paintBoard(); paintClue(); focusOn(`[data-memo="${CSS.escape(memo)}"]`); return; }
  if (b.dataset.reply != null) { await reply(Number(b.dataset.reply)); return; }
  if (b.dataset.peek) { const o = otherScenes(S).find((x) => x.title === b.dataset.peek); if (o) { peekScene(save, o); persist(); peek = o; sound.play('scene'); paintEnd(); focusOn('.scene'); } return; }
  if (b.hasAttribute('data-replay')) { start(S.roundId, { replay: true }); return; }
  if (b.dataset.next) { picked = b.dataset.next; start(b.dataset.next); }
});
document.addEventListener('keydown', (e) => {
  const onScene = e.target.closest?.('[data-scene-x]');
  if ((e.key === 'Enter' || e.key === ' ') && onScene) { e.preventDefault(); onScene.click(); return; }
  if (e.key !== 'Escape') return;
  const scene = $('#over .scene');
  if (scene) { e.preventDefault(); scene.click(); return; }
  if (panel) { closePanel(); return; }
  if (ui.clue && view === 'game') closeClue();
});
addEventListener('resize', keepWordInView);

// 시험용 창: 화면을 바꾸지 않고 상태만 읽는다.
window.__board = Object.freeze({ state: () => S, save: () => save, view: () => view });
if (ROUND_IDS.includes(query.get('round')) && query.has('auto')) start(picked); else paintIntro();
