import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAnswer,createInterviewSession} from '../interview/dialogue.mjs';
import {INTERVIEWERS,INTERVIEW_INFO} from '../interview/content.mjs';

function listening(){const session=createInterviewSession();session.start();session.advance();assert.equal(session.advance().phase,'listening');return session;}

test('negative experience phrases never take the experience follow-up',()=>{
  for(const text of ['경험이 없어요.','요양 일을 한 적 없어요.','실습을 해 본 적이 없어요.','어르신을 돌본 적이 없습니다.','봉사를 해 보지 않았어요.','돌봄 경험은 아직 없지만 배우고 싶어요.','근무한 적은 없어요.','경험이 있지 않아요.','돌봤던 적이 없어요.','경험이 전혀 없어요.']){
    const result=classifyAnswer(text);
    assert.equal(result.category,'preparation',text);
    assert.equal(result.negatedExperience,true,text);
    assert.ok(result.evidence.length>0,text);
    assert.equal(listening().answer(text).prompt.speakerId,'observer',text);
  }
});

test('past action and aspiration choose different concrete follow-ups',()=>{
  assert.equal(classifyAnswer('할머니를 돌봤어요. 식사할 때 도와드렸어요.').category,'experience');
  assert.equal(classifyAnswer('어르신을 돌보고 싶어요.').category,'motivation');
  assert.equal(classifyAnswer('자격증 공부를 하고 있습니다.').category,'preparation');
  assert.equal(classifyAnswer('어제 축구 경기를 봤어요.').category,'off-topic');
  assert.equal(classifyAnswer('음 그렇습니다.').category,'unclear');
  const result=classifyAnswer('사람을 돕고 싶어요.');
  assert.ok('사람을 돕고 싶어요.'.includes(result.evidence));
});

test('extra Korean recognition spaces preserve negation priority and the original answer',()=>{
  const negative='봉사 경험 이 없 습니다 배우고 싶습니다';
  const classified=classifyAnswer(negative,{confidence:0.994});
  assert.equal(classified.category,'preparation');assert.equal(classified.negatedExperience,true);
  assert.ok(negative.includes(classified.evidence));assert.match(classified.evidence,/경험 이 없/);
  const state=listening().answer(negative,{confidence:0.994});
  assert.equal(state.answers[0].text,negative);assert.equal(state.branch.category,'preparation');
  const positive='할머니 를 돌 봤 습니다';
  const experience=classifyAnswer(positive);
  assert.equal(experience.category,'experience');assert.ok(positive.includes(experience.evidence));
  assert.equal(classifyAnswer('잘 모르겠 습니다').kind,'repair');
  assert.equal(classifyAnswer('다 시 요').reason,'repeat');
});

test('silence uncertainty repeat and low recognition confidence remain repairs, never answers',()=>{
  for(const [text,options,reason] of [
    ['',{},'empty'],['잘 모르겠어요.',{},'uncertain'],['모르겠습니다.',{},'uncertain'],
    ['모름',{},'uncertain'],['잘 몰라요.',{},'uncertain'],['다시요',{},'repeat'],
    ['다시 말씀해 주세요.',{},'repeat'],['질문을 못 들었어요.',{},'repeat'],
    ['할머니를 돌봤어요.',{confidence:0.2},'recognition'],
    ['어르신을 돕고 싶어요.',{recognitionError:true},'recognition']
  ]){
    const session=listening(),state=session.answer(text,options);
    assert.equal(state.phase,'repair',text);assert.equal(state.repair.reason,reason,text);
    assert.deepEqual(state.answers,[],text);assert.equal(state.branch,null,text);
    assert.equal(session.advance().phase,reason==='repeat'?'question':'listening',text);
  }
  assert.equal(classifyAnswer('모르는 것이 있으면 먼저 물어보고 싶어요.').kind,'usable');
});

test('two spoken answers finish with concrete practice and no score or hiring judgment',()=>{
  const session=createInterviewSession();
  assert.equal(session.start().prompt.speakerId,'lead');
  assert.equal(session.advance().phase,'question');session.advance();
  let state=session.answer('할머니를 돌봤어요.',{confidence:0.9});
  assert.equal(state.phase,'followup');assert.equal(state.turn,2);
  assert.equal(state.prompt.speakerId,'specialist');assert.equal(state.branch.category,'experience');
  assert.match(state.prompt.text,/본인의 역할/);
  assert.equal(session.advance().phase,'listening');
  state=session.answer('식사 전에 필요한 물건을 준비했습니다.');
  assert.equal(state.phase,'closing');assert.equal(state.answers.length,2);
  state=session.advance();assert.equal(state.phase,'reflection');
  assert.match(state.reflections[1],/본인의 행동/);
  assert.equal('score' in state,false);assert.equal('evaluation' in state,false);
  assert.match(INTERVIEW_INFO.privacyNotice,/자동 저장하지/);
});

