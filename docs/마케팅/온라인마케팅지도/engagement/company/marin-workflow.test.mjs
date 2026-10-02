import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantService,declaredWorkDraft} from './assistant-service.mjs';

const user={id:'self',name:'유호',role:'admin',active:true};
function serviceFixture(){
  const directoryCalls=[],members=[{id:'self-messenger',companyUserId:'self',name:'유호'},{id:'other-messenger',companyUserId:'other',name:'민지'}];
  const service=createAssistantService({today:()=> '2026-09-30',performance:()=>{throw new Error('work-profile proposals must not derive abilities from performance records');},directory:(request,options)=>{directoryCalls.push(options);assert.equal(options,undefined,'profile proposals only need the existing active name directory, never files/tasks/DM content');return{members,channels:[]};}});
  return{answer:(message,role='admin')=>service.answer({...user,role},{message},{}),directoryCalls};
}

test('explicit first-person work statements become confirmation drafts without implying ability, consent or storage',()=>{
  const f=serviceFixture(),result=f.answer('나는 디자인을 좋아하고 주 10시간 가능해');
  assert.equal(result.intent,'profile');assert.deepEqual(result.actions[0].draft,{preferredTasks:['design'],availableHours:10});assert.equal(result.actions[0].type,'profile');assert.equal(result.actions[0].draft.skills,undefined);assert.equal(result.actions[0].draft.participates,undefined);assert.equal(result.actions[0].draft.confirmed,undefined);assert.match(result.text,/아직 저장하지/);assert.equal(result.generative,false);assert.equal(result.externalCalls,false);
  assert.deepEqual(declaredWorkDraft('나는 영상 편집을 잘해. 나는 디자인을 좋아해'),{skills:['video-editing'],preferredTasks:['design']});
  assert.deepEqual(declaredWorkDraft('나는디자인을좋아하고주10시간가능해'),{preferredTasks:['design'],availableHours:10});
});

test('negative statements and statements about another crew never become the current user work profile',()=>{
  for(const message of ['나는 디자인은 싫어','나는 디자인을 못해','나는 디자인 경험 없어','나는 디자인에 관심만 있고 잘하지 못해','민지는 영상 편집을 잘해','민지가 디자인을 잘한다고 기억해 줘','나는 민지처럼 영상 편집을 잘해']){
    assert.deepEqual(declaredWorkDraft(message,['민지']),{},message);const result=serviceFixture().answer(message);assert.ok(result.actions.every(action=>!action.draft||Object.keys(action.draft).length===0),message);
  }
});

test('personality and sensitive statements do not infer skills, communication, work mode or teammate suitability',()=>{
  for(const message of ['나는 내향적이야','나는 우울해','나는 MBTI가 ENFP야','나는 외향적이라 영상 촬영을 잘해','나는 불안하지만 디자인을 좋아해','내 종교에 맞는 팀을 추천해 줘']){
    const f=serviceFixture(),result=f.answer(message);assert.deepEqual(declaredWorkDraft(message),{},message);assert.equal(result.actions.some(action=>action.draft),false,message);assert.equal(result.actions.some(action=>action.type==='team-builder'),false,message);assert.equal(f.directoryCalls.length,0,'sensitive claims are not enriched with colleague records');assert.match(result.text,/추론하지/);
  }
});

test('a manual team review opens only an allowed screen, and profile delete requests do not mutate records',()=>{
  for(const role of ['admin','manager','member','viewer']){
    const f=serviceFixture(),result=f.answer('이번 프로젝트 팀을 추천하고 구성해 줘',role);assert.equal(result.actions.length,1);assert.equal(result.actions[0].type,['admin','manager'].includes(role)?'team-builder':'profile');assert.equal(result.data,undefined);assert.equal(result.actions[0].memberIds,undefined);assert.equal(f.directoryCalls.length,0,'opening the builder does not select or inspect people');
  }
  for(const message of ['내 업무 카드 삭제해 줘','내 업무 프로필 공유를 철회해 줘']){const result=serviceFixture().answer(message);assert.equal(result.actions[0].type,'profile');assert.equal(result.actions[0].draft,undefined);assert.match(result.text,/직접 확인/);}
});

test('half-hour self-reported availability is preserved in the confirmation draft',()=>{
  assert.deepEqual(declaredWorkDraft('나는 주 10.5시간 가능해'),{availableHours:10.5});
  assert.deepEqual(declaredWorkDraft('나는 주 0.5시간 가능해'),{availableHours:0.5});
  assert.deepEqual(declaredWorkDraft('나는 주 0시간 가능해'),{availableHours:0});
});
