import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {workspaceAccess,workspaceProfileState,hasWorkspaceFeature,normalizeWorkspaceProfile} from './workspace-access.mjs';
import {createContentService} from './content-service.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createWorkspaceAccessService} from './workspace-access-service.mjs';
import {hash} from './store.mjs';

const profile=(...companies)=>({memberships:companies.map(company=>({company,role:{LAB:'teacher',PATH:'counselor',SHIFT:'instructor',PULSE:'producer'}[company]})),duties:[]});
async function fixture(t,{clock}={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-workspace-access-'));
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,...(clock?{clock}:{})});
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

test('stored assignment metadata is sanitized independently of suspended effective access',()=>{
  const stopped={active:false,role:'admin',workspaceProfile:{...profile('LAB','PULSE'),duties:['social'],revision:7,updatedBy:'private-audit-actor',updatedAt:'private-audit-time'}};
  assert.deepEqual(workspaceProfileState(stopped),{configured:true,revision:7,memberships:profile('LAB','PULSE').memberships,duties:['social']});
  assert.deepEqual(workspaceAccess(stopped),{configured:false,revision:0,memberships:[],duties:[],features:[],companies:[],admin:false,legacy:false});
  for(const feature of ['teaching','clients','social','lectures'])assert.equal(hasWorkspaceFeature(stopped,feature),false);
  assert.deepEqual(workspaceProfileState({...stopped,workspaceProfile:{revision:9,memberships:[{company:'UNKNOWN',role:'admin'}],duties:['all']}}),{configured:true,revision:9,memberships:[],duties:[]});
});

