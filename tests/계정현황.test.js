'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loginOf,publicationOf,classification,decorateAccount}=require('../tools/lib/계정현황.js');
test('로그인 성공은 시간 경과로 로그아웃이 되지 않고, 새 관측과 현재 프로필이 우선한다',()=>{
 const now=Date.parse('2026-11-13T12:00:00Z');
 const old=loginOf({registry:{loginVerifiedAt:'2026-11-01',egoProfile:'Profile 5'},audit:{loginBrowser:'Profile 2'},now});
 assert.equal(old.state,'historical');assert.equal(old.browser,'Ego · Profile 5');
 const fresh=loginOf({registry:{loginVerifiedAt:'2026-11-01'},observed:{login:{state:'verified',observedAt:'2026-11-13',browser:'Profile 5',scope:'creator owner screen'}},now});
 assert.equal(fresh.state,'verified');assert.equal(fresh.scope,'creator owner screen');
 assert.equal(loginOf({audit:{loginBrowser:'Profile 2'},now}).browser,'현재 운영 프로필 확인 전');
});
test('점검표보다 나중의 로그인 확인은 72시간이 지나도 경로 확인으로 남고, 옛 점검표 분류로 돌아가지 않는다',()=>{
 // 11-15: 11-12 로그인 확인(인스타 @synk.jp 비밀번호 로그인 등)이 72시간 뒤 11-08 점검표의 「전환만 · 보완 필요」로 되돌아갔다.
 const audit={loginEvidenceAt:'2026-11-08',loginMappingStatus:'switch-only'},registry={loginVerifiedAt:'2026-11-12',egoProfile:'Profile 5'};
 const fresh=loginOf({registry,audit,now:Date.parse('2026-11-13T12:00:00Z')}),aged=loginOf({registry,audit,now:Date.parse('2026-11-16T12:00:00Z')});
 assert.equal(fresh.state,'verified');assert.equal(aged.state,'historical');
 assert.equal(fresh.routeConfirmed,true);assert.equal(aged.routeConfirmed,true);
 // 점검표와 같은 날이거나 더 옛 확인, 점검표만 있는 것, 로그인 필요 관측은 경로 확인이 아니다.
 const at=Date.parse('2026-11-09T12:00:00Z');
 assert.equal(loginOf({registry:{loginVerifiedAt:'2026-11-09'},audit:{loginEvidenceAt:'2026-11-09'},now:at}).routeConfirmed,false);
 assert.equal(loginOf({registry:{loginVerifiedAt:'2026-09-20'},audit:{loginEvidenceAt:'2026-11-09'},now:at}).routeConfirmed,false);
 assert.equal(loginOf({audit,now:at}).routeConfirmed,false);
 assert.equal(loginOf({registry,audit,observed:{login:{state:'login-required',observedAt:'2026-11-13',scope:'확인한 프로필'}},now:Date.parse('2026-11-13T12:00:00Z')}).routeConfirmed,false);
 const ctx={registry:{accounts:{a:registry,b:{loginVerifiedAt:'2026-09-20'}}},audit:{accounts:{a:audit,b:{loginEvidenceAt:'2026-11-09',loginMappingStatus:'partial'}}},observations:{accounts:{}},publications:new Map(),now:Date.parse('2026-11-16T12:00:00Z'),
  assignments:{accounts:Object.fromEntries(['a','b'].map(id=>[id,{business:'LAB',contentTrack:'t',purpose:'p',classificationBasis:'근거',classificationSourcePaths:['docs/x.md']}]))}};
 const a=decorateAccount({id:'a',accountStatus:'confirmed-expansion'},ctx),b=decorateAccount({id:'b',accountStatus:'confirmed-expansion'},ctx);
 assert.equal(a.operations.login.state,'historical');assert.equal(a.loginMappingStatus,'confirmed');
 assert.equal(b.loginMappingStatus,'partial');
 assert.equal('routeConfirmed' in a.operations.login,false,'경로 판정 값은 화면 자료에 싣지 않는다');
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
