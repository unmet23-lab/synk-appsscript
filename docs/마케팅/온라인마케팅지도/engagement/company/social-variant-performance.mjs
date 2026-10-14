import {createHash} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';
import {POST_PERFORMANCE_METRICS,normalizePerformancePostUrl} from './post-performance.mjs';

const HOUR=3600000,MINUTE=60000;
const FIRST_PARTY_METRICS=[
  {id:'linkClicks',label:'링크 클릭',source:'first-party:redirect',event:null},
  {id:'siteVisits',label:'사이트 방문 신고',source:'first-party:browser',event:'visit'},
  {id:'browserTrial',label:'브라우저 체험 시작 신고',source:'first-party:browser',event:'trial_start'},
  {id:'browserSignup',label:'브라우저 가입 신고',source:'first-party:browser',event:'signup'},
  {id:'browserInquiry',label:'브라우저 상담 신고',source:'first-party:browser',event:'inquiry'},
  {id:'verifiedTrial',label:'서버 확인 체험 시작',source:'first-party:verified',event:'trial_start'},
  {id:'verifiedSignup',label:'서버 확인 가입',source:'first-party:verified',event:'signup'},
  {id:'verifiedInquiry',label:'서버 확인 상담',source:'first-party:verified',event:'inquiry'}
].map(metric=>({...metric,unit:'count',kind:'first-party'}));
export const SOCIAL_COPY_METRICS=[...POST_PERFORMANCE_METRICS,...FIRST_PARTY_METRICS];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clone=value=>structuredClone(value);
const stable=value=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(stable(value[key]??null))]))
  :Array.isArray(value)?value.map(item=>JSON.parse(stable(item))):value??null);
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const text=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const contentFields=['brandId','category','campaignId','language','purpose','topikArea','source','sourceId'];
const basis='게시 당시 그대로 남은 문구만 비교해요. 원본·계정·형식·목적·언어·미디어·관측 시간·측정 출처가 같은 것끼리 묶고, 문구별로 3개가 안 되면 표본 부족으로 봐요. 시간·대상·노출이 서로 달라서 어느 문구가 나은지, 성과가 문구 때문인지는 판단하지 않아요.';

