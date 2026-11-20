import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {Store} from './store.mjs';
import {createStaffStories,STAFF_STORY_KINDS as K} from './staff-stories.mjs';

const origin='https://workspace.example.test';
let sequence=0;
const rid=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
const draft=(extra={})=>({title:'전주 첫 수업 이야기',body:'처음 맡은 반에서 배운 것',displayName:'합성 강사',note:'PRIVATE-NOTE 학생 실명 메모',...extra});
const confirmations={peopleConsent:true,noPromise:true};
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-staff-stories-')),store=new Store(directory);
  const users={};
  for(const [name,role] of [['a','member'],['b','member'],['manager','manager'],['admin','admin'],['viewer','viewer']])users[name]=store.createUser({email:name+'@staff-stories.test',name:'합성 '+name,role});
  let time='2026-11-20T00:00:00.000Z';const clock=()=>time;
  const stories=createStaffStories({store,origin,clock});
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-staff-stories-'));rmSync(directory,{recursive:true,force:true});});
  const create=(user=users.a,value=draft())=>stories.create(user,{action:'create',requestId:rid(),draft:value}).story;
  const act=(user,story,action,extra={})=>stories.mutate(user,story.id,{action,requestId:rid(),expectedRevision:story.revision,...extra});
  const publish=(user,story)=>act(user,story,'publish',{confirmations}).story;
  const ask=(publicId,extra={})=>stories.submit(publicId,{requestId:rid(),name:'방문자',email:'visitor-private@example.test',message:'PRIVATE-MESSAGE 수업 문의',consent:true,website:'',...extra},{client:'fixture-'+(++sequence)});
  return {store,users,stories,create,act,publish,ask,withPages:pages=>createStaffStories({store,origin,clock,pages}),advance:days=>time=new Date(Date.parse(time)+days*86400000).toISOString(),
    deactivate:user=>store.put('users',user.id,{...store.get('users',user.id),active:false}),
    setRole:(user,role)=>store.put('users',user.id,{...store.get('users',user.id),role})};
}
const code=expected=>error=>{assert.equal(error.code,expected);return true;};

test('문의 접수와 보관 정리는 다른 문의 본문을 읽지 않고 옛 시각 표기와 정확한 만료 경계를 처리한다',t=>{
  const f=fixture(t),story=f.publish(f.users.a,f.create());
  const {store,stories}=f,all=store.all.bind(store);
  store.all=kind=>{assert.notEqual(kind,K.inquiry,'접수와 보관 정리에서 모든 문의를 읽었다');return all(kind);};
  const seed=()=>f.ask(story.public.publicId).result.receiptId;
  const older=seed(),boundary=seed(),removed=seed(),current=seed();
  store.put(K.inquiry,older,{...store.get(K.inquiry,older),createdAt:'2026-11-20T08:59:59.999+09:00'});
  store.put(K.inquiry,boundary,{...store.get(K.inquiry,boundary),createdAt:'2026-11-20T09:00:00+09:00'});
  store.put(K.inquiry,removed,{...store.get(K.inquiry,removed),deletedAt:'2026-11-20T00:00:00.000Z'});
  f.advance(90);
  stories.maintain();
  for(const id of [older,removed]){
    assert.equal(store.get(K.inquiry,id),null);
    assert.equal(store.secret('staff-story-inquiry:'+id),null);
    assert.ok(store.get(K.closed,id)?.deletedAt);
  }
  for(const id of [boundary,current])assert.ok(store.secret('staff-story-inquiry:'+id));
  f.advance(1);
  stories.maintain();
  assert.equal(store.count(K.inquiry),0);
});

