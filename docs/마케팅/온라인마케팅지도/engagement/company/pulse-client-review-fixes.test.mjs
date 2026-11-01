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

test('someone with no project yet is offered a real inquiry next to the demo, opening synk.im in a new tab',()=>{
  assert.equal(PULSE_INQUIRY_URL,'https://synk.im/pulse/#contact');
  const html=welcome({});
  assert.ok(html.includes(`<div class="demo-entry-actions"><a class="button soft" href="?demo=coffee">예시 프로젝트 체험하기 →</a><p class="demo-entry-inquiry">아직 맡긴 프로젝트가 없다면 ${INQUIRY}</p></div>`));
  assert.equal(html.split(PULSE_INQUIRY_URL).length,2,'one inquiry link on the entry page');
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
  assert.deepEqual(CASTING_MODELS.filter(model=>model.gender==='남').map(model=>model.id),['M01','M02','M03','M04','M05','M06']);
  assert.deepEqual(CASTING_MODELS.filter(model=>model.gender==='여').map(model=>model.id),['F01','F02','F03','F04','F05','F06','F07']);
  for(const model of CASTING_MODELS){
    const html=castingView({modelId:model.id}),male=model.gender==='남';
    assert.equal(html.includes('name="cast_top" value="blouse"'),!male,model.id+' blouse');
    assert.equal(html.includes('name="cast_bottom" value="skirt"'),!male,model.id+' skirt');
  }
});
