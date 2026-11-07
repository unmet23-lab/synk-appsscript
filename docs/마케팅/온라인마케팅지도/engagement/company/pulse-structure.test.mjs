import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectView,headerCrumb,tabs} from './public/pulse-app/views.mjs';

// PULSE 고객 화면 구조(2026-11-05 시사실 판): 머리 막대 · 단계 낱말 줄 · 현황은 왼쪽 할 일 · 오른쪽 작업물 · 아래 인화지.
globalThis.location=new URL('http://localhost/pulse-app/');
const at='2026-10-16T09:00:00Z';
const media=name=>({url:`http://localhost/pulse-app/${name}`,mimeType:name.endsWith('.mp4')?'video/mp4':'image/png'});
function project(){
  return {id:'p',revision:7,title:'霜の肌理 15초 광고',customerName:'霜の肌理',ownerName:'김하늘',stage:'review',dueDate:'2026-10-31',
    versions:[{id:'v1',kind:'preview',label:'시안 v1',media:media('v1.mp4')},{id:'v2',kind:'preview',label:'시안 v2',guide:'마지막 문구를 단추로 바꿨어요.',media:media('v2.mp4')}],
    messages:[{id:'m1',author:'customer',authorName:'霜の肌理 팀',action:'feedback',versionId:'v1',seconds:3,text:'제품 이름 글자를 크게 해 주세요.',resolved:true,at},
      {id:'m2',author:'staff',authorName:'김하늘',action:'reply',versionId:'v2',text:'두 의견 모두 반영했어요.',at:'2026-10-17T03:00:00Z'}],
    studio:{preferences:{brand:'霜の肌理'},assets:[],references:[{id:'r',label:'참고',preference:'like'}],
      concepts:[{id:'c1',title:'A. 나만의 아침 루틴',tagline:'한 잔으로 시작하는 루틴',media:media('a.png'),revision:1},{id:'c2',title:'B. 선명한 한 잔',media:media('b.png'),revision:1}],
      selectedConcept:{conceptId:'c1',current:true},scenes:[1,2,3,4].map(i=>({id:'s'+i,title:'장면 '+i,duration:i===1?3:4,media:media(`s${i}.png`),revision:1})),
      sceneReviews:[1,2,3,4].map(i=>({id:'sr'+i,sceneId:'s'+i,status:'confirmed',current:true})),comments:[],strategy:{revision:1,confirmation:{strategyRevision:1}}}};
}
const state=(over={})=>({mode:'customer',tab:'overview',project:project(),workflow:[],...over});

