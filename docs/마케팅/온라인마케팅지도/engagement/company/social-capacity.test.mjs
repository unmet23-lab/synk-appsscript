import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialCapacity} from './social-capacity.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-capacity-')),store=new Store(directory);let at='2026-10-13T00:00:00.000Z';
  const admin=store.createUser({email:'admin@capacity.test',name:'관리자',role:'admin'}),manager=store.createUser({email:'manager@capacity.test',name:'팀 관리자',role:'manager',teamId:'a'}),viewer=store.createUser({email:'viewer@capacity.test',name:'열람',role:'viewer',teamId:'a'}),other=store.createUser({email:'other@capacity.test',name:'다른 팀',role:'manager',teamId:'b'});
  store.put('channels','a',{id:'a',platform:'facebook',displayName:'공개팀',teamId:'a',active:true});store.put('channels','b',{id:'b',platform:'facebook',displayName:'비공개팀',teamId:'b',active:true});
  let sent=0;const provider={settings:()=>({rateLimit:{requests:30}}),capability:()=>({mode:'automatic',canPublish:true,formats:['text']}),publish:async()=>{sent++;return {status:'published'};}};
  const clock=()=>at,publishing=createSocialPublishingService({store,provider,clock}),capacity=createSocialCapacity({store,publishing,provider,clock});
  let n=0;function add({time='2026-10-13T01:00:00.000Z',channelId='a',mode='queue',media=[],notifyOnly=false}={}){let post=publishing.savePost(admin,{title:'예약 '+(++n),variants:[{channelId,format:'text',text:'게시문 '+n,media,options:{notifyOnly}}]}).post;post=publishing.action(admin,post.id,{action:'approve',revision:post.revision}).post;const job=publishing.action(admin,post.id,{action:'schedule',revision:post.revision,scheduledAt:time}).jobs[0];if(mode!=='fixed')store.put('socialPublishJobs',job.id,{...store.get('socialPublishJobs',job.id),mode});return store.get('socialPublishJobs',job.id);}
  t.after(async()=>{await publishing.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  return {store,admin,manager,viewer,other,publishing,capacity,add,setTime:value=>at=value,get sent(){return sent;}};
}

test('rolling congestion warns across clock hours and spreads only after an explicit apply',async t=>{
  const f=await fixture(t),jobs=Array.from({length:8},(_,i)=>f.add({time:i<4?'2026-10-13T01:59:00.000Z':'2026-10-13T02:01:00.000Z'}));
  const view=f.capacity.workspace(f.admin);assert.equal(view.limit,30);assert.equal(view.planningLimit,24);assert.ok(view.windows.some(w=>w.estimatedRequests===32&&w.overLimit));
  const preview=f.capacity.preview(f.admin,{jobIds:jobs.map(j=>j.id)});assert.ok(preview.validCount>0);assert.equal(preview.canApply,true);assert.equal(f.store.get('socialPublishJobs',jobs[0].id).scheduledAt,jobs[0].scheduledAt);
  assert.throws(()=>f.capacity.apply(f.admin,{previewId:preview.previewId}),{status:400});
  const applied=f.capacity.apply(f.admin,{previewId:preview.previewId,confirmed:true});assert.ok(applied.jobs.length>0);assert.equal(f.capacity.apply(f.admin,{previewId:preview.previewId,confirmed:true}).existing,true);assert.equal(f.capacity.workspace(f.admin).windows.some(w=>w.overLimit),false);assert.equal(f.sent,0);
});

test('fixed appointments stay protected unless individually selected',async t=>{
  const f=await fixture(t),one=f.add({mode:'fixed'}),two=f.add({mode:'fixed'});
  const protectedPlan=f.capacity.preview(f.admin,{jobIds:[one.id,two.id]});assert.equal(protectedPlan.validCount,0);assert.equal(protectedPlan.blockedCount,2);
  const chosen=f.capacity.preview(f.admin,{jobIds:[one.id,two.id],includeFixedJobIds:[two.id]});assert.equal(chosen.changes.find(c=>c.jobId===one.id).excluded,true);assert.equal(chosen.changes.find(c=>c.jobId===two.id).to,'2026-10-13T01:01:00.000Z');
  f.capacity.apply(f.admin,{previewId:chosen.previewId,confirmed:true});assert.equal(f.store.get('socialPublishJobs',one.id).scheduledAt,one.scheduledAt);
});

test('preview expires and rejects changed reservations, shared budget, and revoked authority',async t=>{
  for(const change of ['job','budget','permission','expiry']){
    const f=await fixture(t),jobs=[f.add(),f.add()],plan=f.capacity.preview(f.manager,{jobIds:jobs.map(j=>j.id)});
    if(change==='job')f.store.put('socialPublishJobs',jobs[0].id,{...jobs[0],scheduleRevision:2});
    if(change==='budget')f.store.put('socialProviderRequests','postiz',{times:[Date.parse('2026-10-13T00:00:00Z')]});
    if(change==='permission')f.store.put('users',f.manager.id,{...f.manager,role:'member'});
    if(change==='expiry')f.setTime('2026-10-13T00:16:00.000Z');
    assert.throws(()=>f.capacity.apply(f.manager,{previewId:plan.previewId,confirmed:true}),{status:409});assert.equal(f.store.get('socialPublishJobs',jobs[1].id).scheduledAt,jobs[1].scheduledAt);
  }
});

test('hidden and other-team schedules are not disclosed and viewers cannot plan changes',async t=>{
  const f=await fixture(t),a=f.add(),b=f.add({channelId:'b'});const view=f.capacity.workspace(f.manager);assert.equal(view.scope,'visible');assert.equal(view.jobs.length,1);assert.doesNotMatch(JSON.stringify(view),new RegExp(b.id));assert.throws(()=>f.capacity.preview(f.manager,{jobIds:[b.id]}),{status:404});assert.throws(()=>f.capacity.preview(f.viewer,{jobIds:[a.id]}),{status:403});
  f.store.put('channels','a',{...f.store.get('channels','a'),hidden:true});assert.equal(f.capacity.workspace(f.manager).jobs.length,0);
});

test('manual jobs do not consume the automatic budget and expired content cannot be moved',async t=>{
  const f=await fixture(t),manual=f.add({notifyOnly:true}),one=f.add(),two=f.add();
  assert.equal(f.capacity.workspace(f.admin).jobs.find(j=>j.jobId===manual.id).estimatedRequests,0);
  const post=f.store.get('socialPosts',two.postId);f.store.put('socialPosts',post.id,{...post,expiresAt:'2026-10-13T01:00:30.000Z'});
  const preview=f.capacity.preview(f.admin,{jobIds:[manual.id,two.id],maxShiftHours:1});assert.equal(preview.changes.find(c=>c.jobId===manual.id).excluded,true);assert.equal(preview.changes.find(c=>c.jobId===two.id).excluded,true);assert.equal(f.store.get('socialPublishJobs',one.id).scheduledAt,one.scheduledAt);
});

test('recent real requests and Retry-After influence the earliest proposed time',async t=>{
  const f=await fixture(t);f.setTime('2026-10-13T00:59:00.000Z');const job=f.add();f.store.put('socialProviderRequests','postiz',{times:Array(23).fill(Date.parse('2026-10-13T00:58:00.000Z')),retryAfter:Date.parse('2026-10-13T01:05:00.000Z')});
  const preview=f.capacity.preview(f.admin,{jobIds:[job.id]});assert.equal(preview.changes[0].to,'2026-10-13T01:58:00.000Z');assert.equal(f.sent,0);
});

test('restoring an unmovable later reservation cannot silently overload an earlier proposal',async t=>{
  const f=await fixture(t);for(let i=0;i<5;i++)f.add({mode:'fixed'});
  const a=f.add(),b=f.add({time:'2026-10-13T01:02:00.000Z'}),post=f.store.get('socialPosts',b.postId);f.store.put('socialPosts',b.postId,{...post,expiresAt:'2026-10-13T01:02:30.000Z'});
  const plan=f.capacity.preview(f.admin,{jobIds:[a.id,b.id],maxShiftHours:1});assert.equal(plan.changes.find(c=>c.jobId===b.id).excluded,true);assert.equal(plan.canApply,false);assert.ok(plan.warnings.some(message=>message.includes('분산 후에도')));assert.throws(()=>f.capacity.apply(f.admin,{previewId:plan.previewId,confirmed:true}),{status:409});assert.equal(f.store.get('socialPublishJobs',a.id).scheduledAt,a.scheduledAt);
});
