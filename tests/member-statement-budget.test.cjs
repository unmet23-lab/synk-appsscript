'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');

test('coordinated natural-language alternatives finish within a bounded worker and preserve the unsupported quote',()=>{
 const {spawnSync}=require('node:child_process'),modulePath=require.resolve('../experiences/synk-account/src/member-statement-contract.cjs');
 for(const count of [23,60]){
  const text=Array.from({length:count},(_,i)=>String.fromCharCode(44032+i)+'것도').join(', ')+' 좋아요';assert.ok(text.length<=500);
  const result=spawnSync(process.execPath,['-e',`const C=require(${JSON.stringify(modulePath)});process.stdout.write(JSON.stringify(C.parseMemberStatement(${JSON.stringify(text)})));`],{encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stderr);
  const parsed=JSON.parse(result.stdout);assert.equal(parsed.parserVersion,C.PARSER_VERSION);assert.deepEqual(parsed.meanings,[]);assert.ok(parsed.unresolved.length);assert.equal(parsed.unresolved[0].quote,text);
 }
});

test('the twelfth clause keeps its meaning when only terminal separators remain',()=>{
 const text='음악 좋아요. '.repeat(11)+'요리 좋아요',baseline=C.parseMemberStatement(text);
 assert.deepEqual(baseline.meanings.map(m=>m.value),['music','cooking']);
 for(const suffix of ['.','!',';',',','\n','.  \n','...!']){
  const parsed=C.parseMemberStatement(text+suffix);assert.deepEqual(parsed.meanings,baseline.meanings,JSON.stringify(suffix));assert.deepEqual(parsed.unresolved,[]);assert.equal(parsed.question,null);
 }
 assert.ok(!C.parseMemberStatement(text+'?').meanings.some(m=>m.value==='cooking'),'A question is not a preference assertion');
 const overflow=C.parseMemberStatement(text+'. 자연 좋아요.');assert.ok(overflow.unresolved.some(r=>r.reason==='limit'));assert.ok(!overflow.meanings.some(m=>m.value==='nature'));
});

test('question budget preserves the reason for an already excluded third-person statement',()=>{
 const text='친구는 음악을 좋아해요. '+'저는 취미가 있어요. '.repeat(10),clarifications=[];let parsed=C.parseMemberStatement(text);
 assert.equal(parsed.unresolved.find(r=>r.quote.includes('친구'))?.reason,'other');
 while(parsed.question&&clarifications.length<12){const q=parsed.question,option=['topic','music','prefer','general'].map(id=>q.options.find(o=>o.id===id)).find(Boolean);assert.ok(option);clarifications.push({questionId:q.id,optionId:option.id});parsed=C.parseMemberStatement(text,{clarifications});}
 assert.equal(clarifications.length,12);assert.equal(parsed.unresolved.find(r=>r.quote.includes('친구'))?.reason,'other');
 const starts=[...text.matchAll(/저는 취미가 있어요/g)].map(m=>m.index);
 assert.deepEqual(parsed.unresolved.filter(r=>r.reason==='limit').map(r=>[r.start,r.end]),starts.slice(3).map(start=>[start,start+'저는 취미가 있어요'.length]));
 for(const item of parsed.unresolved)assert.equal(text.slice(item.start,item.end),item.quote);
});
