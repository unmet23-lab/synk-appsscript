import { randomUUID } from 'node:crypto';

const STAGES = ['requested', 'accepted', 'doing', 'review', 'changes', 'done'];
const statusFor = stage => stage === 'done' ? 'done' : ['doing', 'review', 'changes'].includes(stage) ? 'doing' : 'todo';
const legacyStage = status => ({ todo: 'requested', doing: 'doing', done: 'done' })[status];

// Events contain references and workflow changes, never a second copy of chat text.
export function createProductivityService({ db, assert, textField, now, transaction, activeUser, accessible, channelMembers, requireChannel, requireMessage, requirePosting, messageShape, publish, notify, mode, kstDate, paged, backgroundJobsEnabled = true, workNotificationsEnabled = backgroundJobsEnabled }) {
  assert(typeof workNotificationsEnabled === 'boolean', 400, '업무 알림 설정은 boolean이어야 합니다.');
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const columns = new Set(all('PRAGMA table_info(message_tasks)').map(row => row.name));
  for (const [name, type] of [['stage', "TEXT NOT NULL DEFAULT 'requested'"], ['reviewer_id', 'TEXT REFERENCES users(id)'], ['result_message_id', 'INTEGER REFERENCES messages(id) ON DELETE SET NULL']]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE message_tasks ADD COLUMN ${name} ${type}`);
  }
  if (!columns.has('stage')) db.exec("UPDATE message_tasks SET stage=CASE status WHEN 'doing' THEN 'doing' WHEN 'done' THEN 'done' ELSE 'requested' END");
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_decisions (
      id TEXT PRIMARY KEY,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,effective_date TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('decision','final')),
      result_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      creator_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
      replaces_id TEXT UNIQUE REFERENCES message_decisions(id) ON DELETE SET NULL,request_id TEXT,
      superseded_by_id TEXT,UNIQUE(creator_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS productivity_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,task_id TEXT REFERENCES message_tasks(id) ON DELETE CASCADE,
      decision_id TEXT REFERENCES message_decisions(id) ON DELETE CASCADE,changes TEXT NOT NULL,created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS productivity_reads (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,sequence INTEGER NOT NULL DEFAULT 0,
      offered_sequence INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS due_digest_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      include_weekends INTEGER NOT NULL DEFAULT 0 CHECK(include_weekends IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS due_digests (
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kst_date TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,kst_date)
    );
    CREATE TABLE IF NOT EXISTS due_digest_tasks (
      digest_id TEXT NOT NULL REFERENCES due_digests(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES message_tasks(id) ON DELETE CASCADE,PRIMARY KEY(digest_id,task_id)
    );
  `);
  if (!all('PRAGMA table_info(message_decisions)').some(row => row.name === 'superseded_by_id')) db.exec('ALTER TABLE message_decisions ADD COLUMN superseded_by_id TEXT');
  function isOwner(userId) { const person = activeUser(userId); return person?.role === 'owner' || person?.companyRole === 'admin'; }
  function canPost(userId, channelId) {
    if (!activeUser(userId)) return false;
    try { requirePosting(userId, channelId); return true; } catch { return false; }
  }
  function reviewerUnavailable(row) {
    if (!row.reviewer_id) return false;
    const channelId = one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id;
    return !canPost(row.reviewer_id, channelId);
  }
  function canReassignReviewer(row, userId) {
    const channelId = one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id;
    return row.stage === 'review' && reviewerUnavailable(row) && row.assignee_id !== userId && (row.creator_id === userId || isOwner(userId)) && canPost(userId, channelId);
  }
  function canManageTask(row, userId) {
    try { requirePosting(userId, one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id); } catch { return false; }
    return [row.creator_id, row.assignee_id, row.reviewer_id].includes(userId) || isOwner(userId);
  }
  function allowedStages(row, userId) {
    if (!canManageTask(row, userId)) return [];
    const assignee = row.assignee_id === userId, reviewer = row.reviewer_id === userId;
    if (row.stage === 'requested') return assignee ? ['accepted'] : [];
    if (row.stage === 'accepted') return assignee ? ['doing', ...(!row.reviewer_id ? ['done'] : [])] : [];
    if (['doing', 'changes'].includes(row.stage)) return assignee ? ['review', ...(!row.reviewer_id ? ['done'] : [])] : [];
    if (row.stage === 'review') return reviewer ? ['changes', 'done'] : [];
    return assignee || row.creator_id === userId ? ['doing'] : [];
  }
  function taskShape(row, userId, withMessage = false) {
    if (!row) return null;
    const message = one('SELECT * FROM messages WHERE id=?', row.message_id);
    if (!message || !accessible(userId, message.channel_id)) return null;
    const result = row.result_message_id && one('SELECT * FROM messages WHERE id=? AND channel_id=?', row.result_message_id, message.channel_id);
    return { id: row.id, messageId: String(row.message_id), channelId: message.channel_id, title: row.title,
      assignee: activeUser(row.assignee_id), reviewer: activeUser(row.reviewer_id), reviewerId: row.reviewer_id,
      reviewerUnavailable: reviewerUnavailable(row), canReassignReviewer: canReassignReviewer(row, userId), dueDate: row.due_date,
      status: row.status, stage: row.stage, revision: row.revision, resultMessageId: result ? String(result.id) : null,
      resultMessage: result ? { id: String(result.id), channelId: result.channel_id, body: result.body, user: activeUser(result.user_id), createdAt: result.created_at } : null,
      createdBy: activeUser(row.creator_id), createdAt: row.created_at, updatedAt: row.updated_at,
      canManage: canManageTask(row, userId), allowedStages: allowedStages(row, userId),
      ...(withMessage ? { message: messageShape(message, userId) } : {}) };
  }
  function event(message, userId, kind, { taskId = null, decisionId = null, changes = {} } = {}) {
    run('INSERT INTO productivity_events(message_id,actor_id,kind,task_id,decision_id,changes,created_at) VALUES(?,?,?,?,?,?,?)', message.id, userId, kind, taskId, decisionId, JSON.stringify(changes), now());
  }
  function upsertTask({ messageId, userId, body, method = 'PATCH' }) {
    const message = requireMessage(String(messageId), userId), channel = requirePosting(userId, message.channel_id);
    const prior = one('SELECT * FROM message_tasks WHERE message_id=?', message.id);
    assert(method !== 'PATCH' || prior, 404, '업무를 찾을 수 없습니다.');
    assert(!prior || canManageTask(prior, userId), 403, '업무를 만든 크루, 담당자, 검토자, 관리자만 변경할 수 있습니다.');
    assert(body.reassignReviewer === undefined || typeof body.reassignReviewer === 'boolean', 400, '검토자 재배정 요청을 확인해 주세요.');
    const recovery = body.reassignReviewer === true;
    if (prior && (body.stage !== undefined || prior.reviewer_id || body.revision !== undefined || body.reviewerId !== undefined || body.resultMessageId !== undefined)) {
      assert(Number.isInteger(body.revision) && body.revision === prior.revision, 409, '다른 크루가 업무를 변경했습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.');
    }
    assert(!recovery || (prior && canReassignReviewer(prior, userId)), 403, '검토자가 참여할 수 없을 때 담당자 본인을 제외한 요청자나 관리자만 재배정할 수 있습니다.');
    const assigneeId = body.assigneeId ?? prior?.assignee_id;
    const eligible = channelMembers(channel.id).filter(person => canPost(person.id, channel.id));
    assert(typeof assigneeId === 'string' && eligible.some(person => person.id === assigneeId), 400, '이 대화방의 업무를 맡을 크루를 선택해 주세요.');
    const reviewerId = body.reviewerId === undefined ? prior?.reviewer_id ?? null : body.reviewerId;
    assert(reviewerId === null || (typeof reviewerId === 'string' && eligible.some(person => person.id === reviewerId)), 400, '이 대화방의 검토자를 선택해 주세요.');
    assert(reviewerId === null || reviewerId !== assigneeId, 400, '담당자와 검토자는 다른 크루로 선택해 주세요.');
    const title = textField(body.title ?? prior?.title ?? (message.body.slice(0, 120) || '공유 메시지 확인'), '업무 제목', 200, 1);
    const dueDate = body.dueDate === undefined ? prior?.due_date ?? null : body.dueDate;
    if (dueDate !== null) kstDate(dueDate, '마감일');
    if (body.status !== undefined) assert(['todo', 'doing', 'done'].includes(body.status), 400, '업무 상태를 확인해 주세요.');
    const stage = body.stage ?? (body.status !== undefined ? legacyStage(body.status) : prior?.stage ?? 'requested');
    assert(STAGES.includes(stage), 400, '업무 단계를 확인해 주세요.');
    assert(body.stage === undefined || body.status === undefined || body.status === statusFor(stage), 400, '업무 상태와 단계가 서로 다릅니다.');
    assert(prior || stage === 'requested' || (body.stage === undefined && !reviewerId), 400, '새 업무는 요청 단계에서 시작합니다.');
    const resultMessageId = body.resultMessageId === undefined ? prior?.result_message_id ?? null : body.resultMessageId;
    let result = null;
    if (resultMessageId !== null) {
      assert(/^[1-9]\d*$/.test(String(resultMessageId)), 400, '결과물 메시지를 선택해 주세요.');
      result = requireMessage(String(resultMessageId), userId);
      assert(result.channel_id === channel.id, 400, '결과물은 같은 대화방의 메시지로 연결해 주세요.');
    }
    if (prior) {
      if (recovery) {
        assert(typeof reviewerId === 'string' && reviewerId !== prior.reviewer_id, 400, '다시 검토할 새 크루를 선택해 주세요.');
        assert(prior.assignee_id === assigneeId && prior.title === title && prior.due_date === dueDate && prior.stage === stage && (prior.result_message_id ?? null) === (result?.id ?? null), 409, '검토자 재배정은 담당자·결과물·기한·업무 단계를 유지한 채 진행해 주세요.');
      }
      const metadataChanged = prior.assignee_id !== assigneeId || prior.reviewer_id !== reviewerId || prior.title !== title || prior.due_date !== dueDate;
      assert(!metadataChanged || [prior.creator_id, prior.assignee_id].includes(userId) || isOwner(userId), 403, '검토자는 검토 결과만 변경할 수 있습니다.');
      // Reviewers cannot be removed by the assignee to bypass required approval.
      assert(prior.reviewer_id === reviewerId || !prior.reviewer_id || ((prior.creator_id === userId || isOwner(userId)) && prior.assignee_id !== userId), 403, '지정된 검토자 변경은 담당자 본인을 제외한 업무 요청자나 관리자만 할 수 있습니다.');
      const resultChanged = (prior.result_message_id ?? null) !== (result?.id ?? null);
      assert(!resultChanged || prior.assignee_id === userId, 403, '결과물 제출은 업무 담당자만 할 수 있습니다.');
      assert(prior.stage !== 'done' || stage !== 'done' || (!resultChanged && prior.reviewer_id === reviewerId && prior.assignee_id === assigneeId), 409, '완료한 업무의 담당자·검토자·결과물은 다시 작업을 시작한 뒤 변경해 주세요.');
      assert(prior.stage !== 'review' || recovery || (prior.assignee_id === assigneeId && prior.reviewer_id === reviewerId && (prior.result_message_id ?? null) === (result?.id ?? null)), 409, '검토 중인 담당자와 결과물은 수정 요청 후 변경해 주세요.');
      if (stage !== prior.stage) {
        const legacy = body.stage === undefined && body.status !== undefined && !prior.reviewer_id && !reviewerId;
        assert(allowedStages({ ...prior, reviewer_id: reviewerId }, userId).includes(stage) || (legacy && [prior.creator_id, prior.assignee_id].includes(userId)) || (legacy && isOwner(userId)), 403, '현재 단계에서 이 변경을 할 수 없습니다.');
      }
    }
    if (stage === 'review') assert(reviewerId && result, 400, '검토자와 결과물 메시지를 모두 연결해 주세요.');
    if (prior?.stage === 'review' && stage === 'done') assert(result, 400, '결과물 메시지가 삭제되었습니다. 수정 요청 후 다시 연결해 주세요.');
    const normalizedResult = result?.id ?? null;
    const changed = !prior || prior.title !== title || prior.assignee_id !== assigneeId || prior.reviewer_id !== reviewerId || prior.due_date !== dueDate || prior.stage !== stage || (prior.result_message_id ?? null) !== normalizedResult;
    if (!changed) return { task: taskShape(prior, userId), created: false };
    const notifications = [];
    transaction(() => {
      if (prior) {
        const updated = run('UPDATE message_tasks SET assignee_id=?,reviewer_id=?,title=?,due_date=?,status=?,stage=?,result_message_id=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?', assigneeId, reviewerId, title, dueDate, statusFor(stage), stage, normalizedResult, now(), prior.id, prior.revision);
        assert(updated.changes === 1, 409, '업무가 변경되었습니다. 다시 불러와 주세요.');
      } else run('INSERT INTO message_tasks(id,message_id,assignee_id,reviewer_id,creator_id,title,due_date,status,stage,result_message_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', randomUUID(), message.id, assigneeId, reviewerId, userId, title, dueDate, statusFor(stage), stage, normalizedResult, now(), now());
      const task = one('SELECT * FROM message_tasks WHERE message_id=?', message.id);
      if (!prior) event(message, userId, 'task_created', { taskId: task.id, changes: { from: null, to: stage } });
      else {
        if (prior.stage !== stage) event(message, userId, 'task_stage', { taskId: task.id, changes: { from: prior.stage, to: stage } });
        if (prior.due_date !== dueDate) event(message, userId, 'task_due', { taskId: task.id, changes: { from: prior.due_date, to: dueDate } });
        if (recovery) event(message, userId, 'task_reviewer_reassigned', { taskId: task.id, changes: { from: prior.reviewer_id, to: reviewerId, reason: 'reviewer_unavailable' } });
        else if (prior.assignee_id !== assigneeId || prior.reviewer_id !== reviewerId) event(message, userId, 'task_assignment', { taskId: task.id, changes: { from: { assigneeId: prior.assignee_id, reviewerId: prior.reviewer_id }, to: { assigneeId, reviewerId } } });
        if (prior.title !== title || (prior.result_message_id ?? null) !== normalizedResult) event(message, userId, 'task_updated', { taskId: task.id });
      }
      for (const personId of new Set([assigneeId, reviewerId, prior?.assignee_id, prior?.reviewer_id, task.creator_id].filter(Boolean))) {
        if (personId !== userId && mode(personId, channel.id) !== 'mute' && notify(personId, message, 'task', `task:${task.id}:${task.revision}:${personId}`)) notifications.push(personId);
      }
    });
    publish('message', channel.id);
    for (const personId of notifications) publish('notification', channel.id, personId);
    return { task: taskShape(one('SELECT * FROM message_tasks WHERE message_id=?', message.id), userId), created: !prior };
  }
  function workday(userId) {
    const date = new Date(Date.parse(now()) + 9 * 3600000).toISOString().slice(0, 10);
    const rows = all('SELECT t.*,m.channel_id FROM message_tasks t JOIN messages m ON m.id=t.message_id WHERE t.status<>? ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,t.due_date,t.updated_at DESC', 'done').filter(row => accessible(userId, row.channel_id));
    const groups = {
      reply: rows.filter(row => row.assignee_id === userId && ['requested', 'changes'].includes(row.stage)),
      due: rows.filter(row => row.assignee_id === userId && row.due_date && row.due_date <= date),
      review: rows.filter(row => row.reviewer_id === userId && row.stage === 'review'),
      waiting: rows.filter(row => (row.creator_id === userId && row.assignee_id !== userId) || (row.assignee_id === userId && row.stage === 'review')),
    };
    const total = new Set(Object.values(groups).flat().map(row => row.id)).size;
    return { date, groups: Object.fromEntries(Object.entries(groups).map(([key, list]) => [key, list.map(row => taskShape(row, userId, true))])), counts: Object.fromEntries(Object.entries(groups).map(([key, list]) => [key, list.length])), total };
  }
  function digestPreferences(userId) {
    const row = one('SELECT * FROM due_digest_preferences WHERE user_id=?', userId);
    return { enabled: row ? Boolean(row.enabled) : true, includeWeekends: Boolean(row?.include_weekends), schedulerEnabled: workNotificationsEnabled };
  }
  function kstClock() {
    const clock = new Date(Date.parse(now()) + 9 * 3600000);
    return { date: clock.toISOString().slice(0, 10), hour: clock.getUTCHours(), weekday: clock.getUTCDay() };
  }
  function dueCandidates(userId, date, digestId = null) {
    const rows = digestId
      ? all('SELECT t.*,m.channel_id FROM due_digest_tasks d JOIN message_tasks t ON t.id=d.task_id JOIN messages m ON m.id=t.message_id WHERE d.digest_id=? AND t.assignee_id=? AND t.status<>? AND t.due_date<=? ORDER BY t.due_date,t.created_at,t.id', digestId, userId, 'done', date)
      : all('SELECT t.*,m.channel_id FROM message_tasks t JOIN messages m ON m.id=t.message_id WHERE t.assignee_id=? AND t.status<>? AND t.due_date<=? ORDER BY t.due_date,t.created_at,t.id', userId, 'done', date);
    return rows.filter(row => accessible(userId, row.channel_id) && canPost(userId, row.channel_id) && mode(userId, row.channel_id) !== 'mute');
  }
  function deliverDueDigests() {
    if (!workNotificationsEnabled) return;
    const { date, hour, weekday } = kstClock();
    if (hour < 9) return;
    const recipients = all('SELECT DISTINCT assignee_id FROM message_tasks WHERE status<>? AND due_date<=?', 'done', date), changed = [];
    transaction(() => {
      for (const { assignee_id: userId } of recipients) {
        const preferences = digestPreferences(userId);
        if (!preferences.enabled || (!preferences.includeWeekends && [0, 6].includes(weekday))) continue;
        const tasks = dueCandidates(userId, date);
        if (!tasks.length) continue;
        const id = `due:${randomUUID()}`;
        const inserted = run('INSERT OR IGNORE INTO due_digests(id,user_id,kst_date,created_at) VALUES(?,?,?,?)', id, userId, date, now());
        if (!inserted.changes) continue;
        for (const task of tasks) run('INSERT INTO due_digest_tasks(digest_id,task_id) VALUES(?,?)', id, task.id);
        changed.push(userId);
      }
    });
    for (const userId of changed) publish('notification', null, userId);
  }
  function dueNotifications(userId) {
    if (!activeUser(userId) || !digestPreferences(userId).enabled) return [];
    // Older daily digests remain durable for deduplication, but never become a
    // backlog of identical overdue reminders after several days away.
    const row = one('SELECT * FROM due_digests WHERE user_id=? ORDER BY kst_date DESC LIMIT 1', userId);
    if (!row) return [];
    const { date } = kstClock(), tasks = dueCandidates(userId, date, row.id);
    if (!tasks.length) return [];
    return [{ id: row.id, kind: 'due_digest', message: null, createdAt: row.created_at, readAt: row.read_at,
      digest: { date: row.kst_date, taskCount: tasks.length, overdueCount: tasks.filter(task => task.due_date < date).length, tasks: tasks.map(task => taskShape(task, userId, true)) } }];
  }
  function readDueNotification(userId, id) {
    run('UPDATE due_digests SET read_at=COALESCE(read_at,?) WHERE user_id=? AND id=?', now(), userId, id);
  }
  function decisionShape(row, userId) {
    if (!row) return null;
    const message = one('SELECT * FROM messages WHERE id=?', row.message_id);
    if (!message || !accessible(userId, message.channel_id)) return null;
    const result = row.result_message_id && one('SELECT * FROM messages WHERE id=? AND channel_id=?', row.result_message_id, message.channel_id);
    return { id: row.id, messageId: String(row.message_id), channelId: message.channel_id, summary: row.summary, effectiveDate: row.effective_date, kind: row.kind,
      resultMessageId: result ? String(result.id) : null, resultMessage: result ? messageShape(result, userId) : null,
      confirmedBy: activeUser(row.creator_id), confirmedAt: row.created_at, replacesId: row.replaces_id, replacedById: row.superseded_by_id ?? null, isCurrent: !row.superseded_by_id,
      message: messageShape(message, userId) };
  }
  function createDecision(userId, body) {
    const message = requireMessage(String(body.messageId), userId);
    requirePosting(userId, message.channel_id);
    const summary = textField(body.summary, '확정 내용', 2000, 1), kind = body.kind ?? 'decision';
    assert(['decision', 'final'].includes(kind), 400, '기록 종류를 확인해 주세요.');
    const effectiveDate = kstDate(body.effectiveDate, '적용일');
    const requestId = body.requestId === undefined ? null : textField(body.requestId, '요청 식별자', 100, 1);
    let result = null;
    if (body.resultMessageId !== undefined && body.resultMessageId !== null) {
      result = requireMessage(String(body.resultMessageId), userId);
      assert(result.channel_id === message.channel_id, 400, '최종본은 같은 대화방의 메시지로 연결해 주세요.');
    }
    assert(kind !== 'final' || result, 400, '최종본 메시지를 연결해 주세요.');
    const prior = body.replacesId ? one('SELECT * FROM message_decisions WHERE id=?', body.replacesId) : null;
    if (body.replacesId) {
      assert(prior && decisionShape(prior, userId), 404, '이전 결정을 찾을 수 없습니다.');
      assert(prior.creator_id === userId || isOwner(userId), 403, '이전 결정을 확정한 크루나 관리자만 대체할 수 있습니다.');
      const source = requireMessage(String(prior.message_id), userId);
      assert(source.channel_id === message.channel_id && prior.kind === kind, 400, '같은 대화방과 종류의 기록만 대체할 수 있습니다.');
    }
    const duplicate = requestId ? one('SELECT * FROM message_decisions WHERE creator_id=? AND request_id=?', userId, requestId) : one('SELECT * FROM message_decisions WHERE creator_id=? AND message_id=? AND summary=? AND effective_date=? AND kind=? AND result_message_id IS ? AND replaces_id IS ?', userId, message.id, summary, effectiveDate, kind, result?.id ?? null, prior?.id ?? null);
    if (duplicate) {
      assert(duplicate.message_id === message.id && duplicate.summary === summary && duplicate.effective_date === effectiveDate && duplicate.kind === kind && duplicate.result_message_id === (result?.id ?? null) && duplicate.replaces_id === (prior?.id ?? null), 409, '이미 사용된 요청 식별자입니다. 새 기록으로 다시 요청해 주세요.');
      return { decision: decisionShape(duplicate, userId), created: false };
    }
    assert(!prior || !prior.superseded_by_id, 409, '이미 바뀐 결정입니다. 최신 결정을 확인해 주세요.');
    const id = randomUUID();
    transaction(() => {
      run('INSERT INTO message_decisions(id,message_id,summary,effective_date,kind,result_message_id,creator_id,created_at,replaces_id,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)', id, message.id, summary, effectiveDate, kind, result?.id ?? null, userId, now(), prior?.id ?? null, requestId);
      if (prior) run('UPDATE message_decisions SET superseded_by_id=? WHERE id=?', id, prior.id);
      event(message, userId, prior ? 'decision_replaced' : 'decision', { decisionId: id, changes: { from: prior?.id ?? null, to: id } });
    });
    publish('message', message.channel_id);
    return { decision: decisionShape(one('SELECT * FROM message_decisions WHERE id=?', id), userId), created: true };
  }
  function catchUp(userId, { since, limit = 100 } = {}) {
    const read = one('SELECT * FROM productivity_reads WHERE user_id=?', userId);
    const start = since ?? read?.sequence ?? 0;
    assert(Number.isSafeInteger(start) && start >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '변경 목록의 위치와 개수를 확인해 주세요.');
    const visible = all('SELECT e.*,m.channel_id FROM productivity_events e JOIN messages m ON m.id=e.message_id WHERE e.sequence>? ORDER BY e.sequence', start).filter(row => accessible(userId, row.channel_id));
    const page = visible.slice(0, limit), through = page.at(-1)?.sequence ?? start;
    return { since: start, through, hasMore: visible.length > limit, events: page.map(row => ({ sequence: row.sequence, kind: row.kind, createdAt: row.created_at, actor: activeUser(row.actor_id),
      message: messageShape(requireMessage(String(row.message_id), userId), userId),
      ...(row.task_id ? { task: taskShape(one('SELECT * FROM message_tasks WHERE id=?', row.task_id), userId) } : {}),
      ...(row.decision_id ? { decision: decisionShape(one('SELECT * FROM message_decisions WHERE id=?', row.decision_id), userId) } : {}), changes: JSON.parse(row.changes) })) };
  }
  function decisions(userId, query = new URLSearchParams()) {
    const channelId = query.get('channelId'), q = textField(query.get('q') || '', '검색어', 200), kind = query.get('kind'), current = query.get('current') ?? '1';
    if (channelId) requireChannel(userId, channelId);
    assert((!kind || ['decision', 'final'].includes(kind)) && ['0', '1'].includes(current), 400, '결정 검색 조건을 확인해 주세요.');
    const rows = all('SELECT d.*,m.channel_id FROM message_decisions d JOIN messages m ON m.id=d.message_id ORDER BY d.created_at DESC,d.id DESC').filter(row => accessible(userId, row.channel_id) && (!channelId || row.channel_id === channelId) && (!kind || row.kind === kind) && (!q || row.summary.toLocaleLowerCase().includes(q.toLocaleLowerCase())) && (current === '0' || !row.superseded_by_id));
    return paged(rows, query, 'decisions', row => decisionShape(row, userId));
  }
  function assertMessageMutable(messageId) {
    assert(!one("SELECT 1 FROM message_tasks WHERE result_message_id=? AND stage IN ('review','done')", messageId), 409, '검토 중이거나 완료된 결과물입니다. 수정 요청 또는 작업 재개 후 수정·삭제해 주세요.');
    assert(!one("SELECT 1 FROM message_decisions WHERE result_message_id=? AND kind='final' AND superseded_by_id IS NULL", messageId), 409, '현재 최종본으로 확정된 결과물입니다. 새 결과물을 올리고 최종본 기록을 대체한 뒤 수정·삭제해 주세요.');
  }
  async function handle({ p, method, url, user, readBody, respond }) {
    if (p === '/api/workday/notifications' && ['GET', 'PATCH'].includes(method)) {
      if (method === 'PATCH') {
        const body = await readBody(), prior = digestPreferences(user.id);
        assert(body.enabled === undefined || typeof body.enabled === 'boolean', 400, '마감 알림 설정을 확인해 주세요.');
        assert(body.includeWeekends === undefined || typeof body.includeWeekends === 'boolean', 400, '주말 알림 설정을 확인해 주세요.');
        const enabled = body.enabled ?? prior.enabled, includeWeekends = body.includeWeekends ?? prior.includeWeekends;
        if (enabled && !workNotificationsEnabled) {
          const message = '현재 업무 알림이 중지되어 있어 마감 알림을 켤 수 없습니다. 회사 관리자에게 문의해 주세요.';
          throw Object.assign(new Error(message), { status: 503, publicMessage: message, code: 'SYNK_WORK_NOTIFICATIONS_PAUSED' });
        }
        run('INSERT INTO due_digest_preferences(user_id,enabled,include_weekends) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,include_weekends=excluded.include_weekends', user.id, enabled ? 1 : 0, includeWeekends ? 1 : 0);
        publish('notification', null, user.id);
      }
      respond(200, digestPreferences(user.id)); return true;
    }
    if (method === 'GET' && p === '/api/workday') { respond(200, workday(user.id)); return true; }
    if (method === 'GET' && p === '/api/catch-up') {
      respond(200, catchUp(user.id, { since: url.searchParams.has('since') ? Number(url.searchParams.get('since')) : undefined, limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 100 })); return true;
    }
    if (method === 'POST' && p === '/api/catch-up/read') {
      const body = await readBody(), prior = one('SELECT * FROM productivity_reads WHERE user_id=?', user.id);
      const target = Number.isSafeInteger(body.through) ? one('SELECT e.sequence,m.channel_id FROM productivity_events e JOIN messages m ON m.id=e.message_id WHERE e.sequence=?', body.through) : null;
      assert(Number.isSafeInteger(body.through) && body.through >= 0 && (body.through <= (prior?.sequence ?? 0) || (target && accessible(user.id, target.channel_id))), 400, '확인한 변경 목록의 위치를 다시 불러와 주세요.');
      run('INSERT INTO productivity_reads(user_id,sequence,offered_sequence,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET sequence=MAX(sequence,excluded.sequence),updated_at=excluded.updated_at', user.id, body.through, body.through, now());
      publish('notification', null, user.id); respond(200, { through: one('SELECT sequence FROM productivity_reads WHERE user_id=?', user.id).sequence }); return true;
    }
    if (p === '/api/decisions' && method === 'POST') {
      const result = createDecision(user.id, await readBody()); respond(result.created ? 201 : 200, { decision: result.decision }); return true;
    }
    if (p === '/api/decisions' && method === 'GET') {
      respond(200, decisions(user.id, url.searchParams)); return true;
    }
    const match = p.match(/^\/api\/decisions\/([^/]+)$/);
    if (match && method === 'GET') { const decision = decisionShape(one('SELECT * FROM message_decisions WHERE id=?', match[1]), user.id); assert(decision, 404, '결정을 찾을 수 없습니다.'); respond(200, { decision }); return true; }
    return false;
  }
  return { taskShape, canManageTask, upsertTask, getTask: (messageId, userId) => taskShape(one('SELECT * FROM message_tasks WHERE message_id=?', messageId), userId), workday, catchUp, decisions, createDecision, assertMessageMutable, deliverDueDigests, dueNotifications, readDueNotification, digestPreferences, handle };
}
