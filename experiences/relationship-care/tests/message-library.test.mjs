import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, makePerson, makeEvent, importBackup, exportBackup, captureSource, revokeCareMemory,
  rememberDraft, listSavedMessages, toggleMessageFavorite, removeSavedMessage,
  defaultDraftApproach, draftMessage, generateCheckinDraft,
} from '../model.mjs';

const now = '2026-10-08T03:00:00.000Z';
const later = '2026-10-08T04:00:00.000Z';
const saved = (text, savedAt = now) => ({ text, savedAt });
const row = (id, extra = {}) => ({ id, type: 'birthday', text: `직접 쓴 문구 ${id}`, savedAt: now, favorite: false, ...extra });
function fixture(extra = {}) {
  return { ...emptyState(), people: [makePerson({ id: 'p', name: '친구', ...extra }), makePerson({ id: 'other', name: '다른 친구' })],
    events: [makeEvent({ id: 'birthday', personId: 'p', type: 'birthday', date: '2026-10-09' }), makeEvent({ id: 'memorial', personId: 'p', type: 'memorial', date: '2026-10-09' })] };
}
const store = (state, text, extra = {}, at = now) => rememberDraft(state, { personId: 'p', eventId: 'birthday', text, ...extra }, at);
const person = state => state.people.find(item => item.id === 'p');
const checkin = (intent, extra = {}) => ({ eventId: '', eventType: 'checkin', checkinIntent: intent, ...extra });

test('옛 savedMessages는 결정적 ID로 보여 주고 첫 조작에만 이관하며 원문과 목적 미지정을 보존한다', () => {
  const original = fixture({ savedMessages: { birthday: saved('옛 생일 문구'), checkin: saved('고마웠어. 오랜만이네.') } });
  const snapshot = JSON.stringify(original);
  const first = listSavedMessages(person(original)), second = listSavedMessages(makePerson(person(original)));
  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(person(original), 'messageLibrary'), false);
  assert.equal(Object.hasOwn(person(importBackup(original)), 'messageLibrary'), false);
  assert.equal(first.find(item => item.type === 'checkin').checkinIntent, 'unspecified');
  assert.equal(defaultDraftApproach(person(original), 'checkin', { checkinIntent: 'thanks' }), 'warm');
  const next = store(original, '새 생일 문구');
  assert.equal(person(next).messageLibrary.length, 3);
  for (const old of first) assert.deepEqual(person(next).messageLibrary.find(item => item.id === old.id), old);
  assert.equal(person(next).savedMessages.birthday.text, '새 생일 문구');
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(importBackup(importBackup(next)), next);
  const other = makePerson({ ...person(original), id: 'other' });
  assert.ok(listSavedMessages(other).every(item => !first.some(old => old.id === item.id)));
});

test('같은 사람·종류·안부 목적·문구를 중복 저장해도 버전이나 즐겨찾기·저장 시각을 바꾸지 않는다', () => {
  let state = store(fixture(), '고마워.', checkin('thanks'));
  const id = person(state).messageLibrary[0].id;
  state = toggleMessageFavorite(state, { personId: 'p', messageId: id });
  const duplicate = store(state, '  고마워.  ', checkin('thanks'), later);
  assert.deepEqual(duplicate, state);
  const another = store(duplicate, '고마워.', checkin('everyday'), later);
  assert.equal(person(another).messageLibrary.length, 2);
  assert.equal(person(another).messageLibrary.find(item => item.id === id).favorite, true);
  const birthday = store(another, '고마워.');
  assert.equal(person(birthday).messageLibrary.length, 3);
});

