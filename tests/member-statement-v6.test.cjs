'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const V5=require('../experiences/synk-account/src/member-statement-v5.cjs');
const tuple=m=>[m.field,m.value,m.polarity,m.condition];
const at='2026-10-16T06:00:00.000Z';

test('ko5 immutable bytes, questions, answers and confirmed replay remain unchanged',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v5.cjs'))).digest('hex'),'d4da785c129f7533422c4ec17cfa6c6a124eb911d4ac7fe9442af3c7a6a98111');
  const rows=[...['evaluation','followup-evaluation','generalization-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v3-${n}.json`).cases),
    ...['diagnostic-evaluation','disclosed-evaluation','final-disclosed-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v4-${n}.json`).cases),
    ...['development-evaluation','disclosed-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v5-${n}.json`).cases)];
  assert.equal(rows.length,444);
  for(const [index,row]of rows.entries()){
    const answers=[];let p=V5.parseMemberStatement(row.text);
    assert.deepEqual(C.parseMemberStatement(row.text,{parserVersion:V5.PARSER_VERSION}),p,row.id);
    while(p.question){answers.push({questionId:p.question.id,optionId:'skip'});p=V5.parseMemberStatement(row.text,{clarifications:answers});
      assert.deepEqual(C.parseMemberStatement(row.text,{parserVersion:V5.PARSER_VERSION,clarifications:answers}),p,row.id);}
    if(p.meanings.length){const saved={id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,parserVersion:V5.PARSER_VERSION,text:row.text,at,confirmedAt:at,meanings:p.meanings,clarifications:answers};
      assert.deepEqual(C.validateMemberStatement(saved),V5.validateMemberStatement(saved),row.id);}
  }
});

// These are author-known regression cases, not independent accuracy evidence.
const actions=[
  ['누군가 알려 주기 전에 제 힘으로 해 보는','support','independent'],
  ['완성된 예를 한 번 보여 주는 도움','support','example'],
  ['할 순서에 맞춰 한 단계씩 도와주는','support','step'],
  ['도움을 필요하다고 느끼는 순간에 골라서 받는','support','choose'],
  ['처음부터 끝까지 누군가와 같이 하는','support','together'],
  ['설명을 간단히 요점 위주로 해 주는','explanation','brief'],
  ['내용을 빠짐없이 풀어서 자세히 알려 주는 설명','explanation','detailed'],
  ['소리를 귀로 들으며 연습하는','practice-mode','listening'],
  ['글을 눈으로 읽어 가며 연습하는','practice-mode','reading'],
  ['대화에서 다른 분들 의견을 듣고 생각을 정리하는','communication','listen-organize'],
  ['하고 싶은 이야기를 글에 담아 전달하고 답을 받는','communication','written'],
  ['작업에 손대기 전에 계획을 짜 두는','work-style','plan-first'],
  ['조금씩 해 보다가 결과를 보고 방법을 고치는','work-style','try-adjust'],
  ['하나를 마무리하고 다음 일을 시작하는','work-style','single-task'],
  ['할 일에 중요도 순서를 붙이고 높은 순서부터 끝내는','work-style','prioritize'],
  ['실제로 겪어 본 일을 판단의 참고로 삼는','decision','experience'],
  ['다른 사람에게 의견을 구해 상의한 뒤 결론을 내리는','decision','consult'],
  ['전체가 어떻게 생겼는지 큰 틀을 우선 보여 주는','explanation-detail','overview-first'],
  ['어떤 근거로 그런 결론을 내렸는지 속속들이 설명해 주는','explanation-detail','reasons-detail'],
  ['설명을 잘게 끊지 않고 길게 이어서 들려주는','explanation-detail','long-flow']
];
test('new verb, method and self-position grammar composes without losing polarity or scope',()=>{
  const endings=[['방식이 저한테 편해요','prefer'],['쪽이 제게는 잘 맞아요','prefer'],['걸 선호하지 않아요','avoid'],['건 제 취향이 아니에요','avoid']];
  const scopes=[['',null],['회의 중에는 ','meeting'],['낯선 일을 처음 접했을 때라면 ','first-try']];
  const failures=[];let checked=0;
  for(const [action,field,value]of actions)for(const [ending,polarity]of endings)for(const [prefix,condition]of scopes){
    const text=prefix+action+' '+ending,p=C.parseMemberStatement(text);checked++;
    if(JSON.stringify(p.meanings.map(tuple))!==JSON.stringify([[field,value,polarity,condition]])||p.question)failures.push({text,got:p.meanings.map(tuple)});
    assert.ok(p.meanings.every(m=>text.slice(m.evidence.start,m.evidence.end)===m.evidence.quote));
  }
  assert.equal(checked,240);assert.deepEqual(failures,[]);
});

test('current explicit wishes and self-owned predicates avoid redundant generic questions',()=>{
  for(const [text,field,value]of [
    ['혼자 해 볼 수 있으면 좋겠어요','support','independent'],
    ['예시를 먼저 보여 주면 좋겠습니다','support','example'],
    ['한 단계씩 도와주면 편하겠어요','support','step'],
    ['글을 읽으며 연습할 수 있으면 좋겠어요','practice-mode','reading'],
    ['계획을 미리 세우는 방식이라면 저는 더 좋아요','work-style','plan-first'],
    ['제 일하는 취향은 하나를 끝내고 다음 일을 시작하는 거예요','work-style','single-task'],
    ['판단의 바탕은 확인할 수 있는 자료나 근거였으면 좋겠어요','decision','evidence'],
    ['제 취미는 사진을 찍는 거예요','topic','photography'],
    ['저는 독서를 좋아하거든요','topic','reading-books'],
    ['말로 소통하는 게 편하잖아요','communication','spoken'],
    ['요리하는 건 제가 즐기는 분야예요','topic','cooking'],
    ['설명은 너무 짧거나 길게 말고 중간 길이로 듣는 게 좋아요','explanation','standard']
  ]){const p=C.parseMemberStatement(text);assert.deepEqual(p.meanings.map(tuple),[[field,value,'prefer',null]],text);assert.equal(p.question,null,text);}
});

test('an explicit wish does not remove negation, conditions, another subject, uncertainty or a question',()=>{
  const withheld=[
    '만약 혼자 해 볼 수 있다면 좋겠어요','혼자 해 볼 수 없으면 좋겠어요','혼자 하지 않는 방식이면 좋겠어요',
    '친구는 혼자 해 볼 수 있으면 좋겠어요','그분이 혼자 하는 방식이 저한테 편해요',
    '휴가 때만 혼자 해 볼 수 있으면 좋겠어요','혼자 시도하는 게 맞는 것 같아요',
    '혼자 시도하는 게 좋겠어요?','글로도 말로도 소통하지 않는 게 편하겠어요',
    '제가 좋아하는 건 친구가 계획을 세우는 거예요','자료를 확인할 수 없는 방식이 편해요',
    '글로 전달하는 방법을 강요받는 게 좋아요','자료와 근거를 확인해야 하는 일을 맡았어요',
    '계획을 먼저 세우라고 배웠어요','예전에는 글로 소통하는 게 좋았거든요',
    '내일만 예시를 먼저 보여 주면 좋겠어요','계획을 먼저 세운다는 말이 좋아요'
  ];
  for(const text of withheld)assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('morphology preserves the action order instead of inventing preparation first',()=>{
  for(const text of ['먼저 시작하고 계획을 세우는 방식이라면 저는 더 좋아요','일을 시작하고 예시를 보여 주면 좋겠어요',
    '세부 내용을 듣고 전체 개요를 먼저 보여 주면 좋겠어요','계획을 세우지 않고 시작하면 좋겠어요',
    '의견을 정리하고 다른 사람 말을 듣는 방식이면 좋겠어요','고친 다음 시도해 보는 게 좋아요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('same-preference causal paraphrases retain one source-backed meaning',()=>{
  const text='책에 푹 빠져 읽는 시간을 좋아해서 독서는 늘 제 관심사예요';
  const p=C.parseMemberStatement(text);assert.deepEqual(p.meanings.map(tuple),[['topic','reading-books','prefer',null]]);assert.equal(p.question,null);
  assert.equal(p.meanings[0].evidence.quote,text);
  for(const source of ['책 읽는 걸 좋아해서 친구는 독서를 좋아해요','책 읽는 걸 좋아해서 독서는 별로예요','책 읽는 걸 좋아해서 음악이 관심사예요'])
    assert.deepEqual(C.parseMemberStatement(source).meanings,[],source);
});
