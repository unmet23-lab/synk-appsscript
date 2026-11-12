// 고객 전용 인물 판 3 화면(2026-11-10, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/인물판3_설계_20261110.md 6절) — 의뢰서 맞춤 인물 칸 · 고객 방 인물 카드 다섯 · 상태 줄 · 일지 ·
// 1차안 인물 칸 · 직원 데스크 인물 칸 · 영어. 스위치를 끄면(인물 문서 없음) 화면은 판 3 전과 같다 — 바이트 대조는 브라우저 캡처(1440 · 390)가, 여기서는 그 갈래를 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {emptyAnswers,briefRows,slotCount,PERSONA_SLOTS,isPersonaSlot,personaKindLabel}=await import('./public/pulse-app/request-data.mjs');
const {roomModel,journalModel,draftModel,deskModel,deskChecks}=await import('./public/pulse-app/room-view.mjs');
const {roomView}=await import('./public/pulse-app/film-views.mjs');
const {personaModel,personaCard,personaLine,personaScreen,personaJournal,personaCopy,PERSONA_CONFIRM_OF,STATUS_LINE}=await import('./public/pulse-app/persona-view.mjs');
const {deskView}=await import('./public/pulse-app/desk-view.mjs');
const {setLocale,locale}=await import('./public/pulse-app/i18n.mjs');
const {PERSONA_SLOTS:SERVER_SLOTS,PERSONA_APPROVAL_FLOW,PERSONA_STATES,PERSONA_FINAL}=await import('./pulse-personas.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url),read=name=>readFileSync(new URL(name,appDir),'utf8');

const ID='11111111-1111-4111-8111-111111111111',REV='22222222-2222-4222-8222-222222222222',HASH='a'.repeat(64);
const look=[{id:'33333333-3333-4333-8333-333333333333',mimeType:'image/png',url:'/pulse/api/persona/media/33333333-3333-4333-8333-333333333333'},{id:'44444444-4444-4444-8444-444444444444',mimeType:'image/png',url:'/pulse/api/persona/media/44444444-4444-4444-8444-444444444444'}];
const clip=[{id:'55555555-5555-4555-8555-555555555555',mimeType:'video/mp4',url:'/pulse/api/persona/media/55555555-5555-4555-8555-555555555555'}];
const events=[{id:'e1',at:'2026-11-10T01:00:00.000Z',code:'sent',who:'me'},{id:'e2',at:'2026-11-10T02:00:00.000Z',code:'review',who:'staff'},{id:'e3',at:'2026-11-10T03:00:00.000Z',code:'quote',who:'staff'}];
// 서버 손님 보기(pulse-personas.mjs customerView)와 같은 꼴.
function view(status,extra={}){
  const turn={quote_review:'customer',reference_review:'customer',motion_review:'customer',needs_materials:'customer',withdrawn:'end',retired:'end'}[status]||'staff';
  const awaiting={quote_review:{kind:'scope',revisionId:null,viewedHash:HASH},reference_review:{kind:'reference',revisionId:REV,viewedHash:HASH},motion_review:{kind:'motion',revisionId:REV,viewedHash:HASH}}[status]||null;
  return {id:ID,kind:'virtual',status,step:{submitted:1,needs_materials:1,rights_pending:2,reviewing:2,quote_review:3,reference_making:4,reference_review:4,building:5,motion_review:6,ready:7}[status]||null,turn,name:'',why:'',
    request:{look:'20대 후반, 짧은 머리',use:'매장 진열대 앞',keep:'once'},sources:{identity:0,mood:1,files:[{id:'s1',fileName:'mood.png',purpose:'mood',at:'2026-11-10T01:00:00.000Z'}]},canAddSources:['submitted','needs_materials','rights_pending','reviewing'].includes(status),
    quote:{price:300000,days:7,revisions:2,scope:'기준 얼굴 1판 · 동작 시안 1편 · 이번 광고 사용',at:'2026-11-10T03:00:00.000Z'},
    revision:['reference_review','building','motion_review','ready'].includes(status)?{id:REV,number:1,reference:{assets:look,note:'정면 · 옆모습 두 장이에요.',at:'2026-11-10T04:00:00.000Z'},motion:status==='motion_review'||status==='ready'?{assets:clip,note:'웃는 표정 · 고개 돌리기까지 돼요.',at:'2026-11-10T05:00:00.000Z'}:null}:null,
    usage:null,awaiting,events,approvals:[],...extra};
}
function project({persona=null,state='check',castingSelection={}}={}){
  const request={status:state==='check'?'submitted':'confirmed',number:'P-1110-ABCD',submittedAt:'2026-11-10T00:00:00.000Z',...(state==='check'?{}:{confirmedAt:'2026-11-10T00:30:00.000Z'}),answers:{...emptyAnswers(),name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',modelChoice:'custom'},files:[],asks:state==='ask'?[{id:'q1',label:'병 색은 어떤 색인가요?',why:'',status:'open',at:'2026-11-10T01:00:00.000Z'}]:[],notes:[],rounds:[]};
  return {id:'p1',title:'합성 탄산수',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,studio:{assets:[],scenes:[],strategy:{revision:1,data:{castingSelection}},request},...(persona?{persona}:{})};
}
const count=(html,needle)=>html.split(needle).length-1;

test('맞춤 인물 사진 칸은 서버와 같은 id이고, 받은 자료 수 · 스크린 사진에 섞이지 않는다 — 의뢰서 「모델」 줄은 맞춤 인물 요청을 말한다',()=>{
  assert.deepEqual(PERSONA_SLOTS.map(slot=>slot.id),[...SERVER_SLOTS]);
  assert.ok(PERSONA_SLOTS.every(slot=>slot.persona&&isPersonaSlot(slot.id)));
  assert.equal(slotCount({slots:{front:{files:[1,2]},'persona-identity':{files:[1]},'persona-mood':{files:[1,2]}}}),2,'인물 사진은 프로젝트 자료가 아니다');
  const model=answers=>briefRows({...emptyAnswers(),...answers}).find(row=>row.key==='모델');
  assert.equal(model({modelChoice:'custom'}).value,'맞춤 인물 요청 · 새 가상 인물');
  assert.equal(model({modelChoice:'custom',personaRequest:{kind:'real',look:'',use:'',keep:'',relation:'',consentWay:''}}).value,'맞춤 인물 요청 · 실제 인물 출연');
  assert.equal(model({modelChoice:'none'}).value,'사람 없이 제품만','다른 고름은 판 3 전 그대로');
  assert.equal(personaKindLabel({personaRequest:{kind:''}}),'새 가상 인물','종류를 고르지 않으면 새 가상 인물(서버도 그렇게 채운다)');
});

test('의뢰서: 맞춤 인물 칩 · 요청 칸 · 확인 줄 · 권리 문장은 스위치가 켜졌을 때만 갈린다(꺼지면 판 3 전 글자 그대로)',()=>{
  const flow=read('request-flow.mjs');
  assert.match(flow,/\$\{ctx\.flags\?\.request\?chip\(t\('맞춤 인물 요청하기'\),a\.modelChoice==='custom','data-do="modelchoice" data-id="custom"'\):''\}/,'칩은 personaRequest일 때만');
  assert.match(flow,/if\(a\.modelChoice==='custom'&&ctx\.flags\?\.request\)return personaBlock\(a,ctx\);/,'요청 칸은 맞춤 인물을 골랐고 스위치가 켜졌을 때만');
  // 판 3 Fable F3(판 4에서 고침): 비우는 것은 공개 초안 길(photos)뿐 — 프로젝트 길 의뢰서는 스위치를 끈 뒤에도 진행 중인 인물 요청을 비우지 않는다.
  assert.match(flow,/if\(ctx\.photos&&a\.modelChoice==='custom'&&!ctx\.flags\.request\)a\.modelChoice='';/,'꺼진 스위치에서 공개 초안에 저장돼 있던 맞춤 인물 고름은 비운다');
  assert.match(flow,/if\(ctx\.flags\.request&&a\.personaRequest\.kind==='real'&&!ctx\.flags\.real\)a\.personaRequest\.kind='virtual';/,'실제 인물은 personaReal일 때만');
  assert.match(flow,/ctx\.flags\?\.real\?t\('영상 속 사람과 목소리는 모두 AI로 만들어요\. 실제 인물은 출연하실 분의 동의를 확인한 뒤에만 만들어요\.'\):t\('영상 속 사람과 목소리는 모두 AI로 만들어요\. 실존 인물을 닮게 만드는 요청은 받지 않아요\.'\)/,'권리 칸 문장은 personaReal일 때만 바뀐다');
  assert.match(flow,/slot\.id!=='persona-identity'\|\|real\|\|filesOf\(a,slot\.id\)\.length/,'출연하실 분의 사진 칸은 실제 인물일 때(또는 지울 사진이 있을 때)만');
  assert.match(flow,/ctx\.photos\?`<div class="sx-slots">/,'사진 칸은 초안 길(공개 의뢰서)만 — 프로젝트 길은 고객 방에서');
  assert.match(flow,/t\('견적을 확인하시기 전에는 비용이 생기지 않아요\.'\)/);
  assert.match(flow,/t\('사진은 PULSE 제작팀만 보고, 이 인물을 검토하고 만드는 데만 써요\.'\)/,'사진 쓰임 한 줄');
  const block=flow.slice(flow.indexOf('function personaBlock('),flow.indexOf('function withPersonaRow('));
  const said=[...block.matchAll(/t\('([^']+)'\)/g)].map(m=>m[1]).join('\n');
  assert.ok(said.includes('원하는 인상 · 나이대 · 헤어'));
  for(const key of ['국적','신장','몸무게','치수','학습'])assert.ok(!said.includes(key),`묻지 않는 칸: ${key}`);
});

test('의뢰서 백엔드: 공개 의뢰서는 응답 features로 스위치를 읽고 사진을 받고, 프로젝트 길은 사진 칸이 없다',async()=>{
  const {publicBackend,projectBackend}=await import('./public/pulse-app/request-backend.mjs');
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response(JSON.stringify({draft:null,features:{locales:['ko'],personaRequest:true,personaReal:false}}),{status:200,headers:{'Content-Type':'application/json'}});
    const open=await publicBackend();
    // models(판 4): 내 모델 다시 쓰기 스위치(myModels).
    assert.deepEqual(open.personaFlags(),{request:true,real:false,models:false});assert.equal(open.personaPhotos,true);
    globalThis.fetch=async()=>new Response(JSON.stringify({draft:null,features:{locales:['ko'],personaRequest:false,personaReal:true,myModels:true}}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.deepEqual((await publicBackend()).personaFlags(),{request:false,real:false,models:true},'실제 인물은 인물 접수가 켜져 있을 때만');
  }finally{globalThis.fetch=original;}
  const room=projectBackend({project:()=>({revision:1,studio:{request:{answers:emptyAnswers()}}}),csrf:()=>'c',accept(){},features:()=>({personaRequest:true,personaReal:true})});
  assert.deepEqual(room.personaFlags(),{request:true,real:true,models:false});assert.equal(room.personaPhotos,false);
  assert.deepEqual(projectBackend({project:()=>({revision:1,studio:{}}),csrf:()=>'c',accept(){}}).personaFlags(),{request:false,real:false,models:false},'features가 없으면 꺼진 쪽');
  assert.match(read('app.mjs'),/projectBackend\(\{project:\(\)=>s\.project,csrf:\(\)=>s\.csrf,accept,step,features:\(\)=>projectFeatures\}\)/);
});

test('고객 방: 인물이 없으면 인물 칸도 일지 줄도 없다(판 3 전 모양)',()=>{
  const plain=project();
  assert.equal(roomModel(plain).persona,null);
  const html=roomView(roomModel(plain),{bar:false});
  assert.ok(!html.includes('sx-persona')&&!html.includes('data-persona'),'인물 마크업 없음');
  assert.ok(html.includes('맞춤 인물 요청 · 새 가상 인물'),'보내 주신 의뢰서의 모델 줄은 고른 것을 그대로 말한다');
  assert.ok(!journalModel(plain).items.some(item=>item.id.startsWith('p:')));
  assert.equal(draftModel(plain),null);
});

test('카드마다 승인은 하나, 무엇을 확인하는지 한 문장, 「모두 승인」 없음 — 고칠 점은 견적 · 기준 얼굴 · 동작 시안만',()=>{
  assert.deepEqual(Object.keys(PERSONA_CONFIRM_OF).sort(),Object.keys(PERSONA_APPROVAL_FLOW).sort(),'승인 종류가 서버 전이 표와 같다');
  const ready=view('ready',{turn:'customer',usage:{brand:'합성',product:'탄산수',purpose:'출시 광고',media:'릴스',regions:'한국',period:'2027년 3월까지',fee:'',schedule:'',note:'',setAt:'2026-11-10T06:00:00.000Z',approved:false,approvedAt:''},awaiting:{kind:'usage',revisionId:REV,viewedHash:HASH}});
  for(const [kind,v] of [['scope',view('quote_review')],['reference',view('reference_review')],['motion',view('motion_review')],['usage',ready]]){
    const m=personaModel({persona:v});assert.equal(m.card,kind);
    const html=personaCard(m);
    assert.equal(count(html,'data-room-do="persona-approve"'),1,kind+' 승인 단추 하나');
    assert.equal(count(html,'sx-persona-confirm'),1,kind+' 확인 문장 하나');
    assert.ok(!html.includes('모두 승인'),kind);
    assert.equal(count(html,'data-form="persona-changes"'),kind==='usage'?0:1,kind+' 고칠 점 칸');
    assert.ok(html.includes('data-persona-hold')&&/data-persona-hold role="status" hidden/.test(html),kind+' 「먼저 보내 주세요」는 글이 있을 때만 보인다');
    if(kind==='usage')assert.ok(html.includes('data-room-do="journal"'),'사용 확인은 고칠 점 대신 담당자에게 묻기');
    assert.ok(html.includes(`<b class="sx-no">${PERSONA_CONFIRM_OF[kind]}</b>`),kind+' 맞춤 인물 확인 번호(영상 전 확인과 따로)');
  }
  const scope=personaCard(personaModel({persona:view('quote_review')}));
  assert.ok(scope.includes('30만원')&&scope.includes('7일')&&scope.includes('2회')&&scope.includes('기준 얼굴 1판 · 동작 시안 1편'),'견적 넷');
  const reference=personaCard(personaModel({persona:view('reference_review')}));
  assert.equal(count(reference,'<img src="/pulse/api/persona/media/'),2,'기준 얼굴 그림 둘(초대 세션의 인물 자료 주소)');
  assert.ok(reference.includes('정면 · 옆모습 두 장이에요.'),'담당자 설명');
  const motion=personaCard(personaModel({persona:view('motion_review')}));
  assert.ok(/<video src="\/pulse\/api\/persona\/media\/[^"]+" controls playsinline/.test(motion),'동작 시안은 손님이 틀어 보는 영상');
  assert.ok(motion.includes('웃는 표정 · 고개 돌리기까지 돼요.'),'되는 표현과 한계');
  const usage=personaCard(personaModel({persona:ready}));
  assert.ok(usage.includes('출시 광고')&&usage.includes('2027년 3월까지')&&!usage.includes('<dt>비용</dt>'),'사용 범위는 적힌 칸만');
});

test('자료 보완 카드 · 상태 줄: 사진은 가상 인물이면 분위기 참고만, 실제 인물이면 둘 다 — 저희 차례는 작은 한 줄',()=>{
  const virtual=personaCard(personaModel({persona:view('needs_materials',{why:'정면 사진이 한 장 더 필요해요.'})}));
  assert.ok(virtual.includes('정면 사진이 한 장 더 필요해요.'),'직원의 「왜」 한 줄');
  assert.ok(virtual.includes('data-persona-file="mood"')&&!virtual.includes('data-persona-file="identity"'),'가상 인물에 남의 얼굴을 재현하는 길을 열지 않는다');
  assert.ok(!virtual.includes('persona-approve'),'자료 보완은 승인이 아니다');
  const real=personaCard(personaModel({persona:view('needs_materials',{kind:'real'})}));
  assert.ok(real.includes('data-persona-file="identity"')&&real.includes('data-persona-file="mood"'));
  // 판 4 상태(paused · deleting · deleted)와 읽을 때 계산하는 expired까지 모두 한 줄이 있다(판 4 화면 단계에서 거름을 지웠다).
  for(const state of [...PERSONA_STATES.filter(state=>state!=='ready'),'expired'])assert.ok(STATUS_LINE[state],state+' 상태 한 줄');
  assert.ok(personaLine(personaModel({persona:view('paused')})).includes('사용을 멈춘 인물이에요'),'사용 중지 인물의 한 줄');
  const line=personaLine(personaModel({persona:view('reviewing')}));
  assert.ok(line.includes('만들 수 있는지 검토하고 있어요')&&line.includes('2/7'),'저희 차례 줄');
  assert.ok(line.includes('data-persona-file="mood"'),'검토 중에도 사진을 더 보낼 수 있다(프로젝트 길 의뢰서는 여기서 처음 보낸다)');
  assert.ok(!personaLine(personaModel({persona:view('building')})).includes('data-persona-file'),'만드는 중에는 사진을 받지 않는다');
  const ended=personaLine(personaModel({persona:view('withdrawn',{why:'이번에는 진행하지 않기로 했어요.'})}));
  assert.ok(ended.includes('요청을 거뒀어요')&&ended.includes('이번에는 진행하지 않기로 했어요.')&&!ended.includes('/7'));
  assert.ok(personaLine(personaModel({persona:view('ready',{turn:'done'})})).includes('이번 광고에 쓰기로 하셨어요'));
  for(const state of PERSONA_FINAL)assert.equal(personaModel({persona:view(state)}).card,'','끝난 인물에는 카드가 없다');
});

test('고객 방: 영상 쪽이 저희 차례면 인물이 「지금 차례」(머리 글 · 카드 · 스크린), 영상 쪽도 손님 차례면 인물 카드는 아래에 제 머리를 단다',()=>{
  const main=roomView(roomModel(project({persona:view('reference_review')})),{bar:false});
  assert.match(main,/<i class="is-you" aria-hidden="true"><\/i>내 차례<span>맞춤 인물 확인 <b class="sx-no">2\/4<\/b><\/span><\/p>/,'영상 전 확인 번호 대신 맞춤 인물 확인 번호');
  assert.match(main,/<h1 class="sx-display" data-room-title>기준 얼굴을 확인해 주세요<\/h1>/);
  assert.match(main,/<div class="sx-room-screen"><img class="sx-q-fill" src="\/pulse\/api\/persona\/media\/33333333/,'스크린에 기준 얼굴');
  assert.equal(count(main,'<section class="sx-persona"'),1);
  assert.ok(!main.includes('sx-persona-kicker'),'머리는 방 머리가 그린다');
  const below=roomView(roomModel(project({persona:view('quote_review'),state:'ask'})),{bar:false});
  assert.match(below,/data-room-title>이것만 더 알려 주세요<\/h1>/,'영상 쪽 손님 차례가 먼저');
  assert.ok(below.includes('sx-persona-kicker')&&below.includes('<h2 class="sx-serif">맞춤 인물 견적을 확인해 주세요</h2>'),'인물 카드는 제 머리를 단다');
  const withJournal=roomView(roomModel(project({persona:view('quote_review'),state:'ask'})),{bar:false,journal:'<aside data-journal></aside>'});
  assert.ok(withJournal.indexOf('<section class="sx-persona"')>withJournal.indexOf('<aside data-journal>'),'되묻기 답 칸(일지 맨 위)과 되묻기 글 사이에 인물 카드가 끼지 않는다');
  const ours=roomView(roomModel(project({persona:view('building')})),{bar:false});
  assert.match(ours,/data-room-title>지금은 저희 차례예요<\/h1>/);
  assert.ok(ours.includes('sx-persona is-line')&&ours.includes('인물을 준비하고 있어요'),'저희 차례 인물은 작은 한 줄');
  assert.equal(personaCopy(personaModel({persona:view('building')})),null);
  assert.equal(personaScreen(personaModel({persona:view('quote_review')})),'','견적 차례는 방의 스크린 그대로');
});

test('일지: 인물 일이 한 줄씩 — 손님 일은 나, 직원 일은 담당자, 지금 손님 차례를 연 줄에만 「열기」',()=>{
  const p=project({persona:view('quote_review')}),items=journalModel(p).items.filter(item=>item.id.startsWith('p:'));
  assert.deepEqual(items.map(item=>[item.who,item.name,item.what]),[['staff','김하늘','맞춤 인물 견적을 보냈어요'],['staff','김하늘','맞춤 인물 검토를 시작했어요'],['me','나','맞춤 인물을 요청했어요']]);
  assert.deepEqual(items.find(item=>item.id==='p:e3').go,{tab:'overview'});
  assert.equal(items.find(item=>item.id==='p:e2').go,null);
  assert.equal(personaJournal(project(),{me:'나',owner:'김하늘'}).length,0);
});

test('1차안: 이번 광고 사용을 확인해 붙은 인물이면 모델 칸 대신 그 인물의 기준 얼굴',()=>{
  const p=project({persona:view('ready',{turn:'done',name:'하루'}),state:'script',castingSelection:{personaRef:{personaId:ID,revisionId:REV}}});
  p.studio.scenes=[{id:'c1',revision:1,title:'첫 컷',description:'진열대 앞',duration:3,visibility:'customer'}];
  p.studio.request.rounds=[{round:1,kind:'script',scenes:[{id:'c1'}],oneLine:'한 캔에 다섯 맛',sentAt:'2026-11-10T07:00:00.000Z'}];
  const d=draftModel(p);
  assert.equal(d.model,null);assert.deepEqual(d.persona,{name:'하루',image:look[0].url});
  const other=project({persona:view('ready',{turn:'done'}),state:'script',castingSelection:{personaRef:{personaId:ID,revisionId:'66666666-6666-4666-8666-666666666666'}}});
  other.studio.scenes=p.studio.scenes;other.studio.request.rounds=p.studio.request.rounds;
  assert.equal(draftModel(other).persona,undefined,'다른 판을 가리키면 그리지 않는다(서버 가드가 막는 판)');
  assert.ok(read('film-views.mjs').includes("t('이번 광고에 쓰기로 하신 맞춤 인물')"));
});

test('승인 · 고칠 점은 서버가 계산한 차례와 화면 요청 키로 — 같은 차례 같은 결정은 같은 키, 새 판은 다시 읽고 알린다, 쓰던 고칠 점이 있으면 승인 안 함',()=>{
  const app=read('app.mjs');
  assert.match(app,/request\('\/pulse\/api\/persona\/approve',\{\.\.\.options\(\),body:\{personaId:view\.id,kind:want\.kind,revisionId:want\.revisionId,viewedHash:want\.viewedHash,idempotencyKey:personaKey\(want\.viewedHash,decision\),decision,/);
  assert.match(app,/const personaKey=\(hash,decision\)=>\{const key=hash\+':'\+decision;if\(!personaKeys\.has\(key\)\)personaKeys\.set\(key,freshKey\(\)\);return personaKeys\.get\(key\);\};/);
  assert.match(app,/if\(error\.code!=='SYNK_PULSE_PERSONA_STALE'\)throw error;stale=true;return request\('\/pulse\/api\/project'\);/,'옛 판이면 최신을 읽어 다시 그린다');
  assert.match(app,/stale\?t\('새 판이 도착했어요\. 새 판을 보고 다시 확인해 주세요\.'\)/);
  assert.match(app,/if\(!stale&&key\)clearDraft\(key,revision\);/,'새 판으로 막힌 고칠 점은 지우지 않는다');
  assert.match(app,/if\(decision==='approve'\)\{const area=main\.querySelector\('form\[data-form="persona-changes"\] textarea'\);if\(area\?\.value\.trim\(\)\)\{notice\(t\('적으신 고칠 점을 먼저 보내 주세요\./);
  assert.match(app,/request\('\/pulse\/api\/persona\/source',\{\.\.\.options\(\),file,headers:\{[^}]*'X-Persona-Purpose':purpose\}\}\)/,'사진은 인물 출처 길로(프로젝트 자료 길이 아니다)');
  assert.match(app,/onPersona:\(\{decision\}\)=>personaDecide\(\{decision\}\),onPersonaFiles:sendPersonaFiles/);
  assert.match(read('film-views.mjs'),/if\(what==='persona-approve'\)\{onPersona\?\.\(\{decision:'approve',button\}\);return;\}/);
  const KEY=/^[A-Za-z0-9_-]{8,80}$/;assert.ok(KEY.test(randomUUID()),'화면 키 꼴이 서버 KEY 규칙에 맞는다');
});

test('직원 데스크: 다음 행동 한 줄 · 서버가 허락한 전이만 · 영어 프로젝트만 영어 칸 · 맞춤 인물 의뢰는 모델 제안을 띄우지 않는다',()=>{
  const staff=(extra={})=>({id:ID,kind:'virtual',status:'reviewing',step:2,revision:4,workspaceId:null,originProjectId:'p1',request:{look:'20대',use:'매장',keep:'once'},displayName:'',why:'',quote:null,staffNote:'',currentRevisionId:null,createdAt:'2026-11-10T01:00:00.000Z',updatedAt:'2026-11-10T02:00:00.000Z',history:[],next:'만들 수 있는지 보고 견적 · 범위를 보내요',usageDone:false,locale:'ko',canEdit:true,actions:['request_materials','send_quote','withdraw'],canOpenRevision:true,sources:[{id:'s1',purpose:'mood',fileName:'mood.png',mimeType:'image/png',byteSize:10,inline:true,at:'2026-11-10T01:00:00.000Z',url:`/api/personas/${ID}/media/s1`}],revisions:[],approvals:[],usage:null,consent:null,...extra});
  const p=project({state:'prepare'}),model=deskModel(p);
  const html=deskView({...model,queue:[],canEdit:true,personas:[staff()]},{bar:false});
  assert.ok(html.includes('만들 수 있는지 보고 견적 · 범위를 보내요'),'다음 행동 한 줄');
  assert.deepEqual([...html.matchAll(/data-persona-action="([a-z_]+)"/g)].map(m=>m[1]).filter(action=>['request_materials','ask_rights','start_review','send_quote','publish_reference','publish_motion','withdraw','retire'].includes(action)),['request_materials','send_quote','withdraw'],'서버가 허락한 전이만(서버 차례 그대로)');
  assert.match(html,/data-persona-action="send_quote"[^]*?<button type="submit" class="btn-main">견적 · 범위 보내기<\/button>/,'앞으로 가는 일(견적)은 굵은 단추');
  assert.ok(html.includes(`src="/api/personas/${ID}/media/s1"`),'손님 사진은 직원 길로');
  assert.ok(!html.includes('Tr"'),'한국어 프로젝트는 영어 칸이 없다');
  const en=deskView({...model,queue:[],canEdit:true,personas:[staff({locale:'en'})]},{bar:false});
  assert.ok(en.includes('name="whyTr"')&&en.includes('name="scopeTr"'),'영어 프로젝트는 손님에게 보이는 칸마다 영어 칸');
  assert.ok(!en.includes('name="textTr"'),'내부 메모는 영어 칸이 없다');
  assert.equal(model.needsModel,false,'맞춤 인물 의뢰는 모델 제안을 띄우지 않는다');
  assert.ok(deskChecks(p).some(item=>item.label.startsWith('맞춤 인물 의뢰예요')),'자동 점검이 인물 칸을 가리킨다');
  assert.ok(!deskChecks(p).some(item=>item.label==='모델을 제안해 확인받아야 해요'));
  const viewOnly=deskView({...model,queue:[],canEdit:false,personas:[staff({canEdit:false,actions:[]})]},{bar:false});
  assert.ok(!viewOnly.includes('data-form="desk-persona'),'보기 전용은 폼이 없다');
  const app=read('app.mjs'),views=read('views.mjs');
  assert.match(app,/const deskNoModel=\(a,selection\)=>personaRefOf\(selection\?\.personaRef\)\?\{noModel:true,noModelKind:'persona'\}:MODEL_OPTIONAL_CHOICES\.includes\(a\.modelChoice\)\?\{noModel:true,noModelKind:a\.modelChoice\}:\{noModel:false\};/,'방향 대화상자: 맞춤 · 전용 인물도 모델 없이');
  assert.ok(views.includes("none:'사람 없이 제품만 나오는 의뢰라 모델은 보내지 않아요.'"),'사람 없이 안내는 판 3 전 글자 그대로');
});

test('영어 화면: 인물 카드 · 상태 줄 · 일지 줄에 남는 한글은 손님 · 직원이 적은 글뿐이다',async()=>{
  try{
    await setLocale('en');assert.equal(locale(),'en');
    const own=['기준 얼굴 1판 · 동작 시안 1편 · 이번 광고 사용','정면 · 옆모습 두 장이에요.','웃는 표정 · 고개 돌리기까지 돼요.','20대 후반, 짧은 머리','2027년 3월까지','출시 광고','탄산수','합성','릴스','한국','김하늘'];
    const strip=html=>html.replace(/<[^>]+>/g,' ').replace(/"[^"]*"/g,' ');
    const ready=view('ready',{turn:'customer',usage:{brand:'합성',product:'탄산수',purpose:'출시 광고',media:'릴스',regions:'한국',period:'2027년 3월까지',fee:'',schedule:'',note:'',setAt:'x',approved:false,approvedAt:''},awaiting:{kind:'usage',revisionId:REV,viewedHash:HASH}});
    const parts=[...['quote_review','reference_review','motion_review','needs_materials'].map(state=>personaCard(personaModel({persona:view(state)}))),personaCard(personaModel({persona:ready})),personaCard(personaModel({persona:view('quote_review')}),{main:true}),...['submitted','rights_pending','reviewing','reference_making','building','withdrawn'].map(state=>personaLine(personaModel({persona:view(state)}))),roomView(roomModel(project({persona:view('reference_review')})),{bar:false})];
    for(const html of parts){const left=own.reduce((text,word)=>text.split(word).join(' '),strip(html));assert.ok(!/[가-힣]/.test(left),left.match(/[^\s]*[가-힣][^\s]*/g)?.slice(0,6).join(' | '));}
    assert.ok(parts[0].includes('KRW 300,000'),'값은 원화 그대로');
    const lines=personaJournal(project({persona:{...view('quote_review'),events:[...events,{id:'e4',at:'z',code:'scope_ok',who:'me'},{id:'e5',at:'z',code:'rights',who:'staff'}]}}),{me:'You',owner:'Your producer'});
    assert.ok(lines.every(item=>!/[가-힣]/.test(item.what)&&/^[a-z]/.test(item.what)),'일지 줄은 이름 뒤에 잇는 소문자 동사구');
  }finally{await setLocale('ko');}
});

// 켠 합성 프로젝트로 서버를 띄워 실제 손님 보기를 그대로 그린다: 접수 → 직원 검토 → 견적 → 기준 얼굴 → 동작 시안 → 사용 확인(한국어 · 영어).
test('끝까지(실제 서버 응답): 의뢰서 접수부터 이번 광고 사용 확인까지 고객 방이 차례마다 맞는 카드를 그린다 — 영어 프로젝트도',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-persona3-screen-'));
  const {createCompanyApp}=await import('./server.mjs');
  const app=createCompanyApp({dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({name:'김하늘',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.from([0,0,2,0]),Buffer.from('isomiso2'),Buffer.alloc(64)]);
  const parse=async response=>{let data=null;try{data=await response.json();}catch{}return {status:response.status,data};};
  const staff=async(path,{body,raw,headers={}}={})=>parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));
  const must=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result.data).slice(0,300));return result.data;};
  must(await staff('/api/settings/pulse-features',{body:{publicLocales:['ko'],projectLocales:['ko','en'],personaRequest:true}}));
  for(const lang of ['ko','en']){
    const jar=new Map();
    const call=async(path,{body,raw,headers={},csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});for(const line of response.headers.getSetCookie?.()||[]){const [pair]=line.split(';'),[k,v]=pair.split('=');if(v)jar.set(k,v);else jar.delete(k);}return parse(response);};
    const draft=must(await call('/pulse/api/request/start',{body:{}}),201).draft;
    must(await call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':'mood.png','X-Request-Slot':'persona-mood'}}),201);
    const answers={name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,modelChoice:'custom',personaRequest:{kind:'virtual',look:'20대 후반, 짧은 머리',use:'매장 진열대 앞',keep:'once',relation:'',consentWay:''},...(lang==='en'?{contactLocale:'en'}:{})};
    must(await call('/pulse/api/request/submit',{body:{answers},csrf:draft.csrf}),201);
    const room=async()=>must(await call('/pulse/api/project'));
    await setLocale(lang);
    try{
      const draw=async()=>{const state=await room();return {state,model:roomModel(state.project),html:roomView(roomModel(state.project),{bar:false})};};
      let now=await draw();
      assert.equal(now.model.persona.status,'submitted');assert.ok(now.html.includes('sx-persona is-line'),lang+' 접수: 저희 차례 한 줄');
      const personaId=now.model.persona.id,act=async body=>{const current=app.store.get('pulsePersonas',personaId);return must(await staff('/api/personas/'+personaId,{body:{revision:current.revision,...body}}));};
      const desk=must(await staff(`/api/client-projects/${now.state.project.id}/studio`)).project;
      assert.equal(desk.personas.length,1);assert.ok(deskView({...deskModel(desk),queue:[],canEdit:true,personas:desk.personas},{bar:false}).includes('data-persona-action="start_review"'),'직원 데스크에 검토 시작');
      await act({action:'start_review'});
      await act({action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴 1판 · 동작 시안 1편',...(lang==='en'?{translation:{scope:'One reference look and one motion test'}}:{})});
      now=await draw();assert.equal(now.model.persona.card,'scope');
      assert.ok(now.html.includes(lang==='en'?'One reference look and one motion test':'기준 얼굴 1판 · 동작 시안 1편'),lang+' 견적 범위(영어 프로젝트는 직원 영어)');
      const approve=async decision=>{const state=await room(),want=state.project.persona.awaiting;return must(await call('/pulse/api/persona/approve',{body:{personaId,kind:want.kind,revisionId:want.revisionId,viewedHash:want.viewedHash,idempotencyKey:randomUUID(),decision},csrf:state.csrf}));};
      await approve('approve');
      now=await draw();assert.equal(now.model.persona.status,'reference_making');assert.ok(now.html.includes('sx-persona is-line'));
      await act({action:'open_revision'});
      const revisionId=app.store.all('pulsePersonaRevisions').find(item=>item.personaId===personaId).id;
      const upload=async(role,bytes,type,name)=>{const current=app.store.get('pulsePersonas',personaId);return must(await staff(`/api/personas/${personaId}/revisions/${revisionId}/media`,{raw:bytes,headers:{'Content-Type':type,'X-File-Name':name,'X-Persona-Role':role,'X-Persona-Revision':String(current.revision)}}),201);};
      await upload('reference',png,'image/png','front.png');
      await act({action:'publish_reference',revisionId,note:'정면 한 장이에요.',...(lang==='en'?{translation:{note:'One front view.'}}:{})});
      now=await draw();assert.equal(now.model.persona.card,'reference');assert.match(now.html,/<div class="sx-room-screen"><img class="sx-q-fill" src="\/pulse\/api\/persona\/media\//,lang+' 스크린에 기준 얼굴');
      const shown=now.model.persona.reference.assets[0].url,media=await fetch(base+shown,{headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}});assert.equal(media.status,200,'카드의 그림 주소가 손님 세션으로 열린다');
      await approve('approve');
      await upload('motion',mp4,'video/mp4','motion.mp4');
      await act({action:'publish_motion',revisionId,note:'웃는 표정까지 돼요.',...(lang==='en'?{translation:{note:'Smiles work.'}}:{})});
      now=await draw();assert.equal(now.model.persona.card,'motion');assert.ok(/<video src="\/pulse\/api\/persona\/media\/[^"]+" controls/.test(now.html));
      await approve('approve');
      await act({action:'set_usage',brand:'합성',product:'탄산수',purpose:'출시 광고',media:'릴스',regions:'한국',period:'2027년 3월까지',fee:'',schedule:'',note:'',...(lang==='en'?{translation:{brand:'Synthetic',product:'Sparkling water',purpose:'Launch ad',media:'Reels',regions:'Korea',period:'Until March 2027'}}:{})});
      now=await draw();assert.equal(now.model.persona.card,'usage');assert.ok(now.html.includes(lang==='en'?'Launch ad':'출시 광고'));
      await approve('approve');
      now=await draw();assert.equal(now.model.persona.turn,'done');assert.ok(now.html.includes('sx-persona is-line'));
      assert.ok(journalModel(now.state.project).items.filter(item=>item.id.startsWith('p:')).length>=10,'일지에 인물 일이 남는다');
      if(lang==='en'){const left=now.html.replace(/<[^>]+>/g,' ').replace(/"[^"]*"/g,' ');for(const word of ['합성 탄산수','김하늘','나'])void word;assert.ok(!/맞춤 인물|기준 얼굴|동작 시안|이번 광고/.test(left),'영어 프로젝트에 인물 고정 글이 한국어로 남지 않는다');}
    }finally{await setLocale('ko');}
  }
});

test('90일 시계 화면(판 4 설계 11-6): 손님 차례 카드 · 지운 뒤 한 줄 · 직원 인물 칸 지우는 날 · 예고 · 날짜를 못 읽음 · 묘비 · 내부 확인 점검 줄 — 한국어 · 영어',async()=>{
  const {myModelsView}=await import('./public/pulse-app/my-models.mjs');
  const deleteAt='2027-02-08T03:00:00.000Z';
  // 손님 차례 카드 끝에 지우는 날 한 줄(서버가 deleteAt을 실었을 때만). 저희 차례 한 줄 · 서버가 안 실은 카드에는 없다.
  const card=personaCard(personaModel({persona:view('quote_review',{deleteAt})}));
  // 날짜 자리가 비지 않는다(서버 2027-02-08T03:00Z → 한국 날짜 2027-02-08 → 「2월 8일」 꼴, 화면 카본 B2).
  assert.match(card,/<p class="sx-small sx-persona-clock">[^<]*2월 8일[^<]*까지 진행이 없으면 보내 주신 사진과 인물을 지워요\.<\/p><\/section>$/);
  assert.ok(!personaCard(personaModel({persona:view('quote_review')})).includes('sx-persona-clock'),'서버가 안 실으면 줄도 없다');
  assert.ok(!personaLine(personaModel({persona:view('reviewing',{deleteAt})})).includes('sx-persona-clock'),'저희 차례 한 줄에는 두지 않는다');
  // 지운 뒤: 서버가 personaRemoved({at})만 준다 — 인물 칸 대신 그 한 줄, 인물 그림 · 단추 · 일지 줄은 없다.
  const removed={...project(),personaRemoved:{at:deleteAt}},room=roomModel(removed);
  assert.equal(room.persona,null);assert.deepEqual(room.personaRemoved,{at:deleteAt});
  const html=roomView(room,{bar:false});
  assert.equal(count(html,'data-persona-removed'),1);assert.match(html,/2월 8일[^<]*에 90일 동안 진행이 없어 보내 주신 사진과 인물을 지웠어요\. 다시 맡기시려면 담당자에게 알려 주세요\. <button type="button" class="sx-quiet" data-room-do="journal">담당자에게 묻기<\/button>/,'이 방에는 사진 올릴 자리가 없으니 담당자에게 묻기로(화면 카본 A1)');
  assert.ok(!html.includes('data-persona-card')&&!html.includes('data-room-do="persona-approve"'));
  assert.ok(!roomView(roomModel(project()),{bar:false}).includes('data-persona-removed'),'묘비가 없으면 판 3 전 모양 그대로');
  // 내 모델 보관 대기 카드: 그 광고가 멈춰 있으면 「{날짜}까지 보관에 동의하지 않으면 지워요」.
  const pendingCard=extra=>myModelsView({view:'list',data:{workspaces:[{id:'w1',name:'가 브랜드',role:'admin',models:[],pending:[{id:ID,name:'하루',kind:'virtual',revisionId:REV,image:null,consent:null,...extra}]}]}});
  assert.match(pendingCard({deleteAt}),/원래 광고에 진행이 없으면 [^<]*2월 8일[^<]*에 지워요\. 그 전에 보관을 정하면 남겨 둬요\.<\/p>/,'보관하지 않아도 원래 광고가 움직이면 남는다(화면 카본 A2)');
  assert.ok(!pendingCard({}).includes('sx-mm-clock'));
  // 영어: 네 문장 모두 사전에 있고, 날짜 자리에 그 언어 날짜가 들어간다.
  await setLocale('en');
  try{
    // 「by」는 하루 앞 날짜 — 서버는 그 한국 날짜가 끝날 때 지우므로, 손님 시간대가 어디든 보인 날 안에는 지우지 않는다(화면 Fable 5.2 최종 P1).
    assert.match(personaCard(personaModel({persona:view('quote_review',{deleteAt})})),/If there’s no activity by [^<]*Feb 7[^<]*, we’ll delete the photos you sent and the persona\./);
    assert.match(roomView(roomModel(removed),{bar:false}),/On [^<]*Feb[^<]*, we deleted the photos you sent and the persona because there had been no activity for 90 days\. If you’d like to start again, let your producer know\./);
    assert.match(pendingCard({deleteAt}),/If there’s no activity on the original ad, we’ll delete this model on [^<]*Feb[^<]*\. Choose to keep it before then and it stays\./);
    // 의뢰서 맞춤 인물 칸의 두 의뢰서 공통 문장도 사전에 있다(화면 카본 B1).
    const {t}=await import('./public/pulse-app/i18n.mjs');
    assert.equal(t('제작으로 이어지지 않고 90일 동안 진행이 없으면 사진과 인물을 지워요.'),'If this doesn’t lead to production and there’s no activity for 90 days, we’ll delete the photos and the persona.');
  }finally{await setLocale('ko');}
  // 직원 인물 칸: 예고 전 · 예고 뒤 · 날짜를 못 읽음, 그리고 지운 뒤의 묘비 한 줄.
  const staff=(extra={})=>({id:ID,kind:'virtual',status:'ready',step:7,revision:4,workspaceId:null,originProjectId:'p1',request:{},displayName:'하루',why:'',quote:null,staffNote:'',currentRevisionId:null,createdAt:'2026-11-10T01:00:00.000Z',updatedAt:'2026-11-10T02:00:00.000Z',history:[],next:'이번 광고의 사용 범위를 적어 손님에게 보내요',usageDone:false,locale:'ko',canEdit:true,actions:[],canOpenRevision:false,sources:[],revisions:[],approvals:[],usage:null,consent:null,stopped:null,...extra});
  const p=project({state:'prepare'}),model=deskModel(p),desk=extra=>deskView({...model,queue:[],canEdit:true,...extra},{bar:false});
  assert.ok(desk({personas:[staff({stopped:{deleteAt,noticed:false,noticeAt:null,lastAt:'2026-11-10T03:00:00.000Z'}})]}).includes('이 프로젝트가 2027-02-08까지 움직이지 않으면 이 인물과 손님 사진을 지워요'));
  const noticed=desk({personas:[staff({stopped:{deleteAt,noticed:true,noticeAt:'2027-01-25T03:00:00.000Z',lastAt:'2026-11-10T03:00:00.000Z'}})]});
  assert.ok(noticed.includes('지우기 예고를 보냈어요 — <b>2027-02-08</b>에 이 인물과 손님 사진을 지워요(제작으로 이어지지 않았고 2026-11-10 뒤로 진행이 없어요)'));
  assert.ok(!noticed.includes('90일 동안 진행이 없었어요'),'예고 때는 아직 90일 전이라 과거형으로 쓰지 않는다(화면 카본 A4)');
  assert.ok(desk({personas:[staff({stopped:{unclear:true}})]}).includes('지우는 날을 셀 수 없어요'));
  // 정리된 의뢰의 인물: 보관을 먼저 풀어야 기록을 남길 수 있다는 것과 브랜드 보관 길(화면 Fable 5.2 최종 P2 · 카본 서버 끝 판 A1).
  const retiredLine=desk({personas:[staff({stopped:{deleteAt,noticed:false,noticeAt:null,lastAt:'2026-11-10T03:00:00.000Z',retired:true}})]});
  assert.ok(retiredLine.includes('정리된 의뢰의 인물이에요 — <b>2027-02-08</b>에 이 인물과 손님 사진을 지워요. 이어 가려면 그 전에 이 프로젝트의 보관을 풀고 기록을 남기거나, 브랜드 관리자가 「내 모델」에서 보관을 정해야 해요.'));
  assert.ok(!desk({personas:[staff()]}).includes('desk-persona-clock'),'제작한 프로젝트 · 브랜드 인물은 줄이 없다');
  const tomb=desk({personas:[],personaRemoved:{personaId:ID,name:'하루',kind:'virtual',at:deleteAt}});
  assert.ok(tomb.includes('data-persona-removed')&&tomb.includes('맞춤 인물 · 하루 · 지움')&&tomb.includes('2027-02-08에 지웠어요'));
  // 내부 확인 점검: 맞춤 인물 의뢰인데 지운 뒤면 「맞춤 인물 의뢰예요」 대신 지웠다는 줄 하나(모델 제안 줄도 겹치지 않는다).
  const checks=deskChecks({...p,personas:[],personaRemoved:{personaId:ID,at:deleteAt}});
  // 방향 제안이 있는 프로젝트에서도 지웠다는 줄이 선다(화면 카본 A3).
  const withDirection={...p,personas:[],personaRemoved:{personaId:ID,at:deleteAt},studio:{...p.studio,request:{...p.studio.request,directionProposal:{status:'open',round:1,options:[],modelId:''}}}};
  assert.ok(deskChecks(withDirection).some(item=>item.label.startsWith('맞춤 인물을 지웠어요')));
  assert.ok(checks.some(item=>item.label.startsWith('맞춤 인물을 지웠어요')));
  assert.ok(!checks.some(item=>item.label.startsWith('맞춤 인물 의뢰예요'))&&!checks.some(item=>item.label==='모델을 제안해 확인받아야 해요'));
});
