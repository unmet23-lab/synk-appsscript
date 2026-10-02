import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { Store, today } from './store.mjs';
import { ownerAt } from './organization.mjs';
import { shiftDate } from '../analytics.mjs';

const password='organization-test-password';
const denied=response=>assert.ok(response.status>=400&&response.status<500,`expected denied request, received ${response.status}`);

async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'synk-server-organization-'));
  const collected=[];
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,collector:async c=>{
    collected.push(c.id);
    return{channel:{externalId:c.id,followers:7},posts:[],coverage:{status:'complete'},warnings:[]};
  }});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(dir,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',password,role:'admin'});
  const team=(id,name=id)=>app.store.put('teams',id,{id,name,active:true,createdAt:new Date().toISOString()});
  const employee=(id,role='member',teamId=null)=>app.store.createUser({name:id,email:`${id}@example.test`,password,role,teamId});
  function client(person){
    let csrf=person?'fixture-csrf':'',cookie=person?`synk_company_session=${app.store.mint('session',person.id,{csrfToken:csrf},10)}`:'';
    return async(path,body)=>{
      const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
      const data=await res.json();if(data?.csrfToken)csrf=data.csrfToken;
      return{status:res.status,data};
    };
  }
  const a=client(admin);
  const add=async(handle,ownerId=admin.id,teamId=null)=>{
    const response=await a('/api/channels',{urls:`https://youtube.com/@${handle}`,ownerId,teamId});
    assert.equal(response.status,201);assert.equal(response.data.added.length,1);
    return response.data.added[0];
  };
  return{app,dir,admin,a,team,employee,client,add,collected};
}

test('only admins manage teams and assignments; role changes revoke old employee sessions',async t=>{
  const {app,a,admin,employee,client}=await fixture(t);
  assert.equal((await a('/api/teams',{name:'Marketing'})).status,201);
  const marketing=app.store.all('teams').find(row=>row.name==='Marketing');assert.ok(marketing);
  assert.equal((await a(`/api/teams/${marketing.id}`,{name:'Growth',active:true})).status,200);
  assert.equal(app.store.get('teams',marketing.id).name,'Growth');
  const manager=employee('manager','manager',marketing.id),m=client(manager);
  denied(await m('/api/teams',{name:'Not allowed'}));
  denied(await m(`/api/teams/${marketing.id}`,{name:'Not allowed',active:false}));
  const member=employee('member'),staff=client(member);
  denied(await m(`/api/members/${member.id}/assignment`,{role:'viewer',teamId:marketing.id}));
  denied(await a(`/api/members/${member.id}/assignment`,{role:'manager',teamId:null}));
  denied(await a(`/api/members/${member.id}/assignment`,{role:'invalid',teamId:marketing.id}));
  denied(await a(`/api/members/${admin.id}/assignment`,{role:'member',teamId:marketing.id}));
  assert.equal((await a(`/api/members/${member.id}/assignment`,{role:'viewer',teamId:marketing.id})).status,200);
  assert.equal((await staff('/api/state')).status,401);
  const changed=app.store.get('users',member.id);assert.equal(changed.role,'viewer');assert.equal(changed.teamId,marketing.id);
  assert.equal((await staff('/api/login',{email:member.email,password})).status,200);
  const state=await staff('/api/state');assert.equal(state.data.user.role,'viewer');assert.equal(state.data.permissions.readOnly,true);
  assert.equal((await a('/api/teams',{name:'Unused'})).status,201);
  const unused=app.store.all('teams').find(row=>row.name==='Unused');
  assert.equal((await a(`/api/teams/${unused.id}`,{name:'Unused',active:false})).status,200);
  assert.equal(app.store.get('teams',unused.id).active,false);
});