test('목적별 보관 문구를 자동 선택하며 다른 목적이나 다른 사람의 ID를 불러오지 않는다', () => {
  let state = fixture();
  for (const intent of ['everyday', 'reconnect', 'thanks']) state = store(state, `${intent}에 직접 쓴 문구`, checkin(intent));
  for (const intent of ['everyday', 'reconnect', 'thanks']) {
    const p = person(state), list = listSavedMessages(p, { type: 'checkin', checkinIntent: intent });
    assert.equal(list.length, 1);
    assert.equal(defaultDraftApproach(p, 'checkin', { checkinIntent: intent }), 'saved');
    assert.equal(defaultDraftApproach(p, 'checkin', { checkinIntent: intent, preferSaved: false }), 'warm');
    const draft = generateCheckinDraft(p, { checkinIntent: intent, approach: 'saved' });
    assert.equal(draft.savedMessageId, list[0].id);
    assert.equal(draft.text, list[0].text);
    assert.throws(() => generateCheckinDraft(state.people[1], { checkinIntent: intent, savedMessageId: list[0].id }), /사람·상황/u);
    assert.throws(() => draftMessage(p, state.events[0], { savedMessageId: list[0].id }), /사람·상황/u);
    for (const otherIntent of ['everyday', 'reconnect', 'thanks'].filter(value => value !== intent)) {
      assert.throws(() => generateCheckinDraft(p, { checkinIntent: otherIntent, savedMessageId: list[0].id }), /사람·상황/u);
    }
  }
  const onlyThanks = person(store(fixture(), '고마워.', checkin('thanks')));
  assert.equal(defaultDraftApproach(onlyThanks, 'checkin', { checkinIntent: 'reconnect' }), 'warm');
  assert.equal(generateCheckinDraft(onlyThanks, { checkinIntent: 'reconnect', approach: 'saved' }).method, 'template');
});

test('즐겨찾기는 최신 문구보다 먼저 나오고 해제하면 최신순으로 돌아오며 복원은 원문을 덮어쓰지 않는다', () => {
  let state = store(fixture(), '첫 문구');
  const original = person(state).messageLibrary[0];
  state = store(state, '두 번째 문구', {}, later);
  const newest = listSavedMessages(person(state))[0];
  assert.equal(newest.text, '두 번째 문구');
  state = toggleMessageFavorite(state, { personId: 'p', messageId: original.id });
  assert.equal(listSavedMessages(person(state))[0].id, original.id);
  assert.equal(draftMessage(person(state), state.events[0], { approach: 'saved' }).savedMessageId, original.id);
  const snapshot = JSON.stringify(state);
  const restored = draftMessage(person(state), state.events[0], { savedMessageId: original.id });
  assert.equal(restored.text, '첫 문구');
  assert.equal(restored.approach, 'saved');
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(person(state).savedMessages.birthday.text, '두 번째 문구');
  assert.equal(person(state).messageLibrary[0].savedAt, original.savedAt);
  state = toggleMessageFavorite(state, { personId: 'p', messageId: original.id });
  assert.equal(listSavedMessages(person(state))[0].id, newest.id);
  assert.throws(() => toggleMessageFavorite(state, { personId: 'other', messageId: original.id }), /사람이 바뀌었/u);
});

test('목적 미지정 옛 안부는 직접 불러올 수 있고 목적이 확인된 문구가 기본 선택을 우선한다', () => {
  let state = fixture({ savedMessages: { checkin: saved('예전 안부 문구') } });
  const old = listSavedMessages(person(state), { type: 'checkin', checkinIntent: 'thanks' })[0];
  assert.equal(old.checkinIntent, 'unspecified');
  for (const checkinIntent of ['everyday', 'reconnect', 'thanks']) {
    assert.equal(generateCheckinDraft(person(state), { checkinIntent, savedMessageId: old.id }).text, old.text);
  }
  state = toggleMessageFavorite(state, { personId: 'p', messageId: old.id });
  state = store(state, '감사 목적의 새 문구', checkin('thanks'), later);
  assert.equal(listSavedMessages(person(state), { type: 'checkin', checkinIntent: 'thanks' })[0].id, old.id);
  assert.equal(generateCheckinDraft(person(state), { checkinIntent: 'thanks', approach: 'saved' }).text, '감사 목적의 새 문구');
  assert.equal(defaultDraftApproach(person(state), 'checkin', { checkinIntent: 'everyday' }), 'warm');
});

test('삭제한 문구는 mirror·백업에서 되살아나지 않고 오래된 명시 선택은 현재 수첩에서 거부한다', () => {
  let state = store(fixture({ savedMessages: { birthday: saved('옛 문구') } }), '새 문구', {}, later);
  const stalePerson = person(state), newest = listSavedMessages(stalePerson)[0];
  state = removeSavedMessage(state, { personId: 'p', messageId: newest.id });
  assert.equal(person(state).savedMessages.birthday.text, '옛 문구');
  assert.throws(() => draftMessage(person(state), state.events[0], { savedMessageId: newest.id }), /삭제되었/u);
  assert.throws(() => draftMessage(stalePerson, state.events[0], { state, savedMessageId: newest.id }), /삭제되었/u);
  const old = listSavedMessages(person(state))[0];
  state = removeSavedMessage(state, { personId: 'p', messageId: old.id });
  assert.deepEqual(person(state).messageLibrary, []);
  assert.deepEqual(person(state).savedMessages, {});
  assert.deepEqual(listSavedMessages(person(importBackup(JSON.stringify(exportBackup(state, now))))), []);
  assert.throws(() => removeSavedMessage(state, { personId: 'p', messageId: old.id }), /삭제되었/u);
});

