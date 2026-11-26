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
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('날짜를 읽지 못했어요. 기한을 다시 골라 주세요.');
  const date=new Date(day+'T23:59:59+09:00');if(!Number.isFinite(date.getTime())||careDateValue(date)!==day)throw Error('날짜를 읽지 못했어요. 기한을 다시 골라 주세요.');return date.toISOString();
}

export function learnerOverview(learner){
  const connectionKnown=Object.hasOwn(learner,'connectedAt')||!!learner.sharing||learner.revoked===true;
  const sharing=learner.accountConnectionStatus==='revoked'?'revoked':learner.accountConnected===false?'unconnected':learner.revoked?'revoked':learner.sharing?.enabled===false?'unshared':learner.accountConnected===true?'shared':connectionKnown&&!learner.connectedAt?'unconnected':connectionKnown?'shared':'unknown';
  const skills=sharing==='shared'?list(learner.skills):[];
  const practice=skills.filter(row=>row.status==='practice'&&row.source==='independent-language-items'&&number(row.n)>0);
  const review=skills.find(row=>row.status==='review'&&number(row.n)>0),supported=skills.find(row=>row.status==='supported'&&number(row.assisted)>0);
  const world=learner.activity?.world,town=learner.activity?.town;
  const worldText=sharing==='revoked'?'연결 해제':sharing==='unconnected'?'계정 연결 전':sharing==='unshared'||world?.status==='sharing-disabled'?'학습 공유 안 함':sharing==='unknown'?'연결 확인 못 함':!world?'활동 요약 준비 중':world.status==='shared'?`활동 ${number(world.eventCount)}건`:world.status==='no-record'?'활동 기록 없음':world.status==='pending'?'기록 불러오는 중':'기록 확인 못 함';
  const townText=sharing==='unknown'?'공유 확인 못 함':sharing!=='shared'||town?.status==='sharing-disabled'?'생활 공유 안 함':!town?'생활 기록 준비 중':town.status==='shared'?`활동 ${number(town.activityCount)}건`:town.status==='no-record'?'활동 기록 없음':'기록 확인 못 함';
  const guidance=practice[0]?.label|| (sharing==='unconnected'?'계정 연결부터':sharing==='revoked'?'연결 해제됨':sharing!=='shared'?'공유 상태부터 확인':review?'오래된 기록 다시 보기':supported?'혼자 풀어 보게 하기':skills.some(row=>number(row.n)>0)?'문항 기록 보기':'문항 기록 없음');
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

// 「담당 반 요약」(학원 운영 최소판): 교사 개요 응답의 attendance · topik 구역. 둘 다 없으면(기능 스위치 꺼짐) 아무것도 그리지 않는다.
// 학생 이름을 누르면 그 반을 열고 그 학생 줄로 간다(아래 click의 data-overview-student).
const TOPIK_STATE={within30:'30일 안 만료',within90:'90일 안 만료',expired:'만료'};
const REASON={'no-record':'TOPIK 기록 없음','below-4':'4급 미만','expired':'4급 이상 만료'};
const topikText=row=>row?'TOPIK '+row.kind+' '+(row.level>0?row.level+'급':'미달'):'';
export function classSummaryModel(data,model){
  const attendance=data?.attendance,topik=data?.topik;
  if(!attendance&&!topik)return null;
  const owners=new Map(model.classes.flatMap(classroom=>classroom.learners.map(learner=>[classroom.id+':'+learner.id,{classroom,learner}])));
  const known=row=>owners.has(row.classId+':'+row.learnerId);
  const named=row=>{const owner=owners.get(row.classId+':'+row.learnerId);return {...row,name:owner?.learner.name||'이름 확인 필요',className:owner?.classroom.name||''};};
  // 요약은 학습 공유를 켠 학생만 센다. 빈 칸 문구가 그 기준을 드러내도록 공유 학생 수와 전체 학생 수를 함께 둔다.
  const visible=new Set(model.classes.map(classroom=>classroom.id));
  const sharedCount=list(data?.classes).filter(classroom=>visible.has(classroom.id)).reduce((n,classroom)=>n+list(classroom.learners).filter(learner=>learner?.topik?.shared===true).length,0);
  return {sharedCount,learnerCount:model.classes.reduce((n,classroom)=>n+classroom.learners.length,0),basisDate:attendance?.basisDate||topik?.basisDate||null,
    absent:list(attendance?.absentToday).filter(known).map(named),late:list(attendance?.lateToday).filter(known).map(named),streaks:list(attendance?.consecutiveAbsences).filter(known).map(named),
    expiring:list(topik?.expiring).filter(known).map(named),expired:list(topik?.expired).filter(known).map(named),noLevel4:list(topik?.withoutValidLevel4).filter(known).map(named),
    recorded:list(attendance?.classes).filter(row=>model.classes.some(c=>c.id===row.classId)).reduce((sum,row)=>sum+['present','late','absent','excused'].reduce((n,key)=>n+number(row.counts?.[key]),0),0)};
}
function summaryButton(row,detail,unavailable){return '<li><button type="button" data-overview-class-id="'+escape(row.classId)+'" data-overview-student="'+escape(row.learnerId)+'" '+(unavailable?'disabled':'')+'><strong>'+escape(row.name)+'</strong><span>'+escape(row.className)+(detail?' · '+escape(detail):'')+'</span></button></li>';}
// 한 칸에 여섯 명까지 펼치고, 나머지는 접어 둔다(한 반 16명이 모두 걸려도 요약이 길어지지 않게).
function summaryBlock(title,count,rows,empty){const shown=rows.slice(0,6),rest=rows.slice(6);return '<section class="ovs-block"><h4>'+escape(title)+' <b>'+count+'</b></h4>'+(rows.length?'<ul>'+shown.join('')+'</ul>'+(rest.length?'<details><summary>나머지 '+rest.length+'명 보기</summary><ul>'+rest.join('')+'</ul></details>':''):'<p>'+escape(empty)+'</p>')+'</section>';}
export function classSummaryHtml(data,model,{unavailable=false}={}){
  const s=classSummaryModel(data,model);if(!s)return '';
  const absent=[...s.absent.map(row=>summaryButton(row,'결석'+(row.note?' · '+row.note:''),unavailable)),...s.late.map(row=>summaryButton(row,'지각'+(row.note?' · '+row.note:''),unavailable))];
  return '<section class="class-summary" aria-label="담당 반 요약"><header><div><h3>담당 반 요약</h3><p>계정을 잇고 학습 공유를 켠 학생만 세어요. TOPIK 성적은 발표일로부터 2년 뒤에 만료돼요.</p></div><span class="ovs-basis">기준일 '+escape(s.basisDate||'확인 필요')+'</span></header><div class="ovs-grid">'
    +summaryBlock('오늘 결석 · 지각',s.absent.length+s.late.length,absent,s.recorded?'오늘 찍은 출결에 결석 · 지각이 없어요.':'오늘 출결을 아직 찍지 않았어요.')
    +summaryBlock('최근 수업 3회 연속 결석',s.streaks.length,s.streaks.map(row=>summaryButton(row,row.count+'회 연속 · '+row.since+'부터',unavailable)),'연속 결석인 학생이 없어요.')
    +summaryBlock('TOPIK 만료 90일 안 · 만료',s.expiring.length+s.expired.length,[...s.expiring.map(row=>summaryButton(row,topikText(row)+' · '+TOPIK_STATE[row.state]+' · D-'+row.daysLeft,unavailable)),...s.expired.map(row=>summaryButton(row,topikText(row)+' · '+row.expiresOn+' 만료',unavailable))],'90일 안에 만료되거나 이미 만료된 성적이 없어요.')
    +summaryBlock('유효한 4급 이상 없음',s.noLevel4.length,s.noLevel4.map(row=>summaryButton(row,REASON[row.reason]+(row.best?' · '+topikText(row.best):''),unavailable)),s.sharedCount===0?'학습 공유를 켠 학생이 아직 없어요.':s.sharedCount<s.learnerCount?'학습 공유를 켠 학생 '+s.sharedCount+'명은 모두 유효한 4급 이상을 갖고 있어요.':'모든 학생이 유효한 4급 이상을 갖고 있어요.')
    +'</div></section>';
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
      if(!model.classes.length){root.innerHTML='<section class="overview-empty"><h2>담당 반이 아직 없어요</h2><p>기관에서 담당 반을 등록하면 학생과 챙길 일이 여기에 보여요.</p></section>';return;}
      root.innerHTML='<header class="overview-heading"><div><span class="overview-kicker">전체 반</span><h2>담당 반을 한눈에</h2><p>학생마다 최근 활동과 문항 기록을 보고, 챙길 일을 정해요.</p></div><button class="overview-felt" data-overview-all="1" '+(!selectedClassId?'disabled':'')+'>전체 반 보기</button></header>'
        +(unavailable?'<p class="overview-warning" role="status">연결을 다시 확인하고 있어요. 아래는 마지막으로 받은 기록이에요. 연결될 때까지는 반과 학생을 열 수 없어요.</p>':'')
        +'<div class="overview-stats">'+[[model.classes.length,'담당 반'],[model.learnerCount,'등록 학생'],[model.openCareCount,'남은 챙길 일'],[model.practiceCount,'더 연습할 학생']].map(([value,label])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div>'
        +classSummaryHtml(data,model,{unavailable})
        +'<div class="overview-classes">'+model.classes.map(classroom=>'<section class="overview-class" aria-label="'+escape(classroom.name)+'"><header><div><span class="overview-kicker">'+escape(classroom.town?.kind==='academy'?'TOWN 우리 반 마을':'담당 반')+'</span><h3>'+escape(classroom.name)+'</h3><p>'+classroom.learners.length+'명 · 챙길 일 '+classroom.openCare.length+'건 · 진행 중인 과제 '+classroom.pendingAssignments.length+'개</p></div><button class="overview-felt" data-overview-class="'+escape(classroom.id)+'" '+(unavailable?'disabled':'')+'>반 열기</button></header><div class="overview-students">'+(classroom.learners.length?classroom.learners.map(learner=>{const summary=learner.overview,care=classroom.openCare.filter(task=>task.learnerId===learner.id);return '<button class="overview-student '+(selectedClassId===classroom.id&&selectedLearnerId===learner.id?'is-selected':'')+'" data-overview-class-id="'+escape(classroom.id)+'" data-overview-student="'+escape(learner.id)+'" '+(unavailable?'disabled':'')+' aria-label="'+escape(learner.name)+' · '+escape(summary.guidance)+'"><span class="overview-student-head"><span class="overview-avatar">'+escape(summary.name.slice(0,1))+'</span><strong>'+escape(summary.name)+'</strong>'+(care.length?'<span class="overview-care-count">'+care.length+'</span>':'')+'</span><span class="overview-activity"><span>WORLD <b>'+escape(summary.worldText)+'</b></span><span>TOWN <b>'+escape(summary.townText)+'</b></span></span>'+(summary.lastActivity?'<span class="overview-last">마지막 '+escape(summary.lastActivity.type)+' '+escape(activityDate(summary.lastActivity.at))+'</span>':'')+'<span class="overview-guidance '+(summary.practice.length?'is-practice':'')+'">'+escape(summary.guidance)+'</span></button>';}).join(''):'<p class="overview-empty">이 반에 등록된 학생이 아직 없어요.</p>')+'</div></section>').join('')+'</div>'
        +'<section class="overview-work-list"><header><h3>챙길 일</h3><span>기한 지난 '+model.overdueCareCount+'건</span></header>'+(model.openCareCount?'<div>'+model.care.filter(task=>task.status!=='done').map(task=>{const classroom=model.classes.find(row=>row.id===task.classId),learner=classroom?.learners.find(row=>row.id===task.learnerId),assignee=list(data?.careAssignees).find(row=>row.id===task.assigneeId);return '<button data-overview-class-id="'+escape(task.classId)+'" data-overview-student="'+escape(task.learnerId)+'" '+(unavailable?'disabled':'')+'><strong>'+escape(task.title)+'</strong><span>'+escape(classroom?.name)+' · '+escape(learner?.name)+' · '+escape(assignee?.name||'맡은 선생님 확인 필요')+'</span><small>'+escape(task.status==='in-progress'?'하는 중':'예정')+' · '+escape(activityDate(task.dueAt))+'까지</small></button>';}).join('')+'</div>':'<p>아직 챙길 일이 없어요. 학생을 열어 「챙길 일 추가」로 남길 수 있어요.</p>')+'</section>'
        +'<p class="overview-source">WORLD·TOWN 활동량이나 접속 여부는 한국어 실력이 아니에요. 더 연습할 영역은 학생이 공유한 문항 기록으로만 정하고, 연결 전·공유 안 함·기록 없음은 약점으로 보지 않아요.</p><p class="overview-operating">기본 운영은 선생님 한 명이 두 반을 맡고, 반마다 16명이에요. 지금은 반 '+model.classes.length+'개, 학생 '+model.learnerCount+'명을 맡고 있어요'+(model.generatedAt?'('+escape(activityDate(model.generatedAt))+' 기준)':'')+'.</p>';
    },
    stop(){stopped=true;root.removeEventListener?.('click',click);root.replaceChildren();},
  });
}
