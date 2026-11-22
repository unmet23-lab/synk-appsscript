'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {randomUUID,createHmac}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {mailAppServer}=require('./fixtures/office-mail-app-server.cjs');
const {planMail}=require('../src/office-mail-plan.cjs');
const {createOfficeMail}=require('../src/office-mail.cjs');
const {createOfficeTasks}=require('../src/office-tasks.cjs');
const {createTaskStore}=require('../src/office-task-store.cjs');

const account={synk_user_id:'boundary_member',sessionGeneration:1};
const packet=(provider,inherit=false)=>({scope:'mailbox',mailRef:'업무 메일',otherRef:'',terms:[],from:'',after:'',before:'',folder:'',provider,inherit});
// The ordinary planner quotes the member's exact words for each structured filter.
// These synthetic replies are independent of the application's routing implementation.
function grounded(instruction,raw){
  const evidence=[],terms=raw.terms||[];
  const add=(role,quote)=>{if(quote&&instruction.includes(quote))evidence.push({role,quote,nth:1});};
  let provider=raw.provider;
  const service=provider==='gmail'?'Gmail':provider==='outlook'?'Outlook':'';
  if(service&&instruction.includes(service))add('provider',service);
  else if(service)provider='';
  for(const term of terms)add('about',raw.topic||term);
  if(raw.from)add('sender',raw.from);
  if(raw.attachment==='has')add('attachment',['첨부파일이 있는','with attachments','첨부파일'].find(t=>instruction.includes(t)));
  if(raw.inherit){
    const actual=/첨부|검색 조건|발신자 조건|attachment filter/i.test(instruction)?instruction:
      ['그중','다시','같은 조건','기존'].find(t=>instruction.includes(t));
    add('followup',actual);
  }
  const mailRef=[raw.mailRef,'메일','Gmail','Outlook','email','messages'].find(t=>t&&instruction.includes(t))||'';
  const {topic,...fields}=raw;
  return {...fields,period:'',evidence,otherRef:raw.otherRef||'',mailRef,provider,attachment:raw.attachment||'',
    unmet:raw.unmet||[],clear:raw.clear||[],mergeTerms:raw.mergeTerms||'replace'};
}
const current=()=>account,authorized=async()=>true;
const hooks=()=>({signal:new AbortController().signal,checkpoint:async()=>true,session:async()=>true});
const tools=mock=>({file:'codex-fixture',env:{},spawn:mock.spawn});
const tag=(salt,user)=>createHmac('sha256','solio:office:mail-planner:v1\0'+salt)
  .update(JSON.stringify(['id',user,'workspace-'+user])).digest('hex');

test('견적 근거를 보낼 바로 그 프로세스에서 담당 구독과 작업공간을 다시 확인한다',async()=>{
  const salt=randomUUID(),source={subject:'가상 회사 견적',evidence:'의뢰인만 아는 가상 주문 사양'};
  const spec={id:randomUUID(),quoteRecipient:true,quoteDraft:source,quoteAccountSalt:salt,quoteAccountTag:tag(salt,'owner')};
  const switched=mailAppServer({account:n=>n===1?'owner':'other'});
  await assert.rejects(planMail(spec,hooks(),tools(switched)),{code:'LOGIN'});
  assert.equal(switched.sessions.length,1);
  assert.ok(!switched.sessions[0].requests.some(r=>JSON.stringify(r).includes(source.evidence)));
  const valid=mailAppServer({account:()=>'owner',result:()=>({draft:'사양 확인 후 견적을 안내드리겠습니다.'})});
  assert.match(await planMail(spec,hooks(),tools(valid)),/사양 확인/);
  assert.equal(valid.sessions.length,1);
  const [session]=valid.sessions;
  const setting=session.requests.find(r=>r.method==='thread/start').params;
  assert.equal(setting.config.forced_chatgpt_workspace_id,'workspace-owner');
  assert.equal(setting.ephemeral,true);assert.equal(setting.config.mcp_servers.sampleMcp.enabled,false);
  const index=session.requests.findIndex(r=>r.method==='turn/start');
  assert.equal(session.requests[index-1].method,'account/read');
  assert.equal(session.requests.filter(r=>JSON.stringify(r).includes(source.evidence)).length,1);
  assert.equal(session.requests[index].params.threadId,session.threadId);
  assert.ok(!session.requests.some(r=>r.method==='thread/resume'));
});

