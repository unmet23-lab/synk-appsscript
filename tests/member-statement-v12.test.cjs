'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs'),Old=require('../experiences/synk-account/src/member-statement-v11.cjs');
const at='2026-10-31T00:00:00.000Z',text='이번에만 음악을 틀어 주세요';
test('a clause omitted at the input budget cannot ask a duration question with no selectable meaning',()=>{
 const input='음악이 좋아요. '.repeat(11)+'이번에만 음악을 틀어 주세요. 요리도 좋아요.',parsed=C.parseMemberStatement(input);
 assert.equal(parsed.question,null);assert.ok(parsed.unresolved.some(e=>e.reason==='limit'&&e.quote.includes('이번에만')));assert.ok(!parsed.meanings.some(m=>m.value==='cooking'));
});
function answer(input,clarifications,option){const r=C.parseMemberStatement(input,{clarifications});assert.ok(r.question);assert.ok(r.question.options.some(o=>o.id===option),option);return [...clarifications,{questionId:r.question.id,optionId:option}];}
function persistentMusic(){let a=[];for(const option of ['confirm','topic','music','prefer','general'])a=answer(text,a,option);const parsed=C.parseMemberStatement(text,{clarifications:a});assert.equal(parsed.question,null);return{parsed,clarifications:a};}
const row=(parser,input,parsed,clarifications=[])=>({id:'00000000-0000-4000-8000-000000000012',parserVersion:parser.PARSER_VERSION,text:input,at,confirmedAt:at,meanings:parsed.meanings,clarifications});

