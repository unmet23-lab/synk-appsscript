'use strict';
// 공유한 게시물(2026-11-16): 텔레그램으로 공유한 게시물의 판단(시안 · 기록 · 기각)과 진행을 보고, 나온 시안을 「적용해」 · 「버림」으로 고른다.
// 관리자만 쓴다. 자료는 /api/tip-shares 한 벌이고, 고른 것은 PC가 장부의 상태 칸에 옮긴다(누른 뒤 90초쯤은 되돌릴 수 있다).
const tipShares={userId:null,data:null,loading:false,queued:false,error:'',busy:new Set(),loadedAt:0,request:0,filter:'all',open:new Set(),openCards:new Set(),focus:'',painted:'',triedAt:0,readFailed:false};
// 화면이 보이는 동안 이만큼 지나면 조용히 다시 읽는다. 서랍의 수도 이보다 오래됐으면 다시 읽는다.
const TIP_REFRESH_MS=60000;
// 어긋남 글은 이만큼 지나면 내린다.
const TIP_CONFLICT_SHOW_MS=3*24*3600000;
// 「판단 중」(아직 판단 전인 줄)은 그런 줄이 있을 때만 보인다. 그래야 판단별 수를 더하면 전체와 맞는다.
const TIP_FILTERS=[['all','전체'],['시안','시안'],['기록','기록'],['기각','기각'],['판단 중','판단 중']];
const TIP_STAGE_LABEL={'판단 전':'판단 중','시안 차례':'시안 만들 예정','시안 만드는 중':'시안 만드는 중','시안 나옴':'고르실 차례','적용 중':'적용 중','적용함':'적용함','보류':'보류','버림':'버림'};
const TIP_STALE_MS=30*60000;

function tipSharesIdentity(){
  const id=state.user?.id||null;
  if(tipShares.userId===id)return;
  Object.assign(tipShares,{userId:id,data:null,loading:false,queued:false,error:'',loadedAt:0,filter:'all',focus:'',painted:'',triedAt:0,readFailed:false});
  tipShares.busy=new Set();tipShares.open=new Set();tipShares.openCards=new Set();tipShares.request++;
}
function tipSharesAllowed(){return Boolean(state.user)&&isAdmin()&&!(typeof isDemoMode==='function'&&isDemoMode());}
function tipSafeUrl(value){try{const url=new URL(String(value||''));return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
function tipLink(href,label,className=''){
  const url=tipSafeUrl(href);
  if(!url)return '';
  return `<a class="ts-link ${className}" href="${escape(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escape(label)}${icon('external')}</a>`;
}
// 장부 공유일(「2026-11-16 10:12」, 이미 한국 시각)과 서버 시각(ISO, UTC)을 모두 한국 날짜로.
function tipDate(value){
  const text=String(value||'');
  if(/T\d\d:\d\d/.test(text)){
    const ms=Date.parse(text);if(!Number.isFinite(ms))return '';
    const parts=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).formatToParts(new Date(ms));
    return `${parts.find(p=>p.type==='month')?.value}월 ${parts.find(p=>p.type==='day')?.value}일`;
  }
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return m?`${Number(m[2])}월 ${Number(m[3])}일`:'';
}
function tipTime(iso){
  const ms=Date.parse(iso||'');if(!Number.isFinite(ms))return '';
  const parts=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).formatToParts(new Date(ms));
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  return `${get('month')}월 ${get('day')}일 ${get('dayPeriod')} ${get('hour')}:${get('minute')}`.replace(/\s+/g,' ').trim();
}
function tipAgo(iso){
  const ms=Date.now()-Date.parse(iso||'');if(!Number.isFinite(ms))return '';
  const minutes=Math.max(0,Math.round(ms/60000));
  if(minutes<60)return `${minutes}분 전`;
  const hours=Math.round(minutes/60);
  return hours<48?`${hours}시간 전`:`${Math.round(hours/24)}일 전`;
}
function tipStale(data){return Boolean(data?.receivedAt)&&Date.now()-Date.parse(data.receivedAt)>TIP_STALE_MS;}
function tipRowKey(row){return `${row.row}`;}
function tipVerdictOf(row){return row.verdict||'판단 중';}
// 고른 뒤의 글: 「적용하기로 정했어요」 · 「버리기로 정했어요」.
function tipChoiceLabel(to){return to==='적용 중'?'적용하기로':'버리기로';}
function tipCountMark(count,label){return `<span aria-hidden="true">${count}</span><span class="ts-sr">${escape(label)} ${count}개</span>`;}

