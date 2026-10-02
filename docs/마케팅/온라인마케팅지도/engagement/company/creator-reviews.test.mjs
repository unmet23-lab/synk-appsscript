import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createCreatorReviewsService,normalizeReviewMedia} from './creator-reviews.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-creator-review-')),store=new Store(directory);let tick=0;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-creator-review-'));await rm(directory,{recursive:true,force:true});});
  const owner=store.createUser({name:'Owner',email:'owner@example.test',role:'member',teamId:'team'}),peer=store.createUser({name:'Peer',email:'peer@example.test',role:'member',teamId:'team'}),manager=store.createUser({name:'Manager',email:'manager@example.test',role:'manager',teamId:'team'}),admin=store.createUser({name:'Admin',email:'admin@example.test',role:'admin'});
  const service=createCreatorReviewsService({store,clock:()=>new Date(Date.UTC(2026,9,2,0,0,tick++)).toISOString()});
  const review=service.workspace(owner).review;
  const blank=(extra={})=>({title:'검토할 실제 작업',preset:'youtube-shorts',media:null,checks:Object.fromEntries(review.map(row=>[row.id,{checked:false,note:''}])),...extra});
  return {store,service,owner,peer,manager,admin,blank};
}
const video=(extra={})=>({name:'작업.mp4',kind:'video',mime:'video/mp4',bytes:1000000,width:1080,height:1920,duration:30,...extra});

