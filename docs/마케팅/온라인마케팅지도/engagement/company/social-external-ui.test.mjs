import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function ui(){
  const source=readFileSync(new URL('./public/social-simple.js',import.meta.url),'utf8');
  const cut=source.indexOf('// ── 상태와 불러오기 ──');
  assert.ok(cut>0);
  const context={URLSearchParams};vm.createContext(context);
  vm.runInContext(source.slice(0,cut)+'\nObject.assign(globalThis,{ssPerfExternal,ssAccExt,ssPerfBlock,ssExtPeriodSummary,ssExtCompare});',context);
  return context;
}
const period={start:'2026-10-15',end:'2026-11-13'};
const observation={kind:'account-period',period,metrics:{impressions:49,reach:15,likes:0,shares:null},observedAt:'2026-11-14T06:00:00+09:00',sourceType:'creator-screen',sourceHost:'www.linkedin.com',labels:{metricLabels:{likes:'반응'}}};
const channel={channelId:'test-li',accountId:'test-person',platform:'linkedin',displayName:'시험 계정',business:'SYNK',observations:[observation]};
const report={externalObservations:{includedInTotals:false,channels:[channel]}};
const options={range:period,days:30,today:'2026-11-14'};

test('API가 없는 플랫폼도 노출·도달을 원래 이름과 숫자로 표시한다',()=>{
  const html=ui().ssPerfExternal(report,options);
  assert.match(html,/노출/);assert.match(html,/>49<\/td>/);assert.match(html,/>15<\/td>/);
  assert.match(html,/title="반응"/);
  assert.match(html,/class="is-num" title="반응">0<\/td>/);
  assert.match(html,/class="is-num is-dash">—<\/td>/);
  assert.match(html,/계정 기간·누적 통계는 위 숫자에 더하지 않아요/);assert.match(html,/게시물별로 확인한 누적 수치는 중복 없이 기존 게시물 기록에 반영될 수 있어요/);
});
test('다른 기간·계정 누적·게시물 누적을 선택 기간 총계로 바꾸지 않는다',()=>{
  const rows=[observation,{...observation,kind:'account-lifetime',period:null,metrics:{followers:7}},{...observation,kind:'post-lifetime',period:null,post:{externalId:'post1',publishedAt:'2026-10-01T12:00:00Z',url:'https://example.com/post1'},metrics:{views:987}}];
  const html=ui().ssPerfExternal({externalObservations:{channels:[{...channel,observations:rows}]}},{...options,range:{start:'2026-11-07',end:'2026-11-13'}}).replace(/\u00a0/g,' ');
  assert.match(html,/선택한 2026-11-07~2026-11-13 기간과 다름/);
  assert.match(html,/기간 증가 아님/);assert.match(html,/계정 기간 합계 아님/);
  assert.match(html,/팔로워/);assert.match(html,/>7<\/td>/);
});
test('플랫폼·계정 선택이 다른 외부 관측을 숨긴다',()=>{
  const screen=ui();
  for(const target of ['channel:elsewhere','platform:youtube','business:LAB']){
    const html=screen.ssPerfExternal(report,{...options,target});
    assert.doesNotMatch(html,/>49<\/td>/);assert.match(html,/통계가 아직 없어요/);
  }
  assert.match(screen.ssPerfExternal(report,{...options,target:'channel:test-li'}),/>49<\/td>/);
});
test('계정 카드의 외부 통계 확인은 API 수집 성공으로 바뀌지 않는다',()=>{
  const html=ui().ssAccExt({...observation,lastObservedAt:observation.observedAt},'연결 필요','2026-11-14').replace(/\u00a0/g,' ');
  assert.match(html,/관리 화면 확인/);assert.match(html,/노출 49/);assert.doesNotMatch(html,/API 연결 완료|수집 중/);
});
test('출처·계정·플랫폼 지표명에 들어온 HTML을 실행 가능한 태그로 만들지 않는다',()=>{
  const obs={...observation,labels:{metricLabels:{likes:'" onmouseover="alert(1)'}}};
  const html=ui().ssPerfExternal({externalObservations:{channels:[{...channel,displayName:'<img src=x onerror=alert(1)>',observations:[obs]}]}},options);
  assert.doesNotMatch(html,/<img src=x/);assert.doesNotMatch(html,/title="" onmouseover=/);
  assert.match(html,/&lt;img/);assert.match(html,/&quot; onmouseover=&quot;/);
});

