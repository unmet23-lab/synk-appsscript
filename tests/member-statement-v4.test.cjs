'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const V3=require('../experiences/synk-account/src/member-statement-v3.cjs');
const A=require('../experiences/synk-account/src/member-statement.cjs');
const at='2026-10-16T00:00:00.000Z',later='2026-10-16T00:01:00.000Z';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tuple=m=>[m.field,m.value,m.polarity,m.condition];
const preview=(text,clarifications=[])=>A.previewMemberStatement({text,asOf:at,clarifications});
const save=(p,n=1)=>A.confirmMemberStatement({preview:p,acceptedIds:p.proposals.map(m=>m.id),id:uuid(n),at});

test('ko3 is byte frozen and every previous 160 sentence replays through its original parser',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v3.cjs'))).digest('hex'),'8eadd4133d3474150d577c6b4e86286ed6370030956bccbdbfb248883d15f271');
  const rows=['evaluation','followup-evaluation','generalization-evaluation'].flatMap(name=>require(`./fixtures/member-statement-v3-${name}.json`).cases);
  assert.equal(rows.length,160);
  for(const [index,row] of rows.entries()){
    const original=V3.parseMemberStatement(row.text), replay=C.parseMemberStatement(row.text,{parserVersion:V3.PARSER_VERSION});
    assert.deepEqual(replay,original,row.id);
    if(original.question){const clarifications=[{questionId:original.question.id,optionId:'skip'}];assert.deepEqual(C.parseMemberStatement(row.text,{parserVersion:V3.PARSER_VERSION,clarifications}),V3.parseMemberStatement(row.text,{clarifications}),row.id);}
    if(!original.question&&original.meanings.length){
      const saved={id:uuid(index+1),parserVersion:V3.PARSER_VERSION,text:row.text,at,confirmedAt:at,meanings:original.meanings,clarifications:[]};
      assert.deepEqual(C.validateMemberStatement(saved),V3.validateMemberStatement(saved),row.id);
      assert.ok(A.resolveMemberStatements([saved],later).entries.every(e=>e.verified&&e.active),row.id);
    }
  }
});

test('new nominal preference and rejection grammar composes across unrelated action groups',()=>{
  const bases=[['메신저에 생각을 적어서 주고받는 것','communication','written'],['계획을 미리 세워 놓는 것','work-style','plan-first'],
    ['후보들을 서로 비교해 본 뒤에 고르는 것','decision','compare-options'],['핵심 이유를 자세하게 설명해 주는 것','explanation-detail','reasons-detail'],['사진 찍는 것','topic','photography']];
  for(const [action,field,value] of bases)for(const [suffix,polarity] of [['이 제게 잘 맞아요','prefer'],['은 저랑 안 맞아요','avoid'],['도 좋아하는 편이에요','prefer'],['은 딱히 좋아하지 않는 편입니다','avoid'],['이 좋더라고요','prefer']]){
    const text=action+suffix,p=preview(text);assert.equal(p.question,null,text);assert.deepEqual(p.proposals.map(tuple),[[field,value,polarity,null]],text);
    const saved=save(p);assert.deepEqual(C.validateMemberStatement(saved),saved,text);assert.equal(saved.parserVersion,C.PARSER_VERSION);
    assert.equal(saved.meanings[0].evidence.quote,text);assert.equal(A.resolveMemberStatements([saved],later).entries[0].active,true);
  }
});

test('expanded grammar does not erase scope, subject, negation, uncertainty or commanded actions',()=>{
  const actions=['계획을 미리 세워 놓는 것','후보들을 서로 비교해 본 뒤에 고르는 것','사진 찍는 것'];
  for(const action of actions)for(const text of [`친구는 ${action}이 제게 잘 맞아요`,`예전에는 ${action}이 좋았어요`,`만약 ${action}이 좋다면`,`휴가일 때만 ${action}이 좋아요`,`${action}이 좋은지 잘 모르겠어요`,`${action}을 좋아한다고 말해요`,`${action}을 좋아하는 것으로 저장해 주세요`]){
    assert.equal(preview(text).proposals.length,0,text);
  }
  for(const text of ['계획을 미리 세워 놓는 것이 안 맞지는 않아요','음악을 좋아하지 않는 건 아니에요','글로 소통하지 않는 편이에요'])assert.equal(preview(text).proposals.length,0,text);
  for(const text of ['음악 듣는 걸 좋아하고 싶어요','글로 소통하는 게 좋고 싫고를 아직 모르겠어요','계획을 세우는 게 좋고 말고는 아직 모르겠어요'])assert.equal(preview(text).proposals.length,0,text);
});

test('coordinated meanings share a stance without inventing an opposite or changing their evidence',()=>{
  for(const [text,polarity] of [['근거를 확인하는 것도, 다른 사람과 상의하는 것도 좋아합니다.','prefer'],['근거를 확인하는 것도, 다른 사람과 상의하는 것도 좋아하지 않습니다.','avoid']]){
    const p=preview(text);assert.equal(p.question,null,text);assert.deepEqual(p.proposals.map(tuple),[['decision','evidence',polarity,null],['decision','consult',polarity,null]]);
    assert.ok(p.proposals.every(m=>text.slice(m.evidence.start,m.evidence.end)===m.evidence.quote));
  }
  const p=preview('말하는 것보다는 글로 의견을 전달하는 게 편해요.');
  assert.deepEqual(p.proposals.map(tuple),[['communication','written','prefer',null]]);assert.equal(p.proposals.some(m=>m.polarity==='avoid'),false);
});

