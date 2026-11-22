// 인플루언서 광고 창 조각 ①의 화면(2026-11-21): 손님 칸(people-view.mjs) · 직원 「채널 명단」(people-roster-view.mjs) · 잇는 자리(app.mjs · views.mjs · film-views.mjs).
// 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절. 이 시험의 채널은 모두 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.location??=new URL('http://localhost/pulse-app/');
const {peopleScreen,PEOPLE_MATCH}=await import('./public/pulse-app/people-view.mjs');
const {rosterDesk,entryFrom,blankEntry}=await import('./public/pulse-app/people-roster-view.mjs');
const {registerLocale,setLocale}=await import('./public/pulse-app/i18n.mjs');
const en=(await import('./public/pulse-app/i18n/en.mjs')).default;
const {PEOPLE_SEED,CASTING_IMAGES,PEOPLE_TOPICS,PEOPLE_PLATFORMS,PEOPLE_LIMITS}=await import('./pulse-people.mjs');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const channel=(extra={})=>({id:'ch_cafe01',name:'합성 카페',platform:'instagram',handle:'@synthetic.cafe',url:'https://www.instagram.com/synthetic.cafe/',topics:['food'],audience:'카페를 찾는 20대',followers:12300,avgViews:3400,prices:{post:300000,review:null},image:'',samples:[],virtual:false,...extra});

test('손님 칸: 이 제품에 맞는 채널을 먼저, 값은 있을 때만 숫자, 묻기는 나눈 말의 묻기 칸으로',()=>{
  const entries=[channel(),channel({id:'ch_beauty1',name:'합성 뷰티',topics:['beauty'],prices:{post:null,review:null},followers:null,avgViews:null,url:''}),channel({id:'ch_run0001',name:'합성 러닝',topics:['fitness','daily'],virtual:true,image:PEOPLE_SEED[2].image})];
  const html=peopleScreen({entries,kind:'food'});
  assert.match(html,/<h1 class="sx-display" data-room-title>이 영상, 누구 채널에 실을까요\?<\/h1>/);
  const first=html.indexOf('이 제품에 맞는 채널'),other=html.indexOf('다른 채널');
  assert.ok(first>0&&other>first,'맞는 채널이 먼저');
  assert.ok(html.indexOf('합성 카페')<other&&html.indexOf('합성 러닝')<other,'음료 · 식품은 푸드 · 일상 채널이 먼저');assert.ok(html.indexOf('합성 뷰티')>other);
  assert.match(html,/게시 한 번 300,000원/);assert.match(html,/값은 담당자가 채널과 확인한 뒤 알려 드려요/);
  assert.match(html,/<dt>팔로워<\/dt><dd>1\.2만<\/dd>/,'숫자에 한글(만)이 붙어 고정폭 글꼴을 쓰지 않는다');
  assert.match(html,/data-room-do="journal" data-journal-say="「합성 카페」 채널에 이 영상으로 광고를 의뢰하고 싶어요\. 값과 일정을 알려 주세요\."/);
  assert.match(html,/<a class="sx-link sx-small" href="https:\/\/www\.instagram\.com\/synthetic\.cafe\/" target="_blank" rel="noopener noreferrer">채널 보기<\/a>/);
  assert.equal((html.match(/채널 보기/g)||[]).length,2,'주소가 없는 칸은 「채널 보기」가 없다');
  assert.match(html,/<span class="sx-ppl-tag">가상 인물<\/span>/);assert.doesNotMatch(html,/예시 채널/,'손님에게는 예시 표시가 없다(서버가 예시 칸을 주지 않는다)');
  assert.doesNotMatch(html,/\sstyle=/,'CSP style-src self — style 속성 없음');
  // 거르개: 칸에 있는 주제만, 고르면 그 주제만
  assert.match(html,/data-ppl-filter="all"/);assert.match(html,/data-ppl-filter="beauty"/);assert.doesNotMatch(html,/data-ppl-filter="pet"/);
  const beauty=peopleScreen({entries,kind:'food',filter:'beauty'});assert.match(beauty,/합성 뷰티/);assert.doesNotMatch(beauty,/합성 카페/);
  assert.match(beauty,/aria-pressed="true" data-ppl-filter="beauty"/);
  // 업종을 모르거나 기업 전체면 나누지 않는다
  assert.doesNotMatch(peopleScreen({entries,kind:'brand'}),/이 제품에 맞는 채널/);assert.equal(PEOPLE_MATCH.brand,undefined);
  assert.match(peopleScreen({entries:[]}),/지금은 보여 드릴 채널이 없어요/);
  assert.match(peopleScreen({status:'error'}),/data-ppl-do="retry"/);assert.match(peopleScreen({status:'loading'}),/role="status"/);
});

