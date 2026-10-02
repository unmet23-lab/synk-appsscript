import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store.mjs';
import { canReadChannel, canWriteChannel, canManageOwners, visibleMembers, seedOwnership, recordOwnershipChange, ownerAt } from './organization.mjs';

const user = (id, role = 'member', teamId = null) => ({id, name:id, email:`${id}@example.test`, role, teamId, active:true, passwordHash:'must-not-leak', secret:'must-not-leak'});
const channel = (id = 'channel', ownerIds = ['owner'], teamId = null) => ({id, ownerIds, teamId});
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-organization-'));
  const store = new Store(directory);
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  return store;
}

test('read/write/owner management follow roles, ownership and non-null team boundaries',()=>{
  const owned = channel('owned',['person'],'alpha'), other = channel('other',['else'],'beta'), unassigned = channel('unassigned',['else']);
  const table = [
    [user('person','admin'),other,true,true,true],
    [user('person','manager','alpha'),owned,true,true,true],
    [user('person','manager','alpha'),channel('team',['else'],'alpha'),true,true,true],
    [user('person','manager','alpha'),other,false,false,false],
    [user('person','manager','beta'),owned,true,true,false],
    [user('person','manager'),unassigned,false,false,false],
    [user('person','member','alpha'),owned,true,true,false],
    [user('person','member','alpha'),channel('team',['else'],'alpha'),false,false,false],
    [user('person','viewer','alpha'),owned,true,false,false],
    [user('person','viewer','alpha'),channel('team',['else'],'alpha'),true,false,false],
    [user('person','viewer','beta'),owned,true,false,false],
    [user('person','viewer'),unassigned,false,false,false],
    [{...user('person','admin'),active:false},owned,false,false,false],
    [user('person','superuser','alpha'),owned,false,false,false],
    [null,owned,false,false,false],
  ];
  for(const [person,c,read,write,manage] of table){assert.equal(canReadChannel(person,c),read);assert.equal(canWriteChannel(person,c),write);assert.equal(canManageOwners(person,c),manage);}
  assert.equal(canReadChannel(user('person','admin'),null),false);
});

test('member listings limit scope and never expose credentials or coworkers email',async t=>{
  const store=await fixture(t);
  const users=[user('admin','admin'),user('manager','manager','alpha'),user('member','member','alpha'),user('viewer','viewer','alpha'),user('outside','member','beta'),user('hidden','member','beta'),user('none','manager')];
  for(const person of users)store.put('users',person.id,person);
  store.put('channels','shared',channel('shared',['member','outside'],'alpha'));
  store.put('channels','hidden',channel('hidden',['hidden'],'beta'));
  const names=rows=>rows.map(row=>row.id);
  assert.deepEqual(names(visibleMembers(store,users[0])),users.map(row=>row.id));
  assert.deepEqual(names(visibleMembers(store,users[1])),['manager','member','viewer']);
  assert.deepEqual(names(visibleMembers(store,users[2])),['member','outside']);
  const visible=visibleMembers(store,users[3]);
  assert.deepEqual(names(visible),['member','viewer','outside']);
  assert.equal(visible.find(row=>row.id==='viewer').email,'viewer@example.test');
  assert.equal(visible.find(row=>row.id==='outside').email,undefined);
  assert.deepEqual(names(visibleMembers(store,users[6])),['none']);
  for(const person of users)assert.ok(!JSON.stringify(visibleMembers(store,person)).includes('must-not-leak'));
  assert.deepEqual(visibleMembers(store,{...users[0],active:false}),[]);
});

test('migration is idempotent and never infers ownership before its baseline',async t=>{
  const store=await fixture(t),c=channel('first',['old-owner'],'alpha'),at='2026-09-27T09:00:00.000Z';
  const baseline=seedOwnership(store,c,at);
  assert.equal(baseline.baseline,true);assert.equal(baseline.reason,'migration');assert.equal(baseline.actorId,null);
  assert.deepEqual(baseline.beforeOwnerIds,[]);
  assert.deepEqual(seedOwnership(store,channel('first',['new-owner'],'beta'),'2026-09-28T09:00:00Z'),baseline);
  assert.equal(store.all('ownershipEvents').length,1);
  assert.deepEqual(ownerAt(store.all('ownershipEvents'),c,'2026-09-27T08:59:59.999Z'),{ownerIds:[],teamId:null,known:false});
  assert.deepEqual(ownerAt(store.all('ownershipEvents'),c,at),{ownerIds:['old-owner'],teamId:'alpha',known:true});
  assert.deepEqual(ownerAt([],c,at),{ownerIds:[],teamId:null,known:false});
});

