// 직원 경로 /api/path-cases/*(PATH 상담함). 회사 세션 쿠키 + 같은 출처 + CSRF로 쓴다. 권한은 path-cases.mjs가 PATH 소속 역할로 직접 본다.
const CASE = /^\/api\/path-cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(assign|reply|task|close|erase-check|erase|translate-draft))?$/;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function createPathCaseStaffRoutes({ pathCases, session, origin, body, send, audit = () => {} }) {
  return async function pathCaseRoutes(req, res, url, auth) {
    const path = url.pathname, method = req.method;
    if (path !== '/api/path-cases' && !path.startsWith('/api/path-cases/')) return false;
    if (!auth) throw fail('먼저 로그인해 주세요.', 401);
    if (url.search) throw fail('PATH 상담함 주소를 확인해 주세요.');
    const route = CASE.exec(path), user = auth.user;
    if (method === 'GET') {
      if (path === '/api/path-cases') { send(res, 200, pathCases.list(user)); return true; }
      if (route && !route[2]) {
        // 상세를 열면 「보는 중」으로 바뀌고 급함 알림을 읽는다. 다른 사이트를 거친 최상위 이동 · 남의 출처 요청으로는 열지 않는다.
        const mode = req.headers['sec-fetch-mode'], site = req.headers['sec-fetch-site'];
        if (mode === 'navigate' || (site !== undefined && site !== 'same-origin')) throw fail('회사 프로그램 화면에서 열어 주세요.', 403);
        send(res, 200, pathCases.detail(user, route[1])); return true;
      }
      throw fail('PATH 상담함 주소를 확인해 주세요.', 404);
    }
    if (method !== 'POST') throw fail('요청 방법을 확인해 주세요.', 405);
    if (path !== '/api/path-cases/settings' && !(route && route[2])) throw fail('PATH 상담함 주소를 확인해 주세요.', 404);
    if (req.headers.origin !== origin || req.headers['x-csrf-token'] !== auth.body.csrfToken) throw fail('회사 프로그램 화면에서 요청해 주세요.', 403);
    const input = await body(req, { maxBytes: 16000, maxChars: 8000 }), latest = session(req);
    if (!latest || latest.hash !== auth.hash || latest.user.id !== user.id) throw fail('로그인 상태를 다시 확인해 주세요.', 401);
    if (req.headers['x-csrf-token'] !== latest.body.csrfToken) throw fail('회사 프로그램 화면에서 요청해 주세요.', 403);
    const actor = latest.user;
    if (path === '/api/path-cases/settings') { send(res, 200, pathCases.configure(actor, input)); return true; }
    const [, id, action] = route;
    let result;
    if (action === 'assign') result = pathCases.assign(actor, id, input);
    else if (action === 'reply') result = pathCases.reply(actor, id, input);
    else if (action === 'task') result = pathCases.task(actor, id, input);
    else if (action === 'close') result = pathCases.close(actor, id, input);
    else if (action === 'erase-check') result = pathCases.eraseCheck(actor, id, input);
    else if (action === 'translate-draft') result = await pathCases.translateDraft(actor, id, input);
    else {
      result = pathCases.erase(actor, id, input);
      // 기록에는 건 번호와 시각만 남긴다. 학생 글 · 요약은 싣지 않는다.
      if (!result.erased.repeated) audit(actor, 'path-case-erased', id);
    }
    send(res, 200, result);
    return true;
  };
}
