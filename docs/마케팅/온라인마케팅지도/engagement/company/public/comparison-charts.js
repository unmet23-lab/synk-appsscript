'use strict';

const COMPARISON_METRICS=[['views','조회수','회'],['likes','좋아요','개'],['followers','팔로워·구독자','명'],['shares','공유','회'],['comments','댓글','개'],['saves','저장','회'],['reach','도달','명']];
const comparisonKnown=value=>typeof value==='number'&&Number.isFinite(value);
const comparisonEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const comparisonNumber=value=>comparisonKnown(value)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value):'—';
function comparisonValue(metric,mode){const value=mode==='period'?metric?.period?.delta:metric?.latest;return comparisonKnown(value)?value:null;}
function comparisonSum(values){const known=values.filter(comparisonKnown);return known.length?known.reduce((sum,value)=>sum+value,0):null;}
function comparisonGroupOptions(scope=state.scope){return scope==='mine'?[['channels','채널별'],['platform','플랫폼별'],['content','콘텐츠별']]:scope==='team'?[['members','담당자별'],['teams','팀별'],['channels','채널별'],['content','콘텐츠별']]:[['teams','팀별'],['members','담당자별'],['channels','채널별'],['platform','플랫폼별'],['content','콘텐츠별']];}
function comparisonGroup(){const options=comparisonGroupOptions();return options.some(([key])=>key===state.comparisonGroup)?state.comparisonGroup:options[0][0];}
function comparisonMetric(){return COMPARISON_METRICS.some(([key])=>key===state.metric)?state.metric:'views';}
function comparisonPlatform(value){const key=String(value||'').toLowerCase();return({youtube:'YouTube',instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',threads:'Threads',x:'X',linkedin:'LinkedIn'})[key]||value||'플랫폼 미지정';}
function comparisonChannelLabel(channel,fallback){return channel?.displayName||[channel?.brand,channel?.handle].filter(Boolean).join(' · ')||fallback||'이름 없는 채널';}
function comparisonCoverage(metric,mode){
  const value=mode==='period'?metric?.period:metric,known=mode==='period'?value?.count:value?.latestCount,eligible=value?.eligible;
  return comparisonKnown(known)&&comparisonKnown(eligible)?`${mode==='period'?'비교':'확인'} ${comparisonNumber(known)}/${comparisonNumber(eligible)}개 대상`:'';
}
function comparisonRows(report,group=comparisonGroup(),metric=comparisonMetric(),mode=state.comparisonMode==='latest'?'latest':'period'){
  if(!report)return[];
  const channels=report.channels||[],channelMap=new Map(channels.map(channel=>[channel.id,channel])),groups=Array.isArray(report.groups)?report.groups:[];
  if(group==='members')return(report.memberGroups||[]).filter(member=>member.channelCount>0).map(member=>({id:member.id,label:member.name||'담당자',value:comparisonValue(member.metrics?.[metric],mode),secondary:[`채널 ${comparisonNumber(member.channelCount)}개`,comparisonCoverage(member.metrics?.[metric],mode)].filter(Boolean).join(' · '),action:'member-filter',attrs:{'data-id':member.id}}));
  if(group==='content')return(report.byPost||[]).map(post=>({id:post.id,label:post.title||'제목 없는 콘텐츠',value:metric==='followers'?null:comparisonValue(post.metrics?.[metric],mode),secondary:comparisonChannelLabel(channelMap.get(post.channelId)||post.account,post.channelId),action:'post-detail',attrs:{'data-id':post.id}}));
  if(group==='channels')return groups.map(item=>({id:item.id,label:comparisonChannelLabel(channelMap.get(item.id),item.label),value:comparisonValue(item.metrics?.[metric],mode),secondary:[comparisonPlatform(channelMap.get(item.id)?.platform),comparisonCoverage(item.metrics?.[metric],mode)].filter(Boolean).join(' · '),action:'channel-detail',attrs:{'data-id':item.id}}));
  const currentTeamCache=typeof teamOverview!=='undefined'&&typeof teamOverviewKey==='function'&&teamOverview.key===teamOverviewKey()&&teamOverview.result&&report.start===state.start&&report.end===state.end?teamOverview.result:null;
  if(group==='teams'&&state.scope==='team'&&currentTeamCache&&!(report.scope?.ownerId||report.scope?.channel||report.scope?.platform)){
    const visibleIds=new Set((state.data?.teams||[]).filter(team=>team.active!==false).map(team=>team.id));
    return(teamOverview.result.teams||[]).filter(team=>visibleIds.has(team.id)).map(team=>({id:team.id,label:team.name,value:comparisonValue(team.metrics?.[metric],mode),secondary:`크루 ${comparisonNumber(team.memberCount)}명 · 채널 ${comparisonNumber(team.channelCount)}개`,action:'team-overview-select',attrs:{'data-id':team.id},selected:state.scope==='team'&&state.teamId===team.id}));
  }
  const buckets=new Map();
  for(const item of groups){const channel=channelMap.get(item.id);if(!channel)continue;const key=group==='teams'?channel.teamId||'':String(channel.platform||'').toLowerCase();if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}
  const teams=new Map((state.data?.teams||[]).map(team=>[team.id,team]));
  return[...buckets].map(([key,items])=>{
    const team=teams.get(key),cached=currentTeamCache?.teams?.find(item=>item.id===key),known=items.filter(item=>comparisonKnown(comparisonValue(item.metrics?.[metric],mode))).length;
    const name=team?.name||channels.find(channel=>channel.teamId===key)?.teamName||(key?'팀 정보 확인 필요':'팀 미배정');
    return{id:key,label:group==='teams'?name+(team?.active===false?' · 운영 종료':''):comparisonPlatform(key),value:comparisonSum(items.map(item=>comparisonValue(item.metrics?.[metric],mode))),secondary:[group==='teams'&&comparisonKnown(cached?.memberCount)?`크루 ${comparisonNumber(cached.memberCount)}명`:'',`채널 ${items.length}개`,`확인값 ${known}/${items.length}`].filter(Boolean).join(' · '),action:group==='teams'?(key&&team&&team.active!==false?'team-overview-select':null):'platform-focus',attrs:group==='teams'?{'data-id':key}:{'data-platform':key}};
  });
}
function comparisonScale(values){
  const known=values.filter(comparisonKnown),minimum=known.reduce((min,value)=>Math.min(min,value),0),maximum=known.reduce((max,value)=>Math.max(max,value),0),extent=maximum-minimum||1;
  return{minimum,maximum,zero:-minimum/extent*100,extent};
}
function comparisonBar(value,scale,{previous=false}={}){
  const valid=comparisonKnown(value),zero=scale.zero,percent=valid?(value-scale.minimum)/scale.extent*100:zero,left=Math.min(zero,percent),width=Math.abs(percent-zero);
  return `<span class="comparison-bar-track${valid?'':' is-missing'}" aria-hidden="true"><svg viewBox="0 0 100 24" preserveAspectRatio="none" focusable="false"><rect class="comparison-track" x="0" y="7" width="100" height="10" rx="2"/><line class="comparison-zero" x1="${zero.toFixed(4)}" x2="${zero.toFixed(4)}" y1="3" y2="21" vector-effect="non-scaling-stroke"/>${valid?`<rect class="comparison-bar${value<0?' is-negative':''}${previous?' is-previous':''}" x="${left.toFixed(4)}" y="7" width="${width.toFixed(4)}" height="10" rx="1"/>${value===0?`<line class="comparison-zero-value" x1="${zero.toFixed(4)}" x2="${zero.toFixed(4)}" y1="7" y2="17" vector-effect="non-scaling-stroke"/>`:''}`:''}</svg>${!valid?'<span class="comparison-missing">미확인</span>':''}</span>`;
}
function horizontalComparisonChart({title='',description='',rows=[],metricLabel='',signed=false,emptyText='비교할 대상이 없어요.',maxRows=Infinity}={}){
  const ordered=rows.map((row,index)=>({...row,_index:index})).sort((a,b)=>comparisonKnown(a.value)!==comparisonKnown(b.value)?comparisonKnown(a.value)?-1:1:comparisonKnown(a.value)&&b.value!==a.value?b.value-a.value:a._index-b._index);
  const scale=comparisonScale(ordered.map(row=>row.value)),visible=ordered.slice(0,maxRows),format=value=>comparisonKnown(value)?`${signed&&value>0?'+':''}${comparisonNumber(value)}`:'—';
  const head=title?`<div class="comparison-chart-heading"><h3>${comparisonEscape(title)}</h3>${description?`<p>${comparisonEscape(description)}</p>`:''}</div>`:'';
  if(!visible.length)return`${head}<div class="comparison-chart-empty">${comparisonEscape(emptyText)}</div>`;
  const body=visible.map(row=>{
    const action=typeof row.action==='string'&&/^[a-z][a-z0-9-]*$/.test(row.action)?row.action:null,tag=action?'button':'div';
    const attrs=Object.entries(row.attrs||{}).filter(([key])=>/^data-[a-z][a-z0-9-]*$/.test(key)&&key!=='data-action').map(([key,value])=>` ${key}="${comparisonEscape(value)}"`).join('');
    const accessibility=`${row.label} · ${metricLabel} ${comparisonKnown(row.value)?format(row.value):'미확인 또는 비교 불가'}${row.secondary?' · '+row.secondary:''}`;
    return `<${tag} class="comparison-bar-row${row.selected?' is-selected':''}"${action?` type="button" data-action="${comparisonEscape(action)}"${attrs}`:''} aria-label="${comparisonEscape(accessibility)}" title="${comparisonEscape(accessibility)}"${action&&row.selected!==undefined?` aria-pressed="${Boolean(row.selected)}"`:''}><span class="comparison-row-identity"><strong>${comparisonEscape(row.label)}</strong>${row.secondary?`<small>${comparisonEscape(row.secondary)}</small>`:''}</span>${comparisonBar(row.value,scale)}<span class="comparison-row-value${row.value<0?' is-negative':''}${!comparisonKnown(row.value)?' is-missing':''}">${comparisonEscape(format(row.value))}</span></${tag}>`;
  }).join('');
  return`${head}<div class="comparison-chart" role="group" aria-label="${comparisonEscape(title||metricLabel||'항목별 비교 그래프')}"><div class="comparison-axis" aria-hidden="true"><span></span><span><i>${comparisonNumber(scale.minimum)}</i><i>${comparisonNumber(scale.maximum)}</i></span><span>${comparisonEscape(metricLabel)}</span></div>${body}</div>`;
}

function comparisonChartsSection(report){
  const group=comparisonGroup(),metric=comparisonMetric(),mode=state.comparisonMode==='latest'?'latest':'period',options=comparisonGroupOptions(),definition=COMPARISON_METRICS.find(([key])=>key===metric),modeLabel=mode==='period'?'선택 기간 증감':'최근 누적',rows=comparisonRows(report,group,metric,mode),expanded=state.comparisonExpanded===true;
  const filter=(key,label,choices,current)=>`<label class="comparison-filter"><span>${label}</span><select data-comparison-filter="${key}" aria-label="비교 ${label}">${choices.map(([value,text])=>`<option value="${value}"${value===current?' selected':''}>${comparisonEscape(text)}</option>`).join('')}</select></label>`;
  const controls=`<div class="comparison-controls">${filter('group','대상',options,group)}${filter('metric','지표',COMPARISON_METRICS,metric)}${filter('mode','기준',[['period','기간 증감'],['latest','최근 누적']],mode)}</div>`;
  const dates=`${report?.start||state.start} — ${report?.end||state.end}`,currentMetric=`${definition[1]} · ${definition[2]}`;
  const loading=!report?'<div class="comparison-chart-empty" role="status">비교할 기록을 불러오고 있어요.</div>':'';
  const contentFollower=group==='content'&&metric==='followers';
  const chart=contentFollower?'<div class="comparison-chart-empty">팔로워·구독자는 계정 단위 지표예요. 채널별 비교에서 확인해 주세요.</div>':horizontalComparisonChart({rows,metricLabel:currentMetric,signed:mode==='period',maxRows:expanded?Infinity:10,emptyText:group==='members'?'선택 범위에 채널을 담당하는 크루가 없어요.':'선택 범위에서 비교할 기록이 없어요.'});
  const teamContext=group==='teams'?'팀 비교는 각 팀의 열람 가능한 채널을 묶습니다. ':group==='members'?'수집 당시 담당자 기준이며, 공동 담당 채널은 여러 담당자에 포함될 수 있어요. ':group==='platform'?'플랫폼마다 집계 방식이 다를 수 있어요. ':'';
  const count=rows.length>10?`<button class="btn small comparison-more" data-action="comparison-more" aria-expanded="${expanded}">${expanded?'상위 10개만 보기':`${rows.length}개 모두 보기`}</button>`:'';
  return`<section class="comparison-section" aria-label="대상별 성과 비교" aria-busy="${!report}"><header class="comparison-section-head"><div><span class="comparison-eyebrow">같은 지표로 나란히</span><h2>성과 비교</h2><p>${comparisonEscape(dates)} · ${comparisonEscape(modeLabel)}${rows.length>10&&!expanded?' · 확인된 값 상위 10개':''}</p></div>${controls}</header>${loading||chart}${!loading&&!contentFollower?count:''}<p class="comparison-note">${comparisonEscape(teamContext)}막대는 같은 0 기준과 눈금을 사용합니다. —는 미확인 또는 비교 불가이며, 0은 확인된 값입니다.${mode==='latest'?' 누적값은 종료일까지 마지막으로 확인한 기록입니다.':' 증감은 기간 시작 전날과 종료일의 비교 가능한 기록입니다.'}</p></section>`;
}
function periodComparisonCharts(report){
  if(!report)return'';
  const days=Math.round((Date.parse(report.end)-Date.parse(report.start))/86400000)+1,validDates=Number.isFinite(days)&&days>0;
  const shift=(date,offset)=>new Date(Date.parse(`${date}T00:00:00Z`)+offset*86400000).toISOString().slice(0,10);
  const currentRange=validDates?`${report.start} — ${report.end}`:'선택 기간',previousRange=validDates?`${shift(report.start,-days)} — ${shift(report.start,-1)}`:'직전 같은 길이의 기간';
  const cards=COMPARISON_METRICS.map(([key,label,unit])=>{
    const metric=report.metrics?.[key],current=metric?.period?.delta,previous=metric?.previousPeriod?.delta,scale=comparisonScale([current,previous]);
    const row=(name,value,previousRow,range,part)=>{const exact=comparisonKnown(value)?`${value>0?'+':''}${comparisonNumber(value)}`:'—',coverage=comparisonKnown(part?.count)&&comparisonKnown(part?.eligible)?`비교 ${comparisonNumber(part.count)}/${comparisonNumber(part.eligible)}개`:'';return`<div class="period-comparison-row" role="img" aria-label="${comparisonEscape(`${label} ${name} ${comparisonKnown(value)?exact+' '+unit:'비교 불가'} · ${range}${coverage?' · '+coverage:''}`)}" title="${comparisonEscape(`${range}${coverage?' · '+coverage:''}`)}"><span class="period-comparison-label"><i class="${previousRow?'is-previous':''}" aria-hidden="true"></i>${name}</span>${comparisonBar(value,scale,{previous:previousRow})}<strong class="${value<0?'is-negative':''}">${exact}</strong></div>`;};
    return`<article class="period-comparison-card"><header><h3>${label}</h3><span>${unit}</span></header>${row('이번',current,false,currentRange,metric?.period)}${row('직전',previous,true,previousRange,metric?.previousPeriod)}<p class="period-comparison-coverage">이번 ${comparisonKnown(metric?.period?.count)?comparisonNumber(metric.period.count):'—'}개 · 직전 ${comparisonKnown(metric?.previousPeriod?.count)?comparisonNumber(metric.previousPeriod.count):'—'}개 대상 비교</p></article>`;
  }).join('');
  return`<section class="period-comparison-section" aria-label="기간별 성과 비교"><header class="comparison-section-head"><div><h2>이번 기간과 직전 기간</h2><p>같은 길이의 기간에서 얼마나 늘거나 줄었는지 비교해요.</p></div><div class="period-comparison-legend"><span><i></i>이번 ${comparisonEscape(currentRange)}</span><span><i class="is-previous"></i>직전 ${comparisonEscape(previousRange)}</span></div></header><div class="period-comparison-grid">${cards}</div><p class="comparison-note">각 지표 안에서 같은 0 기준과 눈금을 사용합니다. 지표 사이의 막대 길이는 직접 비교하지 마세요. 두 기간의 비교 대상 수가 다를 수 있으며, —는 0이 아닌 비교 불가입니다.</p></section>`;
}