test('personal review records stay private even from same-team managers and company administrators',async t=>{
  const f=await fixture(t),record=f.service.save(f.owner,f.blank({audience:'개인 검토 메모',ownerId:f.peer.id})).record;assert.equal(record.ownerId,f.owner.id);
  assert.equal(f.service.workspace(f.owner).records.length,1);
  for(const other of [f.peer,f.manager,f.admin]){assert.equal(f.service.workspace(other).records.length,0);assert.throws(()=>f.service.save(other,f.blank({revision:record.revision}),record.id),e=>e.status===404);assert.throws(()=>f.service.archive(other,record.id,{revision:record.revision,archived:true}),e=>e.status===404);}
});
test('fresh account status and role override stale caller objects for reads, saves and archive changes',async t=>{
  const f=await fixture(t),record=f.service.save(f.owner,f.blank()).record;
  f.store.put('users',f.owner.id,{...f.owner,role:'viewer'});assert.equal(f.service.workspace(f.owner).canWrite,false);assert.equal(f.service.workspace(f.owner).records.length,1);
  assert.throws(()=>f.service.save(f.owner,f.blank()),e=>e.status===403);assert.throws(()=>f.service.archive(f.owner,record.id,{revision:1,archived:true}),e=>e.status===403);
  f.store.put('users',f.owner.id,{...f.owner,active:false});assert.throws(()=>f.service.workspace(f.owner),e=>e.status===401);assert.throws(()=>f.service.save(f.owner,f.blank()),e=>e.status===401);assert.throws(()=>f.service.archive(f.owner,record.id,{revision:1,archived:true}),e=>e.status===401);
});
test('optimistic revisions prevent lost updates and archived records require a reversible restore',async t=>{
  const f=await fixture(t),first=f.service.save(f.owner,f.blank()).record;
  const second=f.service.save(f.owner,f.blank({title:'보완한 작업',revision:first.revision}),first.id).record;assert.equal(second.revision,2);assert.equal(second.createdAt,first.createdAt);assert.notEqual(second.updatedAt,first.updatedAt);
  assert.throws(()=>f.service.save(f.owner,f.blank({revision:1}),first.id),e=>e.status===409);assert.throws(()=>f.service.archive(f.owner,first.id,{revision:1,archived:true}),e=>e.status===409);
  const archived=f.service.archive(f.owner,first.id,{revision:2,archived:true}).record;assert.equal(archived.archived,true);assert.equal(archived.revision,3);assert.throws(()=>f.service.save(f.owner,f.blank({revision:3}),first.id),e=>e.status===409);
  const restored=f.service.archive(f.owner,first.id,{revision:3,archived:false}).record;assert.equal(restored.archived,false);assert.equal(restored.revision,4);assert.equal(f.service.save(f.owner,f.blank({revision:4}),first.id).record.revision,5);
});
test('media normalization stores only bounded descriptive metadata and rejects paths or impossible measurements',()=>{
  const normalized=normalizeReviewMedia(video({rawFile:'private bytes',url:'blob:private',provenance:'platform-certified'}));assert.deepEqual(Object.keys(normalized).sort(),['bytes','duration','height','kind','mime','name','provenance','width'].sort());assert.equal(normalized.provenance,'browser-metadata');
  assert.equal(normalizeReviewMedia({name:'원본.webp',kind:'image',mime:'image/webp',bytes:100,width:1200,height:1200,duration:30}).duration,null);assert.equal(normalizeReviewMedia(null),null);
  for(const extra of [{name:'C:\\비공개\\작업.mp4'},{name:'folder/video.mp4'},{bytes:0},{bytes:2147483649},{bytes:1.5},{width:0},{width:32769},{height:1.1},{duration:0},{duration:Infinity},{duration:86401},{kind:'audio'},{mime:'application/javascript'}])assert.throws(()=>normalizeReviewMedia(video(extra)),undefined,JSON.stringify(extra));
});
test('review fields are validated against canonical questions and cannot imply automatic content approval',async t=>{
  const f=await fixture(t),base=f.blank();assert.throws(()=>f.service.save(f.owner,{...base,preset:'made-up'}),e=>e.status===400);assert.throws(()=>f.service.save(f.owner,{...base,title:' '}),e=>e.status===400);assert.throws(()=>f.service.save(f.owner,{...base,checks:{fake:{checked:true,note:''}}}),e=>e.status===400);
  const id=Object.keys(base.checks)[0];assert.throws(()=>f.service.save(f.owner,{...base,checks:{[id]:{checked:'yes'}}}),e=>e.status===400);assert.throws(()=>f.service.save(f.owner,{...base,checks:{[id]:{checked:true,note:'a'.repeat(1201)}}}),e=>e.status===400);
  const allChecks=Object.fromEntries(Object.keys(base.checks).map(key=>[key,{checked:true,note:'내가 직접 확인한 이유'}]));const record=f.service.save(f.owner,{...base,checks:allChecks}).record;assert.equal(record.checkCount,Object.keys(allChecks).length);assert.ok(record.analysis.every(row=>row.status==='unknown'));assert.ok(!Object.hasOwn(record,'approved'));assert.ok(!Object.hasOwn(record,'qualityScore'));
});
test('official comparison results are derived from stored metadata instead of caller supplied analysis',async t=>{
  const f=await fixture(t),record=f.service.save(f.owner,f.blank({media:video({width:1920,height:1080,duration:181}),analysis:[{status:'match'}]})).record;
  assert.equal(record.analysis.find(row=>row.label==='화면 비율').status,'review');assert.equal(record.analysis.find(row=>row.label==='재생 시간').status,'review');assert.equal(record.analysis.find(row=>row.label==='소리·자막·사용권').status,'unknown');
  assert.ok(!Object.hasOwn(f.store.get('creatorReviews',record.id),'analysis'));
});
test('archive input and text boundaries are enforced without erasing the previous record',async t=>{
  const f=await fixture(t),first=f.service.save(f.owner,f.blank()).record;
  assert.throws(()=>f.service.archive(f.owner,first.id,{revision:1,archived:'true'}),e=>e.status===400);
  for(const extra of [{audience:'a'.repeat(601)},{rights:'a'.repeat(1801)},{measurement:'a'.repeat(1001)},{title:'bad\u0000title'}])assert.throws(()=>f.service.save(f.owner,f.blank({...extra,revision:1}),first.id),e=>e.status===400);
  assert.equal(f.service.workspace(f.owner).records[0].revision,1);assert.equal(f.service.workspace(f.owner).records[0].title,first.title);
});
test('per-owner capacity includes archived records, ignores other owners and still permits updates',async t=>{
  const f=await fixture(t),first=f.service.save(f.owner,f.blank()).record;
  for(let index=1;index<300;index++)f.store.put('creatorReviews','own-'+index,{...first,id:'own-'+index,archived:true});
  for(let index=0;index<10;index++)f.store.put('creatorReviews','peer-'+index,{...first,id:'peer-'+index,ownerId:f.peer.id});
  assert.throws(()=>f.service.save(f.owner,f.blank()),e=>e.status===409);assert.equal(f.service.save(f.owner,f.blank({revision:1}),first.id).record.revision,2);assert.equal(f.service.save(f.peer,f.blank()).record.ownerId,f.peer.id);
});
