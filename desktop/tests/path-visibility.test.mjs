import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLibrary,visibleSelection,displayLibraryAppIds,visibleLibraryAppIds,moveLibraryFavorite,projectLibraryPreferences,accountStorageKey} from '../renderer/library.mjs';
import {APP_IDS,APPS,parsePreferences} from '../renderer/state.mjs';
import {trayShortcuts,normalizeRoute} from '../renderer/convenience-state.mjs';
import {previewPurpose} from '../renderer/personalization.mjs';
import {emptyPlatformLibrary,updatePlatformLibrary,projectPlatformLibrary} from '../../experiences/synk-account/src/platform-library-data.mjs';
const preview={clientId:'platform',mode:'development',nativeShell:true};
const signed=(owner='synthetic-owner',appIds=[...APP_IDS])=>({status:'signed-in',signedIn:true,account:{synk_user_id:owner},library:{status:'ready',appIds}});

test('PATH discovery is hidden for every authentication phase without changing granted IDs',()=>{
  for(const auth of [signed(),...['signed-out','unconfigured','restoring','signing-in','signing-out','error'].map(status=>({status,signedIn:false}))]){
    const original=structuredClone(auth),library=resolveLibrary(auth,preview);
    assert.deepEqual(library.appIds,APP_IDS);assert.ok(!visibleLibraryAppIds(library).includes('path'));
    assert.deepEqual(displayLibraryAppIds(library),['messenger','pulse','care']);assert.deepEqual(auth,original);
  }
  assert.ok(APP_IDS.includes('path'));assert.equal(APPS.path.name,'SYNK PATH');
});

test('release projection retains PATH grants for existing records while discovery omits it',()=>{
  const auth=signed('member-a',['path','world','teacher','pulse']);
  for(const environment of [undefined,{...preview,mode:'release'},{...preview,nativeShell:false}]){
    const library=resolveLibrary(auth,environment);assert.deepEqual(library,{status:'ready',owner:'member-a',appIds:['world','teacher','path','pulse']});assert.deepEqual(visibleLibraryAppIds(library),['teacher','pulse']);
  }
  assert.deepEqual(visibleLibraryAppIds(resolveLibrary(signed('path-only',['path']))),[]);
});

test('saved PATH favorites and recents do not become shortcuts or restored routes',()=>{
  const raw=JSON.stringify({selected:'path',favorites:['path','world'],lastLaunch:{path:100,messenger:200},density:'compact'}),prefs=parsePreferences(raw),library=resolveLibrary(signed(),preview),visible=visibleLibraryAppIds(library);
  const before=structuredClone(prefs),projected=projectLibraryPreferences(prefs,library);
  assert.deepEqual(trayShortcuts(projected,visible).map(row=>row.id),['messenger']);
  assert.equal(normalizeRoute({view:'library',appId:'path'},visible).appId,null);assert.equal(visibleSelection('path',displayLibraryAppIds(library)),'messenger');assert.deepEqual(prefs,before);
});

test('career and student recommendations exclude PATH while existing note contents remain visible',()=>{
  const library=resolveLibrary(signed(),preview),state={order:[...APP_IDS],values:{}};
  for(const purpose of ['career','student']){const projection=previewPurpose(state,purpose,displayLibraryAppIds(library));assert.ok(!['path','world'].includes(projection.selected));assert.ok(!projection.order.includes('path'));}
});

test('reordering visible local favorites preserves hidden IDs and their slots',()=>{
  const favorites=['path','world','messenger'],visible=['world','messenger'];
  assert.deepEqual(moveLibraryFavorite(favorites,visible,'world',1),['path','messenger','world']);assert.deepEqual(favorites,['path','world','messenger']);
  assert.deepEqual(moveLibraryFavorite(['world','path','messenger'],visible,'messenger',-1),['messenger','path','world']);
  assert.equal(moveLibraryFavorite(favorites,visible,'path',1),null);assert.equal(moveLibraryFavorite(favorites,visible,'world',-1),null);
});

test('existing account library operations preserve PATH favorites, recents and note bodies',()=>{
  const doc={...emptyPlatformLibrary(),consent:true,favorites:['world','path','messenger'],recent:[{id:'path',at:100,mode:'web'}],notes:[{id:'old-path',appId:'path',title:'Keep existing account note',done:false,createdAt:100}]};
  const appIds=['world','messenger'];const before=structuredClone(doc),next=updatePlatformLibrary(doc,{type:'move-favorite',id:'world',direction:1},200,appIds);
  assert.deepEqual(next.favorites,['messenger','path','world']);assert.deepEqual(next.notes,doc.notes);assert.deepEqual(next.recent,doc.recent);assert.deepEqual(doc,before);
  assert.deepEqual(projectPlatformLibrary(next,{appIds}).notes,doc.notes);
  const edited=updatePlatformLibrary(next,{type:'edit-note',noteId:'old-path',id:'path',title:'Explicitly edited existing note'},201,appIds);assert.equal(edited.notes[0].appId,'path');
});
