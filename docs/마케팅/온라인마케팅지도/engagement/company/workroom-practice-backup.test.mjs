import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,cp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createCompanyApp} from './server.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';
import engine from '../../../../../atlas/personalization.js';
import temper from '../../../../../atlas/temper-outcomes.js';
import * as M from '../../../../../experiences/shift-workbench/model.mjs';

const endpoint='/api/workroom-practice/state';
const password='synthetic-backup-only-password';
const prefix='synk-shift-backup-rehearsal-';
const scope=id=>({personId:id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'});
const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const save=(state,expectedRevision=0,activate=true)=>({action:'save',expectedRevision,activate,state});
function completedPractice(id,marker){
  const at=n=>new Date(Date.now()-10000+n*1000).toISOString();
  let state=M.startRun(M.newState(),{task:'meeting',goal:'work',minutes:10,support:'independent'},engine,at(0),scope(id));
  state.save=true;state=M.recordPracticeExposure(state,at(1),scope(id));
  state.run.prompt=M.TASKS.meeting.template;state.run.draft=marker;
  for(const checkId of state.run.checkIds){const check=M.TASKS.meeting.checks.find(row=>row.id===checkId);state.run.answers[checkId]={kind:check.answer,source:check.source};}
  state.run.result=M.evaluate(state.run);state.run.reviewed=true;
  return M.completeRun(state,engine,at(2),scope(id));
}
function safeTemporary(root,target=root){
  const base=resolve(tmpdir()),actual=resolve(root),path=resolve(target);
  assert.ok(actual.startsWith(base+sep)&&actual.split(sep).at(-1).startsWith(prefix),'cleanup root must be this rehearsal temporary directory');
  assert.ok(path===actual||path.startsWith(actual+sep),'mutation must remain inside this rehearsal temporary directory');
  return path;
}
function envelope(result,revision,status){
  assert.equal(result.status,200,'expected a successful private state response');
  assert.equal(result.data.revision,revision);assert.equal(result.data.status,status);
  assert.deepEqual(Object.keys(result.data).sort(),['revision','state','status','updatedAt']);
  assert.match(result.headers.get('cache-control'),/no-store/);
  if(status==='deleted')assert.equal(result.data.state,null);
}
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),prefix));
  const apps=new Set(),sourceDir=join(root,'source','company');
  async function open(directory){
    const messengerDataDir=directory===sourceDir?join(sourceDir,'messenger'):join(directory,'..','messenger');
    safeTemporary(root,messengerDataDir);
    const app=createCompanyApp({dataDir:directory,messengerDataDir,port:0,allowTestHost:true,schedule:false,synkIdentityConfig:null});
    apps.add(app);const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
    async function login(user){
      let cookie='',csrf='';
      async function request(path=endpoint,body){
        const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
        const changed=response.headers.get('set-cookie');if(changed)cookie=changed.split(';')[0];
        const text=await response.text(),data=response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null;
        if(data?.csrfToken)csrf=data.csrfToken;
        return {status:response.status,text,data,headers:response.headers};
      }
      assert.equal((await request('/api/login',{email:user.email,password})).status,200,'restored local company credentials must authenticate through HTTP');
      return {request};
    }
    async function close(){if(apps.delete(app))await app.stop();}
    return {app,directory,login,close};
  }
  t.after(async()=>{for(const app of apps)await app.stop();await rm(safeTemporary(root),{recursive:true,force:true});});
  let source=await open(sourceDir);
  const users={};
  for(const role of ['active','deleted','admin'])users[role]=source.app.store.createUser({name:'Synthetic '+role,email:role+'@shift-backup.example.test',role:role==='admin'?'admin':'member',password});
  const markers={active:'synthetic-private-current-work-'+users.active.id,deleted:'synthetic-private-deleted-work-'+users.deleted.id};
  const states={active:completedPractice(users.active.id,markers.active),deleted:completedPractice(users.deleted.id,markers.deleted)};
  let active=await source.login(users.active),deleted=await source.login(users.deleted);
  envelope(await active.request(endpoint,save(states.active)),1,'active');
  envelope(await deleted.request(endpoint,save(states.deleted)),1,'active');
  await source.close();
  // Match the existing backup instruction: stop both hosts before final snapshot.
  const oldBackup=await backupWorkspace({destination:join(root,'old-backup'),companyDataDir:sourceDir,messengerDataDir:join(sourceDir,'messenger')});
  source=await open(sourceDir);active=await source.login(users.active);deleted=await source.login(users.deleted);
  envelope(await active.request(endpoint,save(states.active,1,false)),2,'active');
  envelope(await deleted.request(endpoint,{action:'delete',expectedRevision:1}),2,'deleted');
  const currentActive=(await active.request()).data,currentDeleted=(await deleted.request()).data;
  const activeRow=source.app.store.get('workroomPracticeSync',users.active.id),deletedRow=source.app.store.get('workroomPracticeSync',users.deleted.id);
  await source.close();
  const latestBackup=await backupWorkspace({destination:join(root,'latest-backup'),companyDataDir:sourceDir,messengerDataDir:join(sourceDir,'messenger')});
  async function copyRestore(name,backup=latestBackup){
    const target=join(root,name);await mkdir(target);await cp(join(backup,'company'),join(target,'company'),{recursive:true});await cp(join(backup,'messenger'),join(target,'messenger'),{recursive:true});
    const manifest=JSON.parse(await readFile(join(backup,'integration-manifest.json'),'utf8'));
    await writeFile(join(target,'company','workspace-integration.json'),JSON.stringify({messengerDataDir:join(target,'messenger'),identityLinks:manifest.identityLinks}),{mode:0o600});
    return join(target,'company');
  }
  return {root,sourceDir,users,states,markers,currentActive,currentDeleted,activeRow,deletedRow,latestBackup,oldBackup,open,copyRestore};
}

