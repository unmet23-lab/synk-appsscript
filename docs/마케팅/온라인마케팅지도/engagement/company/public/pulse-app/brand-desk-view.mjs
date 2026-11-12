import {esc} from './api.mjs';

// 직원 「고객 브랜드」 데스크(PULSE 인물 판 4, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md 4-4 · 6절 · 5판 D14 · D15).
// 직원 화면에서만 불러온다(손님 묶음 · 오프라인 목록에 넣지 않는다). 내부 도구라 한국어다.
// 왼쪽: 연결 요청 · 다시 쓰기 의뢰 확인 · 브랜드. 가운데: 고른 것 하나 — 줄마다 「다음 행동」 한 줄을 먼저 둔다.
// 쓰기는 모두 근거 한 줄(note)을 받는다(서버가 감사 기록 · 브랜드 기록에 남긴다). 단추는 서버가 그 직원에게 허락하는 것만 그린다(canManage · isAdmin · canConfirm) — 서버가 다시 막는다.
// 폼은 data-form="brand-…"이고 app.mjs가 /api/customer-workspaces/*로 보낸다(직원 CSRF). 폼마다 data-id를 작업 단위로 나눈다(쓰던 글 되살리기가 다른 폼으로 번지지 않게).
const arrow='<span class="arw" aria-hidden="true">→</span>';
const at=value=>{const ms=Date.parse(value);if(!Number.isFinite(ms))return '';const k=new Date(ms+9*3600000).toISOString();return `${k.slice(0,4)}.${k.slice(5,7)}.${k.slice(8,10)} ${k.slice(11,16)}`;};
const dayOf=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms+9*3600000).toISOString().slice(0,10):'';};
// 프로젝트 단계(직원 화면 프로젝트 목록 views.mjs stages와 같은 말).
const STAGE={received:'접수',planning:'내용·일정 협의',producing:'제작 중',review:'시안 확인',delivered:'최종 전달',archived:'보관됨'};
const ROLE={admin:'관리자',member:'회원'};
const KIND={real:'실제 인물',virtual:'가상 인물'};
// 인물 상태(저장 · 계산)와 「다시 쓸 수 없음」의 까닭(서버 personaUsability reason). expired는 손님 화면과 같은 뜻으로 「다시 쓰기 기한」 — 기한이 지나면 새 광고가 막히고,
// 그 뒤 30일(지우는 날)이 지나면 정리 예약이 그림 · 파일을 지운다(11-11 결정 표 ① · ④, 판 4 설계 11-3 — 끝나지 않은 참조가 있으면 그 일이 끝날 때까지 미룬다).
const STATUS={ready:'준비 끝',paused:'사용 중지',deleting:'지우는 중',deleted:'지움',expired:'다시 쓰기 기한 지남',retired:'사용 마침',withdrawn:'거둠'};
const REASON={expired:'다시 쓰기 기한이 지났어요',paused:'사용 중지예요',retired:'사용을 마쳤어요',withdrawn:'거둔 인물이에요',deleting:'지우는 중이에요',deleted:'지운 인물이에요',reuse_off:'다시 쓰기가 꺼져 있어요(보관 동의 없음 · 철회)',revision:'공개한 판이 없어요',closed:'닫힌 브랜드예요',workspace:'이 브랜드에 귀속되지 않았어요',status:'아직 준비 전이에요'};
// 할 일(서버 todosOf — 저장하지 않고 읽을 때 계산).
const TODO={deletion_requested:'손님이 삭제를 요청했어요 — 아래 참조를 정리한 뒤 관리자가 지워요',deletion_ready:'손님이 삭제를 요청했어요 — 참조 정리가 끝났어요. 관리자가 지우면 돼요',retention_due:'지우는 날이 지났는데 이 인물을 쓰는 끝나지 않은 일이 있어요 — 그 일이 끝나면 다음 정리(6시간마다)에 저절로 지워져요',deleting:'지우는 중이에요 — 「삭제 이어 하기」를 눌러 끝내요',closed:'닫힌 브랜드의 인물을 쓰는 진행 중 프로젝트예요 — 손님과 정리해요',expired:'다시 쓰기 기한이 지난 인물을 쓰는 진행 중 다시 쓰기예요 — 손님과 정리해요',paused:'사용 중지된 인물을 쓰는 진행 중 다시 쓰기예요 — 이미 집행 중인 광고는 손님과 따로 정해요',reuse_off:'다시 쓰기가 꺼진 인물을 쓰는 진행 중 다시 쓰기예요 — 손님과 정리해요'};
// 삭제 요청인데 남은 참조(볼 수 있는 프로젝트 · 볼 수 없는 프로젝트 · 24시간 안 초안 붙임 — 서버 삭제가 막는 것과 같다)가 없으면 「정리한 뒤」가 아니라 「정리 끝」 글로(만료 · 삭제 운영 시험 P3).
const todoWhy=item=>item.why==='deletion_requested'&&!item.projects?.length&&!item.hidden&&!item.drafts?'deletion_ready':item.why;
const HISTORY={created:'브랜드를 만들었어요',project_linked:'프로젝트를 이었어요',project_unlinked:'프로젝트 연결을 끊었어요',member_joined:'회원이 합류했어요',member_role:'회원 역할을 바꿨어요',member_removed:'회원을 뺐어요',closed:'브랜드를 닫았어요',reopened:'브랜드를 다시 열었어요',model_kept:'보관 동의를 받았어요',model_renewed:'보관을 연장했어요',model_reuse_off:'다시 쓰기를 껐어요',model_paused:'사용을 멈췄어요',model_unpaused:'사용 중지를 풀었어요',model_deletion_requested:'손님이 삭제를 요청했어요',model_deleting:'인물을 지우기 시작했어요',model_retention_deleting:'보관 규칙대로(지우는 날 · 원 프로젝트 정리) 인물을 지우기 시작했어요',model_unassigned:'인물 귀속을 취소했어요',reuse_confirmed:'다시 쓰기 의뢰 연결을 확인했어요'};
const USAGE=[['brand','브랜드',80],['product','제품',120],['purpose','광고 목적',200,true],['media','매체',200,true],['regions','지역',120],['period','사용 기간',120,true],['fee','비용',120],['schedule','일정',120],['note','메모',600]];
const input=(name,label,max,{area=false,required=false,value='',attrs=''}={})=>`<label><span>${esc(label)}</span>${area?`<textarea name="${name}" rows="2" maxlength="${max}" ${required?'required':''} ${attrs}>${esc(value)}</textarea>`:`<input type="text" name="${name}" value="${esc(value)}" maxlength="${max}" ${required?'required':''} ${attrs}>`}</label>`;
const reason=(label='근거 한 줄')=>input('note',label,300,{required:true,attrs:'placeholder="예) 지정 승인자 본인이 메일 회신으로 확인"'});
const form=(type,id,data,inner,label,{main=false}={})=>`<form class="desk-persona-form" data-form="${type}" data-id="${esc(id)}" ${data}>${inner}<button type="submit" class="${main?'btn-main':'btn-line'}">${main?`<span>${esc(label)}</span>${arrow}`:esc(label)}</button></form>`;
const more=(summary,inner,open=false)=>inner?`<details class="desk-persona-more" ${open?'open':''}><summary>${esc(summary)}</summary>${inner}</details>`:'';
// 이번 광고 사용 범위(판 3 set_usage와 같은 칸 · 같은 번역 키). 영어 프로젝트면 손님에게 보일 영어를 칸마다 함께 적어야 서버가 받는다.
// 사용 범위의 「메모」(손님에게 보임)는 폼 칸 이름을 usageNote로 둔다 — 같은 폼의 내부 근거 한 줄(note)과 이름이 겹치면 뒤 칸이 앞 칸을 덮어 근거가 손님 메모로 나간다(판 4 화면 검수 A1). app.mjs brandUsage가 되돌려 note로 보낸다.
const usageField=name=>name==='note'?'usageNote':name;
const usageFields=(usage={})=>`${USAGE.map(([name,label,max,required])=>input(usageField(name),label+(required?' · 꼭':''),max,{area:name==='note',required,value:usage[name]||''})).join('')}${more('영어 프로젝트일 때 — 손님에게 보일 영어',USAGE.map(([name,label,max])=>input(usageField(name)+'Tr',label+' · 영어',max*2,{area:name==='note',attrs:'lang="en"'})).join(''))}`;

