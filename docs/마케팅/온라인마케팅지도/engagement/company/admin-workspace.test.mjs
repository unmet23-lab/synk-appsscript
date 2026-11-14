import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createAdminWorkspace} from './admin-workspace.mjs';
import {shiftDate} from '../analytics.mjs';
import {today} from './store.mjs';

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-admin-workspace-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,publicationLinkSchedule:false,publicationPerformanceSchedule:false,...options});
  t.after(async()=>{
    await app.stop();
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));
    assert.ok(directory.includes('synk-admin-workspace-'));
    await rm(directory,{recursive:true,force:true});
  });
  const person=(name,role='member',profile={memberships:[{company:'PULSE',role:'producer'}],duties:['social']})=>{
    const row={id:randomUUID(),name,email:randomUUID()+'@example.test',role,teamId:'team-a',active:true,createdAt:new Date().toISOString(),workspaceProfile:profile};
    app.store.put('users',row.id,row);return row;
  };
  const admin=person('Administrator','admin');
  app.store.put('teams','team-a',{id:'team-a',name:'Test team',active:true});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  const request=actor=>{
    const cookie=actor?'synk_company_session='+app.store.mint('session',actor.id,{csrfToken:'admin-fixture-csrf'},30):'';
    return async(path,body,headers={})=>{
      const res=await fetch(base+path,{method:body===undefined?'GET':'POST',
        headers:{Cookie:cookie,...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'admin-fixture-csrf'}),...headers},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:res.status,data:await res.json()};
    };
  };
  return {app,person,admin,request,base};
}
function channel(store,owners,extra={}){
  const row={id:randomUUID(),displayName:'Test channel',platform:'instagram',canonicalUrl:'https://www.instagram.com/test_workspace/',handle:'test_workspace',ownerIds:owners,teamId:'team-a',active:true,status:'not-connected',...extra};
  store.put('channels',row.id,row);return row;
}
function observation(store,c,ownerIds,date,views,{source='manual',comparisonGroup,extra={}}={}){
  const id=c.id+':post';
  store.put('posts',id,{id,channelId:c.id,title:'Test post',url:'https://www.instagram.com/p/test/',publishedDate:shiftDate(today(),-60),publishedAt:shiftDate(today(),-60)+'T12:00:00Z',source});
  const row={id:id+':'+date,postId:id,date,checkedAt:date+'T12:00:00Z',source,views,likes:0,ownership:{known:true,ownerIds,teamId:'team-a'},...extra};
  if(comparisonGroup!==undefined)row.comparisonGroup=comparisonGroup;
  store.put('snapshots',row.id,row);
}

test('admin overview rejects anonymous, every non-admin role, stopped users and forged stale roles',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request(null)('/api/admin-workspace')).status,401);
  for(const role of ['member','manager','viewer']){
    const user=f.person(role,role);
    assert.equal((await f.request(user)('/api/admin-workspace')).status,403);
  }
  const call=f.request(f.admin);
  assert.equal((await call('/api/admin-workspace')).status,200);
  assert.equal((await call('/api/admin-workspace',undefined,{'X-Synk-Demo':'1'})).status,403);
  f.app.store.put('users',f.admin.id,{...f.admin,role:'member'});
  assert.equal((await call('/api/admin-workspace')).status,403);
  f.app.store.put('users',f.admin.id,{...f.admin,active:false});
  assert.equal((await call('/api/admin-workspace')).status,401);
});

test('only one start and end are accepted and invalid or future ranges fail',async t=>{
  const fixed='2026-01-15T03:00:00.000Z';
  assert.ok(Date.parse(fixed)<=Date.now(),'the fixture date precedes the report clock');
  const f=await fixture(t,{clock:()=>fixed}),call=f.request(f.admin),end='2026-01-15';
  for(const query of ['scope=mine','ownerId=foreign','date='+end,'demo=1','start=&end='+end,'end=2026-02-30','start='+end+'&start='+end,'end='+end+'&end='+end,'start=2020-01-01&end='+end,'end='+shiftDate(end,1),'start='+end+'&end='+shiftDate(end,-1)]){
    const result=await call('/api/admin-workspace?'+query);
    assert.equal(result.status,query==='demo=1'?403:400,query+' rejected');
    assert.equal(result.data.members,undefined);
  }
  const result=await call('/api/admin-workspace?end='+shiftDate(end,-3));
  assert.equal(result.status,200);
  assert.equal(result.data.start,shiftDate(end,-32));
  assert.equal(result.data.end,shiftDate(end,-3));
});

