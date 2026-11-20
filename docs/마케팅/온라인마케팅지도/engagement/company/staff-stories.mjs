// 내 글감 · 공개 글 · 직접 문의(2026-11-20, 계약 .tmp/employee-stories-contract.md · 설계 검토 B).
// 직원 본인만 보는 비공개 초안과, 공개한 판만 읽는 /story/<publicId> 화면의 문의 접수를 맡는다.
// SNS 채널 · 담당 권한 · 구글 문의 설정을 쓰지 않고 어떤 권한도 주지 않는다. 문의 연락처와 내용은
// store.setSecret에만 두고 90일 뒤 지운다(social-inquiries.mjs와 같은 접수 번호 · 접수증 · 삭제 규칙).
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

// closed: 지웠거나 보존 기간이 지난 문의의 접수 번호와 닫은 시각만. 연락처 · 이름 · 내용 · 글은 없다.
export const STAFF_STORY_KINDS=Object.freeze({story:'staffStories',link:'staffStoryLinks',count:'staffStoryCounts',inquiry:'staffStoryInquiries',closed:'staffStoryClosedInquiries'});
export const STAFF_STORY_LIMITS=Object.freeze({stories:200,title:120,body:4000,displayName:40,note:4000,url:2000,name:120,email:254,message:4000,inquiries:10000,retentionDays:90,requests:50});
const K=STAFF_STORY_KINDS,L=STAFF_STORY_LIMITS,DAY=86400000;
const WRITERS=['admin','manager','member'];
export const staffStoryError=(message,status,code,extra={})=>Object.assign(new Error(message),{status,code,...extra});
const invalid=(field,message='입력 내용을 다시 봐 주세요.')=>staffStoryError(message,400,'SYNK_STORY_INVALID',{field});
const notFound=()=>staffStoryError('그 글을 찾지 못했어요.',404,'SYNK_STORY_NOT_FOUND');
const hash=value=>createHash('sha256').update(value).digest('hex');
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PUBLIC_ID=/^[A-Za-z0-9_-]{22}$/;
const RECEIPT=/^story-[a-f0-9]{64}$/;
const secretId=id=>'staff-story-inquiry:'+id;
export const isStaffStoryPublicId=value=>typeof value==='string'&&PUBLIC_ID.test(value);
function keys(value,allowed,field='input'){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw invalid(field);}
function uuidFrom(seed){const h=hash(seed);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${(8+(parseInt(h[16],16)&3)).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;}
function line(value,max,field,{required=false,multiline=false}={}){
  if(value===undefined||value===null)value='';
  const bad=multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/;
  if(typeof value!=='string'||value.length>max||bad.test(value))throw invalid(field);
  const trimmed=multiline?value.replace(/\s+$/,''):value.trim();
  if(required&&!trimmed.trim())throw invalid(field);
  return trimmed;
}
function draftInput(value){
  keys(value,['title','body','displayName','note'],'draft');
  return {title:line(value.title,L.title,'title'),body:line(value.body,L.body,'body',{multiline:true}),displayName:line(value.displayName,L.displayName,'displayName'),note:line(value.note,L.note,'note',{multiline:true})};
}
function externalUrl(value){
  if(value==='')return '';
  if(typeof value!=='string'||value.length>L.url||/[\u0000- \u007f]/.test(value))throw invalid('externalUrl');
  let url;try{url=new URL(value);}catch{throw invalid('externalUrl');}
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname)throw invalid('externalUrl');
  return url.href;
}
const requestIdOf=(value,field='requestId')=>{if(typeof value!=='string'||!UUID.test(value))throw invalid(field);return value.toLowerCase();};

