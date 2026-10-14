import { readConfig } from './core.mjs';
import { benefitHero, benefitCards, benefitsPage, benefitDetail } from './member-benefits.mjs';
import { APPLICATIONS, messengerDestination, PATH_INTERVIEW_URL } from './applications.mjs';
import { createLibrary, LIBRARY_KEY, LIBRARY_ITEMS, libraryItemRoute, filterApplications } from './library.mjs';
import { createPlatformAccount } from './platform-account.mjs';
import { mountPlatformLibrary } from './platform-library-view.mjs';
import { platformRoute, searchRoute, shortcutDestination } from './platform-home.mjs';
import { platformPublicEntry, platformCompanyEntry } from './platform-entry.mjs';
import { PLATFORM_DOWNLOADS, DOWNLOAD_OS, DOWNLOAD_STEPS, downloadHref, checksumHref, downloadSize, detectDownloadOS, refreshPlatformDownloads } from './platform-downloads.mjs';
const $ = id => document.getElementById(id), root = $('page-content');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image = (name, cls = '') => `<img class="${cls}" src="./assets/${name}" alt="">`;
const appById = id => APPLICATIONS.find(app => app.id === id);
const itemById = id => LIBRARY_ITEMS.find(item => item.id === id);
let storage;try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('storage'); } }; }
const deviceLibrary = createLibrary(storage);
let continuity;
const library={...deviceLibrary,read(){const device=deviceLibrary.read(),cloud=continuity?.projection();return cloud?{...device,favorites:cloud.favorites,saved:[...new Set([...device.saved,...cloud.favorites])],recent:cloud.recent,rememberRecent:cloud.rememberRecent}:device;},dispatch:action=>deviceLibrary.dispatch(action)};
let config = readConfig({ version: 1 }, location.href), messengerUrl = null, clients = [], environment = null;
let category = 'all', collection = 'all', sort = 'default', query = platformRoute(location.hash).query, timer, detailTab = 'overview', downloadOS = 'windows', downloadPicked = false, downloadStarted = null, detectedOS = null;
const launches = new Map();
let browserAccount = null, startup = 0, startupPromise = null, pageActive = true, identity = { status: 'loading', displayName: '', message: '계정을 확인하고 있어요.' };
const labels = { home:'내 홈', benefits:'회원 혜택', discover:'둘러보기', library:'내 라이브러리', updates:'새소식', downloads:'다운로드', settings:'플랫폼 설정', help:'도움말', app:'앱 상세' };
const news = [
 {id:'clients',app:'platform',label:'플랫폼',title:'하나의 시작점, 독립적인 두 클라이언트',body:'SYNK 플랫폼에서 WORLD와 워크스페이스를 관리해요. 두 앱은 각각 설치되고 별도 창에서 실행됩니다. 플랫폼을 설치해도 두 앱이 자동으로 설치되지는 않아요.'},
 {id:'learning',app:'world',label:'SYNK WORLD',title:'네 가지 미니게임에서 시작하는 한국어 연습',body:'레이싱·말의 리듬·주문 폭주·바람길의 웹 체험이 준비되어 있어요. TOPIK I의 일부 듣기·읽기 과제를 연습하며, 게임 점수는 급수나 합격 판정이 아니에요.'},
 {id:'company',app:'messenger',label:'워크스페이스',title:'팀 대화와 공유 파일을 회사 공간에',body:'회사 초대·로그인을 거쳐 대화와 파일을 이용해요. 학습 기록과 회사 자료는 분리하고, 회사 직원의 접근 권한은 회사에서 관리합니다.'}
];
function notice(text) { clearTimeout(timer);$('platform-message').textContent = text;$('platform-message').hidden = false;timer = setTimeout(() => $('platform-message').hidden = true, 6500); }
function dispatch(action) { if(continuity?.connected()&&['favorite','launch','remember','clear-recent'].includes(action.type)){void continuity.dispatch(action).catch(error=>notice(error.message));return true;}try { deviceLibrary.dispatch(action);render();return true; } catch { render();notice('이 기기에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.');return false; } }
function route() { return platformRoute(location.hash); }
// Do not open an account-connected app without a verified Platform state.
// Native launches keep the main process's existing account handoff.
function accountEntryReady(id) {
 if (typeof window.synkDesktop?.authStatus === 'function') return true;
 return (!platformPublicEntry(id) && id !== 'messenger') || ['signed-in','signed-out'].includes(identity.status);
}
function accountEntryUnavailable() { notice('플랫폼 계정을 확인한 뒤 앱을 열 수 있어요. 계정 연결을 다시 확인해 주세요.'); }
function updateWebLink(link) {
 const href = link.dataset.accountHref || link.href;
 link.dataset.accountHref = href;
 if (!accountEntryReady(link.dataset.web)) {
  link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.setAttribute('tabindex','0');return false;
 }
 link.href = publicEntry(link.dataset.web, href);link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');return true;
}
function publicEntry(id, href) { if(id==='messenger')return platformCompanyEntry(href,browserAccount?.identity());const base=platformPublicEntry(id);if(!base)return href;try{const url=new URL(href);url.hash='';return url.href===base?platformPublicEntry(id,browserAccount?.identity()):href;}catch{return href;} }
function button(label, action, id='', cls='sb-btn soft', extra='') { if(action==='launch'){if(launches.get(id)==='loading'){label='여는 중…';extra+=' disabled aria-busy="true"';}else if(launches.get(id)==='error')label='다시 열기 ↗';}return `<button class="${cls}" data-action="${action}" data-id="${id}" ${extra}>${label}</button>`; }
function status(app) { if(app.webOnly)return '웹에서 이용 가능';const state = clients.find(item => item.id === app.id);return state?.canLaunch ? '클라이언트 실행 가능' : environment ? '설치 확인 필요' : '독립 클라이언트'; }
function heading(eyebrow, title, description='') { return `<div class="page-heading"><p class="sb-eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p>${description}</p>`:''}</div>`; }
function card(app) { const state = library.read(), benefit = app.kind === 'benefit', href = libraryItemRoute(app.id);return `<article class="app-card ${benefit?'benefit-':''}${app.id}" data-application="${app.id}"><a class="app-art" href="${href}" aria-label="${app.name} 상세 보기">${image(app.image)}<span>${benefit?'SYNK FOR YOU':app.id==='world'?'PLAY. LEARN. LIVE.':app.id==='path'?'EXPLORE. PRACTICE. PREPARE.':'TALK. SHARE. WORK.'}</span></a><div class="app-info"><div class="app-meta"><span>${benefit?'일상 · 회원 혜택':app.category==='learn'?'배움과 경험':'대화와 협업'}</span><span>${benefit?app.statusLabel:status(app)}</span></div><a class="app-title" href="${href}"><h3>${app.name}</h3></a><p>${app.subtitle}</p><div class="app-bottom"><a href="${href}" class="detail-link">${benefit?'서비스 살펴보기':'앱 알아보기'} →</a>${button(state.favorites.includes(app.id)?'★':'☆','favorite',app.id,'icon-btn',`aria-label="${app.name} 즐겨찾기" aria-pressed="${state.favorites.includes(app.id)}"`)}</div></div></article>`; }
function filters(isLibrary=false) { return `<div class="filter-bar"><div class="filter-buttons" role="group" aria-label="앱 분류">${[['all','전체'],['learn','학습 · 경험'],['work','업무 · 협업'],...(isLibrary?[['life','일상 · 회원 혜택']]:[])].map(([id,text])=>button(text,'filter',id,`filter-chip ${category===id?'selected':''}`,`aria-pressed="${category===id}"`)).join('')}</div><label class="sort-label">정렬 <select id="sort"><option value="default" ${sort==='default'?'selected':''}>기본순</option><option value="name" ${sort==='name'?'selected':''}>이름순</option><option value="recent" ${sort==='recent'?'selected':''}>최근 연 순</option></select></label></div>${isLibrary?`<div class="collections" role="group" aria-label="라이브러리 컬렉션">${[['all','내 바로가기 전체'],['favorites','즐겨찾기'],['learn','배움 컬렉션'],['work','업무 컬렉션']].map(([id,text])=>button(text,'collection-filter',id,`filter-chip ${collection===id?'selected':''}`,`aria-pressed="${collection===id}"`)).join('')}</div>`:''}`; }
function shelf(isLibrary=false) { const apps = filterApplications({query,category,collection:isLibrary?collection:'all',library:library.read(),onlySaved:isLibrary,sort});return `${filters(isLibrary)}<p class="result-count">${query?`‘${esc(query)}’ 검색 · `:''}${apps.length}개의 ${isLibrary?'바로가기':'앱'}</p>${apps.length?`<div class="app-grid">${apps.map(card).join('')}</div>`:`<div class="empty-state">${image('sticker-search.webp')}<h2>${isLibrary&&!library.read().saved.length?'나만의 라이브러리를 채워 보세요.':'조건에 맞는 앱이 없어요.'}</h2><p>${isLibrary?'앱이나 회원 혜택 상세에서 라이브러리에 담으면 이곳에서 쉽게 찾을 수 있어요.':'검색어를 바꾸거나 다른 분류를 선택해 보세요.'}</p>${button('검색·필터 지우기','clear-search')}</div>`}`; }
function newsCards(items=news) { return `<div class="news-grid">${items.map(item=>`<button class="news-card" data-action="news" data-id="${item.id}"><span class="sb-eyebrow">${item.label} · 개발 소식</span><h3>${item.title}</h3><span class="small">2026.10.02 <span aria-hidden="true">↗</span></span></button>`).join('')}</div>`; }
function accountPanel() {
 if (typeof window.synkDesktop?.authStatus === 'function') return '';
 const title = identity.status==='signed-in' ? (identity.displayName ? `${identity.displayName}님의 SYNK` : '내 SYNK ID로 연결됐어요') : identity.status==='loading'?'계정을 확인하고 있어요':identity.status==='error'?'계정 연결을 다시 확인해요':identity.status==='unconfigured'?'계정 연결 설정을 확인해요':'내 SYNK ID로 이어쓰기';
 return `<section class="content-panel account-panel" aria-label="SYNK 계정 연결" aria-busy="${identity.status==='loading'}"><div><p class="sb-eyebrow">MY SYNK ID</p><h2>${esc(title)}</h2><p role="status">${esc(identity.message)}</p></div><div class="actions"><a class="sb-btn soft" href="./client.html?product=platform">${identity.status==='signed-in'?'계정·연결 기록 보기':'로그인·계정 확인'} →</a>${['error','unconfigured'].includes(identity.status)?button('계정 다시 확인','retry-account'):''}</div></section>`;
}
function showBrowserAccount(state) {
 identity = state;
 const entry = document.querySelector('.account-entry');
 let label = entry.querySelector('[data-account-label]');
 if(!label){label=document.createElement('span');label.dataset.accountLabel='';entry.replaceChildren(...[entry.querySelector('img, .avatar'),label].filter(Boolean));}
 label.textContent = state.status==='signed-in' ? (state.displayName || '내 SYNK ID') : state.status==='loading'?'계정 확인 중':state.status==='error'?'계정 다시 확인':'SYNK ID 로그인';
 entry.setAttribute('aria-label',state.status==='signed-in'?'연결된 SYNK ID와 기록 관리':'SYNK ID 로그인과 계정 확인');render();
}
function quickCard(id, recent) {
 const entryId=id==='messenger'&&recent?.entryId==='teacher'?'teacher':id,item=itemById(id), destination=shortcutDestination(entryId,{base:location.href,clients,learningUrl:config.learningUrl,messengerUrl,preferredMode:recent?.mode});
 if(!item||!destination)return '';
 const error=launches.get(id)==='error';
 const action=destination.kind==='client'?button(destination.label,'launch',entryId,'sb-btn'):`<a href="${esc(destination.href)}" ${destination.kind==='web'?`data-web="${entryId}" target="_blank" rel="noopener noreferrer"`:''} class="sb-btn">${destination.label}</a>`;
 const detail=libraryItemRoute(id), meta=recent?`${recent.mode==='web'?'웹 링크 선택':'앱 실행 요청'} · ${new Date(recent.at).toLocaleDateString('ko-KR')}`:item.kind==='benefit'?item.statusLabel:library.read().favorites.includes(id)?'즐겨찾는 앱':item.id==='path'?'실사 면접 · 60~90초':item.category==='learn'?'한국어 · 미니게임':'회사 초대 필요';
 return `<article class="quick-card" data-shortcut="${id}"><div class="quick-title">${image(item.image)}<div><h3>${esc(item.name)}</h3><p>${esc(meta)}</p></div></div><div class="quick-actions">${action}<a href="${detail}" class="plain">소개 보기</a></div>${error?'<p class="launch-feedback" role="status">앱을 열지 못했어요. 다시 열거나 <a href="#downloads">설치 상태를 확인해 주세요.</a></p>':''}</article>`;
}
function recentSection() {
 const recents=library.read().recent;
 return recents.length?`<section class="home-section"><div class="section-heading"><div><p class="sb-eyebrow">RECENTLY SELECTED</p><h2>최근 선택한 공간</h2></div>${button('기록 지우기','clear-recent','','plain')}</div><p class="home-section-note">${continuity?.connected()?'계정에 보관한 최근 바로가기예요.':'이 기기에서 선택한 바로가기예요.'} 앱 안의 진행 위치는 각 앱에서 확인해 주세요.</p><div class="quick-grid">${recents.map(item=>quickCard(item.id,item)).join('')}</div></section>`:'';
}
function homePage() {
 const state=library.read(), hasShortcuts=state.recent.length||state.favorites.length;
 return `<section class="home-welcome"><p class="sb-eyebrow">YOUR SYNK</p><h1>오늘도, 편하게.</h1><p>${hasShortcuts?'자주 찾는 공간을 바로 열어 보세요.':'작은 경험부터 시작해 보세요. 마음에 드는 공간은 즐겨찾아 둘 수 있어요.'}</p><div class="actions"><a href="#discover" class="sb-btn soft">${hasShortcuts?'다른 경험 둘러보기':'SYNK 둘러보기'} →</a><a href="#library" class="plain">내 라이브러리</a></div></section>`+accountPanel()+recentSection()
 + (state.favorites.length?`<section class="home-section"><div class="section-heading"><div><p class="sb-eyebrow">YOUR FAVORITES</p><h2>내가 즐겨찾는 공간</h2></div><a href="#library">라이브러리 관리 →</a></div><div class="quick-grid">${state.favorites.map(id=>quickCard(id)).join('')}</div></section>`:'')
 + (!hasShortcuts?`<section class="home-section"><div class="section-heading"><div><p class="sb-eyebrow">A LITTLE START</p><h2>가볍게 시작해 볼까요?</h2></div><a href="#benefits">회원 혜택 보기 →</a></div><div class="quick-grid">${['world','path','care'].map(id=>quickCard(id)).join('')}</div></section>`:'')
 + '<p class="home-device-note">'+(continuity?.connected()?'즐겨찾기와 최근 열기는 연결한 계정에 보관해요. 담은 목록과 컬렉션은 이 기기에 남아요.':'즐겨찾기와 최근 선택은 이 기기에만 보관해요.')+' <a href="#settings">보관 설정</a></p>';
}
function discover() {
 const recents = library.read().recent;
 return (!query?accountPanel():'')+(query ? heading('DISCOVER','찾고 있는 SYNK','앱과 회원 혜택을 함께 찾아보세요.') : benefitHero({home:true})+'<div class="benefit-home-strip"><span>일상을 위한 회원 혜택 · 배움을 위한 WORLD</span><a href="#app/world">SYNK WORLD도 만나보세요 ↗</a></div>')
 + '<section class="benefit-home-collection"><div class="section-heading"><div><p class="sb-eyebrow">SYNK FOR YOU</p><h2>'+(query?'검색된 회원 혜택':'당신을 위한 네 가지 경험')+'</h2></div><a href="#benefits">회원 혜택 모두 보기 →</a></div>'+benefitCards(query)+'</section>'
 + (recents.length&&!query ? recentSection():'')
 + '<section><div class="section-heading"><div><p class="sb-eyebrow">EXPLORE SYNK</p><h2>우리의 일과 배움을 위한 앱</h2></div><a href="#library">내 라이브러리 →</a></div>'+shelf()+'</section>'
 + (!query?'<section class="news-section"><div class="section-heading"><h2>지금, SYNK에서는</h2><a href="#updates">새소식 모두 보기 →</a></div>'+newsCards()+'</section>':'');
}
function libraryPage() { return heading('MY LIBRARY',continuity?.connected()?'계정으로 이어가는 즐겨찾기':'이 기기의 바로가기',continuity?.connected()?'즐겨찾기·최근 열기는 계정에, 담은 목록과 컬렉션은 이 기기에 보관해요. 설치·구매·이용 권한은 각 앱에서 확인해요.':'앱과 회원 혜택의 바로가기를 이 기기에 담아요. 위의 계정 라이브러리를 켜면 즐겨찾기·최근 열기를 다른 기기와 연결할 수 있어요.')+shelf(true); }
function pathAppPage(app) {
 const requirements=detailTab==='requirements';
 return `<a class="back-link" href="#discover">← 모든 앱</a><section class="detail-hero path"><div><p class="sb-eyebrow">SYNK · INTERVIEW PRACTICE</p><h1>${app.name}</h1><h2>${app.subtitle}</h2><p>${app.description}</p><div class="tags">${app.tags.map(tag=>`<span>${tag}</span>`).join('')}</div></div>${image(app.image)}</section><div class="launch-bar"><div><strong>웹에서 이용 가능</strong><p>설치·로그인 없이 시작하는 공개 면접 연습</p></div><div class="actions">${launchControls(app)}</div></div><div class="detail-tabs" role="group" aria-label="앱 상세 항목">${[['overview','소개'],['requirements','이용 안내']].map(([id,title])=>button(title,'detail-tab',id,`filter-chip ${detailTab===id?'selected':''}`,`aria-pressed="${detailTab===id}"`)).join('')}</div>
 ${requirements?`<section class="content-panel"><h2>앉아서, 편한 속도로 시작해요.</h2><dl class="specs"><dt>PC</dt><dd>글로 답하거나 한국어 음성을 준비해 마이크로 답할 수 있어요.</dd><dt>Quest</dt><dd>Quest 브라우저에서 같은 주소를 열고, 한국어 음성 준비 → 마이크 확인 → VR 입장 순서로 진행해요.</dd><dt>첫 음성 준비</dt><dd>약 103MB의 한국어 음성 모델을 내려받아요. 준비 시간은 면접 시간에 포함되지 않아요.</dd><dt>둘러보기</dt><dd>PC는 30도 회전과 선택형 저감도 드래그, VR은 실제 고개 움직임을 따라가요.</dd><dt>기록</dt><dd>음성과 답변은 기기 메모리에서 처리하며 서버나 계정에 저장하지 않아요.</dd></dl><p>실제 Quest 착용·마이크·멀미 감소 효과는 아직 확인 전이에요. 불편하면 바로 종료하고 쉬어 주세요.</p></section>`:`<div class="detail-columns"><section class="content-panel"><h2>질문부터 후속 질문까지, 하나의 면접실에서.</h2><p>${app.available}</p><ul class="feature-list"><li><strong>세 면접관의 시선</strong><span>차분한 평가 시선, 문서 확인과 필기가 이어지는 면접 분위기</span></li><li><strong>답변에 맞는 후속 질문</strong><span>내가 말한 경험이나 준비 내용에 따라 두 질문 중 하나로 연결</span></li><li><strong>60~90초 연습</strong><span>질문 → 첫 답변 → 후속 질문 → 두 번째 답변. 조기 답변은 더 빨리 끝나요.</span></li></ul></section><aside class="content-panel app-side"><h3>현재 제공 범위</h3><p>실사 영상으로 만든 착석형 면접실 MVP예요. 실제 채용 평가나 자유 대화 AI는 아니에요.</p><p>큰 위치 이동의 시차를 제공하는 360도 촬영 영상은 아니며, Quest 실착용 검증은 남아 있어요.</p><p class="small">면접 답변은 저장하지 않아요. 플랫폼의 즐겨찾기·최근 열기는 면접 내용과 별개예요.</p></aside></div>`}`;
}
function launchControls(app) { const client = !app.webOnly&&clients.find(item=>item.id===app.id), web = app.id==='path'?PATH_INTERVIEW_URL:app.id==='world'?platformPublicEntry('world'):messengerUrl;return `${client?.canLaunch?button('클라이언트 실행 ↗','launch',app.id,'sb-btn'):web?`<a href="${esc(web)}" data-web="${app.id}" target="_blank" rel="noopener noreferrer" class="sb-btn">${app.id==='path'?'실사 면접실 열기':app.id==='world'?'웹 WORLD 열기':'회사 웹 메신저 열기'} ↗</a>`:`<a href="#downloads" class="sb-btn">설치·다운로드 확인 →</a>`}${button(library.read().saved.includes(app.id)?'라이브러리에서 빼기':'라이브러리에 담기','save',app.id)}${button(library.read().favorites.includes(app.id)?'★ 즐겨찾는 앱':'☆ 즐겨찾기','favorite',app.id,'sb-btn soft',`aria-pressed="${library.read().favorites.includes(app.id)}"`)}`; }
function appPage(id) { const app=appById(id);if(app?.id==='path')return pathAppPage(app);if(!app) return heading('NOT FOUND','앱을 찾을 수 없어요.')+'<a href="#discover">둘러보기로 돌아가기</a>';const state=library.read();return `<a class="back-link" href="#discover">← 모든 앱</a><section class="detail-hero ${app.id}"><div><p class="sb-eyebrow">SYNK · ${app.category==='learn'?'LEARNING & EXPERIENCE':'TEAM WORKSPACE'}</p><h1>${app.name}</h1><h2>${app.subtitle}</h2><p>${app.description}</p><div class="tags">${app.tags.map(tag=>`<span>${tag}</span>`).join('')}</div></div>${image(app.image)}</section><div class="launch-bar"><div><strong>${status(app)}</strong><p>플랫폼과 별도로 설치·실행되는 앱</p></div><div class="actions">${launchControls(app)}</div></div><div class="detail-tabs" role="group" aria-label="앱 상세 항목">${[['overview','소개'],['requirements','설치 안내'],['news','앱 소식']].map(([id,title])=>button(title,'detail-tab',id,`filter-chip ${detailTab===id?'selected':''}`,`aria-pressed="${detailTab===id}"`)).join('')}</div>
${detailTab==='news'?newsCards(news.filter(item=>item.app===app.id)):detailTab==='requirements'?`<section class="content-panel"><h2>독립 클라이언트로 이용해요.</h2><dl class="specs"><dt>대상 운영체제</dt><dd>Android · iOS · Windows · macOS · 웹</dd><dt>설치 방식</dt><dd>PC는 앱별 설치 · 모바일은 웹과 홈 화면 입구 지원</dd><dt>최소 사양·용량</dt><dd>정식 배포 파일 검증 후 안내</dd><dt>로그인</dt><dd>${app.id==='world'?'SYNK ID · 서비스별 학습 연결 상태 확인':'회사 초대·회사 로그인 · 연결된 SYNK ID는 회사 권한 별도 확인'}</dd><dt>업데이트</dt><dd>배포 서명과 버전 확인 후 제공 · 현재 공개 채널 미연결</dd></dl><a href="#downloads">다운로드 현황 보기 →</a></section>`:`<div class="detail-columns"><section class="content-panel"><h2>${app.id==='world'?'하나의 앱, 이어지는 배움.':'함께 일하는 데 필요한 것들.'}</h2><p>${app.available}</p>${app.id==='world'?`<ul class="feature-list"><li><strong>미니게임</strong><span>레이싱 · 말의 리듬 · 주문 폭주 · 바람길</span></li><li><strong>SYNK TOWN</strong><span>배운 한국어를 사용하는 생활 콘텐츠 · 데스크톱 제공 준비</span></li><li><strong>숙제 · AI 코칭</strong><span>WORLD 안에서 학습 기록을 이어 쓰는 기능</span></li></ul>`:`<ul class="feature-list"><li><strong>팀 대화</strong><span>채널과 개인 대화, 검색으로 필요한 이야기 찾기</span></li><li><strong>파일 공유</strong><span>회사 공간에서 파일을 나누고 다시 찾기</span></li><li><strong>회사 권한</strong><span>초대받은 구성원만, 부여된 역할에 맞춰 접근</span></li></ul>`}<div class="web-preview"><strong>지금은 웹으로 먼저 둘러볼 수 있어요.</strong><p>웹 체험은 클라이언트 설치와 별개예요.</p>${app.id==='world'||messengerUrl?`<a class="sb-btn soft" href="${esc(app.id==='world'?platformPublicEntry('world'):messengerUrl)}" data-web="${app.id}" target="_blank" rel="noopener noreferrer">${app.id==='world'?'웹 WORLD 열기':'회사 웹 메신저 열기'} ↗</a>`:'<p>회사 웹 접속 주소가 아직 등록되지 않았어요.</p>'}</div></section><aside class="content-panel app-side"><h3>내 컬렉션에 정리</h3><p class="small">이 기기에서만 저장해요.</p>${[['learn','배움'],['work','업무']].map(([id,label])=>`<label class="toggle"><input type="checkbox" data-collection="${id}" data-id="${app.id}" ${state.collections[id].includes(app.id)?'checked':''}>${label} 컬렉션</label>`).join('')}<hr><h3>계정과 접근 권한</h3><p>${app.audience}</p><p class="small">라이브러리에 담는 것으로 이용 권한이 생기지 않아요. ${app.id==='messenger'?'학원 교직원 권한과 회사 직원 권한도 구분해요.':'게임 점수는 TOPIK 급수·합격 판정이 아니에요.'}</p><a href="./client.html?product=platform">SYNK ID 관리 ↗</a></aside></div>`}`; }
function downloads() {
 const os=downloadOS,d=PLATFORM_DOWNLOADS[os],mac=os!=='windows',started=downloadStarted===os;
 const tabs=`<div class="filter-buttons os-tabs" role="group" aria-label="운영체제">${DOWNLOAD_OS.map(id=>button(esc(PLATFORM_DOWNLOADS[id].tab)+(detectedOS===id?'<span class="dl-here">이 기기</span>':''),'os',id,`filter-chip ${os===id?'selected':''}`,`aria-pressed="${os===id}"`)).join('')}</div>${mac?'<p class="dl-hint">어떤 칩인지 모르겠다면 왼쪽 위 Apple 메뉴 → 이 Mac에 관하여에서 확인하세요.</p>':''}`;
 const hero=`<section class="detail-hero dl-hero" aria-label="SYNK 플랫폼 ${esc(d.tab)} 다운로드">${image('brand-synk-paper.webp')}<span class="dl-sticker">${esc(d.sticker)}</span><div><p class="sb-eyebrow">SYNK · PLATFORM · PREVIEW ${PLATFORM_DOWNLOADS.version}</p><h1>SYNK Platform</h1><h2>${esc(d.label)}${mac?` · ${esc(d.chip)}`:''}</h2><p>앱을 찾고 라이브러리에 담아 두는 시작점이에요. WORLD와 사내 메신저는 플랫폼 안에서 설치해요.</p></div></section>`;
 const readouts=`<dl class="dl-readouts"><div><dt>파일</dt><dd>${esc(d.file)}</dd></div><div><dt>크기</dt><dd>${downloadSize(d.bytes)}</dd></div><div><dt>필요</dt><dd>${esc(d.need)}</dd></div><div><dt>서명</dt><dd>${esc(d.sign)} Preview</dd></div></dl>`;
 const actions=`<div class="dl-actions"><a class="sb-btn dl-get" href="${downloadHref(os)}" data-action="download-start" data-id="${os}">${esc(d.label)} <span aria-hidden="true">↓</span></a><a class="sb-btn soft" href="${checksumHref(os)}" target="_blank" rel="noopener">파일 확인값(SHA-256) ↗</a></div>`;
 const next=started?`<div class="dl-next" role="status"><p class="dl-started">다운로드를 시작했어요</p><p class="small">파일을 다 받으면 아래 순서대로 열어 주세요.</p><ol class="dl-steps">${DOWNLOAD_STEPS[mac?'mac':'windows'].map(([title,body])=>`<li><strong>${esc(title)}</strong><p>${esc(body)}</p></li>`).join('')}</ol><p class="small dl-retry">다운로드가 시작되지 않았나요? <a href="${downloadHref(os)}">다시 받기</a></p></div>`:'';
 const apps=APPLICATIONS.filter(app=>!app.webOnly).map(app=>{const client=clients.find(item=>item.id===app.id);return `<article class="download-row">${image(app.image)}<div><h2>${app.name}</h2><p>SYNK 플랫폼에서 앱을 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 함께 든 설치 파일을 확인한 뒤 설치 창이 열려요.</p><span class="small">${client?.status==='current'?'현재 실행 중':client?.canLaunch?'이 기기에 설치돼 있어요.':environment?'아직 설치하지 않았어요.':'설치는 SYNK 플랫폼에서 해요.'}</span></div><div class="download-action">${client?.canLaunch?button('클라이언트 실행','launch',app.id):''}${button('설치 안내','install-info',app.id,'plain')}</div></article>`;}).join('');
 return heading('DOWNLOADS','SYNK를, 내 기기에.','플랫폼을 먼저 설치하고, WORLD와 사내 메신저는 플랫폼 안에서 설치해요. 앱마다 따로 실행되고 데이터도 따로 지켜요.')+tabs+hero+`<div class="dl-panel">${readouts}${actions}${next}</div><h2 class="dl-sub">플랫폼 안에서 설치하는 앱</h2><div class="download-list">${apps}</div><section class="content-panel"><h2>업데이트</h2><p>자동 업데이트는 아직 없어요. 새 판이 나오면 이 화면이나 synk.im에서 받아 같은 자리에 덮어 설치하면 돼요. 계정과 앱 데이터는 그대로예요.</p>${button('설치 상태 다시 확인','refresh-clients')}</section>`;
}
function settings() { const state=library.read();return heading('PREFERENCES','내 방식으로 사용하는 SYNK','계정 라이브러리를 켠 동안 즐겨찾기와 최근 열기는 계정에 저장해요. 화면 설정·컬렉션은 이 기기에 보관해요.')+`<section class="content-panel"><h2>라이브러리</h2><label class="setting-row"><span><strong>최근 열기 기록 보관</strong><small>앱·서비스와 열기 요청 시각만 보관해요. 끄면 현재 목록도 지워요.</small></span><input type="checkbox" data-setting="remember" ${state.rememberRecent?'checked':''}></label><label class="setting-row"><span><strong>간결한 카드 보기</strong><small>라이브러리 그림을 작게 표시해요.</small></span><input type="checkbox" data-setting="compact" ${state.compact?'checked':''}></label></section><section class="content-panel"><h2>이 기기의 플랫폼 데이터</h2><p>이 기기의 바로가기·컬렉션·화면 설정을 관리해요. 계정에 연결한 즐겨찾기·최근 열기·메모는 위의 계정 라이브러리에서 관리하거나 삭제할 수 있어요.</p><div class="actions">${button('설정 내려받기','export')}${button('이 기기의 플랫폼 설정 지우기','reset-confirm','','plain danger')}</div></section><section class="content-panel"><h2>SYNK ID와 앱 데이터</h2><p>로그인 세션과 비공개 데이터는 클라이언트별로 나뉘어요. 회사 대화·파일과 WORLD의 학습 기록을 섞지 않아요.</p><a href="./index.html">공통 계정 관리 열기 ↗</a></section>`; }
function help() { return heading('HELP','SYNK를 시작하는 방법')+`<section class="content-panel"><h2>1. SYNK 플랫폼을 설치해요.</h2><p>Windows와 Mac용 런처예요. 다운로드 화면에서 내 기기에 맞는 파일을 받아 설치하고, 앱을 찾아 라이브러리에 담아 관리해요.</p><h2>2. 필요한 앱을 따로 설치해요.</h2><p>WORLD와 사내 메신저는 각각의 클라이언트입니다. 플랫폼 설치가 두 앱 설치를 대신하지 않으며, 앱 데이터·로그인 세션·업데이트도 따로 관리합니다. 플랫폼에서 앱을 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요.</p><h2>3. 같은 SYNK ID로 연결해요.</h2><p>SYNK ID로 계정을 연결해요. 서비스마다 저장·동의 상태를 확인하며, 메신저는 회사 초대·로그인과 회사가 확인한 이용 권한이 필요해요.</p><h2>라이브러리에 담으면 이용권이 생기나요?</h2><p>아니요. 라이브러리는 앱 바로가기를 정리하는 공간입니다. 설치 여부·구매·이용 자격은 각각 확인해요.</p><h2>현재 사용할 수 있는 것은 무엇인가요?</h2><p>플레저 공개 웹과 앱별 웹 체험, 앱·회원 혜택의 기기 라이브러리·즐겨찾기를 사용할 수 있어요. 개발 미리보기와 정식 공개 서비스를 구분해 안내해요. Windows·Mac용 플랫폼 Preview는 다운로드 화면에서 받을 수 있고, 자동 업데이트는 아직 없어요.</p><a href="#downloads" class="sb-btn soft">다운로드 열기</a></section>`; }
function render() { const active = root.contains(document.activeElement) ? document.activeElement : null;const focus = active ? ['id','data-action','data-id','data-collection','data-setting','href','data-web'].map(key=>[key,active.getAttribute(key)]).filter(([,value])=>value!==null) : [];const {page,id}=route(), state=library.read();$('page-label').textContent=labels[page];$('library-count').textContent=state.saved.length;document.body.classList.toggle('compact-cards',state.compact);document.querySelectorAll('[data-route]').forEach(node=>{ if(node.dataset.route===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current'); });root.innerHTML=page==='home'?homePage():page==='benefits'?(id?benefitDetail(id,location.href,{library:state}):benefitsPage()):page==='discover'?discover():page==='library'?libraryPage():page==='app'?appPage(id):page==='downloads'?downloads():page==='settings'?settings():page==='updates'?heading('WHAT’S NEW','SYNK의 새로운 이야기','공개 출시 공지와 구분해 현재 개발 소식을 전해요.')+newsCards():help();for(const link of root.querySelectorAll('[data-web]'))updateWebLink(link);if(focus.length){const next=[...root.querySelectorAll('a,button,input,select')].find(node=>focus.every(([key,value])=>node.getAttribute(key)===value));next?.focus({preventScroll:true});} }
function modal(title,body,extra='') { $('dialog-content').innerHTML=`<h2>${title}</h2><p>${body}</p>${extra}`;$('platform-dialog').showModal(); }
async function refreshClients() { if(!window.synkDesktop)return;const bounded=p=>{let t;return Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(new Error('timeout')),5000))]).finally(()=>clearTimeout(t));};try { const [env,list]=await bounded(Promise.all([window.synkDesktop.getEnvironment(),window.synkDesktop.getClients()]));environment=env;clients=Array.isArray(list)?list.filter(v=>['platform','world','messenger'].includes(v.id)):[];$('environment-label').textContent=`${env.platform==='darwin'?'macOS':'Windows'} · ${env.mode==='development'?'개발 클라이언트':'플랫폼'}`;render(); } catch { clients=[];notice('설치 정보를 읽지 못했어요. 잠시 뒤 다시 확인해 주세요.');render(); } }
root.addEventListener('click',async event=>{
 const link=event.target.closest('[data-web]');if(link) { if(!updateWebLink(link)){event.preventDefault();accountEntryUnavailable();return;}dispatch({type:'launch',id:link.dataset.web,mode:'web'});return; }
 const control=event.target.closest('[data-action]');if(!control)return;const {action,id}=control.dataset;
 if(action==='scroll-benefits')document.getElementById('benefit-collection')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  else if(action==='retry-account')await refreshBrowserAccount();
 else if(['save','favorite'].includes(action)){if(dispatch({type:action,id}))notice(action==='save'?'라이브러리를 변경했어요. 설치나 이용 권한은 바뀌지 않아요.':'즐겨찾기를 변경했어요.');}
 else if(action==='filter'){category=id;render();}
 else if(action==='collection-filter'){collection=id;render();}
 else if(action==='clear-search'){query='';category='all';collection='all';$('platform-search').value='';location.hash=searchRoute(route().page,'');render();}
 else if(action==='detail-tab'){detailTab=id;render();}
 else if(action==='os'){downloadOS=id;downloadPicked=true;downloadStarted=null;render();}
 else if(action==='download-start'){downloadStarted=id;setTimeout(render,0);}
 else if(action==='clear-recent')dispatch({type:action});
 else if(action==='news'){const item=news.find(v=>v.id===id);if(item)modal(item.title,item.body,'<p class="small">2026.10.02 · 개발 소식</p>');}
 else if(action==='install-info')modal('WORLD·사내 메신저 설치','두 앱의 설치 파일은 SYNK 플랫폼 안에 들어 있어요. 플랫폼에서 앱을 고르고 「설치 파일 준비」를 누르면 파일을 확인하고, 「설치 시작」을 누르면 설치 창이 열려요. 설치를 마친 뒤 「설치 상태 확인」을 누르면 바로 실행할 수 있어요.');
 else if(action==='refresh-clients'){if(!window.synkDesktop)notice('설치된 앱은 데스크톱 플랫폼에서 확인할 수 있어요. 지금은 웹 미리보기입니다.');else await refreshClients();}
 else if(action==='launch'){if(launches.get(id)==='loading')return;const launchRoute=location.hash;launches.set(id,'loading');control.disabled=true;render();try{if(!window.synkDesktop)throw new Error();const result=await window.synkDesktop.launch(id);if(!result?.ok)throw new Error();launches.delete(id);const saved=dispatch({type:'launch',id,mode:'client'});notice(saved?'별도 클라이언트에 실행을 요청했어요.':'클라이언트에 실행을 요청했지만, 최근 열기 기록은 저장하지 못했어요.');}catch{launches.set(id,'error');notice('클라이언트를 실행하지 못했어요. 설치 상태를 다시 확인해 주세요.');}finally{render();if(location.hash===launchRoute)root.querySelector(`[data-action="launch"][data-id="${id}"]`)?.focus({preventScroll:true});}}
 else if(action==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(library.read(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='synk-platform-device-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 else if(action==='reset-confirm')modal('이 기기의 설정을 지울까요?','라이브러리, 즐겨찾기, 컬렉션, 최근 열기와 화면 설정만 지워요. 계정·학습 기록·회사 자료·설치된 앱은 그대로입니다.',button('플랫폼 설정 지우기','reset','','sb-btn'));
});
$('dialog-content').addEventListener('click',event=>{if(event.target.closest('[data-action="reset"]')){const saved=dispatch({type:'reset'});$('platform-dialog').close();if(saved)notice('이 기기의 플랫폼 설정을 지웠어요.');}});
$('dialog-close').onclick=()=>$('platform-dialog').close();
document.querySelector('.skip-link').onclick=event=>{event.preventDefault();root.focus();root.scrollIntoView({block:'start'});};
root.addEventListener('change',event=>{const target=event.target;if(target.id==='sort'){sort=target.value;render();}else if(target.dataset.setting)dispatch({type:target.dataset.setting,value:target.checked});else if(target.dataset.collection)dispatch({type:'collection',id:target.dataset.id,collection:target.dataset.collection});});
$('platform-search').value=query;
$('search-form').onsubmit=event=>{event.preventDefault();query=$('platform-search').value.trim().slice(0,120);category='all';collection='all';location.hash=searchRoute(route().page,query);render();};
$('platform-search').addEventListener('search',()=>{if(!$('platform-search').value){query='';location.hash=searchRoute(route().page,'');render();}});
window.addEventListener('hashchange',()=>{detailTab='overview';query=route().query;$('platform-search').value=query;if(route().page!=='library'&&category==='life')category='all';render();root.focus({preventScroll:true});window.scrollTo(0,0);});
window.addEventListener('storage',event=>{if(event.key===LIBRARY_KEY||event.key===null){library.reload();render();}});
const continuityRoot=document.createElement('aside');continuityRoot.setAttribute('aria-label','계정 라이브러리');root.before(continuityRoot);
const continuityStyle=document.createElement('link');continuityStyle.rel='stylesheet';continuityStyle.href='./src/platform-library.css';document.head.append(continuityStyle);
continuity=mountPlatformLibrary(continuityRoot,{getHost:()=>browserAccount,ensureReady:()=>refreshBrowserAccount(),onChange:()=>render(),getDevice:()=>deviceLibrary.read(),onLogin:()=>location.assign('./client.html?product=platform'),onManage:()=>location.assign('./client.html?product=platform'),onOpen:id=>{const destination=shortcutDestination(id,{base:location.href,clients,learningUrl:config.learningUrl,messengerUrl});if(destination?.kind==='web'){if(!accountEntryReady(id)){accountEntryUnavailable();return;}dispatch({type:'launch',id,mode:'web'});location.assign(publicEntry(id,destination.href));}else location.hash=libraryItemRoute(id);}});
render();
async function loadStartup(){
 const attempt=++startup, browser=typeof window.synkDesktop?.authStatus!=='function';let failed=false;
 browserAccount?.stop();browserAccount=null;if(browser)showBrowserAccount({status:'loading',displayName:'',message:'계정 연결을 확인하고 있어요.'});
 const abort=new AbortController(), timeout=setTimeout(()=>abort.abort(),8000);
 try{const response=await fetch('./config.json',{cache:'no-store',credentials:'omit',signal:abort.signal});let next;if(response.ok)next=readConfig(await response.json(),location.href);else if(response.status===404)next=readConfig({version:1},location.href);else throw new Error();if(attempt!==startup)return;config=next;messengerUrl=messengerDestination(config.messengerUrl,location.href);}
 catch{if(attempt!==startup)return;failed=true;messengerUrl=null;notice('앱 연결 설정을 확인하지 못했어요. 다시 확인해 주세요.');}
 finally{clearTimeout(timeout);}
 if(attempt!==startup)return;render();await refreshClients();if(!browser||attempt!==startup)return;
 if(failed){showBrowserAccount({status:'error',displayName:'',message:'계정 연결 설정을 불러오지 못했어요. 로그인 정보는 유지했으니 다시 확인해 주세요.'});return;}
 let accountStorage;try{accountStorage=sessionStorage;}catch{}
 browserAccount=createPlatformAccount({config,storage:accountStorage,onStatus:showBrowserAccount});if(!pageActive||document.hidden)browserAccount.invalidate();else await browserAccount.refresh();
}
function start(){
 if(startupPromise)return startupPromise;
 const pending=loadStartup();startupPromise=pending;
 void pending.finally(()=>{if(startupPromise===pending)startupPromise=null;});return pending;
}
function refreshBrowserAccount(){
 if(!pageActive||document.hidden||typeof window.synkDesktop?.authStatus==='function')return Promise.resolve();
 // Invalidation hides identity as loading, so derive readiness from the config.
 // Concurrent online/return events still share one configuration retry.
 const client=config.clients?.platform;
 return !browserAccount||!config.configured||!client?.clientId||!client.redirectUri?start():browserAccount.refresh();
}
void start();
window.addEventListener('pagehide',()=>{pageActive=false;browserAccount?.invalidate();});
window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted)void refreshBrowserAccount();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)browserAccount?.invalidate();else void refreshBrowserAccount();});
window.addEventListener('online',()=>{void refreshBrowserAccount();});

// Account identity is display-only here. Each application authenticates independently.
if (typeof window.synkDesktop?.authStatus === 'function') {
  const entry = document.querySelector('.account-entry');
  const label = document.createElement('span');label.textContent = 'SYNK ID';
  entry.replaceChildren(...[entry.querySelector('img, .avatar'), label].filter(Boolean));
  const show = state => {
    label.textContent = state.signedIn ? (state.account?.display_name || '내 SYNK ID') : 'SYNK ID 로그인';
    entry.setAttribute('aria-label', state.signedIn ? '연결된 SYNK ID 관리' : 'SYNK ID로 로그인');
  };
  const stop = window.synkDesktop.onAuthChanged(show);
  void window.synkDesktop.authStatus().then(show).catch(() => { label.textContent = 'SYNK ID 확인'; });
  window.addEventListener('pagehide', stop, { once: true });
}
void detectDownloadOS().then(os=>{detectedOS=os;if(!os||downloadPicked)return;downloadOS=os==='mac'?'mac-arm64':os;if(route().page==='downloads')render();});
void refreshPlatformDownloads().then(changed=>{if(changed&&route().page==='downloads')render();});
