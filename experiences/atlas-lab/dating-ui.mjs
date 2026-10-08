import { createDatingAccount } from './dating-account.mjs';
import { getDiscoveryGuidance, getDiscoveryReadiness } from './discovery-guidance.mjs';
import { compareCandidates, getDisclosureDifferences, getPreferenceSummary } from './dating-insights.mjs';
import { getJourneyFocus, getSchedulePreparation, getRescheduleDraft } from './dating-journey.mjs';
import { createDatingDelivery } from './dating-delivery.mjs';
import { createDatingCheckpoint } from './dating-checkpoint.mjs';
import { getLiveChange, isAccountAccessLost } from './dating-live.mjs';
import { MEETING_REGION_OPTIONS, MAX_MEETING_REGIONS, MEETING_REGION_NOTE, formatMeetingRegions } from './meeting-regions.mjs';
import { resolvePreferenceDeadline } from './preference-deadline.mjs';
import { DISCOVERY_FIELDS } from './discovery.mjs';
import { getCandidateHighlights } from './candidate-highlights.mjs';
import { getPublicProfilePreview } from './public-profile-preview.mjs';
import { getProfileEditingBasis } from './profile-editing-drafts.mjs';
import { getOnboardingDraftBasis } from './onboarding-drafts.mjs';

const $ = id => document.getElementById(id), el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const append = (node, ...children) => { node.append(...children.filter(Boolean)); return node; };
const para = (text, cls = '') => el('p', text, cls);
const button = (text, action, key = '', primary = false) => { const b = el('button', text, primary ? 'primary' : ''); b.type = 'button'; b.dataset.action = key; b.disabled = busy; b.addEventListener('click', action); return b; };
const link = (text, href) => { const a = el('a', text, 'button'); a.href = href; return a; };
const details = title => append(el('details', null, 'details'), el('summary', title));
const field = (form, text, type = 'text', value = '', name = '') => { const id = `input-${++fieldId}`; const label = el('label', text), input = el(type === 'textarea' ? 'textarea' : 'input'); input.id = id; label.htmlFor = id; if (type !== 'textarea') input.type = type; input.value = value; input.name = name; form.append(label, input); return input; };
const check = (form, text, value, name) => { const label = el('label', null, 'check'), input = el('input'); input.type = 'checkbox'; input.checked = value; input.name = name; append(label, input, document.createTextNode(text)); form.append(label); return input; };
const select = (form, text, values, name) => { const label = el('label', text), input = el('select'); input.name = name; input.id = `input-${++fieldId}`; label.htmlFor = input.id; for (const [value, title] of values) { const o = el('option', title); o.value = value; input.append(o); } form.append(label, input); return input; };
const localMinute=at=>at?new Date(Date.parse(at)-new Date(at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
const livePriorityDeadline=d=>{
  const target=d?.priorities?.context!=null&&!d.priorities?.expired?.context&&!d.context?.closed?'context':'baseline';
  return d?.priorities?.expired?.[target]===true?null:d?.priorities?.deadlines?.[target]||null;
};
function deadlineControl(form,{scope,name,value='',mode:initialMode,limits=()=>({})}){
  const group=el('div',null,'deadline-control');group.dataset.deadlineControl=name;
  const targets=[...scope.options].map(option=>option.value);
  const mode=select(group,'언제까지 사용할까요?',[['scope','고른 범위대로 사용'],['today','오늘까지만 · 한국시간'],...(targets.includes('context')?[['context','이번 추천 동안']]:[]),['custom','날짜 직접 지정']],`${name}-mode`);
  const input=field(group,'날짜 직접 지정 (기기 시간)','datetime-local',value,name),summary=para('','hint');group.append(summary);form.append(group);
  mode.value=initialMode&&[...mode.options].some(option=>option.value===initialMode)?initialMode:value?'custom':'scope';
  const resolve=()=>resolvePreferenceDeadline({mode:mode.value,target:scope.value,at:view.asOf,allowedTargets:targets,
    ...(mode.value==='custom'?{until:input.value?new Date(input.value).toISOString():undefined}:{}),...limits(scope.value)});
  const refresh=()=>{try{summary.textContent=resolve().summary;}catch{summary.textContent=mode.value==='custom'&&!input.value?'날짜와 시간을 직접 골라 주세요.':'현재 답과 종료 시점을 다시 확인해 주세요.';}};
  mode.addEventListener('change',()=>{
    if(mode.value==='context'&&scope.value!=='context'){scope.value='context';scope.dispatchEvent(new Event('change',{bubbles:true}));}
    if(mode.value==='scope'||mode.value==='context')input.value='';
    if(mode.value==='today'){try{input.value=localMinute(resolve().until);}catch{input.value='';}}
    refresh();input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  input.addEventListener('input',()=>{mode.value=input.value?'custom':'scope';refresh();});
  scope.addEventListener('change',()=>{if(mode.value==='context'&&scope.value!=='context')mode.value='scope';refresh();});
  group.refreshDeadline=refresh;refresh();
  return {input,mode,resolve:()=>{if(!input.reportValidity())return null;try{return resolve();}catch{notice('사용할 범위와 기한을 다시 확인해 주세요. 현재 답이나 회차보다 늦게 끝나도록 정할 수 없어요.');return null;}}};
}
function deadlineConfirmation(result,label,after){return {label,summary:result.summary,after};}
function answerReturn(field,end){
  const layer=field?.baseline,until=layer?.provenance?.until;
  if(layer?.state!=='known'||until&&end&&Date.parse(until)<=Date.parse(end))return '끝난 뒤 유효한 평소 답이 없어 다시 확인해야 해요.';
  return until&&!end?`끝나는 시점에 유효한 평소 답을 사용해요. 현재 평소 답은 ‘${layer.valueLabel}’이에요.`:`끝난 뒤 평소 답 ‘${layer.valueLabel}’로 돌아가요.`;
}
function priorityReturn(end){
  const d=view.discovery,expired=d?.priorities?.expired?.baseline===true,until=d?.priorities?.deadlines?.baseline;
  const fields=expired||until&&end&&Date.parse(until)<=Date.parse(end)?[]:d?.priorities?.baseline||[];
  const names=fields.map(id=>d.fields.find(field=>field.id===id)?.label).filter(Boolean);
  return names.length?`끝난 뒤 그때 유효한 평소 중요 기준을 사용해요. 현재 평소 기준: ${names.join(', ')}.`:'끝난 뒤 유효한 평소 중요 기준이 없어 별도의 중요도 없이 비교해요. 필수조건은 그대로예요.';
}
function regionPicker(form, title, selected, name) {
  const group=el('fieldset',null,'region-picker'), choices=[];
  group.append(el('legend',title));group.dataset.regionPicker=name;
  const other=details('서울 외 지역'), count=para('', 'hint');
  for(const option of MEETING_REGION_OPTIONS){
    const holder=option.id.startsWith('seoul-')?group:other;
    const input=check(holder,option.label,false,`${name}-${option.id}`);input.value=option.id;
    if(option.detail)input.parentElement.append(para(option.detail,'hint'));
    choices.push(input);
  }
  const update=()=>{count.textContent=`선택 ${choices.filter(input=>input.checked).length}개 · 최대 ${MAX_MEETING_REGIONS}개`;
    if(choices.some(input=>input.checked&&!input.value.startsWith('seoul-')))other.open=true;};
  group.addEventListener('change',update);
  Object.defineProperty(group,'value',{get:()=>JSON.stringify(choices.filter(input=>input.checked).map(input=>input.value)),set:value=>{
    let ids=value; if(typeof ids==='string'){try{ids=JSON.parse(ids);}catch{ids=[];}}
    if(!Array.isArray(ids))ids=[];for(const input of choices)input.checked=ids.includes(input.value);update();
  }});
  group.value=selected||[];append(group,other,count,para(MEETING_REGION_NOTE,'hint'));form.append(group);return group;
}
const uuid = () => crypto.randomUUID();
let fieldId = 0, view = null, page = 'discover', busy = false, generation = 0, reads = 0, demo = false, config = {}, timer, disposed = false, dirty = false;
let pageSuspended = false, pageEpoch = 0, resumeRefresh = false;
let pendingPreview = null, appliedPreview = null, focusedPreference = null;
let previewReturnPage = null;
let correctionSource = null;
let focusedPair = null;
let conditionalContactDraft = null;
let comparisonSelection = null;
// Raw drafts live only in this tab, never in browser storage or a server request.
const profileEditingDrafts = new Map();
let restoringProfileDrafts = false, publicPreviewReturn = null, pendingProfileSave = null;
let onboardingDraft = null, pendingOnboardingSave = null;
const preferenceDrafts = new Map();
const openForms = new Set();
const reflectionTopics = new Map();
const rescheduleDrafts = new Map();
const scheduleDrafts = new Map();
const alignmentDisclosure = new Map();
const client = createDatingAccount({ onChange: next => { config = next; } });
const checkpoint = createDatingCheckpoint({ storage:window.sessionStorage, binding:()=>client.checkpointBinding({demo}) });
const delivery = createDatingDelivery({ request: (...args) => client.request(...args), idFactory: uuid, checkpoint });
let queuedView = null, polling = false;
let renderVersion=0, renderedPage=null;
let syncState={status:'checking',lastCheckedAt:null};
const pollFailureText='새 응답을 확인하지 못했어요. 연결을 확인한 뒤 다시 불러와 주세요.';
const centralBlocked = v => !!v?.centralAvailability && v.centralAvailability.status!=='active';
function syncPanel() {
  const box=$('sync-status'), label=$('sync-label'), time=$('sync-time'); if (!box) return;
  box.hidden=!view && syncState.status==='checking';
  const text={checking:'연결을 확인하고 있어요.',connected:'최신 상태를 확인했어요.',offline:'지금은 최신 상태를 확인하지 못했어요. 연결이 돌아오면 다시 확인해요.',unavailable:'계정의 현재 이용 상태를 다시 확인해 주세요.'}[syncState.status];
  if (label.textContent!==text) label.textContent=text;
  time.textContent=syncState.lastCheckedAt ? `마지막 확인 ${new Date(syncState.lastCheckedAt).toLocaleTimeString('ko-KR')}` : '';
  if (syncState.lastCheckedAt) time.dateTime=syncState.lastCheckedAt; else time.removeAttribute('datetime');
}
function syncSucceeded() { syncState={status:'connected',lastCheckedAt:new Date().toISOString()}; if ($('notice').textContent===pollFailureText) notice(''); syncPanel(); }
function syncFailed(error) { syncState={...syncState,status:isAccountAccessLost(error)?'unavailable':'offline'}; syncPanel(); }
function notice(text) { $('notice').textContent = text; }
function clearPrivateDrafts() { delivery.clear(); queuedView = null; pendingPreview = null; previewReturnPage = null; appliedPreview = null; focusedPreference = null; correctionSource = null; focusedPair = null; conditionalContactDraft = null; comparisonSelection = null; profileEditingDrafts.clear(); publicPreviewReturn = null; pendingProfileSave = null; onboardingDraft = null; pendingOnboardingSave = null; preferenceDrafts.clear(); openForms.clear(); reflectionTopics.clear(); rescheduleDrafts.clear(); scheduleDrafts.clear(); alignmentDisclosure.clear(); dirty = false; }
const editingInputs = node => [...node.querySelectorAll('input,select,textarea')];
const editingValues = node => editingInputs(node).map(input=>({name:input.name,value:input.value,checked:input.checked}));
function pruneProfileEditingDrafts() {
  for (const [key,draft] of profileEditingDrafts) if (draft.basis!==getProfileEditingBasis(view,key)) profileEditingDrafts.delete(key);
  if (!getProfileEditingBasis(view,'profile') || publicPreviewReturn?.accountId!==view?.accountId) publicPreviewReturn=null;
}
function editProfileLocation(key) {
  if(key==='profile') {
    if(page!=='settings')setPage('settings');
    const target=$('content').querySelector('[data-profile-editor]');
    if(target){target.open=true;target.querySelector('[name="nickname"]')?.focus({preventScroll:true});target.scrollIntoView({block:'start'});}
  } else { if(!['profile','settings'].includes(page))setPage('profile');openDisclosureField(key); }
}
function bindProfileEditing(node,key) {
  node.dataset.editingScope=key;
  const basis=getProfileEditingBasis(view,key),original=JSON.stringify(editingValues(node));
  const status=append(el('div',null,'editing-draft'),para('아직 저장하지 않았어요. 화면을 옮겨도 이 탭에서 이어 쓸 수 있어요. 탭을 닫거나 새로고침하면 사라져요.','hint'));
  status.dataset.editingDraft=key;status.hidden=true;
  status.append(button('이 항목의 작성 내용 버리기',()=>{
    profileEditingDrafts.delete(key);render();editProfileLocation(key);notice('작성 중인 내용만 버렸어요. 저장된 내용은 그대로예요.');
  },key==='profile'?'discard-profile-draft':`discard-public-draft-${key}`));node.append(status);
  const remember=()=>{
    if(restoringProfileDrafts)return;
    const values=editingValues(node);
    if(basis && basis===getProfileEditingBasis(view,key) && JSON.stringify(values)!==original)profileEditingDrafts.set(key,{basis,values,open:[...node.querySelectorAll('details')].map(n=>n.open)});
    else profileEditingDrafts.delete(key);
    status.hidden=!profileEditingDrafts.has(key);
  };
  node.addEventListener('input',remember);node.addEventListener('change',remember);
}
function restoreProfileEditingDrafts() {
  restoringProfileDrafts=true;
  try {
    for(const node of $('content').querySelectorAll('[data-editing-scope]')) {
      const key=node.dataset.editingScope,draft=profileEditingDrafts.get(key);if(!draft)continue;
      const inputs=editingInputs(node);if(inputs.length!==draft.values.length||inputs.some((input,i)=>input.name!==draft.values[i].name)){profileEditingDrafts.delete(key);continue;}
      inputs.forEach((input,i)=>{input.value=draft.values[i].value;if(['checkbox','radio'].includes(input.type))input.checked=draft.values[i].checked;});
      // Refresh region counts and expiration controls; confirmations are deliberately rebuilt.
      inputs[0]?.dispatchEvent(new Event('change',{bubbles:true}));
      [...node.querySelectorAll('details')].forEach((n,i)=>{n.open=draft.open[i]===true;});
      for(const control of node.querySelectorAll('[data-deadline-control]'))control.refreshDeadline?.();
      for(let parent=node;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      node.querySelector('[data-editing-draft]').hidden=false;dirty=true;
    }
  } finally {restoringProfileDrafts=false;}
}
function returnToPublicPreview() {
  const target=publicPreviewReturn;if(!target||target.accountId!==view?.accountId)return false;
  publicPreviewReturn=null;page=target.page;render();
  const section=$('content').querySelector('[data-public-profile-preview]');if(!section)return false;
  section.open=true;
  const row=target.key==='profile'?section.querySelector('[data-preview-profile]'):[...section.querySelectorAll('[data-preview-public-field]')].find(n=>n.dataset.previewPublicField===target.key);
  const focus=row||section;focus.tabIndex=-1;focus.focus({preventScroll:true});focus.scrollIntoView({block:'start'});return true;
}
function editFromPublicPreview(key) {
  const back={accountId:view.accountId,page,key};editProfileLocation(key);publicPreviewReturn=back;updatePanels();
}
function syncControls() {
  const pending = !!delivery.snapshot();
  document.querySelectorAll('button').forEach(b => { b.disabled = busy || b.dataset.fixedDisabled === 'true' || pending && !['delivery-check','delivery-retry','signout','reload'].includes(b.dataset.action); });
  document.querySelectorAll('#content input,#content select,#content textarea').forEach(input => {
    const saving=pendingProfileSave?.accountId===view?.accountId && pendingProfileSave?.keys.includes(input.closest('[data-editing-scope]')?.dataset.editingScope);
    const starting=pendingOnboardingSave?.accountId===view?.accountId && input.closest('[data-onboarding-form]');
    const locked=pending||saving||starting;
    if (locked && !input.disabled) { input.dataset.deliveryLocked = 'true'; input.disabled = true; }
    else if (!locked && input.dataset.deliveryLocked === 'true') { delete input.dataset.deliveryLocked; input.disabled = false; }
  });
}
function liveFormKey(v, form) {
  const pairId = form.closest('[data-pair]')?.dataset.pair;
  const pair = v?.pairs?.find(item => item.pairId === pairId);
  const fieldId=form.closest('[data-preference-field]')?.dataset.preferenceField;
  const decisionId=form.closest('[data-experience],[data-followup],[data-allowance-review]')?.dataset;
  const names=[...form.querySelectorAll('input,select,textarea')].map(n=>[n.tagName,n.type,n.name]);
  const buttons=[...form.querySelectorAll('button[data-action]')].map(n=>n.dataset.action);
  const ownSource=form.closest('[data-alignment]') ? [pair?.alignment?.key,pair?.alignment?.contextKey,pair?.alignment?.proposalVersion,pair?.alignment?.selectedOptionId,pair?.alignment?.canProposeOption,pair?.alignment?.canCancelOption]
    : fieldId ? [v?.discovery?.context?.id,v?.discovery?.context?.closed,v?.discovery?.fields?.find(f=>f.id===fieldId)]
    : form.closest('[data-conditional-preference]') ? [v?.discovery?.context?.id,v?.discovery?.conditionalPreference,v?.discovery?.fields?.find(f=>f.id==='wants.contact')]
    : decisionId ? v?.experience?.records?.find(r=>r.id===(decisionId.experience||decisionId.followup||decisionId.allowanceReview))
    : names.some(n=>n[2].startsWith('priority-')) ? [v?.discovery?.context?.id,v?.discovery?.priorities]
    : names.some(n=>['nickname','region','intro'].includes(n[2]) || n[2].startsWith('public-')) ? v?.profile
    : names.some(n=>n[2].startsWith('compare-') || n[2]==='target') ? (v?.candidates||[]).map(c=>c.accountId)
    : null;
  const meetingId=form.closest('[data-meeting-reflection],[data-criterion-review]')?.dataset;
  const meeting=meetingId && pair?.view?.appointments?.find(a=>a.id===(meetingId.meetingReflection||meetingId.criterionReview));
  const reviewId=form.closest('[data-new-criterion],[data-criterion-review]')?.dataset;
  const criterion=reviewId&&pair?.criterionReviews?.find(item=>item.appointmentId===(reviewId.newCriterion||reviewId.criterionReview));
  return JSON.stringify([generation,page,v?.accountId,v?.status,v?.adult?.selfDeclared,v?.paused,v?.consents,
    ownSource, pairId ? [pairId,pair?.status,pair?.scheduleDraftBasis,pair?.introduction?.current?.id,pair?.introduction?.current?.status,pair?.introduction?.accepted,pair?.view?.canPropose,pair?.view?.currentId,meeting] : null,
    criterion,names,buttons]);
}
const liveForms=()=>[...$('content').querySelectorAll('form,.form')].filter(form=>form.querySelector('input,select,textarea') && !form.parentElement?.closest('form,.form') && !form.matches('[data-editing-scope],[data-onboarding-form]') && !form.querySelector('[data-editing-scope]'));
function captureLiveInputs(next) {
  return liveForms().filter(form=>form.dataset.liveDirty==='true').map(form => ({ key:liveFormKey(view,form),
    nextKey:liveFormKey(next,form), values:[...form.querySelectorAll('input,select,textarea')].map(n=>({value:n.value,checked:n.checked})),
    open:form.closest('details')?.open })).filter(item=>item.key===item.nextKey);
}
function restoreLiveInputs(saved) {
  const forms=liveForms();
  for (const item of saved) { const matches=forms.filter(form=>liveFormKey(view,form)===item.key); if (matches.length!==1) continue; const form=matches[0];
    const inputs=[...form.querySelectorAll('input,select,textarea')]; if (inputs.length!==item.values.length) continue;
    inputs.forEach((input,i)=>{input.value=item.values[i].value; if (['checkbox','radio'].includes(input.type)) input.checked=item.values[i].checked;});
    for(const control of form.querySelectorAll('[data-deadline-control]'))control.refreshDeadline?.();
    if (form.closest('details') && item.open!==undefined) form.closest('details').open=item.open;
    form.dataset.liveDirty='true'; dirty=true;
  }
}
function applyLiveView(next) {
  if (view?.accountId!==next?.accountId || next?.status!=='active' || centralBlocked(next)) { clearPrivateDrafts(); view=next; render(); return; }
  const saved=captureLiveInputs(next); queuedView=null;
  if (pendingPreview) { pendingPreview=null; page=previewReturnPage||page; previewReturnPage=null; }
  appliedPreview=null; view=next; render(); restoreLiveInputs(saved); syncControls();
}
function updatePanels() {
  document.querySelectorAll('[data-live-notice],[data-delivery-notice],[data-editing-notice],[data-preview-return]').forEach(n=>n.remove());
  if (!view) return;
  const area=$('content');
  if(profileEditingDrafts.size){const key=profileEditingDrafts.keys().next().value;
    const box=append(el('section',null,'summary'),para(`저장하지 않은 소개·공개 답 ${profileEditingDrafts.size}개가 이 탭에 남아 있어요.`),button('작성 중인 내용으로 이동',()=>editProfileLocation(key),'resume-editing-draft'));
    box.dataset.editingNotice='true';area.prepend(box);
  }
  if(publicPreviewReturn){const box=append(el('section',null,'summary'),para('수정한 항목을 저장하면 공개 미리보기로 돌아가요. 지금 돌아가면 저장된 내용만 보여요.','hint'),button('저장된 공개 미리보기로 돌아가기',returnToPublicPreview,'return-public-preview'));box.dataset.previewReturn='true';area.prepend(box);}
  for(const control of area.querySelectorAll('[data-deadline-control]'))control.refreshDeadline?.();
  for (const p of area.querySelectorAll('p')) {
    if (delivery.snapshot() && p.textContent.includes('아직 상대에게 보내지 않았어요.')) { p.dataset.beforeDeliveryText=p.textContent; p.textContent=p.textContent.replace('아직 상대에게 보내지 않았어요.','전송 결과는 아직 확인 중이에요.'); }
    else if (!delivery.snapshot() && p.dataset.beforeDeliveryText) { p.textContent=p.dataset.beforeDeliveryText; delete p.dataset.beforeDeliveryText; }
  }
  if (queuedView) { const box=append(el('section',null,'summary'),el('h2','새 응답이나 변경이 있어요.'),para('작성 중인 입력은 그대로 두었어요. 최신 상태를 확인하면 유효한 입력을 이어서 보여드려요.'),button('입력 유지하고 최신 상태 확인',()=>run(async()=>{await load();},'최신 상태를 확인했어요.'),'live-apply'));
    box.dataset.liveNotice='true'; box.setAttribute('role','status'); area.prepend(box); }
  const waiting=delivery.snapshot();
  if (waiting) { const box=append(el('section',null,'summary'),el('h2','전송 결과를 아직 확인하지 못했어요.'),para(waiting.checkOnly ? '이 화면을 다시 열었어요. 앞서 보낸 요청의 저장 여부를 확인할 수 있어요. 작성한 원문은 이 기기에 남기지 않아 여기서 다시 보내지는 않아요.' : '이미 저장됐을 수 있어요. 먼저 저장 여부를 확인해 주세요. 확인되지 않으면 같은 내용으로 다시 보낼 수 있어요.'),button('저장 여부 확인',()=>recoverDelivery(false),'delivery-check'),!waiting.checkOnly && button('같은 내용으로 다시 보내기',()=>recoverDelivery(true),'delivery-retry'));
    box.dataset.deliveryNotice='true'; box.setAttribute('role','status'); area.prepend(box); }
  syncControls();
}
async function recoverDelivery(retry) {
  return run(async()=>{
    const actorId=view?.accountId;
    const result=await delivery[retry?'retry':'check']({actorId,demo});
    syncSucceeded();
    if (!retry && result.status==='not-found') { const checkOnly=delivery.snapshot()?.checkOnly; applyLiveView(result.currentView); notice(checkOnly ? '저장 확인 기록이 아직 없어요. 원래 요청이 처리 중일 수도 있어요. 여기서는 다시 보내지 않고 저장 여부만 다시 확인해 주세요.' : '저장 확인 기록이 아직 없어요. 요청이 처리 중일 수도 있어요. 다시 확인하거나 같은 내용으로 다시 보내 주세요.'); updatePanels(); return; }
    const next=retry?result.view:result.currentView;
    pendingPreview=null; previewReturnPage=null; correctionSource=null; appliedPreview=null;
    const savedKeys=pendingProfileSave?.accountId===next?.accountId?pendingProfileSave.keys:[];
    for(const key of savedKeys)profileEditingDrafts.delete(key);pendingProfileSave=null;
    if(pendingOnboardingSave?.accountId===next?.accountId && next.onboarding?.complete){onboardingDraft=null;page='discover';}
    pendingOnboardingSave=null;
    applyLiveView(next);if(savedKeys.includes(publicPreviewReturn?.key))returnToPublicPreview();
    if(next.onboarding?.complete===false)focusOnboardingMissing();
    notice('이 요청이 저장된 것을 확인했어요. 이어지는 항목이 있다면 현재 화면에서 다시 확인해 주세요.');
    if (result.checkpointCleanupFailed) notice('저장은 확인됐어요. 이 기기의 확인 표식을 정리하지 못해 다음 접속 때 다시 확인할 수 있어요.');
  });
}
function preferenceDraftKey(field) {
  if (!field || !view?.discovery || view.status !== 'active' || view.paused || !view.adult?.selfDeclared || !view.consents?.storePreferences) return null;
  return JSON.stringify([generation, view.accountId, view.discovery.context.id, view.discovery.context.closed,
    field.id, field.source, field.effective, field.baseline, field.context, field.required]);
}
const scheduleSlot = (pairId, formKey) => JSON.stringify([pairId, formKey]);
function scheduleDraftKey(pair, formKey) {
  if (!view || view.status !== 'active' || !view.adult?.selfDeclared || !view.consents?.storePreferences
    || view.paused || !pair?.view || pair.status !== 'active' || pair.paused || !pair.introduction?.accepted
    || !pair.introduction.current?.id || !/^[a-f0-9]{64}$/.test(pair.scheduleDraftBasis || '')) return null;
  const allowed = formKey === 'new' ? pair.view.canPropose : pair.view.appointments?.some(item => `${item.id}:${item.proposal.version}` === formKey && item.canRevise);
  return allowed ? JSON.stringify([generation, view.accountId, pair.pairId, pair.scheduleDraftBasis, formKey]) : null;
}
function pruneInputDrafts() {
  for (const [fieldId, draft] of preferenceDrafts) {
    const key = preferenceDraftKey(view?.discovery?.fields.find(field => field.id === fieldId));
    if (!key || draft.key !== key) preferenceDrafts.delete(fieldId);
  }
  for (const [slot, draft] of scheduleDrafts) {
    const pair = view?.pairs?.find(item => item.pairId === draft.pairId), key = scheduleDraftKey(pair, draft.formKey);
    if (!key || draft.key !== key) scheduleDrafts.delete(slot);
  }
}
function restoreScheduleForms() {
  for (const form of document.querySelectorAll('[data-schedule-form]')) {
    const slot = scheduleSlot(form.dataset.schedulePair, form.dataset.scheduleForm), draft = scheduleDrafts.get(slot);
    const container = form.closest('details');
    if (draft && draft.key === form.dataset.scheduleDraftKey) {
      if (container) container.open = draft.open;
      if (Object.values(draft.values).some(Boolean)) dirty = true;
    }
    container?.addEventListener('toggle', () => {
      const saved = scheduleDrafts.get(slot);
      if (form.isConnected && saved?.key === form.dataset.scheduleDraftKey) saved.open = container.open;
    });
  }
}
function conditionalContactDraftKey() {
  const discovery = view?.discovery, conditional = discovery?.conditionalPreference;
  if (!conditional?.available || view.status !== 'active' || view.paused || !view.consents?.storePreferences || !view.adult?.selfDeclared) return null;
  const contact = discovery.fields.find(item => item.id === 'wants.contact');
  return JSON.stringify([generation, view.accountId, discovery.context.id, discovery.context.closed,
    contact?.effective, contact?.required, conditional.baseline, conditional.context]);
}
const visibleState = value => JSON.stringify(value, (key, item) => ['recommendationToken', 'asOf'].includes(key) ? null : item);
function setPage(next) { if (next !== 'profile') correctionSource = null; publicPreviewReturn=null; page = next; pendingPreview = null; previewReturnPage = null; dirty = false; notice(''); render(); $('content').focus({ preventScroll: true }); }
function focusPreference(id) {
  focusedPreference = id; setPage('profile');
  const target = [...document.querySelectorAll('[data-preference-field]')].find(n => n.dataset.preferenceField === id);
  if (target) { target.open = true; target.querySelector('select')?.focus(); }
}
function openDisclosureField(id){
  const section=$('content').querySelector('[data-disclosure]');if(!section)return;
  section.open=true;
  const target=[...section.querySelectorAll('[data-public-field]')].find(node=>node.dataset.publicField===id)||section;
  const lifetime=target.querySelector('[data-public-lifetime]');if(lifetime)lifetime.open=true;
  target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
}
function focusDisclosure(id){setPage('profile');openDisclosureField(id);}
function focusPair(id) {
  focusedPair = id; setPage('inbox');
  const target = [...document.querySelectorAll('[data-pair]')].find(n => n.dataset.pair === id);
  if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start', behavior: 'auto' }); }
}
function focusExcluded() {
  const section = document.querySelector('[data-excluded-candidates]');
  if (!section) { notice('현재 공개 범위에서 취소할 이번 제외가 없어요. 최신 추천을 다시 확인해 주세요.'); return; }
  for (let node = section; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
  const target = section.querySelector('[data-action="restore-candidate"]');
  target?.focus({ preventScroll: true }); section.scrollIntoView({ block: 'start', behavior: 'auto' });
  notice('취소할 사람을 직접 골라 주세요. 목록을 열어도 추천 기준은 바뀌지 않아요.');
}
function nextAction() {
  const action = getJourneyFocus(view); if (!action || action.kind === 'recommendation' || action.kind === 'unavailable') return null;
  const section = el('section', null, 'summary journey-focus'); section.dataset.journeyFocus = action.kind;
  append(section, para('지금 이어 할 일', 'eyebrow'), el('h2', action.title), para(action.body), button(action.label, () => action.pairId ? focusPair(action.pairId) : setPage(action.target), 'journey-next', true));
  return section;
}
async function run(fn, success) {
  if (busy) return; busy = true; reads++; const current = generation, beforeRender=renderVersion;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  $('content').setAttribute('aria-busy', 'true');
  try { await fn(); if (current !== generation) return; if (success) notice(success); if (renderVersion===beforeRender || renderedPage!==page) render(); else updatePanels(); }
  catch (error) { if (current === generation) { if (pendingPreview && error.status === 409) pendingPreview.needsRefresh = true; if (isAccountAccessLost(error)) { view = null; clearPrivateDrafts(); syncFailed(error); render(); } else if (error.outcomeUnknown || ['AbortError','TimeoutError'].includes(error.name) || error.status>=500) syncFailed(error); notice(error.outcomeUnknown || delivery.snapshot() ? '전송 결과를 아직 확인하지 못했어요. 저장 여부를 먼저 확인해 주세요.' : error.code === 'preview-stale' ? '후보 정보나 기준이 바뀌었거나 미리보기 시간이 끝났어요. 적용하지 않고 돌아간 뒤 최신 상태에서 다시 비교해 주세요.' : error.status === 409 && !['criterion-review-unavailable', 'restoration-unavailable', 'allowance-review-unavailable'].includes(error.code) ? '다른 화면에서 바뀐 기록이 있어요. 새로고침한 뒤 변경을 다시 확인해 주세요.' : error.message); updatePanels(); } }
  finally { busy = false; if(!delivery.snapshot()){pendingOnboardingSave=null;pendingProfileSave=null;} $('content').removeAttribute('aria-busy'); for(const control of $('content').querySelectorAll('[data-deadline-control]'))control.refreshDeadline?.(); syncControls(); if(resumeRefresh)void pollLive(); }
}
async function load({ quiet = false } = {}) {
  const current = generation, sequence = ++reads, lifecycle = pageEpoch, result = await client.request('/state', undefined, { demo });
  if (current !== generation || sequence !== reads || pageSuspended || lifecycle !== pageEpoch || quiet && busy) return;
  if (view && result.view.revision < view.revision) return;
  syncSucceeded();
  if (view && visibleState(view) !== visibleState(result.view)) appliedPreview = null;
  if (quiet) return result.view;
  if (view) applyLiveView(result.view); else { view = result.view; render(); }
}
async function act(action, message, after) {
  return run(async () => {
    const result = await delivery.send({ actorId:view.accountId, expectedRevision:view.revision, action, demo });
    view = result.view; queuedView=null; appliedPreview = null; after?.();
  }, message);
}
async function multi(actions) {
  for (const action of actions) { const result = await delivery.send({ actorId:view.accountId, expectedRevision:view.revision, action, demo }); view = result.view; queuedView=null; appliedPreview = null; }
}
function discovery(action, message = '선택한 답으로 추천을 다시 살펴봤어요.') { return act({ kind: 'discovery', action }, message); }
function previewDiscovery(action) {
  if (['conditional-set', 'conditional-clear', 'start-context'].includes(action.kind)) correctionSource = null;
  if (correctionSource && !view.experience?.records.some(record => record.id === correctionSource && record.canCorrect === true && ['no', 'partly'].includes(record.responses.intent?.value))) correctionSource = null;
  return requestPreview({ action, ...(correctionSource ? { sourceDecisionId: correctionSource } : {}) });
}
function requestPreview(input,deadlineInfo=null) {
  return run(async () => {
    const result = await client.request('/preview', { expectedRevision: view.revision, ...input }, { demo });
    pendingPreview = result.preview; if(deadlineInfo)pendingPreview.deadlineConfirmation=deadlineInfo; appliedPreview = null; previewReturnPage = page;
    if (!['discover', 'profile'].includes(page)) page = 'profile';
  }, '아직 저장하지 않았어요. 추천의 변화를 확인한 뒤 적용해 주세요.');
}
function startContextPreview(){
  correctionSource=null;
  const ids=[...document.querySelectorAll('[data-candidate]')].filter(node=>!node.closest('details:not([open])')&&node.getClientRects().length).map(node=>node.dataset.candidate);
  return requestPreview({action:{kind:'start-context'},exposedCandidateIds:ids});
}
function previewPanel() {
  if (!pendingPreview) return null;
  const p = pendingPreview, box = el('section', null, 'summary preview'); box.dataset.preview = 'pending';
  append(box, el('h2', '저장하기 전에 달라지는 점'), para(p.summary), para('같은 공개 후보로 비교한 결과예요. 상대의 호감이나 소개 수락을 예측한 것은 아니에요.', 'hint'));
  if (p.changes?.length) {
    const changes = el('div', null, 'preview-criteria'); changes.dataset.previewChanges = 'true';
    for (const change of p.changes) {
      const field = view.discovery?.fields.find(item => item.id === change.field), row = el('div', null, 'reason-detail');
      append(row, el('h3', field?.label || (change.field === 'priorities' ? '나에게 중요한 기준' : change.field === 'conditional.contact' ? '조건을 붙여 허용하는 연락 방식' : '선택한 기준')), para(`지금: ${change.before}`), para(`적용 후: ${change.after}`)); changes.append(row);
    }
    box.append(changes);
  }
  const comparison = el('div', null, 'preview-columns');
  for (const [key, label] of [['before', '지금 기준'], ['after', '바꾼 기준']]) {
    const item = p[key]; if (!item) continue;
    comparison.append(append(el('div'), el('h3', label), para(`비교 가능한 후보 ${item.eligibleIds?.length || 0}명`), para(item.topLabel ? `먼저 살펴볼 사람: ${item.topLabel}` : '먼저 추천할 후보 없음')));
  }
  append(box, comparison);
  if(p.contextTransition){
    const section=append(el('section',null,'context-transition'),el('h3','이번 선택을 마치면 어떻게 달라지나요?'));section.dataset.contextTransition='true';
    for(const item of p.contextTransition.ended||[])append(section,el('h4',item.label),para(`지금: ${item.before}`),para(`새 추천: ${item.after}`));
    if(!p.contextTransition.ended?.length)section.append(para('지금 끝낼 임시 선택은 없어요. 현재 유효한 평소 기준으로 새 추천을 살펴봐요.','hint'));
    const kept=details('그대로 남는 기준');for(const item of p.contextTransition.retained||[])append(kept,para(`${item.label} · ${item.after||item.before}`));
    append(section,kept,para('프로필 공개·초대 동의·이미 수락한 소개와 약속을 바꾸지 않아요. 확인 후 적용할 때만 새 추천으로 넘어가요.','hint'));box.append(section);
  }
  if(p.deadlineConfirmation){const item=p.deadlineConfirmation;const section=append(el('section',null,'reason-detail'),el('h3',`${item.label} · 기한과 끝난 뒤`),para(item.summary),para(item.after,'hint'));section.dataset.deadlineConfirmation='true';box.append(section);}
  for (const [key, label] of [['entered', '새로 비교 가능'], ['left', '비교 대상에서 빠짐']]) if (p[key]?.length) box.append(para(`${label}: ${p[key].map(c => c.label).join(', ')}`));
  const actions = el('div', null, 'actions');
  if (p.sourceDecisionId) box.append(para('이 변경을 앞서 남긴 추천 경험에 연결해, 다음 추천을 본 뒤 다시 돌아볼 수 있어요.', 'hint'));
  if(p.criterionChange){
    const change=p.criterionChange, info=el('section',null,'reason-detail');info.dataset.newCriterionConfirmation='true';
    append(info,el('h3','만남 뒤 직접 확인한 새 기준'),para(`${change.label} · ${change.valueLabel}`),para(`적용 범위: ${change.target==='baseline'?'앞으로도':'이번 추천에서만'}`),para(change.replaceLabel?`대신할 중요 기준: ${change.replaceLabel}`:'기존 중요 기준은 유지해요.'),para(change.until?`종료 시점: ${new Date(change.until).toLocaleString('ko-KR')}`:'별도 종료 시점 없이 고른 범위대로 사용해요.'),para('회고 저장만으로는 적용하지 않아요. 과거의 중요 기준이나 상대의 성향으로 소급하지 않으며, 필수조건은 그대로예요.','hint'));
    box.append(info);
  }
  const leavePreview = () => { page = previewReturnPage || page; pendingPreview = null; previewReturnPage = null; };
  actions.append(button('확인한 변경 적용', () => act({ kind: 'apply-preview', preview: p.token }, '확인한 기준으로 저장했어요.', () => { leavePreview(); appliedPreview = p.summary; correctionSource = null; conditionalContactDraft = null; preferenceDrafts.clear(); }), 'preview-apply', true), button('적용하지 않고 돌아가기', () => {
    if (p.needsRefresh) return run(async () => { await load(); leavePreview(); }, '이 미리보기는 적용하지 않았어요. 최신 기준을 확인하고 돌아왔어요.');
    leavePreview(); render(); notice('추천 기준은 바뀌지 않았어요. 입력한 답을 다시 고칠 수 있어요.');
  }, 'preview-cancel'));
  box.append(actions); return box;
}
function guidancePanel(guidance) {
  const box = el('section', null, 'summary'); box.dataset.guidance = guidance.id;
  const a = guidance.action;
  append(box, el('h2', guidance.title), para(guidance.body), button(a.label, () => {
    if (a.kind === 'answer') {
      focusPreference(a.field);
    } else if (a.kind === 'navigate') setPage(a.page);
    else if (a.kind === 'focus-excluded') focusExcluded();
    else if (a.kind === 'refresh') void run(() => load(), '지금 공개된 답으로 다시 확인했어요.');
    else if(a.kind==='start-context')void startContextPreview();
    else void discovery({ kind: a.kind, ...(a.field ? { field: a.field } : {}) });
  }, 'guidance-action'));
  return box;
}
function readinessPanel() {
  const state=getDiscoveryReadiness(view), section=el('section',null,'readiness');
  section.dataset.readiness=state.status;
  append(section,el('h2','지금 추천 준비 상태'));
  const rows=el('ul',null,'readiness-statuses');
  const preparation={confirmed:'지금 필요한 확인을 마쳤어요.',needed:'지금 확인할 항목이 남아 있어요.',unavailable:'현재 상태를 다시 확인해 주세요.'}[state.preparation.status];
  for (const [label,text,status] of [['필요한 확인',preparation,state.preparation.status],['현재 추천',state.recommendation.title,state.recommendation.status],['추가 질문',state.optional.title,state.optional.status]]) {
    const row=el('li'); row.dataset.readinessItem=status; append(row,el('strong',label),document.createTextNode(` · ${text}`)); rows.append(row);
  }
  section.append(rows);
  const needed=state.preparation.items.filter(item=>item.status==='needed');
  if(needed.length){const more=details('지금 확인할 항목 보기');more.dataset.readinessNeeded='true';const list=el('ul');for(const item of needed)list.append(el('li',item.label));more.append(list);section.append(more);}
  if(state.status==='ready'&&(state.pending.own.length||state.pending.public.length||state.pending.unclassified)) {
    const more=details('다른 후보에서 확인이 남은 항목');more.dataset.readinessPending='true';
    more.append(para('지금 비교할 수 있는 후보는 그대로 살펴볼 수 있어요. 아래 확인이 남았다는 이유로 내 필수조건을 낮출 필요는 없어요.','hint'));
    for(const item of state.pending.own)more.append(para(`${item.label} · 내가 확인할 답이 남아 있어요.`,'hint'));
    for(const item of state.pending.public){const text=para(`${item.label} · 현재 공개 정보 확인이 더 필요해요.`,'hint');text.dataset.readinessPublicField=item.field;more.append(text);}
    if(state.pending.unclassified)more.append(para('현재 공개된 근거만으로 아직 구분할 수 없는 확인도 있어요.','hint'));
    section.append(more);
  }
  return section;
}
function adultVerificationPanel() {
  const verification=view?.adult?.verification; if(!verification?.required)return null;
  const descriptions={pending:['성인 확인 결과를 기다리고 있어요.','확인 전에는 새로운 추천과 소개를 진행하지 않아요. 내 기준과 기록은 관리할 수 있어요.'],
    unverified:['성인 확인이 필요해요.','성인이라는 직접 확인만으로 인증이 완료되지는 않아요. 내 기준과 기록은 관리할 수 있어요.'],
    revoked:['성인 확인을 다시 받아야 해요.','이전 확인이 철회돼 새로운 추천과 소개를 멈췄어요. 현재 확인 결과를 다시 확인해 주세요.'],
    expired:['성인 확인의 유효기간이 끝났어요.','새로운 추천과 소개를 멈췄어요. 내 기준과 기록은 그대로 관리할 수 있어요.'],
    unavailable:['성인 확인 상태를 확인하지 못했어요.','확인 결과를 받기 전까지 새로운 추천과 소개를 진행하지 않아요. 잠시 뒤 다시 확인해 주세요.'],
    'not-connected':['성인 확인을 준비하고 있어요.','아직 확인 결과가 연결되지 않았어요. 확인되지 않은 상태로 새로운 추천과 소개를 진행하지 않아요.']};
  if(verification.status==='verified'&&!verification.resumeRequired)return null;
  const [title,body]=verification.status==='verified' ? ['확인 후 공개·초대 범위를 다시 정해 주세요.','성인 확인 결과를 받았어요. 이전 소개와 수락은 돌아오지 않아요. 다시 공개할 범위와 초대를 직접 정해 주세요.'] : descriptions[verification.status]||descriptions.unavailable;
  const box=append(el('section',null,'summary'),el('h2',title),para(body));box.dataset.adultVerification=verification.status;
  box.append(verification.status==='verified'&&page!=='settings' ? button('공개·초대 범위 확인',()=>setPage('settings'),'adult-resume-settings') : button('현재 확인 상태 다시 불러오기',()=>run(()=>load()),'reload'));
  return box;
}
function noCandidateComparison(discovery) {
  const whatIf = discovery?.whatIf;
  if (!whatIf || whatIf.status !== 'available' || !whatIf.options?.length) return null;
  const section = details('가능한 일정 하나만 달라진다면?'), form = el('div', null, 'form'); section.dataset.whatIf = 'available';
  append(form, para(whatIf.summary), para('실제로 가능한 일정만 골라 주세요. 적용해도 이번 추천에서만 사용하고, 정해 둔 기한이 더 짧으면 그때 끝나요. 상대의 조건과 내 필수조건은 그대로 비교해요.', 'hint'));
  const option = select(form, '비교해 볼 만남 가능 일정', [['', '다른 일정 선택하기'], ...whatIf.options.map(item => [item.id, item.valueLabel])], 'what-if-option');
  const result = el('div'); result.setAttribute('aria-live', 'polite');
  const preview = button('이 일정으로 달라지는 점 확인', () => {
    const chosen = whatIf.options.find(item => item.id === option.value);
    if (!chosen) { notice('실제로 가능한 일정 중 비교해 볼 답을 골라 주세요.'); return; }
    void previewDiscovery(chosen.action);
  }, 'what-if-preview');
  option.addEventListener('change', () => {
    const chosen = whatIf.options.find(item => item.id === option.value); result.replaceChildren();
    if (!chosen) return;
    append(result, para(chosen.summary), para('현재 공개된 정보로 계산한 비교예요. 저장 전에 최신 상태로 다시 확인해요.', 'hint'));
  });
  append(form, result, preview, button('지금 기준을 유지할게요', () => { section.open = false; notice('기준은 바뀌지 않았어요. 가능한 상대가 없다는 이유로 내 답을 바꿀 필요는 없어요.'); }, 'what-if-keep'));
  section.append(form); return section;
}
function heading(kicker, title, text) { return append(el('div'), para(kicker, 'eyebrow'), el('h1', title), text && para(text, 'lead')); }
const goalNames = { comfortable: '부담 없이 편안하게', intent: '원하는 관계 방향에 맞게', pace: '내 속도로 천천히' };
const experience = (action, message = '나만 보는 경험 기록을 저장했어요.') => act({ kind: 'experience', action }, message);
function experienceSettings() {
  const e = view.experience; if (!e) return null;
  const section = details('이번에 내가 바라는 경험'), form = el('div', null, 'form');
  const goal = select(form, '이번 만남에서 가장 바라는 것', [['', '아직 정하지 않기'], ...Object.entries(goalNames)], 'experience-goal'); goal.value = e.goal || '';
  append(form, para('추천을 돌아볼 때 내 기준으로 사용해요. 이 선택만으로 상대의 성향이나 추천 순서를 바꾸지는 않아요.', 'hint'), button('내 경험 기준 저장', () => experience({ kind: 'goal', value: goal.value || null }), 'experience-goal-save'));
  const evaluate = check(form, '앞으로 남기는 경험 응답을 내 개인화 평가에 사용해도 좋아요.', e.evaluationConsent === true, 'evaluation-consent');
  append(form, para('개인 기록 저장과 별개의 선택이에요. 동의하지 않아도 경험을 기록할 수 있고, 다른 사람에게 공개되지 않아요.', 'hint'), button('평가 사용 범위 저장', () => experience({ kind: 'evaluation-consent', enabled: evaluate.checked }, evaluate.checked ? '이후 기록부터 본인 평가에 사용할 수 있어요.' : '경험 응답의 평가 사용을 껐어요.'), 'evaluation-consent-save'));
  section.append(form); return section;
}
function excludedCandidateSection() {
  const candidates = view.discovery?.excludedCandidates || [];
  if (!candidates.length) return null;
  const section = details(`이번 추천에서 넘긴 사람 · ${candidates.length}명`); section.dataset.excludedCandidates = 'true';
  section.append(para('이번 제외만 취소해요. 다른 기준과 숨김 기간은 유지하며, 지금 공개된 조건으로 다시 비교해요.', 'hint'));
  for (const candidate of candidates) {
    const row = el('div', null, 'summary'); row.dataset.excludedCandidate = candidate.id;
    append(row, el('strong', candidate.label), para(candidate.reason, 'hint'), button('이 사람의 이번 제외 취소', () => discovery({ kind: 'restore-candidate', candidateId: candidate.id, feedbackId: candidate.feedbackId }, '이 제외만 취소했어요. 현재 조건으로 다시 비교해요.'), 'restore-candidate'));
    section.append(row);
  }
  return section;
}
function recommendationReflection() {
  const e = view.experience; if (!e) return null;
  const section = details('추천이 내 방향에 맞았나요?');
  section.append(para('선택적으로 남기는 내 경험이에요. 응답만으로 취향을 바꾸거나 상대에게 점수를 매기지 않아요.', 'hint'));
  if (e.recommendationToken) section.append(button('지금 추천 돌아보기', () => experience({ kind: 'view-result', token: view.experience.recommendationToken }, '이때의 추천과 내 경험 기준을 연결했어요.'), 'experience-start'));
  const record = [...(e.records || [])].reverse().find(r => r.kind === 'recommendation');
  if (record) {
    const form = el('div', null, 'form'); form.dataset.experience = record.id;
    append(form, para(`${new Date(record.at).toLocaleString('ko-KR')}에 살펴본 추천`), record.selectedLabel && para(`먼저 살펴본 후보: ${record.selectedLabel}`), para(`그때 바란 경험: ${goalNames[record.goal] || '아직 정하지 않음'}`, 'hint'));
    const intent = select(form, '내가 원하는 방향을 반영했나요?', [['', '응답하지 않기'], ['yes', '잘 반영했어요'], ['partly', '일부만 맞아요'], ['no', '내 방향과 달라요'], ['unknown', '아직 모르겠어요']], 'intent-response'); intent.value = record.responses.intent?.value || '';
    const burden = select(form, '질문에 답하는 부담은 어땠나요?', [['', '응답하지 않기'], ['easy', '편하게 답했어요'], ['much', '질문이 부담스러웠어요'], ['unknown', '아직 모르겠어요']], 'burden-response'); burden.value = record.responses.burden?.value || '';
    form.append(button('이 경험 나만 보게 저장', () => run(async () => {
      await multi([...(record.deliveredAt ? [] : [{ kind: 'experience', action: { kind: 'deliver', decisionId: record.id } }]), ...[['intent', intent.value], ['burden', burden.value]].map(([metric, value]) => ({ kind: 'experience', action: { kind: 'respond', decisionId: record.id, metric, value: value || null } }))]);
    }, '내 응답을 저장했어요. 추천 기준은 직접 고친 뒤에만 바뀌어요.'), 'experience-respond'));
    if (record.canCorrect !== false && ['no', 'partly'].includes(record.responses.intent?.value)) form.append(button('내가 중요하게 보는 기준 고치기', () => { correctionSource = record.id; setPage('profile'); }, 'experience-correct'));
    if (record.responses.burden?.value === 'much') form.append(button('선택 질문을 간단히 받기', () => discovery({ kind: 'question-mode', mode: 'brief' }, '다음 질문부터 간단한 방식으로 받아요. 이미 답한 질문은 다시 묻지 않아요.'), 'experience-less-questions'));
    if (Object.keys(record.responses).length) form.append(button('이 추천의 응답 지우기', () => run(() => multi(Object.keys(record.responses).map(metric => ({ kind: 'experience', action: metric === 'followup' ? { kind: 'followup', decisionId: record.id, value: null } : { kind: 'respond', decisionId: record.id, metric, value: null } }))), '이 추천의 경험 응답을 지웠어요.'), 'experience-withdraw'));
    append(form, followupReflection(record), allowanceReflection(record));
    section.append(form); section.open = !record.deliveredAt || record.canCorrect === true || record.responses.burden?.value === 'much' || record.followup?.canRestore === true || record.allowance?.canPreviewClear === true;
  }
  const previous = [...(e.records || [])].reverse().filter(item => item.allowance && item.id !== record?.id);
  if (previous.length) {
    const history = details('앞서 사용한 허용 조건 돌아보기');
    for (const item of previous.slice(0, 3)) append(history, para(`${new Date(item.at).toLocaleString('ko-KR')}에 살펴본 추천`, 'hint'), allowanceReflection(item));
    if (previous.length > 3) history.append(button('내 설정에서 모든 경험 기록 보기', () => setPage('settings'), 'allowance-history'));
    section.append(history);
  }
  return section;
}
function allowanceReflection(record) {
  const allowance = record.allowance; if (!allowance) return null;
  const box = el('section', null, 'summary'); box.dataset.allowanceReview = record.id;
  append(box, el('h3', '이 조건을 허용해 살펴본 추천은 어땠나요?'), para(allowance.description),
    para(`당시 사용 범위: ${allowance.target === 'context' ? '이번 추천에서만' : '앞으로도'}${allowance.until ? ` · 종료 시점: ${new Date(allowance.until).toLocaleString('ko-KR')}` : ''}`, 'hint'),
    para('후보를 살펴본 내 느낌만 선택적으로 남겨요. 상대의 실제 행동을 확인한 기록은 아니에요. 답을 저장해도 원래 연락 선호와 허용 조건은 바뀌지 않아요.', 'hint'));
  if (allowance.canReview || allowance.canRespond) {
    const response = select(box, '이 허용 조건을 지금은 어떻게 느끼나요?', [['', '응답하지 않기'], ['keep', '지금 범위와 기한대로 괜찮아요'], ['stop', '이 허용 조건을 빼고 싶어요'], ['unknown', '아직 모르겠어요']], 'allowance-response'); response.value = allowance.response?.value || '';
    append(box, button('이 느낌 나만 보게 저장', () => run(async () => {
      await multi([...(record.deliveredAt ? [] : [{ kind: 'experience', action: { kind: 'deliver', decisionId: record.id } }]), { kind: 'experience', action: { kind: 'allowance-review', decisionId: record.id, value: response.value || null } }]);
    }, '내 느낌만 저장했어요. 허용 조건의 범위와 기한은 그대로예요.'), 'allowance-review-save'));
  } else box.append(para(allowance.unavailableReason || '지금은 이 추천과 연결한 허용 조건을 다시 확인할 수 없어요. 남긴 답은 지울 수 있어요.', 'hint'));
  if (allowance.canPreviewClear) append(box, para('철회하려면 달라지는 점을 확인하고 따로 적용해 주세요. 당시 사용한 범위의 허용 조건만 철회해요.', 'hint'),
    button('이 허용 조건 철회 전 확인', () => requestPreview({ allowanceReview: { decisionId: record.id } }), 'allowance-clear-preview'));
  if (allowance.response) box.append(button('이 허용 조건의 회고 지우기', () => experience({ kind: 'allowance-review', decisionId: record.id, value: null }, '이 회고만 지웠어요. 이미 따로 적용한 기준은 그대로예요.'), 'allowance-review-withdraw'));
  return box;
}
function followupReflection(record) {
  const followup = record.followup; if (!followup) return null;
  const box = el('section', null, 'summary'); box.dataset.followup = record.id;
  append(box, el('h3', '지난번 고친 기준, 이번에는 어떤가요?'));
  if(followup.sourceMeeting)box.append(para(`만남 뒤 새로 중요하다고 확인한 기준에서 이어졌어요. ${followup.sourceMeeting.label||''} ${followup.sourceMeeting.valueLabel||''}`,'hint'));
  for (const change of followup.changes || []) {
    const f = view.discovery?.fields.find(item => item.id === change.field);
    append(box, para(`${f?.label || '중요한 기준'}의 수정을 연결했어요.`, 'hint'), typeof change.before === 'string' && typeof change.after === 'string' ? para(`${change.before} → ${change.after}`, 'hint') : null);
  }
  if (followup.valid === false) box.append(para('원래 응답이나 추천 기준이 달라져 지금 추천과의 연결을 종료했어요. 남긴 응답은 내 기록에서 지울 수 있어요.', 'hint'));
  else {
    const response = select(box, '고치기 전보다 원하는 방향에 가까워졌나요?', [['', '응답하지 않기'], ['better', '더 가까워졌어요'], ['same', '비슷해요'], ['worse', '더 멀게 느껴져요'], ['unknown', '아직 모르겠어요']], 'followup-response'); response.value = record.responses.followup?.value || '';
    append(box, para('이번에 느낀 변화만 기록해요. 다른 후보나 상황도 달라질 수 있어 이 수정의 효과로 단정하지 않아요.', 'hint'), button('수정 후 느낌 저장', () => run(async () => {
      await multi([...(record.deliveredAt ? [] : [{ kind: 'experience', action: { kind: 'deliver', decisionId: record.id } }]), { kind: 'experience', action: { kind: 'followup', decisionId: record.id, value: response.value || null } }]);
    }, '수정 뒤 느낀 변화를 나만 보는 기록에 남겼어요.'), 'followup-save'));
  }
  if (record.responses.followup?.value === 'worse') {
    if (followup.canRestore) append(box, para('이때 고친 기준만 되돌렸을 때의 추천을 먼저 확인할 수 있어요. 다른 답과 이전 소개·수락은 복원하지 않아요.', 'hint'), button('이때 바꾼 기준만 되돌려 보기', () => requestPreview({ restoreDecisionId: record.id }), 'restore-preview'));
    else if (followup.restoreUnavailableReason) box.append(para(followup.restoreUnavailableReason, 'hint'));
  }
  if (record.responses.followup) box.append(button('수정 후 응답 지우기', () => experience({ kind: 'followup', decisionId: record.id, value: null }, '수정 후 응답을 지웠어요.'), 'followup-withdraw'));
  return box;
}
function criterionReflection(pair, appointment) {
  const review = pair.criterionReviews?.find(item => item.appointmentId === appointment.id);
  if (!review?.canRespond || !review.criteria?.length) return null;
  const section = append(el('section'), el('h3', '그때 중요했던 기준, 실제로도 도움이 됐나요?')), form = el('div', null, 'form'); section.dataset.criterionReview = appointment.id;
  append(form, para('이 상대와 소개를 시작할 때 내가 중요하게 골랐던 기준이에요. 이번 만남에서 느낀 점 하나만 돌아봐요.', 'hint'));
  const chosen = select(form, '돌아볼 기준 하나', [['', '기준 선택하기'], ...review.criteria.map(item => [item.field, `${item.label} · ${item.valueLabel}`])], 'criterion-field'); chosen.value = review.selectedField || '';
  const response = select(form, '이번 만남에서 이 기준은 어땠나요?', [['', '응답하지 않기'], ['helped', '실제로 도움이 됐어요'], ['less-important', '이번에는 덜 중요했어요'], ['unknown', '아직 판단하기 어려워요']], 'criterion-response'); response.value = review.response?.value || '';
  append(form, para('응답은 나만 봐요. 한 번의 만남으로 상대나 내 성향을 단정하지 않고, 저장만으로 추천 기준을 바꾸지 않아요.', 'hint'), button('이 기준의 경험 저장', () => {
    if (!chosen.value || !response.value) { notice('돌아볼 기준과 이번에 느낀 점을 골라 주세요. 답하지 않아도 괜찮아요.'); return; }
    void experience({ kind: 'criterion', pairId: pair.pairId, appointmentId: appointment.id, field: chosen.value, value: response.value }, '이 기준이 이번 만남에서 어땠는지 저장했어요. 추천 기준은 바뀌지 않았어요.');
  }, 'criterion-save'));
  if (review.canPreview && review.selectedField && review.response?.value === 'less-important') append(form, para('다음 추천에서는 이 기준의 중요도를 낮추어 비교할 수 있어요. 꼭 지킬 조건으로 정했다면 그대로 유지해요.', 'hint'), button('이번 추천의 중요도에서 빼고 비교', () => requestPreview({ criterionReview: { pairId: pair.pairId, appointmentId: appointment.id, field: review.selectedField } }), 'criterion-preview'));
  else if (review.previewUnavailableReason && review.response?.value === 'less-important') form.append(para(review.previewUnavailableReason, 'hint'));
  if (review.response) form.append(button('이 기준의 회고 지우기', () => experience({ kind: 'criterion', pairId: pair.pairId, appointmentId: appointment.id, field: review.selectedField, value: null }, '이 기준의 회고를 지웠어요. 따로 확인해 적용했던 내 기준은 그대로예요.'), 'criterion-withdraw'));
  section.append(form); return section;
}
function newCriterionReflection(pair, appointment) {
  const review=pair.criterionReviews?.find(item=>item.appointmentId===appointment.id);
  if(!review || !review.canAdd && review.response?.value!=='more-important')return null;
  const section=append(el('section'),el('h3','만나 보고 새로 중요해진 기준이 있나요?'));
  section.dataset.newCriterion=appointment.id;
  section.append(para('그때 중요하게 고르지 않았어도, 다음 만남에서는 더 중요하게 보고 싶은 기준을 하나 남길 수 있어요. 상대의 성향이나 실제 행동을 판단하는 기록은 아니에요.','hint'));
  if(review.canAdd && review.addedCriteria?.length){
    const form=el('div',null,'form'), choice=select(form,'새로 중요하게 보고 싶은 기준',[['','기준 하나 고르기'],...review.addedCriteria.map(item=>[item.field,item.label])],'new-criterion-field');
    if(review.response?.value==='more-important')choice.value=review.selectedField||'';
    const description=para('', 'summary'), confirmed=check(form,'다음 만남에서 내가 바라는 답을 확인했어요.',false,'new-criterion-confirm');
    const describe=()=>{const item=review.addedCriteria.find(item=>item.field===choice.value);description.textContent=item?`${item.label} · 다음에는 ‘${item.valueLabel}’을 바라요.`:'내가 직접 답한 기준에서 하나를 골라 주세요.';confirmed.checked=false;};
    choice.addEventListener('change',describe);describe();form.append(description);
    form.append(button('새로 중요해진 기준의 경험 저장',()=>{
      const item=review.addedCriteria.find(item=>item.field===choice.value);
      if(!item||!confirmed.checked){notice('기준 하나와 다음 만남에서 바라는 답을 직접 확인해 주세요.');return;}
      void experience({kind:'criterion',pairId:pair.pairId,appointmentId:appointment.id,field:item.field,value:'more-important',confirmedValue:item.value},'새로 중요하게 느낀 기준을 나만 보는 회고에 저장했어요. 추천은 아직 바뀌지 않았어요.');
    },'new-criterion-save'));section.append(form);
  }else section.append(para('먼저 내 기준에서 원하는 답을 직접 확인하면 새 기준을 남길 수 있어요.','hint'));
  if(review.response?.value==='more-important'){
    const criterion=review.reviewCriterion;
    section.append(para(`새로 중요하다고 확인한 기준 · ${criterion?.label||''} · ${criterion?.valueLabel||''}`,'summary'));
    if(review.canPreview){
      const form=el('div',null,'form');form.dataset.criterionScope='new';
      const scope=select(form,'새 중요도를 사용할 범위',[['context','이번 추천에서만'],...(review.canApplyBaseline?[['baseline','앞으로도']]:[])],'new-criterion-scope');
      const replace=select(form,'기존 중요 기준을 바꿀까요?',[['','기존 기준 유지'],...((review.replacementOptions||[]).length>=2?review.replacementOptions:[]).map(item=>[item.field,item.label])],'new-criterion-replace');
      if((review.replacementOptions||[]).length>=2)form.append(para('중요 기준은 두 개까지예요. 무엇을 대신할지 직접 골라 주세요.','hint'));
      const deadline=deadlineControl(form,{scope,name:'new-criterion-until',limits:target=>({contextExpiresAt:view.discovery.context.expiresAt,
        answerUntil:view.discovery.fields.find(field=>field.id===review.selectedField)?.effective?.provenance?.until,
        priorityUntil:livePriorityDeadline(view.discovery)})});
      form.append(para('원래 답의 기한이나 이번 추천의 범위가 먼저 끝나면 함께 끝나요. 필수조건은 그대로 유지해요.','hint'));
      form.append(button('새 중요도로 추천 변화 보기',()=>{
        const lifetime=deadline.resolve();if(!lifetime)return;
        if((review.replacementOptions||[]).length>=2&&!replace.value){notice('대신할 중요 기준을 직접 골라 주세요.');return;}
        void requestPreview({criterionReview:{pairId:pair.pairId,appointmentId:appointment.id,field:review.selectedField,target:lifetime.target,...(replace.value?{replaceField:replace.value}:{}),...(lifetime.until?{until:lifetime.until}: {})}},deadlineConfirmation(lifetime,'새 중요 기준',lifetime.target==='context'?priorityReturn(lifetime.effectiveUntil):'평소 중요도의 기한이 끝나면 이전 중요도를 되살리지 않아요. 원래 선호와 필수조건은 유지해요.'));
      },'new-criterion-preview'));section.append(form);
    }else if(review.previewUnavailableReason)section.append(para(review.previewUnavailableReason,'hint'));
    section.append(button('새 기준의 회고 지우기',()=>experience({kind:'criterion',pairId:pair.pairId,appointmentId:appointment.id,field:review.selectedField,value:null},'새 기준의 회고를 지웠어요. 따로 적용한 중요도는 내 기준에서 되돌릴 수 있어요.'),'new-criterion-withdraw'));
  }
  return section;
}
function comfortReflection(pair, appointment) {
  if (!view.experience || !appointment.canReflect) return null;
  const section = append(el('section'), el('h3', '내 페이스로 만날 수 있었나요?')), form = el('div', null, 'form');
  const record = [...(view.experience.records || [])].reverse().find(r => r.kind === 'meeting' && r.pairId === pair.pairId && r.appointmentId === appointment.id);
  const comfort = select(form, '이번 만남에서 느낀 편안함', [['', '응답하지 않기'], ['comfortable', '내 페이스로 편안했어요'], ['mixed', '편한 점과 불편한 점이 있었어요'], ['uncomfortable', '내게 부담스러웠어요'], ['unknown', '아직 모르겠어요']], 'comfort-response'); comfort.value = record?.responses.comfort?.value || '';
  append(form, para('상대의 평가나 공개 평판으로 쓰지 않아요. 시간·활동을 바꾸고 싶으면 나만 보는 만남 회고에서 별도로 선택할 수 있어요.', 'hint'), button('내 편안함 기록', () => experience({ kind: 'comfort', pairId: pair.pairId, appointmentId: appointment.id, value: comfort.value || null }), 'comfort-save'));
  if (record?.responses.comfort) form.append(button('편안함 응답 지우기', () => experience({ kind: 'comfort', pairId: pair.pairId, appointmentId: appointment.id, value: null }), 'comfort-withdraw'));
  section.append(form); return section;
}
function meetingReflection(pair, meeting) {
  if (!meeting.canReflect) return null;
  const key = `${pair.pairId}:${meeting.id}`, section = details('만남 뒤, 하나만 돌아볼까요?'); section.dataset.meetingReflection = meeting.id;
  const form = el('div', null, 'form'), panels = el('div');
  const format = append(el('section'), el('h3', '시간과 활동은 어땠나요?')), formatForm = el('div', null, 'form');
  const previous = pairView(pair).me?.reflections?.find(item => item.appointmentId === meeting.id);
  const value = select(formatForm, '이번 만남의 방식', [['', '남기고 싶은 느낌 선택하기'], ['good', '지금 방식이 편했어요'], ['too-long', '조금 짧았으면 좋겠어요'], ['change-activity', '다른 활동을 해 보고 싶어요']], 'reflection'); value.value = previous?.value || '';
  const note = field(formatForm, '나에게 남기는 메모 (선택)', 'textarea', previous?.note || '', 'reflection-note'); note.maxLength = 280;
  formatForm.append(button('이 느낌 나만 보게 저장', () => {
    if (!value.value) { notice('남기고 싶은 느낌을 골라 주세요. 회고는 건너뛰어도 괜찮아요.'); return; }
    void appointment(pair, { kind: 'reflect', appointmentId: meeting.id, value: value.value, note: note.value.trim() });
  }, 'reflect'));
  format.append(formatForm);
  const choices = [['comfort', '내 페이스와 편안함', comfortReflection(pair, meeting)], ['format', '만난 시간과 활동', format], ['criterion', '중요하게 골랐던 기준', criterionReflection(pair, meeting)], ['new-criterion','새로 중요해진 기준',newCriterionReflection(pair,meeting)]].filter(([, , node]) => node);
  let chosen = reflectionTopics.get(key) || '';
  if (!choices.some(([id]) => id === chosen)) chosen = '';
  section.open = !!chosen;
  append(form, para('이번에 남기고 싶은 것 하나면 충분해요. 선택하거나 저장해도 다른 회고를 대신 채우지 않아요.', 'hint'));
  const topic = select(form, '이번에 남기고 싶은 것', [['', '하나만 골라 주세요'], ...choices.map(([id, label]) => [id, label])], 'reflection-topic'); topic.value = chosen;
  const show = () => { chosen = topic.value; if (chosen) reflectionTopics.set(key, chosen); else reflectionTopics.delete(key); for (const [id, , node] of choices) node.hidden = id !== chosen; };
  for (const [id, , node] of choices) { node.dataset.reflectionPanel = id; panels.append(node); }
  topic.addEventListener('change', () => { show(); more.hidden = !chosen; }); show();
  const more = button('다른 것도 남기기', () => { topic.value = ''; show(); more.hidden = true; topic.focus(); }, 'reflection-more'); more.hidden = !chosen;
  append(section, form, panels, more); return section;
}
function experienceHistory() {
  const e = view.experience; if (!e) return null;
  const section = details('나만 보는 경험 기록');
  const labels = { intent: '원하는 방향', burden: '질문 부담', comfort: '만남의 편안함', followup: '기준을 고친 뒤' }, values = { yes: '잘 반영됨', partly: '일부 맞음', no: '내 방향과 다름', easy: '편하게 답함', much: '부담스러움', comfortable: '편안함', mixed: '편한 점과 불편한 점 모두 있음', uncomfortable: '부담스러움', unknown: '아직 모름', better: '원하는 방향에 더 가까워짐', same: '비슷함', worse: '더 멀게 느껴짐' };
  section.append(para(e.evaluationConsent ? '평가에 동의한 뒤 생긴 기록만 집계에 사용해요. 현재 기록만으로 만족도 향상을 확인한 것은 아니에요.' : '개인화 평가 사용은 꺼져 있어요. 본인 기록만 보관하고 있어요.', 'hint'));
  for (const r of [...(e.records || [])].reverse()) {
    const row = el('article', null, 'card'); append(row, el('h3', `${r.kind === 'meeting' ? '만남 후' : '추천을 본 뒤'} · ${new Date(r.at).toLocaleDateString('ko-KR')}`));
    const answers = Object.entries(r.responses);
    for (const [metric, answer] of answers) row.append(para(`${labels[metric]}: ${values[answer.value]}`));
    if (!answers.length) { if (!r.allowance?.response) row.append(para('아직 남긴 응답이 없어요. 미응답은 실패로 세지 않아요.', 'hint')); }
    else row.append(button('이 기록의 응답 지우기', () => run(() => multi(answers.map(([metric]) => ({ kind: 'experience', action: r.kind === 'meeting' ? { kind: 'comfort', pairId: r.pairId, appointmentId: r.appointmentId, value: null } : metric === 'followup' ? { kind: 'followup', decisionId: r.id, value: null } : { kind: 'respond', decisionId: r.id, metric, value: null } }))), '선택한 경험 응답을 지웠어요.'), 'experience-history-withdraw'));
    if (r.responses.followup?.value === 'worse') append(row, followupReflection(r));
    append(row, allowanceReflection(r));
    section.append(row);
  }
  for (const review of [...(e.criterionReviews || [])].reverse()) {
    const row = el('article', null, 'card'); row.dataset.criterionHistory = review.appointmentId;
    append(row, el('h3', `${review.response.value==='more-important'?'새로 중요해진 기준':'중요했던 기준 돌아보기'} · ${new Date(review.response.at).toLocaleDateString('ko-KR')}`), para(`${review.label} · ${review.valueLabel}`), para({ helped: '실제로 도움이 됐어요', 'less-important': '이번에는 덜 중요했어요', unknown: '아직 판단하기 어려워요', 'more-important':'다음 만남에서는 더 중요하게 보고 싶어요' }[review.response.value]), button('이 기준의 회고 지우기', () => experience({ kind: 'criterion', pairId: review.pairId, appointmentId: review.appointmentId, field: review.field, value: null }, '이 기준의 회고를 지웠어요.'), 'criterion-history-withdraw'));
    section.append(row);
  }
  if (!e.records?.length && !e.criterionReviews?.length) section.append(para('아직 남긴 경험 기록이 없어요.', 'hint'));
  return section;
}
function landing() {
  const area = $('content'); area.replaceChildren();
  const hero = el('section', null, 'hero'), image = el('img'); image.src = '/synk-account/assets/sticker-person.webp'; image.alt = '';
  append(hero, image, heading('내가 편한 방식으로, 한 사람씩', '많이 만나기보다,\n나답게 만나요.', '내가 편한 대화, 연락의 간격, 관계의 방향. 직접 고른 기준으로 한 사람을 천천히 살펴보세요.'));
  const actions = el('div', null, 'actions');
  if (config.configured) actions.append(button('SYNK ID로 시작하기', () => run(() => client.signIn()), 'signin', true));
  if (config.demoEnabled) actions.append(button('가상 체험 시작하기', () => enterDemo('adult-a'), 'demo', true));
  append(hero, actions, para(config.message, 'hint'));
  const cols = el('div', null, 'intro-grid');
  append(cols, hero, append(el('aside', null, 'aside-note'), el('h3', '처음부터 다 답하지 않아도 돼요.'), para('필요한 질문부터 하나씩. 추천이 마음에 들지 않으면 이유를 남기고 기준을 직접 고칠 수 있어요.'), para('가상 체험에서는 가상 성인과 가상 초대만 사용해요. 실제 사람에게 연락하지 않아요.')));
  area.append(cols);
}
async function enterDemo(role) {
  generation++; clearPrivateDrafts(); syncState={status:'checking',lastCheckedAt:null};
  return run(async () => { clearPrivateDrafts(); demo = true; view = null; await client.demo(role);
    const currentURL=new URL(location.href); currentURL.searchParams.set('demo',role); history.replaceState(history.state,'',currentURL);
    await load(); page = role === 'operator' ? 'settings' : 'discover'; }, '가상 역할로 시작했어요.');
}
function render() {
  if (disposed) return;
  if ($('lab-link')) $('lab-link').hidden = config.labAvailable !== true;
  pruneProfileEditingDrafts();
  if(onboardingDraft?.basis!==getOnboardingDraftBasis(view))onboardingDraft=null;
  if(!view?.discovery||comparisonSelection?.some(id=>!view.discovery.candidates.some(c=>c.id===id&&c.status==='eligible')))comparisonSelection=null;
  renderVersion++; renderedPage=page;
  pruneInputDrafts();
  syncPanel();
  if (conditionalContactDraft && conditionalContactDraft.key !== conditionalContactDraftKey()) conditionalContactDraft = null;
  const mode = $('mode'); mode.replaceChildren(para(demo ? `가상 체험 · ${view?.profile?.nickname || view?.accountId || '연결 중'}` : config.signedIn ? 'SYNK ID에 연결됨' : '나다운 만남 · MVP', 'small'));
  if (view && demo) {
    const role = view.accountId === 'demo:adult-a' ? 'adult-b' : 'adult-a';
    const a = el('a', '상대 역할 체험 열기', 'small'); a.href = `./dating.html?demo=${role}`; a.target = '_blank'; a.rel = 'noopener'; mode.append(a);
  }
  if (!view) { $('nav').hidden = true; landing(); return; }
  for (const [id, stored] of rescheduleDrafts) {
    const pair = view.pairs?.find(item => item.pairId === id), current = pair && getRescheduleDraft(pair, stored.appointmentId);
    const key = scheduleDraftKey(pair, 'new');
    if (!current || !key || stored.key !== key || ['proposalVersion', 'place', 'durationMinutes'].some(key => current[key] !== stored[key])) rescheduleDrafts.delete(id);
  }
  const nav = $('nav'); nav.hidden = false; nav.replaceChildren();
  const newCount = (view.inbox || []).filter(n => !n.read).length + (view.introductions || []).filter(i => i.canRespond).length;
  for (const [id, label] of [['discover', '오늘의 추천'], ['profile', '내 기준'], ['inbox', `초대·약속${newCount ? ` (${newCount})` : ''}`], ['settings', '내 설정']]) {
    const b = button(label, () => setPage(id), `nav-${id}`); if (page === id) b.setAttribute('aria-current', 'page'); nav.append(b);
  }
  const area = $('content'), secondaryOpen = page === 'discover' && area.querySelector('[data-secondary-discovery]')?.open === true; area.replaceChildren();
  dirty = false;
  if (centralBlocked(view)) {
    clearPrivateDrafts(); nav.hidden=true;
    area.append(heading('현재 이용 상태', view.centralAvailability.status==='deletion-requested' ? '탈퇴 요청 중이라 만남을 쉬고 있어요.' : '현재 만남 기능을 이용할 수 없어요.', '프로필 노출과 새로운 소개는 중단됐어요. 계정에서 이용 상태를 확인한 뒤 다시 불러와 주세요.'),button('현재 상태 다시 확인',()=>run(()=>load()),'reload'));
    return;
  }
  if (view.status === 'deleted') { clearPrivateDrafts(); area.append(heading('기록 삭제 완료', '소개팅 기록을 삭제했어요.', '기존 기기에서는 새 기록을 저장할 수 없어요.')); return; }
  if (view.status === 'suspended' && page !== 'settings') { area.append(heading('이용 상태 확인', '현재 소개팅 기능을 이용할 수 없어요.', '운영 검토가 끝난 뒤 다시 확인해 주세요.'), button('내 설정과 기록 관리', () => setPage('settings'), 'suspended-settings')); return; }
  if (view.centralAvailability?.resumeRequired) area.append(append(el('section',null,'summary'),el('h2','공개와 초대는 다시 직접 정해 주세요.'),para('계정을 다시 이용할 수 있어요. 이전 소개와 약속 수락은 돌아오지 않아요. 공개·초대 범위를 확인한 뒤 새 소개부터 시작해요.'),page!=='settings' && button('내 공개·초대 설정 확인',()=>setPage('settings'),'central-resume-settings')));
  append(area,adultVerificationPanel());
  if(needsOnboarding() && page!=='settings'){onboarding(area);updatePanels();return;}
  if(needsOnboarding() && page==='settings'){
    const section=append(el('section',null,'summary'),el('h2','첫 설정을 이어서 마쳐 주세요.'),onboardingProgress(),button('첫 설정 이어하기',()=>{setPage('discover');focusOnboardingMissing();},'resume-onboarding'));
    section.dataset.onboardingResume='true';area.append(section);
  }
  if (pendingPreview && ['discover', 'profile'].includes(page)) { area.append(previewPanel()); updatePanels(); return; }
  if (appliedPreview && ['discover', 'profile', 'inbox'].includes(page)) area.append(append(el('section', null, 'summary'), el('strong', '방금 반영한 변화'), para(appliedPreview), button('확인했어요', () => { appliedPreview = null; render(); }, 'preview-noted')));
  ({ discover: recommendations, profile: preferences, inbox, settings })[page](area, secondaryOpen);
  restoreProfileEditingDrafts();
  restoreScheduleForms();
  updatePanels();
}
const needsOnboarding=()=>view?.status==='active' && (view.onboarding?.complete===false || !view.adult?.selfDeclared || !view.profile?.nickname);
function focusOnboardingMissing(){
  const steps=view?.onboarding?.steps;
  const name=!steps?.profile?'nickname':!steps.adult?'adult':'public';
  $('content').querySelector(`[data-onboarding-form] [name="${name}"]`)?.focus();
}
function onboardingProgress(){
  const steps=view.onboarding?.steps||{profile:!!view.profile?.nickname,adult:view.adult?.selfDeclared===true,consents:false};
  const saved=['profile','adult','consents'].filter(key=>steps[key]===true).length;
  const box=details(`저장된 설정 ${saved}/3 · 자세히 보기`);box.classList.add('onboarding-progress');box.dataset.onboardingProgress='true';
  const list=el('ul',null,'readiness-statuses');
  for(const [key,label] of [['profile','내 소개'],['adult','성인 여부 확인'],['consents','공개·초대·저장 범위']]){
    const row=el('li',`${label} · ${steps[key]?'저장됨':'확인 필요'}`);row.dataset.onboardingStep=key;row.dataset.complete=String(steps[key]===true);list.append(row);
  }
  append(box,list,para('현재 저장된 상태예요. 작성하거나 선택한 내용은 완료 버튼을 누른 뒤 저장돼요.','hint'),
    para('이름과 성인 여부를 직접 확인하고 공개·초대·저장 범위를 정해 주세요. 지역과 짧은 소개는 선택이에요. 이후 추천에 필요한 답을 확인해요.','hint'));return box;
}
function bindOnboardingDraft(form){
  const basis=getOnboardingDraftBasis(view),original=JSON.stringify(editingValues(form));
  const status=append(el('div',null,'editing-draft'),para('아직 저장하지 않은 첫 설정이에요. 화면을 옮겨도 이 탭에서 이어 쓸 수 있어요. 탭을 닫거나 새로고침하면 작성 중인 내용은 사라져요.','hint'));
  status.dataset.onboardingDraft='true';status.hidden=true;
  status.append(button('작성 중인 첫 설정 버리기',()=>{onboardingDraft=null;render();$('content').querySelector('[data-onboarding-form] input')?.focus();notice('작성 중인 내용만 버렸어요. 이미 저장한 소개와 선택은 그대로예요.');},'discard-onboarding-draft'));form.append(status);
  const remember=()=>{
    const values=editingValues(form);
    onboardingDraft=basis && basis===getOnboardingDraftBasis(view) && JSON.stringify(values)!==original?{basis,values}:null;
    status.hidden=!onboardingDraft;
  };
  form.addEventListener('input',remember);form.addEventListener('change',remember);
  if(onboardingDraft?.basis===basis){
    const inputs=editingInputs(form),saved=onboardingDraft.values;
    if(inputs.length===saved.length&&inputs.every((input,i)=>input.name===saved[i].name)){
      inputs.forEach((input,i)=>{input.value=saved[i].value;if(input.type==='checkbox')input.checked=saved[i].checked;});status.hidden=false;dirty=true;
    }else onboardingDraft=null;
  }
}
function saveOnboarding(action){
  return run(async()=>{
    pendingOnboardingSave={accountId:view.accountId};syncControls();
    let result;
    try{result=await delivery.send({actorId:view.accountId,expectedRevision:view.revision,action,demo});}
    catch(error){if(!delivery.snapshot())pendingOnboardingSave=null;throw error;}
    view=result.view;queuedView=null;appliedPreview=null;onboardingDraft=null;pendingOnboardingSave=null;page='discover';render();
  },'내 소개와 직접 선택한 공개·초대·저장 범위를 함께 저장했어요.');
}
function onboarding(area) {
  const title=heading('시작하기 · 내 소개', '사용할 이름부터 알려 주세요.');title.classList.add('onboarding-heading');area.append(title);
  const form = el('form', null, 'form');form.dataset.onboardingForm='true';
  const nickname = field(form, '사용할 이름', 'text', view.profile?.nickname || '', 'nickname'); nickname.maxLength = 30; nickname.required = true;
  form.append(onboardingProgress());
  const region = field(form, '만나기 편한 지역 (선택)', 'text', view.profile?.region || '', 'region'); region.maxLength = 80;
  const intro = field(form, '짧은 소개 (선택)', 'textarea', view.profile?.intro || '', 'intro'); intro.maxLength = 300;
  const adult = check(form, '저는 성인이며, 만남을 위한 정보를 직접 선택합니다.', view.adult?.selfDeclared===true, 'adult'); adult.required = true;
  form.append(para('이 확인은 본인 진술이에요. 별도의 성인 인증이 완료됐다는 뜻은 아니에요.', 'hint'));
  const publicity = check(form, '내 이름·지역·소개를 추천 대상에게 공개할게요.', view.consents?.profilePublic === true, 'public');
  const invites = check(form, '상대가 보낸 초대를 받을게요.', view.consents?.receiveInvitations === true, 'invites');
  const save = check(form, '내 추천 답변과 보관한 후보를 이 계정에 저장하고 이어갈게요.', view.consents?.storePreferences === true, 'save');
  form.append(para('공개·초대·계정 저장은 각각 선택할 수 있어요. 체크하지 않은 항목은 켜지 않고 첫 설정을 마칠 수 있어요.','hint'));
  const submit = button('첫 설정 마치기', () => { if (!form.reportValidity()) return;
    void saveOnboarding({kind:'onboard',profile:{nickname:nickname.value.trim(),region:region.value.trim(),intro:intro.value.trim()},declared:adult.checked,consents:{profilePublic:publicity.checked,receiveInvitations:invites.checked,storePreferences:save.checked}});
  }, 'onboard', true);
  form.addEventListener('submit', e => { e.preventDefault(); submit.click(); }); append(form, el('div', null, 'actions')); form.lastChild.append(submit);bindOnboardingDraft(form);area.append(form);
}
function recommendationInsights(d) {
  if (!d?.insights) return null;
  const { coverage, stability } = d.insights, section = details('지금 추천에서 확인된 것과 남은 것');
  if (coverage) section.append(para(`내 답 ${coverage.total}개 중 ${coverage.known}개를 확인했어요. 상대가 공개한 답은 각 후보의 근거에서 따로 확인해요.`, 'hint'));
  if (stability?.summary) section.append(para(stability.summary));
  for (const change of stability?.changes || []) {
    const row = el('div', null, 'reason-detail'); row.append(el('strong', change.label));
    for (const choice of change.leadingSets || []) {
      const names = choice.candidateIds.map(id => d.candidates.find(c => c.id === id)?.label).filter(Boolean);
      row.append(para(`${choice.label}: ${names.length ? names.join(' · ') + '부터 비교' : '추천 보류'}`, 'hint'));
    }
    row.append(button('이 답 직접 확인하기', () => focusPreference(change.field), `insight-${change.field}`)); section.append(row);
  }
  section.append(para('한 번에 내 미확인 답 하나씩 바꿔 본 결과예요. 여러 답이 함께 달라지는 경우나 실제 호감·성공 가능성까지 예측하지 않아요.', 'hint'));
  return section;
}
function sceneExplorer(d) {
  if (!d?.scenes?.length) return null;
  const section = details('내 취향이 잘 모르겠다면 · 짧은 장면 비교');
  section.append(para('정답은 없어요. 이 장면에서 더 편한 쪽을 골라 보세요. 선택한 반응은 나만 보며, 추천 기준 반영은 따로 확인해요.', 'hint'));
  for (const scene of d.scenes) {
    const row = details(scene.title); row.dataset.scene = scene.id;
    append(row, para(scene.intro), scene.response && para(`내가 고른 반응: ${scene.options.find(o => o.id === scene.response.choice)?.label || '선택한 장면'}`, 'pill'));
    const choices = el('div', null, 'scene-options');
    for (const choice of scene.options) {
      const entry = el('div', null, 'scene-choice');
      if (choice.text) entry.append(para(choice.text));
      const choose = button(choice.label, () => discovery({ kind: 'scene-respond', sceneId: scene.id, choice: choice.id }, '이 장면의 반응을 저장했어요. 추천 기준은 아직 바뀌지 않았어요.'), `scene-${choice.id}`);
      if (!scene.canRespond) { choose.disabled = true; choose.dataset.fixedDisabled = 'true'; }
      entry.append(choose); choices.append(entry);
    }
    row.append(choices);
    if (!scene.canRespond) row.append(para(scene.blockedReason || '선택 질문을 쉬고 있어요. 질문 속도와 재개 상태를 먼저 확인해 주세요.', 'hint'));
    if (scene.suggestion) {
      const s = scene.suggestion;
      append(row, para('이 반응을 이번 추천의 기준으로 써 볼까요? 적용 전 후보 변화를 확인할 수 있어요.', 'hint'), button('이 반응으로 추천 변화 보기', () => previewDiscovery({ kind: 'set', field: s.field, value: s.value, target: s.target, ...(s.until ? { until: s.until } : {}), sceneResponseId: s.responseId }), 'scene-preview'));
    }
    if (scene.response) row.append(button('이 장면의 반응 지우기', () => discovery({ kind: 'scene-withdraw', sceneId: scene.id }, '장면 반응을 지웠어요. 별도로 적용한 기준은 내 기준에서 직접 되돌릴 수 있어요.'), 'scene-withdraw'));
    section.append(row);
  }
  return section;
}
function candidateComparison(d) {
  const eligible = d?.candidates?.filter(c => c.status === 'eligible') || [];
  if (eligible.length < 2) return null;
  const section = details('두 사람, 내 기준에서 무엇이 다를까요?'), form = el('div', null, 'form'), comparison = el('div'); comparison.setAttribute('aria-live', 'polite');section.dataset.candidateComparison='true';
  const options = eligible.map(c => [c.id, c.label]);
  const first = select(form, '첫 번째 후보', options, 'compare-first'), second = select(form, '두 번째 후보', options, 'compare-second'); second.value = eligible[1].id;
  if(comparisonSelection?.length===2&&comparisonSelection.every(id=>eligible.some(c=>c.id===id))){first.value=comparisonSelection[0];second.value=comparisonSelection[1];}else comparisonSelection=null;
  const initial = compareCandidates(d, [eligible[0].id, eligible[1].id]), checks = [];
  if (!(d.priorities?.effective?.length)) {
    form.append(para('이번에 비교할 기준을 두 개까지 골라 주세요. 이 선택은 내 추천 중요도를 바꾸지 않아요.', 'hint'));
    for (const option of initial.options || []) checks.push([option.field, check(form, option.label, false, `compare-${option.field}`)]);
  } else form.append(para('내가 더 중요하게 고른 기준에서만 비교해요.', 'hint'));
  form.append(button('고른 기준으로 나란히 보기', () => {
    const fields = checks.filter(([, input]) => input.checked).map(([id]) => id);
    if (fields.length > 2) { notice('비교할 기준은 두 개까지 골라 주세요.'); return; }
    const result = compareCandidates(view.discovery, [first.value, second.value], { fields });
    comparison.replaceChildren();
    if (result.status !== 'ready') { comparison.append(para(result.summary || (result.status === 'choose-fields' ? '비교할 기준을 한 개나 두 개 골라 주세요.' : '서로 다른 두 공개 후보를 골라 주세요.'))); return; }
    comparison.append(para(result.summary));
    for (const row of result.rows) {
      const line = el('section', null, 'comparison-row'); line.append(el('h3', row.label));
      const columns = el('div', null, 'comparison-columns');
      for (const cell of row.cells) columns.append(append(el('div'), el('strong', result.columns.find(c => c.id === cell.candidateId)?.label || '후보'), para(cell.text), para(({ match: '내 바람과 맞는 답', different: '내 바람과 다른 답', unknown: '비교할 답 미확인', known: '공개한 답 확인' })[cell.state] || '공개한 답 확인', 'hint')));
      line.append(columns); comparison.append(line);
    }
    comparison.append(para('선택한 기준에서의 차이예요. 사람 전체의 우열이나 상대의 마음을 뜻하지 않아요.', 'hint'));
  }, 'compare-candidates'));
  append(section, form, comparison); return section;
}
function savedCandidatesSection({showEmpty=false}={}){
  const saved=view.savedCandidates;if(!saved||!saved.items.length&&!showEmpty)return null;
  const section=details(`나중에 볼 후보 · ${saved.items.length}명`);section.dataset.savedCandidates='true';
  section.append(para(`최대 ${saved.limit}명까지 나만 보관해요. 보관은 소개 요청이나 추천 기준 변경이 아니에요. 다시 볼 때 현재 공개된 정보로 비교해요.`,'hint'));
  const candidates=view.discovery?.candidates||[],checks=[];
  for(const item of saved.items){
    const candidate=item.candidateId?candidates.find(c=>c.id===item.candidateId&&c.status==='eligible'):null;
    const row=el('section',null,'card form');row.dataset.bookmark=item.id;
    append(row,el('h3',candidate?.label||'지금은 비교할 수 없는 후보'),para(`${new Date(item.savedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}에 보관`,'hint'));
    if(candidate){
      if(candidate.tagline)row.append(para(candidate.tagline));
      const input=check(row,'이 후보를 나란히 비교하기',false,`bookmark-compare-${item.id}`);checks.push({input,id:candidate.id});
      row.append(button('현재 추천 카드 보기',()=>{setPage('discover');const card=[...$('content').querySelectorAll('[data-candidate]')].find(n=>n.dataset.candidate===candidate.id);if(!card)return;for(let parent=card.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'start'});},'bookmark-view'));
    }else row.append(para('현재 허용된 추천 정보가 없어요. 이전 소개와 답을 복사해서 보여주지 않아요. 보관은 직접 해제할 수 있어요.','hint'));
    row.append(button('보관 해제',()=>act({kind:'bookmark-remove',bookmarkId:item.id},'보관을 해제했어요. 소개와 추천 기준은 그대로예요.'),'bookmark-remove'));section.append(row);
  }
  if(checks.length>=2)section.append(button('보관한 두 사람 비교',()=>{
    const ids=checks.filter(c=>c.input.checked).map(c=>c.id);if(ids.length!==2){notice('지금 비교할 두 사람을 골라 주세요.');return;}
    comparisonSelection=ids;setPage('discover');const target=$('content').querySelector('[data-candidate-comparison]');if(!target)return;
    for(let parent=target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
    if(view.discovery?.priorities?.effective?.length)target.querySelector('[data-action="compare-candidates"]')?.click();
  },'compare-saved-candidates'));
  if(!saved.items.length)section.append(para('후보 카드에서 ‘나중에 다시 보기’를 누르면 여기에 모여요.','hint'));
  return section;
}
function disclosureDifferences() {
  const result = getDisclosureDifferences(view); if (result.status !== 'ready' || !result.differences.length) return null;
  const section = el('section', null, 'summary form'); section.dataset.disclosureDifferences = 'true';
  append(section, el('h3', '내 평소 답과 공개 답이 다른 항목'), para(result.notice, 'hint'));
  const choices = result.differences.map(diff => ({ diff, input: check(section, `${diff.label} · 공개: ${diff.publicLabel} → 평소 답: ${diff.baselineLabel}`, false, `sync-${diff.field}`) }));
  const review = el('div'); review.setAttribute('aria-live', 'polite');
  section.append(button('선택한 항목의 공개 전후 확인', () => {
    const selected = choices.filter(c => c.input.checked).map(c => c.diff), revision = view.revision;
    review.replaceChildren();
    if (!selected.length) { review.append(para('갱신할 자기소개 항목을 직접 골라 주세요.')); return; }
    review.append(el('h3', '이 답으로 공개 프로필을 갱신할까요?'));
    for (const diff of selected) {
      review.append(para(`${diff.label}: ${diff.publicLabel} → ${diff.baselineLabel}`));
      const until=view.profile.expirations?.[diff.field];
      if(until)review.append(para(`공개 기한은 ${publicDeadlineText(until)}까지로 유지해요. 기한이 지났다면 아래 공개 기한을 따로 확인해야 다시 비교에 사용돼요.`,'hint'));
    }
    append(review, para(result.profilePublic ? '이미 켜 둔 공개 범위에서 선택한 자기소개 답이 바뀝니다.' : '프로필 공개는 꺼진 채 유지돼요. 저장해 둔 공개용 답만 갱신해요.', 'hint'), button('확인한 자기소개 답만 갱신', () => {
      if (view.revision !== revision) { review.replaceChildren(para('그동안 기록이 달라졌어요. 최신 답으로 전후를 다시 확인해 주세요.')); return; }
      void act({ kind: 'publish-baseline', fields: selected.map(d => d.field) }, '선택한 평소 자기소개 답만 갱신했어요. 나머지 공개 범위는 그대로예요.');
    }, 'publish-baseline', true), button('갱신하지 않기', () => { review.replaceChildren(); notice('공개 답은 바뀌지 않았어요.'); }, 'publish-cancel'));
  }, 'publish-review')); section.append(review); return section;
}
function recommendations(area, secondaryOpen = false) {
  area.append(heading('오늘의 추천', '좋은 만남의 기준은 나에게 있어요.', '공통점과 다른 점을 함께 보고, 내가 확인하고 싶은 사람을 골라요.'));
  const focus = nextAction(),mainArea=area;
  if (focus) { const other = details('다른 추천과 내 기준 살펴보기'); other.dataset.secondaryDiscovery = 'true'; other.open = secondaryOpen; area.append(focus, other); area = other; }
  const reconfirmation=publicReconfirmation();if(reconfirmation){if(focus)mainArea.insertBefore(reconfirmation,area);else area.append(reconfirmation);}
  const saved=savedCandidatesSection();if(saved){if(focus)mainArea.insertBefore(saved,area);else area.append(saved);}
  area.append(readinessPanel());
  if (view.paused) { area.append(para('지금은 쉬는 중이에요. 새로운 추천과 초대는 멈췄어요.', 'summary'), button('추천 다시 시작하기', () => act({ kind: 'pause', paused: false }), 'resume')); return; }
  if (!view.consents?.storePreferences) { area.append(para('맞춤 답변을 저장하려면 내 설정에서 답변 저장을 켜 주세요.', 'summary'), button('저장 범위 정하기', () => setPage('settings'), 'configure')); return; }
  const d = view.discovery;
  const extras = document.createDocumentFragment();
  if (d?.questionControl) {
    const modes = details('질문은 내 속도로'), form = el('div', null, 'form');
    const mode = select(form, '선택 질문의 양', [['', '질문 속도 선택하기'], ['brief', '간단히 시작 · 하루 선택 질문 최대 2개'], ['thorough', '조금 더 꼼꼼히 · 하루 선택 질문 최대 5개']], 'question-mode'); mode.value = d.questionControl.mode || '';
    append(form, para('선택한 뒤 한국시간 하루의 선택 질문 수예요. 필요한 확인이 부족하면 추천을 보류해요. 답을 대신 채우지 않아요.', 'hint'), button('이 속도로 질문 받기', () => { if (!mode.value) { notice('원하는 질문 속도를 골라 주세요.'); return; } void discovery({ kind: 'question-mode', mode: mode.value }, '고른 질문 속도를 적용했어요.'); }, 'question-mode-save'));
    if (d.questionControl.deferred?.length) form.append(para('나중에 답하기로 한 질문은 정한 기간 동안 다시 묻지 않아요. 내 기준에서 먼저 답할 수도 있어요.', 'hint'));
    modes.append(form); extras.append(modes);
  }
  const guidance = getDiscoveryGuidance(view); if (guidance) area.append(guidancePanel(guidance));
  append(area, noCandidateComparison(d));
  if (d?.question) {
    const q = d.question, box = el('section', null, 'card'); box.dataset.question = q.field;
    append(box, para(q.optional ? '조금 더 알아보기 · 선택 질문' : '추천에 필요한 확인', 'eyebrow'), el('h2', q.label));
    const questionReason = para(q.valueReason || q.why, 'hint'); if (q.valueReason) questionReason.dataset.questionValue = q.valueBasis || 'declared-decision-value'; box.append(questionReason);
    const choices = el('div', null, 'choices');
    for (const option of q.options) choices.append(button(option.label, () => discovery({ kind: 'set', field: q.field, value: option.value, target: q.target || 'baseline' }), `answer-${option.id}`));
    append(box, choices);
    if (q.optional) box.append(button('아직 모르겠어요', () => discovery({ kind: 'mark-unknown', field: q.field }), 'unknown'), button('이 질문은 7일 뒤에', () => discovery({ kind: 'defer-question', field: q.field }, '이 선택 질문은 7일 동안 다시 묻지 않아요.'), 'defer-question'), button('지금 답으로 추천 보기', () => discovery({ kind: 'stop-questions' }), 'stop-questions'));
    if (q.optional) { const more = details('원할 때 질문 더 답하기'); more.append(box); extras.append(more); }
    else area.append(box);
  } else if (d?.questionsPaused) extras.append(button('질문 조금 더 답하기', () => discovery({ kind: 'continue-questions' }), 'continue-questions'));
  if (d) {
    if (guidance?.id !== 'all-current-candidates-skipped') area.append(para(d.summary || '', 'summary'));
    if (d.tieNotice) area.append(para(d.tieNotice, 'hint'));
    if (d.repetition?.status === 'unchanged') { const same = para(d.repetition.summary, 'summary'); same.dataset.repetition = 'unchanged'; area.append(same); }
    if (d.repetition?.reasons?.length) {
      const changes = el('section', null, 'summary'); changes.dataset.recommendationChanges = 'true';
      append(changes, el('h2', '지난 확인 이후 달라진 조건'), para('확인된 변화만 모았어요. 각 변화가 추천 순서를 얼마나 바꿨는지 뜻하는 것은 아니에요.', 'hint'));
      for (const reason of d.repetition.reasons) {
        const row = el('div', null, 'reason-detail'); row.dataset.changeReason = reason.kind;
        row.append(para(reason.text));
        if (reason.field) row.append(button('이 기준 확인하기', () => focusPreference(reason.field), `change-edit-${reason.field}`));
        changes.append(row);
      }
      area.append(changes);
    }
    const cards = el('div', null, 'cards');
    const others = details('다른 후보 살펴보기'); others.dataset.otherCandidates = 'true';
    let shown = 0;
    for (const c of (d.candidates || []).filter(c => c.status === 'eligible')) {
      const card = el('article', null, 'card'); card.dataset.candidate = c.id;
      append(card, para(d.synthetic ? '가상 성인 · 조건 비교' : '직접 공개한 소개', 'label'), el('h2', c.label), para(c.tagline || ''));
      if(c.region)card.append(para(`직접 공개한 지역 소개 · ${c.region}`,'hint'));
      if(c.meetingRegions?.shared?.length)card.append(para(`함께 고른 만남 가능 지역 · ${formatMeetingRegions(c.meetingRegions.shared)}`,'hint'));
      const highlights=getCandidateHighlights({...d,asOf:view.asOf},c);
      if(highlights.length){
        const summary=append(el('section',null,'summary'),el('h3','내가 중요하게 고른 기준'));summary.dataset.candidateHighlights='true';
        for(const item of highlights){const row=el('div',null,'reason-detail');row.dataset.highlightField=item.field;row.dataset.highlightComparison=item.comparison;
          append(row,el('strong',item.label),para(item.text),button('이 기준 확인·수정',()=>focusPreference(item.field),`highlight-edit-${item.field}`));summary.append(row);}
        card.append(summary);
      }
      for (const [key, title, cls] of [['matched', '함께 맞는 점', ''], ['differences', '서로 다를 수 있어요', 'differences'], ['unknown', '아직 확인할 점', 'unknown']]) {
        if(key==='matched'&&highlights.length&&c.matched?.length){
          const more=details(`함께 맞는 점 모두 보기 · ${c.matched.length}개`),list=el('ul');for(const text of c.matched)list.append(el('li',text));more.append(list);card.append(more);continue;
        }
        if (c[key]?.length) { const list = el('ul', null, cls); for (const text of key === 'matched' ? c[key].slice(0, 2) : c[key]) list.append(el('li', text)); if (key !== 'matched') { const more = details(`${title} · ${c[key].length}개`); more.append(list); card.append(more); } else { card.append(el('h3', title), list); if (c[key].length > 2) { const more = details('함께 맞는 점 더 보기'); const rest = el('ul'); for (const text of c[key].slice(2)) rest.append(el('li', text)); more.append(rest); card.append(more); } } }
      }
      const accountId = c.accountId || c.id;
      const bookmark=view.savedCandidates?.items.find(item=>item.candidateId===c.id);
      if(bookmark)card.append(button('보관한 후보 · 해제',()=>act({kind:'bookmark-remove',bookmarkId:bookmark.id},'보관을 해제했어요.'),'bookmark-remove'));
      else if(view.savedCandidates?.canAdd)card.append(button('나중에 다시 보기',()=>act({kind:'bookmark-save',targetAccountId:accountId},'나만 보는 후보 보관함에 저장했어요. 소개 요청은 보내지 않았어요.'),'bookmark-save'));
      else if(view.savedCandidates?.items.length>=view.savedCandidates?.limit)card.append(para(`보관함 ${view.savedCandidates.limit}명이 찼어요. 보관을 해제하면 다른 후보를 담을 수 있어요.`,'hint'));
      const currentPair = view.pairs?.find(pair => pair.pairId === c.pairId || pair.status === 'active' && pair.view?.people.some(p => p.id === accountId));
      if (currentPair) card.append(button(currentPair.status === 'active' ? '이 상대의 소개·약속 보기' : '이전 연결과 다시 열기 확인', () => focusPair(currentPair.pairId), 'view-introduction', currentPair.status === 'active' || c.canConnect !== true));
      if (c.canConnect === true && currentPair?.status !== 'active') card.append(button('소개 요청 보내기', () => connect(accountId), 'connect', true));
      else {
        const guidance=c.introductionGuidance;
        if(guidance){
          const section=append(el('section',null,'summary'),el('h3',guidance.title),para(guidance.body,'hint'));section.dataset.introductionGuidance=guidance.id;
          section.append(button(guidance.action.label,()=>{
            const action=guidance.action;
            if(action.kind==='answer')focusPreference(action.field);
            else if(action.kind==='navigate'){
              if(action.target==='disclosure')focusDisclosure(action.field);else setPage(action.page);
            }else if(action.kind==='focus-pair'&&c.pairId)focusPair(c.pairId);
            else if(action.kind==='refresh')void run(()=>load(),'현재 소개 상태를 확인했어요.');
          },'intro-guidance-action'));card.append(section);
        }else if(!currentPair)card.append(para('지금은 소개 요청을 보낼 수 없어요.', 'hint'));
      }
      if (demo && c.demoRole) card.append(demoRoleLink(c.demoRole, `${c.label} 역할에서 직접 응답하기`));
      if (c.reasonDetails?.length) {
        const reasons = details('추천 이유가 나와 다르다면');
        for (const r of c.reasonDetails) {
          const row = el('div', null, 'reason-detail'); row.append(para(r.text));
          if (r.editable) append(row, para(`사용한 내 답: ${{ baseline: '평소 기준', context: '이번 추천에서만', missing: '아직 미확인' }[r.source] || '직접 선택한 기준'}`, 'hint'), button('이 이유의 내 답 고치기', () => focusPreference(r.field), `correct-${r.field}`));
          reasons.append(row);
        }
        card.append(reasons);
      }
      const feedback = details('이번 추천이 아쉬웠나요?'), form = el('div', null, 'form');
      const reason = select(form, '가장 가까운 이유', [['condition', '조건이 맞지 않아요'], ['context', '지금 상황과 안 맞아요'], ['no-attraction', '마음이 끌리지 않아요'], ['unknown', '이유를 잘 모르겠어요']], 'reason');
      append(form, para('이유를 남겨도 내 일반적인 취향은 바뀌지 않아요.', 'hint'), button('이 사람만 이번 추천에서 제외', () => discovery({ kind: 'feedback', candidateId: c.id, reason: reason.value, decision: 'skip-current' }, '이 후보만 제외했어요. 내 일반 기준은 그대로예요.'), 'exclude'), button('이유만 남기기', () => discovery({ kind: 'feedback', candidateId: c.id, reason: reason.value, decision: 'record-only' }), 'feedback'), button('내 기준 직접 고치기', () => setPage('profile'), 'edit-criteria'));
      const days = select(form, '이 사람을 다시 보기까지', [['7', '7일 동안 숨기기'], ['30', '30일 동안 숨기기']], 'hide-days');
      append(form, para('새 회차에서도 숨김을 유지해요. 내 기준에서 먼저 해제할 수 있어요. 이미 준비한 약속은 그대로 확인할 수 있어요.', 'hint'), button('고른 기간 동안 이 사람 숨기기', () => discovery({ kind: 'hide-candidate', candidateId: c.id, days: Number(days.value) }, '고른 기간 동안 추천에서 숨겼어요. 내 일반적인 취향은 바뀌지 않았어요.'), 'hide-candidate'));
      feedback.append(form); card.append(feedback); (shown++ === 0 ? cards : others).append(card);
    }
    append(area, cards, shown > 1 && others, excludedCandidateSection());
    append(extras, candidateComparison(d), recommendationInsights(d), sceneExplorer(d), recommendationReflection());
    if (!(view.publicAnswers?.values||view.profile.values)?.availability) area.append(para('상대에게 보여줄 만남 가능 일정이 아직 없거나 기한이 지났어요. 공개할 답을 따로 정해 주세요.', 'hint'), button('공개할 답 정하기', () => focusDisclosure('availability'), 'disclose'));
    const consent = d.fields?.find(f => f.id === 'consent')?.value === true;
    if (consent && d.context?.closed) area.append(button('새 추천 시작 전 확인', () => void startContextPreview(), 'new-context'));
    else if (consent) area.append(button('이번 조건을 마치기 전 확인', () => void startContextPreview(), 'new-context'));
  }
  if (demo) area.append(para('추천과 소개·약속에 같은 가상 계정을 사용해요. 상대 역할에서 직접 수락해야 다음 단계로 이어져요.', 'hint'));
  area.append(extras);
}
function demoRoleLink(role, text) { const a = link(text, `./dating.html?demo=${encodeURIComponent(role)}`); a.target = '_blank'; a.rel = 'noopener'; a.dataset.demoRole = role; return a; }
function preferenceSummary() {
  const summary = getPreferenceSummary(view); if (summary.status !== 'ready') return null;
  const section = el('section', null, 'summary preference-summary'); section.dataset.preferenceSummary = 'true';
  append(section, el('h2', '지금 추천에 쓰는 내 기준'), para(summary.summary, 'hint'));
  const grid = el('div', null, 'preference-summary-grid');
  for (const group of summary.groups) {
    const box = el('section'); box.dataset.summaryGroup = group.id; box.append(el('h3', group.title));
    const row = item => {
      const entry = el('div', null, 'reason-detail'); entry.dataset.summaryField = item.field;
      append(entry, el('strong', item.label), para(item.valueLabel), item.detail && para(item.detail, 'hint'), item.until && para(`답의 기한: ${new Date(item.until).toLocaleString('ko-KR')}`, 'hint'), button('이 기준 확인·수정', () => focusPreference(item.field), `summary-edit-${item.field}`));
      return entry;
    };
    if (!group.items.length) box.append(para('지금 이 구분에 해당하는 답은 없어요.', 'hint'));
    for (const item of group.items.slice(0, 2)) box.append(row(item));
    if (group.items.length > 2) { const more = details(`나머지 ${group.items.length - 2}개 보기`); for (const item of group.items.slice(2)) more.append(row(item)); box.append(more); }
    grid.append(box);
  }
  section.append(grid);
  const conditional = view.discovery.conditionalPreference;
  if (conditional?.effective?.rule) {
    const row = el('section', null, 'reason-detail'); row.dataset.summaryConditional = conditional.effective.status;
    append(row, el('h3', '조건을 붙여 허용하는 기준'), para(conditional.summary), conditionalRuleInformation(conditional), button('연락 기준과 허용 조건 확인', () => focusPreference('wants.contact'), 'summary-edit-conditional.contact'));
    section.append(row);
  }
  return section;
}
function conditionalRuleInformation(conditional) {
  if (!conditional.baseline?.rule && !conditional.context?.rule) return null;
  const info = el('div', null, 'hint');
  for (const [target, label] of [['baseline', '평소 허용 조건'], ['context', '이번 추천의 허용 조건']]) {
    const layer = conditional[target], row = el('div', null, 'reason-detail'); row.dataset.conditionalLayer = target;
    row.append(el('strong', label));
    if (!layer?.rule) row.append(para('별도로 저장한 허용 조건이 없어요.'));
    else {
      row.append(para(layer.status !== 'active' ? '이 조건은 지금 사용하지 않아요. 같은 원래 답으로 돌아와도 자동으로 복원하지 않아요.' : !conditional.available || view.paused
        ? '저장돼 있지만 지금은 추천에 사용하지 않아요.' : conditional.target === target
        ? '지금 추천에 사용하고 있어요.' : '지금은 이번 조건을 먼저 사용해요. 평소 조건은 따로 남아 있어요.'));
      row.append(para(target === 'context' ? '사용 범위: 이번 추천에서만. 이번 추천이 끝나면 함께 끝나요.' : '사용 범위: 앞으로도. 원래 답과 이 조건이 유효할 때 다음 추천에서도 사용해요.'));
      row.append(para(layer.rule.until ? `이 조건의 종료 시점: ${new Date(layer.rule.until).toLocaleString('ko-KR', { timeZoneName: 'short' })}` : '별도 종료 시점은 정하지 않았어요. 원래 답이나 사용 범위가 달라지면 끝나요.'));
      if (layer.rule.source?.until) row.append(para(`원래 답의 종료 시점: ${new Date(layer.rule.source.until).toLocaleString('ko-KR', { timeZoneName: 'short' })}`));
    }
    info.append(row);
  }
  return info;
}
function conditionalContactSection() {
  const conditional = view.discovery?.conditionalPreference;
  if (!conditional) return null;
  const section = details('어떤 조건이면 다른 연락 방식도 괜찮나요?'); section.dataset.conditionalPreference = conditional.effective?.status || 'none';
  append(section, el('h3', '원래 선호는 유지하고, 괜찮은 경우만 더해요'), para('매일 연락하는 방식을 선호하지만, 바쁠 때 미리 알려주는 사람이라면 며칠 간격도 괜찮을 때 선택해 주세요.'),
    para('상대가 직접 공개한 사전 예고 답이 “미리 알려요”일 때만 비교해요. 그 사람이 실제로 그렇게 행동할지는 아직 알 수 없어요.', 'hint'), para(conditional.summary, 'summary'), conditionalRuleInformation(conditional));
  if (conditional.available) {
    const key = conditionalContactDraftKey(), draft = conditionalContactDraft?.key === key ? conditionalContactDraft : null;
    if (draft) section.open = true;
    const form = el('div', null, 'form');
    const targets = (conditional.availableTargets || []).map(target => [target, target === 'context' ? '이번 추천에서만' : '앞으로도']);
    const scope = select(form, '이 허용 조건을 사용할 범위', targets, 'conditional-scope');
    const target = draft?.target || conditional.target;
    scope.value = targets.some(([value]) => value === target) ? target : 'context';
    const deadline = conditional.effective?.rule?.until;
    const local = deadline ? new Date(Date.parse(deadline) - new Date(deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    const lifetimeControl=deadlineControl(form,{scope,name:'conditional-until',value:draft?.until??local,mode:draft?.deadlineMode,
      limits:target=>({contextExpiresAt:view.discovery.context.expiresAt,answerUntil:view.discovery.fields.find(field=>field.id==='wants.contact')?.[target==='baseline'?'baseline':'effective']?.provenance?.until})});
    const until=lifetimeControl.input;
    const rememberDraft = () => { conditionalContactDraft = { key, target: scope.value, until: until.value,deadlineMode:lifetimeControl.mode.value }; };
    scope.addEventListener('change', rememberDraft); until.addEventListener('input', rememberDraft); until.addEventListener('change', rememberDraft);
    append(form, para('원래 연락 답의 기한이 먼저 끝나거나 그 답을 바꾸면 이 허용 조건도 끝나요. 필수로 정한 연락 기준은 완화하지 않아요. 이 선택은 나만 보는 추천 기준이에요.', 'hint'),
      button('이 조건으로 추천 변화 보기', () => {
        const lifetime=lifetimeControl.resolve();if(!lifetime)return;
        rememberDraft();
        const action = { kind: 'conditional-set', ruleId: conditional.id, target: lifetime.target, ...(lifetime.until ? { until: lifetime.until } : {}) };
        correctionSource=null;
        void requestPreview({action},deadlineConfirmation(lifetime,'연락 방식 허용 조건',lifetime.target==='context'?'끝난 뒤 그때 유효한 평소 허용 조건과 원래 연락 선호로 비교해요. 원래 답은 바꾸지 않아요.':'기한이 끝나면 이 평소 허용 조건은 끝나요. 원래 연락 선호와 필수조건은 그대로예요.'));
      }, 'conditional-preview'));
    section.append(form);
  } else section.append(para(conditional.blockReason || '위에서 내 연락 기준을 먼저 확인해 주세요.', 'hint'));
  for (const [target, label] of [['context', '이번 추천의 허용 조건'], ['baseline', '평소 허용 조건']]) if (conditional[target]?.rule)
    section.append(button(`${label} 철회 전 확인`, () => previewDiscovery({ kind: 'conditional-clear', target }), `conditional-clear-${target}`));
  return section;
}
function preferences(area) {
  area.append(heading('내 기준', '평소의 나와, 지금의 나는 다를 수 있어요.', '선택한 답만 사용해요. 이번에만 바꾸거나, 앞으로의 기준을 고칠 수 있어요.'));
  append(area,publicProfilePreview(),savedCandidatesSection());
  if (correctionSource) {
    const source = view.experience?.records.find(r => r.id === correctionSource && r.canCorrect !== false && ['no', 'partly'].includes(r.responses.intent?.value));
    if (!source) correctionSource = null;
    else area.append(append(el('section', null, 'summary'), el('h2', '아쉬웠던 추천에서 이어서 고쳐요'), para('바꾸고 싶은 답이나 중요도를 고른 뒤 미리보기를 확인해 주세요. 적용한 수정은 다음 추천을 돌아볼 때 연결해요.'), button('이번 수정은 경험에 연결하지 않기', () => { correctionSource = null; render(); }, 'correction-cancel')));
  }
  if (!view.discovery) { append(area,para(view.consents?.storePreferences?'지금은 추천 기준을 편집할 수 없어요. 공개용 답은 별도로 관리할 수 있어요.':'추천용 답 저장은 꺼져 있어요. 상대에게 보여줄 답은 별도로 수정하거나 공개를 거둘 수 있어요.','hint'),disclosure()); return; }
  append(area, preferenceSummary());
  append(area, experienceSettings(), excludedCandidateSection());
  const hidden = details(`숨긴 후보 관리 · ${view.discovery.snoozedCandidates?.length || 0}명`);
  hidden.dataset.hiddenCandidates = 'true';
  for (const c of view.discovery.snoozedCandidates || []) { const row = el('div', null, 'summary'); append(row, el('strong', c.label), para(`${new Date(c.until).toLocaleString('ko-KR')}까지 추천에서 숨겨요.`, 'hint'), button('이 사람 숨김 해제', () => discovery({ kind: 'unhide-candidate', candidateId: c.id }, '숨김을 해제했어요. 지금 공개된 조건으로 다시 비교해요.'), 'unhide-candidate')); hidden.append(row); }
  if (!view.discovery.snoozedCandidates?.length) hidden.append(para('현재 공개 범위에서 확인할 수 있는 숨긴 후보가 없어요.', 'hint'));
  area.append(hidden);
  if (view.discovery.priorities) {
    const section = details('나에게 더 중요한 기준'), form = el('div', null, 'form'), inputs = [];
    append(form, para('필수는 아니어도 먼저 보고 싶은 기준을 두 개까지 고르세요. 양쪽의 필수조건은 그대로 지켜요.', 'hint'));
    for (const f of view.discovery.fields.filter(f => f.kind === 'wants'&&!f.legacy)) inputs.push([f.id, check(form, f.label, view.discovery.priorities.effective.includes(f.id), `priority-${f.id}`)]);
    const scope = select(form, '중요도를 반영할 범위', [['context', '이번 추천에서만'], ['baseline', '앞으로도']], 'priority-scope');
    const lifetimeControl=deadlineControl(form,{scope,name:'priority-until',value:localMinute(livePriorityDeadline(view.discovery)),limits:target=>{
      const deadlines=inputs.filter(([,input])=>input.checked).map(([id])=>view.discovery.fields.find(field=>field.id===id)?.[target==='baseline'?'baseline':'effective']?.provenance?.until).filter(Boolean);
      return {contextExpiresAt:view.discovery.context.expiresAt,answerUntil:deadlines.length?new Date(Math.min(...deadlines.map(Date.parse))).toISOString():null};
    }});
    for(const [,input]of inputs)input.addEventListener('change',()=>lifetimeControl.input.parentElement.refreshDeadline?.());
    form.append(button('중요도에 따른 추천 변화 보기', () => {
      const fields = inputs.filter(([, input]) => input.checked).map(([id]) => id);
      if (fields.length > 2) { notice('더 중요한 기준은 두 개까지 골라 주세요.'); return; }
      const lifetime=lifetimeControl.resolve();if(!lifetime)return;
      void requestPreview({action:{kind:'priorities',fields,target:lifetime.target,...(lifetime.until?{until:lifetime.until}:{})},...(correctionSource?{sourceDecisionId:correctionSource}:{})},deadlineConfirmation(lifetime,'더 중요하게 볼 기준',lifetime.target==='context'?priorityReturn(lifetime.effectiveUntil):'평소 중요도의 기한이 끝나면 이전 중요도를 되살리지 않아요. 선호와 필수조건은 그대로예요.'));
    }, 'priority-preview'));
    section.append(form); area.append(section);
  }
  for (const f of view.discovery.fields || []) {
    const section = details(`${f.label} · ${f.valueLabel || '아직 모르겠어요'}`), form = el('div', null, 'form');
    section.dataset.preferenceField = f.id;
    section.open = focusedPreference === f.id;
    append(form, para(f.question || '', 'hint'), para(`평소: ${f.baseline?.valueLabel || '미확인'} / 이번: ${f.context?.valueLabel || '미확인'}`, 'hint'));
    if(f.legacy){
      section.dataset.legacyRelationship=f.id;
      form.append(para('보존한 이전 관계 답이에요. 관계 목적과 시작 속도로 자동 바꾸지 않아요. 새 두 항목은 각각 직접 확인해 주세요.','hint'));
      if(f.required)form.append(button('이전 관계 필수조건 해제 전 비교',()=>previewDiscovery(f.requiredValue==null?{kind:'clear',field:f.id,target:'baseline',required:false}:{kind:'set',field:f.id,value:f.requiredValue,target:'baseline',required:false}),'retire-legacy-purpose'));
      else if(f.baseline?.state==='known')form.append(button('이전 평소 답 지우기',()=>discovery({kind:'clear',field:f.id,target:'baseline'}),'clear-legacy-purpose'));
      if(f.context?.state==='known')form.append(button('이전 이번 답 취소',()=>discovery({kind:'revert-context',field:f.id}),'revert-legacy-purpose'));
      section.append(form);area.append(section);continue;
    }
    const draft = preferenceDrafts.get(f.id), regions=f.kind==='regions';
    const value = regions ? regionPicker(form,'실제로 만날 수 있는 지역',f.value,'value') : select(form, '바꿀 답', [['', '아직 선택하지 않음'], ...(f.options || []).map(o => [o.id, o.label])], 'value');
    value.value = draft?.value ?? (regions?f.value||[]:String(f.value??''));
    const scope = select(form, '반영할 범위', f.kind === 'wants' || f.id === 'availability' || regions ? [['baseline', '앞으로도'], ['context', '이번 추천에서만']] : [['baseline', '앞으로도']], 'scope');
    scope.value = draft?.scope || (f.source === 'context' && [...scope.options].some(o => o.value === 'context') ? 'context' : 'baseline');
    const required = f.kind === 'wants' ? check(form, '상대에게 꼭 필요한 조건이에요.', f.required, 'required') : null;
    if (required) { required.checked = draft?.required ?? required.checked; required.disabled = scope.value === 'context'; scope.addEventListener('change', () => { required.disabled = scope.value === 'context'; }); }
    const localDate = at => { if (!at) return ''; const d = new Date(at); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    const lifetimeControl=f.id==='consent'?null:deadlineControl(form,{scope,name:'until',value:draft?.until??localDate(f.effective?.provenance?.until),mode:draft?.deadlineMode,limits:()=>({contextExpiresAt:view.discovery.context.expiresAt})});
    const until=lifetimeControl?.input||null;
    if (until) form.append(para('기한을 비우면 고른 범위대로 사용해요. 이번 답은 회차가 먼저 끝나면 함께 끝나요. 만료된 답은 새로 확인해요.', 'hint'));
    if (f.baseline?.expired?.length || f.context?.expired?.length || f.state === 'expired') form.append(para(f.context?.expired?.length && f.source === 'baseline' ? '임시 답의 기한이 끝나서 유효한 평소 기준으로 돌아왔어요.' : '이 항목에는 기한이 끝난 답이 있어요. 지금 사용할 답과 범위를 다시 확인해 주세요.', 'summary'));
    const actions = el('div', null, 'actions'); actions.append(button(f.id === 'consent' ? '살펴보기 여부 변경' : '이 답으로 추천 변화 보기', () => {
      const selected = regions?{value:JSON.parse(value.value)}:f.options.find(o => o.id === value.value); if (!selected || regions&&(!selected.value.length||selected.value.length>MAX_MEETING_REGIONS)) { notice(regions?'만날 수 있는 지역을 한 개부터 여섯 개까지 직접 골라 주세요.':'바꿀 답을 직접 골라 주세요. 아직 선택하지 않은 답은 저장하지 않아요.'); return; }
      const lifetime=lifetimeControl?.resolve();if(lifetimeControl&&!lifetime)return;
      const action = { kind: 'set', field: f.id, value: selected.value, target: lifetime?.target||scope.value, ...(required && scope.value === 'baseline' ? { required: required.checked } : {}), ...(lifetime?.until ? { until: lifetime.until } : {}) };
      focusedPreference = f.id; preferenceDrafts.set(f.id, { key: preferenceDraftKey(f), value: value.value, scope: scope.value, required: required?.checked, until: until?.value || '',deadlineMode:lifetimeControl?.mode.value });
      if (f.id === 'consent') void discovery(action); else void requestPreview({action,...(correctionSource?{sourceDecisionId:correctionSource}:{})},deadlineConfirmation(lifetime,f.label,lifetime.target==='context'?answerReturn(f,lifetime.effectiveUntil):lifetime.until?'기한이 끝나면 이 평소 답은 미확인이 돼요. 이전 답을 자동으로 되살리지 않아요.':'직접 변경하거나 철회할 때까지 이 평소 답을 사용해요.'));
    }, `edit-${f.id}`));
    if (f.id !== 'consent') actions.append(button('평소 답 지우기', () => discovery({ kind: 'clear', field: f.id, target: 'baseline' }), `clear-${f.id}`));
    if (f.kind === 'wants' || f.id === 'availability' || regions) actions.append(button('이번 선택 취소', () => discovery({ kind: 'revert-context', field: f.id }), `revert-${f.id}`));
    append(section, form, actions);
    if (f.id === 'wants.contact') {
      const background = el('div', null, 'form'); append(background, el('h3', '그 연락 방식을 원하는 이유가 있나요?'), para('선택 사항이며 나만 보는 답이에요. 이유만 고르면 추천 기준이 자동으로 바뀌지는 않아요.', 'hint'));
      const reason = select(background, '지금 내 마음에 가까운 이유', [['conversation', '대화를 자주 나누고 싶어요'], ['predictability', '바쁠 때 미리 알려주면 좋겠어요'], ['temporary', '요즘만 조금 더 연락하고 싶어요'], ['unsure', '아직 잘 모르겠어요']], 'contact-reason');
      reason.value = view.discovery.reasons?.find(r => r.field === 'wants.contact')?.value || 'unsure';
      background.append(button('이 이유 저장', () => discovery({ kind: 'reason', field: 'wants.contact', value: reason.value }, '내가 선택한 이유를 저장했어요. 기준은 직접 확인한 뒤 바꿔요.'), 'reason-save'));
      const suggestion = view.discovery.noticeSuggestion;
      if (suggestion) append(background, para(suggestion.text || '연락 횟수와 별개로, 바쁠 때 미리 알려주는 방식을 기준으로 살펴볼 수 있어요.'), button('미리 알려주는 기준으로 비교해 보기', () => previewDiscovery({ kind: 'set', field: 'wants.notice', value: 'advance', target: 'context' }), 'notice-preview'));
      if (reason.value === 'temporary') background.append(para('위에서 반영할 범위를 “이번 추천에서만”으로 고르고 종료 시점을 정할 수 있어요.', 'summary'));
      section.append(background);
      append(section, conditionalContactSection());
    }
    area.append(section);
  }
  const history = details('내 기준 변경 기록'), list = el('ol', null, 'history');
  for (const change of [...(view.discovery.changes || [])].reverse().slice(0, 20)) {
    const row = el('li', `${change.label || change.field} · ${new Date(change.at).toLocaleString('ko-KR')}`);
    const spec = view.discovery.fields.find(f => f.id === change.field), label = v => v?.state === 'known' ? spec?.kind==='regions'?formatMeetingRegions(v.value):spec?.options.find(o => o.value === v.value)?.label || '선택한 답' : '미확인';
    row.append(para(`${label(change.before?.effective)} → ${label(change.after?.effective)}`, 'hint'));
    if (change.canUndo) row.append(button('이 답 되돌리기', () => discovery({ kind: 'undo-field', field: change.field, changeId: change.id }, '답을 되돌렸어요. 과거 동의·후보 선택·약속 수락은 복원하지 않아요.'), 'undo'));
    list.append(row);
  }
  append(history, list.children.length ? list : para('아직 답 변경 기록이 없어요.', 'hint'));
  const priorityHistory = append(el('section'), el('h3', '더 중요하게 볼 기준의 변경 기록')), priorityList = el('ol', null, 'history');
  priorityHistory.dataset.priorityHistory = 'true';
  const priorityNames = fields => fields === null ? '유효한 평소 중요 기준을 따름' : fields?.length
    ? fields.map(id => view.discovery.fields.find(field => field.id === id)?.label || '이전 기준').join(' · ') : '별도 중요 기준 없음';
  const deadlineText = (until, target) => until ? `${new Date(until).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', timeZoneName: 'short' })}까지`
    : target === 'context' ? '이번 추천이 끝날 때까지 · 날짜 기한 없음' : '직접 변경할 때까지 · 날짜 기한 없음';
  for (const change of [...(view.discovery.priorityChanges || [])].reverse().slice(0, 20)) {
    const row = el('li'), scope = change.target === 'context' ? '이번 추천에서만' : '평소 기준',
      previousExpired = !!change.beforeUntil && Date.parse(change.beforeUntil) <= Date.parse(view.asOf),
      ended = change.contextId !== view.discovery.context.id || view.discovery.context.closed,
      savedExpired = !!change.afterUntil && Date.parse(change.afterUntil) <= Date.parse(view.asOf);
    row.dataset.priorityChange = change.id; row.dataset.priorityTarget = change.target;
    append(row, el('strong', `${scope} · ${change.kind === 'undo-priorities' ? '되돌린 기록' : '변경한 기록'}`),
      para(new Date(change.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), 'hint'),
      para(`변경 전: ${priorityNames(change.before)} / 변경 후: ${priorityNames(change.after)}`),
      para(`변경 전 기한: ${deadlineText(change.beforeUntil, change.target)} / 변경 후 기한: ${deadlineText(change.afterUntil, change.target)}`, 'hint'));
    if (ended) row.append(para('지난 추천의 변경 기록이에요. 이 기록에서는 되돌리지 않아요.', 'hint'));
    else if (savedExpired) row.append(para('변경 후 기한이 끝났어요. 기록에 보이는 중요 기준을 지금 사용한다는 뜻은 아니에요.', 'hint'));
    if (change.canUndo) {
      const restored = previousExpired ? change.target === 'context' ? null : [] : change.before,
        after = previousExpired ? change.target === 'context'
          ? '이전 중요도의 기한이 지나 복원하지 않아요. 이번 중요도만 취소하고, 그때 유효한 평소 중요 기준으로 비교해요.'
          : '이전 중요도의 기한이 지나 복원하지 않아요. 평소의 별도 중요도를 비우고 비교해요.'
          : change.target === 'context' ? '이번 중요도를 되돌려요. 유효한 평소 기준과 필수조건, 답, 소개와 약속은 유지해요.'
            : '평소 중요도를 되돌려요. 별도로 남아 있는 이번 중요도와 필수조건, 답, 소개와 약속은 유지해요.';
      row.append(para(previousExpired ? after : `되돌리면: ${priorityNames(restored)} · ${deadlineText(change.beforeUntil, change.target)}`, 'hint'),
        button('이 중요도 되돌리기 전 비교', () => requestPreview({ action: { kind: 'undo-priorities', changeId: change.id } },
          { label: '중요도 되돌리기', summary: `${scope} · 적용 후: ${priorityNames(restored)}${previousExpired ? '' : ` · ${deadlineText(change.beforeUntil, change.target)}`}`, after }), 'undo-priorities'));
    }
    priorityList.append(row);
  }
  priorityHistory.append(priorityList.children.length ? priorityList : para('아직 중요도 변경 기록이 없어요.', 'hint'));
  history.append(priorityHistory); area.append(history, disclosure());
}
const publicDeadlineText=at=>`한국시간 ${new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`;
function publicProfilePreview(){
  const preview=getPublicProfilePreview(view);if(preview.status!=='ready')return null;
  const section=details(preview.title);section.dataset.publicProfilePreview='true';section.dataset.publicVisibility=preview.isPublic?'public':'private';
  section.append(para(preview.notice,'hint'));
  const card=el('article',null,'card'),basic=el('div',null,'reason-detail');basic.dataset.previewProfile='true';
  append(basic,el('h3',preview.profile.nickname),preview.profile.region&&para(`지역 소개 · ${preview.profile.region}`),preview.profile.intro&&para(preview.profile.intro),button('이름·지역·소개 수정',()=>editFromPublicPreview('profile'),'preview-edit-profile'));card.append(basic);
  for(const item of preview.answers){const row=el('div',null,'reason-detail');row.dataset.previewPublicField=item.field;append(row,el('strong',item.label),para(item.valueLabel),item.required&&para('공개한 필수조건','pill'),item.until&&para(`공개 기한: ${publicDeadlineText(item.until)}`,'hint'),button(`${item.label} 수정`,()=>editFromPublicPreview(item.field),`preview-edit-${item.field}`));card.append(row);}
  if(!preview.answers.length)card.append(para('현재 유효한 공개 답이 없어요.','hint'));
  section.append(card);
  if(preview.expired.length)section.append(para(`기한이 지나 비교에서 빠진 답: ${preview.expired.map(item=>item.label).join(', ')}. 이전 답의 내용은 이 카드에 표시하지 않아요.`,'hint'));
  if(preview.requiredUnknown.length)section.append(para(`확인이 필요한 필수조건: ${preview.requiredUnknown.map(item=>item.label).join(', ')}. 필수 지정은 남아 있으며 충족했다고 판단하지 않아요.`,'hint'));
  for(const item of [...preview.expired,...preview.requiredUnknown].filter((item,i,items)=>items.findIndex(other=>other.field===item.field)===i))section.append(button(`${item.label} 다시 확인`,()=>editFromPublicPreview(item.field),`preview-edit-${item.field}`));
  section.append(para('저장된 공개용 내용만 보여요. 작성 중인 입력은 저장 후 반영돼요. 상대의 기준에 따라 추천 설명과 노출 여부는 달라질 수 있어요.','hint'));
  return section;
}
function readPublicInput({f,input,required,lifetime}){
  let value=null;
  if(f.kind==='regions'){const selected=JSON.parse(input.value);if(selected.length>MAX_MEETING_REGIONS)throw new Error('공개할 지역은 여섯 개까지 골라 주세요.');if(selected.length)value=selected;}
  else if(input.value!==''){const option=f.options.find(o=>o.id===input.value);if(!option)throw new Error(`${f.label}의 답을 다시 골라 주세요.`);value=option.value;}
  if(value===null)return {kind:'public-answer',field:f.id,value:null,required:false,until:null};
  const savedUntil=view.profile.expirations?.[f.id];
  if(lifetime.mode.value==='keep'&&savedUntil&&Date.parse(savedUntil)<=Date.parse(view.asOf)&&JSON.stringify(value)!==JSON.stringify(view.profile.values?.[f.id]))throw new Error(`${f.label}의 공개 기한이 지났어요. 새 기한이나 ‘기한 없이 공개하기’를 직접 골라 주세요.`);
  let until;try{until=lifetime.resolve();}catch{throw new Error(`${f.label}의 공개 기한을 현재 시각 이후로 골라 주세요.`);}
  return {kind:'public-answer',field:f.id,value,required:required?.checked===true,until};
}
function saveProfileEditing(action,keys,message){
  return run(async()=>{
    pendingProfileSave={accountId:view.accountId,keys};
    syncControls();
    let result;
    try{result=await delivery.send({actorId:view.accountId,expectedRevision:view.revision,action,demo});}
    catch(error){if(!delivery.snapshot())pendingProfileSave=null;throw error;}
    for(const key of keys)profileEditingDrafts.delete(key);pendingProfileSave=null;
    view=result.view;queuedView=null;appliedPreview=null;
    if(keys.includes(publicPreviewReturn?.key)&&returnToPublicPreview())return;
    render();if(action.kind==='public-answer')openDisclosureField(action.field);
  },message);
}
function savePublicField(action){return saveProfileEditing(action,[action.field],'이 항목만 저장했어요. 다른 항목에 작성 중인 내용은 따로 저장해 주세요.');}
const expiredIntroductionFields=()=>DISCOVERY_FIELDS.filter(f=>view.publicAnswers?.expiredFields?.includes(f.id)
  &&(['availability','self.meetingRegions'].includes(f.id)||f.kind==='wants'&&view.profile.required?.includes(f.id)));
function publicReconfirmation(){
  if(view.status!=='active'||!Array.isArray(view.publicAnswers?.expiredFields))return null;
  const expired=DISCOVERY_FIELDS.filter(f=>f.id!=='consent'&&view.publicAnswers.expiredFields.includes(f.id));if(!expired.length)return null;
  const box=append(el('section',null,'summary'),el('h2','내 공개 답의 기한을 확인해 주세요.'));box.dataset.publicReconfirmation='true';
  const essential=expiredIntroductionFields().length>0;
  box.append(para(view.consents?.profilePublic===false?'프로필 공개는 꺼져 있어요. 저장한 공개용 답 중 기한이 지난 항목을 별도로 관리할 수 있어요.':essential?'후보를 비교할 수 있어도 새 소개에는 아래 공개 답의 확인이 필요해요. 내가 정한 필수조건은 유지돼요.':'기한이 지난 공개 답은 현재 비교에서 빠져 있어요. 지금도 같은 답인지 원할 때 다시 확인해 주세요.','hint'));
  for(const f of expired)box.append(button(`${f.label} · 공개 답 다시 확인`,()=>focusDisclosure(f.id),`public-reconfirm-${f.id}`));
  return box;
}
function publicLifetime(form,f){
  const saved=view.profile.expirations?.[f.id]||null,expired=view.publicAnswers?.expiredFields?.includes(f.id)===true;
  const title=expired?'공개 기한 지남 · 다시 확인':saved?'공개 기한 확인·변경':'공개 기한 설정 (선택)';
  const box=details(title);box.dataset.publicLifetime=f.id;
  if(expired)append(box,para('기한이 지난 답은 현재 공개 비교에서 빠져 있어요. 저장한 답을 확인하고 기한을 다시 정하면 사용할 수 있어요. 필수 표시도 직접 바꾸기 전까지 유지해요.','hint'));
  append(box,para(saved?`저장한 공개 기한: ${publicDeadlineText(saved)} · 이 시각부터 미확인으로 바뀌어요.`:'현재 공개 기한은 따로 정하지 않았어요.','hint'));
  const mode=select(box,'이 공개 답의 기한',[['keep','현재 기한 유지'],['today','오늘까지만 · 한국시간'],['custom','날짜 직접 지정'],['none','기한 없이 공개하기']],`public-until-mode-${f.id}`);
  const input=field(box,'공개 종료 시각 (기기 시간)','datetime-local',localMinute(saved),`public-until-${f.id}`),summary=para('','hint');
  const resolve=()=>{
    if(mode.value==='keep')return saved;
    if(mode.value==='none')return null;
    return resolvePreferenceDeadline({mode:mode.value,target:'baseline',at:view.asOf,allowedTargets:['baseline'],
      ...(mode.value==='custom'?{until:input.value?new Date(input.value).toISOString():undefined}:{})}).until;
  };
  const refresh=()=>{input.disabled=busy||mode.value!=='custom';try{const until=resolve();summary.textContent=until?`공개 종료: ${publicDeadlineText(until)}. 이후 이 답은 미확인이며 이전 답을 되살리지 않아요.`:'기한 없이 공개해요. 나중에 직접 수정하거나 공개를 거둘 수 있어요.';}catch{summary.textContent='공개할 기한을 현재 시각 이후로 골라 주세요.';}};
  mode.addEventListener('change',()=>{if(mode.value==='today')try{input.value=localMinute(resolve());}catch{}refresh();});input.addEventListener('input',refresh);
  box.refreshDeadline=refresh;box.dataset.deadlineControl=`public-${f.id}`;
  append(box,summary,para('추천용 답의 기한과 별개예요. 이 설정으로 프로필 공개나 소개 초대를 켜지 않아요.','hint'));form.append(box);refresh();
  return {mode,resolve};
}
function disclosure() {
  const section = details('상대에게 보여줄 답 정하기'), form = el('div', null, 'form'), inputs = [];
  section.dataset.disclosure='true';
  const review=el('div');review.setAttribute('aria-live','polite');
  const invalidateReview=()=>{review.replaceChildren();delete review.dataset.publicReview;};
  form.addEventListener('input',invalidateReview);form.addEventListener('change',invalidateReview);
  append(section, disclosureDifferences());
  form.append(para('내 추천용 답변과 별개예요. 여기서 직접 공개한 답만 상대의 추천 비교에 사용해요. 이번 추천에서만 고른 답이나 비공개 회고는 복사하지 않아요.', 'hint'));
  if(!view.consents?.storePreferences)form.append(para('추천용 답 저장은 꺼진 채 유지해요. 여기서 저장해도 추천 답이나 과거 회고를 다시 만들지 않아요.','hint'));
  if(view.consents?.profilePublic===false)form.append(para('프로필 공개는 꺼져 있어요. 저장해도 공개나 초대 수신을 켜지 않아요.','hint'));
  if(view.publicAnswers?.expiredFields?.length){
    const names=view.publicAnswers.expiredFields.map(id=>DISCOVERY_FIELDS.find(f=>f.id===id)?.label||id);
    const expired=para(`공개 기한이 지난 답: ${names.join(', ')}. 현재 비교에는 사용하지 않아요. 각 항목에서 답과 공개 기한을 다시 확인해 주세요.`,'summary');expired.dataset.publicExpired='true';form.append(expired);
    for(const f of DISCOVERY_FIELDS.filter(f=>view.publicAnswers.expiredFields.includes(f.id)))form.append(button(`${f.label}의 공개 답·기한으로 이동`,()=>openDisclosureField(f.id),`public-expired-edit-${f.id}`));
  }
  for (const f of DISCOVERY_FIELDS) {
    if (f.id === 'consent') continue;
    if(f.legacy&&!Object.hasOwn(view.profile.values||{},f.id))continue;
    const entry=el('div',null,'public-field');entry.dataset.publicField=f.id;form.append(entry);
    const regions=f.kind==='regions', options=f.legacy?f.options.filter(option=>option.value===view.profile.values?.[f.id]):f.options;
    const input=regions?regionPicker(entry,'상대에게 공개할 만남 가능 지역',view.profile.values?.[f.id],`public-${f.id}`):select(entry, f.legacy?`${f.label} (보존한 이전 답)`:f.label, [['', '공개하지 않기'], ...options.map(o => [o.id, o.label])], `public-${f.id}`);
    input.value = regions?view.profile.values?.[f.id]||[]:Object.hasOwn(view.profile.values||{},f.id)?String(view.profile.values[f.id]):'';
    if(regions)entry.append(para('선택하지 않으면 지역을 공개하지 않아요. 내 추천용 선택과 별개이며 평소·이번 답을 자동 복사하지 않아요.','hint'));
    const required = f.kind === 'wants' ? check(entry, '공개한 이 조건은 꼭 필요해요.', view.profile.required?.includes(f.id), `public-required-${f.id}`) : null;
    const lifetime=publicLifetime(entry,f);
    const item={ f, input, required, lifetime };inputs.push(item);
    const fieldReview=el('div');fieldReview.setAttribute('aria-live','polite');
    const invalidateField=()=>{entry.dataset.publicDirty='true';fieldReview.replaceChildren();delete fieldReview.dataset.publicFieldReview;};
    entry.addEventListener('input',invalidateField);entry.addEventListener('change',invalidateField);
    entry.append(button('이 항목만 저장 전 확인',()=>{
      let action;try{action=readPublicInput(item);}catch(error){notice(error.message);return;}
      const revision=view.revision,actor=view.accountId,previous=view.profile.values?.[f.id];
      const label=value=>value==null?'공개하지 않기':f.kind==='regions'?formatMeetingRegions(value):f.options.find(o=>o.value===value)?.label||'답 미확인';
      fieldReview.dataset.publicFieldReview=f.id;
      fieldReview.replaceChildren(el('h3',`${f.label}만 저장할까요?`),para(`저장된 답: ${label(previous)}`),para(`저장할 답: ${label(action.value)}`));
      if(action.value!==null)append(fieldReview,para(action.required?'이 공개 조건은 꼭 필요해요.':'공개한 필수조건으로 지정하지 않아요.','hint'),para(action.until?`공개 기한: ${publicDeadlineText(action.until)}${Date.parse(action.until)<=Date.parse(view.asOf)?' · 이미 지나 현재 비교에서는 빠져 있어요.':''}`:'공개 기한을 따로 정하지 않아요.','hint'));
      append(fieldReview,para('이 항목의 답·필수 여부·기한만 저장해요. 다른 입력과 공개·초대 설정은 바꾸지 않아요.','hint'),button('확인한 이 항목 저장',()=>{
        if(view.accountId!==actor||view.revision!==revision){fieldReview.replaceChildren(para('기록이 달라졌어요. 현재 답으로 다시 확인해 주세요.'));return;}
        try{if(JSON.stringify(readPublicInput(item))!==JSON.stringify(action)){invalidateField();notice('바뀐 입력으로 다시 확인해 주세요.');return;}}catch(error){invalidateField();notice(error.message);return;}
        void savePublicField(action);
      },`public-field-save-${f.id}`,true),button('저장하지 않고 계속 수정',()=>{fieldReview.replaceChildren();delete fieldReview.dataset.publicFieldReview;},`public-field-cancel-${f.id}`));
    },`public-field-review-${f.id}`),fieldReview);
    bindProfileEditing(entry,f.id);
  }
  form.append(button('이 답만 공개 프로필에 저장', () => {
    const values = {}, required = [], expirations={};
    for (const { f, input, required: hard, lifetime } of inputs) {
      if(f.kind==='regions'){const selected=JSON.parse(input.value);if(selected.length>MAX_MEETING_REGIONS){notice('공개할 지역은 여섯 개까지 골라 주세요.');return;}if(selected.length)values[f.id]=selected;}
      else if(input.value!==''){values[f.id]=f.options.find(o=>o.id===input.value).value;if(hard?.checked)required.push(f.id);}
      if(Object.hasOwn(values,f.id)){
        const savedUntil=view.profile.expirations?.[f.id];
        if(lifetime.mode.value==='keep'&&savedUntil&&Date.parse(savedUntil)<=Date.parse(view.asOf)
          &&JSON.stringify(values[f.id])!==JSON.stringify(view.profile.values?.[f.id])){
          notice(`${f.label}의 공개 기한이 지났어요. 답을 바꾸려면 새 기한이나 ‘기한 없이 공개하기’를 직접 골라 주세요.`);return;
        }
        try{const until=lifetime.resolve();if(until||lifetime.mode.value==='none')expirations[f.id]=until;}
        catch{notice(`${f.label}의 공개 기한을 현재 시각 이후로 골라 주세요.`);return;}
      }
    }
    const profile={...view.profile,values,required,expirations};
    const before=view.profile.values?.['self.meetingRegions'],after=values['self.meetingRegions'];
    const changedDeadlines=inputs.filter(({f})=>Object.hasOwn(values,f.id)&&(expirations[f.id]||null)!==(view.profile.expirations?.[f.id]||null));
    if(JSON.stringify(before)!==JSON.stringify(after)||changedDeadlines.length){
      const revision=view.revision;review.dataset.publicReview='true';review.replaceChildren(el('h3','공개할 답과 기한을 확인해 주세요.'));
      if(JSON.stringify(before)!==JSON.stringify(after))append(review,para(`지금 공개: ${formatMeetingRegions(before)}`),para(`저장 후 공개: ${formatMeetingRegions(after)}`));
      for(const {f} of changedDeadlines){const until=expirations[f.id],value=values[f.id],label=f.kind==='regions'?formatMeetingRegions(value):f.options.find(o=>o.value===value)?.label||value;review.append(para(`${f.label} · ${label}: ${until?publicDeadlineText(until)+'부터 미확인':'기한 없이 공개'}`));}
      append(review,para('기한이 끝나면 현재 비교에서 빠지고 다시 확인해야 해요. 필수조건은 자동으로 풀지 않아요. 내 추천용 답의 기한과 프로필 공개·초대 수신 설정은 그대로 유지해요.','hint'));
      append(review,button('확인한 공개 답과 기한 저장',()=>{
        if(view.revision!==revision){review.replaceChildren(para('기록이 달라졌어요. 현재 공개 답으로 다시 확인해 주세요.'));return;}
        void saveProfileEditing({kind:'profile',profile},inputs.map(item=>item.f.id),'확인한 지역과 공개 답을 저장했어요. 내 비공개 답과 회고는 그대로예요.');
      },'save-regions-disclosure'),button('공개 변경하지 않기',()=>review.replaceChildren(),'cancel-regions-disclosure'));return;
    }
    void saveProfileEditing({kind:'profile',profile},inputs.map(item=>item.f.id),'공개할 답을 따로 저장했어요. 내 비공개 기준과 회고는 공개하지 않아요.');
  }, 'save-disclosure'));append(form,review);section.append(form);return section;
}
const pairs = () => view.pairs || [];
function pairView(pair) { return pair.view || pair.appointments || pair; }
function connect(targetAccountId) {
  return act({ kind: 'connect', targetAccountId }, '소개 요청을 보냈어요. 서로 소개를 수락한 뒤 일정을 정해요.', () => { page = 'inbox'; focusedPair = view.pairs?.find(p => p.status === 'active' && p.view?.people.some(person => person.id === targetAccountId))?.pairId || null; });
}
function introduction(pair, action) {
  return act({ kind: 'introduction', pairId: pair.pairId, expectedIntroductionRevision: pair.introduction.revision, action }, action.kind === 'reopen' ? '내 소개 요청 받기를 다시 열었어요. 새 소개 요청과 일정은 다시 확인해야 해요.' : '소개 요청 상태를 저장했어요.');
}
function introductionPanel(pair) {
  const i = pair.introduction; if (!i) return null;
  const box = el('section', null, 'introduction summary'); box.dataset.introduction = i.current?.status || 'closed';
  append(box, el('h3', '먼저, 서로 소개받을까요?'));
  const request = i.current;
  if (i.accepted) box.append(para('서로 소개받기로 했어요. 구체적인 약속은 아래에서 두 사람이 다시 수락해요.'));
  else if (request?.status === 'pending') box.append(para(request.to === view.accountId ? '상대가 소개를 요청했어요. 편할 때 선택해 주세요.' : '소개 요청을 보냈어요. 상대의 응답을 기다리고 있어요.'), para(`응답 기한: ${new Date(request.expiresAt).toLocaleString('ko-KR')}`, 'hint'));
  else box.append(para(({ declined: '이번 소개는 진행하지 않기로 했어요.', expired: '소개 요청의 응답 기한이 지났어요.', withdrawn: '소개 요청을 닫았어요.' })[request?.status] || '새 소개 요청과 서로의 수락이 필요해요.'));
  const actions = el('div', null, 'actions');
  if (i.canRespond) actions.append(button('소개 수락', () => introduction(pair, { kind: 'respond', introductionId: request.id, value: 'accept' }), 'intro-accept', true));
  if (i.canDecline??i.canRespond) actions.append(button('이번 소개는 받지 않을게요', () => introduction(pair, { kind: 'respond', introductionId: request.id, value: 'decline' }), 'intro-decline'));
  if(request?.status==='pending'&&request.to===view.accountId&&!i.canRespond&&i.canDecline){
    box.append(para('현재 공개 답과 소개 조건으로는 수락할 수 없어요. 이번 소개를 받지 않겠다는 답은 남길 수 있어요.','hint'));
    const expired=expiredIntroductionFields();
    if(expired.length){
      const review=append(el('div',null,'summary'),para('내 공개 답 중 기한이 지난 항목을 확인해 주세요. 답을 고쳐도 소개가 자동으로 수락되지는 않아요.','hint'));review.dataset.publicResponseReconfirmation='true';
      for(const f of expired)review.append(button(`${f.label} · 공개 답 다시 확인`,()=>focusDisclosure(f.id),`intro-public-reconfirm-${f.id}`));
      box.append(review);
    }
  }
  if (i.canWithdraw) actions.append(button(i.accepted ? '이 소개 닫기' : '보낸 소개 요청 취소', () => introduction(pair, { kind: 'withdraw', introductionId: request.id }), 'intro-withdraw'));
  if (i.canReopen) append(box, para('직접 다시 열기 전에는 이 상대의 새 요청을 받지 않아요. 다시 열어도 이전 수락은 복원되지 않아요.', 'hint'), button('이 상대의 소개 요청 다시 받기', () => introduction(pair, { kind: 'reopen' }), 'intro-reopen'));
  const other = pair.view?.people?.find(p => p.id !== view.accountId);
  if (i.canSend && other) actions.append(button('새 소개 요청 보내기', () => connect(other.id), 'intro-send', true));
  if (!i.accepted && !i.canRespond && !i.canSend && !i.canReopen && request?.status !== 'pending') box.append(para('지금은 새 요청을 보낼 수 없어요. 다시 요청할 수 있는 시점과 두 사람의 요청 받기 설정을 함께 확인해요.', 'hint'));
  box.append(actions); return box;
}
function appointment(pair, action, message = '약속 상태를 저장했어요.', after) {
  const v = pairView(pair); return act({ kind: 'appointment', pairId: pair.pairId || v.pairId, expectedPairRevision: v.revision, action }, message, after);
}
function meetingAlignment(pair) {
  const a = pair.alignment;
  if (!a?.key || a.status === 'unavailable') return null;
  const section = details('첫 만남에서 맞출 한 가지 · 선택');
  section.classList.add('meeting-alignment'); section.dataset.alignment = a.status;
  const disclosureKey = a.contextKey || a.key;
  section.open = alignmentDisclosure.get(disclosureKey) ?? a.status !== 'optional';
  section.addEventListener('toggle', () => { if (section.isConnected) alignmentDisclosure.set(disclosureKey, section.open); });
  section.append(para('서로 공개한 방식에 차이가 있어요. 첫 만남 전에 한 가지만 맞춰 볼까요?', 'hint'));
  const basis = el('ul', null, 'alignment-basis'); basis.dataset.alignmentBasis = 'public';
  for (const item of a.basis || []) basis.append(el('li', `${item.personId === view.accountId ? '나' : item.label}: ${item.valueLabel}`));
  append(section, basis, el('h3', a.title || '이번 첫 만남의 방식'), para(a.suggestion, 'alignment-question'));
  if (a.proposal) section.append(para(`${a.proposal.byMe ? '내가' : '상대가'} 새로 제안한 방식이에요. 이 제안에 두 사람이 각각 답해 주세요.`, 'hint'));
  const responses = el('dl', null, 'alignment-responses');
  const responseLabel = value => value === 'yes' ? '이 방식이 좋아요' : value === 'different' ? '다른 방식이 좋아요' : '아직 답하지 않았어요';
  for (const [label, value] of [['내 답', a.me?.value], ['상대의 답', a.partner?.value]]) {
    const row = el('div'); append(row, el('dt', label), el('dd', responseLabel(value))); responses.append(row);
  }
  const status = ({ optional: '원할 때 답해 주세요.', waiting: '아직 서로의 합의가 되지는 않았어요.', different: '아직 합의하지 않았어요. 원하는 방식이 다르다는 뜻이에요.', agreed: '둘 다 이 방식이 좋다고 답했어요. 이번 첫 만남을 준비할 때 참고해요.' })[a.status];
  append(section, responses, para(status, a.status === 'agreed' ? 'pill' : 'hint'));
  section.append(para('내 답은 상대에게 보여요. 답하지 않아도 약속을 정할 수 있고, 날짜·장소는 아래에서 따로 제안하고 수락해요.', 'hint'));
  const submit = async (action, message) => {
    await act({ kind: 'alignment', pairId: pair.pairId, expectedAlignmentRevision: a.revision, action: { key: a.key, ...action } }, message, () => alignmentDisclosure.set(disclosureKey, true));
  };
  const respond = value => submit({ value }, value === null ? '내 조율 답을 철회했어요. 약속 내용은 그대로예요.' : '현재 제안에 대한 내 답을 공유했어요.');
  const actions = el('div', null, 'actions');
  if (a.canRespond) for (const [value, label] of [['yes', '이 방식이 좋아요'], ['different', '다른 방식이 좋아요']]) {
    const choice = button(label, () => respond(value), `alignment-${value}`);
    choice.setAttribute('aria-pressed', String(a.me?.value === value));
    if (a.me?.value === value) { choice.disabled = true; choice.dataset.fixedDisabled = 'true'; }
    actions.append(choice);
  }
  if (a.canWithdraw) actions.append(button('내 답 철회', () => respond(null), 'alignment-withdraw'));
  section.append(actions);
  if (a.canProposeOption && a.options?.length) {
    const alternatives = details('원하는 다른 방식 제안하기'), form = el('div', null, 'form');
    alternatives.dataset.alignmentAlternatives = 'true'; alternatives.open = a.status === 'different';
    const options = a.options.filter(option => option.id !== a.selectedOptionId);
    const choice = select(form, '이번 첫 만남에서 원하는 방식', [['', '다른 방식 선택하기'], ...options.map(option => [option.id, option.label])], 'alignment-option');
    const caption = para('먼저 원하는 방식을 골라 주세요.', 'hint'); caption.setAttribute('aria-live', 'polite');
    choice.addEventListener('change', () => { caption.textContent = options.find(option => option.id === choice.value)?.suggestion || '먼저 원하는 방식을 골라 주세요.'; });
    append(form, caption, para('새로 제안하면 이전 안의 답은 해제돼요. 제안한 사람도 새 안에 직접 답해야 합의가 돼요. 약속의 날짜·장소·수락은 따로 확인해요.', 'hint'),
      button('이 방식으로 새로 제안', () => {
        if (!options.some(option => option.id === choice.value)) { notice('제안할 다른 방식을 골라 주세요.'); return; }
        void submit({ kind: 'propose-option', optionId: choice.value }, '다른 방식을 제안했어요. 새 안에 두 사람이 각각 답해 주세요.');
      }, 'alignment-propose-option'));
    alternatives.append(form); section.append(alternatives);
  }
  if (a.canCancelOption) section.append(button('내 대안 취소하고 기본안 다시 확인', () => submit({ kind: 'cancel-option' }, '대안을 취소했어요. 기본안도 두 사람이 새로 확인해 주세요.'), 'alignment-cancel-option'));
  return section;
}
function reflectionSuggestions(pair) {
  const suggestions = pairView(pair).me?.suggestions || []; if (!suggestions.length) return null;
  const section = el('section', null, 'summary'); section.dataset.suggestions = 'private'; section.append(el('h3', '내 다음 만남에 반영하기'), para('나만 보는 제안이에요. 적용해도 일반적인 취향이나 상대에게 전할 말은 바뀌지 않아요.', 'hint'));
  for (const s of suggestions) {
    if (s.status === 'consumed' || s.status === 'dismissed') continue;
    const row = el('div', null, 'suggestion'); row.dataset.suggestion = s.id; row.append(para(s.text));
    const action = kind => appointment(pair, { kind, suggestionId: s.id, suggestionRevision: s.revision }, kind === 'apply-suggestion' ? '다음 새 약속의 입력 시간에만 적용했어요. 아직 상대에게 보내지 않았어요.' : '내 다음 약속 준비를 변경했어요.');
    if (s.canApply) row.append(button(`${s.minutes}분으로 다음 약속 준비`, () => action('apply-suggestion'), 'suggestion-apply'));
    if (s.canDismiss) row.append(button('이번 제안은 넘기기', () => action('dismiss-suggestion'), 'suggestion-dismiss'));
    if (s.canUndo) row.append(para('다음 새 약속 입력에 적용 중이에요.', 'hint'), button('시간 적용 되돌리기', () => action('undo-suggestion'), 'suggestion-undo'));
    if (s.kind === 'change-activity') row.append(para('다음 약속에서 원하는 장소나 활동을 직접 적어 주세요. 회고 내용은 자동으로 전달하지 않아요.', 'hint'));
    section.append(row);
  }
  return section.children.length > 2 ? section : null;
}
function proposalChanges(a) {
  if (!a.proposal.changes?.length) return null;
  const box = el('section', null, 'proposal-changes summary'); append(box, el('h3', '이번에 바뀐 내용'), para(a.status === 'pending' ? '아래 변경을 확인한 뒤 두 사람 모두 다시 수락해 주세요.' : '이 일정이 이전 제안에서 바뀐 기록이에요.', 'hint'));
  const labels = { startsAt: '시작', endsAt: '종료', timeZone: '시간대', place: '장소', note: '전할 말' };
  const previous = a.history?.at(-1)?.schedule || a.proposal.schedule;
  const format = (field, value, zone) => ['startsAt', 'endsAt'].includes(field) ? new Intl.DateTimeFormat('ko-KR', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : value || '없음';
  for (const c of a.proposal.changes) append(box, el('strong', labels[c.field] || c.field), para(`이전: ${format(c.field, c.before, previous.timeZone)}`, 'hint'), para(`변경: ${format(c.field, c.after, a.proposal.schedule.timeZone)}`));
  return box;
}
function scheduleForm(pair, existing) {
  const form = el('div', null, 'form');
  const formKey = existing ? `${existing.id}:${existing.proposal.version}` : 'new', slot = scheduleSlot(pair.pairId, formKey);
  const draftKey = scheduleDraftKey(pair, formKey), saved = scheduleDrafts.get(slot);
  const draft = draftKey && saved?.key === draftKey ? saved : null;
  form.dataset.scheduleForm = formKey; form.dataset.schedulePair = pair.pairId;
  if (draftKey) form.dataset.scheduleDraftKey = draftKey;
  const v = pairView(pair), stored = existing ? null : rescheduleDrafts.get(pair.pairId);
  const current = stored && getRescheduleDraft(pair, stored.appointmentId);
  const copied = current && ['appointmentId', 'proposalVersion', 'place', 'durationMinutes'].every(key => current[key] === stored[key]) ? current : null;
  if (stored && !copied) rescheduleDrafts.delete(pair.pairId);
  const hint = existing || copied ? null : v.me?.nextForm;
  const local = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const preparation = getSchedulePreparation({ ...pair.scheduleContext, nowISO: pair.scheduleContext?.asOf || v.at || new Date().toISOString(), timeZone: zone });
  const prep = el('section', null, 'summary'); prep.dataset.schedulePreparation = preparation.status;
  append(prep, el('h3', '서로 공개한 일정부터 확인해요'), para(preparation.summary));
  if (preparation.dates?.length) append(prep, para('겹치는 요일의 다가오는 날짜예요. 아래에서 실제 날짜와 시간을 직접 정해 주세요.', 'hint'), para(preparation.dates.map(d => d.label).join(' · ')));
  if (preparation.timeHint) prep.append(para(preparation.timeHint, 'hint'));
  append(form, prep);
  const start = field(form, '시작 날짜와 시간', 'datetime-local', draft?.values.startsAt ?? (existing ? local(existing.proposal.schedule.startsAt) : ''), 'startsAt');
  const duration = field(form, '만날 길이 (분, 선택)', 'number', draft?.values.durationMinutes ?? (existing ? String((Date.parse(existing.proposal.schedule.endsAt) - Date.parse(existing.proposal.schedule.startsAt)) / 60000) : copied ? String(copied.durationMinutes) : hint ? String(hint.durationMinutes) : ''), 'durationMinutes'); duration.min = '1'; duration.step = '1';
  const end = field(form, '끝나는 날짜와 시간', 'datetime-local', draft?.values.endsAt ?? (existing ? local(existing.proposal.schedule.endsAt) : ''), 'endsAt');
  let endEdited = draft ? draft.endEdited : !!existing;
  const setEndEdited = value => { endEdited = value; form.dataset.scheduleEndEdited = String(value); };
  setEndEdited(endEdited);
  end.addEventListener('input', () => setEndEdited(true));
  form.addEventListener('restore-schedule-end-mode', event => setEndEdited(event.detail === true));
  const validDuration = () => duration.value !== '' && duration.validity.valid && Number.isSafeInteger(Number(duration.value)) && Number(duration.value) > 0;
  const fillEnd = () => { const endAt = new Date(new Date(start.value).getTime() + Number(duration.value) * 60000); end.value = start.value && validDuration() && Number.isFinite(endAt.getTime()) ? local(endAt) : ''; };
  start.addEventListener('input', () => { if (!endEdited) fillEnd(); });
  duration.addEventListener('input', () => { if (validDuration()) { setEndEdited(false); fillEnd(); } else if (!endEdited) end.value = ''; });
  if (draft) form.append(para('작성하던 입력을 이어서 보여드려요. 아직 상대에게 보내지 않았어요.', 'summary'));
  else if (copied) form.append(para(`직접 고른 이전 장소와 ${copied.durationMinutes}분만 가져왔어요. 새 날짜·시간과 전할 말은 따로 정해 주세요. 아직 상대에게 보내지 않았고 모두 고칠 수 있어요.`, 'summary'));
  else if (hint) form.append(para(`내가 적용한 ${hint.durationMinutes}분을 넣었어요. 시작 시각을 정하면 끝나는 시각을 계산해요. 아직 상대에게 보내지 않았고 직접 고칠 수 있어요.`, 'summary'));
  else form.append(para('길이를 고르면 끝나는 시각을 계산해요. 끝나는 시각을 직접 입력해도 돼요.', 'hint'));
  form.append(para(`입력 시간대: ${zone}. 상대에게도 시간대를 함께 보여요.`, 'hint'));
  form.append(para('응답은 제안 후 72시간과 약속 시작 중 빠른 시점까지예요. 제안을 보낸 뒤에도 두 사람 모두 이 일정에 수락해야 확정돼요.', 'hint'));
  const place = field(form, '만날 장소', 'text', draft?.values.place ?? (existing?.proposal?.schedule?.place || copied?.place || ''), 'place'); place.maxLength = 160;
  const note = field(form, '상대에게 전할 말 (선택)', 'textarea', draft?.values.note ?? (existing?.proposal?.schedule?.note || ''), 'note'); note.maxLength = 280;
  // Server time avoids rejecting a future proposal just because the device clock is ahead.
  // Elapsed time also catches a start that passes while this form stays open; the server remains authoritative.
  const openedAt = performance.now(), serverAt = Date.parse(view.asOf);
  const inputs = [start, duration, end, place], touched = new Set(), errors = new Map();
  let attempted = false;
  for (const input of inputs) {
    const error = para('', 'hint danger'); error.id = `${input.id}-error`; error.hidden = true;
    error.dataset.scheduleError = input.name; input.setAttribute('aria-describedby', error.id);
    input.after(error); errors.set(input, error);
  }
  const validate = (focus = false) => {
    const startsAt = Date.parse(start.value), endsAt = Date.parse(end.value);
    const now = Math.max(Date.parse(view?.asOf) || serverAt, serverAt + Math.max(0, performance.now() - openedAt));
    const messages = new Map([
      [start, !start.value || !Number.isFinite(startsAt) || !start.validity.valid ? '시작 날짜와 시간을 입력해 주세요.' : startsAt <= now ? '시작 시간은 현재 이후로 정해 주세요.' : ''],
      [duration, duration.validity.badInput || duration.value !== '' && !validDuration() ? '만날 길이는 1분 이상의 정수로 입력하거나 비워 주세요.' : ''],
      [end, !end.value || !Number.isFinite(endsAt) || !end.validity.valid ? '끝나는 날짜와 시간을 입력해 주세요.' : Number.isFinite(startsAt) && endsAt <= startsAt ? '끝나는 시간을 시작 이후로 정해 주세요.' : ''],
      [place, !place.value.trim() ? '만날 장소를 입력해 주세요.' : '']
    ]);
    for (const input of inputs) {
      const message = attempted || touched.has(input) ? messages.get(input) : '', error = errors.get(input);
      error.textContent = message; error.hidden = !message;
      if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    const first = inputs.find(input => messages.get(input));
    if (focus && first) first.focus();
    return !first;
  };
  form.addEventListener('focusout', event => {
    if (!errors.has(event.target)) return;
    touched.add(event.target);
    // Revealing an error on pointer-down can move the send button before pointer-up.
    // Its click validates the whole form and focuses the error in one step instead.
    if (event.relatedTarget?.dataset.action !== 'propose' || !form.contains(event.relatedTarget)) validate();
  });
  form.addEventListener('input', () => validate());
  const remember = () => {
    const currentPair = view?.pairs?.find(item => item.pairId === pair.pairId);
    if (!form.isConnected || !draftKey || scheduleDraftKey(currentPair, formKey) !== draftKey) return;
    scheduleDrafts.set(slot, { key: draftKey, pairId: pair.pairId, formKey, endEdited, open: form.closest('details')?.open ?? true,
      values: { startsAt: start.value, durationMinutes: duration.value, endsAt: end.value, place: place.value, note: note.value } });
  };
  form.addEventListener('input', remember); form.addEventListener('change', remember);
  form.append(button(existing ? '변경한 일정 제안하기' : '이 일정 제안하기', () => {
    attempted = true;
    if (!validate(true)) return;
    void appointment(pair, { kind: existing ? 'revise' : 'propose', ...(existing ? { appointmentId: existing.id } : {}), schedule: { startsAt: new Date(start.value).toISOString(), endsAt: new Date(end.value).toISOString(), timeZone: zone, place: place.value.trim(), note: note.value.trim() } }, '일정을 제안했어요. 두 사람이 확인한 뒤 확정돼요.', () => { scheduleDrafts.delete(slot); rescheduleDrafts.delete(pair.pairId); });
  }, 'propose', true)); return form;
}
function inbox(area) {
  const head = append(el('div', null, 'tab-head'), heading('초대·약속', '서로 확인한 약속만 남겨요.'), button('새로고침', () => run(() => load()), 'refresh')); area.append(head);
  area.append(para('작성 중 새 응답은 알림으로 알려드려요. 공개·연결 상태가 바뀌면 필요한 내용을 바로 갱신해요.', 'hint'));
  if (view.archivedReflections?.length) {
    const own = details('종료된 연결의 내 회고');
    for (const r of view.archivedReflections) own.append(para(`${new Date(r.at).toLocaleDateString('ko-KR')} · ${({ good: '지금 방식이 편했어요', 'too-long': '조금 짧았으면 좋겠어요', 'change-activity': '다른 활동을 해 보고 싶어요' })[r.value]}${r.note ? ` · ${r.note}` : ''}`));
    area.append(own);
  }
  if (!pairs().length) { area.append(para('아직 준비 중인 약속이 없어요. 오늘의 추천에서 소개할 계정을 확인해 주세요.', 'empty')); return; }
  for (const pair of [...pairs()].sort((a, b) => Number(b.pairId === focusedPair) - Number(a.pairId === focusedPair))) {
    if (pair.status === 'closed' || pair.view === null) { const closed = append(el('section', null, 'card'), el('h2', '종료된 연결'), para('공개·초대 설정이나 차단·계정 상태가 바뀌어 이 연결을 닫았어요. 이전 약속 수락은 다시 사용하지 않아요.', 'hint'), pair.introduction?.canReopen && introductionPanel(pair)); closed.dataset.pair = pair.pairId; area.append(closed); continue; }
    const v = pairView(pair), section = el('section', null, 'card');
    section.dataset.pair = pair.pairId || v.pairId;
    append(section, el('h2', (v.people || []).map(p => p.label).join(' · ') || '함께 준비하는 약속'));
    const partner = v.people?.find(p => p.id !== view.accountId);
    if (demo && partner?.id?.startsWith('demo:')) section.append(demoRoleLink(partner.id.slice(5), `${partner.label} 역할에서 직접 응답하기`));
    append(section, introductionPanel(pair), meetingAlignment(pair));
    if (pair.paused) section.append(para('지금은 새 만남 준비를 쉬고 있어요. 기존 약속을 확인하거나 취소하고, 마친 만남의 내 회고를 남길 수 있어요.', 'summary'));
    const unread = (v.inbox || []).filter(n => !n.read), news = details(`새 소식 ${unread.length}개 확인하기`);
    for (const n of unread) { const row = el('div', null, 'summary'); append(row, el('strong', n.title), para(n.text), button('확인했어요', () => appointment(pair, { kind: 'read', notificationId: n.id }), 'read')); news.append(row); }
    if (unread.length) section.append(news);
    const prefs = el('div', null, 'form'); const enabled = check(prefs, '이 대화의 새 응답을 앱 안에서 알려 주세요.', v.me?.notificationsEnabled !== false, 'notifications'); enabled.addEventListener('change', () => appointment(pair, { kind: 'notifications', enabled: enabled.checked })); section.append(prefs);
    for (const a of v.appointments || []) {
      const card = el('article', null, 'card'), schedule = a.proposal.schedule;
      const fmt = t => new Intl.DateTimeFormat('ko-KR', { timeZone: schedule.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));
      append(card, para(({ pending: '서로 확인 중', confirmed: '함께 수락한 약속', agreed: '함께 수락한 약속', cancelled: '취소한 약속', expired: '응답 기한이 지난 약속', busy: '일정이 맞지 않아 다른 시간을 정해요', declined: '이번에는 만나지 않기로 했어요', completed: '만남을 마쳤어요', 'awaiting-completion': '만남 완료 확인을 기다려요', 'partially-completed': '한 사람이 완료를 확인했어요' })[a.status] || '약속 상태를 확인하고 있어요', 'pill'), para(`${fmt(schedule.startsAt)} — ${fmt(schedule.endsAt)}`, 'calendar-date'), para(`${schedule.place} · ${schedule.timeZone}`), schedule.note && para(schedule.note), proposalChanges(a));
      append(card, para(`응답 기한: ${fmt(a.proposal.expiresAt)}`, 'hint'));
      if (a.status === 'declined' && a.proposal.declineMeaning === 'legacy-schedule') card.querySelector('.pill').textContent = '이전 일정에 거절한 기록이에요';
      for (const p of a.people) card.append(para(`${p.label}: ${p.response === 'decline' && a.proposal.declineMeaning === 'legacy-schedule' ? '이전 일정 거절' : { unanswered: '응답 기다리는 중', accept: '수락', busy: '시간이 맞지 않아요', decline: '이 만남은 원하지 않아요' }[p.response] || p.response}`, 'hint'));
      const actions = el('div', null, 'actions');
      if (a.canRespond) actions.append(button('이 약속 수락', () => appointment(pair, { kind: 'respond', appointmentId: a.id, proposalVersion: a.proposal.version, value: 'accept' }), 'accept', true), button('시간만 안 맞아요 · 다른 시간 준비', () => appointment(pair, { kind: 'respond', appointmentId: a.id, proposalVersion: a.proposal.version, value: 'busy' }, '이 일정은 닫았어요. 아래에서 편한 시간을 새로 제안할 수 있어요.', () => openForms.add(pair.pairId)), 'busy'), button('이 만남은 원하지 않아요', () => appointment(pair, { kind: 'respond', appointmentId: a.id, proposalVersion: a.proposal.version, value: 'decline' }, '이 만남을 거절했어요. 직접 다시 열기 전에는 이 상대의 새 요청을 받지 않아요.'), 'decline'));
      if (getRescheduleDraft(pair, a.id)) actions.append(button('장소·길이는 유지하고 다른 시간 제안', () => {
        const latest = view.pairs?.find(item => item.pairId === pair.pairId), draft = latest && getRescheduleDraft(latest, a.id);
        if (!draft) { notice('그동안 약속 상태가 바뀌었어요. 최신 일정을 다시 확인해 주세요.'); return; }
        const key = scheduleDraftKey(latest, 'new');
        scheduleDrafts.delete(scheduleSlot(pair.pairId, 'new'));
        if (key) rescheduleDrafts.set(pair.pairId, { ...draft, key }); else rescheduleDrafts.delete(pair.pairId);
        openForms.add(pair.pairId); render();
        const target = [...document.querySelectorAll('[data-pair]')].find(item => item.dataset.pair === pair.pairId)?.querySelector('[data-new-schedule]');
        if (!key && target) {
          for (const [name, value] of Object.entries({ startsAt: '', endsAt: '', durationMinutes: String(draft.durationMinutes), place: draft.place, note: '' })) {
            const input = target.querySelector(`[name=${name}]`); if (input) input.value = value;
          }
          target.querySelector('[data-schedule-form]')?.dispatchEvent(new CustomEvent('restore-schedule-end-mode', { detail: false }));
        }
        target?.querySelector('[name=startsAt]')?.focus();
        notice('이전 장소와 길이만 새 초안에 넣었어요. 날짜·시간을 직접 정한 뒤 보내 주세요.');
      }, 'reschedule-reuse'));
      if (a.canCancel) actions.append(button('약속 취소', () => appointment(pair, { kind: 'cancel', appointmentId: a.id }), 'cancel'));
      if (a.canComplete) actions.append(button('만남을 마쳤어요', () => appointment(pair, { kind: 'complete', appointmentId: a.id }), 'complete', true));
      card.append(actions);
      if (a.canRevise) { const revise = details('시간·장소 변경 제안'); append(revise, para('변경하면 두 사람 모두 새 일정에 다시 수락해야 해요.', 'hint'), scheduleForm(pair, a)); card.append(revise); }
      append(card, meetingReflection(pair, a)); section.append(card);
    }
    append(section, reflectionSuggestions(pair));
    if (v.canPropose) { const propose = details('새 약속 제안하기'); propose.dataset.newSchedule = 'true'; propose.open = !v.appointments?.length || openForms.has(pair.pairId) || !!v.me?.nextForm; propose.append(scheduleForm(pair)); section.append(propose); }
    if (v.me?.reflections?.length) { const reflections = details('저장한 내 회고'); for (const r of v.me.reflections) reflections.append(para(`${({ good: '지금 방식이 편했어요', 'too-long': '조금 짧았으면 좋겠어요', 'change-activity': '다른 활동을 해 보고 싶어요' })[r.value]}${r.note ? ` · ${r.note}` : ''}`)); section.append(reflections); }
    area.append(section);
  }
}
function settings(area) {
  area.append(heading('내 설정', '내가 공개할 만큼만, 내 속도로.'));
  const verification=view.adult?.verification;
  if(verification?.required&&verification.status==='verified') {
    const status=para(`성인 확인 결과를 확인했어요.${verification.validUntil ? ` 유효기간: ${new Date(verification.validUntil).toLocaleString('ko-KR')}` : ''}`,'hint');status.dataset.adultVerified='true';area.append(status);
  } else if(!verification?.required) area.append(para('현재 성인 여부는 본인 선언으로만 확인해요. 별도의 성인 인증이 완료된 상태는 아니에요.','hint'));
  append(area, experienceSettings(), experienceHistory());
  const reload = button('최신 기록 불러오기', () => run(() => load(), '계정의 최신 기록을 불러왔어요.'), 'reload'); area.append(reload);
  if (view.operator) operator(area);
  const form = el('div', null, 'form'), visibility = check(form, '내 이름·지역·소개 공개', view.consents?.profilePublic === true, 'public'), invites = check(form, '소개 초대 받기', view.consents?.receiveInvitations === true, 'invites'), save = check(form, '맞춤 답변·보관한 후보 계정 저장', view.consents?.storePreferences === true, 'save');
  append(form, para('저장을 끄면 추천 답변과 후보 보관함이 함께 삭제돼요. 공개를 끄거나 초대를 쉬면 진행 중인 연결도 다시 확인해요.', 'hint'), button('공개·저장 범위 적용', () => act({ kind: 'consents', consents: { profilePublic: visibility.checked, receiveInvitations: invites.checked, storePreferences: save.checked } }), 'consents'));
  area.append(form, button(view.paused ? '만남 다시 시작하기' : '모든 추천과 초대 쉬기', () => act({ kind: 'pause', paused: !view.paused }), 'pause'));
  area.append(para('쉬는 동안 새 소개와 일정 제안은 멈춰요. 이미 정한 약속은 초대·약속에서 확인하고 취소하거나 회고를 남길 수 있어요.', 'hint'));
  const profile = details('내 소개 수정'); const p = el('div', null, 'form'); const name = field(p, '사용할 이름', 'text', view.profile?.nickname || '', 'nickname'), region = field(p, '만나기 편한 지역', 'text', view.profile?.region || '', 'region'), intro = field(p, '짧은 소개', 'textarea', view.profile?.intro || '', 'intro'); name.maxLength = 30; region.maxLength = 80; intro.maxLength = 300;
  p.append(button('소개 저장', () => saveProfileEditing({ kind: 'profile', profile: { ...view.profile, nickname: name.value.trim(), region: region.value.trim(), intro: intro.value.trim() } },['profile'],'소개를 저장했어요. 다른 항목의 작성 내용은 따로 저장해 주세요.'), 'save-profile')); profile.dataset.profileEditor='true';bindProfileEditing(p,'profile');profile.append(p); area.append(profile);
  if(view.status==='active'&&view.profile?.nickname)append(area,publicProfilePreview(),disclosure());
  append(area,savedCandidatesSection({showEmpty:true}));
  const safety = details('차단·신고와 처리 상황'), sf = el('div', null, 'form');
  const targets = new Map(); for (const c of view.candidates || []) targets.set(c.accountId || c.id, c.profile?.nickname || c.nickname || c.label); for (const pair of pairs()) for (const p of pairView(pair).people || []) if (p.id !== view.accountId) targets.set(p.id, p.label);
  if (targets.size) { const target = select(sf, '상대', [...targets], 'target'), reason = select(sf, '신고 이유', [['safety', '안전이 걱정돼요'], ['harassment', '괴롭힘·원치 않는 연락'], ['impersonation', '다른 사람을 사칭해요'], ['other', '다른 이유']], 'reason'); const text = field(sf, '운영자에게만 전할 내용', 'textarea', '', 'report'); text.maxLength = 1000; sf.append(button('이 계정 차단', () => act({ kind: 'block', targetAccountId: target.value }, '이 계정과의 새로운 연결을 전체에서 막았어요.'), 'block'), button('신고 접수', () => act({ kind: 'report', targetAccountId: target.value, reason: reason.value, details: text.value.trim() }, '신고를 접수했어요. 아래에서 처리 상황을 볼 수 있어요.'), 'report')); }
  else sf.append(para('소개하거나 대화한 상대가 있으면 여기서 선택할 수 있어요.', 'hint'));
  for (const block of view.blocks || []) { const id = typeof block === 'string' ? block : block.targetAccountId; sf.append(para(`차단한 계정: ${id}`, 'small'), button('차단 해제', () => act({ kind: 'unblock', targetAccountId: id }, '차단을 해제했어요. 이전 약속 수락은 복원하지 않아요.'), 'unblock')); }
  for (const report of view.reports || []) sf.append(para(`신고 ${report.id} · ${{ open: '접수됨', pending: '접수됨', reviewing: '확인 중', resolved: '처리 완료', dismissed: '검토 종료' }[report.status] || report.status}`, 'report-state'));
  safety.append(sf); area.append(safety);
  const erase = details('소개팅 기록 삭제'), ef = el('div', null, 'form'); append(ef, para('프로필·개인 답변·약속 기록을 삭제하고 기존 기기의 저장을 막아요. SYNK ID 자체의 탈퇴와는 별개예요.', 'hint')); const confirm = field(ef, '계속하려면 “삭제”를 입력해 주세요.', 'text', '', 'delete-confirm'); ef.append(button('소개팅 기록 삭제', () => { if (confirm.value !== '삭제') { notice('삭제를 입력한 뒤 눌러 주세요.'); return; } void act({ kind: 'delete' }, '소개팅 기록을 삭제했어요.'); }, 'delete')); erase.append(ef); area.append(erase);
  if (!demo) area.append(button('이 화면에서 로그아웃', () => run(async () => {
    generation++; view = null; clearPrivateDrafts(); notice(''); syncState={status:'checking',lastCheckedAt:null};
    const signingOut = client.signOut();
    // Local credentials and private DOM must disappear before waiting on remote logout.
    render(); $('content').focus({preventScroll:true});
    await signingOut; render();
  }), 'signout'));
}
function operator(area) {
  const section = el('section', null, 'card'); section.append(el('h2', '운영자 신고 처리'));
  const reports = view.reports || [];
  for (const report of reports) {
    const row = el('div', null, 'form'); append(row, el('h3', `신고 ${report.id}`), para(report.details || ''), para(`현재 상태: ${report.status}`, 'hint'));
    const status = select(row, '처리 상태', [['reviewing', '확인 중'], ['resolved', '처리 완료'], ['dismissed', '검토 종료']], 'status'), decision = select(row, '조치', [['none', '계정 상태 유지'], ['suspend-target', '상대 계정 이용 정지'], ['restore-target', '상대 계정 정지 해제']], 'decision'), note = field(row, '운영 기록', 'textarea', '', 'operator-note');
    row.append(button('처리 저장', () => act({ kind: 'admin-report', reportId: report.id, status: status.value, decision: decision.value, note: note.value.trim() }), 'admin-report')); section.append(row);
  }
  if (!reports.length) section.append(para('접수된 신고가 없어요.')); area.append(section);
}
async function boot() {
  try { await client.start(); const role = new URL(location.href).searchParams.get('demo');
    if (role && config.demoEnabled && (config.demoRoles || ['adult-a', 'adult-b', 'sample-1', 'sample-2', 'sample-3', 'operator']).some(entry => (typeof entry === 'string' ? entry : entry.role) === role)) { demo = true; await client.demo(role); await load(); if (role === 'operator') page = 'settings'; }
    else if (config.signedIn) await load();
    if (view && view.status==='active' && !centralBlocked(view)) await delivery.restore({actorId:view.accountId,demo});
    render();
  } catch (error) { if (isAccountAccessLost(error)) { clearPrivateDrafts(); view=null; } render(); syncFailed(error); notice(error.message); }
  startPolling();
}
function startPolling() {
  clearInterval(timer); timer=null;
  if (disposed || pageSuspended) return;
  timer=setInterval(() => void pollLive(),12000);
  if (resumeRefresh) void pollLive();
}
async function pollLive() {
  const recovering=(resumeRefresh || syncState.status==='offline') && (config.signedIn || demo);
  if (!view && !recovering || busy || polling || document.hidden || disposed || pageSuspended) return;
  polling=true; resumeRefresh=false; const current=generation, actor=view?.accountId, lifecycle=pageEpoch;
  try {
    const next=await load({quiet:true});
    if (!next || current!==generation || actor!==view?.accountId || busy || disposed || pageSuspended || lifecycle!==pageEpoch) return;
    if (!actor) {
      if (next.status==='active' && !centralBlocked(next)) await delivery.restore({actorId:next.accountId,demo});
      if (current!==generation || disposed || pageSuspended || lifecycle!==pageEpoch) return;
      view=next; render(); return;
    }
    const change=getLiveChange(view,next);
    if (change.kind==='identity-lost') { clearPrivateDrafts(); view=next.accountId===actor ? next : null; render(); notice(change.message); return; }
    if (change.kind==='invalidate') { applyLiveView(next); notice(change.message); return; }
    if (change.kind==='unchanged') { view=next; if (queuedView) { queuedView=null; updatePanels(); } return; }
    if (dirty || pendingPreview || delivery.snapshot() || ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) { queuedView=next; updatePanels(); }
    else applyLiveView(next);
  } catch(error) {
    if (current!==generation || disposed) return;
    if (isAccountAccessLost(error)) { clearPrivateDrafts(); view=null; render(); syncFailed(error); return; }
    if (pageSuspended || lifecycle!==pageEpoch) return;
    syncFailed(error);
  } finally { polling=false; if(resumeRefresh)void pollLive(); }
}
window.addEventListener('pagehide', event => {
  pageSuspended=true; pageEpoch++; resumeRefresh=false; clearInterval(timer); timer=null;
  // A cached page keeps its client and unsent data in memory until it returns.
  if (!event.persisted) { disposed=true; client.dispose(); }
});
window.addEventListener('pageshow', event => {
  if (!event.persisted || disposed) return;
  pageSuspended=false; resumeRefresh=true;
  if (view) { syncState={...syncState,status:'checking'}; syncPanel(); }
  startPolling();
});
function hasUnsavedWork() { return !!delivery.snapshot() || dirty || !!onboardingDraft || profileEditingDrafts.size>0 || !!pendingPreview || [...scheduleDrafts.values()].some(draft=>Object.values(draft.values).some(Boolean)) || !!conditionalContactDraft; }
window.addEventListener('beforeunload', event=>{ if (hasUnsavedWork()) { event.preventDefault(); event.returnValue=''; } });
window.addEventListener('online',()=>{void pollLive();});
window.addEventListener('offline',()=>{if(view){syncFailed({});}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pollLive();});
function markLiveDirty(event) { dirty=true; let form=event.target.closest('form,.form'); while (form?.parentElement?.closest('form,.form')) form=form.parentElement.closest('form,.form'); if (form) form.dataset.liveDirty='true'; }
$('content').addEventListener('input', markLiveDirty);
$('content').addEventListener('change', markLiveDirty);
window.synkDating = { snapshot: () => structuredClone({ page, demo, view, hasPendingDelivery:!!delivery.snapshot(), pendingCheckOnly:delivery.snapshot()?.checkOnly===true, hasNewResponse:!!queuedView, sync:syncState }), reload: () => load(), refreshUpdates: () => pollLive() };
void boot();
