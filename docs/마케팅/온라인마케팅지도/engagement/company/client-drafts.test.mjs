import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDraftsService} from './client-drafts.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const status=(fn,value)=>assert.throws(fn,error=>error.status===value);
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'synk-client-drafts-')),directory=join(root,'company');let store=new Store(directory),projects,service;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.includes('synk-client-drafts-'));await rm(root,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@drafts.test',role,teamId});
  const init=()=>{projects=createClientProjectsService({store});service=createClientDraftsService({store,clientProjects:projects});};init();
  const project=projects.save(users.owner,{title:'개인 초안 시험',customerName:'합성 고객',reviewerId:users.reviewer.id,internalNotes:'UNCHANGED-SOURCE'}).project;
  const row=()=>store.get('clientProjects',project.id),list=(name='owner')=>service.list(users[name],project.id),slot=(type='message',name='owner')=>list(name).drafts.find(row=>row.kind===type);
  const save=(type='message',fields={text:'PERSONAL-UNSENT-DRAFT'},expectedRevision=0,sourceRevision=row().revision,name='owner')=>service.mutate(users[name],project.id,type,{action:'save',expectedRevision,sourceRevision,fields});
  return {root,directory,users,id:project.id,row,list,slot,save,get store(){return store},get service(){return service},get projects(){return projects},restart(){store.close();store=new Store(directory);init();}};
}

test('draft saves are private encrypted text and leave source, events, messages, approvals and workflow unchanged',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),marker='SYNTHETIC-DRAFT-NOT-CUSTOMER-VISIBLE';assert.equal(f.list().drafts.length,4);assert.ok(f.list().drafts.every(row=>row.status==='empty'&&row.revision===0&&row.fields===null));
  f.save('message',{text:marker,visibility:'customer'});f.save('project',{internalNotes:marker,nextStep:'개인 작성 중'});f.save('follow-up',{note:marker,disposition:'schedule',nextContactDate:'2026-11-10'});f.save('progress',{text:marker});assert.equal(JSON.stringify(f.row()),before);
  const raw=f.store.db.prepare('SELECT body FROM documents WHERE kind=?').all('clientDrafts');assert.equal(raw.length,4);assert.ok(raw.every(row=>!row.body.includes(marker)&&!row.body.includes('개인 작성 중')));for(const file of ['company.sqlite','company.sqlite-wal']){const bytes=await readFile(join(f.directory,file)).catch(()=>Buffer.alloc(0));assert.equal(bytes.includes(Buffer.from(marker)),false);}
  assert.equal(f.slot().fields.text,marker);assert.equal(f.slot().stale,false);
});

test('a stale source revision stays recoverable but is never applied to the project',async t=>{
  const f=await fixture(t),old=f.row().revision;f.save();const row=f.row();f.store.put('clientProjects',row.id,{...row,revision:row.revision+1,nextStep:'새 원문'});const current=JSON.stringify(f.row());
  assert.equal(f.slot().stale,true);assert.equal(f.slot().sourceRevision,old);assert.equal(f.save('message',{text:'계속 작성 중'},1,old).draft.stale,true);assert.equal(JSON.stringify(f.row()),current);status(()=>f.save('message',{text:'미래'},2,f.row().revision+1),400);
});

test('concurrent saves and deletion reject unseen revisions without overwriting either source or winning draft',async t=>{
  const f=await fixture(t);f.save();let conflict;try{f.save('message',{text:'SECOND-WINDOW'},0);}catch(error){conflict=error;}assert.equal(conflict.status,409);assert.equal(conflict.code,'CLIENT_DRAFT_CONFLICT');assert.equal(conflict.current.fields.text,'PERSONAL-UNSENT-DRAFT');
  status(()=>f.service.mutate(f.users.owner,f.id,'message',{action:'delete',expectedRevision:0}),409);assert.equal(f.slot().revision,1);
  const deleted=f.service.mutate(f.users.owner,f.id,'message',{action:'delete',expectedRevision:1});assert.equal(deleted.draft.revision,2);assert.equal(deleted.draft.status,'deleted');assert.equal(deleted.draft.fields,null);assert.equal(f.store.get('clientDrafts',f.users.owner.id+'|'+f.id+'|message').ciphertext,undefined);
  status(()=>f.save('message',{text:'LATE-SAVE'},1),409);assert.equal(f.slot().status,'deleted');assert.equal(f.save('message',{text:'새로 쓴 초안'},2).draft.revision,3);
});

test('administrator and same-team manager never receive another author draft',async t=>{
  const f=await fixture(t);f.save();for(const name of ['manager','admin']){assert.equal(f.slot('message',name).status,'empty');f.save('message',{text:name+' PRIVATE'},0,f.row().revision,name);assert.equal(f.slot('message',name).fields.text,name+' PRIVATE');}assert.equal(f.slot().fields.text,'PERSONAL-UNSENT-DRAFT');assert.equal(f.store.all('clientDrafts').length,3);
});

