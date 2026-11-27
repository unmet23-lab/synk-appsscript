import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskAsk, hasIdNumber, looksUrgent, numbersIn, strayNumbers, checkProfile, validateAskRequest, checkAskOutput, settleAnswer,
  checkVetOutput, unknownCount, answerSigPayload, checkBriefOutput, validateBriefRequest, checkEdits, ticketPayload, checkTicket,
  briefHashInput, validateCaseRequest, cleanText, ASK_CONSENT_VERSION, CASE_CONSENT_VERSION, MASK_TOKEN,
  validateBriefEditRequest, checkBriefEditOutput, validateAskReply
} from './ask-shape.mjs';

const UUID = '6f1c2a7e-3b4d-4c5e-8f90-1a2b3c4d5e6f';
const SUB = '0b6f7a1e-2c3d-4e5f-9a0b-1c2d3e4f5a6b';
const SIG = 'A'.repeat(43);
const ai = (o = {}) => ({ role: 'ai', text: '전북대 학부는 TOPIK 3급이 필요해요.', sig: SIG, at: 1764200000000, type: 'fact', found: true, ask_where: null, rechecking: false, kind: 'none', ...o });
const ask = (o = {}) => ({ request_id: UUID, lang: 'ko', age: 'adult', consent: ASK_CONSENT_VERSION, question: '전북대 학부 한국어 조건이 뭐예요?', history: [], ...o });

const index = new Map([
  ['prog-jbnu-ug', { id: 'prog-jbnu-ug', kind: 'program', lines: { ko: ['전북대학교 학부는 TOPIK 3급 이상이 필요하다.', '한 학기 등록금은 2,345,000원이다.'], en: ['TOPIK level 3'] }, dates: [{ date: '2027-01-15' }], ask: { ko: '전북대 국제협력부 063-270-0000', en: 'JBNU' } }],
  ['rule-d2-local', { id: 'rule-d2-local', kind: 'rule', lines: { ko: ['지방 대학 D-2 재정 증명은 16,000,000원이다.'], en: [] }, dates: [], ask: null }],
  ['help-delete', { id: 'help-delete', kind: 'help', lines: { ko: ['내 정보에서 계정의 유학 준비 자료를 지울 수 있다.'], en: [] }, dates: [], ask: null }]
]);

test('번호 가리기: 몽골 등록번호 · 여권번호 · 한국 등록번호를 ⟦R0⟧로, 다시 가려도 같다', () => {
  const s = '제 번호는 УБ99010112 이고 여권은 E1234567, 외국인등록번호 990101-5123456 이에요. TOPIK 3급, 2027년.';
  const m = maskAsk(s);
  assert.ok(!/УБ99010112|E1234567|990101-5123456/.test(m));
  assert.equal((m.match(/⟦R0⟧/g) || []).length, 3);
  assert.equal(maskAsk(m), m);
  assert.match(m, /TOPIK 3급, 2027년/);
  assert.equal(hasIdNumber(s), true);
  assert.equal(hasIdNumber(m), false);
  assert.equal(MASK_TOKEN, '⟦R0⟧');
});

test('위험 낱말: 한국어 · 영어 · 몽골어 키릴 · 라틴 글자를 잡고, 평범한 질문은 잡지 않는다', () => {
  for (const s of ['요즘 죽고 싶어요', 'my landlord beaten me', 'Намайг зодсон', 'bi uhmeer baina', 'Луйварт орсон, мөнгөө алдсан']) assert.equal(looksUrgent(s), true, s);
  for (const s of ['전북대 등록금이 얼마예요?', 'What documents do I need?', 'TOPIK шалгалт хэзээ вэ?']) assert.equal(looksUrgent(s), false, s);
});

test('숫자 대조: 쉼표 · 만 · сая를 같은 금액으로 세고, 0과 1은 보지 않는다', () => {
  assert.ok(numbersIn('1,600만 원').has('16000000'));
  assert.ok(numbersIn('16 сая төгрөг').has('16000000'));
  assert.ok(numbersIn('16,000,000원').has('16000000'));
  assert.deepEqual(strayNumbers('재정 증명은 1,600만 원이고 1년 단위예요.', ['지방 대학 D-2 재정 증명은 16,000,000원이다.']), []);
  assert.deepEqual(strayNumbers('재정 증명은 2,000만 원이에요.', ['16,000,000원']), ['20000000']);
});

