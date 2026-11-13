import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {saveMemberOrganization} from './member-organization.mjs';
import {visibleMembers} from './organization.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-member-organization-service-')),store=new Store(directory);
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  const admin={id:'admin',name:'Admin',role:'admin',active:true},other={id:'other',name:'Other',role:'admin',active:true};
  for(const person of [admin,other])store.put('users',person.id,person);
  return {store,admin,other};
}
const input={jobTitle:'Operations',responsibilities:'Shared work',expectedRevision:null};

test('organization service rechecks the persisted administrator before storing or auditing',async t=>{
  const {store,admin,other}=await fixture(t),audit=[];
  for(const current of [{...admin,active:false},{...admin,role:'member'},null]){
    if(current)store.put('users',admin.id,current);else store.db.prepare('DELETE FROM documents WHERE kind=? AND id=?').run('users',admin.id);
    assert.throws(()=>saveMemberOrganization(store,admin,other.id,input,{audit:(...args)=>audit.push(args)}),{status:403});
    assert.equal(store.get('memberOrganization',other.id),null);
    assert.deepEqual(audit,[]);
  }
});

test('descriptive work information can cover another administrator without changing their permissions',async t=>{
  const {store,admin,other}=await fixture(t);
  const before=store.get('users',other.id);
  const result=saveMemberOrganization(store,admin,other.id,input);
  assert.equal(result.organization.jobTitle,input.jobTitle);
  assert.deepEqual(store.get('users',other.id),before);
});

test('shared channel coworkers retain the approved directory scope without private account fields',async t=>{
  const {store,admin}=await fixture(t);
  const person=(id,teamId)=>({id,name:id,role:'member',active:true,teamId,email:`${id}@example.test`,passwordHash:'never-visible',workspaceProfile:{memberships:[{company:'PULSE',role:'producer'}],duties:['social'],revision:7,updatedBy:'private-actor'}});
  const one=person('one','alpha'),two=person('two','beta'),hidden=person('hidden','beta');
  for(const user of [one,two,hidden]){store.put('users',user.id,user);saveMemberOrganization(store,admin,user.id,input);}
  store.put('channels','shared',{id:'shared',ownerIds:[one.id,two.id],teamId:'alpha'});
  const rows=visibleMembers(store,one),coworker=rows.find(row=>row.id===two.id);
  assert.deepEqual(rows.map(row=>row.id),[one.id,two.id]);
  assert.equal(coworker.organization.responsibilities,input.responsibilities);
  assert.deepEqual(coworker.organization.brands,['PULSE']);
  assert.deepEqual(coworker.workspaceAccess.memberships,two.workspaceProfile.memberships);
  assert.deepEqual(Object.keys(coworker.workspaceAccess).sort(),['configured','memberships']);
  assert.equal(coworker.email,undefined);
  assert.ok(!JSON.stringify(rows).includes('never-visible'));
  assert.ok(!JSON.stringify(rows).includes('private-actor'));
});
