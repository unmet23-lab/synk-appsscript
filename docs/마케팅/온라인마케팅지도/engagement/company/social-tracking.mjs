import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';

const K={settings:'socialTrackingSettings',links:'socialTrackingLinks',clicks:'socialTrackingClicks',events:'socialTrackingEvents',seen:'socialTrackingOutcomes'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(24).toString('base64url');
const kinds=['trial_start','signup','inquiry'];
const clean=(s,max=100)=>{if(typeof s!=='string'||!s.trim()||s.length>max||/[\u0000-\u001f]/.test(s))throw fail('추적 항목을 확인해 주세요.');return s.trim();};
const ident=s=>{if(typeof s!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(s))throw fail('추적 식별자를 확인해 주세요.');return s;};
export const socialTrackingSignaturePayload=(timestamp,input)=>[String(timestamp),input.clickId,input.eventId,input.event].join('\n');

/** First-party attribution only; no names, emails, IP addresses or user agents are persisted. */
export function createSocialTracking({store,publishing,clock=()=>new Date().toISOString(),origin,allowLocalOrigins=false}){
  const retentionDays=90,attributionDays=30,limits=new Map(),inquiryReceipt=Symbol('received-inquiry');let prunedAt=-Infinity;
  const now=()=>Date.parse(clock());
  function current(user,write=false){const row=store.get('users',user?.id);if(!row?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&!['admin','manager','member'].includes(row.role))throw fail('추적 링크를 관리할 권한이 없어요.',403);return row;}
  function admin(user){user=current(user,true);if(user.role!=='admin')throw fail('추적 연결은 관리자만 설정할 수 있어요.',403);return user;}
  function config(){return store.get(K.settings,'main')||{id:'main',revision:0,enabled:true,allowedOrigins:[]};}
  function site(value){let parsed;try{parsed=new URL(value);}catch{throw fail('정확한 사이트 HTTPS 주소를 입력해 주세요.');}if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||!(parsed.protocol==='https:'||((allowLocalOrigins||parsed.origin===origin)&&parsed.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))))throw fail('추적을 허용할 정확한 HTTPS 출처만 입력해 주세요.');return parsed.origin;}
  function target(value){let parsed;try{parsed=new URL(value);}catch{throw fail('이동할 사이트 주소를 확인해 주세요.');}if(parsed.username||parsed.password||!config().allowedOrigins.includes(parsed.origin)||!/^(https?:)$/.test(parsed.protocol))throw fail('관리자가 허용한 사이트의 주소를 입력해 주세요.');if(parsed.searchParams.has('synk_ref'))throw fail('이미 추적 식별자가 들어 있는 주소예요. 원래 주소를 넣어 주세요.');return parsed;}
  function channel(user,id,write=false){const c=store.get('channels',id);if(!c||c.active===false||c.hidden||!(write?canWriteChannel(user,c):canReadChannel(user,c)))throw fail('추적 계정의 현재 권한을 확인해 주세요.',403);return c;}
  function visible(user,row,write=false){try{channel(user,row.channelId,write);const p=publishing.get(user,row.postId).post;return !write||p.canEdit===true;}catch{return false;}}
  function liveLink(id){const row=store.get(K.links,id),c=config();if(!row||!row.active||!c.enabled||!c.allowedOrigins.includes(new URL(row.destination).origin))throw fail('사용할 수 없는 추적 링크예요.',404);const owner=store.get('users',row.ownerId);if(!owner?.active||!visible(owner,row,true))throw fail('사용할 수 없는 추적 링크예요.',404);return row;}
  function sweepLimits(){for(const [key,value]of limits)if(value.until<=now())limits.delete(key);}
  function prune(force=false){if(!force&&now()-prunedAt<3600000)return;prunedAt=now();const cutoff=now()-retentionDays*86400000,candidates=new Date(cutoff+86400000).toISOString();for(const kind of [K.clicks,K.events,K.seen])for(const row of store.createdBefore(kind,candidates))if(Date.parse(row.createdAt)<cutoff)store.remove(kind,row.id);sweepLimits();}
  function rate(bucket,limit=120){const key=hash(String(bucket)),value=limits.get(key);if(value&&value.until>now()){if(value.count>=limit)throw fail('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',429);value.count++;}else{if(limits.size>5000)sweepLimits();if(limits.size>10000)throw fail('추적 요청을 잠시 후 다시 시도해 주세요.',429);limits.set(key,{count:1,until:now()+60000});}}
  function settings(user){user=current(user);const c=config();return {enabled:c.enabled,allowedOrigins:c.allowedOrigins,revision:c.revision,canConfigure:user.role==='admin',keyConfigured:!!store.secret('social-tracking:verification'),retentionDays,attributionDays,sdkUrl:origin+'/social-tracking.js',verifiedEndpoint:origin+'/social-track/verified'};}
  function configure(user,input={}){admin(user);const old=config();if(input.revision!=null&&input.revision!==old.revision)throw fail('다른 창에서 추적 설정이 바뀌었어요. 새로고침해 주세요.',409);if(typeof input.enabled!=='boolean'||!Array.isArray(input.allowedOrigins)||input.allowedOrigins.length>20)throw fail('추적 사이트와 활성 상태를 확인해 주세요.');const row={id:'main',revision:old.revision+1,enabled:input.enabled,allowedOrigins:[...new Set(input.allowedOrigins.map(site))],updatedAt:clock()};store.put(K.settings,'main',row);return {settings:settings(user)};}
  function rotateKey(user,input={}){admin(user);if(input.rotate!==true)throw fail('서버 확인 키 교체를 명시적으로 선택해 주세요.');const key=token();store.setSecret('social-tracking:verification',{key,createdAt:clock()});return {key,endpoint:origin+'/social-track/verified',algorithm:'HMAC-SHA256',signedFields:['timestamp','clickId','eventId','event'],separator:'newline'};}
  function createLink(user,input={}){user=current(user,true);channel(user,input.channelId,true);const p=publishing.get(user,input.postId).post;if(!p.canEdit||!p.variants.some(v=>v.channelId===input.channelId))throw fail('게시물에 포함된 계정을 선택해 주세요.',403);const destination=target(clean(input.destination,2000)).href;const campaign=p.campaignId?store.get('socialCampaigns',p.campaignId):null;if(campaign&&!(campaign.channelIds||[]).includes(input.channelId))throw fail('캠페인에 포함된 계정을 선택해 주세요.');if(store.all(K.links).length>=10000)throw fail('추적 링크 보관 한도가 다 찼어요.',409);const row={id:token(),ownerId:user.id,postId:p.id,channelId:input.channelId,campaignId:p.campaignId||'',contentVersion:p.contentVersion,label:input.label?clean(input.label,120):p.title,destination,active:true,revision:1,createdAt:clock()};store.put(K.links,row.id,row);return {link:linkView(row,[],[])};}
  function updateLink(user,id,input={}){user=current(user,true);const row=store.get(K.links,id);if(!row||!visible(user,row,true))throw fail('추적 링크를 찾을 수 없어요.',404);if(row.revision!==input.revision)throw fail('그사이 추적 링크가 바뀌었어요. 새로고침해 주세요.',409);if(typeof input.active!=='boolean'||Object.keys(input).some(k=>!['revision','active'].includes(k)))throw fail('추적 링크는 사용 여부만 바꿀 수 있어요.');const updated={...row,active:input.active,revision:row.revision+1,updatedAt:clock()};store.put(K.links,id,updated);return {link:linkView(updated,store.all(K.clicks),store.all(K.events))};}
  function click(id,{client='',method='GET'}={}){prune();const row=liveLink(ident(id));if(method==='HEAD')return {location:row.destination};rate('click:'+client,90);if(store.count(K.clicks)>=100000)return {location:row.destination,clickId:null,recorded:false};const clickId=token(),record={id:clickId,linkId:row.id,createdAt:clock()};store.put(K.clicks,clickId,record);const url=new URL(row.destination);url.searchParams.set('synk_ref',clickId);return {location:url.href,clickId};}
  function event(input={},context={}){prune();if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['clickId','eventId','event'].includes(k)))throw fail('추적 사건에는 정해진 식별자와 종류만 보낼 수 있어요.');ident(input.clickId);ident(input.eventId);if(!['visit',...kinds].includes(input.event))throw fail('지원하는 전환 종류를 확인해 주세요.');const clickRow=store.get(K.clicks,input.clickId);if(!clickRow||now()-Date.parse(clickRow.createdAt)>attributionDays*86400000)throw fail('추적 기간이 지났거나 연결할 클릭이 없어요.',404);const link=liveLink(clickRow.linkId),expected=new URL(link.destination).origin;let source='browser';
    if(context.receipt===inquiryReceipt){source='verified';rate('verified',1000);}else if(context.verified){if(!kinds.includes(input.event))throw fail('서버 확인할 전환 종류를 확인해 주세요.');const secret=store.secret('social-tracking:verification'),timestamp=String(context.timestamp||''),signature=String(context.signature||'');if(!secret||!/^\d{10,13}$/.test(timestamp)||Math.abs(now()-(timestamp.length===10?Number(timestamp)*1000:Number(timestamp)))>300000||!/^\w{64}$/.test(signature))throw fail('서버 확인 서명을 확인해 주세요.',401);const expectedSignature=createHmac('sha256',secret.key).update(socialTrackingSignaturePayload(timestamp,input)).digest('hex');if(!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expectedSignature,'hex')))throw fail('서버 확인 서명이 맞지 않아요.',401);source='verified';rate('verified',1000);}else{if(context.origin!==expected||!config().allowedOrigins.includes(context.origin))throw fail('허용된 도착 사이트에서만 기록할 수 있어요.',403);rate('event:'+context.client,120);}
    const id=hash(source+'\0'+expected+'\0'+input.eventId),old=store.get(K.events,id);if(old){if(old.clickId!==input.clickId||old.event!==input.event)throw fail('이미 다른 사건에 쓴 식별자예요.',409);return {ok:true,duplicate:true,source};}const seenId=hash(source+'\0'+clickRow.id+'\0'+input.event);if(store.get(K.seen,seenId))return {ok:true,duplicate:true,source};if(source!=='verified'&&store.count(K.events)>=200000)throw fail('전환 기록 한도가 다 찼어요.',429);store.put(K.events,id,{id,eventId:input.eventId,clickId:clickRow.id,linkId:link.id,event:input.event,source,createdAt:clock()});store.put(K.seen,seenId,{id:seenId,createdAt:clock()});return {ok:true,source};
  }
  function inquiryAttribution(clickId,requestOrigin){
    ident(clickId);const click=store.get(K.clicks,clickId);
    if(!click||now()-Date.parse(click.createdAt)>attributionDays*86400000)throw fail('문의에 연결할 클릭이 없어요.',404);
    const link=liveLink(click.linkId);
    if(new URL(link.destination).origin!==requestOrigin||!allowOrigin(requestOrigin))throw fail('문의 출처를 확인해 주세요.',403);
    return {channelId:link.channelId,postId:link.postId,ownerId:link.ownerId};
  }
  // This method accepts only an inquiry already saved by this server. Its capability is
  // closure-local; the public event route never receives it from JSON or request headers.
  function confirmInquiry(id){
    const row=store.get('socialInbox',id);
    if(row?.source!=='website-inquiry'||!row.inquiryClickId||!store.secret('social-inquiry:'+id))throw fail('실제로 접수된 문의만 확인할 수 있어요.',409);
    inquiryAttribution(row.inquiryClickId,row.inquiryOrigin);
    return event({clickId:row.inquiryClickId,eventId:id,event:'inquiry'},{receipt:inquiryReceipt});
  }
  function stats(clicks,events){
    const siteEventsSeen=events.some(e=>e.source==='browser'),serverEventsSeen=events.some(e=>e.source==='verified');
    // Observing one action proves nothing about instrumentation for another action.
    const count=(source,kind)=>{const matches=events.filter(e=>e.source===source&&e.event===kind);return matches.length?new Set(matches.map(e=>e.clickId)).size:null;};
    const counts=source=>Object.fromEntries(kinds.map(kind=>[kind,count(source,kind)]));
    return {clicks:clicks.length,visits:count('browser','visit'),browserEvents:counts('browser'),verifiedEvents:counts('verified'),siteEventsSeen,serverEventsSeen,lastEventAt:events.map(e=>e.createdAt).sort().at(-1)||null};
  }
  function linkView(row,clicks,events){const {ownerId,...safe}=row;return {...safe,shortUrl:origin+'/s/'+row.id,stats:stats(clicks.filter(c=>c.linkId===row.id),events.filter(e=>e.linkId===row.id))};}
  function workspace(user){user=current(user);prune();const rows=store.all(K.links).filter(r=>visible(user,r)),ids=new Set(rows.map(r=>r.id)),clicks=store.all(K.clicks).filter(r=>ids.has(r.linkId)),events=store.all(K.events).filter(r=>ids.has(r.linkId));return {settings:settings(user),links:rows.map(r=>linkView(r,clicks,events)),totals:stats(clicks,events),basis:'최근 90일의 추적 링크 클릭과 사건 기록이에요. 전환은 클릭 뒤 30일 안의 것만 연결하고, 같은 클릭·종류는 한 번만 집계해요. 브라우저 보고와 서버 확인은 구분하고, 사람 수나 인과효과로 해석하지 않아요.'};}
  function allowOrigin(value){return config().enabled&&config().allowedOrigins.includes(value);}
  return {workspace,settings,configure,rotateKey,createLink,updateLink,click,event,allowOrigin,prune,inquiryAttribution,confirmInquiry};
}
