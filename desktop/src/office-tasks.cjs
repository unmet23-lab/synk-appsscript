'use strict';
const { ID: MEMBER } = require('./site-visits.cjs');
const { createTaskStore, submission, publicTask, goodId, REASONS, MAX_ANSWER, MAX_TASKS, problem } = require('./office-task-store.cjs');

function createOfficeTasks({userData, current, authorized, context, run, changed = ()=>{}, now = Date.now, store = createTaskStore(userData)}) {
  let queue = Promise.resolve(), closed = false, closingAccount=null;
  const live = new Map(), recovered = new Set(), permits = new Map(), unsaved = new Map();
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
  function stopManual(member,id) {
    const k=key(member,id), job=live.get(k);
    if(!job || job.controller.signal.aborted)return;
    job.controller.abort();
    permits.delete(k);
  }
  async function rows(a) {
    const member = owner(a), tasks = await store.read(member);
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
            if(final.answer)answerOwner=account;
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
    if (!recovered.has(member)) {
      let dirty = false;
      for (const t of tasks) {
        if (!['queued','running','terminal'].includes(t.status)) continue;
        const manual=t.provider==='codex' && t.reason==='MANUAL_RESULT';
        t.status = t.status === 'queued' ? 'paused' : 'interrupted';
        t.reason = manual?'MANUAL_RESULT':'RESTART';
        if(t.status==='interrupted' && t.provisional){
          t.reason='UNCONFIRMED';t.answer=t.provisional;
        }
        delete t.provisional;
        t.updatedAt = now(); dirty = true;
      }
      if (dirty) await store.write(member,tasks,()=>present(a));
      recovered.add(member);
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
  function submit(a,input) {
    const data = submission(input);
    if (!data) return Promise.resolve(problem('VALUE'));
    return safe(async()=>{
      if (!await allowed(a)) return problem('NOT_ALLOWED');
      const member = owner(a), tasks = await rows(a);
      const existing = tasks.find(t=>t.id === data.id);
      if (existing) return present(a) && Object.keys(data).every(k=>data[k]===existing[k]) ? {ok:true,id:existing.id} : problem('ID_CONFLICT');
      if(tasks.length>=MAX_TASKS)return problem('STORAGE_FULL');
      const previous = data.previousId && tasks.find(t=>t.id===data.previousId);
      if (data.previousId && (!previous || previous.status!=='completed' || !previous.sessionId || previous.provider!==data.provider || previous.departmentId!==data.departmentId)) return problem('SESSION');
      const ctx = await context(a,data.departmentId);
      if (!ctx?.ok) return problem(ctx?.code || 'FOLDER');
      if (!await allowed(a)) return problem('AUTH_CHANGED');
      if (previous && (previous.cwd!==ctx.cwd || tasks.some(t=>t.sessionId===previous.sessionId && ['queued','running','terminal','paused'].includes(t.status)))) return problem('BUSY');
      const at = now();
      tasks.push({...data,departmentName:ctx.name,cwd:ctx.cwd,sessionId:previous?.sessionId ?? null,
        providerSalt:previous?.providerSalt ?? previous?.id ?? data.id,providerTag:previous?.providerTag ?? null,
        createdAt:at,updatedAt:at,status:'queued',reason:null,answer:''});
      permits.set(key(member,data.id),a);
      try{await store.write(member,tasks);}catch(e){permits.delete(key(member,data.id));throw e;}
      if (!present(a)) { schedulePark(a); return problem('AUTH_CHANGED'); }
      notify(); schedule(a);
      return {ok:true,id:data.id};
    });
  }
  // Access is rechecked after awaits and for every callback. Completion writes only to the captured member.
  function schedule(a) { void safe(()=>pump(a)); }
  async function pump(a) {
    if (!await allowed(a)) return;
    const member = owner(a), tasks = await rows(a);
    for (const t of tasks) {
      if (t.status!=='queued' || !same(a,permits.get(key(member,t.id)))) continue;
      const ctx = await context(a,t.departmentId);
      if (!await allowed(a)) return;
      if (!ctx?.ok || t.cwd!==ctx.cwd) {
        t.status='failed'; t.reason='FOLDER'; t.updatedAt=now();
        await store.write(member,tasks); permits.delete(key(member,t.id)); notify(); continue;
      }
      const running = [...live.values()].filter(r=>owner(r.account)===member);
      if (running.length >= ctx.cap) break;
      if (running.filter(r=>r.provider===t.provider).length >= (ctx.toolCaps?.[t.provider] ?? ctx.cap)) continue;
      if (t.sessionId && running.some(r=>r.sessionId===t.sessionId)) continue;
      const k = key(member,t.id), controller = new AbortController();
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
        const all = await rows(a), row = all.find(v=>v.id===t.id);
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
      const spec = {id:t.id,provider:t.provider,cwd:ctx.cwd,role:ctx.role,prompt:t.prompt,sessionId:t.sessionId,
        previousId:t.previousId,providerTag:t.providerTag,providerSalt:t.providerSalt ?? t.id};
      void Promise.resolve().then(async()=>{
        if (!await checkpoint()) throw Object.assign(new Error(),{code:'AUTH_CHANGED'});
        return run(spec,hooks);
      }).then(value=>finish(value,null),err=>finish(null,errorCode(err))).catch(()=>{});
      function finish(result,code) {
        return safe(async()=>{
          if (live.get(k)!==job || closed && same(a,closingAccount)) return;
          const final={...t,sessionId:job.sessionId,providerTag:job.providerTag,updatedAt:now()};
          try {
            if (!await checkpoint()) { final.status='interrupted'; final.reason='AUTH_CHANGED'; }
            else if (code==='CANCELLED') { final.status='interrupted'; final.reason=code; }
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
            const all=await rows(a), row=all.find(v=>v.id===t.id);
            if(row?.reason==='WRITE' && !row.answer)throw new Error('STORAGE');
            if (!row || !['running','terminal'].includes(row.status)) return;
            if(!runningHere())Object.assign(final,{status:'interrupted',reason:'AUTH_CHANGED',answer:''});
            delete row.provisional;
            Object.assign(row,final);
            await store.write(member,all,()=>!final.answer||runningHere());
          }catch(e){
            if(!runningHere())Object.assign(final,{status:'interrupted',reason:'AUTH_CHANGED',answer:''});
            if(!unsaved.has(member))unsaved.set(member,new Map());
            unsaved.get(member).set(t.id,{account:a,final});throw e;
          } finally { live.delete(k); permits.delete(k); notify(); const next=current();if(present(next))schedule(next); }
        });
      }
    }
  }
  function action(a,id,actionName,answer) {
    if (!goodId(id) || !['cancel','terminal','resume','saveAnswer'].includes(actionName)) return Promise.resolve(problem('VALUE'));
    if(actionName==='saveAnswer' && (typeof answer!=='string' || !answer.trim() || answer.length>MAX_ANSWER))return Promise.resolve(problem('VALUE'));
    id=id.toLowerCase();
    return safe(async()=>{
      if (!await allowed(a)) return problem('NOT_ALLOWED');
      const member=owner(a), k=key(member,id), tasks=await rows(a), row=tasks.find(t=>t.id===id), job=live.get(k);
      if (!present(a)) return problem('AUTH_CHANGED');
      if (!row) return problem('NOT_FOUND');
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
        if (row.status!=='paused') return problem('SESSION');
        row.status='queued'; row.reason=null;
      } else {
        if (!['queued','paused','running','terminal'].includes(row.status)) return problem('SESSION');
        job?.controller.abort();
        delete row.provisional;
        row.status='interrupted'; row.reason='CANCELLED';
      }
      if(actionName==='resume')permits.set(k,a);else permits.delete(k);
      row.updatedAt=now();
      try{await store.write(member,tasks);}catch(e){if(actionName==='resume')permits.delete(k);throw e;}
      if (!present(a)) { schedulePark(a); return problem('AUTH_CHANGED'); }
      notify(); schedule(a); return {ok:true};
    });
  }
  function schedulePark(a) {
    void safe(async()=>{
      const member=owner(a), tasks=await rows(a);
      let dirty=false;
      for (const row of tasks) {
        const k=key(member,row.id);
        if (!same(permits.get(k),a) && !same(live.get(k)?.account,a)) continue;
        if (row.status==='queued') { row.status='paused'; dirty=true; }
        else if (['running','terminal'].includes(row.status)) { row.status='interrupted'; dirty=true; }
        else continue;
        row.reason=same(a,closingAccount) && row.reason==='MANUAL_RESULT'?'MANUAL_RESULT':'AUTH_CHANGED';
        const preview=row.provisional;
        if(same(a,closingAccount) && preview){
          row.answer=preview;row.reason='UNCONFIRMED';
        }
        delete row.provisional;
        row.updatedAt=now();permits.delete(k);
        if(closed)live.delete(k);
      }
      if (dirty) { await store.write(member,tasks); notify(); }
    });
  }
  function accountChanged(next) {
    const old = new Set([...permits.values(), ...[...live.values()].map(j=>j.account)]);
    for (const a of old) if (!same(a,next)) {
      for (const job of live.values()) if (same(job.account,a)) job.controller.abort();
      schedulePark(a);
    }
  }
  function close() {
    if(closed)return;
    const a=current();
    closingAccount=present(a)?a:null;
    closed=true;accountChanged(null);
  }
  return {snapshot,submit,action,accountChanged,close};
}
module.exports = {createOfficeTasks};
