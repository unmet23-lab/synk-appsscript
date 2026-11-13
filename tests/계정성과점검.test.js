'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit,markdown}=require('../tools/계정성과점검.js');
test('실제 API의 groups 배열을 계정에 붙이고 0과 미측정을 구분한다',async()=>{
 const state={channels:[{id:'server-lab',platform:'youtube',legacyId:'lab-youtube',handle:'synkkorean',connected:true,lastCollectedAt:'2026-11-13T00:00:00Z'}],capabilities:[{id:'youtube',mode:'api-key'}]};
 const reports=[7,30,60,90].map(days=>({days,report:{start:'2026-11-06',end:'2026-11-12',groups:[{id:'server-lab',metrics:{views:{latest:0,latestCount:1,eligible:1,period:{delta:0}},shares:{latest:null,latestCount:0,eligible:1,period:{delta:null}}}}]}}));
 const r=await audit({state,reports,checkedAt:'2026-11-13T12:00:00Z'}),a=r.accounts.find(a=>a.id==='lab-youtube');
 assert.equal(r.summary.registered,1);assert.deepEqual(a.measured,['views']);assert.equal(a.periods[7].metrics.views.latest,0);assert.equal(a.periods[90].metrics.shares.latest,null);
 assert.match(markdown(r),/\| 0 \| — \| — \| 공식 API \|/);assert.equal(r.unmatchedServerChannels.length,0);
});