test('명시 빈 보관함은 legacy mirror가 남은 입력에서도 권위가 있고 새 저장 시 다시 이관하지 않는다', () => {
  const state = fixture({ savedMessages: { birthday: saved('이제 지운 문구') }, messageLibrary: [] });
  assert.deepEqual(listSavedMessages(person(importBackup(state))), []);
  assert.equal(draftMessage(person(state), state.events[0], { approach: 'saved' }).method, 'template');
  const next = store(state, '다시 쓰는 새 문구');
  assert.equal(person(next).messageLibrary.length, 1);
  assert.equal(person(next).messageLibrary[0].text, '다시 쓰는 새 문구');
});

test('이전 버전과 즐겨찾기는 v1 백업을 왕복하고 행사는 안부 목적 없이 보존된다', () => {
  let state = store(fixture(), '처음');
  state = store(state, '수정한 다음 버전', {}, later);
  state = store(state, '고마워', checkin('thanks'));
  state = toggleMessageFavorite(state, { personId: 'p', messageId: person(state).messageLibrary[0].id });
  const exported = exportBackup(state, now), restored = importBackup(JSON.stringify(exported));
  assert.equal(exported.version, 1);
  assert.deepEqual(restored, state);
  assert.equal(person(restored).messageLibrary.length, 3);
  assert.ok(person(restored).messageLibrary.filter(item => item.type !== 'checkin').every(item => !Object.hasOwn(item, 'checkinIntent')));
});

test('보관함의 잘못된 형식·종류·목적·식별자·문자·시각·즐겨찾기를 조용히 바꾸거나 버리지 않는다', () => {
  const invalid = [null, {}, 'bad', [null], [row('a'), row('a')], [row('bad id')],
    [row('a', { type: 'inferred' })], [row('a', { checkinIntent: 'thanks' })],
    [row('a', { type: 'checkin', checkinIntent: 'inferred' })], [row('a', { favorite: 'yes' })],
    [row('a', { text: '' })], [row('a', { text: 'a'.repeat(5001) })], [row('a', { text: 'bad\u0000text' })],
    [row('a', { text: 'bad\ud800text' })], [row('a', { savedAt: 'yesterday' })],
    [row('a', { savedAt: '2026-02-30T03:00:00.000Z' })], [row('a', { hiddenField: true })]];
  for (const messageLibrary of invalid) assert.throws(() => fixture({ messageLibrary }));
  assert.throws(() => store(fixture(), '문구', checkin('unspecified')), /안부의 목적/u);
  assert.throws(() => store(fixture(), '문구', { checkinIntent: 'thanks' }), /행사 문구/u);
  assert.throws(() => listSavedMessages(person(fixture()), { type: 'unknown' }), /종류/u);
  assert.throws(() => listSavedMessages(person(fixture()), { type: 'birthday', checkinIntent: 'thanks' }), /목적/u);
  assert.equal(person(fixture({ messageLibrary: [row('a', { type: 'checkin' })] })).messageLibrary[0].checkinIntent, 'unspecified');
});

test('개인 100개·수첩 1000개·4 MB 한도는 저장과 가져오기 모두 실패 원인을 알리고 기존 내용을 유지한다', () => {
  const full = fixture({ messageLibrary: Array.from({ length: 100 }, (_, index) => row(`m_${index}`)) });
  const snapshot = JSON.stringify(full);
  assert.throws(() => store(full, '101번째'), /100개/u);
  assert.equal(JSON.stringify(full), snapshot);
  assert.equal(person(store(full, '직접 쓴 문구 m_0')).messageLibrary.length, 100);
  assert.throws(() => fixture({ messageLibrary: Array.from({ length: 101 }, (_, index) => row(`m_${index}`)) }), /100개/u);
  const notebook = { ...emptyState(), people: Array.from({ length: 10 }, (_, index) => makePerson({ id: `p_${index}`, name: '이름', messageLibrary: Array.from({ length: 100 }, (_, item) => row(`m_${item}`)) })) };
  assert.equal(importBackup(notebook).people.length, 10);
  notebook.people.push(makePerson({ id: 'overflow', name: '한도 초과', messageLibrary: [row('extra')] }));
  assert.throws(() => importBackup(notebook), /1,000개/u);
  const large = { ...emptyState(), people: Array.from({ length: 3 }, (_, index) => makePerson({ id: `p_${index}`, name: '이름', messageLibrary: Array.from({ length: 100 }, (_, item) => row(`m_${item}`, { text: '가'.repeat(5000) })) })) };
  assert.throws(() => importBackup(large), /4 MB/u);
  assert.throws(() => importBackup(JSON.stringify(large)), /4 MB/u);
});

