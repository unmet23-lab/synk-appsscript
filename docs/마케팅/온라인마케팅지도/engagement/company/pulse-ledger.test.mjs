// PULSE 운영판 장부(2026-11-14 운영 조각 8-A, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S4) — 순수 함수 · CSV · 일정 파생.
// 실제 서버 길(권한별 응답 · 달 고르기 · CSV 내려받기)은 pulse-presale-server.test.mjs 「운영 조각 8-A」가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pulseLedger,pulseLedgerCsv,ledgerMonths,payStatus} from './pulse-ledger.mjs';
import {buildClientSchedule} from './client-schedule.mjs';

const NOW='2026-11-14T03:00:00.000Z'; // 한국 11-14 낮
let n=0;
function project({pkg='s30',payment=null,log,stage='producing',title='',extra={}}={}){
  n++;
  const request={schemaVersion:1,number:`P-1114-${String(n).padStart(4,'0')}`,status:'confirmed',submittedAt:'2026-10-01T00:00:00.000Z',confirmedAt:'2026-10-01T01:00:00.000Z',answers:{package:pkg},asks:[],notes:[],rounds:[],...(payment?{payment}:{}),...(log?{paymentLog:log}:{}),...extra};
  return {id:`p${n}`,title:title||`광고 ${n}`,customerName:`손님 ${n}`,stage,updatedAt:'2026-11-01T00:00:00.000Z',versions:[],studio:{request}};
}

test('월별: 한국 날짜로 달을 가르고, 확인 매출 · 실수령 · 환불 · 금액 없음을 따로 센다 — 취소 뒤 다시 요청해도 앞 확인 · 환불이 남는다',()=>{
  n=0;
  const rows=[
    // 10-31 15:30 UTC = 한국 11-01 → 11월 매출.
    project({payment:{status:'confirmed',requestedAt:'2026-10-30T00:00:00.000Z',confirmedAt:'2026-10-31T15:30:00.000Z',amount:290000,dueDate:'2026-11-14',channel:'kmong',net:232000},
      log:[{kind:'requested',at:'2026-10-30T00:00:00.000Z',amount:290000},{kind:'confirmed',at:'2026-10-31T15:30:00.000Z',amount:290000,channel:'kmong',net:232000}]}),
    // 10월 확인 → 11월 환불 → 11월 다시 요청 · 확인(이력이 남는다).
    project({payment:{status:'confirmed',confirmedAt:'2026-11-10T01:00:00.000Z',amount:390000,dueDate:'2026-11-24'},
      log:[{kind:'requested',at:'2026-10-02T00:00:00.000Z',amount:390000},{kind:'confirmed',at:'2026-10-03T00:00:00.000Z',amount:390000},{kind:'cancelled',at:'2026-11-05T00:00:00.000Z',was:'confirmed'},{kind:'requested',at:'2026-11-09T00:00:00.000Z',amount:390000},{kind:'confirmed',at:'2026-11-10T01:00:00.000Z',amount:390000}]}),
    // 금액 없이 확인된 옛 건(이력 없음 — payment에서 이력을 만든다).
    project({payment:{status:'confirmed',confirmedAt:'2026-11-02T00:00:00.000Z',dueDate:'2026-11-12'}}),
    // 요청만 취소한 건은 환불이 아니다.
    project({payment:{status:'cancelled',requestedAt:'2026-11-03T00:00:00.000Z',cancelledAt:'2026-11-04T00:00:00.000Z',amount:290000},log:[{kind:'requested',at:'2026-11-03T00:00:00.000Z',amount:290000},{kind:'cancelled',at:'2026-11-04T00:00:00.000Z',was:'requested',amount:290000}]}),
  ];
  const ledger=pulseLedger(rows,{now:NOW});
  assert.equal(ledger.month,'2026-11');assert.equal(ledger.current,'2026-11');
  assert.deepEqual(ledger.months.map(m=>m.month),['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']);
  const nov=ledger.summary,oct=ledger.months.find(m=>m.month==='2026-10');
  assert.deepEqual([nov.revenue,nov.confirmed,nov.net,nov.netCount,nov.refunds,nov.refundCount,nov.noAmount],[680000,2,232000,1,390000,1,1]);
  assert.deepEqual([oct.revenue,oct.confirmed,oct.refunds],[390000,1,0],'환불은 환불한 달에, 앞 확인은 그 달에 남는다');
  // 다른 달을 고르면 그 달 표 · 합계.
  const october=pulseLedger(rows,{month:'2026-10',now:NOW});
  assert.equal(october.month,'2026-10');assert.equal(october.summary.revenue,390000);
  assert.deepEqual(october.rows.map(row=>row.id).sort(),['p1','p2'],'10월에 이력이 있는 건(요청 · 확인)');
  assert.equal(pulseLedger(rows,{month:'2026-13',now:NOW}).month,'2026-11','이상한 달은 이번 달');
  // 10월에 요청하고 11월에 확인 없이 취소 · 10월에 확인하고 11월에 받으실 날만 고친 건도 11월 표에 선다(돈은 안 셈) — 서버 검수 GA1.
  const quiet=[project({title:'요청 취소',payment:{status:'cancelled',requestedAt:'2026-10-30T00:00:00.000Z',cancelledAt:'2026-11-04T00:00:00.000Z',amount:290000},log:[{kind:'requested',at:'2026-10-30T00:00:00.000Z',amount:290000},{kind:'cancelled',at:'2026-11-04T00:00:00.000Z',was:'requested',amount:290000}]}),
    project({title:'날 고침',payment:{status:'confirmed',confirmedAt:'2026-10-20T00:00:00.000Z',amount:390000,dueDate:'2026-11-30'},log:[{kind:'confirmed',at:'2026-10-20T00:00:00.000Z',amount:390000},{kind:'due_changed',at:'2026-11-03T00:00:00.000Z',from:'2026-11-25',to:'2026-11-30'}]})];
  const quietNov=pulseLedger(quiet,{now:NOW});
  assert.deepEqual(quietNov.rows.map(row=>[row.title,row.status,row.statusLabel,row.amount]),[['요청 취소','cancelled','요청 취소',290000],['날 고침','confirmed','결제 확인',390000]],'그 달의 마지막 이력이 늦은 것부터');
  assert.deepEqual([quietNov.summary.revenue,quietNov.summary.refunds,quietNov.summary.confirmed],[0,0,0],'돈은 움직이지 않았다');
  assert.deepEqual(pulseLedgerCsv(quietNov).split('\r\n').filter(line=>/요청 취소|날 고침/.test(line)).length,2,'월 CSV에도');
  assert.deepEqual(pulseLedger(quiet,{month:'2026-10',now:NOW}).rows.map(row=>row.title).sort(),['날 고침','요청 취소']);
});

