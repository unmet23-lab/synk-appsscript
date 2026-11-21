'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {randomUUID} = require('node:crypto');
const {setTimeout: delay} = require('node:timers/promises');
const {createOfficeTasks} = require('../src/office-tasks.cjs');
const {createTaskStore,commitFile} = require('../src/office-task-store.cjs');
const {enabled, employeeEnv, taskDirectory} = require('../src/office-task-runtime.cjs');

const memberA = {synk_user_id:'member_office_a',sessionGeneration:1};
const memberB = {synk_user_id:'member_office_b',sessionGeneration:1};
const request = (provider, prompt, fields = {}) => ({id:randomUUID(),provider,prompt, ...fields});

function deferred() {
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  return {promise,resolve};
}

async function eventually(read, why) {
  const end = Date.now()+4000;
  do {
    const result = await read();
    if (result) return result;
    await delay(8);
  } while (Date.now()<end);
  assert.fail(why);
}

async function setup(t, options={}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'solio-office-jobs-'));
  const {workRoot=root,storeIo,...serviceOptions}=options;
  const state = {account:memberA,authorized:true,cap:2,toolCaps:{claude:1,codex:1},department:true};
  const calls = [];
  const store = createTaskStore(root,storeIo);
  const service = createOfficeTasks({
    userData:root,store,current:()=>state.account,authorized:()=>state.authorized,
    context:async (a,id)=>{
      if (id && !state.department) return {ok:false,code:'FOLDER'};
      return {ok:true,cwd:path.join(workRoot,a.synk_user_id,id || 'office'),name:id || '사무실',role:id?'담당 역할':'',
        cap:state.cap,toolCaps:state.toolCaps};
    },
    run(spec,hooks) {
      return new Promise((resolve,reject)=>{calls.push({spec,hooks,resolve,reject});});
    },
    ...serviceOptions
  });
  const snap = async (a=state.account)=>{
    const result=await service.snapshot(a);
    assert.equal(result.ok,true,JSON.stringify(result));
    return result.tasks;
  };
  const row = async (id,wanted,a=state.account)=>eventually(async()=>{
    const job=(await snap(a)).find(item=>item.id===id);
    return job?.status===wanted && job;
  },'Missing job '+id+' in state '+wanted);
  const call = id=>eventually(()=>calls.find(item=>item.spec.id===id),'Missing fake CLI call for '+id);
  t.after(async()=>{
    service.close();
    for (const pending of calls) pending.resolve({});
    await service.snapshot(memberA);
    await service.snapshot(memberA);
    await fs.rm(root,{recursive:true,force:true});
  });
  return {root,state,calls,store,service,snap,row,call};
}

test('two employees return plain text to their own office task and the result survives reopening the ledger', async t=>{
  const f=await setup(t);
  const claude=request('claude','첫째 줄\n둘째 줄');
  const codex=request('codex','부서 요청',{departmentId:'dept_source'});
  for (const job of [claude,codex]) assert.deepEqual(await f.service.submit(memberA,job),{ok:true,id:job.id});
  const [one,two]=await Promise.all([f.call(claude.id),f.call(codex.id)]);
  assert.equal(one.spec.cwd,path.join(f.root,memberA.synk_user_id,'office'));
  assert.equal(one.spec.prompt,claude.prompt);
  assert.equal(two.spec.role,'담당 역할');
  assert.equal(two.spec.cwd,path.join(f.root,memberA.synk_user_id,'dept_source'));
  for (const job of [claude,codex]) assert.equal((await f.store.read(memberA.synk_user_id)).find(r=>r.id===job.id).status,'running');
  const firstSession=randomUUID(),secondSession=randomUUID();
  assert.equal(await one.hooks.session(firstSession),true);
  two.resolve({sessionId:secondSession,answer:'두 번째 업무의 답'});
  one.resolve({sessionId:firstSession,answer:'첫 줄\n<본문> & 끝'});
  const [a,b]=await Promise.all([f.row(claude.id,'completed'),f.row(codex.id,'completed')]);
  assert.equal(a.answer,'첫 줄\n<본문> & 끝');
  assert.equal(b.answer,'두 번째 업무의 답');
  for(const v of [a,b]) {
    assert.equal(v.reason,null);
    for(const field of ['cwd','sessionId','providerTag','providerSalt','role','env']) assert.ok(!(field in v));
  }
  const reopened=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.deepEqual(reopened.map(v=>[v.id,v.sessionId,v.answer]),[[claude.id,firstSession,a.answer],[codex.id,secondSession,b.answer]]);
});

test('simultaneous and repeated submission with the same id starts one CLI, including after completion', async t=>{
  const f=await setup(t), job=request('codex','한 번만');
  const responses=await Promise.all([f.service.submit(memberA,job),f.service.submit(memberA,{...job})]);
  assert.deepEqual(responses,[{ok:true,id:job.id},{ok:true,id:job.id}]);
  assert.deepEqual(await f.service.submit(memberA,{...job,prompt:'다른 업무'}),{ok:false,code:'ID_CONFLICT'});
  (await f.call(job.id)).resolve({answer:'완료',sessionId:randomUUID()});
  await f.row(job.id,'completed');
  assert.deepEqual(await f.service.submit(memberA,job),{ok:true,id:job.id});
  assert.equal(f.calls.length,1);
  assert.equal((await f.snap()).length,1);
});

