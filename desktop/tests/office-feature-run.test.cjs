'use strict';
/* 기능 업무의 차례 고르기(사업계획서 설계 14.3, 설계 검토 2): 차례마다 {provider, model}, 곁 회사는 처음 부를 때 열고 막히면 그 자리만 비운다 */
const test=require('node:test');
const assert=require('node:assert/strict');
const {featureRun,employeeEnv}=require('../src/office-task-runtime.cjs');

const fail=code=>Object.assign(new Error(code),{code});
function deps({claudeLogin='acct-1',codexOpen='ok',claudeCli=true,codexCli=true,log=[]}={}){
  return {
    native:async name=>{if(name==='claude'&&!claudeCli)throw fail('NO_CLI');if(name==='codex'&&!codexCli)throw fail('NO_CLI');return 'C:/bin/'+name+'.exe';},
    exec:async()=>({stdout:'2.1.330 (Claude Code)'}),
    claudeAccount:async()=>claudeLogin,
    claudeSchemaTurn:async({prompt,model,onInit})=>{log.push(['claude',model,prompt]);onInit?.({model:model==='opus'?'claude-opus-5-5':model==='sonnet'?'claude-sonnet-5-5':'claude-default'});return {ok:'claude'};},
    withSchemaAccount:async(spec,hooks,tools,work)=>{
      if(codexOpen!=='ok')throw fail(codexOpen);
      return work(async(prompt,schema,options)=>{log.push(['codex',options.model||null,prompt]);assert.equal(options.onInit,undefined,'Codex 차례에는 onInit을 넘기지 않는다');return {ok:'codex'};});
    },
  };
}
const hooks={signal:new AbortController().signal};

test('업무 줄의 회사가 Claude면 차례마다 모델을 넘기고 실제 모델을 알린다. 곁 회사가 없으면 Codex 차례는 막힌다', async () => {
  const log=[],seen=[];
  const out=await featureRun({spec:{id:'x',provider:'claude'},hooks,file:'C:/bin/claude.exe',env:{},cwd:'C:/w',run:async tools=>{
    assert.deepEqual(tools.providers,['claude']);
    await tools.turn('a',{},{model:'opus',onInit:i=>seen.push(i.model)});
    await tools.turn('b',{},{provider:'claude',model:'sonnet',onInit:i=>seen.push(i.model)});
    await assert.rejects(tools.turn('c',{},{provider:'codex'}),{code:'LOGIN'});
    return 'done';
  }},deps({log}));
  assert.equal(out,'done');
  assert.deepEqual(log,[['claude','opus','a'],['claude','sonnet','b']]);
  assert.deepEqual(seen,['claude-opus-5-5','claude-sonnet-5-5']);
});

test('손님이 다른 회사 심사위원을 켜면 Claude 업무 줄도 Codex 차례를 부른다', async () => {
  const log=[];
  await featureRun({spec:{id:'x',provider:'claude',alsoProviders:['codex']},hooks,file:'C:/bin/claude.exe',env:{},cwd:'C:/w',run:async tools=>{
    assert.deepEqual(tools.providers,['claude','codex']);
    await tools.turn('a',{},{model:'opus'});
    await tools.turn('s',{},{provider:'codex'});
  }},deps({log}));
  assert.deepEqual(log.map(x=>x[0]),['claude','codex']);
});

test('곁 회사(Codex)가 로그인 · 설치에서 막히면 그 자리만 비우고 업무는 돈다', async () => {
  for(const [opt,code] of [[{codexOpen:'LOGIN'},'LOGIN'],[{codexOpen:'LIMIT'},'LIMIT'],[{codexCli:false},'NO_CLI']]){
    const log=[];
    const out=await featureRun({spec:{id:'x',provider:'claude',alsoProviders:['codex']},hooks,file:'C:/bin/claude.exe',env:{},cwd:'C:/w',run:async tools=>{
      assert.deepEqual(tools.providers,['claude']);
      await tools.turn('a',{},{model:'sonnet'});
      await assert.rejects(tools.turn('s',{},{provider:'codex'}),{code});
      return 'done';
    }},deps({...opt,log}));
    assert.equal(out,'done',code);
    assert.deepEqual(log.map(x=>x[0]),['claude']);
  }
});

