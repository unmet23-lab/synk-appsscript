export function createAdvance({ $, state, esc, statusNames, setMode, newSession, saveEvent }) {
const advancedHelp = s => s?.helpEvents.find(h => h.id === 'demo-advance-help');
const advancedLock = () => state.busy || state.recording || state.recorderStarting || state.pendingHelp || state.retry;
function syncAdvanceControls() {
  for(const id of ['create-time-example','create-plan-example']) $(id).disabled = Boolean(advancedLock() || !state.token);
  document.querySelectorAll('#advance-content button').forEach(b => b.disabled = Boolean(advancedLock() || state.session?.engineReadOnly || b.dataset.done === 'true'));
}
function renderAdvance(s) {
  const root=$('advance-content'), help=advancedHelp(s), plan=s.analysis.evidencePlan;
  root.hidden=!help;
  if(!help)return;
  const object=s.analysis.cells.find(c=>c.id==='e0:object'), stamp=v=>new Date(v).toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const refined=help.refinements.some(r=>r.before.timeBounds?.earliestAt!==r.after.timeBounds?.earliestAt);
  const done = refined ? 'data-done="true" disabled' : '';
  const steps=plan?.steps || [];
  const actions=plan?.selectedActionIds.map(id=>plan.actions.find(a=>a.id===id)) || [];
  root.innerHTML=`<div class="advance-story"><div><span class="action-kicker">현재 저장된 사실</span><h3>도움 시간 ${esc(stamp(help.timeBounds.earliestAt))}–${esc(stamp(help.timeBounds.latestAt))}</h3><p>처음 발화: ${esc(stamp(s.original.performanceInterval.startedAt))}<br>이 예제는 발생 가능 범위를 가정해 입력합니다. 장치 시계 오차를 자동 측정한 값은 아닙니다.</p><strong class="advance-status">처음 조사 수행: ${esc(statusNames[object.status])}</strong><p>${esc(object.reason)}</p><div class="advance-choices"><button id="refine-after" class="button quiet" ${done}>발화 후였다고 확인 · 예제</button><button id="refine-before" class="button quiet" ${done}>발화 전이었다고 확인 · 예제</button></div><p class="micro">서로 다른 확인 결과를 비교하려면 새 예제로 다시 시작하세요.</p></div><div><span class="action-kicker">현재 필요한 확인</span><h3>${object.blockers.length}개 보류·제외 조건</h3><ul>${object.blockers.map(b=>`<li>${esc(b.reason)}</li>`).join('') || '<li>이 사용처에 남은 보류 조건이 없습니다.</li>'}</ul><button id="demo-confirm-record" class="button quiet" ${s.original.humanConfirmed&&s.task.roleConfirmed?'data-done="true" disabled':''}>전사·문항 기록 확인 · 예제</button><p class="micro">확인한 기록의 유리한 결과를 입력하는 합성 시연입니다. 실제 사용에서는 원음과 문항을 직접 확인해야 합니다.</p></div></div>
  <div class="advance-plan"><div><span class="action-kicker">조건부 확인 계획</span><h3>${actions.length ? actions.map(a=>esc(a.title)).join(' → ') : '선택할 확인이 없습니다.'}</h3><p>가정 비용 ${plan?.score.costUnits ?? 0}단위 · 탐색한 조합 ${plan?.exploredStates ?? 0}개${plan?.truncationReason?' · 탐색 한도 도달':''}</p></div><p>모든 보류를 해소하는 결과가 나온다는 가정 아래 고른 순서입니다. 실제 확인을 하나 실행한 뒤 다시 계획합니다. 반대 근거가 나오면 제외될 수 있습니다.</p><details><summary>검토에서 빠진 행동과 계산 범위</summary><p>${esc(plan?.scope)}</p><ul>${(plan?.rejectedActions||[]).map(a=>`<li>${esc(a.actionId||a.id)} · ${esc(a.reason||a.reasonCode)}</li>`).join('')}</ul><p>답을 보여주고 받은 새 응답은 처음 수행의 자격을 대신하지 않습니다. 비용은 실측 시간이 아닌 비교용 단위입니다.</p></details></div>`;
  $('refine-after').addEventListener('click',()=>refineAdvanced('after'));
  $('refine-before').addEventListener('click',()=>refineAdvanced('before'));
  $('demo-confirm-record').addEventListener('click',confirmAdvancedRecord);
  syncAdvanceControls();
}
async function newAdvancedExample(multiple) {
  if(advancedLock())return;
  setMode('example');
  if(!await newSession('example',{exampleId:'unknown-coverage'}))return;
  if(!await saveEvent({type:'unknown-set',enabled:false}))return;
  if(multiple){
    if(!await saveEvent({type:'review-original',text:'친구를 만나서 카페에 갔어요',confirmed:false}))return;
    if(!await saveEvent({type:'task-confirmed',roleConfirmed:false}))return;
  }
  const t=Date.parse(state.session.original.performanceInterval.startedAt), iso=n=>new Date(t+n).toISOString();
  await saveEvent({id:'demo-advance-help',type:'help-presented',text:'친구를',skills:['object'],
    timeBounds:{earliestAt:iso(-60000),latestAt:iso(60000),basis:'declared-bound',sourceRef:'synthetic-meeting-fixture'}},
    {message:'시간 범위를 가진 합성 도움 사건을 저장했습니다. 버튼으로 확인 결과를 바꾸어 보세요.'});
}
async function refineAdvanced(direction) {
  if(advancedLock()||!advancedHelp(state.session)||advancedHelp(state.session).refinements.length)return;
  const t=Date.parse(state.session.original.performanceInterval.startedAt), iso=n=>new Date(t+n).toISOString();
  await saveEvent({type:'help-refined',helpId:'demo-advance-help',sourceRef:`synthetic-${direction}-record`,
    timeBounds:{earliestAt:iso(direction==='after'?20000:-40000),latestAt:iso(direction==='after'?40000:-20000),basis:'declared-bound',sourceRef:`synthetic-${direction}-record`}},
    {message:'확인 결과를 실제 사건으로 저장하고 관련 판정을 다시 계산했습니다.',onSuccess:()=>{$('effect-ledger-details').open=true;}});
}
async function confirmAdvancedRecord() {
  if(advancedLock()||!advancedHelp(state.session))return;
  if(!state.session.original.humanConfirmed && !await saveEvent({type:'review-original',text:'친구를 만나서 카페에 갔어요',confirmed:true}))return;
  if(!state.session.task.roleConfirmed)await saveEvent({type:'task-confirmed',roleConfirmed:true});
}
$('create-time-example').addEventListener('click',()=>newAdvancedExample(false));
$('create-plan-example').addEventListener('click',()=>newAdvancedExample(true));
syncAdvanceControls();
return { render: renderAdvance, sync: syncAdvanceControls };
}
