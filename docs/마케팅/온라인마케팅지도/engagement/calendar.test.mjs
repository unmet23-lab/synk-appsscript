import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarBounds, calendarPeriods, buildCalendar, calendarCsv } from './calendar.mjs';
const catalog={channels:[
  {id:'a',brand:'LAB',platform:'YouTube',country:'한국',ready:true},
  {id:'b',brand:'SHIFT',platform:'Instagram',country:'몽골',ready:true},
  {id:'no',brand:'LAB',ready:false}
]};
const post=(id,channelId='a',publishedDate='2026-06-01')=>({id,title:id,url:'https://example.test/'+id,channelId,publishedDate});
const snap=(postId,date,likes,comments=null)=>({postId,date,likes,comments});
const data={posts:[post('old'),post('down','b'),post('first'),post('new','a','2026-09-10'),post('future','a','2026-09-25')],snapshots:[
  snap('old','2026-07-31',100,10),snap('old','2026-08-24',130,13),snap('old','2026-08-31',150,15),snap('old','2026-09-24',210,12),snap('old','2026-09-25',9999,9999),
  snap('down','2026-07-31',1000),snap('down','2026-08-24',1100),snap('down','2026-08-31',1150),snap('down','2026-09-24',1130),
  snap('first','2026-08-31',50),snap('first','2026-09-24',70),
  snap('new','2026-09-24',40,0),snap('future','2026-09-25',9999)
],channelSnapshots:[{channelId:'a',date:'2026-07-31',followers:100},{channelId:'a',date:'2026-08-24',followers:120},{channelId:'a',date:'2026-08-31',followers:130},{channelId:'a',date:'2026-09-24',followers:125},{channelId:'b',date:'2026-09-24',followers:900}]};
const options={end:'2026-09-24',grain:'month',count:3};

