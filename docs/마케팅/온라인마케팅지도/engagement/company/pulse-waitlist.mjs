import {randomUUID} from 'node:crypto';
import {validPulseMailAddress,PULSE_MAIL_APP_URL} from './pulse-mail.mjs';
import {serverText} from './pulse-locale.mjs';

// 알림 명단(운영 조각 6-C · 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2 「정원 · 예약」).
// 제작 자리 · 대기 자리가 모두 찬 동안(full) 손님이 「열리면 메일로 알려 드릴까요?」에 주소를 남기면, 자리가 나는 대로 남긴 차례로 한 통씩 보낸다.
// - 등록은 늘 같은 답이다(이미 있는 주소인지 드러내지 않는다). 주소는 소금 넣은 해시로 같은 주소를 알아보고, 보내려고 원문을 둔다 — 보내면 원문을 지운다.
// - 보내는 수: 지금 새 의뢰서를 받을 수 있는 자리 수(openings)에서 최근 이틀 안에 이미 알린 수를 뺀 만큼, 하루 스무 통 · 주소당 하루 한 통까지(접수 확인 메일과 같은 문턱).
// - 명단은 이백까지, 90일 지나면 지운다. 손님이 적은 글은 받지 않는다(주소 · 화면 언어만).
export const PULSE_WAITLIST='pulseWaitlist';
// retryMs: 끊김 · 알 수 없음 뒤 다시 보내기까지(타이머가 5분이라 5분부터 — 다섯 번째에 접기까지 네 시간 넘게), capHoldMs: 중계 하루 한도 뒤 쉬는 때(메일 함과 같은 한 시간).
export const PULSE_WAITLIST_LIMITS=Object.freeze({size:200,keepDays:90,sentKeepMs:48*3600000,daily:20,attempts:5,retryMs:Object.freeze([5*60000,15*60000,3600000,3*3600000]),capHoldMs:3600000});
const DAY=24*3600000;
const fail=(message,status=400,code='')=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const LOCALES=['ko','en'];

// 알림 메일 한 통(손님이 고른 화면 언어로). 손님이 적은 글은 넣지 않는다.
export function pulseWaitlistMail(loc='ko'){
  const lang=LOCALES.includes(loc)?loc:'ko',tx=text=>serverText(lang,text);
  const link=`${PULSE_MAIL_APP_URL}?start=request${lang==='en'?'&lang=en':''}`;
  return {subject:tx('〔SYNK PULSE〕 제작 자리가 났어요'),body:[tx('안녕하세요, SYNK PULSE입니다.'),'',tx('알려 달라고 하신 제작 자리가 났어요. 아래 주소에서 광고 의뢰서를 바로 시작하실 수 있어요.'),link,'',tx('자리는 먼저 시작하신 분부터 차요.'),tx('이 알림은 한 번만 보내 드리고, 주소는 알림 명단에서 지웠어요.')].join('\n')};
}

