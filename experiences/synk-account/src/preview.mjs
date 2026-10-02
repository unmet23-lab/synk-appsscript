import { mountPortal } from './portal.mjs';
import { createAccountView } from './account-view.mjs';
import { readConfig } from './core.mjs';
// Explicit, separately built fixture. Real entry points never import this module.
const params = new URL(location.href).searchParams;
const config = readConfig({ version: 1, supabaseUrl: 'https://preview.invalid', supabasePublishableKey: 'sb_publishable_preview_only', portalUrl: location.href,
  clients: { platform: { clientId: 'preview-platform', redirectUri: new URL('./client.html?product=platform', location.href).href }, world: { clientId: 'preview-world', redirectUri: new URL('./client.html?product=world', location.href).href } } }, location.href);
const session = { access_token: 'synthetic-not-a-token', user: { id: 'synthetic-user' } };
let signedIn = params.has('account') || params.has('authorization_id'), enabled = !params.has('disabled'), revision = 1, deleting = params.has('deleting'), authListener;
const sdk = { auth: {
  getSession: async () => ({ data: { session: signedIn ? session : null } }), getUser: async () => params.has('fail-user') ? { error: new Error('합성 인증 확인 실패') } : ({ data: { user: session.user } }), onAuthStateChange: listener => { authListener = listener;return {}; },
  signInWithPassword: async () => { signedIn = true;authListener?.('SIGNED_IN', session);return { data: { session } }; },
  signUp: async () => ({ data: { session: null } }), resetPasswordForEmail: async () => ({ data: {} }), updateUser: async () => ({ data: {} }),
  signOut: async () => { signedIn = false;authListener?.('SIGNED_OUT', null);return {}; }, refreshSession: async () => ({ data: { session } }),
  oauth: { getAuthorizationDetails: async () => ({ data: { client: { id: 'preview-world', name: 'SYNK WORLD · 합성 예시' }, redirect_uri: config.clients.world.redirectUri, scope: 'openid email profile' } }),
    approveAuthorization: async () => ({ error: new Error('합성 화면에서 연결을 선택했어요. 실제 권한이나 로그인은 바뀌지 않았어요.') }), denyAuthorization: async () => ({ error: new Error('합성 화면에서 거절을 선택했어요. 실제 권한은 바뀌지 않았어요.') }) }
} };
const accountFactory = () => ({
  load: async () => ({ account: { synk_user_id: 'SYNK-PREVIEW-ONLY', profile: { display_name: '연습생 예시' }, providers: ['email · 합성'], status: deleting ? 'deletion-requested' : 'active' }, learning: { enabled, revision }, capabilities: { learningSync: !params.has('rollout-off') },
    memberships: [{ kind: '학습 그룹 예시', role: 'student', student_code: 'EXAMPLE', active: true }], entitlements: [{ key: '기본 학습 예시', product: 'world', valid_until: null }],
    sessions: [{ id: 'preview-session', product: 'world', label: '이 브라우저 예시', current: true, revoked: false }] }),
  setLearning: async value => { enabled = value;revision++; }, revokeSession: async () => ({}), revokeAll: async () => ({ refreshRevoked: false, legacyAccessGuard: false }), requestDeletion: async id => { if (!/^[\da-f-]{36}$/.test(id)) throw new Error('삭제 요청 UUID 없음');deleting = true;enabled = false;revision++;return {}; },
  exportPage: async () => ({ events: [], cursor: 0, until: 0, hasMore: false, eventMeta: [] }),
  // A synthetic Atlas summary in the shape synk-account ?view=atlas returns.
  atlasSummary: async () => ({ shared: enabled ? 'practice-and-settings' : 'declared-only', learning: { enabled, revision }, summary: {
    presentation: enabled ? { support: 'step', textSize: 'large' } : null, reasons: ['travel', 'culture'],
    practice: enabled ? { answered: 18, independent: 12, assisted: 4, skills: [{ line: '최근 놓친 듣고 세부 정보 찾기를 조금 더 연습해 봐요.' }, { line: '낱말 듣기를 최근 혼자 해냈어요. 가볍게 이어가요.' }] } : { answered: 0, independent: 0, assisted: 0, skills: [] } } })
});
const notice = text => { document.getElementById('notice').textContent = `합성 화면 예시 · ${text}`; };
document.getElementById('preview-banner').hidden = false;
document.getElementById('preview-banner').textContent = '합성 화면 예시 — 실제 로그인·가입·서버 저장·권한 변경은 일어나지 않습니다.';
async function main() { if (params.get('account') === 'world') {
  document.getElementById('auth-panel').hidden = true;
  const view = createAccountView({ client: accountFactory(), product: 'world', guard: () => {}, notice, preview: true, logout: async (note, { scope } = {}) => { view.stop();notice(note || (scope === 'all' ? '예시 계정을 닫았어요. 실제 다른 제품의 로그인은 종료하지 않았어요.' : '예시 계정을 닫았어요.')); } });
  await view.load();notice('WORLD의 계정과 학습 입구를 보여 줍니다.');
} else await mountPortal({ config, sdk, accountFactory, preview: true }); }
main().catch(error => notice(error.message));
