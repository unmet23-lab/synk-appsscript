// PULSE 제작 정원 — 접수 멈춤 스위치(2026-11-11 운영 조각 3, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2).
// 이번 판은 설정 문서 pulseCapacity의 open · pausedUntil · pauseNote만 쓴다. 자리 수(영상 · 사진 · 대기)와 queue · full 상태는 조각 6에서 같은 문서에 더한다.
//   open        — false면 새 의뢰서 시작을 쉰다(paused). 쓰던 초안의 보내기 · 10분 재전송은 막지 않는다(막는 자리는 pulse-requests.mjs start 하나 — 409 SYNK_PULSE_INTAKE_PAUSED).
//   pausedUntil — 다시 여는 날(한국 날짜 YYYY-MM-DD). 그날 0시(한국 시간)부터 저절로 열린다. 비우면 담당자가 열 때까지 쉰다.
//   pauseNote   — 손님에게 그대로 보이는 안내 한 줄(pauseNoteEn은 영어 화면에 보일 글 — 비우면 영어 화면은 고정 문장과 날짜만 보인다).
// 바꾸기는 관리자만 하고 server.mjs가 CSRF · 감사 기록을 붙인다(pulse-features.mjs와 같은 꼴). 저장한 문서가 이상하면 여는 쪽(기본값)으로 읽는다 —
// 문서가 깨졌다고 접수가 닫히면 아무도 모르는 채 판매가 멈춘다.
// 공개 응답(publicView)은 상태 · 다시 여는 날 · 안내 글뿐이다. 건수 · 남은 자리 · 누가 바꿨는지는 내리지 않는다.
export const PULSE_CAPACITY_KIND='pulseCapacity';
export const CAPACITY_LIMITS=Object.freeze({note:200,noteEn:300,untilDays:366});
const ID='main',KEYS=['open','pausedUntil','pauseNote','pauseNoteEn'];
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
export function createPulseCapacity({store,clock=()=>new Date().toISOString()}){
  if(!store)throw new TypeError('제작 정원 설정이 이상해요.');
  const stored=()=>store.get(PULSE_CAPACITY_KIND,ID)||null;
  const read=()=>readPulseCapacity(stored(),clock());
  const live=user=>{const row=store.get('users',user?.id);if(!row?.active)throw fail('먼저 로그인해 주세요.',401);return row;};
  // 직원 화면: 로그인한 직원은 누구나 읽고(손님에게 보이는 값과 같다), 바꾸는 것은 관리자만.
  function settings(user){
    const actor=live(user),row=stored(),now=read(),admin=actor.role==='admin';
    // reopened: 다시 여는 날이 되어 저절로 열린 뒤 아직 아무도 손대지 않은 상태 — 화면이 「○일에 다시 열렸어요」를 말할 수 있게.
    const reopened=now.open&&object(row)&&row.open===false&&realDate(row.pausedUntil)?row.pausedUntil:'';
    return {...now,state:now.open?'open':'paused',reopened,canEdit:admin,updatedAt:row?.updatedAt||null,...(admin?{updatedBy:row?.updatedBy||null}:{})};
  }
  function configure(user,input){
    const actor=live(user);
    if(actor.role!=='admin')throw fail('관리자만 접수를 쉬거나 다시 열 수 있어요.',403);
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
    store.put(PULSE_CAPACITY_KIND,ID,{...next,updatedAt:clock(),updatedBy:actor.id});
    return settings(user);
  }
  // 손님에게 내리는 값. 열려 있으면 상태 하나뿐이다(화면은 아무것도 더하지 않는다).
  function publicView(){
    const now=read();
    return now.open?{state:'open'}:{state:'paused',until:now.pausedUntil,note:now.pauseNote,noteEn:now.pauseNoteEn};
  }
  const paused=()=>!read().open;
  return {read,settings,configure,publicView,paused};
}
