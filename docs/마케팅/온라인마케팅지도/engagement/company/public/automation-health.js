'use strict';

const automationHealthState={identity:'',request:0,attempted:false,loading:false,data:null,error:'',expanded:{},timer:null,lastAttemptAt:0,refreshFocus:false};
const ahDateFormatter=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const ahCardNumbers={package:1,performance:2,inbox:3,today:4,learning:5,review:6,client:7,links:8,weekly:9,delivery:11,closeout:12,kickoff:13,changes:14,requests:15,schedule:16,deliveryCheck:17,rights:34};
const ahCardIds=Object.keys(ahCardNumbers);
const ahStatuses={idle:'할 일 없음',ready:'준비됨',running:'실행 중',scheduled:'예약됨',paused:'꺼짐',delayed:'지연',failed:'실패',connection:'연결 확인',partial:'일부 확인',manual:'직접 확인',missed:'확인 시각 지남'};
const ahModes={scheduled:'예약 점검','on-demand':'조회·요청 시',manual:'직접 확인'};
const ahStaleCode='post-performance-collector-stale',ahPerformanceHref='/?tab=workroom&section=tools&tool=publication';
function ahUserKey(){return state.user?[state.user.id,state.user.role||'',state.user.teamId||''].join(':'):'';}
function ahStopTimer(){if(automationHealthState.timer!==null)clearTimeout(automationHealthState.timer);automationHealthState.timer=null;}
function automationHealthReset(){ahStopTimer();Object.assign(automationHealthState,{identity:'',request:automationHealthState.request+1,attempted:false,loading:false,data:null,error:'',expanded:{},lastAttemptAt:0,refreshFocus:false});}
function ahIdentity(){const identity=ahUserKey();if(automationHealthState.identity!==identity){automationHealthReset();automationHealthState.identity=identity;}}
function ahVisible(){return !!state.user&&state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools'&&typeof makerTools!=='undefined'&&makerTools.view==='automation'&&!document.hidden;}
function ahSuspend(){ahStopTimer();automationHealthState.refreshFocus=false;if(automationHealthState.loading){automationHealthState.request++;automationHealthState.loading=false;automationHealthState.attempted=false;}}
function ahRender(){
  if(!ahVisible())return;
  const current=automationHealthState,panel=document.querySelector?.('.ah-panel'),active=document.activeElement;
  if(panel&&current.loading&&current.data){
    // Keep the live cards, focus and the rest of the workspace in place while
    // fetching. All actions are delegated on document, so no rebinding is needed.
    current.refreshFocus=active?.dataset?.ahFocus==='refresh';
    panel.setAttribute('aria-busy','true');
    const button=panel.querySelector('[data-ah-action="refresh"]');if(button){button.disabled=true;button.textContent='불러오는 중…';}
    panel.querySelector('.ah-error')?.remove();return;
  }
  const identity=ahUserKey(),main=document.getElementById?.('main'),position=main?{top:main.scrollTop,left:main.scrollLeft}:null,key=active?.dataset?.ahFocus||(!current.loading&&current.refreshFocus&&(!active||active===document.body)?'refresh':null),scroll={x:window.scrollX,y:window.scrollY};
  if(panel)panel.outerHTML=automationHealthPanel();else render();
  if(!current.loading)current.refreshFocus=false;
  if(identity!==ahUserKey()||!ahVisible())return;
  if(key){const target=[...(document.querySelectorAll?.('[data-ah-focus]')||[])].find(node=>node.dataset.ahFocus===key);target?.focus?.({preventScroll:true});}
  if(position){const restored=document.getElementById?.('main');if(restored){restored.scrollTop=position.top;restored.scrollLeft=position.left;}}
  if(Number.isFinite(scroll.x)&&Number.isFinite(scroll.y))window.scrollTo(scroll.x,scroll.y);
}
function automationHealthSync(){
  ahIdentity();if(!ahVisible()){ahSuspend();return;}
  if(automationHealthState.loading||automationHealthState.timer!==null)return;
  const identity=ahUserKey();automationHealthState.timer=setTimeout(()=>{automationHealthState.timer=null;if(identity!==ahUserKey()||!ahVisible())return;void ahLoad();},60000);
}
function automationHealthEnsure(){ahIdentity();if(!ahVisible()){ahSuspend();return;}if(!automationHealthState.loading&&(!automationHealthState.attempted||Date.now()-automationHealthState.lastAttemptAt>=60000))void ahLoad();else automationHealthSync();}
const ahCount=value=>Number.isInteger(value)&&value>=0;
function ahValidProjectGroups(groups){
  if(!Array.isArray(groups))return false;
  const projects=new Set(),items=new Set();
  return groups.every(group=>{
    if(!group||typeof group.projectId!=='string'||!group.projectId||projects.has(group.projectId)||typeof group.projectTitle!=='string'||typeof group.reason!=='string'||!['overdue','today','upcoming','undated','waiting'].includes(group.urgency)||!group.counts||!['total','actionable','waiting','customerWaiting','staffWaiting'].every(key=>ahCount(group.counts[key]))||!Array.isArray(group.items)||!group.items.length)return false;
    projects.add(group.projectId);
    if(!group.items.every(item=>{if(!item||typeof item.id!=='string'||!item.id||items.has(item.id)||item.projectId!==group.projectId||!['reply','review','next','waiting'].includes(item.group))return false;items.add(item.id);return true;}))return false;
    const waiting=group.items.filter(item=>item.group==='waiting').length;
    return group.counts.total===group.items.length&&group.counts.waiting===waiting&&group.counts.actionable===group.items.length-waiting&&(group.primary===null?waiting===group.items.length:group.items.some(item=>item.id===group.primary?.id&&item.group!=='waiting'));
  });
}
function ahValidReport(data){
  if(data?.projectGroups!==undefined&&!(data.projectGroups===null&&typeof data.projectGroupsError==='string'&&data.projectGroupsError.trim())&&!ahValidProjectGroups(data.projectGroups))return false;
  const counts=(value,keys)=>!!value&&typeof value==='object'&&keys.every(key=>ahCount(value[key]))&&['customerWaiting','staffWaiting'].every(key=>value[key]===undefined||ahCount(value[key]));
  const item=value=>!!value&&typeof value==='object'&&typeof value.id==='string'&&!!value.id&&ahCardIds.includes(value.automationId)&&Object.hasOwn(ahStatuses,value.status)&&(value.waitingFor===undefined||['customer','staff'].includes(value.waitingFor));
  return !!data&&typeof data.refreshedAt==='string'&&Number.isFinite(Date.parse(data.refreshedAt))&&Array.isArray(data.cards)&&data.cards.length===ahCardIds.length&&ahCardIds.every(id=>data.cards.filter(card=>card?.id===id&&card.number===ahCardNumbers[id]&&Object.hasOwn(ahModes,card.mode)&&Object.hasOwn(ahStatuses,card.status)&&counts(card.counts,['targets','issues','manual','paused'])).length===1)&&Array.isArray(data.issues)&&data.issues.every(item)&&Array.isArray(data.manual)&&data.manual.every(item)&&counts(data.counts,['issues','manual','running','paused','partial']);
}
async function ahLoad(){
  ahIdentity();if(!ahVisible()||automationHealthState.loading)return false;
  const current=automationHealthState,identity=ahUserKey(),request=++current.request;ahStopTimer();current.loading=true;current.attempted=true;current.lastAttemptAt=Date.now();current.error='';ahRender();
  const alive=()=>identity===ahUserKey()&&identity===current.identity&&request===current.request&&ahVisible();
  try{const data=await api('/api/automation-health');if(!alive())return false;if(!ahValidReport(data))throw new Error('자동화 상태의 형식을 확인하지 못했어요. 다시 불러와 주세요.');current.data=data;return true;}
  catch(error){if(alive()){current.error=error?.message||'자동화 상태를 불러오지 못했어요.';if([401,403,404].includes(error?.status))current.data=null;}return false;}
  finally{if(alive()){current.loading=false;ahRender();automationHealthSync();}}
}
function ahDate(value){const date=typeof value==='string'&&value?new Date(value):null;return date&&Number.isFinite(date.getTime())?ahDateFormatter.format(date):'시각 미확인';}
function ahHref(value){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||/[\u0000-\u0020]/.test(value)||value.length>1800)return '';
  let url;try{url=new URL(value,location.origin);}catch{return '';}
  if(url.origin!==location.origin||url.pathname!=='/'||url.username||url.password||url.search&&url.hash)return '';
  const params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),keys=[...params.keys()];if(new Set(keys).size!==keys.length||params.has('view')&&params.has('tab'))return '';
  if(params.get('tab')==='home'&&keys.length===1)return value;
  if(params.get('tab')==='workroom'&&params.get('section')==='tools'&&['weekly','publication'].includes(params.get('tool'))&&keys.length===3&&keys.every(key=>['tab','section','tool'].includes(key)))return value;
  if(params.get('tab')==='workroom'&&params.get('section')==='clients'&&keys.length===2&&keys.every(key=>['tab','section'].includes(key)))return value;
  return typeof wksHref==='function'?wksHref(value):'';
}
// 2. 게시 후 성과 is a view inside publication-flow.js; switch it the way its own tab button does.
function ahShowPerformance(){if(typeof pf==='undefined')return;if(typeof pfIdentity==='function')pfIdentity();pf.view='performance';}
async function ahOpenSource(value,view=''){
  const href=ahHref(value);if(!href||!state.user)return false;
  const url=new URL(href,location.origin),params=new URLSearchParams(url.hash?url.hash.slice(1):url.search);
  if(params.get('tab')==='home'){selectWorkspaceView('home');render();window.scrollTo(0,0);return true;}
  if(params.get('tab')==='workroom'&&params.get('section')==='clients'&&!params.has('project')){selectWorkspaceView('workroom','clients');render();window.scrollTo(0,0);return true;}
  if(params.get('tab')==='workroom'&&params.get('section')==='tools'&&!params.has('publicationAction')){makerTools.view=params.get('tool');if(view==='performance'&&makerTools.view==='publication')ahShowPerformance();selectWorkspaceView('workroom','tools');render();makerToolsEnsure();window.scrollTo(0,0);return true;}
  return typeof wksOpenSource==='function'?wksOpenSource(href):false;
}
function ahSource(value,key){const href=ahHref(value);return href?`<a class="ah-source" href="${escape(href)}" data-ah-source="${escape(href)}" data-ah-focus="${escape(key)}">원문 바로가기 <span aria-hidden="true">↗</span></a>`:'';}
function ahItems(items){const seen=new Set();return items.filter(item=>{const key=item.automationId+':'+item.id;if(seen.has(key))return false;seen.add(key);return true;});}
const ahStale=item=>item?.code===ahStaleCode;
// A stopped collector explains the per-post delays listed with it, so it stays first, never under 「나머지 보기」.
const ahPinStale=items=>[...items.filter(ahStale),...items.filter(item=>!ahStale(item))];
// since and affectedEntries can be missing or empty; the warning then stays, without a start time or count.
function ahStaleItem(item){
  const since=typeof item.since==='string'&&Number.isFinite(Date.parse(item.since))?ahDate(item.since):'',entries=Array.isArray(item.affectedEntries)?new Set(item.affectedEntries.filter(id=>typeof id==='string'&&id.trim())).size:0;
  return `<li class="ah-stale" data-ah-item="${escape(item.automationId+':'+item.id)}"><div class="ah-item-top"><span class="ah-badge" data-status="${escape(item.status)}">수집 멈춤</span></div><strong>게시 성과 자동 수집이 ${since?escape(since)+'부터 ':''}멈춰 있어요${entries?` · 영향 게시물 ${entries}개`:''}</strong><p>관측 시각이 지났는데 수집기가 정상적으로 끝난 기록이 없어요. 서버의 자동 수집 상태 확인이 필요해요. 관측 기간이 끝나기 전에 게시 후 성과에서 게시물별로 수집 상태를 확인하고, 필요한 숫자는 직접 보완해 주세요.</p><a class="ah-source" href="${escape(ahPerformanceHref)}" data-ah-source="${escape(ahPerformanceHref)}" data-ah-view="performance" data-ah-focus="${escape('item:'+item.automationId+':'+item.id)}">게시 후 성과 열기 <span aria-hidden="true">↗</span></a></li>`;
}
function ahItemList(items,group){return `<ul class="ah-items">${items.slice(0,3).map(ahItem).join('')}</ul>${items.length>3?`<details class="ah-more" data-ah-group="${group}" ${automationHealthState.expanded[group]?'open':''}><summary data-ah-focus="more:${group}">나머지 ${items.length-3}건 보기</summary><ul class="ah-items">${items.slice(3).map(ahItem).join('')}</ul></details>`:''}`;}
function ahItem(item){if(ahStale(item))return ahStaleItem(item);return `<li data-ah-item="${escape(item.automationId+':'+item.id)}"><div class="ah-item-top"><span class="ah-badge" data-status="${escape(item.status)}">${escape(item.statusLabel||ahStatuses[item.status])}</span>${item.dueAt?`<span>예정 ${escape(ahDate(item.dueAt))}</span>`:item.occurredAt?`<span>${escape(ahDate(item.occurredAt))}</span>`:''}</div><strong>${escape(item.title||'확인할 작업')}</strong>${item.text?`<p>${escape(item.text)}</p>`:''}${ahSource(item.href,'item:'+item.automationId+':'+item.id)}</li>`;}
function ahTime(label,value,empty='기록 없음'){return `<div><dt>${escape(label)}</dt><dd>${escape(value?ahDate(value):empty)}</dd></div>`;}
function ahProjectItem(item,primary=false){
  const waiting=item.group==='waiting',label=item.statusLabel||(waiting?'답변·확인 대기':({reply:'답할 요청',review:'검토할 결과',next:'다음 단계'}[item.group]));
  return `<li class="ah-project-item${primary?' ah-project-primary':''}" data-ah-project-item="${escape(item.id)}"><span class="ah-badge" data-status="${waiting?'idle':'manual'}">${escape(label)}</span><strong>${escape(item.title||'확인할 작업')}</strong>${item.dueDate?`<span class="ah-project-date">기한 ${escape(item.dueDate)}</span>`:''}${item.text?`<p>${escape(item.text)}</p>`:''}${ahSource(item.href,'project-item:'+item.id)}</li>`;
}
function ahProjectGroups(data){
  if(data.projectGroups===undefined)return '';
  if(data.projectGroupsError)return `<section class="ah-project-section" aria-labelledby="ah-projects-title"><h3 id="ah-projects-title">프로젝트별 먼저 할 일</h3><p class="ah-warning" role="alert">${escape(data.projectGroupsError)} 할 일이 없는 상태와는 달라요.</p></section>`;
  const groups=data.projectGroups,total=groups.reduce((sum,group)=>sum+group.counts.total,0);
  return `<section class="ah-project-section" aria-labelledby="ah-projects-title"><header><h3 id="ah-projects-title">프로젝트별 먼저 할 일</h3><span>${groups.length}개 프로젝트 · 할 일 항목 ${total}개</span></header><p class="ah-section-note">오늘 할 일에 모인 고객 업무를 프로젝트별로 묶었어요. 먼저 처리할 이유와 같은 프로젝트의 나머지 업무를 함께 확인하세요. 아래 자동화 점검 목록과는 집계 범위가 다릅니다.</p>${groups.length?`<div class="ah-projects">${groups.map(group=>{
    const primary=group.primary&&group.items.find(item=>item.id===group.primary.id),related=group.items.filter(item=>item.id!==primary?.id&&item.group!=='waiting'),waiting=group.items.filter(item=>item.group==='waiting'),key='project:'+group.projectId,labels={overdue:'기한 지남',today:'오늘 기한',upcoming:'이후 기한',undated:'기한 미정',waiting:'대기 중'};
    return `<article class="ah-project" data-ah-project="${escape(group.projectId)}"><header><h4>${escape(group.projectTitle||'고객 프로젝트')}</h4><span class="ah-badge" data-status="${group.urgency==='overdue'?'delayed':'idle'}">${labels[group.urgency]}</span></header><p class="ah-project-counts">할 일 항목 ${group.counts.total}개 · 처리할 일 ${group.counts.actionable}개 · 대기 ${group.counts.waiting}개</p>${primary?`<p class="ah-project-reason"><strong>먼저 할 일</strong> ${escape(group.reason)}</p><ul class="ah-items ah-project-items">${ahProjectItem(primary,true)}</ul>`:`<p class="ah-project-reason">${escape(group.reason||'고객 또는 내부 담당자의 답변·승인을 기다리고 있어요. 지금 처리할 일은 없어요.')}</p>`}${related.length||waiting.length?`<details class="ah-more ah-project-related" data-ah-group="${escape(key)}" ${automationHealthState.expanded[key]?'open':''}><summary data-ah-focus="more:${escape(key)}">${primary?'같은 프로젝트의 나머지':'대기 중인'} ${related.length+waiting.length}개 항목 보기</summary>${related.length?`<h5>함께 처리할 일 ${related.length}개</h5><ul class="ah-items ah-project-items">${related.map(item=>ahProjectItem(item)).join('')}</ul>`:''}${waiting.length?`<h5>답변·확인 대기 ${waiting.length}개</h5><ul class="ah-items ah-project-items">${waiting.map(item=>ahProjectItem(item)).join('')}</ul>`:''}</details>`:''}</article>`;
  }).join('')}</div>`:'<p class="ah-empty">오늘 할 일에 모인 고객 프로젝트 업무가 없어요.</p>'}</section>`;
}
function ahMonitor(monitor){
  if(!monitor)return '<p class="ah-snapshot">알림 점검 상태를 확인하지 못했어요.</p>';
  const status=monitor.enabled===false?'자동 알림 점검이 꺼져 있어요. 이 화면에서는 현재 상태를 확인할 수 있어요.':monitor.status==='enabled'?'서버 실행 중 1분마다 점검 · 문제가 생기면 메신저 알림에서 확인':monitor.status==='error'?'알림 점검 중 일부 상태를 확인하지 못했어요.':'첫 알림 점검을 기다리고 있어요.';
  return `<p class="ah-snapshot" data-ah-monitor>${escape(status)}<br>작업실 안에서만 알림 · 같은 문제는 반복 알림 없이 유지${monitor.lastScanAt?' · 최근 점검 '+escape(ahDate(monitor.lastScanAt)):''}</p>`;
}
function ahCard(card){
  const scheduled=card.mode==='scheduled',off=card.status==='paused',nextEmpty=off?'예약 꺼짐':scheduled?'다음 점검 시각 미확인':card.mode==='manual'?'직접 확인할 때':'조회·요청할 때';
  const times=scheduled?ahTime('최근 시도',card.lastAttemptAt)+ahTime(card.lastSuccessLabel||'최근 정상 점검',card.lastSuccessAt)+ahTime(card.lastResultLabel||'최근 내 결과',card.lastResultAt)+ahTime('다음 점검',off?null:card.nextRunAt,nextEmpty):ahTime('최근 상태 조회',card.checkedAt,'조회 기록 없음')+ahTime(card.lastResultLabel||card.lastSuccessLabel||'최근 내 결과',card.lastResultAt,'결과 기록 없음')+ahTime('실행 시점',null,nextEmpty);
  return `<article class="ah-card" data-ah-card="${escape(card.id)}"><header><div><span class="ah-mode">${card.number}번 · ${escape(ahModes[card.mode])}</span><h4>${escape(card.title||'자동화 상태')}</h4></div><span class="ah-badge" data-status="${escape(card.status)}">${escape(card.statusLabel||ahStatuses[card.status])}</span></header>${card.text?`<p>${escape(card.text)}</p>`:''}<dl class="ah-times">${times}${ahTime(scheduled?'대상 처리 예정':'다음 확인 기한',card.nextDueAt,scheduled?'등록된 예정 없음':'등록된 기한 없음')}</dl><div class="ah-card-counts"><span>대상 ${card.counts.targets}</span><span>문제 ${card.counts.issues}</span><span>직접 확인 ${card.counts.manual}</span>${card.counts.paused?`<span>꺼짐 ${card.counts.paused}</span>`:''}${card.counts.customerWaiting?`<span class="ah-wait-count">고객 확인 대기 ${card.counts.customerWaiting}</span>`:''}${card.counts.staffWaiting?`<span class="ah-wait-count">담당자 확인 ${card.counts.staffWaiting}</span>`:''}</div>${(card.counts.customerWaiting||0)+(card.counts.staffWaiting||0)>card.counts.manual?'<p class="ah-count-note">같은 프로젝트가 고객과 담당자의 확인을 함께 기다릴 수 있어요.</p>':''}${ahSource(card.href,'card:'+card.id)}</article>`;
}
function automationHealthPanel(){
  ahIdentity();const current=automationHealthState,data=current.data,issues=data?ahPinStale(ahItems(data.issues)):[],issueIds=new Set(issues.map(item=>item.automationId+':'+item.id)),manual=data?ahItems(data.manual).filter(item=>!issueIds.has(item.automationId+':'+item.id)):[],partial=!!data&&(data.counts.partial>0||data.cards.some(card=>card.status==='partial'));
  return `<section class="ah-panel" aria-labelledby="ah-title" aria-busy="${current.loading}"><div class="ah-heading"><div><span class="wr-kicker">내 작업의 자동화</span><h2 id="ah-title">자동화 상태</h2><p>지금 막힌 일과 직접 확인할 일을 먼저 확인하세요.</p></div><button type="button" class="btn small quiet" data-ah-action="refresh" data-ah-focus="refresh" ${current.loading?'disabled':''}>${current.loading?'불러오는 중…':'새로고침'}</button></div>${current.error?`<div class="ah-error" role="alert">${escape(current.error)}${data?'<span>아래는 마지막으로 불러온 상태예요. 최신 상태는 다시 확인해 주세요.</span>':''}</div>`:''}${!data?`<div class="ah-loading" role="status">${current.loading?'<span class="loading-line"></span><p>현재 작업 상태를 확인하고 있어요.</p>':current.error?'<p>상태를 확인하지 못했어요. 문제가 없는 상태와는 달라요.</p>':'<p>자동화 상태를 불러옵니다.</p>'}</div>`:`<p class="ah-snapshot">확인 ${escape(ahDate(data.refreshedAt))} · 한국 시간 · 본인이 볼 수 있는 작업 기준</p>${ahMonitor(data.monitor)}<div class="ah-summary" aria-label="현재 자동화 상태 요약"><div><span>지금 조치할 문제</span><strong>${issues.length}<small>건</small></strong></div><div><span>직접 확인 필요</span><strong>${manual.length}<small>건</small></strong></div><div><span>실행 중</span><strong>${data.counts.running}<small>개</small></strong></div><div><span>꺼짐</span><strong>${data.counts.paused}<small>개</small></strong></div></div>${partial?'<p class="ah-warning" role="status">일부 상태를 확인하지 못했어요. 표시된 문제가 전체가 아닐 수 있어요.</p>':''}<div class="ah-attention"><section aria-labelledby="ah-issues-title"><header><h3 id="ah-issues-title">지금 조치할 문제</h3><span>${issues.length}건</span></header><p class="ah-section-note">원문에서 해결하면 다음 상태 확인 때 이 목록에서 빠집니다.</p>${issues.length?`${ahItemList(issues,'issues')}`:`<p class="ah-empty">${partial?'현재 불러온 항목에는 조치할 문제가 없어요. 확인하지 못한 상태는 아래에서 살펴보세요.':'현재 조치할 문제로 표시된 항목이 없어요.'}</p>`}</section><section aria-labelledby="ah-manual-title"><header><h3 id="ah-manual-title">직접 확인할 일</h3><span>${manual.length}건</span></header><p class="ah-section-note">고객 회신·담당자 승인·로그인·실제 시청처럼 사람의 확인이 필요한 항목입니다. 시스템 실행 실패와 구분합니다.</p>${manual.length?`${ahItemList(manual,'manual')}`:`<p class="ah-empty">${partial?'불러온 항목에는 직접 확인할 일이 없어요. 일부 상태는 확인하지 못했어요.':'현재 직접 확인할 항목이 없어요.'}</p>`}</section></div>${ahProjectGroups(data)}<section class="ah-all" aria-labelledby="ah-all-title"><h3 id="ah-all-title">연결된 자동화 ${ahCardIds.length}개</h3><p class="ah-section-note">게시·운영 1~9번, 고객 제작 11~17번과 자료 사용기한 34번의 상태를 모아 봅니다. 10번은 이 상태 화면입니다. 최근 정상 점검은 개별 결과의 성공과 다릅니다. 조회 시각·실제 결과·예약 점검을 나누어 표시합니다.</p><div class="ah-cards">${ahCardIds.map(id=>ahCard(data.cards.find(card=>card.id===id))).join('')}</div></section>`}<footer class="ah-footer">${escape(data?.note||'이 화면은 현재 상태를 읽습니다. 필요한 작업은 원문에서 이어서 확인하세요.')}</footer></section>`;
}
document.addEventListener('click',async event=>{
  queueMicrotask(automationHealthSync);
  const source=event.target.closest?.('[data-ah-source]');if(source){if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();try{await ahOpenSource(source.dataset.ahSource,source.dataset.ahView);}catch(error){notify(error.message);}return;}
  const target=event.target.closest?.('[data-ah-action]');if(target&&!target.disabled&&state.user&&target.dataset.ahAction==='refresh')await ahLoad();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)ahSuspend();else if(ahVisible())automationHealthEnsure();});
document.addEventListener('toggle',event=>{const group=event.target?.dataset?.ahGroup;if((['issues','manual'].includes(group)||automationHealthState.data?.projectGroups?.some(item=>'project:'+item.projectId===group))&&ahVisible())automationHealthState.expanded[group]=event.target.open;},true);
