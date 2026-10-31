'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const current=require('../experiences/synk-account/src/member-statement-contract.cjs');
const parse=text=>current.parseMemberStatement(text);
const has=(output,field,value)=>output.meanings.some(m=>m.field===field&&m.value===value);
const confirmOwner=(text,output=parse(text))=>{
  assert.equal(output.meanings.length,0);assert.match(output.question.label,/본인에 대한 이야기/);
  return current.parseMemberStatement(text,{clarifications:[{questionId:output.question.id,optionId:'confirm'}]});
};

test('an explicit self introduction resumes own preferences after another person',()=>{
  const output=confirmOwner('제 동료는 긴 설명을 선호해요. 제 방식은 이래요. 짧은 설명이 좋아요.');
  assert.ok(has(output,'explanation','brief'));
  assert.equal(output.meanings.find(m=>m.field==='explanation').evidence.quote,'짧은 설명이 좋아요');
  assert.equal(output.meanings.find(m=>m.field==='explanation').condition,null);
});

test('a quoted self introduction never changes the preference owner',()=>{
  const output=parse('제 친구가 말했어요. 「제 취향은 다음과 같아요. 짧은 설명이 좋아요.」');
  assert.equal(output.meanings.length,0);
});

test('reattributing a preference also owns the following omitted-subject continuation',()=>{
  const output=parse('글로 소통하는 게 좋아요. 제 친구가 좋아한다는 뜻이에요. 짧은 설명이 좋아요.');
  assert.equal(output.meanings.length,0);
  assert.ok(output.unresolved.some(r=>r.quote==='짧은 설명이 좋아요'&&r.reason==='other'));
});

test('a fresh explicit self subject after reattribution gets no cancelled condition',()=>{
  const output=parse('회의할 때는 글로 소통하는 게 좋아요. 제 친구가 좋아한다는 뜻이에요. 저는 계획을 먼저 세우는 게 좋아요.');
  assert.ok(has(output,'work-style','plan-first'));
  assert.equal(output.meanings.find(m=>m.field==='work-style').condition,null);
});

test('before getting help expresses a current method instead of past ownership',()=>{
  const output=parse('도움받기 전에는 혼자 해 보고 싶어요.');
  assert.ok(has(output,'support','independent'));
  assert.equal(output.unresolved.some(r=>r.reason==='past'),false);
});

test('starting a task is a current method rather than a standalone past adverb',()=>{
  const output=parse('저는 시작하기 전에는 계획을 먼저 세우는 게 좋아요.');
  assert.ok(has(output,'work-style','plan-first'));
  assert.equal(output.unresolved.length,0);
});

test('a self introduction does not bypass the earlier one-time duration boundary',()=>{
  const text='이번에는 짧게 설명해 주세요. 제 친구는 긴 설명을 좋아해요. 제 취향은 다음과 같아요. 짧은 설명이 좋아요.';
  const first=parse(text);assert.equal(first.meanings.length,0);assert.match(first.question.label,/이후에도/);
  const answers=[{questionId:first.question.id,optionId:'not-current'}];
  const next=current.parseMemberStatement(text,{clarifications:answers});
  assert.equal(next.meanings.length,0);assert.match(next.question.label,/짧은 설명이 좋아요.*이후에도/);
  const final=current.parseMemberStatement(text,{clarifications:[...answers,{questionId:next.question.id,optionId:'not-current'}]});
  assert.equal(final.question,null);assert.equal(final.meanings.length,0);
});

test('a standalone past adverb still prevents current preference inference',()=>{
  for(const text of ['전에는 짧은 설명이 좋아요.','저는 전에는 짧은 설명이 좋아요.','예전에는 짧은 설명을 좋아했어요.',...['이전에는','그전에는','오래전에는','한참전에는','얼마전에는','조금전에는','좀전에는'].map(prefix=>prefix+' 예시부터 보고 싶고 혼자 해 보고 싶어요.')]){
    const output=parse(text);assert.equal(output.meanings.length,0);assert.ok(output.unresolved.some(r=>r.reason==='past'));
  }
});

test('demonstratives and family stories do not become other-person subjects',()=>{
  for(const text of ['처음엔 예시부터 보고 싶어요. 그 이후에는 혼자 해 보고 싶어요.','그 가운데 음악이 좋아요.','가족 이야기를 읽는 걸 좋아해요.','선생님 이야기를 듣는 게 좋아요.']){
    assert.equal(parse(text).unresolved.some(r=>r.reason==='other'),false,text);
  }
});

test('actual other-person subjects remain excluded',()=>{
  for(const text of ['그는 짧은 설명이 좋아요.','그가 짧은 설명을 좋아해요.','가족이 짧은 설명을 좋아해요.','선생님은 긴 설명을 선호해요.',...['그분은','그분이','그분께서는','그들은','그들께서','그에게는','그한테는'].map(subject=>subject+' 긴 설명을 선호해요.')]){
    const output=parse(text);assert.equal(output.meanings.length,0,text);assert.ok(output.unresolved.some(r=>r.reason==='other'),text);
  }
});

test('an ambiguous plural subject cannot establish an own preference or its continuation',()=>{
  // Plural -이 also introduces supported relative clauses, so its reason can
  // remain unknown; neither clause may silently become the member's claim.
  assert.equal(parse('그들이 긴 설명을 선호해요. 짧은 설명이 좋아요.').meanings.length,0);
});

test('the previously shipped parser keeps historical replay semantics',()=>{
  const text='제 동료는 긴 설명을 선호해요. 제 방식은 이래요. 짧은 설명이 좋아요.';
  const historic=current.parseMemberStatement(text,{parserVersion:'member-statement-ko-11'});
  assert.equal(historic.parserVersion,'member-statement-ko-11');
  assert.equal(historic.meanings.length,0);
  assert.ok(historic.unresolved.some(r=>r.quote==='짧은 설명이 좋아요'&&r.reason==='other'));
  assert.ok(has(confirmOwner(text),'explanation','brief'));
});

test('an unquoted reported first person needs ownership confirmation and can be declined',()=>{
  for(const text of ['제 동료가 이렇게 말했어요. 제 방식은 이래요. 긴 설명이 좋아요.','제 동료가 짧은 설명이 좋다고 말했어요. 제 방식은 이래요. 긴 설명이 좋아요.']){
    const output=parse(text);assert.equal(output.meanings.length,0);assert.match(output.question.label,/본인에 대한 이야기/);
    const declined=current.parseMemberStatement(text,{clarifications:[{questionId:output.question.id,optionId:'not-current'}]});
    assert.equal(declined.meanings.length,0);assert.equal(declined.question,null);
  }
});
