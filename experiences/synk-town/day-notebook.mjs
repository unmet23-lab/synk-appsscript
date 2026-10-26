/** The neighbour notebook (vertical slice design §9-3·§20-5, W5b): five pages — the village news (all the notes, never
 * their days), what the player can do now (the cards waiting for the player, opened by talking to their owner), the
 * familiar life (what the player has been through more than a few times, from the seen ledger, and emptying it), what
 * the village remembers (what the player did today with its 「…」 feedback, what each resident knows of things done
 * together with 「잊어 주세요」, the settings the village keeps for the player, emptying the personal record) and the
 * field book (opens with gathering, W8b). Every change goes through the town's own commands (§20 — rights and base);
 * nothing here counts, dates or ranks (G2·G3). Screen-only module.
 */
import * as generated from './town/data.gen.mjs';
import { CARD_BY_ID, NAMES, lineText, newsLine, takeable, FEEDBACK, iconSvg } from './day-cards.mjs';

export const PAGES = Object.freeze([['news', '마을 소식'], ['can', '할 수 있는 생활'], ['familiar', '익숙한 생활'], ['memory', '마을이 기억하는 것'], ['book', '도감']]);
const FAMILY_LABELS = Object.freeze({ 'cafe-life': '찻집 생활', 'workshop-life': '공방 생활', 'greenhouse-life': '온실 생활', gather: '모으기' });
const PAIR_LIST = generated.PAIRS || [];
// The parameter version's own threshold (§8-1 familiarAfter): more than this many times through the same card or pair scene.
const FAMILIAR_AFTER = (Array.isArray(generated.PARAMS) ? generated.PARAMS[0] : null)?.seen?.familiarAfter ?? 3;
const familyCount = (seen, prefix) => Object.entries(seen || {}).reduce((sum, [key, n]) => sum + (key.startsWith(prefix) && Number.isFinite(n) ? n : 0), 0);
export const activityLabel = activity => { const card = /^card\.([CWR][1-6])$/.exec(activity || '')?.[1]; return card && CARD_BY_ID.get(card) ? CARD_BY_ID.get(card).title : '마을에서 한 생활'; };

/** The pages' content from a town answer ({ state, view, seen }). */
export function notebookModel(snapshot) {
  const state = snapshot?.state || {}, v = state.village || null, scene = snapshot?.view?.day?.scene?.village || null, prefs = state.prefs || null, seen = snapshot?.seen || {};
  const lifeDay = v?.band?.lifeDay ?? null;
  const news = [...(v?.news || [])].reverse().map(n => ({ ref: n.ref, card: n.card, text: lineText(newsLine(n.card)) })).filter(n => n.text);
  const can = (scene?.cards || []).filter(takeable).map(c => ({ card: c.card, title: CARD_BY_ID.get(c.card).title, owner: c.owner, paused: c.status === 'paused' }));
  const familiar = [
    ...[...CARD_BY_ID.values()].filter(card => familyCount(seen, `card:${card.id}:`) > FAMILIAR_AFTER).map(card => ({ key: `card:${card.id}`, title: card.title })),
    ...PAIR_LIST.filter(pair => familyCount(seen, `pair:${pair.scene}:`) > FAMILIAR_AFTER).map(pair => ({ key: `pair:${pair.scene}`, title: `${NAMES[pair.members[0]]}과 ${NAMES[pair.members[1]]}의 이야기` })),
  ];
  const given = new Map((prefs?.feedback || []).map(f => [f.completionId, f.value]));
  // Today's (the band's life day): the cards done with the player, newest first — by name, never by time.
  const today = [...(v?.takes || [])].reverse().filter(t => t.status === 'resolved' && t.eventId && lifeDay !== null && String(t.ref || '').startsWith(`${lifeDay}.`) && CARD_BY_ID.has(t.card))
    .map(t => ({ eventId: t.eventId, card: t.card, title: CARD_BY_ID.get(t.card).title, activity: `card.${t.card}`, given: given.get(t.eventId) ?? null }));
  const journal = [...new Set([...(snapshot?.view?.notebook || []), ...(snapshot?.view?.day?.history || []).map(row => row.summary), ...(snapshot?.view?.bazaar?.history || []).map(row => row.summary)].filter(Boolean))];
  const known = Object.entries(scene?.knownMe || {}).flatMap(([npc, list]) => (list || []).filter(e => CARD_BY_ID.has(e.card)).map(e => ({ npc, ref: e.ref, card: e.card, title: CARD_BY_ID.get(e.card).title })));
  const settings = [
    ...(prefs?.preferredFamily ? [{ kind: 'family', label: `먼저 보여 줄 생활 · ${FAMILY_LABELS[prefs.preferredFamily] || prefs.preferredFamily}`, action: ['PREF_FAMILY', { family: prefs.preferredFamily, answer: 'clear' }, '먼저 보여 주지 않아도 돼요'] }] : []),
    ...(prefs?.observed ? [{ kind: 'observed', label: `요즘 자주 한 생활 · ${FAMILY_LABELS[prefs.observed] || prefs.observed}`, action: ['OBSERVED_CORRECT', { family: prefs.observed }, '그때만 한 거예요'] }] : []),
    ...(prefs?.lessOften || []).map(activity => ({ kind: 'less', label: `덜 추천하는 생활 · ${activityLabel(activity)}`, action: ['PREF_LESS_OFTEN', { activity, on: false }, '다시 추천해도 돼요'] })),
    ...(prefs?.approachOptOut || []).map(activity => ({ kind: 'approach', label: `먼저 말 걸지 않는 생활 · ${activityLabel(activity)}`, action: ['PREF_APPROACH', { activity, optOut: false }, '다시 말 걸어도 돼요'] })),
    ...(prefs?.feedback || []).map(f => ({ kind: 'feedback', label: `내가 남긴 응답 · ${activityLabel(f.canonicalActivityId)} · ${FEEDBACK.find(([value]) => value === f.value)?.[1] || ''}`, action: ['FEEDBACK_REMOVE', { eventId: f.completionId }, '응답 지우기'] })),
  ];
  return { news, can, familiar, today, journal, known, settings };
}