test('직원 홈과 글 저장은 본인 자료만 조회하고, 인계 건수는 계정 상태와 보관 기한을 따른다',t=>{
  const f=fixture(t),{a,b,admin,manager}=f.users;
  const aStory=f.publish(a,f.create(a)),bStory=f.publish(b,f.create(b));
  const first=f.ask(aStory.public.publicId).result, second=f.ask(aStory.public.publicId).result;
  f.ask(bStory.public.publicId);
  f.stories.inquiryAction(a,first.receiptId,{action:'done'});
  const getAll=f.store.all.bind(f.store);
  f.store.all=kind=>{
    assert.ok(![K.story,K.inquiry].includes(kind),'홈·저장은 회사 전체 글이나 문의를 가져오지 않는다');
    return getAll(kind);
  };
  for(const [author,expectedStories] of [[a,[aStory.id]],[b,[bStory.id]],[manager,[]]]){
    const board=f.stories.workspace(author);
    assert.ok(!Object.hasOwn(board,'heldInquiryCounts'));
    assert.deepEqual(board.stories.map(story=>story.id),expectedStories);
  }
  assert.equal(f.create(manager).status,'draft');
  assert.equal(f.stories.workspace(a).stories[0].inquiries.open,2);
  assert.equal(f.act(b,bStory,'save',{draft:draft({title:'고친 글'})}).story.inquiries.open,1);
  assert.deepEqual(f.stories.workspace(admin).heldInquiryCounts,{total:0,new:0});
  f.deactivate(a);
  assert.deepEqual(f.stories.workspace(admin).heldInquiryCounts,{total:2,new:1});
  assert.deepEqual(f.stories.heldInquiries(admin).inquiries.map(i=>i.id).sort(),[first.receiptId,second.receiptId].sort());
  assert.deepEqual(f.stories.workspace(admin).inquiries,[]);
  f.store.put('users',a.id,{...f.store.get('users',a.id),active:true});
  assert.deepEqual(f.stories.workspace(admin).heldInquiryCounts,{total:0,new:0});
  f.deactivate(a);
  f.stories.heldAction(admin,second.receiptId,{action:'delete'});
  f.advance(90);
  assert.deepEqual(f.stories.workspace(admin).heldInquiryCounts,{total:1,new:0});
  f.advance(1);
  assert.deepEqual(f.stories.workspace(admin).heldInquiryCounts,{total:0,new:0});
  assert.equal(f.stories.heldInquiries(admin).inquiries.length,0);
});

test('an ordinary member with no SNS duty saves, publishes and gets a real share link built from the registered origin',t=>{
  const f=fixture(t),empty=f.stories.workspace(f.users.a);
  assert.deepEqual(empty.stories,[]);assert.deepEqual(empty.inquiries,[]);assert.deepEqual(empty.totals,{stories:0,live:0,received:0,open:0});assert.equal(empty.canWrite,true);
  const story=f.create();assert.equal(story.status,'draft');assert.equal(story.public,null);assert.deepEqual(story.inquiries,{received:0,open:0,firstAt:null,lastAt:null});
  const live=f.publish(f.users.a,story);
  assert.equal(live.status,'live');assert.match(live.public.publicId,/^[A-Za-z0-9_-]{22}$/);assert.equal(live.public.url,origin+'/story/'+live.public.publicId);assert.equal(live.public.open,true);assert.equal(live.external,null);
  assert.equal(f.store.all('channels').length,0);assert.equal(f.store.get('users',f.users.a.id).role,'member');
  const view=f.stories.publicView(live.public.publicId);
  assert.deepEqual(view.story,{publicId:live.public.publicId,title:'전주 첫 수업 이야기',body:'처음 맡은 반에서 배운 것',displayName:'합성 강사',publishedAt:live.public.publishedAt});
  assert.doesNotMatch(JSON.stringify(view),/PRIVATE-NOTE|staff-stories\.test|합성 a/);
});

test('employees A and B, managers and admins never see each other’s drafts, notes or inquiries',t=>{
  const f=fixture(t),story=f.publish(f.users.a,f.create());f.ask(story.public.publicId);
  const inquiryId=f.stories.workspace(f.users.a).inquiries[0].id;
  for(const name of ['b','manager','admin','viewer']){
    const other=f.stories.workspace(f.users[name]);assert.deepEqual(other.stories,[]);assert.deepEqual(other.inquiries,[]);
    assert.doesNotMatch(JSON.stringify(other),/PRIVATE-|visitor-private/);
    assert.throws(()=>f.stories.inquiry(f.users[name],inquiryId),code('SYNK_STORY_NOT_FOUND'));
    if(name!=='viewer'){
      assert.throws(()=>f.stories.mutate(f.users[name],story.id,{action:'unpublish',requestId:rid(),expectedRevision:story.revision}),code('SYNK_STORY_NOT_FOUND'));
      assert.throws(()=>f.stories.inquiryAction(f.users[name],inquiryId,{action:'delete'}),code('SYNK_STORY_NOT_FOUND'));
    }
  }
  assert.deepEqual(f.stories.heldInquiries(f.users.admin).inquiries,[]);
  assert.throws(()=>f.stories.heldInquiry(f.users.admin,inquiryId),code('SYNK_STORY_NOT_FOUND'));
  assert.throws(()=>f.stories.heldInquiries(f.users.manager),code('SYNK_STORY_ADMIN'));
});

