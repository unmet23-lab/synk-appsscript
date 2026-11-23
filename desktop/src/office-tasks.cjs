'use strict';
const {randomUUID,createHash}=require('node:crypto');
const { ID: MEMBER } = require('./site-visits.cjs');
const { createTaskStore, submission, publicTask, editMetadata, goodId, REASONS, MAX_ANSWER, MAX_TASKS, problem } = require('./office-task-store.cjs');
const {needsMailDecision,combinePlan,reviewFilter,reviewMissingMailboxes,validMissingProviders,confirmedMailExclusions}=require('./office-mail-api.cjs');

const mailFilterKeys=['terms','from','after','before','folder','provider','attachment'];
const mailRoleFields=['from','folder'];
const mailRoleActions=['apply','exclude','edit'];
const defaultMailFilter={terms:[],from:'',after:'',before:'',folder:'received',provider:'all',attachment:''};
const modelConditionLimits=require('./office-mail-plan.schema.json').properties.unmet;
const reviewReasons=new Set(['source','conditions','evidence','folder','period','provider','sender','terms','attachment','followup','unsupported']);
const accountTagValid=tag=>typeof tag==='string'&&/^[a-f0-9]{64}$/i.test(tag);
const bindingIds=bindings=>bindings.map(b=>b.id).sort();
const sameBindings=(actual,ids)=>Array.isArray(ids)&&actual.length===ids.length&&bindingIds(actual).every((id,i)=>id===ids[i]);
const sameMailAccount=(a,b)=>a.provider===b.provider&&(a.id===b.id||Boolean(a.lineage&&a.lineage===b.lineage));
const sharedBindings=(prior,active)=>active.filter(b=>prior.some(old=>sameMailAccount(old,b)));

function reviewConditions(prompt,items,missing){
  if(!Array.isArray(items)||items.length>Math.max(modelConditionLimits.maxItems,prompt.length)+(missing?.length||0))
    throw new Error('Invalid mail condition excerpt');
  // Title spans can overlap at either end. Folder pairs, status words and missing mailbox labels can overlap them too.
  const maxText=5*prompt.length+modelConditionLimits.maxItems*modelConditionLimits.items.maxLength;
  const unique=new Set();
  let size=0;
  for(const value of items){
    if(typeof value!=='string'||!value.length||!prompt.includes(value))throw new Error('Invalid mail condition excerpt');
    if(unique.has(value))continue;
    size+=value.length;
    if(size>maxText)throw new Error('Mail condition excerpts exceed source bounds');
    unique.add(value);
  }
  return [...unique];
}

function reviewRoles(prompt,filter,items){
  if(!Array.isArray(items)||items.length<1||items.length>mailRoleFields.length)throw new Error('Invalid mail roles');
  const seen=new Set();
  return items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==3||
      !['field','quote','value'].every(k=>Object.hasOwn(item,k)))throw new Error('Invalid mail role');
    const {field,quote,value}=item;
    if(!mailRoleFields.includes(field)||seen.has(field)||typeof quote!=='string'||!quote.trim()||!prompt.includes(quote)||
      typeof value!=='string'||!value||field==='from'&&!quote.toLowerCase().includes(value.toLowerCase()))throw new Error('Invalid mail role evidence');
    reviewFilter({...filter,[field]:value});
    seen.add(field);
    return {field,quote,value};
  });
}

function reviewView(prompt,proposal,prior) {
  const plan=proposal?.plan?combinePlan(proposal.plan,prior?.plan):
    proposal?.filter?reviewFilter(proposal.filter):prior?.plan?combinePlan(prior.plan):reviewFilter(defaultMailFilter);
  const filter=Object.fromEntries(mailFilterKeys.map(k=>[k,plan[k]]));
  const excerpts=(items,max)=>Array.isArray(items)?items.filter(q=>typeof q==='string'&&q.length>0&&q.length<=512&&prompt.includes(q)).slice(0,max):[];
  const missing=proposal?.missingProviders;
  if(missing!==undefined&&!validMissingProviders(missing,proposal.unmet))throw new Error('Invalid missing mailboxes');
  const roleChoices=proposal&&Object.hasOwn(proposal,'roleChoices')?reviewRoles(prompt,filter,proposal.roleChoices):null;
  return {reviewId:randomUUID(),filter,quotes:excerpts(proposal?.quotes,8),unmet:reviewConditions(prompt,proposal?.unmet??[],missing),
    ...(roleChoices?{roleChoices}:{}),
    ...(missing?{missingProviders:missing}:{}),
    ...(proposal?.requiresPeriodChoice===true?{requiresPeriodChoice:true}:{}),
    reason:reviewReasons.has(proposal?.reason)?proposal.reason:'conditions'};
}
function reviewParentMatches(row,parent) {
  if(row.previousId&&(!parent||parent.status!=='completed'||!parent.sessionId||parent.departmentId!==row.departmentId||
    parent.provider!==row.provider||parent.cwd!==row.cwd))return false;
  return parent?.mailSearch?row.sessionId===parent.sessionId&&row.providerSalt===(parent.providerSalt||parent.id)&&row.providerTag===parent.providerTag:
    row.sessionId===row.id&&row.providerSalt===row.id;
}
function roleReviewTag(id,record){
  return createHash('sha256').update(id).update(JSON.stringify(record)).digest('hex');
}
function saveReview(row,view){
  const record={kind:'mail-review',reason:view.reason,unmet:view.unmet,filter:view.filter,
    ...(view.missingProviders?{missingProviders:view.missingProviders}:{}),...(view.requiresPeriodChoice===true?{requiresPeriodChoice:true}:{})};
  if(view.roleChoices){
    record.roleChoices=view.roleChoices;
    record.roleSalt=randomUUID(); // Kept only inside the encrypted draft. The index can detect removed or exchanged role choices.
    row.mailRoleReviewTag=roleReviewTag(row.id,record);
  }
  row.mailReviewRecord=record;
}
function sameRoleRecord(row,record){
  const tagged=Object.hasOwn(row,'mailRoleReviewTag');
  const roles=record&&Object.hasOwn(record,'roleChoices'),salted=record&&Object.hasOwn(record,'roleSalt');
  if(!tagged&&!roles&&!salted)return true;
  return tagged&&roles&&salted&&record.kind==='mail-review'&&goodId(record.roleSalt)&&
    row.mailRoleReviewTag===roleReviewTag(row.id,record);
}
function readReview(row,record,prior){
  if(!sameRoleRecord(row,record))throw new Error('Changed mail role selection');
  if(record?.kind==='mail-review'){
    const hasMissing=Object.hasOwn(record,'missingProviders'),missing=record.missingProviders;
    if(hasMissing&&!validMissingProviders(missing,record.unmet))throw new Error('Invalid saved missing mailboxes');
    const hasPeriod=Object.hasOwn(record,'requiresPeriodChoice');
    if(hasPeriod&&record.requiresPeriodChoice!==true)throw new Error('Invalid saved period choice');
    const hasRoles=Object.hasOwn(record,'roleChoices');
    if(Object.keys(record).length!==4+Number(hasMissing)+Number(hasPeriod)+2*Number(hasRoles)||!reviewReasons.has(record.reason)||!Array.isArray(record.unmet)||
      record.reason==='unsupported'&&!record.unmet.length)throw new Error('Invalid saved mail review');
    // A persisted review must not fall back to broader defaults when its verified filter is damaged.
    try{
      const plan=reviewFilter(record.filter);
      return reviewView(row.prompt,{plan,reason:record.reason,unmet:record.unmet,...(hasMissing?{missingProviders:missing}:{}),...(hasRoles?{roleChoices:record.roleChoices}:{}),
        ...(hasPeriod?{requiresPeriodChoice:true}:{})});
    }
    catch{throw new Error('Invalid saved mail filter');}
  }
  if(row.mailReviewStored||record)throw new Error('Missing or unexpected saved mail review');
  return reviewView(row.prompt,null,prior);
}
const quoteCards=require('./office-quote-cards.cjs');
const {quoteIntent}=require('./office-quote-thread.cjs');

