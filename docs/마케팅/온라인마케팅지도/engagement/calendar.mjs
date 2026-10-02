import { METRICS, REACTION_KEYS, shiftDate, dateRange, metricPoint, compareMetric, metricIndex } from './analytics.mjs';

export const PERIOD_METRICS = [{ key: 'reactions', label: '총 반응' }, ...METRICS];
export const GRAINS = { week: '주별', month: '월별', quarter: '분기별' };
const valid = value => typeof value === 'number' && Number.isFinite(value);
const addKnown = values => { const numbers = values.filter(valid); return numbers.length ? numbers.reduce((a,b) => a+b,0) : null; };
const days = (a,b) => Math.round((Date.parse(b)-Date.parse(a))/86400000)+1;
const iso = date => date.toISOString().slice(0,10);
export function calendarBounds(date, grain) {
  dateRange(date,date);
  const d = new Date(date + 'T00:00:00Z');
  if (grain === 'week') {
    const start = shiftDate(date,-((d.getUTCDay()+6)%7));
    return { start, end: shiftDate(start,6), label: start.replaceAll('-','.') + ' 시작 주', short: start.slice(5).replace('-','/') };
  }
  if (!['month','quarter'].includes(grain)) throw new Error('주·월·분기 중에서 선택해 주세요.');
  const month = grain === 'month' ? d.getUTCMonth() : Math.floor(d.getUTCMonth()/3)*3;
  const start = iso(new Date(Date.UTC(d.getUTCFullYear(),month,1)));
  const end = iso(new Date(Date.UTC(d.getUTCFullYear(),month+(grain === 'month' ? 1 : 3),0)));
  const label = grain === 'month' ? `${d.getUTCFullYear()}년 ${month+1}월` : `${d.getUTCFullYear()}년 ${Math.floor(month/3)+1}분기`;
  return { start,end,label,short:grain === 'month' ? start.slice(2,7).replace('-','.') : `${String(d.getUTCFullYear()).slice(2)} Q${Math.floor(month/3)+1}` };
}
export function calendarPeriods(end, grain, count = 8) {
  if (!Number.isInteger(count) || count < 1 || count > 24) throw new Error('표시할 기간 수는 1~24개입니다.');
  let bound = calendarBounds(end,grain);
  const rows = [];
  for (let i=0;i<count;i++) {
    const through = bound.end > end ? end : bound.end;
    const previous = calendarBounds(shiftDate(bound.start,-1),grain);
    const elapsed = days(bound.start,through), fullDays = days(bound.start,bound.end);
    const open = through < bound.end;
    const matchingDays = Math.min(elapsed,days(previous.start,previous.end));
    rows.push({ ...bound, id:bound.start, through, elapsed, fullDays, open, previous,
      comparison: { currentStart:bound.start, currentEnd:open ? shiftDate(bound.start,matchingDays-1) : through,
        previousStart:previous.start, previousEnd:open ? shiftDate(previous.start,matchingDays-1) : previous.end,
        matchingDays:open ? matchingDays : null, trimmed:open && matchingDays < elapsed } });
    bound = previous;
  }
  return rows;
}
function mergedComparison(parts) {
  const number = key => parts.reduce((n,p) => n+p[key],0);
  const value = key => addKnown(parts.map(p=>p[key]));
  const delta=value('delta'),baseline=value('baseline'),count=number('count'),eligible=number('eligible');
  return {delta,baseline,rate:baseline>0 && delta!==null ? delta/baseline*100:null,count,eligible,
    complete:eligible>0 && count===eligible,newCount:number('newCount'),newValue:value('newValue'),
    increases:value('increases'),decreases:value('decreases')};
}
function commonComparison(src,key,p) {
  const c = p.comparison;
  let current=0,previous=0,count=0;
  const entities = src.entities.filter(e=>!src.isPost || e.publishedDate<=p.through);
  const change=(entity,start,end)=>{
    if (src.isPost && entity.publishedDate>end) return 0;
    const rows=src.index.get(entity.id);
    const base=src.isPost && entity.publishedDate>=start ? 0 : rows?.get(shiftDate(start,-1))?.[key];
    const last=rows?.get(end)?.[key];
    return valid(base) && valid(last) ? last-base : null;
  };
  for (const entity of entities) {
    // If a longer current month was trimmed, posts published after that cut are outside this comparison.
    if (src.isPost && entity.publishedDate>c.currentEnd) continue;
    const now=change(entity,c.currentStart,c.currentEnd),before=change(entity,c.previousStart,c.previousEnd);
    if (now===null || before===null) continue;
    current+=now; previous+=before; count++;
  }
  const eligible=entities.filter(e=>!src.isPost || e.publishedDate<=c.currentEnd).length;
  return { current:count ? current:null, previous:count ? previous:null, diff:count ? current-previous:null,
    rate:count && previous>0 ? (current-previous)/previous*100:null, count,eligible };
}
function mergedCommon(parts) {
  const count=parts.reduce((n,p)=>n+p.count,0),eligible=parts.reduce((n,p)=>n+p.eligible,0);
  const current=addKnown(parts.map(p=>p.current)),previous=addKnown(parts.map(p=>p.previous));
  return {current,previous,diff:count ? current-previous:null,rate:previous>0 && current!==null ? (current-previous)/previous*100:null,count,eligible};
}
export function buildCalendar(records,catalog,options) {
  const { end,grain='week',count=8,brand='',channel='',platform='',country='' } = options;
  const channels=catalog.channels.filter(c=>c.ready && (!brand || c.brand===brand) && (!channel || c.id===channel) && (!platform || c.platform===platform) && (!country || c.country===country));
  const ids=new Set(channels.map(c=>c.id));
  const posts=records.posts.filter(p=>ids.has(p.channelId) && p.publishedDate<=end);
  const postIndex=metricIndex(records.snapshots,'postId'),accountIndex=metricIndex(records.channelSnapshots,'channelId');
  const source=(key,ps,cs)=>key==='followers' ? {entities:cs,index:accountIndex,isPost:false} : {entities:ps,index:postIndex,isPost:true};
  const measure=(p,ps=posts,cs=channels)=>{
    const metrics={};
    for (const {key} of METRICS) {
      const src=source(key,ps,cs), net=compareMetric(src,key,shiftDate(p.start,-1),p.through);
      metrics[key]={...metricPoint(src,key,p.through),net,vs:commonComparison(src,key,p),
        previousFull:compareMetric(src,key,shiftDate(p.previous.start,-1),p.previous.end),
        dailyAverage:net.delta===null ? null:net.delta/p.elapsed};
    }
    const parts=REACTION_KEYS.map(k=>metrics[k]), net=mergedComparison(parts.map(m=>m.net));
    metrics.reactions={total:addKnown(parts.map(m=>m.total)),latest:addKnown(parts.map(m=>m.latest)),
      count:parts.reduce((n,m)=>n+m.count,0),eligible:parts.reduce((n,m)=>n+m.eligible,0),
      net,vs:mergedCommon(parts.map(m=>m.vs)),previousFull:mergedComparison(parts.map(m=>m.previousFull)),
      dailyAverage:net.delta===null ? null:net.delta/p.elapsed};
    return metrics;
  };
  const rows=calendarPeriods(end,grain,count).map(p=>({...p,metrics:measure(p),newPosts:posts.filter(post=>post.publishedDate>=p.start && post.publishedDate<=p.through).length}));
  function detail(id,dimension='channel') {
    const p=rows.find(row=>row.id===id);
    if (!p) throw new Error('기간을 선택해 주세요.');
    if (!['channel','brand','platform','country','post'].includes(dimension)) throw new Error('비교 단위를 확인해 주세요.');
    const eligiblePosts=posts.filter(post=>post.publishedDate<=p.through);
    if (dimension==='post') return eligiblePosts.map(post=>({id:post.id,label:post.title,postId:post.id,url:post.url,
      sublabel:channels.find(c=>c.id===post.channelId)?.handle || post.channelId,postCount:1,metrics:measure(p,[post],[])}));
    const groups=new Map();
    for (const c of channels) { const id=dimension==='channel' ? c.id : c[dimension] || '미지정'; if (!groups.has(id)) groups.set(id,[]); groups.get(id).push(c); }
    return [...groups].map(([id,cs])=>{
      const ids=new Set(cs.map(c=>c.id)), ps=eligiblePosts.filter(post=>ids.has(post.channelId));
      return {id,label:dimension==='channel' ? [cs[0].brand,cs[0].country,cs[0].platform,cs[0].handle].filter(Boolean).join(' · ') : id,
        postCount:ps.length,metrics:measure(p,ps,cs)};
    });
  }
  return {end,grain,count,scope:{brand,channel,platform,country},channels,posts,rows,detail};
}
export function calendarCsv(report,selectedId,dimension='channel') {
  const rows=[['집계','달력 기준 '+GRAINS[report.grain],'기준 날짜',report.end],
    ['범위',...Object.entries(report.scope).flatMap(([k,v])=>[k,v||'전체'])],
    ['기준','주=월요일~일요일, 월=달력 월, 분기=1~3/4~6/7~9/10~12월. 미기록은 빈칸. 누적값을 여러 날 합하지 않음.'],
    ['총 반응','좋아요+댓글+공유+저장. 확인 범위는 게시물×반응 4항목.'],
    ['직전 대비','두 기간 모두 계산 가능한 동일 대상/지표끼리 비교. 진행 중은 직전 기간의 같은 경과 일수와 비교하며 짧은 쪽에 맞춤. 완료 기간은 달력 전체끼리 비교.'],
    ['항목 증가·감소 합','각 대상의 기간 양 끝 누적 차이를 양수/음수로 나눈 합. 실제 기간 내 발생·취소 이벤트 총량이 아님.'],
    ['비율','성장률=순증감/같은 대상 시작 기준값. 직전 대비율=순증감 차이/직전 동일 대상 순증감(양수일 때).'],[],
    ['구분','대상','기간','시작','확인 종료','달력 종료','진행 상태','지표','종료일 기록 합','종료일 기록 수','전체 대상','시작 기준값','비교 대상 종료값','순증감','성장률(%)','일평균 순증감','증가 항목 합','감소 항목 합','신규 기여','기존 기여','비교 수','직전 전체 순증감','동일대상 현재','동일대상 직전','직전 대비 차이','직전 대비율(%)','공통 비교 수','공통 전체 대상','현재 비교 시작','현재 비교 종료','직전 비교 시작','직전 비교 종료']];
  const append=(type,label,p,metrics)=>{for (const {key,label:metricLabel} of PERIOD_METRICS) {
    const m=metrics[key],n=m.net,v=m.vs,c=p.comparison;
    rows.push([type,label,p.label,p.start,p.through,p.end,p.open?'진행 중':'완료',metricLabel,m.total,m.count,m.eligible,n.baseline,
      n.count?n.baseline+n.delta:null,n.delta,n.rate,m.dailyAverage,n.increases,n.decreases,n.newValue,
      n.count?n.delta-(n.newValue??0):null,n.count,m.previousFull.delta,v.current,v.previous,v.diff,v.rate,v.count,v.eligible,c.currentStart,c.currentEnd,c.previousStart,c.previousEnd]);
  }};
  for (const p of report.rows) append('기간','선택 범위',p,p.metrics);
  const selected=report.rows.find(p=>p.id===selectedId);
  if (selected) for (const item of report.detail(selectedId,dimension)) append(dimension,item.label,selected,item.metrics);
  const escape=value=>{let s=value==null?'':String(value);if(typeof value==='string' && /^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\uFEFF'+rows.map(row=>row.map(escape).join(',')).join('\r\n');
}
