import {randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const KIND='creativeResearchEntries';
const sourceKinds={
  'youtube-trends':['top-search','content-gap','breakout-video','recent-video'],
  'tiktok-top-ads':['ad'],facebook:['ad','reel','insight','best-practice'],instagram:['ad','reel','insight','best-practice'],
};
const metricNames=['views','likes','comments','shares','saves','reach'];
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 형식을 확인해 주세요.');return value;};
function text(value,max,label,required=false){if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}: ${max}자 이하로 입력해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;}
function instant(value,label='확인 시각'){const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);if(!match||+match[2]<1||+match[2]>12||+match[3]<1||+match[3]>new Date(Date.UTC(+match[1],+match[2],0)).getUTCDate()||!Number.isFinite(Date.parse(value)))throw fail(`${label}에는 시간대가 포함된 날짜와 시간을 입력해 주세요.`);return new Date(value).toISOString();}
function scalar(value,label,{max=Number.MAX_SAFE_INTEGER,integer=true}={}){if(value==null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||integer&&!Number.isSafeInteger(value))throw fail(`${label} 수치를 확인해 주세요.`);return value;}
function region(value){if(value==null||value==='')return 'GLOBAL';if(typeof value!=='string'||!/^(?:[A-Z]{2}|GLOBAL)$/.test(value))throw fail('지역 코드를 확인해 주세요.');return value;}
function params(url,allowed){if([...url.searchParams.keys()].some(key=>!allowed.includes(key))||allowed.some(key=>url.searchParams.getAll(key).length>1))throw fail('추적·계정 정보가 없는 원문 주소를 입력해 주세요.');}
function secureUrl(value){let url;try{url=new URL(text(value,2048,'원문 주소',true));}catch{throw fail('공식 원문의 HTTPS 주소를 입력해 주세요.');}if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)throw fail('계정 정보가 없는 공식 HTTPS 주소를 입력해 주세요.');return url;}

