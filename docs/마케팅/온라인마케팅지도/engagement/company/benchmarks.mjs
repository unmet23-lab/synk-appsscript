import { randomUUID } from 'node:crypto';

const DAY=86400000,MAX_BYTES=100*1024,KIND='contentBenchmarkIssues';
const metricKeys=['views','likes','comments','shares','saves','followers'];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const kstDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function plain(value,max,label,required=true){
  if(value==null&&!required)return '';
  if(typeof value!=='string'||value.length>max)throw fail(`${label}: ${max}자 이내의 문자열을 입력해 주세요.`);
  const result=value.replace(/<[^>]*>/g,'').replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\r\n?/g,'\n').trim();
  if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;
}
function calendar(value,label){
  const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match||Number(match[2])<1||Number(match[2])>12||Number(match[3])<1||Number(match[3])>new Date(Date.UTC(Number(match[1]),Number(match[2]),0)).getUTCDate())throw fail(`${label}: YYYY-MM-DD 형식의 실제 날짜를 입력해 주세요.`);
  return value;
}
function instant(value,label){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw fail(`${label}: 시간대가 포함된 ISO 날짜·시간을 입력해 주세요.`);
  calendar(value.slice(0,10),label);return new Date(value).toISOString();
}
function published(value){if(typeof value==='string'&&value.length===10){const day=calendar(value,'게시일');return {value:day,day,ms:Date.parse(day+'T00:00:00+09:00')};}const at=instant(value,'게시일');return {value:at,day:kstDay(at),ms:Date.parse(at)};}