test('invite role/team are applied from the invitation and cannot be overridden by signup input',async t=>{
  const {app,a,team,client}=await fixture(t);team('alpha');team('beta');
  const invite=await a('/api/members/invite',{name:'Read Only',email:'readonly@example.test',role:'viewer',teamId:'alpha'});
  assert.equal(invite.status,201);
  const token=new URL(invite.data.inviteUrl).hash.slice('#invite='.length),guest=client(null);
  const joined=await guest('/api/join',{token,name:'Read Only',password,role:'admin',teamId:'beta'});
  assert.equal(joined.status,201);assert.equal(joined.data.user.role,'viewer');assert.equal(joined.data.user.teamId,'alpha');
  const saved=app.store.all('users').find(row=>row.email==='readonly@example.test');assert.equal(saved.role,'viewer');assert.equal(saved.teamId,'alpha');
  assert.equal((await guest('/api/join',{token,name:'Again',password})).status,403);
  denied(await a('/api/members/invite',{name:'Manager',email:'manager@example.test',role:'manager',teamId:null}));
  denied(await a('/api/members/invite',{name:'Invalid',email:'invalid@example.test',role:'unexpected',teamId:'alpha'}));
});

test('an administrator can change only their own team while keeping the current session and revoking older sessions',async t=>{
  const {app,a,admin,team,employee,client}=await fixture(t);team('marketing');team('design');
  const otherSession=client(admin),otherAdmin=employee('other-admin','admin'),member=employee('member','member','marketing');
  const route=`/api/members/${admin.id}/assignment`;
  assert.equal((await a(route,{teamId:'marketing',name:'forged',active:false})).status,200,'the self-team form omits role and preserves admin');
  const current=await a('/api/state');assert.equal(current.status,200);assert.equal(current.data.user.teamId,'marketing');assert.equal(current.data.user.role,'admin');assert.equal(current.data.user.name,'Admin');assert.equal(current.data.user.active,true);
  assert.equal((await otherSession('/api/state')).status,401);
  assert.equal((await a('/messenger/api/bootstrap')).status,200,'current company and messenger sessions remain valid');
  for(const role of ['member','manager','viewer'])assert.equal((await a(route,{role,teamId:'design'})).status,403);
  assert.equal((await a(`/api/members/${otherAdmin.id}/assignment`,{role:'admin',teamId:'marketing'})).status,403);
  assert.equal((await client(member)(route,{role:'admin',teamId:'design'})).status,403);
  assert.equal((await a(route,{role:'admin',teamId:'missing-team'})).status,400);
  assert.equal(app.store.get('users',admin.id).teamId,'marketing');
  assert.equal((await a(route,{teamId:null})).status,200);
  assert.equal((await a('/api/state')).data.user.teamId,null);
  assert.equal((await a(route,{role:'admin',teamId:'design'})).status,200,'explicitly preserving admin remains valid');
  assert.equal((await a('/api/teams',{name:'Still an administrator'})).status,201,'current CSRF token and admin authority stay valid');
});

test('HTTP reads and collection respect team scope and individual member ownership',async t=>{
  const {app,a,team,employee,client,add,collected}=await fixture(t);team('alpha');team('beta');
  const manager=employee('manager','manager','alpha'),member=employee('member','member','alpha'),coworker=employee('coworker','member','alpha'),other=employee('other','member','beta');
  const mine=await add('member',member.id,'alpha'),teamOnly=await add('teamonly',coworker.id,'alpha'),foreign=await add('foreign',other.id,'beta');
  app.store.setSecret('provider:youtube',{apiKey:'mock-public-key'});
  const m=client(manager),s=client(member);
  const managerState=(await m('/api/state')).data,memberState=(await s('/api/state')).data;
  assert.deepEqual(managerState.channels.map(c=>c.id).sort(),[mine.id,teamOnly.id].sort());
  assert.deepEqual(memberState.channels.map(c=>c.id),[mine.id]);
  assert.equal(managerState.permissions.manageOrganization,false);assert.equal(managerState.permissions.manageTeam,true);
  assert.ok(managerState.teams.some(team=>team.id==='alpha'));
  assert.equal(managerState.members.find(person=>person.id===member.id).teamId,'alpha');
  assert.equal(managerState.members.some(person=>person.id===other.id),false);
  assert.ok(managerState.channels.every(c=>c.canEdit&&c.canManageOwners&&c.canConnect));
  assert.equal(memberState.channels[0].canEdit,true);assert.equal(memberState.channels[0].canManageOwners,false);
  assert.equal((await m(`/api/channels/${foreign.id}/history`)).status,404);
  assert.equal((await m(`/api/channels/${foreign.id}/collect`,{})).status,404);
  denied(await m(`/api/channels/${foreign.id}/owners`,{userIds:[manager.id],teamId:'alpha'}));
  const foreignReport=await m('/api/analytics?teamId=beta');assert.equal(foreignReport.status,200);assert.equal(foreignReport.data.channels.length,0);
  const memberReport=await s('/api/analytics');assert.deepEqual(memberReport.data.channels.map(c=>c.id),[mine.id]);
  assert.equal((await m('/api/collect',{})).status,202);await app.waitForIdle();
  assert.deepEqual(collected.sort(),[mine.id,teamOnly.id].sort());
  assert.equal(app.store.all('runs').some(run=>run.channelId===foreign.id),false);
  assert.equal((await a('/api/state')).data.channels.length,3);
});

