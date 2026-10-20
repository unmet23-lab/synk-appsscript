'use strict';
// Read already collected observations. No API calls, new scheduler, aggregation or metric estimation.
const fs=require('node:fs');
const METRICS=Object.freeze({
  views:['조회','count'],likes:['좋아요','count'],comments:['댓글','count'],shares:['공유','count'],saves:['저장','count'],reach:['도달','count'],
  earlyRetention3sPct:['3초 유지율','percent',100],stayedToWatchPct:['본 비율','percent',100],
  averageWatchSeconds:['평균 시청 시간','seconds'],averageViewPct:['평균 조회율','percent'],
  completionRatePct:['완주율','percent',100],toolVisits:['맞춤 도구 유입','count'],subscribersGained:['구독 증가','count'],subscribersLost:['구독 취소','count'],
});
const PLATFORMS=['youtube','instagram','facebook','tiktok'];
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const text=(value,max=160)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\b(?:Bearer\s+\S+|(?:sk-|ghp_|github_pat_|AIza)[A-Za-z0-9_-]{12,})/gi,'[숨김]').slice(0,max):'';
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const code=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,120}$/.test(value)?value:null;
function publicUrl(value,platform){
  try{const u=new URL(value),hosts={youtube:['youtube.com','www.youtube.com','youtu.be'],instagram:['instagram.com','www.instagram.com'],facebook:['facebook.com','www.facebook.com','fb.watch'],tiktok:['tiktok.com','www.tiktok.com']};
    if(u.protocol!=='https:'||u.username||u.password||!hosts[platform]?.includes(u.hostname))return null;
    u.hash='';for(const key of [...u.searchParams.keys()])if(!['v'].includes(key))u.searchParams.delete(key);return u.href;
  }catch{return null;}
}
function metricValue(value,key){
  const definition=METRICS[key];return typeof value==='number'&&Number.isFinite(value)&&value>=0&&
    (definition[1]!=='count'||Number.isSafeInteger(value))&&(definition[2]===undefined||value<=definition[2])?value:null;
}
function provenance(raw){
  if(!raw||typeof raw!=='object')return null;
  const output={source:code(raw.source),observedAt:iso(raw.observedAt),recordedAt:iso(raw.recordedAt),
    timing:['on-time','late','early','missed','window'].includes(raw.timing)?raw.timing:null,estimated:raw.estimated===true,measurementWindowMissed:raw.measurementWindowMissed===true};
  if(raw.kind==='window'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(raw.startDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(raw.endDate||'')||raw.startDate>raw.endDate||raw.timeZone!=='America/Los_Angeles')return null;
    Object.assign(output,{kind:'window',startDate:raw.startDate,endDate:raw.endDate,timeZone:raw.timeZone});
  }
  if(['reels_skip_rate'].includes(raw.derivedFrom))output.derivedFrom=raw.derivedFrom;
  return output;
}
function sanitizePerformance(payload){
  if(!payload||payload.schemaVersion!==1||!iso(payload.checkedAt)||!Array.isArray(payload.channels)||!Array.isArray(payload.entries))throw Error('PERFORMANCE_SHAPE');
  if(payload.channels.length>200||payload.entries.length>500)throw Error('PERFORMANCE_LIMIT');
  const seen=new Set(),channels=[];
  for(const row of payload.channels){
    if(!row||!code(row.id)||seen.has(row.id)||!PLATFORMS.includes(row.platform))throw Error('PERFORMANCE_CHANNEL');
    seen.add(row.id);
    const snapshot=row.snapshot&&typeof row.snapshot==='object'?row.snapshot:null;
    channels.push({id:row.id,platform:row.platform,label:text(row.label)||row.platform,url:publicUrl(row.url,row.platform),
      snapshot:snapshot&&iso(snapshot.checkedAt)?{checkedAt:iso(snapshot.checkedAt),date:/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date||'')?snapshot.date:null,
        followers:count(snapshot.followers),views:count(snapshot.views),posts:count(Object.hasOwn(snapshot,'postCount')?snapshot.postCount:snapshot.posts),source:code(snapshot.source),expiresAt:iso(snapshot.expiresAt)}:null});
  }
  const entryIds=new Set(),entries=[];
  for(const row of payload.entries){
    if(!row||!code(row.id)||entryIds.has(row.id)||!seen.has(row.channelId)||!iso(row.publishedAt))throw Error('PERFORMANCE_ENTRY');
    const channel=channels.find(channel=>channel.id===row.channelId),url=publicUrl(row.url,channel.platform);
    if(!url)continue;entryIds.add(row.id);
    if(!Array.isArray(row.checkpoints)||row.checkpoints.length>2)throw Error('PERFORMANCE_CHECKPOINT');
    const hours=new Set();
    const checkpoints=row.checkpoints.map(checkpoint=>{
      if(![24,72].includes(checkpoint?.hours)||hours.has(checkpoint.hours))throw Error('PERFORMANCE_CHECKPOINT');hours.add(checkpoint.hours);
      const metricProvenance={},metrics={};
      for(const key of Object.keys(METRICS)){
        const raw=checkpoint.metricProvenance?.[key],p=provenance(raw);
        // A malformed period cannot silently turn into a point-in-time value.
        metrics[key]=raw?.kind==='window'&&!p?null:metricValue(checkpoint.metrics?.[key],key);
        if(p)metricProvenance[key]=p;
      }
      const w=checkpoint.window;
      return {hours:checkpoint.hours,status:code(checkpoint.status)||'unknown',dueAt:iso(checkpoint.dueAt),observedAt:iso(checkpoint.observedAt),
        timing:['on-time','late','early','missed'].includes(checkpoint.timing)?checkpoint.timing:null,measurementWindowMissed:checkpoint.measurementWindowMissed===true,
        recordedAt:iso(checkpoint.recordedAt),source:code(checkpoint.source),metrics,metricProvenance,
        window:w&&typeof w==='object'?{status:code(w.status)||'unknown',dueAt:iso(w.dueAt),fetchedAt:iso(w.fetchedAt),lastErrorCode:code(w.lastErrorCode)}:null};
    });
    entries.push({id:row.id,channelId:row.channelId,title:text(row.title,240)||'게시물',url,publishedAt:iso(row.publishedAt),expiresAt:iso(row.expiresAt),checkpoints});
  }
  return {schemaVersion:1,checkedAt:iso(payload.checkedAt),appRunning:payload.appRunning===true,channels,entries,
    coverage:{channels:count(payload.coverage?.channels)??channels.length,entries:count(payload.coverage?.entries)??entries.length,
      limited:payload.coverage?.limited===true}};
}
function performanceSummary(payload,{now=Date.now()}={}){
  let data;try{data=sanitizePerformance(payload);}catch{return {available:false,stale:true,checkedAt:null,channels:[],observations:[],error:'기존 성과 수집 사본을 읽지 못했습니다.'};}
  const stamp=now instanceof Date?now.getTime():now,age=stamp-Date.parse(data.checkedAt),stale=age>6*3600000||age< -60000;
  const channels=data.channels.map(row=>{
    const expired=!!row.snapshot?.expiresAt&&Date.parse(row.snapshot.expiresAt)<=stamp;
    return {...row,expired,snapshot:expired?null:row.snapshot};
  });
  const observations=data.entries.flatMap(entry=>{
    const expired=!!entry.expiresAt&&Date.parse(entry.expiresAt)<=stamp;
    return entry.checkpoints.map(checkpoint=>{
      const metrics=Object.entries(checkpoint.metrics).map(([key,value])=>{
        const p=checkpoint.metricProvenance[key],period=p?.kind==='window'?`${p.startDate}~${p.endDate} · ${p.timeZone}`:`게시 ${checkpoint.hours}시간 관측`;
        return {key,label:METRICS[key][0],unit:METRICS[key][1],value:expired?null:value,period,kind:p?.kind==='window'?'window':'checkpoint',
          observedAt:p?.observedAt||checkpoint.observedAt,recordedAt:p?.recordedAt||checkpoint.recordedAt,source:p?.source||checkpoint.source,estimated:p?.estimated===true,
          timing:p?.timing||checkpoint.timing,measurementWindowMissed:p?.measurementWindowMissed===true||checkpoint.measurementWindowMissed===true};
      });
      return {entryId:entry.id,channelId:entry.channelId,title:entry.title,url:entry.url,publishedAt:entry.publishedAt,hours:checkpoint.hours,
        status:checkpoint.status,expired,dueAt:checkpoint.dueAt,window:checkpoint.window,metrics};
    });
  });
  return {available:true,stale,checkedAt:data.checkedAt,appRunning:data.appRunning,coverage:data.coverage,channels,observations,
    scope:'기존 회사 수집 결과를 재사용합니다. 계정 누적값·게시 24/72시간 관측·기간 지표는 별개이며 더하거나 서로 바꾸지 않습니다.'};
}
function readCachedPerformance(file,{now=Date.now()}={}){
  try{
    if(!file)throw Error('NOT_CONFIGURED');
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2_000_000)throw Error('INVALID_CACHE');
    const record=JSON.parse(fs.readFileSync(file,'utf8'));
    // Preserve the remote observation time, not this local read time.
    return performanceSummary(record.performance,{now});
  }catch{return performanceSummary(null,{now});}
}
module.exports={METRICS,sanitizePerformance,performanceSummary,readCachedPerformance};
