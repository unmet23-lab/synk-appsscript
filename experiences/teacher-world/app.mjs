import {createPersonalizationUI} from './personalization-ui.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={unseen:'기록이 더 필요해요',checking:'확인 중',practice:'추가 연습',review:'다시 확인',supported:'도움 받아 수행', 'recent-independent':'최근 독립 수행'};
const statusText={assigned:'진행 중',submitted:'제출 완료',completed:'제출 완료',cancelled:'취소'};
let workspace,classId,learnerId,view='students',revision=0,automaticInstructions=null;
let linked=false,teacherToken='',authEpoch=0,pollTimer=null,pollLoading=false,workspaceReady=false,accessEpoch=0,draftContext=null;
const tokenKey='synk.teacher.local-linked.session';
const accountRequested=new URL(location.href).searchParams.get('account')==='1';
let accountHost=null;
const tokenStorage={get(){try{return sessionStorage.getItem(tokenKey)||'';}catch{return '';}},set(value){try{if(value)sessionStorage.setItem(tokenKey,value);else sessionStorage.removeItem(tokenKey);}catch{}}};
const personalUI=createPersonalizationUI({role:'teacher',container:$('personalization-panel'),button:$('personalization-button'),onChange:load,onView:()=>{const template=personalUI.state?.assignmentTemplates?.find(t=>t.classId===classId&&t.learnerId===learnerId);if(template)openAssignment();else toast('선택한 학생의 추천은 이 과제 체험에서 아직 지원하지 않아요. 학생의 학습 근거를 먼저 확인해 주세요.');}});
const classNow=()=>workspace?.classes.find(c=>c.id===classId);
const learners=()=>classNow()?.learners||[];
const studentNow=()=>learners().find(s=>s.id===learnerId);
const date=value=>value?new Date(value).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}):'기록 없음';
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4200);}
const messages={OVERRIDE_REASON_REQUIRED:'추천과 다른 과제를 배정하는 이유를 짧게 적어 주세요.',AUTH_NOT_CONFIGURED:'정식 로그인은 아직 연결되지 않았어요.',FORBIDDEN:'이 학생의 수업 권한을 확인할 수 없어요.',INVALID_DUE_AT:'오늘 이후의 마감일을 골라 주세요.',INVALID_DUE_DATE:'오늘 이후의 마감일을 골라 주세요.',DUPLICATE_ASSIGNMENT:'이미 같은 과제가 진행 중이에요.',ASSIGNMENT_CLOSED:'이미 제출되거나 취소된 과제예요.',SERVER_ERROR:'저장하지 못했어요. 잠시 후 다시 시도해 주세요.'};
Object.assign(messages,{AUTH_REQUIRED:'교사 연결 키를 확인한 뒤 다시 연결해 주세요.',RATE_LIMITED:'연결 시도가 많아요. 잠시 기다린 뒤 다시 시도해 주세요.',LEARNING_DISABLED:'학생이 WORLD 연결과 기록 공유에 동의한 뒤 과제를 보낼 수 있어요.',INVALID_INPUT:'입력한 내용을 확인해 주세요.'});
async function request(path,payload){
  if(accountRequested){
    if(!accountHost||window.parent===window||window.parent.SYNKClassroomHost!==accountHost)throw Object.assign(Error('SYNK ID의 수업 연결에서 다시 열어 주세요.'),{code:'SESSION_CHANGED'});
    const epoch=authEpoch,access=accessEpoch;if(payload&&!workspaceReady)throw Error('최신 연결 상태를 확인한 뒤 다시 시도해 주세요.');
    const result=await accountHost.request(path,payload);
    if(epoch!==authEpoch||payload&&access!==accessEpoch||window.parent.SYNKClassroomHost!==accountHost)throw Object.assign(Error('수업 연결이 바뀌었어요.'),{code:'SESSION_CHANGED'});
    return result;
  }
  const epoch=authEpoch,token=teacherToken,access=accessEpoch,guardedWrite=linked&&payload&&!['/api/teacher/session','/api/logout'].includes(path);
  if(linked&&!token&&path!=='/api/teacher/session')throw Error('교사 공간을 먼저 연결해 주세요.');
  if(guardedWrite&&!workspaceReady)throw Error('최신 연결 상태를 확인한 뒤 다시 시도해 주세요.');
  const headers={...(linked&&token?{Authorization:`Bearer ${token}`}:{})};
  if(payload){headers['Content-Type']='application/json';if(!linked)headers['X-SYNK-Preview-Token']=workspace?._token||'';}
  const response=await fetch(path,{cache:'no-store',headers,...(payload?{method:'POST',body:JSON.stringify(payload)}:{})});const result=await response.json();
  if(epoch!==authEpoch||guardedWrite&&access!==accessEpoch)throw Object.assign(Error('연결 상태가 바뀌었어요.'),{code:'SESSION_CHANGED'});
  if(!response.ok||result.ok===false){if(linked&&response.status===401&&path!=='/api/teacher/session')clearSession('교사 연결이 종료됐어요. 연결 키로 다시 열어 주세요.');throw Error(messages[result.code]||({REVISION_CONFLICT:'기록이 바뀌었어요. 새로고침한 뒤 다시 시도해 주세요.',SHARING_DISABLED:'학생의 기록 공유가 종료됐어요.',LINK_REVOKED:'학생 연결이 해제됐어요.',INVALID_NAME:'학생이 사용할 이름을 입력해 주세요.'})[result.code]||`처리하지 못했어요. (${result.code||response.status})`);}
  return result;
}
function clearSession(message='교사 연결을 종료했어요.'){
  authEpoch++;revision++;teacherToken='';tokenStorage.set('');workspace=null;workspaceReady=false;accessEpoch++;clearDraft();classId=null;learnerId=null;clearInterval(pollTimer);pollTimer=null;personalUI.invalidate();
  for(const id of ['summary','view-students','view-assignments','view-review','world-connections','personalization-button','teacher-logout','loading'])$(id).hidden=true;
  for(const id of ['roster','student-detail','assignments','observations','world-link-result','class-select'])$(id).replaceChildren();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  $('world-link-result').hidden=true;$('teacher-key').value='';$('teacher-session').hidden=false;$('teacher-session-error').textContent=message;document.documentElement.dataset.ready='auth';
}
function setMode(){
  if(accountRequested){$('mode-badge').textContent='SYNK ID · 수업 연결';$('mode-note').textContent='서버가 확인한 담당 반의 공유된 학습 기록과 과제입니다. 학생의 공유 상태와 교사 권한을 요청할 때마다 확인해요.';for(const id of ['personalization-button','world-connections','teacher-logout','teacher-session'])$(id).hidden=true;return;}
  $('mode-badge').textContent=linked?'WORLD 연결 · 로컬 MVP':'예시 데이터 · 로컬 MVP';
  $('mode-note').textContent=linked?'학생이 동의한 WORLD 기록과 과제를 이 기기의 교사 공간에 연결해요. 정식 SYNK 로그인·다른 기기 동기화는 아직 제공하지 않아요.':'가상의 학생으로 과제 왕복을 체험하는 개발판이에요. 실제 SYNK ID·학생 계정과 연결되지 않았어요.';
  $('personalization-button').hidden=linked;$('world-connections').hidden=!linked||!teacherToken||!workspaceReady;$('teacher-logout').hidden=!linked||!teacherToken;$('teacher-session').hidden=!linked||!!teacherToken;
}
function setPersonalization(){if(linked){personalUI.invalidate();return;}personalUI.set(workspace.personalization,{owner:workspace.teacher.id,classId,endpoint:'/api/personalization',token:workspace._token});}
function clearDraft(){
  draftContext=null;editingAssignment=null;automaticInstructions=null;assignmentAttempt=null;noteAttempt=null;
  for(const id of ['assignment-dialog','note-dialog'])$(id).close();
  for(const id of ['assignment-form','note-form']){$(id).reset();$(id).querySelector('[type=submit]').disabled=true;}
  for(const id of ['assignment-student','note-student','content-description','assignment-error','note-error'])$(id).textContent='';
  for(const id of ['content-select','note-skill'])$(id).replaceChildren();
}
function draftAllowed(kind){
  if(!linked)return true;if(!workspaceReady||!draftContext||draftContext.kind!==kind)return false;
  const cls=workspace.classes.find(c=>c.id===draftContext.classId),student=cls?.learners.find(s=>s.id===draftContext.learnerId);
  if(!student||student.revoked||!student.connectedAt||!student.sharing?.enabled||student.sharing.revision!==draftContext.sharingRevision)return false;
  if(draftContext.assignmentId){const assignment=workspace.assignments.find(a=>a.id===draftContext.assignmentId);if(!assignment||!['active','assigned'].includes(assignment.status)||assignment.revision!==draftContext.assignmentRevision)return false;}
  return true;
}
function captureDraft(kind,assignment=null){const student=studentNow();draftContext={kind,classId,learnerId,sharingRevision:student?.sharing?.revision,assignmentId:assignment?.id,assignmentRevision:assignment?.revision};}
function suspendWorkspace(){
  workspaceReady=false;accessEpoch++;workspace=null;clearDraft();personalUI.invalidate();
  for(const id of ['summary','view-students','view-assignments','view-review','world-connections'])$(id).hidden=true;
  for(const id of ['summary','roster','student-detail','assignments','observations','world-link-result','class-select'])$(id).replaceChildren();
  $('world-learner-name').value='';$('world-link-result').hidden=true;$('class-title').textContent='학생과 학습';$('assignment-count').textContent='0';document.documentElement.dataset.ready='blocked';
}
function watchConnected(){if(!linked||pollTimer)return;pollTimer=setInterval(async()=>{if(pollLoading||!teacherToken||document.visibilityState==='hidden')return;pollLoading=true;try{await load();}finally{pollLoading=false;}},5000);}
async function load(){const current=++revision;try{
  const data=await request('/api/workspace');if(current!==revision)return;
  if(linked&&data.mode!==(accountRequested?'account-linked':'local-linked'))throw Error('연결된 교사 공간을 확인하지 못했어요.');
  workspace=data;workspaceReady=true;if(linked&&draftContext&&!draftAllowed(draftContext.kind)){accessEpoch++;clearDraft();toast('학생의 공유 또는 과제 상태가 바뀌어 작성 창을 닫았어요. 최신 내용을 확인해 주세요.');}workspace.assignments=workspace.assignments.map(a=>({...a,status:a.status==='cancelled'?'cancelled':a.completedCount>=a.assignedCount?'submitted':'assigned',submission:a.submissions?.[0]}));classId=workspace.classes.some(c=>c.id===classId)?classId:workspace.classes[0]?.id;learnerId=learners().some(s=>s.id===learnerId)?learnerId:learners()[0]?.id;$('class-select').innerHTML=workspace.classes.map(c=>`<option value="${escape(c.id)}">${escape(c.name.replace(' · 합성',''))}</option>`).join('');$('class-select').value=classId||'';$('loading').hidden=true;setMode();setPersonalization();render();watchConnected();document.documentElement.dataset.ready='true';
}catch(e){if(current!==revision||e.code==='SESSION_CHANGED')return;if(linked){suspendWorkspace();watchConnected();}$('loading').hidden=false;$('loading').innerHTML=`<p>${escape(e.message)}</p><button class="text-button" id="retry">다시 불러오기</button>`;$('retry').onclick=load;}}
async function openSession(key){const epoch=authEpoch;const result=await request('/api/teacher/session',{key});if(epoch!==authEpoch)return;if(typeof result.token!=='string'||!result.token)throw Error('교사 연결을 확인하지 못했어요.');authEpoch++;teacherToken=result.token;tokenStorage.set(teacherToken);$('teacher-key').value='';$('teacher-session-error').textContent='';setMode();await load();}
async function start(){
  if(accountRequested){try{if(window.parent===window||window.parent.location.origin!==location.origin||window.parent.SYNKClassroomHost?.mode!=='account-linked')throw Error('SYNK ID의 수업 연결에서 교사 공간을 열어 주세요.');accountHost=window.parent.SYNKClassroomHost;linked=true;teacherToken='account-session';setMode();await load();}catch(error){$('loading').textContent=error.message;document.documentElement.dataset.ready='error';}return;}
  const initial=new URL(location.href),key=new URLSearchParams(initial.hash.slice(1)).get('teacher-key');
  if(key){initial.hash='';history.replaceState(null,'',initial.pathname+initial.search);}
  try{const response=await fetch('/api/health',{cache:'no-store'}),health=await response.json();if(!response.ok)throw Error('교사 연결 상태를 확인하지 못했어요.');linked=health.mode==='local-linked';setMode();
    if(linked){teacherToken=tokenStorage.get();if(key){await openSession(key);return;}if(!teacherToken){clearSession('');return;}}
    await load();
  }catch(error){if(linked)clearSession(error.message);else{$('loading').textContent=error.message;document.documentElement.dataset.ready='error';}}
}
function render(){
  const cls=classNow();if(!cls){$('summary').hidden=true;for(const name of ['students','assignments','review'])$('view-'+name).hidden=true;return;}
  $('summary').hidden=false;const assignments=(workspace.assignments||[]).filter(a=>a.classId===classId);const active=assignments.filter(a=>a.status==='assigned');const submitted=assignments.filter(a=>['submitted','completed'].includes(a.status));const needs=learners().filter(s=>s.skills.some(k=>['practice','supported','review'].includes(k.status))).length;
  $('summary').innerHTML=[[learners().length,'함께 배우는 학생'],[needs,'다음 도움 살펴보기'],[active.length,'진행 중인 과제'],[submitted.length,'제출된 과제']].map(([n,label])=>`<div class="summary-item"><strong>${n}</strong><span>${label}</span></div>`).join('');
  $('assignment-count').textContent=active.length;$('class-title').textContent=cls.name;
  for(const name of ['students','assignments','review'])$('view-'+name).hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  renderRoster();renderDetail();renderAssignments(assignments);renderObservations();
}
function renderRoster(){const query=$('student-search').value.trim().toLowerCase();const rows=learners().filter(s=>s.name.toLowerCase().includes(query));$('roster').innerHTML=rows.length?rows.map(s=>`<button class="student-row ${s.id===learnerId?'selected':''}" data-student="${escape(s.id)}" aria-pressed="${s.id===learnerId}"><span class="avatar">${escape(s.name.slice(0,1))}</span><span class="student-copy"><strong>${escape(s.name)}</strong><small>${escape(linked&&s.revoked?'WORLD 연결 해제':linked&&!s.connectedAt?'WORLD 연결 대기':linked&&!s.sharing?.enabled?'기록 공유 종료':s.recommendation?.title||'먼저 학습 기록을 확인해요')}</small></span><span class="arrow">↗</span></button>`).join(''):`<p class="empty">${query?'검색한 학생이 없어요.':linked?'연결된 학생이 아직 없어요. 위에서 학생 이름을 입력하고 WORLD 연결 코드를 만들어 주세요.':'검색한 학생이 없어요.'}</p>`;}
function renderDetail(){const s=studentNow();if(!s){$('student-detail').innerHTML=`<p class="empty">${linked?'학생이 연결에 동의한 뒤 이곳에서 학습 기록과 다음 과제를 살펴볼 수 있어요.':'학생을 선택해 주세요.'}</p>`;return;}const rec=s.recommendation;const skills=s.skills.filter(k=>k.n||k.status!=='unseen');const shown=skills.length?skills:s.skills.slice(0,3);const selectedContent=workspace.content.find(c=>c.id===rec?.contentId);const canAssign=!linked||(!s.revoked&&s.connectedAt&&s.sharing?.enabled===true);$('student-detail').innerHTML=`
  <div class="detail-header"><span class="avatar">${escape(s.name.slice(0,1))}</span><div><h3>${escape(s.name)}</h3><p>${escape(classNow().name)}${linked?'':' · 예시 학생'}</p></div><button class="text-button" id="add-note" ${canAssign?'':'disabled'}>관찰 +</button></div>
  ${linked?`<div class="student-connection"><strong>${s.revoked?'WORLD 연결 해제':s.connectedAt?(s.sharing?.enabled?'WORLD 연결됨 · 기록 공유 중':'기록 공유 종료'):'학생의 연결 동의를 기다리고 있어요'}</strong><p class="help">연결 ${escape(date(s.connectedAt))} · 마지막 수행 ${escape(date(s.lastEventAt))}</p><p class="help">공유 범위: 학습 문항 수행과 이 수업의 과제 결과</p>${!accountRequested&&!s.revoked&&(s.sharing?.enabled||!s.connectedAt)?`<button class="text-button" data-revoke="${escape(s.id)}">학생 연결 해제</button>`:''}</div>`:''}
  <p class="goal">학습 목표 · ${escape(s.goal||'TOPIK I 듣기·읽기 연습')}</p><div class="evidence-title"><h3>학습 근거</h3><span>최근 독립 수행 기준</span></div>
  ${shown.map(k=>`<div class="skill-row"><strong>${escape(k.label)}</strong><span class="skill-number">${k.n?`${k.correct} / ${k.n}`:'—'}</span><small>${escape(labels[k.status]||k.status)} · ${k.n?'정답 / 독립 문항':''} ${escape(date(k.lastAt))}<br>${escape(({'independent-language-items':'독립 언어 문항','assisted-language-items':'도움 받은 언어 문항','insufficient-evidence':'아직 근거 부족'})[k.source]||'WORLD 학습 기록')} ${k.freshness==='stale'?'· 오래된 기록':''}</small></div>`).join('')}
  ${linked?`<p class="help">읽기 응답은 서버에서 채점해요. 미니게임 기록은 게임이 보고한 언어 응답이며 서버 독립 채점과 구분해 살펴봐요.</p>`:''}
  <div class="recommendation"><span class="small-label">다음 수업을 위한 제안</span><h3>${escape(rec?.title||'읽기부터 가볍게 확인해요')}</h3><p>${escape(rec?.reason||'아직 판단할 학습 기록이 충분하지 않아요.')}</p></div>
  ${rec?.assignable===false?`<p class="help">이 추천 콘텐츠의 과제 연결은 준비 중이에요. 지금은 아래에서 배정 가능한 읽기 연습을 고를 수 있어요.</p>`:''}
  <button class="felt-button primary" id="assign" ${canAssign?'':'disabled'}>${canAssign?(selectedContent?.assignable===false?'다른 연습 골라 보내기':'검토하고 과제 보내기'):'학생의 WORLD 연결이 필요해요'} →</button>
  <div class="detail-links">${linked?'<span class="help">학생은 자신의 WORLD 앱에서 과제를 받아요.</span>':`<a href="/student?learner=${encodeURIComponent(s.id)}">이 학생의 WORLD 과제 체험 ↗</a>`}<button class="text-button" id="view-student-assignments">보낸 과제 보기</button></div>
  <p class="source-note">${linked?'동의 후 공유된 WORLD 수행 기록과 이 수업의 과제 결과를 사용해요.':'예시 수행 기록과 현재 과제 결과를 사용해요.'} 게임 조작 속도·리듬 점수는 한국어 실력으로 계산하지 않아요.</p>`;}
