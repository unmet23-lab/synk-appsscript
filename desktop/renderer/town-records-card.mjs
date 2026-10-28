// SYNK TOWN's 「마을 기록」 card on the account screens (SYNK-appsscript vertical slice design §20-5 계정 화면 계약, W6c): the PC
// 「내 계정」, the synk.im portal 「내 계정」 and WORLD's account sheet (client.html?product=world) show what the town keeps of the
// person and let them take it out or clear it — even when they can no longer enter the town (G12). The card's sections come
// from talk's records route as they are (the neighbour notebook's rows, SYNK-appsscript experiences/synk-town/town/records.mjs),
// so the words and the rules live once; this module only draws them with the host's own button and row classes and sends a
// pressed button as the town command at the card's revision. A button with a confirm line asks once more first.
// Pure at import: the PC renders it into its page string (townRecordsHtml + press), the web hosts attach it to an element.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const TOWN_RECORDS_TITLE = '마을 기록';
const LEAD = '마을이 기억하는 나와 맞춰 둔 것을 보고, 빼거나 비울 수 있어요. 마을에 들어가지 않아도 여기서 할 수 있어요.';
const DONE = Object.freeze({
  MEMORY_FORGET: '그 주민의 기억에서 뺐어요.', FEEDBACK_REMOVE: '남긴 응답을 지웠어요.', OBSERVED_CORRECT: '요즘 자주 한 생활에서 뺐어요.',
  SEEN_CLEAR: '본 것 기록을 비웠어요. 모두 다시 새 이야기로 보여요.', MEMORY_CLEAR: '맞춤 기록을 모두 비웠어요.',
});
const doneText = ({ type, payload }) => type === 'EVAL_CONSENT' ? (payload?.state === 'granted' ? '마을을 낫게 하는 데 쓰는 기록을 쓰기 시작했어요.' : '그만 쓰고, 모은 기록을 지웠어요.')
  : type === 'PREF_VISIT_BANDS' ? (payload?.on ? '자주 오는 때에 맞춰 마을 자리를 채워요.' : '자주 오는 때에 맞추지 않아요. 모은 때도 지웠어요.') : DONE[type] || '바꿨어요.';
// The server's town codes as the card says them; a reload follows a conflict (another screen changed the town first).
const RELOAD = new Set(['stale-command', 'COMMAND_CONFLICT', 'TOWN_NOT_STARTED', 'memory-unavailable', 'feedback-unavailable']);
const ERRORS = Object.freeze({
  'stale-command': '다른 곳에서 먼저 바뀌었어요. 지금 기록을 다시 불러왔어요.', COMMAND_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 지금 기록을 다시 불러왔어요.',
  TOWN_NOT_STARTED: '마을에 들어간 뒤에 바꿀 수 있어요.', TOWN_RECORDS_UNAVAILABLE: '마을 기록은 아직 쓸 수 없어요.',
  'memory-unavailable': '그 기억은 이미 빠졌어요. 지금 기록을 다시 불러왔어요.', 'feedback-unavailable': '그 응답은 이미 지워졌어요. 지금 기록을 다시 불러왔어요.',
  'eval-unavailable': '지금은 켤 수 없어요.', 'eval-consent-academy': '학원 소속 계정에는 묻지 않아요.',
  ACCOUNT_UNAVAILABLE: '계정 삭제를 요청한 동안에는 마을 기록을 바꿀 수 없어요.', TOWN_UNAVAILABLE: '마을 연결을 확인하지 못했어요. 잠시 뒤 다시 해 주세요.',
});
const errorText = error => ERRORS[error?.code] || (error?.retryable || ['NETWORK', 'SERVICE_UNAVAILABLE', 'SERVER_UNAVAILABLE'].includes(error?.code) ? '연결을 확인하지 못했어요. 잠시 뒤 다시 해 주세요.' : '바꾸지 못했어요. 잠시 뒤 다시 해 주세요.');
// Why the card could not be read, where the account says so (a deletion request closes the town's records until it is cancelled).
const LOAD_ERRORS = Object.freeze({ ACCOUNT_UNAVAILABLE: '계정 삭제를 요청한 동안에는 마을 기록을 볼 수 없어요. 요청을 취소하면 다시 보여요.' });
const DEFAULT_CLASSES = Object.freeze({ button: 'town-records-button', note: 'town-records-note', link: 'town-records-link', retry: 'town-records-button' });

