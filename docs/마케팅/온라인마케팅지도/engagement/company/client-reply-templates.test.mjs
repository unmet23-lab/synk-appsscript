import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientReplyTemplatesService} from './client-reply-templates.mjs';
import {createClientSearchService} from './client-search.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const status=(fn,value)=>assert.throws(fn,error=>error.status===value),stamp='2026-10-12T13:00:00.000Z';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-reply-templates-')),store=new Store(join(directory,'company'));
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-reply-templates-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@reply-template.test',role,teamId});
  const projects=createClientProjectsService({store,clock:()=>stamp}),service=createClientReplyTemplatesService({store,clientProjects:projects,clock:()=>stamp});
  const project=projects.save(users.owner,{title:'첫 프로젝트',customerName:'합성 고객',contact:'SOURCE-CONTACT',summary:'SOURCE-REQUEST',internalNotes:'SOURCE-NOTES',reviewerId:users.reviewer.id,dueDate:'2026-11-02'}).project,id=project.id,row=()=>store.get('clientProjects',id);
  const input=(extra={})=>({action:'save',revision:row().revision,templateId:null,expectedRevision:0,label:'개인 답변',body:'{{고객명}}님, {{프로젝트명}}의 합의한 전달일은 {{합의한 전달일}}입니다.',...extra});
  const save=(extra={},user=users.owner)=>service.mutate(user,id,input(extra)).template;
  const preview=(template,extra={},user=users.owner,targetId=id)=>service.mutate(user,targetId,{action:'preview',revision:store.get('clientProjects',targetId).revision,templateId:template?.id||null,expectedRevision:template?.revision||0,target:'message',...extra});
  const remove=(template,extra={},user=users.owner)=>service.mutate(user,id,{action:'delete',revision:row().revision,templateId:template.id,expectedRevision:template.revision,...extra});
  const snapshot=()=>store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all();
  return {directory,store,users,projects,service,id,row,input,save,preview,remove,snapshot};
}

test('personal names and bodies are encrypted and save preview delete never change project history or customer messages',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),template=f.save({label:'PRIVATE-LABEL',body:'PRIVATE-BODY {{고객명}}'});
  assert.equal(template.revision,1);assert.equal(f.preview(template).preview.body,'PRIVATE-BODY 합성 고객');assert.deepEqual(f.service.workspace(f.users.owner,f.id).templates,[template]);
  assert.doesNotMatch(JSON.stringify(f.store.all('clientReplyTemplates')),/PRIVATE-|합성 고객|첫 프로젝트|SOURCE-/);
  for(const file of ['company.sqlite','company.sqlite-wal']){const bytes=await readFile(join(f.directory,'company',file)).catch(()=>Buffer.alloc(0));assert.equal(bytes.includes(Buffer.from('PRIVATE-BODY')),false);assert.equal(bytes.includes(Buffer.from('PRIVATE-LABEL')),false);}
  const deleted=f.remove(template).template;assert.equal(deleted.body,null);assert.equal(deleted.label,'');assert.equal(deleted.revision,2);assert.equal(f.store.all('clientReplyTemplates')[0].ciphertext,undefined);assert.deepEqual(f.service.workspace(f.users.owner,f.id).templates,[]);assert.equal(JSON.stringify(f.row()),before);
});

test('one reusable template resolves only server-current project values with no recursive substitution or source copying',async t=>{
  const f=await fixture(t),template=f.save(),second=f.projects.save(f.users.owner,{title:'다른 프로젝트',customerName:'{{프로젝트명}} 고객',dueDate:'2026-12-03'}).project,before=f.snapshot();
  assert.equal(f.preview(template).preview.body,'합성 고객님, 첫 프로젝트의 합의한 전달일은 2026-11-02입니다.');
  assert.equal(f.preview(template,{},f.users.owner,second.id).preview.body,'{{프로젝트명}} 고객님, 다른 프로젝트의 합의한 전달일은 2026-12-03입니다.');assert.deepEqual(f.snapshot(),before);
  const row=f.row();row.customerName='바뀐 합성 고객';row.revision++;f.store.put('clientProjects',row.id,row);assert.match(f.preview(template).preview.body,/바뀐 합성 고객/);assert.equal(f.service.workspace(f.users.owner,f.id).templates[0].body,template.body);
});

