'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {randomUUID,randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {setTimeout:delay}=require('node:timers/promises');
const {createOfficeMail}=require('../src/office-mail.cjs');
const {createOfficeTasks}=require('../src/office-tasks.cjs');
const {withMailPlannerAccount}=require('../src/office-task-codex.cjs');
const {checkDecision,explicitPlan}=require('../src/office-mail-api.cjs');

const member={synk_user_id:'mail_confirm_fixture',sessionGeneration:1};
const other={synk_user_id:'mail_confirm_other',sessionGeneration:1};
const filter={terms:[],from:'',after:'',before:'',folder:'received',provider:'all',attachment:''};
const prompt='견적 메일에서 파일 속 이름을 찾아줘';
const proposal={filter:{...filter,terms:['견적']},quotes:['견적','외부 문자열'],unmet:['파일 속 이름'],reason:'unsupported'};
const request=(fields={})=>({id:randomUUID(),provider:'codex',prompt,...fields});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

// The product reads the signed-in worker before and after accepting a prepared filter.
// Only the official account/read transport and the two mail providers are substituted.
function accountTransport(state){
  return (file,args)=>{
    assert.equal(args[0],'app-server');
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
    let input='',stopped=false;
    const close=()=>{if(stopped)return;stopped=true;child.stdout.end();child.stderr.end();child.emit('exit',0);child.emit('close',0);};
    child.kill=()=>{close();return true;};
    child.stdin.on('end',close);
    child.stdin.on('data',data=>{
      input+=data.toString();
      for(let nl;(nl=input.indexOf('\n'))>=0;){
        const packet=JSON.parse(input.slice(0,nl));input=input.slice(nl+1);
        if(packet.method==='initialized')continue;
        let result={userAgent:'fixture',platformFamily:'windows',platformOs:'windows'};
        if(packet.method!=='initialize'){
          assert.equal(packet.method,'account/read');state.accountReads++;
          result={account:{type:'chatgpt',email:'example@example.test'},userId:'fake-user',workspaceRouting:{chatgptAccountId:state.workspace}};
        }
        child.stdout.write(JSON.stringify({id:packet.id,result})+'\n');
      }
    });
    return child;
  };
}

async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'solio-mail-review-')),key=randomBytes(32);
  const state={member,workspace:'example-workspace',allowed:true,proposal,models:0,accountReads:0,prepared:0,lookups:[]};
  const secrets={available:()=>true,encrypt(value){
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);
  },decrypt(bytes){
    const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
  }};
  let tasks,mail;
  const current=()=>state.member,authorized=async a=>state.allowed&&a.synk_user_id===member.synk_user_id;
  function start(){
    mail=createOfficeMail({userData:dir,secrets,current,authorized,clients:async()=>({gmail:{id:'g'},outlook:{id:'o'}}),
      authorize:async({provider})=>({subject:(state.mailAlias||'fixture')+'-'+provider,address:(state.mailAlias||'fixture')+'-'+provider+'@example.test',refreshToken:'fixture',scope:'read'}),
      refresh:async()=>({access:'fixture',refreshToken:'fixture',scope:'read'}),openExternal:async()=>assert.fail('external opening'),
      search:async({provider,plan,signal})=>{
        state.lookups.push({provider,plan});if(state.onSearch)await state.onSearch(signal);
        return {items:[],more:false};
      }});
    tasks=createOfficeTasks({userData:dir,current,authorized,mail,context:async()=>({ok:true,name:'사무실',cwd:dir,cap:2}),
      run:(spec,hooks)=>withMailPlannerAccount(spec,hooks,{file:'synthetic-account-cli',env:{},spawn:accountTransport(state)},async()=>{
        if(spec.preparedMailPlan){state.prepared++;return spec.preparedMailPlan;}
        state.models++;
        if(state.packet)return spec.mailJudge?checkDecision(state.packet,spec.prompt,spec.previousKind):explicitPlan(state.packet,spec.prompt,new Date(),spec.previousMail?'mail':null);
        if(state.plan)return spec.mailJudge?{kind:'mailbox',plan:state.plan}:state.plan;
        if(spec.mailJudge)return {kind:'review',review:state.proposal};
        throw Object.assign(new Error('MAIL_REVIEW'),{code:'MAIL_REVIEW',review:state.proposal});
      })});
  }
  start();
  async function row(id,status){
    for(let i=0;i<300;i++){
      const task=(await tasks.snapshot(current())).tasks?.find(r=>r.id===id);if(task?.status===status)return task;await delay(10);
    }
    assert.fail('Missing '+status+' for '+id);
  }
  async function restart(){tasks.close();await tasks.snapshot(member);start();}
  t.after(async()=>{tasks.close();await tasks.snapshot(member);await fs.rm(dir,{recursive:true,force:true});});
  return {dir,state,row,restart,get tasks(){return tasks;},get mail(){return mail;},
    // This helper represents a member who checked the editor's omission box.
    confirm:(id,reviewId,edited)=>tasks.action(current(),id,'confirmMail',{reviewId,filter:edited,omitUnmet:true})};
}

for(const mode of ['auto','explicit']){
  test(mode+' 조건 확인은 원래 카드에 한 번 실행하고 새 입력은 암호화 영수증에만 둔다',async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
    const job=request(mode==='explicit'?{mailSearch:true}:{});
    assert.equal((await f.tasks.submit(member,job)).ok,true);
    const waiting=await f.row(job.id,'failed');assert.equal(waiting.reason,'MAIL_REVIEW');
    assert.deepEqual(waiting.mailReview.quotes,['견적']);assert.deepEqual(waiting.mailReview.unmet,['파일 속 이름']);
    assert.deepEqual(waiting.mailReview.filter,proposal.filter);assert.equal(f.state.models,1);assert.equal(f.state.lookups.length,0);
    const sealed=await f.mail.vault.read(member.synk_user_id,job.id);
    assert.deepEqual(sealed,{kind:'mail-review',reason:'unsupported',unmet:['파일 속 이름'],filter:proposal.filter});
    const draftBytes=await fs.readFile(path.join(f.dir,'OfficeMail',member.synk_user_id,job.id+'.enc'));
    assert.ok(!draftBytes.includes(Buffer.from('파일 속 이름'))&&!draftBytes.includes(Buffer.from(waiting.mailReview.reviewId)));
    const edited={...filter,terms:['수정한표식'],provider:'gmail',folder:'sent',after:'2026-11-09',before:'2026-11-16',attachment:'has'};
    const oldId=waiting.mailReview.reviewId;
    const renewed=await f.tasks.action(member,job.id,'reviewMail');assert.equal(renewed.ok,true);assert.notEqual(renewed.mailReview.reviewId,oldId);
    assert.equal((await f.confirm(job.id,oldId,edited)).code,'SESSION');
    const reviewId=renewed.mailReview.reviewId;
    assert.equal((await f.confirm(job.id,reviewId,{...edited,after:'2026-11-23'})).ok,false);
    assert.equal((await f.confirm(job.id,reviewId,{...edited,access:'forbidden'})).ok,false);
    assert.equal((await f.tasks.action(other,job.id,'confirmMail',{reviewId,filter:edited})).ok,false);
    const before=f.state.accountReads;
    const twice=await Promise.all([f.confirm(job.id,reviewId,edited),f.confirm(job.id,reviewId,edited)]);
    assert.deepEqual(twice.map(r=>r.ok),[true,false]);
    const done=await f.row(job.id,'completed');assert.equal(done.id,job.id);assert.equal(done.prompt,prompt);
    assert.equal((await f.tasks.snapshot(member)).tasks.length,1);
    assert.equal(f.state.models,1);assert.equal(f.state.prepared,1);assert.equal(f.state.accountReads-before,2);assert.equal(f.state.lookups.length,1);
    assert.equal(f.state.lookups[0].provider,'gmail');
    for(const k of Object.keys(edited))assert.deepEqual(f.state.lookups[0].plan[k],edited[k]);
    const file=path.join(f.dir,'Office',member.synk_user_id,'tasks.json');
    const metadata=await fs.readFile(file,'utf8');assert.ok(!metadata.includes('수정한표식')&&!metadata.includes(reviewId)&&!metadata.includes('"quotes"'));
    assert.deepEqual((await f.mail.vault.read(member.synk_user_id,job.id)).plan.terms,edited.terms);
    await f.restart();const restored=await f.row(job.id,'completed');assert.deepEqual(restored.mailResult,done.mailResult);
    assert.equal(f.state.models,1);assert.equal(f.state.lookups.length,1);
  });
}