function publicationIdentity(value){
  try{return normalizePerformancePostUrl(value).identity;}catch{return null;}
}
function originalKey(job){
  const source=job.snapshot.post.source||{};
  if(source.clientProjectId&&source.clientVersionId)return 'pulse:'+source.clientProjectId+':'+source.clientVersionId;
  if(source.productionId&&source.versionId)return 'studio:'+source.productionId+':'+source.versionId;
  if(source.packageId)return 'package:'+source.packageId;
  if(job.snapshot.post.sourceId)return 'source:'+job.snapshot.post.sourceId;
  return 'post:'+job.postId;
}
function copyOf(job){
  const {post,variant}=job.snapshot;
  const copy={title:text(variant.title??post.title,300),text:text(variant.text,30000),hashtags:text(variant.options?.hashtags,2000)};
  return {...copy,copyId:variant.selectedCopyId||job.selectedCopyId||'base',fingerprint:hash(copy)};
}
function mediaIdentity(variant){
  return (variant.media||[]).map(media=>({identity:media.sha256||media.assetId||media.id||media.url||'',type:media.type||media.mimeType||''}));
}
function comparisonText(value,job,linkIndex){
  const original=typeof value==='string'?value:'',parts=[];let previous=0;
  for(const match of original.matchAll(/https?:\/\/[^\s<>"']+/g)){
    const url=match[0].replace(/[.,!?)\]}]+$/,''),link=linkIndex.get(url);
    if(!link||link.channelId!==job.channelId||link.postId!==job.postId||!iso(link.createdAt)||!iso(job.publishedAt)||Date.parse(link.createdAt)>Date.parse(job.publishedAt))continue;
    let destination;try{const parsed=new URL(link.destination);if(parsed.protocol!=='https:'||parsed.username||parsed.password)continue;destination=parsed.href;}catch{continue;}
    // Keep all destination query fields (including UTM) and fragments. Only the
    // verified SYNK redirect token differs; external URLs are never rewritten.
    parts.push(original.slice(previous,match.index),{synkDestination:destination});previous=match.index+url.length;
  }
  parts.push(original.slice(previous));return parts;
}
function comparisonCopy(job,copy,linkIndex){
  return hash({title:comparisonText(copy.title,job,linkIndex),text:comparisonText(copy.text,job,linkIndex),hashtags:comparisonText(copy.hashtags,job,linkIndex)});
}
function normalizedFilters(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail('비교 조건을 확인해 주세요.');
  const allowed=['channelId','postId','sourceKey','format','purpose','from','to','hours','metric'];
  if(Object.keys(input).some(key=>!allowed.includes(key)))throw fail('지원하는 비교 조건을 선택해 주세요.');
  const result={hours:Number(input.hours??24),metric:input.metric||'views'};
  if(![24,72].includes(result.hours)||!SOCIAL_COPY_METRICS.some(metric=>metric.id===result.metric))throw fail('24/72시간과 지원하는 관측 지표를 선택해 주세요.');
  for(const key of ['channelId','postId','sourceKey','format','purpose'])if(input[key]!=null&&input[key]!==''){
    if(typeof input[key]!=='string'||input[key].length>2000)throw fail('비교 조건을 확인해 주세요.');result[key]=input[key];
  }
  for(const key of ['from','to'])if(input[key]){
    const value=input[key],match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(value);
    if(!match||!iso(value)||Number(match[2])<1||Number(match[2])>12||Number(match[3])<1||Number(match[3])>new Date(Date.UTC(Number(match[1]),Number(match[2]),0)).getUTCDate())throw fail('실제 날짜와 시간대를 확인해 주세요.');
    // Date inputs use the same fixed Korean calendar as the workspace UI.
    result[key]=value.length===10?iso(value+(key==='to'?'T23:59:59.999+09:00':'T00:00:00.000+09:00')):iso(value);
  }
  if(result.from&&result.to&&result.from>result.to)throw fail('조회 종료일은 시작일 이후로 정해 주세요.');
  return result;
}
function observation(checkpoint,metric,publishedAt){
  const definition=POST_PERFORMANCE_METRICS.find(row=>row.id===metric),meta=checkpoint?.metricProvenance?.[metric]||{},raw=checkpoint?.metrics?.[metric];
  const observedAt=iso(meta.observedAt||checkpoint?.observedAt),recordedAt=iso(meta.recordedAt||checkpoint?.recordedAt);
  const ageMinutes=observedAt&&publishedAt?(Date.parse(observedAt)-Date.parse(publishedAt))/MINUTE:null;
  const result={value:null,status:'missing',reason:checkpoint?.unavailableReasons?.[metric]||'아직 확인한 값이 없어요.',source:meta.source||checkpoint?.source||null,unit:meta.unit||definition?.unit||'count',timing:meta.timing||checkpoint?.timing||null,observedAt,recordedAt,ageMinutes,observationOffsetMinutes:ageMinutes===null?null:Math.floor((ageMinutes-checkpoint.hours*60)/15)*15};
  if(!finite(raw)){if(/제공하지|지원하지|미지원/.test(result.reason))result.status='unsupported';return result;}
  result.value=raw;
  if(checkpoint?.status!=='recorded'||!meta.source||!meta.unit||!observedAt||!publishedAt||!meta.timing){result.status='excluded';result.reason='측정 출처·단위·실제 게시/관측 시각이 확인돼야 비교할 수 있어요.';return result;}
  if(meta.measurementWindowMissed||ageMinutes<checkpoint.hours*60||ageMinutes>checkpoint.hours*60+360){result.status='excluded';result.reason='정해진 관측 시간을 벗어나서 비교에서 뺐어요.';return result;}
  if(meta.unit!==definition.unit||definition.unit==='count'&&!Number.isSafeInteger(raw)||definition.max!==undefined&&raw>definition.max){result.status='excluded';result.reason='지표 단위나 값의 범위가 맞지 않아 비교에서 뺐어요.';return result;}
  return {...result,status:'measured',reason:null};
}
function exposure(checkpoint,publishedAt){
  return {
    impressions:{value:null,status:'unsupported',reason:'성과 기록에 노출 횟수 지표가 연결돼 있지 않아요.'},
    reach:observation(checkpoint,'reach',publishedAt),views:observation(checkpoint,'views',publishedAt),
    note:'조회·도달은 노출 횟수와 다른 지표예요. 없는 노출 수를 다른 값으로 대체하거나 참여율을 계산하지 않아요.'
  };
}

