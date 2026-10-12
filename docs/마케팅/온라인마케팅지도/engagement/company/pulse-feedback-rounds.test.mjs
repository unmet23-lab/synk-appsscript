import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFeedbackRoundAction,feedbackRoundActions,feedbackRoundsView} from './pulse-feedback-rounds.mjs';
import {feedbackRoundsPanel,feedbackRoundSubmission} from './public/pulse-app/feedback-rounds-view.mjs';

const customer={author:'customer',authorId:'customer',authorName:'합성 고객',at:'2026-10-12T10:00:00.000Z'};
const staff={author:'staff',authorId:'private-staff-id',authorName:'합성 담당자',at:'2026-10-12T10:10:00.000Z'};
const fixture=()=>({studio:{existing:'preserve'},row:{id:'project',customerName:'합성 고객',stage:'review',revision:4,versions:[{id:'v1',kind:'preview',label:'확인용 시안 1',approvedAt:null}],messages:[]}});
const act=(f,input,asStaff=false)=>applyFeedbackRoundAction({...f,input,staff:asStaff,stamp:asStaff?staff:customer});
const view=(f,asStaff=false)=>feedbackRoundsView(f.studio,f.row,asStaff);
const rejects=(run,status)=>assert.throws(run,error=>error.status===status);
function add(f,text='제품 이름을 더 오래 보여 주세요.',seconds=2.5,extra={}){act(f,{action:'save_feedback_draft',versionId:'v1',text,seconds,...extra});return view(f).drafts.find(draft=>draft.current);}
function submit(f,draft=view(f).drafts.find(value=>value.current),extra={}){act(f,{action:'submit_feedback_round',versionId:'v1',draftId:draft.id,representativeName:'합성 취합 담당자',confirmed:true,...extra});return view(f).rounds.at(-1);}
function classify(f,round=view(f).rounds.at(-1),extra={}){act(f,{action:'classify_feedback_round',roundId:round.id,itemId:round.items[0].id,classification:'included',scopeNote:'제품 이름의 노출 시간을 조정합니다.',scheduleNote:'합의한 전달일을 유지합니다.',...extra},true);return view(f).rounds.at(-1);}

test('the action contract rejects unknown actions and never shares its mutable field list',()=>{
  assert.equal(feedbackRoundActions('unknown'),null);
  assert.equal(feedbackRoundActions('__proto__'),null);
  const fields=feedbackRoundActions('submit_feedback_round');fields.push('forged');assert.equal(feedbackRoundActions('submit_feedback_round').includes('forged'),false);
  const f=fixture();rejects(()=>act(f,{action:'save_feedback_draft',versionId:'v1',text:'valid',forged:true}),400);assert.equal(f.studio.feedbackRounds,undefined);
});

test('legacy projects project an empty collection without modifying existing source',()=>{
  const f=fixture(),before=structuredClone(f);assert.deepEqual(view(f).drafts,[]);assert.deepEqual(view(f).rounds,[]);assert.equal(view(f).nextNumber,1);assert.deepEqual(f,before);
  f.row.versions=[];assert.equal(view(f).canDraft,false);assert.equal(view(f).latestVersionId,'');
});

test('drafts can be saved and corrected without sending messages or exposing them to staff',()=>{
  const f=fixture(),draft=add(f,'PRIVATE CUSTOMER DRAFT',0);
  assert.equal(f.row.messages.length,0);assert.equal(draft.items[0].seconds,0);
  act(f,{action:'save_feedback_draft',draftId:draft.id,versionId:'v1',itemId:draft.items[0].id,text:'수정한 초안',seconds:null});
  assert.equal(view(f).drafts[0].items.length,1);assert.equal(view(f).drafts[0].items[0].text,'수정한 초안');
  const projected=view(f,true);assert.equal(Object.hasOwn(projected,'drafts'),false);assert.doesNotMatch(JSON.stringify(projected),/PRIVATE|수정한 초안/);
  assert.equal(f.studio.existing,'preserve');
});

