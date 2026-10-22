import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {normalizeCastingSelection,normalizeStrategyData} from './pulse-strategy.mjs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {readCastingCode,intakeCastingText,castingCodeBox,castingCodeResult,castingCodeLabel,normalizeDemoCasting,castingView} from './public/pulse-app/casting-view.mjs';
import {strategyView,castingCodeSaveMessage,strategyReviewState} from './public/pulse-app/strategy-view.mjs';

// 캐스팅북 문의 → 제작 설계(2026-10-19): 고객이 캐스팅북에서 고른 모델·헤어·목소리가 담긴 문의 글을 담당자가 붙여 넣으면
// 그 조합이 프로젝트에 저장되어 고객은 처음 열 때 그 조합을 본다. 캐스팅북 쪽 짝 시험은 저장소 tests/pulse-casting-code.test.mjs.
const appDir=new URL('./public/pulse-app/',import.meta.url);
// 손님이 캐스팅북에서 「누구로 진행할까요?」를 지유로 고르고 보낸 크몽 문의 글(10-19 2차 — 코드 줄 없음).
const KMONG=`안녕하세요. PULSE 모델 캐스팅북을 보고 문의드려요.

[진행하고 싶은 모델]
1. F04 지유 (여 · 20대 초반 · 상큼 · 166cm)
   헤어 1번 기본 · 긴 흑발 생머리 / 목소리 3번 가까이 속삭이는
   메모: 헤어 3번처럼 묶는 것도 보고 싶어요

[함께 고민 중인 모델]
2. F02 하린 (여 · 20대 초반 · 상큼 · 165cm)
   헤어 2번 하이 포니테일 / 목소리 1번 밝고 상큼한

[광고 내용]
제품·서비스: 딸기 라떼 신메뉴

상담에서 함께 정하고 싶은 것: 사용 매체와 기간, 업종 전속 여부, 사진·영상 수량`;
// 고르지 않았을 때(여러 명) — 그리고 예전 판처럼 [고른 모델] 아래 줄만 있는 글.
const UNDECIDED=`[고른 모델]
1. F02 하린 (여 · 20대 초반 · 상큼 · 165cm)
   헤어 2번 하이 포니테일 / 목소리 1번 밝고 상큼한
2. F04 지유 (여 · 20대 초반 · 상큼 · 166cm)
   헤어 1번 기본 · 긴 흑발 생머리 / 목소리 3번 가까이 속삭이는

[함께 비교한 모델] M01 이안

상담에서 함께 정하고 싶은 것: 진행할 모델, 사용 매체와 기간`;
const ORDER=`[진행할 모델] M02 태준 (남 · 30대 후반 · 섹시 · 183cm)
헤어: 3번 짧은 크롭컷
대사: 오늘 밤, 한 잔의 깊이를
[함께 고민 중인 모델] F05 소연 (여 · 30대 중반)
헤어: 1번 기본
목소리: 2번 차분한
[광고] 프리미엄 위스키`;
const picks=text=>readCastingCode(text).items.map(item=>[item.modelId,item.hair,item.voice,item.lead]);

test('the inquiry the client sends reads into the app values, with the model the client chose first',()=>{
  assert.deepEqual(picks(KMONG),[['F04','original','C',true],['F02','look-2','A',false]],'numbers in people lines start at 1; a memo saying 헤어 3번 does not override');
  assert.deepEqual(picks(UNDECIDED),[['F02','look-2','A',false],['F04','original','C',false]],'compared-only models are not picks');
  const order=readCastingCode(ORDER);
  assert.deepEqual(order.unknown,['F05'],'a model the casting book added before the app is reported, not guessed');assert.deepEqual(picks(ORDER),[['M02','look-3','',true]],'a missing voice stays open');
  const [missing]=order.items;assert.equal(missing.code,'M02.2.9');assert.deepEqual(readCastingCode(missing.code).items[0],{...missing,lead:false},'the button code reads back to the same open choice');
  assert.deepEqual(picks('1. F02 하린\n   헤어 9번 / 목소리 7번'),[['F02','','',false]]);
  for(const noise of ['','F02','F2.1.0','F002.1.0','AF02.1.0','F02.1.0x','F02.1.0.5','v1.2.3','1.0.0','1. 제품 소개','[함께 비교한 모델] F02 하린',null,undefined])assert.deepEqual(readCastingCode(noise),{items:[],unknown:[],codes:[]},String(noise));
});

