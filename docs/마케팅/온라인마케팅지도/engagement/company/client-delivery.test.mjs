import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeliveryService} from './client-delivery.mjs';

const input={title:'합성 납품 프로젝트',customerName:'합성 고객',contact:'PRIVATE_CONTACT',summary:'PUBLIC_SUMMARY',terms:'PUBLIC_TERMS',internalNotes:'PRIVATE_NOTES',nextStep:'시안 확인',dueDate:'2026-10-20',nextContactDate:''};
const throwsStatus=(run,status)=>assert.throws(run,error=>error.status===status);
const metadata=(mimeType='video/mp4')=>{const id=randomUUID(),extension={'video/mp4':'mp4','video/webm':'webm','image/png':'png','image/jpeg':'jpg','application/x-subrip':'srt','text/vtt':'vtt'}[mimeType];return {id,diskName:id+'.'+extension,mimeType,fileName:'합성 파일.'+extension,byteSize:100};};
const revisions=view=>({projectRevision:view.projectRevision,draftRevision:view.draftRevision,approvedPreviewId:view.approvedPreview?.id});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-service-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId] of [['owner','member','team-a'],['reviewer','member','team-a'],['peer','member','team-a'],['other','member','team-b'],['manager','manager','team-a'],['viewer','viewer','team-a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@delivery.test',role,teamId});
  const clock=()=>new Date().toISOString(),clientProjects=createClientProjectsService({store,clock}),service=createClientDeliveryService({store,clientProjects,clock});
  function create(user=users.owner,extra={}){let row=clientProjects.save(user,{...input,...extra}).project;const invite=clientProjects.invite(user,row.id,{revision:row.revision}),session=clientProjects.open(invite.invite);return {id:row.id,user,session};}
  function preview(project,options={}){const row=clientProjects.project(project.user,project.id);return clientProjects.addVersion(project.user,project.id,{revision:row.revision,kind:'preview',label:options.label||'고객 확인 시안',...(options.url?{url:options.url}:{})},options.media===false?null:options.media||metadata()).project;}
  function approve(project){const row=clientProjects.project(project.user,project.id);return clientProjects.customerAction(project.session.session,project.session.csrf,{revision:row.revision,action:'approve',versionId:row.versions.filter(version=>version.kind==='preview').at(-1).id}).project;}
  function approved(options={}){const project=create(options.user||users.owner,options.project||{});preview(project,options);approve(project);return project;}
  function act(project,action,extra={},user=project.user){return service.mutate(user,project.id,{...revisions(service.get(user,project.id)),action,...extra});}
  function upload(project,requirementId='video',media=metadata(),label='최종본'){return service.addUpload(project.user,project.id,{...revisions(service.get(project.user,project.id)),requirementId,label},media);}
  function ready(project){let view=act(project,'use_approved',{requirementId:'video',label:'최종 영상'});return act(project,'update_item',{itemId:view.items[0].id,confirmed:true});}
  return {directory,store,users,clientProjects,service,create,preview,approve,approved,act,upload,ready};
}

test('reading drafts never persists or changes customer data; only latest approved preview is a candidate',async t=>{
  const f=await fixture(t),project=f.create(),first=f.service.get(project.user,project.id);assert.equal(first.status,'no_preview');assert.equal(first.canEdit,false);assert.equal(first.approvedPreview,null);assert.equal(first.draftRevision,0);assert.deepEqual(f.store.all('clientDeliveryDrafts'),[]);
  f.preview(project,{label:'첫 시안'});assert.equal(f.service.get(project.user,project.id).status,'waiting_approval');f.approve(project);
  const before=f.store.get('clientProjects',project.id),view=f.service.get(project.user,project.id);assert.equal(view.status,'preparing');assert.equal(view.candidates.length,1);assert.equal(view.candidates[0].versionId,view.approvedPreview.id);assert.equal(view.canEdit,true);assert.equal(view.canPublish,false);assert.deepEqual(f.store.get('clientProjects',project.id),before);assert.deepEqual(f.store.all('clientDeliveryDrafts'),[]);
  assert.doesNotMatch(JSON.stringify(view),/PRIVATE_|PUBLIC_SUMMARY|PUBLIC_TERMS|diskName|customerName|inviteHash|notificationEvents/);
  f.preview(project,{label:'새 시안'});const next=f.service.get(project.user,project.id);assert.equal(next.status,'waiting_approval');assert.equal(next.approvedPreview,null);assert.deepEqual(next.candidates,[]);
});

