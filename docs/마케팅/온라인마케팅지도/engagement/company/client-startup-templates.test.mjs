import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientStartupService} from './client-startup.mjs';
import {createClientStartupTemplatesService,startupTemplateShift,startupTemplateOffset,normalizeStartupTemplate} from './client-startup-templates.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const status=(fn,value)=>assert.throws(fn,error=>error.status===value),referenceDate='2026-10-12';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-startup-templates-')),store=new Store(join(directory,'company'));
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-startup-templates-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@startup-template.test',role,teamId});
  const projects=createClientProjectsService({store}),templates=createClientStartupTemplatesService({store,clientProjects:projects}),startup=createClientStartupService({store,clientProjects:projects,templates});
  const project=projects.save(users.owner,{title:'원 프로젝트',customerName:'PRIVATE-CUSTOMER',contact:'PRIVATE-CONTACT',summary:'PRIVATE-SUMMARY',internalNotes:'PRIVATE-NOTE',dueDate:'2026-12-20'}).project,id=project.id,row=()=>store.get('clientProjects',id);
  const fixed=()=>startup.preview(users.owner,id,{action:'preview',revision:row().revision,presetId:'short_ad',referenceDate,calendar:'weekdays'});
  const capture=(extra={},user=users.owner)=>templates.capture(user,id,{action:'capture',revision:row().revision,referenceDate,calendar:'weekdays',sections:['kickoff','schedule','deliverables'],source:'draft',draft:fixed().draft,...extra});
  const save=(configuration=capture().configuration,extra={},user=users.owner)=>templates.mutate(user,id,{action:'save',revision:row().revision,templateId:null,expectedRevision:0,label:'내 합성 양식',configuration,...extra}).template;
  const preview=(template,extra={},target=id,user=users.owner)=>startup.preview(user,target,{action:'preview',revision:store.get('clientProjects',target).revision,presetId:'template:'+template.id,templateRevision:template.revision,referenceDate:'2026-11-02',calendar:'weekdays',...extra});
  const apply=(view,user=users.owner)=>startup.apply(user,view.projectId,{action:'apply',revision:view.revision,presetId:view.presetId,templateRevision:view.templateRevision,referenceDate:view.referenceDate,calendar:view.calendar,sections:Object.keys(view.sections).filter(key=>view.sections[key].available),draft:Object.fromEntries(Object.keys(view.sections).filter(key=>view.sections[key].available).map(key=>[key,view.draft[key]]))});
  return {directory,store,users,projects,templates,startup,id,row,fixed,capture,save,preview,apply};
}

test('capture and personal template save do not mutate a project and store only encrypted relative configuration',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),capture=f.capture(),template=f.save(capture.configuration,{label:'PRIVATE-TEMPLATE-LABEL'});assert.equal(JSON.stringify(f.row()),before);assert.equal(f.store.all('clientStartupTemplates').length,1);assert.deepEqual(capture.configuration.sections.schedule.offsets,{kickoff:0,preview:2,customer:3,revision:4,delivery:5});assert.doesNotMatch(JSON.stringify(capture.configuration),/2026-|PRIVATE-/);
  const raw=JSON.stringify(f.store.all('clientStartupTemplates'));assert.doesNotMatch(raw,/PRIVATE-TEMPLATE-LABEL|브랜드 로고|remainingWorkDays/);for(const name of ['company.sqlite','company.sqlite-wal']){const bytes=await readFile(join(f.directory,'company',name)).catch(()=>Buffer.alloc(0));assert.equal(bytes.includes(Buffer.from('PRIVATE-TEMPLATE-LABEL')),false);}assert.equal(f.templates.get(f.users.owner,template.id).label,'PRIVATE-TEMPLATE-LABEL');
});

test('current project capture strips source IDs, files, personal information, notes and every confirmation/history',async t=>{
  const f=await fixture(t),fixed=f.fixed();f.startup.apply(f.users.owner,f.id,{action:'apply',revision:fixed.revision,presetId:fixed.presetId,referenceDate,calendar:'weekdays',sections:['kickoff','schedule','deliverables'],draft:fixed.draft});let row=f.row();row.kickoffPlan.requirements[0].sourceKey='asset:PRIVATE-FILE';row.kickoffPlan.requirements[0].review={at:'PRIVATE-REVIEW'};row.kickoffPlan.requirements[0].waiver={reason:'PRIVATE-WAIVER'};row.studio.deliverables.items[0].notes='PRIVATE-ITEM-NOTE';row.studio.deliverables.notes='PRIVATE-SPEC-NOTE';row.studio.deliverables.confirmation={deliverableRevision:1};row.studio.deliverables.links=[{itemId:'PRIVATE-LINK'}];row.studio.strategy={data:{primaryPromise:'PRIVATE-STRATEGY'}};f.store.put('clientProjects',row.id,row);const before=JSON.stringify(f.row());
  const input={action:'capture',revision:row.revision,referenceDate,calendar:'weekdays',sections:['kickoff','schedule','deliverables'],source:'project'},captured=f.templates.capture(f.users.owner,f.id,input),text=JSON.stringify(captured.configuration);assert.doesNotMatch(text,/PRIVATE-|sourceKey|confirmation|waiver|"id"|history|2026-/);assert.equal(captured.configuration.sections.deliverables.notes,'');assert.equal(captured.configuration.sections.deliverables.items[0].notes,'');assert.match(captured.notes.join(' '),/메모는 가져오지/);assert.equal(JSON.stringify(f.row()),before);
});