test('도구가 남아 있는 스레드에는 견적 원문을 보내지 않는다',async()=>{
  const salt=randomUUID(),mock=mailAppServer({account:()=>'owner',keepMcp:true});
  const spec={id:randomUUID(),quoteRecipient:true,quoteDraft:{subject:'부품',evidence:'견적 근거'},quoteAccountSalt:salt,quoteAccountTag:tag(salt,'owner')};
  await assert.rejects(planMail(spec,hooks(),tools(mock)),{code:'MAIL_PLAN'});
  assert.equal(mock.sessions[0].requests.some(r=>r.method==='turn/start'),false);
});

test('견적 직원은 근거가 부족하면 같은 공식 세션에서 빈 초안을 반환할 수 있다',async()=>{
  const salt=randomUUID();
  const spec={id:randomUUID(),quoteRecipient:true,quoteDraft:{subject:'사양 확인',evidence:'수량을 알려 주시면 단가를 계산하겠습니다.'},
    quoteAccountSalt:salt,quoteAccountTag:tag(salt,'owner')};
  const worker=packet=>mailAppServer({account:()=>'owner',result:()=>packet});
  assert.equal(await planMail(spec,hooks(),tools(worker({draft:''}))), '');
  for(const bad of [{},{draft:null},{draft:'   '}]){
    await assert.rejects(planMail(spec,hooks(),tools(worker(bad))),{code:'MAIL_PLAN'});
  }
});

