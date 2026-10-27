import { NOT_HANDLED } from './request-router.mjs';

export const messageReadMarker = (p, method) => method === 'POST' && /^\/api\/channels\/[^/]+\/read$/.test(p);


// Owns the messages HTTP contract; authentication stays in the request context.
export function createMessagesRoutes({ AppError, EMOJI, all, assert, canonical, collaboration, fileShape, hash, integration, messageShape, now, one, publish, queueFileDeletion, recordFileCancellation, recoveryError, removeDiskFile, requestId, requireChannel, requireMessage, requirePosting, retryDriveDeletions, run, sentRequestResult, textField, transaction, upload, uploadedRequestFile }) {
  return function handle(context) {
    const { method, p, readBody, req, res, respond, revalidate, url } = context;
    let match = p.match(/^\/api\/channels\/([^/]+)\/(messages|files)\/requests\/([^/]+)$/);
    if (match && ['GET', 'DELETE'].includes(method)) { return (async () => {
      const [, channelId, action, rawId] = match;
      requirePosting(context.user.id, channelId);
      const id = requestId(rawId, '전송');
      if (method === 'DELETE' && action === 'files') {
        const file = transaction(() => {
          const existing = one('SELECT * FROM file_upload_requests WHERE user_id=? AND channel_id=? AND request_id=?', context.user.id, channelId, id);
          const savedFile = existing?.file_id && one('SELECT * FROM files WHERE id=?', existing.file_id);
          if (savedFile && savedFile.message_id !== null) throw recoveryError('UPLOAD_CONSUMED', '이미 메시지에 첨부한 파일이라 보내기 취소로 지울 수 없어요.');
          if (savedFile) { recordFileCancellation(savedFile, context.user.id); queueFileDeletion(savedFile); run('DELETE FROM files WHERE id=?', savedFile.id); }
          // Pending means no file record was committed. Stop future commits and leave
          // any remote-cleanup outbox intact; cancellation does not promise Drive deletion.
          if (existing) run("UPDATE file_upload_requests SET state='cancelled' WHERE user_id=? AND channel_id=? AND request_id=?", context.user.id, channelId, id);
          else run("INSERT INTO file_upload_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'cancelled',?)", context.user.id, channelId, id, '', now());
          return savedFile;
        });
        if (file?.storage_provider === 'local') await removeDiskFile(file.disk_name);
        if (file) await retryDriveDeletions();
        return respond(200, { status: 'cancelled' });
      }
      const receipt = method === 'DELETE' ? transaction(() => {
        const existing = one('SELECT * FROM message_send_requests WHERE user_id=? AND channel_id=? AND request_id=?', context.user.id, channelId, id);
        if (existing) return existing;
        run("INSERT INTO message_send_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'cancelled',?)", context.user.id, channelId, id, '', now());
        return { state: 'cancelled' };
      }) : one(`SELECT * FROM ${action === 'messages' ? 'message_send_requests' : 'file_upload_requests'} WHERE user_id=? AND channel_id=? AND request_id=?`, context.user.id, channelId, id);
      if (method === 'DELETE' && receipt.state === 'cancelled') return respond(200, { status: 'cancelled' });
      assert(receipt, 404, '보낸 기록이 없어요. 같은 내용으로 다시 보내 주세요.');
      if (action === 'messages') return respond(200, sentRequestResult(receipt, context.user.id));
      const file = uploadedRequestFile(receipt, JSON.stringify([context.user.id, channelId, id]));
      if (!file) throw Object.assign(new AppError(404, '파일 저장이 끝나지 않았어요. 같은 파일을 다시 올려 주세요.'), { code: 'UPLOAD_NOT_COMPLETE' });
      return respond(200, { status: 'uploaded', file: fileShape(file) });
    
    })(); }
    match = p.match(/^\/api\/channels\/([^/]+)\/(messages|read|files|pins)$/);
    if (match) {
      const channelId = match[1]; const action = match[2];
      requireChannel(context.user.id, channelId);
      const supported = action === 'messages' ? ['GET', 'POST'].includes(method) : action === 'pins' ? method === 'GET' : method === 'POST';
      if (!supported) return NOT_HANDLED;
      return (async () => {
      if (action === 'pins' && method === 'GET') {
        const rows = all('SELECT m.* FROM messages m JOIN message_pins p ON p.message_id=m.id WHERE m.channel_id=? ORDER BY p.created_at DESC,m.id DESC', channelId);
        return respond(200, { messages: rows.map(message => messageShape(message, context.user.id)) });
      }
      if (action === 'messages' && method === 'GET') {
        const requested = url.searchParams.get('limit');
        const limit = requested === null ? 50 : Number(requested);
        assert(Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '메시지는 한 번에 1~100개까지 불러올 수 있어요.');
        const before = url.searchParams.get('before');
        if (before !== null) {
          assert(/^\d+$/.test(before) && one('SELECT 1 FROM messages WHERE id=? AND channel_id=?', before, channelId), 400, '이전 메시지 위치를 찾지 못했어요. 대화를 새로 불러와 주세요.');
        }
        const rows = all('SELECT * FROM messages WHERE channel_id=? AND id<? ORDER BY id DESC LIMIT ?', channelId, before ? Number(before) : Number.MAX_SAFE_INTEGER, limit + 1);
        return respond(200, { messages: rows.slice(0, limit).reverse().map(m => messageShape(m, context.user.id)), hasMore: rows.length > limit });
      }
      if (action === 'read' && method === 'POST') {
        const body = await readBody();
        requireChannel(context.user.id, channelId);
        let lastRead = one('SELECT COALESCE(MAX(id),0) AS id FROM messages WHERE channel_id=?', channelId).id;
        if (body.messageId !== undefined) {
          assert(typeof body.messageId === 'string' && /^[1-9]\d*$/.test(body.messageId) && Number.isSafeInteger(Number(body.messageId)) && one('SELECT 1 FROM messages WHERE id=? AND channel_id=?', body.messageId, channelId), 400, '읽은 메시지 위치를 찾지 못했어요. 대화를 새로 불러와 주세요.');
          lastRead = Number(body.messageId);
        }
        run('UPDATE memberships SET last_read=MAX(last_read,?) WHERE channel_id=? AND user_id=?', lastRead, channelId, context.user.id);
        publish('read', channelId, context.user.id);
        return respond(200, { ok: true });
      }
      if (action === 'files' && method === 'POST') return respond(201, { file: await upload(req, res, context.user, channelId, revalidate) });
      if (action === 'messages' && method === 'POST') {
        requirePosting(context.user.id, channelId);
        const body = await readBody();
        const channel = requirePosting(context.user.id, channelId);
        const content = textField(body.body ?? '', '메시지', 8000);
        const fileIds = body.fileIds ?? [];
        assert(Array.isArray(fileIds) && fileIds.length <= 5 && fileIds.every(id => typeof id === 'string') && new Set(fileIds).size === fileIds.length, 400, '파일은 메시지 하나에 5개까지 첨부할 수 있어요.');
        const mentionIds = body.mentionIds ?? [];
        assert(Array.isArray(mentionIds) && mentionIds.length <= 30 && mentionIds.every(id => typeof id === 'string') && new Set(mentionIds).size === mentionIds.length, 400, '멘션은 한 번에 30명까지 할 수 있어요.');
        const replyToId = body.replyToId ?? null;
        if (replyToId !== null) {
          assert(typeof replyToId === 'string' && /^[1-9]\d*$/.test(replyToId) && Number.isSafeInteger(Number(replyToId)), 400, '답글을 달 메시지를 찾지 못했어요. 대화를 새로 불러와 주세요.');
        }
        const clientMessageId = body.clientMessageId === undefined ? null : requestId(body.clientMessageId, '메시지 전송');
        const fingerprint = clientMessageId ? hash(JSON.stringify(canonical({ content, fileIds: [...fileIds].sort(), replyToId, mentionIds: [...mentionIds].sort(), workspaceLink: body.workspaceLink ?? null, ackRequired: body.ackRequired ?? (channel.system_key === 'announcements') }))) : null;
        // Resolve retries before consumed-file or deleted-parent checks. The receipt and
        // original message are committed together; a deleted original retains a tombstone.
        const prior = clientMessageId && one('SELECT * FROM message_send_requests WHERE user_id=? AND channel_id=? AND request_id=?', context.user.id, channelId, clientMessageId);
        if (prior) {
          if (prior.state === 'cancelled') throw recoveryError('MESSAGE_CANCELLED', '보내기를 취소한 메시지라 보내지 않았어요. 필요하면 새로 보내 주세요.');
          if (prior.payload_hash !== fingerprint) throw recoveryError('MESSAGE_REQUEST_CONFLICT', '다른 메시지와 전송 정보가 겹쳐 보내지 않았어요. 새로고침한 뒤 다시 보내 주세요.');
          return respond(200, { ...sentRequestResult(prior, context.user.id), replayed: true });
        }
        const extras = collaboration.prepareMessage(body, channel, context.user.id, null, integration?.origin || `http://${req.headers.host}`);
        assert(content || fileIds.length || extras.workspaceLink, 400, '메시지를 쓰거나 파일·화면 링크를 첨부해 주세요.');
        if (replyToId !== null) assert(one('SELECT id FROM messages WHERE id=? AND channel_id=?', replyToId, channelId), 404, '답글을 달 메시지가 이 대화방에 없어요. 대화를 새로 불러와 주세요.');
        const created = collaboration.unitOfWork.run(() => {
          for (const id of fileIds) assert(one('SELECT 1 FROM files WHERE id=? AND channel_id=? AND uploader_id=? AND message_id IS NULL', id, channelId, context.user.id), 400, '첨부할 수 없는 파일이 있어요. 첨부를 빼고 다시 올려 주세요.');
          const id = Number(run('INSERT INTO messages(channel_id,user_id,body,created_at,reply_to_id) VALUES(?,?,?,?,?)', channelId, context.user.id, content, now(), replyToId === null ? null : Number(replyToId)).lastInsertRowid);
          for (const fileId of fileIds) run('UPDATE files SET message_id=? WHERE id=?', id, fileId);
          collaboration.applyMessage(id, extras);
          if (clientMessageId) run('INSERT INTO message_send_requests(user_id,channel_id,request_id,payload_hash,message_id,created_at) VALUES(?,?,?,?,?,?)', context.user.id, channelId, clientMessageId, fingerprint, id, now());
          const message = one('SELECT * FROM messages WHERE id=?', id);
          collaboration.notifyMessage(message);
          return message;
        });
        publish('message', channelId);
        return respond(201, { message: messageShape(created, context.user.id) });
      }
    
    })(); }
    match = p.match(/^\/api\/messages\/(\d+)(\/(?:reactions|pin|replies))?$/);
    if (match) {
      let message = requireMessage(match[1], context.user.id);
      const supported = !match[2] ? ['GET', 'PATCH', 'DELETE'].includes(method) : match[2] === '/pin' ? ['POST', 'DELETE'].includes(method) : match[2] === '/replies' ? method === 'GET' : method === 'POST';
      if (!supported) return NOT_HANDLED;
      return (async () => {
      if (method === 'GET' && !match[2]) return respond(200, { message: messageShape(message, context.user.id) });
      if (method === 'GET' && match[2] === '/replies') {
        const limit = Number(url.searchParams.get('limit') ?? 50);
        const before = url.searchParams.get('before');
        assert(Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '답글은 한 번에 1~100개까지 불러올 수 있어요.');
        if (before !== null) assert(/^[1-9]\d*$/.test(before) && one('SELECT 1 FROM messages WHERE id=? AND channel_id=? AND reply_to_id=?', before, message.channel_id, message.id), 400, '이전 답글 위치를 찾지 못했어요. 답글을 새로 불러와 주세요.');
        const rows = all('SELECT * FROM messages WHERE reply_to_id=? AND channel_id=? AND id<? ORDER BY id DESC LIMIT ?', message.id, message.channel_id, before ? Number(before) : Number.MAX_SAFE_INTEGER, limit + 1);
        return respond(200, { parent: messageShape(message, context.user.id), messages: rows.slice(0, limit).reverse().map(reply => messageShape(reply, context.user.id)), hasMore: rows.length > limit });
      }
      if (match[2] === '/pin' && ['POST', 'DELETE'].includes(method)) {
        if (method === 'POST') await readBody();
        message = requireMessage(match[1], context.user.id);
        requirePosting(context.user.id, message.channel_id);
        if (method === 'POST') {
          assert(one('SELECT 1 FROM message_pins WHERE message_id=?', message.id) || one('SELECT COUNT(*) AS n FROM message_pins p JOIN messages m ON m.id=p.message_id WHERE m.channel_id=?', message.channel_id).n < 50, 409, '고정 메시지는 대화방마다 50개까지예요. 다른 고정을 풀고 다시 해 주세요.');
          run('INSERT OR IGNORE INTO message_pins(message_id,user_id,created_at) VALUES(?,?,?)', message.id, context.user.id, now());
        } else run('DELETE FROM message_pins WHERE message_id=?', message.id);
        publish('message', message.channel_id);
        return respond(200, { message: messageShape(message, context.user.id) });
      }
      if (method === 'POST' && match[2] === '/reactions') {
        const body = await readBody();
        message = requireMessage(match[1], context.user.id);
        assert(EMOJI.has(body.emoji), 400, '쓸 수 없는 반응이에요.');
        transaction(() => {
          const removed = run('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?', message.id, context.user.id, body.emoji);
          if (!removed.changes) run('INSERT INTO reactions(message_id,user_id,emoji) VALUES(?,?,?)', message.id, context.user.id, body.emoji);
        });
        publish('message', message.channel_id);
        return respond(200, { message: messageShape(message, context.user.id) });
      }
      if (method === 'PATCH' && !match[2]) {
        assert(message.user_id === context.user.id, 403, '내가 쓴 메시지만 고칠 수 있어요.');
        const body = await readBody();
        message = requireMessage(match[1], context.user.id);
        const channel = requirePosting(context.user.id, message.channel_id);
        collaboration.productivity.assertMessageMutable(message.id);
        const content = textField(body.body, '메시지', 8000);
        const extras = collaboration.prepareMessage(body, channel, context.user.id, message, integration?.origin || `http://${req.headers.host}`);
        assert(content || extras.workspaceLink || one('SELECT id FROM files WHERE message_id=? LIMIT 1', message.id), 400, '빈 메시지로는 고칠 수 없어요. 내용을 적어 주세요.');
        collaboration.unitOfWork.run(() => {
          run('UPDATE messages SET body=?,edited_at=? WHERE id=?', content, now(), message.id);
          collaboration.applyMessage(message.id, extras, { edit: true });
          collaboration.notifyMessage(one('SELECT * FROM messages WHERE id=?', message.id), { edit: true });
        });
        publish('message', message.channel_id);
        return respond(200, { message: messageShape(one('SELECT * FROM messages WHERE id=?', message.id), context.user.id) });
      }
      if (method === 'DELETE' && !match[2]) {
        const channel = requireChannel(context.user.id, message.channel_id);
        assert(message.user_id === context.user.id || (context.user.role === 'owner' && channel.kind === 'channel'), 403, '내가 쓴 메시지만 삭제할 수 있어요.');
        collaboration.productivity.assertMessageMutable(message.id);
        const files = all('SELECT * FROM files WHERE message_id=?', message.id);
        transaction(() => {
          for (const f of files) queueFileDeletion(f);
          run('DELETE FROM messages WHERE id=?', message.id);
        });
        for (const f of files) if (f.storage_provider === 'local') await removeDiskFile(f.disk_name);
        await retryDriveDeletions();
        publish('message', message.channel_id);
        return respond(200, { ok: true });
      }
    
    })(); }
    return NOT_HANDLED;
  };
}