test('재시작은 암호화한 검증 조건과 미지원 구절을 복원하고 이전 번호와 취소된 번호를 막는다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');
  f.state.plan={...filter,terms:['계약'],provider:'gmail',folder:'inbox',inherit:false};
  const parent=request({prompt:'계약 메일 찾아줘',mailSearch:true});await f.tasks.submit(member,parent);await f.row(parent.id,'completed');
  const legacy=await f.mail.vault.read(member.synk_user_id,parent.id);
  delete legacy.plan.attachment;delete legacy.plan.clear;delete legacy.plan.mergeTerms;delete legacy.availableBindings;delete legacy.readBindings;
  await f.mail.vault.write(member.synk_user_id,parent.id,legacy,()=>true);
  const oldFile=path.join(f.dir,'OfficeMail',member.synk_user_id,parent.id+'.enc'),originalBytes=await fs.readFile(oldFile);
  f.state.plan=null;f.state.proposal={...proposal,plan:{...filter,terms:['견적'],folder:'',provider:'',inherit:true,mergeTerms:'add'}};
  const work=request({previousId:parent.id});await f.tasks.submit(member,work);const first=await f.row(work.id,'failed');
  assert.deepEqual(first.mailReview.filter,{...filter,terms:['계약','견적'],folder:'inbox',provider:'gmail'});
  const original=first.mailReview.reviewId;
  await f.restart();const after=await f.row(work.id,'failed');assert.equal(after.mailReview,undefined);
  assert.equal((await f.confirm(work.id,original,filter)).code,'SESSION');
  const overlay=await f.tasks.action(member,work.id,'reviewMail');assert.equal(overlay.ok,true);
  assert.deepEqual(overlay.mailReview.filter,first.mailReview.filter);
  assert.deepEqual(overlay.mailReview.quotes,[]);assert.deepEqual(overlay.mailReview.unmet,['파일 속 이름']);assert.equal(overlay.mailReview.reason,'unsupported');
  assert.deepEqual(overlay.mailReview.availableProviders,['gmail']);
  assert.notEqual(overlay.mailReview.reviewId,original);
  assert.equal((await f.tasks.action(member,work.id,'cancel')).ok,true);
  assert.equal((await f.confirm(work.id,overlay.mailReview.reviewId,filter)).code,'SESSION');
  assert.equal((await f.row(work.id,'interrupted')).reason,'CANCELLED');assert.equal(f.state.models,2);assert.equal(f.state.lookups.length,1);
  assert.deepEqual(await fs.readFile(oldFile),originalBytes);
});

test('현재 계획 검증기가 보내는 자동 확인 결과와 명시 검색 오류가 모두 같은 카드로 돌아온다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');
  f.state.packet={terms:['견적'],from:'',after:'',before:'',folder:'',provider:'',attachment:'',inherit:false,clear:[],mergeTerms:'replace',
    scope:'mailbox',mailRef:'메일',otherRef:'',period:'',evidence:[{role:'about',quote:'견적',nth:1}],unmet:['파일 속 이름']};
  for(const mode of ['auto','explicit']){
    const job=request(mode==='explicit'?{mailSearch:true}:{});
    await f.tasks.submit(member,job);const before=await f.row(job.id,'failed');
    assert.equal(before.mailReview.reason,'unsupported');assert.deepEqual(before.mailReview.unmet,['파일 속 이름']);
    assert.deepEqual(before.mailReview.quotes,['견적']);assert.deepEqual(before.mailReview.filter.terms,['견적']);
    assert.equal((await f.confirm(job.id,before.mailReview.reviewId,{...filter,provider:'gmail',terms:['연습']})).ok,true);
    const after=await f.row(job.id,'completed');assert.equal(after.id,before.id);assert.equal(after.prompt,before.prompt);
  }
  assert.equal(f.state.models,2);assert.equal(f.state.prepared,2);assert.equal(f.state.lookups.length,2);
});

test('승인한 검색의 첫 사서함 처리 중 권한이나 연결이 바뀌면 둘째 사서함과 영수증을 건너뛴다',async t=>{
  for(const change of ['login','permission','binding']){
    await t.test(change,async t=>{
      const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
      const job=request();await f.tasks.submit(member,job);const waiting=await f.row(job.id,'failed');
      const started=deferred(),release=deferred();f.state.onSearch=()=>{started.resolve();return release.promise;};
      assert.equal((await f.confirm(job.id,waiting.mailReview.reviewId,filter)).ok,true);await started.promise;
      if(change==='login'){f.state.member={...member,sessionGeneration:2};f.tasks.accountChanged(f.state.member);}
      if(change==='permission')f.state.allowed=false;
      if(change==='binding')await f.mail.connect(member,'outlook');
      release.resolve();
      const file=path.join(f.dir,'Office',member.synk_user_id,'tasks.json');
      let stopped;
      for(let i=0;i<300;i++){
        stopped=JSON.parse(await fs.readFile(file,'utf8')).tasks.find(r=>r.id===job.id);
        if(['failed','interrupted'].includes(stopped.status))break;
        await delay(10);
      }
      assert.equal(stopped.mailReason||stopped.reason,change==='binding'?'MAIL_CHANGED':'AUTH_CHANGED');
      assert.deepEqual(f.state.lookups.map(r=>r.provider),['gmail']);assert.equal(f.state.models,1);
      assert.equal((await f.mail.vault.read(member.synk_user_id,job.id)).kind,'mail-review');
    });
  }
});

test('확인 중 회원 로그인·읽기 권한·메일 연결·GPT 작업공간이 달라지면 조회하지 않는다',async t=>{
  for(const change of ['member','permission','binding','worker']){
    await t.test(change,async t=>{
      const f=await fixture(t);await f.mail.connect(member,'gmail');const work=request();await f.tasks.submit(member,work);
      const card=await f.row(work.id,'failed'),nonce=card.mailReview.reviewId;
      if(change==='member'){f.state.member={...member,sessionGeneration:2};f.tasks.accountChanged(f.state.member);}
      if(change==='permission')f.state.allowed=false;
      if(change==='binding')await f.mail.connect(member,'gmail');
      if(change==='worker')f.state.workspace='second-workspace';
      const accepted=await f.confirm(work.id,nonce,filter);
      if(change==='worker'){assert.equal(accepted.ok,true);assert.equal((await f.row(work.id,'failed')).reason,'LOGIN');}
      else assert.equal(accepted.ok,false);
      if(change==='binding')assert.equal((await f.tasks.action(member,work.id,'reviewMail')).code,'MAIL_CHANGED');
      assert.equal(f.state.models,1);assert.equal(f.state.lookups.length,0);assert.equal((await f.mail.vault.read(member.synk_user_id,work.id)).kind,'mail-review');
    });
  }
});

