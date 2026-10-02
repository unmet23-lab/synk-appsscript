import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createCreativeResearchService,normalizeResearchUrl,parseTopAd} from './creative-research.mjs';

const at='2026-10-02T01:00:00.000Z',adId='7522423151142551568',adUrl=`https://ads.tiktok.com/business/creativecenter/topads/${adId}/pc/en?countryCode=US&period=30`;
const detail={id:adId,adTitle:'Never Stop Exploring.',brandName:'The North Face',countryCode:['DE','FR','GB','IT'],like:134240,comment:2003,share:1193,ctr:.41,cost:2,objectiveKey:'campaign_objective_reach',industryKey:'label_30102000000',videoInfo:{duration:11.519,url:'https://unrelated.invalid/video.mp4'}};
const html=value=>'<html><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{data:{baseDetail:value}}}})+'</script></html>';
const response=value=>new Response(html(value),{headers:{'Content-Type':'text/html'}});
const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const fb=(extra={})=>({source:'facebook',kind:'reel',title:'확인한 사례',sourceUrl:'https://www.facebook.com/reel/123456789012345/',region:'KR',...extra});
async function fixture(t,fetchImpl=async()=>response(detail)){
  const directory=await mkdtemp(join(tmpdir(),'synk-creative-research-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-creative-research-'));await rm(directory,{recursive:true,force:true});});
  for(const id of ['a','b'])store.put('teams',id,{id,name:id,active:true});
  const admin=store.createUser({name:'Admin',email:'admin@example.test',role:'admin'}),owner=store.createUser({name:'Owner',email:'owner@example.test',role:'member',teamId:'a'}),peer=store.createUser({name:'Peer',email:'peer@example.test',role:'member',teamId:'a'}),manager=store.createUser({name:'Manager',email:'manager@example.test',role:'manager',teamId:'a'}),other=store.createUser({name:'Other',email:'other@example.test',role:'member',teamId:'b'}),viewer=store.createUser({name:'Viewer',email:'viewer@example.test',role:'viewer',teamId:'a'});
  const service=createCreativeResearchService({store,clock:()=>at,fetchImpl});t.after(()=>service.stop());
  function channel(id,platform='youtube',who=owner){return store.put('channels',id,{id,platform,displayName:id,canonicalUrl:'https://www.youtube.com/@'+id,active:true,ownerIds:[who.id],teamId:who.teamId});}
  return {store,service,admin,owner,peer,manager,other,viewer,channel};
}

test('official Top Ads parsing distinguishes filter country, reported regions, count and CTR percentile',()=>{
  const row=parseTopAd(html(detail),adUrl,at);assert.equal(row.source,'tiktok-top-ads');assert.equal(row.creator,'The North Face');assert.equal(row.ctrTopPercent,41);assert.equal(row.metrics.likes,134240);assert.equal(row.metrics.comments,2003);assert.equal(row.metrics.shares,1193);assert.equal(row.metrics.views,null);assert.equal(row.metrics.reach,null);assert.equal(row.durationSeconds,11.519);assert.equal(row.budgetLabel,'High');assert.equal(row.filterRegion,'US');assert.equal(row.region,'GLOBAL');assert.deepEqual(row.actualRegions,['DE','FR','GB','IT']);assert.equal(row.provenance,'official-page');assert.equal(row.periodDays,30);assert.ok(!JSON.stringify(row).includes('video.mp4'));assert.ok(!('rank' in row));assert.ok(!('ctr' in row.metrics));
  const missing=parseTopAd(html({...detail,like:'134K',ctr:10,cost:null,countryCode:['CN'],videoInfo:{duration:-2}}),adUrl,at);assert.equal(missing.metrics.likes,null);assert.equal(missing.ctrTopPercent,null);assert.equal(missing.budgetLabel,null);assert.equal(missing.region,'CN');assert.equal(missing.durationSeconds,null);
  assert.throws(()=>parseTopAd(html({...detail,id:'00000000'}),adUrl,at),/요청한 광고/);assert.throws(()=>parseTopAd('<script>login</script>',adUrl,at),/공개 광고 정보/);
});