async function office(t,options={}){
  const work=await fs.mkdtemp(path.join(os.tmpdir(),'office-boundary-'));
  const root=options.root||work,storeRoot=path.join(root,'Office',account.synk_user_id),file=path.join(storeRoot,'tasks.json');
  const values=options.values||new Map(),reads=[],searches=[],plans=[],quoteScans=[];
  const vault={secure(){},async read(member,id){assert.equal(member,account.synk_user_id);reads.push(id);return structuredClone(values.get(id)||null);},
    async write(member,id,data,guard,done){assert.equal(member,account.synk_user_id);assert.ok(guard());values.set(id,structuredClone(data));done?.();}};
  const mail=createOfficeMail({userData:root,current,authorized,vault,clients:async()=>({gmail:{id:'sample-g'},outlook:{id:'sample-o'}}),
    authorize:async({provider})=>({subject:provider,address:provider+'@example.test',refreshToken:'sample',scope:'sample'}),
    refresh:async()=>({access:'sample',refreshToken:'sample',scope:'sample'}),search:async({provider,plan})=>{searches.push(provider);plans.push(plan);return {items:[],more:false};},
    scanQuotes:async({provider})=>{quoteScans.push(provider);return {items:[],more:false};}});
  const mock=mailAppServer({account:()=>(options.user||'owner'),result:p=>{
    const instruction=JSON.parse(p.input[0].text.split('\n').at(-1));
    const raw=options.result?options.result({...p,input:[{text:JSON.stringify(instruction)}]}):
      {...packet(instruction.includes('Outlook')?'outlook':instruction.includes('Gmail')?'gmail':''),terms:instruction.includes('출시 일정')?['출시 일정']:instruction.includes('견적')?['견적']:[]};
    return grounded(instruction,raw);
  }});
  const store=createTaskStore(root,undefined,mail);
  const jobs=Object.create(store);
  let queued=null,ledger={tasks:[]};
  const writeErrors=[];
  jobs.write=async(...args)=>{
    try{await store.write(...args);}catch(e){writeErrors.push(e.code||e.message);throw e;}
    // Observe committed transitions through the writer. The UI serializes its reads
    // too; directly polling tasks.json can race the Windows atomic file replacement.
    const bytes=await fs.readFile(file);
    ledger=JSON.parse(bytes);
    if(!queued&&options.capture&&args[1].some(row=>row.mailDecision==='mailbox'&&row.status==='queued')){
      queued={ledger:bytes,values:structuredClone(values)};
    }
  };
  const service=createOfficeTasks({userData:root,current,authorized,mail,store:jobs,
    context:async()=>({ok:true,name:'사무실',cwd:options.cwd||root,cap:2,toolCaps:{codex:2}}),
    run:(spec,h)=>planMail(spec,h,tools(mock))});
  async function wait(id,status){
    for(let i=0;i<350;i++){
      const row=ledger.tasks.find(r=>r.id===id);
      if(row?.status===status||status==='settled'&&['completed','failed','interrupted'].includes(row?.status))return row;
      if(['failed','completed','interrupted'].includes(row?.status)&&status!==row.status)assert.fail([row.mailReason||row.reason||row.status,...writeErrors].join(' '));
      await delay(10);
    }
    assert.fail('업무 상태를 기다리는 중 '+status);
  }
  t.after(async()=>{service.close();await service.snapshot(account);await fs.rm(work,{recursive:true,force:true});});
  return {work,storeRoot,file,values,mail,mock,service,wait,reads,searches,plans,quoteScans,get queued(){return queued;}};
}
async function asksMember(f,id){
  const card=(await f.service.snapshot(account)).tasks.find(task=>task.id===id);
  assert.ok(card, '원래 업무 카드를 찾는다');
  assert.equal(card.status,'failed');
  assert.ok(['MAIL_CHOOSE','MAIL_REVIEW'].includes(card.reason),'입력 또는 검색 위치를 다시 고른다: '+card.reason);
}
test('자동 사서함 판정 후 재시작해도 다른 구독에 이전 검색 요청을 보내지 않는다',async t=>{
  const first=await office(t,{capture:true});
  assert.ok((await first.mail.connect(account,'gmail')).ok);
  const id=randomUUID(),prompt='업무 메일에서 출시 일정 자료를 찾아 주세요.';
  assert.ok((await first.service.submit(account,{id,provider:'codex',prompt})).ok);
  await first.wait(id,'completed');
  const saved=first.queued;
  assert.equal(JSON.parse(saved.ledger).tasks[0].judgedAccountTag,tag(id,'owner'));
  const restored=await office(t,{user:'other',values:saved.values,cwd:first.work});
  await fs.mkdir(restored.storeRoot,{recursive:true});await fs.writeFile(restored.file,saved.ledger);
  const resumed=await restored.service.snapshot(account);
  const restoredTask=resumed.tasks.find(r=>r.id===id);
  if(restoredTask.status==='paused'){
    assert.ok((await restored.service.action(account,id,'resume')).ok);
    assert.equal((await restored.wait(id,'failed')).reason,'LOGIN');
  }else{
    assert.deepEqual([restoredTask.status,restoredTask.reason,restoredTask.mailDecisionReason],['failed','MAIL_CHOOSE','MAIL_CHANGED']);
  }
  assert.deepEqual(restored.searches,[]);
  assert.ok(restored.mock.sessions.every(proc=>!proc.requests.some(r=>r.method==='turn/start')));
});
for(const source of ['auto','mail'])test('이전 Gmail 카드로 생긴 후속에서 이후 추가한 Outlook을 읽지 않고 새 업무에서 직접 지정한다 ('+source+')',async t=>{
  const f=await office(t);
  assert.ok((await f.mail.connect(account,'gmail')).ok);
  const a=randomUUID(),b=randomUUID();
  assert.ok((await f.service.submit(account,{id:a,provider:'codex',prompt:'Gmail에서 견적 메일을 찾아줘',mailSearch:true})).ok);
  await f.wait(a,'completed');
  assert.ok((await f.mail.connect(account,'outlook')).ok);
  f.reads.length=0;
  assert.ok((await f.service.submit(account,{id:b,provider:'codex',prompt:'Outlook 업무 메일에서 새 견적 요청을 찾아줘',previousId:a,
    ...(source==='mail'?{mailSearch:true}:{})})).ok);
  await f.wait(b,'failed');
  assert.deepEqual(f.searches,['gmail']);
  const child=randomUUID();
  assert.ok((await f.service.submit(account,{id:child,provider:'codex',prompt:'Outlook에서 견적 메일을 찾아줘',
    ...(source==='mail'?{mailSearch:true}:{})})).ok);
  const fresh=await f.wait(child,'completed');
  assert.deepEqual(f.searches,['gmail','outlook']);
  assert.equal(fresh.sessionId,child);assert.equal(fresh.providerSalt,child);
});

