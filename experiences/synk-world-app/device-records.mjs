// 공개판 설계 §2 「로그인 없이 먼저 해 본다」: 손님이 이 기기에 쌓은 한글 기록을 로그인할 때 계정으로 옮길지 묻는다.
// 옮기는 것은 지나간 사건이 아니라 지금 상태의 스냅샷이다 — 한글 만나기의 글자 진도(hangul-stage)와 첫 실행에 고른
// 「한글을 읽을 수 있어요?」 답(생활 진도 기록의 hangul 칸). 계정에 이미 그 기록이 있으면 합치지 않고 계정 것을 쓴다.
// 이 기기의 손님 기록은 지우지 않는다. 고른 답(옮김·처음부터)은 계정마다 이 기기에 한 번 남겨 다시 묻지 않는다.
export const HANGUL_DEVICE_KEY='synk.hangul-stage.v1';
export const GUEST_LIFE_KEY='synk.life-korean.progress.v1:guest';
export const DEVICE_RECORDS_KEY='synk.world.device-records.v1';
const RECORD_ANSWERS=new Set(['new','reads']),RECORD_VIA=new Set(['question','graduation','skip','unskip']);
const recordObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const recordTime=value=>Number.isSafeInteger(value)&&value>=0;
const recordEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// hangul-stage/learning.mjs progressKey와 같은 이름(synk-account scopedStorage의 계정·학습 동의 판 구역).
export function hangulAccountKey(status){
 if(!recordObject(status)||!/^[a-zA-Z0-9_.:-]{1,120}$/.test(String(status.accountKey))||!Number.isInteger(status.revision))return null;
 return `synk.account.${status.accountKey}.r${status.revision}.hangul-stage.v1`;
}
// 옮길 만한 진도인지: 글자를 하나라도 만났거나, 건너뛰었거나, 졸업했거나, 한 회차라도 했다.
export function hangulProgressSummary(value){
 if(!recordObject(value)||value.v!==1)return null;
 const letters=recordObject(value.letters)?Object.values(value.letters).filter(recordObject):[];
 const met=letters.filter(letter=>['met','learning','mastered'].includes(letter.state)).length,mastered=letters.filter(letter=>letter.state==='mastered').length;
 const graduated=recordObject(value.graduated),skipped=value.skipped===true,sessions=Array.isArray(value.sessions)?value.sessions.length:0;
 return met||graduated||skipped||sessions?{met,mastered,graduated,skipped,sessions}:null;
}
function readHangul(storage,key){const raw=storage.getItem(key);if(raw===null)return null;try{return hangulProgressSummary(JSON.parse(raw));}catch{return null;}}
export function deviceHangulAnswer(storage){
 try{
  const value=JSON.parse(storage?.getItem(GUEST_LIFE_KEY)||'null'),hangul=value?.owner==='guest'?value.hangul:null;
  return recordObject(hangul)&&hangul.version===1&&RECORD_ANSWERS.has(hangul.answer)&&RECORD_VIA.has(hangul.via)&&recordTime(hangul.at)?{answer:hangul.answer,via:hangul.via}:null;
 }catch{return null;}
}

