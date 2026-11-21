'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createHmac, randomUUID } = require('node:crypto');
const { runCodex, nativePrompt } = require('../src/office-task-codex.cjs');
const { MAX_ANSWER } = require('../src/office-task-store.cjs');

const threadId=randomUUID(), turnId=randomUUID(), outside=randomUUID();
const cwd=process.cwd();
const answer={type:'agentMessage',phase:'final_answer',text:'완료한 답입니다.'};
const turn=(id,status,items=[])=>({id,status,items});
const spec=()=>({id:randomUUID(),provider:'codex',cwd,role:'편집자',prompt:'검토할 한 문장입니다.',sessionId:null,previousId:null});

function fixture(options={}) {
  const controller=new AbortController();
  const requests=[],opens=[],closed=[],sent=[],timeline=[],stages=[],sessions=[];
  const assign=options.spec || spec();
  let openHandler,focusCount=0,stopCount=0,allowed=true,closeOwned;
  const hooks={
    signal:controller.signal,checkpoint:async()=>allowed,
    session:async (id,providerTag)=>{sessions.push({id,providerTag});return id===threadId;},
    terminal:async (fn,reason)=>{stages.push(reason);openHandler=fn;return options.chooseTerminal && reason==='PERMISSION' ? await fn() : true;},
    running:async()=>true
  };
  const tools={file:process.execPath,env:{},open:async(file,args,dir)=>{
    assert.equal(file,process.execPath);assert.equal(dir,cwd);timeline.push('native');opens.push(args);
    if(options.openError)throw Error('fixture failure');
    const closed=options.stayOpen||options.holdClosure?new Promise(resolve=>{closeOwned=resolve;}):Promise.resolve();
    return {focus:async()=>{focusCount++;return true;},stop:()=>{stopCount++;if(!options.holdClosure)closeOwned?.();},closed};
  },spawn(file,args,spawnOpts){
    assert.equal(file,process.execPath);assert.equal(spawnOpts.shell,false);assert.equal(spawnOpts.cwd,cwd);
    const index=closed.length;
    const child=new EventEmitter();
    child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
    child.kill=()=>{child.emit('exit',0);child.emit('close',0);return true;};
    closed.push(false);
    const output=msg=>{const data=Buffer.from(JSON.stringify(msg)+'\n');const cut=data.indexOf(Buffer.from('완'));if(cut>=0){child.stdout.write(data.subarray(0,cut+1));child.stdout.write(data.subarray(cut+1));}else child.stdout.write(data);};
    const inform=(method,params)=>output({method,params});
    const item=(th,tr,it)=>inform('item/completed',{threadId:th,turnId:tr,item:it});
    const completed=(th,t)=>inform('turn/completed',{threadId:th,turn:t});
    let buffer='';
    child.stdin.on('data',chunk=>{
      buffer+=chunk;let cut;
      while((cut=buffer.indexOf('\n'))>=0){
        const req=JSON.parse(buffer.slice(0,cut));buffer=buffer.slice(cut+1);
        sent.push(req);
        if(!req.method)continue;
        requests.push({method:req.method,params:req.params,index});
        const reply=x=>output({id:req.id,result:x});
        const reject=(code,message)=>output({id:req.id,error:{code,message}});
        switch(req.method){
          case 'initialize': reply({});break;
          case 'initialized': break;
          case 'account/read': {
            timeline.push('account-'+index);
            if(options.accountReadFailure===index){reject(-32000,'account unavailable');break;}
            const snapshot=options.accountAt?.(index,timeline,opens) || options.accounts?.[index] || options.accounts?.at(-1) || {account:Object.hasOwn(options,'account')?options.account:{type:'chatgpt'},userId:'fixture-user',requiresOpenaiAuth:true};
            reply({workspaceRouting:{chatgptAccountId:'fixture-workspace',backendOrigin:'https://unused.example.test',accountRoutingOverride:'NO_CONSTRAINT'},...snapshot});
            break;
          }
          case 'thread/start':
          case 'thread/resume': reply({modelProvider:'openai',thread:{id:threadId,cwd}});break;
          case 'thread/read':
            if(index===0) reply({thread:{id:threadId,cwd:options.wrongDir?'x':cwd,modelProvider:'openai',status:{type:options.busy?'active':'idle'}}});
            else reply({thread:{id:threadId,turns:[turn(outside,'completed',[options.nativeAnswer||answer])]}});
            break;
          case 'turn/start':
            item(outside,turnId,{...answer,text:'다른 대화'});completed(threadId,turn(outside,'completed',[{...answer,text:'이전 차례'}]));
            // Some native messages arrive before turn/start replies with its assigned id.
            if(options.protected){
              output({id:932,method:'item/commandExecution/requestApproval',params:{threadId,turnId,itemId:'fixture'}});
            } else if(!options.hold){
              item(threadId,turnId,{type:'agentMessage',phase:'commentary',text:'중간 답'});
              item(threadId,turnId,options.answer || answer);
              if(options.afterAnswer){
                inform('item/started',{threadId,turnId,item:options.afterAnswer});
                item(threadId,turnId,options.afterAnswer);
              }
              completed(threadId,options.failed ? {...turn(turnId,'failed'),error:{codexErrorInfo:options.failed}} : turn(turnId,'completed'));
            }
            reply({turn:turn(turnId,'inProgress')});
            break;
          case 'turn/interrupt':
            if(options.rejectInterrupt){reject(-32000,'could not interrupt');break;}
            reply({});if(!options.noInterruptEnd)completed(threadId,turn(turnId,'interrupted'));break;
          case 'thread/turns/list':
            // A standalone terminal may have written a different account's response.
            // A regression that reads it must fail the RPC assertions.
            reply({data:[turn(outside,'completed',[options.nativeAnswer||answer])],nextCursor:null});break;
          default: reject(-32601,'method not found');
        }
      }
    });
    child.stdin.on('finish',()=>{closed[index]=true;child.kill();});
    return child;
  }};
  return {run:()=>runCodex(assign,hooks,tools),spec:assign,hooks,tools,requests,opens,closed,sent,timeline,stages,sessions,controller,
    open:()=>openHandler?.(),hasOpen:()=>!!openHandler,focusCount:()=>focusCount,stopCount:()=>stopCount,closeOwned:()=>closeOwned?.(),setAllowed:v=>{allowed=v;}};
}
const code=expected=>err=>err?.code===expected;
async function until(fn){const end=Date.now()+4500;while(!fn() && Date.now()<end)await new Promise(r=>setTimeout(r,10));assert.ok(fn());}