test('an unrecognized one-time request asks duration before selecting any lasting preference',()=>{
 const r=C.parseMemberStatement(text);assert.equal(r.parserVersion,'member-statement-ko-12');assert.deepEqual(r.meanings,[]);assert.match(r.question.label,/이후에도/);assert.deepEqual(r.question.options.map(o=>o.id).slice(0,2),['confirm','not-current']);
 for(const option of ['not-current','skip']){const a=answer(text,[],option),next=C.parseMemberStatement(text,{clarifications:a});assert.equal(next.question,null);assert.deepEqual(next.meanings,[]);assert.equal(next.unresolved[0].reason,'condition');}
});
test('a lasting preference requires both explicit duration consent and the complete interpretation',()=>{
 const {parsed,clarifications}=persistentMusic();assert.equal(parsed.meanings[0].value,'music');assert.equal(parsed.meanings[0].condition,null);assert.deepEqual(C.validateMemberStatement(row(C,text,parsed,clarifications)).clarifications,clarifications);
 const unfinished=C.parseMemberStatement(text,{clarifications:clarifications.slice(0,-1)});assert.deepEqual(unfinished.meanings,[]);assert.ok(unfinished.question);
});
test('duration consent does not bypass question, uncertainty, typo or ownership clarification',()=>{
 for(const input of ['이번엔 예시를 먼저 보는 게 좋아요?','이번엔 짧은 설명이 좋은 것 같아요','이번엔 짧은 설먕이 좋아요','이번에는 팀원들이 협업하는 방식에 관심을 두고 있어요']){
  const r=C.parseMemberStatement(input);assert.deepEqual(r.meanings,[],input);assert.ok(r.question,'This input must actually exercise duration consent: '+input);assert.match(r.question.label,/이후에도/,input);const a=answer(input,[],'confirm'),next=C.parseMemberStatement(input,{clarifications:a});assert.deepEqual(next.meanings,[],input);assert.ok(next.question,input);
 }
});
test('a new explicit self preference is not trapped in the earlier one-time request',()=>{
 const input='이번에는 짧게 설명해 주세요. 그리고 저는 예시를 먼저 보는 게 좋아요.',r=C.parseMemberStatement(input);assert.deepEqual(r.meanings.map(m=>m.value),['example']);assert.equal(r.meanings[0].condition,null);
 const a=answer(input,[],'not-current'),next=C.parseMemberStatement(input,{clarifications:a});assert.equal(next.question,null);assert.deepEqual(next.meanings.map(m=>m.value),['example']);assert.equal(next.unresolved[0].reason,'condition');
 const continuation=C.parseMemberStatement('지금은 설명은 짧게 해주세요. 예시가 좋아요.');assert.deepEqual(continuation.meanings,[],'an unowned continuation still needs duration consent');
});
test('the twelfth clause can finish its actual clarification under the active parser',()=>{
 const input='음악 좋아요. '.repeat(11)+'저는 취미가 있어요.',clarifications=[];let parsed=C.parseMemberStatement(input);assert.ok(parsed.question);
 for(const option of ['topic','music','prefer','general']){clarifications.push(...answer(input,clarifications,option).slice(clarifications.length));parsed=C.parseMemberStatement(input,{clarifications});}
 assert.equal(clarifications.length,4);assert.equal(parsed.question,null);assert.ok(parsed.meanings.some(m=>m.value==='music'));assert.ok(!parsed.unresolved.some(m=>m.reason==='limit'));
});
test('continuing-now and cross-word expressions are not mistaken for once-only consent',()=>{
 for(const input of ['지금도 짧게 해줘','지금까지 짧게 해줘','지금처럼 계속 짧게 해줘','가지 금액을 설명해줘','저는 지금만큼 짧은 설명이 좋아요']){const r=C.parseMemberStatement(input);assert.doesNotMatch(r.question?.label||'',/이후에도/,input);}
 for(const input of ['지금은 짧게 해줘요.','지 금은 설명은 짧게 해주세요','설명은 지금은 짧게 해주세요'])assert.match(C.parseMemberStatement(input).question.label,/이후에도/,input);
});
test('saved ko11 original source, interpretation and confirmation replay are recovered unchanged',()=>{
 const pin=require('./fixtures/member-parser-runtime-history-20261031.json').rows.find(r=>r.version===11);assert.equal(crypto.createHash('sha256').update(require('./_member-parser-source-history.cjs').beforeRuntimeMemo(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v11.cjs'),'utf8'),11)).digest('hex'),pin.sha256);
 let clarifications=[],parsed=Old.parseMemberStatement(text);for(const option of ['topic','music','prefer','general']){assert.ok(parsed.question.options.some(o=>o.id===option));clarifications.push({questionId:parsed.question.id,optionId:option});parsed=Old.parseMemberStatement(text,{clarifications});}
 assert.equal(parsed.question,null);assert.deepEqual(C.parseMemberStatement(text,{parserVersion:Old.PARSER_VERSION,clarifications}),parsed);const saved=row(Old,text,parsed,clarifications);assert.deepEqual(C.validateMemberStatement(saved),Old.validateMemberStatement(saved));
});
test('document13 preserves old confirmed rows and rejects a new parser row in an old document',async()=>{
 const D=await import('../experiences/synk-account/src/member-understanding-data.mjs'),oldText='짧은 설명이 좋아요',oldRow={...row(Old,oldText,Old.parseMemberStatement(oldText)),id:'00000000-0000-4000-8000-000000000011'},before={version:12,reviews:[],overrides:[],statements:[oldRow]},fresh=persistentMusic(),saved=row(C,text,fresh.parsed,fresh.clarifications);
 const next=D.updateMemberUnderstanding(before,{type:'statement',value:saved,replaceId:null},at);assert.equal(next.version,13);assert.deepEqual(next.statements.find(r=>r.id===oldRow.id),oldRow);assert.deepEqual(D.validateMemberUnderstanding(next),next);
 assert.throws(()=>D.validateMemberUnderstanding({...next,version:12}),e=>e.code==='INVALID_PERSONAL_STATE');assert.throws(()=>C.validateMemberStatement({...saved,parserVersion:Old.PARSER_VERSION}),TypeError);
});
