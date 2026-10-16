'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const V4=require('../experiences/synk-account/src/member-statement-v4.cjs');
const A=require('../experiences/synk-account/src/member-statement.cjs');
const at='2026-10-16T02:00:00.000Z',later='2026-10-16T02:01:00.000Z';
const tuple=m=>[m.field,m.value,m.polarity,m.condition];
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('ko4 bytes, every 304 parse, follow-up answer, and accepted row replay unchanged',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v4.cjs'))).digest('hex'),'973796df567dc4fc8dd7c38dd0034406c7c82cb40c86cd33f5a5a3dd185b9b0c');
  const rows=[...['evaluation','followup-evaluation','generalization-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v3-${n}.json`).cases),
    ...['diagnostic-evaluation','disclosed-evaluation','final-disclosed-evaluation'].flatMap(n=>require(`./fixtures/member-statement-v4-${n}.json`).cases)];
  assert.equal(rows.length,304);
  for(const [i,row]of rows.entries()){
    let clarifications=[],original=V4.parseMemberStatement(row.text);
    assert.deepEqual(C.parseMemberStatement(row.text,{parserVersion:V4.PARSER_VERSION}),original,row.id);
    while(original.question){
      clarifications.push({questionId:original.question.id,optionId:'skip'});
      original=V4.parseMemberStatement(row.text,{clarifications});
      assert.deepEqual(C.parseMemberStatement(row.text,{parserVersion:V4.PARSER_VERSION,clarifications}),original,row.id);
    }
    if(original.meanings.length){
      const saved={id:uuid(i+1),parserVersion:V4.PARSER_VERSION,text:row.text,at,confirmedAt:at,meanings:original.meanings,clarifications};
      assert.deepEqual(C.validateMemberStatement(saved),V4.validateMemberStatement(saved),row.id);
      assert.ok(A.resolveMemberStatements([saved],later).entries.every(e=>e.verified&&e.active),row.id);
    }
  }
});

test('typed noun, action and stance phrases compose across fields and supported scopes',()=>{
  const bases=[['채팅으로 제 생각을 전달하는','communication','written'],['일정을 미리 만들어 두는','work-style','plan-first'],
    ['먼저 실행하고 조금씩 보완하는','work-style','try-adjust'],['자료와 수치를 꼼꼼히 검토하고 판단하는','decision','evidence'],
    ['팀원들의 얘기를 차분히 듣고 정돈하는','communication','listen-organize'],['음악을 들으며 배우는','topic','music']];
  for(const [action,field,value]of bases)for(const [ending,polarity]of [['방식이 제게 잘 맞아요','prefer'],['쪽이 나는 편하더라','prefer'],['걸 선호하지 않습니다','avoid'],['건 제 취향이 아니에요','avoid']])for(const [prefix,condition]of [['',null],['회의 시간에는 ','meeting'],['정신없이 바쁜 상황에서는 ','busy']]){
    const text=prefix+action+' '+ending,p=C.parseMemberStatement(text);
    assert.deepEqual(p.meanings.map(tuple),[[field,value,polarity,condition]],text);assert.equal(p.question,null,text);
    assert.ok(p.meanings.every(m=>text.slice(m.evidence.start,m.evidence.end)===m.evidence.quote),text);
  }
});

test('comparison removes only a consumed alternative and never invents its opposite',()=>{
  for(const text of ['말을 주고받기보다 채팅으로 생각을 전달하는 쪽이 수월해요','문자로 쓰는 것보다 목소리로 직접 대화하는 게 편하더라']){
    const p=C.parseMemberStatement(text);assert.equal(p.question,null,text);assert.equal(p.meanings.length,1,text);assert.equal(p.meanings[0].polarity,'prefer');
  }
  for(const text of ['낯선 사람과 대화하기보다 글로 소통하는 게 좋아요','자료를 숨기기보다 계획을 미리 만들어 두는 쪽이 좋아요']){
    assert.equal(C.parseMemberStatement(text).meanings.length,0,text);
  }
});

