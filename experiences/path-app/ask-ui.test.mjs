// PATH 물어보기 · 사람 연결 · 내 상담의 앱 쪽 흐름(ask-flow.mjs)과 화면(ask-ui.mjs) 시험. 모델 · 서버 없이 돈다. 대화 자료는 지어낸 것이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAskStore, askBody, askHistory, askOutcome, askProfile, briefBody, briefOutcome, briefExpired, briefDraft, briefEdits, editsProblem, briefEditBody, editsWithKo,
  handoffCase, urgentCase, teenCase, caseConversation, readCases, screenTarget, maskedQuestion, ASK_STORE_KEY, BRIEF_FRESH_MS, WORKSPACE_ORIGIN
} from './ask-flow.mjs';
import { renderAsk, renderBrief, renderCases, renderUrgentCard, cardLang, M, ASK_MN_REVIEWED } from './ask-ui.mjs';
import { CONTACTS, URGENT_TEXT } from './emergency.mjs';
import { ASK_STATUSES, ASK_CONSENT_VERSION, CASE_CONSENT_VERSION, MAX_EDITS, TICKET_TTL_MS } from './ask-shape.mjs';
import { allAskSources, askSourceIndex } from './ask-sources.mjs';
import { pathContentSecurityPolicy } from '../../tools/prepare-path-app-public.mjs';
import { createProductAccount } from '../synk-account/src/product-account.mjs';

const SIG = 'B'.repeat(43);
const UUID = '6f1c3a52-9d1e-4c4b-8a77-2f0d1b3c4e5f';
const SUB = '0b8f5c2e-1a3d-4e6f-9b7c-5d4e3f2a1b0c';
const turn = (o = {}) => ({ role: 'ai', text: '이 과정은 TOPIK 3급이 필요해요.', sig: SIG, at: 1764200000000, type: 'fact', found: true, ask_where: null, rechecking: false, kind: 'none', ...o });
const aiEntry = (o = {}) => { const t = turn(o); return { role: 'ai', turn: t, cites: [], kind: t.kind }; };
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m }; };
const SOURCES = askSourceIndex(allAskSources());
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const base = (o = {}) => ({ lang: 'ko', signedIn: true, off: false, open: true, ask: { age: 'adult', consent: true, agree: false, withProfile: true, turns: [], lang: 'ko', text: '', phase: 'idle', notice: null, error: null, remaining: null }, urgent: { open: false }, teen: { kind: null, note: '', guardian: false, agree: false, phase: 'edit' }, askLang: 'ko', lastStudent: '', topicName: null, profileFields: [], sources: SOURCES, canOpen: () => true, officialHtml: '<section id="official-list"></section>', ...o });
const ticket = (o = {}) => ({ sub: SUB, kind: 'act', exp: 1764200600000, nonce: UUID, brief_hash: 'c'.repeat(64), sig: SIG, ...o });
const body = (o = {}) => ({ situation: '몽골에서 고등학교를 마쳤고 내년 3월 학부 입학을 준비해요.', wants: '원서를 함께 준비하고 싶어요.', ai_done: [{ text: '한국어 조건을 안내했어요.', cites: [] }], open: ['추천서를 누가 써야 하는지'], tasks: [{ do: '지원 원서를 함께 확인하기', why: '학생이 실제로 지원하려 해요.', by: null }], ...o });
const briefReply = (o = {}) => ({ status: 'done', brief: { kind: 'act', student: body(), ko: body(), deadline: null }, ticket: ticket(), ...o });