async function tipSharesLoad({quiet=false}={}){
  tipSharesIdentity();
  if(!tipSharesAllowed())return;
  const request=++tipShares.request,user=tipShares.userId;
  tipShares.loading=true;tipShares.triedAt=Date.now();if(!quiet)tipShares.error='';
  tipSharesPaint();
  try{
    const data=await api('/api/tip-shares');
    if(request!==tipShares.request||user!==tipShares.userId)return;
    tipShares.data=data;tipShares.error='';tipShares.loadedAt=Date.now();tipShares.readFailed=false;
  }catch(error){
    if(request!==tipShares.request||user!==tipShares.userId)return;
    // 조용한 읽기(서랍의 수, 주기 읽기)의 실패는 오류로 굳히지 않는다. 받은 것이 없는 채로 이 화면을 보고 있을 때만 오류를 보인다.
    if(!quiet||!tipShares.data&&state.tab==='tips')tipShares.error=error.message||'공유한 게시물을 불러오지 못했어요.';
    else tipShares.readFailed=true;
  }finally{
    if(request===tipShares.request){tipShares.loading=false;tipSharesPaint();}
  }
}

async function tipSharesMutate(path,body,row,nextFocus){
  const key=tipRowKey(row);
  if(tipShares.busy.has(key))return;
  tipShares.busy.add(key);tipSharesPaint();
  const user=tipShares.userId;
  try{
    const data=await api(path,body);
    if(user!==tipShares.userId)return;
    // 진행 중이던 읽기는 이 응답으로 버린다. 그 읽기가 loading을 내리지 못하니 여기서 내린다.
    tipShares.request++;tipShares.loading=false;tipShares.data=data;tipShares.loadedAt=Date.now();tipShares.readFailed=false;tipShares.error='';tipShares.focus=nextFocus;
  }catch(error){
    if(user!==tipShares.userId)return;
    notify(error.message||'처리하지 못했어요. 잠시 뒤 다시 해 주세요.');
    if(error.status===409||error.status===404){tipShares.busy.delete(key);await tipSharesLoad({quiet:true});return;}
  }finally{
    tipShares.busy.delete(key);tipSharesPaint();
  }
}

function tipSharesBadge(){
  tipSharesIdentity();
  if(!tipSharesAllowed())return '';
  // 받은 것도 시도한 것도 2분보다 오래됐으면 다시 읽는다(처음에는 둘 다 0이라 바로 읽는다). 실패한 뒤에도 2분 뒤 다시 읽는다.
  const old=Date.now()-Math.max(tipShares.loadedAt,tipShares.triedAt)>2*TIP_REFRESH_MS;
  if(old&&!tipShares.loading&&!tipShares.queued){tipShares.queued=true;queueMicrotask(()=>{tipShares.queued=false;void tipSharesLoad({quiet:true});});}
  const count=tipShares.data?.waiting||0;
  return `<span class="ts-drawer-badge" data-tip-badge>${tipBadgeInner(count)}</span>`;
}
function tipBadgeInner(count){
  return count?`<b class="nav-badge">${tipCountMark(count,'고르실 시안')}</b>`:icon('right');
}

