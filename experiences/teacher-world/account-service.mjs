// Account-backed transport for the canonical teacher model. Authentication, roster,
// consent fences and atomic persistence belong to the surrounding PostgreSQL store.
import * as Model from './model.mjs';
import {startRun,stopRun,bindRunEvents,updateRuns,runsFor} from './learning-runs.mjs';
import Atlas from '../../atlas/engine.js';
import Trail from '../../atlas/trail.js';
import Game from '../../atlas/game-learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
import {townWorkspace,townCommand} from './town-bridge.mjs';
const scope={domain:'LAB',workspace:'learning',subject:'device'},map=Strata.createMap(mapData);
const clone=value=>structuredClone(value);
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
export function emptyClassState(){return {schemaVersion:1,mode:'account-linked',synthetic:false,nextId:1,teachers:[],classes:[],learners:[],assignments:[],submissions:[],observations:[],audit:[],practices:[],learningRuns:[],personalization:{version:1,records:{}}};}
function visible(s){
  const v=clone(s),allowed=new Map(v.learners.map(l=>[l.id,l.sharing.enabled&&!l.revoked?l.sharing.revision:null]));
  for(const l of v.learners){l.evidence=l.evidence.filter(e=>allowed.get(l.id)!==null&&e.sharingRevision===allowed.get(l.id));l.events=l.events.filter(e=>allowed.get(l.id)!==null&&e.revision===allowed.get(l.id));}
  v.assignments=v.assignments.map(a=>({...a,learnerIds:a.learnerIds.filter(id=>allowed.get(id)!=null&&a.deliveryRevisions?.[id]===allowed.get(id))})).filter(a=>a.learnerIds.length);
  const ids=new Set(v.assignments.map(a=>a.id));v.submissions=v.submissions.filter(r=>ids.has(r.assignmentId)&&r.sharingRevision===allowed.get(r.learnerId));v.observations=v.observations.filter(r=>allowed.get(r.learnerId)!=null&&r.sharingRevision===allowed.get(r.learnerId));return v;
}
function requireLearner(s,actor,enabled=true){const l=s.learners.find(l=>l.id===actor.id);if(actor.role!=='learner'||!l||l.revoked)fail('FORBIDDEN',403);if(enabled&&!l.sharing.enabled)fail('LEARNING_DISABLED',403);return l;}
const revision=(l,value)=>{if(l.sharing.revision!==value)fail('REVISION_CONFLICT',409);};
function workspace(s,actor,now){
  const w=Model.getWorkspace(visible(s),actor,{now});
  for(const c of w.classes)for(const l of c.learners){const source=s.learners.find(row=>row.id===l.id);Object.assign(l,{sharing:clone(source.sharing),connectedAt:source.connectedAt,lastEventAt:source.lastEventAt,revoked:!!source.revoked});}
  for(const a of w.assignments)a.runs=a.learnerIds.flatMap(id=>runsFor(s,s.learners.find(l=>l.id===id)).runs.filter(r=>r.assignmentId===a.id&&r.assignmentRevision===a.revision).map(r=>({...r,learnerId:id})));
  w.integration={...w.integration,worldConnected:true,productionConnected:true,live:true,note:'SYNK 계정과 담당 반의 공유 동의를 확인한 학습 기록입니다.'};return w;
}
function student(s,actor,now){
  const l=requireLearner(s,actor,false),v=visible(s),w=Model.getStudentWorkspace(v,actor,{now});
  // Use the existing policy without exposing another learner or a teacher's settings.
  const projection=clone(v),internal='classroom-policy';projection.teachers=[{id:internal,name:'학습 안내'}];projection.classes.forEach(c=>c.teacherIds=[internal]);
  const profile=Model.getWorkspace(projection,{id:internal,role:'teacher',mode:'account-linked'},{now}).classes.flatMap(c=>c.learners).find(r=>r.id===l.id);
  const recommendations=l.sharing.enabled?profile.recommendations:[],runs=l.sharing.enabled?runsFor(s,l):{activeRun:null,runs:[]};
  return {...w,sharing:clone(l.sharing),recommendations,gameTargets:l.sharing.enabled?profile.gameTargets||{}:{},content:Model.contentCatalog(s),...runs,
    coaching:{kind:'evidence-guidance',summary:l.sharing.enabled?'실제로 답한 문항을 바탕으로 다음 연습을 골랐어요.':'반에 학습 기록을 공유하면 과제를 연결할 수 있어요.',next:recommendations,basedOn:[...new Set(recommendations.flatMap(r=>r.evidence||[]))]},
    assignments:w.assignments.map(a=>({...a,run:runs.runs.filter(r=>r.assignmentId===a.id&&r.assignmentRevision===a.revision).at(-1)||null}))};
}
export function projectEvidence(state,learner,now){
  const rows=learner.events.filter(e=>e.revision===learner.sharing.revision);
  // Device clocks are not evidence of ownership. Preserve raw events in the
  // canonical log and use server receipt time only in this classroom projection.
  const events=rows.map(r=>({...r.payload,at:r.receivedAt||r.payload.at,recordedAt:r.receivedAt||r.payload.recordedAt}));
  const summary=Trail.summarize(events,{scope,asOf:new Date(now).toISOString()});
  learner.evidence=learner.evidence.filter(e=>!(e.grading==='game-reported'&&e.sharingRevision===learner.sharing.revision));
  const scored=new Set(rows.filter(e=>e.serverScored).map(e=>e.payload.id));
  for(const a of summary.attempts){const m=a.measure;if(!m||scored.has(a.eventId))continue;learner.evidence.push({id:`world-${a.eventId}`,source:'language-item',skillId:m.skillId,at:a.at,verdict:a.exclusionReason?'unassessed':a.verdict,independent:a.independent,assisted:a.assisted,taskId:a.taskId,itemKey:a.itemKey,familyKey:m.familyKey,difficulty:m.difficulty,responseFormat:m.responseFormat,reason:a.exclusionReason||'WORLD 게임이 보고한 언어 응답 · 서버 독립 채점 아님',grading:'game-reported',sourceEventId:a.eventId,sharingRevision:learner.sharing.revision});}
  updateRuns(state,learner,summary,now);return summary;
}
function readingEvents(l,result,now){
  if(result.duplicate)return [];
  const store=new Map(),coach=Game.createGame({gameId:'world-reading',map,storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},clock:()=>new Date(now).toISOString()});
  for(const e of l.evidence.filter(e=>e.submissionId===result.submission.id)){const id=coach.present({id:e.taskId,itemKey:e.familyKey,familyKey:e.familyKey,skillId:e.skillId,difficulty:e.difficulty,modality:'reading',responseFormat:e.responseFormat,audioRequired:false});coach.answer(id,{correct:e.verdict==='correct',assessable:true});}
  return coach.events();
}
export function validateCanonical(previous,fresh){Atlas.createSession({scope,events:[...previous,...fresh]});}
export async function handleClassroom({state:s,actor,route,method,payload={},query,now,io}){
  if(method==='GET'){
    if(route==='/api/workspace'){if(actor.role!=='teacher')fail('FORBIDDEN',403);return workspace(s,actor,now);}
    const l=requireLearner(s,actor,false);
    if(route==='/api/student')return student(s,actor,now);
    if(route==='/api/world/town')return townWorkspace(s,actor);
    if(route==='/api/world/account')return {ok:true,account:{synk_user_id:l.accountId,status:'active',profile:{display_name:l.name}},memberships:[{kind:'learner',role:'student',learner_id:l.id}],learning:clone(l.sharing),sharing:clone(l.sharing),accountLearning:clone(l.accountLearning),capabilities:{learningSync:true},entitlements:[],sessions:[],accountLinked:true};
    if(route==='/api/world/practice')return {content:Model.readingContent(),sharing:clone(l.sharing)};
    if(route==='/api/world/learning'){requireLearner(s,actor);revision(l,Number(query.get('revision')));const after=Number(query.get('after')||0),events=l.events.filter(e=>e.revision===l.sharing.revision);if(!Number.isSafeInteger(after)||after<0||after>events.length)fail('INVALID_CURSOR');const page=events.slice(after,after+100);return {ok:true,revision:l.sharing.revision,events:page.map(e=>e.payload),cursor:after+page.length,hasMore:after+page.length<events.length};}
    fail('NOT_FOUND',404);
  }
  if(actor.role==='teacher'){
    if(payload.classId!=null&&payload.classId!==s.classes[0].id)fail('FORBIDDEN',403);
    if(route==='/api/assignments'){
      if(!Array.isArray(payload.learnerIds))fail('INVALID_RECIPIENTS');for(const id of payload.learnerIds){const l=s.learners.find(l=>l.id===id);if(!l)fail('FORBIDDEN',403);if(!l.sharing.enabled)fail('LEARNING_DISABLED',409);}
      const evidence=s.learners.map(l=>l.evidence),filtered=visible(s);let result;
      try{s.learners.forEach((l,i)=>l.evidence=filtered.learners[i].evidence);result=Model.createAssignment(s,actor,payload,{now});}finally{s.learners.forEach((l,i)=>l.evidence=evidence[i]);}
      const a=s.assignments.find(a=>a.id===result.assignment.id);
      if(a.deliveryRevisions&&a.learnerIds.some(id=>a.deliveryRevisions[id]!==s.learners.find(l=>l.id===id).sharing.revision))fail('REVISION_CONFLICT',409);
      a.deliveryRevisions??=Object.fromEntries(a.learnerIds.map(id=>[id,s.learners.find(l=>l.id===id).sharing.revision]));return result;
    }
    if(['/api/assignments/update','/api/assignments/cancel'].includes(route)){
      const a=s.assignments.find(a=>a.id===payload.assignmentId);if(!a)fail('FORBIDDEN',403);
      if(a.revision!==payload.revision)fail('REVISION_CONFLICT',409);
      if(a.learnerIds.some(id=>{const l=s.learners.find(l=>l.id===id);return !l?.sharing.enabled||a.deliveryRevisions?.[id]!==l.sharing.revision;}))fail('SHARING_DISABLED',403);
      return (route.endsWith('cancel')?Model.cancelAssignment:Model.updateAssignment)(s,actor,payload,{now});
    }
    if(route==='/api/observations'){const l=s.learners.find(l=>l.id===payload.learnerId);if(!l)fail('FORBIDDEN',403);if(!l.sharing.enabled)fail('LEARNING_DISABLED',403);const old=s.observations.find(o=>o.teacherId===actor.id&&o.idempotencyKey===payload.idempotencyKey);if(old&&old.sharingRevision!==l.sharing.revision)fail('REVISION_CONFLICT',409);const r=Model.addObservation(s,actor,payload,{now});if(!r.duplicate)s.observations.find(o=>o.id===r.observation.id).sharingRevision=l.sharing.revision;return r;}
    fail('FORBIDDEN',403);
  }
  const l=requireLearner(s,actor,false);if(payload.learnerId!=null&&payload.learnerId!==l.id)fail('FORBIDDEN',403);
  if(route==='/api/world/sharing'){revision(l,payload.revision);if(typeof payload.enabled!=='boolean')fail('INVALID_INPUT');return io.setSharing(payload.enabled);}
  requireLearner(s,actor);
  if(route==='/api/world/town/command')return townCommand(s,actor,payload);
  if(route==='/api/world/runs/start'){const r=startRun(s,l,payload,now),stored=s.learningRuns.find(row=>row.id===r.run.id);if(stored.startSequence==null)stored.startSequence=await io.maxSequence();return r;}
  if(route==='/api/world/runs/stop')return stopRun(s,l,payload.runId);
  if(['/api/submissions','/api/world/practice'].includes(route)){
    if(route.endsWith('practice')){revision(l,payload.revision);const old=s.practices.find(p=>p.learnerId===l.id&&p.idempotencyKey===payload.idempotencyKey);if(old&&old.sharingRevision!==l.sharing.revision)fail('REVISION_CONFLICT',409);}
    else {const a=s.assignments.find(a=>a.id===payload.assignmentId);if(a?.deliveryRevisions?.[l.id]!==l.sharing.revision)fail('FORBIDDEN',403);}
    const before=new Set(l.evidence.map(e=>e.id)),r=(route.endsWith('practice')?Model.submitPractice:Model.submitAssignment)(s,actor,payload,{now});
    for(const e of l.evidence)if(!before.has(e.id)){e.sharingRevision=l.sharing.revision;e.grading='server-scored';}
    (route.endsWith('practice')?s.practices:s.submissions).find(row=>row.id===r.submission.id).sharingRevision=l.sharing.revision;
    await io.append(readingEvents(l,r,now),null,true);return r;
  }
  if(route==='/api/world/learning'){
    revision(l,payload.revision);if(!Array.isArray(payload.events)||!payload.events.length||payload.events.length>256)fail('INVALID_EVENTS');
    for(const e of payload.events)if(e?.type==='decision.made'&&e.experienceId==='world-reading'||l.events.some(row=>row.serverScored&&[e?.decisionId,e?.presentationId,e?.targetId].includes(row.payload.id)))fail('SERVER_EVIDENCE_REQUIRED',403);
    bindRunEvents(s,l,payload.runId??null,payload.events);await io.append(payload.events,payload.runId??null,false);projectEvidence(s,l,now);return {ok:true,revision:l.sharing.revision,accepted:[...new Set(payload.events.map(e=>e.id))]};
  }
  fail('NOT_FOUND',404);
}
