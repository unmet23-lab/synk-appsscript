'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {randomUUID,randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {createOfficeMail}=require('../src/office-mail.cjs');
const {createOfficeTasks}=require('../src/office-tasks.cjs');
const {createTaskStore,publicTask}=require('../src/office-task-store.cjs');
const {fail}=require('../src/office-mail-http.cjs');
const owner={synk_user_id:'mail_member_a',sessionGeneration:1};
const other={synk_user_id:'mail_member_b',sessionGeneration:1};
const canary='only-in-saved-mail-fixture';const token='fixture-refresh-value';
const hold=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const request=(prompt,fields={})=>({id:randomUUID(),provider:'codex',prompt,...fields});
const initial={terms:['견적'],from:'',after:'',before:'',folder:'inbox',provider:'',inherit:false};
async function fixture(t,extra={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'solio-mail-test-'));
  const key=randomBytes(32);
  const secrets={available:()=>true,encrypt:value=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const buf=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),buf]);},
    decrypt:bytes=>{const d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(12,28));return Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString();}};
  const state={account:owner,subject:'one',outlookFails:false,issued:[],opened:[],worker:[],judges:[]};
  const current=()=>state.account,authorized=async a=>a.synk_user_id===owner.synk_user_id&&state.permitted!==false;
  const mail=createOfficeMail({userData:root,secrets,current,authorized,openExternal:async url=>state.opened.push(url),
    clients:async()=>({gmail:{id:'google-fixture'},outlook:{id:'outlook-fixture'}}),
    authorize:async({provider})=>({subject:state.subject+'-'+provider,address:provider+'@example.test',refreshToken:token,scope:'test'}),
    refresh:async()=>({access:'fixture-access',refreshToken:token,scope:'test'}),
    search:async({provider,plan})=>{state.issued.push({provider,plan});if(provider==='outlook'&&state.outlookFails)throw fail('MAIL_LIMIT');
      return {items:[{id:randomUUID(),sourceId:'1aabe',subject:canary,from:'sender@example.test',date:'2026-11-10T00:00:00Z',snippet:canary,webLink:'https://outlook.live.com/mail/inbox/id/sample'}],more:false};},...extra.mail});
  const service=createOfficeTasks({userData:root,current,authorized,mail,...(extra.store?{store:extra.store(createTaskStore(root,undefined,mail))}:{}),context:async()=>({ok:true,name:'사무실',cwd:root,cap:2,toolCaps:{codex:2}}),
    run:async(spec,hooks)=>{
      if(spec.mailJudge){
        state.judges.push(spec);await hooks.session(spec.id,'a'.repeat(64));
        if(extra.decision)return extra.decision(spec,hooks);
        if(['내 사서함','Find the bug in the email validation function'].includes(spec.prompt))return {kind:'choose'};
        if(['이메일 인증 코드에서 버그 찾아줘','위 결과에서 email 관련 항목 찾아줘'].includes(spec.prompt))return {kind:'ordinary'};
        return {kind:'mailbox',plan:extra.plan?extra.plan(spec):initial};
      }
      state.worker.push(spec);if(!spec.mailSearch&&extra.ordinary){const sessionId=spec.sessionId||spec.id;await hooks.session(sessionId,'b'.repeat(64));return {sessionId,answer:'일반 업무 응답'};}
      assert.equal(spec.mailSearch,true);assert.equal(await hooks.session(spec.sessionId||spec.id,'a'.repeat(64)),true);return spec.preparedMailPlan||(extra.plan?extra.plan(spec):initial);}});
  async function row(id,status){for(let i=0;i<350;i++){const v=(await service.snapshot(owner)).tasks?.find(x=>x.id===id);if(v?.status===status)return v;await delay(12);}
    assert.fail('Missing '+status+' for '+id+': '+JSON.stringify((await service.snapshot(owner)).tasks));}
  t.after(async()=>{service.close();await service.snapshot(owner);await fs.rm(root,{recursive:true,force:true});});
  return {root,mail,state,service,row};
}
test('같은 카드에 결과를 암호화해 보관하고 받은 메일은 모델 요청과 평문 기록에 쓰지 않는다',async t=>{
  const f=await fixture(t);assert.equal((await f.mail.connect(owner,'gmail')).ok,true);
  const job=request('지난주 견적 메일 찾아줘');await f.service.submit(owner,job);
  const done=await f.row(job.id,'completed');assert.equal(done.mailResult.groups[0].items[0].subject,canary);
  assert.match(done.answer,/1건/);assert.equal(done.mailSearch,true);
  assert.equal(JSON.stringify(f.state.worker).includes(canary),false);
  const files=await fs.readdir(f.root,{recursive:true});
  for(const rel of files){const file=path.join(f.root,rel);if((await fs.stat(file)).isFile()){
    const bytes=await fs.readFile(file);assert.ok(!bytes.includes(Buffer.from(canary)));assert.ok(!bytes.includes(Buffer.from(token)));
  }}
  const disk=JSON.parse(await fs.readFile(path.join(f.root,'Office',owner.synk_user_id,'tasks.json'),'utf8'));
  assert.equal(disk.tasks[0].answer,'');assert.equal(disk.tasks[0].mailSearch,true);
  const restored=publicTask((await createTaskStore(f.root,undefined,f.mail).read(owner.synk_user_id))[0]);
  assert.deepEqual(restored.mailResult,done.mailResult);
  const id=done.mailResult.groups[0].items[0].id;
  assert.deepEqual(await f.mail.openResult(owner,job.id,id),{ok:true});assert.match(f.state.opened.pop(),/^https:\/\/mail\.google\.com\//);
  assert.equal((await f.mail.openResult(other,job.id,id)).ok,false);
  assert.equal((await f.mail.openResult(owner,job.id,randomUUID())).ok,false);
  assert.equal((await f.mail.disconnect(owner,'gmail')).ok,true);
  assert.deepEqual((await f.row(job.id,'completed')).mailResult,done.mailResult);
});
test('일반 업무 선택은 메일 용어를 포함한 GPT 업무와 기존 일반 대화를 유지하고 메일 대화와 분리한다',async t=>{
  const f=await fixture(t,{ordinary:true});await f.mail.connect(owner,'gmail');
  const first=request('이메일 인증 코드에서 버그 찾아줘');await f.service.submit(owner,first);await f.row(first.id,'completed');
  const next=request('메일 찾아줘라는 문장을 예시에 더해줘',{previousId:first.id,mailSearch:false});
  await f.service.submit(owner,next);assert.equal((await f.row(next.id,'completed')).mailSearch,false);
  assert.equal(f.state.worker[1].sessionId,first.id);assert.equal(f.state.worker[1].previousId,first.id);
  assert.equal(f.state.issued.length,0);
  const real=request('지난주 메일 찾아줘');await f.service.submit(owner,real);await f.row(real.id,'completed');
  const switchBack=request('메일 내용과 관련 없는 일반 업무',{previousId:real.id,mailSearch:false});
  await f.service.submit(owner,switchBack);await f.row(switchBack.id,'completed');
  assert.equal(f.state.worker.at(-1).sessionId,null);assert.equal(f.state.worker.at(-1).previousId,null);
  assert.ok(!JSON.stringify(f.state.worker.at(-1)).includes(canary));
});
test('연결 없음 또는 뜻이 모호한 요청은 일반 GPT로 넘기지 않고 카드에 남긴다',async t=>{
  const f=await fixture(t);
  for(const [prompt,code] of [['견적 메일 검색해줘','MAIL_CONNECT'],['내 사서함','MAIL_CHOOSE']]){
    const job=request(prompt);await f.service.submit(owner,job);assert.equal((await f.row(job.id,'failed')).reason,code);
  }
  assert.equal(f.state.worker.length,0);
  const disk=JSON.parse(await fs.readFile(path.join(f.root,'Office',owner.synk_user_id,'tasks.json'),'utf8'));
  assert.ok(disk.tasks.every(row=>row.reason==='PROVIDER'&&row.mailReason.startsWith('MAIL_')));
});
test('일반 대화의 결과물에서 이메일 항목을 찾으면 원래 대화와 업무를 그대로 잇는다',async t=>{
  const f=await fixture(t,{ordinary:true});await f.mail.connect(owner,'gmail');
  const first=request('지난주 보고서를 정리해줘');await f.service.submit(owner,first);await f.row(first.id,'completed');
  const second=request('위 결과에서 email 관련 항목 찾아줘',{previousId:first.id});
  await f.service.submit(owner,second);await f.row(second.id,'completed');
  assert.equal(f.state.worker.at(-1).sessionId,first.id);
  assert.equal(f.state.worker.at(-1).previousId,first.id);assert.equal(f.state.issued.length,0);
});
test('실제 API에서 Gmail 머리말이 진행 중일 때 연결을 끊으면 발췌 요청을 시작하지 않는다',async t=>{
  const waiting=hold(),called=[];
  const fetch=async(raw,{signal})=>{
    const u=new URL(raw),format=u.searchParams.get('format')||'list';called.push(format);
    if(format==='list')return Response.json({messages:[{id:'a5'}]});
    const blocked=new Promise((resolve,reject)=>{
      signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
    });
    waiting.resolve();return blocked;
  };
  const f=await fixture(t,{mail:{search:require('../src/office-mail-api.cjs').searchMailbox,fetch}});
  await f.mail.connect(owner,'gmail');const job=request('메일 찾아줘');await f.service.submit(owner,job);
  await waiting.promise;await f.mail.disconnect(owner,'gmail');
  const changed=await f.row(job.id,'failed');assert.equal(changed.reason,'MAIL_CHOOSE');assert.equal(changed.mailDecisionReason,'MAIL_CHANGED');
  assert.deepEqual(called,['list','metadata']);assert.equal(await f.mail.vault.read(owner.synk_user_id,job.id),null);
});
test('메일 업무 다음의 일반 요청은 고르기 전까지 금고·연결·GPT를 읽지 않고 두 선택의 경계를 지킨다',async t=>{
  const f=await fixture(t,{ordinary:true});await f.mail.connect(owner,'gmail');
  const first=request('견적 메일 찾아줘');await f.service.submit(owner,first);await f.row(first.id,'completed');
  const prompt='Find the bug in the email validation function';
  const reads=[],read=f.mail.vault.read;f.mail.vault.read=async(...args)=>{reads.push(args[1]);return read(...args);};
  const beforePlans=f.state.worker.length,beforeCalls=f.state.issued.length;
  const choice=request(prompt,{previousId:first.id});
  assert.equal((await f.service.submit(owner,choice)).ok,true);
  assert.deepEqual(reads,[]);assert.equal(f.state.worker.length,beforePlans);assert.equal(f.state.issued.length,beforeCalls);
  const waiting=await f.row(choice.id,'failed');assert.equal(waiting.reason,'MAIL_CHOOSE');assert.equal(waiting.previousId,first.id);
  const ordinary=request(prompt,{previousId:waiting.previousId,mailSearch:false});await f.service.submit(owner,ordinary);await f.row(ordinary.id,'completed');
  assert.equal(f.state.issued.length,beforeCalls);assert.equal(f.state.worker.at(-1).previousId,null);
  await f.mail.connect(owner,'gmail');
  const selected=request(prompt,{previousId:waiting.previousId,mailSearch:true});await f.service.submit(owner,selected);await f.row(selected.id,'completed');
  assert.equal(f.state.issued.length,beforeCalls+1);assert.equal(f.state.worker.at(-1).previousId,first.id);
});
test('같은 사서함을 다시 승인한 뒤 조건을 이어가고 처음부터 연결된 다른 메일함으로 전환한다',async t=>{
  const f=await fixture(t,{plan:spec=>({...initial,provider:spec.prompt.includes('Outlook')?'outlook':'gmail',inherit:!!spec.previousMail})});
  await f.mail.connect(owner,'gmail');await f.mail.connect(owner,'outlook');
  const first=request('Gmail 견적 메일 찾아줘');await f.service.submit(owner,first);await f.row(first.id,'completed');
  await f.mail.connect(owner,'gmail');
  const next=request('같은 메일함에서 다시 찾아줘',{previousId:first.id,mailSearch:true});await f.service.submit(owner,next);await f.row(next.id,'completed');
  const switchBox=request('이번에는 Outlook에서',{previousId:next.id,mailSearch:true});await f.service.submit(owner,switchBox);await f.row(switchBox.id,'completed');
  assert.deepEqual(f.state.issued.map(q=>q.provider),['gmail','gmail','outlook']);
});
test('부분 실패를 같은 조건으로 다시 검색하면 성공한 메일함과 앞선 근거를 보존한다',async t=>{
  const f=await fixture(t);for(const p of ['gmail','outlook'])await f.mail.connect(owner,p);
  f.state.outlookFails=true;const job=request('견적 메일 검색');await f.service.submit(owner,job);
  const first=await f.row(job.id,'completed');assert.equal(first.mailResult.groups[1].code,'MAIL_LIMIT');
  await f.mail.disconnect(owner,'gmail');
  f.state.outlookFails=false;
  const retry=request(job.prompt,{previousId:job.id,mailSearch:true,mailRetry:true});
  assert.equal((await f.service.submit(owner,retry)).ok,true);
  const next=await f.row(retry.id,'completed');assert.equal(next.mailResult.groups[1].items.length,1);
  assert.deepEqual(next.mailResult.groups[0],first.mailResult.groups[0]);
  assert.deepEqual(f.state.issued.map(c=>c.provider),['gmail','outlook','outlook']);assert.equal(f.state.worker.length,1);
});
test('같은 메일함의 후속 조건만 로컬에서 합치고 계정을 바꾼 연결은 허용하지 않는다',async t=>{
  const f=await fixture(t,{plan:spec=>spec.previousMail?{...initial,terms:[],from:'manager',folder:'',inherit:true}:initial});
  await f.mail.connect(owner,'gmail');const job=request('메일에서 견적 찾아줘');await f.service.submit(owner,job);await f.row(job.id,'completed');
  const next=request('그중 담당자가 보낸 것만',{previousId:job.id,mailSearch:true});await f.service.submit(owner,next);await f.row(next.id,'completed');
  assert.deepEqual(f.state.issued[1].plan.terms,['견적']);assert.equal(f.state.issued[1].plan.from,'manager');
  assert.ok(!JSON.stringify(f.state.worker[1]).includes(canary));
  f.state.subject='another';assert.equal((await f.mail.connect(owner,'gmail')).code,'MAIL_CHANGED');
  assert.equal((await f.mail.snapshot(owner)).providers[0].connected,true);
});
test('로그아웃 및 연결 해제 뒤 도착한 응답은 업무 카드에 결과를 쓰지 않는다',async t=>{
  const start=hold(),reply=hold();
  let nativeSignal;
  const f=await fixture(t,{mail:{search:async({signal})=>{nativeSignal=signal;start.resolve();await reply.promise;return {items:[],more:false};}}});
  await f.mail.connect(owner,'gmail');const job=request('메일 찾아줘');await f.service.submit(owner,job);
  await start.promise;await f.mail.disconnect(owner,'gmail');assert.equal(nativeSignal.aborted,true);reply.resolve();
  const changed=await f.row(job.id,'failed');assert.equal(changed.reason,'MAIL_CHOOSE');assert.equal(changed.mailDecisionReason,'MAIL_CHANGED');
  assert.equal(await f.mail.vault.read(owner.synk_user_id,job.id),null);
  f.state.account=other;f.service.accountChanged(other);assert.equal((await f.mail.snapshot(owner)).code,'NOT_ALLOWED');
});
test('검색 도중 로그인 회차가 바뀌면 이미 도착한 메일도 새 회차의 카드에 저장하지 않는다',async t=>{
  const start=hold(),reply=hold();let signal;
  const f=await fixture(t,{mail:{search:async options=>{signal=options.signal;start.resolve();await reply.promise;return {items:[],more:false};}}});
  await f.mail.connect(owner,'gmail');const job=request('받은 메일 찾아줘');await f.service.submit(owner,job);await start.promise;
  f.state.account={...owner,sessionGeneration:2};f.service.accountChanged(f.state.account);assert.equal(signal.aborted,true);
  reply.resolve();
  for(let i=0;i<60;i++){
    const row=(await f.service.snapshot(f.state.account)).tasks?.find(task=>task.id===job.id);
    if(row?.status==='interrupted'){assert.equal(row.reason,'AUTH_CHANGED');assert.equal(row.mailResult,undefined);break;}
    if(i===59)assert.fail('new login did not interrupt mail job');await delay(10);
  }
  assert.equal(await f.mail.vault.read(owner.synk_user_id,job.id),null);
});
test('로그아웃 중에 끝난 OAuth 동의는 새 로그인 회차에 저장되지 않는다',async t=>{
  const start=hold(),reply=hold();
  const f=await fixture(t,{mail:{authorize:async()=>{start.resolve();await reply.promise;return {subject:'a',address:'a@example.test',refreshToken:token,scope:'x'};}}});
  const result=f.mail.connect(owner,'gmail');await start.promise;
  f.state.account={...owner,sessionGeneration:2};f.service.accountChanged(f.state.account);reply.resolve();
  assert.equal((await result).ok,false);assert.equal(await f.mail.vault.read(owner.synk_user_id,null),null);
});
test('자동 판정에는 지시와 이전 종류만 쓰고 대기 중에 바뀐 사서함은 조회하지 않는다',async t=>{
  const started=hold(),release=hold();
  const f=await fixture(t,{decision:async(spec)=>{started.resolve(spec);await release.promise;return {kind:'mailbox',plan:initial};}});
  await f.mail.connect(owner,'gmail');
  const reads=[],raw=f.mail.vault.read;
  f.mail.vault.read=async(...args)=>{reads.push(args[1]);return raw(...args);};
  const job=request('메일로 온 견적 파일 찾아줘');
  await f.service.submit(owner,job);const spec=await started.promise;
  assert.equal(spec.prompt,job.prompt);assert.equal(spec.previousKind,null);assert.ok(!Object.hasOwn(spec,'mailBindings'));
  assert.equal((await f.row(job.id,'running')).mailDecision,'pending');
  assert.deepEqual(reads,[]);assert.equal(f.state.issued.length,0);
  await f.mail.disconnect(owner,'gmail');await f.mail.connect(owner,'gmail');release.resolve();
  const result=await f.row(job.id,'failed');assert.equal(result.reason,'MAIL_CHOOSE');assert.equal(result.mailDecisionReason,'MAIL_CHANGED');
  assert.equal(f.state.worker.length,0);assert.equal(f.state.issued.length,0);
});
test('명시 선택은 판정기를 거치지 않고 자동 판정은 재사용해 같은 업무에서 한 번만 실행한다',async t=>{
  const f=await fixture(t,{ordinary:true});await f.mail.connect(owner,'gmail');
  for(const [prompt,extra] of [['Gmail 사용법 설명',{mailSearch:false}],['견적',{mailSearch:true}],['받은편지함에서 견적 메일을 찾아줘',{}]]){
    const job=request(prompt,extra);await f.service.submit(owner,job);await f.row(job.id,'completed');
  }
  assert.equal(f.state.judges.length,1);assert.equal(f.state.issued.length,2);
  assert.equal(f.state.worker.at(-1).preparedMailPlan,initial);
});
test('판정 실패는 원인을 가진 선택으로 끝나고 취소한 판정은 뒤늦은 결과를 실행하지 않는다',async t=>{
  const started=hold(),release=hold();
  const f=await fixture(t,{decision:async spec=>{
    if(spec.prompt.includes('로그인'))throw fail('LOGIN');
    started.resolve();await release.promise;return {kind:'mailbox',plan:initial};
  }});
  const missing=request('로그인 방법 메일 찾아줘');await f.service.submit(owner,missing);
  const choice=await f.row(missing.id,'failed');assert.equal(choice.reason,'MAIL_CHOOSE');assert.equal(choice.mailDecisionReason,'LOGIN');
  const cancel=request('지금 받은 메일 찾아줘');await f.service.submit(owner,cancel);await started.promise;
  assert.ok((await f.service.action(owner,cancel.id,'cancel')).ok);release.resolve();
  assert.equal((await f.row(cancel.id,'interrupted')).reason,'CANCELLED');assert.equal(f.state.issued.length,0);assert.equal(f.state.worker.length,0);
});
test('판정 중에는 이전 일반 회차를 잠그고 동일한 요청을 다시 받아도 한 번만 처리한다',async t=>{
  const start=hold(),release=hold();
  const f=await fixture(t,{ordinary:true,decision:async()=>{start.resolve();await release.promise;return {kind:'ordinary'};}});
  const first=request('회의록 작성해줘');await f.service.submit(owner,first);await f.row(first.id,'completed');
  const next=request('그중 email이 나온 문장만 골라줘',{previousId:first.id});
  assert.ok((await f.service.submit(owner,next)).ok);await start.promise;
  assert.ok((await f.service.submit(owner,next)).ok);assert.equal(f.state.judges.length,1);
  assert.equal((await f.service.submit(owner,{...next,mailSearch:false})).code,'ID_CONFLICT');
  const rival=request('또 하나의 일반 후속',{previousId:first.id});
  assert.equal((await f.service.submit(owner,rival)).code,'BUSY');
  release.resolve();const done=await f.row(next.id,'completed');
  assert.equal(done.mailDecision,'ordinary');assert.equal(f.state.worker.at(-1).sessionId,first.id);assert.equal(f.state.issued.length,0);
});
test('판정 도중 로그인이 바뀌면 다른 로그인에서 늦은 검색 조건을 사용하지 않는다',async t=>{
  const start=hold(),release=hold();
  const f=await fixture(t,{decision:async()=>{start.resolve();await release.promise;return {kind:'mailbox',plan:initial};}});
  await f.mail.connect(owner,'gmail');const job=request('메일로 받은 연락처가 있어?');
  await f.service.submit(owner,job);await start.promise;
  const next={...owner,sessionGeneration:2};f.state.account=next;f.service.accountChanged(next);release.resolve();
  for(let i=0;i<100;i++){
    const after=(await f.service.snapshot(next)).tasks?.find(r=>r.id===job.id);
    if(after?.status==='interrupted'){assert.equal(after.reason,'AUTH_CHANGED');break;}
    if(i===99)assert.fail('decision remained open after login changed');await delay(5);
  }
  assert.equal(f.state.issued.length,0);assert.equal(f.state.worker.length,0);
});
test('검색 직전 재시작해 판정·계정 확인 자료가 사라지면 원래 선택 카드에서 다시 고른다',async t=>{
  const f=await fixture(t);await f.mail.connect(owner,'gmail');
  const job=request('지난주 메일로 받은 견적 찾아줘');
  const rows=[{...job,departmentId:null,departmentName:'사무실',cwd:f.root,sessionId:null,
    providerSalt:job.id,providerTag:null,mailSearch:true,mailDecision:'mailbox',requestMode:'auto',
    mailBindingVersion:f.mail.generation(owner),mailBindings:await f.mail.bindings(owner),
    createdAt:1,updatedAt:1,status:'queued',reason:null,answer:''}];
  const ledger=path.join(f.root,'Office',owner.synk_user_id);
  await fs.mkdir(ledger,{recursive:true});await fs.writeFile(path.join(ledger,'tasks.json'),JSON.stringify({version:1,tasks:rows}));
  const waiting=await f.row(job.id,'failed');assert.equal(waiting.reason,'MAIL_CHOOSE');assert.equal(waiting.prompt,job.prompt);
  assert.equal(waiting.mailDecisionReason,'MAIL_CHANGED');assert.equal(f.state.judges.length,0);assert.equal(f.state.worker.length,0);assert.equal(f.state.issued.length,0);
  assert.equal((await f.service.action(owner,job.id,'resume')).ok,false);
});
test('자동 검색 중 새 메일함을 연결하면 기존 사서함 조회를 취소하고 결과를 저장하지 않는다',async t=>{
  const start=hold(),wait=hold();let signal;
  const f=await fixture(t,{mail:{search:async options=>{signal=options.signal;start.resolve();await wait.promise;return {items:[],more:false};}}});
  await f.mail.connect(owner,'gmail');const query=request('메일로 받은 계약서 찾아줘');await f.service.submit(owner,query);await start.promise;
  await f.mail.connect(owner,'outlook');assert.equal(signal.aborted,true);wait.resolve();
  const changed=await f.row(query.id,'failed');assert.equal(changed.reason,'MAIL_CHOOSE');assert.equal(changed.mailDecisionReason,'MAIL_CHANGED');assert.equal(await f.mail.vault.read(owner.synk_user_id,query.id),null);
});
test('자동 판정을 원장에 올리기 직전 새 연결이 생기면 메일 조회 전에 다시 선택하게 한다',async t=>{
  const start=hold(),wait=hold();
  const f=await fixture(t,{store:store=>({...store,write:async(member,tasks,guard)=>{
    if(tasks.some(r=>r.status==='queued'&&r.mailDecision==='mailbox')){start.resolve();await wait.promise;}
    return store.write(member,tasks,guard);
  }})});
  await f.mail.connect(owner,'gmail');const job=request('견적 메일 찾아줘');await f.service.submit(owner,job);await start.promise;
  await f.mail.connect(owner,'outlook');wait.resolve();
  const choice=await f.row(job.id,'failed');assert.equal(choice.reason,'MAIL_CHOOSE');assert.equal(choice.mailDecisionReason,'MAIL_CHANGED');
  assert.equal(f.state.worker.length,0);assert.equal(f.state.issued.length,0);
});
test('자동 업무가 실행 대기에서 빠져나올 때 연결이 변해도 조회 전에 다시 선택한다',async t=>{
  const start=hold(),resume=hold();let paused=false;
  const f=await fixture(t,{store:s=>({...s,write:async(member,rows,guard)=>{
    if(!paused&&rows.some(r=>r.status==='running'&&r.mailSearch&&r.mailDecision==='mailbox')){
      paused=true;start.resolve();await resume.promise;
    }
    return s.write(member,rows,guard);
  }})});
  await f.mail.connect(owner,'gmail');const job=request('내 받은편지함에서 견적 메일 찾아줘');
  await f.service.submit(owner,job);await start.promise;await f.mail.connect(owner,'outlook');resume.resolve();
  const result=await f.row(job.id,'failed');assert.equal(result.reason,'MAIL_CHOOSE');assert.equal(result.mailDecisionReason,'MAIL_CHANGED');
  assert.equal(f.state.issued.length,0);assert.equal(f.state.worker.length,0);
});
test('명시 검색을 시작할 때 연결 저장소가 실패해도 일반 직원의 다음 일은 실행된다',async t=>{
  const f=await fixture(t,{ordinary:true});await f.mail.connect(owner,'gmail');
  const bindings=f.mail.bindings;let reads=0;
  f.mail.bindings=async a=>{if(++reads===2)throw fail('MAIL_STORAGE');return bindings(a);};
  const job=request('견적',{mailSearch:true}),ordinary=request('고객 안내를 작성해줘',{mailSearch:false});
  assert.ok((await f.service.submit(owner,job)).ok);assert.ok((await f.service.submit(owner,ordinary)).ok);
  assert.equal((await f.row(job.id,'failed')).reason,'MAIL_STORAGE');
  assert.equal((await f.row(ordinary.id,'completed')).answer,'일반 업무 응답');assert.equal(f.state.issued.length,0);
});
test('GPT 계정 재선택을 보관하기 직전 솔리오 로그인도 바뀌면 회원 전환으로 중단한다',async t=>{
  const switched=hold();let arm=false;
  const f=await fixture(t,{store:s=>({...s,read:async(member,scope)=>{
    if(arm&&!scope?.metadataOnly){arm=false;f.state.account={...owner,sessionGeneration:2};switched.resolve();}
    return s.read(member,scope);
  }})});
  await f.mail.connect(owner,'gmail');
  f.mail.run=async()=>{arm=true;throw fail('SESSION');};
  const job=request('견적 메일 찾아줘');await f.service.submit(owner,job);await switched.promise;
  const store=createTaskStore(f.root,undefined,f.mail);let saved;
  for(let i=0;i<100;i++){
    saved=(await store.read(owner.synk_user_id,{metadataOnly:true})).find(r=>r.id===job.id);
    if(saved?.status==='interrupted')break;await delay(10);
  }
  assert.equal(saved.status,'interrupted');assert.equal(saved.reason,'AUTH_CHANGED');assert.notEqual(saved.mailDecision,'choose');
});
test('처음 제출할 때 회원과 사서함이 동시에 바뀌면 회원 변경을 먼저 알리고 업무를 등록하지 않는다',async t=>{
  const f=await fixture(t);await f.mail.connect(owner,'gmail');
  const bindings=f.mail.bindings;
  f.mail.bindings=async a=>{
    const original=await bindings(a);
    await f.mail.connect(owner,'outlook');
    f.state.account={...owner,sessionGeneration:2};
    return original;
  };
  const job=request('견적 메일 찾아줘',{mailSearch:true});
  assert.equal((await f.service.submit(owner,job)).code,'AUTH_CHANGED');assert.equal(f.state.issued.length,0);
  const rows=await createTaskStore(f.root,undefined,f.mail).read(owner.synk_user_id,{metadataOnly:true});
  assert.equal(rows.some(row=>row.id===job.id),false);
});
test('메일 재선택을 디스크에 쓰는 도중 로그인 회차가 바뀌면 이전 선택을 확정하지 않는다',async t=>{
  const started=hold(),result=hold(),writing=hold(),resume=hold();let trapped=false;
  const f=await fixture(t,{mail:{search:async()=>{started.resolve();await result.promise;return {items:[],more:false};}},store:s=>({...s,
    write:async(member,rows,guard)=>{
      if(!trapped&&rows.some(r=>r.reason==='MAIL_CHOOSE'&&r.mailDecisionReason==='MAIL_CHANGED')){
        trapped=true;writing.resolve();await resume.promise;
      }
      return s.write(member,rows,guard);
    }})});
  await f.mail.connect(owner,'gmail');
  const job=request('내 받은편지함에서 견적 메일 찾아줘');await f.service.submit(owner,job);await started.promise;
  await f.mail.connect(owner,'outlook');result.resolve();await writing.promise;
  const next={...owner,sessionGeneration:2};f.state.account=next;f.service.accountChanged(next);resume.resolve();
  const row=(await f.service.snapshot(next)).tasks.find(r=>r.id===job.id);
  assert.equal(row.reason,'AUTH_CHANGED');assert.notEqual(row.mailDecision,'choose');assert.equal(await f.mail.vault.read(owner.synk_user_id,job.id),null);
});
test('로그인을 유지한 채 직원 권한을 회수하면 입력은 남고 인증 변경으로 중단된다',async t=>{
  const start=hold(),release=hold(),stopped=hold();
  const f=await fixture(t,{decision:async()=>{start.resolve();await release.promise;return {kind:'ordinary'};},
    store:store=>({...store,write:async(member,rows,guard)=>{
      await store.write(member,rows,guard);if(rows.some(row=>row.status==='interrupted'))stopped.resolve();
    }})});
  const job=request('이메일 주소 검사 기능을 설명해줘');await f.service.submit(owner,job);await start.promise;
  f.state.permitted=false;release.resolve();await stopped.promise;
  f.state.permitted=true;assert.equal((await f.row(job.id,'interrupted')).reason,'AUTH_CHANGED');
  assert.equal(f.state.worker.length,0);assert.equal(f.state.issued.length,0);
});
test('자동 검색 결과를 암호화 파일로 교체하기 직전 바뀐 연결도 확인한다',async t=>{
  const f=await fixture(t),start=hold(),wait=hold(),write=f.mail.vault.write;
  f.mail.vault.write=async(...args)=>{if(args[1]){start.resolve();await wait.promise;}return write(...args);};
  await f.mail.connect(owner,'gmail');const job=request('견적 메일 찾아줘');await f.service.submit(owner,job);await start.promise;
  await f.mail.connect(owner,'outlook');wait.resolve();
  const changed=await f.row(job.id,'failed');assert.equal(changed.reason,'MAIL_CHOOSE');assert.equal(changed.mailDecisionReason,'MAIL_CHANGED');assert.equal(await f.mail.vault.read(owner.synk_user_id,job.id),null);
});