function tipCard(row,data){
  const busy=tipShares.busy.has(tipRowKey(row)),pending=row.pending;
  const draft=row.draft?.url?tipLink(row.draft.url,'시안 보기','ts-draft-link'):row.draft?.text?`<span class="ts-draft-place"><span class="ts-draft-nolink">열어 볼 링크가 없는 시안이에요. 아래 적힌 곳에서 확인해 주세요.</span><span>시안이 있는 곳</span> ${escape(row.draft.text)}</span>`:'';
  const cardKey=`card:${row.row}`,cardOpen=tipShares.openCards.has(cardKey);
  const target=row.target?`<span class="ts-target">${escape(row.target)}</span>`:'';
  let actions;
  if(pending){
    const moving=pending.claimed?'장부에 옮기는 중이에요.':'곧 장부에 옮겨요.';
    actions=`<div class="ts-decided" role="status"><span class="ts-decided-copy">${icon('check')}<span><b>${escape(tipChoiceLabel(pending.to))}</b> 정했어요. ${moving}</span></span>${pending.claimed?'':`<button type="button" class="btn small quiet" data-tip-action="undo" data-tip-row="${row.row}" data-tip-key="undo:${row.row}" ${busy?'disabled':''}>되돌리기</button>`}</div>`;
  }else if(!data.canDecide){
    actions='<p class="ts-locked">이 계정은 장부를 올리는 자동화 계정이라 고를 수 없어요.</p>';
  }else{
    actions=`<div class="ts-card-actions"><button type="button" class="btn primary" data-tip-action="decide" data-tip-to="적용 중" data-tip-row="${row.row}" data-tip-key="apply:${row.row}" ${busy?'disabled':''}>적용해</button><button type="button" class="btn" data-tip-action="decide" data-tip-to="버림" data-tip-row="${row.row}" data-tip-key="drop:${row.row}" ${busy?'disabled':''}>버림</button></div>`;
  }
  return `<article class="ts-card${pending?' is-decided':''}${cardOpen?' is-open':''}" aria-labelledby="ts-card-${row.row}">
    <div class="ts-card-meta">${row.sharedAt?`<time>${escape(tipDate(row.sharedAt))}</time>`:''}${target}</div>
    <h3 class="ts-card-title" id="ts-card-${row.row}">${escape(row.summary||'요약이 없어요.')}</h3>
    ${row.note?`<p class="ts-card-note"><span>가져올 것</span> ${escape(row.note)}</p>`:''}
    <button type="button" class="ts-more" data-tip-action="toggle-card" data-tip-row="${row.row}" data-tip-key="${cardKey}" aria-expanded="${cardOpen}" ${cardOpen?'':'hidden'}>${cardOpen?'접기':'자세히'}</button>
    <div class="ts-card-links">${draft}${tipLink(row.url,'원본','ts-source-link')}</div>
    ${actions}
  </article>`;
}

function tipRowItem(row){
  const verdict=row.verdict||'판단 중';
  const verdictClass={시안:'is-draft',기록:'is-note',기각:'is-drop'}[row.verdict]||'is-wait';
  // 고른 줄은 장부가 아직 「시안 나옴」이어도 진행 대신 고른 것을 보인다(「고르실 차례」와 함께 뜨지 않게).
  const showStage=!row.pending&&row.stage&&!['기록','기각','판단 전'].includes(row.stage);
  const stageClass={'시안 나옴':'is-pick','적용 중':'is-doing','적용함':'is-done','보류':'is-hold','버림':'is-gone'}[row.stage]||'';
  const pending=row.pending?`<span class="ts-row-pending">${escape(tipChoiceLabel(row.pending.to))} 정했어요</span><span class="ts-row-when">${row.pending.claimed?'장부에 옮기는 중이에요':'곧 장부에 옮겨요'}</span>`:'';
  const sameWay=row.decision?.to==='적용 중'?['적용 중','적용함'].includes(row.stage):row.decision?.to==='버림'&&row.stage==='버림';
  const decided=!row.pending&&row.decision&&sameWay?`<span class="ts-row-when">${escape(tipDate(row.decision.requestedAt))}에 ${escape(tipChoiceLabel(row.decision.to))} 정했어요</span>`:'';
  const conflict=!row.pending&&row.decision?.outcome==='conflict'&&!sameWay&&Date.now()-Date.parse(row.decision.requestedAt)<TIP_CONFLICT_SHOW_MS?'<span class="ts-row-when is-warn">장부가 먼저 바뀌어 옮기지 않았어요</span>':'';
  const noId=!row.pending&&!conflict&&row.stage==='시안 나옴'&&row.status==='새로'&&!row.postId?'<span class="ts-row-when is-warn">게시물 번호가 없어 여기서는 고를 수 없어요</span>':'';
  const holdNote=row.stage==='보류'&&row.stageNote?row.stageNote:'';
  const noteLabel=holdNote?'멈춘 까닭':row.verdict==='기각'?'사유':'가져올 것';
  const noteText=holdNote||row.note;
  const open=tipShares.open.has(tipRowKey(row));
  const draft=row.draft?.url?tipLink(row.draft.url,'시안 보기'):'';
  const place=!row.draft?.url&&row.draft?.text?`<p class="ts-row-note ts-row-place"><span>시안이 있는 곳</span> ${escape(row.draft.text)}</p>`:'';
  return `<li class="ts-row ${verdictClass}${open?' is-open':''}" data-tip-verdict="${escape(row.verdict||'')}">
    <span class="ts-row-date">${row.sharedAt?escape(tipDate(row.sharedAt)):''}</span>
    <div class="ts-row-main">
      <div class="ts-row-tags">${row.sharedAt?`<span class="ts-row-date-inline">${escape(tipDate(row.sharedAt))}</span>`:''}<span class="ts-verdict ${verdictClass}">${escape(verdict)}</span>${row.target?`<span class="ts-target">${escape(row.target)}</span>`:''}</div>
      <p class="ts-row-summary">${escape(row.summary||'요약이 없어요.')}</p>
      ${noteText?`<p class="ts-row-note"><span>${noteLabel}</span> ${escape(noteText)}</p>`:''}${place}
      <button type="button" class="ts-more" data-tip-action="toggle" data-tip-row="${row.row}" data-tip-key="toggle:${row.row}" aria-expanded="${open}" ${open?'':'hidden'}>${open?'접기':'자세히'}</button>
    </div>
    <div class="ts-row-side">
      ${showStage?`<span class="ts-stage ${stageClass}">${escape(TIP_STAGE_LABEL[row.stage]||row.stage)}</span>`:''}${pending}${decided}${conflict}${noId}
      <span class="ts-row-links">${tipLink(row.url,'원본')}${draft}</span>
    </div>
  </li>`;
}

