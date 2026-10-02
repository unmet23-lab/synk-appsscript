/** Evidence-only highlights from recent API observations. No platform writes. */
export const HYPE_RULES = Object.freeze({recentDays:7,refreshMinutes:30,freshMinutes:90,minIntervalMinutes:15,maxIntervalMinutes:90,minBaselineCount:3,minRatio:1.5,maxItems:3});
const MINUTE=60_000, DAY=86_400_000;
const METRICS=Object.freeze({
  views:{label:'조회수',unit:'회',minimum:50,milestones:[1_000,5_000,10_000,50_000,100_000,500_000,1_000_000,5_000_000,10_000_000]},
  likes:{label:'좋아요',unit:'개',minimum:5,milestones:[100,500,1_000,5_000,10_000,50_000,100_000,500_000,1_000_000]},
  comments:{label:'댓글',unit:'개',minimum:2,milestones:[10,50,100,500,1_000,5_000,10_000,50_000,100_000]},
  shares:{label:'공유',unit:'회',minimum:2,milestones:[10,50,100,500,1_000,5_000,10_000,50_000,100_000]},
  saves:{label:'저장',unit:'회',minimum:2,milestones:[10,50,100,500,1_000,5_000,10_000,50_000,100_000]}
});
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const instant=value=>typeof value==='string'||typeof value==='number'||value instanceof Date?new Date(value).getTime():NaN;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const formatted=value=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value);
const validExpiry=(row,at)=>!row.expiresAt||(Number.isFinite(instant(row.expiresAt))&&instant(row.expiresAt)>at);
const sourceOf=row=>typeof row.source==='string'?row.source:'';
const metricSource=(row,key)=>typeof row.metricPeriods?.[key]?.source==='string'?row.metricPeriods[key].source:sourceOf(row);
const delayedMetric=(row,key)=>row?.metricPeriods?.[key]?.lagged===true;
const shortTitle=value=>{const title=String(value||'제목 없는 콘텐츠').trim();return title.length>48?title.slice(0,47)+'…':title;};
const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
const chronological=(a,b)=>a.time-b.time||String(a.id||'').localeCompare(String(b.id||''));

function histories(observations,posts,at) {
  const result=new Map();
  for(const observation of observations) {
    const post=posts.get(observation.postId),time=instant(observation.checkedAt);
    if(!post||!Number.isFinite(time)||time>at||time<post.publishedTime||time<at-HYPE_RULES.recentDays*DAY||!validExpiry(observation,at))continue;
    if(observation.channelId&&observation.channelId!==post.channelId)continue;
    const values=Object.fromEntries(Object.keys(METRICS).map(key=>[key,number(observation[key])]));
    const rows=result.get(post.id)||[];
    rows.push({...observation,...values,time});result.set(post.id,rows);
  }
  for(const [id,rows] of result) {
    const unique=[];
    for(const row of rows.sort(chronological)) {
      const previous=unique.at(-1);
      if(previous?.time===row.time) {
        // Conflicting simultaneous observations cannot establish growth.
        for(const key of Object.keys(METRICS))if(previous[key]!==row[key])previous[key]=null;
        if(sourceOf(previous)!==sourceOf(row))previous.source='conflicting-sources';
      } else unique.push(row);
    }
    result.set(id,unique);
  }
  return result;
}

function interval(previous,current,key) {
  if(!previous||!current||sourceOf(previous)!==sourceOf(current)||metricSource(previous,key)!==metricSource(current,key)||sourceOf(current)==='conflicting-sources'||delayedMetric(previous,key)||delayedMetric(current,key))return null;
  const minutes=(current.time-previous.time)/MINUTE;
  if(minutes<HYPE_RULES.minIntervalMinutes||minutes>HYPE_RULES.maxIntervalMinutes||previous[key]===null||current[key]===null||current[key]<previous[key])return null;
  const delta=current[key]-previous[key];
  return {previous,current,minutes,delta,normalized:delta*HYPE_RULES.refreshMinutes/minutes};
}

function ownersFor(observation,channel,users) {
  const ownership=observation.ownership;
  const ids=ownership?(ownership.known===false?[]:ownership.ownerIds||[]):channel.ownerIds||[];
  return [...new Set(ids)].map(id=>users.get(id)).filter(Boolean).map(user=>({id:user.id,name:String(user.name||'이름 미지정')}));
}

