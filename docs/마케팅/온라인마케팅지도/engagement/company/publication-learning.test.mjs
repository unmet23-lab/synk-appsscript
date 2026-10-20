import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationPackageService} from './publication-package.mjs';
import {createPostPerformanceService,POST_PERFORMANCE_METRICS} from './post-performance.mjs';
import {createPublicationLearningService} from './publication-learning.mjs';
import {generateContentIdeas,renderBriefMarkdown} from './content-engine.mjs';

const BASE='2026-10-01T00:00:00.000Z',after=hours=>new Date(Date.parse(BASE)+hours*3600000).toISOString();
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-publication-learning-'));let store=new Store(directory),at=after(500),studio,packages,performance,learning,counter=0;
  const users={};for(const [id,role,teamId]of [['owner','member','a'],['other','member','b'],['viewer','viewer','a'],['admin','admin',null]])users[id]=store.createUser({name:id,email:id+'@learning.example',role,teamId});
  for(const [id,platform]of [['youtube','youtube'],['youtube-other','youtube'],['instagram','instagram']])store.put('channels',id,{id,platform,displayName:'합성 '+id,ownerIds:[users.owner.id],teamId:'a',active:true});
  function services(){studio=createStudioService({store,clock:()=>at});packages=createPublicationPackageService({store,studio,clock:()=>at});performance=createPostPerformanceService({store,clock:()=>at,isConnected:()=>false,collector:async()=>{assert.fail('Learning must not start collection.');}});learning=createPublicationLearningService({store,postPerformance:performance,publicationPackages:packages,studio,clock:()=>at});}services();
  t.after(async()=>{await packages.stop();await performance.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-publication-learning-')));rmSync(directory,{recursive:true,force:true});});
  function pack({formats=['youtube-shorts'],title='PRIVATE-SOURCE-TITLE',owner=users.owner}={}){
    const original=studio.saveProduction(owner,{title,stage:'ready'}).production;
    const media={id:randomUUID(),productionId:original.id,diskName:randomUUID()+'.mp4',mimeType:'video/mp4',fileName:'video.mp4',byteSize:100};
    const production=studio.addMedia(owner,original.id,media,'확정 v1').production,version=production.versions[0];
    const row={id:randomUUID(),title,productionId:production.id,versionId:version.id,channels:formats,state:'prepared',createdAt:at,body:'PRIVATE-SOURCE-BODY',subtitleText:'PRIVATE-SUBTITLE',source:{...media,sha256:'0'.repeat(64)},outputs:[]};store.put('studioPublicationPackages',row.id,row);return {row,production,version,media};
  }
  function entry({hours=120,metrics={views:100},format='youtube-shorts',channelId='youtube',linked=pack(),recorded=true,offset=5,source='manual',unit,extra={}}={}){
    const externalId=String(++counter).padStart(11,'0'),url=channelId==='instagram'?`https://www.instagram.com/reel/${externalId}/`:`https://www.youtube.com/watch?v=${externalId}`;
    const row=performance.register(users.owner,{channelId,url,title:'합성 게시 '+counter,publishedAt:after(hours),publicationPackageId:linked?.row.id||null,...(format?{publicationFormat:format}:{}),...extra}).entry;
    if(recorded&&Object.values(metrics).some(value=>value!==null))performance.manualCheckpoint(users.owner,row.id,72,{measuredAt:after(hours+72+offset/60),metrics,note:'합성 검증값'});
    if(recorded){const raw=store.get('postPerformanceEntries',row.id);raw.checkpoints=raw.checkpoints.map(checkpoint=>checkpoint.hours!==72?checkpoint:{...checkpoint,status:'recorded',source,metricProvenance:Object.fromEntries(Object.entries(checkpoint.metricProvenance||{}).map(([id,meta])=>[id,{...meta,source,...(unit?{unit}: {})}]))});store.put('postPerformanceEntries',row.id,raw);}
    return store.get('postPerformanceEntries',row.id);
  }
  const cards=(user=users.owner)=>learning.workspace(user).cards;
  const card=(row,user=users.owner)=>cards(user).find(item=>item.entryId===row.id);
  const change=(row,mutate)=>{const raw=store.get('postPerformanceEntries',row.id);mutate(raw);store.put('postPerformanceEntries',row.id,raw);};
  return {users,pack,entry,cards,card,change,get store(){return store;},get studio(){return studio;},get learning(){return learning;},get performance(){return performance;},get packages(){return packages;},now(hours){at=after(hours);},async restart(){await packages.stop();await performance.stop();store.close();store=new Store(directory);services();}};
}

test('72-hour future and missing checkpoints never become planning evidence',t=>{
  const f=fixture(t),waiting=f.entry({hours:450,recorded:false}),missing=f.entry({hours:120,recorded:false});
  assert.equal(f.card(waiting).status,'waiting');assert.equal(f.card(missing).status,'missing');
  for(const row of [waiting,missing]){assert.equal(f.card(row).canPlan,false);assert.deepEqual(f.card(row).experiments,[]);assert.deepEqual(f.card(row).facts,[]);assert.throws(()=>f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'}),{status:403});}
  f.performance.manualCheckpoint(f.users.owner,missing.id,24,{measuredAt:after(144),metrics:{views:500}});assert.equal(f.card(missing).status,'missing','24-hour numbers must not substitute for 72-hour numbers');
});

test('zero is a recorded fact; null and invalid numbers stay missing and do not imply failure',t=>{
  const f=fixture(t),row=f.entry({metrics:{views:0,likes:null}});f.change(row,raw=>{const checkpoint=raw.checkpoints.find(item=>item.hours===72);checkpoint.metrics.completionRatePct=101;checkpoint.metrics.averageWatchSeconds=-1;checkpoint.metrics.saves='0';});
  const card=f.card(row);assert.equal(card.status,'limited');assert.equal(card.facts.length,1);assert.equal(card.facts[0].value,0);assert.equal(card.canPlan,true);assert.ok(card.missing.includes('좋아요'));assert.ok(card.missing.includes('완주율'));assert.equal(card.experiments.length,1);assert.equal(card.experiments[0].id,'observe-again');assert.doesNotMatch(card.summary,/성공|실패|효과가/);
});

test('three prior same-account same-format observations expose descriptive median only',t=>{
  const f=fixture(t);for(const [hours,views]of [[0,50],[24,100],[48,150]])f.entry({hours,metrics:{views}});const row=f.entry({metrics:{views:200}}),card=f.card(row),comparison=card.facts[0].comparison;
  assert.deepEqual(comparison,{sampleCount:3,median:100,deltaPercent:100,status:'ready'});assert.equal(card.status,'ready');assert.ok(card.limits.some(text=>text.includes('통계적으로 확실')));assert.ok(card.limits.some(text=>text.includes('원인을 증명하지')));assert.equal(card.experiments[0].id,'new-example');assert.match(card.experiments[0].reason,/왜 그런지는 아직 몰라/);
});

test('four prior same-account same-format observations add a nearest-rank quarter standing and the v2 next step',t=>{
  const priors=(f,id='saves')=>{for(const [hours,value]of [[0,50],[24,100],[48,150],[72,200]])f.entry({hours,metrics:{[id]:value}});};
  let f=fixture(t);priors(f);const top=f.entry({hours:96,metrics:{saves:300}}),topCard=f.card(top);
  assert.deepEqual(topCard.facts[0].comparison.standing,{label:'top25',p25:50,p75:150,sampleCount:4});
  assert.equal(topCard.experiments[0].id,'repeat-format');assert.match(topCard.experiments[0].reason,/^상위 25% 지표: 저장\(같은 계정·형식 이전 4편 기준\)\. 왜 그런지는 아직 몰라요\.$/);
  assert.match(f.learning.plan(f.users.owner,top.id,{experimentId:'repeat-format'}).input.editorialNote,/선택 실험: 같은 형식으로 세 편 더 만들기/);
  f=fixture(t);priors(f);const bottom=f.card(f.entry({hours:96,metrics:{saves:40}}));
  assert.equal(bottom.facts[0].comparison.standing.label,'bottom25');assert.equal(bottom.experiments[0].id,'new-hook-elsewhere');assert.ok(!bottom.experiments.some(row=>row.id==='repeat-format'));
  f=fixture(t);priors(f);const middle=f.card(f.entry({hours:96,metrics:{saves:120}}));
  assert.equal(middle.facts[0].comparison.standing.label,'middle');assert.ok(!middle.experiments.some(row=>['repeat-format','new-hook-elsewhere'].includes(row.id)));
  // 이전 4편 [50,100,150,200] 중 150은 세 번째다 — 75번째 백분위와 같아도 상위 25%가 아니다(10-20 가운데 순위). 가장 큰 값과 같으면 상위다.
  f=fixture(t);priors(f);const atEdge=f.card(f.entry({hours:96,metrics:{saves:150}}));assert.equal(atEdge.facts[0].comparison.standing.label,'middle','a value equal to the 75th percentile is not by itself in the top quarter');
  f=fixture(t);priors(f);assert.equal(f.card(f.entry({hours:96,metrics:{saves:200}})).facts[0].comparison.standing.label,'top25','tying the best prior post is');
  f=fixture(t);priors(f,'views');const viewsOnly=f.card(f.entry({hours:96,metrics:{views:300}}));
  assert.equal(viewsOnly.facts[0].comparison.standing.label,'top25','views still show where they stand');assert.ok(!viewsOnly.experiments.some(row=>['repeat-format','new-hook-elsewhere'].includes(row.id)),'v2 §6: views alone never pick the next step');
});

test('a next step names every prior sample size when its metrics were compared against different numbers of posts',t=>{
  const f=fixture(t);for(const [hours,saves,shares]of [[0,50,null],[12,60,null],[24,100,10],[36,110,20],[48,150,30],[60,200,40]])f.entry({hours,metrics:{saves,shares}});
  const card=f.card(f.entry({hours:96,metrics:{saves:300,shares:50}}));
  assert.deepEqual(card.facts.map(fact=>[fact.id,fact.comparison.standing?.sampleCount]),[['shares',4],['saves',6]]);
  assert.equal(card.experiments[0].id,'repeat-format');assert.match(card.experiments[0].reason,/^상위 25% 지표: 공유·저장\(같은 계정·형식 이전 4~6편 기준\)\. 왜 그런지는 아직 몰라요\.$/);
});

test('flat histories and mixed metrics never claim a quarter direction or a single verdict',t=>{
  let f=fixture(t);for(const hours of [0,24,48,72])f.entry({hours,metrics:{views:100}});
  assert.equal(f.card(f.entry({hours:96,metrics:{views:100}})).facts[0].comparison.standing.label,'middle','equal history has no spread');
  f=fixture(t);for(const [hours,saves,completionRatePct]of [[0,50,10],[24,100,20],[48,150,30],[72,200,40]])f.entry({hours,metrics:{saves,completionRatePct}});
  const mixed=f.card(f.entry({hours:96,metrics:{saves:300,completionRatePct:5}}));
  assert.deepEqual(mixed.facts.map(fact=>fact.comparison.standing.label),['top25','bottom25']);assert.ok(!mixed.experiments.some(row=>['repeat-format','new-hook-elsewhere'].includes(row.id)));
});

test('external format observations join matching package samples without relaxing provenance filters',t=>{
  const f=fixture(t),external=({format='youtube-shorts',...options}={})=>{const row=f.entry({linked:null,format:null,source:'api:youtube',...options});f.change(row,raw=>{raw.origin='external';raw.publicationFormat=format;});return row;};
  external({hours:0,metrics:{views:50}});f.entry({hours:24,source:'api:youtube',metrics:{views:100}});external({hours:48,metrics:{views:150}});
  external({hours:72,channelId:'youtube-other'});external({hours:72,format:'youtube-video'});external({hours:72,source:'manual'});external({hours:72,unit:'seconds'});external({hours:72,offset:21});external({hours:72,offset:361});external({hours:72,channelId:'instagram',format:'instagram-reels'});external({hours:72,format:'instagram-reels'});
  const row=external({hours:120,metrics:{views:200}}),card=f.card(row);
  assert.deepEqual(card.format,{id:'youtube-shorts',label:'YouTube Shorts'});assert.equal(card.source,null);assert.equal(card.status,'ready');assert.equal(card.canPlan,true);
  assert.deepEqual(card.facts[0].comparison,{sampleCount:3,median:100,deltaPercent:100,status:'ready'});
  assert.match(f.learning.plan(f.users.owner,row.id,{experimentId:'new-example'}).input.editorialNote,/이전 3편/);
});

test('one or two comparison posts show sample count without a misleading median or change rate',t=>{
  const f=fixture(t);f.entry({hours:0});const prior=f.entry({hours:24}),row=f.entry({metrics:{views:200}});let card=f.card(row);assert.equal(card.status,'limited');assert.deepEqual(card.facts[0].comparison,{sampleCount:2,median:null,deltaPercent:null,status:'insufficient'});
  f.change(prior,raw=>{raw.active=false;});card=f.card(row);assert.equal(card.facts[0].comparison.sampleCount,1);assert.equal(card.experiments[0].id,'observe-again');
});

test('comparisons isolate account, format, metric source, unit, prior publication and checkpoint',t=>{
  const f=fixture(t);f.entry({hours:0,metrics:{views:80}});f.entry({hours:24,metrics:{views:100}});const linked=f.pack({formats:['youtube-video']});
  f.entry({hours:48,channelId:'youtube-other'});f.entry({hours:48,format:'youtube-video',linked});f.entry({hours:48,source:'api:youtube'});f.entry({hours:48,unit:'seconds'});f.entry({hours:144});f.entry({hours:120});
  const only24=f.entry({hours:48,recorded:false});f.performance.manualCheckpoint(f.users.owner,only24.id,24,{measuredAt:after(72),metrics:{views:9999}});
  const row=f.entry({metrics:{views:200}}),fact=f.card(row).facts[0];assert.equal(fact.comparison.sampleCount,2);assert.equal(fact.comparison.status,'insufficient');
});

test('comparison requires compatible metric observation offsets and the actual six-hour capture window',t=>{
  const f=fixture(t);f.entry({hours:0,offset:30});f.entry({hours:24,offset:45});f.entry({hours:48,offset:46});f.entry({hours:72,offset:361});f.entry({hours:96,offset:0});
  const row=f.entry({metrics:{views:200},offset:30}),card=f.card(row);assert.equal(card.facts[0].comparison.sampleCount,2,'30 and 45 minutes match, but 46, 361 and 0 do not');assert.ok(card.limits.some(text=>text.includes('15분 넘게 늦게')));
  const late=f.entry({hours:130,offset:361});assert.equal(f.card(late).facts[0].comparison.status,'unavailable');assert.equal(f.card(late).facts[0].value,100);assert.ok(f.card(late).limits.some(text=>text.includes('밖에 읽은 숫자')));
});

test('per-metric supplementation keeps its own observation source and timestamp',t=>{
  const f=fixture(t);for(const hours of [0,24,48])f.entry({hours,metrics:{views:100,likes:10}});const row=f.entry({metrics:{views:200}});
  f.performance.manualCheckpoint(f.users.owner,row.id,72,{measuredAt:after(200),metrics:{likes:20}});const card=f.card(row),views=card.facts.find(fact=>fact.id==='views'),likes=card.facts.find(fact=>fact.id==='likes');
  assert.equal(views.comparison.status,'ready');assert.equal(likes.comparison.status,'unavailable');assert.equal(likes.observedAt,after(200));assert.notEqual(likes.observedAt,views.observedAt);assert.equal(likes.value,20);
});

test('zero reference medians never produce infinity or divide-by-zero claims',t=>{
  const f=fixture(t);for(const hours of [0,24,48])f.entry({hours,metrics:{views:0}});const row=f.entry({metrics:{views:10}}),card=f.card(row);
  assert.deepEqual(card.facts[0].comparison,{sampleCount:3,median:0,deltaPercent:null,status:'ready'});const planned=f.learning.plan(f.users.owner,row.id,{experimentId:'new-example'});assert.match(planned.input.editorialNote,/중앙값 0으로 변화율 계산 안 함/);assert.doesNotMatch(JSON.stringify(planned),/Infinity|NaN/);
});

test('unambiguous legacy package format is usable; mixed YouTube package is never guessed',t=>{
  const f=fixture(t),mixed=f.pack({formats:['youtube-shorts','youtube-video']}),legacy=f.entry({format:null}),ambiguous=f.entry({format:null,linked:mixed});
  assert.equal(f.card(legacy).format.id,'youtube-shorts');assert.equal(f.card(ambiguous).format,null);assert.equal(f.card(ambiguous).facts[0].comparison.status,'unavailable');
  const noSource=f.entry({format:null,linked:null});assert.equal(f.card(noSource).format,null);
});

test('original source access is refreshed without leaking private title, body, notes or subtitles',t=>{
  const f=fixture(t),linked=f.pack(),row=f.entry({linked});assert.equal(f.card(row).source.title,'PRIVATE-SOURCE-TITLE');
  f.store.put('studioProductions',linked.production.id,{...linked.production,ownerId:f.users.other.id,assigneeId:f.users.other.id,teamId:'b',notes:[{text:'PRIVATE-NOTE'}]});
  const card=f.card(row);assert.equal(card.source,null);assert.equal(card.title,row.title);assert.doesNotMatch(JSON.stringify(card),/PRIVATE-SOURCE-TITLE|PRIVATE-SOURCE-BODY|PRIVATE-SUBTITLE|PRIVATE-NOTE/);const plan=f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'});assert.doesNotMatch(JSON.stringify(plan),/PRIVATE-SOURCE-TITLE|PRIVATE-SOURCE-BODY|PRIVATE-SUBTITLE|PRIVATE-NOTE/);assert.equal(plan.input.channelId,'');
});

test('deleted packages, versions and media remove only the source link and preserve public performance evidence',t=>{
  const f=fixture(t);for(const kind of ['package','version','media']){const linked=f.pack(),row=f.entry({linked});if(kind==='package')f.store.remove('studioPublicationPackages',linked.row.id);if(kind==='version')f.store.put('studioProductions',linked.production.id,{...linked.production,versions:[]});if(kind==='media')f.store.remove('studioMedia',linked.media.id);const card=f.card(row);assert.equal(card.source,null,kind);assert.equal(card.facts[0].value,100);assert.equal(card.canPlan,true);}
});

test('current user and current channel permissions override stale caller objects and cached cards',t=>{
  const f=fixture(t),row=f.entry();assert.equal(f.card(row).canPlan,true);assert.equal(f.cards(f.users.other).length,0);assert.equal(f.card(row,f.users.viewer).canPlan,false);assert.throws(()=>f.learning.plan(f.users.viewer,row.id,{experimentId:'observe-again'}),{status:403});
  const channel=f.store.get('channels','youtube');f.store.put('channels','youtube',{...channel,ownerIds:[f.users.other.id],teamId:'b'});assert.equal(f.cards().length,0);assert.throws(()=>f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'}),{status:404});
  f.store.put('channels','youtube',channel);f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal(f.card(row,{...f.users.owner,role:'admin'}).canPlan,false);assert.throws(()=>f.learning.plan({...f.users.owner,role:'admin'},row.id,{experimentId:'observe-again'}),{status:403});
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.throws(()=>f.cards(f.users.owner),{status:401});assert.throws(()=>f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'}),{status:401});
});

test('archived entries and disabled channels disappear; malformed or changed original URLs are not trusted',t=>{
  const f=fixture(t),row=f.entry();for(const modify of [raw=>{raw.active=false;},raw=>{raw.url='https://attacker.example/';},raw=>{raw.url='https://www.instagram.com/p/ABC123/';},raw=>{raw.url='https://www.youtube.com/watch?v=11111111111';}]){f.store.put('postPerformanceEntries',row.id,row);f.change(row,modify);assert.equal(f.cards().length,0);}
  f.store.put('postPerformanceEntries',row.id,row);f.store.put('channels','youtube',{...f.store.get('channels','youtube'),active:false});assert.equal(f.cards().length,0);
});

test('planning accepts only a current server-proposed experiment and keeps facts separate from hypotheses',t=>{
  const f=fixture(t),row=f.entry({metrics:{views:0}}),planned=f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'});
  assert.equal(planned.input.channelId,'');assert.equal('seriesId'in planned.input,false);assert.ok(planned.input.editorialNote.length<=3000);assert.match(planned.input.editorialNote,/조회: 0회/);assert.match(planned.input.editorialNote,/직접 확인/);assert.ok(planned.input.editorialNote.includes(row.url));assert.ok(planned.input.editorialNote.includes(after(192+5/60)));assert.match(planned.input.editorialNote,/선택 실험:/);assert.match(planned.input.editorialNote,/통계적으로 확실/);assert.doesNotMatch(JSON.stringify(planned.input),/PRIVATE-SOURCE-BODY|PRIVATE-SUBTITLE/);assert.ok(planned.card.source.productionId);assert.ok(planned.card.source.versionId);assert.ok(!planned.input.editorialNote.includes(planned.card.source.productionId));assert.ok(!planned.input.experience.includes(planned.card.source.versionId));
  assert.equal(planned.input.topic,row.title,'a producer experiment is not the viewer-facing topic');assert.deepEqual(planned.input.personalization,{situation:'',choice:'',nextStep:''},'producer measurement work must not become a viewer action');assert.equal(planned.input.proof,'');assert.equal(planned.input.experience,'');assert.deepEqual(planned.input.authenticity,{basis:'',ownPerspective:'',limits:'',disclosure:''});for(const key of ['title','change','measure'])assert.ok(planned.input.editorialNote.includes(planned.experiment[key]),'editorial metadata keeps '+key);
  for(const input of [{experimentId:'inject'}, {experimentId:'observe-again',proof:'invented'}, {experimentId:'observe-again',channelId:'youtube'},null,[]])assert.throws(()=>f.learning.plan(f.users.owner,row.id,input));
  assert.throws(()=>f.learning.plan(f.users.owner,'nonexistent',{experimentId:'observe-again'}),{status:404});
  const apiRow=f.entry({source:'api:youtube-videos'}),apiPlan=f.learning.plan(f.users.owner,apiRow.id,{experimentId:'observe-again'});assert.match(apiPlan.input.editorialNote,/자동 관측 · YouTube/);assert.doesNotMatch(apiPlan.input.editorialNote,/api:youtube-videos/);assert.equal(apiPlan.card.facts[0].source,'api:youtube-videos');
});

test('a stale experiment is rejected after source metrics change the current candidate set',t=>{
  const f=fixture(t);for(const hours of [0,24,48])f.entry({hours,metrics:{earlyRetention3sPct:80}});const row=f.entry({metrics:{earlyRetention3sPct:40}});assert.ok(f.card(row).experiments.some(item=>item.id==='opening'));
  f.change(row,raw=>{raw.checkpoints.find(item=>item.hours===72).metrics.earlyRetention3sPct=90;});assert.throws(()=>f.learning.plan(f.users.owner,row.id,{experimentId:'opening'}),{status:409});
});

test('rule-based candidates change one variable and remain at most three even with several below-median metrics',t=>{
  const f=fixture(t);for(const hours of [0,24,48])f.entry({hours,metrics:{earlyRetention3sPct:80,completionRatePct:70,toolVisits:20}});const row=f.entry({metrics:{earlyRetention3sPct:40,completionRatePct:30,toolVisits:0}}),card=f.card(row);
  assert.deepEqual(card.experiments.map(item=>item.id),['opening','length','call-to-action']);for(const experiment of card.experiments){assert.ok(experiment.change);assert.ok(experiment.measure);assert.match(experiment.reason,/이전 3편 중앙값/);assert.match(experiment.reason,/왜 그런지는 아직 몰라/);}
});

test('duplicate identities do not inflate samples and malformed provenance does not enable comparison',t=>{
  const f=fixture(t);const first=f.entry({hours:0});f.entry({hours:24});const duplicate={...first,id:'f'.repeat(64)};f.store.put('postPerformanceEntries',duplicate.id,duplicate);const row=f.entry();assert.equal(f.card(row).facts[0].comparison.sampleCount,2);
  f.change(row,raw=>{delete raw.checkpoints.find(item=>item.hours===72).metricProvenance;});const card=f.card(row);assert.equal(card.facts[0].comparison.status,'unavailable');assert.equal(card.status,'limited');assert.equal(card.facts[0].value,100);
});

test('repeated reads and planning preserve the database and survive restart without collectors or AI',async t=>{
  const f=fixture(t),row=f.entry(),before=f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),first=f.learning.workspace(f.users.owner),plan=f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'});
  assert.deepEqual(f.learning.workspace(f.users.owner),first);assert.deepEqual(f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),before);await f.restart();assert.deepEqual(f.learning.workspace(f.users.owner),first);assert.deepEqual(f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'}),plan);assert.deepEqual(f.store.all('contentDrafts'),[]);assert.deepEqual(f.store.all('messengerTasks'),[]);
});

test('every metric retains exact values, units, provenance and observation times within the planning limit',t=>{
  const f=fixture(t),metrics=Object.fromEntries(POST_PERFORMANCE_METRICS.map(definition=>[definition.id,definition.unit==='percent'?0:definition.unit==='seconds'?23.25:999999])),row=f.entry({metrics});const card=f.card(row),planned=f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'});
  assert.equal(POST_PERFORMANCE_METRICS.length,14);assert.equal(card.facts.length,POST_PERFORMANCE_METRICS.length);assert.equal(card.missing.length,0);for(const definition of POST_PERFORMANCE_METRICS){const fact=card.facts.find(item=>item.id===definition.id);assert.equal(fact.value,metrics[definition.id]);assert.equal(fact.unit,definition.unit);assert.ok(planned.input.editorialNote.includes(definition.label+':'));assert.ok(planned.input.editorialNote.includes(fact.observedAt));}assert.ok(planned.input.editorialNote.length<=3000);
});

test('invalid future metric timestamps remain unknown instead of borrowing another metric observation time',t=>{
  const f=fixture(t),row=f.entry({metrics:{views:100,likes:2}});f.change(row,raw=>{raw.checkpoints.find(item=>item.hours===72).metricProvenance.likes.observedAt=after(501);});
  const card=f.card(row),likes=card.facts.find(fact=>fact.id==='likes'),views=card.facts.find(fact=>fact.id==='views');assert.equal(likes.observedAt,null);assert.equal(likes.comparison.status,'unavailable');assert.equal(views.observedAt,after(192+5/60));assert.equal(likes.value,2);
});

test('finite extreme metrics cannot overflow the median or percentage into fabricated infinity',t=>{
  const f=fixture(t);for(const hours of [0,12,24,48])f.entry({hours,metrics:{averageWatchSeconds:Number.MAX_VALUE}});const row=f.entry({metrics:{averageWatchSeconds:Number.MAX_VALUE}}),fact=f.card(row).facts[0];assert.equal(fact.comparison.median,Number.MAX_VALUE);assert.equal(fact.comparison.deltaPercent,0);
  const f2=fixture(t);for(const hours of [0,24,48])f2.entry({hours,metrics:{averageWatchSeconds:Number.MIN_VALUE}});const extreme=f2.entry({metrics:{averageWatchSeconds:Number.MAX_VALUE}}),planned=f2.learning.plan(f2.users.owner,extreme.id,{experimentId:'new-example'});assert.equal(planned.card.facts[0].comparison.deltaPercent,null);assert.doesNotMatch(planned.input.editorialNote,/Infinity|NaN|중앙값 0으로/);
});

test('learning handoff reaches the real generator without turning the producer experiment into viewer content',t=>{
  const f=fixture(t),row=f.entry({metrics:{views:0}}),handoff=f.learning.plan(f.users.owner,row.id,{experimentId:'observe-again'}),input={...handoff.input,seriesId:'synkbrief-use'},plan=generateContentIdeas(input),baseline=generateContentIdeas({seriesId:'synkbrief-use',topic:row.title});
  assert.deepEqual(plan.ideas,baseline.ideas);assert.deepEqual(plan.personalization,baseline.personalization);assert.deepEqual(plan.authenticity,baseline.authenticity);assert.equal(plan.input.editorialNote,handoff.input.editorialNote);assert.ok(plan.input.editorialNote.includes(handoff.experiment.measure));
  assert.doesNotMatch(JSON.stringify(plan.ideas),/조회: 0회|선택 실험:|같은 형식으로 한 편 더 올리기/);assert.match(renderBriefMarkdown(plan),/## 이번 편 제작 실험/);
});
test('window values join a missed 72-hour card, compare only with the same window kind and can pick the next step',t=>{
  const f=fixture(t),win=(row,id,value,extra={})=>f.change(row,raw=>{const point=raw.checkpoints.find(item=>item.hours===72);point.metrics[id]=value;point.metricProvenance={...point.metricProvenance,[id]:{source:'api:youtube-analytics-api-v2',kind:'window',timeZone:'America/Los_Angeles',days:3,startDate:'2026-09-30',endDate:'2026-10-02',observedAt:after(130),recordedAt:after(130),timing:'window',lagged:true,measurementWindowMissed:false,unit:'percent',...extra}};});
  for(const [hours,value]of [[0,50],[24,60],[48,70],[72,80]])win(f.entry({hours,recorded:false}),'averageViewPct',value);
  f.entry({hours:60,metrics:{averageViewPct:10},source:'api:youtube-analytics-api-v2'});
  const row=f.entry({hours:96,recorded:false});win(row,'averageViewPct',95);
  assert.equal(f.store.get('postPerformanceEntries',row.id).checkpoints.find(item=>item.hours===72).status,'missed');
  const card=f.card(row),fact=card.facts.find(item=>item.id==='averageViewPct');
  assert.equal(card.status,'ready');assert.equal(fact.value,95);assert.ok(card.missing.includes('구독 증가'));assert.ok(!card.missing.includes('평균 조회율'));assert.equal(fact.lagged,true);assert.deepEqual(fact.window,{startDate:'2026-09-30',endDate:'2026-10-02',timeZone:'America/Los_Angeles'});
  assert.deepEqual(fact.comparison,{sampleCount:4,median:65,deltaPercent:46.2,status:'ready',standing:{label:'top25',p25:50,p75:70,sampleCount:4}},'a same-source snapshot value never joins the window sample');
  assert.equal(card.experiments[0].id,'repeat-format');assert.match(card.experiments[0].reason,/평균 조회율/);
  assert.ok(card.limits.some(text=>/^평균 조회율은 YouTube Analytics가 늦게 채우는 숫자라, 게시 5일 뒤 2026-09-30~2026-10-02\(태평양시\) 창으로 받았어요/.test(text)));
  assert.match(f.learning.plan(f.users.owner,row.id,{experimentId:'repeat-format'}).input.editorialNote,/평균 조회율: 95% \| 자동 관측 · YouTube \| 2026-09-30~2026-10-02\(태평양시\) 창 \| 관측 /);
  win(row,'averageViewPct',95,{days:7});const other=f.card(row).facts.find(item=>item.id==='averageViewPct');assert.equal(other.comparison.status,'unavailable','another window definition never compares');assert.equal(other.window,undefined);
});

test('estimated reel retention is labelled in the card and plan, and Shorts stayed-to-watch counts as early retention',t=>{
  let f=fixture(t);const reel=f.entry({channelId:'instagram',format:'instagram-reels',linked:f.pack({formats:['instagram-reels']}),metrics:{earlyRetention3sPct:61.8},source:'api:instagram-login-api'});
  f.change(reel,raw=>{raw.checkpoints.find(item=>item.hours===72).metricProvenance.earlyRetention3sPct.estimated=true;});
  const card=f.card(reel);assert.equal(card.facts[0].estimated,true);for(const label of ['본 비율','평균 조회율','구독 증가','구독 취소'])assert.ok(!card.missing.includes(label),'YouTube-only metrics are not missing on a reel: '+label);assert.ok(card.limits.some(text=>text.startsWith('3초 유지율은 플랫폼이 추정')));
  assert.match(f.learning.plan(f.users.owner,reel.id,{experimentId:'observe-again'}).input.editorialNote,/3초 유지율: 61\.8% \| 자동 관측 · Instagram \| 추정 \| 관측 /);
  f=fixture(t);for(const hours of [0,24,48])f.entry({hours,metrics:{stayedToWatchPct:70}});const shorts=f.card(f.entry({metrics:{stayedToWatchPct:40}}));
  const opening=shorts.experiments.find(item=>item.id==='opening');assert.ok(opening,'v2 §6 early retention includes the Shorts stayed-to-watch share');assert.match(opening.measure,/^72시간 본 비율을 /);
});

test('ties in small whole-number metrics do not call the middle a top or bottom quarter',t=>{
  // 10-20: 이전 공유 [5,10,10,10]에서 중앙값 10을 상위로, 저장 [0,0,1,1]에서 0을 하위로 불러 다음 할 일을 정했다. 가운데 순위로 잰다.
  const standing=(priors,current,id='shares')=>{const f=fixture(t);priors.forEach((value,i)=>f.entry({hours:i*24,metrics:{[id]:value}}));return f.card(f.entry({hours:priors.length*24,metrics:{[id]:current}})).facts[0].comparison.standing.label;};
  assert.equal(standing([5,10,10,10],10),'middle');
  assert.equal(standing([0,0,1,1],0,'saves'),'middle');assert.equal(standing([0,0,1,1],1,'saves'),'middle');
  assert.equal(standing([1,2,3,4],4),'top25');assert.equal(standing([1,2,3,4],1),'bottom25');assert.equal(standing([1,2,3,4],3),'middle');assert.equal(standing([1,2,3,4],2),'middle');
});

test('a post registered without a workspace package is called unlinked, not an unreadable original',t=>{
  // 10-20: 집계 자동 등록으로 연결 없는 기록이 흔해진다. 「현재 열 수 없어」는 고장처럼 읽혀, 연결이 있는데 못 읽는 경우에만 쓴다.
  const f=fixture(t),unlinked=f.entry({linked:null,format:null}),broken=f.entry();
  f.change(broken,raw=>{raw.publicationPackageId='missing-package';});
  assert.ok(f.card(unlinked).limits.some(text=>text.includes('작업실 게시 준비와 연결되지 않은 게시물')));assert.ok(!f.card(unlinked).limits.some(text=>text.includes('지금 열 수 없어')));
  assert.ok(f.card(broken).limits.some(text=>text.includes('연결한 원본을 지금 열 수 없어')));
});
