import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {Store} from './store.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {acceptWorkspaceRestore} from './workspace-restore-acceptance.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeliveryService} from './client-delivery.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';

const prefix='synk-delivery-check-backup-',at='2026-10-12T03:00:00.000Z';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const revisions=view=>({projectRevision:view.projectRevision,draftRevision:view.draftRevision,approvedPreviewId:view.approvedPreview.id});

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),prefix)),company=join(root,'company'),messenger=join(root,'messenger'),opened=[];
  t.after(async()=>{for(const entry of opened)entry.close();assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.startsWith(join(tmpdir(),prefix)));await rm(root,{recursive:true,force:true});});
  function open(directory){
    const store=new Store(directory),clientProjects=createClientProjectsService({store,clock:()=>at}),studio=createPulseStudioService({store,clientProjects,clock:()=>at});let closed=false;
    // Synthetic bytes are hashed from the isolated media directory. Only the
    // technical decoding result is mocked; this is not a real-video decode test.
    const fileInspector={inspect:async media=>{const bytes=await readFile(join(directory,'studio-media',media.diskName));return {status:'inspected',sha256:sha(bytes),byteSize:bytes.length,metadata:media.mimeType==='application/x-subrip'?{kind:'subtitle',cueCount:1,lastCueEnd:29.5,subtitleWarnings:[]}:{kind:'video',duration:30,width:1080,height:1920,displayAspectRatio:9/16}};}};
    const delivery=createClientDeliveryService({store,clientProjects,fileInspector,clock:()=>at}),entry={store,clientProjects,studio,delivery,close(){if(!closed){store.close();closed=true;}}};opened.push(entry);return entry;
  }
  const s=open(company),owner=s.store.createUser({name:'합성 납품 담당',email:'owner@delivery-check-backup.test',role:'member',teamId:'team-a'}),reviewer=s.store.createUser({name:'합성 검토자',email:'reviewer@delivery-check-backup.test',role:'member',teamId:'team-a'}),other=s.store.createUser({name:'다른 담당자',email:'other@delivery-check-backup.test',role:'member',teamId:'team-b'});
  await mkdir(join(company,'studio-media'),{recursive:true});
  const files=[];
  for(const [name,mimeType,body]of [['preview.mp4','video/mp4','synthetic-approved-preview'],['private-final.mp4','video/mp4','synthetic-staged-final-video'],['private-captions.srt','application/x-subrip','1\n00:00:00,000 --> 00:00:29,500\n합성 백업 자막\n']]){
    const id=randomUUID(),bytes=Buffer.from(body),media={id,diskName:id+'.'+name.split('.').at(-1),fileName:name,mimeType,byteSize:bytes.length};await writeFile(join(company,'studio-media',media.diskName),bytes);files.push({media,bytes,sha256:sha(bytes)});
  }
  let row=s.clientProjects.save(owner,{title:'합성 17번 백업 확인',customerName:'합성 고객',reviewerId:reviewer.id}).project;
  row=s.clientProjects.addVersion(owner,row.id,{revision:row.revision,kind:'preview',label:'고객 승인 시안'},files[0].media).project;
  const invitation=s.clientProjects.invite(owner,row.id,{revision:row.revision}),customer=s.clientProjects.open(invitation.invite);row=s.clientProjects.project(owner,row.id);
  s.clientProjects.customerAction(customer.session,customer.csrf,{revision:row.revision,action:'approve',versionId:row.versions[0].id});
  row=s.clientProjects.project(owner,row.id);
  let result=s.studio.staffMutate(owner,row.id,{action:'save_deliverables',revision:row.revision,deliverableRevision:0,items:[{label:'세로 영상과 별도 자막',kind:'video',platform:'instagram',placement:'릴스',durationSeconds:30,aspectRatio:'9:16',language:'한국어',subtitles:'separate',fileFormat:'mp4',quantity:1,notes:''}],notes:'합성 고객 확정 규격'});
  result=s.studio.staffMutate(owner,row.id,{action:'request_deliverable_review',revision:result.project.revision,deliverableRevision:1});
  result=s.studio.customerMutate(customer.session,customer.csrf,{action:'confirm_deliverables',revision:result.project.revision,deliverableRevision:1});
  const id=row.id,specId=result.project.studio.deliverables.items[0].id,act=(action,extra)=>s.delivery.mutate(owner,id,{...revisions(s.delivery.get(owner,id)),action,...extra});
  for(const [index,requirementId]of [[1,'video'],[2,'subtitle']])s.delivery.addUpload(owner,id,{...revisions(s.delivery.get(owner,id)),requirementId,label:index===1?'SYNTHETIC_PRIVATE_VIDEO_LABEL':'SYNTHETIC_PRIVATE_SUBTITLE_LABEL',deliverableItemId:specId},files[index].media);
  act('save_guide',{guide:'SYNTHETIC_PRIVATE_CHECK_GUIDE'});
  let view=await s.delivery.refreshChecks(owner,id);assert.equal(view.deliveryCheck.status,'manual');assert.equal(view.deliveryCheck.blockingCount,0);
  for(const item of view.items)view=act('update_item',{itemId:item.id,confirmed:true,confirmationToken:item.confirmationToken});
  assert.equal(view.canPublish,true);assert.equal(view.deliveryCheck.status,'ready');
  const draftId=id+':'+view.approvedPreview.id,expected={project:s.store.get('clientProjects',id),draft:s.store.get('clientDeliveryDrafts',draftId),inspection:s.store.get('clientDeliveryChecks',draftId),customer:s.clientProjects.read(customer.session),studioCustomer:s.studio.customerState(customer.session),view};
  s.close();await mkdir(messenger);const db=new DatabaseSync(join(messenger,'messenger.sqlite'));db.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE files (disk_name TEXT, storage_provider TEXT);');db.close();
  await writeFile(join(company,'workspace-integration.json'),JSON.stringify({messengerDataDir:messenger,identityLinks:[]}));
  const baseline=await backupWorkspace({destination:join(root,'backups'),companyDataDir:company}),manifest=JSON.parse(await readFile(join(baseline,'integration-manifest.json'),'utf8'));
  const evidence={kind:'synthetic-rehearsal',declaredLatest:true,writersStopped:true,writersStoppedAt:manifest.createdAt,baselineCreatedAt:manifest.createdAt,recordedAt:new Date().toISOString()};
  return {root,company,baseline,evidence,open,owner,reviewer,other,customer,id,specId,draftId,files,expected,manifest};
}

