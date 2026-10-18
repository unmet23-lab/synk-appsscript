import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectView,headerCrumb,tabs} from './public/pulse-app/views.mjs';

// PULSE 고객 화면 구조(2026-10-17): 머리 막대 · 왼쪽 단계 레일(휴대폰은 접는 한 줄) · 처음 현황판 · 아래 승인 막대.
globalThis.location=new URL('http://localhost/pulse-app/');
const at='2026-10-16T09:00:00Z';
const media=name=>({url:`http://localhost/pulse-app/${name}`,mimeType:name.endsWith('.mp4')?'video/mp4':'image/png'});
function project(){
  return {id:'p',revision:7,title:'모루 드립백 15초 광고',customerName:'모루 커피',ownerName:'김하늘',stage:'review',dueDate:'2026-10-31',
    versions:[{id:'v1',kind:'preview',label:'시안 v1',media:media('v1.mp4')},{id:'v2',kind:'preview',label:'시안 v2',guide:'마지막 문구를 단추로 바꿨어요.',media:media('v2.mp4')}],
    messages:[{id:'m1',author:'customer',authorName:'모루 팀',action:'feedback',versionId:'v1',seconds:3,text:'제품 이름 글자를 크게 해 주세요.',resolved:true,at},
      {id:'m2',author:'staff',authorName:'김하늘',action:'reply',versionId:'v2',text:'두 의견 모두 반영했어요.',at:'2026-10-17T03:00:00Z'}],
    studio:{preferences:{brand:'모루'},assets:[],references:[{id:'r',label:'참고',preference:'like'}],
      concepts:[{id:'c1',title:'A. 나만의 아침 루틴',tagline:'한 잔으로 시작하는 루틴',media:media('a.png'),revision:1},{id:'c2',title:'B. 선명한 한 잔',media:media('b.png'),revision:1}],
      selectedConcept:{conceptId:'c1',current:true},scenes:[1,2,3,4].map(i=>({id:'s'+i,title:'장면 '+i,duration:i===1?3:4,media:media(`s${i}.png`),revision:1})),
      sceneReviews:[1,2,3,4].map(i=>({id:'sr'+i,sceneId:'s'+i,status:'confirmed',current:true})),comments:[],strategy:{revision:1,confirmation:{strategyRevision:1}}}};
}
const state=(over={})=>({mode:'customer',tab:'overview',project:project(),workflow:[],...over});