test('고정 카드: 로그인 · 동의 · 나이 · 스위치 없이도 입구가 맨 위에 있고, 열면 번호와 고정 문안을 보인다', () => {
  for (const view of [base({ signedIn: false, ask: { age: null, consent: false, turns: [] } }), base({ off: true, open: null }), base({ ask: { age: 'under14', turns: [] } }), base({ ask: { age: 'adult', consent: false, turns: [] } })]) {
    const shut = renderAsk(view);
    assert.match(shut, /data-action="askUrgent"/, '입구는 늘 있다');
    assert.ok(shut.indexOf('askUrgent') < shut.indexOf('</header>') + 400, '입구는 제목 바로 아래, 다른 갈래보다 먼저');
    const open = renderAsk({ ...view, urgent: { open: true } });
    for (const c of CONTACTS) assert.match(open, new RegExp(`href="tel:${c.number}"`));
    assert.ok(open.includes(URGENT_TEXT.ko));
  }
  // 로그인 전 · 14세 미만 · 스위치 꺼짐에는 연결 단추 대신 hello@synk.im
  for (const view of [base({ signedIn: false, urgent: { open: true } }), base({ ask: { age: 'under14', turns: [] }, urgent: { open: true } }), base({ open: false, urgent: { open: true } })]) {
    const html = renderAsk(view);
    assert.doesNotMatch(html, /data-action="urgentSend"/);
    assert.match(html, /mailto:hello@synk\.im/);
  }
  // 18세 이상 · 14~17세는 짧은 동의 뒤 연결. 14~17세는 보호자 확인도 있어야 누를 수 있다.
  const adult = renderAsk(base({ urgent: { open: true, agree: true } }));
  assert.match(adult, /data-action="urgentSend"(?![^>]*disabled)/);
  const teenNo = renderAsk(base({ ask: { age: 'teen', turns: [] }, urgent: { open: true, agree: true, guardian: false } }));
  assert.match(teenNo, /data-action="urgentSend"[^>]*disabled/);
  const teenOk = renderAsk(base({ ask: { age: 'teen', turns: [] }, urgent: { open: true, agree: true, guardian: true } }));
  assert.match(teenOk, /data-action="urgentSend"(?![^>]*disabled)/);
  // 몽골어로 물어도 검수 전에는 카드 글이 영어다.
  assert.equal(cardLang('mn'), 'en');
  assert.ok(renderUrgentCard(base({ askLang: 'mn', urgent: { open: true } })).includes(URGENT_TEXT.en));
});

test('급함 고정 꼴: 18세 이상 · 14~17세만, 고른 경우 마지막 글 한 개를 가려서', () => {
  assert.throws(() => urgentCase({ requestId: UUID, lang: 'ko', age: 'teen', last: null }), '14~17세는 보호자 확인이 있어야 한다');
  const b = urgentCase({ requestId: UUID, lang: 'ko', age: 'teen', guardian: true, last: '여권 AB1234567 을 뺏겼어요' });
  assert.equal(b.mode, 'urgent'); assert.equal(b.consent, CASE_CONSENT_VERSION);
  assert.doesNotMatch(b.last, /AB1234567/);
  assert.equal(urgentCase({ requestId: UUID, lang: 'en', age: 'adult' }).last, null);
  assert.throws(() => urgentCase({ requestId: UUID, lang: 'ko', age: 'child' }));
});

test('나이 갈래: 14세 미만은 안내만, 14~17세는 공식 입구와 보호자 동의 양식, 18세 이상은 동의 뒤 대화', () => {
  const none = renderAsk(base({ ask: { age: null, turns: [] } }));
  assert.match(none, /data-action="askAge"/); assert.doesNotMatch(none, /id="ask-text"/);
  const kid = renderAsk(base({ ask: { age: 'under14', turns: [] } }));
  assert.match(strip(kid), /보호자가 hello@synk\.im ?으로 물어봐 주세요/);
  assert.doesNotMatch(kid, /id="ask-text"|data-action="teenSend"/);
  const teen = renderAsk(base({ ask: { age: 'teen', turns: [] } }));
  assert.doesNotMatch(teen, /id="ask-text"/);
  assert.match(teen, /id="official-list"/); assert.match(teen, /data-action="teenKind"/); assert.match(teen, /id="teen-guardian"/);
  assert.match(teen, /data-action="teenSend"[^>]*disabled/, '보호자 확인 · 동의 · 글이 있어야 보낸다');
  const teenReady = renderAsk(base({ ask: { age: 'teen', turns: [] }, teen: { kind: 'synk', note: '계정을 지우고 싶어요', guardian: true, agree: true, phase: 'edit' } }));
  assert.match(teenReady, /data-action="teenSend"(?![^>]*disabled)/);
  const tb = teenCase({ requestId: UUID, lang: 'mn', kind: 'act', note: '전북대에 지원하고 싶어요' });
  assert.deepEqual([tb.mode, tb.age, tb.guardian, tb.kind], ['teen', 'teen', true, 'act']);
  const consent = renderAsk(base({ ask: { age: 'adult', consent: false, agree: false, turns: [] } }));
  assert.match(consent, /data-action="askStart"[^>]*disabled/); assert.doesNotMatch(consent, /id="ask-text"/);
  for (const s of ['Anthropic(미국)', '저장하지 않아요', '여권번호', 'KVAC의 확인이 아니에요']) assert.ok(strip(consent).includes(s), s);
  assert.match(renderAsk(base()), /id="ask-text"/);
  // 요청 몸도 18세 이상 · 동의 판만 지을 수 있다(서버와 같은 검사).
  assert.equal(askBody({ requestId: UUID, lang: 'ko', question: '조건이 뭐예요?', entries: [] }).consent, ASK_CONSENT_VERSION);
});