test('조건 사본: 고른 칸만 받고 범위를 넘으면 거절', () => {
  assert.deepEqual(checkProfile({ topik: 3, target: 'jbnu-ug' }), { topik: 3, target: 'jbnu-ug' });
  assert.equal(checkProfile(null), null);
  assert.throws(() => checkProfile({ topik: 9 }), { code: 'ASK_BAD_PROFILE' });
  assert.throws(() => checkProfile({ compare: [] }), { code: 'ASK_BAD_PROFILE' });
  assert.throws(() => checkProfile({}), { code: 'ASK_BAD_PROFILE' });
});

test('물어보기 요청: 18세 이상 · 동의 판 · 가리지 않은 번호 · 대화 꼴을 본다', () => {
  const ok = validateAskRequest(ask({ history: [{ role: 'student', text: '안녕하세요' }, ai()], profile: { topik: 3 }, topic: 'jbnu-ug' }));
  assert.equal(ok.history.length, 2);
  assert.throws(() => validateAskRequest(ask({ age: 'teen' })), { code: 'ASK_AGE' });
  assert.throws(() => validateAskRequest(ask({ consent: 0 })), { code: 'ASK_CONSENT' });
  assert.throws(() => validateAskRequest(ask({ question: '제 여권 E1234567 이에요' })), { code: 'ASK_UNMASKED' });
  assert.throws(() => validateAskRequest(ask({ question: ' 앞 빈칸' })), { code: 'ASK_BAD_QUESTION' });
  assert.throws(() => validateAskRequest(ask({ history: [ai({ sig: 'short' })] })), { code: 'ASK_BAD_HISTORY' });
  assert.throws(() => validateAskRequest(ask({ history: Array.from({ length: 17 }, () => ({ role: 'student', text: '네' })) })), { code: 'ASK_BAD_HISTORY' });
  assert.throws(() => validateAskRequest(ask({ extra: 1 })), { code: 'ASK_BAD_REQUEST' });
});

const out = (o = {}) => ({ type: 'fact', answer: '전북대 학부는 TOPIK 3급 이상이 필요해요.', cites: ['prog-jbnu-ug'], found: true, ask_where: null, rechecking: false, kind: 'none', kind_reason: '', ...o });
const settle = (o, ctx = {}) => settleAnswer(checkAskOutput(out(o)), { index, history: [], question: '조건이 뭐예요?', ...ctx });

test('서버 검사: 사실 답은 아는 근거가 있어야 하고 모르는 id는 지운다', () => {
  assert.equal(settle({}).blocked, null);
  assert.deepEqual(settle({ cites: ['prog-jbnu-ug', 'nope'] }).answer.cites, ['prog-jbnu-ug']);
  assert.equal(settle({ cites: ['nope'] }).blocked, 'no_source');
  assert.equal(settle({ type: 'clarify', cites: [], answer: '어느 대학을 생각하세요?' }).blocked, null);
});

test('서버 검사: 근거에 없는 숫자는 막고, 질문 · 조건의 숫자는 되풀이해도 된다', () => {
  assert.equal(settle({ answer: '전북대 학부는 TOPIK 4급이 필요해요.' }).blocked, 'stray_number');
  assert.equal(settle({ answer: '학생님은 5급이니 전북대 학부 조건(TOPIK 3급)을 넘어요.' }, { profile: { topik: 5 } }).blocked, null);
  assert.equal(settle({ answer: '등록금은 한 학기 234만 5천 원이 아니라 2,345,000원이에요.' }).blocked, 'stray_number');
});