export function createPulseWaitlist({store,pulseMail,capacity,clock=()=>new Date().toISOString(),log=()=>{}}){
  if(!store||!pulseMail||!capacity)throw new TypeError('알림 명단 설정이 이상해요.');
  let running=null,stopped=false,capUntil=0;
  const nowMs=()=>{const ms=Date.parse(clock());if(!Number.isFinite(ms))throw fail('서버 시계를 읽지 못했어요.',500);return ms;};
  const iso=ms=>new Date(ms).toISOString();
  const all=()=>store.all(PULSE_WAITLIST);
  // 지우기: 기다리는 줄은 남긴 지 90일, 알린 줄은 알린 지 이틀(남긴 날이 90일 가까워 알린 줄도 이틀은 세게 — 카본 A4).
  function prune(ms){
    for(const doc of all()){
      const at=Date.parse(doc.createdAt),sent=Date.parse(doc.sentAt||'');
      const expired=doc.state==='sent'?!Number.isFinite(sent)||sent+PULSE_WAITLIST_LIMITS.sentKeepMs<=ms:!Number.isFinite(at)||at+PULSE_WAITLIST_LIMITS.keepDays*DAY<=ms;
      if(expired)store.remove(PULSE_WAITLIST,doc.id);
    }
  }
  const available=()=>!stopped&&pulseMail.active();

  // 등록: 대기까지 찬 동안만, 메일이 켜져 있을 때만. 꼴이 맞으면 늘 같은 답.
  function register(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['email','locale','website'].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    const email=String(input.email||'').trim().toLowerCase();
    if(!validPulseMailAddress(email))throw fail('이메일 주소를 확인해 주세요.');
    const locale=LOCALES.includes(input.locale)?input.locale:'ko';
    if(input.website)return {ok:true};
    // 409(5xx가 아니다) — 운영에서는 5xx 글이 「처리하지 못했습니다」로 바뀌어 한국어 화면에 이 안내가 안 닿는다(최종 화면 검수).
    if(!available())throw fail('지금은 메일 알림을 받을 수 없어요. 잠시 뒤 이 화면에서 다시 봐 주세요.',409,'SYNK_PULSE_WAITLIST_OFF');
    // 그 사이 쉬기로 바뀌었거나 자리가 났으면 받지 않는다 — 화면이 상태를 다시 읽어 쉬기 안내 · 시작 단추를 세운다(쉬는 중에 「바로 시작」이라 하지 않게 답을 가른다).
    if(capacity.paused())throw fail('지금은 잠시 접수를 쉬어요. 다시 열리면 이 화면에서 바로 시작하실 수 있어요.',409,'SYNK_PULSE_INTAKE_PAUSED');
    if(!capacity.full())throw fail('그 사이 자리가 났어요. 이 화면에서 바로 시작하실 수 있어요.',409,'SYNK_PULSE_WAITLIST_OPEN');
    const ms=nowMs();prune(ms);
    const key=pulseMail.addressKey(email),waiting=all().filter(doc=>doc.state==='waiting');
    // 명단이 찼으면 이미 있는 주소에도 같은 409 — 답으로 그 주소가 명단에 있는지 드러나지 않게(카본 A1).
    if(waiting.length>=PULSE_WAITLIST_LIMITS.size)throw fail('알림 명단이 찼어요. 이 화면에서 자리를 다시 봐 주세요.',409,'SYNK_PULSE_WAITLIST_FULL');
    if(waiting.some(doc=>doc.addressKey===key))return {ok:true};
    const id=randomUUID();
    store.put(PULSE_WAITLIST,id,{id,addressKey:key,email,locale,state:'waiting',attempts:0,createdAt:iso(ms)});
    log({event:'pulse-waitlist',state:'registered',size:waiting.length+1});
    return {ok:true};
  }

  // 한 바퀴: 자리가 난 만큼 남긴 차례로 보낸다. 서버 타이머(5분) · 시험이 부른다. 한 번에 하나만 돈다.
  function tick(){
    if(running)return running;
    running=(async()=>{try{return await round();}finally{running=null;}})();
    return running;
  }
  async function round(){
    // 지우기는 메일이 꺼져 있어도 돈다 — 메일을 끄거나 중계가 끊긴 동안에도 기한 지난 주소가 남지 않게(카본 A3).
    const ms=nowMs();prune(ms);
    // 중계 하루 한도에 걸린 뒤 한 시간은 묻지 않는다(5분마다 한도에 부딪히지 않게 — 서버를 다시 켜면 처음부터).
    if(!available()||ms<capUntil)return {sent:0,waiting:all().filter(doc=>doc.state==='waiting').length};
    const docs=all(),recent=docs.filter(doc=>doc.state==='sent'),today=recent.filter(doc=>Date.parse(doc.sentAt)+DAY>ms);
    // 이미 알린 사람(최근 이틀)은 그 자리를 쓰러 오는 중으로 본다 — 같은 빈자리로 여러 번 부르지 않게.
    // 보낼 수는 한 통마다 다시 센다 — 보내는 사이(한 통에 수십 초) 쉬기 · 자리 줄이기 · 다른 손님의 시작으로 빈자리가 줄면 거기서 멈춘다(카본 A5).
    let sent=0;
    const room=()=>Math.min(capacity.openings()-recent.length-sent,PULSE_WAITLIST_LIMITS.daily-today.length-sent);
    // 주소당 하루 한 통(접수 확인 메일과 같은 문턱): 오늘 알린 주소가 다시 남겼으면 그 줄은 두고 하루가 지난 뒤 보낸다.
    const notified=new Set(today.map(doc=>doc.addressKey));
    for(const doc of docs.filter(item=>item.state==='waiting').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
      if(stopped||!available()||room()<=0)break;
      if(notified.has(doc.addressKey))continue;
      const live=store.get(PULSE_WAITLIST,doc.id);if(!live||live.state!=='waiting')continue;
      // 끊겨 다시 보낼 때를 기다리는 차례면 이 바퀴는 멈춘다(뒤 사람이 앞지르지 않게).
      if(live.nextAttemptAt&&Date.parse(live.nextAttemptAt)>ms)break;
      const mail=pulseWaitlistMail(live.locale);
      const verdict=await pulseMail.sendDirect({key:`waitlist:${live.id}`,to:live.email,...mail});
      const at=iso(nowMs());
      if(verdict.kind==='sent'){
        // 보낸 뒤에는 주소 원문을 지우고 해시 · 때만 이틀 남긴다(같은 자리로 다시 부르지 않게 셈하는 몫).
        const {email,...rest}=live;store.put(PULSE_WAITLIST,live.id,{...rest,state:'sent',sentAt:at});notified.add(live.addressKey);sent++;
        log({event:'pulse-waitlist',state:'sent'});continue;
      }
      if(verdict.kind==='failed'){store.remove(PULSE_WAITLIST,live.id);log({event:'pulse-waitlist',state:'dropped',reason:verdict.code});continue;}
      // 중계 하루 한도 · 꺼짐 · 연결 문제는 손님 주소 탓이 아니다 — 시도로 세지 않고 이 바퀴만 멈춘다(메일 함과 같은 갈래, 카본 A2).
      if(verdict.kind==='cap'||verdict.kind==='off'||verdict.kind==='broken'){if(verdict.kind==='cap')capUntil=nowMs()+PULSE_WAITLIST_LIMITS.capHoldMs;log({event:'pulse-waitlist',state:'held',reason:verdict.code||verdict.kind});break;}
      // 끊김 · 알 수 없음: 그 사람 차례를 지키고 간격을 늘려 가며 다시(5분 · 15분 · 1시간 · 3시간 — 같은 열쇠라 중계가 겹쳐 보내지 않는다), 다섯 번이면 접는다(카본 다시 검수 A1).
      const attempts=(live.attempts||0)+1,wait=PULSE_WAITLIST_LIMITS.retryMs[Math.min(attempts-1,PULSE_WAITLIST_LIMITS.retryMs.length-1)];
      if(attempts>=PULSE_WAITLIST_LIMITS.attempts)store.remove(PULSE_WAITLIST,live.id);else store.put(PULSE_WAITLIST,live.id,{...live,attempts,lastTriedAt:at,nextAttemptAt:iso(Date.parse(at)+wait),reason:String(verdict.code||verdict.kind).slice(0,40)});
      log({event:'pulse-waitlist',state:'retry',reason:verdict.code||verdict.kind});
      break;
    }
    return {sent,waiting:all().filter(doc=>doc.state==='waiting').length};
  }
  function stop(){stopped=true;return running||Promise.resolve();}
  return {register:input=>{if(stopped)throw fail('잠시 뒤 다시 시도해 주세요.',503);return register(input);},tick,stop,available};
}