test('specific official source URLs reject secrets, misleading sources and generic discovery pages',()=>{
  assert.equal(normalizeResearchUrl('facebook','ad','https://facebook.com/ads/library/?id=12345678'),'https://www.facebook.com/ads/library/?id=12345678');
  for(const url of ['http://ads.tiktok.com/business/creativecenter/topads/12345678/pc/en','https://ads.tiktok.com.evil.test/business/creativecenter/topads/12345678/pc/en','https://ads.tiktok.com:444/business/creativecenter/topads/12345678/pc/en','https://x:y@ads.tiktok.com/business/creativecenter/topads/12345678/pc/en',adUrl+'&access_token=secret',adUrl+'&countryCode=CN','https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en'])assert.throws(()=>normalizeResearchUrl('tiktok-top-ads','ad',url));
  assert.throws(()=>normalizeResearchUrl('instagram','ad','https://www.facebook.com/ads/library/?active_status=all'),/추적|개별/);
  assert.throws(()=>normalizeResearchUrl('facebook','reel','https://www.facebook.com/'),/개별/);
  assert.throws(()=>normalizeResearchUrl('instagram','reel','https://www.facebook.com/reel/123456789/'),/Instagram/);
  assert.equal(normalizeResearchUrl('instagram','best-practice','https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/'),'https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/');
  assert.equal(normalizeResearchUrl('facebook','insight','https://business.facebook.com/latest/insights?asset_id=123456'),'https://business.facebook.com/latest/insights?asset_id=123456');
});

test('new observations default private and only explicit sharing widens their scope',async t=>{
  const f=await fixture(t),privateRow=f.service.add(f.owner,fb({ownerId:f.other.id,provenance:'official-page'})).entry;assert.equal(privateRow.ownerId,f.owner.id);assert.equal(privateRow.visibility,'private');assert.equal(privateRow.provenance,'manual');assert.equal(f.service.workspace(f.peer).entries.length,0);assert.equal(f.service.workspace(f.manager).entries.length,0);assert.equal(f.service.workspace(f.other).entries.length,0);assert.equal(f.service.workspace(f.admin).entries.length,1);
  assert.throws(()=>f.service.update(f.owner,privateRow.id,{visibility:'company'}),/공유/);
  f.service.update(f.owner,privateRow.id,{visibility:'company',shareConfirmed:true});assert.equal(f.service.workspace(f.other).entries.length,1);assert.equal(f.service.workspace(f.viewer).entries[0].canEdit,false);assert.throws(()=>f.service.update(f.peer,privateRow.id,{hook:'rewrite'}),e=>e.status===403);assert.throws(()=>f.service.add(f.viewer,fb()),e=>e.status===403);
});

test('team sharing follows active current team and supports editing without redundant consent',async t=>{
  const f=await fixture(t),row=f.service.add(f.owner,fb({visibility:'team',shareConfirmed:true})).entry;assert.equal(row.teamId,'a');assert.equal(f.service.workspace(f.peer).entries.length,1);assert.equal(f.service.workspace(f.other).entries.length,0);f.service.update(f.manager,row.id,{hook:'공유된 팀 사례 해설'});assert.equal(f.service.workspace(f.owner).entries[0].hook,'공유된 팀 사례 해설');
  assert.throws(()=>f.service.update(f.owner,row.id,{teamId:'b',shareConfirmed:true}),e=>e.status===403);
  f.store.put('users',f.peer.id,{...f.peer,teamId:'b'});assert.equal(f.service.workspace(f.peer).entries.length,0);
  f.store.put('teams','a',{id:'a',name:'a',active:false});assert.equal(f.service.workspace(f.manager).entries.length,0);
});

