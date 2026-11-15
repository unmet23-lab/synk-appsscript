'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {audit,markdown,main}=require('../tools/계정성과점검.js');
test('실제 API의 groups 배열을 계정에 붙이고 0과 미측정을 구분한다',async()=>{
 const state={channels:[{id:'server-lab',platform:'youtube',legacyId:'lab-youtube',handle:'synkkorean',connected:true,lastCollectedAt:'2026-11-13T00:00:00Z'}],capabilities:[{id:'youtube',mode:'api-key'}]};
 const reports=[7,30,60,90].map(days=>({days,report:{start:'2026-11-06',end:'2026-11-12',groups:[{id:'server-lab',metrics:{views:{latest:0,latestCount:1,eligible:1,period:{delta:0}},shares:{latest:null,latestCount:0,eligible:1,period:{delta:null}}}}]}}));
 const r=await audit({state,reports,checkedAt:'2026-11-13T12:00:00Z'}),a=r.accounts.find(a=>a.id==='lab-youtube');
 assert.equal(r.summary.registered,1);assert.deepEqual(a.measured,['views']);assert.equal(a.periods[7].metrics.views.latest,0);assert.equal(a.periods[90].metrics.shares.latest,null);
 assert.match(markdown(r),/\| 0 \| — \| — \| 공식 API \|/);assert.equal(r.unmatchedServerChannels.length,0);
});
test('공식 내보내기 기록은 API 연결 실패로 표시하지 않고 별도 기간과 실제 0을 보존한다',async()=>{
 const externalCollection={lastObservedAt:'2026-11-14T06:00:00Z',byKind:{'account-period':{observedAt:'2026-11-14T06:00:00Z',period:{start:'2026-11-13',end:'2026-11-13'},metrics:{views:0,likes:null}}}};
 const state={channels:[{id:'naver',catalogAccountId:'shift-class-naverblog',platform:'naver-blog',connected:false,externalCollection}],capabilities:[]};
 const reports=[7,30,60,90].map(days=>({days,report:{start:'2026-11-07',end:'2026-11-13',groups:[],externalObservations:{truncated:days===90,channels:[{channelId:'naver',observations:[{kind:'account-period',metrics:{views:0}}]}]}}}));
 const r=await audit({state,reports}),a=r.accounts.find(a=>a.id==='shift-class-naverblog');
 assert.equal(r.summary.registered,1);assert.equal(r.summary.connected,0);assert.equal(r.summary.externallyObserved,1);assert.equal(r.unmatchedServerChannels.length,0);
 assert.deepEqual(a.externallyMeasured,['views']);assert.equal(a.periods[7].metrics.views.latest,null);assert.equal(a.externalPeriods[90].truncated,true);
 const md=markdown(r);assert.match(md,/shiftclass.*플랫폼 통계 확인됨/);assert.match(md,/계정 기간 통계 \| 2026-11-13 ~ 2026-11-13 \| 0 \| — \| —/);assert.doesNotMatch(md,/shiftclass.*연결 필요/);
});
test('따로 받은 조회수·방문 내보내기를 최신 공유 관측이 가리지 않고 다른 계정과 미측정 값은 세지 않는다',async()=>{
 const state={channels:[{id:'fb',catalogAccountId:'yuhokorean-facebook',platform:'facebook',connected:false,
  externalCollection:{byKind:{'account-period':{metrics:{shares:0,likes:5}}}}}],capabilities:[]};
 const reports=[7,30,60,90].map(days=>({days,report:{groups:[],externalObservations:{channels:[
  {channelId:'other',observations:[{metrics:{reach:100}}]},
  {channelId:'fb',observations:[{metrics:{views:0,likes:null}},{metrics:{profileVisits:15}},{metrics:{shares:0}}]},
 ]}}}));
 const result=await audit({state,reports}),account=result.accounts.find(a=>a.id==='yuhokorean-facebook');
 assert.deepEqual(account.externallyMeasured,['views','profileVisits','shares']);
 assert.deepEqual(account.measured,[]);
 assert.equal(result.summary.connected,0);
});

// 수명 시험: 실제 네트워크·자격 없이 connect만 바꿔 끼운다. 환경에 빌린 세션 표시가 있어도 점검은 자기 세션(session:null)으로만 연결하고,
// 끝의 로그아웃은 그렇게 받은 세션 대역에만 간다.
function lifecycle(t,{failState=false}={}){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'account-audit-')),previous=process.env.SYNK_WORKSPACE_SESSION;
 process.env.SYNK_WORKSPACE_SESSION='borrowed-session-marker';
 t.after(()=>{fs.rmSync(out,{recursive:true,force:true});if(previous===undefined)delete process.env.SYNK_WORKSPACE_SESSION;else process.env.SYNK_WORKSPACE_SESSION=previous;});
 const calls=[],connects=[];
 const owned={get:async route=>{calls.push(['GET',route]);if(failState)throw new Error('state 읽기 실패(시험)');return route==='/api/state'?{channels:[],capabilities:[]}:{start:'2026-11-07',end:'2026-11-13',groups:[]};},
  post:async route=>{calls.push(['POST',route]);return {};}};
 return {out,calls,connects,connect:async options=>{connects.push(options);return owned;}};
}
const OWN={origin:'https://workspace.synk.im',session:null};
test('점검은 환경의 빌린 세션을 쓰지 않고 자기 세션으로 읽은 뒤 그 세션만 로그아웃한다',async t=>{
 const l=lifecycle(t),lines=[];
 await main(['--출력',l.out],{connect:l.connect,log:line=>lines.push(line)});
 assert.deepEqual(l.connects,[OWN]);
 assert.deepEqual(l.calls.map(([method,route])=>`${method} ${route.split('?')[0]}`),['GET /api/state',...Array(4).fill('GET /api/analytics'),'POST /api/logout']);
 assert.ok(fs.existsSync(path.join(l.out,'계정성과점검.json')));assert.equal(lines.length,1);
 assert.doesNotMatch(JSON.stringify([l.connects,l.calls,lines]),/borrowed-session-marker/);
});
test('읽기가 실패해도 자기 세션은 한 번만 로그아웃하고, 자격이 없으면 빌린 세션으로 대신하지 않고 멈춘다',async t=>{
 const l=lifecycle(t,{failState:true});
 await assert.rejects(main(['--출력',l.out],{connect:l.connect,log:()=>{}}),/state 읽기 실패/);
 assert.deepEqual(l.connects,[OWN]);assert.deepEqual(l.calls,[['GET','/api/state'],['POST','/api/logout']]);
 assert.equal(fs.existsSync(path.join(l.out,'계정성과점검.json')),false);
 const none=[];
 await assert.rejects(main(['--출력',l.out],{connect:async options=>{none.push(options);throw Object.assign(new Error('자격 없음(시험)'),{code:'NO_CREDENTIAL'});},log:()=>{}}),/자격 없음/);
 assert.deepEqual(none,[OWN]);assert.equal(l.calls.length,2);
});