test('받을 돈 · 가장 가까운 받으실 날 · 표 · 4주 띠: 요청 뒤 미확인 합과 며칠째, 늦은 건이 먼저, 납품한 건은 띠에서 뺀다',()=>{
  n=0;
  const rows=[
    project({stage:'planning',payment:{status:'requested',requestedAt:'2026-11-09T00:00:00.000Z',amount:290000},log:[{kind:'requested',at:'2026-11-09T00:00:00.000Z',amount:290000}]}),
    project({stage:'planning',payment:{status:'requested',requestedAt:'2026-10-20T00:00:00.000Z'},log:[{kind:'requested',at:'2026-10-20T00:00:00.000Z'}]}),
    project({title:'늦은 건',payment:{status:'confirmed',confirmedAt:'2026-11-01T00:00:00.000Z',amount:290000,dueDate:'2026-11-12'}}),
    project({title:'다음 건',payment:{status:'confirmed',confirmedAt:'2026-11-05T00:00:00.000Z',amount:290000,dueDate:'2026-11-20'}}),
    project({title:'납품함',stage:'delivered',payment:{status:'confirmed',confirmedAt:'2026-11-03T00:00:00.000Z',amount:290000,dueDate:'2026-11-10'}}),
  ];
  const ledger=pulseLedger(rows,{now:NOW});
  assert.deepEqual(ledger.summary.receivable,{amount:290000,count:2,noAmount:1,oldestDays:25});
  assert.deepEqual(ledger.summary.nextDue,{date:'2026-11-12',id:'p3',title:'늦은 건',late:true},'납품 전 건 중 가장 이른 날(지났으면 늦음)');
  assert.deepEqual(ledger.band,{from:'2026-11-07',to:'2026-12-04',items:[{id:'p3',title:'늦은 건',start:'2026-11-01',end:'2026-11-12',turn:'us',late:true},{id:'p4',title:'다음 건',start:'2026-11-05',end:'2026-11-20',turn:'us',late:false}]});
  const requested=ledger.rows.find(row=>row.id==='p1');
  assert.deepEqual([requested.status,requested.statusLabel,requested.requestedDays,requested.amount,requested.turn,requested.turnLabel],['requested','결제 요청함',5,290000,'you','손님 차례']);
  assert.ok(requested.next,'다음 행동은 고객 방 머리 글');
  assert.equal(ledger.rows.find(row=>row.id==='p2').amount,null,'금액 없는 요청');
  // 결제 이력 · 메모 · 연락처 같은 원본 칸은 줄에 안 실린다.
  for(const row of ledger.rows)assert.deepEqual(Object.keys(row).sort(),['amount','channel','closed','confirmedDay','customer','dueDate','id','net','next','number','package','requestedDay','requestedDays','stage','status','statusLabel','title','turn','turnLabel'].sort());
  // 환불한 건: 표에는 남되 받은 곳 · 실수령은 확인 중인 결제에만 — 환불 뒤 줄에 남은 옛 실수령을 내리지 않는다.
  const refunded=pulseLedger([project({title:'환불 건',payment:{status:'cancelled',confirmedAt:'2026-11-02T00:00:00.000Z',cancelledAt:'2026-11-06T00:00:00.000Z',amount:290000,dueDate:'2026-11-20',channel:'direct',net:250000},
    log:[{kind:'confirmed',at:'2026-11-02T00:00:00.000Z',amount:290000,channel:'direct',net:250000},{kind:'cancelled',at:'2026-11-06T00:00:00.000Z',was:'confirmed'}]})],{now:NOW});
  assert.deepEqual(refunded.rows.map(row=>[row.status,row.statusLabel,row.amount,row.net,row.channel,row.dueDate]),[['refunded','환불',290000,null,'',''] ]);
  assert.deepEqual([refunded.summary.revenue,refunded.summary.net,refunded.summary.refunds,refunded.band.items.length,refunded.summary.nextDue],[290000,250000,290000,0,null],'확인 · 실수령은 그 달 이력대로, 환불은 따로, 띠 · 가까운 날에서는 빠진다');
  assert.equal(payStatus({status:'cancelled',confirmedAt:'x'}),'refunded');assert.equal(payStatus({status:'cancelled'}),'cancelled');assert.equal(payStatus(null),'none');
  assert.deepEqual(pulseLedger([{id:'old',stage:'producing',studio:{}}],{now:NOW}).rows,[],'의뢰서 없는 옛 흐름 건은 세지 않는다');
  assert.deepEqual(ledgerMonths('2026-02',3),['2025-12','2026-01','2026-02']);
  // 끝판 검수: 납품 · 보관한 건의 남은 요청은 받을 돈 · 이번 달 이월에서 빠지고(A1), 0026-11 같은 연도는 이번 달(A2),
  // 환불 뒤 금액 없이 다시 요청한 건에 옛 확인 금액을 붙이지 않고(A3), 달력에 없는 받으실 날은 날로 치지 않는다(A4).
  n=0;
  const edge=[project({title:'보관한 요청',stage:'archived',payment:{status:'requested',requestedAt:'2026-10-02T00:00:00.000Z',amount:290000},log:[{kind:'requested',at:'2026-10-02T00:00:00.000Z',amount:290000}]}),
    project({title:'납품한 요청',stage:'delivered',payment:{status:'requested',requestedAt:'2026-11-02T00:00:00.000Z',amount:390000},log:[{kind:'requested',at:'2026-11-02T00:00:00.000Z',amount:390000}]}),
    project({title:'환불 뒤 다시',stage:'planning',payment:{status:'requested',requestedAt:'2026-11-08T00:00:00.000Z'},log:[{kind:'confirmed',at:'2026-10-03T00:00:00.000Z',amount:390000},{kind:'cancelled',at:'2026-10-20T00:00:00.000Z',was:'confirmed'},{kind:'requested',at:'2026-11-08T00:00:00.000Z'}]}),
    project({title:'깨진 날',payment:{status:'confirmed',confirmedAt:'2026-11-01T00:00:00.000Z',amount:290000,dueDate:'2026-02-31'}}),
    project({title:'바른 날',payment:{status:'confirmed',confirmedAt:'2026-11-02T00:00:00.000Z',amount:290000,dueDate:'2026-11-20'}})];
  const edgeNov=pulseLedger(edge,{now:NOW});
  assert.deepEqual(edgeNov.summary.receivable,{amount:0,count:1,noAmount:1,oldestDays:6},'다시 요청한 한 건만, 금액 없음');
  assert.deepEqual(edgeNov.rows.map(row=>[row.title,row.amount,row.requestedDays]).sort(),[['깨진 날',290000,null],['납품한 요청',390000,null],['바른 날',290000,null],['환불 뒤 다시',null,6]],'보관한 요청(10월 이력)은 11월 표에 없고, 납품한 요청은 11월 이력으로만 서되 며칠 지남이 없다');
  assert.deepEqual([edgeNov.summary.nextDue?.title,edgeNov.band.items.map(item=>item.title),edgeNov.rows.find(row=>row.title==='깨진 날').dueDate],['바른 날',['바른 날'],'']);
  assert.equal(pulseLedger(edge,{month:'0026-11',now:NOW}).month,'2026-11');assert.equal(pulseLedger(edge,{month:'1999-12',now:NOW}).month,'2026-11');
  assert.deepEqual(ledgerMonths('2000-02',3),['1999-12','2000-01','2000-02']);assert.deepEqual(ledgerMonths('0099-01',2),['0098-12','0099-01'],'0~99년을 1900년대로 읽지 않는다');
});

