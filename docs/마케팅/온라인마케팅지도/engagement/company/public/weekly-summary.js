'use strict';
// 주간 정리 — 제작 도구 B 「먼저 할 일 판」(13판, 2026-10-20). 머리(주 고르기 캡슐 · 포스터 · 계기판) → 집계 한 줄 →
// 01 지금 할 일(있을 때만 맨 앞) · 끝낸 일 · 콘텐츠 성과 · 다음 주 준비 → 바닥 한 줄(예약 정리). 그리기 도우미(mt*)는 maker-tools.js 앞 절반.
// 서버 응답(period · sections · schedule · generatedAt/refreshedAt)만 보이고, 서버가 준 글(구역 제목 · statusLabel · title · text)은 그대로 쓴다.

const weeklySummaryState={userId:null,identity:'',request:0,attempted:false,loading:false,week:'',data:null,error:'',timer:null,lastAttemptAt:0,followLatest:true,expanded:{},focus:''};
const wksSectionIds=['completed','performance','attention','upcoming'];
// 서버 구역 제목이 비었을 때만 쓰는 이름(서버의 새 제목과 같게).
const wksSectionTitles={completed:'끝낸 일',performance:'콘텐츠 성과',attention:'지금 할 일',upcoming:'다음 주 준비'};
const wksWeekdays='일월화수목금토';
function wksStopTimer(){if(weeklySummaryState.timer!==null)clearTimeout(weeklySummaryState.timer);weeklySummaryState.timer=null;}
function weeklySummaryReset(){wksStopTimer();Object.assign(weeklySummaryState,{userId:null,identity:'',request:weeklySummaryState.request+1,attempted:false,loading:false,week:'',data:null,error:'',lastAttemptAt:0,followLatest:true,expanded:{},focus:''});}
// 계정만이 아니라 역할 · 팀이 바뀌어도 지운다(볼 수 있는 기록이 달라진다 — 자동화 상태 ahUserKey와 같은 기준).
function wksUserKey(){return typeof state!=='undefined'&&state.user?[state.user.id,state.user.role||'',state.user.teamId||''].join(':'):'';}
function wksIdentity(){const current=weeklySummaryState,id=state.user?.id||null,key=wksUserKey();if(current.userId!==id||current.identity&&current.identity!==key){weeklySummaryReset();current.userId=id;}current.identity=key;}
function wksVisible(){return !!state.user&&state.tab==='workroom'&&wr.view==='tools'&&makerTools.view==='weekly';}
// 전역 render는 주간 단추의 초점을 되살리지 않는다 — 누른 단추(불러오는 동안은 꺼져 있으니 끝난 뒤) 또는 날짜 칸으로 돌려놓는다.
function wksFocusKey(element){return element?.dataset?.wksAction?'action:'+element.dataset.wksAction:element?.matches?.('[data-wks-week]')?'week':'';}
function wksFocusTarget(key){const find=selector=>document.querySelector?.(selector);return [key.startsWith('action:')?find(`[data-wks-action="${key.slice(7)}"]`):null,find('[data-wks-week]')].find(node=>node&&!node.disabled)||null;}
function wksRender({preserveScroll=false}={}){
  if(!wksVisible())return;
  const current=weeklySummaryState,userId=state.user.id,active=document.activeElement,main=preserveScroll?document.getElementById?.('main'):null,position=main?{top:main.scrollTop,left:main.scrollLeft}:null;
  if(active&&active!==document.body&&!wksFocusKey(active))current.focus='';
  const key=wksFocusKey(active)||(current.focus&&(!active||active===document.body)?current.focus:'');
  render();
  if(state.user?.id!==userId||!wksVisible())return;
  if(position){const restored=document.getElementById?.('main');if(restored){restored.scrollTop=position.top;restored.scrollLeft=position.left;}}
  if(!key)return;
  const target=current.loading?null:wksFocusTarget(key);
  if(target){target.focus?.({preventScroll:true});current.focus='';}else current.focus=key;
}
function wksDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const date=new Date(value+'T00:00:00.000Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;}
function wksShift(value,days){const date=wksDay(value);if(!date)return '';date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
function wksMonday(value){const date=wksDay(value);return date?wksShift(value,-((date.getUTCDay()+6)%7)):'';}
function wksBounds(){const fallback=wksShift(wksMonday(new Date(Date.now()+9*3600000).toISOString().slice(0,10)),-7),schedule=weeklySummaryState.data?.schedule;return {latest:wksDay(schedule?.latestWeek)?schedule.latestWeek:fallback,oldest:wksDay(schedule?.oldestWeek)?schedule.oldestWeek:wksShift(fallback,-51*7)};}
// 날짜 글: 한국 시간에는 서머타임이 없어 9시간을 더해 읽는다. 올해가 아니면 연도를 붙인다.
function wksKst(value){const time=typeof value==='string'&&value?Date.parse(value):NaN;return Number.isFinite(time)?new Date(time+9*3600000):null;}
const wksPad=value=>String(value).padStart(2,'0');
function wksYear(date){return date.getUTCFullYear()!==new Date(Date.now()+9*3600000).getUTCFullYear()?date.getUTCFullYear()+'년 ':'';}
function wksWhen(value,{weekday=false}={}){const date=wksKst(value);return date?`${wksYear(date)}${date.getUTCMonth()+1}월 ${date.getUTCDate()}일${weekday?` (${wksWeekdays[date.getUTCDay()]})`:''} ${wksPad(date.getUTCHours())}:${wksPad(date.getUTCMinutes())}`:'';}
function wksDue(value){const date=wksDay(value);return date?`${wksYear(date)}${date.getUTCMonth()+1}월 ${date.getUTCDate()}일 (${wksWeekdays[date.getUTCDay()]})`:'';}
function wksRange(start,end){
  const from=wksDay(start),to=wksDay(end);if(!from)return '';if(!to)return `${wksYear(from)}${from.getUTCMonth()+1}월 ${from.getUTCDate()}일부터`;
  const sameYear=from.getUTCFullYear()===to.getUTCFullYear(),sameMonth=sameYear&&from.getUTCMonth()===to.getUTCMonth();
  return `${wksYear(from)}${from.getUTCMonth()+1}월 ${from.getUTCDate()}일~${sameYear?'':to.getUTCFullYear()+'년 '}${sameMonth?'':to.getUTCMonth()+1+'월 '}${to.getUTCDate()}일`;
}
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
  const current=weeklySummaryState,identity=current.identity,week=value?wksMonday(value):'',bounds=wksBounds();
  if(value&&(!week||week>bounds.latest||week<bounds.oldest)){current.error='최근 52주 안에서 끝난 주를 골라 주세요.';wksRender();return;}
  wksStopTimer();const request=++current.request,previous=current.data?{data:current.data,week:current.week,expanded:current.expanded,followLatest:current.followLatest}:null;
  current.loading=true;current.attempted=true;current.lastAttemptAt=Date.now();current.error='';
  // 다른 주로 직접 옮길 때만 화면을 비운다. 자동 새로고침(월요일에 새 주로 넘어갈 때 포함)은 지금 기록을 둔 채 바꿔 깜빡이지 않는다.
  if(!automatic&&week!==current.week){current.data=null;current.expanded={};}
  if(!automatic)current.followLatest=!week||week===bounds.latest;current.week=week;wksRender({preserveScroll:automatic});
  const alive=()=>wksUserKey()===identity&&current.identity===identity&&state.user?.id===userId&&current.userId===userId&&request===current.request;
  try{
    const data=await api('/api/weekly-summary'+(week?'?week='+encodeURIComponent(week):''));if(!alive())return;
    if(!wksValidReport(data,week))throw new Error('받은 주간 정리의 형식이 맞지 않아요. 새로고침해 주세요.');
    if(current.data?.period?.startDate!==data.period.startDate)current.expanded={};
    current.data=data;current.week=data.period.startDate;
  }catch(error){
    if(alive()){
      current.error=error?.message||'주간 기록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.';
      if(error?.status===401||error?.status===403)current.data=null;
      // 못 불러오면 마지막으로 불러온 주와 기록으로 돌아간다(「아래는 마지막으로 불러온 기록이에요」가 그 기록을 가리킨다).
      else if(previous&&(!current.data||current.data===previous.data))Object.assign(current,{data:previous.data,week:previous.week,expanded:previous.expanded,followLatest:previous.followLatest});
    }
  }
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
// 링크가 여는 화면의 이름(첫 카드의 단추 글자) — 이미 wksHref를 통과한 주소만 받는다.
function wksDest(href){
  if(!href)return '';let params;try{const url=new URL(href,location.origin);params=new URLSearchParams(url.hash?url.hash.slice(1):url.search);}catch{return '';}
  const tab=params.get('tab')||params.get('view');
  return tab==='messenger'?'메신저':tab==='content'?'기획':params.get('section')==='clients'?'고객 관리':params.get('tool')==='publication'?'게시 준비·성과':'';
}
function wksLink(href,{label='열기',primary=false}={}){return href?`<a class="${primary?'btn small primary':'mt-link'}" href="${escape(href)}" data-wks-source="${escape(href)}">${escape(label)}</a>`:'';}
function wksTotal(section){return Number.isFinite(section.total)?Math.max(0,section.total):section.items.length;}
const wksUnavailable=section=>['error','unavailable'].includes(section?.status);
function wksMore(id,inner,count){return `<details class="mt-fold wks-more"${weeklySummaryState.expanded[id]?' open':''}><summary>나머지 ${count}건 보기</summary>${inner}</details>`;}
// 한 줄(LED · 제목 · 상태와 날짜 · 열기). 끝낸 일은 상태 이름이 같은 말을 하니 서버 안내 문장을 줄에서 뺀다.
function wksItem(item,sectionId,{dated=true}={}){
  const href=wksHref(item.href),done=['completed','performance'].includes(sectionId);
  const date=!dated?'':done&&item.occurredAt?wksWhen(item.occurredAt):item.dueDate?`${wksDue(item.dueDate)} 예정`:item.occurredAt?wksWhen(item.occurredAt):'';
  const meta=[item.statusLabel,date].filter(Boolean).join(' · '),text=sectionId==='completed'?'':item.text||'';
  const tone={completed:'ok',attention:'wait',upcoming:'info'}[sectionId]||'';
  return `<li class="mt-issue wks-row">${mtLed(tone)}<div><strong>${escape(item.title||'제목 없는 기록')}</strong>${meta?`<p>${escape(meta)}</p>`:''}${text?`<p class="wks-text">${escape(text)}</p>`:''}</div>${wksLink(href)}</li>`;
}
// 01 지금 할 일 — 카드. 화면의 검은 단추는 첫 카드 하나에만.
function wksJob(item,primary,shared=false){
  const href=wksHref(item.href),dest=wksDest(href),when=item.dueDate&&wksDue(item.dueDate)?`${wksDue(item.dueDate)} 기한`:item.occurredAt?wksWhen(item.occurredAt):'';
  return `<article class="mt-job wks-job"><span class="mt-led mt-job-led" data-tone="wait" aria-hidden="true"></span><div class="mt-job-main"><div class="mt-job-top"><h3>${escape(item.title||'제목 없는 할 일')}</h3>${mtBadge(item.statusLabel,'wait')}</div>${when?`<div class="mt-job-meta">${escape(when)}</div>`:''}${item.text&&!shared?`<p class="mt-job-body">${escape(item.text)}</p>`:''}${href?`<div class="mt-actions">${wksLink(href,{label:primary&&dest?dest+' 열기':'열기',primary})}</div>`:''}</div></article>`;
}
// 콘텐츠 성과 — 게시 시각순 1px 줄. 숫자는 서버가 쓴 그대로(받지 못한 숫자는 서버가 「0이 아니에요」로 쓴다), 시각이 없으면 「—」.
function wksPerf(item){
  const href=wksHref(item.href),when=wksWhen(item.occurredAt);
  return `<li class="wks-perf"><time${when?` datetime="${escape(item.occurredAt)}"`:''}>${escape(when||'—')}</time><div><strong>${escape(item.title||'제목 없는 기록')}</strong>${item.statusLabel||item.text?`<p>${mtBadge(item.statusLabel)}${item.text?`<span>${escape(item.text)}</span>`:''}</p>`:''}</div>${wksLink(href)}</li>`;
}
function wksList(section,items,primary){
  const id=section.id;
  if(id==='attention'){const text=items[0]?.text||'',shared=items.length>1&&!!text&&items.every(item=>item.text===text),cards=items.map((item,index)=>wksJob(item,primary&&index===0,shared));return (shared?`<p class="mt-note wks-shared">${escape(text)}</p>`:'')+cards.slice(0,3).join('')+(items.length>3?wksMore(id,cards.slice(3).join(''),items.length-3):'');}
  if(id==='performance'){const rows=items.map(wksPerf);return `<ul class="wks-perfs">${rows.slice(0,5).join('')}</ul>${items.length>5?wksMore(id,`<ul class="wks-perfs">${rows.slice(5).join('')}</ul>`,items.length-5):''}`;}
  if(id==='upcoming'){
    // 날짜별로 먼저 모으고(서버 순서와 관계없이 날짜 순, 날짜 없는 것은 끝), 여섯 건까지 보이고 나머지는 건수로 접는다 — 한 날짜가 나뉘면 접힌 쪽에 같은 날짜 머리가 다시 붙는다.
    const groups=new Map();for(const item of items){const day=wksDay(item.dueDate)?item.dueDate:'';if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item);}
    const days=[...groups].sort(([a],[b])=>(a||'9999-99-99').localeCompare(b||'9999-99-99')),shown=[],rest=[];let count=0;
    for(const [day,list] of days){const room=Math.max(0,6-count);if(room)shown.push([day,list.slice(0,room)]);if(list.length>room)rest.push([day,list.slice(room)]);count+=list.length;}
    const paint=list=>list.map(([day,rows])=>`<div class="mt-day"><h3><b>${escape(day?wksDue(day):'날짜 없음')}</b></h3><ul class="wks-rows">${rows.map(item=>wksItem(item,'upcoming',{dated:false})).join('')}</ul></div>`).join('');
    return paint(shown)+(rest.length?wksMore(id,paint(rest),rest.reduce((sum,[,rows])=>sum+rows.length,0)):'');
  }
  const rows=items.map(item=>wksItem(item,id));
  return `<ul class="wks-rows">${rows.slice(0,3).join('')}</ul>${items.length>3?wksMore(id,`<ul class="wks-rows">${rows.slice(3).join('')}</ul>`,items.length-3):''}`;
}
// 구역 머리 오른쪽의 범위: 지난 기록은 그 주, 할 일은 지금, 준비는 다음 주.
function wksScope(id){
  const period=weeklySummaryState.data?.period;if(!period)return '';
  if(id==='attention')return '지금 기준';
  if(id==='upcoming')return wksRange(period.nextStartDate||wksShift(period.startDate,7),period.nextEndDate||wksShift(period.startDate,13));
  return wksRange(period.startDate,period.endDate);
}
function wksSection(section,num='',primary=false){
  const id=section.id,unavailable=wksUnavailable(section),partial=section.status==='partial',items=section.items||[],total=wksTotal(section),title=section.title||wksSectionTitles[id],scope=wksScope(id);
  const warn=(partial||unavailable)&&section.note?`<p class="mt-error is-soft" role="status">${escape(section.note)}</p>`:'';
  const body=unavailable?'<p class="mt-empty">이 구역을 불러오지 못했어요. 새로고침해 주세요.</p>':items.length?wksList(section,items,primary):`<p class="mt-empty">${partial?'일부 기록을 읽지 못해 다 모였는지 알 수 없어요.':id==='attention'?'지금 할 일이 없어요.':id==='upcoming'?'다음 주에 잡힌 일정이 없어요.':'이 주에 남긴 기록이 없어요.'}</p>`;
  const more=!unavailable&&total>items.length?`<p class="mt-note">전체 ${total}건 중 ${items.length}건만 보여 줘요.</p>`:'';
  const legend=id==='performance'&&section.note&&!(partial||unavailable)&&items.length?`<p class="mt-note wks-legend">${escape(section.note)}</p>`:'';
  return mtBlock({num,title,count:unavailable?'—':total,countTone:'',tools:scope?`<span class="wks-scope">${escape(scope)}</span>`:'',attrs:`data-wks-section="${escape(id)}"`,body:warn+body+more+legend});
}
// 바닥 한 줄: 서버 schedule 값대로(켜기·끄기는 서버 설정이라 화면에 단추가 없다).
function wksScheduleLine(schedule){
  if(!schedule)return '';
  if(schedule.status==='error')return '<p class="mt-notice wks-foot" data-tone="alert" role="status">자동 정리 실패 · 새로고침하면 지금 기록으로 다시 모아요</p>';
  if(schedule.enabled){const next=wksWhen(schedule.nextRunAt,{weekday:true});return `<p class="mt-notice wks-foot">매주 월요일 자동 정리${next?` · 다음 정리 ${escape(next)}`:''}</p>${schedule.note?`<p class="mt-note wks-foot-note">${escape(schedule.note)}</p>`:''}`;}
  return '<p class="mt-notice wks-foot" data-tone="off">예약 정리 꺼짐 · 열 때마다 지금 기록으로 모아요</p>';
}
const wksChevron=direction=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${direction==='left'?'m15 6-6 6 6 6':'m9 6 6 6-6 6'}"/></svg>`;
// 왼쪽 메뉴 숫자: 불러온 자료가 있을 때만, 지금 할 일 수(문제가 아니라 내 차례라 코랄을 쓰지 않는다).
function weeklySummaryNavCount(){
  const current=weeklySummaryState;if(typeof state==='undefined'||!state.user||current.userId!==state.user.id||current.identity!==wksUserKey()||!current.data)return null;
  const section=current.data.sections.find(row=>row.id==='attention'),value=section&&!wksUnavailable(section)?wksTotal(section):0;
  return value>0?{value,tone:'',label:'지금 할 일'}:null;
}
function weeklySummaryPanel(){
  wksIdentity();const current=weeklySummaryState,data=current.data,bounds=wksBounds(),week=current.week||bounds.latest,busy=current.loading;
  const sections=data?wksSectionIds.map(id=>data.sections.find(section=>section.id===id)):[],by=id=>sections.find(section=>section?.id===id);
  const range=data?wksRange(data.period.startDate,data.period.endDate):wksRange(week,wksShift(week,6));
  const actions=`<div class="mt-seg is-inline wks-week" role="group" aria-label="주 고르기"><button type="button" data-wks-action="previous" aria-label="이전 주"${busy||week<=bounds.oldest?' disabled':''}>${wksChevron('left')}</button><label class="wks-pick"><span aria-hidden="true">${escape(range||'주 고르기')}</span><input type="date" data-wks-week value="${escape(week)}" min="${escape(bounds.oldest)}" max="${escape(bounds.latest)}"${busy?' disabled':''} aria-label="${escape(range?`보는 주 바꾸기, 지금 ${range}`:'보는 주 바꾸기')}"></label><button type="button" data-wks-action="next" aria-label="다음 주"${busy||week>=bounds.latest?' disabled':''}>${wksChevron('right')}</button></div><button type="button" class="btn icon small" data-wks-action="refresh" aria-label="${busy?'불러오는 중':'새로고침'}" title="새로고침"${busy?' disabled':''}>${mtIcon('refresh')}</button>`;
  const value=section=>!section||wksUnavailable(section)?null:wksTotal(section);
  const meter=mtMeter(wksSectionIds.map(id=>{const section=by(id);return {label:section?.title||wksSectionTitles[id],value:value(section),unit:section?.status==='partial'?'건 · 일부만':'건',tone:{completed:'ok',performance:'',attention:'wait',upcoming:'info'}[id]};}));
  const stat=id=>{const amount=value(by(id));return amount===null?'—':amount;};
  const head=mtHead({tool:'weekly',title:'주간 정리',desc:'한 주에 끝낸 일과 콘텐츠 숫자를 돌아보고, 다음 주 준비를 챙겨요.',actions,layout:'board',meter,poster:{label:'SYNK MAKER · WEEKLY',word:'주간',stats:data?[{tone:'ok',label:'끝낸 일',value:stat('completed')},{tone:'wait',label:'지금 할 일',value:stat('attention')}]:[]}});
  const error=current.error?mtError(current.error+(data?' 아래는 마지막으로 불러온 기록이에요.':'')):'';
  let body;
  if(!data)body=busy?'<div class="mt-loading" role="status">기록을 모으고 있어요.</div>':current.error?mtEmpty('기록을 불러오지 못했어요','기록이 없다는 뜻은 아니에요. 새로고침으로 다시 읽어요.'):'<div class="mt-loading" role="status">주간 기록을 불러와요.</div>';
  else{
    const attention=by('attention'),first=!!attention&&(attention.items.length>0||attention.status==='partial'||wksUnavailable(attention));
    let number=0;const next=()=>String(++number).padStart(2,'0');
    const left=(first?wksSection(attention,next(),true):'')+wksSection(by('completed'),next()),right=wksSection(by('performance'),next())+wksSection(by('upcoming'),next());
    const stamp=wksWhen(data.refreshedAt||data.generatedAt);
    body=`<p class="mt-note wks-snapshot">${stamp?`${escape(stamp)} 집계 · `:''}내가 볼 수 있는 기록만 모았어요.</p><div class="mt-board"><div>${left}</div><div>${right}</div></div>`;
  }
  return `<section class="wks-panel" aria-label="주간 정리" aria-busy="${busy}">${head}${error}${body}${data?wksScheduleLine(data.schedule):''}</section>`;
}
async function wksOpenSource(value){
  const href=wksHref(value);if(!href||!state.user)return false;const url=new URL(href,location.origin),params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),tab=params.get('tab')||params.get('view');
  if(tab==='workroom'&&params.get('section')==='clients')return openClientWorkflowLink(href);
  if(tab==='workroom'&&params.has('publicationAction'))return openPublicationWorkflowLink(href);
  if(tab==='content')return navigateWorkspaceLink(href);
  if(tab==='messenger'&&typeof openWorkspaceDestination==='function')return openWorkspaceDestination({type:'messenger',label:'메신저 업무 열기',panel:params.get('panel')||'tasks',...(params.get('channelId')?{channelId:params.get('channelId')}:{}),...(params.get('messageId')?{messageId:params.get('messageId')}: {})});
  if(tab==='workroom'){makerTools.view='publication';selectWorkspaceView('workroom','tools');render();makerToolsEnsure();window.scrollTo(0,0);return true;}
  return false;
}
document.addEventListener('click',async event=>{
  queueMicrotask(weeklySummarySync);
  const source=event.target.closest?.('[data-wks-source]');if(source){if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();try{await wksOpenSource(source.dataset.wksSource);}catch(error){notify(error.message);}return;}
  // 꾸민 주 칸: 투명한 날짜 칸을 누르면 브라우저 달력을 바로 연다(지원하지 않으면 칸이 그대로 열린다).
  if(event.target.matches?.('[data-wks-week]')&&!event.target.disabled){try{event.target.showPicker?.();}catch{}return;}
  const target=event.target.closest?.('[data-wks-action]');if(!target||target.disabled||!state.user)return;
  const current=weeklySummaryState,week=current.week||wksBounds().latest;
  if(target.dataset.wksAction==='refresh')await wksLoad(wksRefreshWeek(),{automatic:true});
  if(target.dataset.wksAction==='previous')await wksLoad(wksShift(week,-7));
  if(target.dataset.wksAction==='next')await wksLoad(wksShift(week,7));
});
document.addEventListener('change',event=>{if(event.target.matches?.('[data-wks-week]')&&state.user)void wksLoad(event.target.value);});
document.addEventListener('visibilitychange',()=>{if(typeof state==='undefined')return;if(document.hidden)wksStopTimer();else if(wksVisible())weeklySummaryEnsure();});
document.addEventListener('toggle',event=>{if(!event.target.matches?.('.wks-more'))return;const id=event.target.closest?.('[data-wks-section]')?.dataset.wksSection;if(wksSectionIds.includes(id))weeklySummaryState.expanded[id]=event.target.open;},true);