test('가리기: 보내는 질문과 탭에 두는 글은 가린 글뿐이고, 가리지 않은 학생 글은 저장소가 받지 않는다', () => {
  const b = askBody({ requestId: UUID, lang: 'ko', question: '제 여권 AB1234567, 등록번호 990101-1234567 이에요', entries: [] });
  assert.doesNotMatch(b.question, /AB1234567|990101/);
  assert.equal(b.action, 'ask');
  const mem = memory(), store = createAskStore(mem);
  store.save(SUB, { age: 'adult', consent: true, lang: 'ko', withProfile: true, turns: [{ role: 'student', text: b.question }, aiEntry(), { role: 'student', text: '여권 AB1234567' }] });
  const raw = mem.raw.get(ASK_STORE_KEY);
  assert.doesNotMatch(raw, /AB1234567|990101/);
  assert.equal(store.load(SUB).turns.length, 2);
  // 다른 계정이 읽으면 지운다.
  assert.equal(store.load('other-account'), null);
  assert.equal(mem.raw.has(ASK_STORE_KEY), false);
  // 화면의 학생 말풍선은 가린 자리를 사람 말로 보인다.
  const html = renderAsk(base({ ask: { ...base().ask, turns: [{ role: 'student', text: maskedQuestion('여권 AB1234567') }] } }));
  assert.ok(html.includes('[가린 번호]')); assert.doesNotMatch(html, /AB1234567/);
});

test('서명 그대로: 다음 요청의 대화에 서버가 준 AI 차례를 한 글자도 바꾸지 않고 싣는다. 서명 꼴 v1(kind 없음)의 대화는 비운다', () => {
  const t = turn({ kind: 'act', type: 'clarify', found: false });
  const entries = [{ role: 'student', text: '내년 3월에 지원하려 해요' }, { role: 'ai', turn: t, cites: [], kind: 'act' }];
  const b = askBody({ requestId: UUID, lang: 'ko', question: '같이 해 주세요', entries });
  assert.deepEqual(b.history[1], t);
  assert.equal(b.history[1].sig, SIG);
  const bb = briefBody({ requestId: UUID, lang: 'ko', kind: 'act', entries });
  assert.deepEqual(bb.history[1], t);
  assert.throws(() => briefBody({ requestId: UUID, lang: 'ko', kind: 'synk', entries }), { code: 'BRIEF_NOT_OFFERED' });
  const mem = memory(), old = { ...turn() }; delete old.kind;
  mem.setItem(ASK_STORE_KEY, JSON.stringify({ owner: SUB, age: 'adult', consent: 1, lang: 'ko', withProfile: true, turns: [{ role: 'student', text: '질문' }, { role: 'ai', turn: old, cites: [], kind: 'none' }] }));
  const rec = createAskStore(mem).load(SUB);
  assert.deepEqual(rec.turns, []); assert.equal(rec.age, 'adult');
  // 대화는 최근 8차례 · 6,000자까지
  const many = Array.from({ length: 30 }, (_, i) => (i % 2 ? aiEntry() : { role: 'student', text: '질문 ' + i }));
  assert.equal(askHistory(many).length, 16);
});

