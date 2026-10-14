/**
 * 선물·마음 기록. 사람별 「갖고 싶다고 말한 것」(person.wishes, 선택 칸)과
 * 「주고받은 선물」(activities의 gift 기록, item 칸)을 모아 보고, 고르려는 선물이 이미 준 선물과 겹치면 알려 준다.
 * 겹침 판단은 글자 비교라 「비슷해 보여요」로만 알리고 막지 않는다.
 */
import { OCCASION_TYPES, importBackup, makePerson, recordCareAction } from './model.mjs';
import { koreanDate } from './care-memorial.mjs';

export const CARE_GIFT_VERSION = 'care-gift-1';
const STOP_WORDS = new Set(['선물', '세트', '상품권', '기프트', '기프티콘', '카드', '작은', '큰', '예쁜', '좋은', '용', '것']);
const newId = prefix => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
const compact = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s\p{P}\p{S}]+/gu, '');
const words = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko').split(/[\s\p{P}\p{S}]+/u).filter(word => [...word].length >= 2 && !STOP_WORDS.has(word));

function personOf(state, personId) {
  const person = state.people.find(item => item.id === personId);
  if (!person) throw new Error('사람을 다시 선택해 주세요.');
  return person;
}
function replacePerson(state, person) {
  return importBackup({ ...state, people: state.people.map(item => item.id === person.id ? makePerson(person) : item) });
}

/** 「갖고 싶다고 말했어요」 메모를 더한다. 같은 글이 이미 있으면 그대로 둔다. 한 사람 50개까지. */
export function addWish(state, { personId, text, notedOn = '' } = {}, now = new Date()) {
  const current = importBackup(state), person = personOf(current, personId);
  const value = String(text ?? '').trim(), wishes = person.wishes ?? [];
  if (!value) throw new Error('갖고 싶다고 말한 것을 적어 주세요.');
  if (notedOn && notedOn > koreanDate(now)) throw new Error('들은 날짜가 오늘보다 뒤예요.');
  if (wishes.some(item => compact(item.text) === compact(value))) return current;
  if (wishes.length >= 50) throw new Error('한 사람에게 50개까지 적을 수 있어요. 지난 메모를 정리한 뒤 더해 주세요.');
  return replacePerson(current, { ...person, wishes: [...wishes, { id: newId('wish'), text: value, notedOn: notedOn || koreanDate(now), given: false }] });
}

/** 글·날짜·「이미 드렸어요」를 고친다. patch: { text?, notedOn?, given? } */
export function updateWish(state, { personId, wishId, ...patch } = {}) {
  if (Object.keys(patch).some(key => !['text', 'notedOn', 'given'].includes(key))) throw new Error('고칠 항목을 확인해 주세요.');
  const current = importBackup(state), person = personOf(current, personId), wishes = person.wishes ?? [];
  if (!wishes.some(item => item.id === wishId)) throw new Error('메모가 지워졌거나 사람이 바뀌었어요.');
  return replacePerson(current, { ...person, wishes: wishes.map(item => item.id === wishId ? { ...item, ...patch } : item) });
}

/** 메모 하나를 지운다. 마지막 하나를 지우면 빈 목록으로 남긴다. */
export function removeWish(state, { personId, wishId } = {}) {
  const current = importBackup(state), person = personOf(current, personId), wishes = person.wishes ?? [];
  if (!wishes.some(item => item.id === wishId)) throw new Error('메모가 지워졌거나 사람이 바뀌었어요.');
  return replacePerson(current, { ...person, wishes: wishes.filter(item => item.id !== wishId) });
}

/**
 * 주고받은 선물 기록(활동 gift). wishId를 주면 그 「갖고 싶다고 말한 것」을 드린 것으로 표시한다.
 * input: { personId, direction='sent', item, occurredOn=오늘, amountWon?, note?, occasion?, eventId?, wishId? }
 */
