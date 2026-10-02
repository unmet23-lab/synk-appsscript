'use strict';

// The company session owns identity; the shared SHIFT model owns practice decisions.
// No standalone visitor state or company document is imported into this exercise.
const wp={userId:null,model:null,value:null,loading:false,request:0,mode:'practice',error:'',storageMessage:'',confirmClear:false,composing:false};
const wpKey=id=>`synk-workroom:ai-practice:v1:${id}`;
const wpScope=id=>({personId:id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'});
const wpEngine=()=>globalThis.SynkAtlasPersonalization;
function wpSyncIdentity(){
  const id=state.user?.id||null;if(id===wp.userId)return;
  Object.assign(wp,{userId:id,value:null,loading:false,request:wp.request+1,mode:'practice',error:'',storageMessage:'',confirmClear:false,composing:false});
}
function wpRestore(){
  wp.value=wp.model.newState();
  try{const saved=localStorage.getItem(wpKey(wp.userId));if(saved)wp.value=wp.model.restore(saved,wpEngine(),wpScope(wp.userId));}
  catch(error){wp.storageMessage='저장된 실습을 불러오지 못했어요. 이 창에서 새로 시작합니다.';}
}
async function wpEnsure(){
  wpSyncIdentity();if(!wp.userId||state.tab!=='workroom'||wr.view!=='practice'||wp.loading||wp.value||wp.error)return;
  const id=wp.userId,request=++wp.request;wp.loading=true;wp.error='';
  try{
    const model=wp.model||await import(`/workroom-practice/model.mjs?attempt=${request}`);
    if(request!==wp.request||state.user?.id!==id)return;
    if(!wpEngine())throw new Error('맞춤 실습을 불러오지 못했어요.');
    wp.model=model;wpRestore();
  }catch(error){if(request===wp.request&&state.user?.id===id)wp.error='실습을 불러오지 못했어요. 다시 불러와 주세요.';}
  finally{if(request===wp.request&&state.user?.id===id){wp.loading=false;if(state.tab==='workroom'&&wr.view==='practice')render();}}
}
function wpSave(){
  if(!wp.value||state.user?.id!==wp.userId||!wp.value.profile)return;
  const result=wp.model.persist({setItem:(...args)=>localStorage.setItem(...args)},wp.value,wpKey(wp.userId));
  wp.storageMessage=result.ok?(result.saved?'이 계정의 실습을 이 브라우저에 저장했어요.':'이 창에서만 진행합니다. 창을 닫으면 기록이 사라져요.'):result.message;
  wpStatus();
}
function wpStatus(){const node=document.getElementById('wp-storage-status');if(node)node.textContent=wp.storageMessage||'기본은 미저장입니다. 저장을 선택하면 이 계정으로 같은 브라우저에서 이어갑니다.';}
const wpButton=(label,action,attrs='',classes='')=>button(label,'practice-'+action,'',classes,attrs);
function wpPanel(){
  wpSyncIdentity();
  if(!wp.value)return `<section class="wp-practice" data-workroom-practice="loading"><h1>AI 업무 연습</h1><p role="status">${wp.error?escape(wp.error):'실습 자료를 준비하고 있어요.'}</p>${wp.error?wpButton('다시 불러오기','retry','','primary'):''}</section>`;
  const value=wp.value,run=value.run;
  return `<section class="wp-practice" data-workroom-practice="ready"><header class="wp-heading"><div><span class="wr-kicker">내 작업실 · AI 업무 연습</span><h1>AI 결과를, 내가 확인할 수 있도록.</h1><p>가상 자료로 요청하고, 근거와 비교하고, 직접 고쳐 보세요.</p></div>${wpButton(wp.mode==='history'?'실습으로 돌아가기':`내 실습 기록 ${value.history.length}`,wp.mode==='history'?'back':'history','','small quiet')}</header><p class="wp-disclosure">가상 업무 실습 · 실제 AI 호출 없음 · 회사 공유 자료에 자동으로 저장되지 않습니다.</p><div class="wp-storage"><label><input type="checkbox" data-wp-field="save" ${value.save?'checked':''}> 이 계정의 실습을 이 기기에 저장</label><p id="wp-storage-status" role="status">${escape(wp.storageMessage||'기본은 미저장입니다. 저장을 선택하면 이 계정으로 같은 브라우저에서 이어갑니다.')}</p></div>${wp.error?`<p class="wp-error" role="alert">${escape(wp.error)}</p>`:''}${wp.mode==='history'?wpHistory():wp.mode==='setup'||!run?wpSetup():run.step==='result'?wpResult():wpExercise()}<footer class="wp-footer">${wpButton('제작 데스크','desk','','quiet')}${wpButton('게시 전 점검','publish','','quiet')}${wp.confirmClear?`<span>이 계정의 실습과 저장 기록을 비울까요?</span>${wpButton('실습 기록 비우기','clear','','small')}${wpButton('취소','cancel-clear','','small quiet')}`:wpButton('내 실습 기록 비우기','ask-clear','','small quiet')}</footer></section>`;
}
function wpSelect(name,label,options,value){return `<label class="wp-field">${label}<select data-wp-field="${name}">${Object.entries(options).map(([id,text])=>`<option value="${id}" ${String(value)===id?'selected':''}>${escape(text)}</option>`).join('')}</select></label>`;}
function wpSetup(){
  const s=wp.value.settings;
  return `<form data-wp-setup><div class="wp-section-head"><h2>오늘 연습할 업무를 골라 주세요</h2><p>직접 선택한 목표·시간·도움 방식으로 분량을 맞춥니다.</p></div><fieldset class="wp-tasks"><legend class="sr-only">실습할 업무</legend>${Object.entries(wp.model.TASKS).map(([id,t])=>`<label class="wp-task"><input type="radio" name="wp-task" data-wp-field="task" value="${id}" ${s.task===id?'checked':''}><span><strong>${escape(t.name)}</strong><small>${escape(t.subtitle)}</small></span></label>`).join('')}</fieldset><div class="wp-settings">${wpSelect('goal','이번 목표',wp.model.GOALS,s.goal)}${wpSelect('minutes','사용할 시간',{'5':'5분','10':'10분','15':'15분'},s.minutes)}${wpSelect('support','도움 방식',{step:'단계 안내와 예시 받기',independent:'스스로 작성하고 검토하기'},s.support)}</div><div class="wp-actions"><button type="submit" class="btn primary">${wp.value.run?'선택한 조건으로 새 실습 시작':'내 조건으로 시작'}</button>${wp.value.run?wpButton('이전 실습 이어가기','back','','quiet'):''}</div></form>`;
}
function wpExercise(){
  const run=wp.value.run,task=wp.model.TASKS[run.task];
  return `<div class="wp-section-head"><h2>${escape(task.name)}</h2><p>${escape(run.reason)}</p><p class="wp-note">목표: ${escape(wp.model.GOALS[run.goal])} · ${wp.value.history.length?'직접 선택한 조건과 이 계정의 이전 검토·피드백을 사용했어요.':'지금 직접 선택한 조건만 사용했어요. 이전 검토 기록은 아직 없어요.'}</p></div><div class="wp-grid"><section class="wp-pane"><h3>근거가 되는 자료</h3><p class="wp-note">이름·수치·일정은 모두 가상 자료입니다.</p><ul class="wp-sources">${task.sources.map(s=>`<li><b>${s.id}</b><span>${escape(s.text)}</span></li>`).join('')}</ul><label class="wp-field">AI에게 부탁할 요청문<textarea data-wp-field="prompt" maxlength="5000" rows="7" placeholder="만들 결과물, 쓸 자료, 지켜야 할 조건을 적어 보세요.">${escape(run.prompt)}</textarea></label><p class="wp-note">회사 자료나 개인정보는 쓰지 마세요. 요청문은 AI에 전송되지 않습니다.</p>${run.support==='step'?wpButton('예시 요청문 가져오기','template','','small quiet'):''}<ul id="wp-prompt-guide" class="wp-prompt-guide">${wpPromptGuide()}</ul><p class="wp-note">요청문의 단어 포함 여부를 보는 작성 보조입니다. 의미나 품질을 자동 평가하지 않습니다.</p></section><section class="wp-pane"><h3>예시 AI 결과, 그대로 써도 될까요?</h3><p class="wp-note">미리 준비한 예시이며 내 요청문에 따라 생성된 결과가 아닙니다.</p><pre class="wp-sample">${escape(task.sample)}</pre><h3>판단과 근거를 함께 골라 주세요</h3>${run.checkIds.map((id,i)=>{const c=task.checks.find(c=>c.id===id),a=run.answers[id]||{},result=run.result?.find(c=>c.id===id);return `<fieldset class="wp-check"><legend>${i+1}. ${escape(c.label)}</legend><div class="wp-picks"><label class="wp-field">내 판단<select data-wp-check="${id}" data-wp-part="kind" ${run.result?'disabled':''}><option value="">판단 선택</option>${Object.entries(wp.model.ANSWERS).map(([v,l])=>`<option value="${v}" ${a.kind===v?'selected':''}>${escape(l)}</option>`).join('')}</select></label><label class="wp-field">근거 자료<select data-wp-check="${id}" data-wp-part="source" ${run.result?'disabled':''}><option value="">자료 선택</option>${task.sources.map(s=>`<option value="${s.id}" ${a.source===s.id?'selected':''}>${s.id}</option>`).join('')}</select></label></div>${result?`<p class="wp-answer"><strong>${result.correct?'판단과 근거가 맞아요.':'근거를 다시 살펴보세요.'}</strong><br>${escape(result.why)}<br>기준: ${escape(wp.model.ANSWERS[c.answer])} · ${c.source}</p>`:''}</fieldset>`;}).join('')}${run.result?'<p class="wp-note">첫 검토 결과를 유지합니다. 아래에서 직접 수정하며 다시 확인하세요.</p>':wpButton('근거와 대조하기','check','','primary')}</section></div>${run.result?`<section class="wp-editor"><h2 tabindex="-1" id="wp-edit-title">이제 쓸 수 있는 결과로 수정해 보세요</h2><p>숫자·기한을 고치고, 확인되지 않은 주장을 구분하고, 빠진 내용을 보완하세요.</p><label class="wp-field">내가 직접 수정한 결과<textarea data-wp-field="draft" maxlength="10000" rows="8">${escape(run.draft)}</textarea></label><label class="wp-checkline"><input type="checkbox" data-wp-field="reviewed" ${run.reviewed?'checked':''}> 제공된 자료와 수정한 결과를 직접 대조했습니다.</label><p class="wp-note">자유 문장의 정확성은 자동 평가하지 않습니다.</p><div class="wp-actions">${wpButton('실습 마무리','complete','','primary')}${wpButton('작성 중 결과 TXT 내려받기','export','','quiet')}</div></section>`:''}<div class="wp-actions">${wpButton('업무·조건 다시 선택','setup','','quiet')}</div>`;
}
function wpPromptGuide(){return wp.model.checkPrompt(wp.value.run.prompt).map(c=>`<li>${c.met?'✓ 단서 있음':'○ 더 적어보기'} · ${escape(c.label)}</li>`).join('');}
function wpResult(){
  const run=wp.value.run,result=run.result,next=wp.model.nextTaskSuggestion(wp.value);
  return `<div class="wp-section-head"><h2>검토하고, 직접 고쳤어요.</h2><p>${escape(wp.model.TASKS[run.task].name)} · 첫 근거 확인 ${result.filter(c=>c.correct).length}/${result.length}</p><p class="wp-note">정해진 확인 항목의 결과입니다. 자유 문장의 정확성이나 실제 업무 능력·효율 향상을 측정한 점수가 아닙니다.</p></div><label class="wp-field">내가 수정한 결과<textarea data-wp-field="finished" readonly rows="7">${escape(run.draft)}</textarea></label><div class="wp-actions">${wpButton('결과 TXT 내려받기','export','','primary')}</div><section class="wp-next"><h3>다음에는 ${next.focus?escape(wp.model.FOCUS[next.focus]):'다른 업무의 근거 확인'}</h3><p>${next.focus?`${escape(wp.model.TASKS[next.task].name)}에서 이번에 놓친 유형을 먼저 확인하도록 제안합니다. 선택한 업무에 그 유형이 있을 때 우선 제시하며, 업무와 조건은 직접 바꿀 수 있어요. 반복 정답만으로 능력 향상을 판단하지 않습니다.`:'새로운 자료에서도 근거를 구분할 수 있는지 다른 업무로 확인해 보세요.'}</p>${wpButton('다음 실습 고르기','next','','quiet')}</section><section class="wp-feedback"><h3>이번 구성은 어땠나요?</h3><p class="wp-note">직접 고른 피드백을 다음 분량 추천에 사용합니다.</p><div class="wp-actions">${Object.entries({helpful:'도움이 됐어요',too_much:'분량이 많아요',want_more:'더 해보고 싶어요',not_fit:'잘 맞지 않아요'}).map(([id,label])=>wpButton(label,'feedback',`data-id="${id}" aria-pressed="${run.feedback===id}" ${run.feedback?'disabled':''}`,'small quiet')).join('')}</div></section>`;
}
function wpHistory(){return `<div class="wp-section-head"><h2>내 실습 기록</h2><p>완료한 실습을 최대 20개까지 보관합니다. 이 계정·이 브라우저에서만 확인합니다.</p></div>${wp.value.history.length?[...wp.value.history].reverse().map(h=>`<article class="wp-history"><h3>${escape(wp.model.TASKS[h.task].name)}</h3><p>${escape(new Date(h.at).toLocaleString('ko-KR'))} · 첫 근거 확인 ${Number(h.correct)}/${Number(h.total)}</p><details><summary>직접 수정한 결과 보기</summary><pre class="wp-sample">${escape(h.draft)}</pre></details></article>`).join(''):'<p>아직 완료한 실습이 없어요.</p>'}`;}
function wpDownload(){const text=wp.model.exportText(wp.value).replace('SYNK SHIFT · 가상 업무 로컬 실습','SYNK 내 작업실 · AI 업무 연습'),blob=new Blob([text],{type:'text/plain;charset=utf-8'});if(blob.size>65536)throw new Error('내보낼 내용은 64 KB 이내로 줄여 주세요.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='synk-shift-practice.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function wpActive(){return !!state.user&&state.user.id===wp.userId&&state.tab==='workroom'&&wr.view==='practice'&&!!wp.value;}
function wpCaptureEdit(){const el=document.activeElement;if(!wpActive()||!el?.closest?.('.wp-practice')||!el.matches('textarea,input,select'))return null;return {userId:wp.userId,field:el.dataset.wpField,check:el.dataset.wpCheck,part:el.dataset.wpPart,value:el.value,start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection,scroll:el.scrollTop,composing:wp.composing};}
function wpRestoreEdit(edit){if(!edit||!wpActive()||edit.userId!==wp.userId)return;const selector=edit.field?`[data-wp-field="${CSS.escape(edit.field)}"]${edit.field==='task'?`[value="${CSS.escape(edit.value)}"]`:''}`:`[data-wp-check="${CSS.escape(edit.check)}"][data-wp-part="${CSS.escape(edit.part)}"]`,el=document.querySelector(selector);if(!el||el.disabled)return;el.focus({preventScroll:true});if(typeof edit.start==='number')el.setSelectionRange(edit.start,edit.end,edit.direction);el.scrollTop=edit.scroll;}
document.addEventListener('compositionstart',event=>{if(event.target.closest?.('.wp-practice'))wp.composing=true;});
document.addEventListener('compositionend',event=>{if(event.target.closest?.('.wp-practice'))wp.composing=false;});
document.addEventListener('input',event=>{
  if(!wpActive())return;const field=event.target.dataset.wpField,run=wp.value.run;if(!run||run.step!=='practice')return;
  if(field==='prompt'){run.prompt=event.target.value;const guide=document.getElementById('wp-prompt-guide');if(guide)guide.innerHTML=wpPromptGuide();wpSave();}
  if(field==='draft'){run.draft=event.target.value;run.reviewed=false;const box=document.querySelector('[data-wp-field="reviewed"]');if(box)box.checked=false;wpSave();}
});
document.addEventListener('change',event=>{
  if(!wpActive())return;const el=event.target,field=el.dataset.wpField,run=wp.value.run;
  if(field==='save'){
    if(!el.checked)try{localStorage.removeItem(wpKey(wp.userId));}catch{el.checked=wp.value.save;wp.error='저장 기록을 지우지 못했어요. 브라우저의 사이트 저장소 설정을 확인해 주세요.';render();return;}
    wp.value.save=el.checked;if(wp.value.profile)wpSave();else{wp.storageMessage=el.checked?'첫 실습을 시작하면 이 계정의 기록을 저장합니다.':'이 창에서만 진행합니다.';wpStatus();}return;
  }
  if(['task','goal','minutes','support'].includes(field)){wp.value.settings[field]=field==='minutes'?Number(el.value):el.value;wpSave();return;}
  if(field==='reviewed'&&run?.step==='practice'){run.reviewed=el.checked;wpSave();return;}
  if(el.dataset.wpCheck&&run?.step==='practice'&&!run.result&&run.checkIds.includes(el.dataset.wpCheck)&&['kind','source'].includes(el.dataset.wpPart)){run.answers[el.dataset.wpCheck]={...run.answers[el.dataset.wpCheck],[el.dataset.wpPart]:el.value};wpSave();}
});
document.addEventListener('submit',event=>{
  if(!event.target.matches?.('[data-wp-setup]')||!wpActive())return;event.preventDefault();
  try{wp.value=wp.model.startRun(wp.value,{...wp.value.settings},wpEngine(),new Date().toISOString(),wpScope(wp.userId));wp.mode='practice';wp.error='';wpSave();render();}catch(error){wp.error=error.message;render();}
});
document.addEventListener('click',event=>{
  const el=event.target.closest?.('[data-action^="practice-"]');if(!el||el.disabled||!state.user)return;const action=el.dataset.action.slice(9);
  if(action==='retry'){if(!wpEngine()){location.reload();return;}wp.error='';void wpEnsure();return;}if(!wpActive())return;wp.error='';
  try{
    if(action==='template'){wp.value.run.prompt=wp.model.TASKS[wp.value.run.task].template;wpSave();}
    else if(action==='check'){if(wp.value.run.prompt.trim().length<20)throw new Error('요청문을 20자 이상 작성해 주세요.');const result=wp.model.evaluate(wp.value.run);if(result.some(c=>!c.answered))throw new Error('모든 항목의 판단과 자료 번호를 골라 주세요.');wp.value.run.result=result;wpSave();}
    else if(action==='complete'){wp.value=wp.model.completeRun(wp.value,wpEngine(),new Date().toISOString(),wpScope(wp.userId));wpSave();}
    else if(action==='feedback'){wp.value=wp.model.giveFeedback(wp.value,el.dataset.id,wpEngine(),new Date().toISOString(),wpScope(wp.userId));wpSave();}
    else if(action==='setup')wp.mode='setup';
    else if(action==='next'){wp.value.settings.task=wp.model.nextTaskSuggestion(wp.value).task;wp.mode='setup';}
    else if(action==='history')wp.mode='history';
    else if(action==='back')wp.mode='practice';
    else if(action==='export'){wpDownload();return;}
    else if(action==='ask-clear')wp.confirmClear=true;
    else if(action==='cancel-clear')wp.confirmClear=false;
    else if(action==='clear'){try{localStorage.removeItem(wpKey(wp.userId));}catch{throw new Error('저장 기록을 지우지 못했어요. 브라우저의 사이트 저장소 설정을 확인해 주세요.');}wp.value=wp.model.newState();wp.mode='practice';wp.confirmClear=false;wp.storageMessage='이 계정의 실습 기록을 비웠어요.';}
    else if(action==='desk'||action==='publish'){wr.view=action==='desk'?'desk':'tools';if(action==='publish'&&typeof makerTools!=='undefined')makerTools.view='publish';}
    render();if(action==='check')document.getElementById('wp-edit-title')?.focus({preventScroll:false});
  }catch(error){wp.error=error.message;render();}
});