test('only customers save, remove and submit drafts; only staff classify submitted feedback',()=>{
  const f=fixture();rejects(()=>act(f,{action:'save_feedback_draft',versionId:'v1',text:'초안'},true),403);
  const draft=add(f);
  rejects(()=>act(f,{action:'remove_feedback_draft_item',draftId:draft.id,itemId:draft.items[0].id},true),403);
  rejects(()=>act(f,{action:'submit_feedback_round',draftId:draft.id,versionId:'v1',representativeName:'고객',confirmed:true},true),403);
  const round=submit(f);
  rejects(()=>act(f,{action:'classify_feedback_round',roundId:round.id,itemId:round.items[0].id,classification:'correction',scopeNote:'정정',scheduleNote:'유지'}),403);
});

test('text and video time validation rejects malformed values without leaving partial drafts',()=>{
  for(const extra of [{text:''},{text:' '},{text:'x'.repeat(3001)},{text:'bad\0value'},{seconds:-1},{seconds:86401},{seconds:NaN},{seconds:Infinity},{seconds:'1.5'}]){const f=fixture();rejects(()=>add(f,'본문',1,extra),400);assert.equal(f.studio.feedbackRounds,undefined);assert.deepEqual(f.row.messages,[]);}
  const f=fixture();assert.equal(add(f,'  본문  ',86400).items[0].text,'본문');
});

test('item deletion removes only that draft item and discards an empty draft',()=>{
  const f=fixture(),first=add(f,'첫 의견'),second=add(f,'둘째 의견');
  act(f,{action:'remove_feedback_draft_item',draftId:first.id,itemId:first.items[0].id});
  assert.equal(view(f).drafts[0].items.length,1);assert.equal(view(f).drafts[0].items[0].text,'둘째 의견');
  act(f,{action:'remove_feedback_draft_item',draftId:first.id,itemId:second.items[1].id});
  assert.deepEqual(view(f).drafts,[]);assert.deepEqual(f.row.messages,[]);
});

test('a new preview preserves old customer drafts but cannot silently retarget or submit them',()=>{
  const f=fixture(),draft=add(f);f.row.versions.push({id:'v2',kind:'preview',label:'새 시안',approvedAt:null});
  assert.equal(view(f).drafts[0].canSubmit,false);
  rejects(()=>submit(f,draft),409);
  rejects(()=>submit(f,draft,{versionId:'v2'}),409);
  rejects(()=>add(f,'새 의견',1,{draftId:draft.id,versionId:'v2'}),409);
  add(f,'새 시안에 맞춘 의견',3,{versionId:'v2'});
  assert.equal(view(f).drafts.length,2);assert.equal(view(f).drafts.filter(value=>value.current).length,1);
  assert.equal(view(f).drafts[0].items[0].text,draft.items[0].text);assert.deepEqual(f.row.messages,[]);
});

test('approved previews block draft mutation and submission but allow clearing saved drafts',()=>{
  const f=fixture(),draft=add(f);f.row.versions[0].approvedAt=customer.at;
  assert.equal(view(f).canDraft,false);rejects(()=>add(f),409);rejects(()=>submit(f,draft),409);
  act(f,{action:'remove_feedback_draft_item',draftId:draft.id,itemId:draft.items[0].id});assert.deepEqual(view(f).drafts,[]);
});

test('submission requires a named representative and an explicit boolean confirmation',()=>{
  for(const extra of [{representativeName:''},{representativeName:' '},{representativeName:'x'.repeat(101)},{confirmed:false},{confirmed:'true'},{confirmed:1}]){const f=fixture(),draft=add(f),before=structuredClone(f);rejects(()=>submit(f,draft,extra),400);assert.deepEqual(f,before);}
});

test('one explicit submission creates one round and linked legacy feedback messages for every item',()=>{
  const f=fixture();add(f,'첫 의견',0);const draft=add(f,'둘째 의견',null),round=submit(f,draft);
  assert.equal(round.number,1);assert.equal(round.items.length,2);assert.equal(round.representativeName,'합성 취합 담당자');assert.equal(round.confirmed,true);
  assert.deepEqual(view(f).drafts,[]);assert.equal(f.row.messages.length,2);
  for(const [index,message] of f.row.messages.entries()){
    assert.equal(message.action,'feedback');assert.equal(message.visibility,'customer');assert.equal(message.author,'customer');assert.equal(message.versionId,'v1');assert.equal(message.resolved,false);
    assert.equal(message.feedbackRoundId,round.id);assert.equal(message.id,round.items[index].messageId);assert.equal(message.feedbackItemId,round.items[index].id);
  }
  assert.equal(f.row.messages[0].seconds,0);assert.equal(f.row.messages[1].seconds,null);
  assert.equal(view(f,true).rounds[0].items[0].text,'첫 의견');
});