for(const inherit of [false,true])test('공유 드라이브를 지정한 후속 지시는 메일 담당이 잘못 판단해도 사서함을 열지 않는다 (inherit='+inherit+')',async t=>{
  const external='Find the email template in the shared drive',follow='그중 template만 다시 찾아줘';
  const f=await office(t,{result:p=>{
    const text=p.input[0].text;
    const outside=text.includes(JSON.stringify(external)),refine=text.includes(JSON.stringify(follow));
    return {...packet('gmail',outside?inherit:refine),mailRef:'',terms:outside||refine?['template']:['견적']};
  }});
  assert.ok((await f.mail.connect(account,'gmail')).ok);
  const first=randomUUID(),outside=randomUUID(),refine=randomUUID();
  assert.ok((await f.service.submit(account,{id:first,provider:'codex',mailSearch:true,prompt:'업무 메일에서 견적을 찾아줘'})).ok);
  await f.wait(first,'completed');assert.deepEqual(f.searches,['gmail']);
  assert.ok((await f.service.submit(account,{id:outside,provider:'codex',previousId:first,prompt:external})).ok);
  const stopped=await f.wait(outside,'failed');
  assert.equal(stopped.mailReason||stopped.reason,'MAIL_CHOOSE');assert.deepEqual(f.searches,['gmail']);
  assert.ok((await f.service.submit(account,{id:refine,provider:'codex',previousId:first,prompt:follow})).ok);
  await f.wait(refine,'completed');assert.deepEqual(f.searches,['gmail','gmail']);
});

for(const mode of ['auto','mail'])test('첨부가 없어도 괜찮다고 명시한 후속 조건 해제와 첨부가 없는 편지만 찾는 요청을 구별한다 ('+mode+')',async t=>{
  const initial='Gmail에서 첨부파일이 있는 메일을 찾아줘',clear='첨부파일이 없어도 괜찮으니 첨부파일 조건은 빼 주세요.';
  const noAttachment='첨부파일 조건은 빼고 첨부파일이 없는 메일만 찾아줘';
  const f=await office(t,{result:p=>{
    const fresh=p.input[0].text.includes(JSON.stringify(initial));
    return {...packet('gmail',!fresh),mailRef:fresh?'Gmail':'',attachment:fresh?'has':'',clear:fresh?[]:['attachment']};
  }});
  assert.ok((await f.mail.connect(account,'gmail')).ok);
  const first=randomUUID(),next=randomUUID(),blocked=randomUUID();
  const source=mode==='mail'?{mailSearch:true}:{};
  assert.ok((await f.service.submit(account,{id:first,provider:'codex',mailSearch:true,prompt:initial})).ok);await f.wait(first,'completed');
  assert.ok((await f.service.submit(account,{id:next,provider:'codex',previousId:first,prompt:clear,...source})).ok);await f.wait(next,'completed');
  assert.deepEqual(f.plans.map(p=>p.attachment),['has','']);
  assert.ok((await f.service.submit(account,{id:blocked,provider:'codex',previousId:next,prompt:noAttachment,...source})).ok);
  await f.wait(blocked,'failed');assert.deepEqual(f.searches,['gmail','gmail']);
});

