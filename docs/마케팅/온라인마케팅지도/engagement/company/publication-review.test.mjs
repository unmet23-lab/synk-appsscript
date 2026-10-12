import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationPackageService} from './publication-package.mjs';
import {createPublicationReviewService} from './publication-review.mjs';

const BASE='2026-10-12T03:00:00.000Z';
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-publication-review-'));let store=new Store(directory),at=BASE,studio,packages,review;
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['peer','member','a'],['other','member','b'],['viewer','viewer','a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@publication-review.example',role,teamId});
  function services(){studio=createStudioService({store,clock:()=>at});packages=createPublicationPackageService({store,studio,clock:()=>at});review=createPublicationReviewService({store,studio,publicationPackages:packages,clock:()=>at});}services();
  t.after(async()=>{await packages.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-publication-review-')));rmSync(directory,{recursive:true,force:true});});
  function production(){const created=studio.saveProduction(users.owner,{title:'합성 원본',stage:'ready'}).production;return addVersion(created);}
  function addVersion(row){const media={id:randomUUID(),diskName:randomUUID()+'.mp4',mimeType:'video/mp4',fileName:'video.mp4',byteSize:100},production=studio.addMedia(users.owner,row.id,media,'영상 v'+((row.versions?.length||0)+1)).production;return {production,version:production.versions.at(-1),media};}
  function pack({source=production(),link='',warning=false,failure=false,subtitleText=''}={}){
    const checks=[{label:'원본 보존',status:'match',detail:'생성 시 SHA256 대조'},{label:'자료 링크',status:link?'review':'unknown',detail:'형식만 검사'},{label:'자막',status:subtitleText?'match':'unknown',detail:'자막 직접 확인 필요'},{label:'최종 시청·청취·사용권',status:'unknown',detail:'직접 확인 필요'}];
    const outputChecks=[{label:'해상도',status:failure?'fail':warning?'review':'match',detail:'1080 × 1920'},{label:'소리·자막·사용권',status:'unknown',detail:'직접 확인 필요'}];
    const row={id:randomUUID(),title:'합성 게시 묶음',productionId:source.production.id,versionId:source.version.id,state:'prepared',createdAt:at,body:'원본 게시문',link,language:'ko',mode:'original',channels:['youtube-shorts'],source:{...source.media,productionId:source.production.id,sha256:'0'.repeat(64)},outputs:[{channel:'youtube-shorts',label:'YouTube Shorts',mediaId:source.media.id,diskName:source.media.diskName,mimeType:'video/mp4',sha256:'0'.repeat(64),checks:outputChecks}],subtitleText,subtitle:subtitleText?{errors:0,warnings:0}:null,checks};store.put('studioPublicationPackages',row.id,row);return {row,...source};
  }
  const get=(p,user=users.owner)=>review.get(user,p.row.id).review;
  function update(p,id,status='confirmed',note='',user=users.owner){return review.update(user,p.row.id,{revision:get(p,user).revision,checkId:id,status,note}).review;}
  function complete(p){for(const item of get(p).manual)if(!item.locked)update(p,item.id,'confirmed',item.id==='technical'?'출력 규격과 실제 재생을 직접 대조했습니다.':'');return get(p);}
  return {users,pack,production,addVersion,get,update,complete,get store(){return store;},get studio(){return studio;},get review(){return review;},now(value){at=value;},async restart(){await packages.stop();store.close();store=new Store(directory);services();}};
}

test('a review read projects version-bound existing checks without creating records or mutating the package',t=>{
  const f=fixture(t),p=f.pack(),before=f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),review=f.get(p);
  assert.equal(review.packageId,p.row.id);assert.equal(review.productionId,p.production.id);assert.equal(review.versionId,p.version.id);assert.equal(review.isLatestVersion,true);assert.equal(review.revision,0);assert.equal(review.canEdit,true);assert.equal(review.summary.status,'pending');assert.equal(review.summary.pendingCount,5);assert.equal(review.summary.notApplicableCount,1);assert.equal(review.summary.automaticIssueCount,0);assert.equal(review.manual.find(item=>item.id==='link').locked,true);assert.match(review.manual.find(item=>item.id==='video').detail,/모든 채널 출력본/);assert.ok(review.automatic.some(item=>item.label.includes('YouTube Shorts')));
  assert.deepEqual(f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),before);assert.equal(f.store.all('publicationPackageReviews').length,0);
});

test('manual completion resolves linked unknown checks without claiming an automatic playback or rights pass',t=>{
  const f=fixture(t),p=f.pack({link:'https://example.test/guide'}),review=f.complete(p);
  assert.equal(review.summary.status,'complete');assert.equal(review.summary.confirmedCount,6);assert.equal(review.summary.pendingCount,0);assert.equal(review.summary.automaticIssueCount,0);assert.ok(review.automatic.every(item=>item.resolved));const human=review.automatic.find(item=>item.label==='최종 시청·청취·사용권');assert.equal(human.status,'unknown','human confirmation does not rewrite the automatic result');assert.deepEqual(f.store.get('studioPublicationPackages',p.row.id),p.row);
});