test('첫 공급자의 응답을 기다릴 때 취소하면 두 번째 공급자와 영수증에 접근하지 않는다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
  const work=request({mailSearch:true});await f.tasks.submit(member,work);const card=await f.row(work.id,'failed');
  const started=deferred(),ended=deferred();
  f.state.onSearch=async signal=>{started.resolve();await new Promise(r=>signal.addEventListener('abort',r,{once:true}));ended.resolve();};
  assert.equal((await f.confirm(work.id,card.mailReview.reviewId,filter)).ok,true);await started.promise;
  assert.equal((await f.tasks.action(member,work.id,'cancel')).ok,true);await ended.promise;
  assert.equal((await f.row(work.id,'interrupted')).reason,'CANCELLED');assert.deepEqual(f.state.lookups.map(r=>r.provider),['gmail']);
  assert.equal(f.state.models,1);assert.equal((await f.mail.vault.read(member.synk_user_id,work.id)).kind,'mail-review');
});

test('이전 업무와 여전히 같은 사서함만 자동 검색과 수동 확인의 전체 연결에 포함한다',async t=>{
  for(const [mode,replacement] of [['auto',false],['auto',true],['manual',false],['manual',true]]){
    await t.test(mode+' '+(replacement?'다른 주소':'연결 해제'),async t=>{
      const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
      f.state.plan={...filter,terms:['계약'],folder:'inbox',inherit:false};
      const parent=request({mailSearch:true,prompt:'계약 메일 찾아줘'});await f.tasks.submit(member,parent);await f.row(parent.id,'completed');
      assert.deepEqual(f.state.lookups.map(x=>x.provider),['gmail','outlook']);await f.mail.disconnect(member,'outlook');
      if(replacement){f.state.mailAlias='other-account';await f.mail.connect(member,'outlook');}
      f.state.plan=mode==='auto'?{...filter,terms:['견적'],provider:'',folder:'',inherit:true}:null;
      const job=request({previousId:parent.id});await f.tasks.submit(member,job);
      if(mode==='manual'){
        const card=await f.row(job.id,'failed');assert.deepEqual(card.mailReview.availableProviders,['gmail']);
        assert.equal((await f.confirm(job.id,card.mailReview.reviewId,{...card.mailReview.filter,provider:'outlook'})).code,'MAIL_CHANGED');
        assert.equal(f.state.lookups.length,2);assert.equal((await f.confirm(job.id,card.mailReview.reviewId,card.mailReview.filter)).ok,true);
      }
      const done=await f.row(job.id,'completed');assert.deepEqual(done.mailResult.groups.map(g=>g.provider),['gmail']);
      assert.deepEqual(f.state.lookups.slice(2).map(g=>g.provider),['gmail']);assert.equal(f.state.models,2);
    });
  }
});

test('후속과 공통인 사서함이 하나도 없으면 이전 주소나 교체한 주소에 요청하지 않는다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');f.state.plan={...filter,terms:['첫 요청'],inherit:false};
  const parent=request({mailSearch:true,prompt:'첫 요청 메일 검색'});await f.tasks.submit(member,parent);await f.row(parent.id,'completed');
  await f.mail.disconnect(member,'gmail');f.state.mailAlias='different-account';await f.mail.connect(member,'gmail');
  for(const granted of [false,true]){
    const job=request({previousId:parent.id,...(granted?{mailSearch:true}:{})});await f.tasks.submit(member,job);
    const waiting=await f.row(job.id,'failed');
    assert.equal(waiting.reason,granted?'MAIL_CHANGED':'MAIL_CHOOSE');
    if(!granted)assert.equal(waiting.mailDecisionReason,'MAIL_CHANGED');
    assert.equal(await f.mail.vault.read(member.synk_user_id,job.id),null);
  }
  assert.equal(f.state.lookups.length,1);
});

test('후속에서 두 메일함을 직접 지정하면 남은 한 곳의 조회를 같은 카드에서 먼저 확인한다',async t=>{
  for(const mode of ['자동','명시'])await t.test(mode,async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
    f.state.plan={...filter,terms:['견적'],folder:'inbox',inherit:false};
    const parent=request({mailSearch:true,prompt:'견적 메일 찾아줘'});await f.tasks.submit(member,parent);await f.row(parent.id,'completed');
    if(mode==='자동'){
      const saved=await f.mail.vault.read(member.synk_user_id,parent.id);
      delete saved.availableBindings;delete saved.readBindings;for(const binding of saved.bindings)delete binding.lineage;
      await f.mail.vault.write(member.synk_user_id,parent.id,saved,()=>true);await f.restart();
    }
    const oldFile=path.join(f.dir,'OfficeMail',member.synk_user_id,parent.id+'.enc'),oldReceipt=await fs.readFile(oldFile);
    const role=(role,quote)=>({role,quote,nth:1});
    async function submit(text,names,provider,{inherit=true,follow=true,fresh=false}={}){
      f.state.packet={scope:'mailbox',mailRef:names[0]||'',otherRef:'',period:'',unmet:[],terms:['계약서'],from:'',after:'',before:'',folder:'',
        provider,attachment:'',inherit,clear:[],mergeTerms:'replace',
        evidence:[...(follow?[role('followup','그중')]:[]),...names.map(name=>role('provider',name)),role('about','계약서')]};
      const job=request({prompt:text,...(fresh?{}:{previousId:parent.id}),...(mode==='명시'?{mailSearch:true}:{})});
      assert.equal((await f.tasks.submit(member,job)).ok,true);return job.id;
    }
    const both='그중 Gmail과 Outlook의 계약서만 다시 찾아줘';
    const first=await submit(both,['Gmail','Outlook'],'all');const full=await f.row(first,'completed');
    assert.equal(full.mailResult.excludedMailboxes,undefined);assert.doesNotMatch(full.answer,/제외/);
    assert.deepEqual(f.state.lookups.slice(-2).map(b=>b.provider),['gmail','outlook']);
    await f.mail.disconnect(member,'outlook');
    if(mode==='명시'){f.state.mailAlias='another-person';await f.mail.connect(member,'outlook');}
    for(const [text,names,scope] of [['그중 계약서만 다시 찾아줘',[],''],['그중 Gmail의 계약서만 다시 찾아줘',['Gmail'],'gmail']]){
      const count=f.state.lookups.length;const id=await submit(text,names,scope);const automatic=await f.row(id,'completed');
      assert.equal(automatic.mailResult.outcome,undefined);assert.doesNotMatch(automatic.answer,/제외/);
      assert.deepEqual(f.state.lookups.slice(count).map(b=>b.provider),['gmail']);
    }
    const count=f.state.lookups.length,id=await submit(both,['Gmail','Outlook'],'all');
    const card=await f.row(id,'failed');assert.equal(card.reason,'MAIL_REVIEW');assert.equal(card.mailReview.reason,'provider');
    assert.deepEqual(card.mailReview.unmet,['Outlook']);assert.deepEqual(card.mailReview.availableProviders,['gmail']);
    assert.deepEqual(card.mailReview.filter.terms,['계약서']);assert.equal(card.mailReview.filter.folder,'inbox');
    const models=f.state.models;assert.equal(f.state.lookups.length,count);
    await f.restart();await f.row(id,'failed');const restored=await f.tasks.action(member,id,'reviewMail');
    assert.ok(restored.ok);assert.notEqual(restored.mailReview.reviewId,card.mailReview.reviewId);
    assert.deepEqual(restored.mailReview.unmet,['Outlook']);assert.deepEqual(restored.mailReview.availableProviders,['gmail']);
    assert.equal((await f.confirm(id,restored.mailReview.reviewId,{...restored.mailReview.filter,provider:'outlook'})).code,'MAIL_CHANGED');
    assert.equal(f.state.lookups.length,count);assert.ok((await f.confirm(id,restored.mailReview.reviewId,restored.mailReview.filter)).ok);
    const done=await f.row(id,'completed');assert.equal(done.previousId,parent.id);assert.deepEqual(done.mailResult.groups.map(g=>g.provider),['gmail']);
    const exclusions=[{provider:'outlook',address:'fixture-outlook@example.test'}];
    assert.equal(done.mailResult.outcome,'member-excluded');assert.deepEqual(done.mailResult.excludedMailboxes,exclusions);
    assert.ok(done.answer.includes('회원이 Outlook (fixture-outlook@example.test) 메일함을 이번 검색에서 제외했습니다.'));
    assert.ok(!done.answer.includes('another-person'));assert.ok(done.mailResult.groups.every(group=>!group.code));
    const receipt=await f.mail.vault.read(member.synk_user_id,id);assert.deepEqual(receipt.excludedMailboxes,exclusions);
    assert.equal(receipt.outcome,'member-excluded');assert.deepEqual(receipt.bindings.map(b=>b.provider),['gmail']);
    const index=await fs.readFile(path.join(f.dir,'Office',member.synk_user_id,'tasks.json'),'utf8');
    assert.ok(!index.includes('fixture-outlook@example.test')&&!index.includes('member-excluded'));
    await f.restart();const reopened=await f.row(id,'completed');assert.equal(reopened.answer,done.answer);assert.deepEqual(reopened.mailResult,done.mailResult);
    const retry=await f.tasks.submit(member,request({prompt:both,previousId:id,mailSearch:true,mailRetry:true}));assert.equal(retry.code,'SESSION');
    assert.deepEqual(f.state.lookups.slice(count).map(g=>g.provider),['gmail']);assert.equal(f.state.models,models);
    assert.deepEqual(await fs.readFile(oldFile),oldReceipt);
    for(const flags of [{inherit:false,follow:true},{inherit:false,follow:false},{inherit:true,follow:false}]){
      const before=f.state.lookups.length,id=await submit('그중 Gmail과 Outlook에서 계약서를 다시 찾아줘',['Gmail','Outlook'],'all',flags);
      const waiting=await f.row(id,'failed');assert.equal(waiting.previousId,parent.id);assert.equal(waiting.reason,'MAIL_REVIEW');
      assert.equal(waiting.mailReview.reason,'provider');assert.deepEqual(waiting.mailReview.unmet,['Outlook']);assert.deepEqual(waiting.mailReview.availableProviders,['gmail']);
      assert.equal(waiting.mailReview.filter.folder,'inbox');assert.deepEqual(waiting.mailReview.filter.terms,['계약서']);
      assert.equal(f.state.lookups.length,before);const models=f.state.models;
      assert.ok((await f.confirm(id,waiting.mailReview.reviewId,waiting.mailReview.filter)).ok);
      const done=await f.row(id,'completed');assert.deepEqual(done.mailResult.excludedMailboxes,exclusions);assert.equal(f.state.models,models);
      assert.deepEqual(f.state.lookups.slice(before).map(b=>b.provider),['gmail']);
    }
    const missingAt=f.state.lookups.length,missing=await submit('그중 Outlook에서 계약서를 다시 찾아줘',['Outlook'],'outlook',{inherit:false,follow:false});
    const stop=await f.row(missing,'failed');assert.equal(stop.mailDecisionReason||stop.reason,'MAIL_CHANGED');assert.equal(f.state.lookups.length,missingAt);
    if(mode==='자동'){f.state.mailAlias='another-person';await f.mail.connect(member,'outlook');}
    const freshAt=f.state.lookups.length;
    const independent=await submit('Gmail과 Outlook에서 계약서를 찾아줘',['Gmail','Outlook'],'all',{inherit:false,follow:false,fresh:true});
    const fresh=await f.row(independent,'completed');assert.equal(fresh.mailResult.excludedMailboxes,undefined);
    assert.deepEqual(f.state.lookups.slice(freshAt).map(b=>b.provider),['gmail','outlook']);assert.equal(fresh.mailResult.groups[1].address,'another-person-outlook@example.test');
  });
});

