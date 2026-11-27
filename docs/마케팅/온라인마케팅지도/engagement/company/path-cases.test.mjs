import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Store } from './store.mjs';
import { recordWorkspaceOwner } from './workspace-owner.mjs';
import { createPathCases, PATH_CASE_KINDS, PATH_CASE_LIMITS } from './path-cases.mjs';
import { ticketPayload, briefHashInput, CASE_CONSENT_VERSION } from '../../../../../experiences/path-app/ask-shape.mjs';

// 시험 자료는 모두 지어낸 것이다(실제 학생 대화 아님).
const KEY = 'synthetic-path-case-ticket-key-0123456789abcdef';
const LIVENESS_KEY = 'synthetic-account-liveness-key-0123456789abcdef';
const DAY = 86400000;
const brief = (o = {}) => ({ situation: '몽골에서 고등학교를 마쳤고 전북대 학부 2027년 3월 입학을 준비해요.', wants: '원서 서류를 함께 준비해 주세요.',
  ai_done: [{ text: '전북대 학부의 한국어 조건을 안내했어요.', cites: ['prog-jbnu-ug'] }], open: ['추천서를 누구에게 받을지 정하지 못했어요.'],
  tasks: [{ do: '원서 서류 목록을 학생과 함께 확인하기', why: '학생 사정에 맞춘 판단이 필요해요.', by: '2027-01-15' }, { do: '추천서 받을 사람 정하기', why: '사람이 학생과 이야기해야 해요.', by: null }], ...o });

function fixture(t, { env: extraEnv = {}, start = '2026-11-27T01:00:00.000Z', fetchImpl, translator = null } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'synk-path-cases-'));
  const store = new Store(directory);
  let stamp = Date.parse(start);
  const env = { PATH_CASES_ENABLED: 'true', PATH_CASE_TICKET_KEY: KEY, ...extraEnv };
  const urgentCalls = [], ownerAlerts = [], changes = [];
  const make = (name, role, memberships) => { const row = store.createUser({ name, email: name + '@path.example.test', role }); const next = { ...row, ...(memberships ? { workspaceProfile: { version: 1, memberships, duties: [], revision: 1 } } : {}) }; store.put('users', row.id, next); return next; };
  const users = {
    owner: make('주인', 'admin'), admin: make('다른관리자', 'admin'),
    counselor: make('상담1', 'member', [{ company: 'PATH', role: 'counselor' }]), counselor2: make('상담2', 'member', [{ company: 'PATH', role: 'counselor' }]),
    manager: make('책임자', 'manager', [{ company: 'PATH', role: 'manager' }]), operations: make('운영', 'member', [{ company: 'PATH', role: 'operations' }]),
    viewer: make('보기', 'viewer', [{ company: 'PATH', role: 'counselor' }]),
  };
  recordWorkspaceOwner(store, users.owner, { at: start, setBy: 'test' });
  const cases = createPathCases({ store, env, clock: () => new Date(stamp).toISOString(), fetchImpl, translator,
    onUrgent: (row, target) => urgentCalls.push({ id: row.id, target }), ownerAlert: text => ownerAlerts.push(text), onChange: ids => changes.push(ids) });
  t.after(() => { store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('synk-path-cases-')); rmSync(directory, { recursive: true, force: true }); });
  const student = (id = randomUUID()) => ({ synkUserId: id, subject: randomUUID(), name: '지어낸 학생' });
  function ticketFor(who, briefKo, o = {}) {
    const t = { sub: who.synkUserId, kind: 'act', exp: stamp + 9 * 60000, nonce: randomUUID(), brief_hash: createHash('sha256').update(briefHashInput(briefKo)).digest('hex'), ...o };
    return { ...t, sig: createHmac('sha256', KEY).update(ticketPayload(t)).digest('base64url') };
  }
  function handoff(who, o = {}) {
    const briefKo = o.brief_ko || brief(), ticket = o.ticket || ticketFor(who, briefKo, o.ticketFields || {});
    return { mode: 'handoff', request_id: o.request_id || randomUUID(), lang: o.lang || 'mn', consent: CASE_CONSENT_VERSION, ticket, brief_ko: o.sendBrief || briefKo,
      brief_student: brief({ situation: 'Монголд сургуулиа төгссөн.', wants: 'Бичиг баримтаа хамт бэлдээрэй.' }), deadline: '2027-01-15', edits: o.edits || [], note: null, ...(o.extra || {}) };
  }
  const urgent = (o = {}) => ({ mode: 'urgent', request_id: randomUUID(), lang: 'mn', consent: CASE_CONSENT_VERSION, age: 'adult', last: null, ...o });
  const teen = (o = {}) => ({ mode: 'teen', request_id: randomUUID(), lang: 'mn', consent: CASE_CONSENT_VERSION, age: 'teen', guardian: true, kind: 'act', note: 'Сургуульд орох талаар асуумаар байна.', ...o });
  return { store, cases, env, users, student, ticketFor, handoff, urgent, teen, urgentCalls, ownerAlerts, changes, advance: ms => { stamp += ms; }, now: () => stamp };
}
const code = c => error => error.code === c;

