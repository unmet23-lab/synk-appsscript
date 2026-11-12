// WORLD는 휴대폰에서 쓰는 앱이라 플랫폼(PC · 웹)이 앱 목록에 넣지 않고 내 홈의 휴대폰 칸 하나로 안내한다(2026-11-11).
// 계정 권한 · 이 기기와 계정에 저장한 기록은 바꾸지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveLibrary,visibleLibraryAppIds,displayLibraryAppIds,UNLISTED_APP_IDS,libraryCopy} from '../renderer/library.mjs';
import {previewPurpose} from '../renderer/personalization.mjs';
import {APP_IDS} from '../renderer/state.mjs';
import {mountMemberHome,buildHomeModel} from '../renderer/member-home.mjs';
import {worldPhoneSection,WORLD_PHONE_URL} from '../renderer/world-phone.mjs';
import {filterApplications,normalizeLibrary,listedItem,unlistedSearchHit} from '../../experiences/synk-account/src/library.mjs';

const signed=(owner,appIds)=>({status:'signed-in',signedIn:true,account:{synk_user_id:owner},library:{status:'ready',appIds}});
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
const render=(library,personal={})=>{const root={innerHTML:'',addEventListener(){}};mountMemberHome(root,{storage:memory(),getSnapshot:()=>({library,personal,prefs:{}})}).render();return root.innerHTML;};

test('WORLD is unlisted for every account and phase while the account grant stays as it was',()=>{
  assert.ok(UNLISTED_APP_IDS.includes('world'));assert.ok(APP_IDS.includes('world'));
  for(const appIds of [['world'],['world','messenger','pulse'],['teacher','world']]){
    const auth=signed('member-a',appIds),before=structuredClone(auth),library=resolveLibrary(auth);
    assert.ok(library.appIds.includes('world'),'the grant is kept');assert.ok(!visibleLibraryAppIds(library).includes('world'));assert.ok(!displayLibraryAppIds(library).includes('world'));assert.deepEqual(auth,before);
  }
});

test('a signed-out guest sees PULSE, not WORLD and never the full catalogue',()=>{
  for(const status of ['signed-out','unconfigured'])assert.deepEqual(resolveLibrary({status,signedIn:false}),{status:'guest',owner:'anonymous-local',appIds:['pulse']});
});

test('the phone panel carries one QR for synk.im/world and a browser link only where one is given',()=>{
  assert.equal(WORLD_PHONE_URL,'https://synk.im/world/');
  const pc=worldPhoneSection({qrSrc:'/assets/launcher/world-qr.svg'});
  assert.match(pc,/id="world-phone"/);assert.match(pc,/src="\/assets\/launcher\/world-qr\.svg"/);assert.match(pc,/alt="synk\.im\/world로 가는 QR 코드"/);assert.doesNotMatch(pc,/<a /);
  const web=worldPhoneSection({qrSrc:'./assets/world-qr.svg',openHref:'https://synk.im/world/?a="b"'});
  assert.match(web,/<a class="world-phone-open" href="https:\/\/synk\.im\/world\/\?a=&quot;b&quot;" target="_blank" rel="noopener noreferrer" data-web="world">/);
  // 두 QR 원본은 같은 그림이어야 한다(PC 앱 · 웹 플랫폼).
  assert.equal(readFileSync(new URL('../assets/launcher/world-qr.svg',import.meta.url),'utf8'),readFileSync(new URL('../../experiences/synk-account/assets/world-qr.svg',import.meta.url),'utf8'));
});

test('the home shows the phone panel for guests and members, never while loading or after a failed load',()=>{
  assert.match(render({status:'guest',owner:'anonymous-local',appIds:['pulse']}),/id="world-phone"/);
  assert.match(render({status:'ready',owner:'member-a',appIds:['messenger']}),/id="world-phone"/);
  assert.doesNotMatch(render({status:'loading',owner:null,appIds:[]}),/id="world-phone"/);
  assert.doesNotMatch(render({status:'unavailable',owner:'member-a',appIds:[]}),/id="world-phone"/);
  const learner=render({status:'ready',owner:'learner',appIds:['world']});
  assert.match(learner,/한국어 공부는<br><span>휴대폰의 WORLD에서 해요/);assert.doesNotMatch(learner,/아직 쓸 수 있는 앱이 없어요/);assert.doesNotMatch(learner,/data-member-add/);assert.match(learner,/이 PC에서 여는 앱이 생기면/);assert.doesNotMatch(learner,/data-member-app="world"/);
  assert.match(render({status:'ready',owner:'nobody',appIds:[]}),/학교나 회사에서 이 계정에 앱을 열어 주면/);
});