test('viewer accounts read their own stories but cannot write, and their public page closes',t=>{
  const f=fixture(t),story=f.publish(f.users.a,f.create());f.ask(story.public.publicId);
  f.setRole(f.users.a,'viewer');
  const mine=f.stories.workspace(f.users.a);assert.equal(mine.canWrite,false);assert.equal(mine.stories[0].public.open,false);assert.equal(mine.inquiries.length,1);
  assert.equal(f.stories.inquiry(f.users.a,mine.inquiries[0].id).inquiry.message,'PRIVATE-MESSAGE 수업 문의');
  assert.throws(()=>f.create(),code('SYNK_STORY_READONLY'));
  assert.throws(()=>f.act(f.users.a,mine.stories[0],'unpublish'),code('SYNK_STORY_READONLY'));
  assert.throws(()=>f.stories.publicView(story.public.publicId),code('SYNK_STORY_NOT_FOUND'));
  assert.throws(()=>f.ask(story.public.publicId),code('SYNK_STORY_NOT_FOUND'));
  assert.equal(f.stories.exists(story.public.publicId),false);
});

test('publishing needs both self-confirmations, a title and a public name; the body is optional for an inquiry-only page',t=>{
  const f=fixture(t),story=f.create(f.users.a,draft({title:'',displayName:''}));
  for(const confirmationsInput of [undefined,{peopleConsent:true},{peopleConsent:true,noPromise:false},{peopleConsent:'yes',noPromise:true},{...confirmations,extra:true}])
    assert.throws(()=>f.stories.mutate(f.users.a,story.id,{action:'publish',requestId:rid(),expectedRevision:1,...(confirmationsInput?{confirmations:confirmationsInput}:{})}),error=>error.status===400);
  assert.throws(()=>f.act(f.users.a,story,'publish',{confirmations}),error=>error.field==='title');
  const titled=f.act(f.users.a,story,'save',{draft:draft({title:'제목',displayName:'',body:''})}).story;
  assert.throws(()=>f.act(f.users.a,titled,'publish',{confirmations}),error=>error.field==='displayName');
  assert.equal(f.store.all(K.link).length,0,'a failed publish leaves no link');
  const ready=f.act(f.users.a,titled,'save',{draft:draft({title:'제목',displayName:'이름',body:''})}).story,live=f.publish(f.users.a,ready);
  assert.equal(f.stories.publicView(live.public.publicId).story.body,'');
});

test('the public copy changes only when republished; unpublish keeps the address and republish reuses it',t=>{
  const f=fixture(t),live=f.publish(f.users.a,f.create()),id=live.public.publicId;
  const edited=f.act(f.users.a,live,'save',{draft:draft({title:'고친 제목',note:'PRIVATE-NOTE-2'})}).story;
  assert.equal(edited.changedSincePublish,true);assert.equal(f.stories.publicView(id).story.title,'전주 첫 수업 이야기');
  const down=f.act(f.users.a,edited,'unpublish').story;assert.equal(down.status,'unpublished');assert.equal(down.public.open,false);
  assert.throws(()=>f.stories.publicView(id),code('SYNK_STORY_NOT_FOUND'));assert.throws(()=>f.ask(id),code('SYNK_STORY_NOT_FOUND'));
  assert.throws(()=>f.act(f.users.a,down,'unpublish'),code('SYNK_STORY_STATE'));
  const again=f.publish(f.users.a,down);assert.equal(again.public.publicId,id);assert.equal(f.stories.publicView(id).story.title,'고친 제목');assert.equal(again.changedSincePublish,false);
  assert.equal(f.store.all(K.link).length,1);
});

