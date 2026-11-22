'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');
const {randomUUID}=require('node:crypto');
const st=require('../src/office-schema-turn.cjs');

const codes={ai:'FEATURE_AI',timeout:'FEATURE_TIMEOUT'};
const schema={type:'object',properties:{notes:{type:'array'}},required:['notes'],additionalProperties:false};
const INIT={type:'system',subtype:'init',apiKeySource:'none',tools:['StructuredOutput'],mcp_servers:[]};

function fakeClaude(lines,{closeAfter=true}={}){
  const calls=[];
  const spawn=(file,args,opts)=>{
    const child=new EventEmitter();
    child.stdout=new PassThrough();child.stderr=new PassThrough();
    let input='';
    child.stdin=new Writable({write(c,e,cb){input+=c;cb();},final(cb){calls.at(-1).stdin=input;cb();
      setImmediate(()=>{for(const l of lines)child.stdout.write(JSON.stringify(l)+'\n');if(closeAfter)setImmediate(()=>{child.stdout.end();child.emit('close',0);});});}});
    child.pid=4242;child.exitCode=null;child.killed=false;child.kill=()=>{child.killed=true;child.exitCode=1;setImmediate(()=>child.emit('close',1));};
    calls.push({file,args,opts,child});
    return child;
  };
  return {spawn,calls};
}
const run=(spawn,extra={})=>st.claudeSchemaTurn({file:'claude.exe',env:{},spawn,cwd:'C:/x',prompt:'문서 글',schema,codes,platform:'linux',...extra});

test('Claude: StructuredOutput 하나만 있는 init이면 structured_output을 돌려주고, 글은 표준 입력으로 간다', async () => {
  const f=fakeClaude([INIT,{type:'assistant'},{type:'result',subtype:'success',is_error:false,structured_output:{notes:[]}}]);
  assert.deepEqual(await run(f.spawn),{notes:[]});
  const c=f.calls[0];
  assert.equal(c.stdin,'문서 글');
  assert.equal(c.opts.shell,false);
  const a=c.args;
  assert.equal(a[a.indexOf('--tools')+1],'');
  assert.equal(a[a.indexOf('--setting-sources')+1],'project');
  assert.ok(a.includes('--no-session-persistence')&&a.includes('--strict-mcp-config'));
  assert.equal(JSON.parse(a[a.indexOf('--json-schema')+1]).required[0],'notes');
  assert.ok(!a.includes('문서 글'),'글이 명령줄에 실리지 않는다');
});

for(const [name,init,code] of [
  ['다른 도구',{...INIT,tools:['StructuredOutput','Bash']},'FEATURE_AI'],
  ['MCP 서버',{...INIT,mcp_servers:[{name:'x',status:'connected'}]},'FEATURE_AI'],
  ['API 키 출처',{...INIT,apiKeySource:'ANTHROPIC_API_KEY'},'LOGIN'],
  ['도구 목록 없음',{...INIT,tools:undefined},'FEATURE_AI'],
  ['손님 플러그인',{...INIT,plugins:[{name:'x',path:'C:/plugins/x'}]},'FEATURE_AI'],
]){
  test(`Claude: init에 ${name}이 있으면 바로 끝낸다`, async () => {
    const f=fakeClaude([init],{closeAfter:false});
    await assert.rejects(run(f.spawn),{code});
    assert.equal(f.calls[0].child.killed,true);
  });
}

test('Claude: init 전에 다른 소식이 오면 끝낸다', async () => {
  const f=fakeClaude([{type:'result',subtype:'success',structured_output:{notes:[]}}],{closeAfter:false});
  await assert.rejects(run(f.spawn),{code:'FEATURE_AI'});
});

