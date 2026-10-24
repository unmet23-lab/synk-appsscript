import { createUnitOfWork } from './unit-of-work.mjs';
import { randomUUID } from 'node:crypto';
import { createProductivityService } from './productivity-service.mjs';

// All personal indexes point to live messages. They never keep copied message bodies.
export function createCollaborationService({ db, assert, textField, now, transaction, members, requireChannel, requireMessage, requirePosting, messageShape: baseMessageShape, publish, origin, fileTypeSql, integrated, resolveLink, backgroundJobsEnabled = true, workNotificationsEnabled = backgroundJobsEnabled, externalNotifications = null }) {
  assert(typeof backgroundJobsEnabled === 'boolean', 400, '백그라운드 작업 설정은 boolean이어야 합니다.');
  assert(typeof workNotificationsEnabled === 'boolean', 400, '업무 알림 설정은 boolean이어야 합니다.');
  const unitOfWork = createUnitOfWork(transaction);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  function activeUser(userId) { return members().find(user => user.id === userId) || null; }
  function accessible(userId, channelId) {
    if (!activeUser(userId)) return false;
    try { requireChannel(userId, channelId); return true; } catch { return false; }
  }
  function channelMembers(channelId) { return members().filter(user => one('SELECT 1 FROM memberships WHERE user_id=? AND channel_id=?', user.id, channelId) && accessible(user.id, channelId)); }
  function mode(userId, channelId) { return one('SELECT mode FROM channel_notifications WHERE user_id=? AND channel_id=?', userId, channelId)?.mode || 'mentions'; }
  function pagination(query) {
    const offset = Number(query.get('offset') ?? 0), limit = Number(query.get('limit') ?? 50);
    assert(Number.isSafeInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '목록을 불러오지 못했어요. 다시 불러와 주세요.');
    return { offset, limit };
  }
  function paged(rows, query, key, shape = value => value) {
    const { offset, limit } = pagination(query), hasMore = rows.length > offset + limit;
    return { [key]: rows.slice(offset, offset + limit).map(shape), hasMore, nextOffset: hasMore ? offset + limit : null };
  }
  function kstDate(value, label) {
    assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 400, `‘${label}’ 칸에 2026-10-20처럼 날짜를 넣어 주세요.`);
    return value;
  }
  function workspaceLink(value, requestOrigin) {
    if (value === null || value === undefined) return null;
    assert(value && typeof value === 'object' && !Array.isArray(value), 400, '공유할 화면 링크가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    const title = textField(value.title, '화면 제목', 160, 1);
    assert(typeof value.url === 'string' && value.url.length <= 2000, 400, '공유할 화면 주소가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    let url;
    try { url = new URL(value.url, requestOrigin); } catch { assert(false, 400, '공유할 화면 주소가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.'); }
    assert(url.origin === requestOrigin && url.pathname === '/' && !url.username && !url.password, 400, '회사 화면의 링크만 공유할 수 있어요.');
    const old = new URLSearchParams(url.hash.slice(1));
    assert(!url.hash || old.has('view'), 400, '공유할 화면 주소가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    assert(!url.hash || !url.search, 400, '공유할 화면 주소가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    const params = url.hash ? old : url.searchParams;
    const allowed = url.hash ? ['view', 'section', 'teamId', 'draftId'] : ['tab', 'section', 'teamId', 'draftId'];
    assert([...params.keys()].every(key => allowed.includes(key) && params.getAll(key).length === 1), 400, '공유 링크에 넣을 수 없는 정보가 있어요. 회사 화면에서 다시 공유해 주세요.');
    const view = params.get(url.hash ? 'view' : 'tab');
    assert(['marketing', 'overview', 'analysis', 'history', 'content', 'channels', 'studio'].includes(view), 400, '이 화면은 공유할 수 없어요. 공유할 수 있는 회사 화면을 골라 주세요.');
    const section = params.get('section'), teamId = params.get('teamId'), draftId = params.get('draftId');
    assert(!section || ['mine', 'team', 'all', 'summary', 'channels', 'library', 'plan', 'examples'].includes(section), 400, '공유할 화면의 구역이 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    assert(!teamId || (section === 'team' && /^[a-zA-Z0-9_-]{1,100}$/.test(teamId)), 400, '공유할 팀 정보가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    assert(!draftId || (view === 'content' && section === 'plan' && /^[a-zA-Z0-9_-]{1,100}$/.test(draftId)), 400, '공유할 기획 정보가 맞지 않아요. 회사 화면에서 다시 공유해 주세요.');
    // Relative canonical links preserve company access checks and survive host/port changes.
    const normalized = new URLSearchParams({ view, ...(section ? { section } : {}), ...(teamId ? { teamId } : {}), ...(draftId ? { draftId } : {}) });
    return { title, url: `/#${normalized}`, kind: draftId ? 'content-review' : ['overview', 'analysis', 'history'].includes(view) ? 'report' : 'screen' };
  }
  function prepareMessage(body, channel, userId, prior = null, requestOrigin = origin?.()) {
    const allowed = new Set(channelMembers(channel.id).map(user => user.id));
    const ids = body.mentionIds === undefined ? (prior ? all('SELECT user_id FROM message_mentions WHERE message_id=?', prior.id).map(row => row.user_id).filter(id => allowed.has(id)) : []) : body.mentionIds;
    assert(Array.isArray(ids) && ids.length <= 30 && ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length, 400, '멘션은 한 번에 30명까지 할 수 있어요.');
    assert(ids.every(id => allowed.has(id)), 404, '멘션한 크루가 이 대화방에 없어요. 멘션을 다시 골라 주세요.');
    let link = body.workspaceLink === undefined ? (prior?.workspace_link ? JSON.parse(prior.workspace_link) : null) : workspaceLink(body.workspaceLink, requestOrigin);
    if (link) link = resolveLink({ userId, channelId: channel.id, workspaceLink: link });
    const ackRequired = body.ackRequired === undefined ? (prior ? Boolean(prior.ack_required) : channel.system_key === 'announcements') : body.ackRequired;
    assert(typeof ackRequired === 'boolean' && (!ackRequired || channel.system_key === 'announcements'), 400, '확인 요청은 공지에서만 쓸 수 있어요.');
    return { mentionIds: ids, workspaceLink: link, ackRequired };
  }
  function applyMessage(messageId, data, { edit = false } = {}) {
    run('UPDATE messages SET workspace_link=?,ack_required=? WHERE id=?', data.workspaceLink ? JSON.stringify(data.workspaceLink) : null, data.ackRequired ? 1 : 0, messageId);
    run('DELETE FROM message_mentions WHERE message_id=?', messageId);
    for (const userId of data.mentionIds) run('INSERT INTO message_mentions VALUES(?,?)', messageId, userId);
    if (edit) run('DELETE FROM announcement_acks WHERE message_id=?', messageId);
  }
  function notify(userId, message, kind, key) {
    if (!accessible(userId, message.channel_id)) return false;
    return Boolean(run('INSERT OR IGNORE INTO notifications(id,user_id,message_id,kind,dedupe_key,created_at) VALUES(?,?,?,?,?,?)', randomUUID(), userId, message.id, kind, key, now()).changes);
  }
  function notifyMessage(message, { edit = false } = {}) {
    const channel = one('SELECT * FROM channels WHERE id=?', message.channel_id), mentioned = new Set(all('SELECT user_id FROM message_mentions WHERE message_id=?', message.id).map(row => row.user_id));
    const parent = message.reply_to_id ? one('SELECT user_id FROM messages WHERE id=?', message.reply_to_id) : null;
    const changed = [];
    const writeNotifications = () => {
      for (const member of channelMembers(channel.id)) {
        if (member.id === message.user_id || mode(member.id, channel.id) === 'mute') continue;
        const kind = mentioned.has(member.id) ? 'mention' : edit ? null : parent?.user_id === member.id ? 'reply' : channel.kind === 'dm' ? 'dm' : mode(member.id, channel.id) === 'all' ? 'message' : null;
        if (kind && notify(member.id, message, kind, `message:${message.id}:${member.id}:${kind}`)) changed.push(member.id);
      }
    };
    unitOfWork.run(({ afterCommit }) => {
      writeNotifications();
      afterCommit(() => { for (const userId of changed) publish('notification', channel.id, userId); });
    });
  }
  function reminderShape(row) { return row ? { id: row.id, messageId: String(row.message_id), channelId: one('SELECT channel_id FROM messages WHERE id=?', row.message_id)?.channel_id, remindAt: row.remind_at, createdAt: row.created_at, deliveredAt: row.delivered_at } : null; }
  const productivity = createProductivityService({ db, unitOfWork, assert, textField, now, transaction, activeUser, accessible, channelMembers, requireChannel, requireMessage, requirePosting, messageShape, publish, notify, mode, kstDate, paged, backgroundJobsEnabled, workNotificationsEnabled });
  const { taskShape } = productivity;
  function messageShape(message, userId, options = {}) {
    return { ...baseMessageShape(message, userId), ...messageExtras(message, userId, options) };
  }
  function messageExtras(message, userId, options = {}) {
    const mentions = all('SELECT user_id FROM message_mentions WHERE message_id=?', message.id).map(row => activeUser(row.user_id)).filter(Boolean);
    const acknowledged = all('SELECT user_id FROM announcement_acks WHERE message_id=?', message.id).filter(row => accessible(row.user_id, message.channel_id));
    return { mentions, workspaceLink: message.workspace_link ? JSON.parse(message.workspace_link) : null, task: Object.hasOwn(options, 'task') ? options.task : taskShape(one('SELECT * FROM message_tasks WHERE message_id=?', message.id), userId), saved: Boolean(one('SELECT 1 FROM saved_messages WHERE message_id=? AND user_id=?', message.id, userId)), reminder: reminderShape(one('SELECT * FROM message_reminders WHERE message_id=? AND user_id=?', message.id, userId)), ackRequired: Boolean(message.ack_required), acknowledged: acknowledged.some(row => row.user_id === userId), ackCount: acknowledged.length };
  }
  function setExternalNotifications(adapter) {
    assert(adapter === null || (adapter && ['list', 'read', 'readAll'].every(key => typeof adapter[key] === 'function')), 400, '외부 업무 알림 연결을 확인해 주세요.');
    externalNotifications = adapter;
  }
  setExternalNotifications(externalNotifications);
  let personalNotifications = null;
  function setPersonalNotifications(adapter) { personalNotifications = adapter; }
  function visibleNotifications(userId) {
    const messages = all('SELECT n.*,m.channel_id FROM notifications n JOIN messages m ON m.id=n.message_id WHERE n.user_id=?', userId).filter(row => accessible(userId, row.channel_id)).map(row => ({ id: row.id, kind: row.kind, message: messageShape(requireMessage(String(row.message_id), userId), userId), createdAt: row.created_at, readAt: row.read_at, _source: 'message' }));
    const due = productivity.dueNotifications(userId).map(row => ({ ...row, _source: 'due' }));
    const external = (externalNotifications?.list(userId) || []).map(row => ({ ...row, _source: 'external' }));
    const personal = (personalNotifications?.list(userId) || []).map(row => ({ ...row, _source: 'personal' }));
    return [...messages, ...due, ...external, ...personal].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
  function unreadCount(userId) {
    // Count notification rows, not messages: one message can have several kinds.
    // Keep the same live room authorization without constructing message details.
    const messages = all("SELECT m.channel_id,COUNT(*) AS unread FROM notifications n JOIN messages m ON m.id=n.message_id WHERE n.user_id=? AND (n.read_at IS NULL OR n.read_at='') GROUP BY m.channel_id", userId)
      .filter(row => accessible(userId, row.channel_id)).reduce((sum, row) => sum + row.unread, 0);
    const other = [...productivity.dueNotifications(userId), ...(externalNotifications?.list(userId) || []), ...(personalNotifications?.list(userId) || [])];
    return messages + other.filter(row => !row.readAt).length;
  }
  function notificationsForPush(userId) {
    if (!activeUser(userId)) return [];
    return visibleNotifications(userId).filter(row => {
      const channelId = row.message?.channelId;
      return row.pushEligible !== false && (!channelId || mode(userId, channelId) !== 'mute' && !one('SELECT deleted_at FROM channels WHERE id=?', channelId)?.deleted_at);
    }).map(({ _source, ...row }) => row);
  }
  function deliverReminders() {
    // Notifications/reminders GET must not drain restored pending reminders either.
    if (!workNotificationsEnabled) return;
    productivity.deliverDueDigests();
    const changed = [];
    transaction(() => {
      for (const row of all('SELECT r.*,m.channel_id FROM message_reminders r JOIN messages m ON m.id=r.message_id JOIN channels c ON c.id=m.channel_id WHERE c.deleted_at IS NULL AND r.delivered_at IS NULL AND r.remind_at<=? ORDER BY r.remind_at LIMIT 500', now())) {
        if (!accessible(row.user_id, row.channel_id)) { run('DELETE FROM message_reminders WHERE id=?', row.id); continue; }
        const message = one('SELECT * FROM messages WHERE id=?', row.message_id);
        if (notify(row.user_id, message, 'reminder', `reminder:${row.id}`)) changed.push([row.user_id, row.channel_id]);
        run('UPDATE message_reminders SET delivered_at=? WHERE id=? AND delivered_at IS NULL', now(), row.id);
      }
    });
    for (const [userId, channelId] of changed) publish('notification', channelId, userId);
  }
  function personalMutation(p, method) {
    return (method === 'PATCH' && p === '/api/workday/notifications') || (method === 'POST' && p === '/api/catch-up/read') || (method === 'POST' && /^\/api\/channels\/[^/]+\/(leave|restore)$/.test(p)) || (method === 'PATCH' && /^\/api\/channels\/[^/]+\/notifications$/.test(p)) || (method === 'POST' && /^\/api\/notifications\/(?:[^/]+\/read|read-all)$/.test(p)) || (['POST', 'DELETE'].includes(method) && /^\/api\/messages\/\d+\/save$/.test(p)) || (['PUT', 'DELETE'].includes(method) && /^\/api\/messages\/\d+\/reminder$/.test(p)) || (method === 'POST' && /^\/api\/messages\/\d+\/ack$/.test(p));
  }
  async function handle({ p, method, url, user, readBody, respond }) {
    if (await productivity.handle({ p, method, url, user, readBody, respond })) return true;
    let match = p.match(/^\/api\/channels\/([^/]+)\/notifications$/);
    if (match && ['GET', 'PATCH'].includes(method)) {
      const body = method === 'PATCH' ? await readBody() : null;
      requireChannel(user.id, match[1]);
      if (body) { assert(['all', 'mentions', 'mute'].includes(body.mode), 400, '알림 설정을 다시 골라 주세요.'); run('INSERT INTO channel_notifications VALUES(?,?,?) ON CONFLICT(channel_id,user_id) DO UPDATE SET mode=excluded.mode', match[1], user.id, body.mode); publish('notification', match[1], user.id); }
      respond(200, { mode: mode(user.id, match[1]) }); return true;
    }
    if (p === '/api/notifications' && method === 'GET') {
      deliverReminders();
      const rows = visibleNotifications(user.id), unread = rows.filter(row => !row.readAt);
      const result = paged(url.searchParams.get('unread') === '1' ? unread : rows, url.searchParams, 'items', ({ _source, ...row }) => row);
      respond(200, { ...result, unreadCount: unread.length }); return true;
    }
    if (method === 'POST' && (p === '/api/notifications/read-all' || (match = p.match(/^\/api\/notifications\/([^/]+)\/read$/)))) {
      await readBody();
      let notificationId = null;
      if (p !== '/api/notifications/read-all') {
        try { notificationId = decodeURIComponent(match[1]); } catch { assert(false, 400, '알림 주소가 맞지 않아요. 알림 목록을 새로 불러와 주세요.'); }
      }
      const rows = visibleNotifications(user.id);
      if (p !== '/api/notifications/read-all') assert(rows.some(row => row.id === notificationId), 404, '알림을 찾지 못했어요. 알림 목록을 새로 불러와 주세요.');
      const selected = rows.filter(row => p === '/api/notifications/read-all' || row.id === notificationId);
      transaction(() => { for (const row of selected) {
        if (row._source === 'message') run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?', now(), row.id, user.id);
        else if (row._source === 'due') productivity.readDueNotification(user.id, row.id);
      } });
      // Personal source authorization can synchronize the company roster too.
      for (const row of selected) if (row._source === 'personal') personalNotifications.read(user.id, row.id);
      // Customer notifications live in the company database. Never put those
      // writes inside the messenger SQLite transaction.
      if (p === '/api/notifications/read-all') externalNotifications?.readAll(user.id);
      else if (selected[0]?._source === 'external') externalNotifications.read(user.id, selected[0].id);
      publish('notification', null, user.id); respond(200, { ok: true, unreadCount: unreadCount(user.id) }); return true;
    }
    match = p.match(/^\/api\/messages\/(\d+)\/(ack|acks|task|save|reminder)$/);
    if (match) {
      const [,, action] = match;
      const valid = (action === 'ack' && method === 'POST') || (action === 'acks' && method === 'GET') || (action === 'task' && ['POST', 'PATCH'].includes(method)) || (action === 'save' && ['POST', 'DELETE'].includes(method)) || (action === 'reminder' && ['PUT', 'DELETE'].includes(method));
      if (!valid) return false;
      const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readBody() : {};
      const message = requireMessage(match[1], user.id), channel = requireChannel(user.id, message.channel_id);
      if (action === 'ack' || action === 'acks') {
        assert(channel.system_key === 'announcements' && message.ack_required, 400, '확인 요청이 없는 공지예요.');
        if (action === 'ack') { run('INSERT OR IGNORE INTO announcement_acks VALUES(?,?,?)', message.id, user.id, now()); publish('message', channel.id); respond(200, { acknowledged: true, message: messageShape(requireMessage(match[1], user.id), user.id) }); }
        else {
          const people = channelMembers(channel.id), entries = all('SELECT * FROM announcement_acks WHERE message_id=?', message.id);
          respond(200, { total: people.length, acknowledged: people.filter(member => entries.some(row => row.user_id === member.id)).map(member => ({ user: member, acknowledgedAt: entries.find(row => row.user_id === member.id).acknowledged_at })), pending: people.filter(member => !entries.some(row => row.user_id === member.id)) });
        }
      } else if (action === 'save') {
        if (method === 'POST') run('INSERT OR IGNORE INTO saved_messages VALUES(?,?,?)', message.id, user.id, now());
        else run('DELETE FROM saved_messages WHERE message_id=? AND user_id=?', message.id, user.id);
        publish('message', channel.id, user.id); respond(200, { saved: method === 'POST' });
      } else if (action === 'reminder') {
        if (method === 'PUT' && !workNotificationsEnabled) {
          const message = '회사 업무 알림이 꺼져 있어 예약할 수 없어요. 관리자에게 켜 달라고 해 주세요.';
          throw Object.assign(new Error(message), { status: 503, publicMessage: message, code: 'SYNK_WORK_NOTIFICATIONS_PAUSED' });
        }
        const existing = one('SELECT * FROM message_reminders WHERE message_id=? AND user_id=?', message.id, user.id);
        if (method === 'DELETE') {
          transaction(() => { if (existing) run('DELETE FROM notifications WHERE user_id=? AND dedupe_key=?', user.id, `reminder:${existing.id}`); run('DELETE FROM message_reminders WHERE message_id=? AND user_id=?', message.id, user.id); });
          publish('notification', channel.id, user.id); respond(200, { reminder: null });
        } else {
          assert(typeof body.remindAt === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.remindAt), 400, '다시 볼 시간을 읽지 못했어요. 시간을 새로 골라 주세요.');
          kstDate(body.remindAt.slice(0, 10), '다시 볼 날짜');
          const stamp = Date.parse(body.remindAt);
          assert(Number.isFinite(stamp) && stamp > Date.parse(now()) && stamp <= Date.parse(now()) + 5 * 366 * 86400000, 400, '다시 볼 시간은 지금 이후 5년 안으로 골라 주세요.');
          transaction(() => { if (existing) { run('DELETE FROM notifications WHERE user_id=? AND dedupe_key=?', user.id, `reminder:${existing.id}`); run('DELETE FROM message_reminders WHERE id=?', existing.id); } run('INSERT INTO message_reminders(id,message_id,user_id,remind_at,created_at) VALUES(?,?,?,?,?)', randomUUID(), message.id, user.id, new Date(stamp).toISOString(), now()); });
          publish('message', channel.id, user.id); respond(200, { reminder: reminderShape(one('SELECT * FROM message_reminders WHERE message_id=? AND user_id=?', message.id, user.id)) });
        }
      } else {
        const result = productivity.upsertTask({ messageId: message.id, userId: user.id, body, method });
        respond(result.created ? 201 : 200, { task: result.task });
      }
      return true;
    }
    if (method === 'GET' && p === '/api/saved') {
      const rows = all('SELECT m.* FROM saved_messages s JOIN messages m ON m.id=s.message_id WHERE s.user_id=? ORDER BY s.created_at DESC,m.id DESC', user.id).filter(row => accessible(user.id, row.channel_id));
      respond(200, paged(rows, url.searchParams, 'messages', row => messageShape(row, user.id))); return true;
    }
    if (method === 'GET' && p === '/api/reminders') {
      deliverReminders(); const status = url.searchParams.get('status') || 'all'; assert(['all', 'pending', 'due'].includes(status), 400, '다시 볼 목록을 불러오지 못했어요. 새로고침해 주세요.');
      const rows = all('SELECT r.*,m.channel_id FROM message_reminders r JOIN messages m ON m.id=r.message_id WHERE r.user_id=? ORDER BY r.remind_at,r.id', user.id).filter(row => accessible(user.id, row.channel_id) && (status === 'all' || (status === 'pending' ? !row.delivered_at : row.delivered_at)));
      respond(200, paged(rows, url.searchParams, 'reminders', row => ({ ...reminderShape(row), message: messageShape(requireMessage(String(row.message_id), user.id), user.id) }))); return true;
    }
    if (method === 'GET' && p === '/api/tasks') {
      const scope = url.searchParams.get('scope') || 'mine', channelId = url.searchParams.get('channelId'), status = url.searchParams.get('status') || 'all';
      assert(['mine', 'channel', 'all'].includes(scope) && ['all', 'todo', 'doing', 'done'].includes(status), 400, '할 일 목록 조건을 다시 골라 주세요.');
      if (scope === 'channel') assert(channelId, 400, '할 일을 볼 대화방을 골라 주세요.'); if (channelId) requireChannel(user.id, channelId);
      const rows = all('SELECT t.*,m.channel_id FROM message_tasks t JOIN messages m ON m.id=t.message_id ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,t.due_date,t.created_at DESC').filter(row => accessible(user.id, row.channel_id) && (scope !== 'mine' || row.assignee_id === user.id) && (!channelId || row.channel_id === channelId) && (status === 'all' || row.status === status));
      respond(200, paged(rows, url.searchParams, 'tasks', row => ({ ...taskShape(row, user.id), message: messageShape(requireMessage(String(row.message_id), user.id), user.id) }))); return true;
    }
    if (method === 'GET' && p === '/api/search') {
      const q = textField(url.searchParams.get('q') ?? '', '검색어', 200), channelId = url.searchParams.get('channelId'), authorId = url.searchParams.get('authorId'), from = url.searchParams.get('from'), to = url.searchParams.get('to'), fileType = url.searchParams.get('fileType') || 'all';
      const { offset, limit } = pagination(url.searchParams);
      if (channelId) requireChannel(user.id, channelId);
      if (from) kstDate(from, '시작 날짜'); if (to) kstDate(to, '끝 날짜'); assert(!from || !to || from <= to, 400, '끝 날짜를 시작 날짜보다 뒤로 골라 주세요.');
      assert(!authorId || (typeof authorId === 'string' && authorId.length <= 100), 400, '작성자를 다시 골라 주세요.');
      assert(['all', 'any', 'image', 'video', 'audio', 'document', 'archive', 'other'].includes(fileType), 400, '파일 종류를 다시 골라 주세요.');
      const escaped = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      const rows = all(`SELECT m.* FROM messages m JOIN memberships c ON c.channel_id=m.channel_id AND c.user_id=? JOIN channels r ON r.id=m.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1) AND m.body LIKE ? ESCAPE '\\' AND (? IS NULL OR m.channel_id=?) AND (? IS NULL OR m.user_id=?) AND (? IS NULL OR m.created_at>=?) AND (? IS NULL OR m.created_at<?) AND (?='all' OR EXISTS(SELECT 1 FROM files f WHERE f.message_id=m.id AND (?='any' OR (${fileTypeSql})=?))) ORDER BY m.id DESC LIMIT ? OFFSET ?`, user.id, integrated ? 1 : 0, escaped, channelId, channelId, authorId, authorId, from, from ? new Date(`${from}T00:00:00+09:00`).toISOString() : null, to, to ? new Date(Date.parse(`${to}T00:00:00+09:00`) + 86400000).toISOString() : null, fileType, fileType, fileType, limit + 1, offset);
      respond(200, { messages: rows.slice(0, limit).map(row => messageShape(row, user.id)), hasMore: rows.length > limit, nextOffset: rows.length > limit ? offset + limit : null }); return true;
    }
    return false;
  }
  return { unitOfWork, prepareMessage, applyMessage, notifyMessage, messageShape, messageExtras, notificationMode: mode, unreadCount, deliverReminders, personalMutation, handle, productivity, setExternalNotifications, setPersonalNotifications, notificationsForPush, notifyExternal: userId => publish('notification', null, userId) };
}
