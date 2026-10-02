import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, open, link, unlink, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { analyze, analyticsCsv, companyOverview, dateRange, shiftDate, METRICS, metricPoint, compareMetric, metricIndex } from '../analytics.mjs';
import { PLATFORM_CAPABILITIES } from './collectors.mjs';
import { collectionHealth } from './collection-policy.mjs';
import { buildHypeFeed } from './hype.mjs';
import { buildGrowthSummary, growthMonthWindow } from './growth-summary.mjs';
import { buildGrowthHistory } from './growth-history.mjs';
import { buildTeamTrends } from './team-trends.mjs';
import { buildContentLeaders } from './content-leaders.mjs';

const filename='marketing-demo.json';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const koreaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const stamp=date=>date+'T09:00:00.000Z';
const randomFor=(...parts)=>{
  let value=2166136261;
  for(const char of parts.join(':'))value=Math.imul(value^char.codePointAt(0),16777619);
  return (value>>>0)/4294967296;
};

function generate(anchorDate){
  dateRange(anchorDate,anchorDate);
  const createdAt=new Date().toISOString(),dataFrom=shiftDate(anchorDate,-56);
  const teams=[{id:'demo-team-growth',name:'그로스팀',active:true},{id:'demo-team-creative',name:'콘텐츠팀',active:true}];
  const members=[
    {id:'demo-person-minji',name:'민지',teamId:teams[0].id},
    {id:'demo-person-junho',name:'준호',teamId:teams[0].id},
    {id:'demo-person-seoyeon',name:'서연',teamId:teams[1].id},
  ].map(person=>({...person,teamName:teams.find(team=>team.id===person.teamId).name,role:'member',active:true,demo:true,createdAt}));
  const platforms=['youtube','instagram','youtube','tiktok','instagram','tiktok'];
  const labels=['민지의 AI 실험실','민지의 일하는 기록','준호의 도구 상자','준호의 짧은 발견','서연의 콘텐츠 노트','서연의 일상 실험'];
  const channels=platforms.map((platform,index)=>{
    const person=members[Math.floor(index/2)],id=`demo-channel-${index+1}`;
    return {id,platform,displayName:labels[index],handle:`@demo_${index+1}`,canonicalUrl:`https://invalid.example/channels/${id}`,
      ownerIds:[person.id],owners:[{id:person.id,name:person.name}],teamId:person.teamId,teamName:person.teamName,active:true,
      connected:true,canEdit:false,canManageOwners:false,canConnect:false,status:index===5?'partial':'success',demo:true,
      createdAt,lastCollectedAt:stamp(anchorDate),recentLastCollectedAt:stamp(anchorDate),warnings:['화면 확인용 가상 데이터입니다. 실제 플랫폼과 연결되지 않았습니다.'],
      coverage:{status:index===5?'partial':'complete'},connectionOwner:null,pendingHandoff:null};
  });
  const titles=[
    ['AI로 반복 업무 10분 줄이기','문서 정리 전과 후','작은 자동화가 바꾼 하루','처음 써 본 도구의 의외의 장점'],
    ['회의 노트를 남기는 방법','시작하기 쉬운 작업 루틴','3가지 프롬프트 비교 실험','오늘 바로 써 본 기능'],
    ['자료 조사를 빠르게 하는 방법','팀에서 함께 쓰는 템플릿','실패한 실험에서 배운 것','도구 하나로 달라진 작업'],
    ['하루 한 가지 작은 발견','짧게 배우는 편집 요령','같은 주제 다른 오프닝','30초로 정리한 업무 팁'],
    ['콘텐츠 제목을 고르는 기준','독자가 궁금해하는 한 가지','다시 만들며 달라진 점','저장해 둔 아이디어의 시작'],
    ['일상에서 찾은 새로운 시선','한 장면으로 이야기 만들기','조회가 줄었을 때 확인한 것','작은 질문이 만든 대화'],
  ];
  const posts=[],snapshots=[],channelSnapshots=[];
  const dates=dateRange(dataFrom,anchorDate),postAges=[68,39,18,4];
  channels.forEach((channel,ci)=>{
    const ownership={known:true,ownerIds:channel.ownerIds,teamId:channel.teamId};
    let followers=1600+ci*530;
    dates.forEach((date,di)=>{
      const trend=ci===5&&di>28?-10:ci===3&&di>28?15:8+ci*2;
      followers=Math.max(0,followers+Math.round(trend+(randomFor(ci,date,'followers')-.5)*14));
      channelSnapshots.push({id:`demo-account-${ci}-${date}`,channelId:channel.id,date,checkedAt:stamp(date),followers:ci===4&&di===56?null:followers,source:'demo:synthetic',ownership});
    });
    postAges.forEach((age,pi)=>{
      const id=`demo-post-${ci+1}-${pi+1}`,publishedDate=shiftDate(anchorDate,-age);
      const post={id,channelId:channel.id,title:titles[ci][pi],publishedDate,publishedAt:publishedDate+'T00:00:00.000Z',url:`https://invalid.example/posts/${id}`,thumbnailUrl:null,source:'demo:synthetic',demo:true};
      posts.push(post);
      let views=pi===0?1500+ci*350:0,likes=pi===0?90+ci*20:0,comments=0,shares=0,saves=0,reach=views;
      dates.forEach((date,di)=>{
        if(date<publishedDate)return;
        const wave=.8+.5*Math.sin((di+ci*4)/6),late=di>=29?(ci<2?1.45:ci<4?.78:1.08):1;
        const ageDays=Math.round((Date.parse(date)-Date.parse(publishedDate))/86400000);
        const freshness=ageDays<5?1.7:ageDays<18?1.1:.6;
        const spike=di===49&&ci===0?3.1:di===53&&ci===3?2.3:1;
        const increment=Math.round((60+ci*17+pi*29)*wave*late*freshness*spike*(.65+randomFor(ci,pi,date)));
        views+=increment;likes+=Math.round(increment*(.025+ci*.002));comments+=Math.round(randomFor('comments',ci,pi,date)*5);
        shares+=Math.round(increment*.006);saves+=Math.round(increment*.01);reach+=Math.round(increment*.72);
        if(ci===5&&pi===0&&di===56){views=Math.max(0,views-350);likes=Math.max(0,likes-20);}
        const missing=(ci===4&&pi===1&&di===56)||(ci===2&&pi===0&&di%19===7);
        snapshots.push({id:`${id}:${date}`,postId:id,date,checkedAt:stamp(date),views:missing?null:views,likes,
          comments:pi===3&&date===publishedDate?0:comments,shares:channel.platform==='youtube'?null:shares,
          saves:channel.platform==='tiktok'?null:saves,reach:channel.platform==='youtube'?null:reach,source:'demo:synthetic',ownership});
      });
    });
  });
  const hypeObservations=[];
  for(const channel of channels){
    const post=posts.find(post=>post.channelId===channel.id&&post.id.endsWith('-4'));
    const last=snapshots.findLast(row=>row.postId===post.id),increments=[0,65,135,195,950];
    increments.forEach((offset,index)=>hypeObservations.push({...last,id:`demo-hype-${post.id}-${index}`,channelId:channel.id,
      checkedAt:new Date(Date.parse(stamp(anchorDate))-(4-index)*30*60000).toISOString(),views:Math.max(0,last.views-950+offset)}));
  }
  return withEarlierHistory({version:1,kind:'synk-marketing-demo',createdAt,anchorDate,dataFrom,historyDays:56,baselineDate:dataFrom,teams,members,channels,posts,snapshots,channelSnapshots,hypeObservations}).data;
}