export function normalizeResearchUrl(source,kind,value){
  if(!sourceKinds[source]?.includes(kind))throw fail('자료 종류를 확인해 주세요.');
  const url=secureUrl(value),host=url.hostname.toLowerCase(),path=url.pathname;
  if(source==='tiktok-top-ads'){
    if(host!=='ads.tiktok.com'||!/^\/business\/creativecenter\/topads\/\d{8,25}\/pc\/(?:en|ko)\/?$/.test(path))throw fail('TikTok Top Ads의 개별 광고 상세 주소를 입력해 주세요.');
    params(url,['countryCode','period']);if(url.searchParams.has('countryCode')&&!/^[A-Z]{2}$/.test(url.searchParams.get('countryCode')))throw fail('광고 탐색 국가를 확인해 주세요.');
    if(url.searchParams.has('period')&&!['7','30','180'].includes(url.searchParams.get('period')))throw fail('광고 탐색 기간을 확인해 주세요.');
  }else if(source==='youtube-trends'){
    if(host==='studio.youtube.com'){if(!/^\/channel\/[A-Za-z0-9_-]{8,80}\/analytics(?:\/[A-Za-z0-9_-]+)*\/?$/.test(path))throw fail('YouTube Studio의 채널 분석 주소를 입력해 주세요.');params(url,[]);}
    else if(['breakout-video','recent-video'].includes(kind)&&['www.youtube.com','youtube.com','youtu.be'].includes(host)){
      if(host==='youtu.be'){if(!/^\/[A-Za-z0-9_-]{11}\/?$/.test(path))throw fail('개별 YouTube 영상 주소를 입력해 주세요.');params(url,[]);}
      else if(path==='/watch'){params(url,['v']);if(!/^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v')||''))throw fail('개별 YouTube 영상 주소를 입력해 주세요.');}
      else{if(!/^\/(?:shorts|embed)\/[A-Za-z0-9_-]{11}\/?$/.test(path))throw fail('개별 YouTube 영상 주소를 입력해 주세요.');params(url,[]);}
    }else throw fail('YouTube Studio 분석 또는 개별 영상 주소를 입력해 주세요.');
  }else if(kind==='ad'){
    if(!['www.facebook.com','facebook.com'].includes(host)||!/^\/ads\/library\/?$/.test(path))throw fail('Meta 광고 라이브러리의 개별 광고 주소를 입력해 주세요.');params(url,['id']);if(!/^\d{5,30}$/.test(url.searchParams.get('id')||''))throw fail('개별 광고의 라이브러리 ID가 필요합니다.');url.hostname='www.facebook.com';url.pathname='/ads/library/';
  }else if(kind==='best-practice'){
    const fb=host==='about.fb.com'&&/^\/news\/\d{4}\/\d{2}\/[a-z0-9-]+\/?$/.test(path);
    const meta=['www.facebook.com','facebook.com'].includes(host)&&/^\/business\/(?:help\/\d+|news\/[a-z0-9-]+)\/?$/.test(path);
    const ig=['creators.instagram.com','about.instagram.com','business.instagram.com'].includes(host)&&/^\/[A-Za-z0-9/_-]+\/?$/.test(path);
    if(!fb&&!meta&&!ig)throw fail('Meta·Instagram의 공식 제작 안내 주소를 입력해 주세요.');params(url,[]);
  }else if(kind==='insight'){
    const dashboard=host==='business.facebook.com'&&/^\/(?:latest\/)?insights(?:\/[A-Za-z0-9_-]+)*\/?$/.test(path);
    const fb=['www.facebook.com','facebook.com'].includes(host)&&/^\/professional_dashboard(?:\/insights)?\/?$/.test(path);
    const ig=source==='instagram'&&['www.instagram.com','instagram.com'].includes(host)&&/^\/(?:accounts\/)?professional_dashboard(?:\/insights)?\/?$/.test(path);
    if(!dashboard&&!fb&&!ig)throw fail('담당 계정의 공식 인사이트 화면 주소를 입력해 주세요.');params(url,['asset_id','business_id','page_id']);for(const [,value]of url.searchParams)if(!/^\d{1,30}$/.test(value))throw fail('인사이트 화면의 계정 ID를 확인해 주세요.');
  }else if(source==='instagram'){
    if(!['www.instagram.com','instagram.com'].includes(host)||!/^\/(?:p|reel)\/[A-Za-z0-9_-]{5,80}\/?$/.test(path))throw fail('Instagram의 개별 게시물·릴스 주소를 입력해 주세요.');params(url,[]);url.hostname='www.instagram.com';
  }else{
    if(!['www.facebook.com','facebook.com','m.facebook.com'].includes(host))throw fail('Facebook의 개별 게시물·릴스 주소를 입력해 주세요.');
    const ordinary=/^\/(?:reel\/\d{5,30}|[A-Za-z0-9._-]+\/(?:posts|videos)\/[A-Za-z0-9_-]{5,120})\/?$/.test(path);
    if(ordinary)params(url,[]);
    else if(path==='/watch/'||path==='/watch'){params(url,['v']);if(!/^\d{5,30}$/.test(url.searchParams.get('v')||''))throw fail('개별 Facebook 영상 ID가 필요합니다.');}
    else if(path==='/permalink.php'){params(url,['story_fbid','id']);if(!['story_fbid','id'].every(key=>/^\d{5,30}$/.test(url.searchParams.get(key)||'')))throw fail('개별 Facebook 게시물 ID가 필요합니다.');}
    else throw fail('Facebook의 개별 게시물·릴스 주소를 입력해 주세요.');url.hostname='www.facebook.com';
  }
  return url.href;
}

export const CREATIVE_RESEARCH_SOURCES=Object.freeze([
  {id:'youtube-trends',label:'YouTube Trends',status:'manual',url:'https://studio.youtube.com/',guideUrl:'https://support.google.com/youtube/answer/11962757?hl=ko',notice:'채널별 검색 관심·Shorts 콘텐츠 공백·관련 영상을 직접 확인해 기록합니다. 공개 API로 이 탭 전체를 자동 수집하지 않습니다.',kinds:sourceKinds['youtube-trends']},
  {id:'tiktok-top-ads',label:'TikTok Top Ads',status:'public-detail',url:'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',guideUrl:'https://ads.tiktok.com/resources/help/article/top-ads?lang=en',notice:'공식 개별 광고 상세 페이지의 공개 수치만 가져옵니다. CTR 상위 백분위는 실제 클릭률과 다릅니다. 광고 전체 목록·영상은 수집하지 않습니다.',kinds:sourceKinds['tiktok-top-ads']},
  {id:'facebook',label:'Facebook',status:'manual',url:'https://www.facebook.com/ads/library/',guideUrl:'https://www.facebook.com/business/help/515396768861083',notice:'광고 라이브러리와 실제 릴스·담당 계정 인사이트·공식 제작 안내를 기록합니다. 일반 광고의 조회수·CTR·전환 성과를 라이브러리에서 추정하지 않습니다.',kinds:sourceKinds.facebook},
  {id:'instagram',label:'Instagram',status:'manual',url:'https://www.facebook.com/ads/library/',guideUrl:'https://creators.instagram.com/',notice:'Meta 광고 라이브러리·개별 릴스·담당 전문 계정 인사이트·공식 제작 안내를 기록합니다. 탐색 전체의 인기 순위와 일반 광고 성과는 제공되지 않습니다.',kinds:sourceKinds.instagram},
]);

function parseNextData(html){
  const match=/<script\b(?=[^>]*\bid\s*=\s*["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script\s*>/i.exec(html);if(!match)throw fail('공개 광고 정보가 보이지 않습니다. 원문을 직접 확인해 기록해 주세요.',422);
  let parsed;try{parsed=JSON.parse(match[1]);}catch{throw fail('공개 광고 정보를 읽지 못했습니다. 원문을 직접 확인해 기록해 주세요.',422);}return parsed?.props?.pageProps?.data?.baseDetail;
}
function publicText(value,max){return typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';}
function publicCount(value){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
export function parseTopAd(html,sourceUrl,checkedAt){
  const url=new URL(normalizeResearchUrl('tiktok-top-ads','ad',sourceUrl)),id=/\/topads\/(\d+)\//.exec(url.pathname)[1],detail=parseNextData(html);
  if(!detail||typeof detail!=='object'||String(detail.id)!==id)throw fail('요청한 광고의 공개 상세 정보를 확인하지 못했습니다.',422);
  const countries=Array.isArray(detail.countryCode)?[...new Set(detail.countryCode.filter(value=>typeof value==='string'&&/^[A-Z]{2}$/.test(value)))].slice(0,40):[];
  const ctr=typeof detail.ctr==='number'&&Number.isFinite(detail.ctr)&&detail.ctr>=0&&detail.ctr<=1?Math.round(detail.ctr*10000)/100:null;
  return {source:'tiktok-top-ads',kind:'ad',title:publicText(detail.adTitle,200)||publicText(detail.brandName,200)||'TikTok 광고 '+id,sourceUrl:url.href,creator:publicText(detail.brandName,200),region:countries.length===1?countries[0]:'GLOBAL',actualRegions:countries,filterRegion:url.searchParams.get('countryCode')||null,periodDays:url.searchParams.has('period')?Number(url.searchParams.get('period')):null,checkedAt:instant(checkedAt),durationSeconds:typeof detail.videoInfo?.duration==='number'&&Number.isFinite(detail.videoInfo.duration)&&detail.videoInfo.duration>=0&&detail.videoInfo.duration<=86400?detail.videoInfo.duration:null,ctrTopPercent:ctr,budgetLabel:Number.isInteger(detail.cost)&&detail.cost>=0&&detail.cost<=2?['Low','Medium','High'][detail.cost]:null,objective:publicText(detail.objectiveKey,100),industry:publicText(detail.industryKey,100),metrics:{views:null,likes:publicCount(detail.like),comments:publicCount(detail.comment),shares:publicCount(detail.share),saves:null,reach:null},provenance:'official-page',provenanceDetails:{method:'public-detail',source:'TikTok Creative Center',checkedAt:instant(checkedAt),adId:id,sourceUrl:url.href,filterRegion:url.searchParams.get('countryCode')||null,reportedRegions:countries,metricSemantics:'공개 상세 화면의 수치입니다. CTR 상위 백분위이며 실제 클릭률·전환율이 아닙니다.'}};
}

export function createCreativeResearchService({store,clock=()=>new Date().toISOString(),fetchImpl=fetch}){
  const inflight=new Set();let stopped=false;
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function writable(user){user=current(user);if(user.role==='viewer')throw fail('열람 계정은 제작 참고 자료를 변경할 수 없습니다.',403);if(stopped)throw fail('서버가 종료 중입니다.',503);return user;}
  function sameTeam(user,row){return !!user.teamId&&user.teamId===row.teamId&&store.get('teams',row.teamId)?.active===true;}
  function canRead(user,row){const scope=user.role==='admin'||row.ownerId===user.id||row.visibility==='company'||row.visibility==='team'&&sameTeam(user,row);if(!scope)return false;const channel=row.channelId&&store.get('channels',row.channelId);return !row.channelId||!!channel&&channel.active!==false&&canReadChannel(user,channel);}
  function canEdit(user,row){return user.role!=='viewer'&&canRead(user,row)&&(row.ownerId===user.id||user.role==='admin'||row.visibility==='team'&&user.role==='manager'&&sameTeam(user,row))&&(!row.channelId||canWriteChannel(user,store.get('channels',row.channelId)));}
  function view(user,row){const channel=row.channelId&&store.get('channels',row.channelId);return {...row,ownerName:store.get('users',row.ownerId)?.name||'이전 담당자',channelName:channel?(channel.displayName||channel.handle||channel.canonicalUrl||channel.id):null,canEdit:canEdit(user,row),canArchive:canEdit(user,row)};}
  function find(user,id){const row=store.get(KIND,text(id,100,'자료 ID',true));if(!row||!canRead(user,row))throw fail('참고 자료를 찾을 수 없습니다.',404);return row;}
  function channel(user,id,source,required){if(id==null||id===''){if(required)throw fail('이 관찰에 해당하는 담당 채널을 선택해 주세요.');return null;}id=text(id,100,'채널',true);const row=store.get('channels',id),platform=source==='youtube-trends'?'youtube':source==='tiktok-top-ads'?'tiktok':source;if(!row||row.active===false||!canWriteChannel(user,row))throw fail('현재 수정할 수 있는 활성 담당 채널을 선택해 주세요.',404);if(row.platform!==platform)throw fail('자료와 같은 플랫폼의 담당 채널을 선택해 주세요.');return id;}
  function sharing(user,row,input,old){
    if(input.visibility!==undefined){if(!['private','team','company'].includes(input.visibility))throw fail('공유 범위를 확인해 주세요.');row.visibility=input.visibility;}
    const desiredTeam=input.teamId===undefined?(row.teamId??user.teamId??null):(input.teamId??null);
    if(row.visibility!=='private'&&(!old||row.visibility!==old.visibility||row.visibility==='team'&&desiredTeam!==(old.teamId??null))&&input.shareConfirmed!==true)throw fail('선택한 자료를 지정한 범위에 공유할지 확인해 주세요.');
    if(row.visibility==='team'){const id=desiredTeam;if(typeof id!=='string'||!store.get('teams',id)?.active||user.role!=='admin'&&user.teamId!==id)throw fail('공유할 수 있는 활성 팀을 선택해 주세요.',403);row.teamId=id;}else row.teamId=null;
  }
  function normalized(user,input,old=null,{imported=null}={}){
    object(input);const at=instant(clock()),row=old?{...old,metrics:{...old.metrics}}:{id:randomUUID(),ownerId:user.id,visibility:'private',teamId:null,status:'active',archived:false,createdAt:at,metrics:Object.fromEntries(metricNames.map(key=>[key,null])),creator:'',hook:'',structure:'',adaptation:'',channelId:null,periodDays:null,durationSeconds:null,ctrTopPercent:null,budgetLabel:null,interest:'unknown',actualRegions:[],filterRegion:null};
    if(imported)Object.assign(row,imported);
    for(const key of ['source','kind'])if(input[key]!==undefined)row[key]=input[key];if(!sourceKinds[row.source]?.includes(row.kind))throw fail('플랫폼과 자료 종류를 확인해 주세요.');
    if(!old&&!imported||input.title!==undefined)row.title=text(input.title,200,'제목',true);
    if(!old&&!imported||input.sourceUrl!==undefined)row.sourceUrl=normalizeResearchUrl(row.source,row.kind,input.sourceUrl);else row.sourceUrl=normalizeResearchUrl(row.source,row.kind,row.sourceUrl);
    for(const [key,max]of [['creator',200],['hook',2000],['structure',4000],['adaptation',4000],['note',4000],['objective',200],['industry',200]])if(input[key]!==undefined)row[key]=text(input[key],max,key);
    if(input.region!==undefined||!old&&!imported)row.region=region(input.region);
    if(input.periodDays!==undefined)row.periodDays=scalar(input.periodDays,'관찰 기간',{max:3650});
    if(row.periodDays!==null&&![7,28,30,90,180].includes(row.periodDays))throw fail('화면에 제공된 집계 기간을 선택해 주세요.');
    if(input.interest!==undefined){if(!['unknown','very-low','low','medium','high','very-high'].includes(input.interest))throw fail('화면에서 확인한 관심도를 선택해 주세요.');row.interest=input.interest;}
    if(row.source!=='youtube-trends'&&row.interest!=='unknown')throw fail('시청자 관심도는 YouTube Studio 관찰에만 기록할 수 있습니다.');
    if(input.budgetLabel!==undefined){if(input.budgetLabel!==null&&!['Low','Medium','High'].includes(input.budgetLabel))throw fail('화면에 표시된 예산 단계를 선택해 주세요.');row.budgetLabel=input.budgetLabel;}
    if(row.source!=='tiktok-top-ads'&&row.budgetLabel!==null)throw fail('예산 단계는 TikTok Top Ads의 표시값만 기록할 수 있습니다.');
    if(input.durationSeconds!==undefined)row.durationSeconds=scalar(input.durationSeconds,'영상 길이',{max:86400,integer:false});
    if(input.ctrTopPercent!==undefined)row.ctrTopPercent=scalar(input.ctrTopPercent,'CTR 상위 백분위',{max:100,integer:false});
    if(row.source!=='tiktok-top-ads'&&row.ctrTopPercent!==null)throw fail('CTR 상위 백분위는 TikTok Top Ads에서 확인한 값만 기록할 수 있습니다.');
    if(input.metrics!==undefined){object(input.metrics);if(Object.keys(input.metrics).some(key=>!metricNames.includes(key)))throw fail('허용된 조회·반응 수치만 입력해 주세요.');for(const key of metricNames)if(input.metrics[key]!==undefined)row.metrics[key]=scalar(input.metrics[key],key);}
    if(['facebook','instagram'].includes(row.source)&&row.kind==='ad'&&Object.values(row.metrics).some(value=>value!==null))throw fail('일반 광고 라이브러리는 광고 성과 수치를 공개하지 않습니다. 광고 사례에는 성과 수치를 입력할 수 없습니다.');
    if(['facebook','instagram'].includes(row.source)&&row.kind==='best-practice'&&Object.values(row.metrics).some(value=>value!==null))throw fail('공식 제작 안내에는 성과 수치를 입력할 수 없습니다.');
    const required=row.source==='youtube-trends'||['facebook','instagram'].includes(row.source)&&row.kind==='insight';
    row.channelId=channel(user,input.channelId===undefined?row.channelId:input.channelId,row.source,required);
    sharing(user,row,input,old);
    if(input.archived!==undefined){if(typeof input.archived!=='boolean')throw fail('보관 여부를 확인해 주세요.');row.archived=input.archived;row.status=input.archived?'archived':'active';}
    if(input.checkedAt!==undefined)row.checkedAt=instant(input.checkedAt);else if(!old&&!imported)row.checkedAt=at;
    if(Date.parse(row.checkedAt)>Date.parse(at))throw fail('확인 날짜는 미래일 수 없습니다.');
    const manualProvenance=row.source==='youtube-trends'||row.kind==='insight'?'studio-observation':'manual';
    if(!imported&&!old){row.provenance=manualProvenance;row.provenanceDetails={method:'manual',sourceUrl:row.sourceUrl,checkedAt:row.checkedAt,metricSemantics:'직원이 공식 원문 또는 담당 계정 화면에서 직접 확인해 기록한 값입니다.'};}
    if(!imported&&old){const changed=['source','kind','sourceUrl','title','creator','region','interest','periodDays','durationSeconds','ctrTopPercent','budgetLabel','metrics','checkedAt','objective','industry'].some(key=>input[key]!==undefined&&JSON.stringify(row[key])!==JSON.stringify(old[key]));if(changed){row.provenance=manualProvenance;row.actualRegions=[];row.filterRegion=null;row.provenanceDetails={...old.provenanceDetails,method:'manual',sourceUrl:row.sourceUrl,checkedAt:row.checkedAt,editedAt:at,metricSemantics:'원문 또는 담당 계정 화면을 직접 확인해 수정한 값입니다.'};}}
    row.updatedAt=at;return row;
  }
  function workspace(user,{includeArchived=false,archived=false}={}){
    user=current(user);return {sources:CREATIVE_RESEARCH_SOURCES.map(value=>({...value})),entries:store.all(KIND).filter(row=>(includeArchived||archived||!row.archived)&&canRead(user,row)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(row=>view(user,row)),channels:store.all('channels').filter(row=>row.active!==false&&canWriteChannel(user,row)).map(({id,platform,displayName,canonicalUrl,externalId,teamId,active})=>({id,platform,displayName,canonicalUrl,externalId,teamId:teamId||null,active:active!==false,canEdit:true})),teams:store.all('teams').filter(row=>row.active&&(user.role==='admin'||row.id===user.teamId)).map(({id,name})=>({id,name})),canCreate:user.role!=='viewer'};
  }
  function capacity(user){if(store.all(KIND).filter(row=>row.ownerId===user.id).length>=500)throw fail('한 직원은 참고 자료를 최대 500개까지 보관할 수 있습니다.',409);}
  function duplicate(user,row){if(row.source!=='tiktok-top-ads')return null;const id=/\/topads\/(\d+)\//.exec(row.sourceUrl)?.[1];return store.all(KIND).find(existing=>existing.ownerId===user.id&&existing.source===row.source&&!existing.archived&&canRead(user,existing)&&/\/topads\/(\d+)\//.exec(existing.sourceUrl)?.[1]===id)||null;}
  function add(user,input){user=writable(user);const row=normalized(user,input),existing=duplicate(user,row);if(existing)return {entry:view(user,existing),existing:true};capacity(user);store.put(KIND,row.id,row);return {entry:view(user,row)};}
  function update(user,id,input){user=writable(user);const old=find(user,id);if(!canEdit(user,old))throw fail('이 참고 자료를 수정할 권한이 없습니다.',403);const row=normalized(user,input,old);store.put(KIND,row.id,row);return {entry:view(user,row)};}
  function archive(user,id,input={archived:true}){object(input);return update(user,id,{archived:input.archived??true});}
  async function loadTopAd(sourceUrl){
    let url=normalizeResearchUrl('tiktok-top-ads','ad',sourceUrl);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);timer.unref();
    try{
      for(let redirects=0;redirects<=2;redirects++){
        const response=await fetchImpl(url,{redirect:'manual',signal:controller.signal,headers:{Accept:'text/html','User-Agent':'SYNK-CreativeResearch/1.0'}});
        if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location||redirects===2)throw fail('공식 광고 상세 페이지로 연결하지 못했습니다.',502);url=normalizeResearchUrl('tiktok-top-ads','ad',new URL(location,url).href);continue;}
        if(!response.ok)throw fail('공식 광고 페이지에 연결하지 못했습니다. 원문을 직접 확인해 기록해 주세요.',502);
        if(response.url)normalizeResearchUrl('tiktok-top-ads','ad',response.url);
        if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw fail('공식 광고 상세 화면이 아닙니다.',422);
        const limit=2*1024*1024;if(Number(response.headers.get('content-length'))>limit)throw fail('광고 상세 정보가 너무 큽니다.',422);
        let html;if(response.body?.getReader){const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw fail('광고 상세 정보가 너무 큽니다.',422);}parts.push(Buffer.from(value));}html=Buffer.concat(parts).toString('utf8');}finally{reader.releaseLock();}}else{html=await response.text();if(Buffer.byteLength(html)>limit)throw fail('광고 상세 정보가 너무 큽니다.',422);}
        return parseTopAd(html,sourceUrl,clock());
      }
      throw fail('공식 광고 상세 페이지로 연결하지 못했습니다.',502);
    }catch(error){if(error.status)throw error;throw fail('공식 광고 정보를 가져오지 못했습니다. 원문을 직접 확인해 기록해 주세요.',502);}finally{clearTimeout(timer);}
  }
  function importTopAd(user,input,{assertSession}={}){
    user=writable(user);object(input);const url=normalizeResearchUrl('tiktok-top-ads','ad',input.sourceUrl??input.url);
    const draft={...input,source:'tiktok-top-ads',kind:'ad',sourceUrl:url,title:'가져오는 광고'};delete draft.url;
    const preview=normalized(user,draft),existing=duplicate(user,preview);if(existing)return Promise.resolve({entry:view(user,existing),existing:true});capacity(user);if(inflight.size>=3)throw fail('광고 가져오기가 진행 중입니다. 잠시 후 다시 시도해 주세요.',429);
    const work=(async()=>{const imported=await loadTopAd(url);assertSession?.();user=writable(user);const allowed=Object.fromEntries(['visibility','teamId','shareConfirmed','channelId','hook','structure','adaptation','note'].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]));const row=normalized(user,allowed,null,{imported});assertSession?.();const existing=duplicate(user,row);if(existing)return {entry:view(user,existing),existing:true};capacity(user);store.put(KIND,row.id,row);return {entry:view(user,row)};})();
    inflight.add(work);work.then(()=>inflight.delete(work),()=>inflight.delete(work));return work;
  }
  async function waitForIdle(){await Promise.allSettled([...inflight]);}
  async function stop(){stopped=true;await waitForIdle();}
  return {workspace,add,importTopAd,update,archive,waitForIdle,stop};
}