function tipSharesBody(){
  const data=tipShares.data;
  if(!data){
    if(tipShares.error)return `<div class="ts-state is-error" role="alert"><p>${escape(tipShares.error)}</p><button type="button" class="btn small" data-tip-action="refresh" data-tip-key="refresh">다시 불러오기</button></div>`;
    return '<div class="ts-state" role="status"><p>공유한 게시물을 불러오고 있어요.</p></div>';
  }
  if(!data.ready)return '<div class="ts-state"><p><b>아직 장부를 받지 못했어요.</b></p><p>PC가 5분마다 팁 장부를 이 화면에 올려요. PC가 켜져 있으면 곧 보여요.</p></div>';
  const rows=data.rows||[];
  const pick=rows.filter(row=>row.decidable||row.pending);
  const counts=Object.fromEntries(TIP_FILTERS.map(([id])=>[id,id==='all'?rows.length:rows.filter(row=>tipVerdictOf(row)===id).length]));
  const shown=tipShares.filter==='all'?rows:rows.filter(row=>tipVerdictOf(row)===tipShares.filter);
  const stale=tipStale(data);
  const error=tipShares.error?`<div class="ts-inline-error" role="alert">${escape(tipShares.error)}</div>`:'';
  const pickSection=pick.length?`<section class="ts-pick" aria-labelledby="ts-pick-title">
      <div class="ts-section-head"><h2 id="ts-pick-title">고르실 시안</h2>${data.waiting?`<span class="ts-section-count">${tipCountMark(data.waiting,'아직 고르지 않은 시안')}</span>`:''}</div>
      ${tipShares.readFailed?'<p class="ts-stale-note">화면이 장부를 다시 읽지 못하고 있어요. 잠시 뒤 다시 읽을게요.</p>':stale?'<p class="ts-stale-note">PC가 꺼져 있는 것 같아요. 고르신 것은 PC가 켜지면 장부에 옮겨져요.</p>':''}
      <div class="ts-pick-list">${pick.map(row=>tipCard(row,data)).join('')}</div>
    </section>`:'';
  const filter=`<div class="segmented ts-filter" role="group" aria-label="판단으로 걸러 보기">${TIP_FILTERS.filter(([id])=>id!=='판단 중'||counts[id]||tipShares.filter===id).map(([id,label])=>`<button type="button" data-tip-action="filter" data-tip-filter="${id}" data-tip-key="filter:${id}" aria-pressed="${tipShares.filter===id}">${label}<span class="ts-filter-count">${counts[id]}</span></button>`).join('')}</div>`;
  const list=shown.length?`<ol class="ts-list">${shown.map(tipRowItem).join('')}</ol>`:`<p class="ts-empty">${rows.length?'이 판단의 게시물은 없어요.':'아직 공유한 게시물이 없어요.'}</p>`;
  return `${error}${pickSection}
    <section class="ts-all" aria-labelledby="ts-all-title">
      <div class="ts-section-head ts-all-head"><h2 id="ts-all-title">모든 공유</h2>${filter}</div>
      ${list}
    </section>`;
}

