import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

test('SNS notifications and workday retain off-page items without full publishing workspace views',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-social-summary-http-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,socialSchedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})},clock:()=> '2026-10-15T00:00:00.000Z'});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({email:'summary-owner@example.test',name:'합성 관리자',role:'admin'});
  const outsider=app.store.createUser({email:'summary-outsider@example.test',name:'다른 팀',role:'member',teamId:'outside'});
  app.store.put('channels','summary-ig',{id:'summary-ig',platform:'instagram',displayName:'합성 계정',active:true,ownerIds:[owner.id],connectionVersion:1});
  const original=app.socialPublishing.savePost(owner,{title:'합성 원본',body:'로컬 알림 검증',variants:[{channelId:'summary-ig',format:'text',text:'합성 본문'}]}).post;
  const raw=app.store.get('socialPosts',original.id);
  app.store.transaction(()=>{for(let i=0;i<75;i++){
    const id='summary-post-'+String(i).padStart(3,'0');
    app.store.put('socialPosts',id,{...raw,id,title:'검토 대상 '+i,status:'review',updatedAt:'2026-10-15T00:00:00.000Z'});
  }});
  const tokens=new Map([owner,outsider].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'summary-csrf'},60)]));
  await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  async function request(user,path,input){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'summary-csrf',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;}
  // Loading a notification or the workday must not hydrate every post body and job snapshot.
  t.mock.method(app.socialPublishing,'workspace',()=>{throw Error('Full publishing workspace must not serve notification/workday reads');});
  const before=await request(owner,'/messenger/api/notifications?limit=100');
  const social=before.items.filter(row=>row.kind==='social_publishing');
  assert.equal(social.length,75);assert.equal(social.filter(row=>!row.readAt).length,75);
  const workday=await request(owner,'/api/publication-workflow');
  assert.equal(workday.items.filter(row=>row.id.startsWith('social:review:')).length,75);
  assert.ok(workday.items.some(row=>row.id==='social:review:summary-post-074'&&row.title==='검토 대상 74'));
  const hidden=await request(outsider,'/messenger/api/notifications?limit=100');
  assert.equal(hidden.items.filter(row=>row.kind==='social_publishing').length,0);
  const selected=social.find(row=>row.text.startsWith('검토 대상 74 ·'));assert.ok(selected);
  await request(owner,'/messenger/api/notifications/'+encodeURIComponent(selected.id)+'/read',{});
  const after=await request(owner,'/messenger/api/notifications?limit=100');
  assert.ok(after.items.find(row=>row.id===selected.id).readAt);
  assert.equal(after.items.filter(row=>row.kind==='social_publishing'&&!row.readAt).length,74);
  await request(owner,'/messenger/api/notifications/read-all',{});
  const read=await request(owner,'/messenger/api/notifications?limit=100');
  assert.equal(read.items.filter(row=>row.kind==='social_publishing'&&!row.readAt).length,0);
});
