// 다국어 · 고객 전용 인물 판 1(2026-11-09, 기획 12-2) — 서버를 띄우지 않고 본다.
// 의뢰서 액션의 모델 판단 · 인물 참조, 제작 설계 저장이 인물 참조를 지키는 것, 인물 파일이 백업 목록에 오르는 것, 스위치 값 읽기.
// 화면 쪽(번역 틀 · 영어 사전 · 빈 답 칸 · 오류 코드)은 pulse-i18n-screen.test.mjs — 백엔드 검수 묶음에 화면 시험을 섞지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {applyRequestAction,emptyRequestAnswers,normalizeRequestAnswers,carryToStrategy} from './pulse-requests.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';
import {applyStrategyAction,strategyView,emptyStrategy} from './pulse-strategy.mjs';
import {workspaceMediaNames,personaMediaOf,PERSONA_MEDIA_KINDS} from './workspace-media.mjs';
import {readPulseFeatures,projectLocaleOf} from './pulse-features.mjs';
import {LOCALES,DICTIONARY_LOCALES} from './public/pulse-app/i18n.mjs';

const AT='2026-11-09T01:00:00.000Z',stamp={author:'staff',authorId:'u1',authorName:'담당자',at:AT},guest={author:'customer',authorId:'customer',authorName:'김합성',at:AT};
const REF={personaId:'11111111-2222-4333-8444-555555555555',revisionId:'66666666-7777-4888-9999-aaaaaaaaaaaa'};
const IMAGE='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function room({answers={},casting={},confirmed=true}={}){
  const studio=emptyPulseStudio();
  studio.assets=[{id:IMAGE,diskName:IMAGE+'.png',mimeType:'image/png',fileName:'a.png',byteSize:1,author:'staff'}];
  studio.request={schemaVersion:1,number:'P-1109-AAAA',status:confirmed?'confirmed':'submitted',...(confirmed?{confirmedAt:AT}:{}),answers:{...emptyRequestAnswers(),...answers},files:[],asks:[],notes:[],rounds:[]};
  studio.strategy={...emptyStrategy(),revision:1,data:{...emptyStrategy().data,castingSelection:{...emptyStrategy().data.castingSelection,...casting}}};
  return {studio,row:{id:'p1',stage:'received'}};
}
const direction=extra=>({action:'propose_direction',lead:'두 안이에요',options:[{name:'가',sentence:'한 문장',flow:[{at:'0:00',text:'시작'}],assetId:IMAGE},{name:'나',sentence:'두 문장',flow:[{at:'0:00',text:'시작'}],assetId:IMAGE}],price:390000,dueDate:'2026-11-20',revisions:2,...extra});
const act=(r,input,{staff=true,personas}={})=>applyRequestAction({studio:r.studio,row:r.row,input,staff,stamp:staff?stamp:guest,personas});

test('방향 제안: 사람 없이 · 새 전용 인물 · 이미 있는 전용 인물을 고른 의뢰는 카탈로그 모델 없이 보낸다',()=>{
  for(const modelChoice of ['none','custom','persona']){const r=room({answers:{modelChoice}});act(r,direction());assert.equal(r.studio.request.directionProposal.modelId,undefined,modelChoice);}
  for(const modelChoice of ['','ask'])assert.throws(()=>act(room({answers:{modelChoice}}),direction()),/함께 보낼 모델을 골라 주세요/,modelChoice);
  const r=room({answers:{models:['F02']}});act(r,direction({modelId:'F02'}));assert.equal(r.studio.request.directionProposal.modelId,'F02','카탈로그는 그대로');
});

test('전용 인물이 붙은 프로젝트는 방향 제안 · 제작 시작 때 인물 판을 다시 본다 — 판 1에는 통과하는 인물이 없다',()=>{
  const r=room({casting:{personaRef:REF}});
  assert.throws(()=>act(r,direction()),error=>error.status===409&&/전용 인물 판이 바뀌었어요/.test(error.message),'검사 함수가 없으면 막는다');
  assert.throws(()=>act(r,direction(),{personas:()=>{throw Object.assign(new Error('전용 인물 판이 바뀌었어요. 최신 내용을 불러와 주세요.'),{status:409});}}),/전용 인물 판/);
  const seen=[];act(r,direction(),{personas:(ref,row)=>{seen.push([ref,row.id]);}});
  assert.deepEqual(seen,[[REF,'p1']],'검사 함수는 참조와 프로젝트를 받는다');
  // 글 콘티 보내기: 인물 참조가 붙어 있으면 모델이 정해진 것으로 본다(방향을 거치지 않아도).
  const draft=room({casting:{personaRef:REF}});draft.studio.scenes=[{id:'s1',revision:1,visibility:'customer',title:'컷 1',assetId:IMAGE}];
  act(draft,{action:'send_draft',oneLine:'한 문장',note:''});assert.equal(draft.studio.request.rounds.length,1);
  // 제작 시작(이미지 판 확인): 인물 판을 다시 본다. 통과하면 제작으로 넘어간다.
  assert.throws(()=>act(draft,{action:'approve_draft',round:1},{staff:false}),/전용 인물 판/);
  assert.equal(draft.row.stage,'received');
  act(draft,{action:'approve_draft',round:1},{staff:false,personas:()=>{}});assert.equal(draft.row.stage,'producing');
});