test('상태별 안내: 여섯 상태와 실패마다 학생 말 안내가 있고, 급함 · 위험 낱말은 고정 카드를 연다', () => {
  for (const s of ASK_STATUSES.filter((x) => x !== 'done' && x !== 'urgent')) {
    const reply = s === 'limit' || s === 'paused' ? { status: s, reopens_at: 1764288000000 } : { status: s };
    const out = askOutcome(reply, null, '전북대 조건');
    assert.equal(out.notice, s); assert.equal(out.keep, false); assert.ok(M[s], s);
    const html = renderAsk(base({ ask: { ...base().ask, notice: s } }));
    assert.ok(html.includes(M[s][0]), s);
  }
  assert.equal(askOutcome({ status: 'unavailable' }, null, 'x').off, true);
  // 전체가 쉬는 날(paused)은 물어보기를 끄지 않고 대화 화면에 다시 여는 때를 보인다.
  const paused = askOutcome({ status: 'paused', reopens_at: 1764288000000 }, null, 'x');
  assert.equal(paused.off, false); assert.equal(paused.reopensAt, 1764288000000);
  assert.equal(askOutcome(null, Object.assign(new Error('x'), { code: 'NETWORK' }), 'x').notice, 'lost');
  assert.equal(askOutcome(null, Object.assign(new Error('x'), { code: 'NETWORK' }), '죽고 싶어요').openCard, true);
  assert.equal(askOutcome({ status: 'blocked', reason: 'x' }, null, 'I want to kill myself').openCard, true);
  const urgent = askOutcome({ status: 'urgent', turn: turn({ type: 'safety', kind: 'urgent', text: URGENT_TEXT.ko }) }, null, '도와주세요');
  assert.equal(urgent.openCard, true); assert.equal(urgent.keep, true); assert.equal(urgent.entry.kind, 'urgent');
  assert.equal(askOutcome({ status: 'urgent', turn: { bad: 1 } }, null, 'x').openCard, true, '꼴이 틀린 급함 답도 카드는 연다');
  const done = askOutcome({ status: 'done', turn: turn({ kind: 'act' }), cites: ['help-app-what'], kind: 'act', remaining: 7 }, null, 'x');
  assert.deepEqual([done.keep, done.entry.kind, done.remaining, done.entry.cites[0]], [true, 'act', 7, 'help-app-what']);
});

test('답 화면: 근거 링크 · 공식 출처 · 확인한 날 · 「AI의 안내」 표시, act · synk · stuck에만 「사람에게 연결」, 꺼지면 hello@synk.im', () => {
  const prog = allAskSources().find((it) => it.kind === 'program');
  const e = { role: 'ai', turn: turn({ kind: 'act' }), cites: [prog.id], kind: 'act' };
  const html = renderAsk(base({ ask: { ...base().ask, turns: [{ role: 'student', text: '질문' }, e] } }));
  assert.match(html, new RegExp(`data-action="askScreen" data-id="${prog.id}"`));
  assert.ok(html.includes(prog.source)); assert.ok(html.includes(prog.checked));
  assert.ok(html.includes('AI의 안내예요. 대학이나 KVAC의 확인이 아니에요.'));
  assert.match(html, /data-action="askHandoff" data-id="1"/);
  const none = renderAsk(base({ ask: { ...base().ask, turns: [{ role: 'student', text: '질문' }, { ...e, kind: 'none', turn: turn() }] } }));
  assert.doesNotMatch(none, /askHandoff/);
  const closed = renderAsk(base({ open: false, ask: { ...base().ask, turns: [{ role: 'student', text: '질문' }, e] } }));
  assert.doesNotMatch(closed, /data-action="askHandoff"/); assert.match(closed, /mailto:hello@synk\.im/);
  // 스위치가 꺼져 unavailable이면 물어보기 자리는 공식 안내 입구다.
  const off = renderAsk(base({ off: true }));
  assert.match(off, /id="official-list"/); assert.doesNotMatch(off, /id="ask-text"/);
});