test('channel-context insights require current writer access and matching platform even after sharing',async t=>{
  const f=await fixture(t);f.channel('yt');f.channel('ig','instagram');
  const input={source:'youtube-trends',kind:'content-gap',title:'Shorts 검색 공백',sourceUrl:'https://studio.youtube.com/channel/UCabcdefghijklmnopqrstuv/analytics/tab-trends/period-default',channelId:'yt',periodDays:28,interest:'high',visibility:'company',shareConfirmed:true};
  assert.throws(()=>f.service.add(f.owner,{...input,channelId:null}),/담당 채널/);assert.throws(()=>f.service.add(f.owner,{...input,channelId:'ig'}),/같은 플랫폼/);assert.throws(()=>f.service.add(f.other,input),e=>e.status===404);
  const row=f.service.add(f.owner,input).entry;assert.equal(row.provenance,'studio-observation');assert.equal(f.service.workspace(f.owner).channels.find(c=>c.id==='yt').canEdit,true);assert.equal(f.service.workspace(f.other).entries.length,0);assert.equal(f.service.workspace(f.manager).entries.length,1);
  f.store.put('channels','yt',{...f.store.get('channels','yt'),ownerIds:[f.other.id],teamId:'b'});assert.equal(f.service.workspace(f.owner).entries.length,0);assert.throws(()=>f.service.update(f.owner,row.id,{hook:'old owner'}),e=>e.status===404);
  assert.throws(()=>f.service.add(f.owner,{source:'instagram',kind:'insight',title:'내 반응',sourceUrl:'https://www.instagram.com/accounts/professional_dashboard/',channelId:null}),/담당 채널/);
  const ig=f.service.add(f.owner,{source:'instagram',kind:'insight',title:'내 반응',sourceUrl:'https://www.instagram.com/accounts/professional_dashboard/',channelId:'ig',metrics:{saves:24,reach:300}}).entry;assert.equal(ig.metrics.views,null);assert.equal(ig.metrics.saves,24);
});

test('missing metrics remain null and ad library never accepts invented performance',async t=>{
  const f=await fixture(t);assert.equal(f.service.add(f.owner,fb()).entry.metrics.likes,null);assert.equal(f.service.add(f.owner,fb({metrics:{likes:0}})).entry.metrics.likes,0);
  for(const metrics of [{ctr:41},{views:-1},{likes:2.5},{reach:'20'}])assert.throws(()=>f.service.add(f.owner,fb({metrics})));
  for(const source of ['facebook','instagram'])assert.throws(()=>f.service.add(f.owner,{source,kind:'ad',title:'광고',sourceUrl:'https://www.facebook.com/ads/library/?id=12345678',metrics:{views:100}}),/성과 수치/);
  assert.throws(()=>f.service.add(f.owner,fb({ctrTopPercent:42})),/TikTok/);assert.throws(()=>f.service.add(f.owner,fb({interest:'high'})),/YouTube/);assert.throws(()=>f.service.add(f.owner,fb({budgetLabel:'High'})),/TikTok/);assert.throws(()=>f.service.add(f.owner,fb({periodDays:365})),/집계 기간/);assert.throws(()=>f.service.add(f.owner,fb({checkedAt:'2026-02-31T00:00:00Z'})),/확인 시각/);assert.throws(()=>f.service.add(f.owner,fb({checkedAt:'2026-10-03T00:00:00Z'})),/미래/);
});

test('annotations preserve official provenance; changing measured facts marks a manual edit',async t=>{
  const f=await fixture(t),row=(await f.service.importTopAd(f.owner,{url:adUrl})).entry;assert.equal(row.provenance,'official-page');assert.equal(row.visibility,'private');const annotated=f.service.update(f.owner,row.id,{hook:'처음 약속',adaptation:'시청자 질문으로 변경'}).entry;assert.equal(annotated.provenance,'official-page');assert.deepEqual(annotated.actualRegions,['DE','FR','GB','IT']);
  const edited=f.service.update(f.owner,row.id,{metrics:{likes:1},provenance:'official-page'}).entry;assert.equal(edited.provenance,'manual');assert.deepEqual(edited.actualRegions,[]);assert.ok(edited.provenanceDetails.editedAt);assert.equal(edited.metrics.likes,1);
});

test('archive is reversible and private archived records never leak through includeArchived',async t=>{
  const f=await fixture(t),row=f.service.add(f.owner,fb()).entry;f.service.archive(f.owner,row.id);assert.equal(f.service.workspace(f.owner).entries.length,0);assert.equal(f.service.workspace(f.owner,{includeArchived:true}).entries[0].archived,true);assert.equal(f.service.workspace(f.other,{includeArchived:true}).entries.length,0);const restored=f.service.update(f.owner,row.id,{archived:false}).entry;assert.equal(restored.archived,false);assert.equal(restored.sourceUrl,row.sourceUrl);assert.equal(f.service.workspace(f.owner).entries.length,1);
});