test('a repeated submission cannot create duplicate messages or count another round',()=>{
  const f=fixture(),draft=add(f);submit(f,draft);const before=structuredClone(f);
  rejects(()=>submit(f,draft),409);assert.deepEqual(f,before);
  add(f,'추가 취합 의견');assert.equal(submit(f).number,2);assert.equal(f.row.messages.length,2);
});

test('batch submission checks the legacy message capacity before changing either source',()=>{
  const f=fixture();f.row.messages=Array.from({length:299},(_,i)=>({id:'message-'+i,author:'staff',text:'기존 내용'}));add(f,'첫 의견');const draft=add(f,'둘째 의견'),before=structuredClone(f);
  rejects(()=>submit(f,draft),409);assert.deepEqual(f,before);
  f.row.messages[0]={author:'customer',action:'approve'};submit(f,draft);assert.equal(f.row.messages.length,301);
  assert.equal(f.row.messages.filter(value=>value.action!=='approve').length,300);
});

test('draft item limits and forged item identifiers cannot corrupt saved drafts',()=>{
  const f=fixture();for(let i=0;i<20;i++)add(f,'의견 '+i);const before=structuredClone(f);
  rejects(()=>add(f,'21번째 의견'),409);assert.deepEqual(f,before);
  const draft=view(f).drafts[0];rejects(()=>add(f,'변경',1,{draftId:draft.id,itemId:'missing-item'}),404);assert.deepEqual(f,before);
  rejects(()=>act(f,{action:'remove_feedback_draft_item',draftId:draft.id,itemId:'missing-item'}),404);assert.deepEqual(f,before);
});

test('submitted content is immutable and classification never resolves or reprices the request',()=>{
  const f=fixture(),draft=add(f),round=submit(f,draft),message=structuredClone(f.row.messages[0]);
  rejects(()=>add(f,'바꾼 제출문',1,{draftId:draft.id,itemId:draft.items[0].id}),409);
  const classified=classify(f,round,{classification:'direction_change',scopeNote:'새로운 스토리 요청으로 추가 범위를 협의합니다.',scheduleNote:'협의 후 일정을 정합니다.'});
  assert.equal(classified.items[0].text,round.items[0].text);assert.equal(classified.items[0].classification.classification,'direction_change');
  assert.deepEqual(f.row.messages[0],message);assert.equal(classified.items[0].resolved,false);assert.equal(f.row.dueDate,undefined);assert.equal(f.row.terms,undefined);
  assert.doesNotMatch(JSON.stringify(view(f)),/private-staff-id|authorId/);
});

test('classification requires explicit scope and schedule notes and preserves prior public explanations',()=>{
  const f=fixture();add(f);const round=submit(f);
  for(const extra of [{classification:'free'},{classification:'__proto__'},{scopeNote:''},{scheduleNote:''},{scopeNote:'x'.repeat(1501)},{scheduleNote:'x'.repeat(1001)}]){const before=structuredClone(f);rejects(()=>classify(f,round,extra),400);assert.deepEqual(f,before);}
  classify(f,round,{classification:'correction'});const changed=classify(f,round,{classification:'included',scopeNote:'고객과 확인한 뒤 범위를 정정했습니다.'});
  assert.equal(changed.items[0].classificationHistory.length,2);assert.equal(changed.items[0].classificationHistory[0].classification,'correction');assert.equal(changed.items[0].classification.classification,'included');
});

test('round progress follows authoritative legacy resolution instead of becoming a second workflow',()=>{
  const f=fixture();add(f);submit(f);assert.equal(view(f).rounds[0].items[0].resolved,false);
  f.row.messages[0].resolved=true;assert.equal(view(f).rounds[0].items[0].resolved,true);
  f.row.messages[0].resolved=false;assert.equal(view(f).rounds[0].items[0].resolved,false);
});