test('explicitly edited reusable notes are retained but copied approval and source objects are rejected',async t=>{
  const f=await fixture(t),draft=f.fixed().draft;draft.deliverables.notes='직접 입력한 양식 메모';draft.deliverables.items[0].notes='편집 안내';const captured=f.capture({draft});assert.equal(captured.configuration.sections.deliverables.notes,'직접 입력한 양식 메모');assert.equal(f.save(captured.configuration).configuration.sections.deliverables.items[0].notes,'편집 안내');
  for(const change of [d=>d.kickoff.requirements[0].id='old',d=>d.kickoff.requirements[0].sourceKey='old',d=>d.kickoff.requirements[0].review={confirmed:true},d=>d.deliverables.confirmation={},d=>d.deliverables.items[0].id='old',d=>d.schedule.ownerId='old']){const bad=structuredClone(draft);change(bad);status(()=>f.capture({draft:bad}),400);}
});

test('positive and negative offsets recalculate weekdays and calendar dates with explicit weekend normalization',()=>{
  assert.equal(startupTemplateShift('2026-10-19',-1,'weekdays'),'2026-10-16');assert.equal(startupTemplateShift('2026-10-19',-1,'calendar'),'2026-10-18');assert.equal(startupTemplateShift('2026-10-17',0,'weekdays'),'2026-10-19');assert.equal(startupTemplateOffset('2026-10-17','2026-10-18','weekdays'),0);assert.equal(startupTemplateOffset('2026-10-19','2026-10-16','weekdays'),-1);assert.equal(startupTemplateShift('2028-02-28',2,'calendar'),'2028-03-01');assert.equal(startupTemplateShift('2026-10-12',null,'calendar'),'');
  for(const count of [-366,366,1.1,undefined])status(()=>startupTemplateShift(referenceDate,count,'calendar'),400);for(const date of ['2026-02-30','9999-12-31'])status(()=>startupTemplateShift(date,365,'weekdays'),400);
});

test('same personal template prepares two different projects without copying dates, agreements or source completion',async t=>{
  const f=await fixture(t),configuration=f.capture().configuration;configuration.sections.kickoff.dueOffset=-1;const template=f.save(configuration),other=f.projects.save(f.users.owner,{title:'두 번째',customerName:'다른 합성 고객',dueDate:'2026-12-30'}).project;
  const a=f.preview(template,{referenceDate:'2026-11-02'}),b=f.preview(template,{referenceDate:'2026-11-09'},other.id);assert.equal(a.draft.kickoff.dueDate,'2026-10-30');assert.equal(b.draft.kickoff.dueDate,'2026-11-06');assert.equal(a.draft.schedule.targets.delivery,'2026-11-09');assert.equal(b.draft.schedule.targets.delivery,'2026-11-16');assert.match(a.notes.join(' '),/마이너스/);
  f.apply(a);f.apply(b);for(const id of [f.id,other.id]){const row=f.store.get('clientProjects',id);assert.ok(row.kickoffPlan.requirements.every(item=>item.sourceKey===''&&!item.review&&!item.waiver));assert.equal(row.studio.deliverables.confirmation,null);assert.equal(row.studio.deliverables.request,null);assert.deepEqual(row.studio.deliverables.links,[]);assert.deepEqual(row.versions,[]);assert.deepEqual(row.messages,[]);}assert.equal(f.row().dueDate,'2026-12-20');assert.equal(f.store.get('clientProjects',other.id).dueDate,'2026-12-30');
});

test('a partial template never fills missing sections from fixed presets and existing configured sections are protected',async t=>{
  const f=await fixture(t),configuration={calendar:'calendar',sections:{kickoff:{dueOffset:0,requirements:[{label:'직접 준비한 자료',required:true}]}}},template=f.save(configuration),view=f.preview(template);assert.equal(view.sections.kickoff.available,true);assert.equal(view.sections.schedule.available,false);assert.equal(view.sections.deliverables.available,false);assert.deepEqual(view.draft.deliverables.items,[]);f.apply(view);const before=JSON.stringify(f.row());assert.equal(f.preview(template).sections.kickoff.available,false);status(()=>f.apply({...f.preview(template),sections:{...view.sections}}),409);assert.equal(JSON.stringify(f.row()),before);assert.equal(f.row().schedulePlan,undefined);assert.equal(f.row().studio,undefined);
});

