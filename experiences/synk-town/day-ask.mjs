/** The mascot's one question on the screen (vertical slice design §20-3·§20-4, W6b). The host decides whether and what to
 * ask (core offerAsk — at most one a life day, never inside a scene, never on the first life day; view.ask); this module
 * only draws it as the player's own mascot's card over the scene — never a modal dialog (a dialog would stop the town's
 * boundaries) — and sends the answer. 「아니요」 comes first and is the default (§20-4); closing without an answer is
 * ASK_CLOSE (it counts as asked: a taste question rests seven life days, consent is never asked first again). The card
 * reports that it was drawn once it stood in sight a moment — the app carries that key beside its next boundary (asked),
 * never as a command. The consent card shows the contract's easy version with its picture and opens the whole text under
 * 「자세히」 (the generated EVAL_CONSENT — never words written here).
 * The player's mascot is its WORLD tutor as this device remembers it; unknown, Mongle. Each mascot's picture was baked
 * with its card's scene (AGENTS — never the reference figures pasted on). Screen-only module; its look is day-ask.css.
 */
import * as generated from './town/data.gen.mjs';

export const LEVEL = 'L2';
export const TUTORS = Object.freeze({ marin: '마린', kkamong: '까몽', mongle: '몽글' });
const TUTOR_KEY = 'synk.world.tutor.v1:';
const DRAWN_AFTER_MS = 1200;
// Read through the namespace: a browser may hold the generated data from before W6b for the cache's ten minutes.
const TASTE = new Map((generated.ASK_LINES || []).map(line => [line.family, line]));
const DETAIL_ROWS = Object.freeze([['purpose', '무엇을 위해'], ['uses', '쓰는 것'], ['notUsed', '쓰지 않는 것'], ['keep', '보관'], ['choose', '고르기'], ['notAsked', '묻지 않는 경우'], ['contact', '문의']]);

/** The tutor this device's WORLD remembers (brand-opening/tutor-choice.mjs — one record per account): the one the
 * accounts on this device agree on, else null. Device storage only; nothing leaves the device. */
export function tutorOnDevice(storage = globalThis.localStorage) {
  const found = new Set();
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(TUTOR_KEY)) continue;
      const data = JSON.parse(storage.getItem(key) || 'null');
      if (data?.version === 1 && data.completed === true && Object.hasOwn(TUTORS, data.tutor)) found.add(data.tutor);
    }
  } catch { return null; }
  return found.size === 1 ? [...found][0] : null;
}

const picture = (tutor, kind) => new URL(`./assets/ask/${tutor}-${kind}.webp`, import.meta.url).href;

/** What the card shows for view.ask ({ key, kind, family? }), or null when this browser has no words for it. */
export function askModel(ask, { tutor = null, consent = generated.EVAL_CONSENT ?? null } = {}) {
  if (!ask || typeof ask.key !== 'string') return null;
  const who = Object.hasOwn(TUTORS, tutor) ? tutor : 'mongle', base = { key: ask.key, kind: ask.kind, tutor: who, name: TUTORS[who] };
  if (ask.kind === 'taste') {
    const line = TASTE.get(ask.family)?.levels?.[LEVEL];
    return line ? { ...base, family: ask.family, picture: picture(who, 'taste'), line, answers: [['no', '아니요'], ['yes', '네']] } : null;
  }
  if (ask.kind === 'consent' && consent?.easy && consent.detail) {
    const e = consent.easy;
    return { ...base, ver: consent.ver, picture: picture(who, 'consent'), line: e.ask, lines: [e.uses, e.where, e.keep, e.choose],
      answers: [['no', e.buttons.no], ['yes', e.buttons.yes]], more: e.buttons.more, detail: consent.detail };
  }
  return null;
}

/** The command an answer sends: the taste answer (§20-3) or the consent (§20-4, with the contract's version). */
export function answerCommand(model, answer) {
  return model.kind === 'taste' ? ['PREF_FAMILY', { family: model.family, answer: answer === 'yes' ? 'yes' : 'no' }]
    : ['EVAL_CONSENT', { state: answer === 'yes' ? 'granted' : 'declined', ver: model.ver }];
}

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

/** The card in host (the notices over the scene). update({ ask, blocked }) each frame returns { shown, drawn } — drawn is
 * the key the first frame it has stood in sight a moment (the app reports it once). command(type, payload) is the town's
 * command and resolves true when the host took it. */
