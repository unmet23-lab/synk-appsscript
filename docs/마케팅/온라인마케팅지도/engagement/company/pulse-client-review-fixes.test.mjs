import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {welcome,projectView,PULSE_INQUIRY_URL} from './public/pulse-app/views.mjs';
import {createDemoSession} from './public/pulse-app/demo.mjs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {castingView} from './public/pulse-app/casting-view.mjs';

// Fixes from the 2026-11-02 client review of the live client room and casting book: a real
// inquiry path for people without a project, a confirmed scene that cannot be confirmed
// again, storyboard images that are never cropped, and a saved notice that never covers
// the button or player a person is using.
globalThis.location=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const INQUIRY=`<a class="inquiry-link" href="${PULSE_INQUIRY_URL}" target="_blank" rel="noopener noreferrer">영상 제작 문의하기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`;
function setup(){const values=new Map();let tick=0;return createDemoSession({storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},clock:()=>new Date(Date.UTC(2026,10,2,1,0,tick++)).toISOString()});}
const project=demo=>demo.snapshot().project;
const post=(demo,path,body)=>demo.request(path,{body:{...body,revision:project(demo).revision}});
const studio=(demo,body)=>post(demo,'/pulse/api/studio',body);
const action=(demo,body)=>post(demo,'/pulse/api/action',body);
const view=(demo,tab,extra={})=>projectView({mode:'customer',tab,project:project(demo),demo:true,demoPersistent:true,demoGuide:demo.guide(),...extra});
async function throughScenes(demo){
  await studio(demo,{action:'save_preferences',preferences:{...project(demo).studio.preferences,mood:'따뜻한'}});
  await studio(demo,{action:'confirm_strategy',strategyRevision:project(demo).studio.strategy.revision});
  const concept=project(demo).studio.concepts[0];await studio(demo,{action:'select_concept',conceptId:concept.id,conceptRevision:concept.revision,text:''});
  for(const scene of project(demo).studio.scenes)await studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:'confirmed',text:''});
}