test('legacy invitation acceptance preserves its public ID and links both admin lists without secrets',async t=>{
  const f=await fixture(t),call=f.request(f.admin),email='legacy-admin-qa@example.test';
  const code=f.app.store.mint('invite',null,{email:email.toUpperCase(),name:'Legacy invite',role:'member',teamId:'team-a'},3*24*60);
  const token=f.app.store.readToken(code,'invite');
  const pending=await call('/api/workspace-invites');
  assert.equal(pending.status,200);
  const original=pending.data.invites.find(row=>row.email===email);
  assert.ok(original?.id.startsWith('legacy-'));
  const joinBody={token:code,name:'Legacy employee',password:'synthetic-admin-fixture-password'};
  assert.equal((await f.request(null)('/api/join',joinBody)).status,201);
  const user=f.app.store.all('users').find(row=>row.email===email);
  assert.equal(user.workspaceProfile,undefined,'legacy membership is not inferred');
  const list=await call('/api/workspace-invites'),overview=await call('/api/admin-workspace');
  assert.equal(list.status,200);
  assert.equal(overview.status,200);
  const accepted=list.data.invites.filter(row=>row.id===original.id);
  assert.equal(accepted.length,1);
  assert.equal(accepted[0].status,'accepted');
  assert.equal(accepted[0].createdAt,null);
  assert.equal(accepted[0].expiresAt,token.expiresAt);
  assert.deepEqual(accepted[0].memberships,[]);
  assert.equal(overview.data.members.find(row=>row.id===user.id).invitation.id,original.id);
  const body=JSON.stringify([list.data,overview.data]);
  for(const secret of [code,token.hash,'tokenHash'])assert.ok(!body.includes(secret));
  const saved=f.app.store.get('workspaceInvites',original.id);
  assert.equal((await f.request(null)('/api/join',joinBody)).status,403);
  assert.deepEqual(f.app.store.get('workspaceInvites',original.id),saved,'replay cannot replace the accepted history');
});

test('a legacy acceptance history failure rolls back its user and token before a successful retry',async t=>{
  const f=await fixture(t),email='legacy-rollback-qa@example.test';
  const code=f.app.store.mint('invite',null,{email,name:'Legacy rollback',role:'member',teamId:'team-a'},3*24*60);
  const joinBody={token:code,name:'Legacy rollback',password:'synthetic-admin-fixture-password'};
  const put=f.app.store.put;
  let injected=0;
  f.app.store.put=(kind,...args)=>{
    if(kind==='workspaceInvites'){
      injected++;
      assert.equal(f.app.store.readToken(code,'invite'),null,'failure happens after the token deletion');
      throw new Error('Synthetic legacy invitation history failure');
    }
    return put.call(f.app.store,kind,...args);
  };
  try{assert.equal((await f.request(null)('/api/join',joinBody)).status,500);}
  finally{f.app.store.put=put;}
  assert.equal(injected,1);
  assert.ok(f.app.store.readToken(code,'invite'));
  assert.equal(f.app.store.all('users').filter(row=>row.email===email).length,0);
  assert.equal(f.app.store.all('workspaceInvites').filter(row=>row.email===email).length,0);
  assert.equal((await f.request(null)('/api/join',joinBody)).status,201);
  assert.equal((await f.request(null)('/api/join',joinBody)).status,403);
  assert.equal(f.app.store.all('workspaceInvites').filter(row=>row.email===email&&row.status==='accepted').length,1);
});

