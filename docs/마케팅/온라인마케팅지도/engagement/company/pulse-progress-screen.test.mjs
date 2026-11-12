// PULSE 운영 조각 4(2026-11-12, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S1) — 작업 소식의 화면 쪽 약속.
// ① 일지에 소식 줄(글 전문 + 그림 넷까지 + 「작업 중인 화면이에요 · 완성본이 아니에요」), 줄 id n:<소식 id> — 알림 progressId와 짝지어 「봤다」를 읽음으로.
// ② 「말만 보기」 거르개 — 말 줄과 다른 줄이 함께 있을 때만 단추, 켜면 말 줄만.
// ③ 저희 차례 큰 그림 칸: 차례가 넘어온 뒤에 올린 최근 소식 그림(예시 · 지난 판 그림 대신), 손님 차례에는 없다.
// ④ 직원 「작업 소식」 칸: 서버가 안다고 알릴 때만(progressFeed), 초안은 고치기 · 올리기 · 거두기, 올린 것은 거두기만.
// 서버 쪽(허용 목록 · 상한 · 거두기 · 알림 · 메일 함)은 pulse-progress-server.test.mjs가 본다. 실제 그림(1440 · 390 넘침)은 브라우저 확인이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {journalModel,roomModel,roomNews,roomRoute,deskModel,progressLines}=await import('./public/pulse-app/room-view.mjs');
const {journalView,roomView}=await import('./public/pulse-app/film-views.mjs');
const {deskView}=await import('./public/pulse-app/desk-view.mjs');
const {setLocale,t}=await import('./public/pulse-app/i18n.mjs');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');

const T=hour=>new Date(Date.UTC(2026,10,12,hour)).toISOString();
const A=n=>`aaaaaaaa-0000-4000-8000-${String(n).padStart(12,'0')}`,N=n=>`bbbbbbbb-0000-4000-8000-${String(n).padStart(12,'0')}`;
const image=(n,extra={})=>({id:A(n),fileName:'progress.png',mimeType:'image/png',byteSize:68,url:'/pulse/api/studio/media/'+A(n),...extra});
const project=(request={},extra={},assets=[])=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'planning',revision:3,versions:[],messages:[],requestFlow:true,
  studio:{assets,scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:false,maxItems:20,nextNumber:1},
    request:{status:'confirmed',number:'P-2026-ABCD',submittedAt:T(0),confirmedAt:T(1),confirmedBy:'김하늘',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[],...request}},...extra});
const news=list=>({progress:list});
const lines=j=>j.items.filter(item=>item.id.startsWith('n:'));

test('일지 소식 줄: 올린 소식마다 한 줄(n:<id>) — 글 전문 · 그림은 손님 보기 자산 주소(넷까지, 그림만), 새 것이 위, 「새 소식」으로 센다',()=>{
  const assets=[image(1),image(2),image(3),image(4),image(5),{id:A(6),fileName:'clip.mp4',mimeType:'video/mp4',url:'/pulse/api/studio/media/'+A(6)}];
  const p=project(news([{id:N(1),at:T(3),stage:'draft',text:'이미지 콘티를 만들고 있어요.\n2번 컷 손 모양을 다듬는 중이에요.',assets:[A(1),A(2),A(3),A(4),A(5)]},{id:N(2),at:T(5),text:'영상 편집 중이에요.',assets:[A(6),A(9)]}]),{},assets);
  const j=journalModel(p),got=lines(j);
  assert.deepEqual(got.map(item=>item.id),['n:'+N(2),'n:'+N(1)],'새 것이 위');
  assert.ok(got.every(item=>item.kind==='progress'&&item.who==='staff'&&item.name==='김하늘'&&item.what==='작업 소식'&&item.go==null));
  assert.equal(got[1].text,'이미지 콘티를 만들고 있어요.\n2번 컷 손 모양을 다듬는 중이에요.');assert.equal(got[1].stage,'draft');
  assert.deepEqual(got[1].pictures,[1,2,3,4].map(n=>'/pulse/api/studio/media/'+A(n)),'그림은 넷까지');
  assert.deepEqual(got[0].pictures,[],'영상 · 손님 보기에 없는 자산은 그림으로 쓰지 않는다');
  assert.equal(j.latestAt,Date.parse(T(5)));
  assert.equal(new Set(j.items.map(item=>item.id)).size,j.items.length);
  // 깨진 · 이상한 칸은 줄을 만들지 않고 깨지지 않는다(서버 허용 목록 밖에서 와도).
  for(const progress of [null,'x',[null,{id:N(3)},{id:N(4),at:'어제',text:'x'},{id:N(5),at:T(2)},{id:7,at:T(2),text:'x'}]]){
    assert.deepEqual(lines(journalModel(project({progress}))),[]);
  }
});