const daily=(date,value,metric='views',overrides={})=>({kind:'account-period',period:{start:date,end:date},metrics:{[metric]:value},observedAt:'2026-11-14T06:00:00Z',sourceType:'official-export',sourceHost:'admin.blog.naver.com',...overrides});
test('일별 0은 측정값이고 하루라도 빠지면 기간 합계를 만들지 않는다',()=>{
  const s=ui(),rows=[daily('2026-11-11',4),daily('2026-11-12',0),daily('2026-11-13',9)];
  const full=s.ssExtPeriodSummary(rows,'views','2026-11-11','2026-11-13');
  assert.equal(full.total,13);assert.equal(full.complete,true);assert.equal(full.mode,'daily-sum');
  const missing=s.ssExtPeriodSummary([rows[0],rows[2]],'views','2026-11-11','2026-11-13');
  assert.equal(missing.total,null);assert.equal(missing.complete,false);assert.equal(missing.missingDays,1);
  const zero=s.ssExtPeriodSummary(rows.map(r=>({...r,metrics:{views:0}})),'views','2026-11-11','2026-11-13');
  assert.equal(zero.total,0);assert.equal(zero.complete,true);
});
test('정확한 기간 합계를 우선하고 일별 관측이나 게시물 누적을 중복 합산하지 않는다',()=>{
  const s=ui(),rows=[daily('2026-11-11',4),daily('2026-11-12',7),daily('2026-11-13',9),{...daily('2026-11-11',42),period:{start:'2026-11-11',end:'2026-11-13'}},{kind:'post-lifetime',metrics:{views:800}}];
  const result=s.ssExtPeriodSummary(rows,'views','2026-11-11','2026-11-13');
  assert.equal(result.total,42);assert.equal(result.mode,'exact');assert.equal(result.daily[0].value,4);
});
test('같은 날짜는 최신 관측 한 번만 세며 도달과 고유 방문자를 일별 합산하지 않는다',()=>{
  const s=ui();
  const rows=[daily('2026-11-11',3),daily('2026-11-11',5,'views',{observedAt:'2026-11-14T09:00:00Z'}),daily('2026-11-12',7)];
  assert.equal(s.ssExtPeriodSummary(rows,'views','2026-11-11','2026-11-12').total,12);
  for(const metric of ['reach','visitors']){
    const result=s.ssExtPeriodSummary([daily('2026-11-11',3,metric),daily('2026-11-12',5,metric)],metric,'2026-11-11','2026-11-12');
    assert.equal(result.total,null);assert.equal(result.reason,'non-additive');
    assert.equal(s.ssExtPeriodSummary([{...daily('2026-11-11',6,metric),period:{start:'2026-11-11',end:'2026-11-12'}}],metric,'2026-11-11','2026-11-12').total,6);
  }
});
test('앞 기간 0과 자료 없음, 서로 다른 지표의 비교를 구분한다',()=>{
  const s=ui(),sum=(value,label='조회수')=>s.ssExtPeriodSummary([daily('2026-11-13',value,'views',{labels:{metricLabels:{views:label}}})],'views','2026-11-13','2026-11-13');
  assert.equal(s.ssExtCompare(sum(15),sum(10)).percent,50);
  const activity=s.ssExtCompare(sum(3),sum(0));assert.equal(activity.status,'new-activity');assert.equal(activity.percent,null);
  const unchanged=s.ssExtCompare(sum(0),sum(0));assert.equal(unchanged.status,'same-zero');assert.equal(unchanged.percent,null);
  assert.equal(s.ssExtCompare(sum(4),sum(2,'커뮤니티 페이지 조회수')).reason,'different-definitions');
  assert.equal(s.ssExtCompare(sum(4),s.ssExtPeriodSummary([],'views','2026-11-12','2026-11-12')).comparable,false);
});
test('잘린 관측과 서로 다른 정의가 섞인 일별 기록은 완전한 합계로 표시하지 않는다',()=>{
  const s=ui(),rows=[daily('2026-11-11',4),daily('2026-11-12',7)];
  const clipped=s.ssExtPeriodSummary(rows,'views','2026-11-11','2026-11-12',{truncated:true});
  assert.equal(clipped.total,null);assert.equal(clipped.reason,'truncated');
  const mixed=s.ssExtPeriodSummary([rows[0],{...rows[1],labels:{metricLabels:{views:'동영상 조회수'}}}],'views','2026-11-11','2026-11-12');
  assert.equal(mixed.total,null);assert.equal(mixed.reason,'heterogeneous-definition');
});
test('외부 일별 그래프는 누적값의 차분이 아닌 실제 하루 값을 읽을 수 있게 표시한다',()=>{
  const rows=[daily('2026-11-11',4),daily('2026-11-12',7),daily('2026-11-13',9)];
  const html=ui().ssPerfExternal({externalObservations:{channels:[{...channel,observations:rows}]}},{...options,days:3,range:{start:'2026-11-11',end:'2026-11-13',prevStart:'2026-11-08',prevEnd:'2026-11-10'}});
  assert.match(html,/하루 조회수/);assert.match(html,/>20<\/strong>/);assert.doesNotMatch(html,/aria-label="날마다 늘어난/);
});

test('같은 기간 합계는 변동 없음으로 설명하고 날짜만 알려진 관측에 시각을 붙이지 않는다',()=>{
  const s=ui(),current={...observation,metrics:{views:120},observedAt:'2026-11-14T00:00:00Z',observedDateOnly:true};
  const previous={...current,period:{start:'2026-09-15',end:'2026-10-14'},observedAt:'2026-10-15T00:00:00Z'};
  const html=s.ssPerfExternal({externalObservations:{channels:[{...channel,observations:[current]}]}},{...options,metric:'views',previous:{externalObservations:{channels:[{...channel,observations:[previous]}]}}});
  assert.match(html,/바로 앞 30일\(9\.15~10\.14\)과 같아 변동이 없어요\./);
  assert.match(html,/최신 관측 오늘<\/span>/);assert.doesNotMatch(html,/최신 관측 오늘 09:00/);
  const summary=s.ssExtPeriodSummary([current],'views',period.start,period.end);
  assert.equal(summary.total,120);assert.equal(summary.complete,true);assert.equal(summary.latestObservedDateOnly,true);
});

test('관측 표는 날짜만 아는 기록과 정확한 시각을 아는 기록을 각각 표시한다',()=>{
  const rows=[{...observation,observedAt:'2026-11-14T00:00:00Z',observedDateOnly:true},{...observation,kind:'account-lifetime',period:null,observedAt:'2026-11-14T02:02:00Z',observedDateOnly:false,metrics:{followers:7}}];
  const html=ui().ssPerfExternal({externalObservations:{channels:[{...channel,observations:rows}]}},options);
  assert.match(html,/<td>오늘<\/td>/);assert.match(html,/<td>오늘 11:02<\/td>/);assert.doesNotMatch(html,/<td>오늘 09:00<\/td>/);
});