test('다시 연 앱에서 영어 명령의 직접 대상 사서함만 검색하고 Gmail이 검색어일 때 모델의 잘못된 출처를 막는다',async t=>{
  const positive='Search Gmail for messages with attachments.';
  const asTopic='Search for Gmail messages with attachments.';
  const values=new Map(),setup=await office(t,{values});
  for(const provider of ['gmail','outlook'])assert.ok((await setup.mail.connect(account,provider)).ok);
  setup.service.close();await setup.service.snapshot(account);
  const f=await office(t,{values,result:p=>{
    const wrong=p.input[0].text.includes('Browse Gmail for messages');
    return {...packet(wrong?'all':'gmail',p.input[0].text.includes(JSON.stringify(asTopic))),mailRef:'Gmail',attachment:'has'};
  }});
  const accepted=randomUUID();assert.ok((await f.service.submit(account,{id:accepted,provider:'codex',prompt:positive})).ok);
  await f.wait(accepted,'completed');assert.deepEqual(f.searches,['gmail']);assert.equal(f.plans[0].attachment,'has');
  for(const [prompt,previousId] of [[asTopic,accepted],['Browse Gmail for messages with attachments.',null],['Find Gmail in the shared drive.',null]]){
    const id=randomUUID();assert.ok((await f.service.submit(account,{id,provider:'codex',prompt,previousId})).ok);
    await f.wait(id,'failed');await asksMember(f,id);
  }
  assert.deepEqual(f.searches,['gmail']);
});