test('일지 소식 줄 그리기: 글은 이스케이프, 그림 칸 수 · 「작업 중인 화면이에요 · 완성본이 아니에요」 · 단계 이름',()=>{
  const p=project(news([{id:N(1),at:T(3),stage:'make',text:'<b>편집</b> 중이에요',assets:[A(1),A(2)]}]),{},[image(1),image(2)]);
  const html=journalView(journalModel(p),{owner:'김하늘'});
  const row=html.match(/<li class="sx-j-row is-progress"[\s\S]*?<\/li>/)?.[0]||'';
  assert.ok(row,'소식 줄');assert.match(row,/data-journal-id="n:bbbbbbbb-0000-4000-8000-000000000001"/);
  assert.match(row,/작업 소식 · 제작/);assert.match(row,/&lt;b&gt;편집&lt;\/b&gt; 중이에요/);assert.doesNotMatch(row,/<b>편집/);
  assert.match(row,/<figure class="sx-j-shots" data-count="2">/);assert.equal((row.match(/<img /g)||[]).length,2);
  assert.match(row,/작업 중인 화면이에요 · 완성본이 아니에요/);
  // 그림 없는 소식은 글만.
  const bare=journalView(journalModel(project(news([{id:N(2),at:T(3),text:'소리 작업 중이에요',assets:[]}]))),{owner:'김하늘'});
  assert.match(bare,/소리 작업 중이에요/);assert.doesNotMatch(bare,/sx-j-shots/);
});

