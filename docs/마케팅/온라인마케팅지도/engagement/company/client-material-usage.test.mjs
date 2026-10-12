import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientMaterialsService} from './client-materials.mjs';
import {createClientMaterialUsageService} from './client-material-usage.mjs';
import {createClientRightsService} from './client-rights.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';
import {buildClientRightsReminders} from './client-rights-reminders.mjs';
import {createSynchronousReadScope} from './synchronous-read-scope.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),target='material:reference:'+id(2);
const rejects=(fn,code)=>assert.throws(fn,error=>error.status===code);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-material-usage-'));let store=new Store(directory),projects,materials,usage,rights;const now='2026-10-13T03:00:00Z',users={};
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-material-usage-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@usage.test',role,teamId});
  const init=()=>{projects=createClientProjectsService({store,clock:()=>now});materials=createClientMaterialsService({store,clientProjects:projects,clock:()=>now});usage=createClientMaterialUsageService({store,clientProjects:projects,clientMaterials:materials,clock:()=>now});rights=createClientRightsService({store,clientProjects:projects,clientMaterials:materials,clientMaterialUsage:usage,clock:()=>now});};init();
  const project=projects.save(users.owner,{title:'사용 구분 합성 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id}).project;
  store.put('clientProjects',project.id,{...project,studio:{assets:[],references:[{id:id(2),label:'허가 음악 참고',url:'https://example.test/music.mp3',at:now}],concepts:[],scenes:[],comments:[],sceneReviews:[],history:[]},versions:[{id:id(3),kind:'preview',label:'승인 시안',url:'https://example.test/preview.mp4',createdAt:now,approvedAt:now},{id:id(4),kind:'final',label:'등록 최종 영상',url:'https://example.test/final.mp4',createdAt:now,approvedPreviewId:id(3)}]});
  const row=()=>store.get('clientProjects',project.id),list=(name='owner')=>usage.workspace(users[name],project.id),input=(overrides={})=>{const data=list(),item=data.items.find(item=>item.targetId===target);return {expectedRevision:data.revision,projectRevision:data.projectRevision,contextFingerprint:data.contextFingerprint,targetId:target,sourceFingerprint:item.sourceFingerprint,status:'reference',...overrides};};
  const save=(overrides={},name='owner')=>usage.save(users[name],project.id,input(overrides));
  const allow=(targetId=target)=>{const data=rights.workspace(users.owner,project.id),item=data.items.find(item=>item.targetId===targetId);return rights.save(users.owner,project.id,{expectedRevision:data.revision,projectRevision:data.projectRevision,targetId,sourceFingerprint:item.sourceFingerprint,status:'allowed',scope:'합성 공개 범위',evidence:'PRIVATE-RIGHTS-EVIDENCE',agreedAt:'2026-10-01',expiryMode:'date',expiresAt:'2026-10-15'});};
  return {directory,users,id:project.id,row,list,input,save,allow,get store(){return store},get projects(){return projects},get materials(){return materials},get usage(){return usage},get rights(){return rights},reminders:()=>rights.reminders(users.owner,project.id),workflow:()=>createClientWorkflowService({store,clientProjects:projects,clientRights:rights,clock:()=>now}).workspace(users.owner),restart(){store.close();store=new Store(directory);init();}};
}

test('usage separates originals from fixed current finals, encrypts history and leaves project/customer records unchanged',async t=>{
  const f=await fixture(t),customer=f.projects.open(f.projects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite),before=JSON.stringify(f.row()),publicBefore=JSON.stringify(f.projects.read(customer.session));
  let data=f.list();assert.equal(data.hasDelivery,true);assert.equal(data.summary.total,1);assert.equal(data.summary.undecided,1);assert.equal(data.summary.currentFinals,1);assert.equal(data.items.find(item=>item.isCurrentFinal).status,'used');assert.equal(data.items.find(item=>item.isCurrentFinal).canEdit,false);
  data=f.save();assert.equal(data.revision,1);assert.equal(data.summary.reference,1);assert.equal(data.items[0].appliesToCurrent,true);assert.equal(data.items[0].record.actorName,'owner');assert.equal(JSON.stringify(f.row()),before);assert.equal(JSON.stringify(f.projects.read(customer.session)),publicBefore);assert.doesNotMatch(JSON.stringify(f.store.get('clientMaterialUsage',f.id)),/contextFingerprint|sourceFingerprint|reference/);for(const file of ['company.sqlite','company.sqlite-wal'])assert.equal((await readFile(join(f.directory,file)).catch(()=>Buffer.alloc(0))).includes(Buffer.from('contextFingerprint')),false);
  f.restart();assert.equal(f.list().summary.reference,1);assert.equal(f.list().revision,1);
});

test('only an explicit reference record removes a current material expiry; undecided and portfolio remain visible',async t=>{
  const f=await fixture(t);f.allow();f.allow('portfolio');assert.equal(f.reminders().items.length,2);f.save();assert.deepEqual(f.reminders().items.map(item=>item.targetId),['portfolio']);assert.equal(f.workflow().items.filter(item=>item.kind==='client_rights_expiry').length,1);const original=f.rights.workspace(f.users.owner,f.id).items.find(item=>item.targetId===target);assert.equal(original.referenceOnly,true);assert.equal(original.effectiveStatus,'allowed');assert.equal(original.record.evidence,'PRIVATE-RIGHTS-EVIDENCE');
  f.save({status:'used'});assert.equal(f.reminders().items.length,2);f.save({status:'undecided'});assert.equal(f.reminders().items.length,2);assert.equal(f.list().summary.undecided,1);rejects(()=>f.save({targetId:'portfolio'}),400);
  const data=f.rights.workspace(f.users.owner,f.id);for(const item of data.items)item.referenceOnly=true;assert.deepEqual(buildClientRightsReminders(data).items.map(item=>item.targetId),['portfolio']);
});

test('new final under the same approval invalidates reference classification and restores its unchanged rights reminder',async t=>{
  const f=await fixture(t);f.allow();f.save();const previous=f.input();assert.equal(f.reminders().items.length,0);const row=f.row();row.versions.push({id:id(5),kind:'final',label:'새 자막 파일',url:'https://example.test/final.srt',createdAt:'2026-10-13T04:00:00Z',approvedPreviewId:id(3)});row.revision++;f.store.put('clientProjects',f.id,row);let data=f.list();assert.equal(data.summary.stale,1);assert.equal(data.items[0].status,'undecided');assert.equal(data.items[0].record.status,'reference');assert.equal(f.reminders().items.length,1);rejects(()=>f.usage.save(f.users.owner,f.id,{...previous,projectRevision:row.revision}),409);f.save();data=f.list();assert.equal(data.summary.stale,0);assert.equal(f.reminders().items.length,0);
});

test('source replacement and missing delivery cannot inherit a previous reference classification',async t=>{
  const f=await fixture(t);f.allow();f.save();const previous=f.input(),row=f.row();row.studio.references[0].url='https://example.test/replaced.mp3';row.revision++;f.store.put('clientProjects',f.id,row);assert.equal(f.list().items[0].status,'undecided');assert.equal(f.list().items[0].stale,true);assert.equal(f.usage.reminderExclusions(f.users.owner,f.id).targets.length,0);rejects(()=>f.usage.save(f.users.owner,f.id,{...previous,projectRevision:row.revision}),409);f.save();assert.equal(f.list().summary.reference,1);
  delete row.versions[0].approvedAt;row.revision++;f.store.put('clientProjects',f.id,row);assert.equal(f.list().hasDelivery,false);assert.equal(f.list().canEdit,false);assert.equal(f.list().items[0].status,'undecided');assert.equal(f.list().summary.stale,1);rejects(()=>f.save(),409);
});

test('final-file aliases by link and stored media cannot be classified as reference originals',async t=>{
  const f=await fixture(t),row=f.row();row.studio.references[0].url=row.versions[1].url;row.revision++;f.store.put('clientProjects',f.id,row);assert.equal(f.list().items[0].isCurrentFinal,true);assert.equal(f.list().items[0].status,'used');rejects(()=>f.save(),409);rejects(()=>f.save({targetId:'material:version:'+id(4)}),400);
  const media={id:id(7),fileName:'원본최종.mp4',diskName:id(7)+'.mp4',mimeType:'video/mp4',byteSize:5};await mkdir(join(f.directory,'studio-media'));await writeFile(join(f.directory,'studio-media',media.diskName),'video');row.studio.assets=[{...media,at:'2026-10-13T00:00:00Z'}];row.versions[1].media=media;row.versions[1].url='';row.revision++;f.store.put('clientProjects',f.id,row);const data=f.list(),asset=data.items.find(item=>item.materialId==='asset:'+id(7));assert.equal(asset.isCurrentFinal,true);assert.equal(asset.canEdit,false);rejects(()=>f.save({targetId:asset.targetId,sourceFingerprint:asset.sourceFingerprint}),409);
});

test('current roles, project membership, reassignment and archived write protection are enforced',async t=>{
  const f=await fixture(t);for(const name of ['owner','manager','admin'])assert.equal(f.list(name).canEdit,true);for(const name of ['reviewer','viewer']){assert.equal(f.list(name).canEdit,false);rejects(()=>f.save({},name),403);}rejects(()=>f.list('other'),404);f.save();f.store.put('clientProjects',f.id,{...f.row(),stage:'archived'});assert.equal(f.list().canEdit,false);assert.equal(f.list().summary.reference,1);rejects(()=>f.save(),409);f.store.put('clientProjects',f.id,{...f.row(),stage:'delivered',ownerId:f.users.other.id,teamId:'b'});rejects(()=>f.list(),404);assert.equal(f.list('other').summary.reference,1);f.store.put('users',f.users.other.id,{...f.users.other,active:false});rejects(()=>f.list('other'),401);
});

test('revision, context, fingerprint and input guards preserve accepted history; identical current writes are idempotent',async t=>{
  const f=await fixture(t),old=f.input();f.save();rejects(()=>f.usage.save(f.users.owner,f.id,old),409);assert.equal(f.save().revision,1);
  for(const patch of [{status:'ignored'},{contextFingerprint:'b'.repeat(64)},{sourceFingerprint:'c'.repeat(64)},{expectedRevision:0},{projectRevision:0},{extra:'not allowed'},{targetId:'portfolio'}])rejects(()=>f.save(patch),['ignored'].includes(patch.status)||patch.projectRevision===0||patch.extra||patch.targetId?400:409);
  assert.equal(f.list().revision,1);const stale=f.input();f.store.put('clientProjects',f.id,{...f.row(),revision:f.row().revision+1});rejects(()=>f.usage.save(f.users.owner,f.id,stale),409);
});

test('hidden/deleted originals disappear without exposing their past classification and preparation-only projects stay read-only',async t=>{
  const f=await fixture(t);f.save();for(const patch of [{hidden:true},{hidden:false,deleted:true},{deleted:false,active:false}]){const row=f.row();Object.assign(row.studio.references[0],patch);f.store.put('clientProjects',f.id,row);assert.ok(!f.list().items.some(item=>item.targetId===target));assert.equal(f.usage.reminderExclusions(f.users.owner,f.id).targets.length,0);}
  const row=f.row();row.studio.references[0].active=true;row.versions=[];f.store.put('clientProjects',f.id,row);assert.equal(f.list().hasDelivery,false);assert.equal(f.list().canEdit,false);assert.equal(f.list().items[0].status,'undecided');rejects(()=>f.save(),409);f.store.put('clientProjects',f.id,{...row,hidden:true});rejects(()=>f.list(),404);
});

test('no usage records require no extra material scan; corrupted or over-capacity encrypted records fail closed',async t=>{
  const f=await fixture(t),service=createClientMaterialUsageService({store:f.store,clientProjects:f.projects,clientMaterials:{workspace(){throw new Error('Unexpected material read');}}});assert.deepEqual(service.reminderExclusions(f.users.owner,f.id).targets,[]);f.save();f.allow();let envelope=f.store.get('clientMaterialUsage',f.id),body=f.store.decrypt(envelope.ciphertext);body.records=Array.from({length:500},(_,n)=>({...body.records[0],id:id(n+100)}));body.revision=500;f.store.put('clientMaterialUsage',f.id,{...envelope,revision:500,ciphertext:f.store.encrypt(body)});rejects(()=>f.save({status:'used'}),409);assert.equal(f.list().revision,500);envelope=f.store.get('clientMaterialUsage',f.id);f.store.put('clientMaterialUsage',f.id,{...envelope,ciphertext:'corrupt'});rejects(()=>f.list(),500);rejects(()=>f.reminders(),500);
});

test('one composed rights read reuses the material index but the next scope observes changed usage, files and access',async t=>{
  const f=await fixture(t);f.allow();f.save();let reads=0;
  const counted={workspace(...args){reads++;return f.materials.workspace(...args);}},scope=createSynchronousReadScope();
  const plainUsage=createClientMaterialUsageService({store:f.store,clientProjects:f.projects,clientMaterials:counted,clock:()=> '2026-10-13T03:00:00Z'}),plainRights=createClientRightsService({store:f.store,clientProjects:f.projects,clientMaterials:counted,clientMaterialUsage:plainUsage,clock:()=> '2026-10-13T03:00:00Z'});
  assert.equal(plainRights.reminders(f.users.owner,f.id).items.length,0);assert.equal(reads,2);
  const materials=scope.service(counted,['workspace']),usage=scope.service(createClientMaterialUsageService({store:f.store,clientProjects:f.projects,clientMaterials:materials,clock:()=> '2026-10-13T03:00:00Z'}),['workspace','reminderExclusions']),rights=scope.service(createClientRightsService({store:f.store,clientProjects:f.projects,clientMaterials:materials,clientMaterialUsage:usage,clock:()=> '2026-10-13T03:00:00Z'}),['workspace','reminders']);
  const inspect=()=>{reads=0;const result=scope.run(()=>({reminders:rights.reminders(f.users.owner,f.id),rights:rights.workspace(f.users.owner,f.id),usage:usage.workspace(f.users.owner,f.id)}));assert.equal(reads,1);return result;};
  assert.equal(inspect().reminders.items.length,0);f.save({status:'used'});assert.equal(inspect().reminders.items.length,1);f.save();assert.equal(inspect().reminders.items.length,0);
  const row=f.row();row.versions.push({id:id(6),kind:'final',label:'새 최종 자막',url:'https://example.test/extra.srt',createdAt:'2026-10-13T04:00:00Z',approvedPreviewId:id(3)});row.revision++;f.store.put('clientProjects',f.id,row);const changed=inspect();assert.equal(changed.reminders.items.length,1);assert.equal(changed.usage.summary.stale,1);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});rejects(()=>scope.run(()=>rights.reminders(f.users.owner,f.id)),401);
});