for(const [text,code] of [
  ['Failed to authenticate: OAuth session expired and could not be refreshed','LOGIN'],
  ['Claude AI usage limit reached|1700000000','LIMIT'],
  ['something else','FEATURE_AI'],
  ['API Error: 529 overloaded_error','FEATURE_AI'],
]){
  test(`Claude: is_error 「${text.slice(0,24)}」는 ${code}`, async () => {
    const f=fakeClaude([INIT,{type:'result',subtype:'success',is_error:true,result:text}]);
    await assert.rejects(run(f.spawn),{code});
  });
}

test('Claude: structured_output이 없거나 배열이면, 결과가 없으면 FEATURE_AI', async () => {
  await assert.rejects(run(fakeClaude([INIT,{type:'result',subtype:'success',is_error:false,result:'{}'}]).spawn),{code:'FEATURE_AI'});
  await assert.rejects(run(fakeClaude([INIT,{type:'result',subtype:'success',is_error:false,structured_output:[]}]).spawn),{code:'FEATURE_AI'});
  await assert.rejects(run(fakeClaude([INIT]).spawn),{code:'FEATURE_AI'});
  await assert.rejects(run(fakeClaude([INIT,{type:'result',subtype:'error_max_turns',is_error:false}]).spawn),{code:'FEATURE_AI'});
});

test('Claude: 시간을 넘기면 자식을 끝내고 FEATURE_TIMEOUT, 취소면 CANCELLED', async () => {
  const f=fakeClaude([INIT],{closeAfter:false});
  await assert.rejects(run(f.spawn,{timeoutMs:30}),{code:'FEATURE_TIMEOUT'});
  assert.equal(f.calls[0].child.killed,true);
  const g=fakeClaude([INIT],{closeAfter:false}),ac=new AbortController();
  const p=run(g.spawn,{signal:ac.signal});
  setTimeout(()=>ac.abort(),20);
  await assert.rejects(p,{code:'CANCELLED'});
  assert.equal(g.calls[0].child.killed,true);
});

test('Claude: Windows에서는 taskkill /T로 자식까지 끝낸다', async () => {
  const f=fakeClaude([INIT],{closeAfter:false});
  const spawned=[];
  const spawn=(file,args,opts)=>{if(file==='taskkill'){spawned.push(args);const k=new EventEmitter();setImmediate(()=>k.emit('close',0));return k;}return f.spawn(file,args,opts);};
  await assert.rejects(run(spawn,{timeoutMs:20,platform:'win32'}),{code:'FEATURE_TIMEOUT'});
  assert.deepEqual(spawned[0],['/PID','4242','/T','/F']);
});

