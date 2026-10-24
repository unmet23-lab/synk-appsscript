import { validateTaskTransition } from './task-transition.mjs';
import { randomUUID } from 'node:crypto';

const STAGES = ['requested', 'accepted', 'doing', 'review', 'changes', 'done'];
const statusFor = stage => stage === 'done' ? 'done' : ['doing', 'review', 'changes'].includes(stage) ? 'doing' : 'todo';
const legacyStage = status => ({ todo: 'requested', doing: 'doing', done: 'done' })[status];
const workdayDateFor = timestamp => new Date(Date.parse(timestamp) + 9 * 3600000).toISOString().slice(0, 10);

// Events contain references and workflow changes, never a second copy of chat text.
export function createProductivityService({ db, unitOfWork, assert, textField, now, transaction, activeUser, accessible, channelMembers, requireChannel, requireMessage, requirePosting, messageShape, publish, notify, mode, kstDate, paged, backgroundJobsEnabled = true, workNotificationsEnabled = backgroundJobsEnabled }) {
  assert(typeof workNotificationsEnabled === 'boolean', 400, '업무 알림 설정은 boolean이어야 합니다.');
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
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
  function assigneeUnavailable(row) {
    const channelId = one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id;
    return !canPost(row.assignee_id, channelId);
  }
  function canReassignReviewer(row, userId) {
    const channelId = one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id;
    return STAGES.includes(row.stage) && row.stage !== 'done' && reviewerUnavailable(row) && !assigneeUnavailable(row) && row.assignee_id !== userId && (row.creator_id === userId || isOwner(userId)) && canPost(userId, channelId);
  }
  function canManageTask(row, userId) {
    try { requirePosting(userId, one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id); } catch { return false; }
    return [row.creator_id, row.assignee_id, row.reviewer_id].includes(userId) || isOwner(userId);
  }
  function allowedStages(row, userId) {
    if (!canManageTask(row, userId)) return [];
    if (reviewerUnavailable(row) || assigneeUnavailable(row)) return [];
    const assignee = row.assignee_id === userId, reviewer = row.reviewer_id === userId;
    if (row.stage === 'requested') return assignee ? ['accepted'] : [];
    if (row.stage === 'accepted') return assignee ? ['doing', ...(!row.reviewer_id ? ['done'] : [])] : [];
    if (['doing', 'changes'].includes(row.stage)) return assignee ? ['review', ...(!row.reviewer_id ? ['done'] : [])] : [];
    if (row.stage === 'review') return reviewer ? ['changes', 'done'] : [];
    return assignee || row.creator_id === userId ? ['doing'] : [];
  }
  function taskWorkday(row, userId, date) {
    const todayReasons = [], remainingReasons = [];
    if (row.status === 'done' || row.stage === 'done') return { date, todayReasons, remainingReasons };
    const assigned = row.assignee_id === userId;
    const assignedWork = assigned && ['accepted', 'doing'].includes(row.stage);
    if (assigned && ['requested', 'changes'].includes(row.stage)) todayReasons.push('reply');
    if (assignedWork && row.due_date && row.due_date <= date) todayReasons.push('due');
    if (row.reviewer_id === userId && row.stage === 'review') todayReasons.push('review');
    if (canReassignReviewer(row, userId)) todayReasons.push('recovery');
    if (assignedWork && row.due_date && row.due_date > date) remainingReasons.push('upcoming');
    if (assignedWork && !row.due_date) remainingReasons.push('undated');
    if (!todayReasons.length && ((row.creator_id === userId && !assigned) || (assigned && row.stage === 'review'))) remainingReasons.push('waiting');
    return { date, todayReasons, remainingReasons };
  }
  function taskShape(row, userId, withMessage = false, date = null) {
    if (!row) return null;
    const message = one('SELECT * FROM messages WHERE id=?', row.message_id);
    if (!message || !accessible(userId, message.channel_id)) return null;
    const result = row.result_message_id && one('SELECT * FROM messages WHERE id=? AND channel_id=?', row.result_message_id, message.channel_id);
    const taskDate = date ?? workdayDateFor(now());
    const task = { id: row.id, messageId: String(row.message_id), channelId: message.channel_id, title: row.title,
      assignee: activeUser(row.assignee_id), reviewer: activeUser(row.reviewer_id), reviewerId: row.reviewer_id,
      reviewerUnavailable: reviewerUnavailable(row), assigneeUnavailable: assigneeUnavailable(row), canReassignReviewer: canReassignReviewer(row, userId), dueDate: row.due_date,
      status: row.status, stage: row.stage, revision: row.revision, resultMessageId: result ? String(result.id) : null,
      resultMessage: result ? { id: String(result.id), channelId: result.channel_id, body: result.body, user: activeUser(result.user_id), createdAt: result.created_at } : null,
      createdBy: activeUser(row.creator_id), createdAt: row.created_at, updatedAt: row.updated_at,
      canManage: canManageTask(row, userId), allowedStages: allowedStages(row, userId),
      workday: taskWorkday(row, userId, taskDate) };
    return withMessage ? { ...task, message: messageShape(message, userId, { task }) } : task;
  }
  function weeklySummary(userId, { startAt, endAt, nextStartDate, nextEndDate, today = workdayDateFor(now()) }) {
    assert(activeUser(userId), 401, '회사 계정으로 로그인해 주세요.');
    const completed = [], attention = [], upcoming = [], finished = new Map();
    const stageLabel = { requested: '수락 전', accepted: '수락함', doing: '진행 중', review: '검토 중', changes: '수정 요청', done: '완료' };
    for (const event of all("SELECT task_id,changes,created_at FROM productivity_events WHERE kind IN ('task_stage','task_created') AND created_at>=? AND created_at<? ORDER BY created_at,sequence", startAt, endAt)) {
      let changes; try { changes = JSON.parse(event.changes); } catch { throw new Error('업무 변경 기록을 확인하지 못했습니다.'); }
      if (changes.to === 'done') finished.set(event.task_id, event.created_at);
    }
    for (const row of all('SELECT t.*,m.channel_id FROM message_tasks t JOIN messages m ON m.id=t.message_id WHERE t.assignee_id=? OR t.reviewer_id=? ORDER BY t.updated_at DESC,t.id', userId, userId)) {
      if (!accessible(userId, row.channel_id)) continue;
      const stage = row.stage || legacyStage(row.status), href = '/?' + new URLSearchParams({ tab: 'messenger', channelId: row.channel_id, messageId: String(row.message_id), panel: 'tasks' });
      const item = { id: 'task:' + row.id, kind: 'task', title: row.title, href, statusLabel: stageLabel[stage] || '상태 확인', dueDate: row.due_date || null };
      if (row.assignee_id === userId && finished.has(row.id)) completed.push({ ...item, occurredAt: finished.get(row.id), text: stage === 'done' ? '이 기간에 끝낸 내 일이에요.' : '이 기간에 끝냈다가 지금은 다시 하고 있는 일이에요.', statusLabel: stage === 'done' ? '완료' : '완료 후 ' + (stageLabel[stage] || '상태 변경') });
      if (stage === 'done') continue;
      const needsAction = (row.assignee_id === userId && (['requested', 'changes'].includes(stage) || (['accepted', 'doing'].includes(stage) && row.due_date && row.due_date <= today))) || row.reviewer_id === userId && stage === 'review';
      if (needsAction) attention.push({ ...item, text: row.due_date ? row.due_date + '까지 · 지금 내 차례' : '지금 내 차례인 일이에요.' });
      if (row.assignee_id === userId && row.due_date && row.due_date >= nextStartDate && row.due_date <= nextEndDate) upcoming.push({ ...item, text: row.due_date + '까지' });
    }
    return { completed, attention, upcoming };
  }
  function event(message, userId, kind, { taskId = null, decisionId = null, changes = {} } = {}) {
    run('INSERT INTO productivity_events(message_id,actor_id,kind,task_id,decision_id,changes,created_at) VALUES(?,?,?,?,?,?,?)', message.id, userId, kind, taskId, decisionId, JSON.stringify(changes), now());
  }
  function upsertTask({ messageId, userId, body, method = 'PATCH' }) {
    const message = requireMessage(String(messageId), userId), channel = requirePosting(userId, message.channel_id);
    const prior = one('SELECT * FROM message_tasks WHERE message_id=?', message.id);
    assert(method !== 'PATCH' || prior, 404, '할 일을 찾지 못했어요. 목록을 새로 불러와 주세요.');
    assert(!prior || canManageTask(prior, userId), 403, '할 일은 요청한 사람·담당·검토자·관리자만 바꿀 수 있어요.');
    assert(body.reassignReviewer === undefined || typeof body.reassignReviewer === 'boolean', 400, '검토자 다시 정하기 요청을 읽지 못했어요. 새로고침해 주세요.');
    const recovery = body.reassignReviewer === true;
    if (prior && (body.stage !== undefined || prior.reviewer_id || body.revision !== undefined || body.reviewerId !== undefined || body.resultMessageId !== undefined)) {
      assert(Number.isInteger(body.revision) && body.revision === prior.revision, 409, '그사이 다른 크루가 이 일을 바꿨어요. 새 내용을 보고 다시 해 주세요.');
    }
    assert(!recovery || (prior && canReassignReviewer(prior, userId)), 403, '새 검토자는 담당이 아닌 요청한 사람이나 관리자가 정할 수 있어요.');
    const assigneeId = body.assigneeId ?? prior?.assignee_id;
    const eligible = channelMembers(channel.id).filter(person => canPost(person.id, channel.id));
    assert(typeof assigneeId === 'string' && eligible.some(person => person.id === assigneeId), 400, '이 대화방에서 일을 맡을 크루를 골라 주세요.');
    const reviewerId = body.reviewerId === undefined ? prior?.reviewer_id ?? null : body.reviewerId;
    assert(reviewerId === null || (typeof reviewerId === 'string' && eligible.some(person => person.id === reviewerId)), 400, '검토자는 이 대화방 크루 가운데에서 골라 주세요.');
    assert(reviewerId === null || reviewerId !== assigneeId, 400, '담당과 검토자는 서로 다른 크루로 골라 주세요.');
    const title = textField(body.title ?? prior?.title ?? (message.body.slice(0, 120) || '공유 메시지 확인'), '제목', 200, 1);
    const dueDate = body.dueDate === undefined ? prior?.due_date ?? null : body.dueDate;
    if (dueDate !== null) kstDate(dueDate, '기한');
    if (body.status !== undefined) assert(['todo', 'doing', 'done'].includes(body.status), 400, '할 일 상태를 다시 골라 주세요.');
    const stage = body.stage ?? (body.status !== undefined ? legacyStage(body.status) : prior?.stage ?? 'requested');
    assert(STAGES.includes(stage), 400, '할 일 상태를 다시 골라 주세요.');
    assert(body.stage === undefined || body.status === undefined || body.status === statusFor(stage), 400, '할 일 상태가 서로 맞지 않아요. 새로고침한 뒤 다시 해 주세요.');
    assert(prior || stage === 'requested' || (body.stage === undefined && !reviewerId), 400, '새 할 일은 ‘수락 전’ 상태로 시작해요.');
    const resultMessageId = body.resultMessageId === undefined ? prior?.result_message_id ?? null : body.resultMessageId;
    let result = null;
    if (resultMessageId !== null) {
      assert(/^[1-9]\d*$/.test(String(resultMessageId)), 400, '결과물 메시지를 골라 주세요.');
      result = requireMessage(String(resultMessageId), userId);
      assert(result.channel_id === channel.id, 400, '결과물은 이 대화방의 메시지로 골라 주세요.');
    }
    validateTaskTransition({ prior, next: { assigneeId, reviewerId, title, dueDate, stage, result },
      actor: { userId, owner: isOwner(userId) }, recovery,
      legacyStatus: body.stage === undefined && body.status !== undefined,
      allowedStages: prior ? allowedStages({ ...prior, reviewer_id: reviewerId }, userId) : [],
    }, assert);
    const normalizedResult = result?.id ?? null;
    const changed = !prior || prior.title !== title || prior.assignee_id !== assigneeId || prior.reviewer_id !== reviewerId || prior.due_date !== dueDate || prior.stage !== stage || (prior.result_message_id ?? null) !== normalizedResult;
    if (!changed) return { task: taskShape(prior, userId), created: false };
    const notifications = [];
    const writeTask = () => {
      if (prior) {
        const updated = run('UPDATE message_tasks SET assignee_id=?,reviewer_id=?,title=?,due_date=?,status=?,stage=?,result_message_id=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?', assigneeId, reviewerId, title, dueDate, statusFor(stage), stage, normalizedResult, now(), prior.id, prior.revision);
        assert(updated.changes === 1, 409, '그사이 할 일이 바뀌었어요. 다시 불러와 주세요.');
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
    };
    unitOfWork.run(({ afterCommit }) => {
      writeTask();
      afterCommit(() => {
        publish('message', channel.id);
        for (const personId of notifications) publish('notification', channel.id, personId);
      });
    });
    return { task: taskShape(one('SELECT * FROM message_tasks WHERE message_id=?', message.id), userId), created: !prior };
  }
  function workday(userId) {
    const serverNow = now(), serverTime = Date.parse(serverNow), day = 86400000, offset = 9 * 3600000;
    const date = workdayDateFor(serverNow);
    const nextDayRefreshAfterMs = (Math.floor((serverTime + offset) / day) + 1) * day - offset - serverTime + 1000;
    const rows = all('SELECT t.*,m.channel_id FROM message_tasks t JOIN messages m ON m.id=t.message_id WHERE t.status<>? ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,t.due_date,t.updated_at DESC', 'done').filter(row => accessible(userId, row.channel_id));
    const groups = {
      reply: rows.filter(row => row.assignee_id === userId && ['requested', 'changes'].includes(row.stage)),
      due: rows.filter(row => row.assignee_id === userId && row.due_date && row.due_date <= date),
      review: rows.filter(row => row.reviewer_id === userId && row.stage === 'review'),
      waiting: rows.filter(row => (row.creator_id === userId && row.assignee_id !== userId) || (row.assignee_id === userId && row.stage === 'review')),
    };
    const basis = new Map(rows.map(row => [row.id, taskWorkday(row, userId, date)]));
    const todayGroups = {
      reply: rows.filter(row => basis.get(row.id).todayReasons.includes('reply')),
      due: rows.filter(row => basis.get(row.id).todayReasons.includes('due')),
      review: rows.filter(row => basis.get(row.id).todayReasons.includes('review')),
      recovery: rows.filter(row => basis.get(row.id).todayReasons.includes('recovery')),
    };
    const remainingGroups = {
      upcoming: rows.filter(row => basis.get(row.id).remainingReasons.includes('upcoming')),
      undated: rows.filter(row => basis.get(row.id).remainingReasons.includes('undated')),
      waiting: rows.filter(row => basis.get(row.id).remainingReasons.includes('waiting')),
    };
    const shapes = new Map();
    const summarize = lists => ({
      groups: Object.fromEntries(Object.entries(lists).map(([key, list]) => [key, list.map(row => {
        if (!shapes.has(row.id)) shapes.set(row.id, taskShape(row, userId, true, date));
        return shapes.get(row.id);
      })])),
      counts: Object.fromEntries(Object.entries(lists).map(([key, list]) => [key, list.length])),
      total: new Set(Object.values(lists).flat().map(row => row.id)).size,
    });
    return { date, serverNow, nextDayRefreshAfterMs, ...summarize(groups), today: summarize(todayGroups), remaining: summarize(remainingGroups), openTotal: rows.filter(row => row.assignee_id === userId).length };
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
    const summary = textField(body.summary, '정한 내용', 2000, 1), kind = body.kind ?? 'decision';
    assert(['decision', 'final'].includes(kind), 400, '기록 종류를 결정과 최종본 가운데에서 골라 주세요.');
    const effectiveDate = kstDate(body.effectiveDate, '언제부터');
    const requestId = body.requestId === undefined ? null : textField(body.requestId, '요청 식별자', 100, 1);
    let result = null;
    if (body.resultMessageId !== undefined && body.resultMessageId !== null) {
      result = requireMessage(String(body.resultMessageId), userId);
      assert(result.channel_id === message.channel_id, 400, '최종본은 이 대화방의 메시지로 골라 주세요.');
    }
    assert(kind !== 'final' || result, 400, '최종본 메시지를 골라 주세요.');
    const prior = body.replacesId ? one('SELECT * FROM message_decisions WHERE id=?', body.replacesId) : null;
    if (body.replacesId) {
      assert(prior && decisionShape(prior, userId), 404, '바꿀 이전 결정을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      assert(prior.creator_id === userId || isOwner(userId), 403, '이전 결정은 그 결정을 남긴 크루나 관리자만 바꿀 수 있어요.');
      const source = requireMessage(String(prior.message_id), userId);
      assert(source.channel_id === message.channel_id && prior.kind === kind, 400, '같은 대화방의 같은 종류 기록으로만 바꿀 수 있어요.');
    }
    const duplicate = requestId ? one('SELECT * FROM message_decisions WHERE creator_id=? AND request_id=?', userId, requestId) : one('SELECT * FROM message_decisions WHERE creator_id=? AND message_id=? AND summary=? AND effective_date=? AND kind=? AND result_message_id IS ? AND replaces_id IS ?', userId, message.id, summary, effectiveDate, kind, result?.id ?? null, prior?.id ?? null);
    if (duplicate) {
      assert(duplicate.message_id === message.id && duplicate.summary === summary && duplicate.effective_date === effectiveDate && duplicate.kind === kind && duplicate.result_message_id === (result?.id ?? null) && duplicate.replaces_id === (prior?.id ?? null), 409, '이미 쓴 요청 정보예요. 새로고침한 뒤 다시 남겨 주세요.');
      return { decision: decisionShape(duplicate, userId), created: false };
    }
    assert(!prior || !prior.superseded_by_id, 409, '이미 다른 결정으로 바뀌었어요. 최신 결정을 보고 다시 해 주세요.');
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
    assert(Number.isSafeInteger(start) && start >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '바뀐 것 목록을 불러오지 못했어요. 다시 불러와 주세요.');
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
    assert((!kind || ['decision', 'final'].includes(kind)) && ['0', '1'].includes(current), 400, '결정 검색 조건을 다시 골라 주세요.');
    const rows = all('SELECT d.*,m.channel_id FROM message_decisions d JOIN messages m ON m.id=d.message_id ORDER BY d.created_at DESC,d.id DESC').filter(row => accessible(userId, row.channel_id) && (!channelId || row.channel_id === channelId) && (!kind || row.kind === kind) && (!q || row.summary.toLocaleLowerCase().includes(q.toLocaleLowerCase())) && (current === '0' || !row.superseded_by_id));
    return paged(rows, query, 'decisions', row => decisionShape(row, userId));
  }
  function assertMessageMutable(messageId) {
    assert(!one("SELECT 1 FROM message_tasks WHERE result_message_id=? AND stage IN ('review','done')", messageId), 409, '검토 중이거나 끝난 일의 결과물이라 고치거나 지울 수 없어요. ‘수정 요청’이나 ‘진행 중’으로 바꾼 뒤 해 주세요.');
    assert(!one("SELECT 1 FROM message_decisions WHERE result_message_id=? AND kind='final' AND superseded_by_id IS NULL", messageId), 409, '최종본으로 정한 결과물이라 고치거나 지울 수 없어요. 새 결과물을 올려 최종본을 바꾼 뒤 해 주세요.');
  }
  async function handle({ p, method, url, user, readBody, respond }) {
    if (p === '/api/workday/notifications' && ['GET', 'PATCH'].includes(method)) {
      if (method === 'PATCH') {
        const body = await readBody(), prior = digestPreferences(user.id);
        assert(body.enabled === undefined || typeof body.enabled === 'boolean', 400, '마감 알림 설정이 맞지 않아요. 새로고침한 뒤 다시 해 주세요.');
        assert(body.includeWeekends === undefined || typeof body.includeWeekends === 'boolean', 400, '주말 알림 설정이 맞지 않아요. 새로고침한 뒤 다시 해 주세요.');
        const enabled = body.enabled ?? prior.enabled, includeWeekends = body.includeWeekends ?? prior.includeWeekends;
        if (enabled && !workNotificationsEnabled) {
          const message = '회사 업무 알림이 꺼져 있어 마감 알림을 켤 수 없어요. 관리자에게 켜 달라고 해 주세요.';
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
      assert(Number.isSafeInteger(body.through) && body.through >= 0 && (body.through <= (prior?.sequence ?? 0) || (target && accessible(user.id, target.channel_id))), 400, '확인한 위치를 찾지 못했어요. 바뀐 것 목록을 다시 불러와 주세요.');
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
    if (match && method === 'GET') { const decision = decisionShape(one('SELECT * FROM message_decisions WHERE id=?', match[1]), user.id); assert(decision, 404, '결정을 찾지 못했어요. 목록을 새로 불러와 주세요.'); respond(200, { decision }); return true; }
    return false;
  }
  return { taskShape, canManageTask, upsertTask, getTask: (messageId, userId) => taskShape(one('SELECT * FROM message_tasks WHERE message_id=?', messageId), userId), workday, weeklySummary, catchUp, decisions, createDecision, assertMessageMutable, deliverDueDigests, dueNotifications, readDueNotification, digestPreferences, handle };
}
