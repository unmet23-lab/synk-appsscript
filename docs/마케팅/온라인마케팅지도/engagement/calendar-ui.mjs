import { buildCalendar, calendarCsv, PERIOD_METRICS, GRAINS } from './calendar.mjs';
import { shiftDate } from './analytics.mjs';
const $=id=>document.getElementById(id);
const num=v=>v==null?'—':v.toLocaleString('ko-KR',{maximumFractionDigits:1});
const sign=v=>v==null?'—':(v>0?'+':'')+num(v);
const tone=v=>v==null||v===0?'':v>0?'positive':'negative';
const percent=v=>v==null?'—':sign(v)+'%';
const unit=key=>key==='reactions'?'반응 항목':key==='followers'?'채널':'게시물';
const cover=(c,key)=>`${c.count}/${c.eligible} ${unit(key)}${c.count<c.eligible?' · 일부':''}`;
const el=(tag,css,text)=>{const n=document.createElement(tag);if(css)n.className=css;if(text!=null)n.textContent=text;return n;};
const button=(text,fn,css='text-button')=>{const n=el('button',css,text);n.type='button';n.addEventListener('click',fn);return n;};
const cell=(row,text,css='')=>{const n=el('td',css,text);row.append(n);return n;};
const numeric=(row,value,signed=false)=>cell(row,signed?sign(value):num(value),'numeric '+(signed?tone(value):''));
function changeCell(row,c,key) {const n=numeric(row,c.delta,true);n.append(el('small','muted',c.baseline===0?'기준 0 · 비율 없음':percent(c.rate)));if(key)n.append(el('small','muted',cover(c,key)));return n;}
function blank(body,message,span) {const row=el('tr');const c=cell(row,message,'empty-row');c.colSpan=span;body.append(row);}