test('the share link exists before the personal post; the self-registered external URL is added later and is not a server claim',t=>{
  const f=fixture(t),live=f.publish(f.users.a,f.create());
  assert.equal(live.external,null);assert.equal(live.inquiries.received,0);
  for(const externalUrl of ['http://instagram.com/p/x','javascript:alert(1)','https://user:pw@example.test/','ftp://example.test','https://exa mple.test','x'.repeat(10)])
    assert.throws(()=>f.act(f.users.a,live,'link',{externalUrl}),error=>error.field==='externalUrl');
  const linked=f.act(f.users.a,live,'link',{externalUrl:'https://www.instagram.com/p/SYNTHETIC/'}).story;
  assert.deepEqual(linked.external,{url:'https://www.instagram.com/p/SYNTHETIC/',registeredAt:linked.updatedAt,source:'self'});
  assert.equal(linked.public.publicId,live.public.publicId);assert.equal(linked.inquiries.received,0);
  const draftOnly=f.act(f.users.a,f.create(),'link',{externalUrl:'https://blog.example.test/post'}).story;assert.equal(draftOnly.status,'draft');assert.equal(draftOnly.public,null);
  const cleared=f.act(f.users.a,linked,'link',{externalUrl:''}).story;assert.equal(cleared.external,null);
});

test('only accepted inquiries count; views do not, and a duplicate resend is one inquiry',t=>{
  const f=fixture(t),live=f.publish(f.users.a,f.create()),id=live.public.publicId;
  for(let i=0;i<5;i++)f.stories.publicView(id);
  assert.equal(f.stories.workspace(f.users.a).totals.received,0);
  const input={requestId:rid(),name:'방문자',email:'visitor-private@example.test',message:'PRIVATE-MESSAGE',consent:true,website:''};
  const first=f.stories.submit(id,input,{client:'x1'});assert.equal(first.status,201);assert.equal(first.result.accepted,true);assert.match(first.result.receiptId,/^story-[a-f0-9]{64}$/);
  const again=f.stories.submit(id,input,{client:'x2'});assert.equal(again.status,200);assert.equal(again.result.duplicate,true);assert.equal(again.result.receiptId,first.result.receiptId);
  assert.throws(()=>f.stories.submit(id,{...input,message:'다른 내용'},{client:'x3'}),code('SYNK_STORY_INQUIRY_CONFLICT'));
  const mine=f.stories.workspace(f.users.a);assert.equal(mine.totals.received,1);assert.equal(mine.stories[0].inquiries.received,1);assert.equal(mine.stories[0].inquiries.firstAt,'2026-11-20T00:00:00.000Z');
  assert.deepEqual(Object.keys(mine.inquiries[0]).sort(),['createdAt','id','status','storyId','storyTitle']);
  assert.doesNotMatch(JSON.stringify(mine.inquiries),/visitor-private|PRIVATE-MESSAGE/);
  assert.doesNotMatch(JSON.stringify(f.store.db.prepare('SELECT body FROM documents').all()),/visitor-private|PRIVATE-MESSAGE|PRIVATE-NOTE/);
  const detail=f.stories.inquiry(f.users.a,mine.inquiries[0].id).inquiry;assert.equal(detail.email,'visitor-private@example.test');assert.equal(detail.expiresAt,'2027-02-18T00:00:00.000Z');
});

test('visitor consent, required fields and the honeypot are enforced before anything is stored',t=>{
  const f=fixture(t),id=f.publish(f.users.a,f.create()).public.publicId;
  for(const [extra,field] of [[{consent:false},'consent'],[{consent:undefined},'consent'],[{email:'not-an-email'},'email'],[{email:''},'email'],[{message:'  '},'message'],[{message:'x'.repeat(4001)},'message'],[{website:'bot'},'website'],[{name:'x'.repeat(121)},'name'],[{requestId:'nope'},'requestId'],[{extra:1},'input']])
    assert.throws(()=>f.ask(id,extra),error=>error.status===400&&error.field===field,field);
  assert.equal(f.store.all(K.inquiry).length,0);assert.equal(f.store.all(K.count).length,0);
});

