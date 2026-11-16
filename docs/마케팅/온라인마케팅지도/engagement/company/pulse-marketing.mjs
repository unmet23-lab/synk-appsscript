// PULSE 고객 앱 「마케팅 성과」 칸의 저장과 꼴 검사(2026-11-16). 설계는 docs/마케팅/PULSE_마케팅성과_20261116/서버_설계.md이고, 화면과 주고받는 꼴은 같은 폴더의 계약.md에 있다.
// 직원이 올린 리포트를 프로젝트마다 둔다. 고객은 자기 프로젝트의 리포트를 읽기만 한다. 서버는 재지 않는다.
// 저장은 범용 표 documents의 종류 둘이다. 색인(pulseMarketingIndex)은 프로젝트마다 한 문서이고, 리포트 몸통(pulseMarketingReports)은 한 건마다 한 문서다.
// 프로젝트 문서(clientProjects)는 건드리지 않는다. 그래서 올려도 프로젝트 판 번호(revision)가 오르지 않는다.
// 프로젝트 문서를 지우는 운영 경로를 새로 만들면 이 두 종류도 함께 지워야 한다(README.md).
export const PULSE_MARKETING_INDEX='pulseMarketingIndex';
export const PULSE_MARKETING_REPORTS='pulseMarketingReports';
export const MARKETING_KINDS=Object.freeze(['ai-search','competitor-ads','label-review','memo']);
// reports는 한 프로젝트의 리포트 상한이고, chars는 정규화한 리포트를 JSON으로 적은 길이의 상한이다.
export const MARKETING_LIMITS=Object.freeze({reports:120,chars:300000});

const ID=/^[A-Za-z0-9_-]{1,40}$/,RUN_ID=/^[0-9A-Za-z][0-9A-Za-z-]{0,39}$/,AD_ID=/^\d{5,24}$/,HOST=/^[a-z0-9.-]{1,100}$/;
const TIME=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,DAY=/^\d{4}-\d{2}-\d{2}$/;
// 막는 문자: 제어 문자(줄바꿈 · 탭 포함), C1 제어 문자, 줄 · 문단 구분자, 방향 덮어쓰기. 폭 없는 문자(U+200B~200D)는 실제 광고 본문에 있어 받는다.
const BLOCKED=new RegExp('['+[[0x00,0x1f],[0x7f,0x9f],[0x2028,0x2029],[0x202a,0x202e],[0x2066,0x2069]].map(([from,to])=>String.fromCharCode(from)+'-'+String.fromCharCode(to)).join('')+']');
const VERDICTS=Object.freeze(['hit','check','ok','na','norecord','unread']);
const COMMON=['kind','version','runId','title','measuredAt','notes'];
const FIELDS={'ai-search':['subject','services','questions','cells'],'competitor-ads':['method','competitors','changes'],'label-review':['checklist','items'],memo:['headline','body','nextActions']};

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
// 꼴 검사의 오류는 직원이 올릴 때만 난다. 어느 칸이 틀렸는지 문장에 넣어 고쳐 올리기 쉽게 한다.
const bad=path=>Object.assign(new Error(`리포트의 ${path} 칸을 확인해 주세요.`),{status:400,field:path});
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const at=(path,key)=>path?`${path}.${key}`:key;

