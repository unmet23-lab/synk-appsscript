'use strict';

const TEAM_TREND_METRICS=[['views','조회수','회'],['likes','좋아요','개'],['shares','공유','회'],['comments','댓글','개'],['saves','저장','회'],['reach','도달','명'],['followers','팔로워·구독자','명']];
const teamTrends={key:'',identity:'',result:null,error:'',loading:false,request:0,selectedId:'',compareId:'all',metric:'likes',range:'month',start:'',end:'',mode:'total',date:''};
const ttEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ttKnown=value=>typeof value==='number'&&Number.isFinite(value);
const ttNumber=value=>ttKnown(value)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value):'—';
const ttSigned=value=>ttKnown(value)?`${value>0?'+':''}${ttNumber(value)}`:'—';
const ttDefinition=()=>TEAM_TREND_METRICS.find(([key])=>key===teamTrends.metric)||TEAM_TREND_METRICS[1];
const ttActive=()=>state.user&&state.tab==='overview'&&state.scope==='team'&&state.marketingView!=='channels';
const ttIdentity=()=>[state.user?.id,state.user?.role,state.user?.teamId||'',typeof isDemoMode==='function'&&isDemoMode()?state.data?.demo?.personaId||'demo':'live'].join('|');
function ttDates(){const end=teamTrends.range==='custom'?teamTrends.end||reportToday():reportToday();return{end,start:teamTrends.range==='custom'?teamTrends.start||shiftDate(end,-29):shiftDate(end,teamTrends.range==='week'?-6:teamTrends.range==='quarter'?-89:-29)};}
function ttKey(){const dates=ttDates();return [ttIdentity(),teamTrends.metric,teamTrends.range,dates.start,dates.end].join('|');}
function resetTeamTrends(){teamTrends.request++;Object.assign(teamTrends,{key:'',result:null,error:'',loading:false});}
async function loadTeamTrends(force=false){
  if(!ttActive())return;
  const identity=ttIdentity();
  if(teamTrends.identity!==identity){resetTeamTrends();Object.assign(teamTrends,{identity,selectedId:state.teamId||'',compareId:'all',date:''});}
  const key=ttKey();if(!force&&teamTrends.key===key&&(teamTrends.result||teamTrends.loading))return;
  const request=++teamTrends.request;Object.assign(teamTrends,{key,result:null,error:'',loading:true});render();
  try{
    const result=await api('/api/team-trends?'+new URLSearchParams({...ttDates(),metric:teamTrends.metric,range:teamTrends.range}));
    if(request!==teamTrends.request||key!==ttKey()||!ttActive())return;
    teamTrends.result=result;
    if(!result.teams.some(team=>team.id===teamTrends.selectedId))teamTrends.selectedId=result.ownTeamId||result.teams[0]?.id||'';
    if(!['all','none'].includes(teamTrends.compareId)&&!result.teams.some(team=>team.id===teamTrends.compareId))teamTrends.compareId='all';
    teamTrends.date=result.end;
  }catch(error){if(request===teamTrends.request&&key===ttKey()&&ttActive())teamTrends.error=error.message||'팀 추이를 불러오지 못했어요.';}
  finally{if(request===teamTrends.request){teamTrends.loading=false;if(ttActive())render();}}
}
function ttSelected(){return teamTrends.result?.teams.find(team=>team.id===teamTrends.selectedId)||null;}
function ttVisible(){const teams=teamTrends.result?.teams||[],selected=ttSelected();return selected?[selected,...teams.filter(team=>team.id!==selected.id&&(teamTrends.compareId==='all'||team.id===teamTrends.compareId))]:[];}
const ttColor=index=>'tt-series-'+index%6;
const ttValue=point=>teamTrends.mode==='change'?point?.change?.delta:point?.latest;
const ttComplete=point=>teamTrends.mode==='change'?point?.change?.complete===true:point?.complete===true;
const ttStatus=point=>!ttKnown(ttValue(point))?'기록 없음':ttComplete(point)?'확인된 값':teamTrends.mode==='total'&&!point?.count?'이전 기록 유지':'일부 기록';
function ttDateMarkup(){
  const teams=ttVisible(),[,label,unit]=ttDefinition(),date=teamTrends.date||teamTrends.result?.end;
  return `<h3>${ttEscape(date)} · ${ttEscape(label)}</h3><div class="tt-day-grid">${teams.map((team,index)=>{const point=team.series.find(row=>row.date===date),value=ttValue(point);return`<article><span><i class="${ttColor(index)}" aria-hidden="true"></i>${ttEscape(team.name)}${team.isOwn?' <small>내 팀</small>':''}</span><strong>${teamTrends.mode==='change'?ttSigned(value):ttNumber(value)}${ttKnown(value)?`<small>${unit}</small>`:''}</strong><p>${ttStatus(point)}</p></article>`;}).join('')}</div>`;
}
function ttChart(){
  const teams=ttVisible(),dates=ttSelected()?.series.map(row=>row.date)||[],[,label,unit]=ttDefinition();
  const values=teams.flatMap(team=>team.series.map(ttValue)).filter(ttKnown);
  if(!values.length)return'<div class="tt-empty"><strong>이 지표의 기록을 기다리고 있어요</strong><p>수집하지 않았거나 플랫폼에서 제공하지 않는 수치는 0으로 표시하지 않아요.</p></div>';
  const nice=value=>{const magnitude=10**Math.floor(Math.log10(Math.abs(value)||1)),scaled=Math.abs(value)/magnitude;return([1,2,5,10].find(step=>step>=scaled)||10)*magnitude;};
  const lower=values.reduce((value,next)=>Math.min(value,next),0),upper=values.reduce((value,next)=>Math.max(value,next),0),min=lower<0?-nice(lower):0,max=upper>0?nice(upper):lower===0?1:0;
  const compact=value=>Math.abs(value)>=1e8?`${ttNumber(value/1e8)}억`:Math.abs(value)>=1e4?`${ttNumber(value/1e4)}만`:ttNumber(value);
  const svg=mobile=>{
    const width=mobile?360:820,height=mobile?260:300,left=mobile?48:62,right=16,top=20,bottom=36;
    const x=index=>left+(dates.length<2?.5:index/(dates.length-1))*(width-left-right),y=value=>top+(max-value)/(max-min||1)*(height-top-bottom);
    const grid=[max,(max+min)/2,min].map(value=>`<line class="tt-grid" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="tt-axis" x="${left-10}" y="${y(value)+4}" text-anchor="end">${ttEscape(compact(value))}</text>`).join('');
    const lines=teams.map((team,index)=>{
      let run=[],kind='',paths='';
      const flush=()=>{if(run.length>1)paths+=`<polyline class="tt-line${kind==='stale'?' is-stale':''}" points="${run.map(i=>`${x(i)},${y(ttValue(team.series[i]))}`).join(' ')}"/>`;run=[];};
      for(let i=0;i<team.series.length;i++){
        const point=team.series[i],value=ttValue(point),next=ttComplete(point)?'exact':teamTrends.mode==='total'&&!point.count&&point.latestCount===point.eligible?'stale':'partial';
        if(!ttKnown(value)||next==='partial'){flush();kind='';continue;}
        if(kind&&kind!==next){const last=run.at(-1);flush();if(last!==undefined)run.push(last);}
        kind=next;run.push(i);
      }
      flush();
      const dots=team.series.map((point,i)=>{const value=ttValue(point);if(!ttKnown(value))return'';return`<circle class="tt-dot${ttComplete(point)?'':' is-partial'}" cx="${x(i)}" cy="${y(value)}" r="${index===0?3:2.5}"><title>${ttEscape(`${team.name} · ${point.date} · ${label} ${teamTrends.mode==='change'?ttSigned(value):ttNumber(value)}${unit} · ${ttStatus(point)}`)}</title></circle>`;}).join('');
      return`<g class="${ttColor(index)} ${index===0?'is-selected':'is-comparison'}">${paths}${dots}</g>`;
    }).join('');
    const ticks=[...new Set((mobile?[0,.5,1]:[0,.25,.5,.75,1]).map(part=>Math.round(part*(dates.length-1))))].map(i=>`<text class="tt-axis" x="${x(i)}" y="${height-8}" text-anchor="${i===0?'start':i===dates.length-1?'end':'middle'}">${ttEscape(dates[i].slice(5).replace('-','.'))}</text>`).join('');
    const cursor=x(Math.max(0,dates.indexOf(teamTrends.date)));
    return`<svg class="tt-svg ${mobile?'is-mobile':'is-desktop'}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ttEscape(`${label} ${teamTrends.mode==='change'?'하루 증감':'누적'} 추이 · ${teams.map(team=>team.name).join(', ')} · ${teamTrends.result.start}부터 ${teamTrends.result.end} · 단위 ${unit}`)}">${grid}${lines}<line class="tt-cursor" data-team-trend-cursor x1="${cursor}" x2="${cursor}" y1="${top}" y2="${height-bottom}"/>${ticks}</svg>`;
  };
  return`<div class="tt-chart">${svg(false)}${svg(true)}</div>`;
}
function teamTrendsSection(){
  const result=teamTrends.key===ttKey()?teamTrends.result:null,selected=result?ttSelected():null,[key,label,unit]=ttDefinition();
  const metrics=`<div class="tt-metrics" role="group" aria-label="팀 추이 지표">${TEAM_TREND_METRICS.map(([id,name])=>`<button type="button" data-team-trend-action="metric" data-team-trend-value="${id}" aria-pressed="${id===key}">${ttEscape(name)}</button>`).join('')}</div>`;
  const head=`<header class="tt-heading"><div><h2>팀별 추이 비교</h2></div>${result?.ownTeamId?'<button type="button" class="btn small" data-team-trend-action="own">내 팀 보기</button>':''}</header>`;
  const presets=`<div class="tt-presets" role="group" aria-label="팀 추이 기간">${[['week','1주'],['month','1개월'],['quarter','3개월'],['all','전체']].map(([id,name])=>`<button type="button" data-team-trend-action="range" data-team-trend-value="${id}" aria-pressed="${teamTrends.range===id}">${name}</button>`).join('')}</div>`;
  const custom=`<details class="tt-custom"${teamTrends.range==='custom'?' open':''}><summary>날짜 직접 선택</summary><form data-team-trend-form><label>시작일<input type="date" name="start" value="${ttEscape(result?.start||ttDates().start)}" max="${reportToday()}" required></label><label>종료일<input type="date" name="end" value="${ttEscape(result?.end||ttDates().end)}" max="${reportToday()}" required></label><button class="btn small" type="submit">적용</button><p class="tt-form-error" role="alert"></p></form></details>`;
  const toolbar=`${metrics}<div class="tt-range-tools">${presets}${custom}</div>`;
  if(teamTrends.error&&teamTrends.key===ttKey())return`<section class="team-trends">${head}${toolbar}<div class="tt-empty" role="status"><p>${ttEscape(teamTrends.error)}</p><button class="btn small" data-team-trend-action="retry">다시 불러오기</button></div></section>`;
  if(!result)return`<section class="team-trends" aria-busy="true">${head}${toolbar}<div class="tt-empty" role="status">팀별 추이를 불러오고 있어요.</div></section>`;
  if(!selected)return`<section class="team-trends">${head}${toolbar}<div class="tt-empty"><strong>등록된 팀이 아직 없어요</strong><p>팀에 채널을 배정하면 좋아요·공유 등 기록을 함께 볼 수 있어요.</p>${typeof isAdmin==='function'&&isAdmin()?button('팀·크루 관리','tab','users','small','data-tab="members"'):''}</div></section>`;
  const teams=result.teams,summary=selected.summary,period=summary.period,option=team=>`<option value="${ttEscape(team.id)}">${ttEscape(team.name)}${team.isOwn?' · 내 팀':''}</option>`;
  const choose=`<div class="tt-team-tools"><label>추이를 볼 팀<select data-team-trend-team aria-label="추이를 볼 팀">${teams.map(team=>option(team).replace('<option ',`<option ${team.id===selected.id?'selected ':''}`)).join('')}</select></label><label>비교할 팀<select data-team-trend-compare aria-label="비교할 팀"><option value="all"${teamTrends.compareId==='all'?' selected':''}>모든 팀</option><option value="none"${teamTrends.compareId==='none'?' selected':''}>선택한 팀만</option>${teams.filter(team=>team.id!==selected.id).map(team=>option(team).replace('<option ',`<option ${team.id===teamTrends.compareId?'selected ':''}`)).join('')}</select></label></div>`;
  const amount=(value,signed=false)=>`${signed?ttSigned(value):ttNumber(value)}${ttKnown(value)?`<small>${unit}</small>`:''}`;
  const stats=`<div class="tt-stats"><article class="tt-stat is-key"><span>${ttEscape(selected.name)}${selected.isOwn?' · 내 팀':''}</span><h3>종료일 기준 ${ttEscape(label)}</h3><strong>${amount(summary.latest)}</strong><p>당일 확인 ${ttNumber(summary.count)}/${ttNumber(summary.eligible)}개${summary.stale?' · 이전 기록 포함':''}</p></article><article class="tt-stat"><span>${ttEscape(result.start)} — ${ttEscape(result.end)}</span><h3>선택 기간 증감</h3><strong>${amount(period.delta,true)}</strong><p>${period.complete?'전체 대상 비교':'일부 또는 비교할 기록 부족'} · ${ttNumber(period.count)}/${ttNumber(period.eligible)}개${ttKnown(period.rate)?` · ${ttSigned(period.rate)}%`:''}</p></article></div>`;
  const modes=`<div class="tt-chart-head"><h3>${ttEscape(label)} ${teamTrends.mode==='change'?'하루 증감':'누적'} 추이</h3><div class="tt-modes" role="group" aria-label="팀 추이 표시 방식">${[['total','누적'],['change','하루 증감']].map(([id,name])=>`<button type="button" data-team-trend-action="mode" data-team-trend-value="${id}" aria-pressed="${teamTrends.mode===id}">${name}</button>`).join('')}</div></div>`;
  const visible=ttVisible(),legend=`<div class="tt-legend">${visible.map((team,index)=>`<span><i class="${ttColor(index)}" aria-hidden="true"></i>${ttEscape(team.name)}${team.isOwn?' · 내 팀':''}${index===0?' · 선택':''}</span>`).join('')}</div>`;
  const dates=selected.series.map(row=>row.date),index=Math.max(0,dates.indexOf(teamTrends.date));
  const slider=`<label class="tt-date-control">날짜별 수치<input type="range" min="0" max="${Math.max(0,dates.length-1)}" value="${index}" data-team-trend-date aria-label="팀 추이 날짜 선택" aria-valuetext="${ttEscape(teamTrends.date)}"${dates.length<2?' disabled':''}><small>← → 키로 날짜를 바꿀 수 있어요.</small></label><div class="tt-date-values" data-team-trend-date-values aria-live="polite">${ttDateMarkup()}</div>`;
  const table=`<details class="tt-records"><summary>일별 수치 펼치기</summary><div class="tt-table-scroll" role="region" aria-label="팀별 일별 수치" tabindex="0"><table><caption>${ttEscape(label)} ${teamTrends.mode==='change'?'하루 증감':'누적'} · ${unit}</caption><thead><tr><th>날짜</th>${visible.map(team=>`<th>${ttEscape(team.name)}</th>`).join('')}</tr></thead><tbody>${dates.map((date,i)=>`<tr><th scope="row">${date}</th>${visible.map(team=>`<td>${teamTrends.mode==='change'?ttSigned(ttValue(team.series[i])):ttNumber(ttValue(team.series[i]))}<small>${ttStatus(team.series[i])}</small></td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  return`<section class="team-trends" aria-label="팀별 지표 추이">${head}${choose}${toolbar}${stats}<p class="tt-period">${result.start} — ${result.end}${result.limitedHistory?' · 최근 366일까지':''}${!result.ownTeamId?' · 현재 소속 팀 미배정':''}</p>${modes}${legend}${ttChart()}${slider}<p class="tt-method">같은 0 기준과 눈금으로 비교해요. 점선은 이전 기록 유지, 빈 점은 일부 기록이며 미수집 구간은 잇지 않아요. 팀 집계만 공유하며 채널 세부자료의 권한은 유지돼요.${key==='reach'||key==='followers'?' 도달·팔로워는 게시물·계정별 합계로 사람 수의 중복을 제거하지 않아요.':''}</p>${table}</section>`;
}
function ttPaintDate(index){
  const selected=ttSelected(),dates=selected?.series.map(row=>row.date)||[];if(!dates[index])return;
  teamTrends.date=dates[index];
  const box=document.querySelector('[data-team-trend-date-values]');if(box)box.innerHTML=ttDateMarkup();
  const input=document.querySelector('[data-team-trend-date]');if(input){input.value=String(index);input.setAttribute('aria-valuetext',dates[index]);}
  for(const svg of document.querySelectorAll('.tt-svg')){const mobile=svg.classList.contains('is-mobile'),width=mobile?360:820,left=mobile?48:62,x=left+(dates.length<2?.5:index/(dates.length-1))*(width-left-16),cursor=svg.querySelector('[data-team-trend-cursor]');cursor?.setAttribute('x1',String(x));cursor?.setAttribute('x2',String(x));}
}
document.addEventListener('click',async event=>{
  const target=event.target.closest?.('[data-team-trend-action]');if(!target||!ttActive())return;
  const action=target.dataset.teamTrendAction,value=target.dataset.teamTrendValue;
  if(action==='metric'&&TEAM_TREND_METRICS.some(([id])=>id===value)){teamTrends.metric=value;await loadTeamTrends();}
  else if(action==='range'&&['week','month','quarter','all'].includes(value)){teamTrends.range=value;await loadTeamTrends();}
  else if(action==='mode'&&['total','change'].includes(value)){teamTrends.mode=value;render();}
  else if(action==='own'&&teamTrends.result?.ownTeamId){teamTrends.selectedId=teamTrends.result.ownTeamId;if(teamTrends.compareId===teamTrends.selectedId)teamTrends.compareId='all';render();}
  else if(action==='retry')await loadTeamTrends(true);
});
document.addEventListener('change',event=>{
  if(!ttActive())return;const target=event.target;
  if(target.hasAttribute('data-team-trend-team')&&teamTrends.result?.teams.some(team=>team.id===target.value)){teamTrends.selectedId=target.value;if(teamTrends.compareId===target.value)teamTrends.compareId='all';render();}
  if(target.hasAttribute('data-team-trend-compare')&&(['all','none'].includes(target.value)||teamTrends.result?.teams.some(team=>team.id===target.value))){teamTrends.compareId=target.value;render();}
});
document.addEventListener('input',event=>{if(ttActive()&&event.target.hasAttribute('data-team-trend-date'))ttPaintDate(Number(event.target.value));});
document.addEventListener('submit',async event=>{
  const form=event.target.closest?.('[data-team-trend-form]');if(!form||!ttActive())return;event.preventDefault();
  const values=Object.fromEntries(new FormData(form)),days=(Date.parse(values.end)-Date.parse(values.start))/86400000+1;
  if(!values.start||!values.end||!Number.isFinite(days)||days<1||days>366||values.end>reportToday()){form.querySelector('.tt-form-error').textContent='오늘까지 최대 366일의 올바른 기간을 선택해 주세요.';return;}
  Object.assign(teamTrends,{range:'custom',start:values.start,end:values.end});await loadTeamTrends();
});
