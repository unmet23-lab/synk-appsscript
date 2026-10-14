import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel,visibleMembers} from './organization.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const KIND='creativeResearchEntries';
const REPORT_KIND='creativeResearchReports';
const GUIDE_DAYS='creativeResearchGuideDays',GUIDE_DAILY_LIMIT=10,GUIDE_CAPACITY=5000;
const KST=9*60*60*1000,DAY=24*60*60*1000;
const REPORT_MAX_BYTES=1024*1024;
const sourceKinds={
  'youtube-trends':['top-search','content-gap','breakout-video','recent-video'],
  'tiktok-top-ads':['ad'],facebook:['ad','reel','insight','best-practice'],instagram:['ad','reel','insight','best-practice'],
};
const metricNames=['views','likes','comments','shares','saves','reach'];
const runTimeKeys=['asOfAt','researchStartedAt','researchCompletedAt'];
const reportKeys=new Set(['schemaVersion','reportId','supersedesReportId','date','provider','entries','visibility','teamId','shareConfirmed',...runTimeKeys]);
const reportEntryKeys=new Set(['source','kind','title','sourceUrl','creator','region','periodDays','interest','budgetLabel','durationSeconds','ctrTopPercent','metrics','channelId','hook','structure','adaptation','note','objective','industry','checkedAt','research']);
const researchKeys=new Set(['summary','whyNow','viewerReason','brands','priority','observedFacts','evidenceLevel','limitations','publishedAt','applications','productionGuide']);
const applicationLengths={brand:80,idea:800,zeroSecondHook:300,action:600,reward:600,personalizationTool:800,validation72h:800};
const concreteKinds=new Set(['ad','reel','breakout-video','recent-video']);
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 형식을 확인해 주세요.');return value;};
const kstDate=value=>new Date(Date.parse(value)+KST).toISOString().slice(0,10);
const ordered=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(ordered):Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
const stableJson=value=>JSON.stringify(ordered(value));
function text(value,max,label,required=false){if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}: ${max}자 이하로 입력해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;}
function instant(value,label='확인 시각'){const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);if(!match||+match[2]<1||+match[2]>12||+match[3]<1||+match[3]>new Date(Date.UTC(+match[1],+match[2],0)).getUTCDate()||!Number.isFinite(Date.parse(value)))throw fail(`${label}에는 시간대가 포함된 날짜와 시간을 입력해 주세요.`);return new Date(value).toISOString();}
function publicationDay(value){const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)throw fail('게시 날짜는 정확한 YYYY-MM-DD여야 합니다.');const year=+match[1],month=+match[2],day=+match[3],leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];if(year<1||month<1||month>12||day<1||day>days[month-1])throw fail('실제로 존재하는 그레고리력 게시 날짜를 기록해 주세요.');return value;}
export function producerPublicationDateNotice(value){const date=publicationDay(value);return `[게시일 정밀도] 원보고서의 날짜 기록: ${date}. 정확한 게시 시각·시간대와 원문 일치 여부는 미확인입니다. 최근 6시간·24시간의 새 게시 자료로 확정하지 않습니다.`;}
// This adapter is used only after a completed producer Doc is parsed. The
// public/API/CLI validator below still requires an exact instant or null.
export function normalizeProducerPublicationDates(input,{at=new Date().toISOString()}={}){
  object(input);reportSize(input);at=instant(at);const publicationDateNormalizations=[];
  if(!Array.isArray(input.entries))return {report:input,publicationDateNormalizations};
  const entries=input.entries.map((entry,entryIndex)=>{
    const value=entry?.research?.publishedAt;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return entry;
    const publishedDate=publicationDay(value),checkedAt=instant(entry.checkedAt);if(publishedDate>kstDate(checkedAt)||publishedDate>kstDate(at))throw fail('게시 날짜 기록은 실제 확인 시각과 현재 시각의 한국 날짜보다 늦을 수 없습니다.');
    const previous=text(entry.research.limitations,1500,'확인 범위와 한계',true),notice=producerPublicationDateNotice(publishedDate),limitations=previous.includes(notice)?previous:previous+' '+notice;
    text(limitations,1500,'게시 날짜 정밀도를 포함한 확인 범위와 한계',true);publicationDateNormalizations.push({entryIndex,publishedDate});
    return {...entry,research:{...entry.research,publishedAt:null,limitations}};
  });
  return {report:{...input,entries},publicationDateNormalizations};
}
export function creativeResearchTime(at=new Date().toISOString()){const now=instant(at,'현재 시각'),millis=Date.parse(now);return {now,nowKst:new Date(millis+KST).toISOString().replace(/Z$/,'+09:00'),timeZone:'Asia/Seoul',dateKst:kstDate(now),windows:{sixHoursAgo:new Date(millis-6*3600000).toISOString(),dayAgo:new Date(millis-DAY).toISOString(),weekAgo:new Date(millis-7*DAY).toISOString()}};}
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

