import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, dirname } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { Store } from './store.mjs';
import { createPostPerformanceService } from './post-performance.mjs';
import { ownerFirstAdmin, workspaceOwner, ensureWorkspaceOwnerAtBoot } from './workspace-owner.mjs';
import { createAdminRoleService } from './admin-role.mjs';

// 관리자 직접부여 설계 4 · 6절: 회사 주인, 관리자 올리기 · 내리기(④), 「첫 활성 관리자」 자리 넷.
const password='fixture-company-password-2026';
const ids={owner:'11111111-1111-4111-8111-111111111111',member:'22222222-2222-4222-8222-222222222222',other:'33333333-3333-4333-8333-333333333333'};
const tokens={owner:'synthetic-owner-access-token',member:'synthetic-member-access-token',other:'synthetic-other-access-token'};
const byToken=Object.fromEntries(Object.entries(tokens).map(([key,value])=>[value,ids[key]]));

async function fixture(t,{people=true}={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-admin-role-'));let stamp=Date.now();
  // 관리자 브라우저 로그인의 교환 직후 부르는 중앙 admin-reauth-claim. 기본은 bound:true · loginAt 지금이다.
  const claims=[];let claim=()=>Response.json({ok:true,bound:true,loginAt:new Date(stamp).toISOString()});
  const options={dataDir:dir,port:0,allowTestHost:true,schedule:false,
    synkIdentityConfig:{accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture-public',issuer:'https://identity.example.test',clientId:'messenger-browser'},
    synkIdentityVerifier:async value=>{if(!byToken[value])throw Object.assign(Error('rejected'),{status:401});return {synkUserId:byToken[value],expiresAt:stamp+3600_000};},
    synkIdentityFetch:async(url,init)=>{if(String(url).endsWith('/oauth/token'))return Response.json({access_token:tokens[new URLSearchParams(init.body).get('code')]});const body=JSON.parse(init.body);if(body.action==='admin-reauth-claim'){claims.push(body);return claim(body);}throw Error('no central call in this file');},
    synkIdentityNow:()=>stamp,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  let app=createCompanyApp(options),address=await app.start();
  t.after(async()=>{await app.stop();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});});
  const f={get app(){return app;},get store(){return app.store;},advance:ms=>stamp+=ms,claims,set claim(value){claim=value;},
    async restart(){await app.stop();app=createCompanyApp(options);address=await app.start();},
    link(user,key){app.store.db.prepare('INSERT INTO synk_identity_links VALUES(?,?,?,?)').run(ids[key],user.id,'fixture-link-'+key,new Date().toISOString());},
    client(){
      const jar=new Map();return {jar,csrf:'',async request(path,{body,origin=app.origin,csrf=this.csrf,method=body===undefined?'GET':'POST'}={}){
        const headers={Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')};
        if(method==='POST'){headers.Origin=origin;headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
        const response=await fetch(`http://127.0.0.1:${address.port}`+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
        for(const c of response.headers.getSetCookie()){const [name,value]=c.split(';')[0].split('=');if(value)jar.set(name,value);else jar.delete(name);}
        const data=await response.json().catch(()=>null);if(data?.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data,headers:response.headers};
      },
      async login(user){return this.request('/api/login',{body:{email:user.email,password}});},
      // 브라우저 SYNK ID 로그인(대화형). 돌아오면 /api/me로 CSRF를 받는다.
      async synk(key){
        const start=await this.request('/api/synk-id/start',{body:{action:'login',expectedAccountId:ids[key],returnTo:'admin'}});assert.equal(start.status,200);
        const state=new URL(start.data.authorizationUrl).searchParams.get('state');
        const back=await this.request('/api/synk-id/callback?state='+state+'&code='+key);assert.match(back.headers.get('location'),/^\/\?tab=admin&synkConnected=1$/);
        return this.request('/api/me');
      }};
    }};
  if(people){
    f.owner=app.store.createUser({name:'회사 주인',email:'owner@example.test',password,role:'admin'});
    f.member=app.store.createUser({name:'올릴 직원',email:'member@example.test',password,role:'member'});
    f.plain=app.store.createUser({name:'비밀번호만 쓰는 직원',email:'plain@example.test',password,role:'member'});
    app.store.put('teams','team-a',{id:'team-a',name:'합성 팀',active:true});
    f.link(f.owner,'owner');f.link(f.member,'member');
    await f.restart();
  }
  return f;
}
const role=(f,id,body)=>f.c.request(`/api/members/${id}/admin-role`,{body:{confirm:true,...body}});

test('boot records the single active administrator as owner, never several, and keeps an existing owner',async t=>{
  const f=await fixture(t);
  assert.deepEqual(Object.keys(f.store.get('settings','workspaceOwner')).sort(),['setAt','setBy','userId']);
  assert.equal(f.store.get('settings','workspaceOwner').userId,f.owner.id);assert.equal(f.store.get('settings','workspaceOwner').setBy,'boot');
  assert.equal(f.store.all('audit').filter(row=>row.action==='workspace-owner-set').length,1);
  const other=f.store.createUser({name:'다른 관리자',email:'other@example.test',password,role:'admin'});
  await f.restart();
  assert.equal(f.store.get('settings','workspaceOwner').userId,f.owner.id,'an existing owner survives more administrators');
  assert.equal(f.store.all('audit').filter(row=>row.action==='workspace-owner-set').length,1);
  f.store.remove('settings','workspaceOwner');await f.restart();
  assert.equal(f.store.get('settings','workspaceOwner'),null,'two active administrators leave the owner unset');
  assert.deepEqual(ensureWorkspaceOwnerAtBoot(f.store),{state:'ambiguous',adminCount:2});
  // 주인이 없으면 관리자 올리기 경로는 닫힌 채 실패한다.
  f.c=f.client();await f.c.synk('owner');
  const closed=await role(f,f.member.id,{admin:true,expectedRole:'member'});assert.equal(closed.status,403);assert.equal(closed.data.code,'OWNER_REQUIRED');
  assert.equal((await f.c.request('/api/state')).data.permissions.manageAdmins,false);
  assert.ok(other.id);
});

test('setup writes the owner in its transaction and settings rewrites keep it',async t=>{
  const f=await fixture(t,{people:false}),c=f.client();
  const setupToken=f.store.mint('setup',null,{},10);
  const created=await c.request('/api/setup',{body:{setupToken,companyName:'SYNK',name:'Owner',email:'setup-owner@example.test',password}});
  assert.equal(created.status,201);
  const owner=f.store.all('users')[0],doc=f.store.get('settings','workspaceOwner');
  assert.equal(doc.userId,owner.id);assert.equal(doc.setBy,'setup');
  assert.ok(f.store.all('audit').some(row=>row.action==='workspace-owner-set'&&row.via==='setup'));
  assert.equal((await c.request('/api/state')).data.permissions.manageAdmins,true);
  assert.equal((await c.request('/api/settings',{body:{companyName:'바뀐 회사',hourKst:9,enabled:true}})).status,200);
  assert.equal(f.store.get('settings','company').companyName,'바뀐 회사');
  assert.deepEqual(f.store.get('settings','workspaceOwner'),doc,'/api/settings rewrites company only');
});

test('only the owner on a recent browser SYNK ID login promotes; launch, password and stale sessions are refused',async t=>{
  const f=await fixture(t);
  const other=f.store.createUser({name:'다른 관리자',email:'other@example.test',password,role:'admin'});f.link(other,'other');
  const target={admin:true,expectedRole:'member'};
  // 주인이 아닌 관리자
  f.c=f.client();await f.c.synk('other');
  let result=await role(f,f.member.id,target);assert.equal(result.status,403);assert.equal(result.data.code,'OWNER_REQUIRED');
  assert.equal((await f.c.request('/api/state')).data.permissions.manageAdmins,false);
  // 회사 비밀번호 세션
  f.c=f.client();await f.c.login(f.owner);
  result=await role(f,f.member.id,target);assert.equal(result.status,403);assert.equal(result.data.code,'SYNK_LOGIN_REQUIRED');
  // 시작 링크 세션
  f.c=f.client();assert.equal((await f.c.request('/api/launch',{body:{token:f.store.mint('launch',f.owner.id,{},5)}})).status,200);
  result=await role(f,f.member.id,target);assert.equal(result.status,403);assert.equal(result.data.code,'SYNK_LOGIN_REQUIRED');
  // 일반 직원
  f.c=f.client();await f.c.login(f.member);
  assert.equal((await role(f,f.member.id,target)).status,403);
  // 주인 + 브라우저 로그인
  f.c=f.client();await f.c.synk('owner');
  assert.equal((await f.c.request('/api/state')).data.permissions.manageAdmins,true);
  assert.equal((await f.c.request(`/api/members/${f.member.id}/admin-role`,{csrf:'wrong',body:{...target,confirm:true}})).status,403);
  assert.equal((await f.c.request(`/api/members/${f.member.id}/admin-role?x=1`,{body:{...target,confirm:true}})).status,403);
  assert.equal((await f.c.request(`/api/members/${f.member.id}/admin-role`,{body:target})).data.code,'CONFIRM_REQUIRED');
  for(const body of [{admin:'yes',expectedRole:'member'},{admin:true,expectedRole:'owner'},{admin:true,expectedRole:'member',role:'admin'},{admin:false,expectedRole:'admin',role:'admin'},{admin:true,expectedRole:'member',extra:1}])
    assert.equal((await role(f,f.member.id,body)).data.code,'INVALID_ADMIN_ROLE_REQUEST',JSON.stringify(body));
  f.advance(15*60_000+1000);
  result=await role(f,f.member.id,target);assert.equal(result.status,409);assert.equal(result.data.code,'REAUTH_REQUIRED');
  assert.equal(f.store.get('users',f.member.id).role,'member');
});

test('promotion trusts only a SYNK ID login the central function bound as a real re-login',async t=>{
  const f=await fixture(t),target={admin:true,expectedRole:'member'};
  for(const [label,reply] of [['unbound',()=>Response.json({ok:true,bound:false})],['claim failed',()=>{throw Error('central down');}]]){
    f.claim=reply;const before=f.claims.length;
    f.c=f.client();await f.c.synk('owner');
    assert.equal(f.claims.length,before+1,label);
    assert.equal((await f.c.request('/api/state')).data.permissions.manageAdmins,true,label+': the owner still signs in');
    const result=await role(f,f.member.id,target);assert.equal(result.status,409,label);assert.equal(result.data.code,'REAUTH_REQUIRED',label);
  }
  f.claim=()=>Response.json({ok:true,bound:true,loginAt:new Date(Date.now()).toISOString()});
  f.c=f.client();await f.c.synk('owner');
  assert.equal((await role(f,f.member.id,target)).status,200,'a bound re-login opens promotion');
  assert.equal(f.store.get('users',f.member.id).role,'admin');
});

test('promotion needs a linked active target, the expected role and the daily limit; it ends the target sessions and alerts the owner',async t=>{
  const f=await fixture(t);
  const memberSession=f.client();await memberSession.login(f.member);assert.equal((await memberSession.request('/api/me')).data.user.id,f.member.id);
  f.c=f.client();await f.c.synk('owner');
  assert.equal((await role(f,f.owner.id,{admin:false,expectedRole:'admin',role:'member'})).data.code,'SELF_CHANGE');
  assert.equal((await role(f,f.plain.id,{admin:true,expectedRole:'member'})).data.code,'SYNK_ID_REQUIRED');
  assert.equal((await role(f,f.member.id,{admin:true,expectedRole:'viewer'})).data.code,'ROLE_CHANGED');
  assert.equal((await role(f,'missing-user',{admin:true,expectedRole:'member'})).status,404);
  const ok=await role(f,f.member.id,{admin:true,expectedRole:'member'});
  assert.equal(ok.status,200);assert.deepEqual(ok.data.member,{id:f.member.id,role:'admin',teamId:null});
  assert.equal(f.store.get('users',f.member.id).role,'admin');
  assert.equal((await memberSession.request('/api/me')).data.user,null,'the target signs in again');
  const granted=f.store.all('audit').find(row=>row.action==='admin-role-granted');
  assert.deepEqual([granted.userId,granted.subject,granted.before.role,granted.after.role],[f.owner.id,f.member.id,'member','admin']);
  const alert=f.store.all('ownerAlerts').find(row=>row.action==='admin-role-granted');assert.equal(alert.ownerId,f.owner.id);assert.match(alert.text,/관리자로 올렸어요/);
  // 하루 한 번
  f.link(f.plain,'other');
  const limited=await role(f,f.plain.id,{admin:true,expectedRole:'member'});assert.equal(limited.status,429);assert.equal(limited.data.code,'DAILY_LIMIT');
  assert.equal(f.store.get('users',f.plain.id).role,'member');
  // 올린 관리자는 회사 주인이 아니다.
  const promoted=f.client();await promoted.synk('member');
  assert.equal((await promoted.request('/api/state')).data.permissions.manageAdmins,false);
  assert.equal((await promoted.request(`/api/members/${f.plain.id}/admin-role`,{body:{admin:true,expectedRole:'member',confirm:true}})).data.code,'OWNER_REQUIRED');
  // 멈춘 직원은 올리지 않는다.
  for(const row of f.store.all('audit').filter(item=>item.action==='admin-role-granted'))f.store.put('audit',row.id,{...row,at:new Date(Date.now()-25*3600_000).toISOString()});
  f.store.put('users',f.plain.id,{...f.store.get('users',f.plain.id),active:false});
  assert.equal((await role(f,f.plain.id,{admin:true,expectedRole:'member'})).data.code,'TARGET_INACTIVE');
});

test('demotion keeps the owner and the last administrator, cancels viewer handoffs and warns about assignments',async t=>{
  const f=await fixture(t);
  const other=f.store.createUser({name:'다른 관리자',email:'other@example.test',password,role:'admin'});f.link(other,'other');
  f.store.put('pulseRequestSettings','main',{ownerId:other.id});
  f.store.put('clientProjects','project-1',{id:'project-1',title:'합성 의뢰',ownerId:other.id,reviewerId:null,stage:'producing',revision:1,versions:[],messages:[],history:[]});
  f.store.put('channels','channel-1',{id:'channel-1',displayName:'합성 채널',platform:'instagram',ownerIds:[f.owner.id],active:true,status:'not-connected',pendingHandoffId:'handoff-1'});
  f.store.put('handoffs','handoff-1',{id:'handoff-1',channelId:'channel-1',status:'awaiting-connection',toOwnerIds:[other.id],fromOwnerIds:[f.owner.id]});
  const otherSession=f.client();await otherSession.synk('other');
  f.c=f.client();await f.c.synk('owner');
  assert.equal((await role(f,other.id,{admin:false,expectedRole:'admin',role:'manager'})).data.code,'INVALID_ADMIN_ROLE_REQUEST','a team lead needs a team');
  assert.equal((await role(f,other.id,{admin:false,expectedRole:'admin',role:'member',teamId:'missing-team'})).status,400);
  const ok=await role(f,other.id,{admin:false,expectedRole:'admin',role:'viewer',teamId:'team-a'});
  assert.equal(ok.status,200);assert.deepEqual(ok.data.member,{id:other.id,role:'viewer',teamId:'team-a'});
  assert.equal(ok.data.warnings.length,2);
  assert.equal(f.store.get('handoffs','handoff-1').status,'cancelled');assert.equal(f.store.get('channels','channel-1').pendingHandoffId,null);
  assert.equal((await otherSession.request('/api/me')).data.user,null);
  const revoked=f.store.all('audit').find(row=>row.action==='admin-role-revoked');assert.deepEqual([revoked.before.role,revoked.after.role,revoked.after.teamId],['admin','viewer','team-a']);
  assert.ok(f.store.all('ownerAlerts').some(row=>row.action==='admin-role-revoked'));
  // 기존 assignment 경로는 다른 관리자를 여전히 못 바꾼다.
  const third=f.store.createUser({name:'세 번째 관리자',email:'third@example.test',password,role:'admin'});
  assert.equal((await f.c.request(`/api/members/${third.id}/assignment`,{body:{role:'member',teamId:'team-a'}})).status,403);
});

test('the last active administrator check stands on its own even when the owner guard would pass',()=>{
  const directory=mkdtempSync(join(tmpdir(),'synk-admin-role-unit-')),store=new Store(directory);
  try{
    store.db.exec('CREATE TABLE IF NOT EXISTS synk_identity_links (synk_user_id TEXT PRIMARY KEY, company_user_id TEXT NOT NULL UNIQUE, revision TEXT NOT NULL, linked_at TEXT NOT NULL)');
    const owner=store.createUser({name:'주인',email:'unit-owner@example.test',role:'admin'}),target=store.createUser({name:'대상',email:'unit-target@example.test',role:'admin'});
    store.put('settings','workspaceOwner',{userId:owner.id,setAt:new Date().toISOString(),setBy:'boot'});
    const all=store.all.bind(store);store.all=kind=>kind==='users'?all(kind).filter(row=>row.id!==owner.id):all(kind);
    const service=createAdminRoleService({store,recentInteractive:()=>true,teamFor:()=>null});
    const session={user:owner,body:{synkIdentity:ids.owner}};
    assert.throws(()=>service.change(session,target.id,{admin:false,expectedRole:'admin',role:'member',confirm:true}),error=>error.code==='LAST_ADMIN');
    assert.equal(store.get('users',target.id).role,'admin');
    assert.throws(()=>service.change({...session,body:{synkIdentity:ids.owner,via:'launch'}},target.id,{admin:false,expectedRole:'admin',role:'member',confirm:true}),error=>error.code==='SYNK_LOGIN_REQUIRED');
  }finally{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});}
});

test('the four first-administrator choices prefer the owner and fall back to the earliest administrator',async t=>{
  // 1) launch.mjs: 원천이 주인 우선 고르기를 쓴다(이 PC의 4191 서버를 띄우는 스크립트라 시험에서 돌리지 않는다).
  const launch=await readFile(new URL('./launch.mjs',import.meta.url),'utf8');
  assert.match(launch,/let admin=ownerFirstAdmin\(store,\(\)=>store\.all\('users'\)\.find\(u=>u\.role==='admin'&&u\.active\)\);/);
  const directory=mkdtempSync(join(tmpdir(),'synk-first-admin-')),store=new Store(directory);
  t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});
  const first={id:'admin-first',name:'먼저 만든 관리자',email:'first@example.test',role:'admin',active:true,createdAt:'2026-01-01T00:00:00.000Z'};
  const owner={id:'admin-owner',name:'회사 주인',email:'owner2@example.test',role:'admin',active:true,createdAt:'2026-02-01T00:00:00.000Z'};
  for(const user of [first,owner])store.put('users',user.id,user);
  assert.equal(ownerFirstAdmin(store,()=>first).id,'admin-first');
  store.put('settings','workspaceOwner',{userId:owner.id,setAt:owner.createdAt,setBy:'setup'});
  assert.equal(ownerFirstAdmin(store,()=>first).id,'admin-owner');
  store.put('users',owner.id,{...owner,active:false});assert.equal(workspaceOwner(store),null);assert.equal(ownerFirstAdmin(store,()=>first).id,'admin-first','a stopped owner falls back');
  store.put('users',owner.id,owner);
  // 2) post-performance.mjs 자동 등록의 등록자
  const at='2026-10-20T06:00:00.000Z';
  store.put('channels','yt',{id:'yt',platform:'youtube',handle:'synk',displayName:'yt',canonicalUrl:'https://example.invalid/yt',ownerIds:[first.id],active:true,connectionVersion:1,externalId:'UCabcdefghijklmnopqrstuv'});
  store.setSecret('channel:yt',{apiKey:'synthetic-key'});
  store.put('posts','yt:1',{id:'yt:1',channelId:'yt',externalId:'1',title:'post',url:'https://www.youtube.com/watch?v=shortsAAAAA',publishedAt:'2026-10-20T04:00:00.000Z',source:'api:youtube',unavailableAt:null});
  const service=createPostPerformanceService({store,clock:()=>at,collector:async()=>({posts:[],coverage:{}}),autoTrack:true});
  await service.collectDue();
  assert.deepEqual(store.all('postPerformanceEntries').map(row=>row.createdBy),['admin-owner']);
  service.stop?.();
  store.close();
  // 3) server.mjs 예약 수집의 요청자, 4) client-projects.mjs 새 공개 의뢰 담당
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED'],before=keys.map(key=>process.env[key]);
  process.env[keys[0]]='0';process.env[keys[1]]='1';
  const appDir=await mkdtemp(join(tmpdir(),'synk-first-admin-app-')),seed=new Store(appDir);
  for(const user of [first,owner])seed.put('users',user.id,user);
  seed.put('settings','company',{enabled:true,hourKst:0});
  seed.put('settings','workspaceOwner',{userId:owner.id,setAt:owner.createdAt,setBy:'setup'});
  seed.put('channels','lab',{id:'lab',platform:'youtube',canonicalUrl:'https://www.youtube.com/@lab',handle:'lab',ownerIds:[first.id],active:true,status:'not-connected'});
  seed.setSecret('collection:youtube-public',{clientId:'synthetic-client',clientSecret:'synthetic-secret',accessToken:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:new Date(Date.now()+3600000).toISOString(),connectedBy:first.id,channelIds:['lab']});seed.close();
  const app=createCompanyApp({dataDir:appDir,port:0,allowTestHost:true,channelCollectionEnabled:true,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,
    collector:async c=>({channel:{externalId:c.id,followers:0,views:1,metrics:{posts:0}},posts:[],coverage:{status:'complete',inventoryComplete:true,ownerAuthorized:false}}),dailyTrendsCollector:async()=>{throw Error('off');}});
  t.after(async()=>{await app.stop();for(let i=0;i<keys.length;i++)if(before[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=before[i];await rm(appDir,{recursive:true,force:true});});
  await app.start();await app.waitForIdle();
  const runs=app.store.all('runs');assert.ok(runs.length>=1);assert.ok(runs.every(row=>row.requestedBy==='admin-owner'),JSON.stringify(runs.map(row=>row.requestedBy)));
  const requested=title=>{app.clientProjects.createFromRequest({title,customerName:'합성 고객',contact:'',summary:'',dueDate:''});return app.store.all('clientProjects').find(row=>row.title===title).ownerId;};
  assert.equal(requested('새 의뢰'),'admin-owner');
  app.store.remove('settings','workspaceOwner');
  assert.equal(requested('두 번째 의뢰'),'admin-first');
});