test('손님 칸: 채널 글과 주소는 이스케이프하고 https만 연다',()=>{
  const html=peopleScreen({entries:[channel({name:'<img src=x onerror=alert(1)>',audience:'"따옴표"',url:'javascript:alert(1)'})],kind:'food'});
  assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/javascript:/);
});

test('미리 보기(직원): 예시 칸도 그리되 묻기를 막고 방으로 가는 단추가 없다',()=>{
  const html=peopleScreen({entries:PEOPLE_SEED.map(item=>({...item})),kind:'food',preview:true});
  assert.match(html,/예시 채널/);assert.doesNotMatch(html,/data-journal-say/);assert.match(html,/disabled aria-disabled="true"/);
  assert.doesNotMatch(html,/data-room-go="room"/);
});

test('영어: 손님 칸의 글은 사전에 있고 영어로 그린다',async()=>{
  registerLocale('en',en);await setLocale('en');
  try{
    const html=peopleScreen({entries:[channel()],kind:'food'});
    assert.match(html,/Whose channel should this video go on\?/);assert.match(html,/One post KRW 300,000/);assert.match(html,/Request this channel/);assert.match(html,/Ask first/);
    assert.doesNotMatch(html.replace(/합성 카페|카페를 찾는 20대|>합</g,''),/[가-힣]/,'채널 이름 · 첫 글자 · 한 줄(직원이 쓴 글) 말고는 한글이 없다');
  }finally{await setLocale('ko');}
});

const rosterData=(extra={})=>({version:3,entries:[{...PEOPLE_SEED[0]},{...channel(),example:false,active:true}],seed:false,broken:false,enabled:true,visible:true,topics:PEOPLE_TOPICS,platforms:PEOPLE_PLATFORMS,limits:PEOPLE_LIMITS,casting:CASTING_IMAGES,updatedAt:'2026-11-21T12:00:00.000Z',editing:null,preview:false,...extra});

test('직원 「채널 명단」: 스위치 상태 · 칸 · 고치기 칸 · 새 칸 · 미리 보기',()=>{
  assert.match(rosterDesk({}),/채널 명단을 불러오고 있어요/);
  const failed=rosterDesk({},{top:'<div class="sx-alert" role="alert">연결 끊김</div>'});assert.match(failed,/data-action="people-roster">다시 불러오기/);assert.doesNotMatch(failed,/불러오고 있어요/,'실패한 뒤에는 기다림 표시를 남기지 않는다(카본 A5)');
  const html=rosterDesk(rosterData());
  assert.match(html,/결제를 마친 손님 방에 「인플루언서 광고」가 보여요/);assert.match(html,/data-action="people-switch" data-on="0"/);
  assert.match(rosterDesk(rosterData({visible:false})),/손님에게 보일 채널\(예시가 아니고 켜 둔 칸\)이 없어/);
  assert.match(rosterDesk(rosterData({enabled:false,visible:false})),/꺼져 있어요/);
  assert.match(html,/예시 칸 · 손님에게 안 보임/);assert.match(html,/data-action="people-move" data-at="0" data-step="-1" disabled/);
  const editing=rosterDesk(rosterData({editing:1}));assert.match(editing,/<li class="ppl-edit-item"><form class="ppl-edit form-panel" data-form="people-entry" data-id="ch_cafe01" data-at="1"/,'고치기 칸은 목록의 <li> 안(카본 A4)');
  assert.match(editing,/name="url" type="url" value="https:\/\/www\.instagram\.com\/synthetic\.cafe\/"/);
  assert.match(rosterDesk(rosterData({editing:'new'})),/data-form="people-entry" data-id="new" data-at="new"/);
  const preview=rosterDesk(rosterData({preview:true,previewFilter:'food'}));assert.match(preview,/예시 채널/);assert.match(preview,/aria-pressed="true" data-ppl-filter="food"/);
  assert.match(rosterDesk(rosterData({broken:true})),/저장된 명단 문서를 읽지 못했어요\. 그동안 손님에게는 이 창이 보이지 않고 저장도 멈춰요\. 개발 담당에게 알려 주세요/);
  assert.match(editing,/name="url" type="url" value="[^"]*" maxlength="2000"/,'주소 칸은 서버가 받는 길이까지(Fable F6)');
  assert.doesNotMatch(html,/\sstyle=/);
});

