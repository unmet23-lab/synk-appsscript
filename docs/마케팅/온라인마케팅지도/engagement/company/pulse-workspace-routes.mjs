import { createClientAddress } from './request-security.mjs';

// PULSE 「내 모델」 회원 경로(2026-11-10 판 4, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md 4-2 · 5판 D1 · D2).
// 고객 SYNK ID 세션(쿠키 Path=/api/customer)으로만 열리고 직원 권한 · 초대 세션을 만들지 않는다. AI 마켓 경로와 같은 꼴이다:
// 같은 출처 → 중앙 계정 확인 → CSRF → 몸통 → 다시 중앙 확인 → CSRF → 동기 트랜잭션(pulse-workspaces.mjs).
// 스위치 myModels가 꺼져 있으면 이 앞부분의 모든 주소가 404다(로그인 시작 포함). 주소 뒤 질의(?…)는 받지 않는다.
const PREFIX = '/api/customer/pulse';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const emptyObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
const POSTS = {
  '/project-state': 'projectState', '/claim': 'claim', '/claim/withdraw': 'withdrawClaim', '/draft-persona': 'attach',
  '/reuse': 'reuse', '/reuse/withdraw': 'withdrawReuse', '/stop': 'stop', '/delete-request': 'deleteRequest',
};

// serveMedia(req,res,media,authorize): 판 파일을 private · no-store로 내린다(server.mjs의 serveStudioMedia).
export function createPulseMemberRoutes({ identity, workspaces, origin, send, body, serveMedia, enabled = () => false,
  stopping = () => false, now = () => Date.now(), clientAddress = createClientAddress() }) {
  const attempts = new Map();
  function rate(key, maximum) {
    const stamp = now();
    for (const [id, entry] of attempts) if (entry.until <= stamp) attempts.delete(id);
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10000) throw failure(429, 'RATE_LIMITED', '요청이 많아요. 잠시 뒤 다시 시도해 주세요.');
      entry = { count: 0, until: stamp + 60000 }; attempts.set(key, entry);
    }
    if (++entry.count > maximum) throw failure(429, 'RATE_LIMITED', '요청이 많아요. 잠시 뒤 다시 시도해 주세요.');
  }
  function requireCurrent(auth) {
    if (!auth || !identity.isCurrent(auth)) throw failure(401, 'LOGIN_REQUIRED', 'SYNK ID로 로그인해 주세요.');
  }
  async function authenticated(req) { const auth = await identity.authenticate(req); requireCurrent(auth); return auth; }
  async function mutate(req) {
    if (req.headers.origin !== origin) throw failure(403, 'ORIGIN_REJECTED', 'PULSE 화면에서 다시 요청해 주세요.');
    const auth = await authenticated(req);
    identity.requireCsrf(req, auth);
    rate('write:' + auth.user.synkUserId, 120);
    const input = await body(req, { maxBytes: 8192, maxChars: 8192 });
    const latest = await authenticated(req);
    if (!identity.isCurrent(auth) || latest.user !== auth.user) throw failure(401, 'SESSION_CHANGED', '로그인 상태가 바뀌었어요. 다시 로그인해 주세요.');
    identity.requireCsrf(req, auth);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure(400, 'INVALID_INPUT', '입력 내용을 확인해 주세요.');
    return { auth, input };
  }
  return async function pulseMemberRoutes(req, res, url) {
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return false;
    res.setHeader('Cache-Control', 'no-store');
    const respond = (status, data) => { send(res, status, data); return true; };
    try {
      if (stopping()) throw failure(503, 'SERVICE_RESTARTING', '서버가 다시 시작되고 있어요. 잠시 뒤 다시 시도해 주세요.');
      if (!enabled()) throw failure(404, 'NOT_FOUND', '요청한 주소를 찾을 수 없어요.');
      if (url.search) throw failure(400, 'INVALID_QUERY', '주소에 추가 정보를 넣을 수 없어요.');
      rate('ip:' + clientAddress(req), 600);
      const path = url.pathname.slice(PREFIX.length), method = req.method;
      if (path === '/session' && method === 'GET') {
        const auth = await identity.authenticate(req), current = auth && identity.isCurrent(auth);
        return respond(200, { authenticated: Boolean(current), user: current ? { name: auth.user.name } : null,
          csrfToken: current ? auth.csrfToken : null, loginAvailable: identity.status().enabled });
      }
      // 로그인 시작(5판 D1): 돌아갈 곳은 서버가 정한 /pulse-app/ 하나. 콜백은 customer-routes.mjs가 그 값으로(실패면 ?login=failed를 붙여) 보낸다.
      if (path === '/login' && method === 'POST') {
        if (req.headers.origin !== origin) throw failure(403, 'ORIGIN_REJECTED', 'PULSE 화면에서 다시 요청해 주세요.');
        if (!emptyObject(await body(req, { maxBytes: 1024, maxChars: 1024 }))) throw failure(400, 'INVALID_INPUT', '로그인 요청을 확인해 주세요.');
        return respond(200, identity.start(req, res, { returnTo: '/pulse-app/' }));
      }
      const modelMatch = path.match(new RegExp(`^/models/(${UUID})$`)), assetMatch = path.match(new RegExp(`^/asset/(${UUID})$`));
      if (['GET', 'HEAD'].includes(method) && assetMatch) {
        const auth = await authenticated(req), media = workspaces.asset(auth.user, assetMatch[1]);
        // 파일을 내리기 직전에 로그인 · 회원 · 사슬을 다시 본다(내려받는 동안 회원에서 빠졌으면 멈춘다).
        await serveMedia(req, res, media, () => { requireCurrent(auth); workspaces.asset(auth.user, assetMatch[1]); });
        return true;
      }
      if (method === 'GET') {
        if (path === '/models') { const auth = await authenticated(req); return respond(200, workspaces.models(auth.user)); }
        if (modelMatch) { const auth = await authenticated(req); return respond(200, workspaces.model(auth.user, modelMatch[1])); }
      }
      if (!Object.hasOwn(POSTS, path)) throw failure(404, 'NOT_FOUND', '요청한 주소를 찾을 수 없어요.');
      if (method !== 'POST') throw failure(405, 'METHOD_NOT_ALLOWED', '요청 방법을 확인해 주세요.');
      const { auth, input } = await mutate(req);
      // 비동기 경계 뒤 마지막 확인은 동기 저장소 접근 바로 앞에서(AI 마켓과 같다).
      requireCurrent(auth); identity.requireCsrf(req, auth);
      return respond(200, workspaces[POSTS[path]](auth.user, input));
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        if (error.status === 429) res.setHeader('Retry-After', '60');
        const code = /^[A-Z][A-Z0-9_]{0,90}$/.test(error.code || '') ? error.code : 'REQUEST_REJECTED';
        return respond(error.status, { error: error.message, code, ...(error.offer ? { offer: error.offer } : {}) });
      }
      if (error.status === 503) return respond(503, { error: '서버 연결을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.', code: 'SERVICE_UNAVAILABLE' });
      throw error; // 예상하지 못한 저장소 · 내부 오류는 회사 서버의 오류 경계가 가린다.
    }
  };
}