// learning: 계정 학습 호스트의 status()(accountKey·revision), accountAnswer: 계정 생활 진도의 hangulReading()(없으면 null).
// 옮길 것이 없으면 null. 손님 글자 진도가 있는데 계정 자리를 모르면 이번에는 묻지 않는다(다음 로그인 때 다시 본다).
export function planDeviceRecords({storage=globalThis.localStorage,learning=null,accountAnswer=null}={}){
 let device,answer,target,accountHas=false;
 try{device=readHangul(storage,HANGUL_DEVICE_KEY);answer=deviceHangulAnswer(storage);target=hangulAccountKey(learning);if(target)accountHas=storage.getItem(target)!==null;}catch{return null;}
 if(device&&!target)return null;
 const hangul=device&&!accountHas?{from:HANGUL_DEVICE_KEY,to:target,summary:device}:null,moveAnswer=answer&&!accountAnswer?answer:null;
 if(!hangul&&!moveAnswer)return null;
 return {hangul,answer:moveAnswer,kept:{hangul:!!device&&accountHas,answer:!!answer&&!!accountAnswer}};
}
// 옮기는 순간에 다시 본다: 그사이 계정에 기록이 생겼으면 합치지 않는다('exists'), 손님 기록이 사라졌으면 건너뛴다('gone').
export async function applyDeviceRecords(plan,{storage=globalThis.localStorage,accountAnswer=()=>null,setAccountAnswer}){
 const result={hangul:null,answer:null,errors:[]};
 if(plan?.hangul){
  try{
   const raw=storage.getItem(plan.hangul.from);
   if(storage.getItem(plan.hangul.to)!==null)result.hangul='exists';
   else if(raw===null||!readHangul(storage,plan.hangul.from))result.hangul='gone';
   else{storage.setItem(plan.hangul.to,raw);result.hangul='moved';}
  }catch(error){result.errors.push(error);}
 }
 if(plan?.answer){
  try{if(accountAnswer())result.answer='exists';else{await setAccountAnswer(plan.answer.answer,{via:plan.answer.via});result.answer='moved';}}
  catch(error){result.errors.push(error);}
 }
 return result;
}
export function deviceRecordsDecision(storage,accountId){
 try{const value=JSON.parse(storage?.getItem(DEVICE_RECORDS_KEY)||'null'),accounts=recordObject(value)&&value.version===1&&recordObject(value.accounts)?value.accounts:{};
  const entry=Object.hasOwn(accounts,accountId)?accounts[accountId]:null;return recordObject(entry)&&['moved','kept'].includes(entry.decision)?entry.decision:null;}catch{return null;}
}
export function saveDeviceRecordsDecision(storage,accountId,decision,at=Date.now()){
 if(!['moved','kept'].includes(decision))throw TypeError('Invalid device records decision');
 let accounts={};try{const value=JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)||'null');if(recordObject(value)&&value.version===1&&recordObject(value.accounts))accounts=value.accounts;}catch{}
 try{storage.setItem(DEVICE_RECORDS_KEY,JSON.stringify({version:1,accounts:{...accounts,[accountId]:{decision,at}}}));return true;}catch{return false;}
}

export const DEVICE_RECORDS_TEXT=Object.freeze({
 title:'한글 기록 이어 가기',lead:'이 기기에서 한 한글 기록을 내 계정에서 이어 갈까요?',move:'내 계정에서 이어 가기',keep:'처음부터 하기',
 snapshot:'지금 진도만 옮겨요',snapshotBody:'지나간 연습 하나하나가 아니라 지금 상태만 계정에 담아요. 이 기기의 손님 기록은 지우지 않아요.',
 moving:'계정으로 옮기고 있어요.',failed:'옮기지 못했어요. 연결을 확인한 뒤 다시 골라 주세요.',
 moved:'한글 기록을 내 계정으로 옮겼어요.',partly:'옮길 수 있는 한글 기록만 내 계정으로 옮겼어요.',kept:'계정은 처음부터 시작해요. 이 기기의 기록은 그대로 남아 있어요.',
 hangulRow:'한글 만나기',answerRow:'처음 고른 답',answerNew:'한글을 아직 못 읽어요',answerReads:'한글을 읽을 수 있어요',
 graduated:'졸업했어요',met:n=>`글자 ${n}개를 만났어요`,metMastered:(n,m)=>`글자 ${n}개를 만났고 ${m}개를 익혔어요`,skipped:'건너뛰기를 골랐어요',started:'연습을 시작했어요',
 keptHangul:'한글 만나기는 계정에 이미 진도가 있어 계정 진도로 이어 가요.',keptAnswer:'처음 고른 답은 계정에 이미 있어 계정 것을 써요.'
});
// 화면 언어(10-19 1판): 판을 띄우는 쪽이 text()로 고른 언어의 글을 넘기면 같은 키를 그 글로 바꾼다(없거나 실패하면 위 한국어).
function recordsText(text){let extra=null;try{extra=typeof text==='function'?text():text;}catch{extra=null;}return extra&&typeof extra==='object'?{...DEVICE_RECORDS_TEXT,...extra}:DEVICE_RECORDS_TEXT;}
function hangulLine(summary,T=DEVICE_RECORDS_TEXT){
 if(summary.graduated)return T.graduated;
 const met=summary.met?(summary.mastered?T.metMastered(summary.met,summary.mastered):T.met(summary.met)):'';
 return [met,summary.skipped?T.skipped:''].filter(Boolean).join(' · ')||T.started;
}
export function describeDeviceRecords(plan,T=DEVICE_RECORDS_TEXT){
 const rows=[];
 if(plan?.hangul)rows.push({label:T.hangulRow,value:hangulLine(plan.hangul.summary,T)});
 if(plan?.answer)rows.push({label:T.answerRow,value:plan.answer.answer==='new'?T.answerNew:T.answerReads});
 const notes=[];
 if(plan?.kept.hangul)notes.push(T.keptHangul);
 if(plan?.kept.answer)notes.push(T.keptAnswer);
 return {rows,notes};
}