test('isolated workspace restoration preserves inspection records, current confirmation tokens, agreed source and all media hashes',async t=>{
  const f=await fixture(t),candidate=join(f.root,'candidate'),destination=join(f.root,'restored');await cp(f.baseline,candidate,{recursive:true,errorOnExist:true,force:false});
  const report=await acceptWorkspaceRestore({candidateDirectory:candidate,baselineDirectory:f.baseline,freshnessEvidence:f.evidence,destination,layout:'cloud-volume'});
  assert.equal(report.status,'candidate-matches-declared-baseline',JSON.stringify(report));assert.equal(report.preparedIsolatedCopy,true);assert.equal(report.productionTrafficAllowed,false);assert.equal(report.sourceFilesUnchanged,true);assert.equal(f.manifest.mediaCount,3);assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_PRIVATE|confirmationToken/);
  const restored=f.open(destination);assert.deepEqual(restored.store.get('clientProjects',f.id),f.expected.project);assert.deepEqual(restored.store.get('clientDeliveryDrafts',f.draftId),f.expected.draft);assert.deepEqual(restored.store.get('clientDeliveryChecks',f.draftId),f.expected.inspection);
  const view=restored.delivery.get(f.owner,f.id);assert.equal(view.deliveryCheck.status,'ready');assert.equal(view.deliveryCheck.fingerprint,f.expected.view.deliveryCheck.fingerprint);assert.equal(view.deliveryCheck.checkedAt,f.expected.view.deliveryCheck.checkedAt);assert.equal(view.canPublish,true);
  for(const item of view.items){const before=f.expected.view.items.find(value=>value.id===item.id);assert.equal(item.deliverableItemId,f.specId);assert.equal(item.confirmationToken,before.confirmationToken);assert.equal(item.confirmed,true);}
  for(const file of f.files){const bytes=await readFile(join(destination,'studio-media',file.media.diskName));assert.equal(sha(bytes),file.sha256);const inspected=f.expected.inspection.results[file.media.id];if(inspected)assert.equal(inspected.sha256,file.sha256);}
  assert.deepEqual(await readFile(join(destination,'encryption.key')),await readFile(join(f.company,'encryption.key')));assert.match(await readFile(join(destination,'PREPARATION_INCOMPLETE'),'utf8'),/Do not start/);
});