test('a failed result write keeps the answer and the existing conversation, then saves it without running the CLI again', async t=>{
  const first=request('codex','이미 마친 요청');
  const next=request('codex','계속 진행',{previousId:first.id});
  let failWrites=true,attempts=0;
  const storeIo={...fs,commit:async (from,to,current)=>{
    if(failWrites && path.basename(path.dirname(to))==='answers' && path.parse(to).name===next.id) {
      attempts++;
      throw Object.assign(new Error('fixture disk full'),{code:'ENOSPC'});
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo});
  const session=randomUUID();
  assert.equal((await f.service.submit(memberA,first)).ok,true);
  (await f.call(first.id)).resolve({answer:'앞선 답',sessionId:session});
  await f.row(first.id,'completed');
  assert.equal((await f.service.submit(memberA,next)).ok,true);
  (await f.call(next.id)).resolve({answer:'저장을 기다리는 답',sessionId:session});
  await eventually(()=>attempts>0,'결과 파일 쓰기 실패가 발생하지 않음');
  const during=await f.service.snapshot(memberA);
  assert.equal(during.ok,true);
  const pending=during.tasks.find(item=>item.id===next.id);
  assert.equal(pending.reason,'WRITE');
  assert.equal(pending.answer,'저장을 기다리는 답');
  assert.equal(during.tasks.find(item=>item.id===first.id)?.answer,'앞선 답');
  failWrites=false;
  const recovered=await f.row(next.id,'completed');
  assert.equal(recovered.answer,'저장을 기다리는 답');assert.equal(recovered.viaTerminal,false);
  const reopened=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.deepEqual(reopened.map(row=>row.answer),['앞선 답','저장을 기다리는 답']);
  assert.equal(f.calls.length,2);
});

test('the provider cannot proceed when its new session cannot be recorded',async t=>{
  const session=randomUUID();
  const storeIo={...fs,commit:async (from,to,current)=>{
    if(path.basename(to)==='tasks.json' && (await fs.readFile(from,'utf8')).includes(session)) {
      throw Object.assign(new Error('fixture disk full'),{code:'ENOSPC'});
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo});
  const task=request('claude','등록 검증');
  assert.equal((await f.service.submit(memberA,task)).ok,true);
  const provider=await f.call(task.id);
  let proceeded=false;
  try { if(await provider.hooks.session(session)) proceeded=true; } catch {}
  assert.equal(proceeded,false,'writing the session failed but the provider was allowed to start');
  assert.equal((await f.store.read(memberA.synk_user_id))[0].sessionId,null);
});

test('reopening the ledger recovers the confirmed answer when the result file was saved but the index write failed',async t=>{
  let failIndex=false,failures=0;
  const storeIo={...fs,commit:async (from,to,current)=>{
    if(failIndex && path.basename(to)==='tasks.json') {
      failures++;
      throw Object.assign(new Error('fixture file is unavailable'),{code:'EBUSY'});
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo});
  const task=request('codex','결과 파일 저장 직후'),sessionId=randomUUID();
  await f.service.submit(memberA,task);
  const active=await f.call(task.id);
  assert.equal(await active.hooks.session(sessionId),true);
  failIndex=true;
  active.resolve({answer:'재시작 뒤에도 보존할 응답',sessionId});
  await eventually(()=>failures>0,'목록의 마지막 저장이 실패하지 않음');
  const reopened=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.equal(reopened.length,1);
  const [row]=reopened;
  assert.equal(row.id,task.id);assert.equal(row.status,'completed');assert.equal(row.reason,null);
  assert.equal(row.answer,'재시작 뒤에도 보존할 응답');assert.equal(row.sessionId,sessionId);
  assert.equal(row.viaTerminal,false);
  assert.equal(f.calls.length,1);
  failIndex=false;
});

test('UUID case variants cannot start a different task or overwrite its stored answer on Windows',async t=>{
  const f=await setup(t);
  const first=request('codex','원래 요청',{id:'a1bcdef0-1234-4321-9876-aabbccddeeff'});
  await f.service.submit(memberA,first);
  (await f.call(first.id)).resolve({answer:'원본 답변',sessionId:randomUUID()});
  await f.row(first.id,'completed');
  const variant=await f.service.submit(memberA,{...first,id:first.id.toUpperCase(),prompt:'별도 업무'});
  assert.equal(variant.ok,false);
  assert.deepEqual((await f.store.read(memberA.synk_user_id)).map(x=>x.answer),['원본 답변']);
  assert.equal(f.calls.length,1);
});

test('a result that failed to save during an account change cannot appear as completed in the new login',async t=>{
  const job=request('claude','이전 회차');
  const saving=deferred(),proceed=deferred();
  let reached=false;
  const storeIo={...fs,commit:async(from,to,current)=>{
    if(!reached && path.parse(to).name===job.id && path.basename(path.dirname(to))==='answers') {
      reached=true;saving.resolve();await proceed.promise;
      throw Object.assign(new Error('fixture result not committed'),{code:'EBUSY'});
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo});
  await f.service.submit(memberA,job);
  (await f.call(job.id)).resolve({answer:'이전 회차의 보류 답',sessionId:randomUUID()});
  await saving.promise;
  const again={...memberA,sessionGeneration:2};
  f.state.account=again;f.service.accountChanged(again);proceed.resolve();
  const row=await f.row(job.id,'interrupted',again);
  assert.equal(row.answer,'');assert.equal(row.reason,'AUTH_CHANGED');
  assert.equal((await f.store.read(memberA.synk_user_id))[0].answer,'');
});

test('changing the login just before the answer receipt commit hides a stale result on its first save and on retry',async t=>{
  for(const retry of [false,true]) {
    await t.test(retry?'retrying the result receipt':'first result receipt',async t=>{
      const task=request('codex','회차가 바뀌는 순간');
      const entered=deferred(),release=deferred();
      let receiptAttempts=0,pauseOnce=true;
      const storeIo={...fs,commit:async(from,to,stillCurrent)=>{
        const receipt=path.basename(path.dirname(to))==='answers' && path.parse(to).name===task.id;
        if(receipt)receiptAttempts++;
        if(retry && receipt && receiptAttempts===1) {
          throw Object.assign(new Error('fixture storage temporarily unavailable'),{code:'EBUSY'});
        }
        const pause=receipt && receiptAttempts===(retry?2:1);
        if(pauseOnce && pause) {pauseOnce=false;entered.resolve();await release.promise;}
        return commitFile(from,to,stillCurrent);
      }};
      const f=await setup(t,{storeIo});
      await f.service.submit(memberA,task);
      (await f.call(task.id)).resolve({answer:'확정 전에 끝난 회차의 답',sessionId:randomUUID()});
      await entered.promise;
      const current={...memberA,sessionGeneration:2};
      f.state.account=current;f.service.accountChanged(current);release.resolve();
      const after=await f.row(task.id,'interrupted',current);
      assert.equal(after.reason,'AUTH_CHANGED');assert.equal(after.answer,'');
      const disk=await createTaskStore(f.root).read(memberA.synk_user_id);
      assert.equal(disk[0].status,'interrupted');assert.equal(disk[0].answer,'');
      assert.equal(f.calls.length,1);
    });
  }
});

test('a valid answer receipt belongs to the member if they log out while only its index is still pending',async t=>{
  const task=request('claude','적법한 확정 뒤 로그아웃');
  const indexing=deferred(),release=deferred();
  let paused=false;
  const storeIo={...fs,commit:async(from,to,stillCurrent)=>{
    if(!paused && path.basename(to)==='tasks.json'){
      const {tasks}=JSON.parse(await fs.readFile(from,'utf8'));
      if(tasks.some(row=>row.id===task.id && row.answerFile && row.status==='completed')){
        paused=true;indexing.resolve();await release.promise;
      }
    }
    return commitFile(from,to,stillCurrent);
  }};
  const f=await setup(t,{storeIo}),sessionId=randomUUID();
  await f.service.submit(memberA,task);
  (await f.call(task.id)).resolve({answer:'이미 적법하게 저장된 답',sessionId});
  await indexing.promise;
  f.state.account=memberB;f.service.accountChanged(memberB);release.resolve();
  assert.deepEqual(await f.snap(memberB),[]);
  const back={...memberA,sessionGeneration:3};
  f.state.account=back;f.service.accountChanged(back);
  const saved=await f.row(task.id,'completed',back);
  assert.equal(saved.answer,'이미 적법하게 저장된 답');
  const reopened=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.equal(reopened[0].status,'completed');assert.equal(reopened[0].sessionId,sessionId);
  assert.equal(f.calls.length,1);
});

test('a login change during queue resume returns the task to a resumable state',async t=>{
  const task=request('codex','대기 회차');
  let pauseNextWrite=false;
  const writing=deferred(),release=deferred();
  const storeIo={...fs,commit:async(from,to,current)=>{
    if(pauseNextWrite && path.basename(to)==='tasks.json') {
      const index=JSON.parse(await fs.readFile(from,'utf8'));
      if(index.tasks.some(row=>row.id===task.id && row.status==='queued')) {
        pauseNextWrite=false;writing.resolve();await release.promise;
      }
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo}); f.state.cap=0;
  await f.service.submit(memberA,task);await f.row(task.id,'queued');
  const second={...memberA,sessionGeneration:2},third={...memberA,sessionGeneration:3};
  f.state.account=second;f.service.accountChanged(second);
  await f.row(task.id,'paused',second);
  pauseNextWrite=true;
  const resuming=f.service.action(second,task.id,'resume');
  await writing.promise;
  f.state.account=third;f.service.accountChanged(third);release.resolve();
  assert.equal((await resuming).ok,false);
  await f.row(task.id,'paused',third);
  f.state.cap=1;
  assert.equal((await f.service.action(third,task.id,'resume')).ok,true);
  const run=await f.call(task.id);
  run.resolve({answer:'현재 회원이 다시 맡긴 답',sessionId:randomUUID()});
  assert.equal((await f.row(task.id,'completed',third)).answer,'현재 회원이 다시 맡긴 답');
  assert.equal(f.calls.length,1);
});

test('a previous login releasing the only employee slot wakes the current login queue',async t=>{
  const f=await setup(t);f.state.cap=1;
  const old=request('claude','이전 업무'),next=request('claude','새 업무');
  await f.service.submit(memberA,old);
  const previousRun=await f.call(old.id);
  const again={...memberA,sessionGeneration:2};
  f.state.account=again;f.service.accountChanged(again);
  assert.equal((await f.service.submit(again,next)).ok,true);
  await f.row(next.id,'queued',again);
  previousRun.resolve({answer:'늦은 답',sessionId:randomUUID()});
  const nowRunning=await f.call(next.id);
  nowRunning.resolve({answer:'새 회차의 답',sessionId:randomUUID()});
  assert.equal((await f.row(next.id,'completed',again)).answer,'새 회차의 답');
  assert.equal((await f.row(old.id,'interrupted',again)).answer,'');
});

test('one temporary index read failure while the CLI completes cannot lose the answer or leave the task running',async t=>{
  let failNextRead=false;
  const failed=deferred();
  const storeIo={...fs,readFile:async(file,...args)=>{
    if(failNextRead && path.basename(file)==='tasks.json') {
      failNextRead=false;failed.resolve();
      throw Object.assign(new Error('fixture index temporarily locked'),{code:'EBUSY'});
    }
    return fs.readFile(file,...args);
  }};
  const f=await setup(t,{storeIo}),task=request('codex','저장 전 일시 읽기 오류');
  await f.service.submit(memberA,task);
  const run=await f.call(task.id);
  failNextRead=true;run.resolve({answer:'이미 받은 답',sessionId:randomUUID()});
  await failed.promise;
  assert.equal((await f.row(task.id,'completed')).answer,'이미 받은 답');
  assert.equal(f.calls.length,1);
});

test('a delayed previous generation cannot discard a current generation result waiting for storage',async t=>{
  const saving=deferred(),release=deferred();
  let failNextRead=false;
  const storeIo={...fs,readFile:async(file,...args)=>{
    if(failNextRead && path.basename(file)==='tasks.json') {
      failNextRead=false;saving.resolve();await release.promise;
      throw Object.assign(new Error('fixture index temporarily locked'),{code:'EBUSY'});
    }
    return fs.readFile(file,...args);
  }};
  const f=await setup(t,{storeIo});
  const old=request('claude','이전 회차의 일'),fresh=request('codex','현재 회차의 일');
  await f.service.submit(memberA,old);
  const previousRun=await f.call(old.id);
  const current={...memberA,sessionGeneration:2};
  f.state.account=current;f.service.accountChanged(current);
  await f.service.submit(current,fresh);
  const currentRun=await f.call(fresh.id);
  failNextRead=true;
  currentRun.resolve({answer:'현재 회차가 받아 둔 답',sessionId:randomUUID()});
  await saving.promise;
  previousRun.resolve({answer:'지난 회차의 늦은 답',sessionId:randomUUID()});
  await new Promise(done=>setImmediate(done));
  release.resolve();
  assert.equal((await f.row(fresh.id,'completed',current)).answer,'현재 회차가 받아 둔 답');
  const stale=await f.row(old.id,'interrupted',current);
  assert.equal(stale.reason,'AUTH_CHANGED');assert.equal(stale.answer,'');
  assert.equal(f.calls.length,2);
});

test('the queue keeps provider order, allows the other provider capacity and rechecks deleted departments', async t=>{
  const f=await setup(t);
  const first=request('claude','먼저'), deleted=request('claude','부서',{departmentId:'dept_work'});
  const waiting=request('claude','다음'), other=request('codex','독립 직원');
  for(const job of [first,deleted,waiting,other]) assert.equal((await f.service.submit(memberA,job)).ok,true);
  await f.call(first.id);
  await f.call(other.id);
  assert.deepEqual(f.calls.map(c=>c.spec.id),[first.id,other.id]);
  assert.equal((await f.row(deleted.id,'queued')).canOpenTerminal,false);
  f.state.department=false;
  f.calls[0].resolve({answer:'첫째 완료',sessionId:randomUUID()});
  assert.equal((await f.row(deleted.id,'failed')).reason,'FOLDER');
  const next=await f.call(waiting.id);
  next.resolve({answer:'셋째 완료',sessionId:randomUUID()});
  await f.row(waiting.id,'completed');
  assert.ok(!f.calls.some(c=>c.spec.id===deleted.id));
});

test('follow-up can continue only its completed owner, provider, department and available session', async t=>{
  const f=await setup(t);
  const root=request('claude','시작',{departmentId:'dept_work'}), session=randomUUID();
  await f.service.submit(memberA,root);
  const previous=await f.call(root.id);
  const tag='a'.repeat(64);
  assert.equal(previous.spec.providerSalt,root.id);
  assert.equal(await previous.hooks.session(session,tag),true);
  const child=request('claude','잇기',{previousId:root.id,departmentId:'dept_work'});
  assert.equal((await f.service.submit(memberA,child)).code,'SESSION');
  previous.resolve({answer:'앞 답',sessionId:session}); await f.row(root.id,'completed');
  assert.equal((await f.service.submit(memberA,{...child,provider:'codex'})).code,'SESSION');
  assert.equal((await f.service.submit(memberA,{...child,departmentId:null})).code,'SESSION');
  assert.deepEqual(await f.service.submit(memberA,child),{ok:true,id:child.id});
  assert.deepEqual(await f.service.submit(memberA,{...child,id:randomUUID()}),{ok:false,code:'BUSY'});
  const follow=await f.call(child.id);
  assert.equal(follow.spec.sessionId,session);
  assert.equal(follow.spec.previousId,root.id);
  assert.equal(follow.spec.providerSalt,root.id);
  assert.equal(follow.spec.providerTag,tag);
  assert.equal((await createTaskStore(f.root).read(memberA.synk_user_id))[0].providerTag,tag);
  follow.resolve({answer:'후속 답',sessionId:session});
  await f.row(child.id,'completed');
  assert.equal((await f.row(root.id,'completed')).answer,'앞 답');
  f.state.account=memberB;f.service.accountChanged(memberB);
  assert.equal((await f.service.submit(memberB,{...child,id:randomUUID()})).code,'SESSION');
});

test('an earlier member or login generation cannot deliver a late answer, act on the new terminal, or restart work', async t=>{
  for (const next of [memberB,{...memberA,sessionGeneration:2}]) {
    await t.test(next===memberB?'different member':'same member signed in again',async t=>{
      const f=await setup(t);
      const old=request('claude','먼저 회원의 요청');
      await f.service.submit(memberA,old);
      const first=await f.call(old.id);
      let focused=0;
      assert.equal(await first.hooks.terminal(async()=>{focused++;return true;}),true);
      assert.equal((await f.row(old.id,'terminal')).canOpenTerminal,true);
      f.state.account=next;f.service.accountChanged(next);
      assert.equal(first.hooks.signal.aborted,true);
      assert.equal(await first.hooks.checkpoint(),false);
      assert.equal((await f.service.snapshot(memberA)).ok,false);
      assert.equal((await f.service.action(memberA,old.id,'terminal')).ok,false);
      const fresh=request('codex','현재 회원의 요청',next===memberB ? {id:old.id} : {});
      assert.equal((await f.service.submit(next,fresh)).ok,true);
      const second=await eventually(()=>f.calls.find(item=>item.spec.id===fresh.id && item!==first),'새 로그인 회차의 실행');
      assert.equal(await first.hooks.running(),false);
      first.resolve({sessionId:randomUUID(),answer:'이전 회차의 늦은 답'});
      second.resolve({sessionId:randomUUID(),answer:'현재 회차의 답'});
      assert.equal((await f.row(fresh.id,'completed',next)).answer,'현재 회차의 답');
      const oldDisk=(await f.store.read(memberA.synk_user_id)).find(item=>item.id===old.id);
      assert.equal(oldDisk.status,'interrupted');assert.equal(oldDisk.reason,'AUTH_CHANGED');assert.equal(oldDisk.answer,'');
      assert.ok((await f.snap(next)).every(v=>v.answer!=='이전 회차의 늦은 답'));
      assert.equal(focused,0);assert.equal(f.calls.length,2);
    });
  }
});

test('logout and cancellation keep queued and running jobs from accepting a provider result', async t=>{
  const f=await setup(t); f.state.cap=1;
  const a=request('claude','취소'), b=request('codex','대기');
  await f.service.submit(memberA,a);await f.service.submit(memberA,b);
  const active=await f.call(a.id);
  assert.deepEqual(await f.service.action(memberA,b.id,'cancel'),{ok:true});
  assert.deepEqual(await f.service.action(memberA,a.id,'cancel'),{ok:true});
  assert.equal(active.hooks.signal.aborted,true);
  active.resolve({answer:'취소 뒤의 답',sessionId:randomUUID()});
  assert.equal((await f.row(a.id,'interrupted')).reason,'CANCELLED');
  assert.equal((await f.row(b.id,'interrupted')).answer,'');
  const c=request('claude','로그아웃'), d=request('codex','앞 회원의 대기');
  await f.service.submit(memberA,c);await f.service.submit(memberA,d);
  const leaving=await f.call(c.id);
  f.state.account=null; f.service.accountChanged(null);
  assert.equal(leaving.hooks.signal.aborted,true);
  leaving.resolve({answer:'로그아웃 뒤의 답',sessionId:randomUUID()});
  const back={...memberA,sessionGeneration:3};
  f.state.account=back;f.service.accountChanged(back);
  assert.equal((await f.row(c.id,'interrupted',back)).answer,'');
  assert.equal((await f.row(d.id,'paused',back)).reason,'AUTH_CHANGED');
  assert.equal(f.calls.length,2);
});

test('restart marks prior running work interrupted and starts old queued work once only after the member resumes it', async t=>{
  const old=await setup(t); old.state.cap=1;
  const running=request('claude','작업 중'),queued=request('codex','기다림');
  await old.service.submit(memberA,running);await old.service.submit(memberA,queued);
  await old.call(running.id);await old.row(queued.id,'queued');
  const f=await setup(t,{workRoot:old.root});
  await f.store.write(memberA.synk_user_id,await old.store.read(memberA.synk_user_id));
  assert.equal((await f.row(running.id,'interrupted')).reason,'RESTART');
  assert.equal((await f.row(queued.id,'paused')).reason,'RESTART');
  assert.equal(f.calls.length,0);
  assert.deepEqual(await f.service.action(memberA,queued.id,'resume'),{ok:true});
  assert.equal((await f.service.action(memberA,queued.id,'resume')).ok,false);
  const launch=await f.call(queued.id);
  launch.resolve({answer:'재개 완료',sessionId:randomUUID()});
  await f.row(queued.id,'completed');
  assert.deepEqual(f.calls.map(c=>c.spec.id),[queued.id]);
});

test('broken local task data cannot be overwritten by submitting a new job', async t=>{
  const f=await setup(t), saved=request('codex','손상 시험의 표식');
  await f.service.submit(memberA,saved);
  (await f.call(saved.id)).resolve({answer:'원래 답',sessionId:randomUUID()});
  await f.row(saved.id,'completed');
  const files=await fs.readdir(f.root,{recursive:true});
  let ledger;
  for(const relative of files.filter(file=>file.endsWith('.json'))) {
    const candidate=path.join(f.root,relative);
    if ((await fs.readFile(candidate,'utf8')).includes(saved.prompt)) {ledger=candidate;break;}
  }
  assert.ok(ledger);
  const bytes='{"fixture":"저장하다 끊김"';
  await fs.writeFile(ledger,bytes);
  assert.deepEqual(await f.service.snapshot(memberA),{ok:false,code:'STORAGE'});
  assert.deepEqual(await f.service.submit(memberA,request('codex','새 일')),{ok:false,code:'STORAGE'});
  assert.equal(await fs.readFile(ledger,'utf8'),bytes);
  assert.equal(f.calls.length,1);
});

test('a completed task saved by the previous Windows build keeps its text answer and can coexist with a new receipt',async t=>{
  const f=await setup(t),legacy=request('codex','구판 업무'),sessionId=randomUUID();
  const dir=path.join(f.root,'Office',memberA.synk_user_id),answers=path.join(dir,'answers');
  await fs.mkdir(answers,{recursive:true});
  const original='구판 첫 줄\n둘째 줄 & 원문';
  const old={...legacy,previousId:null,departmentId:null,departmentName:'사무실',cwd:f.root,
    sessionId,status:'completed',reason:null,createdAt:10,updatedAt:20,answer:'',answerFile:true};
  await fs.writeFile(path.join(answers,legacy.id+'.txt'),original);
  await fs.writeFile(path.join(dir,'tasks.json'),JSON.stringify({version:1,tasks:[old]}));
  assert.equal((await f.row(legacy.id,'completed')).answer,original);
  const fresh=request('claude','신판 업무');
  assert.equal((await f.service.submit(memberA,fresh)).ok,true);
  (await f.call(fresh.id)).resolve({answer:'새로 저장한 답',sessionId:randomUUID()});
  await f.row(fresh.id,'completed');
  const persisted=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.deepEqual(persisted.map(row=>row.answer),[original,'새로 저장한 답']);
  assert.equal(f.calls.length,1);
});

test('an unconfirmed Claude message stays readable after restarting but cannot start a follow-up conversation',async t=>{
  const f=await setup(t),task=request('claude','공식 응답 종료 확인');
  await f.service.submit(memberA,task);
  (await f.call(task.id)).resolve({answer:'공식 창에서 확인한 본문',sessionId:randomUUID(),unconfirmed:true});
  const row=await f.row(task.id,'interrupted');
  assert.equal(row.reason,'UNCONFIRMED');
  assert.equal(row.answer,'공식 창에서 확인한 본문');
  const restore=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.equal(restore[0].status,'interrupted');assert.equal(restore[0].reason,'UNCONFIRMED');
  assert.equal(restore[0].answer,row.answer);
  const next=request('claude','같은 대화에 잇기',{previousId:task.id});
  assert.equal((await f.service.submit(memberA,next)).code,'SESSION');
  assert.equal(f.calls.length,1);
});

test('Codex accepts only the owner-selected text for a manual handoff and never stores the separate terminal reply',async t=>{
  for(const closed of [false,true])await t.test(closed?'after the terminal closes':'while the terminal is open',async t=>{
    const f=await setup(t),task=request('codex','파일 확인'),answer='회원이 터미널에서 복사한 글\n둘째 줄';
    await f.service.submit(memberA,task);
    const job=await f.call(task.id);
    await job.hooks.terminal(async()=>true,'PERMISSION');
    assert.equal((await f.service.action(memberA,task.id,'saveAnswer',answer)).code,'SESSION');
    await job.hooks.terminal(async()=>true,'MANUAL_RESULT');
    if(closed){
      job.resolve({answer:'다른 터미널의 원문',viaTerminal:true});
      const ended=await f.row(task.id,'interrupted');
      assert.equal(ended.reason,'MANUAL_RESULT');assert.equal(ended.answer,'');
      assert.equal((await f.store.read(memberA.synk_user_id))[0].answer,'');
    }
    assert.equal((await f.service.action(memberB,task.id,'saveAnswer',answer)).code,'NOT_ALLOWED');
    for(const invalid of ['  ','x'.repeat(524289),null])assert.equal((await f.service.action(memberA,task.id,'saveAnswer',invalid)).code,'VALUE');
    assert.equal((await f.service.action(memberA,task.id,'saveAnswer',answer)).ok,true);
    assert.equal((await f.service.action(memberA,task.id,'saveAnswer',answer)).ok,true);
    assert.equal((await f.service.action(memberA,task.id,'saveAnswer','다른 글')).code,'ID_CONFLICT');
    const visible=(await f.snap()).find(row=>row.id===task.id),[saved]=await createTaskStore(f.root).read(memberA.synk_user_id);
    assert.equal(visible.reason,'MEMBER_RESULT');assert.equal(visible.answer,answer);assert.equal(visible.status,'interrupted');
    assert.equal(saved.answer,answer);assert.equal(saved.reason,'MEMBER_RESULT');
    assert.equal((await f.service.submit(memberA,request('codex','자동 이어가기',{previousId:task.id}))).code,'SESSION');
    assert.equal(f.calls.length,1);
  });
});

test('a committed member answer frees the GPT slot even when the index write fails once',async t=>{
  let lockIndex=false;
  const storeIo={...fs,commit:async(from,to,current)=>{
    if(lockIndex && path.basename(to)==='tasks.json'){
      lockIndex=false;throw Object.assign(new Error('locked'),{code:'EBUSY'});
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo}),first=request('codex','승인한 업무'),next=request('codex','대기 중인 업무');
  await f.service.submit(memberA,first);
  const job=await f.call(first.id);
  await job.hooks.terminal(async()=>true,'MANUAL_RESULT');
  job.hooks.signal.addEventListener('abort',()=>job.reject(Object.assign(new Error('CANCELLED'),{code:'CANCELLED'})),{once:true});
  await f.service.submit(memberA,next);
  lockIndex=true;
  await f.service.action(memberA,first.id,'saveAnswer','직접 옮긴 글');
  assert.equal((await f.service.action(memberA,first.id,'saveAnswer','직접 옮긴 글')).ok,true);
  assert.equal(job.hooks.signal.aborted,true);
  assert.equal((await f.row(first.id,'interrupted')).answer,'직접 옮긴 글');
  (await f.call(next.id)).resolve({answer:'다음 답',sessionId:randomUUID()});
  await f.row(next.id,'completed');
});

test('rereading a durable member answer frees its terminal after both the index write and immediate read failed',async t=>{
  let failIndex=false,failRead=false;
  const storeIo={...fs,commit:async(from,to,current)=>{
    if(failIndex && path.basename(to)==='tasks.json'){
      failIndex=false;failRead=true;throw Object.assign(new Error('locked'),{code:'EBUSY'});
    }
    return commitFile(from,to,current);
  },stat:async file=>{
    if(failRead && path.basename(file)==='tasks.json'){
      failRead=false;throw Object.assign(new Error('unavailable'),{code:'EIO'});
    }
    return fs.stat(file);
  }};
  const f=await setup(t,{storeIo}),task=request('codex','공식 터미널');
  await f.service.submit(memberA,task);
  const job=await f.call(task.id);
  await job.hooks.terminal(async()=>true,'MANUAL_RESULT');
  failIndex=true;
  assert.equal((await f.service.action(memberA,task.id,'saveAnswer','회원이 옮긴 글')).ok,false);
  assert.equal(job.hooks.signal.aborted,false);
  const [saved]=await f.snap();
  assert.equal(saved.answer,'회원이 옮긴 글');assert.equal(saved.canOpenTerminal,false);
  assert.equal(job.hooks.signal.aborted,true);
});

test('old Codex terminal bodies stay archived privately, and only text the member supplies becomes visible',async t=>{
  const f=await setup(t),member=memberA.synk_user_id,dir=path.join(f.root,'Office',member),answers=path.join(dir,'answers');
  await fs.mkdir(answers,{recursive:true});
  const rows=[];
  for(const format of ['inline','txt','json']){
    const req=request('codex','구판 '+format),answer='보존한 '+format,sessionId=randomUUID();
    const row={...req,previousId:null,departmentId:null,departmentName:'사무실',cwd:f.root,
      sessionId,status:'completed',reason:null,viaTerminal:true,createdAt:1,updatedAt:2,answer:format==='inline'?answer:''};
    if(format!=='inline'){
      row.answerFile=true;
      const receipt={id:req.id,answer,sessionId,viaTerminal:true,unconfirmed:false,updatedAt:2};
      await fs.writeFile(path.join(answers,req.id+'.'+format),format==='txt'?answer:JSON.stringify(receipt));
    }
    rows.push(row);
  }
  await fs.writeFile(path.join(dir,'tasks.json'),JSON.stringify({version:1,tasks:rows}));
  const store=createTaskStore(f.root),first=await store.read(member);
  await store.write(member,first);
  const back=await createTaskStore(f.root).read(member);
  for(const [i,row] of back.entries()){
    assert.equal(row.status,'interrupted');assert.equal(row.reason,'MANUAL_RESULT');assert.equal(row.answer,'');
    assert.equal((await f.snap()).find(t=>t.id===row.id).answer,'');
    assert.equal((await f.service.submit(memberA,request('codex','이어가기',{previousId:row.id}))).code,'SESSION');
    const chosen='내가 옮긴 답 '+i;
    assert.equal((await f.service.action(memberA,row.id,'saveAnswer',chosen)).ok,true);
    const visible=(await f.snap()).find(t=>t.id===row.id);
    assert.equal(visible.reason,'MEMBER_RESULT');assert.equal(visible.answer,chosen);
  }
  const archived=JSON.parse(await fs.readFile(path.join(dir,'tasks.json'),'utf8')).tasks[0];
  assert.equal(archived.answer,'보존한 inline');
  assert.equal((await fs.readFile(path.join(answers,rows[1].id+'.txt'),'utf8')),'보존한 txt');
  assert.equal(JSON.parse(await fs.readFile(path.join(answers,rows[2].id+'.json'),'utf8')).answer,'보존한 json');
});

test('a damaged member-entered answer reports a storage failure instead of offering another import',async t=>{
  const f=await setup(t),task=request('codex','복사해 보관한 답');
  await f.service.submit(memberA,task);
  const job=await f.call(task.id);job.reject(Object.assign(new Error('MANUAL_RESULT'),{code:'MANUAL_RESULT'}));
  await f.row(task.id,'interrupted');
  await f.service.action(memberA,task.id,'saveAnswer','직접 선택한 문장');
  const file=path.join(f.root,'Office',memberA.synk_user_id,'answers',task.id+'.member.json');
  await fs.writeFile(file,'{');
  const row=(await f.snap()).find(t=>t.id===task.id);
  assert.equal(row.status,'failed');assert.equal(row.reason,'WRITE');assert.equal(row.answer,'');
  assert.equal((await f.service.action(memberA,task.id,'saveAnswer','다른 문장')).ok,false);
  assert.equal(await fs.readFile(file,'utf8'),'{');
});

test('an authenticated live Claude preview remains separate from confirmed work and survives a cold restart',async t=>{
  const f=await setup(t),task=request('claude','중간 답 확인'),answer='확인 중인 두 줄\n둘째 줄';
  await f.service.submit(memberA,task);
  const job=await f.call(task.id);
  await job.hooks.terminal(async()=>true);
  assert.equal(await job.hooks.provisional(answer),true);
  const live=await f.row(task.id,'terminal');
  assert.equal(live.reason,'PERMISSION');assert.equal(live.previewAnswer,answer);assert.equal(live.answer,'');assert.equal(live.canOpenTerminal,true);
  const root=path.join(f.root,'Office',memberA.synk_user_id);
  const index=JSON.parse(await fs.readFile(path.join(root,'tasks.json'),'utf8')).tasks[0];
  assert.equal(index.provisional,undefined);assert.match(index.provisionalRef,/^[a-f0-9]{64}$/);
  const preview=path.join(root,'answers',task.id+'.preview-'+index.provisionalRef+'.txt');
  assert.equal(await fs.readFile(preview,'utf8'),answer);
  assert.equal((await f.service.submit(memberA,request('claude','새 질문',{previousId:task.id}))).code,'SESSION');
  const restarted=createOfficeTasks({userData:f.root,current:()=>memberA,authorized:async()=>true});
  const restored=(await restarted.snapshot(memberA)).tasks[0];
  assert.equal(restored.status,'interrupted');assert.equal(restored.reason,'UNCONFIRMED');assert.equal(restored.answer,answer);
  const disk=(await createTaskStore(f.root).read(memberA.synk_user_id))[0];
  assert.equal(disk.answer,answer);assert.equal(disk.provisional,undefined);
  await assert.rejects(fs.stat(preview),{code:'ENOENT'});
  restarted.close();
});

test('a later verified response supersedes its preview, and a signed-out preview cannot reach a new member',async t=>{
  const f=await setup(t),first=request('claude','도움'),next=request('claude','다음');
  await f.service.submit(memberA,first);
  const job=await f.call(first.id);await job.hooks.provisional('첫 후보');
  assert.equal(await job.hooks.running(),true);
  const running=await f.row(first.id,'running');
  assert.equal(running.reason,null);assert.equal(running.previewAnswer,'첫 후보');
  await job.hooks.terminal(async()=>true,'PERMISSION');
  const permission=await f.row(first.id,'terminal');
  assert.equal(permission.reason,'PERMISSION');assert.equal(permission.previewAnswer,'첫 후보');
  await job.hooks.provisional('둘째 후보');
  job.resolve({answer:'끝난 답',sessionId:randomUUID()});
  assert.equal((await f.row(first.id,'completed')).answer,'끝난 답');
  await f.service.submit(memberA,next);
  await (await f.call(next.id)).hooks.provisional('옛 회차 후보');
  f.state.account=memberB;f.service.accountChanged(memberB);
  assert.deepEqual(await f.snap(memberB),[]);
  const parked=(await f.store.read(memberA.synk_user_id)).find(row=>row.id===next.id);
  assert.equal(parked.provisional,undefined);
});

test('a normal application quit preserves the authenticated preview without needing the terminal to close first',async t=>{
  const f=await setup(t),task=request('claude','일반 종료');
  await f.service.submit(memberA,task);
  const job=await f.call(task.id);
  await job.hooks.provisional('다음 실행에서 읽을 글');
  f.service.close();
  job.resolve({answer:'종료 뒤에 도착한 글'});
  await f.service.snapshot(memberA);
  const [row]=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.equal(row.status,'interrupted');assert.equal(row.reason,'UNCONFIRMED');
  assert.equal(row.answer,'다음 실행에서 읽을 글');
});

test('a locked preview stays visible to its member and an application quit cannot promote it to a fresh receipt',async t=>{
  const storeIo={...fs,commit:async(from,to,current)=>{
    if(path.basename(to).includes('.preview-'))throw Object.assign(new Error('locked'),{code:'EBUSY'});
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo}),task=request('claude','쓰기 복구 기다림');
  await f.service.submit(memberA,task);
  const job=await f.call(task.id);
  await assert.rejects(job.hooks.provisional('한 번 받은 답'),{code:'WRITE'});
  assert.equal((await f.row(task.id,'running')).previewAnswer,'한 번 받은 답');
  assert.equal((await f.service.snapshot(memberB)).ok,false);
  f.service.close();
  await f.service.snapshot(memberA);
  const [row]=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.equal(row.status,'interrupted');assert.equal(row.answer,'');
});

test('an unreadable answer is isolated while a new task can be saved without changing the damaged receipt or its index entry',async t=>{
  const f=await setup(t),bad=request('claude','손상 파일이 붙은 일'),good=request('codex','새 일');
  await f.service.submit(memberA,bad);
  (await f.call(bad.id)).resolve({answer:'기존 답',sessionId:randomUUID()});
  await f.row(bad.id,'completed');
  const dir=path.join(f.root,'Office',memberA.synk_user_id),index=path.join(dir,'tasks.json');
  const ledgerRow=async()=>JSON.parse(await fs.readFile(index,'utf8')).tasks.find(row=>row.id===bad.id);
  const original=await ledgerRow(),file=path.join(dir,'answers',bad.id+'.json');
  const damaged='{"unfinished":';await fs.writeFile(file,damaged);
  const unreadable=(await f.snap()).find(row=>row.id===bad.id);
  assert.equal(unreadable.status,'failed');assert.equal(unreadable.answer,'');
  assert.equal((await f.service.submit(memberA,good)).ok,true);
  (await f.call(good.id)).resolve({answer:'다른 일의 정상 답',sessionId:randomUUID()});
  assert.equal((await f.row(good.id,'completed')).answer,'다른 일의 정상 답');
  assert.deepEqual(await ledgerRow(),original);
  assert.equal(await fs.readFile(file,'utf8'),damaged);
});

test('an unreadable receipt in the retry queue cannot prevent the next employee from saving a healthy reply',async t=>{
  const bad=request('claude','첫 번째 요청'),good=request('codex','다른 직원의 요청');
  let damaged=false;
  const storeIo={...fs,commit:async(from,to,current)=>{
    if(!damaged && path.basename(to)==='tasks.json'){
      const json=JSON.parse(await fs.readFile(from,'utf8'));
      if(json.tasks.some(row=>row.id===bad.id && row.answerFile===true)){
        damaged=true;
        await fs.writeFile(path.join(path.dirname(to),'answers',bad.id+'.json'),'{"partial":');
        throw Object.assign(new Error('index interrupted'),{code:'EBUSY'});
      }
    }
    return commitFile(from,to,current);
  }};
  const f=await setup(t,{storeIo});
  await f.service.submit(memberA,bad);await f.service.submit(memberA,good);
  const a=await f.call(bad.id),b=await f.call(good.id);
  a.resolve({answer:'복구를 기다리는 원문',sessionId:randomUUID()});
  await eventually(()=>damaged,'interrupt the first index write');
  b.resolve({answer:'정상 보존된 새 답',sessionId:randomUUID()});
  assert.equal((await f.row(good.id,'completed')).answer,'정상 보존된 새 답');
  const remaining=(await f.snap()).find(row=>row.id===bad.id);
  assert.equal(remaining.reason,'WRITE');assert.equal(remaining.answer,'복구를 기다리는 원문');
  const fresh=await createTaskStore(f.root).read(memberA.synk_user_id);
  assert.equal(fresh.find(row=>row.id===good.id).answer,'정상 보존된 새 답');
});

test('requests are screened before launch and an authenticated member must still have office access',async t=>{
  const f=await setup(t);
  for(const bad of [request('gemini','지원하지 않음'),request('claude',' '),request('codex','글'.repeat(8001)),
    request('codex','값',{id:'not-a-task-id'}),request('claude','값',{departmentId:'bad/id'})]) {
    assert.equal((await f.service.submit(memberA,bad)).code,'VALUE');
  }
  f.state.authorized=false;
  assert.equal((await f.service.submit(memberA,request('codex','안 됨'))).code,'NOT_ALLOWED');
  assert.equal((await f.service.snapshot(memberA)).code,'NOT_ALLOWED');
  assert.equal(f.calls.length,0);
});

test('only the Windows platform development office can launch tasks and employees use the default CLI environment',async t=>{
  const opts={packaged:false,mode:'development',clientId:'platform',platform:'win32',smoke:false};
  assert.equal(enabled(opts),true);
  for (const change of [{packaged:true},{mode:'production'},{clientId:'other'},{platform:'darwin'},{smoke:true}]) {
    assert.equal(enabled({...opts,...change}),false);
  }
  const supplied={PATH:'tools',LOCALAPPDATA:'fixture',CLAUDE_CONFIG_DIR:'review',CODEX_HOME:'review',ANTHROPIC_API_KEY:'placeholder',
    OPENAI_API_KEY:'placeholder',CLAUDE_CODE_OAUTH_TOKEN:'placeholder',NODE_OPTIONS:'fixture'};
  assert.deepEqual(employeeEnv(supplied),{PATH:'tools',LOCALAPPDATA:'fixture'});
  assert.equal(supplied.CLAUDE_CONFIG_DIR,'review');
  const f=await setup(t);
  const one=await taskDirectory(f.root,memberA.synk_user_id,null),two=await taskDirectory(f.root,memberB.synk_user_id,null);
  assert.notEqual(one,two);assert.equal(await fs.realpath(one),one);
  assert.ok((await fs.stat(two)).isDirectory());
  const external=await fs.mkdtemp(path.join(os.tmpdir(),'office-department-folders-'));
  t.after(()=>fs.rm(external,{recursive:true,force:true}));
  const accountFolder=path.join(external,'AiSubscriptions','accounts','synthetic');
  const publicFolder=path.join(external,'work');
  await Promise.all([fs.mkdir(accountFolder,{recursive:true}),fs.mkdir(publicFolder)]);
  assert.equal(await taskDirectory(f.root,memberA.synk_user_id,{folder:publicFolder}),await fs.realpath(publicFolder));
  await assert.rejects(taskDirectory(f.root,memberA.synk_user_id,{folder:accountFolder}),{code:'FOLDER'});
});
