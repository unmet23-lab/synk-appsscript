'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { createHash } = require('node:crypto'), fs = require('node:fs');
const C = require('../experiences/synk-account/src/member-statement-contract.cjs');
const Legacy = require('../experiences/synk-account/src/member-statement-v1.cjs');
const A = require('../experiences/synk-account/src/member-statement.cjs');
const at = '2026-10-15T00:00:00.000Z', later = '2026-10-15T00:01:00.000Z', id = '00000000-0000-4000-8000-000000000001';
const preview = (text, clarifications = []) => A.previewMemberStatement({ text, at, asOf: later, clarifications });
const answer = (p, optionId) => preview(p.text, [...p.clarifications, { questionId: p.question.id, optionId }]);
const save = p => A.confirmMemberStatement({ preview: p, acceptedIds: p.proposals.map(p => p.id), id, at: later, text: p.text, clarifications: p.clarifications });
const pairs = p => p.proposals.map(m => [m.field, m.value, m.polarity, m.condition]);

test('question punctuation with spaces or mixed delimiters cannot confirm a preference or revive excluded origins', () => {
  for (const text of ['혼자 하는 게 좋아요?', '혼자 하는 게 좋아요 ?', '혼자 하는 게 좋아요!?', '혼자 하는 게 좋아요 ?!']) {
    const p = preview(text);assert.equal(p.proposals.length, 0, text);assert.ok(p.question, text);
    assert.throws(() => save(p));
  }
  for (const text of ['친구가 혼자 하는 게 좋아요?', '친구가 혼자 하는 게 좋아요 !?', '예전에는 혼자 하는 게 좋았어요?', '만약 혼자 하는 게 좋다면?']) {
    const p = preview(text);assert.equal(p.proposals.length, 0, text);assert.equal(p.question, null, text);
  }
});

test('ko-1 product vocabulary remains byte-identical and old rows retain their original shape and interpretation', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v1.cjs'))).digest('hex'), '80af2773ef8f5870c8342dc8c6658d81dd0519fadbff5b80f3ad95295b9ea823');
  for (const text of ['혼자 하는 게 좋지만 처음에는 예시가 필요해', '혼자 하는 게 싫어', '영상 제작에 관심이 있어']) {
    const row = { id, parserVersion: Legacy.PARSER_VERSION, text, at, confirmedAt: at, meanings: Legacy.parseMemberStatement(text).meanings };
    assert.deepEqual(C.validateMemberStatement(row), Legacy.validateMemberStatement(row));assert.equal('clarifications' in C.validateMemberStatement(row), false);
    assert.deepEqual(C.parseMemberStatement(text, { parserVersion: Legacy.PARSER_VERSION }), Legacy.parseMemberStatement(text));
    assert.equal(A.resolveMemberStatements([row], later).entries.every(e => e.verified), true);
    assert.throws(() => C.validateMemberStatement({ ...row, clarifications: [] }));
  }
  assert.equal(Legacy.parseMemberStatement('처음 배우는 일은 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요.').meanings.length, 0);
});

test('explicit example-before-independent sequence keeps first-try scope on both stages and never becomes a general preference', () => {
  for (const text of ['처음 배우는 일은 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요.', '처음 하는 일은 예제를 먼저 본 뒤 혼자 해보고 싶어요', '처음 배울 때에는 샘플을 보고 나서 스스로 해보고 싶어요']) {
    const p = preview(text);assert.equal(p.question, null, text);
    assert.deepEqual(pairs(p), [['support','example','prefer','first-try'],['support','independent','prefer','first-try-after-example']], text);
    assert.equal(p.proposals.every(m => text.slice(m.evidence.start,m.evidence.end) === m.evidence.quote), true);
    assert.equal(p.proposals.every(m => !Object.hasOwn(m,'selected')), true);
    const row = save(p);assert.deepEqual(C.validateMemberStatement(row), row);
    assert.equal(A.resolveMemberStatements([row], later).entries.every(e => e.active), true);
  }
});

test('explicit familiar, busy and unqualified sequences preserve their own scopes', () => {
  for (const [prefix, first, after] of [['익숙한 일은 ','familiar','familiar-after-example'],['바쁜 날에는 ','busy','busy-after-example'],['',null,'after-example']]) {
    assert.deepEqual(pairs(preview(prefix+'예시를 본 다음 혼자 해보고 싶어요')).map(p=>[p[1],p[3]]), [['example',first],['independent',after]]);
  }
  for (const text of ['처음 배우는 일은 혼자 해보고 나서 예시를 보고 싶어요', '처음 배우는 일은 예시를 본 다음 혼자 하고 싶지 않아요', '예시를 본 다음 다른 사람이 혼자 해보고 싶어요']) {
    assert.equal(preview(text).proposals.length, 0, text);
  }
});

