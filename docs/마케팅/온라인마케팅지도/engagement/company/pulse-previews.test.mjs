import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPreviewAction,previewActions,previewsView,visiblePreviewAssetIds} from './pulse-previews.mjs';
import {animaticTimeline,sceneAtTime} from './public/pulse-app/animatic-player.mjs';
import {samplesPanel,animaticPanel} from './public/pulse-app/preview-view.mjs';

const row={id:'fixture-project'},staff={author:'staff',authorId:'staff-private-id',authorName:'담당자',at:'2026-10-12T10:00:00Z'},customer={author:'customer',authorId:'customer',authorName:'합성 고객',at:'2026-10-12T10:01:00Z'};
const fixture=()=>({assets:[{id:'image-private',fileName:'내부-사진.png',mimeType:'image/png',byteSize:80,storedName:'never-expose-image.png'},{id:'audio-private',fileName:'임시-설명.mp3',mimeType:'audio/mpeg',byteSize:120},{id:'clip-private',fileName:'시험-영상.mp4',mimeType:'video/mp4',byteSize:160},{id:'secret-unused',fileName:'미공개.mp4',mimeType:'video/mp4',byteSize:160}],references:[{id:'reference-one',label:'기존 공개 참고',url:'https://example.test/original',assetId:null}],scenes:[{id:'scene-a',revision:1,title:'시작',description:'제품을 들어 보인다',narration:'좋은 아침',screenText:'핵심 메시지',duration:2.5,visibility:'customer'},{id:'scene-secret',revision:1,title:'아직 공개 안 함',narration:'비밀 대사',screenText:'비밀 화면',duration:8,visibility:'internal',assetId:'secret-unused'},{id:'scene-b',revision:1,title:'마지막',narration:'만나 보세요',screenText:'제품 보기',duration:3,visibility:'customer'}]});
const saveSample=(studio,extra={})=>applyPreviewAction({studio,row,staff:true,stamp:staff,input:{action:'preview_save_sample',title:'차분한 예시',assetId:'image-private',referenceId:null,aspects:{mood:'차분한',pace:'느린',subtitle:'큰 자막'},description:'분위기와 속도를 비교해 주세요.',visibility:'customer',...extra}});
const saveAnimatic=(studio,extra={})=>applyPreviewAction({studio,row,staff:true,stamp:staff,input:{action:'preview_save_animatic',audioAssetId:'audio-private',testClipAssetId:'clip-private',testClipStart:1,testClipDuration:7,note:'흐름 확인',testNote:'얼굴 유지 확인',visibility:'customer',...extra}});
const choose=(studio,extra={})=>applyPreviewAction({studio,row,staff:false,stamp:customer,input:{action:'preview_choose_sample',sampleId:studio.previews.samples[0].id,sampleRevision:studio.previews.samples[0].revision,liked:['mood'],avoided:['pace'],reason:'자막은 더 크게',...extra}});
const confirm=(studio,extra={})=>applyPreviewAction({studio,row,staff:false,stamp:customer,input:{action:'preview_confirm_animatic',signature:previewsView(studio,row).animatic.signature,scope:'flow',note:'확인했습니다.',...extra}});
const rejects=(fn,status)=>assert.throws(fn,error=>error.status===status);

test('empty projects remain compatible and inherited actions cannot enter dispatch',()=>{
  const studio=fixture();assert.deepEqual(previewsView(studio,row),{samples:[],sampleChoices:[],sampleHistory:[],animatic:null,confirmations:[]});
  for(const action of ['toString','constructor','__proto__','unknown'])assert.equal(previewActions(action),null);
  assert.equal(applyPreviewAction({studio,row,input:{action:'unknown'}}),false);assert.equal(studio.previews,undefined);
});