/** The card's state: idle → loading → ready | failed; records is the route's answer ({ available, started, revision, sections }). */
export const townRecordsState = () => ({ phase: 'idle', records: null, busy: null, open: [], message: null, failure: null });
// Each control has a key (data-town): <section>.r<row>, <section>.a<action>, <section>.more, or retry.
function actionOf(records, key) {
  const [id, part] = String(key || '').split('.'), section = records?.sections?.find(s => s.id === id);
  if (!section || !part) return null;
  const row = /^r(\d+)$/.exec(part), act = /^a(\d+)$/.exec(part);
  return row ? section.rows?.[Number(row[1])]?.action || null : act ? section.actions?.[Number(act[1])] || null : null;
}
/** The card as HTML (escaped throughout) in the host's classes ({ button, note, link, retry }). */
export function townRecordsHtml(state, { classes = {}, headingLevel = 4 } = {}) {
  const c = { ...DEFAULT_CLASSES, ...classes }, busy = state.busy !== null, records = state.records, hn = `h${headingLevel}`;
  const message = state.message ? `<p class="town-records-message ${esc(c.note)}${state.message.tone === 'error' ? ' is-error' : ''}" role="status">${esc(state.message.text)}</p>` : '';
  // data-key lets a host that restores focus by its own key (the portal) find the control again after it redraws.
  const button = (key, label, cls = c.button) => `<button type="button" class="${esc(cls)}" data-town="${esc(key)}" data-key="town:${esc(key)}"${busy ? ' disabled' : ''}>${esc(label)}</button>`;
  const note = (text, extra = '') => `<p class="${esc(c.note)}${extra}">${esc(text)}</p>`;
  if (state.phase === 'idle' || state.phase === 'loading') return `<div class="town-records" data-phase="loading">${note('마을 기록을 불러오고 있어요.')}</div>`;
  if (state.phase === 'failed') return `<div class="town-records" data-phase="failed">${state.failure ? note(state.failure) : `${note('마을 기록을 불러오지 못했어요. 계정은 그대로 쓸 수 있어요.')}${button('retry', '다시 불러오기', c.retry)}`}</div>`;
  if (!records?.available) return `<div class="town-records" data-phase="unavailable">${note('마을 기록은 아직 쓸 수 없어요.')}</div>`;
  if (!records.started) return `<div class="town-records" data-phase="empty">${note('싱크타운에 들어가면 주민이 기억하는 일과 마을이 맞춰 둔 것이 여기에 보여요.')}${message}</div>`;
  const sections = (records.sections || []).map(section => {
    const id = section.id, rows = section.rows || [], open = state.open.includes(id);
    const list = rows.length ? `<ul class="town-records-rows">${rows.map((row, i) => `<li class="town-records-row"><span class="town-records-text">${esc(row.text)}</span>${row.action ? button(`${id}.r${i}`, row.action.label) : ''}</li>`).join('')}</ul>`
      : section.empty ? note(section.empty, ' town-records-empty') : '';
    const actions = (section.actions || []).length ? `<div class="town-records-actions">${section.actions.map((action, i) => button(`${id}.a${i}`, action.label)).join('')}</div>` : '';
    const detail = section.detail ? `<button type="button" class="${esc(c.link)}" data-town="${esc(id)}.more" data-key="town:${esc(id)}.more" aria-expanded="${open}">${open ? '자세히 접기' : '자세히'}</button>`
      + (open ? `<div class="town-records-detail"><p><strong>${esc(section.detail.title)}</strong></p>${(section.detail.rows || []).map(row => `<p class="${esc(c.note)}"><strong>${esc(row.label)}:</strong> ${esc(row.text)}</p>`).join('')}</div>` : '') : '';
    return `<section class="town-records-section" data-section="${esc(id)}" aria-labelledby="town-records-${esc(id)}"><${hn} id="town-records-${esc(id)}">${esc(section.title)}</${hn}>`
      + (section.lines || []).map(line => note(line)).join('') + list + (section.note ? note(section.note) : '') + actions + detail + '</section>';
  }).join('');
  return `<div class="town-records" data-phase="ready">${note(LEAD, ' town-records-lead')}${message}${sections}</div>`;
}

/** The card's behaviour for one signed-in account: load() reads the route ({ records }), send(command) posts one rights command
 * ({ id, type, payload, expectedRevision }) and answers with the changed card, confirm({ title, body, ok }) asks once more,
 * onChange() redraws. A reply that arrives after reset() (another account, a sign-out) is dropped. */