test('새 확인 카드의 암호문이 손상되거나 없으면 재시작 후 제약을 비우지 않는다',async t=>{
  for(const damage of ['missing','invalid']){
    await t.test(damage,async t=>{
      const f=await fixture(t);await f.mail.connect(member,'gmail');const job=request();await f.tasks.submit(member,job);
      const old=await f.row(job.id,'failed');assert.equal(old.mailReview.unmet.length,1);
      const file=path.join(f.dir,'OfficeMail',member.synk_user_id,job.id+'.enc');
      if(damage==='missing')await fs.unlink(file);
      else await f.mail.vault.write(member.synk_user_id,job.id,{kind:'mail-review',reason:'unsupported',unmet:[],filter},()=>true);
      await f.restart();const reopened=await f.tasks.action(member,job.id,'reviewMail');
      assert.equal(reopened.code,'MAIL_STORAGE');assert.equal((await f.confirm(job.id,old.mailReview.reviewId,filter)).ok,false);
      assert.equal(f.state.lookups.length,0);assert.equal(f.state.models,1);
    });
  }
});

test('처음 맡긴 업무와 이전 업무 모두 명시한 두 메일함의 범위를 회원이 확인한다',async t=>{
  for(const mode of ['auto','explicit'])await t.test(mode,async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');
    const both='Gmail과 Outlook에서 계약서 메일 찾아줘',follow='그중 Gmail과 Outlook의 계약서만 다시 찾아줘';
    const role=(role,quote)=>({role,quote,nth:1});
    async function ask(prompt,wrong=false,previousId){
      f.state.packet={scope:'mailbox',mailRef:'Gmail',otherRef:'',unmet:[],period:'',terms:['계약서'],from:'',after:'',before:'',folder:'',
        provider:wrong?'gmail':'all',inherit:false,clear:[],mergeTerms:'replace',attachment:'',
        evidence:[role('provider','Gmail'),role(wrong?'about':'provider','Outlook'),role('about','계약서')]};
      const job=request({prompt,...(previousId?{previousId}:{}),...(mode==='explicit'?{mailSearch:true}:{})});
      assert.ok((await f.tasks.submit(member,job)).ok);return job.id;
    }
    const newId=await ask(both);const first=await f.row(newId,'failed');assert.equal(first.reason,'MAIL_REVIEW');
    assert.equal(first.mailReview.reason,'provider');assert.deepEqual(first.mailReview.availableProviders,['gmail']);assert.deepEqual(first.mailReview.unmet,['Outlook']);
    assert.equal(f.state.lookups.length,0);const firstModels=f.state.models;assert.ok((await f.confirm(newId,first.mailReview.reviewId,first.mailReview.filter)).ok);
    const result=await f.row(newId,'completed');assert.deepEqual(result.mailResult.excludedMailboxes,[{provider:'outlook'}]);
    assert.deepEqual(f.state.lookups.map(v=>v.provider),['gmail']);assert.equal(f.state.models,firstModels);

    const pendingId=await ask(both,true),pending=await f.row(pendingId,'failed');
    assert.equal(pending.mailReview.filter.provider,'all');assert.deepEqual(pending.mailReview.unmet,['Outlook']);assert.deepEqual(pending.mailReview.availableProviders,['gmail']);
    await f.mail.connect(member,'outlook');const changed=await f.confirm(pendingId,pending.mailReview.reviewId,pending.mailReview.filter);
    assert.equal(changed.code,'MAIL_CHANGED');assert.equal(f.state.lookups.length,1);

    const parentId=await ask(both);const parent=await f.row(parentId,'completed');assert.deepEqual(parent.mailResult.groups.map(g=>g.provider),['gmail','outlook']);
    const allId=await ask(both,true),all=await f.row(allId,'failed');assert.equal(all.mailReview.reason,'provider');
    assert.deepEqual(all.mailReview.availableProviders,['gmail','outlook']);assert.equal(all.mailReview.filter.provider,'all');assert.deepEqual(all.mailReview.unmet,[]);
    assert.equal(f.state.lookups.length,3);assert.ok((await f.confirm(allId,all.mailReview.reviewId,all.mailReview.filter)).ok);
    assert.deepEqual((await f.row(allId,'completed')).mailResult.groups.map(g=>g.provider),['gmail','outlook']);

    await f.mail.disconnect(member,'outlook');f.state.mailAlias='different';await f.mail.connect(member,'outlook');
    const childId=await ask(follow,true,parentId),child=await f.row(childId,'failed');assert.equal(child.previousId,parentId);
    assert.deepEqual(child.mailReview.availableProviders,['gmail']);assert.deepEqual(child.mailReview.unmet,['Outlook']);
    const before=f.state.lookups.length,models=f.state.models;assert.ok((await f.confirm(childId,child.mailReview.reviewId,child.mailReview.filter)).ok);
    const childEnd=await f.row(childId,'completed');assert.deepEqual(childEnd.mailResult.excludedMailboxes,[{provider:'outlook',address:'fixture-outlook@example.test'}]);
    assert.deepEqual(f.state.lookups.slice(before).map(g=>g.provider),['gmail']);assert.equal(f.state.models,models);
  });
});