test('서버 검사: 물을 곳 · 앱 도움말 · 급함 · 번호', () => {
  assert.equal(settle({ type: 'refer', cites: [], found: false, ask_where: 'prog-jbnu-ug', answer: '전북대 국제협력부에 물어보세요.' }).blocked, null);
  assert.equal(settle({ type: 'refer', cites: [], found: false, ask_where: 'rule-d2-local', answer: '물어보세요.' }).blocked, 'bad_refer');
  assert.equal(settle({ type: 'app_help', cites: ['help-delete'], answer: '내 정보에서 지울 수 있어요.' }).blocked, null);
  assert.equal(settle({ type: 'app_help', cites: ['rule-d2-local'], answer: '내 정보에서 지울 수 있어요.' }).blocked, 'no_help');
  const urgent = settle({ type: 'clarify', kind: 'urgent', cites: [], answer: '지금 안전한가요?' });
  assert.equal(urgent.blocked, null);
  assert.equal(urgent.answer.type, 'safety');
  assert.equal(settle({ answer: '여권 E1234567로 내세요.' }).blocked, 'id_number');
});

test('stuck: 사실을 못 찾은 답이 이 대화에서 두 번째일 때만, 다시 확인 중과 물을 곳 답은 세지 않는다', () => {
  const unknown = { found: false, cites: [], answer: '자료에 없어요.', kind: 'stuck' };
  assert.equal(settle(unknown).answer.kind, 'none');
  const prior = [ai({ found: false, text: '자료에 없어요.' })];
  assert.equal(unknownCount(prior), 1);
  assert.equal(settle(unknown, { history: prior }).answer.kind, 'stuck');
  assert.equal(settle(unknown, { history: [ai({ found: false, rechecking: true })] }).answer.kind, 'none');
  assert.equal(settle(unknown, { history: [ai({ type: 'refer', found: false, ask_where: 'prog-jbnu-ug' })] }).answer.kind, 'none');
  assert.equal(settle({ ...unknown, rechecking: true }, { history: prior }).answer.kind, 'none');
});

test('모델 출력 꼴과 검사 부르기 출력', () => {
  assert.throws(() => checkAskOutput({ ...out(), extra: 1 }), { code: 'ASK_BAD_OUTPUT' });
  assert.throws(() => checkAskOutput(out({ answer: '   ' })), { code: 'ASK_BAD_OUTPUT' });
  assert.deepEqual(checkVetOutput({ allowed: true, reason: 'none' }), { allowed: true, reason: 'none' });
  assert.deepEqual(checkVetOutput({ allowed: true, reason: 'promise' }), { allowed: false, reason: 'promise' });
  assert.throws(() => checkVetOutput({ allowed: 'yes', reason: 'none' }), { code: 'ASK_BAD_VET' });
});

test('답 서명 문자열은 칸이 하나만 달라도 달라진다', () => {
  const a = answerSigPayload(SUB, ai());
  assert.notEqual(a, answerSigPayload(SUB, ai({ found: false })));
  assert.notEqual(a, answerSigPayload(SUB, ai({ text: '전북대 학부는 TOPIK 4급이 필요해요.' })));
  assert.notEqual(a, answerSigPayload('other', ai()));
});

const body = (o = {}) => ({ situation: '몽골 고3, 전북대 학부 2027년 3월 입학 희망.', wants: '원서를 함께 준비해 주세요.', ai_done: [{ text: 'TOPIK 3급 조건 안내', cites: ['prog-jbnu-ug', 'x'] }], open: ['추천서를 누구에게 받을지'], tasks: [{ do: '원서 서류 목록 같이 점검', why: '학생이 실제로 지원을 진행한다', by: '2027-01-15' }], ...o });

