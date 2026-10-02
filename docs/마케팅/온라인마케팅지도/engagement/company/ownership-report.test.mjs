import test from 'node:test';
import assert from 'node:assert/strict';
import {recordsForOwner} from './ownership-report.mjs';
import {analyze} from '../analytics.mjs';
const channel={id:'c',ready:true,ownerIds:['new'],teamId:null};
const event=(time,before,after)=>({channelId:'c',effectiveAt:time,recordedAt:time,beforeOwnerIds:before,afterOwnerIds:after,afterTeamId:null});
const events=[event('2026-09-01T00:00:00Z',[],['old']),event('2026-09-03T00:00:00Z',['old'],['new'])];
const records={posts:[{id:'p',channelId:'c',title:'Post',publishedDate:'2026-09-01',publishedAt:'2026-09-01T01:00:00Z'}],snapshots:[
 {postId:'p',date:'2026-09-01',checkedAt:'2026-09-01T02:00:00Z',views:10},
 {postId:'p',date:'2026-09-02',checkedAt:'2026-09-02T02:00:00Z',views:20},
 {postId:'p',date:'2026-09-03',checkedAt:'2026-09-03T02:00:00Z',views:100},
 {postId:'p',date:'2026-09-04',checkedAt:'2026-09-04T02:00:00Z',views:150}],channelSnapshots:[]};
const report=(owner,data=records,history=events,start='2026-09-01',end='2026-09-04')=>{const mine=recordsForOwner(data,[channel],history,owner,end);return analyze(mine.records,{channels:mine.channels},{start,end});};
test('old observations stay with the old owner after current assignment changes',()=>{
 assert.equal(report('old').metrics.views.latest,20);assert.equal(report('new').metrics.views.latest,150);
 assert.equal(report('new').metrics.views.period.delta,null,'new owner must not receive pre-handover lifetime counts');
 assert.equal(report('new').daily.find(d=>d.date==='2026-09-04').metrics.views.change.delta,50);
});
test('unproven historic ownership and invalid observation timestamps stay unassigned',()=>{
 const old={...records,snapshots:records.snapshots.map(r=>({...r,checkedAt:'not-a-time'}))};assert.equal(report('old',old).metrics.views.latest,null);
 assert.equal(report('old',records,events.map(e=>({...e,effectiveAt:'2026-09-10T00:00:00Z'}))).metrics.views.latest,null);
});
test('an owner returning after another owners interval cannot absorb the intervening growth',()=>{
 const history=[...events,event('2026-09-04T00:00:00Z',['new'],['old'])];
 assert.equal(report('old',records,history,'2026-09-03','2026-09-04').metrics.views.period.delta,null);
 assert.equal(report('old',records,history,'2026-09-01','2026-09-04').metrics.views.period.delta,null);
});
test('normal new posts retain a zero-before-publication baseline for the established owner',()=>{
 assert.equal(report('old',records,events,'2026-09-01','2026-09-02').metrics.views.period.delta,20);
});
