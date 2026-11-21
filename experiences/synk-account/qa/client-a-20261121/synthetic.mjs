// WORLD 앱 창 합성 장면 — scenes.mjs(직접 찍기)와 review-scenes.mjs(검수 묶음 캡처)가 같이 쓴다. 계정 · 로그인 요청은 모두 합성이다.
import { emptyPlayState, PLAY_SCOPE } from '../../../play-common/play-data.mjs';
export const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const accountData = (extra = {}) => ({ ok: true, account: { synk_user_id: USER, status: 'active', profile: { display_name: '유호' }, profile_revision: 1, providers: ['email', 'google'] }, memberships: [], entitlements: [], learning: { enabled: true, revision: 3 }, capabilities: { learningSync: true }, sessions: [{ id: 'cur', product: 'world', label: 'SYNK WORLD', current: true, revoked: false, last_seen: '2026-11-21T04:00:00Z' }, { id: 'pc', product: 'platform', label: 'SYNK Platform', current: false, revoked: false, last_seen: '2026-11-20T11:00:00Z' }], dataRequests: [], ...extra });
const SIGNED_IN = { configured: true, status: 'signed-in', signedIn: true, sessionGeneration: 2, account: { synk_user_id: USER } };
export const SCENES = {
  'signed-out': { auth: { configured: true, status: 'signed-out', signedIn: false, sessionGeneration: 1 } },
  'signing-in': { auth: { configured: true, status: 'signing-in', signedIn: false, sessionGeneration: 1 } },
  restoring: { auth: { configured: true, status: 'restoring', signedIn: false, sessionGeneration: 1 } },
  error: { auth: { configured: true, status: 'error', signedIn: false, sessionGeneration: 1, error: { message: '브라우저 로그인이 끝나지 않았어요. 「SYNK ID로 로그인」을 다시 눌러 주세요.' } } },
  setup: { auth: { configured: false, status: 'signed-out', signedIn: false, sessionGeneration: 1 } },
  'signed-in': { auth: SIGNED_IN, classes: [] },
  'signed-in-new': { auth: SIGNED_IN, classes: [], account: accountData({ learning: { enabled: false, revision: 1 }, account: { synk_user_id: USER, status: 'active', profile: { display_name: '' }, profile_revision: 1, providers: ['google'] } }) },
  'signed-in-class': { auth: SIGNED_IN, classes: [{ id: 'c1', name: '울란바토르 1반', role: 'learner', learnerId: 'L1' }] },
  'load-fail': { auth: SIGNED_IN, classes: [], loadFail: true },
};
/** PC 앱 다리의 accountRequest를 장면 자료로 답한다. unknown에 시험대에 없는 요청을 모은다. */
export function answer(scene, op, params, unknown = []) {
  const play = { ok: true, scope: PLAY_SCOPE, accountId: USER, revision: 0, state: emptyPlayState() };
  if (op === 'load') return scene.loadFail ? { ok: false, error: { code: 'ACCOUNT_UNAVAILABLE', message: '계정 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.', retryable: true } } : (scene.account || accountData());
  if (op === 'classroom' && params?.operation === 'classes') return { ok: true, classes: scene.classes || [] };
  const question = (id, prompt, a, b) => ({ id, prompt, text: prompt, options: [{ id: 'o1', text: a, label: a }, { id: 'o2', text: b, label: b }] });
  if (op === 'classroom' && params?.operation === 'account') return { ok: true, account: { synk_user_id: USER }, learning: { enabled: true, revision: 3 }, sharing: { enabled: true, revision: 1 }, accountLearning: { enabled: true } };
  if (op === 'classroom' && params?.operation === 'student') return { ok: true, learner: { id: 'L1', name: '유호' }, sharing: { enabled: true, revision: 1 }, assignments: [{ id: 'a1', revision: 1, status: 'open', title: '가게에서 인사하기', dueAt: '2026-11-28T09:00:00Z', content: { id: 'c1', title: '가게에서 인사하기', kind: 'reading', passage: '손님: 안녕하세요. 주인: 어서 오세요.', questions: [question('q1', '가게에 들어가며 하는 말은?', '안녕하세요', '잘 먹겠습니다')] } }] };
  if (op === 'classroom' && params?.operation === 'practice') return { ok: true, content: [{ id: 'p1', kind: 'reading', title: '카페에서 주문하기', passage: '아메리카노 한 잔 주세요.', questions: [question('q1', '무엇을 주문했나요?', '아메리카노', '녹차')] }] };
  if (op === 'classroom') { unknown.push('classroom:' + params?.operation);return { ok: false, error: { code: 'SYNTHETIC', message: `합성 시험대에 없는 요청(${params?.operation})` } }; }
  if (op === 'atlasSummary') return { ok: true, shared: 'declared-only', learning: { enabled: true, revision: 3 }, summary: { reasons: ['travel'], presentation: null, practice: { answered: 12, independent: 7, assisted: 5, skills: [] }, forReasons: [] } };
  if (op === 'understandingLoad') return { ok: true, understanding: null };
  if (op === 'playLoad') return play;
  unknown.push(op + (params?.operation ? ':' + params.operation : ''));
  return { ok: false, error: { code: 'SYNTHETIC', message: `합성 시험대에 없는 요청(${op})` } };
}
/** addInitScript로 넣는 PC 앱 다리. 인자 { auth }. */
export function bridge({ auth }) {
    let listener = null, state = auth;
    window.synkDesktop = {
      getEnvironment: async () => ({ clientId: 'world' }),
      authStatus: async () => state,
      onAuthChanged: cb => { listener = cb;return () => { listener = null; }; },
      authSignIn: async () => (state = { ...state, status: 'signing-in' }),
      authCancelSignIn: async () => (state = { ...state, status: 'signed-out' }),
      authSignOut: async () => { state = { configured: true, status: 'signed-out', signedIn: false, sessionGeneration: (state.sessionGeneration || 1) + 1 };setTimeout(() => listener?.(state));return { ok: true, serverRevoked: true }; },
      accountRequest: (op, params) => window.__synthRequest(op, params),
      launch: async () => ({ ok: true }),
    };
}