test('넘김 요약: 할 일 날짜는 근거 날짜만, 두 벌 날짜가 다르면 둘 다 비우고, 까닭 없는 할 일은 거절', () => {
  const r = checkBriefOutput({ kind: 'act', student: body(), ko: body() }, { allowedDates: ['2027-01-15'], index });
  assert.equal(r.ko.tasks[0].by, '2027-01-15');
  assert.deepEqual(r.ko.ai_done[0].cites, ['prog-jbnu-ug']);
  assert.equal(r.deadline, '2027-01-15');
  const made = checkBriefOutput({ kind: 'act', student: body(), ko: body({ tasks: [{ do: '점검', why: '진행', by: '2027-02-30' }] }) }, { allowedDates: ['2027-01-15'], index });
  assert.equal(made.ko.tasks[0].by, null);
  assert.equal(made.student.tasks[0].by, null);
  assert.throws(() => checkBriefOutput({ kind: 'act', student: body(), ko: body({ tasks: [{ do: '점검', why: ' ', by: null }] }) }, { allowedDates: [], index }), { code: 'BRIEF_NO_WHY' });
  assert.throws(() => checkBriefOutput({ kind: 'urgent', student: body(), ko: body() }, { allowedDates: [], index }), { code: 'BRIEF_BAD_OUTPUT' });
  assert.equal(checkBriefOutput({ kind: 'act', student: body(), ko: body() }, { allowedDates: [], index }).deadline, null);
});

test('넘김 요약 요청: AI가 그 갈래로 연결을 권한 답이 있어야 한다', () => {
  const req = (kind, history) => ({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, kind, history });
  assert.equal(validateBriefRequest(req('act', [{ role: 'student', text: '같이 준비해 주세요' }, ai({ kind: 'act' })])).kind, 'act');
  assert.throws(() => validateBriefRequest(req('act', [{ role: 'student', text: '같이 준비해 주세요' }])), { code: 'BRIEF_NOT_OFFERED' });
  assert.throws(() => validateBriefRequest(req('act', [ai({ kind: 'none' })])), { code: 'BRIEF_NOT_OFFERED' });
  assert.throws(() => validateBriefRequest(req('synk', [ai({ kind: 'act' })])), { code: 'BRIEF_NOT_OFFERED' });
  assert.throws(() => validateBriefRequest(req('urgent', [ai({ kind: 'urgent' })])), { code: 'BRIEF_BAD_REQUEST' });
});

test('답 서명 문자열은 사람 연결 갈래가 바뀌어도 달라진다', () => {
  assert.notEqual(answerSigPayload(SUB, ai({ kind: 'none' })), answerSigPayload(SUB, ai({ kind: 'act' })));
});

test('근거 없는 답(되묻기 · 못 찾음)은 질문 · 조건 · 대화에 없는 숫자를 말하지 못한다', () => {
  assert.equal(settle({ type: 'clarify', cites: [], answer: '2027년 3월 입학을 생각하세요?' }).blocked, 'stray_number');
  assert.equal(settle({ type: 'clarify', cites: [], answer: '2027년 3월 입학을 생각하세요?' }, { question: '2027년 3월에 가고 싶어요' }).blocked, null);
  assert.equal(settle({ found: false, cites: [], answer: '자료에 없어요. 전에 말한 5급 조건도 확인해 볼게요.' }, { history: [{ role: 'student', text: '저는 5급이에요' }] }).blocked, null);
});

