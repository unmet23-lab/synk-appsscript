// Product storage compatibility. This is a version marker, not authentication.
// Core still checks identities and event links; obsolete analytics never become
// current observations just because their authored text can be recovered.
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const fail=()=>{throw new Error('저장된 작성물의 소유자와 원기록을 확인할 수 없어요.');};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const LEGACY_MANIFEST=Object.freeze({format:1,content:'a39422a3',reviewVersion:'1',outcomeVersion:'1',orderVersion:'2'});
const legacyNames={meeting:'회의를 실행으로',research:'자료를 믿기 전에',planning:'기획을 검증하기'};
const legacyDraftHashes={meeting:'8b046789',research:'6e08745b',planning:'f7a3941c'};
function fingerprint(text){let hash=2166136261;for(const char of text){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
export function productManifest(tasks,{reviewVersion='1',outcomeVersion='1',orderVersion='2'}={}){
  return {format:1,content:fingerprint(JSON.stringify(tasks)),reviewVersion,outcomeVersion,orderVersion};
}
function checkManifest(manifest){
  if(!manifest||Object.keys(manifest).length!==5||manifest.format!==1||!/^([a-f0-9]{8})$/.test(manifest.content)||!['reviewVersion','outcomeVersion','orderVersion'].every(key=>token(manifest[key])))fail();
}
export function workLabel(row,tasks){return row.taskName||tasks[row.task]?.name||legacyNames[row.task]||`이전 실습 (${row.task})`;}
export function validateRecoveredWork(row,profile,scope,at){
  const keys=['kind','scope','sourceGeneration','sourceManifest','task','taskName','at','prompt','draft','status','recoveredAt'];
  if(!row||Object.keys(row).length!==keys.length||keys.some(key=>!Object.hasOwn(row,key))||row.kind!=='recovered-work'||!sameScope(row.scope,scope)
    ||!Number.isSafeInteger(row.sourceGeneration)||row.sourceGeneration<0||row.sourceGeneration>profile.generation||!token(row.task)
    ||typeof row.taskName!=='string'||row.taskName.length>200||!row.taskName.trim()||!['completed','in-progress'].includes(row.status)
    ||!instant(row.at)||!instant(row.recoveredAt)||Date.parse(row.at)>Date.parse(row.recoveredAt)||Date.parse(row.recoveredAt)>Date.parse(at))fail();
  checkManifest(row.sourceManifest);checkText(row);
}
const sameScope=(a,b)=>a&&Object.keys(a).length===4&&Object.keys(b).every(key=>a[key]===b[key]);
function checkText(row){if(typeof row.prompt!=='string'||row.prompt.length>5000||typeof row.draft!=='string'||row.draft.length>10000)fail();}
function generation(owner,profile,scope,purpose=false){
  const prefix=`p.${scope.productId}:c.${scope.contextId}:g.`,suffix=owner?.workspace?.slice(prefix.length);
  if(!owner||owner.domain!==scope.domain||(purpose?owner.purpose!=='fictional-check-review':owner.subject!==scope.personId)
    ||!owner.workspace?.startsWith(prefix)||!/^(0|[1-9]\d*)$/.test(suffix)||!Number.isSafeInteger(Number(suffix))||Number(suffix)>profile.generation)fail();
  return Number(suffix);
}
function checkTime(row,at,parent){
  if(!instant(row.at)||!instant(row.recordedAt??row.at)||Date.parse(row.recordedAt??row.at)<Date.parse(row.at)||Date.parse(row.recordedAt??row.at)>Date.parse(at)
    ||(parent&&(Date.parse(row.at)<Date.parse(parent.at)||Date.parse(row.recordedAt??row.at)<Date.parse(parent.recordedAt??parent.at))))fail();
}
export function recoverProductUpgrade(value,{manifest,tasks,scope,engine,at}){
  const source=value.manifest===undefined?LEGACY_MANIFEST:value.manifest;checkManifest(source);checkManifest(manifest);
  if(Object.keys(manifest).every(key=>source[key]===manifest[key]))return {state:value,recovered:false};
  const profile=value.profile;engine.validateProfile(profile);
  if(!sameScope(profile.scope,scope)||Date.parse(profile.updatedAt)>Date.parse(at))fail();
  engine.selectPersonalization({profile,scope,candidates:[{id:'validate',minutes:1,pace:'short'}],experienceId:'validate',events:value.events,at});
  const groups=new Set(value.events.map(e=>generation(e.scope,profile,scope))),allIds=new Set();
  // Validate references even in a generation that no longer has consent.
  for(const event of value.events){if(allIds.has(event.id))fail();allIds.add(event.id);checkTime(event,at);}
  for(const gen of groups)engine.selectPersonalization({profile:{...profile,generation:gen,consent:true,status:'active'},scope,candidates:[{id:'validate',minutes:1,pace:'short'}],experienceId:'validate',events:value.events.filter(e=>generation(e.scope,profile,scope)===gen),at});
  const decisions=value.events.filter(e=>e.type==='decision.made'),completions=value.events.filter(e=>e.type==='experience.completed');
  if(value.visits){
    if(!Array.isArray(value.visits)||value.visits.length>100)fail();
    for(const visit of value.visits){
      generation(visit.scope,profile,scope);const decision=decisions.find(d=>d.id===visit.decisionId);
      if(visit.kind!=='displayed'||!token(visit.task)||!decision||decision.scope.workspace!==visit.scope.workspace||!decision.variant?.startsWith(`${visit.task}.`))fail();checkTime(visit,at,decision);
    }
  }
  function original(task,decisionId,completionId,completedAt){
    const matching=completedAt?completions.filter(e=>completionId?e.id===completionId:e.at===completedAt&&e.variant?.startsWith(`${task}.`)):[];
    if(completedAt&&matching.length!==1)fail();
    const completion=matching[0],decision=decisions.find(e=>e.id===(decisionId||completion?.decisionId));
    if(!token(task)||!decision||decision.experienceId!=='shift-workbench'||!decision.variant?.startsWith(`${task}.`)
      ||(completion&&(completion.decisionId!==decision.id||completion.experienceId!==decision.experienceId||completion.variant!==decision.variant||completion.at!==completedAt)))fail();
    return {decision,completion};
  }
  const histories=new Map(),archives=[];
  const label=row=>row.taskName||(source.content===LEGACY_MANIFEST.content?legacyNames[row.task]:null)||workLabel(row,tasks);
  const archive=(row,status,decision)=>({kind:'recovered-work',scope:{...scope},sourceGeneration:generation(decision.scope,profile,scope),sourceManifest:{...source},task:row.task,taskName:label(row),at:status==='completed'?row.at:row.startedAt,prompt:row.prompt,draft:row.draft,status,recoveredAt:at});
  for(const row of value.history){
    checkText(row);
    if(row.kind==='recovered-work'){validateRecoveredWork(row,profile,scope,at);archives.push(row);continue;}
    if(row.kind==='saved-work'){
      if(Object.keys(row).length!==8||!sameScope(row.scope,scope)||!Number.isSafeInteger(row.sourceGeneration)||row.sourceGeneration<0||row.sourceGeneration>=profile.generation||!token(row.task)||!instant(row.at)||Date.parse(row.at)>Date.parse(profile.updatedAt)||!['completed','in-progress'].includes(row.status))fail();
      archives.push({kind:'recovered-work',scope:{...scope},sourceGeneration:row.sourceGeneration,sourceManifest:{...source},task:row.task,taskName:label(row),at:row.at,prompt:row.prompt,draft:row.draft,status:row.status,recoveredAt:at});continue;
    }
    const {decision,completion}=original(row.task,row.decisionId,row.completionId,row.at);
    if(histories.has(decision.id)||!Number.isInteger(row.total)||row.total<1||row.total>30||!Number.isInteger(row.correct)||row.correct<0||row.correct>row.total||!Array.isArray(row.missed)||row.missed.some(f=>!token(f)))fail();
    if(row.review&&(!Array.isArray(row.review)||row.review.length!==row.total||new Set(row.review.map(c=>c.id)).size!==row.total||row.review.some(c=>!token(c.id)||!token(c.focus)||typeof c.correct!=='boolean')||row.correct!==row.review.filter(c=>c.correct).length
      ||!same([...new Set(row.review.filter(c=>!c.correct).map(c=>c.focus))].sort(),[...row.missed].sort())))fail();
    histories.set(decision.id,{row,completion});archives.push(archive(row,'completed',decision));
  }
  const evaluation=value.evaluation||{decisions:[],exposures:[],outcomes:[]};
  if(Object.keys(evaluation).some(k=>!['decisions','exposures','outcomes'].includes(k))||Object.values(evaluation).some(rows=>!Array.isArray(rows)||rows.length>5000))fail();
  for(const rows of Object.values(evaluation))for(const row of rows){generation(row.scope,profile,scope,true);if(row.subject!==scope.personId)fail();checkTime(row,at);if(row.contract&&(row.contract.id!=='shift-first-check-result'||!token(row.contract.version)))fail();}
  const metrics=new Map(),seen=new Map();
  for(const metric of evaluation.decisions){
    const decision=decisions.find(e=>`review.${e.id}`===metric.id),summary=histories.get(decision?.id)?.row;
    if(metrics.has(metric.id)||!decision||decision.experienceId!=='shift-workbench'||metric.at!==decision.at||metric.scope.workspace!==decision.scope.workspace||!metric.policy||!token(metric.policy.id)||!token(metric.policy.version)
      ||!Array.isArray(metric.candidateIds)||!metric.candidateIds.length||metric.candidateIds.length>30||new Set(metric.candidateIds).size!==metric.candidateIds.length||metric.candidateIds.some(id=>!token(id))||!metric.candidateIds.includes(metric.selectedId)
      ||(summary?.review&&metric.selectedId!==summary.review[0].id))fail();
    metrics.set(metric.id,metric);
  }
  for(const exposure of evaluation.exposures){const parent=metrics.get(exposure.decisionId);if(seen.has(exposure.id)||!parent||exposure.candidateId!==parent.selectedId||exposure.scope.workspace!==parent.scope.workspace)fail();checkTime(exposure,at,parent);seen.set(exposure.id,exposure);}
  const outcomeIds=new Set(),outcomeExposures=new Set();
  for(const outcome of evaluation.outcomes){
    const exposure=seen.get(outcome.exposureId),metric=metrics.get(exposure?.decisionId),decision=decisions.find(e=>`review.${e.id}`===metric?.id),history=histories.get(decision?.id),completion=completions.find(e=>e.decisionId===decision?.id);
    if(outcomeIds.has(outcome.id)||outcomeExposures.has(outcome.exposureId)||!exposure||!completion||outcome.scope.workspace!==exposure.scope.workspace||outcome.at!==completion.at||!Number.isFinite(outcome.value)||outcome.value<0||outcome.value>1||(history&&outcome.value!==history.row.correct/history.row.total))fail();checkTime(outcome,at,exposure);outcomeIds.add(outcome.id);outcomeExposures.add(outcome.exposureId);
  }
  if(value.run){
    const run=value.run;checkText(run);if(!['practice','result'].includes(run.step)||!instant(run.startedAt)||!Array.isArray(run.checkIds)||!run.checkIds.length||run.checkIds.length>30||new Set(run.checkIds).size!==run.checkIds.length||run.checkIds.some(id=>!token(id)))fail();
    const {decision}=original(run.task,run.decisionId,run.step==='result'?run.completionId:null,run.step==='result'?run.completedAt:null);
    if(run.startedAt!==decision.at||run.variant!==decision.variant.slice(run.task.length+1))fail();
    for(const cached of [run.focusDecision,run.nextDecision])if(cached){generation(cached.scope,profile,scope);if(cached.scope.workspace!==decision.scope.workspace||cached.contract?.id!=='shift-practice-review'||cached.contract?.purpose!=='fictional-check-review'||!token(cached.contract?.version))fail();checkTime(cached,at);}
    const metric=metrics.get(run.reviewDecisionId);if(metric&&metric.selectedId!==run.checkIds[0])fail();
    if(run.step==='result'){
      const history=histories.get(decision.id);if(!history||!same(history.row.review?.map(c=>c.id)||run.checkIds,run.checkIds))fail();
    }else {
      const unchanged=typeof run.initialDraft==='string'?run.draft===run.initialDraft:source.content===LEGACY_MANIFEST.content&&legacyDraftHashes[run.task]?fingerprint(run.draft)===legacyDraftHashes[run.task]:run.draft===tasks[run.task]?.sample;
      if(run.prompt||(!unchanged&&run.draft.trim()))archives.push(archive(run,'in-progress',decision));
    }
  }
  for(const row of archives)validateRecoveredWork(row,profile,scope,at);
  const defaults={task:Object.keys(tasks)[0],goal:'clarity',minutes:5,support:'step'},settings={...defaults,...value.settings};
  if(!Object.hasOwn(tasks,settings.task))settings.task=defaults.task;
  if(!['clarity','work','prepare'].includes(settings.goal))settings.goal=defaults.goal;
  if(![5,10,15].includes(settings.minutes))settings.minutes=defaults.minutes;
  if(!['step','independent'].includes(settings.support))settings.support=defaults.support;
  return {recovered:true,state:{version:1,save:true,settings,profile,manifest:{...manifest},events:[],run:null,history:archives,visits:[],retention:{version:'attempts-20-1',from:null,resetReason:null},evaluation:{decisions:[],exposures:[],outcomes:[]}}};
}
