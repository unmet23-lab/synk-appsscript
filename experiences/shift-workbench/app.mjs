import {TASKS,ANSWERS,FOCUS,GOALS,STORAGE_KEY,newState,startRun,nextTaskSuggestion,nextTaskReason,practiceBasis,practiceReason,practiceHistoryUsed,recordPracticeExposure,evaluate,checkPrompt,completeRun,giveFeedback,restore,persist,exportText,isSavedWork,historyLabel,storageRecoveryNotice,escapeHTML as esc} from './model.mjs';
const $=id=>document.getElementById(id),engine=globalThis.SynkAtlasPersonalization;
let state=newState(),historyOpen=false,storageMessage='';
function notify(message){$('notice').textContent=message;$('notice').hidden=!message;}
function save(){const result=persist({setItem:(...args)=>localStorage.setItem(...args)},state);storageMessage=result.ok?(result.saved?'이 기기에 저장했어요. 같은 브라우저에서 이어갈 수 있어요.':'이 창에서만 진행합니다. 창을 닫으면 기록이 사라져요.'):result.message;renderStatus();}
function renderStatus(){$('mode-label').textContent=state.save?'이 기기 저장 선택됨':'이 창에서만 진행';$('save-status').textContent=storageMessage||'선택한 조건과 실습은 이 기기에서만 사용합니다.';$('history-count').textContent=String(state.history.length);}
function setup(){
  $('task-options').innerHTML=Object.entries(TASKS).map(([id,task])=>`<label class="task-choice"><input type="radio" name="task" value="${id}" ${state.settings.task===id?'checked':''}><span><strong>${esc(task.name)}</strong><small>${esc(task.subtitle)}</small></span></label>`).join('');
  $('goal').value=state.settings.goal;$('minutes').value=String(state.settings.minutes);$('support').value=state.settings.support;$('save-choice').checked=state.save;
}
function render(){
  const run=state.run;
  $('setup').hidden=historyOpen||!!run;$('practice').hidden=historyOpen||!run||run.step==='result';$('result').hidden=historyOpen||run?.step!=='result';$('history').hidden=!historyOpen;
  document.querySelector('.intro').hidden=!!run||historyOpen;
  renderStatus();
  if(historyOpen)return renderHistory();
  if(!run)return setup();
  if(run.step==='result')return renderResult();
  renderPractice();
}
function renderPractice(){
  const run=state.run,task=TASKS[run.task],checked=!!run.result;
  $('practice').innerHTML=`<div class="section-heading"><span class="number">02</span><div><p class="eyebrow">MAKE IT RELIABLE</p><h2 id="practice-title">${esc(task.name)}</h2></div></div>
  <div class="recommendation"><strong>오늘의 실습</strong><p>${esc(practiceReason(state))}</p><p class="fine">목표: ${esc(GOALS[run.goal]||task.purpose)} · ${practiceHistoryUsed(state)?'선택한 조건과 이 기기의 이전 검토·피드백을 사용해 구성했어요.':'지금 직접 선택한 조건으로 구성했어요. 현재 추천에 사용할 이전 검토·피드백은 없어요.'}</p>${practiceBasis(state).length?`<details class="practice-basis"><summary>최근 확인한 항목</summary><ul>${practiceBasis(state).map(line=>`<li>${esc(line)}</li>`).join('')}</ul></details>`:''}</div>
  <div class="work-grid"><section class="pane" aria-labelledby="source-title"><h3 id="source-title">먼저, 근거가 되는 자료</h3><p class="fine">모두 실습용으로 만든 가상 자료입니다. 이름·수치·일정은 실제 업무 정보가 아닙니다.</p><ul class="source-list">${task.sources.map(s=>`<li><span class="source-id">${s.id}</span>${esc(s.text)}</li>`).join('')}</ul>
  <label class="field-title" for="prompt">이 자료로 AI에게 무엇을 부탁할까요?</label><textarea id="prompt" maxlength="5000" placeholder="만들 결과물, 사용할 자료, 지켜야 할 조건을 적어 보세요.">${esc(run.prompt)}</textarea><p class="fine">회사 자료나 개인정보는 쓰지 마세요. 입력한 요청문은 AI에 전송되지 않습니다.</p>
  ${run.support==='step'?'<p class="tip">① 결과물의 목적 → ② 쓸 자료 → ③ 확인할 조건 순서로 적어 보세요.</p><button id="template" class="soft">예시 요청문 가져오기</button>':''}
  <ul class="prompt-guide" id="prompt-guide"></ul><p class="fine">요청문 점검은 단어 포함 여부를 보는 작성 보조입니다. 의미나 품질을 자동 평가하지 않습니다.</p></section>
  <section class="pane" aria-labelledby="sample-title"><h3 id="sample-title">예시 AI 결과, 그대로 써도 될까요?</h3><p class="fine">미리 준비한 예시입니다. 내 요청문에 따라 생성된 결과가 아닙니다.</p><pre class="sample">${esc(task.sample)}</pre>
  <h3 class="review-heading">판단과 근거를 함께 골라 주세요</h3><p class="fine">문장에 대한 판단을 고른 뒤, 그 판단을 뒷받침하는 자료 번호를 선택합니다.</p>
  ${run.checkIds.map((id,i)=>{const c=task.checks.find(c=>c.id===id),a=run.answers[id]||{},result=run.result?.find(c=>c.id===id);return `<fieldset class="review-item"><legend>${i+1}. ${esc(c.label)}</legend><div class="review-picks"><label>내 판단<select data-check="${id}" data-field="kind" ${checked?'disabled':''}><option value="">판단 선택</option>${Object.entries(ANSWERS).map(([v,l])=>`<option value="${v}" ${a.kind===v?'selected':''}>${l}</option>`).join('')}</select></label><label>근거 자료<select data-check="${id}" data-field="source" ${checked?'disabled':''}><option value="">자료 선택</option>${task.sources.map(s=>`<option value="${s.id}" ${a.source===s.id?'selected':''}>${s.id}</option>`).join('')}</select></label></div>${result?`<p class="review-answer"><strong>${result.correct?'판단과 근거가 맞아요.':'이 근거를 다시 살펴보세요.'}</strong><br>${esc(result.why)}<br>기준: ${esc(ANSWERS[c.answer])} · ${c.source}</p>`:''}</fieldset>`;}).join('')}
  ${checked?'<p class="review-note">첫 검토 결과를 유지했어요. 아래에서 초안을 고치며 다시 확인하세요.</p>':'<button id="check" class="primary">근거와 대조하기</button>'}</section></div>
  ${checked?`<section class="editor" aria-labelledby="edit-title"><h3 id="edit-title">이제 내가 쓸 수 있는 결과로 수정해 보세요</h3><p class="fine">숫자와 기한을 고치고, 확인되지 않은 주장은 구분하고, 빠진 내용을 보완합니다. 자유 문장의 정확성은 자동 채점하지 않습니다.</p><label class="field-title" for="draft">내가 직접 수정한 결과</label><textarea id="draft" maxlength="10000">${esc(run.draft)}</textarea><label class="checkline"><input type="checkbox" id="reviewed" ${run.reviewed?'checked':''}> 제공된 자료와 수정한 결과를 직접 대조했습니다.</label>${run.variant==='deep'?'<p class="tip">다음 실제 업무에서는 원문 출처, 검토 담당자, 확인 날짜를 함께 남겨 보세요. 이 실습에는 실제 회사 정보를 넣지 않습니다.</p>':''}<div class="actions"><button id="complete" class="primary">실습 마무리</button><button id="export" class="soft">작성 중 결과 내려받기</button></div></section>`:''}
  <div class="actions"><button id="restart" class="quiet">업무·조건 다시 선택</button></div>`;
  state=recordPracticeExposure(state);save();
  updatePromptGuide();
  $('prompt').addEventListener('input',()=>{state.run.prompt=$('prompt').value;updatePromptGuide();save();});
  $('template')?.addEventListener('click',()=>{state.run.prompt=task.template;$('prompt').value=task.template;updatePromptGuide();save();notify('예시 요청문을 가져왔어요. 필요한 내용을 직접 바꿔 보세요.');});
  document.querySelectorAll('[data-check]').forEach(el=>el.addEventListener('change',()=>{const id=el.dataset.check;state.run.answers[id]={...state.run.answers[id],[el.dataset.field]:el.value};save();}));
  $('check')?.addEventListener('click',()=>{try{if(run.prompt.trim().length<20)throw new Error('먼저 요청문을 20자 이상 작성해 주세요.');const result=evaluate(run);if(result.some(c=>!c.answered))throw new Error('모든 항목의 판단과 자료 번호를 골라 주세요.');state.run.result=result;save();notify('근거 대조 결과를 확인하고, 아래에서 예시 결과를 직접 수정해 주세요.');renderPractice();$('edit-title').scrollIntoView({block:'center'});}catch(e){notify(e.message);}});
  $('draft')?.addEventListener('input',()=>{state.run.draft=$('draft').value;state.run.reviewed=false;$('reviewed').checked=false;save();});
  $('reviewed')?.addEventListener('change',()=>{state.run.reviewed=$('reviewed').checked;save();});
  $('complete')?.addEventListener('click',()=>{try{state=completeRun(state,engine);save();notify('실습을 마쳤어요. 아래 기록은 이번 가상 자료의 검토 결과입니다.');render();window.scrollTo(0,0);}catch(e){notify(e.message);$('notice').focus();}});
  $('export')?.addEventListener('click',download);$('restart').addEventListener('click',restart);
}
function updatePromptGuide(){if(!$('prompt-guide'))return;$('prompt-guide').innerHTML=checkPrompt(state.run.prompt).map(c=>`<li class="${c.met?'met':''}">${c.met?'✓ 단서 있음':'○ 더 적어보기'} · ${c.label}</li>`).join('');}
function renderResult(){
  const run=state.run,task=TASKS[run.task],result=run.result,correct=result.filter(c=>c.correct).length,next=nextTaskSuggestion(state);
  $('result').innerHTML=`<div class="result-top"><div><p class="eyebrow">YOUR WORK, REVISED.</p><h2 id="result-title">검토하고, 직접 고쳤어요.</h2><p class="lead">${esc(task.name)} 실습을 마쳤습니다.</p></div><div class="score"><strong>${correct} / ${result.length}</strong><span>첫 검토에서 판단과 근거가 모두 일치한 항목</span></div></div>
  <p class="fine">정해진 확인 항목의 결과입니다. 수정한 자유 문장의 정확성이나 실제 업무 능력·효율 향상을 측정한 점수는 아닙니다.</p>
  <label class="field-title" for="finished-draft">내가 수정한 결과</label><textarea id="finished-draft" readonly>${esc(run.draft)}</textarea><div class="actions"><button id="export" class="primary">결과 TXT 내려받기</button></div>
  <div class="next"><h3>다음에는 ${next.focus?esc(FOCUS[next.focus]):'다른 업무의 근거 확인'}</h3><p>${esc(nextTaskReason(state))}</p><p class="fine">선택한 업무에 다시 확인할 유형이 있으면 먼저 제시합니다. 업무와 조건은 직접 바꿀 수 있어요. 같은 문항의 반복 정답만으로 능력 향상을 판단하지 않습니다.</p><button id="next" class="soft">다음 실습 고르기</button></div>
  <div class="feedback"><h3>이번 구성은 어땠나요?</h3><p class="fine">직접 고른 피드백은 다음 실습의 분량 추천에 사용합니다. 능력 평가가 아닙니다.</p><div class="actions">${Object.entries({helpful:'도움이 됐어요',too_much:'분량이 많아요',want_more:'더 해보고 싶어요',not_fit:'잘 맞지 않아요'}).map(([v,l])=>`<button class="soft" data-feedback="${v}" aria-pressed="${run.feedback===v}" ${run.feedback?'disabled':''}>${l}</button>`).join('')}</div></div>`;
  $('export').addEventListener('click',download);$('next').addEventListener('click',()=>{state.settings.task=nextTaskSuggestion(state).task;restart();});
  document.querySelectorAll('[data-feedback]').forEach(el=>el.addEventListener('click',()=>{try{state=giveFeedback(state,el.dataset.feedback,engine);save();renderResult();notify('피드백을 반영했어요. 다음 추천에서 함께 사용합니다.');}catch(e){notify(e.message);}}));
}
function restart(){state.run=null;save();notify('조건을 다시 고르면 새 실습이 시작됩니다. 완료한 기록은 남아 있어요.');render();window.scrollTo(0,0);}
function renderHistory(){
  $('history-list').innerHTML=state.history.length?[...state.history].reverse().map(h=>{
    const saved=isSavedWork(h);
    return `<article class="history-row"><time>${esc(new Date(h.at).toLocaleString('ko-KR'))}</time><h3>${esc(historyLabel(h))}</h3>${saved?`<p>${h.kind==='recovered-work'?'업데이트 전 작성한 내용':'이전 조건에서 작성한 내용'} · 추천·평가에 사용하지 않음</p><p>${h.status==='completed'?'완료한 실습의 작성물':'작성 중이던 내용'}</p><details><summary>작성한 요청문과 결과 보기</summary><h4>내 요청문</h4><pre class="sample">${esc(h.prompt)}</pre><h4>직접 작성한 내용</h4><pre class="sample">${esc(h.draft)}</pre></details>`:`<p>첫 근거 확인 ${h.correct}/${h.total} · ${h.assisted?'안내 사용':'스스로 진행'}</p><p>${h.missed.length?'다음 확인: '+esc(h.missed.map(f=>FOCUS[f]).join(', ')):'다른 자료로 적용 범위를 넓혀 보세요.'}</p><details><summary>수정한 결과 보기</summary><pre class="sample">${esc(h.draft)}</pre></details>`}</article>`;
  }).join(''):'<p>아직 보관한 작성물이나 완료한 실습이 없어요. 현재 실습을 마치면 여기에 기록합니다.</p>';
}
function download(){try{const content=exportText(state),blob=new Blob([content],{type:'text/plain;charset=utf-8'});if(blob.size>65536)throw new Error('내보낼 내용이 너무 길어요. 64 KB 이내로 줄여 주세요.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='synk-shift-practice.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('TXT 다운로드를 요청했어요. 브라우저 또는 앱의 다운로드 위치를 확인하세요.');}catch(e){notify(e.message);}}
$('setup-form').addEventListener('submit',event=>{event.preventDefault();try{const data=new FormData(event.currentTarget),settings={task:data.get('task'),goal:data.get('goal'),minutes:Number(data.get('minutes')),support:data.get('support')};const remember=$('save-choice').checked;if(state.save&&!remember){try{localStorage.removeItem(STORAGE_KEY);}catch{throw new Error('기존 저장을 지우지 못했어요. 브라우저 저장 설정을 확인해 주세요.');}}state=startRun({...state,save:remember},settings,engine);save();notify('내 조건에 맞는 실습을 준비했어요.');render();window.scrollTo(0,0);}catch(e){notify(e.message);}});
$('history-open').addEventListener('click',()=>{historyOpen=true;render();});$('history-close').addEventListener('click',()=>{historyOpen=false;render();});
$('reset').addEventListener('click',()=>$('reset-dialog').showModal());$('reset-cancel').addEventListener('click',()=>$('reset-dialog').close());
$('reset-confirm').addEventListener('click',()=>{try{localStorage.removeItem(STORAGE_KEY);state=newState();historyOpen=false;storageMessage='이 기기의 실습과 저장 기록을 지웠어요.';$('reset-dialog').close();notify('실습과 기록을 초기화했어요.');render();}catch{notify('저장 기록을 지우지 못했어요. 브라우저 저장 설정을 확인해 주세요.');$('reset-dialog').close();}});
try{if(!engine)throw new Error('개인화 모듈을 불러오지 못했어요. 새로고침해 주세요.');const saved=localStorage.getItem(STORAGE_KEY);if(saved){state=restore(saved,engine,undefined,globalThis.SynkTemperOutcomes);storageMessage=storageRecoveryNotice(state)||'이 기기에 저장된 실습을 이어왔어요.';notify(storageRecoveryNotice(state)||'이전에 저장한 실습을 이어왔어요. 공용 기기라면 초기화해 주세요.');}}catch(e){notify('저장된 실습을 불러오지 못했어요. 현재 창에서 새로 시작할 수 있습니다. '+e.message);}
render();document.documentElement.dataset.ready='true';
