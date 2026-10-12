import { createHash } from 'node:crypto';

// Reuse the original message/task/receipt tables. Only publication leaves the
// transaction; task and ordinary chat notifications are durable together.
export function createDirectTaskService({ db, assert, textField, validateRequestId, now, transaction, requirePosting, channelShape, channelMembers, collaboration, messageShape, onPublishError = () => {} }) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const fields = new Set(['requestId', 'channelId', 'title', 'body', 'assigneeId', 'reviewerId', 'dueDate']);
  function options(userId) {
    const date = new Date(Date.parse(now()) + 9 * 3600000).toISOString().slice(0, 10);
    const channels = db.prepare('SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id WHERE m.user_id=? ORDER BY c.created_at,c.id').all(userId).flatMap(channel => {
      try { requirePosting(userId, channel.id); } catch { return []; }
      const taskAssignees = channelMembers(channel.id).filter(person => {
        try { requirePosting(person.id, channel.id); return true; } catch { return false; }
      });
      return [{ ...channelShape(channel, userId), taskAssignees }];
    });
    return { date, channels };
  }
  function create(userId, input) {
    assert(input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).every(key => fields.has(key)), 400, '등록할 업무 항목을 확인해 주세요.');
    const channelId = textField(input.channelId, '업무를 남길 대화방', 200, 1);
    const channel = requirePosting(userId, channelId);
    const requestId = validateRequestId(input.requestId, '업무 등록');
    const title = textField(input.title, '업무 제목', 200, 1), body = textField(input.body, '요청 내용', 8000, 1);
    const payload = { kind: 'direct-task-v1', channelId, title, body, assigneeId: input.assigneeId, reviewerId: input.reviewerId ?? null, dueDate: input.dueDate ?? null };
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex'), receiptId = 'direct-task:' + requestId;
    const effects = [], deferPublish = effect => effects.push(effect);
    const result = transaction(() => {
      // Namespace and actor-wide lookup also reject a reused UUID with a
      // different room, while ordinary message UUIDs remain independent.
      const prior = one('SELECT * FROM message_send_requests WHERE user_id=? AND request_id=?', userId, receiptId);
      if (prior) {
        assert(prior.payload_hash === fingerprint, 409, '같은 등록 식별자로 다른 업무를 등록할 수 없습니다.');
        const message = prior.state === 'sent' && prior.message_id && one('SELECT * FROM messages WHERE id=?', prior.message_id);
        const task = message && collaboration.productivity.getTask(String(message.id), userId);
        assert(message && task, 410, '이 등록의 원래 업무가 삭제되었거나 취소되었습니다. 새 업무로 등록해 주세요.');
        return { message: messageShape(message, userId), task, created: false };
      }
      const extras = collaboration.prepareMessage({}, channel, userId);
      const messageId = Number(db.prepare('INSERT INTO messages(channel_id,user_id,body,created_at,reply_to_id) VALUES(?,?,?,?,NULL)').run(channelId, userId, body, now()).lastInsertRowid);
      collaboration.applyMessage(messageId, extras);
      const task = collaboration.productivity.upsertTask({ messageId: String(messageId), userId, body: { title, assigneeId: payload.assigneeId, reviewerId: payload.reviewerId, dueDate: payload.dueDate, stage: 'requested' }, method: 'POST', atomic: true, deferPublish }).task;
      const message = one('SELECT * FROM messages WHERE id=?', messageId);
      collaboration.notifyMessage(message, { atomic: true, deferPublish });
      db.prepare('INSERT INTO message_send_requests(user_id,channel_id,request_id,payload_hash,message_id,created_at) VALUES(?,?,?,?,?,?)').run(userId, channelId, receiptId, fingerprint, messageId, now());
      return { message: messageShape(message, userId), task, created: true };
    });
    for (const effect of effects) {
      try { effect(); } catch (error) { onPublishError(error); }
    }
    return result;
  }
  return { options, create };
}
