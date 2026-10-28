/** 「마을 기록」 — what the town keeps of the player and what the player may do about it (vertical slice design §20-5,
 * W6c). The rows of the neighbour notebook's 「마을이 기억하는 것」 and 「익숙한 생활」 live here: what each resident knows of
 * things done together, the settings the village keeps for the player (W6: filling the spots at the time the player
 * usually comes), the familiar life, and the evaluation-only signals' consent row (§20-4, design review F8). The notebook
 * (day-notebook.mjs) reads its rows here, and the account screens — WORLD 「내 계정」, the synk.im account portal and the
 * PC member app — get the same rows as one card through talk's records route (accountRecords), so the two never judge
 * differently. Every action is a town command; the card outside the town offers only the rights ones (scope.mjs), the
 * rest show without a button. Nothing here reads the evaluation branch (G11) — only the consent's state and the consent
 * contract's words; nothing counts, dates or ranks (G2·G3).
 */
import { CARDS, PAIRS, PARAMS, RESIDENTS, EVAL_CONSENT } from './data.gen.mjs';
import { privateOf } from './knowledge.mjs';
import { commandScope } from './scope.mjs';

const RESIDENT_IDS = Object.freeze(RESIDENTS.map(resident => resident.id));
// The residents by name and the four feedback words as day-cards.mjs shows them (tests/town-records.test.js keeps them the same).
export const RESIDENT_NAMES = Object.freeze({ 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원' });
export const FEEDBACK_WORDS = Object.freeze([['helpful', '좋았어요'], ['not_fit', '안 맞았어요'], ['too_much', '많았어요'], ['want_more', '더 하고 싶어요']]);
export const FAMILY_LABELS = Object.freeze({ 'cafe-life': '찻집 생활', 'workshop-life': '공방 생활', 'greenhouse-life': '온실 생활', gather: '모으기' });
// The life activities by name (W8: the tea order — 「찻집 주문」 as the player's thing done, 「찻집 일」 as what the owner remembers;
// W8b: gathering — 「잎 모으기」 both ways, picked beside the cafe owner or given to her).
export const ACTIVITY_LABELS = Object.freeze({ 'tea-order': '찻집 주문', gather: '잎 모으기' }), ACTIVITY_MEMORY_LABELS = Object.freeze({ 'tea-order': '찻집 일', gather: '잎 모으기' });
// The consent's whole text under 「자세히」, row by row (the contract's detail keys).
export const DETAIL_ROWS = Object.freeze([['purpose', '무엇을 위해'], ['uses', '쓰는 것'], ['notUsed', '쓰지 않는 것'], ['keep', '보관'], ['choose', '고르기'], ['notAsked', '묻지 않는 경우'], ['contact', '문의']]);
const CARD_BY_ID = new Map(CARDS.map(card => [card.id, card]));
// The parameter version's own threshold (§8-1 familiarAfter): more than this many times through the same card or pair scene.
const FAMILIAR_AFTER = (Array.isArray(PARAMS) ? PARAMS[0] : null)?.seen?.familiarAfter ?? 3;
const familyCount = (seen, prefix) => Object.entries(seen || {}).reduce((sum, [key, n]) => sum + (key.startsWith(prefix) && Number.isFinite(n) ? n : 0), 0);
export const activityLabel = activity => { if (ACTIVITY_LABELS[activity]) return ACTIVITY_LABELS[activity]; const card = /^card\.([CWR][1-6])$/.exec(activity || '')?.[1]; return card && CARD_BY_ID.get(card) ? CARD_BY_ID.get(card).title : '마을에서 한 생활'; };

/** 「익숙한 생활」: the cards and pair scenes the player has been through more than a few times (the seen ledger). */
export function familiarOf(seen) {
  return [
    ...CARDS.filter(card => familyCount(seen, `card:${card.id}:`) > FAMILIAR_AFTER).map(card => ({ key: `card:${card.id}`, title: card.title })),
    ...PAIRS.filter(pair => familyCount(seen, `pair:${pair.scene}:`) > FAMILIAR_AFTER).map(pair => ({ key: `pair:${pair.scene}`, title: `${RESIDENT_NAMES[pair.members[0]]}과 ${RESIDENT_NAMES[pair.members[1]]}의 이야기` })),
  ];
}
/** What each resident knows of things done with the player, from the world — the scene's knownMe (core cardsView), without
 * what the player asked it to forget. */
export const knownMeOf = state => state?.village ? Object.fromEntries(RESIDENT_IDS.map(npc => [npc, privateOf(state.village, npc, state.forgotten || [])
  .map(({ ref, card, activity, path }) => ({ ref, ...(activity ? { activity } : { card }), path }))])) : {};
/** 「주민이 아는 나」: one row per thing a resident knows was done with the player (a card or, W8, a life activity's day). */
export const knownOf = knownMe => Object.entries(knownMe || {}).flatMap(([npc, list]) => (list || []).filter(e => CARD_BY_ID.has(e.card) || ACTIVITY_MEMORY_LABELS[e.activity])
  .map(e => ({ npc, ref: e.ref, card: e.card ?? null, title: e.activity ? ACTIVITY_MEMORY_LABELS[e.activity] : CARD_BY_ID.get(e.card).title })));
/** 「마을이 맞춰 둔 것」: the settings the village keeps for the player, each with the command that undoes or changes it
 * ([type, payload, button]). */
export function settingsOf(state) {
  const prefs = state?.prefs || null, bands = state?.visitBands && typeof state.visitBands === 'object' ? state.visitBands : null;
  return [
    // The time the player usually comes (§10-3, W6): filling the village's spots then is on until the player turns it off.
    ...(bands ? [bands.off ? { kind: 'visit-bands', label: '자주 오는 때에 맞춰 마을 자리 채우기 · 꺼 둠', action: ['PREF_VISIT_BANDS', { on: true }, '켜기'] }
      : { kind: 'visit-bands', label: '내가 자주 오는 때에 맞춰 마을 자리를 채워요', action: ['PREF_VISIT_BANDS', { on: false }, '끄기'] }] : []),
    ...(prefs?.preferredFamily ? [{ kind: 'family', label: `먼저 보여 줄 생활 · ${FAMILY_LABELS[prefs.preferredFamily] || prefs.preferredFamily}`, action: ['PREF_FAMILY', { family: prefs.preferredFamily, answer: 'clear' }, '먼저 보여 주지 않아도 돼요'] }] : []),
    ...(prefs?.observed ? [{ kind: 'observed', label: `요즘 자주 한 생활 · ${FAMILY_LABELS[prefs.observed] || prefs.observed}`, action: ['OBSERVED_CORRECT', { family: prefs.observed }, '그때만 한 거예요'] }] : []),
    ...(prefs?.lessOften || []).map(activity => ({ kind: 'less', label: `덜 추천하는 생활 · ${activityLabel(activity)}`, action: ['PREF_LESS_OFTEN', { activity, on: false }, '다시 추천해도 돼요'] })),
    ...(prefs?.approachOptOut || []).map(activity => ({ kind: 'approach', label: `먼저 말 걸지 않는 생활 · ${activityLabel(activity)}`, action: ['PREF_APPROACH', { activity, optOut: false }, '다시 말 걸어도 돼요'] })),
    ...(prefs?.feedback || []).map(f => ({ kind: 'feedback', label: `내가 남긴 응답 · ${activityLabel(f.canonicalActivityId)} · ${FEEDBACK_WORDS.find(([value]) => value === f.value)?.[1] || ''}`, action: ['FEEDBACK_REMOVE', { eventId: f.completionId }, '응답 지우기'] })),
  ];
}
/** 「마을을 낫게 하는 데 쓰는 기록」 (§20-4·§20-5): shown where the host keeps the evaluation-only signals (host); where it
 * does not (the privacy notice first), only a consent already given shows, with 「그만 쓰기」 alone (design review F8). An
 * academy-linked account is never asked and cannot turn it on. consent is the world's state (null before the W6 field). */
export function evalRecord({ consent = null, host = false, academy = false } = {}) {
  if (!consent || !EVAL_CONSENT) return null;
  const on = consent === 'granted';
  if (academy) return on ? { on, stopOnly: true } : { academy: true };
  if (!host && !on) return null;
  return { on, stopOnly: !host, ver: EVAL_CONSENT.ver, detail: EVAL_CONSENT.detail };
}

/** The card the account screens show (talk's records route): the notebook's rows as sections of title, lines, rows and
 * buttons — { revision, sections: [{ id, title, lines?, empty?, rows?, note?, actions?, detail? }] }, a row { text, action? },
 * a button { type, payload, label, confirm? } sent as a town command at that revision. The screens draw it as it comes, so
 * the words and the rules live once. A setting whose command is not a rights one (it needs the town) shows without its
 * button. academy is the account's own (talk's academyAccount — the same judgement as the command); evalSignals the
 * host's switch. */
export function accountRecords(state, { seen = {}, evalSignals = false, academy = false } = {}) {
  const button = ([type, payload, label], confirm) => commandScope(type) === 'rights' ? { type, payload, label, ...(confirm ? { confirm } : {}) } : null;
  const known = knownOf(knownMeOf(state)).map(k => ({ text: `${RESIDENT_NAMES[k.npc]} · ${k.title} — 같이 했어요`, action: button(['MEMORY_FORGET', { npc: k.npc, eventId: k.ref }, '잊어 주세요']) }));
  const settings = settingsOf(state).map(s => ({ text: s.label, action: button(s.action) }));
  const record = evalRecord({ consent: state?.consents?.evalSignals?.state ?? null, host: evalSignals === true, academy: academy === true });
  return { revision: state?.revision ?? 0, sections: [
    { id: 'known', title: '주민이 아는 나', empty: '주민이 기억하는, 같이 한 일이 아직 없어요.', rows: known },
    { id: 'settings', title: '마을이 맞춰 둔 것', empty: '마을이 맞춰 둔 것이 아직 없어요.', rows: settings, ...(settings.some(row => !row.action) ? { note: '단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.' } : {}) },
    { id: 'familiar', title: '익숙한 생활', empty: '여러 번 함께한 생활이 여기에 모여요.', rows: familiarOf(seen).map(f => ({ text: f.title })), note: '본 것 기록을 비우면 모두 다시 새 이야기로 보여요.',
      actions: [button(['SEEN_CLEAR', {}, '본 것 기록 비우기'], '본 것 기록을 비울까요? 마을의 일과 주민의 기억은 그대로예요.')] },
    ...(record ? [evalSection(record, button)] : []),
    { id: 'clear', title: '맞춤 기록 모두 비우기', lines: ['요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요. 직접 정한 설정과 마을의 일은 그대로예요.'],
      actions: [button(['MEMORY_CLEAR', {}, '비우기'], '맞춤 기록을 모두 비울까요?')] },
  ] };
}
// The consent's row as the notebook draws it: the state (with the keeping line from the consent contract, so the days never
// drift from it), 「좋아요」 where the host keeps them, 「그만 쓰기」 with one more confirm (it deletes what was kept), the
// whole text under 「자세히」.
function evalSection(record, button) {
  const title = '마을을 낫게 하는 데 쓰는 기록';
  if (record.academy) return { id: 'eval', title, lines: ['학원 소속 계정에는 묻지 않아요.'] };
  const stop = button(['EVAL_CONSENT', { state: 'withdrawn' }, '그만 쓰기'], '그만 쓸까요? 지금까지 모은 기록을 지워요.');
  return { id: 'eval', title, lines: [record.on ? ['쓰고 있어요.', EVAL_CONSENT?.easy?.keep].filter(Boolean).join(' ') : '쓰지 않고 있어요. 안 써도 마을은 똑같아요.'],
    actions: record.on ? [stop] : record.stopOnly ? [] : [button(['EVAL_CONSENT', { state: 'granted', ver: record.ver }, '좋아요'])],
    ...(record.detail ? { detail: { title: record.detail.title, rows: DETAIL_ROWS.filter(([key]) => record.detail[key]).map(([key, label]) => ({ label, text: record.detail[key] })) } } : {}) };
}