function common(post,channel,current,users) {
  const owners=ownersFor(current,channel,users);
  return {postId:post.id,channelId:channel.id,platform:channel.platform,postTitle:String(post.title||'제목 없는 콘텐츠'),url:safeUrl(post.url),thumbnailUrl:safeUrl(post.thumbnailUrl),publishedAt:post.publishedAt,channelName:String(channel.displayName||channel.handle||channel.platform||'채널'),owners,
    attribution:owners.length?`${owners.map(owner=>owner.name).join(' · ')} 담당`:'담당 확인 필요'};
}

function accelerationTitle(base,key) {
  const names=base.owners.slice(0,2).map(owner=>`${owner.name}님`).join(' · ');
  const subject=names?`${names}${base.owners.length>2?` 외 ${base.owners.length-2}명`:''} ${base.owners.length>1?'공동 ':''}담당 콘텐츠`:'이 콘텐츠';
  const phrases={
    views:['지금 관심이 붙고 있어요','조회 반응에 속도가 붙었어요'],
    likes:['좋아요가 모이고 있어요','좋아요 반응에 탄력이 붙었어요'],
    comments:['댓글로 이야기가 이어지고 있어요','댓글창이 한층 활발해졌어요'],
    shares:['공유가 이어지고 있어요','공유 반응에 속도가 붙었어요'],
    saves:['저장이 늘고 있어요','저장 반응이 눈에 띄어요']
  };
  const variant=[...base.postId].reduce((total,char)=>total+char.codePointAt(0),0)%2;
  return `${subject}, ${phrases[key][variant]}`;
}

function diverse(items) {
  const selected=[],channels=new Set(),owners=new Set(),remaining=[...items];
  // Reward a new channel and a new teammate, while preserving evidence ranking.
  while(remaining.length&&selected.length<HYPE_RULES.maxItems) {
    let best=0,bestDiversity=-1;
    for(let i=0;selected.length&&i<remaining.length;i++) {
      const item=remaining[i],diversity=(channels.has(item.channelId)?0:2)+(item.owners.some(owner=>!owners.has(owner.id))?1:0);
      if(diversity>bestDiversity){best=i;bestDiversity=diversity;}
    }
    const [item]=remaining.splice(best,1);selected.push(item);channels.add(item.channelId);item.owners.forEach(owner=>owners.add(owner.id));
  }
  return selected;
}

