import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeRequestAnswers,REQUEST_SLOTS,REQUEST_KINDS,REQUEST_CHANNELS,REQUEST_PACKAGES} from './pulse-requests.mjs';
import {emptyAnswers,answersFromServer,answersForServer,briefRows,price,SLOTS,KINDS,CHANNELS,PACKAGES,MODEL_LINES,DRAFT_FILES_GONE} from './public/pulse-app/request-data.mjs';
import {publicBackend} from './public/pulse-app/request-backend.mjs';
import {roomRail} from './public/pulse-app/film-views.mjs';
import {roomState,roomStage,roomModel,draftModel,deskChecks,deskModel,usesRoom,ROOM_COPY,ROOM_STAGES} from './public/pulse-app/room-view.mjs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {projectView,welcome,dialogContent,picker,headerCrumb,header} from './public/pulse-app/views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';
import {deskQueue} from './public/pulse-app/room-view.mjs';

// 화면과 서버가 같은 말을 쓰는지. 어긋나면 자동 저장이 조용히 끊기거나 이어 쓰기에서 답이 사라진다(Fable 설계 검토 P1-3 · P1-4).
const full=()=>({...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],paid:true,package:'s15',slots:{logo:{none:true,files:[]},front:{files:[{id:'a',slot:'front',fileName:'a.png'}]}},size:'355ml',useNote:'뚜껑을 돌려요',pageUrl:'https://example.com/a',driveUrl:'https://example.com/d',audience:'20대',oneThing:'맛이 바뀐다',action:'buy',screenText:'톡',avoid:['갈증 해소'],avoidNote:'경쟁사',facts:'12만 개',win:'impact',refs:[{url:'https://youtu.be/x',points:['색감 · 빛'],why:'끝 장면'}],avoidFeel:'홈쇼핑',models:['M06','F02'],modelChoice:'',date:'2026-11-21',dateFree:false,approver:'many',approverName:'대표님',contactName:'김합성',company:'합성 음료',email:'a@pulse-synthetic.test',phone:'010-0000-0000',consent:true,rights:true});

