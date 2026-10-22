import { readConfig } from './core.mjs';
import { benefitHero, benefitCards, benefitsPage, benefitDetail } from './member-benefits.mjs';
import { APPLICATIONS, messengerDestination, PATH_INTERVIEW_URL } from './applications.mjs';
import { createLibrary, LIBRARY_KEY, LIBRARY_ITEMS, libraryItemRoute, filterApplications } from './library.mjs';
import { createPlatformAccount } from './platform-account.mjs';
import { createMemberInsight } from '../../../desktop/renderer/member-insight.mjs';
import { createMemberActivity } from '../../../desktop/renderer/member-activity-controller.mjs';
import { createMemberUnderstanding } from '../../../desktop/renderer/member-understanding-controller.mjs';
import { createMemberSettings } from '../../../desktop/renderer/member-settings.mjs';
import { bindMemberUnderstandingEditor, captureMemberUnderstandingFocus } from '../../../desktop/renderer/member-understanding-host.mjs';
import { mountPlatformLibrary } from './platform-library-view.mjs';
import { platformRoute, searchRoute, shortcutDestination } from './platform-home.mjs';
import { platformPublicEntry, platformCompanyEntry } from './platform-entry.mjs';
import { PLATFORM_DOWNLOADS, DOWNLOAD_OS, DOWNLOAD_STEPS, RELEASE_PAGE, downloadHref, checksumHref, downloadSize, downloadsState, detectDownloadOS, refreshPlatformDownloads } from './platform-downloads.mjs';
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
let browserAccount = null, startup = 0, startupPromise = null, pageActive = true, identity = { status: 'loading', displayName: '', message: '로그인 상태를 확인하고 있어요.' };
let nativeIdentity = { status: 'loading' }, nativeIdentityVersion = 0;
const insightIdentity=()=>typeof window.synkDesktop?.authStatus==='function'?nativeIdentity:browserAccount?.identity()||identity;
const insightRequest=(operation,params)=>typeof window.synkDesktop?.authStatus==='function'?window.synkDesktop.accountRequest(operation,params):browserAccount.request(operation,params);
const memberActivity=createMemberActivity({getIdentity:insightIdentity,request:insightRequest,getFavorites:()=>library.read().favorites});
const memberUnderstanding=createMemberUnderstanding({getIdentity:insightIdentity,request:insightRequest});
const memberSettings=createMemberSettings({getIdentity:insightIdentity,request:insightRequest});
const memberInsight = createMemberInsight({
 getIdentity: insightIdentity,
 request: insightRequest,
 activity:memberActivity,
 understanding:memberUnderstanding,
 settings:memberSettings,
 onChange: () => { if (route().page === 'benefits' && route().id === 'insight') render(); },
});
bindMemberUnderstandingEditor(root,{controller:memberUnderstanding,getReport:()=>memberInsight.read().report,settings:memberSettings,getSettingsContext:()=>memberInsight.settingsContext(),onSettingsSaved:()=>void memberInsight.refresh({quiet:true})});
const labels = { home:'내 홈', benefits:'회원 혜택', discover:'둘러보기', library:'내 라이브러리', updates:'새소식', downloads:'다운로드', settings:'플랫폼 설정', help:'도움말', app:'앱 상세' };
const news = [
 {id:'world-settings',app:'world',label:'SYNK WORLD',date:'2026.10.19',title:'내 성향에서 고른 도움 방식을 WORLD도 따라요',body:'회원 혜택의 「내 성향」에서 도움 방식이나 설명 길이를 바꾸면, 같은 SYNK ID로 하는 WORLD 연습에도 그대로 쓰여요.'},
 {id:'benefits',app:'platform',label:'회원 혜택',date:'2026.10.18',title:'회원 혜택을 네 가지로 정리했어요',body:'회원 혜택은 이제 내 성향, AI 구독 계정판, 플레저, 무료 운세예요. 대화 리허설과 가족 이야기 앨범은 서비스를 마쳤어요.'},
 {id:'auto-update',app:'platform',label:'PC 앱',date:'2026.10.14',title:'Windows PC 앱이 스스로 업데이트해요',body:'Windows용 SYNK PC 앱은 새 판이 나오면 스스로 받아 설치하고 다시 켜져요. Mac은 새 판을 받아 두면 DMG를 열어 앱을 바꿔 주세요.'},{id:'workspace',app:'messenger',label:'SYNK Workspace',date:'2026.10.09',title:'사내 메신저가 SYNK Workspace가 됐어요',body:'대화와 자료, 작업실을 쓰던 사내 메신저의 이름을 SYNK Workspace로 바꿨어요. 교사는 같은 앱의 「내 수업」에서 맡은 반을 챙겨요.'}
];
function notice(text) { clearTimeout(timer);$('platform-message').textContent = text;$('platform-message').hidden = false;timer = setTimeout(() => $('platform-message').hidden = true, 6500); }
function dispatch(action) { if(action.type==='launch')void memberActivity.trackLaunch(action.id);if(continuity?.connected()&&['favorite','launch','remember','clear-recent'].includes(action.type)){void continuity.dispatch(action).catch(error=>notice(error.message));return true;}try { deviceLibrary.dispatch(action);if(action.type==='favorite')void memberActivity.syncFavorites();render();return true; } catch { render();notice('브라우저가 저장을 막아 이 기기에 담지 못했어요. 사이트 데이터 저장을 허용해 주세요.');return false; } }
async function openInsightActivity(id){
 if(!['world','messenger','path','pulse'].includes(id)||!accountEntryReady(id))return accountEntryUnavailable();
 const host=window.synkDesktop,owner=JSON.stringify(insightIdentity());
 if(host?.authStatus&&(id==='pulse'&&typeof host.openPulseApp==='function'||['world','messenger'].includes(id)&&clients.some(row=>row.id===id&&row.canLaunch))){
  try{const result=await(id==='pulse'?host.openPulseApp():host.launch(id));if(owner!==JSON.stringify(insightIdentity()))return;if(result?.ok)dispatch({type:'launch',id,mode:'client'});else notice('앱이 열리지 않았어요. 잠시 뒤 다시 눌러 주세요.');}catch{notice('앱을 열지 못했어요. 다시 시도해 주세요.');}return;
 }
 const href=id==='world'?platformPublicEntry('world'):id==='path'?PATH_INTERVIEW_URL:id==='pulse'?'https://workspace.synk.im/pulse-app/':messengerUrl;
 if(!href){location.hash=libraryItemRoute(id);notice('이 앱은 여기서 바로 열 수 없어요. 소개에 있는 여는 방법을 봐 주세요.');return;}
 // Open synchronously with the user's click, then preserve the existing account
 // handoff. A blocked popup is not recorded as an app opening.
 openActivityWindow(publicEntry(id,href),id);
}
function openActivityWindow(href,id){
 const popup=window.open('about:blank','_blank');if(!popup){notice('새 창이 차단됐어요. 브라우저에서 새 창을 허용한 뒤 다시 눌러 주세요.');return false;}
 try{popup.opener=null;popup.location.replace(href);}catch{popup.close();notice('앱을 열지 못했어요. 다시 눌러 주세요.');return false;}
 dispatch({type:'launch',id,mode:'web'});return true;
}
function route() { return platformRoute(location.hash); }
// Do not open an account-connected app without a verified Platform state.
// Native launches keep the main process's existing account handoff.
function accountEntryReady(id) {
 if (typeof window.synkDesktop?.authStatus === 'function') return true;
 return (!platformPublicEntry(id) && id !== 'messenger') || ['signed-in','signed-out'].includes(identity.status);
}
function accountEntryUnavailable() { notice('로그인 상태를 확인한 뒤에 열 수 있어요. 잠시 뒤 다시 눌러 주세요.'); }
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
function status(app) { if(app.webOnly)return '웹에서 연습';const state = clients.find(item => item.id === app.id);return state?.canLaunch ? '설치됨' : environment ? '설치 안 됨' : '웹 · PC 앱'; }
function heading(eyebrow, title, description='') { return `<div class="page-heading"><p class="sb-eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p>${description}</p>`:''}</div>`; }
function card(app) { const state = library.read(), benefit = app.kind === 'benefit', href = libraryItemRoute(app.id);return `<article class="app-card ${benefit?'benefit-':''}${app.id}" data-application="${app.id}"><a class="app-art" href="${href}" aria-label="${app.name} 상세 보기">${image(app.image)}<span>${benefit?'SYNK FOR YOU':app.id==='world'?'KOREAN LEARNING':app.id==='path'?'INTERVIEW PRACTICE':'TEAM WORKSPACE'}</span></a><div class="app-info"><div class="app-meta"><span>${benefit?'회원 혜택':app.id==='world'?'한국어 학습':app.id==='path'?'면접 연습':'업무 · 대화'}</span><span>${benefit?app.statusLabel:status(app)}</span></div><a class="app-title" href="${href}"><h3>${app.name}</h3></a><p>${app.subtitle}</p><div class="app-bottom"><a href="${href}" class="detail-link">${benefit?'혜택 소개':'앱 소개'} →</a>${button(state.favorites.includes(app.id)?'★':'☆','favorite',app.id,'icon-btn',`aria-label="${app.name} 즐겨찾기" aria-pressed="${state.favorites.includes(app.id)}"`)}</div></div></article>`; }
function filters(isLibrary=false) { return `<div class="filter-bar"><div class="filter-buttons" role="group" aria-label="앱 분류">${[['all','전체'],['learn','학습'],['work','업무'],...(isLibrary?[['life','회원 혜택']]:[])].map(([id,text])=>button(text,'filter',id,`filter-chip ${category===id?'selected':''}`,`aria-pressed="${category===id}"`)).join('')}</div><label class="sort-label">정렬 <select id="sort"><option value="default" ${sort==='default'?'selected':''}>기본순</option><option value="name" ${sort==='name'?'selected':''}>이름순</option><option value="recent" ${sort==='recent'?'selected':''}>최근 연 순</option></select></label></div>${isLibrary?`<div class="collections" role="group" aria-label="라이브러리 컬렉션">${[['all','전체 바로가기'],['favorites','즐겨찾기'],['learn','학습 컬렉션'],['work','업무 컬렉션']].map(([id,text])=>button(text,'collection-filter',id,`filter-chip ${collection===id?'selected':''}`,`aria-pressed="${collection===id}"`)).join('')}</div>`:''}`; }
function shelf(isLibrary=false) { const apps = filterApplications({query,category,collection:isLibrary?collection:'all',library:library.read(),onlySaved:isLibrary,sort});return `${filters(isLibrary)}<p class="result-count">${query?`‘${esc(query)}’ 검색 · `:''}${isLibrary?'바로가기':'앱'} ${apps.length}개</p>${apps.length?`<div class="app-grid">${apps.map(card).join('')}</div>`:`<div class="empty-state">${image('sticker-search.webp')}<h2>${isLibrary&&!library.read().saved.length?'아직 담은 앱이 없어요.':'조건에 맞는 앱이 없어요.'}</h2><p>${isLibrary&&!library.read().saved.length?'앱이나 회원 혜택 소개에서 「라이브러리에 담기」를 누르면 여기에 모여요.':'검색어를 바꾸거나 분류를 「전체」로 돌려 보세요.'}</p>${isLibrary&&!library.read().saved.length?'<a class="sb-btn soft" href="#discover">앱 둘러보기 →</a>':button('검색·필터 지우기','clear-search')}</div>`}`; }
function newsCards(items=news) { return items.length?`<div class="news-grid">${items.map(item=>`<button class="news-card" data-action="news" data-id="${item.id}"><span class="sb-eyebrow">${item.label}</span><h3>${item.title}</h3><span class="small">${item.date} <span aria-hidden="true">↗</span></span></button>`).join('')}</div>`:'<p class="small">이 앱의 새소식은 아직 없어요.</p>'; }
function accountPanel() {
 if (typeof window.synkDesktop?.authStatus === 'function' || !['signed-in','error'].includes(identity.status)) return '';
 const title = identity.status==='signed-in' ? (identity.displayName ? `${identity.displayName}님으로 로그인했어요` : 'SYNK ID로 로그인했어요') : '로그인 상태를 못 불러왔어요';
 return `<section class="content-panel account-panel" aria-label="SYNK ID 로그인 상태" aria-busy="${identity.status==='loading'}"><div><p class="sb-eyebrow">SYNK ID</p><h2>${esc(title)}</h2><p role="status">${esc(identity.message)}</p></div><div class="actions">${identity.status==='signed-in'?'<a class="sb-btn soft" href="./client.html?product=platform">내 계정 관리 →</a>':button('다시 시도','retry-account')}</div></section>`;
}
function showBrowserAccount(state) {
 identity = state;
 const entry = document.querySelector('.account-entry');
 let label = entry.querySelector('[data-account-label]');
 if(!label){label=document.createElement('span');label.dataset.accountLabel='';entry.replaceChildren(...[entry.querySelector('img, .avatar'),label].filter(Boolean));}
 label.textContent = state.status==='signed-in' ? (state.displayName || '내 SYNK ID') : state.status==='loading'?'확인 중':state.status==='error'?'SYNK ID 확인':'SYNK ID 로그인';
 entry.setAttribute('aria-label',state.status==='signed-in'?'SYNK ID 계정 관리':'SYNK ID로 로그인');render();continuity?.render?.();
}
function quickCard(id, recent) {
 const entryId=id==='messenger'&&recent?.entryId==='teacher'?'teacher':id,item=itemById(id), destination=shortcutDestination(entryId,{base:location.href,clients,learningUrl:config.learningUrl,messengerUrl,preferredMode:recent?.mode});
 if(!item||!destination)return '';
 const error=launches.get(id)==='error';
 const action=destination.kind==='client'?button(destination.label,'launch',entryId,'sb-btn'):`<a href="${esc(destination.href)}" ${destination.kind==='web'?`data-web="${entryId}" target="_blank" rel="noopener noreferrer"`:''} class="sb-btn">${destination.label}</a>`;
 const detail=libraryItemRoute(id), meta=recent?`${recent.mode==='web'?'웹':'PC 앱'}에서 열었어요 · ${new Date(recent.at).toLocaleDateString('ko-KR')}`:item.kind==='benefit'?item.statusLabel:library.read().favorites.includes(id)?'즐겨찾는 앱':item.id==='path'?'면접 연습 · 60~90초':item.category==='learn'?'한국어 게임과 TOPIK 연습':'회사 초대·교사 등록 필요';
 return `<article class="quick-card" data-shortcut="${id}"><div class="quick-title">${image(item.image)}<div><h3>${esc(item.name)}</h3><p>${esc(meta)}</p></div></div><div class="quick-actions">${action}<a href="${detail}" class="plain">소개 보기</a></div>${error?'<p class="launch-feedback" role="status">앱을 열지 못했어요. 다시 누르거나 <a href="#downloads">다운로드 화면</a>에서 설치 상태를 봐 주세요.</p>':''}</article>`;
}
function recentSection() {
 const recents=library.read().recent;
 return recents.length?`<section class="home-section"><div class="section-heading"><div><p class="sb-eyebrow">RECENT</p><h2>최근에 연 앱</h2></div>${button('기록 지우기','clear-recent','','plain')}</div><p class="home-section-note">${continuity?.connected()?'계정에 저장한 최근 기록이에요.':'이 기기에서 연 기록이에요.'} 앱 안에서 어디까지 했는지는 각 앱에 남아요.</p><div class="quick-grid">${recents.map(item=>quickCard(item.id,item)).join('')}</div></section>`:'';
}
function homePage() {
 const state=library.read(), hasShortcuts=state.recent.length||state.favorites.length;
 return `<section class="home-welcome"><p class="sb-eyebrow">HOME</p><h1>SYNK 앱과 회원 혜택</h1><p>${hasShortcuts?'즐겨찾기와 최근에 연 앱을 아래에서 바로 열어요.':'설치 없이 열 수 있는 것부터 아래에 모았어요. 자주 쓰는 앱은 소개 화면에서 즐겨찾기에 담아요.'}</p><div class="actions"><a href="#discover" class="sb-btn soft">${hasShortcuts?'다른 앱 둘러보기':'전체 둘러보기'} →</a><a href="#library" class="plain">내 라이브러리</a></div></section>`+accountPanel()+recentSection()
 + (state.favorites.length?`<section class="home-section"><div class="section-heading"><div><p class="sb-eyebrow">FAVORITES</p><h2>즐겨찾기</h2></div><a href="#library">라이브러리 관리 →</a></div><div class="quick-grid">${state.favorites.map(id=>quickCard(id)).join('')}</div></section>`:'')
 + (!hasShortcuts?`<section class="home-section"><div class="section-heading"><div><p class="sb-eyebrow">ON THE WEB</p><h2>설치 없이 바로 열 수 있어요</h2></div><a href="#benefits">회원 혜택 보기 →</a></div><div class="quick-grid">${['world','path','care'].map(id=>quickCard(id)).join('')}</div></section>`:'')
 + '<p class="home-device-note">'+(continuity?.connected()?'즐겨찾기와 최근 기록은 계정에, 담은 목록과 컬렉션은 이 기기에 저장해요.':'즐겨찾기와 최근 기록은 이 기기에만 저장해요.')+' <a href="#settings">저장 설정</a></p>';
}
function discover() {
 const recents = library.read().recent;
 return (!query?accountPanel():'')+(query ? heading('SEARCH','검색 결과','앱과 회원 혜택에서 함께 찾았어요.') : heading('DISCOVER','둘러보기','지금 쓸 수 있는 SYNK 앱과 회원 혜택이에요.'))
 + '<section><div class="section-heading"><div><p class="sb-eyebrow">APPS</p><h2>SYNK 앱</h2></div><a href="#library">내 라이브러리 →</a></div>'+shelf()+'</section>'
 + (recents.length&&!query ? recentSection():'')
 + '<section class="benefit-home-collection"><div class="section-heading"><div><p class="sb-eyebrow">SYNK FOR YOU</p><h2>'+(query?'찾은 회원 혜택':'네 가지 회원 혜택')+'</h2></div><a href="#benefits">회원 혜택 모두 보기 →</a></div>'+benefitCards(query)+'</section>'
 + (!query?'<section class="news-section"><div class="section-heading"><h2>새소식</h2><a href="#updates">새소식 모두 보기 →</a></div>'+newsCards(news.slice(0,3))+'</section>':'');
}
function libraryPage() { return heading('LIBRARY','내 라이브러리',continuity?.connected()?'즐겨찾기와 최근 기록은 계정에, 담은 목록과 컬렉션은 이 기기에 저장해요.':'앱과 회원 혜택을 이 기기에 담아 둬요. 위에서 계정 라이브러리를 켜면 즐겨찾기와 최근 기록을 다른 기기에서도 봐요.')+shelf(true); }
function pathAppPage(app) {
 const requirements=detailTab==='requirements';
 return `<a class="back-link" href="#discover">← 모든 앱</a><section class="detail-hero path"><div><p class="sb-eyebrow">SYNK · INTERVIEW PRACTICE</p><h1>${app.name}</h1><h2>${app.subtitle}</h2><p>${app.description}</p><div class="tags">${app.tags.map(tag=>`<span>${tag}</span>`).join('')}</div></div>${image(app.image)}</section><div class="launch-bar"><div><strong>웹에서 연습</strong><p>설치하거나 로그인하지 않아도 돼요</p></div><div class="actions">${launchControls(app)}</div></div><div class="detail-tabs" role="group" aria-label="앱 상세 항목">${[['overview','소개'],['requirements','이용 안내']].map(([id,title])=>button(title,'detail-tab',id,`filter-chip ${detailTab===id?'selected':''}`,`aria-pressed="${detailTab===id}"`)).join('')}</div>
 ${requirements?`<section class="content-panel"><h2>준비할 것</h2><dl class="specs"><dt>PC</dt><dd>글로 답하거나, 한국어 음성을 켜고 마이크로 답해요.</dd><dt>Quest</dt><dd>Quest 브라우저에서 같은 주소를 열고, 한국어 음성 준비 → 마이크 확인 → VR 입장 순서로 진행해요.</dd><dt>첫 음성 준비</dt><dd>약 103MB의 한국어 음성 모델을 내려받아요. 준비 시간은 면접 시간에 포함되지 않아요.</dd><dt>둘러보기</dt><dd>PC는 마우스로 끌어 30도 안에서 둘러보고, VR은 고개 움직임을 따라가요.</dd><dt>기록</dt><dd>목소리와 답변은 이 기기 안에서만 처리하고, 서버나 계정에 저장하지 않아요.</dd></dl><p>VR에서 어지럽거나 불편하면 바로 멈추고 쉬어 주세요.</p></section>`:`<div class="detail-columns"><section class="content-panel"><h2>면접실에서 하는 것</h2><p>${app.available}</p><ul class="feature-list"><li><strong>면접관 세 명</strong><span>서류를 넘기고 받아 적는 면접관들 앞에서 답해요.</span></li><li><strong>내 답에 맞춘 다음 질문</strong><span>경험을 말했는지, 준비한 것을 말했는지에 따라 다음 질문이 달라져요.</span></li><li><strong>한 번에 60~90초</strong><span>질문 → 첫 답 → 다음 질문 → 두 번째 답. 짧게 답하면 더 빨리 끝나요.</span></li></ul></section><aside class="content-panel app-side"><h3>알아 둘 것</h3><p>앉아서 하는 연습용 면접실이에요. 실제 채용 평가가 아니고, 질문은 미리 정해 둔 것 중에서 골라 나와요.</p><p>VR에서는 앉은 자리에서 둘러보는 방식이라 걸어 다닐 수는 없어요.</p><p class="small">면접 답변은 저장하지 않아요. 즐겨찾기와 최근 기록에도 답변은 남지 않아요.</p></aside></div>`}`;
}
function launchControls(app) { const client = !app.webOnly&&clients.find(item=>item.id===app.id), web = app.id==='path'?PATH_INTERVIEW_URL:app.id==='world'?platformPublicEntry('world'):messengerUrl;return `${client?.canLaunch?button('앱 열기 ↗','launch',app.id,'sb-btn'):web?`<a href="${esc(web)}" data-web="${app.id}" target="_blank" rel="noopener noreferrer" class="sb-btn">${app.id==='path'?'면접 연습 열기':app.id==='world'?'웹 WORLD 열기':'Workspace 웹 열기'} ↗</a>`:`<a href="#downloads" class="sb-btn">PC 앱 받기 →</a>`}${button(library.read().saved.includes(app.id)?'라이브러리에서 빼기':'라이브러리에 담기','save',app.id)}${button(library.read().favorites.includes(app.id)?'★ 즐겨찾기':'☆ 즐겨찾기','favorite',app.id,'sb-btn soft',`aria-pressed="${library.read().favorites.includes(app.id)}"`)}`; }
function appPage(id) { const app=appById(id);if(app?.id==='path')return pathAppPage(app);if(!app) return heading('NOT FOUND','앱을 찾을 수 없어요.')+'<a href="#discover">둘러보기로 돌아가기</a>';const state=library.read();return `<a class="back-link" href="#discover">← 모든 앱</a><section class="detail-hero ${app.id}"><div><p class="sb-eyebrow">SYNK · ${app.category==='learn'?'KOREAN LEARNING':'TEAM WORKSPACE'}</p><h1>${app.name}</h1><h2>${app.subtitle}</h2><p>${app.description}</p><div class="tags">${app.tags.map(tag=>`<span>${tag}</span>`).join('')}</div></div>${image(app.image)}</section><div class="launch-bar"><div><strong>${status(app)}</strong><p>${app.id==='world'?'웹에서 바로 하거나 PC 앱에 설치해 써요':'회사 초대를 받은 계정이나 반을 맡은 교사 계정으로 써요'}</p></div><div class="actions">${launchControls(app)}</div></div><div class="detail-tabs" role="group" aria-label="앱 상세 항목">${[['overview','소개'],['requirements','설치 안내'],['news','앱 소식']].map(([id,title])=>button(title,'detail-tab',id,`filter-chip ${detailTab===id?'selected':''}`,`aria-pressed="${detailTab===id}"`)).join('')}</div>
${detailTab==='news'?newsCards(news.filter(item=>item.app===app.id)):detailTab==='requirements'?`<section class="content-panel"><h2>설치와 로그인</h2><dl class="specs"><dt>설치</dt><dd>SYNK PC 앱 안에서 골라 설치해요.</dd><dt>PC</dt><dd>Windows 10·11 64비트, macOS 13 이상</dd><dt>웹</dt><dd>${app.id==='world'?'웹 WORLD는 설치 없이 열려요.':'회사에서 안내받은 Workspace 주소로 열어요. 교사는 같은 주소의 「내 수업」으로 들어가요.'}</dd><dt>로그인</dt><dd>${app.id==='world'?'SYNK ID로 로그인해요. 「학습 기록 연결」은 계정 화면에서 켜고 꺼요.':'회사 일은 회사 초대를 받은 계정으로, 내 수업은 반을 맡은 교사로 등록된 SYNK ID로 로그인해요. 가입만 한 SYNK ID로는 들어갈 수 없어요.'}</dd></dl><a href="#downloads">PC 앱 받기 →</a></section>`:`<div class="detail-columns"><section class="content-panel"><h2>${app.id==='world'?'WORLD에서 할 수 있는 것':'Workspace에서 할 수 있는 것'}</h2><p>${app.available}</p>${app.id==='world'?`<ul class="feature-list"><li><strong>TOPIK 준비</strong><span>TOPIK I 짧은 진단으로 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.</span></li><li><strong>미니게임</strong><span>바람길·말의 리듬·한글 만나기 같은 게임을 웹에서 바로 해요.</span></li><li><strong>SYNK TOWN</strong><span>마을 생활 속에서 배운 말을 써 봐요.</span></li><li><strong>과제와 학습 기록</strong><span>받은 과제를 하고, 연습 기록을 계정에 저장해 다른 기기에서 이어 가요.</span></li></ul>`:`<ul class="feature-list"><li><strong>팀 대화</strong><span>채널과 1:1 대화에서 이야기하고, 검색으로 지난 대화를 찾아요.</span></li><li><strong>자료 공유</strong><span>회사 자료를 올려 두고 함께 찾아 써요.</span></li><li><strong>내 수업</strong><span>교사는 맡은 반의 학생과 과제를 여기서 챙겨요.</span></li></ul>`}<div class="web-preview"><strong>${app.id==='world'?'웹에서 먼저 해 봐도 돼요.':messengerUrl?'웹에서도 열 수 있어요.':'웹은 회사 주소로 들어가요.'}</strong><p>${app.id==='world'?'웹은 설치 없이 열려요.':messengerUrl?'회사에서 초대받은 계정으로 로그인해요.':'회사에서 안내받은 Workspace 주소로 들어가 로그인해 주세요.'}</p>${app.id==='world'||messengerUrl?`<a class="sb-btn soft" href="${esc(app.id==='world'?platformPublicEntry('world'):messengerUrl)}" data-web="${app.id}" target="_blank" rel="noopener noreferrer">${app.id==='world'?'웹 WORLD 열기':'Workspace 웹 열기'} ↗</a>`:''}</div></section><aside class="content-panel app-side"><h3>컬렉션에 넣기</h3><p class="small">이 기기에만 저장해요.</p>${[['learn','학습'],['work','업무']].map(([id,label])=>`<label class="toggle"><input type="checkbox" data-collection="${id}" data-id="${app.id}" ${state.collections[id].includes(app.id)?'checked':''}>${label} 컬렉션</label>`).join('')}<hr><h3>누가 쓰나요</h3><p>${app.audience}</p><p class="small">라이브러리에 담아도 이용 권한이 생기지는 않아요. ${app.id==='messenger'?'교사 권한과 회사 직원 권한은 따로 받아요.':'게임 점수는 TOPIK 급수나 합격과 관계없어요.'}</p><a href="./client.html?product=platform">SYNK ID 관리 ↗</a></aside></div>`}`; }
function downloads() {
 const os=downloadOS,d=PLATFORM_DOWNLOADS[os],mac=os!=='windows',feed=downloadsState(),ready=feed==='ready',started=ready&&downloadStarted===os;
 const tabs=`<div class="filter-buttons os-tabs" role="group" aria-label="운영체제">${DOWNLOAD_OS.map(id=>button(esc(PLATFORM_DOWNLOADS[id].tab)+(detectedOS===id?'<span class="dl-here">이 기기</span>':''),'os',id,`filter-chip ${os===id?'selected':''}`,`aria-pressed="${os===id}"`)).join('')}</div>${mac?'<p class="dl-hint">칩을 모르면 왼쪽 위 Apple 메뉴 → 「이 Mac에 관하여」에서 볼 수 있어요.</p>':''}`;
 const hero=`<section class="detail-hero dl-hero" aria-label="SYNK PC 앱 ${esc(d.tab)} 다운로드">${image('brand-synk-paper.webp')}<span class="dl-sticker">${esc(d.sticker)}</span><div><p class="sb-eyebrow">SYNK · PLATFORM${ready?` · PREVIEW ${PLATFORM_DOWNLOADS.version}`:''}</p><h1>SYNK PC 앱</h1><h2>${esc(d.label)}${mac?` · ${esc(d.chip)}`:''}</h2><p>SYNK 앱과 회원 혜택을 여는 PC 앱이에요.</p></div></section>`;
 const readouts=`<dl class="dl-readouts">${ready?`<div><dt>파일</dt><dd>${esc(d.file)}</dd></div><div><dt>크기</dt><dd>${downloadSize(d.bytes)}</dd></div>`:''}<div><dt>필요</dt><dd>${esc(d.need)}</dd></div><div><dt>서명</dt><dd>${esc(d.sign)}</dd></div></dl>`;
 const actions=ready?`<div class="dl-actions"><a class="sb-btn dl-get" href="${downloadHref(os)}" data-action="download-start" data-id="${os}">${esc(d.label)} <span aria-hidden="true">↓</span></a><a class="sb-btn soft" href="${checksumHref(os)}" target="_blank" rel="noopener">파일 확인값(SHA-256) ↗</a></div>`:`<div class="dl-actions"><a class="sb-btn dl-get" href="${RELEASE_PAGE}" target="_blank" rel="noopener">synk.im에서 받기 ↗</a></div><p class="small dl-feed-note" role="status">${feed==='loading'?'지금 공개된 판을 확인하고 있어요.':'공개된 판 정보를 불러오지 못했어요. synk.im에서 지금 판을 받아 주세요.'}</p>`;
 const next=started?`<div class="dl-next" role="status"><p class="dl-started">다운로드를 시작했어요</p><p class="small">파일을 다 받으면 아래 순서대로 열어 주세요.</p><ol class="dl-steps">${DOWNLOAD_STEPS[mac?'mac':'windows'].map(([title,body])=>`<li><strong>${esc(title)}</strong><p>${esc(body)}</p></li>`).join('')}</ol><p class="small dl-retry">다운로드가 시작되지 않았나요? <a href="${downloadHref(os)}">다시 받기</a></p></div>`:'';
 const apps=APPLICATIONS.filter(app=>!app.webOnly).map(app=>{const client=clients.find(item=>item.id===app.id);return `<article class="download-row">${image(app.image)}<div><h2>${app.name}</h2><p>${app.subtitle}</p><span class="small">${client?.status==='current'?'실행 중':client?.canLaunch?'설치됨':environment?'설치 안 됨':app.id==='world'?'웹에서도 열려요':'회사 초대·교사 등록 필요'}</span></div><div class="download-action">${client?.canLaunch?button('앱 열기','launch',app.id):''}${button('설치 안내','install-info',app.id,'plain')}</div></article>`;}).join('');
 return heading('DOWNLOADS','PC 앱 받기','SYNK PC 앱을 먼저 설치하고, WORLD와 Workspace는 그 안에서 골라 설치해요.')+tabs+hero+`<div class="dl-panel">${readouts}${actions}${next}</div><h2 class="dl-sub">PC 앱 안에서 설치하는 앱</h2><div class="download-list">${apps}</div><section class="content-panel"><h2>업데이트</h2><p>Windows 앱은 새 판이 나오면 스스로 받아 설치하고 다시 켜져요. Mac 앱은 새 판을 받아 두면 DMG를 열어 응용 프로그램 폴더의 앱을 바꿔 주세요. 계정과 앱 데이터는 그대로 남아요.</p>${window.synkDesktop?button('설치 상태 다시 확인','refresh-clients'):''}</section>`;
}
function settings() { const state=library.read();return heading('SETTINGS','플랫폼 설정','계정 라이브러리를 켜면 즐겨찾기와 최근 기록은 계정에 저장해요. 화면 설정과 컬렉션은 이 기기에 남아요.')+`<section class="content-panel"><h2>라이브러리</h2><label class="setting-row"><span><strong>최근 기록 남기기</strong><small>어떤 앱을 언제 열었는지만 남겨요. 끄면 지금 목록도 지워요.</small></span><input type="checkbox" data-setting="remember" ${state.rememberRecent?'checked':''}></label><label class="setting-row"><span><strong>카드 작게 보기</strong><small>라이브러리의 그림을 작게 보여 줘요.</small></span><input type="checkbox" data-setting="compact" ${state.compact?'checked':''}></label></section><section class="content-panel"><h2>이 기기에 저장한 것</h2><p>이 기기의 바로가기, 컬렉션, 화면 설정이에요. 계정에 저장한 즐겨찾기와 최근 기록, 메모는 맨 위 계정 라이브러리에서 지울 수 있어요.</p><div class="actions">${button('설정 파일로 받기','export')}${button('이 기기 설정 지우기','reset-confirm','','plain danger')}</div></section><section class="content-panel"><h2>SYNK ID와 앱 기록</h2><p>회사 대화와 자료, WORLD 학습 기록은 앱마다 따로 저장하고 서로 섞지 않아요.</p><a href="./client.html?product=platform">SYNK ID 관리 ↗</a></section>`; }
function help() { return heading('HELP','SYNK를 시작하는 방법')+`<section class="content-panel"><h2>1. SYNK PC 앱을 설치해요.</h2><p>Windows와 Mac에서 써요. 다운로드 화면에서 내 기기에 맞는 파일을 받아 설치해요. 웹에서만 쓸 거라면 설치하지 않아도 돼요.</p><h2>2. WORLD와 Workspace는 PC 앱 안에서 설치해요.</h2><p>PC 앱을 깔아도 두 앱이 저절로 깔리지는 않아요. PC 앱에서 앱을 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요.</p><h2>3. SYNK ID 하나로 로그인해요.</h2><p>앱마다 같은 SYNK ID로 로그인해요. 「학습 기록 연결」은 계정 화면에서 켜고 꺼요. Workspace는 회사 초대를 받은 계정만 들어갈 수 있어요.</p><h2>라이브러리에 담으면 쓸 수 있게 되나요?</h2><p>아니요. 라이브러리는 바로가기를 모아 두는 곳이에요. 설치나 이용 권한은 그대로예요.</p><h2>지금 웹에서 쓸 수 있는 것은요?</h2><p>WORLD 미니게임, PATH 면접 연습, 플레저와 무료 운세는 웹에서 바로 열려요. 내 성향은 로그인하면 보이고, AI 구독 계정판은 PC 앱에서 써요.</p><a href="#downloads" class="sb-btn soft">PC 앱 받기</a></section>`; }
function render() { const restoreInsightFocus=captureMemberUnderstandingFocus(root);memberActivity.read();memberInsight.setVisible(pageActive&&!document.hidden&&route().page==='benefits'&&route().id==='insight');const active = root.contains(document.activeElement) ? document.activeElement : null;const focus = active ? ['id','data-action','data-insight-action','data-insight-target','data-id','data-collection','data-setting','href','data-web'].map(key=>[key,active.getAttribute(key)]).filter(([,value])=>value!==null) : [];const {page,id}=route(), state=library.read();$('page-label').textContent=labels[page];$('library-count').textContent=state.saved.length;document.body.classList.toggle('compact-cards',state.compact);document.querySelectorAll('[data-route]').forEach(node=>{ if(node.dataset.route===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current'); });root.innerHTML=page==='home'?homePage():page==='benefits'?(id?benefitDetail(id,location.href,{library:state,insight:memberInsight.read()}):benefitsPage()):page==='discover'?discover():page==='library'?libraryPage():page==='app'?appPage(id):page==='downloads'?downloads():page==='settings'?settings():page==='updates'?heading('WHAT’S NEW','새소식','앱과 회원 혜택에서 바뀐 점을 날짜와 함께 적어 둬요.')+newsCards():help();for(const link of root.querySelectorAll('[data-web]'))updateWebLink(link);if(focus.length){const next=[...root.querySelectorAll('a,button,input,select')].find(node=>focus.every(([key,value])=>node.getAttribute(key)===value));next?.focus({preventScroll:true});}restoreInsightFocus(); }
function modal(title,body,extra='') { $('dialog-content').innerHTML=`<h2>${title}</h2><p>${body}</p>${extra}`;$('platform-dialog').showModal(); }
async function refreshClients() { if(!window.synkDesktop)return;const bounded=p=>{let t;return Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(new Error('timeout')),5000))]).finally(()=>clearTimeout(t));};try { const [env,list]=await bounded(Promise.all([window.synkDesktop.getEnvironment(),window.synkDesktop.getClients()]));environment=env;clients=Array.isArray(list)?list.filter(v=>['platform','world','messenger'].includes(v.id)):[];$('environment-label').textContent=`${env.platform==='darwin'?'macOS':'Windows'} · ${env.mode==='development'?'시험판':'PC 앱'}`;render(); } catch { clients=[];notice('설치 상태를 못 읽었어요. 잠시 뒤 「설치 상태 다시 확인」을 눌러 주세요.');render(); } }
root.addEventListener('click',async event=>{
 const insightAction = event.target.closest('[data-insight-action]')?.dataset.insightAction;
 if(['enable-activity','disable-activity'].includes(insightAction)){await memberActivity.setConsent(insightAction==='enable-activity');return;}
 if(insightAction==='activity'){await openInsightActivity(event.target.closest('[data-insight-target]')?.dataset.insightTarget);return;}
 if(insightAction === 'account'){location.assign('./client.html?product=platform');return;}
 if(insightAction === 'refresh') {
  if(typeof window.synkDesktop?.authStatus === 'function') await refreshNativeInsight();
  else await refreshBrowserAccount();
  await memberInsight.refresh();render();return;
 }
 const link=event.target.closest('[data-web]');if(link) { event.preventDefault();if(!updateWebLink(link)){accountEntryUnavailable();return;}openActivityWindow(link.href,link.dataset.web);return; }
 const control=event.target.closest('[data-action]');if(!control)return;const {action,id}=control.dataset;
 if(action==='scroll-benefits')document.getElementById('benefit-collection')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  else if(action==='retry-account')await refreshBrowserAccount();
 else if(['save','favorite'].includes(action)){const before=library.read(),had=(action==='save'?before.saved:before.favorites).includes(id);if(dispatch({type:action,id}))notice(action==='save'?(had?'라이브러리에서 뺐어요.':'라이브러리에 담았어요.'):(had?'즐겨찾기에서 뺐어요.':'즐겨찾기에 넣었어요.'));}
 else if(action==='filter'){category=id;render();}
 else if(action==='collection-filter'){collection=id;render();}
 else if(action==='clear-search'){query='';category='all';collection='all';$('platform-search').value='';location.hash=searchRoute(route().page,'');render();}
 else if(action==='detail-tab'){detailTab=id;render();}
 else if(action==='os'){downloadOS=id;downloadPicked=true;downloadStarted=null;render();}
 else if(action==='download-start'){downloadStarted=id;setTimeout(render,0);}
 else if(action==='clear-recent')dispatch({type:action});
 else if(action==='news'){const item=news.find(v=>v.id===id);if(item)modal(item.title,item.body,'<p class="small">'+item.date+'</p>');}
 else if(action==='install-info')modal('WORLD·Workspace 설치','두 앱의 설치 파일은 SYNK PC 앱 안에 들어 있어요. PC 앱에서 앱을 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요. 다 깔리면 「설치 상태 확인」을 눌러 바로 열어요.');
 else if(action==='refresh-clients'){if(!window.synkDesktop)notice('설치 상태는 PC 앱에서만 볼 수 있어요.');else await refreshClients();}
  else if(action==='launch'){if(launches.get(id)==='loading')return;const launchRoute=location.hash,owner=JSON.stringify(insightIdentity()),current=()=>owner===JSON.stringify(insightIdentity());launches.set(id,'loading');control.disabled=true;render();try{if(!window.synkDesktop)throw new Error();const result=await window.synkDesktop.launch(id);if(!current())return;if(!result?.ok)throw new Error();launches.delete(id);const saved=dispatch({type:'launch',id,mode:'client'});notice(saved?'앱을 여는 중이에요.':'앱은 열었지만 최근 기록은 저장하지 못했어요.');}catch{if(current()){launches.set(id,'error');notice('앱을 열지 못했어요. 다운로드 화면에서 설치 상태를 봐 주세요.');}}finally{if(!current())launches.delete(id);render();if(current()&&location.hash===launchRoute)root.querySelector(`[data-action="launch"][data-id="${id}"]`)?.focus({preventScroll:true});}}
 else if(action==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(library.read(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='synk-platform-device-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 else if(action==='reset-confirm')modal('이 기기의 설정을 지울까요?','이 기기의 라이브러리, 즐겨찾기, 컬렉션, 최근 기록, 화면 설정을 지워요. 계정과 학습 기록, 설치한 앱은 그대로 남아요.',button('지우기','reset','','sb-btn'));
});
$('dialog-content').addEventListener('click',event=>{if(event.target.closest('[data-action="reset"]')){const saved=dispatch({type:'reset'});$('platform-dialog').close();if(saved)notice('이 기기 설정을 지웠어요.');}});
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
continuity=mountPlatformLibrary(continuityRoot,{getHost:()=>browserAccount,ensureReady:()=>refreshBrowserAccount(),onChange:()=>render(),onFavoritesChanged:()=>memberActivity.syncFavorites(),getDevice:()=>deviceLibrary.read(),onLogin:()=>location.assign('./client.html?product=platform'),onManage:()=>location.assign('./client.html?product=platform'),onOpen:id=>{const destination=shortcutDestination(id,{base:location.href,clients,learningUrl:config.learningUrl,messengerUrl});if(destination?.kind==='web'){if(!accountEntryReady(id)){accountEntryUnavailable();return;}openActivityWindow(publicEntry(id,destination.href),id);}else location.hash=libraryItemRoute(id);}});
render();
async function loadStartup(){
 const attempt=++startup, browser=typeof window.synkDesktop?.authStatus!=='function';let failed=false;
 browserAccount?.stop();browserAccount=null;if(browser)showBrowserAccount({status:'loading',displayName:'',message:'로그인 상태를 확인하고 있어요.'});
 const abort=new AbortController(), timeout=setTimeout(()=>abort.abort(),8000);
 try{const response=await fetch('./config.json',{cache:'no-store',credentials:'omit',signal:abort.signal});let next;if(response.ok)next=readConfig(await response.json(),location.href);else if(response.status===404)next=readConfig({version:1},location.href);else throw new Error();if(attempt!==startup)return;config=next;messengerUrl=messengerDestination(config.messengerUrl,location.href);}
 catch{if(attempt!==startup)return;failed=true;messengerUrl=null;notice('연결이 불안정해 로그인 설정을 못 불러왔어요. 잠시 뒤 다시 시도해 주세요.');}
 finally{clearTimeout(timeout);}
 if(attempt!==startup)return;render();await refreshClients();if(!browser||attempt!==startup)return;
 if(failed){showBrowserAccount({status:'error',displayName:'',message:'로그인 설정을 못 불러왔어요. 로그인은 그대로이니 「다시 시도」를 눌러 주세요.'});return;}
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
window.addEventListener('pagehide',()=>{pageActive=false;memberInsight.setVisible(false);browserAccount?.invalidate();render();});
async function refreshNativeInsight(){
 const expected=++nativeIdentityVersion;
 memberInsight.invalidate();nativeIdentity={status:'loading'};render();
 try{const next=await window.synkDesktop.authStatus();if(expected!==nativeIdentityVersion||!pageActive||document.hidden)return;nativeIdentity=next;}
 catch{if(expected!==nativeIdentityVersion)return;nativeIdentity={status:'error'};}
 render();
}
window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted){if(typeof window.synkDesktop?.authStatus==='function')void refreshNativeInsight();else void refreshBrowserAccount();}});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){nativeIdentityVersion++;memberInsight.setVisible(false);browserAccount?.invalidate();render();}
 else if(typeof window.synkDesktop?.authStatus==='function')void refreshNativeInsight();
 else void refreshBrowserAccount();
});
window.addEventListener('online',()=>{void refreshBrowserAccount();});

// Account identity is display-only here. Each application authenticates independently.
if (typeof window.synkDesktop?.authStatus === 'function') {
  const entry = document.querySelector('.account-entry');
  const label = document.createElement('span');label.textContent = 'SYNK ID';
  entry.replaceChildren(...[entry.querySelector('img, .avatar'), label].filter(Boolean));
  const show = state => {
    nativeIdentityVersion++;nativeIdentity=state;render();
    label.textContent = state.signedIn ? (state.account?.display_name || '내 SYNK ID') : 'SYNK ID 로그인';
    entry.setAttribute('aria-label', state.signedIn ? 'SYNK ID 계정 관리' : 'SYNK ID로 로그인');
  };
  const stop = window.synkDesktop.onAuthChanged(show);
  const initialVersion=nativeIdentityVersion;
  void window.synkDesktop.authStatus().then(state=>{if(initialVersion===nativeIdentityVersion&&pageActive&&!document.hidden)show(state);}).catch(() => { if(initialVersion===nativeIdentityVersion)label.textContent = 'SYNK ID 확인'; });
  window.addEventListener('pagehide', event=>{if(!event.persisted)stop();});
}
void detectDownloadOS().then(os=>{detectedOS=os;if(!os||downloadPicked)return;downloadOS=os==='mac'?'mac-arm64':os;if(route().page==='downloads')render();});
void refreshPlatformDownloads().then(()=>{if(route().page==='downloads')render();});
