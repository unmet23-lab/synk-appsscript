import { timingSafeEqual } from 'node:crypto';
import { createConcurrencyGuard } from './request-security.mjs';

// PATH 앱 학생의 Bearer 확인(AI상담_설계.md 「사람 연결 · 구조와 보안」). 고객 상담(customer-identity.mjs verify)과 같은 중앙 확인을 쓰되,
// 토큰의 client_id가 PATH 앱 클라이언트일 때만 받는다. 고객 상담 토큰은 여기서, PATH 토큰은 고객 상담에서 거절된다(client_id로만 갈린다).
// 서버 안에서 먼저 볼 것(토큰 꼴 · 만료 · 발급자 · client_id)을 보고, 통과한 것만 중앙에 계정 active · 현재 세션 · 철회 여부를 묻는다.
// Bearer는 저장 · 기록하지 않는다. 쿠키는 읽지 않는다. 시간 기반 캐시는 두지 않는다(요청마다 중앙 확인).
const PRODUCT = 'platform';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]{2,4096}\.[A-Za-z0-9_-]{2,8192}\.[A-Za-z0-9_-]{0,4096}$/;
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const rejected = () => fail(401, 'PATH_STUDENT_REJECTED', 'SYNK ID로 다시 로그인해 주세요.');
const unavailable = () => fail(503, 'PATH_STUDENT_UNAVAILABLE', 'SYNK ID 연결을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.');
const claimsOf = value => { try { const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')); return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null; } catch { return null; } };
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

/**
 * 설정: 중앙 계정 프로젝트는 고객 SYNK ID와 같다(SYNK_ID_CUSTOMER_SUPABASE_URL · ACCOUNT_API_URL · PUBLISHABLE_KEY).
 * PATH 앱 클라이언트만 따로 받는다(PATH_STUDENT_CLIENT_ID). 고객 · 직원 클라이언트와 같으면 쓰지 않는다.
 * 하나라도 없으면 null(학생 경로는 「준비 중」으로 답한다).
 */
export function pathStudentIdentityConfig(env = process.env) {
  const clientId = env.PATH_STUDENT_CLIENT_ID, issuer = env.SYNK_ID_CUSTOMER_SUPABASE_URL, accountApiUrl = env.SYNK_ID_CUSTOMER_ACCOUNT_API_URL, publishableKey = env.SYNK_ID_CUSTOMER_PUBLISHABLE_KEY;
  if (!clientId) return null;
  if (!issuer || !accountApiUrl || !publishableKey) throw Error('PATH 학생 확인에는 고객 SYNK ID의 중앙 주소 세 개가 필요합니다.');
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(clientId)) throw Error('PATH_STUDENT_CLIENT_ID 형식을 확인해 주세요.');
  if (clientId === env.SYNK_ID_CUSTOMER_CLIENT_ID || clientId === env.SYNK_ID_MESSENGER_CLIENT_ID) throw Error('PATH 학생 확인에는 PATH 앱 전용 클라이언트가 필요합니다.');
  let issuerUrl, apiUrl;
  try { issuerUrl = new URL(issuer); apiUrl = new URL(accountApiUrl); } catch { throw Error('PATH 학생 확인의 중앙 주소를 확인해 주세요.'); }
  if (issuerUrl.protocol !== 'https:' || apiUrl.protocol !== 'https:' || apiUrl.origin !== issuerUrl.origin || apiUrl.pathname !== '/functions/v1/synk-account') throw Error('PATH 학생 확인의 중앙 주소를 확인해 주세요.');
  return Object.freeze({ clientId, issuer: issuerUrl.origin, accountApiUrl: apiUrl.href, publishableKey });
}

export function createPathStudentIdentity({ config = null, fetch: fetcher = globalThis.fetch, now = () => Date.now(), concurrency = 8 } = {}) {
  const guard = createConcurrencyGuard(concurrency);
  /** Authorization 머리말에서 Bearer만 꺼낸다. 꼴이 틀리면 null. */
  function bearer(req) {
    const raw = req.headers?.authorization;
    if (typeof raw !== 'string' || raw.length > 16400) return null;
    const match = /^Bearer ([^\s]+)$/.exec(raw);
    return match && JWT.test(match[1]) ? match[1] : null;
  }
  // 중앙을 부르기 전에 서버 안에서 거르는 것: 꼴, 만료, 발급자, client_id, sub.
  function precheck(token) {
    const claims = claimsOf(token);
    if (!claims || claims.iss !== config.issuer + '/auth/v1' || typeof claims.client_id !== 'string' || !same(claims.client_id, config.clientId)
      || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= now() || typeof claims.sub !== 'string' || !UUID.test(claims.sub)) throw rejected();
    return claims;
  }
  async function verify(req) {
    if (!config) throw fail(503, 'PATH_STUDENT_NOT_CONFIGURED', 'PATH 상담 연결이 아직 준비되지 않았어요.');
    const token = bearer(req);
    if (!token) throw rejected();
    const claims = precheck(token);
    return guard(async () => {
      let response;
      try {
        response = await fetcher(config.accountApiUrl, { redirect: 'error', signal: AbortSignal.timeout(8000),
          headers: { Authorization: 'Bearer ' + token, apikey: config.publishableKey, 'X-SYNK-Product': PRODUCT, 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.2.0' } });
      } catch { throw unavailable(); }
      if (!response.ok) throw [401, 403].includes(response.status) ? rejected() : unavailable();
      let data; try { data = await response.json(); } catch { throw unavailable(); }
      // 고객 상담 verify()와 같은 조건: 계정 active, 현재이고 철회되지 않은 세션 하나.
      const current = Array.isArray(data?.sessions) ? data.sessions.filter(row => row?.current === true && row.revoked === false && row.product === PRODUCT) : [];
      if (data?.ok !== true || data.account?.status !== 'active' || !UUID.test(data.account?.synk_user_id || '') || current.length !== 1 || !UUID.test(current[0].id || '')) throw rejected();
      // 중앙을 부르는 동안 만료됐으면 받지 않는다.
      if (claims.exp * 1000 <= now()) throw rejected();
      return Object.freeze({ synkUserId: data.account.synk_user_id.toLowerCase(), subject: claims.sub.toLowerCase(),
        name: typeof data.account.profile?.display_name === 'string' ? data.account.profile.display_name.trim().slice(0, 100) : '' });
    });
  }
  return { configured: () => Boolean(config), verify, bearer };
}
