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

test('sensitive boundary shares existing stance, contraction, degree and coordination grammar',()=>{
 for(const own of ['저는 음악을 즐겨요','저는 음악을 좋아합니다','전 음악을 좋아해요','난 음악을 좋아해요','저는 음악을 정말 좋아해요','저는 음악을 선호합니다','저는 음악을 좋아하지 않아요','저는 음악과 요리를 좋아해요','저는 혼자 하는 게 좋아요','저는 짧은 설명을 좋아합니다']){
  const standalone=C.parseMemberStatement(own+'.'),context=C.parseMemberStatement('ADHD 진단을 받았어요. '+own+'.');assert.ok(standalone.meanings.length,own+' must be supported on its own');
  const semantic=parsed=>parsed.meanings.map(({field,value,polarity,condition})=>({field,value,polarity,condition}));assert.deepEqual(semantic(context),semantic(standalone),own);assert.equal(context.question,standalone.question);
 }
});
test('supported independent declarations retain their meaning across owner, field, degree and stance forms',()=>{
 let checked=0;const semantic=parsed=>parsed.meanings.map(({field,value,polarity,condition})=>({field,value,polarity,condition}));
 for(const owner of ['저는','전','난'])for(const subject of ['음악을','요리를','사진 촬영을','게임을','짧은 설명을','혼자 하는 걸'])for(const degree of ['','정말','아주'])for(const ending of ['좋아해요','즐겨요','좋아합니다','선호합니다','좋아하지 않아요','싫어요','마음에 들어요','관심이 있어요','원합니다']){
  const own=[owner,subject,degree,ending].filter(Boolean).join(' '),standalone=C.parseMemberStatement(own+'.');if(!standalone.meanings.length||standalone.question)continue;
  checked++;assert.deepEqual(semantic(C.parseMemberStatement('ADHD 진단을 받았어요. '+own+'.')),semantic(standalone),own);
 }assert.ok(checked>=150,'The supported comparison corpus must remain substantive');
});

test('independent known conditions and complete preference clauses retain their own scopes',()=>{
 for(const own of ['저는 처음 배울 때 예시를 먼저 보는 게 좋아요','저는 익숙할 때 혼자 하는 게 좋아요','저는 바쁠 때 짧은 설명을 좋아해요','저는 바쁠 때는 음악을 좋아해요','제 경우에는 음악을 좋아합니다','저는 음악을 좋아해요, 저는 요리를 좋아해요','저는 음악을 좋아해요, 요리를 좋아해요','저는 음악을 좋아하고 저는 요리를 좋아해요','저는 음악을 좋아해요 그리고 저는 요리를 좋아해요','저는 음악을 좋아하지만 요리를 싫어요']){
  const semantic=p=>p.meanings.map(({field,value,polarity,condition})=>({field,value,polarity,condition})),before=C.parseMemberStatement(own+'.'),after=C.parseMemberStatement('ADHD 진단을 받았어요. '+own+'.');assert.ok(before.meanings.length,own);assert.deepEqual(semantic(after),semantic(before),own);
 }
 assert.deepEqual(C.parseMemberStatement('친구는 운동을 좋아해요. 제 경우에는 음악을 좋아합니다.').meanings.map(m=>m.value),['music']);
});

test('unrecognized reference material cannot release sensitive context before or after a supported head',()=>{
 for(const cause of ['그 덕에','그로 인해','그것으로 인해','따라서','그러니까','그러다 보니','그 이후로','그걸 계기로'])for(const tail of ['저는 '+cause+' 음악을 좋아해요','저는 음악을 '+cause+' 좋아해요']){
  const parsed=C.parseMemberStatement('ADHD 진단을 받았어요. '+tail+'.');assert.deepEqual(parsed.meanings,[],tail);
  const followup=parsed.unresolved.find(row=>row.quote.includes('음악'));assert.ok(followup,tail);assert.equal(followup.reason,'sensitive',tail);
 }
 for(const tail of ['제일 좋아하는 건 음악이에요','내용은 음악이에요','내일은 음악을 좋아할 거예요'])assert.deepEqual(C.parseMemberStatement('ADHD 진단을 받았어요. '+tail+'.').meanings,[],tail);
 const local=C.parseMemberStatement('저는 우울증 진단을 받았어요.');assert.deepEqual(local.meanings,[]);assert.equal(local.unresolved[0].reason,'sensitive');
 for(const text of ['저는 그때그때 음악을 좋아해요','저는 음악을 그때그때 좋아해요']){const parsed=C.parseMemberStatement('ADHD 진단을 받았어요. '+text+'.');assert.deepEqual(parsed.meanings,[],text);assert.equal(parsed.unresolved.find(row=>row.quote.includes('음악')).reason,'sensitive');}
});
test('sensitive, dependent and ambiguous followups remain excluded, and saved10 replay is unchanged',()=>{
 for(const text of ['ADHD 진단을 받았어요, 저는 음악을 좋아해요.','ADHD 진단을 받았어요. 그래서 저는 음악을 좋아해요.','ADHD 진단을 받았어요. 저는 그것 때문에 음악을 좋아해요.','ADHD 진단을 받았어요. 음악을 좋아해요.','ADHD 진단을 받았어요. "저는 음악을 좋아해요."','ADHD 진단을 받았어요. 저는 우울증 때문에 음악을 좋아해요.','ADHD 진단을 받았어요. 제 동료는 음악을 좋아해요.','ADHD 진단을 받았어요. 저는 어릴 때 음악을 좋아했어요.','ADHD 진단을 받았어요. 저는 음악을 좋아해요, 그 덕분에요.','ADHD 진단을 받았어요. 저는 음악을 즐겨요, 그 이후로요.']){
  const parsed=C.parseMemberStatement(text);assert.deepEqual(parsed.meanings,[],text);assert.ok(parsed.unresolved.some(r=>r.reason==='sensitive'),text);
 }
 const text='ADHD 진단을 받았어요. 저는 음악을 좋아해요.';assert.deepEqual(C.parseMemberStatement(text,{parserVersion:Old.PARSER_VERSION}),Old.parseMemberStatement(text));assert.deepEqual(Old.parseMemberStatement(text).meanings,[]);
});
