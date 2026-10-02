import {gameContent,gameProfiles,gameItems} from './game-catalog.mjs';
import {gameTargetFor} from './model.mjs';
const copy=value=>structuredClone(value);
const fail=(code,message,status=409)=>{throw Object.assign(new Error(message),{code,status});};
const publicRun=r=>r?copy(Object.fromEntries(Object.entries(r).filter(([k])=>!['eventIds','idempotencyKey','fingerprint','learnerId','sharingRevision','profiles'].includes(k)))):null;
const belongs=(r,l)=>r.learnerId===l.id&&r.sharingRevision===l.sharing.revision;
function validAssignment(state,r,l){const a=state.assignments.find(a=>a.id===r.assignmentId);return !r.assignmentId||a&&a.status==='active'&&a.revision===r.assignmentRevision&&a.learnerIds.includes(l.id)&&a.deliveryRevisions?.[l.id]===l.sharing.revision;}
export function runsFor(state,l){const rows=(state.learningRuns||[]).filter(r=>belongs(r,l));return {activeRun:publicRun(rows.find(r=>r.status==='active'&&r.target&&validAssignment(state,r,l))),runs:rows.map(publicRun)};}
export function startRun(state,l,payload,now){
  const key=payload.idempotencyKey;if(typeof key!=='string'||!/^[\w.:-]{1,100}$/.test(key))fail('INVALID_INPUT','수행 요청 번호를 확인해 주세요.',400);
  const a=payload.assignmentId&&state.assignments.find(a=>a.id===payload.assignmentId);
  if(payload.assignmentId&&(!a||!a.learnerIds.includes(l.id)||a.deliveryRevisions?.[l.id]!==l.sharing.revision))fail('FORBIDDEN','본인의 현재 과제만 시작할 수 있어요.',403);
  if(a&&(a.status!=='active'||a.revision!==payload.revision))fail('REVISION_CONFLICT','과제가 바뀌었어요. 다시 불러와 주세요.');
  if(!a&&payload.revision!==l.sharing.revision)fail('REVISION_CONFLICT','공유 상태가 바뀌었어요.');
  const c=a?.taskSnapshot||gameContent(payload.contentId);if(c?.kind!=='game')fail('CONTENT_NOT_ASSIGNABLE','실행할 학습 활동을 확인해 주세요.',400);
  state.learningRuns??=[];const fingerprint=JSON.stringify([a?.id||null,a?.revision||null,c.id,l.sharing.revision]);
  const prior=state.learningRuns.find(r=>r.learnerId===l.id&&r.idempotencyKey===key);
  if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','같은 요청으로 다른 수행을 시작할 수 없어요.');if(!prior.target||prior.status==='stopped'||prior.status==='invalidated')fail('RUN_ENDED','이 시작 요청은 이미 끝났어요. 과제를 다시 선택해 주세요.');return {ok:true,run:publicRun(prior),duplicate:true};}
  if(a&&state.submissions.some(s=>s.assignmentId===a.id&&s.learnerId===l.id))fail('ALREADY_SUBMITTED','완료한 과제입니다. 자유 연습으로 다시 풀 수 있어요.');
  const active=state.learningRuns.find(r=>belongs(r,l)&&r.status==='active'&&r.fingerprint===fingerprint&&validAssignment(state,r,l));
  if(active?.target)return {ok:true,run:publicRun(active),duplicate:true};
  for(const r of state.learningRuns.filter(r=>belongs(r,l)&&r.status==='active'))r.status='stopped';
  const resumable=a&&state.learningRuns.filter(r=>belongs(r,l)&&r.target&&r.status==='stopped'&&r.fingerprint===fingerprint).at(-1);
  if(resumable){resumable.status='active';return {ok:true,run:publicRun(resumable),resumed:true};}
  const target=copy(a?.targets?.[l.id]||gameTargetFor(state,{...l,evidence:l.evidence.filter(e=>e.sharingRevision===l.sharing.revision)},c,now));
  if(a){a.targets??={};a.targets[l.id]??=copy(target);}
  const run={id:`run-${state.nextId++}`,learnerId:l.id,sharingRevision:l.sharing.revision,assignmentId:a?.id||null,assignmentRevision:a?.revision||null,contentId:c.id,gameId:c.gameId,href:c.href,target,requiredAttempts:target.requiredAttempts,profiles:gameProfiles(c),status:'active',startedAt:new Date(now).toISOString(),progress:{total:0,correct:0,assisted:0,independent:0,excluded:0},eventIds:[],idempotencyKey:key,fingerprint};
  state.learningRuns.push(run);return {ok:true,run:publicRun(run)};
}
export function stopRun(state,l,id){const r=(state.learningRuns||[]).find(r=>r.id===id&&belongs(r,l));if(!r)fail('FORBIDDEN','이 수행을 종료할 수 없어요.',403);if(r.status==='active')r.status='stopped';return {ok:true,run:publicRun(r)};}
// Ownership is attached at emission, not upload time. A stopped run may drain its outbox.
export function bindRunEvents(state,l,runId,events){
  const r=runId==null?null:(state.learningRuns||[]).find(r=>r.id===runId&&belongs(r,l));
  if(runId!=null&&!r)fail('FORBIDDEN','다른 학생 또는 이전 공유의 수행입니다.',403);
  for(const e of events){const old=l.events.find(row=>row.revision===l.sharing.revision&&row.payload.id===e.id);if(old&&(old.runId||null)!==(runId||null))fail('EVENT_RUN_CONFLICT','이미 저장한 기록의 수행을 바꿀 수 없어요.');
    if(r&&Date.parse(e.at)<Date.parse(r.startedAt))fail('EVENT_BEFORE_RUN','수행 시작 전 기록을 과제에 붙일 수 없어요.',400);
    if(r&&e.type==='decision.made'&&e.experienceId!==r.gameId)fail('WRONG_RUN_CONTENT','다른 콘텐츠의 기록입니다.',400);
  }
  if(r)r.eventIds=[...new Set([...r.eventIds,...events.map(e=>e.id)])];return r;
}
export function updateRuns(state,l,summary,now){
  const events=new Map(l.events.filter(e=>e.revision===l.sharing.revision).map(e=>[e.payload.id,e]));
  for(const r of (state.learningRuns||[]).filter(r=>belongs(r,l))){
    if(!validAssignment(state,r,l)){if(r.status==='active')r.status='invalidated';continue;}
    // Preserve historic results, but never call an older unbound run a completed
    // targeted task. A fresh start creates the missing task snapshot.
    if(!r.target){if(r.status==='active')r.status='invalidated';continue;}
    if(!['active','completed'].includes(r.status))continue;
    const content=gameContent(r.contentId),families=new Set(),accepted=[];let excluded=0;
    for(const a of summary.attempts){const event=events.get(a.eventId),present=events.get(event?.payload.presentationId),decision=events.get(present?.payload.decisionId);
      if(event?.runId!==r.id||present?.runId!==r.id||decision?.runId!==r.id||decision.payload.experienceId!==r.gameId)continue;
      const m=a.measure,eligible=m&&(r.target?.items||content&&gameItems(content)||[]).some(p=>p.skillId===m.skillId&&p.difficulty===m.difficulty&&p.responseFormat===m.responseFormat&&p.modality===m.modality&&p.familyKey===m.familyKey&&p.itemKey===a.itemKey);if(!eligible||a.exclusionReason||!['correct','incorrect'].includes(a.verdict)){excluded++;continue;}
      if(families.has(m.familyKey))continue;families.add(m.familyKey);accepted.push(a);
    }
    const used=accepted.slice(0,r.requiredAttempts);r.progress={total:used.length,correct:used.filter(a=>a.verdict==='correct').length,assisted:used.filter(a=>a.assisted).length,independent:used.filter(a=>a.independent&&!a.assisted).length,excluded};
    // Recompute after late evidence; never leave a stale completed result after exclusion.
    const previous=state.submissions.find(s=>s.runId===r.id);
    if(used.length<r.requiredAttempts){if(r.status==='completed')r.status='active';if(previous)state.submissions=state.submissions.filter(s=>s!==previous);continue;}
    r.status='completed';r.completedAt=used.at(-1).at;
    if(r.assignmentId){const assignment=state.assignments.find(a=>a.id===r.assignmentId);const submission={id:previous?.id||`submission-${state.nextId++}`,assignmentId:r.assignmentId,learnerId:l.id,classId:l.classId,contentId:r.contentId,runId:r.id,target:copy(r.target||null),at:r.completedAt,receivedAt:new Date(now).toISOString(),late:Date.parse(r.completedAt)>Date.parse(assignment.dueAt),...r.progress,total:used.length,results:used.map(a=>({eventId:a.eventId,itemKey:a.itemKey,correct:a.verdict==='correct',assisted:!!a.assisted,independent:!!a.independent&&!a.assisted})),grading:'game-reported',sharingRevision:l.sharing.revision,learningEffectClaim:false};if(previous)Object.assign(previous,submission);else state.submissions.push(submission);}
  }
}