test('근거의 화면 자리: ask-sources의 screen 꼴만 앱 동작으로 푼다', () => {
  assert.deepEqual(screenTarget('univDetail/jbnu-ug'), { page: 'univDetail', id: 'jbnu-ug' });
  assert.deepEqual(screenTarget('post/visa-funds-proof'), { page: 'post', id: 'visa-funds-proof' });
  assert.deepEqual(screenTarget('path/jbnu-ug'), { page: 'path', id: 'jbnu-ug' });
  assert.deepEqual(screenTarget('path'), { page: 'path', id: null });
  assert.deepEqual(screenTarget('profile'), { page: 'profile', id: null });
  for (const bad of ['profile/x', 'editor', 'univDetail', 'post/../x', 'a/b/c', null]) assert.equal(screenTarget(bad), null, String(bad));
  for (const it of allAskSources()) if (it.screen) assert.ok(screenTarget(it.screen), it.id);
});

test('넘김 요약: 꼴이 맞는 답만 받고, kind · deadline · ai_done은 판에 없어 고칠 수 없다. 고친 줄은 열 줄 · 300자까지', () => {
  const got = briefOutcome(briefReply(), null, 1000);
  assert.ok(got.brief); assert.equal(got.at, 1000);
  assert.equal(briefOutcome(briefReply({ ticket: ticket({ kind: 'synk' }) })).notice, 'lost');
  assert.equal(briefOutcome({ status: 'limit', reopens_at: 1 }).notice, 'limit');
  const s = got.brief.student, d = briefDraft(s);
  assert.deepEqual(Object.keys(d).sort(), ['open', 'situation', 'task', 'wants']);
  assert.deepEqual(briefEdits(s, d), []);
  d.wants.text = '원서와 추천서를 함께 준비하고 싶어요.'; d.open[0].removed = true; d.task.push({ index: null, text: '추천서 양식 확인', removed: false });
  const edits = briefEdits(s, d);
  assert.deepEqual(edits.map((e) => [e.field, e.index, e.text === '' ? '' : 'text']), [['wants', null, 'text'], ['open', 0, ''], ['task', null, 'text']]);
  assert.equal(editsProblem(Array.from({ length: MAX_EDITS + 1 }, () => ({ field: 'open', index: null, text: 'x' }))), 'tooMany');
  assert.equal(editsProblem([{ field: 'open', index: null, text: '가'.repeat(301) }]), 'tooLong');
  // 한국어면 옮기지 않고 그 글을 쓴다. 다른 말이면 brief_edit 답이 보낸 줄과 맞아야 한다.
  const ko = editsWithKo(edits, 'ko');
  assert.equal(ko[0].text_ko, ko[0].text); assert.equal(ko[1].text_ko, null);
  const eb = briefEditBody({ requestId: UUID, lang: 'mn', edits });
  assert.deepEqual([eb.action, eb.age, eb.consent, eb.edits.length], ['brief_edit', 'adult', ASK_CONSENT_VERSION, 2]);
  assert.throws(() => editsWithKo(edits, 'mn', { status: 'done', edits: [] }), { code: 'BRIEF_EDIT_REPLY' });
  const mn = editsWithKo(edits, 'mn', { status: 'done', edits: eb.edits.map((e) => ({ ...e, text_ko: '한국어 ' + e.field })) });
  assert.equal(mn[2].text_ko, '한국어 task');
  // Workspace 건: AI가 만든 두 벌은 그대로, 고친 줄은 따로
  const c = handoffCase({ requestId: UUID, lang: 'ko', got, edits: ko, note: '', conversation: null, profile: null, program: null });
  assert.deepEqual(c.brief_ko, got.brief.ko); assert.deepEqual(c.ticket, got.ticket); assert.equal(c.mode, 'handoff');
  assert.equal(Object.hasOwn(c, 'conversation'), false, '전체 대화는 켠 때만');
  const withConv = handoffCase({ requestId: UUID, lang: 'ko', got, edits: [], conversation: caseConversation([{ role: 'student', text: '질문' }, aiEntry()]) });
  assert.deepEqual(withConv.conversation.map((t) => t.role), ['student', 'ai']);
});

