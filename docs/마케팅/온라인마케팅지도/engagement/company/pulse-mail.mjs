import {createHash,createHmac,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {serverText} from './pulse-locale.mjs';

// PULSE 고객 메일 알림(판 2 · 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판2_메일_설계.md, 판 4에서 여덟 순간으로 — 판4_판매전_설계.md 3절).
// 손님 차례가 오는 여덟 순간(접수 확인 · 되묻기 · 방향 제안 · 글 콘티 · 결제 안내 · 장면 이미지 · 영상 확인 · 납품)에만, 고객 알림 투영을 끌어와 함을 채우고
// founder@synk.im 소유 Apps Script 중계(pulse-mail-relay/relay.gs)로 보낸다. 중계가 같은 열쇠는 한 번만 보내므로
// 응답을 못 받은 요청은 같은 열쇠로 다시 보내도 안전하다. 함 · 기록에는 주소 · 제목 · 본문을 두지 않는다.
export const PULSE_MAIL_MOMENTS=Object.freeze(['request_received','request_asked','direction_proposed','draft_ready','payment_requested','images_ready','preview_ready','final_ready']);
// 접수 확인은 손님 대상 알림 사건이 없어 접수 때 함에 바로 넣는다(receipt). 묶지 않고, 읽음 · 이미 함으로 거르지 않는다(주소 확인 몫).
const DIRECT_MOMENTS=new Set(['request_received']);
const RECEIPT_DAILY=20,RECEIPT_PER_ADDRESS_MS=24*3600000,RECEIPT_DELAY_MS=30000;
export const PULSE_MAIL_RELAY_VERSION=1;
export const PULSE_MAIL_SECRET='pulse-mail-relay-key';
export const PULSE_MAIL_APP_URL='https://workspace.synk.im/pulse-app/';
// 메일의 앱 주소는 다시 열기 판을 연다(열린 세션 · 기억한 기기가 있으면 그대로 방으로). 주소창에 메일 주소는 싣지 않는다.
export const PULSE_MAIL_OPEN_URL=PULSE_MAIL_APP_URL+'?open=mail';
export const PULSE_MAIL_SETTINGS='pulseMailSettings';
export const PULSE_MAIL_OUTBOX='pulseMailOutbox';
const EXPIRE_MS=48*3600000,UNKNOWN_CHECK_MS=600000,REPING_MS=600000,MERGE_MS=180000,MERGE_CAP_MS=900000,LEASE_MS=300000,RETRY_MS=[60000,300000,900000],MAX_ATTEMPTS=4,CAP_RETRY_MS=3600000,KEEP_MS=90*86400000,BATCH=5,TIMEOUT_MS=30000;
const ECHO_HOST='script.googleusercontent.com';
const RELAY_URL=/^https:\/\/script\.google\.com\/(?:a\/macros\/[a-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]{20,200}\/exec$/;
const EMAIL=/^[^\s@,;<>"'()[\]\\]+@[^\s@,;<>"'()[\]\\]+\.[^\s@,;<>"'()[\]\\]+$/;
const FINAL=new Set(['sent','skipped','failed','unknown']);
const CONFIG_CODES=new Set(['signature','no_key','clock','format']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max).trim();
const iso=ms=>new Date(ms).toISOString();

export const validPulseMailAddress=value=>typeof value==='string'&&value.length<=254&&EMAIL.test(value);
export const pulseMailSignedMessage=({op,key='',ts,to='',subject='',body=''})=>JSON.stringify(['pulse-mail/v1',op,key,ts,to,subject,body]);

// 받는 사람: 담당자가 고친 주소(request.contact.email)가 있으면 그것, 없으면 의뢰서 주소. 담당자가 끄면 없음.
export function pulseMailRecipient(row){
  const request=row?.studio?.request;if(!request)return {email:null,reason:'not_request'};
  const contact=request.contact||{};
  if(contact.mailOff===true)return {email:null,reason:'mail_off'};
  const answered=String(request.answers?.email||'').trim();
  const override=contact.email&&(contact.basedOn===undefined||contact.basedOn===answered)?String(contact.email).trim():'';
  const email=override||answered;
  return validPulseMailAddress(email)?{email,reason:null}:{email:null,reason:'no_email'};
}
// 메일 대상 프로젝트: 의뢰서 흐름 · 보관 안 함 · 고객 방 열쇠가 살아 있음.
export function pulseMailEligibility(row){
  if(!row?.studio?.request)return 'not_request';
  if(row.stage==='archived')return 'archived';
  if(!row.inviteHash)return 'no_room';
  return null;
}
// 판 사건(draft_ready)은 글 콘티 판이면 「글 콘티」, 장면 이미지 판(사진은 첫 장)이면 「장면 이미지」 순간이다(결정 11-10 D4 — 11-07의 「글 콘티 판과 첫 판만」을 바꿈).
export function pulseMailMoment(row,item){
  if(item?.type==='draft_ready'){
    const round=Number(String(item.id).split(':').at(-1)),entry=row?.studio?.request?.rounds?.[round-1];
    if(!Number.isSafeInteger(round)||entry?.round!==round)return null;
    return entry.kind==='script'?'draft_ready':entry.kind==='images'?'images_ready':null;
  }
  if(DIRECT_MOMENTS.has(item?.type)||item?.type==='images_ready')return null;
  return PULSE_MAIL_MOMENTS.includes(item?.type)?item.type:null;
}

// 손님이 이미 그 순간의 일을 했으면(방향 답 · 글 콘티 의견 · 확인 · 영상 승인 · 의견 · 수령 확인) 메일을 보내지 않는다.
export function pulseMailActed(row,moment,latest){
  const request=row?.studio?.request||{};
  if(moment==='request_asked')return !(request.asks||[]).some(ask=>ask.status==='open');
  if(moment==='direction_proposed')return request.directionProposal?.status!=='open';
  if(moment==='payment_requested')return request.payment?.status!=='requested';
  if(moment==='draft_ready'||moment==='images_ready'){const round=Number(String(latest?.id).split(':').at(-1)),entry=request.rounds?.[round-1];return !!(entry?.feedbackAt||entry?.approvedAt);}
  const versionId=latest?.versionId;if(!versionId)return false;
  if(moment==='preview_ready')return !!(row.versions||[]).find(version=>version.id===versionId)?.approvedAt||(row.messages||[]).some(message=>message.author==='customer'&&message.versionId===versionId);
  if(moment==='final_ready')return (row.deliveryReceipts||[]).some(entry=>entry.versionIds?.includes(versionId));
  return false;
}
export const pulseMailRelayKey=id=>createHash('sha256').update(String(id)).digest('hex').slice(0,24);
const mask=email=>{const [local,domain]=email.split('@');return `${local.slice(0,1)}***@${domain}`;};

// 판 순간의 그 판(사건 id 끝이 판 번호). 같은 종류의 앞 판이 있으면 「고친」 판이다.
const roundOf=(row,latest)=>{const rounds=row?.studio?.request?.rounds||[],round=Number(String(latest?.id||'').split(':').at(-1));return Number.isSafeInteger(round)&&rounds[round-1]?.round===round?rounds[round-1]:rounds.at(-1)||null;};
const revisedRound=(row,entry)=>!!entry&&(row?.studio?.request?.rounds||[]).some(other=>other.round<entry.round&&other.kind===entry.kind);
// 받으실 날: 결제를 확인할 때 정한 날이 있으면 그것, 없으면 방향 제안의 날(KST 날짜).
const dueOf=request=>request?.payment?.status==='confirmed'&&request.payment.dueDate||request?.directionProposal?.dueDate||'';
const dayText=(day,loc)=>new Intl.DateTimeFormat(loc==='ko'?'ko-KR':'en-US',{month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));
const won=(amount,loc)=>loc==='ko'?(amount%10000===0?`${amount/10000}만 원`:`${amount.toLocaleString('ko-KR')}원`):`KRW ${amount.toLocaleString('en-US')}`;
const WAITING=new Set(['request_asked','direction_proposed','draft_ready','payment_requested','images_ready','preview_ready']);
// loc: 프로젝트 소통 언어(다국어 판 2, pulse-locale.mjs). 문장은 통째로 서버 사전 키이고 한국어는 지금 글자 그대로다.
// latest: 그 메일의 마지막 알림 사건(판 순간에서 어느 판인지 본다). 접수 확인에는 없다.
export function pulseMailCompose(row,moment,loc='ko',latest=null){
  const request=row?.studio?.request||{},a=request.answers||{},product=clean(a.name,40),who=clean(a.contactName,40),photo=a.package==='photo';
  const tx=(text,vars)=>serverText(loc,text,vars);
  const links=[tx('PULSE 앱에서 확인해 주세요: {url}',{url:PULSE_MAIL_OPEN_URL}),tx('이 기기를 기억해 두셨다면 바로 열려요. 다른 기기에서는 「메일로 다시 열기」에 이 메일 주소를 넣으시면 코드를 보내 드려요.')];
  // 접수 확인은 사람 손 없이 손님이 적은 주소로 바로 나가는 메일이라 손님이 적은 글(이름 · 제품 이름)을 넣지 않는다(판 4 Fable 설계 검토 2).
  if(moment==='request_received'){
    const number=/^P-\d{4}-[0-9A-F]{4}$/.test(request.number||'')?request.number:'';
    return {subject:number?tx('〔SYNK PULSE〕 의뢰를 받았어요 · {number}',{number}):tx('〔SYNK PULSE〕 의뢰를 받았어요'),body:[tx('안녕하세요, SYNK PULSE입니다.'),'',number?tx('보내 주신 광고 의뢰를 받았어요. 접수 번호는 {number}예요.',{number}):tx('보내 주신 광고 의뢰를 받았어요.'),tx('평일 10~19시에 의뢰서를 확인하고, 빠진 게 있으면 그 칸만 다시 여쭤요. 결제는 글 콘티를 보신 뒤에 크몽에서 해요.'),'',...links,'',tx('의뢰하신 적이 없으면 이 메일은 지우셔도 돼요. 궁금한 점은 이 메일에 답장해 주세요.')].join('\n')};
  }
  const title=product?tx('{product} 광고',{product}):tx('요청하신 광고');
  const entry=moment==='draft_ready'||moment==='images_ready'?roundOf(row,latest):null,revised=revisedRound(row,entry);
  const amount=Number.isSafeInteger(request.payment?.amount)?request.payment.amount:null;
  const copy={
    request_asked:[tx('{title}, 몇 가지만 더 여쭐게요',{title}),tx('의뢰서를 확인했어요. 빠진 몇 칸만 알려 주시면 바로 다음 단계로 넘어가요.'),tx('다음 할 일: 앱의 「이것만 더 알려 주세요」 칸에 글이나 파일로 답해 주세요.')],
    direction_proposed:[tx('{title}, 방향을 골라 주세요',{title}),tx('요청하신 내용은 그대로 두고, 무엇으로 기억에 남길지만 방향을 나눠 보내 드렸어요. 하나를 고르시면 글 콘티를 만들어 드려요.'),tx('다음 할 일: 마음에 드는 방향 하나를 골라 주세요. 둘 다 아니면 「둘 다 아니에요」에 한 줄 남겨 주세요.')],
    draft_ready:[tx(revised?'{title} 고친 글 콘티가 왔어요':'{title} 글 콘티가 왔어요',{title}),tx(revised?'보내 주신 의견을 반영해 글 콘티를 고쳤어요. 컷마다 다시 보시고 의견을 남기시거나, 괜찮으면 다음 단계로 넘겨 주세요.':'장면마다 무엇을 보여 주고 어떤 말을 할지 글로 먼저 정리했어요. 컷마다 의견을 남기시거나, 괜찮으면 다음 단계로 넘겨 주세요.'),tx('다음 할 일: 컷마다 좋아요 · 고칠 곳을 남기고 「의견 보내기」나 「이대로 장면 이미지 만들기」를 눌러 주세요.')],
    payment_requested:[tx('{title}, 크몽에서 결제해 주세요',{title}),amount?tx('크몽 메시지로 결제 요청({amount})을 보내 드렸어요. 결제가 확인되면 다음 단계를 만들기 시작해요.',{amount:won(amount,loc)}):tx('크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 다음 단계를 만들기 시작해요.'),tx('다음 할 일: 크몽 메시지의 결제 요청에서 결제해 주세요. 크몽 결제 때 크몽 구매 수수료가 더해져요.')],
    images_ready:photo?[tx(revised?'{title} 고친 첫 장이 왔어요':'{title} 첫 장이 왔어요',{title}),tx(revised?'보내 주신 의견을 반영해 첫 장을 고쳤어요. 이 결이 맞는지 봐 주세요.':'나머지 장을 같은 결로 만들기 전에 첫 장을 먼저 보내 드렸어요.'),tx('다음 할 일: 첫 장을 보시고 괜찮으면 승인을, 고칠 곳이 있으면 의견을 보내 주세요.')]:[tx(revised?'{title} 고친 장면 이미지가 왔어요':'{title} 장면 이미지가 왔어요',{title}),tx(revised?'보내 주신 의견을 반영해 장면 이미지를 고쳤어요. 컷마다 다시 봐 주세요.':'영상에 들어갈 컷마다 첫 화면을 완성 화질로 보내 드렸어요. 확인하신 컷으로만 영상을 만들어요.'),tx('다음 할 일: 컷마다 보시고 「이대로 제작 시작」이나 「의견 보내기」를 눌러 주세요.')],
    preview_ready:[tx(photo?'{title} 사진을 확인해 주세요':'{title} 영상을 확인해 주세요',{title}),tx(photo?'사진을 보시고, 바꾸고 싶은 곳에 의견을 남기시거나 승인해 주세요.':'영상을 재생해 보시고, 바꾸고 싶은 장면에 의견을 남기시거나 승인해 주세요.'),tx(photo?'다음 할 일: 사진을 보시고 「이 시안 최종 승인」을 누르시거나 바꿀 곳에 의견을 남겨 주세요.':'다음 할 일: 영상을 보시고 「이 시안 최종 승인」을 누르시거나 바꿀 장면에 의견을 남겨 주세요.')],
    final_ready:[tx('{title} 최종 파일이 준비됐어요',{title}),tx('최종 파일을 받아 보시고 사용 안내를 확인한 뒤 수령 확인을 남겨 주세요.'),tx('다음 할 일: 파일을 받아 보시고 「수령 확인 남기기」를 눌러 주세요.')],
  }[moment];
  if(!copy)throw fail('메일 순간을 확인해 주세요.',500);
  const due=WAITING.has(moment)?dueOf(request):'';
  return {subject:tx('〔SYNK PULSE〕 {subject}',{subject:copy[0]}),body:[who?tx('{who}님, SYNK PULSE입니다.',{who}):tx('안녕하세요, SYNK PULSE입니다.'),'',copy[1],copy[2],...(due?[tx('받으실 날({date})은 확인을 기다리는 날만큼 늦어져요.',{date:dayText(due,loc)})]:[]),'',...links,'',tx('이 메일은 보내 주신 의뢰의 진행 알림이에요. 궁금한 점은 이 메일에 답장해 주세요.')].join('\n')};
}

export function createPulseMailService({store,notificationsFor,clock=()=>new Date().toISOString(),fetchImpl=globalThis.fetch,emergencyStop=()=>process.env.SYNK_PULSE_MAIL_STOP==='1',log=()=>{},localeOf=()=>'ko'}={}){
  if(!store||typeof notificationsFor!=='function')throw new TypeError('메일 알림 설정이 이상해요.');
  let running=null,stopped=false,checkSeq=0;
  const now=()=>{const at=clock(),ms=Date.parse(at);if(!Number.isFinite(ms))throw fail('서버 시계를 읽지 못했어요.',500);return {iso:iso(ms),ms};};
  const config=()=>({enabled:false,enabledAt:null,relayUrl:'',connection:{state:'unknown',checkedAt:null,code:null,version:null},...(store.get(PULSE_MAIL_SETTINGS,'main')||{})});
  const saveConfig=(next,at)=>store.put(PULSE_MAIL_SETTINGS,'main',{...next,updatedAt:at});
  const active=c=>!stopped&&!emergencyStop()&&c.enabled===true&&!!c.enabledAt&&RELAY_URL.test(c.relayUrl||'')&&c.connection?.state==='ok';
  function keys(at){
    let value=store.secret(PULSE_MAIL_SECRET);
    if(!value?.privateKeyPem||!/^[0-9a-f]{512}$/.test(value.n||'')){
      const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
      value={privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),n:Buffer.from(publicKey.export({format:'jwk'}).n,'base64url').toString('hex'),salt:randomBytes(32).toString('hex'),createdAt:at};
      store.setSecret(PULSE_MAIL_SECRET,value);
    }
    return value;
  }
  const recipientHash=(email,salt)=>createHmac('sha256',Buffer.from(salt,'hex')).update(email.toLowerCase()).digest('hex').slice(0,32);
  const signedRequest=(fields,key)=>({v:1,...fields,sig:sign('sha256',Buffer.from(pulseMailSignedMessage(fields),'utf8'),key.privateKeyPem).toString('base64')});
  const admin=user=>{const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(live.role!=='admin')throw fail('관리자만 메일 알림을 설정할 수 있어요.',403);return live;};

  // 302는 Apps Script의 답 주소(script.googleusercontent.com)로 가는 것만 따라간다.
  async function relayCall(url,payload){
    const signal=AbortSignal.timeout(TIMEOUT_MS);
    let response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),redirect:'manual',signal});
    if([301,302,303,307,308].includes(response.status)){
      let next;try{next=new URL(response.headers.get('location')||'',url);}catch{next=null;}
      await response.body?.cancel?.().catch(()=>{});
      if(!next||next.protocol!=='https:'||next.hostname!==ECHO_HOST)return {http:response.status,json:null,code:'redirect'};
      response=await fetchImpl(next,{method:'GET',redirect:'manual',signal});
    }
    const text=await response.text();
    if(Buffer.byteLength(text)>65536)return {http:response.status,json:null,code:'too_large'};
    let json=null;try{json=JSON.parse(text);}catch{}
    return {http:response.status,json:json&&typeof json==='object'&&!Array.isArray(json)?json:null};
  }
  // 중계 답을 함의 다음 상태로 옮긴다: sent · failed · unknown · retry(같은 열쇠로 다시) · broken(연결 문제 — 시도 안 태움).
  function judge(result){
    if(!result)return {kind:'retry',code:'network'};
    const {http,json}=result;
    if(json&&json.version!==undefined&&json.version!==PULSE_MAIL_RELAY_VERSION)return {kind:'broken',code:'version'};
    if(json&&typeof json.status==='string'){
      if(json.status==='sent'||json.status==='duplicate'||json.status==='ok')return {kind:'sent',code:json.status};
      if(json.status==='unknown')return {kind:'unknown',code:'relay_unknown'};
      if(json.status==='busy')return {kind:json.code==='cap'?'cap':'retry',code:json.code==='cap'?'cap':'busy'};
      if(json.status==='rejected')return CONFIG_CODES.has(json.code)?{kind:'broken',code:json.code}:{kind:'failed',code:String(json.code||'rejected').slice(0,40)};
      if(json.status==='failed')return {kind:'retry',code:'relay_failed'};
    }
    if(http===429||http>=500)return {kind:'retry',code:`http_${http}`};
    return {kind:'broken',code:result.code||(http===200?'not_json':`http_${http}`)};
  }
  function setConnection(state,code,at,version=null,gen=null){const c=config();if(gen!==null&&(c.relayGen||0)!==gen)return false;saveConfig({...c,connection:{state,checkedAt:at,code,version}},at);return true;}

  function fill(at){
    const c=config();if(!active(c))return 0;
    const outbox=store.all(PULSE_MAIL_OUTBOX),known=new Set(outbox.flatMap(item=>item.eventIds||[]));
    const open=new Map(outbox.filter(item=>item.state==='pending'&&!item.attempts&&item.lastEventAt>c.enabledAt).map(item=>[`${item.projectId}|${item.moment}`,item]));
    let added=0;
    for(const row of store.all('clientProjects')){
      if(pulseMailEligibility(row)||!pulseMailRecipient(row).email)continue;
      const items=notificationsFor(row).filter(item=>item.createdAt>c.enabledAt&&item.createdAt<=at&&!known.has(item.id)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
      for(const item of items){
        const moment=pulseMailMoment(row,item);if(!moment)continue;
        known.add(item.id);
        const slot=`${row.id}|${moment}`,eventAt=Date.parse(item.createdAt),held=open.get(slot),current=held&&eventAt<=Date.parse(held.firstEventAt)+MERGE_CAP_MS?held:null;
        if(current){
          const dueAt=iso(Math.min(eventAt+MERGE_MS,Date.parse(current.firstEventAt)+MERGE_CAP_MS));
          const next={...current,eventIds:[...current.eventIds,item.id],lastEventAt:item.createdAt,dueAt,nextAttemptAt:dueAt,updatedAt:at};
          store.put(PULSE_MAIL_OUTBOX,next.id,next);open.set(slot,next);
        }else{
          const dueAt=iso(eventAt+MERGE_MS),id=`${row.id}:${moment}:${createHash('sha256').update(item.id).digest('hex').slice(0,12)}`;
          const next={id,projectId:row.id,moment,eventIds:[item.id],firstEventAt:item.createdAt,lastEventAt:item.createdAt,dueAt,nextAttemptAt:dueAt,state:'pending',reason:null,attempts:0,sendingAt:null,sentAt:null,recipientHash:null,createdAt:at,updatedAt:at};
          store.put(PULSE_MAIL_OUTBOX,id,next);open.set(slot,next);added++;
        }
      }
    }
    return added;
  }

  async function deliver(item,c,key,at){
    const put=(patch,stamp=now().iso)=>{const next={...item,...patch,updatedAt:stamp};store.put(PULSE_MAIL_OUTBOX,item.id,next);log({projectId:item.projectId,moment:item.moment,state:next.state,reason:next.reason||null});return next;};
    const row=store.get('clientProjects',item.projectId),why=pulseMailEligibility(row);
    if(why)return put({state:'skipped',reason:why});
    const {email,reason}=pulseMailRecipient(row);if(!email)return put({state:'skipped',reason});
    if(item.lastEventAt<=c.enabledAt)return put({state:'skipped',reason:'before_on'});
    if(Date.parse(at)-Date.parse(item.lastEventAt)>EXPIRE_MS)return put({state:'skipped',reason:'expired'});
    let latest=null;
    if(!DIRECT_MOMENTS.has(item.moment)){
      latest=notificationsFor(row).find(entry=>entry.id===item.eventIds.at(-1));
      if(!latest)return put({state:'skipped',reason:'stale'});
      if(latest.readAt)return put({state:'skipped',reason:'read'});
      if(pulseMailActed(row,item.moment,latest))return put({state:'skipped',reason:'acted'});
    }
    const {subject,body}=pulseMailCompose(row,item.moment,localeOf(row),latest),ts=now().ms;
    item=put({state:'sending',sendingAt:at,attempts:item.attempts+1,recipientHash:recipientHash(email,key.salt),reason:null});
    let result=null;
    try{result=await relayCall(c.relayUrl,signedRequest({op:'send',key:pulseMailRelayKey(item.id),ts,to:email,subject,body},key));}catch{result=null;}
    const verdict=judge(result),done=now();
    if(verdict.kind==='sent')return put({state:'sent',sentAt:done.iso,sendingAt:null,reason:null},done.iso);
    if(verdict.kind==='unknown')return put({state:'unknown',reason:verdict.code,sendingAt:null},done.iso);
    if(verdict.kind==='failed')return put({state:'failed',reason:verdict.code,sendingAt:null},done.iso);
    if(verdict.kind==='broken'){setConnection('broken',verdict.code,done.iso,null,c.relayGen||0);return put({state:'pending',reason:verdict.code,sendingAt:null,attempts:item.attempts-1,nextAttemptAt:done.iso},done.iso);}
    if(verdict.kind==='cap')return put({state:'pending',reason:'cap',sendingAt:null,attempts:item.attempts-1,nextAttemptAt:iso(done.ms+CAP_RETRY_MS)},done.iso);
    if(item.attempts>=MAX_ATTEMPTS)return put({state:'failed',reason:verdict.code,sendingAt:null},done.iso);
    return put({state:'pending',reason:verdict.code,sendingAt:null,nextAttemptAt:iso(done.ms+RETRY_MS[Math.min(item.attempts-1,RETRY_MS.length-1)])},done.iso);
  }

  async function send(at){
    let c=config();if(!active(c))return 0;
    const key=keys(at.iso);
    for(const item of store.all(PULSE_MAIL_OUTBOX))if(item.state==='sending'&&Date.parse(item.sendingAt)+LEASE_MS<=at.ms)store.put(PULSE_MAIL_OUTBOX,item.id,{...item,state:'pending',sendingAt:null,updatedAt:at.iso});
    for(const item of store.all(PULSE_MAIL_OUTBOX).filter(entry=>entry.state==='unknown'&&!entry.statusCheckedAt&&Date.parse(entry.updatedAt)+UNKNOWN_CHECK_MS<=at.ms).slice(0,BATCH)){
      let result=null;try{result=await relayCall(c.relayUrl,signedRequest({op:'status',key:pulseMailRelayKey(item.id),ts:now().ms},key));}catch{result=null;}
      const done=now().iso,sent=result?.json?.status==='checked'&&result.json.state==='sent';
      store.put(PULSE_MAIL_OUTBOX,item.id,{...item,...(sent?{state:'sent',sentAt:done,reason:'confirmed_later'}:{}),statusCheckedAt:done,updatedAt:done});
    }
    const due=store.all(PULSE_MAIL_OUTBOX).filter(item=>item.state==='pending'&&item.dueAt<=at.iso&&item.nextAttemptAt<=at.iso).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id)).slice(0,BATCH);
    let count=0;
    for(const item of due){
      c=config();if(!active(c))break;
      const fresh=store.get(PULSE_MAIL_OUTBOX,item.id);if(fresh?.state!=='pending')continue;
      await deliver(fresh,c,key,now().iso);count++;
    }
    return count;
  }
  function prune(at){
    const cutoff=iso(at.ms-KEEP_MS);let removed=0;
    for(const item of store.all(PULSE_MAIL_OUTBOX))if(FINAL.has(item.state)&&item.updatedAt<cutoff){store.remove(PULSE_MAIL_OUTBOX,item.id);removed++;}
    return removed;
  }
  function tick(){
    if(stopped)return Promise.resolve({skipped:'stopped'});
    if(running)return running.then(()=>({skipped:'running'}));
    running=(async()=>{try{
      const c=config(),checked=Date.parse(c.connection?.checkedAt||'');
      if(!emergencyStop()&&c.enabled===true&&c.connection?.state==='broken'&&RELAY_URL.test(c.relayUrl||'')&&(!Number.isFinite(checked)||checked+REPING_MS<=now().ms))await checkConnection();
      const at=now(),added=fill(at.iso),sent=await send(at);return {added,sent,removed:prune(at)};
    }finally{running=null;}})();
    return running;
  }

  function settings(user){
    admin(user);const at=now().iso,c=config(),key=keys(at),rows=store.all(PULSE_MAIL_OUTBOX);
    const candidates=store.all('clientProjects').filter(row=>!pulseMailEligibility(row)).map(row=>pulseMailRecipient(row).email).filter(Boolean);
    const domains=Object.entries(candidates.reduce((map,email)=>{const domain=email.split('@').pop().toLowerCase();map[domain]=(map[domain]||0)+1;return map;},{})).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([domain,count])=>({domain,count}));
    const counts=Object.fromEntries(['pending','sending','sent','skipped','failed','unknown'].map(state=>[state,rows.filter(row=>row.state===state).length]));
    return {enabled:active(c),requested:c.enabled===true,enabledAt:c.enabledAt||null,relayUrl:c.relayUrl||'',connection:c.connection,emergencyStop:emergencyStop(),relayVersion:PULSE_MAIL_RELAY_VERSION,publicKeyN:key.n,publicKeyFingerprint:createHash('sha256').update(key.n).digest('hex').slice(0,16),candidates:{projects:candidates.length,domains},outbox:counts};
  }
  async function checkConnection(){
    const at=now(),c=config(),url=c.relayUrl,gen=c.relayGen||0,seq=++checkSeq;
    let result=null;try{result=await relayCall(url,signedRequest({op:'ping',ts:at.ms},keys(at.iso)));}catch{result=null;}
    const verdict=judge(result),done=now().iso;
    // 그사이 다른 확인이 시작됐으면(같은 세대라도) 마지막으로 시작한 확인만 적는다.
    if(seq===checkSeq)setConnection(verdict.kind==='sent'?'ok':'broken',verdict.kind==='sent'?null:verdict.code,done,result?.json?.version??null,gen);
    return result;
  }
  async function ping(user){
    admin(user);if(!RELAY_URL.test(config().relayUrl||''))throw fail('중계 주소를 먼저 넣어 주세요.',409);
    const result=await checkConnection();
    return {...settings(user),remaining:Number.isFinite(result?.json?.remaining)?result.json.remaining:null};
  }
  function configure(user,input={}){
    const live=admin(user);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(name=>!['enabled','relayUrl'].includes(name)))throw fail('입력 내용을 다시 봐 주세요.');
    const at=now().iso,current=config(),next={...current,updatedBy:live.id};
    if(input.relayUrl!==undefined){
      const url=typeof input.relayUrl==='string'?input.relayUrl.trim():'';
      if(url&&!RELAY_URL.test(url))throw fail('Apps Script 웹 앱 주소(https://script.google.com/…/exec)를 그대로 붙여 넣어 주세요.');
      if(url!==current.relayUrl){next.relayUrl=url;next.relayGen=(current.relayGen||0)+1;next.connection={state:'unknown',checkedAt:null,code:null,version:null};next.enabled=false;}
    }
    if(input.enabled!==undefined){
      if(typeof input.enabled!=='boolean')throw fail('켜기 · 끄기를 다시 골라 주세요.');
      if(input.enabled&&next.connection?.state!=='ok')throw fail('먼저 연결 확인을 통과시켜 주세요.',409);
      // 켜는 순간 뒤의 알림만 보낸다(그 전에 쌓인 알림을 한꺼번에 보내지 않음).
      if(input.enabled&&!current.enabled)next.enabledAt=at;next.enabled=input.enabled;
    }
    saveConfig(next,at);
    return settings(user);
  }
  // 손님 보기: 메일이 실제로 나갈 상태일 때만 mailOn · 그 주소.
  function customerState(row){
    const c=config(),{email}=pulseMailRecipient(row);
    // moments: 메일이 나가는 순간(화면이 「…오면 메일로도 알려 드려요」를 이 목록에 있는 순간에만 쓴다).
    return active(c)&&!pulseMailEligibility(row)&&email?{mailOn:true,mailTo:mask(email),moments:[...PULSE_MAIL_MOMENTS]}:{mailOn:false,mailTo:null};
  }
  // 직원 화면: 연결 상태와 순간마다 마지막 줄.
  function staffState(row){
    const c=config(),connection=emergencyStop()?'stopped':!c.relayUrl||c.connection?.state==='unknown'?'not_connected':c.connection?.state==='broken'?'broken':c.enabled?'on':'off';
    const latest={};
    for(const item of store.all(PULSE_MAIL_OUTBOX).filter(item=>item.projectId===row?.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)))latest[item.moment]={state:item.state,reason:item.reason||null,at:item.sentAt||item.updatedAt};
    const {email,reason}=pulseMailRecipient(row||{}),request=row?.studio?.request||{},contact=request.contact||{};
    const customerChanged=!!contact.email&&contact.basedOn!==undefined&&contact.basedOn!==String(request.answers?.email||'').trim();
    return {connection,recipient:email?'set':reason,email:email||null,override:!!contact.email&&!customerChanged,mailOff:contact.mailOff===true,customerChanged,moments:latest};
  }
  // 접수 확인(판 4): 접수 뒤 30초에 한 통. 사람 손 없이 손님이 적은 주소로 나가므로 주소마다 하루 한 통 · 전체 하루 스무 통까지만 넣는다(넘으면 접수증이 같은 안내를 한다).
  function receipt(projectId){
    const c=config();if(!active(c))return null;
    const row=store.get('clientProjects',projectId);if(!row||pulseMailEligibility(row))return null;
    const {email}=pulseMailRecipient(row);if(!email)return null;
    const at=now(),key=keys(at.iso),hash=recipientHash(email,key.salt),since=iso(at.ms-RECEIPT_PER_ADDRESS_MS);
    const recent=store.all(PULSE_MAIL_OUTBOX).filter(item=>item.moment==='request_received'&&item.createdAt>since);
    if(recent.length>=RECEIPT_DAILY||recent.some(item=>item.recipientHash===hash))return null;
    const eventId=`request:${row.id}`,id=`${row.id}:request_received:${createHash('sha256').update(eventId).digest('hex').slice(0,12)}`;
    if(store.get(PULSE_MAIL_OUTBOX,id))return null;
    const dueAt=iso(at.ms+RECEIPT_DELAY_MS),next={id,projectId:row.id,moment:'request_received',eventIds:[eventId],firstEventAt:at.iso,lastEventAt:at.iso,dueAt,nextAttemptAt:dueAt,state:'pending',reason:null,attempts:0,sendingAt:null,sentAt:null,recipientHash:hash,createdAt:at.iso,updatedAt:at.iso};
    store.put(PULSE_MAIL_OUTBOX,id,next);log({projectId:row.id,moment:'request_received',state:'pending',reason:null});return next;
  }
  // 함을 거치지 않는 한 통(다시 열기 코드 — pulse-mail-open.mjs). 코드 원문은 함 · 기록에 두지 않는다. 연결 문제면 순간 메일과 같은 끊김 복구 길을 탄다.
  async function sendDirect({key:id,to,subject,body}){
    const c=config();if(!active(c))return {kind:'off',code:'off'};
    if(!validPulseMailAddress(to))return {kind:'failed',code:'to'};
    const at=now(),secret=keys(at.iso);let result=null;
    try{result=await relayCall(c.relayUrl,signedRequest({op:'send',key:pulseMailRelayKey(id),ts:at.ms,to,subject,body},secret));}catch{result=null;}
    const verdict=judge(result);
    if(verdict.kind==='broken')setConnection('broken',verdict.code,now().iso,null,c.relayGen||0);
    return verdict;
  }
  // 소금 넣은 주소 해시(다시 열기 코드가 주소 원문 없이 같은 주소를 알아보게).
  function addressKey(email){const at=now();return recipientHash(String(email||''),keys(at.iso).salt);}
  // 비밀 소금 HMAC(다시 열기 코드 해시 — 코드 원문은 남기지 않는다).
  function secretHash(text){const at=now();return createHmac('sha256',Buffer.from(keys(at.iso).salt,'hex')).update(String(text)).digest('hex');}
  function stop(){stopped=true;return running||Promise.resolve();}
  return {tick,settings,configure,ping,customerState,staffState,stop,receipt,sendDirect,addressKey,secretHash,active:()=>active(config()),fill:at=>fill(at||now().iso)};
}
