import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SCENARIOS, MAX_SESSIONS, MAX_IMPORT_BYTES, createSession, appendTurn, getTurn, retryTurn, stuckTurn, followupQuestion, archive, parseArchive, validateArchive, firstSentenceFrom } from '../domain.mjs';
const require = createRequire(import.meta.url);
const Ask = require('../../../atlas/ask.js');
const fresh = (scenario='interview', id='session-1') => createSession({ scenario, counterpart:'직장 동료', goal:'필요한 도움을 분명히 전하기', id, at:'2026-10-05T00:00:00.000Z' });
const complete = (scenario='interview', focus='specific', id='session-1') => {
  let session=fresh(scenario,id);
  for(let i=0;i<3;i++) session=appendTurn(session,{answer:`내가 작성한 답변 ${i}`,review:i===1?'stuck':'easy',focus});
  return session;
};

test('each scenario runs three authored turns and selected branch changes actual second prompt',()=>{
  for(const scenario of Object.keys(SCENARIOS)){
    const variants=['specific','concise','pressure'].map(focus=>complete(scenario,focus));
    assert.equal(new Set(variants.map(s=>SCENARIOS[scenario].turns[s.turns[1].id].prompt)).size,3);
    for(const s of variants){assert.deepEqual(s.turns.map(t=>t.id),['opening',s.focus,'close']);assert.throws(()=>appendTurn(s,{answer:'더',review:'easy'}));assert.doesNotThrow(()=>validateArchive(archive([s])));}
  }
});
test('canonical Core asks a question only when its choices change the next authored branch',()=>{
  for(const review of ['easy','unsure','stuck']){
    const chosen=followupQuestion(Ask,fresh(),review);
    assert.equal(chosen.status,'ask');assert.equal(chosen.question.id,'focus');
    assert.equal(chosen.ranked.find(q=>q.id==='pace').skippable,true);
    assert.equal(new Set(Object.values(chosen.ranked[0].outcomes).map(outcome=>outcome.content)).size,3);
  }
});
test('focus is locked after turn one so a session cannot export a mismatched branch',()=>{
  const first=appendTurn(fresh(),{answer:'답변',review:'stuck',focus:'concise'});
  assert.throws(()=>appendTurn(first,{answer:'다른 말',review:'easy',focus:'pressure'}),/중간에 바꿀/);
  const second=appendTurn(first,{answer:'짧은 말',review:'easy'});
  assert.equal(second.turns[1].id,'concise');
  assert.equal(getTurn(second).id,'close');
});
test('retry preserves original and recommendation follows declared post-retry feeling',()=>{
  const original=complete();
  assert.equal(stuckTurn(original),1);
  const retry=retryTurn(original,1,'더 분명하게 말한 문장','easy');
  assert.equal(retry.turns[1].answer,original.turns[1].answer);
  assert.equal(original.turns[1].retry,'');
  assert.equal(stuckTurn(retry),-1);
  assert.throws(()=>retryTurn(original,-1,'답변','easy'));
  assert.throws(()=>retryTurn(original,1,'','stuck'));
});
test('archive roundtrips unicode, XSS-looking text as plain data, and bounded worst case',()=>{
  const list=Array.from({length:MAX_SESSIONS},(_,i)=>{
    const s=complete('request','specific',`item-${i}`);
    s.counterpart='가'.repeat(80);s.goal='가'.repeat(240);s.firstSentence='가'.repeat(600);s.takeaway='가'.repeat(600);
    s.turns=s.turns.map(turn=>({...turn,answer:'가'.repeat(2000),retry:'가'.repeat(2000),retryReview:'easy'}));return s;
  });
  const text=JSON.stringify(archive(list),null,2);
  assert.ok(Buffer.byteLength(text)<MAX_IMPORT_BYTES);
  assert.equal(parseArchive(text).sessions.length,MAX_SESSIONS);
  const xss=complete();xss.firstSentence='<img src=x onerror=alert(1)>';
  assert.equal(parseArchive(JSON.stringify(archive([xss]))).sessions[0].firstSentence,xss.firstSentence);
  xss.firstSentence=firstSentenceFrom('가'.repeat(599)+'😀');
  assert.equal(xss.firstSentence,'가'.repeat(599));
  assert.doesNotThrow(()=>archive([xss]));
});
test('imports reject invalid schema, unknown/prototype fields, oversized data and foreign scenario branches',()=>{
  const good=archive([complete()]);
  for(const mutate of [a=>a.schema=2,a=>a.unknown=true,a=>a.sessions[0].scenario='unknown',a=>a.sessions[0].turns[1].id='pressure',a=>a.sessions[0].turns[0].review='AI:99',a=>a.sessions[0].turns[0].answer='\u0000',a=>a.sessions[0].turns[0].answer='\ud800',a=>a.sessions[0].turns[0].extra=true,a=>a.sessions.push(a.sessions[0])]){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateArchive(bad));
  }
  assert.throws(()=>parseArchive(JSON.stringify(good).replace('"schema":1','"schema":1,"__proto__":{}')));
  assert.throws(()=>parseArchive('{broken'));
  assert.throws(()=>parseArchive('x'.repeat(MAX_IMPORT_BYTES+1)));
});