test('「말만 보기」: 말 줄과 다른 줄이 함께 있을 때만 단추, 켜면 말 줄만 · 없으면 빈 안내',()=>{
  const talk={id:'m1',author:'customer',action:'support',text:'로고는 언제까지 보내면 돼요?',at:T(2)},reply={id:'m2',author:'staff',authorName:'김하늘',visibility:'customer',text:'내일까지요.',at:T(4)};
  const p=project(news([{id:N(1),at:T(3),text:'장면 이미지를 그리고 있어요.',assets:[]}]),{messages:[talk,reply]});
  const off=journalView(journalModel(p),{owner:'김하늘'});
  assert.match(off,/data-journal-do="talk" aria-pressed="false"/);
  assert.match(off,/is-progress/);assert.match(off,/data-journal-id="q:sent"/);
  const on=journalView(journalModel(p),{owner:'김하늘',talk:true});
  assert.match(on,/data-journal-do="talk" aria-pressed="true"/);
  assert.doesNotMatch(on,/is-progress|data-journal-id="q:sent"/,'켜면 사건 · 소식 줄이 빠진다');
  assert.equal((on.match(/class="sx-j-row is-talk/g)||[]).length,2);
  // 말이 없으면 단추가 없다. 켠 채 말이 사라졌으면 빈 안내.
  const quiet=project(news([{id:N(1),at:T(3),text:'작업 중',assets:[]}]));
  assert.doesNotMatch(journalView(journalModel(quiet),{owner:'김하늘'}),/data-journal-do="talk"/);
  const empty=journalView(journalModel(quiet),{owner:'김하늘',talk:true});
  assert.match(empty,/data-journal-do="talk" aria-pressed="true"/);assert.match(empty,/나눈 말이 아직 없어요/);
});

test('저희 차례 큰 그림 칸: 차례가 넘어온 뒤 올린 최근 소식 그림 + 「작업 중인 화면이에요」 + 일지 그 줄로, 손님 차례 · 앞 단계 소식 · 그림 없는 소식은 없다',()=>{
  const assets=[image(1),image(2),image(3)];
  // 제작 중(장면 이미지 판 확인 뒤): 확인 뒤에 올린 소식이 지난 판 그림 · 예시보다 앞에.
  const rounds=[{round:1,kind:'images',sentAt:T(2),approvedAt:T(3),scenes:[]}];
  const made=project({approvedAt:T(3),rounds,progress:[{id:N(1),at:T(2),text:'앞 단계 소식',assets:[A(1)]},{id:N(2),at:T(4),text:'편집 중',assets:[A(2),A(3)]},{id:N(3),at:T(5),text:'그림 없는 소식',assets:[]}]},{stage:'producing'},assets);
  const model=roomModel(made);
  assert.equal(model.state,'make');
  assert.deepEqual(model.news,{id:N(2),at:T(4),pictures:['/pulse/api/studio/media/'+A(2),'/pulse/api/studio/media/'+A(3)]},'그림이 있는 가장 최근 소식');
  const html=roomView(model,{bar:false});
  const screen=html.match(/<div class="sx-room-screen">[\s\S]*?<\/div>\s*<\/section>/)?.[0]||'';
  assert.match(screen,/<div class="sx-room-files" data-count="2">/);assert.match(screen,/작업 중인 화면이에요 · 완성본이 아니에요/);
  assert.match(screen,new RegExp(`data-room-do="journal" data-journal-target="n:${N(2)}"`));
  assert.doesNotMatch(screen,/w-gift/,'예시 그림 대신');
  // 차례가 넘어오기 전(확인 전)에 올린 소식만 있으면 지난 판 · 예시로 돌아간다.
  assert.equal(roomNews(project({approvedAt:T(3),rounds,progress:[{id:N(1),at:T(2),text:'앞 단계 소식',assets:[A(1)]}]},{stage:'producing'},assets)),null);
  // 손님 차례(글 콘티 판이 왔다)에는 소식 그림을 띄우지 않는다.
  const yours=project({rounds:[{round:1,kind:'script',sentAt:T(6),scenes:[]}],progress:[{id:N(2),at:T(5),text:'편집 중',assets:[A(2)]}]},{},assets);
  assert.equal(roomModel(yours).news,null);
  // 그림 하나면 꽉 찬 그림.
  const one=roomView(roomModel(project({approvedAt:T(3),rounds,progress:[{id:N(2),at:T(4),text:'편집 중',assets:[A(2)]}]},{stage:'producing'},assets)),{bar:false});
  assert.match(one,/<img class="sx-q-fill" src="\/pulse\/api\/studio\/media\/aaaaaaaa-0000-4000-8000-000000000002"/);
  assert.deepEqual(progressLines(made).map(item=>item.id),[N(1),N(2),N(3)]);
  // 영상이 온 뒤(손님이 의견을 보내 저희가 고치는 중이어도) 방은 늘 손님 차례(review)라 소식 그림을 띄우지 않는다 — 큰 그림 칸은 영상(화면 검수 A1).
  const reviewing=project({approvedAt:T(3),rounds,progress:[{id:N(4),at:T(9),text:'수정본 편집 중',assets:[A(2)]}]},{stage:'producing',versions:[{id:'v1',kind:'preview',label:'1차 영상',createdAt:T(6)}]},assets);
  reviewing.studio.feedbackRounds.rounds=[{id:'f1',submittedAt:T(7),versionId:'v1',items:[{id:'i1'}]}];
  assert.equal(roomModel(reviewing).state,'review');assert.equal(roomModel(reviewing).news,null);
});

test('소식 알림을 누르면 화면은 그대로, 일지의 그 줄로 · 「봤다」가 소식 알림을 읽음으로 짝짓는다',async()=>{
  assert.deepEqual(roomRoute({type:'progress_posted',tab:'overview',progressId:N(1)},project()),{tab:'',versionId:'',journal:'n:'+N(1)});
  const app=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
  assert.match(app,/row\.progressId&&lines\.has\('n:'\+row\.progressId\)/,'markJournalSeen이 소식 알림을 일지 줄과 짝짓는다');
  assert.match(app,/openJournal\(\{opener:ask,target:ask\.dataset\.journalTarget\|\|''\}\)/,'큰 그림 칸 「소식 보기」는 그 줄로');
  assert.match(app,/s\.journalAll=true;s\.journalTalk=false;/,'「말만 보기」가 켜져 그 줄이 숨어 있으면 거르개를 푼다');
});

test('직원 「작업 소식」 칸: 서버가 알릴 때만, 초안은 고치기 · 올리기 · 거두기, 올린 것은 거두기만, 거둔 것은 수만, 보기 전용이면 단추 없음',()=>{
  const assets=[{...image(1,{url:'/api/client-projects/p1/studio/media/'+A(1)}),purpose:'progress'},{...image(2,{url:'/api/client-projects/p1/studio/media/'+A(2)}),author:'staff'}];
  const request={progressFeed:true,progress:[{id:N(1),state:'posted',at:T(2),postedAt:T(3),stage:'make',text:'편집 중',assets:[A(1)]},{id:N(2),state:'draft',at:T(4),text:'소리 작업 중',assets:[]},{id:N(3),state:'withdrawn',at:T(1),withdrawnAt:T(2),text:'거둔 소식',assets:[]}]};
  const model=deskModel(project(request,{},assets));
  assert.equal(model.progressFeed,true);assert.equal(model.progressUsed,1);
  assert.ok(!model.staffFiles.some(file=>file.src.includes(A(1))),'소식 그림은 「저희가 올린 그림」에 섞지 않는다');
  const html=deskView({...model,queue:[],canEdit:true},{bar:false});
  const block=html.match(/<section class="desk-progress">[\s\S]*?<\/section>/)?.[0]||'';
  assert.ok(block,'작업 소식 칸');
  const rows=block.match(/<li>[\s\S]*?<\/li>/g);assert.equal(rows.length,2,'거둔 소식은 줄이 없다');
  assert.match(rows[0],/초안 · 손님에게 안 보여요/);assert.match(rows[0],/desk-progress-edit/);assert.match(rows[0],/desk-progress-post/);assert.match(rows[0],/desk-progress-withdraw/);
  assert.match(rows[1],/손님에게 올림/);assert.match(rows[1],/ · 제작/);assert.doesNotMatch(rows[1],/desk-progress-post|desk-progress-edit/);assert.match(rows[1],/desk-progress-withdraw/);
  assert.match(rows[1],/<img src="\/api\/client-projects\/p1\/studio\/media\/aaaaaaaa/);
  assert.match(block,/거둔 소식 1개/);assert.match(block,/data-action="desk-progress-new"/);
  const viewOnly=deskView({...model,queue:[],canEdit:false},{bar:false}).match(/<section class="desk-progress">[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(viewOnly,/data-action=/);
  assert.doesNotMatch(deskView({...deskModel(project({},{},assets)),queue:[],canEdit:true},{bar:false}),/desk-progress/,'옛 서버(progressFeed 없음)에는 칸이 없다');
});

test('영어: 소식 줄 · 안내 · 「말만 보기」 · 「소식 보기」',async()=>{
  await setLocale('en');
  try{
    assert.equal(t('작업 소식',null,'journal'),'shared a work-in-progress update');
    for(const key of ['작업 중인 화면이에요 · 완성본이 아니에요','소식 보기','말만 보기','나눈 말이 아직 없어요'])assert.notEqual(t(key),key,key);
    const html=journalView(journalModel(project(news([{id:N(1),at:T(3),stage:'make',text:'We are editing.',assets:[A(1)]}]),{},[image(1)])),{owner:'Mina'});
    assert.match(html,/shared a work-in-progress update · /);assert.match(html,/Work in progress · not the finished version/);
  }finally{await setLocale('ko');}
});

test('화면 Fable 최종 반영: 예시 일지의 「말만 보기」 · 인물 차례 방의 큰 그림 칸 · 그림 다시 올리기 · 거른 채 「봤다」 · 직원 번역 칸 이름 · 켜진 단추 높이',async()=>{
  // F1(P1): 공개 예시(?demo=film) 일지도 「말만 보기」를 받는다 — 다시 그리기 콜백이 어느 단추인지 받고, 부르는 네 자리가 말만 보기 상태를 들고 다시 그린다.
  const demo=await readFile(new URL('./public/pulse-app/demo-film.mjs',import.meta.url),'utf8');
  assert.match(demo,/if\(act==='more'\|\|act==='talk'\)\{const wasOpen=el\.classList\.contains\('is-open'\);redraw\?\.\(act\);/);
  assert.equal((demo.match(/if\(act==='talk'\)/g)||[]).length,4,'방 · 글 콘티 · 영상 확인 · 납품 네 자리');
  assert.match(demo,/journalAll:false,journalTalk:false,/);
  // F2: 맞춤 인물 카드가 「지금 차례」(머리 「내 차례」)이고 인물 그림이 없으면 큰 그림 칸은 소식 그림이 아니다.
  const assets=[image(2)],rounds=[{round:1,kind:'images',sentAt:T(2),approvedAt:T(3),scenes:[]}];
  const withPersona=project({approvedAt:T(3),rounds,progress:[{id:N(2),at:T(4),text:'편집 중',assets:[A(2)]}]},{stage:'producing',persona:{id:'persona-1',turn:'customer',status:'needs_materials',why:'옆모습 사진이 더 필요해요.',kind:'virtual',sources:{identity:0,mood:0,files:[]}}},assets);
  const model=roomModel(withPersona);
  assert.ok(model.news,'소식은 있다');assert.ok(model.persona?.card,'인물 카드가 손님 차례');
  const screen=(roomView(model,{bar:false}).match(/<div class="sx-room-screen">[\s\S]*?<\/div>\s*<\/section>/)||[''])[0];
  assert.doesNotMatch(screen,/작업 중인 화면이에요/,'인물 차례 방에는 소식 그림을 띄우지 않는다');
  // F3 · F4 · F6: 그림 다시 올리기는 파일마다 · 「말만 보기」를 켠 채 「봤다」는 보이는 줄만 · 켜진 단추는 좌우 여백만.
  const app=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
  assert.match(app,/sign=file=>\[file\.name,file\.size,file\.lastModified\]\.join\('\|'\)/);assert.match(app,/if\(!done\[key\]\)\{done\[key\]=await uploadStaffMedia\(file,\{purpose:'progress'\}\)/);
  assert.match(app,/shown=s\.journalTalk\?j\.items\.filter\(item=>item\.kind==='talk'\):j\.items/);assert.match(app,/const lines=new Set\(shown\.map\(item=>item\.id\)\)/);
  const css=await readFile(new URL('./public/pulse-app/film.css',import.meta.url),'utf8');
  assert.match(css,/\.sx-j-filter\[aria-pressed=true\]\{padding-inline:8px;/);assert.doesNotMatch(css,/\.sx-j-filter\[aria-pressed=true\]\{padding:/);
  // F5: 영어 프로젝트의 직원 번역 칸 이름.
  const desk=deskView({...deskModel(project({progressFeed:true,progress:[]},{},[])),queue:[],canEdit:true,translation:{locale:'en',entries:{[`progress:${N(1)}:text`]:{source:'작업 중이에요',max:1200,text:'',status:'',fresh:false}}}},{bar:false});
  assert.match(desk,/작업 소식 · 글/);assert.doesNotMatch(desk,/progress · 글/);
});