test('handover boundaries are inclusive, preserve previous state and distinguish channels',async t=>{
  const store=await fixture(t),old=channel('first',['a','b'],'alpha'),next=channel('first',['c'],'beta');
  seedOwnership(store,old,'2026-09-27T00:00:00Z');
  store.put('channels',old.id,old);
  const event=recordOwnershipChange(store,old,next,{actorId:'admin',at:'2026-09-27T18:00:00+09:00',reason:'Team handover'});
  assert.deepEqual(event.beforeOwnerIds,['a','b']);assert.deepEqual(event.afterOwnerIds,['c']);
  assert.equal(event.beforeTeamId,'alpha');assert.equal(event.afterTeamId,'beta');
  assert.equal(event.effectiveAt,'2026-09-27T09:00:00.000Z');assert.equal(event.actorId,'admin');assert.equal(event.baseline,false);
  assert.deepEqual(store.get('channels',old.id),old);
  seedOwnership(store,channel('second',['unrelated'],'other'),'2026-09-27T09:00:00Z');
  const events=store.all('ownershipEvents');
  assert.deepEqual(ownerAt(events,next,'2026-09-27T08:59:59.999Z'),{ownerIds:['a','b'],teamId:'alpha',known:true});
  assert.deepEqual(ownerAt(events,next,'2026-09-27T09:00:00Z'),{ownerIds:['c'],teamId:'beta',known:true});
  const result=ownerAt(events,next,'2026-09-28T09:00:00Z');result.ownerIds.push('mutation');
  assert.deepEqual(event.afterOwnerIds,['c']);
});

test('same instant changes apply in append sequence even when input history is shuffled',async t=>{
  const store=await fixture(t),a=channel('first',['a']),b=channel('first',['b']),c=channel('first',['c']);
  const at='2026-09-27T09:00:00Z';
  recordOwnershipChange(store,a,b,{at});recordOwnershipChange(store,b,c,{at});
  const events=store.all('ownershipEvents');
  assert.equal(events.length,3);assert.deepEqual(events.map(event=>event.sequence),[0,1,2]);
  assert.deepEqual(ownerAt([...events].reverse(),c,at),{ownerIds:['c'],teamId:null,known:true});
  assert.deepEqual(ownerAt(events,c,'2026-09-27T08:59:59.999Z'),{ownerIds:[],teamId:null,known:false});
});

test('no-op assignments do not append; stale or backdated changes cannot rewrite history',async t=>{
  const store=await fixture(t),a=channel('first',['a','b'],'alpha'),b=channel('first',['c'],'beta');
  seedOwnership(store,a,'2026-09-27T00:00:00Z');
  assert.equal(recordOwnershipChange(store,a,channel('first',['b','a','a'],'alpha'),{at:'2026-09-27T01:00:00Z'}),null);
  assert.equal(store.all('ownershipEvents').length,1);
  recordOwnershipChange(store,a,b,{at:'2026-09-27T02:00:00Z'});
  assert.throws(()=>recordOwnershipChange(store,a,channel('first',['wrong']),{at:'2026-09-27T03:00:00Z'}));
  assert.throws(()=>recordOwnershipChange(store,b,a,{at:'2026-09-27T01:00:00Z'}));
  assert.throws(()=>recordOwnershipChange(store,b,channel('different',['a']),{at:'2026-09-27T03:00:00Z'}));
  assert.equal(store.all('ownershipEvents').length,2);
});

test('team-only changes and explicit unassignment remain known facts',async t=>{
  const store=await fixture(t),a=channel('first',['a'],'alpha'),b=channel('first',['a'],'beta'),c=channel('first',[],null);
  recordOwnershipChange(store,a,b,{at:'2026-09-27T01:00:00Z'});
  recordOwnershipChange(store,b,c,{at:'2026-09-27T02:00:00Z'});
  assert.deepEqual(ownerAt(store.all('ownershipEvents'),c,'2026-09-27T02:00:00Z'),{ownerIds:[],teamId:null,known:true});
});

test('helper writes compose atomically with a caller Store transaction',async t=>{
  const store=await fixture(t),a=channel('first',['a']),b=channel('first',['b']);
  store.put('channels',a.id,a);
  assert.throws(()=>store.transaction(()=>{recordOwnershipChange(store,a,b,{at:'2026-09-27T01:00:00Z'});store.put('channels',b.id,b);throw new Error('abort');}));
  assert.equal(store.all('ownershipEvents').length,0);assert.deepEqual(store.get('channels',a.id),a);
  store.transaction(()=>{recordOwnershipChange(store,a,b,{at:'2026-09-27T01:00:00Z'});store.put('channels',b.id,b);});
  assert.equal(store.all('ownershipEvents').length,2);assert.deepEqual(store.get('channels',b.id),b);
});

test('invalid times and ownership inputs fail without creating partial history',async t=>{
  const store=await fixture(t),a=channel('first',['a']),b=channel('first',['b']);
  for(const at of ['2026-09-27','2026-02-30T00:00:00Z','invalid',null])assert.throws(()=>recordOwnershipChange(store,a,b,{at}));
  assert.throws(()=>seedOwnership(store,{...a,ownerIds:['']},'2026-09-27T00:00:00Z'));
  assert.throws(()=>recordOwnershipChange(store,a,b,{at:'2026-09-27T00:00:00Z',actorId:''}));
  assert.equal(store.all('ownershipEvents').length,0);
});
