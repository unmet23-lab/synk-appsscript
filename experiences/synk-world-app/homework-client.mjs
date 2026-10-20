// 「이번 주 과제」 통로의 꼴: TOPIK 4급 온라인 반 학생이 읽기 답·쓰기 글을 내고 첨삭을 돌려받는 synk-classroom 경로
// (GET /api/world/homework · POST /api/world/homework?classId=, SYNK-talk lib/synk-classroom-homework.js, 설계 docs/온라인반_TOPIK4급/과제_내기_설계.md).
// 요청은 WORLD의 다른 반 요청(반 연결·마을 공유)과 같은 world-account.mjs request()로 나간다 — 웹은 SYNK ID 토큰, PC 앱은 본체(world-requests.cjs).
// 묶음에서 다른 모듈의 이름을 밀어내지 않게 최상위 이름은 homework로 시작한다(classroom-client.mjs와 같다).
// 여기서는 서버 답을 화면이 쓰는 꼴로 거르고(꼴이 틀린 반·제출·첨삭은 뺀다) 내기 본문을 만든다. 서버 글은 화면에서 textContent로만 넣는다.
export const HOMEWORK_COURSE='topik4-online';
export const HOMEWORK_CODES=Object.freeze(['체','조','어','낱','맞','띄','연','근','빠','자','+']);
export const HOMEWORK_VERDICTS=Object.freeze(['인정','부분','다시']);
const homeworkRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const homeworkText=(value,max=4000)=>typeof value==='string'&&value.length<=max?value:null;
const homeworkUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const HOMEWORK_FIELD_ID=/^W[1-8]-[1-9]\.[1-9]$/,HOMEWORK_ITEM_ID=/^R[1-8]-[1-9]$/,HOMEWORK_PART_ID=/^W[1-8]-[1-9]$/;
const homeworkFailure=(code,status,message='과제를 불러오지 못했어요.')=>Object.assign(new Error(message),{code,status});

