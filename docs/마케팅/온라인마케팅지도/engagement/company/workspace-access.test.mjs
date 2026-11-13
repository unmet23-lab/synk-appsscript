import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {workspaceAccess,normalizeWorkspaceProfile} from './workspace-access.mjs';
import {createContentService} from './content-service.mjs';
import {createClientProjectsService} from './client-projects.mjs';

const profile=(...companies)=>({memberships:companies.map(company=>({company,role:{LAB:'teacher',PATH:'counselor',SHIFT:'instructor',PULSE:'producer'}[company]})),duties:[]});
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'synk-workspace-access-'));
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();await rm(dir,{recursive:true,force:true});});
  const add=(name,role='member',workspaceProfile)=>{const u=app.store.createUser({name,email:name+'@example.test',role});if(workspaceProfile)app.store.put('users',u.id,{...u,workspaceProfile:{...workspaceProfile,revision:1}});return app.store.get('users',u.id);};
  const admin=add('admin','admin');
  function client(user){
    let csrf='test-csrf',cookie=user?'synk_company_session='+app.store.mint('session',user.id,{csrfToken:csrf},10):'';
    return async(path,input)=>{
      const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf},...(input===undefined?{}:{body:JSON.stringify(input)})});
      if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
      const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;return {status:response.status,data};
    };
  }
  return {app,add,client,admin,a:client(admin)};
}
test('company roles and concurrent memberships are validated and cannot supply capabilities',()=>{
  const access=workspaceAccess({active:true,role:'member',workspaceProfile:{...profile('SHIFT','PULSE'),features:['teaching']}});
  assert.deepEqual(access.companies,['SHIFT','PULSE']);
  assert.ok(access.features.includes('lectures')&&access.features.includes('clients'));
  assert.ok(!access.features.includes('teaching'));
  for(const value of [profile(),{...profile('LAB'),memberships:[{company:'LAB',role:'admin'}]},profile('SHIFT','SHIFT'),{...profile('PATH'),duties:['all']}])assert.throws(()=>normalizeWorkspaceProfile(value));
  assert.deepEqual(workspaceAccess({active:true,role:'member',workspaceProfile:{broken:true}}).features,[]);
  for(const malformed of [null,false,0,'']){const bad=workspaceAccess({active:true,role:'member',workspaceProfile:malformed});assert.equal(bad.legacy,false);assert.deepEqual(bad.features,[]);}
});
test('invitation fixes company roles, can be inspected once, accepted atomically and never replayed',async t=>{
  const {app,a,client}=await fixture(t);
  const issued=await a('/api/members/invite',{name:'Concurrent',email:'concurrent@example.test',role:'member',workspaceProfile:profile('SHIFT','PULSE')});
  assert.equal(issued.status,201);
  const code=issued.data.code,anon=client();
  const inspected=await anon('/api/workspace-invite/inspect',{token:code});
  assert.deepEqual(inspected.data.memberships.map(row=>row.company),['SHIFT','PULSE']);
  assert.ok(!('invitation' in inspected.data));
  const input={token:code,password:'synthetic-password-123',workspaceProfile:profile('LAB'),role:'admin'};
  const results=await Promise.all([anon('/api/join',input),client()('/api/join',input)]);
  assert.deepEqual(results.map(row=>row.status).sort(),[201,403]);
  const saved=app.store.all('users').find(row=>row.email==='concurrent@example.test');
  assert.equal(saved.role,'member');assert.deepEqual(saved.workspaceProfile.memberships.map(row=>row.company),['SHIFT','PULSE']);
  assert.equal((await client()('/api/join',input)).status,403);
  const list=await a('/api/workspace-invites');assert.equal(list.data.invites[0].status,'accepted');
  assert.ok(!JSON.stringify(list.data).includes(code));assert.ok(!('tokenHash' in list.data.invites[0]));
});
test('only admin can issue or assign; pending invitations expire, revoke, and reject inactive issuer',async t=>{
  const {app,a,client,add,admin}=await fixture(t),ordinary=client(add('ordinary','member',profile('PATH')));
  const input={name:'Invitee',email:'invitee@example.test',workspaceProfile:profile('LAB')};
  assert.equal((await ordinary('/api/members/invite',input)).status,403);
  assert.equal((await a('/api/members/invite',{...input,workspaceProfile:undefined})).status,400);
  let result=await a('/api/members/invite',input);assert.equal(result.status,201);
  assert.equal((await a('/api/members/invite',input)).status,409);
  assert.equal((await a('/api/workspace-invites/'+result.data.id+'/revoke',{})).status,200);
  assert.equal((await client()('/api/workspace-invite/inspect',{token:result.data.code})).status,403);
  result=await a('/api/members/invite',input);
  app.store.db.prepare("UPDATE tokens SET expiresAt='2000-01-01T00:00:00.000Z' WHERE purpose='invite'").run();
  assert.equal((await client()('/api/join',{token:result.data.code,password:'synthetic-password-123'})).status,403);
  result=await a('/api/members/invite',{...input,email:'different@example.test'});
  app.store.put('users',admin.id,{...admin,active:false});
  assert.equal((await client()('/api/workspace-invite/inspect',{token:result.data.code})).status,403);
});
test('direct APIs are denied by features, common tools stay available, profile edits revoke sessions',async t=>{
  const {a,add,client}=await fixture(t),path=add('path','member',profile('PATH')),p=client(path);
  assert.equal((await p('/api/workspace-summary')).status,200);
  for(const route of ['/api/content-workspace','/api/client-projects','/api/social/workspace','/api/teaching/session','/api/publication-workflow','/api/trial-feedback/results']){
    assert.equal((await p(route)).status,403,route);
  }
  assert.equal((await p('/api/state')).data.channels.length,0);
  assert.equal((await p('/api/members/'+path.id+'/workspace-profile',{revision:1,workspaceProfile:profile('PULSE')})).status,403);
  const changed=await a('/api/members/'+path.id+'/workspace-profile',{revision:1,workspaceProfile:profile('SHIFT','PULSE')});assert.equal(changed.status,200);
  assert.equal((await p('/api/workspace-access')).status,401);
  assert.equal((await a('/api/members/'+path.id+'/workspace-profile',{revision:1,workspaceProfile:profile('LAB')})).status,409);
  const fresh=client(path);assert.equal((await fresh('/api/company-work/SHIFT')).status,200);
  assert.equal((await fresh('/api/company-work/PATH')).status,403);
  assert.equal((await fresh('/api/client-projects')).status,200);
});
test('company work is isolated by company and owner, with revision conflicts and viewer protection',async t=>{
  const {add,client}=await fixture(t),one=client(add('one','member',profile('SHIFT','PULSE'))),two=client(add('two','member',profile('SHIFT'))),path=client(add('path','member',profile('PATH')));
  const created=await one('/api/company-work/SHIFT',{title:'강의 준비',date:'2026-11-20',note:'시험 자료'});assert.equal(created.status,201);
  const row=created.data.item;
  assert.equal((await one('/api/company-work/SHIFT')).data.items.length,1);
  assert.equal((await two('/api/company-work/SHIFT')).data.items.length,0);
  assert.equal((await path('/api/company-work/PATH')).data.items.length,0);
  assert.equal((await two('/api/company-work/SHIFT/'+row.id,{...row,status:'done'})).status,403);
  assert.equal((await one('/api/company-work/SHIFT/'+row.id,{...row,revision:0})).status,409);
  assert.equal((await one('/api/company-work/SHIFT/'+row.id,{...row,status:'done'})).status,200);
  assert.equal((await one('/api/company-work/SHIFT',{title:'bad date',date:'2026-02-30'})).status,400);
  assert.equal((await client(add('viewer','viewer',profile('SHIFT')))('/api/company-work/SHIFT',{title:'denied'})).status,403);
});
test('legacy users retain their old access until explicitly assigned',async t=>{
  const {add,client,a}=await fixture(t),user=add('legacy'),c=client(user);
  assert.equal((await c('/api/content-workspace')).status,200);
  assert.equal((await c('/api/workspace-access')).data.access.legacy,true);
  assert.equal((await a('/api/members/'+user.id+'/workspace-profile',{revision:0,workspaceProfile:{memberships:[],duties:[]}})).status,200);
  assert.equal((await client(user)('/api/content-workspace')).status,403);
});
test('service calls used by shared cards recheck assigned features even with a stale caller',async t=>{
  const {app,add}=await fixture(t),user=add('author','member',profile('PULSE')),content=createContentService({store:app.store}),clients=createClientProjectsService({store:app.store});
  const draft=content.generate(user,{seriesId:'synkbrief-use',topic:'합성 시험 기획'}).draft;
  assert.ok(content.reviewShare(user,draft.id,[]).workspaceLink);
  app.store.put('users',user.id,{...user,workspaceProfile:{...profile('PATH'),revision:2}});
  assert.throws(()=>content.reviewShare(user,draft.id,[]),{status:403});
  assert.throws(()=>content.reviewRestore(user,draft.id,[]),{status:403});
  assert.throws(()=>clients.workspace(user),{status:403});
});
