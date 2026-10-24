import {applySharingFence} from './sharing-fence.mjs';
import {learnerOverview,compareTeacherRows} from './workspace-overview.mjs';

// 교사 화면 한 장이 「지금 무엇을 보고 있나」를 이 세션 하나가 가진다. 화면(DOM)·부모 창·요청 통로는 모른다.
// - 판: 마지막으로 받아들인 수업 자료(workspace)와 그 판으로 아직 쓸 수 있는지(ready). 부모가 확인한 공유 상태(sharing)로 늘 거른다.
// - 선택: 고른 반(classId)·학생(learnerId). 바꾸는 길은 아래 전이뿐이다.
// - 세대 둘: auth는 연결이 열리고 끝날 때, access는 고른 학생·권한이 바뀔 때 오른다. 요청은 lease()로 세대를 붙잡고 응답 뒤 견준다.
// - 작성 창(원고) 묶음: 열 때의 반·학생·공유 판·과제/챙길 일 판. 묶음이 풀리면 onRelease(까닭)로 화면에 알린다.
//   selection  일반 선택 변경(학생·반을 고름, 부모가 학생을 고름) — 조용히 닫는다.
//   permission 묶인 학생의 공유·연결·과제·챙길 일 판이 바뀜 — 닫고 알린다. 다른 학생의 변화로는 닫히지 않는다.
//   suspend    판을 다시 확인하지 못함(권한 확인 실패·연결 끊김) — 고른 반·학생은 남긴다.
//   signout    연결이 끝남 — 고른 반·학생까지 지운다.
//   discard    새 작성 창을 열기 전에 비움 — 세대는 그대로다.

// 학생이 WORLD 계정을 연결했는지. 수업 서버는 accountConnected를, 로컬 연결은 connectedAt만 보낸다.
export const studentLinked=student=>student?.accountConnected===true||student?.accountConnected!==false&&!!student?.connectedAt;