test('증표 만료: 받은 지 9분 30초가 지나면 보내기 대신 「요약 다시 받기」를 보인다', () => {
  const got = briefOutcome(briefReply(), null, 0);
  assert.equal(BRIEF_FRESH_MS, TICKET_TTL_MS - 30000);
  assert.equal(briefExpired(got, BRIEF_FRESH_MS - 1), false);
  assert.equal(briefExpired(got, BRIEF_FRESH_MS), true);
  const view = (now) => renderBrief({ lang: 'ko', open: true, now, brief: { phase: 'ready', got, draft: briefDraft(got.brief.student), with: {}, agree: true } });
  assert.match(view(1000), /data-action="briefSend"/);
  const late = view(BRIEF_FRESH_MS + 1);
  assert.doesNotMatch(late, /data-action="briefSend"/); assert.match(late, /data-action="askBriefRetry"/);
  assert.ok(late.includes(M.expired[0]));
  // 판에서 kind · deadline · ai_done은 글로만 보인다(고칠 칸이 없다).
  assert.doesNotMatch(view(1000), /data-id="ai_done"|data-id="kind"|data-id="deadline"/);
  assert.match(view(1000), /data-action="briefLine" data-id="situation"/);
});

test('내 상담: 상태 넷, 새 답 표시, 지우기 안내, 불러오지 못하면 카드에 그 말만', () => {
  const list = readCases({ ok: true, cases: [{ id: UUID, kind: 'act', status: 'answered', created_at: '2026-11-27T01:00:00Z', wants: '원서 준비', unread: 1,
    messages: [{ id: 'm1', from: 'student', text: '도와주세요', at: '2026-11-27T01:00:00Z' }, { id: 'm2', from: 'staff', text: '네, 같이 봐요', at: '2026-11-27T02:00:00Z' }] }, { id: 'bad', status: 'new', kind: 'act' }] });
  assert.equal(list.length, 1);
  const html = renderCases({ lang: 'ko', cases: { phase: 'ok', list, text: {} }, known: true });
  for (const s of ['답 왔음', '새 답이 있어요', 'SYNK 담당자', '이 상담 지우기', '내 길에 보이던 상담 표시도 사라져요']) assert.ok(strip(html).includes(s), s);
  assert.match(html, /data-action="caseRead"/); assert.match(html, /data-action="caseSend"/);
  for (const st of ['new', 'reviewing', 'answered', 'closed']) assert.ok(renderCases({ lang: 'en', cases: { phase: 'ok', list: [{ ...list[0], status: st }], text: {} } }).includes(M['st_' + st][1]));
  assert.doesNotMatch(renderCases({ lang: 'ko', cases: { phase: 'ok', list: [{ ...list[0], status: 'closed' }], text: {} } }), /caseSend/, '끝난 건에는 글을 더하지 않는다');
  const fail = renderCases({ lang: 'ko', cases: { phase: 'error', list: [] }, known: true });
  assert.ok(strip(fail).includes('지금 불러오지 못했어요.')); assert.match(fail, /data-action="casesLoad"/);
  assert.equal(renderCases({ lang: 'ko', cases: { phase: 'error', list: [] }, known: false }), '', '보낸 건을 모르는 학생에게는 카드를 띄우지 않는다');
  assert.equal(renderCases({ lang: 'ko', cases: { phase: 'ok', list: [] } }), '');
});

test('내 조건 사본: 값이 있는 칸만, 없으면 보내지 않는다', () => {
  assert.equal(askProfile({ topik: null, gradePct: null, fundsWon: null, education: null, target: null, docs: [] }), null);
  assert.deepEqual(askProfile({ topik: 3, gradePct: null, fundsWon: 16000000, education: 'graduated', target: 'jbnu-ug', docs: [{ id: 'passport', at: 'x' }] }),
    { topik: 3, fundsWon: 16000000, education: 'graduated', target: 'jbnu-ug', docs: ['passport'] });
});