function withEarlierHistory(data){
  const month=growthMonthWindow(data.anchorDate),target=shiftDate(month.previous.start,-1);
  if(data.dataFrom<=target)return {data,addedSnapshots:0,addedChannelSnapshots:0};
  const dates=dateRange(target,shiftDate(data.dataFrom,-1)),snapshots=[],channelSnapshots=[];
  const firstBy=(rows,key)=>{
    const first=new Map();for(const row of rows)if(!first.has(row[key])||row.date<first.get(row[key]).date)first.set(row[key],row);return first;
  };
  const posts=firstBy(data.snapshots,'postId'),accounts=firstBy(data.channelSnapshots,'channelId');
  const backwards=(value,date,firstDate,identity,key)=>{
    if(typeof value!=='number'||!Number.isFinite(value))return null;
    const days=Math.round((Date.parse(firstDate)-Date.parse(date))/86400000);
    // Only fictional earlier history is created; all originally observed demo rows stay intact.
    const daily=Math.max(1,Math.round(value*(.013+randomFor(identity,key)*.009)));
    return Math.max(0,value-daily*days);
  };
  for(const post of data.posts){
    const first=posts.get(post.id);if(!first)continue;
    for(const date of dates){
      if(date<post.publishedDate||date>=first.date)continue;
      snapshots.push({id:`demo-history-${post.id}-${date}`,postId:post.id,date,checkedAt:stamp(date),source:'demo:synthetic',ownership:first.ownership,
        ...Object.fromEntries(METRICS.filter(({key})=>key!=='followers').map(({key})=>[key,backwards(first[key],date,first.date,post.id,key)]))});
    }
  }
  for(const channel of data.channels){
    const first=accounts.get(channel.id);if(!first)continue;
    for(const date of dates)if(date<first.date)channelSnapshots.push({id:`demo-history-account-${channel.id}-${date}`,channelId:channel.id,date,checkedAt:stamp(date),source:'demo:synthetic',ownership:first.ownership,followers:backwards(first.followers,date,first.date,channel.id,'followers')});
  }
  return {data:{...data,dataFrom:target,baselineDate:target,historyDays:dateRange(target,data.anchorDate).length-1,
    snapshots:[...snapshots,...data.snapshots],channelSnapshots:[...channelSnapshots,...data.channelSnapshots]},addedSnapshots:snapshots.length,addedChannelSnapshots:channelSnapshots.length};
}

