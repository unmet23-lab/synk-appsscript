import { METRICS, dateRange, shiftDate, metricIndex, compareMetric } from '../analytics.mjs';

const known=value=>typeof value==='number'&&Number.isFinite(value);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const dayCount=(start,end)=>Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
const monday=date=>shiftDate(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7));

function pointAt(src,key,date,latest){
  let total=0,lastTotal=0,count=0,latestCount=0,eligible=0,oldest=null,newest=null;
  for(const entity of src.entities){
    if(src.isPost&&entity.publishedDate>date)continue;
    eligible++;
    const exact=src.index.get(entity.id)?.get(date)?.[key],recent=latest.get(entity.id);
    if(known(exact)){total+=exact;count++;}
    if(recent){lastTotal+=recent.value;latestCount++;if(oldest===null||recent.date<oldest)oldest=recent.date;if(newest===null||recent.date>newest)newest=recent.date;}
  }
  const complete=eligible>0&&count===eligible;
  return {total:count?total:null,latest:latestCount?lastTotal:null,count,latestCount,stale:latestCount-count,eligible,oldest,newest,complete,
    status:complete?'exact':count?'partial':latestCount?'stale':'missing'};
}

// Call with exactly the records/catalog already selected for the authenticated report.
// This intentionally has no report-start argument: all retained observations are eligible.
export function buildGrowthHistory(records,catalog,{asOf,selectionStart,selectionEnd}){
  dateRange(asOf,asOf);
  if(selectionStart)dateRange(selectionStart,selectionStart);
  if(selectionEnd)dateRange(selectionEnd,selectionEnd);
  if(selectionStart&&selectionStart>(selectionEnd||asOf))throw Object.assign(new Error('선택 시작일과 종료일을 확인해 주세요.'),{status:400});
  const channels=catalog.channels.filter(channel=>channel.ready),channelIds=new Set(channels.map(channel=>channel.id));
  const posts=records.posts.filter(post=>channelIds.has(post.channelId)&&validDate(post.publishedDate)&&post.publishedDate<=asOf),postIds=new Set(posts.map(post=>post.id));
  const postIndex=metricIndex(records.snapshots.filter(row=>postIds.has(row.postId)&&validDate(row.date)&&row.date<=asOf),'postId');
  const accountIndex=metricIndex(records.channelSnapshots.filter(row=>channelIds.has(row.channelId)&&validDate(row.date)&&row.date<=asOf),'channelId');
  const sources=new Map(),updates=new Map(),latest=new Map();let start=null,lastObservedDate=null;
  for(const {key} of METRICS){
    const src=key==='followers'?{entities:channels,index:accountIndex,isPost:false}:{entities:posts,index:postIndex,isPost:true};
    sources.set(key,src);latest.set(key,new Map());
    for(const entity of src.entities)for(const row of src.index.get(entity.id)?.values()||[]){
      if(!known(row[key]))continue;
      const date=src.isPost&&row.date<entity.publishedDate?entity.publishedDate:row.date;
      if(!updates.has(date))updates.set(date,[]);
      updates.get(date).push({key,id:entity.id,date:row.date,value:row[key]});
      if(start===null||date<start)start=date;
      if(lastObservedDate===null||date>lastObservedDate)lastObservedDate=date;
    }
  }
  const publications=new Map();for(const post of posts)publications.set(post.publishedDate,(publications.get(post.publishedDate)||0)+1);
  const daily=[];
  if(start)for(let date=start;date<=asOf;date=shiftDate(date,1)){
    for(const update of updates.get(date)||[]){const values=latest.get(update.key),previous=values.get(update.id);if(!previous||update.date>=previous.date)values.set(update.id,{date:update.date,value:update.value});}
    const metrics=Object.fromEntries(METRICS.map(({key})=>[key,{...pointAt(sources.get(key),key,date,latest.get(key)),change:compareMetric(sources.get(key),key,shiftDate(date,-1),date)}]));
    daily.push({date,start:date,end:date,days:1,newPosts:publications.get(date)||0,metrics});
  }
  function buckets(kind){
    const result=[];
    for(const row of daily){
      const calendarStart=kind==='week'?monday(row.date):row.date.slice(0,8)+'01';
      let bucket=result.at(-1);
      if(!bucket||bucket.calendarStart!==calendarStart){bucket={date:row.date,start:row.date,end:row.date,calendarStart,days:0,newPosts:0,metrics:null};result.push(bucket);}
      bucket.date=row.date;bucket.end=row.date;bucket.days++;bucket.newPosts+=row.newPosts;bucket.metrics=row.metrics;
    }
    return result.map(bucket=>({...bucket,metrics:Object.fromEntries(METRICS.map(({key})=>[key,{...bucket.metrics[key],change:compareMetric(sources.get(key),key,shiftDate(bucket.start,-1),bucket.end)}]))}));
  }
  const final=daily.at(-1)?.metrics;
  const metrics=Object.fromEntries(METRICS.map(({key})=>[key,{...(final?.[key]||pointAt(sources.get(key),key,asOf,latest.get(key))),
    change:{...compareMetric(sources.get(key),key,start||asOf,asOf),baseDate:start}}]));
  const selectedStart=start?(selectionStart&&selectionStart>start?selectionStart:start):null;
  const selectedEnd=selectionEnd&&selectionEnd<asOf?selectionEnd:asOf;
  if(selectedStart&&selectedStart>selectedEnd)throw Object.assign(new Error('선택한 기간에 보존된 기록이 없습니다.'),{status:400});
  const selected=daily.filter(row=>row.date>=selectedStart&&row.date<=selectedEnd),first=selected[0]?.metrics,last=selected.at(-1)?.metrics;
  const selection={start:selectedStart,end:selectedEnd,days:selected.length,baselineDate:selectedStart,metrics:Object.fromEntries(METRICS.map(({key})=>{
    const point=last?.[key]||pointAt(sources.get(key),key,selectedEnd,new Map());
    const dailyCoverage={days:selected.length,observedDays:0,completeDays:0,partialDays:0,staleDays:0,missingDays:0};
    for(const row of selected){const metric=row.metrics[key];if(metric.count)dailyCoverage.observedDays++;if(metric.complete)dailyCoverage.completeDays++;if(metric.status==='partial')dailyCoverage.partialDays++;if(metric.status==='stale')dailyCoverage.staleDays++;if(metric.status==='missing')dailyCoverage.missingDays++;}
    return [key,{...point,baseline:first?.[key]||null,change:{...compareMetric(sources.get(key),key,selectedStart||selectedEnd,selectedEnd),baseDate:selectedStart},dailyCoverage}];
  }))};
  return {start,end:asOf,lastObservedDate,days:start?dayCount(start,asOf):0,metrics,selection,daily,weekly:buckets('week'),monthly:buckets('month'),
    definitions:{latest:'날짜별 누적값은 그날까지 대상별 마지막 확인값의 합입니다. 이전 날짜 기록은 stale로 표시합니다.',
      total:'total은 해당 날짜에 실제 확인한 대상의 값만 합칩니다. 미확인을 0으로 바꾸지 않습니다.',
      change:'날짜·주·월 증가량은 기준일과 종료일에 비교 가능한 같은 대상의 차이입니다. 날짜별 누적값을 더하지 않습니다.',
      summary:'전체 변화는 첫 유효 기록일을 기준으로 비교 가능한 대상만 계산합니다. 기록 전 누적 성과는 증가량에 포함하지 않습니다.'}};
}