test('달력 경계: 월요일 시작, 연도 전환, 윤년과 실제 분기',()=>{
  assert.equal(calendarBounds('2026-01-01','week').start,'2025-12-29');
  assert.equal(calendarBounds('2026-01-04','week').end,'2026-01-04');
  assert.equal(calendarBounds('2024-02-12','month').end,'2024-02-29');
  assert.equal(calendarBounds('2026-04-01','quarter').start,'2026-04-01');
  assert.equal(calendarBounds('2026-09-24','quarter').end,'2026-09-30');
  assert.throws(()=>calendarBounds('2026-02-30','month'));
  assert.throws(()=>calendarPeriods('2026-09-24','week',25));
});
test('진행 중은 같은 경과 일수, 완료는 전체 달력끼리 비교한다',()=>{
  const [current,previous]=calendarPeriods('2026-09-24','month',2);
  assert.equal(current.comparison.previousEnd,'2026-08-24');
  assert.equal(current.comparison.matchingDays,24);
  assert.equal(current.elapsed,24);
  assert.equal(previous.open,false);
  assert.equal(previous.comparison.previousEnd,'2026-07-31');
  const short=calendarPeriods('2026-03-30','month',1)[0];
  assert.equal(short.through,'2026-03-30');
  assert.equal(short.comparison.currentEnd,'2026-03-28');
  assert.equal(short.comparison.previousEnd,'2026-02-28');
  assert.equal(short.comparison.trimmed,true);
  const quarter=calendarPeriods('2026-09-24','quarter',1)[0];
  assert.equal(quarter.elapsed,86);assert.equal(quarter.comparison.previousEnd,'2026-06-25');
  assert.equal(calendarPeriods('2026-01-05','week',1)[0].comparison.previousEnd,'2025-12-29');
  assert.equal(calendarPeriods('2026-09-24','quarter',24).length,24);
});
test('순증감과 직전 대비는 별도이며 양 기간 공통 관측 대상만 비교한다',()=>{
  const r=buildCalendar(data,catalog,options),m=r.rows[0].metrics.likes;
  assert.equal(m.total,1450);assert.equal(m.net.delta,100);assert.equal(m.net.baseline,1350);
  assert.equal(m.net.rate,100/1350*100);assert.equal(m.net.increases,120);assert.equal(m.net.decreases,-20);
  assert.equal(m.net.newValue,40);assert.equal(m.dailyAverage,100/24);
  // first는 이번 +20을 알지만 직전 시작 기록이 없어 공통 비교에서 제외.
  assert.deepEqual(m.vs,{current:80,previous:130,diff:-50,rate:-50/130*100,count:3,eligible:4});
  assert.equal(m.previousFull.delta,200);assert.equal(m.previousFull.count,2);
  assert.equal(r.posts.length,4);assert.equal(r.rows[0].newPosts,1);
});
test('반응은 동일 게시물의 지표 단위로 합치고 상승·하락을 보존한다',()=>{
  const m=buildCalendar(data,catalog,options).rows[0].metrics.reactions;
  assert.equal(m.net.delta,97);assert.equal(m.net.increases,120);assert.equal(m.net.decreases,-23);
  assert.equal(m.net.increases+m.net.decreases,m.net.delta);
  assert.equal(m.net.count,6);assert.equal(m.net.eligible,16);
  assert.equal(m.net.baseline,1365);assert.equal(m.net.rate,97/1365*100);
  assert.equal(m.vs.current,77);assert.equal(m.vs.previous,133);assert.equal(m.vs.diff,-56);
  assert.equal(m.vs.count,5);assert.equal(m.vs.rate,-56/133*100);
});
test('팔로워는 채널 단위이며 미관측은 0이 아니다',()=>{
  const r=buildCalendar(data,catalog,options),m=r.rows[0].metrics.followers;
  assert.equal(m.net.delta,-5);assert.equal(m.net.count,1);assert.equal(m.net.eligible,2);
  assert.equal(m.vs.diff,-25);assert.equal(m.vs.rate,-125);
  assert.equal(r.rows[0].metrics.shares.net.delta,null);
  assert.equal(r.rows[0].metrics.shares.vs.current,null);
  assert.equal(r.rows[0].metrics.comments.net.newValue,0);
});
test('신규만 있을 때와 직전 감소일 때 비율은 무한대나 역방향으로 표현하지 않는다',()=>{
  const fresh=buildCalendar({posts:[post('new','a','2026-09-01')],snapshots:[snap('new','2026-09-24',5)],channelSnapshots:[]},catalog,options).rows[0].metrics.likes;
  assert.equal(fresh.net.delta,5);assert.equal(fresh.net.baseline,0);assert.equal(fresh.net.rate,null);
  assert.equal(fresh.vs.previous,0);assert.equal(fresh.vs.diff,5);assert.equal(fresh.vs.rate,null);
  const down=buildCalendar({posts:[post('x')],snapshots:[snap('x','2026-07-31',100),snap('x','2026-08-24',90),snap('x','2026-08-31',85),snap('x','2026-09-24',90)],channelSnapshots:[]},catalog,options).rows[0].metrics.likes;
  assert.equal(down.vs.diff,15);assert.equal(down.vs.rate,null);
});
test('각 묶음과 게시물의 기여 합계가 전체와 일치하고 필터가 모든 기간에 적용된다',()=>{
  const r=buildCalendar(data,catalog,options);
  for(const p of r.rows)for(const d of ['channel','brand','platform','country','post']){
    const items=r.detail(p.id,d);
    for(const k of ['likes','reactions'])for(const field of ['delta','increases','decreases'])assert.equal(items.reduce((sum,row)=>sum+(row.metrics[k].net[field]??0),0),p.metrics[k].net[field]??0);
    assert.equal(items.reduce((sum,row)=>sum+(row.metrics.likes.vs.diff??0),0),p.metrics.likes.vs.diff??0);
  }
  const filtered=buildCalendar(data,catalog,{...options,platform:'Instagram',country:'몽골'});
  assert.equal(filtered.posts.length,1);assert.equal(filtered.rows[0].metrics.likes.net.delta,-20);
  assert.ok(filtered.rows.every(p=>p.metrics.likes.net.eligible===1));
  assert.equal(buildCalendar(data,catalog,{...options,channel:'missing'}).rows[0].metrics.likes.total,null);
});
test('짧은 이전 달에 맞춘 비교에서는 잘린 날짜의 신규 게시물을 제외한다',()=>{
  const r=buildCalendar({posts:[post('late','a','2026-03-29')],snapshots:[snap('late','2026-03-30',20)],channelSnapshots:[]},catalog,{end:'2026-03-30',grain:'month',count:1});
  assert.equal(r.rows[0].metrics.likes.net.delta,20);
  assert.equal(r.rows[0].metrics.likes.vs.eligible,0);
  assert.equal(r.rows[0].metrics.likes.vs.diff,null);
});
test('CSV는 선택 범위·정의·원 계산값을 보존하고 빈 값과 음수 및 수식 제목을 구분한다',()=>{
  const r=buildCalendar({...data,posts:data.posts.map(p=>p.id==='down'?{...p,title:'=SUM(1,2)'}:p)},catalog,{...options,channel:'b'});
  const csv=calendarCsv(r,r.rows[0].id,'post');
  assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/동일 대상/);assert.match(csv,/"'\=SUM\(1,2\)"/);
  const lines=csv.split('\r\n'), header=lines.find(l=>l.startsWith('"구분"'));
  const line=lines.find(l=>l.startsWith('"기간","선택 범위","2026년 9월"')&&l.includes('"좋아요"'));
  const cols=s=>s.slice(1,-1).split('","');
  const h=cols(header),values=cols(line);
  assert.equal(values.length,h.length);assert.equal(values[h.indexOf('순증감')],'-20');
  assert.equal(values[h.indexOf('직전 대비 차이')],'-120');
  assert.equal(values[h.indexOf('직전 비교 종료')],'2026-08-24');
  const missing=cols(lines.find(l=>l.startsWith('"기간","선택 범위","2026년 9월"')&&l.includes('"공유"')));
  assert.equal(missing[h.indexOf('순증감')],'');assert.ok(!csv.includes('future'));
});
