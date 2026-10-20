// 내 수업 「과제 첨삭」(04): TOPIK II 4급 온라인 반의 반 계획 → 주별 낸 것 → 쓰기 첨삭(판정 · 기호 · 한마디 세 줄) → 학생에게 돌려주기.
// · 통로는 synk-classroom의 교사 과제 경로 GET/POST /api/teacher/homework?classId=(서버 SYNK-talk lib/synk-classroom-homework.js)다.
//   설계 docs/온라인반_TOPIK4급/과제_내기_설계.md, 첨삭 기준 docs/온라인반_TOPIK4급/첨삭기준.md §2~4.
// · 문제·예시답은 WORLD와 같은 topik4-homework.json·-key.json(문서에서 변환)을 읽는다. 학생 글·이름·첨삭은 textContent로만 넣는다.
// · 기호 자리는 학생 화면(synk-world-app/classroom-homework.mjs의 markSegments)과 같은 규칙으로 미리 보인다:
//   문단(빈 줄로 나눔)마다, 그 문단에서 처음 나오는 겹치지 않는 자리. 그래서 교사가 고르는 글귀도 한 문단 안에서만 받는다.
// · 임시 저장(returned:false)은 학생에게 보이지 않는다. 돌려준 첨삭은 고칠 수 있지만 다시 숨기지 않는다(서버 FEEDBACK_RETURNED).
export const REVIEW_TEXT=Object.freeze({
 refresh:'새로고침',loading:'과제를 불러오고 있어요.',refreshing:'새로 불러오고 있어요.',loadedAt:'불러온 때',
 error:'과제를 불러오지 못했어요. 연결을 확인하고 다시 불러와 주세요.',retry:'다시 불러오기',refreshError:'새로 불러오지 못했어요. 화면은 마지막으로 불러온 내용이에요.',
 unavailable:'과제 첨삭은 서버 준비가 끝나면 열려요. 그전에는 학생 WORLD에도 과제가 보이지 않아요.',
 unsupported:'이 연결은 아직 과제 첨삭을 지원하지 않아요. 워크스페이스가 새 판으로 바뀌면 열려요.',
 contentError:'과제 문제를 불러오지 못했어요. 새로고침을 눌러 주세요.',keyLoading:'정답·예시답을 불러오고 있어요.',
 planNone:'과제 계획 없음',planLead:'TOPIK II 4급 온라인 반이면 반 시작일을 정해 학생 WORLD의 「이번 주 과제」를 열어요. 다른 과정의 반에는 열지 않아요.',
 planStart:'반 시작일 · 1주차 토요일',planWeeks:'주 수',planOpen:'과제 열기',planSave:'계획 저장',planEdit:'계획 바꾸기',planCancel:'그만두기',
 planNotSaturday:'토요일이 아니에요. 토요일 수업 → 수요일 마감 흐름이면 1주차 토요일을 골라 주세요.',
 planChange:'이미 낸 과제는 그대로예요. 「늦게 냄」은 낼 때의 마감으로 정해져 바뀌지 않아요.',
 planInvalid:'반 시작일을 골라 주세요(2026년 이후).',planConflict:'다른 곳에서 계획이 먼저 바뀌었어요. 새로 불러온 계획을 확인해 주세요.',
 planSaved:'계획을 저장했어요. 학생 WORLD의 「이번 주 과제」가 이 일정으로 열려요.',
 pick:'목록에서 학생을 고르면 낸 글과 첨삭 칸이 열려요.',noRoster:'이 반의 학생 명부가 비어 있어요.',
 notSubmitted:'이 주 쓰기를 아직 내지 않았어요. 늦게 내도 받아요.',unlinked:'학생 계정이 아직 반에 연결되지 않았어요.',
 select:'글귀를 끌어 고르면(휴대폰은 길게 눌러) 기호를 붙여요. 한 문단 안에서 골라요.',
 typed:'글귀를 직접 적어 붙이기',typedQuote:'글에 있는 글귀 그대로',typedCode:'기호',typedAdd:'붙이기',typedMissing:'이 글에서 그 글귀를 찾지 못했어요. 글에 있는 그대로 적어 주세요.',
 span:'한 문단 안에서 골라 주세요. 학생 화면도 문단마다 기호를 놓아요.',overlap:'이미 표시한 글귀와 겹쳐요. 겹치지 않게 골라 주세요.',
 earlier:'같은 글귀가 이 문단 앞쪽에도 있어 학생 화면에는 앞의 자리에 표시돼요. 앞뒤 낱말을 더 넣어 고르면 정확해요.',
 tooManyCorrections:'한 편에 고칠 곳은 다섯 곳까지예요(첨삭 기준 §2). 같은 실수는 처음 한 곳만 표시하고 덧붙임에 「같은 실수 세 번」처럼 적어요.',
 tooManyMarks:'한 문항에 표시는 열두 곳까지예요.',cancel:'취소',remove:'빼기',note:'덧붙임(선택)',
 verdictReason:'한 줄 이유',model:'예시답',key:'예시답 · 채점 기준',problem:'문제 보기',
 retryTitle:'지난주 다시 써 볼 곳',retryNote:'다시 쓴 문장은 이번 주 한마디에서 짚어 주세요.',
 saveDraft:'임시 저장',returnNow:'학생에게 돌려주기',returnAgain:'고친 첨삭 다시 돌려주기',returnAnyway:'그대로 돌려주기',keepEditing:'계속 고치기',next:'다음 글',
 savedDraft:'임시 저장했어요. 학생에게는 아직 안 보여요.',returned:'학생에게 돌려줬어요. 학생은 WORLD 「이번 주 과제」에서 첨삭을 봐요.',returnedAgain:'고친 첨삭을 돌려줬어요. 학생 화면에 바로 보여요.',
 noParts:'첨삭한 문항이 없어요. 판정이나 기호, 한마디를 먼저 써 주세요.',allReturned:'이 주에 첨삭할 글을 모두 돌려줬어요.',
 resubmitted:'학생이 글을 고쳐 다시 냈어요. 새 글에 맞춰 판정과 기호를 확인한 뒤 저장해 주세요.',
 changedElsewhere:'다른 곳에서 이 첨삭이 먼저 저장됐어요. 지금 화면의 첨삭으로 저장하면 그 내용을 덮어써요.',useServer:'새로 불러온 첨삭으로 바꾸기',
 lostSubmission:'열어 둔 글을 다시 찾지 못했어요. 명부나 학생 계정이 바뀌었을 수 있어요.',
 leave:'저장하지 않은 첨삭이 있어요. 닫고 다른 글을 볼까요?',
 privacy:'학생 글과 첨삭은 이 반 교사와 그 학생만 봐요. 점수나 급수로 바꾸지 않아요.',
});
const T=REVIEW_TEXT;
// 〔+〕를 맨 앞에: 한 편에 한 곳 이상 꼭 표시한다(첨삭 기준 §3). 나머지는 기준 표의 차례.
export const CODES=Object.freeze(['+','체','조','어','낱','맞','띄','연','근','빠','자']);
export const CODE_SHORT=Object.freeze({'+':'잘 쓴 곳','체':'문체','조':'조사','어':'어미·호응','낱':'낱말','맞':'맞춤법','띄':'띄어쓰기','연':'연결','근':'근거·예','빠':'빠짐','자':'자료'});
export const VERDICTS=Object.freeze(['인정','부분','다시']);
// 서버 validFeedback의 상한, 첨삭 기준 §2(고칠 곳 다섯 곳), 회사 워크스페이스 수업 중계(/api/teaching/request) 본문 상한 12,000자·40,000바이트.
export const LIMITS=Object.freeze({corrections:5,marks:12,quote:300,note:300,reason:600,comment:600,sendChars:11500,sendBytes:39000});
export const STATUS=Object.freeze({none:['아직 안 냄','idle'],unlinked:['계정 연결 전','idle'],new:['새로 냄','info'],resubmitted:['고쳐 냄','info'],stale:['고쳐 냄 · 첨삭 다시 맞추기','check'],drafting:['첨삭 중','check'],returned:['돌려줌','ok'],partly:['일부 돌려줌','ok']});
const NEEDS=Object.freeze(['new','resubmitted','stale','drafting']);
// 한마디 세 줄(첨삭 기준 §4): 잘된 점 하나 · 고칠 핵심 하나(기호와 함께) · 다시 써 볼 문장 하나. 예시는 어느 주에나 맞게.
const COMMENT=Object.freeze([['good','ok','예: 빈칸 앞뒤 흐름을 정확히 이었어요.'],['fix','check','예: 글의 문체를 끝까지 「-다」로 맞춰요.〔체〕'],['retry','info','예: 마지막 문장을 「-기 때문이다」로 다시 써 보세요.']]);
const DAY=86400000,KST=9*3600000,collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});