test('closing an independent terminal never imports its answer or asks the reader for its messages',async()=>{
  const f=fixture({protected:true,chooseTerminal:true,nativeAnswer:{...answer,text:'다른 실행 계정의 비공개 답'}});
  await assert.rejects(f.run(),e=>e.code==='MANUAL_RESULT' && e.answer===undefined);
  assert.deepEqual(f.stages,['PERMISSION','MANUAL_RESULT']);
  assert.deepEqual(f.requests.filter(r=>r.index>0).map(r=>r.method),
    ['initialize','initialized','account/read','account/read','account/read']);
  assert.equal(f.requests.filter(r=>r.method==='turn/start').length,1);
});

test('own thread and turn require a final answer and completed status; preserves split Korean text',async()=>{
  const f=fixture();
  assert.deepEqual(await f.run(),{sessionId:threadId,answer:answer.text});
  const req=f.requests.find(r=>r.method==='turn/start').params;
  assert.deepEqual(req.sandboxPolicy,{type:'readOnly',networkAccess:false});assert.equal(req.approvalPolicy,'on-request');
  assert.equal(req.approvalsReviewer,'user');assert.equal(req.clientUserMessageId,f.spec.id);
  assert.equal(req.input.at(-1).text,f.spec.prompt);
  assert.equal(f.requests.filter(r=>r.method==='turn/start').length,1);
  assert.equal(f.opens.length,0);
});