test('whole supported natural phrases and synonyms preserve polarity and original quotation', () => {
  const cases = [
    ['스스로 시도하는 편이 편해요','independent','prefer'],['혼자서 진행하는 편이 편합니다','independent','prefer'],
    ['다른 사람과 함께 하는 게 편해요','together','prefer'],['예제부터 보는 게 좋아요','example','prefer'],
    ['간결한 설명을 선호해요','brief','prefer'],['짧고 핵심만 설명해 주는 게 좋아요','brief','prefer'],
    ['상세히 알려주는 게 좋아요','detailed','prefer'],['읽고 배우는 것이 좋아요','reading','prefer'],
    ['영상 만드는 것에 관심이 있어요','content-video','prefer'],['스스로 해보는 게 싫어요','independent','avoid'],
    ['예시가 필요하지 않아요','example','avoid']
  ];
  for (const [text,value,polarity] of cases) { const p=preview(text);assert.equal(p.proposals.length,1,text);assert.equal(p.proposals[0].value,value,text);assert.equal(p.proposals[0].polarity,polarity,text);assert.equal(p.proposals[0].evidence.quote,text); }
  const compound=preview('스스로 해보고 싶어요. 그리고 상세한 설명이 좋아요');assert.deepEqual(compound.proposals.map(p=>p.value),['independent','detailed']);
});

test('uncertainty is a question before a proposal, and explicit not-current/unsure/skip never creates a preference', () => {
  const p=preview('나는 자세한 설명이 좋을 수도 있어요');assert.equal(p.proposals.length,0);assert.ok(p.question);assert.match(p.question.label,/현재 선호/);
  for(const option of ['not-current','unsure','skip']){const next=answer(p,option);assert.equal(next.proposals.length,0);assert.equal(next.question,null);assert.equal(next.unresolved.length,1);}
  const next=answer(p,'confirm');assert.equal(next.question,null);assert.equal(next.proposals[0].value,'detailed');assert.equal(next.clarificationAnswers[0].optionLabel,p.question.options[0].label);
  const row=save(next);assert.equal(row.clarifications[0].optionId,'confirm');assert.equal(A.resolveMemberStatements([row],later).entries[0].active,true);
  assert.throws(()=>save(p));
});

test('unsupported text asks for actual current preference and only the complete chosen scope can become a proposal', () => {
  let p=preview('새 일에서는 설명이 있어야 마음이 놓여요');
  for(const choice of ['support','example','prefer']){assert.equal(p.proposals.length,0);p=answer(p,choice);}
  assert.equal(p.proposals.length,0);p=answer(p,'first-try');assert.equal(p.question,null);
  assert.deepEqual(pairs(p),[['support','example','prefer','first-try']]);assert.equal(p.clarificationAnswers.length,4);
  const row=save(p);assert.deepEqual(row.clarifications,p.clarifications);
  const relation=A.summarizeStatementRelations({document:{version:3,statements:[row]},facets:[],asOf:later});
  assert.deepEqual(relation.statementHistory[0].clarificationAnswers,p.clarificationAnswers);
  assert.match(relation.paragraphs.join(' '),/처음 시도할 때.*예시/);
});

test('skip and unsure are available at every question depth, without inventing an alternative preference', () => {
  for(let depth=0;depth<4;depth++)for(const exit of ['skip','unsure']){let p=preview('내 방식은 아직 설명하기 어려워요');for(const option of ['explanation','detailed','avoid'].slice(0,depth))p=answer(p,option);p=answer(p,exit);assert.equal(p.question,null);assert.equal(p.proposals.length,0);}
});

test('known typo is displayed for confirmation; arbitrary typos are not silently autocorrected', () => {
  const p=preview('혼쟈 해보고 싶어요');assert.equal(p.proposals.length,0);assert.match(p.question.label,/표기/);
  assert.equal(answer(p,'confirm').proposals[0].value,'independent');assert.equal(answer(p,'skip').proposals.length,0);
  assert.equal(preview('혼쟈 해보고 십어요').proposals.length,0);
});