test('archived projects reject writes from either side',()=>{
  const f=fixture(),draft=add(f),round=submit(f,draft);f.row.stage='archived';
  assert.equal(view(f).canDraft,false);rejects(()=>add(f),409);rejects(()=>classify(f,round),409);
});

test('safe projection never exposes arbitrary extensions or classification actor IDs',()=>{
  const f=fixture();add(f);submit(f);classify(f);
  f.studio.feedbackRounds.internal='SECRET';f.studio.feedbackRounds.rounds[0].internal='SECRET';f.studio.feedbackRounds.rounds[0].items[0].internal='SECRET';
  for(const asStaff of [false,true])assert.doesNotMatch(JSON.stringify(view(f,asStaff)),/SECRET|private-staff-id|authorId/);
});

test('customer UI renders private drafts, exact version forms and separate submit confirmation',()=>{
  const f=fixture();const draft=add(f,'<script>alert(1)</script>');const html=feedbackRoundsPanel({mode:'customer',versionId:'v1',project:{...f.row,studio:{feedbackRounds:view(f)}}});
  assert.match(html,/data-form="round-draft"/);assert.match(html,/data-form="round-submit"/);assert.match(html,new RegExp(`data-draft-id="${draft.id}"`));assert.match(html,/name="representativeName"/);assert.match(html,/name="confirmed"[^>]+required/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.match(html,/data-id="new:v1" data-item-id=""/);
  const olderHtml=feedbackRoundsPanel({mode:'customer',versionId:'old',project:{...f.row,studio:{feedbackRounds:view(f)}}});assert.doesNotMatch(olderHtml,/data-form="round-draft"/);assert.doesNotMatch(olderHtml,/data-form="round-submit"/);
});

test('staff UI has public classification forms without private draft content or customer submission',()=>{
  const f=fixture();add(f,'제출한 의견');submit(f);add(f,'PRIVATE CUSTOMER DRAFT');
  const html=feedbackRoundsPanel({mode:'staff',canEdit:true,project:{...f.row,studio:{feedbackRounds:view(f,true)}}});
  assert.match(html,/data-form="round-classify"/);assert.doesNotMatch(html,/PRIVATE CUSTOMER DRAFT|data-form="round-draft"|data-form="round-submit"/);
  const readOnly=feedbackRoundsPanel({mode:'staff',canEdit:false,project:{...f.row,studio:{feedbackRounds:view(f,true)}}});assert.doesNotMatch(readOnly,/data-form="round-classify"/);
});

test('form payloads retain exact version bindings and explicit submit confirmation',()=>{
  const Original=globalThis.FormData;globalThis.FormData=class{constructor(form){return new Map(Object.entries(form.values));}};
  try{
    const form={dataset:{form:'round-draft',id:'new',draftId:'draft',versionId:'v1'},values:{text:'의견',seconds:'0'}};
    assert.deepEqual(feedbackRoundSubmission(form),{action:'save_feedback_draft',draftId:'draft',versionId:'v1',itemId:'',text:'의견',seconds:0});
    form.dataset.id='new:v1';form.dataset.itemId='';assert.equal(feedbackRoundSubmission(form).itemId,'');assert.equal(feedbackRoundSubmission(form).versionId,'v1');
    form.values.seconds='';assert.equal(feedbackRoundSubmission(form).seconds,null);
    const submitForm={dataset:{form:'round-submit',id:'draft',versionId:'v1'},values:{representativeName:'대표'}};assert.equal(feedbackRoundSubmission(submitForm).confirmed,false);submitForm.values.confirmed='yes';assert.equal(feedbackRoundSubmission(submitForm).confirmed,true);
    assert.deepEqual(feedbackRoundSubmission({dataset:{form:'round-classify',roundId:'round',itemId:'item'},values:{classification:'correction',scopeNote:'정정',scheduleNote:'유지'}}),{action:'classify_feedback_round',roundId:'round',itemId:'item',classification:'correction',scopeNote:'정정',scheduleNote:'유지'});
    assert.equal(feedbackRoundSubmission({dataset:{form:'other'},values:{}}),null);
  }finally{globalThis.FormData=Original;}
});
