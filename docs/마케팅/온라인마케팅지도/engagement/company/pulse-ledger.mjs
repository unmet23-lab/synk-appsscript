import {paymentLogOf} from './pulse-requests.mjs';
import {customerRoomFacts,ROOM_PACKAGES} from './pulse-room-facts.mjs';
import {kstDate} from './pulse-capacity.mjs';
import {csvCell} from './client-completion-records-render.mjs';

// 운영판 장부(운영 조각 8-A · 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S4).
// 순수 함수: 직원이 읽을 수 있는 프로젝트 줄(readableSources)과 고른 달 · 지금 시각으로 월별 확인 매출 · 실수령 · 환불, 받을 돈, 건별 줄, 4주 일정 띠를 센다.
// - 돈은 결제 이력(paymentLog — 덮지 않고 쌓는 줄)으로 센다: 취소한 뒤 다시 요청해도 앞 확인 · 환불이 남는다. 달은 한국 날짜로 가른다.
// - 확인 금액이 없는 옛 건은 합계에 넣지 않고 「금액 없음 n건」으로 따로 센다. 실수령은 담당자가 적은 줄만 더한다.
// - 차례 · 다음 행동은 고객 방과 같은 규칙(customerRoomFacts)으로 — 직원 화면이 따로 계산하지 않는다.
const MONTH=/^20\d{2}-(0[1-9]|1[0-2])$/; // 2000~2099년 — 0026-11 같은 오타를 받지 않는다(끝판 검수 A2)
const DAY=86400000;
const won=value=>Number.isSafeInteger(value)&&value>0?value:null;
export const kstMonth=at=>kstDate(at).slice(0,7);
// 고른 달까지 count개 달(오래된 것부터).
export function ledgerMonths(month,count=6){
  const [y,m]=month.split('-').map(Number),out=[];
  for(let i=count-1;i>=0;i--){const d=new Date(0);d.setUTCFullYear(y,m-1-i,1);out.push(d.toISOString().slice(0,7));}
  return out;
}
const realDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
const daysBetween=(from,to)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/DAY);
const shiftDay=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const requestOf=row=>row?.studio?.request&&typeof row.studio.request==='object'?row.studio.request:null;
const closed=row=>['delivered','archived'].includes(row?.stage);
const packageLabel=pkg=>pkg==='ask'?'상담':Object.hasOwn(ROOM_PACKAGES,pkg||'')?ROOM_PACKAGES[pkg].label:'';
// 지금 결제 칸의 상태: 확인했던 결제를 취소하면 환불(refunded), 요청만 취소하면 cancelled.
export function payStatus(payment){
  const status=payment?.status;
  if(status==='cancelled')return payment.confirmedAt?'refunded':'cancelled';
  return ['requested','confirmed'].includes(status)?status:'none';
}
export const PAY_LABELS=Object.freeze({none:'결제 전',requested:'결제 요청함',confirmed:'결제 확인',cancelled:'요청 취소',refunded:'환불'});
export const TURN_LABELS=Object.freeze({you:'손님 차례',us:'저희 차례',done:'끝'});
// 이력 한 줄의 금액: 확인 줄은 그 줄 금액, 환불 줄은 그 줄 금액이 없으면 바로 앞 확인 금액.
function money(log){
  const out=[];let lastConfirmed=null;
  for(const entry of log){
    if(!entry||typeof entry!=='object'||typeof entry.at!=='string')continue;
    if(entry.kind==='confirmed'){lastConfirmed=won(entry.amount);out.push({kind:'confirmed',at:entry.at,amount:lastConfirmed,net:Number.isSafeInteger(entry.net)&&entry.net>=0?entry.net:null});}
    else if(entry.kind==='cancelled'&&entry.was==='confirmed')out.push({kind:'refunded',at:entry.at,amount:won(entry.amount)??lastConfirmed});
    else if(entry.kind==='requested')out.push({kind:'requested',at:entry.at,amount:won(entry.amount)});
  }
  return out;
}