test('stopped workspace backup restores completed source lineage and a content-free deletion into new directories through real HTTP login',async t=>{
  const f=await fixture(t),directory=await f.copyRestore('successful-restore');
  assert.equal(await readFile(join(f.latestBackup,'COMPLETE'),'utf8'),'ok\n');
  assert.ok(digest(await readFile(join(directory,'encryption.key')))===digest(await readFile(join(f.sourceDir,'encryption.key'))),'the matching encryption key must travel with its DB');
  for(const path of [join(directory,'company.sqlite'),join(directory,'..','messenger','messenger.sqlite')]){
    const db=new DatabaseSync(path,{readOnly:true});try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
  }
  const restored=await f.open(directory),active=await restored.login(f.users.active),deleted=await restored.login(f.users.deleted);
  const work=await active.request(),removed=await deleted.request();envelope(work,2,'active');envelope(removed,2,'deleted');
  assert.ok(digest(work.data)===digest(f.currentActive),'latest authored text, original decision/completion lineage and timestamps must be identical');
  assert.ok(digest(removed.data)===digest(f.currentDeleted),'the deletion revision and timestamp must be identical');
  const recovered=M.restore(JSON.stringify(work.data.state),engine,scope(f.users.active.id),temper);
  assert.equal(recovered.history.length,1);assert.equal(recovered.evaluation.outcomes.length,1);
  assert.ok(recovered.events.some(row=>row.id===recovered.history[0].completionId&&row.type==='experience.completed'));
  assert.ok(recovered.events.some(row=>row.id===recovered.history[0].decisionId&&row.type==='decision.made'));
  assert.ok(digest(restored.app.store.get('workroomPracticeSync',f.users.active.id))===digest(f.activeRow),'encrypted payload must be copied without transformation');
  const tombstone=restored.app.store.get('workroomPracticeSync',f.users.deleted.id);
  assert.ok(digest(tombstone)===digest(f.deletedRow));assert.equal(Object.hasOwn(tombstone,'ciphertext'),false);
  const bytes=await readFile(join(directory,'company.sqlite'));for(const marker of Object.values(f.markers))assert.equal(bytes.includes(Buffer.from(marker)),false,'backup DB must contain no plaintext authored text');
});

test('restored current revisions reject stale saves, accept a fresh owned save and preserve deletion after another restart',async t=>{
  const f=await fixture(t),directory=await f.copyRestore('write-and-delete-restore');
  let restored=await f.open(directory),active=await restored.login(f.users.active),deleted=await restored.login(f.users.deleted);
  for(const activate of [false,true]){
    const staleActive=await active.request(endpoint,save(f.states.active,1,activate));assert.equal(staleActive.status,409);assert.equal(staleActive.data.current.revision,2);assert.equal(staleActive.data.code,'PRACTICE_CONFLICT');
    const staleDeleted=await deleted.request(endpoint,save(f.states.deleted,1,activate));assert.equal(staleDeleted.status,409);assert.equal(staleDeleted.data.current.revision,2);assert.equal(staleDeleted.data.code,'PRACTICE_DELETED');assert.equal(staleDeleted.data.current.state,null);
  }
  const changed=structuredClone(f.states.active);changed.run.draft='synthetic-new-authored-draft-after-restoration';
  envelope(await active.request(endpoint,save(changed,2,false)),3,'active');
  assert.ok((await active.request()).data.state.run.draft===changed.run.draft,'a current revision must remain writable after restoration');
  envelope(await active.request(endpoint,{action:'delete',expectedRevision:3}),4,'deleted');
  await restored.close();restored=await f.open(directory);active=await restored.login(f.users.active);deleted=await restored.login(f.users.deleted);
  envelope(await active.request(),4,'deleted');envelope(await deleted.request(),2,'deleted');
  const late=await active.request(endpoint,save(changed,3,false));assert.equal(late.status,409);assert.equal(late.data.current.state,null);
});