test('only staff can prepare explicit public samples and only customers record choices',()=>{
  const studio=fixture();rejects(()=>applyPreviewAction({studio,row,staff:false,stamp:customer,input:{action:'preview_save_sample'}}),403);
  saveSample(studio,{visibility:'internal'});assert.deepEqual(previewsView(studio,row).samples,[]);assert.equal(visiblePreviewAssetIds(studio).size,0);rejects(()=>choose(studio),404);
  saveSample(studio,{id:studio.previews.samples[0].id});assert.equal(visiblePreviewAssetIds(studio).has('image-private'),true);choose(studio);
  rejects(()=>applyPreviewAction({studio,row,staff:true,stamp:staff,input:{action:'preview_choose_sample'}}),403);
  const safe=previewsView(studio,row);assert.equal(safe.samples[0].media.url,'/pulse/api/studio/media/image-private');assert.doesNotMatch(JSON.stringify(safe),/storedName|never-expose|staff-private-id|authorId|secret-unused/);
  assert.equal(previewsView(studio,row,true).samples[0].media.url,'/api/client-projects/fixture-project/studio/media/image-private');
});

test('reference-based samples snapshot the source and revision-specific customer preferences',()=>{
  const studio=fixture();saveSample(studio,{assetId:null,referenceId:'reference-one'});choose(studio);
  studio.references[0].url='https://example.test/replaced';assert.equal(previewsView(studio,row).samples[0].url,'https://example.test/original');
  const prior=studio.previews.samples[0];saveSample(studio,{id:prior.id,title:'빠른 예시',aspects:{pace:'빠른'}});
  const view=previewsView(studio,row);assert.equal(view.samples[0].revision,2);assert.equal(view.sampleChoices[0].current,false);assert.equal(view.sampleChoices[0].aspects.pace,'느린');assert.equal(view.sampleHistory[0].title,'차분한 예시');
  rejects(()=>choose(studio,{sampleRevision:1}),409);
});

test('unpublishing samples revokes sample-only asset access while preserving server history',()=>{
  const studio=fixture();saveSample(studio);choose(studio);const id=studio.previews.samples[0].id;saveSample(studio,{id,visibility:'internal'});
  assert.equal(visiblePreviewAssetIds(studio).has('image-private'),false);assert.equal(studio.previews.sampleHistory[0].assetId,'image-private');
  const safe=previewsView(studio,row);assert.equal(safe.samples.length,0);assert.equal(safe.sampleHistory.length,0);assert.equal(safe.sampleChoices.length,0);
});

test('samples reject unrelated assets, invalid elements, conflicting preferences and unknown fields atomically',()=>{
  const studio=fixture();for(const extra of [{assetId:'other-project'},{referenceId:'reference-one'},{aspects:{}},{aspects:{unknown:'x'}},{visibility:'public'},{description:'\u0000'},{secret:'not accepted'}])rejects(()=>saveSample(studio,extra),extra.assetId==='other-project'?404:400);
  assert.equal(studio.previews,undefined);saveSample(studio);for(const extra of [{liked:['voice']},{liked:['mood','mood']},{avoided:['mood']},{liked:[],avoided:[],reason:''},{liked:'mood'}])rejects(()=>choose(studio,extra),400);
  assert.equal(studio.previews.sampleChoices.length,0);
});

test('animatic uses only public scenes in order and publishes only explicitly selected media',()=>{
  const studio=fixture();saveAnimatic(studio,{visibility:'internal'});assert.equal(previewsView(studio,row).animatic,null);assert.equal(visiblePreviewAssetIds(studio).size,0);
  saveAnimatic(studio);const view=previewsView(studio,row);assert.deepEqual(view.animatic.scenes.map(scene=>scene.id),['scene-a','scene-b']);assert.equal(view.animatic.audio.mimeType,'audio/mpeg');assert.equal(view.animatic.testClip.mimeType,'video/mp4');assert.doesNotMatch(JSON.stringify(view),/비밀|secret-unused|scene-secret/);
  assert.deepEqual([...visiblePreviewAssetIds(studio)].sort(),['audio-private','clip-private']);
  saveAnimatic(studio,{visibility:'internal'});assert.equal(visiblePreviewAssetIds(studio).size,0);
});