export function normalizeBenchmarkUrl(value){
  if(typeof value!=='string'||value.length>1000||/[\s\\]/.test(value))throw fail('벤치마크 콘텐츠 주소를 확인해 주세요.');
  let url;try{url=new URL(value);}catch{throw fail('HTTPS 콘텐츠 주소를 입력해 주세요.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw fail('HTTPS 공식 플랫폼 콘텐츠 주소만 사용할 수 있습니다.');
  const host=url.hostname.toLowerCase(),path=url.pathname;let match;
  if(['instagram.com','www.instagram.com'].includes(host)&&(match=/^\/reel\/([A-Za-z0-9_-]{1,100})\/?$/.exec(path)))return {platform:'instagram',url:`https://www.instagram.com/reel/${match[1]}/`,identity:'instagram:'+match[1]};
  if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)){
    if(path==='/watch'&&url.searchParams.getAll('v').length===1&&/^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v')))return {platform:'youtube',url:`https://www.youtube.com/watch?v=${url.searchParams.get('v')}`,identity:'youtube:'+url.searchParams.get('v')};
    if((match=/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(path)))return {platform:'youtube',url:`https://www.youtube.com/shorts/${match[1]}`,identity:'youtube:'+match[1]};
  }
  if(host==='youtu.be'&&(match=/^\/([A-Za-z0-9_-]{11})\/?$/.exec(path)))return {platform:'youtube',url:`https://www.youtube.com/watch?v=${match[1]}`,identity:'youtube:'+match[1]};
  if(['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(host)&&(match=/^\/@([A-Za-z0-9._]{1,40})\/video\/(\d{5,30})\/?$/.exec(path)))return {platform:'tiktok',url:`https://www.tiktok.com/@${match[1]}/video/${match[2]}`,identity:'tiktok:'+match[2]};
  if(['facebook.com','www.facebook.com','m.facebook.com'].includes(host)&&(match=/^\/reel\/(\d{5,30})\/?$/.exec(path)))return {platform:'facebook',url:`https://www.facebook.com/reel/${match[1]}`,identity:'facebook:'+match[1]};
  throw fail('Instagram 릴스, YouTube 동영상·Shorts, TikTok 동영상, Facebook 릴스 주소만 사용할 수 있습니다.');
}

export function normalizeBenchmarkReport(input,{now=new Date().toISOString(),seriesIds=[]}={}){
  let encoded;try{encoded=typeof input==='string'?input:JSON.stringify(input);}catch{throw fail('보고서를 JSON 형식으로 입력해 주세요.');}
  if(typeof encoded!=='string'||Buffer.byteLength(encoded,'utf8')>MAX_BYTES)throw fail('보고서는 UTF-8 기준 100KiB 이하 JSON이어야 합니다.',413);
  let value;try{value=typeof input==='string'?JSON.parse(input):input;}catch{throw fail('보고서 JSON 문법을 확인해 주세요.');}
  if(!record(value)||value.version!==1)throw fail('보고서 version은 1이어야 합니다.');
  const at=instant(now,'현재 시각'),periodStart=calendar(value.periodStart,'조사 기간 시작'),periodEnd=calendar(value.periodEnd,'조사 기간 종료'),researchedAt=instant(value.researchedAt,'조사 시각');
  const span=(Date.parse(periodEnd)-Date.parse(periodStart))/DAY+1;
  if(span<1||span>30)throw fail('조사 기간은 양 끝 날짜를 포함해 1~30일이어야 합니다.');
  if(Date.parse(researchedAt)>Date.parse(at)||periodEnd>kstDay(researchedAt))throw fail('조사 시각과 조사 기간에 미래 날짜를 사용할 수 없습니다.');
  if(!Array.isArray(value.items)||value.items.length<1||value.items.length>5)throw fail('실제 근거가 있는 항목을 1~5개 입력해 주세요.');
  if(!Number.isSafeInteger(value.candidateCount)||value.candidateCount<value.items.length)throw fail('검토한 후보 수는 선정 항목 수 이상의 정수여야 합니다.');
  const knownSeries=new Set(seriesIds),seen=new Set();
  const items=value.items.map((item,index)=>{
    if(!record(item))throw fail(`${index+1}번째 항목 형식을 확인해 주세요.`);
    const link=normalizeBenchmarkUrl(item.url);
    if(item.platform!==link.platform)throw fail(`${index+1}번째 항목의 플랫폼과 주소가 다릅니다.`);
    if(seen.has(link.identity))throw fail('같은 콘텐츠를 두 번 선정할 수 없습니다.');seen.add(link.identity);
    if(item.rank!=null&&item.rank!==index+1)throw fail('순위는 배열 순서대로 1부터 연속으로 입력해 주세요.');
    const pub=published(item.publishedAt),checkedAt=instant(item.checkedAt,'원문 확인 시각');
    if(pub.day<periodStart||pub.day>periodEnd)throw fail('각 콘텐츠의 게시일은 조사 기간 안에 있어야 합니다.');
    if(pub.ms>Date.parse(checkedAt)||Date.parse(checkedAt)>Date.parse(researchedAt)||Date.parse(checkedAt)>Date.parse(at))throw fail('원문 확인은 게시 후, 조사 시각 이전의 실제 시각이어야 합니다.');
    if(!record(item.metrics))throw fail('확인한 반응 수를 metrics에 입력해 주세요.');
    const metrics=Object.fromEntries(metricKeys.map(key=>{const number=item.metrics[key];if(number!=null&&(!Number.isSafeInteger(number)||number<0))throw fail('확인한 수치는 0 이상의 정수, 모르는 수치는 null로 입력해 주세요.');return [key,number??null];}));
    if(!metricKeys.slice(0,-1).some(key=>metrics[key]>0))throw fail('조회·좋아요·댓글·공유·저장 중 확인한 양수 지표가 최소 하나 있어야 합니다. 팔로워 수만으로 게시물 반응을 판단하지 마세요.');
    if(item.seriesIds!=null&&(!Array.isArray(item.seriesIds)||item.seriesIds.length>10||item.seriesIds.some(id=>typeof id!=='string'||!knownSeries.has(id))))throw fail('추천 시리즈 ID를 회사 시리즈 목록에서 선택해 주세요.');
    return {id:`item-${index+1}`,rank:index+1,title:plain(item.title,200,'콘텐츠 제목'),...{url:link.url,platform:link.platform},creator:plain(item.creator,100,'작성자'),publishedAt:pub.value,checkedAt,metrics,evidenceNote:plain(item.evidenceNote,1000,'원문과 수치 확인 근거'),hook:plain(item.hook,1000,'도입'),structure:plain(item.structure,2000,'전개 구조'),payoff:plain(item.payoff,1000,'정보·재미 보상'),brandFit:plain(item.brandFit,1000,'회사 기준과의 관련성'),adaptation:plain(item.adaptation,2000,'우리 콘텐츠로 바꿀 방법'),seriesIds:[...new Set(item.seriesIds||[])]};
  });
  const report={version:1,title:plain(value.title,160,'보고서 제목'),scope:plain(value.scope,300,'조사 범위'),periodStart,periodEnd,researchedAt,candidateCount:value.candidateCount,selectionBasis:plain(value.selectionBasis,1000,'선정 기준'),items};
  const warnings=['조사 범위에서 관리자가 선정한 참고 자료입니다. 세계·플랫폼 전체 순위나 독립적인 사실 검증 결과를 뜻하지 않습니다.'];
  if(items.length<5)warnings.push(`근거가 있는 ${items.length}/5개만 선정했습니다. 빈 순위를 임의 수치로 채우지 마세요.`);
  if(Date.parse(at)-Date.parse(researchedAt)>=7*DAY)warnings.push('조사 후 7일 이상 지났습니다. 현재 반응과 적용 가능성을 다시 확인해 주세요.');
  return {report,warnings};
}

export function createBenchmarkService({store,clock=()=>new Date().toISOString(),seriesIds=[]}){
  function authenticated(user){const saved=user?.id&&store.get('users',user.id);if(!saved?.active)throw fail('먼저 로그인해 주세요.',401);return saved;}
  function administrator(user){user=authenticated(user);if(user.role!=='admin')throw fail('관리자만 벤치마크 보고서를 등록할 수 있습니다.',403);return user;}
  function withAge(issue){const ageDays=Math.max(0,Math.floor((Date.parse(clock())-Date.parse(issue.researchedAt))/DAY));return {...issue,ageDays,stale:ageDays>=7};}
  function detail(user,id){authenticated(user);if(typeof id!=='string'||id.length>100)throw fail('벤치마크 보고서를 찾을 수 없습니다.',404);const issue=store.get(KIND,id);if(!issue)throw fail('벤치마크 보고서를 찾을 수 없습니다.',404);return {issue:withAge(issue)};}
  function workspace(user){
    authenticated(user);
    const rows=store.db.prepare(`SELECT id, json_extract(body,'$.title') AS title,
      json_extract(body,'$.scope') AS scope, json_extract(body,'$.periodStart') AS periodStart,
      json_extract(body,'$.periodEnd') AS periodEnd, json_extract(body,'$.researchedAt') AS researchedAt,
      json_extract(body,'$.candidateCount') AS candidateCount, json_extract(body,'$.selectionBasis') AS selectionBasis,
      json_extract(body,'$.publishedAt') AS publishedAt, json_extract(body,'$.publishedByName') AS publishedByName,
      json_array_length(body,'$.items') AS itemCount FROM documents WHERE kind=? ORDER BY rowid DESC`).all(KIND);
    return {current:rows.length?detail(user,rows[0].id).issue:null,history:rows.map(withAge)};
  }
  function preview(user,input){administrator(user);if(!record(input))throw fail('보고서를 입력해 주세요.');return normalizeBenchmarkReport(input.report,{now:clock(),seriesIds});}
  function publish(user,input){
    user=administrator(user);if(!record(input)||input.reviewConfirmed!==true)throw fail('원문과 수치를 검토하고 회사 공유를 확인해 주세요.');
    const {report,warnings}=normalizeBenchmarkReport(input.report,{now:clock(),seriesIds});
    const issue={...report,id:randomUUID(),publishedAt:clock(),publishedByName:plain(user.name,80,'등록자',false)||'관리자',publishedBy:user.id,evidenceStatus:'admin-submitted',source:'manual-research'};
    store.put(KIND,issue.id,issue);return {issue:withAge(issue),warnings};
  }
  function resolve(user,id,itemId){const {issue}=detail(user,id);if(typeof itemId!=='string'||itemId.length>100)throw fail('선정 콘텐츠를 찾을 수 없습니다.',404);const item=issue.items.find(row=>row.id===itemId);if(!item)throw fail('이 보고서의 선정 콘텐츠를 선택해 주세요.',404);return {issue,item};}
  return {workspace,detail,preview,publish,resolve};
}