test('an inquiry does not bump the story revision, so an editor’s save still succeeds',t=>{
  const f=fixture(t),live=f.publish(f.users.a,f.create());f.ask(live.public.publicId);f.ask(live.public.publicId);
  const saved=f.act(f.users.a,live,'save',{draft:draft({title:'편집 중'})}).story;assert.equal(saved.revision,live.revision+1);assert.equal(saved.inquiries.received,2);
});

test('lost responses: create, mutations and delete are idempotent per request ID; stale revisions return the latest copy',t=>{
  const f=fixture(t),requestId=rid(),input={action:'create',requestId,draft:draft()};
  const first=f.stories.create(f.users.a,input),retry=f.stories.create(f.users.a,input);
  assert.equal(first.status,201);assert.equal(retry.status,200);assert.equal(retry.duplicate,true);assert.equal(retry.story.id,first.story.id);assert.equal(f.stories.workspace(f.users.a).stories.length,1);
  assert.throws(()=>f.stories.create(f.users.a,{...input,draft:draft({title:'다름'})}),code('SYNK_STORY_REQUEST_CONFLICT'));
  const otherOwner=f.stories.create(f.users.b,input);assert.notEqual(otherOwner.story.id,first.story.id,'the same request ID from B is B’s own story');
  const save={action:'save',requestId:rid(),expectedRevision:1,draft:draft({title:'두 번째'})};
  const saved=f.stories.mutate(f.users.a,first.story.id,save),resaved=f.stories.mutate(f.users.a,first.story.id,save);
  assert.equal(saved.story.revision,2);assert.equal(resaved.duplicate,true);assert.equal(resaved.story.revision,2);
  assert.throws(()=>f.stories.mutate(f.users.a,first.story.id,{...save,draft:draft({title:'세 번째'})}),code('SYNK_STORY_REQUEST_CONFLICT'));
  let conflict;assert.throws(()=>f.stories.mutate(f.users.a,first.story.id,{action:'save',requestId:rid(),expectedRevision:1,draft:draft({title:'옛 탭'})}),error=>{conflict=error;return error.code==='SYNK_STORY_CONFLICT';});
  assert.equal(conflict.status,409);assert.equal(conflict.story.draft.title,'두 번째');
  const remove={action:'delete',requestId:rid(),expectedRevision:2};
  assert.deepEqual(f.stories.mutate(f.users.a,first.story.id,remove),{deleted:true,id:first.story.id});
  assert.deepEqual(f.stories.mutate(f.users.a,first.story.id,remove),{deleted:true,id:first.story.id,duplicate:true});
  assert.throws(()=>f.stories.create(f.users.a,input),code('SYNK_STORY_REQUEST_CONFLICT'),'a deleted story is not recreated by an old request');
});

test('stories with open inquiries can only be unpublished; deleted stories never reopen their link',t=>{
  const f=fixture(t),live=f.publish(f.users.a,f.create()),id=live.public.publicId;f.ask(id);
  assert.throws(()=>f.act(f.users.a,live,'delete'),code('SYNK_STORY_HAS_INQUIRIES'));
  const inquiry=f.stories.workspace(f.users.a).inquiries[0];
  assert.deepEqual(f.stories.inquiryAction(f.users.a,inquiry.id,{action:'done'}).inquiry.status,'done');
  assert.deepEqual(f.stories.inquiryAction(f.users.a,inquiry.id,{action:'delete'}),{ok:true,deleted:true});
  assert.equal(f.store.secret('staff-story-inquiry:'+inquiry.id),null);
  const current=f.stories.workspace(f.users.a).stories[0];assert.equal(current.inquiries.received,1,'performance survives deletion');assert.equal(current.inquiries.open,0);
  f.act(f.users.a,current,'delete');
  assert.throws(()=>f.stories.publicView(id),code('SYNK_STORY_NOT_FOUND'));assert.equal(f.stories.workspace(f.users.a).stories.length,0);
  assert.equal(f.store.get(K.link,id).deletedAt,'2026-11-20T00:00:00.000Z');
});