test('restored private practice is isolated from the other account and an administrator cannot choose its owner',async t=>{
  const f=await fixture(t),restored=await f.open(await f.copyRestore('ownership-restore'));
  for(const user of [f.users.deleted,f.users.admin]){
    const client=await restored.login(user),own=await client.request();envelope(own,user.id===f.users.deleted.id?2:0,user.id===f.users.deleted.id?'deleted':'empty');
    assert.equal(own.text.includes(f.markers.active),false);
    for(const query of ['?ownerId='+f.users.active.id,'?userId='+f.users.active.id]){
      const foreign=await client.request(endpoint+query);assert.equal(foreign.status,400);assert.equal(foreign.text.includes(f.markers.active),false);assert.equal(foreign.text.includes(f.activeRow.ciphertext),false);
    }
    assert.equal((await client.request(endpoint,save(f.states.active))).status,400,'restored foreign scope remains invalid');
    const picked=await client.request(endpoint,{...save(completedPractice(user.id,'synthetic-own-record-for-owner-validation')),ownerId:f.users.active.id});assert.equal(picked.status,400);
  }
  const active=await restored.login(f.users.active);assert.ok(digest((await active.request()).data)===digest(f.currentActive),'forbidden reads and writes must leave the owner record unchanged');
});

for(const keyCase of ['missing','wrong'])test(`${keyCase} restored encryption key fails safely without replacing or exposing the encrypted original`,async t=>{
  const f=await fixture(t),directory=await f.copyRestore(keyCase+'-key-restore'),key=join(directory,'encryption.key');
  if(keyCase==='missing')await rm(safeTemporary(f.root,key));else await writeFile(key,randomBytes(32),{mode:0o600});
  const logs=[];for(const method of ['log','warn','error'])t.mock.method(console,method,(...args)=>logs.push(args.map(String).join(' ')));
  if(keyCase==='missing'){
    const database=join(directory,'company.sqlite'),before=digest(await readFile(database));let failure;
    await assert.rejects(f.open(directory),error=>{failure=error;return error.code==='SYNK_ENCRYPTION_KEY_MISSING';});
    await assert.rejects(access(key),error=>error.code==='ENOENT','missing original key must not be replaced');
    assert.equal(digest(await readFile(database)),before,'startup rejection must not change the restored DB');
    for(const output of [failure.message,...logs]){
      for(const marker of Object.values(f.markers))assert.equal(output.includes(marker),false,'startup key errors must not expose authored content');
      assert.equal(output.includes(f.activeRow.ciphertext),false,'startup key errors must not expose encrypted content');
    }
    return;
  }
  const restored=await f.open(directory),active=await restored.login(f.users.active),deleted=await restored.login(f.users.deleted);
  const failed=await active.request();assert.equal(failed.status,500);assert.deepEqual(Object.keys(failed.data),['error']);assert.match(failed.data.error,/계정 저장 기록을 읽지 못했어요/);
  assert.match(failed.headers.get('cache-control'),/no-store/);
  envelope(await deleted.request(),2,'deleted');
  for(const output of [failed.text,...logs]){
    for(const marker of Object.values(f.markers))assert.equal(output.includes(marker),false,'key errors must not expose authored content');
    assert.equal(output.includes(f.activeRow.ciphertext),false,'key errors must not expose encrypted content');
  }
  assert.ok(digest(restored.app.store.get('workroomPracticeSync',f.users.active.id))===digest(f.activeRow),'a failed read must not replace the encrypted original');
});