// A discovery filter or a public video's URL spelling must not create another entry.
export function researchIdentity(row){
  const url=new URL(normalizeResearchUrl(row.source,row.kind,row.sourceUrl));
  if(url.hostname==='facebook.com'||url.hostname==='m.facebook.com')url.hostname='www.facebook.com';
  if(row.source==='tiktok-top-ads')return row.source+':ad:'+url.pathname.match(/\/topads\/(\d+)\//)[1];
  if(row.source==='youtube-trends'&&url.hostname!=='studio.youtube.com'){
    const videoId=url.hostname==='youtu.be'?url.pathname.split('/')[1]:url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.split('/')[2];
    return row.source+':video:'+videoId;
  }
  if(['facebook','instagram'].includes(row.source)&&row.kind==='ad')return row.source+':ad:'+url.searchParams.get('id');
  if(row.source==='instagram'&&row.kind==='reel')return row.source+':post:'+url.pathname.split('/')[2];
  if(row.source==='facebook'&&row.kind==='reel'){
    const videoId=url.pathname.match(/^\/reel\/(\d+)/)?.[1]||(url.pathname.startsWith('/watch')?url.searchParams.get('v'):url.pathname.match(/\/videos\/(\d+)\/?$/)?.[1]);
    if(videoId)return row.source+':video:'+videoId;
  }
  url.pathname=url.pathname.replace(/\/$/,'')||'/';url.searchParams.sort();
  const accountObservation=row.source==='youtube-trends'||row.kind==='insight';
  return row.source+':'+row.kind+':'+url.href+(accountObservation?':'+(row.channelId||'')+':'+row.title:'');
}

const needsResearchChannel=row=>row.kind==='insight'||row.source==='youtube-trends'&&(row.kind==='top-search'||row.kind==='content-gap'||new URL(row.sourceUrl).hostname==='studio.youtube.com');
const hasProductionGuide=row=>!!row.research?.productionGuide&&concreteKinds.has(row.kind)&&['page-read','video-watched'].includes(row.productionGuideEvidenceLevel||row.research?.evidenceLevel);
const companyGuide=row=>row.visibility==='company'&&hasProductionGuide(row);
const guideIdentity=row=>['facebook','instagram'].includes(row.source)&&row.kind==='ad'?'meta-ad:'+new URL(normalizeResearchUrl(row.source,row.kind,row.sourceUrl)).searchParams.get('id'):researchIdentity(row);

function productionGuideValue(value,row){
  object(value);if(Object.keys(value).some(key=>!['formatName','productionSteps','requiredAssets','brandAdaptation','appeal','estimatedMinutes'].includes(key)))throw fail('제작 가이드에는 형식·제작 순서·준비물·브랜드 적용·어필·예상 시간만 넣어 주세요.');
  if(!concreteKinds.has(row.kind))throw fail('준비된 제작 가이드는 실제 공개 광고·릴스·영상 사례에만 붙일 수 있습니다.');
  if(!['page-read','video-watched'].includes(row.researchEvidenceLevel))throw fail('제작 가이드는 원문 본문이나 영상을 직접 확인한 사례에만 붙일 수 있습니다.');
  const result={formatName:text(value.formatName,120,'제작 형식',true),productionSteps:[],requiredAssets:[],brandAdaptation:text(value.brandAdaptation,3000,'브랜드에 적용할 점',true),appeal:text(value.appeal,1600,'시청자에게 어필할 점',true)};
  if(!Array.isArray(value.productionSteps)||value.productionSteps.length<3||value.productionSteps.length>12)throw fail('실행할 제작 순서는 3개 이상 12개 이하로 기록해 주세요.');
  result.productionSteps=value.productionSteps.map((step,index)=>{object(step);if(Object.keys(step).some(key=>!['order','title','instruction'].includes(key))||step.order!==index+1)throw fail('제작 순서는 1부터 빠짐없이 이어져야 합니다.');return {order:step.order,title:text(step.title,120,'제작 단계 제목',true),instruction:text(step.instruction,2000,'실행할 제작 지침',true)};});
  if(!Array.isArray(value.requiredAssets)||value.requiredAssets.length<1||value.requiredAssets.length>12)throw fail('필요한 실제 자료와 준비물은 1개 이상 12개 이하로 기록해 주세요.');
  result.requiredAssets=value.requiredAssets.map(asset=>text(asset,300,'준비할 자료',true));
  if(value.estimatedMinutes!==undefined){if(value.estimatedMinutes!==null&&(!Number.isSafeInteger(value.estimatedMinutes)||value.estimatedMinutes<1||value.estimatedMinutes>1440))throw fail('예상 제작 시간은 1~1,440분의 정수 또는 미확인 null이어야 합니다.');result.estimatedMinutes=value.estimatedMinutes;}
  return result;
}

function researchValue(value,row){
  object(value);if(Object.keys(value).some(key=>!researchKeys.has(key)))throw fail('조사 내용에는 허용된 사실·적용 제안 항목만 넣어 주세요.');
  if(!['page-read','video-watched','metadata-only','search-only'].includes(value.evidenceLevel))throw fail('조사에서 실제 확인한 근거 수준을 선택해 주세요.');
  if(value.evidenceLevel==='search-only')throw fail('검색 결과만 본 자료는 가져올 수 없습니다. 공식 원문을 직접 연 자료만 포함해 주세요.');
  if(!['high','medium','watch'].includes(value.priority))throw fail('검토 우선순위는 high·medium·watch 중에서 선택해 주세요.');
  const result={summary:text(value.summary,600,'짧은 조사 요약',true),whyNow:text(value.whyNow,1200,'지금 살펴볼 이유',true),brands:[],priority:value.priority,observedFacts:[],evidenceLevel:value.evidenceLevel,limitations:text(value.limitations,1500,'확인 범위와 한계',true),applications:[]};
  if(value.viewerReason!==undefined)result.viewerReason=text(value.viewerReason,600,'시청자가 볼 이유');
  if(!Array.isArray(value.brands)||value.brands.length>6)throw fail('연결할 브랜드·프로젝트는 최대 6개까지 기록해 주세요.');
  result.brands=[...new Set(value.brands.map(brand=>text(brand,80,'브랜드·프로젝트',true)))];
  if(!Array.isArray(value.observedFacts)||value.observedFacts.length>8)throw fail('조사에서 확인한 사실은 최대 8개까지 기록해 주세요.');
  result.observedFacts=value.observedFacts.map(fact=>{
    object(fact);if(Object.keys(fact).some(key=>!['text','sourceUrl'].includes(key)))throw fail('관찰 사실에는 내용과 공식 근거 주소만 넣어 주세요.');
    return {text:text(fact.text,1000,'조사에 기록된 관찰 사실',true),sourceUrl:normalizeResearchUrl(row.source,row.kind,fact.sourceUrl===undefined?row.sourceUrl:fact.sourceUrl)};
  });
  if(value.publishedAt!==undefined){result.publishedAt=value.publishedAt===null?null:instant(value.publishedAt,'원문 게시 시각');if(result.publishedAt&&Date.parse(result.publishedAt)>Date.parse(row.checkedAt))throw fail('원문 게시 시각은 자료를 확인한 시각보다 늦을 수 없습니다.');}
  if(!Array.isArray(value.applications)||value.applications.length>3)throw fail('우리 콘텐츠의 적용 제안은 최대 3개까지 기록해 주세요.');
  result.applications=value.applications.map(application=>{
    object(application);if(Object.keys(application).some(key=>!Object.hasOwn(applicationLengths,key)))throw fail('적용 제안에는 브랜드·아이디어·훅·행동·보상·맞춤 도구·검증 계획만 넣어 주세요.');
    return Object.fromEntries(Object.entries(applicationLengths).map(([key,max])=>[key,text(application[key],max,'적용 제안 '+key,true)]));
  });
  if(value.productionGuide!==undefined){if(!result.applications.length)throw fail('제작 가이드에는 브랜드·훅·행동·보상·맞춤 도구·72시간 검증 계획이 필요합니다.');result.productionGuide=productionGuideValue(value.productionGuide,{...row,researchEvidenceLevel:value.evidenceLevel});}
  if(value.evidenceLevel==='metadata-only'&&['hook','structure'].some(key=>row[key]!==undefined&&row[key]!==''))throw fail('표시 정보만 확인한 자료에는 영상의 도입·전개 관찰을 넣을 수 없습니다. 적용 아이디어는 제안 항목에만 기록해 주세요.');
  return result;
}

function reportSize(input){let serialized;try{serialized=JSON.stringify(input);if(typeof serialized!=='string')throw new Error('JSON_REQUIRED');}catch{throw fail('보고서는 JSON으로 저장할 수 있는 입력이어야 합니다.');}if(Buffer.byteLength(serialized,'utf8')>REPORT_MAX_BYTES)throw fail('일일 조사 보고서는 UTF-8 JSON 기준 1MiB 이하여야 합니다.',413);}

// This read-only validator is shared with the scheduled report CLI. Account authority
// and storage capacity are checked separately by importReport immediately before writing.
export function validateResearchReport(input,{at=new Date().toISOString()}={}){
  object(input);reportSize(input);
  if(Object.keys(input).some(key=>!reportKeys.has(key))||input.schemaVersion!==1||!['gemini-spark','codex'].includes(input.provider))throw fail('일일 조사 보고서의 버전·제공자·항목을 확인해 주세요.');
  const reportId=text(input.reportId,100,'보고서 ID',true);if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(reportId))throw fail('보고서 ID에는 영문·숫자·점·밑줄·콜론·하이픈만 사용할 수 있습니다.');
  if(input.supersedesReportId!==undefined){const previous=text(input.supersedesReportId,100,'교정할 보고서 ID',true);if(previous!==input.supersedesReportId||previous===reportId||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(previous)||runTimeKeys.some(key=>input[key]===undefined))throw fail('교정에는 서로 다른 기존 보고서 ID와 원래 조사 실행 시각이 필요합니다.');}
  at=instant(at);const date=input.date,today=kstDate(at),yesterday=kstDate(new Date(Date.parse(at)-DAY).toISOString());
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||![today,yesterday].includes(date))throw fail('일일 보고서 날짜는 한국시간 기준 오늘 또는 어제여야 합니다.');
  const run={};
  if(runTimeKeys.some(key=>input[key]!==undefined)){
    for(const key of runTimeKeys)run[key]=instant(input[key],'조사 실행 시각 '+key);
    if(Date.parse(run.researchStartedAt)>Date.parse(run.asOfAt)||Date.parse(run.asOfAt)>Date.parse(run.researchCompletedAt)||Date.parse(run.researchCompletedAt)>Date.parse(at)||kstDate(run.researchCompletedAt)!==date||![today,yesterday].includes(kstDate(run.researchStartedAt)))throw fail('현재 검색 기준·조사 시작·완료의 실제 시각과 한국시간 완료 날짜를 확인해 주세요.');
  }
  if(!Array.isArray(input.entries)||input.entries.length>30)throw fail('한 보고서에는 자료를 최대 30개까지 넣을 수 있습니다.');
  if(input.shareConfirmed!==undefined&&typeof input.shareConfirmed!=='boolean')throw fail('보고서 공유 확인 여부를 확인해 주세요.');
  if(input.visibility!==undefined&&!['private','team','company'].includes(input.visibility))throw fail('공유 범위를 확인해 주세요.');
  if(input.visibility&&input.visibility!=='private'&&input.shareConfirmed!==true)throw fail('선택한 자료를 지정한 범위에 공유할지 확인해 주세요.');
  if(input.teamId!=null)text(input.teamId,100,'공유 팀',true);
  const identities=new Set(),guideIdentities=new Set(),entries=input.entries.map(entry=>{
    object(entry);if(Object.keys(entry).some(key=>!reportEntryKeys.has(key))||typeof entry.source!=='string'||!Object.hasOwn(sourceKinds,entry.source)||typeof entry.kind!=='string')throw fail('보고서 자료에는 허용된 관찰 항목만 넣어 주세요.');
    const checkedAt=instant(entry.checkedAt),checked=Date.parse(checkedAt);if(run.researchStartedAt?(checked<Date.parse(run.researchStartedAt)||checked>Date.parse(run.researchCompletedAt)):(kstDate(checkedAt)!==date||checked>Date.parse(at)))throw fail('자료 확인 시각은 실제 조사 구간 안의 과거 시각이어야 합니다.');
    const row={...entry,title:text(entry.title,200,'제목',true),sourceUrl:normalizeResearchUrl(entry.source,entry.kind,entry.sourceUrl),checkedAt};
    for(const [key,max]of [['creator',200],['hook',2000],['structure',4000],['adaptation',4000],['note',4000],['objective',200],['industry',200]])if(entry[key]!==undefined)text(entry[key],max,key);
    if(entry.region!==undefined)region(entry.region);
    if(entry.periodDays!==undefined){const value=scalar(entry.periodDays,'관찰 기간',{max:3650});if(value!==null&&![7,28,30,90,180].includes(value))throw fail('화면에 제공된 집계 기간을 선택해 주세요.');}
    if(entry.interest!==undefined){if(!['unknown','very-low','low','medium','high','very-high'].includes(entry.interest))throw fail('화면에서 확인한 관심도를 선택해 주세요.');if(entry.interest!=='unknown'&&(entry.source!=='youtube-trends'||!needsResearchChannel(row)))throw fail('시청자 관심도는 YouTube Studio 관찰에만 기록할 수 있습니다.');}
    if(entry.budgetLabel!==undefined&&entry.budgetLabel!==null&&(!['Low','Medium','High'].includes(entry.budgetLabel)||entry.source!=='tiktok-top-ads'))throw fail('예산 단계는 TikTok Top Ads의 표시값만 기록할 수 있습니다.');
    if(entry.durationSeconds!==undefined)scalar(entry.durationSeconds,'영상 길이',{max:86400,integer:false});
    if(entry.ctrTopPercent!==undefined){const value=scalar(entry.ctrTopPercent,'CTR 상위 백분위',{max:100,integer:false});if(value!==null&&entry.source!=='tiktok-top-ads')throw fail('CTR 상위 백분위는 TikTok Top Ads에서 확인한 값만 기록할 수 있습니다.');}
    if(entry.metrics!==undefined){object(entry.metrics);if(Object.keys(entry.metrics).some(key=>!metricNames.includes(key)))throw fail('허용된 조회·반응 수치만 입력해 주세요.');for(const [key,value]of Object.entries(entry.metrics)){const count=scalar(value,key);if(count!==null&&['facebook','instagram'].includes(entry.source)&&['ad','best-practice'].includes(entry.kind))throw fail('Meta 광고 사례와 공식 제작 안내에는 성과 수치를 입력할 수 없습니다.');}}
    if(entry.channelId!=null&&entry.channelId!=='')text(entry.channelId,100,'채널',true);else if(needsResearchChannel(row))throw fail('이 관찰에 해당하는 담당 채널을 선택해 주세요.');
    if(entry.research!==undefined)row.research=researchValue(entry.research,row);
    if(row.research?.productionGuide){const guideKey=guideIdentity(row);if(guideIdentities.has(guideKey))throw fail('같은 원문의 제작 가이드를 한 보고서에 중복으로 넣을 수 없습니다.');guideIdentities.add(guideKey);}
    const identity=researchIdentity(row);if(identities.has(identity))throw fail('한 보고서에 같은 원문 자료를 두 번 넣을 수 없습니다.');identities.add(identity);
    return row;
  });
  const result={...input,...run,reportId,entries};reportSize(result);return result;
}