test('other people, quotation, past, hypothetical and ambiguous negation are never automatic current declarations', () => {
  for(const text of ['친구는 스스로 해보는 게 편해요', '예전에는 스스로 하는 게 편했어요', '“스스로 해보고 싶어요”라고 친구가 말했어요',
    '만약 혼자 하는 게 좋다면 예시가 필요해', '나는 혼자 하는 게 싫지 않아요', '예시가 필요 없지 않아요', '혼자 하는 게 좋아요?',
    '친구는 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요', '예전에는 예시를 본 다음 혼자 해보고 싶었어요']) {
    const p=preview(text);assert.equal(p.proposals.length,0,text);
    if(/친구|예전|만약|“/.test(text))assert.equal(p.question,null,text);
  }
});

test('clarification binding uses the exact full source, Ask order, current option and bounded dense JSON rows', () => {
  const p=preview('나는 자세한 설명이 좋을 수도 있어요'), first={questionId:p.question.id,optionId:'confirm'};
  assert.equal(first.questionId.split('.')[1],createHash('sha256').update(p.text).digest('hex'));
  const question=preview('🙂 이 표현은 아직 지원하지 않아요').question;
  assert.equal(question.id.split('.')[1],createHash('sha256').update('🙂 이 표현은 아직 지원하지 않아요').digest('hex'));
  for(const bad of [[{...first,optionId:'other'}],[{...first,questionId:'old'}],[first,first],new Array(1),Array(13).fill(first),[{...first,rawText:p.text}]])assert.throws(()=>preview(p.text,bad));
  assert.throws(()=>preview(p.text+' ',[first]));
  let called=false;const accessor={...first};Object.defineProperty(accessor,'optionId',{enumerable:true,get(){called=true;return 'confirm';}});assert.throws(()=>preview(p.text,[accessor]));assert.equal(called,false);
  const staged=answer(preview('내가 하고 싶은 걸 더 알려줄게요'),'support');assert.throws(()=>preview(staged.text,[...staged.clarifications,{questionId:staged.question.id,optionId:'general'}]));
});

test('confirmation replays the exact answers, original evidence, selected meaning and source before persistence', () => {
  const p=answer(preview('나는 자세한 설명이 좋을 수도 있어요'),'confirm'), row=save(p);
  for(const mutate of [r=>r.clarifications[0].optionId='skip',r=>r.meanings[0].condition='first-try',r=>r.meanings[0].evidence.end--,r=>r.meanings[0].value='brief',r=>delete r.clarifications,r=>r.parserVersion=Legacy.PARSER_VERSION]){const r=structuredClone(row);mutate(r);assert.throws(()=>C.validateMemberStatement(r));}
  for(const mutate of [q=>q.clarificationAnswers[0].optionLabel='forged',q=>q.clarificationAnswers=[],q=>q.proposals[0].summary='forged']){const q=structuredClone(p);mutate(q);assert.throws(()=>save(q));}
  assert.throws(()=>A.confirmMemberStatement({preview:p,acceptedIds:['p0'],id,at:later,clarifications:[],text:p.text}));
  assert.throws(()=>A.confirmMemberStatement({preview:p,acceptedIds:['p0'],id,at:later,text:'다른 원문'}));
  assert.throws(()=>A.previewMemberStatement({text:p.text,at:later,asOf:at}));
});

test('conflict clarification withholds nonselected alternatives and does not silently accept the chosen suggestion', () => {
  const p=preview('혼자 하는 게 좋아. 함께 하는 게 좋아');assert.equal(p.proposals.length,2);assert.ok(p.question);
  assert.equal(answer(p,'skip').proposals.length,0);assert.equal(answer(p,'unsure').proposals.length,0);
  const next=answer(p,'p1');assert.equal(next.proposals.length,1);assert.equal(next.proposals[0].value,'together');assert.equal(next.question,null);
  assert.throws(()=>A.confirmMemberStatement({preview:next,acceptedIds:[],id,at:later}));assert.equal(save(next).meanings[0].value,'together');
});

test('question cap ends without admitting a partially answered preference or an unanswered conflict', () => {
  let p=preview('모르는 내용 하나. 모르는 내용 둘. 모르는 내용 셋. 모르는 내용 넷. 영상 제작에 관심이 있어');
  for(let i=0;i<12;i++){assert.ok(p.question);p=answer(p,['support','example','prefer','general'][i%4]);}
  assert.equal(p.question,null);assert.equal(p.clarifications.length,12);assert.ok(p.unresolved.some(u=>u.reason==='limit'));
  assert.equal(p.proposals.every(m=>m.evidence.quote!=='모르는 내용 넷'),true);assert.deepEqual(C.validateMemberStatement(save(p)),save(p));
});