test('every project page has one step line that opens every stage and says where the customer is',()=>{
  for(const tab of ['overview',...tabs.map(t=>t[0])]){
    const html=projectView(state({tab}));
    assert.equal((html.match(/<nav class="sx-steps" aria-label="제작 단계">/g)||[]).length,1,tab);
    // 단계 줄의 단추 계약은 그대로다: 현황 + 6단계, 각각 data-action="tab"
    assert.equal((html.match(/class="sx-step[^"]*" data-action="tab" data-tab="overview"/g)||[]).length,1,tab);
    for(const [key] of tabs)assert.equal((html.match(new RegExp(`class="sx-step[^"]*" data-action="tab" data-tab="${key}"`,'g'))||[]).length,1,tab+' '+key);
    assert.match(html,new RegExp(`data-tab="${tab}" aria-current="page"`),tab);
    // 왼쪽 레일 · 카드 격자로 돌아가지 않는다.
    assert.doesNotMatch(html,/class="rail"|class="mstep"|class="project-shell/,tab);
    assert.doesNotMatch(html,/class="journey|stage-poster|stage-index|project-head/,tab);
  }
});

test('the overview leads with the work itself, what changed, progress and the chosen concept and scenes',()=>{
  const html=projectView(state());
  assert.match(html,/<section class="sx-next-block">[\s\S]*<h1 class="sx-display">[\s\S]*data-tab="review"/);
  assert.match(html,/class="sx-room-screen"><video class="sx-q-fill" src="http:\/\/localhost\/pulse-app\/v2\.mp4" preload="metadata" muted playsinline aria-hidden="true" data-hold>/,'the overview shows the latest cut, and it rests on its end shot rather than its first frame');
  assert.match(html,/sx-room-cap">시안 v2</);
  assert.match(html,/<p class="focus-memo"><span>제작팀 메모<\/span>마지막 문구를 단추로 바꿨어요\.<\/p>/);
  assert.match(html,/시안 v1에 남긴 의견 1개를 반영했어요/);assert.match(html,/<time>0:03<\/time><p>제품 이름 글자를 크게 해 주세요\.<\/p>/);
  assert.match(html,/6단계 중 4단계 끝/);
  assert.match(html,/고른 콘셉트[\s\S]*A\. 나만의 아침 루틴/);
  assert.match(html,/장면 4개 · 15초/);assert.match(html,/4개 모두 확인했어요/);
  assert.match(html,/담당자 답변 · 두 의견 모두 반영했어요\./);
});

test('a project with no work yet shows an example of what comes next instead of an empty frame, and says it is an example',()=>{
  const p=project();p.versions=[];p.stage='received';p.messages=[];Object.assign(p.studio,{concepts:[],scenes:[],sceneReviews:[],selectedConcept:null,references:[],preferences:{},strategy:{revision:0}});
  const html=projectView(state({project:p}));
  assert.match(html,/class="sx-room-screen"><img class="sx-q-fill" src="\.\/assets\/request\/w-gift-snow\.webp"/);
  assert.match(html,/다음에 받으실 장면 이미지의 예시예요\. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요\./);
  assert.doesNotMatch(html,/<video/);
});

test('step pages keep the stage title and the refresh tool, and staff also get the manage step',()=>{
  // 고객 영상 확인(시사실 판)은 실시간 갱신이 있어 상시 「최신 내용 불러오기」를 두지 않는다(의뢰 흐름 9절 5번). 충돌 알림 안의 링크는 남는다.
  const html=projectView(state({tab:'strategy'}));
  assert.match(html,/<header class="sx-shell-head">[\s\S]*<p class="sx-kicker">01 · 제작 설계<\/p><h1 class="sx-display">만들기 전에, 같은 목표를 봐요\.<\/h1>/);
  assert.match(html,/data-action="refresh"/);
  assert.doesNotMatch(projectView(state({tab:'review'})),/data-action="refresh"/);
  assert.match(projectView(state({tab:'review',error:'이미 바뀌었어요.',conflict:true})),/data-action="refresh"/);
  const staff=projectView(state({mode:'staff',canEdit:true,tab:'manage'}));
  assert.match(staff,/data-action="tab" data-tab="manage" aria-current="page"/);
  assert.match(staff,/<p class="canvas-kicker">프로젝트 관리<\/p>/);
  assert.doesNotMatch(staff,/문의 남기기/);
});

test('the header shows the open project, its stage and due date, and nothing without a project',()=>{
  assert.equal(headerCrumb({project:null}),'');
  const crumb=headerCrumb(state());
  assert.match(crumb,/<b class="crumb-title">霜の肌理 15초 광고<\/b><span class="crumb-stage stage-review">시안 확인<\/span>/);
  assert.match(crumb,/<span class="crumb-due">전달 예정 <time datetime="2026-10-31">/);
});

test('customers land on the overview and tab buttons scroll to content, the inquiry, the deliverables or the top',()=>{
  const app=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
  assert.match(app,/if\(!s\.project&&s\.mode==='customer'&&!demo\)s\.tab='overview';/);
  assert.match(app,/const crumb=document\.querySelector\('#header-crumb'\);if\(crumb\)crumb\.innerHTML=headerCrumb\(s\);/);
  assert.match(app,/toInquiry\?'\.review-form':toDeliverables\?'\.deliverables-panel'/);assert.match(app,/if\(toInquiry\)target\?\.querySelector\('textarea'\)\?\.focus\(\{preventScroll:true\}\)/);assert.doesNotMatch(app,/centerJourney|journeyEdges|section-intro h2/);
  // 내용·문의로 내려가는 단추는 맨 위로 되돌아가지 않는다
  assert.match(app,/if\(toContent\|\|toInquiry\|\|toDeliverables\)\{target\?\.scrollIntoView\(\{block:'start',behavior:'auto'\}\);if\(toInquiry\)[^}]*\}\);\}else if\(typeof window\.scrollTo==='function'\)window\.scrollTo\(0,0\);/);
  const index=readFileSync(new URL('./public/pulse-app/index.html',import.meta.url),'utf8');
  assert.match(index,/<div id="header-crumb" class="header-crumb"><\/div>/);
});