// 11-04 소개글(유호님 「원고대로 올려」 · 원고 docs/마케팅/PULSE_소개글_20261103/README.md): 처음 들어온 사람의 첫 화면에 원고의 말을 해요체로 둔다. 작업 중인 손님의 현황판에는 넣지 않는다.
const words=html=>html.replace(/<[^>]+>/g,' ').replace(/[\s\u00A0]+/g,' ');
test('the entry page introduces PULSE in the approved words and keeps the invite door and the demo',()=>{
  const html=welcome({}),text=words(html);
  for(const line of [
    '모든 컷을 먼저 보여 드리는 AI 광고',
    '영상에 들어갈 모든 컷을 장면 이미지로 먼저 보여 드려요. AI 모델 21명 캐스팅, 제품·로고는 실제 파일로 합성해요.',
    // 장면 이미지 단서 — 장면 이미지를 말할 때는 함께 둔다.
    '장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.',
    '모델 고르기, 광고가 남길 한 문장과 글 콘티, 컷마다 장면 이미지.',
    '다음 편도 같은 모델과 같은 자막 규격으로 이어요.',
    '맡기신 뒤에는 초대 링크 하나로 시안을 보고 의견을 남기고, 최종 파일까지 한곳에서 받아요.',
    // 만드는 사람
    '카메라 앞에 서 본 사람이 AI 모델의 연기를 연출해요',
    'AI 광고가 어색해지는 곳은 대개 표정과 호흡, 말이 끝나는 타이밍이에요. SYNK PULSE는 배우로 활동한 대표 유호가 연출해요.',
    '넷플릭스 공개 「보라! 데보라」 1화 오프닝 시퀀스 출연','tvN 「코미디빅리그」 코너 출연','부활 「너의 모습」 뮤직비디오 주연',
    // 값은 정가의 「부터」만, 고지
    '15초 광고 39만원부터','30초 광고와 편집본 89만원부터','기업 캠페인 250만원부터','상담은 제품 사진 한 장과 올릴 곳만으로 시작해요.',
    '영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.',
    '가상 브랜드로 만든 자체 작품이에요.',
  ])assert.ok(text.includes(line),line);
  assert.equal(CASTING_MODELS.length,21,'모델 수가 바뀌면 소개글의 「21명」(첫 화면 · index.html · 원고)도 함께 고친다');
  // 쓰지 않기로 한 말(원고 1절): 도구 이름, 최상급, 납기 · 부가세 · 세금계산서 약속, 실제 촬영을 고른다는 말, 같은 얼굴 보증, 옛 머리말.
  assert.doesNotMatch(text,/실제 촬영|실사 촬영|납기|부가세|세금계산서|같은 얼굴|무제한|최고|최초|유일|1위|솔서리|Seedance|Sora|Veo|Omni|Gemini|GPT|Suno|Higgsfield|힉스필드|시댄스|CLIENT ROOM|함께 완성해요/i);
  // 초대 문과 체험은 그대로다.
  assert.match(html,/<form class="entry-invite" data-form="invite"[\s\S]*name="invite"[\s\S]*<\/form>/);
  assert.equal(html.split('href="?demo=film"').length,3,'머리의 예시 링크와 맡긴 뒤 줄');
  // 「이 기기에서 다시 확인」은 입장 칸 안에 둔다 — 첫 화면이 길어 맨 아래에 두면 누른 뒤 알림이 화면 밖에 난다.
  assert.match(html,/<form class="entry-invite"[^>]*>[\s\S]*?data-action="retry"[\s\S]*?<\/form>/);
  assert.equal(html.split('data-action="retry"').length,2);
  // 알림은 어느 길로 왔든(연결 다시 확인 · 초대 링크 실패 · 프로젝트 접근이 끊김) 다시 그리는 한 곳에서 보인다.
  const app=readFileSync(new URL('app.mjs',appDir),'utf8');
  assert.ok(app.includes("welcome(s);if(s.project||!s.entryError)shownEntryError=null;else if(s.entryError!==shownEntryError){shownEntryError=s.entryError;main.querySelector('.entry-alert')?.scrollIntoView?.({block:'nearest'});}restore(main);"));
  assert.equal(app.split('.entry-alert').length,2,'one place');
  assert.ok(html.includes('href="https://synk.im/pulse/casting/" target="_blank" rel="noopener noreferrer"'));
  const index=readFileSync(new URL('./public/pulse-app/index.html',import.meta.url),'utf8');
  assert.ok(index.includes('<title>SYNK PULSE — 모든 컷을 먼저 보여 드리는 AI 광고</title>'));
  assert.ok(index.includes('content="영상에 들어갈 모든 컷을 장면 이미지로 먼저 보여 드려요. AI 모델 21명 캐스팅, 제품·로고는 실제 파일로 합성해요."'));
  assert.ok(index.includes('<span class="header-caption">AI 광고 제작</span>'));
  assert.doesNotMatch(index,/CLIENT ROOM|함께 만드는 광고/);
});

test('a customer working in a project sees the board, not the introduction',async()=>{
  const demo=setup();
  for(const tab of ['overview','direction','films']){
    const html=view(demo,tab);
    assert.doesNotMatch(html,/entry-promise|entry-maker|entry-price|카메라 앞에 서 본|39만원부터/,tab);
  }
});

test('someone with no project yet can start a request right here, try the example, or open a link they already have',()=>{
  assert.equal(PULSE_INQUIRY_URL,'https://synk.im/pulse/#contact');
  const html=welcome({});
  assert.equal(html.split('data-entry="start"').length,3,'the request button is at the top and after the prices');
  assert.match(html,/광고 의뢰하기/);
  assert.match(html,/href="\?demo=film"/);
  assert.match(html,/<form class="entry-invite" data-form="invite"/);
  assert.equal(html.includes(PULSE_INQUIRY_URL),false,'the request starts in the app, not on another site');
  assert.match(welcome({requestResume:true}),/쓰던 의뢰서 이어 쓰기/);
});