test('missing agreed date remains explicit and cannot be ready until the user removes or replaces its token',async t=>{
  const f=await fixture(t),template=f.save(),row=f.row();row.dueDate='';row.intake={requestedDeadline:'2026-11-20'};f.store.put('clientProjects',row.id,row);const before=f.snapshot(),view=f.preview(template).preview;
  assert.equal(view.ready,false);assert.deepEqual(view.missing,['{{합의한 전달일}}']);assert.match(view.body,/\{\{합의한 전달일\}\}/);assert.doesNotMatch(view.body,/2026-11-20/);
  const edited=f.preview(template,{body:'{{고객명}}님, 전달일은 다시 협의하겠습니다.'}).preview;assert.equal(edited.ready,true);assert.deepEqual(edited.missing,[]);assert.deepEqual(f.snapshot(),before);
  row.dueDate='2026-02-30';row.customerName='';row.title='';f.store.put('clientProjects',row.id,row);assert.deepEqual(f.preview(template).preview.missing,['{{고객명}}','{{프로젝트명}}','{{합의한 전달일}}']);
});

test('only fixed literal tokens and bounded plain text are accepted without expression or markup evaluation',async t=>{
  const f=await fixture(t),before=f.snapshot();for(const extra of [{label:''},{label:'x'.repeat(81)},{label:'a\n'},{body:' '},{body:'x'.repeat(6001)},{body:'a\u0000'},{body:'{{contact}}'},{body:'{{ 고객명 }}'},{body:'{{고객명}'},{body:'고객명}}'},{body:'{{{{고객명}}}}'},{body:'{{constructor.constructor()}}'},{ownerId:f.users.admin.id},{action:'send'},{expectedRevision:-1}])status(()=>f.save(extra),400);
  status(()=>f.save({revision:undefined}),409);status(()=>f.preview(null,{body:'안내',revision:undefined}),409);assert.deepEqual(f.snapshot(),before);
  const text='<script>throw 1</script>\nhttps://example.test/?q=$& {그대로}';assert.equal(f.preview(null,{body:text}).preview.body,text);assert.equal(f.save({label:'x'.repeat(80),body:'x'.repeat(6000)}).body.length,6000);
});

test('message and progress length limits are checked after substitution and never truncate prepared text',async t=>{
  const f=await fixture(t),long=f.save({body:'가'.repeat(3001)}),message=f.preview(long).preview,progress=f.preview(long,{target:'progress'}).preview;
  assert.equal(message.ready,false);assert.equal(message.tooLong,true);assert.equal(message.maxLength,3000);assert.equal(message.body.length,3001);assert.equal(progress.ready,true);assert.equal(progress.maxLength,30000);
  const row=f.row();row.title='가'.repeat(160);f.store.put('clientProjects',row.id,row);status(()=>f.preview(null,{target:'progress',body:'{{프로젝트명}}'.repeat(200)}),413);status(()=>f.preview(null,{target:'customer',body:'안내'}),400);
});

test('existing project edit ACL blocks reviewers viewers peers other teams inactive accounts and archived sources',async t=>{
  const f=await fixture(t);for(const name of ['owner','manager','admin'])assert.deepEqual(f.service.workspace(f.users[name],f.id).templates,[]);
  for(const [name,code]of [['reviewer',403],['viewer',403],['peer',404],['other',404]]){status(()=>f.service.workspace(f.users[name],f.id),code);status(()=>f.save({},f.users[name]),code);status(()=>f.preview(null,{body:'안내'},f.users[name]),code);}
  f.store.put('users',f.users.manager.id,{...f.users.manager,teamId:'b'});status(()=>f.save({},f.users.manager),404);
  f.store.put('clientProjects',f.id,{...f.row(),stage:'archived'});status(()=>f.service.workspace(f.users.owner,f.id),409);f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.save(),401);
});

test('other current project editors cannot list preview update or delete another account template by guessing its ID',async t=>{
  const f=await fixture(t),template=f.save();for(const name of ['manager','admin']){assert.deepEqual(f.service.workspace(f.users[name],f.id).templates,[]);status(()=>f.preview(template,{},f.users[name]),404);status(()=>f.save({templateId:template.id,expectedRevision:1},f.users[name]),404);status(()=>f.remove(template,{},f.users[name]),404);}
  const own=f.save({},f.users.manager);assert.notEqual(own.id,template.id);assert.deepEqual(f.service.workspace(f.users.owner,f.id).templates,[template]);
});