test('codes still read: the casting book share link, older inquiries and typing by hand',()=>{
  assert.deepEqual(readCastingCode('F02.1.0'),{items:[{modelId:'F02',hair:'look-2',voice:'A',code:'F02.1.0',lead:false}],unknown:[],codes:['F02.1.0']});
  assert.deepEqual(readCastingCode('https://synk.example/casting/#p-M03.2.2~M01.0.1').items.map(item=>item.code),['M03.2.2','M01.0.1'],'a shared package link works too');
  assert.deepEqual(readCastingCode(`${UNDECIDED}\n\n캐스팅북 코드: F04.0.2, F02.1.0`).items.map(item=>item.code),['F02.1.0','F04.0.2'],'an older inquiry with the code line reads its people lines; codes are only the fallback');
  assert.deepEqual(picks('f02.1.0'),[['F02','look-2','A',false]],'typed in lower case');
  assert.deepEqual(readCastingCode('F02.7.9').items[0].hair,'','numbers out of range leave only that choice open');
  assert.deepEqual(readCastingCode('F02.1.0~F02.2.1').items.map(item=>item.code),['F02.1.0'],'one row per model, first wins');
  assert.equal(readCastingCode(Array.from({length:12},(_,index)=>`${CASTING_MODELS[index%7].id}.0.0`).join('~')).items.length,7);
  assert.equal(castingCodeLabel(readCastingCode('F02.1.0').items[0]),'하린 · 헤어 2 하이 포니테일 · 목소리 A 밝고 상큼한');
});

test('an inquiry the client edited by hand still reads safely',()=>{
  // 「[함께 고민 중인 모델]」 머리줄과 빈 줄을 지운 글: 진행하고 싶은 모델은 첫 모델 하나뿐이다.
  const trimmed=KMONG.replace('\n\n[함께 고민 중인 모델]','');
  assert.deepEqual(picks(trimmed),[['F04','original','C',true],['F02','look-2','A',false]]);
  assert.doesNotMatch(castingCodeResult({text:trimmed}),/고객이 고른 모델[\s\S]*고객이 고른 모델/,'one badge');
  // 메모를 헤어 줄보다 먼저 적은 글: 메모 속 「헤어 3번」을 고른 번호로 읽지 않는다. 대사·들어 보고 싶은 문장도 같다.
  assert.deepEqual(picks('[진행하고 싶은 모델]\n1. F04 지유\n   메모: 헤어 3번처럼 묶은 것도 보고 싶어요\n   헤어 1번 기본 / 목소리 3번 가까이 속삭이는'),[['F04','original','C',true]]);
  assert.deepEqual(picks('[진행할 모델] M02 태준\n대사: 목소리 1번처럼 낮게, 헤어 2번은 싫어요\n헤어: 3번 짧은 크롭컷\n목소리: 2번 단단하고 또렷한'),[['M02','look-3','B',true]]);
  assert.deepEqual(picks('1. F02 하린\n   이 목소리로 들어 보고 싶은 문장: “목소리 3번 말고 이걸로”\n   헤어 2번 / 목소리 1번'),[['F02','look-2','A',false]]);
  // 공유 주소가 함께 붙은 문의 글: 손님이 고른 순서가 담긴 사람 글 줄이 이긴다.
  assert.deepEqual(picks(`${KMONG}\n\n공유 링크: https://synk.example/casting/#p-M03.0.0`),picks(KMONG));
});