export function buildHypeFeed({channels=[],posts=[],observations=[],users=[],now=new Date()}={}) {
  const at=instant(now);
  if(!Number.isFinite(at))throw new TypeError('하이라이트 기준 시각을 확인해 주세요.');
  const channelMap=new Map(channels.filter(channel=>channel.active!==false&&channel.connected!==false&&!channel.collectionDisabled).map(channel=>[channel.id,channel]));
  const userMap=new Map(users.map(user=>[user.id,user]));
  const postMap=new Map(posts.map(post=>({...post,publishedTime:instant(post.publishedAt)})).filter(post=>channelMap.has(post.channelId)&&Number.isFinite(post.publishedTime)&&post.publishedTime<=at&&post.publishedTime>=at-HYPE_RULES.recentDays*DAY&&validExpiry(post,at)).map(post=>[post.id,post]));
  const history=histories(observations,postMap,at),candidates=[];
  let observedPostCount=0,latestObservationTime=null;
  const baselineByChannel=new Map();
  for(const [postId,rows] of history) {
    const channelId=postMap.get(postId).channelId,list=baselineByChannel.get(channelId)||[];
    for(let i=1;i<rows.length;i++)for(const key of Object.keys(METRICS)) {
      const sample=interval(rows[i-1],rows[i],key);
      if(sample)list.push({key,source:metricSource(rows[i],key),...sample});
    }
    baselineByChannel.set(channelId,list);
  }
  for(const [postId,rows] of history) {
    const current=rows.at(-1),previous=rows.at(-2);
    if(!current||at-current.time>HYPE_RULES.freshMinutes*MINUTE)continue;
    observedPostCount++;latestObservationTime=Math.max(latestObservationTime??0,current.time);
    const post=postMap.get(postId),channel=channelMap.get(post.channelId),base=common(post,channel,current,userMap),possible=[];
    for(const [key,definition] of Object.entries(METRICS)) {
      if(current[key]===null||sourceOf(current)==='conflicting-sources')continue;
      // A downward revision is not a positive signal, even above a milestone.
      if(previous&&previous[key]!==null&&current[key]<previous[key])continue;
      const change=interval(previous,current,key);
      const baselineSamples=change?(baselineByChannel.get(channel.id)||[]).filter(sample=>sample.key===key&&sample.source===metricSource(current,key)&&sample.current.time<=previous.time):[];
      const baseline=baselineSamples.map(sample=>sample.normalized);
      const baselineMedian=baseline.length>=HYPE_RULES.minBaselineCount?median(baseline):null;
      const ratio=baselineMedian>0&&change?change.normalized/baselineMedian:null;
      const evidence={currentAt:new Date(current.time).toISOString(),currentValue:current[key],previousAt:change?new Date(previous.time).toISOString():null,previousValue:change?previous[key]:null,intervalMinutes:change?.minutes??null,normalizedWindowMinutes:HYPE_RULES.refreshMinutes,baselineCount:baseline.length,baselineMedian,baselineStartAt:baseline.length?new Date(Math.min(...baselineSamples.map(sample=>sample.previous.time))).toISOString():null,baselineEndAt:baseline.length?new Date(Math.max(...baselineSamples.map(sample=>sample.current.time))).toISOString():null,comparisonLabel:baselineMedian===null?'비교 이력 부족':`같은 채널 이전 ${baseline.length}개 관측 구간의 중앙값 · 30분 환산`,source:metricSource(current,key)||null,lagged:delayedMetric(current,key)};
      if(change&&change.delta>=definition.minimum&&change.normalized>=definition.minimum&&ratio>=HYPE_RULES.minRatio) {
        const roundedRatio=Math.floor(ratio*10)/10;
        possible.push({...base,id:`${post.id}:acceleration:${key}`,kind:'acceleration',title:accelerationTitle(base,key),summary:`${base.attribution} · 「${shortTitle(post.title)}」 ${formatted(change.minutes)}분 동안 ${definition.label} +${formatted(change.delta)}${definition.unit}. 같은 채널의 이전 관측 대비 ${formatted(roundedRatio)}배 속도예요.`,metric:key,metricLabel:definition.label,value:current[key],delta:change.delta,normalizedDelta:change.normalized,ratio,milestone:null,evidence,score:100+Math.min(ratio,20)*5+Math.log1p(change.normalized/definition.minimum)});
      } else {
        const milestone=definition.milestones.filter(value=>current[key]>=value).at(-1);
        if(!milestone)continue;
        possible.push({...base,id:`${post.id}:milestone:${key}:${milestone}`,kind:'milestone',title:`${definition.label} ${formatted(milestone)}${definition.unit}의 기록, 함께 볼까요?`,summary:`${base.attribution} · 「${shortTitle(post.title)}」 누적 ${definition.label} ${formatted(current[key])}${definition.unit}가 확인됐어요.`,metric:key,metricLabel:definition.label,value:current[key],delta:change?.delta??null,normalizedDelta:change?.normalized??null,ratio:null,milestone,evidence:{...evidence,comparisonLabel:delayedMetric(current,key)?'플랫폼에서 지연 반영한 누적 수치 · 실시간 반응과 성장 속도 비교 아님':'최근 확인한 누적 수치 · 성장 속도 비교 아님'},score:Math.log10(milestone/definition.milestones[0]+1)});
      }
    }
    possible.sort((a,b)=>b.score-a.score||a.metric.localeCompare(b.metric));
    if(possible.length)candidates.push(possible[0]);
  }
  candidates.sort((a,b)=>b.score-a.score||Date.parse(b.evidence.currentAt)-Date.parse(a.evidence.currentAt)||a.postId.localeCompare(b.postId));
  const items=diverse(candidates).map(({score,...item})=>item);
  return {generatedAt:new Date(at).toISOString(),latestObservationAt:latestObservationTime===null?null:new Date(latestObservationTime).toISOString(),eligiblePostCount:postMap.size,observedPostCount,items,rules:{...HYPE_RULES}};
}