test('증표: 맞는 증표만 받고 위조 · 만료 · 재사용 · 계정 불일치 · 요약 해시 불일치 · 열쇠 없음은 거절한다', t => {
  const f = fixture(t), s = f.student();
  const forged = f.handoff(s); forged.ticket.sig = forged.ticket.sig.slice(0, -2) + (forged.ticket.sig.endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => f.cases.studentCreate(s, forged), code('CASE_TICKET_FORGED'));
  const otherKey = f.handoff(s); const t2 = { ...otherKey.ticket }; delete t2.sig; otherKey.ticket.sig = createHmac('sha256', 'another-key-that-is-long-enough-000000').update(ticketPayload(t2)).digest('base64url');
  assert.throws(() => f.cases.studentCreate(s, otherKey), code('CASE_TICKET_FORGED'));
  assert.throws(() => f.cases.studentCreate(s, f.handoff(s, { ticketFields: { exp: f.now() - 1000 } })), code('CASE_TICKET_EXPIRED'));
  assert.throws(() => f.cases.studentCreate(s, f.handoff(f.student())), code('CASE_TICKET_ACCOUNT'));
  const changed = f.handoff(s); changed.brief_ko = brief({ wants: '장학금을 꼭 받게 해 주세요.' });
  assert.throws(() => f.cases.studentCreate(s, changed), code('CASE_TICKET_BRIEF'));
  assert.equal(f.store.count(PATH_CASE_KINDS.cases), 0);
  const good = f.handoff(s), made = f.cases.studentCreate(s, good);
  assert.equal(made.status, 201); assert.equal(made.body.case.status, 'new'); assert.equal(made.body.case.kind, 'act');
  // 같은 증표를 다른 요청 번호로 다시 내면 nonce가 막는다.
  assert.throws(() => f.cases.studentCreate(s, { ...good, request_id: randomUUID() }), code('CASE_TICKET_USED'));
  // 로그인 주체(sub)로 서명한 증표도 같은 토큰의 것이면 받는다.
  const s2 = f.student(), bySubject = f.handoff(s2, { ticketFields: { sub: s2.subject } });
  assert.equal(f.cases.studentCreate(s2, bySubject).status, 201);
  delete f.env.PATH_CASE_TICKET_KEY;
  assert.throws(() => f.cases.studentCreate(f.student(), f.handoff(f.student())), error => error.status === 503 || error.code === 'CASE_TICKET_NOT_CONFIGURED');
});