/** Read-only observations and an explicit, unsaved template proposal. Never calls a provider. */
export function createSocialVariantPerformanceService({store,publishing,performance,tracking,validatePostInput,clock=()=>new Date().toISOString()}={}){
  if(!store||!publishing||!performance||typeof validatePostInput!=='function')throw new TypeError('store, publishing, performance and validatePostInput are required');
  function current(user,write=false){
    const live=store.get('users',user?.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('먼저 로그인해 주세요.',401);
    if(write&&live.role==='viewer')throw fail('템플릿 작성 권한이 필요해요.',403);return live;
  }
  function readable(user,job,write=false){
    const channel=store.get('channels',job?.channelId);
    if(!channel||channel.active===false||channel.hidden||!(write?canWriteChannel:canReadChannel)(user,channel))throw fail('접근할 수 없는 게시 기록이에요.',404);
    const post=publishing.get(user,job.postId).post;
    if(write&&!post.canEdit)throw fail('현재 게시물 작성 권한을 확인해 주세요.',403);
    if(!job.snapshot?.post||!job.snapshot?.variant||job.snapshot.variant.channelId!==job.channelId)throw fail('게시 당시 문구 원본이 없어 비교할 수 없어요.',409);
    // Do not expose a private Studio/PULSE source or old media after its access is revoked.
    const snapshot=clone(job.snapshot.post);snapshot.variants=[clone(job.snapshot.variant)];snapshot.media=clone(job.snapshot.variant.media||[]);
    validatePostInput(user,snapshot);
    return channel;
  }
  function published(user){
    const jobs=[];let missingSnapshot=0;
    for(const job of store.all('socialPublishJobs'))if(job.status==='published')try{const channel=readable(user,job);jobs.push({job,channel});}catch(error){if(error.status===409&&(!job.snapshot?.post||!job.snapshot?.variant))missingSnapshot++;if(![400,401,403,404,409,422].includes(error.status))throw error;}
    return {jobs,missingSnapshot};
  }
  function linkReferences(job,linkIndex,matchChannel=true){
    const variant=job.snapshot?.variant||{},body=[variant.title,variant.text,variant.options?.firstComment,variant.options?.link,variant.options?.hashtags].filter(Boolean).join('\n');
    const urls=new Set((body.match(/https?:\/\/[^\s<>"']+/g)||[]).map(url=>url.replace(/[.,!?)\]}]+$/,'')));
    return [...urls].map(url=>linkIndex.get(url)).filter(link=>link&&(!matchChannel||link.channelId===job.channelId));
  }
  function trackingFor(job,linkIndex,usage){
    const refs=linkReferences(job,linkIndex);
    if(!refs.length)return {status:'unlinked',links:[],reason:'게시 당시 문구에서 연결된 추적 주소를 찾지 못했어요.'};
    const ambiguous=refs.some(link=>usage.get(link.id)!==1||link.postId!==job.postId);
    return {status:ambiguous?'ambiguous':'link-observations',links:refs.map(link=>({id:link.id,label:link.label,shortUrl:link.shortUrl,active:link.active,stats:clone(link.stats)})),
      attributionKnown:!ambiguous,window:'rolling-90-days',reason:ambiguous?'같은 링크를 여러 게시에 써서 문구별 유입을 나눌 수 없어요. 아래 값은 링크 전체 기록이라 문구 비교에 더하지 않아요.':'링크 전체의 최근 90일 관측이에요. 플랫폼의 24/72시간 수치와 기간이 달라서 더하거나 전환율을 계산하지 않아요.'};
  }
  function firstPartyObservation(job,definition,hours,linkIndex,usage,data){
    const publishedAt=iso(job.publishedAt),from=publishedAt?Date.parse(publishedAt):NaN,to=from+hours*HOUR,now=Date.parse(clock()),cutoff=now-90*24*HOUR;
    const result={value:null,status:'missing',reason:null,source:definition.source,unit:'count',timing:'fixed-window',observedAt:null,recordedAt:iso(clock()),ageMinutes:hours*60,observationOffsetMinutes:0,windowFrom:publishedAt,windowTo:Number.isFinite(to)?new Date(to).toISOString():null,lastEventAt:null,definition:'익명 클릭 식별자 기준으로 센 횟수예요. 사람 수·매출·노출 대비 전환율이 아니에요.'};
    if(!publishedAt)return {...result,status:'excluded',reason:'실제 게시 시각이 없어 관측 기간을 정할 수 없어요.'};
    if(now<to)return {...result,reason:hours+'시간 관측 기간이 아직 끝나지 않았어요.'};
    if(from<cutoff)return {...result,reason:'관측 기간이 90일 보존 기간을 벗어나 기록을 다 확인할 수 없어요.'};
    const refs=linkReferences(job,linkIndex);
    if(!refs.length)return {...result,reason:'게시 당시 문구에 연결된 추적 주소가 없어요.'};
    if(refs.some(link=>usage.get(link.id)!==1||link.postId!==job.postId))return {...result,status:'excluded',reason:'여러 게시에 쓴 링크이거나 다른 게시물의 링크라서 이 문구의 결과로 나눌 수 없어요.'};
    if(refs.some(link=>!iso(link.createdAt)||Date.parse(link.createdAt)>from))return {...result,status:'excluded',reason:'게시 전에 만든 추적 링크인지 확인할 수 없어요.'};
    const relevantClicks=refs.flatMap(link=>data.clicks.get(link.id)||[]),validClicks=new Map(relevantClicks.filter(click=>Number.isFinite(Date.parse(click.createdAt))&&Date.parse(click.createdAt)>=from&&Date.parse(click.createdAt)<=to).map(click=>[click.id,click]));
    if(!definition.event){const times=[...validClicks.values()].map(click=>click.createdAt).sort();return {...result,value:validClicks.size,status:'measured',lastEventAt:times.at(-1)||null,reason:null};}
    const source=definition.source==='first-party:verified'?'verified':'browser';
    const validEvent=(event,link)=>{
      const click=data.clickIds.get(event.clickId),at=Date.parse(event.createdAt),clickAt=Date.parse(click?.createdAt);
      return event.source===source&&['visit','trial_start','signup','inquiry'].includes(event.event)&&(source!=='verified'||event.event!=='visit')&&event.linkId===link.id&&click?.linkId===link.id&&Number.isFinite(at)&&Number.isFinite(clickAt)&&clickAt>=Date.parse(link.createdAt)&&at>=clickAt&&at-clickAt<=30*24*HOUR&&at>=cutoff&&at<=to;
    };
    // A configured key or an allowed origin alone does not prove site instrumentation.
    // A different event kind does not prove this conversion is instrumented.
    if(refs.some(link=>!(data.events.get(link.id)||[]).some(event=>validEvent(event,link)&&event.event===definition.event)))return {...result,reason:source==='verified'?'이 링크에 연결된 해당 종류의 서버 확인 기록이 아직 없어요.':'이 링크에 연결된 해당 종류의 브라우저 기록이 아직 없어요.'};
    const events=refs.flatMap(link=>(data.events.get(link.id)||[]).filter(event=>validEvent(event,link)&&event.event===definition.event&&validClicks.has(event.clickId)&&Date.parse(event.createdAt)>=from));
    const unique=new Set(events.map(event=>event.clickId+'|'+event.event));
    return {...result,value:unique.size,status:'measured',lastEventAt:events.map(event=>event.createdAt).sort().at(-1)||null,reason:null};
  }
  function comparison(user,input={}){
    user=current(user);const filters=normalizedFilters(input),visible=published(user),all=visible.jobs,groups=new Map(),excluded={missingSnapshot:visible.missingSnapshot,duplicatePublications:0,conflictingPublicationCopies:0};
    if(filters.channelId){const c=store.get('channels',filters.channelId);if(!c||c.hidden||c.active===false||!canReadChannel(user,c))throw fail('현재 접근할 수 있는 계정을 선택해 주세요.',404);}
    if(filters.postId)publishing.get(user,filters.postId);
    const entries=(performance.observations?performance.observations(user):performance.list(user)).entries||[],entryMap=new Map();
    for(const entry of entries){const identity=publicationIdentity(entry.url);if(identity){const key=entry.channelId+'|'+identity,list=entryMap.get(key)||[];list.push(entry);entryMap.set(key,list);}}
    const links=tracking?.workspace(user)?.links||[],linkIndex=new Map(links.map(link=>[link.shortUrl,link])),usage=new Map();
    // Reused links remain ambiguous even when the other publication is outside the selected period.
    for(const job of store.all('socialPublishJobs').filter(row=>row.status==='published'))for(const link of linkReferences(job,linkIndex,false)){
      const set=usage.get(link.id)||new Set();set.add(job.channelId+'|'+(publicationIdentity(job.publicationUrl)||job.id));usage.set(link.id,set);
    }
    const counts=new Map([...usage].map(([key,set])=>[key,set.size]));
    const firstParty=FIRST_PARTY_METRICS.find(metric=>metric.id===filters.metric),trackingData={clicks:new Map(),events:new Map(),clickIds:new Map()};
    if(firstParty){
      const ids=new Set(links.map(link=>link.id));
      for(const click of store.all('socialTrackingClicks'))if(ids.has(click.linkId)){const rows=trackingData.clicks.get(click.linkId)||[];rows.push(click);trackingData.clicks.set(click.linkId,rows);trackingData.clickIds.set(click.id,click);}
      for(const event of store.all('socialTrackingEvents'))if(ids.has(event.linkId)){const rows=trackingData.events.get(event.linkId)||[];rows.push(event);trackingData.events.set(event.linkId,rows);}
    }
    const publications=new Map();
    for(const row of all){const id=publicationIdentity(row.job.publicationUrl),key=row.job.channelId+'|'+(id||row.job.id),rows=publications.get(key)||[];rows.push(row);publications.set(key,rows);}
    for(const [identity,candidates] of publications){
      const copies=new Set(candidates.map(({job})=>hash([copyOf(job),originalKey(job),job.snapshot.variant.format,job.snapshot.post.purpose,mediaIdentity(job.snapshot.variant)])));
      if(copies.size>1){excluded.conflictingPublicationCopies+=candidates.length;continue;}
      excluded.duplicatePublications+=candidates.length-1;
      const {job,channel}=candidates.sort((a,b)=>a.job.id.localeCompare(b.job.id))[0],post=job.snapshot.post,variant=job.snapshot.variant,copy=copyOf(job),publishedAt=iso(job.publishedAt),originKey=originalKey(job),format=variant.publicationFormat||variant.format||'';
      if(filters.channelId&&job.channelId!==filters.channelId||filters.postId&&job.postId!==filters.postId||filters.sourceKey&&originKey!==filters.sourceKey||filters.format&&format!==filters.format||filters.purpose&&post.purpose!==filters.purpose||filters.from&&(!publishedAt||publishedAt<filters.from)||filters.to&&(!publishedAt||publishedAt>filters.to))continue;
      const matches=entryMap.get(identity)||[],linked=matches.filter(entry=>entry.id===job.performanceEntryId),entry=linked.length===1?linked[0]:matches.length===1?matches[0]:null;
      const checkpoints=(entry?.checkpoints||[]).filter(row=>row.hours===filters.hours),checkpoint=checkpoints.length===1?checkpoints[0]:null;
      const metric=firstParty?firstPartyObservation(job,firstParty,filters.hours,linkIndex,counts,trackingData):observation(checkpoint,filters.metric,publishedAt);
      if(!firstParty&&(matches.length>1&&!linked.length||checkpoints.length>1)){metric.status='excluded';metric.reason='같은 게시물의 성과 기록이 겹쳐 있어요. 어느 기록을 연결할지 먼저 확인해 주세요.';metric.value=null;}
      if(!firstParty&&entry&&iso(entry.publishedAt)!==publishedAt){metric.status='excluded';metric.reason='성과 기록의 게시 시각이 실제 게시 시각과 달라요.';}
      const normalizedOptions=Object.fromEntries(Object.entries(variant.options||{}).filter(([key])=>key!=='hashtags').map(([key,value])=>[key,['link','firstComment'].includes(key)?comparisonText(value,job,linkIndex):value]));
      const condition={channelId:channel.id,channelName:channel.displayName||channel.name||channel.handle||channel.id,originKey,format,purpose:post.purpose||'',language:post.language||'',hours:filters.hours,metric:filters.metric,source:metric.source,unit:metric.unit,timing:metric.timing,observationOffsetMinutes:metric.observationOffsetMinutes,mediaFingerprint:hash(mediaIdentity(variant)),optionsFingerprint:hash(normalizedOptions)};
      const normalizedCopy=comparisonCopy(job,copy,linkIndex),id=hash(condition),group=groups.get(id)||{id,condition,variants:new Map()},variantKey=hash([originKey,normalizedCopy]);
      const item=group.variants.get(variantKey)||{id:variantKey,...copy,comparisonFingerprint:normalizedCopy,copyIds:[],sampleCount:0,missingCount:0,unsupportedCount:0,excludedCount:0,observations:[]};
      if(!item.copyIds.includes(copy.copyId))item.copyIds.push(copy.copyId);
      item.observations.push({jobId:job.id,postId:job.postId,entryId:entry?.id||null,url:job.publicationUrl,publishedAt,contentVersion:job.contentVersion,copy:{...copy},...metric,denominator:exposure(checkpoint,publishedAt),tracking:trackingFor(job,linkIndex,counts)});
      if(metric.status==='measured')item.sampleCount++;else if(metric.status==='unsupported')item.unsupportedCount++;else if(metric.status==='excluded')item.excludedCount++;else item.missingCount++;
      group.variants.set(variantKey,item);groups.set(id,group);
    }
    const rows=[...groups.values()].map(group=>({...group,variants:[...group.variants.values()].map(item=>{
      const values=item.observations.filter(row=>row.status==='measured').map(row=>row.value).sort((a,b)=>a-b),mid=Math.floor(values.length/2);
      return {...item,median:values.length?values.length%2?values[mid]:(values[mid-1]+values[mid])/2:null,min:values[0]??null,max:values.at(-1)??null,status:values.length===0?'unmeasured':values.length<3?'insufficient':'observed',observations:item.observations.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''))};})}));
    return {filters,metricDefinitions:clone(SOCIAL_COPY_METRICS),groups:rows,excluded,basis:basis+' 같은 게시물·계정에서 게시 전에 만든 자체 추적 주소만 다르고 목적지가 똑같으면 같은 문구로 봐요. 목적지의 UTM·기타 쿼리·fragment도 지우지 않고 그대로 비교해요. 대표 문구와 별개로 게시마다 원문·문구 ID·정확한 지문이 남아요. 사이트 지표는 게시 뒤 24/72시간 안에 기록된 클릭·사건만 집계해요. 브라우저 신고와 서버 확인은 더하지 않고, 수집하지 않은 동작은 짐작하지 않아요.',generatedAt:iso(clock()),minimumSamples:3};
  }
  function templatePreview(user,input={},context={}){
    user=current(user,true);if(context.signal?.aborted)throw fail('요청이 중단됐어요.',409);
    if(context.authorize&&current(context.authorize(),true).id!==user.id)throw fail('로그인한 사용자가 바뀌었어요.',401);
    const job=store.get('socialPublishJobs',input.jobId);
    if(!job||job.status!=='published')throw fail('게시가 완료된 원문을 선택해 주세요.',404);
    readable(user,job,true);const original=job.snapshot.post,variant=job.snapshot.variant,copy=copyOf(job);
    const post={...Object.fromEntries(contentFields.filter(key=>original[key]!==undefined).map(key=>[key,clone(original[key])])),title:copy.title,body:copy.text,media:clone(variant.media||[]),variants:[{channelId:job.channelId,title:copy.title,text:copy.text,format:variant.format,publicationFormat:variant.publicationFormat,media:clone(variant.media||[]),options:clone(variant.options||{}),copyVariants:[]}],recurrence:null,expiresAt:null};
    validatePostInput(user,clone(post));
    const links=tracking?.workspace(user)?.links||[],hasTrackingLink=linkReferences(job,new Map(links.map(link=>[link.shortUrl,link])),false).length>0;
    return {post,selection:{jobId:job.id,postId:job.postId,copyId:copy.copyId,fingerprint:copy.fingerprint,contentVersion:job.contentVersion},notice:'게시 당시 문구를 넣은 템플릿 제안이에요. 확인하고 이름을 정해 템플릿으로 저장하세요. 저장해도 새 승인·예약은 만들지 않아요.'+(hasTrackingLink?' 이 제안에는 기록 당시 추적 링크가 그대로 들어 있어요. 다음 게시에는 추적 링크를 새로 만들어 넣어야 문구별 유입을 나눠 볼 수 있어요.':'')};
  }
  return {comparison,templatePreview};
}