test('월 CSV: BOM · CRLF · 머리 줄, 수식으로 도는 첫 글자(= + - @ · 전각)를 막는다, 받은 곳은 한국어',()=>{
  n=0;
  const rows=[project({title:'=HYPERLINK("http://x","y")',extra:{},payment:{status:'confirmed',confirmedAt:'2026-11-02T00:00:00.000Z',amount:290000,dueDate:'2026-11-20',channel:'direct',net:250000}}),
    project({title:'＠SUM(1)',payment:{status:'confirmed',confirmedAt:'2026-11-03T00:00:00.000Z',amount:390000,dueDate:'2026-11-21'}})];
  rows[0].customerName='+82 손님';
  const csv=pulseLedgerCsv(pulseLedger(rows,{now:NOW}));
  assert.ok(csv.startsWith('﻿"접수 번호","이름","손님","상품","금액","결제 상태"'));
  assert.ok(csv.includes('\r\n'));assert.doesNotMatch(csv.replace(/\r\n/g,''),/\n/);
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"",""y"")"`),'= 앞에 따옴표');
  assert.ok(csv.includes(`"'＠SUM(1)"`),'전각 @도');assert.ok(csv.includes(`"'+82 손님"`));
  assert.ok(csv.includes('"직접"'));assert.ok(csv.includes('"2026-11 확인 매출","680000"'));
});