test('inactive member assignments retain stored roles and monotonic revisions without restoring access',async t=>{
  const {app,a,add,client}=await fixture(t),user=add('suspended','member',profile('LAB'));
  app.store.put('users',user.id,{...user,active:false,workspaceProfile:{...profile('LAB'),duties:['social'],revision:7,updatedBy:'private-audit-actor'}});
  const route='/api/members/'+user.id+'/workspace-profile';
  const member=(await a('/api/state')).data.members.find(row=>row.id===user.id);
  assert.equal(member.workspaceAccess.revision,7);
  assert.deepEqual(member.workspaceAccess.memberships,profile('LAB').memberships);
  assert.deepEqual(member.workspaceAccess.duties,['social']);
  assert.deepEqual(member.workspaceAccess.features,[]);
  assert.deepEqual(member.workspaceAccess.companies,[]);
  assert.deepEqual(member.organization.brands,['LAB']);
  assert.ok(!Object.hasOwn(member.workspaceAccess,'updatedBy'));
  assert.equal((await a(route,{revision:0,workspaceProfile:profile('PATH')})).status,409);
  const results=await Promise.all([
    a(route,{revision:7,workspaceProfile:profile('SHIFT')}),
    a(route,{revision:7,workspaceProfile:profile('PULSE')})
  ]);
  assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
  const saved=results.find(row=>row.status===200).data.access;
  assert.equal(saved.revision,8);
  assert.deepEqual(saved.features,[]);
  assert.deepEqual(saved.companies,[]);
  assert.equal(saved.admin,false);
  assert.deepEqual(app.store.get('users',user.id).workspaceProfile.memberships,saved.memberships);
  assert.equal(app.store.get('users',user.id).active,false);
  assert.equal((await client(user)('/api/state')).status,401);
  for(const revision of [0,7])assert.equal((await a(route,{revision,workspaceProfile:profile('LAB')})).status,409);
  const refreshed=(await a('/api/state')).data.members.find(row=>row.id===user.id);
  assert.equal(refreshed.workspaceAccess.revision,8);
  assert.deepEqual(refreshed.workspaceAccess.memberships,saved.memberships);
  const cleared=await a(route,{revision:8,workspaceProfile:{memberships:[],duties:[]}});
  assert.equal(cleared.status,200);
  assert.equal(cleared.data.access.revision,9);
  assert.deepEqual(cleared.data.access.memberships,[]);
  assert.equal((await a(route,{revision:8,workspaceProfile:profile('LAB')})).status,409);
  const final=app.store.get('users',user.id);
  app.store.put('users',user.id,{...final,active:true});
  assert.equal((await client(user)('/api/content-workspace')).status,403,'reactivating an explicitly cleared account cannot restore legacy access');
  const otherAdmin=add('other-admin','admin',profile('PULSE'));
  app.store.put('users',otherAdmin.id,{...otherAdmin,active:false});
  assert.equal((await a('/api/members/'+otherAdmin.id+'/workspace-profile',{revision:1,workspaceProfile:profile('LAB')})).status,403);
  assert.deepEqual(app.store.get('users',otherAdmin.id).workspaceProfile.memberships,profile('PULSE').memberships);
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
  const issue=async value=>{const before=Date.now(),result=await a('/api/members/invite',value);assert.equal(result.status,201);assert.equal(typeof result.data.code,'string');assert.ok(result.data.code.length>20);assert.equal(result.data.expiresInDays,3);assert.ok(Date.parse(result.data.expiresAt)>=before+3*86400000&&Date.parse(result.data.expiresAt)<=Date.now()+3*86400000);return result;};
  assert.equal((await ordinary('/api/members/invite',input)).status,403);
  assert.equal((await a('/api/members/invite',{...input,workspaceProfile:undefined})).status,400);
  assert.equal((await a('/api/members/invite',{...input,email:'invitee@@example.test'})).status,400);
  assert.equal(app.store.all('workspaceInvites').length,0);
  let result=await issue(input);
  assert.equal((await a('/api/members/invite',input)).status,409);
  assert.equal((await a('/api/workspace-invites/'+result.data.id+'/revoke',{})).status,200);
  assert.equal((await client()('/api/workspace-invite/inspect',{token:result.data.code})).status,403);
  result=await issue(input);
  app.store.db.prepare("UPDATE tokens SET expiresAt='2000-01-01T00:00:00.000Z' WHERE purpose='invite'").run();
  assert.equal((await client()('/api/join',{token:result.data.code,password:'synthetic-password-123'})).status,403);
  result=await issue({...input,email:'different@example.test'});
  const target=add('assignment-target','member',profile('PATH'));
  app.store.put('users',admin.id,{...admin,active:false});
  const usersBefore=app.store.all('users'),invitesBefore=app.store.all('workspaceInvites'),auditBefore=app.store.all('audit');
  assert.equal((await client()('/api/workspace-invite/inspect',{token:result.data.code})).status,403);
  assert.equal((await client()('/api/join',{token:result.data.code,password:'synthetic-password-123'})).status,403);
  assert.ok(!app.store.all('users').some(user=>user.email==='different@example.test'));
  assert.equal(app.store.get('workspaceInvites',result.data.id).status,'pending');
  assert.ok([401,403].includes((await a('/api/members/invite',{...input,email:'blocked@example.test'})).status));
  assert.ok([401,403].includes((await a('/api/members/'+target.id+'/workspace-profile',{revision:1,workspaceProfile:profile('LAB')})).status));
  assert.deepEqual(app.store.all('users'),usersBefore);assert.deepEqual(app.store.all('workspaceInvites'),invitesBefore);assert.deepEqual(app.store.all('audit'),auditBefore);
});

test('unexpired legacy invitations block duplicate company-profile invitations without changing either contract',async t=>{
  const {app,a,admin,client}=await fixture(t),email='legacy-pending@example.test';
  const code=app.store.mint('invite',null,{name:'Legacy pending',email,role:'member',teamId:null,invitedBy:admin.id},3*24*60);
  const before=app.store.readToken(code,'invite'),audits=app.store.all('audit');
  assert.equal((await client()('/api/workspace-invite/inspect',{token:code})).status,200);
  const duplicate=await a('/api/members/invite',{name:'New assignment',email,workspaceProfile:profile('LAB')});
  assert.equal(duplicate.status,409);
  assert.deepEqual(app.store.readToken(code,'invite'),before);
  assert.equal(app.store.all('workspaceInvites').length,0);assert.deepEqual(app.store.all('audit'),audits);
});

