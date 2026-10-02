'use strict';

const chartLeaders={active:null,element:null,timer:null,sequence:0,cache:new Map(),pending:new Map(),touch:null};
const leadersEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const leadersKnown=value=>typeof value==='number'&&Number.isFinite(value);
const leadersNumber=value=>leadersKnown(value)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value):'—';
const leadersUnit=metric=>({views:'회',likes:'개',comments:'개',shares:'회',saves:'회',reach:'명',followers:'명'})[metric]||'';
function leadersContext(){
  return JSON.stringify([state.user?.id,state.user?.role,state.user?.teamId,state.tab,state.scope,state.teamId,state.tab==='analysis'?state.ownerId:'',state.tab==='analysis'?state.platform:'',state.tab==='analysis'?state.channel:'',state.reportRequest,typeof isDemoMode==='function'&&isDemoMode()?location.search:'live']);
}
function leadersKey(options){return JSON.stringify([leadersContext(),options.date,options.metric,options.mode]);}
function leadersMarkup(options,result,error=false){
  const label=METRICS.find(([key])=>key===options.metric)?.[1]||'지표',unit=leadersUnit(options.metric),format=value=>(options.mode==='change'&&value>0?'+':'')+leadersNumber(value);
  const heading=`<header class="leaders-heading"><div><span>${leadersEscape(options.date.replaceAll('-','.'))}</span><strong>${leadersEscape(label)} ${options.mode==='change'?'하루 증감':'당일 누적'} TOP 3</strong></div><b>${leadersKnown(options.value)?leadersEscape(format(options.value)):'—'}<small>${leadersKnown(options.value)?unit:''}</small></b></header>`;
  if(error)return heading+'<p class="leaders-status">순위를 불러오지 못했어요.<br>날짜를 다시 가리키면 재시도해요.</p>';
  if(!result)return heading+'<p class="leaders-status" role="status">그날의 콘텐츠를 확인하고 있어요…</p>';
  if(!result.items?.length)return heading+`<p class="leaders-status">${leadersEscape(result.emptyReason==='account-metric'?'팔로워·구독자는 콘텐츠별 순위를 나눌 수 없어요.':options.mode==='change'?'이날 비교할 수 있는 콘텐츠 기록이 없어요.':'이날 확인한 콘텐츠 기록이 없어요.')}</p>`;
  return heading+`<ol class="leaders-list">${result.items.slice(0,3).map(item=>`<li><span class="leaders-rank">${leadersEscape(item.rank)}</span><div class="leaders-content"><strong class="leaders-title">${leadersEscape(item.title||'제목 없는 콘텐츠')}</strong><span class="leaders-creator">${leadersEscape(item.creatorLabel||'제작자 미등록')}${item.creatorNames?.length?' · <b>'+leadersEscape(item.creatorNames.join(', '))+'</b>':''}</span></div><span class="leaders-value">${leadersEscape(format(item.value))}<small>${unit}</small></span></li>`).join('')}</ol><p class="leaders-foot">${options.mode==='change'?'하루 증감을 비교할 수 있는':'당일 확인된'} ${leadersNumber(result.count)}/${leadersNumber(result.eligible)}개 콘텐츠 기준${result.complete?'':' · 일부 기록'}</p>`;
}
function leadersElement(){
  if(!chartLeaders.element){const element=document.createElement('aside');element.id='chart-content-leaders';element.className='chart-content-leaders';element.setAttribute('role','tooltip');element.hidden=true;document.body.append(element);chartLeaders.element=element;}
  return chartLeaders.element;
}
function leadersPosition(){
  const active=chartLeaders.active,element=chartLeaders.element;if(!active||!element||element.hidden)return;
  if(!active.anchor.isConnected){hideChartLeaders();return;}
  let target=active.anchor.querySelector?.('.chart-dot')||active.anchor;
  if(active.anchor.hasAttribute?.('data-history-chart')){const svg=[...active.anchor.querySelectorAll('svg')].find(node=>node.getBoundingClientRect().width>0);target=svg?.querySelector('[data-history-active]')||active.anchor;}
  const rect=target.getBoundingClientRect(),width=Math.min(344,Math.max(0,window.innerWidth-24));
  element.style.width=width+'px';
  const height=element.getBoundingClientRect().height,left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2));
  const above=rect.top-height-14,below=rect.bottom+14,top=above>=12?above:below+height<=window.innerHeight-12?below:Math.max(12,Math.min(window.innerHeight-height-12,above));
  element.style.left=left+'px';element.style.top=top+'px';
}
function hideChartLeaders(clear=false){
  clearTimeout(chartLeaders.timer);chartLeaders.timer=null;chartLeaders.sequence++;
  const anchor=chartLeaders.active?.anchor;
  if(anchor){anchor.classList.remove('has-content-leaders');const ids=(anchor.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!=='chart-content-leaders');if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');}
  chartLeaders.active=null;if(chartLeaders.element)chartLeaders.element.hidden=true;
  if(clear){chartLeaders.cache.clear();chartLeaders.pending.clear();chartLeaders.touch=null;}
}
function leadersValid(active,sequence){return chartLeaders.active===active&&chartLeaders.sequence===sequence&&active.anchor.isConnected&&active.context===leadersContext()&&Boolean(state.user)&&!state.loading;}
function showChartLeaders(options,{immediate=false,source='pointer'}={}){
  if(!state.user||state.loading||!options.anchor?.isConnected||!/^\d{4}-\d{2}-\d{2}$/.test(options.date||''))return;
  const key=leadersKey(options);
  if(chartLeaders.active?.key===key&&chartLeaders.active.anchor===options.anchor){
    if(source==='keyboard'&&chartLeaders.active.source==='pointer'){chartLeaders.active.source='keyboard';chartLeaders.element?.setAttribute('aria-live','polite');}
    leadersPosition();return;
  }
  hideChartLeaders();
  const active={...options,key,context:leadersContext(),source};chartLeaders.active=active;
  const sequence=chartLeaders.sequence,element=leadersElement(),cached=chartLeaders.cache.get(key);
  options.anchor.classList.add('has-content-leaders');const ids=(options.anchor.getAttribute('aria-describedby')||'').split(' ').filter(Boolean);options.anchor.setAttribute('aria-describedby',[...new Set([...ids,element.id])].join(' '));
  element.setAttribute('aria-live',source==='keyboard'?'polite':'off');element.hidden=false;element.innerHTML=leadersMarkup(active,cached);leadersPosition();
  if(cached)return;
  const load=async()=>{
    if(!leadersValid(active,sequence))return;
    try{
      let pending=chartLeaders.pending.get(key);
      if(!pending){pending=api('/api/day?'+query({date:active.date,start:undefined,end:undefined,leaders:'1',metric:active.metric,mode:active.mode}));chartLeaders.pending.set(key,pending);pending.finally(()=>{if(chartLeaders.pending.get(key)===pending)chartLeaders.pending.delete(key);}).catch(()=>{});}
      const result=await pending;
      if(!leadersValid(active,sequence))return;
      chartLeaders.cache.set(key,result);while(chartLeaders.cache.size>64)chartLeaders.cache.delete(chartLeaders.cache.keys().next().value);
      element.innerHTML=leadersMarkup(active,result);leadersPosition();
    }catch{if(leadersValid(active,sequence)){element.innerHTML=leadersMarkup(active,null,true);leadersPosition();}}
  };
  if(immediate)void load();else chartLeaders.timer=setTimeout(load,130);
}
function leadersForPoint(point,options={}){
  if(state.tab!=='analysis')return;
  const date=point.dataset.date,row=state.report?.daily?.find(item=>item.date===date),metric=row?.metrics?.[state.metric];
  showChartLeaders({anchor:point,date,metric:state.metric,mode:state.chartMode==='change'?'change':'total',value:state.chartMode==='change'?metric?.change?.delta:metric?.total},options);
}
function leadersForHistory(options={}){
  if(state.tab!=='history'||typeof historyContext!=='function')return;
  const {selected,metric}=historyContext(),anchor=document.querySelector('[data-history-chart]');if(!selected||!anchor)return;
  // The history curve can carry earlier values; rankings only use this date's exact observations.
  showChartLeaders({anchor,date:selected.date,metric:metric[0],mode:'total',value:selected.metrics?.[metric[0]]?.total},options);
}
document.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const point=event.target.closest?.('[data-chart-point]');if(point)leadersForPoint(point);});
document.addEventListener('pointermove',event=>{if(event.pointerType!=='touch'&&event.target.closest?.('[data-history-chart]'))leadersForHistory();});
document.addEventListener('pointerout',event=>{
  const anchor=chartLeaders.active?.anchor;if(anchor&&chartLeaders.active.source==='pointer'&&anchor.contains(event.target)&&!anchor.contains(event.relatedTarget))hideChartLeaders();
});
document.addEventListener('focusin',event=>{const point=event.target.closest?.('[data-chart-point]');if(point)leadersForPoint(point,{immediate:true,source:'keyboard'});else if(event.target.closest?.('[data-history-chart]'))leadersForHistory({immediate:true,source:'keyboard'});});
document.addEventListener('focusout',event=>{const anchor=chartLeaders.active?.anchor;if(anchor&&anchor.contains(event.target)&&!anchor.contains(event.relatedTarget))hideChartLeaders();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&chartLeaders.active){event.preventDefault();event.stopImmediatePropagation();hideChartLeaders();return;}
  if(event.target.closest?.('[data-history-chart]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))leadersForHistory({immediate:true,source:'keyboard'});
});
document.addEventListener('pointerdown',event=>{
  const point=event.target.closest?.('[data-chart-point]');
  if(event.pointerType==='touch'&&point){const second=chartLeaders.active?.anchor===point&&chartLeaders.active.source==='touch';chartLeaders.touch={point,first:!second};if(!second)leadersForPoint(point,{immediate:true,source:'touch'});return;}
  if(chartLeaders.active&&!chartLeaders.active.anchor.contains(event.target))hideChartLeaders();
});
document.addEventListener('click',event=>{
  const point=event.target.closest?.('[data-chart-point]'),touch=chartLeaders.touch;chartLeaders.touch=null;
  if(point&&touch?.point===point&&touch.first){event.preventDefault();event.stopImmediatePropagation();return;}
  if(point)hideChartLeaders();
},true);
document.addEventListener('click',event=>{if(event.target.closest?.('[data-history-chart]'))leadersForHistory({immediate:true,source:'touch'});});
window.addEventListener('scroll',()=>{
  const active=chartLeaders.active;
  if(active?.source==='keyboard'){
    const rect=active.anchor.getBoundingClientRect();
    const visible=rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth;
    if(chartLeaders.element)chartLeaders.element.hidden=!visible;
    if(visible)leadersPosition();
    return;
  }
  hideChartLeaders();
},{passive:true});
window.addEventListener('resize',()=>hideChartLeaders());
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideChartLeaders();});
