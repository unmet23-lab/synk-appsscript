// 내 계정 시트의 「이번 주 과제」(「우리 반 수업」 바로 아래). TOPIK 4급 온라인 반 학생이 그 주의 읽기(R)·쓰기(W) 숙제를 풀어 내고,
// 선생님의 첨삭(기호 표시 + 한마디 세 줄, docs/온라인반_TOPIK4급/첨삭기준.md)을 같은 칸에서 돌려받는다.
// · 문제는 topik4-homework.json에서 읽고, 정답·예시답은 인증된 서버가 해당 주의 제출·첨삭 반환을 확인한 뒤에만 보낸다.
//   정답 파일은 공개 파일이고 원문 문서도 공개 저장소에 있어, 미리 보는 것을 막는 장치는 아니다(설계 §2).
// · 주차는 반의 시작일(startsOn, 한국 날짜)부터 7일씩. 마감은 그 주 첫 수요일 23:00(한국 시간), 늦게 내도 받는다(첨삭기준 §6).
//   주차·마감은 서버 시각(serverTime)으로 고친 시계로 본다(기기 시계가 틀린 폰도 같은 주를 보게).
// · 쓰던 답은 이 기기(localStorage)에만 두고, 「내기」를 눌러야 계정에 저장돼 선생님이 본다. 서버·학생 글은 textContent로만 넣는다.
// · 반이 없는 계정(대부분의 WORLD 계정)에는 칸을 보이지 않는다. 계정이 바뀌면 칸을 닫는다.
export const HOMEWORK_TEXT=Object.freeze({
 title:'이번 주 과제',refresh:'새로고침',loading:'과제를 불러오는 중이에요.',
 error:'과제를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',retry:'다시 불러오기',
 lead:'토요일 수업 뒤에 그 주 과제가 열려요. 읽기 다섯 문항과 쓰기 하나예요.',
 unset:'선생님이 반 시작일을 정하면 이곳에 과제가 열려요.',
 lesson:'이번 주 수업',grammar:'문법·표현',listening:'듣기 숙제',listeningNote:'TOPIK 누리집에서 직접 받아요.',
 reading:'읽기',writing:'쓰기',readingHelp:'다섯 문항',
 notStarted:'아직 안 냈어요',draft:'이 기기에 쓰던 답이 있어요',overdue:'마감이 지났어요 · 늦게 내도 괜찮아요',
 submitted:'냈어요',waiting:'냈어요 · 첨삭은 금요일까지 와요',returned:'첨삭이 왔어요',partly:'첨삭이 일부 왔어요',late:'늦게 냈어요',
 solve:'풀기',write:'쓰기',result:'결과 보기',view:'낸 글 보기',feedback:'첨삭 보기',close:'접기',
 readingSubmit:'답 내기',readingNeedAll:'다섯 문항을 모두 고르면 낼 수 있어요.',correct:'맞았어요',
 reason:'근거',keyLoading:'정답을 불러오는 중이에요.',keyError:'정답을 불러오지 못했어요. 새로고침을 눌러 주세요.',
 keyStale:'수업 자료를 고치는 중이라 정답과 예시답을 아직 맞추지 못했어요. 잠시 뒤 새로고침해 주세요.',
 modelLoading:'예시답을 불러오는 중이에요.',modelError:'예시답을 불러오지 못했어요. 새로고침을 눌러 주세요.',
 writingSubmit:'선생님께 내기',resubmit:'고쳐서 다시 내기',
 saved:'쓰는 글은 이 기기에 임시로 저장돼요. 「선생님께 내기」를 눌러야 선생님이 볼 수 있어요.',
 sending:'내는 중이에요.',sent:'냈어요. 선생님이 금요일까지 첨삭을 돌려줘요.',sentReading:'답을 냈어요. 정답과 근거를 확인해 보세요.',
 sendError:'내지 못했어요. 쓴 글은 이 기기에 그대로 있어요. 잠시 뒤 다시 내 주세요.',
 conflict:'먼저 낸 답이 이미 저장돼 있어요. 새로 불러온 내용을 확인해 주세요.',
 noLearner:'이 계정은 아직 반 학생 명부에 없어요. 선생님께 반 연결을 확인해 주세요.',
 notOpen:'이 주 과제는 아직 열리지 않았어요. 새로고침해 주세요.',
 invalid:'내지 못했어요. 새로고침한 뒤 다시 내 주세요. 쓴 글은 이 기기에 그대로 있어요.',
 locked:'첨삭이 먼저 돌아와서 고친 글은 낼 수 없어요. 고쳐 쓰던 글은 첨삭 아래 「내지 못한 고친 글」에 남겨 두었어요.',
 lockedSame:'첨삭이 먼저 돌아와서 다시 낼 수 없어요. 아래에서 첨삭을 확인해 주세요.',
 readOnly:'이 반에서는 지난 과제 기록만 볼 수 있어요. 새 과제는 위 「우리 반 수업」에서 내 주세요.',
 historyTitle:'지난 과제 기록',historyLead:'전에 낸 답과 이 기기에 남은 초안을 볼 수 있어요.',
 historyNote:'지난 과제 기록만 볼 수 있어요. 새 과제는 위 「우리 반 수업」에서 내요. 전에 낸 답과 이 기기에 남은 초안은 새 과제로 옮겨지지 않아요.',
 waitingNote:'첨삭은 금요일까지 와요',notSent:'안 냈어요',
 changed:'이 과제를 낸 뒤 수업 자료가 고쳐졌어요. 지금 자료로 보여 줘요.',
 retryTitle:'지난주 다시 써 볼 곳',retryField:'다시 쓴 문장',retryMine:'다시 쓴 문장',retryPart:'지난주 쓰기',
 kept:'내지 못한 고친 글',keptShort:'내지 못한 고친 글이 있어요',keptDrop:'이 글 지우기',
 keptHelp:'첨삭이 먼저 돌아와서 고쳐 쓰던 글은 내지 못했어요. 이 기기에만 남아 있으니 선생님 첨삭과 비교하며 읽어 보세요.',
 localDraft:'이 기기에 남은 초안',localDraftHelp:'새 과제로 자동으로 보내지 않아요.',
 marks:'기호 표시',pending:'이 문항 첨삭은 아직이에요.',model:'예시답 보기',criteria:'채점에서 보는 것',
 mine:'내가 쓴 글',past:'지난 과제',example:'예',
 note:'낸 글과 답은 선생님만 봐요. 연습 기록이라 점수나 급수로 바꾸지 않아요.',
});
const T=HOMEWORK_TEXT;
const CIRCLED=['①','②','③','④'];
const DAY=86400000,KST=9*3600000;

// 글자 수: NFC 정규화 뒤 공백·문장부호를 넣고 줄바꿈을 뺀 Unicode 문자 수(수업 자료 검산·변환기와 같다).
export const homeworkLength=text=>[...String(text??'').replace(/\r\n?/g,'\n').normalize('NFC').replace(/\n/g,'')].length;

// ── 주차: 반의 시작일(한국 날짜) 0시부터 7일씩. 마감은 그 주에 처음 오는 dueWeekday(수요일)의 dueTime, 시작일이 수요일이면 다음 주 수요일. ──
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