test('새 전용 인물 · 이미 있는 인물을 고른 의뢰는 인물이 붙기 전에는 제작을 시작하지 않는다 — 방향 · 글 콘티는 먼저 맞춘다(GPT GA1)',()=>{
  for(const modelChoice of ['custom','persona']){
    const r=room({answers:{modelChoice}});r.studio.scenes=[{id:'s1',revision:1,visibility:'customer',title:'컷 1',assetId:IMAGE}];
    let calls=0;const personas=()=>{calls++;};
    act(r,direction(),{personas});
    act(r,{action:'answer_direction',optionId:r.studio.request.directionProposal.options[0].id},{staff:false,personas});
    act(r,{action:'send_draft',oneLine:'한 문장',note:''},{personas});
    assert.throws(()=>act(r,{action:'approve_draft',round:1},{staff:false,personas}),error=>error.status===409&&/전용 인물이 아직 준비되지 않았어요/.test(error.message),modelChoice);
    assert.equal(r.row.stage,'received',modelChoice);assert.equal(r.studio.request.approvedAt,undefined);assert.equal(calls,0);
    // 인물이 붙어 손님이 승인하면(판 3) 그 판을 다시 보고 시작한다.
    r.studio.strategy.data.castingSelection.personaRef=REF;
    act(r,{action:'approve_draft',round:1},{staff:false,personas});
    assert.equal(r.row.stage,'producing',modelChoice);assert.equal(calls,1);
  }
  // 손님이 방향에서 카탈로그 모델을 고르면 그 모델로 시작한다.
  const switched=room({answers:{modelChoice:'custom'}});switched.studio.scenes=[{id:'s1',revision:1,visibility:'customer',title:'컷 1',assetId:IMAGE}];
  act(switched,direction({modelId:'F02'}));
  act(switched,{action:'answer_direction',optionId:switched.studio.request.directionProposal.options[0].id},{staff:false});
  act(switched,{action:'send_draft',oneLine:'한 문장',note:''});
  act(switched,{action:'approve_draft',round:1},{staff:false});
  assert.equal(switched.row.stage,'producing');assert.equal(switched.studio.request.answers.modelChoice,'');
});

test('카탈로그 모델로 바꾸면(모델 제안 받기 · 방향 고르기) 붙어 있던 인물 참조를 뗀다',()=>{
  const proposed=room({answers:{modelChoice:'persona'},casting:{personaRef:REF}});
  act(proposed,{action:'propose_model',modelId:'F02',note:''});
  act(proposed,{action:'answer_model',accept:true},{staff:false});
  const casting=proposed.studio.strategy.data.castingSelection;
  assert.equal(casting.modelId,'F02');assert.equal(casting.personaRef,undefined);
  assert.deepEqual(proposed.studio.request.answers.models,['F02']);assert.equal(proposed.studio.request.answers.modelChoice,'');
  // 확인 전이어도 인물 참조가 붙어 있었으면 뗀다(그대로 두면 카탈로그를 골라도 인물이 이긴다).
  const early=room({answers:{modelChoice:'persona'},casting:{personaRef:REF},confirmed:false});
  act(early,{action:'propose_model',modelId:'M01',note:''});act(early,{action:'answer_model',accept:true},{staff:false});
  assert.equal(early.studio.strategy.data.castingSelection.personaRef,undefined);
  const chosen=room({answers:{modelChoice:'persona'},casting:{personaRef:REF}});
  act(chosen,direction({modelId:'F03'}));
  act(chosen,{action:'answer_direction',optionId:chosen.studio.request.directionProposal.options[0].id},{staff:false});
  assert.equal(chosen.studio.strategy.data.castingSelection.modelId,'F03');assert.equal(chosen.studio.strategy.data.castingSelection.personaRef,undefined);
  // 모델 없이 보낸 방향을 고르면 인물을 그대로 둔다.
  const kept=room({answers:{modelChoice:'persona'},casting:{personaRef:REF}});
  act(kept,direction(),{personas:()=>{}});
  act(kept,{action:'answer_direction',optionId:kept.studio.request.directionProposal.options[1].id},{staff:false});
  assert.deepEqual(kept.studio.strategy.data.castingSelection.personaRef,REF);
});

test('확인 때 옮기기: 고른 모델의 헤어는 그 모델이 제작 설계의 모델일 때만, 인물이 붙어 있으면 카탈로그 모델을 넣지 않는다',()=>{
  const base=emptyStrategy();
  const a={...emptyRequestAnswers(),models:['F02'],hair:'look-2'};
  assert.equal(carryToStrategy(base,a,stamp).data.castingSelection.hair,'look-2');
  const other={...base,revision:1,data:{...base.data,castingSelection:{...base.data.castingSelection,modelId:'M01'}}};
  assert.equal(carryToStrategy(other,a,stamp).data.castingSelection.hair,'','다른 모델의 헤어 번호는 뜻이 다르다');
  const persona={...base,revision:1,data:{...base.data,castingSelection:{...base.data.castingSelection,personaRef:REF}}};
  const carried=carryToStrategy(persona,a,stamp).data.castingSelection;
  assert.equal(carried.modelId,'');assert.deepEqual(carried.personaRef,REF);
});

