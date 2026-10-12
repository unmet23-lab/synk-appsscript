import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,cp,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {workspaceMediaNames} from './workspace-media.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {acceptWorkspaceRestore} from './workspace-restore-acceptance.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeliveryService} from './client-delivery.mjs';
import {createClientNotificationsService} from './client-notifications.mjs';
import {createPulseLiveService} from './pulse-live.mjs';

const run=promisify(execFile),PREFIX='synk-client-delivery-backup-',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),PREFIX)),company=join(root,'company'),messenger=join(root,'messenger');
  t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.startsWith(join(tmpdir(),PREFIX)));await rm(root,{recursive:true,force:true});});
  const store=new Store(company),owner=store.createUser({name:'납품 백업 담당',email:'delivery-backup@example.test'}),projectId=randomUUID(),approvedVersionId=randomUUID(),draftId=projectId+':'+approvedVersionId;
  const files=new Map(),items=[];
  const formats=[['mp4','video/mp4','승인한 영상'],['webm','video/webm','최종 영상'],['png','image/png','표지'],['jpg','image/jpeg','추가 표지'],['srt','application/x-subrip','자막'],['vtt','text/vtt','제외한 자막']];
  for(const [extension,mimeType,label]of formats){
    const id=randomUUID(),diskName=id+'.'+extension,bytes=Buffer.from(extension==='srt'?'1\n00:00:00,000 --> 00:00:01,000\n백업 자막\n':extension==='vtt'?'WEBVTT\n\n00:00.000 --> 00:01.000\n보존할 이전 자막\n':'synthetic-delivery-'+extension);
    const media={id,diskName,mimeType,fileName:label+'.'+extension,byteSize:bytes.length,sha256:hash(bytes)};files.set(diskName,bytes);
    items.push({id:randomUUID(),requirementId:extension==='srt'||extension==='vtt'?'subtitle':extension==='png'||extension==='jpg'?'thumbnail':'video',label,confirmed:false,media,source:extension==='mp4'?'approved':'upload',...(extension==='mp4'?{versionId:approvedVersionId}:{}),...(extension==='vtt'?{removed:true,removedAt:'2026-10-12T00:01:00.000Z'}:{}),createdAt:'2026-10-12T00:00:00.000Z'});
  }
  const requirements=[{id:'video',kind:'video',label:'최종 영상',required:true,note:''},{id:'subtitle',kind:'subtitle',label:'자막',required:false,note:''},{id:'thumbnail',kind:'image',label:'썸네일',required:false,note:''}];
  const draft={schema:1,projectId,approvedPreviewId:approvedVersionId,draftRevision:2,requirements,items,guide:'SYNTHETIC_PRIVATE_DELIVERY_GUIDE',guideEdited:true,deliveredVersionIds:[],createdAt:'2026-10-12T00:00:00.000Z',updatedAt:'2026-10-12T00:01:00.000Z',updatedBy:owner.id};
  store.put('clientProjects',projectId,{id:projectId,ownerId:owner.id,versions:[{id:approvedVersionId,kind:'preview',approvedAt:'2026-10-12T00:00:00.000Z',media:items[0].media}]});
  store.put('clientDeliveryDrafts',draftId,draft);
  // A later project/version draft can point at the same immutable upload. Its
  // second owner must not duplicate bytes or inflate the manifest media count.
  store.put('clientDeliveryDrafts',projectId+':older',{...draft,approvedPreviewId:'older',draftRevision:1,items:[{...items[2],removed:true}]});
  const expected=[...files.keys()].sort();assert.equal(expected.length,6);store.close();
  await mkdir(join(company,'studio-media'));for(const [name,bytes]of files)await writeFile(join(company,'studio-media',name),bytes);await writeFile(join(company,'studio-media',randomUUID()+'.upload'),'not a committed delivery');
  await mkdir(messenger);const messengerDb=new DatabaseSync(join(messenger,'messenger.sqlite'));messengerDb.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE files (disk_name TEXT, storage_provider TEXT);');messengerDb.close();
  await writeFile(join(company,'workspace-integration.json'),JSON.stringify({messengerDataDir:messenger,identityLinks:[]}));
  const edit=fn=>{const database=new Store(company);try{return fn(database);}finally{database.close();}};
  const backup=()=>backupWorkspace({destination:join(root,'backups'),companyDataDir:company});
  return {root,company,messenger,files,expected,items,draft,draftId,edit,backup};
}
async function verifyFiles(directory,f){assert.deepEqual((await readdir(join(directory,'studio-media'))).sort(),f.expected);for(const [name,bytes]of f.files)assert.deepEqual(await readFile(join(directory,'studio-media',name)),bytes);}
async function evidence(directory){const manifest=JSON.parse(await readFile(join(directory,'integration-manifest.json'),'utf8'));return {kind:'synthetic-rehearsal',declaredLatest:true,writersStopped:true,writersStoppedAt:manifest.createdAt,baselineCreatedAt:manifest.createdAt,recordedAt:new Date().toISOString()};}