test('unconsumed modifiers, negation, factual reports, another person and unsupported scopes stay withheld',()=>{
  for(const text of ['채팅으로 생각을 전달하지 않는 방식이 편하더라','일정을 미리 만들지 않고 시작하는 쪽이 제게 잘 맞아요',
    '먼저 실행하지 않고 조금씩 보완하는 방식이 좋아요','자료와 수치를 검토하지 않고 판단하는 게 수월해요',
    '친구는 자료와 수치를 꼼꼼히 검토하고 판단하는 게 편하더라','예전에는 채팅으로 내 생각을 전달하는 쪽이 편했어요',
    '휴가 기간에는 일정을 미리 만들어 두는 게 좋아요','만약 일정을 미리 만들어 두는 게 편하다면',
    '채팅으로 생각을 전달하는 게 수월할 수도 있어요','어제 채팅으로 내 생각을 전달했어요',
    '글로 소통하는 게 마음에 들었습니다','글로 의견을 전달하는 게 좋고 그랬어요',
    '자료와 수치를 검토하고 판단하는 게 좋다고 말해요','계획을 미리 만들어 두는 걸 좋아한다고 저장해 주세요',
    '어떤 것인지 모르는 설명을 자세하게 풀어 주는 쪽이 좋아요']){
    assert.equal(C.parseMemberStatement(text).meanings.length,0,text);
  }
  assert.equal(C.parseMemberStatement('글로만 소통하는 걸 선호하지 않아요').meanings.length,0);
  assert.ok(C.parseMemberStatement('글로만 소통하는 걸 선호하지 않아요').question);
});

test('current proposals are pending until the user explicitly accepts a subset',()=>{
  const text='일정을 미리 만들어 두는 쪽이 나는 편하더라. 채팅으로 생각을 전달하는 걸 좋아해요';
  const p=A.previewMemberStatement({text,asOf:at});
  assert.equal(p.parserVersion,C.PARSER_VERSION);assert.equal(p.proposals.length,2);assert.ok(p.proposals.every(m=>m.status==='pending'));
  assert.throws(()=>A.confirmMemberStatement({preview:p,acceptedIds:[],id:uuid(999),at}));
  const saved=A.confirmMemberStatement({preview:p,acceptedIds:[p.proposals[1].id],id:uuid(999),at});
  assert.equal(saved.meanings.length,1);assert.equal(saved.meanings[0].value,'written');assert.deepEqual(C.validateMemberStatement(saved),saved);
  const result=A.resolveMemberStatements([saved],later);assert.ok(result.entries.every(e=>e.verified&&e.active));
});

test('bounded 500-character input remains deterministic across repeated parses and previews',()=>{
  const prefix='채팅으로 생각을 전달하는 쪽이 수월해요. ';
  const text=prefix+'알'.repeat(500-[...prefix].length);
  assert.equal([...text].length,500);
  const original=C.parseMemberStatement(text),preview=A.previewMemberStatement({text,asOf:at});
  for(let i=0;i<12;i++){
    assert.deepEqual(C.parseMemberStatement(text),original);
    assert.deepEqual(A.previewMemberStatement({text,asOf:at}),preview);
  }
  assert.ok(original.question);assert.equal(original.meanings.length,1);
  assert.throws(()=>C.parseMemberStatement(text+'알'));
});

// This is a developer-authored metamorphic regression, not an independent
// language-accuracy sample. It checks the same semantic roles under reusable
// wording, inflection, filler, stance and scope combinations.
test('role composition preserves 1,500 generated wording, filler, stance and scope combinations',()=>{
  const actions=[
    ['제 의견을 채팅으로 전달하는','communication','written'],['글로 생각을 적어 전달하는','communication','written'],
    ['목소리로 의견을 주고받는','communication','spoken'],['동료들 이야기를 먼저 들어보고 제 생각을 취합하는','communication','listen-organize'],
    ['생각부터 꺼내 놓고 대화를 시작하는','communication','share-first'],['할 일과 계획을 미리 정해 두는','work-style','plan-first'],
    ['일정을 먼저 만들고 시작하는','work-style','plan-first'],['작게 실행해 보고 문제점을 수정하는','work-style','try-adjust'],
    ['일을 하나씩 마무리하고 다음 일을 하는','work-style','single-task'],['일의 우선순위를 정하고 순서대로 처리하는','work-style','prioritize'],
    ['사실과 데이터와 근거를 검토하고 판단하는','decision','evidence'],['후보와 선택지를 비교해 보고 결정하는','decision','compare-options'],
    ['다른 사람들과 생각을 나눠 상의하는','decision','consult'],['몸소 겪은 경험을 바탕으로 판단하는','decision','experience'],
    ['이유와 근거를 깊이 있게 설명받는','explanation-detail','reasons-detail'],['전체 구조를 먼저 알려 주는','explanation-detail','overview-first'],
    ['차례차례 도움을 받아 가며 하는','support','step'],['다른 도움 없이 혼자 시도해 보는','support','independent'],
    ['누군가와 같이 해 볼 수 있는','support','together'],['필요한 순간에 도움을 골라 받는','support','choose'],
    ['연습에서 귀로 소리를 듣는','practice-mode','listening'],['소리를 듣고 글을 읽으면서 두 가지를 같이 연습하는','practice-mode','mixed'],
    ['영상을 직접 만드는','topic','content-video'],['자연을 보고 산책하는','topic','nature'],['글을 읽으며 연습하는','practice-mode','reading']
  ];
  const endings=[['쪽이 저는 편하더라고요','prefer'],['건 내 취향이 아니야','avoid'],['방식을 고르고 싶어요','prefer'],
    ['것을 좋아하지 않아요','avoid'],['편이 마음에 들어요','prefer'],['게 수월해요','prefer']];
  const scopes=[['',null],['저는 ',null],['회의 시간에는 ','meeting'],['정신없이 바쁜 상황에서는 ','busy'],['이미 익숙해진 내용이라면 ','familiar']];
  let checked=0;const failures=[];
  for(const [action,field,value]of actions)for(const [ending,polarity]of endings)for(const [prefix,condition]of scopes)for(const filler of ['','개인적으로 정말 ']){
    const text=prefix+filler+action+' '+ending,p=C.parseMemberStatement(text);
    if(JSON.stringify(p.meanings.map(tuple))!==JSON.stringify([[field,value,polarity,condition]])||p.question)failures.push(text);checked++;
  }
  assert.equal(checked,1500);
  assert.deepEqual(failures,[],`Generated failures: ${failures.length}; ${failures.slice(0,6).join(' / ')}`);
});