test('제작 설계 저장은 인물 참조를 받지 않고 지금 값을 지킨다 — 옛 화면이 안 보내도, 화면이 값을 보내도',()=>{
  const strategy={...emptyStrategy(),revision:1,data:{...emptyStrategy().data,castingSelection:{...emptyStrategy().data.castingSelection,personaRef:REF}}};
  const saved=applyStrategyAction(strategy,{action:'save_strategy',strategy:{castingSelection:{modelId:'F02',hair:'original'}}},stamp);
  assert.deepEqual(saved.data.castingSelection.personaRef,REF);assert.equal(saved.data.castingSelection.modelId,'F02');
  const forged=applyStrategyAction(strategy,{action:'save_strategy',strategy:{castingSelection:{modelId:'',personaRef:{personaId:REF.revisionId,revisionId:REF.personaId}}}},stamp);
  assert.equal(forged,strategy,'바꾼 칸이 없으면 새 버전도 없다 — 보낸 인물 참조는 바꾼 것이 아니다');
  const view=strategyView(saved);assert.deepEqual(view.data.castingSelection.personaRef,REF,'손님 보기에도 실린다');
  assert.equal(Object.hasOwn(strategyView(emptyStrategy()).data.castingSelection,'personaRef'),false,'옛 프로젝트의 모양은 그대로');
  assert.throws(()=>applyStrategyAction(strategy,{action:'save_strategy',strategy:{castingSelection:{modelId:'P-1'}}},stamp),/모델과 스타일 선택값/,'인물 ID를 모델 칸에 넣을 수 없다');
});

test('인물 파일은 백업 목록에 오르고, 지운 자료(묘비)는 건너뛰며, 모양이 틀리면 백업을 멈춘다',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE documents(kind TEXT,id TEXT,body TEXT)');
  const put=(kind,id,body)=>db.prepare('INSERT INTO documents VALUES (?,?,?)').run(kind,id,JSON.stringify(body));
  const name=n=>`${String(n).repeat(8)}-0000-4000-8000-000000000000.png`;
  put('pulsePersonaSources','s1',{id:'s1',personaId:'p',purpose:'identity',diskName:name(1)});
  put('pulsePersonaSources','s2',{id:'s2',personaId:'p',purpose:'mood',deletedAt:AT});
  put('pulsePersonaRevisions','r1',{id:'r1',personaId:'p',revision:1,status:'published',assets:[{diskName:name(2)},{diskName:name(3)}]});
  put('pulsePersonaRevisions','r2',{id:'r2',personaId:'p',revision:2,status:'retired',deletedAt:AT,assets:[]});
  assert.deepEqual(workspaceMediaNames(db).sort(),[name(1),name(2),name(3)].sort());
  assert.deepEqual([...PERSONA_MEDIA_KINDS],['pulsePersonaSources','pulsePersonaRevisions']);
  assert.throws(()=>personaMediaOf('pulsePersonaSources',{id:'s3'}),/전용 인물 사진 기록/);
  assert.throws(()=>personaMediaOf('pulsePersonaRevisions',{id:'r3'}),/전용 인물 판의 파일 기록/);
  assert.throws(()=>personaMediaOf('pulsePersonaRevisions',{id:'r3',assets:[{}]}),/전용 인물 판의 파일 기록/);
  put('pulsePersonaRevisions','r4',{id:'r4',assets:[{diskName:''}]});
  assert.throws(()=>workspaceMediaNames(db),/전용 인물 판의 파일 기록/,'모르는 꼴이면 조용히 빼지 않고 백업을 멈춘다');
});

test('스위치 값 읽기 · 프로젝트 언어',()=>{
  assert.deepEqual(readPulseFeatures(null),{publicLocales:['ko'],projectLocales:['ko'],personaRequest:false,personaReal:false,myModels:false});
  assert.deepEqual(readPulseFeatures({projectLocales:['ko','en'],publicLocales:['ko','en'],personaRequest:true,personaReal:true,myModels:true}),{publicLocales:['ko','en'],projectLocales:['ko','en'],personaRequest:true,personaReal:true,myModels:true});
  assert.equal(readPulseFeatures({personaRequest:false,personaReal:true}).personaReal,false,'인물 접수가 꺼져 있으면 실제 인물도 꺼진다');
  const f=readPulseFeatures({projectLocales:['ko','en']});
  assert.equal(projectLocaleOf(f,{contactLocale:'en'}),'en');assert.equal(projectLocaleOf(f,{contactLocale:'ja'}),'ko');assert.equal(projectLocaleOf(f,undefined),'ko');
  assert.deepEqual([...DICTIONARY_LOCALES],['ko','en'],'일본어는 구조만 — 사전이 생기기 전에는 켤 수 없다');assert.deepEqual([...LOCALES],['ko','en','ja']);
});
