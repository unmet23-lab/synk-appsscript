import { randomUUID } from 'node:crypto';
import { collectDailyTrends } from './trend-collectors.mjs';

const DAY=86400000,MINUTE=60000,KST=9*60*MINUTE;
const REGIONS=['KR','US','CN'];
const PLATFORMS=new Set(['google','youtube','tiktok','instagram','douyin','xiaohongshu','baidu','youtube-culture']);
const RETRY_MINUTES=[15,60,180];
const LEASE_MS=25*MINUTE;
export const DAILY_TRENDS_DEFAULTS=Object.freeze({enabled:true,hourKst:6,minuteKst:0,regions:Object.freeze([...REGIONS])});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const kstDate=at=>new Date(Date.parse(at)+KST).toISOString().slice(0,10);
const instant=at=>{const value=Date.parse(at);if(!Number.isFinite(value))throw fail('수집 시간을 확인해 주세요.');return new Date(value).toISOString();};
const dueAt=(date,settings)=>new Date(Date.parse(date+'T00:00:00+09:00')+(settings.hourKst*60+settings.minuteKst)*MINUTE).toISOString();
const dayAfter=date=>new Date(Date.parse(date+'T00:00:00Z')+DAY).toISOString().slice(0,10);
function dateValue(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw fail('날짜는 YYYY-MM-DD 형식으로 선택해 주세요.');return value;}
function settingsValue(input,prior=DAILY_TRENDS_DEFAULTS){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['enabled','hourKst','minuteKst','regions'].includes(key)))throw fail('트렌드 수집 설정을 확인해 주세요.');
  const merged={...prior,...input};
  if(typeof merged.enabled!=='boolean'||!Number.isInteger(merged.hourKst)||merged.hourKst<0||merged.hourKst>23||!Number.isInteger(merged.minuteKst)||merged.minuteKst<0||merged.minuteKst>59)throw fail('자동 수집 여부와 한국시간 시·분을 확인해 주세요.');
  if(!Array.isArray(merged.regions)||!merged.regions.length||merged.regions.length>REGIONS.length||merged.regions.some(region=>!REGIONS.includes(region))||new Set(merged.regions).size!==merged.regions.length)throw fail('수집 지역은 한국·미국·중국 중 하나 이상 선택해 주세요.');
  return {...merged,regions:REGIONS.filter(region=>merged.regions.includes(region))};
}
function urlValue(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
const string=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';

export function createDailyTrendsService({store,clock=()=>new Date().toISOString(),collector=collectDailyTrends,fetchImpl=globalThis.fetch}={}){
  let activeTask=null,stopped=false;
  const settings=()=>settingsValue(store.get('settings','daily-trends')||{},DAILY_TRENDS_DEFAULTS);
  const keyFor=(date,regions)=>date+':'+REGIONS.filter(region=>regions.includes(region)).join(',');
  const orderedRuns=()=>store.all('dailyTrendRuns').sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt)||(a.sequence||0)-(b.sequence||0)||Date.parse(a.finishedAt||a.startedAt)-Date.parse(b.finishedAt||b.startedAt));
  const latest=(key,after)=>orderedRuns().filter(run=>(!key||run.configKey===key)&&(!after||run.trigger==='scheduled'||Date.parse(run.startedAt)>=Date.parse(after))).at(-1)||null;
  const leaseEnd=run=>run.leaseExpiresAt||new Date(Date.parse(run.startedAt)+LEASE_MS).toISOString();
  const activeRun=at=>orderedRuns().findLast(run=>run.status==='running'&&Date.parse(leaseEnd(run))>Date.parse(at))||null;
  function nextRunAt(at,current){
    if(!current.enabled||stopped)return null;
    const date=kstDate(at),due=dueAt(date,current),run=latest(keyFor(date,current.regions),due),running=activeRun(at);
    if(running)return new Date(Math.max(Date.parse(due),Date.parse(leaseEnd(running)))).toISOString();
    if(run&&run.status!=='running'&&!run.retryAt)return dueAt(dayAfter(date),current);
    if(Date.parse(at)<Date.parse(due))return due;
    if(!run)return at;
    if(run.status==='running')return at;
    if(run.retryAt)return new Date(Math.max(Date.parse(at),Date.parse(run.retryAt))).toISOString();
    return dueAt(dayAfter(date),current);
  }
  function state({date}={}){
    const at=instant(clock()),current=settings(),today=kstDate(at),selected=date===undefined?today:dateValue(date);
    const dates=store.all('dailyTrendIssues').map(row=>row.date).filter(Boolean).sort().reverse();
    return {settings:current,today,date:selected,dates,snapshot:store.get('dailyTrendIssues',selected),running:activeTask!==null||!!activeRun(at),lastAttempt:latest(),nextRunAt:nextRunAt(at,current)};
  }
  function configure(input){if(stopped)throw fail('트렌드 수집기가 종료되었습니다.',503);const value=settingsValue(input,settings());store.put('settings','daily-trends',value);return state();}
  function normalize(result,at,regions,secrets){
    if(!result||!Array.isArray(result.items)||!Array.isArray(result.sources))throw fail('트렌드 수집 결과 형식을 확인해 주세요.');
    const clean=value=>{let output=string(value,700).replace(/(?:Bearer\s+|access_token=|refresh_token=|api[_-]?key=)[^\s&]+/gi,'[보호된 값]');for(const secret of secrets)if(secret.length>=4)output=output.split(secret).join('[보호된 값]');return output;};
    const sourceIds=new Set(),sources=result.sources.map(row=>{
      const id=string(row?.id,200),region=row?.region,platform=row?.platform;
      if(!id||sourceIds.has(id)||!PLATFORMS.has(platform)||!regions.includes(region)&&region!=='GLOBAL'||!['ok','needs_connection','unavailable','error'].includes(row?.status))throw fail('트렌드 출처 정보를 확인해 주세요.');
      const collectedAt=Number.isFinite(Date.parse(row.collectedAt))?new Date(row.collectedAt).toISOString():null;
      sourceIds.add(id);return {id,platform,region,label:clean(row.label),status:row.status,count:0,message:clean(row.message),collectedAt,...(row.status!=='ok'?{attemptedAt:at}:{}),...(typeof row.retryable==='boolean'?{retryable:row.retryable}:{}),url:urlValue(row.url)};
    });
    const ids=new Set(),items=[];
    for(const row of result.items){
      const source=sources.find(source=>source.id===row?.sourceId),id=string(row?.id,500),url=urlValue(row?.url),title=clean(row?.title);
      if(!source||!id||!url||!title||row.platform!==source.platform||row.region!==source.region)throw fail('트렌드 항목 정보를 확인해 주세요.');
      const unique=source.id+':'+id;if(ids.has(unique))continue;ids.add(unique);
      const metric=row.metric||{},publishedAt=Number.isFinite(Date.parse(row.publishedAt))?new Date(row.publishedAt).toISOString():null;
      items.push({id,sourceId:source.id,platform:source.platform,region:source.region,title,url,publishedAt,rank:Number.isInteger(row.rank)&&row.rank>0?row.rank:null,metric:{label:clean(metric.label),value:typeof metric.value==='number'&&Number.isFinite(metric.value)&&metric.value>=0?metric.value:null,display:clean(metric.display)},related:(Array.isArray(row.related)?row.related:[]).slice(0,20).flatMap(link=>{const url=urlValue(link?.url);return url?[{title:clean(link.title),url,source:clean(link.source)}]:[];}),collectedAt:at,...(['search','video','analysis'].includes(row.category)?{category:row.category}:{})});
    }
    for(const source of sources)source.count=items.filter(item=>item.sourceId===source.id).length;
    return {items,sources};
  }
  function mergeIssue(date,at,result){
    const previous=store.get('dailyTrendIssues',date),sources=new Map((previous?.sources||[]).map(source=>[source.id,source])),items=new Map((previous?.items||[]).map(item=>[item.sourceId+':'+item.id,item]));
    for(const source of result.sources){
      const incoming=result.items.filter(item=>item.sourceId===source.id),oldItems=[...items.values()].filter(item=>item.sourceId===source.id);
      if(incoming.length){
        for(const [key,item] of items)if(item.sourceId===source.id)items.delete(key);
        for(const item of incoming)items.set(item.sourceId+':'+item.id,item);
        sources.set(source.id,source);
      }else{
        sources.set(source.id,{...source,count:oldItems.length,...(oldItems.length?{retained:true,retainedAt:sources.get(source.id)?.retainedAt||sources.get(source.id)?.collectedAt||oldItems[0].collectedAt,message:[source.message,'이전 수집 항목을 유지했습니다.'].filter(Boolean).join(' ')}:{})});
      }
    }
    const snapshot={date,collectedAt:at,items:[...items.values()],sources:[...sources.values()]};
    store.put('dailyTrendIssues',date,snapshot);return snapshot;
  }
  function collect({force=false,at=clock(),trigger='manual',requestedBy=null}={}){
    if(stopped)return Promise.reject(fail('트렌드 수집기가 종료되었습니다.',503));
    if(typeof force!=='boolean')return Promise.reject(fail('다시 수집 여부를 확인해 주세요.'));
    if(activeTask)return activeTask;
    at=instant(at);
    // The claim is shared by the native server and the scheduled CLI through SQLite.
    const claim=store.transaction(()=>{
      const current=settings(),date=kstDate(at),due=dueAt(date,current),configKey=keyFor(date,current.regions);
      if(activeRun(at))return null;
      for(const row of orderedRuns().filter(row=>row.status==='running'))store.put('dailyTrendRuns',row.id,{...row,status:'interrupted',finishedAt:at,retryAt:at,message:'수집 잠금이 만료되어 다시 시도합니다.'});
      const prior=latest(configKey,trigger==='scheduled'?due:null);
      if(trigger==='scheduled'&&(!current.enabled||Date.parse(at)<Date.parse(due)||prior&&(!prior.retryAt||Date.parse(at)<Date.parse(prior.retryAt))))return null;
      if(!force&&trigger!=='scheduled'&&prior&&['success','partial'].includes(prior.status)&&!prior.retryAt)return null;
      const automaticAttempts=trigger==='scheduled'?(prior?.automaticAttempts||0)+1:(prior?.automaticAttempts||0);
      const sequence=orderedRuns().reduce((max,row)=>Math.max(max,row.sequence||0),0)+1;
      const run={id:randomUUID(),sequence,date,configKey,regions:current.regions,trigger,requestedBy,startedAt:at,leaseExpiresAt:new Date(Date.parse(at)+LEASE_MS).toISOString(),status:'running',automaticAttempts,retryAt:null};
      store.put('dailyTrendRuns',run.id,run);return {current,date,run,automaticAttempts};
    });
    if(!claim)return Promise.resolve(state());
    const {current,date,run,automaticAttempts}=claim;
    function finish(finishedAt,update,result){
      return store.transaction(()=>{
        const saved=store.get('dailyTrendRuns',run.id);
        if(saved?.status!=='running')return false;
        if(activeRun(finishedAt)?.id!==run.id){store.put('dailyTrendRuns',run.id,{...saved,status:'interrupted',finishedAt,retryAt:finishedAt,message:'수집 잠금이 만료되어 응답을 저장하지 않았습니다.'});return false;}
        if(result){const snapshot=mergeIssue(date,at,result);store.put('dailyTrendSnapshots',run.id,snapshot);}
        store.put('dailyTrendRuns',run.id,{...run,...update,finishedAt});return true;
      });
    }
    // Install the lock before invoking an injected collector, including synchronous failures.
    activeTask=Promise.resolve().then(async()=>{
      try{
        const youtubeConfig=store.secret('provider:youtube');
        const secrets=Object.values(youtubeConfig||{}).filter(value=>typeof value==='string');
        const raw=await collector({regions:current.regions,at,fetchImpl,youtubeConfig});
        const result=normalize(raw,at,current.regions,secrets),hasItems=result.items.length>0;
        const retryable=!result.sources.length||result.sources.some(source=>source.status==='error'||source.status==='unavailable'&&source.retryable===true)||!hasItems&&result.sources.some(source=>source.status==='ok');
        const status=hasItems?(retryable||result.sources.some(source=>source.status!=='ok')?'partial':'success'):(result.sources.some(source=>['error','unavailable'].includes(source.status))?'error':'empty');
        const finishedAt=instant(clock()),retryAt=retryable&&automaticAttempts<=RETRY_MINUTES.length?new Date(Date.parse(finishedAt)+RETRY_MINUTES[Math.max(0,automaticAttempts-1)]*MINUTE).toISOString():null;
        finish(finishedAt,{status,itemCount:result.items.length,sourceCount:result.sources.length,retryAt,message:hasItems?'수집한 트렌드를 저장했습니다.':'새 항목이 없어 이전 수집 자료를 유지했습니다.'},result);
      }catch{
        const finishedAt=instant(clock()),retryAt=automaticAttempts<=RETRY_MINUTES.length?new Date(Date.parse(finishedAt)+RETRY_MINUTES[Math.max(0,automaticAttempts-1)]*MINUTE).toISOString():null;
        finish(finishedAt,{status:'error',retryAt,message:'트렌드를 수집하지 못했습니다. 이전 수집 자료는 유지됩니다.'});
      }
    }).finally(()=>{activeTask=null;}).then(()=>state());
    return activeTask;
  }
  function tick(at=clock()){
    if(stopped)return Promise.resolve(null);
    at=instant(at);const current=settings(),date=kstDate(at);
    if(!current.enabled||Date.parse(at)<Date.parse(dueAt(date,current)))return Promise.resolve(null);
    if(activeTask)return activeTask;
    return collect({at,trigger:'scheduled'});
  }
  const waitForIdle=()=>activeTask||Promise.resolve();
  function stop(){stopped=true;return waitForIdle();}
  return {state,configure,collect,tick,waitForIdle,stop};
}