function tipSharesFresh(){
  const data=tipShares.data;
  // 한 번도 받지 못했으면(서랍의 첫 읽기 실패) 「다시」라고 하지 않는다. 받은 장부가 아직 비었을 때만 이 글을 보인다.
  if(!data?.receivedAt)return data&&tipShares.readFailed?'<span class="ts-fresh is-stale">다시 읽지 못했어요</span>':'';
  const stale=tipStale(data);
  const failed=tipShares.readFailed?' · 다시 읽지 못했어요':'';
  return `<span class="ts-fresh${stale||failed?' is-stale':''}" title="${escape(tipTime(data.receivedAt))}에 받은 장부">${stale?`${escape(tipAgo(data.receivedAt))}에 받은 장부예요`:`장부 ${escape(tipTime(data.receivedAt).replace(/^\d+월 \d+일 /,''))} 기준`}${failed}</span>`;
}

// 「자세히」는 요약이나 사유가 실제로 잘린 줄에만 보인다(글꼴 · 폭이 바뀌면 다시 잰다).
function tipSharesMeasure(){
  const root=document.querySelector('[data-tip-root]');if(!root)return;
  for(const row of root.querySelectorAll('.ts-row,.ts-card')){
    const button=row.querySelector('.ts-more');if(!button)continue;
    if(row.classList.contains('is-open')){button.hidden=false;continue;}
    button.hidden=![...row.querySelectorAll('.ts-row-summary,.ts-row-note,.ts-card-title,.ts-card-note')].some(node=>node.scrollHeight>node.clientHeight+1);
  }
}
let tipMeasureFrame=0,tipResizeTimer=0;
function tipSharesMeasureSoon(){cancelAnimationFrame(tipMeasureFrame);tipMeasureFrame=requestAnimationFrame(tipSharesMeasure);}

function tipSharesPage(){
  tipSharesIdentity();
  if(!tipSharesAllowed())return '';
  // 데이터가 오기 전에 화면을 여러 번 그려도 읽기는 한 번만 보낸다.
  if(!tipShares.data&&!tipShares.loading&&!tipShares.queued&&!tipShares.error){tipShares.queued=true;queueMicrotask(()=>{tipShares.queued=false;void tipSharesLoad();});}
  queueMicrotask(tipSharesMeasureSoon);
  const body=tipSharesBody();tipShares.painted=body;
  return `<section class="tip-shares" aria-labelledby="tip-shares-title" data-tip-root>
    <header class="ts-head">
      <div class="ts-head-copy">
        <p class="ts-eyebrow">텔레그램에서 공유하신 것</p>
        <h1 id="tip-shares-title">공유한 게시물</h1>
        <p class="ts-desc">공유하신 게시물마다 시안 · 기록 · 기각으로 판단해요. 나온 시안은 보고 적용할지 골라 주세요.</p>
      </div>
      <div class="ts-head-actions"><span data-tip-fresh>${tipSharesFresh()}</span><button type="button" class="btn small quiet" data-tip-action="refresh" data-tip-key="refresh" ${tipShares.loading?'disabled':''}>${icon('refresh')}새로고침</button></div>
    </header>
    <div data-tip-body>${body}</div>
  </section>`;
}

