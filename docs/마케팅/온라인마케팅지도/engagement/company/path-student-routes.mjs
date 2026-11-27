import { MAX_REQUEST_BYTES } from '../../../../../experiences/path-app/ask-shape.mjs';
import { createAttemptLimiter } from './request-security.mjs';

// PATH 앱 학생 경로 /api/path-student/*(AI상담_설계.md 「요청과 답의 꼴 · Workspace」).
// Bearer만 받는다. 쿠키는 읽지 않고 자격 증명을 허용하지 않으므로 CSRF 토큰은 두지 않는다.
// CORS는 https://synk.im 하나만, OPTIONS와 오류 답에도 싣는다. Access-Control-Allow-Credentials는 주지 않는다.
// 이 경로는 고객 경로(customerRoutes)와 직원 세션 확인보다 먼저 끝나고, 답과 오류를 여기서 직접 쓴다.
export const PATH_STUDENT_ORIGIN = 'https://synk.im';
const PREFIX = '/api/path-student/';
const CASE = /^\/api\/path-student\/cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(messages|read))?$/;
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

export function pathStudentHeaders(type = 'application/json; charset=utf-8') {
  return { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Access-Control-Allow-Origin': PATH_STUDENT_ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
}

export function createPathStudentRoutes({ pathCases, identity, clientAddress, stopping = () => false, now = () => Date.now() }) {
  // 중앙 확인 전에 주소별 한도를 먼저 본다(읽기 · 쓰기 모두 한 사람 주소에 분당 60번).
  const perAddress = createAttemptLimiter({ limit: 60, windowMs: 60000, now });
  const statusAddress = createAttemptLimiter({ limit: 120, windowMs: 60000, now });
  function write(res, status, body) {
    res.writeHead(status, pathStudentHeaders());
    res.end(body === null ? undefined : JSON.stringify(body));
  }
  async function readJson(req, maxBytes) {
    if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw fail(415, 'PATH_STUDENT_JSON', 'JSON으로 보내 주세요.');
    const chunks = []; let bytes = 0;
    for await (const part of req.iterator({ destroyOnReturn: false })) { bytes += part.length; if (bytes > maxBytes) { req.resume(); throw fail(413, 'PATH_STUDENT_TOO_LARGE', '보낸 내용이 너무 커요.'); } chunks.push(part); }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); } catch { throw fail(400, 'PATH_STUDENT_JSON', '보낸 내용의 꼴을 확인해 주세요.'); }
  }
  async function handle(req, res, url) {
    const path = url.pathname, method = req.method;
    if (method === 'OPTIONS') return write(res, 204, null);
    if (url.search) throw fail(400, 'PATH_STUDENT_PATH', '주소를 확인해 주세요.');
    // 브라우저가 보낸 출처가 있으면 synk.im이어야 한다(앱 밖의 쪽이 Bearer를 쥐고 부르는 길을 줄인다).
    if (req.headers.origin !== undefined && req.headers.origin !== PATH_STUDENT_ORIGIN) throw fail(403, 'PATH_STUDENT_ORIGIN', 'PATH 앱에서 다시 시도해 주세요.');
    if (stopping()) throw fail(503, 'PATH_STUDENT_STOPPING', '서버가 다시 시작되고 있어요. 잠시 뒤 다시 시도해 주세요.');
    if (path === PREFIX + 'status') {
      if (method !== 'GET') throw fail(405, 'PATH_STUDENT_METHOD', '요청 방법을 확인해 주세요.');
      statusAddress.reserve(clientAddress(req));
      return write(res, 200, pathCases.status());
    }
    const caseRoute = CASE.exec(path);
    if (path !== PREFIX + 'cases' && !caseRoute) throw fail(404, 'PATH_STUDENT_PATH', '주소를 확인해 주세요.');
    perAddress.reserve(clientAddress(req));
    const student = await identity.verify(req);
    if (path === PREFIX + 'cases') {
      if (method === 'GET') return write(res, 200, pathCases.studentList(student));
      if (method !== 'POST') throw fail(405, 'PATH_STUDENT_METHOD', '요청 방법을 확인해 주세요.');
      const result = pathCases.studentCreate(student, await readJson(req, MAX_REQUEST_BYTES));
      return write(res, result.status, result.body);
    }
    const [, id, action] = caseRoute;
    if (!action && method === 'DELETE') return write(res, 200, pathCases.studentDelete(student, id));
    if (action && method === 'POST') {
      const input = await readJson(req, 8192);
      if (action === 'messages') return write(res, 200, pathCases.studentMessage(student, id, input));
      if (input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 0) return write(res, 200, pathCases.studentRead(student, id));
      throw fail(400, 'PATH_STUDENT_BODY', '읽음 요청을 확인해 주세요.');
    }
    throw fail(405, 'PATH_STUDENT_METHOD', '요청 방법을 확인해 주세요.');
  }
  return async function pathStudentRoutes(req, res, url) {
    if (!url.pathname.startsWith(PREFIX)) return false;
    try { await handle(req, res, url); }
    catch (error) {
      if (res.headersSent) { res.destroy(); return true; }
      const explicit = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599;
      if (!explicit) console.error('SYNK_COMPANY_SERVER PATH_STUDENT_FAILED ' + (['SQLITE_FULL', 'SQLITE_BUSY', 'ENOSPC'].includes(error?.code) ? error.code : 'INTERNAL_ERROR'));
      const code = explicit && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{2,80}$/.test(error.code) ? error.code : explicit ? 'PATH_STUDENT_ERROR' : 'PATH_STUDENT_FAILED';
      // PATH 앱(product-account requestWorkspace)의 꼴: 실패는 { ok:false, error:{ code } }. 글은 안내용이고 앱은 code로 고른다.
      write(res, explicit ? error.status : 500, { ok: false, error: { code, message: explicit ? String(error.message || '처리하지 못했어요.') : '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        ...(error?.caseId ? { case_id: error.caseId } : {}) } });
    }
    return true;
  };
}