function normalizeHomeworkAnswers(kind,week,value){
 if(!homeworkRecord(value))return null;const out={};
 for(const [id,answer] of Object.entries(value)){
  if(kind==='reading'){if(!HOMEWORK_ITEM_ID.test(id)||id[1]!==String(week)||!Number.isInteger(answer)||answer<1||answer>4)return null;out[id]=answer;continue;}
  if(!HOMEWORK_FIELD_ID.test(id)||id[1]!==String(week))return null;
  if(typeof answer==='string'){if(answer.length>4000)return null;out[id]=answer;continue;}
  if(!Array.isArray(answer)||answer.length>10||!answer.every(row=>Array.isArray(row)&&row.length<=5&&row.every(cell=>typeof cell==='string'&&cell.length<=600)))return null;
  out[id]=answer.map(row=>[...row]);
 }
 return out;
}
// 첨삭: 그 주 문항·칸에만, 기호 11개·판정 셋·한마디 세 줄(첨삭기준.md). 돌려준 것(returnedAt)만 학생에게 온다.
function normalizeHomeworkFeedback(week,value){
 if(value===null||value===undefined)return null;
 if(!homeworkRecord(value)||!homeworkText(value.returnedAt,40)||!homeworkRecord(value.parts))return null;
 const parts={};
 for(const [key,part] of Object.entries(value.parts)){
  if(!HOMEWORK_PART_ID.test(key)||key[1]!==String(week)||!homeworkRecord(part))continue;
  const out={};
  if(homeworkRecord(part.fields)){out.fields={};for(const [id,f] of Object.entries(part.fields))if(HOMEWORK_FIELD_ID.test(id)&&id.startsWith(key+'.')&&homeworkRecord(f)&&HOMEWORK_VERDICTS.includes(f.verdict))out.fields[id]={verdict:f.verdict,reason:homeworkText(f.reason,600)||''};}
  if(Array.isArray(part.marks))out.marks=part.marks.filter(m=>homeworkRecord(m)&&HOMEWORK_FIELD_ID.test(m.field)&&m.field.startsWith(key+'.')&&HOMEWORK_CODES.includes(m.code)&&homeworkText(m.quote,300))
   .slice(0,12).map(m=>({field:m.field,quote:m.quote,code:m.code,...(homeworkText(m.note,300)?{note:m.note}:{})}));
  if(homeworkRecord(part.comment)){const c={};for(const name of ['good','fix','retry'])if(homeworkText(part.comment[name],600))c[name]=part.comment[name];if(Object.keys(c).length)out.comment=c;}
  if(Object.keys(out).length)parts[key]=out;
 }
 return {returnedAt:value.returnedAt,parts};
}
export function normalizeHomeworkClasses(list){
 return list.filter(c=>homeworkRecord(c)&&homeworkUuid(c.classId)&&c.course===HOMEWORK_COURSE).map(c=>{
  const weeks=Number.isInteger(c.weeks)&&c.weeks>=1&&c.weeks<=12?c.weeks:8;
  const submissions=(Array.isArray(c.submissions)?c.submissions:[]).filter(s=>homeworkRecord(s)&&Number.isInteger(s.week)&&s.week>=1&&s.week<=weeks&&['reading','writing'].includes(s.kind)&&Number.isSafeInteger(s.revision)&&s.revision>=1)
   .map(s=>{const answers=normalizeHomeworkAnswers(s.kind,s.week,s.answers);if(!answers)return null;
    const retry=homeworkRecord(s.retry)?Object.fromEntries(Object.entries(s.retry).filter(([k,v])=>HOMEWORK_PART_ID.test(k)&&k[1]===String(s.week-1)&&homeworkText(v,600))):{};
    const submittedAt=homeworkText(s.submittedAt,40);
    return {week:s.week,kind:s.kind,answers,retry,revision:s.revision,submittedAt:submittedAt&&Number.isFinite(Date.parse(submittedAt))?submittedAt:null,late:s.late===true,contentVersion:homeworkText(s.contentVersion,40),
     feedback:s.kind==='writing'?normalizeHomeworkFeedback(s.week,s.feedback):null};}).filter(Boolean);
  // 같은 주·같은 갈래는 하나만(서버의 유일 제약과 같다). 겹치면 판이 높은 것.
  const unique=new Map();for(const s of submissions){const k=`${s.week}:${s.kind}`;if(!unique.has(k)||unique.get(k).revision<s.revision)unique.set(k,s);}
  return {classId:c.classId,name:homeworkText(c.name,200)||'',course:c.course,startsOn:typeof c.startsOn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.startsOn)?c.startsOn:null,weeks,submissions:[...unique.values()]};
 });
}
// 서버 답(웹 request()·PC 본체 모두 같은 봉투) → {classes, emptyReason, serverTime?}. 꼴이 틀리면 CONTRACT_VIOLATION.
// serverTime은 화면이 주차·마감을 서버 시계로 보는 데만 쓴다(기기 시계가 틀린 폰).
export function homeworkReply(data,status){
 if(!homeworkRecord(data)||data.ok!==true){const code=typeof data?.error?.code==='string'&&data.error.code?data.error.code:typeof data?.code==='string'&&data.code?data.code:'HOMEWORK_UNAVAILABLE';throw homeworkFailure(code,status??data?.error?.status);}
 if(!Array.isArray(data.classes))throw homeworkFailure('CONTRACT_VIOLATION',status);
 const serverTime=homeworkText(data.serverTime,40);
 return {classes:normalizeHomeworkClasses(data.classes),emptyReason:typeof data.emptyReason==='string'?data.emptyReason:null,...(serverTime&&Number.isFinite(Date.parse(serverTime))?{serverTime}:{})};
}
// 과제 경로가 아직 없는 서버(옛 synk-classroom: 반 없는 읽기 400 CLASS_REQUIRED, 모르는 경로 404, 표 없음 404 HOMEWORK_UNAVAILABLE)와
// 꺼진 반 기능(403 CLASSROOM_UNAVAILABLE)은 「이 계정에는 과제 칸이 없다」로 본다. 5xx와 그 밖의 실패는 알린다(학생이 과제가 없다고 오해하지 않게).
export const homeworkUnavailable=error=>['HOMEWORK_UNAVAILABLE','HOMEWORK_UNSUPPORTED','CLASS_REQUIRED','NOT_FOUND','CLASSROOM_UNAVAILABLE'].includes(error?.code)&&!(error?.status>=500);
// 내기 본문: 서버가 받는 꼴 그대로(desktop/src/world-requests.cjs의 homework/submit 검사와 같다).
export function homeworkSubmission({classId,week,kind,requestId,expectedRevision,contentVersion,answers,retry}){
 if(!homeworkUuid(classId)||!Number.isInteger(week)||week<1||week>12||!['reading','writing'].includes(kind)||!homeworkUuid(requestId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!/^v1-[0-9a-f]{12}$/.test(contentVersion||''))throw new TypeError('과제 내기 꼴을 확인해 주세요.');
 const normalized=normalizeHomeworkAnswers(kind,week,answers);if(!normalized||!Object.keys(normalized).length)throw new TypeError('과제 답을 확인해 주세요.');
 const retryLines=kind==='writing'&&homeworkRecord(retry)?Object.fromEntries(Object.entries(retry).filter(([k,v])=>HOMEWORK_PART_ID.test(k)&&k[1]===String(week-1)&&typeof v==='string'&&v.trim()).map(([k,v])=>[k,v.trim().slice(0,600)])):{};
 return {classId,week,kind,requestId,expectedRevision,contentVersion,answers:normalized,...(Object.keys(retryLines).length?{retry:retryLines}:{})};
}