test('권한: PATH 상담 담당 · 책임자 · 회사 주인만, 담당은 자기 건만. operations · 다른 관리자 · viewer는 거절', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  for (const name of ['operations', 'admin', 'viewer']) {
    assert.throws(() => f.cases.list(f.users[name]), error => error.status === 403, name);
    assert.throws(() => f.cases.detail(f.users[name], made.id), error => error.status === 403, name);
    assert.deepEqual(f.cases.today(f.users[name]), [], name);
  }
  // 기본 담당은 회사 주인.
  assert.equal(f.cases.list(f.users.owner).items[0].assigneeId, f.users.owner.id);
  assert.equal(f.cases.list(f.users.counselor).items.length, 0);
  assert.throws(() => f.cases.detail(f.users.counselor, made.id), error => error.status === 404);
  const rev = f.cases.list(f.users.manager).items[0].revision;
  assert.throws(() => f.cases.assign(f.users.counselor, made.id, { revision: rev, assigneeId: f.users.counselor.id }), error => error.status === 403);
  assert.throws(() => f.cases.assign(f.users.manager, made.id, { revision: rev, assigneeId: f.users.operations.id }), code('CASE_ASSIGNEE'));
  const assigned = f.cases.assign(f.users.manager, made.id, { revision: rev, assigneeId: f.users.counselor.id }).case;
  assert.equal(assigned.assigneeId, f.users.counselor.id);
  assert.equal(f.cases.list(f.users.counselor).items.length, 1);
  assert.equal(f.cases.list(f.users.counselor2).items.length, 0);
  assert.throws(() => f.cases.assign(f.users.counselor, made.id, { revision: assigned.revision, assigneeId: f.users.counselor2.id }), error => error.status === 403);
  // 담당이 열면 보는 중, 연 기록은 건 밖에 남는다.
  const opened = f.cases.detail(f.users.counselor, made.id).case;
  assert.equal(opened.status, 'reviewing');
  assert.equal(f.store.all(PATH_CASE_KINDS.views).filter(row => row.caseId === made.id && row.userId === f.users.counselor.id).length, 1);
  // 지우기는 회사 주인만.
  assert.throws(() => f.cases.eraseCheck(f.users.manager, made.id, { revision: opened.revision }), error => error.status === 403);
  // 담당자가 PATH 소속에서 빠지면 열린 건은 회사 주인에게.
  f.store.put('users', f.users.counselor.id, { ...f.store.get('users', f.users.counselor.id), workspaceProfile: { version: 1, memberships: [{ company: 'PATH', role: 'operations' }], duties: [], revision: 2 } });
  assert.equal(f.cases.list(f.users.owner).items[0].assigneeId, f.users.owner.id);
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, made.id).assigneeId, f.users.owner.id);
});

test('스위치가 꺼지면 새 건 · 새 글은 막고 읽기 · 지우기 · 정리는 된다. 허용 목록이 있으면 그 계정만 새 건', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  f.env.PATH_CASES_ENABLED = 'TRUE';
  assert.deepEqual(f.cases.status(), { open: false });
  assert.throws(() => f.cases.studentCreate(f.student(), f.urgent()), code('PATH_CASES_CLOSED'));
  assert.throws(() => f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: 'Сайн байна уу' }), code('PATH_CASES_CLOSED'));
  assert.equal(f.cases.studentList(s).cases.length, 1);
  assert.equal(f.cases.studentRead(s, made.id).case.id, made.id);
  f.cases.maintain();
  assert.deepEqual(f.cases.studentDelete(s, made.id), { ok: true, deleted: true, id: made.id });
  assert.equal(f.cases.studentList(s).cases.length, 0);
  assert.equal(f.store.get(PATH_CASE_KINDS.tombstones, made.id).reason, 'student');
  f.env.PATH_CASES_ENABLED = 'true';
  const allowed = f.student(); f.env.PATH_CASES_ALLOW = allowed.synkUserId + ', ' + randomUUID();
  assert.throws(() => f.cases.studentCreate(f.student(), f.urgent()), code('PATH_CASES_NOT_ALLOWED'));
  assert.equal(f.cases.studentCreate(allowed, f.urgent()).status, 201);
});

