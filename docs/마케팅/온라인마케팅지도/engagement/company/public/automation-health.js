'use strict';
// 자동화 상태 — 제작 도구 B 「먼저 할 일 판」(13판, 2026-10-20). 머리(포스터 · 계기판) → 알림 줄 → 01 조치할 문제 · 02 사람 차례
// → (프로젝트별 먼저 할 일, 전폭) → 자동화 n개 한 줄 표(이상 없는 것은 접는다, 줄을 누르면 그 아래 사실 칸과 하는 일).
// 그리기 도우미(mtHead · mtMeter · mtBlock · mtBadge · mtLed …)는 maker-tools.js 앞 절반에 있다. 서버 응답(cards · issues · manual ·
// counts · projectGroups · monitor · note)만 보이고, 서버가 준 글(statusLabel · title · text · 칸 이름)은 그대로 쓴다.

const automationHealthState={identity:'',request:0,attempted:false,loading:false,data:null,error:'',expanded:{},timer:null,lastAttemptAt:0,refreshFocus:false};
const ahDateFormatter=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
// 서버 계약(카드 id와 번호)은 응답 검사에만 쓴다 — 화면에는 내부 번호를 보이지 않는다.
const ahCardNumbers={package:1,performance:2,inbox:3,today:4,learning:5,review:6,client:7,links:8,weekly:9,delivery:11,closeout:12,kickoff:13,changes:14,requests:15,schedule:16,deliveryCheck:17,rights:34};
const ahCardIds=Object.keys(ahCardNumbers);
// 서버 statusLabel이 비었을 때만 쓰는 이름(서버의 새 상태 이름과 같게).
const ahStatuses={idle:'할 일 없음',ready:'준비됨',running:'확인 중',scheduled:'예약됨',paused:'꺼짐',delayed:'늦음',failed:'실패',connection:'연결 끊김',partial:'일부만 확인',manual:'사람 차례',missed:'시각 지남'};
const ahModes={scheduled:'예약','on-demand':'열 때',manual:'직접 확인'};
// 「도는 때」: 서버 예약 작업의 실제 주기(server.mjs runtimeJob · 주간 정리 schedule)만. 열 때 계산하는 것은 「열 때」, 사람이 하는 것은 「직접 확인」.
const ahCadences={performance:'1분마다 확인',links:'1분마다 확인',deliveryCheck:'1분마다 확인',inbox:'5초마다 확인',weekly:'매주 월요일'};
const ahProblemStates=['failed','delayed','connection','missed'];
const ahGroups=[{id:'problem',label:'멈춤',tone:'alert'},{id:'manual',label:'직접 확인',tone:'wait'},{id:'partial',label:'일부만 확인',tone:'info'},{id:'off',label:'꺼짐',tone:'off'},{id:'ok',label:'이상 없음',tone:'ok'}];
const ahUrgency={overdue:['기한 지남','wait'],today:['오늘 기한','wait'],upcoming:['이후 기한',''],undated:['기한 없음',''],waiting:['기다리는 중','info']};
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
    // Keep the live board, focus and the rest of the workspace in place while
    // fetching. All actions are delegated on document, so no rebinding is needed.
    current.refreshFocus=active?.dataset?.ahFocus==='refresh';
    panel.setAttribute('aria-busy','true');
    const button=panel.querySelector('[data-ah-action="refresh"]');if(button){button.disabled=true;button.setAttribute?.('aria-label','불러오는 중');}
    const stamp=panel.querySelector('[data-ah-checked]');if(stamp)stamp.textContent='불러오는 중…';
    panel.querySelector('.mt-error')?.remove();return;
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
  try{const data=await api('/api/automation-health');if(!alive())return false;if(!ahValidReport(data))throw new Error('받은 자동화 상태의 형식이 맞지 않아요. 새로고침해 주세요.');current.data=data;return true;}
  catch(error){if(alive()){current.error=error?.message||'자동화 상태를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.';if([401,403,404].includes(error?.status))current.data=null;}return false;}
  finally{if(alive()){current.loading=false;ahRender();automationHealthSync();}}
}
// 날짜 칸: 전체 표기(시각 위에 올리면 보이는 title)와 짧은 표기. 한국 시간에는 서머타임이 없어 9시간을 더해 읽는다.
function ahDate(value){const date=typeof value==='string'&&value?new Date(value):null;return date&&Number.isFinite(date.getTime())?ahDateFormatter.format(date):'시각 미확인';}
function ahKst(value){const time=typeof value==='string'&&value?Date.parse(value):NaN;return Number.isFinite(time)?new Date(time+9*3600000):null;}
const ahPad=value=>String(value).padStart(2,'0');
function ahClock(value){const date=ahKst(value);return date?`${ahPad(date.getUTCHours())}:${ahPad(date.getUTCMinutes())}`:'';}
// 마지막으로 읽은 날과 같은 날이면 시각만, 아니면 날짜와 시각.
// 날짜만 있는 값(2026-10-20)은 그 날짜 그대로, 서버가 날짜를 한국 자정으로 잡아 보낸 값(연락일 · 만료일처럼 초 · 밀리초까지 0)은 날짜만 —
// 자정 무렵 실제로 돈 기록(00:00:41 같은)은 시각까지 보인다.
function ahDayText(date,base){return `${base&&base.getUTCFullYear()!==date.getUTCFullYear()?date.getUTCFullYear()+'년 ':''}${date.getUTCMonth()+1}월 ${date.getUTCDate()}일`;}
function ahWhen(value){
  const base=ahKst(automationHealthState.data?.refreshedAt);
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){const day=new Date(value+'T00:00:00Z');return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===value?ahDayText(day,base):'';}
  const date=ahKst(value);if(!date)return '';
  if(!date.getUTCHours()&&!date.getUTCMinutes()&&!date.getUTCSeconds()&&!date.getUTCMilliseconds())return ahDayText(date,base);
  return base&&base.toISOString().slice(0,10)===date.toISOString().slice(0,10)?ahClock(value):`${ahDayText(date,base)} ${ahClock(value)}`;
}
function ahDueDay(value){const date=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T00:00:00Z'):null;return date&&Number.isFinite(date.getTime())?`${date.getUTCMonth()+1}월 ${date.getUTCDate()}일 (${'일월화수목금토'[date.getUTCDay()]})`:'';}
function ahHref(value){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||/[\u0000-\u0020]/.test(value)||value.length>1800)return '';
  let url;try{url=new URL(value,location.origin);}catch{return '';}
  if(url.origin!==location.origin||url.pathname!=='/'||url.username||url.password||url.search&&url.hash)return '';
  const params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),keys=[...params.keys()];if(new Set(keys).size!==keys.length||params.has('view')&&params.has('tab'))return '';
  if(params.get('tab')==='home'&&keys.length===1)return value;
  if(params.get('tab')==='workroom'&&params.get('section')==='tools'&&['weekly','publication','inquiries'].includes(params.get('tool'))&&keys.length===3&&keys.every(key=>['tab','section','tool'].includes(key)))return value;
  if(params.get('tab')==='workroom'&&params.get('section')==='clients'&&keys.length===2&&keys.every(key=>['tab','section'].includes(key)))return value;
  return typeof wksHref==='function'?wksHref(value):'';
}
// 링크가 여는 화면의 이름(단추 글자) — 이미 ahHref를 통과한 주소만 받는다.
function ahDest(href){
  if(!href)return '';let params;try{const url=new URL(href,location.origin);params=new URLSearchParams(url.hash?url.hash.slice(1):url.search);}catch{return '';}
  const tab=params.get('tab')||params.get('view'),tool=params.get('tool');
  return tab==='home'?'홈':tab==='messenger'?'메신저':tab==='content'?'기획':params.get('section')==='clients'?'고객 관리':['weekly','publication'].includes(tool)?'SNS 성과':'';
}
// 게시 준비·성과 has no performance tab any more: pf.view='performance' asks publication-flow.js (pfHonorView) to open a posted episode.
function ahShowPerformance(){if(typeof pf==='undefined')return;if(typeof pfIdentity==='function')pfIdentity();pf.view='performance';}
async function ahOpenSource(value,view=''){
  const href=ahHref(value);if(!href||!state.user)return false;
  const url=new URL(href,location.origin),params=new URLSearchParams(url.hash?url.hash.slice(1):url.search);
  if(params.get('tab')==='home'){selectWorkspaceView('home');render();window.scrollTo(0,0);return true;}
  if(params.get('tab')==='workroom'&&params.get('section')==='clients'&&!params.has('project')){selectWorkspaceView('workroom','clients');render();window.scrollTo(0,0);return true;}
  if(params.get('tab')==='workroom'&&params.get('section')==='tools'&&['weekly','publication'].includes(params.get('tool'))){selectWorkspaceView('social','results');render();window.scrollTo(0,0);return true;}
  if(params.get('tab')==='workroom'&&params.get('section')==='tools'&&!params.has('publicationAction')){makerTools.view=params.get('tool');if(view==='performance'&&makerTools.view==='publication')ahShowPerformance();selectWorkspaceView('workroom','tools');render();makerToolsEnsure();window.scrollTo(0,0);return true;}
  return typeof wksOpenSource==='function'?wksOpenSource(href):false;
}
function ahLink(value,focus,{label='열기',primary=false,view=''}={}){const href=ahHref(value);return href?`<a class="${primary?'btn small primary':'mt-link'}" href="${escape(href)}" data-ah-source="${escape(href)}"${view?` data-ah-view="${escape(view)}"`:''} data-ah-focus="${escape(focus)}">${escape(label)}</a>`:'';}
function ahItems(items){const seen=new Set();return items.filter(item=>{const key=item.automationId+':'+item.id;if(seen.has(key))return false;seen.add(key);return true;});}
const ahStale=item=>item?.code===ahStaleCode;
// A stopped collector explains the per-post delays listed with it, so it stays first, never under 「나머지 보기」.
const ahPinStale=items=>[...items.filter(ahStale),...items.filter(item=>!ahStale(item))];
function ahLists(data){const issues=ahPinStale(ahItems(data.issues)),ids=new Set(issues.map(item=>item.automationId+':'+item.id));return {issues,manual:ahItems(data.manual).filter(item=>!ids.has(item.automationId+':'+item.id))};}
function ahCardTitle(id){return automationHealthState.data?.cards?.find(card=>card.id===id)?.title||'';}
function ahGroupOf(card){return ahProblemStates.includes(card.status)?'problem':card.status==='manual'?'manual':card.status==='partial'?'partial':card.status==='paused'?'off':'ok';}
function ahGroupCounts(cards){const counts=Object.fromEntries(ahGroups.map(group=>[group.id,0]));for(const card of cards)counts[ahGroupOf(card)]++;return counts;}
function ahCadence(card){return card.status==='paused'?'꺼짐':card.mode==='scheduled'?ahCadences[card.id]||'자동 확인':card.mode==='manual'?'직접 확인':'열 때';}
function ahFirstSentence(text){const value=String(text||'').trim(),match=value.match(/^.+?[.!?](?=\s|$)/);return match?match[0]:value;}
function ahMore(group,inner,count){return `<details class="mt-fold ah-more" data-ah-group="${escape(group)}"${automationHealthState.expanded[group]?' open':''}><summary data-ah-focus="more:${escape(group)}">나머지 ${count}건 보기</summary><div class="ah-more-body">${inner}</div></details>`;}
// 01 조치할 문제 — 카드. 화면의 검은 단추는 첫 카드 하나에만.
function ahJob({key,cls='',title,badge,meta,body,action}){
  const parts=meta.filter(Boolean);
  return `<article class="mt-job is-alert${cls?' '+cls:''}" data-ah-item="${escape(key)}"><span class="mt-led mt-job-led" data-tone="alert" aria-hidden="true"></span><div class="mt-job-main"><div class="mt-job-top"><h3>${escape(title)}</h3>${badge}</div>${parts.length?`<div class="mt-job-meta">${parts.map(part=>`<span>${escape(part)}</span>`).join('<span aria-hidden="true">·</span>')}</div>`:''}${body?`<p class="mt-job-body">${body}</p>`:''}${action?`<div class="mt-actions">${action}</div>`:''}</div></article>`;
}
// since and affectedEntries can be missing or empty; the warning then stays, without a start time or count.
function ahIssue(item,primary){
  const key=item.automationId+':'+item.id,focus='item:'+key,source=ahCardTitle(item.automationId);
  if(ahStale(item)){
    const since=typeof item.since==='string'&&Number.isFinite(Date.parse(item.since))?ahWhen(item.since):'',entries=Array.isArray(item.affectedEntries)?new Set(item.affectedEntries.filter(id=>typeof id==='string'&&id.trim())).size:0;
    const action=`<a class="${primary?'btn small primary':'mt-link'}" href="${escape(ahPerformanceHref)}" data-ah-source="${escape(ahPerformanceHref)}" data-ah-view="performance" data-ah-focus="${escape(focus)}">게시 준비·성과 열기</a>`;
    return ahJob({key,cls:'ah-stale',title:`게시 성과 자동 수집이 ${since?since+'부터 ':''}멈춰 있어요`,badge:mtBadge('멈춤','alert'),meta:[source,entries?`영향 받은 편 ${entries}`:''],body:`<span>${escape(since?since+' 뒤로 ':'')}자동 수집이 끝난 기록이 없어요.</span> <span class="mt-hide-sm">서버 쪽 수집을 확인하는 동안, 게시 준비·성과에서 편마다 수집 상태를 보고 필요한 숫자는 직접 넣어요.</span>`,action});
  }
  const href=ahHref(item.href),dest=ahDest(href),when=item.occurredAt?ahWhen(item.occurredAt):item.dueAt?ahWhen(item.dueAt):'';
  return ahJob({key,title:item.title||'제목 없는 기록',badge:mtBadge(item.statusLabel||ahStatuses[item.status]||'확인 필요','alert'),meta:[source,when],body:escape(item.text||''),action:ahLink(item.href,focus,{label:primary&&dest?dest+' 열기':'열기',primary})});
}
function ahIssueList(items){return items.slice(0,3).map((item,index)=>ahIssue(item,index===0)).join('')+(items.length>3?ahMore('issues',items.slice(3).map(item=>ahIssue(item,false)).join(''),items.length-3):'');}
// 02 사람 차례 — LED 줄. 「편 제목」 + 서버 상태 이름, 아래에 어느 자동화의 일인지와 서버 안내 한 줄.
function ahManual(item){
  const key=item.automationId+':'+item.id,customer=item.waitingFor==='customer',label=item.statusLabel||ahStatuses[item.status]||'사람 차례';
  const meta=[ahCardTitle(item.automationId),item.text].filter(Boolean).join(' · ');
  return `<li class="mt-issue" data-ah-item="${escape(key)}">${mtLed(customer?'info':'wait',customer?'고객 차례':'사람 차례')}<div><strong>${escape(item.title?`「${item.title}」 ${label}`:label)}</strong>${meta?`<p>${escape(meta)}</p>`:''}</div>${ahLink(item.href,'item:'+key)}</li>`;
}
function ahManualList(items){
  const ordered=[...items.filter(item=>item.waitingFor!=='customer'),...items.filter(item=>item.waitingFor==='customer')],shown=ordered.length>4?3:ordered.length;
  return `<ul class="ah-rows">${ordered.slice(0,shown).map(ahManual).join('')}</ul>${ordered.length>shown?ahMore('manual',`<ul class="ah-rows">${ordered.slice(shown).map(ahManual).join('')}</ul>`,ordered.length-shown):''}`;
}
function ahProjectItem(item,primary=false){
  const waiting=item.group==='waiting',label=item.statusLabel||(waiting?'답을 기다리는 중':({reply:'답할 요청',review:'검토할 결과',next:'다음 단계'}[item.group]||'할 일'));
  return `<li class="mt-issue${primary?' is-primary':''}" data-ah-project-item="${escape(item.id)}">${mtLed(waiting?'info':'wait')}<div><strong>${escape(item.title||'제목 없는 할 일')}</strong><p>${escape(label)}${item.dueDate&&ahDueDay(item.dueDate)?` · 기한 ${escape(ahDueDay(item.dueDate))}`:''}</p></div>${ahLink(item.href,'project-item:'+item.id)}</li>`;
}
function ahProject(group){
  const primary=group.primary&&group.items.find(item=>item.id===group.primary.id),related=group.items.filter(item=>item.id!==primary?.id&&item.group!=='waiting'),waiting=group.items.filter(item=>item.group==='waiting'),key='project:'+group.projectId,[urgency,tone]=ahUrgency[group.urgency]||['',''],rest=related.length+waiting.length;
  return `<article class="ah-project" data-ah-project="${escape(group.projectId)}"><div class="ah-project-head"><h3>${escape(group.projectTitle||'고객 프로젝트')}</h3>${mtBadge(urgency,tone)}</div><p class="ah-project-reason">${escape(group.reason||(primary?'':'고객이나 담당자의 답을 기다려요. 지금 할 일은 없어요.'))}</p>${primary?`<ul class="ah-rows">${ahProjectItem(primary,true)}</ul>`:''}${rest?`<details class="mt-fold ah-more" data-ah-group="${escape(key)}"${automationHealthState.expanded[key]?' open':''}><summary data-ah-focus="more:${escape(key)}">${primary?`같은 프로젝트의 나머지 ${rest}개`:`기다리는 일 ${rest}개`}</summary><div class="ah-more-body">${related.length?`<h4>함께 할 일 ${related.length}개</h4><ul class="ah-rows">${related.map(item=>ahProjectItem(item)).join('')}</ul>`:''}${waiting.length?`<h4>답을 기다리는 일 ${waiting.length}개</h4><ul class="ah-rows">${waiting.map(item=>ahProjectItem(item)).join('')}</ul>`:''}</div></details>`:''}</article>`;
}
function ahProjects(data,next){
  if(data.projectGroups===undefined)return '';
  if(data.projectGroupsError)return mtBlock({num:next(),title:'프로젝트별 먼저 할 일',attrs:'data-ah-block="projects"',body:`<p class="mt-error is-soft" role="alert">${escape(data.projectGroupsError)} 할 일이 없다는 뜻은 아니에요.</p>`});
  const groups=data.projectGroups;if(!groups.length)return '';
  const total=groups.reduce((sum,group)=>sum+group.counts.total,0);
  return mtBlock({num:next(),title:'프로젝트별 먼저 할 일',count:groups.length,desc:`오늘 할 일에 모인 고객 업무를 프로젝트별로 묶었어요(프로젝트 ${groups.length}개 · 할 일 ${total}개). 자동화 목록과 세는 기준이 달라요.`,attrs:'data-ah-block="projects"',body:groups.map(ahProject).join('')});
}
// 알림 줄: 서버 monitor 값대로. 주기는 서버가 준 intervalMs에서만 읽는다.
function ahEvery(ms){return Number.isFinite(ms)&&ms>0?ms%60000===0?`${ms/60000}분마다`:ms%1000===0?`${ms/1000}초마다`:'':'';}
// 글은 한 칸(span)에 담는다 — 알림 줄은 flex라 글 조각이 따로 칸이 되면 사이가 벌어진다.
function ahNoticeLine(tone,text,attrs='data-ah-monitor'){return `<p class="mt-notice"${tone?` data-tone="${tone}"`:''} ${attrs}><span>${text}</span></p>`;}
function ahNotice(monitor){
  if(!monitor)return ahNoticeLine('off','알림 상태를 읽지 못했어요.');
  if(monitor.enabled===false||monitor.status==='disabled')return ahNoticeLine('off','알림 꺼짐 · 문제가 생겨도 메신저로 알리지 않아요. 상태는 이 화면에서 봐요');
  if(monitor.status==='error')return ahNoticeLine('alert','알림 확인 일부 실패 · 메신저 알림이 빠질 수 있어요. 상태는 이 화면에서 봐요');
  const every=ahEvery(monitor.intervalMs);
  return monitor.status==='enabled'?ahNoticeLine('',`알림 켜짐${every?` · ${every} 확인`:''}<span class="mt-hide-sm"> · 같은 문제는 메신저에 한 번만 알려요</span>`):ahNoticeLine('info','알림 켜짐 · 첫 확인을 기다리는 중이에요');
}
// 자동화 한 줄: LED · 이름(누르면 아래에 사실 칸) · 하는 일(서버 설명 첫 문장) · 도는 때 · 마지막 · 다음.
function ahLast(card,group,label){
  if(group==='problem'){const at=ahWhen(card.lastSuccessAt);return at?`${label} · ${card.lastSuccessLabel||'최근 성공'} ${at}`:label;}
  if(group==='manual')return `${label} ${card.counts.manual}건`;
  // 꺼진 줄은 「도는 때」가 이미 꺼짐이라, 마지막으로 돈 때를 보인다(기록이 없으면 「기록 없음」).
  if(group==='off'){const at=ahWhen(card.lastSuccessAt||card.lastResultAt);return at?`${card.lastSuccessAt?card.lastSuccessLabel||'최근 성공':card.lastResultLabel||'최근 결과'} ${at}`:'기록 없음';}
  const at=ahWhen(card.mode==='scheduled'?card.lastSuccessAt||card.lastResultAt:card.lastResultAt);
  return at?`${label} · ${at}`:label;
}
function ahFact(label,value,empty='기록 없음'){const text=ahWhen(value);return `<div><dt>${escape(label)}</dt><dd${text?` title="${escape(ahDate(value))}"`:''}>${escape(text||empty)}</dd></div>`;}
function ahDetail(card){
  const scheduled=card.mode==='scheduled',counts=card.counts,href=ahHref(card.href),dest=ahDest(href);
  const facts=scheduled?ahFact('최근 시도',card.lastAttemptAt)+ahFact(card.lastSuccessLabel||'최근 성공',card.lastSuccessAt)+ahFact(card.lastResultLabel||'최근 결과',card.lastResultAt)+ahFact('다음 기한',card.nextDueAt,'정한 기한 없음')
    :`<div><dt>도는 때</dt><dd>${escape(ahCadence(card))}</dd></div>${ahFact(card.lastResultLabel||card.lastSuccessLabel||'최근 결과',card.lastResultAt)}${ahFact('다음 기한',card.nextDueAt,'정한 기한 없음')}<div><dt>볼 것</dt><dd>${escape(mtNum(counts.targets))}<small>개</small></dd></div>`;
  const line=[scheduled?`볼 것 ${counts.targets}`:'',`문제 ${counts.issues}`,`사람 차례 ${counts.manual}`,counts.paused?`꺼짐 ${counts.paused}`:'',counts.customerWaiting?`고객 차례 ${counts.customerWaiting}`:'',counts.staffWaiting?`담당자 차례 ${counts.staffWaiting}`:''].filter(Boolean).join(' · ');
  const both=(counts.customerWaiting||0)+(counts.staffWaiting||0)>counts.manual?'<p class="mt-note">같은 프로젝트가 고객과 담당자를 함께 기다릴 수 있어요.</p>':'';
  return `<div class="ah-detail-body"><dl class="mt-facts" data-cols="4">${facts}</dl><p class="mt-note">${escape(line)}</p>${both}<div class="ah-what"><h4>하는 일 · 하지 않는 일</h4>${card.text?`<p>${escape(card.text)}</p>`:''}</div>${ahLink(card.href,'source:'+card.id,{label:dest?dest+' 열기':'열기'})}</div>`;
}
// 열은 화면이 좁아도 여섯 칸 그대로 두고 폭만 0으로 접는다(ah-x-md · ah-x-sm) — 묶음 줄 · 펼침 줄의 colspan="6"이 유령 열을 만들지 않게.
function ahCard(card){
  const group=ahGroupOf(card),tone=ahGroups.find(row=>row.id===group).tone,label=card.statusLabel||ahStatuses[card.status]||'확인 필요',open=!!automationHealthState.expanded['row:'+card.id],id=escape(card.id);
  return `<tr class="ah-row${open?' is-open':''}" data-ah-card="${id}"><td class="ah-c-led">${mtLed(tone,label)}</td><td class="ah-c-name"><button type="button" class="ah-name" data-ah-toggle="${id}" aria-expanded="${open}" aria-controls="ah-detail-${id}" data-ah-focus="card:${id}">${escape(card.title||'자동화')}</button></td><td class="ah-c-what ah-x-md"><span>${escape(ahFirstSentence(card.text))}</span></td><td class="ah-c-when ah-x-sm">${escape(ahCadence(card))}</td><td class="ah-c-last">${escape(ahLast(card,group,label))}</td><td class="ah-c-next ah-x-sm">${escape(card.status==='paused'?'':ahWhen(card.nextDueAt))}</td></tr><tr class="ah-detail" id="ah-detail-${id}" data-ah-detail="${id}"${open?'':' hidden'}><td colspan="6">${ahDetail(card)}</td></tr>`;
}
const ahHeadCells='<th class="ah-c-led"><span class="sr-only">상태</span></th><th class="ah-c-name">이름</th><th class="ah-c-what ah-x-md">하는 일</th><th class="ah-c-when ah-x-sm">도는 때</th><th class="ah-c-last">마지막</th><th class="ah-c-next ah-x-sm">다음</th>';
function ahTable(cards){
  const groups=new Map(ahGroups.map(group=>[group.id,[]]));
  for(const id of ahCardIds){const card=cards.find(row=>row.id===id);if(card)groups.get(ahGroupOf(card)).push(card);}
  // 이상 없는 것 가운데 지금 일하는(할 일 없음이 아닌) 줄은 여섯까지 보이고, 나머지는 같은 표 안 숨긴 묶음에 두고 표 아래 접기로 연다.
  const ok=groups.get('ok'),ordered=[...ok.filter(card=>card.status!=='idle'),...ok.filter(card=>card.status==='idle')],shown=ordered.slice(0,Math.min(6,ok.filter(card=>card.status!=='idle').length)),folded=ordered.slice(shown.length),open=!!automationHealthState.expanded.ok;
  const bodies=ahGroups.map(group=>{const all=groups.get(group.id),list=group.id==='ok'?shown:all;return all.length?`<tbody data-ah-rows="${group.id}"><tr class="mt-group-row"><th colspan="6" scope="colgroup">${mtLed(group.tone)}${escape(group.label)}<span>${all.length}</span></th></tr>${list.map(ahCard).join('')}</tbody>`:'';}).join('');
  const rest=folded.length?`<tbody class="ah-folded" id="ah-folded" data-ah-rows="ok-more"${open?'':' hidden'}>${folded.map(ahCard).join('')}</tbody>`:'';
  const fold=folded.length?`<details class="mt-fold ah-fold" data-ah-group="ok"${open?' open':''}><summary data-ah-focus="more:ok" aria-controls="ah-folded"><span class="ah-fold-closed">이상 없음 <b>${folded.length}개${shown.length?' 더':''}</b> · ${escape(folded.map(card=>card.title).filter(Boolean).join(' · '))}</span><span class="ah-fold-open">이상 없음 ${folded.length}개 접기</span></summary></details>`:'';
  return `<div class="mt-scroll"><table class="mt-table ah-table"><caption class="sr-only">자동화 ${cards.length}개 상태</caption><thead><tr>${ahHeadCells}</tr></thead>${bodies}${rest}</table></div>${fold}`;
}
// 줄을 누르면 그 줄 아래 사실 칸을 연다 — 다시 그려도 열린 줄은 상태에 남는다.
function ahToggleRow(id){
  const key='row:'+id,open=!automationHealthState.expanded[key];automationHealthState.expanded[key]=open;
  const detail=document.getElementById?.('ah-detail-'+id),button=document.querySelector?.(`[data-ah-toggle="${id}"]`);
  if(detail)detail.hidden=!open;if(button){button.setAttribute('aria-expanded',String(open));button.closest?.('tr')?.classList?.toggle('is-open',open);}
}
// 왼쪽 메뉴 숫자: 불러온 자료가 있을 때만. 조치할 문제는 코랄, 없으면 사람 차례 수.
function automationHealthNavCount(){
  const current=automationHealthState;if(typeof state==='undefined'||!state.user||!current.data||current.identity!==ahUserKey())return null;
  const {issues,manual}=ahLists(current.data);
  return issues.length?{value:issues.length,tone:'alert',label:'조치할 문제'}:manual.length?{value:manual.length,tone:'',label:'사람 차례'}:null;
}
// 홈페이지 문의 수집(관리자만) — 사업 자동화가 더한 칸을 13판 문법으로 옮겼다. 아래 자동화 개수와 따로 센다.
// website-inquiry-client 시험이 이 함수만 불러 보므로 공통 도우미 없이 그린다. 주기·시각은 서버가 준 값만 쓴다.
function ahWebsiteInquiry(value,num=''){
  if(state.user?.role!=='admin'||value===undefined)return '';
  const href='/?tab=workroom&section=tools&tool=inquiries';
  const states={'not-connected':['wait','읽기 연결 필요'],ready:['ok','수집 준비됨'],paused:['off','자동 수집 꺼짐'],running:['info','수집 중'],'catching-up':['info','지난 문의 수집 중'],failed:['alert','확인 필요']};
  const valid=!!value&&typeof value.enabled==='boolean'&&typeof value.configured==='boolean'&&Object.hasOwn(states,value.status);
  const stopped=valid&&value.enabled&&value.schedulerEnabled===false;
  const [tone,label]=valid?stopped&&!['not-connected','failed','running'].includes(value.status)?['off','서버 자동 수집 꺼짐']:states[value.status]:['wait','상태 확인 불가'];
  const minutes=Number(value?.intervalMinutes),every=Number.isInteger(minutes)&&minutes>0?`${minutes}분마다 `:'';
  const text=!valid?'문의 수집 상태를 읽지 못했어요. 문의가 없다는 뜻은 아니에요.':value.status==='not-connected'?'Google 문의 양식의 질문·응답을 읽을 연결이 필요해요.':value.status==='paused'?'자동 수집이 꺼져 있어요. 문의 접수함에서 켤 수 있어요.':value.status==='failed'?'문의 수집이나 후속 업무 연결을 끝내지 못했어요. 문의 접수함에서 연결과 권한을 봐 주세요.':stopped?'이 서버의 자동 실행이 꺼져 있어 돌지 않아요. 문의 접수함에서 직접 수집할 수 있어요.':`${every}문의를 읽어 분류 · 답변 초안 · 관리자 할 일로 이어요.`;
  const fact=(name,at,empty)=>`<div><dt>${name}</dt><dd>${escape(ahWhen(at)||empty)}</dd></div>`;
  const next=valid&&value.enabled&&!stopped?value.nextCheckAt:null;
  return `<section class="mt-block ah-inquiries" data-ah-block="inquiries" aria-labelledby="ah-inquiries-title"><div class="mt-block-head">${num?`<span class="mt-num">${escape(num)}</span>`:''}<h2 id="ah-inquiries-title">문의 접수</h2><span class="mt-badge" data-tone="${tone}">${escape(label)}</span></div><div class="mt-issue"><span class="mt-led" data-tone="${tone}" aria-hidden="true"></span><div><strong>홈페이지 문의 수집</strong><p>${escape(text)}</p><dl class="mt-facts" data-cols="3">${fact('최근 시도',valid?value.lastAttemptAt:null,'—')}${fact('최근 전체 수집 완료',valid?value.lastSuccessAt:null,'—')}${fact('다음 점검',next,valid&&(!value.enabled||stopped)?'예약 꺼짐':'—')}</dl></div><a class="mt-link" href="${href}" data-ah-source="${href}" data-ah-focus="website-inquiries">문의 접수함 열기</a></div><p class="mt-note">답변 초안은 자동으로 보내지 않아요. 아래 자동화 개수와는 따로 세요.</p></section>`;
}
function automationHealthPanel(){
  ahIdentity();const current=automationHealthState,data=current.data,{issues,manual}=data?ahLists(data):{issues:[],manual:[]},partial=!!data&&(data.counts.partial>0||data.cards.some(card=>card.status==='partial')),groups=data?ahGroupCounts(data.cards):null;
  const stamp=current.loading?'불러오는 중…':data?`${ahClock(data.refreshedAt)}에 확인`:'';
  const actions=`<button type="button" class="btn icon small" data-ah-action="refresh" data-ah-focus="refresh" aria-label="새로고침" title="새로고침"${current.loading?' disabled':''}>${mtIcon('refresh')}</button>${stamp?`<span class="mt-note" data-ah-checked>${escape(stamp)}</span>`:''}`;
  const meter=mtMeter([{label:'멈춤',value:groups?groups.problem:null,unit:'개',tone:'alert'},{label:'직접 확인',value:groups?groups.manual:null,unit:'개',tone:'wait'},...(groups?.partial?[{label:'일부만 확인',value:groups.partial,unit:'개',tone:'info'}]:[]),{label:'이상 없음',value:groups?groups.ok:null,unit:'개',tone:'ok'},{label:'꺼짐',value:groups?groups.off:null,unit:'개',tone:''}]);
  const head=mtHead({tool:'automation',title:'자동화 상태',desc:'멈춘 자동화와 사람이 할 일을 먼저 보여 줘요. 이상 없는 것은 접어 둬요.',actions,layout:'board',meter,poster:{label:'SYNK MAKER · STATUS',word:'상태',stats:data?[{tone:'alert',label:'조치할 문제',value:issues.length},{tone:'wait',label:'사람 차례',value:manual.length}]:[]}});
  const error=current.error?mtError(current.error+(data?' 아래는 마지막으로 불러온 상태예요.':'')):'';
  let body;
  if(!data)body=current.loading?'<div class="mt-loading" role="status">자동화 상태를 읽고 있어요.</div>':current.error?mtEmpty('상태를 읽지 못했어요','문제가 없다는 뜻은 아니에요. 새로고침으로 다시 읽어요.'):'<div class="mt-loading" role="status">자동화 상태를 불러와요.</div>';
  else{
    let number=0;const next=()=>String(++number).padStart(2,'0');
    const notices=`<div class="ah-notices">${ahNotice(data.monitor)}${partial?ahNoticeLine('info','일부 기록을 읽지 못했어요. 표시된 문제가 전부가 아닐 수 있어요.','role="status"'):''}</div>`;
    const issueBlock=mtBlock({num:next(),title:'조치할 문제',count:issues.length,countTone:issues.length?'alert':'',attrs:'data-ah-block="issues"',body:issues.length?ahIssueList(issues):`<p class="mt-empty">${partial?'읽은 기록에는 조치할 문제가 없어요. 일부 상태는 읽지 못했어요.':`조치할 문제가 없어요 · ${escape(ahClock(data.refreshedAt))} 확인`}</p>`});
    const manualBlock=mtBlock({num:next(),title:'사람 차례',count:manual.length,attrs:'data-ah-block="manual"',body:manual.length?ahManualList(manual):`<p class="mt-empty">${partial?'읽은 기록에는 사람 차례가 없어요. 일부 상태는 읽지 못했어요.':'지금 사람이 할 일이 없어요.'}</p>`});
    const projects=ahProjects(data,next),inquiry=state.user?.role==='admin'&&data.websiteInquiries!==undefined?ahWebsiteInquiry(data.websiteInquiries,next()):'';
    const table=mtBlock({num:next(),title:`자동화 ${data.cards.length}개`,attrs:'data-ah-block="all"',body:ahTable(data.cards)});
    body=`${notices}<div class="mt-board"><div>${issueBlock}</div><div>${manualBlock}</div></div>${projects}${inquiry}${table}`;
  }
  const foot=`<div class="ah-foot"><p class="mt-note">이 화면은 상태만 보여 줘요. 고치는 일은 그 도구 화면에서 해요.</p>${data?.note?`<p class="mt-note">${escape(data.note)}</p>`:''}</div>`;
  return `<div class="ah-panel" aria-busy="${current.loading}">${head}${error}${body}${foot}</div>`;
}
document.addEventListener('click',async event=>{
  queueMicrotask(automationHealthSync);
  const source=event.target.closest?.('[data-ah-source]');if(source){if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();try{await ahOpenSource(source.dataset.ahSource,source.dataset.ahView);}catch(error){notify(error.message);}return;}
  const target=event.target.closest?.('[data-ah-action]');if(target){if(!target.disabled&&state.user&&target.dataset.ahAction==='refresh')await ahLoad();return;}
  const row=event.target.closest?.('[data-ah-toggle],tr[data-ah-card]');if(row&&state.user&&ahVisible()){const id=row.dataset.ahToggle||row.dataset.ahCard;if(ahCardIds.includes(id))ahToggleRow(id);}
});
document.addEventListener('visibilitychange',()=>{if(typeof state==='undefined')return;if(document.hidden)ahSuspend();else if(ahVisible())automationHealthEnsure();});
document.addEventListener('toggle',event=>{
  const group=event.target?.dataset?.ahGroup;if(!(['issues','manual','ok'].includes(group)||automationHealthState.data?.projectGroups?.some(item=>'project:'+item.projectId===group))||!ahVisible())return;
  automationHealthState.expanded[group]=event.target.open;
  if(group==='ok'){const rows=document.getElementById?.('ah-folded');if(rows)rows.hidden=!event.target.open;}
},true);
