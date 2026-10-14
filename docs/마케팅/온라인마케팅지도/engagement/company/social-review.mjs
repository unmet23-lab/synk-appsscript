import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';
import {createAttemptLimiter} from './request-security.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const copy=x=>JSON.parse(JSON.stringify(x));
const hash=x=>createHash('sha256').update(x).digest('hex');
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const clean=(v,n,label,required=false)=>{if(v==null&&!required)return '';if(typeof v!=='string'||v.length>n||required&&!v.trim())throw fail(label+'을 확인해 주세요.');return v.trim();};
const object=v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw fail('입력 형식을 확인해 주세요.');return v;};
const PRIVATE_FIELDS=new Set(['revision','approval','history','comments','status','createdAt','updatedAt']);
const allowedMime=new Set(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']);
const unavailable=()=>fail('검토 링크가 만료되었거나 현재 사용할 수 없습니다. 담당자에게 새 링크를 요청해 주세요.',410);

export function createSocialReview({store,publishing,resolveMedia,validateSource=()=>{},clock=()=>new Date().toISOString(),origin}={}){
  if(!store||!publishing||!origin)throw Error('Social review requires store, publishing and origin.');
  const site=new URL(origin);if(site.origin!==origin)throw Error('Social review origin must be exact.');
  const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now());
  const ipLimit=createAttemptLimiter({limit:120,windowMs:60000,maxEntries:4000,now:stamp}),tokenLimit=createAttemptLimiter({limit:90,windowMs:60000,maxEntries:2000,now:stamp}),writeLimit=createAttemptLimiter({limit:12,windowMs:60000,maxEntries:2000,now:stamp});
  const controllers=new Set(),pending=new Set();let stopped=false;
  function current(user,write=false){const id=typeof user==='string'?user:user?.id;const actor=typeof id==='string'?store.get('users',id):null;if(!actor?.active||!['admin','manager','member','viewer'].includes(actor.role))throw fail('로그인 상태를 확인해 주세요.',401);if(write&&actor.role==='viewer')throw fail('검토 링크를 관리할 권한이 없습니다.',403);return actor;}
  function postFor(user,id,write=false){user=current(user,write);const row=store.get('socialPosts',clean(id,100,'게시물 ID',true));if(!row||!Array.isArray(row.variants)||!row.variants.length||row.variants.some(v=>{const c=store.get('channels',v.channelId);return !c||c.active===false||c.hidden===true||!(write?canWriteChannel:canReadChannel)(user,c);}))throw fail('이 게시물을 검토할 권한이 없습니다.',404);return row;}
  function assertContext(user,context={}){if(stopped||context.signal?.aborted)throw fail('검토 요청이 중단됐습니다.',409);const live=current(context.authorize?context.authorize():user,true);if(live.id!==user.id)throw fail('로그인 상태가 변경됐습니다.',401);return live;}
  function capture(post){
    const content=Object.fromEntries(Object.entries(post).filter(([key])=>!PRIVATE_FIELDS.has(key)));
    const targets=post.variants.map(v=>{const c=store.get('channels',v.channelId),bridge=store.get('socialConnections',v.channelId);return {id:c?.id,platform:c?.platform,name:c?.displayName||c?.name||c?.handle||'',profile:c?.url||c?.handle||'',connectionVersion:c?.connectionVersion||0,externalId:c?.externalId||null,integrationId:bridge?.integrationId||null,integrationProfile:bridge?.profile||null,integrationStatus:bridge?.status||null};});
    const schedule=store.all('socialPublishJobs').filter(j=>j.postId===post.id&&j.contentVersion===post.contentVersion&&(!(post.recurrence&&j.occurrence>1&&(j.scheduleRevision||1)===1)||['cancelled','skipped','expired'].includes(j.status))).map(j=>({id:j.id,channelId:j.channelId,scheduledAt:j.scheduledAt,timezone:j.timezone,mode:j.mode,scheduleRevision:j.scheduleRevision||0,occurrence:j.occurrence||1,selectedCopyId:j.selectedCopyId||'base',cancelled:['cancelled','skipped','expired'].includes(j.status)})).sort((a,b)=>a.id.localeCompare(b.id));
    return copy({post:content,targets,schedule});
  }
  const fingerprint=snapshot=>hash(stable(snapshot));
  function bindingState(row){
    if(row.revokedAt)return 'revoked';if(row.invalidatedAt)return 'unavailable';
    try{const actor=current(row.createdBy,true),post=postFor(actor,row.postId,true);validateSource(actor,post);if(fingerprint(capture(post))!==row.fingerprint)return 'stale';}catch{return 'unavailable';}
    return 'current';
  }
  // Expiry ends bearer access, not an approval already recorded for this exact
  // content and plan. Current permissions, revocation and integrity still apply.
  function approvalValid(row){return row.decision==='approve'&&Number.isFinite(Date.parse(row.decisionAt))&&Date.parse(row.decisionAt)<Date.parse(row.expiresAt)&&bindingState(row)==='current';}
  function liveState(row){
    const binding=bindingState(row);if(binding!=='current')return binding;if(row.expiresAt<=now())return 'expired';
    return row.decision==='approve'?'approved':row.decision==='reject'?'rejected':'pending';
  }
  function linkView(row){return {id:row.id,revision:row.revision,label:row.label,required:row.required===true,contentVersion:row.contentVersion,status:liveState(row),approvalValid:approvalValid(row),accessExpired:row.expiresAt<=now(),expiresAt:row.expiresAt,createdAt:row.createdAt,revokedAt:row.revokedAt||null,decision:row.decision||null,decisionAt:row.decisionAt||null,feedbackCount:row.feedback.length,feedback:row.feedback.map(({requestId,...rest})=>rest)};}
  function requirement(post){const required=store.get('socialReviewRequirements',post.id);if(!required)return {required:false,ready:true,reason:null,linkIds:[]};const ready=required.contentVersion===post.contentVersion&&required.linkIds.length>0&&required.linkIds.every(id=>{const link=store.get('socialReviewLinks',id);return link&&approvalValid(link);});return {required:true,ready,reason:ready?null:'현재 원고·계정·파일·일정에 대한 필수 고객 검토 승인을 기다립니다.',linkIds:required.linkIds};}
  function validateReview({post}){if(!requirement(post).ready)throw Object.assign(fail('현재 원고·계정·파일·일정의 고객 검토를 승인받은 뒤 발행할 수 있습니다.',409),{code:'SOCIAL_REVIEW_REQUIRED'});}
  function internalSnapshot(snapshot){if(!snapshot)return null;return {title:snapshot.post.title,body:snapshot.post.body,contentVersion:snapshot.post.contentVersion,accounts:snapshot.targets,variants:snapshot.post.variants,media:snapshot.post.media||[],schedule:snapshot.schedule,recurrence:snapshot.post.recurrence||null,expiresAt:snapshot.post.expiresAt||null};}
  function comparison(post,user){
    const saved=store.all('socialReviewApprovals').filter(r=>r.postId===post.id).reverse().sort((a,b)=>b.approvedAt.localeCompare(a.approvedAt)||b.contentVersion-a.contentVersion)[0];
    let before=saved?.snapshot||null,baselineSource=saved?'recorded-internal-approval':null;
    if(!before&&post.approval)baselineSource='unavailable-before-tracking';
    if(before?.targets.some(c=>!canReadChannel(user,store.get('channels',c.id)))){before=null;baselineSource=null;}
    const after=capture(post),changes=[];const add=(field,label,a,b)=>{if(stable(a)!==stable(b))changes.push({field,label,before:a??null,after:b??null});};
    if(before){
      add('title','제목',before.post.title,after.post.title);add('body','공통 문구',before.post.body,after.post.body);add('accounts','게시 계정',before.targets,after.targets);add('media','공통 파일',before.post.media||[],after.post.media||[]);
      const keys=new Set([...before.post.variants,...after.post.variants].map(v=>v.channelId));for(const key of keys){const a=before.post.variants.find(v=>v.channelId===key),b=after.post.variants.find(v=>v.channelId===key);for(const [field,label]of [['title','제목'],['text','문구'],['format','형식'],['publicationFormat','성과 형식'],['media','파일'],['options','옵션'],['copyVariants','반복 문구']])add('variants.'+key+'.'+field,(after.targets.find(c=>c.id===key)||before.targets.find(c=>c.id===key))?.name+' · '+label,a?.[field]??null,b?.[field]??null);}
      add('schedule','게시 일정',before.schedule,after.schedule);add('recurrence','반복 일정',before.post.recurrence??null,after.post.recurrence??null);add('expiresAt','콘텐츠 만료',before.post.expiresAt??null,after.post.expiresAt??null);
    }
    return {hasBaseline:!!before,baselineSource,approvedAt:saved?.approvedAt||post.approval?.at||null,baseline:internalSnapshot(before),current:internalSnapshot(after),changes};
  }
  function workspace(user,{postId}={}){user=current(user);const post=postFor(user,postId),canCreate=user.role!=='viewer'&&post.variants.every(v=>canWriteChannel(user,store.get('channels',v.channelId)));return {postId,comparison:comparison(post,user),links:store.all('socialReviewLinks').filter(r=>r.postId===postId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(linkView),requirement:requirement(post),canCreate};}
  function recordApproval({post,actor}){const live=postFor(current(actor),post.id);if(!post.approval||post.approval.hash!==live.approval?.hash)throw fail('승인 원본을 확인해 주세요.',409);const id=hash(stable([post.id,post.approval.hash,post.approval.at,post.approval.targets,post.approval.byId]));if(store.get('socialReviewApprovals',id))return;store.put('socialReviewApprovals',id,{id,postId:post.id,contentVersion:post.contentVersion,approvedAt:post.approval.at,approvedBy:actor.id,approvalHash:post.approval.hash,snapshot:capture(post)});}
  function mediaRefs(snapshot){return snapshot.post.variants.flatMap((v,vi)=>(v.media||[]).map((ref,mi)=>({key:`v${vi}m${mi}`,ref,channelId:v.channelId})));}
  async function inspectMedia(snapshot,{signal,check},onlyKey=null){const refs=mediaRefs(snapshot),seen=new Set();let selected;if(onlyKey&&!refs.some(r=>r.key===onlyKey))throw unavailable();for(const {key,ref,channelId}of refs){if(onlyKey&&key!==onlyKey)continue;check();if(!(ref.assetId||ref.id)||!/^[a-f0-9]{64}$/.test(ref.sha256||'')||!allowedMime.has(ref.mimeType))throw fail('외부 검토에는 해시가 확인된 워크스페이스 이미지·영상 파일을 사용해 주세요.',422);const unique=(ref.assetId||ref.id)+':'+ref.sha256;if(seen.has(unique)&&!onlyKey)continue;seen.add(unique);if(typeof resolveMedia!=='function')throw fail('검토 파일 제공 기능이 준비되지 않았습니다.',503);const result=await resolveMedia(ref,{post:snapshot.post,channel:store.get('channels',channelId),signal});check();if(!result?.bytes||hash(result.bytes)!==ref.sha256||result.mimeType!==ref.mimeType)throw fail('검토 파일이 원본과 달라졌습니다. 새 링크를 생성해 주세요.',409);if(onlyKey)selected={bytes:result.bytes,fileName:clean(result.fileName||'review-media',300,'파일 이름'),mimeType:result.mimeType};}return selected;}
  function track(fn,outerSignal){if(stopped)return Promise.reject(fail('검토 기능을 종료했습니다.',503));if(pending.size>=8)return Promise.reject(fail('검토 요청이 많습니다. 잠시 후 다시 시도해 주세요.',429));const controller=new AbortController();controllers.add(controller);const signal=outerSignal?AbortSignal.any([outerSignal,controller.signal]):controller.signal;const task=Promise.resolve().then(()=>fn(signal)).finally(()=>{controllers.delete(controller);pending.delete(task);});pending.add(task);return task;}
  function create(user,input={},context={}){return track(async signal=>{
    object(input);user=assertContext(current(user,true),{...context,signal});const post=postFor(user,input.postId,true);
    if(input.revision!==post.revision)throw fail('게시물을 새로 불러온 뒤 검토 링크를 만들어 주세요.',409);
    const hours=input.expiresInHours??72,required=input.required??true;
    if(typeof required!=='boolean')throw fail('필수 검토 여부를 확인해 주세요.');
    if(!Number.isInteger(hours)||hours<1||hours>168)throw fail('검토 기간은 1시간부터 168시간까지 정해 주세요.');
    if(store.all('socialReviewLinks').filter(r=>r.postId===post.id).length>=100)throw fail('이 게시물의 검토 링크 한도에 도달했습니다.',409);
    const assertNotSubmitted=()=>{if(required&&store.all('socialPublishJobs').some(j=>j.postId===post.id&&['publishing','accepted','processing','unknown'].includes(j.status)))throw fail('이미 접수되었거나 결과를 확인 중인 발행이 있습니다. 결과 확인 후 검토를 요청해 주세요.',409);};
    const label=clean(input.label,120,'검토 이름'),snapshot=capture(post),binding=fingerprint(snapshot);validateSource(user,post);
    const check=()=>{user=assertContext(user,{...context,signal});const live=postFor(user,post.id,true);validateSource(user,live);assertNotSubmitted();if(live.revision!==post.revision||fingerprint(capture(live))!==binding)throw fail('검토 준비 중 게시물·계정·일정이 변경됐습니다.',409);};
    check();await inspectMedia(snapshot,{signal,check});check();
    const raw=randomBytes(32).toString('base64url'),id=randomUUID(),at=now(),row={id,postId:post.id,revision:1,label,required,createdBy:user.id,createdAt:at,expiresAt:new Date(stamp()+hours*3600000).toISOString(),contentVersion:post.contentVersion,tokenHash:hash(raw),fingerprint:binding,snapshot,feedback:[],decision:null};
    store.transaction(()=>{check();store.put('socialReviewLinks',id,row);store.put('socialReviewTokens',row.tokenHash,{id:row.tokenHash,linkId:id});
      if(required){const old=store.get('socialReviewRequirements',post.id),active=old?.contentVersion===post.contentVersion?old.linkIds.filter(key=>{const r=store.get('socialReviewLinks',key);return r&&(approvalValid(r)||['pending','approved','rejected'].includes(liveState(r)));}):[];store.put('socialReviewRequirements',post.id,{id:post.id,contentVersion:post.contentVersion,linkIds:[...active,id],updatedAt:at});}
    });
    return {link:linkView(row),url:origin+'/social-review#token='+raw,requirement:requirement(post)};
  },context.signal);}
  function revoke(user,input={},context={}){object(input);user=assertContext(current(user,true),context);const row=store.get('socialReviewLinks',clean(input.id,100,'검토 ID',true));if(!row)throw fail('검토 링크를 찾을 수 없습니다.',404);postFor(user,row.postId,true);if(input.revision!==row.revision)throw fail('검토 상태가 변경됐습니다. 새로 불러와 주세요.',409);const next={...row,revision:row.revision+1,revokedAt:now(),revokedBy:user.id};store.transaction(()=>{store.put('socialReviewLinks',row.id,next);store.remove('socialReviewTokens',row.tokenHash);});return {link:linkView(next)};}
  function authenticate(raw,context={},write=false){if(stopped||context.signal?.aborted)throw unavailable();if(context.origin!==origin)throw fail('검토 화면에서 다시 요청해 주세요.',403);ipLimit.reserve(hash(String(context.clientKey||'unknown').slice(0,300)));if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))throw unavailable();const tokenHash=hash(raw);tokenLimit.reserve(tokenHash);if(write)writeLimit.reserve(tokenHash);const mapping=store.get('socialReviewTokens',tokenHash);const row=mapping?.linkId?store.get('socialReviewLinks',mapping.linkId):null;if(!row||row.tokenHash!==tokenHash||!['pending','approved','rejected'].includes(liveState(row)))throw unavailable();return row;}
  function checkLink(row,signal){if(stopped||signal?.aborted)throw unavailable();const live=store.get('socialReviewLinks',row.id);if(!live||live.tokenHash!==row.tokenHash||!['pending','approved','rejected'].includes(liveState(live)))throw unavailable();return live;}
  async function inspectLinkMedia(row,signal,key=null){
    try{return await inspectMedia(row.snapshot,{signal,check:()=>checkLink(row,signal)},key);}
    catch(error){
      if(!stopped&&!signal?.aborted){const live=store.get('socialReviewLinks',row.id);if(live&&!live.revokedAt&&!live.invalidatedAt&&['pending','approved','rejected'].includes(liveState(live)))store.put('socialReviewLinks',live.id,{...live,invalidatedAt:now(),revision:live.revision+1});}
      throw unavailable();
    }
  }
  function publicSnapshot(row){const s=row.snapshot;return {title:s.post.title,body:s.post.body,contentVersion:row.contentVersion,variants:s.post.variants.map((v,i)=>({key:'v'+i,account:Object.fromEntries(['name','platform','profile'].map(k=>[k,s.targets[i][k]||''])),title:v.title,text:v.text,format:v.format,options:copy(v.options||{}),copyVariants:(v.copyVariants||[]).map(c=>({title:c.title,text:c.text,hashtags:c.hashtags})),media:(v.media||[]).map((m,j)=>({key:`v${i}m${j}`,type:m.type,mimeType:m.mimeType,width:m.width||null,height:m.height||null,duration:m.duration||m.durationSeconds||null}))})),schedule:s.schedule.map(j=>({account:s.targets.find(t=>t.id===j.channelId)?.name||'',scheduledAt:j.scheduledAt,timezone:j.timezone,mode:j.mode,cancelled:j.cancelled})),recurrence:s.post.recurrence||null,expiresAt:s.post.expiresAt||null};}
  function publicView(row){return {review:{revision:row.revision,contentVersion:row.contentVersion,required:row.required===true,expiresAt:row.expiresAt,status:liveState(row),decision:row.decision,decisionAt:row.decisionAt||null,feedback:row.feedback.map(({id,name,comment,decision,createdAt})=>({id,name,comment,decision,createdAt})),snapshot:publicSnapshot(row)},notice:'이 링크를 가진 사람이 검토 의견을 남길 수 있습니다. 검토자 이름은 본인 확인을 거치지 않습니다. 고객 검토는 내부 발행 승인을 대신하지 않습니다.'};}
  function open(raw,context={}){return track(async signal=>{const row=authenticate(raw,{...context,signal});await inspectLinkMedia(row,signal);return publicView(checkLink(row,signal));},context.signal);}
  function respond(raw,input={},context={}){return track(async signal=>{object(input);const row=authenticate(raw,{...context,signal},true),requestId=clean(input.requestId,100,'요청 식별자',true);if(!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))throw fail('요청 식별자를 확인해 주세요.');const decision=input.decision;if(!['comment','approve','reject'].includes(decision))throw fail('검토 동작을 선택해 주세요.');const comment=clean(input.comment,3000,'검토 의견',decision!=='approve'),name=clean(input.name,80,'검토자 이름');const prior=row.feedback.find(x=>x.requestId===requestId);if(prior){if(prior.decision!==decision||prior.comment!==comment||prior.name!==name)throw fail('같은 요청 식별자의 내용이 변경됐습니다.',409);await inspectLinkMedia(row,signal);return publicView(checkLink(row,signal));}if(input.revision!==row.revision)throw fail('다른 검토 의견이 등록됐습니다. 화면을 새로 불러와 주세요.',409);if(row.feedback.length>=200)throw fail('이 링크의 검토 의견 한도에 도달했습니다.',409);await inspectLinkMedia(row,signal);const live=checkLink(row,signal);if(live.revision!==row.revision)throw fail('검토 상태가 변경됐습니다. 다시 불러와 주세요.',409);const at=now(),next={...live,revision:live.revision+1,feedback:[...live.feedback,{id:randomUUID(),requestId,name,comment,decision,createdAt:at}],...(decision==='comment'?{}:{decision,decisionAt:at})};store.put('socialReviewLinks',row.id,next);return publicView(next);},context.signal);}
  function media(raw,input={},context={}){return track(async signal=>{object(input);const row=authenticate(raw,{...context,signal}),key=clean(input.mediaKey,40,'검토 파일',true);if(!mediaRefs(row.snapshot).some(item=>item.key===key))throw unavailable();const result=await inspectLinkMedia(row,signal,key);checkLink(row,signal);return result;},context.signal);}
  const waitForIdle=async()=>{while(pending.size)await Promise.allSettled([...pending]);};const stop=async()=>{stopped=true;for(const controller of controllers)controller.abort();await waitForIdle();};
  return {workspace,recordApproval,validateReview,create,revoke,open,respond,media,waitForIdle,stop};
}