test('열린 건은 하나: 급함은 열린 건에 표시를 올리고 바로 알린다. 위험 낱말 글도 같다', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  assert.equal(f.urgentCalls.length, 0);
  assert.throws(() => f.cases.studentCreate(s, f.teen()), code('CASE_OPEN_EXISTS'));
  const merged = f.cases.studentCreate(s, f.urgent({ last: 'Намайг зодсон, айж байна.' }));
  assert.equal(merged.status, 200); assert.equal(merged.body.merged, true); assert.equal(merged.body.case.id, made.id); assert.equal(merged.body.case.urgent, true);
  assert.equal(f.store.count(PATH_CASE_KINDS.cases), 1);
  assert.deepEqual(f.urgentCalls, [{ id: made.id, target: f.users.owner.id }]);
  const alerts = f.cases.notifications(f.users.owner);
  assert.equal(alerts.length, 1); assert.equal(alerts[0].title, 'PATH 급함 상담'); assert.equal(alerts[0].text, ''); assert.match(alerts[0].href, new RegExp(made.id));
  assert.doesNotMatch(JSON.stringify(alerts), /зодсон|원서/);
  assert.deepEqual(f.cases.notifications(f.users.operations), []);
  // 목록 맨 위는 급함.
  const s2 = f.student(); f.cases.studentCreate(s2, f.handoff(s2, { brief_ko: brief({ tasks: [{ do: '서류 보기', why: '사람 판단', by: '2026-12-01' }] }) }));
  assert.equal(f.cases.list(f.users.owner).items[0].id, made.id);
  // 새 급함 건(열린 건 없음)과, 열린 건에 위험 낱말을 쓴 글.
  const s3 = f.student(), fresh = f.cases.studentCreate(s3, f.urgent()).body.case;
  assert.equal(fresh.kind, 'urgent'); assert.equal(fresh.urgent, true);
  const s4 = f.student(), calm = f.cases.studentCreate(s4, f.teen()).body.case;
  assert.equal(calm.urgent, false);
  f.cases.studentMessage(s4, calm.id, { request_id: randomUUID(), text: 'I am in danger, please help.' });
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, calm.id).urgent, true);
  assert.equal(f.urgentCalls.length, 3);
  // 상세를 열면 그 사람의 급함 알림은 읽음.
  f.cases.detail(f.users.owner, made.id);
  assert.equal(f.cases.notifications(f.users.owner).find(row => row.href.endsWith(made.id)).unread, false);
});

test('갈래별 주간 횟수: stuck은 한 사람 주 1번, 증표 없는 급함 · 14~17세는 하루 3번 · 주 5번', t => {
  const f = fixture(t), s = f.student();
  const close = id => { const rev = f.store.get(PATH_CASE_KINDS.cases, id).revision; f.cases.close(f.users.owner, id, { revision: rev }); };
  const first = f.cases.studentCreate(s, f.handoff(s, { ticketFields: { kind: 'stuck' } })).body.case;
  assert.equal(first.kind, 'stuck'); close(first.id);
  assert.throws(() => f.cases.studentCreate(s, f.handoff(s, { ticketFields: { kind: 'stuck' } })), code('CASE_LIMIT'));
  f.advance(7 * DAY + 1000);
  close(f.cases.studentCreate(s, f.handoff(s, { ticketFields: { kind: 'stuck' } })).body.case.id);
  const t2 = f.student();
  for (let i = 0; i < PATH_CASE_LIMITS.noTicketDaily; i++) close(f.cases.studentCreate(t2, f.urgent()).body.case.id);
  assert.throws(() => f.cases.studentCreate(t2, f.urgent()), code('CASE_LIMIT'));
  assert.throws(() => f.cases.studentCreate(t2, f.teen()), code('CASE_LIMIT'));
  f.advance(DAY + 1000);
  for (let i = 0; i < 2; i++) close(f.cases.studentCreate(t2, f.teen()).body.case.id);
  assert.throws(() => f.cases.studentCreate(t2, f.urgent()), code('CASE_LIMIT'), '주 5번');
});