test('workspace media enumeration includes draft uploads and removed assets and deduplicates approved media',async t=>{
  const f=await fixture(t),db=new DatabaseSync(join(f.company,'company.sqlite'),{readOnly:true});
  try{assert.deepEqual(workspaceMediaNames(db).sort(),f.expected);}finally{db.close();}
});

test('company backup restores internal delivery records and all six file types without unfinished uploads',async t=>{
  const f=await fixture(t),result=await run(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),join(f.root,'company-backups')],{env:{...process.env,SYNK_COMPANY_DATA:f.company}}),target=result.stdout.trim();
  assert.ok(target.startsWith(resolve(f.root,'company-backups')));await verifyFiles(target,f);
  const restored=new Store(target);try{assert.deepEqual(restored.get('clientDeliveryDrafts',f.draftId),f.draft);assert.equal(restored.get('clientDeliveryDrafts',f.draftId).items.at(-1).removed,true);}finally{restored.close();}
  assert.deepEqual(await readFile(join(target,'encryption.key')),await readFile(join(f.company,'encryption.key')));await verifyFiles(target,f);
});

test('workspace backup and isolated cloud-volume preparation retain delivery files, metadata and original key',async t=>{
  const f=await fixture(t),baseline=await f.backup(),candidate=join(f.root,'candidate'),destination=join(f.root,'cloud-volume');await cp(baseline,candidate,{recursive:true,errorOnExist:true,force:false});
  const manifest=JSON.parse(await readFile(join(baseline,'integration-manifest.json'),'utf8'));assert.equal(manifest.mediaCount,f.expected.length);await verifyFiles(join(baseline,'company'),f);
  const report=await acceptWorkspaceRestore({candidateDirectory:candidate,baselineDirectory:baseline,freshnessEvidence:await evidence(baseline),destination,layout:'cloud-volume'});
  assert.equal(report.status,'candidate-matches-declared-baseline',JSON.stringify(report));assert.equal(report.preparedIsolatedCopy,true);assert.equal(report.preparedLayout,'cloud-volume');assert.equal(report.productionTrafficAllowed,false);assert.equal(report.sourceFilesUnchanged,true);assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_PRIVATE_DELIVERY_GUIDE/);
  await verifyFiles(destination,f);assert.deepEqual(await readFile(join(destination,'encryption.key')),await readFile(join(f.company,'encryption.key')));assert.ok(await readFile(join(destination,'PREPARATION_INCOMPLETE'),'utf8'));
  const restored=new Store(destination);try{assert.deepEqual(restored.get('clientDeliveryDrafts',f.draftId),f.draft);assert.equal(restored.all('clientDeliveryDrafts').length,2);}finally{restored.close();}
});

test('missing staged subtitle prevents a complete workspace backup instead of silently dropping the draft',async t=>{
  const f=await fixture(t),name=f.items.find(row=>row.media.mimeType==='application/x-subrip').media.diskName;await rm(join(f.company,'studio-media',name));await assert.rejects(f.backup());
  for(const folder of await readdir(join(f.root,'backups')))await assert.rejects(access(join(f.root,'backups',folder,'COMPLETE')),{code:'ENOENT'});
});

test('invalid draft media path cannot escape storage and produces no complete backup',async t=>{
  const f=await fixture(t);f.edit(store=>store.put('clientDeliveryDrafts',f.draftId,{...f.draft,items:[{...f.items[0],media:{...f.items[0].media,diskName:'../outside.srt'}}]}));
  await assert.rejects(f.backup());for(const folder of await readdir(join(f.root,'backups')))await assert.rejects(access(join(f.root,'backups',folder,'COMPLETE')),{code:'ENOENT'});
});

test('restoration rejects a missing removed VTT even when it is no longer visible in the delivery draft',async t=>{
  const f=await fixture(t),baseline=await f.backup(),candidate=join(f.root,'candidate-missing-vtt');await cp(baseline,candidate,{recursive:true,errorOnExist:true,force:false});const name=f.items.find(row=>row.removed).media.diskName;await rm(join(candidate,'company','studio-media',name));
  const report=await acceptWorkspaceRestore({candidateDirectory:candidate,baselineDirectory:baseline,freshnessEvidence:await evidence(baseline)});assert.equal(report.status,'rejected');assert.ok(report.issues.includes('REFERENCED_MEDIA_MISSING'),JSON.stringify(report));assert.equal(report.preparedIsolatedCopy,false);assert.equal(report.productionTrafficAllowed,false);
});

