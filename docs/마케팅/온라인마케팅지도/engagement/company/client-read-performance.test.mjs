import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientNotificationsService} from './client-notifications.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-read-performance-')),store=new Store(directory),external=new Store(directory);
  t.after(async()=>{external.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-client-read-performance-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@read-performance.test',role,teamId});
  const projects=createClientProjectsService({store}),notifications=createClientNotificationsService({store,clientProjects:projects});
  const one=projects.save(users.owner,{title:'First synthetic project',customerName:'Synthetic',reviewerId:users.reviewer.id}).project;
  const two=projects.save(users.other,{title:'Second synthetic project',customerName:'Synthetic'}).project;
  return {store,external,users,projects,notifications,one,two};
}

test('SQL project prefilter matches the original ACL, including raw and external writes and rollback',async t=>{
  const f=await fixture(t),{store,external,projects,users,one}=f;
  const expected=user=>store.all('clientProjects').filter(row=>user.role==='admin'||row.ownerId===user.id||(row.reviewerId===user.id&&user.role!=='viewer'&&user.teamId&&user.teamId===row.teamId)||(['manager','viewer'].includes(user.role)&&user.teamId&&user.teamId===row.teamId)).map(row=>row.id);
  const compare=()=>{for(const user of Object.values(users)){const live=store.get('users',user.id);assert.deepEqual(projects.readableSources(user).map(row=>row.id),expected(live));}};
  compare();
  external.put('users',users.viewer.id,{...users.viewer,teamId:'b'});compare();
  external.put('clientProjects',one.id,{...store.get('clientProjects',one.id),ownerId:users.other.id,teamId:'b'});compare();
  const changed={...store.get('clientProjects',one.id),ownerId:users.owner.id,teamId:'a'};
  store.db.prepare('UPDATE documents SET body=? WHERE kind=? AND id=?').run(JSON.stringify(changed),'clientProjects',one.id);compare();
  assert.throws(()=>store.transaction(()=>{store.put('clientProjects',one.id,{...changed,ownerId:users.other.id,teamId:'b'});compare();throw new Error('rollback');}),/rollback/);compare();
  // Legacy/external documents can bypass createUser's normal string fields.
  external.put('users',users.owner.id,{...users.owner,role:undefined});compare();
  external.put('users',users.manager.id,{...users.manager,teamId:true});
  external.put('clientProjects',one.id,{...changed,teamId:true});compare();
  external.put('users',users.owner.id,{...users.owner,active:false});assert.throws(()=>projects.readableSources(users.owner),{status:401});
});

test('notification reads skip workspace expansion and per-project rereads while retaining live access and source validation',async t=>{
  const {store,external,projects,notifications,users,one,two}=await fixture(t);
  const event=(project,id)=>({id,type:'customer_support',projectId:project.id,revision:2,createdAt:'2026-10-31T00:00:00.000Z',actorId:'customer',audiences:['owner'],messageId:'synthetic-message'});
  for(const project of [one,two])store.put('clientProjects',project.id,{...store.get('clientProjects',project.id),messages:[{id:'synthetic-message',author:'customer',visibility:'customer',text:'Synthetic question'}],notificationEvents:[event(project,'event-'+project.id)]});
  t.mock.method(projects,'workspace',()=>{throw new Error('Notifications must not build the workspace');});
  const originalGet=store.get.bind(store);let projectReads=0;
  t.mock.method(store,'get',(kind,...args)=>{if(kind==='clientProjects')projectReads++;return originalGet(kind,...args);});
  const first=notifications.list(users.owner);assert.equal(first.notifications.length,1);assert.equal(first.unreadCount,1);assert.equal(first.notifications[0].projectId,one.id);assert.equal(projectReads,0);
  const receipt=users.owner.id+'|'+first.notifications[0].id;external.put('clientNotificationReads',receipt,{id:receipt,readAt:'2026-10-31T01:00:00.000Z'});assert.equal(notifications.unreadCount(users.owner),0);
  external.put('clientProjects',one.id,{...originalGet('clientProjects',one.id),messages:[]});assert.equal(notifications.list(users.owner).total,0);
  external.put('clientProjects',one.id,{...originalGet('clientProjects',one.id),messages:[{id:'synthetic-message',text:'Synthetic'}],ownerId:users.other.id,teamId:'b'});assert.equal(notifications.list(users.owner).total,0);
  external.put('users',users.owner.id,{...users.owner,active:false});assert.throws(()=>notifications.list(users.owner),{status:401});
});
