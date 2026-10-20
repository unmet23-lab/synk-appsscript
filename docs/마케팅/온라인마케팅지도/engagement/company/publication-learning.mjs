import {POST_PERFORMANCE_METRICS,normalizePerformancePostUrl} from './post-performance.mjs';
import {canReadChannel,canWriteChannel} from './organization.mjs';

const HOUR=3600000,MINUTE=60000,MIN_SAMPLE=3;
const FORMATS=Object.freeze({'youtube-shorts':{platform:'youtube',label:'YouTube Shorts'},'youtube-video':{platform:'youtube',label:'YouTube 영상'},'instagram-reels':{platform:'instagram',label:'Instagram Reels'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const validMetric=(value,definition)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&(definition.unit!=='count'||Number.isSafeInteger(value))&&(definition.max===undefined||value<=definition.max);
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length?sorted.length%2?sorted[middle]:sorted[middle-1]+(sorted[middle]-sorted[middle-1])/2:null;};
const deltaPercent=(value,middle)=>{const result=middle>0?Math.round((value-middle)/middle*1000)/10:null;return Number.isFinite(result)?result:null;};
const emptyComparison=status=>({sampleCount:0,median:null,deltaPercent:null,status});
const valueText=fact=>`${fact.value}${fact.unit==='percent'?'%':fact.unit==='seconds'?'초':'회'}`;
const sourceText=(source,platform)=>source==='manual'?'직접 확인':source.startsWith('api:')?'자동 관측 · '+({'youtube':'YouTube','instagram':'Instagram','tiktok':'TikTok','threads':'Threads','facebook':'Facebook','x':'X','linkedin':'LinkedIn','douyin':'Douyin','vk':'VK','xiaohongshu':'Xiaohongshu'}[platform]||platform):source;
const RULE='이전 3편부터 견주는 건 화면에 보여 주는 기준일 뿐이에요. 통계적으로 확실하다거나 성과의 원인을 증명하지는 않아요.';
// 제작 방식 v2 §6 「그 계정 안에서 상위 25%」. 같은 계정·형식의 이전 4편 이상일 때만 견준다. 지표를 하나로 합치지 않고 지표마다 따로 보여 준다(10-19).
// 순위는 「이전 기록보다 큰 비율 + 같은 값의 절반」(가운데 순위)으로 잰다. 0.75를 넘으면 상위, 0.25 미만이면 하위다.
// 같은 값이 많은 작은 정수(공유·저장 0·1)에서 중앙값을 상·하위로 부르던 것을 막는다(10-20). 이전 값이 세 가지 미만이면 위아래를 가르지 않는다(중간).
const STANDING_MIN=4;
// 다음 할 일(세 편 더 / 도입 바꿔 다른 계정에서)은 v2 §6의 네 숫자 — 초반 유지·평균 시청과 완주·보내기와 저장·맞춤 도구 유입 — 로만 정한다.
// 조회·좋아요·댓글·도달은 판정 줄만 보여 준다(v2 §6 「조회수만으로 보지 않는다」, 10-19 Fable 검수 반영).
// 초반 유지에는 유튜브 쇼츠 「본 비율」(손 입력), 평균 시청률에는 유튜브 평균 조회율(창 지표)도 든다(10-20).
const NEXT_STEP_METRICS=new Set(['earlyRetention3sPct','stayedToWatchPct','averageWatchSeconds','averageViewPct','completionRatePct','shares','saves','toolVisits']);
// 창 지표: YouTube Analytics가 날짜(태평양시)별로 늦게 채우는 값을 게시 5일 뒤 「게시일부터 사흘」 고정 창으로 받은 것(post-performance.mjs).
const WINDOW_TIME_ZONE='America/Los_Angeles',WINDOW_DAYS=3;
const addDays=(date,days)=>new Date(Date.parse(date+'T00:00:00.000Z')+days*24*HOUR).toISOString().slice(0,10);
const windowValid=(meta,definition)=>meta?.kind==='window'&&meta.lagged===true&&meta.unit===definition.unit&&typeof meta.source==='string'&&!!meta.source.trim()&&meta.source.length<=100&&meta.timeZone===WINDOW_TIME_ZONE&&meta.days===WINDOW_DAYS&&/^\d{4}-\d{2}-\d{2}$/.test(meta.startDate||'')&&Number.isFinite(Date.parse(meta.startDate+'T00:00:00.000Z'))&&meta.endDate===addDays(meta.startDate,WINDOW_DAYS-1);
const windowText=fact=>fact.window?`${fact.window.startDate}~${fact.window.endDate}(태평양시) 창`:'';
// 지표 이름 끝 글자의 받침으로 조사를 고른다(「공유를」·「평균 조회율을」).
const josa=(word,[withFinal,withoutFinal])=>{const code=String(word).slice(-1).charCodeAt(0)-0xac00;return word+(code>=0&&code<=11171&&code%28===0?withoutFinal:withFinal);};
const nearestRank=(sorted,percent)=>sorted[Math.max(0,Math.ceil(percent/100*sorted.length)-1)];
function standingOf(value,values){
  if(values.length<STANDING_MIN)return null;
  const sorted=[...values].sort((a,b)=>a-b),low=nearestRank(sorted,25),high=nearestRank(sorted,75);
  const rank=(sorted.filter(item=>item<value).length+sorted.filter(item=>item===value).length/2)/sorted.length;
  const label=new Set(sorted).size<3?'middle':rank>0.75?'top25':rank<0.25?'bottom25':'middle';
  return {label,p25:low,p75:high,sampleCount:sorted.length};
}
const CAUTION='숫자는 읽은 시점까지 쌓인 누적값이에요. 실험이 효과가 있는지, 시청자가 실제로 배웠는지는 아직 확인하지 않았어요.';

// Rebuild the learning cards from their current sources. This service never
// stores a second learning record or starts collection, generation, or posting.
export function createPublicationLearningService({store,postPerformance,publicationPackages,studio,clock=()=>new Date().toISOString()}={}){
  if(!store||!postPerformance||!publicationPackages||!studio)throw new Error('Publication learning requires its source services.');
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function available(read){try{return read();}catch(error){if([403,404,409,422].includes(error.status))return null;throw error;}}
  function sourceFor(user,entry,cache){
    if(!entry.publicationPackageId)return {source:null,pack:null};
    if(cache.has(entry.publicationPackageId))return cache.get(entry.publicationPackageId);
    const result=available(()=>{
      const pack=publicationPackages.get(user,entry.publicationPackageId)?.package;
      if(!pack||pack.state!=='prepared')return null;
      const production=studio.production(user,pack.productionId)?.production;
      const version=production?.versions?.find(row=>row.id===pack.versionId);
      if(!version||version.kind!=='video'||!version.mediaId)return null;
      const media=studio.readableMedia(user,version.mediaId);
      if(media?.productionId!==production.id)return null;
      return {pack,source:{available:true,packageId:pack.id,title:clean(pack.title||production.title),productionId:production.id,versionId:version.id,versionLabel:clean(version.label,100)}};
    })||{source:null,pack:null};
    cache.set(entry.publicationPackageId,result);return result;
  }
  function formatFor(entry,pack){
    if(entry.publicationFormat){const known=FORMATS[entry.publicationFormat];return known?.platform===entry.platform?{id:entry.publicationFormat,label:known.label}:null;}
    const options=[...new Set((pack?.channels||[]).filter(id=>FORMATS[id]?.platform===entry.platform))];
    return options.length===1?{id:options[0],label:FORMATS[options[0]].label}:null;
  }
  function provenance(checkpoint,definition,now){
    const meta=checkpoint?.metricProvenance?.[definition.id],observed=instant(meta?.observedAt),due=instant(checkpoint?.dueAt),closes=instant(checkpoint?.closesAt);
    if(meta?.kind==='window'){
      // 창 지표는 그 지점의 스냅숏 상태·관측 지연과 상관없이 같은 창 정의의 값끼리만 견준다.
      const valid=windowValid(meta,definition)&&observed!==null&&observed<=now;
      return {valid,windowed:true,sourceKey:meta.source,source:clean(meta.source,100)||'출처 미기록',observedAt:observed!==null&&observed<=now?new Date(observed).toISOString():null,offset:null,window:valid?{startDate:meta.startDate,endDate:meta.endDate,timeZone:meta.timeZone}:null,estimated:false};
    }
    const valid=checkpoint?.status==='recorded'&&meta&&meta.unit===definition.unit&&typeof meta.source==='string'&&!!meta.source.trim()&&meta.source.length<=100&&observed!==null&&observed<=now&&due!==null&&closes!==null&&closes>=due&&closes<=due+6*HOUR&&observed>=due&&observed<=closes&&!meta.measurementWindowMissed;
    return {valid:!!valid,windowed:false,sourceKey:meta?.source,source:clean(meta?.source||checkpoint?.source,100)||'출처 미기록',observedAt:observed!==null&&observed<=now?new Date(observed).toISOString():!meta&&instant(checkpoint?.observedAt)!==null&&instant(checkpoint.observedAt)<=now?new Date(checkpoint.observedAt).toISOString():null,offset:valid?observed-due:null,window:null,estimated:meta?.estimated===true};
  }
  // provenanceOf는 한 번의 정리 안에서 같은 기록·지표의 근거를 한 번만 계산한다(기록 × 이전 기록 × 지표마다 시각을 다시 해석하던 것).
  function compare(current,definition,rows,now,provenanceOf=(checkpoint,item)=>provenance(checkpoint,item,now)){
    const checkpoint=current.checkpoint,meta=provenanceOf(checkpoint,definition);
    if(!current.format||!meta.valid)return emptyComparison('unavailable');
    const seen=new Set(),values=[];
    for(const prior of rows){
      if(prior.entry.id===current.entry.id||prior.entry.channelId!==current.entry.channelId||prior.entry.platform!==current.entry.platform||prior.format?.id!==current.format.id||(prior.publishedMs??instant(prior.entry.publishedAt))>=(current.publishedMs??instant(current.entry.publishedAt))||prior.entry.postIdentity&&prior.entry.postIdentity===current.entry.postIdentity)continue;
      const value=prior.checkpoint?.metrics?.[definition.id],previous=provenanceOf(prior.checkpoint,definition);
      if(!validMetric(value,definition)||!previous.valid||previous.sourceKey!==meta.sourceKey||previous.windowed!==meta.windowed||!meta.windowed&&Math.abs(previous.offset-meta.offset)>15*MINUTE)continue;
      const identity=prior.entry.postIdentity||prior.url;if(seen.has(identity))continue;seen.add(identity);values.push(value);
    }
    if(values.length<MIN_SAMPLE)return {...emptyComparison('insufficient'),sampleCount:values.length};
    const middle=median(values),value=checkpoint.metrics[definition.id],standing=standingOf(value,values);
    return {sampleCount:values.length,median:middle,deltaPercent:deltaPercent(value,middle),status:'ready',...(standing?{standing}:{})};
  }
  function experimentsFor(facts,status){
    const ready=facts.filter(fact=>fact.comparison.status==='ready');
    if(status!=='ready')return [{id:'observe-again',title:'같은 형식으로 한 편 더 올리기',reason:`72시간 숫자 ${facts.length}개를 받았지만 같은 조건으로 비교할 편이 아직 적어요. 잘됐는지는 아직 판단하지 않아요.`,change:'형식·길이·올리는 계정과 시간대는 되도록 그대로 두고 예시 하나만 바꿔요.',measure:'다음 편도 72시간 무렵 같은 방식(자동 수집이나 직접 입력)으로 숫자를 남겨요. 같은 조건의 이전 편이 3편 모이면 그때부터 견줄 수 있어요.'}];
    const reason=fact=>`${fact.label} ${valueText(fact)} · 같은 계정·형식의 이전 ${fact.comparison.sampleCount}편 중앙값 ${valueText({...fact,value:fact.comparison.median})}. 왜 그런지는 아직 몰라요.`;
    const result=[],ranked=ready.filter(fact=>fact.comparison.standing&&NEXT_STEP_METRICS.has(fact.id)),tops=ranked.filter(fact=>fact.comparison.standing.label==='top25'),bottoms=ranked.filter(fact=>fact.comparison.standing.label==='bottom25');
    // 지표마다 걸러진 이전 편 수가 다를 수 있어 가장 적은 수와 가장 많은 수를 함께 적는다.
    const sampleText=list=>{const counts=list.map(fact=>fact.comparison.standing.sampleCount),low=Math.min(...counts),high=Math.max(...counts);return low===high?String(low):`${low}~${high}`;};
    const rankedReason=(list,label)=>`${label} 지표: ${list.map(fact=>fact.label).join('·')}(같은 계정·형식 이전 ${sampleText(list)}편 기준). 왜 그런지는 아직 몰라요.`;
    // v2 §6: 상위면 같은 형식으로 세 편 더, 하위면 도입을 바꾼 판을 다른 씨앗 계정에서 시험하거나 접는다. 지표가 엇갈리면 제안하지 않는다.
    if(tops.length&&!bottoms.length)result.push({id:'repeat-format',title:'같은 형식으로 세 편 더 만들기',reason:rankedReason(tops,'상위 25%'),change:'형식·길이·도입은 그대로 두고 주제나 예시만 바꿔 세 편을 더 올려요.',measure:'세 편 모두 72시간 무렵 같은 방식으로 숫자를 남겨, 이번처럼 상위 25%가 또 나오는지 봐요.'});
    if(bottoms.length&&!tops.length)result.push({id:'new-hook-elsewhere',title:'첫 3초를 바꾼 판을 다른 계정에 올리기',reason:rankedReason(bottoms,'하위 25%'),change:'본론은 그대로 두고 첫 3초 도입만 바꿔 다른 씨앗 계정에 올려요. 거기서도 하위 25%면 이 주제는 접어요.',measure:'바꾼 판의 72시간 숫자를 그 계정의 이전 편과 같은 조건으로 견줘요.'});
    const first=(...ids)=>ids.map(id=>ready.find(fact=>fact.id===id)).find(Boolean);
    const retention=first('earlyRetention3sPct','stayedToWatchPct'),watch=first('completionRatePct','averageViewPct','averageWatchSeconds'),action=first('toolVisits','saves','shares');
    // 창 지표는 「비슷한 관측 시점」이 아니라 같은 창(태평양시 게시일부터 사흘)으로 견준다.
    const when=fact=>fact.window?`게시 5일 뒤 받는 같은 창(태평양시 게시일부터 사흘)의 ${josa(fact.label,['을','를'])} 같은 출처끼리`:`72시간 ${josa(fact.label,['을','를'])} 비슷한 시각에 같은 방식으로 받아`;
    if(retention&&retention.value<retention.comparison.median)result.push({id:'opening',title:'첫 3초 도입만 바꾸기',reason:reason(retention),change:'본론의 결과를 첫 3초에 먼저 보여 주는 도입으로 바꾸고, 나머지 구성은 그대로 둬요.',measure:`72시간 ${josa(retention.label,['을','를'])} 비슷한 시각에 같은 방식으로 받아 견줘요.`});
    if(watch&&watch.value<watch.comparison.median)result.push({id:'length',title:'중간 설명 한 구간만 줄이기',reason:reason(watch),change:'도입과 핵심 예시는 그대로 두고, 되풀이되는 중간 설명 한 구간만 덜어 내요.',measure:`${when(watch)} 견줘요. 길이가 바뀌면 이 숫자도 저절로 움직이니, 바뀐 길이를 같이 적어 둬요.`});
    if(action&&action.value<action.comparison.median)result.push({id:'call-to-action',title:'마지막 안내 한 문장만 바꾸기',reason:reason(action),change:'본문은 그대로 두고, 마지막 안내를 시청자가 바로 할 행동 하나(링크 열기·저장·공유 중 하나)로 바꿔요.',measure:`${when(action)} 견줘요. 조회 수가 달라지면 이 숫자도 따라 움직이니, 조회 차이도 같이 봐요.`});
    if(result.length<3){const anchor=ready.find(fact=>fact.id==='views')||ready[0];result.push({id:'new-example',title:'같은 형식에 예시만 바꿔 넣기',reason:reason(anchor),change:'도입과 길이는 그대로 두고, 시청자가 실제로 겪는 예시 하나만 바꿔요.',measure:`72시간 ${anchor.label} 숫자를 비슷한 시각에 같은 방식으로 받아 견주고, 결과가 되풀이되는지 봐요.`});}
    return result.slice(0,3);
  }
  function build(user){
    user=current(user);const now=instant(clock());if(now===null)throw fail('서버 시각을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.',500);
    const generatedAt=new Date(now).toISOString(),result=postPerformance.list(user),cache=new Map(),rows=[];
    for(const entry of result.entries||[]){
      const channel=store.get('channels',entry.channelId);
      if(entry.active===false||!channel||channel.active===false||channel.platform!==entry.platform||!canReadChannel(user,channel)||instant(entry.publishedAt)===null||instant(entry.publishedAt)>now)continue;
      let normalized;try{normalized=normalizePerformancePostUrl(entry.url);}catch{continue;}
      if(normalized.platform!==entry.platform||entry.postIdentity&&entry.postIdentity!==normalized.identity)continue;
      const checkpoint=(entry.checkpoints||[]).find(item=>item.hours===72),linked=sourceFor(user,entry,cache);
      rows.push({entry,checkpoint,url:normalized.canonicalUrl,source:linked.source,format:formatFor(entry,linked.pack),canEdit:entry.canEdit===true&&canWriteChannel(user,channel),publishedMs:instant(entry.publishedAt)});
    }
    // compare()는 같은 채널의 이전 기록만 쓴다. 채널별로 미리 묶어 「전체 기록 × 전체 기록」 계산을 피한다(10-20 자동 등록으로 기록이 늘어남).
    const sameChannel=new Map();for(const row of rows){if(!sameChannel.has(row.entry.channelId))sameChannel.set(row.entry.channelId,[]);sameChannel.get(row.entry.channelId).push(row);}
    const memo=new WeakMap(),provenanceOf=(checkpoint,definition)=>{if(!checkpoint||typeof checkpoint!=='object')return provenance(checkpoint,definition,now);let byMetric=memo.get(checkpoint);if(!byMetric)memo.set(checkpoint,byMetric=new Map());if(!byMetric.has(definition.id))byMetric.set(definition.id,provenance(checkpoint,definition,now));return byMetric.get(definition.id);};
    const cards=rows.map(row=>{
      const {entry,checkpoint,format,source}=row,due=instant(checkpoint?.dueAt),limits=[],missing=[],facts=[],peers=sameChannel.get(entry.channelId);
      // 자동 등록·주소로 등록한 게시물은 처음부터 게시 준비와 연결이 없다. 「열 수 없어」는 연결이 있는데 못 읽을 때만 쓴다(10-20).
      if(!source)limits.push(entry.publicationPackageId?'연결한 원본을 지금 열 수 없어서 원본 내용은 기획에 가져오지 않아요.':'작업실 게시 준비와 연결되지 않은 게시물이라 원본 내용은 기획에 가져오지 않아요.');
      if(!format)limits.push('게시한 영상 형식(쇼츠·일반 영상·릴스)이 정해지지 않아 이전 성과와 견주지 않아요.');
      for(const definition of POST_PERFORMANCE_METRICS){
        // 창 지표는 72시간 스냅숏을 놓친 지점에도 남는다(플랫폼이 날짜별로 다시 센 값).
        if(checkpoint?.status!=='recorded'&&checkpoint?.metricProvenance?.[definition.id]?.kind!=='window')continue;
        const value=checkpoint.metrics?.[definition.id];if(!validMetric(value,definition))continue;
        const meta=provenanceOf(checkpoint,definition);
        facts.push({id:definition.id,label:definition.label,value,unit:definition.unit,observedAt:meta.observedAt,source:meta.source,...(meta.window?{lagged:true,window:meta.window}:{}),...(meta.estimated?{estimated:true}:{}),comparison:compare(row,definition,peers,now,provenanceOf)});
        if(!meta.valid&&!limits.includes('읽은 시각·출처·단위가 빠졌거나 모을 기간(목표 시각부터 6시간) 밖에 읽은 숫자는 비교에서 뺐어요.'))limits.push('읽은 시각·출처·단위가 빠졌거나 모을 기간(목표 시각부터 6시간) 밖에 읽은 숫자는 비교에서 뺐어요.');
        if(meta.offset>15*MINUTE&&!limits.includes('목표 시각보다 15분 넘게 늦게 읽은 누적 숫자가 들어 있어요.'))limits.push('목표 시각보다 15분 넘게 늦게 읽은 누적 숫자가 들어 있어요.');
      }
      const windowed=facts.find(fact=>fact.window);
      if(windowed)limits.push(`${josa(facts.filter(fact=>fact.window).map(fact=>fact.label).join('·'),['은','는'])} YouTube Analytics가 늦게 채우는 숫자라, 게시 5일 뒤 ${windowText(windowed)}으로 받았어요. 72시간 그 시각의 숫자가 아니어서 같은 창끼리만 견줘요.`);
      if(facts.some(fact=>fact.estimated))limits.push(`${josa(facts.filter(fact=>fact.estimated).map(fact=>fact.label).join('·'),['은','는'])} 플랫폼이 추정치나 개발 중으로 표시한 지표에서 계산한 숫자예요.`);
      for(const definition of POST_PERFORMANCE_METRICS)if(!facts.some(fact=>fact.id===definition.id)&&(!definition.platforms||definition.platforms.includes(entry.platform)))missing.push(definition.label);
      const status=due!==null&&due>now?'waiting':!facts.length||due===null?'missing':facts.some(fact=>fact.comparison.status==='ready')?'ready':'limited';
      if(status==='limited')limits.push('비교할 편이 아직 적어요. 같은 조건의 이전 편이 3편 이상 모인 숫자가 없어요.');
      if(missing.length&&facts.length)limits.push('받지 못한 숫자는 0으로 치지 않아요. 모든 칸을 다 채우지 않아도 돼요.');
      limits.push(RULE,CAUTION);
      const labels={waiting:'72시간 기다리는 중',missing:'72시간 숫자 없음',limited:'비교할 편 적음',ready:'비교할 수 있음'};
      const summary=status==='waiting'?'72시간이 되면 받은 숫자로 정리해요.':status==='missing'?'72시간 숫자가 아직 없어요. 플랫폼 화면에 나온 72시간 숫자를 직접 넣어 주세요.':status==='limited'?`받은 숫자 ${facts.length}개를 다음 편과 견줄 기준으로 남겨 둬요.`:`받은 숫자 ${facts.length}개 중 ${facts.filter(fact=>fact.comparison.status==='ready').length}개를 같은 조건의 이전 편과 견줄 수 있어요.`;
      return {entryId:entry.id,title:clean(entry.title)||'게시한 콘텐츠',channelName:clean(entry.channelName)||clean(entry.channelId),platform:entry.platform,url:row.url,format,status,statusLabel:labels[status],summary,dueAt:due===null?null:new Date(due).toISOString(),observedAt:instant(checkpoint?.observedAt)!==null&&instant(checkpoint.observedAt)<=now?new Date(checkpoint.observedAt).toISOString():null,missing,limits,facts,source,experiments:['limited','ready'].includes(status)?experimentsFor(facts,status):[],canPlan:row.canEdit&&user.role!=='viewer'&&['limited','ready'].includes(status)};
    });
    return {cards,generatedAt};
  }
  function plan(user,entryId,input={}){
    user=current(user);if(user.role==='viewer')throw fail('열람 계정은 새 기획을 만들 수 없어요.',403);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='experimentId')||typeof input.experimentId!=='string')throw fail('화면에 보이는 실험 중 하나를 골라 주세요.');
    const card=build(user).cards.find(row=>row.entryId===entryId);if(!card)throw fail('게시 기록을 찾지 못했어요.',404);
    if(!card.canPlan)throw fail('이 기록으로는 아직 새 기획을 만들 수 없어요. 72시간 숫자가 있고, 이 계정을 맡은 사람만 만들 수 있어요.',403);
    const experiment=card.experiments.find(row=>row.id===input.experimentId);if(!experiment)throw fail('화면에 보이는 실험 중 하나를 골라 주세요.',409);
    const facts=card.facts.map(fact=>`${fact.label}: ${valueText(fact)} | ${sourceText(fact.source,card.platform)}${fact.window?' | '+windowText(fact):''}${fact.estimated?' | 추정':''} | 관측 ${fact.observedAt||'미기록'}`);
    const lines=[`72시간 성과 기록 · ${card.title}`,`게시 출처: ${card.url}`,`목표 시각: ${card.dueAt}`,`형식: ${card.format?.label||'미확정'}`,...facts,`선택 실험: ${experiment.title}`,`바꿀 한 가지: ${experiment.change}`,`확인할 지표: ${experiment.measure}`,'한계: '+card.limits.join(' ')];
    let proof=lines.join('\n');
    if(proof.length>3000)throw fail('성과 기록이 기획 메모 한도(3,000자)를 넘어 옮기지 못했어요.',422);
    const comparisons=card.facts.filter(fact=>fact.comparison.status==='ready').map(fact=>`${fact.label} 비교: 이전 ${fact.comparison.sampleCount}편, 중앙값 ${valueText({...fact,value:fact.comparison.median})}${fact.comparison.deltaPercent===null?fact.comparison.median===0?' · 중앙값 0으로 변화율 계산 안 함':' · 변화율을 계산할 수 없음':`, 변화율 ${fact.comparison.deltaPercent}%`}`);
    for(const line of comparisons)if(proof.length+line.length+1<=3000)proof+='\n'+line;
    const sourceLine=card.source?`연결 원본: ${card.source.title} · ${card.source.versionLabel}`:'';
    if(sourceLine&&proof.length+sourceLine.length+1<=3000)proof+='\n'+sourceLine;
    const data={topic:clean(card.title,300),audience:'',experience:'',proof:'',editorialNote:proof,takeaway:'',entertainment:'',channelId:'',referenceId:'',benchmarkId:'',benchmarkItemId:'',personalization:{situation:'',choice:'',nextStep:''},authenticity:{basis:'',ownPerspective:'',limits:'',disclosure:''}};
    return {input:data,card,experiment};
  }
  return {workspace:build,plan};
}