test('restored internal preparation keeps customer state and alerts unchanged and staged files inaccessible to customers',async t=>{
  const f=await fixture(t);f.edit(store=>{for(const kind of ['clientProjects','clientDeliveryDrafts'])for(const {id}of store.db.prepare('SELECT id FROM documents WHERE kind=?').all(kind))store.remove(kind,id);});
  let store=new Store(f.company);t.after(()=>store?.close());
  function services(){const clientProjects=createClientProjectsService({store}),delivery=createClientDeliveryService({store,clientProjects}),notifications=createClientNotificationsService({store,clientProjects}),live=createPulseLiveService({store,clientProjects,clientNotifications:notifications});return {clientProjects,delivery,notifications,live};}
  let s=services();const owner=store.all('users')[0];let row=s.clientProjects.save(owner,{title:'합성 복구 고객 프로젝트',customerName:'합성 고객'}).project;
  row=s.clientProjects.addVersion(owner,row.id,{revision:row.revision,kind:'preview',label:'승인 영상'},f.items[0].media).project;
  const invited=s.clientProjects.invite(owner,row.id,{revision:row.revision}),customer=s.clientProjects.open(invited.invite);row=s.clientProjects.project(owner,row.id);
  s.clientProjects.customerAction(customer.session,customer.csrf,{revision:row.revision,versionId:row.versions[0].id,action:'approve'});
  const projectBefore=store.get('clientProjects',row.id),customerBefore=s.clientProjects.read(customer.session),liveBefore=s.live.customerState(customer.session),staffBefore=s.notifications.list(owner);
  const input=(action,extra={})=>{const view=s.delivery.get(owner,row.id);return {projectRevision:view.projectRevision,draftRevision:view.draftRevision,approvedPreviewId:view.approvedPreview.id,...(action?{action}:{}),...extra};};
  s.delivery.mutate(owner,row.id,input('use_approved',{requirementId:'video',label:'준비 중 영상'}));
  s.delivery.mutate(owner,row.id,input('save_guide',{guide:'SYNTHETIC_INTERNAL_GUIDE_NOT_YET_SHARED'}));
  const srt=f.items.find(item=>item.media.mimeType==='application/x-subrip').media,vtt=f.items.find(item=>item.media.mimeType==='text/vtt').media;
  s.delivery.addUpload(owner,row.id,input(null,{requirementId:'subtitle',label:'준비 중 자막'}),srt);
  let view=s.delivery.addUpload(owner,row.id,input(null,{requirementId:'subtitle',label:'제외할 자막'}),vtt);
  s.delivery.mutate(owner,row.id,input('remove_item',{itemId:view.items.find(item=>item.media?.id===vtt.id).id}));
  assert.deepEqual(store.get('clientProjects',row.id),projectBefore);assert.deepEqual(s.clientProjects.read(customer.session),customerBefore);assert.deepEqual(s.live.customerState(customer.session),liveBefore);assert.deepEqual(s.notifications.list(owner),staffBefore);
  for(const media of [srt,vtt])assert.throws(()=>s.clientProjects.customerMedia(customer.session,media.id),{status:404});
  const draftBefore=store.get('clientDeliveryDrafts',row.id+':'+row.versions[0].id);s.notifications.close();store.close();store=null;
  const backup=await f.backup();store=new Store(join(backup,'company'));s=services();
  assert.deepEqual(store.get('clientProjects',row.id),projectBefore);assert.deepEqual(store.get('clientDeliveryDrafts',row.id+':'+row.versions[0].id),draftBefore);assert.deepEqual(s.clientProjects.read(customer.session),customerBefore);assert.deepEqual(s.live.customerState(customer.session),liveBefore);assert.deepEqual(s.notifications.list(owner),staffBefore);
  view=s.delivery.get(owner,row.id);assert.equal(view.items.length,2);assert.equal(view.guide,'SYNTHETIC_INTERNAL_GUIDE_NOT_YET_SHARED');assert.equal(view.canPublish,false);
  assert.equal(s.delivery.mediaFor(owner,row.id,srt.id).diskName,srt.diskName);assert.throws(()=>s.delivery.mediaFor(owner,row.id,vtt.id),{status:404});for(const media of [srt,vtt]){assert.throws(()=>s.clientProjects.customerMedia(customer.session,media.id),{status:404});assert.deepEqual(await readFile(join(backup,'company','studio-media',media.diskName)),f.files.get(media.diskName));}
  assert.doesNotMatch(JSON.stringify(customerBefore),/SYNTHETIC_INTERNAL_GUIDE_NOT_YET_SHARED/);s.notifications.close();store.close();store=null;
});