test('server identity, confirmation time and note survive reopen and restart',async t=>{
  const f=fixture(t),p=f.pack();f.now('2026-10-12T04:00:00.000Z');const saved=f.update(p,'video','confirmed','모든 출력본을 끝까지 확인했습니다.'),item=saved.manual.find(row=>row.id==='video');
  assert.equal(saved.revision,1);assert.equal(item.reviewerId,f.users.owner.id);assert.equal(item.reviewerName,'owner');assert.equal(item.reviewedAt,'2026-10-12T04:00:00.000Z');assert.equal(saved.updatedAt,item.reviewedAt);assert.equal(item.note,'모든 출력본을 끝까지 확인했습니다.');await f.restart();assert.deepEqual(f.get(p),saved);assert.equal(f.store.get('publicationPackageReviews',p.row.id).history.length,1);
});

test('problems need a note and can be reopened or confirmed with a new revision',t=>{
  const f=fixture(t),p=f.pack();assert.throws(()=>f.update(p,'subtitles','needs-work'),{status:400});let review=f.update(p,'subtitles','needs-work','두 번째 자막의 타이밍을 다시 확인해야 합니다.');assert.equal(review.summary.status,'needs-work');assert.equal(review.summary.needsWorkCount,1);
  review=f.update(p,'subtitles','pending','수정본을 다시 확인할 예정입니다.');assert.equal(review.summary.needsWorkCount,0);assert.equal(review.manual.find(item=>item.id==='subtitles').status,'pending');review=f.update(p,'subtitles','confirmed','타이밍을 대조했습니다.');assert.equal(review.revision,3);assert.equal(review.manual.find(item=>item.id==='subtitles').status,'confirmed');
});

test('stale revisions reject lost updates and do not change history',t=>{
  const f=fixture(t),p=f.pack();f.update(p,'video');const before=f.store.get('publicationPackageReviews',p.row.id);
  assert.throws(()=>f.review.update(f.users.owner,p.row.id,{revision:0,checkId:'audio',status:'confirmed',note:''}),{status:409});assert.deepEqual(f.store.get('publicationPackageReviews',p.row.id),before);assert.equal(f.get(p).manual.find(item=>item.id==='audio').status,'pending');
});

test('only audio permits a reasoned not-applicable state; absent links are a read-only system classification',t=>{
  const f=fixture(t),p=f.pack();assert.throws(()=>f.update(p,'audio','not-applicable'),{status:400});const review=f.update(p,'audio','not-applicable','의도적으로 소리가 없는 영상입니다.');assert.equal(review.manual.find(item=>item.id==='audio').status,'not-applicable');
  for(const id of ['video','copy','rights','subtitles'])assert.throws(()=>f.update(p,id,'not-applicable','해당 없음'),{status:400});assert.throws(()=>f.update(p,'link','confirmed'),{status:400});assert.throws(()=>f.update(p,'link','not-applicable','없음'),{status:400});
  const linked=f.pack({link:'https://example.test/file'});assert.equal(f.get(linked).manual.find(item=>item.id==='link').locked,false);assert.throws(()=>f.update(linked,'link','not-applicable','없음'),{status:400});
});

test('technical warnings create one explicit evidence-bearing check and do not double count human work',t=>{
  const f=fixture(t),p=f.pack({warning:true}),before=f.get(p);assert.equal(before.manual.filter(item=>item.id==='technical').length,1);assert.equal(before.summary.pendingCount,6);assert.equal(before.summary.automaticIssueCount,0);
  assert.throws(()=>f.update(p,'technical','confirmed'),{status:400});const done=f.complete(p);assert.equal(done.summary.status,'complete');const warning=done.automatic.find(item=>item.status==='warn');assert.equal(warning.resolved,true);assert.equal(warning.status,'warn');
});

test('automatic errors cannot be overridden by manual completion or forged check IDs',t=>{
  const f=fixture(t),p=f.pack({failure:true});const done=f.complete(p);assert.equal(done.summary.status,'needs-work');assert.equal(done.summary.automaticIssueCount,1);assert.equal(done.automatic.find(item=>item.status==='fail').resolved,false);
  assert.throws(()=>f.update(p,'output:0:0','confirmed','무시'),{status:400});assert.throws(()=>f.update(p,'package:0','confirmed','무시'),{status:400});assert.throws(()=>f.review.update(f.users.owner,p.row.id,{revision:done.revision,checkId:'video',status:'confirmed',reviewerId:'forged'}),{status:400});
});