// 다음 행동 한 줄(연결 요청).
function claimNext(c){
  if(c.status!=='pending')return {'approved':'승인했어요','rejected':'거절했어요','withdrawn':'손님이 거뒀어요'}[c.status]||c.status;
  if(c.stale)return '손님이 다시 요청해야 해요 — 초대 링크가 바뀌었거나 닫힌 프로젝트예요';
  if(c.linkedWorkspace)return c.linkedWorkspace.canManage?`이 분이 이 프로젝트의 승인자 · 연락처인지 앱 밖에서 확인하고, 브랜드 「${c.linkedWorkspace.name}」에 합류시킬지 정해요`:`브랜드 「${c.linkedWorkspace.name}」의 담당이나 관리자가 정해요`;
  return '이 분이 이 프로젝트의 승인자 · 연락처인지 앱 밖에서 확인하고, 새 브랜드를 만들거나 기존 브랜드에 이어요';
}
function reuseNext(r){
  if(r.confirmedAt)return '연결을 확인했어요 — 손님이 이번 광고 사용을 확인하기를 기다려요';
  if(!r.usable)return `지금은 다시 쓸 수 없어요(${REASON[r.reason]||r.reason}) — 손님과 정리해요`;
  if(r.personaKind==='real'&&!r.consentAllows)return '당사자 동의 범위 밖이에요 — 새 당사자 동의를 받은 뒤 확인해요';
  return r.canConfirm?'연결을 확인하고 이번 광고 사용 범위를 손님에게 보내요':'이 브랜드의 담당이나 관리자가 확인해요';
}
// 목록 줄 끝의 때(연결 요청 createdAt · 다시 쓰기 attachedAt)는 같은 제목 · 같은 모델의 의뢰를 가르려고 둔다(판 4 화면 최종 검수 F5).
const idTail=x=>x?.idHint?` · ID …${x.idHint}`:'';
const noName=name=>!name||name==='고객';
function nav(b){
  const l=b.list||{claims:[],reuseRequests:[],workspaces:[]},pick=b.pick||{},pending=l.claims.filter(c=>c.status==='pending');
  const item=(kind,id,title,note,{fresh=false}={})=>`<button type="button" class="desk-item ${pick.kind===kind&&pick.id===id?'is-on':''}" data-action="brand-pick" data-kind="${kind}" data-id="${esc(id)}"><b>${esc(title)}</b><small>${esc(note)}</small>${fresh?'<span class="desk-state is-new">할 일</span>':''}</button>`;
  return `<nav class="desk-list" aria-label="고객 브랜드">
    <h2>연결 요청 <span class="mono">${pending.length}</span></h2>${pending.map(c=>item('claim',c.id,c.displayName||'이름 없음',`${c.projectTitle||'프로젝트'} · ${at(c.createdAt)}${idTail(c)}${c.stale?' · 다시 요청 필요':''}`,{fresh:!c.stale})).join('')||'<p class="desk-at">기다리는 요청이 없어요.</p>'}
    <h2>다시 쓰기 확인 <span class="mono">${l.reuseRequests.length}</span></h2>${l.reuseRequests.map(r=>item('reuse',r.projectId,r.title||'프로젝트',`${r.workspaceName} · ${r.personaName||'이름 없음'} · ${at(r.attachedAt)}`,{fresh:r.canConfirm&&r.usable})).join('')||'<p class="desk-at">확인할 의뢰가 없어요.</p>'}
    <h2>브랜드 <span class="mono">${l.workspaces.length}</span></h2>${l.workspaces.map(w=>item('workspace',w.id,w.name,`${w.status==='closed'?'닫힘 · ':''}회원 ${w.memberCount} · 모델 ${w.modelCount}${w.todoCount?` · 할 일 ${w.todoCount}`:''}`,{fresh:w.todoCount>0})).join('')||'<p class="desk-at">아직 브랜드가 없어요. 연결 요청을 승인하면 생겨요.</p>'}
    ${pending.length<l.claims.length?`<details class="desk-persona-more"><summary>정한 요청 ${l.claims.length-pending.length}</summary><ul class="desk-files">${l.claims.filter(c=>c.status!=='pending').map(c=>`<li>${esc(c.displayName||'이름 없음')} · ${esc(c.projectTitle)} · ${esc(claimNext(c))}${c.decidedBy?` · ${esc(c.decidedBy)}`:''}${c.note?` · ${esc(c.note)}`:''}</li>`).join('')}</ul></details>`:''}
  </nav>`;
}
function claimView(c,l){
  const manageable=(l.workspaces||[]).filter(w=>w.canManage&&w.status==='active');
  const approve=c.stale||c.status!=='pending'||!l.canWrite?'':c.linkedWorkspace?(c.linkedWorkspace.canManage?form('brand-claim',c.id+':approve',`data-claim="${esc(c.id)}" data-decision="approve"`,`<input type="hidden" name="mode" value="existing"><input type="hidden" name="workspaceId" value="${esc(c.linkedWorkspace.id)}"><label><span>역할</span><select name="role"><option value="admin">관리자(보관 동의 · 중지 · 삭제 요청까지)</option><option value="member">회원(보기 · 의뢰만)</option></select></label>${reason()}`,'승인 · 합류',{main:true}):'')
    :form('brand-claim',c.id+':approve',`data-claim="${esc(c.id)}" data-decision="approve"`,`<label><span>어디에 이을까요</span><select name="mode"><option value="new">새 브랜드 만들기</option>${manageable.length?'<option value="existing">기존 브랜드에 잇기</option>':''}</select></label>${input('name','새 브랜드 이름(새로 만들 때)',80)}${manageable.length?`<label><span>기존 브랜드(잇을 때)</span><select name="workspaceId"><option value="">고르기</option>${manageable.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></label>`:''}<label><span>역할</span><select name="role"><option value="admin">관리자(보관 동의 · 중지 · 삭제 요청까지)</option><option value="member">회원(보기 · 의뢰만)</option></select></label>${reason()}`,'승인 · 연결',{main:true});
  const reject=c.status==='pending'&&l.canWrite?more('거절하기',form('brand-claim',c.id+':reject',`data-claim="${esc(c.id)}" data-decision="reject"`,reason('거절 근거 한 줄'),'거절')):'';
  return `<p class="desk-kicker">연결 요청 · ${esc(at(c.createdAt))}</p><h1>${esc(c.displayName||'이름 없음')}</h1>
    <ul class="checks"><li><i class="led ${c.stale?'is-wait':'is-ok'}"></i><div><b>${esc(claimNext(c))}</b><small>이메일 · 회사명이 같아도 저절로 합치지 않아요. 확인한 근거를 한 줄로 남겨요(감사 기록).</small></div></li></ul>
    <dl class="kv"><div><dt>프로젝트</dt><dd>${esc(c.projectTitle||'')} <button type="button" class="btn-text" data-action="open-project" data-id="${esc(c.projectId)}">열기</button></dd></div><div><dt>지금 연결</dt><dd>${c.linkedWorkspace?`브랜드 「${esc(c.linkedWorkspace.name)}」(합류)`:'브랜드 없음(연결)'}</dd></div><div><dt>요청한 SYNK ID</dt><dd>${esc(c.displayName||'이름 없음')}${c.idHint?` <span class="mono">· ID …${esc(c.idHint)}</span>`:''}${noName(c.displayName)?'<small>SYNK ID 프로필에 표시 이름이 없는 계정이에요. 의뢰서의 담당자 이름 · 연락처와 ID 끝 네 자리로 맞춰 보세요.</small>':''}</dd></div></dl>
    ${approve}${reject}`;
}
function reuseView(r){
  const canGo=r.canConfirm&&r.usable&&(r.personaKind!=='real'||r.consentAllows);
  return `<p class="desk-kicker">다시 쓰기 의뢰 · 붙인 때 ${esc(at(r.attachedAt))}</p><h1>${esc(r.title||'프로젝트')}</h1>
    <ul class="checks"><li><i class="led ${canGo?'is-ok':'is-wait'}"></i><div><b>${esc(reuseNext(r))}</b><small>연결을 확인하기 전에는 손님 방에 인물이 열리지 않아요. 확인하면 이 프로젝트가 브랜드에 이어지고, 손님이 사용 범위를 확인해야 제작을 시작해요.</small></div></li></ul>
    <dl class="kv"><div><dt>프로젝트</dt><dd>${esc(r.title||'')} · ${esc(STAGE[r.stage]||r.stage)} · 담당 ${esc(r.ownerName||'없음')} <button type="button" class="btn-text" data-action="open-project" data-id="${esc(r.projectId)}">열기</button></dd></div><div><dt>브랜드</dt><dd>${esc(r.workspaceName)}</dd></div><div><dt>인물</dt><dd>${esc(r.personaName||'이름 없음')} · ${esc(KIND[r.personaKind]||'')}</dd></div><div><dt>다시 쓸 수 있나</dt><dd>${r.usable?'다시 쓸 수 있어요':esc(REASON[r.reason]||r.reason)}</dd></div>${r.personaKind==='real'?`<div><dt>당사자 동의</dt><dd>${r.consentAllows?'가장 최근 동의 기록이 광고 · 다시 쓰기를 허락해요 — 브랜드 · 지역 · 기간은 동의 증빙과 아래 사용 범위를 나란히 보고 근거에 적어요':'동의 기록이 다시 쓰기를 허락하지 않아요 — 새 당사자 동의를 받은 뒤 확인해요'}</dd></div>`:''}</dl>
    ${canGo?`<h2 class="desk-h">연결 확인 · 이번 광고 사용 범위</h2>${form('brand-project',r.projectId+':confirm',`data-project="${esc(r.projectId)}" data-action-name="confirm_request" data-revision="${r.projectRevision}"`,`${usageFields()}${reason()}`,'연결 확인 · 손님에게 보내기',{main:true})}`:''}`;
}
function personaRow(p,w){
  const refs=p.references||{projects:[],hidden:0,drafts:0},data=`data-persona="${esc(p.id)}" data-revision="${p.revision}"`;
  const act=(action,label,extra='')=>form('brand-persona',`${p.id}:${action}`,`${data} data-action-name="${action}"`,`${extra}${reason()}`,label);
  const actions=[
    w.canManage&&p.status==='ready'?more('사용 중지',act('pause','사용 중지','<p class="desk-at">바로 새 의뢰 · 연결 확인 · 사용 확인 · 제작 시작이 막혀요. 이미 집행 중인 광고는 손님과 따로 정해요.</p>')):'',
    w.isAdmin&&p.status==='paused'?more('사용 중지 풀기',act('unpause','중지 풀기','<p class="desk-at">풀면 다시 쓰기는 꺼진 채로 돌아가요 — 브랜드 관리자가 보관 동의를 새로 해야 다시 써요.</p>')):'',
    w.isAdmin&&p.status==='deleting'?act('delete_continue','삭제 이어 하기'):'',
    w.isAdmin&&p.status!=='deleting'?more('삭제',act('delete','지우기','<p class="desk-at">끝나지 않은 참조(원 프로젝트 · 다시 쓰기 의뢰 · 인물 참조 · 24시간 안의 초안 붙임)가 없을 때만 지워져요. 기록 · 승인 문서는 남고 그림 · 파일은 지워져요. 되돌릴 수 없어요.</p>')):'',
    w.isAdmin&&p.status!=='deleting'?more('귀속 취소(잘못 이은 경우)',act('unassign','귀속 취소','<p class="desk-at">이 브랜드에서 이 인물을 쓰는 끝나지 않은 다시 쓰기 의뢰가 없을 때만 돼요. 보관 동의는 철회로 남아요.</p>')):'',
  ].filter(Boolean).join('');
  const lines=[p.retention?.scope==='reuse'&&p.retention.until?`다시 쓰기 기한 ${dayOf(p.retention.until)}`:'다시 쓰기 꺼짐',p.deleteAt?`지우는 날 ${dayOf(p.deleteAt)}(연장하지 않으면)`:'',p.paused?`중지 ${at(p.paused.at)}${p.paused.note?` · ${p.paused.note}`:''}`:'',p.deletionRequest?`삭제 요청 ${at(p.deletionRequest.at)} · ${p.deletionRequest.name||''}${p.deletionRequest.note?` · ${p.deletionRequest.note}`:''}`:''].filter(Boolean);
  const refLine=refs.projects.length||refs.hidden||refs.drafts?`끝나지 않은 참조: ${[...refs.projects.map(item=>`${item.title}${item.origin?'(원 프로젝트)':''}`),refs.hidden?`볼 수 없는 프로젝트 ${refs.hidden}개`:'',refs.drafts?`초안 붙임 ${refs.drafts}개`:''].filter(Boolean).join(', ')}`:'끝나지 않은 참조 없음';
  return `<li><i class="led ${p.usable?'is-ok':'is-wait'}"></i><div><b>${esc(p.name||'이름 없음')} · ${esc(KIND[p.kind]||'')} · ${esc(STATUS[p.effective]||STATUS[p.status]||p.status)}</b><small>${esc(p.usable?'다시 쓸 수 있어요':REASON[p.reason]||p.reason)}${lines.length?` · ${esc(lines.join(' · '))}`:''}</small><small>${esc(refLine)}</small>${actions}</div></li>`;
}
function workspaceView(d,{projects=[]}={}){
  if(!d)return '<div class="loading" role="status"><span class="loading-mark"></span>브랜드를 불러오고 있어요.</div>';
  const w=d.workspace,can=w.canManage,active=w.status==='active',data=`data-workspace="${esc(w.id)}" data-revision="${w.revision}"`;
  // 이을 수 있는 프로젝트: 이 직원의 프로젝트 목록 가운데 아직 어느 브랜드에도 잇지 않았고 보관하지 않은 것(서버가 권한 · 판을 다시 본다).
  const linkable=projects.filter(item=>!item.customerWorkspaceId&&item.stage!=='archived'&&!w.projects.some(row=>row.id===item.id));
  return `<p class="desk-kicker">고객 브랜드 · ${active?'운영 중':`닫힘 ${esc(at(w.closedAt))}`} · 담당 ${esc(w.staffOwnerName||'없음')} · 만든 날 ${esc(dayOf(w.createdAt))}</p><h1>${esc(w.name)}</h1>
    <h2 class="desk-h">할 일 <span class="mono">${w.todos.length}</span></h2>${w.todos.length?`<ul class="checks">${w.todos.map(item=>`<li><i class="led is-wait"></i><div><b>${esc(item.name||'이름 없음')} — ${esc(TODO[todoWhy(item)]||item.why)}</b>${item.projects.length||item.hidden||item.drafts?`<small>${esc([...item.projects.map(row=>row.title),item.hidden?`볼 수 없는 프로젝트 ${item.hidden}개`:'',item.drafts?`초안 붙임 ${item.drafts}개(24시간 안에 풀려요)`:''].filter(Boolean).join(', '))}</small>`:''}</div></li>`).join('')}</ul>`:'<p class="desk-at">지금 할 일은 없어요.</p>'}
    <h2 class="desk-h">내 모델 인물 <span class="mono">${w.personas.length}</span></h2>${w.personas.length?`<ul class="checks">${w.personas.map(p=>personaRow(p,w)).join('')}</ul>`:'<p class="desk-at">아직 보관한 인물이 없어요. 브랜드 관리자가 손님 앱 「내 모델」에서 보관 동의를 하면 생겨요.</p>'}
    ${w.pending.length?`<h3 class="desk-h">보관 대기(브랜드 관리자의 동의를 기다림) <span class="mono">${w.pending.length}</span></h3><ul class="desk-files">${w.pending.map(p=>`<li>${esc(p.name||'이름 없음')} <button type="button" class="btn-text" data-action="open-project" data-id="${esc(p.originProjectId)}">원 프로젝트</button></li>`).join('')}</ul>`:''}
    <h2 class="desk-h">회원 <span class="mono">${w.members.length}</span></h2>${w.members.length?`<ul class="checks">${w.members.map(m=>`<li><i class="led is-ok"></i><div><b>${esc(m.displayName||'이름 없음')} · ${esc(ROLE[m.role]||m.role)}</b><small>${esc(at(m.addedAt))} · ${m.via==='claim'?'연결 요청 승인':'직원이 넣음'}${esc(idTail(m))}</small>${can?more('역할 바꾸기 · 빼기',`${form('brand-workspace',`${w.id}:role:${m.id}`,`${data} data-action-name="set_role" data-member="${esc(m.id)}"`,`<label><span>역할</span><select name="role"><option value="admin" ${m.role==='admin'?'selected':''}>관리자</option><option value="member" ${m.role==='member'?'selected':''}>회원</option></select></label>${reason()}`,'역할 저장')}${form('brand-workspace',`${w.id}:remove:${m.id}`,`${data} data-action-name="remove_member" data-member="${esc(m.id)}"`,reason('빼는 근거 한 줄'),'회원에서 빼기')}`):''}</div></li>`).join('')}</ul>`:'<p class="desk-at">회원이 없어요.</p>'}
    <h2 class="desk-h">연결된 프로젝트 <span class="mono">${w.projects.length}</span></h2>${w.projects.length?`<ul class="checks">${w.projects.map(row=>`<li><i class="led ${row.linked?'is-ok':'is-wait'}"></i><div><b>${esc(row.title)} · ${esc(STAGE[row.stage]||row.stage)}${row.linked?'':' · 연결 확인 전'}</b>${row.workspaceRequest?`<small>다시 쓰기 의뢰 · ${row.workspaceRequest.confirmedAt?`연결 확인 ${esc(at(row.workspaceRequest.confirmedAt))}`:'연결 확인 전'}</small>`:''}<small><button type="button" class="btn-text" data-action="open-project" data-id="${esc(row.id)}">열기</button></small>${can&&row.linked?more('연결 끊기',form('brand-project',`${row.id}:unlink`,`data-project="${esc(row.id)}" data-action-name="unlink" data-revision="${row.revision}"`,`<p class="desk-at">끊어도 이미 이 브랜드에 귀속된 인물은 그대로 남아요(원 프로젝트는 기록일 뿐).</p>${reason()}`,'연결 끊기')):''}${can&&row.workspaceRequest?.confirmedAt&&row.linked?more('이번 광고 사용 범위 고치기',form('brand-project',`${row.id}:usage`,`data-project="${esc(row.id)}" data-action-name="set_usage" data-revision="${row.revision}"`,`<p class="desk-at">고치면 손님이 새 범위를 다시 확인해야 제작을 시작해요.</p>${usageFields()}${reason()}`,'손님에게 다시 보내기')):''}</div></li>`).join('')}</ul>`:'<p class="desk-at">연결된 프로젝트가 없어요.</p>'}
    ${can&&active&&linkable.length?more('프로젝트 잇기',form('brand-project','link',`data-action-name="link"`,`<label><span>프로젝트</span><select name="projectId" required><option value="">고르기</option>${linkable.map(item=>`<option value="${esc(item.id)}" data-revision="${item.revision}">${esc(item.title)}</option>`).join('')}</select></label>${reason()}`,'이 브랜드에 잇기')):''}
    <h2 class="desk-h">브랜드</h2>${can&&active?more('브랜드 닫기',form('brand-workspace',`${w.id}:close`,`${data} data-action-name="close"`,`<p class="desk-at">닫으면 회원 경로 · 보관 대기 · 이 브랜드 인물의 다시 쓰기가 바로 막혀요. 다시 열기는 관리자만 해요.</p>${reason()}`,'브랜드 닫기')):''}${w.isAdmin&&!active?form('brand-workspace',`${w.id}:reopen`,`${data} data-action-name="reopen"`,reason(),'다시 열기'):''}${!can&&!w.isAdmin?'<p class="desk-at">이 브랜드는 담당이나 관리자만 바꿀 수 있어요.</p>':''}
    ${more(`기록 ${w.history.length}줄`,`<ul class="desk-files">${[...w.history].reverse().map(entry=>`<li>${esc(at(entry.at))} · ${esc(HISTORY[entry.action]||entry.action)} · ${({member:'손님',system:'자동'})[entry.actorKind]||'직원'}${entry.note?` · ${esc(entry.note)}`:''}</li>`).join('')}</ul>`)}`;
}
// b: {list, pick:{kind,id}, detail} — 목록은 GET /api/customer-workspaces, 브랜드는 GET /api/customer-workspaces/<id>. projects: 직원 프로젝트 목록(잇기 고르기).
export function brandDesk(b,{top='',projects=[]}={}){
  const l=b.list;
  if(!l)return '<div class="loading" role="status"><span class="loading-mark"></span>고객 브랜드를 불러오고 있어요.</div>';
  const pick=b.pick||{},claim=pick.kind==='claim'&&l.claims.find(c=>c.id===pick.id),reuse=pick.kind==='reuse'&&l.reuseRequests.find(r=>r.projectId===pick.id);
  const body=claim?claimView(claim,l):reuse?reuseView(reuse):pick.kind==='workspace'?workspaceView(b.detail,{projects}):'<p class="desk-kicker">고객 브랜드</p><h1>왼쪽에서 하나를 골라요</h1><p class="desk-at">연결 요청은 손님이 고객 방에서 「내 모델로 모아 두기」를 누르면 생겨요. 다시 쓰기 의뢰는 손님이 「내 모델」에서 「이 모델로 의뢰」로 보내면 생겨요.</p>';
  return `<div class="desk is-brands"><div class="desk-grid is-brands">${nav(b)}<div class="desk-brief">${top}${body}</div></div></div>`;
}