test('resumed checks preserve customer privacy and current account permissions until a separate publish action',async t=>{
  const f=await fixture(t),restored=f.open(join(f.baseline,'company'));assert.deepEqual(restored.clientProjects.read(f.customer.session),f.expected.customer);assert.deepEqual(restored.studio.customerState(f.customer.session),f.expected.studioCustomer);
  const visible=JSON.stringify(restored.studio.customerState(f.customer.session));assert.doesNotMatch(visible,/deliveryCheck|confirmationToken|diskName|SYNTHETIC_PRIVATE/);assert.equal(restored.studio.customerState(f.customer.session).project.studio.deliverables.confirmation.deliverableRevision,1);
  for(const file of f.files.slice(1)){assert.throws(()=>restored.clientProjects.customerMedia(f.customer.session,file.media.id),{status:404});assert.throws(()=>restored.studio.customerMedia(f.customer.session,file.media.id),{status:404});assert.equal(restored.delivery.mediaFor(f.owner,f.id,file.media.id).diskName,file.media.diskName);}
  assert.throws(()=>restored.delivery.get(f.other,f.id),{status:404});assert.equal(restored.delivery.get(f.reviewer,f.id).canEdit,false);await assert.rejects(restored.delivery.check(f.reviewer,f.id,revisions(restored.delivery.get(f.reviewer,f.id))),{status:403});
  const refreshed=await restored.delivery.refreshChecks(f.owner,f.id);assert.equal(refreshed.canPublish,true);assert.equal(refreshed.draftRevision,f.expected.view.draftRevision);assert.equal(refreshed.projectRevision,f.expected.view.projectRevision);assert.deepEqual(refreshed.items.map(item=>item.confirmationToken),f.expected.view.items.map(item=>item.confirmationToken));assert.deepEqual(restored.clientProjects.read(f.customer.session),f.expected.customer);
  restored.store.put('users',f.owner.id,{...f.owner,active:false});assert.throws(()=>restored.delivery.get(f.owner,f.id),{status:401});assert.deepEqual(restored.clientProjects.read(f.customer.session),f.expected.customer);
});

test('a saved passing inspection cannot hide changed staged-file bytes during restore acceptance',async t=>{
  const f=await fixture(t),candidate=join(f.root,'changed-candidate');await cp(f.baseline,candidate,{recursive:true,errorOnExist:true,force:false});const file=f.files[1],changed=Buffer.from(file.bytes);changed[changed.length-1]^=1;assert.equal(changed.length,file.bytes.length);await writeFile(join(candidate,'company','studio-media',file.media.diskName),changed);
  const report=await acceptWorkspaceRestore({candidateDirectory:candidate,baselineDirectory:f.baseline,freshnessEvidence:f.evidence});assert.equal(report.status,'rejected');assert.ok(report.issues.includes('BACKUP_PAYLOAD_FILES_DIFFER'));assert.equal(report.preparedIsolatedCopy,false);assert.equal(report.productionTrafficAllowed,false);assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_PRIVATE|confirmationToken/);
  assert.equal(sha(await readFile(join(f.baseline,'company','studio-media',file.media.diskName))),file.sha256);
});
