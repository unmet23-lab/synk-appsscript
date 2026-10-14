import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {performance} from 'node:perf_hooks';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialMarketingService} from './social-marketing.mjs';
import {createSocialCapacity} from './social-capacity.mjs';

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'sns-workspace-page-')),store=new Store(directory),time='2026-10-15T00:00:00.000Z';
  const admin={id:'admin',role:'admin',active:true},member={id:'member',role:'member',active:true},other={id:'other',role:'member',active:true};
  for(const user of [admin,member,other])store.put('users',user.id,user);
  for(const [id,owner] of [['a','member'],['b','other']])store.put('channels',id,{id,platform:'facebook',ownerIds:[owner],active:true});
  const service=createSocialPublishingService({store,clock:()=>time,provider:{capability:()=>({mode:'automatic',canPublish:true})}});
  t.after(async()=>{await service.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const post=(id,extra={})=>{const row={id,title:'원고 '+id,body:'본문',ownerId:'member',status:'draft',brandId:'brand',campaignId:'campaign',category:'학습',purpose:'듣기',language:'ko',media:[],variants:[{channelId:'a',text:'문구',title:'제목',format:'text',media:[],options:{}}],createdAt:time,updatedAt:time,contentVersion:1,...extra};store.put('socialPosts',id,row);return row;};
  const job=(id,p,extra={})=>{const row={id,postId:p.id,channelId:p.variants[0]?.channelId||'a',status:'scheduled',publisherId:'admin',scheduledAt:'2026-10-15T02:00:00.000Z',createdAt:time,updatedAt:time,contentVersion:1,snapshot:{post:p,variant:p.variants[0]},...extra};store.put('socialPublishJobs',id,row);return row;};
  return {directory,store,service,admin,member,other,post,job,time};
}

test('keyset pages keep tied dates complete without duplicate IDs and independently bound bodies',t=>{
  const f=fixture(t);for(let i=0;i<137;i++){const p=f.post('p'+String(i).padStart(3,'0'));f.job('j'+String(i).padStart(3,'0'),p);}
  const seenPosts=[],seenJobs=[];let postCursor,jobCursor,rounds=0;
  do{const page=f.service.workspace(f.member,{pageSize:17,section:'calendar',view:'list',date:'2026-10-15',postCursor,jobCursor});
    assert.ok(page.posts.length<=17);assert.ok(page.jobs.length<=17);assert.ok(page.linkedPosts.length<=17);assert.equal(page.counts.posts,137);assert.equal(page.counts.scheduled,137);
    assert.equal(page.pagination.posts.total,137);assert.equal(page.pagination.jobs.total,137);seenPosts.push(...page.posts.map(p=>p.id));seenJobs.push(...page.jobs.map(j=>j.id));
    assert.ok(page.posts.every(p=>p.hasActiveJobs===true));assert.ok(page.jobs.every(j=>[...page.posts,...page.linkedPosts].some(p=>p.id===j.postId)));
    postCursor=page.pagination.posts.nextCursor;jobCursor=page.pagination.jobs.nextCursor;rounds++;
  }while(postCursor||jobCursor);
  assert.equal(rounds,9);assert.equal(new Set(seenPosts).size,137);assert.equal(seenPosts.length,137);assert.equal(new Set(seenJobs).size,137);assert.equal(seenJobs.length,137);
});

test('counts, calendar days, occupied slots and tray inspect all jobs beyond a page',t=>{
  const f=fixture(t),p=f.post('many'),draft=f.post('unscheduled'),cancelled=f.post('cancelled');
  for(let i=0;i<125;i++)f.job('j'+i,p,{scheduledAt:'2026-10-15T02:00:00.000Z',status:i<60?'published':i<100?'scheduled':'failed',publishedAt:i<60?'2026-10-15T02:00:00.000Z':null});
  f.job('old',p,{scheduledAt:'2020-01-01T00:00:00.000Z'});f.job('cancelled',cancelled,{status:'cancelled'});
  const page=f.service.workspace(f.member,{pageSize:10,section:'calendar',view:'day',date:'2026-10-15'});
  assert.deepEqual(page.posts.map(p=>p.id).sort(),[cancelled.id,draft.id].sort());assert.equal(page.pagination.jobs.total,126);assert.equal(page.jobs.length,10);
  assert.deepEqual(page.summary.days,[{day:'2026-10-15',total:126,attention:25}]);assert.equal(page.occupiedSlots.length,1);
  assert.equal(page.summary.jobs.scheduled,41);assert.equal(page.summary.jobs.monthScheduled,40);assert.equal(page.summary.jobs.monthPublished,60);assert.equal(page.summary.jobs.attention,25);
  const queue=f.service.workspace(f.member,{pageSize:10,section:'queue',date:'2026-10-15'});assert.equal(queue.pagination.jobs.total,66);assert.equal(queue.summary.jobs.queue,66);assert.equal(queue.occupiedSlots.length,1);
});

test('page and summary recheck every current variant and historical job channel, including owner-only drafts',t=>{
  const f=fixture(t),allowed=f.post('allowed'),mixed=f.post('mixed',{variants:[...allowed.variants,{...allowed.variants[0],channelId:'b'}]}),empty=f.post('empty',{variants:[]}),privateEmpty=f.post('private-empty',{ownerId:'other',variants:[]});
  f.job('allowed-job',allowed);f.job('old-channel-job',allowed,{channelId:'b'});f.job('mixed-job',mixed);
  const page=f.service.workspace(f.member,{pageSize:1,section:'bulk'});assert.equal(page.counts.posts,2);assert.equal(page.counts.scheduled,1);assert.equal(page.jobs[0].id,'allowed-job');assert.doesNotMatch(JSON.stringify(page),/mixed-job|old-channel-job|private-empty/);
  const oldCursor=page.pagination.posts.nextCursor;f.store.put('channels','a',{...f.store.get('channels','a'),ownerIds:['other']});
  assert.throws(()=>f.service.workspace(f.member,{pageSize:1,section:'bulk',postCursor:oldCursor}),{status:400});
  const changed=f.service.summary(f.member);assert.deepEqual(changed.posts.map(p=>p.id),[empty.id]);assert.equal(changed.jobs.length,0);
  assert.throws(()=>f.service.get(f.member,allowed.id),{status:404});assert.throws(()=>f.service.getJob(f.member,'allowed-job'),{status:404});
  f.store.put('users','member',{...f.member,active:false});assert.throws(()=>f.service.summary(f.member),{status:401});
});

test('server filters preserve UI search, status-through-jobs, owner aliases and literal Unicode search',t=>{
  const f=fixture(t),post=f.post('match',{title:'ÉCOLE 한국어',body:'100% _ SQL',purpose:'Café 수업',brandId:'brand2',createdBy:'creator'});f.job('failed-job',post,{status:'failed'});f.post('other');
  for(const search of ['école','CAFÉ','100% _ SQL','한국어']){const page=f.service.workspace(f.member,{pageSize:10,section:'bulk',search,brandId:'brand2',status:'failed',ownerId:'creator'});assert.deepEqual(page.posts.map(p=>p.id),[post.id]);assert.equal(page.counts.attention,1);}
  assert.equal(f.service.workspace(f.member,{pageSize:10,section:'bulk',search:"' OR 1=1 --"}).posts.length,0);
  const cursor=f.service.workspace(f.member,{pageSize:1,section:'bulk'}).pagination.posts.nextCursor;
  assert.throws(()=>f.service.workspace(f.member,{pageSize:1,section:'bulk',search:'école',postCursor:cursor}),{status:400});
  for(const input of [{pageSize:101},{pageSize:0},{pageSize:1,postCursor:'!bad'},{pageSize:1,postCursor:Buffer.from('null').toString('base64url')},{pageSize:1,date:'2026-02-30'}])assert.throws(()=>f.service.workspace(f.member,input),{status:400});
});

test('derived projections invalidate after writes, rollback and external SQLite connections',t=>{
  const f=fixture(t),p=f.post('one');f.job('j1',p);assert.equal(f.service.summary(f.member).jobs[0].status,'scheduled');
  f.store.put('socialPublishJobs','j1',{...f.store.get('socialPublishJobs','j1'),status:'published'});assert.equal(f.service.summary(f.member).jobs[0].status,'published');
  assert.throws(()=>f.store.transaction(()=>{f.store.put('socialPosts','one',{...p,title:'rollback'});assert.equal(f.service.summary(f.member).posts[0].title,'rollback');throw Error('rollback');}));assert.equal(f.service.summary(f.member).posts[0].title,p.title);
  const other=new DatabaseSync(join(f.directory,'company.sqlite'));try{other.prepare('UPDATE documents SET body=? WHERE kind=? AND id=?').run(JSON.stringify({...p,title:'external'}),'socialPosts','one');assert.equal(f.service.summary(f.member).posts[0].title,'external');}finally{other.close();}
  const mutable=f.service.summary(f.member);mutable.posts[0].title='caller mutation';mutable.posts[0].variants[0].channelId='b';mutable.jobs[0].contentSummary.title='caller mutation';assert.equal(f.service.summary(f.member).posts[0].title,'external');assert.equal(f.service.summary(f.member).jobs[0].contentSummary.title,p.variants[0].title);
});

test('overview previews independently include old review drafts and future schedules beyond crowded result pages',t=>{
  const f=fixture(t),old='2020-01-01T00:00:00.000Z',review=f.post('old-review',{status:'review',updatedAt:old}),draft=f.post('old-draft',{status:'draft',updatedAt:old}),next=f.post('next',{status:'approved'});
  for(let i=0;i<70;i++){const p=f.post('past-'+i,{status:'published'});f.job('past-job-'+i,p,{status:'published',scheduledAt:old,publishedAt:old});f.job('attention-'+i,p,{status:'failed',scheduledAt:old});}
  f.job('future',next,{scheduledAt:'2026-10-20T00:00:00.000Z'});
  const page=f.service.workspace(f.admin,{pageSize:50,section:'overview'});assert.equal(page.jobs.some(j=>j.status==='scheduled'),false,'the normal first page is crowded with attention jobs');
  assert.equal(page.overview.review[0].id,review.id);assert.equal(page.overview.drafts[0].id,draft.id);assert.equal(page.overview.upcoming[0].id,'future');assert.ok(page.linkedPosts.some(p=>p.id===next.id));assert.equal(page.overview.attention.length,5);assert.equal(page.summary.jobs.attention,70);assert.equal(page.summary.posts.review,1);assert.equal(page.summary.jobs.scheduled,1);assert.equal(page.overview.review[0].canApprove,true);assert.equal(page.overview.upcoming[0].snapshot,undefined);assert.equal(page.overview.upcoming[0].handoff.text,next.variants[0].text);
});

test('compact full summaries preserve notification and historical performance attribution without rereading job snapshots',t=>{
  const f=fixture(t),p=f.post('one',{status:'review'});f.job('j1',p,{status:'published',publishedAt:f.time,publicationUrl:'https://www.facebook.com/1/posts/2',snapshot:{post:{...p,campaignId:'old-campaign',purpose:'old-purpose'},variant:{...p.variants[0],title:'Original approved title',format:'video'}}});
  const marketing=createSocialMarketingService({store:f.store,clock:()=>f.time}),legacy=f.service.workspace(f.admin),compact=f.service.summary(f.admin);
  assert.deepEqual(marketing.notifications(f.admin,compact),marketing.notifications(f.admin,legacy));
  const get=f.store.get.bind(f.store);f.store.get=(kind,...args)=>{assert.notEqual(kind,'socialPublishJobs','insights must use the already projected approved attribution');return get(kind,...args);};
  const insights=marketing.insights(f.admin,compact);assert.equal(insights.records[0].title,'Original approved title');assert.equal(insights.records[0].campaignId,'old-campaign');assert.equal(insights.records[0].purpose,'old-purpose');
});

test('capacity keeps exact full schedule estimates while reading no saved post or approved job bodies',t=>{
  const f=fixture(t),p=f.post('one',{approval:{hash:'approved'}});for(let i=0;i<80;i++)f.job('j'+i,p,{mode:'fixed',attempts:0,approvalHash:'approved',snapshot:{post:{...p,title:'승인 제목'},variant:{...p.variants[0],media:[{id:'one'},{id:'two'}],options:{coverUrl:'https://example.test/cover.jpg'}}}});
  const provider={settings:()=>({rateLimit:{requests:30}}),capability:()=>({mode:'automatic',canPublish:true})},capacity=createSocialCapacity({store:f.store,publishing:f.service,provider,clock:()=>f.time});
  const legacy=createSocialCapacity({store:f.store,publishing:{workspace:user=>f.service.workspace(user)},provider,clock:()=>f.time}).workspace(f.admin);
  const get=f.store.get.bind(f.store),allWhere=f.store.allWhere.bind(f.store);f.store.get=(kind,...args)=>{assert.ok(!['socialPosts','socialPublishJobs'].includes(kind),'capacity must use projected fields');return get(kind,...args);};f.store.allWhere=(kind,...args)=>{assert.notEqual(kind,'socialPublishJobs','no full approved snapshot collection');return allWhere(kind,...args);};
  const result=capacity.workspace(f.admin);assert.deepEqual(result,legacy);assert.equal(result.jobs.length,80);assert.equal(result.jobs[0].estimatedRequests,7);assert.equal(result.jobs[0].canMove,true);assert.ok(result.windows.some(w=>w.overLimit));
});

test('5000 large approved snapshots stay off the page payload and warm requests skip metadata scans',t=>{
  const f=fixture(t),body='확정 원고 '.repeat(2200);f.store.transaction(()=>{for(let i=0;i<250;i++){const p=f.post('p'+String(i).padStart(4,'0'),{body,history:Array.from({length:20},()=>({detail:body.slice(0,500)}))});for(let j=0;j<20;j++)f.job('j'+String(i*20+j).padStart(5,'0'),p,{status:j%3?'published':'scheduled',publishedAt:f.time});}});
  let fullAll=0;const all=f.store.all.bind(f.store);f.store.all=(kind)=>{if(['socialPosts','socialPublishJobs'].includes(kind))fullAll++;return all(kind);};
  let boundedRows=0;const plans=[],prepare=f.store.db.prepare.bind(f.store.db);f.store.db.prepare=text=>{const statement=prepare(text);if(text.includes('SELECT d.body FROM page')){const run=statement.all.bind(statement);statement.all=(...args)=>{const rows=run(...args);boundedRows+=rows.length;plans.push(...prepare('EXPLAIN QUERY PLAN '+text).all(...args).map(r=>r.detail));return rows;};}return statement;};
  const start=performance.now(),cold=f.store.readScope(()=>f.service.workspace(f.admin,{pageSize:50,section:'calendar',view:'month',date:'2026-10-15'})),coldMs=performance.now()-start;
  const warmStart=performance.now(),warm=f.store.readScope(()=>f.service.workspace(f.admin,{pageSize:50,section:'calendar',view:'month',date:'2026-10-15',jobCursor:cold.pagination.jobs.nextCursor})),warmMs=performance.now()-warmStart;
  assert.equal(fullAll,0);assert.equal(cold.jobs.length,50);assert.equal(cold.counts.posts,250);assert.equal(cold.counts.published,3250);assert.equal(cold.counts.scheduled,1750);assert.equal(warm.jobs.length,50);assert.equal(new Set([...cold.jobs,...warm.jobs].map(j=>j.id)).size,100);
  const serialized=JSON.stringify(cold),bodyMatches=serialized.split(body).length-1;assert.ok(bodyMatches<25,'only page-linked posts contain the source body, never all 5000 snapshots');
  assert.equal(boundedRows,102,'two LIMIT 51 queries read 50 rows and one continuation marker, not 10000 snapshots');assert.ok(plans.some(plan=>/SEARCH d USING INDEX sqlite_autoindex_documents_1 \(kind=\? AND id=\?\)/.test(plan)),'only the limited IDs join back to documents through its existing primary key');
  t.diagnostic(JSON.stringify({posts:250,jobs:5000,coldMs:Math.round(coldMs),warmMs:Math.round(warmMs),responseBytes:Buffer.byteLength(serialized),fullCollectionReads:fullAll,pageBodyRowsPerRequest:boundedRows/2,pageJobs:cold.jobs.length,linkedPosts:cold.linkedPosts.length,plan:[...new Set(plans)]}));
});
