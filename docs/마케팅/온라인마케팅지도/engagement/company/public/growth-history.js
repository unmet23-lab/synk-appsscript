'use strict';

const HISTORY_METRICS=[['views','조회수','회'],['likes','좋아요','개'],['followers','팔로워·구독자','명'],['comments','댓글','개'],['shares','공유','회'],['saves','저장','회'],['reach','도달','명']];
const historyKnown=value=>typeof value==='number'&&Number.isFinite(value);
const historyEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const historyNumber=value=>historyKnown(value)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value):'—';
const historySigned=value=>historyKnown(value)?`${value>0?'+':''}${historyNumber(value)}`:'—';
const historyValidDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const historyShift=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
const historyDays=(start,end)=>Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
const historyMetric=()=>HISTORY_METRICS.find(([key])=>key===state.metric)||HISTORY_METRICS[0];
const historyCoverage=point=>`${historyNumber(point?.count)}/${historyNumber(point?.eligible)}개 당일 확인`;
const historyDayCache={key:'',result:null,loading:false,error:'',request:0};

function historyMonthBack(date,months){
  const value=new Date(date+'T00:00:00Z'),day=value.getUTCDate();value.setUTCDate(1);value.setUTCMonth(value.getUTCMonth()-months);
  const last=new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()+1,0)).getUTCDate();value.setUTCDate(Math.min(day,last));return value.toISOString().slice(0,10);
}
function historyRequestDates(asOf){
  const range=state.historyRange||'all';
  if(range==='all')return{historyStart:null,historyEnd:null};
  if(range==='custom')return{historyStart:state.historyStart||null,historyEnd:state.historyEnd||null};
  if(!historyValidDate(asOf))return{historyStart:null,historyEnd:null};
  const start=range==='week'?historyShift(asOf,-6):range==='month'||range==='quarter'?historyShift(historyMonthBack(asOf,range==='month'?1:3),1):null;
  return{historyStart:start,historyEnd:asOf};
}
function historyRangeFor(history,range=state.historyRange||'all'){
  if(!historyValidDate(history?.start)||!historyValidDate(history?.end))return{start:'',end:'',days:0};
  let start=history.start,end=history.end;
  if(range==='week')start=historyShift(end,-6);
  if(range==='month'||range==='quarter')start=historyShift(historyMonthBack(end,range==='month'?1:3),1);
  if(range==='custom'){
    if(historyValidDate(state.historyStart))start=state.historyStart;
    if(historyValidDate(state.historyEnd))end=state.historyEnd;
  }
  start=start<history.start?history.start:start>history.end?history.end:start;
  end=end>history.end?history.end:end<history.start?history.start:end;
  if(start>end)start=end;
  return{start,end,days:historyDays(start,end)};
}
function historyVisibleRows(history,range=historyRangeFor(history),group=state.historyGroup||'day'){
  const daily=(history?.daily||[]).filter(row=>historyValidDate(row.date)&&row.date>=range.start&&row.date<=range.end);
  if(!['week','month'].includes(group))return daily;
  const buckets=[];
  for(const row of daily){
    const key=group==='month'?row.date.slice(0,7):historyShift(row.date,-((new Date(row.date+'T00:00:00Z').getUTCDay()+6)%7));
    const previous=buckets.at(-1);
    // A bucket is its last observed day, never the sum of cumulative daily values.
    if(previous?.bucket===key)buckets[buckets.length-1]={...row,bucket:key,bucketStart:previous.bucketStart};
    else buckets.push({...row,bucket:key,bucketStart:row.date});
  }
  return buckets;
}
function historyContext(){
  const history=state.report?.history,range=historyRangeFor(history),rows=historyVisibleRows(history,range),metric=historyMetric();
  const selected=rows.find(row=>row.date===state.historyDate)||rows.at(-1)||null;
  return{history,range,rows,metric,selected};
}
function historyStatus(point){
  if(!historyKnown(point?.latest))return'기록 없음';
  if(point.complete===true)return'당일 확인';
  if(point.status==='stale'||!point.count)return`이전 기록 유지${point.newest?` · 마지막 ${point.newest}`:''}`;
  return`일부 확인 · ${historyCoverage(point)}${point.stale?' · 이전 기록 포함':''}`;
}
function historyDayKey(date){
  return state.user&&state.tab==='history'?[state.user.id,state.user.role,state.user.teamId||'',state.scope,state.teamId||'',state.reportRequest||0,state.metric,typeof isDemoMode==='function'&&isDemoMode()?state.data?.demo?.personaId||'demo':'live',date].join('|'):'';
}
function historySelectionMarkup(row,metric=historyMetric()){
  if(!row)return'<p class="gh-empty">선택할 기록이 없어요.</p>';
  const [key,label,unit]=metric,point=row.metrics?.[key],change=point?.change;
  return`<div class="gh-selection-number"><span>${historyEscape(row.date)} · ${historyEscape(label)}</span><strong>${historyNumber(point?.latest)}${historyKnown(point?.latest)?`<small>${unit}</small>`:''}</strong><p>${historyEscape(historyStatus(point))} · 전일 대비 ${historySigned(change?.delta)}${historyKnown(change?.delta)&&change.complete!==true?' (일부 비교)':''}</p></div><button type="button" class="gh-detail-button" data-history-action="day" data-history-date="${historyEscape(row.date)}">이 날짜의 채널 내역 <span aria-hidden="true">↗</span></button>`;
}
function historyHoverText(row,metric=historyMetric()){
  if(!row)return'날짜를 선택하세요';
  const point=row.metrics?.[metric[0]],date=`${Number(row.date.slice(5,7))}.${Number(row.date.slice(8,10))}`;
  return`${date} · ${historyNumber(point?.latest)}${historyKnown(point?.latest)?metric[2]:''}${point?.complete?'':historyKnown(point?.latest)?' · 이전·일부 기록':''}`;
}
function historyChannelMarkup(row,metric=historyMetric()){
  const current=row&&historyDayCache.key===historyDayKey(row.date),result=current?historyDayCache.result:null;
  if(!current)return'';
  if(historyDayCache.loading)return'<p class="gh-channel-status" role="status">채널 내역을 불러오고 있어요.</p>';
  if(historyDayCache.error)return`<div class="gh-channel-status" role="status">${historyEscape(historyDayCache.error)} <button type="button" data-history-action="day" data-history-date="${historyEscape(row.date)}">다시 불러오기</button></div>`;
  if(!result)return'';
  const [key,label]=metric;
  return`<details class="gh-channels" open><summary>${historyEscape(row.date)} 채널 내역 <span>${(result.groups||[]).length}개</span></summary><div class="gh-table-scroll" tabindex="0" role="region" aria-label="선택 날짜 채널 내역"><table><thead><tr><th>채널</th><th>${historyEscape(label)}</th><th>전일 대비</th><th>확인 범위</th></tr></thead><tbody>${(result.groups||[]).map(group=>{const point=group.metrics?.[key],day=point?.day;return`<tr><th scope="row">${historyEscape(group.name||group.label||group.id||'채널')}</th><td>${historyNumber(point?.latest)}</td><td>${historySigned(day?.delta)}${historyKnown(day?.delta)?`<small>${day.complete?'':'일부 비교 · '}${historyNumber(day.count)}/${historyNumber(day.eligible)}개 비교</small>`:''}</td><td>${historyEscape(historyCoverage(point))}${point?.stale?' · 이전 기록 포함':''}</td></tr>`;}).join('')||'<tr><td colspan="4">확인한 채널 기록이 없어요.</td></tr>'}</tbody></table></div></details>`;
}
function historyChartGeometry(rows,key,mobile=false){
  const width=mobile?360:820,height=mobile?260:310,left=mobile?49:64,right=mobile?16:22,top=20,bottom=36;
  const values=rows.map(row=>row.metrics?.[key]?.latest).filter(historyKnown),low=values.reduce((value,next)=>Math.min(value,next),0),high=values.reduce((value,next)=>Math.max(value,next),0),padding=(high-low||1)*.08,min=low<0?low-padding:0,max=high>0?high+padding:low===0?1:0;
  const x=index=>left+(rows.length<2?.5:index/(rows.length-1))*(width-left-right),y=value=>top+(max-value)/(max-min||1)*(height-top-bottom);
  return{width,height,left,right,top,bottom,min,max,x,y};
}
function historyChartMarkup(rows,selected,metric){
  const [key,label,unit]=metric,selectedIndex=Math.max(0,rows.findIndex(row=>row.date===selected?.date));
  if(!rows.some(row=>historyKnown(row.metrics?.[key]?.latest)))return'<div class="gh-empty"><strong>이 기간에는 확인한 기록이 없어요</strong><p>미수집 값은 0으로 채우지 않아요. 다른 기간이나 지표를 골라 보세요.</p></div>';
  const svg=mobile=>{
    const g=historyChartGeometry(rows,key,mobile),{width,height,left,right,top,bottom,min,max,x,y}=g;
    const compact=value=>Math.abs(value)>=1e8?`${historyNumber(value/1e8)}억`:Math.abs(value)>=1e4?`${historyNumber(value/1e4)}만`:historyNumber(value);
    const grid=[max,(min+max)/2,min].map(value=>`<line class="gh-grid" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="gh-axis" x="${left-10}" y="${y(value)+4}" text-anchor="end">${historyEscape(compact(value))}</text>`).join('');
    let curves='',run=[],kind='';
    const flush=()=>{if(run.length>1)curves+=`<polyline class="gh-line${kind==='stale'?' is-stale':''}" points="${run.map(index=>`${x(index).toFixed(2)},${y(rows[index].metrics[key].latest).toFixed(2)}`).join(' ')}"/>`;run=[];};
    for(let i=0;i<rows.length;i++){
      const point=rows[i].metrics?.[key],nextKind=point?.complete?'exact':point?.status==='stale'&&point.latestCount===point.eligible?'stale':'partial';
      if(!historyKnown(point?.latest)||nextKind==='partial'){flush();kind='';continue;}
      if(kind&&kind!==nextKind){const previous=run.at(-1);flush();if(previous!==undefined)run.push(previous);}
      kind=nextKind;run.push(i);
    }
    flush();
    const dots=rows.map((row,i)=>{const point=row.metrics?.[key],isolated=!rows[i-1]?.metrics?.[key]?.complete&&!rows[i+1]?.metrics?.[key]?.complete;return historyKnown(point?.latest)&&(!point.complete||isolated)?`<circle class="gh-dot${point.complete?'':' is-partial'}" cx="${x(i)}" cy="${y(point.latest)}" r="3"/>`:'';}).join('');
    const active=selected?.metrics?.[key]?.latest;
    const tickIndexes=[...new Set((mobile?[0,.5,1]:[0,.25,.5,.75,1]).map(part=>Math.round(part*(rows.length-1))))];
    const dateTicks=tickIndexes.map(index=>`<text class="gh-axis gh-date-tick" x="${x(index)}" y="${height-9}" text-anchor="${index===0?'start':index===rows.length-1?'end':'middle'}">${historyEscape(rows[index].date.slice(5).replace('-','.'))}</text>`).join('');
    return`<svg class="gh-svg ${mobile?'is-mobile':'is-desktop'}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${grid}${curves}${dots}<g class="gh-cursor"><line data-history-crosshair x1="${x(selectedIndex)}" x2="${x(selectedIndex)}" y1="${top}" y2="${height-bottom}"/><circle data-history-active cx="${x(selectedIndex)}" cy="${historyKnown(active)?y(active):top}" r="5"${historyKnown(active)?'':' visibility="hidden"'}/></g>${dateTicks}</svg>`;
  };
  return`<div class="gh-chart" data-history-chart tabindex="0" role="slider" aria-label="${historyEscape(label)} 누적 추이 날짜 선택" aria-valuemin="0" aria-valuemax="${rows.length-1}" aria-valuenow="${selectedIndex}" aria-valuetext="${historyEscape(`${selected?.date} ${historyNumber(selected?.metrics?.[key]?.latest)}${unit}`)}" aria-describedby="gh-chart-help">${svg(false)}${svg(true)}</div><p id="gh-chart-help" class="gh-chart-help">차트를 가리키거나 눌러 날짜를 선택하세요. 키보드는 ← →, 처음과 끝은 Home·End.</p>`;
}
function growthHistoryPage(report=state.report){
  const history=report?.history,range=historyRangeFor(history),rows=historyVisibleRows(history,range),metric=historyMetric(),[key,label,unit]=metric;
  const selected=rows.find(row=>row.date===state.historyDate)||rows.at(-1)||null;
  const metricButton=([value,name])=>`<button type="button" data-history-action="metric" data-history-value="${value}" aria-pressed="${value===key}">${historyEscape(name)}</button>`;
  const controls=`<div class="gh-toolbar"><div class="gh-metrics" role="group" aria-label="전체 추이 지표">${HISTORY_METRICS.slice(0,3).map(metricButton).join('')}</div><details class="gh-more-metrics"${HISTORY_METRICS.slice(3).some(([value])=>value===key)?' open':''}><summary>다른 지표</summary><div>${HISTORY_METRICS.slice(3).map(metricButton).join('')}</div></details></div>`;
  if(!history)return`<section class="growth-history" aria-label="전체 추이">${controls}<div class="gh-empty" role="status">${report?'아직 확인한 기록이 없어요.':'전체 기록을 불러오고 있어요.'}</div></section>`;
  if(!range.start)return`<section class="growth-history" aria-label="전체 추이">${controls}<div class="gh-empty"><strong>첫 기록을 기다리고 있어요</strong><p>채널의 기록이 쌓이면 처음부터 지금까지의 흐름을 볼 수 있어요.</p></div></section>`;
  const selection=history.selection,selectionMatches=selection&&selection.start===range.start&&selection.end===range.end;
  const summary=selectionMatches?selection.metrics?.[key]:(!state.historyRange||state.historyRange==='all')&&!selection?history.metrics?.[key]:null;
  const change=summary?.change,endpoint=history.daily.find(row=>row.date===range.end)?.metrics?.[key];
  const elapsed=change?.baseDate&&historyValidDate(change.baseDate)?historyDays(change.baseDate,range.end)-1:0;
  const average=change?.complete&&historyKnown(change.delta)&&elapsed>0?change.delta/elapsed:null;
  const daily=history.daily.filter(row=>row.date>range.start&&row.date<=range.end),exactDays=daily.filter(row=>row.metrics?.[key]?.change?.complete&&historyKnown(row.metrics[key].change.delta));
  const best=exactDays.reduce((winner,row)=>!winner||row.metrics[key].change.delta>winner.metrics[key].change.delta?row:winner,null);
  const stat=(title,value,note,signed=false)=>`<article class="gh-stat"><span>${title}</span><strong>${signed?historySigned(value):historyNumber(value)}${historyKnown(value)?`<small>${unit}</small>`:''}</strong><p>${historyEscape(note)}</p></article>`;
  const presets=[['week','1주'],['month','1개월'],['quarter','3개월'],['all','전체']].map(([value,name])=>`<button type="button" data-history-action="range" data-history-value="${value}" aria-pressed="${(state.historyRange||'all')===value}">${name}</button>`).join('');
  const groupButtons=[['day','일'],['week','주'],['month','월']].map(([value,name])=>`<button type="button" data-history-action="group" data-history-value="${value}" aria-pressed="${(state.historyGroup||'day')===value}">${name}</button>`).join('');
  return`<section class="growth-history" aria-label="전체 추이">${controls}<div class="gh-range-toolbar"><div class="gh-presets" role="group" aria-label="추이 기간">${presets}</div><div class="gh-group" role="group" aria-label="추이 표시 간격">${groupButtons}</div><details class="gh-custom"${state.historyRange==='custom'?' open':''}><summary>날짜 직접 선택</summary><form data-history-form="range"><label>시작일<input type="date" data-history-field="start" name="historyStart" value="${range.start}" min="${history.start}" max="${history.end}" required></label><label>종료일<input type="date" data-history-field="end" name="historyEnd" value="${range.end}" min="${history.start}" max="${history.end}" required></label><button type="submit">적용</button><p class="gh-range-error" role="alert"></p></form></details></div><div class="gh-period-caption"><span>${range.start} — ${range.end}</span><span>${range.days}일 · ${state.historyGroup==='week'?'주 마지막 날짜':state.historyGroup==='month'?'월 마지막 날짜':'일별'} 누적값</span></div><div class="gh-stats" aria-busy="${Boolean(state.loading&&!selectionMatches)}">${stat('종료일 기준 누적',endpoint?.latest,historyStatus(endpoint))}${stat('선택 시작일 대비',change?.delta,historyKnown(change?.delta)?`${change.complete&&historyKnown(change.rate)?historySigned(change.rate)+'% · ':''}${change.baseDate||range.start} 기준 · ${change.complete?'전체':'일부'} 대상 비교`:state.loading&&!selectionMatches?'선택 기간을 불러오고 있어요':'두 날짜의 비교 기록이 더 필요해요',true)}${stat('일평균 증감',average,historyKnown(average)?`${elapsed}일 · 같은 대상의 양 끝 기록 확인`:'기간 전체를 비교할 수 있을 때 표시',true)}${stat('최고 성장일',best?.metrics?.[key]?.change?.delta,best?`${best.date} · 비교 완료 ${exactDays.length}/${daily.length}일 중`:'전일 대비 확인한 기록이 없어요',true)}</div><div class="gh-chart-heading"><h2>${historyEscape(label)} 누적 추이</h2><span data-history-hover-summary>${historyEscape(historyHoverText(selected,metric))}</span></div>${historyChartMarkup(rows,selected,metric)}<div class="gh-legend"><span><i></i>당일 확인</span><span><i class="is-stale"></i>이전 기록 유지</span><span><i class="is-partial"></i>일부 확인</span></div><div class="gh-selection" data-history-selection aria-live="polite">${historySelectionMarkup(selected,metric)}</div><div data-history-channels>${historyChannelMarkup(selected,metric)}</div><details class="gh-method"><summary>기록과 계산 기준</summary><p>누적값은 선택한 날까지 각 대상에서 마지막으로 확인한 수치의 합이에요. 점선은 이전 기록을 유지한 구간, 빈 점은 일부만 확인한 값이에요. 기록 없는 구간은 0으로 채우지 않아요.</p><p>주·월 보기는 각 구간의 마지막 날짜를 보여줘요. 선택 시작일의 누적 기록을 기준으로 마지막 날까지 같은 대상의 증감을 비교해요. 일평균은 두 날짜 사이의 일수로 나누며, 하루만 선택하면 표시하지 않아요. 최고 성장일은 시작일 다음 날부터 전일 대비를 모두 확인한 날 가운데 골라요. 날짜별 누적값을 더하지 않아요.</p></details></section>`;
}