test('업무 줄의 회사가 Codex면 Codex 연결이 막힐 때 업무가 멈추고, 곁 회사 Claude가 막히면 그 차례만 실패한다', async () => {
  await assert.rejects(featureRun({spec:{id:'x',provider:'codex'},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async()=>'never'},deps({codexOpen:'LOGIN'})),{code:'LOGIN'});
  const log=[];
  const out=await featureRun({spec:{id:'x',provider:'codex',alsoProviders:['claude']},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async tools=>{
    await tools.turn('s',{},{});
    await assert.rejects(tools.turn('a',{},{provider:'claude',model:'opus'}),{code:'LOGIN'});
    return 'done';
  }},deps({claudeLogin:null,log}));
  assert.equal(out,'done');
  assert.deepEqual(log.map(x=>x[0]),['codex']);
  // 곁 회사가 아닌 Claude 차례는 부르지 않는다
  await featureRun({spec:{id:'x',provider:'codex'},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async tools=>{
    await assert.rejects(tools.turn('a',{},{provider:'claude'}),{code:'LOGIN'});
  }},deps());
});

test('업무 줄의 회사가 Claude인데 로그인이 풀려 있으면 시작 전에 멈춘다', async () => {
  await assert.rejects(featureRun({spec:{id:'x',provider:'claude'},hooks,file:'C:/bin/claude.exe',env:{},cwd:'C:/w',run:async()=>'never'},deps({claudeLogin:null})),{code:'LOGIN'});
});

test('직원 환경에서 모델을 정하는 변수를 지운다(심사위원이 고른 모델로 돌게)', () => {
  const env=employeeEnv({PATH:'x',ANTHROPIC_MODEL:'a',ANTHROPIC_DEFAULT_OPUS_MODEL:'b',ANTHROPIC_DEFAULT_SONNET_MODEL:'c',ANTHROPIC_SMALL_FAST_MODEL:'d',CLAUDE_CODE_SUBAGENT_MODEL:'e'});
  assert.deepEqual(env,{PATH:'x'});
});

test('GPT 검수 GA10: 업무가 끝난 뒤 마지막 계정 확인에서 막혀도 주 회사가 Codex인 업무의 결과를 돌려준다', async () => {
  const d=deps();
  d.withSchemaAccount=async(spec,hooks,tools,work)=>{await work(async()=>({ok:'codex'}));throw fail('LOGIN');};
  const out=await featureRun({spec:{id:'x',provider:'codex'},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async tools=>{await tools.turn('a',{},{});return 'done';}},d);
  assert.equal(out,'done');
  const d2=deps();
  d2.withSchemaAccount=async()=>{throw fail('LOGIN');};
  await assert.rejects(featureRun({spec:{id:'x',provider:'codex'},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async()=>'never'},d2),{code:'LOGIN'},'시작 전에 막히면 그대로 멈춘다');
});

test('GPT 검수 2회차 GA1: 업무가 끝난 뒤 마지막 확인에서 취소가 오면 결과를 돌려주지 않고 취소한다', async () => {
  const d=deps();
  d.withSchemaAccount=async(spec,hooks,tools,work)=>{await work(async()=>({ok:'codex'}));throw fail('CANCELLED');};
  await assert.rejects(featureRun({spec:{id:'x',provider:'codex'},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async tools=>{await tools.turn('a',{},{});return 'done';}},d),{code:'CANCELLED'});
});

test('설계 검토 D1: 곁 회사 Claude 차례는 계정 확인을 기다린 뒤 보내기 바로 앞에 allow()를 보고, 꺼졌으면 보내지 않는다', async () => {
  const log=[];let on=true,n=0;
  const d=deps({log});
  const acct=d.claudeAccount;
  d.claudeAccount=async(...a)=>{const v=await acct(...a);if(++n===2)on=false;return v;};
  const out=await featureRun({spec:{id:'x',provider:'codex',alsoProviders:['claude']},hooks,file:'C:/bin/codex.exe',env:{},cwd:'C:/w',run:async tools=>{
    assert.deepEqual(tools.asked,['codex','claude'],'이 업무가 연 회사를 기능에 알린다');
    await assert.rejects(tools.turn('p',{},{provider:'claude',model:'opus',allow:()=>on}),{code:'OFF'});
    return 'done';
  }},d);
  assert.equal(out,'done');
  assert.deepEqual(log.filter(x=>x[0]==='claude'),[],'끈 뒤에는 Claude로 보내지 않는다');
});
