import {productManifest,recoverProductUpgrade,validateRecoveredWork,workLabel} from './storage-upgrade.mjs';
export const STORAGE_KEY = 'synk.shift.workbench.v1';
export const SCOPE = Object.freeze({personId:'local-learner',productId:'shift',contextId:'workbench',domain:'SHIFT'});
export const TASKS = Object.freeze({
  meeting:{name:'회의를 실행으로',subtitle:'결정·담당·기한을 정확히 옮기기',purpose:'팀에 공유할 실행 목록',sources:[
    {id:'M1',text:'10월 2일 가상 회의: 온보딩 안내 초안은 지안이 10월 8일까지 작성한다.'},
    {id:'M2',text:'다국어 안내의 예상 비용은 80만 원이다. 예산 승인은 아직 받지 못했다.'},
    {id:'M3',text:'도윤은 10월 6일까지 접근성 검토 항목을 전달한다. 공개 일정은 검토 뒤 정한다.'}],
    sample:'온보딩 실행 목록\n1. 지안: 10월 5일까지 안내 초안 작성\n2. 다국어 안내 예산 80만 원 승인 완료\n3. 도윤: 접근성 검토 항목 전달',
    checks:[{id:'deadline',label:'안내 초안의 기한은 10월 5일이다.',answer:'wrong',source:'M1',why:'M1의 기한은 10월 8일입니다. 숫자 하나도 원문과 대조해야 합니다.',focus:'numbers'},
      {id:'approval',label:'80만 원 예산은 승인됐다.',answer:'unsupported',source:'M2',why:'M2는 아직 승인받지 못했다고 밝힙니다. 예상 비용과 승인은 다릅니다.',focus:'evidence'},
      {id:'missing',label:'도윤의 항목에는 기한이 빠져 있다.',answer:'missing',source:'M3',why:'M3의 10월 6일 기한을 실행 목록에도 넣어야 합니다.',focus:'completeness'}],
    template:'회의 자료 M1~M3만 사용해 팀 공유용 실행 목록을 작성해 주세요. 담당·할 일·기한을 표로 쓰고, 승인 대기 사항은 확정과 구분해 주세요. 자료에 없는 일정은 추측하지 마세요.'},
  research:{name:'자료를 믿기 전에',subtitle:'숫자·표본·주장을 함께 확인하기',purpose:'의사결정에 쓸 짧은 자료 요약',sources:[
    {id:'R1',text:'가상 사내 설문: 응답자 20명 중 12명이 새 안내서가 편리하다고 답했다.'},
    {id:'R2',text:'설문 대상은 시범 운영팀 한 곳이다. 전체 직원이나 고객을 대표하는 표본은 아니다.'},
    {id:'R3',text:'처리 시간과 비용은 측정하지 않았다. 다음 달 동일 업무의 처리 시간을 비교할 예정이다.'}],
    sample:'시범 결과 요약\n1. 응답자의 80%가 안내서에 만족했다.\n2. 전 직원이 새 안내서를 선호한다.\n3. 처리 시간 30% 단축 효과를 확인했다.',
    checks:[{id:'ratio',label:'12명 / 20명은 80%이다.',answer:'wrong',source:'R1',why:'12 ÷ 20 × 100 = 60%입니다. 요약문의 비율을 다시 계산해야 합니다.',focus:'numbers'},
      {id:'scope',label:'전 직원이 선호한다고 말할 수 있다.',answer:'unsupported',source:'R2',why:'시범팀 20명의 응답을 전 직원으로 확대할 근거가 없습니다.',focus:'evidence'},
      {id:'effect',label:'처리 시간이 30% 줄었다.',answer:'unsupported',source:'R3',why:'R3는 아직 시간을 측정하지 않았다고 명시합니다. 효과는 확인 전입니다.',focus:'evidence'}],
    template:'자료 R1~R3만 근거로 의사결정용 요약을 3줄로 작성해 주세요. 응답 수와 비율을 함께 쓰고, 조사 대상의 한계와 아직 측정하지 않은 효과를 구분해 주세요. 자료 밖 효과는 만들지 마세요.'},
  planning:{name:'기획을 검증하기',subtitle:'목표·제약·성공 기준을 맞추기',purpose:'검토 가능한 작은 실행안',sources:[
    {id:'P1',text:'가상 프로젝트: 신규 구성원 8명을 위한 2주 온보딩 시범 프로그램을 기획한다.'},
    {id:'P2',text:'가용 예산은 최대 40만 원이다. 외부 유료 도구 도입은 이번 시범 범위에 없다.'},
    {id:'P3',text:'성공 기준: 참여자 8명 중 6명 이상이 도움 없이 첫 업무를 완료한다. 결과는 2주 뒤 확인한다.'}],
    sample:'온보딩 기획 초안\n1. 신규 구성원 8명으로 2주간 운영한다.\n2. 유료 도구를 60만 원에 도입한다.\n3. 참여자 만족도를 확인하고 종료한다.',
    checks:[{id:'audience',label:'대상 8명·기간 2주는 자료와 일치한다.',answer:'match',source:'P1',why:'P1의 대상과 기간이 정확히 반영됐습니다. 맞는 내용도 근거를 확인합니다.',focus:'evidence'},
      {id:'budget',label:'유료 도구 60만 원 도입은 조건을 만족한다.',answer:'wrong',source:'P2',why:'40만 원 한도를 넘고, 유료 도구 도입도 범위 밖입니다.',focus:'numbers'},
      {id:'criteria',label:'초안에 실제 업무 완료 기준이 빠져 있다.',answer:'missing',source:'P3',why:'만족도만으로 P3의 성공 기준을 대신할 수 없습니다. 6명 이상의 독립 수행을 확인해야 합니다.',focus:'completeness'}],
    template:'P1~P3의 제약 안에서 2주 시범 운영안을 작성해 주세요. 대상·일정·예산·확인 방법을 포함하고, 40만 원 이내에서 외부 유료 도구 없이 구성해 주세요. 성공 기준은 실제 첫 업무 완료로 유지해 주세요.'}
});
export const ANSWERS = {match:'자료와 일치',wrong:'사실·조건이 다름',unsupported:'확정할 근거가 없음',missing:'필요한 내용이 누락됨'};
export const FOCUS = {numbers:'숫자·기한 대조',evidence:'주장과 근거 구분',completeness:'누락·성공 기준 확인'};
// These observations concern fixed checks in fictional exercises, never ability,
// personality or the accuracy of a person's freely written work.
export const PRACTICE_CONTRACT = Object.freeze({
  id:'shift-practice-review',version:'1',purpose:'fictional-check-review',
  fields:Object.keys(FOCUS).map(id=>({id,kind:'enum',values:['correct','incorrect'],maxAgeDays:30,minIndependent:1,minAgreement:0.67})),
  criteria:Object.keys(FOCUS).map(id=>({id:`${id}-practice`,field:id,feature:id,weight:1,required:false,prefer:'match'}))
});
export const GOALS = {clarity:'핵심을 3줄 이내로 정리하기',work:'담당·할 일·확인 사항을 포함한 실행 초안 만들기',prepare:'초안과 함께 실제 사용 전 확인할 항목 적기'};
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => new Date().toISOString();
export function newState(){return {version:1,save:false,manifest:{...PRODUCT_MANIFEST},settings:{task:'meeting',goal:'clarity',minutes:5,support:'step'},profile:null,events:[],run:null,history:[],visits:[],retention:{version:'attempts-20-1',from:null,resetReason:null},evaluation:{decisions:[],exposures:[],outcomes:[]}};}
const evaluationScope=(state,scope)=>({domain:scope.domain,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`,purpose:PRACTICE_CONTRACT.purpose});
export const PRACTICE_POLICIES=Object.freeze([{id:'fixed-check-order',version:'1'},{id:'evidence-check-order',version:'2'}]);
export const PRODUCT_MANIFEST=Object.freeze(productManifest(TASKS,{reviewVersion:PRACTICE_CONTRACT.version,outcomeVersion:'1',orderVersion:PRACTICE_POLICIES[1].version}));
const LEGACY_POLICIES=[PRACTICE_POLICIES[0],{id:'evidence-check-order',version:'1'}];
const knownPolicy=policy=>[...PRACTICE_POLICIES,...LEGACY_POLICIES].some(p=>p.id===policy?.id&&p.version===policy?.version);
function evaluationForPolicies(evaluation,policies){
  const decisions=evaluation.decisions.filter(d=>policies.some(p=>p.id===d.policy.id&&p.version===d.policy.version)),ids=new Set(decisions.map(d=>d.id));
  const exposures=evaluation.exposures.filter(e=>ids.has(e.decisionId)),seen=new Set(exposures.map(e=>e.id));
  return {decisions,exposures,outcomes:evaluation.outcomes.filter(o=>seen.has(o.exposureId))};
}
// The policy selects the first check in a practice. Its downstream outcome is the
// fraction of all presented checks matched on their initial review, before hints.
export function outcomeContract(state,scope=SCOPE){return {id:'shift-first-check-result',version:'1',scope:evaluationScope(state,scope),outcome:{id:'initial-review-match-ratio',kind:'numeric',range:[0,1],direction:'higher',windowMs:86400000}};}
const savedWork=row=>['saved-work','recovered-work'].includes(row?.kind);
export const isSavedWork=savedWork;
export const historyLabel=row=>workLabel(row,TASKS);
function keepHistory(rows){const keep=new Set([...rows.filter(savedWork).slice(-21),...rows.filter(row=>!savedWork(row)).slice(-20)]);return rows.filter(row=>keep.has(row));}
const emptyEvaluation=()=>({decisions:[],exposures:[],outcomes:[]});
function generationOf(owner,profile,scope,purpose=false){
  const prefix=`p.${scope.productId}:c.${scope.contextId}:g.`,suffix=owner?.workspace?.slice(prefix.length);
  if(!owner||owner.domain!==scope.domain||(purpose?owner.purpose!==PRACTICE_CONTRACT.purpose:owner.subject!==scope.personId)
    ||!owner.workspace?.startsWith(prefix)||!/^(0|[1-9]\d*)$/.test(suffix)||!Number.isSafeInteger(Number(suffix))||Number(suffix)>profile.generation)throw new Error(purpose?'Temper outcomes: record outside authorized subject, workspace or purpose':'다른 실습 또는 이후 개인화 세대의 기록이에요.');
  return Number(suffix);
}
function checkSavedWork(row,profile,scope){
  if(row?.kind==='recovered-work')return validateRecoveredWork(row,profile,scope,now());
  const keys=['kind','scope','sourceGeneration','task','at','prompt','draft','status'];
  if(!row||Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k))||!savedWork(row)
    ||!row.scope||Object.keys(row.scope).length!==4||Object.keys(scope).some(k=>row.scope[k]!==scope[k])
    ||!Number.isSafeInteger(row.sourceGeneration)||row.sourceGeneration<0||row.sourceGeneration>=profile.generation
    ||!Object.hasOwn(TASKS,row.task)||!['completed','in-progress'].includes(row.status)
    ||!Number.isFinite(Date.parse(row.at))||Date.parse(row.at)>Date.parse(profile.updatedAt)
    ||typeof row.prompt!=='string'||row.prompt.length>5000||typeof row.draft!=='string'||row.draft.length>10000)brokenHistory();
}
function checkRecordOwners(state,scope,at){
  const profile=state.profile;
  if(!profile||Object.keys(scope).some(k=>profile.scope?.[k]!==scope[k]))throw new Error('다른 실습의 기록이에요.');
  const cutoff=Date.parse(at),evaluation=state.evaluation||emptyEvaluation();
  if(!Number.isFinite(cutoff)||!Array.isArray(state.events)||!Array.isArray(state.history)
    ||Object.keys(evaluation).some(k=>!['decisions','exposures','outcomes'].includes(k))
    ||Object.values(evaluation).some(rows=>!Array.isArray(rows)))brokenHistory();
  for(const event of state.events){
    generationOf(event.scope,profile,scope);
    // An analytical asOf may precede a later exclusion. Ownership validation
    // must not reject that history; each reader applies its own time cutoff.
    if(!Number.isFinite(Date.parse(event.at))||!Number.isFinite(Date.parse(event.recordedAt))||Date.parse(event.recordedAt)<Date.parse(event.at))brokenHistory();
  }
  for(const rows of Object.values(evaluation))for(const row of rows){
    generationOf(row.scope,profile,scope,true);
    if(row.subject!==scope.personId)throw new Error('다른 실습의 평가 기록이에요.');
    if(row.contract&&(row.contract.id!=='shift-first-check-result'||row.contract.version!=='1'))throw new Error('실습 결과 contract가 일치하지 않아요.');
  }
  for(const row of state.history)if(savedWork(row))checkSavedWork(row,profile,scope);
  checkVisits(state,scope);
  if(state.retention&&(state.retention.version!=='attempts-20-1'||!(state.retention.from===null||Number.isFinite(Date.parse(state.retention.from)))||![null,'legacy-incomplete'].includes(state.retention.resetReason)))brokenHistory();
}
function checkVisits(state,scope){
  if(state.visits===undefined)return;
  if(!Array.isArray(state.visits)||state.visits.length>Object.keys(TASKS).length||new Set(state.visits.map(v=>v.task)).size!==state.visits.length)brokenHistory();
  for(const visit of state.visits){
    const decision=state.events.find(e=>e.id===visit.decisionId&&e.type==='decision.made');
    generationOf(visit.scope,state.profile,scope);
    if(!Object.hasOwn(TASKS,visit.task)||!decision||decision.variant?.split('.')[0]!==visit.task||decision.scope.workspace!==visit.scope.workspace
      ||Object.keys(visit).length!==6||!Number.isFinite(Date.parse(visit.at))||Date.parse(visit.at)<Date.parse(decision.at)
      ||!Number.isFinite(Date.parse(visit.recordedAt))||Date.parse(visit.recordedAt)<Date.parse(visit.at)||visit.kind!=='displayed')brokenHistory();
    const exposure=state.evaluation?.exposures.find(e=>e.decisionId===`review.${visit.decisionId}`);
    if(exposure&&(exposure.at!==visit.at||(exposure.recordedAt??exposure.at)!==visit.recordedAt))brokenHistory();
  }
}
// Keep authored work independently of analytical permission. Never rebind an old
// decision/result to a new generation or relax the live lineage checks to keep it.
export function reconcileRecords(state,scope=state.profile?.scope||SCOPE,at=now()){
  if(!state.profile)return state;
  checkRecordOwners(state,scope,at);
  checkEvaluationLineage(state);
  if(state.run){
    const decision=state.events.find(e=>e.type==='decision.made'&&e.id===state.run.decisionId);
    if(!decision||!Object.hasOwn(TASKS,state.run.task))brokenHistory();
    const profile={...state.profile,generation:generationOf(decision.scope,state.profile,scope)};
    checkSavedDecision(state.run.focusDecision,TASKS[state.run.task].checks.map(c=>c.id),profile,scope);
    checkSavedDecision(state.run.nextDecision,Object.keys(TASKS).filter(id=>id!==state.run.task),profile,scope);
    const plan=state.run.focusDecision?.practicePlan,first=TASKS[state.run.task].checks.find(c=>c.id===state.run.checkIds[0]);
    if(plan&&(plan.selectedId!==first?.id||(plan.focus&&plan.focus!==first.focus)))brokenHistory();
    const metric=state.evaluation?.decisions.find(d=>d.id===state.run.reviewDecisionId),expectedPolicy=PRACTICE_POLICIES[plan?.focus?1:0];
    if(plan&&metric&&(metric.policy.id!==expectedPolicy.id||metric.policy.version!==expectedPolicy.version))brokenHistory();
    if(plan){
      const checks=plan.focus?orderChecks(TASKS[state.run.task].checks,plan.selectedId,plan.focus):TASKS[state.run.task].checks;
      if(!sameList(state.run.checkIds,checks.slice(0,state.run.variant==='quick'?2:3).map(c=>c.id)))brokenHistory();
    }
    for(const cached of [state.run.focusDecision,state.run.nextDecision]){
      const cachedPlan=cached?.practicePlan;if(!cachedPlan?.focus)continue;
      for(const h of state.history.filter(h=>!savedWork(h)&&h.review)){
        const {completion}=historyLineage(state,h),check=h.review.find(c=>cachedPlan.evidence.includes(`${completion.id}.${c.id}`));
        if(check&&(check.correct||check.focus!==cachedPlan.focus||Date.parse(completion.at)>Date.parse(cachedPlan.at)))brokenHistory();
      }
    }
  }
  const active=event=>state.profile.consent&&generationOf(event.scope,state.profile,scope)===state.profile.generation;
  const events=state.events.filter(active),ids=new Set(events.map(e=>e.id));
  const archive=(row,status,decision)=>({kind:'saved-work',scope:{...scope},sourceGeneration:generationOf(decision.scope,state.profile,scope),task:row.task,at:status==='completed'?row.at:row.startedAt,prompt:row.prompt,draft:row.draft,status});
  const visits=(state.visits||[]).filter(v=>state.profile.consent&&generationOf(v.scope,state.profile,scope)===state.profile.generation&&!events.some(e=>e.type==='record.excluded'&&e.targetId===v.decisionId));
  let changed=events.length!==state.events.length||visits.length!==(state.visits||[]).length;
  const history=state.history.map(row=>{
    if(savedWork(row))return row;
    const {completion,decision}=historyLineage(state,row);
    if(ids.has(completion.id))return row;
    changed=true;const copy=archive(row,'completed',decision);checkSavedWork(copy,state.profile,scope);return copy;
  });
  let run=state.run;
  if(run&&!ids.has(run.decisionId)){
    const decision=state.events.find(e=>e.type==='decision.made'&&e.id===run.decisionId);
    if(!decision||decision.experienceId!=='shift-workbench'||decision.variant!==`${run.task}.${run.variant}`)brokenHistory();
    if(run.step==='practice'&&(run.prompt||run.draft!==TASKS[run.task]?.sample)){
      const copy=archive(run,'in-progress',decision);checkSavedWork(copy,state.profile,scope);history.push(copy);
    }
    run=null;changed=true;
  }
  const evaluation=state.evaluation||emptyEvaluation(),decisions=evaluation.decisions.filter(row=>state.profile.consent&&generationOf(row.scope,state.profile,scope,true)===state.profile.generation),kept=new Set(decisions.map(row=>row.id));
  const exposures=evaluation.exposures.filter(row=>kept.has(row.decisionId)),seen=new Set(exposures.map(row=>row.id));
  const outcomes=evaluation.outcomes.filter(row=>seen.has(row.exposureId));
  changed||=decisions.length!==evaluation.decisions.length||exposures.length!==evaluation.exposures.length||outcomes.length!==evaluation.outcomes.length;
  if(!changed)return state;
  const defaults=newState().settings,settings={task:state.settings.task,...Object.fromEntries(['goal','minutes','support'].map(k=>[k,state.profile.values[k]??defaults[k]]))};
  return {...state,settings,events,visits,history:keepHistory(history),run,evaluation:{decisions,exposures,outcomes}};
}
function validateEvaluationGenerations(state,temper,at,scope){
  checkRecordOwners(state,scope,at);checkEvaluationLineage(state);
  const evaluation=state.evaluation||emptyEvaluation(),groups=new Set(Object.values(evaluation).flat().map(row=>row.scope.workspace));
  for(const workspace of groups){
    const contract=outcomeContract(state,scope);contract.scope.workspace=workspace;
    const group=Object.fromEntries(Object.entries(evaluation).map(([key,rows])=>[key,rows.filter(row=>row.scope.workspace===workspace)]));
    for(const policies of [LEGACY_POLICIES,PRACTICE_POLICIES])temper.evaluateOutcomes({contract,...evaluationForPolicies(group,policies),policies,subjects:[scope.personId],asOf:at});
  }
}
export function practiceEvaluation(state,temper,at=now(),scope=SCOPE){
  if(!state.profile||!temper?.evaluateOutcomes)return null;
  validateEvaluationGenerations(state,temper,at,scope);
  state=reconcileRecords(state,scope,at);
  state=upgradeRetention(state,at,scope);
  const evaluation=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  // Product-owned source events are the only source of withdrawals. Stored
  // arbitrary evaluator revisions must not override the actual reviewed work.
  if(Object.keys(evaluation).some(key=>!['decisions','exposures','outcomes'].includes(key)))brokenHistory();
  const input={contract:outcomeContract(state,scope),...evaluationForPolicies(evaluation,PRACTICE_POLICIES),policies:PRACTICE_POLICIES,subjects:[scope.personId],asOf:at};
  // Validate every supplied record before excluding analytical descendants; a
  // withdrawal must not hide malformed or foreign records from boundary checks.
  temper.evaluateOutcomes(input);checkEvaluationLineage(state);
  const retained=evaluationForPolicies(retainedEvaluation(state,at),PRACTICE_POLICIES);
  const events=ownedEvents(state,scope).filter(e=>Date.parse(e.at)<=Date.parse(at)&&Date.parse(e.recordedAt)<=Date.parse(at));
  const exclusions=events.filter(e=>e.type==='record.excluded'),excluded=new Set(exclusions.map(e=>e.targetId));
  const removedDecisions=new Set(events.filter(e=>e.type==='decision.made'&&excluded.has(e.id)).map(e=>`review.${e.id}`));
  const decisions=retained.decisions.filter(row=>!removedDecisions.has(row.id)),ids=new Set(decisions.map(row=>row.id));
  // Older saves lack record-level contract references. Only after their scope,
  // decision and completed review have been checked, bind the evaluation copy.
  // The original saved records and occurrence times remain unchanged.
  const contract={id:input.contract.id,version:input.contract.version};
  const exposures=retained.exposures.filter(row=>ids.has(row.decisionId)).map(row=>({...row,contract:row.contract||{...contract}})),seen=new Map(exposures.map(row=>[row.id,row]));
  const outcomes=retained.outcomes.filter(row=>seen.has(row.exposureId)).map(row=>({...row,contract:row.contract||{...contract}}));
  const revisions=[];
  for(const outcome of outcomes){
    const decisionId=seen.get(outcome.exposureId).decisionId;
    const completion=events.find(e=>e.type==='experience.completed'&&`review.${e.decisionId}`===decisionId);
    const source=exclusions.find(e=>e.targetId===completion?.id);
    if(source)revisions.push({id:`withdraw.${source.id}`,subject:outcome.subject,scope:{...outcome.scope},contract:{...contract},at:source.at,recordedAt:source.recordedAt,targetId:outcome.id,action:'withdraw',sourceRef:source.id});
  }
  const report=temper.evaluateOutcomes({...input,decisions,exposures,outcomes,revisions,strictProvenance:true});
  return {...report,coverage:{version:'attempts-20-1',limit:20,selection:'decision-time',from:state.retention?.from||null,resetReason:state.retention?.resetReason||null,oldest:retained.decisions[0]?.at||null,newest:retained.decisions.at(-1)?.at||null,historicalScope:'retained-window-only'}};
}
export function recordPracticeExposure(state,at=now(),scope=SCOPE){
  state=reconcileRecords(state,scope,at);
  if(!state.run||state.run.step!=='practice')return state;
  const evaluation=state.evaluation,decision=evaluation?.decisions.find(d=>d.id===state.run.reviewDecisionId);
  if(!decision||evaluation.exposures.some(e=>e.decisionId===decision.id))return state;
  if(decision.subject!==scope.personId||JSON.stringify(decision.scope)!==JSON.stringify(evaluationScope(state,scope))||Date.parse(at)<Date.parse(decision.at))throw new Error('다른 실습의 화면 기록이에요.');
  const visit={kind:'displayed',task:state.run.task,decisionId:state.run.decisionId,scope:{...state.events.find(e=>e.id===state.run.decisionId).scope},at,recordedAt:at};
  return {...state,visits:[...(state.visits||[]).filter(v=>v.task!==visit.task),visit],evaluation:{...evaluation,exposures:[...evaluation.exposures,{id:`seen.${decision.id}`,subject:scope.personId,scope:{...decision.scope},contract:{...decision.contract},at,decisionId:decision.id,candidateId:decision.selectedId}]}};
}
function ownedEvents(state,scope){
  if(!state.profile?.consent)return [];
  const owned={domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`};
  return state.events.filter(e=>Object.keys(owned).every(key=>e.scope?.[key]===owned[key]));
}
const recordedBy=(event,at)=>Date.parse(event.at)<=Date.parse(at)&&Date.parse(event.recordedAt??event.at)<=Date.parse(at);
function effectiveCompletions(state,scope,at=now()){
  const events=ownedEvents(state,scope).filter(e=>recordedBy(e,at));
  const excluded=new Set(events.filter(e=>e.type==='record.excluded').map(e=>e.targetId));
  const decisions=new Set(events.filter(e=>e.type==='decision.made'&&!excluded.has(e.id)).map(e=>e.id));
  return events.filter(e=>e.type==='experience.completed'&&!excluded.has(e.id)&&decisions.has(e.decisionId));
}
const sameList=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const brokenHistory=()=>{throw new Error('저장된 실습 기록과 완료 근거가 일치하지 않아요.');};
function historyLineage(state,h){
  const matches=state.events.filter(e=>e.type==='experience.completed'&&(h.completionId?e.id===h.completionId:e.at===h.at&&e.variant?.startsWith(`${h.task}.`)));
  if(matches.length!==1)brokenHistory();
  const completion=matches[0],decision=state.events.find(e=>e.type==='decision.made'&&e.id===completion.decisionId);
  const [taskId,variant]=String(decision?.variant||'').split('.'),task=TASKS[taskId],count=variant==='quick'?2:3;
  if(!task||!['quick','full','deep'].includes(variant)||h.task!==taskId||h.at!==completion.at||completion.variant!==decision.variant||completion.experienceId!=='shift-workbench'||decision.experienceId!=='shift-workbench'||(h.decisionId&&h.decisionId!==decision.id)||h.total!==count||!Number.isInteger(h.correct)||h.correct<0||h.correct>count||!Array.isArray(h.missed)||new Set(h.missed).size!==h.missed.length||h.missed.some(f=>!task.checks.some(c=>c.focus===f)))brokenHistory();
  if(h.review){
    if(!Array.isArray(h.review)||h.review.length!==count||new Set(h.review.map(c=>c.id)).size!==count||h.review.some(c=>typeof c.correct!=='boolean'||!task.checks.some(check=>check.id===c.id&&check.focus===c.focus))||h.correct!==h.review.filter(c=>c.correct).length||!sameList([...new Set(h.review.filter(c=>!c.correct).map(c=>c.focus))].sort(),[...h.missed].sort()))brokenHistory();
    const metric=state.evaluation?.decisions.find(d=>d.id===`review.${decision.id}`);
    if(metric){
      const first=task.checks.find(c=>c.id===metric.selectedId);if(!first)brokenHistory();
      let checks=[...task.checks];if(metric.policy.id==='evidence-check-order')checks=metric.policy.version==='1'?checks.sort((a,b)=>Number(b.focus===first.focus)-Number(a.focus===first.focus)):orderChecks(checks,first.id,first.focus);
      if(!sameList(h.review.map(c=>c.id),checks.slice(0,count).map(c=>c.id)))brokenHistory();
    }
    if(state.run?.decisionId===decision.id){const checked=evaluate(state.run);if(!sameList(h.review.map(c=>c.id),state.run.checkIds)||h.review.some((c,i)=>c.correct!==checked[i].correct))brokenHistory();}
  }
  return {summary:h,completion,decision};
}
function checkEvaluationLineage(state){
  const lineage=state.history.filter(h=>!savedWork(h)).map(h=>historyLineage(state,h)),evaluation=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  const decisions=new Map();
  for(const metric of evaluation.decisions){
    const decision=state.events.find(e=>e.type==='decision.made'&&`review.${e.id}`===metric.id),task=TASKS[String(decision?.variant||'').split('.')[0]];
    if(!decision||decision.experienceId!=='shift-workbench'||!task||metric.at!==decision.at||!sameList(metric.candidateIds,task.checks.map(c=>c.id))
      ||!task.checks.some(c=>c.id===metric.selectedId)||!knownPolicy(metric.policy))brokenHistory();
    const summary=lineage.find(row=>row.decision.id===decision.id)?.summary;
    if(summary?.review&&metric.selectedId!==summary.review[0].id)brokenHistory();
    if(state.run?.decisionId===decision.id&&metric.selectedId!==state.run.checkIds[0])brokenHistory();
    decisions.set(metric.id,decision);
  }
  for(const exposure of evaluation.exposures){
    const parent=evaluation.decisions.find(row=>row.id===exposure.decisionId);
    if(!parent||exposure.candidateId!==parent.selectedId||exposure.subject!==parent.subject||exposure.scope?.workspace!==parent.scope?.workspace
      ||!Number.isFinite(Date.parse(exposure.at))||Date.parse(exposure.at)<Date.parse(parent.at)
      ||Date.parse(exposure.recordedAt??exposure.at)<Date.parse(parent.recordedAt??parent.at))brokenHistory();
  }
  for(const outcome of evaluation.outcomes){
    const exposure=evaluation.exposures.find(e=>e.id===outcome.exposureId),decision=decisions.get(exposure?.decisionId);
    const completion=state.events.find(e=>e.type==='experience.completed'&&e.decisionId===decision?.id);
    if(!completion||outcome.at!==completion.at)brokenHistory();
    const summary=lineage.find(row=>row.completion.id===completion.id)?.summary;
    // Older saves may have more outcomes than retained summaries. Validate their
    // event lineage here; retainedEvaluation then removes unverifiable results.
    if(summary&&outcome.value!==summary.correct/summary.total)brokenHistory();
  }
}
function retainedEvaluation(state,at=now()){
  const evaluation=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  const completed=new Set(state.events.filter(e=>e.type==='experience.completed').map(e=>`review.${e.decisionId}`));
  const summarized=new Set(state.history.filter(h=>!savedWork(h)).map(h=>`review.${historyLineage(state,h).decision.id}`));
  // Select one outcome-independent cohort before filtering policy versions.
  // A decision and all its analytical descendants enter and leave together.
  const attempts=state.events.filter(e=>e.type==='decision.made'&&e.experienceId==='shift-workbench'&&recordedBy(e,at)&&(!state.retention?.from||Date.parse(e.at)>=Date.parse(state.retention.from)))
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||Date.parse(a.recordedAt)-Date.parse(b.recordedAt)||a.id.localeCompare(b.id)).slice(-20);
  const cohort=new Set(attempts.map(e=>`review.${e.id}`));
  const decisions=evaluation.decisions.filter(row=>cohort.has(row.id)&&(!completed.has(row.id)||summarized.has(row.id))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)),ids=new Set(decisions.map(row=>row.id));
  const exposures=evaluation.exposures.filter(row=>ids.has(row.decisionId)),seen=new Set(exposures.map(row=>row.id));
  return {decisions,exposures,outcomes:evaluation.outcomes.filter(row=>seen.has(row.exposureId))};
}
function upgradeRetention(state,at,scope){
  if(state.retention)return state;
  const visits=[];
  for(const exposure of state.evaluation.exposures){
    const decision=state.events.find(e=>`review.${e.id}`===exposure.decisionId),task=decision.variant.split('.')[0];
    const visit={kind:'displayed',task,decisionId:decision.id,scope:{...decision.scope},at:exposure.at,recordedAt:exposure.recordedAt??exposure.at};
    const index=visits.findIndex(v=>v.task===task);if(index<0)visits.push(visit);else if(Date.parse(visits[index].at)<Date.parse(visit.at))visits[index]=visit;
  }
  const attempts=ownedEvents(state,scope).filter(e=>e.type==='decision.made'&&e.experienceId==='shift-workbench').sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)).slice(-20);
  const complete=new Set(state.history.filter(h=>!savedWork(h)).map(h=>historyLineage(state,h).decision.id));
  const incomplete=attempts.some(e=>!state.evaluation.decisions.some(d=>d.id===`review.${e.id}`)||(state.events.some(c=>c.type==='experience.completed'&&c.decisionId===e.id)&&!complete.has(e.id)));
  return {...state,visits,retention:{version:'attempts-20-1',from:incomplete?at:null,resetReason:incomplete?'legacy-incomplete':null},evaluation:incomplete?emptyEvaluation():state.evaluation};
}
export function practiceObservations(state,scope=SCOPE,at=now()){
  if(!state.profile?.consent)return [];
  const owned={domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`};
  const completions=effectiveCompletions(state,scope,at);
  const rows=state.history.flatMap(h=>{
    if(savedWork(h))return [];
    const {completion}=historyLineage(state,h);
    if(Date.parse(completion.at)>Date.parse(at)||Date.parse(completion.recordedAt)>Date.parse(at))return [];
    // Old records only identify missed checks. An unmentioned focus is unknown,
    // because a short exercise may never have presented it.
    return (h.review||h.missed.map(focus=>({focus,correct:false}))).map(check=>{
      return {id:`${completion.id}.${check.id||check.focus}`,scope:{...owned},contract:{id:PRACTICE_CONTRACT.id,version:PRACTICE_CONTRACT.version,purpose:PRACTICE_CONTRACT.purpose},field:check.focus,value:check.correct?'correct':'incorrect',source:'observed',
        independentKey:`${h.task}.${check.id||`legacy-${check.focus}`}.v1`,at:completion.at,recordedAt:completion.recordedAt,
        refs:[completion.id,...(check.id?[`${h.task}.${check.id}`]:[])]};
    });
  });
  // Select the last result before removing excluded records. Withdrawing the
  // last correction must not resurrect an older answer to the same question.
  const latest=new Map();
  for(const row of rows.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||Date.parse(a.recordedAt)-Date.parse(b.recordedAt)))latest.set(row.independentKey,row);
  return [...latest.values()].filter(row=>completions.some(c=>c.id===row.refs[0])&&!(!row.refs[1]&&rows.some(detail=>detail.refs[1]?.startsWith(`${row.independentKey.split('.')[0]}.`)&&detail.field===row.field&&Date.parse(detail.at)>=Date.parse(row.at))));
}
const freshObservation=(row,at)=>Date.parse(row.at)<=Date.parse(at)&&Date.parse(row.recordedAt)<=Date.parse(at)&&Date.parse(at)-Date.parse(row.at)<30*86400000;
function taskSeenAt(state,task,at,scope){
  const events=ownedEvents(state,scope).filter(e=>recordedBy(e,at)),excluded=new Set(events.filter(e=>e.type==='record.excluded').map(e=>e.targetId));
  const decisions=new Set(events.filter(e=>e.type==='decision.made'&&e.variant?.startsWith(`${task}.`)&&!excluded.has(e.id)).map(e=>e.id));
  const times=effectiveCompletions(state,scope,at).filter(e=>decisions.has(e.decisionId)).map(e=>e.at);
  for(const visit of state.visits||[])if(recordedBy(visit,at)&&decisions.has(visit.decisionId))times.push(visit.at);
  for(const exposure of state.evaluation?.exposures||[])if(recordedBy(exposure,at)&&[...decisions].some(id=>exposure.decisionId===`review.${id}`))times.push(exposure.at);
  return Math.max(-Infinity,...times.map(Date.parse).filter(time=>time<=Date.parse(at)));
}
function reviewPlan(state,candidates,at,scope,task=null){
  const observations=practiceObservations(state,scope,at);
  // This is a SHIFT practice choice, not a change to Domain's aggregate belief.
  // Only a known question's most recent answer can create a recheck priority.
  const missed=observations.filter(row=>row.refs[1]&&row.value==='incorrect'&&freshObservation(row,at)&&candidates.some(c=>c.features[row.field]==='incorrect'))
    .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||Object.keys(FOCUS).indexOf(a.field)-Object.keys(FOCUS).indexOf(b.field)||a.independentKey.localeCompare(b.independentKey));
  const focus=missed[0]?.field||null;
  let eligible=candidates.filter(c=>!focus||c.features[focus]==='incorrect');
  if(task){
    const exact=missed.find(row=>row.field===focus&&row.refs[1].startsWith(`${task}.`)&&eligible.some(c=>`${task}.${c.id}`===row.refs[1]));
    if(exact)eligible=[...eligible].sort((a,b)=>Number(`${task}.${b.id}`===exact.refs[1])-Number(`${task}.${a.id}`===exact.refs[1]));
  }else eligible=[...eligible].sort((a,b)=>taskSeenAt(state,a.id,at,scope)-taskSeenAt(state,b.id,at,scope)||Object.keys(TASKS).indexOf(a.id)-Object.keys(TASKS).indexOf(b.id));
  const selectedId=eligible[0]?.id||null;
  const exact=task?missed.find(row=>row.field===focus&&row.refs[1]===`${task}.${selectedId}`):null;
  return {policy:'shift-review-order',version:'2',at,selectedId,focus,evidence:focus?[(exact||missed[0]).id]:[],tieBreak:task?'question-order':taskSeenAt(state,selectedId,at,scope)===-Infinity?'unseen':'least-recent'};
}
function orderChecks(checks,firstId,focus){return [...checks].sort((a,b)=>Number(b.id===firstId)-Number(a.id===firstId)||Number(b.focus===focus)-Number(a.focus===focus));}
function reviewDecision(state,candidates,engine,at,scope,task=null){
  // The adapter's optional capability getter throws while the module is absent.
  let domain=null;try{domain=engine?.domain;}catch{}domain||=globalThis.SynkAtlasDomain;
  if(!domain?.decide)throw new Error('검토 기록 모듈을 불러오지 못했어요. 새로고침해 주세요.');
  const decision=domain.decide({contract:PRACTICE_CONTRACT,scope:{domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`},observations:practiceObservations(state,scope,at),at,candidates});
  return {...decision,practicePlan:reviewPlan(state,candidates,at,scope,task)};
}
const reviewReason=ranked=>ranked?.reasons?.find(reason=>reason.value==='incorrect'&&reason.candidateValue==='incorrect'&&reason.contribution>0);
function currentReviewReason(state,decision,at=now()){
  const plan=decision?.practicePlan,reason=plan?(plan.focus?{field:plan.focus,evidence:plan.evidence}:null):reviewReason(decision?.selected),valid=new Set(practiceObservations(state,state.profile?.scope||SCOPE,at).filter(row=>freshObservation(row,at)&&(!plan||(row.value==='incorrect'&&row.field===plan.focus))).map(row=>row.id));
  return reason?.evidence.length&&reason.evidence.every(id=>valid.has(id))?reason:null;
}
export function decisionEvidence(state,decision,at=now()){
  const reason=currentReviewReason(state,decision,at);
  if(!reason)return [];
  const observations=practiceObservations(state,state.profile.scope,at);
  return reason.evidence.flatMap(id=>{
    const row=observations.find(o=>o.id===id),summary=state.history.find(h=>!savedWork(h)&&historyLineage(state,h).completion.id===row?.refs[0]);
    return summary?[{id,task:summary.task,at:summary.at,focus:reason.field,checkId:row.refs[1]?.split('.')[1]||null,correct:row.value==='correct',assisted:summary.assisted}]:[];
  });
}
export function practiceBasis(state,at=now()){
  if(state.run&&!ownedEvents(state,state.profile?.scope||SCOPE).some(e=>e.id===state.run.decisionId))return [];
  const records=decisionEvidence(state,state.run?.focusDecision,at),lines=records.map(r=>`${new Date(r.at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})} · ${TASKS[r.task].name} · ${FOCUS[r.focus]}${r.checkId?' · '+TASKS[r.task].checks.find(c=>c.id===r.checkId).label:''}: ${r.correct?'판단과 근거 일치':'다시 확인'} (${r.assisted?'안내 사용':'스스로 검토'})`);
  const uncertain=(state.run?.focusDecision?.understanding?.needsCheck||[]).filter(f=>TASKS[state.run.task].checks.some(c=>c.focus===f));
  if(uncertain.length)lines.push(`${uncertain.map(f=>FOCUS[f]).join(', ')}: 기록이 충분하지 않거나 결과가 엇갈려 전체 판단은 보류했어요.${records.length?' 다시 확인할 문항의 마지막 결과만 복습 순서에 사용했어요.':''}`);
  return lines;
}
export function practiceReason(state,at=now()){
  const run=state.run;
  if(!run)return '';
  if(!ownedEvents(state,state.profile?.scope||SCOPE).some(e=>e.id===run.decisionId))return '개인화 조건이 변경됐어요. 작성한 내용은 보관하고 새 조건으로 실습을 시작해 주세요.';
  // A cached presentation may outlive the evidence it cited. Keep its original
  // time/support explanation, but stop presenting a withdrawn review as current.
  return run.focusDecision&&!currentReviewReason(state,run.focusDecision,at)?run.reason.split(' 지난 실습의 ')[0]:run.reason;
}
export function practiceHistoryUsed(state,at=now()){
  const scope=state.profile?.scope||SCOPE;
  const events=ownedEvents(state,scope),decision=events.find(e=>e.id===state.run?.decisionId);
  if(!decision)return false;
  return !!currentReviewReason(state,state.run?.focusDecision,at)
    ||events.some(e=>e.type==='feedback.given'&&decision.evidence?.includes(e.id));
}
export function startRun(state,settings,engine,at=now(),scope=SCOPE){
  if(!Object.hasOwn(TASKS,settings.task)||!['clarity','work','prepare'].includes(settings.goal)||![5,10,15].includes(settings.minutes)||!['step','independent'].includes(settings.support))throw new Error('실습 조건을 다시 선택해 주세요.');
  if(state.profile){const recovered=recoverProductUpgrade(state,{manifest:PRODUCT_MANIFEST,tasks:TASKS,scope,engine,at}).state;state={...recovered,history:keepHistory(recovered.history)};}
  let profile = state.profile || engine.createProfile({scope,at});
  const retired=Object.fromEntries(['audio','experience'].filter(key=>Object.hasOwn(profile.values,key)).map(key=>[key,null]));
  if(Object.keys(retired).length)profile=engine.updateProfile(profile,{values:retired},at);
  profile=engine.updateProfile(profile,{consent:true,values:{goal:settings.goal,minutes:settings.minutes,support:settings.support}},at);
  const candidates=[{id:`${settings.task}.quick`,minutes:5,pace:'short',goals:['clarity'],supports:['step','independent']},
    {id:`${settings.task}.full`,minutes:10,pace:'standard',goals:['work'],supports:['step','independent']},
    {id:`${settings.task}.deep`,minutes:15,pace:'deep',goals:['prepare'],supports:['step','independent']}];
  const selection=engine.selectPersonalization({profile,scope,candidates,experienceId:'shift-workbench',events:state.events,at});
  // Selection validates the original event log before returning current events.
  state=reconcileRecords({...state,profile},scope,at);
  state=upgradeRetention(state,at,scope);
  if(selection.plan.status!=='ready')throw new Error('지금 조건에 맞는 실습을 선택하지 못했어요.');
  const variant=selection.plan.selected.id.split('.').at(-1);
  let checks=[...TASKS[settings.task].checks];
  const focusDecision=reviewDecision({...state,profile:selection.profile,events:selection.events},checks.map(c=>({id:c.id,features:{[c.focus]:'incorrect'}})),engine,at,scope,settings.task);
  const focus=focusDecision.practicePlan.focus;
  if(focus)checks=orderChecks(checks,focusDecision.practicePlan.selectedId,focus);
  checks=checks.slice(0,variant==='quick'?2:3);
  const next={...state,manifest:{...PRODUCT_MANIFEST},settings:{...settings},profile:selection.profile,events:selection.events,run:{task:settings.task,taskName:TASKS[settings.task].name,initialDraft:TASKS[settings.task].sample,goal:settings.goal,variant,checkIds:checks.map(c=>c.id),decisionId:selection.plan.id,focusDecision,reviewDecisionId:`review.${selection.plan.id}`,startedAt:at,step:'practice',prompt:'',answers:{},result:null,draft:TASKS[settings.task].sample,reviewed:false,feedback:null,reason:`${settings.minutes}분 안에서 ${variant==='quick'?'핵심 2개':'전체 3개'} 항목을 ${selection.presentation.support==='step'?'안내와 함께':'스스로'} 확인합니다.${variant==='deep'?' 검토 후 실제 업무에 적용할 확인 항목도 정리해요.':''}${focus?' 지난 실습의 '+FOCUS[focus]+' 항목부터 살펴봐요. 가상 자료의 확인 기록이며 업무 능력 평가는 아닙니다.':''}`,support:selection.presentation.support}};
  const boundary=evaluationScope(next,scope),prior=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  const decisions=prior.decisions.filter(row=>row.subject===scope.personId&&JSON.stringify(row.scope)===JSON.stringify(boundary)),ids=new Set(decisions.map(row=>row.id));
  const exposures=prior.exposures.filter(row=>ids.has(row.decisionId)),seen=new Set(exposures.map(row=>row.id));
  next.evaluation={decisions,exposures,outcomes:prior.outcomes.filter(row=>seen.has(row.exposureId))};
  next.evaluation.decisions.push({id:next.run.reviewDecisionId,subject:scope.personId,scope:boundary,contract:{id:'shift-first-check-result',version:'1'},at,policy:{...PRACTICE_POLICIES[focus?1:0]},candidateIds:TASKS[settings.task].checks.map(c=>c.id),selectedId:checks[0].id});
  next.evaluation=retainedEvaluation(next,at);
  return next;
}
function nextPracticePlan(state,at){
  const ids=Object.keys(TASKS).filter(id=>id!==state.run?.task),scope=state.profile?.scope||SCOPE;
  return reviewPlan(state,ids.map(id=>({id,features:Object.fromEntries(TASKS[id].checks.map(c=>[c.focus,'incorrect']))})),at,scope);
}
export function nextTaskSuggestion(state,at=now()){
  const plan=nextPracticePlan(state,at);return {task:plan.selectedId,focus:plan.focus};
}
export function nextTaskReason(state,at=now()){
  const plan=nextPracticePlan(state,at),name=TASKS[plan.selectedId].name;
  return `${plan.focus?`마지막 검토에서 아직 다시 확인할 문항이 있는 ${FOCUS[plan.focus]} 항목을 「${name}」에서 연습해 보세요.`:`다른 자료를 확인하는 「${name}」 실습을 제안합니다.`} ${plan.tieBreak==='unseen'?'같은 조건의 후보 중 현재 기록에 아직 경험한 이력이 없는 실습을 먼저 골랐어요.':'같은 조건의 후보 중 현재 기록에서 가장 오래전에 경험한 실습을 먼저 골랐어요.'}`;
}
export function evaluate(run){
  const task=TASKS[run?.task];if(!task)throw new Error('실습을 먼저 시작해 주세요.');
  return run.checkIds.map(id=>{const check=task.checks.find(c=>c.id===id),answer=run.answers[id];return {...check,submitted:answer||null,answered:!!answer?.kind&&!!answer?.source,correct:answer?.kind===check.answer&&answer?.source===check.source};});
}
export function checkPrompt(text){return [{label:'어떤 결과물이 필요한지',met:/(목록|요약|기획|운영안|실행안|표|정리|보고)/.test(text)},{label:'제공된 자료를 근거로 쓸지',met:/(자료|원문|M[1-3]|R[1-3]|P[1-3]|근거)/i.test(text)},{label:'빠뜨리거나 추측하지 않을 조건',met:/(기한|담당|승인|추측|한계|측정|예산|성공|제약|확인|금지|만들지)/.test(text)}];}
export function completeRun(state,engine,at=now(),scope=SCOPE){
  const priorRun=state.run;state=reconcileRecords(state,scope,at);
  if(priorRun&&!state.run)throw new Error('개인화 조건이 변경됐어요. 작성한 내용은 보관하고 새 조건으로 실습을 시작해 주세요.');
  if(!state.run||state.run.step==='result')throw new Error('진행 중인 실습이 없어요.');
  const run=state.run,checks=evaluate(run);
  if(run.prompt.trim().length<20)throw new Error('요청문을 20자 이상 작성해 주세요.');
  if(checks.some(c=>!c.answered))throw new Error('모든 항목의 판단과 자료 번호를 골라 주세요.');
  if(!run.result)throw new Error('검토 결과를 먼저 확인해 주세요.');
  if(run.draft.trim().length<30||run.draft.trim()===TASKS[run.task].sample.trim())throw new Error('예시 결과를 근거에 맞게 직접 수정해 주세요.');
  if(!run.reviewed)throw new Error('수정한 결과를 직접 읽고 확인해 주세요.');
  const events=engine.recordCompletion({profile:state.profile,scope,events:state.events,decisionId:run.decisionId,at});
  const completion=events.find(e=>e.type==='experience.completed'&&e.decisionId===run.decisionId);
  const summary={task:run.task,taskName:TASKS[run.task].name,at,completionId:completion.id,decisionId:run.decisionId,correct:run.result.filter(c=>c.correct).length,total:run.result.length,missed:[...new Set(run.result.filter(c=>!c.correct).map(c=>c.focus))],review:run.result.map(c=>({id:c.id,focus:c.focus,correct:c.correct})),prompt:run.prompt,draft:run.draft,assisted:run.support==='step'};
  const next={...state,events,run:{...run,step:'result',completionId:completion.id,completedAt:at},history:keepHistory([...state.history,summary])};
  const ids=Object.keys(TASKS),index=ids.indexOf(run.task),ordered=ids.slice(index+1).concat(ids.slice(0,index));
  next.run.nextDecision=reviewDecision(next,ordered.map(id=>({id,features:Object.fromEntries(TASKS[id].checks.map(c=>[c.focus,'incorrect']))})),engine,at,scope);
  const exposure=next.evaluation?.exposures.find(e=>e.decisionId===run.reviewDecisionId);
  if(exposure)next.evaluation={...next.evaluation,outcomes:[...next.evaluation.outcomes,{id:`result.${run.reviewDecisionId}`,subject:scope.personId,scope:{...exposure.scope},contract:{id:'shift-first-check-result',version:'1'},at,exposureId:exposure.id,value:summary.correct/summary.total}]};
  next.evaluation=retainedEvaluation(next);
  return next;
}
export function giveFeedback(state,value,engine,at=now(),scope=SCOPE){
  state=reconcileRecords(state,scope,at);
  if(!state.run?.completionId||state.run.feedback)throw new Error('완료한 실습에 한 번만 피드백할 수 있어요.');
  const events=engine.recordFeedback({profile:state.profile,scope,events:state.events,completionId:state.run.completionId,value,at});
  return {...state,events,run:{...state.run,feedback:value}};
}
function checkSavedDecision(decision,ids,profile,scope){
  if(!decision)return;
  const owner={domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${profile.generation}`};
  const ranking=rank=>rank&&ids.includes(rank.id)&&Number.isFinite(rank.score)&&Array.isArray(rank.reasons)&&rank.reasons.length<=3&&rank.reasons.every(reason=>Object.hasOwn(FOCUS,reason.field)&&['correct','incorrect'].includes(reason.value)&&['correct','incorrect'].includes(reason.candidateValue)&&Number.isFinite(reason.contribution)&&Array.isArray(reason.evidence)&&reason.evidence.length<=60&&reason.evidence.every(id=>typeof id==='string'&&id.length<=120));
  if(decision.version!=='core-domain-1'||Object.keys(owner).some(key=>decision.scope?.[key]!==owner[key])||['id','version','purpose'].some(key=>decision.contract?.[key]!==PRACTICE_CONTRACT[key])||!Array.isArray(decision.ranked)||decision.ranked.length>ids.length||decision.ranked.some(rank=>!ranking(rank))||(decision.selected&&!ranking(decision.selected))||!Array.isArray(decision.understanding?.needsCheck)||decision.understanding.needsCheck.some(f=>!Object.hasOwn(FOCUS,f)))throw new Error('저장된 추천 근거를 확인할 수 없어요.');
  const plan=decision.practicePlan;
  if(plan&&(plan.policy!=='shift-review-order'||plan.version!=='2'||!ids.includes(plan.selectedId)||!Number.isFinite(Date.parse(plan.at))||plan.at!==decision.at
    ||!(plan.focus===null||Object.hasOwn(FOCUS,plan.focus))||!Array.isArray(plan.evidence)||plan.evidence.length!==(plan.focus?1:0)||plan.evidence.some(id=>typeof id!=='string'||id.length>120)
    ||!['question-order','unseen','least-recent'].includes(plan.tieBreak)))throw new Error('저장된 추천 근거를 확인할 수 없어요.');
  if(plan?.focus&&TASKS[plan.selectedId]&&!TASKS[plan.selectedId].checks.some(c=>c.focus===plan.focus))throw new Error('저장된 추천 근거를 확인할 수 없어요.');
}
export function restore(text,engine,scope=SCOPE,temper){
  if(typeof text!=='string'||text.length>1000000)throw new Error('저장된 실습을 읽을 수 없어요.');
  let value=JSON.parse(text);
  if(value?.version!==1||value.save!==true||!Array.isArray(value.events)||value.events.length>5000||!Array.isArray(value.history)||value.history.length>41||value.history.filter(savedWork).length>21||value.history.filter(h=>!savedWork(h)).length>20)throw new Error('지원하지 않는 저장 형식이에요.');
  if(!value.profile||['personId','productId','contextId','domain'].some(key=>value.profile.scope?.[key]!==scope[key]))throw new Error('다른 실습의 기록이에요.');
  engine.validateProfile(value.profile);
  if(Object.keys(value.profile.values).some(key=>!['goal','minutes','support','audio','experience'].includes(key)))throw new Error('이전 시험판의 맞춤 조건입니다. 초기화한 뒤 직접 선택해 주세요.');
  const at=now(),recovery=recoverProductUpgrade(value,{manifest:PRODUCT_MANIFEST,tasks:TASKS,scope,engine,at});
  if(recovery.recovered){
    if(!temper?.evaluateOutcomes)throw new Error('실습 기록 검증 모듈을 불러오지 못했어요.');
    recovery.state.history=keepHistory(recovery.state.history);
    const retired=Object.fromEntries(['audio','experience'].filter(key=>Object.hasOwn(recovery.state.profile.values,key)).map(key=>[key,null]));
    if(Object.keys(retired).length)recovery.state.profile=engine.updateProfile(recovery.state.profile,{values:retired},at);
    return recovery.state;
  }
  const retired=Object.fromEntries(['audio','experience'].filter(key=>Object.hasOwn(value.profile.values,key)).map(key=>[key,null]));
  if(Object.keys(retired).length)value.profile=engine.updateProfile(value.profile,{values:retired},at);
  engine.selectPersonalization({profile:value.profile,scope,candidates:[{id:'validate',minutes:1,pace:'short'}],experienceId:'validate',events:value.events,at:now()});
  if(value.visits?.some(visit=>!recordedBy(visit,at)))brokenHistory();
  if(!Object.hasOwn(TASKS,value.settings?.task))throw new Error('실습 종류를 확인할 수 없어요.');
  if(value.run){const r=value.run,task=TASKS[r.task];if(!task||!['practice','result'].includes(r.step)||!Array.isArray(r.checkIds)||r.checkIds.length<1||r.checkIds.length>3||new Set(r.checkIds).size!==r.checkIds.length||r.checkIds.some(id=>!task.checks.some(c=>c.id===id))||typeof r.prompt!=='string'||r.prompt.length>5000||typeof r.draft!=='string'||r.draft.length>10000||!r.answers||typeof r.answers!=='object'||Array.isArray(r.answers)||!value.events.some(e=>e.type==='decision.made'&&e.id===r.decisionId))throw new Error('저장된 진행 내용을 확인할 수 없어요.');
    if(r.result)r.result=evaluate(r);
    if(r.step==='result'&&!value.events.some(e=>e.type==='experience.completed'&&e.id===r.completionId&&e.decisionId===r.decisionId))throw new Error('완료 기록을 확인할 수 없어요.');}
  if(value.history.some(h=>!savedWork(h)&&(!Object.hasOwn(TASKS,h?.task)||!Array.isArray(h.missed)||h.missed.some(f=>!Object.hasOwn(FOCUS,f))||typeof h.draft!=='string'||h.draft.length>10000||typeof h.prompt!=='string'||h.prompt.length>5000||!Number.isInteger(h.correct)||!Number.isInteger(h.total))))throw new Error('이전 실습 기록을 확인할 수 없어요.');
  if(value.history.some(h=>!savedWork(h)&&h.review&&(!Array.isArray(h.review)||h.review.length>3||h.review.some(c=>typeof c.correct!=='boolean'||!TASKS[h.task].checks.some(check=>check.id===c.id&&check.focus===c.focus)))))throw new Error('이전 검토 근거를 확인할 수 없어요.');
  if(value.run){const decision=value.events.find(e=>e.type==='decision.made'&&e.id===value.run.decisionId),profile={...value.profile,generation:generationOf(decision.scope,value.profile,scope)};
    checkSavedDecision(value.run.focusDecision,TASKS[value.run.task].checks.map(c=>c.id),profile,scope);checkSavedDecision(value.run.nextDecision,Object.keys(TASKS).filter(id=>id!==value.run.task),profile,scope);}
  value.evaluation??={decisions:[],exposures:[],outcomes:[]};
  if(!temper?.evaluateOutcomes)throw new Error('실습 기록 검증 모듈을 불러오지 못했어요.');
  validateEvaluationGenerations(value,temper,at,scope);
  value=reconcileRecords(value,scope,at);
  value=upgradeRetention(value,at,scope);
  practiceEvaluation(value,temper,at,scope);
  value.evaluation=retainedEvaluation(value);
  value.manifest={...PRODUCT_MANIFEST};
  return value;
}
export function persist(storage,state,key=STORAGE_KEY){if(!state.save)return {ok:true,saved:false};try{storage.setItem(key,JSON.stringify(reconcileRecords(state)));return {ok:true,saved:true};}catch{return {ok:false,saved:false,message:'이 기기에 저장하지 못했어요. 창을 닫기 전에 결과를 내려받아 주세요.'};}}
export function exportSavedWork(state,index){const row=state.history[index];checkSavedWork(row,state.profile,state.profile.scope);return `SYNK SHIFT · ${row.kind==='recovered-work'?'업데이트 전 작성한 내용':'이전 조건에서 작성한 내용'}\n${historyLabel(row)}\n추천·평가에 사용하지 않는 작성물입니다.\n\n[내 요청문]\n${row.prompt}\n\n[직접 작성한 결과]\n${row.draft}\n`;}
export function storageRecoveryNotice(state){return state.history.some(row=>row.kind==='recovered-work')?'업데이트 전 작성한 내용은 기록에 보관했어요. 이전 답안·점수는 현재 추천에 사용하지 않습니다.':state.retention?.resetReason==='legacy-incomplete'?'작성물은 유지했어요. 이전 평가 기록의 범위가 달라 평가 집계는 새 실습부터 시작합니다.':'';}
export function exportText(state){if(!state.run)throw new Error('실습을 먼저 시작해 주세요.');const r=state.run;return `SYNK SHIFT · 가상 업무 로컬 실습\n${TASKS[r.task].name}\n상태: ${r.step==='result'?'실습 완료':'작성 중'}\n실제 AI 호출·업무 효과 검증 없음\n\n[내 요청문]\n${r.prompt}\n\n[직접 수정한 결과]\n${r.draft}\n\n[검토]\n${r.result?r.result.map(c=>`${c.label}: ${c.correct?'근거 확인 일치':'다시 확인'} — ${c.why}`).join('\n'):'검토 전'}\n\n결과 문장의 정확성은 자동 평가하지 않았습니다. 업무 사용 전 사람이 확인하세요.\n`;}