test('the server accepts every field and every choice the page can send',()=>{
  assert.doesNotThrow(()=>normalizeRequestAnswers(answersForServer(emptyAnswers())));
  assert.doesNotThrow(()=>normalizeRequestAnswers(answersForServer(full()),{strict:true}));
  assert.deepEqual(KINDS.map(item=>item.id).sort(),[...REQUEST_KINDS].sort());
  assert.deepEqual(CHANNELS.map(item=>item.id).sort(),[...REQUEST_CHANNELS].sort());
  for(const item of PACKAGES)assert.ok(REQUEST_PACKAGES.includes(item.id),item.id);
  for(const slot of Object.values(SLOTS).flat())assert.ok(REQUEST_SLOTS.includes(slot.id),slot.id);
  for(const model of CASTING_MODELS)assert.ok(MODEL_LINES[model.id],model.id);
});
test('answers survive leaving and coming back: page, server, page, server',()=>{
  const once=normalizeRequestAnswers(answersForServer(full()));
  const files=[{id:'a',slot:'front',fileName:'a.png',inline:true}];
  const page=answersFromServer(once,files,file=>`/m/${file.id}`);
  assert.equal(page.slots.front.files[0].preview,'/m/a','files come back to their slot');
  assert.equal(page.slots.logo.none,true,'「지금 없어요」 stays');
  assert.equal(page.refs[0].points[0],'색감 · 빛');
  assert.deepEqual(normalizeRequestAnswers(answersForServer(page)),once);
});
test('a fresh draft from the server always has a reference row to write into',()=>{
  const page=answersFromServer(normalizeRequestAnswers({}),[]);
  assert.equal(page.refs.length,1);
  assert.deepEqual(page.refs[0],{url:'',points:[],why:''});
  assert.deepEqual(normalizeRequestAnswers(answersForServer(page)).refs,[]);
});
test('an empty brief still reads, and says what happens to each empty line',()=>{
  const rows=briefRows(emptyAnswers());
  assert.ok(rows.every(row=>row.key&&row.step));
  assert.ok(rows.find(row=>row.key==='연락처').missing);
  const named=briefRows({...emptyAnswers(),email:'a@pulse-synthetic.test'}).find(row=>row.key==='연락처');
  assert.ok(named.missing,'a name is needed too');
});
test('the brief shows what was written instead of files, and every reference that was kept',()=>{
  const row=(answers,key)=>briefRows({...emptyAnswers(),...answers}).find(item=>item.key===key);
  assert.ok(row({},'받은 자료').missing,'nothing yet says so');
  const written=row({kind:'food',pageUrl:'https://example.com/a',driveUrl:'https://example.com/d',useNote:'뚜껑을 돌려요'},'받은 자료');
  assert.equal(written.missing,'','a link or a line is not 「nothing yet」');
  assert.match(written.value,/제품 페이지 · 드라이브 링크 · 쓰는 모습 설명 · 아직 없음: 제품 정면 사진/);
  assert.match(row({kind:'food',slots:{front:{files:[{id:'a'},{id:'b'}]}}},'받은 자료').value,/^파일 2개 · 아직 없음: /);
  const reference=row({refs:[{url:'',points:['색감 · 빛'],why:''},{url:'https://youtu.be/x',points:[],why:'끝 장면'}]},'참고 광고');
  assert.equal(reference.missing,'');assert.equal(reference.value,'색감 · 빛 / https://youtu.be/x · 끝 장면');
  assert.equal(row({},'참고 광고').missing,'없음');
  assert.equal(price(9.929100000000002),'9.9만원');assert.equal(price(39),'39만원');
  const whys=new Set(['product','wear','app'].map(group=>SLOTS[group].find(slot=>slot.id==='use').why));assert.equal(whys.size,3,'each kind gets its own reason');
});
// 공개 초안이 기한으로 사라졌을 때: 서버는 401을 준다. 글은 새 초안으로 잇고, 파일이 사라진 채 조용히 접수되면 안 된다.
function fakeServer(t,{alive=false}={}){
  const calls=[];let live=alive,serial=0;
  const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  t.mock.method(globalThis,'fetch',async(path,options={})=>{
    const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({path,method,body,csrf:options.headers?.['X-Pulse-CSRF']});
    if(path==='/pulse/api/request')return json(200,{draft:{id:'old',status:'draft',step:'files',csrf:'old',answers:{name:'오미톡'},files:[{id:'f1',slot:'front',fileName:'a.png',inline:true,mimeType:'image/png'}]}});
    if(path==='/pulse/api/request/start'){live=true;serial+=1;return json(201,{draft:{id:'new'+serial,status:'draft',csrf:'new'+serial,answers:{},files:[]}});}
    if(!live)return json(401,{error:'이어 쓸 의뢰서를 찾지 못했어요. 처음부터 시작해 주세요.'});
    if(path==='/pulse/api/request/save')return json(200,{draft:{id:'new'+serial,status:'draft',answers:body.answers,files:[]}});
    if(path==='/pulse/api/request/submit')return json(200,{number:'P-1',at:'t'});
    return json(200,{draft:{}});
  });
  return {calls,expire(){live=false;}};
}
const dropFiles=backend=>{const seen=[];backend.onExpired=()=>{const gone=backend.answers.slots.front?.files?.length||0;if(backend.answers.slots.front)backend.answers.slots.front.files=[];seen.push(gone);return gone;};return seen;};
test('an expired draft moves the words to a new draft and takes the lost files off the page',async t=>{
  const server=fakeServer(t),backend=await publicBackend(),seen=dropFiles(backend);
  await backend.save(backend.answers,'files');
  assert.deepEqual(seen,[1],'the page hears about the lost file');
  assert.deepEqual(backend.answers.slots.front.files,[]);
  assert.deepEqual(server.calls.map(call=>call.path),['/pulse/api/request','/pulse/api/request/save','/pulse/api/request/start','/pulse/api/request/save']);
  assert.equal(server.calls.at(-1).body.answers.name,'오미톡','the words survive');
  assert.equal(server.calls.at(-1).csrf,'new1','the new draft signs the retry');
});
test('sending an expired draft does not quietly drop its files: the words are kept and the customer is told',async t=>{
  const server=fakeServer(t),backend=await publicBackend();dropFiles(backend);
  await assert.rejects(backend.submit(backend.answers),error=>error.message===DRAFT_FILES_GONE&&error.status===401);
  assert.equal(server.calls.filter(call=>call.path==='/pulse/api/request/submit').length,1,'not sent again by itself');
  assert.equal(server.calls.at(-1).path,'/pulse/api/request/save');
  const receipt=await backend.submit(backend.answers);
  assert.equal(receipt.number,'P-1','the second press, knowing, goes through on the new draft');
  assert.equal(server.calls.at(-1).csrf,'new1');
});
test('an expired draft with nothing to lose sends straight through, and removing a file that is already gone is not an error',async t=>{
  const server=fakeServer(t),backend=await publicBackend();backend.onExpired=()=>0;
  assert.equal((await backend.submit(backend.answers)).number,'P-1');
  assert.equal(server.calls.filter(call=>call.path==='/pulse/api/request/submit').length,2);
  server.expire();
  const seen=dropFiles(backend);
  await backend.remove('f1');
  assert.equal(seen.length,1);
});
test('the rail keeps the first draft closed until a round exists and marks only the page that is open',()=>{
  const open=html=>Array.from(html.matchAll(/class="sx-step ([^"]*)" ([^>]*)data-room-go="([^"]+)"/g),match=>({id:match[3],now:match[1].includes('is-now'),disabled:match[2].includes('disabled'),current:match[2].includes('aria-current')}));
  const waiting=open(roomRail({stage:'draft',hasRound:false})).find(item=>item.id==='draft');
  assert.equal(waiting.now,true);assert.equal(waiting.disabled,true,'choosing a model comes first');
  assert.equal(open(roomRail({stage:'draft',hasRound:true})).find(item=>item.id==='draft').disabled,false);
  const films=roomRail({stage:'check',hasRound:false,films:true},{tab:'films'});
  assert.equal(open(films).filter(item=>item.now||item.current).length,0,'no stage claims the page');
  assert.match(films,/class="is-now" aria-current="page" data-room-go="films"/);
});
const request=extra=>({number:'P-1',status:'submitted',answers:{...normalizeRequestAnswers(answersForServer(full())),models:[]},files:[],asks:[],notes:[],rounds:[],...extra});
const project=(r,extra={})=>({id:'p',title:'오미톡',stage:'received',versions:[],studio:{assets:[],scenes:[{id:'s',revision:1,duration:2,description:'벤치 위 캔',narration:'',screenText:'',assetId:null,imageUrl:'https://example.com/c.png'}],request:r,strategy:{data:{}}},...extra});
test('the room says whose turn it is at every step of the promised three checks',()=>{
  const round=(kind,extra={})=>({round:1,kind,oneLine:'한 문장',scenes:[{id:'s',revision:1}],...extra});
  const cases=[
    [request(),'check'],
    [request({asks:[{id:'a',label:'로고',status:'open'}]}),'ask'],
    [request({status:'confirmed'}),'prepare'],
    [request({status:'confirmed',modelProposal:{modelId:'M06',status:'open'}}),'model'],
    [request({status:'confirmed',rounds:[round('script')]}),'script'],
    [request({status:'confirmed',rounds:[round('script',{feedbackAt:'t',changes:1})]}),'revise'],
    [request({status:'confirmed',rounds:[round('script',{approvedAt:'t'})]}),'prepare-images'],
    [request({status:'confirmed',rounds:[round('images')]}),'images'],
    [request({status:'confirmed',approvedAt:'t',rounds:[round('images',{approvedAt:'t'})]}),'make'],
  ];
  for(const [r,want] of cases){
    const state=roomState(project(r));
    assert.equal(state,want);
    assert.ok(ROOM_COPY[state],state);
    assert.ok(ROOM_STAGES.some(stage=>stage.id===roomStage(state)),state);
  }
  assert.equal(usesRoom(project(request())),true);
  assert.equal(usesRoom({studio:{}}),false);
  assert.equal(roomState({stage:'delivered',versions:[]}),'deliver');
  assert.ok(ROOM_STAGES.some(stage=>stage.id===roomStage('deliver')));
});
test('room and draft models read real project data',()=>{
  const r=request({status:'confirmed',modelProposal:{modelId:'M06',status:'open',note:'잘 어울려요'}});
  const room=roomModel(project(r));
  assert.equal(room.state,'model');
  assert.equal(room.proposal.name,'한결');
  assert.equal(room.proposal.note,'잘 어울려요');
  const draft=draftModel(project(request({status:'confirmed',answers:{...r.answers,channels:['youtube']},rounds:[{round:1,kind:'images',oneLine:'한 문장',scenes:[{id:'s',revision:1}]}]})));
  assert.equal(draft.ratio,'16:9');
  assert.equal(draft.cuts[0].src,'https://example.com/c.png');
  const script=draftModel(project(request({status:'confirmed',rounds:[{round:1,kind:'script',oneLine:'한 문장',scenes:[{id:'s',revision:1}]}]})));
  assert.equal(script.cuts[0].src,'','a words-only round shows no picture even when one exists');
});
test('the room lists only what the customer sent, and the draft shows the decided model, never a declined one',()=>{
  const r=request({files:[{id:'mine',slot:'front',fileName:'내 사진.png',inline:true,mimeType:'image/png'},{id:'doc',slot:'etc',fileName:'소개서.pdf',inline:false}]});
  const room=roomModel({...project(r),studio:{...project(r).studio,assets:[{id:'mine',fileName:'내 사진.png',mimeType:'image/png',url:'https://example.com/mine.png'},{id:'scene',fileName:'내부 장면.png',mimeType:'image/png',url:'https://example.com/scene.png'}]}});
  assert.deepEqual(room.files.map(file=>file.src),['https://example.com/mine.png'],'a scene picture staff uploaded stays out');
  assert.deepEqual(room.others,['소개서.pdf']);
  assert.equal(roomModel(project(request({status:'confirmed',modelProposal:{modelId:'없는 모델',status:'open'}}))).proposal,null,'no empty proposal card');
  const round=[{round:1,kind:'script',oneLine:'한 문장',scenes:[{id:'s',revision:1}]}],answers={...request().answers,models:[]};
  const draft=(extra,strategy={})=>{const p=project(request({status:'confirmed',answers,rounds:round,...extra}));return draftModel({...p,studio:{...p.studio,strategy:{data:strategy}}}).model?.id||null;};
  assert.equal(draft({modelProposal:{modelId:'M06',status:'declined'}}),null,'a declined model is not shown');
  assert.equal(draft({modelProposal:{modelId:'M06',status:'accepted'}}),'M06');
  assert.equal(draft({modelProposal:{modelId:'M06',status:'accepted'}},{castingSelection:{modelId:'F02'}}),'F02','what the production plan says wins');
  assert.equal(draft({answers:{...answers,models:['M01']}}),'M01');
});
test('the desk flags what staff must look at, and retired requests still open',()=>{
  const checks=deskChecks(project(request({answers:{...request().answers,kind:'food',screenText:'11월 출시',oneThing:'갈증 해소 최고',avoid:['갈증 해소']}})));
  assert.ok(checks.some(item=>item.label.includes('제품 정면')&&!item.ok));
  assert.ok(checks.some(item=>item.label.includes('모델을 제안')));
  assert.ok(checks.some(item=>item.label.includes('사실 확인')));
  const two=request({answers:{...request().answers,kind:'food',screenText:'다섯 가지 맛, 톡.\n11월 편의점 출시'}});
  assert.match(deskChecks(project(two)).find(item=>item.label.includes('사실 확인')).note,/11월 편의점 출시/,'the line that needs checking, not the first line');
  const asked=deskChecks(project({...two,asks:[{id:'a',label:'11월 편의점 출시가 확정인가요?',status:'answered',answer:'네, 확정이에요'}]})).find(item=>item.label.includes('사실'));
  assert.equal(asked.ok,true);assert.match(asked.note,/네, 확정이에요/);
  assert.equal(deskModel(project(request())).brief.find(([key])=>key==='자랑할 사실')[1],'12만 개');
  assert.equal(deskModel(project(request({answers:{...request().answers,facts:''}}))).brief.find(([key])=>key==='자랑할 사실')[1],'없음');
  assert.ok(checks.some(item=>item.label.includes('피할 말')));
  assert.ok(checks.some(item=>item.label.includes('여러 명')));
  const retired=deskModel(project({schemaVersion:1,number:'P-1',status:'retired',answers:{},files:[],asks:[],notes:[],rounds:[]}));
  assert.equal(retired.status,'retired');
});
test('customer screens never name a tool, and the internal desk stays out of their bundle',async()=>{
  for(const name of ['request-flow.mjs','request-data.mjs','request-backend.mjs','film-views.mjs','film-home.mjs','film-review.mjs','room-view.mjs','demo-film.mjs','motion.mjs']){
    const source=await readFile(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora/,name);
    assert.doesNotMatch(source,/desk-view/,name);
  }
  // 고객 입구 파일: 도구 이름이 없고, 내부 확인 화면은 직원이 열 때 부르는 길만 있다.
  for(const name of ['index.html','app.mjs','views.mjs']){
    const source=await readFile(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora/,name);
    assert.doesNotMatch(source,/^\s*import\s[^(]*desk-view/m,name);assert.doesNotMatch(source,/<script[^>]*desk-view/,name);
  }
  assert.match(await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8'),/if\(s\.mode!=='staff'\|\|s\.tab!=='desk'[^\n]*import\('\.\/desk-view\.mjs'\)/,'the desk loads only for staff, only when opened');
  assert.doesNotMatch(await readFile(new URL('./public/pulse-app/sw.js',import.meta.url),'utf8'),/desk-view/,'customer devices do not cache the desk');
  assert.doesNotMatch(await readFile(new URL('./public/pulse-app/desk-view.mjs',import.meta.url),'utf8'),/Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora/,'public file');
});
globalThis.location??={origin:'https://workspace.synk.im'};
const roomState2=(r,extra={})=>({mode:'customer',tab:'overview',live:{},project:project(r,extra)});
test('a customer with a request gets the new room; the review and delivery tabs keep working inside its rail',()=>{
  const r=request({status:'submitted'});
  const room=projectView(roomState2(r));
  assert.match(room,/^<div class="sx-room" data-state="check">/);
  assert.doesNotMatch(room,/sx-room-bar/,'the app header is already on top');
  assert.match(room,/지금은 저희 차례예요/);
  const script=request({status:'confirmed',rounds:[{round:1,kind:'script',oneLine:'한 문장',scenes:[{id:'s',revision:1}]}]});
  const draft=projectView({...roomState2(script),tab:'draft'});
  assert.match(draft,/^<div class="sx-draft sx-dr is-script"/);
  assert.doesNotMatch(draft,/ONE LINE|ROUND|CUTS|CUT \d/,'the words a customer reads are Korean');assert.match(draft,/1판 · 1컷/);assert.match(draft,/광고가 남길 한 문장/);
  assert.match(projectView({...roomState2(script),tab:'draft',error:'그사이 새 소식이 생겼어요',conflict:true}),/role="alert"[\s\S]*data-action="refresh"/,'a conflict on the draft can be refreshed from the draft');
  // 판 3: 영상이 오기 전 review 탭(옛 링크 · 알림)은 고객 방으로. 판 3b: 묻기는 화면이 아니라 일지 — 옛 contact 탭은 방(일지가 있는 곳). 단계 줄은 앱 머리에 한 번.
  const legacy=projectView({...roomState2(script),tab:'review'});
  assert.match(legacy,/^<div class="sx-room" data-state="script">/,'before any video the review tab is the room');
  assert.doesNotMatch(legacy,/class="sx-steps/,'no step line inside the screen');
  const asking=projectView({...roomState2(request({status:'submitted'})),tab:'contact'});
  assert.match(asking,/^<div class="sx-room" data-state="check">/);assert.equal(asking.split('data-form="support"').length-1,1);assert.match(asking,/담당자와 나눈 말/);
  assert.doesNotMatch(asking,/의견은 모아서 한 번에 보내요/,'before any preview there is no such box');assert.match(asking,/담당자에게 물어보세요/);assert.equal(asking.split('후속 문의').length,1);
  const head=headerCrumb(roomState2(r)),actions=header({...roomState2(r),desktopApp:false});
  assert.match(head,/<nav class="sx-steps sx-head-steps" aria-label="단계"><div class="sx-steps-run">/,'on a phone the steps scroll in the head');
  assert.match(head,/data-room-go="room"/,'the project name leads back to the room');
  assert.equal(head.split('class="sx-step ').length-1,5,'five steps, drawn once');assert.doesNotMatch(room,/class="sx-step |class="leader"/);
  assert.equal(actions.split('data-room-do="journal"').length-1,1,'the way to ask stays outside the steps, once');
  assert.doesNotMatch(asking,/class="sx-steps/);
  assert.doesNotMatch(legacy,/class="rail"/);
  assert.doesNotMatch(legacy,/next-decision/,'the room says what to do, not the old next-step card');
  assert.doesNotMatch(legacy,/production-scope/);
  assert.doesNotMatch(projectView({...roomState2(script),tab:'strategy'}),/data-form="strategy"/,'the long form stays closed unless staff asked for a check');
  assert.doesNotMatch(projectView({mode:'customer',tab:'overview',live:{},project:{id:'old',title:'옛',stage:'review',versions:[{id:'v',kind:'preview'}],messages:[],studio:{scenes:[],concepts:[],references:[],assets:[],comments:[],sceneReviews:[]}}}),/^<div class="sx-room" data-state=/,'old projects keep their own overview');
});
test('the room asks only what is open and offers the extra work staff requested',()=>{
  const r=request({asks:[{id:'a',label:'로고 파일',why:'끝 화면에 얹어요',status:'open'},{id:'b',label:'받은 것',status:'answered',answer:'네'}]});
  const html=projectView(roomState2(r));
  assert.match(html,/data-form="ask" data-id="a"/);assert.match(html,/끝 화면에 얹어요/);assert.match(html,/「받은 것」에 답했어요/,'an answered ask is a line in the journal');
  const model=projectView(roomState2(request({modelProposal:{modelId:'M06',status:'open',note:'잘 어울려요'}})));
  assert.match(model,/이 모델로 갈까요/);assert.match(model,/data-room-do="model-accept"/);assert.match(model,/data-room-model="F01"/);assert.match(model,/영상 전 확인/);
  const kickoff=projectView(roomState2(request(),{kickoff:{enabled:true,status:'waiting'}}));
  // 판 3: 준비 자료 · 바뀐 내용 · 납품 규격은 탭을 옮기지 않고 방 아래 준비 칸으로.
  assert.match(kickoff,/제작 전에 준비할 자료가 있어요/);assert.match(kickoff,/data-room-do="paper" data-paper="kickoff"/);assert.doesNotMatch(kickoff,/data-tab="strategy"/);
  const written=projectView(roomState2(null,{requestFlow:true}));
  assert.match(written,/의뢰서를 써 주세요/);assert.match(written,/data-room-go="write"/);
});
test('the desk shows staff what to do at each stage and never reaches the customer bundle',()=>{
  const model=base=>({id:'p',number:'P-1',at:'오늘',title:'오미톡',contact:'',brief:[],files:[],attachments:[],checks:[],note:null,asks:[],rounds:[],modelProposal:null,queue:[],canEdit:true,...base});
  assert.match(deskView(model({confirmed:false}),{bar:false}),/data-action="desk-confirm"/);
  const confirmed=deskView(model({confirmed:true,needsModel:true}),{bar:false});
  assert.match(confirmed,/data-action="desk-send"/);assert.match(confirmed,/data-action="desk-propose"/);assert.match(confirmed,/data-tab="storyboard"/);
  assert.doesNotMatch(deskView(model({confirmed:true,rounds:[{round:1,kind:'images',approvedAt:'t'}]}),{bar:false}),/data-action="desk-send"/,'nothing to send after the pictures are approved');
  assert.match(deskView(model({canEdit:false,confirmed:false}),{bar:false}),/보기만 할 수 있어요/);
  // 판 4: 결제 · 크몽 줄은 결제 상태를 아는 서버(paymentFlow)에서만 — 화면 묶음이 서버보다 먼저 나가도 옛 서버에 없는 동작 단추를 띄우지 않는다.
  assert.doesNotMatch(deskView(model({confirmed:true}),{bar:false}),/desk-pay|결제 · 크몽/,'no payment row on a server without the payment flow');
  const paying=deskView(model({confirmed:true,paymentFlow:true,payWaiting:true}),{bar:false});
  assert.match(paying,/<h2>결제 · 크몽<\/h2>/);assert.match(paying,/data-action="desk-pay-request"/);assert.match(paying,/손님 화면에 결제 안내가 떠 있어요/);
  assert.match(deskView(model({confirmed:true,paymentFlow:true}),{bar:false}),/결제 안내 전 · 손님이 글 콘티\(사진은 첫 장\)를 승인하면 결제 안내가 떠요/);
  const staff={mode:'staff',tab:'desk',live:{},canEdit:true,workspace:{projects:[]},project:project(request())};
  assert.match(projectView(staff),/의뢰서를 불러오고 있어요/,'the module loads only when opened');
  assert.match(projectView({...staff,deskView}),/^<div class="desk">/);
  const queue=deskQueue([project(request({submittedAt:'2026-11-04T00:00:00.000Z'})),project(request({status:'retired'})),{...project(request()),stage:'delivered'}]);
  assert.equal(queue.length,1);assert.equal(queue[0].state,'새 의뢰');assert.equal(queue[0].tone,'is-new');
  assert.match(picker({workspace:{canWrite:true,projects:[project(request())]}}),/새 의뢰/);
  assert.match(headerCrumb({project:project(request())}),/crumb-no/);
});
test('staff and customer dialogs for the request flow are complete',()=>{
  assert.match(dialogContent('recast'),/data-form="recast"/);assert.equal(dialogContent('recast').split('name="modelId"').length-1,CASTING_MODELS.length);
  assert.match(dialogContent('desk-ask',{suggested:'로고 파일'}),/로고 파일/);
  const propose=dialogContent('desk-propose',{kind:'food',modelId:'M06'});assert.match(propose,/value="M06" selected/);assert.match(propose,/이 업종에 맞음/);
  assert.match(dialogContent('desk-send',{count:2,kind:'images',oneLine:'한 문장'}),/data-form="desk-send"/);
  // 판 4: 「그림은 두고 글 콘티 판으로」는 결제 흐름 서버에서만(옛 서버는 kind 칸을 거절한다). 결제 전에는 글 콘티 판으로만, 결제 뒤에는 고를 수 있다.
  const oldServer=dialogContent('desk-send',{count:2,kind:'images',oneLine:'한 문장',paid:true});
  assert.doesNotMatch(oldServer,/name="asScript"/);assert.match(oldServer,/고객이 확인하면 제작 단계로 넘어가요/);
  const unpaid=dialogContent('desk-send',{count:2,kind:'images',oneLine:'한 문장',flow:true,paid:false});
  assert.match(unpaid,/<label class="desk-check"><input type="checkbox" name="asScript" value="1" checked disabled><span>그림은 두고 글 콘티 판으로 보내기 · 결제 확인 전<\/span><\/label><input type="hidden" name="asScript" value="1">/);
  const paid=dialogContent('desk-send',{count:2,kind:'images',oneLine:'한 문장',flow:true,paid:true});
  assert.match(paid,/<input type="checkbox" name="asScript" value="1" ><span>그림은 두고 글 콘티 판으로 보내기<\/span>/);assert.doesNotMatch(paid,/type="hidden" name="asScript"/);
  const empty=dialogContent('desk-send',{count:0,kind:'script'});
  assert.doesNotMatch(empty,/data-form="desk-send"/,'no form until scenes are visible to the customer');
  assert.doesNotMatch(empty,/보낼까요|0컷/,'no question about sending nothing');assert.match(empty,/아직 보낼 장면이 없어요/);
});
