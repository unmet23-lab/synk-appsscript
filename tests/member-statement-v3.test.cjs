'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), { createHash } = require('node:crypto');
const C = require('../experiences/synk-account/src/member-statement-contract.cjs');
const V2 = require('../experiences/synk-account/src/member-statement-v2.cjs');
const A = require('../experiences/synk-account/src/member-statement.cjs');
const at = '2026-10-15T00:00:00.000Z', later = '2026-10-15T00:01:00.000Z';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const preview = (text, clarifications = []) => A.previewMemberStatement({ text, asOf: at, clarifications });
const tuples = p => (p.proposals || p.meanings).map(m => [m.field, m.value, m.polarity, m.condition]);
const save = (p, n = 1, when = at) => A.confirmMemberStatement({ preview:p, acceptedIds:p.proposals.map(m=>m.id), id:uuid(n), at:when });
const summary = rows => A.summarizeStatementRelations({document:{version:4, statements:rows}, facets:[], asOf:later});

test('frozen ko-2 bytes, exact parsing, questions, confirmations and answer labels survive ko-3', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v2.cjs'), 'utf8').replace(/\r\n/g, '\n')).digest('hex'), '7e26a5dd658f02951ea7ff3fe302e8992f1d547f07e76fda30e693a3cb37c220');
  const source = '새 일에서는 설명이 있어야 마음이 놓여요', clarifications=[];
  let parsed=V2.parseMemberStatement(source);
  for(const optionId of ['support','example','prefer','first-try']){
    assert.deepEqual(C.parseMemberStatement(source,{parserVersion:V2.PARSER_VERSION,clarifications}),parsed);
    clarifications.push({questionId:parsed.question.id,optionId});parsed=V2.parseMemberStatement(source,{clarifications});
  }
  const row={id:uuid(1),parserVersion:V2.PARSER_VERSION,text:source,at,confirmedAt:at,meanings:parsed.meanings,clarifications};
  assert.deepEqual(C.validateMemberStatement(row),V2.validateMemberStatement(row));
  assert.deepEqual(A.resolveMemberStatements([row],later).entries.map(e=>e.active),[true]);
  assert.deepEqual(summary([row]).statementHistory[0].clarificationAnswers,parsed.clarificationAnswers);
  for(const text of ['혼자 하는 게 좋아요?', '처음 배우는 일은 예시를 본 다음 혼자 해보고 싶어요', '나는 자세한 설명이 좋을 수도 있어요', '회의에서는 다른 사람의 생각을 듣고 정리하는 편이에요'])
    assert.deepEqual(C.parseMemberStatement(text,{parserVersion:V2.PARSER_VERSION}),V2.parseMemberStatement(text));
  // A still-identical meaning is allowed in a new ko-3 row. Old persisted rows
  // retain ko-2 and its exact replay; storage guards enforce document upgrades.
  assert.equal(C.validateMemberStatement({...row,parserVersion:C.PARSER_VERSION}).parserVersion,C.PARSER_VERSION);
});

test('comparison proposes only the explicit preferred arm, keeping the meeting context and entire source', () => {
  const text='회의에서 의견을 먼저 내기보다 다른 사람 생각을 듣고 정리하는 편이에요.';
  const p=preview(text);assert.equal(p.question,null);
  assert.deepEqual(tuples(p),[['communication','listen-organize','prefer','meeting']]);
  const m=p.proposals[0];assert.equal(text.slice(m.evidence.start,m.evidence.end),m.evidence.quote);
  assert.equal(m.evidence.quote,text.slice(0,-1));assert.equal(Object.hasOwn(m,'selected'),false);
  assert.deepEqual(C.validateMemberStatement(save(p)),save(p));
  assert.match(summary([save(p)]).paragraphs.join(' '),/회의할 때.*다른 사람의 생각을 듣고 정리하기/);
});

test('long explanation burden and detail of reasons have separate polarity and source clauses', () => {
  const text='설명이 너무 길면 집중이 흐트러지지만 핵심 근거는 자세히 알고 싶어요.';
  const p=preview(text);assert.equal(p.question,null);
  assert.deepEqual(tuples(p),[['explanation-detail','long-flow','avoid',null],['explanation-detail','reasons-detail','prefer',null]]);
  assert.equal(p.proposals[0].evidence.quote,'설명이 너무 길면 집중이 흐트러지지만');
  assert.equal(p.proposals[1].evidence.quote,'핵심 근거는 자세히 알고 싶어요');
  const report=summary([save(p)]);assert.equal(report.active.length,2);
  assert.equal(report.relations.length,0);assert.doesNotMatch(report.paragraphs.join(' '),/실력|원인|성격유형|집중력.*낮/);
});

