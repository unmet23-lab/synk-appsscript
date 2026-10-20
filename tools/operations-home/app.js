import {marked} from '/vendor/marked.mjs';
const $=s=>document.querySelector(s),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,documentCache=new Map(),resumeCache=new Map(),requestNumber=0,searchNumber=0,initial=true;
const validTime=t=>Boolean(t)&&Number.isFinite(Date.parse(t));
const fmt=t=>validTime(t)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t)):'확인 기록 없음';
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
  const r=route();$('#nav').innerHTML=`<a class="nav-home ${r==='home'?'selected':''}" href="#home" ${r==='home'?'aria-current="page"':''}><span class="nav-index">⌂</span>한눈에 보기</a><a class="${r.startsWith('resume')?'selected':''}" href="#resume" ${r.startsWith('resume')?'aria-current="page"':''}><span class="nav-index">↗</span>작업 이어가기</a>`+['기준과 자산','세 회사','사업과 실행'].map(group=>`<div class="nav-group">${group}</div>${data.panels.filter(p=>p.group===group).map(p=>`<a href="#${p.id}" class="${r===p.id?'selected':''}" ${r===p.id?'aria-current="page"':''}><span class="nav-index">${String(data.panels.indexOf(p)+1).padStart(2,'0')}</span>${p.title}</a>`).join('')}`).join('');
}
function feedState(feed){
  const checked=validTime(feed.checkedAt),parts=[escape(feed.source||'AI 실행 환경')];
  if(feed.configured===false)parts.push('연결 설정 안 됨');
  else if(feed.configured===true&&!feed.connected&&!checked)parts.push('연결 설정됨','아직 상태 수신 없음');
  else if(feed.source==='Antigravity'&&feed.tasks?.length&&feed.tasks.every(t=>['exited','pid_reused'].includes(t.processState)))parts.push('열린 작업 창 없음',checked?'마지막 수신 '+fmt(feed.checkedAt):'수신 시각 미확인');
  else if(feed.stale)parts.push('갱신 지연',checked?'마지막 확인 '+fmt(feed.checkedAt):'아직 상태 수신 없음');
  else if(feed.connected)parts.push(checked?'마지막 확인 '+fmt(feed.checkedAt):'상태 수신 시각 미확인');
  else parts.push(feed.configured===true?'연결 설정됨 · 상태 수신 중단':'연결 대기',checked?'마지막 확인 '+fmt(feed.checkedAt):'아직 상태 수신 없음');
  return `<span>${parts.join(' · ')}</span>`;
}
function taskList(mode='active'){
  const all=mode==='all',feeds=[data.runtime,...(data.otherRuntimes||[])].filter(Boolean);
  const labels={active:'작업 중',running:'작업 중',busy:'작업 중',needs_attention:'확인 요청',idle:'대기',response_complete:'응답 종료',error:'오류 확인 필요',interrupted:'중단',unknown:'상태 미확인'};
  const entries=feeds.flatMap(feed=>(feed.tasks||[]).map(task=>{
    const checkedAt=task.checkedAt||feed.checkedAt,fresh=Boolean(feed.connected&&!feed.stale&&!task.stale&&validTime(checkedAt));
    return {task,feed,checkedAt,fresh};
  })).filter(entry=>all||(entry.fresh&&['active','running','needs_attention','busy'].includes(entry.task.status)));
  const priority=entry=>entry.fresh&&entry.task.status==='needs_attention'?0:entry.fresh&&['active','running','busy'].includes(entry.task.status)?1:2;
  entries.sort((a,b)=>priority(a)-priority(b)||(Date.parse(b.checkedAt)||0)-(Date.parse(a.checkedAt)||0));
  const limit=all?20:6,cards=entries.slice(0,limit).map(({task,feed,checkedAt,fresh})=>{
    const source=task.source||feed.source||'AI 실행 환경',label=labels[task.status]||labels.unknown;
    const ended=['exited','pid_reused'].includes(task.processState);
    const status=ended?'작업 창 종료 · 완료 여부 미확인':fresh?label:validTime(checkedAt)?'마지막 기록: '+label+' · 갱신 지연':'상태 미확인';
    const link=source==='Codex'&&task.id?'codex://threads/'+encodeURIComponent(task.id):all?null:'#workflow';
    const tag=link?'a':'article',dot=!fresh?' is-stale':task.status==='needs_attention'||task.status==='error'?' is-attention':['active','running','busy'].includes(task.status)?'':' is-idle';
    const model=task.model?`<small class="task-model">모델 ${escape(task.model)}</small>`:source==='Antigravity'?'<small class="task-model">모델 미확인</small>':'';
    return `<${tag} class="task-row"${link?` href="${link}"`:''}><span class="status-dot${dot}"></span><div><b>${escape(task.title||'제목 없는 작업')}</b><small>${escape(source)} · ${escape(status)} · ${validTime(checkedAt)?'마지막 확인 '+fmt(checkedAt):'확인 기록 없음'}</small>${model}</div>${link?'<span aria-hidden="true">↗</span>':''}</${tag}>`;
  }).join('');
  const empty=all?'아직 받은 작업 상태가 없습니다.':'최근 확인된 실행 중·확인 요청 작업이 없습니다.<br>대기·응답 종료·갱신 지연 기록은 워크플로우에서 볼 수 있습니다.';
  return `${cards||`<p class="empty">${empty}</p>`}${entries.length>limit?`<p class="caption">${entries.length}개 중 ${limit}개를 표시합니다.${all?'':' 전체 상태는 워크플로우에서 확인합니다.'}</p>`:''}<div class="feed-state">${feeds.map(feedState).join('')}</div>`;
}
function evidenceRows(rows){return rows.length?`<ul class="work-evidence">${rows.map(e=>`<li>${escape(e.label)} · ${escape({present:'파일 있음',directory:'폴더 있음',missing:'파일 미발견',not_checked:'외부 내용 미확인',verified:'대조 확인',unverified:'대조 미확인',passed:'검증 통과',no_changes:'변경 없음',needs_attention:'확인 필요'}[e.state]||e.state)}<code>${escape(e.reference)}</code></li>`).join('')}</ul>`:'<p class="caption">연결된 완료 근거 없음</p>';}
function workMeta(item){
  const work=data.operations?.items.find(row=>row.source.line===item.line);if(!work)return '';
  return `<div class="work-meta"><span>${escape(work.stage)}</span><small>트랙 ${work.source.line}행 · 원문 ${fmt(work.source.modifiedAt)}</small>${work.nextAction?`<p><b>다음 일</b> ${escape(work.nextAction)}</p>`:'<p class="caption">다음 단계는 원문에서 확인이 필요합니다.</p>'}${work.decision?`<p><b>남은 결정</b> ${escape(work.decision)}</p>`:''}<details><summary>완료 근거와 실행 기록 ${work.evidence.length+work.runs.reduce((n,r)=>n+r.evidence.length,0)}개</summary><p class="caption">링크가 있다는 것과 실제 작업 완료는 다릅니다.</p>${evidenceRows(work.evidence)}${work.runs.map(run=>`<p>${escape(run.owner)} · ${escape(run.stage)} · ${fmt(run.at)}</p>${evidenceRows(run.evidence)}`).join('')}</details></div>`;
}
function pendingRows(items,limit){return items.slice(0,limit||items.length).map(item=>`<article class="pending-row"><span class="owner">${escape(item.owner)}</span><div><b>${escape(item.title||item.heading.replace(/^\S+\.\s*/,''))}</b>${workMeta(item)}<details class="pending-text"><summary>원문과 이전 경과</summary>${markup(item.text,{file:'docs/_ops/트랙.md'})}</details></div></article>`).join('')||'<p class="empty">이 분야로 연결된 남은 일 기록이 없습니다.</p>';}
function targetLinks(selected=''){return `<div class="resume-targets">${(data.resumeTargets||[]).map(t=>`<a href="#resume/${t.id}" class="quiet-button ${selected===t.id?'selected':''}" ${selected===t.id?'aria-current="page"':''}>${escape(t.label)}</a>`).join('')}</div>`;}
function maintenanceCards(){return (data.maintenance||[]).length?`<section class="surface maintenance"><div class="section-title"><h2>백업과 원본 보존</h2><span>기존 감시·실행 기록</span></div><div class="maintenance-grid">${data.maintenance.map(s=>`<article><h3>${s.kind==='backup'?'통합 백업 상태':'만족사례 원본'}</h3><p class="health-label">${escape(s.label||'확인 기록 없음')}</p><small>확인 ${fmt(s.checkedAt)}${s.source?.stale?' · 갱신 필요':''}</small>${s.lastSuccessAt?`<small>최근 성공 ${fmt(s.lastSuccessAt)}</small>`:''}${s.nextExpectedAt?`<small>다음 확인 기준 ${fmt(s.nextExpectedAt)}</small>`:''}${s.issues?.length?`<ul>${s.issues.slice(0,4).map(i=>`<li>${escape(i.caseId?i.caseId+' · ':'')}${escape(i.label)}</li>`).join('')}</ul>`:''}${s.components?.length?`<details><summary>구성요소 ${s.components.length}개 · 성공 시각과 근거</summary>${s.components.map(c=>`<div class="backup-component"><b>${escape(c.label)} · ${escape(c.statusLabel)}</b><small>최근 성공 ${fmt(c.lastSuccessAt)} · 확인 ${fmt(c.checkedAt)}</small>${c.repair?`<p>${c.repair.status==='verified'?'실패 단계 보완 확인 · '+fmt(c.repair.finishedAt):'보완 근거 대조 필요'}</p><code>${escape(c.repair.source)}</code>`:''}<code>${escape(c.receiptPath)}</code></div>`).join('')}</details>`:''}<p class="caption">${escape(s.scope||'')}</p></article>`).join('')}</div></section>`:'';}
function performanceCards(){
  const p=data.performance;if(!p)return '';
  const n=value=>value===null||value===undefined?'—':Number(value).toLocaleString('ko-KR');
  const statusLabel=value=>({recorded:'관측 기록 있음',pending:'관측 대기',missed:'관측 기한 지남',collecting:'수집 중','manual-required':'직접 확인 필요',retry:'재시도 대기',unavailable:'수집할 수 없음',unknown:'상태 미확인'}[value]||'상태 미확인');
  if(!p.available)return `<section class="surface performance-summary"><h2>기존 수집 성과</h2><p>성과 사본이 아직 연결되지 않았습니다. 기존 SNS 상태 수집이 다음에 남긴 사본을 읽습니다.</p><p class="caption">미연결은 성과 0이 아닙니다.</p></section>`;
  const channels=new Map(p.channels.map(c=>[c.id,c]));
  return `<section class="surface performance-summary"><h2>기존 수집 성과</h2><p class="caption">서버 읽음 ${fmt(p.checkedAt)} KST${p.stale?' · 갱신 지연':''}${!p.appRunning?' · 서버 실행 미확인':''}. ${escape(p.scope)}</p>
  <h3>계정별 최근 값</h3><div class="table-scroll"><table><thead><tr><th>계정</th><th>팔로워</th><th>게시물</th><th>계정 조회</th><th>측정 시각</th></tr></thead><tbody>${p.channels.map(c=>`<tr><th>${escape(c.label)}<small>${escape(c.platform)}</small></th><td>${n(c.snapshot?.followers)}</td><td>${n(c.snapshot?.posts)}</td><td>${n(c.snapshot?.views)}</td><td>${c.expired?'보관 기한 지남':fmt(c.snapshot?.checkedAt)}<small>${escape(c.snapshot?.source||'출처 미확인')}</small></td></tr>`).join('')}</tbody></table></div>
  <h3>게시물별 관측</h3><p class="caption">${p.observations.length}개 관측 중 최근 ${Math.min(12,p.observations.length)}개. 빈칸은 미확인입니다.${p.coverage.limited?' 수집 사본에 일부 항목만 포함돼 있습니다.':''}</p>
  ${p.observations.slice(0,12).map(o=>`<details class="performance-observation"><summary>${escape(channels.get(o.channelId)?.label||'계정')} · ${escape(o.title)} · ${o.hours}시간 <small>${escape(statusLabel(o.status))}${o.expired?' · 보관 기한 지남':''}</small></summary><p><a href="${escape(o.url)}" target="_blank" rel="noopener">게시 원문 ↗</a> · 게시 ${fmt(o.publishedAt)}</p><div class="table-scroll"><table><thead><tr><th>지표</th><th>값</th><th>기준 기간</th><th>측정·출처</th></tr></thead><tbody>${o.metrics.map(m=>`<tr><th>${escape(m.label)}</th><td>${n(m.value)}${m.value===null?'':m.unit==='percent'?'%':m.unit==='seconds'?'초':''}${m.estimated?' (추정)':''}</td><td>${escape(m.period)}${m.measurementWindowMissed?'<small>관측 기한 지남</small>':['late','early'].includes(m.timing)?`<small>${m.timing==='late'?'늦은 관측':'이른 관측'}</small>`:''}</td><td>${fmt(m.observedAt)}<small>${escape(m.source||'출처 미확인')}</small></td></tr>`).join('')}</tbody></table></div></details>`).join('')||'<p class="empty">등록된 게시 관측 기록이 없습니다.</p>'}</section>`;
}
async function resumePage(selected='',{force=false}={}){
  const intro=`<section class="page-heading"><div class="eyebrow">SYNK / CONTINUE</div><h1>작업 이어가기</h1><p>지금 손볼 대상을 고르면 원문, 참고카드, 변경과 확인 기록을 함께 읽습니다.</p></section>${targetLinks(selected)}`;
  if(!selected)return intro;
  const cached=resumeCache.get(selected),now=Date.now(),revision=data.revision;
  const fresh=cached&&cached.revision===revision&&now-cached.readAt>=0&&now-cached.readAt<60_000;
  const r=!force&&fresh?cached.value:await json('/api/resume?target='+encodeURIComponent(selected));
  if(force||!fresh)resumeCache.set(selected,{revision,readAt:Date.now(),value:r});
  const qastate={fresh:'현재 소스와 일치',stale:'소스가 바뀜 · 재확인 필요',unavailable:'대조할 수 없음'},result={passed:'시험 통과',failed:'시험 실패',running:'실행 중'};
  return intro+`<p class="caption">${escape(r.coverage)} · 확인 ${fmt(r.checkedAt)} KST · 최대 1분간 재사용, 새로고침하면 즉시 확인</p><div class="resume-grid"><section class="surface"><h2>이번 작업의 원문</h2>${r.documents.map(d=>`<div class="resource">${sourceLink(d)}<small>${d.available?'원문 수정 '+fmt(d.modifiedAt):escape(d.error||'원문 연결 확인 필요')}</small></div>`).join('')}</section><section class="surface"><h2>아직 적용하지 않은 참고카드 <small>${r.cards.length}개</small></h2>${r.cards.map(c=>`<article class="resume-card"><div class="section-title">${sourceLink(c)}<small>${escape(c.when)}</small></div><p>${escape(c.summary)}</p>${c.request?`<details><summary>적용 요청문 읽기</summary><div class="markdown">${markup(c.request,c)}</div></details>`:''}</article>`).join('')||'<p class="empty">이 대상의 미적용 카드가 없습니다.</p>'}</section></div>
  <section class="surface pending-section"><div class="section-title"><h2>원문에 남은 일 ${r.pending.length}개</h2><a href="#doc/track">트랙 원문 ↗</a></div><p class="caption">원문 순서입니다. 담당·다음 일·근거를 같은 기준으로 표시합니다.</p>${pendingRows(r.pending)}</section>
  <div class="resume-grid pending-section"><section class="surface"><h2>현재 작업본의 변경</h2><p class="caption">${escape(r.git.scope)}</p>${r.git.available?`<p>${escape(r.git.branch)} · <code>${escape(r.git.head.slice(0,12))}</code></p>${r.git.upstream?`<small>${escape(r.git.upstream.ref)}의 로컬 기록 대비 앞섬 ${r.git.upstream.ahead} · 뒤처짐 ${r.git.upstream.behind}</small>`:''}<details><summary>변경 파일 ${r.git.changeCount}개${r.git.changeCount>r.git.changes.length?' 중 '+r.git.changes.length+'개':''}</summary><ul class="change-list">${r.git.changes.map(c=>`<li><code>${escape(c.status)}</code> ${escape(c.file)}${Number.isFinite(c.added)?` <small>추가 ${c.added}줄 · 삭제 ${c.removed}줄</small>`:''}</li>`).join('')}</ul></details><h3>최근 관련 커밋</h3>${r.git.commits.map(c=>`<p class="commit-row"><code>${escape(c.id)}</code> ${escape(c.title)}<small>${fmt(c.at)}</small></p>`).join('')}`:'<p class="empty">Git 상태를 읽지 못했습니다.</p>'}</section><section class="surface"><h2>최근 검증과 현재성</h2><p class="caption">시험 통과와 현재 소스의 일치는 따로 확인합니다.</p>${r.qa.map(q=>`<article class="resume-card"><h3>${escape(q.label)}</h3><p>${escape(result[q.status]||q.status)} · ${escape(qastate[q.freshness.state]||'대조 미확인')}</p><small>${fmt(q.finishedAt||q.startedAt)} · ${q.syntheticAccount?'합성 계정':'계정 종류는 해당 기록 확인'} · ${q.liveProviderCalls===false?'실제 공급자 호출 없음':'외부 호출 범위는 해당 기록 확인'}</small><details><summary>검증 근거 위치</summary><code class="evidence-path">${escape(q.manifest)}</code></details></article>`).join('')||'<p class="empty">이 작업의 새 형식 검증 기록이 없습니다. 기존 QA 문서의 기록은 원문에서 확인하세요.</p>'}</section></div>`;
}
function home(){
  const decisions=data.pending.filter(i=>i.owner.includes('유호'));
  const recent=[...new Map(data.documents.filter(d=>d.available&&d.id!=='track').map(d=>[d.file,d])).values()].sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)).slice(0,4);
  return `<section class="hero"><div><div class="eyebrow">SYNK / COMPANY HOME</div><h1>회사의 기준과<br>지금 하는 일.</h1><p>열 개의 분야를 한곳에서 봅니다.<br>기준은 원문에서, 진행은 확인된 기록에서 가져옵니다.</p></div><div class="hero-art"><img src="/asset/mongle" data-synk-mascot="몽글" alt="SYNK의 몽글" fetchpriority="high"></div></section>
  <section class="surface resume-launch"><div class="section-title"><h2>작업 이어가기</h2><a href="#resume">대상별 확인 ↗</a></div><p class="caption">관련 원문 · 미적용 참고카드 · 변경 파일 · 최근 검증</p>${targetLinks()}</section>
  <div class="overview"><section class="surface"><div class="section-title"><h2>검토할 결정</h2><a href="#pending">기록 전체 ${decisions.length}건 ↗</a></div><p class="caption">남은 일 원문에 적힌 요청 · 현재도 필요한지 검토</p>${pendingRows(decisions,3)}</section><section class="surface"><div class="section-title"><h2>진행 중인 AI 작업</h2><a href="#workflow">연결 상태 ↗</a></div><div data-task-feed="active">${taskList()}</div></section></div>${maintenanceCards()}
  <section class="surface pending-section"><div class="section-title"><h2>업무 단계와 근거</h2><a href="#activity">전체 ${data.pending.length}건 ↗</a></div><p class="caption">${escape(data.operations?.scope||'원문에 기록된 단계와 근거입니다.')}</p>${pendingRows(data.pending.filter(row=>!row.owner.includes('유호')),4)}</section>
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
  <div class="panel-layout"><section class="surface canon"><div class="section-title"><h2>${first.title}</h2>${sourceLink(first)}</div><div class="markdown excerpt">${markup(doc.content,doc)}</div><a class="read-more" href="#doc/${doc.id}">원문을 넓게 읽기 ↗</a></section><aside class="panel-resources"><section class="surface"><h2>연결된 원문</h2>${panel.sources.map(d=>`<div class="resource">${sourceLink(d)}<small>${d.available?'원문 수정 '+fmt(d.modifiedAt):escape(d.error)}</small></div>`).join('')}</section>${panel.id==='workflow'?`<section class="surface"><h2>현재 작업 상태</h2><div data-task-feed="all">${taskList('all')}</div><p class="caption">Codex는 앱의 예약 조회 시각 기준입니다. Claude는 공식 명령으로 직접 조회합니다. Antigravity CLI 상태를 받습니다. Gemini 웹대화는 포함하지 않습니다. 대기·응답 종료는 사업 완료를 뜻하지 않습니다.</p></section>`:''}</aside></div>
  ${panel.id==='marketing'?performanceCards():''}<section class="surface pending-section"><div class="section-title"><h2>이 분야에 남은 일</h2><a href="#doc/track">원문 ↗</a></div><p class="caption">기록된 미완료 항목입니다. 실행 중이라는 뜻은 아닙니다.</p>${pendingRows(panel.pending)}</section>`;
}
async function documentPage(id){const d=await getDoc(id,true);return `<section class="page-heading"><a class="back" href="#${data.panels.find(p=>p.sources.some(s=>s.id===id))?.id||'home'}">← 분야로 돌아가기</a><h1>${d.title}</h1><p>원문 수정 ${fmt(d.modifiedAt)}</p><div class="source-path">${escape(d.file)}</div></section>${id==='channel-results'?performanceCards()+'<p class="caption">아래 문서는 별도 장부의 과거 측정 기록입니다. 위의 서버 관측과 자동 합산하지 않습니다.</p>':''}<article class="surface markdown full-document">${markup(d.content,d)}</article>`;}
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
async function render({preserve=false,force=false}={}){if(!data)return;const number=++requestNumber,r=route(),saved=preserve?readingState():null;nav();$('#breadcrumb').textContent=r==='home'?'한눈에 보기':data.panels.find(p=>p.id===r)?.title||'정본과 기록';let content;
  try{if(r==='home')content=home();else if(r==='activity')content=`<section class="page-heading"><h1>업무 단계와 근거</h1><p>${escape(data.operations?.scope||'현재 원문 기록')}</p></section><section class="surface">${pendingRows(data.pending)}</section>`;else if(r==='resume'||r.startsWith('resume/'))content=await resumePage(r.split('/')[1]||'',{force});else if(r==='pending')content=`<section class="page-heading"><h1>검토할 결정</h1><p>남은 일 원문에 기록된 요청입니다. 새로운 승인 요구를 만든 목록은 아닙니다.</p></section><section class="surface">${pendingRows(data.pending.filter(i=>i.owner.includes('유호')))}</section>`;else if(r.startsWith('doc/'))content=await documentPage(documentRoute(r).id);else{const panel=data.panels.find(p=>p.id===r);content=panel?await panelPage(panel):'<h1>페이지를 찾지 못했습니다</h1><a href="#home">운영 홈으로</a>';}
  }catch(e){content=`<section class="surface"><h1>원문 연결을 확인해 주세요</h1><p>${escape(e.message)}</p><a href="#home">운영 홈으로 돌아가기</a></section>`;}
  if(number===requestNumber){$('#main').innerHTML=content;document.title=(r==='home'?'SYNK 운영 홈':$('#breadcrumb').textContent+' · SYNK');if(saved&&saved.route===r)restoreReading(saved);else if(r.startsWith('doc/'))scrollToDocumentAnchor(documentRoute(r).anchor);}
}
async function refresh(force=false){
  try{const next=await json('/api/state');const sourceChanged=!data||data.revision!==next.revision,runtimeChanged=!data||JSON.stringify(data.runtime)!==JSON.stringify(next.runtime)||JSON.stringify(data.otherRuntimes)!==JSON.stringify(next.otherRuntimes),maintenanceChanged=!data||JSON.stringify(data.maintenance)!==JSON.stringify(next.maintenance),operationsChanged=!data||JSON.stringify(data.operations)!==JSON.stringify(next.operations),performanceChanged=!data||JSON.stringify(data.performance)!==JSON.stringify(next.performance);data=next;$('#connection').textContent='원문 연결됨';$('.connection-dot').classList.remove('offline');$('#notice').textContent='';$('#footer').textContent='원문 읽음 '+fmt(next.readAt)+' KST · 화면을 여는 동안 30초마다 확인 · 외부 상태는 각 근거의 확인 시각 기준';if(sourceChanged||force||route().startsWith('resume/')||operationsChanged||maintenanceChanged&&route()==='home'||performanceChanged&&['marketing','doc/channel-results'].includes(route())){if(sourceChanged)documentCache.clear();if(!$('#search').value.trim()){await render({preserve:!initial,force});initial=false;}}else if(runtimeChanged){for(const feed of document.querySelectorAll('[data-task-feed]'))feed.innerHTML=taskList(feed.dataset.taskFeed);}}
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
