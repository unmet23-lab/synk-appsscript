import {createPersonalizationUI} from './personalization-ui.mjs';
import {learnerOverview,careDateValue,careDueAt,compareTeacherRows} from './workspace-overview.mjs';
import {applySharingFence} from './sharing-fence.mjs';
import {mountHomeworkReview} from './homework-review.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={unseen:'기록이 더 필요해요',checking:'확인 중',practice:'추가 연습',review:'다시 확인',supported:'도움 받아 수행', 'recent-independent':'최근 독립 수행'};
const statusText={assigned:'진행 중',submitted:'제출 완료',completed:'제출 완료',cancelled:'취소'};
let workspace,classId,learnerId,view='students',revision=0,automaticInstructions=null;
let linked=false,teacherToken='',authEpoch=0,pollTimer=null,pollLoading=false,workspaceReady=false,accessEpoch=0,draftContext=null;
const tokenKey='synk.teacher.local-linked.session';
const accountRequested=new URL(location.href).searchParams.get('account')==='1';
let accountHost=null,parentSharingMetadata=null;
const tokenStorage={get(){try{return sessionStorage.getItem(tokenKey)||'';}catch{return '';}},set(value){try{if(value)sessionStorage.setItem(tokenKey,value);else sessionStorage.removeItem(tokenKey);}catch{}}};
const personalUI=createPersonalizationUI({role:'teacher',container:$('personalization-panel'),button:$('personalization-button'),onChange:load,onView:()=>{const template=personalUI.state?.assignmentTemplates?.find(t=>t.classId===classId&&t.learnerId===learnerId);if(template)openAssignment();else toast('선택한 학생의 추천은 이 과제 체험에서 아직 지원하지 않아요. 학생의 학습 근거를 먼저 확인해 주세요.');}});
// 과제 첨삭(04)은 SYNK ID 수업 연결(계정 모드)에서만 연다. 교사 과제 경로는 synk-classroom에만 있다.
const homework=mountHomeworkReview({root:$('homework-review'),request,onCount:n=>{$('homework-count').textContent=String(n);$('homework-count').hidden=!n;}});
const classNow=()=>workspace?.classes.find(c=>c.id===classId);
const learners=()=>classNow()?.learners||[];
const studentNow=()=>learners().find(s=>s.id===learnerId);
const date=value=>value?new Date(value).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}):'기록 없음';
const dateTime=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'기록 없음';
const studentLinked=student=>student?.accountConnected===true||student?.accountConnected!==false&&!!student?.connectedAt;
const careFor=student=>!student?[]:(student.careTasks||student.care||workspace?.care||[]).filter(task=>task.learnerId===student.id&&task.classId===classId&&(!Number.isSafeInteger(student.sharing?.revision)||task.sharingRevision===student.sharing.revision));
function renderStudentActivity(student){
  if(!linked)return '';
  const summary=learnerOverview(student),world=student.activity?.world,town=student.activity?.town;
  return `<section class="student-activity"><h3>최근 WORLD · TOWN 기록</h3><p class="help">현재 접속을 추정하지 않고, 서버가 마지막으로 받은 기록과 시간을 표시해요.</p><div class="student-activity-grid"><article><strong>WORLD · ${escape(summary.worldText)}</strong><p>마지막 기록 · ${escape(dateTime(summary.worldAt))}</p><p class="help">${world?.status==='shared'?'게임·과제의 응답 기록이에요. 활동량은 한국어 실력 점수가 아니에요.':'공유된 WORLD 활동 기록이 확인되면 표시해요.'}</p></article><article><strong>TOWN · ${escape(summary.townText)}</strong><p>마지막 기록 · ${escape(dateTime(summary.townAt))}</p><p class="help">${town?.status==='shared'?'우리 반 학원 마을에서 동의 후 공유한 생활 활동이에요. 학습 평가에서 제외해요.':'생활 활동은 별도로 공유에 동의한 범위만 확인해요.'}${town?.capacityReached?' 현재 동의 범위의 활동 기록 상한에 도달했어요.':''}</p></article></div></section>`;
}
function renderStudentCare(student,canAssign){
  if(!linked)return '';
  const tasks=student.sharing?.enabled?careFor(student):[],assignees=(workspace.careAssignees||[]).filter(row=>!Array.isArray(row.classIds)||row.classIds.includes(classId)),canCare=canAssign&&assignees.length>0;
  return `<section class="student-care"><header><div><h3>다음 케어와 후속 처리</h3><p class="help">담당자·기한·진행 상태를 정해 수업의 다음 행동으로 이어가요.</p></div><button class="felt-button" id="add-care" ${canCare?'':'disabled'}>케어 할 일 +</button></header>${!student.sharing?.enabled?'<p class="help">학생의 학습 공유가 켜진 뒤 수업 케어를 기록할 수 있어요.</p>':!assignees.length?'<p class="help">이 수업의 케어 담당 교사 연결을 확인하고 있어요.</p>':''}${tasks.length?tasks.map(task=>`<article class="care-task" data-care-id="${escape(task.id)}"><div><strong>${escape(task.title)}</strong><span>${escape(({'open':'예정','in-progress':'처리 중','done':'완료'})[task.status]||task.status)}</span></div><p>${escape(assignees.find(row=>row.id===task.assigneeId)?.name||'담당자 확인 필요')} · ${escape(dateTime(task.dueAt))}까지</p>${task.note?`<p class="care-task-note">${escape(task.note)}</p>`:''}<button class="text-button" data-care-edit="${escape(task.id)}" ${canCare?'':'disabled'}>담당자·기한·상태 수정</button></article>`).join(''):'<p class="help">등록된 케어 할 일이 없어요. 필요한 학생에게 다음 처리 일을 정해 주세요.</p>'}</section>`;
}
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
  for(const id of ['summary','view-students','view-assignments','view-review','view-homework','world-connections','personalization-button','teacher-logout','loading'])$(id).hidden=true;homework.reset();
  for(const id of ['roster','student-detail','assignments','observations','world-link-result','class-select'])$(id).replaceChildren();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  $('world-link-result').hidden=true;$('teacher-key').value='';$('teacher-session').hidden=false;$('teacher-session-error').textContent=message;document.documentElement.dataset.ready='auth';
}
// workspace.synk.im 주소로 직접 열면 이 서버의 /api/workspace는 회사 업무 자료라 로그인 없이는 401이다.
// 수업은 「내 수업」 탭의 SYNK ID 연결 안에서만 열리므로, 오류 대신 그 탭으로 가는 길을 안내한다.
function showWorkspaceEntry(){
  for(const id of ['summary','view-students','view-assignments','view-review','view-homework','homework-nav','world-connections','teacher-session','teacher-logout','personalization-button','mode-note','mode-badge','refresh'])$(id).hidden=true;
  $('loading').hidden=false;$('loading').innerHTML='<p>내 수업은 SYNK Workspace의 「내 수업」 탭에서 열려요.</p><p><a class="felt-button primary" id="open-workspace" href="/?tab=teaching" target="_top">내 수업 열기</a></p>';
  document.documentElement.dataset.ready='workspace-entry';
}
function setMode(){
  $('homework-nav').hidden=!accountRequested;
  if(accountRequested){$('mode-badge').textContent='SYNK ID · 수업 연결';$('mode-note').textContent='서버가 확인한 담당 반의 공유된 학습 기록과 과제입니다. 학생의 공유 상태와 교사 권한을 요청할 때마다 확인해요.';for(const id of ['personalization-button','world-connections','teacher-logout','teacher-session'])$(id).hidden=true;return;}
  $('mode-badge').textContent=linked?'WORLD 연결 · 로컬 MVP':'예시 데이터 · 로컬 MVP';
  $('mode-note').textContent=linked?'학생이 동의한 WORLD 기록과 과제를 이 기기의 교사 공간에 연결해요. 정식 SYNK 로그인·다른 기기 동기화는 아직 제공하지 않아요.':'가상의 학생으로 과제 왕복을 체험하는 개발판이에요. 실제 SYNK ID·학생 계정과 연결되지 않았어요.';
  $('personalization-button').hidden=linked;$('world-connections').hidden=!linked||!teacherToken||!workspaceReady;$('teacher-logout').hidden=!linked||!teacherToken;$('teacher-session').hidden=!linked||!!teacherToken;
}
function setPersonalization(){if(linked){personalUI.invalidate();return;}personalUI.set(workspace.personalization,{owner:workspace.teacher.id,classId,endpoint:'/api/personalization',token:workspace._token});}
function clearDraft(){
  draftContext=null;editingAssignment=null;editingCare=null;automaticInstructions=null;assignmentAttempt=null;noteAttempt=null;careAttempt=null;
  for(const id of ['assignment-dialog','note-dialog','care-dialog','student-invite-dialog'])$(id).close();
  clearInvite();
  for(const id of ['assignment-form','note-form','care-form']){$(id).reset();$(id).querySelector('[type=submit]').disabled=true;}
  for(const id of ['assignment-student','note-student','content-description','assignment-error','note-error'])$(id).textContent='';
  for(const id of ['content-select','note-skill'])$(id).replaceChildren();
}
function draftAllowed(kind){
  if(!linked)return true;if(!workspaceReady||!draftContext||draftContext.kind!==kind)return false;
  const cls=workspace.classes.find(c=>c.id===draftContext.classId),student=cls?.learners.find(s=>s.id===draftContext.learnerId);
  if(kind==='enrollment')return accountRequested&&classId===draftContext.classId&&learnerId===draftContext.learnerId&&!!student&&!student.revoked&&!studentLinked(student);
  if(!student||student.revoked||!studentLinked(student)||!student.sharing?.enabled||student.sharing.revision!==draftContext.sharingRevision)return false;
  if(draftContext.assignmentId){const assignment=workspace.assignments.find(a=>a.id===draftContext.assignmentId);if(!assignment||!['active','assigned'].includes(assignment.status)||assignment.revision!==draftContext.assignmentRevision)return false;}
  if(draftContext.careId){const care=careFor(student).find(task=>task.id===draftContext.careId);if(!care||care.revision!==draftContext.careRevision)return false;}
  return true;
}
function captureDraft(kind,record=null){const student=studentNow();draftContext={kind,classId,learnerId,sharingRevision:student?.sharing?.revision,...(kind==='assignment'?{assignmentId:record?.id,assignmentRevision:record?.revision}:{}),...(kind==='care'?{careId:record?.id,careRevision:record?.revision}:{})};}
function clearInvite(){for(const id of ['student-invite-student','student-invite-expiry','student-invite-error'])$(id).textContent='';$('student-invite-code').value='';$('student-invite-copy').disabled=true;}
async function openInvite(){
  const student=studentNow();if(!accountRequested||!workspaceReady||!student||student.revoked||studentLinked(student))return;
  clearDraft();captureDraft('enrollment');const context=draftContext,version=accessEpoch;
  $('student-invite-student').textContent=student.name+' 학생 · '+classNow().name;$('student-invite-expiry').textContent='연결 코드를 만들고 있어요.';
  accountHost?.focusWorkspace?.();$('student-invite-dialog').showModal();
  try{
    const result=await request('/api/teacher/invites',{learnerId:context.learnerId});
    if(version!==accessEpoch||draftContext!==context||!draftAllowed('enrollment')||!$('student-invite-dialog').open)return;
    if(!/^[A-Za-z0-9_-]{22,128}$/.test(result.invite?.token||'')||!Number.isFinite(Date.parse(result.invite?.expiresAt)))throw Error('발급 결과를 확인하지 못했어요. 창을 닫고 새 코드를 만들어 주세요.');
    $('student-invite-code').value=result.invite.token;$('student-invite-copy').disabled=false;
    $('student-invite-expiry').textContent=dateTime(result.invite.expiresAt)+'까지 한 번 사용할 수 있어요.';
  }catch(error){if(version===accessEpoch&&draftContext===context&&$('student-invite-dialog').open){$('student-invite-expiry').textContent='';$('student-invite-error').textContent=error.message;}}
}
function suspendWorkspace(){
  workspaceReady=false;accessEpoch++;workspace=null;clearDraft();personalUI.invalidate();
  // 과제 첨삭 판은 숨기기만 한다(잠깐의 읽기 실패로 쓰던 첨삭을 잃지 않게). 비우는 것은 연결 종료(clearSession) 때다.
  for(const id of ['summary','view-students','view-assignments','view-review','view-homework','world-connections'])$(id).hidden=true;
  for(const id of ['summary','roster','student-detail','assignments','observations','world-link-result','class-select'])$(id).replaceChildren();
  $('world-learner-name').value='';$('world-link-result').hidden=true;$('class-title').textContent='학생과 학습';$('assignment-count').textContent='0';document.documentElement.dataset.ready='blocked';
}
function watchConnected(){if(!linked||pollTimer)return;pollTimer=setInterval(async()=>{if(pollLoading||!teacherToken||document.visibilityState==='hidden')return;pollLoading=true;try{await load();}finally{pollLoading=false;}},5000);}
async function load({retrySnapshot=true}={}){const current=++revision;try{
  let data=await request('/api/workspace');if(current!==revision)return;
  if(linked&&data.mode!==(accountRequested?'account-linked':'local-linked'))throw Error('연결된 교사 공간을 확인하지 못했어요.');
  if(accountRequested)data=applySharingFence(data,parentSharingMetadata).workspace;
  workspace={...data,classes:data.classes.map(row=>({...row,learners:[...(row.learners||[])].sort(compareTeacherRows)})).sort(compareTeacherRows)};workspaceReady=true;if(linked&&draftContext&&!draftAllowed(draftContext.kind)){accessEpoch++;clearDraft();toast('학생의 공유 또는 과제 상태가 바뀌어 작성 창을 닫았어요. 최신 내용을 확인해 주세요.');}workspace.assignments=workspace.assignments.map(a=>({...a,status:a.status==='cancelled'?'cancelled':a.completedCount>=a.assignedCount?'submitted':'assigned',submission:a.submissions?.[0]}));classId=workspace.classes.some(c=>c.id===classId)?classId:workspace.classes[0]?.id;const requestedLearner=accountRequested&&window.parent.SYNKClassroomSelection?.classId===classId?window.parent.SYNKClassroomSelection.learnerId:null;learnerId=learners().some(s=>s.id===requestedLearner)?requestedLearner:learners().some(s=>s.id===learnerId)?learnerId:learners()[0]?.id;$('class-select').innerHTML=workspace.classes.map(c=>`<option value="${escape(c.id)}">${escape(c.name.replace(' · 합성',''))}</option>`).join('');$('class-select').value=classId||'';$('loading').hidden=true;setMode();setPersonalization();render();watchConnected();document.documentElement.dataset.ready='true';
}catch(e){if(current!==revision||e.code==='SESSION_CHANGED')return;if(e.code==='CLASSROOM_SNAPSHOT_CHANGED'&&retrySnapshot)return load({retrySnapshot:false});if(linked){suspendWorkspace();watchConnected();}$('loading').hidden=false;$('loading').innerHTML=`<p>${escape(e.message)}</p><button class="text-button" id="retry">다시 불러오기</button>`;$('retry').onclick=load;}}
async function openSession(key){const epoch=authEpoch;const result=await request('/api/teacher/session',{key});if(epoch!==authEpoch)return;if(typeof result.token!=='string'||!result.token)throw Error('교사 연결을 확인하지 못했어요.');authEpoch++;teacherToken=result.token;tokenStorage.set(teacherToken);$('teacher-key').value='';$('teacher-session-error').textContent='';setMode();await load();}
async function start(){
  if(accountRequested){try{if(window.parent===window||window.parent.location.origin!==location.origin||window.parent.SYNKClassroomHost?.mode!=='account-linked')throw Error('SYNK ID의 수업 연결에서 교사 공간을 열어 주세요.');accountHost=window.parent.SYNKClassroomHost;linked=true;teacherToken='account-session';setMode();await load();
    // Focus only the first explicit overview selection. Later polling and draft
    // updates keep the teacher's reading position.
    const selection=window.parent.SYNKClassroomSelection;
    if(workspaceReady&&selection?.classId===classId&&selection.learnerId&&selection.learnerId===learnerId){
      await document.fonts.ready;
      if(window.parent.SYNKClassroomHost===accountHost&&window.parent.SYNKClassroomSelection===selection&&workspaceReady&&view==='students'&&!document.querySelector('dialog[open]')){
        accountHost.focusWorkspace?.();$('student-detail').scrollIntoView({block:'start',behavior:'instant'});
      }
    }
    if(workspaceReady&&learnerId)window.parent.postMessage({type:'synk-teacher-selected',classId,learnerId},location.origin);
  }catch(error){$('loading').textContent=error.message;document.documentElement.dataset.ready='error';}return;}
  const initial=new URL(location.href),key=new URLSearchParams(initial.hash.slice(1)).get('teacher-key');
  if(key){initial.hash='';history.replaceState(null,'',initial.pathname+initial.search);}
  try{const response=await fetch('/api/health',{cache:'no-store'}),health=await response.json();if(!response.ok)throw Error('교사 연결 상태를 확인하지 못했어요.');if(health.app==='synk-company'){showWorkspaceEntry();return;}linked=health.mode==='local-linked';setMode();
    if(linked){teacherToken=tokenStorage.get();if(key){await openSession(key);return;}if(!teacherToken){clearSession('');return;}}
    await load();
  }catch(error){if(linked)clearSession(error.message);else{$('loading').textContent=error.message;document.documentElement.dataset.ready='error';}}
}
function render(){
  const cls=classNow();if(!cls){$('summary').hidden=true;for(const name of ['students','assignments','review','homework'])$('view-'+name).hidden=true;return;}
  if(view==='homework'&&!accountRequested)view='students';
  $('summary').hidden=view==='homework';const assignments=(workspace.assignments||[]).filter(a=>a.classId===classId);const active=assignments.filter(a=>a.status==='assigned');const submitted=assignments.filter(a=>['submitted','completed'].includes(a.status));const needs=learners().filter(s=>s.skills.some(k=>['practice','supported','review'].includes(k.status))).length;
  $('summary').innerHTML=[[learners().length,'함께 배우는 학생'],[needs,'다음 도움 살펴보기'],[active.length,'진행 중인 과제'],[submitted.length,'제출된 과제']].map(([n,label])=>`<div class="summary-item"><strong>${n}</strong><span>${label}</span></div>`).join('');
  $('assignment-count').textContent=active.length;$('class-title').textContent=cls.name;
  for(const name of ['students','assignments','review','homework'])$('view-'+name).hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  renderRoster();renderDetail();renderAssignments(assignments);renderObservations();if(view==='homework')homework.show(classId);else if(accountRequested)homework.peek(classId);
}
function renderRoster(){const query=$('student-search').value.trim().toLowerCase();const rows=learners().filter(s=>s.name.toLowerCase().includes(query));$('roster').innerHTML=rows.length?rows.map(s=>`<button class="student-row ${s.id===learnerId?'selected':''}" data-student="${escape(s.id)}" aria-pressed="${s.id===learnerId}"><span class="avatar">${escape(s.name.slice(0,1))}</span><span class="student-copy"><strong>${escape(s.name)}</strong><small>${escape(linked&&learnerOverview(s).sharing==='revoked'?'WORLD 연결 해제':linked&&!studentLinked(s)?'계정 연결 대기':linked&&!s.sharing?.enabled?'학습 공유 안 함':s.recommendation?.title||'먼저 학습 기록을 확인해요')}</small></span><span class="arrow">↗</span></button>`).join(''):`<p class="empty">${query?'검색한 학생이 없어요.':linked?'연결된 학생이 아직 없어요. 위에서 학생 이름을 입력하고 WORLD 연결 코드를 만들어 주세요.':'검색한 학생이 없어요.'}</p>`;}
function renderDetail(){const s=studentNow();if(!s){$('student-detail').innerHTML=`<p class="empty">${linked?'학생이 연결에 동의한 뒤 이곳에서 학습 기록과 다음 과제를 살펴볼 수 있어요.':'학생을 선택해 주세요.'}</p>`;return;}const canSeeEvidence=!linked||(!s.revoked&&studentLinked(s)&&s.sharing?.enabled===true),rec=canSeeEvidence?s.recommendation:null;const skills=canSeeEvidence?s.skills.filter(k=>k.n||k.status!=='unseen'):[];const shown=skills.length?skills:canSeeEvidence?s.skills.slice(0,3):[];const selectedContent=workspace.content.find(c=>c.id===rec?.contentId);const canAssign=!linked||(workspaceReady&&!s.revoked&&studentLinked(s)&&s.sharing?.enabled===true);$('student-detail').innerHTML=`
  <div class="detail-header"><span class="avatar">${escape(s.name.slice(0,1))}</span><div><h3>${escape(s.name)}</h3><p>${escape(classNow().name)}${linked?'':' · 예시 학생'}</p></div><button class="text-button" id="add-note" ${canAssign?'':'disabled'}>관찰 +</button></div>
  ${linked?`<div class="student-connection"><strong>${learnerOverview(s).sharing==='revoked'?'WORLD 연결 해제':studentLinked(s)?(s.sharing?.enabled?'WORLD 계정 연결됨 · 학습 공유 중':'WORLD 계정 연결됨 · 학습 공유 안 함'):'학생의 계정 연결을 기다리고 있어요'}</strong><p class="help">학습 공유 시작 ${escape(date(s.sharing?.since||s.connectedAt))} · 마지막 수행 ${escape(date(s.lastEventAt))}</p><p class="help">공유 범위: 학습 문항 수행과 이 수업의 과제 결과</p>${accountRequested&&!s.revoked&&!studentLinked(s)?'<button class="felt-button" id="student-invite">학생 연결 코드 만들기</button>':''}${!accountRequested&&!s.revoked&&(s.sharing?.enabled||!s.connectedAt)?`<button class="text-button" data-revoke="${escape(s.id)}">학생 연결 해제</button>`:''}</div>`:''}
  ${renderStudentActivity(s)}
  <p class="goal">학습 목표 · ${escape(s.goal||'TOPIK I 듣기·읽기 연습')}</p><div class="evidence-title"><h3>학습 근거</h3><span>최근 독립 수행 기준</span></div>
  ${!canSeeEvidence?'<p class="help">학생이 공유에 동의한 학습 근거를 확인할 수 없는 상태예요. 이 상태로 학습 약점을 판단하지 않아요.</p>':''}
  ${shown.map(k=>`<div class="skill-row"><strong>${escape(k.label)}</strong><span class="skill-number">${k.n?`${k.correct} / ${k.n}`:'—'}</span><small>${escape(labels[k.status]||k.status)} · ${k.n?'정답 / 독립 문항':''} ${escape(date(k.lastAt))}<br>${escape(({'independent-language-items':'독립 언어 문항','assisted-language-items':'도움 받은 언어 문항','insufficient-evidence':'아직 근거 부족'})[k.source]||'WORLD 학습 기록')} ${k.freshness==='stale'?'· 오래된 기록':''}</small></div>`).join('')}
  ${linked?`<p class="help">읽기 응답은 서버에서 채점해요. 미니게임 기록은 게임이 보고한 언어 응답이며 서버 독립 채점과 구분해 살펴봐요.</p>`:''}
  <div class="recommendation"><span class="small-label">다음 수업을 위한 제안</span><h3>${escape(rec?.title||(canSeeEvidence?'읽기부터 가볍게 확인해요':'학생의 학습 공유를 먼저 확인해요'))}</h3><p>${escape(rec?.reason||(canSeeEvidence?'아직 판단할 학습 기록이 충분하지 않아요.':'공유되지 않은 기록을 학습 부족으로 판단하지 않아요.'))}</p></div>
  ${rec?.assignable===false?`<p class="help">이 추천 콘텐츠의 과제 연결은 준비 중이에요. 지금은 아래에서 배정 가능한 읽기 연습을 고를 수 있어요.</p>`:''}
  <button class="felt-button primary" id="assign" ${canAssign?'':'disabled'}>${canAssign?(selectedContent?.assignable===false?'다른 연습 골라 보내기':'검토하고 과제 보내기'):'학생의 WORLD 연결이 필요해요'} →</button>
  <div class="detail-links">${linked?'<span class="help">학생은 자신의 WORLD 앱에서 과제를 받아요.</span>':`<a href="/student?learner=${encodeURIComponent(s.id)}">이 학생의 WORLD 과제 체험 ↗</a>`}<button class="text-button" id="view-student-assignments">보낸 과제 보기</button></div>
  ${renderStudentCare(s,canAssign)}
  ${linked?'<p class="help student-scope-note">현재는 듣기·읽기 문항과 과제 근거를 연결해요. 회화·쓰기의 수행 평가는 아직 이 화면에 연결되지 않았어요.</p>':''}
  <p class="source-note">${linked?'동의 후 공유된 WORLD 수행 기록과 이 수업의 과제 결과를 사용해요.':'예시 수행 기록과 현재 과제 결과를 사용해요.'} 게임 조작 속도·리듬 점수는 한국어 실력으로 계산하지 않아요.</p>`;}
