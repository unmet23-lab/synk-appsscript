import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from './analytics.mjs';
import {shouldCollect,nextCollectionAt,collectionHours} from './company/collection-policy.mjs';
import {buildSocialSimple,validateDigest} from './company/social-simple.mjs';
import {buildAccountMap,matchAccount} from './company/account-catalog.mjs';

const dates=['2026-10-30','2026-11-06','2026-11-13'];
const report=(snapshots,posts=[{id:'p',channelId:'c',publishedDate:'2026-01-01'}])=>analyze({posts,snapshots,channelSnapshots:[]},{channels:[{id:'c',ready:true,business:'LAB'}]},{start:'2026-11-07',end:'2026-11-13',business:'LAB'});
test('week over week compares gains (120 vs 100), not lifetime baseline (200)',()=>{
 const r=report(dates.map((date,i)=>({postId:'p',date,views:[100,200,320][i]}))).metrics.views;
 assert.equal(r.period.rate,60);
 assert.deepEqual([r.periodComparison.current,r.periodComparison.previous,r.periodComparison.rate],[120,100,20]);
});
test('three boundaries use identical population; missing and zero never manufacture a percentage',()=>{
 const missing=report([{postId:'p',date:dates[1],views:200},{postId:'p',date:dates[2],views:320}]).metrics.views.periodComparison;
 assert.equal(missing.rate,null);assert.equal(missing.current,null);assert.equal(missing.reason,'missing-baseline');
 const zero=report(dates.map((date,i)=>({postId:'p',date,views:[0,0,120][i]}))).metrics.views.periodComparison;
 assert.equal(zero.current,120);assert.equal(zero.rate,null);assert.equal(zero.reason,'zero-previous');
 const changing=report(dates.map((date,i)=>({postId:'p',date,views:[100,200,320][i],comparisonGroup:i===2?'new-owner':'old-owner'}))).metrics.views.periodComparison;
 assert.equal(changing.count,0);
 const partial=report(dates.map((date,i)=>({postId:'p',date,views:[100,200,320][i]})),[{id:'p',channelId:'c',publishedDate:'2026-01-01'},{id:'missing',channelId:'c',publishedDate:'2026-01-01'}]).metrics.views.periodComparison;
 assert.equal(partial.rate,null);assert.equal(partial.matchedRate,20);assert.equal(partial.reason,'partial-coverage');assert.equal(partial.count,1);assert.equal(partial.eligible,2);
});
test('09 and 21 KST full scans run once per slot and do not bypass rate limits',()=>{
 const channel={platform:'youtube',active:true,connected:true,status:'success',lastCollectedAt:'2026-11-13T00:02:00Z'};
 const opts={hoursKst:[9,21],at:'2026-11-13T11:59:00Z'};
 assert.equal(shouldCollect(channel,opts),false);
 assert.equal(nextCollectionAt(opts),'2026-11-13T12:00:00.000Z');
 assert.equal(shouldCollect(channel,{...opts,at:'2026-11-13T12:00:00Z'}),true);
 assert.equal(shouldCollect({...channel,lastCollectedAt:'2026-11-13T12:00:01Z'},{...opts,at:'2026-11-13T12:05:00Z'}),false);
 assert.equal(shouldCollect({...channel,status:'error',failureKind:'rate-limit',lastFailureAt:'2026-11-13T10:00:00Z',retryCount:1,nextRetryAt:'2026-11-14T10:00:00Z'},{...opts,at:'2026-11-13T12:00:00Z'}),false);
 assert.deepEqual(collectionHours({hoursKst:[21,9]}),[9,21]);assert.throws(()=>collectionHours({hoursKst:[9,24]}));
});
test('missing recent views stay null and account scope follows the canonical identity',()=>{
 const r=buildSocialSimple({now:'2026-11-13T11:00:00Z',channels:[{id:'c',platform:'youtube',handle:'yuhokorean'}],recent:[{id:'p',channelId:'c',publishedAt:'2026-11-12T11:00:00Z',views:null}]});
 assert.equal(r.accounts[0].business,'LAB');assert.equal(r.accounts[0].views30,null);assert.equal(r.accounts[0].views30Known,0);
 assert.equal('accountMap' in r,false);
});
test('server cancellation wins over a stale repo reservation and login is separate from API connection',()=>{
 const c={id:'c',platform:'xiaohongshu',externalId:'6ab10807000000000301d12f',connected:false};
 const r=buildAccountMap({now:'2026-11-13T11:00:00Z',channels:[c],jobs:[{id:'j',channelId:'c',status:'cancelled'}],digest:{accountMap:{generatedAt:'2026-11-13T10:00:00Z',accounts:[{id:'lab-cn-xiaohongshu',operations:{login:{state:'verified',observedAt:'2026-11-13T10:00:00Z',scope:'owner screen'},publication:{receipts:[{jobId:'j',state:'예약됨',at:'2026-11-14T11:00:00Z'}]}}}]}}});
 const a=r.accounts.find(a=>a.id==='lab-cn-xiaohongshu');assert.equal(a.operations.login.state,'verified');assert.equal(a.operations.collection.connected,false);assert.equal(a.operations.publication.scheduledCount,0);
 assert.equal(matchAccount({platform:'instagram',handle:'yuhokorean'}).business,'LAB');
});
test('digest strips arbitrary operational fields rather than publishing raw source objects',()=>{
 const r=validateDigest({v:1,generatedAt:'2026-11-13T10:00:00Z',accounts:[{key:'lab-youtube',platform:'youtube',handle:'synkkorean'}],accountMap:{generatedAt:'2026-11-13T10:00:00Z',accounts:[{id:'lab-youtube',password:'secret',operations:{login:{state:'verified',observedAt:'2026-11-13T09:00:00Z',cookie:'secret'},publication:{receipts:[]}}}]}},{now:'2026-11-13T11:00:00Z'});
 assert.ok(!JSON.stringify(r).includes('secret'));assert.equal(r.accountMap.accounts[0].operations.login.state,'verified');
});