test('template updates and deletion reject stale apply while preserving already-applied projects',async t=>{
  const f=await fixture(t),template=f.save(),view=f.preview(template),updated=f.save(template.configuration,{templateId:template.id,expectedRevision:1,label:'변경한 양식'});status(()=>f.apply(view),409);assert.equal(f.row().kickoffPlan,undefined);f.apply(f.preview(updated));const before=JSON.stringify(f.row());
  const other=f.projects.save(f.users.owner,{title:'후속 프로젝트',customerName:'합성'}).project,preview=f.preview(updated,{},other.id);f.templates.mutate(f.users.owner,f.id,{action:'delete',revision:f.row().revision,templateId:template.id,expectedRevision:2});status(()=>f.apply(preview),409);assert.equal(f.store.get('clientProjects',other.id).kickoffPlan,undefined);assert.equal(JSON.stringify(f.row()),before);assert.equal(f.templates.list(f.users.owner).length,0);assert.equal(f.store.get('clientStartupTemplates',f.users.owner.id+'|'+template.id).ciphertext,undefined);status(()=>f.save(template.configuration,{templateId:template.id,expectedRevision:2}),409);
});

test('template CAS prevents concurrent unseen replacement and separate accounts cannot guess or modify another template',async t=>{
  const f=await fixture(t),template=f.save();f.save(template.configuration,{templateId:template.id,expectedRevision:1,label:'먼저 저장'});status(()=>f.save(template.configuration,{templateId:template.id,expectedRevision:1,label:'늦게 저장'}),409);
  for(const name of ['manager','admin']){assert.deepEqual(f.templates.workspace(f.users[name],f.id).templates,[]);status(()=>f.templates.get(f.users[name],template.id),404);status(()=>f.save(template.configuration,{templateId:template.id,expectedRevision:2},f.users[name]),404);}status(()=>f.templates.workspace(f.users.other,f.id),404);status(()=>f.templates.workspace(f.users.viewer,f.id),403);
});

test('capture and save recheck project revision, current role, reassignment and archived status',async t=>{
  const f=await fixture(t),configuration=f.capture().configuration;status(()=>f.capture({revision:0}),409);const row=f.row();f.store.put('clientProjects',row.id,{...row,ownerId:f.users.other.id,teamId:'b'});status(()=>f.save(configuration),404);f.store.put('clientProjects',row.id,{...row,stage:'archived'});status(()=>f.save(configuration),409);f.store.put('clientProjects',row.id,row);f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});status(()=>f.save(configuration),403);f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.save(configuration),401);
});

test('unknown configuration fields, absolute dates, file payloads and malformed offsets never persist',async t=>{
  const f=await fixture(t),configuration=f.capture().configuration;for(const change of [c=>c.ownerId='other',c=>c.sections.kickoff.dueDate=referenceDate,c=>c.sections.kickoff.dueOffset=366,c=>c.sections.schedule.offsets.preview='2026-10-12',c=>c.sections.deliverables.items[0].media={file:'bytes'},c=>c.sections.deliverables.items[0].quantity=0,c=>c.sections.deliverables.notes='x'.repeat(2001)]){const invalid=structuredClone(configuration);change(invalid);status(()=>f.save(invalid),400);}assert.equal(f.store.all('clientStartupTemplates').length,0);status(()=>normalizeStartupTemplate({calendar:'calendar',sections:{}}),400);
});

test('fixed three presets remain available and template revision fields cannot be attached to fixed presets',async t=>{
  const f=await fixture(t);f.save();const catalog=f.startup.workspace(f.users.owner,f.id);assert.deepEqual(catalog.presets.slice(0,3).map(item=>item.id),['short_ad','product_intro','interview']);assert.equal(catalog.presets.length,4);assert.equal(catalog.presets[3].templateRevision,1);status(()=>f.startup.preview(f.users.owner,f.id,{action:'preview',revision:f.row().revision,presetId:'short_ad',templateRevision:1,referenceDate,calendar:'calendar'}),400);
});

test('existing workspace backup preserves personal template encryption, current revision and deleted tombstones',async t=>{
  const f=await fixture(t),active=f.save(),deleted=f.save(undefined,{label:'삭제 양식'});f.templates.mutate(f.users.owner,f.id,{action:'delete',revision:f.row().revision,templateId:deleted.id,expectedRevision:1});const messenger=join(f.directory,'messenger');await mkdir(messenger);const db=new DatabaseSync(join(messenger,'messenger.sqlite'));db.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE files (disk_name TEXT, storage_provider TEXT);');db.close();const path=await backupWorkspace({destination:join(f.directory,'backups'),companyDataDir:join(f.directory,'company'),messengerDataDir:messenger}),restored=new Store(join(path,'company'));
  try{const projects=createClientProjectsService({store:restored}),templates=createClientStartupTemplatesService({store:restored,clientProjects:projects});assert.deepEqual(templates.get(f.users.owner,active.id),active);status(()=>templates.get(f.users.owner,deleted.id),409);assert.equal(templates.list(f.users.admin).length,0);}finally{restored.close();}
});