// ── WORLD 「이번 주 과제」(classroom-homework.mjs)와 같은 규칙: 글자 수·주차·마감·기호 자리. 시험이 두 모듈을 대조한다. ──
export const homeworkLength=text=>[...String(text??'').replace(/\r\n?/g,'\n').normalize('NFC').replace(/\n/g,'')].length;
export function homeworkWindow(startsOn,week,schedule={dueWeekday:3,dueTime:'23:00'}){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(startsOn||'');if(!m)return null;
 const utc=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])),base=utc-KST,weekday=new Date(utc).getUTCDay();
 const offset=((schedule.dueWeekday-weekday+7)%7)||7,[h,min]=String(schedule.dueTime||'23:00').split(':').map(Number);
 const start=base+(week-1)*7*DAY;
 return {start,end:start+7*DAY,due:start+offset*DAY+(h*60+min)*60000};
}
export function homeworkWeek({startsOn,weeks=8,now=Date.now(),schedule}){
 const first=homeworkWindow(startsOn,1,schedule);
 if(!first)return {phase:'unset',week:0,opened:0};
 if(now<first.start)return {phase:'before',week:0,opened:0,start:first.start};
 const week=Math.floor((now-first.start)/(7*DAY))+1;
 if(week>weeks)return {phase:'done',week:weeks,opened:weeks,start:first.start};
 return {phase:'active',week,opened:week,start:first.start};
}
export function homeworkDate(ms,{time=true}={}){
 return new Date(ms).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',...(time?{hour:'numeric',minute:'2-digit'}:{})});
}
export const paragraphsOf=text=>String(text??'').split(/\n{2,}/);
export function markSegments(text,marks){
 const source=String(text??'').normalize('NFC'),ranges=[];
 marks.forEach((mark,index)=>{
  const quote=String(mark.quote??'').normalize('NFC');if(!quote)return;
  for(let from=0;;){const at=source.indexOf(quote,from);if(at<0)return;const end=at+quote.length;
   if(ranges.some(r=>at<r.end&&end>r.start)){from=at+1;continue;}ranges.push({start:at,end,index});return;}
 });
 ranges.sort((a,b)=>a.start-b.start);const out=[];let pos=0;
 for(const r of ranges){if(r.start>pos)out.push({text:source.slice(pos,r.start)});out.push({text:source.slice(r.start,r.end),mark:r.index,start:r.start});pos=r.end;}
 if(pos<source.length)out.push({text:source.slice(pos)});
 return out;
}
// 표시마다 학생 글 위에 몇 곳에 놓이는지(문단마다 따로 놓으므로 둘 이상일 수 있고, 못 찾으면 0 — 학생 화면에서는 목록에만).
export function markPlacements(text,marks){
 const count=marks.map(()=>0);
 for(const paragraph of paragraphsOf(text))for(const seg of markSegments(paragraph,marks))if(seg.mark!==undefined)count[seg.mark]++;
 return count;
}

// ── 낸 것 읽기 ──
export function readingScore(items,answers,key){
 if(!key?.reading)return null;
 const rows=items.map(item=>({id:item.id,chosen:answers?.[item.id]??null,answer:key.reading[item.id]?.answer??null}));
 return {total:items.length,right:rows.filter(r=>r.answer!==null&&r.chosen===r.answer).length,missed:rows.filter(r=>r.answer!==null&&r.chosen!==r.answer)};
}
export function writingStatus(sub,parts=[]){
 if(!sub)return {code:'none',late:false};
 const fb=sub.feedback,late=sub.late===true;
 if(fb?.returnedAt)return {code:parts.every(p=>fb.parts?.[p.key])?'returned':'partly',late};
 if(fb&&fb.submissionRevision!==sub.revision)return {code:'stale',late};
 if(fb)return {code:'drafting',late};
 return {code:sub.revision>1?'resubmitted':'new',late};
}
export const needsFeedback=status=>NEEDS.includes(status?.code);
export function weekRows(data,week,content,key){
 const w=content?.weeks?.[week-1],items=w?.reading?.items||[],parts=w?.writing?.parts||[];
 return (data?.learners||[]).map(learner=>{
  const mine=(data.submissions||[]).filter(s=>s.learnerId===learner.learnerId&&s.week===week);
  const reading=mine.find(s=>s.kind==='reading')||null,writing=mine.find(s=>s.kind==='writing')||null;
  return {learnerId:learner.learnerId,name:String(learner.name||'이름 확인 필요'),accountConnected:learner.accountConnected!==false,reading,score:reading?readingScore(items,reading.answers,key):null,writing,status:writingStatus(writing,parts)};
 }).sort((a,b)=>collator.compare(a.name,b.name)||collator.compare(a.learnerId,b.learnerId));
}
export function weekBoard(rows){
 const n=(...codes)=>rows.filter(r=>codes.includes(r.status.code)).length;
 return {learners:rows.length,writing:rows.filter(r=>r.writing).length,reading:rows.filter(r=>r.reading).length,todo:rows.filter(r=>needsFeedback(r.status)).length,
  drafting:n('drafting','stale'),returned:n('returned','partly'),late:rows.filter(r=>r.writing?.late).length};
}
export function pendingCount(data,week,content){
 const parts=content?.weeks?.[week-1]?.writing?.parts||[],roster=new Set((data?.learners||[]).map(l=>l.learnerId));
 return (data?.submissions||[]).filter(s=>s.kind==='writing'&&s.week===week&&roster.has(s.learnerId)&&needsFeedback(writingStatus(s,parts))).length;
}

// ── 첨삭 쓰는 판: 문항마다 {fields:{칸:{verdict,reason}}, marks:[{field,quote,code,note}], comment:{good,fix,retry}} ──
const blankPart=()=>({fields:{},marks:[],comment:{good:'',fix:'',retry:''}});
export function draftFrom(feedback){
 const out={};
 for(const [key,part] of Object.entries(feedback?.parts||{}))out[key]={
  fields:Object.fromEntries(Object.entries(part.fields||{}).map(([id,f])=>[id,{verdict:f.verdict,reason:f.reason||''}])),
  marks:(part.marks||[]).map(m=>({field:m.field,quote:m.quote,code:m.code,note:m.note||''})),
  comment:{good:part.comment?.good||'',fix:part.comment?.fix||'',retry:part.comment?.retry||''}};
 return out;
}
// 서버가 받는 parts: 학생이 실제로 낸 칸에만, 빈 줄은 빼고, 문서의 칸 차례로(같은 첨삭이면 같은 문자열 — 저장 여부 비교에 쓴다).
export function buildParts(draft,writing,answers){
 const parts={},has=id=>!!answers&&Object.hasOwn(answers,id);
 for(const part of writing?.parts||[]){
  const d=draft?.[part.key];if(!d)continue;const ids=part.fields.map(f=>f.id).filter(has),out={};
  const fields={};for(const id of ids){const f=d.fields?.[id];if(!f||!VERDICTS.includes(f.verdict))continue;const reason=String(f.reason??'').trim();fields[id]=reason?{verdict:f.verdict,reason}:{verdict:f.verdict};}
  const marks=(d.marks||[]).filter(m=>ids.includes(m.field)&&CODES.includes(m.code)&&String(m.quote??'').length>0).map(m=>{const note=String(m.note??'').trim();return note?{field:m.field,quote:m.quote,code:m.code,note}:{field:m.field,quote:m.quote,code:m.code};});
  const comment={};for(const [name] of COMMENT){const line=String(d.comment?.[name]??'').trim();if(line)comment[name]=line;}
  if(Object.keys(fields).length)out.fields=fields;if(marks.length)out.marks=marks;if(Object.keys(comment).length)out.comment=comment;
  if(Object.keys(out).length)parts[part.key]=out;
 }
 return parts;
}
export const partName=part=>[part.number&&part.label!==`${part.number}번`?`${part.number}번`:null,part.label].filter(Boolean).join(' · ');
const blankLabel=label=>/^[\u3260-\u327f]$/.test(label);
// 돌려주기 전에 볼 것(첨삭 기준 §2~4). 막지는 않는다 — 7주처럼 일부 문항을 먼저 돌려줄 수 있다.
export function reviewChecklist(draft,writing,answers,labels=['잘된 점','고칠 핵심','다시 써 볼 곳']){
 const parts=buildParts(draft,writing,answers),notes=[];
 for(const part of writing?.parts||[]){
  const built=parts[part.key],name=partName(part);
  if(!built){notes.push({part:part.key,kind:'empty',text:`${name} · 아직 첨삭하지 않았어요(학생에게는 「이 문항 첨삭은 아직이에요」로 보여요)`});continue;}
  for(const field of part.fields){
   if(!Object.hasOwn(answers||{},field.id))continue;
   if(field.kind!=='text'&&!built.fields?.[field.id])notes.push({part:part.key,kind:'verdict',text:`${name} · ${blankLabel(field.label)?`빈칸 ${field.label}`:`「${field.label}」`} 판정이 비어 있어요`});
   if(field.kind==='text'){
    const marks=(built.marks||[]).filter(m=>m.field===field.id),placed=markPlacements(answers[field.id],marks);
    if(!marks.some(m=>m.code==='+'))notes.push({part:part.key,kind:'plus',text:`${name} · 〔+〕 잘 쓴 곳을 한 곳 이상 표시해요`});
    const lost=placed.filter(n=>n===0).length;if(lost)notes.push({part:part.key,kind:'lost',text:`${name} · 글에서 찾지 못한 글귀 ${lost}곳(학생에게는 목록에만 보여요)`});
   }
  }
  if(part.fields.some(f=>f.kind==='text'))COMMENT.forEach(([key],i)=>{if(!built.comment?.[key])notes.push({part:part.key,kind:'comment',text:`${name} · 한마디 「${labels[i]}」이 비어 있어요`});});
 }
 return notes;
}
export function sendSize(classId,body){const raw=JSON.stringify({operation:'homeworkSave',classId,body});return {chars:raw.length,bytes:new TextEncoder().encode(raw).length};}
// 통로마다 오류 꼴이 다르다: 계정 포털은 서버 코드 그대로, 회사 워크스페이스 중계는 TEACHING_CLASSROOM에 서버 코드를 메시지로 싣는다.
const KNOWN_ERRORS=['REVISION_CONFLICT','FEEDBACK_RETURNED','INVALID_FEEDBACK','INVALID_PLAN','HOMEWORK_UNAVAILABLE','HOMEWORK_NOT_PLANNED','FORBIDDEN','CLASS_REQUIRED','INVALID_HOMEWORK_ACTION','SESSION_CHANGED','ACCOUNT_CHANGED','NETWORK_ERROR','RATE_LIMITED'];
export function homeworkErrorCode(error){
 const code=error?.code,message=String(error?.message||'');
 if(['INVALID_REQUEST','TEACHING_OPERATION'].includes(code)||/지원하지 않는 (교사 |수업 )?요청|지원하는 요청을 확인/.test(message))return 'ROUTE_UNSUPPORTED';
 for(const value of [code,message])if(KNOWN_ERRORS.includes(value))return value;
 if(error?.status===404||message==='NOT_FOUND')return 'HOMEWORK_UNAVAILABLE';
 if(code==='TEACHING_NOT_TEACHER')return 'FORBIDDEN';
 return code||'UNKNOWN';
}
const ERROR_TEXT=Object.freeze({FORBIDDEN:'이 반의 교사 권한을 확인하지 못했어요.',INVALID_FEEDBACK:'서버가 이 첨삭의 꼴을 받지 않았어요. 새로고침한 뒤 다시 저장해 주세요.',INVALID_PLAN:'계획을 확인해 주세요. 시작일과 주 수(1~12주)가 필요해요.',
 NETWORK_ERROR:'연결이 끊겼어요. 쓴 첨삭은 이 화면에 그대로 있어요. 잠시 뒤 다시 저장해 주세요.',RATE_LIMITED:'요청이 많아요. 잠시 뒤 다시 시도해 주세요.',FEEDBACK_RETURNED:'이미 학생에게 돌려준 첨삭이에요. 고친 내용은 「고친 첨삭 다시 돌려주기」로 저장돼요.'});
