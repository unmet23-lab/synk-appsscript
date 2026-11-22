'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {planMail}=require('../src/office-mail-plan.cjs');
const {mailAppServer}=require('./fixtures/office-mail-app-server.cjs');
const generalSchema=require('../src/office-mail-plan.schema.json');
const handoffSchema=require('../src/office-quote-search.schema.json');

const base={scope:'mailbox',mailRef:'',otherRef:'',terms:[],from:'',after:'',before:'',folder:'received',provider:'all',inherit:false,clear:[],mergeTerms:'replace',attachment:'',unmet:[]};
async function plan(spec,packet,expectedSchema){
  const server=mailAppServer({result:params=>{
    assert.deepEqual(params.outputSchema,expectedSchema);
    assert.match(params.input[0].text,new RegExp(spec.prompt));
    return packet;
  }});
  const hooks={signal:new AbortController().signal,session:async()=>true,checkpoint:async()=>true};
  const result=await planMail({id:randomUUID(),...spec},hooks,{file:'codex-fixture',spawn:server.spawn,env:{}});
  assert.equal(server.sessions.length,1);
  const methods=server.sessions[0].requests.map(row=>row.method);
  assert.equal(methods[methods.indexOf('turn/start')-1],'account/read');
  return result;
}
test('GPT 직원은 일반 메일 검색과 미회신 견적 인계의 서로 다른 출력 형식을 같은 공식 로그인에서 사용한다',async()=>{
  const general={mailJudge:true,prompt:'지난주 받은편지함에서 견적 메일 찾아줘'};
  const packet={...base,mailRef:'메일',terms:['견적'],folder:'inbox',provider:'',period:'last_week',
    evidence:[{role:'delivered',quote:'지난주',nth:1},{role:'folder',quote:'받은편지함',nth:1},{role:'about',quote:'견적',nth:1}]};
  const decision=await plan(general,packet,generalSchema);
  assert.equal(decision.kind,'mailbox');
  assert.equal(decision.plan.folder,'inbox');
  assert.deepEqual(decision.plan.terms,['견적']);
  assert.ok(decision.plan.after&&decision.plan.before);
  const quote={quoteHandoff:true,prompt:'미회신 견적 문의를 견적 담당에게 넘겨줘'};
  const handoff=await plan(quote,base,handoffSchema);
  assert.deepEqual([handoff.terms,handoff.folder,handoff.provider],[[],'received','all']);
  await assert.rejects(plan(quote,{...base,unmet:['안 읽은 메일만']},handoffSchema),{code:'MAIL_PLAN'});
  await assert.rejects(plan(quote,packet,handoffSchema),{code:'MAIL_PLAN'});
  assert.notEqual((await plan(general,base,generalSchema)).kind,'mailbox');
});