export function createCalendarUI({getState,openRecord}) {
  let report,grain='week',metric='reactions',selectedId='';
  for(const {key,label} of PERIOD_METRICS){const o=el('option','',label);o.value=key;$('calendarMetric').append(o);}
  const selected=()=>report.rows.find(p=>p.id===selectedId)||report.rows[0];
  const label=()=>PERIOD_METRICS.find(m=>m.key===metric).label;
  function select(id,scroll=false){selectedId=id;$('calendarSelected').value=id;renderViews();if(scroll)$('calendarDetail').scrollIntoView({behavior:'smooth',block:'start'});}
  function renderSummary(){
    const p=selected(),m=p.metrics[metric],n=m.net,v=m.vs,c=p.comparison;
    $('calendarHeading').textContent=`${p.label} · ${label()}`;
    $('calendarDates').textContent=`${p.start} ~ ${p.through} · ${p.open?'진행 중':'완료'} · ${p.elapsed}/${p.fullDays}일 · 새 게시물 ${p.newPosts}건`;
    $('calendarBasis').textContent=p.open
      ? `진행 중인 기간입니다. 직전 대비는 같은 ${c.matchingDays}일끼리 비교합니다: ${c.currentStart} ~ ${c.currentEnd} ↔ ${c.previousStart} ~ ${c.previousEnd}.${c.trimmed?' 직전 기간이 더 짧아 이번 기간도 같은 일수로 잘랐습니다. 순증감은 위 확인 종료일까지의 값입니다.':''}`
      : `완료된 달력 기간끼리 비교합니다: ${c.currentStart} ~ ${c.currentEnd} ↔ ${c.previousStart} ~ ${c.previousEnd}. 직전 대비는 두 기간 모두 확인된 같은 대상·지표만 사용합니다.`;
    $('calendarBasis').classList.toggle('warning',p.open);
    const host=$('calendarKpis');host.replaceChildren();
    const cards=[
      ['기간 순증감',sign(n.delta),tone(n.delta),`성장률 ${n.baseline===0?'기준 0':percent(n.rate)}`,`증가 항목 ${sign(n.increases)} / 감소 항목 ${sign(n.decreases)}`],
      ['직전 기간 대비 차이',sign(v.diff),tone(v.diff),`직전 대비율 ${percent(v.rate)}`,`같은 대상의 이번 ${sign(v.current)} ↔ 직전 ${sign(v.previous)}`],
      ['하루 평균 순증감',sign(m.dailyAverage),tone(m.dailyAverage),`${p.elapsed}일 기준 · ${p.open?'진행 중':'완료'}`,`총 ${sign(n.delta)} ÷ ${p.elapsed}일`],
      ['순증감 확인 범위',`${n.count}/${n.eligible}`,'',unit(metric),`직전과 공통 비교 ${v.count}/${v.eligible} ${unit(metric)}`]
    ];
    for(const [title,value,css,line1,line2] of cards){const card=el('div');card.append(el('span','muted',title),el('strong',css,value),el('span','',line1),el('small','muted',line2));host.append(card);}
  }
  function renderChart(){
    $('calendarTrendHeading').textContent=GRAINS[grain]+' '+label()+' 순증감';
    const host=$('calendarChart');host.replaceChildren();
    const values=report.rows.map(p=>p.metrics[metric].net.delta).filter(v=>v!==null);
    if(!values.length){host.append(el('p','chart-empty','기간 양 끝의 기록이 쌓이면 주·월·분기의 증가와 감소를 비교할 수 있습니다.'));return;}
    const max=Math.max(1,...values.map(Math.abs));
    for(const p of report.rows){
      const n=p.metrics[metric].net;
      const row=button('',()=>select(p.id),'calendar-chart-row'+(p.id===selectedId?' selected':''));
      row.setAttribute('aria-pressed',String(p.id===selectedId));
      row.setAttribute('aria-label',`${p.label}, ${p.start}부터 ${p.through}, 순증감 ${sign(n.delta)}, ${cover(n,metric)}${p.open?', 진행 중':''}`);
      const name=el('span','period-chart-label',p.label);if(p.open)name.append(el('small','period-badge','진행 중'));
      const track=el('span','period-chart-track');
      if(n.delta!==null){const bar=el('span','period-chart-bar '+tone(n.delta)+(p.open?' open':''));const width=Math.abs(n.delta)/max*50;bar.style.width=width+'%';bar.style.left=(n.delta<0?50-width:50)+'%';track.append(bar);}
      row.append(name,track,el('strong',tone(n.delta),sign(n.delta)),el('small','muted',cover(n,metric)));host.append(row);
    }
  }
  function renderMatrix(){
    const mode=$('calendarMatrixMode').value,head=el('tr');head.append(el('th','','기간'));
    for(const {label} of PERIOD_METRICS)head.append(el('th','numeric',label));
    $('calendarMatrixHead').replaceChildren(head);
    $('calendarMatrixCaption').textContent=`${GRAINS[grain]} · ${report.rows.length}개 기간 · 총 반응은 좋아요+댓글+공유+저장 · 비교 범위가 일부면 전체 성장으로 해석하지 않습니다.`;
    const body=$('calendarMatrixRows');body.replaceChildren();
    for(const p of report.rows){
      const row=el('tr',p.id===selectedId?'selected-period':'');
      const title=cell(row,'','period-title');title.append(button(p.label,()=>select(p.id,true),'text-button'),el('small','muted',`${p.start} ~ ${p.through}`));
      if(p.open)title.append(el('span','period-badge',`진행 중 ${p.elapsed}/${p.fullDays}일`));
      for(const {key} of PERIOD_METRICS){
        const m=p.metrics[key];
        if(mode==='net'){const c=changeCell(row,m.net,key);c.classList.add(m.net.delta==null?'unknown-cell':m.net.delta>0?'up-cell':m.net.delta<0?'down-cell':'flat-cell');}
        else if(mode==='vs'){
          const c=numeric(row,m.vs.diff,true);c.append(el('small','muted',percent(m.vs.rate)),el('small','muted',cover(m.vs,key)));
          c.classList.add(m.vs.diff==null?'unknown-cell':m.vs.diff>0?'up-cell':m.vs.diff<0?'down-cell':'flat-cell');
        }else numeric(row,m.total).append(el('small','muted',cover(m,key)));
      }
      body.append(row);
    }
  }
  function renderDetails(){
    const p=selected(),c=p.comparison;
    $('calendarDetailHeading').textContent=p.label+' 계산 내역';
    $('calendarDetailCaption').textContent=`시작 기준일 ${shiftDate(p.start,-1)} → 종료일 ${p.through} · 비교 대상 종료값 = 시작 기준값 + 순증감 · 새 게시물은 게시 전 0`;
    const body=$('calendarDetailRows');body.replaceChildren();
    const compared=$('calendarComparisonRows');compared.replaceChildren();
    $('calendarComparisonCaption').textContent=`이번 ${c.currentStart} ~ ${c.currentEnd} / 직전 ${c.previousStart} ~ ${c.previousEnd} · 두 기간에 공통으로 계산 가능한 대상만 포함 · 직전 순증감이 0·음수일 때 비율 없음`;
    for(const {key,label} of PERIOD_METRICS){
      const m=p.metrics[key],n=m.net,v=m.vs,row=el('tr',key===metric?'focused-metric':'');
      cell(row,label);numeric(row,n.baseline);numeric(row,n.count?n.baseline+n.delta:null);changeCell(row,n);
      numeric(row,m.dailyAverage,true);numeric(row,n.increases,true);numeric(row,n.decreases,true);
      numeric(row,key==='followers'?null:n.count?(n.newValue??0):null,true);
      numeric(row,n.count?n.delta-(n.newValue??0):null,true);cell(row,cover(n,key));body.append(row);
      const r=el('tr',key===metric?'focused-metric':'');cell(r,label);numeric(r,v.current,true);numeric(r,v.previous,true);numeric(r,v.diff,true);cell(r,percent(v.rate),'numeric');
      cell(r,cover(v,key));numeric(r,m.previousFull.delta,true).append(el('small','muted',cover(m.previousFull,key)));compared.append(r);
    }
  }
  function renderDrivers(){
    const p=selected(),dimension=$('calendarGrouping').value,body=$('calendarDriverRows');body.replaceChildren();
    $('calendarDriversCaption').textContent=`${p.label} · ${label()} · 순증감 크기 순 · 신규 기여 + 기존 기여 = 기간 순증감`;
    if(dimension==='post'&&metric==='followers'){blank(body,'팔로워·구독자는 채널 지표입니다. 채널별 보기를 선택해 주세요.',8);return;}
    const rows=report.detail(p.id,dimension).filter(r=>r.postCount||r.metrics[metric].latest!=null)
      .sort((a,b)=>(Math.abs(b.metrics[metric].net.delta??0)-Math.abs(a.metrics[metric].net.delta??0))||a.label.localeCompare(b.label,'ko'));
    if(!rows.length){blank(body,'선택한 범위에 등록 게시물이나 확인된 수치가 없습니다.',8);return;}
    for(const item of rows){const m=item.metrics[metric],n=m.net,v=m.vs,row=el('tr');
      const name=cell(row,'','post-title');
      name.append(item.postId?button(item.label,()=>openRecord(item.postId,p.through),'text-button post-link'):el('strong','',item.label));
      if(item.sublabel)name.append(el('small','muted',item.sublabel));
      changeCell(row,n);numeric(row,n.increases,true);numeric(row,n.decreases,true);
      numeric(row,metric==='followers'?null:n.count?(n.newValue??0):null,true);numeric(row,n.count?n.delta-(n.newValue??0):null,true);
      numeric(row,v.diff,true).append(el('small','muted',percent(v.rate)));
      cell(row,'기간 '+cover(n,metric)).append(el('small','muted','공통 '+cover(v,metric)));body.append(row);
    }
  }
  function renderViews(){if(!report)return;renderSummary();renderChart();renderMatrix();renderDetails();renderDrivers();}
  function render(){
    const s=getState();if(!s.records||!s.catalog||$('calendarPanel').hidden)return;
    try{
      report=buildCalendar(s.records,s.catalog,{end:s.date,grain,count:Number($('calendarCount').value),brand:s.brand,channel:s.channel,platform:s.platform,country:s.country});
      if(!report.rows.some(p=>p.id===selectedId))selectedId=report.rows[0].id;
      $('calendarSelected').replaceChildren(...report.rows.map(p=>{const o=el('option','',`${p.label}${p.open?' · 진행 중':''}`);o.value=p.id;return o;}));
      $('calendarSelected').value=selectedId;
      $('calendarScope').textContent=`선택 채널 ${report.channels.length}곳 · 등록 게시물 ${report.posts.length}건 · ${GRAINS[grain]} ${report.rows.at(-1).start} ~ ${report.end} · 위 필터 적용`;
      $('calendarError').hidden=true;$('calendarBody').hidden=false;$('calendarExport').disabled=false;renderViews();
    }catch(error){report=null;$('calendarError').textContent=error.message;$('calendarError').hidden=false;$('calendarBody').hidden=true;$('calendarExport').disabled=true;}
  }
  for(const control of document.querySelectorAll('[data-grain]'))control.addEventListener('click',()=>{
    grain=control.dataset.grain;selectedId='';
    for(const other of document.querySelectorAll('[data-grain]'))other.setAttribute('aria-pressed',String(other===control));
    render();
  });
  $('calendarCount').addEventListener('change',render);
  $('calendarMetric').addEventListener('change',()=>{metric=$('calendarMetric').value;renderViews();});
  $('calendarSelected').addEventListener('change',()=>select($('calendarSelected').value));
  $('calendarMatrixMode').addEventListener('change',()=>{if(report)renderMatrix();});
  $('calendarGrouping').addEventListener('change',()=>{if(report)renderDrivers();});
  $('calendarExport').addEventListener('click',()=>{
    if(!report)return;const url=URL.createObjectURL(new Blob([calendarCsv(report,selectedId,$('calendarGrouping').value)],{type:'text/csv;charset=utf-8'}));
    const link=el('a');link.href=url;link.download=`synk-sns-${grain}-${report.end}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {render};
}