test('conjoined current condition stays local and an explicit general reset ends it',()=>{
  for(const [text,second] of [['회의에서는 글로 소통하는 게 좋고 말로 소통하는 것도 좋아요','meeting'],['회의에서는 글로 소통하는 게 좋고 평소에는 말로 소통하는 것도 좋아요',null],['회의에서는 글로 소통하는 게 좋아요. 말로 소통하는 것도 좋아요',null]]){
    const p=preview(text);assert.equal(p.question,null,text);assert.deepEqual(p.proposals.map(tuple),[['communication','written','prefer','meeting'],['communication','spoken','prefer',second]],text);
  }
  const shared=preview('회의에서는 글로 소통하는 것도, 평소에는 말로 소통하는 것도 좋아요');
  assert.equal(shared.question,null);assert.deepEqual(shared.proposals.map(tuple),[['communication','written','prefer','meeting'],['communication','spoken','prefer',null]]);
  const conditional=preview('예시를 한 번 본 뒤에는 혼자 해 보는 게 좋아요');
  assert.deepEqual(conditional.proposals.map(tuple),[['support','independent','prefer','after-example']]);
  assert.equal(conditional.proposals.some(m=>m.value==='example'),false);
});

test('rejecting an exclusive communication medium asks before broadening the rejection to that medium',()=>{
  for(const text of ['글로만 의견을 주고받는 건 선호하지 않아요','문자로만 소통하는 건 싫어요']){
    const p=preview(text);assert.equal(p.proposals.length,0);assert.ok(p.question?.options.some(o=>o.id==='confirm'),text);
    const skipped=preview(text,[{questionId:p.question.id,optionId:'skip'}]);assert.equal(skipped.question,null);assert.equal(skipped.proposals.length,0);
    const accepted=preview(text,[{questionId:p.question.id,optionId:'confirm'}]);assert.equal(accepted.question,null);assert.deepEqual(accepted.proposals.map(tuple),[['communication','written','avoid',null]]);assert.equal(save(accepted).clarifications.length,1);
  }
});

test('current preference after a past clause is explicit and does not revive a past declaration',()=>{
  const p=preview('전에는 함께 하는 걸 좋아했는데 지금은 혼자 해 보는 쪽이 좋아요');
  assert.equal(p.question,null);assert.deepEqual(p.proposals.map(tuple),[['support','independent','prefer',null]]);assert.ok(p.unresolved.some(u=>u.reason==='past'));
  assert.equal(preview('전에는 함께 하는 걸 좋아했는데 혼자 해 보는 쪽이 좋아요').proposals.length,0);
});

test('known hedged or question-form meanings need one answer and final confirmation, never an implicit preference',()=>{
  for(const text of ['글로 소통하는 게 아마 더 좋을 수도 있겠네요','계획을 먼저 세우는 편일지도 몰라요','글로 소통하는 게 좋아요?']){
    const p=preview(text);assert.equal(p.proposals.length,0,text);assert.ok(p.question.options.some(o=>o.id==='confirm'),text);assert.throws(()=>save(p));
    for(const optionId of ['unsure','skip','not-current']){const next=preview(text,[{questionId:p.question.id,optionId}]);assert.equal(next.proposals.length,0,text);assert.equal(next.question,null,text);}
    const confirmed=preview(text,[{questionId:p.question.id,optionId:'confirm'}]);assert.equal(confirmed.question,null,text);assert.equal(confirmed.proposals.length,1,text);assert.throws(()=>A.confirmMemberStatement({preview:confirmed,acceptedIds:[],id:uuid(1),at}));
    const saved=save(confirmed);assert.equal(saved.clarifications.length,1);assert.deepEqual(C.validateMemberStatement(saved),saved);
    const report=A.summarizeStatementRelations({document:{version:5,statements:[saved]},facets:[],asOf:later});assert.equal(report.statementHistory[0].clarificationAnswers.length,1);
  }
});

test('an anaphoric hobby explanation adds no question or additional meaning to an already understood statement',()=>{
  const p=preview('게임하는 걸 좋아해요, 제 취미거든요.');assert.equal(p.question,null);assert.deepEqual(p.proposals.map(tuple),[['topic','games','prefer',null]]);
  assert.equal(preview('제 취미거든요').proposals.length,0);assert.ok(preview('제 취미거든요').question);
  assert.ok(preview('게임하는 걸 좋아해요, 다른 건 아직 모르겠어요.').question);
});

test('action normalization retains a meaningful noun head and does not invent an explanation from bare duration',()=>{
  const explanation=preview('너무 길게 이어지는 설명은 부담스러워서 싫어요');
  assert.equal(explanation.question,null);assert.deepEqual(explanation.proposals.map(tuple),[['explanation-detail','long-flow','avoid',null]]);
  for(const text of ['길게 이어지는 게 싫어요','길게 이어지는 방식이 싫어요'])assert.equal(preview(text).proposals.length,0,text);
  const p=preview('글로 의견을 나누는 방식이 말로 설명하는 것보다 저에게 더 편해요');
  assert.equal(p.question,null);assert.deepEqual(p.proposals.map(tuple),[['communication','written','prefer',null]]);
  assert.equal(p.proposals[0].evidence.quote,p.text);assert.deepEqual(C.validateMemberStatement(save(p)),save(p));
});