export function createTownRecords({ load, send, confirm, onChange = () => {}, randomId = () => globalThis.crypto.randomUUID() }) {
  // epoch orders the reads; generation changes only on reset() (another account, a sign-out).
  let state = townRecordsState(), epoch = 0, generation = 0;
  const changed = () => onChange(state);
  const quiet = error => error?.code === 'changed' || error?.code === 'ACCOUNT_CHANGED';
  async function refresh({ keepMessage = false } = {}) {
    const token = ++epoch;state = { ...state, phase: state.records ? state.phase : 'loading', message: keepMessage ? state.message : null };changed();
    try { const reply = await load();if (token !== epoch) return;state = { ...state, phase: 'ready', records: reply?.records ?? null, failure: null }; }
    catch (error) {
      if (token !== epoch || quiet(error)) return;
      // A reason the account gives (a deletion request) closes the card even over rows already shown; a passing failure keeps them.
      const failure = LOAD_ERRORS[error?.code] || null;
      state = failure || !state.records ? { ...state, phase: 'failed', records: null, open: [], message: null, failure } : { ...state, message: { text: errorText(error), tone: 'error' } };
    }
    changed();
  }
  async function press(key) {
    if (key === 'retry') return refresh();
    const [id, part] = String(key || '').split('.');
    if (part === 'more') { const open = state.open.includes(id) ? state.open.filter(x => x !== id) : [...state.open, id];state = { ...state, open };changed();return; }
    const action = actionOf(state.records, key);
    if (!action || state.busy !== null || !state.records?.started) return;
    if (action.confirm && !await confirm({ title: action.confirm, body: [], ok: action.label })) return;
    const token = epoch, gen = generation, command = { id: randomId(), type: action.type, payload: { ...(action.payload || {}) }, expectedRevision: state.records.revision };
    state = { ...state, busy: key, message: null };changed();
    // A read that ran while the command was on its way stands (its card is the newer one): only the buttons come back.
    const overtaken = () => { if (token === epoch) return false;state = { ...state, busy: null };changed();return true; };
    try {
      const reply = await send(command);if (gen !== generation || overtaken()) return;
      state = { ...state, busy: null, records: reply?.records ?? state.records, message: { text: doneText(command), tone: 'ok' } };changed();
    } catch (error) {
      if (gen !== generation || quiet(error) || overtaken()) return;
      state = { ...state, busy: null, message: { text: errorText(error), tone: 'error' } };changed();
      if (RELOAD.has(error?.code)) await refresh({ keepMessage: true });
    }
  }
  return Object.freeze({
    refresh, press, state: () => state,
    html: options => townRecordsHtml(state, options),
    reset() { epoch++;generation++;state = townRecordsState(); },
  });
}

/** For a web host that keeps its own DOM: draws the card into element (again after each change) and takes its clicks. The
 * keyboard stays on the control it was on (data-town): a control is disabled while its command is on its way, so the key waits
 * until it is enabled again, and a row that left (forgotten, removed) hands the keyboard to the card's next control. */
export function attachTownRecords(card, element, options = {}) {
  let pending = null;
  const draw = () => {
    const doc = element.ownerDocument, active = doc?.activeElement;
    if (active && element.contains(active)) pending = active.dataset?.town || null;
    else if (active && active !== doc.body) pending = null;
    element.innerHTML = card.html(options);
    restoreTownFocus(element, pending, next => { pending = next; });
  };
  element.onclick = event => { const target = event.target?.closest?.('[data-town]');if (target && element.contains(target) && !target.disabled) void card.press(target.dataset.town); };
  draw();
  return draw;
}

/** Gives the keyboard back to the card control key (see attachTownRecords); done(null) once it landed or cannot. */
export function restoreTownFocus(root, key, done) {
  if (!key) return;
  const node = [...(root.querySelectorAll?.('[data-town]') || [])].find(item => item.dataset?.town === key);
  if (node && !node.disabled) { node.focus?.({ preventScroll: true });done(null); }
  else if (!node) { root.querySelector?.('[data-town]:not([disabled])')?.focus?.({ preventScroll: true });done(null); }
}
/** The town part of the records download: the first export page's town (as synk-account sends it — null where the town's
 * tables are not there yet) with every following page (synk-account?view=town-export under its own cursors and the first
 * page's cutoff), commands and events joined in order. nextPage({ afterCommand, afterEvent, at }) answers { town }. */
export async function townExport(first, nextPage, { maxPages = 1000 } = {}) {
  if (!first) return first ?? null;
  const out = { ...first, commands: [...(first.commands || [])], events: [...(first.events || [])] };
  for (let page = first, n = 0; page.hasMore; n++) {
    if (n >= maxPages) throw Object.assign(new Error('마을 기록이 많아 한 번에 마치지 못했어요. 잠시 뒤 다시 해 주세요.'), { code: 'EXPORT_TOO_LARGE' });
    const next = (await nextPage({ afterCommand: page.afterCommand || '', afterEvent: page.afterEvent || '', at: first.exportAt }))?.town;
    if (!next || !Array.isArray(next.commands) || !Array.isArray(next.events) || next.afterCommand === page.afterCommand && next.afterEvent === page.afterEvent)
      throw Object.assign(new Error('마을 기록 내려받기가 중간에 멈췄어요. 다시 해 주세요.'), { code: 'EXPORT_BROKEN' });
    out.commands.push(...next.commands);out.events.push(...next.events);page = next;
  }
  const { hasMore, afterCommand, afterEvent, ...whole } = out;
  return whole;
}