test('전체 1000개 한도에서도 옛 문구 삭제는 남은 구자료를 이관하지 않고 성공한다', () => {
  const notebook = { ...emptyState(), people: [
    ...Array.from({ length: 10 }, (_, index) => makePerson({ id: `p_${index}`, name: '이름', messageLibrary: Array.from({ length: 100 }, (_, item) => row(`m_${item}`)) })),
    makePerson({ id: 'legacy', name: '옛 수첩', savedMessages: { birthday: saved('옛 생일 문구'), checkin: saved('옛 안부 문구') } }),
  ] };
  const original = JSON.stringify(notebook), entries = listSavedMessages(notebook.people.at(-1));
  const target = entries.find(item => item.type === 'birthday'), keep = entries.find(item => item.type === 'checkin');
  const next = removeSavedMessage(notebook, { personId: 'legacy', messageId: target.id });
  assert.equal(next.people.reduce((sum, item) => sum + (item.messageLibrary?.length ?? 0), 0), 1000);
  assert.equal(Object.hasOwn(next.people.at(-1), 'messageLibrary'), false);
  assert.deepEqual(listSavedMessages(next.people.at(-1)), [keep]);
  assert.equal(next.people.at(-1).savedMessages.birthday, undefined);
  assert.deepEqual(importBackup(JSON.stringify(exportBackup(next, now))), next);
  assert.equal(JSON.stringify(notebook), original);
  assert.throws(() => toggleMessageFavorite(next, { personId: 'legacy', messageId: keep.id }), /1,000개/u);
});

test('원문·기억 철회는 현재 mirror뿐 아니라 보관함의 이전 버전과 즐겨찾기도 같은 사람에서 지운다', () => {
  let state = captureSource(fixture(), { personId: 'p', title: '대화', text: '지난봄 강변 산책을 했어.', memories: [{ kind: 'memory', text: '강변 산책', sourceQuote: '강변 산책' }] }, now);
  state = store(state, '강변 산책이 생각나.', checkin('everyday'));
  const forbidden = person(state).messageLibrary[0];
  state = toggleMessageFavorite(state, { personId: 'p', messageId: forbidden.id });
  state = store(state, '강변 산책 고마웠어.', checkin('thanks'));
  state = store(state, '요즘 잘 지내?', checkin('everyday'), later);
  state = store(state, '강변 산책이 생각나.', checkin('everyday', { personId: 'other' }));
  for (const target of [{ sourceId: state.sources[0].id }, { memoryId: state.memories[0].id }]) {
    const revoked = revokeCareMemory(state, target);
    assert.equal(listSavedMessages(person(revoked)).length, 1);
    assert.equal(listSavedMessages(person(revoked))[0].text, '요즘 잘 지내?');
    assert.equal(listSavedMessages(revoked.people[1]).length, 1);
    assert.equal(person(revoked).savedMessages.checkin.text, '요즘 잘 지내?');
    assert.throws(() => generateCheckinDraft(person(state), { state: revoked, savedMessageId: forbidden.id }), /삭제되었/u);
    assert.deepEqual(importBackup(JSON.stringify(exportBackup(revoked, now))), revoked);
  }
});

test('불러오는 위로문과 다른 보관 문구도 기존 표현 안전 검사를 유지하고 저장 원문은 그대로 둔다', () => {
  let state = fixture({ recipientPreference: { confirmed: true, avoidPhrases: ['힘내'], noReplyPressure: true } });
  state = store(state, '힘내. 농담이야! 🙂 답장 꼭 해줘. 조용히 마음을 전해요.', { eventId: 'memorial' });
  const stored = person(state).messageLibrary[0];
  const result = draftMessage(person(state), state.events[1], { savedMessageId: stored.id });
  assert.equal(result.savedMessageId, stored.id);
  assert.equal(result.text, '조용히 마음을 전해요.');
  assert.match(person(state).messageLibrary[0].text, /힘내/u);
});
