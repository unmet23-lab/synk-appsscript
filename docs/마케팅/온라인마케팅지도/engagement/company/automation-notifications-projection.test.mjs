import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutomationNotificationsService} from './automation-notifications.mjs';

const KIND='automationNotificationStates',NOW='2026-10-12T00:00:00.000Z';

test('projection scopes only this user saved receipts; discovery scans still use full live health',()=>{
  const user={id:'one',active:true,role:'member'},other={id:'two',active:true,role:'member'},rows=[{ownerId:'one',automationId:'performance',state:'resolved'},{ownerId:'two',automationId:'links',state:'active'}],calls=[];
  const empty={cards:[],issues:[],observedIssueIds:[]},store={get:(kind,id)=>kind==='users'?[user,other].find(x=>x.id===id):undefined,all:kind=>kind===KIND?rows:kind==='users'?[user,other]:[],transaction:fn=>fn()};
  const service=createAutomationNotificationsService({store,clock:()=>NOW,automationHealth:{get:u=>{calls.push(['full',u.id]);return empty;},getForNotifications:(u,ids)=>{calls.push(['receipts',u.id,ids]);return empty;}}});
  assert.deepEqual(service.list(user),{notifications:[],unreadCount:0});assert.deepEqual(calls,[['receipts','one',['performance']]]);
  rows.length=0;calls.length=0;service.scan();assert.deepEqual(calls,[['full','one'],['full','two']]);
});