test('animatic and clip confirmations are separate and exact snapshots survive scene changes',()=>{
  const studio=fixture();saveAnimatic(studio);confirm(studio);assert.equal(previewsView(studio,row).confirmations.length,1);assert.equal(previewsView(studio,row).confirmations[0].scope,'flow');
  confirm(studio,{scope:'test'});rejects(()=>confirm(studio),409);
  const snapshot=studio.previews.confirmations[0].snapshot;assert.deepEqual(snapshot.scenes.map(scene=>scene.id),['scene-a','scene-b']);assert.equal(snapshot.scenes[0].screenText,'핵심 메시지');assert.equal(snapshot.audioName,'임시-설명.mp3');assert.equal(snapshot.testClipStart,1);assert.equal(snapshot.testClipDuration,7);
  const oldSignature=previewsView(studio,row).animatic.signature;studio.scenes[0].revision++;studio.scenes[0].screenText='수정한 메시지';
  assert.equal(previewsView(studio,row).confirmations.every(item=>!item.current),true);assert.equal(previewsView(studio,row).confirmations[0].snapshot.scenes[0].screenText,'핵심 메시지');rejects(()=>confirm(studio,{signature:oldSignature}),409);
});

test('reordering, removing public scenes and changing preview media invalidate confirmation, private edits do not',()=>{
  const studio=fixture();saveAnimatic(studio);confirm(studio);let before=previewsView(studio,row).animatic.signature;
  studio.scenes[1].revision++;assert.equal(previewsView(studio,row).animatic.signature,before);
  [studio.scenes[0],studio.scenes[2]]=[studio.scenes[2],studio.scenes[0]];assert.notEqual(previewsView(studio,row).animatic.signature,before);before=previewsView(studio,row).animatic.signature;
  studio.scenes[0].visibility='internal';assert.notEqual(previewsView(studio,row).animatic.signature,before);before=previewsView(studio,row).animatic.signature;
  saveAnimatic(studio,{audioAssetId:null});assert.notEqual(previewsView(studio,row).animatic.signature,before);
});

test('animatic validates media types, publication prerequisites and the actual 5-10 second test interval',()=>{
  const studio=fixture();for(const extra of [{audioAssetId:'image-private'},{testClipAssetId:'audio-private'}])rejects(()=>saveAnimatic(studio,extra),404);
  for(const extra of [{testClipStart:-1},{testClipStart:Infinity},{testClipDuration:4.9},{testClipDuration:10.1},{testClipDuration:'7'}])rejects(()=>saveAnimatic(studio,extra),400);
  studio.scenes.forEach(scene=>scene.visibility='internal');rejects(()=>saveAnimatic(studio),409);assert.equal(studio.previews,undefined);
  studio.scenes[0].visibility='customer';saveAnimatic(studio,{testClipAssetId:null});rejects(()=>confirm(studio,{scope:'test'}),400);confirm(studio);
});

test('playback timeline respects fractional duration and moves to the next frame on exact boundaries',()=>{
  const timeline=animaticTimeline(fixture().scenes.filter(scene=>scene.visibility==='customer'));assert.equal(timeline.at(-1).end,5.5);assert.equal(sceneAtTime(timeline,0).id,'scene-a');assert.equal(sceneAtTime(timeline,2.49).id,'scene-a');assert.equal(sceneAtTime(timeline,2.5).id,'scene-b');assert.equal(sceneAtTime(timeline,5.5).id,'scene-b');assert.equal(sceneAtTime([],0),null);
});

test('customer UI presents separate flow/test confirmations, recorded snapshots and escaped choices',()=>{
  const previous=globalThis.location;globalThis.location={origin:'https://pulse.example.test'};
  try{const studio=fixture();saveSample(studio,{title:'<script>alert(1)</script>'});saveAnimatic(studio);confirm(studio);studio.scenes[0].revision++;
    const s={mode:'customer',project:{studio:{...studio,previews:previewsView(studio,row)}}};const samples=samplesPanel(s),animatic=animaticPanel(s);
    assert.match(samples,/&lt;script&gt;/);assert.doesNotMatch(samples,/<script>/);assert.match(samples,/원해요/);assert.match(samples,/피할래요/);assert.doesNotMatch(samples,/data-form="preview-sample"/);
    assert.match(animatic,/data-id="flow"/);assert.match(animatic,/data-id="test"/);assert.match(animatic,/임시 음성·음악은 길이와 흐름/);assert.match(animatic,/당시 확인한 장면·파일·구간/);assert.match(animatic,/시안이 바뀌어 다시 확인/);assert.doesNotMatch(animatic,/비밀 대사|비밀 화면/);
  }finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
});