test('imports never follow off-source redirects or log raw network errors',async t=>{
  let calls=0;const f=await fixture(t,async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://127.0.0.1/private?access_token=secret'}});});await assert.rejects(f.service.importTopAd(f.owner,{url:adUrl}),/공식|HTTPS|광고/);assert.equal(calls,1);assert.equal(f.store.all('creativeResearchEntries').length,0);
  const errorService=createCreativeResearchService({store:f.store,clock:()=>at,fetchImpl:async()=>{throw new Error('Bearer super-secret-token access_token=private');}});await assert.rejects(errorService.importTopAd(f.owner,{url:adUrl}),error=>!error.message.includes('super-secret')&&error.status===502);await errorService.stop();
});

test('bounded imports reject oversized, unexpected content and mismatched detail records',async t=>{
  const f=await fixture(t);for(const result of [new Response('',{headers:{'Content-Type':'text/html','Content-Length':String(3*1024*1024)}}),new Response('x'.repeat(2*1024*1024+1),{headers:{'Content-Type':'text/html'}}),new Response('{}',{headers:{'Content-Type':'application/json'}}),response({...detail,id:'12345678'})]){const service=createCreativeResearchService({store:f.store,clock:()=>at,fetchImpl:async()=>result});await assert.rejects(service.importTopAd(f.owner,{url:adUrl}));await service.stop();}assert.equal(f.store.all('creativeResearchEntries').length,0);
});

test('live role and channel checks reject revoked import authority before persisting',async t=>{
  const gate=wait(),entered=wait(),f=await fixture(t,async()=>{entered.resolve();await gate.promise;return response(detail);});f.channel('tk','tiktok');const work=f.service.importTopAd(f.owner,{url:adUrl,channelId:'tk'});await entered.promise;f.store.put('channels','tk',{...f.store.get('channels','tk'),ownerIds:[f.other.id],teamId:'b'});gate.resolve();await assert.rejects(work,e=>e.status===404);assert.equal(f.store.all('creativeResearchEntries').length,0);
  const gate2=wait(),entered2=wait(),service=createCreativeResearchService({store:f.store,clock:()=>at,fetchImpl:async()=>{entered2.resolve();await gate2.promise;return response(detail);}});const revoked=service.importTopAd(f.owner,{url:adUrl});await entered2.promise;f.store.put('users',f.owner.id,{...f.owner,role:'viewer'});gate2.resolve();await assert.rejects(revoked,e=>e.status===403);await service.stop();assert.equal(f.store.all('creativeResearchEntries').length,0);
});

test('duplicate ads across filters and concurrent requests remain one private record per owner',async t=>{
  let calls=0;const f=await fixture(t,async()=>{calls++;await new Promise(r=>setTimeout(r,3));return response(detail);});const first=await Promise.all([f.service.importTopAd(f.owner,{url:adUrl}),f.service.importTopAd(f.owner,{url:adUrl.replace('US','KR')})]);assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(first.filter(row=>row.existing).length,1);const second=await f.service.importTopAd(f.owner,{url:adUrl.replace('US','CN')});assert.equal(second.existing,true);assert.equal(calls,2);assert.equal(second.entry.filterRegion,'US');await f.service.importTopAd(f.other,{url:adUrl});assert.equal(f.store.all('creativeResearchEntries').length,2);assert.equal(f.service.workspace(f.other).entries.length,1);
});

test('stop awaits in-flight imports and prevents writes after shutdown starts',async t=>{
  const gate=wait(),entered=wait(),f=await fixture(t,async()=>{entered.resolve();await gate.promise;return response(detail);}),work=f.service.importTopAd(f.owner,{url:adUrl});await entered.promise;let stopped=false;const stopping=f.service.stop().then(()=>stopped=true);await Promise.resolve();assert.equal(stopped,false);gate.resolve();await assert.rejects(work,e=>e.status===503);await stopping;assert.equal(stopped,true);assert.equal(f.store.all('creativeResearchEntries').length,0);assert.throws(()=>f.service.add(f.owner,fb()),e=>e.status===503);
});

test('per-owner storage bound applies before network fetch and never counts another owner',async t=>{
  let calls=0;const f=await fixture(t,async()=>{calls++;return response(detail);});for(let i=0;i<500;i++)f.store.put('creativeResearchEntries','bound-'+i,{id:'bound-'+i,ownerId:f.owner.id,source:'facebook',archived:true});assert.throws(()=>f.service.add(f.owner,fb()),e=>e.status===409);assert.throws(()=>f.service.importTopAd(f.owner,{url:adUrl}),e=>e.status===409);assert.equal(calls,0);assert.equal(f.service.add(f.other,fb()).entry.ownerId,f.other.id);
});
