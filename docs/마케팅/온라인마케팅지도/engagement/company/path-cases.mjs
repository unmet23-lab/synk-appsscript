import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { validateCaseRequest, ticketPayload, briefHashInput, maskAsk, looksUrgent, cleanText, MAX_NOTE_CHARS } from '../../../../../experiences/path-app/ask-shape.mjs';
import { workspaceAccess } from './workspace-access.mjs';
import { workspaceOwner, isWorkspaceOwner } from './workspace-owner.mjs';

// PATH 상담함(AI상담_설계.md 「사람 연결」). 학생이 PATH 앱에서 「사람에게 연결」로 보낸 사본을 회사 서버가 원본으로 쥔다.
// - 건 본문은 store.encrypt로 싼다. 밖에는 SYNK ID · 갈래 · 상태 · 담당 · 판 번호 · 마지막 학생 확인 시각과 정리에 쓰는 시각 · 급함 표시만 둔다.
// - 학생 한 사람에게 열린 건은 하나다(트랜잭션 안에서 확인). 급함은 열린 건에 표시를 올린다.
// - 증표(handoff_brief가 낸 것)는 서명 · 만료 · 계정 · 요약 해시를 보고 nonce를 한 번만 받는다. 증표 없는 길은 급함 고정 꼴과 14~17세 짧은 양식뿐이다.
// - 받는 모든 칸은 같은 가리기(maskAsk)를 다시 거친다(validateCaseRequest가 한다. 학생 글 더하기는 여기서 한다).
// - 할 일 글은 오늘 할 일(companyWork)에 복사하지 않는다. today()는 읽을 때마다 같은 권한 검사로 링크 줄만 만든다.
export const PATH_CASE_KINDS = Object.freeze({ cases: 'pathCases', nonces: 'pathCaseNonces', intake: 'pathCaseIntake', views: 'pathCaseViews', tombstones: 'pathCaseTombstones', alerts: 'pathCaseAlerts' });
const K = PATH_CASE_KINDS, SETTINGS = 'pathCases', STATE = 'pathCaseState';
const DAY = 86400000, WEEK = 7 * DAY, HOUR = 3600000;
export const PATH_CASE_LIMITS = Object.freeze({
  messageChars: 1000, messages: 100, caseBytes: 1024 * 1024, staffDraftChars: 2000, taskChars: 200, taskNoteChars: 300, tasks: 30,
  // 갈래별 주간 횟수(한 사람, 지난 7일). stuck은 설계대로 1번. 증표 없는 급함 · 14~17세 양식은 합쳐서 하루 3번 · 주 5번.
  weekly: { stuck: 1, act: 3, synk: 3 }, noTicketDaily: 3, noTicketWeekly: 5,
  closedKeepDays: 90, noticeDays: 14, idleOpenDays: 180, tombstoneDays: 365, viewDays: 365, intakeDays: 8, alertDays: 30,
  livenessEveryMs: DAY, livenessStaleMs: DAY, livenessBatch: 100, livenessBatches: 5, goneStopCount: 3, goneStopShare: 0.2,
});
const L = PATH_CASE_LIMITS;
const STATUSES = ['new', 'reviewing', 'answered', 'closed'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALERT_PREFIX = 'path-case:';
const fail = (status, code, message, extra = {}) => Object.assign(new Error(message), { status, code, ...extra });
const sha256hex = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const kstDay = iso => new Date(Date.parse(iso) + 9 * HOUR).toISOString().slice(0, 10);
const goodText = (value, max) => typeof value === 'string' && value === cleanText(value) && value.length > 0 && [...value].length <= max;
export const pathCaseHref = id => '/?tab=workroom&section=tools&tool=path-cases&caseId=' + encodeURIComponent(id);
const shapeFault = error => { if (typeof error?.code === 'string' && /^[A-Z_]{3,60}$/.test(error.code)) return fail(400, error.code, '보낸 상담의 꼴이 맞지 않아요. 앱을 새로 연 뒤 다시 보내 주세요.'); return error; };

export function createPathCases({ store, clock = () => new Date().toISOString(), env = process.env, translator = null, fetchImpl = globalThis.fetch,
  onChange = () => {}, onUrgent = () => {}, ownerAlert = () => {} } = {}) {
  if (!store?.db || typeof store.encrypt !== 'function') throw new TypeError('PATH 상담함에는 암호화 저장소가 필요합니다.');
  const now = () => { const value = clock(); const ms = Date.parse(value); if (!Number.isFinite(ms)) throw new Error('Invalid PATH case clock'); return new Date(ms).toISOString(); };
  const nowMs = () => Date.parse(now());
  const confirmKey = createHmac('sha256', store.key).update('path-case-erase-confirm\0v1').digest();
  const enabled = () => env.PATH_CASES_ENABLED === 'true';
  const allowList = () => String(env.PATH_CASES_ALLOW || '').split(/[\s,]+/).map(value => value.trim().toLowerCase()).filter(value => UUID.test(value));
  const ticketKey = () => { const value = env.PATH_CASE_TICKET_KEY; return typeof value === 'string' && value.length >= 32 ? value : null; };
  const notify = ids => { const list = [...new Set(ids.filter(Boolean))]; if (list.length) try { onChange(list); } catch { /* 다음 읽기에 보인다 */ } };

  /* ── 저장 ── */
  const open = row => row && row.status !== 'closed';
  const bodyOf = row => store.decrypt(row.payload);
  function save(row, body, { allowOver = false } = {}) {
    const text = JSON.stringify(body);
    if (!allowOver && Buffer.byteLength(text) > L.caseBytes) throw fail(413, 'CASE_TOO_LARGE', '이 상담에는 더 쓸 수 없어요. 새 상담으로 이어 주세요.');
    const next = { ...row, payload: store.encrypt(body) };
    store.put(K.cases, row.id, next);
    return next;
  }
  const casesOf = synkUserId => store.allWhere(K.cases, 'synkUserId', synkUserId);
  const openCaseOf = synkUserId => casesOf(synkUserId).find(open) || null;

  /* ── 사람과 권한 ── */
  function live(userId) { const user = userId ? store.get('users', userId) : null; return user && user.active === true ? user : null; }
  // PATH 소속 역할을 직접 본다. 회사 주인은 모두 본다. operations · 다른 관리자 · viewer는 받지 않는다.
  function roleOf(user) {
    if (!user || user.active !== true || user.role === 'viewer') return null;
    if (isWorkspaceOwner(store, user)) return 'owner';
    const member = workspaceAccess(user).memberships.find(row => row.company === 'PATH');
    return member && ['counselor', 'manager'].includes(member.role) ? member.role : null;
  }
  const eligible = userId => Boolean(roleOf(live(userId)));
  function access(actor) {
    const user = live(actor?.id);
    if (!user) throw fail(401, 'CASE_AUTH', '먼저 회사 계정으로 로그인해 주세요.');
    const role = roleOf(user);
    if (!role) throw fail(403, 'CASE_FORBIDDEN', 'PATH 상담 담당과 책임자, 회사 주인만 볼 수 있어요.');
    return { user, role, all: role !== 'counselor' };
  }
  function defaultAssignee() {
    const chosen = store.get('settings', SETTINGS)?.defaultAssigneeId;
    if (chosen && eligible(chosen)) return chosen;
    return workspaceOwner(store)?.id || null;
  }
  // 담당자의 계정이 꺼지거나 PATH 소속이 빠지면 열린 건은 회사 주인에게 돌아간다.
  const assigneeOf = row => (row.assigneeId && eligible(row.assigneeId) ? row.assigneeId : (open(row) ? workspaceOwner(store)?.id || null : row.assigneeId || null));
  const visibleTo = (who, row) => !row.hidden && (who.all || assigneeOf(row) === who.user.id);
  function reassignOrphans() {
    const owner = workspaceOwner(store)?.id || null, moved = [];
    store.transaction(() => {
      for (const row of store.all(K.cases)) {
        if (!open(row) || (row.assigneeId && eligible(row.assigneeId)) || (!row.assigneeId && !owner) || row.assigneeId === owner) continue;
        store.put(K.cases, row.id, { ...row, assigneeId: owner, revision: row.revision + 1, updatedAt: row.updatedAt });
        moved.push(owner);
      }
    });
    notify(moved);
    return moved.length;
  }
  function staffCase(who, id) {
    const row = typeof id === 'string' && UUID.test(id) ? store.get(K.cases, id.toLowerCase()) : null;
    if (!row || !visibleTo(who, row)) throw fail(404, 'CASE_NOT_FOUND', '상담을 찾지 못했어요. 목록을 새로 읽어 주세요.');
    return row;
  }
  const checkRevision = (row, input) => { if (!plain(input) || input.revision !== row.revision) throw fail(409, 'CASE_REVISION', '그사이 상담이 바뀌었어요. 새로 읽어 주세요.'); };

  /* ── 급함과 알림 ── 알림 줄에는 「PATH 급함 상담」과 링크만 싣는다. */
  function raiseUrgent(row, at) {
    const target = assigneeOf(row) || workspaceOwner(store)?.id || null;
    if (target) { const id = randomUUID(); store.put(K.alerts, id, { id, userId: target, caseId: row.id, createdAt: at, readAt: null }); }
    return { row: { ...row, urgent: true, urgentAt: at }, target };
  }
  function notifications(actor) {
    const user = live(actor?.id);
    if (!user || !roleOf(user)) return [];
    return store.all(K.alerts).filter(row => row.userId === user.id && store.get(K.cases, row.caseId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
      .map(row => ({ id: ALERT_PREFIX + row.id, kind: 'path_case_urgent', title: 'PATH 급함 상담', text: '', body: '', createdAt: row.createdAt, readAt: row.readAt, unread: !row.readAt, href: pathCaseHref(row.caseId), message: null }));
  }
  function readAlert(actor, id) {
    const user = live(actor?.id); if (!user) throw fail(401, 'CASE_AUTH', '먼저 로그인해 주세요.');
    const key = typeof id === 'string' && id.startsWith(ALERT_PREFIX) ? id.slice(ALERT_PREFIX.length) : '', row = key && store.get(K.alerts, key);
    if (!row || row.userId !== user.id) throw fail(404, 'CASE_ALERT', '알림을 찾을 수 없습니다.');
    if (!row.readAt) store.put(K.alerts, key, { ...row, readAt: now() });
    return { ok: true, id, unreadCount: notifications(user).filter(item => item.unread).length };
  }
  function readAllAlerts(actor) {
    const user = live(actor?.id); if (!user) return { ok: true, count: 0 };
    const rows = store.all(K.alerts).filter(row => row.userId === user.id && !row.readAt), at = now();
    if (rows.length) store.transaction(() => { for (const row of rows) store.put(K.alerts, row.id, { ...row, readAt: at }); });
    return { ok: true, count: rows.length };
  }

  /* ── 증표 ── */
  function verifyTicket(ticket, identity, briefKo) {
    const key = ticketKey();
    if (!key) throw fail(503, 'CASE_TICKET_NOT_CONFIGURED', '상담 연결이 아직 준비되지 않았어요. 잠시 뒤 다시 보내 주세요.');
    const expected = createHmac('sha256', key).update(ticketPayload(ticket)).digest('base64url');
    if (!same(expected, ticket.sig)) throw fail(403, 'CASE_TICKET_FORGED', '연결 확인이 맞지 않아요. 「사람에게 연결」을 다시 눌러 주세요.');
    // 증표의 계정은 이 토큰의 계정이어야 한다(SYNK ID 또는 로그인 주체).
    if (ticket.sub !== identity.synkUserId && ticket.sub !== identity.subject) throw fail(403, 'CASE_TICKET_ACCOUNT', '다른 계정의 연결 확인이에요. 다시 로그인한 뒤 보내 주세요.');
    if (!same(ticket.brief_hash, sha256hex(briefHashInput(briefKo)))) throw fail(403, 'CASE_TICKET_BRIEF', '넘김 요약이 연결 확인과 달라요. 「사람에게 연결」을 다시 눌러 주세요.');
  }

  /* ── 횟수 ── 지난 하루 · 7일의 접수 줄로 센다(줄은 8일 뒤 지운다). */
  function checkLimits(synkUserId, mode, kind, at) {
    const rows = store.allWhere(K.intake, 'synkUserId', synkUserId).filter(row => Date.parse(row.at) > Date.parse(at) - WEEK);
    const tooMany = () => fail(429, 'CASE_LIMIT', '이번 주에 보낼 수 있는 연결을 다 썼어요. 급하면 hello@synk.im으로 연락해 주세요.');
    if (mode === 'urgent' || mode === 'teen') {
      const free = rows.filter(row => row.mode === 'urgent' || row.mode === 'teen');
      if (free.filter(row => Date.parse(row.at) > Date.parse(at) - DAY).length >= L.noTicketDaily || free.length >= L.noTicketWeekly) throw tooMany();
    }
    if (mode !== 'urgent') {
      const limit = L.weekly[kind];
      if (Number.isInteger(limit) && rows.filter(row => row.kind === kind && row.mode !== 'urgent').length >= limit) throw tooMany();
    }
  }

  /* ── 학생 쪽 ── */
  function touch(row, at) { return { ...row, lastStudentCheckAt: at, hidden: false }; }
  // PATH 앱 readCases(ask-flow.mjs)의 꼴: { id, kind, status, created_at, wants, unread(답 온 수), messages:[{ id, from, text, at }] }. 그 밖의 칸은 앱이 버린다.
  function studentView(row) {
    const body = bodyOf(row);
    const messages = body.messages.map(m => ({ id: m.id, from: m.from, text: m.from === 'staff' ? (m.textStudent || m.text) : m.text, at: m.at }));
    const unread = body.messages.filter(m => m.from === 'staff' && (!body.studentReadAt || m.at > body.studentReadAt)).length;
    const deleteAt = row.closedAt ? new Date(Date.parse(row.closedAt) + L.closedKeepDays * DAY).toISOString() : null;
    return { id: row.id, kind: row.kind, status: row.status, urgent: row.urgent === true, created_at: row.createdAt, updated_at: row.updatedAt, closed_at: row.closedAt || null,
      answered_at: body.answeredAt || null, read_at: body.studentReadAt || null, wants: body.brief_student?.wants || null, unread,
      delete_at: deleteAt, delete_soon: Boolean(row.retentionNoticeAt), messages };
  }
  function status() { return { open: enabled() }; }
  function studentList(identity) {
    const at = now();
    const rows = store.transaction(() => casesOf(identity.synkUserId).map(row => { const next = touch(row, at); store.put(K.cases, row.id, next); return next; }));
    return { ok: true, cases: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(studentView), open: enabled() };
  }
  function newBody(req) {
    const tasks = req.mode === 'handoff' ? req.brief_ko.tasks.map(t => ({ id: randomUUID(), do: t.do, why: t.why, by: t.by, source: 'ai', done: false, note: '', doneAt: null, doneBy: null, removed: false })) : [];
    return { version: 1, mode: req.mode, lang: req.lang, age: req.age || 'adult', consent: req.consent, guardian: req.guardian === true,
      brief_ko: req.brief_ko || null, brief_student: req.brief_student || null, edits: req.edits || [], deadline: req.deadline || null,
      note: req.note ?? null, noteKo: null, last: req.last ?? null, lastKo: null, conversation: req.conversation || null, profile: req.profile || null, program: req.program || null,
      tasks, messages: [], answeredAt: null, studentReadAt: null };
  }
  function addStudentMessage(body, text, requestId, at) {
    if (body.messages.length >= L.messages) throw fail(409, 'CASE_FULL', '이 상담에는 더 쓸 수 없어요. 답을 기다리거나 새 상담으로 이어 주세요.');
    const message = { id: randomUUID(), from: 'student', text, textKo: null, at, requestId };
    body.messages.push(message);
    return message;
  }
  function studentCreate(identity, input) {
    if (!enabled()) throw fail(503, 'PATH_CASES_CLOSED', '지금은 사람 연결을 받지 않아요. hello@synk.im으로 연락해 주세요.');
    const allowed = allowList();
    if (allowed.length && !allowed.includes(identity.synkUserId)) throw fail(403, 'PATH_CASES_NOT_ALLOWED', '아직 사람 연결을 쓸 수 없는 계정이에요. hello@synk.im으로 연락해 주세요.');
    let req;
    try { req = validateCaseRequest(input, nowMs()); } catch (error) { throw shapeFault(error); }
    if (req.mode === 'handoff') verifyTicket(req.ticket, identity, req.brief_ko);
    const at = now(), translate = [];
    let urgent = null;
    const result = store.transaction(() => {
      const prior = store.allWhere(K.intake, 'synkUserId', identity.synkUserId).find(row => row.requestId === req.request_id);
      if (prior) {
        const row = prior.caseId && store.get(K.cases, prior.caseId);
        if (!row) throw fail(409, 'CASE_GONE', '이미 보낸 상담이 지워졌어요. 다시 연결해 주세요.');
        return { row, status: 200, duplicate: true };
      }
      if (req.mode === 'handoff' && store.get(K.nonces, req.ticket.nonce)) throw fail(409, 'CASE_TICKET_USED', '이미 쓴 연결 확인이에요. 「사람에게 연결」을 다시 눌러 주세요.');
      const current = openCaseOf(identity.synkUserId);
      if (current && req.kind !== 'urgent') throw fail(409, 'CASE_OPEN_EXISTS', '이미 열린 상담이 있어요. 그 상담에 이어서 써 주세요.', { caseId: current.id });
      checkLimits(identity.synkUserId, req.mode, req.kind, at);
      let row, status = 201;
      if (current) {
        // 열린 건이 있으면 새 건을 만들지 않고 그 건에 급함 표시를 올린다. 학생이 고른 마지막 글은 그 건의 글로 잇는다.
        const body = bodyOf(current);
        if (req.last && body.messages.length < L.messages) translate.push({ messageId: addStudentMessage(body, req.last, req.request_id, at).id });
        const raised = raiseUrgent(touch({ ...current, status: current.status === 'answered' ? 'reviewing' : current.status, revision: current.revision + 1, updatedAt: at }, at), at);
        row = save(raised.row, body, { allowOver: true }); urgent = { target: raised.target };
        status = 200;
      } else {
        const id = randomUUID(), body = newBody(req);
        row = { id, synkUserId: identity.synkUserId, kind: req.kind, status: 'new', assigneeId: defaultAssignee(), revision: 1, lastStudentCheckAt: at,
          urgent: false, urgentAt: null, createdAt: at, updatedAt: at, closedAt: null, retentionNoticeAt: null, hidden: false };
        if (req.kind === 'urgent' || (body.note && looksUrgent(body.note))) { const raised = raiseUrgent(row, at); row = raised.row; urgent = { target: raised.target }; }
        row = save(row, body);
        if (body.note) translate.push({ field: 'note' });
        if (body.last) translate.push({ field: 'last' });
      }
      if (req.mode === 'handoff') store.put(K.nonces, req.ticket.nonce, { nonce: req.ticket.nonce, exp: req.ticket.exp, usedAt: at });
      const intakeId = randomUUID();
      store.put(K.intake, intakeId, { id: intakeId, synkUserId: identity.synkUserId, requestId: req.request_id, mode: req.mode, kind: req.kind, caseId: row.id, at });
      return { row, status, merged: Boolean(current) };
    });
    const stored = result.row;
    if (!result.duplicate) {
      if (urgent) { try { onUrgent(stored, urgent.target); } catch { /* 알림 줄은 저장돼 있다 */ } }
      notify([assigneeOf(stored)]);
      for (const job of translate) queueTranslation(stored.id, job);
    }
    return { status: result.status, body: { ok: true, case: studentView(stored), duplicate: result.duplicate === true, merged: result.merged === true } };
  }
  function studentCase(identity, id) {
    const row = typeof id === 'string' && UUID.test(id) ? store.get(K.cases, id.toLowerCase()) : null;
    if (!row || row.synkUserId !== identity.synkUserId) throw fail(404, 'CASE_NOT_FOUND', '상담을 찾지 못했어요. 새로 읽어 주세요.');
    return row;
  }
  function studentMessage(identity, id, input) {
    if (!enabled()) throw fail(503, 'PATH_CASES_CLOSED', '지금은 새 글을 받지 않아요. hello@synk.im으로 연락해 주세요.');
    if (!onlyKeys(input, ['request_id', 'text']) || typeof input.request_id !== 'string' || !UUID.test(input.request_id) || !goodText(input.text, L.messageChars))
      throw fail(400, 'CASE_BAD_MESSAGE', '글은 1,000자 안으로 써 주세요.');
    const requestId = input.request_id.toLowerCase(), text = maskAsk(input.text), at = now();
    let urgentTarget, created = null;
    const row = store.transaction(() => {
      const current = studentCase(identity, id);
      const body = bodyOf(current);
      const repeated = body.messages.find(m => m.requestId === requestId && m.from === 'student');
      if (repeated) return current;
      if (!open(current)) throw fail(409, 'CASE_CLOSED', '끝난 상담이에요. 다시 연결하면 새 상담이 열려요.');
      created = addStudentMessage(body, text, requestId, at);
      let next = touch({ ...current, status: current.status === 'answered' ? 'reviewing' : current.status, revision: current.revision + 1, updatedAt: at }, at);
      // 열린 건에 쓴 글에 위험 낱말이 보이면 급함 표시를 올리고 바로 알린다.
      if (looksUrgent(text)) { const raised = raiseUrgent(next, at); next = raised.row; urgentTarget = raised.target; }
      return save(next, body);
    });
    if (created) {
      if (urgentTarget !== undefined) { try { onUrgent(row, urgentTarget); } catch { /* 알림 줄은 저장돼 있다 */ } }
      notify([assigneeOf(row)]);
      queueTranslation(row.id, { messageId: created.id });
    }
    return { ok: true, case: studentView(row) };
  }
  function studentRead(identity, id) {
    const at = now();
    const row = store.transaction(() => {
      const current = studentCase(identity, id), body = bodyOf(current);
      body.studentReadAt = at;
      return save(touch({ ...current, updatedAt: current.updatedAt }, at), body, { allowOver: true });
    });
    return { ok: true, case: studentView(row) };
  }
  // 학생의 「이 상담 지우기」는 바로 지운다. 스위치가 꺼져 있어도 된다.
  function studentDelete(identity, id) {
    const row = studentCase(identity, id);
    erase(row, 'student');
    return { ok: true, deleted: true, id: row.id };
  }

  /* ── 지우기와 내용 없는 줄 ── */
  function erase(row, reason) {
    let tasks = 0;
    try { tasks = bodyOf(row).tasks.filter(t => !t.removed).length; } catch { tasks = 0; }
    const at = now();
    store.transaction(() => {
      store.remove(K.cases, row.id);
      for (const alert of store.all(K.alerts)) if (alert.caseId === row.id) store.remove(K.alerts, alert.id);
      store.put(K.tombstones, row.id, { id: row.id, kind: row.kind, createdDay: kstDay(row.createdAt), closedDay: row.closedAt ? kstDay(row.closedAt) : null, taskCount: tasks, erasedAt: at, reason });
    });
    try { store.db.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch { /* 다음 체크포인트가 지운다 */ }
    notify([row.assigneeId]);
  }

  /* ── 직원 쪽 ── */
  const KIND_ORDER = { urgent: 0, act: 1, synk: 2, stuck: 3 };
  function summaryOf(row, body) {
    const tasks = body.tasks.filter(t => !t.removed);
    const last = body.messages.at(-1);
    return { id: row.id, kind: row.kind, status: row.status, urgent: row.urgent === true, urgentAt: row.urgentAt || null, assigneeId: assigneeOf(row),
      assigneeName: live(assigneeOf(row))?.name || '', deadline: body.deadline || null, mode: body.mode, lang: body.lang, age: body.age,
      wants: body.brief_ko?.wants || null, openTasks: tasks.filter(t => !t.done).length, tasks: tasks.length,
      waiting: Boolean(last && last.from === 'student'), createdAt: row.createdAt, updatedAt: row.updatedAt, closedAt: row.closedAt || null, revision: row.revision };
  }
  function order(a, b) {
    return Number(a.status === 'closed') - Number(b.status === 'closed')
      || Number(b.urgent && b.status !== 'closed') - Number(a.urgent && a.status !== 'closed')
      || (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99')
      || (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || a.createdAt.localeCompare(b.createdAt);
  }
  function assignees() {
    return store.all('users').filter(user => user.active === true && roleOf(user)).map(user => ({ id: user.id, name: user.name || '담당자', role: roleOf(user) }));
  }
  function list(actor) {
    let who = access(actor);
    reassignOrphans(); who = access(actor);
    const items = store.all(K.cases).filter(row => visibleTo(who, row)).map(row => summaryOf(row, bodyOf(row))).sort(order);
    return { items, role: who.role, canAssign: who.all, canErase: who.role === 'owner', assignees: who.all ? assignees() : [],
      settings: who.role === 'owner' ? { defaultAssigneeId: store.get('settings', SETTINGS)?.defaultAssigneeId || null } : null,
      enabled: enabled(), translation: Boolean(translator?.configured?.()) };
  }
  function staffView(row, body, who) {
    const names = new Map();
    const name = id => { if (!id) return ''; if (!names.has(id)) names.set(id, store.get('users', id)?.name || '담당자'); return names.get(id); };
    return { ...summaryOf(row, body), program: body.program, profile: body.profile, guardian: body.guardian === true,
      brief: body.brief_ko ? { situation: body.brief_ko.situation, wants: body.brief_ko.wants, ai_done: body.brief_ko.ai_done, open: body.brief_ko.open } : null,
      edits: body.edits, note: body.note, noteKo: body.noteKo, last: body.last, lastKo: body.lastKo,
      tasks: body.tasks.filter(t => !t.removed).map(t => ({ ...t, doneByName: name(t.doneBy) })),
      messages: body.messages.map(m => ({ id: m.id, from: m.from, text: m.text, textKo: m.textKo ?? null, textStudent: m.textStudent ?? null, at: m.at, authorName: m.from === 'staff' ? name(m.authorId) : '' })),
      conversation: body.conversation, answeredAt: body.answeredAt, studentReadAt: body.studentReadAt,
      canAssign: who.all, canErase: who.role === 'owner', deleteAt: row.closedAt ? new Date(Date.parse(row.closedAt) + L.closedKeepDays * DAY).toISOString() : null };
  }
  function detail(actor, id) {
    const who = access(actor), at = now();
    const row = store.transaction(() => {
      const current = staffCase(who, id);
      // 연 기록(누가 언제)은 건 밖에 남긴다.
      const viewId = randomUUID(); store.put(K.views, viewId, { id: viewId, caseId: current.id, userId: who.user.id, at });
      for (const alert of store.all(K.alerts)) if (alert.caseId === current.id && alert.userId === who.user.id && !alert.readAt) store.put(K.alerts, alert.id, { ...alert, readAt: at });
      if (current.status !== 'new') return current;
      const next = { ...current, status: 'reviewing', revision: current.revision + 1, updatedAt: at };
      store.put(K.cases, current.id, next); return next;
    });
    return { case: staffView(row, bodyOf(row), who) };
  }
  // 고친 뒤 상세를 같은 꼴로 돌려준다.
  function mutate(actor, id, input, fn, { manager = false, owner = false } = {}) {
    const who = access(actor);
    if (manager && !who.all) throw fail(403, 'CASE_FORBIDDEN', 'PATH 책임자와 회사 주인만 할 수 있어요.');
    if (owner && who.role !== 'owner') throw fail(403, 'CASE_FORBIDDEN', '회사 주인만 할 수 있어요.');
    const at = now();
    const row = store.transaction(() => {
      const current = staffCase(who, id); checkRevision(current, input);
      const body = bodyOf(current);
      const next = fn({ current, body, who, at }) || current;
      return save({ ...next, revision: current.revision + 1, updatedAt: at }, body, { allowOver: true });
    });
    notify([assigneeOf(row), who.user.id]);
    return { case: staffView(row, bodyOf(row), who) };
  }
  function assign(actor, id, input) {
    if (!onlyKeys(input, ['revision', 'assigneeId']) || typeof input.assigneeId !== 'string' || !eligible(input.assigneeId)) throw fail(400, 'CASE_ASSIGNEE', 'PATH 상담 담당이나 책임자, 회사 주인에게만 맡길 수 있어요.');
    return mutate(actor, id, input, ({ current }) => ({ ...current, assigneeId: input.assigneeId }), { manager: true });
  }
  function reply(actor, id, input) {
    if (!onlyKeys(input, ['revision', 'request_id', 'text', 'textStudent']) || typeof input.request_id !== 'string' || !UUID.test(input.request_id) || !goodText(input.text, L.messageChars)
      || !(input.textStudent === undefined || input.textStudent === null || goodText(input.textStudent, L.staffDraftChars))) throw fail(400, 'CASE_BAD_MESSAGE', '답은 1,000자 안으로 써 주세요.');
    const requestId = input.request_id.toLowerCase();
    const who = access(actor), currentRow = staffCase(who, id);
    if (bodyOf(currentRow).messages.some(m => m.requestId === requestId && m.from === 'staff')) return { case: staffView(currentRow, bodyOf(currentRow), who), duplicate: true };
    return mutate(actor, id, input, ({ current, body, who: me, at }) => {
      if (!open(current)) throw fail(409, 'CASE_CLOSED', '끝난 상담에는 답을 쓰지 않아요.');
      // 한도에 닿아도 직원의 답 하나는 된다(마지막 글이 직원의 답이면 더는 쓰지 않는다).
      if (body.messages.length >= L.messages && body.messages.at(-1)?.from === 'staff') throw fail(409, 'CASE_FULL', '이 상담의 글 한도에 닿았어요. 끝내기만 할 수 있어요.');
      if (Buffer.byteLength(JSON.stringify(body)) > L.caseBytes && body.messages.at(-1)?.from === 'staff') throw fail(413, 'CASE_TOO_LARGE', '이 상담의 크기 한도에 닿았어요. 끝내기만 할 수 있어요.');
      body.messages.push({ id: randomUUID(), from: 'staff', text: maskAsk(input.text), textStudent: input.textStudent ? maskAsk(input.textStudent) : null, at, requestId, authorId: me.user.id });
      body.answeredAt = at;
      return { ...current, status: 'answered' };
    });
  }
  function task(actor, id, input) {
    const actions = ['done', 'undone', 'add', 'remove'];
    if (!onlyKeys(input, ['revision', 'action', 'taskId', 'note', 'do']) || !actions.includes(input.action)) throw fail(400, 'CASE_BAD_TASK', '할 일 요청을 확인해 주세요.');
    return mutate(actor, id, input, ({ current, body, who, at }) => {
      if (input.action === 'add') {
        if (!goodText(input.do, L.taskChars)) throw fail(400, 'CASE_BAD_TASK', '할 일은 200자 안으로 써 주세요.');
        if (body.tasks.length >= L.tasks) throw fail(409, 'CASE_BAD_TASK', '할 일은 30개까지 둘 수 있어요.');
        body.tasks.push({ id: randomUUID(), do: maskAsk(input.do), why: '', by: null, source: 'staff', done: false, note: '', doneAt: null, doneBy: null, removed: false, addedBy: who.user.id, addedAt: at });
        return current;
      }
      const item = body.tasks.find(t => t.id === input.taskId && !t.removed);
      if (!item) throw fail(404, 'CASE_BAD_TASK', '할 일을 찾지 못했어요. 새로 읽어 주세요.');
      if (input.action === 'remove') item.removed = true;
      else if (input.action === 'undone') Object.assign(item, { done: false, doneAt: null, doneBy: null });
      else {
        if (!(input.note === undefined || input.note === '' || goodText(input.note, L.taskNoteChars))) throw fail(400, 'CASE_BAD_TASK', '남길 말은 300자 안으로 써 주세요.');
        Object.assign(item, { done: true, doneAt: at, doneBy: who.user.id, note: input.note ? maskAsk(input.note) : '' });
      }
      return current;
    });
  }
  function close(actor, id, input) {
    if (!onlyKeys(input, ['revision'])) throw fail(400, 'CASE_BAD_REQUEST', '끝내기 요청을 확인해 주세요.');
    return mutate(actor, id, input, ({ current, at }) => {
      if (!open(current)) return current;
      return { ...current, status: 'closed', closedAt: at, closedBy: 'staff' };
    });
  }
  // 두 단계 지우기(문의 접수와 같다): 확인 번호는 이 사람 · 이 건 · 이 판에만 10분 동안 맞는다.
  const confirmation = (userId, row, until) => until + '.' + createHmac('sha256', confirmKey).update([userId, row.id, row.revision, until].join('\0')).digest('hex');
  function eraseCheck(actor, id, input) {
    const who = access(actor);
    if (who.role !== 'owner') throw fail(403, 'CASE_FORBIDDEN', '회사 주인만 지울 수 있어요.');
    const row = staffCase(who, id); checkRevision(row, input);
    const until = nowMs() + 10 * 60000;
    return { erasure: { id: row.id, revision: row.revision, expiresAt: new Date(until).toISOString(), token: confirmation(who.user.id, row, until) } };
  }
  function staffErase(actor, id, input) {
    const who = access(actor);
    if (who.role !== 'owner') throw fail(403, 'CASE_FORBIDDEN', '회사 주인만 지울 수 있어요.');
    if (typeof id === 'string' && store.get(K.tombstones, id.toLowerCase()) && !store.get(K.cases, id.toLowerCase())) return { erased: { id: id.toLowerCase(), repeated: true } };
    const row = staffCase(who, id); checkRevision(row, input);
    const match = typeof input.token === 'string' && /^(\d{13})\.[0-9a-f]{64}$/.exec(input.token);
    if (!match || Number(match[1]) <= nowMs() || !same(confirmation(who.user.id, row, Number(match[1])), input.token)) throw fail(409, 'CASE_ERASE_CONFIRM', '지우기 확인 시간이 지났거나 확인한 내용과 달라요. 「지우기 전에 확인」을 다시 눌러 주세요.');
    erase(row, 'staff');
    return { erased: { id: row.id, erasedAt: now() } };
  }
  function configure(actor, input) {
    const who = access(actor);
    if (who.role !== 'owner') throw fail(403, 'CASE_FORBIDDEN', '회사 주인만 바꿀 수 있어요.');
    if (!onlyKeys(input, ['defaultAssigneeId']) || !(input.defaultAssigneeId === null || (typeof input.defaultAssigneeId === 'string' && eligible(input.defaultAssigneeId)))) throw fail(400, 'CASE_ASSIGNEE', 'PATH 상담 담당이나 책임자를 골라 주세요.');
    store.put('settings', SETTINGS, { ...(store.get('settings', SETTINGS) || {}), defaultAssigneeId: input.defaultAssigneeId, updatedAt: now(), updatedBy: who.user.id });
    return { settings: { defaultAssigneeId: input.defaultAssigneeId } };
  }
  // 담당자가 한국어로 쓴 답을 학생 말로 옮긴 초안. 저장하지 않는다. 담당자가 보고 고친 뒤 답과 함께 보낸다.
  async function translateDraft(actor, id, input) {
    const who = access(actor), row = staffCase(who, id);
    if (!onlyKeys(input, ['text']) || !goodText(input.text, L.messageChars)) throw fail(400, 'CASE_BAD_MESSAGE', '답은 1,000자 안으로 써 주세요.');
    const lang = bodyOf(row).lang;
    if (lang === 'ko') return { text: null, lang };
    const out = translator ? await translator.translate([maskAsk(input.text)], { to: lang, from: 'ko' }) : null;
    access(actor); staffCase(who, id);
    return { text: out ? out[0] : null, lang };
  }

  /* ── 오늘 할 일 ── 할 일 글은 싣지 않는다. 「PATH 상담 할 일 · 기한 · 건 링크」만. */
  function today(actor) {
    const user = live(actor?.id), role = roleOf(user);
    if (!role) return [];
    const rows = [];
    for (const row of store.all(K.cases)) {
      if (!open(row) || row.hidden || assigneeOf(row) !== user.id) continue;
      const body = bodyOf(row), tasks = body.tasks.filter(t => !t.removed);
      const left = tasks.filter(t => !t.done);
      const base = { caseId: row.id, urgent: row.urgent === true, href: pathCaseHref(row.id) };
      if (left.length) for (const t of left) rows.push({ ...base, id: row.id + ':' + t.id, title: 'PATH 상담 할 일', date: t.by || body.deadline || '' });
      else if (tasks.length) rows.push({ ...base, id: row.id + ':close', title: 'PATH 상담 끝내기 확인', date: '' });
      else rows.push({ ...base, id: row.id + ':reply', title: row.urgent ? 'PATH 급함 상담' : 'PATH 상담 답하기', date: body.deadline || '' });
    }
    return rows.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || a.id.localeCompare(b.id)).slice(0, 50);
  }

  /* ── 번역(비동기) ── 학생 글 · 메모 · 급함 글을 한국어로. 실패하면 원문만 둔다. */
  const translationQueue = [];
  let translating = null;
  function queueTranslation(caseId, job) {
    if (!translator?.configured?.()) return;
    translationQueue.push({ caseId, ...job });
    if (!translating) translating = drainTranslations().finally(() => { translating = null; });
  }
  async function drainTranslations() {
    while (translationQueue.length) {
      const job = translationQueue.shift();
      try {
        const row = store.get(K.cases, job.caseId); if (!row) continue;
        const body = bodyOf(row); if (body.lang === 'ko') continue;
        const message = job.messageId ? body.messages.find(m => m.id === job.messageId) : null;
        const source = message ? message.text : body[job.field];
        if (!source) continue;
        const out = await translator.translate([source], { to: 'ko', from: body.lang });
        if (!out) continue;
        store.transaction(() => {
          const latest = store.get(K.cases, job.caseId); if (!latest) return;
          const next = bodyOf(latest), target = job.messageId ? next.messages.find(m => m.id === job.messageId) : null;
          const text = maskAsk(out[0]).slice(0, 4000);
          if (job.messageId) { if (!target || target.text !== source) return; target.textKo = text; } else { if (next[job.field] !== source) return; next[job.field + 'Ko'] = text; }
          if (Buffer.byteLength(JSON.stringify(next)) > L.caseBytes) return; // 원문과 번역을 함께 두되 1MB를 넘기지 않는다
          save(latest, next);
        });
        notify([assigneeOf(row)]);
      } catch { /* 번역은 덧붙임이다. 실패하면 원문만 보인다 */ }
    }
  }

  /* ── 보관 정리 ── */
  function maintain() {
    const at = now(), atMs = Date.parse(at), done = { closedIdle: 0, erased: 0, noticed: 0, tombstones: 0, reassigned: 0 };
    done.reassigned = reassignOrphans();
    for (const row of store.all(K.cases)) {
      if (open(row) && Date.parse(row.updatedAt) <= atMs - L.idleOpenDays * DAY) {
        store.transaction(() => { const latest = store.get(K.cases, row.id); if (latest && open(latest) && latest.updatedAt === row.updatedAt) store.put(K.cases, row.id, { ...latest, status: 'closed', closedAt: at, closedBy: 'idle', revision: latest.revision + 1 }); });
        done.closedIdle++;
      }
    }
    for (const row of store.all(K.cases)) {
      if (open(row) || !row.closedAt) continue;
      const age = atMs - Date.parse(row.closedAt);
      if (age >= L.closedKeepDays * DAY) { erase(row, 'retention'); done.erased++; }
      else if (age >= (L.closedKeepDays - L.noticeDays) * DAY && !row.retentionNoticeAt) { store.put(K.cases, row.id, { ...row, retentionNoticeAt: at }); done.noticed++; }
    }
    done.tombstones = store.removeWhere(K.tombstones, "json_extract(body,'$.erasedAt')<?", new Date(atMs - L.tombstoneDays * DAY).toISOString());
    store.removeWhere(K.views, "json_extract(body,'$.at')<?", new Date(atMs - L.viewDays * DAY).toISOString());
    store.removeWhere(K.intake, "json_extract(body,'$.at')<?", new Date(atMs - L.intakeDays * DAY).toISOString());
    store.removeWhere(K.nonces, "json_extract(body,'$.exp')<?", atMs - HOUR);
    store.removeWhere(K.alerts, "json_extract(body,'$.readAt') IS NOT NULL AND json_extract(body,'$.readAt')<?", new Date(atMs - L.alertDays * DAY).toISOString());
    return done;
  }

  /* ── 계정 정리(account-liveness) ── 하루 한 번. gone은 지우고, leaving은 숨기고, 모르거나 실패하면 그대로 둔다. */
  let livenessRun = null;
  function liveness(options = {}) { if (!livenessRun) livenessRun = runLiveness(options).finally(() => { livenessRun = null; }); return livenessRun; }
  async function runLiveness({ force = false } = {}) {
    const url = env.PATH_ACCOUNT_LIVENESS_URL, key = env.ACCOUNT_LIVENESS_KEY, state = store.get('settings', STATE) || {};
    const anonKey = [env.SYNK_TALK_ANON_KEY, env.SYNK_ID_CUSTOMER_PUBLISHABLE_KEY].find(value => typeof value === 'string' && /^\S{16,4096}$/.test(value)) || null;
    if (typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url) || typeof key !== 'string' || key.length < 32) return { skipped: 'not-configured' };
    const atMs = nowMs();
    if (!force && state.livenessAt && atMs - Date.parse(state.livenessAt) < L.livenessEveryMs) return { skipped: 'not-due' };
    const ids = [...new Set(store.all(K.cases).filter(row => !row.lastStudentCheckAt || Date.parse(row.lastStudentCheckAt) <= atMs - L.livenessStaleMs).map(row => row.synkUserId))]
      .slice(0, L.livenessBatch * L.livenessBatches);
    const finish = patch => store.put('settings', STATE, { ...(store.get('settings', STATE) || {}), livenessAt: new Date(atMs).toISOString(), ...patch });
    if (!ids.length) { finish({ livenessStatus: 'ok', livenessAsked: 0, livenessGone: 0 }); return { asked: 0, gone: 0, leaving: 0, present: 0 }; }
    const results = {};
    for (let i = 0; i < ids.length; i += L.livenessBatch) {
      const batch = ids.slice(i, i + L.livenessBatch), body = JSON.stringify({ action: 'account-liveness', ids: batch }), time = String(nowMs());
      const signature = createHmac('sha256', key).update(['path-liveness.v1', time, sha256hex(body)].join('\u001F')).digest('base64url');
      let data;
      try {
        const response = await fetchImpl(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), body,
          headers: { 'Content-Type': 'application/json', 'X-Synk-Liveness-Time': time, 'X-Synk-Liveness-Signature': signature,
            // Supabase Edge 관문은 authorization이 있는 요청만 넘긴다. 공개(anon · publishable) 키만 싣고 서버 키는 쓰지 않는다.
            ...(anonKey ? { apikey: anonKey, Authorization: 'Bearer ' + anonKey } : {}) } });
        if (!response.ok) throw new Error('liveness ' + response.status);
        data = await response.json();
      } catch {
        finish({ livenessStatus: 'failed' });
        return { failed: true, asked: ids.length };
      }
      if (!plain(data?.results)) { finish({ livenessStatus: 'failed' }); return { failed: true, asked: ids.length }; }
      for (const id of batch) if (['present', 'leaving', 'gone'].includes(data.results[id])) results[id] = data.results[id];
    }
    const gone = ids.filter(id => results[id] === 'gone');
    // 한 번에 gone이 3건 이상이거나 물은 계정의 20%를 넘으면 아무것도 바꾸지 않고 멈춘 뒤 관리자에게 알린다.
    if (gone.length >= L.goneStopCount || gone.length > ids.length * L.goneStopShare) {
      finish({ livenessStatus: 'stopped', livenessAsked: ids.length, livenessGone: gone.length });
      try { ownerAlert(`PATH 상담 계정 정리를 멈췄어요. 계정을 지운 학생이 한 번에 ${gone.length}명(물은 ${ids.length}명 가운데)으로 보여 상담을 지우지 않았어요. 중앙 계정 상태를 확인해 주세요.`); } catch { /* 상태 줄에 남아 있다 */ }
      return { stopped: true, asked: ids.length, gone: gone.length };
    }
    const at = new Date(nowMs()).toISOString();
    let leaving = 0, present = 0;
    for (const row of store.all(K.cases)) {
      const answer = results[row.synkUserId];
      if (answer === 'gone') erase(row, 'account-gone');
      else if (answer === 'leaving') { if (!row.hidden) { store.put(K.cases, row.id, { ...row, hidden: true }); leaving++; } }
      else if (answer === 'present') { store.put(K.cases, row.id, { ...row, hidden: false, lastStudentCheckAt: at }); present++; }
    }
    finish({ livenessStatus: 'ok', livenessAsked: ids.length, livenessGone: gone.length });
    return { asked: ids.length, gone: gone.length, leaving, present };
  }

  return {
    status, studentList, studentCreate, studentMessage, studentRead, studentDelete,
    list, detail, assign, reply, task, close, eraseCheck, erase: staffErase, configure, translateDraft,
    today, notifications, readAlert, readAllAlerts, owns: id => typeof id === 'string' && id.startsWith(ALERT_PREFIX),
    maintain, liveness, roleOf: user => roleOf(live(user?.id)),
    waitForIdle: async () => { while (translating) await translating; await livenessRun; },
  };
}
export const PATH_CASE_NOTE_MAX = MAX_NOTE_CHARS;