test('빠진 사서함을 확인할 때 새 검색에 지난 발신자와 기간을 덧붙이지 않는다',async t=>{
  for(const mode of ['auto','explicit'])await t.test(mode,async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
    const previous={...filter,terms:['견적'],from:'Alice',after:'2026-11-09',before:'2026-11-16',folder:'inbox',attachment:'has'};
    f.state.plan={...previous,inherit:false};
    const parent=request({mailSearch:true,prompt:'지난주 받은편지함에서 Alice가 보낸 첨부파일 있는 견적 메일 찾아줘'});
    await f.tasks.submit(member,parent);await f.row(parent.id,'completed');await f.mail.disconnect(member,'outlook');
    const desired={...filter,terms:['계약서']},dates={...desired,after:previous.after,before:previous.before};
    const both='Gmail과 Outlook에서 계약서 메일 찾아줘';
    const role=(role,quote)=>({role,quote,nth:1});
    for(const [text,follow,expected] of [
      [both,'',desired],['그중 말고 '+both,'',desired],
      ['그중 '+both,'',{...previous,terms:desired.terms}],
      ['같은 기간에 '+both,'같은 기간에',dates],['같은 기간에 '+both,'',dates],
      ['Gmail과 Outlook에서 같은 기간에 계약서 메일 찾아줘','같은 기간에',dates]
    ]){
      f.state.packet={...desired,folder:'',inherit:Boolean(follow),mergeTerms:'replace',clear:[],scope:'mailbox',mailRef:'Gmail',otherRef:'',period:'',unmet:[],
        evidence:[role('provider','Gmail'),role('provider','Outlook'),role('about','계약서'),...(follow?[role('followup',follow)]:[])]};
      const job=request({previousId:parent.id,prompt:text,...(mode==='explicit'?{mailSearch:true}:{})});
      const before=f.state.lookups.length;await f.tasks.submit(member,job);
      const card=await f.row(job.id,'failed');assert.equal(card.reason,'MAIL_REVIEW');
      const review=card.mailReview;assert.deepEqual(review.unmet,['Outlook']);assert.deepEqual(review.availableProviders,['gmail']);
      assert.deepEqual(review.filter,expected,text);assert.equal(f.state.lookups.length,before);
      const models=f.state.models;assert.ok((await f.confirm(job.id,review.reviewId,review.filter)).ok);
      const done=await f.row(job.id,'completed');assert.equal(done.mailResult.outcome,'member-excluded');
      assert.deepEqual(f.state.lookups.slice(before).map(q=>q.provider),['gmail']);assert.equal(f.state.models,models);
      const actual=f.state.lookups[before].plan;
      for(const [key,value] of Object.entries(expected))assert.deepEqual(actual[key],value,key);
    }
  });
});

test('검색어·기간을 확인할 때 누락된 원래 계정도 함께 표시하고 승인 뒤 영수증에 남긴다',async t=>{
  for(const mode of ['auto','explicit'])await t.test(mode,async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');await f.mail.connect(member,'outlook');
    f.state.plan={...filter,terms:['견적'],inherit:false};
    const parent=request({mailSearch:true,prompt:'견적 메일 찾아줘'});await f.tasks.submit(member,parent);await f.row(parent.id,'completed');
    await f.mail.disconnect(member,'outlook');f.state.mailAlias='replacement';await f.mail.connect(member,'outlook');
    const role=(role,quote)=>({role,quote,nth:1}),places=[role('provider','Gmail'),role('provider','Outlook')];
    for(const [reason,prompt,terms,originalUnmet,evidence] of [
      ['terms','Gmail과 Outlook에서 ‘예산 보고서’ 메일 찾아줘',[],[],[...places,role('about','예산 보고서')]],
      ['period','Gmail과 Outlook에서 지난주 계약서 메일 찾아줘',['계약서'],[],[...places,role('about','계약서')]],
      ['unsupported','Gmail과 Outlook에서 파일명, 답장 여부, 중요도를 확인하고 계약서 메일 찾아줘',['계약서'],['파일명','답장 여부','중요도'],[...places,role('about','계약서')]],
      ['provider','Gmail에서 Outlook 전환 안내 메일 찾아줘',['Outlook 전환 안내'],[],[role('provider','Gmail'),role('about','Outlook 전환 안내')]]
    ]){
      f.state.packet={...filter,terms,folder:'',inherit:false,mergeTerms:'replace',clear:[],scope:'mailbox',mailRef:'메일',otherRef:'',period:'',unmet:originalUnmet,evidence};
      const before=f.state.lookups.length,job=request({previousId:parent.id,prompt,...(mode==='explicit'?{mailSearch:true}:{})});
      await f.tasks.submit(member,job);const waiting=await f.row(job.id,'failed'),review=waiting.mailReview;
      const missing=reason!=='provider',unmet=missing?[...originalUnmet,'Outlook']:[];
      assert.equal(review.reason,reason);assert.deepEqual(review.unmet,unmet);assert.deepEqual(review.missingProviders,missing?['outlook']:undefined);
      assert.deepEqual(review.availableProviders,['gmail']);
      await f.restart();const restored=await f.tasks.action(member,job.id,'reviewMail');assert.ok(restored.ok);
      const fresh=restored.mailReview;assert.notEqual(fresh.reviewId,review.reviewId);assert.deepEqual(fresh.filter,review.filter);
      assert.equal(fresh.reason,reason);assert.deepEqual(fresh.unmet,unmet);assert.deepEqual(fresh.missingProviders,review.missingProviders);
      assert.equal(f.state.lookups.length,before);const models=f.state.models;
      if(reason==='period'){
        assert.equal((await f.confirm(job.id,fresh.reviewId,fresh.filter)).code,'MAIL_PLAN');
        assert.equal(f.state.lookups.length,before);assert.equal((await f.row(job.id,'failed')).mailReview.reviewId,fresh.reviewId);
      }
      const choice={reviewId:fresh.reviewId,filter:fresh.filter,...(reason==='period'?{allowUnboundedPeriod:true}:{}),...(unmet.length?{omitUnmet:true}:{})};
      assert.ok((await f.tasks.action(member,job.id,'confirmMail',choice)).ok);await f.row(job.id,'completed');
      await f.restart();const final=await f.row(job.id,'completed');
      assert.deepEqual(f.state.lookups.slice(before).map(v=>v.provider),['gmail']);assert.equal(f.state.models,models);
      if(missing){
        assert.deepEqual(final.mailResult.excludedMailboxes,[{provider:'outlook',address:'fixture-outlook@example.test'}]);
        assert.match(final.answer,/Outlook \(fixture-outlook@example\.test\)/u);assert.equal(final.mailResult.outcome,'member-excluded');
      }else{assert.equal(final.mailResult.excludedMailboxes,undefined);assert.doesNotMatch(final.answer,/제외/u);}
      if(reason==='unsupported'){
        assert.deepEqual(final.mailResult.omittedConditions,originalUnmet);
        for(const term of originalUnmet)assert.ok(final.answer.includes(term));
      }else assert.equal(final.mailResult.omittedConditions,undefined);
    }
  });
});