export function recordGift(state, { wishId = '', ...input } = {}, now = new Date()) {
  const allowed = ['personId', 'direction', 'item', 'occurredOn', 'amountWon', 'note', 'occasion', 'eventId'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('선물 기록의 항목을 확인해 주세요.');
  if (!String(input.item ?? '').trim()) throw new Error('어떤 선물인지 적어 주세요.');
  if (input.occasion && !Object.hasOwn(OCCASION_TYPES, input.occasion)) throw new Error('행사 종류를 확인해 주세요.');
  let next = recordCareAction(importBackup(state), { direction: 'sent', occurredOn: koreanDate(now), ...input, kind: 'gift' }, now);
  if (wishId) {
    const person = personOf(next, input.personId);
    if (!(person.wishes ?? []).some(item => item.id === wishId)) throw new Error('드린 것으로 표시할 메모가 없어요.');
    if ((input.direction ?? 'sent') !== 'sent') throw new Error('받은 선물에는 「갖고 싶다고 말한 것」을 연결할 수 없어요.');
    next = updateWish(next, { personId: person.id, wishId, given: true });
  }
  return next;
}

function giftRows(state, personId) {
  return state.activities.filter(item => item.personId === personId && item.kind === 'gift')
    .map(item => ({ id: item.id, date: item.occurredOn, direction: item.direction, item: item.item ?? '', text: item.item || item.note, amountWon: item.amountWon,
      occasion: item.occasion ?? null, occasionLabel: item.occasion ? OCCASION_TYPES[item.occasion] : null, note: item.note, eventId: item.eventId }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** 한 사람의 선물·마음 모아 보기. wishes는 아직 못 드린 것(open)과 드린 것(given)으로 나눈다. */
export function giftNotes(state, personId) {
  const current = importBackup(state), person = personOf(current, personId);
  const rows = giftRows(current, personId), wishes = person.wishes ?? [];
  return { version: CARE_GIFT_VERSION, personId, personName: person.name, deceased: person.deceased === true,
    wishes: { open: wishes.filter(item => !item.given), given: wishes.filter(item => item.given) },
    sent: rows.filter(row => row.direction === 'sent'), received: rows.filter(row => row.direction === 'received'),
    lastSent: rows.find(row => row.direction === 'sent') ?? null };
}

/** 두 이름이 같은지(same)·비슷한지(similar). 한쪽이 다른 쪽을 품거나, 두 글자 이상 낱말을 함께 쓰면 similar. */
export function giftSimilarity(a, b) {
  const x = compact(a), y = compact(b);
  if (!x || !y) return null;
  if (x === y) return 'same';
  if (Math.min([...x].length, [...y].length) >= 2 && (x.includes(y) || y.includes(x))) return 'similar';
  const shared = words(a).filter(word => words(b).includes(word));
  return shared.length ? 'similar' : null;
}

/**
 * 고르려는 선물이 이미 준 선물과 겹치는지. 받은 선물·갖고 싶다고 말한 것과의 일치도 따로 알려 준다.
 * 돌려주는 값: { overlaps: [...준 선물], receivedMatches, wishMatches, message }
 */
export function checkGiftOverlap(state, { personId, item, now = new Date() } = {}) {
  const current = importBackup(state), person = personOf(current, personId);
  if (!String(item ?? '').trim()) throw new Error('살펴볼 선물 이름을 적어 주세요.');
  const rows = giftRows(current, personId).map(row => ({ ...row, how: giftSimilarity(item, row.text) })).filter(row => row.how);
  const overlaps = rows.filter(row => row.direction === 'sent'), receivedMatches = rows.filter(row => row.direction === 'received');
  const wishMatches = (person.wishes ?? []).map(wish => ({ ...wish, how: giftSimilarity(item, wish.text) })).filter(wish => wish.how);
  const first = overlaps[0];
  const message = first ? `${Number(first.date.slice(5, 7))}월 ${Number(first.date.slice(8, 10))}일${first.date.slice(0, 4) !== koreanDate(now).slice(0, 4) ? `(${first.date.slice(0, 4)}년)` : ''}에 ${first.how === 'same' ? '같은' : '비슷해 보이는'} 선물(${first.text})을 드렸어요. 다시 드려도 괜찮은지 살펴봐 주세요.`
    : wishMatches.some(wish => !wish.given) ? '갖고 싶다고 말한 것과 맞아요.' : '';
  return { personId, item: String(item).trim(), overlaps, receivedMatches, wishMatches, message };
}