test('saved WORLD notes stay readable on the home while WORLD leaves the shelf',()=>{
  const note={id:'world-note',kind:'note',appId:'world',title:'Kept learning note',createdAt:1793174400000};
  const model=buildHomeModel({library:{status:'ready',owner:'member-a',appIds:['world','messenger']},personal:{},prefs:{favorites:['world'],lastLaunch:{world:200}},records:[note]});
  assert.deepEqual(model.notes,[note]);assert.ok(!model.order.includes('world'));assert.notEqual(model.first,'world');assert.deepEqual(model.favorites,[]);
});

test('the web platform lists no WORLD card in discover, search or the device library, and keeps what the device saved',()=>{
  const library=normalizeLibrary({saved:['world','messenger'],favorites:['world'],collections:{learn:['world']}});
  assert.equal(listedItem('world'),false);assert.equal(listedItem('path'),true);
  for(const options of [{library},{library,query:'토픽'},{library,query:'TOPIK'},{library,category:'learn'},{library,onlySaved:true},{library,onlySaved:true,collection:'favorites'}])assert.ok(!filterApplications(options).some(app=>app.id==='world'),JSON.stringify(options));
  assert.deepEqual(library.saved,['world','messenger']);assert.deepEqual(library.favorites,['world']);
});

test('「배우기」 with no listed learning app never claims a matching app and points to the phone panel',()=>{
  const ids=['world','messenger','pulse'],shown=displayLibraryAppIds({appIds:ids});
  const student=previewPurpose({order:[],values:{}},'student',shown);
  assert.equal(student.matched,false);assert.match(student.reason,/WORLD는 휴대폰에서/);
  const work=previewPurpose({order:[],values:{}},'work',shown);assert.equal(work.matched,true);assert.equal(work.selected,'messenger');
  const home=render({status:'ready',owner:'member-a',appIds:ids},student);
  assert.doesNotMatch(home,/고른 일에 맞는/);assert.match(home,/한국어 공부는<br><span>휴대폰의 WORLD에서 해요/);assert.match(home,/id="world-phone"/);
  assert.match(render({status:'ready',owner:'member-a',appIds:ids},work),/고른 일에 맞는 워크스페이스/);
});

test('library copy follows the listed apps: guest PULSE, a WORLD-only learner is sent to the phone panel',()=>{
  const guest=libraryCopy({status:'guest',appIds:['pulse']});assert.equal(guest.caption,'PULSE 둘러보기');assert.doesNotMatch(guest.description,/WORLD/);
  const learner=libraryCopy({status:'ready',owner:'a',appIds:['world']});assert.equal(learner.worldOnPhone,true);assert.match(learner.title,/휴대폰의 WORLD/);
  // 런처는 목록용으로 걸러 낸 appIds와 계정 권한(granted)을 따로 넘긴다(launcher.mjs renderLibrary).
  const launcherShape=libraryCopy({status:'ready',owner:'a',appIds:[]},{granted:['world']});assert.equal(launcherShape.worldOnPhone,true);
  assert.equal(libraryCopy({status:'ready',owner:'a',appIds:[]},{granted:['messenger']}).worldOnPhone,false);
  const none=libraryCopy({status:'ready',owner:'a',appIds:[]});assert.equal(none.worldOnPhone,false);assert.match(none.title,/아직 쓸 수 있는 앱이 없어요/);
});

test('searching the web platform for WORLD finds the phone panel instead of nothing',()=>{
  for(const q of ['WORLD','world','한국어','TOPIK','바람길'])assert.equal(unlistedSearchHit(q),true,q);
  for(const q of ['','   ','면접','Workspace'])assert.equal(unlistedSearchHit(q),false,q);
});

test('a WORLD and member-benefit account lists the benefit only and its empty shelf still points to the phone panel',()=>{
  // 런처는 혜택 앱(플레저)을 선반 격자에서 빼고 넘긴다(launcher.mjs renderLibrary의 sidebarIds). 빈 화면 안내와 앱 소개가 겹치지 않는 것은 renderer-auth 시험이 본다.
  const library={status:'ready',owner:'learner-care',appIds:['world','care']};
  assert.deepEqual(displayLibraryAppIds(library),['care']);
  const copy=libraryCopy({...library,appIds:[]},{granted:library.appIds});
  assert.equal(copy.worldOnPhone,true);assert.match(copy.title,/휴대폰의 WORLD/);assert.doesNotMatch(copy.title,/아직 쓸 수 있는 앱이 없어요/);
});

test('the account dialog says the same sentence before and after the launcher fills it, without WORLD',()=>{
  const html=readFileSync(new URL('../renderer/index.html',import.meta.url),'utf8'),launcher=readFileSync(new URL('../renderer/launcher.mjs',import.meta.url),'utf8');
  const sentence='SYNK ID 하나로 Workspace·PULSE·회원 혜택을 써요.';
  assert.ok(html.includes(`<p id="account-description">${sentence}</p>`));assert.ok(launcher.includes(`'${sentence}'`));
  assert.doesNotMatch(html.match(/<dialog id="account-dialog"[\s\S]*?<\/dialog>/)[0],/WORLD/);
});