test('every hair and voice the casting book can send is a value the server and the demo accept',()=>{
  for(const model of CASTING_MODELS)for(const hair of [0,1,2])for(const voice of [0,1,2]){
    const [item]=readCastingCode(`${model.id}.${hair}.${voice}`).items,selection={modelId:item.modelId,hair:item.hair,voice:item.voice};
    assert.equal(item.hair,['original','look-2','look-3'][hair]);assert.equal(item.voice,['A','B','C'][voice]);
    assert.deepEqual(normalizeCastingSelection(selection),{...normalizeCastingSelection({}),...selection});
    assert.deepEqual(normalizeDemoCasting(selection),normalizeCastingSelection(selection));
    const [line]=readCastingCode(`1. ${model.id} ${model.name}\n   헤어 ${hair+1}번 / 목소리 ${voice+1}번`).items;assert.deepEqual([line.hair,line.voice],[item.hair,item.voice],'people lines and codes point at the same choice');
  }
});

test('an imported brief carries the picks to the staff box as short people lines, the client choice first',()=>{
  const text=intakeCastingText({reportText:`[표현·장면]\n장면·모델 메모:\n${KMONG}`});
  assert.equal(text,'[진행하고 싶은 모델]\n1. F04 지유\n   헤어 1번 기본 · 긴 흑발 생머리 / 목소리 3번 가까이 속삭이는\n\n[함께 고민 중인 모델]\n2. F02 하린\n   헤어 2번 하이 포니테일 / 목소리 1번 밝고 상큼한');
  assert.deepEqual(picks(text),picks(KMONG),'and the box reads them back the same');
  assert.equal(intakeCastingText({reportText:ORDER}),'[진행하고 싶은 모델]\n1. M02 태준\n   헤어 3번 짧은 크롭컷\n\n[함께 고민 중인 모델]\n2. F05');
  assert.deepEqual(readCastingCode(intakeCastingText({reportText:ORDER})).unknown,['F05'],'a model the app does not have yet still shows as not available');
  assert.equal(intakeCastingText({reportText:'장면·모델 메모: 캐스팅북 코드: F02.1.0',notes:''}),'[고른 모델]\n1. F02 하린\n   헤어 2번 하이 포니테일 / 목소리 1번 밝고 상큼한');
  for(const intake of [null,undefined,{},{reportText:'모델은 상담으로 정해요.'},{reportText:42}])assert.equal(intakeCastingText(intake),'');
});

