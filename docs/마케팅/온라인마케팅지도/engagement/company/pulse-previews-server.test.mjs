import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve,sep} from 'node:path';
import {createProductionFixture,fixtureWav} from './pulse-production-fixture.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {acceptWorkspaceRestore} from './workspace-restore-acceptance.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function fixture(t,seed=false){const f=await createProductionFixture({seed});t.after(async()=>{await f.stop();const dir=resolve(f.directory);assert.equal(dirname(dir),resolve(tmpdir()));assert.ok(basename(dir).startsWith('synk-pulse-production-'));await rm(dir,{recursive:true,force:true});});return f;}

test('HTTP preview publication exposes only selected media and withdrawal closes that media route',async t=>{
  const f=await fixture(t),media=await f.upload('내부-샘플.png','image/png',png),draft={action:'preview_save_sample',title:'제작자용 비교',assetId:media.id,aspects:{color:'따뜻한',pace:'느린'},description:'색감과 속도 비교',visibility:'internal'};
  f.ok(await f.studio(draft));const sample=f.row.studio.previews.samples[0];
  await f.refresh();assert.equal(f.row.studio.previews.samples.length,0);assert.equal(f.row.studio.assets.length,0);assert.equal((await f.request('/pulse/api/studio/media/'+media.id,{customer:f.customer})).status,404);
  assert.equal((await f.studio(draft,f.customer)).status,403);
  f.ok(await f.studio({...draft,id:sample.id,visibility:'customer'}));await f.refresh();assert.equal(f.row.studio.previews.samples.length,1);assert.equal(f.row.studio.assets.some(asset=>asset.id===media.id),true);
  const body={action:'preview_choose_sample',sampleId:sample.id,sampleRevision:2,liked:['color'],avoided:['pace'],reason:'편집은 조금 빠르게'};f.ok(await f.studio(body,f.customer));
  const streamed=await f.request('/pulse/api/studio/media/'+media.id,{customer:f.customer});assert.equal(streamed.status,200);assert.deepEqual(streamed.bytes,png);
  assert.equal((await f.studio(body)).status,403);
  f.ok(await f.studio({...draft,id:sample.id,visibility:'internal'}));await f.refresh();assert.equal(f.row.studio.previews.sampleChoices.length,0);assert.equal(f.row.studio.assets.some(asset=>asset.id===media.id),false);assert.equal((await f.request('/pulse/api/studio/media/'+media.id,{customer:f.customer})).status,404);
  assert.equal(f.app.store.get('clientProjects',f.row.id).studio.previews.sampleChoices.length,1,'withdrawal preserves server records');
  for(const action of ['toString','constructor','__proto__'])assert.equal((await f.studio({action})).status,400);
});

test('HTTP WAV range playback, snapshot confirmations, stale ordering and restart preserve the real project contract',async t=>{
  const f=await fixture(t,true),animatic=f.row.studio.previews.animatic,wav=fixtureWav(),stored=f.app.store.get('clientProjects',f.row.id).studio.assets.find(asset=>asset.id===animatic.audioAssetId);
  assert.equal(stored.mimeType,'audio/wav');
  const range=await f.request('/pulse/api/studio/media/'+stored.id,{customer:f.customer,headers:{Range:'bytes=0-43'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-type'),'audio/wav');assert.equal(range.headers.get('content-range'),`bytes 0-43/${wav.length}`);assert.deepEqual(range.bytes,wav.subarray(0,44));
  const rawDelivery=await f.request(`/api/client-projects/${f.row.id}/media`,{body:wav,raw:true,headers:{'Content-Type':'audio/wav','X-File-Name':'audio.wav','X-Version-Label':'audio','X-Version-Kind':'preview','X-Project-Revision':String(f.row.revision)}});assert.equal(rawDelivery.status,415,'temporary audio cannot enter the final-video upload route');
  const confirmation={action:'preview_confirm_animatic',signature:animatic.signature,scope:'flow',note:'길이와 순서를 확인했습니다.'};f.ok(await f.studio(confirmation,f.customer));
  const choice=f.row.studio.previews.confirmations[0];assert.equal(choice.current,true);assert.equal(choice.snapshot.scenes.length,4);assert.equal(choice.snapshot.scenes[0].screenText,'아침에 15초의 여유');assert.equal(choice.snapshot.audioName,'검증용_타이밍_음.wav');assert.equal(choice.snapshot.testClipDuration,7);
  f.ok(await f.studio({action:'reorder_scenes',ids:f.row.studio.scenes.map(scene=>scene.id).reverse()}));assert.equal((await f.studio(confirmation,f.customer)).status,409);await f.restart();await f.refresh();
  assert.equal(f.row.studio.previews.confirmations[0].current,false);assert.equal(f.row.studio.previews.confirmations[0].snapshot.scenes[0].screenText,'아침에 15초의 여유');assert.equal(f.row.studio.previews.animatic.scenes[0].screenText,'제품 소개 확인');
  assert.doesNotMatch(JSON.stringify(f.row.studio.previews),/diskName|authorId|inviteHash/);
  assert.deepEqual((await f.request('/pulse/api/studio/media/'+stored.id,{customer:f.customer,headers:{Range:'bytes=44-63'}})).bytes,wav.subarray(44,64));
});

test('temporary WAV originals survive backup and acceptance refuses a missing referenced sound',async t=>{
  const f=await fixture(t),wav=fixtureWav(1),media=await f.upload('임시-소리.wav','audio/wav',wav),stored=f.app.store.get('clientProjects',f.row.id).studio.assets.find(asset=>asset.id===media.id);
  await f.stop();const baseline=await backupWorkspace({destination:join(f.directory,'backups'),companyDataDir:join(f.directory,'data'),messengerDataDir:join(f.directory,'data','messenger')});
  assert.deepEqual(await readFile(join(baseline,'company','studio-media',stored.diskName)),wav);
  const manifest=JSON.parse(await readFile(join(baseline,'integration-manifest.json'),'utf8'));assert.equal(manifest.mediaCount,1);
  const candidate=join(f.directory,'candidate');await cp(baseline,candidate,{recursive:true});
  const params={candidateDirectory:candidate,baselineDirectory:baseline,freshnessEvidence:{kind:'synthetic-rehearsal',declaredLatest:true,writersStopped:true,writersStoppedAt:manifest.createdAt,baselineCreatedAt:manifest.createdAt,recordedAt:new Date().toISOString()}};
  const accepted=await acceptWorkspaceRestore(params);assert.equal(accepted.status,'candidate-matches-declared-baseline',JSON.stringify(accepted.issues));assert.equal(accepted.sourceFilesUnchanged,true);
  const soundPath=resolve(candidate,'company','studio-media',stored.diskName);assert.ok(soundPath.startsWith(resolve(candidate)+sep));await rm(soundPath);
  const missing=await acceptWorkspaceRestore(params);assert.equal(missing.status,'rejected');assert.ok(missing.issues.includes('REFERENCED_MEDIA_MISSING'),JSON.stringify(missing.issues));
});