test('고치기 칸 값: 숫자는 쉼표 · 원을 빼고, 실제 채널은 캐스팅북 그림을 비운다',()=>{
  const field=(name,value)=>({value});
  const elements={name:field('name','  합성 채널 '),platform:field('','youtube'),handle:field('','@x'),url:field('','https://youtube.com/@x'),audience:field('','한 줄'),followers:field('','12,000'),avgViews:field('',''),pricePost:field('','300,000원'),priceReview:field('',''),
    image:field('',PEOPLE_SEED[0].image),sample0:field('',PEOPLE_SEED[0].samples[0]),sample1:field('',PEOPLE_SEED[0].samples[0]),sample2:field('',''),virtual:{checked:false},example:{checked:false},active:{checked:true}};
  const form={elements,querySelectorAll:()=>[{value:'tech'},{value:'daily'}]};
  const item=entryFrom(form,blankEntry());
  assert.equal(item.name,'합성 채널');assert.equal(item.followers,12000);assert.equal(item.avgViews,null);assert.deepEqual(item.prices,{post:300000,review:null});
  assert.deepEqual(item.topics,['tech','daily']);assert.equal(item.image,'');assert.deepEqual(item.samples,[]);assert.equal(item.id,'');
  // 「30만」 · 「1.2만」 · 「5천원」을 읽고, 못 읽는 값은 조용히 비우지 않고 그 칸과 함께 알린다(카본 A2).
  elements.followers.value='30만';elements.avgViews.value='1.2만';elements.priceReview.value='5천원';const units=entryFrom(form,blankEntry());
  assert.equal(units.followers,300000);assert.equal(units.avgViews,12000);assert.equal(units.prices.review,5000);
  elements.pricePost.value='삼십만원';assert.throws(()=>entryFrom(form,blankEntry()),error=>error.field==='pricePost'&&/「게시 한 번 값」 칸은 숫자로/.test(error.message));
  elements.pricePost.value='300,000원';
  elements.virtual.checked=true;const virtual=entryFrom(form,blankEntry());assert.equal(virtual.image,PEOPLE_SEED[0].image);assert.deepEqual(virtual.samples,[PEOPLE_SEED[0].samples[0]],'겹친 장면은 하나로');
});

