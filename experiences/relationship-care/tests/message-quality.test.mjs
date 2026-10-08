import test from 'node:test';
import assert from 'node:assert/strict';
import { makePerson, makeEvent, emptyState, captureSource, draftMessage, generateCheckinDraft, defaultDraftApproach, exportBackup, importBackup } from '../model.mjs';

const now = '2026-10-08T03:00:00.000Z';
const person = (preference = {}, rest = {}) => makePerson({ id: 'quality_person', name: '민수', ...rest, recipientPreference: { confirmed: true, ...preference } });
const event = (type, date = '2026-10-15') => makeEvent({ id: `quality_${type}`, personId: 'quality_person', type, date });
const saved = text => ({ text, savedAt: now });

test('직접 고른 안부 목적 세 가지가 짧게·따뜻하게·반말·존댓말에 각각 반영된다', () => {
  for (const formality of ['casual', 'polite']) {
    const p = person({ formality, salutation: formality === 'casual' ? '민수야' : '김민수 팀장님' });
    const shortTexts = [];
    for (const checkinIntent of ['everyday', 'reconnect', 'thanks']) {
      const short = generateCheckinDraft(p, { checkinIntent, approach: 'short' });
      const warm = generateCheckinDraft(p, { checkinIntent, approach: 'warm' });
      assert.equal(short.checkinIntent, checkinIntent);
      assert.equal(short.eventType, 'checkin');
      assert.equal(short.eventId, '');
      assert.ok(warm.text.length > short.text.length);
      assert.ok(short.text.startsWith(p.recipientPreference.salutation));
      assert.equal(short.method, 'template');
      assert.equal(short.needsReview, true);
      assert.doesNotMatch(warm.text, /오늘|내일|어제|만나|선물|송금|찾아갈|연락할게/u);
      if (checkinIntent === 'reconnect') assert.match(short.text, /오랜만/u);
      else if (checkinIntent === 'thanks') assert.match(short.text, /고마워|감사합니다/u);
      else assert.doesNotMatch(short.text, /오랜만|고마워|감사/u);
      if (formality === 'polite') assert.doesNotMatch(warm.text, /민수야|잘 지내\?|연락했어\./u);
      shortTexts.push(short.text);
    }
    assert.equal(new Set(shortTexts).size, 3);
  }
});

test('일상 안부를 기본으로 쓰며 이야기·분류·미확인 설정에서 목적을 추정하지 않는다', () => {
  const p = person({ confirmed: false, formality: 'casual', salutation: '미확인 호칭' }, {
    group: 'friend', relationship: '오랜 친구', notes: '오랜만에 도움을 받아 고마웠다',
  });
  const draft = generateCheckinDraft(p);
  assert.equal(draft.checkinIntent, 'everyday');
  assert.doesNotMatch(draft.text, /오랜만|고마워|도움|미확인 호칭/u);
  assert.match(draft.text, /민수님/u);
  assert.throws(() => generateCheckinDraft(p, { checkinIntent: 'inferred' }), /안부의 목적/u);
  assert.deepEqual(generateCheckinDraft(p).text, generateCheckinDraft(p, { checkinIntent: 'everyday' }).text);
});

test('행사·일상 초안은 전송일을 오늘로 단정하지 않고 사용자가 쓴 날짜는 보존한다', () => {
  const p = person({ formality: 'casual' });
  for (const type of ['birthday', 'wedding', 'condolence', 'memorial', 'anniversary']) {
    for (const approach of ['short', 'warm']) assert.doesNotMatch(draftMessage(p, event(type), { approach }).text, /오늘|내일|어제/u);
  }
  const remembered = person({}, { savedMessages: { memorial: saved('오늘은 조용히 아버님을 기억할게요.') } });
  assert.equal(draftMessage(remembered, event('memorial'), { approach: 'saved' }).text, remembered.savedMessages.memorial.text);
});

test('조문·기일에는 평소 축하 맺음말과 호칭을 자동으로 붙이지 않는다', () => {
  const p = person({ formality: 'casual', salutation: '민수야', closingLine: '맛있는 거 먹고 즐거운 하루 보내!', allowEmoji: true });
  for (const type of ['condolence', 'memorial']) {
    const draft = draftMessage(p, event(type), { approach: 'warm' });
    assert.doesNotMatch(draft.text, /민수야|맛있는|즐거운|명복|천국|축하|[ㅋㅎ]|\p{Extended_Pictographic}/u);
    assert.match(draft.text, /위로/u);
    assert.match(draft.cautions.join(' '), /평소 호칭과 덧붙일 말을 자동으로 연결하지/u);
    assert.doesNotMatch(draft.basis.join(' '), /직접 정한 호칭을 사용/u);
  }
  const birthday = draftMessage(p, event('birthday'), { approach: 'warm' });
  assert.match(birthday.text, /^민수야,/u);
  assert.match(birthday.text, /맛있는 거 먹고 즐거운 하루 보내!/u);
});

test('같은 종류에 직접 기억한 위로문은 호칭과 종교 표현을 임의로 바꾸지 않으며 검사는 유지한다', () => {
  const p = person({ salutation: '평소 호칭', closingLine: '즐거운 주말 보내!', noReplyPressure: true, avoidPhrases: ['힘내'] }, {
    savedMessages: { condolence: saved('민수야, 삼가 고인의 명복을 빕니다. 힘내. 농담이야! 💐 답장 꼭 해줘. 조용히 마음을 전할게.') },
  });
  const draft = draftMessage(p, event('condolence'), { approach: 'saved' });
  assert.match(draft.text, /^민수야, 삼가 고인의 명복을 빕니다\./u);
  assert.match(draft.text, /조용히 마음을 전할게/u);
  assert.doesNotMatch(draft.text, /평소 호칭|즐거운|힘내|농담|답장|\p{Extended_Pictographic}/u);
  assert.equal(draft.method, 'saved');
  assert.match(draft.cautions.join(' '), /종교/u);
});