// 아는 칸만 받는다. 빠진 칸도, 모르는 칸도 400이다. optional은 있어도 되고 없어도 되는 칸이다.
function record(value,path,keys,optional=[]){
  if(!isObject(value))throw bad(path);
  for(const key of Object.keys(value))if(!keys.includes(key)&&!optional.includes(key))throw bad(at(path,key));
  for(const key of keys)if(!Object.hasOwn(value,key))throw bad(at(path,key));
  return value;
}
// 평문: 앞뒤 공백을 떼고 글자(코드 포인트) 수를 센다. empty가 참이면 빈 글을 받는다.
function text(value,path,max,empty=false){
  if(typeof value!=='string'||BLOCKED.test(value)||!value.isWellFormed())throw bad(path);
  const out=value.trim(),size=[...out].length;
  if(size>max||!empty&&!size)throw bad(path);
  return out;
}
function list(value,path,min,max){if(!Array.isArray(value)||value.length<min||value.length>max)throw bad(path);return value;}
function lines(value,path,min,max,chars){return list(value,path,min,max).map((item,i)=>text(item,`${path}[${i}]`,chars));}
function integer(value,path,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)throw bad(path);return value;}
function bool(value,path){if(typeof value!=='boolean')throw bad(path);return value;}
function pattern(value,path,rule){if(typeof value!=='string'||!rule.test(value))throw bad(path);return value;}
// UTC ISO 시각: 꼴을 먼저 보고, 실제 있는 시각인지 Date.parse 값을 되돌려 견준다.
function time(value,path){
  pattern(value,path,TIME);const ms=Date.parse(value);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==value.slice(0,19))throw bad(path);
  return value;
}
function day(value,path){
  pattern(value,path,DAY);const ms=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)throw bad(path);
  return value;
}
function unique(values,path){const seen=new Set();values.forEach((value,i)=>{if(seen.has(value))throw bad(`${path}[${i}]`);seen.add(value);});}