test('빈 기간 사유는 날짜나 회원의 전체 기간 선택이 있어야 같은 카드에서 조회한다',async t=>{
  for(const cold of [false,true])await t.test(cold?'구형 암호 기록을 다시 연 업무':'현재 업무',async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');
    for(const [reason,proposed,edited,allow] of [
      ['period',{}, {after:'2026-11-20'},false],['period',{}, {before:'2026-11-21'},false],
      ['period',{}, {},true],['period',{after:'2026-11-20'}, {},false],['terms',{}, {},false]
    ]){
      f.state.proposal={reason,filter:{...filter,terms:['견적'],...proposed},unmet:[],quotes:[]};
      const job=request({prompt:'견적 메일 날짜 확인'});await f.tasks.submit(member,job);
      let review=(await f.row(job.id,'failed')).mailReview;
      const file=path.join(f.dir,'OfficeMail',member.synk_user_id,job.id+'.enc'),original=await fs.readFile(file);
      const record=await f.mail.vault.read(member.synk_user_id,job.id);
      assert.deepEqual(Object.keys(record).sort(),['filter','kind','reason','unmet']);
      if(cold){
        await f.restart();const reopened=await f.tasks.action(member,job.id,'reviewMail');assert.ok(reopened.ok);
        assert.notEqual(reopened.mailReview.reviewId,review.reviewId);review=reopened.mailReview;
      }
      const bare={reviewId:review.reviewId,filter:{...review.filter,after:'',before:''}},before=f.state.lookups.length,models=f.state.models;
      const confirm=request=>f.tasks.action(member,job.id,'confirmMail',request);
      if(reason==='period'&&!proposed.after){
        for(const extra of [{},{allowUnboundedPeriod:false},{allowUnboundedPeriod:'true'},{allowUnboundedPeriod:true,other:true}]){
          const response=await confirm({...bare,...extra});assert.equal(response.ok,false);
          assert.equal((await f.row(job.id,'failed')).mailReview.reviewId,review.reviewId);
          assert.deepEqual(await fs.readFile(file),original);assert.equal(f.state.lookups.length,before);assert.equal(f.state.models,models);
        }
      }
      assert.ok((await confirm({...bare,filter:{...bare.filter,...edited},...(allow?{allowUnboundedPeriod:true}:{})})).ok);
      await f.row(job.id,'completed');assert.equal(f.state.lookups.length,before+1);assert.equal(f.state.models,models);
      const receipt=await f.mail.vault.read(member.synk_user_id,job.id);
      assert.equal(receipt.plan.after,edited.after||'');assert.equal(receipt.plan.before,edited.before||'');
      assert.equal(JSON.stringify(receipt).includes('allowUnboundedPeriod'),false);
    }
  });
});

test('미지원 구절과 기한이 함께 확인 대상이면 두 선택이 같은 업무에서 충족돼야 한다',async t=>{
  for(const cold of [false,true])await t.test(cold?'앱을 다시 연 뒤':'첫 확인 중',async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');
    const role=(role,quote)=>({role,quote,nth:1}),prompt='Gmail과 Outlook에서 11월 중에 받은 안 읽은 견적 메일 찾아줘';
    f.state.packet={...filter,terms:['견적'],folder:'',inherit:false,clear:[],mergeTerms:'replace',scope:'mailbox',
      mailRef:'메일',otherRef:'',period:'',unmet:['안 읽은'],evidence:[role('provider','Gmail'),role('provider','Outlook'),role('about','견적')]};
    const job=request({prompt,...(cold?{mailSearch:true}:{})});await f.tasks.submit(member,job);
    let view=(await f.row(job.id,'failed')).mailReview;
    assert.equal(view.reason,'unsupported');assert.equal(view.requiresPeriodChoice,true);
    assert.deepEqual(view.unmet,['안 읽은','Outlook']);assert.deepEqual(view.missingProviders,['outlook']);assert.deepEqual(view.availableProviders,['gmail']);
    const file=path.join(f.dir,'OfficeMail',member.synk_user_id,job.id+'.enc'),bytes=await fs.readFile(file);
    assert.equal((await f.mail.vault.read(member.synk_user_id,job.id)).requiresPeriodChoice,true);
    if(cold){
      await f.restart();const renewed=await f.tasks.action(member,job.id,'reviewMail');assert.ok(renewed.ok);
      assert.notEqual(renewed.mailReview.reviewId,view.reviewId);assert.equal(renewed.mailReview.requiresPeriodChoice,true);view=renewed.mailReview;
    }
    const models=f.state.models,base={reviewId:view.reviewId,filter:view.filter};
    for(const changes of [{},{omitUnmet:false,allowUnboundedPeriod:false},{omitUnmet:true},{allowUnboundedPeriod:true},{filter:{...view.filter,after:'2026-11-01'}}]){
      assert.equal((await f.tasks.action(member,job.id,'confirmMail',{...base,...changes})).code,'MAIL_PLAN');
      assert.equal(f.state.lookups.length,0);assert.equal(f.state.models,models);
      assert.equal((await f.row(job.id,'failed')).mailReview.reviewId,view.reviewId);assert.deepEqual(await fs.readFile(file),bytes);
    }
    const choices=cold?{omitUnmet:true,filter:{...view.filter,before:'2026-12-01'}}:{omitUnmet:true,allowUnboundedPeriod:true};
    assert.ok((await f.tasks.action(member,job.id,'confirmMail',{...base,...choices})).ok);
    const done=await f.row(job.id,'completed');assert.deepEqual(f.state.lookups.map(x=>x.provider),['gmail']);assert.equal(f.state.models,models);
    assert.deepEqual(done.mailResult.omittedConditions,['안 읽은']);assert.deepEqual(done.mailResult.excludedMailboxes,[{provider:'outlook'}]);
    const result=await f.mail.vault.read(member.synk_user_id,job.id);assert.equal(result.plan.before,cold?'2026-12-01':'');
    assert.ok(!Object.hasOwn(result,'requiresPeriodChoice')&&!Object.hasOwn(result,'allowUnboundedPeriod')&&!Object.hasOwn(result,'omitUnmet'));
  });
});

