// Pure cache projection. Metadata must be the parent's verified current class
// roster; null is unknown, while [] is an authoritative empty roster.
const validRevision=value=>Number.isSafeInteger(value)&&value>=0;
const revisionOf=learner=>validRevision(learner.sharing?.revision)?learner.sharing.revision:-1;
const townRevisionOf=learner=>validRevision(learner.activity?.town?.sharing?.revision)?learner.activity.town.sharing.revision:-1;
const privateKeys=['skills','evidence','excludedEvidence','recommendations','observations','careTasks','care','assignments'];
const hasValues=value=>Array.isArray(value)?value.length>0:!!value&&typeof value==='object'?Object.keys(value).length>0:value!=null&&value!=='';
const hasLearningPrivate=learner=>privateKeys.some(key=>hasValues(learner[key]))||hasValues(learner.recommendation)||hasValues(learner.gameTargets)||!!learner.lastEventAt||!!learner.goal||Number(learner.activity?.world?.eventCount)>0||!!learner.activity?.world?.lastReceivedAt;
const hasTownPrivate=learner=>Number(learner.activity?.town?.activityCount)>0||!!learner.activity?.town?.lastReceivedAt||hasValues(learner.activity?.town?.recent);

function clearedTown(prior,meta,learningDenied=false){
  const oldRevision=validRevision(prior?.sharing?.revision)?prior.sharing.revision:-1;
  const newer=validRevision(meta.townRevision)&&meta.townRevision>=oldRevision;
  const enabled=!learningDenied&&(newer?meta.townEnabled===true:prior?.sharing?.enabled===true);
  return {...prior,status:enabled?'pending':'sharing-disabled',activityCount:0,lastReceivedAt:null,recent:[],capacityReached:false,
    sharing:{...prior?.sharing,...(newer?{revision:meta.townRevision}:{}),enabled,since:null,...(learningDenied?{blockedByLearningSharing:true}:{})}};
}
function clearLearning(learner,meta,higher){
  const connected=higher?meta.connected:learner.accountConnected!==false&&meta.connected;
  const revoked=higher?meta.revoked:learner.revoked===true||meta.revoked;
  const enabled=meta.enabled&&connected&&!revoked;
  const next={...learner,accountConnected:connected,revoked,sharing:{...learner.sharing,revision:meta.revision,enabled,since:null},connectedAt:null,lastEventAt:null,goal:'',recommendation:null,gameTargets:{}};
  for(const key of privateKeys)next[key]=[];
  next.activity={...learner.activity,world:{...learner.activity?.world,status:enabled?'pending':'sharing-disabled',eventCount:0,lastReceivedAt:null,worldV1ResponseCount:0,unmappedResponseCount:0},town:clearedTown(learner.activity?.town,meta,!enabled)};
  return next;
}
const relatedId=row=>row?.learnerId;
function pruneRows(rows,affected){
  if(!Array.isArray(rows))return rows;
  const next=rows.filter(row=>!affected.has(relatedId(row)));
  return next.length===rows.length?rows:next;
}
function pruneTargets(targets,affected){
  if(!targets||typeof targets!=='object'||Array.isArray(targets))return targets;
  const entries=Object.entries(targets).filter(([id])=>!affected.has(id));
  return entries.length===Object.keys(targets).length?targets:Object.fromEntries(entries);
}
function pruneAssignment(row,affected){
  const ids=Array.isArray(row.learnerIds)?row.learnerIds:typeof row.learnerId==='string'?[row.learnerId]:[];
  const related=ids.some(id=>affected.has(id))||[...(row.submissions||[]),...(row.runs||[]),row.submission,row.result].some(value=>affected.has(relatedId(value)));
  if(!related)return row;
  const remaining=ids.filter(id=>!affected.has(id));
  if(ids.length&&!remaining.length)return null;
  const next={...row};
  if(Array.isArray(row.learnerIds))next.learnerIds=remaining;
  if(affected.has(row.learnerId))delete next.learnerId;
  next.submissions=pruneRows(row.submissions,affected);
  next.runs=pruneRows(row.runs,affected);
  next.recommendations=pruneRows(row.recommendations,affected);
  next.targets=pruneTargets(row.targets,affected);
  // A scalar aggregate cannot retain the removed student's answer or score.
  for(const key of ['submission','result'])if(row[key]&&(affected.has(relatedId(row[key]))||!relatedId(row[key])&&ids.some(id=>affected.has(id))))delete next[key];
  if(Array.isArray(next.submissions)){
    const completed=new Set(next.submissions.map(relatedId).filter(id=>remaining.includes(id)));
    next.assignedCount=remaining.length;next.completedCount=completed.size;
    if(row.status!=='cancelled')next.status=completed.size>=remaining.length&&remaining.length?'submitted':'assigned';
  }
  return next;
}
function pruneAssignments(rows,affected){
  if(!Array.isArray(rows))return rows;
  const next=rows.map(row=>pruneAssignment(row,affected)).filter(Boolean);
  return next.length===rows.length&&next.every((row,index)=>row===rows[index])?rows:next;
}

