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
    assert.match(html,/Whose channel should this video go on\?/);assert.match(html,/One post KRW 300,000/);assert.match(html,/Ask about this channel/);
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
  assert.match(app,/if\(error\?\.status===404\)\{p\.on=false;p\.status='off';if\(roomTab\(s\.tab\)==='people'\)s\.tab='overview';\}/);
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
  assert.match(views,/const peopleOn=s=>isCustomerRoom\(s\)&&s\.people\?\.projectId===s\.project\?\.id&&s\.people\.on===true&&\['make','review'\]\.includes\(roomModel\(s\.project\)\.stage\);/);
  assert.match(views,/if\(view==='people'&&peopleOn\(s\)\)return peopleRoom\(s\);/);
  assert.match(views,/\$\{info\.people\?peopleEntry\(\):''\}/);
  assert.match(views,/\$\{s\.staffIntake\?\.canEdit\?btn\(STAFF_HEAD\.roster,'people-roster'/);
  assert.match(film,/p\.people&&\['people',t\('인플루언서 광고'\)\]/);
  assert.match(film,/\$\{p\?\.people\?`<p class="sx-done-next"><button type="button" class="sx-quiet" data-room-go="people">/);
  assert.match(room,/\['draft','films','pick','marketing','people'\]\.includes\(id\)/);
  assert.match(sw,/RUNTIME\.push\(BASE\+'people-view\.mjs'\);/,'손님 칸 모듈은 받을 때 담는다');assert.doesNotMatch(sw,/people-roster-view/,'직원 화면은 손님 셸에 담지 않는다');
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/'marketing-view\.mjs','people-view\.mjs','people-roster-view\.mjs','desk-view\.mjs'/);
});
