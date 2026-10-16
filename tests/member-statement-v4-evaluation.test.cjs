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
test('ko4 disclosed corpus retains the original labels including the uncertain H30',()=>{
  assert.equal(crypto.createHash('sha256').update(disclosedBytes).digest('hex'),'98051afef660401b2107d404b37eb7e4924993662a46c7901abfd87813efcd12');
  assert.equal(disclosed.cases.length,40);
});
for(const row of disclosed.cases)test('ko4 disclosed regression '+row.id+' '+row.category,{
  skip:row.id==='H30'?'Original gold condition scope is ambiguous; retain raw40 and excluded38 sensitivity separately.':row.id==='H04'?'Original label overstates rejection of written-only communication as rejection of all writing; preserve raw label and separate adjudication.':false
},()=>{
  const actual=evaluateCorpus({corpus:{cases:[row]},parse:parseMemberStatement}).cases[0];
  assert.equal(actual.parseError,null);
  assert.equal(actual.semanticExact,true,JSON.stringify({expected:actual.expected,actual:actual.actual}));
  assert.equal(actual.questionCorrect,true,'Unnecessary or missing clarification question');
  assert.equal(actual.evidenceErrors,0);
  assert.equal(actual.safeQuestionOptions,true);
  assert.equal(actual.skipSafe,true);
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