test('a snapshot from before deletion can revive its old payload and revision; latest-DB restoration retains the tombstone',async t=>{
  const f=await fixture(t),old=await f.open(await f.copyRestore('pre-deletion-restore',f.oldBackup)),oldClient=await old.login(f.users.deleted);
  const resurrected=await oldClient.request();envelope(resurrected,1,'active');
  assert.ok(resurrected.data.state.run.draft===f.states.deleted.run.draft,'an old snapshot contains the content that was deleted later');
  envelope(await oldClient.request(endpoint,save(f.states.deleted,1,false)),2,'active');
  const current=await f.open(await f.copyRestore('latest-deletion-restore')),currentClient=await current.login(f.users.deleted);
  envelope(await currentClient.request(),2,'deleted');
  const stale=await currentClient.request(endpoint,save(f.states.deleted,1,false));assert.equal(stale.status,409);assert.equal(stale.data.code,'PRACTICE_DELETED');assert.equal(stale.data.current.state,null);
});

test('backupWorkspace refuses a source DB missing its key instead of producing a COMPLETE backup',async t=>{
  const f=await fixture(t),key=join(f.sourceDir,'encryption.key');await rm(safeTemporary(f.root,key));
  const destination=join(f.root,'missing-source-key-backup');
  await assert.rejects(backupWorkspace({destination,companyDataDir:f.sourceDir,messengerDataDir:join(f.sourceDir,'messenger')}),error=>error.code==='ENOENT');
  await assert.rejects(access(destination),error=>error.code==='ENOENT','a refused backup must not create any destination snapshot');
});

for(const choice of [
  {name:'integration-before-environment',integration:true,environment:true,explicit:false,expected:'integration'},
  {name:'explicit-option-before-integration-and-environment',integration:true,environment:true,explicit:true,expected:'explicit'},
  {name:'environment-without-integration',integration:false,environment:true,explicit:false,expected:'environment'},
  {name:'fallback-without-integration-or-environment',integration:false,environment:false,explicit:false,expected:'fallback'}
])test(`company host and backupWorkspace select the same messenger database: ${choice.name}`,async()=>{
  const root=await mkdtemp(join(tmpdir(),prefix)),companyDir=join(root,'company'),before=process.env.MESSENGER_DATA_DIR;
  const paths={integration:join(root,'integration-messenger'),environment:join(root,'environment-messenger'),explicit:join(root,'explicit-messenger'),fallback:join(companyDir,'messenger')};
  const seeded=[];let app;
  try{
    await mkdir(companyDir);
    for(const [name,directory] of Object.entries(paths)){
      safeTemporary(root,directory);const messenger=createMessenger({dataDir:directory,port:0});seeded.push(messenger);
      messenger.db.prepare('INSERT INTO channels (id,name,description,kind,pair_key,created_at) VALUES (?,?,?,?,?,?)').run('priority-'+name,'Priority '+name,'','channel',null,'2026-10-07');
      await messenger.close();seeded.pop();
    }
    if(choice.integration)await writeFile(join(companyDir,'workspace-integration.json'),JSON.stringify({messengerDataDir:paths.integration,identityLinks:[]}));
    if(choice.environment)process.env.MESSENGER_DATA_DIR=paths.environment;else delete process.env.MESSENGER_DATA_DIR;
    app=createCompanyApp({dataDir:companyDir,...(choice.explicit?{messengerDataDir:paths.explicit}:{}),host:'127.0.0.1',origin:'http://127.0.0.1:0',port:0,allowTestHost:true,schedule:false,synkIdentityConfig:null});
    const address=await app.start();assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/health`)).status,200);
    for(const name of Object.keys(paths))assert.equal(Boolean(app.messenger.db.prepare('SELECT id FROM channels WHERE id=?').get('priority-'+name)),name===choice.expected,'the started host must select the expected existing DB');
    await app.stop();app=null;
    const backup=await backupWorkspace({destination:join(root,'backups'),companyDataDir:companyDir,...(choice.explicit?{messengerDataDir:paths.explicit}:{})});
    assert.equal(await readFile(join(backup,'COMPLETE'),'utf8'),'ok\n');
    const restored=new DatabaseSync(join(backup,'messenger','messenger.sqlite'),{readOnly:true});
    try{for(const name of Object.keys(paths))assert.equal(Boolean(restored.prepare('SELECT id FROM channels WHERE id=?').get('priority-'+name)),name===choice.expected,'backup must preserve the same DB selected by the started company host');}
    finally{restored.close();}
  }finally{
    await app?.stop();for(const messenger of seeded)await messenger.close();
    if(before===undefined)delete process.env.MESSENGER_DATA_DIR;else process.env.MESSENGER_DATA_DIR=before;
    await rm(safeTemporary(root),{recursive:true,force:true});
  }
});
