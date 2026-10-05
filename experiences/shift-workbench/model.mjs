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
export function newState(){return {version:1,save:false,settings:{task:'meeting',goal:'clarity',minutes:5,support:'step'},profile:null,events:[],run:null,history:[],evaluation:{decisions:[],exposures:[],outcomes:[]}};}
const evaluationScope=(state,scope)=>({domain:scope.domain,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`,purpose:PRACTICE_CONTRACT.purpose});
export const PRACTICE_POLICIES=Object.freeze([{id:'fixed-check-order',version:'1'},{id:'evidence-check-order',version:'1'}]);
// The policy selects the first check in a practice. Its downstream outcome is the
// fraction of all presented checks matched on their initial review, before hints.
export function outcomeContract(state,scope=SCOPE){return {id:'shift-first-check-result',version:'1',scope:evaluationScope(state,scope),outcome:{id:'initial-review-match-ratio',kind:'numeric',range:[0,1],direction:'higher',windowMs:86400000}};}
export function practiceEvaluation(state,temper,at=now(),scope=SCOPE){
  if(!state.profile||!temper?.evaluateOutcomes)return null;
  const input={contract:outcomeContract(state,scope),...(state.evaluation||{decisions:[],exposures:[],outcomes:[]}),policies:PRACTICE_POLICIES,subjects:[scope.personId],asOf:at};
  // Validate every supplied record before excluding analytical descendants; a
  // withdrawal must not hide malformed or foreign records from boundary checks.
  const report=temper.evaluateOutcomes(input);checkEvaluationLineage(state);
  const retained=retainedEvaluation(state);
  const events=ownedEvents(state,scope),excluded=new Set(events.filter(e=>e.type==='record.excluded').map(e=>e.targetId));
  if(!excluded.size&&retained.decisions.length===input.decisions.length)return report;
  const removedDecisions=new Set(events.filter(e=>e.type==='decision.made'&&excluded.has(e.id)).map(e=>`review.${e.id}`));
  const removedResults=new Set(events.filter(e=>e.type==='experience.completed'&&excluded.has(e.id)).map(e=>`review.${e.decisionId}`));
  const decisions=retained.decisions.filter(row=>!removedDecisions.has(row.id)),ids=new Set(decisions.map(row=>row.id));
  const exposures=retained.exposures.filter(row=>ids.has(row.decisionId)),validResults=new Set(exposures.filter(row=>!removedResults.has(row.decisionId)).map(row=>row.id));
  const outcomes=retained.outcomes.filter(row=>validResults.has(row.exposureId));
  return temper.evaluateOutcomes({...input,decisions,exposures,outcomes});
}
export function recordPracticeExposure(state,at=now(),scope=SCOPE){
  if(!state.run||state.run.step!=='practice')return state;
  const evaluation=state.evaluation,decision=evaluation?.decisions.find(d=>d.id===state.run.reviewDecisionId);
  if(!decision||evaluation.exposures.some(e=>e.decisionId===decision.id))return state;
  if(decision.subject!==scope.personId||JSON.stringify(decision.scope)!==JSON.stringify(evaluationScope(state,scope))||Date.parse(at)<Date.parse(decision.at))throw new Error('다른 실습의 화면 기록이에요.');
  return {...state,evaluation:{...evaluation,exposures:[...evaluation.exposures,{id:`seen.${decision.id}`,subject:scope.personId,scope:{...decision.scope},at,decisionId:decision.id,candidateId:decision.selectedId}]}};
}
function ownedEvents(state,scope){
  if(!state.profile?.consent)return [];
  const owned={domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`};
  return state.events.filter(e=>Object.keys(owned).every(key=>e.scope?.[key]===owned[key]));
}
function effectiveCompletions(state,scope){
  const events=ownedEvents(state,scope);
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
      const checks=[...task.checks];if(metric.policy.id==='evidence-check-order')checks.sort((a,b)=>Number(b.focus===first.focus)-Number(a.focus===first.focus));
      if(!sameList(h.review.map(c=>c.id),checks.slice(0,count).map(c=>c.id)))brokenHistory();
    }
    if(state.run?.decisionId===decision.id){const checked=evaluate(state.run);if(!sameList(h.review.map(c=>c.id),state.run.checkIds)||h.review.some((c,i)=>c.correct!==checked[i].correct))brokenHistory();}
  }
  return {summary:h,completion,decision};
}
function checkEvaluationLineage(state){
  const lineage=state.history.map(h=>historyLineage(state,h)),evaluation=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  const decisions=new Map();
  for(const metric of evaluation.decisions){
    const decision=state.events.find(e=>e.type==='decision.made'&&`review.${e.id}`===metric.id),task=TASKS[String(decision?.variant||'').split('.')[0]];
    if(!decision||decision.experienceId!=='shift-workbench'||!task||metric.at!==decision.at||!sameList(metric.candidateIds,task.checks.map(c=>c.id)))brokenHistory();
    const summary=lineage.find(row=>row.decision.id===decision.id)?.summary;
    if(summary?.review&&metric.selectedId!==summary.review[0].id)brokenHistory();
    if(state.run?.decisionId===decision.id&&metric.selectedId!==state.run.checkIds[0])brokenHistory();
    decisions.set(metric.id,decision);
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
function retainedEvaluation(state){
  const evaluation=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  const completed=new Set(state.events.filter(e=>e.type==='experience.completed').map(e=>`review.${e.decisionId}`));
  const summarized=new Set(state.history.map(h=>`review.${historyLineage(state,h).decision.id}`));
  // A completed result leaves with its detailed summary. Keep its entire
  // analytical chain together so deletion cannot turn it into a missing result.
  const decisions=evaluation.decisions.filter(row=>!completed.has(row.id)||summarized.has(row.id)),ids=new Set(decisions.map(row=>row.id));
  const exposures=evaluation.exposures.filter(row=>ids.has(row.decisionId)),seen=new Set(exposures.map(row=>row.id));
  return {decisions,exposures,outcomes:evaluation.outcomes.filter(row=>seen.has(row.exposureId))};
}
export function practiceObservations(state,scope=SCOPE){
  if(!state.profile?.consent)return [];
  const owned={domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`};
  const completions=effectiveCompletions(state,scope);
  return state.history.flatMap(h=>{
    const completion=completions.find(e=>h.completionId?e.id===h.completionId:e.at===h.at&&e.variant?.startsWith(`${h.task}.`));
    if(!completion)return [];
    historyLineage(state,h);
    // Old records only identify missed checks. An unmentioned focus is unknown,
    // because a short exercise may never have presented it.
    const fields=h.review?[...new Set(h.review.map(c=>c.focus))]:h.missed;
    return fields.map(field=>{
      const reviewed=h.review?.filter(c=>c.focus===field);
      return {id:`${completion.id}.${field}`,scope:{...owned},contract:{id:PRACTICE_CONTRACT.id,version:PRACTICE_CONTRACT.version,purpose:PRACTICE_CONTRACT.purpose},field,value:reviewed?.every(c=>c.correct)?'correct':'incorrect',source:'observed',
        independentKey:`${completion.id}.${field}`,at:completion.at,recordedAt:completion.recordedAt,
        refs:[completion.id,...(reviewed||[]).map(c=>`${h.task}.${c.id}`)]};
    });
  });
}
function reviewDecision(state,candidates,engine,at,scope){
  const domain=engine?.domain||globalThis.SynkAtlasDomain;
  if(!domain?.decide)throw new Error('검토 기록 모듈을 불러오지 못했어요. 새로고침해 주세요.');
  return domain.decide({contract:PRACTICE_CONTRACT,scope:{domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${state.profile.generation}`},observations:practiceObservations(state,scope),at,candidates});
}
const reviewReason=ranked=>ranked?.reasons?.find(reason=>reason.value==='incorrect'&&reason.candidateValue==='incorrect'&&reason.contribution>0);
function currentReviewReason(state,ranked){
  const reason=reviewReason(ranked),valid=new Set(practiceObservations(state,state.profile?.scope||SCOPE).map(row=>row.id));
  return reason?.evidence.length&&reason.evidence.every(id=>valid.has(id))?reason:null;
}
export function decisionEvidence(state,decision){
  const reason=currentReviewReason(state,decision?.selected);
  if(!reason)return [];
  const completions=effectiveCompletions(state,state.profile.scope);
  return reason.evidence.flatMap(id=>{
    const summary=state.history.find(h=>completions.some(e=>(h.completionId?e.id===h.completionId:e.at===h.at&&e.variant?.startsWith(`${h.task}.`))&&id===`${e.id}.${reason.field}`));
    return summary?[{id,task:summary.task,at:summary.at,focus:reason.field,correct:summary.review?.filter(c=>c.focus===reason.field).every(c=>c.correct)??!summary.missed.includes(reason.field),assisted:summary.assisted}]:[];
  });
}
export function practiceBasis(state){
  const records=decisionEvidence(state,state.run?.focusDecision),lines=records.map(r=>`${new Date(r.at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})} · ${TASKS[r.task].name} · ${FOCUS[r.focus]}: ${r.correct?'판단과 근거 일치':'다시 확인'} (${r.assisted?'안내 사용':'스스로 검토'})`);
  const uncertain=(state.run?.focusDecision?.understanding?.needsCheck||[]).filter(f=>TASKS[state.run.task].checks.some(c=>c.focus===f));
  if(uncertain.length)lines.push(`${uncertain.map(f=>FOCUS[f]).join(', ')}: 기록이 충분하지 않거나 결과가 엇갈려 순서에 반영하지 않았어요.`);
  return lines;
}
export function practiceReason(state){
  const run=state.run;
  if(!run)return '';
  // A cached presentation may outlive the evidence it cited. Keep its original
  // time/support explanation, but stop presenting a withdrawn review as current.
  return run.focusDecision&&!currentReviewReason(state,run.focusDecision.selected)?run.reason.split(' 지난 실습의 ')[0]:run.reason;
}
export function startRun(state,settings,engine,at=now(),scope=SCOPE){
  if(!Object.hasOwn(TASKS,settings.task)||!['clarity','work','prepare'].includes(settings.goal)||![5,10,15].includes(settings.minutes)||!['step','independent'].includes(settings.support))throw new Error('실습 조건을 다시 선택해 주세요.');
  let profile = state.profile || engine.createProfile({scope,at});
  const retired=Object.fromEntries(['audio','experience'].filter(key=>Object.hasOwn(profile.values,key)).map(key=>[key,null]));
  if(Object.keys(retired).length)profile=engine.updateProfile(profile,{values:retired},at);
  profile=engine.updateProfile(profile,{consent:true,values:{goal:settings.goal,minutes:settings.minutes,support:settings.support}},at);
  const candidates=[{id:`${settings.task}.quick`,minutes:5,pace:'short',goals:['clarity'],supports:['step','independent']},
    {id:`${settings.task}.full`,minutes:10,pace:'standard',goals:['work'],supports:['step','independent']},
    {id:`${settings.task}.deep`,minutes:15,pace:'deep',goals:['prepare'],supports:['step','independent']}];
  const selection=engine.selectPersonalization({profile,scope,candidates,experienceId:'shift-workbench',events:state.events,at});
  if(selection.plan.status!=='ready')throw new Error('지금 조건에 맞는 실습을 선택하지 못했어요.');
  const variant=selection.plan.selected.id.split('.').at(-1);
  let checks=[...TASKS[settings.task].checks];
  const focusDecision=reviewDecision({...state,profile:selection.profile,events:selection.events},checks.map(c=>({id:c.id,features:{[c.focus]:'incorrect'}})),engine,at,scope);
  const focus=reviewReason(focusDecision.selected)?.field;
  if(focus)checks.sort((a,b)=>Number(b.focus===focus)-Number(a.focus===focus));
  checks=checks.slice(0,variant==='quick'?2:3);
  const next={...state,settings:{...settings},profile:selection.profile,events:selection.events,run:{task:settings.task,goal:settings.goal,variant,checkIds:checks.map(c=>c.id),decisionId:selection.plan.id,focusDecision,reviewDecisionId:`review.${selection.plan.id}`,startedAt:at,step:'practice',prompt:'',answers:{},result:null,draft:TASKS[settings.task].sample,reviewed:false,feedback:null,reason:`${settings.minutes}분 안에서 ${variant==='quick'?'핵심 2개':'전체 3개'} 항목을 ${selection.presentation.support==='step'?'안내와 함께':'스스로'} 확인합니다.${variant==='deep'?' 검토 후 실제 업무에 적용할 확인 항목도 정리해요.':''}${focus?' 지난 실습의 '+FOCUS[focus]+' 항목부터 살펴봐요. 가상 자료의 확인 기록이며 업무 능력 평가는 아닙니다.':''}`,support:selection.presentation.support}};
  const boundary=evaluationScope(next,scope),prior=state.evaluation||{decisions:[],exposures:[],outcomes:[]};
  const decisions=prior.decisions.filter(row=>row.subject===scope.personId&&JSON.stringify(row.scope)===JSON.stringify(boundary)).slice(-199),ids=new Set(decisions.map(row=>row.id));
  const exposures=prior.exposures.filter(row=>ids.has(row.decisionId)),seen=new Set(exposures.map(row=>row.id));
  next.evaluation={decisions,exposures,outcomes:prior.outcomes.filter(row=>seen.has(row.exposureId))};
  next.evaluation.decisions.push({id:next.run.reviewDecisionId,subject:scope.personId,scope:boundary,contract:{id:'shift-first-check-result',version:'1'},at,policy:{...PRACTICE_POLICIES[focus?1:0]},candidateIds:TASKS[settings.task].checks.map(c=>c.id),selectedId:checks[0].id});
  return next;
}
export function nextTaskSuggestion(state){
  const ids=Object.keys(TASKS),current=state.run?.task,index=ids.indexOf(current);
  if(index<0)return {task:ids[0],focus:null};
  const ordered=ids.slice(index+1).concat(ids.slice(0,index));
  if(state.run?.nextDecision){const selected=state.run.nextDecision.selected,reason=currentReviewReason(state,selected);return {task:reason?selected.id:ordered[0]||ids[0],focus:reason?.field||null};}
  const missed=[...new Set((state.run?.result||[]).filter(check=>!check.correct).map(check=>check.focus))];
  for(const focus of missed){const task=ordered.find(id=>TASKS[id].checks.some(check=>check.focus===focus));if(task)return {task,focus};}
  return {task:ordered[0]||ids[0],focus:null};
}
export function evaluate(run){
  const task=TASKS[run?.task];if(!task)throw new Error('실습을 먼저 시작해 주세요.');
  return run.checkIds.map(id=>{const check=task.checks.find(c=>c.id===id),answer=run.answers[id];return {...check,submitted:answer||null,answered:!!answer?.kind&&!!answer?.source,correct:answer?.kind===check.answer&&answer?.source===check.source};});
}
export function checkPrompt(text){return [{label:'어떤 결과물이 필요한지',met:/(목록|요약|기획|운영안|실행안|표|정리|보고)/.test(text)},{label:'제공된 자료를 근거로 쓸지',met:/(자료|원문|M[1-3]|R[1-3]|P[1-3]|근거)/i.test(text)},{label:'빠뜨리거나 추측하지 않을 조건',met:/(기한|담당|승인|추측|한계|측정|예산|성공|제약|확인|금지|만들지)/.test(text)}];}
export function completeRun(state,engine,at=now(),scope=SCOPE){
  if(!state.run||state.run.step==='result')throw new Error('진행 중인 실습이 없어요.');
  const run=state.run,checks=evaluate(run);
  if(run.prompt.trim().length<20)throw new Error('요청문을 20자 이상 작성해 주세요.');
  if(checks.some(c=>!c.answered))throw new Error('모든 항목의 판단과 자료 번호를 골라 주세요.');
  if(!run.result)throw new Error('검토 결과를 먼저 확인해 주세요.');
  if(run.draft.trim().length<30||run.draft.trim()===TASKS[run.task].sample.trim())throw new Error('예시 결과를 근거에 맞게 직접 수정해 주세요.');
  if(!run.reviewed)throw new Error('수정한 결과를 직접 읽고 확인해 주세요.');
  const events=engine.recordCompletion({profile:state.profile,scope,events:state.events,decisionId:run.decisionId,at});
  const completion=events.find(e=>e.type==='experience.completed'&&e.decisionId===run.decisionId);
  const summary={task:run.task,at,completionId:completion.id,decisionId:run.decisionId,correct:run.result.filter(c=>c.correct).length,total:run.result.length,missed:[...new Set(run.result.filter(c=>!c.correct).map(c=>c.focus))],review:run.result.map(c=>({id:c.id,focus:c.focus,correct:c.correct})),prompt:run.prompt,draft:run.draft,assisted:run.support==='step'};
  const next={...state,events,run:{...run,step:'result',completionId:completion.id,completedAt:at},history:[...state.history,summary].slice(-20)};
  const ids=Object.keys(TASKS),index=ids.indexOf(run.task),ordered=ids.slice(index+1).concat(ids.slice(0,index));
  next.run.nextDecision=reviewDecision(next,ordered.map(id=>({id,features:Object.fromEntries(TASKS[id].checks.map(c=>[c.focus,'incorrect']))})),engine,at,scope);
  const exposure=next.evaluation?.exposures.find(e=>e.decisionId===run.reviewDecisionId);
  if(exposure)next.evaluation={...next.evaluation,outcomes:[...next.evaluation.outcomes,{id:`result.${run.reviewDecisionId}`,subject:scope.personId,scope:{...exposure.scope},at,exposureId:exposure.id,value:summary.correct/summary.total}]};
  next.evaluation=retainedEvaluation(next);
  return next;
}
export function giveFeedback(state,value,engine,at=now(),scope=SCOPE){
  if(!state.run?.completionId||state.run.feedback)throw new Error('완료한 실습에 한 번만 피드백할 수 있어요.');
  const events=engine.recordFeedback({profile:state.profile,scope,events:state.events,completionId:state.run.completionId,value,at});
  return {...state,events,run:{...state.run,feedback:value}};
}
function checkSavedDecision(decision,ids,profile,scope){
  if(!decision)return;
  const owner={domain:scope.domain,subject:scope.personId,workspace:`p.${scope.productId}:c.${scope.contextId}:g.${profile.generation}`};
  const ranking=rank=>rank&&ids.includes(rank.id)&&Number.isFinite(rank.score)&&Array.isArray(rank.reasons)&&rank.reasons.length<=3&&rank.reasons.every(reason=>Object.hasOwn(FOCUS,reason.field)&&['correct','incorrect'].includes(reason.value)&&['correct','incorrect'].includes(reason.candidateValue)&&Number.isFinite(reason.contribution)&&Array.isArray(reason.evidence)&&reason.evidence.length<=60&&reason.evidence.every(id=>typeof id==='string'&&id.length<=120));
  if(decision.version!=='core-domain-1'||Object.keys(owner).some(key=>decision.scope?.[key]!==owner[key])||['id','version','purpose'].some(key=>decision.contract?.[key]!==PRACTICE_CONTRACT[key])||!Array.isArray(decision.ranked)||decision.ranked.length>ids.length||decision.ranked.some(rank=>!ranking(rank))||(decision.selected&&!ranking(decision.selected))||!Array.isArray(decision.understanding?.needsCheck)||decision.understanding.needsCheck.some(f=>!Object.hasOwn(FOCUS,f)))throw new Error('저장된 추천 근거를 확인할 수 없어요.');
}
export function restore(text,engine,scope=SCOPE,temper){
  if(typeof text!=='string'||text.length>1000000)throw new Error('저장된 실습을 읽을 수 없어요.');
  const value=JSON.parse(text);
  if(value?.version!==1||value.save!==true||!Array.isArray(value.events)||value.events.length>5000||!Array.isArray(value.history)||value.history.length>20)throw new Error('지원하지 않는 저장 형식이에요.');
  if(!value.profile||['personId','productId','contextId','domain'].some(key=>value.profile.scope?.[key]!==scope[key]))throw new Error('다른 실습의 기록이에요.');
  engine.validateProfile(value.profile);
  if(Object.keys(value.profile.values).some(key=>!['goal','minutes','support'].includes(key)))throw new Error('이전 시험판의 맞춤 조건입니다. 초기화한 뒤 직접 선택해 주세요.');
  engine.selectPersonalization({profile:value.profile,scope,candidates:[{id:'validate',minutes:1,pace:'short'}],experienceId:'validate',events:value.events,at:now()});
  if(!Object.hasOwn(TASKS,value.settings?.task))throw new Error('실습 종류를 확인할 수 없어요.');
  if(value.run){const r=value.run,task=TASKS[r.task];if(!task||!['practice','result'].includes(r.step)||!Array.isArray(r.checkIds)||r.checkIds.length<1||r.checkIds.length>3||new Set(r.checkIds).size!==r.checkIds.length||r.checkIds.some(id=>!task.checks.some(c=>c.id===id))||typeof r.prompt!=='string'||r.prompt.length>5000||typeof r.draft!=='string'||r.draft.length>10000||!r.answers||typeof r.answers!=='object'||Array.isArray(r.answers)||!value.events.some(e=>e.type==='decision.made'&&e.id===r.decisionId))throw new Error('저장된 진행 내용을 확인할 수 없어요.');
    if(r.result)r.result=evaluate(r);
    if(r.step==='result'&&!value.events.some(e=>e.type==='experience.completed'&&e.id===r.completionId&&e.decisionId===r.decisionId))throw new Error('완료 기록을 확인할 수 없어요.');}
  if(value.history.some(h=>!Object.hasOwn(TASKS,h?.task)||!Array.isArray(h.missed)||h.missed.some(f=>!Object.hasOwn(FOCUS,f))||typeof h.draft!=='string'||typeof h.prompt!=='string'||!Number.isInteger(h.correct)||!Number.isInteger(h.total)))throw new Error('이전 실습 기록을 확인할 수 없어요.');
  if(value.history.some(h=>h.review&&(!Array.isArray(h.review)||h.review.length>3||h.review.some(c=>typeof c.correct!=='boolean'||!TASKS[h.task].checks.some(check=>check.id===c.id&&check.focus===c.focus)))))throw new Error('이전 검토 근거를 확인할 수 없어요.');
  if(value.run){checkSavedDecision(value.run.focusDecision,TASKS[value.run.task].checks.map(c=>c.id),value.profile,scope);checkSavedDecision(value.run.nextDecision,Object.keys(TASKS).filter(id=>id!==value.run.task),value.profile,scope);}
  value.evaluation??={decisions:[],exposures:[],outcomes:[]};
  if(!temper?.evaluateOutcomes)throw new Error('실습 기록 검증 모듈을 불러오지 못했어요.');
  practiceEvaluation(value,temper,now(),scope);
  value.evaluation=retainedEvaluation(value);
  return value;
}
export function persist(storage,state,key=STORAGE_KEY){if(!state.save)return {ok:true,saved:false};try{storage.setItem(key,JSON.stringify(state));return {ok:true,saved:true};}catch{return {ok:false,saved:false,message:'이 기기에 저장하지 못했어요. 창을 닫기 전에 결과를 내려받아 주세요.'};}}
export function exportText(state){if(!state.run)throw new Error('실습을 먼저 시작해 주세요.');const r=state.run;return `SYNK SHIFT · 가상 업무 로컬 실습\n${TASKS[r.task].name}\n상태: ${r.step==='result'?'실습 완료':'작성 중'}\n실제 AI 호출·업무 효과 검증 없음\n\n[내 요청문]\n${r.prompt}\n\n[직접 수정한 결과]\n${r.draft}\n\n[검토]\n${r.result?r.result.map(c=>`${c.label}: ${c.correct?'근거 확인 일치':'다시 확인'} — ${c.why}`).join('\n'):'검토 전'}\n\n결과 문장의 정확성은 자동 평가하지 않았습니다. 업무 사용 전 사람이 확인하세요.\n`;}