test('overview-before-reasons is a shared explicit desire, not a conflicting explanation length', () => {
  for(const text of ['짧은 개요를 먼저 보고 핵심 근거는 자세히 알고 싶어요.', '전체 흐름을 먼저 본 뒤 이유는 상세히 알고 싶어요']){
    const p=preview(text);assert.equal(p.question,null,text);
    assert.deepEqual(tuples(p),[['explanation-detail','overview-first','prefer',null],['explanation-detail','reasons-detail','prefer',null]],text);
    assert.equal(A.resolveMemberStatements([save(p)],later).entries.filter(e=>e.active).length,2);
  }
  assert.equal(preview('개요를 먼저 보고 근거는 자세히 알고 싶지 않아요').proposals.length,0);
});

test('coexisting communication methods are both active, and negation changes only its exact value', () => {
  const initial=save(preview('글로 소통하는 게 좋아요. 말로 대화하는 것도 좋아요.'));
  const revised=save(preview('글로 소통하는 건 선호하지 않아요.'),2,later);
  const result=A.resolveMemberStatements([initial,revised],later), active=result.entries.filter(e=>e.active);
  assert.deepEqual(active.map(e=>[e.meaning.value,e.meaning.polarity]).sort(),[['spoken','prefer'],['written','avoid']]);
  assert.equal(result.entries.find(e=>e.row.id===initial.id&&e.meaning.value==='written').active,false);
  assert.equal(summary([initial,revised]).statementHistory.length,2);
});

test('a same-value opposing claim still requires Ask and final explicit confirmation', () => {
  let p=preview('계획을 먼저 세우는 게 좋아요. 계획을 먼저 세우는 건 싫어요.');
  assert.equal(p.proposals.length,2);assert.ok(p.question);assert.throws(()=>save(p));
  p=preview(p.text,[{questionId:p.question.id,optionId:'p1'}]);assert.equal(p.proposals.length,1);
  assert.equal(p.proposals[0].polarity,'avoid');assert.throws(()=>A.confirmMemberStatement({preview:p,acceptedIds:[],id:uuid(1),at}));
  assert.equal(save(p).meanings[0].polarity,'avoid');
});

test('new condition options are literal, source-bound Ask answers that need all four stages', () => {
  let p=preview('내 방식은 설명하기 어려워요');
  for(const optionId of ['communication','listen-organize','prefer']){
    assert.equal(p.proposals.length,0);p=preview(p.text,[...p.clarifications,{questionId:p.question.id,optionId}]);
  }
  assert.ok(p.question.options.some(o=>o.id==='meeting'));
  p=preview(p.text,[...p.clarifications,{questionId:p.question.id,optionId:'meeting'}]);
  assert.deepEqual(tuples(p),[['communication','listen-organize','prefer','meeting']]);
  const row=save(p);assert.equal(row.clarifications.length,4);
  assert.deepEqual(summary([row]).statementHistory[0].clarificationAnswers,p.clarificationAnswers);
  const forged=structuredClone(row);forged.meanings[0].condition='teamwork';assert.throws(()=>C.validateMemberStatement(forged));
});

test('daily interests are independent declarations and are not skill, medical, or political labels', () => {
  const sources=[['독서를 좋아해요','reading-books'],['음악 감상에 관심이 있어요','music'],['러닝을 좋아해요','exercise'],
    ['요리하는 것이 좋아요','cooking'],['사진 찍기를 선호해요','photography'],['보드게임을 좋아해요','games'],['공원 산책이 좋아요','nature']];
  for(const [text,value] of sources){const p=preview(text);assert.equal(p.question,null,text);assert.deepEqual(tuples(p),[['topic',value,'prefer',null]],text);}
  for(const text of ['나는 우울증이 있어서 혼자 하는 게 좋아요','내 정치성향은 보수예요','내 MBTI는 INTJ예요','종교 때문에 계획을 먼저 세워요']){
    const p=preview(text);assert.equal(p.proposals.length,0,text);assert.equal(p.question,null,text);assert.ok(p.unresolved.length);
  }
});

