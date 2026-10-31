'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{historicalParsers}=require('./_member-parser-source-history.cjs');
const rows=[...['evaluation','followup-evaluation','generalization-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v3-${n}.json`).cases),...['diagnostic-evaluation','disclosed-evaluation','final-disclosed-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v4-${n}.json`).cases),...['development-evaluation','disclosed-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v5-${n}.json`).cases)];
for(const version of [4,5,6,7,8,9,10,11])test(`ko-${version} runtime repair preserves all444 historical parses, skip answers and accepted rows`,()=>{
 assert.equal(rows.length,444);const original=historicalParsers().load(version),current=require('../experiences/synk-account/src/member-statement-v'+version+'.cjs');
 for(const [index,row]of rows.entries()){
  const clarifications=[];let expected=original.parseMemberStatement(row.text);assert.deepEqual(current.parseMemberStatement(row.text),expected,row.id);
  for(let count=0;expected.question&&count<12;count++){clarifications.push({questionId:expected.question.id,optionId:'skip'});expected=original.parseMemberStatement(row.text,{clarifications});assert.deepEqual(current.parseMemberStatement(row.text,{clarifications}),expected,row.id);}
  if(expected.meanings.length&&!expected.question){const saved={id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,parserVersion:current.PARSER_VERSION,text:row.text,at:'2026-10-16T02:00:00.000Z',confirmedAt:'2026-10-16T02:00:00.000Z',meanings:expected.meanings,clarifications};assert.deepEqual(current.validateMemberStatement(saved),original.validateMemberStatement(saved),row.id);}
 }
});

for(const version of [4,5,6,7,8,9,10,11])test(`ko-${version} cached nonempty alternatives and 2..8-term replay match the original`,()=>{
 const original=historicalParsers().load(version),current=require('../experiences/synk-account/src/member-statement-v'+version+'.cjs');
 const positive='저는 예시를 보는 것도, 예시를 보는 것도 좋아요.';
 const cases=Array.from({length:7},(_,i)=>'저는 '+Array(i+2).fill('예시를 보는 것도').join(', ')+' 좋아요');
 cases.push(...Array.from({length:6},(_,i)=>positive+' 짧은 설명이 좋아요.'.repeat(i+1)),'처음에는 예시를 보는 것도, 예시를 보는 것도 좋아요. 평소에는 혼자 하는 게 좋아요.');
 let validated=0;for(const [index,text]of cases.entries()){
  let expected=original.parseMemberStatement(text),clarifications=[];assert.deepEqual(current.parseMemberStatement(text),expected,text);
  while(expected.question&&clarifications.length<12){clarifications.push({questionId:expected.question.id,optionId:'skip'});expected=original.parseMemberStatement(text,{clarifications});assert.deepEqual(current.parseMemberStatement(text,{clarifications}),expected,text);}
  if(expected.meanings.length&&!expected.question){const saved={id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,parserVersion:current.PARSER_VERSION,text,at:'2026-10-16T02:00:00.000Z',confirmedAt:'2026-10-16T02:00:00.000Z',meanings:expected.meanings,clarifications};assert.deepEqual(current.validateMemberStatement(saved),original.validateMemberStatement(saved),text);validated++;}
 }
 assert.ok(validated>=7,'nonempty cache-hit paths and their stored rows were actually compared');
});
