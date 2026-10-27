import { mountPortal } from './portal.mjs';
import { createAccountView } from './account-view.mjs';
import { readConfig } from './core.mjs';
// Explicit, separately built fixture. Real entry points never import this module.
const params = new URL(location.href).searchParams;
const config = readConfig({ version: 1, supabaseUrl: 'https://preview.invalid', supabasePublishableKey: 'sb_publishable_preview_only', portalUrl: location.href,
  clients: { platform: { clientId: 'preview-platform', redirectUri: new URL('./client.html?product=platform', location.href).href }, world: { clientId: 'preview-world', redirectUri: new URL('./client.html?product=world', location.href).href } } }, location.href);
const session = { access_token: 'synthetic-not-a-token', user: { id: 'synthetic-user' } };
let signedIn = params.has('account') || params.has('authorization_id'), enabled = !params.has('disabled'), revision = 1, deleting = params.has('deleting'), deletion = deleting ? { request_id: '00000000-0000-4000-8000-000000000001', requested_at: new Date(Date.now() - 86400000).toISOString() } : null, authListener;
// 계정 지우기 요청 줄(합성). 기한은 talk 계정 서비스처럼 요청 + 7일.
const deletionRow = status => deletion && { ...deletion, kind: 'delete', status, completed_at: null, due_at: new Date(Date.parse(deletion.requested_at) + 7 * 86400000).toISOString() };
// A situation as the summary sends it: Vellum's line and one sentence of Strata's example layer.
const situation = ([id, label, when, ko]) => ({ id, label, line: `${when} 쓰는 말이라 골랐어요.`, examples: [{ id: `${id.replace('sit-', 'ex-')}-1`, ko, reviewed: false }] });
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
    sessions: [{ id: 'preview-session', product: 'world', label: '이 브라우저 예시', current: true, revoked: false }], dataRequests: deleting && deletion ? [deletionRow('pending')] : [] }),
  setLearning: async value => { enabled = value;revision++; }, revokeSession: async () => ({}), revokeAll: async () => ({ refreshRevoked: false, legacyAccessGuard: false }), requestDeletion: async id => { if (!/^[\da-f-]{36}$/.test(id)) throw new Error('삭제 요청 UUID 없음');if (!deleting) deletion = { request_id: id, requested_at: new Date().toISOString() };deleting = true;enabled = false;revision++;return { request: deletionRow('pending') }; },
  cancelDeletion: async id => { if (!deleting || id !== deletion?.request_id) throw new Error('취소할 삭제 요청이 없어요.');deleting = false;const row = deletionRow('cancelled');deletion = null;return { request: row }; },
  exportPage: async () => ({ events: [], cursor: 0, until: 0, hasMore: false, eventMeta: [], myInfo: null, town: { state: null, world: null, seen: null, evalSignals: [], entry: null, commands: [], events: [], exportAt: new Date(0).toISOString(), afterCommand: '', afterEvent: '', hasMore: false } }),
  ...townClient,
  // A synthetic Atlas summary in the shape synk-account ?view=atlas returns.
  atlasSummary: async () => ({ shared: enabled ? 'practice-and-settings' : 'declared-only', learning: { enabled, revision }, summary: {
    presentation: enabled ? { support: 'step', textSize: 'large' } : null, reasons: ['travel', 'life'],
    forReasons: [{ reason: 'travel', situations: [['sit-travel-directions', '길 묻기', '길을 물을 때', '지하철역이 어디예요?'], ['sit-travel-order', '주문', '주문할 때', '따뜻한 커피 한 잔 주세요.'], ['sit-travel-transport', '교통', '버스나 지하철을 탈 때', '이 버스는 명동에 가요?'],
      ['sit-travel-lodging', '숙소', '숙소에서', '방을 예약했어요.'], ['sit-travel-shopping', '쇼핑', '물건을 살 때', '이거 얼마예요?']].map(situation) },
    { reason: 'life', situations: [['sit-life-office', '주민센터·병원·은행', '주민센터·병원·은행에서', '주소를 바꾸러 왔어요.'], ['sit-life-notice', '공공 안내문 읽기', '안내문을 읽을 때', '수영 모자를 꼭 써야 합니다.']]
      .map(situation) }],
    practice: enabled ? { answered: 18, independent: 12, assisted: 4, skills: [{ line: '최근 놓친 듣고 세부 정보 찾기를 조금 더 연습해 봐요.' }, { line: '낱말 듣기를 최근 혼자 해냈어요. 가볍게 이어가요.' }] } : { answered: 0, independent: 0, assisted: 0, skills: [] } } })
});
// SYNK TOWN's 「마을 기록」 in the shape talk's records route sends (synthetic — ?town=new|unready|switch|granted|academy|fail picks a state).
const townMode = params.get('town') || 'entered';let townRevision = 7, townBands = true, townConsent = townMode === 'granted' ? 'granted' : 'unasked';
let townKnown = [['찻집 주인', '찻집 일', 'cafe-owner', '20749.tea-order'], ['연구원', '관찰 카드가 날려요', 'researcher', '20748.R1']], townObserved = true, townFeedback = true, townFamiliar = ['쟁반이 기울어요', '찻집 주인과 공방 주인의 이야기'];
const townDetail = { title: '마을을 더 좋게 만드는 데 쓰는 기록', rows: [['무엇을 위해', '싱크타운이 오래 써도 나에게 잘 맞는지 확인하고, 맞지 않는 곳을 고치는 데 씁니다.'], ['보관', '30일이 지나면 지웁니다. 사람을 알아볼 수 없게 묶은 숫자는 남습니다.'], ['문의', 'hello@synk.im']].map(([label, text]) => ({ label, text })) };
function townCard() {
  if (townMode === 'unready') return { available: false };
  if (townMode === 'new') return { available: true, started: false };
  const evalSection = townMode === 'academy' ? [{ id: 'eval', title: '마을을 낫게 하는 데 쓰는 기록', lines: ['학원 소속 계정에는 묻지 않아요.'] }]
    : townMode === 'switch' || townConsent === 'granted' ? [{ id: 'eval', title: '마을을 낫게 하는 데 쓰는 기록', lines: [townConsent === 'granted' ? '쓰고 있어요. 30일이 지나면 지워요.' : '쓰지 않고 있어요. 안 써도 마을은 똑같아요.'],
      actions: townConsent === 'granted' ? [{ type: 'EVAL_CONSENT', payload: { state: 'withdrawn' }, label: '그만 쓰기', confirm: '그만 쓸까요? 지금까지 모은 기록을 지워요.' }] : townMode === 'switch' ? [{ type: 'EVAL_CONSENT', payload: { state: 'granted', ver: 'town-eval-signals-1' }, label: '좋아요' }] : [],
      ...(townMode === 'switch' ? { detail: townDetail } : {}) }] : [];
  return { available: true, started: true, revision: townRevision, sections: [
    { id: 'known', title: '주민이 아는 나', empty: '주민이 기억하는, 같이 한 일이 아직 없어요.', rows: townKnown.map(([name, title, npc, eventId]) => ({ text: `${name} · ${title} — 같이 했어요`, action: { type: 'MEMORY_FORGET', payload: { npc, eventId }, label: '잊어 주세요' } })) },
    { id: 'settings', title: '마을이 맞춰 둔 것', empty: '마을이 맞춰 둔 것이 아직 없어요.', rows: [
      townBands ? { text: '내가 자주 오는 때에 맞춰 마을 자리를 채워요', action: { type: 'PREF_VISIT_BANDS', payload: { on: false }, label: '끄기' } } : { text: '자주 오는 때에 맞춰 마을 자리 채우기 · 꺼 둠', action: { type: 'PREF_VISIT_BANDS', payload: { on: true }, label: '켜기' } },
      ...(townObserved ? [{ text: '요즘 자주 한 생활 · 찻집 생활', action: { type: 'OBSERVED_CORRECT', payload: { family: 'cafe-life' }, label: '그때만 한 거예요' } }] : []),
      { text: '덜 추천하는 생활 · 비 오는데 바깥에 비품이', action: null },
      ...(townFeedback ? [{ text: '내가 남긴 응답 · 찻집 주문 · 좋았어요', action: { type: 'FEEDBACK_REMOVE', payload: { eventId: 'E-5' }, label: '응답 지우기' } }] : [])], note: '단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.' },
    { id: 'familiar', title: '익숙한 생활', empty: '여러 번 함께한 생활이 여기에 모여요.', rows: townFamiliar.map(text => ({ text })), note: '본 것 기록을 비우면 모두 다시 새 이야기로 보여요.',
      actions: [{ type: 'SEEN_CLEAR', payload: {}, label: '본 것 기록 비우기', confirm: '본 것 기록을 비울까요? 마을의 일과 주민의 기억은 그대로예요.' }] },
    ...evalSection,
    { id: 'clear', title: '맞춤 기록 모두 비우기', lines: ['요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요. 직접 정한 설정과 마을의 일은 그대로예요.'], actions: [{ type: 'MEMORY_CLEAR', payload: {}, label: '비우기', confirm: '맞춤 기록을 모두 비울까요?' }] }] };
}
const townAnswer = () => ({ ok: true, scope: 'synk-town-records', accountId: 'SYNK-PREVIEW-ONLY', records: townCard() });
async function townRights({ type, payload, expectedRevision }) {
  if (expectedRevision !== townRevision) throw Object.assign(new Error('합성 판 충돌'), { code: 'stale-command' });
  if (type === 'MEMORY_FORGET') townKnown = townKnown.filter(row => row[3] !== payload.eventId);
  if (type === 'OBSERVED_CORRECT') townObserved = false;
  if (type === 'FEEDBACK_REMOVE') townFeedback = false;
  if (type === 'PREF_VISIT_BANDS') townBands = payload.on === true;
  if (type === 'SEEN_CLEAR') townFamiliar = [];
  if (type === 'MEMORY_CLEAR') { townFamiliar = [];townObserved = false;townFeedback = false; }
  if (type === 'EVAL_CONSENT') townConsent = payload.state;
  townRevision++;return townAnswer();
}
const townClient = { townRecords: async () => { if (townMode === 'fail') throw Object.assign(new Error('합성 연결 실패'), { code: 'NETWORK', retryable: true });return townAnswer(); }, townRights,
  townExportPage: async () => ({ ok: true, scope: 'synk-town-data', town: { state: null, commands: [], events: [], exportAt: new Date(0).toISOString(), afterCommand: '', afterEvent: '', hasMore: false } }) };
const notice = text => { document.getElementById('notice').textContent = `합성 화면 예시 · ${text}`; };
document.getElementById('preview-banner').hidden = false;
document.getElementById('preview-banner').textContent = '합성 화면 예시예요. 실제 로그인·가입·서버 저장은 일어나지 않아요.';
async function main() { if (params.get('account') === 'world') {
  document.getElementById('auth-panel').hidden = true;
  const view = createAccountView({ client: accountFactory(), product: 'world', guard: () => {}, notice, preview: true, logout: async (note, { scope } = {}) => { view.stop();notice(note || (scope === 'all' ? '예시 계정을 닫았어요. 실제 다른 제품의 로그인은 종료하지 않았어요.' : '예시 계정을 닫았어요.')); } });
  await view.load();notice('WORLD 계정 화면을 보여 줘요.');
} else await mountPortal({ config, sdk, accountFactory, preview: true }); }
main().catch(error => notice(error.message));
