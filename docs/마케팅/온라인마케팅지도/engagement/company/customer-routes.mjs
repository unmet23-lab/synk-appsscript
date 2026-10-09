const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const empty = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;

export function createCustomerRoutes({ identity, interpretation, drafts, origin, send, body, stopping = () => false }) {
  const known = new Set(['/api/customer/me', '/api/customer/logout', '/api/customer/synk-id/start',
    '/api/customer/computer-interpretation', '/api/customer/computer-interpretation/privacy', '/api/customer/computer-interpretation/delete',
    '/api/customer/computer-draft', '/api/customer/computer-draft/delete']);
  return async function customerRoutes(req, res, url) {
    const path = url.pathname, method = req.method;
    if (!path.startsWith('/api/customer/')) return false;
    if (stopping()) throw fail('서버가 다시 시작되고 있어요. 잠시 후 접속해 주세요.', 503);
    if (path === '/api/customer/synk-id/callback' && method === 'GET') {
      let location = '/consultation/';
      try { await identity.callback(req, res, url); }
      catch { location += '?login=failed'; }
      res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); return true;
    }
    if (!known.has(path)) throw fail('상담 요청 주소를 확인해 주세요.', 404);
    if (url.search) throw fail('상담 요청 주소에 추가 정보를 넣을 수 없어요.');
    if (!['GET', 'POST'].includes(method)) throw fail('요청 방법을 확인해 주세요.', 405);
    if (method === 'POST' && req.headers.origin !== origin) throw fail('상담 화면에서 다시 요청해 주세요.', 403);
    if (path === '/api/customer/synk-id/start' && method === 'POST') {
      if (!empty(await body(req, { maxBytes: 1024, maxChars: 1024 }))) throw fail('로그인 요청을 확인해 주세요.');
      send(res, 200, identity.start(req, res)); return true;
    }
    // Local logout remains available while central identity is unavailable.
    // The identity module checks this cookie's CSRF before dropping the session.
    if (path === '/api/customer/logout' && method === 'POST') {
      if (!empty(await body(req, { maxBytes: 1024, maxChars: 1024 }))) throw fail('로그아웃 요청을 확인해 주세요.');
      send(res, 200, await identity.logout(req, res)); return true;
    }
    const auth = await identity.authenticate(req), user = auth?.user;
    if (path === '/api/customer/me' && method === 'GET') {
      send(res, 200, { authenticated: !!user, user: user ? { id: user.id, name: user.name } : null,
        csrfToken: auth?.csrfToken, loginAvailable: identity.status().enabled, ai: user ? interpretation.state(user) : null }); return true;
    }
    if (!auth) throw fail('SYNK ID로 로그인해 주세요.', 401);
    const current = () => { if (!identity.isCurrent(auth)) throw fail('로그인 상태를 다시 확인해 주세요.', 401); if (method === 'POST') identity.requireCsrf(req, auth); };
    current();
    if (method === 'GET') {
      if (path === '/api/customer/computer-interpretation') send(res, 200, interpretation.state(user));
      else if (path === '/api/customer/computer-interpretation/privacy') send(res, 200, interpretation.privacy(user));
      else if (path === '/api/customer/computer-draft') send(res, 200, drafts.get(user));
      else throw fail('요청 방법을 확인해 주세요.', 405);
      return true;
    }
    const input = await body(req, { maxBytes: 32768, maxChars: 16384 });
    const latest = await identity.authenticate(req);
    current();
    if (latest?.user !== user) throw fail('로그인 상태를 다시 확인해 주세요.', 401);
    if (path === '/api/customer/computer-draft') send(res, 200, drafts.save(user, input));
    else if (path === '/api/customer/computer-draft/delete') send(res, 200, drafts.remove(user, input));
    else if (path === '/api/customer/computer-interpretation/delete') send(res, 200, interpretation.removeResponses(user, input));
    else if (path === '/api/customer/computer-interpretation') {
      try {
        const result = await interpretation.interpret(user, input, { revalidate: current });
        const latest = await identity.authenticate(req); current();
        if (latest?.user !== user) throw fail('로그인 상태를 다시 확인해 주세요.', 401);
        send(res, 200, result);
      } catch (error) {
        if (error.code !== 'SYNK_COMPUTER_AI_RESPONSE_INVALID' || !error.captureReceipt) throw error;
        const latest = await identity.authenticate(req); current();
        if (latest?.user !== user) throw fail('로그인 상태를 다시 확인해 주세요.', 401);
        const { version, id, requestId, revision, buildId, status } = error.captureReceipt;
        send(res, error.status, { error: 'AI 조건이나 원문 인용을 검증하지 못했어요. 기존 선택은 유지됩니다.', code: error.code,
          captureReceipt: { version, id, requestId, revision, buildId, status } });
      }
    } else throw fail('요청 방법을 확인해 주세요.', 405);
    return true;
  };
}