test('일정 파생: 프로젝트 기록에 전달일이 없으면 확인한 결제의 받으실 날을 합의한 전달일로 읽고, 계획이 꺼져 있으면 경고를 늘리지 않는다',()=>{
  const paid=project({payment:{status:'confirmed',confirmedAt:'2026-11-02T00:00:00.000Z',dueDate:'2026-11-20'}});
  const input={...paid,dueDate:'',messages:[],sceneRequestWorkflows:{}},before=JSON.stringify(input);
  const schedule=buildClientSchedule(input,{now:NOW});
  assert.deepEqual([schedule.agreedDueDate,schedule.agreedDueSource,schedule.enabled,schedule.pendingCount,schedule.status],['2026-11-20','payment',false,0,'disabled']);
  const written=buildClientSchedule({...paid,dueDate:'2026-12-01',messages:[]},{now:NOW});
  assert.deepEqual([written.agreedDueDate,written.agreedDueSource],['2026-12-01','project'],'적은 날이 먼저');
  const requested=project({payment:{status:'requested',dueDate:'2026-11-20'}});
  assert.deepEqual([buildClientSchedule({...requested,dueDate:'',messages:[]},{now:NOW}).agreedDueDate,buildClientSchedule({...requested,dueDate:'',messages:[]},{now:NOW}).agreedDueSource],['',''],'확인 전 결제는 파생하지 않는다');
  assert.equal(JSON.stringify(input),before,'넘긴 프로젝트 줄(dueDate · schedulePlan · 결제 칸)에 쓰지 않는다');assert.equal(input.dueDate,'');assert.equal('schedulePlan' in input,false);
});
