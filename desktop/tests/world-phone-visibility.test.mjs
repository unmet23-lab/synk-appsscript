// WORLD는 휴대폰에서 쓰는 앱이라 플랫폼(PC · 웹)이 앱 목록에 넣지 않고 내 홈의 휴대폰 칸 하나로 안내한다(2026-11-11).
// 계정 권한 · 이 기기와 계정에 저장한 기록은 바꾸지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLibrary,visibleLibraryAppIds,displayLibraryAppIds,UNLISTED_APP_IDS,libraryCopy} from '../renderer/library.mjs';
import {previewPurpose} from '../renderer/personalization.mjs';
import {APP_IDS} from '../renderer/state.mjs';
import {worldPhoneSection,WORLD_PHONE_URL} from '../renderer/world-phone.mjs';
import {filterApplications,normalizeLibrary,listedItem,unlistedSearchHit} from '../../experiences/synk-account/src/library.mjs';

const signed=(owner,appIds)=>({status:'signed-in',signedIn:true,account:{synk_user_id:owner},library:{status:'ready',appIds}});
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};

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