function validate(data){
  if(data?.version!==1||data.kind!=='synk-marketing-demo'||!['teams','members','channels','posts','snapshots','channelSnapshots','hypeObservations'].every(key=>Array.isArray(data[key])))throw fail('데모 데이터 파일을 확인해 주세요.',500);
  dateRange(data.dataFrom,data.anchorDate);
  for(const key of ['teams','members','channels','posts'])if(data[key].some(row=>typeof row.id!=='string'||!row.id.startsWith('demo-')))throw fail('데모 데이터 식별자를 확인해 주세요.',500);
  return data;
}

export async function createDemoDataset({directory,anchorDate=koreaDate()}={}){
  if(!directory)throw fail('데모 저장 폴더를 지정해 주세요.');
  const target=join(resolve(directory),filename);
  if(existsSync(target))return {created:false,path:target,data:validate(JSON.parse(readFileSync(target,'utf8')))};
  const data=generate(anchorDate);await mkdir(resolve(directory),{recursive:true});
  const temporary=target+'.'+randomUUID()+'.tmp';
  const handle=await open(temporary,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(data));await handle.sync();}finally{await handle.close();}
  try{
    // A completed file appears atomically; a repeated seed can never replace it.
    await link(temporary,target);
    return {created:true,path:target,data};
  }catch(error){
    if(error.code!=='EEXIST')throw error;
    return {created:false,path:target,data:validate(JSON.parse(readFileSync(target,'utf8')))};
  }finally{await unlink(temporary).catch(()=>{});}
}

export async function extendDemoHistory({directory}={}){
  if(!directory)throw fail('데모 저장 폴더를 지정해 주세요.');
  const target=join(resolve(directory),filename),lockPath=target+'.history.lock';
  let lock;try{lock=await open(lockPath,'wx',0o600);}catch(error){if(error.code==='EEXIST')throw fail('데모 기록 확장 작업이 진행 중입니다.');throw error;}
  let temporary;
  try{
    const original=readFileSync(target),before=validate(JSON.parse(original.toString('utf8'))),result=withEarlierHistory(before);
    if(result.data===before)return {changed:false,path:target,backup:null,...result};
    const backup=target+'.before-history-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
    const backupHandle=await open(backup,'wx',0o600);
    try{await backupHandle.writeFile(original);await backupHandle.sync();}finally{await backupHandle.close();}
    temporary=target+'.'+randomUUID()+'.tmp';
    const handle=await open(temporary,'wx',0o600);
    try{await handle.writeFile(JSON.stringify(result.data));await handle.sync();}finally{await handle.close();}
    if(!readFileSync(target).equals(original))throw fail('데모 데이터가 변경되어 확장을 취소했습니다. 다시 확인해 주세요.',409);
    await rename(temporary,target);temporary=null;
    return {changed:true,path:target,backup,...result};
  }finally{if(temporary)await unlink(temporary).catch(()=>{});await lock.close();await unlink(lockPath).catch(()=>{});}
}

