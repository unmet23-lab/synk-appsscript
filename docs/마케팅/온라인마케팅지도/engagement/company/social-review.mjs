import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';
import {createAttemptLimiter} from './request-security.mjs';
import {compareReviews} from './social-review-changes.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const josa=w=>{const s=String(w),c=s.charCodeAt(s.length-1);return c>=0xac00&&c<=0xd7a3?((c-0xac00)%28?'을':'를'):/id$/i.test(s)?'를':'을';};
const copy=x=>JSON.parse(JSON.stringify(x));
const hash=x=>createHash('sha256').update(x).digest('hex');
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const clean=(v,n,label,required=false)=>{if(v==null&&!required)return '';if(typeof v!=='string'||v.length>n||required&&!v.trim())throw fail(label+josa(label)+' 확인해 주세요.');return v.trim();};
const object=v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw fail('입력 형식을 확인해 주세요.');return v;};
const PRIVATE_FIELDS=new Set(['revision','approval','history','comments','status','createdAt','updatedAt']);
const allowedMime=new Set(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']);
const unavailable=()=>fail('검토 링크가 만료됐거나 지금은 사용할 수 없어요. 담당자에게 새 링크를 요청해 주세요.',410);

export function createSocialReview({store,publishing,resolveMedia,validateSource=()=>{},clock=()=>new Date().toISOString(),origin}={}){
  if(!store||!publishing||!origin)throw Error('Social review requires store, publishing and origin.');
  const site=new URL(origin);if(site.origin!==origin)throw Error('Social review origin must be exact.');
  const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now());
  const ipLimit=createAttemptLimiter({limit:120,windowMs:60000,maxEntries:4000,now:stamp}),tokenLimit=createAttemptLimiter({limit:90,windowMs:60000,maxEntries:2000,now:stamp}),writeLimit=createAttemptLimiter({limit:12,windowMs:60000,maxEntries:2000,now:stamp});
  const controllers=new Set(),pending=new Set();let stopped=false;
  const busy=(limiter,key)=>{try{limiter.reserve(key);}catch(error){if(error?.status===429)throw fail('검토 요청이 많아요. 잠시 후 다시 시도해 주세요.',429);throw error;}};
  function current(user,write=false){const id=typeof user==='string'?user:user?.id;const actor=typeof id==='string'?store.get('users',id):null;if(!actor?.active||!['admin','manager','member','viewer'].includes(actor.role))throw fail('로그인 상태를 확인해 주세요.',401);if(write&&actor.role==='viewer')throw fail('검토 링크를 관리할 권한이 없어요.',403);return actor;}
  function postFor(user,id,write=false){user=current(user,write);const row=store.get('socialPosts',clean(id,100,'게시물 ID',true));if(!row||!Array.isArray(row.variants)||!row.variants.length||row.variants.some(v=>{const c=store.get('channels',v.channelId);return !c||c.active===false||c.hidden===true||!(write?canWriteChannel:canReadChannel)(user,c);}))throw fail('이 게시물을 검토할 권한이 없어요.',404);return row;}
  function assertContext(user,context={}){if(stopped||context.signal?.aborted)throw fail('검토 요청이 중단됐어요.',409);const live=current(context.authorize?context.authorize():user,true);if(live.id!==user.id)throw fail('로그인 상태가 바뀌었어요.',401);return live;}
  function capture(post){
    const content=Object.fromEntries(Object.entries(post).filter(([key])=>!PRIVATE_FIELDS.has(key)));
    const targets=post.variants.map(v=>{const c=store.get('channels',v.channelId),bridge=store.get('socialConnections',v.channelId);return {id:c?.id,platform:c?.platform,name:c?.displayName||c?.name||c?.handle||'',profile:c?.url||c?.handle||'',connectionVersion:c?.connectionVersion||0,externalId:c?.externalId||null,integrationId:bridge?.integrationId||null,integrationProfile:bridge?.profile||null,integrationStatus:bridge?.status||null};});
    const schedule=(typeof store.allWhere==='function'?store.allWhere('socialPublishJobs','postId',post.id):store.all('socialPublishJobs')).filter(j=>j.postId===post.id&&j.contentVersion===post.contentVersion&&(!(post.recurrence&&j.occurrence>1&&(j.scheduleRevision||1)===1)||['cancelled','skipped','expired'].includes(j.status))).map(j=>({id:j.id,channelId:j.channelId,scheduledAt:j.scheduledAt,timezone:j.timezone,mode:j.mode,scheduleRevision:j.scheduleRevision||0,occurrence:j.occurrence||1,selectedCopyId:j.selectedCopyId||'base',cancelled:['cancelled','skipped','expired'].includes(j.status)})).sort((a,b)=>a.id.localeCompare(b.id));
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
  function linkView(row){return {id:row.id,revision:row.revision,label:row.label,required:row.required===true,contentVersion:row.contentVersion,status:liveState(row),approvalValid:approvalValid(row),accessExpired:row.expiresAt<=now(),expiresAt:row.expiresAt,createdAt:row.createdAt,revokedAt:row.revokedAt||null,decision:row.decision||null,decisionAt:row.decisionAt||null,feedbackCount:row.feedback.length,feedback:row.feedback.map(({requestId,...rest})=>rest),previousVersion:row.previous&&row.previous.state!=='unavailable'?row.previous.contentVersion:null};}
  function requirement(post){const required=store.get('socialReviewRequirements',post.id);if(!required)return {required:false,ready:true,reason:null,linkIds:[]};const ready=required.contentVersion===post.contentVersion&&required.linkIds.length>0&&required.linkIds.every(id=>{const link=store.get('socialReviewLinks',id);return link&&approvalValid(link);});return {required:true,ready,reason:ready?null:'지금 원고·계정·파일·일정에 대한 필수 고객 검토 승인을 기다리고 있어요.',linkIds:required.linkIds};}
  function validateReview({post}){if(!requirement(post).ready)throw Object.assign(fail('지금 원고·계정·파일·일정 그대로 고객 검토 승인을 받아야 발행할 수 있어요.',409),{code:'SOCIAL_REVIEW_REQUIRED'});}
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
  function workspace(user,{postId}={}){user=current(user);const post=postFor(user,postId),canCreate=user.role!=='viewer'&&post.variants.every(v=>canWriteChannel(user,store.get('channels',v.channelId)));return {postId,comparison:comparison(post,user),links:linksOf(post.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(linkView),requirement:requirement(post),previousPreview:previousPreview(post,user),canCreate};}
  function recordApproval({post,actor}){const live=postFor(current(actor),post.id);if(!post.approval||post.approval.hash!==live.approval?.hash)throw fail('승인 원본을 확인해 주세요.',409);const id=hash(stable([post.id,post.approval.hash,post.approval.at,post.approval.targets,post.approval.byId]));if(store.get('socialReviewApprovals',id))return;store.put('socialReviewApprovals',id,{id,postId:post.id,contentVersion:post.contentVersion,approvedAt:post.approval.at,approvedBy:actor.id,approvalHash:post.approval.hash,snapshot:capture(post)});}
  function mediaRefs(snapshot){return snapshot.post.variants.flatMap((v,vi)=>(v.media||[]).map((ref,mi)=>({key:`v${vi}m${mi}`,ref,channelId:v.channelId})));}
  async function inspectMedia(snapshot,{signal,check},onlyKey=null){const refs=mediaRefs(snapshot),seen=new Set();let selected;if(onlyKey&&!refs.some(r=>r.key===onlyKey))throw unavailable();for(const {key,ref,channelId}of refs){if(onlyKey&&key!==onlyKey)continue;check();if(!(ref.assetId||ref.id)||!/^[a-f0-9]{64}$/.test(ref.sha256||'')||!allowedMime.has(ref.mimeType))throw fail('외부 검토에는 해시가 확인된 워크스페이스 이미지·영상 파일을 사용해 주세요.',422);const unique=(ref.assetId||ref.id)+':'+ref.sha256;if(seen.has(unique)&&!onlyKey)continue;seen.add(unique);if(typeof resolveMedia!=='function')throw fail('검토 파일 제공 기능이 아직 준비되지 않았어요.',503);const full=!!onlyKey,result=await resolveMedia(ref,{post:snapshot.post,channel:store.get('channels',channelId),signal,read:full});check();const sum=result?.sha256??(result?.bytes?hash(result.bytes):null);if(!sum||sum!==ref.sha256||full&&!result.bytes||result.mimeType!==ref.mimeType)throw fail('검토 파일이 원본과 달라졌어요. 새 링크를 만들어 주세요.',409);if(onlyKey)selected={bytes:result.bytes,fileName:clean(result.fileName||'review-media',300,'파일 이름'),mimeType:result.mimeType};}return selected;}
  // 「지난 판」(10-24): 같은 게시물에서 판 열쇠(공개 스냅샷 해시 — contentVersion 포함)가 이번 판과 다르고 답(의견·승인·수정 요청)을
  // 받은 링크 중 가장 늦은 것이다. 보내기 전에 고친 중간 링크와 살아 있을 때 철회한(내용을 거둔) 링크는 쓰지 않는다. 판 열쇠가 같은
  // 링크는 같은 판을 여러 분에게 보낸 나란한 링크라 지난 판이 아니고, 지난 판의 의견을 모을 때 함께 센다.
  // 바뀐 곳과 그때 의견·결정은 링크를 만들 때 한 번 모아 socialReviewPrevious(ID = 링크 ID)에 얼린다 — 공개 열기·답하기는 그 문서 하나만 읽는다
  // (옛 링크 줄은 스냅샷이 통째로 들어 있어 열 때마다 읽으면 비싸다 — GPT 2차 GA1). 그 뒤 옛 링크를 철회하면 revoke()가 뒤 링크들의 문서에서 그 링크 의견을 걷어 낸다.
  const withdrawn=row=>!!row.revokedAt&&!['stale','unavailable','expired'].includes(row.revokedState);
  const usable=(user,id)=>{const c=typeof id==='string'?store.get('channels',id):null;return !!c&&c.active!==false&&c.hidden!==true&&canReadChannel(user,c);};
  // 색인은 더하지 않는다 — 회사 배포의 운영 사후 확인이 SQLite 스키마(색인 포함)가 시작 전과 같아야 통과한다(verify-runtime schemasUnchangedNow).
  // 그래서 지난 판 얼린 자료를 링크 줄 밖(socialReviewPrevious)에 두어 링크 줄이 커지지 않게만 했다.
  const linksOf=postId=>store.all('socialReviewLinks').filter(r=>r.postId===postId);
  // 판 열쇠는 새 링크 줄에 적어 둔다(만들 때 한 번) — 이 기능 전에 만든 링크만 열 때마다 셈한다.
  const versionKey=row=>typeof row.versionKey==='string'?row.versionKey:hash(stable(publicSnapshot(row)));
  const cut=(s,n)=>{const c=Array.from(s);return c.length>n?c.slice(0,n).join('')+'…':s;};
  function baselineFor(post,key){
    const links=linksOf(post.id).filter(r=>!withdrawn(r)),keys=new Map(links.map(r=>[r.id,versionKey(r)]));
    const base=links.filter(r=>r.feedback.length&&keys.get(r.id)!==key).reduce((best,r)=>!best||r.createdAt>=best.createdAt?r:best,null);
    return base&&{base,group:links.filter(r=>keys.get(r.id)===keys.get(base.id))};
  }
  function previousFor(user,post,snapshot,key){
    const next={snapshot,contentVersion:post.contentVersion},found=baselineFor(post,key);if(!found)return null;
    const {base,group}=found,previous={contentVersion:base.contentVersion,channelIds:base.snapshot.targets.map(t=>t.id),linkIds:group.map(r=>r.id)};
    try{
      if(!previous.channelIds.every(id=>usable(user,id)))return {previous:{...previous,state:'unavailable'}};
      const ids=s=>s.post.variants.map(v=>({channelId:v.channelId,media:(v.media||[]).map(m=>m.sha256||''),copies:(v.copyVariants||[]).map(c=>c.id||'')}));
      const frozen=compareReviews(publicSnapshot(base),publicSnapshot(next),{before:ids(base.snapshot),after:ids(snapshot)});
      return {previous:{...previous,state:frozen.changes.length||frozen.dropped?'compared':'same'},frozen:{...frozen,...answersFrom(group)}};
    }catch{return {previous:{...previous,state:'unavailable'}};}
  }
  // 그때 의견은 그 판의 링크 중 철회되지 않은 것에서만 모은다: 링크마다 글 있는 의견 수·마지막 결정·마지막 답한 때, 그리고 판 전체에서 글 있는 의견 마지막 10개(하나 1,000자).
  // 의견마다 어느 링크 것인지(linkId)를 비공개로 붙여 둔다 — 공개 응답에서는 뺀다.
  const said=row=>row.feedback.filter(f=>typeof f.comment==='string'&&f.comment.trim());
  function answersFrom(links){
    const live=links.filter(r=>!r.revokedAt);
    return {answers:live.filter(r=>r.feedback.length).map(r=>({linkId:r.id,said:said(r).length,decision:r.decision||null,decisionAt:r.decisionAt||null,lastAt:r.feedback.at(-1).createdAt})),
      requests:live.flatMap(r=>said(r).map(({name,comment,decision,createdAt})=>({linkId:r.id,name,comment:cut(comment,1000),decision,createdAt}))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-10)};
  }
  function publicPrevious(row){
    const p=row.previous;if(!p)return null;const head={state:p.state,contentVersion:p.contentVersion??null},frozen=p.state==='unavailable'?null:store.get('socialReviewPrevious',row.id);
    if(!frozen||!(p.channelIds||[]).every(id=>usable(store.get('users',row.createdBy),id)))return {...head,state:'unavailable'};
    const answers=Array.isArray(frozen.answers)?frozen.answers:[],decided=answers.filter(x=>x.decision&&x.decisionAt).reduce((last,x)=>!last||x.decisionAt>=last.decisionAt?x:last,null);
    return {...head,answeredAt:answers.reduce((last,x)=>x.lastAt>last?x.lastAt:last,'')||null,decision:decided?.decision||null,decidedAt:decided?.decisionAt||null,requestTotal:answers.reduce((n,x)=>n+x.said,0),
      requests:(frozen.requests||[]).map(({linkId,...rest})=>rest),changes:frozen.changes||[],truncated:frozen.truncated===true,dropped:Number.isInteger(frozen.dropped)?frozen.dropped:0};
  }
  // 작업실의 링크 만들기 양식이 「새 링크에 함께 보일 것」을 미리 보인다(담당자가 보낼 사람에 맞춰 끄고 켜게).
  // 지난 판 계정을 이 사용자가 지금 쓸 수 없으면 새 링크도 견주지 못하므로 아무것도 보이지 않는다(의견 수·이름도).
  function previousPreview(post,user){
    const found=baselineFor(post,versionKey({snapshot:capture(post),contentVersion:post.contentVersion}));if(!found||!found.base.snapshot.targets.every(t=>usable(user,t.id)))return null;
    const live=found.group.filter(r=>!r.revokedAt),notes=live.flatMap(said);
    return {contentVersion:found.base.contentVersion,requestCount:notes.length,names:[...new Set(notes.map(f=>f.name).filter(Boolean))].slice(0,3)};
  }
  function track(fn,outerSignal){if(stopped)return Promise.reject(fail('지금은 잠시 요청을 받을 수 없어요. 잠시 후 다시 시도해 주세요.',503));if(pending.size>=8)return Promise.reject(fail('지금 검토 요청이 많아요. 잠시 후 다시 시도해 주세요.',429));const controller=new AbortController();controllers.add(controller);const signal=outerSignal?AbortSignal.any([outerSignal,controller.signal]):controller.signal;const task=Promise.resolve().then(()=>fn(signal)).finally(()=>{controllers.delete(controller);pending.delete(task);});pending.add(task);return task;}
  function create(user,input={},context={}){return track(async signal=>{
    object(input);user=assertContext(current(user,true),{...context,signal});const post=postFor(user,input.postId,true);
    if(input.revision!==post.revision)throw fail('게시물을 새로 불러온 뒤 검토 링크를 만들어 주세요.',409);
    const hours=input.expiresInHours??72,required=input.required??true,compare=input.compare===undefined?true:input.compare;
    if(typeof required!=='boolean')throw fail('필수 검토 여부를 확인해 주세요.');
    if(typeof compare!=='boolean')throw fail('지난 판과 견주기 여부를 확인해 주세요.');
    if(!Number.isInteger(hours)||hours<1||hours>168)throw fail('검토 기간은 1시간부터 168시간까지 정해 주세요.');
    if(linksOf(post.id).length>=100)throw fail('이 게시물의 검토 링크 한도가 다 찼어요.',409);
    const assertNotSubmitted=()=>{if(required&&(typeof store.allWhere==='function'?store.allWhere('socialPublishJobs','postId',post.id):store.all('socialPublishJobs')).some(j=>j.postId===post.id&&['publishing','accepted','processing','unknown'].includes(j.status)))throw fail('이미 접수됐거나 결과를 확인하고 있는 발행이 있어요. 결과를 확인한 뒤 검토를 요청해 주세요.',409);};
    const label=clean(input.label,120,'검토 이름'),snapshot=capture(post),binding=fingerprint(snapshot);validateSource(user,post);
    const check=()=>{user=assertContext(user,{...context,signal});const live=postFor(user,post.id,true);validateSource(user,live);assertNotSubmitted();if(live.revision!==post.revision||fingerprint(capture(live))!==binding)throw fail('검토를 준비하는 동안 게시물·계정·일정이 바뀌었어요. 새로 불러온 뒤 링크를 다시 만들어 주세요.',409);};
    check();await inspectMedia(snapshot,{signal,check});check();
    const key=versionKey({snapshot,contentVersion:post.contentVersion}),found=compare?previousFor(user,post,snapshot,key):null;
    const raw=randomBytes(32).toString('base64url'),id=randomUUID(),at=now(),row={id,postId:post.id,revision:1,label,required,createdBy:user.id,createdAt:at,expiresAt:new Date(stamp()+hours*3600000).toISOString(),contentVersion:post.contentVersion,tokenHash:hash(raw),fingerprint:binding,versionKey:key,snapshot,previous:found?.previous||null,feedback:[],decision:null};
    store.transaction(()=>{check();store.put('socialReviewLinks',id,row);store.put('socialReviewTokens',row.tokenHash,{id:row.tokenHash,linkId:id});if(found?.frozen)store.put('socialReviewPrevious',id,{id,...found.frozen});
      if(required){const old=store.get('socialReviewRequirements',post.id),active=old?.contentVersion===post.contentVersion?old.linkIds.filter(key=>{const r=store.get('socialReviewLinks',key);return r&&(approvalValid(r)||['pending','approved','rejected'].includes(liveState(r)));}):[];store.put('socialReviewRequirements',post.id,{id:post.id,contentVersion:post.contentVersion,linkIds:[...active,id],updatedAt:at});}
    });
    return {link:linkView(row),url:origin+'/social-review#token='+raw,requirement:requirement(post)};
  },context.signal);}
  function revoke(user,input={},context={}){object(input);user=assertContext(current(user,true),context);const row=store.get('socialReviewLinks',clean(input.id,100,'검토 ID',true));if(!row)throw fail('검토 링크를 찾을 수 없어요.',404);postFor(user,row.postId,true);if(input.revision!==row.revision)throw fail('그사이 검토 상태가 바뀌었어요. 새로고침해 주세요.',409);const next={...row,revision:row.revision+1,revokedAt:now(),revokedBy:user.id,revokedState:row.revokedAt?row.revokedState??null:liveState(row)};store.transaction(()=>{store.put('socialReviewLinks',row.id,next);store.remove('socialReviewTokens',row.tokenHash);
    // 철회한 링크의 의견은 어디에도 남기지 않는다 — 이 링크를 지난 판으로 견준 뒤 링크들의 얼린 의견을 그 판의 남은 링크 줄에서 다시 모은다
    // (걷어 내기만 하면 마지막 10개가 모두 이 링크 것일 때 다른 링크의 의견이 비어 버린다 — GPT 3차 GA1). 철회는 드문 내부 동작이라 줄을 읽어도 된다.
    for(const later of linksOf(row.postId)){if(later.id===row.id||!later.previous?.linkIds?.includes(row.id))continue;const doc=store.get('socialReviewPrevious',later.id);if(!doc)continue;
      store.put('socialReviewPrevious',later.id,{...doc,...answersFrom(later.previous.linkIds.map(id=>id===row.id?next:store.get('socialReviewLinks',id)).filter(Boolean))});}
  });return {link:linkView(next)};}
  function authenticate(raw,context={},write=false){if(stopped||context.signal?.aborted)throw unavailable();if(context.origin!==origin)throw fail('검토 화면에서 다시 요청해 주세요.',403);busy(ipLimit,hash(String(context.clientKey||'unknown').slice(0,300)));if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))throw unavailable();const tokenHash=hash(raw);busy(tokenLimit,tokenHash);if(write)busy(writeLimit,tokenHash);const mapping=store.get('socialReviewTokens',tokenHash);const row=mapping?.linkId?store.get('socialReviewLinks',mapping.linkId):null;if(!row||row.tokenHash!==tokenHash||!['pending','approved','rejected'].includes(liveState(row)))throw unavailable();return row;}
  function checkLink(row,signal){if(stopped||signal?.aborted)throw unavailable();const live=store.get('socialReviewLinks',row.id);if(!live||live.tokenHash!==row.tokenHash||!['pending','approved','rejected'].includes(liveState(live)))throw unavailable();return live;}
  async function inspectLinkMedia(row,signal,key=null){
    try{return await inspectMedia(row.snapshot,{signal,check:()=>checkLink(row,signal)},key);}
    catch(error){
      // Only a real change (the file differs, is gone or no longer allowed: 4xx) retires the link; a passing I/O error is retried.
      if(stopped||signal?.aborted)throw unavailable();if(!(error?.status>=400&&error.status<500))throw fail('지금은 검토 파일을 불러오지 못했어요. 잠시 후 다시 열어 주세요.',503);
      if(!stopped&&!signal?.aborted){const live=store.get('socialReviewLinks',row.id);if(live&&!live.revokedAt&&!live.invalidatedAt&&['pending','approved','rejected'].includes(liveState(live)))store.put('socialReviewLinks',live.id,{...live,invalidatedAt:now(),revision:live.revision+1});}
      throw unavailable();
    }
  }
  function publicSnapshot(row){const s=row.snapshot;return {title:s.post.title,body:s.post.body,contentVersion:row.contentVersion,variants:s.post.variants.map((v,i)=>({key:'v'+i,account:Object.fromEntries(['name','platform','profile'].map(k=>[k,s.targets[i][k]||''])),title:v.title,text:v.text,format:v.format,options:copy(v.options||{}),copyVariants:(v.copyVariants||[]).map(c=>({title:c.title,text:c.text,hashtags:c.hashtags})),media:(v.media||[]).map((m,j)=>({key:`v${i}m${j}`,type:m.type,mimeType:m.mimeType,width:m.width||null,height:m.height||null,duration:m.duration||m.durationSeconds||null}))})),schedule:s.schedule.map(j=>({account:s.targets.find(t=>t.id===j.channelId)?.name||'',scheduledAt:j.scheduledAt,timezone:j.timezone,mode:j.mode,cancelled:j.cancelled})),recurrence:s.post.recurrence||null,expiresAt:s.post.expiresAt||null};}
  function publicView(row){return {review:{revision:row.revision,contentVersion:row.contentVersion,required:row.required===true,expiresAt:row.expiresAt,status:liveState(row),decision:row.decision,decisionAt:row.decisionAt||null,feedback:row.feedback.map(({id,name,comment,decision,createdAt})=>({id,name,comment,decision,createdAt})),snapshot:publicSnapshot(row),previous:publicPrevious(row)},notice:'이 링크를 가진 사람은 누구나 검토 의견을 남길 수 있어요. 검토자 이름은 따로 본인 확인을 하지 않아요. 고객 검토가 내부 발행 승인을 대신하지는 않아요.'};}
  function open(raw,context={}){return track(async signal=>{const row=authenticate(raw,{...context,signal});await inspectLinkMedia(row,signal);return publicView(checkLink(row,signal));},context.signal);}
  function respond(raw,input={},context={}){return track(async signal=>{object(input);const row=authenticate(raw,{...context,signal},true),requestId=clean(input.requestId,100,'요청 식별자',true);if(!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))throw fail('요청 식별자를 확인해 주세요.');const decision=input.decision;if(!['comment','approve','reject'].includes(decision))throw fail('검토 동작을 선택해 주세요.');const comment=clean(input.comment,3000,'검토 의견',decision!=='approve'),name=clean(input.name,80,'검토자 이름');const prior=row.feedback.find(x=>x.requestId===requestId);if(prior){if(prior.decision!==decision||prior.comment!==comment||prior.name!==name)throw fail('같은 요청에 다른 내용이 들어왔어요. 화면을 새로 불러온 뒤 다시 보내 주세요.',409);await inspectLinkMedia(row,signal);return publicView(checkLink(row,signal));}if(input.revision!==row.revision)throw fail('그사이 다른 검토 의견이 등록돼 최신 내용을 다시 불러왔어요. 확인한 뒤 다시 보내 주세요.',409);if(row.feedback.length>=200)throw fail('이 링크의 검토 의견 한도가 다 찼어요. 담당자에게 새 링크를 요청해 주세요.',409);await inspectLinkMedia(row,signal);const live=checkLink(row,signal);if(live.revision!==row.revision)throw fail('그사이 검토 상태가 바뀌어 최신 내용을 다시 불러왔어요. 확인한 뒤 다시 보내 주세요.',409);const at=now(),next={...live,revision:live.revision+1,feedback:[...live.feedback,{id:randomUUID(),requestId,name,comment,decision,createdAt:at}],...(decision==='comment'?{}:{decision,decisionAt:at})};store.put('socialReviewLinks',row.id,next);return publicView(next);},context.signal);}
  function media(raw,input={},context={}){return track(async signal=>{object(input);const row=authenticate(raw,{...context,signal}),key=clean(input.mediaKey,40,'검토 파일',true);if(!mediaRefs(row.snapshot).some(item=>item.key===key))throw unavailable();const result=await inspectLinkMedia(row,signal,key);checkLink(row,signal);return result;},context.signal);}
  const waitForIdle=async()=>{while(pending.size)await Promise.allSettled([...pending]);};const stop=async()=>{stopped=true;for(const controller of controllers)controller.abort();await waitForIdle();};
  return {workspace,recordApproval,validateReview,create,revoke,open,respond,media,waitForIdle,stop};
}