test('the staff box shows what will be saved and never sends its text with the plan',()=>{
  const empty=castingCodeBox();assert.match(empty,/캐스팅북 문의로 채우기/);assert.doesNotMatch(empty,/ open/);assert.match(empty,/문의 글을 통째로 붙여 넣어 주세요/);
  assert.doesNotMatch(empty,/<textarea[^>]*\sname=/,'no name: FormData must not send it to save_strategy');
  assert.throws(()=>normalizeStrategyData({castingCode:'F02.1.0'}),/제작 설계 입력 항목/,'the server would reject an unknown plan field');
  const two=castingCodeBox({text:KMONG});assert.match(two,/<details class="casting-code" open>/);
  assert.equal((two.match(/data-action="casting-code-save"/g)||[]).length,2);assert.match(two,/data-code="F04\.0\.2"[\s\S]*data-code="F02\.1\.0"/,'the client choice first');
  assert.match(two,/casting-code-item is-lead[\s\S]*지유[\s\S]*고객이 고른 모델/);assert.equal((two.match(/고객이 고른 모델/g)||[]).length,1);
  assert.match(two,/고객은 지유로 진행하고 싶어 해요\./);
  assert.match(castingCodeResult({text:UNDECIDED}),/2명이 담겨 있어요\. 고객과 정한 모델을 저장해 주세요\./);assert.doesNotMatch(castingCodeResult({text:UNDECIDED}),/고객이 고른 모델/);
  assert.match(castingCodeResult({text:'1. F02 하린\n   헤어 2번 / 목소리 1번\n\n[진행하고 싶은 모델]\n2. M01 이안'}),/고객은 이안으로 진행하고 싶어 해요/,'으로/로 follows the name');
  assert.doesNotMatch(castingCodeBox({text:KMONG,open:false}),/ open>/,'a box the staff folded stays folded on redraw');assert.match(castingCodeBox({text:'',open:true}),/ open>/,'and one they opened stays open');
  const saved=castingCodeResult({text:'F02.1.0',saved:{modelId:'F02',hair:'look-2',voice:'A'}});assert.match(saved,/지금 저장된 조합/);assert.doesNotMatch(saved,/casting-code-save/);
  assert.match(castingCodeResult({text:ORDER}),/작업 공간에 아직 없는 모델\(F05\)은 빼고 읽었어요/);
  assert.doesNotMatch(castingCodeResult({text:'1. F05 소연'}),/casting-code-save/);
  assert.match(castingCodeResult({text:'아무 글'}),/캐스팅북 조합을 찾지 못했어요/);
  assert.match(castingCodeResult({text:'F02.1.0',fromIntake:true}),/발주서 접수 글에서 찾은 조합이에요/);
  assert.match(castingCodeResult({text:'F02.1.0',review:'confirmed'}),/고객이 새 버전을 다시 확인해요/);assert.match(castingCodeResult({text:'F02.1.0',review:'requested'}),/요청이 취소되니/);
  const hostile=castingCodeBox({text:'</textarea><img src=x onerror=alert(1)> F02.1.0'});assert.doesNotMatch(hostile,/<img src=x/);assert.match(hostile,/&lt;\/textarea&gt;/);
});

test('only an editing staff member sees the box, and an imported brief fills it until a model is saved',()=>{
  const project=(castingSelection={},intake=null)=>({id:'p',revision:3,intake,studio:{strategy:{revision:1,data:{castingSelection},request:null,confirmation:null,history:[]}}});
  const brief={reportText:KMONG},prefill=/\[진행하고 싶은 모델\]\n1\. F04 지유\n[^<]*<\/textarea>/;
  assert.match(strategyView({project:project(),mode:'staff',canEdit:true}),/class="casting-code"/);
  assert.doesNotMatch(strategyView({project:project(),mode:'staff',canEdit:false}),/class="casting-code"/);
  assert.doesNotMatch(strategyView({project:project({},brief),mode:'customer'}),/class="casting-code"/,'the client room has nothing to paste');
  const fromBrief=strategyView({project:project({},brief),mode:'staff',canEdit:true});assert.match(fromBrief,prefill);assert.match(fromBrief,/발주서 접수 글에서 찾은 조합이에요/);assert.match(fromBrief,/<details class="casting-code" open>/);
  assert.doesNotMatch(strategyView({project:project({},brief),mode:'staff',canEdit:true,castingCodeOpen:false}),/<details class="casting-code" open>/,'folded by the staff, it stays folded');
  assert.doesNotMatch(strategyView({project:project({modelId:'M01'},brief),mode:'staff',canEdit:true}),prefill,'a saved model is not offered for overwrite');
  assert.match(strategyView({project:project({},brief),mode:'staff',canEdit:true,castingCode:'M03.0.0'}),/M03\.0\.0<\/textarea>/,'what the staff typed wins');
  assert.doesNotMatch(strategyView({project:project({},brief),mode:'staff',canEdit:true,castingCode:''}),prefill,'a cleared box stays cleared');
});

