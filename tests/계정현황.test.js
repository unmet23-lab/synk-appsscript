'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loginOf,publicationOf,classification}=require('../tools/lib/계정현황.js');
test('로그인 성공은 시간 경과로 로그아웃이 되지 않고, 새 관측과 현재 프로필이 우선한다',()=>{
 const now=Date.parse('2026-11-13T12:00:00Z');
 const old=loginOf({registry:{loginVerifiedAt:'2026-11-01',egoProfile:'Profile 5'},audit:{loginBrowser:'Profile 2'},now});
 assert.equal(old.state,'historical');assert.equal(old.browser,'Ego · Profile 5');
 const fresh=loginOf({registry:{loginVerifiedAt:'2026-11-01'},observed:{login:{state:'verified',observedAt:'2026-11-13',browser:'Profile 5',scope:'creator owner screen'}},now});
 assert.equal(fresh.state,'verified');assert.equal(fresh.scope,'creator owner screen');
 assert.equal(loginOf({audit:{loginBrowser:'Profile 2'},now}).browser,'현재 운영 프로필 확인 전');
});
test('이름순으로 오래된 근거가 밀려도 미래 예약은 보존하고 지난 예약은 게시로 만들지 않는다',()=>{
 const now=Date.parse('2026-11-13T12:00:00Z'),future={state:'예약됨',at:'2026-12-01T12:00:00Z',episode:'AAA-new'};
 const rows=[future,...Array.from({length:70},(_,i)=>({state:'게시됨',at:new Date(now-(i+1)*86400000).toISOString(),episode:'ZZZ-'+i})),{state:'예약됨',at:'2026-11-12T12:00:00Z'}];
 const p=publicationOf(rows,now);
 assert.equal(p.publishedCount,60);assert.equal(p.omittedPublishedCount,10);assert.equal(p.scheduledCount,1);assert.equal(p.pendingConfirmationCount,1);
 assert.equal(p.nextScheduledAt,future.at);assert.ok(p.receipts.includes(future));assert.equal(p.lastPublishedAt,'2026-11-12T12:00:00.000Z');
});
test('새 계정은 홍보 사업과 근거를 먼저 정해야 원장에 들어간다',()=>{
 assert.throws(()=>classification({accounts:{}},'new'),/계정 사업 속성이 빠졌습니다/);
 assert.equal(classification({accounts:{new:{business:'LAB',contentTrack:'yuhokorean',purpose:'한국어 학습',classificationBasis:'채널 개설 원문',classificationSourcePaths:['docs/source.md']}}},'new').business,'LAB');
});