function createOfficeTasks({userData, current, authorized, context, run, mail=null, changed = ()=>{}, now = Date.now, store = createTaskStore(userData,undefined,mail)}) {
  let queue = Promise.resolve(), closed = false, closingAccount=null;
  const live = new Map(), recovered = new Set(), permits = new Map(), unsaved = new Map(),preparedPlans=new Map(),mailReviews=new Map();
  const serialize = work => {
    const next = queue.then(work);
    queue = next.catch(()=>{});
    return next;
  };
  const owner = a => a?.synk_user_id;
  const same = (a,b) => !!a && !!b && owner(a) === owner(b) && a.sessionGeneration === b.sessionGeneration;
  const present = a => !closed && typeof owner(a) === 'string' && MEMBER.test(owner(a)) && same(a,current());
  const allowed = async a => present(a) && await authorized(a) && present(a);
  const key = (member,id) => member+'/'+id;
  const errorCode = e => REASONS.includes(e?.code) ? e.code : 'PROVIDER';
  const safe = f => serialize(f).catch(e=>problem(e?.message === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'STORAGE'));
  const notify = () => { try { changed(); } catch {} };
  function requireSelection(row,reason){
    Object.assign(row,{mailDecision:'choose',mailDecisionReason:reason,status:'failed',reason:'MAIL_CHOOSE',sessionId:null,updatedAt:now()});
    delete row.mailSearch;delete row.mailBindings;delete row.mailActiveIds;delete row.mailBindingVersion;delete row.providerTag;
  }
  function waitForReview(row){
    Object.assign(row,{mailSearch:true,mailDecision:'review',status:'failed',reason:'MAIL_REVIEW',answer:'',updatedAt:now()});
    delete row.mailBindingVersion;delete row.mailDecisionReason;
  }
  function rememberReview(a,row,view,version){
    const availableProviders=(row.mailBindings||[]).map(b=>b.provider);
    mailReviews.set(key(owner(a),row.id),{view:{...view,availableProviders},version,account:a,accountTag:row.providerTag,updatedAt:row.updatedAt});
  }
  function stopManual(member,id) {
    const k=key(member,id), job=live.get(k);
    if(!job || job.controller.signal.aborted)return;
    job.controller.abort();
    permits.delete(k);
  }
  async function rows(a,mailIds=null) {
    const member=owner(a);
    if(mailIds)for(const id of unsaved.get(member)?.keys()||[])mailIds.add(id);
    const tasks=await store.read(member,{mailIds});
    // A member receipt is durable even if its index write failed.
    for(const task of tasks)if(task.reason==='MEMBER_RESULT')stopManual(member,task.id);
    const pending=unsaved.get(member);
    if(pending?.size){
      let answerOwner=null;
      const settled=[];
      for(const {account,final} of pending.values()){
        const row=tasks.find(t=>t.id===final.id);
        if(row?.reason==='WRITE' && !row.answer)continue;
        settled.push(final.id);
        if(row && ['running','terminal'].includes(row.status)){
          delete row.provisional;
          // A closing console from an earlier login can trigger this flush.
          // Each result belongs to the login that produced it.
          if(present(account)){
            Object.assign(row,final);
            if(row.status==='completed'&&final.mailReceipt)delete row.mailRoleReviewTag;
            if(final.reason==='MAIL_CHOOSE')requireSelection(row,final.mailDecisionReason);
            if(final.answer||final.mailReceipt||final.mailReviewRecord)answerOwner=account;
          }
          else Object.assign(row,{status:'interrupted',reason:'AUTH_CHANGED',answer:'',updatedAt:now()});
        }
      }
      if(settled.length){
        await store.write(member,tasks,()=>!answerOwner || present(answerOwner));
        for(const id of settled)pending.delete(id);
        if(!pending.size)unsaved.delete(member);
      }
    }
    // The encrypted scan may already be durable after a crash before the ledger rename.
    let restored=false;
    for(const parent of tasks.filter(t=>t.quoteHandoff&&t.status==='completed')){
      if(quoteCards.addRecipients(tasks,parent,now(),true).length)restored=true;
    }
    if(restored)await store.write(member,tasks,()=>present(a));
    if (!recovered.has(member)) {
      let dirty = false;
      for (const t of tasks) {
        if (!['queued','running','terminal','paused'].includes(t.status)) continue;
        if(permits.has(key(member,t.id))||live.has(key(member,t.id))||t.mailSearch&&mailIds&&!mailIds.has(t.id))continue;
        if(t.mailDecision==='confirmed'&&!preparedPlans.has(key(member,t.id))){
          waitForReview(t);dirty=true;continue;
        }
        if(!t.quoteHandoff&&!t.quoteOrigin&&t.mailDecision==='mailbox'&&!preparedPlans.has(key(member,t.id))){
          requireSelection(t,'MAIL_CHANGED');dirty=true;continue;
        }
        if(t.status==='paused')continue;
        const manual=t.provider==='codex' && t.reason==='MANUAL_RESULT';
        // 기능 줄은 이어 붙이지 않는다. 손님이 작업 화면에서 다시 읽는다(사업계획서_설계.md 4.2)
        t.status = t.status === 'queued' && !t.feature ? 'paused' : 'interrupted';
        t.reason = manual?'MANUAL_RESULT':'RESTART';
        if(t.status==='interrupted' && t.provisional){
          t.reason='UNCONFIRMED';t.answer=t.provisional;
        }
        delete t.provisional;
        t.updatedAt = now(); dirty = true;
      }
      if (dirty) await store.write(member,tasks,()=>present(a));
      if(!mailIds)recovered.add(member);
    }
    return tasks;
  }
  function snapshot(a) {
    return safe(async()=>{
      if (!await allowed(a)) return problem('NOT_ALLOWED');
      let tasks;
      try{tasks=await rows(a);}catch(e){
        const pending=unsaved.get(owner(a));
        if(!pending?.size || !present(a))throw e;
        const saved=await store.read(owner(a)).catch(()=>[]);
        if(!present(a))return problem('AUTH_CHANGED');
        const combined=new Map(saved.map(t=>[t.id,publicTask(t)]));
        for(const {final:t,account} of pending.values())if(same(account,a))combined.set(t.id,{...publicTask(t),status:'failed',reason:'WRITE'});
        return {ok:true,code:'WRITE',tasks:[...combined.values()].reverse().map(t=>({...t,canOpenTerminal:false}))};
      }
      if (!present(a)) return problem('AUTH_CHANGED');
      return {ok:true,tasks:tasks.slice().reverse().map(t=>{
        const job=live.get(key(owner(a),t.id));
        const owned=same(a,job?.account) && !job.controller.signal.aborted;
        const canOpenTerminal=!!(owned && job.open);
        const task={...publicTask(t),canOpenTerminal};
        const review=mailReviews.get(key(owner(a),t.id));
        if(t.reason==='MAIL_REVIEW'&&same(a,review?.account)&&mail?.atGeneration(owner(a),review.version)){
          task.mailReview=structuredClone(review.view);
        }
        quoteCards.decorate(task,t,tasks);
        const preview=owned && t.provider==='claude' && ['running','terminal'].includes(t.status) && (job.preview || t.provisional);
        if(preview)task.previewAnswer=preview;
        const pending=unsaved.get(owner(a))?.get(t.id);
        if(t.reason==='WRITE' && same(a,pending?.account))task.answer=pending.final.answer;
        if(canOpenTerminal && t.provider==='codex' && t.status==='terminal' && ['PERMISSION','MANUAL_RESULT'].includes(t.reason)){
          task.continuationPrompt=require('./office-task-codex.cjs').nativePrompt(t.id);
        }
        return task;
      })};
    });
  }
  /* 셋째 조각의 기능 업무(기능줄_경쟁사_설계.md 2.3, 사업계획서_설계.md 4.2).
     부서 폴더를 쓰지 않고(cwd 빈칸, 옛 빌드는 FOLDER로 멈춘다), 한 부서에 같은 기능은 하나씩, 끝난 기능 줄은 여섯만 남긴다 */
  const FEATURE_PROMPT={bizplan:'사업계획서를 회사 자료와 견주어 읽습니다'};
  function submitFeature(a,input){
    const feature=input?.feature,departmentId=input?.departmentId,provider=input?.provider;
    if(!goodId(input?.id)||!Object.hasOwn(FEATURE_PROMPT,feature)||!['claude','codex'].includes(provider)||typeof departmentId!=='string'||!/^[A-Za-z0-9_-]{4,32}$/.test(departmentId))return Promise.resolve(problem('VALUE'));
    const id=input.id.toLowerCase();
    return safe(async()=>{
      if (!await allowed(a)) return problem('NOT_ALLOWED');
      const member=owner(a);
      let tasks=await rows(a);
      const existing=tasks.find(t=>t.id===id);
      if(existing)return existing.feature===feature&&existing.departmentId===departmentId&&existing.provider===provider?{ok:true,id}:problem('ID_CONFLICT');
      if(tasks.some(t=>t.feature===feature&&t.departmentId===departmentId&&['queued','running','terminal','paused'].includes(t.status)))return problem('BUSY');
      const finished=tasks.filter(t=>t.feature===feature&&t.departmentId===departmentId&&!['queued','running','terminal','paused'].includes(t.status)).sort((x,y)=>y.updatedAt-x.updatedAt);
      const drop=new Set(finished.slice(5).map(t=>t.id));
      if(drop.size)tasks=tasks.filter(t=>!drop.has(t.id));
      if(tasks.length>=MAX_TASKS)return problem('STORAGE_FULL');
      const ctx=await context(a,departmentId,{folder:false});
      if(!ctx?.ok)return problem(ctx?.code||'FOLDER');
      if(!await allowed(a))return problem('AUTH_CHANGED');
      const at=now();
      tasks.push({id,provider,departmentId,prompt:FEATURE_PROMPT[feature],previousId:null,feature,trigger:'manual',requestMode:'ordinary',mailSearch:false,
        departmentName:ctx.name,cwd:'',sessionId:null,providerSalt:id,providerTag:null,createdAt:at,updatedAt:at,status:'queued',reason:null,answer:''});
      permits.set(key(member,id),a);
      try{await store.write(member,tasks,()=>present(a));}
      catch(e){permits.delete(key(member,id));if(!present(a))return problem('AUTH_CHANGED');throw e;}
      if (!present(a)) { schedulePark(a); return problem('AUTH_CHANGED'); }
      notify(); schedule(a);
      return {ok:true,id};
    });
  }
  function submit(a,input) {
    const data = submission(input);
    if (!data) return Promise.resolve(problem('VALUE'));
    return safe(async()=>{
      if (!await allowed(a)) return problem('NOT_ALLOWED');
      const member=owner(a);
      const automatic=!!mail&&data.provider==='codex'&&data.mailSearch==null;
      const handoff=data.quoteHandoff===true||automatic&&quoteIntent(data.prompt);
      if(handoff)data.previousId=null;
      let pendingDecision=false,tasks;
      if(!handoff&&automatic&&(needsMailDecision(data.prompt)||data.previousId)){
        const index=await store.read(member,{metadataOnly:true});
        const prior=data.previousId&&index.find(row=>row.id===data.previousId);
        pendingDecision=needsMailDecision(data.prompt,prior?.mailSearch?'mail':null);
        if(pendingDecision)tasks=index;
      }
      let retrySource=null,retryGroups=[];
      if(data.quoteResumeOf){
        const index=await store.read(member,{metadataOnly:true});
        const original=index.find(r=>r.id===data.quoteResumeOf&&r.quoteHandoff&&r.status==='completed'&&r.prompt===data.prompt&&r.departmentId===data.departmentId);
        if(!original)return problem('SESSION');
        const ids=new Set(index.filter(r=>r.id===original.id||r.quoteRoot===original.id).map(r=>r.id));
        tasks=await rows(a,ids);
        retrySource=tasks.find(r=>r.id===original.id);
        const sources=new Map();
        for(const scan of tasks.filter(r=>ids.has(r.id)))for(const g of scan.mailReceipt?.groups||[])sources.set(g.provider,{group:g,binding:scan.mailReceipt.bindings.find(b=>b.provider===g.provider)});
        retryGroups=[...sources.values()].filter(s=>s.group.code&&s.binding);
        if(!retrySource?.mailReceipt||!retryGroups.length)return problem('SESSION');
      }
      tasks??=await rows(a,new Set(data.mailSearch&&data.previousId?[data.previousId]:[]));
      const existing = tasks.find(t=>t.id === data.id);
      const requestMode=data.mailSearch===true?'mail':data.mailSearch===false?'ordinary':'auto';
      if (existing) return present(a) && !existing.quoteOrigin && handoff===!!existing.quoteHandoff && (!existing.requestMode||existing.requestMode===requestMode) &&
        Object.keys(data).every(k=>k==='mailSearch'&&existing.requestMode||data[k]===existing[k]) ? {ok:true,id:existing.id} : problem('ID_CONFLICT');
      if(tasks.length>=MAX_TASKS)return problem('STORAGE_FULL');
      const previous = data.previousId && tasks.find(t=>t.id===data.previousId);
      if(previous?.quoteOrigin||previous?.quoteHandoff)return problem('SESSION');
      if (data.previousId && (!previous || previous.status!=='completed' || !previous.sessionId || previous.provider!==data.provider || previous.departmentId!==data.departmentId)) return problem('SESSION');
      const ctx = await context(a,data.departmentId);
      if (!ctx?.ok) return problem(ctx?.code || 'FOLDER');
      if (!await allowed(a)) return problem('AUTH_CHANGED');
      if (previous && (previous.cwd!==ctx.cwd || tasks.some(t=>t.sessionId===previous.sessionId && ['queued','running','terminal','paused'].includes(t.status)))) return problem('BUSY');
      const mailSearch=!!mail&&data.provider==='codex'&&(data.mailSearch===true||handoff);
      if((data.mailSearch||handoff)&&!mail)return problem('NOT_AVAILABLE');
      const previousMail=!!previous?.mailSearch;
      const inheritSession=previous&&(pendingDecision||mailSearch===previousMail);
      let captured=[],activeIds,explicitVersion;
      if(mailSearch&&!pendingDecision){
        try{
          if(!data.mailRetry&&!handoff)explicitVersion=mail.generation(a);
          const active=await mail.bindings(a);
          if(!present(a))return problem('AUTH_CHANGED');
          if(explicitVersion&&!mail.atGeneration(member,explicitVersion))return problem('MAIL_CHANGED');
          if(explicitVersion)activeIds=active.map(g=>g.id).sort();
          if(retrySource){
            captured=retryGroups.map(({binding:b})=>active.find(g=>g.provider===b.provider&&g.lineage===b.lineage));
            if(captured.some(b=>!b))return problem('MAIL_CHANGED');
          }else if(previousMail){
            const prior=previous.mailReceipt?.availableBindings||previous.mailReceipt?.bindings||[];
            // A retry can retain an already-fetched group after disconnection. A new search only gets the shared accounts.
            captured=data.mailRetry?prior.map(b=>active.find(g=>sameMailAccount(b,g))||b):sharedBindings(prior,active);
          }else{captured=active;}
          if(data.mailRetry){
            if(!previousMail||!previous.mailReceipt?.groups.some(g=>g.code)||data.prompt!==previous.prompt)return problem('SESSION');
          }
        }
        catch(e){return problem(!present(a)?'AUTH_CHANGED':e.code||'MAIL_STORAGE');}
        if(!await allowed(a))return problem('AUTH_CHANGED');
      }
      const at = now();
      tasks.push({...data,requestMode,...(handoff?{quoteHandoff:true}:{}),...(mailSearch?{mailSearch:true,mailBindings:captured,...(activeIds?{mailActiveIds:activeIds}:{})}:{}),
        ...(pendingDecision?{mailDecision:'pending',mailBindingVersion:mail.generation(a)}:{}),departmentName:ctx.name,cwd:ctx.cwd,sessionId:inheritSession?previous.sessionId:null,
        providerSalt:retrySource?(retrySource.providerSalt||retrySource.id):inheritSession?previous.providerSalt??previous.id:data.id,
        providerTag:retrySource?retrySource.providerTag:inheritSession?previous.providerTag??null:null,
        createdAt:at,updatedAt:at,status:'queued',reason:null,answer:''});
      permits.set(key(member,data.id),a);
      try{await store.write(member,tasks,()=>present(a)&&(!explicitVersion||mail.atGeneration(member,explicitVersion)));}
      catch(e){permits.delete(key(member,data.id));if(!present(a))return problem('AUTH_CHANGED');if(explicitVersion&&!mail.atGeneration(member,explicitVersion))return problem('MAIL_CHANGED');throw e;}
      if (!present(a)) { schedulePark(a); return problem('AUTH_CHANGED'); }
      notify(); schedule(a);
      return {ok:true,id:data.id};
    });
  }
  // Access is rechecked after awaits and for every callback. Completion writes only to the captured member.
  function schedule(a) { void safe(()=>pump(a)); }
  async function startDecision(a,member,t,prior) {
    const k=key(member,t.id),controller=new AbortController();
    const job={account:a,provider:t.provider,controller,sessionId:t.sessionId,open:null};
    const index=await store.read(member,{metadataOnly:true});
    const row=index.find(r=>r.id===t.id);
    if(!row||row.status!=='queued'||!present(a))return;
    Object.assign(editMetadata(row),{status:'running',updatedAt:now()});
    await store.write(member,index,()=>present(a));live.set(k,job);notify();
    const available=()=>present(a)&&live.get(k)===job&&!controller.signal.aborted;
    const checkpoint=async()=>available()&&await allowed(a)&&available();
    const previousMail=prior?.mailSearch===true, previousKind=prior?(previousMail?'mail':'ordinary'):null;
    const spec={id:t.id,cwd:t.cwd,provider:'codex',prompt:t.prompt,mailSearch:true,mailJudge:true,previousKind,previousMail,
      sessionId:previousMail?prior.sessionId:null,providerTag:previousMail?prior.providerTag:null,providerSalt:previousMail?prior.providerSalt||prior.id:t.id};
    let accountTag=null;
    const hooks={signal:controller.signal,checkpoint,session:async(_id,tag)=>{accountTag=tag;return checkpoint();}};
    async function decide(){
      try{
        if(!await checkpoint())return {kind:'choose',reason:'AUTH_CHANGED'};
        return await run(spec,hooks);
      }catch(e){return {kind:'choose',reason:errorCode(e)};}
    }
    void decide().then(decision=>safe(async()=>{
      let runNext=false,settled=false,permissionLost=false;
      try{
        if(!await checkpoint()){permissionLost=true;return;}
        const currentRows=await store.read(member,{metadataOnly:true});
        const target=currentRows.find(r=>r.id===t.id);
        if(!target||target.status!=='running'||target.mailDecision!=='pending')return;
        const parent=target.previousId&&currentRows.find(r=>r.id===target.previousId);
        const activeTarget=editMetadata(target);
        let kind=decision?.kind,reason=decision?.reason,bindings,activeIds,view;
        const version=target.mailBindingVersion;
        if(kind==='mailbox'||kind==='review'){
          try{
            if(!accountTagValid(accountTag)||(kind==='review'?!decision.review:!decision.plan))throw Object.assign(new Error(),{code:'MAIL_PLAN'});
            if(target.mailBindingVersion!==mail.generation(a))throw Object.assign(new Error(),{code:'MAIL_CHANGED'});
            const active=await mail.bindings(a);
            activeIds=bindingIds(active);
            let receipt,proposal=kind==='review'?decision.review:null;
            if(previousMail){
              receipt=await mail.vault.read(member,parent.id);
              if(!receipt)throw Object.assign(new Error(),{code:'MAIL_STORAGE'});
              bindings=sharedBindings(receipt.availableBindings||receipt.bindings,active);
              if(!bindings.length)throw Object.assign(new Error(),{code:'MAIL_CHANGED'});
            }else bindings=active;
            proposal=reviewMissingMailboxes(proposal?.plan||decision.plan,bindings,target.prompt,proposal);
            if(proposal){kind='review';view=reviewView(target.prompt,proposal,receipt);}
            if(target.mailBindingVersion!==mail.generation(a))throw Object.assign(new Error(),{code:'MAIL_CHANGED'});
          }catch(e){kind='choose';reason=errorCode(e);}
        }
        if(!await checkpoint()){permissionLost=true;return;}
        if(kind==='ordinary'||kind==='mailbox'){
          const search=kind==='mailbox',inherit=parent&&Boolean(parent.mailSearch)===search;
          Object.assign(activeTarget,{mailDecision:kind,mailSearch:search,status:'queued',reason:null,
            sessionId:inherit?parent.sessionId:null,providerSalt:inherit?parent.providerSalt||parent.id:target.id,
            providerTag:inherit?parent.providerTag:null,...(search?{mailBindings:bindings,judgedAccountTag:accountTag,mailInherited:!!inherit}:{}),updatedAt:now()});
        }else if(kind==='review'){
          Object.assign(activeTarget,{sessionId:previousMail?parent.sessionId:t.id,providerSalt:spec.providerSalt,providerTag:accountTag,
            mailBindings:bindings,mailActiveIds:activeIds});
          saveReview(activeTarget,view);
          waitForReview(activeTarget);
        }else{
          Object.assign(activeTarget,{mailDecision:'choose',status:'failed',reason:'MAIL_CHOOSE',sessionId:null,updatedAt:now()});
          if(REASONS.includes(reason))activeTarget.mailDecisionReason=reason;
        }
        if(kind!=='mailbox')delete activeTarget.mailBindingVersion;
        const capturesBindings=kind==='mailbox'||kind==='review';
        try{await store.write(member,currentRows,()=>available()&&(!capturesBindings||mail.atGeneration(member,version)));}
        catch(e){
          if(!capturesBindings||!available()||mail.atGeneration(member,version))throw e;
          kind='choose';requireSelection(activeTarget,'MAIL_CHANGED');await store.write(member,currentRows,available);
        }
        settled=true;
        if(kind==='mailbox')preparedPlans.set(k,{plan:decision.plan,accountTag,version,memberSession:a,updatedAt:activeTarget.updatedAt});
        if(kind==='review')rememberReview(a,activeTarget,view,version);
        runNext=kind==='mailbox'||kind==='ordinary';
      }finally{
        if(!settled&&live.get(k)===job){
          try{
            const fresh=await store.read(member,{metadataOnly:true}),unfinished=fresh.find(r=>r.id===t.id);
            if(unfinished?.status==='running'&&unfinished.mailDecision==='pending'){
              const interrupted=!present(a)||controller.signal.aborted||permissionLost;
              Object.assign(editMetadata(unfinished),{status:interrupted?'interrupted':'failed',reason:interrupted?(present(a)&&controller.signal.aborted?'CANCELLED':'AUTH_CHANGED'):'WRITE',updatedAt:now()});
              await store.write(member,fresh);
            }
          }catch{recovered.delete(member);}
        }
        if(live.get(k)===job)live.delete(k);
        if(!runNext)permits.delete(k);
        notify();if(present(a))schedule(a);
      }
    })).catch(()=>{});
  }
  async function pump(a) {
    if (!await allowed(a)) return;
    const member=owner(a);
    const queued=[...permits].some(([id,permit])=>same(a,permit)&&!live.has(id));
    if(!queued&&!unsaved.get(member)?.size)return;
    if(!queued){await rows(a);return;}
    const index=await store.read(member,{metadataOnly:true});
    for (const entry of index) {
      if (entry.status!=='queued' || !same(a,permits.get(key(member,entry.id)))) continue;
      const ctx = await context(a,entry.departmentId,entry.feature?{folder:false}:undefined);
      if (!await allowed(a)) return;
      if (!ctx?.ok || entry.cwd!==ctx.cwd) {
        const fresh=await store.read(member,{metadataOnly:true}),row=fresh.find(r=>r.id===entry.id);
        if(row){Object.assign(editMetadata(row),{status:'failed',reason:'FOLDER',updatedAt:now()});await store.write(member,fresh,()=>present(a));}
        permits.delete(key(member,entry.id));preparedPlans.delete(key(member,entry.id));notify();continue;
      }
      const running = [...live.values()].filter(r=>owner(r.account)===member);
      if (running.length >= ctx.cap) break;
      if (running.filter(r=>r.provider===entry.provider).length >= (ctx.toolCaps?.[entry.provider] ?? ctx.cap)) continue;
      if (entry.sessionId && running.some(r=>r.sessionId===entry.sessionId)) continue;
      if(entry.mailDecision==='pending'){
        await startDecision(a,member,entry,index.find(r=>r.id===entry.previousId));continue;
      }
      let explicitVersion;
      const quote=entry.quoteHandoff||entry.quoteOrigin;
      if(!quote&&(['mailbox','confirmed'].includes(entry.mailDecision)||entry.mailSearch&&entry.requestMode!=='mail'&&!entry.mailRetry)){
        const id=key(member,entry.id),prepared=preparedPlans.get(id);
        if(!prepared?.plan||!/^[a-f0-9]{64}$/i.test(prepared.accountTag||'')||!same(a,prepared.memberSession)||prepared.accountTag!==entry.judgedAccountTag||
          prepared.updatedAt!==entry.updatedAt||prepared.version!==entry.mailBindingVersion||!mail?.atGeneration(member,prepared.version)){
          const fresh=await store.read(member,{metadataOnly:true}),row=fresh.find(r=>r.id===entry.id);
          if(row?.status==='queued'){
            if(row.mailDecision==='confirmed')Object.assign(editMetadata(row),{status:'failed',reason:'MAIL_CHANGED',updatedAt:now()});
            else requireSelection(editMetadata(row),'MAIL_CHANGED');
            await store.write(member,fresh,()=>present(a));
          }
          preparedPlans.delete(id);permits.delete(id);notify();continue;
        }
      }else if(!quote&&entry.mailSearch&&!entry.mailRetry&&mail){
        explicitVersion=mail.generation(a);
        let bindings;
        try{bindings=await mail.bindings(a);}catch(e){
          if(!present(a)){schedulePark(a);return;}
          const fresh=await store.read(member,{metadataOnly:true}),row=fresh.find(r=>r.id===entry.id);
          if(row?.status==='queued'){
            Object.assign(editMetadata(row),{status:'failed',reason:errorCode(e),updatedAt:now()});
            await store.write(member,fresh,()=>present(a));
          }
          permits.delete(key(member,entry.id));notify();continue;
        }
        const expected=entry.mailActiveIds||entry.mailBindings?.map(b=>b.id).sort()||[];
        if(!mail.atGeneration(member,explicitVersion)||JSON.stringify(bindings.map(b=>b.id).sort())!==JSON.stringify(expected)){
          const fresh=await store.read(member,{metadataOnly:true}),row=fresh.find(r=>r.id===entry.id);
          if(row?.status==='queued'){requireSelection(editMetadata(row),'MAIL_CHANGED');await store.write(member,fresh,()=>present(a));}
          permits.delete(key(member,entry.id));notify();continue;
        }
      }
      const quoteSources=new Set();
      function includeScan(id){
        let scan=index.find(row=>row.id===id);
        while(scan?.quoteHandoff && !quoteSources.has(scan.id)){
          quoteSources.add(scan.id);
          if(scan.quoteRoot)quoteSources.add(scan.quoteRoot);
          scan=index.find(row=>row.id===scan.quoteBatchParent);
        }
      }
      if(entry.quoteHandoff||entry.quoteOrigin){
        for(const id of [entry.quoteRoot,entry.quoteBatchParent,entry.quoteOrigin?.parentId,entry.quoteRunFrom]){
          if(id)includeScan(id);
        }
        if(entry.quoteResumeOf){
          const prior=index.find(row=>row.id===entry.quoteResumeOf&&row.quoteHandoff);
          if(prior){
            includeScan(prior.id);
            for(const row of index)if(row.quoteRoot===prior.id&&row.status==='completed')includeScan(row.id);
          }
        }
      }
      const ownMail=(recipients=[])=>new Set(entry.mailSearch?
        [entry.id,entry.mailInherited===false?null:entry.previousId,...quoteSources,...recipients].filter(Boolean):[]);
      const tasks=await rows(a,ownMail()),t=tasks.find(r=>r.id===entry.id);
      if(!t||t.status!=='queued'||!present(a))continue;
      const k = key(member,t.id), controller = new AbortController();
      const priorTask=t.previousId&&tasks.find(row=>row.id===t.previousId);
      if(t.mailDecision==='confirmed'&&(!reviewParentMatches(t,priorTask)||priorTask?.mailSearch&&!priorTask.mailReceipt)){
        Object.assign(t,{status:'failed',reason:'SESSION',updatedAt:now()});
        await store.write(member,tasks,()=>present(a));preparedPlans.delete(k);permits.delete(k);notify();continue;
      }
      const job = {account:a,provider:t.provider,controller,sessionId:t.sessionId,providerTag:t.providerTag,open:null};
      t.status='running'; t.reason=null; t.updatedAt=now();
      await store.write(member,tasks);
      if (!present(a)) { schedulePark(a); return; }
      live.set(k,job); notify();
      const runningHere = ()=>present(a) && live.get(k)===job && !controller.signal.aborted;
      const checkpoint = async()=>runningHere() && await allowed(a) && runningHere();
      const update = (status,reason,sessionId,open,provisional,providerTag)=>serialize(async()=>{
        if (!await checkpoint()) return false;
        if (provisional) job.preview=provisional;
        const all = await rows(a,ownMail()), row = all.find(v=>v.id===t.id);
        if (!runningHere() || !row || !['running','terminal'].includes(row.status)) return false;
        if (goodId(sessionId)) row.sessionId=sessionId;
        if (providerTag) row.providerTag=providerTag;
        if(status){row.status=status;row.reason=reason;}
        row.updatedAt=now();
        if(provisional)row.provisional=provisional;
        await store.write(member,all,runningHere);
        if(!runningHere())return false;
        if (goodId(sessionId)) job.sessionId=sessionId;
        if (providerTag) job.providerTag=providerTag;
        if (typeof open === 'function') job.open=open;
        notify(); return true;
      }).catch(()=>{throw Object.assign(new Error('WRITE'),{code:'WRITE'});});
      const hooks = {signal:controller.signal, checkpoint,
        session:(sessionId,providerTag)=>update('running',null,sessionId,null,null,providerTag),
        terminal:(open,reason='PERMISSION')=>update('terminal',reason,null,open),
        running:()=>update('running',null,null),
        provisional:answer=>typeof answer==='string' && answer.trim() && answer.length<=MAX_ANSWER
          ? update(null,null,null,null,answer) : Promise.resolve(false),
      };
      const sharesHistory=priorTask&&Boolean(priorTask.mailSearch)===Boolean(t.mailSearch);
      // 기능 줄은 세션을 남기지 않고 계정 번호로 기능의 파일을 찾는다(설계 검토 11)
      const spec = t.feature ? {id:t.id,provider:t.provider,feature:t.feature,trigger:t.trigger||'manual',departmentId:t.departmentId,member,cwd:''} :
        {id:t.id,provider:t.provider,cwd:ctx.cwd,role:ctx.role,prompt:t.prompt,sessionId:t.sessionId,
        previousId:sharesHistory?t.previousId:null,providerTag:t.providerTag,providerSalt:t.providerSalt ?? t.id};
      if(t.feature)hooks.changed=notify;
      const prepared=t.mailSearch?preparedPlans.get(k):null;
      if(t.mailSearch){
        const previous=t.mailInherited!==false&&t.previousId&&tasks.find(row=>row.id===t.previousId&&row.mailSearch);
        Object.assign(spec,{mailSearch:true,mailChoice:t.mailChoice===true,mailRetry:t.mailRetry===true,mailBindings:t.mailBindings,previousMail:!!previous});
        preparedPlans.delete(k);
        if(prepared)Object.assign(spec,{preparedMailPlan:prepared.plan,requireJudgedAccount:true,judgedAccountTag:prepared.accountTag,judgedAccountSalt:t.providerSalt||t.id,mailBindingVersion:prepared.version});
        else if(explicitVersion)spec.mailBindingVersion=explicitVersion;
        if(t.quoteHandoff){
          const last=tasks.find(r=>r.id===(t.quoteBatchParent||t.quoteResumeOf));
          const history=last?[last,...(t.quoteBatchParent?[]:tasks.filter(r=>r.quoteRoot===last.id&&r.status==='completed'))]:[];
          const positions=new Map();
          for(const scan of history)for(const group of scan.mailReceipt?.groups||[]){
            positions.set(group.provider,{provider:group.provider,cursor:group.cursor,
              binding:scan.mailReceipt.bindings.find(b=>b.provider===group.provider)?.id});
          }
          Object.assign(spec,{quoteHandoff:true,knownQuotes:new Set(tasks.filter(r=>r.quoteOrigin&&!quoteCards.needsScan(r,t.mailBindings||[])).map(r=>r.id))});
          if(t.quoteBatchParent||t.quoteResumeOf)spec.quoteBatch=true;
          if(last?.mailReceipt)spec.quoteContinuation={plan:last.mailReceipt.plan,groups:[...positions.values()].filter(g=>g.cursor)};
        }
        if(t.quoteOrigin){
          const scan=tasks.find(p=>p.id===(t.quoteRunFrom||t.quoteOrigin.parentId));
          Object.assign(spec,{quoteRecipient:true,quoteSource:quoteCards.sourceOf(t,tasks)?.item,role:'견적 담당',
            quoteAccountSalt:scan?.providerSalt||scan?.id,quoteAccountTag:scan?.providerTag,quoteAttempt:t.quoteAttempt});
        }
      }
      void Promise.resolve().then(async()=>{
        if (!await checkpoint()) throw Object.assign(new Error(),{code:'AUTH_CHANGED'});
        if(t.mailSearch){
          if(!mail)throw Object.assign(new Error(),{code:'MAIL_CONFIG'});
          const previous=spec.previousMail&&tasks.find(row=>row.id===t.previousId&&row.mailSearch);
          return mail.run(a,spec,hooks,(draft,protectedHooks)=>run(draft?{...spec,quoteDraft:draft}:spec,protectedHooks||hooks),previous?.mailReceipt,prepared?.excludedMailboxes,prepared?.omittedConditions);
        }
        return run(spec,hooks);
      }).then(value=>finish(value,null),err=>finish(null,errorCode(err),err?.review)).catch(()=>{});
      function changedMailbox(final){
        delete final.mailReceipt;final.answer='';
        if(t.mailDecision==='mailbox')requireSelection(final,'MAIL_CHANGED');
        else Object.assign(final,{status:'failed',reason:'MAIL_CHANGED'});
      }
      function interrupted(final){
        delete final.mailReceipt;
        if(final.mailDecision==='choose'){delete final.mailDecision;delete final.mailDecisionReason;}
        Object.assign(final,{status:'interrupted',reason:'AUTH_CHANGED',answer:''});
      }
      function finish(result,code,proposal) {
        return safe(async()=>{
          if (live.get(k)!==job || closed && same(a,closingAccount)) return;
          const final={...t,sessionId:job.sessionId,providerTag:job.providerTag,updatedAt:now()};
          let view;
          try {
            if (!await checkpoint()) { final.status='interrupted'; final.reason='AUTH_CHANGED'; }
            else if (code==='CANCELLED') { final.status='interrupted'; final.reason=code; }
            else if(t.mailSearch){
              if(t.mailDecision==='mailbox'&&['LOGIN','SESSION'].includes(code))requireSelection(final,code);
              else if(code==='MAIL_CHANGED')changedMailbox(final);
              else if(code==='MAIL_REVIEW'){
                if(!mail.atGeneration(member,spec.mailBindingVersion))changedMailbox(final);
                else if(!accountTagValid(job.providerTag)){final.status='failed';final.reason='LOGIN';}
                else if(!proposal||spec.preparedMailPlan){final.status='failed';final.reason='MAIL_PLAN';}
                else{
                  try{
                    proposal=reviewMissingMailboxes(proposal.plan,spec.mailBindings,t.prompt,proposal);
                    view=reviewView(t.prompt,proposal,priorTask?.mailReceipt);waitForReview(final);saveReview(final,view);
                  }
                  catch{final.status='failed';final.reason='MAIL_PLAN';}
                }
              }
              else if(code||!result?.mailReceipt){final.status='failed';final.reason=code||'MAIL_PLAN';}
              else if(!mail?.valid(result.mailReceipt.readBindings)||result.mailReceipt.mailBindingVersion&&!mail.atGeneration(member,result.mailReceipt.mailBindingVersion))changedMailbox(final);
              else{final.status='completed';final.reason=null;final.mailReceipt=result.mailReceipt;final.sessionId=result.sessionId;
                if(t.quoteOrigin)final.quoteState=result.mailReceipt.quoteOutcome;}
              final.answer='';
            }
            else if(t.feature){
              // 영수증의 원본은 기능의 파일이고, 업무 줄의 답은 그 한 문장 사본이다. 까닭 코드는 REASONS 안의 것만 쓴다
              final.sessionId=null;
              if(code){final.status='failed';final.reason=code;final.answer='';}
              else if(typeof result?.summary==='string'&&result.summary.trim()&&result.summary.length<=400){
                final.status='completed';final.reason=null;final.answer=result.summary;
                if(typeof result.ref==='string'&&/^\d{8}T\d{6}Z-[0-9a-f-]{36}$/.test(result.ref))final.featureRef=result.ref;
                final.featureAlert=result.alert===true;
              }else{final.status='failed';final.reason='NO_ANSWER';final.answer='';}
            }
            else if(t.provider==='codex' && (code==='MANUAL_RESULT' || result?.viaTerminal===true)){
              final.status='interrupted';final.reason='MANUAL_RESULT';final.answer='';final.viaTerminal=true;
            }
            else if (code || typeof result?.answer!=='string' || !result.answer.trim() || result.answer.length>MAX_ANSWER) {
              final.status='failed'; final.reason=code || (result?.answer?.length>MAX_ANSWER?'RESULT_TOO_LARGE':'NO_ANSWER');
            } else {
              const unconfirmed=result.unconfirmed;
              final.status=unconfirmed?'interrupted':'completed';
              final.reason=unconfirmed?'UNCONFIRMED':null;
              final.answer=result.answer; final.viaTerminal=result.viaTerminal===true;
              if (goodId(result.sessionId)) final.sessionId=result.sessionId;
            }
            const recipients=t.quoteHandoff && final.mailReceipt ? final.mailReceipt.groups.flatMap(g=>g.items.map(i=>i.id)) : [];
            const all=await rows(a,ownMail(recipients)), row=all.find(v=>v.id===t.id);
            if(row?.reason==='WRITE' && !row.answer)throw new Error('STORAGE');
            if (!row || !['running','terminal'].includes(row.status)) return;
            if(!runningHere())interrupted(final);
            delete row.provisional;
            Object.assign(row,final);
            if(row.status==='completed'&&final.mailReceipt)delete row.mailRoleReviewTag;
            if(final.reason==='MAIL_CHOOSE')requireSelection(row,final.mailDecisionReason);
            const added=quoteCards.addRecipients(all,row,now(),false);
            await store.write(member,all,()=>final.reason==='MAIL_REVIEW'?runningHere()&&mail.atGeneration(member,spec.mailBindingVersion):
              final.reason==='MAIL_CHOOSE'?runningHere():!final.answer&&!final.mailReceipt||runningHere()&&(!final.mailReceipt||mail.valid(final.mailReceipt.readBindings)&&mail.atGeneration(member,final.mailReceipt.mailBindingVersion)));
            if(final.reason==='MAIL_REVIEW'&&view)rememberReview(a,final,view,spec.mailBindingVersion);
            if(runningHere())for(const id of added)permits.set(key(member,id),a);
          }catch(e){
            if(!runningHere())interrupted(final);
            else if(t.mailSearch&&(e.code==='MAIL_CHANGED'||view&&!mail.atGeneration(member,spec.mailBindingVersion)))changedMailbox(final);
            if(!unsaved.has(member))unsaved.set(member,new Map());
            unsaved.get(member).set(t.id,{account:a,final});throw e;
          } finally { live.delete(k); permits.delete(k); notify(); const next=current();if(present(next))schedule(next); }
        });
      }
    }
  }
  async function actOnMailReview(a,row,tasks,actionName,request,plan){
    if(!mail||row.provider!=='codex'||row.status!=='failed'||row.reason!=='MAIL_REVIEW'||row.mailDecision!=='review')return problem('SESSION');
    const member=owner(a),k=key(member,row.id);
    const lease=mailReviews.get(k),version=mail.generation(a);
    const confirmed=actionName==='confirmMail';
    if(confirmed&&(!lease||lease.view.reviewId!==request.reviewId))return problem('SESSION');
    if(lease&&!same(lease.account,a))return problem('AUTH_CHANGED');
    if(lease&&lease.version!==version)return problem('MAIL_CHANGED');
    if(lease&&(lease.accountTag!==row.providerTag||lease.updatedAt!==row.updatedAt))return problem('SESSION');
    if(!accountTagValid(row.providerTag)||!goodId(row.providerSalt)||!goodId(row.sessionId))return problem('LOGIN');
    const parent=row.previousId&&tasks.find(t=>t.id===row.previousId);
    if(!reviewParentMatches(row,parent))return problem('SESSION');
    try{
      const active=await mail.bindings(a);
      if(!await allowed(a))return problem('AUTH_CHANGED');
      if(!mail.atGeneration(member,version)||!sameBindings(active,row.mailActiveIds)||!Array.isArray(row.mailBindings))return problem('MAIL_CHANGED');
      const receipt=parent?.mailSearch?await mail.vault.read(member,parent.id):null;
      if(parent?.mailSearch&&!receipt)return problem('MAIL_STORAGE');
      let ownReview;
      if(!confirmed&&!lease||row.mailRoleReviewTag!==undefined||lease?.view.roleChoices){
        ownReview=await mail.vault.read(member,row.id);
        if(!sameRoleRecord(row,ownReview)||lease?.view.roleChoices&&!row.mailRoleReviewTag)return problem('MAIL_STORAGE');
      }
      if(!await allowed(a))return problem('AUTH_CHANGED');
      if(!mail.atGeneration(member,version))return problem('MAIL_CHANGED');
      const previousBindings=receipt?.availableBindings||receipt?.bindings;
      if(receipt&&!Array.isArray(previousBindings))return problem('MAIL_STORAGE');
      const available=row.mailBindings.filter(b=>active.some(g=>g.id===b.id&&g.provider===b.provider)&&
        (!receipt||previousBindings.some(g=>sameMailAccount(g,b))));
      if(receipt&&!available.length)return problem('MAIL_CHANGED');
      if(!confirmed){
        const view=lease?{...lease.view,reviewId:randomUUID()}:readReview(row,ownReview,receipt);
        if(!await allowed(a))return problem('AUTH_CHANGED');
        if(!mail.atGeneration(member,version))return problem('MAIL_CHANGED');
        rememberReview(a,{...row,mailBindings:available},view,version);notify();
        return {ok:true,mailReview:structuredClone(mailReviews.get(k).view)};
      }
      const proposed=lease.view.filter;
      const needsPeriod=lease.view.reason==='period'||lease.view.requiresPeriodChoice===true;
      if(needsPeriod&&!proposed.after&&!proposed.before&&!plan.after&&!plan.before&&request.allowUnboundedPeriod!==true)return problem('MAIL_PLAN');
      const roleChoices=lease.view.roleChoices||[],decisions=request.roleDecisions||{};
      if(roleChoices.length!==Object.keys(decisions).length)return problem('MAIL_PLAN');
      const excludedMailboxes=confirmedMailExclusions(lease.view,available,receipt);
      const missingProviders=lease.view.missingProviders||excludedMailboxes.map(m=>m.provider);
      const omittedConditions=lease.view.reason==='unsupported'||roleChoices.length
        ?lease.view.unmet.filter(quote=>!missingProviders.some(id=>validMissingProviders([id],[quote]))):[];
      if(omittedConditions.length&&request.omitUnmet!==true)return problem('MAIL_PLAN');
      for(const {field,value,quote} of roleChoices){
        if(!Object.hasOwn(decisions,field))return problem('MAIL_PLAN');
        const action=decisions[field],actual=plan[field],base=proposed[field];
        if(action==='apply'&&actual!==value||action==='exclude'&&actual!==base)return problem('MAIL_PLAN');
        if(action==='edit'&&(!actual.trim()||[value,base].some(v=>v.toLowerCase()===actual.toLowerCase())))return problem('MAIL_PLAN');
        if(action!=='apply'&&!omittedConditions.includes(quote))omittedConditions.push(quote);
      }
      const selected=available.filter(b=>plan.provider==='all'||plan.provider===b.provider);
      if(!selected.length)return problem(receipt?'MAIL_CHANGED':'MAIL_CONNECT');
      // The edited filter exists only in the lease and prepared work until the encrypted result is committed.
      Object.assign(row,{status:'queued',reason:null,mailDecision:'confirmed',mailBindings:available,mailBindingVersion:version,judgedAccountTag:row.providerTag,updatedAt:now()});
      await store.write(member,tasks,()=>present(a)&&mail.atGeneration(member,version));
      mailReviews.delete(k);
      preparedPlans.set(k,{plan,accountTag:row.providerTag,version,memberSession:a,updatedAt:row.updatedAt,excludedMailboxes,
        ...(omittedConditions.length?{omittedConditions}:{})});
      permits.set(k,a);notify();
      if(!present(a)){schedulePark(a);return problem('AUTH_CHANGED');}
      schedule(a);
      if(!mail.atGeneration(member,version))return problem('MAIL_CHANGED');
      return {ok:true,id:row.id};
    }catch(error){
      if(!present(a))return problem('AUTH_CHANGED');
      if(!mail.atGeneration(member,version))return problem('MAIL_CHANGED');
      return problem(error?.code||'MAIL_STORAGE');
    }
  }
  function action(a,id,actionName,answer) {
    const reviewAction=actionName==='reviewMail'||actionName==='confirmMail';
    if (!goodId(id) || !reviewAction&&!['cancel','terminal','resume','saveAnswer'].includes(actionName)) return Promise.resolve(problem('VALUE'));
    if(actionName==='saveAnswer' && (typeof answer!=='string' || !answer.trim() || answer.length>MAX_ANSWER))return Promise.resolve(problem('VALUE'));
    let plan;
    if(actionName==='reviewMail'&&answer!==undefined)return Promise.resolve(problem('VALUE'));
    if(actionName==='confirmMail'){
      if(!answer||typeof answer!=='object'||Array.isArray(answer)||!Object.hasOwn(answer,'reviewId')||!goodId(answer.reviewId)||!Object.hasOwn(answer,'filter'))return Promise.resolve(problem('VALUE'));
      const choices=['allowUnboundedPeriod','omitUnmet'].filter(key=>Object.hasOwn(answer,key));
      const hasRoles=Object.hasOwn(answer,'roleDecisions'),roles=answer.roleDecisions;
      if(Object.keys(answer).length!==2+choices.length+Number(hasRoles)||choices.some(key=>typeof answer[key]!=='boolean'))return Promise.resolve(problem('VALUE'));
      if(hasRoles&&(!roles||typeof roles!=='object'||Array.isArray(roles)||!Object.keys(roles).length||
        Object.keys(roles).some(k=>!mailRoleFields.includes(k)||!mailRoleActions.includes(roles[k]))))return Promise.resolve(problem('VALUE'));
      try{plan=reviewFilter(answer.filter);}catch{return Promise.resolve(problem('MAIL_PLAN'));}
      answer={reviewId:answer.reviewId,...Object.fromEntries(choices.map(key=>[key,answer[key]])),...(hasRoles?{roleDecisions:{...roles}}:{})};
    }
    id=id.toLowerCase();
    return safe(async()=>{
      if(reviewAction&&!present(a))return problem('AUTH_CHANGED');
      if (!await allowed(a)) return problem('NOT_ALLOWED');
      const member=owner(a), k=key(member,id), tasks=await rows(a,new Set([id])), row=tasks.find(t=>t.id===id), job=live.get(k);
      if (!present(a)) return problem('AUTH_CHANGED');
      if (!row) return problem('NOT_FOUND');
      if((row.quoteOrigin||row.quoteHandoff)&&['terminal','saveAnswer'].includes(actionName))return problem('SESSION');
      if(row.feature&&actionName!=='cancel')return problem('SESSION');
      if(reviewAction)return actOnMailReview(a,row,tasks,actionName,answer,plan);
      if(actionName==='saveAnswer'){
        if(row.provider!=='codex')return problem('SESSION');
        if(row.reason==='MEMBER_RESULT'){
          if(row.answer!==answer)return problem('ID_CONFLICT');
        }else{
          if(row.reason!=='MANUAL_RESULT' || !['terminal','interrupted'].includes(row.status))return problem('SESSION');
          Object.assign(row,{answer,status:'interrupted',reason:'MEMBER_RESULT',viaTerminal:true,updatedAt:now()});
          try{await store.write(member,tasks,()=>present(a));}
          catch(error){
            if(!present(a))return problem('AUTH_CHANGED');
            const saved=(await store.read(member)).find(task=>task.id===id);
            if(saved?.reason!=='MEMBER_RESULT' || saved.answer!==answer)throw error;
          }
        }
        if(!present(a))return problem('AUTH_CHANGED');
        stopManual(member,id);notify();schedule(a);
        return {ok:true};
      }
      if (actionName==='terminal') {
        if (!same(job?.account,a) || !job?.open || !['running','terminal'].includes(row.status)) return problem('SESSION');
        return (await job.open())===true ? {ok:true} : problem('NATIVE');
      }
      if (actionName==='resume') {
        if (row.status!=='paused'&&!quoteCards.retryable(row)) return problem('SESSION');
        row.status='queued'; row.reason=null;
      } else {
        if (!['queued','paused','running','terminal'].includes(row.status)&&!(row.status==='failed'&&row.reason==='MAIL_REVIEW')) return problem('SESSION');
        job?.controller.abort();
        delete row.provisional;
        row.status='interrupted'; row.reason='CANCELLED';
      }
      if(actionName==='resume'){
        permits.set(k,a);
        if(row.mailDecision==='pending')row.mailBindingVersion=mail.generation(a);
      }else{permits.delete(k);preparedPlans.delete(k);mailReviews.delete(k);}
      row.updatedAt=now();
      try{await store.write(member,tasks);}catch(e){if(actionName==='resume')permits.delete(k);throw e;}
      if (!present(a)) { schedulePark(a); return problem('AUTH_CHANGED'); }
      notify(); schedule(a); return {ok:true};
    });
  }
  function schedulePark(a) {
    void safe(async()=>{
      const member=owner(a),tasks=await rows(a,new Set([...permits.keys(),...live.keys()].filter(k=>k.startsWith(member+'/')).map(k=>k.slice(member.length+1))));
      let dirty=false;
      for (const row of tasks) {
        const k=key(member,row.id);
        if (!same(permits.get(k),a) && !same(live.get(k)?.account,a)) continue;
        if (row.status==='queued') { row.status=row.feature?'interrupted':'paused'; dirty=true; }
        else if (['running','terminal'].includes(row.status)) { row.status='interrupted'; dirty=true; }
        else continue;
        row.reason=same(a,closingAccount) && row.reason==='MANUAL_RESULT'?'MANUAL_RESULT':'AUTH_CHANGED';
        const preview=row.provisional;
        if(same(a,closingAccount) && preview){
          row.answer=preview;row.reason='UNCONFIRMED';
        }
        delete row.provisional;
        row.updatedAt=now();permits.delete(k);preparedPlans.delete(k);
        if(closed)live.delete(k);
      }
      if (dirty) { await store.write(member,tasks); notify(); }
    });
  }
  function accountChanged(next) {
    mail?.accountChanged(next);
    for(const [k,review] of mailReviews)if(!same(review.account,next))mailReviews.delete(k);
    const old = new Set([...permits.values(), ...[...live.values()].map(j=>j.account)]);
    for (const a of old) if (!same(a,next)) {
      for (const job of live.values()) if (same(job.account,a)) job.controller.abort();
      schedulePark(a);
    }
  }
  function close() {
    if(closed)return;
    mail?.close();
    const a=current();
    closingAccount=present(a)?a:null;
    closed=true;preparedPlans.clear();accountChanged(null);
  }
  return {snapshot,submit,submitFeature,action,accountChanged,close,mail};
}
module.exports = {createOfficeTasks};