test('preparing approved media and guidance remains internal until an explicit publish',async t=>{
  const f=await fixture(t),project=f.approved(),before=f.store.get('clientProjects',project.id),customerBefore=f.clientProjects.read(project.session.session).project;
  let view=f.act(project,'use_approved',{requirementId:'video',label:'전달 영상'});assert.equal(view.items[0].confirmed,false);assert.equal(view.canPublish,false);assert.equal(view.checks.find(check=>check.id==='item:'+view.items[0].id).status,'manual');
  view=f.act(project,'update_item',{itemId:view.items[0].id,confirmed:true});assert.equal(view.canPublish,true);assert.equal(view.status,'ready');assert.deepEqual(f.store.get('clientProjects',project.id),before);assert.deepEqual(f.clientProjects.read(project.session.session).project,customerBefore);
  view=f.act(project,'save_guide',{guide:'담당자가 작성한 사용 안내'});assert.equal(view.guide,'담당자가 작성한 사용 안내');view=f.upload(project,'subtitle',metadata('text/vtt'),'따로 파일');assert.equal(view.guide,'담당자가 작성한 사용 안내');assert.equal(view.canPublish,false);
  assert.doesNotMatch(JSON.stringify(view),/PRIVATE_|diskName|PUBLIC_SUMMARY|PUBLIC_TERMS/);
});

test('publish atomically registers all selected files with the same exact approval and rejects repeat delivery',async t=>{
  const f=await fixture(t),project=f.approved();f.ready(project);let view=f.upload(project,'subtitle',metadata('application/x-subrip'),'한국어 자막');view=f.act(project,'update_item',{itemId:view.items[1].id,confirmed:true});const revision=view.projectRevision,approvedId=view.approvedPreview.id;
  view=f.act(project,'publish',{confirmed:true});assert.equal(view.status,'delivered');assert.equal(view.canEdit,false);assert.equal(view.canPublish,false);assert.equal(view.projectRevision,revision+2);assert.equal(view.deliveredVersionIds.length,2);
  const row=f.clientProjects.project(project.user,project.id),finals=row.versions.filter(version=>version.kind==='final');assert.equal(row.stage,'delivered');assert.equal(finals.length,2);assert.ok(finals.every(version=>version.approvedPreviewId===approvedId&&version.guide));assert.equal(f.clientProjects.read(project.session.session).project.versions.filter(version=>version.kind==='final').length,2);
  throwsStatus(()=>f.act(project,'publish',{confirmed:true}),409);assert.equal(f.clientProjects.project(project.user,project.id).versions.filter(version=>version.kind==='final').length,2);
});

test('publish needs explicit confirmation, required files, every manual review and nonempty guidance',async t=>{
  const f=await fixture(t),project=f.approved();throwsStatus(()=>f.act(project,'publish',{confirmed:true}),409);let view=f.act(project,'add_link',{requirementId:'subtitle',label:'자막',url:'https://files.example.test/subtitle'});view=f.act(project,'update_item',{itemId:view.items[0].id,confirmed:true});assert.equal(view.canPublish,false);
  view=f.ready(project);for(const item of view.items)if(!item.confirmed)view=f.act(project,'update_item',{itemId:item.id,confirmed:true});throwsStatus(()=>f.act(project,'publish',{}),400);view=f.act(project,'save_guide',{guide:'  '});assert.equal(view.canPublish,false);assert.equal(view.checks.find(check=>check.id==='guide').status,'missing');throwsStatus(()=>f.act(project,'publish',{confirmed:true}),409);assert.equal(f.clientProjects.project(project.user,project.id).stage,'review');
});