export function createDemoService({directory}){
  const path=join(resolve(directory),filename);let cached,signature;
  function load(){
    let info;try{info=statSync(path);}catch(error){if(error.code==='ENOENT')throw fail('아직 데모 데이터가 준비되지 않았습니다.',404);throw error;}
    const next=info.mtimeMs+':'+info.size;
    if(!cached||signature!==next){cached=validate(JSON.parse(readFileSync(path,'utf8')));signature=next;}
    return cached;
  }
  function context(query=new URLSearchParams()){
    const data=load(),personaId=query.get('persona')||data.members[0].id,user=data.members.find(person=>person.id===personaId);
    if(!user)throw fail('데모 크루를 선택해 주세요.',404);
    const demo={enabled:true,label:'가상 데이터 · 실제 성과 아님',people:data.members.map(({id,name,teamName})=>({id,name,teamName})),personaId,createdAt:data.createdAt,anchorDate:data.anchorDate,
      dataFrom:data.dataFrom,historyDays:data.historyDays,channelCount:data.channels.length,postCount:data.posts.length,teamCount:data.teams.length,readOnly:true};
    return {data,user:{...user,role:'admin',demo:true},demo};
  }
  function period(data,query,day=false){
    const end=query.get('date')||query.get('end')||data.anchorDate,start=day?end:query.get('start')||shiftDate(end,-27);
    dateRange(start,end);if(end>data.anchorDate)throw fail('데모 마지막 기록일 이후는 조회할 수 없습니다.');return {start,end};
  }
  function scoped({data,user},query){
    const scope=query.get('scope')||'all',teamId=query.get('teamId')||(scope==='team'?user.teamId:null);
    return data.channels.filter(channel=>(!teamId||channel.teamId===teamId)&&(scope!=='mine'||channel.ownerIds.includes(user.id)));
  }
  function catalog(channels){return {channels:channels.map(channel=>({...channel,ready:true,brand:channel.displayName,publicUrl:channel.canonicalUrl,country:''}))};}
  function records(data,channels){
    const ids=new Set(channels.map(channel=>channel.id)),posts=data.posts.filter(post=>ids.has(post.channelId)),postIds=new Set(posts.map(post=>post.id));
    return {version:1,posts,snapshots:data.snapshots.filter(row=>postIds.has(row.postId)),channelSnapshots:data.channelSnapshots.filter(row=>ids.has(row.channelId))};
  }
  function state(query){
    const ctx=context(query),{data,user,demo}=ctx;
    const teams=data.teams.map(team=>({...team,memberCount:data.members.filter(person=>person.teamId===team.id).length,channelCount:data.channels.filter(channel=>channel.teamId===team.id).length}));
    return {demo,demoAvailable:true,user,permissions:{manageOrganization:false,manageTeam:false,readOnly:true},teams,members:data.members,channels:data.channels,
      companyName:'SYNK · 가상 데이터',collection:collectionHealth(data.channels,{at:stamp(data.anchorDate),hourKst:9,enabled:false}),capabilities:PLATFORM_CAPABILITIES,oauthProviders:[],
      schedule:{enabled:false,hourKst:9,companyName:'SYNK · 가상 데이터'},runs:[],deployment:{localOnly:true,serverMustStayRunning:true,demo:true},legacyImportAvailable:false};
  }
  function report(query,day=false){
    const ctx=context(query),{data,demo,user}=ctx,{start,end}=period(data,query,day),all=scoped(ctx,query),ownerId=query.get('ownerId')||'';
    const selected=all.filter(channel=>(!query.get('platform')||channel.platform===query.get('platform'))&&(!query.get('channel')||channel.id===query.get('channel'))&&(!ownerId||channel.ownerIds.includes(ownerId)));
    const selectedRecords=records(data,selected),result=analyze(selectedRecords,catalog(selected),{start,end});
    if(query.get('growth')==='1')result.growth=buildGrowthSummary(selectedRecords,catalog(selected),{asOf:end});
    if(query.get('history')==='1')result.history=buildGrowthHistory(selectedRecords,catalog(selected),{asOf:end,selectionStart:query.get('historyStart')||undefined,selectionEnd:query.get('historyEnd')||undefined});
    const memberGroups=data.members.map(person=>{
      const mine=selected.filter(channel=>channel.ownerIds.includes(person.id)),item=analyze(records(data,mine),catalog(mine),{start,end});
      return {id:person.id,name:person.name,active:true,teamId:person.teamId,channelCount:mine.length,metrics:item.metrics};
    });
    return {...result,demo,groups:result.groups('channel'),memberGroups,memberGroupsBasis:'화면 비교를 위한 가상 크루의 담당 기록입니다.',overview:companyOverview(records(data,all),catalog(all),end),
      scope:{...result.scope,ownerId,teamId:query.get('teamId')||(query.get('scope')==='team'?user.teamId:''),scope:query.get('scope')||'all'},
      definitions:{basis:'가상 누적값 차이 · 실제 성과 아님',missing:'—는 이 데모에서 미확인으로 설정한 값입니다.',history:'생성 시 고정된 예시이며 실제 플랫폼을 호출하지 않습니다.',members:'가상 크루별 담당 채널 집계입니다.'},
      _csv:()=> '\uFEFF"데이터 구분","가상 데이터 · 실제 성과 아님"\r\n'+analyticsCsv(result).replace(/^\uFEFF/,'')};
  }
  function teamOverview(query){
    const {data,demo}=context(query),{start,end}=period(data,query),postIndex=metricIndex(data.snapshots,'postId'),accountIndex=metricIndex(data.channelSnapshots,'channelId');
    const teams=data.teams.map(team=>{
      const channels=data.channels.filter(channel=>channel.teamId===team.id),ids=new Set(channels.map(channel=>channel.id)),posts=data.posts.filter(post=>ids.has(post.channelId)&&post.publishedDate<=end);
      const metrics=Object.fromEntries(METRICS.map(({key})=>{
        const src=key==='followers'?{entities:channels,index:accountIndex,isPost:false}:{entities:posts,index:postIndex,isPost:true};
        return [key,{...metricPoint(src,key,end),day:compareMetric(src,key,shiftDate(end,-1),end),period:compareMetric(src,key,shiftDate(start,-1),end)}];
      }));
      return {id:team.id,name:team.name,memberCount:data.members.filter(person=>person.teamId===team.id).length,channelCount:channels.length,connectedCount:channels.length,postCount:posts.length,newPosts:posts.filter(post=>post.publishedDate>=start).length,metrics};
    });
    return {start,end,teams,demo};
  }
  function contentLeaders(query){
    const ctx=context(query),{data,demo}=ctx,{end}=period(data,query,true),ownerId=query.get('ownerId')||'';
    const channels=scoped(ctx,query).filter(channel=>(!query.get('platform')||channel.platform===query.get('platform'))&&(!query.get('channel')||channel.id===query.get('channel'))&&(!ownerId||channel.ownerIds.includes(ownerId)));
    return {...buildContentLeaders(records(data,channels),catalog(channels),{date:end,metric:query.get('metric')||'views',mode:query.get('mode')||'change',users:data.members,demo:true}),demo};
  }
  function hype(query){
    const ctx=context(query),channels=scoped(ctx,query),{data,demo}=ctx;
    return {...buildHypeFeed({channels,posts:data.posts,observations:data.hypeObservations,users:data.members,now:stamp(data.anchorDate)}),demo,
      collection:{intervalMinutes:30,activeChannels:channels.length,connectedChannels:channels.length,waitingChannels:0,collectingChannels:0,partialChannels:channels.filter(channel=>channel.status==='partial').length,backoffChannels:0,failedChannels:0,nextCheckAt:null,lastCheckedAt:stamp(data.anchorDate),enabled:false,backoffs:[]}};
  }
  function teamTrends(query){
    const {data,user,demo}=context(query);
    return {...buildTeamTrends({teams:data.teams,channels:data.channels,records:data,ownTeamId:user.teamId,query,today:data.anchorDate}),demo};
  }
  return {available:()=>existsSync(path),state,report,teamOverview,teamTrends,hype,contentLeaders};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const flag=process.argv.indexOf('--data-dir'),directory=flag>=0?process.argv[flag+1]:undefined;
  const operation=process.argv.includes('--extend-history')?extendDemoHistory:createDemoDataset;
  operation({directory}).then(({created,changed,path,backup,addedSnapshots,addedChannelSnapshots,data})=>console.log(JSON.stringify({created,changed,path,backup,addedSnapshots,addedChannelSnapshots,anchorDate:data.anchorDate,dataFrom:data.dataFrom,people:data.members.length,channels:data.channels.length,posts:data.posts.length}))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
