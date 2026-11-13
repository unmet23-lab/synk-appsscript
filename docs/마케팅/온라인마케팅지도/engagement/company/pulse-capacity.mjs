// PULSE 제작 정원 — 접수 멈춤 스위치(2026-11-11 운영 조각 3) + 제작 자리 · 대기(2026-11-13 운영 조각 6-B), 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2.
// 설정 문서 pulseCapacity 하나에 두 몫을 따로 둔다 — 쉬기 몫(open · pausedUntil · pauseNote · pauseNoteEn)과 자리 몫(seats · held).
// 쉬기 · 다시 받기는 쉬기 몫만, 자리 수 · 손으로 잡은 자리는 자리 몫만 고친다(한쪽을 저장해도 다른 쪽이 지워지지 않는다).
//   open        — false면 새 의뢰서 시작을 쉰다(paused). 쓰던 초안의 보내기 · 10분 재전송은 막지 않는다(막는 자리는 pulse-requests.mjs start 하나 — 409 SYNK_PULSE_INTAKE_PAUSED).
//   pausedUntil — 다시 여는 날(한국 날짜 YYYY-MM-DD). 그날 0시(한국 시간)부터 저절로 열린다. 비우면 담당자가 열 때까지 쉰다.
//   pauseNote   — 손님에게 그대로 보이는 안내 한 줄(pauseNoteEn은 영어 화면에 보일 글 — 비우면 영어 화면은 고정 문장과 날짜만 보인다).
//   seats       — 제작 자리 {video, photo}와 대기 자리 {queue}(기본 영상 3 · 사진 5 · 대기 6, 결정 11-11 「추천대로 시작」).
//   held        — 담당자가 손으로 잡은 자리 [{id, kind, note, at, by}] — 의뢰서 없이 담당자가 만든 옛 흐름 건처럼 결제 칸이 없는 일.
// 세는 법(capacityState — 순수 함수):
//   제작 중 = 의뢰서가 있고 결제를 확인했고(payment confirmed) 납품 · 보관 · 거둠이 아닌 건 + 손으로 잡은 자리. 영상과 사진(package photo)을 따로 센다.
//   대기   = 담당자가 의뢰서를 확인했고(request.confirmedAt) 결제 전이며 최근 14일 안에 움직임(프로젝트 updatedAt)이 있는 건 — 접수만으로 세면 익명 6건으로 공개 의뢰가 닫힌다.
//   상태   = 그 종류의 제작 중 + 앞선 대기 < 자리면 open, 아니면 대기 전체 < 대기 자리면 queue, 아니면 full. 쉬기는 이와 따로 paused.
//   언제쯤 = 제작 중인 건의 받으실 날을 이른 순으로 놓고(지난 날은 오늘로) 자리가 나는 차례의 날 — 받으실 날이 빈 건(기업 · 손으로 잡은 자리) 차례면 날짜 없이.
// 바꾸기는 관리자만 하고 server.mjs가 CSRF · 감사 기록을 붙인다(pulse-features.mjs와 같은 꼴). 저장한 문서가 이상하면 여는 쪽 · 기본 자리 수로 읽는다 —
// 문서가 깨졌다고 접수가 닫히면 아무도 모르는 채 판매가 멈춘다.
// 공개 응답(publicView)은 상태 · 다시 여는 날(쉬기) · 안내 글 · 자리가 찬 종류 · 결제 안내 예정일뿐이다. 건수 · 남은 자리 · 누가 바꿨는지는 내리지 않는다(주문 수를 밖에서 셀 수 있게 된다).
export const PULSE_CAPACITY_KIND='pulseCapacity';
export const CAPACITY_LIMITS=Object.freeze({note:200,noteEn:300,untilDays:366});
export const SEAT_DEFAULTS=Object.freeze({video:3,photo:5,queue:6});
export const SEAT_LIMITS=Object.freeze({max:50,held:20,heldNote:80,quietDays:14});
const ID='main',KEYS=['open','pausedUntil','pauseNote','pauseNoteEn'],SEAT_KEYS=['video','photo','queue'],KINDS=['video','photo'];
const CONTROL=/[\u0000-\u001f\u007f\u2028\u2029]/;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
// 한국 날짜(YYYY-MM-DD). 한국은 서머타임이 없어 +9시간 고정이다.
export const kstDate=at=>{const ms=Date.parse(at);return Number.isFinite(ms)?new Date(ms+9*3600000).toISOString().slice(0,10):'';};
const realDate=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const ms=Date.parse(value+'T00:00:00Z');return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value;};
const cleanNote=(value,max)=>typeof value==='string'&&value.length<=max&&!CONTROL.test(value)?value.trim():null;
const OPEN=Object.freeze({open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:''});
// 저장된 값을 지금 시각으로 읽는다: 쉬는 중이 아니면(열려 있음 · 다시 여는 날이 됨 · 문서가 이상함) 열린 쪽 하나로 모은다.
export function readPulseCapacity(stored,now){
  if(!object(stored)||stored.open!==false)return {...OPEN};
  const until=realDate(stored.pausedUntil)?stored.pausedUntil:'';
  if(until&&kstDate(now)>=until)return {...OPEN};
  return {open:false,pausedUntil:until,pauseNote:cleanNote(stored.pauseNote,CAPACITY_LIMITS.note)||'',pauseNoteEn:cleanNote(stored.pauseNoteEn,CAPACITY_LIMITS.noteEn)||''};
}
// 자리 몫: 칸마다 0 ~ 50의 정수가 아니면 기본값, 손으로 잡은 자리는 꼴이 맞는 것만 스물까지.
const seatCount=(value,fallback)=>Number.isSafeInteger(value)&&value>=0&&value<=SEAT_LIMITS.max?value:fallback;
export function readSeats(stored){
  const raw=object(stored)&&object(stored.seats)?stored.seats:{};
  const seats=Object.fromEntries(SEAT_KEYS.map(key=>[key,seatCount(raw[key],SEAT_DEFAULTS[key])]));
  const held=(object(stored)&&Array.isArray(stored.held)?stored.held:[]).filter(item=>object(item)&&typeof item.id==='string'&&/^[0-9a-f]{12}$/.test(item.id)&&KINDS.includes(item.kind)).slice(0,SEAT_LIMITS.held)
    .map(item=>({id:item.id,kind:item.kind,note:cleanNote(item.note,SEAT_LIMITS.heldNote)||'',at:typeof item.at==='string'?item.at:'',by:typeof item.by==='string'?item.by:''}));
  return {seats,held};
}
// 확인했던 결제를 취소(환불)함 — 결제 요청만 취소한 건(confirmedAt 없음)과 가른다(pulse-auto-reply.mjs 결제 사실과 같은 갈래).
const refunded=request=>request?.payment?.status==='cancelled'&&!!request.payment.confirmedAt;
// 의뢰서의 상품 종류 — 사진 상품만 사진 자리, 그 밖(15 · 30 · 60초 · 기업 · 상담)은 영상 자리.
export const seatKind=request=>request?.answers?.package==='photo'?'photo':'video';
// 순수 함수: 프로젝트 목록 · 자리 몫 · 지금 시각으로 종류마다 상태를 센다. 의뢰서가 없는 옛 흐름 건은 세지 않는다(손으로 잡은 자리로 센다).
export function capacityState(projects,{seats,held},now){
  const nowMs=Date.parse(now),today=kstDate(now),kinds={video:{busy:[],waiting:[]},photo:{busy:[],waiting:[]}};
  for(const row of Array.isArray(projects)?projects:[]){
    const request=row?.studio?.request;
    if(!object(request)||!request.submittedAt||request.status==='retired'||['delivered','archived'].includes(row.stage))continue;
    const kind=seatKind(request);
    if(request.payment?.status==='confirmed'){kinds[kind].busy.push(realDate(request.payment.dueDate)?request.payment.dueDate:'');continue;}
    // 확인했던 결제를 취소(환불)한 건은 대기에도 들지 않는다 — 앞선 확인 시각으로 줄 맨 앞에 서서 방금 비운 자리를 도로 차지했다(6-B 끝판 카본 A2). 다시 진행하면 새 결제 요청부터 대기로 돌아온다.
    if(!request.confirmedAt||refunded(request))continue;
    const moved=Date.parse(row.updatedAt||'');
    if(!Number.isFinite(moved)||!Number.isFinite(nowMs)||nowMs-moved>SEAT_LIMITS.quietDays*86400000)continue;
    kinds[kind].waiting.push({id:row.id,at:String(request.confirmedAt)});
  }
  for(const item of held||[])if(KINDS.includes(item.kind))kinds[item.kind].busy.push('');
  const waitingAll=kinds.video.waiting.length+kinds.photo.waiting.length,out={queue:{used:waitingAll,total:seats.queue}};
  for(const kind of KINDS){
    const k=kinds[kind],total=seats[kind],used=k.busy.length;
    // 지난 받으실 날은 오늘로 올리고, 빈 받으실 날은 맨 뒤로(그 차례면 날짜를 말하지 않는다).
    const dues=k.busy.map(day=>day&&today&&day<today?today:day).sort((a,b)=>(a===''?1:0)-(b===''?1:0)||a.localeCompare(b));
    const order=k.waiting.sort((a,b)=>a.at.localeCompare(b.at)||String(a.id).localeCompare(String(b.id))).map(item=>item.id);
    // 새로 오는 손님은 지금 대기 뒤에 선다: 제작 중 + 대기가 자리보다 적으면 열림.
    const state=used+order.length<total?'open':waitingAll<seats.queue?'queue':'full';
    out[kind]={state,used,total,waiting:order.length,order,dues,noticeDate:state==='open'?'':noticeAt(dues,used+order.length-total)};
  }
  return out;
}
// 자리가 i번째(0부터)로 나는 날 — 받으실 날이 빈 차례거나 제작 중인 건보다 뒤면 ''.
const noticeAt=(dues,i)=>i>=0&&i<dues.length?dues[i]:'';
// 한 프로젝트(담당자가 확인했고 결제 전)의 자리: 앞선 대기까지 자리가 모자라면 {state:'queue', noticeDate}, 자리가 있으면 null.
export function projectSeat(state,row){
  const request=row?.studio?.request;
  if(!object(request)||!request.submittedAt||!request.confirmedAt||request.payment?.status==='confirmed'||refunded(request)||request.status==='retired'||['delivered','archived'].includes(row.stage))return null;
  const k=state?.[seatKind(request)];
  if(!k)return null;
  // 14일 넘게 조용한 건은 남의 대기 수에는 안 들지만, 자기 차례는 지금 대기 뒤로 본다 — 자리가 없는데 「자리 있음」으로 뒤집히지 않게(6-B 끝판 카본 A1).
  const position=k.order.indexOf(row.id),i=k.used+(position<0?k.order.length:position)-k.total;
  return i<0?null:{state:'queue',noticeDate:noticeAt(k.dues,i)};
}
const newId=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)),byte=>byte.toString(16).padStart(2,'0')).join('');
export function createPulseCapacity({store,clock=()=>new Date().toISOString(),projects=()=>typeof store?.all==='function'?store.all('clientProjects'):[]}){
  if(!store)throw new TypeError('제작 정원 설정이 이상해요.');
  const stored=()=>store.get(PULSE_CAPACITY_KIND,ID)||null;
  const read=()=>readPulseCapacity(stored(),clock());
  const pausePart=row=>object(row)?Object.fromEntries(KEYS.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])):{};
  const seatPart=row=>object(row)?Object.fromEntries(['seats','held'].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])):{};
  const live=user=>{const row=store.get('users',user?.id);if(!row?.active)throw fail('먼저 로그인해 주세요.',401);return row;};
  const admin=(user,message)=>{const actor=live(user);if(actor.role!=='admin')throw fail(message,403);return actor;};
  const state=()=>capacityState(projects(),readSeats(stored()),clock());
  const summary=s=>({video:{state:s.video.state,used:s.video.used,total:s.video.total,waiting:s.video.waiting},photo:{state:s.photo.state,used:s.photo.used,total:s.photo.total,waiting:s.photo.waiting},queue:{...s.queue}});
  // 직원 화면: 로그인한 직원은 누구나 읽고(손님에게 보이는 값과 같다), 바꾸는 것은 관리자만.
  function settings(user){
    const actor=live(user),row=stored(),now=read(),isAdmin=actor.role==='admin',{seats,held}=readSeats(row);
    // reopened: 다시 여는 날이 되어 저절로 열린 뒤 아직 아무도 손대지 않은 상태 — 화면이 「○일에 다시 열렸어요」를 말할 수 있게.
    const reopened=now.open&&object(row)&&row.open===false&&realDate(row.pausedUntil)?row.pausedUntil:'';
    // seatsNow: 종류마다 상태 · 제작 중 · 자리 · 대기(직원만 — 손님에게는 건수를 내리지 않는다).
    return {...now,state:now.open?'open':'paused',reopened,seats,held,seatsNow:summary(state()),canEdit:isAdmin,updatedAt:row?.updatedAt||null,...(isAdmin?{updatedBy:row?.updatedBy||null}:{})};
  }
  function save(actor,next){store.put(PULSE_CAPACITY_KIND,ID,{...next,updatedAt:clock(),updatedBy:actor.id});}
  function configure(user,input){
    const actor=admin(user,'관리자만 접수를 쉬거나 다시 열 수 있어요.');
    if(!object(input)||Object.keys(input).some(key=>!KEYS.includes(key)))throw fail('바꿀 값을 확인해 주세요.');
    if(typeof input.open!=='boolean')throw fail('접수를 쉴지 받을지 다시 골라 주세요.');
    let next={...OPEN};
    if(input.open===false){
      const until=input.pausedUntil===undefined||input.pausedUntil===null?'':input.pausedUntil;
      if(until!==''){
        if(!realDate(until))throw fail('다시 여는 날을 확인해 주세요.');
        const today=kstDate(clock());
        // 시계를 못 읽으면 범위(내일 ~ 1년)를 잴 수 없다 — NaN 비교는 모두 거짓이라 지난 날 · 먼 날이 그대로 지나간다. 날짜 없는 쉬기 · 다시 받기는 시계와 상관없이 된다.
        if(!today)throw fail('서버 시계를 읽지 못했어요. 잠시 뒤 다시 해 주세요.',500);
        const days=(Date.parse(until+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000;
        if(days<1)throw fail('다시 여는 날은 내일부터 고를 수 있어요.');
        if(days>CAPACITY_LIMITS.untilDays)throw fail('다시 여는 날은 1년 안에서 골라 주세요.');
      }
      const note=cleanNote(input.pauseNote??'',CAPACITY_LIMITS.note),noteEn=cleanNote(input.pauseNoteEn??'',CAPACITY_LIMITS.noteEn);
      if(note===null)throw fail(`손님에게 보일 안내는 ${CAPACITY_LIMITS.note}자까지 적을 수 있어요.`);
      if(noteEn===null)throw fail(`영어 안내는 ${CAPACITY_LIMITS.noteEn}자까지 적을 수 있어요.`);
      next={open:false,pausedUntil:until,pauseNote:note,pauseNoteEn:noteEn};
    }else if(['pausedUntil','pauseNote','pauseNoteEn'].some(key=>input[key]!==undefined&&input[key]!==null&&input[key]!==''))throw fail('접수를 받는 동안에는 쉬는 안내를 적지 않아요.');
    // 자리 몫은 그대로 둔다(운영 조각 6-B — 쉬기만 눌러도 자리 수가 지워지지 않게).
    save(actor,{...seatPart(stored()),...next});
    return settings(user);
  }
  // 자리 수: 영상 · 사진 · 대기 셋을 한 번에(0 ~ 50). 쉬기 몫 · 손으로 잡은 자리는 그대로.
  function configureSeats(user,input){
    const actor=admin(user,'관리자만 제작 자리를 바꿀 수 있어요.');
    if(!object(input)||Object.keys(input).some(key=>!SEAT_KEYS.includes(key))||SEAT_KEYS.some(key=>!Object.hasOwn(input,key)))throw fail('바꿀 자리 수를 확인해 주세요.');
    if(SEAT_KEYS.some(key=>!Number.isSafeInteger(input[key])||input[key]<0||input[key]>SEAT_LIMITS.max))throw fail(`자리 수는 0에서 ${SEAT_LIMITS.max} 사이의 정수로 적어 주세요.`);
    const row=stored();
    save(actor,{...pausePart(row),seats:Object.fromEntries(SEAT_KEYS.map(key=>[key,input[key]])),held:readSeats(row).held});
    return settings(user);
  }
  // 손으로 잡은 자리: 더하기 {add:{kind, note}} · 빼기 {remove:id}. 스물까지.
  function configureHeld(user,input){
    const actor=admin(user,'관리자만 손으로 잡은 자리를 바꿀 수 있어요.');
    if(!object(input)||Object.keys(input).length!==1||!['add','remove'].includes(Object.keys(input)[0]))throw fail('바꿀 자리를 확인해 주세요.');
    const row=stored(),{seats,held}=readSeats(row);
    let next;
    if(input.add!==undefined){
      const add=input.add;
      if(!object(add)||Object.keys(add).some(key=>!['kind','note'].includes(key))||!KINDS.includes(add.kind))throw fail('잡을 자리의 종류를 골라 주세요.');
      const note=cleanNote(add.note??'',SEAT_LIMITS.heldNote);
      if(note===null||!note)throw fail(`무슨 일로 잡는지 ${SEAT_LIMITS.heldNote}자 안으로 적어 주세요.`);
      if(held.length>=SEAT_LIMITS.held)throw fail(`손으로 잡는 자리는 ${SEAT_LIMITS.held}개까지예요.`,409);
      next=[...held,{id:newId(),kind:add.kind,note,at:clock(),by:actor.id}];
    }else{
      if(typeof input.remove!=='string'||!held.some(item=>item.id===input.remove))throw fail('뺄 자리를 찾지 못했어요. 화면을 새로 고쳐 주세요.',404);
      next=held.filter(item=>item.id!==input.remove);
    }
    save(actor,{...pausePart(row),seats,held:next});
    return settings(user);
  }
  // 손님에게 내리는 값. 열려 있으면 상태 하나뿐이다(화면은 아무것도 더하지 않는다).
  // queue · full: 자리가 찬 종류(kinds — video · photo)와 결제 안내 예정일(noticeDate — 찬 종류가 둘이면 늦은 쪽, 하나라도 모르면 '').
  function publicView(){
    const now=read();
    if(!now.open)return {state:'paused',until:now.pausedUntil,note:now.pauseNote,noteEn:now.pauseNoteEn};
    const s=state(),busy=KINDS.filter(kind=>s[kind].state!=='open');
    if(!busy.length)return {state:'open'};
    const dates=busy.map(kind=>s[kind].noticeDate),noticeDate=dates.every(Boolean)?dates.sort().at(-1):'';
    return {state:busy.length===KINDS.length&&busy.every(kind=>s[kind].state==='full')?'full':'queue',kinds:busy,noticeDate};
  }
  const paused=()=>!read().open;
  // 새 의뢰서 시작을 막을 때: 영상 · 사진 모두 대기까지 찼을 때만(한쪽이라도 받을 수 있으면 시작은 연다 — 무엇을 고를지 아직 모른다).
  const full=()=>{const s=state();return KINDS.every(kind=>s[kind].state==='full');};
  const seatFor=row=>projectSeat(state(),row);
  const seatsNow=()=>summary(state());
  return {read,settings,configure,configureSeats,configureHeld,publicView,paused,full,seatFor,seatsNow};
}