test('Claude 계정: 같은 폴더와 project 설정으로 auth status를 보고, 구독이 아니면 false', async () => {
  let seen;
  const exec=async(file,args,opts)=>{seen={args,cwd:opts.cwd};return {stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',subscriptionType:'max',email:'a@b.c'})};};
  const tag=await st.claudeAccount({file:'c',cwd:'C:/run',env:{},exec});
  assert.match(tag,/^[0-9a-f]{64}$/);
  assert.deepEqual(seen.args,['--setting-sources','project','auth','status','--json']);
  assert.equal(seen.cwd,'C:/run');
  const off=async()=>{throw Object.assign(new Error('x'),{stdout:JSON.stringify({loggedIn:false})});};
  assert.equal(await st.claudeAccount({file:'c',cwd:'C:/run',env:{},exec:off}),null);
  const api=async()=>({stdout:JSON.stringify({loggedIn:true,authMethod:'api_key',apiProvider:'firstParty'})});
  assert.equal(await st.claudeAccount({file:'c',cwd:'C:/run',env:{},exec:api}),null);
});

/* ── Codex ── */
function fakeCodex(turn,{answer=()=>JSON.stringify({notes:[]}),itemType='agentMessage',status='completed',silent=false}={}){
  const threads=[];
  return {threads,fault:null,active(){},interruptActive(){this.interrupted=true;},
    async rpc(method,params){
      if(method==='mcpServerStatus/list')return {data:params.threadId?[{name:'mail',runtimeStatus:'disabled',tools:{}}]:[{name:'mail'}]};
      if(method==='thread/start'){const id=randomUUID();threads.push({id,params});return {thread:{id,ephemeral:true,path:null},modelProvider:'openai',approvalPolicy:'never',sandbox:{type:'readOnly',networkAccess:false}};}
      if(method==='turn/start'){
        const turnId=randomUUID(),threadId=params.threadId;
        if(!silent)setImmediate(()=>{
          turn.receive({method:'item/completed',params:{threadId,turnId,item:{type:itemType,text:answer()}}});
          turn.receive({method:'turn/completed',params:{threadId,turn:{id:turnId,status,items:[],error:{message:'usage limit reached'}}}});
        });
        return {turn:{id:turnId}};
      }
      throw new Error('unexpected '+method);
    }};
}
const providerError=(raw,fallback)=>Object.assign(new Error(),{code:/usage limit/.test(raw?.message)?'LIMIT':fallback});
const opts=client=>({cwd:'C:/run',workspace:'ws',signal:new AbortController().signal,verify:async()=>{}});

test('Codex: 한 연결에서 차례 열 번, 차례마다 새 스레드, MCP 서버는 꺼서 연다', async () => {
  const turn=st.schemaTurn(providerError,codes);
  const client=fakeCodex(turn);
  for(let i=0;i<10;i++)assert.deepEqual(await turn.ask(client,opts(client),'글 '+i,schema),{notes:[]});
  assert.equal(client.threads.length,10);
  assert.equal(new Set(client.threads.map(t=>t.id)).size,10);
  assert.deepEqual(client.threads[0].params.config.mcp_servers,{mail:{enabled:false}});
  assert.equal(client.threads[0].params.ephemeral,true);
});

test('Codex: 도구 소식, 실패한 차례, JSON 아님, 시간 초과는 기능의 실패 코드', async () => {
  let turn=st.schemaTurn(providerError,codes);
  await assert.rejects(turn.ask(fakeCodex(turn,{itemType:'commandExecution'}),opts(),'x',schema),{code:'FEATURE_AI'});
  turn=st.schemaTurn(providerError,codes);
  await assert.rejects(turn.ask(fakeCodex(turn,{status:'failed'}),opts(),'x',schema),{code:'LIMIT'});
  turn=st.schemaTurn(providerError,codes);
  await assert.rejects(turn.ask(fakeCodex(turn,{answer:()=>'not json'}),opts(),'x',schema),{code:'FEATURE_AI'});
  turn=st.schemaTurn(providerError,codes);
  const c=fakeCodex(turn,{silent:true});
  await assert.rejects(turn.ask(c,{...opts(),timeoutMs:60},'x',schema),{code:'FEATURE_TIMEOUT'});
  assert.equal(c.interrupted,true);
});

test('Codex: 앞 차례의 늦은 소식이 다음 차례에 섞이지 않는다', async () => {
  const turn=st.schemaTurn(providerError,codes);
  const client=fakeCodex(turn,{answer:()=>JSON.stringify({notes:[1]})});
  await turn.ask(client,opts(),'첫째',schema);
  const old=client.threads[0].id;
  turn.receive({method:'item/completed',params:{threadId:old,turnId:randomUUID(),item:{type:'commandExecution'}}});
  assert.deepEqual(await turn.ask(client,opts(),'둘째',schema),{notes:[1]});
});

test('Codex: 지킴 뒤 로그아웃 소식은 LOGIN, account/updated는 차례 끝에 계정을 다시 견준다', async () => {
  const turn=st.schemaTurn(providerError,codes);
  turn.guard();
  turn.receive({method:'account/updated',params:{}});
  turn.check();
  const client=fakeCodex(turn);
  let verified=0;
  await turn.ask(client,{...opts(),verify:async()=>{verified++;}},'x',schema);
  assert.equal(verified,2,'차례 앞 한 번, 소식 뒤 한 번');
  turn.receive({method:'account/logout/completed',params:{}});
  assert.throws(()=>turn.check(),{code:'LOGIN'});
});
