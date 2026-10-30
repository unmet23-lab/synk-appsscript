'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const Old=require('../experiences/synk-account/src/member-statement-v10.cjs');
const text='음악 좋아요. '.repeat(11)+'저는 취미가 있어요.';
const at='2026-10-29T00:00:00.000Z';
const row=(parser,id,input=text)=>({id:`00000000-0000-4000-8000-${String(id).padStart(12,'0')}`,parserVersion:parser.PARSER_VERSION,text:input,at,confirmedAt:at,meanings:parser.parseMemberStatement(input).meanings,clarifications:[]});

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