test('CSP와 계정 엔진: Workspace 출처를 connect-src에 더하고, 계정 엔진은 정한 출처와 경로만 받는다', () => {
  const csp = pathContentSecurityPolicy({ supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test' });
  assert.match(csp, new RegExp(`connect-src 'self' https://auth\\.example\\.test https://api\\.example\\.test ${WORKSPACE_ORIGIN.replace(/\./g, '\\.')};`));
  assert.match(pathContentSecurityPolicy(null), /connect-src 'none'/);
  const opts = { clientKey: 'path-app', endpoint: 'synk-path', scope: 'synk-path', resource: 'path-app', validateState: (x) => x, operations: { load: 'pathLoad', save: 'pathSave', delete: 'pathDelete' }, storage: memory(), fetcher: async () => { throw new Error('no network'); }, getUrl: () => 'https://synk.im/path/app/', replaceUrl() {}, navigate() {} };
  assert.throws(() => createProductAccount({ ...opts, workspaceOrigin: 'http://workspace.synk.im' }), TypeError);
  assert.throws(() => createProductAccount({ ...opts, clientKey: 'care', endpoint: 'synk-care', scope: 'synk-care', resource: null, workspaceOrigin: WORKSPACE_ORIGIN }), TypeError);
  const acc = createProductAccount({ ...opts, workspaceOrigin: WORKSPACE_ORIGIN });
  return assert.rejects(acc.requestWorkspace('GET', '/api/path-student/cases'), { code: 'AUTH_REQUIRED' });
});

test('몽골어 줄: 검수 전에는 화면에 내지 않고, 모든 글에 세 말이 있다', () => {
  assert.equal(ASK_MN_REVIEWED, false);
  assert.doesNotMatch(renderAsk(base({ urgent: { open: true } })), /class="sx-mn"/);
  assert.match(renderAsk({ ...base(), mn: true }), /class="sx-mn" lang="mn"/);
  for (const [k, v] of Object.entries(M)) { assert.equal(v.length, 3, k); for (const x of v) assert.ok(typeof x === 'string' && x.trim(), k); }
});

test('검수 고침(11-27): 넘김 요약 · 고친 줄의 급함 답은 위험해요 카드로, 내 상담의 지울 날을 읽는다', () => {
  assert.deepEqual(briefOutcome({ status: 'urgent', turn: turn({ type: 'safety', kind: 'urgent' }) }, null), { urgent: true });
  assert.throws(() => editsWithKo([{ field: 'task', index: 0, text: 'I am in danger', text_ko: null }], 'en', { status: 'urgent' }), { code: 'BRIEF_URGENT' });
  const list = readCases({ cases: [{ id: UUID, kind: 'act', status: 'closed', created_at: '2026-08-01T00:00:00Z', wants: 'x', messages: [], unread: 0, delete_at: '2026-11-30T00:00:00Z', delete_soon: true }] });
  assert.equal(list[0].delete_soon, true); assert.equal(list[0].delete_at, '2026-11-30T00:00:00Z');
  assert.match(renderCases({ lang: 'ko', cases: { phase: 'ok', list, text: {} } }), /곧 저절로 지워져요/);
});

test('내 상담: 글은 모두 보이고(1,000개까지), 그보다 많으면 앞의 글 수를 알린다', () => {
  const [mid] = readCases({ ok: true, cases: [{ id: UUID, kind: 'act', status: 'answered', messages: Array.from({ length: 125 }, (_, i) => ({ id: 'm' + i, from: 'student', text: '글 ' + i, at: '2026-11-27T01:00:00Z' })) }] });
  assert.equal(mid.messages.length, 125); assert.equal(mid.earlier, 0);
  const messages = Array.from({ length: 1005 }, (_, i) => ({ id: 'm' + i, from: i % 2 ? 'staff' : 'student', text: '글 ' + i, at: '2026-11-27T01:00:00Z' }));
  const [c] = readCases({ ok: true, cases: [{ id: UUID, kind: 'act', status: 'answered', created_at: '2026-11-27T01:00:00Z', messages }] });
  assert.equal(c.messages.length, 1000); assert.equal(c.earlier, 5); assert.equal(c.messages[0].text, '글 5');
  assert.ok(strip(renderCases({ lang: 'ko', cases: { phase: 'ok', list: [c], text: {} }, known: true })).includes('앞의 글 5개는 여기 보이지 않아요. 담당자는 모두 봐요.'));
  const [few] = readCases({ ok: true, cases: [{ id: UUID, kind: 'act', status: 'answered', messages: messages.slice(0, 3) }] });
  assert.equal(few.earlier, 0);
  assert.doesNotMatch(renderCases({ lang: 'ko', cases: { phase: 'ok', list: [few], text: {} }, known: true }), /앞의 글/);
});
