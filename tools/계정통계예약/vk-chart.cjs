'use strict';

// This function runs in the registered Ego profile. Read only labels displayed by the VK owner dashboard.
async function vkChartPage(p,args){
  const ownerPath='/groups/dashboard/@'+args.handle;
  const chart='[data-testid="visitors_views_content"]';
  await p.waitForFunction(q=>[...document.querySelectorAll('a[href]')].some(a=>a.pathname===q&&a.getClientRects().length),ownerPath,{timeout:12000});
  const href=await p.evaluate(q=>[...document.querySelectorAll('a[href]')].find(a=>a.pathname===q&&a.getClientRects().length)?.href,ownerPath);
  if(href!=='https://vk.ru'+ownerPath)return {reason:'need_owner'};
  await p.goto(href,{waitUntil:'domcontentloaded',timeout:25000});
  await p.waitForFunction(()=>!!document.querySelector('[data-testid="export_stats_button"]'),null,{timeout:15000});
  const origin=await p.evaluate(()=>location.origin);
  if(origin!=='https://vk.ru'||await p.evaluate(()=>location.pathname)!==ownerPath)return {reason:'need_owner'};
  await p.waitForFunction(()=>[...document.querySelectorAll('[class*="SummaryItem__item--"]')].some(n=>n.innerText.trim().split('\n')[0]==='Content views'),undefined,{timeout:12000}).catch(e=>{if(!/timed?\s*out|timeout/i.test(e.message))throw e;});
  const summary=await p.evaluate(()=>[...document.querySelectorAll('[class*="SummaryItem__item--"]')].filter(n=>n.getClientRects().length).map(n=>n.innerText.trim().split('\n')).filter(l=>['Content views','Content reach'].includes(l[0])).map(l=>({label:l[0],value:l[1]})));
  await p.click('loc=css:[data-testid="export_stats_button"]',{label:'공식 화면에서 통계의 시작일과 종료일 확인'});
  await p.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] input')].filter(e=>/^\d\d\.\d\d\.\d{4}$/.test(e.value)).length===2,undefined,{timeout:8000}).catch(e=>{if(!/timed?\s*out|timeout/i.test(e.message))throw e;});
  const range=await p.evaluate(()=>{
    const dlg=[...document.querySelectorAll('[role=dialog]')].find(e=>e.getClientRects().length&&e.innerText.includes('Export statistics'));
    if(!dlg)return [];
    return [...dlg.querySelectorAll('input')].map(e=>e.value).filter(s=>/^\d\d\.\d\d\.\d{4}$/.test(s));
  });
  await p.keyboard.press('Escape');
  if(range.length!==2)return {reason:'format'};
  const asDate=s=>new Date(s.split('.').reverse().join('-')+'T00:00:00Z');
  const days=(asDate(range[1])-asDate(range[0]))/86400000+1;
  if(!Number.isInteger(days)||days<1||days>31)return {reason:'format'};
  const measured=points=>({source:origin+ownerPath,observedAt:new Date().toISOString(),range,summary,points});
  await p.waitForFunction(sel=>![...document.querySelectorAll('[role=dialog]')].some(e=>e.getClientRects().length)&&!!document.querySelector(sel+' canvas'),chart,{timeout:12000}).catch(e=>{if(!/timed?\s*out|timeout/i.test(e.message))throw e;});
  await p.evaluate(sel=>document.querySelector(sel+' canvas')?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}),chart);
  const area=await p.evaluate(({sel,q})=>{
    const section=document.querySelector(sel),canvas=section?.querySelector('canvas');
    if(location.pathname!==q||!canvas||!section.innerText.includes('По дням')||!section.innerText.includes('Посетители')||!section.innerText.includes('Просмотры'))return null;
    const r=canvas.getBoundingClientRect(),center=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return r.width>100&&r.height>60&&section.contains(center)?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
  },{sel:chart,q:ownerPath});
  if(!area)return measured([]);
  const dailyPoints=[];
  const formatters=['en-GB','ru-RU'].map(locale=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}));
  const visiblePoint=({sel,q,labels})=>{
    if(location.pathname!==q)return null;
    const section=document.querySelector(sel);
    const lines=(section?.innerText||'').split('\n').map(s=>s.trim());
    const pos=lines.findIndex((s,i)=>labels.includes(s.replace(/^0(?=\d\s)/,'').toLowerCase())&&lines[i+1]==='Посетители'&&lines[i+3]==='Просмотры');
    return pos<0?null:{date:lines[pos],visitors:lines[pos+2],views:lines[pos+4]};
  };
  const today=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
  for(let i=0;i<days;i++){
    const date=new Date(+asDate(range[0])+i*86400000);
    if(date.toISOString().slice(0,10)>=today)continue;
    const labels=formatters.map(f=>f.format(date).toLowerCase()),query={sel:chart,q:ownerPath,labels};
    let point;
    for(const adjustment of [0,0.28,-0.28]){
      const ratio=Math.max(.025,Math.min(.975,(i+adjustment)/Math.max(1,days-1)));
      await p.evaluate(({sel,ratio})=>{
        const canvas=document.querySelector(sel+' canvas'),r=canvas?.getBoundingClientRect();
        if(!r)return;
        const evt={bubbles:true,clientX:r.x+r.width*ratio,clientY:r.y+r.height*.5,view:window};
        canvas.dispatchEvent(new MouseEvent('mousemove',evt));
      },{sel:chart,ratio});
      await p.mouse.move(area.x+area.width*ratio,area.y+area.height*.5,{label:'선택한 날짜의 VK 조회수와 방문자 읽기'});
      try{await p.waitForFunction(visiblePoint,query,{timeout:2300});}
      catch(e){if(!/timed?\s*out|timeout/i.test(e.message))throw e;}
      point=await p.evaluate(visiblePoint,query);
      if(point)break;
    }
    if(point)dailyPoints.push(point);
  }
  return measured(dailyPoints);
}

