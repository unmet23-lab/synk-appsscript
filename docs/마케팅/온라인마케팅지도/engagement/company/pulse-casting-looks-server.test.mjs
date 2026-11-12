import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {emptyStrategyData,applyStrategyAction,strategyView} from './pulse-strategy.mjs';
import {normalizeRequestAnswers,emptyRequestAnswers,carryToStrategy,requestActions} from './pulse-requests.mjs';
import {modelLooks,OUTFIT_IDS,HAIR_IDS,CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

// 옷 · 머리 고르기(2026-11-10, docs/마케팅/PULSE_의뢰흐름_20261104/옷머리고르기_설계_20261110.md 5절): 서버가 지키는 약속.
// 손님이 방향을 고를 때 보낸 옷 · 머리는 「칸 없음 = 건드리지 않음 · '' = 맡김 · 값 = 씀(허용 밖 400)」, 모델이 바뀌면 옛 모델의 값은
// 의뢰 기록(answers)과 제작 설계(castingSelection) 두 곳에서 모두 비운다 — 방향 고르기 · 직원 정리 · 글 콘티의 「다른 모델로 바꾸기」 세 길.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const answers=(extra={})=>({name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:[],win:'story',refs:[],models:[],modelChoice:'ask',date:'',dateFree:true,approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',phone:'',consent:true,rights:true,slots:{},...extra});
const kstToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const dayAfter=days=>{const at=new Date(kstToday()+'T00:00:00Z');at.setUTCDate(at.getUTCDate()+days);return at.toISOString().slice(0,10);};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-looks-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data};};
  async function call(path,{body,csrf=''}={}){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});remember(response);return parse(response);}
  async function staff(path,{body,raw,headers={}}={}){return parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));}
  return {call,staff};
}
// 의뢰를 넣고 확인까지 마친 프로젝트 하나와 직원 · 고객 손잡이(pulse-direction-server.test.mjs와 같은 꼴).
async function confirmed(t,extra={}){
  const f=await fixture(t);
  const draft=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers(extra)},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId;let row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;
  const refresh=async()=>{row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;return row;};
  // 직원 손잡이는 손님이 그사이 바꾼 판을 먼저 읽는다(판 번호가 낡으면 409).
  const staffTry=async body=>{await refresh();const result=await f.staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}});if(result.status===200)row=result.data.project;return result;};
  const act=async body=>{const result=await staffTry(body);assert.equal(result.status,200,JSON.stringify(result.data));return row;};
  const upload=async name=>{await refresh();const result=await f.staff(`/api/client-projects/${id}/studio/media`,{raw:png,headers:{'Content-Type':'image/png','X-File-Name':encodeURIComponent(name),'X-Project-Revision':String(row.revision)}});assert.equal(result.status,201,JSON.stringify(result.data));row=result.data.project;return result.data.asset.id;};
  let room=null;const croom=async()=>{room=(await f.call('/pulse/api/project')).data;return room;};
  const customerTry=async body=>{await croom();const result=await f.call('/pulse/api/studio',{body:{revision:room.project.revision,...body},csrf:room.csrf});if(result.status===200)room=result.data;return result;};
  const cact=async body=>{const result=await customerTry(body);assert.equal(result.status,200,JSON.stringify(result.data));return room;};
  await act({action:'request_confirm'});
  return {f,id,act,staffTry,upload,croom,cact,customerTry,refresh,get row(){return row;}};
}
const option=(assetId,extra={})=>({name:'아니, 잠깐',sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고 친구 폰 앞'},{at:'0:11',text:'친구가 뺏어 마셔요'}],why:'',assetId,recommended:true,...extra});
async function propose(h,extra={}){
  const a=await h.upload('wait.png'),b=await h.upload('tok.png');
  await h.act({action:'propose_direction',lead:'두 방향으로 나눴어요.',options:[option(a),option(b,{name:'톡',sentence:'캔 따는 소리에 코트가 멈춰요.',recommended:false})],modelId:'M06',price:390000,dueDate:dayAfter(10),revisions:2,...extra});
  return h.row.studio.request.directionProposal;
}
// 지금 저장된 세 곳: 의뢰 기록 · 제작 설계(정본) · 그때 고른 값의 기록.
const looks=async h=>{const row=await h.refresh(),r=row.studio.request,cast=row.studio.strategy.data.castingSelection;return {answers:{outfit:r.answers.outfit,hair:r.answers.hair},casting:{modelId:cast.modelId,outfit:cast.outfit,hair:cast.hair},look:r.directionProposal?.look,models:r.answers.models};};

test('every model has three outfit photos and three hair photos, and the ids are the stored values',()=>{
  assert.deepEqual(OUTFIT_IDS,['fullbody','look-1','look-2']);assert.deepEqual(HAIR_IDS,['original','look-2','look-3']);
  for(const model of CASTING_MODELS){
    const set=modelLooks(model.id),file=model.id.toLowerCase();
    assert.deepEqual(set.outfits.map(item=>item.id),OUTFIT_IDS);assert.deepEqual(set.hairs.map(item=>item.id),HAIR_IDS);
    assert.deepEqual(set.outfits.map(item=>item.src),[0,1,2].map(i=>model.photos[i].src),model.id+' outfits are the app photos');
    assert.deepEqual(set.outfits.map(item=>item.label),['기본 옷',model.photos[1].label,model.photos[2].label],model.id+' base outfit is named, looks keep the catalog labels');
    assert.deepEqual(set.hairs.map(item=>item.label),model.hairLabels.slice(0,3),model.id+' hair names are the hair labels');
    assert.deepEqual(set.hairs.slice(1).map(item=>item.src),[`./assets/casting/photos/${file}-hair-2.webp`,`./assets/casting/photos/${file}-hair-3.webp`]);
    assert.equal(set.hairs[0].src,model.id==='F04'?'./assets/casting/photos/f04-hair-1.webp':model.image,model.id+' hair 1 is the portrait (F04: the casting book portrait in the same framing)');
  }
  assert.equal(modelLooks('M99'),null);assert.equal(modelLooks(''),null);
});

test('the server says it takes outfit and hair, in both the customer and the staff view',async t=>{
  const h=await confirmed(t);
  assert.equal((await h.croom()).project.studio.request.castingLooks,true,'customer view');
  assert.equal(h.row.studio.request.castingLooks,true,'staff view');
  assert.deepEqual(requestActions('answer_direction'),['optionId','modelId','note','neither','outfit','hair']);
});

test('picking a direction stores the outfit and hair in the request record, the production plan and the proposal; no field leaves it, empty means leave it to us',async t=>{
  const h=await confirmed(t),d=await propose(h);
  await h.cact({action:'answer_direction',optionId:d.options[0].id,outfit:'look-2',hair:'look-3'});
  assert.deepEqual(await looks(h),{answers:{outfit:'look-2',hair:'look-3'},casting:{modelId:'M06',outfit:'look-2',hair:'look-3'},look:{outfit:'look-2',hair:'look-3'},models:['M06']});
  // 옛 화면(칸 없음)이 방향만 다시 고르면 같은 모델의 고른 값은 그대로다.
  await h.cact({action:'answer_direction',optionId:d.options[1].id});
  assert.deepEqual(await looks(h),{answers:{outfit:'look-2',hair:'look-3'},casting:{modelId:'M06',outfit:'look-2',hair:'look-3'},look:{outfit:'look-2',hair:'look-3'},models:['M06']},'a screen without the fields changes nothing');
  // 한 줄만 맡김으로 되돌린다(빈 값).
  await h.cact({action:'answer_direction',optionId:d.options[1].id,outfit:'',hair:'look-3'});
  assert.deepEqual(await looks(h),{answers:{outfit:'',hair:'look-3'},casting:{modelId:'M06',outfit:'',hair:'look-3'},look:{outfit:'',hair:'look-3'},models:['M06']});
  await h.cact({action:'answer_direction',optionId:d.options[1].id,outfit:'',hair:''});
  assert.deepEqual(await looks(h),{answers:{outfit:'',hair:''},casting:{modelId:'M06',outfit:'',hair:''},look:{outfit:'',hair:''},models:['M06']});
});

test('values outside the model photos are refused with one sentence and change nothing',async t=>{
  const h=await confirmed(t),d=await propose(h);
  await h.cact({action:'answer_direction',optionId:d.options[0].id,outfit:'fullbody',hair:'original'});
  const before=await looks(h);
  for(const bad of [{outfit:'original'},{outfit:'look-3'},{hair:'look-1'},{hair:'wave'},{outfit:null},{hair:0},{outfit:['look-1']},{hair:'LOOK-2'}]){
    const result=await h.customerTry({action:'answer_direction',optionId:d.options[1].id,outfit:'look-1',hair:'look-2',...bad});
    assert.equal(result.status,400,JSON.stringify(bad));assert.equal(result.data.error,'옷 · 머리 고름을 확인해 주세요.',JSON.stringify(bad));
  }
  assert.deepEqual(await looks(h),before);
  assert.equal((await h.customerTry({action:'answer_direction',optionId:d.options[1].id,outfit:'look-1',shoes:'x'})).status,400,'unknown fields are still refused');
});

test('changing the model while picking empties the old model outfit and hair in both places, unless the new model values come along',async t=>{
  const h=await confirmed(t),d=await propose(h);
  await h.cact({action:'answer_direction',optionId:d.options[0].id,outfit:'look-1',hair:'look-2'});
  // 옛 화면이 다른 모델만 보낸다: M06의 헤어 2가 F02의 「하이 포니테일」로 읽히면 안 된다(설계 검토 1).
  await h.cact({action:'answer_direction',optionId:d.options[0].id,modelId:'F02'});
  assert.deepEqual(await looks(h),{answers:{outfit:'',hair:''},casting:{modelId:'F02',outfit:'',hair:''},look:{outfit:'',hair:''},models:['F02']});
  await h.cact({action:'answer_direction',optionId:d.options[0].id,modelId:'M06',outfit:'look-2',hair:''});
  assert.deepEqual(await looks(h),{answers:{outfit:'look-2',hair:''},casting:{modelId:'M06',outfit:'look-2',hair:''},look:{outfit:'look-2',hair:''},models:['M06']},'values sent with the new model are that model values');
});

test('switching models on the script empties the outfit and hair; keeping the same model keeps them',async t=>{
  const h=await confirmed(t),d=await propose(h);
  await h.cact({action:'answer_direction',optionId:d.options[0].id,outfit:'look-1',hair:'look-3'});
  await h.act({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'customer'});
  await h.act({action:'send_draft',oneLine:'맛을 설명하려다 말을 다섯 번 바꿔요.',note:'',kind:'script'});
  await h.cact({action:'answer_model',modelId:'M06',note:'그대로요'});
  let now=await looks(h);assert.deepEqual([now.answers,now.casting],[{outfit:'look-1',hair:'look-3'},{modelId:'M06',outfit:'look-1',hair:'look-3'}],'same model keeps the picks');
  await h.cact({action:'answer_model',modelId:'F01',note:'다른 모델로요'});
  now=await looks(h);
  assert.deepEqual([now.answers,now.casting,now.models],[{outfit:'',hair:''},{modelId:'F01',outfit:'',hair:''},['F01']],'「다른 모델로 바꾸기」 empties both places');
});

test('the desk settling a second round on another model empties the picks; on the same model it keeps them and adds nothing',async t=>{
  for(const [second,kept]of [['F02',false],['M06',true]]){
    const h=await confirmed(t);let d=await propose(h);
    await h.cact({action:'answer_direction',optionId:d.options[0].id,outfit:'look-2',hair:'look-2'});
    await h.cact({action:'answer_direction',neither:true,note:'더 고급스럽게'});
    d=await propose(h,{modelId:second});assert.equal(d.round,2);assert.equal(d.look,undefined,'a new round starts without a record');
    await h.cact({action:'answer_direction',neither:true,note:'아직이에요'});
    d=(await h.refresh()).studio.request.directionProposal;
    await h.act({action:'settle_direction',optionId:d.options[1].id,note:'통화로 「톡」으로'});
    const now=await looks(h),expected=kept?{outfit:'look-2',hair:'look-2'}:{outfit:'',hair:''};
    assert.deepEqual(now,{answers:expected,casting:{modelId:second,...expected},look:expected,models:[second]},second);
  }
});

test('a direction without a catalog model ignores outfit and hair; the request form never sends them',async t=>{
  const h=await confirmed(t,{modelChoice:'none'});
  const a=await h.upload('a.png'),b=await h.upload('b.png');
  await h.act({action:'propose_direction',lead:'',options:[option(a),option(b,{name:'톡',recommended:false})],price:390000,dueDate:dayAfter(10),revisions:2});
  const d=h.row.studio.request.directionProposal;
  await h.cact({action:'answer_direction',optionId:d.options[0].id,outfit:'look-1',hair:'look-2'});
  const row=await h.refresh(),r=row.studio.request;
  assert.equal(r.answers.outfit,'');assert.equal(r.answers.hair,'');assert.equal(r.directionProposal.look,undefined);
  assert.equal(row.studio.strategy.data.castingSelection.outfit,'');assert.deepEqual(r.answers.models,[]);
  // 의뢰서는 옷 칸을 받되(빈 값) 고르는 값만 받는다. 옛 답에는 키가 없어도 빈 값으로 읽힌다.
  assert.equal(normalizeRequestAnswers({}).outfit,'');assert.equal(emptyRequestAnswers().outfit,'');
  assert.equal(normalizeRequestAnswers({outfit:'look-1'}).outfit,'look-1');
  assert.throws(()=>normalizeRequestAnswers({outfit:'original'}),/고른 값을 확인해 주세요/);
});

test('confirming carries an outfit only to the same model, like the hair',()=>{
  const stamp={author:'staff',authorId:'S',authorName:'담당자',at:'2026-11-10T03:00:00.000Z'},base={revision:0,data:emptyStrategyData(),history:[]};
  const same=carryToStrategy(base,{...emptyRequestAnswers(),models:['F02'],hair:'look-2',outfit:'look-1'},stamp).data.castingSelection;
  assert.deepEqual([same.modelId,same.hair,same.outfit],['F02','look-2','look-1']);
  const other=carryToStrategy({...base,data:{...emptyStrategyData(),castingSelection:{...emptyStrategyData().castingSelection,modelId:'M01'}}},{...emptyRequestAnswers(),models:['F02'],outfit:'look-1'},stamp).data.castingSelection;
  assert.deepEqual([other.modelId,other.outfit],['M01',''],'another model in the plan takes no outfit');
});

test('the production plan keeps a picked outfit when an older screen saves without the field, and drops it when the model changes',()=>{
  const stamp={author:'staff',authorId:'S',authorName:'담당자',at:'2026-11-10T03:00:00.000Z'};
  let s=applyStrategyAction(null,{action:'save_strategy',strategy:{castingSelection:{modelId:'F02',hair:'look-2',outfit:'look-1'}}},stamp);
  assert.equal(strategyView(s).data.castingSelection.outfit,'look-1');
  const {outfit,...older}=strategyView(s).data.castingSelection;
  s=applyStrategyAction(s,{action:'save_strategy',strategy:{castingSelection:{...older,notes:'메모만 고침'}}},stamp);
  assert.deepEqual([s.data.castingSelection.outfit,s.data.castingSelection.notes],['look-1','메모만 고침'],'no field: same model keeps the outfit');
  s=applyStrategyAction(s,{action:'save_strategy',strategy:{castingSelection:{...older,modelId:'M01'}}},stamp);
  assert.equal(s.data.castingSelection.outfit,'','another model drops it');
  s=applyStrategyAction(s,{action:'save_strategy',strategy:{castingSelection:{...older,modelId:'M01',outfit:'look-2'}}},stamp);
  assert.equal(s.data.castingSelection.outfit,'look-2');
  s=applyStrategyAction(s,{action:'save_strategy',strategy:{castingSelection:{...older,modelId:'M01',outfit:''}}},stamp);
  assert.equal(s.data.castingSelection.outfit,'','an explicit empty value clears it');
  assert.throws(()=>applyStrategyAction(s,{action:'save_strategy',strategy:{castingSelection:{modelId:'M01',outfit:'original'}}},stamp),/모델과 스타일 선택값을 확인해 주세요/);
});

// ── 사진 상품(2026-11-12, 설계 8절 후속 · 10절): 방향 제안이 없어 모델 제안 카드에서 고른다 — 모델 답(answer_model)이 같은 규칙으로 옷 · 머리를 받는다. ──
const modelAnswer=async h=>(await h.refresh()).studio.request.modelProposal;
test('a photo order picks outfit and hair while accepting the proposed model: both places and the record',async t=>{
  const h=await confirmed(t,{package:'photo'});
  assert.deepEqual(requestActions('answer_model'),['accept','modelId','note','outfit','hair']);
  await h.act({action:'propose_model',modelId:'F02',note:'제품 색과 잘 맞아요'});
  assert.equal(h.row.studio.request.modelProposalLooks,true,'the staff view says this server takes the picks');
  assert.equal((await h.croom()).project.studio.request.modelProposalLooks,true,'and so does the customer view');
  await h.cact({action:'answer_model',accept:true,outfit:'look-2',hair:'look-3'});
  const now=await looks(h),p=await modelAnswer(h);
  assert.deepEqual([now.answers,now.casting,now.models],[{outfit:'look-2',hair:'look-3'},{modelId:'F02',outfit:'look-2',hair:'look-3'},['F02']]);
  assert.deepEqual([p.status,p.modelId,p.look],['accepted','F02',{outfit:'look-2',hair:'look-3'}],'the record of what was set then');
});

test('the model answer follows the same three rules: absent keeps, empty leaves it to us, a wrong value is refused',async t=>{
  const h=await confirmed(t,{package:'photo'});
  await h.act({action:'propose_model',modelId:'F02',note:''});
  await h.cact({action:'answer_model',accept:true,outfit:'look-1',hair:'look-2'});
  // 칸을 모르는 옛 화면이 같은 모델로 다시 답하면 건드리지 않는다.
  await h.cact({action:'answer_model',modelId:'F02',note:'그대로요'});
  let now=await looks(h);assert.deepEqual([now.answers,now.casting],[{outfit:'look-1',hair:'look-2'},{modelId:'F02',outfit:'look-1',hair:'look-2'}],'absent fields keep the picks');
  await h.cact({action:'answer_model',modelId:'F02',outfit:'',hair:'look-3'});
  now=await looks(h);assert.deepEqual([now.answers,now.casting,(await modelAnswer(h)).look],[{outfit:'',hair:'look-3'},{modelId:'F02',outfit:'',hair:'look-3'},{outfit:'',hair:'look-3'}],'an empty value leaves that row to us');
  const before=await looks(h);
  for(const bad of [{outfit:'original'},{outfit:'look-3'},{hair:'look-1'},{hair:'fullbody'},{outfit:null},{hair:0},{outfit:['look-1']}]){
    const result=await h.customerTry({action:'answer_model',modelId:'F02',outfit:'look-1',hair:'look-2',...bad});
    assert.equal(result.status,400,JSON.stringify(bad));assert.equal(result.data.error,'옷 · 머리 고름을 확인해 주세요.',JSON.stringify(bad));
  }
  assert.equal((await h.customerTry({action:'answer_model',modelId:'F02',shoes:'x'})).status,400,'unknown fields are still refused');
  assert.deepEqual(await looks(h),before,'a refused answer changes nothing');
  // 벽에서 다른 모델을 고르면 옛 모델의 값은 두 곳에서 비고, 함께 보낸 값만 남는다.
  await h.cact({action:'answer_model',modelId:'M06'});
  now=await looks(h);assert.deepEqual([now.answers,now.casting,now.models,(await modelAnswer(h)).look],[{outfit:'',hair:''},{modelId:'M06',outfit:'',hair:''},['M06'],{outfit:'',hair:''}]);
  await h.cact({action:'answer_model',modelId:'F01',outfit:'look-1',hair:''});
  now=await looks(h);assert.deepEqual([now.answers,now.casting],[{outfit:'look-1',hair:''},{modelId:'F01',outfit:'look-1',hair:''}],'values sent along belong to the new model');
});

test('an answer in words only sets nothing and leaves no outfit record; a new proposal starts clean',async t=>{
  const h=await confirmed(t,{package:'photo'});
  await h.act({action:'propose_model',modelId:'F02',note:''});
  await h.cact({action:'answer_model',note:'조금 더 어린 느낌이면 좋겠어요',outfit:'look-1',hair:'look-2'});
  let p=await modelAnswer(h),now=await looks(h);
  assert.equal(p.status,'declined');assert.equal('look' in p,false);
  assert.deepEqual([now.answers.outfit||'',now.answers.hair||'',now.casting.outfit||'',now.casting.hair||'',now.models],['','','','',[]],'no model, so the picks are dropped');
  assert.equal((await h.customerTry({action:'answer_model',note:'말로만',outfit:'wrong'})).status,400,'a wrong value is refused even when it would be dropped');
  await h.act({action:'propose_model',modelId:'F01',note:'다시 골랐어요'});
  await h.cact({action:'answer_model',accept:true,outfit:'fullbody',hair:'original'});
  p=await modelAnswer(h);assert.deepEqual([p.status,p.modelId,p.look],['accepted','F01',{outfit:'fullbody',hair:'original'}]);
  // 기록이 남은 답 뒤의 새 제안은 그 기록(look)을 물려받지 않는다. 의뢰 기록의 값은 손님이 새로 답할 때까지 앞 모델 몫 그대로다.
  await h.act({action:'propose_model',modelId:'M06',note:'한 번 더 골랐어요'});
  p=await modelAnswer(h);now=await looks(h);
  assert.deepEqual([p.status,p.modelId,'look' in p],['open','M06',false],'a new proposal starts without the earlier record');
  assert.deepEqual([now.answers,now.casting,now.models],[{outfit:'fullbody',hair:'original'},{modelId:'F01',outfit:'fullbody',hair:'original'},['F01']],'proposing alone changes no picks');
  // 말로만 답하면 기록(look) 없이 거절로 남고, 앞서 정한 모델과 값은 그대로다.
  await h.cact({action:'answer_model',note:'역시 다른 분이면 좋겠어요'});
  p=await modelAnswer(h);now=await looks(h);assert.equal(p.status,'declined');assert.equal('look' in p,false);
  assert.deepEqual([now.answers,now.models],[{outfit:'fullbody',hair:'original'},['F01']]);
  // 받아들인 답(기록 있음) 바로 뒤에 같은 제안에 말로만 다시 답해도 앞 기록을 떼어 낸다 — 거절한 답에 옛 값이 붙어 다니지 않게.
  await h.act({action:'propose_model',modelId:'F02',note:''});
  await h.cact({action:'answer_model',accept:true,outfit:'look-1',hair:''});
  p=await modelAnswer(h);assert.deepEqual([p.status,p.look],['accepted',{outfit:'look-1',hair:''}]);
  await h.cact({action:'answer_model',note:'다시 생각해 볼게요'});
  p=await modelAnswer(h);assert.equal(p.status,'declined');assert.equal('look' in p,false);
});

test('picks made on the model proposal before the brief is confirmed reach the production plan when it is',async t=>{
  const f=await fixture(t);
  const draft=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers({package:'photo'})},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId,read=async()=>(await f.staff('/api/client-projects/'+id+'/studio')).data.project;
  const act=async body=>{const row=await read(),result=await f.staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}});assert.equal(result.status,200,JSON.stringify(result.data));};
  await act({action:'propose_model',modelId:'F02',note:''});
  const room=(await f.call('/pulse/api/project')).data;
  const answered=await f.call('/pulse/api/studio',{body:{revision:room.project.revision,action:'answer_model',accept:true,outfit:'look-1',hair:''},csrf:room.csrf});assert.equal(answered.status,200,JSON.stringify(answered.data));
  let row=await read();assert.deepEqual([row.studio.request.answers.outfit,row.studio.request.answers.hair,row.studio.request.answers.models],['look-1','',['F02']]);
  await act({action:'request_confirm'});
  row=await read();const cast=row.studio.strategy.data.castingSelection;
  assert.deepEqual([cast.modelId,cast.outfit,cast.hair||''],['F02','look-1','']);
});