export const CREATIVE_RESEARCH_SOURCES=Object.freeze([
  {id:'youtube-trends',label:'YouTube Trends',status:'manual',url:'https://studio.youtube.com/',guideUrl:'https://support.google.com/youtube/answer/11962757?hl=ko',notice:'검색 관심·Shorts 콘텐츠 공백은 담당 채널의 Studio 관찰이며, 개별 공개 영상 사례와 구분합니다. 공개 조사 결과로 Studio 검색 수요를 추정하지 않습니다.',kinds:sourceKinds['youtube-trends']},
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

export function createCreativeResearchService({store,clock=()=>new Date().toISOString(),fetchImpl=fetch,onChanged}){
  store.db.exec('CREATE TABLE IF NOT EXISTS creative_research_usage (entry_id TEXT PRIMARY KEY, source_key TEXT, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL)');
  if(!store.db.prepare('PRAGMA table_info(creative_research_usage)').all().some(column=>column.name==='source_key'))store.db.exec('ALTER TABLE creative_research_usage ADD COLUMN source_key TEXT');
  store.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS creative_research_usage_source ON creative_research_usage(source_key) WHERE source_key IS NOT NULL');
  const usageGet=store.db.prepare('SELECT entry_id AS entryId, source_key AS sourceKey, user_id AS userId, claimed_at AS claimedAt FROM creative_research_usage WHERE entry_id=?'),usageBySource=store.db.prepare('SELECT entry_id AS entryId, source_key AS sourceKey, user_id AS userId, claimed_at AS claimedAt FROM creative_research_usage WHERE source_key=?'),usagePut=store.db.prepare('INSERT INTO creative_research_usage(entry_id,source_key,user_id,claimed_at) VALUES(?,?,?,?)'),usageRemove=store.db.prepare('DELETE FROM creative_research_usage WHERE entry_id=?');
  store.transaction(()=>{for(const saved of store.db.prepare('SELECT entry_id FROM creative_research_usage WHERE source_key IS NULL ORDER BY claimed_at').all()){const row=store.get(KIND,saved.entry_id);if(!row||!companyGuide(row))continue;try{const key=guideIdentity(row);if(!usageBySource.get(key))store.db.prepare('UPDATE creative_research_usage SET source_key=? WHERE entry_id=? AND source_key IS NULL').run(key,saved.entry_id);}catch{}}});
  const inflight=new Set(),revisionSalt=randomUUID();let stopped=false,cachedSnapshot=null;
  const totalChanges=store.db.prepare('SELECT total_changes() AS count'),dataVersion=store.db.prepare('PRAGMA data_version');
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function writable(user){user=current(user);if(user.role==='viewer')throw fail('열람 계정은 제작 참고 자료를 변경할 수 없습니다.',403);if(stopped)throw fail('서버가 종료 중입니다.',503);return user;}
  function sameTeam(user,row,readStore=store){return !!user.teamId&&user.teamId===row.teamId&&readStore.get('teams',row.teamId)?.active===true;}
  function canRead(user,row,readStore=store){const scope=user.role==='admin'||row.ownerId===user.id||row.visibility==='company'||row.visibility==='team'&&sameTeam(user,row,readStore);if(!scope)return false;const channel=row.channelId&&readStore.get('channels',row.channelId);return !row.channelId||!!channel&&channel.active!==false&&canReadChannel(user,channel);}
  function canEdit(user,row,readStore=store){return user.role!=='viewer'&&canRead(user,row,readStore)&&(row.ownerId===user.id||user.role==='admin'||row.visibility==='team'&&user.role==='manager'&&sameTeam(user,row,readStore))&&(!row.channelId||canWriteChannel(user,readStore.get('channels',row.channelId)));}
  function productionReady(row){return companyGuide(row)&&!row.archived;}
  function usageFor(row,snapshot){const direct=snapshot?snapshot.usageByEntry.get(row.id):usageGet.get(row.id);if(direct)return direct;if(companyGuide(row)){try{return snapshot?snapshot.usageBySource.get(snapshot.guideKeys.get(row.id)):usageBySource.get(guideIdentity(row));}catch{}}return null;}
  function usage(user,row,visibleUserIds,snapshot){
    const readStore=snapshot?.readStore||store,saved=usageFor(row,snapshot),isMine=saved?.userId===user.id,readable=canRead(user,row,readStore),canWrite=user.role!=='viewer'&&readable,canClaim=canWrite&&productionReady(row)&&(!saved||isMine),canRelease=!!saved&&canWrite&&(isMine||user.role==='admin');
    const result={status:saved?'in-use':'available',canClaim,canRelease,isMine:!!isMine};
    if(saved&&isMine)result.reservationEntryId=saved.entryId;
    if(saved){result.claimedAt=saved.claimedAt;const allowed=visibleUserIds||new Set(visibleMembers(readStore,user).map(member=>member.id));if(allowed.has(saved.userId)){result.userId=saved.userId;result.userName=readStore.get('users',saved.userId)?.name||'이전 담당자';}}
    return result;
  }
  function presentation(user,row,visibleUserIds,snapshot){const readStore=snapshot?.readStore||store,channel=row.channelId&&readStore.get('channels',row.channelId),editable=canEdit(user,row,readStore);return {ownerName:readStore.get('users',row.ownerId)?.name||'이전 담당자',channelName:channel?(channel.displayName||channel.handle||channel.canonicalUrl||channel.id):null,canEdit:editable,canArchive:editable,productionReady:productionReady(row),usage:usage(user,row,visibleUserIds,snapshot)};}
  function view(user,row,visibleUserIds,snapshot){const {automaticSourceId,...publicRow}=row;return {...publicRow,...presentation(user,row,visibleUserIds,snapshot)};}
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
    if((row.source!=='youtube-trends'||!needsResearchChannel(row))&&row.interest!=='unknown')throw fail('시청자 관심도는 YouTube Studio 관찰에만 기록할 수 있습니다.');
    if(input.budgetLabel!==undefined){if(input.budgetLabel!==null&&!['Low','Medium','High'].includes(input.budgetLabel))throw fail('화면에 표시된 예산 단계를 선택해 주세요.');row.budgetLabel=input.budgetLabel;}
    if(row.source!=='tiktok-top-ads'&&row.budgetLabel!==null)throw fail('예산 단계는 TikTok Top Ads의 표시값만 기록할 수 있습니다.');
    if(input.durationSeconds!==undefined)row.durationSeconds=scalar(input.durationSeconds,'영상 길이',{max:86400,integer:false});
    if(input.ctrTopPercent!==undefined)row.ctrTopPercent=scalar(input.ctrTopPercent,'CTR 상위 백분위',{max:100,integer:false});
    if(row.source!=='tiktok-top-ads'&&row.ctrTopPercent!==null)throw fail('CTR 상위 백분위는 TikTok Top Ads에서 확인한 값만 기록할 수 있습니다.');
    if(input.metrics!==undefined){object(input.metrics);if(Object.keys(input.metrics).some(key=>!metricNames.includes(key)))throw fail('허용된 조회·반응 수치만 입력해 주세요.');for(const key of metricNames)if(input.metrics[key]!==undefined)row.metrics[key]=scalar(input.metrics[key],key);}
    if(['facebook','instagram'].includes(row.source)&&row.kind==='ad'&&Object.values(row.metrics).some(value=>value!==null))throw fail('일반 광고 라이브러리는 광고 성과 수치를 공개하지 않습니다. 광고 사례에는 성과 수치를 입력할 수 없습니다.');
    if(['facebook','instagram'].includes(row.source)&&row.kind==='best-practice'&&Object.values(row.metrics).some(value=>value!==null))throw fail('공식 제작 안내에는 성과 수치를 입력할 수 없습니다.');
    const required=needsResearchChannel(row);
    row.channelId=channel(user,input.channelId===undefined?row.channelId:input.channelId,row.source,required);
    sharing(user,row,input,old);
    if(input.archived!==undefined){if(typeof input.archived!=='boolean')throw fail('보관 여부를 확인해 주세요.');row.archived=input.archived;row.status=input.archived?'archived':'active';}
    if(input.checkedAt!==undefined)row.checkedAt=instant(input.checkedAt);else if(!old&&!imported)row.checkedAt=at;
    if(Date.parse(row.checkedAt)>Date.parse(at))throw fail('확인 날짜는 미래일 수 없습니다.');
    const manualProvenance=needsResearchChannel(row)?'studio-observation':'manual';
    if(!imported&&!old){row.provenance=manualProvenance;row.provenanceDetails={method:'manual',sourceUrl:row.sourceUrl,checkedAt:row.checkedAt,metricSemantics:'직원이 공식 원문 또는 담당 계정 화면에서 직접 확인해 기록한 값입니다.'};}
    if(!imported&&old){const changed=['source','kind','sourceUrl','title','creator','region','interest','periodDays','durationSeconds','ctrTopPercent','budgetLabel','metrics','checkedAt','objective','industry'].some(key=>input[key]!==undefined&&JSON.stringify(row[key])!==JSON.stringify(old[key]));if(changed){row.provenance=manualProvenance;row.actualRegions=[];row.filterRegion=null;row.provenanceDetails={...old.provenanceDetails,method:'manual',sourceUrl:row.sourceUrl,checkedAt:row.checkedAt,editedAt:at,metricSemantics:'원문 또는 담당 계정 화면을 직접 확인해 수정한 값입니다.'};}}
    if(!imported&&old?.research&&researchIdentity(row)!==researchIdentity(old)){delete row.research;delete row.researchCheckedAt;}
    row.updatedAt=at;return row;
  }
  // SQLite's local change count also catches raw SQL writes; data_version
  // catches committed writes from another connection. No TTL postpones access
  // changes, and the Korean day resets the visible daily pool independently.
  function snapshot(){
    const date=kstDate(instant(clock())),stamp=totalChanges.get().count+':'+dataVersion.get().data_version+':'+date;
    if(cachedSnapshot?.stamp===stamp)return cachedSnapshot;
    const kinds=[KIND,REPORT_KIND,'users','teams','channels'],lists=new Map(kinds.map(kind=>[kind,store.all(kind)])),maps=new Map([...lists].map(([kind,rows])=>[kind,new Map(rows.map(row=>[row.id,row]))]));
    const readStore={get:(kind,id)=>maps.get(kind)?.get(id)||null,all:kind=>lists.get(kind)||[]},entries=lists.get(KIND),reports=lists.get(REPORT_KIND),entryHashes=new Map(),guideKeys=new Map(),encodedEntries=new Map();
    // Claims, permission changes and audit records usually leave the large
    // guide bodies untouched. Reuse their content digests across snapshots;
    // changed rows still get an exact hash, including same-length edits.
    for(const row of entries){const encoded=JSON.stringify(row),previous=cachedSnapshot?.encodedEntries.get(row.id);let hash,key;if(previous?.encoded===encoded){({hash,key}=previous);}else{const {automaticSourceId,...publicRow}=row;hash=createHash('sha256').update(stableJson(publicRow)).digest('hex');if(companyGuide(row))try{key=guideIdentity(row);}catch{}}entryHashes.set(row.id,hash);if(key)guideKeys.set(row.id,key);encodedEntries.set(row.id,{encoded,hash,key});}
    const reservations=store.db.prepare('SELECT entry_id AS entryId,source_key AS sourceKey,user_id AS userId,claimed_at AS claimedAt FROM creative_research_usage').all(),day=guideDay(date),pool={date,limit:GUIDE_DAILY_LIMIT,addedCount:day.entryIds.length,remainingCount:Math.max(0,GUIDE_DAILY_LIMIT-day.entryIds.length),deferredCount:day.deferredCount||0,capacity:GUIDE_CAPACITY,storedCount:entries.filter(companyGuide).length};
    return cachedSnapshot={stamp,entries,reports,readStore,entryHashes,guideKeys,encodedEntries,pool,usageByEntry:new Map(reservations.map(row=>[row.entryId,row])),usageBySource:new Map(reservations.filter(row=>row.sourceKey).map(row=>[row.sourceKey,row])),profiles:new Map()};
  }
  function profile(user){
    user=current(user);const saved=snapshot(),key=user.id+'\n'+user.role+'\n'+(user.teamId||'');if(saved.profiles.has(key))return saved.profiles.get(key);
    const visibleUserIds=new Set(visibleMembers(saved.readStore,user).map(member=>member.id)),entries=saved.entries.filter(row=>canRead(user,row,saved.readStore)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))),readable=new Set(entries.map(row=>row.id)),reports=saved.reports.filter(row=>canReadReport(user,row,saved.readStore,readable)).sort((a,b)=>String(b.importedAt||'').localeCompare(String(a.importedAt||'')));
    const core={sources:CREATIVE_RESEARCH_SOURCES.map(value=>({...value})),channels:saved.readStore.all('channels').filter(row=>row.active!==false&&canWriteChannel(user,row)).map(({id,platform,displayName,canonicalUrl,externalId,teamId,active})=>({id,platform,displayName,canonicalUrl,externalId,teamId:teamId||null,active:active!==false,canEdit:true})),teams:saved.readStore.all('teams').filter(row=>row.active&&(user.role==='admin'||row.id===user.teamId)).map(({id,name})=>({id,name})),canCreate:user.role!=='viewer',automation:{lastReport:reports.length?reportView(reports[0]):null,reportCount:reports.length,pool:saved.pool}};
    const presentations=new Map(entries.map(row=>[row.id,presentation(user,row,visibleUserIds,saved)])),revision=createHash('sha256').update(revisionSalt+'\n'+user.id+'\n'+stableJson({...core,entries:entries.map(row=>({id:row.id,hash:saved.entryHashes.get(row.id),...presentations.get(row.id)}))})).digest('hex');
    const result={core,entries,presentations,readableReports:new Set(reports.map(row=>row.id)),revision};saved.profiles.set(key,result);return result;
  }
  function revision(user){return profile(user).revision;}
  function workspace(user,{includeArchived=false,archived=false}={}){
    const saved=profile(user),entries=saved.entries.filter(row=>includeArchived||archived||!row.archived).map(row=>{const {automaticSourceId,...publicRow}=row;return {...publicRow,...saved.presentations.get(row.id)};});
    // Callers add sync DTOs and may modify a result. They never receive cached
    // objects, and revision-only polling never builds or serializes this body.
    return structuredClone({...saved.core,entries,revision:saved.revision});
  }
  function reportVisible(user,id){return typeof id==='string'&&profile(user).readableReports.has(id);}
  function reportView(row){return Object.fromEntries(['id','reportId','supersedesReportId','date','provider','status','checkedAt','importedAt','createdCount','updatedCount','retainedCount','itemCount','acceptedCount','deferredCount','deferredObservationCount','deferredGuideCount','addedGuideCount','originalInputHash','publicationDateNormalizationCount',...runTimeKeys].map(key=>[key,row[key]]));}
  function guideDay(date=kstDate(instant(clock()))){return store.get(GUIDE_DAYS,date)||{date,entryIds:[],deferredCount:0};}
  function guidePool(){const day=guideDay();return {date:day.date,limit:GUIDE_DAILY_LIMIT,addedCount:day.entryIds.length,remainingCount:Math.max(0,GUIDE_DAILY_LIMIT-day.entryIds.length),deferredCount:day.deferredCount||0,capacity:GUIDE_CAPACITY,storedCount:store.all(KIND).filter(companyGuide).length};}
  function assertCapacity(rows){if(rows.filter(companyGuide).length>GUIDE_CAPACITY)throw fail('회사 제작 가이드는 최대 5,000개까지 보관할 수 있습니다.',409);const counts=new Map();for(const row of rows.filter(row=>!companyGuide(row)))counts.set(row.ownerId,(counts.get(row.ownerId)||0)+1);if([...counts.values()].some(value=>value>500))throw fail('한 직원은 개인 자료와 일반 참고 자료를 최대 500개까지 보관할 수 있습니다.',409);}
  function quotaAdmission(row,old,day,at){if(!companyGuide(row)||companyGuide(old||{})||day.entryIds.includes(row.id))return false;if(day.entryIds.length>=GUIDE_DAILY_LIMIT)return null;day.entryIds.push(row.id);row.productionGuideAddedAt=at;row.productionGuideAddedDate=day.date;return true;}
  function canReadReport(user,row,readStore=store,readable){
    if(user.role==='admin'||row.ownerId===user.id)return true;
    const shared=row.visibility==='company'||row.visibility==='team'&&sameTeam(user,row,readStore);
    return shared&&(row.entryIds||[]).every(id=>readable?readable.has(id):!!readStore.get(KIND,id)&&canRead(user,readStore.get(KIND,id),readStore));
  }
  function importReport(user,input,{assertSession,automaticSourceId,automaticSourcePoolIds,originalInputHash,publicationDateNormalizations}={}){
    user=writable(user);const automatic=automaticSourceId!==undefined;
    if(automatic&&(user.role!=='admin'||typeof automaticSourceId!=='string'||!/^[A-Za-z0-9_-]{20,200}$/.test(automaticSourceId)))throw fail('자동 반영에는 현재 관리자 권한과 전용 문서 ID가 필요합니다.',403);
    if(automaticSourcePoolIds!==undefined&&(!automatic||!Array.isArray(automaticSourcePoolIds)||!automaticSourcePoolIds.length||automaticSourcePoolIds.length>8||automaticSourcePoolIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{20,200}$/.test(id))||!automaticSourcePoolIds.includes(automaticSourceId)))throw fail('등록되고 검증된 자동 조사 문서 풀을 확인해 주세요.',403);
    const approvedSources=new Set(automaticSourcePoolIds||[automaticSourceId]);
    const at=instant(clock());input=validateResearchReport(input,{at});const {reportId,date}=input;
    const publicationDates=new Map(),hasProducerMetadata=originalInputHash!==undefined||publicationDateNormalizations!==undefined;
    if(hasProducerMetadata){
      if(!automatic||typeof originalInputHash!=='string'||!/^[a-f0-9]{64}$/.test(originalInputHash)||publicationDateNormalizations!==undefined&&(!Array.isArray(publicationDateNormalizations)||publicationDateNormalizations.length>30))throw fail('원문 해시와 날짜 정밀도 기록은 검증된 자동 수집 경계에서만 보낼 수 있습니다.',403);
      for(const item of publicationDateNormalizations||[]){
        if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['entryIndex','publishedDate'].includes(key))||!Number.isSafeInteger(item.entryIndex)||item.entryIndex<0||item.entryIndex>=input.entries.length||publicationDates.has(item.entryIndex))throw fail('원문 날짜 정밀도 기록의 항목을 확인해 주세요.',403);
        let day;try{day=publicationDay(item.publishedDate);}catch{throw fail('원문 날짜 정밀도 기록을 확인해 주세요.',403);}const entry=input.entries[item.entryIndex];
        if(entry.research?.publishedAt!==null||!entry.research.limitations.includes(producerPublicationDateNotice(day))||day>kstDate(entry.checkedAt)||day>kstDate(at))throw fail('날짜 기록을 정확한 게시 시각으로 대신하거나 확인 범위를 지울 수 없습니다.',403);
        publicationDates.set(item.entryIndex,day);
      }
    }
    const scope={visibility:'private',teamId:null};sharing(user,scope,input,null);
    if(automatic&&scope.visibility!=='company')throw fail('전용 문서 자동 반영은 공개 자료의 회사 공유만 지원합니다.');
    const candidates=input.entries.map((entry,entryIndex)=>{
      const {checkedAt}=entry,row=normalized(user,{...entry,...scope,shareConfirmed:input.shareConfirmed}),identity=researchIdentity(row);
      if(row.source==='tiktok-top-ads')row.filterRegion=new URL(row.sourceUrl).searchParams.get('countryCode')||null;
      if(automatic)row.automaticSourceId=automaticSourceId;
      if(entry.research!==undefined){row.research=entry.research;row.researchCheckedAt=checkedAt;if(entry.research.productionGuide){row.productionGuideCheckedAt=checkedAt;row.productionGuideEvidenceLevel=entry.research.evidenceLevel;}}
      row.provenance='research-report';row.provenanceDetails={method:'scheduled-research',provider:input.provider,reportId,reportDate:date,checkedAt,importedAt:at,sourceUrl:row.sourceUrl,metricSemantics:'예약 조사 결과에 기록된 관찰값입니다. 서버가 원문 수치를 직접 재확인한 값은 아니며, 미확인 수치는 비워 둡니다.'};
      if(hasProducerMetadata)row.provenanceDetails.originalInputHash=originalInputHash;
      if(publicationDates.has(entryIndex))row.provenanceDetails.recordedPublicationDate={date:publicationDates.get(entryIndex),precision:'day',timeZone:null};
      for(const key of runTimeKeys)if(input[key]!==undefined)row.provenanceDetails[key]=input[key];
      return {row,identity};
    });
    const content={schemaVersion:1,reportId,...(input.supersedesReportId?{supersedesReportId:input.supersedesReportId}:{}),date,provider:input.provider,...scope,...Object.fromEntries(runTimeKeys.filter(key=>input[key]!==undefined).map(key=>[key,input[key]])),entries:candidates.map(({row,identity})=>({identity,...Object.fromEntries([...reportEntryKeys].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]))}))};
    const namespace=automatic?'automatic\n'+automaticSourceId:user.id;
    const contentHash=createHash('sha256').update(stableJson(content)).digest('hex'),id=createHash('sha256').update(namespace+'\n'+input.provider+'\n'+reportId).digest('hex');
    assertSession?.();
    return store.transaction(()=>{
      assertSession?.();user=writable(user);if(automatic&&user.role!=='admin')throw fail('현재 관리자만 전용 문서의 공개 자료를 자동 반영할 수 있습니다.',403);const previous=store.get(REPORT_KIND,id);
      if(previous){
        if(previous.contentHash!==contentHash)throw fail('같은 보고서 ID의 내용이 달라졌습니다. 새 보고서 ID로 다시 가져와 주세요.',409);
        return {report:reportView(previous),entries:(previous.entryIds||[]).flatMap(entryId=>{const row=store.get(KIND,entryId);return row&&canRead(user,row)?[view(user,row)]:[];}),existing:true};
      }
      const superseded=input.supersedesReportId?store.get(REPORT_KIND,createHash('sha256').update(namespace+'\n'+input.provider+'\n'+input.supersedesReportId).digest('hex')):null;
      if(input.supersedesReportId&&(!superseded||superseded.status!=='imported'||superseded.visibility!==scope.visibility||superseded.teamId!==scope.teamId||superseded.date!==date||runTimeKeys.some(key=>superseded[key]!==input[key])||!candidates.length))throw fail('같은 작성 경로에서 접수된 기존 보고서와 원래 조사 시각을 확인해 주세요.',409);
      const acceptedReports=superseded?store.all(REPORT_KIND):[];
      // Validate every upsert and the complete capacity requirement before the first write.
      // The registry controls which documents can be read now. A completed,
      // accepted automatic company receipt proves a former writer's company
      // rows, so replacing that document does not orphan accepted history.
      // Private rows and arbitrary source tags never establish this trust.
      const historicalEntries=new Set(automatic?store.all(REPORT_KIND).filter(row=>row.visibility==='company'&&typeof row.automaticSourceId==='string'&&/^[A-Za-z0-9_-]{20,200}$/.test(row.automaticSourceId)).flatMap(row=>row.entryIds||[]):[]);
      const all=store.all(KIND),owned=all.filter(row=>row.ownerId===user.id),eligible=automatic?all.filter(row=>row.visibility==='company'&&(approvedSources.has(row.automaticSourceId)||row.automaticSourceId&&historicalEntries.has(row.id)||row.ownerId===user.id&&!row.automaticSourceId)):owned,writes=[],day=guideDay(kstDate(at)),initialGuideCount=day.entryIds.length,nonguideCounts=new Map();for(const row of all)if(!companyGuide(row))nonguideCounts.set(row.ownerId,(nonguideCounts.get(row.ownerId)||0)+1);let createdCount=0,updatedCount=0,retainedCount=0,deferredCount=0,deferredObservationCount=0,deferredGuideCount=0,guideSlots=GUIDE_CAPACITY-all.filter(companyGuide).length;
      const priority={high:0,medium:1,watch:2},evidence={'video-watched':0,'page-read':1,'metadata-only':2};
      const ordered=[...candidates].sort((a,b)=>(priority[a.row.research?.priority]??3)-(priority[b.row.research?.priority]??3)||(evidence[a.row.research?.evidenceLevel]??3)-(evidence[b.row.research?.evidenceLevel]??3)||b.row.checkedAt.localeCompare(a.row.checkedAt)||a.identity.localeCompare(b.identity));
      for(const {row:candidate,identity} of ordered){
        const old=eligible.filter(row=>{try{return researchIdentity(row)===identity;}catch{return false;}}).sort((a,b)=>(automatic?Number(b.automaticSourceId===automaticSourceId)-Number(a.automaticSourceId===automaticSourceId):0)||String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0];
        if(old&&!canEdit(user,old))throw fail('이 원문 자료를 현재 수정할 권한이 없습니다.',403);
        if(superseded){
          // Explicit corrections replace an accepted observation, never a newer
          // observation or another writer's coincidentally equal report ID.
          const provenance=old?.provenanceDetails,receipts=old?acceptedReports.filter(receipt=>receipt.entryIds?.includes(old.id)&&receipt.reportId===provenance?.reportId&&receipt.provider===provenance?.provider&&receipt.importedAt===provenance?.importedAt):[];
          if(!old||receipts.length!==1||receipts[0].id!==superseded.id||old.checkedAt!==candidate.checkedAt||old.visibility!==scope.visibility||old.teamId!==scope.teamId||runTimeKeys.some(key=>provenance?.[key]!==input[key])||!candidate.research?.productionGuide)throw fail('교정 대상이 새 조사로 바뀌었거나 접수된 제작 가이드와 일치하지 않습니다. 현재 원문과 보고서를 다시 확인해 주세요.',409);
          if(Date.parse(candidate.productionGuideCheckedAt)<Date.parse(old.productionGuideCheckedAt||old.researchCheckedAt||old.checkedAt))throw fail('더 오래된 확인 시각의 제작 가이드로 교정할 수 없습니다.',409);
          candidate.provenanceDetails.supersedesReportId=input.supersedesReportId;
        }
        if(old&&Date.parse(old.checkedAt)>Date.parse(candidate.checkedAt)){
          const adopted=automatic&&!old.automaticSourceId;let retained=adopted?{...old,automaticSourceId}:old,write=adopted;
          if(candidate.research?.productionGuide&&companyGuide(old)&&Date.parse(candidate.productionGuideCheckedAt)>=Date.parse(old.productionGuideCheckedAt||old.researchCheckedAt||old.checkedAt)&&({'video-watched':0,'page-read':1}[candidate.productionGuideEvidenceLevel]??2)<=({'video-watched':0,'page-read':1}[old.productionGuideEvidenceLevel||old.research.evidenceLevel]??2)){
            retained={...retained,research:{...old.research,productionGuide:candidate.research.productionGuide,applications:candidate.research.applications},productionGuideCheckedAt:candidate.productionGuideCheckedAt,productionGuideEvidenceLevel:candidate.productionGuideEvidenceLevel,updatedAt:at};write=true;updatedCount++;
          }
          if(candidate.research?.productionGuide&&old.visibility==='company'&&!companyGuide(old)){
            const promoted={...retained,research:candidate.research,researchCheckedAt:candidate.researchCheckedAt,productionGuideCheckedAt:candidate.productionGuideCheckedAt,productionGuideEvidenceLevel:candidate.productionGuideEvidenceLevel},shared=all.find(existing=>companyGuide(existing)&&guideIdentity(existing)===guideIdentity(promoted));
            if(shared){if(!canRead(user,shared))throw fail('이 원문의 회사 제작 가이드를 현재 열람할 수 없습니다.',404);writes.push({row:shared,write:false});retainedCount++;continue;}
            if(guideSlots<=0||quotaAdmission(promoted,old,day,at)===null){deferredCount++;deferredGuideCount++;}else{retained=promoted;write=true;guideSlots--;nonguideCounts.set(old.ownerId,Math.max(0,(nonguideCounts.get(old.ownerId)||0)-1));}
          }
          writes.push({row:retained,write});retainedCount++;continue;
        }
        let row=candidate;
        if(old){
          row={...candidate,id:old.id,ownerId:old.ownerId,createdAt:old.createdAt,visibility:old.visibility,teamId:old.teamId,status:old.status,archived:old.archived};
          if(automatic&&old.automaticSourceId)row.automaticSourceId=old.automaticSourceId;
          for(const key of ['productionGuideAddedAt','productionGuideAddedDate'])if(old[key])row[key]=old[key];
          for(const key of ['hook','structure','adaptation','note'])row[key]=old[key]||'';
          if(candidate.research===undefined&&old.research){row.research=old.research;row.researchCheckedAt=old.researchCheckedAt||old.checkedAt;}
          const weakerGuide=candidate.research?.productionGuide&&hasProductionGuide(old)&&(({'video-watched':0,'page-read':1}[candidate.productionGuideEvidenceLevel]??2)>({'video-watched':0,'page-read':1}[old.productionGuideEvidenceLevel||old.research.evidenceLevel]??2)||Date.parse(candidate.productionGuideCheckedAt)<Date.parse(old.productionGuideCheckedAt||old.researchCheckedAt||old.checkedAt));
          if((candidate.research===undefined||!candidate.research.productionGuide||weakerGuide&&!superseded)&&hasProductionGuide(old)&&concreteKinds.has(row.kind)){row.research={...row.research,productionGuide:old.research.productionGuide,applications:old.research.applications};row.productionGuideCheckedAt=old.productionGuideCheckedAt||old.researchCheckedAt||old.checkedAt;row.productionGuideEvidenceLevel=old.productionGuideEvidenceLevel||old.research.evidenceLevel;}
          if(automatic&&!old.automaticSourceId)row.provenanceDetails={...row.provenanceDetails,adoptedObservation:{provenance:old.provenance,checkedAt:old.checkedAt,provenanceDetails:old.provenanceDetails||null}};
          if(candidate.channelId===null&&old.channelId){channel(user,old.channelId,row.source,needsResearchChannel(row));row.channelId=old.channelId;}
        }
        if(companyGuide(row)){const duplicateGuide=all.find(existing=>existing.id!==row.id&&companyGuide(existing)&&guideIdentity(existing)===guideIdentity(row));if(duplicateGuide){if(!canRead(user,duplicateGuide))throw fail('이 원문의 회사 제작 가이드를 현재 열람할 수 없습니다.',404);writes.push({row:duplicateGuide,write:false});retainedCount++;continue;}}
        const newGuide=companyGuide(row)&&!companyGuide(old||{});
        if(newGuide&&(guideSlots<=0||quotaAdmission(row,old,day,at)===null)){deferredCount++;deferredGuideCount++;if(old){const adopted=automatic&&!old.automaticSourceId;writes.push({row:adopted?{...old,automaticSourceId}:old,write:adopted});retainedCount++;}continue;}
        // Automatic metadata observations have their own admission decision.
        // A full personal/reference shelf cannot reject usable guides in the
        // same completed report. Manual imports retain all-or-nothing limits.
        if(automatic&&!companyGuide(row)&&!old){if((nonguideCounts.get(row.ownerId)||0)>=500){deferredCount++;deferredObservationCount++;continue;}nonguideCounts.set(row.ownerId,(nonguideCounts.get(row.ownerId)||0)+1);}
        if(newGuide&&old&&!companyGuide(old))nonguideCounts.set(old.ownerId,Math.max(0,(nonguideCounts.get(old.ownerId)||0)-1));
        if(newGuide)guideSlots--;else if(companyGuide(old||{})&&!companyGuide(row))guideSlots++;
        if(old){updatedCount++;if(old.archived)retainedCount++;}else createdCount++;
        writes.push({row,write:true});
      }
      const planned=new Map(all.map(row=>[row.id,row]));for(const {row,write}of writes)if(write)planned.set(row.id,row);assertCapacity([...planned.values()]);
      for(const {row,write} of writes)if(write)store.put(KIND,row.id,row);
      if(day.entryIds.length||deferredGuideCount||!automatic&&deferredCount){day.deferredCount=(day.deferredCount||0)+(automatic?deferredGuideCount:deferredCount);store.put(GUIDE_DAYS,day.date,day);}
      const report={id,ownerId:user.id,...scope,...(automatic?{automaticSourceId,deferredObservationCount,deferredGuideCount}:{}),...(hasProducerMetadata?{originalInputHash,publicationDateNormalizationCount:publicationDates.size,publicationDateNormalizations:[...publicationDates].map(([entryIndex,publishedDate])=>({entryIndex,publishedDate}))}:{}),reportId,date,provider:input.provider,status:candidates.length?'imported':'empty',checkedAt:candidates.length?candidates.map(({row})=>row.checkedAt).sort().at(-1):null,importedAt:at,createdCount,updatedCount,retainedCount,itemCount:candidates.length,acceptedCount:candidates.length-deferredCount,deferredCount,addedGuideCount:day.entryIds.length-initialGuideCount,entryIds:[...new Set(writes.map(({row})=>row.id))],contentHash};
      for(const key of runTimeKeys)if(input[key]!==undefined)report[key]=input[key];
      if(input.supersedesReportId)report.supersedesReportId=input.supersedesReportId;
      store.put(REPORT_KIND,id,report);
      return {report:reportView(report),entries:writes.map(({row})=>view(user,row)),existing:false};
    });
  }
  function capacity(user){if(store.all(KIND).filter(row=>row.ownerId===user.id&&!companyGuide(row)).length>=500)throw fail('한 직원은 개인 자료와 일반 참고 자료를 최대 500개까지 보관할 수 있습니다.',409);}
  function duplicate(user,row){if(row.source!=='tiktok-top-ads')return null;const id=/\/topads\/(\d+)\//.exec(row.sourceUrl)?.[1];return store.all(KIND).find(existing=>existing.ownerId===user.id&&existing.source===row.source&&!existing.archived&&canRead(user,existing)&&/\/topads\/(\d+)\//.exec(existing.sourceUrl)?.[1]===id)||null;}
  function add(user,input){user=writable(user);const row=normalized(user,input),existing=duplicate(user,row);if(existing)return {entry:view(user,existing),existing:true};capacity(user);store.put(KIND,row.id,row);return {entry:view(user,row)};}
  function update(user,id,input){user=writable(user);return store.transaction(()=>{user=writable(user);const old=find(user,id);if(!canEdit(user,old))throw fail('이 참고 자료를 수정할 권한이 없습니다.',403);const row=normalized(user,input,old),at=instant(clock()),day=guideDay(kstDate(at)),all=store.all(KIND);if(companyGuide(row)&&all.some(existing=>existing.id!==row.id&&companyGuide(existing)&&guideIdentity(existing)===guideIdentity(row)))throw fail('같은 원문의 회사 제작 가이드를 중복으로 등록할 수 없습니다.',409);if(quotaAdmission(row,old,day,at)===null)throw fail('오늘 새로 등록할 회사 제작 가이드 10개를 모두 채웠습니다.',409);assertCapacity(all.map(existing=>existing.id===row.id?row:existing));store.put(KIND,row.id,row);if(day.entryIds.length)store.put(GUIDE_DAYS,day.date,day);return {entry:view(user,row)};});}
  function archive(user,id,input={archived:true}){object(input);return update(user,id,{archived:input.archived??true});}
  function emptyUsageInput(input){object(input);if(Object.keys(input).length)throw fail('가이드 선택·해제는 빈 요청으로 보내 주세요.');}
  function claim(user,id,input={}){
    user=writable(user);emptyUsageInput(input);return store.transaction(()=>{user=writable(user);const row=find(user,id);if(!productionReady(row))throw fail('현재 공유된 준비 가이드만 선택할 수 있습니다.',409);const saved=usageFor(row);if(saved&&saved.userId!==user.id)throw fail('다른 직원이 이미 사용 중인 가이드입니다.',409);if(!saved)usagePut.run(row.id,guideIdentity(row),user.id,instant(clock()));return {entry:view(user,row)};});
  }
  function release(user,id,input={}){
    user=writable(user);emptyUsageInput(input);return store.transaction(()=>{user=writable(user);id=text(id,100,'자료 ID',true);const direct=usageGet.get(id),stored=store.get(KIND,id);if(direct?.userId===user.id&&(!stored||!canRead(user,stored))){usageRemove.run(id);return {entry:{id,productionReady:false,usage:{status:'available',canClaim:false,canRelease:false,isMine:false}}};}const row=find(user,id),saved=usageFor(row);if(saved&&saved.userId!==user.id&&user.role!=='admin')throw fail('본인이 선택한 가이드만 해제할 수 있습니다.',403);if(row.visibility!=='company'&&user.role!=='admin'&&saved?.userId!==user.id)throw fail('공유된 가이드의 선택 상태만 변경할 수 있습니다.',403);if(saved)usageRemove.run(saved.entryId);return {entry:view(user,row)};});
  }
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
  const notify=()=>{try{onChanged?.();}catch{}};
  const mutation=operation=>(...args)=>{const result=operation(...args);if(result?.then)return result.then(value=>{notify();return value;});notify();return result;};
  return {workspace,revision,reportVisible,add:mutation(add),importTopAd:mutation(importTopAd),importReport:mutation(importReport),update:mutation(update),archive:mutation(archive),claim:mutation(claim),release:mutation(release),waitForIdle,stop};
}