test('visitor receipts confirm, delete and never revive; 90-day retention erases secrets but keeps the count',t=>{
  const f=fixture(t),id=f.publish(f.users.a,f.create()).public.publicId,requestId=rid();
  const input={requestId,name:'',email:'v@example.test',message:'PRIVATE-MESSAGE',consent:true};
  const {result}=f.stories.submit(id,input,{client:'c'});
  assert.equal(f.stories.lookup({requestId},{client:'c'}).state,'received');
  assert.deepEqual(f.stories.lookup({requestId:rid()},{client:'c'}),{ok:true,found:false,accepted:false,state:'unavailable'});
  assert.throws(()=>f.stories.removeByVisitor({receiptId:result.receiptId,deleteToken:'0'.repeat(64)},{client:'c'}),code('SYNK_STORY_RECEIPT'));
  assert.deepEqual(f.stories.removeByVisitor({receiptId:result.receiptId,deleteToken:result.deleteToken},{client:'c'}),{ok:true,deleted:true});
  assert.equal(f.store.secret('staff-story-inquiry:'+result.receiptId),null);
  const resend=f.stories.submit(id,input,{client:'d'});assert.equal(resend.status,200);assert.equal(resend.result.deleted,true);assert.equal(resend.result.accepted,false);
  assert.equal(f.store.secret('staff-story-inquiry:'+result.receiptId),null);assert.equal(f.stories.workspace(f.users.a).inquiries.length,0);
  const keptInput={requestId:rid(),name:'남길 방문자',email:'kept@example.test',message:'PRIVATE-KEPT',consent:true},kept=f.stories.submit(id,keptInput,{client:'k'}).result;
  f.advance(89);assert.ok(f.store.secret('staff-story-inquiry:'+kept.receiptId));
  f.advance(1.01);f.stories.maintain();
  assert.equal(f.store.secret('staff-story-inquiry:'+kept.receiptId),null);assert.equal(f.store.get(K.inquiry,kept.receiptId),null);
  // 접수 91일째: 방문자가 지운 문의와 기한이 지난 문의를 같은 요청으로 다시 보내도 되살아나지 않고 건수도 그대로다.
  for(const [old,client] of [[input,'e1'],[keptInput,'e2']]){
    const again=f.stories.submit(id,old,{client});assert.equal(again.status,200);assert.equal(again.result.accepted,false);assert.equal(again.result.deleted,true);
    assert.equal(f.stories.lookup({requestId:old.requestId},{client}).state,'deleted');
  }
  const mine=f.stories.workspace(f.users.a);assert.equal(mine.inquiries.length,0);assert.equal(mine.totals.received,2);
  assert.equal(f.store.all(K.inquiry).length,0);
  for(const row of f.store.all(K.closed))assert.deepEqual(Object.keys(row).sort(),['deletedAt','id']);
  assert.doesNotMatch(JSON.stringify(f.store.db.prepare('SELECT body FROM documents').all()),/PRIVATE-|@example\.test|방문자|전주 첫 수업/);
  assert.doesNotMatch(JSON.stringify(f.store.all(K.closed)),new RegExp(result.deleteToken+'|'+kept.deleteToken));
});

test('older inquiry rows are recognised: a v1 deleted row becomes the minimal closed record, and a row missing its secret is never re-accepted',t=>{
  const f=fixture(t),id=f.publish(f.users.a,f.create()).public.publicId,input={requestId:rid(),email:'old@example.test',message:'PRIVATE-OLD',consent:true};
  const row=f.store.get(K.inquiry,f.stories.submit(id,input,{client:'o'}).result.receiptId);
  f.store.deleteSecret('staff-story-inquiry:'+row.id);f.store.put(K.inquiry,row.id,{...row,storyTitle:'',deletedAt:'2026-11-20T00:00:00.000Z'});
  const again=f.stories.submit(id,input,{client:'p'});assert.equal(again.status,200);assert.equal(again.result.deleted,true);
  assert.equal(f.store.get(K.inquiry,row.id),null);assert.deepEqual(f.store.get(K.closed,row.id),{id:row.id,deletedAt:'2026-11-20T00:00:00.000Z'});
  const partial={requestId:rid(),email:'partial@example.test',message:'PRIVATE-PARTIAL',consent:true},receipt=f.stories.submit(id,partial,{client:'q'}).result.receiptId;
  f.store.deleteSecret('staff-story-inquiry:'+receipt);
  assert.throws(()=>f.stories.submit(id,partial,{client:'r'}),code('SYNK_STORY_INQUIRY_CONFLICT'));
  assert.equal(f.store.secret('staff-story-inquiry:'+receipt),null);assert.equal(f.stories.workspace(f.users.a).totals.received,2);
});

