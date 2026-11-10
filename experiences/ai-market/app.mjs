const API = '/api/customer/ai-market';
const categories = { content: '광고·콘텐츠', education: '강의·코칭', automation: '자동화·개발', other: '그 밖의 AI' };
const kinds = { case: '활용 사례', question: '질문', discussion: '이야기' };
const modes = { learn: '강의·코칭', digital: '자료·템플릿', commission: '제작 서비스' };
const main = document.getElementById('main');
const notice = document.getElementById('notice');
const account = document.getElementById('account-actions');
const state = { session: null, sessionError: false, epoch: 0, serial: 0, data: null, route: null, drafts: new Map(), commentEdit: null };
let checkingSession = null;
let initialized = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const id = value => encodeURIComponent(String(value));
const userId = () => state.session?.authenticated ? state.session.user?.id : null;
const isOwner = value => Boolean(userId() && userId() === value);
const href = path => '#/' + path;
const asItems = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
const date = value => { const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? '' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed); };
function safeUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } }
function notify(message, error = false) { notice.textContent = message; notice.hidden = !message; notice.classList.toggle('error', error); }
function navigate(path) { const next = href(path); if (location.hash === next) void renderRoute(); else location.hash = next; }
function storageGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* The active form remains usable without browser storage. */ } }
function draftStorageKey(owner = userId()) { return owner ? 'synk.ai-market.drafts.v1:' + owner : null; }
function readDrafts(owner) {
  const drafts = new Map();
  const raw = owner && storageGet(draftStorageKey(owner));
  if (!raw || raw.length > 3000000) return drafts;
  try { const entries = JSON.parse(raw); if (Array.isArray(entries)) for (const item of entries.slice(-30)) if (Array.isArray(item) && typeof item[0] === 'string' && item[1]?.values && typeof item[1].values === 'object') drafts.set(item[0], item[1]); } catch { /* An invalid draft never becomes server data. */ }
  return drafts;
}
function loadDrafts(owner) { state.drafts = readDrafts(owner); }
function persistDrafts(owner = userId(), drafts = state.drafts) { const key = draftStorageKey(owner); if (key) storageSet(key, JSON.stringify([...drafts].slice(-30))); }
function clearDraft(key) { state.drafts.delete(key); persistDrafts(); }
function releasePendingDraft(owner, key, attempt) {
  const drafts = owner === userId() ? state.drafts : readDrafts(owner), draft = drafts.get(key);
  if (!draft || draft.pendingAttempt !== attempt) return;
  draft.pendingPayload = null; delete draft.pendingAttempt;
  persistDrafts(owner, drafts);
}
function setSession(session, error = false) {
  const before = userId();
  const beforeCsrf = state.session?.csrfToken;
  state.session = session;
  state.sessionError = error;
  const changed = before !== userId();
  const renewed = beforeCsrf !== session?.csrfToken;
  if (changed || renewed) { state.epoch++; state.commentEdit = null; checkingSession = null; }
  if (changed) loadDrafts(userId());
  renderAccount();
  return changed || renewed;
}
function expiredSession(message) {
  setSession({ authenticated: false, loginAvailable: state.session?.loginAvailable ?? true });
  notify(message || '로그인이 만료됐습니다. 다시 로그인하면 작성 중이던 내용을 이어갈 수 있습니다.', true);
  void renderRoute();
}
async function api(path, { method = 'GET', data, privateRead = false, externalPath = false } = {}) {
  const epoch = state.epoch;
  const mutation = method !== 'GET';
  const headers = { Accept: 'application/json' };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (mutation && state.session?.csrfToken) headers['X-CSRF-Token'] = state.session.csrfToken;
  let response;
  try { response = await fetch(externalPath ? path : API + path, { method, credentials: 'same-origin', headers, ...(data !== undefined ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(20000), cache: 'no-store' }); }
  catch { throw Object.assign(new Error('연결이 끊겨 결과를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'), { ambiguous: mutation, code: 'NETWORK_ERROR' }); }
  let result;
  try { result = await response.json(); }
  catch { throw Object.assign(new Error('서버 응답을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'), { status: response.status, ambiguous: mutation, code: 'INVALID_RESPONSE' }); }
  if ((mutation || privateRead) && epoch !== state.epoch) throw Object.assign(new Error('계정이 바뀌었습니다. 현재 계정에서 다시 확인해 주세요.'), { code: 'SESSION_CHANGED', status: 409, ambiguous: mutation && !(response.status >= 400 && response.status < 500) });
  if (!response.ok || result?.ok === false) {
    const error = Object.assign(new Error(typeof result?.error === 'string' ? result.error : result?.error?.message || result?.message || '요청을 마치지 못했습니다.'), { status: response.status, code: result?.code || result?.error?.code, ambiguous: mutation && response.status >= 500 });
    if (response.status === 401 && path !== '/session') expiredSession(error.message);
    throw error;
  }
  return result;
}
async function refreshSession({ redraw = false } = {}) {
  if (checkingSession) return checkingSession;
  const epoch = state.epoch;
  const request = (async () => {
    try { const session = await api('/session'); if (epoch !== state.epoch) return null; const changed = setSession(session); if (changed && redraw) await renderRoute(); return session; }
    catch { if (epoch !== state.epoch) return null; const changed = setSession({ authenticated: false, loginAvailable: false }, true); if (changed && redraw) await renderRoute(); return null; }
    finally { if (checkingSession === request) checkingSession = null; }
  })();
  checkingSession = request;
  return request;
}
function renderAccount() {
  if (state.sessionError) account.innerHTML = '<button class="text-button" data-action="refresh-session">계정 다시 확인</button>';
  else if (userId()) account.innerHTML = '<a href="#/profile">' + esc(state.session.profile?.displayName || '내 프로필') + '</a><button class="text-button" data-action="logout">로그아웃</button>';
  else account.innerHTML = '<button class="button small" data-action="login"' + (!state.session?.loginAvailable ? ' disabled' : '') + '>가입·로그인</button>';
}
function authPanel(title = '로그인하고 함께 나눠요', inline = false) {
  const available = state.session?.loginAvailable && !state.sessionError;
  if (inline) return '<div class="auth-inline"><p>' + esc(title) + '</p><button class="button small" data-action="' + (state.sessionError ? 'refresh-session' : 'login') + '"' + (!available && !state.sessionError ? ' disabled' : '') + '>' + (state.sessionError ? '계정 다시 확인' : '가입·로그인') + '</button>' + (!available ? '<p class="help">지금은 계정 연결을 확인할 수 없습니다. 잠시 뒤 다시 확인해 주세요.</p>' : '') + '</div>';
  return '<section class="auth-panel"><p class="eyebrow">SYNK ID</p><h1>' + esc(title) + '</h1><p>하나의 SYNK ID로 글을 쓰고, 관심 글을 모으고, 서비스를 등록할 수 있습니다. 처음이라면 계정 화면에서 가입해 주세요.</p><div class="button-row"><button class="button" data-action="' + (state.sessionError ? 'refresh-session' : 'login') + '"' + (!available && !state.sessionError ? ' disabled' : '') + '>' + (state.sessionError ? '계정 다시 확인' : 'SYNK ID로 가입·로그인') + '</button><a class="button secondary" href="#/community">글 먼저 둘러보기</a></div>' + (!available ? '<p>지금은 계정 연결을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.</p>' : '') + '<details><summary>가입 메일을 확인했는데 돌아오지 않나요?</summary><p>메일 확인과 마켓 로그인은 따로 완료될 수 있습니다. 메일을 확인한 뒤 이 화면에서 새로 로그인을 시작해 주세요. 확인이 늦었거나 다른 브라우저에서 메일을 열었어도 이어갈 수 있습니다.</p><button class="button secondary small" data-action="login"' + (!available ? ' disabled' : '') + '>가입 확인을 마쳤어요 · 로그인 이어가기</button></details></section>';
}
function requiresProfile(returnPath) {
  if (!userId()) { main.innerHTML = authPanel(); return true; }
  if (!state.session.profile) {
    storageSet('synk.ai-market.after-profile:' + userId(), returnPath);
    main.innerHTML = '<section class="auth-panel"><p class="eyebrow">PUBLIC PROFILE</p><h1>이곳에서 사용할 이름을 정해 주세요</h1><p>글과 댓글에 표시될 공개 닉네임과 소개입니다. 계정의 이메일이나 이름을 자동으로 공개하지 않습니다.</p><a class="button" href="#/profile">공개 프로필 만들기</a></section>';
    return true;
  }
  return false;
}
const breadcrumbs = (label, target = 'community') => '<div class="breadcrumbs"><a href="' + href(target) + '">' + esc(label) + '</a><span aria-hidden="true">/</span><span>상세 보기</span></div>';
const ownerControls = (type, row) => isOwner(type === 'service' ? row.sellerId : row.authorId) ? '<div class="owner-actions"><a href="#/write/' + type + '?edit=' + id(row.id) + '">수정</a><button class="text-button" data-action="delete" data-type="' + type + '" data-id="' + esc(row.id) + '" data-revision="' + esc(row.revision) + '">삭제</button></div>' : '';
const authorLink = author => '<a href="#/person/' + id(author?.id || author?.userId || '') + '">' + esc(author?.displayName || '회원') + '</a>';
function postRows(items) {
  return '<ul class="post-list">' + items.map(post => '<li class="post-row"><div class="category">' + esc(categories[post.category] || post.category) + ' <span class="dot">·</span> ' + esc(kinds[post.kind] || post.kind) + '</div><h2><a href="#/post/' + id(post.id) + '">' + esc(post.title) + '</a></h2><p class="excerpt">' + esc(post.body) + '</p><div class="meta">' + authorLink(post.author || { id: post.authorId }) + '<span>' + esc(date(post.createdAt)) + '</span></div></li>').join('') + '</ul>';
}
function serviceCards(items, compact = false) {
  return '<div class="' + (compact ? 'service-cards-small' : 'service-grid') + '">' + items.map(service => '<article class="service-card"><div class="mode">' + esc(modes[service.mode] || service.mode) + ' <span class="dot">·</span> ' + esc(categories[service.category] || service.category) + '</div><h3><a href="#/service/' + id(service.id) + '">' + esc(service.title) + '</a></h3><p>' + esc(service.description) + '</p><div class="price">' + esc(service.priceText || '서비스 설명에서 가격 확인') + '</div><div class="meta"><a href="#/seller/' + id(service.sellerId) + '">' + esc(service.seller?.displayName || '판매자 소개') + '</a></div></article>').join('') + '</div>';
}
function empty(title, description, action = '') { return '<div class="empty"><span class="empty-mark" aria-hidden="true">＋</span><h2>' + esc(title) + '</h2><p>' + esc(description) + '</p>' + action + '</div>'; }
function selectOptions(options, selected, allLabel) { return (allLabel ? '<option value="">' + esc(allLabel) + '</option>' : '') + Object.entries(options).map(([key, label]) => '<option value="' + esc(key) + '"' + (selected === key ? ' selected' : '') + '>' + esc(label) + '</option>').join(''); }
function listHeading(services, saved) {
  return '<div class="page-heading"><div><p class="eyebrow">' + (services ? 'FIND YOUR NEXT STEP' : saved ? 'YOUR COLLECTION' : 'LEARN FROM EACH OTHER') + '</p><h1>' + (services ? '다음 작업을 함께할 사람' : saved ? '다시 보고 싶은 경험' : 'AI로 해본 일을 나눠요') + '</h1><p>' + (services ? '제작자의 사례와 제공 내용을 읽고, 필요한 도움을 찾아보세요.' : saved ? '관심 글은 내 계정에 저장됩니다. 필요할 때 꺼내 보고 다음 작업으로 이어가세요.' : '잘된 결과부터 막혔던 과정까지. 질문과 경험이 다음 작업의 출발점이 됩니다.') + '</p></div><a class="button" href="' + (services ? '#/write/service' : '#/write/post') + '">' + (services ? '서비스 등록' : '글 쓰기') + ' <span aria-hidden="true">＋</span></a></div>';
}
function searchForm(route, services = false) {
  const p = route.searchParams;
  return '<form class="search-form" data-search="' + (services ? 'services' : route.pathname === '/saved' ? 'saved' : 'community') + '" role="search"><input name="q" type="search" maxlength="120" aria-label="' + (services ? '서비스 검색' : '글 검색') + '" placeholder="' + (services ? '필요한 결과나 서비스 검색' : '궁금한 주제나 작업 검색') + '" value="' + esc(p.get('q') || '') + '"><button class="button secondary" type="submit">검색</button><input type="hidden" name="category" value="' + esc(p.get('category') || '') + '"><input type="hidden" name="' + (services ? 'mode' : 'kind') + '" value="' + esc(p.get(services ? 'mode' : 'kind') || '') + '"></form><div class="filter-row"><label>분야<select data-filter="category">' + selectOptions(categories, p.get('category'), '모든 분야') + '</select></label><label>' + (services ? '도움 방식' : '글 종류') + '<select data-filter="' + (services ? 'mode' : 'kind') + '">' + selectOptions(services ? modes : kinds, p.get(services ? 'mode' : 'kind'), services ? '모든 방식' : '모든 글') + '</select></label>' + ([...p].length ? '<button class="text-button" data-action="reset-filters">초기화</button>' : '') + '</div>';
}
async function listPage(route, serial) {
  const services = route.pathname === '/services', saved = route.pathname === '/saved';
  if (saved && !userId()) { main.innerHTML = authPanel('관심 글을 내 계정에 모아 보세요'); return; }
  const query = new URLSearchParams();
  for (const key of ['q', 'category', services ? 'mode' : 'kind']) if (route.searchParams.get(key)) query.set(key, route.searchParams.get(key));
  if (saved) query.set('saved', 'true');
  const data = await api((services ? '/services' : '/posts') + '?' + query, { privateRead: saved });
  if (serial !== state.serial) return;
  state.data = { ...data, items: asItems(data), query, services, saved };
  const filtering = Boolean(query.get('q') || query.get('category') || query.get('kind') || query.get('mode'));
  const emptyHtml = filtering ? empty('조건에 맞는 결과가 없습니다', '검색어를 줄이거나 분야를 바꿔 보세요.', '<button class="button secondary small" data-action="reset-filters">검색·필터 초기화</button>') : saved ? empty('아직 관심 글이 없습니다', '글을 읽다가 관심 글에 담아 두세요. 다른 기기에서도 다시 볼 수 있습니다.', '<a class="button secondary" href="#/community">커뮤니티 둘러보기</a>') : services ? empty('첫 서비스를 기다리고 있습니다', '무엇을 제공하고 어떤 결과를 함께 만들 수 있는지 소개해 주세요.', '<a class="button" href="#/write/service">서비스 등록하기</a>') : empty('첫 이야기를 들려주세요', 'AI를 써 본 경험이나 지금 막힌 문제부터 시작해도 좋습니다.', '<a class="button" href="#/write/post">첫 글 쓰기</a>');
  main.innerHTML = listHeading(services, saved) + '<div class="content-layout"><section aria-label="' + (services ? '서비스 목록' : '글 목록') + '">' + searchForm(route, services) + '<div class="list-caption"><span>' + (saved ? '내 관심 글' : services ? '등록된 서비스' : '최근 이야기') + '</span><span>최신순</span></div><div id="list-results">' + (state.data.items.length ? services ? serviceCards(state.data.items) : postRows(state.data.items) : emptyHtml) + '</div><div class="pagination" id="pagination">' + moreButton(data.nextCursor, 'list-more') + '</div></section><aside class="side-panel"><h2>' + (services ? '사례에서 시작하는 선택' : '작은 경험도 도움이 됩니다') + '</h2><p>' + (services ? '판매자의 작업 사례와 포함·제외 조건을 함께 살펴보세요. 공개 연락 경로에서 제공 범위를 직접 확인할 수 있습니다.' : '무엇을 하려 했는지, 어떤 방법을 썼는지, 결과와 한계는 어땠는지 나눠 주세요.') + '</p><ol>' + (services ? '<li>제공 내용과 결과물 읽기</li><li>판매자의 경험 살펴보기</li><li>공개 문의 경로 확인하기</li>' : '<li>직접 해본 경험 나누기</li><li>궁금한 점을 구체적으로 묻기</li><li>필요한 제작자와 서비스 찾기</li>') + '</ol><a class="button secondary small" href="' + (services ? '#/community' : '#/services') + '">' + (services ? '작업 사례 둘러보기' : '서비스 둘러보기') + '</a></aside></div>';
}
function moreButton(cursor, action) { return cursor ? '<button class="button secondary" data-action="' + action + '">더 보기</button>' : ''; }
function commentRows(items) {
  return '<ul class="comments">' + items.map(comment => '<li class="comment" id="comment-' + esc(comment.id) + '"><div class="meta">' + authorLink(comment.author || { id: comment.authorId }) + '<span>' + esc(date(comment.createdAt)) + '</span></div>' + (state.commentEdit === comment.id ? commentForm(comment.postId, comment) : '<p>' + esc(comment.body) + '</p>' + (isOwner(comment.authorId) ? '<div class="owner-actions"><button class="text-button" data-action="edit-comment" data-id="' + esc(comment.id) + '">수정</button><button class="text-button" data-action="delete" data-type="comment" data-id="' + esc(comment.id) + '" data-revision="' + esc(comment.revision) + '">삭제</button></div>' : '')) + '</li>').join('') + '</ul>';
}
function renderPost() {
  const { post, comments, commentsNextCursor, services } = state.data;
  main.innerHTML = breadcrumbs('커뮤니티') + '<div class="article-layout"><article><header class="article-header"><div class="category">' + esc(categories[post.category]) + ' <span class="dot">·</span> ' + esc(kinds[post.kind]) + '</div><h1>' + esc(post.title) + '</h1><div class="meta">' + authorLink(post.author || { id: post.authorId }) + '<span>' + esc(date(post.createdAt)) + '</span>' + (post.revision > 1 ? '<span>수정됨</span>' : '') + '</div></header><div class="article-body">' + esc(post.body) + '</div><div class="article-actions"><div id="bookmark-control">' + bookmarkButton() + '</div>' + ownerControls('post', post) + '</div><section class="section" aria-labelledby="comments-heading"><div class="section-heading"><h2 id="comments-heading">함께 나누는 이야기</h2></div><div id="comment-list">' + (comments.length ? commentRows(comments) : '<p class="comment-empty">아직 댓글이 없습니다. 첫 의견을 나눠 주세요.</p>') + '</div><div class="pagination">' + moreButton(commentsNextCursor, 'comments-more') + '</div>' + (userId() ? state.session.profile ? commentForm(post.id) : '<div class="auth-inline"><p>댓글에 표시할 공개 닉네임을 먼저 정해 주세요.</p><button class="button small" data-action="profile-before-comment">프로필 만들기</button></div>' : authPanel('로그인하면 댓글을 쓰고 의견을 나눌 수 있습니다.', true)) + '</section></article><aside><div class="profile-summary"><span class="avatar" aria-hidden="true">' + esc((post.author?.displayName || '회').slice(0, 1)) + '</span><h2>' + authorLink(post.author || { id: post.authorId }) + '</h2><p>이 작성자의 다른 경험과 제공 서비스를 살펴보세요.</p></div><h2>작성자의 서비스</h2><p class="section-note">이 글을 쓴 회원이 직접 등록한 서비스입니다.</p>' + (asItems(services).length ? serviceCards(asItems(services), true) : '<p class="help">아직 등록된 서비스가 없습니다.</p>') + '</aside></div>';
}
function bookmarkButton() {
  if (!userId()) return '<button class="button secondary small" data-action="login">로그인하고 관심 글 담기</button>';
  if (!state.session.profile) return '<button class="button secondary small" data-action="profile-before-bookmark">프로필을 만들고 관심 글 담기</button>';
  if (state.data.bookmarkState === 'loading') return '<button class="button secondary small" disabled>관심 글 확인 중</button>';
  if (state.data.bookmarkState === 'error') return '<button class="button secondary small" data-action="bookmark-check">관심 글 상태 다시 확인</button>';
  return '<button class="button ' + (state.data.bookmarked ? 'quiet' : 'secondary') + ' small" data-action="bookmark" aria-pressed="' + Boolean(state.data.bookmarked) + '">' + (state.data.bookmarked ? '관심 글에 담았어요 ✓' : '관심 글에 담기 ＋') + '</button>';
}
async function loadBookmark(serial) {
  if (!userId() || !state.data?.post) return;
  const postId = state.data.post.id;
  state.data.bookmarkState = 'loading';
  const control = document.getElementById('bookmark-control'); if (control) control.innerHTML = bookmarkButton();
  try { const result = await api('/posts/' + id(postId) + '/bookmark', { privateRead: true }); if (serial !== state.serial) return; state.data.bookmarked = result.saved === true; state.data.bookmarkState = 'loaded'; }
  catch { if (serial !== state.serial) return; state.data.bookmarkState = 'error'; }
  const current = document.getElementById('bookmark-control'); if (current && serial === state.serial) current.innerHTML = bookmarkButton();
}
async function postPage(postId, serial) {
  const data = await api('/posts/' + id(postId)); if (serial !== state.serial) return;
  state.data = { ...data, comments: asItems(data.comments), bookmarkState: 'loading', bookmarked: false };
  renderPost(); void loadBookmark(serial);
}
async function personPage(personId, sellerPage, serial) {
  const data = await api((sellerPage ? '/sellers/' : '/profiles/') + id(personId)); if (serial !== state.serial) return;
  state.data = data;
  const profile = data.profile, seller = data.seller;
  const title = profile?.displayName || seller?.displayName || '회원';
  const portfolio = safeUrl(seller?.portfolioUrl);
  main.innerHTML = breadcrumbs(sellerPage ? '서비스' : '커뮤니티', sellerPage ? 'services' : 'community') + '<div class="article-layout"><section><span class="avatar" aria-hidden="true">' + esc(title.slice(0, 1)) + '</span><p class="eyebrow">' + (sellerPage ? 'CREATOR PROFILE' : 'COMMUNITY MEMBER') + '</p><h1>' + esc(title) + '</h1>' + (sellerPage && seller ? '<p class="seller-description">' + esc(seller.headline) + '</p><div class="category">' + (seller.categories || []).map(x => esc(categories[x] || x)).join(' · ') + '</div><div class="seller-description">' + esc(seller.description) + '</div>' + (portfolio ? '<a class="public-link" href="' + esc(portfolio) + '" target="_blank" rel="noopener noreferrer">작업 사례·포트폴리오 보기 ↗</a>' : '') : '<p class="seller-description">' + esc(profile?.bio || '아직 소개를 작성하지 않았습니다.') + '</p>') + '<div class="profile-tools">' + (isOwner(personId) ? '<a class="button secondary small" href="#/profile">프로필 수정</a><a class="button secondary small" href="#/seller">판매자 소개 ' + (seller ? '수정' : '등록') + '</a>' : '') + (!sellerPage && seller ? '<a class="button secondary small" href="#/seller/' + id(personId) + '">판매자 소개 보기</a>' : '') + '</div><section class="section"><div class="section-heading"><h2>나눈 경험</h2></div>' + (asItems(data.posts).length ? postRows(asItems(data.posts)) : '<p class="help">아직 공개한 글이 없습니다.</p>') + '</section></section><aside><h2>제공하는 서비스</h2><p class="section-note">판매자가 직접 작성한 소개입니다.</p>' + (asItems(data.services).length ? serviceCards(asItems(data.services), true) : '<p class="help">아직 등록된 서비스가 없습니다.</p>') + '</aside></div>';
}
async function servicePage(serviceId, serial) {
  const data = await api('/services/' + id(serviceId)); if (serial !== state.serial) return;
  state.data = data;
  const service = data.service, seller = data.seller || service.seller, contact = safeUrl(service.contactUrl);
  main.innerHTML = breadcrumbs('서비스', 'services') + '<div class="article-layout"><article><header class="article-header"><div class="category">' + esc(categories[service.category]) + ' <span class="dot">·</span> ' + esc(modes[service.mode]) + '</div><h1>' + esc(service.title) + '</h1><div class="meta"><a href="#/seller/' + id(service.sellerId) + '">' + esc(seller?.displayName || '판매자 소개') + '</a><span>' + esc(date(service.updatedAt || service.createdAt)) + '</span></div></header><div class="article-body">' + esc(service.description) + '</div><dl class="detail-list">' + [['받게 되는 결과물', service.deliverables], ['포함되는 내용', service.includes], ['포함되지 않는 내용', service.excludes]].map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + esc(value || '판매자에게 확인해 주세요.') + '</dd></div>').join('') + '</dl><div class="article-actions section">' + ownerControls('service', service) + '</div></article><aside class="side-panel contact-panel"><div class="seller-label">판매자가 안내한 가격</div><div class="price-large">' + esc(service.priceText) + '</div>' + (contact ? '<a class="button" href="' + esc(contact) + '" target="_blank" rel="noopener noreferrer">판매자 문의 경로 열기 ↗</a>' : '<p>공개 문의 경로가 없습니다.</p>') + '<p>판매자의 외부 페이지로 이동합니다. 제공 범위와 이용 조건은 판매자에게 직접 확인해 주세요.</p><div class="section"><h2>' + esc(seller?.displayName || '판매자') + '</h2><p class="section-note">' + esc(seller?.headline || '제작자의 경험과 다른 서비스를 살펴보세요.') + '</p><a class="public-link" href="#/seller/' + id(service.sellerId) + '">판매자 소개·작업 사례 →</a></div></aside></div>';
}
function field(name, label, value = '', { required = true, max = 120, type = 'text', help = '', placeholder = '' } = {}) {
  return '<label class="field"><span>' + esc(label) + (!required ? ' <span class="optional">선택</span>' : '') + '</span><input name="' + name + '" type="' + type + '" maxlength="' + max + '" value="' + esc(value) + '"' + (required ? ' required' : '') + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>' + (help ? '<small>' + esc(help) + '</small>' : '') + '</label>';
}
function textarea(name, label, value = '', { required = true, max = 3000, large = false, help = '', placeholder = '' } = {}) {
  return '<label class="field"><span>' + esc(label) + (!required ? ' <span class="optional">선택</span>' : '') + '</span><textarea name="' + name + '" maxlength="' + max + '"' + (required ? ' required' : '') + (large ? ' class="body-editor"' : '') + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>' + esc(value) + '</textarea>' + (help ? '<small>' + esc(help) + '</small>' : '') + '</label>';
}
function selectField(name, label, options, selected) { return '<label class="field"><span>' + label + '</span><select name="' + name + '" required>' + selectOptions(options, selected) + '</select></label>'; }
function prepareDraft(key, base, create = false) {
  const existing = state.drafts.get(key);
  const values = existing ? { ...base, ...existing.values } : base;
  const requestId = existing?.requestId || (create ? crypto.randomUUID() : null);
  return { values, requestId, pendingPayload: existing?.pendingPayload || null, restored: Boolean(existing) };
}
function formStart(type, key, draft, rowId = '', extra = '') {
  return '<form data-type="' + type + '" data-form-key="' + esc(key) + '" data-owner="' + esc(userId()) + '" data-row-id="' + esc(rowId) + '" ' + extra + '><div class="form-error" role="alert" tabindex="-1" hidden></div>' + (draft.restored ? '<p class="draft-note">이 탭에서 작성 중이던 내용을 복원했습니다.<button type="button" data-action="discard-draft">초안 지우고 다시 불러오기</button></p>' : '') + '<fieldset class="form-section"' + (draft.pendingPayload ? ' disabled' : '') + '><input type="hidden" name="revision" value="' + esc(draft.values.revision || 0) + '">' + (draft.requestId ? '<input type="hidden" name="requestId" value="' + esc(draft.requestId) + '">' : '');
}
function formEnd(label, draft, cancel = 'community', { comment = false } = {}) {
  return (comment ? '<div class="button-row"><button type="submit" class="button small">' + label + '</button></div>' : '<div class="form-actions"><p>저장하면 다른 회원에게 공개됩니다.</p><div class="button-row"><a href="#/' + cancel + '" class="button secondary">돌아가기</a><button type="submit" class="button">' + label + '</button></div></div>') + '</fieldset><div class="pending-notice"' + (!draft.pendingPayload ? ' hidden' : '') + '><p>저장 결과를 확인하지 못했습니다. 중복 게시를 막기 위해 같은 요청으로 결과를 다시 확인합니다.</p><button type="button" class="button secondary small" data-action="retry-pending">저장 결과 다시 확인</button></div></form>';
}
function commentForm(postId, comment) {
  const key = comment ? 'comment-edit:' + comment.id : 'comment-new:' + postId;
  const draft = prepareDraft(key, { body: comment?.body || '', revision: comment?.revision || 0 }, !comment);
  return '<div class="comment-form" data-private>' + formStart(comment ? 'comment-edit' : 'comment-new', key, draft, comment?.id || '', 'data-post-id="' + esc(postId) + '"') + textarea('body', comment ? '댓글 수정' : '댓글 남기기', draft.values.body, { placeholder: '도움이 된 점이나 궁금한 점을 나눠 주세요.' }) + (comment ? '<button type="button" class="text-button" data-action="cancel-comment">수정 취소</button>' : '') + formEnd(comment ? '수정 저장' : '댓글 게시', draft, '', { comment: true }) + '</div>';
}
async function editorPage(type, editId, serial) {
  if (requiresProfile('write/' + type + (editId ? '?edit=' + id(editId) : ''))) return;
  if (type === 'service' && !state.session.seller) {
    storageSet('synk.ai-market.after-seller:' + userId(), 'write/service');
    main.innerHTML = '<section class="auth-panel"><p class="eyebrow">YOUR SERVICE</p><h1>어떤 일을 하는지 먼저 소개해 주세요</h1><p>판매자 소개를 만든 뒤 서비스를 등록할 수 있습니다. 공개 닉네임과 함께 제공 분야와 경험을 보여 주세요.</p><a class="button" href="#/seller">판매자 소개 만들기</a></section>'; return;
  }
  let row = null;
  if (editId) { const data = await api((type === 'post' ? '/posts/' : '/services/') + id(editId)); if (serial !== state.serial) return; row = data[type]; if (!isOwner(type === 'post' ? row.authorId : row.sellerId)) throw new Error('본인이 작성한 내용만 수정할 수 있습니다.'); }
  const key = type + ':' + (editId || 'new');
  const base = row || (type === 'post' ? { title: '', body: '', category: 'content', kind: 'case', revision: 0 } : { title: '', description: '', category: 'content', mode: 'commission', deliverables: '', includes: '', excludes: '', priceText: '', contactUrl: '', revision: 0 });
  const draft = prepareDraft(key, base, !editId), values = draft.values;
  const post = type === 'post';
  main.innerHTML = '<section class="editor" data-private><div class="breadcrumbs"><a href="#/' + (post ? 'community' : 'services') + '">' + (post ? '커뮤니티' : '서비스') + '</a><span>/</span><span>' + (editId ? '수정' : '등록') + '</span></div><header class="editor-header"><p class="eyebrow">' + (post ? 'SHARE YOUR EXPERIENCE' : 'INTRODUCE YOUR SERVICE') + '</p><h1>' + (post ? editId ? '글 수정하기' : '어떤 경험을 나눌까요?' : editId ? '서비스 수정하기' : '제공할 서비스를 소개해 주세요') + '</h1><p>' + (post ? '직접 시도한 과정과 결과, 궁금한 점을 자유롭게 적어 주세요.' : '구매자가 받을 결과와 포함·제외 조건을 구체적으로 알려 주세요.') + '</p></header>' + formStart(type, key, draft, editId || '') + '<div class="field-grid">' + selectField('category', '분야', categories, values.category) + selectField(post ? 'kind' : 'mode', post ? '글 종류' : '도움 방식', post ? kinds : modes, post ? values.kind : values.mode) + '</div>' + field('title', post ? '제목' : '서비스 이름', values.title, { placeholder: post ? '어떤 일을 해 봤나요? 무엇이 궁금한가요?' : '어떤 결과를 제공하나요?' }) + (post ? textarea('body', '내용', values.body, { large: true, max: 12000, help: '개인정보나 공개할 권한이 없는 고객 자료는 넣지 마세요. 본문은 일반 글자로 표시됩니다.' }) : textarea('description', '서비스 설명', values.description, { max: 12000, large: true }) + textarea('deliverables', '받게 되는 결과물', values.deliverables, { help: '파일 형식, 분량, 제공 방법 등 실제로 전달할 것을 적어 주세요.' }) + textarea('includes', '포함되는 내용', values.includes) + textarea('excludes', '포함되지 않는 내용', values.excludes) + field('priceText', '가격 안내', values.priceText, { max: 200, placeholder: '예: 1회 60분 50,000원 · 부가세 포함', help: '가격과 적용 조건을 함께 적어 주세요.' }) + field('contactUrl', '공개 문의 페이지', values.contactUrl, { type: 'url', max: 2000, placeholder: 'https://', help: '본인이 관리하는 HTTPS 주소를 넣어 주세요. 이 마켓에서 자동으로 메시지를 보내지는 않습니다.' })) + formEnd(editId ? '수정 저장' : post ? '글 게시하기' : '서비스 등록하기', draft, editId ? (post ? 'post/' : 'service/') + id(editId) : post ? 'community' : 'services') + '</section>';
}
function profileEditor(sellerMode = false) {
  if (!userId()) { main.innerHTML = authPanel('나를 소개하고 경험을 연결해 보세요'); return; }
  if (sellerMode && requiresProfile('seller')) return;
  const row = sellerMode ? state.session.seller : state.session.profile;
  const key = sellerMode ? 'seller' : 'profile';
  const draft = prepareDraft(key, row || (sellerMode ? { headline: '', description: '', categories: ['content'], portfolioUrl: '', revision: 0 } : { displayName: '', bio: '', revision: 0 }));
  const values = draft.values;
  main.innerHTML = '<section class="editor" data-private><div class="editor-header"><p class="eyebrow">' + (sellerMode ? 'CREATOR PROFILE' : 'PUBLIC PROFILE') + '</p><h1>' + (sellerMode ? '판매자 소개' : '내 공개 프로필') + '</h1><p>' + (sellerMode ? '할 수 있는 일과 직접 만든 사례를 소개해 주세요. 등록한 내용은 다른 회원에게 공개됩니다.' : '글과 댓글에 표시될 이름과 소개입니다. 이메일이나 계정 이름을 자동으로 가져오지 않습니다.') + '</p></div>' + (!sellerMode && row ? '<div class="profile-tools"><a class="button secondary small" href="#/person/' + id(userId()) + '">공개 프로필 보기</a><a class="button secondary small" href="#/seller">판매자 소개 ' + (state.session.seller ? '수정' : '등록') + '</a><a class="button secondary small" href="#/write/service">서비스 등록</a></div>' : '') + formStart(key, key, draft) + (sellerMode ? field('headline', '한 줄 소개', values.headline, { max: 120, placeholder: '어떤 작업에 도움을 줄 수 있나요?' }) + textarea('description', '경험과 제공할 수 있는 도움', values.description, { max: 3000, help: '직접 참여한 역할과 실제로 제공할 수 있는 범위를 적어 주세요.' }) + '<div class="field-label" id="categories-label">제공 분야</div><div class="checkbox-group" role="group" aria-labelledby="categories-label">' + Object.entries(categories).map(([key, label]) => '<label><input type="checkbox" name="categories" value="' + key + '"' + (Array.isArray(values.categories) && values.categories.includes(key) ? ' checked' : '') + '>' + label + '</label>').join('') + '</div>' + field('portfolioUrl', '작업 사례·포트폴리오', values.portfolioUrl, { type: 'url', max: 2000, required: false, placeholder: 'https://', help: '공개할 권한이 있는 본인의 작업 페이지를 연결해 주세요.' }) : field('displayName', '공개 닉네임', values.displayName, { max: 40, help: '모든 회원에게 보이는 이름입니다.' }) + textarea('bio', '소개', values.bio, { max: 1000, required: false, placeholder: '관심 있는 분야나 해 보고 있는 일을 알려 주세요.' })) + formEnd(row ? '변경 내용 저장' : sellerMode ? '판매자 소개 등록' : '공개 프로필 만들기', draft) + '</section>';
}
function formValues(form) {
  const data = new FormData(form), values = {};
  for (const [name, value] of data) if (name !== 'requestId' && name !== 'categories') values[name] = name === 'revision' ? Number(value) : String(value);
  if (form.dataset.type === 'seller') values.categories = data.getAll('categories').map(String);
  return values;
}
function saveFormDraft(form) {
  if (!userId() || form.dataset.owner !== userId() || !form.dataset.formKey) return;
  const current = state.drafts.get(form.dataset.formKey);
  if (current?.pendingPayload) return;
  state.drafts.delete(form.dataset.formKey);
  state.drafts.set(form.dataset.formKey, { values: formValues(form), requestId: form.querySelector('[name=requestId]')?.value || null, pendingPayload: null }); persistDrafts();
}
function showFormError(form, error) {
  const target = form.querySelector('.form-error'); if (!target) return;
  const hint = error.status === 409 ? '\n입력한 내용은 유지했습니다. 다른 곳에서 수정됐다면 현재 게시 내용을 확인한 뒤 다시 작성해 주세요.' : '';
  target.textContent = error.message + hint; target.hidden = false; target.focus();
}
function mutationFor(form, payload) {
  const type = form.dataset.type, row = form.dataset.rowId, postId = form.dataset.postId;
  if (type === 'profile' || type === 'seller') return { path: '/' + type, method: 'PUT', result: type };
  if (type.startsWith('comment')) return { path: row ? '/comments/' + id(row) : '/posts/' + id(postId) + '/comments', method: row ? 'PATCH' : 'POST', result: 'comment' };
  return { path: '/' + (type === 'post' ? 'posts' : 'services') + (row ? '/' + id(row) : ''), method: row ? 'PATCH' : 'POST', result: type };
}
async function submitForm(form, retry = false) {
  if (form.dataset.busy === 'true' || form.dataset.owner !== userId()) return;
  const key = form.dataset.formKey, stored = state.drafts.get(key);
  if (!retry && stored?.pendingPayload) { showFormError(form, new Error('이전 저장 결과를 먼저 확인해 주세요.')); return; }
  if (!retry && !form.reportValidity()) return;
  if (!retry) saveFormDraft(form);
  const draft = state.drafts.get(key), values = retry ? stored.pendingPayload : { ...formValues(form) };
  if (!values) return;
  const spec = mutationFor(form, values);
  if (spec.method === 'POST' && !retry) { delete values.revision; values.requestId = form.querySelector('[name=requestId]')?.value; }
  if (form.dataset.type === 'seller' && !values.categories?.length) { showFormError(form, new Error('제공 분야를 하나 이상 골라 주세요.')); return; }
  const pendingAttempt = spec.method === 'POST' ? crypto.randomUUID() : null;
  if (spec.method === 'POST') { state.drafts.set(key, { ...draft, pendingPayload: values, pendingAttempt }); persistDrafts(); }
  form.dataset.busy = 'true';
  const fieldset = form.querySelector('fieldset'); fieldset.disabled = true;
  const pending = form.querySelector('.pending-notice'); const retryButton = pending?.querySelector('button'); if (retryButton) retryButton.disabled = true;
  const errorBox = form.querySelector('.form-error'); errorBox.hidden = true;
  const owner = userId(), epoch = state.epoch, submittedSerial = state.serial;
  try {
    const result = await api(spec.path, { method: spec.method, data: values });
    if (owner !== userId() || epoch !== state.epoch) return;
    clearDraft(key);
    if (submittedSerial !== state.serial) {
      if (spec.result === 'profile' || spec.result === 'seller') { state.session[spec.result] = result[spec.result]; renderAccount(); }
      notify('저장했습니다.');
      return;
    }
    if (spec.result === 'profile' || spec.result === 'seller') {
      state.session[spec.result] = result[spec.result]; renderAccount();
      const afterKey = 'synk.ai-market.after-' + spec.result + ':' + owner, next = storageGet(afterKey); storageSet(afterKey, null);
      notify(spec.result === 'profile' ? '공개 프로필을 저장했습니다.' : '판매자 소개를 저장했습니다.');
      navigate(next || (spec.result === 'profile' ? 'person/' + id(owner) : 'seller/' + id(owner)));
    } else if (spec.result === 'comment') { state.commentEdit = null; notify('댓글을 저장했습니다.'); await renderRoute(); }
    else { notify(spec.result === 'post' ? '글을 저장했습니다.' : '서비스를 저장했습니다.'); navigate((spec.result === 'post' ? 'post/' : 'service/') + id(result[spec.result].id)); }
  } catch (error) {
    if (spec.method === 'POST' && !error.ambiguous) releasePendingDraft(owner, key, pendingAttempt);
    if (owner !== userId() || epoch !== state.epoch) return;
    const uncertain = Boolean(state.drafts.get(key)?.pendingPayload);
    fieldset.disabled = uncertain;
    if (pending) pending.hidden = !uncertain;
    if (error.code === 'PROFILE_REQUIRED') { storageSet('synk.ai-market.after-profile:' + owner, location.hash.slice(2)); notify('공개 프로필을 먼저 작성해 주세요. 작성 중인 내용은 이 탭에 보관했습니다.', true); navigate('profile'); }
    else if (error.code === 'SELLER_REQUIRED') { storageSet('synk.ai-market.after-seller:' + owner, location.hash.slice(2)); notify('판매자 소개를 먼저 작성해 주세요. 서비스 초안은 이 탭에 보관했습니다.', true); navigate('seller'); }
    else if (form.isConnected) showFormError(form, error);
  } finally { form.dataset.busy = 'false'; if (retryButton) retryButton.disabled = false; if (!state.drafts.get(key)?.pendingPayload) fieldset.disabled = false; }
}
async function confirmAction(title, description, label = '삭제하기') {
  const dialog = document.getElementById('confirm-dialog');
  if (dialog.open) return false;
  document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-body').textContent = description;
  dialog.querySelector('[value=confirm]').textContent = label; dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
async function startLogin(button) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  storageSet('synk.ai-market.return', location.hash.startsWith('#/') ? location.hash : '#/community');
  try { const result = await api('/login', { method: 'POST', data: {} }); const target = safeUrl(result.authorizationUrl); if (!target) throw new Error('로그인 주소를 확인하지 못했습니다. 다시 시도해 주세요.'); location.assign(target); }
  catch (error) { notify(error.message, true); if (button) button.disabled = false; }
}
async function logout(button) {
  if (!await confirmAction('로그아웃할까요?', '이 탭에 남긴 작성 초안도 지워집니다. 게시한 글과 저장한 관심 글은 계정에 그대로 남습니다.', '로그아웃')) return;
  button.disabled = true;
  const owner = userId();
  try {
    const result = await api('/api/customer/logout', { method: 'POST', data: {}, externalPath: true });
    if (result.ok === false && !result.localSignedOut) throw new Error('로그아웃 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
    storageSet(draftStorageKey(owner), null); storageSet('synk.ai-market.return', null);
    setSession({ authenticated: false, loginAvailable: state.session.loginAvailable });
    notify(result.serverRevoked === false ? '이 마켓에서는 로그아웃했습니다. SYNK ID의 전체 로그인 종료는 계정 화면에서 확인해 주세요.' : '로그아웃했습니다.'); navigate('community');
  } catch (error) { notify(error.message, true); button.disabled = false; }
}
async function renderRoute() {
  const serial = ++state.serial;
  const raw = location.hash.startsWith('#/') ? location.hash.slice(1) : '/community';
  const route = new URL(raw, 'https://ai-market.local');
  state.route = route; state.data = null;
  document.querySelectorAll('[data-nav]').forEach(link => { const section = route.pathname.startsWith('/services') || route.pathname.startsWith('/service/') || route.pathname === '/write/service' ? 'services' : route.pathname === '/saved' ? 'saved' : route.pathname === '/community' || route.pathname.startsWith('/post/') || route.pathname === '/write/post' ? 'community' : null; if (link.dataset.nav === section) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  main.innerHTML = '<div class="loading" role="status">불러오는 중입니다.</div>';
  try {
    if (['/community', '/services', '/saved'].includes(route.pathname)) await listPage(route, serial);
    else if (/^\/post\/[^/]+$/.test(route.pathname)) await postPage(decodeURIComponent(route.pathname.split('/')[2]), serial);
    else if (/^\/service\/[^/]+$/.test(route.pathname)) await servicePage(decodeURIComponent(route.pathname.split('/')[2]), serial);
    else if (/^\/(person|seller)\/[^/]+$/.test(route.pathname)) await personPage(decodeURIComponent(route.pathname.split('/')[2]), route.pathname.startsWith('/seller/'), serial);
    else if (route.pathname === '/write/post' || route.pathname === '/write/service') await editorPage(route.pathname.split('/')[2], route.searchParams.get('edit'), serial);
    else if (route.pathname === '/profile' || route.pathname === '/seller') profileEditor(route.pathname === '/seller');
    else main.innerHTML = empty('이 페이지를 찾을 수 없습니다', '주소를 확인하거나 커뮤니티에서 다시 찾아 주세요.', '<a class="button" href="#/community">커뮤니티로</a>');
    if (serial === state.serial) { main.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'auto' }); document.title = (main.querySelector('h1')?.textContent || '커뮤니티') + ' · AI 마켓'; }
  } catch (error) {
    if (serial !== state.serial) return;
    main.innerHTML = '<section class="error-box"><h1>' + (error.status === 404 ? '이 내용을 찾을 수 없습니다' : '잠시 확인이 필요합니다') + '</h1><p>' + esc(error.message) + '</p><div class="button-row"><button class="button secondary" data-action="retry-page">다시 불러오기</button><a class="button secondary" href="#/community">커뮤니티로</a></div></section>'; main.focus({ preventScroll: true });
  }
}
document.addEventListener('click', event => {
  const skip = event.target.closest('.skip-link'); if (skip) { event.preventDefault(); main.focus(); return; }
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action;
  void (async () => {
    if (action === 'login') return startLogin(button);
    if (action === 'logout') return logout(button);
    if (action === 'refresh-session') { button.disabled = true; await refreshSession(); await renderRoute(); return; }
    if (action === 'retry-page') return renderRoute();
    if (action === 'reset-filters') return navigate(state.route.pathname.slice(1));
    if (action === 'retry-pending') return submitForm(button.closest('form'), true);
    if (action === 'discard-draft') { const form = button.closest('form'); if (state.drafts.get(form.dataset.formKey)?.pendingPayload) { showFormError(form, new Error('저장 결과를 먼저 확인한 뒤 초안을 지울 수 있습니다.')); return; } if (await confirmAction('이 탭의 초안을 지울까요?', '아직 저장하지 않은 입력을 지우고 현재 서버 내용을 다시 불러옵니다.', '초안 지우기')) { clearDraft(form.dataset.formKey); await renderRoute(); } return; }
    if (action === 'list-more') {
      const serial = state.serial, data = state.data; if (!data?.nextCursor) return; button.disabled = true;
      try { const query = new URLSearchParams(data.query); query.set('cursor', data.nextCursor); const next = await api((data.services ? '/services' : '/posts') + '?' + query, { privateRead: data.saved }); if (serial !== state.serial) return; data.items.push(...asItems(next)); data.nextCursor = next.nextCursor; document.getElementById('list-results').innerHTML = data.services ? serviceCards(data.items) : postRows(data.items); document.getElementById('pagination').innerHTML = moreButton(next.nextCursor, 'list-more'); }
      catch (error) { button.disabled = false; notify(error.message, true); } return;
    }
    if (action === 'comments-more') {
      const serial = state.serial, data = state.data; if (!data?.commentsNextCursor) return; button.disabled = true;
      try { const next = await api('/posts/' + id(data.post.id) + '/comments?cursor=' + id(data.commentsNextCursor)); if (serial !== state.serial) return; data.comments.push(...asItems(next)); data.commentsNextCursor = next.nextCursor; renderPost(); }
      catch (error) { button.disabled = false; notify(error.message, true); } return;
    }
    if (action === 'bookmark-check') return loadBookmark(state.serial);
    if (action === 'profile-before-bookmark' || action === 'profile-before-comment') { storageSet('synk.ai-market.after-profile:' + userId(), 'post/' + id(state.data.post.id)); navigate('profile'); return; }
    if (action === 'bookmark') {
      if (!userId()) return startLogin(button);
      const serial = state.serial, postId = state.data.post.id, saved = !state.data.bookmarked; button.disabled = true;
      try { const result = await api('/posts/' + id(postId) + '/bookmark', { method: saved ? 'PUT' : 'DELETE', data: {} }); if (serial !== state.serial) return; state.data.bookmarked = result.saved === true; document.getElementById('bookmark-control').innerHTML = bookmarkButton(); notify(result.saved ? '관심 글에 담았습니다.' : '관심 글에서 해제했습니다.'); }
      catch (error) { if (serial === state.serial) { state.data.bookmarkState = 'error'; document.getElementById('bookmark-control').innerHTML = bookmarkButton(); } notify(error.message, true); } return;
    }
    if (action === 'edit-comment' || action === 'cancel-comment') { state.commentEdit = action === 'edit-comment' ? button.dataset.id : null; renderPost(); if (state.commentEdit) document.querySelector('#comment-' + CSS.escape(state.commentEdit) + ' textarea')?.focus(); return; }
    if (action === 'delete') {
      const type = button.dataset.type, rowId = button.dataset.id, revision = Number(button.dataset.revision), postId = state.data?.post?.id;
      const labels = { post: '글', comment: '댓글', service: '서비스' };
      const objectName = labels[type] + (type === 'service' ? '를' : '을');
      if (!await confirmAction(objectName + ' 삭제할까요?', type === 'post' ? '이 글과 댓글은 공개 목록과 관심 글에서 보이지 않게 됩니다.' : '삭제한 내용은 공개 목록에서 보이지 않게 됩니다.')) return;
      button.disabled = true;
      try { await api('/' + ({ post: 'posts', comment: 'comments', service: 'services' }[type]) + '/' + id(rowId), { method: 'DELETE', data: { revision } }); notify(objectName + ' 삭제했습니다.'); if (type === 'comment') { state.commentEdit = null; navigate('post/' + id(postId)); } else navigate(type === 'post' ? 'community' : 'services'); }
      catch (error) { button.disabled = false; notify(error.message + (error.status === 409 ? ' 최신 내용을 다시 확인해 주세요.' : ''), true); } return;
    }
  })().catch(error => notify(error.message || '요청을 마치지 못했습니다.', true));
});
main.addEventListener('submit', event => {
  const form = event.target;
  event.preventDefault();
  if (form.dataset.search) { const query = new URLSearchParams(); for (const [key, value] of new FormData(form)) if (String(value).trim()) query.set(key, String(value).trim()); navigate(form.dataset.search + (query.size ? '?' + query : '')); return; }
  if (form.dataset.formKey) void submitForm(form);
});
main.addEventListener('input', event => { const form = event.target.closest('form[data-form-key]'); if (form) saveFormDraft(form); });
main.addEventListener('change', event => {
  const control = event.target;
  if (control.dataset.filter) { const query = new URLSearchParams(state.route.searchParams); if (control.value) query.set(control.dataset.filter, control.value); else query.delete(control.dataset.filter); navigate(state.route.pathname.slice(1) + (query.size ? '?' + query : '')); }
  const form = control.closest('form[data-form-key]'); if (form) saveFormDraft(form);
});
window.addEventListener('hashchange', () => { state.commentEdit = null; void renderRoute(); });
document.addEventListener('visibilitychange', () => { if (initialized && document.visibilityState === 'visible') void refreshSession({ redraw: true }); });
window.addEventListener('focus', () => { if (initialized) void refreshSession({ redraw: true }); });
await refreshSession();
const loginFailed = new URLSearchParams(location.search).get('login') === 'failed';
if (loginFailed) { notify('로그인을 끝내지 못했습니다. 가입 메일을 확인했다면 가입·로그인 버튼에서 새로 이어가 주세요.', true); history.replaceState(null, '', location.pathname + location.hash); }
const returnHash = storageGet('synk.ai-market.return');
if (userId() && returnHash?.startsWith('#/') && returnHash.length < 2000) { storageSet('synk.ai-market.return', null); history.replaceState(null, '', location.pathname + returnHash); }
await renderRoute();
initialized = true;