test('고친 줄 옮기기: 요청 꼴과 옮긴 줄의 숫자를 본다', () => {
  const r = validateBriefEditRequest({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: '2027 оны 1-р сарын 15 хүртэл бэлдэх' }] });
  assert.equal(r.edits[0].text_ko, null);
  assert.equal(checkBriefEditOutput({ texts: ['2027년 1월 15일까지 준비'] }, r.edits)[0].text_ko, '2027년 1월 15일까지 준비');
  assert.throws(() => checkBriefEditOutput({ texts: ['2027년 2월 15일까지 준비'] }, r.edits), { code: 'BRIEF_NUMBERS_CHANGED' });
  // 달과 날을 바꾼 번역(3월 7일 → 7월 3일)은 숫자가 같아도 거절한다.
  const swap = validateBriefEditRequest({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: '2027 оны 3-р сарын 7 хүртэл' }] });
  assert.throws(() => checkBriefEditOutput({ texts: ['2027년 7월 3일까지'] }, swap.edits), { code: 'BRIEF_NUMBERS_CHANGED' });
  assert.equal(checkBriefEditOutput({ texts: ['2027년 3월 7일까지'] }, swap.edits)[0].text_ko, '2027년 3월 7일까지');
  // 해가 빠진 날짜도 달 · 날로 맞댄다. 두 날짜 가운데 하나만 해를 적어도 같은 날이면 받는다.
  const noYear = validateBriefEditRequest({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: '3-р сарын 7 хүртэл' }] });
  assert.throws(() => checkBriefEditOutput({ texts: ['7월 3일까지'] }, noYear.edits), { code: 'BRIEF_NUMBERS_CHANGED' });
  const two = validateBriefEditRequest({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: '2027 оны 3-р сарын 7 болон 2027 оны 7-р сарын 3' }] });
  assert.equal(checkBriefEditOutput({ texts: ['2027년 3월 7일과 7월 3일'] }, two.edits).length, 1);
  const en = validateBriefEditRequest({ request_id: UUID, lang: 'en', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: 'by March 7, 2027' }] });
  assert.throws(() => checkBriefEditOutput({ texts: ['2027년 7월 3일까지'] }, en.edits), { code: 'BRIEF_NUMBERS_CHANGED' });
  // 영어 달 이름은 맞게 옮기면 받는다(달 숫자가 한쪽에만 있어도).
  assert.equal(checkBriefEditOutput({ texts: ['2027년 3월 7일까지'] }, en.edits)[0].text_ko, '2027년 3월 7일까지');
  const en2 = validateBriefEditRequest({ request_id: UUID, lang: 'en', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: 'by March 7' }] });
  assert.equal(checkBriefEditOutput({ texts: ['3월 7일까지'] }, en2.edits).length, 1);
  assert.throws(() => checkBriefEditOutput({ texts: [] }, r.edits), { code: 'BRIEF_BAD_OUTPUT' });
  assert.throws(() => validateBriefEditRequest({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [] }), { code: 'BRIEF_BAD_REQUEST' });
  assert.throws(() => validateBriefEditRequest({ request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, edits: [{ field: 'task', index: 0, text: 'x', text_ko: '가짜' }] }), { code: 'BRIEF_BAD_REQUEST' });
});

test('서버 답: 급함 차례는 safety · urgent여야 하고, 한도는 다시 열리는 때를 준다', () => {
  assert.equal(validateAskReply({ status: 'urgent', turn: ai({ type: 'safety', kind: 'urgent', found: false }) }).status, 'urgent');
  assert.throws(() => validateAskReply({ status: 'urgent', turn: ai() }), { code: 'ASK_BAD_REPLY' });
  assert.equal(validateAskReply({ status: 'done', turn: ai({ kind: 'act' }), cites: ['prog-jbnu-ug'], kind: 'act' }).status, 'done');
  assert.throws(() => validateAskReply({ status: 'done', turn: ai({ kind: 'act' }), cites: [], kind: 'none' }), { code: 'ASK_BAD_REPLY' });
  assert.throws(() => validateAskReply({ status: 'limit' }), { code: 'ASK_BAD_REPLY' });
  assert.equal(validateAskReply({ status: 'limit', reopens_at: 1764288000000 }).status, 'limit');
});

test('학생 고침: 상황 · 바라는 것은 새 줄을 못 만들고, 번호는 가린다', () => {
  assert.deepEqual(checkEdits([{ field: 'task', index: null, text: '여권 E1234567 확인', text_ko: null }])[0].text, `여권 ${MASK_TOKEN} 확인`);
  assert.throws(() => checkEdits([{ field: 'wants', index: 0, text: 'x', text_ko: null }]), { code: 'CASE_BAD_EDITS' });
  assert.throws(() => checkEdits([{ field: 'ai_done', index: 0, text: 'x', text_ko: null }]), { code: 'CASE_BAD_EDITS' });
});

test('증표: 꼴 · 만료를 보고, 정해진 문자열은 칸마다 다르다', () => {
  const now = 1764200000000;
  const t = { sub: SUB, kind: 'act', exp: now + 5 * 60000, nonce: UUID, brief_hash: 'a'.repeat(64), sig: SIG };
  assert.equal(checkTicket(t, now).kind, 'act');
  assert.throws(() => checkTicket({ ...t, exp: now - 1 }, now), { code: 'CASE_TICKET_EXPIRED' });
  assert.throws(() => checkTicket({ ...t, exp: now + 60 * 60000 }, now), { code: 'CASE_TICKET_EXPIRED' });
  assert.throws(() => checkTicket({ ...t, kind: 'urgent' }, now), { code: 'CASE_BAD_TICKET' });
  assert.notEqual(ticketPayload(t), ticketPayload({ ...t, kind: 'synk' }));
});

