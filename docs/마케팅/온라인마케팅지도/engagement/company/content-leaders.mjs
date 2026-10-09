import { METRICS, dateRange, shiftDate, metricIndex, compareMetric } from '../analytics.mjs';
import { observationOwner } from './ownership-report.mjs';

const known=value=>typeof value==='number'&&Number.isFinite(value);
const label=value=>typeof value==='string'?value.trim().slice(0,1000):'';

function attribution(post,channel,observation,users,events,demo){
  const visible=new Map(users.filter(user=>typeof user.id==='string'&&label(user.name)).map(user=>[user.id,user]));
  const names=ids=>[...new Set(ids.filter(id=>typeof id==='string').map(id=>visible.get(id)?.name).filter(Boolean))];
  if(demo){const creatorNames=names(channel.ownerIds||[]);return {creatorNames,creatorLabel:creatorNames.length?'제작 크루 · 가상 데이터':'제작자 미등록',creatorBasis:creatorNames.length?'demo-creator':'unregistered'};}
  // Explicit creator fields must resolve to the caller's permitted directory before being exposed.
  const explicitIds=Array.isArray(post.creatorIds)&&post.creatorIds.every(id=>typeof id==='string')?post.creatorIds:[];
  const explicitNames=names(explicitIds);
  const suppliedName=label(post.creatorName);
  if(!explicitNames.length&&suppliedName&&[...visible.values()].some(user=>user.name===suppliedName))explicitNames.push(suppliedName);
  if(explicitNames.length)return {creatorNames:explicitNames,creatorLabel:'제작 크루',creatorBasis:'creator'};
  const checked=observation.checkedAt&&Date.parse(observation.checkedAt);
  const sameDate=!observation.checkedAt||(Number.isFinite(checked)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checked))===observation.date);
  const ownership=sameDate?observationOwner(observation,channel,events):{known:false,ownerIds:[]};
  const creatorNames=ownership.known&&Array.isArray(ownership.ownerIds)?names(ownership.ownerIds):[];
  return {creatorNames,creatorLabel:creatorNames.length?'당시 담당 크루':'제작자 미등록',creatorBasis:creatorNames.length?'observed-owner':'unregistered'};
}

export function buildContentLeaders(records,catalog,{date,metric='views',mode='change',users=[],ownershipEvents=[],demo=false}){
  dateRange(date,date);
  if(!METRICS.some(item=>item.key===metric))throw Object.assign(new Error('순위를 확인할 지표를 선택해 주세요.'),{status:400});
  if(!['change','total'].includes(mode))throw Object.assign(new Error('하루 증감 또는 당일 누적을 선택해 주세요.'),{status:400});
  const channels=new Map(catalog.channels.filter(channel=>channel.ready).map(channel=>[channel.id,channel]));
  const posts=records.posts.filter(post=>channels.has(post.channelId)&&post.publishedDate<=date);
  const result={date,metric,mode,count:0,eligible:posts.length,complete:false,items:[],emptyReason:null,
    message:mode==='change'?'해당 날짜에 비교 가능한 콘텐츠 기준입니다. 0과 감소도 포함합니다.':'당일 확인된 콘텐츠 기준입니다.'};
  if(metric==='followers')return {...result,emptyReason:'account-metric',message:'팔로워·구독자는 콘텐츠별로 나눌 수 없는 계정 지표입니다.'};
  const index=metricIndex(records.snapshots,'postId'),candidates=[];
  for(const post of posts){
    const observation=index.get(post.id)?.get(date);
    if(!observation||!known(observation[metric]))continue;
    let value=observation[metric];
    if(mode==='change'){
      const change=compareMetric({entities:[post],index,isPost:true},metric,shiftDate(date,-1),date);
      if(!change.complete||!known(change.delta))continue;
      value=change.delta;
    }
    const channel=channels.get(post.channelId);
    candidates.push({id:post.id,title:label(post.title)||'제목 없는 콘텐츠',channelId:channel.id,channelName:label(channel.displayName||channel.brand||channel.handle)||'채널',value,post,channel,observation});
  }
  candidates.sort((a,b)=>b.value-a.value||a.title.localeCompare(b.title,'ko')||String(a.id).localeCompare(String(b.id),'en'));
  return {...result,count:candidates.length,complete:posts.length>0&&candidates.length===posts.length,
    items:candidates.slice(0,3).map(({post,channel,observation,...item},index)=>({rank:index+1,...item,...attribution(post,channel,observation,users,ownershipEvents,demo)})),
    emptyReason:candidates.length?null:mode==='change'?'no-comparable-records':'no-exact-records'};
}