function measured(value){
  record(value,'measuredAt',['from','to']);
  const from=time(value.from,'measuredAt.from'),to=time(value.to,'measuredAt.to');
  if(Date.parse(from)>Date.parse(to))throw bad('measuredAt');
  return {from,to};
}
function aiSearch(input){
  record(input.subject,'subject',['brand','site']);
  const subject={brand:text(input.subject.brand,'subject.brand',60),site:pattern(input.subject.site,'subject.site',HOST)};
  const services=list(input.services,'services',1,10).map((item,i)=>{const p=`services[${i}]`;record(item,p,['id','name','condition']);return {id:pattern(item.id,p+'.id',ID),name:text(item.name,p+'.name',40),condition:text(item.condition,p+'.condition',60,true)};});
  unique(services.map(item=>item.id),'services');
  const questions=list(input.questions,'questions',1,60).map((item,i)=>{const p=`questions[${i}]`;record(item,p,['id','group','lang','text','branded']);return {id:pattern(item.id,p+'.id',ID),group:text(item.group,p+'.group',24),lang:text(item.lang,p+'.lang',8),text:text(item.text,p+'.text',300),branded:bool(item.branded,p+'.branded')};});
  unique(questions.map(item=>item.id),'questions');
  const known={q:new Set(questions.map(item=>item.id)),s:new Set(services.map(item=>item.id))},pairs=new Set();
  const cells=list(input.cells,'cells',0,400).map((item,i)=>{
    const p=`cells[${i}]`;record(item,p,['q','s','answered','mentioned','cited','sources','aiBriefing','excerpt','ms']);
    if(typeof item.q!=='string'||!known.q.has(item.q))throw bad(p+'.q');
    if(typeof item.s!=='string'||!known.s.has(item.s))throw bad(p+'.s');
    const pair=item.q+'\u0000'+item.s;if(pairs.has(pair))throw bad(p);pairs.add(pair);
    const answered=bool(item.answered,p+'.answered'),mentioned=bool(item.mentioned,p+'.mentioned'),cited=bool(item.cited,p+'.cited');
    const sources=list(item.sources,p+'.sources',0,12).map((host,j)=>pattern(host,`${p}.sources[${j}]`,HOST));unique(sources,p+'.sources');
    if(item.aiBriefing!==null&&typeof item.aiBriefing!=='boolean')throw bad(p+'.aiBriefing');
    // 답 없음 칸에는 언급 · 인용 · 출처가 있을 수 없다. 그때 화면에 뜬 글(excerpt)은 남아 있어도 된다.
    if(!answered&&(mentioned||cited||sources.length))throw bad(p+'.answered');
    return {q:item.q,s:item.s,answered,mentioned,cited,sources,aiBriefing:item.aiBriefing,excerpt:text(item.excerpt,p+'.excerpt',400,true),ms:integer(item.ms,p+'.ms',0,600000)};
  });
  return {subject,services,questions,cells};
}
function ads(value,path){
  return list(value,path,0,60).map((item,i)=>{
    const p=`${path}[${i}]`;record(item,p,['id','startedAt','advertiser','text','multiVariant']);
    return {id:pattern(item.id,p+'.id',AD_ID),startedAt:item.startedAt===null?null:day(item.startedAt,p+'.startedAt'),advertiser:text(item.advertiser,p+'.advertiser',80,true),text:text(item.text,p+'.text',220,true),multiVariant:bool(item.multiVariant,p+'.multiVariant')};
  });
}
function competitorAds(input){
  const method=text(input.method,'method',200);
  const competitors=list(input.competitors,'competitors',1,12).map((item,i)=>{
    const p=`competitors[${i}]`;record(item,p,['name','query','resultLabel','read','own','reliable','note','ads']);
    const name=text(item.name,p+'.name',60),query=text(item.query,p+'.query',80),resultLabel=text(item.resultLabel,p+'.resultLabel',24,true);
    // own은 읽은 광고 가운데 그 회사 것의 수다. ads에는 일부만 싣기 때문에 ads의 건수와 같을 필요는 없다.
    const read=integer(item.read,p+'.read',0,100000),own=integer(item.own,p+'.own',0,100000);if(own>read)throw bad(p+'.own');
    return {name,query,resultLabel,read,own,reliable:bool(item.reliable,p+'.reliable'),note:text(item.note,p+'.note',300,true),ads:ads(item.ads,p+'.ads')};
  });
  let changes=null;
  if(input.changes!==null){
    record(input.changes,'changes',['since','started','stopped','longRunning']);
    changes={since:pattern(input.changes.since,'changes.since',RUN_ID),started:ads(input.changes.started,'changes.started'),stopped:ads(input.changes.stopped,'changes.stopped'),longRunning:ads(input.changes.longRunning,'changes.longRunning')};
  }
  return {method,competitors,changes};
}
function labelReview(input){
  const checklist=list(input.checklist,'checklist',1,12).map((item,i)=>{const p=`checklist[${i}]`;record(item,p,['id','title']);return {id:integer(item.id,p+'.id',1,99),title:text(item.title,p+'.title',40)};});
  unique(checklist.map(item=>item.id),'checklist');
  const checks=new Set(checklist.map(item=>item.id));
  const items=list(input.items,'items',0,60).map((item,i)=>{
    const p=`items[${i}]`;record(item,p,['title','venue','publishedAt','verdicts','findings']);
    // publishedAt은 날짜가 아니라 평문이다(실제 기록이 「11-08 공개, 11-10 진열」 같은 글이다).
    const title=text(item.title,p+'.title',80),venue=text(item.venue,p+'.venue',60,true),publishedAt=text(item.publishedAt,p+'.publishedAt',60,true);
    const verdicts=list(item.verdicts,p+'.verdicts',checklist.length,checklist.length).map((value,j)=>{if(!VERDICTS.includes(value))throw bad(`${p}.verdicts[${j}]`);return value;});
    const findings=list(item.findings,p+'.findings',0,12).map((finding,j)=>{
      const q=`${p}.findings[${j}]`;record(finding,q,['check','verdict','quote','why']);
      if(!checks.has(finding.check))throw bad(q+'.check');
      if(finding.verdict!=='hit'&&finding.verdict!=='check')throw bad(q+'.verdict');
      return {check:finding.check,verdict:finding.verdict,quote:text(finding.quote,q+'.quote',300,true),why:text(finding.why,q+'.why',300,true)};
    });
    return {title,venue,publishedAt,verdicts,findings};
  });
  return {checklist,items};
}
function memo(input){return {headline:text(input.headline,'headline',160),body:lines(input.body,'body',1,6,600),nextActions:lines(input.nextActions,'nextActions',0,3,160)};}
const BUILD={'ai-search':aiSearch,'competitor-ads':competitorAds,'label-review':labelReview,memo};