test('without the visitor screens drafts still save, publishing is refused, and earlier public copies show no share link until the screens return',t=>{
  const f=fixture(t),earlier=f.publish(f.users.a,f.create()),publicId=earlier.public.publicId,{result}=f.ask(publicId);
  const off=f.withPages(false),draftOnly=off.create(f.users.a,{action:'create',requestId:rid(),draft:draft({title:'화면 없이 쓴 초안'})}).story;
  const mine=off.workspace(f.users.a),shown=mine.stories.find(row=>row.id===earlier.id);
  assert.equal(mine.canPublish,false);assert.equal(mine.canWrite,true);
  assert.equal(shown.status,'live');assert.equal(shown.public.publicId,publicId);assert.equal(shown.public.url,null);assert.equal(shown.public.open,false);
  assert.throws(()=>off.mutate(f.users.a,draftOnly.id,{action:'publish',requestId:rid(),expectedRevision:1,confirmations}),error=>error.status===503&&error.code==='SYNK_STORY_PAGES_OFF'&&error.story.public===null);
  assert.equal(f.store.all(K.link).length,1);assert.equal(f.store.get(K.story,draftOnly.id).publicCipher,null);assert.equal(f.store.get(K.story,draftOnly.id).revision,1);
  assert.equal(off.mutate(f.users.a,draftOnly.id,{action:'save',requestId:rid(),expectedRevision:1,draft:draft({title:'고친 초안'})}).story.draft.title,'고친 초안');
  assert.doesNotMatch(JSON.stringify(f.store.db.prepare('SELECT body FROM documents').all()),/고친 초안|PRIVATE-NOTE/);
  assert.throws(()=>off.publicView(publicId),code('SYNK_STORY_NOT_FOUND'));assert.equal(off.exists(publicId),false);
  assert.throws(()=>off.submit(publicId,{requestId:rid(),email:'v@example.test',message:'m',consent:true},{client:'z'}),code('SYNK_STORY_NOT_FOUND'));
  assert.equal(off.inquiry(f.users.a,mine.inquiries[0].id).inquiry.message,'PRIVATE-MESSAGE 수업 문의');
  assert.equal(off.lookup({receiptId:result.receiptId,deleteToken:result.deleteToken},{client:'z'}).state,'received');
  const on=f.withPages(true),back=on.workspace(f.users.a).stories.find(row=>row.id===earlier.id);
  assert.equal(back.public.url,origin+'/story/'+publicId);assert.equal(back.public.open,true);assert.equal(on.publicView(publicId).story.publicId,publicId);
  assert.deepEqual(off.removeByVisitor({receiptId:result.receiptId,deleteToken:result.deleteToken},{client:'z'}),{ok:true,deleted:true});
});

test('a retried request is still recognised after another tab changed the story; a non-string action is refused without a write',t=>{
  const f=fixture(t),story=f.create(),save={action:'save',requestId:rid(),expectedRevision:1,draft:draft({title:'첫 탭 저장'})};
  f.stories.mutate(f.users.a,story.id,save);
  const published=f.stories.mutate(f.users.a,story.id,{action:'publish',requestId:rid(),expectedRevision:2,confirmations}).story;
  const retry=f.stories.mutate(f.users.a,story.id,save);
  assert.equal(retry.duplicate,true);assert.equal(retry.story.revision,published.revision);assert.equal(retry.story.public.title,'첫 탭 저장');
  assert.throws(()=>f.stories.mutate(f.users.a,story.id,{...save,draft:draft({title:'다른 내용'})}),code('SYNK_STORY_REQUEST_CONFLICT'));
  for(const action of [['delete'],['save'],{},1])assert.throws(()=>f.stories.mutate(f.users.a,story.id,{action,requestId:rid(),expectedRevision:published.revision}),error=>error.status===400&&error.field==='action');
  assert.equal(f.store.get(K.story,story.id).revision,published.revision);assert.equal(f.stories.workspace(f.users.a).stories.length,1);
  assert.equal(f.act(f.users.a,published,'save',{draft:draft({title:'정상 탭'})}).story.revision,published.revision+1);
  let current=f.stories.workspace(f.users.a).stories[0];for(let i=0;i<55;i++)current=f.act(f.users.a,current,'link',{externalUrl:''}).story;
  assert.equal(f.store.get(K.story,story.id).mutations.length,50);
});

