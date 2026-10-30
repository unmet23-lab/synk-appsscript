'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../experiences/synk-account/src/member-statement-contract.cjs'),Old=require('../experiences/synk-account/src/member-statement-v10.cjs');
test('a separate explicit own declaration does not inherit a preceding sensitive exclusion',()=>{
 for(const separator of ['. ','! ','; ','\n']){
  const text='ADHD 진단을 받았어요'+separator+'저는 음악을 좋아해요.',parsed=C.parseMemberStatement(text);
  assert.deepEqual(parsed.meanings.map(m=>m.value),['music'],JSON.stringify(separator));assert.equal(parsed.question,null);
  assert.equal(parsed.unresolved.length,1);assert.equal(parsed.unresolved[0].reason,'sensitive');
  for(const meaning of parsed.meanings){assert.equal(meaning.evidence.quote,'저는 음악을 좋아해요');assert.equal(text.slice(meaning.evidence.start,meaning.evidence.end),meaning.evidence.quote);}
 }
 const nominal=C.parseMemberStatement('ADHD 진단을 받았어요. 제 취미는 음악이에요.');assert.deepEqual(nominal.meanings.map(m=>m.value),['music']);
});
test('unrecognized reference material cannot release sensitive context before or after a supported head',()=>{
 for(const cause of ['그 덕에','그로 인해','그것으로 인해','따라서','그러니까','그러다 보니','그 이후로','그걸 계기로'])for(const tail of ['저는 '+cause+' 음악을 좋아해요','저는 음악을 '+cause+' 좋아해요']){
  const parsed=C.parseMemberStatement('ADHD 진단을 받았어요. '+tail+'.');assert.deepEqual(parsed.meanings,[],tail);
  const followup=parsed.unresolved.find(row=>row.quote.includes('음악'));assert.ok(followup,tail);assert.equal(followup.reason,'sensitive',tail);
 }
 for(const tail of ['제일 좋아하는 건 음악이에요','내용은 음악이에요','내일은 음악을 좋아할 거예요'])assert.deepEqual(C.parseMemberStatement('ADHD 진단을 받았어요. '+tail+'.').meanings,[],tail);
 const local=C.parseMemberStatement('저는 우울증 진단을 받았어요.');assert.deepEqual(local.meanings,[]);assert.equal(local.unresolved[0].reason,'sensitive');
});
test('sensitive, dependent and ambiguous followups remain excluded, and saved10 replay is unchanged',()=>{
 for(const text of ['ADHD 진단을 받았어요, 저는 음악을 좋아해요.','ADHD 진단을 받았어요. 그래서 저는 음악을 좋아해요.','ADHD 진단을 받았어요. 저는 그것 때문에 음악을 좋아해요.','ADHD 진단을 받았어요. 음악을 좋아해요.','ADHD 진단을 받았어요. "저는 음악을 좋아해요."','ADHD 진단을 받았어요. 저는 우울증 때문에 음악을 좋아해요.','ADHD 진단을 받았어요. 제 동료는 음악을 좋아해요.','ADHD 진단을 받았어요. 저는 어릴 때 음악을 좋아했어요.']){
  const parsed=C.parseMemberStatement(text);assert.deepEqual(parsed.meanings,[],text);assert.ok(parsed.unresolved.some(r=>r.reason==='sensitive'),text);
 }
 const text='ADHD 진단을 받았어요. 저는 음악을 좋아해요.';assert.deepEqual(C.parseMemberStatement(text,{parserVersion:Old.PARSER_VERSION}),Old.parseMemberStatement(text));assert.deepEqual(Old.parseMemberStatement(text).meanings,[]);
});