test('the finished demo ends on the inquiry, keeps restart as the second choice, and only the demo inquiry box says where real questions go',async()=>{
  const demo=setup();
  const first=view(demo,'direction');
  assert.doesNotMatch(first.slice(first.indexOf('demo-guide-actions')),/button primary" href="https:\/\/synk\.im/,'steps before the end keep one compact action');
  await throughScenes(demo);demo.advance();
  const v1=project(demo).versions.at(-1);
  const reviewing=view(demo,'review',{versionId:v1.id});
  assert.ok(reviewing.includes(`체험 기록에만 남아요. 실제로 맡기거나 물어보려면 ${INQUIRY}`),'the demo inquiry box points to the real inquiry');
  const real=projectView({mode:'customer',tab:'review',project:project(demo),versionId:v1.id});
  assert.equal(real.includes(PULSE_INQUIRY_URL),false,'an invited customer is not sent to the public inquiry');
  await action(demo,{action:'feedback',versionId:v1.id,seconds:12.4,text:'마지막 문구를 더 크게 보여 주세요.'});
  demo.advance();
  const v2=project(demo).versions.at(-1);await action(demo,{action:'approve',versionId:v2.id});demo.advance();
  assert.equal(demo.guide().complete,true);
  const done=view(demo,'history'),actions=done.slice(done.indexOf('<div class="demo-guide-actions">'));
  assert.ok(actions.startsWith(`<div class="demo-guide-actions"><a class="button primary" href="${PULSE_INQUIRY_URL}" target="_blank" rel="noopener noreferrer">영상 제작 문의하기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a><button type="button" class="button " data-action="demo-reset" >처음부터 다시 체험</button><span class="small">체험한 방식 그대로 실제 광고를 함께 만들어요.</span></div>`),actions.slice(0,400));
});

test('a confirmed scene shows no second confirm button and a repeated demo confirmation records nothing, but a returned revision asks again',async()=>{
  const demo=setup();
  await studio(demo,{action:'save_preferences',preferences:{...project(demo).studio.preferences,mood:'따뜻한'}});
  const [scene,...rest]=project(demo).studio.scenes;
  await studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:'confirmed',text:''});
  const settled=project(demo).revision;
  await studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:'confirmed',text:''});
  assert.equal(project(demo).revision,settled,'no new demo revision');assert.equal(project(demo).studio.sceneReviews.length,1,'no second record');
  const card=(html,id)=>html.slice(html.indexOf(`id="scene-${id}"`),html.indexOf('</article>',html.indexOf(`id="scene-${id}"`)));
  let html=view(demo,'storyboard');
  assert.doesNotMatch(card(html,scene.id),/data-action="confirm-scene"/,'the confirmed scene keeps no confirm button');
  assert.match(card(html,scene.id),/data-action="review-scene"/,'comments stay possible');
  for(const other of rest)assert.match(card(html,other.id),/class="button primary" data-action="confirm-scene"[^>]*>장면 확인했어요</,other.id);
  await studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:'comment',text:'색이 조금 더 밝으면 좋겠어요.'});
  assert.match(card(view(demo,'storyboard'),scene.id),/data-action="confirm-scene"[^>]*>장면 확인했어요</,'after a comment the scene can be confirmed again');
  await studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:'confirmed',text:''});
  const waiting={...project(demo),sceneRequests:{items:[{id:'request-1',sceneId:scene.id,title:scene.title,status:'waiting_customer',requestedRevision:scene.revision,resultRevision:scene.revision,currentRevision:scene.revision,text:'문구를 크게 해 주세요.',createdAt:'2026-11-02T01:00:00.000Z'}]}};
  html=projectView({mode:'customer',tab:'storyboard',project:waiting});
  assert.match(card(html,scene.id),/class="button primary" data-action="confirm-scene"[^>]*>고친 장면 확인</,'a revision sent back for checking asks again even after an earlier confirmation');
});