const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') el.className = value; else if (key === 'text') el.textContent = value; else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value); else if (value !== undefined && value !== null && value !== false) el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child) el.append(child);
  return el;
};
const empty = text => h('p', { class: 'field-note notebook-empty', text });

/** The notebook dialog. render(snapshot) draws the page shown; open(page) shows it; command(type, payload) is the
 * town's command (the answer re-renders through render). The page is drawn again only when what it shows changes — every
 * answer of the town reaches render while it is open — and keyboard focus stays on the same control (its data-focus key),
 * or moves where the step leads (the confirm, back to its button), else to the page's tab (screen review B2). */
export function createNotebook(dialog, { command, onPage } = {}) {
  if (!dialog) return { open() {}, render() {}, page: () => null };
  let page = 'news', snapshot = null, confirming = null, feedbackOpen = null, journalOpen = false, drawn = null, focusNext = null;
  const tabs = dialog.querySelector('.notebook-tabs'), body = dialog.querySelector('.notebook-page');
  function tabList() {
    tabs.replaceChildren(...PAGES.map(([id, label]) => h('button', { type: 'button', role: 'tab', id: `notebook-tab-${id}`, class: 'notebook-tab', 'aria-selected': String(id === page),
      'aria-controls': 'notebook-page', tabindex: id === page ? '0' : '-1', text: label, onclick: () => show(id) })));
  }
  function show(id, focus = true) {
    page = id; confirming = null; feedbackOpen = null; tabList(); render(snapshot);
    if (focus) tabs.querySelector(`#notebook-tab-${id}`)?.focus();
    onPage?.(id);
  }
  tabs?.addEventListener('keydown', event => {
    const i = PAGES.findIndex(([id]) => id === page), step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return; event.preventDefault(); show(PAGES[(i + step + PAGES.length) % PAGES.length][0]);
  });
  const act = (type, payload) => () => command?.(type, payload);
  function clearRow(kind, label, line) {
    if (confirming === kind) return h('div', { class: 'notebook-confirm' }, h('p', { class: 'field-note', text: line }),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'felt primary', text: label, 'data-focus': `confirm:${kind}`, onclick: async () => { confirming = null; focusNext = `clear:${kind}`; if (!await command?.(kind)) render(snapshot); } }),
        h('button', { type: 'button', class: 'felt', text: '그만두기', 'data-focus': `cancel:${kind}`, onclick: () => { confirming = null; focusNext = `clear:${kind}`; render(snapshot); } })));
    return h('button', { type: 'button', class: 'felt subtle notebook-clear', text: label, 'data-focus': `clear:${kind}`, onclick: () => { confirming = kind; focusNext = `confirm:${kind}`; render(snapshot); } });
  }
  function feedbackRow(item) {
    const open = feedbackOpen === item.eventId, more = `more:${item.eventId}`;
    return h('div', { class: 'feedback' },
      h('button', { type: 'button', class: 'felt subtle feedback-more', 'aria-expanded': String(open), 'aria-label': `${item.title}에 응답 남기기`, text: '…', 'data-focus': more, onclick: () => { feedbackOpen = open ? null : item.eventId; focusNext = more; render(snapshot); } }),
      open ? h('div', { class: 'feedback-options', role: 'group', 'aria-label': '응답' }, FEEDBACK.map(([value, label]) => h('button', { type: 'button', class: 'felt', 'aria-pressed': String(item.given === value), text: label, 'data-focus': `${more}:${value}`,
        onclick: () => { feedbackOpen = null; focusNext = more; command?.('FEEDBACK_GIVE', { completionId: item.eventId, value, canonicalActivityId: item.activity }); } }))) : null);
  }
  function render(next) {
    snapshot = next ?? snapshot;
    if (!tabs.children.length) tabList();
    const m = notebookModel(snapshot), sig = JSON.stringify([page, confirming, feedbackOpen, m]);
    if (sig === drawn && body.childNodes.length) return;
    drawn = sig;
    const had = body.contains(document.activeElement) ? document.activeElement.dataset.focus || '' : null;
    let content;
    if (page === 'news') content = m.news.length ? h('ul', { class: 'notebook-list' }, m.news.map(n => h('li', {}, h('span', { class: 'notebook-icon', html: iconSvg('news') }), h('span', { text: n.text })))) : empty('아직 마을 소식이 없어요. 하루가 지나면 문 앞 쪽지에 소식이 붙어요.');
    else if (page === 'can') content = m.can.length ? h('ul', { class: 'notebook-list' }, m.can.map(c => h('li', {}, h('span', { class: 'notebook-icon', html: iconSvg('sparkle') }),
      h('span', {}, h('strong', { text: c.title }), h('span', { class: 'notebook-sub', text: c.paused ? `하던 생활이에요. ${NAMES[c.owner]}에게 말을 걸면 이어서 해요.` : `${NAMES[c.owner]}에게 말을 걸면 같이 할 수 있어요.` })))))
      : empty('지금은 기다리는 생활이 없어요. 이웃의 하루를 둘러보세요.');
    else if (page === 'familiar') content = h('div', {}, m.familiar.length ? h('ul', { class: 'notebook-list' }, m.familiar.map(f => h('li', {}, h('span', { text: f.title }))))
      : empty('여러 번 함께한 생활이 여기에 모여요.'), h('p', { class: 'field-note', text: '본 것 기록을 비우면 모두 다시 새 이야기로 보여요.' }),
      clearRow('SEEN_CLEAR', '본 것 기록 비우기', '본 것 기록을 비울까요? 마을의 일과 주민의 기억은 그대로예요.'));
    else if (page === 'memory') content = h('div', { class: 'notebook-memory' },
      h('h3', { text: '오늘 한 일' }), m.today.length ? h('ul', { class: 'notebook-list' }, m.today.map(item => h('li', { class: 'with-feedback' }, h('span', { text: `${item.title} — 같이 했어요` }), feedbackRow(item)))) : empty('오늘 같이 한 생활이 아직 없어요.'),
      m.journal.length ? h('details', { class: 'notebook-journal', open: journalOpen, ontoggle: event => { journalOpen = event.currentTarget.open; } }, h('summary', { text: '함께한 일', 'data-focus': 'journal' }),
        h('ul', { class: 'notebook-list' }, m.journal.map(line => h('li', { text: line })))) : null,
      h('h3', { text: '주민이 아는 나' }), m.known.length ? h('ul', { class: 'notebook-list' }, m.known.map(k => h('li', { class: 'with-action' }, h('span', { text: `${NAMES[k.npc]} · ${k.title} — 같이 했어요` }),
        h('button', { type: 'button', class: 'felt subtle', text: '잊어 주세요', 'data-focus': `forget:${k.npc}:${k.ref}`, onclick: act('MEMORY_FORGET', { npc: k.npc, eventId: k.ref }) })))) : empty('주민이 기억하는, 같이 한 일이 아직 없어요.'),
      h('h3', { text: '마을이 맞춰 둔 것' }), m.settings.length ? h('ul', { class: 'notebook-list' }, m.settings.map(s => h('li', { class: 'with-action' }, h('span', { text: s.label }),
        h('button', { type: 'button', class: 'felt subtle', text: s.action[2], 'data-focus': `set:${s.label}`, onclick: act(s.action[0], s.action[1]) })))) : empty('마을이 맞춰 둔 것이 아직 없어요.'),
      h('h3', { text: '맞춤 기록 모두 비우기' }), h('p', { class: 'field-note', text: '요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요. 직접 정한 설정과 마을의 일은 그대로예요.' }),
      clearRow('MEMORY_CLEAR', '비우기', '맞춤 기록을 모두 비울까요?'));
    else content = empty('마을에서 모은 것을 적는 쪽이에요. 모으기가 열리면 여기에 하나씩 쌓여요.');
    body.replaceChildren(content);
    body.setAttribute('aria-labelledby', `notebook-tab-${page}`);
    const want = focusNext ?? had; focusNext = null;
    if (want !== null) ([...body.querySelectorAll('[data-focus]')].find(el => el.dataset.focus === want) || tabs.querySelector(`#notebook-tab-${page}`))?.focus();
  }
  // open(page, snapshot): every way in hands over the town's answer it shows (the door note's 「수첩에서 더 보기」 opened an
  // empty notebook until the next answer — final review F1).
  return { open(id = page, next = null) { if (next) snapshot = next; if (!dialog.open) dialog.showModal(); show(id, false); }, render, page: () => page };
}
