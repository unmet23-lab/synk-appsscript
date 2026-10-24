import { NOT_HANDLED } from './request-router.mjs';

// Owns the member-account HTTP contract; authentication stays in the request context.
export function createMemberAccountRoutes({ SESSION_MS, all, assert, bridge, hash, members, now, randomBytes, randomUUID, run, subscribers, voiceService }) {
  return function handle(context) {
    const { method, p, res, respond } = context;
    if (method === 'POST' && p === '/api/logout') { return (async () => {
      run('DELETE FROM sessions WHERE token=?', context.auth.token);
      await voiceService.sweep();
      res.setHeader('Set-Cookie', 'synk_messenger_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      for (const client of subscribers) if (client.token === context.auth.token) { client.res.end(); subscribers.delete(client); }
      return respond(200, { ok: true });
    
    })(); }
    if (method === 'GET' && p === '/api/members') return respond(200, { members: members() });
    if (method === 'GET' && p === '/api/directory') return respond(200, { members: members(), teams: bridge?.teamsFor(context.user.id) || [] });
    if (p === '/api/invites' || p.startsWith('/api/invites/')) {
      assert(context.user.role === 'owner', 403, '초대 코드는 관리자만 만들고 취소할 수 있어요.');
      if (method === 'POST' && p === '/api/invites') {
        const code = `${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`.toUpperCase();
        const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
        run('INSERT INTO invites(id,code_hash,created_at,expires_at) VALUES(?,?,?,?)', randomUUID(), hash(code), now(), expiresAt);
        return respond(201, { code, expiresAt });
      }
      if (method === 'GET' && p === '/api/invites') return respond(200, { invites: all('SELECT id,created_at AS createdAt,expires_at AS expiresAt,used_at AS usedAt,revoked_at AS revokedAt FROM invites ORDER BY created_at DESC') });
      if (method === 'DELETE' && /^\/api\/invites\/[^/]+$/.test(p)) {
        assert(run('UPDATE invites SET revoked_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL', now(), p.split('/')[3]).changes, 404, '취소할 초대 코드가 없어요. 목록을 새로 불러와 주세요.');
        return respond(200, { ok: true });
      }
    }
    return NOT_HANDLED;
  };
}
