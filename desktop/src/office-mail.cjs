'use strict';
const {randomUUID}=require('node:crypto');
const {ID:MEMBER}=require('./site-visits.cjs');
const {goodId}=require('./office-task-store.cjs');
const {fail,providers,current:checkSignal}=require('./office-mail-http.cjs');
const oauth=require('./office-mail-oauth.cjs');
const {searchMailbox,sourceUrl,combinePlan,reviewMissingMailboxes,searchScope}=require('./office-mail-api.cjs');
const {createMailVault,readMailClients}=require('./office-mail-vault.cjs');
const quotes=require('./office-quote-providers.cjs');
const {ungrounded,acknowledgement}=require('./office-quote-draft.cjs');
const same=(a,b)=>!!a&&!!b&&a.synk_user_id===b.synk_user_id&&a.sessionGeneration===b.sessionGeneration;
const problem=error=>({ok:false,code:typeof error?.code==='string'&&/^(MAIL_|CANCELLED|AUTH_CHANGED|NOT_ALLOWED)/.test(error.code)?error.code:'MAIL_NETWORK'});
function visibleReceipt(receipt) {
  return {scope:receipt.scope,...(receipt.omittedConditions?.length?{omittedConditions:receipt.omittedConditions}:{}),
    ...(receipt.outcome==='member-excluded'?{outcome:receipt.outcome,excludedMailboxes:receipt.excludedMailboxes}:{}),groups:receipt.groups.map(g=>({
    provider:g.provider,address:g.address,more:g.more===true,...(g.code?{code:g.code}:{}),
    ...(g.more===true&&receipt.plan&&!receipt.quoteHandoff&&!receipt.quoteOutcome?{page:g.page??0}:{}),
    ...(receipt.quoteHandoff?{checked:g.checked||0,review:g.review||0,drafts:g.drafts||0,eligibleCount:g.eligibleCount||0}:{}),
    items:g.items.map(({id,subject,from,date,snippet})=>({id,subject,from,date,snippet}))
  }))};
}
function summary(receipt) {
  const count=receipt.groups.reduce((sum,g)=>sum+g.items.length,0);
  const partial=receipt.groups.some(g=>g.code||g.more);
  let result=count?'조건에 맞는 메일 '+count+'건을 찾았습니다.':'조건에 맞는 메일이 없습니다.';
  if(partial)result=count?'확인한 범위에서 메일 '+count+'건을 화면에 표시했습니다.':'현재 표시할 메일은 없지만, 확인하지 못한 부분이 있어 찾는 메일이 없다고 단정할 수 없습니다.';
  if(Array.isArray(receipt.omittedConditions)&&receipt.omittedConditions.length){
    result+='\n'+receipt.omittedConditions.map(q=>'“'+q+'”').join(', ')+' 조건을 그대로 적용할 수 없어 회원이 선택한 범위에서 검색했습니다.';
  }
  if(receipt.outcome!=='member-excluded')return result;
  const names=receipt.excludedMailboxes.map(({provider,address})=>{
    const name=provider==='gmail'?'Gmail':'Outlook';return address?name+' ('+address+')':name;
  });
  return result+'\n회원이 '+names.join(', ')+' 메일함을 이번 검색에서 제외했습니다.';
}
function createOfficeMail({userData,secrets,current,authorized,openExternal,changed=()=>{},clients=readMailClients,vault=createMailVault(userData,secrets),
  fetch=globalThis.fetch,authorize=oauth.authorize,refresh=oauth.refreshGrant,search=searchMailbox,
  scanQuotes=quotes.scanQuotes,confirmQuote=quotes.confirmQuote}) {
  let queue=Promise.resolve(),closed=false;
  const pending=new Map(),pages=new Map(),refreshes=new Map(),revoked=new Set(),inUse=new Map(),versions=new Map();
  function bindingState(memberId){
    if(!versions.has(memberId))versions.set(memberId,{id:randomUUID(),controller:new AbortController()});
    return versions.get(memberId);
  }
  const generation=a=>bindingState(a.synk_user_id).id;
  const atGeneration=(memberId,expected)=>expected==null||versions.get(memberId)?.id===expected;
  function advanceBindings(memberId){
    const old=versions.get(memberId);versions.set(memberId,{id:randomUUID(),controller:new AbortController()});old?.controller.abort();
  }
  const serialize=work=>{const next=queue.then(work);queue=next.catch(()=>{});return next;};
  const member=a=>a?.synk_user_id;
  const present=a=>!closed&&MEMBER.test(member(a)||'')&&same(a,current());
  async function guard(a){if(!present(a)||!await authorized(a)||!present(a))throw fail('NOT_ALLOWED');}
  const valid=bindings=>bindings.length>0&&bindings.every(b=>!revoked.has(b.id));
  function invalidate(id){
    revoked.add(id);
    for(const controller of inUse.get(id)||[])controller.abort();
  }
  async function links(a) {
    const doc=await vault.read(member(a),null);
    if(!doc)return {};
    if(!doc.links||Object.entries(doc.links).some(([p,g])=>!providers.includes(p)||!g||!goodId(g.id)||!g.subject||!g.address||!g.refreshToken))throw fail('MAIL_STORAGE');
    return doc.links;
  }
  async function mutate(a,fn) {
    return serialize(async()=>{
      await guard(a);const all=await links(a);const change=fn(all);
      if(!change)return false;
      await guard(a);
      await vault.write(member(a),null,{links:all},()=>present(a),typeof change==='function'?change:undefined);
      changed();return true;
    });
  }
  async function snapshot(a){
    try {
      await guard(a);const conf=await clients(),all=await serialize(()=>links(a));await guard(a);
      return {providers:providers.map(id=>({id,configured:!!conf[id],connected:!!all[id],
        ...(all[id]?{address:all[id].address,reconnect:all[id].reconnect===true||all[id].clientId!==conf[id]?.id}:{})}))};
    }catch(e){return {providers:[],code:problem(e).code};}
  }
  async function connect(a,p) {
    const k=member(a)+'/'+p;
    let operation;
    try{
      await guard(a);if(!providers.includes(p))throw fail('MAIL_CONFIG');
      const client=(await clients())[p];if(!client)throw fail('MAIL_CONFIG');
      vault.secure();
      const old=(await serialize(()=>links(a)))[p];
      await guard(a);
      if(pending.has(k))throw fail('MAIL_BUSY');
      operation={account:a,controller:new AbortController()};pending.set(k,operation);
      const result=await authorize({provider:p,client,fetch,signal:operation.controller.signal,open:async url=>{await guard(a);if(operation.controller.signal.aborted)throw fail('MAIL_CANCELLED');await openExternal(url);}});
      await mutate(a,all=>{
        if(operation.controller.signal.aborted||all[p]?.id!==old?.id)throw fail('MAIL_CHANGED');
        if(old&&(old.subject!==result.subject||old.address.toLowerCase()!==result.address.toLowerCase()))throw fail('MAIL_CHANGED');
        // A successful reconnection replaces the generation. Old queued tasks cannot read a fresh grant.
        all[p]={...result,clientId:client.id,id:randomUUID(),lineage:old?.lineage||old?.id||randomUUID(),reconnect:false};
        return ()=>{advanceBindings(member(a));if(old)invalidate(old.id);};
      });
      return {ok:true};
    }catch(e){return problem(e);}finally{if(operation&&pending.get(k)===operation)pending.delete(k);}
  }
  async function disconnect(a,p){
    try{
      await guard(a);if(!providers.includes(p))throw fail('MAIL_CONFIG');
      const op=pending.get(member(a)+'/'+p);if(op&&same(a,op.account))op.controller.abort();
      await mutate(a,all=>{if(!all[p])return false;const old=all[p];delete all[p];return ()=>{advanceBindings(member(a));invalidate(old.id);};});
      return {ok:true};
    }catch(e){return problem(e);}
  }
  async function bindings(a){
    await guard(a);
    const all=await serialize(()=>links(a));await guard(a);
    return providers.filter(p=>all[p]).map(provider=>({provider,id:all[provider].id,lineage:all[provider].lineage||all[provider].id}));
  }
  async function getGrant(a,b,conf) {
    await guard(a);const g=(await serialize(()=>links(a)))[b.provider];
    if(!g||!goodId(b.id)||g.id!==b.id||revoked.has(b.id))throw fail('MAIL_CHANGED');
    if(!conf||conf.id!==g.clientId)throw fail('MAIL_CONFIG');
    if(g.reconnect)throw fail('MAIL_RECONNECT');
    return g;
  }
  async function refreshed(a,b,client,signal) {
    // Microsoft may rotate its refresh token. Serialize exchange and publication for each grant.
    const prior=refreshes.get(b.id)||Promise.resolve();
    const next=prior.catch(()=>{}).then(async()=>{
      if(signal.aborted)throw fail('CANCELLED');
      const grant=await getGrant(a,b,client);
      try {
        const result=await refresh({provider:b.provider,client,grant,fetch,signal});
        await mutate(a,all=>{if(revoked.has(b.id)||all[b.provider]?.id!==b.id)throw fail('MAIL_CHANGED');
          if(result.refreshToken===grant.refreshToken&&result.scope===grant.scope)return false;
          all[b.provider]={...grant,refreshToken:result.refreshToken,scope:result.scope};return true;});
        await getGrant(a,b,client);
        return {access:result.access,address:grant.address};
      }catch(e){
        if(['MAIL_RECONNECT','MAIL_SCOPE','MAIL_CHANGED'].includes(e.code))await mutate(a,all=>{
          if(all[b.provider]?.id!==b.id||all[b.provider].reconnect)return false;
          all[b.provider]={...all[b.provider],reconnect:true};return true;
        });
        throw e;
      }
    });
    refreshes.set(b.id,next);
    try{return await next;}finally{if(refreshes.get(b.id)===next)refreshes.delete(b.id);}
  }
  async function draftQuote(a,spec,hooks,planner){
    const b=spec.mailBindings?.[0],source=spec.quoteSource;
    if(!b||!source||source.id!==spec.id)throw fail('MAIL_CHANGED');
    const client=(await clients())[b.provider],grant=await getGrant(a,b,client);
    if((grant.lineage||grant.id)!==b.lineage)throw fail('MAIL_CHANGED');
    const use=new AbortController(),signal=AbortSignal.any([hooks.signal,use.signal]);
    if(!inUse.has(b.id))inUse.set(b.id,new Set());
    inUse.get(b.id).add(use);
    async function checkpoint(){
      await getGrant(a,b,client);
      if(signal.aborted||!await hooks.checkpoint())throw fail(use.signal.aborted?'MAIL_CHANGED':'CANCELLED');
      return true;
    }
    try{
      const token=await refreshed(a,b,client,signal);
      const ctx={provider:b.provider,...token,subject:grant.subject,fetch,signal,renew:()=>refreshed(a,b,client,signal)};
      const recheck=async()=>{
        await checkpoint();
        const result=await confirmQuote(ctx,source).catch(e=>{if(e.code==='MAIL_NOT_FOUND')return {state:'closed'};throw e;});
        await checkpoint();
        return result.state==='open'&&result.item.id===source.id?result.item:null;
      };
      const currentSource=await recheck();
      let draftText='',quoteOutcome='held';
      if(currentSource){
        draftText=await planner({subject:currentSource.subject,evidence:currentSource.evidence},{...hooks,signal,checkpoint});
        await checkpoint();
        if(typeof draftText!=='string'||draftText.length>2800||draftText!==''&&!draftText.trim())throw fail('MAIL_PLAN');
        if(draftText){
          if(ungrounded(draftText,currentSource.subject+' '+currentSource.evidence))draftText=acknowledgement(currentSource.evidence);
          if(await recheck())quoteOutcome='draft';
        }
      }
      if(quoteOutcome==='held')draftText='최근 답장과 문의 내용을 다시 확인했습니다. 지금 이 문의로 새 견적 답장을 작성할 근거가 없어 보류했습니다.';
      return {mailReceipt:{scope:'견적 답장 초안',groups:[],bindings:[b],readBindings:[b],quoteOutcome,draftText,
        ...(spec.quoteAttempt?{quoteAttempt:spec.quoteAttempt}:{})},sessionId:spec.id};
    }catch(e){if(use.signal.aborted)throw fail('MAIL_CHANGED');throw e;}
    finally{const set=inUse.get(b.id);set?.delete(use);if(!set?.size)inUse.delete(b.id);}
  }
  async function run(a,spec,hooks,planner,previous,excludedMailboxes,omittedConditions){
    if(!spec.mailBindingVersion)return readMail(a,spec,hooks,planner,previous,excludedMailboxes,omittedConditions);
    const version=bindingState(member(a));
    if(version.id!==spec.mailBindingVersion)throw fail('MAIL_CHANGED');
    const signal=AbortSignal.any([hooks.signal,version.controller.signal]);
    try{return await readMail(a,spec,{...hooks,signal},planner,previous,excludedMailboxes,omittedConditions);}
    finally{if(version.controller.signal.aborted)throw fail('MAIL_CHANGED');}
  }
  async function readMail(a,spec,hooks,planner,previous,excludedMailboxes,omittedConditions){
    await guard(a);checkSignal(hooks.signal);
    if(spec.quoteRecipient)return draftQuote(a,spec,hooks,planner);
    if(spec.mailChoice)throw fail('MAIL_CHOOSE');
    const selected=spec.mailBindings||[];
    if(!selected.length)throw fail(spec.previousMail?'MAIL_CHANGED':'MAIL_CONNECT');
    if(spec.mailRetry&&!previous?.groups?.some(g=>g.code))throw fail('MAIL_PLAN');
    let plan;
    if(spec.quoteBatch){
      if(!spec.quoteContinuation?.plan||!spec.providerTag)throw fail('MAIL_PLAN');
      plan=spec.quoteContinuation.plan;
      if(!await hooks.session(spec.id,spec.providerTag))throw fail('CANCELLED');
    }else if(spec.mailRetry){
      plan=previous.plan;
      if(!await hooks.session(spec.sessionId,spec.providerTag))throw fail('CANCELLED');
    }else{
      const requested=await planner();
      const missing=!spec.preparedMailPlan&&reviewMissingMailboxes(requested,selected,spec.prompt);
      if(missing)throw Object.assign(fail('MAIL_REVIEW'),{review:missing});
      plan=combinePlan(requested,previous?.plan);
    }
    checkSignal(hooks.signal);
    const targets=selected.filter(b=>plan.provider==='all'||plan.provider===b.provider);
    if(!targets.length)throw fail(spec.previousMail?'MAIL_CHANGED':'MAIL_CONNECT');
    const retainedGroup=b=>spec.mailRetry&&previous.groups.find(g=>g.provider===b.provider&&!g.code);
    const required=targets.filter(b=>!retainedGroup(b));
    const existing=await bindings(a);
    if(!required.every(b=>existing.some(g=>g.provider===b.provider&&g.id===b.id)))throw fail('MAIL_CHANGED');
    const conf=await clients(),groups=[];
    // A month-long search can be expanded days later. Keep its original upper time bound.
    const asOf=spec.mailRetry&&previous
      ?previous.asOf||(await vault.read(member(a),spec.previousId,{includeSearchTime:true}))?.asOf
      :new Date().toISOString();
    if(!asOf)throw fail('MAIL_STORAGE');
    let succeeded=0;
    for(const b of targets){
      if(!await hooks.checkpoint())throw fail('CANCELLED');
      checkSignal(hooks.signal);
      const retained=retainedGroup(b);
      if(retained){groups.push(retained);succeeded++;continue;}
      const all=await serialize(()=>links(a));const g=all[b.provider];
      if(g?.id!==b.id||revoked.has(b.id))throw fail('MAIL_CHANGED');
      const use=new AbortController(),signal=AbortSignal.any([hooks.signal,use.signal]);
      if(!inUse.has(b.id))inUse.set(b.id,new Set());
      inUse.get(b.id).add(use);
      try{
        const token=await refreshed(a,b,conf[b.provider],signal);
        const ctx={provider:b.provider,access:token.access,address:token.address,plan,fetch,signal,...(spec.quoteHandoff?{}:{asOf})};
        const last=spec.quoteContinuation;
        const start=last&&JSON.stringify(last.plan)===JSON.stringify(plan)&&last.groups.find(p=>p.provider===b.provider&&p.binding===b.id)?.cursor;
        const result=spec.quoteHandoff?await scanQuotes({...ctx,subject:g.subject,known:spec.knownQuotes,start,
          renew:()=>refreshed(a,b,conf[b.provider],signal)}):await search(ctx);
        groups.push({provider:b.provider,address:token.address,...result});
        if(!result.code||result.items.length||result.cursor&&(spec.quoteHandoff||result.more===true))succeeded++;
      }catch(e){
        if(use.signal.aborted)throw fail('MAIL_CHANGED');
        if(['CANCELLED','NOT_ALLOWED','AUTH_CHANGED','MAIL_CHANGED'].includes(e.code))throw e;
        groups.push({provider:b.provider,address:g.address,items:[],more:false,code:problem(e).code});
      }finally{
        const set=inUse.get(b.id);set?.delete(use);if(!set?.size)inUse.delete(b.id);
      }
    }
    if(!succeeded)throw fail(groups[0]?.code||'MAIL_NETWORK');
    if(!await hooks.checkpoint()||!valid(required))throw fail('MAIL_CHANGED');
    await guard(a);
    const excluded=spec.mailRetry?previous.excludedMailboxes:excludedMailboxes;
    const omitted=spec.mailRetry?previous.omittedConditions:omittedConditions;
    return {mailReceipt:{scope:searchScope(plan),groups,plan,bindings:targets,readBindings:required,availableBindings:selected,...(spec.quoteHandoff?{}:{asOf}),
      ...(excluded?.length?{outcome:'member-excluded',excludedMailboxes:excluded}:{}),...(omitted?.length?{omittedConditions:omitted}:{}),
      ...(spec.mailBindingVersion?{mailBindingVersion:spec.mailBindingVersion}:{}),...(spec.quoteHandoff?{quoteHandoff:true}:{})},sessionId:spec.previousMail?spec.sessionId:spec.id};
  }
  async function readPage(a,taskId,provider,expected,controller){
    const id=member(a),signal=controller.signal;
    const receipt=await vault.read(id,taskId,{includeSearchTime:true});
    if(!receipt?.plan||receipt.kind||receipt.quoteHandoff||receipt.quoteOutcome)throw fail('MAIL_NOT_FOUND');
    const binding=receipt.bindings?.find(b=>b.provider===provider);
    const group=receipt.groups?.find(g=>g.provider===provider);
    if(!binding||!group)throw fail('MAIL_NOT_FOUND');
    const client=(await clients())[provider],grant=await getGrant(a,binding,client);
    if(!group.address||grant.address.toLowerCase()!==group.address.toLowerCase()||
      (binding.lineage&&binding.lineage!==(grant.lineage||grant.id)))throw fail('MAIL_CHANGED');
    const page=group.page??0;
    if(!Number.isSafeInteger(page)||page<0||expected>page)throw fail('MAIL_CHANGED');
    await guard(a);checkSignal(signal);if(revoked.has(grant.id))throw fail('MAIL_CHANGED');
    if(expected<page||!group.more)return {ok:true};
    if(!inUse.has(grant.id))inUse.set(grant.id,new Set());
    inUse.get(grant.id).add(controller);
    try{
      const asOf=receipt.asOf;
      if(!asOf)throw fail('MAIL_STORAGE');
      const token=await refreshed(a,binding,client,signal);checkSignal(signal);
      const result=await search({provider,...token,plan:receipt.plan,asOf,previousItems:group.items,cursor:group.cursor,fetch,signal});
      // A candidate deleted since the last click is settled once the provider reports the end.
      const next=result?.more===false&&result.code==='MAIL_NOT_FOUND'?{...result,code:undefined}:result;
      if(!Array.isArray(next?.items)||next.items.length>10||typeof next.more!=='boolean')throw fail('MAIL_NETWORK');
      const moved=next.cursor!=null&&JSON.stringify(next.cursor)!==JSON.stringify(group.cursor);
      if(!next.items.length&&!moved&&(next.code||next.more))throw fail(next.code||'MAIL_NETWORK');
      if(next.more&&next.cursor==null)throw fail(next.code||'MAIL_NETWORK');
      return await serialize(async()=>{
        await guard(a);checkSignal(signal);
        const live=(await links(a))[provider];
        if(live?.id!==grant.id||live.reconnect||revoked.has(grant.id))throw fail('MAIL_CHANGED');
        await guard(a);
        const stillCurrent=()=>present(a)&&!signal.aborted&&!revoked.has(grant.id);
        if(!stillCurrent())throw fail('MAIL_CHANGED');
        if(await vault.appendPage(id,taskId,provider,expected,next,stillCurrent,asOf,()=>guard(a)))changed();
        return {ok:true};
      });
    }finally{
      const active=inUse.get(grant.id);active?.delete(controller);if(!active?.size)inUse.delete(grant.id);
    }
  }
  async function moreMail(a,taskId,provider,expected){
    try{
      await guard(a);
      if(!goodId(taskId)||!providers.includes(provider)||!Number.isSafeInteger(expected)||expected<0)throw fail('MAIL_NOT_FOUND');
      const key=member(a)+'/'+taskId+'/'+provider,active=pages.get(key);
      if(active&&same(a,active.account)){
        if(active.expected===expected)return await active.done;
        if(expected>active.expected)throw fail('MAIL_CHANGED');
        await active.done.catch(()=>{});
        return await moreMail(a,taskId,provider,expected);
      }
      const op={account:a,expected,controller:new AbortController()};
      pages.set(key,op);
      op.done=readPage(a,taskId,provider,expected,op.controller).finally(()=>{if(pages.get(key)===op)pages.delete(key);});
      return await op.done;
    }catch(e){return problem(e);}
  }
  async function openResult(a,taskId,itemId){
    try{
      await guard(a);if(!goodId(taskId)||!goodId(itemId))throw fail('MAIL_NOT_FOUND');
      const receipt=await vault.read(member(a),taskId);await guard(a);
      for(const g of receipt?.groups||[]){
        const item=g.items.find(i=>i.id===itemId);if(!item)continue;
        const url=sourceUrl(g.provider,g.address,item);if(!url)throw fail('MAIL_NOT_FOUND');
        if(!present(a))throw fail('AUTH_CHANGED');await openExternal(url);return {ok:true};
      }
      throw fail('MAIL_NOT_FOUND');
    }catch(e){return problem(e);}
  }
  function accountChanged(next){
    for(const operations of [pending,pages])for(const op of operations.values())if(!same(next,op.account))op.controller.abort();
  }
  return {vault,snapshot,connect,disconnect,bindings,generation,atGeneration,run,openResult,moreMail,valid,accountChanged,close(){closed=true;accountChanged(null);}};
}
module.exports={createOfficeMail,visibleReceipt,summary};