function historyPaintSelection(){
  if(state.tab!=='history')return;
  const {rows,metric,selected}=historyContext();if(!selected)return;
  const index=rows.indexOf(selected),point=selected.metrics?.[metric[0]],chart=document.querySelector('[data-history-chart]');
  if(chart){chart.setAttribute('aria-valuenow',String(index));chart.setAttribute('aria-valuetext',`${selected.date} ${historyNumber(point?.latest)}${metric[2]} · ${historyStatus(point)}`);
    for(const svg of chart.querySelectorAll('svg')){const g=historyChartGeometry(rows,metric[0],svg.classList.contains('is-mobile')),line=svg.querySelector('[data-history-crosshair]'),dot=svg.querySelector('[data-history-active]');line?.setAttribute('x1',g.x(index));line?.setAttribute('x2',g.x(index));dot?.setAttribute('cx',g.x(index));dot?.setAttribute('cy',historyKnown(point?.latest)?g.y(point.latest):g.top);dot?.setAttribute('visibility',historyKnown(point?.latest)?'visible':'hidden');}}
  const selection=document.querySelector('[data-history-selection]');if(selection)selection.innerHTML=historySelectionMarkup(selected,metric);
  const hover=document.querySelector('[data-history-hover-summary]');if(hover)hover.textContent=historyHoverText(selected,metric);
  const channels=document.querySelector('[data-history-channels]');if(channels)channels.innerHTML=historyChannelMarkup(selected,metric);
}
function historySelectDate(date){
  if(!historyContext().rows.some(row=>row.date===date))return;
  if(state.historyDate===date)return;
  state.historyDate=date;historyPaintSelection();
}
async function historyLoadDay(date){
  const key=historyDayKey(date);if(!key||!historyContext().rows.some(row=>row.date===date))return;
  state.historyDate=date;
  if(historyDayCache.key===key&&(historyDayCache.loading||historyDayCache.result)){historyPaintSelection();return;}
  const request=++historyDayCache.request;Object.assign(historyDayCache,{key,result:null,error:'',loading:true});historyPaintSelection();
  try{
    const result=await api('/api/day?'+query({date,start:undefined,end:undefined,history:undefined,growth:undefined}));
    if(request===historyDayCache.request&&key===historyDayKey(state.historyDate))historyDayCache.result=result;
  }catch(error){if(request===historyDayCache.request&&key===historyDayKey(state.historyDate))historyDayCache.error=error.message||'채널 내역을 불러오지 못했어요.';}
  finally{if(request===historyDayCache.request){historyDayCache.loading=false;if(key===historyDayKey(state.historyDate))historyPaintSelection();}}
}
function historyApplyRange(range,start='',end=''){
  const history=state.report?.history;if(!history?.start)return;
  state.historyRange=range;if(range==='custom'){state.historyStart=start;state.historyEnd=end;}
  const dates=historyRangeFor(history,range);state.historyStart=dates.start;state.historyEnd=dates.end;state.historyDate='';historyDayCache.request++;Object.assign(historyDayCache,{key:'',result:null,loading:false,error:''});
  if(typeof loadHistoryReport==='function')void loadHistoryReport();else render();
}
document.addEventListener('click',event=>{
  if(state.tab!=='history')return;
  const button=event.target.closest('[data-history-action]');
  if(button){const action=button.dataset.historyAction,value=button.dataset.historyValue;
    if(action==='metric'&&HISTORY_METRICS.some(([key])=>key===value)){state.metric=value;render();}
    if(action==='range'&&['week','month','quarter','all'].includes(value))historyApplyRange(value);
    if(action==='group'&&['day','week','month'].includes(value)){state.historyGroup=value;state.historyDate='';render();}
    if(action==='day')void historyLoadDay(button.dataset.historyDate);
    return;
  }
  const chart=event.target.closest('[data-history-chart]');if(chart){historyPointerSelect(event,chart);chart.focus();}
});
function historyPointerSelect(event,chart){
  const {rows,metric}=historyContext();if(!rows.length)return;
  const visible=[...chart.querySelectorAll('svg')].find(svg=>svg.getBoundingClientRect().width>0);
  const rect=visible?.getBoundingClientRect()||chart.getBoundingClientRect(),g=historyChartGeometry(rows,metric[0],visible?.classList.contains('is-mobile')===true),plotX=(event.clientX-rect.left)/rect.width*g.width;
  const index=Math.max(0,Math.min(rows.length-1,Math.round((plotX-g.left)/(g.width-g.left-g.right)*(rows.length-1))));historySelectDate(rows[index].date);
}
document.addEventListener('pointermove',event=>{if(state.tab!=='history'||event.pointerType==='touch')return;const chart=event.target.closest('[data-history-chart]');if(chart)historyPointerSelect(event,chart);});
document.addEventListener('keydown',event=>{
  if(state.tab!=='history'||!event.target.closest('[data-history-chart]'))return;
  const {rows,selected}=historyContext();if(!rows.length)return;
  let index=rows.indexOf(selected);
  if(event.key==='ArrowLeft'||event.key==='ArrowDown')index--;
  else if(event.key==='ArrowRight'||event.key==='ArrowUp')index++;
  else if(event.key==='Home')index=0;else if(event.key==='End')index=rows.length-1;
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();void historyLoadDay(selected.date);return;}else return;
  event.preventDefault();historySelectDate(rows[Math.max(0,Math.min(rows.length-1,index))].date);
});
document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-history-form="range"]');if(!form||state.tab!=='history')return;event.preventDefault();
  const start=form.elements.historyStart.value,end=form.elements.historyEnd.value,history=state.report?.history;
  if(!historyValidDate(start)||!historyValidDate(end)||start>end||start<history?.start||end>history?.end){const error=form.querySelector('.gh-range-error');if(error)error.textContent='기록이 있는 범위에서 시작일과 종료일을 확인해 주세요.';return;}
  historyApplyRange('custom',start,end);
});