test('known MIME mismatch cannot be confirmed or bypassed by manual acknowledgement',async t=>{
  const f=await fixture(t),project=f.approved({media:metadata('image/png')});let view=f.act(project,'use_approved',{requirementId:'video',label:'이미지 시안'});assert.equal(view.items[0].kind,'image');assert.equal(view.checks.find(check=>check.id==='item:'+view.items[0].id).status,'missing');throwsStatus(()=>f.act(project,'update_item',{itemId:view.items[0].id,confirmed:true}),409);
  const requirements=view.requirements.map(entry=>entry.id==='video'?{...entry,kind:'image',label:'최종 이미지'}:entry);view=f.act(project,'save_requirements',{requirements});view=f.act(project,'update_item',{itemId:view.items[0].id,confirmed:true});assert.equal(view.canPublish,true);
});

test('HTTPS links remain manual and reject unsafe addresses, duplicate choices and metadata spoofing',async t=>{
  const f=await fixture(t),project=f.approved({media:false,url:'https://files.example.test/approved'});let view=f.act(project,'use_approved',{requirementId:'video',label:'승인 주소'});assert.equal(view.items[0].source,'approved');assert.equal(view.items[0].confirmed,false);assert.equal(view.candidates[0].kind,'link');
  throwsStatus(()=>f.act(project,'use_approved',{requirementId:'video',label:'중복'}),409);for(const url of ['http://files.example.test/a','javascript:alert(1)','https://user:pass@files.example.test/a'])throwsStatus(()=>f.act(project,'add_link',{requirementId:'video',label:'잘못된 주소',url}),400);
  throwsStatus(()=>f.act(project,'add_link',{requirementId:'video',label:'위조',url:'https://files.example.test/b',media:metadata()}),400);throwsStatus(()=>f.act(project,'add_link',{requirementId:'video',label:'위조',url:'https://files.example.test/b',confirmed:true}),400);throwsStatus(()=>f.act(project,'add_link',{requirementId:'video',label:'중복',url:view.items[0].url}),409);
  view=f.act(project,'update_item',{itemId:view.items[0].id,confirmed:true});assert.equal(view.canPublish,true);
});

test('every mutation requires both current revisions and exact current approved preview',async t=>{
  const f=await fixture(t),project=f.approved(),view=f.service.get(project.user,project.id),base={...revisions(view),action:'save_guide',guide:'안내'};
  for(const field of ['projectRevision','draftRevision','approvedPreviewId']){const bad={...base};delete bad[field];throwsStatus(()=>f.service.mutate(project.user,project.id,bad),409);}
  f.service.mutate(project.user,project.id,base);throwsStatus(()=>f.service.mutate(project.user,project.id,base),409);const current=f.service.get(project.user,project.id);f.clientProjects.message(project.user,project.id,{revision:current.projectRevision,text:'추가 내부 기록',visibility:'internal'});throwsStatus(()=>f.service.mutate(project.user,project.id,{...base,...revisions(current)}),409);assert.equal(f.service.get(project.user,project.id).guide,'안내');
});

test('current project permissions control drafts, uploads and publishing without trusting stale users',async t=>{
  const f=await fixture(t),project=f.approved({project:{reviewerId:f.users.reviewer.id}});f.ready(project);
  for(const user of [f.users.viewer,f.users.reviewer]){assert.equal(f.service.get(user,project.id).canEdit,false);throwsStatus(()=>f.act(project,'save_guide',{guide:'불가'},user),403);throwsStatus(()=>f.service.assertUpload(user,project.id,{...revisions(f.service.get(user,project.id)),requirementId:'video',label:'불가'}),403);}
  for(const user of [f.users.peer,f.users.other])throwsStatus(()=>f.service.get(user,project.id),404);
  assert.equal(f.service.get(f.users.manager,project.id).canEdit,true);assert.equal(f.service.get(f.users.admin,project.id).canEdit,true);
  f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal(f.service.get(f.users.owner,project.id).canEdit,false);throwsStatus(()=>f.act(project,'publish',{confirmed:true}),403);f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});throwsStatus(()=>f.service.get(f.users.owner,project.id),401);
});