test('other people, quotations, old and hypothetical situations never become a current personal method', () => {
  for(const text of ['동료가 의견을 먼저 말하는 편이에요. 그리고 글로 소통하는 게 좋아요', '예전에는 계획을 먼저 세우는 편이었어요. 여러 선택지를 비교하는 게 좋아요',
    '만약 내가 팀장이 된다면 다른 사람의 생각을 듣고 정리하고 싶어요', '“글로 소통하는 게 좋아요.”라는 예문을 읽었어요']){
    const p=preview(text);assert.equal(p.proposals.length,0,text);assert.equal(p.question,null,text);
  }
  const p=preview('친구는 글로 소통하는 게 좋아요. 저는 말로 대화하는 게 편해요');
  assert.deepEqual(tuples(p),[['communication','spoken','prefer',null]]);
});

test('unsupported scope, double negatives, uncertainty and listening alone do not invent the broader organizing habit', () => {
  for(const text of ['휴가일 때만 글로 소통하는 게 좋아요', '나는 다른 사람 말을 듣는 게 좋아요', '계획을 세우는 게 싫지는 않아요',
    '계획을 먼저 세우는 편일 수도 있어요', '글로 소통하는 게 좋아요 ?', '회의에서는 계획을 먼저 세우는 게 좋아요?']) {
    const p=preview(text);assert.equal(p.proposals.length,0,text);assert.ok(p.question,text);
    const skipped=preview(p.text,[{questionId:p.question.id,optionId:'skip'}]);assert.equal(skipped.proposals.length,0,text);
  }
});

test('nominalization and stance inflections compose across action groups without widening their meaning', () => {
  const groups=[['계획을 먼저 세우','work-style','plan-first'],['글로 정리하','communication','written'],['여러 선택지를 비교하','decision','compare-options'],['책을 읽','topic','reading-books']];
  for(const [action,field,value] of groups)for(const [ending,polarity] of [['는 게 좋아요','prefer'],['는 걸 좋아합니다','prefer'],['는 것이 편해요','prefer'],['는 건 선호하지 않아요','avoid'],['기 싫어요','avoid']]){
    const text=action+ending,p=preview(text);assert.equal(p.question,null,text);assert.deepEqual(tuples(p),[[field,value,polarity,null]],text);
    assert.equal(p.proposals[0].evidence.quote,text);assert.deepEqual(C.validateMemberStatement(save(p)),save(p));
  }
});

test('preparatory auxiliaries and explicit method habits retain their action while activities alone do not imply interests', () => {
  for(const text of ['계획을 미리 세워 두는 게 편해요','계획을 미리 세워 놓는 걸 좋아합니다','계획부터 미리 세워요','계획을 먼저 세웁니다']){
    const p=preview(text);assert.equal(p.question,null,text);assert.deepEqual(tuples(p),[['work-style','plan-first','prefer',null]],text);
  }
  for(const text of ['책을 읽어요','음악을 들어요','게임을 해요'])assert.equal(preview(text).proposals.length,0,text);
  for(const text of ['계획을 먼저 세우지 않아요','계획을 먼저 세울 수도 있어요','계획을 먼저 세웠어요','계획을 먼저 세워야 한다고 친구가 말했어요'])assert.equal(preview(text).proposals.length,0,text);
});

test('degree, nominal direction and synonymous adverbs preserve negation and excluded provenance', () => {
  for(const action of ['글로 소통하는 걸','계획부터 세우는 쪽이','이유를 자세하게 아는 것이']){
    const positive=preview(action+' 더 좋아해요');assert.equal(positive.proposals.length,1,action);assert.equal(positive.proposals[0].polarity,'prefer');
    const negative=preview(action+' 더 싫어요');assert.equal(negative.proposals.length,1,action);assert.equal(negative.proposals[0].polarity,'avoid');
    for(const text of [action+' 더 싫지는 않아요','친구는 '+action+' 더 좋아해요','예전에는 '+action+' 더 좋아했어요','만약 가능하다면 '+action+' 더 좋아요'])
      assert.equal(preview(text).proposals.length,0,text);
  }
  for(const text of ['게임을 해줘','음악 해줘','사진 촬영 해줘'])assert.equal(preview(text).proposals.length,0,text);
});
