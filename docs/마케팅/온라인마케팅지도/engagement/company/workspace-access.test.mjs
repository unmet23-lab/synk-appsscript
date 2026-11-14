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
async function fixture(t,{clock,isolated=false}={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-workspace-access-'));
  // isolated: 공통 초대 조회 시험은 바깥 의존을 모두 적는다 — 임시 자료 · 임시 메신저 자료 · 루프백 주소 · 꺼진 SYNK 신원 확인(직원 · 고객) · 기기 알림 · 업무 알림. 실제 외부 서비스를 부르지 않는다.
  const isolation=isolated?{messengerDataDir:join(dir,'messenger'),host:'127.0.0.1',origin:'http://127.0.0.1:0',synkIdentityConfig:null,synkCustomerIdentityConfig:null,webPushEnabled:false,workNotificationsEnabled:false}:{};
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,...(clock?{clock}:{}),...isolation});
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

// 공통 초대 조회(POST /api/invite/inspect) 시험 도구: 회사 DB의 모든 표와 total_changes, HTTP 결과, 생기면 안 되는 부수 호출을 본다.
function databaseState(app){
  const db=app.store.db,tables=db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(row=>row.name);
  return {changes:db.prepare('SELECT total_changes() AS count').get().count,tables:Object.fromEntries(tables.map(name=>[name,db.prepare(`SELECT * FROM [${name}]`).all().map(row=>JSON.stringify(row)).sort()]))};
}
function inviteLookup(app){
  const base='http://127.0.0.1:'+app.server.address().port;
  return async(input,{origin=app.origin,type='application/json',cookie='',query='',raw}={})=>{
    const response=await fetch(base+'/api/invite/inspect'+query,{method:'POST',headers:{...(origin===null?{}:{Origin:origin}),...(type?{'Content-Type':type}:{}),...(cookie?{Cookie:cookie}:{})},body:raw??JSON.stringify(input)});
    const text=await response.text();
    return {status:response.status,text,data:JSON.parse(text),cookie:response.headers.get('set-cookie'),cache:response.headers.get('cache-control')};
  };
}
function watchCalls(targets){
  const calls=[],undo=[];
  for(const [label,target,name]of targets){
    const original=target[name];assert.equal(typeof original,'function',label);
    target[name]=function(...args){calls.push(label);return original.apply(this,args);};
    undo.push(()=>{target[name]=original;});
  }
  return {calls,restore(){for(const step of undo.reverse())step();}};
}
test('common invite lookup classifies employee, legacy and customer invitations without writing, consuming or renewing anything',async t=>{
  const {app,a,admin,client}=await fixture(t,{isolated:true}),clients=createClientProjectsService({store:app.store}),lookup=inviteLookup(app),base='http://127.0.0.1:'+app.server.address().port;
  const employeeKind={version:1,kind:'employee',destination:'/'},customerKind={version:1,kind:'customer',destination:'/pulse-app/'};
  const issued=await a('/api/members/invite',{name:'Lookup employee',email:'lookup-employee@example.test',workspaceProfile:profile('PULSE')});assert.equal(issued.status,201);
  const legacy=app.store.mint('invite',null,{name:'Lookup legacy',email:'lookup-legacy@example.test',role:'member',teamId:null,invitedBy:admin.id},3*24*60);
  const created=clients.save(admin,{title:'합성 조회 프로젝트',customerName:'합성 조회 고객'}).project,invited=clients.invite(admin,created.id,{revision:created.revision});
  // A live customer session with a remembered device and a staff session ride along: nothing may be recovered, renewed or set.
  const opened=clients.open(invited.invite);
  const remembered=await fetch(base+'/pulse/api/remember-device',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json',Cookie:'synk_pulse_session='+opened.session,'X-Pulse-CSRF':opened.csrf},body:'{}'});
  await remembered.text();assert.equal(remembered.status,201);
  const device=/synk_pulse_device=([A-Za-z0-9_-]+)/.exec(remembered.headers.get('set-cookie')||'')?.[1];assert.ok(device);
  const cookie=['synk_company_session='+app.store.mint('session',admin.id,{csrfToken:'lookup-csrf'},10),'synk_pulse_session='+'A'.repeat(43),'synk_pulse_device='+device].join('; ');
  const before=databaseState(app);
  const watched=watchCalls([['messenger.disconnectRevoked',app.messenger,'disconnectRevoked'],['messenger.notifyCompanyUsers',app.messenger,'notifyCompanyUsers'],['deviceNotifications.revokeSession',app.deviceNotifications,'revokeSession'],['clientProjects.open',app.clientProjects,'open'],['clientProjects.openVerified',app.clientProjects,'openVerified'],['clientProjects.session',app.clientProjects,'session'],...['resume','touch','bind','remember','forget'].map(name=>['devices.'+name,app.clientProjects.devices,name])]);
  try{
    for(let round=0;round<3;round++)for(const [token,kind]of [[issued.data.code,employeeKind],[legacy,employeeKind],[invited.invite,customerKind]]){
      const result=await lookup({token},{cookie});
      assert.equal(result.status,200);assert.deepEqual(result.data,kind);assert.equal(result.cookie,null);assert.equal(result.cache,'no-store');
      for(const secret of [token,hash(token),'lookup-employee@example.test','Lookup employee','Lookup legacy','합성 조회 고객','합성 조회 프로젝트',created.id])assert.ok(!result.text.includes(secret));
    }
    assert.deepEqual(databaseState(app),before,'rows, tokens, sessions, devices and total_changes stay the same');
    assert.deepEqual(watched.calls,[],'no acceptance, session recovery, device, messenger or notification call');
    const health=await fetch(base+'/api/health');await health.text();
    assert.ok(watched.calls.includes('messenger.disconnectRevoked'),'the watcher does see an ordinary send() response');
  }finally{watched.restore();}
  // Revoked or reissued after a lookup: the existing acceptance paths check again and refuse the old codes.
  assert.equal((await a('/api/workspace-invites/'+issued.data.id+'/revoke',{})).status,200);
  const legacyEntry=(await a('/api/workspace-invites')).data.invites.find(row=>row.email==='lookup-legacy@example.test');
  assert.equal((await a('/api/workspace-invites/'+legacyEntry.id+'/revoke',{})).status,200);
  const reissued=await a('/api/members/invite',{name:'Lookup employee',email:'lookup-employee@example.test',workspaceProfile:profile('PULSE')});assert.equal(reissued.status,201);
  const replacement=clients.invite(admin,created.id,{revision:app.store.get('clientProjects',created.id).revision});
  const refused=[];
  for(const token of [issued.data.code,legacy,invited.invite]){const result=await lookup({token});assert.equal(result.status,403);assert.equal(result.cookie,null);assert.ok(!result.text.includes(token));refused.push(result.data);}
  assert.deepEqual(refused[1],refused[0]);assert.deepEqual(refused[2],refused[0]);
  const anonymous=client();
  for(const token of [issued.data.code,legacy])assert.equal((await anonymous('/api/join',{token,password:'synthetic-password-123'})).status,403);
  const reopened=await fetch(base+'/pulse/api/open',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({invite:invited.invite})});
  await reopened.text();assert.equal(reopened.status,401);assert.equal(reopened.headers.get('set-cookie'),null);
  assert.ok(!app.store.all('users').some(user=>['lookup-employee@example.test','lookup-legacy@example.test'].includes(user.email)));
  // A lookup is not acceptance: the replacements classify, join still consumes the new code once, and a consumed code stops classifying.
  assert.deepEqual((await lookup({token:replacement.invite})).data,customerKind);
  assert.deepEqual((await lookup({token:reissued.data.code})).data,employeeKind);
  assert.equal((await anonymous('/api/join',{token:reissued.data.code,password:'synthetic-password-123'})).status,201);
  assert.equal((await lookup({token:reissued.data.code})).status,403);
});
test('common invite lookup refuses expired, revoked, archived, stopped-issuer and doubly valid invitations alike and keeps storage failures distinct',async t=>{
  const {app,a,add,client,admin}=await fixture(t,{isolated:true}),lookup=inviteLookup(app);
  const clients=createClientProjectsService({store:app.store}),employees=createWorkspaceAccessService({store:app.store});
  const employeeKind={version:1,kind:'employee',destination:'/'},customerKind={version:1,kind:'customer',destination:'/pulse-app/'},kindOf=async token=>(await lookup({token})).data;
  const issue=async(name,via=a)=>{const result=await via('/api/members/invite',{name,email:name+'@example.test',workspaceProfile:profile('LAB')});assert.equal(result.status,201);return result.data;};
  const legacy=(name,extra={})=>app.store.mint('invite',null,{name,email:name+'@example.test',role:'member',teamId:null,invitedBy:admin.id,...extra},3*24*60);
  const customer=title=>{const created=clients.save(admin,{title,customerName:'합성 조회 고객'}).project;return clients.invite(admin,created.id,{revision:created.revision});};
  const stored=invited=>app.store.get('clientProjects',invited.project.id);
  const expire=code=>app.store.db.prepare('UPDATE tokens SET expiresAt=? WHERE hash=?').run('2000-01-01T00:00:00.000Z',hash(code));
  const cases=[];
  const expired=await issue('lookup-expired');assert.deepEqual(await kindOf(expired.code),employeeKind);expire(expired.code);cases.push(['employee expired',expired.code]);
  const revoked=await issue('lookup-revoked');assert.equal((await a('/api/workspace-invites/'+revoked.id+'/revoke',{})).status,200);cases.push(['employee revoked',revoked.code]);
  const issuer=add('lookup-issuer','admin'),stopped=await issue('lookup-stopped-issuer',client(issuer)),legacyOfStopped=legacy('lookup-legacy-of-stopped',{invitedBy:issuer.id});
  assert.deepEqual(await kindOf(stopped.code),employeeKind);app.store.put('users',issuer.id,{...app.store.get('users',issuer.id),active:false});cases.push(['employee issuer stopped',stopped.code]);
  const legacyExpired=legacy('lookup-legacy-expired');assert.deepEqual(await kindOf(legacyExpired),employeeKind);expire(legacyExpired);cases.push(['legacy expired',legacyExpired]);
  app.store.put('teams','lookup-team',{id:'lookup-team',name:'합성 조회 팀',active:true});const legacyTeam=legacy('lookup-legacy-team',{teamId:'lookup-team'});
  assert.deepEqual(await kindOf(legacyTeam),employeeKind);app.store.put('teams','lookup-team',{id:'lookup-team',name:'합성 조회 팀',active:false});cases.push(['team stopped',legacyTeam]);
  const expiredCustomer=customer('조회 만료 프로젝트');assert.deepEqual(await kindOf(expiredCustomer.invite),customerKind);
  app.store.put('clientProjects',expiredCustomer.project.id,{...stored(expiredCustomer),inviteExpiresAt:'2000-01-01T00:00:00.000Z'});cases.push(['customer expired',expiredCustomer.invite]);
  const revokedCustomer=customer('조회 취소 프로젝트');clients.revoke(admin,revokedCustomer.project.id,{revision:stored(revokedCustomer).revision});cases.push(['customer revoked',revokedCustomer.invite]);
  const archivedCustomer=customer('조회 보관 프로젝트');app.store.put('clientProjects',archivedCustomer.project.id,{...stored(archivedCustomer),stage:'archived'});cases.push(['customer archived',archivedCustomer.invite]);
  const rotatedCustomer=customer('조회 재발급 프로젝트');clients.invite(admin,rotatedCustomer.project.id,{revision:stored(rotatedCustomer).revision});cases.push(['customer reissued',rotatedCustomer.invite]);
  const doubly=customer('조회 중복 프로젝트');assert.deepEqual(await kindOf(doubly.invite),customerKind);
  app.store.db.prepare('INSERT INTO tokens VALUES (?,?,?,?,?)').run(hash(doubly.invite),'invite',null,JSON.stringify({name:'Lookup ambiguous',email:'lookup-ambiguous@example.test',role:'member',teamId:null,invitedBy:admin.id}),new Date(Date.now()+3600000).toISOString());
  assert.ok(employees.check(doubly.invite).invitation);assert.equal(clients.checkInvite(doubly.invite),true);
  cases.push(['valid for both kinds',doubly.invite],['unknown','A'.repeat(43)]);
  for(const [label,token]of cases.filter(([label])=>label!=='valid for both kinds')){assert.equal(employees.check(token).invitation,null,label);assert.equal(clients.checkInvite(token),false,label);}
  // The split check keeps inspect's existing errors, and the legacy contract is not tightened: its issuer is not rechecked.
  assert.throws(()=>employees.inspect(revoked.code),{status:403,message:'초대가 만료됐거나 이미 사용·취소됐어요.'});
  assert.throws(()=>employees.inspect(stopped.code),{status:403,message:'이 초대는 더 이상 사용할 수 없어요.'});
  assert.throws(()=>employees.inspect(legacyTeam),{status:403,message:'초대의 소속 팀이 운영을 멈췄어요. 새 초대를 받아 주세요.'});
  assert.deepEqual(await kindOf(legacyOfStopped),employeeKind);
  const before=databaseState(app),refused=[];
  for(const [label,token]of cases){const result=await lookup({token});assert.equal(result.status,403,label);assert.equal(result.cookie,null,label);assert.ok(!result.text.includes(token),label);refused.push(result.data);}
  for(const data of refused)assert.deepEqual(data,refused[0]);
  assert.deepEqual(Object.keys(refused[0]),['error']);
  assert.deepEqual(databaseState(app),before);
  app.store.db.prepare(`DELETE FROM tokens WHERE hash=? AND purpose='invite'`).run(hash(doubly.invite));
  assert.deepEqual(await kindOf(doubly.invite),customerKind,'only the ambiguity was refused');
  // Damaged storage is a failure, never the other kind: each side's damage blocks a lookup that the other side would have answered.
  const employeeCode=(await issue('lookup-storage')).code,customerCode=customer('조회 저장소 프로젝트').invite,logged=[],printError=console.error;
  console.error=(...args)=>{logged.push(args.map(String).join(' '));printError(...args);};
  try{
    app.store.db.prepare('INSERT INTO tokens VALUES (?,?,?,?,?)').run(hash(customerCode),'invite',null,'{damaged',new Date(Date.now()+3600000).toISOString());
    assert.throws(()=>employees.check(customerCode),SyntaxError);assert.throws(()=>employees.inspect(customerCode),SyntaxError);
    const damagedToken=await lookup({token:customerCode});
    app.store.db.prepare(`DELETE FROM tokens WHERE hash=? AND purpose='invite'`).run(hash(customerCode));
    app.store.db.prepare(`INSERT INTO documents(kind,id,body) VALUES ('clientProjects','lookup-damaged','{damaged')`).run();
    assert.throws(()=>clients.checkInvite(employeeCode),SyntaxError);assert.throws(()=>clients.open(employeeCode),SyntaxError);
    const damagedProject=await lookup({token:employeeCode});
    for(const [result,token]of [[damagedToken,customerCode],[damagedProject,employeeCode]]){
      assert.equal(result.status,500);assert.equal(result.cookie,null);assert.ok(!result.text.includes(token));
      assert.ok(!Object.hasOwn(result.data,'kind'));assert.notEqual(result.data.error,refused[0].error,'a storage failure is not reported as an invalid invitation');
    }
  }finally{console.error=printError;app.store.db.prepare(`DELETE FROM documents WHERE kind='clientProjects' AND id='lookup-damaged'`).run();}
  assert.ok(logged.some(line=>line.includes('REQUEST_FAILED')),'the failure is still reported');
  assert.ok(!logged.some(line=>line.includes(employeeCode)||line.includes(customerCode)),'the raw code never reaches the log');
  assert.deepEqual(await kindOf(employeeCode),employeeKind);assert.deepEqual(await kindOf(customerCode),customerKind);
});
test('common invite lookup takes only a small same-origin JSON token, no query or claimed kind, and limits failed attempts',async t=>{
  const {app,a}=await fixture(t,{isolated:true}),lookup=inviteLookup(app),base='http://127.0.0.1:'+app.server.address().port;
  const issued=await a('/api/members/invite',{name:'Lookup bounds',email:'lookup-bounds@example.test',workspaceProfile:profile('LAB')});assert.equal(issued.status,201);
  const code=issued.data.code,employeeKind={version:1,kind:'employee',destination:'/'},before=databaseState(app);
  const refusal=async(status,pending,label)=>{const result=await pending;assert.equal(result.status,status,label);assert.equal(result.cookie,null,label);assert.ok(!result.text.includes(code),label);assert.ok(!Object.hasOwn(result.data,'kind'),label);return result;};
  for(const query of ['','?token='+code]){const response=await fetch(base+'/api/invite/inspect'+query);const text=await response.text();assert.equal(response.status,405);assert.ok(!text.includes(code));}
  await refusal(400,lookup({token:code},{query:'?token='+code}),'query string');
  for(const origin of ['https://attacker.example','null',null])await refusal(403,lookup({token:code},{origin}),'origin '+origin);
  await refusal(400,lookup({token:code},{type:'text/plain'}),'content type');
  await refusal(400,lookup(null,{raw:'{token'}),'broken JSON');
  for(const input of [null,[],[code],{},{token:''},{token:42},{token:[code]},{token:'x'.repeat(201)},{token:code,kind:'customer'},{token:code,destination:'https://attacker.example/'},{token:code,returnTo:'/pulse-app/'}])await refusal(400,lookup(input),JSON.stringify(input).slice(0,60));
  for(const input of [{token:code,padding:'x'.repeat(4096)},{token:'x'.repeat(2048)}])await refusal(413,lookup(input),'large body');
  assert.deepEqual(databaseState(app),before);
  // Confirmed lookups give their reservation back and malformed requests never reserve; only failed lookups count, 30 per address in 15 minutes.
  for(let i=0;i<35;i++)assert.deepEqual((await lookup({token:code})).data,employeeKind);
  for(let i=0;i<30;i++){const token='unknown'+String(i).padStart(2,'0')+'x'.repeat(34),result=await lookup({token});assert.equal(result.status,403);assert.ok(!result.text.includes(token));}
  const limited=await refusal(429,lookup({token:code}),'rate limited');
  assert.equal(limited.data.code,'SYNK_RATE_LIMITED');
  assert.deepEqual(databaseState(app),before,'the limiter counts in memory only');
});