test('the save notice names the pick, mentions other saved edits and asks for a new review when one was current',()=>{
  const item=readCastingCode('F04.2.1').items[0],before={revision:2,request:null,confirmation:null},after={revision:3,request:null,confirmation:null};
  assert.equal(castingCodeSaveMessage(item,before,after),'캐스팅북 조합을 저장했어요: 지유 · 헤어 3 로우 번 · 목소리 B 차분하고 부드러운. 고객 화면에도 그대로 보여요.');
  assert.equal(castingCodeSaveMessage(item,before,after,{otherEdits:true}),'캐스팅북 조합을 저장했어요: 지유 · 헤어 3 로우 번 · 목소리 B 차분하고 부드러운. 고객 화면에도 그대로 보여요. 다른 칸에서 고친 내용도 함께 저장했어요.');
  assert.match(castingCodeSaveMessage(item,{revision:2,request:{strategyRevision:2},confirmation:{strategyRevision:2}},after),/고객에게 확인을 다시 요청해 주세요/);
  assert.equal(castingCodeSaveMessage(item,before,{...before}),'바뀐 내용이 없어 그대로 두었어요.');
  assert.equal(strategyReviewState({revision:2,request:{strategyRevision:2},confirmation:null}),'requested');assert.equal(strategyReviewState({revision:2,request:{strategyRevision:1},confirmation:{strategyRevision:1}}),'');
});

test('the client room wires the box: save fills the casting form, submits it, and redraws keep an unsaved pick',()=>{
  const app=readFileSync(new URL('app.mjs',appDir),'utf8'),view=readFileSync(new URL('casting-view.mjs',appDir),'utf8');
  assert.match(app,/if\(action==='casting-code-save'\)\{[^\n]*applyCastingItem\(form,item\)[^\n]*form\.requestSubmit\(\)/);
  assert.match(app,/input:invalid,textarea:invalid,select:invalid[^\n]*group\.open=true;invalid\.scrollIntoView\(\{block:'center'\}\);invalid\.reportValidity\(\);[^\n]*return;\}castingCodeSave=/,'an invalid plan field is opened and shown instead of a silent no-op, and no save notice is left behind');
  assert.match(app,/syncCastingChoices\(strategyForm,drafts\.get\(draftKey\(strategyForm\)\)\?\.values\);refreshCasting\(strategyForm\)/,'redraw rebuilds the choices for the unsaved model before refreshing');
  assert.match(app,/castingCodeSaveMessage\(fromCode\.item,before,s\.project\?\.studio\?\.strategy,\{otherEdits:fromCode\.otherEdits\}\)/);
  assert.match(app,/after:\(\)=>\{if\(fromCode\)s\.castingCode=fromCode\.text;\}/,'the saved pick stays in view as 「지금 저장된 조합」');
  assert.match(app,/tab:'strategy',castingCode:null,castingCodeOpen:null\}\);castingCodeSave=null;/,'switching projects forgets the pasted text and the folded state');
  assert.match(app,/document\.addEventListener\('toggle',event=>\{if\(event\.target\?\.matches\?\.\('details\.casting-code'\)\)s\.castingCodeOpen=event\.target\.open;\},true\);/,'folding is remembered (toggle does not bubble, so capture)');
  assert.match(app,/document\.addEventListener\('click',event=>\{const details=event\.target\?\.closest\?\.\('details\.casting-code>summary'\)\?\.parentElement;if\(details\?\.matches\?\.\('details\.casting-code'\)\)s\.castingCodeOpen=!details\.open;\},true\);/,'and at the click itself, since toggle arrives a tick later and is lost if the tab changes first');
  assert.match(app,/if\(castingCodeShown\.get\(result\)!==html\)\{result\.innerHTML=html;castingCodeShown\.set\(result,html\);\}/,'the live region is rewritten only when the reading changes');
  assert.match(app,/otherEdits=!!form&&Object\.keys\(drafts\.get\(draftKey\(form\)\)\?\.values\|\|\{\}\)\.some\(name=>!name\.startsWith\('cast_'\)\)/,'other unsaved plan edits are named in the notice');
  assert.match(view,/pick\('cast_modelId',item\.modelId\)&&pick\('cast_hair',item\.hair\)&&pick\('cast_voice',item\.voice\)/,'model first, then hair and voice, like a person would');
  assert.match(castingView({modelId:'F02'}),/data-choices-model="F02"/);assert.match(castingView({}),/data-choices-model=""/);
  assert.doesNotMatch(view.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n'),/\(\?<[!=]/,'no regex lookbehind: Safari before 16.4 would fail to load the whole client room');
  assert.match(readFileSync(new URL('sw.js',appDir),'utf8'),/const CACHE = 'synk-pulse-shell-v21-photos-films-20261022';/);
});

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-casting-code-'));
  const app=createCompanyApp({dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.match(directory,/synk-pulse-casting-code-/);await rm(directory,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+(await app.start()).port,owner=app.store.createUser({name:'합성 담당자',email:'owner@pulse-casting-code.test',role:'member',teamId:'a'}),token=app.store.mint('session',owner.id,{csrfToken:'code-staff-csrf'},10);
  async function request(path,{body,customer=null,anonymous=false}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(customer?{Cookie:customer.cookie}:anonymous?{}:{Cookie:'synk_company_session='+token}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'code-staff-csrf'})})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();return {status:response.status,headers:response.headers,data:text?JSON.parse(text):null};
  }
  return {request};
}

