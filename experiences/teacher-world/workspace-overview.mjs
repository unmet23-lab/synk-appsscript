const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const list=value=>Array.isArray(value)?value:[];
const number=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const rosterOrder=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
export const compareTeacherRows=(a,b)=>rosterOrder.compare(a.name||a.id,b.name||b.id)||rosterOrder.compare(a.id,b.id);
const activityDate=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'날짜 없음';
export function careDateValue(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
}
export function careDueAt(day){
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('케어 처리 날짜를 확인해 주세요.');
  const date=new Date(day+'T23:59:59+09:00');if(!Number.isFinite(date.getTime())||careDateValue(date)!==day)throw Error('케어 처리 날짜를 확인해 주세요.');return date.toISOString();
}

export function learnerOverview(learner){
  const connectionKnown=Object.hasOwn(learner,'connectedAt')||!!learner.sharing||learner.revoked===true;
  const sharing=learner.accountConnectionStatus==='revoked'?'revoked':learner.accountConnected===false?'unconnected':learner.revoked?'revoked':learner.sharing?.enabled===false?'unshared':learner.accountConnected===true?'shared':connectionKnown&&!learner.connectedAt?'unconnected':connectionKnown?'shared':'unknown';
  const skills=sharing==='shared'?list(learner.skills):[];
  const practice=skills.filter(row=>row.status==='practice'&&row.source==='independent-language-items'&&number(row.n)>0);
  const review=skills.find(row=>row.status==='review'&&number(row.n)>0),supported=skills.find(row=>row.status==='supported'&&number(row.assisted)>0);
  const world=learner.activity?.world,town=learner.activity?.town;
  const worldText=sharing==='revoked'?'연결 해제':sharing==='unconnected'?'연결 대기':sharing==='unshared'||world?.status==='sharing-disabled'?'학습 공유 안 함':sharing==='unknown'?'연결 상태 확인':!world?'활동 요약 미연결':world.status==='shared'?`활동 ${number(world.eventCount)}건`:world.status==='no-record'?'활동 기록 없음':'기록 상태 확인';
  const townText=sharing==='unknown'?'공유 상태 확인':sharing!=='shared'||town?.status==='sharing-disabled'?'생활 공유 안 함':!town?'생활 활동 연결 준비 중':town.status==='shared'?`활동 ${number(town.activityCount)}건`:town.status==='no-record'?'활동 기록 없음':'기록 상태 확인';
  const guidance=practice[0]?.label|| (sharing!=='shared'?'공유·연결 상태 확인':review?'오래된 학습 근거 재확인':supported?'도움 뒤 혼자 풀기 확인':skills.some(row=>number(row.n)>0)?'학습 근거 살펴보기':'학습 근거 없음');
  const worldAt=sharing==='shared'&&world?.status==='shared'?world.lastReceivedAt||null:null,townAt=sharing==='shared'&&town?.status==='shared'?town.lastReceivedAt||null:null;
  const lastActivity=worldAt||townAt?{type:Date.parse(worldAt||'')>=Date.parse(townAt||'')||!townAt?'WORLD':'TOWN',at:Date.parse(worldAt||'')>=Date.parse(townAt||'')||!townAt?worldAt:townAt}:null;
  return {id:learner.id,name:learner.name||'이름 확인 필요',classId:learner.classId,sharing,practice,worldText,townText,guidance,worldAt,townAt,lastActivity};
}

export function teacherOverviewModel(data){
  const classes=list(data?.classes).filter(row=>typeof row.id==='string'&&row.id).map(row=>({...row,learners:list(row.learners).filter(learner=>typeof learner.id==='string'&&learner.id).map(learner=>({...learner,classId:row.id,overview:learnerOverview({...learner,classId:row.id})})).sort(compareTeacherRows)})).sort(compareTeacherRows);
  const owners=new Map(classes.flatMap(row=>row.learners.map(learner=>[row.id+':'+learner.id,learner])));
  const rawCare=list(data?.care).length?data.care:classes.flatMap(row=>row.learners.flatMap(learner=>list(learner.careTasks||learner.care)));
  const care=[...new Map(rawCare.filter(task=>{
    const learner=owners.get(task.classId+':'+task.learnerId);
    return typeof task.id==='string'&&learner?.overview.sharing==='shared'&&['open','in-progress','done'].includes(task.status)&&(!Number.isSafeInteger(learner.sharing?.revision)||task.sharingRevision===learner.sharing.revision);
  }).map(task=>[task.id,task])).values()];
  const assignments=list(data?.assignments).filter(row=>classes.some(classroom=>classroom.id===row.classId));
  for(const classroom of classes){
    classroom.openCare=care.filter(task=>task.classId===classroom.id&&task.status!=='done');
    classroom.pendingAssignments=assignments.filter(task=>task.classId===classroom.id&&['active','assigned'].includes(task.status)&&number(task.completedCount)<number(task.assignedCount));
    classroom.practiceCount=classroom.learners.filter(learner=>learner.overview.practice.length).length;
  }
  const generatedAt=data?.generatedAt||data?.asOf||null,asOf=Date.parse(generatedAt)||Date.now();
  return {classes,care,assignments,learnerCount:new Set(classes.flatMap(row=>row.learners.map(learner=>learner.id))).size,openCareCount:care.filter(task=>task.status!=='done').length,overdueCareCount:care.filter(task=>task.status!=='done'&&Date.parse(task.dueAt)<asOf).length,practiceCount:classes.flatMap(row=>row.learners).filter(learner=>learner.overview.practice.length).length,generatedAt};
}