// ── 첨삭 기호를 학생 글 위에: 같은 칸의 표시만, 글에서 처음 나오는(겹치지 않는) 자리. 못 찾은 표시는 목록에만 남는다. ──
// 줄끝은 글자 수 세기처럼 LF로 맞추고, 글귀 앞뒤의 줄바꿈은 떼고 찾는다(문단 경계에 기호가 걸리지 않게).
// 글귀가 글자(자소 묶음) 가운데서 시작하거나 끝나는 자리는 건너뛴다(👍🏽의 피부색이 떨어지지 않게).
const homeworkPlain=value=>String(value??'').replace(/\r\n?/g,'\n').normalize('NFC');
function homeworkEdges(source){
 if(typeof Intl?.Segmenter!=='function')return null;
 const edges=new Set([source.length]);for(const {index} of new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(source))edges.add(index);return edges;
}
export function markSegments(text,marks){
 const source=homeworkPlain(text),edges=homeworkEdges(source),ranges=[];
 marks.forEach((mark,index)=>{
  const quote=homeworkPlain(mark.quote).replace(/^\n+|\n+$/g,'');if(!quote)return;
  for(let from=0;;){const at=source.indexOf(quote,from);if(at<0)return;const end=at+quote.length;
   if(ranges.some(r=>at<r.end&&end>r.start)||edges&&!(edges.has(at)&&edges.has(end))){from=at+1;continue;}ranges.push({start:at,end,index});return;}
 });
 ranges.sort((a,b)=>a.start-b.start);const out=[];let pos=0;
 for(const r of ranges){if(r.start>pos)out.push({text:source.slice(pos,r.start)});out.push({text:source.slice(r.start,r.end),mark:r.index});pos=r.end;}
 if(pos<source.length)out.push({text:source.slice(pos)});
 return out;
}
// 문단마다 그릴 조각: 표시 자리는 칸 글 전체에서 한 번 정하고(같은 글귀가 여러 문단에 있어도 한 자리), 빈 줄에서 문단을 나눈다.
// 문단을 넘는 표시는 마지막 조각(end)에만 기호를 단다.
export function markParagraphs(text,marks){
 const paragraphs=[[]];
 for(const seg of markSegments(text,marks))seg.text.split(/\n{2,}/).forEach((piece,i,pieces)=>{
  if(i)paragraphs.push([]);const end=i===pieces.length-1;
  if(seg.mark===undefined){if(piece)paragraphs.at(-1).push({text:piece});}
  else if(piece||end)paragraphs.at(-1).push({text:piece,mark:seg.mark,...(end?{end:true}:{})});
 });
 return paragraphs;
}
// ── 읽기 결과: 고른 번호와 정답(정답 자료가 있을 때만) ──
export function readingOutcome(items,answers,key){
 return items.map(item=>{const chosen=answers?.[item.id]??null,answer=key?.reading?.[item.id]?.answer??null;return {id:item.id,chosen,answer,correct:answer!==null&&chosen===answer};});
}
// ── 비어 있는 칸(글·한 줄·표의 모든 칸이 차야 낸다) ──
export function missingFields(fields,answers){
 const empty=[];
 for(const field of fields){
  const value=answers?.[field.id];
  if(field.kind==='grid'){const rows=Array.isArray(value)?value:[];field.rows.forEach((row,r)=>field.columns.forEach((column,c)=>{if(!String(rows[r]?.[c]??'').trim())empty.push({id:field.id,row:r,column:c,label:`${field.label} ${row} · ${column}`});}));}
  else if(!String(value??'').trim())empty.push({id:field.id,label:field.label});
 }
 return empty;
}
// 쓰던 답: 계정·반·과제(R3·W3)마다 한 칸. 읽지 못하면 없는 것으로 본다.
export const homeworkDraftKey=(owner,classId,assignment)=>`synk.world.homework.v1:${owner}:${classId}:${assignment}`;
function readDraft(storage,key){try{const value=JSON.parse(storage?.getItem(key)||'null');return value&&value.v===1&&value.answers&&typeof value.answers==='object'?value:null;}catch{return null;}}
function writeDraft(storage,key,value,savedAt=Date.now()){try{storage?.setItem(key,JSON.stringify({v:1,...value,savedAt}));return true;}catch{return false;}}
function dropDraft(storage,key){try{storage?.removeItem(key);}catch{}}
// 내기 요청 번호를 다시 쓸지 정하는 지문: 키 차례와 상관없이 같은 내용이면 같은 글자열(서버의 같은 요청 판정과 같은 갈래·답·다시 쓴 줄·자료 판).
export const homeworkSignature=value=>JSON.stringify(value,(name,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);

export function mountClassroomHomework({container,load,submit,loadContent,loadKey,owner,storage=globalThis.localStorage,guard=()=>{},now=Date.now,randomId=()=>globalThis.crypto.randomUUID()}){
 const doc=container.ownerDocument;
 const node=(tag,className,value)=>{const el=doc.createElement(tag);if(className)el.className=className;if(value!==undefined&&value!==null)el.textContent=value;return el;};
 const led=tone=>{const el=node('i','ws-led');el.dataset.tone=tone;el.setAttribute('aria-hidden','true');return el;};
 const button=(label,className,key,onClick)=>{const el=node('button',className,label);el.type='button';el.dataset.homeworkKey=key;el.addEventListener('click',onClick);return el;};
 const meta=(tone,value,className='ws-hw-meta')=>{const el=node('p',className);el.append(led(tone),doc.createTextNode(value));return el;};
 // 문서의 꾸밈 그대로: 문자열 | {b} 굵게 | {u} 밑줄
 const runs=(segments,el)=>{for(const s of segments)el.append(typeof s==='string'?doc.createTextNode(s):s.u!==undefined?node('u','',s.u):node('strong','',s.b));return el;};
 function blocks(list,className='ws-hw-passage'){
  const box=node('div',className);
  for(const block of list||[]){
   if(block.p){const p=node('p');block.p.forEach((line,i)=>{if(i)p.append(node('br'));runs(line,p);});box.append(p);}
   else if(block.list){const ul=node('ul');for(const item of block.list)ul.append(runs(item,node('li')));box.append(ul);}
   else if(block.h)box.append(node('p','ws-hw-data',block.h));
   else if(block.box){const b=node('div','ws-hw-box');b.append(node('span','ws-hw-box-label','보기'),runs(block.box,node('p')));box.append(b);}
   else if(block.table){
    const wrap=node('div','ws-hw-table'),table=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
    block.table.head.forEach((cell,i)=>{const th=runs(cell,node('th'));th.scope='col';if(block.table.align[i]==='right')th.dataset.align='right';hr.append(th);});
    for(const row of block.table.rows){const tr=node('tr');row.forEach((cell,i)=>{const td=runs(cell,node('td'));if(block.table.align[i]==='right')td.dataset.align='right';tr.append(td);});body.append(tr);}
    head.append(hr);table.append(head,body);wrap.append(table);box.append(wrap);
   }
  }
  return box;
 }

 const root=node('section','ws-hw'),headingId='ws-hw-'+Math.random().toString(36).slice(2,10);
 root.dataset.label='HOMEWORK';root.dataset.state='loading';root.setAttribute('aria-labelledby',headingId);root.hidden=true;
 const head=node('div','ws-hw-head'),title=node('h3','',T.title);title.id=headingId;head.append(title,button(T.refresh,'quiet-button','refresh',()=>start()));
 const status=node('p','ws-hw-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const alert=node('div','ws-hw-alert');alert.setAttribute('role','alert');alert.hidden=true;
 const body=node('div','ws-hw-body');
 root.append(head,node('p','ws-hw-lead',T.lead),status,alert,body,node('p','ws-hw-note',T.note));
 container.append(root);

 const model={phase:'loading',seen:false,classes:[],content:null,key:null,keyState:'idle',open:null,editing:new Set(),notice:new Map(),busy:null,requests:new Map(),skew:0};
 let disposed=false,generation=0;
 const assignmentOf=(kind,week)=>(kind==='reading'?'R':'W')+week;
 const taskKey=(classId,week,kind)=>`${classId}:${week}:${kind}`;
 const submissionOf=(c,week,kind)=>c.submissions.find(s=>s.week===week&&s.kind===kind)||null;
 const weekContent=week=>model.content?.weeks?.[week-1]||null;
 // 서버 시계: 서버 답의 serverTime과 이 기기 시계의 차이를 받을 때마다 고친다(서버 시각은 요청을 보낸 때와 받은 때의 가운데로 본다).
 const clock=()=>now()+model.skew;
 const learnClock=(serverTime,sent)=>{const at=Date.parse(serverTime||'');if(Number.isFinite(at))model.skew=at-(Number.isFinite(sent)?(sent+now())/2:now());};
 // 낸 시각을 모르면(꼴이 틀린 답) 이 기기의 쓰던 글을 남긴다.
 const olderThan=(draft,sub)=>{const at=Date.parse(sub?.submittedAt||'');return Number.isFinite(at)&&draft.savedAt<at;};
 const changedNote=sub=>sub?.contentVersion&&sub.contentVersion!==model.content.version?meta('idle',T.changed,'ws-hw-help'):null;
 // 다시 써 볼 곳은 빈 줄을 빼고 앞뒤 공백을 떼어 견준다(서버가 받는 꼴과 같다 — homework-client.mjs homeworkSubmission).
 const cleanRetry=retry=>Object.fromEntries(Object.entries(retry||{}).filter(([,line])=>typeof line==='string'&&line.trim()).map(([k,line])=>[k,line.trim()]));
 // 글자가 하나라도 있는 초안만 남겨 보인다(썼다가 다 지운 칸, 쓰기 칸을 열 때 만든 빈 표는 빈 초안이다). 읽기 답은 고른 번호다.
 const blankValue=value=>Array.isArray(value)?value.every(row=>Array.isArray(row)?row.every(cell=>!String(cell??'').trim()):!String(row??'').trim()):!String(value??'').trim();
 const draftFilled=draft=>!!draft&&(Object.values(draft.answers||{}).some(value=>typeof value==='number'||!blankValue(value))||Object.keys(cleanRetry(draft.retry)).length>0);
 // 낸 글이 있는 과제의 쓰던 답은 낸 시각보다 앞선 시각으로 적지 않는다(서버 시계 보정이 흔들려도 「낸 뒤에 고친 글」로 남게).
 const draftTime=sub=>{const at=Date.parse(sub?.submittedAt||'');return Number.isFinite(at)?Math.max(clock(),at+1):clock();};
 const sameAsSent=(draft,sub)=>homeworkSignature({answers:draft.answers,retry:cleanRetry(draft.retry)})===homeworkSignature({answers:sub.answers,retry:cleanRetry(sub.retry)});
 // 첨삭이 먼저 돌아와 내지 못한 고친 글: 낸 시각보다 뒤에 이 기기에서 고쳤고, 글자가 있으며, 낸 글과 내용이 다르다.
 const unsentRewrite=(draft,sub)=>draftFilled(draft)&&!!sub&&!olderThan(draft,sub)&&!sameAsSent(draft,sub);
 // 학생 화면의 쓰기 갈래 이름: 내부 번호(W3-1) 대신 그 주 자료의 「53번 문제」. 자료에서 못 찾으면 「지난주 쓰기」.
 // 쓰기 파트 이름 「51번 · 문제 1」: 자료의 이름이 이미 번호로 시작하면(7주차 「51번」) 번호를 두 번 쓰지 않는다.
 const partLabel=(part,sep)=>{const n=part.number?`${part.number}번`:null,label=String(part.label||'');return n&&!label.startsWith(n)?[n,label].filter(Boolean).join(sep):label||n||'';};
 const partName=(week,partKey)=>{const part=weekContent(week)?.writing?.parts?.find(p=>p.key===partKey);return part?partLabel(part,' '):T.retryPart;};
 // 정답·예시답을 아직 못 받았을 때 한 줄: 받는 중 · 못 받음 · 자료 판이 아직 안 맞음(받기 전이면 없음).
 const keyNote=(loading,error,className='ws-hw-help')=>model.keyState==='loading'?meta('idle',loading,className):model.keyState==='error'?meta('alert',error,className):model.keyState==='stale'?meta('check',T.keyStale,className):null;
 // 내기 답은 그 반 하나만 온다. 다른 반은 그대로 두고 그 반만 바꾼다.
 const mergeClasses=list=>[...model.classes.map(c=>list.find(n=>n.classId===c.classId)||c),...list.filter(n=>!model.classes.some(c=>c.classId===n.classId))];
 // 낸 것보다 오래된 쓰던 답(다른 기기에서 고쳐 냈거나 응답이 끊긴 뒤 남은 것)과 낸 읽기의 쓰던 답은 지운다.
 // 첨삭이 돌아온 쓰기는 낸 글과 같은 쓰던 답만 지우고, 첨삭이 먼저 와서 내지 못한 고친 글은 첨삭 아래에 보이도록 남긴다.
 function dropStaleDrafts(){
  for(const c of model.classes.filter(c=>!c.readOnly))for(const s of c.submissions){
   const key=homeworkDraftKey(owner,c.classId,assignmentOf(s.kind,s.week)),draft=readDraft(storage,key);
   if(!draft||s.kind==='writing'&&s.feedback&&unsentRewrite(draft,s))continue;
   if(s.kind==='reading'||s.feedback||olderThan(draft,s))dropDraft(storage,key);
  }
 }

 // 정답·예시답은 낸 것이 있을 때만 서버에서 읽는다(실패하면 새로고침 때 다시).
 // 받는 사이 새로 낸 주가 생기면 이어서 받고, 정답 판이 화면 자료 판과 다르면(자료를 막 고친 때) 자료를 한 번 새로 읽어 맞춘다.
 const receivedKeys=new Set(),rowKey=row=>`${row.classId}:${row.week}:${row.kind}`;
 const keyRows=()=>model.classes.flatMap(c=>c.submissions.filter(s=>s.kind==='reading'||s.feedback).map(s=>({classId:c.classId,week:s.week,kind:s.kind}))).filter(row=>!receivedKeys.has(rowKey(row)));
 function forgetKeys(){model.key=null;receivedKeys.clear();}
 // 새로고침 단추를 누르면 받던 정답 묶음은 버린다(번호가 바뀌면 끝나도 상태를 건드리지 않는다). 계정이 바뀌면 칸을 닫는다.
 let keyTicket=0;
 async function needKey(){
  if(model.keyState==='loading'||typeof loadKey!=='function')return;
  let rows=keyRows(),reloaded=false;if(!rows.length)return;
  const ticket=++keyTicket,current=()=>!disposed&&ticket===keyTicket;
  model.keyState='loading';
  try{
   while(rows.length){
    const got=await Promise.all(rows.map(async row=>{guard();const key=await loadKey(row);guard();return {row,key};}));
    if(!current())return;
    if(got.some(({key})=>!key||typeof key.version!=='string'))throw Error('HOMEWORK_KEY');
    if(got.some(({key})=>key.version!==model.content?.version)){
     const fresh=reloaded?null:await loadContent();guard();if(!current())return;reloaded=true;
     if(!fresh?.weeks?.length||got.some(({key})=>key.version!==fresh.version)){model.keyState='stale';return;}
     model.content=fresh;forgetKeys();rows=keyRows();continue;
    }
    for(const {row,key} of got){
     model.key??={version:key.version,reading:{},writing:{}};
     const prefix=(row.kind==='reading'?'R':'W')+row.week+'-';
     Object.assign(model.key[row.kind],Object.fromEntries(Object.entries(key[row.kind]||{}).filter(([id])=>id.startsWith(prefix))));
     receivedKeys.add(rowKey(row));
    }
    rows=keyRows();
   }
   model.keyState='ready';
  }catch(error){
   if(error?.code==='ACCOUNT_CHANGED'){close();return;}
   if(current())model.keyState='error';
  }finally{if(current())paint();}
 }
 function close(){generation++;root.hidden=true;model.phase='closed';}

 // ── 한 과제 줄 ──
 function taskState(c,week,kind,window){
  const sub=submissionOf(c,week,kind),draft=readDraft(storage,homeworkDraftKey(owner,c.classId,assignmentOf(kind,week))),overdue=window&&clock()>window.due;
  if(kind==='writing'&&sub?.feedback){
   const parts=weekContent(week)?.writing.parts||[],done=parts.filter(p=>sub.feedback.parts[p.key]).length,kept=!c.readOnly&&unsentRewrite(draft,sub);
   return {sub,tone:'ok',text:[done>=parts.length?T.returned:T.partly,kept?T.keptShort:null].filter(Boolean).join(' · '),action:T.feedback};
  }
  if(sub){
   if(kind==='reading'){const right=receivedKeys.has(`${c.classId}:${week}:reading`)?readingOutcome(weekContent(week)?.reading.items||[],sub.answers,model.key).filter(o=>o.correct).length:null;
    return {sub,tone:'ok',text:[T.submitted,sub.late?T.late:null,right===null?null:`${Object.keys(sub.answers).length}문항 중 ${right}문항 맞힘`].filter(Boolean).join(' · '),action:T.result};}
   // 지난 과제 기록(이력 보기) 반은 첨삭을 기다리지 않는다.
   const wait=c.readOnly?T.submitted:T.waiting;
   return {sub,tone:'info',text:sub.late?`${wait} · ${T.late}`:wait,action:T.view};
  }
  if(draftFilled(draft))return {sub:null,draft,tone:overdue?'check':'info',text:overdue?`${T.draft} · ${T.overdue}`:T.draft,action:kind==='reading'?T.solve:T.write};
  return {sub:null,tone:overdue?'check':'idle',text:overdue?T.overdue:T.notStarted,action:kind==='reading'?T.solve:T.write};
 }
 function task(c,week,kind,window){
  const content=weekContent(week),key=taskKey(c.classId,week,kind),open=model.open===key,state=taskState(c,week,kind,window);
  const el=node('article','ws-hw-task');el.dataset.kind=kind;el.dataset.week=String(week);el.dataset.status=state.sub?(state.sub.feedback?'returned':'submitted'):state.draft?'draft':'none';
  const headRow=node('div','ws-hw-task-head'),textBox=node('div','ws-hw-task-text');
  const titleText=kind==='reading'?`${T.reading} ${content.reading.id} · ${content.reading.title.replace(/\(([^)]*)\)$/,(all,inner)=>inner.length>12?'':all)}`:`${T.writing} ${content.writing.id} · ${content.writing.title}`;
  const help=kind==='reading'?T.readingHelp:writingHelp(content.writing);
  textBox.append(meta(state.tone,state.text),node('strong','ws-hw-task-title',titleText),node('p','ws-hw-help',help));
  headRow.append(textBox,button(open?T.close:c.readOnly?(state.sub?'기록 보기':'초안 보기'):state.action,'plain-button',`open:${key}`,()=>{model.open=open?null:key;paint();if(!open)el.querySelector('.ws-hw-panel')?.scrollIntoView?.({block:'nearest'});}));
  el.append(headRow);
  const notice=model.notice.get(key);if(notice)el.append(meta(notice.tone,notice.text,'ws-hw-notice'));
  if(open){const panel=node('div','ws-hw-panel');if(c.readOnly&&!state.sub){if(state.draft)panel.append(draftView(c,week,kind,state.draft,{title:T.localDraft,help:T.localDraftHelp}));}else panel.append(kind==='reading'?readingPanel(c,week,state):writingPanel(c,week,state));el.append(panel);}
  return el;
 }
 // 이 기기에만 남은 글: 첨삭이 먼저 와서 내지 못한 고친 글, 이력 보기 반의 초안. 읽기는 문항 차례와 고른 번호로, 쓰기는 칸과 다시 써 볼 곳까지.
 // 다시 써 볼 곳은 낸 것(sub)과 다른 줄만 보인다(같은 줄은 위 「다시 쓴 문장」에 이미 있다).
 function draftView(c,week,kind,draft,{title,help,tone='idle',sub=null}){
  const s=node('section','ws-hw-kept'),assignment=assignmentOf(kind,week);s.dataset.kind=kind;
  s.append(node('h5','',title),meta(tone,help,'ws-hw-help'));
  if(kind==='reading')(weekContent(week)?.reading.items||[]).forEach((item,index)=>{const n=draft.answers?.[item.id];if(Number.isInteger(n))s.append(node('p','ws-hw-mine',`${String(index+1).padStart(2,'0')} · ${CIRCLED[n-1]||n}`));});
  else{
   // 빈 칸은 건너뛰고, 표는 글자가 있는 줄만(빈 칸은 「—」).
   for(const part of weekContent(week)?.writing.parts||[])for(const field of part.fields){
    const value=draft.answers?.[field.id];if(value===undefined||blankValue(value))continue;
    if(field.kind!=='grid'){s.append(answerView(field,value));continue;}
    const set=node('div','ws-hw-grid ws-hw-readonly');set.append(node('p','ws-hw-field-label',field.label));
    (Array.isArray(value)?value:[]).forEach((row,r)=>{if(blankValue(row))return;const name=field.rows[r]||'';set.append(node('p','ws-hw-mine',`${/^\d+$/.test(name)?name+'.':name} ${(Array.isArray(row)?row:[row]).map(cell=>String(cell??'').trim()||'—').join(' / ')}`.trim()));});
    s.append(set);
   }
   const sent=cleanRetry(sub?.retry);
   for(const [partKey,line] of Object.entries(cleanRetry(draft.retry)))if(sent[partKey]!==line)s.append(node('p','ws-hw-mine',`${T.retryMine} · ${partName(week-1,partKey)} · ${line}`));
  }
  s.append(button(T.keptDrop,'plain-button ws-hw-kept-drop',`draft-drop:${c.classId}:${week}:${kind}`,()=>{dropDraft(storage,homeworkDraftKey(owner,c.classId,assignment));paint();}));
  return s;
 }
 function writingHelp(w){
  const sizes=w.parts.flatMap(p=>p.fields.filter(f=>f.kind==='text').map(f=>`${f.min}~${f.max}자`));
  const numbers=[...new Set(w.parts.map(p=>p.number).filter(Boolean))];
  return [numbers.length?numbers.map(n=>`${n}번`).join('·')+' 유형':null,sizes.length?sizes.join(' · '):`${w.parts.reduce((n,p)=>n+p.fields.length,0)}칸`].filter(Boolean).join(' · ');
 }

 // ── 읽기: 다섯 문항 고르기 → 답 내기 → 정답·근거 ──
 function readingPanel(c,week,state){
  const content=weekContent(week).reading,box=node('div','ws-hw-reading'),draftKey=homeworkDraftKey(owner,c.classId,content.id);
  const submitted=state.sub?.answers||null,answers=submitted||{...(readDraft(storage,draftKey)?.answers||{})};
  const outcome=submitted&&receivedKeys.has(`${c.classId}:${week}:reading`)?readingOutcome(content.items,submitted,model.key):null;
  if(submitted){
   if(outcome){const right=outcome.filter(o=>o.correct).length;box.append(meta('ok',`${content.items.length}문항 중 ${right}문항을 맞혔어요.`,'ws-hw-summary'));}
   else box.append(keyNote(T.keyLoading,T.keyError,'ws-hw-summary')||meta('idle',T.keyLoading,'ws-hw-summary'));
   const note=changedNote(state.sub);if(note)box.append(note);
  }
  const list=node('ol','ws-hw-items');
  content.items.forEach((item,index)=>{
   const li=node('li','ws-hw-item');li.dataset.item=item.id;
   li.append(node('p','ws-hw-item-label',`${String(index+1).padStart(2,'0')} · ${item.label}`),node('p','ws-hw-ask',item.instruction));
   if(item.notes)li.append(blocks(item.notes,'ws-hw-notes'));
   // 같은 글을 쓰는 문항은 내부 번호(R8-1) 대신 이 목록의 차례로 알린다.
   if(item.samePassageAs){const same=content.items.findIndex(x=>x.id===item.samePassageAs);li.append(node('p','ws-hw-same',same>=0?`${String(same+1).padStart(2,'0')}번 문항과 같은 글이에요.`:'앞 문항과 같은 글이에요.'));}
   li.append(blocks(item.passage));
   const group=node('div','ws-hw-options');group.setAttribute('role','radiogroup');group.setAttribute('aria-label',`${String(index+1).padStart(2,'0')}번 문항 보기`);
   if(item.options.every(option=>option.length<=12))group.dataset.short='';
   // 정답·오답 점은 낸 뒤 정답 자료가 있을 때만(내기 전에 고른 보기는 흰 바탕만).
   if(submitted&&outcome)group.dataset.result='';
   item.options.forEach((option,i)=>{
    const n=i+1,chosen=answers[item.id]===n;
    const b=button('', 'ws-hw-option',`option:${c.classId}:${item.id}:${n}`,()=>{if(submitted)return;answers[item.id]=n;writeDraft(storage,draftKey,{answers},clock());paint();});
    b.setAttribute('role','radio');b.setAttribute('aria-checked',String(chosen));b.append(node('span','ws-hw-mark',CIRCLED[i]),node('span','',option));
    if(submitted){b.disabled=true;const o=outcome?.[index];if(o&&o.answer===n)b.dataset.answer='true';if(chosen)b.dataset.chosen='true';}
    else if(chosen)b.dataset.chosen='true';
    group.append(b);
   });
   li.append(group);
   const o=outcome?.[index];
   if(o){
    const k=model.key.reading[item.id];
    li.append(meta(o.correct?'ok':'alert',o.correct?T.correct:`정답은 ${CIRCLED[o.answer-1]}예요`,'ws-hw-judge'));
    const why=node('div','ws-hw-why');why.append(node('p','',`${T.reason} · ${k.reason}`));
    if(!o.correct&&o.chosen&&k.wrong[o.chosen])why.append(node('p','',`고른 ${CIRCLED[o.chosen-1]} · ${k.wrong[o.chosen]}`));
    li.append(why);
   }
   list.append(li);
  });
  box.append(list);
  if(!submitted){
   const picked=content.items.filter(item=>answers[item.id]).length,ready=picked===content.items.length;
   box.append(node('p','ws-hw-count',`${content.items.length}문항 중 ${picked}문항을 골랐어요.${ready?'':' '+T.readingNeedAll}`));
   const send=button(model.busy===taskKey(c.classId,week,'reading')?T.sending:T.readingSubmit,'felt-button ws-hw-send',`send:${c.classId}:${week}:reading`,()=>send_(c,week,'reading',{answers:{...answers}}));
   send.disabled=!ready||!!model.busy;box.append(send);
  }else{const local=readOnlyDraft(c,week,'reading',state.sub);if(local)box.append(local);}
  return box;
 }

 // ── 쓰기: 문제·자료 → 칸 → (지난주 다시 써 볼 곳) → 선생님께 내기 / 낸 글 / 첨삭 ──
 function writingPanel(c,week,state){
  const w=weekContent(week).writing,key=taskKey(c.classId,week,'writing'),draftKey=homeworkDraftKey(owner,c.classId,w.id);
  if(state.sub?.feedback)return feedbackView(c,week,state.sub);
  if(state.sub&&!model.editing.has(key))return submittedView(c,week,state.sub);
  const box=node('div','ws-hw-write'),draft=readDraft(storage,draftKey);
  const answers=structuredClone(draft?.answers||state.sub?.answers||{}),retry={...(draft?.retry||state.sub?.retry||{})};
  // 「아직 비어 있는 칸」 안내는 다시 쓰기 시작하면 지운다(입력 중에는 칸을 다시 그리지 않으므로 그 줄만 뗀다).
  const save=()=>{writeDraft(storage,draftKey,{answers,retry},draftTime(state.sub));if(model.notice.get(key)?.tone==='check'){model.notice.delete(key);root.querySelector(`.ws-hw-task[data-kind="writing"][data-week="${week}"]>.ws-hw-notice`)?.remove();}};
  if(w.intro)box.append(blocks(w.intro,'ws-hw-intro'));
  for(const part of w.parts){
   const section=node('section','ws-hw-part');section.dataset.part=part.key;
   section.append(node('h5','',partLabel(part,' · ')),runs(part.instruction,node('p','ws-hw-ask')));
   if(part.blocks.length)section.append(blocks(part.blocks));
   for(const field of part.fields)section.append(fieldInput(field,answers,save));
   box.append(section);
  }
  // 지난주 첨삭의 「다시 써 볼 곳」: 이번 과제와 함께 낸다(첨삭기준 §6).
  const before=week>1?submissionOf(c,week-1,'writing'):null;
  for(const [partKey,part] of Object.entries(before?.feedback?.parts||{}))if(part.comment?.retry){
   const s=node('section','ws-hw-retry');s.append(node('h5','',`${T.retryTitle} · ${partName(week-1,partKey)}`),node('p','ws-hw-ask',part.comment.retry));
   const label=node('label','ws-hw-field'),area=node('textarea');area.rows=2;area.maxLength=600;area.value=retry[partKey]||'';area.dataset.homeworkKey=`retry:${key}:${partKey}`;
   area.addEventListener('input',()=>{retry[partKey]=area.value;save();});
   label.append(node('span','ws-hw-field-label',T.retryField),area);s.append(label);box.append(s);
  }
  box.append(node('p','ws-hw-save',T.saved));
  const send=button(model.busy===key?T.sending:state.sub?T.resubmit:T.writingSubmit,'felt-button ws-hw-send',`send:${c.classId}:${week}:writing`,()=>{
   const missing=missingFields(w.parts.flatMap(p=>p.fields),answers);
   if(missing.length){model.notice.set(key,{tone:'check',text:`아직 비어 있는 칸이 있어요: ${missing[0].label}`});paint();
    const first=missing[0];const target=root.querySelector(`[data-homework-key="field:${key}:${first.id}${first.row!==undefined?`:${first.row}:${first.column}`:''}"]`);target?.focus();return;}
   send_(c,week,'writing',{answers:structuredClone(answers),retry:{...retry},expectedRevision:state.sub?.revision||0});
  });
  send.disabled=!!model.busy;box.append(send);
  return box;
  function fieldInput(field,answers,save){
   const fieldKey=`field:${key}:${field.id}`;
   if(field.kind==='grid'){
    const set=node('fieldset','ws-hw-grid');set.append(node('legend','',field.label));
    if(field.example){const ex=node('div','ws-hw-example');ex.append(node('p','ws-hw-field-label',`${T.example} · ${field.columns.join(' / ')}`));for(const row of field.example)ex.append(node('p','',row.join(' / ')));set.append(ex);}
    const rows=Array.isArray(answers[field.id])?answers[field.id]:(answers[field.id]=field.rows.map(()=>field.columns.map(()=>'')));
    field.rows.forEach((row,r)=>{
     const line=node('div','ws-hw-grid-row');line.style.setProperty('--hw-columns',String(field.columns.length));line.append(node('p','ws-hw-grid-name',/^\d+$/.test(row)?`${row}.`:row));
     field.columns.forEach((column,col)=>{const label=node('label','ws-hw-field'),area=node('textarea');area.rows=2;area.maxLength=600;rows[r]??=[];area.value=rows[r][col]||'';area.dataset.homeworkKey=`${fieldKey}:${r}:${col}`;
      area.addEventListener('input',()=>{rows[r][col]=area.value;save();});label.append(node('span','ws-hw-field-label',column),area);line.append(label);});
     set.append(line);
    });
    return set;
   }
   const label=node('label','ws-hw-field'),area=node('textarea');area.dataset.homeworkKey=fieldKey;area.value=typeof answers[field.id]==='string'?answers[field.id]:'';
   label.append(node('span','ws-hw-field-label',field.label));
   if(field.kind==='text'){
    area.rows=8;area.maxLength=4000;area.dataset.kind='text';
    const counter=node('span','ws-hw-counter'),counterId=`${headingId}-${field.id}`;counter.id=counterId;area.setAttribute('aria-describedby',counterId);
    const count=()=>{const n=homeworkLength(area.value);counter.textContent=`${n}자 · ${field.min}~${field.max}자`;counter.dataset.tone=n>=field.min&&n<=field.max?'ok':n===0?'idle':'check';};
    area.addEventListener('input',()=>{answers[field.id]=area.value;save();count();});count();label.append(area,counter);
   }else{area.rows=2;area.maxLength=600;area.addEventListener('input',()=>{answers[field.id]=area.value;save();});label.append(area);}
   return label;
  }
 }
 function answerView(field,value){
  if(field.kind==='grid'){const set=node('div','ws-hw-grid ws-hw-readonly');set.append(node('p','ws-hw-field-label',field.label));(Array.isArray(value)?value:[]).forEach((row,r)=>{const line=node('p','ws-hw-mine');line.textContent=`${/^\d+$/.test(field.rows[r]||'')?field.rows[r]+'.':field.rows[r]||''} ${row.join(' / ')}`.trim();set.append(line);});return set;}
  const box=node('div','ws-hw-answer');box.append(node('p','ws-hw-field-label',field.label));
  for(const paragraph of homeworkPlain(value).split(/\n{2,}/))box.append(node('p','ws-hw-mine',paragraph));
  return box;
 }
 function retryView(sub){
  const entries=Object.entries(sub.retry||{});if(!entries.length)return null;
  const s=node('section','ws-hw-retry');s.append(node('h5','',T.retryMine));for(const [partKey,line] of entries)s.append(node('p','ws-hw-mine',`${partName(sub.week-1,partKey)} · ${line}`));return s;
 }
 // 이력 보기 반: 낸 글과 다른 초안이 이 기기에 남아 있으면 함께 보인다(새 과제로 보내지 않는다).
 // 다른 기기에서 내기 전에 이 기기에서 쓰다 만 옛 초안(낸 시각보다 오래된 것)과 빈 초안은 보이지 않는다.
 function readOnlyDraft(c,week,kind,sub){
  if(!c.readOnly)return null;
  const draft=readDraft(storage,homeworkDraftKey(owner,c.classId,assignmentOf(kind,week)));
  if(!draftFilled(draft)||olderThan(draft,sub))return null;
  const differs=kind==='reading'?homeworkSignature(draft.answers)!==homeworkSignature(sub.answers):!sameAsSent(draft,sub);
  return differs?draftView(c,week,kind,draft,{title:T.localDraft,help:T.localDraftHelp,sub}):null;
 }
 function submittedView(c,week,sub){
  const w=weekContent(week).writing,box=node('div','ws-hw-write'),key=taskKey(c.classId,week,'writing');
  const when=sub.submittedAt?`${homeworkDate(Date.parse(sub.submittedAt))}에 냈어요`:T.submitted;
  box.append(meta('info',c.readOnly?when:`${when} · ${T.waitingNote}`,'ws-hw-summary'));
  const note=changedNote(sub);if(note)box.append(note);
  for(const part of w.parts){const s=node('section','ws-hw-part');s.append(node('h5','',partLabel(part,' · ')));for(const field of part.fields)s.append(answerView(field,sub.answers[field.id]));box.append(s);}
  const retry=retryView(sub);if(retry)box.append(retry);
  const local=readOnlyDraft(c,week,'writing',sub);if(local)box.append(local);
  if(!c.readOnly)box.append(button(T.resubmit,'plain-button ws-hw-again',`edit:${key}`,()=>{
   // 이 기기의 쓰던 글이 낸 글보다 오래됐으면(다른 기기에서 고쳐 냈으면) 낸 글에서 다시 시작한다.
   const draftKey=homeworkDraftKey(owner,c.classId,w.id),draft=readDraft(storage,draftKey);
   if(!draft||olderThan(draft,sub))writeDraft(storage,draftKey,{answers:structuredClone(sub.answers),retry:{...(sub.retry||{})}},draftTime(sub));
   model.editing.add(key);model.notice.delete(key);paint();}));
  return box;
 }
 // ── 첨삭: 빈칸 판정(인정·부분·다시) · 기호 표시 · 한마디 세 줄 · 예시답 ──
 function feedbackView(c,week,sub){
  const w=weekContent(week).writing,box=node('div','ws-hw-feedback'),codes=model.content.feedback.codes,[good,fix,retry]=model.content.feedback.comment;
  box.append(meta('ok',[T.returned,homeworkDate(Date.parse(sub.feedback.returnedAt))].join(' · '),'ws-hw-summary'));
  const note=changedNote(sub);if(note)box.append(note);
  for(const part of w.parts){
   const s=node('section','ws-hw-part'),fb=sub.feedback.parts[part.key];s.dataset.part=part.key;
   s.append(node('h5','',partLabel(part,' · ')));
   if(!fb){for(const field of part.fields)s.append(answerView(field,sub.answers[field.id]));s.append(meta('idle',T.pending,'ws-hw-help'));box.append(s);continue;}
   for(const field of part.fields){
    const value=sub.answers[field.id],verdict=fb.fields?.[field.id],marks=(fb.marks||[]).filter(m=>m.field===field.id);
    if(field.kind==='text'){
     const essay=node('div','ws-hw-answer');essay.append(node('p','ws-hw-field-label',`${field.label} · ${homeworkLength(value)}자`));
     for(const paragraph of markParagraphs(value,marks)){
      const p=node('p','ws-hw-mine');
      for(const seg of paragraph){
       if(seg.mark===undefined){p.append(doc.createTextNode(seg.text));continue;}
       const mark=marks[seg.mark];if(seg.text){const m=node('mark','',seg.text);m.dataset.code=mark.code;p.append(m);}
       if(seg.end)p.append(node('span','ws-hw-code',`〔${mark.code}〕`));
      }
      essay.append(p);
     }
     s.append(essay);
    }else s.append(answerView(field,value));
    if(verdict){const v=meta(verdict.verdict==='인정'?'ok':verdict.verdict==='부분'?'check':'alert',[verdict.verdict,verdict.reason].filter(Boolean).join(' · '),'ws-hw-verdict');v.dataset.verdict=verdict.verdict;s.append(v);}
    if(marks.length){
     const list=node('ul','ws-hw-marks');list.setAttribute('aria-label',T.marks);
     for(const mark of marks){const li=node('li');li.dataset.code=mark.code;li.append(node('span','ws-hw-code',`〔${mark.code}〕`),doc.createTextNode(` ${codes[mark.code]||''} · 「${mark.quote}」${mark.note?` ${mark.note}`:''}`));list.append(li);}
     s.append(list);
    }
   }
   if(fb.comment){
    const dl=node('dl','ws-hw-comment');
    for(const [name,label,tone] of [['good',good,'ok'],['fix',fix,'check'],['retry',retry,'info']])if(fb.comment[name]){const dt=node('dt');dt.append(led(tone),doc.createTextNode(label));dl.append(dt,node('dd','',fb.comment[name]));}
    s.append(dl);
   }
   const k=model.key?.writing?.[part.key];
   if(k?.model){
    const details=node('details','ws-hw-model'),summary=node('summary','',T.model);details.append(summary);
    for(const field of part.fields){const m=k.model[field.id];if(m===undefined)continue;
     if(Array.isArray(m)){for(const [r,row] of m.entries())details.append(node('p','',`${field.rows[r]} · ${row.join(' / ')}`));}
     else for(const paragraph of m.split('\n\n'))details.append(node('p','',(part.fields.length>1&&field.kind==='line'?`${field.label} `:'')+paragraph));}
    if(k.criteria)details.append(node('p','ws-hw-help',`${T.criteria} · ${k.criteria}`));
    s.append(details);
   }
   box.append(s);
  }
  // 예시답을 아직 못 받았으면 한 줄(받는 중 · 못 받음 · 자료 판이 아직 안 맞음).
  if(!receivedKeys.has(`${c.classId}:${week}:writing`)){const n=keyNote(T.modelLoading,T.modelError);if(n)box.append(n);}
  const mine=retryView(sub);if(mine)box.append(mine);
  // 첨삭이 먼저 와서 내지 못한 고친 글은 이 기기에 남겨 여기 보인다(다음 주 「다시 써 볼 곳」에 옮겨 쓰게).
  const draft=readDraft(storage,homeworkDraftKey(owner,c.classId,w.id));
  if(c.readOnly){const local=readOnlyDraft(c,week,'writing',sub);if(local)box.append(local);}
  else if(unsentRewrite(draft,sub))box.append(draftView(c,week,'writing',draft,{title:T.kept,help:T.keptHelp,tone:'check',sub}));
  return box;
 }

 // ── 내기: 같은 내용을 다시 보내면 같은 요청 번호라 한 번만 저장된다(응답이 끊긴 뒤 다시 눌러도 안전). 고친 내용은 새 번호로 낸다. 성공하면 쓰던 답을 지운다. ──
 // 다시 눌러도 풀리지 않는 답(판 겹침·이미 냄·잠김·아직 안 열림·계획 없음)은 요청 번호를 버리고 조용히 다시 불러온다. 명부에서 빠진 계정(FORBIDDEN)은 칸을 그대로 두고 안내만 한다.
 // 첨삭이 먼저 돌아온 고친 글(HOMEWORK_LOCKED)은 쓰던 답을 지우지 않는다 — 다시 불러오면 첨삭 아래 「내지 못한 고친 글」로 보인다.
 const SEND_TEXT={REVISION_CONFLICT:T.conflict,ALREADY_SUBMITTED:T.conflict,IDEMPOTENCY_CONFLICT:T.conflict,HOMEWORK_LOCKED:T.locked,HOMEWORK_READ_ONLY:T.readOnly,FORBIDDEN:T.noLearner,NO_LEARNER:T.noLearner,WEEK_NOT_OPEN:T.notOpen,HOMEWORK_NOT_PLANNED:T.unset};
 const RELOAD_ON=['REVISION_CONFLICT','ALREADY_SUBMITTED','IDEMPOTENCY_CONFLICT','HOMEWORK_LOCKED','HOMEWORK_READ_ONLY','WEEK_NOT_OPEN','HOMEWORK_NOT_PLANNED'];
 async function send_(c,week,kind,{answers,retry,expectedRevision}){
  if(c.readOnly)return;
  const key=taskKey(c.classId,week,kind),assignment=assignmentOf(kind,week);
  if(model.busy)return;
  // 요청 번호 지문은 서버가 받는 꼴로 만든다(다시 써 볼 곳은 앞뒤 공백·빈 줄을 뺀다) — 공백만 바꾼 같은 글은 같은 요청이다.
  const sub=submissionOf(c,week,kind),signature=homeworkSignature({kind,answers,retry:kind==='writing'?cleanRetry(retry):undefined,contentVersion:model.content.version});
  model.busy=key;model.notice.set(key,{tone:'idle',text:T.sending});paint();
  const kept=model.requests.get(key),requestId=kept?.signature===signature?kept.id:randomId();model.requests.set(key,{id:requestId,signature});
  const ticket=generation;
  try{
   guard();const sent=now();
   const result=await submit({classId:c.classId,week,kind,requestId,expectedRevision:expectedRevision??sub?.revision??0,contentVersion:model.content.version,answers,...(kind==='writing'?{retry}:{})});
   guard();if(disposed||ticket!==generation)return;
   learnClock(result.serverTime,sent);model.classes=mergeClasses(result.classes);model.requests.delete(key);dropDraft(storage,homeworkDraftKey(owner,c.classId,assignment));model.editing.delete(key);
   model.notice.set(key,{tone:'ok',text:kind==='reading'?T.sentReading:T.sent});model.open=key;dropStaleDrafts();void needKey();
  }catch(error){
   if(error?.code==='ACCOUNT_CHANGED'){close();return;}
   if(disposed||ticket!==generation)return;
   const code=error?.code,refused=error?.status>=400&&error?.status<500;
   // 첨삭이 먼저 오면(HOMEWORK_LOCKED) 다시 불러온 뒤 고친 글이 실제로 남았을 때만 「남겨 두었어요」라고 한다
   // (낸 글과 같거나, 다른 기기에서 더 나중에 냈으면 이 기기의 글은 남지 않는다).
   model.notice.set(key,{tone:'alert',text:code==='HOMEWORK_LOCKED'?T.lockedSame:SEND_TEXT[code]||(refused?T.invalid:T.sendError)});
   if(RELOAD_ON.includes(code)){
    model.requests.delete(key);model.editing.delete(key);
    const reload=refresh({quiet:true});
    if(code==='HOMEWORK_LOCKED')void reload.then(()=>{
     if(disposed||model.notice.get(key)?.text!==T.lockedSame)return;
     const cur=model.classes.find(x=>x.classId===c.classId),s=cur&&submissionOf(cur,week,kind);
     if(s&&unsentRewrite(readDraft(storage,homeworkDraftKey(owner,c.classId,assignment)),s)){model.notice.set(key,{tone:'alert',text:T.locked});paint();}
    });
   }
   else if(refused)model.requests.delete(key);
  }finally{if(model.busy===key)model.busy=null;if(!disposed)paint();}
 }

 // ── 그리기: 시트를 다시 그려도 누르던 단추·쓰던 칸으로 초점과 커서를 돌린다 ──
 function paint(){
  const historyOnly=model.classes.length>0&&model.classes.every(c=>c.readOnly);
  if(disposed||model.phase==='closed')return;
  title.textContent=historyOnly?T.historyTitle:T.title;
  root.querySelector('.ws-hw-lead').textContent=historyOnly?T.historyLead:T.lead;
  const focused=doc.activeElement,focusKey=focused&&root.contains(focused)?focused.dataset.homeworkKey:null;
  const caret=focusKey&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;
  root.dataset.state=model.phase;
  root.hidden=model.phase==='hidden'||(model.phase==='loading'&&!model.seen);
  status.hidden=model.phase!=='loading';status.replaceChildren(...(model.phase==='loading'?[led('idle'),doc.createTextNode(T.loading)]:[]));
  alert.hidden=model.phase!=='error';alert.replaceChildren(...(model.phase==='error'?[node('p','',T.error),button(T.retry,'plain-button','retry',()=>start())]:[]));
  body.replaceChildren();
  if(model.phase==='ready')for(const c of model.classes)body.append(room(c));
  if(focusKey)for(const el of root.querySelectorAll('[data-homework-key]'))if(el.dataset.homeworkKey===focusKey){el.focus({preventScroll:true});if(caret&&typeof el.setSelectionRange==='function')try{el.setSelectionRange(...caret);}catch{}break;}
 }
 function room(c){
  const el=node('div','ws-hw-room');el.dataset.classId=c.classId;
  el.append(node('h4','ws-hw-name',c.name||model.content.title));
  if(c.readOnly){
   el.append(node('p','ws-hw-help',T.historyNote));
   for(let week=1;week<=Math.min(c.weeks,model.content.weeks.length);week++)for(const kind of ['reading','writing'])if(submissionOf(c,week,kind)||draftFilled(readDraft(storage,homeworkDraftKey(owner,c.classId,assignmentOf(kind,week)))))el.append(task(c,week,kind,null));
   return el;
  }
  // 반 계획의 주 수가 자료보다 길어도 자료가 있는 주까지만 연다(자료 없는 주에서 칸이 멈추지 않게).
  const weeks=Math.min(c.weeks,model.content.weeks.length),info=homeworkWeek({startsOn:c.startsOn,weeks,now:clock(),schedule:model.content.schedule});
  if(info.phase==='unset'){el.append(meta('idle',T.unset,'ws-hw-help'));return el;}
  if(info.phase==='before'){el.append(meta('info',`첫 과제는 ${homeworkDate(info.start,{time:false})} 수업 뒤에 열려요.`,'ws-hw-when'));return el;}
  if(info.phase==='done')el.append(meta('ok',`${weeks}주 과정을 마쳤어요. 지난 과제와 첨삭은 아래에서 다시 볼 수 있어요.`,'ws-hw-when'));
  const current=info.phase==='active'?info.week:null;
  if(current)el.append(weekBlock(c,current,true));
  const past=[];for(let week=(current||info.opened+1)-1;week>=1;week--)past.push(week);
  if(past.length){
   const list=node('div','ws-hw-past');list.append(node('h5','',T.past));
   for(const week of past){
    const details=node('details','ws-hw-past-week'),summary=node('summary');summary.dataset.homeworkKey=`past:${c.classId}:${week}`;
    const r=taskState(c,week,'reading',null),w=taskState(c,week,'writing',null);
    summary.append(node('span','ws-hw-past-name',`${week}주차`),node('span','ws-hw-past-state',`읽기 ${r.sub?T.submitted:T.notSent} · 쓰기 ${w.sub?.feedback?T.returned:w.sub?T.submitted:T.notSent}`));
    details.open=model.open?.startsWith(`${c.classId}:${week}:`)||model.expanded?.has(`${c.classId}:${week}`);
    details.addEventListener('toggle',()=>{model.expanded??=new Set();if(details.open)model.expanded.add(`${c.classId}:${week}`);else model.expanded.delete(`${c.classId}:${week}`);});
    details.append(summary,weekBlock(c,week,false));list.append(details);
   }
   el.append(list);
  }
  return el;
 }
 function weekBlock(c,week,current){
  const content=weekContent(week),window=homeworkWindow(c.startsOn,week,model.content.schedule),el=node('div','ws-hw-week');el.dataset.week=String(week);
  if(current){
   const overdue=clock()>window.due,done=['reading','writing'].every(kind=>submissionOf(c,week,kind));
   el.append(meta(done?'ok':overdue?'check':'info',`${week}주차 · 마감 ${homeworkDate(window.due)}`,'ws-hw-when'));
   const lesson=node('dl','ws-hw-lesson');
   for(const [label,value] of [[T.lesson,content.lesson],[T.grammar,content.grammar],[T.listening,`공개 기출 ${content.listening} · ${T.listeningNote}`]]){lesson.append(node('dt','',label),node('dd','',value));}
   el.append(lesson);
  }else el.append(meta('idle',`마감 ${homeworkDate(window.due)}`,'ws-hw-help'));
  el.append(task(c,week,'reading',window),task(c,week,'writing',window));
  return el;
 }

 // 반 목록을 먼저 읽고, 반이 있을 때만 문제 자료를 읽는다(반이 없는 대부분의 계정은 자료를 받지 않고, 자료 읽기가 실패해도 칸이 없다).
 // fresh: 새로고침 단추로 정답·자료를 다시 맞출 때는 자료도 새로 읽는다.
 // keep: 탭 복귀처럼 아무도 기다리지 않는 다시 묻기만 실패해도 보던 화면을 둔다. 내기 뒤 다시 불러오기(판 겹침·첨삭이 먼저 옴)가 실패하면 오류를 보인다 — 안내와 화면이 어긋나지 않게.
 async function refresh({quiet=false,fresh=false,keep=false}={}){
  const ticket=++generation,shown=model.phase==='ready';
  if(!quiet){model.phase='loading';paint();}
  try{
   guard();const sent=now();
   const result=await load();guard();if(disposed||ticket!==generation)return;
   learnClock(result.serverTime,sent);
   if(!result.classes.length){model.classes=[];model.phase='hidden';return;}
   const content=model.content&&!fresh?model.content:await loadContent();
   guard();if(disposed||ticket!==generation)return;
   if(!content?.weeks?.length)throw Object.assign(Error('과제 자료'),{code:'HOMEWORK_CONTENT'});
   if(model.content&&model.content.version!==content.version)forgetKeys();
   model.content=content;model.classes=result.classes;model.phase='ready';model.seen=true;
   dropStaleDrafts();void needKey();
  }catch(error){
   if(error?.code==='ACCOUNT_CHANGED'){close();return;}
   if(disposed||ticket!==generation)return;
   // 다른 탭에서 돌아와 조용히 다시 묻다가 잠깐 실패하면 보던 화면을 그대로 둔다(다음에 돌아올 때 다시 묻는다).
   if(keep&&shown){model.phase='ready';return;}
   // 함수가 아직 없거나(404) 이 PC 앱이 경로를 모르면 칸을 숨긴다. 그 밖의 실패는 알린다(학생이 과제가 없다고 오해하지 않게).
   model.phase=['HOMEWORK_UNAVAILABLE','HOMEWORK_UNSUPPORTED'].includes(error?.code)&&!(error.status>=500)?'hidden':'error';
   if(model.phase==='error')model.seen=true;
  }finally{if(!disposed&&ticket===generation)paint();}
 }
 function start(){if(disposed)return;const fresh=['error','stale'].includes(model.keyState);model.notice.clear();model.open=null;model.editing.clear();model.requests.clear();keyTicket++;model.keyState='idle';void refresh({fresh});}
 // 다른 탭·앱에서 돌아오면 조용히 다시 묻는다(쓰던 칸이 열려 있으면 그대로 둔다 — 쓰던 답은 기기에 있다). 잠깐 실패하면 보던 화면을 그대로 둔다.
 function onVisibility(){if(doc.visibilityState!=='hidden'&&model.phase==='ready'&&!model.busy&&!root.querySelector('.ws-hw-write textarea'))void refresh({quiet:true,keep:true});}
 doc.addEventListener('visibilitychange',onVisibility);
 start();
 return Object.freeze({reload:start,
  state:()=>({phase:model.phase==='closed'?'closed':root.hidden?'hidden':model.phase,classes:model.classes.length,open:model.open,key:model.keyState}),
  dispose(){if(disposed)return;disposed=true;generation++;doc.removeEventListener('visibilitychange',onVisibility);root.remove();}});
}
