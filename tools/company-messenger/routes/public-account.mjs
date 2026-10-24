import { NOT_HANDLED } from './request-router.mjs';

// Owns the public-account HTTP contract; authentication stays in the request context.
export function createPublicAccountRoutes({ accountInput, assert, bootstrap, createUser, ensureSystemChannels, hasSetup, hash, issueSession, now, one, passwordHash, passwordMatches, publish, rateLimit, run, textField, transaction }) {
  return function handle(context) {
    const { method, p, readBody, req, res, respond } = context;
    if (method === 'GET' && p === '/api/bootstrap') { return (async () => {return respond(200, await bootstrap(context.user, context.auth?.identity));
    })(); }
    if (method === 'POST' && p === '/api/setup') { return (async () => {
    assert(!hasSetup(), 409, '이미 처음 설정을 마쳤어요. 로그인해 주세요.');
    rateLimit(req, 'setup');
    const body = await readBody();
    const input = accountInput(body);
    const name = textField(body.workspaceName, '워크스페이스 이름', 60, 1);
    const password = await passwordHash(input.password);
    const created = transaction(() => {
      assert(!hasSetup(), 409, '이미 처음 설정을 마쳤어요. 로그인해 주세요.');
      run("INSERT INTO settings(key,value) VALUES('workspace_name',?)", name);
      const owner = createUser(input, password, 'owner');
      ensureSystemChannels([owner.id]);
      return owner;
    });
    issueSession(res, created.id);
    return respond(201, await bootstrap(created));
    
    })(); }
    if (method === 'POST' && p === '/api/login') { return (async () => {
    const body = await readBody();
    assert(typeof body.username === 'string' && typeof body.password === 'string' && body.password.length <= 128, 400, '아이디와 비밀번호를 입력해 주세요.');
    rateLimit(req, `login:${body.username.trim().toLowerCase()}`);
    const found = one('SELECT * FROM users WHERE username=?', body.username.trim());
    const encoded = found?.password || `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    assert(await passwordMatches(body.password, encoded) && found, 401, '아이디나 비밀번호가 맞지 않아요. 다시 확인해 주세요.');
    issueSession(res, found.id);
    return respond(200, await bootstrap(found));
    
    })(); }
    if (method === 'POST' && p === '/api/join') { return (async () => {
    rateLimit(req, 'join');
    const body = await readBody();
    const input = accountInput(body);
    const code = textField(body.code, '초대 코드', 100, 1).toUpperCase();
    const password = await passwordHash(input.password);
    const created = transaction(() => {
      const invitation = one('SELECT * FROM invites WHERE code_hash=?', hash(code));
      assert(invitation && !invitation.used_at && !invitation.revoked_at && invitation.expires_at > now(), 400, '쓸 수 없는 초대 코드예요. 관리자에게 새 코드를 받아 주세요.');
      const member = createUser(input, password, 'member');
      run('UPDATE invites SET used_at=? WHERE id=?', now(), invitation.id);
      return member;
    });
    issueSession(res, created.id);
    publish('member');
    return respond(201, await bootstrap(created));
    
    })(); }
    return NOT_HANDLED;
  };
}
