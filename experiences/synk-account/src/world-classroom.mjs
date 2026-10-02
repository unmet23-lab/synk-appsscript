const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const invalid=()=>{throw Object.assign(new Error('과제 연결 내용을 확인하지 못했어요. 다시 불러와 주세요.'),{code:'INVALID_RESPONSE'});};
export function validateWorldWorkspace(value,learnerId){
  if(value?.learner?.id!==learnerId||!Array.isArray(value.assignments)||typeof value.sharing?.enabled!=='boolean'||!Number.isSafeInteger(value.sharing.revision))invalid();
  for(const item of value.assignments)if(typeof item?.id!=='string'||!Number.isSafeInteger(item.revision)||!item.content||!Array.isArray(item.content.questions))invalid();
  return value;
}
export function submissionAttempt({assignment,content,revision,answers,key}){
  if(!Number.isSafeInteger(revision)||revision<1||typeof key!=='string'||!answers||typeof answers!=='object')invalid();
  const questions=(assignment?.content||content)?.questions;if(!Array.isArray(questions)||!questions.length)invalid();
  const selected={};for(const question of questions){const answer=answers[question.id];if(!question.options?.some(option=>option.id===answer))throw new Error('모든 문항의 답을 골라 주세요.');selected[question.id]=answer;}
  return Object.freeze(assignment?{assignmentId:assignment.id,revision,answers:Object.freeze(selected),idempotencyKey:key}:{contentId:content.id,revision,answers:Object.freeze(selected),idempotencyKey:key});
}
export function createWorldClassroom({root,client,learnerId,guard,notice=()=>{},launchRun=()=>{},closeGame=()=>{},onSharingChange=null,pollMs=5000,documentObject=document,makeId=()=>crypto.randomUUID()}){
  let ended=false,requestVersion=0,timer=null,abort=null,busy=false,workspace=null,practice=[],error='',selected=null,submitting=false,starting=false,viewVersion=0,lastSnapshot='',lastSharingRevision=null,assignmentVersions=new Map(),drafts=new Map(),pending=new Map(),practiceResults=new Map(),runRequests=new Map(),openRun=null,gameVisible=false;
  const active=()=>{guard();if(ended)throw Object.assign(new Error('연결이 끝났어요.'),{code:'ACCOUNT_CHANGED'});};
  const keyFor=choice=>`${choice.kind}:${choice.id}:${workspace?.sharing?.revision||0}`;
  const pick=()=>selected&&(selected.kind==='assignment'?workspace?.assignments.find(row=>row.id===selected.id):practice.find(row=>row.id===selected.id));
  function status(){return{learnerId,ended,loaded:!!workspace,pending:pending.size,selected:selected?{...selected}:null,run:openRun?{...openRun}:null,gameVisible};}
  function closeLocal(){closeGame();gameVisible=false;}
  function gameProgress(run){const p=run?.progress||{};return `${Number(p.total)||0} / ${Number(run?.requiredAttempts)||3}응답 · 혼자 ${Number(p.independent)||0} · 도움 ${Number(p.assisted)||0} · 평가 제외 ${Number(p.excluded)||0}`;}
  function coaching(){const c=workspace?.coaching;if(!workspace.sharing.enabled||!c?.summary)return '';return `<section class="wc-coaching"><h3>오늘의 학습 안내</h3><p>${esc(c.summary)}</p><p class="small">실제 연습 기록과 추천 기준을 바탕으로 준비한 안내입니다.</p>${Array.isArray(c.next)?c.next.map(row=>typeof row==='string'?`<p>${esc(row)}</p>`:practice.some(item=>item.id===row.contentId)?`<button class="sb-btn soft" data-world-action="open" data-kind="practice" data-id="${esc(row.contentId)}">${esc(row.title||'다음 연습')}</button><p class="small">${esc(row.reason||'')}</p>`:'').join(''):''}</section>`;}
  function schedule(){clearTimeout(timer);if(!ended&&documentObject.visibilityState!=='hidden')timer=setTimeout(()=>{timer=null;void reload();},pollMs);}
  function focusSnapshot(){const el=documentObject.activeElement;if(!root.contains(el))return null;return el?.dataset?.worldAnswer?{question:el.dataset.worldAnswer,value:el.value}:null;}
  function render(){
    if(ended)return;const focused=focusSnapshot();root.hidden=false;
    if(!workspace){root.innerHTML=`<section class="wc-panel"><h2>선생님 과제와 읽기 연습</h2><p role="status">${esc(error||'과제를 불러오고 있어요.')}</p><button class="sb-btn soft" data-world-action="refresh">다시 불러오기</button></section>`;return;}
    const sharing=workspace.sharing;
    root.innerHTML=`<section class="wc-panel"><header class="wc-heading"><div><p class="sb-eyebrow">SYNK WORLD · 나의 교실</p><h2>${esc(workspace.learner.name)}의 과제와 연습</h2><p>선생님이 보낸 과제와 나에게 필요한 연습을 이어가요.</p></div><button class="plain" data-world-action="refresh">새로고침</button></header><p class="wc-connection" role="status">${sharing.enabled?'학습 공유 켜짐 · 읽기는 서버에서 채점하며, 게임의 언어 응답은 도움·평가 제외 기록을 구분해 선생님에게 전달합니다.':'학습 공유 꺼짐 · 위 계정 설정에서 다시 켜면 과제 제출과 기록 공유를 이어갈 수 있어요.'}</p>${error?`<p class="wc-error" role="alert">${esc(error)}</p>`:''}${selected?activity():coaching()+lists()}</section>`;
    if(focused){const node=[...root.querySelectorAll('[data-world-answer]')].find(el=>el.dataset.worldAnswer===focused.question&&el.value===focused.value);node?.focus({preventScroll:true});}
  }
  function lists(){
    const rows=workspace.assignments.filter(row=>row.status!=='cancelled');
    const recommendations=new Map((workspace.sharing.enabled&&Array.isArray(workspace.recommendations)?workspace.recommendations:[]).filter(row=>practice.some(item=>item.id===row.contentId)).map((row,index)=>[row.contentId,{...row,order:index}]));
    const ordered=[...practice].sort((a,b)=>(recommendations.get(a.id)?.order??Infinity)-(recommendations.get(b.id)?.order??Infinity));
    return `<section><h3>오늘의 과제 <span class="wc-count">${rows.filter(row=>!row.completed&&!row.submission).length}</span></h3><div class="wc-cards">${rows.length?rows.map(row=>`<article class="wc-card"><span class="wc-label">${row.completed||row.submission?'제출 완료':row.content.kind==='game'?'게임 과제':'읽기 과제'}</span><h4>${esc(row.title)}</h4><p>${esc(row.reason||row.instructions||'차분히 연습해 주세요.')}</p>${row.run?`<p class="small">${esc(gameProgress(row.run))}</p>`:''}<p class="small">마감 ${esc(new Date(row.dueAt).toLocaleString('ko-KR'))}</p><button class="sb-btn soft" data-world-action="open" data-kind="assignment" data-id="${esc(row.id)}">${row.completed||row.submission?'수행 결과 보기':'과제 시작'}</button></article>`).join(''):'<p class="wc-empty">아직 받은 과제가 없어요. 선생님이 보내면 이곳에 나타나요.</p>'}</div></section><section class="wc-practice-list"><h3>내가 먼저 연습하기</h3><p>기록에 맞는 연습을 먼저 보여드려요. 같은 문항을 다시 풀어도 새 독립 문항으로 세지 않아요.</p><div class="wc-cards">${ordered.map(row=>`<article class="wc-card"><span class="wc-label">${recommendations.has(row.id)?(row.kind==='game'?'지금 추천하는 게임':'지금 추천하는 읽기'):(row.kind==='game'?'게임':'읽기')} · ${row.kind==='game'?`${Number(workspace.gameTargets?.[row.id]?.requiredAttempts||row.requiredAttempts)||3}응답`:`${row.questions?.length||0}문항`}</span><h4>${esc(row.title||row.name||'연습')}</h4>${recommendations.get(row.id)?.reason?`<p class="wc-reason">추천 이유: ${esc(recommendations.get(row.id).reason)}</p>`:''}<button class="sb-btn soft" data-world-action="open" data-kind="practice" data-id="${esc(row.id)}" ${workspace.sharing.enabled?'':'disabled'}>${row.kind==='game'?'게임 연습하기':'읽기 연습하기'}</button></article>`).join('')}</div></section>`;
  }
  function activity(){
    const item=pick();if(!item)return `<p class="wc-empty">이 과제를 더 이상 열 수 없어요. 취소되었거나 배정 내용이 바뀌었을 수 있어요.</p><button class="plain" data-world-action="back">과제 목록으로</button>`;
    if(item.status==='cancelled')return `<p class="wc-empty">선생님이 이 과제를 취소했어요.</p><button class="plain" data-world-action="back">과제 목록으로</button>`;
    const original=selected.kind==='assignment'?item.content:item,target=item.target||item.run?.target||(openRun?.contentId===original.id?openRun.target:null)||workspace.gameTargets?.[original.id];
    const content={...original,requiredAttempts:target?.requiredAttempts||original.requiredAttempts},key=keyFor(selected),answers=drafts.get(key)||{},attempt=pending.get(key),result=selected.kind==='assignment'?item.submission:practiceResults.get(key),locked=!!attempt||submitting||!workspace.sharing.enabled;
    if(content.kind==='game'){
      const sameContext=openRun?.contentId===content.id&&(selected.kind==='assignment'?openRun.assignmentId===item.id:!openRun.assignmentId);
      const run=item.run||(sameContext?openRun:null),done=run?.status==='completed'||item.completed;
      return `<div class="wc-activity"><button class="plain" data-world-action="back" ${starting?'disabled':''}>← 오늘의 학습 목록</button><h3>${esc(item.title||content.title)}</h3><p>${esc(item.reason||content.note||'언어 문항을 차분히 풀어 주세요.')}</p>${target?`<p class="wc-target"><strong>이번 학습 목표</strong> · ${esc(target.description)}</p>`:''}<p>이 목표에 맞는 ${Number(content.requiredAttempts)||3}개의 서로 다른 문항에 답하면 완료됩니다. 다른 영역·난도, 조작 점수·같은 문항 반복·음성 실패는 완료 수에 넣지 않습니다.</p>${run?`<p class="wc-run-progress" role="status">${esc(gameProgress(run))}</p>`:''}${done?'<p class="wc-result">학습 완료 · 담당 선생님에게 수행 기록을 전달했어요.</p>':`<button class="sb-btn" data-world-action="start-game" ${starting||!workspace.sharing.enabled?'disabled':''}>${starting?'게임 연결 중…':runRequests.has(key)?'같은 시작 요청 다시 확인':gameVisible&&openRun?.contentId===content.id?'게임 다시 열기':'게임 시작'}</button>`}${openRun&&gameVisible?'<button class="plain" data-world-action="stop-game">게임 닫기</button>':''}<p class="small">게임이 보고한 언어 응답을 사용합니다. TOPIK 급수나 학습 효과 판정은 아닙니다.</p></div>`;
    }
    return `<div class="wc-activity"><button class="plain" data-world-action="back" ${submitting?'disabled':''}>← 과제와 연습 목록</button><h3>${esc(item.title||content.title||'읽기 연습')}</h3><p>${esc(item.reason||item.instructions||'지문을 읽고 알맞은 답을 고르세요.')}</p><article class="wc-passage">${esc(content.passage)}</article>${result?`<section class="wc-result"><h4>${Number(result.correct??result.score?.correct)||0} / ${Number(result.total??result.score?.total)||content.questions.length}문항 · 제출 완료</h4><p>정해진 문항의 채점 결과입니다. TOPIK 급수나 학습 효과를 판정한 점수가 아닙니다.</p>${content.questions.map((q,index)=>{const answer=result.results?.find(r=>r.questionId===q.id);return `<article><h4>${index+1}. ${esc(q.prompt)}</h4><p>내 답: ${esc(q.options.find(o=>o.id===(answer?.answer??result.answers?.[q.id]))?.text||'답 확인 중')}</p>${answer?`<p>${answer.correct?'맞았어요.':'다시 확인해 보세요.'} 알맞은 답: ${esc(q.options.find(o=>o.id===answer.correctAnswer)?.text||'')}</p><p>${esc(answer.explanation)}</p>`:''}</article>`;}).join('')}<button class="sb-btn soft" data-world-action="back">목록으로 돌아가기</button></section>`:`<form data-world-submit>${content.questions.map((q,index)=>`<fieldset class="wc-question"><legend>${index+1}. ${esc(q.prompt)}</legend>${q.options.map(o=>`<label class="wc-option"><input type="radio" data-world-answer="${esc(q.id)}" name="world-${esc(q.id)}" value="${esc(o.id)}" ${answers[q.id]===o.id?'checked':''} ${locked?'disabled':''}><span>${esc(o.text)}</span></label>`).join('')}</fieldset>`).join('')}<p class="small">${attempt?'응답을 확인할 때까지 처음 제출한 답을 유지합니다. 다시 누르면 같은 제출 번호로 확인해요.':'모든 문항을 고른 뒤 제출해 주세요. 제출 전에는 정답을 보여주지 않습니다.'}</p><button class="sb-btn" type="submit" ${submitting||!workspace.sharing.enabled?'disabled':''}>${submitting?'제출 확인 중…':attempt?'같은 제출 다시 확인':'답 제출하기'}</button></form>`}</div>`;
  }
  async function reload({force=false}={}){
    if(ended)return;if(busy&&!force)return;
    if(force)abort?.abort();active();const version=++requestVersion;clearTimeout(timer);busy=true;abort=new AbortController();const signal=abort.signal;
    try{
      const [result,catalog]=await Promise.all([client.student({signal}),client.practice({signal})]);active();if(version!==requestVersion)return;
      validateWorldWorkspace(result,learnerId);if(!Array.isArray(catalog?.content))invalid();
      if(lastSharingRevision!==null&&lastSharingRevision!==result.sharing.revision&&onSharingChange){closeLocal();onSharingChange(result.sharing);return;}
      let changedAssignment=false;
      if(lastSharingRevision!==null&&lastSharingRevision!==result.sharing.revision){closeLocal();openRun=null;runRequests.clear();drafts.clear();pending.clear();practiceResults.clear();selected=null;submitting=false;starting=false;viewVersion++;}
      else for(const [id,previous] of assignmentVersions){
        const next=result.assignments.find(row=>row.id===id);
        if(!next||next.revision!==previous.revision||next.status!==previous.status&&next.status==='cancelled'){
          const oldKey=`assignment:${id}:${lastSharingRevision}`;drafts.delete(oldKey);pending.delete(oldKey);runRequests.delete(oldKey);
          if(openRun?.assignmentId===id){closeLocal();openRun=null;starting=false;}
          if(selected?.kind==='assignment'&&selected.id===id){submitting=false;starting=false;viewVersion++;changedAssignment=true;}
        }
      }
      lastSharingRevision=result.sharing.revision;assignmentVersions=new Map(result.assignments.map(row=>[row.id,{revision:row.revision,status:row.status}]));
      workspace=result;practice=Array.isArray(result.content)?result.content.map(meta=>meta.kind==='game'?meta:{...meta,...catalog.content.find(row=>row.id===meta.id)}):catalog.content;
      if(practice.some(row=>row.kind!=='game'&&(!Array.isArray(row.questions)||!row.questions.length)))invalid();
      error=changedAssignment?'선생님이 과제를 바꿨어요. 최신 내용과 답을 다시 확인해 주세요.':'';
      if(openRun){const currentRun=result.runs?.find(row=>row.id===openRun.id)||(result.activeRun?.id===openRun.id?result.activeRun:result.assignments.find(row=>row.run?.id===openRun.id)?.run);if(currentRun){openRun=currentRun;if(['stopped','invalidated'].includes(currentRun.status))closeLocal();}else if(result.activeRun&&result.activeRun.id!==openRun.id){closeLocal();openRun=null;}}
      if(selected?.kind==='assignment'&&pick()?.submission)pending.delete(keyFor(selected));
      const snapshot=JSON.stringify([workspace,practice]);if(snapshot!==lastSnapshot){lastSnapshot=snapshot;render();}
    }catch(cause){if(ended||version!==requestVersion)return;closeLocal();workspace=null;practice=[];lastSnapshot='';error=cause.message||'과제 연결을 확인하지 못했어요.';render();}
    finally{if(!ended&&version===requestVersion){busy=false;abort=null;schedule();}}
  }
  async function submit(){
    if(ended||submitting||!selected||!workspace?.sharing.enabled)return;active();const choice={...selected},item=pick();if(!item||item.status==='cancelled'||item.submission)return;
    const key=keyFor(choice),version=viewVersion;let attempt=pending.get(key);
    try{
      attempt ||= submissionAttempt({...(choice.kind==='assignment'?{assignment:item}:{content:item}),revision:choice.kind==='assignment'?item.revision:workspace.sharing.revision,answers:drafts.get(key)||{},key:makeId()});
      pending.set(key,attempt);submitting=true;error='';render();
      const result=await(choice.kind==='assignment'?client.submit(attempt):client.practiceSubmit(attempt));active();if(version!==viewVersion)return;
      if(choice.kind==='practice'){if(!result?.submission)invalid();practiceResults.set(key,result.submission);}
      pending.delete(key);if(choice.kind==='assignment')await reload({force:true});
      notice('제출을 확인했어요. 담당 선생님 화면에서도 결과를 확인할 수 있어요.');
    }catch(cause){if(!ended&&version===viewVersion)error=cause.message||'제출 응답을 확인하지 못했어요. 같은 제출을 다시 확인해 주세요.';}
    finally{if(!ended&&version===viewVersion){submitting=false;render();}}
  }
  async function stopGame(){closeLocal();if(openRun){const previous=openRun;await client.stopRun(previous.id);active();if(openRun?.id===previous.id)openRun=null;}}
  async function startGame(){
    if(ended||starting||!workspace?.sharing.enabled||!selected)return;active();const item=pick(),content=selected.kind==='assignment'?item?.content:item;if(content?.kind!=='game'||item.status==='cancelled'||item.completed)return;
    const key=keyFor(selected),version=viewVersion;let payload=runRequests.get(key);
    payload||=Object.freeze({...selected.kind==='assignment'?{assignmentId:item.id,revision:item.revision}:{contentId:content.id,revision:workspace.sharing.revision},idempotencyKey:makeId()});runRequests.set(key,payload);starting=true;error='';closeLocal();render();
    try{
      // Close and invalidate the previous frame before issuing a new run request.
      // An unresolved old stop must be retried before another run can start.
      if(openRun&&((openRun.assignmentId||null)!==(payload.assignmentId||null)||openRun.contentId!==content.id))await stopGame();
      const result=await client.startRun(payload);active();if(version!==viewVersion)return;
      const run=result?.run;if(!run||typeof run.id!=='string'||run.gameId!==content.gameId||run.contentId!==content.id||payload.assignmentId&&run.assignmentId!==payload.assignmentId)invalid();
      runRequests.delete(key);openRun=run;if(run.status==='active'){launchRun(run);gameVisible=true;notice('게임에서 기록한 언어 응답을 이 학습에 연결합니다.');}
      await reload({force:true});
    }catch(cause){if(!ended&&version===viewVersion){if(['RUN_ENDED','ALREADY_SUBMITTED','REVISION_CONFLICT'].includes(cause.code))runRequests.delete(key);error=cause.message||'게임 시작을 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.';}}
    finally{if(!ended&&version===viewVersion){starting=false;render();}}
  }
  async function openGame(gameId){active();const item=practice.find(row=>row.kind==='game'&&row.gameId===gameId);if(!workspace?.sharing.enabled||!item)throw new Error('학습 연결과 게임 목록을 먼저 불러와 주세요.');selected={kind:'practice',id:item.id};viewVersion++;render();await startGame();}
  function click(event){const button=event.target.closest?.('[data-world-action]');if(!button||button.disabled||!root.contains(button)||ended)return;const action=button.dataset.worldAction;
    if(action==='refresh'){lastSnapshot='';void reload({force:true});return;}
    if(action==='back'){selected=null;error='';viewVersion++;render();return;}
    if(action==='start-game'){void startGame();return;}
    if(action==='stop-game'){void stopGame().then(()=>{if(!ended)render();}).catch(cause=>{if(!ended){error=cause.message;render();}});return;}
    if(action==='open'&&workspace){const kind=button.dataset.kind,id=button.dataset.id;if(!['practice','assignment'].includes(kind))return;const item=(kind==='assignment'?workspace.assignments:practice).find(row=>row.id===id);if(!item)return;selected={kind,id};viewVersion++;error='';render();}
  }
  function change(event){const input=event.target;if(ended||!selected||!input.dataset.worldAnswer||!root.contains(input))return;const key=keyFor(selected);if(pending.has(key)||submitting)return;const answers={...drafts.get(key),[input.dataset.worldAnswer]:input.value};drafts.set(key,answers);}
  function form(event){if(event.target.matches?.('[data-world-submit]')){event.preventDefault();void submit();}}
  function visibility(){if(documentObject.visibilityState==='hidden'){clearTimeout(timer);return;}void reload({force:true});}
  root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('submit',form);documentObject.addEventListener('visibilitychange',visibility);render();
  return Object.freeze({reload,status,openGame,stop(){ended=true;viewVersion++;requestVersion++;abort?.abort();clearTimeout(timer);closeLocal();openRun=null;runRequests.clear();drafts.clear();pending.clear();practiceResults.clear();assignmentVersions.clear();lastSharingRevision=null;workspace=null;practice=[];root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('submit',form);documentObject.removeEventListener('visibilitychange',visibility);root.replaceChildren();root.hidden=true;}});
}