function tipSharesPaint(){
  const badge=document.querySelector('[data-tip-badge]');
  if(badge)badge.innerHTML=tipBadgeInner(tipShares.data?.waiting||0);
  const root=document.querySelector('[data-tip-root]');
  if(!root||state.tab!=='tips'){tipShares.painted='';return;}
  const active=document.activeElement,activeKey=root.contains(active)?active?.dataset?.tipKey:'';
  const body=root.querySelector('[data-tip-body]'),fresh=root.querySelector('[data-tip-fresh]'),refresh=root.querySelector('[data-tip-action="refresh"]');
  const html=tipSharesBody();
  if(body&&(html!==tipShares.painted||!body.innerHTML)){body.innerHTML=html;tipShares.painted=html;}
  tipSharesMeasure();
  if(fresh)fresh.innerHTML=tipSharesFresh();
  if(refresh&&root.querySelector('.ts-head-actions')?.contains(refresh))refresh.disabled=tipShares.loading;
  const want=tipShares.focus||activeKey;tipShares.focus='';
  if(want){
    const fallback=want.startsWith('undo:')||want.startsWith('apply:')||want.startsWith('drop:')?`#ts-card-${want.split(':')[1]}`:'';
    const next=root.querySelector(`[data-tip-key="${CSS.escape(want)}"]`)||(want.startsWith('undo:')?root.querySelector(`[data-tip-key="apply:${CSS.escape(want.split(':')[1])}"]`):null);
    if(next&&!next.disabled)next.focus({preventScroll:true});
    // 읽는 동안 꺼 둔 단추(새로고침)는 초점을 잃으니, 다음에 그릴 때 다시 준다.
    else if(next&&next.disabled)tipShares.focus=want;
    else if(fallback){const card=root.querySelector(fallback)?.closest('.ts-card');if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});}}
  }
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-tip-action]');
  if(!button||button.disabled||!tipSharesAllowed())return;
  const action=button.dataset.tipAction,rowNumber=Number(button.dataset.tipRow);
  const row=tipShares.data?.rows?.find(item=>item.row===rowNumber);
  if(action==='refresh'){tipShares.focus='refresh';void tipSharesLoad();return;}
  if(action==='filter'){tipShares.filter=TIP_FILTERS.some(([id])=>id===button.dataset.tipFilter)?button.dataset.tipFilter:'all';tipShares.focus=`filter:${tipShares.filter}`;tipSharesPaint();return;}
  if(!row)return;
  if(action==='toggle-card'){const key=`card:${row.row}`;if(tipShares.openCards.has(key))tipShares.openCards.delete(key);else tipShares.openCards.add(key);tipShares.focus=key;tipSharesPaint();return;}
  if(action==='toggle'){const key=tipRowKey(row);if(tipShares.open.has(key))tipShares.open.delete(key);else tipShares.open.add(key);tipShares.focus=`toggle:${row.row}`;tipSharesPaint();return;}
  if(action==='decide'&&['적용 중','버림'].includes(button.dataset.tipTo)&&row.decidable&&!row.pending){void tipSharesMutate('/api/tip-shares/decision',{row:row.row,postId:row.postId,to:button.dataset.tipTo},row,`undo:${row.row}`);return;}
  if(action==='undo'&&row.pending&&!row.pending.claimed){void tipSharesMutate('/api/tip-shares/decision/cancel',{row:row.row,postId:row.postId},row,`apply:${row.row}`);}
});
window.addEventListener('resize',()=>{clearTimeout(tipResizeTimer);tipResizeTimer=setTimeout(tipSharesMeasureSoon,150);});
document.fonts?.ready?.then(()=>tipSharesMeasureSoon());
// 화면이 보이는 동안 1분마다 조용히 다시 읽는다. PC가 가져간 선택, 새 시안, 받은 시각이 화면에 따라온다.
setInterval(()=>{
  if(document.visibilityState==='visible'&&state.tab==='tips'&&tipSharesAllowed()&&!tipShares.loading&&!tipShares.busy.size&&Date.now()-Math.max(tipShares.loadedAt,tipShares.triedAt)>=TIP_REFRESH_MS)void tipSharesLoad({quiet:true});
},15000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&state.tab==='tips'&&tipSharesAllowed()&&!tipShares.loading&&Date.now()-tipShares.loadedAt>120000)void tipSharesLoad({quiet:true});
});