test('중복: 같은 요청 번호의 건 · 글은 한 번만. 글 1,000자 · 건당 글 100개, 한도에서도 직원 답 하나와 끝내기는 된다', t => {
  const f = fixture(t), s = f.student(), body = f.handoff(s);
  const made = f.cases.studentCreate(s, body).body.case;
  const again = f.cases.studentCreate(s, body);
  assert.equal(again.body.duplicate, true); assert.equal(again.body.case.id, made.id); assert.equal(f.store.count(PATH_CASE_KINDS.cases), 1);
  const request = randomUUID();
  f.cases.studentMessage(s, made.id, { request_id: request, text: 'Баярлалаа, хүлээж байна.' });
  f.cases.studentMessage(s, made.id, { request_id: request, text: 'Баярлалаа, хүлээж байна.' });
  assert.equal(f.cases.studentList(s).cases[0].messages.length, 1);
  assert.throws(() => f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: 'ㄱ'.repeat(1001) }), code('CASE_BAD_MESSAGE'));
  assert.throws(() => f.cases.studentMessage(f.student(), made.id, { request_id: randomUUID(), text: '남의 건' }), error => error.status === 404);
  // 학생 글의 번호는 서버가 다시 가린다.
  f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: '여권 E1234567 입니다' });
  assert.doesNotMatch(JSON.stringify(f.cases.studentList(s)), /E1234567/);
  for (let i = 2; i < PATH_CASE_LIMITS.messages; i++) f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: '글 ' + i });
  assert.throws(() => f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: '하나 더' }), code('CASE_FULL'));
  let rev = f.store.get(PATH_CASE_KINDS.cases, made.id).revision;
  const replied = f.cases.reply(f.users.owner, made.id, { revision: rev, request_id: randomUUID(), text: '서류 목록을 보내 드릴게요.', textStudent: 'Бичиг баримтын жагсаалт илгээнэ.' }).case;
  assert.equal(replied.status, 'answered');
  assert.throws(() => f.cases.reply(f.users.owner, made.id, { revision: replied.revision, request_id: randomUUID(), text: '하나 더' }), code('CASE_FULL'));
  assert.equal(f.cases.close(f.users.owner, made.id, { revision: replied.revision }).case.status, 'closed');
  const view = f.cases.studentList(s).cases[0];
  assert.equal(view.messages.at(-1).text, 'Бичиг баримтын жагсаалт илгээнэ.'); assert.equal(view.unread, 1);
});

test('상태 전이: 새 상담 → 보는 중 → 답 보냄 → 학생 새 글이면 보는 중 → 끝남. 끝난 건에는 글을 받지 않는다', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  let c = f.cases.detail(f.users.owner, made.id).case; assert.equal(c.status, 'reviewing');
  c = f.cases.reply(f.users.owner, made.id, { revision: c.revision, request_id: randomUUID(), text: '확인했어요.' }).case; assert.equal(c.status, 'answered');
  f.cases.studentRead(s, made.id);
  assert.equal(f.cases.studentList(s).cases[0].unread, 0);
  f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: 'Асуулт байна.' });
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, made.id).status, 'reviewing');
  c = f.cases.detail(f.users.owner, made.id).case;
  assert.throws(() => f.cases.close(f.users.owner, made.id, { revision: c.revision - 1 }), code('CASE_REVISION'));
  c = f.cases.close(f.users.owner, made.id, { revision: c.revision }).case;
  assert.throws(() => f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: '더' }), code('CASE_CLOSED'));
  // 다시 연결하면 새 건.
  assert.equal(f.cases.studentCreate(s, f.handoff(s)).status, 201);
});

test('오늘 할 일: 할 일 글을 싣지 않고 「PATH 상담 할 일 · 기한 · 건 링크」만, 담당자에게만', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  const rows = f.cases.today(f.users.owner);
  assert.equal(rows.length, 2);
  for (const row of rows) { assert.equal(row.title, 'PATH 상담 할 일'); assert.equal(row.href, '/?tab=workroom&section=tools&tool=path-cases&caseId=' + made.id); }
  assert.equal(rows[0].date, '2027-01-15'); assert.equal(rows[1].date, '2027-01-15');
  assert.doesNotMatch(JSON.stringify(rows), /원서|추천서|사정|몽골/);
  assert.deepEqual(f.cases.today(f.users.manager), [], '책임자라도 자기 담당 건만');
  // 할 일을 다 하면 끝내기를 묻는 줄 하나.
  let c = f.cases.detail(f.users.owner, made.id).case;
  for (const task of c.tasks) c = f.cases.task(f.users.owner, made.id, { revision: c.revision, action: 'done', taskId: task.id, note: '학생과 통화함' }).case;
  assert.deepEqual(f.cases.today(f.users.owner).map(row => row.title), ['PATH 상담 끝내기 확인']);
  c = f.cases.task(f.users.owner, made.id, { revision: c.revision, action: 'add', do: '비자 서류 안내 링크 보내기' }).case;
  assert.equal(c.tasks.length, 3);
  c = f.cases.task(f.users.owner, made.id, { revision: c.revision, action: 'remove', taskId: c.tasks[2].id }).case;
  assert.equal(c.tasks.length, 2);
  assert.equal(f.store.count('companyWork'), 0, '할 일을 companyWork에 복사하지 않는다');
});