export function pulseLedger(rows,{month='',now=new Date().toISOString()}={}){
  const today=kstDate(now);if(!today)throw Object.assign(new Error('서버 시계를 읽지 못했어요.'),{status:500});
  const current=today.slice(0,7),pick=MONTH.test(month)?month:current,months=ledgerMonths(pick);
  const byMonth=new Map(months.map(m=>[m,{month:m,revenue:0,net:0,netCount:0,refunds:0,confirmed:0,noAmount:0,refundCount:0}]));
  const receivable={amount:0,count:0,noAmount:0,oldestDays:null},table=[],band=[];let nextDue=null;
  for(const row of Array.isArray(rows)?rows:[]){
    const request=requestOf(row);if(!request)continue;
    const payment=request.payment&&typeof request.payment==='object'?request.payment:null,status=payStatus(payment);
    // 표에 넣을지는 돈이 움직인 줄만이 아니라 그 달의 결제 이력 전부(요청만 취소 · 받으실 날 고침 포함)로 본다 — 서버 검수 GA1.
    const raw=paymentLogOf(request),lines=money(raw);
    const monthAts=raw.filter(entry=>typeof entry?.at==='string'&&kstMonth(entry.at)===pick).map(entry=>entry.at),touched=monthAts.length>0;
    for(const line of lines){
      const m=kstMonth(line.at),bucket=byMonth.get(m);if(!bucket)continue;
      if(line.kind==='confirmed'){if(line.amount===null)bucket.noAmount++;else{bucket.revenue+=line.amount;bucket.confirmed++;}if(line.net!==null){bucket.net+=line.net;bucket.netCount++;}}
      if(line.kind==='refunded'&&line.amount!==null){bucket.refunds+=line.amount;bucket.refundCount++;}
    }
    const facts=customerRoomFacts(row),requestedDay=kstDate(payment?.requestedAt||''),confirmedDay=kstDate(payment?.confirmedAt||'');
    const dueDate=status==='confirmed'&&realDay(payment.dueDate)?payment.dueDate:'',open=!closed(row);
    const lastConfirmed=[...lines].reverse().find(line=>line.kind==='confirmed'),amount=won(payment?.amount)??(['confirmed','refunded'].includes(status)?lastConfirmed?.amount??null:null);
    // 받을 돈: 요청하고 아직 확인 안 한 결제(며칠째인지).
    if(status==='requested'&&open){
      receivable.count++;if(won(payment.amount))receivable.amount+=payment.amount;else receivable.noAmount++;
      const days=requestedDay?Math.max(0,daysBetween(requestedDay,today)):null;
      if(days!==null&&(receivable.oldestDays===null||days>receivable.oldestDays))receivable.oldestDays=days;
    }
    // 가장 가까운 받으실 날: 결제 확인 · 납품 전 건(지난 날도 — 늦은 건이 먼저 보이게).
    if(dueDate&&!closed(row)&&(!nextDue||dueDate<nextDue.date))nextDue={date:dueDate,id:row.id,title:row.title||'',late:dueDate<today};
    // 4주 띠: 결제 확인 ~ 받으실 날, 납품 전 건만.
    if(dueDate&&confirmedDay&&!closed(row))band.push({id:row.id,title:row.title||'',start:confirmedDay,end:dueDate,turn:facts?.turn||'',late:dueDate<today});
    // 고른 달의 표: 그 달에 결제 이력이 있는 건, 이번 달이면 받을 돈인 건도.
    if(touched||pick===current&&status==='requested'&&open){
      const latest=monthAts.sort().at(-1)||payment?.requestedAt||'';
      table.push({id:row.id,title:row.title||'',customer:row.customerName||'',number:facts?.number||'',package:packageLabel(request.answers?.package),amount,status,statusLabel:PAY_LABELS[status],
        requestedDay,requestedDays:status==='requested'&&open&&requestedDay?Math.max(0,daysBetween(requestedDay,today)):null,confirmedDay,dueDate,stage:facts?.stage||'',turn:facts?.turn||'',turnLabel:TURN_LABELS[facts?.turn]||'',next:facts?.title||'',closed:closed(row),
        channel:status==='confirmed'&&['kmong','direct'].includes(payment.channel)?payment.channel:'',net:status==='confirmed'&&Number.isSafeInteger(payment.net)?payment.net:null,_at:latest});
    }
  }
  table.sort((a,b)=>b._at.localeCompare(a._at)||a.id.localeCompare(b.id));
  band.sort((a,b)=>a.end.localeCompare(b.end)||a.id.localeCompare(b.id));
  const series=months.map(m=>byMonth.get(m)),selected=byMonth.get(pick);
  return {month:pick,current,today,months:series,summary:{...selected,receivable,nextDue},rows:table.map(({_at,...rest})=>rest),
    band:{from:shiftDay(today,-7),to:shiftDay(today,20),items:band}};
}

// 월 CSV: 수식으로 도는 첫 글자(= + - @ · 전각)를 막고(csvCell), UTF-8 BOM · CRLF.
const CSV_COLUMNS=[['number','접수 번호'],['title','이름'],['customer','손님'],['package','상품'],['amount','금액'],['statusLabel','결제 상태'],['requestedDay','요청일'],['confirmedDay','확인일'],['dueDate','받으실 날'],['stage','단계'],['turnLabel','차례'],['next','다음 행동'],['channel','받은 곳'],['net','실수령']];
const CHANNEL_LABELS={kmong:'크몽',direct:'직접'};
export function pulseLedgerCsv(ledger){
  const lines=[CSV_COLUMNS.map(([,label])=>csvCell(label)).join(',')];
  for(const row of ledger.rows)lines.push(CSV_COLUMNS.map(([key])=>csvCell(key==='channel'?CHANNEL_LABELS[row.channel]||'':row[key]??'')).join(','));
  const s=ledger.summary;
  lines.push('',[csvCell(`${ledger.month} 확인 매출`),csvCell(s.revenue)].join(','),[csvCell('실수령(적은 건만)'),csvCell(s.net)].join(','),[csvCell('환불'),csvCell(s.refunds)].join(','),[csvCell('금액 없음'),csvCell(s.noAmount)].join(','));
  return '﻿'+lines.join('\r\n')+'\r\n';
}
