import { readConfig } from './core.mjs';
import { benefitsPage, benefitDetail } from './member-benefits.mjs';
import { memberBenefit } from '../../../desktop/renderer/benefits.mjs';
import { APPLICATIONS, messengerDestination, PATH_INTERVIEW_URL } from './applications.mjs';
import { createLibrary, LIBRARY_KEY, LIBRARY_ITEMS, libraryItemRoute, filterApplications, listedItem, unlistedSearchHit } from './library.mjs';
import { worldPhoneSection } from '../../../desktop/renderer/world-phone.mjs';
import { createPlatformAccount } from './platform-account.mjs';
import { createMemberInsight } from '../../../desktop/renderer/member-insight.mjs';
import { createMemberActivity } from '../../../desktop/renderer/member-activity-controller.mjs';
import { createMemberUnderstanding } from '../../../desktop/renderer/member-understanding-controller.mjs';
import { createMemberSettings } from '../../../desktop/renderer/member-settings.mjs';
import { bindMemberUnderstandingEditor, captureMemberUnderstandingFocus } from '../../../desktop/renderer/member-understanding-host.mjs';
import { mountPlatformLibrary } from './platform-library-view.mjs';
import { ACTIVE_PLATFORM_APP_IDS } from './platform-library-data.mjs';
import { platformRoute, searchRoute, shortcutDestination } from './platform-home.mjs';
import { solioLegacyHash, solioPage, solioHomeItem, solioDiscoverSection, solioAccountPage, solioInsightPage } from './platform-solio.mjs';
import { platformPublicEntry, platformCompanyEntry } from './platform-entry.mjs';
import { shelfItem, shelfColumns } from './platform-shelf.mjs';
import { PLATFORM_DOWNLOADS, DOWNLOAD_OS, DOWNLOAD_STEPS, RELEASE_PAGE, downloadHref, checksumHref, downloadSize, downloadsState, detectDownloadOS, refreshPlatformDownloads } from './platform-downloads.mjs';
const $ = id => document.getElementById(id), root = $('page-content');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image = (name, cls = '') => `<img${cls?` class="${cls}"`:''} src="./assets/${name}" alt="">`;
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
 onChange: () => { if (route().page === 'account' && route().id === 'insight') render(); },
});
bindMemberUnderstandingEditor(root,{controller:memberUnderstanding,getReport:()=>memberInsight.read().report,settings:memberSettings,getSettingsContext:()=>memberInsight.settingsContext(),onSettingsSaved:()=>void memberInsight.refresh({quiet:true})});
const labels = { home:'내 홈', solio:'솔리오', benefits:'회원 혜택', account:'내 계정', discover:'둘러보기', library:'내 라이브러리', updates:'새소식', downloads:'다운로드', settings:'플랫폼 설정', help:'도움말', app:'앱 상세' };
const news = [
 {id:'solio',app:'platform',label:'솔리오',date:'2026.11.13',title:'솔리오를 열었어요',body:'AI 1인기업을 위한 통합 업무 앱 SYNK SOLIO(싱크 솔리오)를 위 메뉴에 두었어요. AI 구독 계정판은 솔리오의 「AI 구독 관리」로, 내 성향은 「내 계정 → 맞춤 정보」로 옮겼어요. 플레저는 오른쪽 프로필 메뉴의 「회원 혜택」에 있어요. 백업·복구는 준비하고 있어요.'},
 {id:'fortune-pause',app:'platform',label:'회원 혜택',date:'2026.10.30',title:'무료 운세는 잠시 쉬어요',body:'무료 운세를 다시 손보는 동안 잠시 내려 두었어요. 그동안 회원 혜택은 내 성향, AI 구독 계정판, 플레저 세 가지예요. 계정에 저장한 운세 기록은 지우지 않았어요.'},
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
// 지금 바로 쓸 수 있는 앱에만 초록 점을 단다(설치됨 · 웹에서 바로 여는 WORLD·PATH). Workspace는 회사 초대가 있어야 해 점을 달지 않는다.
const ready = app => status(app) === '설치됨' || (app.id !== 'messenger' && status(app) !== '설치 안 됨');
const dot = '<span class="dot" aria-hidden="true"></span>';
// A 진열대: 제목 블록(34) + 회색 한 줄. 영문 눈썹은 두지 않는다.
function heading(title, description='') { return `<header class="page-heading"><h1>${title}</h1>${description ? `<p>${description}</p>`:''}</header>`; }
const tab = (label, action, id, selected, extra='') => button(label, action, id, 'tab', `aria-pressed="${selected}" ${extra}`);
const STAR = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z"/></svg>';
const kindLabel = app => app.kind === 'benefit' ? '회원 혜택' : app.id === 'world' ? '한국어 학습' : app.id === 'path' ? '면접 연습' : '업무 · 대화';
function card(app) { const state = library.read(), benefit = app.kind === 'benefit', href = libraryItemRoute(app.id), favorite = state.favorites.includes(app.id);
 return shelfItem({ href, image:`./assets/${app.image}`, name:app.name, desc:app.subtitle, meta:benefit?`${kindLabel(app)} · ${app.statusLabel}`:`${kindLabel(app)} · ${status(app)}`, cls:`app-card ${benefit?'benefit-':''}${app.id}`, attrs:`data-application="${app.id}"`,
  peek:`${benefit?'혜택 소개':'앱 소개'} <span aria-hidden="true">→</span>`, after:button(STAR,'favorite',app.id,'fav-btn',`aria-label="${app.name} 즐겨찾기" aria-pressed="${favorite}"`) }); }
function filters(isLibrary=false) { return `<div class="filter-bar"><div class="tabs" role="group" aria-label="앱 분류">${[['all','전체'],['learn','학습'],['work','업무'],...(isLibrary?[['life','회원 혜택']]:[])].map(([id,text])=>tab(text,'filter',id,category===id)).join('')}</div><label class="sort-label">정렬 <select id="sort"><option value="default" ${sort==='default'?'selected':''}>기본순</option><option value="name" ${sort==='name'?'selected':''}>이름순</option><option value="recent" ${sort==='recent'?'selected':''}>최근 연 순</option></select></label></div>${isLibrary?`<div class="tabs collections" role="group" aria-label="라이브러리 컬렉션">${[['all','전체 바로가기'],['favorites','즐겨찾기'],['learn','학습 컬렉션'],['work','업무 컬렉션']].map(([id,text])=>tab(text,'collection-filter',id,collection===id)).join('')}</div>`:''}`; }
// WORLD를 찾는 말(WORLD · 한국어 · TOPIK …)로 검색하면 결과 아래 같은 휴대폰 칸을 보인다 — 목록에서 뺀 앱을 없어진 앱으로 읽지 않게(2026-11-11).
function shelf(isLibrary=false) { const apps = filterApplications({query,category,collection:isLibrary?collection:'all',library:library.read(),onlySaved:isLibrary,sort}), empty = isLibrary&&!library.read().saved.filter(listedItem).length, worldHit = !isLibrary&&unlistedSearchHit(query);
 return `${filters(isLibrary)}<p class="result-count">${query?`‘${esc(query)}’ 검색 · `:''}${isLibrary?'바로가기':'앱'} <span class="num">${apps.length}</span>개</p>${apps.length?`<ul class="shelf app-grid${shelfColumns(apps.length)}" aria-label="${isLibrary?'내 라이브러리':'SYNK 앱'}">${apps.map(card).join('')}</ul>`:`<div class="empty-state"><h2>${empty?'아직 담은 앱이 없어요.':'조건에 맞는 앱이 없어요.'}</h2><p>${empty?'앱이나 회원 혜택 소개에서 「라이브러리에 담기」를 누르면 여기에 모여요.':'검색어를 바꾸거나 분류를 「전체」로 돌려 보세요.'}</p>${empty?'<a class="sb-btn soft" href="#discover">앱 둘러보기 →</a>':button('검색·필터 지우기','clear-search')}</div>`}${worldHit?worldPhoneSection({qrSrc:'./assets/world-qr.svg',openHref:platformPublicEntry('world')}):''}`; }
function newsCards(items=news) { return items.length?`<ul class="news-list">${items.map(item=>`<li><button class="news-card" data-action="news" data-id="${item.id}"><span class="news-date">${item.date}</span><span class="news-label">${item.label}</span><span class="news-title">${item.title}</span><span class="news-arrow" aria-hidden="true">↗</span></button></li>`).join('')}</ul>`:'<p class="news-empty">이 앱의 새소식은 아직 없어요.</p>'; }
// 로그인 상태를 못 읽었을 때만 한 줄을 띄운다(이름은 내 홈 첫 줄과 위 막대 계정 칩이 보인다).
function accountPanel() {
 if (typeof window.synkDesktop?.authStatus === 'function' || identity.status !== 'error') return '';
 return `<section class="account-panel" aria-label="SYNK ID 로그인 상태"><div><h2>로그인 상태를 못 불러왔어요</h2><p role="status">${esc(identity.message)}</p></div><div class="actions">${button('다시 시도','retry-account')}</div></section>`;
}
function showBrowserAccount(state) {
 identity = state;
 const entry = document.querySelector('.account-entry');
 let label = entry.querySelector('[data-account-label]');
 if(!label){label=document.createElement('span');label.dataset.accountLabel='';entry.replaceChildren(...[entry.querySelector('img, .avatar'),label].filter(Boolean));}
 label.textContent = state.status==='signed-in' ? (state.displayName || '내 SYNK ID') : state.status==='loading'?'확인 중':state.status==='error'?'SYNK ID 확인':'SYNK ID 로그인';
 const avatar = entry.querySelector('.avatar');if(avatar)avatar.textContent = state.status==='signed-in'&&state.displayName ? [...state.displayName.trim()][0]?.toLocaleUpperCase('ko-KR') || 'S' : 'S';
 entry.setAttribute('aria-label',state.status==='signed-in'?'내 계정 메뉴':'SYNK ID로 로그인');solioProfileSync();render();continuity?.render?.();continuity?.authChanged?.();
}
// Signed out in this browser, the library card's way in is the SYNK ID sign-in itself (the same page as the header's).
// 지금 이 화면에서 로그인한 사람인가(웹 계정 · PC 앱 계정). 상태 줄 글을 고를 때만 쓴다.
const signedIn=()=>typeof window.synkDesktop?.authStatus==='function'?nativeIdentity.signedIn===true:identity.status==='signed-in';
const browserGuest=()=>{const id=browserAccount?.identity();return !!id&&id.configured===true&&id.status==='signed-out';};
const opened = recent => `${recent.mode==='web'?'웹':'PC 앱'}에서 열었어요 · ${new Date(recent.at).toLocaleDateString('ko-KR')}`;
// 바로 여는 길: 지금 카탈로그와 설치 상태로 정한다(저장한 주소를 쓰지 않는다). PC 앱이면 단추, 웹이면 새 창 링크.
function openAction(id, recent, cls) {
 const teacher=id==='messenger'&&recent?.entryId==='teacher', options={base:location.href,clients,learningUrl:config.learningUrl,messengerUrl,preferredMode:recent?.mode};
 let entryId=teacher?'teacher':id, destination=shortcutDestination(entryId,options);
 // 「내 수업」 입구를 못 만들면(회사 주소가 없는 화면) Workspace 칸 자체는 남기고 Workspace 길로 연다.
 if(!destination&&teacher){entryId=id;destination=shortcutDestination(id,options);}
 if(!destination)return null;
 return destination.kind==='client'?button(destination.label,'launch',entryId,cls):`<a href="${esc(destination.href)}" ${destination.kind==='web'?`data-web="${entryId}" target="_blank" rel="noopener noreferrer"`:''} class="${cls}">${destination.label}</a>`;
}
// 내 홈 선반 칸: 첫 칸(1.7배)은 이어서 열 앱. 칸을 누르면 소개, 아래 「여는 길」은 바로 연다.
function homeItem(id, big) {
 const state=library.read(), recent=state.recent.find(item=>item.id===id), item=itemById(id);
 if(id==='solio')return solioHomeItem(big);
 if(!item)return '';
 const action=openAction(id,recent,'go-link');if(action===null)return '';
 const error=launches.get(id)==='error', benefit=item.kind==='benefit';
 const meta=recent?opened(recent):benefit?item.statusLabel:`${status(item)}${state.favorites.includes(id)?' · 즐겨찾는 앱':''}`;
 return shelfItem({ href:libraryItemRoute(id), image:`./assets/${item.image}`, name:item.name, heading:'h2', desc:benefit?item.headline:big?item.description:item.subtitle, meta, dot:!recent&&!benefit&&ready(item), big, cls:'home-item', attrs:`data-shortcut="${id}"`,
  after:`<div class="go">${action}${error?'<p class="launch-feedback" role="status">앱을 열지 못했어요. 다시 누르거나 <a href="#downloads">다운로드 화면</a>에서 설치 상태를 봐 주세요.</p>':''}</div>` });
}
// 둘러보기 「최근에 연 앱」의 1px 줄 하나(내 홈에서는 11-08 맹검 뒤 뺐다): 이름 → 열어 본 때 → 바로 여는 길.
function recentRow(id, tag, recent) {
 const item=itemById(id);if(!item)return '';
 const action=openAction(id,recent,'plain row-act');
 return `<li class="row" data-shortcut-row="${id}"><a class="row-main" href="${libraryItemRoute(id)}">${esc(item.name)}</a><span class="tag">${esc(tag)}</span>${action&&!action.includes('href="#')?action:''}</li>`;
}
function recentSection() {
 const recents=library.read().recent.filter(item=>listedItem(item.id));
 return recents.length?`<section class="block recent-block" aria-labelledby="recent-block-title"><div class="block-head"><h2 id="recent-block-title">최근에 연 앱</h2>${button('기록 지우기','clear-recent','','plain')}<p>${continuity?.connected()?'계정에 저장한 최근 기록이에요.':'이 기기에서 연 기록이에요.'} 앱 안에서 어디까지 했는지는 각 앱에 남아요.</p></div><ul class="rows">${recents.map(item=>recentRow(item.id,opened(item),item)).join('')}</ul></section>`:'';
}
// 한국어 공부(synk.im/study/) 칸은 2026-11-14에 뺐다 — 유호님 「이대로 절대 공개하면 안될것같아」 → 「오늘 내리기」. 공개본 study/는 이 계정 홈으로 넘긴다(결정 11-14).
// 내 홈 첫 줄: 로그인한 이름(「○○ 님」), 로그인 전이면 SYNK ID 로그인 링크.
function whoLine() {
 if (typeof window.synkDesktop?.authStatus === 'function') { const name=nativeIdentity.account?.display_name;return nativeIdentity.signedIn?esc(name?`${name} 님`:'SYNK ID로 로그인했어요'):nativeIdentity.status==='loading'?'로그인 상태를 확인하고 있어요.':'<a href="./client.html?product=platform">SYNK ID로 로그인</a>'; }
 if (identity.status === 'signed-in') return esc(identity.displayName ? `${identity.displayName} 님` : 'SYNK ID로 로그인했어요');
 if (identity.status === 'loading') return '로그인 상태를 확인하고 있어요.';
 if (identity.status === 'error') return '로그인 상태를 못 불러왔어요';
 if (identity.status === 'signed-out') return '<a href="./client.html?product=platform">SYNK ID로 로그인</a>';
 return 'SYNK 플랫폼';
}
function homePage() {
 // WORLD는 선반에 두지 않고(이 기기에 남은 최근 · 즐겨찾기 기록도) 선반 아래 휴대폰 칸으로 안내한다(2026-11-11).
 const raw=library.read(), state={...raw,recent:raw.recent.filter(item=>listedItem(item.id)),favorites:raw.favorites.filter(listedItem)}, hasShortcuts=state.recent.length||state.favorites.length;
 const mineIds=[...new Set([...state.recent.map(item=>item.id),...state.favorites])];
 // 솔리오 칸: 내 앱(최근 · 즐겨찾기, 셋까지) 뒤, PATH 앞. 처음 온 사람은 솔리오가 큰 첫 칸이고 PATH가 다음 칸이다.
 const mine=[];for(const id of mineIds){if(mine.length===3)break;const html=homeItem(id,!mine.length);if(html)mine.push(html);}
 const shelfItems=[...mine,solioHomeItem(!mine.length)];if(shelfItems.length<4&&!mineIds.includes('path')){const path=homeItem('path',false);if(path)shelfItems.push(path);}
 // 두 줄 인사(시안 A): 최근에 연 앱이 있으면 그 앱을 이어서 열자고, 없으면(손님 포함) 한 ID로 여는 곳이라고. 상대 날짜는 넣지 않는다.
 const last=itemById(state.recent[0]?.id), title=last?`최근에 연 ${esc(last.name.replace(/^SYNK /,''))},<br><span>이어서 열까요?</span>`:'SYNK 앱과 솔리오,<br><span>한 ID로 열어요.</span>';
 return `<section class="hello" aria-labelledby="home-title"><p class="who">${whoLine()}</p><h1 id="home-title">${title}</h1></section>`+accountPanel()
 + `<ul class="shelf home-shelf count-${shelfItems.length}" aria-label="내 앱과 솔리오">${shelfItems.join('')}</ul>${hasShortcuts?'':'<p class="shelf-note">솔리오 소개와 웹에서 여는 면접 연습을 먼저 두었어요.</p>'}`
 + worldPhoneSection({qrSrc:'./assets/world-qr.svg',openHref:platformPublicEntry('world')});
}
// 옛 주소 #app/world(새소식 · 즐겨찾기 · 북마크)는 앱 소개 대신 같은 휴대폰 칸을 보인다.
function worldPhonePage() { return crumb('SYNK WORLD')+worldPhoneSection({qrSrc:'./assets/world-qr.svg',openHref:platformPublicEntry('world')}); }
function discover() {
 const recents = library.read().recent;
 return (query ? heading('검색 결과','앱과 솔리오 · 회원 혜택에서 함께 찾았어요.') : heading('둘러보기','지금 쓸 수 있는 SYNK 앱과 솔리오, 회원 혜택이에요.'))+(!query?accountPanel():'')
 + '<section class="block block-first" aria-labelledby="discover-apps-title"><div class="block-head"><h2 id="discover-apps-title">SYNK 앱</h2><a class="link" href="#library">내 라이브러리 →</a></div>'+shelf()+'</section>'
 + (recents.length&&!query ? recentSection():'')
 + solioDiscoverSection(query,{signedIn:signedIn(),care:memberBenefit('care')})
 + (!query?'<section class="block news-section" aria-labelledby="discover-news-title"><div class="block-head"><h2 id="discover-news-title">새소식</h2><a class="link" href="#updates">새소식 모두 보기 →</a></div>'+newsCards(news.slice(0,3))+'</section>':'');
}
function libraryPage() { return heading('내 라이브러리',continuity?.connected()?'즐겨찾기와 최근 기록은 계정에, 담은 목록과 컬렉션은 이 기기에 저장해요.':'앱과 회원 혜택을 이 기기에 담아 둬요. 위에서 계정 라이브러리를 켜면 즐겨찾기와 최근 기록을 다른 기기에서도 봐요.')+shelf(true); }
// 앱 소개: 위치 줄 → 왼쪽 7 그림(WORLD는 서울행 장면 셋, 다른 앱은 회색 무대 위 물건) : 오른쪽 5 글 · 단추 · 밑줄 탭 · 1px 줄 목록.
const SCENES = [['train','서울의 첫 아침','지하철 창밖 한강 위에 선 크림색 펠트 글자 「안녕」'],['gate','정문','대학 정문 앞 광장에 선 펠트 글자 「환영」'],['idol','내 꿈 · 데뷔','응원봉 불빛이 가득한 공연장 무대의 펠트 글자 「데뷔」와 무대를 보는 뒷모습']];
function detailArt(app) {
 if(app.id==='world')return `<div class="scenes" role="group" aria-label="WORLD 장면">${SCENES.map(([file,name,alt])=>`<figure class="scene"><div class="fr"><img src="./assets/scene-${file}.webp" alt="${alt}"></div><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
 return `<div class="detail-stage">${image(app.image)}</div>`;
}
const crumb = name => `<nav class="crumb" aria-label="위치"><a href="#discover">모든 앱</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span></nav>`;
const detailTabs = list => `<div class="tabs" role="group" aria-label="앱 상세 항목">${list.map(([id,title])=>tab(title,'detail-tab',id,detailTab===id)).join('')}</div>`;
function detailFrame(app, note, tabs, body) { return crumb(app.name)+`<div class="detail app-detail ${app.id}"><div class="detail-art">${detailArt(app)}</div><div class="detail-text"><p class="aud">${kindLabel(app)}</p><h1 class="latin">${app.name}</h1><p class="sub">${app.subtitle}</p><p class="sum">${app.description}</p><div class="acts">${launchControls(app)}</div><p class="state">${ready(app)?dot:''}${note}</p>${tabs}${body}</div></div>`; }
function pathAppPage(app) {
 const requirements=detailTab==='requirements';
 return detailFrame(app,'웹에서 연습 · 설치하거나 로그인하지 않아도 돼요',detailTabs([['overview','소개'],['requirements','이용 안내']]),
  requirements?`<section class="info"><h2>준비할 것</h2><dl class="specs"><dt>PC</dt><dd>글로 답하거나, 한국어 음성을 켜고 마이크로 답해요.</dd><dt>Quest</dt><dd>Quest 브라우저에서 같은 주소를 열고, 한국어 음성 준비 → 마이크 확인 → VR 입장 순서로 진행해요.</dd><dt>첫 음성 준비</dt><dd>약 103MB의 한국어 음성 모델을 내려받아요. 준비 시간은 면접 시간에 포함되지 않아요.</dd><dt>둘러보기</dt><dd>PC는 마우스로 끌어 30도 안에서 둘러보고, VR은 고개 움직임을 따라가요.</dd><dt>기록</dt><dd>목소리와 답변은 이 기기 안에서만 처리하고, 서버나 계정에 저장하지 않아요.</dd></dl><p class="small">VR에서 어지럽거나 불편하면 바로 멈추고 쉬어 주세요.</p></section>`
  :`<section class="info"><h2>면접실에서 하는 것</h2><p>${app.available}</p><ul class="feats"><li><strong>면접관 세 명</strong><span>서류를 넘기고 받아 적는 면접관들 앞에서 답해요.</span></li><li><strong>내 답에 맞춘 다음 질문</strong><span>경험을 말했는지, 준비한 것을 말했는지에 따라 다음 질문이 달라져요.</span></li><li><strong>한 번에 60~90초</strong><span>질문 → 첫 답 → 다음 질문 → 두 번째 답. 짧게 답하면 더 빨리 끝나요.</span></li></ul></section><section class="info"><h2>알아 둘 것</h2><p>앉아서 하는 연습용 면접실이에요. 실제 채용 평가가 아니고, 질문은 미리 정해 둔 것 중에서 골라 나와요.</p><p>VR에서는 앉은 자리에서 둘러보는 방식이라 걸어 다닐 수는 없어요.</p><p class="small">면접 답변은 저장하지 않아요. 즐겨찾기와 최근 기록에도 답변은 남지 않아요.</p></section>`);
}
function launchControls(app) { const client = !app.webOnly&&clients.find(item=>item.id===app.id), web = app.id==='path'?PATH_INTERVIEW_URL:app.id==='world'?platformPublicEntry('world'):messengerUrl;return `${client?.canLaunch?button('앱 열기 ↗','launch',app.id,'sb-btn'):web?`<a href="${esc(web)}" data-web="${app.id}" target="_blank" rel="noopener noreferrer" class="sb-btn">${app.id==='path'?'면접 연습 열기':app.id==='world'?'웹 WORLD 열기':'Workspace 웹 열기'} ↗</a>`:`<a href="#downloads" class="sb-btn">PC 앱 받기 →</a>`}${button(library.read().saved.includes(app.id)?'라이브러리에서 빼기':'라이브러리에 담기','save',app.id)}${button(library.read().favorites.includes(app.id)?'★ 즐겨찾기':'☆ 즐겨찾기','favorite',app.id,'sb-btn soft',`aria-pressed="${library.read().favorites.includes(app.id)}"`)}`; }
function appPage(id) { const app=appById(id);if(app?.id==='world')return worldPhonePage();if(app?.id==='path')return pathAppPage(app);if(!app) return heading('앱을 찾을 수 없어요.')+'<p><a class="link" href="#discover">둘러보기로 돌아가기</a></p>';const state=library.read(),world=app.id==='world';
 // 위 주 단추가 이미 웹으로 여는 단추면(PC 앱이 없을 때) 아래 「웹에서 먼저 …」 줄은 같은 행동이라 두지 않는다.
 const webPrimary=!clients.find(item=>item.id===app.id)?.canLaunch&&!!(world||messengerUrl);
 return detailFrame(app,`${status(app)} · ${world?'웹에서 바로 하거나 PC 앱에 설치해 써요':'회사 초대를 받은 계정이나 반을 맡은 교사 계정으로 써요'}`,detailTabs([['overview','소개'],['requirements','설치 안내'],['news','앱 소식']]),
 detailTab==='news'?`<section class="info"><h2>앱 소식</h2><div class="info-list">${newsCards(news.filter(item=>item.app===app.id))}</div></section>`:detailTab==='requirements'?`<section class="info"><h2>설치와 로그인</h2><dl class="specs"><dt>설치</dt><dd>SYNK PC 앱 안에서 골라 설치해요.</dd><dt>PC</dt><dd>Windows 10·11 64비트, macOS 13 이상</dd><dt>웹</dt><dd>${world?'웹 WORLD는 설치 없이 열려요.':'회사에서 안내받은 Workspace 주소로 열어요. 교사는 같은 주소의 「내 수업」으로 들어가요.'}</dd><dt>로그인</dt><dd>${world?'SYNK ID로 로그인해요. 「학습 기록 연결」은 계정 화면에서 켜고 꺼요.':'회사 일은 회사 초대를 받은 계정으로, 내 수업은 반을 맡은 교사로 등록된 SYNK ID로 로그인해요. 가입만 한 SYNK ID로는 들어갈 수 없어요.'}</dd></dl><a class="link" href="#downloads">PC 앱 받기 →</a></section>`
 :`<section class="info"><h2>${world?'WORLD에서 할 수 있는 것':'Workspace에서 할 수 있는 것'}</h2><p>${app.available}</p>${world?`<ul class="feats"><li><strong>TOPIK 준비</strong><span>TOPIK I 짧은 진단으로 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.</span></li><li><strong>미니게임</strong><span>바람길·말의 리듬·한글 만나기 같은 게임을 웹에서 바로 해요.</span></li><li><strong>SYNK TOWN</strong><span>마을 생활 속에서 배운 말을 써 봐요.</span></li><li><strong>과제와 학습 기록</strong><span>받은 과제를 하고, 연습 기록을 계정에 저장해 다른 기기에서 이어 가요.</span></li></ul>`:`<ul class="feats"><li><strong>팀 대화</strong><span>채널과 1:1 대화에서 이야기하고, 검색으로 지난 대화를 찾아요.</span></li><li><strong>자료 공유</strong><span>회사 자료를 올려 두고 함께 찾아 써요.</span></li><li><strong>내 수업</strong><span>교사는 맡은 반의 학생과 과제를 여기서 챙겨요.</span></li></ul>`}${webPrimary?'':`<div class="line-row web-preview"><div><strong>${world?'웹에서 먼저 해 봐도 돼요.':messengerUrl?'웹에서도 열 수 있어요.':'웹은 회사 주소로 들어가요.'}</strong><p>${world?'웹은 설치 없이 열려요.':messengerUrl?'회사에서 초대받은 계정으로 로그인해요.':'회사에서 안내받은 Workspace 주소로 들어가 로그인해 주세요.'}</p></div>${world||messengerUrl?`<a class="sb-btn soft" href="${esc(world?platformPublicEntry('world'):messengerUrl)}" data-web="${app.id}" target="_blank" rel="noopener noreferrer">${world?'웹 WORLD 열기':'Workspace 웹 열기'} ↗</a>`:''}</div>`}</section>`
 +`<section class="info"><h2>컬렉션에 넣기</h2><p class="small">이 기기에만 저장해요.</p><div class="toggles">${[['learn','학습'],['work','업무']].map(([id,label])=>`<label class="toggle"><span>${label} 컬렉션</span><input type="checkbox" data-collection="${id}" data-id="${app.id}" ${state.collections[id].includes(app.id)?'checked':''}></label>`).join('')}</div></section>`
 +`<section class="info"><h2>누가 쓰나요</h2><p>${app.audience}</p><p class="small">라이브러리에 담아도 이용 권한이 생기지는 않아요. ${app.id==='messenger'?'교사 권한과 회사 직원 권한은 따로 받아요.':'게임 점수는 TOPIK 급수나 합격과 관계없어요.'}</p><a class="link" href="./client.html?product=platform">SYNK ID 관리 ↗</a></section>`); }
function downloads() {
 const os=downloadOS,d=PLATFORM_DOWNLOADS[os],mac=os!=='windows',feed=downloadsState(),ready=feed==='ready',started=ready&&downloadStarted===os;
 const tabs=`<div class="tabs lined os-tabs" role="group" aria-label="운영체제">${DOWNLOAD_OS.map(id=>tab(esc(PLATFORM_DOWNLOADS[id].tab)+(detectedOS===id?'<span class="dl-here">이 기기</span>':''),'os',id,os===id)).join('')}</div>${mac?'<p class="dl-hint">칩을 모르면 왼쪽 위 Apple 메뉴 → 「이 Mac에 관하여」에서 볼 수 있어요.</p>':''}`;
 const readouts=`<dl class="dl-readouts">${ready?`<div><dt>파일</dt><dd>${esc(d.file)}</dd></div><div><dt>크기</dt><dd class="num">${downloadSize(d.bytes)}</dd></div>`:''}<div><dt>필요</dt><dd>${esc(d.need)}</dd></div><div><dt>서명</dt><dd>${esc(d.sign)}</dd></div></dl>`;
 const actions=ready?`<div class="dl-actions"><a class="sb-btn dl-get" href="${downloadHref(os)}" data-action="download-start" data-id="${os}">${esc(d.label)} <span aria-hidden="true">↓</span></a><a class="sb-btn soft" href="${checksumHref(os)}" target="_blank" rel="noopener">파일 확인값(SHA-256) ↗</a></div>`:`<div class="dl-actions"><a class="sb-btn dl-get" href="${RELEASE_PAGE}" target="_blank" rel="noopener">synk.im에서 받기 ↗</a></div><p class="small dl-feed-note" role="status">${feed==='loading'?'지금 공개된 판을 확인하고 있어요.':'공개된 판 정보를 불러오지 못했어요. synk.im에서 지금 판을 받아 주세요.'}</p>`;
 const next=started?`<div class="dl-next" role="status"><p class="dl-started">다운로드를 시작했어요</p><p class="small">파일을 다 받으면 아래 순서대로 열어 주세요.</p><ol class="dl-steps">${DOWNLOAD_STEPS[mac?'mac':'windows'].map(([title,body])=>`<li><strong>${esc(title)}</strong><p>${esc(body)}</p></li>`).join('')}</ol><p class="small dl-retry">다운로드가 시작되지 않았나요? <a href="${downloadHref(os)}">다시 받기</a></p></div>`:'';
 const panel=`<section class="dl-panel" aria-label="SYNK PC 앱 ${esc(d.tab)} 다운로드"><h2>SYNK PC 앱</h2><p>${esc(d.label)}${mac?` · ${esc(d.chip)}`:''} · ${esc(d.sticker)}${ready?` · 시험판 <span class="num">${PLATFORM_DOWNLOADS.version}</span>`:''}</p><p>SYNK 앱과 솔리오를 여는 PC 앱이에요.</p>${readouts}${actions}${next}</section>`;
 const apps=APPLICATIONS.filter(app=>!app.webOnly&&listedItem(app.id)).map(app=>{const client=clients.find(item=>item.id===app.id);return `<article class="download-row">${image(app.image)}<div><h3>${app.name}</h3><p>${app.subtitle}</p><span class="small">${client?.status==='current'?'실행 중':client?.canLaunch?'설치됨':environment?'설치 안 됨':app.id==='world'?'웹에서도 열려요':'회사 초대·교사 등록 필요'}</span></div><div class="download-action">${client?.canLaunch?button('앱 열기','launch',app.id):''}${button('설치 안내','install-info',app.id,'plain')}</div></article>`;}).join('');
 return heading('PC 앱 받기','SYNK PC 앱을 먼저 설치하고, Workspace는 그 안에서 골라 설치해요. WORLD는 설치 없이 휴대폰 브라우저에서 열어요.')+tabs+panel+`<section class="block" aria-labelledby="dl-apps-title"><div class="block-head"><h2 id="dl-apps-title">PC 앱 안에서 설치하는 앱</h2></div><div class="download-list">${apps}</div></section><section class="content-panel"><h2>업데이트</h2><p>Windows 앱은 새 판이 나오면 스스로 받아 설치하고 다시 켜져요. Mac 앱은 새 판을 받아 두면 DMG를 열어 응용 프로그램 폴더의 앱을 바꿔 주세요. 계정과 앱 데이터는 그대로 남아요.</p>${window.synkDesktop?`<div class="actions">${button('설치 상태 다시 확인','refresh-clients')}</div>`:''}</section>`;
}
function settings() { const state=library.read(), theme=document.documentElement.dataset.theme||'day';return heading('플랫폼 설정','계정 라이브러리를 켜면 즐겨찾기와 최근 기록은 계정에 저장해요. 화면 설정과 컬렉션은 이 기기에 남아요.')
 +`<section class="content-panel" aria-labelledby="settings-screen"><h2 id="settings-screen">화면</h2><div class="rows-wrap"><div class="setting-row as-row"><span><strong>화면 테마</strong><small>이 기기에 저장해요.</small></span><div class="pill-group" role="group" aria-label="화면 테마">${[['day','낮'],['night','밤'],['system','기기 설정']].map(([id,label])=>`<button type="button" data-theme-choice="${id}" aria-pressed="${theme===id}">${label}</button>`).join('')}</div></div></div></section>`
 +`<section class="content-panel" aria-labelledby="settings-library"><h2 id="settings-library">라이브러리</h2><div class="rows-wrap"><label class="setting-row"><span><strong>최근 기록 남기기</strong><small>어떤 앱을 언제 열었는지만 남겨요. 끄면 지금 목록도 지워요.</small></span><input type="checkbox" data-setting="remember" ${state.rememberRecent?'checked':''}></label><label class="setting-row"><span><strong>카드 작게 보기</strong><small>라이브러리의 그림을 작게 보여 줘요.</small></span><input type="checkbox" data-setting="compact" ${state.compact?'checked':''}></label></div></section>`
 +`<section class="content-panel"><h2>이 기기에 저장한 것</h2><p>이 기기의 바로가기, 컬렉션, 화면 설정이에요. 계정에 저장한 즐겨찾기와 최근 기록, 메모는 맨 위 계정 라이브러리에서 지울 수 있어요.</p><div class="actions">${button('설정 파일로 받기','export')}${button('이 기기 설정 지우기','reset-confirm','','plain danger')}</div></section><section class="content-panel"><h2>SYNK ID와 앱 기록</h2><p>회사 대화와 자료, WORLD 학습 기록은 앱마다 따로 저장하고 서로 섞지 않아요.</p><a class="link" href="./client.html?product=platform">SYNK ID 관리 ↗</a></section>`; }
function help() { return heading('SYNK를 시작하는 방법')+`<ol class="help-rows"><li><h2>1. SYNK PC 앱을 설치해요.</h2><p>Windows와 Mac에서 써요. 다운로드 화면에서 내 기기에 맞는 파일을 받아 설치해요. 웹에서만 쓸 거라면 설치하지 않아도 돼요.</p></li><li><h2>2. Workspace는 PC 앱 안에서 설치해요.</h2><p>PC 앱을 깔아도 Workspace가 저절로 깔리지는 않아요. PC 앱에서 Workspace를 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요. 한국어 공부 앱 WORLD는 설치 없이 휴대폰 브라우저에서 열려요. 주소는 synk.im/world예요.</p></li><li><h2>3. SYNK ID 하나로 로그인해요.</h2><p>앱마다 같은 SYNK ID로 로그인해요. 「학습 기록 연결」은 계정 화면에서 켜고 꺼요. Workspace는 회사 초대를 받은 계정만 들어갈 수 있어요.</p></li><li><h2>라이브러리에 담으면 쓸 수 있게 되나요?</h2><p>아니요. 라이브러리는 바로가기를 모아 두는 곳이에요. 설치나 이용 권한은 그대로예요.</p></li><li><h2>지금 웹에서 쓸 수 있는 것은요?</h2><p>WORLD(휴대폰 브라우저가 가장 편해요), PATH 면접 연습, 플레저는 웹에서 바로 열려요. 내 성향은 로그인한 뒤 「내 계정 → 맞춤 정보」에서 보고, 솔리오의 AI 구독 관리는 PC 앱에서 써요.</p></li><li><h2>솔리오는 무엇인가요?</h2><p>AI 1인기업을 위한 통합 업무 앱 SYNK SOLIO예요. 지금은 AI 구독 관리를 PC 앱에서 회원 무료로 쓰고, 백업·복구는 준비하고 있어요. 위 메뉴 「솔리오」에서 봐요.</p></li></ol><div class="help-foot"><a href="#downloads" class="sb-btn">PC 앱 받기</a></div>`; }
const MORE_PAGES = ['updates','downloads','settings','help','benefits'];
function render() { const restoreInsightFocus=captureMemberUnderstandingFocus(root);memberActivity.read();memberInsight.setVisible(pageActive&&!document.hidden&&route().page==='account'&&route().id==='insight');const active = root.contains(document.activeElement) ? document.activeElement : null;const focus = active ? ['id','data-action','data-insight-action','data-insight-target','data-id','data-collection','data-setting','href','data-web'].map(key=>[key,active.getAttribute(key)]).filter(([,value])=>value!==null) : [];const {page,id}=route(), state=library.read();document.title=page==='home'?'SYNK 플랫폼':`${labels[page]} · SYNK 플랫폼`;const count=$('library-count'),savedListed=state.saved.filter(listedItem).length;count.textContent=savedListed;count.hidden=!savedListed;document.body.classList.toggle('compact-cards',state.compact);document.querySelectorAll('[data-route]').forEach(node=>{ if(node.dataset.route===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current'); });$('more-toggle')?.classList.toggle('is-current',MORE_PAGES.includes(page));root.innerHTML=page==='home'?homePage():page==='solio'?solioPage(id):page==='account'?(id==='insight'?solioInsightPage(memberInsight.read(),{signedIn:signedIn()}):solioAccountPage(solioAccountState())):page==='benefits'?(id?benefitDetail(id,location.href,{library:state,insight:memberInsight.read(),signedIn:signedIn()}):benefitsPage({signedIn:signedIn()})):page==='discover'?discover():page==='library'?libraryPage():page==='app'?appPage(id):page==='downloads'?downloads():page==='settings'?settings():page==='updates'?heading('새소식','앱과 솔리오 · 회원 혜택에서 바뀐 점을 날짜와 함께 적어 둬요.')+newsCards():help();for(const link of root.querySelectorAll('[data-web]'))updateWebLink(link);if(focus.length){const next=[...root.querySelectorAll('a,button,input,select')].find(node=>focus.every(([key,value])=>node.getAttribute(key)===value));next?.focus({preventScroll:true});}restoreInsightFocus(); }
// 좁은 창 아래 탭 막대의 「더 보기」: 새소식 · 다운로드 · 설정 · 도움말 · SYNK ID 관리.
const moreToggle=$('more-toggle'), moreMenu=$('more-menu');
function setMore(open){if(!moreToggle||!moreMenu)return;moreMenu.hidden=!open;moreToggle.setAttribute('aria-expanded',String(open));if(open)moreMenu.querySelector('a')?.focus({preventScroll:true});}
moreToggle?.addEventListener('click',()=>setMore(moreMenu.hidden));
moreMenu?.addEventListener('click',event=>{if(event.target.closest('a'))setMore(false);});
document.addEventListener('click',event=>{if(moreMenu&&!moreMenu.hidden&&!moreMenu.contains(event.target)&&!moreToggle.contains(event.target))setMore(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&moreMenu&&!moreMenu.hidden){setMore(false);moreToggle.focus();}});
// 오른쪽 프로필 메뉴(2026-11-13 솔리오 판): 로그인했으면 위 막대 계정 칩이 펼침 단추가 되어 내 계정 · 회원 혜택 · SYNK ID 관리를 펼친다.
// 로그인 전 · 확인 중 · 오류에는 지금처럼 SYNK ID 로그인 링크로 간다. Esc · 초점 이탈 · 바깥 누름 · 항목 누름 · 주소 바뀜에 닫힌다.
const solioProfileEntry=document.querySelector('.account-entry'),solioProfileMenu=$('profile-menu');
function solioProfileName(){return typeof window.synkDesktop?.authStatus==='function'?nativeIdentity.account?.display_name||'':identity.displayName||'';}
function solioAccountState(){return {status:signedIn()?'signed-in':(typeof window.synkDesktop?.authStatus==='function'?nativeIdentity.status:identity.status)==='loading'?'loading':'signed-out',name:solioProfileName()};}
function solioProfileSet(open){if(!solioProfileMenu||!solioProfileEntry)return;const can=signedIn();open=!!open&&can;solioProfileMenu.hidden=!open;if(can){solioProfileEntry.setAttribute('role','button');solioProfileEntry.setAttribute('aria-expanded',String(open));solioProfileEntry.setAttribute('aria-controls','profile-menu');}else{for(const key of ['role','aria-expanded','aria-controls'])solioProfileEntry.removeAttribute(key);}if(open){const who=$('profile-menu-who');if(who)who.textContent=solioProfileName()?`${solioProfileName()} 님`:'SYNK ID';solioProfileMenu.querySelector('a')?.focus({preventScroll:true});}}
function solioProfileSync(){solioProfileSet(solioProfileMenu?!solioProfileMenu.hidden:false);}
solioProfileEntry?.addEventListener('click',event=>{if(!signedIn())return;event.preventDefault();solioProfileSet(solioProfileMenu.hidden);});
solioProfileEntry?.addEventListener('keydown',event=>{if(event.key===' '&&signedIn()){event.preventDefault();solioProfileSet(solioProfileMenu.hidden);}});
solioProfileMenu?.addEventListener('click',event=>{if(event.target.closest('a'))solioProfileSet(false);});
document.addEventListener('focusout',event=>{const next=event.relatedTarget;if(solioProfileMenu&&!solioProfileMenu.hidden&&(solioProfileMenu.contains(event.target)||solioProfileEntry?.contains(event.target))&&next&&!solioProfileMenu.contains(next)&&!solioProfileEntry?.contains(next))solioProfileSet(false);});
document.addEventListener('click',event=>{if(solioProfileMenu&&!solioProfileMenu.hidden&&!solioProfileMenu.contains(event.target)&&!solioProfileEntry?.contains(event.target))solioProfileSet(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&solioProfileMenu&&!solioProfileMenu.hidden){solioProfileSet(false);solioProfileEntry?.focus();}});
// 옛 주소(#benefits/insight · #benefits/subscriptions)는 새 자리로 바꿔 적는다 — 기록을 더하지 않아 뒤로 가기 한 번에 앞 쪽으로 간다.
function solioFollowLegacy(){const moved=solioLegacyHash(location.hash);if(moved)window.history.replaceState(window.history.state,'',moved);}
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
 else if(['save','favorite'].includes(action)){const before=library.read(),had=(action==='save'?before.saved:before.favorites).includes(id);if(dispatch({type:action,id}))notice(action==='save'?(had?'라이브러리에서 뺐어요.':'라이브러리에 담았어요.'):route().page==='benefits'?(had?'홈 고정을 풀었어요.':'홈에 고정했어요. 내 홈 선반에 나와요.'):(had?'즐겨찾기에서 뺐어요.':'즐겨찾기에 넣었어요.'));}
 else if(action==='filter'){category=id;render();}
 else if(action==='collection-filter'){collection=id;render();}
 else if(action==='clear-search'){query='';category='all';collection='all';$('platform-search').value='';location.hash=searchRoute(route().page,'');render();}
 else if(action==='detail-tab'){detailTab=id;render();}
 else if(action==='os'){downloadOS=id;downloadPicked=true;downloadStarted=null;render();}
 else if(action==='download-start'){downloadStarted=id;setTimeout(render,0);}
 else if(action==='clear-recent')dispatch({type:action});
 else if(action==='news'){const item=news.find(v=>v.id===id);if(item)modal(item.title,item.body,'<p class="small">'+item.date+'</p>');}
 else if(action==='install-info')modal('Workspace 설치','Workspace 설치 파일은 SYNK PC 앱 안에 들어 있어요. PC 앱에서 Workspace를 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요. 다 깔리면 「설치 상태 확인」을 눌러 바로 열어요.');
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
window.addEventListener('hashchange',()=>{solioFollowLegacy();solioProfileSet(false);setMore(false);detailTab='overview';query=route().query;$('platform-search').value=query;if(route().page!=='library'&&category==='life')category='all';render();root.focus({preventScroll:true});window.scrollTo(0,0);});
window.addEventListener('storage',event=>{if(event.key===LIBRARY_KEY||event.key===null){library.reload();render();}});
const continuityRoot=document.createElement('aside');continuityRoot.setAttribute('aria-label','계정 라이브러리');root.before(continuityRoot);
const continuityStyle=document.createElement('link');continuityStyle.rel='stylesheet';continuityStyle.href='./src/platform-library.css';document.head.append(continuityStyle);
// 계정 라이브러리 띠도 PC(visibleLibraryAppIds)처럼 WORLD 칸을 두지 않는다 — 계정에 저장한 기록은 그대로다(2026-11-11).
solioFollowLegacy();
continuity=mountPlatformLibrary(continuityRoot,{getAppIds:()=>ACTIVE_PLATFORM_APP_IDS.filter(listedItem),getHost:()=>browserAccount,signIn:{guest:browserGuest,open:()=>location.assign('./client.html?product=platform')},ensureReady:()=>refreshBrowserAccount(),onChange:()=>render(),onFavoritesChanged:()=>memberActivity.syncFavorites(),getDevice:()=>deviceLibrary.read(),onLogin:()=>location.assign('./client.html?product=platform'),onManage:()=>location.assign('./client.html?product=platform'),onOpen:id=>{const destination=shortcutDestination(id,{base:location.href,clients,learningUrl:config.learningUrl,messengerUrl});if(destination?.kind==='web'){if(!accountEntryReady(id)){accountEntryUnavailable();return;}openActivityWindow(publicEntry(id,destination.href),id);}else location.hash=libraryItemRoute(id);}});
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
    entry.setAttribute('aria-label', state.signedIn ? '내 계정 메뉴' : 'SYNK ID로 로그인');solioProfileSync();
  };
  const stop = window.synkDesktop.onAuthChanged(show);
  const initialVersion=nativeIdentityVersion;
  void window.synkDesktop.authStatus().then(state=>{if(initialVersion===nativeIdentityVersion&&pageActive&&!document.hidden)show(state);}).catch(() => { if(initialVersion===nativeIdentityVersion)label.textContent = 'SYNK ID 확인'; });
  window.addEventListener('pagehide', event=>{if(!event.persisted)stop();});
}
void detectDownloadOS().then(os=>{detectedOS=os;if(!os||downloadPicked)return;downloadOS=os==='mac'?'mac-arm64':os;if(route().page==='downloads')render();});
void refreshPlatformDownloads().then(()=>{if(route().page==='downloads')render();});