test('every new package starts fresh even when it references the same video version',t=>{
  const f=fixture(t),first=f.pack();f.complete(first);
  for(const extra of [{body:'새 게시문'},{link:'https://example.test/new'},{subtitleText:'새 자막'},{channels:['instagram-reels']}]){
    const next={...first.row,...extra,id:randomUUID()};f.store.put('studioPublicationPackages',next.id,next);const review=f.review.get(f.users.owner,next.id).review;assert.equal(review.revision,0);assert.equal(review.manual.find(item=>item.id==='video').status,'pending');assert.equal(review.summary.status,'pending');
  }
  assert.equal(f.get(first).summary.status,'complete');
});

test('new video versions do not inherit review and old versions stay accessible with an explicit latest marker',t=>{
  const f=fixture(t),old=f.pack();f.complete(old);const nextSource=f.addVersion(f.store.get('studioProductions',old.production.id)),latest=f.pack({source:nextSource});
  const prior=f.get(old),current=f.get(latest);assert.equal(prior.summary.status,'complete');assert.equal(prior.isLatestVersion,false);assert.equal(prior.latestVersionId,nextSource.version.id);assert.equal(current.isLatestVersion,true);assert.equal(current.summary.status,'pending');assert.equal(current.revision,0);
});

test('unexpected changes inside an existing package invalidate prior confirmations while preserving the conflict revision',t=>{
  const f=fixture(t),p=f.pack();f.complete(p);const old=f.get(p),rawReview=f.store.get('publicationPackageReviews',p.row.id);f.store.put('studioPublicationPackages',p.row.id,{...p.row,body:'바뀐 게시문'});
  let review=f.get(p);assert.equal(review.invalidated,true);assert.equal(review.revision,old.revision);assert.equal(review.manual.find(item=>item.id==='video').status,'pending');assert.equal(review.updatedAt,null);assert.deepEqual(f.store.get('publicationPackageReviews',p.row.id),rawReview,'GET must not rewrite the historic evidence');
  review=f.update(p,'copy','confirmed','새 게시문을 대조했습니다.');assert.equal(review.invalidated,false);assert.equal(review.revision,old.revision+1);assert.equal(review.manual.find(item=>item.id==='video').status,'pending');assert.equal(review.manual.find(item=>item.id==='copy').status,'confirmed');
});

test('current source permissions gate both notes and writes, including role changes and archived production',t=>{
  const f=fixture(t),p=f.pack();f.update(p,'video','confirmed','PRIVATE-REVIEW-NOTE');assert.throws(()=>f.get(p,f.users.other),{status:404});
  f.store.put('studioProductions',p.production.id,{...f.store.get('studioProductions',p.production.id),teamId:'a'});assert.equal(f.get(p,f.users.peer).canEdit,false);assert.equal(f.get(p,f.users.viewer).canEdit,false);assert.throws(()=>f.update(p,'audio','confirmed','',f.users.peer),{status:403});assert.throws(()=>f.update(p,'audio','confirmed','',f.users.viewer),{status:403});
  f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal(f.get(p,{...f.users.owner,role:'admin'}).canEdit,false);assert.throws(()=>f.update(p,'audio','confirmed','',{...f.users.owner,role:'admin'}),{status:403});
  f.store.put('users',f.users.owner.id,f.users.owner);f.store.put('studioProductions',p.production.id,{...f.store.get('studioProductions',p.production.id),stage:'archived'});assert.equal(f.get(p).canEdit,false);assert.throws(()=>f.update(p,'audio'),{status:409});
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.throws(()=>f.get(p),{status:401});
});

test('deleted or revoked originals prevent returning historic private reviews',t=>{
  const f=fixture(t);for(const mode of ['package','production','version','media','scope']){const p=f.pack();f.update(p,'video','confirmed','PRIVATE-REVIEW-NOTE');if(mode==='package')f.store.remove('studioPublicationPackages',p.row.id);if(mode==='production')f.store.remove('studioProductions',p.production.id);if(mode==='version')f.store.put('studioProductions',p.production.id,{...p.production,versions:[]});if(mode==='media')f.store.remove('studioMedia',p.media.id);if(mode==='scope')f.store.put('studioProductions',p.production.id,{...p.production,ownerId:f.users.other.id,assigneeId:f.users.other.id,teamId:'b'});assert.throws(()=>f.get(p),error=>[403,404,422].includes(error.status),mode);}
});

test('review writes validate status, revision and note without accepting privileged fields or oversized evidence',t=>{
  const f=fixture(t),p=f.pack();for(const input of [{revision:-1,checkId:'video',status:'confirmed'},{revision:0.5,checkId:'video',status:'confirmed'},{revision:0,checkId:'video',status:'passed'},{revision:0,checkId:'video',status:'confirmed',note:'x'.repeat(2001)},{revision:0,checkId:'video',status:'confirmed',note:'bad\u0000note'},{revision:0,checkId:'video',status:'confirmed',note:{}},null,[]])assert.throws(()=>f.review.update(f.users.owner,p.row.id,input),{status:400});
  assert.equal(f.store.all('publicationPackageReviews').length,0);assert.equal(f.update(p,'video','confirmed','x'.repeat(2000)).manual.find(item=>item.id==='video').note.length,2000);
});