test('storyboard, concept and reference images are contained rather than cropped, with a portrait box for vertical boards',()=>{
  const css=readFileSync(new URL('app.css',appDir),'utf8'),app=readFileSync(new URL('app.mjs',appDir),'utf8');
  for(const box of ['reference-media','concept-image','scene-image']){
    assert.match(css,new RegExp(`\\.${box} img\\{display:block;width:100%;aspect-ratio:16/9;object-fit:contain\\}`),box);
    assert.doesNotMatch(css,new RegExp(`\\.${box} img\\{[^}]*object-fit:cover`),box+' never crops');
  }
  assert.match(css,/\.scene-image\.is-portrait img,\.concept-image\.is-portrait img\{aspect-ratio:auto;height:min\(460px,70vh\)\}/);
  assert.match(css,/\.reference-media\.is-portrait img\{aspect-ratio:auto;height:min\(360px,60vh\)\}/);
  assert.match(css,/\.focus-media\.is-portrait>img,\.focus-media\.is-portrait>video\{object-fit:contain\}/,'the overview card does not crop a vertical board or draft either');
  assert.match(app,/const FIT_BOXES='\.scene-image,\.concept-image,\.reference-media,\.focus-media',measuring=new WeakSet\(\);/);
  assert.match(app,/fit=\(\)=>media\.closest\(FIT_BOXES\)\?\.classList\.toggle\('is-portrait',video\?media\.videoHeight>media\.videoWidth\*1\.05:media\.naturalHeight>media\.naturalWidth\*1\.05\)/,'the box is looked up when measured, so a moved element marks the box it is in now');
  assert.match(app,/if\(video\?media\.readyState>=1:media\.complete&&media\.naturalWidth\)fit\(\);else if\(!measuring\.has\(media\)\)\{measuring\.add\(media\);media\.addEventListener\(video\?'loadedmetadata':'load',\(\)=>\{measuring\.delete\(media\);fit\(\);\},\{once:true\}\);\}/,'cached and late media are both measured, with one pending listener');
  assert.match(app,/function wireMedia\(\)\{for\(const media of main\.querySelectorAll\('video,img'\)\)\{fitBox\(media\);if\(wiredMedia\.has\(media\)\)continue;/,'an already wired video that a live refresh moved into a new overview card is measured again');
});

test('the saved notice lets clicks through and sits under the header on wide screens, and confirming keeps keyboard focus on the scene',()=>{
  const css=readFileSync(new URL('app.css',appDir),'utf8'),app=readFileSync(new URL('app.mjs',appDir),'utf8');
  assert.match(css,/\n\.notice\{pointer-events:none\}/);
  const wide=css.slice(css.lastIndexOf('@media (min-width:861px){.notice'));
  assert.match(wide,/^@media \(min-width:861px\)\{\.notice,body:has\(\.approval-card\.is-floating\) \.notice\{top:72px;bottom:auto\}\}/);
  assert.ok(css.lastIndexOf('@media (min-width:861px){.notice')>css.lastIndexOf('body:has(.approval-card.is-floating) .notice{bottom:24px}'),'the wide-screen placement comes after the older bottom rules');
  assert.match(app,/if\(await mutate\(\(\)=>studioAction\('review_scene',sceneConfirmation\(s,button\.dataset\)\),\{message:'장면 확인을 남겼어요\.'\}\)\)Array\.from\(main\.querySelectorAll\('\.scene-card'\)\)\.find\(node=>node\.id==='scene-'\+id\)\?\.querySelector\('\[data-action=review-scene\]'\)\?\.focus\(\{preventScroll:true\}\);/);
});

test('clothing choices follow each model gender from the catalog, so the six later models get the same rule as the first seven',()=>{
  assert.deepEqual(CASTING_MODELS.filter(model=>model.gender==='남').map(model=>model.id),['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10']);
  assert.deepEqual(CASTING_MODELS.filter(model=>model.gender==='여').map(model=>model.id),['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11']);
  for(const model of CASTING_MODELS){
    const html=castingView({modelId:model.id}),male=model.gender==='남';
    assert.equal(html.includes('name="cast_top" value="blouse"'),!male,model.id+' blouse');
    assert.equal(html.includes('name="cast_bottom" value="skirt"'),!male,model.id+' skirt');
  }
});