function renderAssignments(rows){const filter=$('assignment-filter').value;rows=rows.filter(a=>filter==='all'||a.status===filter||(filter==='submitted'&&a.status==='completed'));$('assignments').innerHTML=rows.length?[...rows].reverse().map(a=>{const names=a.learnerIds?.map(id=>learners().find(s=>s.id===id)?.name||id).join(', ')||learners().find(s=>s.id===a.learnerId)?.name||'';const submission=a.submission||a.result;return `<article class="assignment-card"><header><div><p class="small-label">${escape(names)} · 마감 ${escape(date(a.dueAt))}</p><h3>${escape(a.title)}</h3></div><span class="status">${escape(statusText[a.status]||a.status)}</span></header><p>${escape(a.reason||a.instructions||'선생님이 고른 읽기 연습이에요.')}</p>${Object.values(a.targets||{}).length?`<p class="help assignment-target">${Object.values(a.targets).map(t=>escape(t.description)).join(' / ')}</p>`:''}${submission?`<p><strong>제출 결과</strong> · ${escape(submission.correct??submission.score?.correct??'')} / ${escape(submission.total??submission.score?.total??'')}문항</p>${submission.grading==='game-reported'?`<p class="help">게임 응답 기록 · 혼자 푼 새 문항 ${Number(submission.independent)||0} · 도움 ${Number(submission.assisted)||0}. 서버 독립 채점과 구분합니다.</p>`:''}`:''}${a.kind==='game'&&!submission?`<p class="help">${a.runs?.length?`수행 중 · ${Math.max(...a.runs.map(r=>r.progress?.total||0))} / ${a.requiredAttempts}문항`:'WORLD에서 시작을 기다리고 있어요.'} · 실제 문항 응답으로 완료를 확인합니다.</p>`:''}<div class="assignment-actions">${a.status==='assigned'?`${linked?'<span class="help">WORLD 과제함으로 전달됨</span>':`<a href="/student?learner=${encodeURIComponent(a.learnerId||a.learnerIds?.[0]||'')}">학생 과제 체험 ↗</a>`}<button class="text-button" data-edit="${escape(a.id)}">내용 수정</button><button class="text-button" data-cancel="${escape(a.id)}">배정 취소</button>`:''}<span class="help">${escape(date(a.createdAt))} 배정</span></div>${a.status==='submitted'||a.status==='completed'?'<p class="help">이 과제에서의 수행 기록이에요. 실력 향상이나 TOPIK 합격을 뜻하지 않아요.</p>':''}</article>`;}).join(''):'<p class="empty">아직 이 상태의 과제가 없어요. 학생에게 필요한 연습을 골라 보내 보세요.</p>';}
function renderObservations(){const notes=learners().flatMap(s=>(s.observations||[]).map(o=>({...o,name:s.name}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));$('observations').innerHTML=notes.length?notes.map(o=>`<article class="observation-card"><h3>${escape(o.name)}</h3><small>${escape(o.label)} · ${escape(date(o.at))} · 교사 관찰</small><p>${escape(o.note||o.text)}</p></article>`).join(''):'<p class="empty">학생 상세의 ‘관찰 +’에서 수업 중 발견한 것을 남겨 주세요.</p>';}
let editingAssignment=null,assignmentAttempt=null,noteAttempt=null,assignmentTarget=null;
function retryKey(kind,payload){const fingerprint=JSON.stringify(payload);let saved=kind==='assignment'?assignmentAttempt:noteAttempt;if(!saved||saved.fingerprint!==fingerprint)saved={fingerprint,key:crypto.randomUUID()};if(kind==='assignment')assignmentAttempt=saved;else noteAttempt=saved;return saved.key;}
function instructionForContent(contentId){const student=studentNow();if(contentId!==student?.recommendation?.contentId)return '';const personal=personalUI.state?.status==='active'?personalUI.state:null;return personal?.assignmentTemplates?.find(t=>t.classId===classId&&t.learnerId===learnerId&&t.contentId===contentId)?.reason||[personal?.benefit?.instructions,student.recommendation?.reason].filter(Boolean).join(' ').slice(0,500);}
function describeContent(){const c=workspace.content.find(c=>c.id===$('content-select').value),target=editingAssignment?.targets?.[learnerId]||studentNow()?.gameTargets?.[c?.id];assignmentTarget=target?{skillId:target.skillId,difficulty:target.difficulty,responseFormat:target.responseFormat}:null;$('content-description').textContent=c?`${c.modality==='reading'?'읽기':'듣기'} · ${target?.description||c.note||c.description||'과제의 실제 응답을 기록해 다음 연습에 반영해요.'}`:'';if(!editingAssignment){$('assignment-title').value=c?.title||'';const instructions=$('assignment-form').elements.instructions;if(automaticInstructions!==null&&instructions.value===automaticInstructions){instructions.value=instructionForContent(c?.id);automaticInstructions=instructions.value;}instructions.placeholder=c?.id!==studentNow()?.recommendation?.contentId?'추천과 다른 과제를 선택한 이유와 학생에게 전할 안내를 적어 주세요.':'어떻게 풀면 좋을지 짧게 알려 주세요.';}}
function openAssignment(existing=null){const s=studentNow();if(!s||linked&&(!workspaceReady||s.revoked||!s.connectedAt||!s.sharing?.enabled))return;captureDraft('assignment',existing);editingAssignment=existing;automaticInstructions=null;assignmentAttempt=null;$('assignment-form').reset();$('assignment-error').textContent='';$('assignment-dialog-title').textContent=existing?'보낸 과제 수정':'다음 연습 보내기';$('assignment-student').textContent=`${s.name} 학생 · ${classNow().name}`;$('content-select').innerHTML=workspace.content.filter(c=>c.assignable).map(c=>`<option value="${escape(c.id)}">${escape(c.title)}</option>`).join('');$('content-select').value=existing?.contentId||s.recommendation?.contentId;if(!$('content-select').value)$('content-select').selectedIndex=0;$('content-select').disabled=!!existing;describeContent();const personalization=personalUI.state;const template=personalization?.status==='active'?personalization.assignmentTemplates?.find(t=>t.classId===classId&&t.learnerId===learnerId&&t.contentId===$('content-select').value):null;const benefit=personalization?.status==='active'?personalization.benefit:{};const due=new Date(Date.now()+(template?.defaultAssignmentDays||benefit?.defaultAssignmentDays||3)*86400000);$('assignment-due').value=existing?.dueAt?.slice(0,10)||due.toISOString().slice(0,10);$('assignment-due').min=new Date().toISOString().slice(0,10);$('assignment-title').value=existing?.title||workspace.content.find(c=>c.id===$('content-select').value)?.title||'';$('assignment-form').elements.instructions.value=existing?.reason??instructionForContent($('content-select').value);automaticInstructions=existing?null:$('assignment-form').elements.instructions.value;$('assignment-form').querySelector('[type=submit]').textContent=existing?'수정 저장하기':'학생에게 과제 보내기 →';$('assignment-form').querySelector('[type=submit]').disabled=false;$('assignment-dialog').showModal();}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.id==='teacher-logout'){button.disabled=true;try{await request('/api/logout',{});clearSession();}catch(error){if(error.code!=='SESSION_CHANGED')clearSession('이 화면의 연결은 종료했어요. 서버 연결 종료를 확인하지 못했으니 다시 열 때 연결 키를 사용해 주세요.');}finally{button.disabled=false;}return;}
  if(button.dataset.revoke){const student=learners().find(s=>s.id===button.dataset.revoke);if(!student)return;button.disabled=true;try{await request('/api/links/revoke',{learnerId:student.id,revision:student.sharing?.revision});$('world-link-result').hidden=true;$('world-link-result').replaceChildren();await load();toast('학생 연결을 해제했어요. 더 이상 기록이나 과제를 공유하지 않아요.');}catch(error){if(error.code!=='SESSION_CHANGED')toast(error.message);button.disabled=false;}return;}
  if(button.dataset.view){view=button.dataset.view;render();}
  if(button.dataset.student){learnerId=button.dataset.student;renderRoster();renderDetail();}
  if(button.id==='assign')openAssignment();
  if(button.id==='add-note'){if(!studentNow()||linked&&(!workspaceReady||!studentNow().sharing?.enabled||studentNow().revoked))return;captureDraft('note');$('note-form').querySelector('[type=submit]').disabled=false;noteAttempt=null;$('note-form').reset();const noteStudent=studentNow();$('note-skill').innerHTML=noteStudent.skills.map(k=>`<option value="${escape(k.id)}">${escape(k.label)}</option>`).join('');$('note-skill').value=noteStudent.recommendation?.skillId||noteStudent.skills[0]?.id;$('note-error').textContent='';$('note-student').textContent=studentNow().name;$('note-dialog').showModal();}
  if(button.id==='view-student-assignments'){view='assignments';render();}
  if(button.classList.contains('close-dialog'))button.closest('dialog').close();
  if(button.dataset.edit){const a=workspace.assignments.find(a=>a.id===button.dataset.edit);learnerId=a.learnerId||a.learnerIds?.[0];openAssignment(a);}
  if(button.dataset.cancel){button.disabled=true;try{await request('/api/assignments/cancel',{assignmentId:button.dataset.cancel,reason:'교사가 배정을 취소했어요.',...(linked?{revision:workspace.assignments.find(a=>a.id===button.dataset.cancel)?.revision}:{})});await load();toast('과제 배정을 취소했어요.');}catch(e){toast(e.message);button.disabled=false;}}
});
$('teacher-session-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;$('teacher-session-error').textContent='';try{await openSession($('teacher-key').value.trim());}catch(error){if(error.code!=='SESSION_CHANGED')$('teacher-session-error').textContent=error.message;}finally{button.disabled=false;}});
$('world-link-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!linked||!workspace||!classId)return;const button=event.submitter;button.disabled=true;$('world-link-error').textContent='';
  try{const result=await request('/api/links',{classId,name:$('world-learner-name').value.trim()});
    if(typeof result.code!=='string'||!result.code)throw Error('연결 코드를 확인하지 못했어요. 새로고침해서 학생 목록을 확인해 주세요.');
    $('world-link-result').innerHTML=`<strong>학생에게 이 코드를 알려 주세요.</strong><label for="world-join-code">한 번만 사용하는 연결 코드<input id="world-join-code" value="${escape(result.code)}" readonly autocomplete="off"></label><p class="help">${escape(new Date(result.expiresAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}))}까지 사용 가능해요. 학생의 WORLD 앱에서 ‘수업 연결’을 열고, 공유 범위를 확인한 뒤 입력해 주세요.</p>`;
    $('world-link-result').hidden=false;$('world-learner-name').value='';learnerId=result.learnerId;await load();
  }catch(error){if(error.code!=='SESSION_CHANGED')$('world-link-error').textContent=error.message;}finally{button.disabled=false;}
});
$('assignment-form').addEventListener('submit',async event=>{event.preventDefault();if(!draftAllowed('assignment'))return;const button=event.submitter;button.disabled=true;$('assignment-error').textContent='';const values=new FormData(event.target);try{const payload={title:values.get('title'),dueAt:new Date(values.get('dueDate')+'T23:59:59+09:00').toISOString(),reason:values.get('instructions')};if(editingAssignment)await request('/api/assignments/update',{...payload,assignmentId:editingAssignment.id,revision:editingAssignment.revision});else{const creation={...payload,classId,learnerIds:[learnerId],contentId:values.get('contentId')};if(assignmentTarget)creation.target={...assignmentTarget};await request('/api/assignments',{...creation,idempotencyKey:retryKey('assignment',creation)});}assignmentAttempt=null;$('assignment-dialog').close();view='assignments';await load();toast(editingAssignment?'과제를 수정했어요.':linked?'학생의 WORLD 과제함으로 보냈어요.':'과제를 보냈어요. 학생 과제 체험에서 확인할 수 있어요.');}catch(e){$('assignment-error').textContent=e.message;}finally{button.disabled=false;}});
$('note-form').addEventListener('submit',async event=>{event.preventDefault();if(!draftAllowed('note'))return;const button=event.submitter;button.disabled=true;try{const data=new FormData(event.target),payload={learnerId,classId,skillId:data.get('skillId'),note:data.get('text')};await request('/api/observations',{...payload,idempotencyKey:retryKey('note',payload)});noteAttempt=null;$('note-dialog').close();await load();toast('관찰을 저장했어요.');}catch(e){$('note-error').textContent=e.message;}finally{button.disabled=false;}});
$('class-select').onchange=()=>{classId=$('class-select').value;learnerId=learners()[0]?.id;setPersonalization();render();};$('student-search').oninput=renderRoster;$('assignment-filter').onchange=()=>render();$('content-select').onchange=describeContent;$('refresh').onclick=load;window.addEventListener('focus',()=>{if(linked?!!teacherToken:workspace&&!document.querySelector('dialog[open]'))load();});start();