test('mine, team and all HTTP reports separate real snapshots without expanding an unassigned or inactive team',async t=>{
  const {app,a,admin,team,employee,client,add,collected}=await fixture(t);team('alpha');team('beta');
  const member=employee('scope-member','member','alpha'),other=employee('scope-other','member','beta'),manager=employee('scope-manager','manager','alpha');
  assert.equal((await a(`/api/members/${admin.id}/assignment`,{teamId:'alpha'})).status,200);
  const own=await add('scopeown',admin.id,'alpha'),shared=await add('scopeshared',member.id,'alpha'),foreign=await add('scopeforeign',other.id,'beta');
  const end=today(),previous=shiftDate(end,-1);
  for(const [channel,baseline,current] of [[own,100,160],[shared,200,290],[foreign,400,650]]){
    const postId='scope-post-'+channel.id;
    app.store.put('posts',postId,{id:postId,channelId:channel.id,title:'Synthetic scope result',publishedDate:previous,publishedAt:previous+'T09:00:00+09:00',url:channel.canonicalUrl});
    for(const [date,views] of [[previous,baseline],[end,current]])app.store.put('snapshots',postId+date,{id:postId+date,postId,date,checkedAt:date+'T12:00:00+09:00',views,likes:10,comments:1,shares:null,ownership:{known:true,ownerIds:channel.ownerIds,teamId:channel.teamId}});
  }
  const report=async(request,scope,extra='')=>{const result=await request(`/api/day?date=${end}&scope=${scope}${extra}`);assert.equal(result.status,200);return result.data;};
  const mine=await report(a,'mine'),teamReport=await report(a,'team'),all=await report(a,'all');
  assert.deepEqual(mine.channels.map(c=>c.id),[own.id]);assert.equal(mine.metrics.views.day.delta,60);
  assert.deepEqual(teamReport.channels.map(c=>c.id).sort(),[own.id,shared.id].sort());assert.equal(teamReport.metrics.views.day.delta,150);assert.equal(teamReport.scope.teamId,'alpha');
  assert.equal(all.channels.length,3);assert.equal(all.metrics.views.day.delta,400);
  assert.equal((await report(a,'all','&teamId=beta')).metrics.views.day.delta,250,'legacy all + teamId retains its intersection');
  assert.equal((await report(a,'mine','&teamId=beta')).channels.length,0);
  const m=client(manager),s=client(member);
  assert.equal((await report(m,'team')).metrics.views.day.delta,150);
  assert.equal((await report(m,'all')).channels.length,2,'all does not override manager read permissions');
  assert.equal((await report(m,'team','&teamId=beta')).channels.length,0);
  assert.equal((await report(s,'team')).metrics.views.day.delta,90,'team does not broaden a member beyond assigned channels');
  assert.equal((await report(s,'all')).channels.length,1);
  assert.equal((await a(`/api/members/${admin.id}/assignment`,{teamId:null})).status,200);
  assert.equal((await report(a,'team')).channels.length,0,'no selected or assigned team must stay empty');
  assert.equal((await report(a,'team','&teamId=')).channels.length,0);
  assert.equal((await report(a,'team','&teamId=missing')).channels.length,0);
  assert.equal((await report(a,'all')).channels.length,3);
  assert.equal((await report(a,'team','&teamId=alpha')).channels.length,2,'admins may explicitly choose an active allowed team');
  app.store.setSecret('provider:youtube',{apiKey:'mock-public-key'});
  assert.equal((await a('/api/collect',{scope:'team'})).data.runs.length,0);await app.waitForIdle();assert.deepEqual(collected,[]);
  assert.equal((await a(`/api/members/${admin.id}/assignment`,{teamId:'alpha'})).status,200);
  app.store.put('teams','alpha',{...app.store.get('teams','alpha'),active:false});
  assert.equal((await report(a,'team')).channels.length,0);
  assert.equal((await report(a,'team','&teamId=alpha')).channels.length,0);
  assert.equal((await report(a,'all','&teamId=alpha')).channels.length,2,'existing explicit all filter stays compatible');
});

