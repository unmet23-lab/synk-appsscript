// PULSE 인물 판 4 화면(2026-11-10, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md 6절) — 손님 「내 모델」 · 고객 방 「내 모델로 모아 두기」 ·
// 의뢰서의 내 모델 고름 · 상태 줄 · 직원 「고객 브랜드」 데스크, 그리고 판 3 화면 검수 후속 F1 ~ F4. 서버 응답 그대로의 끝까지 시험은 pulse-persona-pan4.test.mjs 「화면(판 4)」.
// 스위치(myModels)를 끄면 손님 화면은 판 4 전과 같다 — 바이트 대조는 브라우저 캡처(1440 · 390)가, 여기서는 그 갈래를 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {emptyAnswers,briefRows}=await import('./public/pulse-app/request-data.mjs');
const {deskChecks}=await import('./public/pulse-app/room-view.mjs');
const {roomView}=await import('./public/pulse-app/film-views.mjs');
const {personaModel,personaCard,personaLine,personaKeep,STATUS_LINE}=await import('./public/pulse-app/persona-view.mjs');
const {myModelsView,MODEL_REASON,MODEL_ASK,attachToDraft}=await import('./public/pulse-app/my-models.mjs');
const {brandDesk}=await import('./public/pulse-app/brand-desk-view.mjs');
const {request}=await import('./public/pulse-app/api.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url),read=name=>readFileSync(new URL(name,appDir),'utf8');

const ID='11111111-1111-4111-8111-111111111111',REV='22222222-2222-4222-8222-222222222222',HASH='a'.repeat(64);
const view=(status,extra={})=>({id:ID,kind:'virtual',status,step:{reviewing:2,quote_review:3,ready:7}[status]||null,turn:{quote_review:'customer',withdrawn:'end'}[status]||'staff',name:'',why:'',request:{look:'',use:'',keep:''},
  sources:{identity:0,mood:0,files:[]},canAddSources:false,quote:status==='quote_review'?{price:300000,days:7,revisions:2,scope:'기준 얼굴 1판'}:null,revision:null,usage:null,awaiting:status==='quote_review'?{kind:'scope',revisionId:null,viewedHash:HASH}:null,events:[],approvals:[],...extra});

test('상태 줄: 판 4 상태(사용 중지 · 삭제 진행 · 묘비)와 읽을 때 계산하는 보관 기간 끝까지 한 줄이 있다',()=>{
  for(const state of ['paused','deleting','deleted','expired'])assert.ok(STATUS_LINE[state],state);
  assert.ok(personaLine(personaModel({persona:view('paused')})).includes('사용을 멈춘 인물이에요'));
  assert.ok(personaLine(personaModel({persona:view('deleting')})).includes('인물을 지우고 있어요'));
  for(const reason of ['expired','paused','retired','withdrawn','deleting','deleted','reuse_off','revision','closed','workspace','status'])assert.ok(MODEL_REASON[reason],'내 모델 카드 까닭: '+reason);
});

test('판 3 화면 검수 F1: 이름 없는 인물의 머리 줄에 「맞춤 인물」이 두 번 서지 않는다 — 이름이 있으면 이름 · 확인 번호',()=>{
  const unnamed=personaCard(personaModel({persona:view('quote_review')}));
  assert.match(unnamed,/<p class="sx-small sx-persona-kicker">맞춤 인물 확인 <b class="sx-no">1\/4<\/b><\/p>/);
  const named=personaCard(personaModel({persona:view('quote_review',{name:'하루'})}));
  assert.match(named,/맞춤 인물 「하루」 · 맞춤 인물 확인 <b class="sx-no">1\/4<\/b>/);
});

test('다시 쓰기 방(mode reuse): 이름은 「내 모델」, 일곱 걸음 번호 · 확인 번호 · 모아 두기가 없다',()=>{
  const m=personaModel({persona:view('ready',{mode:'reuse',name:'하루',step:7})});
  assert.equal(m.mode,'reuse');assert.equal(m.step,null);
  const line=personaLine(m);
  assert.ok(line.includes('내 모델 「하루」')&&!line.includes('/7'));
  assert.equal(personaKeep(m,{state:'login'}),'','다시 쓰기 방에는 모아 두기가 없다');
  // 기억한 기기는 첫 화면 대신 방이 열려 입구가 없다 — 다시 쓰기 방에는 「내 모델 열기」 한 줄.
  assert.ok(personaKeep(m,{state:'reuse'}).includes('data-room-do="my-models"')&&!personaKeep(m,{state:'reuse'}).includes('data-room-do="keep"'));
  assert.equal(personaKeep(personaModel({persona:view('ready')}),{state:'reuse'}),'','원 프로젝트 방에는 그 줄이 없다');
  assert.ok(personaKeep(personaModel({persona:view('ready',{kind:'real'})}),{state:'login'}).includes('출연하실 분이 다시 쓰기에 동의한 경우에만'),'실제 인물은 당사자 동의 조건');
});

test('고객 방 「내 모델로 모아 두기」: keep이 없으면 칸이 없고(스위치 끔 = 판 4 전 글자), 상태마다 단추 · 한 줄',()=>{
  const m=personaModel({persona:view('reviewing')});
  assert.equal(personaKeep(m,null),'');assert.equal(personaKeep(m,{}),'');
  const login=personaKeep(m,{state:'login'});
  assert.ok(login.includes('data-room-do="keep"')&&login.includes('SYNK ID로 로그인한 뒤 담당자가 확인해요.')&&login.includes('그 브랜드 회원들이 다음 광고에 쓸 수 있어요'));
  assert.ok(personaKeep(m,{state:'ask'}).includes('data-room-do="keep"')&&!personaKeep(m,{state:'ask'}).includes('SYNK ID로 로그인한 뒤'));
  assert.ok(personaKeep(m,{state:'busy'}).includes('disabled'));
  assert.ok(personaKeep(m,{state:'pending'}).includes('모아 두기를 요청했어요')&&!personaKeep(m,{state:'pending'}).includes('data-room-do="keep"'));
  const member=personaKeep(m,{state:'member',name:'가 <브랜드>'});
  assert.ok(member.includes('data-room-do="my-models"')&&member.includes('가 &lt;브랜드&gt;'),'브랜드 이름은 이스케이프');
  assert.equal(personaKeep(personaModel({persona:view('withdrawn')}),{state:'login'}),'','거둔 인물에는 없다');
  // 방 화면은 p.keep이 있을 때만 그 칸을 붙인다(views.mjs roomInfo가 그 프로젝트의 keep만 넘긴다).
  assert.match(read('views.mjs'),/s\.keep\?\.projectId===s\.project\?\.id&&s\.keep\?\.state\?\{keep:s\.keep\}:\{\}/);
  assert.match(read('film-views.mjs'),/const keep=p\.persona&&p\.keep\?personaKeep\(p\.persona,p\.keep\):'';/);
});

test('첫 화면 「내 모델」 입구: 첫 화면 글자에는 없고, 앱이 공개 스위치(myModels)를 확인한 뒤에만 붙인다',()=>{
  const home=read('film-home.mjs'),app=read('app.mjs');
  assert.ok(!/data-entry="models"/.test(home.slice(home.indexOf('export function entryView'),home.indexOf('export function mountEntry'))),'entryView 글자에 입구가 없다');
  assert.match(home,/showModels\(\)\{/);
  assert.match(app,/function modelsEntry\(\)\{[^\n]*publicFeatures\(\)\.then\(features=>\{if\(features\?\.myModels===true&&handle===entryHandle\)handle\?\.showModels\?\.\(\);\}\);\}/);
  // 고객 방 모아 두기도 그 프로젝트 응답의 스위치(projectFeatures.myModels) · 이 방의 인물이 있을 때만 읽는다.
  // 11-11 켜기 전 후속: 내 모델로 맡긴 의뢰(answers.modelChoice 'persona')는 인물이 실리지 않은 방에서도 읽는다 — 「내 모델 열기」 한 줄(pulse-before-switch 시험).
  assert.match(app,/const keepWanted=\(\)=>s\.mode==='customer'&&!demo&&!!s\.project&&projectFeatures\?\.myModels===true&&usesRoom\(s\.project\)&&\(!!s\.project\.persona\|\|reuseAsked\(\)\);/);
  // 내 모델 화면 모듈은 처음 열 때 읽는다(꺼져 있으면 손님 앱이 판 4 전과 같은 파일만 받는다).
  assert.match(app,/const memberApi=\(\)=>import\('\.\/my-models\.mjs'\);/);assert.doesNotMatch(app,/^import .*my-models/m);
});

test('로그인 돌아오기: ?login=failed와 돌아올 곳은 주소를 지우기 전에 읽고, 회원 경로의 401은 프로젝트 연결을 닫지 않는다',()=>{
  const app=read('app.mjs'),clean=app.indexOf("history.replaceState({},'',location.pathname+(demoMode");
  assert.ok(clean>0);
  assert.ok(app.indexOf("const LOGIN_FAILED=")>0&&app.indexOf("const LOGIN_FAILED=")<clean,'?login=failed는 주소를 지우기 전에');
  assert.ok(app.indexOf("let memberReturn=")<clean,'돌아올 곳도 지우기 전에(한 번 읽고 지운다)');
  assert.match(app,/sessionStorage\.removeItem\(MEMBER_RETURN_KEY\)/);
  // 회원 경로는 mutate(401 → connectionExpired)를 거치지 않는다.
  const member=app.slice(app.indexOf('// ── 「내 모델」(PULSE 인물 판 4'),app.indexOf('async function resumeMemberReturn')).split(/\r?\n/).filter(line=>!line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(member,/mutate\(|connectionExpired\(/);
  assert.match(app,/await start\(parseInvite\(initialInvite\)\);if\(memberReturn\|\|LOGIN_FAILED\)void resumeMemberReturn\(\);/);
});

test('회원 경로 요청: member 쓰기는 X-CSRF-Token, 초안 증표는 X-Pulse-CSRF — 붙이기 순서는 초안(없으면 만든다) → 증표 → 붙이기',async()=>{
  const original=globalThis.fetch,calls=[];
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  try{
    globalThis.fetch=async(path,init)=>{calls.push({path,method:init.method,headers:init.headers,body:init.body?JSON.parse(init.body):undefined});
      if(path==='/pulse/api/request')return reply({draft:null,features:{}});
      if(path==='/pulse/api/request/start')return reply({draft:{id:'d1',status:'draft',csrf:'draft-csrf'}},201);
      if(path==='/pulse/api/request/persona-proof')return reply({proof:'proof-1'});
      if(path==='/api/customer/pulse/draft-persona')return reply({attached:{expiresAt:'x'},answers:{modelChoice:'persona'}});
      return reply({error:'없음'},404);};
    const result=await attachToDraft({workspaceId:'w',personaId:'p',revisionId:'r',csrf:'member-csrf'});
    assert.equal(result.answers.modelChoice,'persona');
    assert.deepEqual(calls.map(call=>call.path),['/pulse/api/request','/pulse/api/request/start','/pulse/api/request/persona-proof','/api/customer/pulse/draft-persona']);
    assert.equal(calls[2].headers['X-Pulse-CSRF'],'draft-csrf');assert.equal(calls[2].headers['X-CSRF-Token'],undefined);
    assert.equal(calls[3].headers['X-CSRF-Token'],'member-csrf');assert.deepEqual(calls[3].body,{proof:'proof-1',workspaceId:'w',personaId:'p',revisionId:'r'});
    // 보관 조건이 바뀐 409는 새 조건(offer)을 오류에 싣는다.
    globalThis.fetch=async()=>reply({error:'보관 조건이 바뀌었어요. 새 조건을 보고 다시 확인해 주세요.',code:'SYNK_PULSE_REUSE_STALE',offer:{revisionId:'r2',viewedHash:HASH,terms:{}}},409);
    await assert.rejects(request('/api/customer/pulse/reuse',{member:true,csrf:'c',body:{}}),error=>error.code==='SYNK_PULSE_REUSE_STALE'&&error.offer?.revisionId==='r2');
  }finally{globalThis.fetch=original;}
});

test('내 모델 화면: 쓸 수 없는 모델은 회색 카드 · 까닭 한 줄 · 의뢰 단추 없음, 회원(member)에게는 관리자 일이 없다',()=>{
  const card=(extra={})=>({id:ID,name:'하루',kind:'virtual',status:'ready',usable:true,reason:null,revisionId:REV,image:'/api/customer/pulse/asset/'+ID,reuse:true,until:'2027-11-10T14:59:59.999Z',lastUsedAt:'2026-11-10T03:00:00.000Z',deletionRequested:false,...extra});
  const data=(role,models)=>({workspaces:[{id:'w1',name:'가 브랜드',role,models,pending:[]}]});
  const off=myModelsView({view:'list',data:data('admin',[card({status:'expired',usable:false,reason:'expired',consent:{revisionId:REV,viewedHash:HASH,terms:{}}})])});
  assert.ok(off.includes('sx-mm-card is-off')&&off.includes('다시 쓰기 기한이 지났어요')&&!off.includes('data-mm-do="request"'));
  assert.ok(off.includes('기한 연장')&&off.includes('data-ask="stop"'),'기간이 끝난 모델도 연장 · 멈추기');
  const member=myModelsView({view:'list',data:data('member',[card()])});
  assert.ok(member.includes('data-mm-do="request"')&&member.includes('브랜드 회원'));
  assert.ok(!/data-mm-do="(consent|ask)"/.test(member),'회원은 보관 · 멈추기 · 삭제 요청이 없다');
  const asked=myModelsView({view:'list',data:data('admin',[card({deletionRequested:true})])});
  // 삭제 요청은 쓰기를 막지 않는다(서버 personaUsability) — 쓸 수 있는 동안은 상태 한 줄 「삭제 요청됨 — …」과 의뢰 단추, 「쓸 수 있어요」 줄은 없다(만료 · 삭제 운영 시험 P3).
  assert.ok(asked.includes('삭제 요청됨 — 담당자가 지우기 전까지는 새 광고에 쓸 수 있어요')&&!asked.includes('</i>새 광고에 쓸 수 있어요</p>')&&asked.includes('data-mm-do="request"')&&!asked.includes('data-ask="delete"'));
  const askedOff=myModelsView({view:'list',data:data('admin',[card({deletionRequested:true,usable:false,reason:'paused'})])});
  assert.ok(askedOff.includes('삭제 요청을 받았어요. 담당자가 확인하고 있어요.')&&!askedOff.includes('삭제 요청됨 —')&&!askedOff.includes('data-mm-do="request"'));
  for(const kind of Object.keys(MODEL_ASK))assert.ok(myModelsView({view:'ask',pick:{ws:{id:'w1',name:'가 브랜드'},card:card(),kind}}).includes('data-mm-do="ask-go"'));
  assert.ok(myModelsView({view:'login',session:{authenticated:false,loginAvailable:false}}).includes('disabled'),'로그인을 쓸 수 없으면 단추를 막는다');
});

test('의뢰서: 내 모델 고름은 붙인 초안에서만 칩이 서고, 풀면 칩을 뺀다 — 접수증 · 요약 줄 · 다음 일',()=>{
  const flow=read('request-flow.mjs');
  assert.match(flow,/\$\{a\.modelChoice==='persona'\?chip\(pickedLabel\(a\),true,'data-do="modelchoice" data-id="persona"'\):''\}/);
  // 화면 메모리(personaPick)가 없는 이어 쓰는 초안: 「내 모델 · 내 모델」로 겹치지 않는다(화면 검수 아르곤 C1).
  assert.match(flow,/const pickedLabel=a=>pickedName\(a\)\?t\('내 모델 · \{name\}',\{name:pickedName\(a\)\}\):t\('내 모델'\);/);
  assert.doesNotMatch(flow,/t\('내 모델 · \{name\}',\{name:pickedName\(a\)\}\)[^;]*t\('내 모델 · \{name\}'/,'이름 자리에 「내 모델」을 다시 넣지 않는다');
  assert.match(flow,/if\(ctx\.photos&&a\.modelChoice==='persona'&&!ctx\.flags\.models\)a\.modelChoice='';/,'스위치를 끄면 공개 초안의 내 모델 고름을 비운다');
  assert.match(flow,/modelchoice\(el\)\{if\(el\.dataset\.id==='persona'&&a\.modelChoice==='persona'\)return;a\.modelChoice=a\.modelChoice===el\.dataset\.id\?'':el\.dataset\.id;a\.models=\[\];if\(a\.modelChoice!=='persona'\)dropPick\(\);/);
  assert.match(flow,/model\(el\)\{toggleIn\(a\.models,el\.dataset\.id,2\);a\.modelChoice='';dropPick\(\);/);
  const a={...emptyAnswers(),modelChoice:'persona',personaPick:{name:'하루',image:''}};
  assert.equal(briefRows(a).find(row=>row.key==='모델').value,'내 모델 · 하루');
  assert.equal(briefRows({...emptyAnswers(),modelChoice:'persona'}).find(row=>row.key==='모델').value,'내 모델 다시 쓰기','서버 답만 있으면(고객 방 · 직원) 이름 없이');
  // 판 3 화면 검수 F2: 맞춤 인물 접수증에 인물 사진 줄(확인 단계 요약과 같은 줄). 맞춤이 아니면 줄이 없다(판 4 전 글자).
  assert.match(flow,/\[k\('인물 사진'\),personaCount\?t\('\{count\}장',\{count:personaCount\}\):''\]/);
  assert.match(flow,/const personaCount=a\.modelChoice==='custom'\?PERSONA_SLOTS\.reduce/);
  assert.match(flow,/a\.modelChoice==='persona'\?\[\[k\('내 모델 연결을 확인해요'\)/);
});

test('판 3 화면 검수 F4 · 판 4: 직원 데스크 점검 — 거둔 맞춤 인물은 모델 점검으로, 다시 쓰기 의뢰는 연결 확인 차례',()=>{
  const p=(answers,extra={})=>({id:'p1',studio:{request:{status:'submitted',answers:{...emptyAnswers(),name:'탄산수',kind:'food',channels:['shorts'],...answers},files:[],asks:[]},strategy:{data:{}}},personas:[],...extra});
  const labels=row=>deskChecks(row).map(item=>item.label);
  assert.ok(labels(p({modelChoice:'custom'})).some(label=>label.startsWith('맞춤 인물 의뢰예요')),'열린 맞춤 인물');
  const withdrawn=labels(p({modelChoice:'custom'},{personas:[{id:ID,originProjectId:'p1',status:'withdrawn'}]}));
  assert.ok(!withdrawn.some(label=>label.startsWith('맞춤 인물 의뢰예요'))&&withdrawn.includes('모델을 제안해 확인받아야 해요'),'거둔 뒤에는 모델 점검으로');
  assert.ok(labels(p({modelChoice:'persona'},{workspaceRequest:{personaId:ID}})).some(label=>label.startsWith('내 모델 다시 쓰기 의뢰예요')));
  assert.ok(labels(p({modelChoice:'persona'},{workspaceRequest:{personaId:ID,confirmedAt:'2026-11-10T03:00:00.000Z'}})).some(label=>label.startsWith('내 모델 연결을 확인했어요')));
  assert.ok(!labels(p({modelChoice:'persona'},{workspaceRequest:{personaId:ID}})).includes('모델을 제안해 확인받아야 해요'),'다시 쓰기 의뢰는 카탈로그 모델을 제안하지 않는다');
});

test('직원 브랜드 데스크: 다음 행동 한 줄 먼저, 다시 요청이 필요한 연결 요청 · 권한 밖 단추는 그리지 않는다',()=>{
  const list={canWrite:true,isAdmin:false,claims:[{id:'c1',projectId:'p1',projectTitle:'탄산수',displayName:'가 대표',status:'pending',createdAt:'2026-11-10T03:00:00.000Z',stale:true,linkedWorkspace:null,mode:'link'},{id:'c2',projectId:'p2',projectTitle:'과자',displayName:'나 대표',status:'pending',createdAt:'2026-11-10T03:00:00.000Z',stale:false,linkedWorkspace:{id:'w1',name:'가 브랜드',status:'active',canManage:false},mode:'join'}],
    workspaces:[{id:'w1',name:'가 브랜드',status:'active',revision:3,staffOwnerName:'관리자',memberCount:1,modelCount:1,todoCount:0,canManage:false}],reuseRequests:[]};
  const stale=brandDesk({list,pick:{kind:'claim',id:'c1'}});
  assert.ok(stale.includes('손님이 다시 요청해야 해요')&&!stale.includes('data-decision="approve"'),'다시 요청이 필요하면 승인 폼이 없다');
  const join=brandDesk({list,pick:{kind:'claim',id:'c2'}});
  assert.ok(join.includes('브랜드 「가 브랜드」의 담당이나 관리자가 정해요')&&!join.includes('data-decision="approve"'),'그 브랜드를 맡지 않으면 승인 폼이 없다');
  assert.ok(brandDesk({list}).includes('왼쪽에서 하나를 골라요'));
  assert.ok(brandDesk({list}).includes('다시 요청 필요'),'목록에 다시 요청 표시');
  const desk=read('brand-desk-view.mjs');
  assert.doesNotMatch(desk,/from '\.\/i18n\.mjs'/,'직원 화면 — 손님 사전에 들지 않는다');
});

test('판 4 화면 검수 A1: 사용 범위 폼에서 손님에게 보일 「메모」와 내부 근거 한 줄은 칸 이름이 겹치지 않는다',()=>{
  const list={canWrite:true,isAdmin:true,claims:[],workspaces:[],reuseRequests:[{projectId:'p9',title:'봄 광고',stage:'brief',ownerName:'담당',workspaceName:'가 브랜드',personaName:'하늘',personaKind:'virtual',usable:true,canConfirm:true,projectRevision:2,attachedAt:'2026-11-10T03:00:00.000Z'}]};
  const html=brandDesk({list,pick:{kind:'reuse',id:'p9'}});
  const form=html.slice(html.indexOf('data-action-name="confirm_request"'));
  const names=[...form.slice(0,form.indexOf('</form>')).matchAll(/name="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(names.includes('usageNote')&&names.includes('note'),names.join(','));
  assert.equal(new Set(names).size,names.length,'한 폼 안 칸 이름은 하나씩: '+names.join(','));
  // 앱은 usageNote를 사용 범위의 note로 되돌려 보낸다.
  assert.match(read('app.mjs'),/const usageFieldOf=key=>key==='note'\?'usageNote':key;/);
});

test('판 4 화면 검수 A2: 로그인에서 돌아온 뒤 방이 연 읽기는 모아 두기 요청(busy)을 덮지 않고, 요청이 실패하면 앞 상태 대신 다시 읽는다',()=>{
  const app=read('app.mjs'),load=app.slice(app.indexOf('async function loadKeep()'),app.indexOf('async function keepProject('));
  assert.match(load,/ticket=\+\+keepTicket/);assert.match(load,/const put=next=>\{if\(ticket===keepTicket\)setKeep\(projectId,next\);\};/);
  assert.doesNotMatch(load.split(/\r?\n/).filter(line=>!line.includes('const put=')).join('\n'),/setKeep\(/,'읽기 결과는 모두 차례표를 거친다');
  const keep=app.slice(app.indexOf('async function keepProject('),app.indexOf('async function resumeMemberReturn'));
  assert.match(keep,/const projectId=s\.project\.id;keepTicket\+\+;/);
  assert.doesNotMatch(keep,/before/);assert.match(keep,/\}catch\(error\)\{notice\([^\n]*\);void loadKeep\(\);/);
});

test('판 4 화면 최종 검수 F1 ~ F5: 붙인 칩은 다시 눌러도 그대로 · 잇기 실패는 프로젝트 판도 다시 읽기 · 로그아웃 실패는 알림 · 언어 메뉴 밑줄 없음 · 목록 줄에 때',()=>{
  // F1: 켜진 「내 모델」 칩을 다시 눌러도 붙임이 풀리지 않는다(다른 칩 · 모델을 고를 때만 dropPick).
  assert.match(read('request-flow.mjs'),/modelchoice\(el\)\{if\(el\.dataset\.id==='persona'&&a\.modelChoice==='persona'\)return;/);
  // F2: 프로젝트 잇기가 실패하면 직원 프로젝트 목록(판)도 다시 읽는다.
  const app=read('app.mjs');
  assert.match(app,/async function brandAct\(path,body,\{form,message,after,failed\}=\{\}\)\{/);
  assert.match(app,/try\{await loadBrands\(\);\}catch\{\}try\{await failed\?\.\(\);\}catch\{\}render\(\);notice\(error\.message\);/);
  assert.match(app,/failed:action==='link'\?loadWorkspace:null\}\);/);
  // F3: 로그아웃 실패(401이 아닌)는 화면을 그대로 두고 까닭을 보인다.
  const mine=read('my-models.mjs');
  // 11-11: 403(다른 탭의 다시 로그인)은 세션을 다시 읽고 서버 글 — 그 밖의 실패는 지금처럼 이 문장. 여기와 pulse-before-switch 시험은 갈래만 잠그고,
  // 403 동작(첫 누름은 서버 글 · 세션 다시 읽음, 둘째는 새 보안 값으로 나감)은 실제 브라우저 캡처(.tmp/pulse-before-switch-20261111 G)가 돌린다.
  assert.match(mine,/catch\(err\)\{const gone=err\.status===401\|\|err\.status===403&&!\(await resync\(\)\);if\(!gone\)\{st\.busy=false;st\.error=err\.status===403\?err\.message:t\('로그아웃하지 못했어요\. 다시 시도해 주세요\.'\);paint\(\{focus:false\}\);return;\}\}/);
  assert.doesNotMatch(mine,/\/api\/customer\/logout'[^\n]*\}catch\{\}/,'로그아웃 실패를 삼키지 않는다');
  // F4: 밑줄은 내 모델 자기 단추에만 — 언어 메뉴 단추(.locale-option)에는 걸리지 않는다.
  const css=readFileSync(new URL('./film.css',appDir),'utf8');
  assert.match(css,/\.sx-mm-top-right \[data-mm-do\]\{padding:6px 0;text-decoration:underline;/);
  assert.doesNotMatch(css,/\.sx-mm-top-right button\{/);
  // F5: 같은 제목 · 같은 모델의 다시 쓰기 의뢰 두 줄이 목록에서 갈린다(붙인 때), 연결 요청 줄에도 요청한 때.
  const row=(projectId,attachedAt)=>({projectId,title:'새 탄산수 겨울판',stage:'received',workspaceName:'하늘 음료',personaName:'하루',personaKind:'virtual',usable:true,canConfirm:true,projectRevision:1,attachedAt});
  const list={canWrite:true,isAdmin:true,claims:[{id:'c1',projectId:'p1',projectTitle:'탄산수',displayName:'가 대표',status:'pending',createdAt:'2026-11-10T03:00:00.000Z',stale:false,linkedWorkspace:null,mode:'link'}],workspaces:[],
    reuseRequests:[row('p8','2026-11-09T01:00:00.000Z'),row('p9','2026-11-10T05:30:00.000Z')]};
  const nav=brandDesk({list}).split('</nav>')[0];
  assert.ok(nav.includes('하늘 음료 · 하루 · 2026.11.09 10:00')&&nav.includes('하늘 음료 · 하루 · 2026.11.10 14:30'),nav);
  assert.ok(nav.includes('탄산수 · 2026.11.10 12:00'));
  // 직원 데스크의 expired도 손님 화면과 같은 「다시 쓰기 기한」(기한 뒤에도 파일은 남는다).
  const desk=read('brand-desk-view.mjs');
  assert.doesNotMatch(desk,/보관 기간 끝|보관 기간이 끝/);assert.match(desk,/expired:'다시 쓰기 기한 지남'/);
});

test('보관 규칙 화면 최종 검수 F1 ~ F3(11-11): 의뢰서 인물 안내는 서버 실물대로 · 끄기 · 멈추기 확인 글에 지우는 날 · 자동으로 지운 기록은 「자동」',()=>{
  // F1: 「의뢰 기록을 정리할 때 함께 지움」은 그 정리(90일)가 도는 공개 의뢰서(ctx.photos)에만 — 담당자가 만든 프로젝트 · 확인 뒤 멈춘 의뢰의 인물은 기록과 함께 남는다.
  const flow=read('request-flow.mjs');
  assert.match(flow,/t\('사진과 만들어 드린 인물은 이 의뢰에만 쓰고, 이 의뢰의 기록과 함께 둬요\. 지우기를 원하시면 담당자에게 알려 주세요\.'\)/);
  // 90일 시계(11-12, 판 4 설계 11-6)부터는 두 의뢰서 공통 문장 하나 — 공개 의뢰서에만 붙던 「의뢰 기록을 지울 때 함께」는 방 안 의뢰서에 그대로 붙이면 틀려서 없앴다.
  assert.match(flow,/\)\)\} \$\{esc\(t\('제작으로 이어지지 않고 90일 동안 진행이 없으면 사진과 인물을 지워요\.'\)\)\} /,'두 의뢰서 공통(ctx.photos 조건 없이)');
  assert.doesNotMatch(flow,/의뢰가 진행되지 않아 의뢰 기록을 지울 때는/,'공개 의뢰서에만 붙던 옛 문장');
  assert.doesNotMatch(flow,/제작으로 이어지지 않고 의뢰가 정리되면/,'실물보다 넓은 옛 문장');
  // F3: 끄거나 멈춰도 지우는 날은 그대로 — 그날이 남았을 때만 확인 화면에 한 줄.
  const card=(extra={})=>({id:ID,name:'하루',kind:'virtual',status:'ready',usable:true,reason:null,revisionId:REV,reuse:true,until:'2099-11-10T14:59:59.999Z',deleteAt:'2099-12-10T14:59:59.999Z',deletionRequested:false,...extra});
  const ask=(kind,extra)=>myModelsView({view:'ask',pick:{ws:{id:'w1',name:'가 브랜드'},card:card(extra),kind}});
  assert.match(ask('withdraw'),/data-mm-keep>끄더라도 그림과 파일은 2099년 12월 10일[^<]*까지 두고, 그날 전에 다시 동의하지 않으면 지워요\.</);
  assert.match(ask('stop'),/data-mm-keep>멈추더라도 그림과 파일은 2099년 12월 10일[^<]*까지 두고, 그날 전에 담당자가 멈춤을 푼 뒤 다시 동의하지 않으면 지워요\.</);
  assert.ok(!ask('delete').includes('data-mm-keep'),'삭제 요청에는 없다');
  assert.ok(!ask('withdraw',{deleteAt:'2020-01-01T00:00:00.000Z'}).includes('data-mm-keep'),'지우는 날이 지났으면 없다');
  assert.ok(!ask('stop',{deleteAt:null}).includes('data-mm-keep'),'지우는 날이 없으면 없다');
  // F2: 보관 기한 쓸기(actorKind system)가 남긴 브랜드 기록은 사람이 지운 것처럼 보이지 않는다.
  assert.match(read('brand-desk-view.mjs'),/\(\{member:'손님',system:'자동'\}\)\[entry\.actorKind\]\|\|'직원'/);
});

test('묶음: 손님 오프라인 목록에 내 모델 모듈(직원 브랜드 데스크는 빼고), 서버가 두 모듈을 내준다',()=>{
  const sw=read('sw.js');
  assert.match(sw,/FILES\.push\(BASE\+'my-models\.mjs'\);/);assert.doesNotMatch(sw,/'brand-desk-view\.mjs'/);
  assert.match(sw,/const CACHE = 'synk-pulse-shell-v55-photo-shape-20261113';/);
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/'persona-view\.mjs','my-models\.mjs','brand-desk-view\.mjs','boot-locale\.js'\]\)files\['\/pulse-app\/'\+file\]/);
});

test('직원 브랜드 데스크 할 일: 삭제 요청인데 남은 참조가 없으면 「정리한 뒤」가 아니라 「정리 끝」 글(만료 · 삭제 운영 시험 P3)',async()=>{
  const desk=readFileSync(new URL('./public/pulse-app/brand-desk-view.mjs',import.meta.url),'utf8');
  const todo=desk.match(/^const TODO=\{[^\n]*\};$/m)?.[0],why=desk.match(/^const todoWhy=[^\n]*;$/m)?.[0];assert.ok(todo&&why);
  const {TODO,todoWhy}=(await import('node:vm')).runInNewContext(`${todo}\n${why}\n({TODO,todoWhy})`);
  const line=item=>TODO[todoWhy(item)]||item.why;
  assert.equal(line({why:'deletion_requested',projects:[{id:'p1',title:'탄산수'}],hidden:0}),'손님이 삭제를 요청했어요 — 아래 참조를 정리한 뒤 관리자가 지워요');
  assert.equal(line({why:'deletion_requested',projects:[],hidden:1}),'손님이 삭제를 요청했어요 — 아래 참조를 정리한 뒤 관리자가 지워요','볼 수 없는 프로젝트가 남아도 정리 전');
  assert.equal(line({why:'deletion_requested',projects:[],hidden:0,drafts:1}),'손님이 삭제를 요청했어요 — 아래 참조를 정리한 뒤 관리자가 지워요','24시간 안 초안 붙임이 남아도 정리 전(서버 삭제가 막는 것과 같다)');
  assert.equal(line({why:'deletion_requested',projects:[],hidden:0,drafts:0}),'손님이 삭제를 요청했어요 — 참조 정리가 끝났어요. 관리자가 지우면 돼요');
  assert.ok(desk.includes('item.drafts?`초안 붙임 ${item.drafts}개(24시간 안에 풀려요)`'),'남은 초안 붙임을 할 일 아래 작은 줄에');
  assert.equal(line({why:'retention_due',projects:[],hidden:0}),TODO.retention_due,'다른 할 일은 그대로');
  assert.match(desk,/\$\{esc\(TODO\[todoWhy\(item\)\]\|\|item\.why\)\}<\/b>/);
});
