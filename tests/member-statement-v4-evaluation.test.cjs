'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {evaluateCorpus}=require('../tools/member-statement-evaluate.cjs');
const {parseMemberStatement}=require('../experiences/synk-account/src/member-statement-contract.cjs');
const fixturePath=path.join(__dirname,'fixtures/member-statement-v4-diagnostic-evaluation.json');
const bytes=fs.readFileSync(fixturePath);
const corpus=JSON.parse(bytes);

test('ko4 diagnostic corpus keeps the 80 pre-labelled sentences fixed',()=>{
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'89b715f38bf7afd84156f72c2d7bc3bb74f9f5f5e465dcd085b946957cfbb763');
  assert.equal(corpus.cases.length,80);
  assert.equal(corpus.cases.filter(row=>row.mode==='direct').length,60);
});

for(const row of corpus.cases)test('ko4 independent diagnostic regression '+row.id+' '+row.category,()=>{
  const result=evaluateCorpus({corpus:{cases:[row]},parse:parseMemberStatement});
  const actual=result.cases[0];
  assert.equal(actual.parseError,null);
  assert.equal(actual.semanticExact,true,JSON.stringify({expected:actual.expected,actual:actual.actual}));
  assert.equal(actual.questionCorrect,true,'Unnecessary or missing clarification question');
  assert.equal(actual.evidenceErrors,0,'Meaning must retain an exact original quote and offset');
  assert.equal(actual.safeQuestionOptions,true);
  assert.equal(actual.skipSafe,true,'Skipping an unclear part must retain already confirmed meanings');
});

// This set was disclosed only after the first frozen-candidate evaluation.
// Once used for repairs it is regression evidence, not a fresh holdout score.
const disclosedBytes=fs.readFileSync(path.join(__dirname,'fixtures/member-statement-v4-disclosed-evaluation.json'));
const disclosed=JSON.parse(disclosedBytes);
// Keep raw40 and its historic score intact. These two disclosed synthetic
// sentences use explicit, bounded semantic adjudication rather than skips.
const adjudication=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/member-statement-v4-label-adjudications.json')));
function disclosedResults(row,parse=parseMemberStatement){
  const decision=adjudication.cases.find(item=>item.id===row.id);
  return (decision?.readings||[row]).map(reading=>evaluateCorpus({corpus:{cases:[{...row,mode:reading.mode,expect:reading.expect}]},parse}).cases[0]);
}
test('ko4 disclosed corpus retains the original labels including the uncertain H30',()=>{
  assert.equal(crypto.createHash('sha256').update(disclosedBytes).digest('hex'),'98051afef660401b2107d404b37eb7e4924993662a46c7901abfd87813efcd12');
  assert.equal(disclosed.cases.length,40);
  assert.equal(adjudication.source,'member-statement-v4-disclosed-evaluation.json');
  assert.equal(adjudication.sourceSha256,crypto.createHash('sha256').update(disclosedBytes).digest('hex'));
  assert.equal(adjudication.originalLabelsUnchanged,true);
  assert.deepEqual(adjudication.cases.map(row=>row.id),['H04','H30']);
  assert.deepEqual(adjudication.cases[0].readings,[{mode:'clarify',expect:[]}]);
  assert.deepEqual(adjudication.cases[1].readings,[
    {mode:'direct',expect:[['communication','written','prefer','teamwork'],['explanation','brief','prefer','teamwork']]},
    {mode:'direct',expect:[['communication','written','prefer','teamwork'],['explanation','brief','prefer',null]]}
  ]);
});
for(const row of disclosed.cases)test('ko4 disclosed regression '+row.id+' '+row.category,()=>{
  const results=disclosedResults(row);
  const actual=results.find(result=>result.pass)||results[0];
  assert.equal(actual.parseError,null);
  assert.equal(actual.semanticExact,true,JSON.stringify({expected:actual.expected,actual:actual.actual}));
  assert.equal(actual.questionCorrect,true,'Unnecessary or missing clarification question');
  assert.equal(actual.evidenceErrors,0);
  assert.equal(actual.safeQuestionOptions,true);
  assert.equal(actual.skipSafe,true);
});

test('disclosed label adjudication rejects overgeneralisation and changed semantic roles',()=>{
  const h04=disclosed.cases.find(row=>row.id==='H04'),h30=disclosed.cases.find(row=>row.id==='H30');
  const parsed=parseMemberStatement(h30.text);
  const wrongExclusive={...parsed,question:null,meanings:[{...parsed.meanings[0],field:'communication',value:'written',polarity:'avoid',condition:null,evidence:{start:0,end:h04.text.length,quote:h04.text}}]};
  assert.ok(disclosedResults(h04,()=>wrongExclusive).every(result=>!result.pass));
  for(const mutate of [p=>p.meanings[0].condition=null,p=>p.meanings[0].polarity='avoid',p=>p.meanings[1].condition='planning',p=>p.meanings.pop(),p=>p.meanings.push(structuredClone(p.meanings[0])),p=>p.meanings[0].evidence.quote='invented']){
    const bad=structuredClone(parsed);mutate(bad);
    assert.ok(disclosedResults(h30,()=>bad).every(result=>!result.pass));
  }
});

test('exclusive written-only dislike asks rather than asserting a general dislike of writing',()=>{
  const parsed=parseMemberStatement('글로만 의견을 주고받는 건 선호하지 않아요.');
  assert.equal(parsed.meanings.some(m=>m.field==='communication'&&m.value==='written'&&m.polarity==='avoid'),false);
  assert.ok(parsed.question,'The unsupported exclusivity qualifier needs clarification');
});

// The final24 first-run score is preserved in the evidence folder. Root then
// disclosed its concrete misses for repair; it is now regression, not holdout.
const finalDisclosedBytes=fs.readFileSync(path.join(__dirname,'fixtures/member-statement-v4-final-disclosed-evaluation.json'));
const finalDisclosed=JSON.parse(finalDisclosedBytes);
test('ko4 final disclosed corpus keeps its 24 pre-labelled sentences unchanged',()=>{
  assert.equal(crypto.createHash('sha256').update(finalDisclosedBytes).digest('hex'),'3e796cb3a86b021b951dc3cd4e12b177d190caa9432003f0ae873d7905ca4ae7');
  assert.equal(finalDisclosed.cases.length,24);
  assert.equal(finalDisclosed.cases.filter(row=>row.mode==='direct').length,18);
});
for(const row of finalDisclosed.cases)test('ko4 final disclosed regression '+row.id+' '+row.category,()=>{
  const actual=evaluateCorpus({corpus:{cases:[row]},parse:parseMemberStatement}).cases[0];
  assert.equal(actual.parseError,null);
  assert.equal(actual.semanticExact,true,JSON.stringify({expected:actual.expected,actual:actual.actual}));
  assert.equal(actual.questionCorrect,true,'Unnecessary or missing clarification question');
  assert.equal(actual.evidenceErrors,0);
  assert.equal(actual.safeQuestionOptions,true);
  assert.equal(actual.skipSafe,true);
});
