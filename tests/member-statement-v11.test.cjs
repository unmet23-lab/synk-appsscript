'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const Old=require('../experiences/synk-account/src/member-statement-v10.cjs');
const text='음악 좋아요. '.repeat(11)+'저는 취미가 있어요.';
const at='2026-10-29T00:00:00.000Z';
test('a declared current preference stays distinct from a one-time directive',()=>{
 for(const text of ['전에는 함께 하는 걸 좋아했는데 지금은 혼자 해 보는 쪽이 좋아요.','여러 일을 벌이느니 지금 하는 것 하나를 끝내고 넘어가는 편이 낫겠어요.']){const result=C.parseMemberStatement(text);assert.equal(result.question,null,text);assert.equal(result.meanings.length,1,text);}
});
test('bounded now and polite request families require duration consent',()=>{
 for(const text of ['저는 지금만 짧은 설명이 좋아요','저는 지금 한 번만 짧은 설명이 좋아요','지금은 설명은 짧게 해주시면 좋겠어요','지금은 짧은 설명 부탁드려요','지금은 짧은 설명 부탁드립니다','지금은 설명을 짧게 알려주세요','지금은 설명을 짧게 보여주세요','지금은 설명을 짧게 해주십시오']){const result=C.parseMemberStatement(text);assert.deepEqual(result.meanings,[],text);assert.ok(result.question,text);}
});
test('request morphology stays bounded before preference normalization',()=>{
 for(const text of ['지금은 짧은 설명 부탁합니다','지금은 짧게 알려줘요','지금은 짧게 보여줘','지금은 설명은 짧게 해 주면 좋겠어','지금은 설명은 짧게 해 주면 좋겠네요','지금은 설명은 짧게 해 주시면 감사하겠습니다','지금은 설명은 짧게 해주셨으면 해요']){const result=C.parseMemberStatement(text);assert.deepEqual(result.meanings,[],text);assert.ok(result.question,text);}
 // A comparative bound is not the limiting particle "only". This unsupported
 // comparison stays a value clarification, rather than a duration question.
 const compared=C.parseMemberStatement('저는 지금만큼 짧은 설명이 좋아요');assert.ok(compared.question);assert.doesNotMatch(compared.question.label,/이후에도/);
});
test('one-time instructions do not become automatic persistent preferences',()=>{
 for(const text of ['이번에는 설명은 짧게 해주세요','이번엔 예시를 좋아해요','저는 이번에만 짧은 설명이 좋아요','지금은 설명은 짧게 해주세요','지금 설명은 짧게 해주세요','지금은 설명을 짧게 해주세요. 예시가 좋아요.','그와 별개로 지금은 설명은 짧게 해주세요','설명은 지금은 짧게 해주세요','지 금은 설명은 짧게 해주세요']){
  const result=C.parseMemberStatement(text);assert.deepEqual(result.meanings,[]);assert.ok(result.unresolved.length);
 }
 assert.equal(C.parseMemberStatement('설명은 짧게 해주세요').meanings[0].value,'brief');
 const text='지금은 설명은 짧게 해주세요',preview=C.parseMemberStatement(text);assert.match(preview.question.label,/이후에도/);
 const answer=optionId=>C.parseMemberStatement(text,{clarifications:[{questionId:preview.question.id,optionId}]});assert.deepEqual(answer('not-current').meanings,[]);assert.equal(answer('confirm').meanings[0].value,'brief');
 assert.equal(Old.parseMemberStatement('이번에는 설명은 짧게 해주세요').meanings[0].value,'brief','Saved parser10 replay remains unchanged');
});
const row=(parser,id,input=text)=>({id:`00000000-0000-4000-8000-${String(id).padStart(12,'0')}`,parserVersion:parser.PARSER_VERSION,text:input,at,confirmedAt:at,meanings:parser.parseMemberStatement(input).meanings,clarifications:[]});

test('selecting one preference retains compatible neighbours in a non-transitive conflict',()=>{
 const text='예시를 좋아해요. 혼자 하는 게 좋아요. 예시가 싫어요.',preview=C.parseMemberStatement(text),choice=preview.question.options.find(o=>o.id==='p1'),clarifications=[{questionId:preview.question.id,optionId:choice.id}],next=C.parseMemberStatement(text,{clarifications});
 assert.equal(next.question,null);assert.deepEqual(next.meanings.map(m=>[m.value,m.polarity]),[['independent','prefer'],['example','avoid']]);
 const saved={...row(C,3,text),meanings:next.meanings,clarifications};assert.deepEqual(C.validateMemberStatement(saved),saved);
 const legacy=Old.parseMemberStatement(text),old=Old.parseMemberStatement(text,{clarifications:[{questionId:legacy.question.id,optionId:'p1'}]});assert.equal(old.meanings.length,1,'Saved parser10 behavior remains frozen');
});

test('saved parser 10 rows retain their original validation and byte identity',()=>{
 assert.equal(Old.PARSER_VERSION,'member-statement-ko-10');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v10.cjs'))).digest('hex'),'4519aca79459b4742aca5e009d1b571d0c3698b9db6eb87076b691c1ce7e315f');
 assert.equal(Old.parseMemberStatement(text).question,null);
 assert.ok(C.parseMemberStatement(text).question,'new input can clarify the twelfth meaningful clause');
 assert.deepEqual(C.validateMemberStatement(row(Old,1)),Old.validateMemberStatement(row(Old,1)));
 assert.deepEqual(C.parseMemberStatement(text,{parserVersion:Old.PARSER_VERSION}),Old.parseMemberStatement(text));
});

test('document 11 remains readable and only a newly confirmed parser 11 row advances the document',async()=>{
 const D=await import('../experiences/synk-account/src/member-understanding-data.mjs');
 const saved={version:11,reviews:[],overrides:[],statements:[row(Old,1)]};
 assert.deepEqual(D.validateMemberUnderstanding(saved),saved);
 const fresh=row(C,2,'저는 요리를 좋아해요.');
 assert.throws(()=>D.validateMemberUnderstanding({...saved,statements:[fresh]}),{code:'INVALID_PERSONAL_STATE'});
 const next=D.updateMemberUnderstanding(saved,{type:'statement',value:fresh,replaceId:null},Date.parse(at));
 assert.equal(next.version,12);assert.deepEqual(next.statements[0],saved.statements[0]);
 assert.deepEqual(next.statements[1],fresh);assert.deepEqual(D.validateMemberUnderstanding(next),next);
});