test('new preview creates a separate empty preparation and cannot reuse old confirmations or uploads',async t=>{
  const f=await fixture(t),project=f.approved();const media=metadata();let view=f.upload(project,'video',media);view=f.act(project,'update_item',{itemId:view.items[0].id,confirmed:true});const old={...revisions(view),action:'publish',confirmed:true};f.preview(project,{label:'새 최종 시안'});throwsStatus(()=>f.service.mutate(project.user,project.id,old),409);throwsStatus(()=>f.service.mediaFor(project.user,project.id,media.id),404);
  f.approve(project);const next=f.service.get(project.user,project.id);assert.equal(next.items.length,0);assert.equal(next.draftRevision,0);assert.notEqual(next.approvedPreview.id,old.approvedPreviewId);assert.equal(f.store.all('clientDeliveryDrafts').length,1);assert.equal(f.store.all('clientDeliveryDrafts')[0].items[0].media.id,media.id);
});

test('archived, unresolved-feedback and already-delivered projects remain read only',async t=>{
  const f=await fixture(t),archived=f.approved(),feedback=f.approved(),delivered=f.approved();let row=f.clientProjects.project(archived.user,archived.id);f.clientProjects.save(archived.user,{...input,revision:row.revision,stage:'archived'},archived.id);assert.equal(f.service.get(archived.user,archived.id).status,'archived');throwsStatus(()=>f.act(archived,'save_guide',{guide:'불가'}),409);
  row=f.store.get('clientProjects',feedback.id);f.store.put('clientProjects',feedback.id,{...row,messages:[...row.messages,{id:'unresolved-feedback',author:'customer',action:'feedback',resolved:false,text:'남은 수정'}]});assert.equal(f.service.get(feedback.user,feedback.id).status,'feedback_pending');throwsStatus(()=>f.act(feedback,'save_guide',{guide:'불가'}),409);
  row=f.clientProjects.project(delivered.user,delivered.id);row=f.clientProjects.addVersion(delivered.user,delivered.id,{revision:row.revision,kind:'final',label:'기존 납품',url:'https://files.example.test/final',guide:'사용 안내'}).project;assert.equal(f.service.get(delivered.user,delivered.id).status,'delivered');assert.deepEqual(f.service.get(delivered.user,delivered.id).deliveredVersionIds,[row.versions.at(-1).id]);throwsStatus(()=>f.act(delivered,'save_guide',{guide:'불가'}),409);
});

test('editing requirements resets affected confirmations, prevents orphaned files and preserves edited guide',async t=>{
  const f=await fixture(t),project=f.approved();let view=f.ready(project);view=f.act(project,'save_guide',{guide:'확정 사용 안내'});const requirements=view.requirements.map(entry=>entry.id==='video'?{...entry,note:'세로 1080 x 1920'}:entry);view=f.act(project,'save_requirements',{requirements});assert.equal(view.items[0].confirmed,false);assert.equal(view.guide,'확정 사용 안내');throwsStatus(()=>f.act(project,'save_requirements',{requirements:view.requirements.filter(entry=>entry.id!=='video')}),409);
  for(const requirements of [[],Array.from({length:13},(_,index)=>({id:'r'+index,kind:'video',label:'종류',required:false,note:''})),[{id:'same',kind:'video',label:'하나',required:true,note:''},{id:'same',kind:'video',label:'둘',required:false,note:''}],[{id:'v',kind:'executable',label:'종류',required:true,note:''}],[{id:'v',kind:'video',label:'종류',required:true,note:'',media:metadata()}]])throwsStatus(()=>f.act(project,'save_requirements',{requirements}),400);
});