test('제목 속 단어, 읽음·별표 조건과 여러 제목을 빠뜨리지 않고 승인 영수증에 보존한다',async t=>{
  const cases=[
    {prompt:'Find unread emails with "unread invoice reminders" in the subject',terms:['unread invoice reminders'],
      expected:['"unread invoice reminders" in the subject','unread']},
    {prompt:'Find unread and starred emails with "renewal" in the subject or "extension" in the subject',terms:['renewal','extension'],
      expected:['"renewal" in the subject','"extension" in the subject','unread','starred']},
    {prompt:'Find unread emails with "unread invoice reminders" in the subject',terms:['unread invoice reminders'],claims:['unread status','unread'],
      expected:['unread','"unread invoice reminders" in the subject']},
    {prompt:'Find unread emails about the renewal that nobody has replied to',terms:['renewal'],claims:['reply status','unread'],
      expected:['unread','Find unread emails about the renewal that nobody has replied to']},
    {prompt:'Find unread emails about the renewal that nobody has replied to',terms:['renewal'],claims:['that nobody has replied to','unread'],
      expected:['that nobody has replied to','unread']},
    {prompt:'Find unread and starred emails with "renewal" in the subject or "extension" in the subject',terms:['renewal','extension'],
      claims:['starred emails with "renewal" in the subject','emails with "renewal" in the subject or "extension"','"extension" in the subject'],
      expected:['starred emails with "renewal" in the subject','emails with "renewal" in the subject or "extension"','"extension" in the subject','"renewal" in the subject','unread','starred']},
  ];
  for(const [index,example] of cases.entries())await t.test(example.prompt+(example.claims?' (모델 발췌 포함)':''),async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');
    f.state.packet={...filter,folder:'',provider:'',terms:example.terms,inherit:false,mergeTerms:'replace',clear:[],scope:'mailbox',mailRef:'emails',otherRef:'',period:'',unmet:example.claims||[],
      evidence:example.terms.map(quote=>({role:'about',quote,nth:1}))};
    const job=request({prompt:example.prompt,...(index%2?{mailSearch:true}:{})});assert.ok((await f.tasks.submit(member,job)).ok);
    const first=await f.row(job.id,'failed');assert.deepEqual(first.mailReview.unmet,example.expected);
    await f.restart();await f.row(job.id,'failed');const review=(await f.tasks.action(member,job.id,'reviewMail')).mailReview;
    assert.notEqual(review.reviewId,first.mailReview.reviewId);assert.deepEqual(review.unmet,example.expected);
    assert.equal((await f.tasks.action(member,job.id,'confirmMail',{reviewId:review.reviewId,filter:review.filter})).code,'MAIL_PLAN');
    assert.equal(f.state.lookups.length,0);assert.ok((await f.confirm(job.id,review.reviewId,review.filter)).ok);
    const done=await f.row(job.id,'completed');assert.deepEqual(done.mailResult.omittedConditions,example.expected);
    assert.deepEqual((await f.mail.vault.read(member.synk_user_id,job.id)).omittedConditions,example.expected);
    for(const s of example.expected)assert.ok(done.answer.includes(s));
    await f.restart();assert.equal((await f.row(job.id,'completed')).answer,done.answer);assert.equal(f.state.models,1);assert.equal(f.state.lookups.length,1);
  });
});

test('겹치는 미지원 발췌와 구형 원문 전체 기록을 각각 누락된 메일함과 따로 복원한다',async t=>{
  const prompt='Gmail과 Outlook에서 자료 조건 가나 다라 마바 명시된 메일을 찾아줘';
  const clips=['자료 조건 가나 다라','조건 가나 다라 마바','가나 다라 마바 명시된 메일','자료 조건 가나 다라 마바 명시된','Outlook'];
  for(const legacy of [false,true])await t.test(legacy?'구판 전체 원문':'겹친 원문 발췌',async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');
    f.state.proposal={reason:'unsupported',filter,unmet:clips,quotes:[],missingProviders:['outlook']};
    const job=request({prompt,mailSearch:true});await f.tasks.submit(member,job);
    const first=await f.row(job.id,'failed');assert.deepEqual(first.mailReview.unmet,clips);
    const expected=legacy?[prompt,'Outlook']:clips;
    if(legacy){
      const record=await f.mail.vault.read(member.synk_user_id,job.id);
      await f.mail.vault.write(member.synk_user_id,job.id,{...record,unmet:expected},()=>true);
    }
    await f.restart();await f.row(job.id,'failed');const old=await f.tasks.action(member,job.id,'reviewMail');
    assert.deepEqual(old.mailReview.unmet,expected);assert.ok((await f.confirm(job.id,old.mailReview.reviewId,old.mailReview.filter)).ok);
    const done=await f.row(job.id,'completed');assert.deepEqual(done.mailResult.omittedConditions,expected.slice(0,-1));assert.deepEqual(done.mailResult.excludedMailboxes,[{provider:'outlook'}]);
    assert.equal(f.state.lookups.length,1);assert.equal(f.state.models,1);
  });
});

test('손상된 확인 기록의 발췌 합계가 원문에서 나올 수 있는 범위를 넘으면 조회하지 않는다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');
  const prompt='Find unread emails about entries '+Array.from({length:100},(_,i)=>String.fromCharCode(0xAC00+i)).join('')+'.';
  f.state.proposal={reason:'unsupported',filter,unmet:['unread'],quotes:[]};
  const job=request({prompt,mailSearch:true});await f.tasks.submit(member,job);await f.row(job.id,'failed');
  const record=await f.mail.vault.read(member.synk_user_id,job.id);
  const excess=Array.from({length:45},(_,i)=>prompt.slice(i,i+80));
  await f.mail.vault.write(member.synk_user_id,job.id,{...record,unmet:excess},()=>true);
  await f.restart();await f.row(job.id,'failed');
  assert.equal((await f.tasks.action(member,job.id,'reviewMail')).ok,false);
  assert.equal(f.state.lookups.length,0);assert.equal(f.state.models,1);
});

const rolePrompt='Regarding the negotiations, the ones with shipping costs, give and take in the messages Alice sent me, and revised payment terms, find the emails about the deposit';
const mailRoles=[{field:'from',quote:'Alice',value:'Alice'},{field:'folder',quote:'sent me',value:'sent'}];
const rolePacket={...filter,folder:'sent',from:'Alice',provider:'',terms:['deposit'],scope:'mailbox',mailRef:'emails',otherRef:'',period:'',inherit:false,mergeTerms:'replace',clear:[],unmet:[],
  evidence:[{role:'about',quote:'deposit',nth:1},{role:'sender',quote:'Alice',nth:1},{role:'folder',quote:'sent me',nth:1}]};

test('원문 역할 두 개를 회원이 고른 같은 업무에서 실제 검색·완료·재시작한다',async t=>{
  const variants=[
    {mode:'auto',decisions:{from:'apply',folder:'apply'},selected:{from:'Alice',folder:'sent'},omitted:[]},
    {mode:'explicit',decisions:{from:'exclude',folder:'exclude'},selected:{from:'',folder:'received'},omitted:['Alice','sent me']},
    {mode:'follow',decisions:{from:'edit',folder:'edit'},selected:{from:'Carol',folder:'inbox'},omitted:['Alice','sent me']},
    {mode:'explicit',decisions:{from:'apply',folder:'exclude'},selected:{from:'Alice',folder:'received'},omitted:['sent me']},
  ];
  for(const pick of variants)await t.test(pick.mode+' '+JSON.stringify(pick.decisions),async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');let previousId;
    if(pick.mode==='follow'){
      f.state.plan={...filter,terms:['existing'],inherit:false};const parent=request({prompt:'이전 메일 찾아줘',mailSearch:true});
      assert.ok((await f.tasks.submit(member,parent)).ok);await f.row(parent.id,'completed');previousId=parent.id;
    }
    const calls=f.state.lookups.length,models=f.state.models;f.state.packet=rolePacket;
    const job=request({prompt:rolePrompt,...(pick.mode==='explicit'?{mailSearch:true}:{}),...(previousId?{previousId}:{})});
    assert.ok((await f.tasks.submit(member,job)).ok);const initial=await f.row(job.id,'failed');
    assert.equal(initial.reason,'MAIL_REVIEW');assert.deepEqual(initial.mailReview.roleChoices,mailRoles);
    assert.deepEqual(initial.mailReview.filter,{...filter,terms:['deposit']});assert.equal(f.state.lookups.length,calls);
    const filename=path.join(f.dir,'OfficeMail',member.synk_user_id,job.id+'.enc'),draft=await fs.readFile(filename);
    const encrypted=await f.mail.vault.read(member.synk_user_id,job.id);assert.deepEqual(encrypted.roleChoices,mailRoles);assert.ok(!draft.includes(Buffer.from('sent me')));
    const metadata=await fs.readFile(path.join(f.dir,'Office',member.synk_user_id,'tasks.json'),'utf8');
    assert.ok(!metadata.includes('"roleChoices"')&&!metadata.includes('"roleSalt"'));
    await f.restart();await f.row(job.id,'failed');const view=(await f.tasks.action(member,job.id,'reviewMail')).mailReview;
    assert.notEqual(view.reviewId,initial.mailReview.reviewId);assert.deepEqual(view.roleChoices,mailRoles);
    const send=(roles,edited=view.filter,reviewId=view.reviewId)=>f.tasks.action(member,job.id,'confirmMail',{reviewId,filter:edited,...(roles===undefined?{}:{roleDecisions:roles})});
    for(const [roles,edited,code] of [
      [undefined,view.filter,'MAIL_PLAN'],[{from:'exclude'},view.filter,'MAIL_PLAN'],[{folder:'exclude'},view.filter,'MAIL_PLAN'],
      [{from:'approve',folder:'exclude'},view.filter,'VALUE'],[{from:'exclude',terms:'exclude'},view.filter,'VALUE'],
      [{from:'apply',folder:'exclude'},view.filter,'MAIL_PLAN'],[{from:'edit',folder:'exclude'},{...view.filter,from:'alice'},'MAIL_PLAN'],
      [{from:'exclude',folder:'edit'},view.filter,'MAIL_PLAN'],[{from:'edit',folder:'apply'},{...view.filter,from:'Alice',folder:'sent'},'MAIL_PLAN'],
    ])assert.equal((await send(roles,edited)).code,code);
    const edited={...view.filter,...pick.selected};assert.equal((await send(pick.decisions,edited,initial.mailReview.reviewId)).code,'SESSION');
    assert.equal(f.state.lookups.length,calls);assert.deepEqual(await fs.readFile(filename),draft);
    const both=await Promise.all([send(pick.decisions,edited),send(pick.decisions,edited)]);assert.deepEqual(both.map(x=>x.ok),[true,false]);
    const done=await f.row(job.id,'completed'),receipt=await f.mail.vault.read(member.synk_user_id,job.id);
    assert.deepEqual(receipt.plan.terms,['deposit']);assert.deepEqual([receipt.plan.from,receipt.plan.folder],[pick.selected.from,pick.selected.folder]);
    assert.deepEqual(done.mailResult.omittedConditions||[],pick.omitted);assert.equal(f.state.lookups.length,calls+1);assert.equal(f.state.models,models+1);
    assert.deepEqual(f.state.lookups.at(-1).plan,receipt.plan);
    for(const quote of pick.omitted)assert.ok(done.answer.includes('“'+quote+'”'));
    await f.restart();const restored=await f.row(job.id,'completed');assert.deepEqual(restored.mailResult,done.mailResult);assert.equal(restored.answer,done.answer);
    assert.equal(f.state.lookups.length,calls+1);assert.equal(f.state.models,models+1);
  });
});

