// 면접 쪽의 계정. PATH 앱과 같은 탭의 로그인을 읽기만 한다(로그인과 문서 저장은 앱에서 한다).
// AI 요청(꼬리 질문 · 평가)만 보낸다. 문서 동기화를 열지 않는다.
import { createProductAccount } from '../../../synk-account/src/product-account.mjs';
import { validatePathDocument } from '../../../path-app/document.mjs';
import { INTERVIEW_CONSENT_VERSION, validateTurnRequest, validateReviewRequest, validateTurnReply, validateReviewReply } from '../../../path-app/interview-shape.mjs';

export const CONFIG_URL = '/path/app/config.json';

/** onChange: 로그인해 있던 사람이 로그아웃했거나 다른 사람으로 바뀌었다(앞 사람의 답과 동의 표시를 지울 때). */
export function createInterviewAccount({ accountFactory = createProductAccount, uuid = () => globalThis.crypto.randomUUID(), onChange = () => {}, options = {} } = {}) {
  let account = null, starting = null, owner = null;
  const watch = (s) => { const id = s?.signedIn && s.accountId ? s.accountId : null, before = owner; owner = id; if (before && before !== id) onChange(); };
  const signedIn = () => { const s = account?.status?.(); return !!(s?.signedIn && s.accountId); };
  async function start() {
    if (!starting) starting = (async () => {
      account = accountFactory({ clientKey: 'path-app', endpoint: 'synk-path', scope: 'synk-path', resource: 'path-app', validateState: (raw) => (raw == null ? null : validatePathDocument(raw)),
        operations: { load: 'pathLoad', save: 'pathSave', delete: 'pathDelete' }, configUrl: CONFIG_URL, onStatus: watch, ...options });
      await account.start();
      return signedIn();
    })().catch((error) => { starting = null; throw error; });
    return starting;
  }
  async function send(body) {
    if (!signedIn()) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
    return account.requestTranslate(body);
  }
  const head = ({ sessionId, program, topik, lang }) => ({ request_id: uuid(), session_id: sessionId, program, topik, consent: { v: INTERVIEW_CONSENT_VERSION, age: 'adult', lang } });
  return {
    start, signedIn,
    async turn(meta, { track, answer }) { return validateTurnReply(await send(validateTurnRequest({ action: 'interview_turn', ...head(meta), track, answer }))); },
    async review(meta, answers) { return validateReviewReply(await send(validateReviewRequest({ action: 'interview_review', ...head(meta), answers }))); },
    dispose() { try { account?.dispose?.(); } catch { /* 닫는 중 */ } }
  };
}