test('accepted invitation links by stable user ID beyond recent history without exposing secrets',async t=>{
  const f=await fixture(t),call=f.request(f.admin);
  const issued=await call('/api/members/invite',{name:'Invited employee',email:'invited-admin-qa@example.test',role:'member',workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}],duties:['social']}});
  assert.equal(issued.status,201);
  const joined=await f.request(null)('/api/join',{token:issued.data.code,name:'Invited employee',password:'synthetic-admin-fixture-password'});
  assert.equal(joined.status,201);
  const user=f.app.store.all('users').find(row=>row.email==='invited-admin-qa@example.test');
  f.app.store.put('users',user.id,{...user,email:'renamed-admin-qa@example.test',name:'Same name'});
  const other=f.person('Same name');
  for(let i=0;i<115;i++)f.app.store.put('workspaceInvites','older-list-'+i,{id:'older-list-'+i,name:'Fixture invite',email:'list-'+i+'@example.test',status:'revoked',createdAt:'2099-01-01T00:00:00Z',expiresAt:'2099-01-04T00:00:00Z',workspaceProfile:{memberships:[],duties:[]},tokenHash:'private-invite-hash'});
  const response=await call('/api/admin-workspace'),body=JSON.stringify(response.data);
  assert.equal(response.status,200);
  assert.equal(response.data.members.filter(row=>row.id===user.id).length,1,'concurrent companies do not duplicate people');
  assert.equal(response.data.members.find(row=>row.id===user.id).invitation.id,issued.data.id);
  assert.equal(response.data.members.find(row=>row.id===other.id).invitation,null);
  assert.equal(response.data.invitations.length,100);
  assert.equal(response.data.invitationHistoryLimit,100);
  assert.ok(!body.includes(issued.data.code));
  assert.ok(!body.includes('tokenHash'));
  assert.ok(!body.includes('private-invite-hash'));
});

test('historical ownership, shared channels, missing values, zero and old observation dates stay distinct',async t=>{
  const f=await fixture(t),old=f.person('Previous owner'),next=f.person('New owner'),peer=f.person('Co-owner'),empty=f.person('No assignment');
  const end=today(),start=shiftDate(end,-2),baseline=shiftDate(start,-1);
  const c=channel(f.app.store,[next.id,peer.id]);
  observation(f.app.store,c,[old.id],baseline,100);
  observation(f.app.store,c,[next.id,peer.id],end,150);
  const stale=channel(f.app.store,[old.id]);
  observation(f.app.store,stale,[old.id],shiftDate(end,-1),0);
  const response=await f.request(f.admin)('/api/admin-workspace?start='+start+'&end='+end),rows=new Map(response.data.members.map(row=>[row.id,row]));
  assert.equal(response.status,200);
  assert.equal(rows.get(old.id).performance.metrics.views.period.delta,null,'handoff does not count a different owner baseline');
  assert.equal(rows.get(next.id).performance.metrics.views.period.delta,null);
  assert.equal(rows.get(next.id).performance.metrics.views.latest,150);
  assert.equal(rows.get(peer.id).performance.metrics.views.latest,150);
  assert.equal(rows.get(next.id).channels[0].shared,true);
  assert.equal(rows.get(old.id).performance.metrics.likes.latest,0,'a measured zero remains zero');
  assert.equal(rows.get(old.id).performance.metrics.reach.latest,null,'an unprovided value remains missing');
  assert.equal(rows.get(old.id).performance.metrics.views.newest,shiftDate(end,-1));
  assert.equal(rows.get(empty.id).performance.state,'unassigned');
  f.app.store.put('channels',stale.id,{...stale,ownerIds:[next.id]});
  const history=(await f.request(f.admin)('/api/admin-workspace')).data.members.find(row=>row.id===old.id);
  assert.equal(history.performance.state,'historyOnly');
  assert.equal(history.channels.length,0);
  assert.ok(history.performance.observedChannelCount>0);
});