for(const mode of ['auto','mail'])test('검색 위치와 메일 내용에 나온 드라이브를 구별한다 ('+mode+')',async t=>{
  const initial='Gmail에서 견적 메일을 찾아줘';
  const cases=[
    ['웹 검색으로 견적 메일 템플릿 찾아줘.','템플릿',false],
    ['웹 검색으로 배송 안내 메일 사례를 찾아줘.','배송',false],
    ['위 보고서에서 견적 금액만 다시 찾아줘.','금액',false],
    ['그중 드라이브에서 발생한 오류 관련 메일만 다시 찾아줘.','오류','confirm'],
    ['그중 드라이브에서 발생했던 오류 관련 메일만 다시 찾아줘.','오류','confirm'],
    ['그중 드라이브에서 발견한 오류 관련 메일만 다시 찾아줘.','오류','confirm'],
    ['그중 드라이브에서 발견한 고객 메일 중 결제 오류 관련 메일만 다시 찾아줘.','결제 오류',false],
    ['그중 드라이브에서 발견한 고객 메시지들 가운데 결제 오류 관련 메일만 다시 찾아줘.','결제 오류',false],
    ['그중 드라이브에서 발견한 메일 동기화 오류 관련 메일만 다시 찾아줘.','오류','confirm'],
    ['그중 드라이브에서 발견한 파일 목록 표시 오류에 관한 메일만 다시 찾아줘.','파일 목록 표시 오류','confirm'],
    ['그중 드라이브에서 발견한 메일 모음에 들어 있는 결제 오류 관련 메일만 다시 찾아줘.','결제 오류',false],
    ['그중 드라이브에서 발견한 파일 목록에서만 재현되는 표시 오류에 관한 메일만 다시 찾아줘.','표시 오류','confirm'],
    ['그중 드라이브에서 발견한 실제 파일 목록을 다시 보여줘.','파일 목록',false],
    ['그중 드라이브에서 발견한 파일 목록 중 결제 오류 관련 메일만 다시 찾아줘.','결제 오류',false],
    ['그중 드라이브에서 발견한 파일 목록에서 결제 오류 관련 메일만 다시 찾아줘.','결제 오류',false],
    ['공유 드라이브에서 발견한 견적 관련 메일을 다시 보여줘.','견적',false],
    ['공유 드라이브에서 찾은 견적 관련 메일을 다시 보여줘.','견적',false],
    ['웹 검색으로 찾은 견적 관련 메일만 다시 보여줘.','견적',false],
    ['그중 견적 메일을 검색하지 마세요.','견적',false],
    ['참고 문서는 열지 말고 오류 메일만 다시 찾아줘.','오류',true],
    ['공유 드라이브에서 오류 관련 메일 템플릿을 찾아줘.','오류',false],
    ['그중 드라이브에서 발생한 오류 관련 메일 템플릿을 찾아줘.','오류',false],
    ['그중 저장소에서 온 알림 메일만 다시 찾아줘.','알림',true],
    ['그중 웹 검색으로 찾은 오류 사례에 관한 메일만 다시 찾아줘.','오류',true],
    ['그중 드라이브에서 발생한 오류 관련 메일을 웹 검색으로 찾아줘.','오류',false]
  ];
  const f=await office(t,{result:p=>{
    const entry=cases.find(([prompt])=>p.input[0].text.includes(JSON.stringify(prompt)));
    const subject=entry?.[2]&&entry[0].match(/(?:드라이브|웹 검색|저장소)에서?.*?(?= 관련 메일|에 관한 메일| 알림 메일)|웹 검색으로 찾은 오류 사례/u)?.[0];
    return {...packet('gmail',Boolean(entry)),mailRef:'',terms:[entry?entry[1]:'견적'],topic:subject||undefined};
  }});
  for(const provider of ['gmail','outlook'])assert.ok((await f.mail.connect(account,provider)).ok);
  const first=randomUUID();
  assert.ok((await f.service.submit(account,{id:first,provider:'codex',mailSearch:true,prompt:initial})).ok);
  await f.wait(first,'completed');
  for(const [prompt,term,maySearch] of cases){
    const id=randomUUID(),before=f.searches.length;
    assert.ok((await f.service.submit(account,{id,provider:'codex',previousId:first,prompt,...(mode==='mail'?{mailSearch:true}:{})})).ok);
    const row=await f.wait(id,'settled');
    const opensMailbox=maySearch===true;
    assert.deepEqual({status:row.status,opened:f.searches.slice(before)},opensMailbox?{status:'completed',opened:['gmail']}:{status:'failed',opened:[]},prompt);
    if(opensMailbox)assert.deepEqual(f.plans.at(-1).terms,[term]);
    if(maySearch==='confirm')await asksMember(f,id);
    assert.deepEqual(f.quoteScans,[]);
  }
  const fresh=await office(t,{result:p=>({...packet('gmail'),mailRef:'메일',...(p.input[0].text.includes('구글 드라이브')?{from:'구글 드라이브'}:{terms:['파일 목록 표시 오류']})})});
  assert.ok((await fresh.mail.connect(account,'gmail')).ok);
  const id=randomUUID();
  assert.ok((await fresh.service.submit(account,{id,provider:'codex',prompt:'구글 드라이브에서 온 메일 찾아줘',...(mode==='mail'?{mailSearch:true}:{})})).ok);
  const sourced=await fresh.wait(id,'settled');
  if(sourced.status==='completed'){
    assert.deepEqual(fresh.searches,['gmail']);assert.equal(fresh.plans.at(-1).from,'구글 드라이브');
  }else{await asksMember(fresh,id);assert.deepEqual(fresh.searches,[]);}
  assert.deepEqual(fresh.quoteScans,[]);
  const beforeNamed=fresh.searches.length;
  const named=randomUUID();
  assert.ok((await fresh.service.submit(account,{id:named,provider:'codex',prompt:'Gmail에서 파일 목록 표시 오류에 관한 메일만 다시 찾아줘.',...(mode==='mail'?{mailSearch:true}:{})})).ok);
  assert.equal((await fresh.wait(named,'settled')).status,'completed');
  assert.deepEqual(fresh.searches.slice(beforeNamed),['gmail']);assert.deepEqual(fresh.plans.at(-1).terms,['파일 목록 표시 오류']);
});