test('보관 정리: 끝난 건은 76일에 알림 표시, 90일에 지움(내용 없는 줄 1년), 180일 쓰지 않은 열린 건은 끝냄', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  const idleStudent = f.student(), idle = f.cases.studentCreate(idleStudent, f.urgent()).body.case;
  const rev = f.store.get(PATH_CASE_KINDS.cases, made.id).revision;
  f.cases.close(f.users.owner, made.id, { revision: rev });
  f.advance(75 * DAY); f.cases.maintain();
  assert.equal(f.cases.studentList(s).cases[0].delete_soon, false);
  f.advance(1 * DAY + 1000); f.cases.maintain();
  assert.equal(f.cases.studentList(s).cases[0].delete_soon, true);
  f.advance(14 * DAY); f.cases.maintain();
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, made.id), null);
  const stone = f.store.get(PATH_CASE_KINDS.tombstones, made.id);
  assert.deepEqual(Object.keys(stone).sort(), ['closedDay', 'createdDay', 'erasedAt', 'id', 'kind', 'reason', 'taskCount']);
  assert.equal(stone.taskCount, 2); assert.equal(stone.kind, 'act'); assert.equal(stone.reason, 'retention');
  // 급함 건은 학생이 확인(목록 읽기)해도 직원이 아무도 쓰지 않으면 180일에 끝낸다(updatedAt 기준).
  f.advance(90 * DAY + 1000); f.cases.maintain();
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, idle.id).status, 'closed');
  f.advance(366 * DAY); f.cases.maintain();
  assert.equal(f.store.get(PATH_CASE_KINDS.tombstones, made.id), null);
});

test('계정 정리: 서명한 머리말로 묻고, gone은 지우고 leaving은 숨기고, 모름 · 실패는 두고, 한 번에 gone이 많으면 멈춘다', async t => {
  let answer = {}, failNext = false; const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const time = init.headers['X-Synk-Liveness-Time'], bodyHash = createHash('sha256').update(init.body).digest('hex');
    assert.equal(init.headers['X-Synk-Liveness-Signature'], createHmac('sha256', LIVENESS_KEY).update(['path-liveness.v1', time, bodyHash].join('\u001F')).digest('base64url'));
    assert.equal(init.headers.Authorization, 'Bearer sb_publishable_synthetic_talk_anon'); assert.equal(init.headers.apikey, 'sb_publishable_synthetic_talk_anon');
    const { action, ids } = JSON.parse(init.body); assert.equal(action, 'account-liveness'); assert.ok(ids.length <= 100);
    if (failNext) return new Response('{}', { status: 502 });
    return Response.json({ results: Object.fromEntries(ids.filter(id => answer[id]).map(id => [id, answer[id]])) });
  };
  const f = fixture(t, { env: { ACCOUNT_LIVENESS_KEY: LIVENESS_KEY, SYNK_TALK_ANON_KEY: 'sb_publishable_synthetic_talk_anon', PATH_ACCOUNT_LIVENESS_URL: 'https://talk.example.test/functions/v1/synk-account' }, fetchImpl });
  const students = Array.from({ length: 10 }, () => f.student());
  const made = students.map(s => f.cases.studentCreate(s, f.urgent()).body.case);
  assert.deepEqual(await f.cases.liveness(), { asked: 0, gone: 0, leaving: 0, present: 0 }, '24시간 안에 학생이 확인한 건은 묻지 않는다');
  f.advance(DAY + 1000);
  // 대량 gone: 3명 → 멈춤, 아무것도 지우지 않음, 관리자 알림.
  answer = Object.fromEntries(students.slice(0, 3).map(s => [s.synkUserId, 'gone']));
  const stopped = await f.cases.liveness();
  assert.equal(stopped.stopped, true); assert.equal(f.store.count(PATH_CASE_KINDS.cases), 10); assert.equal(f.ownerAlerts.length, 1);
  assert.equal(f.store.get('settings', 'pathCaseState').livenessStatus, 'stopped');
  assert.deepEqual(await f.cases.liveness(), { skipped: 'not-due' });
  // 실패하면 아무것도 바꾸지 않는다.
  f.advance(DAY + 1000); failNext = true;
  assert.equal((await f.cases.liveness()).failed, true); assert.equal(f.store.count(PATH_CASE_KINDS.cases), 10);
  // gone 1(10% · 3건 미만) · leaving 1 · present 7 · 모름 1.
  f.advance(DAY + 1000); failNext = false;
  answer = { [students[0].synkUserId]: 'gone', [students[1].synkUserId]: 'leaving', ...Object.fromEntries(students.slice(2, 9).map(s => [s.synkUserId, 'present'])) };
  const done = await f.cases.liveness();
  assert.deepEqual(done, { asked: 10, gone: 1, leaving: 1, present: 7 });
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, made[0].id), null); assert.equal(f.store.get(PATH_CASE_KINDS.tombstones, made[0].id).reason, 'account-gone');
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, made[1].id).hidden, true);
  assert.ok(!f.cases.list(f.users.owner).items.some(row => row.id === made[1].id), 'leaving 건은 직원 목록에서 숨긴다');
  assert.ok(f.store.get(PATH_CASE_KINDS.cases, made[9].id), '모르는 계정은 지우지 않는다');
  assert.ok(calls.every(call => call.url === 'https://talk.example.test/functions/v1/synk-account'));
  // 학생이 다시 오면 숨김이 풀린다.
  f.cases.studentList(students[1]);
  assert.equal(f.store.get(PATH_CASE_KINDS.cases, made[1].id).hidden, false);
});