test('기억한 안부는 새 목적 때문에 다시 쓰지 않으며 답장 부담 문장을 중복 추가하지 않는다', () => {
  const originalText = '오랜만이야! 답장은 부담 갖지 말고 편할 때 줘.';
  const p = person({ noReplyPressure: true, formality: 'polite' }, { savedMessages: { checkin: saved(originalText) } });
  for (const checkinIntent of ['everyday', 'reconnect', 'thanks']) {
    const draft = generateCheckinDraft(p, { approach: 'saved', checkinIntent });
    assert.equal(draft.text, originalText);
    assert.equal(draft.method, 'saved');
    assert.match(draft.cautions.join(' '), /안부 목적에 맞춰 문구를 자동으로 바꾸지/u);
  }
  const pressure = person({ noReplyPressure: true }, { savedMessages: { checkin: saved('고마웠어. 답장 꼭 해줘.') } });
  const draft = generateCheckinDraft(pressure, { approach: 'saved', checkinIntent: 'thanks' });
  assert.equal(draft.text, '고마웠어.');
  assert.match(draft.cautions.join(' '), /답장을 재촉하는 표현/u);
});

test('기억한 문구에서 직접 뺀 평소 맺음말을 재사용 때 되붙이지 않고 새 틀에만 연결한다', () => {
  const originalText = '팀장님, 함께 고민해 주셔서 감사합니다. 덕분에 많이 배웠어요.';
  const p = person({ formality: 'polite', salutation: '팀장님', closingLine: '즐거운 하루 보내세요!' }, {
    savedMessages: { checkin: saved(originalText) },
  });
  const remembered = generateCheckinDraft(p, { approach: 'saved', checkinIntent: 'thanks' });
  assert.equal(remembered.text, originalText);
  assert.doesNotMatch(remembered.basis.join(' '), /덧붙일 말을 연결/u);
  const fresh = generateCheckinDraft(p, { approach: 'short', checkinIntent: 'thanks' });
  assert.match(fresh.text, /즐거운 하루 보내세요!/u);
  assert.match(fresh.basis.join(' '), /직접 쓴 덧붙일 말을 연결/u);
});

test('새 목적의 초안에도 확인한 피할 표현·답장 선호가 적용되고 전부 지워지면 직접 작성을 알린다', () => {
  const p = person({ formality: 'casual', noReplyPressure: true, avoidPhrases: ['오랜만'] });
  const draft = generateCheckinDraft(p, { checkinIntent: 'reconnect', approach: 'short' });
  assert.doesNotMatch(draft.text, /오랜만/u);
  assert.match(draft.text, /답장은 편할 때/u);
  assert.deepEqual(draft.removedPhrases, ['오랜만']);
  const blocked = generateCheckinDraft(person({ formality: 'casual', avoidPhrases: ['고마워'] }), { checkinIntent: 'thanks', approach: 'short' });
  assert.equal(blocked.text, '');
  assert.equal(blocked.needsComposition, true);
});

test('첫 초안 선택은 확인한 길이와 같은 종류 문구를 따르며 다른 사람·종류를 섞지 않는다', () => {
  const short = person({ length: 'short' }), warm = person({ length: 'balanced' });
  const unconfirmed = person({ confirmed: false, length: 'short' });
  const remembered = person({ length: 'short' }, { savedMessages: { birthday: saved('생일에만 쓸 문구') } });
  assert.equal(defaultDraftApproach(short, 'checkin'), 'short');
  assert.equal(defaultDraftApproach(warm, 'checkin'), 'warm');
  assert.equal(defaultDraftApproach(unconfirmed, 'checkin'), 'warm');
  assert.equal(defaultDraftApproach(remembered, 'birthday'), 'saved');
  assert.equal(defaultDraftApproach(remembered, 'birthday', { preferSaved: false }), 'short');
  assert.equal(defaultDraftApproach(remembered, 'condolence'), 'short');
  assert.equal(defaultDraftApproach(short, 'birthday'), 'short');
  assert.throws(() => defaultDraftApproach(short, 'unknown'), /종류/u);
  const ordinary = generateCheckinDraft(remembered, { approach: 'saved', checkinIntent: 'thanks' });
  assert.equal(ordinary.method, 'template');
  assert.doesNotMatch(ordinary.text, /생일에만/u);
  assert.match(ordinary.text, /감사/u);
});

test('선택한 기억의 정확한 인용과 철회 검증을 유지하며 목적은 수첩 스키마에 저장하지 않는다', () => {
  const p = person({ formality: 'casual' });
  let state = { ...emptyState(), people: [p], events: [] };
  state = captureSource(state, { personId: p.id, title: '합성 기록', text: '지난봄 강변 산책.', memories: [{ kind: 'memory', text: '지난봄 강변 산책', sourceQuote: '지난봄 강변 산책' }] }, now);
  const before = JSON.stringify(state), memorySelection = { memoryId: state.memories[0].id, use: 'shared-memory', confirmed: true };
  const draft = generateCheckinDraft(p, { state, memorySelection, checkinIntent: 'thanks', approach: 'warm' });
  assert.match(draft.text, /“지난봄 강변 산책”/u);
  assert.deepEqual(draft.memory.appliedTo, ['message']);
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => generateCheckinDraft(p, { state: { ...state, memories: [] }, memorySelection, checkinIntent: 'thanks' }), /기억과 원문/u);
  const backup = exportBackup(state, now);
  assert.equal(backup.version, 1);
  assert.doesNotMatch(JSON.stringify(backup), /checkinIntent/u);
  assert.deepEqual(importBackup(backup), state);
});