for(const mode of ['auto','mail'])test('첨부 조건 해제를 부정하면 조회를 넓히지 않고 유지 지시를 적용한다 ('+mode+')',async t=>{
  const initial='Gmail에서 첨부파일이 있는 메일을 찾아줘';
  const retain='첨부파일이 없어도 괜찮다는 뜻은 아니니 첨부파일 조건은 빼지 마세요.';
  let planning={attachment:'has',clear:[]};
  const f=await office(t,{result:p=>{
    const first=p.input[0].text.includes(JSON.stringify(initial));
    return {...packet(first?'gmail':'',!first),mailRef:first?'Gmail':'',...planning};
  }});
  assert.ok((await f.mail.connect(account,'gmail')).ok);
  const first=randomUUID();
  assert.ok((await f.service.submit(account,{id:first,provider:'codex',mailSearch:true,prompt:initial})).ok);
  await f.wait(first,'completed');
  const cases=[
    [retain,'',['attachment'],false],
    [retain,'',[],mode==='mail'],
    [retain+' 같은 조건으로 다시 찾아줘.','has',[],true],
    [retain+' 같은 조건으로 다시 찾아줘.','',[],true],
    ['첨부 조건은 유지하고 사서함은 열지 마세요.','',[],false],
    ['첨부파일 조건을 유지하지 말고 그 조건은 빼줘.','',['attachment'],true],
    ['첨부파일 조건을 유지하지 말고 그 조건은 빼줘.','',[],false],
    ['첨부파일 조건을 빼지는 마세요.','',['attachment'],false],
    ['첨부파일 조건은 빼지 말고 발신자 조건만 빼 주세요.','',['from'],true],
    ['발신자 조건만 빼고 다시 찾아줘.','',['attachment'],false],
    ['모든 검색 조건을 빼고 다시 찾아줘.','',['attachment'],true],
    ['기존 검색 조건을 초기화해 줘.','',['attachment'],true],
    ['기존 검색 조건을 초기화하지 마세요.','',['attachment'],false],
    ['기존 검색 조건을 초기화해 버리지 말고 같은 메일을 다시 찾아줘.','',['attachment'],false],
    ['기존 검색 조건을 초기화해 버리지 말고 같은 메일을 다시 찾아줘.','',[],true],
    ['기존 검색 조건을 초기화해놓진 말고 같은 메일을 다시 찾아줘.','',['attachment'],false],
    ['기존 발신자 검색 조건을 초기화해 줘.','',['attachment'],false],
    ['Do not remove the attachment filter.','',['attachment'],false],
    ['첨부파일 조건은 제거하지 말아 주세요.','',['attachment'],false],
    ['첨부파일이 없어도 괜찮으니 첨부파일 조건은 빼 주세요.','',['attachment'],true]
  ];
  let relaxed;
  for(const [prompt,attachment,clear,maySearch] of cases){
    planning={attachment,clear};
    const id=randomUUID(),before=f.searches.length;
    assert.ok((await f.service.submit(account,{id,provider:'codex',previousId:first,prompt,...(mode==='mail'?{mailSearch:true}:{})})).ok);
    const row=await f.wait(id,'settled');
    assert.deepEqual({status:row.status,opened:f.searches.slice(before)},maySearch?{status:'completed',opened:['gmail']}:{status:'failed',opened:[]},prompt);
    if(maySearch)assert.equal(f.plans.at(-1).attachment,clear.includes('attachment')?'':'has',prompt);
    if(maySearch&&clear.includes('attachment'))relaxed=id;
    assert.deepEqual(f.quoteScans,[]);
  }
  planning={attachment:'has',clear:[]};
  const id=randomUUID();
  assert.ok((await f.service.submit(account,{id,provider:'codex',previousId:relaxed,prompt:'첨부파일 조건은 그대로 유지해서 다시 찾아줘.',...(mode==='mail'?{mailSearch:true}:{})})).ok);
  assert.equal((await f.wait(id,'settled')).status,'completed');
  assert.equal(f.plans.at(-1).attachment,'');
});