test('잇는 자리: 손님 칸은 결제 뒤 · 스위치가 켜진 방에서만, 직원 「채널 명단」은 관리자에게만',()=>{
  const app=read('app.mjs'),views=read('views.mjs'),film=read('film-views.mjs'),room=read('room-view.mjs'),sw=read('sw.js');
  assert.match(app,/checkMarketing\(\);loadMarketingView\(\);checkPeople\(\);loadPeople\(\);/);
  assert.match(app,/const want=!demo&&projectFeatures\?\.people===true,p=peopleNow\(\);/);
  assert.match(app,/if\(error\?\.status===404\)\{p\.on=false;p\.status='off';if\(roomTab\(s\.tab\)==='people'&&!peopleSent\(\)\)s\.tab='overview';\}/);
  assert.match(app,/s\.brands\?brandsView\(\):s\.ledger\?ledgerView\(\):s\.roster\?rosterView\(\):picker\(s\)/);
  assert.match(app,/s\.ledger=null;s\.roster=null;closeDialog\(\);/);
  assert.match(app,/request\('\/api\/pulse-people\/roster',\{\.\.\.options\(\),body:\{version:s\.roster\.version,entries\}\}\)/);
  assert.match(app,/if\(error\.status===409\)\{try\{await loadRoster\(\);\}catch\{\}\}/);
  assert.match(app,/request\('\/api\/settings\/pulse-features',\{\.\.\.options\(\),body:\{people:button\.dataset\.on==='1'\}\}\)/);
  // 묻기 단추: 비었거나 앞 단추가 채운 글 그대로면 이 단추의 글로 바꾼다(Fable F1). 지우기 확인 창은 저장 뒤 닫는다(F2). 고치기 칸을 닫으면 쓰던 값을 잊는다(F4).
  assert.match(app,/if\(field&&\(!field\.value\.trim\(\)\|\|field\.value===journalSaid\)\)\{journalSaid=say;field\.value=say;/);
  assert.match(app,/confirmAction=async\(\)=>\{try\{await saveRoster\(r\.entries\.filter\(\(_,i\)=>i!==at\),'칸을 지웠어요\.'\);\}finally\{closeDialog\(\);\}\};/);
  assert.match(app,/if\(action==='people-cancel'\)\{forgetRosterDrafts\(\);r\.editing=null;render\(\);return;\}/);
  assert.match(app,/if\(key\)clearDraft\(key,revision\);if\(!form\)forgetRosterDrafts\(\);/);
  // 직원 미리 보기는 손님 창과 같은 어두운 판(F3).
  assert.match(read('staff.css'),/\.ppl-preview-box\{[^}]*background:#000;color:var\(--sx-ink\)\}/);
  assert.match(views,/const peopleOn=s=>isCustomerRoom\(s\)&&s\.people\?\.projectId===s\.project\?\.id&&\(s\.people\.on===true&&\['make','review'\]\.includes\(roomModel\(s\.project\)\.stage\)\|\|peopleRequests\(s\.project\)\.length>0\);/);
  assert.match(views,/if\(view==='people'&&peopleOn\(s\)\)return peopleRoom\(s\);/);
  assert.match(views,/\$\{info\.people\?peopleEntry\(s\):''\}/);
  assert.match(views,/\$\{s\.staffIntake\?\.canEdit\?btn\(STAFF_HEAD\.roster,'people-roster'/);
  assert.match(film,/p\.people&&\['people',t\('인플루언서 광고'\)\]/);
  assert.match(film,/\$\{p\?\.people\?`<p class="sx-done-next"><button type="button" class="sx-quiet" data-room-go="people">/);
  assert.match(room,/\['draft','films','pick','marketing','people'\]\.includes\(id\)/);
  assert.match(sw,/RUNTIME\.push\(BASE\+'people-view\.mjs'\);/,'손님 칸 모듈은 받을 때 담는다');assert.doesNotMatch(sw,/people-roster-view/,'직원 화면은 손님 셸에 담지 않는다');
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/'marketing-view\.mjs','people-view\.mjs','people-roster-view\.mjs','desk-view\.mjs'/);
});

// ── 조각 ②(11-23): 의뢰 동작의 화면 — 내 의뢰 · 의뢰 시트 · 일지 줄 · 제작 보드 꼬리표 · desk 칸 ──
const {journalModel,careOf,roomRoute,peopleRequests,openRequest,PEOPLE_STEPS}=await import('./public/pulse-app/room-view.mjs');
const {deskView}=await import('./public/pulse-app/desk-view.mjs');
const req=(extra={})=>({id:'pr_'+(extra.status||'sent'),at:'2026-11-23T01:00:00.000Z',status:'sent',channel:{id:'ch_cafe01',name:'합성 카페',platform:'instagram',handle:'@synthetic.cafe',url:'https://www.instagram.com/synthetic.cafe/',virtual:false,price:300000},note:'주말 오전이면 좋겠어요',quote:null,trail:[{kind:'sent',at:'2026-11-23T01:00:00.000Z',by:'customer'}],...extra});
const quoted=()=>req({id:'pr_q',status:'quoted',quote:{amount:350000,includes:'게시 1회 · 직접 찍은 후기',postBy:'2026-11-30',at:'2026-11-23T02:00:00.000Z'},channel:{id:'ch_beauty1',name:'합성 뷰티',platform:'youtube',handle:'',url:'',virtual:true,price:null}});

test('내 의뢰: 진행 줄, 값 안내의 동의 · 진행하지 않기, 결제 전 거두기, 게시물 · 결과, 끝난 의뢰는 접는다',()=>{
  const posted=req({id:'pr_p',status:'posted',channel:{...req().channel,id:'ch_run0001',name:'합성 러닝'},posts:['https://www.instagram.com/p/abc/','javascript:alert(1)'],disclosed:true});
  const done=req({id:'pr_d',status:'done',at:'2026-11-20T01:00:00.000Z',result:'3일 동안 조회 1.2만',channel:{...req().channel,id:'ch_old0001',name:'합성 지난'}});
  const closed=req({id:'pr_c',status:'closed',at:'2026-11-19T01:00:00.000Z',closed:{by:'staff',why:'채널 일정이 맞지 않아요',at:'2026-11-19T03:00:00.000Z',from:'sent'},channel:{...req().channel,id:'ch_old0002',name:'합성 닫힘'}});
  const requests=[req(),quoted(),posted,done,closed];
  const html=peopleScreen({entries:[channel()],kind:'food',requests,hasVideo:true});
  assert.match(html,/<h2 class="sx-small sx-ppl-group-head" id="ppl-mine-h">내 의뢰<\/h2>/);
  assert.ok(html.indexOf('내 의뢰')<html.indexOf('이 제품에 맞는 채널'),'내 의뢰가 명단보다 먼저');
  assert.match(html,/data-ppl-do="agree" data-id="pr_q" data-amount="350000"/);assert.match(html,/data-ppl-do="decline" data-id="pr_q"/);
  assert.match(html,/data-ppl-do="cancel" data-id="pr_sent"/,'보냄 상태는 거둘 수 있다');assert.doesNotMatch(html,/data-ppl-do="cancel" data-id="pr_p"/,'게시 뒤에는 앱에서 거두지 않는다');
  assert.match(html,/<li class="is-now" aria-current="step">값 안내<\/li>/);
  assert.match(html,/<dt class="sx-small">값<\/dt><dd>350,000원<\/dd>/);assert.match(html,/게시 1회 · 직접 찍은 후기/);assert.match(html,/<dt class="sx-small">게시 예정일<\/dt>/);
  assert.match(html,/href="https:\/\/www\.instagram\.com\/p\/abc\/"[^>]*>게시물 보기<\/a>/);assert.doesNotMatch(html,/javascript:/,'게시물 주소는 https만');
  assert.match(html,/지난 의뢰 2건/);assert.doesNotMatch(html,/합성 지난/,'지난 의뢰는 접혀 있다');
  const open=peopleScreen({entries:[channel()],kind:'food',requests,hasVideo:true,past:true});
  assert.match(open,/3일 동안 조회 1\.2만/);assert.match(open,/담당자가 의뢰를 닫았어요\./);assert.match(open,/까닭: 채널 일정이 맞지 않아요/);assert.match(open,/지난 의뢰 접기/);
  assert.match(html,/남기신 말: 주말 오전이면 좋겠어요/);
  assert.doesNotMatch(html,/\sstyle=/);
  // 스위치가 꺼져 명단이 없어도 보낸 의뢰는 보인다.
  const off=peopleScreen({requests:[req()],rosterOn:false,status:'off'});
  assert.match(off,/내 의뢰/);assert.match(off,/지금은 새 채널을 열어 두지 않았어요/);assert.doesNotMatch(off,/data-ppl-filter/);
  // 미리 보기는 동작 단추가 없다.
  assert.doesNotMatch(peopleScreen({requests,preview:true,entries:[channel()]}),/data-ppl-do="(agree|decline|cancel)"/);
  assert.deepEqual(PEOPLE_STEPS,['sent','quoted','agreed','paid','posted','done']);
  assert.equal(openRequest(posted),true);assert.equal(openRequest(done),false);assert.equal(openRequest(closed),false);
});

test('의뢰 시트: 채널 줄 아래에 펴고, 막히는 때는 까닭 한 줄과 함께 막는다',()=>{
  const before=peopleScreen({entries:[channel()],kind:'food',hasVideo:false});
  assert.match(before,/영상 시안이 나온 뒤에 의뢰할 수 있어요/);assert.match(before,/<button type="button" class="sx-go" disabled aria-disabled="true"><span>이 채널에 의뢰하기/);
  const closed=peopleScreen({entries:[channel()],kind:'food',hasVideo:true});
  assert.match(closed,/data-ppl-do="open" data-id="ch_cafe01" aria-expanded="false"/);assert.doesNotMatch(closed,/data-form="people-request"/);
  const html=peopleScreen({entries:[channel()],kind:'food',hasVideo:true,sheet:'ch_cafe01'});
  assert.match(html,/aria-expanded="true"/);assert.match(html,/<form class="sx-ppl-sheet" data-form="people-request" data-id="ch_cafe01"/);
  assert.match(html,/<textarea name="note" rows="3" maxlength="500"/);assert.match(html,/채널 게시물에는 「광고」 표시를 붙여요\./);
  assert.match(html,/값에 동의하시면 크몽에서 결제해요/);assert.match(html,/게시 한 번 300,000원/);
  assert.match(html,/data-room-do="journal" data-journal-say="「합성 카페」/,'먼저 물어보기는 나눈 말의 묻기 칸으로');
  // 열린 의뢰는 프로젝트마다 한 건 — 다른 채널 줄도 같은 까닭으로 막는다.
  const other=req({id:'pr_o',channel:{...req().channel,id:'ch_other01'}});
  const busy=peopleScreen({entries:[channel()],kind:'food',hasVideo:true,requests:[other]});
  assert.match(busy,/진행 중인 의뢰가 끝난 뒤에 다른 채널에 의뢰할 수 있어요/);assert.doesNotMatch(busy,/data-ppl-do="open" data-id="ch_cafe01" aria-expanded/,'열린 의뢰가 있으면 시트를 열지 않는다');
  const many=Array.from({length:20},(_,i)=>req({id:'pr_x'+i,status:'closed',closed:{by:'customer',why:'',at:'2026-11-20T00:00:00.000Z',from:'sent'},channel:{...req().channel,id:'ch_z'+String(i).padStart(4,'0')}}));
  assert.match(peopleScreen({entries:[channel()],kind:'food',hasVideo:true,requests:many}),/보낼 수 있는 의뢰를 다 썼어요/);
  const preview=peopleScreen({entries:[channel()],kind:'food',hasVideo:true,sheet:'ch_cafe01',preview:true});
  assert.doesNotMatch(preview,/data-form="people-request"/);assert.doesNotMatch(preview,/data-ppl-do="open"/);
  assert.doesNotMatch(html,/\sstyle=/);
});

test('영어: 내 의뢰와 의뢰 시트도 영어로 그린다',async()=>{
  registerLocale('en',en);await setLocale('en');
  try{
    // 열린 의뢰는 한 건이라 시트는 끝난 의뢰만 있을 때 연다(값 안내 · 거두기는 각각 따로 그린다).
    const html=peopleScreen({entries:[channel()],kind:'food',hasVideo:true,requests:[quoted()]});
    const sent=peopleScreen({entries:[channel()],kind:'food',hasVideo:true,requests:[req({id:'pr_s2',channel:{...req().channel,id:'ch_other01',name:'합성 둘'},note:''})]});
    const sheet=peopleScreen({entries:[channel()],kind:'food',hasVideo:true,sheet:'ch_cafe01',requests:[req({id:'pr_d2',status:'done',result:'',channel:{...req().channel,id:'ch_other02',name:'합성 셋'},note:''})]});
    assert.match(html,/My requests/);assert.match(html,/Go ahead at this price/);assert.match(sheet,/Send request/);assert.match(html,/KRW 350,000/);assert.match(sent,/Withdraw request/);
    assert.match(sent,/You can request another channel once your current request is finished/);
    for(const page of [sent,sheet])assert.doesNotMatch(page.replace(/합성 [가-힣]+|카페를 찾는 20대|>합<|주말 오전이면 좋겠어요/g,''),/[가-힣]/,'채널 이름 · 손님 글 말고는 한글이 없다');
    assert.doesNotMatch(html.replace(/합성 [가-힣]+|카페를 찾는 20대|>합<|게시 1회 · 직접 찍은 후기|주말 오전이면 좋겠어요/g,''),/[가-힣]/,'채널 이름 · 직원 글 · 손님 글 말고는 한글이 없다');
  }finally{await setLocale('ko');}
});

test('일지 줄 · 알림 길 · 제작 보드 꼬리표: 의뢰의 trail과 담당자 차례',()=>{
  const r=req({status:'quoted',quote:{amount:350000,includes:'',postBy:'',at:'2026-11-23T02:00:00.000Z'},trail:[{kind:'sent',at:'2026-11-23T01:00:00.000Z',by:'customer'},{kind:'quoted',at:'2026-11-23T02:00:00.000Z',by:'staff'}]});
  const p={id:'p1',stage:'review',ownerName:'담당자',versions:[],messages:[],studio:{request:{status:'confirmed',answers:{},submittedAt:'2026-11-10T00:00:00.000Z'},people:{schemaVersion:1,requests:[r,{id:7},{id:'bad',status:'odd'}]}}};
  assert.equal(peopleRequests(p).length,1,'꼴이 틀린 의뢰는 거른다');
  const j=journalModel(p),lines=j.items.filter(item=>item.id.startsWith('g:'));
  assert.deepEqual(lines.map(item=>item.what),['「합성 카페」 광고 값을 알려 드렸어요','「합성 카페」 채널에 광고를 의뢰했어요']);
  assert.equal(lines[1].who,'me');assert.equal(lines[0].who,'staff');assert.deepEqual(lines[0].go,{tab:'people'});
  assert.deepEqual(roomRoute({tab:'people',peopleId:'pr_quoted'},p),{tab:'people',versionId:'',peopleId:'pr_quoted'});
  assert.equal(careOf(p).people,0,'값 안내를 보낸 뒤는 손님 차례');
  assert.equal(careOf({...p,studio:{...p.studio,people:{requests:[req(),req({id:'pr_a',status:'agreed'}),req({id:'pr_z',status:'paid'})]}}}).people,2,'보냄 · 동의가 담당자 차례');
  assert.equal(careOf({...p,stage:'archived',studio:{...p.studio,people:{requests:[req()]}}}).people,0);
});

test('desk 칸: 상태마다 다음 양식 하나, 닫기는 까닭과 함께, 영어 프로젝트는 영어 칸',()=>{
  const base={queue:[],brief:[],files:[],checks:[],number:'P-2026-0001',at:'',title:'합성 프로젝트',canEdit:true};
  const html=deskView({...base,people:[req(),quoted(),req({id:'pr_a',status:'agreed'}),req({id:'pr_paid',status:'paid',paid:{at:'2026-11-23T04:00:00.000Z',ref:'크몽 123'}}),req({id:'pr_post',status:'posted',posts:['https://www.instagram.com/p/abc/']}),req({id:'pr_done',status:'done',result:'조회 1.2만'})]},{bar:false});
  assert.match(html,/<section class="desk-talk desk-ppl" data-desk-people><h2>인플루언서 광고 의뢰 <span class="desk-talk-n">우리 차례 3<\/span><\/h2>/);
  assert.match(html,/data-form="desk-people-quote" data-id="pr_sent"/);assert.match(html,/손님에게 값 보내기/);assert.match(html,/data-form="desk-people-quote" data-id="pr_q"[\s\S]*?value="350000"/);
  assert.match(html,/data-form="desk-people-paid" data-id="pr_a"/);assert.match(html,/data-form="desk-people-posted" data-id="pr_paid"[\s\S]*?name="disclosed" required/);
  assert.match(html,/data-form="desk-people-done" data-id="pr_post"/);assert.match(html,/결제 확인 [^<]* · 크몽 123/);
  assert.match(html,/data-form="desk-people-close" data-id="pr_paid"[\s\S]*?환불은 크몽에서 따로 처리해 주세요/);
  assert.match(html,/<summary>지난 의뢰 1<\/summary>/);assert.doesNotMatch(html,/data-form="desk-people-[a-z]+" data-id="pr_done"/,'끝난 의뢰에는 양식이 없다');
  assert.doesNotMatch(html,/name="includesTr"/);
  const english=deskView({...base,translation:{locale:'en',entries:{}},people:[req(),req({id:'pr_post',status:'posted'})]},{bar:false});
  assert.match(english,/name="includesTr"/);assert.match(english,/name="resultTr"/);assert.match(english,/name="whyTr"/);
  const readOnly=deskView({...base,canEdit:false,people:[req()]},{bar:false});assert.doesNotMatch(readOnly,/data-form="desk-people-/);
  assert.equal(deskView({...base,people:[]},{bar:false}).includes('data-desk-people'),false,'의뢰가 없으면 칸이 없다');
});

test('잇는 자리(조각 ②): 보내기 · 동의 · 거두기는 판 번호 길로, 409면 한 번 다시, 알림은 그 의뢰 카드로',()=>{
  const app=read('app.mjs'),views=read('views.mjs'),film=read('film-views.mjs');
  assert.match(app,/const studioStale=error=>\{const stale=k\('그사이 프로젝트가 바뀌었어요\. 최신 내용을 불러온 뒤 다시 저장해 주세요\.'\);return error\?\.status===409&&!error\.code&&\(error\.message===stale\|\|error\.message===t\(stale\)\);\};/);
  assert.match(app,/if\(!studioStale\(error\)\)\{if\(error\?\.status===409&&action==='people_request'\)rosterStale=true;throw error;\}\r?\n      accept\(await request\('\/pulse\/api\/project'\)\);\r?\n[^\n]*\r?\n      try\{return await studioAction\(action,values\);\}catch\(again\)\{if\(again\?\.status===409&&action==='people_request'&&!studioStale\(again\)\)rosterStale=true;throw again;\}/,'다시 보낸 것도 명단 409면 명단을 다시 읽는다(최종 검수 P2-2)');
  assert.match(app,/peopleSend\('people_request',\{channelId,note,rosterVersion:p\.version\}/);
  assert.match(app,/peopleSend\('people_agree',\{requestId:id,amount\}/);assert.match(app,/peopleSend\('people_cancel',\{requestId:id\}/);
  assert.match(app,/p\.version=Number\.isSafeInteger\(result\?\.version\)\?result\.version:null;/);
  assert.match(app,/if\(routed\?\.peopleId&&focusPeopleRequest\(routed\.peopleId\)\)return;/);
  for(const action of ['people_quote','people_paid','people_posted','people_done','people_close'])assert.match(app,new RegExp(`studioAction\\('${action}'`));
  assert.match(app,/studioAction\('people_posted',\{requestId:form\.dataset\.id,posts,disclosed:true\}\)/);
  assert.match(views,/item\.people>0\?`<span class="staff-care is-ask">인플루언서 의뢰 \$\{item\.people\}<\/span>`/);
  assert.match(views,/const recent=item=>item\.turn!=='done'\|\|item\.asks>0\|\|item\.people>0\|\|/);
  assert.match(film,/p\?\.peopleOpen\?t\('광고가 끝날 때까지 이 방은 열려 있어요\. 받은 파일은 따로 보관해 주세요\.'\)/);
  for(const name of ['people-view.mjs','room-view.mjs','views.mjs','film-views.mjs'])assert.doesNotMatch(read(name),/Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora|Veo|Suno|유호님/,name+'에 도구 이름이 없다');
});

test('같은 채널은 칸 id로만 본다 — desk 의뢰 줄에 계정 이름 · 채널 주소, 명단의 주소가 같은 칸에 알림(설계 검토 P2-3 · P3-6, 다시 검수 P2)',()=>{
  const base={queue:[],brief:[],files:[],checks:[],number:'P-2026-0001',at:'',title:'합성 프로젝트',canEdit:true};
  const html=deskView({...base,people:[req(),req({id:'pr_bad',channel:{...req().channel,id:'ch_bad0001',handle:'',url:'javascript:alert(1)'}})]},{bar:false});
  assert.match(html,/@synthetic\.cafe · <a href="https:\/\/www\.instagram\.com\/synthetic\.cafe\/" target="_blank" rel="noopener noreferrer">/,'계정 이름과 https 주소 링크');
  assert.doesNotMatch(html,/href="javascript:/,'https가 아닌 주소는 링크가 되지 않는다');
  const twins=rosterDesk(rosterData({entries:[{...channel(),id:'ch_one0001',example:false},{...channel(),id:'ch_two0001',name:'둘째 칸',url:channel().url+'#x',example:false},{...PEOPLE_SEED[0]}]}));
  assert.equal(twins.match(/같은 채널일 수 있어요/g)?.length,2,'주소가 같은 두 칸에만(# 뒤만 다른 칸 포함, 주소가 빈 예시 칸은 아님)');
  assert.doesNotMatch(rosterDesk(rosterData()),/같은 채널일 수 있어요/);
  assert.match(rosterDesk(rosterData({editing:1})),/의뢰가 있는 칸은 다른 채널로 고쳐 쓰지 말고 새 칸으로 넣어 주세요/);
});