test('legacy invitations can be listed and explicitly revoked without exposing tokens or cancelling unrelated links',async t=>{
  const {app,a,admin,client,add}=await fixture(t),email='legacy-revoke@example.test',body={name:'Legacy revoke',email,role:'member',teamId:null,invitedBy:admin.id};
  const code=app.store.mint('invite',null,body,3*24*60),other=app.store.mint('invite',null,{...body,email:'unrelated-legacy@example.test'},3*24*60);
  const otherBefore=app.store.readToken(other,'invite'),before=app.store.db.prepare("SELECT COUNT(*) AS count FROM tokens WHERE purpose='invite'").get().count;
  const listing=await a('/api/workspace-invites'),entry=listing.data.invites.find(row=>row.email===email);
  assert.ok(entry);assert.equal(entry.status,'pending');assert.deepEqual(entry.memberships,[]);
  assert.ok(!JSON.stringify(listing.data).includes(code));assert.ok(!JSON.stringify(listing.data).includes(hash(code)));
  assert.ok(!Object.hasOwn(entry,'tokenHash'));assert.ok(!Object.hasOwn(entry,'invitedBy'));
  assert.equal(app.store.all('workspaceInvites').length,0,'listing does not migrate or mutate existing records');
  const ordinary=client(add('invite-reader','member',profile('LAB'))),route='/api/workspace-invites/'+entry.id+'/revoke';
  assert.equal((await ordinary('/api/workspace-invites')).status,403);assert.equal((await ordinary(route,{})).status,403);
  assert.ok(app.store.readToken(code,'invite'));
  assert.equal((await a(route,{})).status,200);assert.equal((await a(route,{})).status,409);
  assert.equal((await client()('/api/workspace-invite/inspect',{token:code})).status,403);
  assert.equal((await client()('/api/join',{token:code,password:'synthetic-password-123'})).status,403);
  assert.deepEqual(app.store.readToken(other,'invite'),otherBefore);
  assert.equal(app.store.db.prepare("SELECT COUNT(*) AS count FROM tokens WHERE purpose='invite'").get().count,before-1);
  const history=(await a('/api/workspace-invites')).data.invites.find(row=>row.id===entry.id);assert.equal(history.status,'revoked');
  assert.equal(history.email,email);assert.ok(app.store.all('audit').some(row=>row.action==='workspace-invite-revoked'&&row.subject===entry.id));
  const replacement=await a('/api/members/invite',{name:'Assigned employee',email,workspaceProfile:profile('LAB')});
  assert.equal(replacement.status,201);assert.equal(replacement.data.expiresInDays,3);
  assert.equal((await client()('/api/join',{token:replacement.data.code,password:'synthetic-password-123'})).status,201);
  const joined=app.store.all('users').find(row=>row.email===email);assert.equal(hasWorkspaceFeature(joined,'social'),false);assert.equal(hasWorkspaceFeature(joined,'clients'),false);
});

test('untouched legacy invitations keep their three-day expiry and legacy signup behavior',async t=>{
  const {app,a,admin,client}=await fixture(t),body={name:'Legacy compatibility',email:'legacy-compatible@example.test',role:'member',teamId:null,invitedBy:admin.id};
  const before=Date.now(),code=app.store.mint('invite',null,body,3*24*60),token=app.store.readToken(code,'invite');
  assert.ok(Date.parse(token.expiresAt)-before>=3*24*60*60000);assert.ok(Date.parse(token.expiresAt)-Date.now()<=3*24*60*60000);
  assert.equal((await client()('/api/join',{token:code,password:'synthetic-password-123'})).status,201);
  const joined=app.store.all('users').find(row=>row.email===body.email);assert.equal(workspaceAccess(joined).legacy,true);
  const email='expired-legacy@example.test',expired=app.store.mint('invite',null,{...body,email},3*24*60);
  app.store.db.prepare('UPDATE tokens SET expiresAt=? WHERE hash=?').run('2000-01-01T00:00:00.000Z',hash(expired));
  assert.equal((await client()('/api/workspace-invite/inspect',{token:expired})).status,403);
  assert.ok(!(await a('/api/workspace-invites')).data.invites.some(row=>row.email===email));
  assert.equal((await a('/api/members/invite',{name:'Replacement',email,workspaceProfile:profile('LAB')})).status,201);
});