// 서버가 다시 세는 값(계약.md 「서버가 다시 세는 값」). 올린 summary는 읽지 않는다.
// 일반 칸은 branded가 false인 질문의 칸이고 브랜드 칸은 그 나머지다. avgMs는 그 서비스의 모든 칸(답 없음 포함)의 평균을 반올림한다.
// 칸이 하나도 없는 서비스의 avgMs는 0으로 둔다.
function aiSearchSummary({questions,services,cells}){
  const branded=new Map(questions.map(item=>[item.id,item.branded])),zero=()=>({total:0,answered:0,mentioned:0,cited:0});
  const general=zero(),brand=zero(),hosts=new Map();
  const rows=new Map(services.map(item=>[item.id,{s:item.id,generalTotal:0,generalAnswered:0,generalMentioned:0,generalCited:0,brandedTotal:0,brandedAnswered:0,brandedCited:0,sum:0,count:0}]));
  for(const cell of cells){
    const isBranded=branded.get(cell.q)!==false,bucket=isBranded?brand:general,row=rows.get(cell.s);
    bucket.total++;if(cell.answered)bucket.answered++;if(cell.mentioned)bucket.mentioned++;if(cell.cited)bucket.cited++;
    row.sum+=cell.ms;row.count++;
    if(isBranded){row.brandedTotal++;if(cell.answered)row.brandedAnswered++;if(cell.cited)row.brandedCited++;continue;}
    row.generalTotal++;if(cell.answered)row.generalAnswered++;if(cell.mentioned)row.generalMentioned++;if(cell.cited)row.generalCited++;
    for(const host of cell.sources)hosts.set(host,(hosts.get(host)||0)+1);
  }
  const byService=[...rows.values()].map(({sum,count,...row})=>({...row,avgMs:count?Math.round(sum/count):0}));
  // topSources: 일반 칸의 출처만, 건수가 많은 순, 같으면 호스트 이름순으로 15곳.
  const topSources=[...hosts].map(([host,count])=>({host,count})).sort((a,b)=>b.count-a.count||(a.host<b.host?-1:a.host>b.host?1:0)).slice(0,15);
  return {general,branded:brand,byService,topSources};
}
// label-review의 hit · check · norecord · unread는 편 수가 아니라 판정 칸의 수다.
function labelSummary({items}){
  const out={items:items.length,hit:0,check:0,norecord:0,unread:0};
  for(const item of items)for(const verdict of item.verdicts)if(['hit','check','norecord','unread'].includes(verdict))out[verdict]++;
  return out;
}

// 받은 것을 믿지 않고 아는 칸만 골라 새 객체를 짓는다. 검사를 통과한 것만 저장한다.
export function normalizeReport(input){
  if(!isObject(input))throw fail('올릴 리포트를 확인해 주세요.');
  if(!MARKETING_KINDS.includes(input.kind))throw bad('kind');
  record(input,'',[...COMMON,...FIELDS[input.kind]],['summary']);
  if(input.version!==1)throw bad('version');
  const report={kind:input.kind,version:1,runId:pattern(input.runId,'runId',RUN_ID),title:text(input.title,'title',80),measuredAt:measured(input.measuredAt),notes:lines(input.notes,'notes',0,8,300),...BUILD[input.kind](input)};
  if(report.kind==='ai-search')report.summary=aiSearchSummary(report);
  if(report.kind==='label-review')report.summary=labelSummary(report);
  if(JSON.stringify(report).length>MARKETING_LIMITS.chars)throw fail('리포트가 너무 커요. JSON으로 30만 자 아래가 되게 줄여 주세요.',413);
  return report;
}
// ReportHead.summaryLine: 종류마다 정한 한국어 문장이다(계약.md 표). 고객 방의 틀 글과 같은 말투(해요체)로 쓴다.
export function summaryLineOf(report){
  if(report.kind==='ai-search')return `일반 질문에 받은 답 ${report.summary.general.answered}건 가운데 ${report.subject.brand} 언급 ${report.summary.general.mentioned}건`;
  if(report.kind==='competitor-ads')return `경쟁사 ${report.competitors.length}곳의 켜진 광고를 읽었어요`;
  if(report.kind==='label-review')return `${report.summary.items}편을 봤어요. 걸림 ${report.summary.hit}건, 확인 필요 ${report.summary.check}건`;
  return report.headline;
}
const headOf=report=>({kind:report.kind,runId:report.runId,title:report.title,measuredAt:{from:report.measuredAt.from,to:report.measuredAt.to},summaryLine:summaryLineOf(report)});
// 고객에게 주는 머리에는 올린 때와 올린 사람을 싣지 않는다. 직원에게는 둘을 더한다.
const customerHead=head=>({kind:head.kind,runId:head.runId,title:head.title,measuredAt:{from:head.measuredAt.from,to:head.measuredAt.to},summaryLine:head.summaryLine});
const staffHead=head=>({...customerHead(head),uploadedAt:head.uploadedAt,uploadedBy:head.uploadedBy});
const sameRun=(kind,runId)=>head=>head.kind===kind&&head.runId===runId;
const reportId=(projectId,kind,runId)=>`${projectId}:${kind}:${runId}`;
// 시각은 글자가 아니라 Date.parse 값으로 견준다(밀리초가 있는 값과 없는 값이 섞인다). 끝까지 같으면 종류와 회차 이름순으로 둔다.
const order=(a,b)=>Date.parse(b.measuredAt.to)-Date.parse(a.measuredAt.to)||Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt)||(a.kind<b.kind?-1:a.kind>b.kind?1:0)||(a.runId<b.runId?-1:a.runId>b.runId?1:0);
const goodHead=head=>isObject(head)&&MARKETING_KINDS.includes(head.kind)&&typeof head.runId==='string'&&RUN_ID.test(head.runId)&&typeof head.title==='string'&&isObject(head.measuredAt)&&typeof head.measuredAt.from==='string'&&typeof head.measuredAt.to==='string'&&typeof head.summaryLine==='string'&&typeof head.uploadedAt==='string';