export function createTeacherOverview({root,onStudent=()=>{},onClass=()=>{},onAll=()=>{}}){
  let stopped=false;
  const click=event=>{
    const button=event.target.closest?.('button');if(!button||button.disabled)return;
    if(button.dataset.overviewStudent)onStudent(button.dataset.overviewClassId,button.dataset.overviewStudent);
    else if(button.dataset.overviewClass)onClass(button.dataset.overviewClass);
    else if(button.dataset.overviewAll)onAll();
  };
  root.addEventListener?.('click',click);
  return Object.freeze({
    render(data,{selectedClassId=null,selectedLearnerId=null,unavailable=false}={}){
      if(stopped)return;const model=teacherOverviewModel(data);
      root.className='teacher-overview';
      if(!model.classes.length){root.innerHTML='<section class="overview-empty"><h2>담당 수업이 아직 없어요</h2><p>기관에서 실제 담당 반을 연결하면 학생과 수업 할 일이 함께 표시돼요.</p></section>';return;}
      root.innerHTML='<header class="overview-heading"><div><span class="overview-kicker">SYNK Workspace · 내 수업</span><h2>담당 반을 한눈에.</h2><p>학생의 활동과 학습 근거를 살펴보고, 필요한 후속 일을 정하세요.</p></div><button class="overview-felt" data-overview-all="1" '+(!selectedClassId?'disabled':'')+'>전체 반 보기</button></header>'
        +(unavailable?'<p class="overview-warning" role="status">연결을 다시 확인하고 있어요. 아래는 마지막으로 확인한 기록이며 지금은 새 처리를 할 수 없어요.</p>':'')
        +'<div class="overview-stats">'+[[model.classes.length,'담당 반'],[model.learnerCount,'실제 등록 학생'],[model.openCareCount,'열린 케어 할 일'],[model.practiceCount,'문항 근거로 연습 확인']].map(([value,label])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div>'
        +'<div class="overview-classes">'+model.classes.map(classroom=>'<section class="overview-class" aria-label="'+escape(classroom.name)+'"><header><div><span class="overview-kicker">'+escape(classroom.town?.kind==='academy'?'우리 반 = 학원 마을':'담당 수업')+'</span><h3>'+escape(classroom.name)+'</h3><p>'+classroom.learners.length+'명 · 케어 '+classroom.openCare.length+'건 · 진행 과제 '+classroom.pendingAssignments.length+'개</p></div><button class="overview-felt" data-overview-class="'+escape(classroom.id)+'" '+(unavailable?'disabled':'')+'>반 업무</button></header><div class="overview-students">'+(classroom.learners.length?classroom.learners.map(learner=>{const summary=learner.overview,care=classroom.openCare.filter(task=>task.learnerId===learner.id);return '<button class="overview-student '+(selectedClassId===classroom.id&&selectedLearnerId===learner.id?'is-selected':'')+'" data-overview-class-id="'+escape(classroom.id)+'" data-overview-student="'+escape(learner.id)+'" '+(unavailable?'disabled':'')+' aria-label="'+escape(learner.name)+' · '+escape(summary.guidance)+'"><span class="overview-student-head"><span class="overview-avatar">'+escape(summary.name.slice(0,1))+'</span><strong>'+escape(summary.name)+'</strong>'+(care.length?'<span class="overview-care-count">'+care.length+'</span>':'')+'</span><span class="overview-activity"><span>WORLD <b>'+escape(summary.worldText)+'</b></span><span>TOWN <b>'+escape(summary.townText)+'</b></span></span>'+(summary.lastActivity?'<span class="overview-last">마지막 '+escape(summary.lastActivity.type)+' '+escape(activityDate(summary.lastActivity.at))+'</span>':'')+'<span class="overview-guidance '+(summary.practice.length?'is-practice':'')+'">'+escape(summary.guidance)+'</span></button>';}).join(''):'<p class="overview-empty">실제 배정된 학생이 아직 없어요.</p>')+'</div></section>').join('')+'</div>'
        +'<section class="overview-work-list"><header><h3>예정된 케어와 후속 업무</h3><span>기한 지난 '+model.overdueCareCount+'건</span></header>'+(model.openCareCount?'<div>'+model.care.filter(task=>task.status!=='done').map(task=>{const classroom=model.classes.find(row=>row.id===task.classId),learner=classroom?.learners.find(row=>row.id===task.learnerId),assignee=list(data?.careAssignees).find(row=>row.id===task.assigneeId);return '<button data-overview-class-id="'+escape(task.classId)+'" data-overview-student="'+escape(task.learnerId)+'" '+(unavailable?'disabled':'')+'><strong>'+escape(task.title)+'</strong><span>'+escape(classroom?.name)+' · '+escape(learner?.name)+' · '+escape(assignee?.name||'담당자 확인 필요')+'</span><small>'+escape(task.status==='in-progress'?'처리 중':'예정')+' · '+escape(activityDate(task.dueAt))+'까지</small></button>';}).join('')+'</div>':'<p>아직 등록된 케어 할 일이 없어요. 학생 상세에서 담당자와 다음 처리 일을 정할 수 있어요.</p>')+'</section>'
        +'<p class="overview-source">WORLD·TOWN 활동량과 접속 여부는 한국어 실력 점수가 아니에요. 연습 영역은 공유된 언어 문항 근거에서만 확인하며, 미연결·미공유·기록 없음은 약점으로 판단하지 않아요.</p><p class="overview-operating">운영 기본 안내 · 교사 1명당 2반 × 반당 16명. 이 화면은 실제 배정된 '+model.classes.length+'반 '+model.learnerCount+'명을 표시해요.'+(model.generatedAt?' · '+escape(activityDate(model.generatedAt))+' 확인':'')+'</p>';
    },
    stop(){stopped=true;root.removeEventListener?.('click',click);root.replaceChildren();},
  });
}
