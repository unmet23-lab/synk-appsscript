// Pure cache projection. Metadata must be the parent's verified current class
// roster; null is unknown, while [] is an authoritative empty roster.
const validRevision=value=>Number.isSafeInteger(value)&&value>=0;
const revisionOf=learner=>validRevision(learner.sharing?.revision)?learner.sharing.revision:-1;
const townRevisionOf=learner=>validRevision(learner.activity?.town?.sharing?.revision)?learner.activity.town.sharing.revision:-1;
const privateKeys=['skills','evidence','excludedEvidence','recommendations','observations','careTasks','care','assignments'];
const hasValues=value=>Array.isArray(value)?value.length>0:!!value&&typeof value==='object'?Object.keys(value).length>0:value!=null&&value!=='';
const hasLearningPrivate=learner=>privateKeys.some(key=>hasValues(learner[key]))||hasValues(learner.recommendation)||hasValues(learner.gameTargets)||!!learner.lastEventAt||!!learner.goal||Number(learner.activity?.world?.eventCount)>0||!!learner.activity?.world?.lastReceivedAt;
const hasTownPrivate=learner=>Number(learner.activity?.town?.activityCount)>0||!!learner.activity?.town?.lastReceivedAt||hasValues(learner.activity?.town?.recent);
// 학생이 혼자 한 연습을 비우면 서버는 반 공유 판을 올리되 같은 공유로 잇고, 교사 쪽 줄에 carriedFrom(이어진 가장 앞 판)을 싣는다.
// 기억한 판 prior에서 carriedFrom ≤ prior < 새 판이고, 켜짐·연결·철회가 기억한 것과 같은 채 공유 중이면 같은 공유다.
// 칸이 없거나(옛 응답, 동의나 공유를 껐다 켬, 계정 바뀜) 범위 밖이면 거짓 — 새 공유로 보고 지금처럼 비운다.
// prior·next는 {revision,enabled,connected,revoked}이고 next에 carriedFrom이 더 있다(포털 permission()과 같은 꼴).
export function carriedSharing(prior,next){
  const from=next?.carriedFrom;
  return validRevision(prior?.revision)&&validRevision(next?.revision)&&validRevision(from)&&from<=prior.revision&&prior.revision<next.revision
    &&next.enabled===true&&next.connected===true&&next.revoked===false&&['enabled','connected','revoked'].every(key=>prior[key]===next[key]);
}
// 이어진 판의 그 학생 줄: 기록·숙제 몫·상태는 그대로 두고 판 번호와 그 판에 묶인 챙길 일 줄만 새 판으로 옮긴다.
function carryRows(rows,moves){
  if(!Array.isArray(rows))return rows;
  let moved=false;
  const next=rows.map(row=>{const move=moves.get(row?.learnerId);if(!move||row.sharingRevision!==move.from)return row;moved=true;return {...row,sharingRevision:move.to};});
  return moved?next:rows;
}
function carryLearning(learner,meta,move){
  const next={...learner,sharing:{...learner.sharing,revision:meta.revision,carriedFrom:meta.carriedFrom}},moves=new Map([[learner.id,move]]);
  for(const key of ['careTasks','care'])if(Array.isArray(learner[key]))next[key]=carryRows(learner[key],moves);
  return next;
}

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
  // 새 공유로 비운 줄에는 앞 판의 carriedFrom을 남기지 않는다 — 남기면 뒤의 판 맞추기가 옛 작성 창을 이어진 것으로 본다.
  const {carriedFrom:_staleCarry,...sharing}=learner.sharing||{};
  const next={...learner,accountConnected:connected,revoked,sharing:{...sharing,revision:meta.revision,enabled,since:null},connectedAt:null,lastEventAt:null,goal:'',recommendation:null,gameTargets:{}};
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
  const unchanged=()=>({workspace,changedLearnerIds:[],revokedLearnerIds:[],changedTownLearnerIds:[],carriedLearnerIds:[]});
  if(!workspace||!Array.isArray(workspace.classes)||latestLearners==null)return unchanged();
  if(!Array.isArray(latestLearners))throw new TypeError('Verified learner permission array required');
  const known=new Map();
  for(const meta of latestLearners){
    if(!meta||typeof meta.id!=='string'||!meta.id||!validRevision(meta.revision)||['enabled','connected','revoked'].some(key=>typeof meta[key]!=='boolean')||known.has(meta.id))throw new TypeError('Invalid or duplicate learner permission');
    if(meta.townRevision!==undefined&&(!validRevision(meta.townRevision)||typeof meta.townEnabled!=='boolean'))throw new TypeError('Invalid Town permission');
    known.set(meta.id,meta);
  }
  const changed=new Set(),revoked=new Set(),learningChanged=new Set(),townChanged=new Set(),carried=new Map();
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
      if(higher&&carriedSharing({revision:oldRevision,enabled:learner.sharing?.enabled,connected:learner.accountConnected,revoked:learner.revoked===true},meta)){
        const move={from:oldRevision,to:meta.revision};next=carryLearning(learner,meta,move);carried.set(learner.id,move);changed.add(learner.id);
      }else if(higher||same&&denied&&(flagsChanged||hasLearningPrivate(learner)||hasTownPrivate(learner))){
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
  if(carried.size)next.care=carryRows(next.care,carried);
  return {workspace:next,changedLearnerIds:[...changed],revokedLearnerIds:[...revoked],changedTownLearnerIds:[...townChanged],carriedLearnerIds:[...carried.keys()]};
}