function vkChartRows(data,handle){
  if(data?.source!=='https://vk.ru/groups/dashboard/@'+handle||!Array.isArray(data.range)||data.range.length!==2||!Array.isArray(data.points))return [];
  function dayAt(label){
    if(!/^\d\d\.\d\d\.\d{4}$/.test(label))return null;
    const iso=label.split('.').reverse().join('-'),ms=Date.parse(iso+'T00:00:00Z');
    return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===iso?ms:null;
  }
  const [from,to]=data.range.map(dayAt),observed=Date.parse(data.observedAt);
  if(from===null||to===null||!Number.isFinite(observed)||to<from||to-from>30*86400000)return [];
  const today=new Date(observed+3*3600000).toISOString().slice(0,10);
  const format=['en-GB','ru-RU'].map(locale=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}));
  const dateMap=new Map(),expected=new Set();
  for(let ms=from;ms<=to;ms+=86400000){
    const d=new Date(ms),iso=d.toISOString().slice(0,10),short=iso.split('-').reverse().join('.');
    if(iso<today)expected.add(iso);
    for(const label of [short,...format.flatMap(f=>[f.format(d),f.format(d)+' '+d.getUTCFullYear()])])dateMap.set(label.toLowerCase(),iso);
  }
  const parse=n=>{const s=String(n||'').trim();if(!/^\d+$/.test(s)&&!/^\d{1,3}(?:[\u00a0\u202f ]\d{3})+$/.test(s))return null;
    const v=Number(s.replace(/[\u00a0\u202f ]/g,''));return Number.isSafeInteger(v)?v:null;};
  const rows=new Map();
  for(const point of data.points){
    const day=dateMap.get(String(point?.date||'').trim().replace(/[\u00a0\u202f]/g,' ').replace(/^0(?=\d\s)/,'').toLowerCase());
    if(!day)return [];
    if(!expected.has(day))continue;
    const views=parse(point.views),visitors=parse(point.visitors);
    if(views===null||visitors===null||rows.has(day))return [];
    rows.set(day,{kind:'account-period',period:{start:day,end:day},metrics:{views,visitors},labels:{screenTitle:'VK · Unique visitors and community views',periodLabel:'По дням',metricLabels:{views:'Просмотры',visitors:'Посетители'},timeZone:'Europe/Moscow'}});
  }
  if(rows.size)return [...rows.values()].sort((a,b)=>a.period.start.localeCompare(b.period.start));
  // VK's content-view summary and individual community-page views have different definitions.
  // Use this separately labelled account period only when no completed daily point was visible.
  const metrics={},metricLabels={};
  for(const field of data.summary||[]){
    const key={'Content views':'views','Content reach':'reach'}[field.label],value=parse(field.value);
    if(!key||value===null||Object.hasOwn(metrics,key))return [];
    metrics[key]=value;metricLabels[key]=field.label;
  }
  if(!Object.keys(metrics).length||new Date(to).toISOString().slice(0,10)>today)return [];
  return [{kind:'account-period',period:{start:new Date(from).toISOString().slice(0,10),end:new Date(to).toISOString().slice(0,10)},metrics,
    labels:{screenTitle:'VK · Community · General',periodLabel:'선택 기간의 콘텐츠 통계',metricLabels,timeZone:'Europe/Moscow'}}];
}
module.exports={vkChartPage,vkChartRows};