test('건 만들기: 넘김 · 급함 · 14~17세 셋만 받고, 다시 다듬어도 해시 입력이 같다', () => {
  const now = 1764200000000;
  const brief = checkBriefOutput({ kind: 'act', student: body(), ko: body() }, { allowedDates: ['2027-01-15'], index });
  const req = { mode: 'handoff', request_id: UUID, lang: 'mn', consent: CASE_CONSENT_VERSION,
    ticket: { sub: SUB, kind: 'act', exp: now + 60000, nonce: UUID, brief_hash: 'b'.repeat(64), sig: SIG },
    brief_ko: brief.ko, brief_student: brief.student, deadline: brief.deadline, edits: [], note: null, conversation: [{ role: 'student', text: '같이 해 주세요' }] };
  const r = validateCaseRequest(req, now);
  assert.equal(r.kind, 'act');
  assert.equal(briefHashInput(r.brief_ko, r.deadline), briefHashInput(brief.ko, brief.deadline));
  // 기한은 증표가 묶는다: 같은 요약이라도 기한이 다르면 해시 입력이 다르다.
  assert.notEqual(briefHashInput(brief.ko, '2027-01-13'), briefHashInput(brief.ko, '2027-01-14'));
  assert.equal(validateCaseRequest({ mode: 'urgent', request_id: UUID, lang: 'ko', consent: CASE_CONSENT_VERSION, age: 'teen', guardian: true, last: '맞고 있어요' }, now).kind, 'urgent');
  // 14~17세 급함은 보호자 확인이 있어야 받는다.
  assert.throws(() => validateCaseRequest({ mode: 'urgent', request_id: UUID, lang: 'ko', consent: CASE_CONSENT_VERSION, age: 'teen', guardian: false, last: null }, now), { code: 'CASE_BAD_REQUEST' });
  assert.throws(() => validateCaseRequest({ mode: 'urgent', request_id: UUID, lang: 'ko', consent: CASE_CONSENT_VERSION, age: 'adult', last: null }, now), { code: 'CASE_BAD_REQUEST' });
  assert.equal(validateCaseRequest({ mode: 'teen', request_id: UUID, lang: 'mn', consent: CASE_CONSENT_VERSION, age: 'teen', guardian: true, kind: 'act', note: '전북대 지원' }, now).kind, 'act');
  assert.throws(() => validateCaseRequest({ mode: 'teen', request_id: UUID, lang: 'mn', consent: CASE_CONSENT_VERSION, age: 'teen', guardian: false, kind: 'act', note: 'x' }, now), { code: 'CASE_BAD_REQUEST' });
  assert.throws(() => validateCaseRequest({ mode: 'teen', request_id: UUID, lang: 'mn', consent: CASE_CONSENT_VERSION, age: 'teen', guardian: true, kind: 'urgent', note: 'x' }, now), { code: 'CASE_BAD_REQUEST' });
  assert.throws(() => validateCaseRequest({ ...req, mode: 'other' }, now), { code: 'CASE_BAD_REQUEST' });
});

test('글 다듬기는 두 번 해도 같다', () => {
  const s = '  안녕​하세요\r\n\r\n\r\n\r\n둘째 줄   ';
  assert.equal(cleanText(cleanText(s)), cleanText(s));
  assert.equal(cleanText(s), '안녕하세요\n\n둘째 줄');
});

test('위험 낱말은 일상 말(도와주세요 · 계정 잠김)에는 반응하지 않는다', () => {
  for (const t of ['Please help me with it', 'Миний бүртгэл түгжигдсэн байна', 'Надад туслаач', 'Tuslaach', 'Санхүүгийн дарамт их байна']) assert.equal(looksUrgent(t), false, t);
  for (const t of ['They locked me in the room', 'Бэлгийн дарамт амссан']) assert.equal(looksUrgent(t), true, t);
});