test('every project page has the step rail, the folding phone step bar and one next-decision section',()=>{
  for(const tab of ['overview',...tabs.map(t=>t[0])]){
    const html=projectView(state({tab}));
    assert.match(html,/<aside class="rail" aria-label="프로젝트 단계">/,tab);
    assert.match(html,/<details class="mstep">/,tab);
    assert.equal((html.match(/<section class="next-decision">/g)||[]).length,1,tab);
    // 레일과 휴대폰 목록이 같은 단추 계약을 쓴다: 현황 + 6단계, 각각 data-action="tab"
    assert.equal((html.match(/data-action="tab" data-tab="overview"/g)||[]).length,2,tab);
    for(const [key] of tabs)assert.equal((html.match(new RegExp(`data-action="tab" data-tab="${key}" aria-current`,'g'))||[]).length,2,tab+' '+key);
    assert.match(html,new RegExp(`data-tab="${tab}" aria-current="page"`),tab);
    assert.doesNotMatch(html,/class="journey|stage-poster|stage-index|project-head/,tab);
  }
});

test('the overview leads with the work itself, what changed, progress and the chosen concept and scenes',()=>{
  const html=projectView(state());
  assert.match(html,/<h1>모루 드립백 15초 광고<\/h1>/);
  assert.match(html,/<section class="focus" aria-label="지금 할 일"><button type="button" class="focus-media" data-action="tab" data-tab="review" data-scroll="content"/);
  assert.match(html,/<video src="http:\/\/localhost\/pulse-app\/v2\.mp4#t=0\.5" preload="metadata" muted playsinline/);
  assert.match(html,/<span class="media-tag is-new">새 시안<\/span>/);
  assert.match(html,/<p class="focus-memo"><span>제작팀 메모<\/span>마지막 문구를 단추로 바꿨어요\.<\/p>/);
  assert.match(html,/시안 v1에서 반영한 의견 1/);assert.match(html,/<time>0:03<\/time><p>제품 이름 글자를 크게 해 주세요\.<\/p>/);
  assert.match(html,/<b>4 \/ 6 단계 끝<\/b>/);
  assert.match(html,/함께 고른 콘셉트[\s\S]*A\. 나만의 아침 루틴/);
  assert.match(html,/장면 4개 · 15초/);assert.match(html,/4개 모두 확인했어요/);
  assert.match(html,/제작팀 답변 · 두 의견 모두 반영했어요\./);
  assert.match(html,/<section class="next-decision">[\s\S]*data-tab="review" data-scroll="content"/);
});

test('a project with no work yet shows the stage object instead of an empty frame',()=>{
  const p=project();p.versions=[];p.stage='received';p.messages=[];Object.assign(p.studio,{concepts:[],scenes:[],sceneReviews:[],selectedConcept:null,references:[],preferences:{},strategy:{revision:0}});
  const html=projectView(state({project:p}));
  assert.match(html,/class="focus-media studio-board" data-stage="[a-z]+"/);
  assert.match(html,/<img class="cut" src="\.\/assets\/stage\/stage-[a-z]+\.webp"/);
  assert.doesNotMatch(html,/<video/);
});

test('step pages keep the stage title and the refresh tool, and staff also get the manage step',()=>{
  const html=projectView(state({tab:'review'}));
  assert.match(html,/<header class="canvas-head"><div class="canvas-copy"><p class="canvas-kicker">05 · 영상 확인<\/p><h1>이제 영상으로 <span>확인해요\.<\/span><\/h1>/);
  assert.match(html,/data-action="refresh"/);
  const staff=projectView(state({mode:'staff',canEdit:true,tab:'manage'}));
  assert.match(staff,/data-action="tab" data-tab="manage" aria-current="page"/);
  assert.match(staff,/<p class="canvas-kicker">프로젝트 관리<\/p>/);
  assert.doesNotMatch(staff,/문의 남기기/);
});

test('the header shows the open project, its stage and due date, and nothing without a project',()=>{
  assert.equal(headerCrumb({project:null}),'');
  const crumb=headerCrumb(state());
  assert.match(crumb,/<b class="crumb-title">모루 드립백 15초 광고<\/b><span class="crumb-stage stage-review">시안 확인<\/span>/);
  assert.match(crumb,/<span class="crumb-due">전달 예정 <time datetime="2026-10-31">/);
});

test('customers land on the overview and tab buttons scroll to content, the inquiry or the top',()=>{
  const app=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
  assert.match(app,/if\(!s\.project&&s\.mode==='customer'&&!demo\)s\.tab='overview';/);
  assert.match(app,/const crumb=document\.querySelector\('#header-crumb'\);if\(crumb\)crumb\.innerHTML=headerCrumb\(s\);/);
  assert.match(app,/toInquiry\?'\.review-form'/);assert.match(app,/if\(toInquiry\)target\?\.querySelector\('textarea'\)\?\.focus\(\{preventScroll:true\}\)/);assert.doesNotMatch(app,/centerJourney|journeyEdges|section-intro h2/);
  // 내용·문의로 내려가는 단추는 맨 위로 되돌아가지 않는다
  assert.match(app,/if\(toContent\|\|toInquiry\)\{target\?\.scrollIntoView\(\{block:'start',behavior:'auto'\}\);if\(toInquiry\)[^}]*\}\);\}else if\(typeof window\.scrollTo==='function'\)window\.scrollTo\(0,0\);/);
  const index=readFileSync(new URL('./public/pulse-app/index.html',import.meta.url),'utf8');
  assert.match(index,/<div id="header-crumb" class="header-crumb"><\/div>/);
});