test('staged upload media uses current project ACL and removed files retain metadata without remaining downloadable',async t=>{
  const f=await fixture(t),project=f.approved(),other=f.approved({user:f.users.other}),media=metadata('text/vtt');let view=f.upload(project,'subtitle',media);const itemId=view.items[0].id;assert.equal(view.items[0].media.diskName,undefined);assert.match(view.items[0].media.url,new RegExp('/api/client-projects/'+project.id+'/delivery/media/'+media.id));assert.equal(f.service.mediaFor(project.user,project.id,media.id).diskName,media.diskName);assert.equal(f.service.mediaFor(f.users.viewer,project.id,media.id).id,media.id);throwsStatus(()=>f.service.mediaFor(f.users.other,project.id,media.id),404);throwsStatus(()=>f.service.mediaFor(f.users.other,other.id,media.id),404);throwsStatus(()=>f.clientProjects.customerMedia(project.session.session,media.id),404);
  view=f.act(project,'remove_item',{itemId});assert.deepEqual(view.items,[]);throwsStatus(()=>f.service.mediaFor(project.user,project.id,media.id),404);const saved=f.store.all('clientDeliveryDrafts')[0].items[0];assert.equal(saved.removed,true);assert.equal(saved.media.diskName,media.diskName);assert.equal(saved.confirmed,false);
});

test('uploads recheck revisions, validate trusted metadata and cannot be registered twice or spoofed by input',async t=>{
  const f=await fixture(t),project=f.approved(),media=metadata(),view=f.service.get(project.user,project.id),base={...revisions(view),requirementId:'video',label:'최종 파일'};f.service.assertUpload(project.user,project.id,base);f.act(project,'save_guide',{guide:'업로드 중 변경'});throwsStatus(()=>f.service.addUpload(project.user,project.id,base,media),409);
  const current={...base,...revisions(f.service.get(project.user,project.id))};throwsStatus(()=>f.service.addUpload(project.user,project.id,{...current,media},media),400);throwsStatus(()=>f.service.addUpload(project.user,project.id,current,{...media,diskName:'../elsewhere.mp4'}),415);throwsStatus(()=>f.service.addUpload(project.user,project.id,current,{...media,mimeType:'text/html'}),415);throwsStatus(()=>f.service.addUpload(project.user,project.id,current,{...metadata('text/vtt'),byteSize:256*1024+1}),415);f.service.addUpload(project.user,project.id,current,media);throwsStatus(()=>f.upload(project,'video',media),409);
});

test('a publish failure midway rolls back all final versions, customer events and draft markers',async t=>{
  const f=await fixture(t),project=f.approved();f.ready(project);let view=f.upload(project,'subtitle',metadata('text/vtt'),'자막');view=f.act(project,'update_item',{itemId:view.items[1].id,confirmed:true});const beforeProject=f.store.get('clientProjects',project.id),beforeDraft=f.store.all('clientDeliveryDrafts')[0],original=f.clientProjects.addVersion;let count=0;
  f.clientProjects.addVersion=(...args)=>{if(++count===2)throw Object.assign(new Error('합성 납품 두 번째 파일 실패'),{status:503});return original(...args);};try{throwsStatus(()=>f.act(project,'publish',{confirmed:true}),503);}finally{f.clientProjects.addVersion=original;}
  assert.equal(count,2);assert.deepEqual(f.store.get('clientProjects',project.id),beforeProject);assert.deepEqual(f.store.all('clientDeliveryDrafts')[0],beforeDraft);assert.equal(f.service.get(project.user,project.id).canPublish,true);assert.equal(f.act(project,'publish',{confirmed:true}).deliveredVersionIds.length,2);
});