test('숫자 대조는 여덟 개 넘는 근거와 못 찾은 답이 단 근거도 본다', () => {
  const many = new Map(index);
  const ids = [];
  for (let i = 0; i < 10; i++) { const id = 'doc-x-' + i; ids.push(id); many.set(id, { id, kind: 'doc', lines: { ko: [`서류 ${i + 2}0부`], en: [] }, dates: [], ask: null }); }
  const r = settleAnswer(checkAskOutput(out({ answer: '마지막 서류는 110부예요.', cites: ids })), { index: many, history: [], question: '서류?' });
  assert.equal(r.blocked, null);
  assert.equal(r.answer.cites.length, 8);
  const nf = settleAnswer(checkAskOutput(out({ found: false, cites: ['rule-d2-local'], answer: '생활비 자료는 없지만 재정 증명은 1,600만 원이에요.' })), { index, history: [], question: '생활비?' });
  assert.equal(nf.blocked, null);
});

test('가리기: 소문자 여권번호와 차세대 한국 여권(M123A4567)도 가린다', () => {
  for (const t of ['여권은 ab1234567이에요', 'passport m123a4567', '여권 M123A4567']) assert.ok(hasIdNumber(t), t);
  assert.equal(hasIdNumber('TOPIK 3급, 2027년 3월'), false);
});

test('글 다듬기는 두 번 해도 같다(빈칸만 있는 줄 사이)', () => {
  const once = cleanText('첫 줄\n  \n \n\n둘째 줄');
  assert.equal(cleanText(once), once);
});

test('위험 낱말: 직접적인 영어 위기 표현', () => {
  for (const t of ['I want to die.', 'I don\'t want to live anymore', 'My partner hit me last night.']) assert.equal(looksUrgent(t), true, t);
});

test('위험 낱말 관문 잣대: 언어마다 직접 알리는 문장은 잡고, 흔한 일상 말은 잡지 않는다', () => {
  for (const t of ['남자친구가 저를 때렸어요', '맞아서 병원에 갔어요', '죽고 싶어요', '살려주세요', 'He said he will kill me', 'I was raped', 'Намайг зодлоо', 'намайг ална гэсэн', 'Амиа хорломоор байна']) assert.equal(looksUrgent(t), true, t);
  for (const t of ['경험을 살려서 지원하고 싶어요', '예방주사 맞았어요', 'I like grape juice', 'Please help me with the form', 'Санхүүгийн дарамт их байна']) assert.equal(looksUrgent(t), false, t);
});

test('금액: 「82만 500원」은 한 수로 읽어 「82만 원」을 근거로 치지 않는다', () => {
  assert.deepEqual(strayNumbers('장학금은 82만 원이에요.', ['장학금 820,500원(82만 500원)']), ['820000']);
  assert.deepEqual(strayNumbers('장학금은 820,500원이에요.', ['장학금 820,500원(82만 500원)']), []);
  // 소수점 억과 만이 함께 오면 한 수로 읽는다(1.2억 3000만 = 1억 5,000만).
  assert.deepEqual(strayNumbers('1억 5000만 원이에요.', ['예치금 1.2억 3000만 원']), []);
  assert.deepEqual(strayNumbers('2억 3000만 원이에요.', ['예치금 1.2억 3000만 원']), ['230000000']);
});

test('넘김 요약 요청: 학생 글에 가리지 않은 번호가 있으면 받지 않는다', () => {
  const req = { request_id: UUID, lang: 'mn', age: 'adult', consent: ASK_CONSENT_VERSION, kind: 'act', history: [{ role: 'student', text: '여권은 E1234567이에요' }, ai({ kind: 'act' })] };
  assert.throws(() => validateBriefRequest(req), { code: 'BRIEF_BAD_REQUEST' });
});

test('서버 답: 전체가 쉬는 paused도 다시 여는 때를 준다', () => {
  assert.equal(validateAskReply({ status: 'paused', reopens_at: 1764288000000 }).status, 'paused');
  assert.throws(() => validateAskReply({ status: 'paused' }), { code: 'ASK_BAD_REPLY' });
});
