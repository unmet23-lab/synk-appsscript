'use strict';

function isDemoMode() { return new URLSearchParams(location.search).get('demo') === '1'; }
function demoApiUrl(path, method = 'GET') {
  if (!isDemoMode()) return path;
  const url = new URL(path,location.origin), authPaths = ['/api/me','/api/login','/api/logout','/api/launch'];
  if (authPaths.includes(url.pathname)) return path;
  if (method !== 'GET') throw new Error('데모에서는 실제 자료를 변경하지 않아요. 그래프와 상세 수치를 살펴보세요.');
  const allowed = ['state','analytics','day','team-overview','team-trends','hype','export.csv'];
  const name = url.pathname.replace(/^\/api\/(?:demo\/)?/,'');
  if (!allowed.includes(name)) throw new Error('이 기능은 실제 데이터 화면에서 사용할 수 있어요.');
  url.pathname = '/api/demo/' + name;
  const persona = new URLSearchParams(location.search).get('persona');
  if (persona) url.searchParams.set('persona',persona);
  return url.pathname + url.search;
}
function demoScreenUrl(enabled, persona = '') {
  const url = new URL(location.href);
  url.hash = '';
  url.searchParams.set('tab','overview');
  if (!['mine','team','all'].includes(url.searchParams.get('section'))) url.searchParams.set('section','all');
  url.searchParams.delete('teamId');
  if (enabled) { url.searchParams.set('demo','1'); if(persona)url.searchParams.set('persona',persona); }
  else { url.searchParams.delete('demo');url.searchParams.delete('persona'); }
  return url.pathname + url.search;
}
function demoHomeUrl(){const url=new URL(location.href);url.search='?tab=home';url.hash='';return url.pathname+url.search;}
function demoWorkroomUrl(){const url=new URL(location.href);url.search='?tab=workroom';url.hash='';return url.pathname+url.search;}
function demoHandbookUrl(){const url=new URL(location.href);url.search='?tab=handbook';url.hash='';return url.pathname+url.search;}
function demoTeachingUrl(){const url=new URL(location.href);url.search='?tab=teaching';url.hash='';return url.pathname+url.search;}
function demoMessengerUrl() {
  const url = new URL(location.href);
  url.search = '?tab=messenger';
  url.hash = '';
  return url.pathname + url.search;
}
function initializeDemoRange(data) {
  if (!data.demo?.enabled || state.demoRangeInitialized) return;
  state.end = data.demo.anchorDate;state.start = shiftDate(state.end,-27);state.range='custom';state.demoRangeInitialized=true;
}
function demoBanner() {
  if (['messenger','workroom','handbook'].includes(state.tab)) return '';
  if (!isDemoMode()) return state.data?.demoAvailable && isAdmin() ? `<aside class="demo-entry"><span>예시 데이터로 개인·팀·전체 그래프를 비교해 보세요.</span><a class="btn small" href="${escape(demoScreenUrl(true))}">${icon('chart')}그래프 데모 보기</a></aside>` : '';
  const data=state.data?.demo, people=data?.people||[];
  return `<aside class="demo-banner demo-banner-compact" aria-label="데모 데이터 안내"><div class="demo-banner-copy"><strong><span class="demo-badge">DEMO</span>가상 데이터</strong><details id="demo-information"><summary>예시 정보</summary><p>크루 ${people.length}명 · 채널 ${number(data?.channelCount??state.data?.channels?.length)}개 · 가상 게시글 ${number(data?.postCount)}개. 실제 업로드나 수집 기록이 아닙니다. 읽기 전용이며 삭제 요청 전까지 보관됩니다.</p></details></div><div class="demo-banner-controls"><select data-demo-persona aria-label="데모 크루 선택">${people.map(person=>`<option value="${escape(person.id)}" ${person.id===data?.personaId?'selected':''}>${escape(person.name)} · ${escape(person.teamName)}</option>`).join('')}</select><a href="${escape(demoScreenUrl(false))}">실제 데이터로 돌아가기</a></div></aside>`;
}
function demoAllowsAction(action,target) {
  if (!isDemoMode()) return true;
  if (['tab','marketing-section','command-tab'].includes(action)) return ['marketing','mine','team','all','overview','analysis','history'].includes(target.dataset.tab);
  return ['workspace-sidebar-toggle','workspace-sidebar-close','reload','logout','chart-mode','growth-metric','report-view','team-scope','team-overview-retry','team-overview-select','range','move-range','metric-focus','platform-focus','channel-detail','member-filter','analysis-content','analysis-view','day','post-detail','refresh','close-modal','comparison-more'].includes(action);
}
document.addEventListener('click',event=>{
  if(!isDemoMode())return;
  const target=event.target.closest?.('[data-action]');
  if(target&&!target.disabled&&['tab','command-tab'].includes(target.dataset.action)&&['messenger','home','workroom','handbook','teaching'].includes(target.dataset.tab)){
    event.preventDefault();event.stopImmediatePropagation();
    // Reload real identity and workspace data before mounting the messenger.
    location.href=target.dataset.tab==='teaching'?demoTeachingUrl():target.dataset.tab==='home'?demoHomeUrl():target.dataset.tab==='workroom'?demoWorkroomUrl():target.dataset.tab==='handbook'?demoHandbookUrl():demoMessengerUrl();return;
  }
  if(target&&!demoAllowsAction(target.dataset.action,target)){
    event.preventDefault();event.stopImmediatePropagation();notify('데모에서는 현황과 그래프를 확인할 수 있어요. 다른 기능은 실제 데이터 화면에서 이용해 주세요.');
  }
  const link=event.target.closest?.('a[href]');
  if(link && /^https?:/.test(link.href) && new URL(link.href).origin!==location.origin){event.preventDefault();event.stopImmediatePropagation();notify('실제 게시물이 아닌 데모용 콘텐츠입니다.');}
},true);
document.addEventListener('change',event=>{
  if(event.target.matches?.('[data-demo-persona]'))location.href=demoScreenUrl(true,event.target.value);
});

function demoDataSummary() {
  const report=state.report, channels=scopedChannels();
  return '<section class="home-panel demo-summary"><span class="demo-badge">DEMO DATA</span><h2>이렇게 가정했어요</h2><p>3명의 크루가 2개 팀에서 6개 채널을 운영하고, 이번 주와 지난주를 비교하고 첫 기록부터 전체 추이를 살펴보는 예시입니다.</p><dl><div><dt>현재 범위 채널</dt><dd>'+number(channels.length)+'개</dd></div><div><dt>콘텐츠</dt><dd>'+number(report?.byPost?.length)+'개</dd></div><div><dt>선택 기간</dt><dd>'+escape(state.start)+'<br>— '+escape(state.end)+'</dd></div></dl><small>전체 추이에서 날짜를 선택하면 그날의 채널별 상세 수치를 볼 수 있습니다.</small></section>';
}

function reportToday() { return isDemoMode() && state.data?.demo?.anchorDate || dateToday(); }
