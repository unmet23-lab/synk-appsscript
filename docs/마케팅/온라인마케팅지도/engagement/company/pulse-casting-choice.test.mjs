// 모델 판단 하나(castingOf) — 다국어 · 고객 전용 인물 판 1(2026-11-09, 기획 12-2 「선택 값」).
import test from 'node:test';
import assert from 'node:assert/strict';
import {castingOf,personaRefOf,MODEL_CHOICE_KINDS,MODEL_OPTIONAL_CHOICES} from './public/pulse-app/casting-choice.mjs';

const P='11111111-2222-4333-8444-555555555555',R='66666666-7777-4888-9999-aaaaaaaaaaaa';

test('personaRefOf는 인물 · 판 두 UUID만 받는다',()=>{
  assert.deepEqual(personaRefOf({personaId:P,revisionId:R}),{personaId:P,revisionId:R});
  assert.deepEqual(personaRefOf({personaId:P,revisionId:R,extra:'x'}),{personaId:P,revisionId:R},'다른 칸은 떨어진다');
  for(const bad of [null,'',[],{personaId:P},{personaId:'F02',revisionId:R},{personaId:P,revisionId:R.toUpperCase()},{personaId:1,revisionId:R}])assert.equal(personaRefOf(bad),null,JSON.stringify(bad));
});

test('카탈로그 모델은 지금까지 고객 방이 보던 차례 그대로다(제작 설계 → 받아들인 제안 → 고른 모델)',()=>{
  const request={answers:{models:['F02','M01'],modelChoice:''},modelProposal:{status:'accepted',modelId:'F03'}};
  assert.deepEqual(castingOf(request,{modelId:'M10'}),{kind:'catalog',modelId:'M10',personaRef:null,agreed:true});
  assert.equal(castingOf(request,{modelId:''}).modelId,'F03');
  assert.equal(castingOf({answers:{models:['F02']}},{}).modelId,'F02');
  assert.equal(castingOf({answers:{models:[]},modelProposal:{status:'open',modelId:'F03'}},{}).kind,'','열린 제안은 아직 아니다');
});

test('agreed는 옛 글 콘티 보내기 조건과 같다 — 직원이 제작 설계에만 넣은 모델은 손님 확인 전',()=>{
  assert.equal(castingOf({answers:{models:[],modelChoice:''}},{modelId:'F02'}).agreed,false);
  assert.equal(castingOf({answers:{models:['F02']}},{}).agreed,true);
  assert.equal(castingOf({answers:{models:[]},modelProposal:{status:'accepted',modelId:'F02'}},{}).agreed,true);
  assert.equal(castingOf({answers:{models:[],modelChoice:'none'}},{}).agreed,true);
  assert.equal(castingOf({answers:{models:[],modelChoice:'none'}},{modelId:'F02'}).agreed,true,'사람 없이 고른 뒤 직원이 모델을 넣어도 옛 판단(보내기 됨) 그대로');
  for(const kind of ['ask','custom','persona',''])assert.equal(castingOf({answers:{models:[],modelChoice:kind}},{}).agreed,false,kind);
});

test('전용 인물 참조가 붙어 있으면 그것이 이긴다',()=>{
  const ref={personaId:P,revisionId:R};
  assert.deepEqual(castingOf({answers:{models:['F02'],modelChoice:''}},{modelId:'F02',personaRef:ref}),{kind:'persona',modelId:'',personaRef:ref,agreed:true});
  assert.equal(castingOf({answers:{models:[]}},{personaRef:{personaId:'x',revisionId:R}}).kind,'','모양이 틀린 참조는 없는 것');
});

test('고르는 법 ID는 언어와 상관없고, 카탈로그 없이 가는 셋은 따로 묶는다',()=>{
  assert.deepEqual([...MODEL_CHOICE_KINDS],['ask','none','custom','persona']);
  assert.deepEqual([...MODEL_OPTIONAL_CHOICES],['none','custom','persona']);
  for(const kind of MODEL_CHOICE_KINDS)assert.equal(castingOf({answers:{modelChoice:kind}},null).kind,kind);
  assert.equal(castingOf({answers:{modelChoice:'추천'}},null).kind,'','모르는 값');
  assert.equal(castingOf(null,null).kind,'');
});