function renderAssignments(rows){const filter=$('assignment-filter').value;rows=rows.filter(a=>filter==='all'||a.status===filter||(filter==='submitted'&&a.status==='completed'));$('assignments').innerHTML=rows.length?[...rows].reverse().map(a=>{const names=a.learnerIds?.map(id=>learners().find(s=>s.id===id)?.name||id).join(', ')||learners().find(s=>s.id===a.learnerId)?.name||'';const submission=a.submission||a.result;return `<article class="assignment-card"><header><div><p class="small-label">${escape(names)} · 마감 ${escape(date(a.dueAt))}</p><h3>${escape(a.title)}</h3></div><span class="status">${escape(statusText[a.status]||a.status)}</span></header><p>${escape(a.reason||a.instructions||'선생님이 고른 읽기 연습이에요.')}</p>${Object.values(a.targets||{}).length?`<p class="help assignment-target">${Object.values(a.targets).map(t=>escape(t.description)).join(' / ')}</p>`:''}${submission?`<p><strong>제출 결과</strong> · ${escape(submission.correct??submission.score?.correct??'')} / ${escape(submission.total??submission.score?.total??'')}문항</p>${submission.grading==='game-reported'?`<p class="help">게임 응답 기록 · 혼자 푼 새 문항 ${Number(submission.independent)||0} · 도움 ${Number(submission.assisted)||0}. 서버 독립 채점과 구분합니다.</p>`:''}`:''}${a.kind==='game'&&!submission?`<p class="help">${a.runs?.length?`수행 중 · ${Math.max(...a.runs.map(r=>r.progress?.total||0))} / ${a.requiredAttempts}문항`:'WORLD에서 시작을 기다리고 있어요.'} · 실제 문항 응답으로 완료를 확인합니다.</p>`:''}<div class="assignment-actions">${a.status==='assigned'?`${linked?'<span class="help">WORLD 과제함으로 전달됨</span>':`<a href="/student?learner=${encodeURIComponent(a.learnerId||a.learnerIds?.[0]||'')}">학생 과제 체험 ↗</a>`}<button class="text-button" data-edit="${escape(a.id)}">내용 수정</button><button class="text-button" data-cancel="${escape(a.id)}">배정 취소</button>`:''}<span class="help">${escape(date(a.createdAt))} 배정</span></div>${a.status==='submitted'||a.status==='completed'?'<p class="help">이 과제에서의 수행 기록이에요. 실력 향상이나 TOPIK 합격을 뜻하지 않아요.</p>':''}</article>`;}).join(''):'<p class="empty">아직 이 상태의 과제가 없어요. 학생에게 필요한 연습을 골라 보내 보세요.</p>';}
function renderObservations(){const notes=learners().flatMap(s=>(s.observations||[]).map(o=>({...o,name:s.name}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));$('observations').innerHTML=notes.length?notes.map(o=>`<article class="observation-card"><h3>${escape(o.name)}</h3><small>${escape(o.label)} · ${escape(date(o.at))} · 교사 관찰</small><p>${escape(o.note||o.text)}</p></article>`).join(''):'<p class="empty">학생 상세의 ‘관찰 +’에서 수업 중 발견한 것을 남겨 주세요.</p>';}
let editingAssignment=null,editingCare=null,assignmentAttempt=null,noteAttempt=null,careAttempt=null,assignmentTarget=null;
function retryKey(kind,payload){const fingerprint=JSON.stringify(payload);let saved=kind==='assignment'?assignmentAttempt:kind==='care'?careAttempt:noteAttempt;if(!saved||saved.fingerprint!==fingerprint)saved={fingerprint,key:crypto.randomUUID()};if(kind==='assignment')assignmentAttempt=saved;else if(kind==='care')careAttempt=saved;else noteAttempt=saved;return saved.key;}
function openCare(existing=null){
  const student=studentNow(),assignees=(workspace?.careAssignees||[]).filter(row=>!Array.isArray(row.classIds)||row.classIds.includes(classId));
  if(!linked||!student||!workspaceReady||student.revoked||!studentLinked(student)||!student.sharing?.enabled||!assignees.length)return;
  captureDraft('care',existing);editingCare=existing;careAttempt=null;$('care-form').reset();$('care-error').textContent='';$('care-dialog-title').textContent=existing?'케어 할 일 수정':'다음 케어 정하기';$('care-student').textContent=student.name+' 학생 · '+classNow().name;
  $('care-title').value=existing?.title||'';$('care-assignee').innerHTML=assignees.map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('');$('care-assignee').value=existing?.assigneeId||assignees[0].id;
  $('care-due').value=existing?.dueAt?careDateValue(existing.dueAt):careDateValue(Date.now()+3*86400000);$('care-status').value=existing?.status||'open';$('care-form').elements.note.value=existing?.note||'';$('care-form').querySelector('[type=submit]').disabled=false;accountHost?.focusWorkspace?.();$('care-dialog').showModal();
}
function instructionForContent(contentId){const student=studentNow();if(contentId!==student?.recommendation?.contentId)return '';const personal=personalUI.state?.status==='active'?personalUI.state:null;return personal?.assignmentTemplates?.find(t=>t.classId===classId&&t.learnerId===learnerId&&t.contentId===contentId)?.reason||[personal?.benefit?.instructions,student.recommendation?.reason].filter(Boolean).join(' ').slice(0,500);}
function describeContent(){const c=workspace.content.find(c=>c.id===$('content-select').value),target=editingAssignment?.targets?.[learnerId]||studentNow()?.gameTargets?.[c?.id];assignmentTarget=target?{skillId:target.skillId,difficulty:target.difficulty,responseFormat:target.responseFormat}:null;$('content-description').textContent=c?`${c.modality==='reading'?'읽기':'듣기'} · ${target?.description||c.note||c.description||'과제의 실제 응답을 기록해 다음 연습에 반영해요.'}`:'';if(!editingAssignment){$('assignment-title').value=c?.title||'';const instructions=$('assignment-form').elements.instructions;if(automaticInstructions!==null&&instructions.value===automaticInstructions){instructions.value=instructionForContent(c?.id);automaticInstructions=instructions.value;}instructions.placeholder=c?.id!==studentNow()?.recommendation?.contentId?'추천과 다른 과제를 선택한 이유와 학생에게 전할 안내를 적어 주세요.':'어떻게 풀면 좋을지 짧게 알려 주세요.';}}
function openAssignment(existing=null){const s=studentNow();if(!s||linked&&(!workspaceReady||s.revoked||!studentLinked(s)||!s.sharing?.enabled))return;captureDraft('assignment',existing);editingAssignment=existing;automaticInstructions=null;assignmentAttempt=null;$('assignment-form').reset();$('assignment-error').textContent='';$('assignment-dialog-title').textContent=existing?'보낸 과제 수정':'다음 연습 보내기';$('assignment-student').textContent=`${s.name} 학생 · ${classNow().name}`;$('content-select').innerHTML=workspace.content.filter(c=>c.assignable).map(c=>`<option value="${escape(c.id)}">${escape(c.title)}</option>`).join('');$('content-select').value=existing?.contentId||s.recommendation?.contentId;if(!$('content-select').value)$('content-select').selectedIndex=0;$('content-select').disabled=!!existing;describeContent();const personalization=personalUI.state;const template=personalization?.status==='active'?personalization.assignmentTemplates?.find(t=>t.classId===classId&&t.learnerId===learnerId&&t.contentId===$('content-select').value):null;const benefit=personalization?.status==='active'?personalization.benefit:{};const due=new Date(Date.now()+(template?.defaultAssignmentDays||benefit?.defaultAssignmentDays||3)*86400000);$('assignment-due').value=existing?.dueAt?.slice(0,10)||due.toISOString().slice(0,10);$('assignment-due').min=new Date().toISOString().slice(0,10);$('assignment-title').value=existing?.title||workspace.content.find(c=>c.id===$('content-select').value)?.title||'';$('assignment-form').elements.instructions.value=existing?.reason??instructionForContent($('content-select').value);automaticInstructions=existing?null:$('assignment-form').elements.instructions.value;$('assignment-form').querySelector('[type=submit]').textContent=existing?'수정 저장하기':'학생에게 과제 보내기 →';$('assignment-form').querySelector('[type=submit]').disabled=false;accountHost?.focusWorkspace?.();$('assignment-dialog').showModal();}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.id==='teacher-logout'){button.disabled=true;try{await request('/api/logout',{});clearSession();}catch(error){if(error.code!=='SESSION_CHANGED')clearSession('이 화면의 연결은 종료했어요. 서버 연결 종료를 확인하지 못했으니 다시 열 때 연결 키를 사용해 주세요.');}finally{button.disabled=false;}return;}
  if(button.dataset.revoke){const student=learners().find(s=>s.id===button.dataset.revoke);if(!student)return;button.disabled=true;try{await request('/api/links/revoke',{learnerId:student.id,revision:student.sharing?.revision});$('world-link-result').hidden=true;$('world-link-result').replaceChildren();await load();toast('학생 연결을 해제했어요. 더 이상 기록이나 과제를 공유하지 않아요.');}catch(error){if(error.code!=='SESSION_CHANGED')toast(error.message);button.disabled=false;}return;}
  if(button.dataset.view){view=button.dataset.view;render();}
  if(button.dataset.student){if(!learners().some(student=>student.id===button.dataset.student))return;accessEpoch++;clearDraft();learnerId=button.dataset.student;renderRoster();renderDetail();if(accountRequested)window.parent.postMessage({type:'synk-teacher-selected',classId,learnerId},location.origin);}
  if(button.id==='student-invite')await openInvite();
  if(button.id==='student-invite-copy'&&draftAllowed('enrollment')){try{await navigator.clipboard.writeText($('student-invite-code').value);toast('연결 코드를 복사했어요. 해당 학생에게 전달해 주세요.');}catch{$('student-invite-code').select();toast('코드를 선택했어요. 복사해서 전달해 주세요.');}}
  if(button.id==='assign')openAssignment();
  if(button.id==='add-care')openCare();
  if(button.dataset.careEdit){const task=careFor(studentNow()).find(row=>row.id===button.dataset.careEdit);if(task)openCare(task);}
  if(button.id==='add-note'){if(!studentNow()||linked&&(!workspaceReady||!studentNow().sharing?.enabled||studentNow().revoked))return;captureDraft('note');$('note-form').querySelector('[type=submit]').disabled=false;noteAttempt=null;$('note-form').reset();const noteStudent=studentNow();$('note-skill').innerHTML=noteStudent.skills.map(k=>`<option value="${escape(k.id)}">${escape(k.label)}</option>`).join('');$('note-skill').value=noteStudent.recommendation?.skillId||noteStudent.skills[0]?.id;$('note-error').textContent='';$('note-student').textContent=studentNow().name;accountHost?.focusWorkspace?.();$('note-dialog').showModal();}
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
 $('care-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!draftAllowed('care'))return;const version=accessEpoch,button=event.submitter||event.target.querySelector('[type=submit]');button.disabled=true;$('care-error').textContent='';
  try{
    const values=new FormData(event.target),payload={learnerId,title:values.get('title'),note:values.get('note'),assigneeId:values.get('assigneeId'),dueAt:careDueAt(values.get('dueDate')),status:values.get('status'),...(editingCare?{id:editingCare.id,revision:editingCare.revision}:{})};
    await request('/api/teacher/care',{...payload,idempotencyKey:retryKey('care',payload)});if(version!==accessEpoch)return;careAttempt=null;$('care-dialog').close();await load();toast(editingCare?'케어 할 일을 수정했어요.':'담당자와 기한을 정해 케어 할 일을 남겼어요.');
  }catch(error){if(version===accessEpoch&&error.code!=='SESSION_CHANGED')$('care-error').textContent=error.message;}finally{if(version===accessEpoch)button.disabled=false;}
 });
 // 부모(계정 포털)가 확인한 반 학생 모두의 공유 상태로 이 판을 그 자리에서 거른다. 바뀐 학생의 기록과 그 학생의 공유에 묶인 작성 창은 바로 닫고,
 // 명부 기준인 과제 첨삭은 그대로 둔다. 걸렀으면(판을 아직 못 읽었으면 다음 읽기부터 거른다) true — 부모는 이 답을 받아야 iframe을 다시 만들지 않는다.
 function applyParentSharing(target,latest){
  if(!accountRequested||!accountHost||window.parent.SYNKClassroomHost!==accountHost||target!==accountHost.classId||!Array.isArray(latest)||latest.some(row=>typeof row?.id!=='string'||!Number.isSafeInteger(row.revision)||typeof row.enabled!=='boolean'||typeof row.connected!=='boolean'||typeof row.revoked!=='boolean'))return false;
  parentSharingMetadata=latest;if(!workspace)return true;
  const fenced=applySharingFence(workspace,parentSharingMetadata);if(!fenced.changedLearnerIds.length)return true;
  workspace=fenced.workspace;revision++;
  if(draftContext&&!draftAllowed(draftContext.kind)){accessEpoch++;clearDraft();toast('학생의 공유 또는 과제 상태가 바뀌어 작성 창을 닫았어요. 최신 내용을 확인해 주세요.');}
  if(!learners().some(row=>row.id===learnerId))learnerId=learners()[0]?.id;
  render();if(!draftContext||!draftAllowed(draftContext.kind))void load();
  return true;
 }
 window.SYNKTeacherView=Object.freeze({hasDraft:()=>['assignment-dialog','note-dialog','care-dialog','student-invite-dialog'].some(id=>$(id).open)||homework.hasDraft(),applySharing:scope=>applyParentSharing(scope?.classId,scope?.learners)});
 window.addEventListener('message',event=>{
  const data=event.data;
  if(!accountRequested||event.source!==window.parent||event.origin!==location.origin||data?.type!=='synk-teacher-sharing')return;
  applyParentSharing(data.classId,data.learners);
 });
 window.addEventListener('message',event=>{
  const data=event.data,selection=accountRequested?window.parent.SYNKClassroomSelection:null;
  if(!accountRequested||event.source!==window.parent||event.origin!==location.origin||data?.type!=='synk-teacher-select'||window.parent.SYNKClassroomHost!==accountHost||data.classId!==classId||selection?.classId!==classId||selection.learnerId!==data.learnerId)return;
  const next=learners().find(student=>student.id===data.learnerId)||(!data.learnerId?learners()[0]:null);if(!next)return;
  accessEpoch++;clearDraft();learnerId=next.id;view='students';render();$('student-detail').scrollIntoView({block:'start',behavior:'instant'});
 });
$('student-invite-dialog').addEventListener('close',()=>{clearInvite();if(draftContext?.kind==='enrollment')draftContext=null;});
$('class-select').onchange=()=>{accessEpoch++;clearDraft();classId=$('class-select').value;learnerId=learners()[0]?.id;setPersonalization();render();};$('student-search').oninput=renderRoster;$('assignment-filter').onchange=()=>render();$('content-select').onchange=describeContent;$('refresh').onclick=load;window.addEventListener('focus',()=>{if(linked?!!teacherToken:workspace&&!document.querySelector('dialog[open]'))load();});start();
