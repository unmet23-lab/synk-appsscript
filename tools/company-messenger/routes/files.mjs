import { NOT_HANDLED } from './request-router.mjs';

// Owns the files HTTP contract; authentication stays in the request context.
export function createFilesRoutes({ AppError, FILE_EXTENSIONS, FILE_TYPE_SQL, activeDownloads, all, assert, bridge, departureVersion, drive, driveStatus, fileShape, integration, one, open, path, pendingDeletions, pipeline, publish, queueFileDeletion, recordFileCancellation, recoveryError, removeDiskFile, requireChannel, retryDriveDeletions, run, textField, transaction, uploadDir }) {
  return function handle(context) {
    const { method, p, readBody, res, respond, revalidate, url } = context;
    if (method === 'GET' && p === '/api/files') {
      const channelId = url.searchParams.get('channelId');
      if (channelId) requireChannel(context.user.id, channelId);
      const query = textField(url.searchParams.get('q') ?? '', '파일 검색어', 200);
      const type = url.searchParams.get('type') || 'all';
      const uploaderId = url.searchParams.get('uploaderId') || null;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 200);
      assert(type === 'all' || type === 'other' || Object.hasOwn(FILE_EXTENSIONS, type), 400, '파일 종류를 다시 골라 주세요.');
      assert(uploaderId === null || uploaderId.length <= 100, 400, '파일을 올린 사람을 다시 골라 주세요.');
      assert(Number.isSafeInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 200, 400, '파일 목록을 불러오지 못했어요. 다시 불러와 주세요.');
      const escaped = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
      const rows = all(`SELECT f.* FROM files f JOIN memberships c ON c.channel_id=f.channel_id AND c.user_id=? JOIN channels r ON r.id=f.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1) AND f.message_id IS NOT NULL AND (? IS NULL OR f.channel_id=?) AND f.name LIKE ? ESCAPE '\\' AND (? IS NULL OR f.uploader_id=?) AND (?='all' OR (${FILE_TYPE_SQL})=?) ORDER BY f.created_at DESC,f.id DESC LIMIT ? OFFSET ?`, context.user.id, bridge ? 1 : 0, channelId, channelId, escaped, uploaderId, uploaderId, type, type, limit + 1, offset);
      return respond(200, { files: rows.slice(0, limit).map(fileShape), hasMore: rows.length > limit, nextOffset: rows.length > limit ? offset + limit : null });
    }
    let match = p.match(/^\/api\/files\/([^/]+)$/);
    if (match) {
      const f = one('SELECT * FROM files WHERE id=?', match[1]);
      if (!f && method === 'DELETE') {
        const receipt = one('SELECT channel_id FROM file_deletion_receipts WHERE user_id=? AND file_id=?', context.user.id, match[1]);
        if (receipt) {
          requireChannel(context.user.id, receipt.channel_id);
          throw Object.assign(new AppError(404, '이미 취소한 첨부 파일이에요.'), { code: 'UPLOAD_DELETED' });
        }
      }
      assert(f, 404, '파일을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      const lifecycleVersion = requireChannel(context.user.id, f.channel_id).lifecycle_version;
      const membershipVersion = departureVersion(f.channel_id, context.user.id);
      assert(f.message_id !== null || f.uploader_id === context.user.id, 404, '파일을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      if (!['GET', 'DELETE'].includes(method)) return NOT_HANDLED;
      return (async () => {
      if (method === 'DELETE') {
        assert(f.uploader_id === context.user.id, 403, '보내기 전인 내 파일만 첨부를 뺄 수 있어요.');
        if (f.message_id !== null) throw recoveryError('UPLOAD_CONSUMED', '이미 보낸 파일은 대화에 그대로 남아요.');
        transaction(() => { recordFileCancellation(f, context.user.id); queueFileDeletion(f); run('DELETE FROM files WHERE id=?', f.id); });
        if (f.storage_provider === 'local') await removeDiskFile(f.disk_name);
        await retryDriveDeletions();
        return respond(200, { ok: true });
      }
      if (method === 'GET') {
        let stream;
        if (f.storage_provider === 'google-drive') {
          stream = await drive.download({ connectionId: f.storage_connection_id, remoteId: f.storage_remote_id, fileId: f.id, expectedSize: f.size, expectedMd5: f.md5 });
        } else {
          const filePath = path.join(uploadDir, f.disk_name);
          let handle;
          try { handle = await open(filePath, 'r'); } catch { throw new AppError(404, '저장된 파일을 찾지 못했어요. 관리자에게 알려 주세요.'); }
          stream = handle.createReadStream();
        }
        try {
          revalidate();
          assert(requireChannel(context.user.id, f.channel_id).lifecycle_version === lifecycleVersion, 409, '그사이 대화방이 삭제되거나 복원됐어요. 파일을 다시 열어 주세요.');
          assert(departureVersion(f.channel_id, context.user.id) === membershipVersion, 409, '그사이 프로젝트 참여가 바뀌었어요. 파일을 다시 열어 주세요.');
        } catch (error) { stream.destroy(); throw error; }
        const download = { channelId: f.channel_id, userId: context.user.id, stream, res };
        activeDownloads.add(download);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': f.size, 'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`, 'Content-Security-Policy': "default-src 'none'; sandbox" });
        try { await pipeline(stream, res); } finally { activeDownloads.delete(download); }
        return;
      }
    
    })(); }
    if (method === 'GET' && p === '/api/storage/drive') { return (async () => {
      assert(context.user.role === 'owner', 403, 'Drive 연결 정보는 관리자만 볼 수 있어요.');
      return respond(200, await driveStatus({ fresh: true }));
    
    })(); }
    if (method === 'POST' && p === '/api/storage/drive/active') { return (async () => {
      assert(context.user.role === 'owner', 403, '파일 저장 위치는 관리자만 바꿀 수 있어요.');
      const body = await readBody();
      assert(body.connectionId === null || (typeof body.connectionId === 'string' && body.connectionId.length > 0 && body.connectionId.length <= 200), 400, '등록한 Drive 계정을 골라 주세요.');
      const status = await drive.setActive(body.connectionId, { beforeCommit: revalidate });
      publish('storage');
      return respond(200, { ...status, pendingDeletions: pendingDeletions() });
    
    })(); }
    if (method === 'GET' && p === '/api/storage') { return (async () => {
      const owner = context.user.role === 'owner';
      const provider = await drive.active() ? 'google-drive' : 'local';
      const driveInfo = owner ? await driveStatus() : null;
      revalidate();
      const storage = owner && !integration ? one("SELECT COALESCE(SUM(f.size),0) AS bytes,COUNT(*) AS fileCount FROM files f JOIN channels r ON r.id=f.channel_id WHERE r.deleted_at IS NULL AND r.scope<>'team' AND (r.kind<>'channel' OR (r.scope<>'private' AND r.category<>'project') OR EXISTS(SELECT 1 FROM memberships c WHERE c.channel_id=r.id AND c.user_id=?))", context.user.id) : one("SELECT COALESCE(SUM(f.size),0) AS bytes,COUNT(*) AS fileCount FROM files f JOIN memberships c ON c.channel_id=f.channel_id AND c.user_id=? JOIN channels r ON r.id=f.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1) AND (f.message_id IS NOT NULL OR f.uploader_id=?)", context.user.id, bridge ? 1 : 0, context.user.id);
      const messageCount = owner && !integration ? one("SELECT COUNT(*) AS n FROM messages m JOIN channels r ON r.id=m.channel_id WHERE r.deleted_at IS NULL AND r.scope<>'team' AND (r.kind<>'channel' OR (r.scope<>'private' AND r.category<>'project') OR EXISTS(SELECT 1 FROM memberships c WHERE c.channel_id=r.id AND c.user_id=?))", context.user.id).n : one("SELECT COUNT(*) AS n FROM messages m JOIN memberships c ON c.channel_id=m.channel_id AND c.user_id=? JOIN channels r ON r.id=m.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1)", context.user.id, bridge ? 1 : 0).n;
      return respond(200, { ...storage, messageCount, memberCount: one('SELECT COUNT(*) AS n FROM users').n, provider, ...(owner ? { drive: driveInfo } : {}) });
    
    })(); }
    return NOT_HANDLED;
  };
}