// pages: 방문자 화면 파일이 설치돼 있는가. 없으면 초안만 쓰고, 공개 · 공유 주소 · 방문자 접수는 닫는다(공개본은 지우지 않아 다시 설치하면 같은 주소로 열린다).
export function createStaffStories({store,origin,clock=()=>new Date().toISOString(),pages=true}){
  if(typeof origin!=='string'||!origin)throw new Error('staff stories need the registered origin');
  const limits=new Map();
  const now=()=>clock();
  const retention=()=>Date.parse(now())-L.retentionDays*DAY;
  function account(user,{write=false}={}){
    const live=typeof user?.id==='string'&&store.get('users',user.id);
    if(!live?.active||![...WRITERS,'viewer'].includes(live.role))throw staffStoryError('먼저 로그인해 주세요.',401,'SYNK_STORY_LOGIN');
    if(write&&live.role==='viewer')throw staffStoryError('읽기만 할 수 있는 계정이에요.',403,'SYNK_STORY_READONLY');
    return live;
  }
  // 공개 화면과 접수는 주인이 활성이고 쓸 수 있는 역할일 때만 열린다.
  const ownerOpen=ownerId=>{const owner=store.get('users',ownerId);return !!owner?.active&&WRITERS.includes(owner.role);};
  function decrypt(cipher,scope){
    try{const value=store.decrypt(cipher);if(value.storyId!==scope.id||value.ownerId!==scope.ownerId)throw new Error('scope');return value;}
    catch{throw staffStoryError('저장한 글감을 읽지 못했어요.',500,'SYNK_STORY_CORRUPT');}
  }
  function ownRow(user,id){
    if(typeof id!=='string'||!UUID.test(id))throw notFound();
    const row=store.get(K.story,id);
    if(!row||row.ownerId!==user.id||row.id!==id||row.status==='deleted')throw notFound();
    return row;
  }
  function retained(rows){
    const cutoff=retention();
    return rows.filter(row=>!row.deletedAt&&Date.parse(row.createdAt)>=cutoff);
  }
  function counts(row,open=retained(store.allWhere(K.inquiry,'storyId',row.id)).length){
    const counter=store.get(K.count,row.id);
    return {received:counter?.received||0,open,firstAt:counter?.firstAt||null,lastAt:counter?.lastAt||null};
  }
  function view(row,open,canReceive){
    const draft=decrypt(row.draftCipher,row),published=row.publicCipher?decrypt(row.publicCipher,row):null;
    return {id:row.id,revision:row.revision,status:row.status,
      draft:{title:draft.title,body:draft.body,displayName:draft.displayName,note:draft.note},
      public:published?{publicId:row.publicId,url:pages?origin+'/story/'+row.publicId:null,title:published.title,body:published.body,displayName:published.displayName,publishedAt:row.publishedAt,open:pages&&row.status==='live'&&(canReceive??ownerOpen(row.ownerId))}:null,
      changedSincePublish:!!published&&(published.title!==draft.title||published.body!==draft.body||published.displayName!==draft.displayName),
      external:row.external?{url:row.external.url,registeredAt:row.external.registeredAt,source:'self'}:null,
      inquiries:counts(row,open),createdAt:row.createdAt,updatedAt:row.updatedAt};
  }
  function inquirySummary(row){return {id:row.id,storyId:row.storyId,storyTitle:row.storyTitle,createdAt:row.createdAt,status:row.status};}
  const newestInquiry=(a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);
  const ownedStories=ownerId=>store.allWhere(K.story,'ownerId',ownerId).filter(row=>row.status!=='deleted');

  function workspace(user){
    user=account(user);
    const inquiries=retained(store.allWhere(K.inquiry,'ownerId',user.id)).sort(newestInquiry).map(inquirySummary);
    const open=new Map();
    for(const item of inquiries)open.set(item.storyId,(open.get(item.storyId)||0)+1);
    const stories=ownedStories(user.id).map(row=>view(row,open.get(row.id)||0,WRITERS.includes(user.role)))
      .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
    return {stories,inquiries,
      ...(user.role==='admin'?{heldInquiryCounts:heldInquiryCounts()}:{}),
      totals:{stories:stories.length,live:stories.filter(row=>row.status==='live').length,received:stories.reduce((sum,row)=>sum+row.inquiries.received,0),open:inquiries.length},
      limits:{stories:L.stories,title:L.title,body:L.body,displayName:L.displayName,note:L.note,url:L.url},retentionDays:L.retentionDays,canWrite:user.role!=='viewer',canPublish:pages&&user.role!=='viewer'};
  }
  const sealDraft=(row,draft)=>store.encrypt({storyId:row.id,ownerId:row.ownerId,...draft});
  function create(user,input){
    user=account(user,{write:true});
    keys(input,['action','requestId','draft']);if(input.action!=='create')throw invalid('action');
    const requestId=requestIdOf(input.requestId),draft=draftInput(input.draft),fingerprint=hash(JSON.stringify(draft));
    const id=uuidFrom('staff-story\0'+user.id+'\0'+requestId);
    return store.transaction(()=>{
      const live=account(user,{write:true}),existing=store.get(K.story,id);
      if(existing){
        if(existing.ownerId!==live.id||existing.createRequestId!==requestId||existing.createFingerprint!==fingerprint||existing.status==='deleted')throw staffStoryError('같은 요청 번호로 다른 글감이 이미 있어요. 새로 만들어 주세요.',409,'SYNK_STORY_REQUEST_CONFLICT');
        return {status:200,story:view(existing),duplicate:true};
      }
      if(ownedStories(live.id).length>=L.stories)throw staffStoryError(`글감은 ${L.stories}개까지 둘 수 있어요.`,409,'SYNK_STORY_LIMIT');
      const at=now(),row={schema:1,id,ownerId:live.id,revision:1,status:'draft',publicId:null,publicCipher:null,publishedAt:null,external:null,createRequestId:requestId,createFingerprint:fingerprint,mutations:[],createdAt:at,updatedAt:at};
      row.draftCipher=sealDraft(row,draft);
      store.put(K.story,id,row);
      return {status:201,story:view(row)};
    });
  }
  const ACTIONS={save:['draft'],publish:['confirmations'],unpublish:[],link:['externalUrl'],delete:[]};
  // 처리한 요청 번호는 마지막 변경과 따로 최근 L.requests개를 둔다. 뒤에 다른 탭이 바꿔도 앞 요청의 재전송을 알아본다.
  const history=row=>row?.mutations||(row?.lastMutation?[row.lastMutation]:[]);
  const handled=(row,requestId)=>history(row).find(item=>item.requestId===requestId);
  function mutate(user,id,input){
    user=account(user,{write:true});
    if(!object(input)||typeof input.action!=='string'||!Object.hasOwn(ACTIONS,input.action))throw invalid('action');
    keys(input,['action','requestId','expectedRevision',...ACTIONS[input.action]]);
    const requestId=requestIdOf(input.requestId);
    if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)throw invalid('expectedRevision');
    let draft=null,url=null;
    if(input.action==='save')draft=draftInput(input.draft);
    if(input.action==='publish'){keys(input.confirmations,['peopleConsent','noPromise'],'confirmations');for(const field of ['peopleConsent','noPromise'])if(input.confirmations[field]!==true)throw invalid(field,'공개 전 확인 두 가지를 체크해 주세요.');}
    if(input.action==='link')url=externalUrl(input.externalUrl);
    const fingerprint=hash(JSON.stringify([input.action,draft,url]));
    return store.transaction(()=>{
      const live=account(user,{write:true}),gone=UUID.test(id)&&store.get(K.story,id);
      // 지우기의 응답을 못 받고 같은 요청을 다시 보내면 지운 결과를 그대로 돌려준다.
      if(gone?.status==='deleted'&&gone.ownerId===live.id&&handled(gone,requestId)?.fingerprint===fingerprint)return {deleted:true,id,duplicate:true};
      const row=ownRow(live,id),seen=handled(row,requestId);
      if(seen){
        if(seen.fingerprint!==fingerprint)throw staffStoryError('같은 요청 번호로 다른 변경이 이미 들어왔어요. 새로 불러와 주세요.',409,'SYNK_STORY_REQUEST_CONFLICT');
        return {story:view(row),duplicate:true};
      }
      if(row.revision!==input.expectedRevision)throw staffStoryError('그사이 이 글감이 바뀌었어요. 쓰던 글은 그대로 두고 최신판을 확인해 주세요.',409,'SYNK_STORY_CONFLICT',{story:view(row)});
      const at=now(),mutation={requestId,fingerprint},next={...row,revision:row.revision+1,updatedAt:at,mutations:[...history(row),mutation].slice(-L.requests)};
      delete next.lastMutation;
      if(input.action==='save')next.draftCipher=sealDraft(row,draft);
      if(input.action==='publish'){
        if(!pages)throw staffStoryError('방문자 화면이 설치되지 않아 지금은 공개할 수 없어요. 초안은 저장할 수 있어요.',503,'SYNK_STORY_PAGES_OFF',{story:view(row)});
        const current=decrypt(row.draftCipher,row);
        if(!current.title)throw invalid('title','공개할 제목을 적어 주세요.');
        if(!current.displayName)throw invalid('displayName','공개할 이름을 적어 주세요.');
        let publicId=row.publicId;
        if(!publicId){do publicId=randomBytes(16).toString('base64url');while(store.get(K.link,publicId));store.put(K.link,publicId,{id:publicId,storyId:row.id,ownerId:row.ownerId,createdAt:at});}
        Object.assign(next,{status:'live',publicId,publishedAt:at,publicCipher:store.encrypt({storyId:row.id,ownerId:row.ownerId,title:current.title,body:current.body,displayName:current.displayName}),confirmations:{peopleConsent:true,noPromise:true,at}});
      }
      if(input.action==='unpublish'){if(row.status!=='live')throw staffStoryError('공개 중인 글만 내릴 수 있어요.',409,'SYNK_STORY_STATE',{story:view(row)});next.status='unpublished';}
      if(input.action==='link')next.external=url?{url,registeredAt:at}:null;
      if(input.action==='delete'){
        if(counts(row).open>0)throw staffStoryError('아직 볼 수 있는 문의가 있어 지울 수 없어요. 내리기만 할 수 있어요.',409,'SYNK_STORY_HAS_INQUIRIES',{story:view(row)});
        // 지운 글은 같은 요청 번호로 되살아나지 않게 꼬리표만 남긴다. 링크는 다시 열리지 않는다.
        store.put(K.story,id,{schema:1,id,ownerId:row.ownerId,status:'deleted',revision:next.revision,createRequestId:row.createRequestId,createFingerprint:row.createFingerprint,mutations:[mutation],createdAt:row.createdAt,updatedAt:at,deletedAt:at});
        if(row.publicId)store.put(K.link,row.publicId,{...store.get(K.link,row.publicId),deletedAt:at});
        store.remove(K.count,id);
        return {deleted:true,id};
      }
      store.put(K.story,id,next);
      return {story:view(next)};
    });
  }

  // ─ 공개 쪽 ─
  function openStory(publicId){
    if(!pages||!isStaffStoryPublicId(publicId))throw notFound();
    const link=store.get(K.link,publicId);if(!link||link.deletedAt)throw notFound();
    const row=store.get(K.story,link.storyId);
    if(!row||row.status!=='live'||row.publicId!==publicId||row.ownerId!==link.ownerId||!row.publicCipher||!ownerOpen(row.ownerId))throw notFound();
    return row;
  }
  function publicView(publicId){
    const row=openStory(publicId),value=decrypt(row.publicCipher,row);
    return {story:{publicId,title:value.title,body:value.body,displayName:value.displayName,publishedAt:row.publishedAt},inquiry:{open:true,retentionDays:L.retentionDays,maxMessage:L.message}};
  }
  const exists=publicId=>{try{openStory(publicId);return true;}catch(error){if(error.status===404)return false;throw error;}};
  function rate(client,scope=''){
    const at=Date.parse(now());
    for(const [key,value]of limits)if(value.until<=at)limits.delete(key);
    if(limits.size>5000)throw staffStoryError('문의가 몰렸어요. 잠시 뒤 다시 보내 주세요.',429,'SYNK_STORY_BUSY',{retryAfterSeconds:60});
    for(const [key,max]of [[hash(scope+'client:'+client),5],[scope+'all',200]]){
      const value=limits.get(key)||{until:at+60000,count:0};
      if(value.count>=max)throw staffStoryError('문의가 여러 번 들어왔어요. 잠시 뒤 다시 보내 주세요.',429,'SYNK_STORY_BUSY',{retryAfterSeconds:Math.max(1,Math.ceil((value.until-at)/1000))});
      value.count++;limits.set(key,value);
    }
  }
  const deletionToken=id=>createHmac('sha256',store.key).update('staff-story-inquiry-delete\0'+id).digest('hex');
  const receipt=row=>({ok:true,accepted:!row.deletedAt,deleted:!!row.deletedAt,receiptId:row.id,deleteToken:deletionToken(row.id),retentionDays:L.retentionDays});
  // 지우거나 기한이 지난 문의는 연락처 · 내용 · 글 연결을 버리고 접수 번호와 닫은 시각만 남긴다. 같은 요청이 다시 와도 되살아나지 않는다.
  const record=id=>store.get(K.inquiry,id)||store.get(K.closed,id);
  function erase(id,row=store.get(K.inquiry,id)){
    if(!row)return;
    store.deleteSecret(secretId(id));store.remove(K.inquiry,id);
    store.put(K.closed,id,{id,deletedAt:row.deletedAt||now()});
  }
  // 예전 꼴로 지운 기록(deletedAt만 붙은 문의 줄)도 여기서 같은 최소 기록으로 바꾼다.
  // 표준 UTC 시각은 문자열 순서대로 걸러진다. 예전 표기의 시각은 기존 Date.parse 기준으로 판정한다.
  const pruneCandidates=store.db.prepare(`
    SELECT id,createdAt,deletedAt FROM (
      SELECT id,json_extract(body,'$.createdAt') AS createdAt,json_extract(body,'$.deletedAt') AS deletedAt
      FROM documents WHERE kind='${K.inquiry}'
    ) WHERE deletedAt IS NOT NULL OR createdAt < ? OR createdAt NOT GLOB '????-??-??T??:??:??.???Z'`);
  function prune(){
    const cutoff=retention();
    const expired=row=>row.deletedAt||Date.parse(row.createdAt)<cutoff;
    for(const candidate of pruneCandidates.all(new Date(cutoff).toISOString())){
      if(!expired(candidate))continue;
      store.transaction(()=>{
        const current=store.get(K.inquiry,candidate.id);
        if(current&&expired(current))erase(candidate.id,current);
      });
    }
  }
  function inquiryValue(input){
    keys(input,['requestId','name','email','message','consent','website']);
    const requestId=requestIdOf(input.requestId);
    if(input.website!==undefined&&input.website!=='')throw invalid('website');
    const value={name:line(input.name,L.name,'name'),email:line(input.email,L.email,'email',{required:true}),message:line(input.message,L.message,'message',{required:true,multiline:true})};
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))throw invalid('email','답장 받을 이메일을 확인해 주세요.');
    if(input.consent!==true)throw invalid('consent','개인정보 수집에 동의해 주세요.');
    return {requestId,value};
  }
  function submit(publicId,input,context={}){
    // 고칠 수 있는 입력 실수(이메일 오타 등)는 문턱에 세지 않는다. 쓰기에 닿는 요청만 센다.
    const {requestId,value}=inquiryValue(input),id='story-'+hash('staff-story-inquiry\0'+requestId);
    rate(context.client||'');prune();
    return store.transaction(()=>{
      const existing=record(id);
      if(existing){
        if(!existing.deletedAt){
          const old=store.secret(secretId(id));
          if(existing.publicId!==publicId||!old||JSON.stringify(old)!==JSON.stringify(value))throw staffStoryError('같은 접수 번호로 다른 문의가 있어요. 새 문의로 보내 주세요.',409,'SYNK_STORY_INQUIRY_CONFLICT');
        }
        return {status:200,result:{...receipt(existing),duplicate:true}};
      }
      const row=openStory(publicId);
      if(store.count(K.inquiry)>=L.inquiries)throw staffStoryError('문의 접수 공간이 다 찼어요. 잠시 뒤 다시 보내 주세요.',503,'SYNK_STORY_FULL');
      const at=now(),title=decrypt(row.publicCipher,row).title,inquiry={id,storyId:row.id,ownerId:row.ownerId,publicId,storyTitle:title,createdAt:at,status:'new'};
      store.setSecret(secretId(id),value);
      store.put(K.inquiry,id,inquiry);
      // 건수는 글 문서와 따로 쌓는다. 접수가 글의 revision을 올리지 않아 편집 중인 저장이 409가 되지 않는다.
      const counter=store.get(K.count,row.id)||{id:row.id,ownerId:row.ownerId,received:0,firstAt:at};
      store.put(K.count,row.id,{...counter,received:counter.received+1,lastAt:at});
      return {status:201,result:receipt(inquiry)};
    });
  }
  function receiptIdOf(input){
    const id=input.receiptId,provided=input.deleteToken;
    if(typeof id!=='string'||!RECEIPT.test(id)||typeof provided!=='string'||!/^[a-f0-9]{64}$/.test(provided)||!timingSafeEqual(Buffer.from(provided,'hex'),Buffer.from(deletionToken(id),'hex')))throw staffStoryError('문의 접수증을 확인해 주세요.',403,'SYNK_STORY_RECEIPT');
    return id;
  }
  function lookup(input,context={}){
    rate(context.client||'','receipt:');prune();
    if(!object(input))throw invalid('input');
    const id=Object.hasOwn(input,'requestId')?(keys(input,['requestId']),'story-'+hash('staff-story-inquiry\0'+requestIdOf(input.requestId))):(keys(input,['receiptId','deleteToken']),receiptIdOf(input));
    const row=record(id);
    if(!row)return {ok:true,found:false,accepted:false,state:'unavailable'};
    return {...receipt(row),found:true,state:row.deletedAt?'deleted':'received'};
  }
  function removeByVisitor(input,context={}){
    rate(context.client||'','receipt:');keys(input,['receiptId','deleteToken']);
    const id=receiptIdOf(input);store.transaction(()=>erase(id));return {ok:true,deleted:true};
  }

  // ─ 직원이 받은 문의 ─
  function inquiryRow(id,allowed){
    if(typeof id!=='string'||!RECEIPT.test(id))throw notFound();
    const row=store.get(K.inquiry,id);
    if(!row||row.deletedAt||Date.parse(row.createdAt)<retention()||!allowed(row))throw notFound();
    return row;
  }
  function detail(row,extra={}){
    const value=store.secret(secretId(row.id));if(!value)throw notFound();
    return {inquiry:{...inquirySummary(row),...extra,name:value.name,email:value.email,message:value.message,expiresAt:new Date(Date.parse(row.createdAt)+L.retentionDays*DAY).toISOString()}};
  }
  const own=user=>row=>row.ownerId===user.id;
  function inquiry(user,id){user=account(user);return detail(inquiryRow(id,own(user)));}
  function inquiryAction(user,id,input){
    user=account(user,{write:true});keys(input,['action']);
    if(!['done','reopen','delete'].includes(input.action))throw invalid('action');
    return store.transaction(()=>{
      const live=account(user,{write:true}),row=inquiryRow(id,own(live));
      if(input.action==='delete'){erase(row.id);return {ok:true,deleted:true};}
      const next={...row,status:input.action==='done'?'done':'new'};store.put(K.inquiry,row.id,next);return {inquiry:inquirySummary(next)};
    });
  }
  // 주인 계정이 중지된 문의만 활성 관리자가 남은 보존 기간 동안 연다. 보기 전용 주인은 여기에 들지 않는다.
  function admin(user){const live=account(user);if(live.role!=='admin')throw staffStoryError('관리자만 볼 수 있어요.',403,'SYNK_STORY_ADMIN');return live;}
  const held=row=>{const owner=store.get('users',row.ownerId);return !owner?.active;};
  const ownerName=row=>store.get('users',row.ownerId)?.name||'';
  // 인계 대상은 조회할 때 현재 계정 상태로 정한다. 중지 후 복구된 직원의 문의도 즉시 본인에게 돌아간다.
  const inquiryOwners=store.db.prepare(`SELECT DISTINCT json_extract(body,'$.ownerId') AS id FROM documents WHERE kind='${K.inquiry}'`);
  function heldRows(){
    const names=new Map();
    for(const {id} of inquiryOwners.all()){
      const owner=store.get('users',id);
      if(!owner?.active)names.set(id,owner?.name||'');
    }
    return {names,rows:retained(store.allWhere(K.inquiry,'ownerId',[...names.keys()]))};
  }
  function heldInquiryCounts(){
    const {rows}=heldRows();
    return {total:rows.length,new:rows.reduce((sum,row)=>sum+Number(row.status==='new'),0)};
  }
  function heldInquiries(user){
    admin(user);
    const {rows,names}=heldRows();
    return {inquiries:rows.sort(newestInquiry).map(row=>({...inquirySummary(row),ownerName:names.get(row.ownerId)}))};
  }
  function heldInquiry(user,id){admin(user);const row=inquiryRow(id,held);return detail(row,{ownerName:ownerName(row)});}
  function heldAction(user,id,input){
    admin(user);keys(input,['action']);if(input.action!=='delete')throw invalid('action');
    return store.transaction(()=>{admin(user);erase(inquiryRow(id,held).id);return {ok:true,deleted:true};});
  }
  function maintain(){prune();}
  return Object.freeze({workspace,create,mutate,publicView,exists,submit,lookup,removeByVisitor,inquiry,inquiryAction,heldInquiries,heldInquiry,heldAction,maintain});
}