test('role flexibility does not discard unknown modifiers, internal negation or a different subject',()=>{
  const actions=['사실과 데이터와 근거를 검토하고 판단하는','일을 하나씩 마무리하고 다음 일을 하는','차례차례 도움을 받아 가며 하는','목소리로 의견을 주고받는'];
  for(const action of actions)for(const text of [`아마 ${action} 쪽이 맞을 수도 있어요`,`동료는 ${action} 쪽이 편하더라고요`,`예전에는 ${action} 쪽이 좋았어요`,
    `휴가를 낸 날에만 ${action} 방식이 좋아요`,`알 수 없는 조건에서 ${action} 방식이 좋아요`,`${action} 방식을 강요받는 게 좋아요`]){
    assert.equal(C.parseMemberStatement(text).meanings.length,0,text);
  }
  for(const text of ['자료를 확인하지 않고 판단하는 게 좋아요','다른 도움을 받지 않는 사람들은 혼자 시도하는 게 좋아요',
    '글을 읽지 않고 연습하는 게 좋아요','제 의견보다 친구의 의견을 먼저 말하는 편이 좋아요',
    '글로도 말로도 소통하지 않는 쪽이 좋아요','큰 그림을 먼저 보지 않고 설명받는 게 편해요']){
    assert.equal(C.parseMemberStatement(text).meanings.length,0,text);
  }
});

test('order-sensitive roles withhold reversed preparation rather than label it first',()=>{
  const reversed=[
    '저는 먼저 시작한 뒤에 계획을 세우는 게 좋아요.',
    '저는 시작하고 나서 계획을 세우는 게 좋아요.',
    '저는 일단 시작한 뒤에 예시를 보는 게 좋아요.',
    '저는 시작하고 나서 예시를 보는 게 좋아요.',
    '저는 세부 내용을 먼저 듣고 전체 개요를 보는 게 좋아요.',
    '저는 세부 내용을 먼저 듣고 큰 그림을 보는 게 좋아요.',
    '저는 먼저 자세한 설명을 받고 전체 흐름을 보는 게 좋아요.'
  ];
  for(const text of reversed){
    const parsed=C.parseMemberStatement(text);
    assert.deepEqual(parsed.meanings,[],text);
    assert.ok(parsed.question,text);
    const preview=A.previewMemberStatement({text,asOf:at});
    assert.deepEqual(preview.proposals,[],text);
    assert.throws(()=>A.confirmMemberStatement({preview,acceptedIds:['p0'],id:uuid(998),at}),undefined,text);
  }
  for(const [text,field,value]of [
    ['저는 계획을 세운 뒤에 시작하는 게 좋아요.','work-style','plan-first'],
    ['저는 예시를 보고 시작하는 게 좋아요.','support','example'],
    ['저는 전체 개요를 먼저 보고 세부 내용을 듣는 게 좋아요.','explanation-detail','overview-first'],
    ['자세한 내용으로 들어가기 전에 큰 그림부터 보여 주는 설명이면 좋겠어요.','explanation-detail','overview-first']
  ]){
    const parsed=C.parseMemberStatement(text);
    assert.deepEqual(parsed.meanings.map(tuple),[[field,value,'prefer',null]],text);
    assert.equal(parsed.question,null,text);
  }
});
