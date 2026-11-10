import {randomBytes,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import {pulseMailEligibility,pulseMailRecipient,validPulseMailAddress} from './pulse-mail.mjs';

// 메일 코드로 프로젝트 다시 열기(판 4 · 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_판매전_설계.md 2절).
// 새 기기 · 12시간 뒤에도 손님이 의뢰서에 적은 메일로 여섯 자리 코드를 받아 자기 프로젝트를 다시 연다. 메일에는 방 열쇠를 넣지 않는다.
// - 요청은 맞는 프로젝트가 있든 없든 곧바로 같은 답을 한다(응답 시간 · 문장으로 주소가 드러나지 않게). 코드 만들기 · 보내기는 답한 뒤 요청 밖에서 하나씩.
// - 코드는 해시(HMAC)만 남기고 원문은 보낸 뒤 버린다. 10분 · 한 번 · 다섯 번 틀리면 끝. 새 코드가 실제로 보내진 뒤에만 그 주소의 앞 코드를 무효로 한다.
// - 확인하면 그 프로젝트의 손님 세션(clientProjects.openVerified — 초대 기한과 무관, 보관 · 방 닫힘 · 새 초대에는 끝남)을 만든다. 맞는 프로젝트가 둘 이상이면 고르기 표를 준다.
// - 기록에는 주소 · 코드를 쓰지 않는다(프로젝트 수 · 결과 코드만).
export const PULSE_MAIL_CODES='pulseMailCodes';
export const PULSE_MAIL_OPEN_ANSWER='진행 중인 의뢰가 있으면 이 주소로 코드를 보냈어요.';
const CODE_MS=10*60000,PICK_MS=5*60000,KEEP_MS=24*3600000,MAX_TRIES=5,HOUR=3600000,DAY=24*3600000;
const PER_ADDRESS_HOUR=3,PER_ADDRESS_DAY=6,DAILY=30;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

export function createPulseMailOpen({store,clientProjects,pulseMail,clock=()=>new Date().toISOString(),log=()=>{}}){
  if(!store||!clientProjects||!pulseMail)throw new TypeError('메일로 다시 열기 설정이 이상해요.');
  const queue=[],picks=new Map();let working=null;
  const nowMs=()=>{const ms=Date.parse(clock());if(!Number.isFinite(ms))throw fail('서버 시계를 읽지 못했어요.',500);return ms;};
  const iso=ms=>new Date(ms).toISOString();
  const normal=value=>String(value||'').trim().toLowerCase();
  // 코드 해시는 메일 열쇠 문서의 비밀 소금으로 만든다(저장소가 새어도 여섯 자리를 되찾지 못하게 — 소금은 저장소 밖 암호 문서).
  const codeHash=(id,code)=>Buffer.from(pulseMail.secretHash(`open-code:${id}:${code}`),'hex');
  // 그 주소로 다시 열 수 있는 프로젝트: 메일 대상(보관 아님 · 방 열쇠 살아 있음)이고 받는 사람 규칙이 이 주소인 것.
  const matching=email=>store.all('clientProjects').filter(row=>!pulseMailEligibility(row)&&normal(pulseMailRecipient(row).email)===email).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  function prune(ms){for(const doc of store.all(PULSE_MAIL_CODES))if(Date.parse(doc.createdAt)+KEEP_MS<=ms)store.remove(PULSE_MAIL_CODES,doc.id);for(const [id,pick]of picks)if(pick.expiresAt<=ms)picks.delete(id);}

  // 요청: 꼴만 보고 곧바로 같은 답. 맞는 주소 · 문턱 안이면 보내기를 큐에 넣는다.
  function request(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['email','website'].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    const email=normal(input.email);
    if(!validPulseMailAddress(email))throw fail('이메일 주소를 확인해 주세요.');
    const ms=nowMs();prune(ms);
    // 맞든 안 맞든 같은 계산을 한 번 거친다(시간 차를 줄인다).
    const key=pulseMail.addressKey(email),projects=matching(email);
    if(input.website)return {ok:true,message:PULSE_MAIL_OPEN_ANSWER};
    if(projects.length&&pulseMail.active()){
      const docs=store.all(PULSE_MAIL_CODES),mine=docs.filter(doc=>doc.addressKey===key);
      const hour=mine.filter(doc=>Date.parse(doc.createdAt)+HOUR>ms).length,day=mine.length,total=docs.filter(doc=>doc.state!=='failed').length;
      if(hour<PER_ADDRESS_HOUR&&day<PER_ADDRESS_DAY&&total<DAILY){
        const id=randomUUID();
        store.put(PULSE_MAIL_CODES,id,{id,addressKey:key,projectIds:projects.map(row=>row.id),state:'queued',attempts:0,createdAt:iso(ms),expiresAt:null,codeHash:null});
        queue.push({id,email});drain();
      }
    }
    return {ok:true,message:PULSE_MAIL_OPEN_ANSWER};
  }
  function drain(){
    if(working)return working;
    working=(async()=>{try{while(queue.length){const job=queue.shift();await send(job).catch(()=>{});}}finally{working=null;}})();
    return working;
  }
  async function send({id,email}){
    const doc=store.get(PULSE_MAIL_CODES,id);if(!doc||doc.state!=='queued')return;
    const code=String(randomInt(0,1000000)).padStart(6,'0');
    const subject=`〔SYNK PULSE〕 프로젝트 열기 코드 ${code}`;
    const body=['안녕하세요, SYNK PULSE입니다.','',`프로젝트를 여는 코드: ${code}`,'PULSE 앱의 「메일로 다시 열기」에 넣어 주세요. 10분 동안 한 번 쓸 수 있어요.','','요청하지 않으셨으면 이 메일은 지우셔도 돼요. 코드가 없으면 아무도 프로젝트를 열 수 없어요.'].join('\n');
    const verdict=await pulseMail.sendDirect({key:`open:${id}`,to:email,subject,body});
    const ms=nowMs();
    if(verdict.kind!=='sent'){store.put(PULSE_MAIL_CODES,id,{...doc,state:'failed',reason:String(verdict.code||verdict.kind).slice(0,40)});log({event:'pulse-mail-open',state:'failed',reason:verdict.code||verdict.kind});return;}
    // 실제로 보낸 뒤에만 그 주소의 앞 코드를 무효로 한다(남이 같은 주소로 요청해 손님이 넣던 코드를 죽이지 않게).
    for(const other of store.all(PULSE_MAIL_CODES))if(other.addressKey===doc.addressKey&&other.id!==id&&other.state==='sent')store.put(PULSE_MAIL_CODES,other.id,{...other,state:'replaced'});
    store.put(PULSE_MAIL_CODES,id,{...doc,state:'sent',sentAt:iso(ms),expiresAt:iso(ms+CODE_MS),codeHash:codeHash(id,code).toString('hex')});
    log({event:'pulse-mail-open',state:'sent',projects:doc.projectIds.length});
  }

  // 확인: 맞으면 세션(프로젝트 하나) 또는 고르기 표(둘 이상). 틀리면 같은 말.
  function verify(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['email','code'].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    const email=normal(input.email),code=String(input.code||'').replace(/\s+/g,'');
    if(!validPulseMailAddress(email)||!/^\d{6}$/.test(code))throw fail('메일 주소와 여섯 자리 코드를 확인해 주세요.');
    const ms=nowMs(),key=pulseMail.addressKey(email);
    const doc=store.all(PULSE_MAIL_CODES).filter(item=>item.addressKey===key&&item.state==='sent').sort((a,b)=>b.sentAt.localeCompare(a.sentAt))[0];
    if(!doc||Date.parse(doc.expiresAt)<=ms||doc.attempts>=MAX_TRIES)throw fail('코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.',401);
    const expected=Buffer.from(doc.codeHash,'hex'),given=codeHash(doc.id,code);
    if(expected.length!==given.length||!timingSafeEqual(expected,given)){
      const attempts=doc.attempts+1;store.put(PULSE_MAIL_CODES,doc.id,{...doc,attempts,...(attempts>=MAX_TRIES?{state:'locked'}:{})});
      throw fail('코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.',401);
    }
    store.put(PULSE_MAIL_CODES,doc.id,{...doc,state:'used',usedAt:iso(ms)});
    // 확인하는 순간 다시 본다: 그사이 보관 · 방 닫힘 · 받는 주소가 바뀐 프로젝트는 빼고 연다.
    const open=matching(email).filter(row=>doc.projectIds.includes(row.id));
    if(!open.length)throw fail('코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.',401);
    log({event:'pulse-mail-open',state:'verified',projects:open.length});
    if(open.length===1)return {opened:clientProjects.openVerified(open[0].id)};
    const ticket=randomBytes(24).toString('base64url');
    // 고르기 표는 확인한 주소와 그때의 초대 판에 묶는다 — 고를 때 받는 주소가 바뀌었거나 초대를 새로 냈거나 보관했으면 그 프로젝트는 열지 않는다(GPT 검수 GA1).
    picks.set(ticket,{email,projects:new Map(open.map(row=>[row.id,row.inviteRevision])),expiresAt:ms+PICK_MS});
    return {choices:{ticket,projects:open.map(row=>({id:row.id,title:row.title,number:row.studio?.request?.number||''}))}};
  }
  function pick(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['ticket','projectId'].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    const entry=typeof input.ticket==='string'?picks.get(input.ticket):null,ms=nowMs();
    if(!entry||entry.expiresAt<=ms||!entry.projects.has(input.projectId))throw fail('고르는 시간이 지났어요. 코드를 다시 받아 주세요.',401);
    picks.delete(input.ticket);
    const row=matching(entry.email).find(item=>item.id===input.projectId);
    if(!row||row.inviteRevision!==entry.projects.get(input.projectId))throw fail('고르는 시간이 지났어요. 코드를 다시 받아 주세요.',401);
    return {opened:clientProjects.openVerified(input.projectId)};
  }
  // 서버를 끌 때: 새 요청을 받지 않고 보내던 코드를 마저 보낸다(기다림 상한 — 넘으면 그 코드는 queued로 남고, 다음에 켤 때 실패로 접는다 · GPT 검수 GA4).
  let stopped=false;
  function stop(ms=35000){stopped=true;queue.length=0;return Promise.race([working||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,ms).unref?.())]);}
  function idle(){return working||Promise.resolve();}
  // 켤 때: 앞 실행이 보내지 못하고 남긴 queued 문서를 실패로 접는다(하루 셈을 계속 먹지 않게).
  try{for(const doc of store.all(PULSE_MAIL_CODES))if(doc.state==='queued')store.put(PULSE_MAIL_CODES,doc.id,{...doc,state:'failed',reason:'restart'});}catch{/* 저장소가 아직 준비 전이면 다음 요청 때 접는다 */}
  return {request:input=>{if(stopped)throw fail('잠시 뒤 다시 시도해 주세요.',503);return request(input);},verify,pick,idle,stop,available:()=>!stopped&&pulseMail.active()};
}
