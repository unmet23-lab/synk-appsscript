import {marked} from '/vendor/marked.mjs';
const $=s=>document.querySelector(s),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,documentCache=new Map(),requestNumber=0,searchNumber=0,initial=true;
const fmt=t=>t?new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t)):'확인 기록 없음';
const route=()=>{try{return decodeURIComponent(location.hash.slice(1)||'home');}catch{return 'home';}};
const anchorKey=text=>String(text||'').normalize('NFC').toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-');
const documentRoute=r=>{const [id,...anchor]=r.slice(4).split('/');return {id,anchor:anchor.join('/')};};
async function json(url){const r=await fetch(url,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'연결 확인이 필요합니다');return d;}
function sourceLink(d){return `<a class="source-link" href="#doc/${encodeURIComponent(d.id)}">${escape(d.title)} <span aria-hidden="true">↗</span></a>`;}
function markup(text,source){
  const dom=new DOMParser().parseFromString(marked.parse(text||'',{gfm:true,breaks:false}),'text/html');
  const allowed=new Set(['P','H1','H2','H3','H4','H5','H6','UL','OL','LI','STRONG','EM','DEL','CODE','PRE','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TH','TD','HR','BR','A','DETAILS','SUMMARY']);
  const headingCounts=new Map(),unlinked=new Map();
  for(const el of [...dom.body.querySelectorAll('*')]){
    if(!allowed.has(el.tagName)){if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG','FORM'].includes(el.tagName))el.remove();else el.replaceWith(...el.childNodes);continue;}
    const href=el.getAttribute('href'),namedAnchor=el.getAttribute('id');for(const a of [...el.attributes])el.removeAttribute(a.name);
    if(/^H[1-6]$/.test(el.tagName)){
      const key=anchorKey(el.textContent)||'section',count=headingCounts.get(key)||0;
      headingCounts.set(key,count+1);el.id='source-heading-'+key+(count?'-'+count:'');
    }else if(el.tagName==='A'&&namedAnchor){el.id='source-heading-'+anchorKey(namedAnchor);}
    if(el.tagName==='A'&&href){
      if(/^https?:\/\//i.test(href)){el.href=href;el.target='_blank';el.rel='noopener noreferrer';}
      else{
        try{
          const target=new URL(href,'http://local/'+(source?.file||'')),file=decodeURIComponent(target.pathname.slice(1));
          const match=data.documents.find(d=>d.file===file);
          if(match){const anchor=target.hash?anchorKey(decodeURIComponent(target.hash.slice(1))):'';el.href='#doc/'+encodeURIComponent(match.id)+(anchor?'/'+encodeURIComponent(anchor):'');}
          else{const reference=file+target.hash;unlinked.set(reference,el.textContent||file);el.className='unlinked';el.append(dom.createTextNode(' · 연결 안 됨'));}
        }catch{el.className='unlinked';el.append(dom.createTextNode(' · 연결 안 됨'));unlinked.set(href,el.textContent);}
      }
    }
  }
  for(const [file,title] of unlinked){
    const details=dom.createElement('details'),summary=dom.createElement('summary'),description=dom.createElement('p'),code=dom.createElement('code');
    details.className='unlinked-reference';summary.textContent='연결 안 됨 · '+title;description.append(dom.createTextNode('이 화면에 아직 연결하지 않은 원문입니다. 원문 경로: '));code.textContent=file;description.append(code);details.append(summary,description);dom.body.append(details);
  }
  for(const table of dom.body.querySelectorAll('table')){const wrap=dom.createElement('div');wrap.className='table-scroll';table.replaceWith(wrap);wrap.append(table);}
  return dom.body.innerHTML;
}
async function getDoc(id,full=false){const key=id+(full?':full':'');if(!documentCache.has(key))documentCache.set(key,await json('/api/document?id='+encodeURIComponent(id)+(full?'&full=1':'')));return documentCache.get(key);}
function nav(){
  const r=route();$('#nav').innerHTML=`<a class="nav-home ${r==='home'?'selected':''}" href="#home" ${r==='home'?'aria-current="page"':''}><span class="nav-index">⌂</span>한눈에 보기</a>`+['기준과 자산','세 회사','사업과 실행'].map(group=>`<div class="nav-group">${group}</div>${data.panels.filter(p=>p.group===group).map(p=>`<a href="#${p.id}" class="${r===p.id?'selected':''}" ${r===p.id?'aria-current="page"':''}><span class="nav-index">${String(data.panels.indexOf(p)+1).padStart(2,'0')}</span>${p.title}</a>`).join('')}`).join('');
}
function taskList(){
  const feeds=[data.runtime,...(data.otherRuntimes||[])];let cards='';
  for(const feed of feeds){const tasks=(feed.tasks||[]).filter(t=>['active','running','needs_attention','busy'].includes(t.status));
    if(feed.connected&&!feed.stale&&tasks.length)cards+=tasks.slice(0,6).map(t=>`<a class="task-row" href="${t.source==='Codex'?'codex://threads/'+encodeURIComponent(t.id):'#workflow'}"><span class="status-dot"></span><div><b>${escape(t.title)}</b><small>${escape(t.source)} · ${t.status==='needs_attention'?'확인 요청':'작업 중'} · ${fmt(feed.checkedAt)} 확인</small></div><span aria-hidden="true">↗</span></a>`).join('');
  }
  const states=feeds.map(f=>`<span>${escape(f.source||'Codex')} · ${!f.connected?'연결 대기':f.stale?'갱신 지연':fmt(f.checkedAt)+' 확인'}</span>`).join('');
  return `${cards||'<p class="empty">현재 확인된 진행 작업이 없습니다.<br>조회가 연결되지 않은 작업은 포함하지 않습니다.</p>'}<div class="feed-state">${states}<span>Gemini · 실시간 상태 연결 안 됨</span></div>`;
}
function pendingRows(items,limit){return items.slice(0,limit||items.length).map(item=>`<article class="pending-row"><span class="owner">${escape(item.owner)}</span><div><b>${escape(item.heading.replace(/^\S+\.\s*/,''))}</b><div class="pending-text">${markup(item.text,{file:'docs/_ops/트랙.md'})}</div></div></article>`).join('')||'<p class="empty">이 분야로 연결된 남은 일 기록이 없습니다.</p>';}
function home(){
  const decisions=data.pending.filter(i=>i.owner.includes('유호'));
  const recent=[...new Map(data.documents.filter(d=>d.available&&d.id!=='track').map(d=>[d.file,d])).values()].sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)).slice(0,4);
  return `<section class="hero"><div><div class="eyebrow">SYNK / COMPANY HOME</div><h1>회사의 기준과<br>지금 하는 일.</h1><p>열 개의 분야를 한곳에서 봅니다.<br>기준은 원문에서, 진행은 확인된 기록에서 가져옵니다.</p></div><div class="hero-art"><img src="/asset/mongle" data-synk-mascot="몽글" alt="SYNK의 몽글" fetchpriority="high"></div></section>
  <div class="overview"><section class="surface"><div class="section-title"><h2>검토할 결정</h2><a href="#pending">기록 전체 ${decisions.length}건 ↗</a></div><p class="caption">남은 일 원문에 적힌 요청 · 현재도 필요한지 검토</p>${pendingRows(decisions,3)}</section><section class="surface"><div class="section-title"><h2>진행 중인 AI 작업</h2><a href="#workflow">연결 상태 ↗</a></div><div data-task-feed>${taskList()}</div></section></div>
  <section class="directory"><div class="section-title"><h2>분야별로 보기</h2><span>정본과 현황을 함께</span></div><div class="panel-grid">${data.panels.map((p,i)=>`<a href="#${p.id}" class="panel-card"><span class="card-number">${String(i+1).padStart(2,'0')}</span><h3>${p.title}</h3><p>${p.subtitle}</p><div class="card-foot"><span>${p.sources.length}개 원문${p.sources.some(d=>!d.available)?' · 연결 확인 필요':''}</span><span aria-hidden="true">↗</span></div></a>`).join('')}</div></section>
  <section class="recent"><div class="section-title"><h2>최근 원문 변경</h2><span>파일 수정은 게시·배포 완료와 다릅니다</span></div>${recent.map(d=>`<a href="#doc/${d.id}"><span>${d.title}</span><time>${fmt(d.modifiedAt)}</time><span aria-hidden="true">↗</span></a>`).join('')}</section>`;
}
function gallery(panel){
  if(panel.id==='mascots')return `<div class="mascot-grid">${[['kkamong','까몽'],['marin','마린'],['mongle','몽글']].map(([id,name])=>`<figure><img src="/asset/${id}" alt="${name} 승인 본체" data-synk-mascot="${name}"><figcaption><b>${name}</b><a href="/asset/${id}?original=1" target="_blank" rel="noopener">4K 원본 열기 ↗</a></figcaption></figure>`).join('')}</div>`;
  if(panel.id==='brand')return `<div class="logo-grid">${['synk','synk-lab','synk-shift','synk-pulse'].map(n=>`<a href="/asset/${n}-logo?original=1" target="_blank" rel="noopener"><img src="/asset/${n}-logo" alt="${n.toUpperCase()} 승인 로고"><span>원본 열기 ↗</span></a>`).join('')}</div><div class="swatches">${['paper','ink','coral','lapis','meadow','butter'].map(c=>`<div><span class="swatch swatch-${c}"></span><b>${c}</b></div>`).join('')}</div>`;
  return '';
}
async function panelPage(panel){
  const selected=panel.id==='engines'?'engine-map':panel.id==='business'?'business-offers':panel.id;
  let first=panel.sources.find(s=>s.id===selected)||panel.sources[0];
  const doc=await getDoc(first.id);
  const visionSource=panel.sources.find(s=>s.id===panel.id+'-vision');
  const vision=visionSource?await getDoc(visionSource.id):null;
  const notes={business:'상품·가격의 설계와 실제 판매를 구분합니다. 매출·결제 내역은 연결되지 않았습니다.',engines:'설계·구현 기록을 보여줍니다. 배포·실사용·학습 효과는 각각의 확인 근거가 필요합니다.',marketing:'계정·제작·게시 기록을 보여줍니다. 공개 상태와 채널 성과를 지금 실시간 조회한 화면은 아닙니다.',workflow:'공식 하네스에서 작업하고, 이 화면은 기준과 상태만 읽습니다. 새 모델 호출이나 결제를 실행하지 않습니다.'};
  return `<section class="page-heading"><div class="eyebrow">${panel.group}</div><h1>${panel.title}</h1><p>${panel.subtitle}</p></section>${notes[panel.id]?`<p class="context-note">${notes[panel.id]}</p>`:''}${vision?`<section class="vision markdown">${markup(vision.content,vision)}</section>`:''}${gallery(panel)}
  <div class="panel-layout"><section class="surface canon"><div class="section-title"><h2>${first.title}</h2>${sourceLink(first)}</div><div class="markdown excerpt">${markup(doc.content,doc)}</div><a class="read-more" href="#doc/${doc.id}">원문을 넓게 읽기 ↗</a></section><aside class="panel-resources"><section class="surface"><h2>연결된 원문</h2>${panel.sources.map(d=>`<div class="resource">${sourceLink(d)}<small>${d.available?'원문 수정 '+fmt(d.modifiedAt):escape(d.error)}</small></div>`).join('')}</section>${panel.id==='workflow'?`<section class="surface"><h2>공식 작업 조회</h2><div data-task-feed>${taskList()}</div><p class="caption">Codex는 앱의 예약 조회 시각 기준입니다. Claude는 공식 명령으로 직접 조회합니다. 응답 종료는 사업 완료를 뜻하지 않습니다.</p></section>`:''}</aside></div>
  <section class="surface pending-section"><div class="section-title"><h2>이 분야에 남은 일</h2><a href="#doc/track">원문 ↗</a></div><p class="caption">기록된 미완료 항목입니다. 실행 중이라는 뜻은 아닙니다.</p>${pendingRows(panel.pending)}</section>`;
}
async function documentPage(id){const d=await getDoc(id,true);return `<section class="page-heading"><a class="back" href="#${data.panels.find(p=>p.sources.some(s=>s.id===id))?.id||'home'}">← 분야로 돌아가기</a><h1>${d.title}</h1><p>원문 수정 ${fmt(d.modifiedAt)}</p><div class="source-path">${escape(d.file)}</div></section><article class="surface markdown full-document">${markup(d.content,d)}</article>`;}
function readingState(){return {route:route(),x:window.scrollX,y:window.scrollY,details:[...$('#main').querySelectorAll('details')].map(el=>({summary:el.querySelector('summary')?.textContent,open:el.open})),scroll:[...$('#main').querySelectorAll('.excerpt,.table-scroll,pre')].map(el=>({top:el.scrollTop,left:el.scrollLeft}))};}
function restoreReading(saved){
  const details=[...$('#main').querySelectorAll('details')],used=new Set();
  for(const previous of saved.details){const index=details.findIndex((el,i)=>!used.has(i)&&el.querySelector('summary')?.textContent===previous.summary);if(index>=0){used.add(index);details[index].open=previous.open;}}
  [...$('#main').querySelectorAll('.excerpt,.table-scroll,pre')].forEach((el,i)=>{if(saved.scroll[i]){el.scrollTop=saved.scroll[i].top;el.scrollLeft=saved.scroll[i].left;}});window.scrollTo(saved.x,saved.y);
}
function scrollToDocumentAnchor(anchor){
  const target=document.getElementById('source-heading-'+anchorKey(anchor));if(!target)return;
  for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  target.scrollIntoView({block:'start'});
}
async function render({preserve=false}={}){if(!data)return;const number=++requestNumber,r=route(),saved=preserve?readingState():null;nav();$('#breadcrumb').textContent=r==='home'?'한눈에 보기':data.panels.find(p=>p.id===r)?.title||'정본과 기록';let content;
  try{if(r==='home')content=home();else if(r==='pending')content=`<section class="page-heading"><h1>검토할 결정</h1><p>남은 일 원문에 기록된 요청입니다. 새로운 승인 요구를 만든 목록은 아닙니다.</p></section><section class="surface">${pendingRows(data.pending.filter(i=>i.owner.includes('유호')))}</section>`;else if(r.startsWith('doc/'))content=await documentPage(documentRoute(r).id);else{const panel=data.panels.find(p=>p.id===r);content=panel?await panelPage(panel):'<h1>페이지를 찾지 못했습니다</h1><a href="#home">운영 홈으로</a>';}
  }catch(e){content=`<section class="surface"><h1>원문 연결을 확인해 주세요</h1><p>${escape(e.message)}</p><a href="#home">운영 홈으로 돌아가기</a></section>`;}
  if(number===requestNumber){$('#main').innerHTML=content;document.title=(r==='home'?'SYNK 운영 홈':$('#breadcrumb').textContent+' · SYNK');if(saved&&saved.route===r)restoreReading(saved);else if(r.startsWith('doc/'))scrollToDocumentAnchor(documentRoute(r).anchor);}
}
async function refresh(force=false){
  try{const next=await json('/api/state');const sourceChanged=!data||data.revision!==next.revision,runtimeChanged=!data||JSON.stringify(data.runtime)!==JSON.stringify(next.runtime)||JSON.stringify(data.otherRuntimes)!==JSON.stringify(next.otherRuntimes);data=next;$('#connection').textContent='원문 연결됨';$('.connection-dot').classList.remove('offline');$('#notice').textContent='';$('#footer').textContent='원문 읽음 '+fmt(next.readAt)+' · 화면을 여는 동안 30초마다 확인 · 외부 상태는 각 근거의 확인 시각 기준';if(sourceChanged){documentCache.clear();if(!$('#search').value.trim()){await render({preserve:!initial});initial=false;}}else if(runtimeChanged||force){for(const feed of document.querySelectorAll('[data-task-feed]'))feed.innerHTML=taskList();}}
  catch{$('#connection').textContent='연결 끊김';$('.connection-dot').classList.add('offline');$('#notice').textContent='갱신하지 못했습니다. 마지막으로 읽은 내용입니다. 바탕화면의 SYNK 운영 홈을 다시 열어주세요.';}
}
let searchTimer;
$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);const query=$('#search').value.trim();const number=++searchNumber;searchTimer=setTimeout(async()=>{if(!query){render();return;}try{const results=await json('/api/search?q='+encodeURIComponent(query));if(number!==searchNumber)return;++requestNumber;$('#main').innerHTML=`<section class="page-heading"><h1>“${escape(query)}” 검색</h1><p>현재 연결된 정본과 기록에서 ${results.length}개 문서를 찾았습니다.</p></section><div class="search-results">${results.map(d=>`<a class="surface" href="#doc/${d.id}"><h2>${escape(d.title)}</h2><p>${escape(d.snippet)}</p><small>${escape(d.file)}</small></a>`).join('')||'<p class="empty">일치하는 내용이 없습니다.</p>'}</div>`;}catch{$('#notice').textContent='검색 연결을 확인해 주세요.';}},200);});
$('#refresh').addEventListener('click',()=>refresh(true));
$('#menu').addEventListener('click',()=>{const on=document.body.classList.toggle('menu-open');$('#menu').setAttribute('aria-expanded',String(on));});
window.addEventListener('hashchange',()=>{$('#search').value='';++searchNumber;document.body.classList.remove('menu-open');$('#menu').setAttribute('aria-expanded','false');render();window.scrollTo(0,0);});
window.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}if(e.key==='Escape'){$('#search').value='';++searchNumber;document.body.classList.remove('menu-open');render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden&&!$('#search').value)refresh();},30000);refresh();