test('handoff waits, inactive channels, pending observation and connection status are separated',()=>{
  const actor={id:'admin',role:'admin',active:true},rows=[{id:'person'},{id:'incoming'},{id:'archived'},{id:'waiting'},{id:'offline'}];
  const users=[actor,...rows.map(row=>({...row,active:true,role:'member'}))];
  const records={users,companyWork:[],clientProjects:[],workspaceInvites:[]};
  const store={get:(kind,id)=>records[kind]?.find(row=>row.id===id),all:kind=>records[kind]||[],db:{prepare:()=>({all:()=>[]})}};
  const read=createAdminWorkspace({store,clock:()=> '2026-11-13T15:10:00Z',membersFor:()=>rows,workspaceProfiles:{list:()=>[]},
    report:(live,query)=>{assert.equal(live.id,'admin');assert.equal(query.get('end'),'2026-11-14');assert.deepEqual([...query.keys()],['start','end']);return{memberGroups:[],definitions:{members:'basis'},memberGroupsBasis:'basis'};},
    channelsFor:()=>[
      {id:'shared',ownerIds:['person'],canonicalUrl:'https://example.test/channel',connected:true,active:true,pendingHandoff:{toOwnerIds:['incoming'],secret:'omit'},connectionOwner:{email:'omit'},secret:'omit'},
      {id:'archived',ownerIds:['archived'],active:false,connected:true},
      {id:'waiting',ownerIds:['waiting'],active:true,connected:true},
      {id:'offline',ownerIds:['offline'],active:true,connected:false}
    ]});
  const result=read(actor),byId=new Map(result.members.map(row=>[row.id,row]));
  assert.equal(byId.get('incoming').channels[0].relation,'incoming');
  assert.equal(byId.get('incoming').performance.state,'unassigned');
  assert.equal(byId.get('person').channels[0].url,'https://example.test/channel');
  assert.equal(byId.get('archived').performance.state,'inactiveOnly');
  assert.equal(byId.get('waiting').performance.state,'awaitingObservation');
  assert.equal(byId.get('offline').performance.state,'notConnected');
  assert.ok(!JSON.stringify(result).includes('omit'));
  actor.role='member';
  assert.throws(()=>read({...actor,role:'admin'}),{status:403},'the stored role wins');
});

test('current work counts isolate current client access and expose no customer records',async t=>{
  const f=await fixture(t),owner=f.person('Producer'),reviewer=f.person('Reviewer');
  f.app.store.put('companyWork','shift-open',{id:'shift-open',company:'SHIFT',ownerId:owner.id,status:'open',title:'Private lecture'});
  f.app.store.put('companyWork','path-done',{id:'path-done',company:'PATH',ownerId:owner.id,status:'done'});
  f.app.store.put('clientProjects','project',{id:'project',ownerId:owner.id,reviewerId:reviewer.id,teamId:'team-a',stage:'review',customerName:'Private customer',contact:'Private contact'});
  f.app.store.put('clientProjects','archive',{id:'archive',ownerId:owner.id,reviewerId:reviewer.id,teamId:'team-a',stage:'archived'});
  const call=f.request(f.admin);
  let result=(await call('/api/admin-workspace')).data;
  const ownerRow=result.members.find(row=>row.id===owner.id),reviewRow=result.members.find(row=>row.id===reviewer.id);
  assert.equal(ownerRow.work.SHIFT.open,1);
  assert.equal(ownerRow.work.PATH.done,1);
  assert.equal(ownerRow.work.PULSE.owner.review,1);
  assert.equal(ownerRow.work.PULSE.owner.archived,1);
  assert.equal(reviewRow.work.PULSE.reviewer.review,1);
  assert.equal(ownerRow.work.LAB.available,false);
  assert.ok(!JSON.stringify(result).includes('Private'));
  f.app.store.put('users',reviewer.id,{...reviewer,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}});
  f.app.store.put('users',owner.id,{...owner,active:false});
  result=(await call('/api/admin-workspace')).data;
  assert.equal(result.members.find(row=>row.id===reviewer.id).work.PULSE.reviewer.review,0);
  assert.equal(result.members.find(row=>row.id===reviewer.id).work.PULSE.reviewerInactive,1);
  assert.equal(result.members.find(row=>row.id===owner.id).work.PULSE.ownerInactive,1,'archived projects do not need reassignment');
  assert.equal(result.members.find(row=>row.id===reviewer.id).work.PULSE.reviewerInactive,1,'archived reviews do not need reassignment');
  assert.equal(result.members.find(row=>row.id===owner.id).work.PULSE.owner.archived,0,'an inactive assignment is not current work');
});