export function createSelectionSession({invites=false,onRelease=()=>{}}={}){
  let linked=false,auth=0,access=0,reads=0,workspace,ready=false,classId,learnerId,draft=null,sharing=null;
  const classroom=()=>workspace?.classes.find(row=>row.id===classId);
  const learners=()=>classroom()?.learners||[];
  const student=()=>learners().find(row=>row.id===learnerId);
  // 연결 코드는 머리 줄과 같은 기준(learnerOverview)이다. 수업 서버는 계정 없는 명부 학생을 revoked:true로 보내므로 revoked만 보면 코드가 꼭 필요한 학생에게 단추가 사라진다.
  const canInvite=row=>invites&&!!row&&learnerOverview(row).sharing==='unconnected';
  const careFor=row=>!row?[]:(row.careTasks||row.care||workspace?.care||[]).filter(task=>task.learnerId===row.id&&task.classId===classId&&(!Number.isSafeInteger(row.sharing?.revision)||task.sharingRevision===row.sharing.revision));
  // 작성 창이 열릴 때 묶인 학생·판이 그대로인지. 예시 자료는 공유 동의가 없어 늘 열려 있다.
  function allows(kind){
    if(!linked)return true;if(!ready||!draft||draft.kind!==kind)return false;
    const cls=workspace.classes.find(c=>c.id===draft.classId),row=cls?.learners.find(s=>s.id===draft.learnerId);
    if(kind==='enrollment')return classId===draft.classId&&learnerId===draft.learnerId&&canInvite(row);
    if(!row||row.revoked||!studentLinked(row)||!row.sharing?.enabled||row.sharing.revision!==draft.sharingRevision)return false;
    if(draft.assignmentId){const assignment=workspace.assignments.find(a=>a.id===draft.assignmentId);if(!assignment||!['active','assigned'].includes(assignment.status)||assignment.revision!==draft.assignmentRevision)return false;}
    if(draft.careId){const care=careFor(row).find(task=>task.id===draft.careId);if(!care||care.revision!==draft.careRevision)return false;}
    return true;
  }
  function release(reason){draft=null;onRelease(reason);}
  function withdraw(reason){access++;release(reason);}
  return Object.freeze({
    get linked(){return linked;},get workspace(){return workspace;},get ready(){return ready;},get classId(){return classId;},get learnerId(){return learnerId;},get sharing(){return sharing;},
    classroom,learners,student,canInvite,careFor,allows,
    // 이 기기 연결·계정 연결이면 작성 창이 학생의 공유 판에 묶인다. 통로가 정해질 때 한 번 맞춘다.
    setLinked(value){linked=!!value;},
    // 요청 하나가 붙잡는 세대. 쓰기는 연 뒤 auth와 access가 모두 그대로여야 결과를 쓴다.
    lease(){const a=auth,b=access;return Object.freeze({ready,current:({write=false}={})=>a===auth&&(!write||b===access),sameAccess:()=>b===access});},
    // 판 읽기 차례. 더 늦게 시작한 읽기·연결 종료·공유 거르기가 있으면 앞선 읽기의 답은 버린다.
    beginRead(){const mine=++reads;return ()=>mine===reads;},
    // 새 판을 받아들인다. 순서는 원래 화면과 같다: 공유 거르기 → 정렬 → 작성 창 묶음 확인(서버 과제 상태 그대로) → 과제 상태 정리 → 선택 맞추기.
    accept(data,{requested=null}={}){
      data=applySharingFence(data,sharing).workspace;
      workspace={...data,classes:data.classes.map(row=>({...row,learners:[...(row.learners||[])].sort(compareTeacherRows)})).sort(compareTeacherRows)};ready=true;
      if(linked&&draft&&!allows(draft.kind))withdraw('permission');
      workspace.assignments=workspace.assignments.map(a=>({...a,status:a.status==='cancelled'?'cancelled':a.completedCount>=a.assignedCount?'submitted':'assigned',submission:a.submissions?.[0]}));
      classId=workspace.classes.some(c=>c.id===classId)?classId:workspace.classes[0]?.id;
      const wanted=requested?.classId===classId?requested.learnerId:null;
      learnerId=learners().some(s=>s.id===wanted)?wanted:learners().some(s=>s.id===learnerId)?learnerId:learners()[0]?.id;
    },
    // 부모가 확인한 반 학생 모두의 공유 상태. 다음 판부터 이것으로 거른다.
    adoptSharing(latest){sharing=latest;},
    // 지금 판을 그 자리에서 거른다. 바뀐 학생이 있으면 앞선 읽기를 버리고, 묶인 학생이 바뀐 작성 창만 닫는다.
    fence(){
      if(!workspace)return {changed:false};
      const fenced=applySharingFence(workspace,sharing);if(!fenced.changedLearnerIds.length)return {changed:false};
      workspace=fenced.workspace;reads++;
      if(draft&&!allows(draft.kind))withdraw('permission');
      if(!learners().some(row=>row.id===learnerId))learnerId=learners()[0]?.id;
      return {changed:true};
    },
    // 작성 창이 아직 그 묶음 그대로 열려 있는지.
    draftHeld:()=>!!draft&&allows(draft.kind),
    holds:context=>draft===context&&allows(context.kind),
    captureDraft(kind,record=null){const row=student();draft={kind,classId,learnerId,sharingRevision:row?.sharing?.revision,...(kind==='assignment'?{assignmentId:record?.id,assignmentRevision:record?.revision}:{}),...(kind==='care'?{careId:record?.id,careRevision:record?.revision}:{})};return draft;},
    discardDraft(){release('discard');},
    // 연결 코드 창을 닫으면 그 묶음만 내린다(창은 이미 닫혔다).
    dismissDraft(kind){if(draft?.kind===kind)draft=null;},
    // 일반 선택 변경. 고를 수 없는 학생이면 아무것도 바꾸지 않는다.
    chooseLearner(id){if(!learners().some(row=>row.id===id))return false;withdraw('selection');learnerId=id;return true;},
    chooseClass(id){withdraw('selection');classId=id;learnerId=learners()[0]?.id;},
    // 과제 고치기·새 학생 연결처럼 작성 대상 학생으로 맞춘다. 세대와 작성 창은 그대로다.
    focusLearner(id){learnerId=id;},
    // course-writing처럼 반 하나에 묶인 화면의 범위 표식.
    classScope:()=>JSON.stringify([auth,classId]),
    // 판을 다시 확인하지 못했다. 고른 반·학생은 남기고 판과 작성 창을 내린다.
    suspend(){ready=false;access++;workspace=null;release('suspend');},
    signIn(){auth++;},
    // 연결이 끝났다. 진행 중인 읽기·쓰기 결과는 모두 버린다.
    signOut(){auth++;reads++;workspace=null;ready=false;withdraw('signout');classId=null;learnerId=null;}
  });
}