test('역할·기간·미지원 조건과 끊어진 메일함은 독립해서 확인한다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');
  const text=rolePrompt+' Gmail and Outlook; unread during November.';
  f.state.proposal={reason:'unsupported',filter:{...filter,terms:['deposit']},roleChoices:mailRoles,requiresPeriodChoice:true,unmet:['unread','Outlook'],missingProviders:['outlook']};
  const job=request({prompt:text,mailSearch:true});await f.tasks.submit(member,job);
  const first=await f.row(job.id,'failed');assert.deepEqual(first.mailReview.roleChoices,mailRoles);
  await f.restart();await f.row(job.id,'failed');const view=(await f.tasks.action(member,job.id,'reviewMail')).mailReview;
  assert.deepEqual(view.availableProviders,['gmail']);assert.deepEqual(view.missingProviders,['outlook']);assert.equal(view.requiresPeriodChoice,true);
  const details={reviewId:view.reviewId,filter:view.filter},roles={from:'exclude',folder:'exclude'};
  for(const choices of [{roleDecisions:roles},{roleDecisions:roles,omitUnmet:true},{roleDecisions:roles,allowUnboundedPeriod:true},{allowUnboundedPeriod:true,omitUnmet:true}]){
    assert.equal((await f.tasks.action(member,job.id,'confirmMail',{...details,...choices})).code,'MAIL_PLAN');
  }
  assert.equal(f.state.lookups.length,0);assert.ok((await f.tasks.action(member,job.id,'confirmMail',{...details,roleDecisions:roles,allowUnboundedPeriod:true,omitUnmet:true})).ok);
  const done=await f.row(job.id,'completed');assert.deepEqual(done.mailResult.omittedConditions,['unread','Alice','sent me']);assert.deepEqual(done.mailResult.excludedMailboxes,[{provider:'outlook'}]);
  assert.deepEqual(f.state.lookups.map(q=>q.provider),['gmail']);assert.equal(f.state.models,1);
});

test('암호화된 역할 인용의 삭제·교체·기본값 변조를 새 카드와 콜드 복원에서 거절한다',async t=>{
  const f=await fixture(t);await f.mail.connect(member,'gmail');f.state.packet=rolePacket;
  const job=request({prompt:rolePrompt});await f.tasks.submit(member,job);const view=(await f.row(job.id,'failed')).mailReview;
  const record=await f.mail.vault.read(member.synk_user_id,job.id);const {roleChoices,roleSalt,...asLegacy}=record;
  for(const changed of [asLegacy,{...record,roleChoices:[roleChoices[0]]},{...record,roleChoices:[roleChoices[0],{...roleChoices[1],value:'inbox'}]},{...record,filter:{...record.filter,folder:'all'}}]){
    await f.mail.vault.write(member.synk_user_id,job.id,changed,()=>true);
    assert.equal((await f.tasks.action(member,job.id,'confirmMail',{reviewId:view.reviewId,filter:view.filter,roleDecisions:{from:'exclude',folder:'exclude'}})).code,'MAIL_STORAGE');
    assert.equal(f.state.lookups.length,0);
  }
  await f.restart();await f.row(job.id,'failed');assert.equal((await f.tasks.action(member,job.id,'reviewMail')).code,'MAIL_STORAGE');
  assert.equal(f.state.lookups.length,0);assert.equal(f.state.models,1);
});

test('단일 역할의 직접 편집은 기본값 및 제안과 구분되고 다른 역할 결정은 받을 수 없다',async t=>{
  for(const choice of [mailRoles[0],mailRoles[1]])await t.test(choice.field,async t=>{
    const f=await fixture(t);await f.mail.connect(member,'gmail');
    const other=choice.field==='from'?'folder':'from';
    const base=choice.field==='from'?'Studio':'inbox';
    f.state.proposal={reason:choice.field==='from'?'sender':'folder',filter:{...filter,terms:['deposit'],[choice.field]:base},roleChoices:[choice]};
    const job=request({prompt:rolePrompt,mailSearch:true});await f.tasks.submit(member,job);const view=(await f.row(job.id,'failed')).mailReview;
    const submit=(d,v)=>f.tasks.action(member,job.id,'confirmMail',{reviewId:view.reviewId,filter:{...view.filter,[choice.field]:v},roleDecisions:d});
    assert.equal((await submit({[other]:'exclude'},base)).code,'MAIL_PLAN');
    assert.equal((await submit({[choice.field]:'edit'},base)).code,'MAIL_PLAN');
    assert.equal((await submit({[choice.field]:'edit'},choice.value)).code,'MAIL_PLAN');
    if(choice.field==='from')assert.equal((await submit({from:'edit'},'')).code,'MAIL_PLAN');
    assert.equal(f.state.lookups.length,0);
    assert.ok((await submit({[choice.field]:'exclude'},base)).ok);const done=await f.row(job.id,'completed');
    assert.equal(f.state.lookups[0].plan[choice.field],base);assert.deepEqual(done.mailResult.omittedConditions,[choice.quote]);assert.equal(f.state.lookups.length,1);
    const index=JSON.parse(await fs.readFile(path.join(f.dir,'Office',member.synk_user_id,'tasks.json'),'utf8'));
    assert.ok(!Object.hasOwn(index.tasks.find(r=>r.id===job.id),'mailRoleReviewTag'));
  });
});
