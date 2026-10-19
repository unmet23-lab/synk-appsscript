'use strict';

const weeklySummaryState={userId:null,request:0,attempted:false,loading:false,week:'',data:null,error:'',timer:null,lastAttemptAt:0,followLatest:true,expanded:{}};
const wksSectionIds=['completed','performance','attention','upcoming'];
const wksSectionTitles={completed:'완료·게시 기록',performance:'콘텐츠 성과',attention:'현재 남아 있는 문제',upcoming:'다음 주 준비'};
function wksStopTimer(){if(weeklySummaryState.timer!==null)clearTimeout(weeklySummaryState.timer);weeklySummaryState.timer=null;}
function weeklySummaryReset(){wksStopTimer();Object.assign(weeklySummaryState,{userId:null,request:weeklySummaryState.request+1,attempted:false,loading:false,week:'',data:null,error:'',lastAttemptAt:0,followLatest:true,expanded:{}});}
function wksIdentity(){if(weeklySummaryState.userId!==state.user?.id){weeklySummaryReset();weeklySummaryState.userId=state.user?.id||null;}}
function wksVisible(){return !!state.user&&state.tab==='workroom'&&wr.view==='tools'&&makerTools.view==='weekly';}
function wksRender({preserveScroll=false}={}){
  if(!wksVisible())return;
  const userId=state.user.id,main=preserveScroll?document.getElementById?.('main'):null,position=main?{top:main.scrollTop,left:main.scrollLeft}:null;
  render();
  if(position&&state.user?.id===userId&&wksVisible()){const restored=document.getElementById?.('main');if(restored){restored.scrollTop=position.top;restored.scrollLeft=position.left;}}
}
function wksDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const date=new Date(value+'T00:00:00.000Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;}
function wksShift(value,days){const date=wksDay(value);if(!date)return '';date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
function wksMonday(value){const date=wksDay(value);return date?wksShift(value,-((date.getUTCDay()+6)%7)):'';}
function wksBounds(){const fallback=wksShift(wksMonday(new Date(Date.now()+9*3600000).toISOString().slice(0,10)),-7),schedule=weeklySummaryState.data?.schedule;return {latest:wksDay(schedule?.latestWeek)?schedule.latestWeek:fallback,oldest:wksDay(schedule?.oldestWeek)?schedule.oldestWeek:wksShift(fallback,-51*7)};}
function wksDate(value){const date=value?new Date(value):null;return date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):'시각 미확인';}
function wksRefreshWeek(){const current=weeklySummaryState,next=Date.parse(current.data?.schedule?.nextRunAt||'');return current.followLatest&&Number.isFinite(next)&&next<=Date.now()?'':current.week;}
function weeklySummarySync(){
  if(!wksVisible()||document.hidden){wksStopTimer();return;}
  if(weeklySummaryState.loading||weeklySummaryState.timer!==null)return;
  weeklySummaryState.timer=setTimeout(()=>{weeklySummaryState.timer=null;if(!wksVisible()||document.hidden)return;if(document.activeElement?.matches?.('[data-wks-week]')){weeklySummarySync();return;}void wksLoad(wksRefreshWeek(),{automatic:true});},60000);
}
function weeklySummaryEnsure(){if(!state.user)return;wksIdentity();if(!wksVisible()||document.hidden){wksStopTimer();return;}if(!weeklySummaryState.loading&&(!weeklySummaryState.attempted||Date.now()-weeklySummaryState.lastAttemptAt>=60000))void wksLoad(wksRefreshWeek(),{automatic:true});else weeklySummarySync();}
function wksValidReport(data,week){return !!data&&wksDay(data.period?.startDate)&&wksMonday(data.period.startDate)===data.period.startDate&&(!week||data.period.startDate===week)&&wksDay(data.period.endDate)&&Array.isArray(data.sections)&&wksSectionIds.every(id=>data.sections.filter(section=>section.id===id&&Array.isArray(section.items)).length===1);}
async function wksLoad(value='',{automatic=false}={}){
  wksIdentity();const userId=state.user?.id;if(!userId)return;
  const current=weeklySummaryState,week=value?wksMonday(value):'',bounds=wksBounds();
  if(value&&(!week||week>bounds.latest||week<bounds.oldest)){current.error='최근 52개의 완료된 주에서 날짜를 선택해 주세요.';wksRender();return;}
  wksStopTimer();const request=++current.request;current.loading=true;current.attempted=true;current.lastAttemptAt=Date.now();current.error='';if(week!==current.week){current.data=null;current.expanded={};}if(!automatic)current.followLatest=!week||week===bounds.latest;current.week=week;wksRender({preserveScroll:automatic});
  const alive=()=>state.user?.id===userId&&current.userId===userId&&request===current.request;
  try{
    const data=await api('/api/weekly-summary'+(week?'?week='+encodeURIComponent(week):''));if(!alive())return;
    if(!wksValidReport(data,week))throw new Error('주간 정리의 형식을 확인하지 못했어요. 다시 불러와 주세요.');
    current.data=data;current.week=data.period.startDate;
  }catch(error){if(alive()){current.error=error?.message||'주간 기록을 불러오지 못했어요.';if(error?.status===401||error?.status===403)current.data=null;}}
  finally{if(alive()){current.loading=false;wksRender({preserveScroll:automatic});weeklySummarySync();}}
}
function wksHref(value){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||/[\u0000-\u0020]/.test(value)||value.length>1800)return '';
  let url;try{url=new URL(value,location.origin);}catch{return '';}
  if(url.origin!==location.origin||url.pathname!=='/'||url.username||url.password||url.search&&url.hash)return '';
  const params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),keys=[...params.keys()],tab=params.get('tab')||params.get('view');
  if(new Set(keys).size!==keys.length||params.has('view')&&params.has('tab'))return '';
  if(tab==='workroom'){
    if(params.get('section')==='clients')return typeof cdReadTarget==='function'&&cdReadTarget(url.href)?value:'';
    if(params.get('section')!=='tools'||params.get('tool')!=='publication')return '';
    if(params.has('publicationAction'))return typeof pfReadTarget==='function'&&pfReadTarget(url.href)?value:'';
    return keys.length===3&&keys.every(key=>['tab','section','tool'].includes(key))?value:'';
  }
  if(tab==='content')return typeof workspaceLinkDestination==='function'&&workspaceLinkDestination(value)?value:'';
  if(tab==='messenger')return keys.every(key=>['tab','view','panel','channelId','messageId'].includes(key))&&(!params.has('panel')||params.get('panel')==='tasks')&&(!params.has('channelId')||/^[A-Za-z0-9_. -]{1,100}$/.test(params.get('channelId')))&&(!params.has('messageId')||params.has('channelId')&&/^\d{1,16}$/.test(params.get('messageId'))&&Number(params.get('messageId'))>0)?value:'';
  return '';
}
const wksButton=(label,action,attrs='',classes='quiet')=>`<button type="button" class="btn ${classes}" data-wks-action="${action}" ${attrs}>${escape(label)}</button>`;
function wksItem(item,sectionId){
  const href=wksHref(item.href),completed=['completed','performance'].includes(sectionId);
  const date=completed&&item.occurredAt?wksDate(item.occurredAt):item.dueDate?`예정 ${item.dueDate}`:item.occurredAt?wksDate(item.occurredAt):'';
  return `<li><div class="wks-item-top">${item.statusLabel?`<span class="wks-status">${escape(item.statusLabel)}</span>`:''}${date?`<span class="wks-item-date">${escape(date)}</span>`:''}</div><strong>${escape(item.title||'제목 없는 기록')}</strong>${item.text?`<p>${escape(item.text)}</p>`:''}${href?`<a class="wks-source" href="${escape(href)}" data-wks-source="${escape(href)}">원문 바로가기 <span aria-hidden="true">↗</span></a>`:''}</li>`;
}
function wksSection(section){
  const unavailable=['error','unavailable'].includes(section.status),partial=section.status==='partial',items=section.items||[],total=Number.isFinite(section.total)?Math.max(0,section.total):items.length;
  const list=items.length?`<ul class="wks-items">${items.slice(0,3).map(item=>wksItem(item,section.id)).join('')}</ul>${items.length>3?`<details class="wks-more" ${weeklySummaryState.expanded[section.id]?'open':''}><summary>나머지 ${items.length-3}건 보기</summary><ul class="wks-items">${items.slice(3).map(item=>wksItem(item,section.id)).join('')}</ul></details>`:''}${total>items.length?`<p class="wks-section-note">전체 ${total}건 중 ${items.length}건을 보여드려요. 원문에서 전체 기록을 확인하세요.</p>`:''}`:`<p class="wks-empty">${partial?'일부 기록을 불러오지 못해 전체 여부를 확인할 수 없어요.':section.id==='attention'?'현재 확인할 문제가 없어요.':section.id==='upcoming'?'등록된 다음 주 일정이 없어요.':'이 기간에 해당하는 기록이 없어요.'}</p>`;
  return `<section class="wks-section" data-wks-section="${escape(section.id)}" aria-labelledby="wks-${escape(section.id)}"><header><div><span class="wks-scope">${['completed','performance'].includes(section.id)?'선택한 주의 기록':section.id==='attention'?'지금 상태 기준':'선택한 주 다음 주의 일정'}</span><h3 id="wks-${escape(section.id)}">${escape(section.title||wksSectionTitles[section.id])}</h3></div><span class="wks-count">${unavailable?'—':total}</span></header>${section.note?`<p class="wks-section-note${partial||unavailable?' wks-warning':''}"${partial||unavailable?' role="status"':''}>${escape(section.note)}</p>`:''}${unavailable?'<p class="wks-empty">이 항목을 불러오지 못했어요. 다시 불러온 뒤 확인해 주세요.</p>':list}</section>`;
}
function weeklySummaryPanel(){
  wksIdentity();const current=weeklySummaryState,data=current.data,bounds=wksBounds(),week=current.week||bounds.latest,disabled=current.loading?'disabled':'';
  const sections=data?wksSectionIds.map(id=>data.sections.find(section=>section.id===id)):[];
  const schedule=data?.schedule,scheduleLine=schedule?(schedule.status==='error'?'자동 정리 상태 확인 필요':schedule.enabled?'매주 월요일 자동 정리':'예약 정리 꺼짐'):'주간 기록 불러오기';
  return `<section class="wks-panel" aria-labelledby="wks-title" aria-busy="${current.loading}"><div class="wks-heading"><div><span class="wr-kicker">내 작업 기록</span><h2 id="wks-title">주간 정리</h2><p>끝낸 일과 성과를 돌아보고, 이어갈 일을 확인하세요.</p></div>${wksButton(current.loading?'불러오는 중…':'새로고침','refresh',disabled,'small quiet')}</div><div class="wks-week-nav"><div class="wks-week-controls">${wksButton('이전 주','previous',`${disabled} ${week<=bounds.oldest?'disabled':''}`,'small quiet')}<label>확인할 주<input type="date" data-wks-week value="${escape(week)}" min="${escape(bounds.oldest)}" max="${escape(bounds.latest)}" ${disabled} aria-label="주간 정리 날짜 선택"></label>${wksButton('다음 주','next',`${disabled} ${week>=bounds.latest?'disabled':''}`,'small quiet')}</div><p>${escape(data?.period?.label||`${week}부터 한 주`)}<span>월요일~일요일 · 한국 시간 · 완료된 최근 52주</span></p></div>${current.error?`<div class="wks-error" role="alert">${escape(current.error)}${data?'<span>아래는 마지막으로 불러온 기록이에요. 최신 상태는 다시 확인해 주세요.</span>':''}</div>`:''}${!data?`<div class="wks-loading" role="status">${current.loading?'<span class="loading-line"></span><p>기존 작업 기록을 모으고 있어요.</p>':current.error?'<p>불러오기에 실패했어요. 기록이 없는 상태와는 달라요.</p>': '<p>주간 기록을 불러옵니다.</p>'}</div>`:`<div class="wks-summary" aria-label="주간 정리 항목별 수">${sections.map(section=>`<div><span>${escape(wksSectionTitles[section.id])}</span><strong>${['error','unavailable'].includes(section.status)?'—':Number.isFinite(section.total)?Math.max(0,section.total):section.items.length}<small>${section.status==='partial'?'건 · 일부 확인':'건'}</small></strong></div>`).join('')}</div><p class="wks-snapshot">집계 ${escape(wksDate(data.refreshedAt||data.generatedAt))} · 본인이 볼 수 있는 기록만 모았어요.</p><div class="wks-grid">${sections.map(wksSection).join('')}</div>`}<footer class="wks-footer"><strong>${escape(scheduleLine)}</strong><p>${escape(schedule?.note||(schedule?.status==='error'?'예약 정리에 실패했어요. 마지막 집계 시각을 확인하고 새로고침해 주세요.':schedule?.enabled?'작업실 서버가 켜져 있을 때 지난주의 기록을 정리합니다.':'새로고침으로 현재 기록을 확인할 수 있어요.'))}</p>${schedule?.enabled&&schedule.nextRunAt?`<span>다음 정리 ${escape(wksDate(schedule.nextRunAt))} · 한국 시간</span>`:''}</footer></section>`;
}
async function wksOpenSource(value){
  const href=wksHref(value);if(!href||!state.user)return false;const url=new URL(href,location.origin),params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),tab=params.get('tab')||params.get('view');
  if(tab==='workroom'&&params.get('section')==='clients')return openClientWorkflowLink(href);
  if(tab==='workroom'&&params.has('publicationAction'))return openPublicationWorkflowLink(href);
  if(tab==='content')return navigateWorkspaceLink(href);
  if(tab==='messenger'&&typeof openWorkspaceDestination==='function')return openWorkspaceDestination({type:'messenger',label:'업무 원문 열기',panel:params.get('panel')||'tasks',...(params.get('channelId')?{channelId:params.get('channelId')}:{}),...(params.get('messageId')?{messageId:params.get('messageId')}: {})});
  if(tab==='workroom'){makerTools.view='publication';selectWorkspaceView('workroom','tools');render();makerToolsEnsure();window.scrollTo(0,0);return true;}
  return false;
}
document.addEventListener('click',async event=>{
  queueMicrotask(weeklySummarySync);
  const source=event.target.closest?.('[data-wks-source]');if(source){if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();try{await wksOpenSource(source.dataset.wksSource);}catch(error){notify(error.message);}return;}
  const target=event.target.closest?.('[data-wks-action]');if(!target||target.disabled||!state.user)return;
  const current=weeklySummaryState,week=current.week||wksBounds().latest;
  if(target.dataset.wksAction==='refresh')await wksLoad(wksRefreshWeek(),{automatic:true});
  if(target.dataset.wksAction==='previous')await wksLoad(wksShift(week,-7));
  if(target.dataset.wksAction==='next')await wksLoad(wksShift(week,7));
});
document.addEventListener('change',event=>{if(event.target.matches?.('[data-wks-week]')&&state.user)void wksLoad(event.target.value);});
document.addEventListener('visibilitychange',()=>{if(typeof state==='undefined')return;if(document.hidden)wksStopTimer();else if(wksVisible())weeklySummaryEnsure();});
document.addEventListener('toggle',event=>{if(!event.target.matches?.('.wks-more'))return;const id=event.target.closest?.('[data-wks-section]')?.dataset.wksSection;if(wksSectionIds.includes(id))weeklySummaryState.expanded[id]=event.target.open;},true);