export function applySharingFence(workspace,latestLearners){
  const unchanged=()=>({workspace,changedLearnerIds:[],revokedLearnerIds:[],changedTownLearnerIds:[]});
  if(!workspace||!Array.isArray(workspace.classes)||latestLearners==null)return unchanged();
  if(!Array.isArray(latestLearners))throw new TypeError('Verified learner permission array required');
  const known=new Map();
  for(const meta of latestLearners){
    if(!meta||typeof meta.id!=='string'||!meta.id||!validRevision(meta.revision)||['enabled','connected','revoked'].some(key=>typeof meta[key]!=='boolean')||known.has(meta.id))throw new TypeError('Invalid or duplicate learner permission');
    if(meta.townRevision!==undefined&&(!validRevision(meta.townRevision)||typeof meta.townEnabled!=='boolean'))throw new TypeError('Invalid Town permission');
    known.set(meta.id,meta);
  }
  const changed=new Set(),revoked=new Set(),learningChanged=new Set(),townChanged=new Set();
  let classes=workspace.classes.map(classroom=>{
    if(!Array.isArray(classroom.learners))return classroom;
    const learners=[];
    for(const learner of classroom.learners){
      const meta=known.get(learner.id);
      if(!meta){changed.add(learner.id);revoked.add(learner.id);learningChanged.add(learner.id);continue;}
      const oldRevision=revisionOf(learner),higher=meta.revision>oldRevision,same=meta.revision===oldRevision;
      const denied=!meta.enabled||!meta.connected||meta.revoked;
      const flagsChanged=meta.enabled!==learner.sharing?.enabled||meta.connected!==learner.accountConnected||meta.revoked!==(learner.revoked===true);
      let next=learner;
      if(higher||same&&denied&&(flagsChanged||hasLearningPrivate(learner)||hasTownPrivate(learner))){
        next=clearLearning(learner,meta,higher);changed.add(learner.id);learningChanged.add(learner.id);if(denied)revoked.add(learner.id);
      }
      // Town has its own consent clock; changing it must not reset learning or
      // invalidate an otherwise valid observation/assignment/care draft.
      const oldTownRevision=townRevisionOf(next),townHigher=validRevision(meta.townRevision)&&meta.townRevision>oldTownRevision;
      const townSameDenied=meta.townRevision===oldTownRevision&&meta.townEnabled===false&&(next.activity?.town?.sharing?.enabled!==false||hasTownPrivate(next));
      if(townHigher||townSameDenied){
        next={...next,activity:{...next.activity,town:clearedTown(next.activity?.town,meta,next.sharing?.enabled===false||next.accountConnected===false||next.revoked===true)}};
        changed.add(learner.id);townChanged.add(learner.id);
      }
      learners.push(next);
    }
    return learners.length===classroom.learners.length&&learners.every((row,index)=>row===classroom.learners[index])?classroom:{...classroom,learners};
  });
  if(!changed.size)return unchanged();
  // Learning-authority changes remove only that student's records. Mixed
  // assignments keep the remaining students and their exact submitted objects.
  if(learningChanged.size)classes=classes.map(classroom=>{
    const learners=(classroom.learners||[]).map(learner=>{const assignments=pruneAssignments(learner.assignments,learningChanged);return assignments===learner.assignments?learner:{...learner,assignments};});
    return {...classroom,learners,...(classroom.assignments?{assignments:pruneAssignments(classroom.assignments,learningChanged)}:{})};
  });
  const next={...workspace,classes};
  if(learningChanged.size){
    next.assignments=pruneAssignments(workspace.assignments,learningChanged);
    next.observations=pruneRows(workspace.observations,learningChanged);
    next.care=pruneRows(workspace.care,learningChanged);
  }
  return {workspace:next,changedLearnerIds:[...changed],revokedLearnerIds:[...revoked],changedTownLearnerIds:[...townChanged]};
}