test('commentary alone and an oversized final cannot become a completed answer',async()=>{
  await assert.rejects(fixture({answer:{...answer,phase:'commentary'}}).run(),code('NO_ANSWER'));
  await assert.rejects(fixture({answer:{...answer,text:'가'.repeat(MAX_ANSWER+1)}}).run(),code('RESULT_TOO_LARGE'));
});

test('auth type and provider limit exclude keys and incomplete answers',async()=>{
  for(const account of [null,{type:'apiKey'},{type:'amazonBedrock'}]){
    const f=fixture({account});await assert.rejects(f.run(),code('LOGIN'));
    assert.ok(!f.requests.some(x=>x.method==='thread/start'));
  }
  await assert.rejects(fixture({failed:'usageLimitExceeded'}).run(),code('LIMIT'));
  await assert.rejects(fixture({failed:'unauthorized'}).run(),code('LOGIN'));
});

test('resume validates the prior thread and directory before sending the one new user turn',async()=>{
  const first=fixture();await first.run();
  const older={...spec(),sessionId:threadId,previousId:first.spec.id,providerSalt:first.spec.id,providerTag:first.sessions[0].providerTag};
  const f=fixture({spec:older});await f.run();
  assert.deepEqual(f.requests.map(r=>r.method),['initialize','initialized','account/read','thread/read','thread/resume','turn/start']);
  for(const opts of [{wrongDir:true},{busy:true}]){
    const wrong=fixture({...opts,spec:older});
    await assert.rejects(wrong.run(),code('SESSION'));
    assert.ok(!wrong.requests.some(x=>x.method==='thread/resume' || x.method==='turn/start'));
  }
});