test('template CAS project revision and deleted tombstones reject stale previews and replacement',async t=>{
  const f=await fixture(t),template=f.save(),changed=f.save({templateId:template.id,expectedRevision:1,body:'수정한 문구'});assert.equal(changed.revision,2);status(()=>f.preview(template),409);status(()=>f.save({templateId:template.id,expectedRevision:1}),409);status(()=>f.remove(template),409);
  const row=f.row();row.revision++;f.store.put('clientProjects',row.id,row);status(()=>f.preview(changed,{revision:row.revision-1}),409);status(()=>f.save({revision:row.revision-1}),409);const deleted=f.remove(changed).template;assert.equal(deleted.revision,3);status(()=>f.preview(changed),409);status(()=>f.save({templateId:template.id,expectedRevision:3}),409);assert.equal(f.store.all('clientReplyTemplates')[0].ciphertext,undefined);
});

test('save rechecks current permissions inside the transaction before any personal write',async t=>{
  const f=await fixture(t),transaction=f.store.transaction.bind(f.store);f.store.transaction=fn=>transaction(()=>{f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});return fn();});status(()=>f.save(),403);assert.equal(f.store.all('clientReplyTemplates').length,0);
});

test('the fifty active template limit is per owner and deletion frees a slot without reviving old revisions',async t=>{
  const f=await fixture(t),rows=Array.from({length:50},(_,index)=>f.save({label:'문구 '+index}));status(()=>f.save(),409);assert.equal(f.service.workspace(f.users.owner,f.id).templates.length,50);assert.equal(f.save({},f.users.manager).revision,1);f.remove(rows[0]);assert.equal(f.save().revision,1);assert.equal(f.service.workspace(f.users.owner,f.id).templates.length,50);status(()=>f.preview(rows[0]),409);
});

test('damaged encryption and copied ciphertext fail visibly without leaking another template or pretending the list is empty',async t=>{
  const f=await fixture(t),a=f.save({body:'FIRST-PRIVATE'}),b=f.save({body:'SECOND-PRIVATE'}),key=f.users.owner.id+'|'+a.id,original=f.store.get('clientReplyTemplates',key),other=f.store.get('clientReplyTemplates',f.users.owner.id+'|'+b.id);
  f.store.put('clientReplyTemplates',key,{...original,ciphertext:other.ciphertext});status(()=>f.service.workspace(f.users.owner,f.id),500);status(()=>f.preview(a),500);f.store.put('clientReplyTemplates',key,{...original,ciphertext:'damaged'});status(()=>f.preview(a),500);
});

test('personal reusable bodies stay outside project search and are only projected in their owner workspace',async t=>{
  const f=await fixture(t);f.save({label:'검색비공개표식',body:'검색비공개표식 {{고객명}}'});const search=createClientSearchService({store:f.store,clientProjects:f.projects}),before=f.snapshot();for(const user of [f.users.owner,f.users.admin])assert.equal(search.search(user,{query:'검색비공개표식'}).total,0);assert.deepEqual(f.snapshot(),before);
});

test('workspace backup restores encrypted reusable bodies and deleted revision tombstones',async t=>{
  const f=await fixture(t),active=f.save(),deleted=f.save({label:'삭제할 문구'});f.remove(deleted);const messenger=join(f.directory,'messenger');await mkdir(messenger);const db=new DatabaseSync(join(messenger,'messenger.sqlite'));db.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE files (disk_name TEXT, storage_provider TEXT);');db.close();
  const location=await backupWorkspace({destination:join(f.directory,'backups'),companyDataDir:join(f.directory,'company'),messengerDataDir:messenger}),restored=new Store(join(location,'company'));
  try{const projects=createClientProjectsService({store:restored}),service=createClientReplyTemplatesService({store:restored,clientProjects:projects});assert.deepEqual(service.workspace(f.users.owner,f.id).templates,[active]);assert.deepEqual(service.workspace(f.users.admin,f.id).templates,[]);assert.equal(restored.get('clientReplyTemplates',f.users.owner.id+'|'+deleted.id).status,'deleted');assert.doesNotMatch(JSON.stringify(restored.all('clientReplyTemplates')),/합의한 전달일|개인 답변/);}finally{restored.close();}
});