export function createPulseMarketing({store,clientProjects,features,clock=()=>new Date().toISOString()}){
  if(!store||!clientProjects||!features)throw new TypeError('마케팅 성과 설정이 이상해요.');
  const enabled=()=>features.read().marketing===true;
  // 색인 읽기. 문서가 없으면 빈 목록이다. 깨져 있으면(객체가 아니거나 heads가 배열이 아니거나 머리 하나라도 꼴이 틀리면) 닫힌 쪽으로 읽는다.
  // 읽기는 빈 목록으로, 쓰기는 409로 막는다. 읽지 못한 목록을 덮어써서 남은 리포트를 잃지 않게 한다.
  function indexOf(projectId){
    const doc=typeof projectId==='string'&&projectId?store.get(PULSE_MARKETING_INDEX,projectId):null;
    if(doc==null)return {heads:[],broken:false};
    if(!isObject(doc)||doc.projectId!==projectId||!Array.isArray(doc.heads)||!doc.heads.every(goodHead))return {heads:[],broken:true};
    return {heads:doc.heads,broken:false};
  }
  const writable=projectId=>{const current=indexOf(projectId);if(current.broken)throw fail('저장된 리포트 목록을 읽지 못했어요. 관리자에게 알려 주세요.',409);return current.heads;};
  const projectOf=row=>({name:row.title||'',client:row.customerName||''});
  // 그 프로젝트의 고객에게 지금 칸이 보이는가: 스위치가 켜져 있고 리포트가 한 건 이상 있을 때만 참이다.
  function visible(projectId){return enabled()&&indexOf(projectId).heads.length>0;}

  // 고객 경로. 프로젝트는 초대 세션에서만 정한다. 오류 문장은 영어 사전에 이미 있는 둘만 쓴다(pulse-i18n-server-errors.test.mjs).
  function customerList(token,search=''){
    if(!enabled())throw fail('고객 요청을 찾을 수 없습니다.',404);
    if(search)throw fail('주소를 확인해 주세요.');
    const {row}=clientProjects.session(token);
    return {reports:indexOf(row.id).heads.map(customerHead)};
  }
  // 질의는 kind와 run을 한 번씩만 받는다. 다른 키, 겹친 키, 꼴이 어긋난 값은 400이다.
  function customerReport(token,params){
    if(!enabled())throw fail('고객 요청을 찾을 수 없습니다.',404);
    const keys=params&&typeof params.keys==='function'?[...params.keys()]:[];
    if(keys.length!==2||!keys.includes('kind')||!keys.includes('run'))throw fail('주소를 확인해 주세요.');
    const kind=params.get('kind'),run=params.get('run');
    if(!MARKETING_KINDS.includes(kind)||!RUN_ID.test(run))throw fail('주소를 확인해 주세요.');
    const {row}=clientProjects.session(token);
    const listed=indexOf(row.id).heads.some(sameRun(kind,run)),doc=listed?store.get(PULSE_MARKETING_REPORTS,reportId(row.id,kind,run)):null;
    if(!isObject(doc)||doc.projectId!==row.id||doc.kind!==kind||doc.runId!==run||!isObject(doc.report))throw fail('고객 요청을 찾을 수 없습니다.',404);
    return doc.report;
  }

  // 직원 경로. 무엇보다 먼저 clientProjects.project로 그 직원이 이 프로젝트를 볼 수 있는지(쓰기는 바꿀 수 있는지) 본다.
  // 스위치와 상관없이 열려 있다. 먼저 올려 두고 스위치를 켜기 위해서다.
  function staffList(user,id){
    // broken: 저장된 목록을 읽지 못했다는 뜻이다. 빈 목록과 구별해 직원이 올리기 전에 알게 한다(올리기와 지우기는 409로 막힌다).
    const row=clientProjects.project(user,id),{heads,broken}=indexOf(row.id);
    return {projectId:row.id,project:projectOf(row),visible:enabled()&&heads.length>0,broken,reports:heads.map(staffHead)};
  }
  // 같은 kind와 runId로 다시 올리면 덮는다(잘못 올린 것을 고쳐 올리는 길). 덮어 올리기는 상한에 세지 않는다.
  function save(user,id,input){
    const row=clientProjects.project(user,id,true);
    if(!isObject(input)||Object.keys(input).length!==1||!Object.hasOwn(input,'report'))throw fail('올릴 리포트를 확인해 주세요.');
    const report=normalizeReport(input.report),head={...headOf(report),uploadedAt:clock(),uploadedBy:user.id};
    const replaced=store.transaction(()=>{
      const heads=writable(row.id),replaced=heads.some(sameRun(report.kind,report.runId));
      if(!replaced&&heads.length>=MARKETING_LIMITS.reports)throw fail(`한 프로젝트에 리포트는 ${MARKETING_LIMITS.reports}건까지예요. 오래된 회차를 지운 뒤 올려 주세요.`,409);
      const next=[head,...heads.filter(item=>!sameRun(report.kind,report.runId)(item))].sort(order);
      store.put(PULSE_MARKETING_REPORTS,reportId(row.id,report.kind,report.runId),{projectId:row.id,kind:report.kind,runId:report.runId,report,uploadedAt:head.uploadedAt,uploadedBy:head.uploadedBy});
      store.put(PULSE_MARKETING_INDEX,row.id,{projectId:row.id,heads:next,updatedAt:head.uploadedAt});
      return replaced;
    });
    return {head:staffHead(head),replaced,project:projectOf(row),visible:visible(row.id)};
  }
  // 마지막 리포트를 지우면 색인 문서도 지운다. 그러면 고객 칸도 사라진다.
  function remove(user,id,input){
    const row=clientProjects.project(user,id,true);
    if(!isObject(input)||Object.keys(input).length!==2||!MARKETING_KINDS.includes(input.kind)||typeof input.runId!=='string'||!RUN_ID.test(input.runId))throw fail('지울 리포트를 확인해 주세요.');
    store.transaction(()=>{
      const heads=writable(row.id),match=sameRun(input.kind,input.runId);
      if(!heads.some(match))throw fail('그 리포트를 찾지 못했어요. 목록을 새로 읽어 주세요.',404);
      const next=heads.filter(item=>!match(item));
      store.remove(PULSE_MARKETING_REPORTS,reportId(row.id,input.kind,input.runId));
      if(next.length)store.put(PULSE_MARKETING_INDEX,row.id,{projectId:row.id,heads:next,updatedAt:clock()});else store.remove(PULSE_MARKETING_INDEX,row.id);
    });
    return {ok:true,visible:visible(row.id)};
  }
  return {visible,customerList,customerReport,staffList,save,remove};
}