test('all valid pending invitations remain visible while only closed history is limited to the newest hundred',async t=>{
  const {app,a,admin,client}=await fixture(t),service=createWorkspaceAccessService({store:app.store}),pending=[];
  for(let i=0;i<101;i++){
    const issued=service.issue(admin,{name:'Pending '+i,email:'pending-'+i+'@example.test',workspaceProfile:profile('LAB')});pending.push(issued);
    const row=app.store.get('workspaceInvites',issued.id);app.store.put('workspaceInvites',row.id,{...row,createdAt:'2020-01-01T00:00:00.000Z'});
  }
  for(let i=0;i<105;i++)app.store.put('workspaceInvites','closed-'+i,{id:'closed-'+i,email:'closed-'+i+'@example.test',name:'Closed '+i,role:'member',teamId:null,workspaceProfile:profile('PATH'),status:i%3===0?'accepted':i%3===1?'revoked':'pending',createdAt:new Date(Date.UTC(2021,0,1,0,i)).toISOString(),expiresAt:'2021-01-01T00:00:00.000Z'});
  const before=app.store.all('workspaceInvites'),result=(await a('/api/workspace-invites')).data.invites;
  assert.equal(result.length,201);assert.equal(result.filter(row=>row.status==='pending').length,101);
  assert.deepEqual(new Set(result.filter(row=>row.status==='pending').map(row=>row.id)),new Set(pending.map(row=>row.id)));
  assert.deepEqual(result.filter(row=>row.status!=='pending').map(row=>row.id),Array.from({length:100},(_,i)=>'closed-'+(104-i)));
  assert.deepEqual(app.store.all('workspaceInvites'),before,'response limit never deletes history');
  const oldest=result.find(row=>row.id===pending[0].id);assert.ok(oldest);
  assert.equal((await a('/api/members/invite',{name:'Duplicate',email:oldest.email,workspaceProfile:profile('PATH')})).status,409);
  assert.equal((await a('/api/workspace-invites/'+oldest.id+'/revoke',{})).status,200);
  assert.equal((await client()('/api/workspace-invite/inspect',{token:pending[0].code})).status,403);
});
test('direct APIs are denied by features, common tools stay available, profile edits revoke sessions',async t=>{
  const {app,a,add,client}=await fixture(t),path=add('path','member',profile('PATH')),p=client(path);
  const legacy=add('channel-legacy'),social=add('channel-social','member',{...profile('PATH'),duties:['social']});
  app.store.put('channels','shared-social',{id:'shared-social',platform:'youtube',displayName:'Synthetic shared channel',canonicalUrl:'https://www.youtube.com/@synthetic-shared',ownerIds:[path.id,legacy.id,social.id],active:true,status:'not-connected'});
  app.store.put('channels','other-social',{id:'other-social',platform:'youtube',displayName:'Synthetic other channel',canonicalUrl:'https://www.youtube.com/@synthetic-other',ownerIds:[],active:true,status:'not-connected'});
  assert.equal((await p('/api/workspace-summary')).status,200);
  for(const route of ['/api/content-workspace','/api/client-projects','/api/social/workspace','/api/teaching/session','/api/publication-workflow','/api/trial-feedback/results']){
    assert.equal((await p(route)).status,403,route);
  }
  assert.equal((await p('/api/state')).data.channels.length,0);
  assert.deepEqual((await client(legacy)('/api/state')).data.channels.map(row=>row.id),['shared-social']);
  assert.deepEqual((await client(social)('/api/state')).data.channels.map(row=>row.id),['shared-social']);
  assert.equal((await p('/api/members/'+path.id+'/workspace-profile',{revision:1,workspaceProfile:profile('PULSE')})).status,403);
  const changed=await a('/api/members/'+path.id+'/workspace-profile',{revision:1,workspaceProfile:profile('SHIFT','PULSE')});assert.equal(changed.status,200);
  assert.equal((await p('/api/workspace-access')).status,401);
  assert.equal((await a('/api/members/'+path.id+'/workspace-profile',{revision:1,workspaceProfile:profile('LAB')})).status,409);
  const fresh=client(path);assert.equal((await fresh('/api/company-work/SHIFT')).status,200);
  assert.equal((await fresh('/api/company-work/PATH')).status,403);
  assert.equal((await fresh('/api/client-projects')).status,200);
});
test('company work is isolated by company and owner, with revision conflicts and viewer protection',async t=>{
  const {app,add,client}=await fixture(t),one=client(add('one','member',profile('SHIFT','PATH','PULSE'))),two=client(add('two','member',profile('SHIFT'))),path=client(add('path','member',profile('PATH')));
  const created=await one('/api/company-work/SHIFT',{title:'강의 준비',date:'2026-11-20',note:'시험 자료'});assert.equal(created.status,201);
  const row=created.data.item;
  const pathCreated=await one('/api/company-work/PATH',{title:'상담 준비',note:'합성 상담 메모'});assert.equal(pathCreated.status,201);const pathRow=pathCreated.data.item;
  assert.deepEqual((await one('/api/company-work/PATH')).data.items.map(item=>item.id),[pathRow.id]);
  assert.equal((await one('/api/company-work/SHIFT')).data.items.length,1);
  assert.equal((await one('/api/company-work/PATH/'+row.id,{...row,title:'잘못된 회사'})).status,403);
  assert.equal((await one('/api/company-work/SHIFT/'+pathRow.id,{...pathRow,title:'잘못된 회사'})).status,403);
  assert.deepEqual(app.store.get('companyWork',row.id),row);assert.deepEqual(app.store.get('companyWork',pathRow.id),pathRow);
  const shiftManager=client(add('shift-manager','member',{memberships:[{company:'SHIFT',role:'manager'},{company:'PATH',role:'counselor'}],duties:[]}));
  const pathManager=client(add('path-manager','member',{memberships:[{company:'SHIFT',role:'instructor'},{company:'PATH',role:'manager'}],duties:[]}));
  assert.deepEqual((await shiftManager('/api/company-work/SHIFT')).data.items.map(item=>item.id),[row.id]);
  assert.equal((await shiftManager('/api/company-work/PATH')).data.items.length,0);
  assert.deepEqual((await pathManager('/api/company-work/PATH')).data.items.map(item=>item.id),[pathRow.id]);
  assert.equal((await pathManager('/api/company-work/SHIFT')).data.items.length,0);
  assert.equal((await pathManager('/api/company-work/SHIFT/'+row.id,{...row,title:'다른 회사 관리'})).status,403);
  assert.equal((await two('/api/company-work/SHIFT')).data.items.length,0);
  assert.equal((await path('/api/company-work/PATH')).data.items.length,0);
  assert.equal((await two('/api/company-work/SHIFT/'+row.id,{...row,status:'done'})).status,403);
  assert.equal((await one('/api/company-work/SHIFT/'+row.id,{...row,revision:0})).status,409);
  assert.equal((await one('/api/company-work/SHIFT/'+row.id,{...row,status:'done'})).status,200);
  const next=await one('/api/company-work/SHIFT',{title:'다음 강의 준비',date:'2026-12-01'});
  assert.deepEqual((await one('/api/company-work/SHIFT')).data.items.map(item=>item.id),[next.data.item.id,row.id]);
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
test('expired invitations reject stale cancellation without rewriting their history',async t=>{
  let at=new Date().toISOString();
  const {app,a}=await fixture(t,{clock:()=>at});
  const issued=await a('/api/members/invite',{name:'만료 합성 직원',email:'expired-cancel@example.test',workspaceProfile:profile('PATH')});
  assert.equal(issued.status,201);
  const id=issued.data.id,before=app.store.get('workspaceInvites',id),audit=app.store.all('audit');
  const token=app.store.db.prepare('SELECT * FROM tokens WHERE hash=?').get(before.tokenHash);
  for(const offset of [0,1]){
    at=new Date(Date.parse(before.expiresAt)+offset).toISOString();
    assert.equal((await a('/api/workspace-invites')).data.invites.find(row=>row.id===id).status,'expired');
    assert.equal((await a('/api/workspace-invites/'+id+'/revoke',{})).status,409);
    assert.deepEqual(app.store.get('workspaceInvites',id),before);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM tokens WHERE hash=?').get(before.tokenHash),token);
    assert.deepEqual(app.store.all('audit'),audit);
  }
});

test('legacy access does not grant new company work and assignment enables only its company',async t=>{
  const {app,add,client,a}=await fixture(t),user=add('legacy-company'),c=client(user),before=app.store.all('companyWork'),results=[];
  for(const company of ['PATH','SHIFT']){
    results.push({company,read:(await c('/api/company-work/'+company)).status,write:(await c('/api/company-work/'+company,{title:'미배정 합성 업무'})).status});
  }
  assert.deepEqual(results,[{company:'PATH',read:403,write:403},{company:'SHIFT',read:403,write:403}]);
  assert.deepEqual(app.store.all('companyWork'),before);
  assert.equal((await c('/api/content-workspace')).status,200);
  assert.equal((await a('/api/company-work/PATH',{title:'관리자 합성 업무'})).status,201);
  assert.equal((await a('/api/members/'+user.id+'/workspace-profile',{revision:0,workspaceProfile:profile('SHIFT')})).status,200);
  const assigned=client(user);
  assert.equal((await assigned('/api/company-work/SHIFT',{title:'배정된 합성 강의'})).status,201);
  assert.equal((await assigned('/api/company-work/SHIFT')).status,200);
  assert.equal((await assigned('/api/company-work/PATH')).status,403);
});

test('assigned social and pages duties skip unauthorized optional sources without hiding source failures',async t=>{
  const {app,add,client}=await fixture(t);
  for(const duty of ['social','pages']){
    const user=add('optional-'+duty,'member',{...profile('PATH'),duties:[duty]}),c=client(user);
    const social=await c('/api/social/workspace'),weekly=await c('/api/weekly-summary');
    assert.equal(social.status,200,duty+' opens SNS without client management');
    assert.deepEqual(social.data.clientSources,[]);
    assert.equal(weekly.status,200);
    assert.deepEqual(weekly.data.sections.filter(section=>section.status==='partial').map(section=>section.id),[],duty+' treats unassigned sources as empty');
    assert.equal((await c('/api/client-projects')).status,403);
    if(duty==='pages')assert.equal((await c('/api/content-workspace')).status,403);
  }
  const user=add('optional-clients','member',{...profile('PULSE'),duties:['social']}),c=client(user),read=app.clientProjects.workspace;
  app.clientProjects.workspace=()=>{throw new Error('synthetic optional-source failure');};
  try{
    const weekly=await c('/api/weekly-summary');
    assert.equal(weekly.status,200);
    assert.ok(weekly.data.sections.some(section=>section.status==='partial'),'an assigned source error is still reported');
  }finally{app.clientProjects.workspace=read;}
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

test('client assignments require current capabilities and public requests fall back to an eligible admin',async t=>{
  const {app,add,admin,a}=await fixture(t),clients=createClientProjectsService({store:app.store});
  const producer=add('producer','member',profile('PULSE')),shift=add('shift','member',profile('SHIFT'));
  const delegated=add('delegated','member',{...profile('LAB'),duties:['clients']}),viewer=add('viewer','viewer',profile('PULSE'));
  for(const user of [producer,shift,delegated,viewer])app.store.put('users',user.id,{...user,teamId:'synthetic-team'});
  const workspace=clients.workspace(admin);
  for(const list of [workspace.members,workspace.reviewers]){
    assert.ok(list.some(user=>user.id===producer.id));assert.ok(list.some(user=>user.id===delegated.id));
    assert.ok(!list.some(user=>user.id===shift.id));assert.ok(!list.some(user=>user.id===viewer.id));
  }
  const input={title:'합성 고객 의뢰',customerName:'합성 고객'};
  assert.throws(()=>clients.save(admin,{...input,ownerId:shift.id}),{status:403});
  assert.throws(()=>clients.save(admin,{...input,ownerId:producer.id,reviewerId:shift.id}),{status:403});
  assert.throws(()=>clients.save(admin,{...input,ownerId:producer.id,reviewerId:producer.id}),{status:403,message:'담당자와 검토자는 서로 다른 사람으로 골라 주세요.'});
  const existing=clients.save(admin,{...input,ownerId:producer.id,reviewerId:delegated.id}).project;
  app.store.put('pulseRequestSettings','main',{ownerId:producer.id});
  const result=await a('/api/members/'+producer.id+'/workspace-profile',{revision:1,workspaceProfile:profile('SHIFT')});
  assert.equal(result.status,200);assert.equal(result.data.warnings.length,2);
  assert.equal(app.store.get('clientProjects',existing.id).ownerId,producer.id,'existing assignments are preserved for admin review');
  for(const ownerId of [undefined,producer.id,shift.id,viewer.id]){
    const incoming=clients.createFromRequest({...input,ownerId});
    assert.equal(incoming.project.ownerId,admin.id);assert.ok(clients.project(admin,incoming.project.id));
  }
  assert.equal(clients.createFromRequest({...input,ownerId:delegated.id}).project.ownerId,delegated.id);
});