test('viewer can read its team but cannot write even a personally owned channel',async t=>{
  const {app,a,team,employee,client,add,collected}=await fixture(t);team('alpha');
  const viewer=employee('viewer','member','alpha'),other=employee('other','member','alpha');
  const own=await add('viewerowned',viewer.id,'alpha'),shared=await add('teamview',other.id,'alpha');
  assert.equal((await a(`/api/members/${viewer.id}/assignment`,{role:'viewer',teamId:'alpha'})).status,200);
  app.store.setSecret('provider:youtube',{apiKey:'mock-public-key'});
  const v=client(viewer),state=(await v('/api/state')).data;
  assert.deepEqual(state.channels.map(c=>c.id).sort(),[own.id,shared.id].sort());
  assert.ok(state.channels.every(c=>!c.canEdit&&!c.canManageOwners&&!c.canConnect));
  assert.equal((await v('/api/analytics')).status,200);
  for(const [path,body] of [
    ['/api/channels',{urls:'https://youtube.com/@forbidden'}],
    [`/api/channels/${own.id}/collect`,{}],
    [`/api/channels/${own.id}/archive`,{active:false}],
    [`/api/channels/${own.id}/disconnect`,{}],
    [`/api/channels/${own.id}/connection`,{apiKey:'forbidden'}],
    [`/api/channels/${own.id}/owners`,{userIds:[viewer.id]}],
    ['/api/collect',{}],
    ['/api/settings',{hourKst:2,enabled:true}],
  ])denied(await v(path,body));
  await app.waitForIdle();assert.deepEqual(collected,[]);
  assert.equal(app.store.get('channels',own.id).active,true);assert.equal(app.store.all('channels').length,2);
});

test('same-team manager can change assignments and history records previous/new owners',async t=>{
  const {app,team,employee,client,add}=await fixture(t);team('alpha');team('beta');
  const manager=employee('manager','manager','alpha'),first=employee('first','member','alpha'),next=employee('next','member','alpha'),outside=employee('outside','member','beta');
  const c=await add('handover',first.id,'alpha'),m=client(manager);
  const baseline=app.store.all('ownershipEvents').filter(e=>e.channelId===c.id);assert.equal(baseline.length,1);assert.equal(baseline[0].baseline,true);
  denied(await m(`/api/channels/${c.id}/owners`,{userIds:[outside.id],teamId:'beta',reason:'Cross team attempt'}));
  const change=await m(`/api/channels/${c.id}/owners`,{userIds:[next.id],reason:'Schedule handover'});assert.equal(change.status,200);
  assert.deepEqual(app.store.get('channels',c.id).ownerIds,[next.id]);
  const history=await m(`/api/channels/${c.id}/history`);assert.equal(history.status,200);
  const events=app.store.all('ownershipEvents').filter(e=>e.channelId===c.id);assert.equal(events.length,2);
  assert.deepEqual(events[1].beforeOwnerIds,[first.id]);assert.deepEqual(events[1].afterOwnerIds,[next.id]);assert.equal(events[1].actorId,manager.id);assert.equal(events[1].reason,'Schedule handover');
  assert.ok(JSON.stringify(history.data).includes('Schedule handover'));
  const current=client(next);denied(await current(`/api/channels/${c.id}/owners`,{userIds:[first.id]}));
  app.store.setSecret('channel:'+c.id,{accessToken:'retained-signer-token',connectedBy:next.id});
  assert.equal((await m(`/api/channels/${c.id}/owners`,{userIds:[next.id,first.id],reason:'Add colleague'})).status,200);
  assert.deepEqual(app.store.get('channels',c.id).ownerIds,[next.id,first.id]);
  assert.ok(!app.store.get('channels',c.id).pendingHandoffId);
  assert.equal(app.store.secret('channel:'+c.id).accessToken,'retained-signer-token');
  assert.equal(app.store.all('ownershipEvents').filter(event=>event.channelId===c.id).length,3);
});