test('repair during follow-up preserves the selected question and first answer',()=>{
  const session=listening();session.answer('어르신을 돕고 싶어요.');session.advance();
  session.answer('잘 모르겠어요.');assert.equal(session.advance().phase,'listening');
  const repeated=session.repeat();assert.equal(repeated.prompt.id,'followup-motivation');
  assert.equal(repeated.answers.length,1);assert.equal(repeated.turn,2);
  session.advance();assert.equal(session.timeout().phase,'repair');
  assert.equal(session.advance().phase,'listening');
  assert.equal(session.answer('이야기를 끝까지 듣고 필요한 도움을 확인하고 싶어요.').phase,'closing');
});

test('speech callbacks and duplicate submissions cannot skip or add answers',()=>{
  const session=createInterviewSession();assert.equal(session.answer('대답').phase,'idle');
  session.start();assert.equal(session.start().phase,'intro');
  session.advance();session.advance();assert.equal(session.advance().phase,'listening');
  session.answer('돕고 싶어요.');session.answer('중복 입력');
  assert.equal(session.snapshot().answers.length,1);
});

test('snapshots cannot mutate the session; restart and disposal remove all in-memory answers',()=>{
  const session=listening();const output=session.answer('어르신을 돕고 싶어요.');
  output.answers[0].text='외부 변경';output.branch.category='experience';output.prompt.text='외부 변경';
  assert.notEqual(session.snapshot().answers[0].text,'외부 변경');
  assert.equal(session.snapshot().branch.category,'motivation');
  assert.deepEqual(session.reset().answers,[]);assert.equal(session.start().phase,'intro');
  session.dispose();assert.deepEqual(session.snapshot().answers,[]);assert.equal(session.start().phase,'disposed');
});

test('three stable speaker ids and nominal timing do not impose a global hard stop',()=>{
  assert.deepEqual(INTERVIEWERS.map(s=>s.id),['lead','specialist','observer']);
  assert.deepEqual(INTERVIEW_INFO.targetSeconds,[60,90]);
  assert.equal(listening().snapshot().answerLimitMs,25000);
  assert.throws(()=>createInterviewSession({answerLimitMs:0}),RangeError);
});

test('ambiguous experience reversals and malformed negations keep the current answer open',()=>{
  for(const text of [
    '저는 돌봄 경험이 있어요 아니 없어요.', '저는 돌봄 경험이 있습니다. 사실 없습니다.',
    '저는 요양원에서 어르신을 돌봤습니다. 아니다 아직 안 해봤습니다.',
    '저는 요양원 근무했어요. 안 했어요.', '저는 돌봄 경험은 없습니다. 지금은 있습니다.',
    '저는 돌봄 경험이 없어요 아니 있어요.',
    '저는 요양원에서 근무했지 않았습니다.', '저는 어르신을 돌봤지 않았어요.',
    '저는 돌봤어요는 아니에요.', '저는 어르신을 도왔습니다는 아니에요.',
  ]){
    const session=listening(), state=session.answer(text,{confidence:.999});
    assert.equal(state.phase,'repair',text);assert.equal(state.repair.reason,'uncertain');
    assert.deepEqual(state.answers,[]);assert.equal(state.branch,null);
    assert.equal(session.advance().phase,'listening');
    assert.equal(session.answer('할머니를 돌봤습니다.').branch.category,'experience');
  }
});

test('short literal denials retain the original words and select preparation',()=>{
  for(const text of ['경험없어요','아직안해봤어요','해본적없습니다','저는 아직 안 해봤어요.','저는 요양원 일 아직 안 해봤어요.','아직 안 해 봤 어 요.']){
    const result=classifyAnswer(text);
    assert.equal(result.category,'preparation',text);assert.equal(result.ruleId,'no-experience');
    assert.equal(result.evidence,text);
    const state=listening().answer(text);
    assert.equal(state.prompt.speakerId,'observer');assert.equal(state.answers[0].text,text);
  }
  assert.equal(classifyAnswer('축구 안 해봤어요.').category,'off-topic');
  assert.equal(classifyAnswer('경험이 업습니다.').category,'unclear');
});

test('a qualified denial of helping selects preparation instead of the positive verb inside it',()=>{
  for(const text of ['저는 할머니를 도와드렸다고는 할 수 없습니다.','저는 할머니를 도와드렸다고 할 수는 없습니다.','저는 할머니를 도와 드렸다고는 말할 수 없습니다.']){
    const result=classifyAnswer(text,{confidence:.999});
    assert.equal(result.category,'preparation',text);assert.equal(result.ruleId,'no-experience');
    assert.ok(text.includes(result.evidence));
    assert.equal(listening().answer(text).prompt.speakerId,'observer');
  }
  assert.equal(classifyAnswer('저는 할머니를 도와드렸다고 할 수 있습니다.').category,'experience');
});