// 로그인 뒤 입장 관문(createWorldEntryGate의 offer)에서 한 번 묻는다. present({title,html,onClose})가 판을 띄우고,
// 판의 단추(data-world="device-records" data-choice="move|keep")가 choose로 온다. 판을 닫으면 이번 화면에서는 다시 묻지 않는다.
// 고른 뒤에는 관문이 이어지게 먼저 끝을 알리고 같은 차례에 판을 닫는다(이어지는 튜터 고르기 판을 닫지 않게). 알림은 그다음 판 위에 뜨게 미룬다.
// text: 판 글을 고른 화면 언어로 넘기는 함수(DEVICE_RECORDS_TEXT와 같은 키, 열 때·알릴 때마다 다시 읽는다).
export function createDeviceRecordsOffer({storage=globalThis.localStorage,learningStatus=()=>null,accountAnswer=()=>null,setAccountAnswer,present,close,toast=()=>{},head='',now=Date.now,defer=fn=>setTimeout(fn,0),text=null}){
 const asked=new Set();let current=null;
 function markup(plan){
  const T=recordsText(text),{rows,notes}=describeDeviceRecords(plan,T);
  return `<div class="ws-signin"><div class="ws-signin-head"><p class="ws-lead">${recordEscape(T.lead)}</p>${head}</div>`
   +`<div class="world-notice" data-tone="ok" data-label="DEVICE"><strong>${rows.map(row=>`${recordEscape(row.label)} · ${recordEscape(row.value)}`).join('<br>')}</strong><span>${recordEscape(T.snapshotBody)}</span></div>`
   +notes.map(note=>`<p class="dialog-note">${recordEscape(note)}</p>`).join('')
   +`<div class="world-actions"><button class="felt-button" data-world="device-records" data-choice="move">${recordEscape(T.move)}</button><button class="plain-button" data-world="device-records" data-choice="keep">${recordEscape(T.keep)}</button></div>`
   +`<p class="dialog-note" data-device-records-status role="status" aria-live="polite"></p></div>`;
 }
 function finish(job,value){if(current!==job)return;current=null;job.resolve(value);}
 function offer({owner}={}){
  if(typeof owner!=='string'||!owner||owner==='guest'||asked.has(owner)||deviceRecordsDecision(storage,owner))return null;
  let plan=null;try{plan=planDeviceRecords({storage,learning:learningStatus(),accountAnswer:accountAnswer()});}catch{plan=null;}
  if(!plan)return null;
  asked.add(owner);
  return new Promise(resolve=>{const job={owner,plan,resolve,busy:false};current=job;present({title:recordsText(text).title,html:markup(plan),onClose:()=>finish(job,'dismissed')});});
 }
 function done(job,value,message){finish(job,value);close();if(message)defer(()=>toast(message));return value;}
 async function choose(choice,{owner,status=()=>{}}={}){
  const job=current;if(!job||job.busy||!['move','keep'].includes(choice))return null;
  // 그사이 계정이 바뀌었으면 아무것도 옮기지 않고 판만 닫는다.
  if(owner!==job.owner){done(job,'dismissed');return null;}
  job.busy=true;
  if(choice==='keep'){saveDeviceRecordsDecision(storage,job.owner,'kept',now());return done(job,'kept',recordsText(text).kept);}
  status(recordsText(text).moving,true);
  const result=await applyDeviceRecords(job.plan,{storage,accountAnswer,setAccountAnswer});
  if(current!==job)return null;
  const moved=[result.hangul,result.answer].includes('moved');
  if(result.errors.length&&!moved){job.busy=false;status(recordsText(text).failed,false);return null;}
  saveDeviceRecordsDecision(storage,job.owner,'moved',now());
  return done(job,'moved',result.errors.length||result.hangul==='exists'||result.answer==='exists'||!moved?recordsText(text).partly:recordsText(text).moved);
 }
 return Object.freeze({offer,choose,pending:()=>current?{owner:current.owner,plan:current.plan}:null});
}