test('removing a connection signer requests handover without deleting existing API observations',async t=>{
  const {app,a,team,employee,add}=await fixture(t);team('alpha');
  const first=employee('first','member','alpha'),next=employee('next','member','alpha'),c=await add('retaineddata',first.id,'alpha');
  app.store.setSecret('channel:'+c.id,{accessToken:'existing-fixture-token',connectedBy:first.id});
  app.store.put('posts','api-post',{id:'api-post',channelId:c.id,source:'api:youtube'});
  app.store.put('snapshots','api-record',{id:'api-record',postId:'api-post',source:'api:youtube',views:100});
  app.store.put('channelSnapshots','api-channel',{id:'api-channel',channelId:c.id,source:'api:youtube',followers:10});
  const response=await a(`/api/channels/${c.id}/owners`,{userIds:[next.id],reason:'New manager starts'});
  assert.ok([200,202].includes(response.status));
  const live=app.store.get('channels',c.id);assert.deepEqual(live.ownerIds,[first.id]);assert.ok(live.pendingHandoffId);
  const handoff=app.store.get('handoffs',live.pendingHandoffId);assert.equal(handoff.status,'awaiting-connection');assert.deepEqual(handoff.toOwnerIds,[next.id]);
  assert.ok(app.store.get('posts','api-post'));assert.equal(app.store.get('snapshots','api-record').views,100);assert.equal(app.store.get('channelSnapshots','api-channel').followers,10);
  assert.equal(app.store.all('ownershipEvents').filter(event=>event.channelId===c.id).length,1);
});

test('existing channels get one migration baseline and never acquire invented prior owners',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-org-migration-'));
  let store=new Store(directory),app;
  const c={id:'legacy-channel',platform:'youtube',canonicalUrl:'https://www.youtube.com/@legacy',ownerIds:['legacy-user'],active:true};
  store.put('channels',c.id,c);
  const migrationAt='2026-09-27T03:00:00.000Z';
  app=createCompanyApp({store,port:0,allowTestHost:true,schedule:false,clock:()=>migrationAt});await app.start();
  t.after(async()=>{if(app.server.listening)await app.stop();await rm(directory,{recursive:true,force:true});});
  let events=store.all('ownershipEvents');assert.equal(events.length,1);assert.equal(events[0].baseline,true);assert.equal(events[0].effectiveAt,migrationAt);
  assert.deepEqual(ownerAt(events,c,'2026-09-27T02:59:59.999Z'),{ownerIds:[],teamId:null,known:false});
  assert.deepEqual(ownerAt(events,c,migrationAt),{ownerIds:['legacy-user'],teamId:null,known:true});
  await app.stop();
  store=new Store(directory);app=createCompanyApp({store,port:0,allowTestHost:true,schedule:false,clock:()=> '2026-09-28T03:00:00.000Z'});await app.start();
  events=store.all('ownershipEvents');assert.equal(events.length,1);assert.equal(events[0].effectiveAt,migrationAt);
});