test('a follow-up proves the provider identity before reading its thread or transmitting new input',async()=>{
  const account=(id,mail)=>({userId:id,account:{type:'chatgpt',email:mail}});
  const owner=account('member-one','worker-one@example.test'),other=account('member-two','worker-one@example.test');
  const root=fixture({accounts:[owner]});await root.run();
  const parentTag=root.sessions[0].providerTag;
  assert.match(parentTag,/^[a-f0-9]{64}$/);
  const next={...spec(),sessionId:threadId,previousId:root.spec.id,providerSalt:root.spec.id,providerTag:parentTag};
  const allowed=fixture({spec:next,accounts:[account('member-one','renamed@example.test')]});await allowed.run();
  assert.deepEqual(allowed.sessions,[{id:threadId,providerTag:parentTag}]);
  const anotherRoot=fixture({accounts:[owner]});await anotherRoot.run();
  assert.notEqual(anotherRoot.sessions[0].providerTag,parentTag);
  const freshAccount=fixture({accounts:[other]});await freshAccount.run();
  assert.equal(freshAccount.requests.filter(r=>r.method==='turn/start').length,1);
  for(const [changes,identity,reason] of [
    [{},other,'LOGIN'],[{},account(null,owner.account.email),'LOGIN'],
    [{providerTag:null},owner,'SESSION'],[{providerSalt:null},owner,'SESSION'],
    [{providerSalt:anotherRoot.spec.id},owner,'LOGIN'],[{sessionId:null},owner,'SESSION']
  ]){
    const f=fixture({spec:{...next,...changes},accounts:[identity]});
    await assert.rejects(f.run(),code(reason));
    assert.ok(!f.requests.some(r=>/^(thread|turn)\//.test(r.method)));
    assert.equal(f.sessions.length,0);assert.equal(f.opens.length,0);
  }
});

test('when the provider supplies email only, the same normalized email can resume within its own task family',async()=>{
  const account=email=>({account:{type:'chatgpt',email}});
  const first=fixture({accounts:[account('Sample@EXAMPLE.test')]});await first.run();
  const spec2={...spec(),previousId:first.spec.id,sessionId:threadId,providerSalt:first.spec.id,providerTag:first.sessions[0].providerTag};
  const same=fixture({spec:spec2,accounts:[account('sample@example.test')]});await same.run();
  assert.match(same.sessions[0].providerTag,/^[a-f0-9]{64}$/);
  const different=fixture({spec:spec2,accounts:[account('different@example.test')]});
  await assert.rejects(different.run(),code('LOGIN'));
  assert.ok(!different.requests.some(r=>/^(thread|turn)\//.test(r.method)));
});

test('same ChatGPT user and email must also prove the selected workspace before opening historical turns',async()=>{
  const account={type:'chatgpt',email:'worker@example.test',workspaceName:'배정된 사무실',planType:'team'};
  const snapshot=workspace=>({userId:'same-user',account,workspaceRouting:workspace==null?workspace:{chatgptAccountId:workspace}});
  const first=fixture({accounts:[snapshot('personal')]});await first.run();
  const next={...spec(),sessionId:threadId,previousId:first.spec.id,providerSalt:first.spec.id,providerTag:first.sessions[0].providerTag};
  for(const workspace of ['company',null,undefined,'']){
    const other=fixture({spec:next,accounts:[snapshot(workspace)]});
    await assert.rejects(other.run(),code('LOGIN'));
    assert.deepEqual(other.requests.map(x=>x.method),['initialize','initialized','account/read']);
    assert.equal(other.opens.length,0);
  }
  const oldTag=createHmac('sha256','solio:office:codex:account:v1\0'+first.spec.id).update('id\0same-user').digest('hex');
  const legacy=fixture({spec:{...next,providerTag:oldTag},accounts:[snapshot('personal')]});
  await assert.rejects(legacy.run(),code('LOGIN'));
  assert.ok(!legacy.requests.some(x=>/^(thread|turn)\//.test(x.method)));
  const same=fixture({spec:next,accounts:[snapshot('personal')]});
  assert.equal((await same.run()).answer,answer.text);
  assert.deepEqual(same.sessions,first.sessions);
  assert.equal(same.requests[0].params.capabilities.experimentalApi,true);
  const unavailable=fixture({accounts:[snapshot(null)]});
  assert.equal((await unavailable.run()).answer,answer.text);
  assert.equal(unavailable.sessions[0].providerTag,null);
});

test('the separate official terminal requires the original selected workspace immediately before and after launch',async()=>{
  const snapshot=workspace=>({userId:'one-user',account:{type:'chatgpt',email:'one@example.test'},workspaceRouting:{chatgptAccountId:workspace}});
  const before=fixture({protected:true,chooseTerminal:true,accounts:[snapshot('personal'),snapshot('business')]});
  await assert.rejects(before.run(),code('LOGIN'));assert.equal(before.opens.length,0);
  const after=fixture({protected:true,chooseTerminal:true,stayOpen:true,accountAt:(_index,_events,opens)=>snapshot(opens.length?'business':'personal')});
  await assert.rejects(after.run(),code('LOGIN'));assert.equal(after.stopCount(),1);
  assert.equal(after.requests.filter(x=>x.method==='initialize').every(x=>x.params.capabilities.experimentalApi),true);
  for(const f of [before,after])assert.ok(!f.requests.some(x=>x.index>0 && /^(thread|turn)\//.test(x.method)));
});

test('a protected request stays unanswered and only the operator can open and focus the dedicated terminal',async()=>{
  const f=fixture({protected:true,stayOpen:true});
  const waiting=assert.rejects(f.run(),code('MANUAL_RESULT'));
  await until(f.hasOpen);
  assert.equal(f.closed[0],true);assert.equal(f.opens.length,0);
  assert.ok(!f.sent.some(r=>r.id===932));
  assert.deepEqual(f.requests.find(x=>x.method==='turn/interrupt').params,{threadId,turnId});
  assert.equal(await f.open(),true);assert.equal(await f.open(),true);
  await until(()=>f.stages.includes('MANUAL_RESULT'));
  assert.equal(f.focusCount(),1);assert.equal(f.opens.length,1);
  assert.equal(f.opens[0][0],'resume');assert.equal(f.opens[0].at(-1),threadId);
  assert.ok(f.opens[0].every(arg=>!arg.includes(f.spec.prompt)&&!arg.includes(f.spec.id)));
  assert.ok(nativePrompt(f.spec.id).includes(f.spec.id));
  f.closeOwned();await waiting;
  assert.equal(f.stopCount(),0);
  assert.ok(!f.requests.some(r=>r.index>0 && /^(turn|thread)\//.test(r.method)));
});

test('without a confirmed interruption or a working native terminal the task cannot accept a manual result',async()=>{
  const failed=fixture({protected:true,rejectInterrupt:true});
  await assert.rejects(failed.run(),code('PROVIDER'));assert.equal(failed.opens.length,0);
  const broken=fixture({protected:true,chooseTerminal:true,openError:true});
  await assert.rejects(broken.run(),code('NATIVE'));
  assert.deepEqual(broken.stages,['PERMISSION']);assert.ok(broken.closed.every(Boolean));
});

test('cancellation interrupts only the active owned turn and cannot open the waiting terminal',async()=>{
  const active=fixture({hold:true});
  const running=active.run();await until(()=>active.requests.some(r=>r.method==='turn/start'));
  active.controller.abort();await assert.rejects(running,code('CANCELLED'));
  assert.deepEqual(active.requests.find(x=>x.method==='turn/interrupt')?.params,{threadId,turnId});
  const f=fixture({protected:true});const waiting=f.run();await until(f.hasOpen);
  f.controller.abort();await assert.rejects(waiting,code('CANCELLED'));
  assert.equal(await f.open(),false);assert.equal(f.opens.length,0);
});

test('cancelling a manual handoff holds the session lease until the owned terminal actually exits',async()=>{
  const f=fixture({protected:true,chooseTerminal:true,holdClosure:true});
  let settled=false;
  const pending=assert.rejects(f.run(),code('CANCELLED')).then(()=>{settled=true;});
  await until(()=>f.stages.includes('MANUAL_RESULT'));
  f.controller.abort();await until(()=>f.stopCount()===1);
  assert.equal(settled,false);f.closeOwned();await pending;
  assert.equal(f.stopCount(),1);
});

test('opening the manual terminal requires the original default ChatGPT identity',async()=>{
  const account=(id,email='first@example.test')=>({userId:id,account:{type:'chatgpt',email}});
  for(const replacement of [account('second'),account(null),{account:{type:'apiKey'}}]){
    const f=fixture({protected:true,chooseTerminal:true,accounts:[account('first'),replacement]});
    await assert.rejects(f.run(),code('LOGIN'));assert.equal(f.opens.length,0);
    assert.deepEqual(f.timeline,['account-0','account-1']);
  }
  const ok=fixture({protected:true,chooseTerminal:true,accounts:[account('first'),account('first')]});
  await assert.rejects(ok.run(),code('MANUAL_RESULT'));
  assert.deepEqual(ok.timeline,['account-0','account-1','account-1','native','account-1']);
  const fallback=fixture({protected:true,chooseTerminal:true,accounts:[account(null,'Sample@example.test'),account(null,'sample@example.test')]});
  await assert.rejects(fallback.run(),code('MANUAL_RESULT'));
  const unknown=fixture({protected:true,chooseTerminal:true,accounts:[account(null,null),account(null,null)]});
  await assert.rejects(unknown.run(),code('LOGIN'));assert.equal(unknown.opens.length,0);
});

test('legacy messages require an otherwise completed turn and cannot be commentary, partial, or before a tool',async()=>{
  const legacy={type:'agentMessage',text:'이전 버전 답변입니다.'};
  assert.equal((await fixture({answer:legacy}).run()).answer,legacy.text);
  assert.equal((await fixture({answer:{...legacy,phase:null}}).run()).answer,legacy.text);
  for(const phase of ['commentary','partial_answer'])await assert.rejects(fixture({answer:{...legacy,phase}}).run(),code('NO_ANSWER'));
  await assert.rejects(fixture({answer:legacy,afterAnswer:{type:'commandExecution',id:'sample',status:'completed'}}).run(),code('NO_ANSWER'));
  await assert.rejects(fixture({answer:legacy,failed:'internalServerError'}).run(),code('PROVIDER'));
});

test('post-response context compaction keeps a final or unphased answer from our own live turn',async()=>{
  const compaction={type:'contextCompaction',id:'compacted'};
  for(const a of [answer,{type:'agentMessage',text:'호환 답'}])
    assert.equal((await fixture({answer:a,afterAnswer:compaction}).run()).answer,a.text);
  await assert.rejects(fixture({answer:{...answer,phase:'commentary'},afterAnswer:compaction}).run(),code('NO_ANSWER'));
});

test('a failed identity check before or during terminal launch produces no message or manual-input state',async()=>{
  const account=name=>({userId:name,account:{type:'chatgpt'}});
  const before=fixture({protected:true,chooseTerminal:true,accountAt:(i,t)=>account(i===1&&t.filter(s=>s==='account-1').length>1?'other':'owner')});
  await assert.rejects(before.run(),code('LOGIN'));assert.equal(before.opens.length,0);
  const after=fixture({protected:true,chooseTerminal:true,stayOpen:true,accountAt:(_i,_t,opens)=>account(opens.length?'other':'owner')});
  await assert.rejects(after.run(),code('LOGIN'));assert.equal(after.stopCount(),1);
  const unreadable=fixture({protected:true,chooseTerminal:true,accountReadFailure:1});
  await assert.rejects(unreadable.run(),code('PROVIDER'));
  for(const f of [before,after,unreadable]){
    assert.deepEqual(f.stages,['PERMISSION']);
    assert.ok(!f.requests.some(r=>r.index>0 && /^(thread|turn)\//.test(r.method)));
  }
});

test('an A to B to A account switch can never place B\'s terminal text in the Solio job',async()=>{
  let currentAccount='A',terminalAccount=null;
  const observed=[];
  const f=fixture({protected:true,chooseTerminal:true,stayOpen:true,
    nativeAnswer:{...answer,text:'다른 계정이 독립 콘솔에서 생성한 답'},accountAt:()=>{
      observed.push(currentAccount);return {userId:currentAccount,account:{type:'chatgpt'}};
    }});
  const open=f.tools.open;
  f.tools.open=async(...args)=>{
    currentAccount='B';terminalAccount=currentAccount;
    try{return await open(...args);}finally{currentAccount='A';}
  };
  const waiting=assert.rejects(f.run(),e=>e.code==='MANUAL_RESULT' && e.answer===undefined);
  await until(()=>f.stages.includes('MANUAL_RESULT'));assert.equal(terminalAccount,'B');
  assert.ok(!f.opens[0].some(v=>v.includes(f.spec.prompt)||v.includes(f.spec.id)));
  f.closeOwned();await waiting;
  assert.ok(observed.length>=3&&observed.every(a=>a==='A'));
  assert.equal(f.requests.filter(r=>r.method==='turn/start').length,1);
  assert.ok(f.requests.filter(r=>r.index>0).every(r=>['initialize','initialized','account/read'].includes(r.method)));
});

test('a live server with no own turn activity is interrupted once, and an unconfirmed end is reported separately',async t=>{
  const {performance}=require('node:perf_hooks');
  let now=1000;
  t.mock.method(performance,'now',()=>now);
  const f=fixture({hold:true});const first=assert.rejects(f.run(),code('NO_ANSWER'));
  await until(()=>f.requests.some(r=>r.method==='turn/start'));now+=601000;await first;
  assert.equal(f.requests.filter(r=>r.method==='turn/interrupt').length,1);assert.equal(f.opens.length,0);assert.equal(f.closed[0],true);
  const second=fixture({hold:true,noInterruptEnd:true});const unknown=assert.rejects(second.run(),code('PROVIDER'));
  await until(()=>second.requests.some(r=>r.method==='turn/start'));now+=601000;
  await until(()=>second.requests.some(r=>r.method==='turn/interrupt'));now+=26000;await unknown;
  assert.equal(second.closed[0],true);assert.equal(second.opens.length,0);
});