test('a staff save from the code is what the client sees on first open, and a confirmed plan asks again',async t=>{
  const {request}=await fixture(t);
  let row=(await request('/api/client-projects',{body:{title:'합성 캐스팅북 코드 시험',customerName:'합성 고객',summary:'코드로 모델 채우기',terms:'합성',nextStep:'모델 확인',dueDate:'2026-12-01'}})).data.project;
  const [item]=readCastingCode(KMONG).items,castingSelection={...normalizeCastingSelection({}),modelId:item.modelId,hair:item.hair,voice:item.voice};
  const save=async strategy=>{const result=await request(`/api/client-projects/${row.id}/studio`,{body:{revision:row.revision,action:'save_strategy',strategy}});assert.equal(result.status,200,JSON.stringify(result.data));row=result.data.project;return row.studio.strategy;};
  const first=await save({primaryPromise:'한 잔으로 시작하는 아침',evidence1:'실제 손 장면',desiredAction:'상세 보기',castingSelection});
  assert.deepEqual(first.data.castingSelection,castingSelection);
  const issued=await request(`/api/client-projects/${row.id}/invite`,{body:{revision:row.revision}});assert.equal(issued.status,200);
  const opened=await request('/pulse/api/open',{anonymous:true,body:{invite:issued.data.invite}});assert.equal(opened.status,200);
  const customer={cookie:opened.headers.get('set-cookie').split(';')[0],csrf:opened.data.csrf};
  assert.deepEqual(opened.data.project.studio.strategy.data.castingSelection,castingSelection,'the pick is already there for the client');
  row=(await request(`/api/client-projects/${row.id}/studio`)).data.project;
  const review=await request(`/api/client-projects/${row.id}/studio`,{body:{revision:row.revision,action:'request_strategy_review'}});assert.equal(review.status,200);row=review.data.project;
  const current=(await request('/pulse/api/project',{customer})).data.project;
  const confirmed=await request('/pulse/api/studio',{customer,body:{revision:current.revision,action:'confirm_strategy',strategyRevision:current.studio.strategy.revision}});assert.equal(confirmed.status,200);
  row=(await request(`/api/client-projects/${row.id}/studio`)).data.project;assert.equal(strategyReviewState(row.studio.strategy),'confirmed');
  const [other]=readCastingCode('F02.1.0').items,changed=await save({...row.studio.strategy.data,castingSelection:{...row.studio.strategy.data.castingSelection,modelId:other.modelId,hair:other.hair,voice:other.voice}});
  assert.equal(changed.confirmation,null,'a staff casting change is confirmed again by the client, as the box warns');assert.equal(changed.data.castingSelection.modelId,'F02');
});