const errorText=(code,error)=>ERROR_TEXT[code]||(error?.message&&!/^[A-Z_]+$/.test(error.message)?error.message:'저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
const validData=(data,classId)=>!!data&&data.mode==='account-linked'&&(!classId||data.classId===classId)&&Array.isArray(data.learners)&&Array.isArray(data.submissions)
 &&(data.plan===null||data.plan===undefined||/^\d{4}-\d{2}-\d{2}$/.test(data.plan.startsOn||'')&&Number.isInteger(data.plan.weeks)&&Number.isSafeInteger(data.plan.revision));
const startsOnValid=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d&&y>=2026&&y<=2100;};
const fetchJson=async name=>{const response=await fetch(new URL(name,import.meta.url),{cache:'no-cache'});if(!response.ok)throw Error('CONTENT_UNAVAILABLE');return response.json();};

export function mountHomeworkReview({root,request,loadContent=()=>fetchJson('./topik4-homework.json'),loadKey=()=>fetchJson('./topik4-homework-key.json'),now=Date.now,confirmLeave=text=>root.ownerDocument.defaultView?.confirm?.(text)!==false,onCount=()=>{}}){
 const doc=root.ownerDocument;
 const s={classId:null,phase:'idle',error:null,data:null,loadedAt:null,content:null,contentState:'idle',key:null,week:null,learnerId:null,editor:null,planOpen:false,planNotice:null,notice:null,busy:null,generation:0,selection:null,barPointer:0,stopped:false};
 const node=(tag,className,value)=>{const el=doc.createElement(tag);if(className)el.className=className;if(value!==undefined&&value!==null)el.textContent=value;return el;};
 const led=tone=>{const el=node('i','hr-led');el.dataset.tone=tone;el.setAttribute('aria-hidden','true');return el;};
 const chip=(tone,text,className='hr-chip')=>{const el=node('span',className);el.append(led(tone),doc.createTextNode(text));return el;};
 const message=(tone,text,className='hr-message')=>{const el=node('p',className);el.append(led(tone),doc.createTextNode(text));return el;};
 const button=(label,className,key,onClick)=>{const el=node('button',className,label);el.type='button';el.dataset.hrKey=key;el.addEventListener('click',onClick);return el;};
 const runs=(segments,el)=>{for(const s_ of segments||[])el.append(typeof s_==='string'?doc.createTextNode(s_):s_.u!==undefined?node('u','',s_.u):node('strong','',s_.b));return el;};
 const clock=()=>now();
 const schedule=()=>s.content?.schedule||{dueWeekday:3,dueTime:'23:00'};
 const weekContent=week=>s.content?.weeks?.[week-1]||null;
 const rows=()=>weekRows(s.data,s.week,s.content,s.key);
 const currentRow=()=>rows().find(r=>r.learnerId===s.learnerId)||null;
 const dirty=()=>{const e=s.editor;if(!e)return false;const sub=s.data?.submissions.find(x=>x.submissionId===e.submissionId);return !!sub&&JSON.stringify(buildParts(e.draft,weekContent(e.week)?.writing,sub.answers))!==e.saved;};
 const leaveOk=()=>!dirty()||confirmLeave(T.leave);

 function blocks(list){
  const box=node('div','hr-passage');
  for(const block of list||[]){
   if(block.p){const p=node('p');block.p.forEach((line,i)=>{if(i)p.append(node('br'));runs(line,p);});box.append(p);}
   else if(block.list){const ul=node('ul');for(const item of block.list)ul.append(runs(item,node('li')));box.append(ul);}
   else if(block.h)box.append(node('p','hr-data',block.h));
   else if(block.box){const b=node('div','hr-box');b.append(node('span','hr-box-label','보기'),runs(block.box,node('p')));box.append(b);}
   else if(block.table){
    const wrap=node('div','hr-table'),table=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
    block.table.head.forEach((cell,i)=>{const th=runs(cell,node('th'));th.scope='col';if(block.table.align[i]==='right')th.dataset.align='right';hr.append(th);});
    for(const row of block.table.rows){const tr=node('tr');row.forEach((cell,i)=>{const td=runs(cell,node('td'));if(block.table.align[i]==='right')td.dataset.align='right';tr.append(td);});body.append(tr);}
    head.append(hr);table.append(head,body);wrap.append(table);box.append(wrap);
   }
  }
  return box;
 }

 // ── 불러오기 ──
 async function ensureContent(){
  if(s.content)return;
  const content=await loadContent();if(content?.schema!=='synk.topik4-homework.v1'||!Array.isArray(content.weeks))throw Object.assign(Error('CONTENT_UNAVAILABLE'),{code:'CONTENT_UNAVAILABLE'});
  s.content=content;
  // 정답·예시답은 공개 자료(WORLD도 읽는다)라 따로, 판이 같을 때만 쓴다. 없어도 첨삭은 쓸 수 있다.
  Promise.resolve().then(loadKey).then(key=>{if(!s.stopped&&key?.version===s.content.version){s.key=key;paint();}},()=>{});
 }
 async function load({quiet=false}={}){
  const gen=++s.generation,classId=s.classId;if(!classId)return;
  if(!s.data)s.phase='loading';else if(!quiet)s.notice={tone:'idle',text:T.refreshing};
  paint();
  try{
   const [data]=await Promise.all([request('/api/teacher/homework'),ensureContent()]);
   if(s.stopped||gen!==s.generation||classId!==s.classId)return;
   if(!validData(data,classId))throw Object.assign(Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE'});
   accept(data);s.phase='ready';if(!quiet){s.notice=null;s.planNotice=null;}
  }catch(error){
   if(s.stopped||gen!==s.generation||classId!==s.classId)return;
   const code=homeworkErrorCode(error);
   if(['SESSION_CHANGED','ACCOUNT_CHANGED'].includes(code))return;
   if(code==='HOMEWORK_UNAVAILABLE'||code==='ROUTE_UNSUPPORTED'){s.phase=code==='ROUTE_UNSUPPORTED'?'unsupported':'unavailable';s.data=null;s.editor=null;}
   else if(code==='CONTENT_UNAVAILABLE'){s.phase='error';s.error=T.contentError;}
   else if(s.data){s.notice={tone:'alert',text:T.refreshError};}
   else {s.phase='error';s.error=ERROR_TEXT[code]||T.error;}
  }
  paint();
 }
 function accept(data){
  s.data=data;s.loadedAt=Date.parse(data.serverTime)||clock();
  const plan=data.plan;
  if(plan){
   if(!s.week||s.week>plan.weeks){const phase=homeworkWeek({startsOn:plan.startsOn,weeks:plan.weeks,now:clock(),schedule:schedule()});s.week=phase.week||1;}
   if(!s.learnerId||!data.learners.some(l=>l.learnerId===s.learnerId))s.learnerId=rows().find(r=>needsFeedback(r.status))?.learnerId||null;
  }else{s.week=null;s.learnerId=null;s.editor=null;}
  reconcile();
  onCount(plan&&s.content?pendingCount(data,homeworkWeek({startsOn:plan.startsOn,weeks:plan.weeks,now:clock(),schedule:schedule()}).week||1,s.content):0);
 }
 // 새로 불러온 뒤 열어 둔 첨삭을 맞춘다. 쓰던 것은 버리지 않는다(학생이 고쳐 냈거나 다른 곳에서 먼저 저장했으면 알린다).
 function reconcile(){
  const e=s.editor;if(!e)return;
  const sub=s.data.submissions.find(x=>x.submissionId===e.submissionId);
  if(!sub||sub.learnerId!==e.learnerId){s.editor=null;if(s.learnerId===e.learnerId&&s.week===e.week)s.notice={tone:'check',text:T.lostSubmission};return;}
  const writing=weekContent(e.week)?.writing,wasDirty=JSON.stringify(buildParts(e.draft,writing,sub.answers))!==e.saved,notes=[];let offer=false;
  if(sub.revision!==e.submissionRevision){e.submissionRevision=sub.revision;notes.push(T.resubmitted);}
  const revision=sub.feedback?.revision||0;
  if(revision!==e.feedbackRevision){
   // 교사 경로에는 멱등키가 없다: 응답을 잃은 저장을 다시 보내면 409로 돌아오지만 서버에는 이미 같은 첨삭이 있다 — 그때는 겹침이 아니다.
   const server=JSON.stringify(buildParts(draftFrom(sub.feedback),writing,sub.answers)),same=JSON.stringify(buildParts(e.draft,writing,sub.answers))===server;
   if(wasDirty&&!same){notes.push(T.changedElsewhere);offer=true;}else if(!wasDirty)e.draft=draftFrom(sub.feedback);
   e.feedbackRevision=revision;e.saved=server;
  }
  e.returnedAt=sub.feedback?.returnedAt||null;e.updatedAt=sub.feedback?.updatedAt||null;
  if(notes.length)e.notice={tone:'check',text:notes.join(' '),offer,top:true};
 }
 function ensureEditor(row){
  const sub=row.writing;if(s.editor?.submissionId===sub.submissionId)return s.editor;
  const writing=weekContent(s.week).writing,draft=draftFrom(sub.feedback);
  s.selection=null;
  return s.editor={learnerId:row.learnerId,week:s.week,submissionId:sub.submissionId,submissionRevision:sub.revision,feedbackRevision:sub.feedback?.revision||0,returnedAt:sub.feedback?.returnedAt||null,updatedAt:sub.feedback?.updatedAt||null,
   draft,saved:JSON.stringify(buildParts(draft,writing,sub.answers)),notice:null,confirm:false};
 }

 // ── 저장 ──
 async function savePlan(form){
  if(s.busy)return;const startsOn=form.startsOn,weeks=Number(form.weeks);
  if(!startsOnValid(startsOn)){s.planNotice={tone:'alert',text:T.planInvalid};paint();return;}
  s.busy='plan';s.planNotice=null;paint();const classId=s.classId;
  try{
   const data=await request('/api/teacher/homework',{action:'plan',course:'topik4-online',startsOn,weeks,revision:s.data.plan?.revision||0});
   if(s.stopped||classId!==s.classId)return;if(!validData(data,classId))throw Object.assign(Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE'});
   s.generation++;s.week=null;accept(data);s.planOpen=false;s.planNotice={tone:'ok',text:T.planSaved};
  }catch(error){
   if(s.stopped||classId!==s.classId)return;const code=homeworkErrorCode(error);
   if(code==='REVISION_CONFLICT'){s.busy=null;s.planOpen=false;await load({quiet:true});s.planNotice={tone:'check',text:T.planConflict};}
   else s.planNotice={tone:'alert',text:errorText(code,error)};
  }finally{s.busy=null;paint();}
 }
 async function saveFeedback(returned,{force=false}={}){
  const e=s.editor,row=currentRow(),sub=row?.writing;if(!e||!sub||s.busy||sub.submissionId!==e.submissionId)return;
  const writing=weekContent(e.week).writing,parts=buildParts(e.draft,writing,sub.answers),again=!!e.returnedAt;
  if(returned&&!Object.keys(parts).length){e.notice={tone:'check',text:T.noParts};paint();return;}
  if(returned&&!force&&reviewChecklist(e.draft,writing,sub.answers,s.content.feedback.comment).length){e.confirm=true;paint();root.querySelector('[data-hr-key="return:anyway"]')?.focus();return;}
  const body={action:'feedback',submissionId:sub.submissionId,submissionRevision:e.submissionRevision,revision:e.feedbackRevision,parts,returned};
  const size=sendSize(s.classId,body);
  if(size.chars>LIMITS.sendChars||size.bytes>LIMITS.sendBytes){e.notice={tone:'alert',text:`첨삭이 한 번에 보낼 수 있는 길이를 넘었어요(${size.chars.toLocaleString('ko-KR')}자 / ${LIMITS.sendChars.toLocaleString('ko-KR')}자). 덧붙임이나 한마디를 조금 줄여 주세요.`};paint();return;}
  s.busy=returned?'return':'save';e.confirm=false;e.notice=null;paint();const classId=s.classId;
  try{
   const data=await request('/api/teacher/homework',body);
   if(s.stopped||classId!==s.classId)return;if(!validData(data,classId))throw Object.assign(Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE'});
   s.generation++;s.data=data;s.loadedAt=Date.parse(data.serverTime)||clock();
   const fresh=data.submissions.find(x=>x.submissionId===e.submissionId);
   if(fresh?.feedback){e.feedbackRevision=fresh.feedback.revision;e.submissionRevision=fresh.revision;e.returnedAt=fresh.feedback.returnedAt||null;e.updatedAt=fresh.feedback.updatedAt||null;e.saved=JSON.stringify(buildParts(draftFrom(fresh.feedback),writing,fresh.answers));}
   e.notice={tone:'ok',text:returned?(again?T.returnedAgain:T.returned):T.savedDraft,next:returned};
   const plan=data.plan;onCount(plan?pendingCount(data,homeworkWeek({startsOn:plan.startsOn,weeks:plan.weeks,now:clock(),schedule:schedule()}).week||1,s.content):0);
  }catch(error){
   if(s.stopped||classId!==s.classId)return;const code=homeworkErrorCode(error);
   // 첨삭은 지금 명부 계정이 낸 글에만 쓴다(명부 계정이 바뀐 옛 글은 403): 다시 읽어 그 글이 빠졌으면 「글을 찾지 못했어요」로 알린다.
   if(code==='FORBIDDEN'){s.busy=null;await load({quiet:true});if(s.editor?.submissionId===e.submissionId)s.editor.notice={tone:'alert',text:ERROR_TEXT.FORBIDDEN};}
   else if(code==='REVISION_CONFLICT'||code==='FEEDBACK_RETURNED'){s.busy=null;await load({quiet:true});if(s.editor&&code==='FEEDBACK_RETURNED')s.editor.notice={tone:'check',text:ERROR_TEXT.FEEDBACK_RETURNED,top:true};if(s.editor?.notice?.top)s.revealNotice=true;}
   else if(!['SESSION_CHANGED','ACCOUNT_CHANGED'].includes(code))e.notice={tone:'alert',text:errorText(code,error)};
  }finally{s.busy=null;paint();}
 }
 function nextRow(){
  const list=rows(),at=list.findIndex(r=>r.learnerId===s.learnerId);
  return [...list.slice(at+1),...list.slice(0,Math.max(at,0))].find(r=>needsFeedback(r.status))||null;
 }

 // ── 고르기 ──
 function chooseWeek(week){if(week===s.week||!leaveOk())return;s.week=week;s.editor=null;s.selection=null;s.notice=null;paint();}
 function chooseLearner(id,{scroll=true}={}){
  if(id===s.learnerId&&s.editor?.week===s.week)return;if(!leaveOk())return;
  s.learnerId=id;s.editor=null;s.selection=null;paint();
  if(scroll&&doc.defaultView?.matchMedia?.('(max-width: 900px)').matches)root.querySelector('.hr-editor')?.scrollIntoView({block:'start',behavior:'instant'});
 }

 // ── 그리기 ──
 function paint(){
  if(s.stopped)return;
  const active=doc.activeElement,focusKey=active&&root.contains(active)?active.dataset?.hrKey:null;
  root.replaceChildren(...view());root.dataset.state=s.phase;
  if(s.revealNotice){s.revealNotice=false;root.querySelector('.hr-editor-notice')?.scrollIntoView({block:'center'});}
  if(focusKey)root.querySelector(`[data-hr-key="${focusKey.replace(/["\\]/g,'\\$&')}"]`)?.focus({preventScroll:true});
 }
 function view(){
  const bar=node('div','hr-toolbar'),status=node('p','hr-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  if(s.notice)status.append(led(s.notice.tone),doc.createTextNode(s.notice.text));
  else if(s.loadedAt&&s.phase==='ready')status.append(led('idle'),doc.createTextNode(`${T.loadedAt} · ${homeworkDate(s.loadedAt)}`));
  const refresh=button(T.refresh,'hr-button','refresh',()=>{if(!s.busy)void load();});refresh.disabled=!!s.busy||s.phase==='loading';
  bar.append(status,refresh);
  if(s.phase==='loading'||s.phase==='idle')return [bar,message('idle',T.loading)];
  if(s.phase==='unavailable')return [bar,message('idle',T.unavailable)];
  if(s.phase==='unsupported')return [bar,message('idle',T.unsupported)];
  if(s.phase==='error'||!s.data||!s.content)return [bar,message('alert',s.error||T.error),button(T.retry,'hr-button','retry',()=>void load())];
  const out=[bar,planView()];
  if(s.data.plan&&!s.planOpen)out.push(weekNav(),weekView());
  out.push(node('p','hr-privacy',T.privacy));
  return out;
 }
 function planView(){
  const plan=s.data.plan,box=node('section','hr-plan');box.setAttribute('aria-label','반 과제 계획');
  if(plan&&!s.planOpen){
   const phase=homeworkWeek({startsOn:plan.startsOn,weeks:plan.weeks,now:clock(),schedule:schedule()}),line=node('div','hr-plan-line');
   line.append(chip(phase.phase==='active'?'ok':phase.phase==='before'?'info':'idle',phase.phase==='active'?`${phase.week}주차 진행 중`:phase.phase==='before'?'개강 전':'과정을 마쳤어요'),
    node('p','hr-plan-text',`TOPIK II 4급 온라인 반 · ${homeworkDate(homeworkWindow(plan.startsOn,1,schedule()).start,{time:false})} 시작 · ${plan.weeks}주 · 마감은 매주 수요일 오후 11시`),
    button(T.planEdit,'hr-button','plan:edit',()=>{s.planOpen=true;s.planNotice=null;paint();root.querySelector('[data-hr-key="plan:start"]')?.focus();}));
   box.append(line);if(s.planNotice)box.append(message(s.planNotice.tone,s.planNotice.text));
   return box;
  }
  box.classList.add('is-form');
  if(!plan){const head=node('div','hr-plan-head');head.append(chip('check',T.planNone),node('h3','',`${s.data.name||'이 반'}에 과제를 열까요?`),node('p','hr-help',T.planLead));box.append(head);}
  else box.append(node('h3','',T.planEdit));
  const form=node('form','hr-plan-form'),start=node('input'),weeks=node('select'),preview=node('p','hr-plan-preview');
  const startLabel=node('label','hr-label'),weeksLabel=node('label','hr-label');
  start.type='date';start.required=true;start.min='2026-01-01';start.max='2100-12-31';start.dataset.hrKey='plan:start';start.value=plan?.startsOn||'';
  for(let n=1;n<=(s.content.schedule?.weeks||8);n++){const o=node('option','',`${n}주`);o.value=String(n);weeks.append(o);}weeks.value=String(plan?.weeks||s.content.schedule?.weeks||8);weeks.dataset.hrKey='plan:weeks';
  startLabel.append(node('span','',T.planStart),start);weeksLabel.append(node('span','',T.planWeeks),weeks);
  const describe=()=>{
   preview.replaceChildren();const value=start.value;
   if(!startsOnValid(value)){preview.append(led('idle'),doc.createTextNode('시작일을 고르면 1주차가 열리는 날과 마감을 보여 줘요.'));return;}
   const first=homeworkWindow(value,1,schedule()),last=homeworkWindow(value,Number(weeks.value),schedule());
   preview.append(led('info'),doc.createTextNode(`1주차 ${homeworkDate(first.start,{time:false})} 열림 · 첫 마감 ${homeworkDate(first.due)} · 마지막 마감 ${homeworkDate(last.due)}`));
   const [y,m,d]=value.split('-').map(Number);if(new Date(Date.UTC(y,m-1,d)).getUTCDay()!==6)form.querySelector('.hr-plan-saturday')?.removeAttribute('hidden');else form.querySelector('.hr-plan-saturday')?.setAttribute('hidden','');
  };
  start.addEventListener('input',describe);weeks.addEventListener('change',describe);
  const saturday=message('check',T.planNotSaturday,'hr-message hr-plan-saturday');saturday.hidden=true;
  const actions=node('div','hr-actions-row'),submit=node('button','felt-button primary',s.busy==='plan'?'저장하는 중…':plan?T.planSave:T.planOpen);submit.type='submit';submit.dataset.hrKey='plan:submit';submit.disabled=!!s.busy;
  actions.append(submit);if(plan)actions.append(button(T.planCancel,'hr-button','plan:cancel',()=>{s.planOpen=false;s.planNotice=null;paint();}));
  form.append(node('div','hr-plan-fields'),preview,saturday);form.firstChild.append(startLabel,weeksLabel);
  if(plan&&s.data.submissions.length)form.append(message('idle',T.planChange));
  form.append(actions);
  form.addEventListener('submit',event=>{event.preventDefault();void savePlan({startsOn:start.value,weeks:weeks.value});});
  box.append(form);if(s.planNotice)box.append(message(s.planNotice.tone,s.planNotice.text));
  describe();
  return box;
 }
 function weekNav(){
  const plan=s.data.plan,nav=node('nav','hr-weeks'),phase=homeworkWeek({startsOn:plan.startsOn,weeks:plan.weeks,now:clock(),schedule:schedule()});
  nav.setAttribute('aria-label','주차 고르기');
  for(let w=1;w<=plan.weeks;w++){
   const win=homeworkWindow(plan.startsOn,w,schedule()),open=clock()>=win.start,pending=pendingCount(s.data,w,s.content),current=phase.phase==='active'&&phase.week===w;
   const b=button('',`hr-week${w===s.week?' is-selected':''}`,`week:${w}`,()=>chooseWeek(w));
   b.append(node('span','hr-week-name',`${w}주`));if(pending)b.append(node('span','hr-week-badge',String(pending)));
   b.setAttribute('aria-pressed',String(w===s.week));if(current)b.dataset.current='';if(!open)b.dataset.future='';
   b.setAttribute('aria-label',[`${w}주차`,current?'이번 주':null,open?null:'아직 안 열림',pending?`첨삭할 글 ${pending}편`:null].filter(Boolean).join(' · '));
   nav.append(b);
  }
  return nav;
 }
 function weekView(){
  const w=s.week,content=weekContent(w),win=homeworkWindow(s.data.plan.startsOn,w,schedule());
  if(!content)return message('alert',T.contentError);
  const list=rows(),sec=node('section','hr-week-body'),head=node('header','hr-week-head'),title=node('div','hr-week-title');
  const t=clock(),stage=t<win.start?['info','열리기 전']:t>win.due?['idle','마감 지남 · 늦게 내도 받아요']:['ok','마감 전'];
  title.append(node('p','hr-kicker',`WEEK ${String(w).padStart(2,'0')} · ${content.writing.id} · ${content.reading.id}`),node('h3','',`${w}주차 · ${content.writing.title}`),
   node('p','hr-week-meta',`${homeworkDate(win.start,{time:false})} 열림 · 마감 ${homeworkDate(win.due)} · 읽기 ${content.reading.title}`));
  head.append(title,chip(stage[0],stage[1]));
  const grid=node('div','hr-grid');grid.append(listView(list),editorView());
  sec.append(head,boardView(list),grid);
  const reading=readingItemsView(list);if(reading)sec.append(reading);
  return sec;
 }
 function boardView(list){
  const b=weekBoard(list),board=node('div','hr-board');board.setAttribute('role','list');board.setAttribute('aria-label','이 주 숫자');
  for(const [value,label,face] of [[String(b.todo),'첨삭할 글',true],[`${b.writing}/${b.learners}`,b.late?`쓰기 낸 학생 · 늦게 ${b.late}`:'쓰기 낸 학생'],[String(b.drafting),'첨삭 중'],[String(b.returned),'돌려줌'],[`${b.reading}/${b.learners}`,'읽기 낸 학생']]){
   const cell=node('div','hr-board-cell');cell.setAttribute('role','listitem');if(face)cell.dataset.face='';cell.append(node('strong','',value),node('span','',label));board.append(cell);
  }
  return board;
 }
 function listView(list){
  const box=node('section','hr-list');box.setAttribute('aria-label',`${s.week}주차 학생별 낸 것`);
  if(!list.length){box.append(message('idle',T.noRoster));return box;}
  for(const row of list){
   const [label,tone]=STATUS[!row.accountConnected&&!row.writing?'unlinked':row.status.code];
   const b=button('',`hr-row${row.learnerId===s.learnerId?' is-selected':''}`,`row:${row.learnerId}`,()=>chooseLearner(row.learnerId));
   b.dataset.status=row.status.code;b.setAttribute('aria-pressed',String(row.learnerId===s.learnerId));
   const main=node('span','hr-row-main'),line=node('span','hr-row-line');
   line.append(chip(tone,label));if(row.writing?.late)line.append(chip('check','늦게 냄'));
   const reading=row.reading?(row.score?`읽기 ${row.score.right}/${row.score.total}`:'읽기 냄'):'읽기 안 냄';
   main.append(node('strong','hr-row-name',row.name),line,node('span','hr-row-sub',[reading,row.writing?`쓰기 ${homeworkDate(Date.parse(row.writing.submittedAt))}${row.writing.revision>1?` · ${row.writing.revision}번째`:''}`:null].filter(Boolean).join(' · ')));
   b.append(node('span','hr-avatar',[...row.name][0]||'?'),main);
   b.setAttribute('aria-label',`${row.name} · ${label}${row.writing?.late?' · 늦게 냄':''} · ${reading}`);
   box.append(b);
  }
  return box;
 }
 function readingItemsView(list){
  const content=weekContent(s.week).reading,subs=list.filter(r=>r.reading);if(!s.key||!subs.length)return null;
  const details=node('details','hr-reading-items'),summary=node('summary','',`읽기 ${content.id} · 문항별로 맞힌 학생`);summary.dataset.hrKey='reading-items';details.append(summary);
  const ul=node('ul');
  for(const item of content.items){
   const right=subs.filter(r=>r.reading.answers?.[item.id]===s.key.reading[item.id]?.answer).length,li=node('li');
   li.append(node('span','hr-mono',item.id),node('span','',item.label),node('strong','',`${right}/${subs.length}명`));ul.append(li);
  }
  details.append(ul,node('p','hr-help','토요일 수업 앞 20분의 「이번 주 공통 오류」를 고를 때 써요. 학생 이름 없이 보여 주세요.'));
  return details;
 }
 function editorView(){
  const box=node('section','hr-editor');box.setAttribute('aria-label','첨삭');
  const row=currentRow();if(!row){box.append(message('idle',T.pick));return box;}
  const head=node('header','hr-editor-head'),[label,tone]=STATUS[!row.accountConnected&&!row.writing?'unlinked':row.status.code];
  head.append(node('span','hr-avatar',[...row.name][0]||'?'));
  const who=node('div','hr-editor-who');who.append(node('h4','',row.name),node('p','hr-editor-meta',`${s.week}주차 쓰기 ${weekContent(s.week).writing.id}${row.writing?` · ${homeworkDate(Date.parse(row.writing.submittedAt))} 냄${row.writing.revision>1?` · 고쳐 낸 판 ${row.writing.revision}`:''}`:''}`));
  head.append(who);const chips=node('div','hr-editor-chips');chips.append(chip(tone,label));if(row.writing?.late)chips.append(chip('check','늦게 냄'));head.append(chips);
  box.append(head,readingLine(row));
  if(!row.writing){box.append(message('idle',row.accountConnected?T.notSubmitted:T.unlinked));return box;}
  const e=ensureEditor(row),sub=row.writing,writing=weekContent(s.week).writing;
  if(e.notice?.top){
   const n=message(e.notice.tone,e.notice.text,'hr-message hr-editor-notice');box.append(n);
   if(e.notice.offer)box.append(button(T.useServer,'hr-button','editor:use-server',()=>{e.draft=draftFrom(sub.feedback);e.notice=null;paint();}));
  }
  const retry=retryView(row);if(retry)box.append(retry);
  if(writing.intro)box.append(blocks(writing.intro));
  for(const part of writing.parts)box.append(partView(part,sub));
  box.append(actionsView(row),markBar());
  return box;
 }
 function readingLine(row){
  const content=weekContent(s.week).reading;
  if(!row.reading)return message('idle',`읽기 ${content.id} · 아직 안 냄`,'hr-message hr-reading-line');
  if(!row.score)return message('idle',`읽기 ${content.id} · 냄 · ${T.keyLoading}`,'hr-message hr-reading-line');
  const circled=n=>['①','②','③','④'][n-1]||'—',line=message(row.score.missed.length?'info':'ok',`읽기 ${content.id} · ${row.score.total}문항 중 ${row.score.right}문항 맞힘${row.reading.late?' · 늦게 냄':''}`,'hr-message hr-reading-line');
  if(row.score.missed.length){const text=node('span');text.append(doc.createTextNode(line.lastChild.textContent+' · 틀린 문항 '));row.score.missed.forEach((m,i)=>{if(i)text.append(doc.createTextNode(', '));text.append(node('span','hr-nowrap',`${m.id}(고른 ${circled(m.chosen)}, 정답 ${circled(m.answer)})`));});line.lastChild.replaceWith(text);}
  return line;
 }
 function retryView(row){
  const entries=Object.entries(row.writing.retry||{});if(!entries.length)return null;
  const before=s.data.submissions.find(x=>x.learnerId===row.learnerId&&x.week===s.week-1&&x.kind==='writing'),sec=node('section','hr-retry');
  sec.append(node('h5','',T.retryTitle));
  for(const [partKey,line] of entries){
   const ask=before?.feedback?.parts?.[partKey]?.comment?.retry;
   const item=node('div','hr-retry-item');item.append(node('p','hr-retry-ask',`${partKey} · ${ask||'지난주 첨삭의 「다시 써 볼 곳」'}`),node('p','hr-answer',line));sec.append(item);
  }
  sec.append(node('p','hr-help',T.retryNote));
  return sec;
 }
 function partView(part,sub){
  const e=s.editor,d=(e.draft[part.key]??=blankPart()),sec=node('section','hr-part'),k=s.key?.writing?.[part.key];sec.dataset.part=part.key;
  const head=node('header','hr-part-head');head.append(node('h4','',partName(part)),node('span','hr-mono',part.key));sec.append(head);
  const problem=node('details','hr-problem'),summary=node('summary','',T.problem);summary.dataset.hrKey=`problem:${part.key}`;problem.append(summary,runs(part.instruction,node('p','hr-ask')));
  if(part.blocks.length)problem.append(blocks(part.blocks));sec.append(problem);
  const hasText=part.fields.some(f=>f.kind==='text');
  for(const field of part.fields){
   if(!Object.hasOwn(sub.answers,field.id)){sec.append(message('idle',`${field.label} · 이 칸은 내지 않았어요.`));continue;}
   sec.append(field.kind==='text'?textField(part,field,sub,d):choiceField(part,field,sub,d,k));
  }
  if(hasText){
   const corrections=d.marks.filter(m=>m.code!=='+').length,plus=d.marks.filter(m=>m.code==='+').length;
   sec.append(message(plus?'ok':'check',`고칠 곳 ${corrections}/${LIMITS.corrections} · 잘 쓴 곳 ${plus}`,'hr-message hr-mark-count'));
  }
  if(hasText)sec.append(commentView(part,d,true));
  else{const fold=node('details','hr-comment-fold'),summary=node('summary','','한마디 세 줄 쓰기(선택)');summary.dataset.hrKey=`comment-fold:${part.key}`;fold.open=Object.values(d.comment).some(v=>String(v).trim());fold.append(summary,commentView(part,d,false));sec.append(fold);}
  if(k)sec.append(keyView(part,k));
  return sec;
 }
 function choiceField(part,field,sub,d,k){
  const box=node('div','hr-field');box.dataset.field=field.id;const value=sub.answers[field.id];
  box.append(node('p','hr-field-label',field.kind==='grid'?field.label:blankLabel(field.label)?`빈칸 ${field.label}`:`바꿀 문장 · ${field.label}`));
  if(field.kind==='grid'){
   const wrap=node('div','hr-table'),table=node('table'),thead=node('thead'),tr=node('tr'),body=node('tbody');tr.append(node('th','',''));
   for(const column of field.columns){const th=node('th','',column);th.scope='col';tr.append(th);}thead.append(tr);
   (Array.isArray(value)?value:[]).forEach((cells,r)=>{const row=node('tr'),th=node('th','',field.rows[r]??String(r+1));th.scope='row';row.append(th);for(const cell of cells)row.append(node('td','',cell));body.append(row);});
   table.append(thead,body);wrap.append(table);box.append(wrap);
  }else box.append(node('p','hr-answer',typeof value==='string'?value:''));
  const model=k?.model?.[field.id];if(typeof model==='string'&&field.kind==='line'){const p=node('p','hr-model');p.append(node('span','',T.model),doc.createTextNode(model));box.append(p);}
  const current=d.fields[field.id]||null,seg=node('div','hr-seg');seg.setAttribute('role','group');seg.setAttribute('aria-label',`${field.label} 판정`);
  for(const verdict of VERDICTS){
   const b=button(verdict,'hr-seg-button',`verdict:${field.id}:${verdict}`,()=>{if(current?.verdict===verdict)delete d.fields[field.id];else d.fields[field.id]={verdict,reason:current?.reason||''};paint();});
   b.setAttribute('aria-pressed',String(current?.verdict===verdict));b.dataset.verdict=verdict;seg.append(b);
  }
  const reason=node('input','hr-input');reason.type='text';reason.maxLength=LIMITS.reason;reason.value=current?.reason||'';reason.placeholder=current?'예: 뜻은 맞아요. 안내문이라 「-십시오」로 끝내요.':'판정을 고르면 이유를 쓸 수 있어요';reason.disabled=!current;reason.dataset.hrKey=`reason:${field.id}`;
  reason.setAttribute('aria-label',`${field.label} ${T.verdictReason}`);reason.addEventListener('input',()=>{if(d.fields[field.id])d.fields[field.id].reason=reason.value;changed();});
  const row=node('div','hr-verdict');row.append(seg,reason);box.append(row);
  return box;
 }
 function textField(part,field,sub,d){
  const text=String(sub.answers[field.id]??''),n=homeworkLength(text),marks=d.marks.filter(m=>m.field===field.id),box=node('div','hr-field hr-field-text');box.dataset.field=field.id;
  const head=node('div','hr-field-head');head.append(node('p','hr-field-label',field.label),chip(n>=field.min&&n<=field.max?'ok':'check',`${n}자 · ${field.min}~${field.max}자`));box.append(head);
  const essay=node('div','hr-essay');essay.dataset.field=field.id;essay.setAttribute('aria-label',`${field.label} · 학생 글`);
  paragraphsOf(text).forEach((paragraph,index)=>{
   const p=node('p','hr-para');p.dataset.field=field.id;p.dataset.part=part.key;p.dataset.paragraph=String(index);
   for(const seg of markSegments(paragraph,marks)){
    if(seg.mark===undefined){p.append(doc.createTextNode(seg.text));continue;}
    const m=node('mark','',seg.text);m.dataset.code=marks[seg.mark].code;m.title=`〔${marks[seg.mark].code}〕 ${s.content.feedback.codes[marks[seg.mark].code]||''}`;p.append(m);
   }
   essay.append(p);
  });
  box.append(essay,node('p','hr-help',T.select));
  if(marks.length){
   const placed=markPlacements(text,marks),list=node('ol','hr-marks');list.setAttribute('aria-label',`${field.label} 기호 표시`);
   marks.forEach((mark,i)=>{
    const index=d.marks.indexOf(mark),li=node('li','hr-mark');li.dataset.code=mark.code;
    const top=node('div','hr-mark-top');top.append(node('span','hr-code',`〔${mark.code}〕`),node('span','hr-mark-name',s.content.feedback.codes[mark.code]||''),node('q','hr-quote',mark.quote));
    top.append(button(T.remove,'hr-button hr-mark-remove',`mark:remove:${part.key}:${index}`,()=>{d.marks.splice(index,1);paint();}));
    li.append(top);
    if(placed[i]===0)li.append(message('check','글에서 자리를 찾지 못해 학생에게는 목록에만 보여요.','hr-message hr-mark-hint'));
    else if(placed[i]>1)li.append(message('info',`같은 글귀가 ${placed[i]}곳에 함께 표시돼요. 앞뒤 낱말을 더 넣어 고르면 한 곳에만 보여요.`,'hr-message hr-mark-hint'));
    const note=node('input','hr-input');note.type='text';note.maxLength=LIMITS.note;note.value=mark.note||'';note.placeholder=mark.code==='+'?'예: 숫자를 자료와 똑같이 옮겼어요.':'예: 글 전체를 「-다」로';note.dataset.hrKey=`mark:note:${part.key}:${index}`;
    note.setAttribute('aria-label',`〔${mark.code}〕 「${mark.quote}」 ${T.note}`);note.addEventListener('input',()=>{mark.note=note.value;changed();});
    const label=node('label','hr-mark-note');label.append(node('span','',T.note),note);li.append(label);
    list.append(li);
   });
   box.append(list);
  }
  // 글을 끌어 고르기 어려울 때(키보드·화면 읽기 프로그램): 글귀를 직접 적어 붙인다.
  const typed=node('details','hr-typed'),summary=node('summary','',T.typed);summary.dataset.hrKey=`typed:${field.id}`;typed.append(summary);
  const form=node('form','hr-typed-form'),quote=node('input','hr-input'),code=node('select','hr-input'),add=node('button','hr-button',T.typedAdd),err=node('p','hr-help');
  quote.type='text';quote.maxLength=LIMITS.quote;quote.dataset.hrKey=`typed:quote:${field.id}`;quote.setAttribute('aria-label',T.typedQuote);quote.placeholder=T.typedQuote;
  for(const c of CODES){const o=node('option','',`〔${c}〕 ${CODE_SHORT[c]}`);o.value=c;code.append(o);}code.value='체';code.dataset.hrKey=`typed:code:${field.id}`;code.setAttribute('aria-label',T.typedCode);
  add.type='submit';add.dataset.hrKey=`typed:add:${field.id}`;err.setAttribute('role','alert');
  form.append(quote,code,add,err);typed.append(form);
  form.addEventListener('submit',event=>{event.preventDefault();const q=quote.value.trim().normalize('NFC');
   const paragraph=paragraphsOf(text).findIndex(p=>p.normalize('NFC').includes(q));
   if(!q||paragraph<0){err.textContent=T.typedMissing;return;}
   const problem=addMark({field:field.id,part:part.key,quote:q},code.value);if(problem)err.textContent=problem;});
  box.append(typed);
  return box;
 }
 function commentView(part,d,needed){
  const box=node('fieldset','hr-comment');box.append(node('legend','',needed?'한마디 세 줄':'한마디 세 줄(선택)'));
  COMMENT.forEach(([key,tone,example],i)=>{
   const label=node('label','hr-comment-line'),name=node('span','hr-comment-name'),area=node('textarea','hr-input');
   name.append(led(tone),doc.createTextNode(s.content.feedback.comment[i]));
   area.rows=2;area.maxLength=LIMITS.comment;area.value=d.comment[key]||'';area.placeholder=example;area.dataset.hrKey=`comment:${part.key}:${key}`;
   area.addEventListener('input',()=>{d.comment[key]=area.value;changed();});
   label.append(name,area);box.append(label);
  });
  return box;
 }
 function keyView(part,k){
  const details=node('details','hr-key'),summary=node('summary','',T.key);summary.dataset.hrKey=`key:${part.key}`;details.append(summary);
  for(const field of part.fields){
   const model=k.model?.[field.id];if(model===undefined||field.kind==='line')continue;
   const box=node('div','hr-key-model');box.append(node('p','hr-field-label',`${T.model} · ${field.label}`));
   if(Array.isArray(model))model.forEach((row,r)=>box.append(node('p','',`${field.rows?.[r]??r+1} · ${row.join(' / ')}`)));
   else for(const paragraph of model.split('\n\n'))box.append(node('p','',paragraph));
   details.append(box);
  }
  for(const [name,label] of [['accept','인정 범위'],['criteria','채점에서 보는 것'],['mistakes','흔한 실수'],['check','검산']])if(k[name]){const p=node('p','hr-key-line');p.append(node('strong','',label),doc.createTextNode(k[name]));details.append(p);}
  return details;
 }
 function actionsView(row){
  const e=s.editor,sub=row.writing,writing=weekContent(e.week).writing,parts=buildParts(e.draft,writing,sub.answers),isDirty=JSON.stringify(parts)!==e.saved;
  const notes=reviewChecklist(e.draft,writing,sub.answers,s.content.feedback.comment),stale=!!sub.feedback&&sub.feedback.submissionRevision!==sub.revision;
  const box=node('div','hr-actions');box.dataset.dirty=String(isDirty);
  const state=node('p','hr-save-state');
  // 저장·오류 안내는 누른 단추 곁에. 「저장했어요」는 다시 고치기 시작하면 지금 상태로 바꾸고, 오류·확인 안내는 그대로 둔다.
  if(e.notice&&!e.notice.top&&(e.notice.tone!=='ok'||!isDirty))state.append(led(e.notice.tone),doc.createTextNode(e.notice.text));
  else state.append(led(isDirty?'check':e.returnedAt?'ok':'idle'),doc.createTextNode(isDirty?'저장하지 않은 고침이 있어요':e.returnedAt?`${homeworkDate(Date.parse(e.returnedAt))}에 돌려줬어요 · 고치면 학생 화면에 바로 보여요`:e.feedbackRevision?`임시 저장${e.updatedAt?` · ${homeworkDate(Date.parse(e.updatedAt))}`:''} · 학생에게는 아직 안 보여요`:'아직 저장하지 않았어요 · 학생에게는 돌려줄 때 보여요'));
  box.append(state);
  if(notes.length){
   const details=node('details','hr-check'),summary=node('summary');summary.append(led('check'),doc.createTextNode(`돌려주기 전에 볼 것 ${notes.length}`));summary.dataset.hrKey='checklist';
   const ul=node('ul');for(const note of notes)ul.append(node('li','',note.text));details.append(summary,ul);if(e.confirm)details.open=true;box.append(details);
  }else box.append(message('ok','돌려줄 준비가 됐어요.','hr-message hr-check-ok'));
  if(e.confirm){
   const confirm=node('div','hr-confirm');confirm.setAttribute('role','alertdialog');confirm.setAttribute('aria-label','그대로 돌려줄까요');
   confirm.append(node('p','',`볼 것이 ${notes.length}개 남았어요. 그대로 돌려줄까요?${notes.some(n=>n.kind==='empty')?' 첨삭하지 않은 문항은 학생에게 「이 문항 첨삭은 아직이에요」로 보여요.':''}`));
   const buttons=node('div','hr-actions-row'),go=button(T.returnAnyway,'felt-button primary','return:anyway',()=>void saveFeedback(true,{force:true}));go.disabled=!!s.busy;
   buttons.append(go,button(T.keepEditing,'hr-button','return:keep',()=>{e.confirm=false;paint();}));confirm.append(buttons);box.append(confirm);
   return box;
  }
  const buttons=node('div','hr-actions-row');
  if(e.returnedAt){
   const again=button(s.busy==='return'?'돌려주는 중…':T.returnAgain,'felt-button primary','return:again',()=>void saveFeedback(true,{force:true}));again.disabled=!!s.busy||!isDirty;buttons.append(again);
  }else{
   const ret=button(s.busy==='return'?'돌려주는 중…':T.returnNow,'felt-button primary','return:now',()=>void saveFeedback(true));ret.disabled=!!s.busy||!Object.keys(parts).length;
   const draft=button(s.busy==='save'?'저장하는 중…':T.saveDraft,'hr-button','save:draft',()=>void saveFeedback(false));draft.disabled=!!s.busy||!(isDirty||stale);
   buttons.append(ret,draft);
  }
  if(e.returnedAt||e.notice?.next){const next=nextRow();if(next)buttons.append(button(`${T.next} · ${next.name}`,'hr-button','next',()=>chooseLearner(next.learnerId)));else if(e.notice?.next)box.append(message('ok',T.allReturned));}
  box.append(buttons);
  return box;
 }
 // 쓰는 동안에는 다시 그리지 않는다(초점·입력 위치). 저장 줄만 바꾼다.
 function changed(){const row=currentRow(),old=root.querySelector('.hr-actions');if(row?.writing&&old&&s.editor)old.replaceWith(actionsView(row));}

 // ── 글귀 고르기 → 기호 붙이기 ──
 function readSelection(){
  const sel=doc.getSelection?.();if(!sel||!sel.rangeCount||sel.isCollapsed)return null;
  const range=sel.getRangeAt(0),para=n=>(n?.nodeType===1?n:n?.parentElement)?.closest?.('.hr-para'),a=para(range.startContainer),b=para(range.endContainer);
  if(!a&&!b)return null;if(a&&!root.contains(a)||b&&!root.contains(b))return null;
  if(a!==b)return {error:T.span};
  const pre=doc.createRange();pre.selectNodeContents(a);pre.setEnd(range.startContainer,range.startOffset);
  const raw=range.toString(),lead=raw.length-raw.trimStart().length,quote=raw.trim();if(!quote)return null;
  if(quote.length>LIMITS.quote)return {error:`글귀는 ${LIMITS.quote}자까지 고를 수 있어요. 조금 짧게 골라 주세요.`};
  return {field:a.dataset.field,part:a.dataset.part,paragraph:Number(a.dataset.paragraph),start:pre.toString().length+lead,quote};
 }
 // 고른 자리가 학생 화면에서도 그 자리인지(같은 문단의 앞쪽에 같은 글귀가 있으면 앞에 놓인다), 이미 놓인 표시와 겹치는지.
 function placement(sel){
  const e=s.editor,sub=currentRow()?.writing,d=e?.draft[sel.part];if(!sub||!d)return {error:T.span};
  const paragraph=paragraphsOf(sub.answers[sel.field])[sel.paragraph]??'',marks=d.marks.filter(m=>m.field===sel.field),end=sel.start+sel.quote.length;
  if(markSegments(paragraph,marks).some(seg=>seg.mark!==undefined&&seg.start<end&&seg.start+seg.text.length>sel.start))return {error:T.overlap};
  const placed=markSegments(paragraph,[...marks,{quote:sel.quote}]).find(seg=>seg.mark===marks.length);
  return {earlier:!!placed&&placed.start!==sel.start};
 }
 function addMark(sel,code){
  const e=s.editor,d=e?.draft[sel.part];if(!d)return T.span;
  if(code!=='+'&&d.marks.filter(m=>m.code!=='+').length>=LIMITS.corrections)return T.tooManyCorrections;
  if(d.marks.length>=LIMITS.marks)return T.tooManyMarks;
  d.marks.push({field:sel.field,quote:sel.quote,code,note:''});s.selection=null;doc.getSelection?.()?.removeAllRanges?.();paint();return null;
 }
 function markBar(){
  const bar=node('div','hr-markbar');bar.setAttribute('role','region');bar.setAttribute('aria-label','기호 붙이기');
  const sel=s.selection;bar.hidden=!sel;if(!sel)return bar;
  bar.addEventListener('pointerdown',event=>{s.barPointer=Date.now();if(event.target.closest('button'))event.preventDefault();});
  if(sel.error){bar.append(message('check',sel.error,'hr-message hr-markbar-text'),button(T.cancel,'hr-markbar-cancel','markbar:cancel',clearSelection));return bar;}
  const d=s.editor.draft[sel.part],corrections=d.marks.filter(m=>m.code!=='+').length,top=node('div','hr-markbar-top');
  top.append(node('q','hr-quote',sel.quote),node('span','hr-markbar-count',`고칠 곳 ${corrections}/${LIMITS.corrections}`),button(T.cancel,'hr-markbar-cancel','markbar:cancel',clearSelection));bar.append(top);
  if(sel.earlier)bar.append(node('p','hr-markbar-hint',T.earlier));
  if(sel.problem)bar.append(node('p','hr-markbar-hint',sel.problem));
  const codes=node('div','hr-codes');
  for(const code of CODES){
   const b=button('','hr-code-button',`markbar:${code}`,()=>{const problem=addMark(sel,code);if(problem){s.selection={...sel,problem};renderBar();}});
   b.dataset.code=code;b.title=s.content.feedback.codes[code]||'';b.setAttribute('aria-label',`〔${code}〕 ${s.content.feedback.codes[code]||''}`);
   b.disabled=code!=='+'&&corrections>=LIMITS.corrections;b.append(node('span','hr-code',`〔${code}〕`),node('span','hr-code-name',CODE_SHORT[code]));codes.append(b);
  }
  bar.append(codes);
  return bar;
 }
 function renderBar(){const old=root.querySelector('.hr-markbar');if(old)old.replaceWith(markBar());}
 function clearSelection(){s.selection=null;doc.getSelection?.()?.removeAllRanges?.();renderBar();}
 function onSelection(){
  if(s.stopped||!s.editor||root.hidden)return;
  const sel=readSelection();
  if(!sel){if(s.selection&&Date.now()-s.barPointer>800&&!root.querySelector('.hr-markbar')?.contains(doc.activeElement)){s.selection=null;renderBar();}return;}
  const same=s.selection&&!s.selection.error&&!sel.error&&s.selection.field===sel.field&&s.selection.paragraph===sel.paragraph&&s.selection.start===sel.start&&s.selection.quote===sel.quote;if(same)return;
  if(sel.error){s.selection=sel;renderBar();return;}
  const where=placement(sel);s.selection=where.error?{error:where.error}:{...sel,earlier:where.earlier};renderBar();
 }
 doc.addEventListener('selectionchange',onSelection);

 return Object.freeze({
  // 판을 보일 때마다 부른다(내 수업 화면이 다시 그려질 때도). 다른 반이면 처음부터 읽고, 같은 반이면 그대로 둔다 —
  // 쓰는 중인 칸을 다시 그리지 않게. 마지막으로 읽은 지 2분이 넘었고 저장하지 않은 고침이 없을 때만 조용히 새로 읽는다.
  show(classId){
   if(s.stopped||!classId)return;
   if(classId!==s.classId){s.classId=classId;s.generation++;Object.assign(s,{phase:'idle',error:null,data:null,loadedAt:null,week:null,learnerId:null,editor:null,planOpen:false,planNotice:null,notice:null,selection:null,busy:null});}
   if(s.phase==='idle'||s.phase==='error'&&!s.busy)void load();
   else if(s.phase==='ready'&&!s.busy&&!dirty()&&clock()-(s.loadedAt||0)>120000)void load({quiet:true});
  },
  refresh:()=>load(),
  hasDraft:()=>dirty(),
  reset(){s.generation++;Object.assign(s,{classId:null,phase:'idle',error:null,data:null,loadedAt:null,week:null,learnerId:null,editor:null,planOpen:false,planNotice:null,notice:null,selection:null,busy:null});root.replaceChildren();},
  stop(){s.stopped=true;s.generation++;doc.removeEventListener('selectionchange',onSelection);root.replaceChildren();},
 });
}