test('existing project version limit is enforced atomically for a multi-file delivery',async t=>{
  const f=await fixture(t),project=f.approved();f.ready(project);let view=f.upload(project,'subtitle',metadata('text/vtt'),'자막');view=f.act(project,'update_item',{itemId:view.items[1].id,confirmed:true});const row=f.store.get('clientProjects',project.id),preview=row.versions[0],extras=Array.from({length:98},(_,index)=>({...preview,id:randomUUID(),kind:'final',approvedPreviewId:'old-approved-'+index}));f.store.put('clientProjects',project.id,{...row,versions:[...extras,preview]});const before=f.store.get('clientProjects',project.id);assert.equal(f.service.get(project.user,project.id).checks.find(check=>check.id==='capacity').status,'missing');assert.equal(f.service.get(project.user,project.id).canPublish,false);throwsStatus(()=>f.act(project,'publish',{confirmed:true}),409);assert.deepEqual(f.store.get('clientProjects',project.id),before);assert.deepEqual(f.store.all('clientDeliveryDrafts')[0].deliveredVersionIds,[]);
});

test('reassignment withdraws the former owner access while the new owner can continue the same internal draft',async t=>{
  const f=await fixture(t),project=f.approved(),media=metadata();f.upload(project,'video',media);const row=f.clientProjects.project(f.users.manager,project.id);f.clientProjects.save(f.users.manager,{...input,revision:row.revision,ownerId:f.users.peer.id},project.id);
  throwsStatus(()=>f.service.get(f.users.owner,project.id),404);throwsStatus(()=>f.service.mediaFor(f.users.owner,project.id,media.id),404);const next=f.service.get(f.users.peer,project.id);assert.equal(next.items.length,1);assert.equal(next.canEdit,true);assert.equal(f.service.mediaFor(f.users.peer,project.id,media.id).id,media.id);f.service.mutate(f.users.peer,project.id,{...revisions(next),action:'update_item',itemId:next.items[0].id,confirmed:true});assert.equal(f.service.get(f.users.peer,project.id).canPublish,true);
});

test('a new approved preview after delivery starts new preparation without copying old final choices',async t=>{
  const f=await fixture(t),project=f.approved();f.ready(project);const delivered=f.act(project,'publish',{confirmed:true});f.preview(project,{label:'추가 작업 시안'});f.approve(project);const next=f.service.get(project.user,project.id);assert.equal(next.status,'preparing');assert.equal(next.draftRevision,0);assert.equal(next.canEdit,true);assert.equal(next.canPublish,false);assert.deepEqual(next.items,[]);assert.deepEqual(next.deliveredVersionIds,[]);assert.notEqual(next.approvedPreview.id,delivered.approvedPreview.id);assert.equal(f.clientProjects.project(project.user,project.id).versions.filter(version=>version.kind==='final').length,1);
});

test('failure saving the delivery draft marker rolls back already-added finals and their customer notifications',async t=>{
  const f=await fixture(t),project=f.approved();f.ready(project);const beforeProject=f.store.get('clientProjects',project.id),beforeDraft=f.store.all('clientDeliveryDrafts')[0],put=f.store.put.bind(f.store);f.store.put=(kind,id,row)=>{if(kind==='clientDeliveryDrafts'&&row.deliveredVersionIds?.length)throw Object.assign(new Error('합성 초안 저장 실패'),{status:503});return put(kind,id,row);};try{throwsStatus(()=>f.act(project,'publish',{confirmed:true}),503);}finally{f.store.put=put;}assert.deepEqual(f.store.get('clientProjects',project.id),beforeProject);assert.deepEqual(f.store.all('clientDeliveryDrafts')[0],beforeDraft);assert.equal(f.service.get(project.user,project.id).canPublish,true);
});

test('bounded item history preserves removed upload references and generated guidance stays within the final-version limit',async t=>{
  const f=await fixture(t),project=f.approved();let view;for(let i=0;i<40;i++)view=f.act(project,'add_link',{requirementId:'video',label:'파일'.repeat(50)+i,url:'https://files.example.test/'+i});assert.ok(view.guide.length<=3000);view=f.act(project,'remove_item',{itemId:view.items[0].id});assert.equal(view.items.length,39);throwsStatus(()=>f.act(project,'add_link',{requirementId:'video',label:'초과',url:'https://files.example.test/40'}),409);assert.equal(f.store.all('clientDeliveryDrafts')[0].items.length,40);
});