test('두 단계 지우기: 회사 주인의 확인 번호가 있어야 지우고, 다시 불러도 같은 답', t => {
  const f = fixture(t), s = f.student(), made = f.cases.studentCreate(s, f.handoff(s)).body.case;
  const rev = f.store.get(PATH_CASE_KINDS.cases, made.id).revision;
  assert.throws(() => f.cases.erase(f.users.owner, made.id, { revision: rev, token: '1'.repeat(13) + '.' + '0'.repeat(64) }), code('CASE_ERASE_CONFIRM'));
  const check = f.cases.eraseCheck(f.users.owner, made.id, { revision: rev }).erasure;
  f.advance(11 * 60000);
  assert.throws(() => f.cases.erase(f.users.owner, made.id, { revision: rev, token: check.token }), code('CASE_ERASE_CONFIRM'));
  const fresh = f.cases.eraseCheck(f.users.owner, made.id, { revision: rev }).erasure;
  assert.equal(f.cases.erase(f.users.owner, made.id, { revision: rev, token: fresh.token }).erased.id, made.id);
  assert.equal(f.cases.erase(f.users.owner, made.id, { revision: rev, token: fresh.token }).erased.repeated, true);
  assert.equal(f.cases.studentList(s).cases.length, 0);
});

test('번역: 학생 글은 한국어 번역을 덧붙이고, 번역이 없으면 원문만 둔다', async t => {
  const seen = [];
  const translator = { configured: () => true, translate: async (texts, { to }) => { seen.push({ texts, to }); return texts.map(text => '[번역] ' + text); } };
  const f = fixture(t, { translator }), s = f.student();
  const made = f.cases.studentCreate(s, f.teen()).body.case;
  f.cases.studentMessage(s, made.id, { request_id: randomUUID(), text: 'Сайн байна уу?' });
  await f.cases.waitForIdle();
  const c = f.cases.detail(f.users.owner, made.id).case;
  assert.equal(c.noteKo, '[번역] Сургуульд орох талаар асуумаар байна.');
  assert.equal(c.messages[0].text, 'Сайн байна уу?'); assert.equal(c.messages[0].textKo, '[번역] Сайн байна уу?');
  assert.deepEqual((await f.cases.translateDraft(f.users.owner, made.id, { text: '서류를 확인했어요.' })), { text: '[번역] 서류를 확인했어요.', lang: 'mn' });
  assert.equal(seen.at(-1).to, 'mn');
  const g = fixture(t), s2 = g.student(), plain = g.cases.studentCreate(s2, g.teen()).body.case;
  await g.cases.waitForIdle();
  assert.equal(g.cases.detail(g.users.owner, plain.id).case.noteKo, null);
});