export function createAsk(host, { command = async () => false, live, tutor = () => null } = {}) {
  if (!host) return { update: () => ({ shown: false, drawn: null }), metrics: () => null };
  if (!document.querySelector('link[data-ask-style]')) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('./day-ask.css', import.meta.url).href });
    link.dataset.askStyle = ''; document.head.append(link);
  }
  const card = el('section', 'ask-card'); card.id = 'ask-card'; card.hidden = true; card.setAttribute('aria-labelledby', 'ask-line');
  const figure = el('figure', 'ask-picture'), img = el('img'); img.alt = ''; img.decoding = 'async'; img.width = 360; img.height = 360; figure.append(img);
  const who = el('p', 'ask-who'), line = el('p', 'ask-line'); line.id = 'ask-line';
  const lines = el('ul', 'ask-lines'), actions = el('div', 'ask-actions'), detail = el('div', 'ask-detail'); detail.id = 'ask-detail'; detail.hidden = true;
  const close = el('button', 'felt subtle ask-close', '닫기'); close.type = 'button'; close.setAttribute('aria-label', '답하지 않고 닫기');
  const head = el('div', 'ask-head'); head.append(who, close);
  const body = el('div', 'ask-body'); body.append(head, line, lines, actions, detail);
  card.append(figure, body); host.append(card);
  let model = null, drawnSig = '', detailOpen = false, sending = false, seenSince = null, reported = new Set(), gone = new Set();
  const send = async (type, payload) => {
    if (sending) return; sending = true; paintBusy();
    const key = model?.key;
    try { if (await command(type, payload) && key) gone.add(key); } finally { sending = false; paintBusy(); }
  };
  close.addEventListener('click', () => { if (model) send('ASK_CLOSE', { key: model.key }); });
  card.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close.click(); } });
  function paintBusy() { for (const b of card.querySelectorAll('button')) b.disabled = sending && !b.classList.contains('ask-more'); }
  function paint() {
    const sig = JSON.stringify([model.key, model.tutor, model.line, detailOpen]);
    if (sig === drawnSig) return;
    const keep = card.contains(document.activeElement) ? document.activeElement.dataset.focus || null : null;
    drawnSig = sig; card.dataset.kind = model.kind;
    if (img.dataset.src !== model.picture) { img.dataset.src = model.picture; img.src = model.picture; img.width = model.kind === 'consent' ? 600 : 360; img.height = model.kind === 'consent' ? 400 : 360; }
    who.textContent = model.name; line.textContent = model.line;
    lines.hidden = !model.lines; lines.replaceChildren(...(model.lines || []).map(text => el('li', '', text)));
    actions.replaceChildren(...model.answers.map(([answer, label], i) => {
      const b = el('button', `felt${i === 0 ? ' primary' : ''}`, label); b.type = 'button'; b.dataset.answer = answer; b.dataset.focus = `answer:${answer}`;
      b.addEventListener('click', () => { const [type, payload] = answerCommand(model, answer); send(type, payload); });
      return b;
    }), ...(model.more ? [(() => { const b = el('button', 'felt subtle ask-more', model.more); b.type = 'button'; b.dataset.focus = 'more';
      b.setAttribute('aria-expanded', String(detailOpen)); b.setAttribute('aria-controls', 'ask-detail');
      b.addEventListener('click', () => { detailOpen = !detailOpen; paint(); }); return b; })()] : []));
    detail.hidden = !(model.detail && detailOpen);
    detail.replaceChildren(...(model.detail ? [el('h3', 'ask-detail-title', model.detail.title),
      ...DETAIL_ROWS.filter(([key]) => model.detail[key]).map(([key, label]) => { const row = el('p', 'ask-detail-row'); row.append(el('strong', '', `${label}: `), el('span', '', model.detail[key])); return row; })] : []));
    paintBusy();
    if (keep) card.querySelector(`[data-focus="${keep}"]`)?.focus();
  }
  function update({ ask, blocked = false, now = performance.now() } = {}) {
    model = askModel(ask, { tutor: tutor() });
    // No question open: the keys answered or reported here are forgotten, so the same question asked again on a later
    // life day draws and reports afresh (final review F2 — a window may stay open for days).
    if (!ask) { gone.clear(); reported.clear(); }
    const shown = !!model && !gone.has(model.key) && !blocked && !document.hidden;
    if (!shown) { if (!card.hidden) card.hidden = true; seenSince = null; if (!model) detailOpen = false; return { shown: false, drawn: null }; }
    if (card.hidden) { card.hidden = false; if (live) live.textContent = `${model.name}의 물음: ${model.line}`; }
    paint();
    // Drawn = the question's line has stood wholly in the window and in the card's own box a moment (the card scrolls
    // within the notices on a short window — final review F1).
    const r = line.getBoundingClientRect(), box = card.getBoundingClientRect();
    const whole = r.height > 0 && r.top >= Math.max(0, box.top) - 1 && r.bottom <= Math.min(innerHeight, box.bottom) + 1 && r.left >= 0 && r.right <= innerWidth + 1;
    if (!whole) { seenSince = null; return { shown: true, drawn: null }; }
    seenSince ??= now;
    if (now - seenSince < DRAWN_AFTER_MS || reported.has(model.key)) return { shown: true, drawn: null };
    reported.add(model.key);
    return { shown: true, drawn: model.key };
  }
  return { update, metrics: () => (card.hidden ? null : { key: model?.key ?? null, kind: model?.kind ?? null, tutor: model?.tutor ?? null, detail: detailOpen, sending, drawn: reported.has(model?.key), rect: card.getBoundingClientRect().toJSON() }) };
}
