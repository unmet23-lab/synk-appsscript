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
const RULE='비교 3편은 화면 표시 기준이며 통계적 유의성이나 성과 원인을 증명하지 않습니다.';
const CAUTION='관측한 누적 수치입니다. 실험 후보의 효과와 학습 효과는 아직 확인하지 않았습니다.';

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
    const valid=checkpoint?.status==='recorded'&&meta&&meta.unit===definition.unit&&typeof meta.source==='string'&&!!meta.source.trim()&&meta.source.length<=100&&observed!==null&&observed<=now&&due!==null&&closes!==null&&closes>=due&&closes<=due+6*HOUR&&observed>=due&&observed<=closes&&!meta.measurementWindowMissed;
    return {valid:!!valid,sourceKey:meta?.source,source:clean(meta?.source||checkpoint?.source,100)||'출처 미기록',observedAt:observed!==null&&observed<=now?new Date(observed).toISOString():!meta&&instant(checkpoint?.observedAt)!==null&&instant(checkpoint.observedAt)<=now?new Date(checkpoint.observedAt).toISOString():null,offset:valid?observed-due:null};
  }
  function compare(current,definition,rows,now){
    const checkpoint=current.checkpoint,meta=provenance(checkpoint,definition,now);
    if(!current.format||!meta.valid)return emptyComparison('unavailable');
    const seen=new Set(),values=[];
    for(const prior of rows){
      if(prior.entry.id===current.entry.id||prior.entry.channelId!==current.entry.channelId||prior.entry.platform!==current.entry.platform||prior.format?.id!==current.format.id||instant(prior.entry.publishedAt)>=instant(current.entry.publishedAt)||prior.entry.postIdentity&&prior.entry.postIdentity===current.entry.postIdentity)continue;
      const value=prior.checkpoint?.metrics?.[definition.id],previous=provenance(prior.checkpoint,definition,now);
      if(!validMetric(value,definition)||!previous.valid||previous.sourceKey!==meta.sourceKey||Math.abs(previous.offset-meta.offset)>15*MINUTE)continue;
      const identity=prior.entry.postIdentity||prior.url;if(seen.has(identity))continue;seen.add(identity);values.push(value);
    }
    if(values.length<MIN_SAMPLE)return {...emptyComparison('insufficient'),sampleCount:values.length};
    const middle=median(values),value=checkpoint.metrics[definition.id];
    return {sampleCount:values.length,median:middle,deltaPercent:deltaPercent(value,middle),status:'ready'};
  }
  function experimentsFor(facts,status){
    const ready=facts.filter(fact=>fact.comparison.status==='ready');
    if(status!=='ready')return [{id:'observe-again',title:'같은 형식으로 한 편 더 관측하기',reason:`확인된 72시간 지표는 ${facts.length}개지만 비교 조건을 갖춘 자료가 부족합니다. 잘된 이유는 아직 판단하지 않습니다.`,change:'주제의 예시 한 가지만 바꾸고 형식·길이·게시 조건은 가능한 한 유지합니다.',measure:'다음 게시물도 72시간의 비슷한 관측 시점에 같은 출처의 지표를 기록합니다.'}];
    const reason=fact=>`${fact.label} ${valueText(fact)} · 같은 계정·형식의 이전 ${fact.comparison.sampleCount}편 중앙값 ${valueText({...fact,value:fact.comparison.median})}. 원인은 아직 확인하지 않았습니다.`;
    const result=[],retention=ready.find(fact=>fact.id==='earlyRetention3sPct'),watch=ready.find(fact=>fact.id==='completionRatePct')||ready.find(fact=>fact.id==='averageWatchSeconds'),action=ready.find(fact=>fact.id==='toolVisits')||ready.find(fact=>fact.id==='saves')||ready.find(fact=>fact.id==='shares');
    if(retention&&retention.value<retention.comparison.median)result.push({id:'opening',title:'첫 3초 도입 한 가지만 바꾸기',reason:reason(retention),change:'본론의 결과를 먼저 보여 주는 도입으로 바꾸고 나머지 구성은 유지합니다.',measure:'72시간 3초 유지율을 같은 지표 출처와 비슷한 관측 시점으로 비교합니다.'});
    if(watch&&watch.value<watch.comparison.median)result.push({id:'length',title:'중간 설명 길이 한 가지만 줄이기',reason:reason(watch),change:'핵심 예시와 도입을 유지하고 반복되는 중간 설명 한 구간만 줄입니다.',measure:`72시간 ${watch.label}을 같은 출처와 비슷한 관측 시점에 확인합니다. 길이가 달라지는 한계도 함께 기록합니다.`});
    if(action&&action.value<action.comparison.median)result.push({id:'call-to-action',title:'마지막 행동 안내 한 가지만 바꾸기',reason:reason(action),change:'본문을 유지하고 마지막 안내를 구체적인 행동 한 가지로 바꿉니다.',measure:`72시간 ${action.label}을 같은 출처와 비슷한 관측 시점에 확인합니다. 조회 차이도 함께 살펴봅니다.`});
    if(result.length<3){const anchor=ready.find(fact=>fact.id==='views')||ready[0];result.push({id:'new-example',title:'같은 형식에 다른 예시 넣기',reason:reason(anchor),change:'도입 방식과 길이를 유지하고 시청자가 겪는 예시 한 가지만 바꿉니다.',measure:`72시간 ${anchor.label}을 같은 출처와 비슷한 관측 시점에 비교하고 결과가 반복되는지 확인합니다.`});}
    return result.slice(0,3);
  }
  function build(user){
    user=current(user);const now=instant(clock());if(now===null)throw fail('서버 시각을 확인해 주세요.',500);
    const generatedAt=new Date(now).toISOString(),result=postPerformance.list(user),cache=new Map(),rows=[];
    for(const entry of result.entries||[]){
      const channel=store.get('channels',entry.channelId);
      if(entry.active===false||!channel||channel.active===false||channel.platform!==entry.platform||!canReadChannel(user,channel)||instant(entry.publishedAt)===null||instant(entry.publishedAt)>now)continue;
      let normalized;try{normalized=normalizePerformancePostUrl(entry.url);}catch{continue;}
      if(normalized.platform!==entry.platform||entry.postIdentity&&entry.postIdentity!==normalized.identity)continue;
      const checkpoint=(entry.checkpoints||[]).find(item=>item.hours===72),linked=sourceFor(user,entry,cache);
      rows.push({entry,checkpoint,url:normalized.canonicalUrl,source:linked.source,format:formatFor(entry,linked.pack),canEdit:entry.canEdit===true&&canWriteChannel(user,channel)});
    }
    const cards=rows.map(row=>{
      const {entry,checkpoint,format,source}=row,due=instant(checkpoint?.dueAt),limits=[],missing=[],facts=[];
      if(!source)limits.push('연결된 원본을 현재 열 수 없어 원본 내용은 기획에 가져오지 않습니다.');
      if(!format)limits.push('게시한 영상 형식이 확정되지 않아 과거 성과와 비교하지 않습니다.');
      if(checkpoint?.status==='recorded')for(const definition of POST_PERFORMANCE_METRICS){
        const value=checkpoint.metrics?.[definition.id];if(!validMetric(value,definition))continue;
        const meta=provenance(checkpoint,definition,now);
        facts.push({id:definition.id,label:definition.label,value,unit:definition.unit,observedAt:meta.observedAt,source:meta.source,comparison:compare(row,definition,rows,now)});
        if(!meta.valid&&!limits.includes('관측 시각·출처·단위가 불완전하거나 관측 창을 벗어난 수치는 비교에서 제외합니다.'))limits.push('관측 시각·출처·단위가 불완전하거나 관측 창을 벗어난 수치는 비교에서 제외합니다.');
        if(meta.offset>15*MINUTE&&!limits.includes('목표 시각보다 15분 넘게 늦게 확인한 누적값이 포함되어 있습니다.'))limits.push('목표 시각보다 15분 넘게 늦게 확인한 누적값이 포함되어 있습니다.');
      }
      for(const definition of POST_PERFORMANCE_METRICS)if(!facts.some(fact=>fact.id===definition.id))missing.push(definition.label);
      const status=due!==null&&due>now?'waiting':!facts.length||due===null?'missing':facts.some(fact=>fact.comparison.status==='ready')?'ready':'limited';
      if(status==='limited')limits.push('비교 조건에 맞는 이전 게시물 3편 이상이 있는 지표가 없습니다.');
      if(missing.length&&facts.length)limits.push('미기록 지표는 0으로 계산하지 않으며 모든 지표를 반드시 채울 필요는 없습니다.');
      limits.push(RULE,CAUTION);
      const labels={waiting:'72시간 관측 대기',missing:'72시간 수치 필요',limited:'자료 부족 · 실험 준비',ready:'비교 가능한 기록 있음'};
      const summary=status==='waiting'?'72시간 확인 시각이 되면 기록된 수치를 정리합니다.':status==='missing'?'72시간에 확인한 실제 수치를 먼저 기록해 주세요.':status==='limited'?`확인된 지표 ${facts.length}개를 다음 관측의 출발점으로 남깁니다.`:`확인된 지표 ${facts.length}개 중 ${facts.filter(fact=>fact.comparison.status==='ready').length}개를 같은 조건의 이전 게시물과 비교할 수 있습니다.`;
      return {entryId:entry.id,title:clean(entry.title)||'게시한 콘텐츠',channelName:clean(entry.channelName)||clean(entry.channelId),platform:entry.platform,url:row.url,format,status,statusLabel:labels[status],summary,dueAt:due===null?null:new Date(due).toISOString(),observedAt:instant(checkpoint?.observedAt)!==null&&instant(checkpoint.observedAt)<=now?new Date(checkpoint.observedAt).toISOString():null,missing,limits,facts,source,experiments:['limited','ready'].includes(status)?experimentsFor(facts,status):[],canPlan:row.canEdit&&user.role!=='viewer'&&['limited','ready'].includes(status)};
    });
    return {cards,generatedAt};
  }
  function plan(user,entryId,input={}){
    user=current(user);if(user.role==='viewer')throw fail('열람 계정은 새 기획을 만들 수 없습니다.',403);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='experimentId')||typeof input.experimentId!=='string')throw fail('현재 표시된 실험을 선택해 주세요.');
    const card=build(user).cards.find(row=>row.entryId===entryId);if(!card)throw fail('게시물 기록을 찾을 수 없습니다.',404);
    if(!card.canPlan)throw fail('현재 권한과 72시간 성과 기록을 먼저 확인해 주세요.',403);
    const experiment=card.experiments.find(row=>row.id===input.experimentId);if(!experiment)throw fail('현재 표시된 실험을 선택해 주세요.',409);
    const facts=card.facts.map(fact=>`${fact.label}: ${valueText(fact)} | ${sourceText(fact.source,card.platform)} | 관측 ${fact.observedAt||'미기록'}`);
    const lines=[`72시간 성과 기록 · ${card.title}`,`게시 출처: ${card.url}`,`목표 시각: ${card.dueAt}`,`형식: ${card.format?.label||'미확정'}`,...facts,`선택 실험: ${experiment.title}`,`바꿀 한 가지: ${experiment.change}`,`확인할 지표: ${experiment.measure}`,'한계: '+card.limits.join(' ')];
    let proof=lines.join('\n');
    if(proof.length>3000)throw fail('성과 근거가 기획 입력 한도를 넘었습니다. 기록을 확인해 주세요.',422);
    const comparisons=card.facts.filter(fact=>fact.comparison.status==='ready').map(fact=>`${fact.label} 비교: 이전 ${fact.comparison.sampleCount}편, 중앙값 ${valueText({...fact,value:fact.comparison.median})}${fact.comparison.deltaPercent===null?fact.comparison.median===0?' · 중앙값 0으로 변화율 계산 안 함':' · 변화율을 계산할 수 없음':`, 변화율 ${fact.comparison.deltaPercent}%`}`);
    for(const line of comparisons)if(proof.length+line.length+1<=3000)proof+='\n'+line;
    const sourceLine=card.source?`연결 원본: ${card.source.title} · ${card.source.versionLabel}`:'';
    if(sourceLine&&proof.length+sourceLine.length+1<=3000)proof+='\n'+sourceLine;
    const data={topic:clean(card.title,300),audience:'',experience:'',proof:'',editorialNote:proof,takeaway:'',entertainment:'',channelId:'',referenceId:'',benchmarkId:'',benchmarkItemId:'',personalization:{situation:'',choice:'',nextStep:''},authenticity:{basis:'',ownPerspective:'',limits:'',disclosure:''}};
    return {input:data,card,experiment};
  }
  return {workspace:build,plan};
}