test('a suspended owner closes the page and intake at once; only active admins open the held inquiries until retention ends',t=>{
  const f=fixture(t),id=f.publish(f.users.a,f.create()).public.publicId;f.ask(id);f.deactivate(f.users.a);
  assert.throws(()=>f.stories.publicView(id),code('SYNK_STORY_NOT_FOUND'));assert.throws(()=>f.ask(id),code('SYNK_STORY_NOT_FOUND'));
  assert.throws(()=>f.stories.workspace(f.users.a),code('SYNK_STORY_LOGIN'));
  const held=f.stories.heldInquiries(f.users.admin).inquiries;assert.equal(held.length,1);assert.equal(held[0].ownerName,'합성 a');
  assert.equal(f.stories.heldInquiry(f.users.admin,held[0].id).inquiry.message,'PRIVATE-MESSAGE 수업 문의');
  assert.throws(()=>f.stories.heldInquiries(f.users.b),code('SYNK_STORY_ADMIN'));
  f.store.put('users',f.users.a.id,{...f.store.get('users',f.users.a.id),active:true});
  assert.deepEqual(f.stories.heldInquiries(f.users.admin).inquiries,[],'a reactivated owner takes the inquiries back');
  assert.equal(f.stories.publicView(id).story.publicId,id);
  f.deactivate(f.users.a);assert.deepEqual(f.stories.heldAction(f.users.admin,held[0].id,{action:'delete'}),{ok:true,deleted:true});
  assert.equal(f.store.secret('staff-story-inquiry:'+held[0].id),null);
});

test('inputs are bounded and unknown fields, other actions and bad IDs fail without writing',t=>{
  const f=fixture(t),before=f.store.db.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
  for(const value of [draft({title:'x'.repeat(121)}),draft({displayName:'x'.repeat(41)}),draft({body:'x'.repeat(4001)}),draft({note:'x'.repeat(4001)}),draft({title:'줄\n바꿈'}),{...draft(),ownerId:f.users.b.id}])
    assert.throws(()=>f.stories.create(f.users.a,{action:'create',requestId:rid(),draft:value}),error=>error.status===400);
  assert.throws(()=>f.stories.create(f.users.a,{action:'create',requestId:rid(),draft:draft(),ownerId:f.users.b.id}),error=>error.status===400);
  assert.throws(()=>f.stories.mutate(f.users.a,'../x',{action:'save',requestId:rid(),expectedRevision:1,draft:draft()}),code('SYNK_STORY_NOT_FOUND'));
  assert.throws(()=>f.stories.mutate(f.users.a,rid(),{action:'send',requestId:rid(),expectedRevision:1}),error=>error.field==='action');
  for(const publicId of ['short','x'.repeat(22),'../../etc/passwd/xxxxxx'])assert.throws(()=>f.stories.publicView(publicId),code('SYNK_STORY_NOT_FOUND'));
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM documents').get().n,before);
});

// 서비스 객체만 부르는 합성 단위 시험이다. 서버나 네트워크로 요청을 보내지 않는다.
test('intake is rate limited per visitor address and overall',t=>{
  const f=fixture(t),id=f.publish(f.users.a,f.create()).public.publicId,send=client=>f.stories.submit(id,{requestId:rid(),email:'v@example.test',message:'m',consent:true},{client});
  for(let i=0;i<5;i++)send('same');
  assert.throws(()=>send('same'),error=>error.code==='SYNK_STORY_BUSY'&&error.status===429&&error.retryAfterSeconds>0);
  for(let i=5;i<200;i++)assert.equal(send('visitor-'+i).status,201);
  assert.throws(()=>send('visitor-new'),error=>error.code==='SYNK_STORY_BUSY'&&error.status===429&&error.retryAfterSeconds>0);
  assert.equal(f.store.all(K.inquiry).length,200);assert.equal(f.stories.workspace(f.users.a).totals.received,200);
  f.advance(61/86400);assert.equal(send('visitor-new').status,201);
});