test('viewer and reviewer can keep their own progress copy but cannot create editable project drafts',async t=>{
  const f=await fixture(t);for(const name of ['viewer','reviewer']){assert.deepEqual(f.list(name).drafts.map(row=>row.kind),['progress']);status(()=>f.save('message',{text:'not allowed'},0,f.row().revision,name),403);assert.equal(f.save('progress',{text:'개인 안내문'},0,f.row().revision,name).draft.fields.text,'개인 안내문');}
  status(()=>f.list('other'),404);assert.equal(f.store.all('clientDrafts').length,2);
});

test('current role, team, project reassignment and deletion are rechecked before exposing stored drafts',async t=>{
  const f=await fixture(t);f.save();f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.deepEqual(f.list().drafts.map(row=>row.kind),['progress']);status(()=>f.save('message',{text:'blocked'},1),403);f.store.put('users',f.users.owner.id,f.users.owner);
  f.save('progress',{text:'viewer private'},0,f.row().revision,'viewer');f.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'b'});status(()=>f.list('viewer'),404);
  const row=f.row();f.store.put('clientProjects',row.id,{...row,ownerId:f.users.other.id,teamId:'b',reviewerId:null});status(()=>f.list(),404);status(()=>f.save('message',{text:'blocked'},1),404);f.store.remove('clientProjects',row.id);status(()=>f.list('admin'),404);assert.equal(f.store.all('clientDrafts').length,2);
});

test('archiving stops editable draft access and disabled users cannot restore even a private draft',async t=>{
  const f=await fixture(t);f.save();const row=f.row();f.store.put('clientProjects',row.id,{...row,stage:'archived'});assert.deepEqual(f.list().drafts.map(row=>row.kind),['progress']);status(()=>f.save('project',{internalNotes:'blocked'}),403);f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.list(),401);
});

test('whitelist excludes files, nested payloads, user IDs, stage and assignment controls while preserving literal text',async t=>{
  const f=await fixture(t);for(const [kind,fields]of [['message',{text:{file:'data:abc'}}],['message',{text:'ok',file:'data:abc'}],['project',{ownerId:f.users.other.id}],['project',{stage:'delivered'}],['project',{reviewerId:f.users.other.id}],['project',{internalNotes:'x'.repeat(3001)}],['message',{visibility:'public'}],['follow-up',{disposition:'finish'}],['follow-up',{nextContactDate:'2026-02-30'}],['progress',{text:'x'.repeat(30001)}]])status(()=>f.save(kind,fields),400);
  status(()=>f.service.mutate(f.users.owner,f.id,'message',{action:'save',expectedRevision:0,sourceRevision:1,fields:{text:'ok'},userId:f.users.other.id}),400);
  const text='<img src=x onerror=alert(1)>\n메모';assert.equal(f.save('message',{text}).draft.fields.text,text);assert.equal(f.store.all('clientDrafts').length,1);
});

test('restart restores active and deleted revisions without resurrecting deleted text',async t=>{
  const f=await fixture(t);f.save();f.save('project',{internalNotes:'삭제된 본문'});f.service.mutate(f.users.owner,f.id,'project',{action:'delete',expectedRevision:1});f.restart();assert.equal(f.slot().fields.text,'PERSONAL-UNSENT-DRAFT');assert.equal(f.slot('project').status,'deleted');assert.equal(f.slot('project').revision,2);status(()=>f.save('project',{internalNotes:'늦은 저장'},1),409);
});

test('ciphertext is bound to the author, project and form and corrupted payloads never leak',async t=>{
  const f=await fixture(t);f.save();const key=f.users.owner.id+'|'+f.id+'|message',row=f.store.get('clientDrafts',key);f.save('project',{internalNotes:'different form'});const other=f.store.get('clientDrafts',f.users.owner.id+'|'+f.id+'|project');f.store.put('clientDrafts',key,{...row,ciphertext:other.ciphertext});status(()=>f.list(),500);f.store.put('clientDrafts',key,{...row,ciphertext:'bad'});status(()=>f.list(),500);
});

test('existing workspace backup restores encrypted drafts and tombstones with the original key',async t=>{
  const f=await fixture(t);f.save();f.save('project',{internalNotes:'삭제된 초안'});f.service.mutate(f.users.owner,f.id,'project',{action:'delete',expectedRevision:1});
  const messenger=join(f.root,'messenger');await mkdir(messenger);const db=new DatabaseSync(join(messenger,'messenger.sqlite'));db.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE files (disk_name TEXT, storage_provider TEXT);');db.close();
  const backup=await backupWorkspace({destination:join(f.root,'backups'),companyDataDir:f.directory,messengerDataDir:messenger}),restored=new Store(join(backup,'company'));
  try{const projects=createClientProjectsService({store:restored}),service=createClientDraftsService({store:restored,clientProjects:projects}),view=service.list(f.users.owner,f.id);assert.equal(view.drafts.find(row=>row.kind==='message').fields.text,'PERSONAL-UNSENT-DRAFT');assert.equal(view.drafts.find(row=>row.kind==='project').status,'deleted');assert.equal(view.drafts.find(row=>row.kind==='project').fields,null);assert.equal(JSON.stringify(restored.get('clientProjects',f.id)),JSON.stringify(f.row()));assert.equal((await readFile(join(backup,'company/company.sqlite'))).includes(Buffer.from('PERSONAL-UNSENT-DRAFT')),false);}finally{restored.close();}
});
