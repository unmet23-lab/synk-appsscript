'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const current=require('../experiences/synk-account/src/member-statement-contract.cjs'),frozen=require('../experiences/synk-account/src/member-statement-v12.cjs');
const at='2026-11-01T00:00:00.000Z',id='12345678-1234-4234-8234-123456789012';
function row(text,clarifications=[]){const parsed=frozen.parseMemberStatement(text,{clarifications});assert.equal(parsed.question,null);assert.ok(parsed.meanings.length);return{id,parserVersion:frozen.PARSER_VERSION,text,at,confirmedAt:at,meanings:parsed.meanings,clarifications};}
test('frozen ko12 is the exact source used by deployed Personal73',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v12.cjs'),'utf8').replace(/\r\n/g,'\n')).digest('hex'),'d8c617fab349afe69c05e7c42706a90c2e921d8f63a7592871491744ca663eb2');
 assert.equal(current.PARSER_VERSION,'member-statement-ko-13');assert.equal(frozen.PARSER_VERSION,'member-statement-ko-12');
});
test('a deployed ko12 record keeps its original proposal IDs after ko13 adds a new meaning',()=>{
 const text='도움받기 전에는 혼자 해 보고 싶어요. 요즘 저는 음악을 좋아해요.',old=row(text),fresh=current.parseMemberStatement(text);
 assert.equal(old.meanings.length,1);assert.equal(old.meanings[0].value,'music');assert.equal(old.meanings[0].id,'p0');
 assert.ok(fresh.meanings.some(m=>m.value==='independent'));assert.equal(fresh.meanings.find(m=>m.value==='music').id,'p1');
 assert.deepEqual(current.validateMemberStatement(old),frozen.validateMemberStatement(old));
 assert.deepEqual(current.parseMemberStatement(text,{parserVersion:frozen.PARSER_VERSION}),frozen.parseMemberStatement(text));
 assert.throws(()=>current.validateMemberStatement({...old,meanings:[{...old.meanings[0],id:'p1'}]}),/invalid confirmed statement/);
});
test('deployed ko12 question IDs and answers replay through the frozen parser',()=>{
 const text='이번에만 음악을 틀어 주세요',answers=[];let parsed=frozen.parseMemberStatement(text);
 for(const optionId of ['confirm','topic','music','prefer','general']){assert.ok(parsed.question.options.some(o=>o.id===optionId));answers.push({questionId:parsed.question.id,optionId});parsed=frozen.parseMemberStatement(text,{clarifications:answers});}
 const old=row(text,answers);
 assert.deepEqual(current.parseMemberStatement(text,{parserVersion:frozen.PARSER_VERSION,clarifications:answers}),frozen.parseMemberStatement(text,{clarifications:answers}));
 assert.deepEqual(current.validateMemberStatement(old),frozen.validateMemberStatement(old));
});
test('document13 retains old ko12 rows and upgrades to14 only when a new ko13 statement is added',async()=>{
 const D=await import('../experiences/synk-account/src/member-understanding-data.mjs'),S=require('../experiences/synk-account/src/member-statement.cjs'),old=row('도움받기 전에는 혼자 해 보고 싶어요. 요즘 저는 음악을 좋아해요.'),before={version:13,reviews:[],overrides:[],statements:[old]};
 assert.deepEqual(D.validateMemberUnderstanding(before),before);assert.deepEqual(D.updateMemberUnderstanding(before,{type:'clear'}),{version:13,reviews:[],overrides:[],statements:[]});
 const preview=S.previewMemberStatement({text:'저는 짧은 설명을 좋아해요.',asOf:at}),fresh=S.confirmMemberStatement({preview,id:'22345678-1234-4234-8234-123456789012',acceptedIds:preview.proposals.map(m=>m.id),at}),after=D.updateMemberUnderstanding(before,{type:'statement',value:fresh,replaceId:null},at);
 assert.equal(after.version,14);assert.equal(fresh.parserVersion,'member-statement-ko-13');assert.deepEqual(after.statements.find(r=>r.id===old.id),old);assert.deepEqual(D.validateMemberUnderstanding(after),after);
 assert.throws(()=>D.validateMemberUnderstanding({...after,version:13}));assert.throws(()=>D.validateMemberUnderstanding({...after,version:15}));
 assert.equal(require('../atlas/member-understanding').summarizeMemberUnderstanding({document:after,asOf:at}).statementHistory.length,2);
});
