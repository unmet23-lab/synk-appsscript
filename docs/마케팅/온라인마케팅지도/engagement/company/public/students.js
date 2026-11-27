'use strict';
// 학생 관리의 「틀」(자료 · 동작). 설계 docs/디자인/학생관리_20261127/설계.md.
// 해외 지점과 국내 담당이 한 화면에서 지점별 오늘 출결, 학생 한 명의 길, 재학생 만료 알림을 본다.
// 자료는 「LAB 한국어 수업」과 같은 SYNK ID 로그인으로 중앙 수업 서버의 교사 개요(/api/teacher/overview 붙임)에서 읽는다. 회사 서버에는 학생 자료를 두지 않는다.
// 볼 수 있는 반은 중앙의 반 배정이 정한다. 출결 찍기와 TOPIK 넣기는 LAB 반 화면이 맡고, 이 화면은 재학 기록과 반의 지점만 고친다.
// 겉(HTML)은 students-view.js(StudentsView)가 그린다. 이 파일은 보기 자료(vm)를 만들어 넘기고 단추의 data-st-action만 읽는다.
const ST_FRESH=()=>({desktopOld:false,bridge:null,owner:null,canListen:false,unsubscribe:null,data:null,auth:null,loading:false,error:'',notice:'',branch:'all',stage:'',card:null,saving:false,away:false});
const students={...ST_FRESH(),epoch:0};
// 중앙 lib/synk-classroom-students.js의 STAGES · VISAS와 같은 값이다.
const ST_STAGES=[['academy','어학원 재원','반에서 TOPIK · 회화 · 영어 수업'],['path','PATH 수속','서류 점검 · 번역 초안 · 면접 연습'],['arrived','입국 · 정착','주거 계약 · 정착 멘토'],['enrolled','한국 재학','출석 · 체류 · TOPIK 유지']];
const ST_VISAS=[['D-2-1','D-2-1 전문학사'],['D-2-2','D-2-2 학사'],['D-2-3','D-2-3 석사'],['D-2-4','D-2-4 박사'],['D-2-5','D-2-5 연구'],['D-2-6','D-2-6 교환'],['D-2-7','D-2-7 일-학습 연계'],['D-2-8','D-2-8 단기'],['D-4-1','D-4-1 대학 부설 어학연수'],['D-4-7','D-4-7 외국어 연수']];
const ST_RETURN='synk-students-return',ST_RETURN_MS=15*60*1000;
// 돌아오기 표시는 시각을 함께 적는다. 15분이 지났거나 로그인 시작이 실패했거나 탭을 떠나면 지워 다른 로그인을 가로채지 않는다(Fable 최종 F6).
const stReturnMark=()=>{try{sessionStorage.setItem(ST_RETURN,String(Date.now()));}catch{}};
const stReturnClear=()=>{try{sessionStorage.removeItem(ST_RETURN);}catch{}};
// 「내 수업」 로그인은 끝나면 LAB 수업으로 돌아온다(회사 서버의 고정 콜백). 이 화면에서 시작한 로그인이면 app.js가 주소를 읽기 전에 이 화면으로 옮긴다.
(function studentsReturnFromSignIn(){
  try{
    const url=new URL(location.href);
    const marked=Number(sessionStorage.getItem(ST_RETURN));if(!marked)return;
    if(!(Date.now()-marked>=0&&Date.now()-marked<ST_RETURN_MS)){sessionStorage.removeItem(ST_RETURN);return;}
    if(url.searchParams.get('tab')!=='teaching'||!(url.searchParams.has('teachingConnected')||url.searchParams.has('teachingError')))return;
    sessionStorage.removeItem(ST_RETURN);const failed=url.searchParams.has('teachingError');
    url.searchParams.delete('teachingConnected');url.searchParams.delete('teachingError');url.searchParams.set('tab','students');
    history.replaceState(null,'',url.pathname+url.search+url.hash);if(failed)students.error='SYNK ID 로그인을 마치지 못했어요. 다시 눌러 주세요.';
  }catch{}
})();
function studentsOwner(){return JSON.stringify([state.user?.id||null,state.synkUserId||null]);}
// 계정이 바뀌거나 로그아웃하면 앞 계정의 학생 자료 · 거르기 · 안내 · 열린 카드를 모두 지운다(카본 A5).
function studentsCloseCard(){const dialog=document.getElementById('st-card');students.card=null;students.saving=false;if(dialog){if(dialog.open)dialog.close();dialog.replaceChildren();}}
function studentsReset(){
  students.epoch++;studentsUnlisten();try{students.bridge?.dispose?.();}catch{}
  studentsCloseCard();const {away}=students;Object.assign(students,ST_FRESH(),{away});
}
// 다른 탭으로 가거나 로그아웃하면 app.js render()가 부른다. 카드를 닫고 로그인 듣기를 그치며, 돌아올 때 로그인을 다시 확인하게 표시한다.
function studentsLeave(){
  if(students.owner&&(!state.user||students.owner!==studentsOwner()))studentsReset();
  if(students.card)studentsCloseCard();studentsUnlisten();students.away=true;
  if(!state.user||state.tab!=='teaching')stReturnClear();
}
async function studentsBridge(){
  if(students.owner&&students.owner!==studentsOwner())studentsReset();
  if(students.bridge)return students.bridge;
  const epoch=students.epoch,owner=studentsOwner(),module=window.synkDesktop?.teacher?null:await import('/teaching-host.js');
  if(epoch!==students.epoch)throw Object.assign(new Error('로그인한 계정이 바뀌었어요. 학생 관리를 다시 열어 주세요.'),{code:'ACCOUNT_CHANGED'});
  if(students.bridge)return students.bridge;
  const raw=window.synkDesktop?.teacher||module.createBrowserTeacherBridge();
  const bridge=typeof teachingBridgeForCompany==='function'?teachingBridgeForCompany(raw,owner):raw;
  students.bridge=bridge;students.owner=owner;students.canListen=typeof raw.onAuthChanged==='function';studentsListen();return bridge;
}
// 저장된 로그인을 되살리는 중(restoring)이거나 PC 앱처럼 쪽을 옮기지 않고 로그인이 끝나도 화면이 따라오게, 이 탭에 있는 동안 로그인 바뀜을 듣는다(카본 A3).
// 브라우저 다리는 듣는 동안 30초마다 로그인을 확인하므로 탭을 떠나면 그친다.
function studentsListen(){
  if(!students.bridge||!students.canListen||students.unsubscribe||state.tab!=='students')return;
  const epoch=students.epoch;
  students.unsubscribe=students.bridge.onAuthChanged(auth=>{
    if(epoch!==students.epoch)return;const was=students.auth?.signedIn===true;students.auth=auth;
    if(auth.signedIn){if((!was||!students.data)&&!students.loading)studentsLoad({quiet:Boolean(students.data)});}
    else{if(was){students.data=null;studentsCloseCard();}studentsPaint();}
  });
}
function studentsUnlisten(){try{students.unsubscribe?.();}catch{}students.unsubscribe=null;}
async function studentsRequest(operation,params={}){
  const bridge=await studentsBridge(),result=await bridge.accountRequest('classroom',{operation,...params});
  if(result?.ok!==true)throw Object.assign(new Error(result?.error?.message||'수업 서버에 닿지 못했어요. 잠시 뒤 다시 해 주세요.'),{code:result?.error?.code,status:result?.error?.status});
  return result;
}
// 새 학생 자료를 받아 바꿨으면 true를 돌려준다(저장 뒤 카드가 새 값을 읽었는지 안다).
async function studentsLoad({quiet=false}={}){
  const epoch=students.epoch;let fresh=false;students.loading=true;if(!quiet)studentsPaint();
  try{
    const bridge=await studentsBridge(),auth=await bridge.authStatus();if(epoch!==students.epoch)return;students.auth=auth;
    if(!auth.signedIn){students.data=null;return;}
    const data=await studentsRequest('teacherOverview');if(epoch!==students.epoch)return;
    // 중앙이 이번에 학생 기록을 붙이지 못했으면(시간 예산 · 실패) 앞서 읽은 학생 자료를 덮지 않는다(Fable 최종 F3).
    if(!data.students&&data.studentsUnavailable&&students.data?.students){students.error='학생 기록을 새로 읽지 못했어요. 앞서 읽은 내용을 보여 드려요. 잠시 뒤 「새로 고침」을 눌러 주세요.';return;}
    students.data=data;students.error='';fresh=Boolean(data.students);
  }catch(error){if(epoch===students.epoch)students.error=error.message||'학생 관리를 불러오지 못했어요.';}
  finally{if(epoch===students.epoch){students.loading=false;studentsPaint();}}
  return fresh;
}
function ensureStudents(){
  if(state.tab!=='students')return;
  studentsBars(document.getElementById('students-root'));
  if(students.owner&&students.owner!==studentsOwner())studentsReset();
  const entered=students.away;students.away=false;studentsListen();
  // 처음 열 때, 그리고 자료 없이 떠났다 돌아올 때(로그인 확인 중 · 로그인 안 함 · 오류) 다시 확인한다.
  if(!students.loading&&(!students.auth||entered&&!students.data))studentsLoad();
}
// 회사 화면의 CSP는 인라인 style을 막는다. 막대 너비는 그린 뒤 CSSOM으로 넣는다.
function studentsBars(root){for(const bar of root?.querySelectorAll?.('[data-st-w]')||[])bar.style.width=Math.max(0,Math.min(100,Number(bar.dataset.stW)||0))+'%';}
function studentsPage(){return StudentsView.page(StudentsView.inner(studentsModel()));}
function studentsPaint(){const root=document.getElementById('students-root');if(root){root.innerHTML=StudentsView.inner(studentsModel());studentsBars(root);}studentsPaintCard();}

// ── 보기 자료(vm): 겉이 바뀌어도 그대로인 셈 ──
const stStage=id=>ST_STAGES.find(row=>row[0]===id)?.[1]||'어학원 재원';
function studentsModel(){
  const notice=students.error?{text:students.error,error:true}:students.notice?{text:students.notice,error:false}:null;
  if(students.loading&&!students.data)return {phase:'loading',notice};
  if(students.auth&&!students.auth.signedIn)return {phase:'signin',notice,signin:{restoring:students.auth.status==='restoring',message:students.auth.error?.message||''}};
  const o=students.data;if(!o)return {phase:'empty',notice,canReload:Boolean(students.error)};
  const s=o.students;if(!s)return {phase:'closed',notice,closed:{classCount:o.classes?.length||0,unavailable:o.studentsUnavailable===true,loading:students.loading}};
  const all=o.classes||[],open=(o.branches||[]).filter(b=>b.active||all.some(c=>c.branch?.id===b.id));
  const chipList=[{id:'all',label:'전체 지점'},...open.map(b=>({id:b.id,label:b.name})),...(all.some(c=>!c.branch)?[{id:'none',label:'지점 미정'}]:[])];
  // 고른 칩이 다시 읽은 자료에서 사라지면(마지막 미정 반에 지점을 정함 · 닫힌 지점의 마지막 반을 옮김) 전체 지점으로 돌아간다(카본 A4).
  if(!chipList.some(c=>c.id===students.branch))students.branch='all';
  const branch=students.branch,stage=students.stage,chips=chipList.map(c=>({...c,pressed:branch===c.id}));
  const classes=all.filter(c=>branch==='all'||(branch==='none'?!c.branch:c.branch?.id===branch));
  const ids=new Set(classes.map(c=>c.id)),learners=classes.flatMap(c=>(c.learners||[]).map(l=>({...l,classId:c.id,className:c.name||''})));
  const alerts=s.alerts.filter(a=>ids.has(a.classId));
  const today={present:0,late:0,absent:0,excused:0,unrecorded:0};
  for(const c of classes)for(const key of Object.keys(today))today[key]+=c.branchToday?.counts?.[key]||0;
  const recorded=today.present+today.late+today.absent,count=kind=>alerts.filter(a=>a.kinds.some(k=>k.kind===kind)).length;
  const shared=learners.filter(l=>l.shared);
  const rows=classes.map(c=>{const k=c.branchToday?.counts||{},total=c.branchToday?.sharedLearnerCount||0,done=(k.present||0)+(k.late||0);
    return {id:c.id,name:c.name||'이름 없는 반',branchId:c.branch?.id||'',branchName:c.branch?.name||'',sessionDate:c.branchToday?.sessionDate||'',total,done,width:total?Math.round(done*100/total):0,counts:{absent:k.absent||0,late:k.late||0,unrecorded:k.unrecorded||0}};});
  const byKey=new Map(learners.map(l=>[l.classId+':'+l.id,l])),alerted=new Set();
  const people=[];
  for(const a of alerts){const l=byKey.get(a.classId+':'+a.learnerId);if(!l||stage&&l.stage!==stage)continue;alerted.add(a.classId+':'+a.learnerId);
    people.push({classId:a.classId,learnerId:a.learnerId,name:l.name||'이름 없음',sub:[l.stay?.university,l.stay?.program].filter(Boolean).join(' · ')||l.className,shared:true,alerted:true,kinds:a.kinds,mentorName:l.stay?.mentorName||''});}
  for(const l of learners){if(alerted.has(l.classId+':'+l.id)||stage&&!(l.shared&&l.stage===stage))continue;
    people.push(l.shared?{classId:l.classId,learnerId:l.id,name:l.name||'이름 없음',sub:`${stStage(l.stage)} · ${l.className}`,shared:true,alerted:false,attendancePercent:l.attendanceRate?.percent??null,stayDaysLeft:l.stay?.expiry?.daysLeft??null}
      :{classId:l.classId,learnerId:l.id,name:l.name||'이름 없음',shared:false});}
  return {phase:'ready',notice,ready:{basisDate:s.basisDate,assignedClassCount:s.assignedClassCount,loading:students.loading,chips,rules:s.rules,
    stats:{rate:recorded?Math.round((today.present+today.late)*100/recorded):null,recorded,unrecorded:today.unrecorded,streak:count('streak'),stay:count('stay'),topik:count('topik')},
    journey:ST_STAGES.map(([id,label,sub])=>({id,label,sub,count:shared.filter(l=>l.stage===id).length,pressed:stage===id})),stageFilter:stage,
    desktopOld:Boolean(students.desktopOld),classes:rows,branchOptions:(o.branches||[]).filter(b=>b.active).map(b=>({id:b.id,name:b.name})),people,listTitle:stage?`${stStage(stage)} 학생`:'만료 알림 · 학생'}};
}
// ── 학생 카드 ──
function studentsFind(classId,learnerId){const c=students.data?.classes?.find(x=>x.id===classId);const l=c?.learners?.find(x=>x.id===learnerId);return c&&l?{c,l}:null;}
const ST_FIELDS=['stage','visaKind','university','program','stayExpiresOn','enteredOn','mentorStaffId','universityAttendance','universityAttendanceOn','note'];
function studentsCardModel(c,l){
  const v=l.stay||{},draft=students.card?.draft||null,t=l.topikBest;
  const saved={stage:l.stage||'academy',visaKind:v.visaKind||'',university:v.university||'',program:v.program||'',stayExpiresOn:v.stayExpiresOn||'',enteredOn:v.enteredOn||'',mentorStaffId:v.mentorStaffId||'',universityAttendance:v.universityAttendance??'',universityAttendanceOn:v.universityAttendanceOn||'',note:v.note||''};
  const fields=draft?{...saved,...draft}:saved,step=ST_STAGES.findIndex(r=>r[0]===(l.stage||'academy'));
  return {name:l.name||'이름 없음',className:c.name||'',branchName:c.branch?.name||'',steps:ST_STAGES.map(([,label],i)=>({label,state:i<step?'done':i===step?'now':''})),
    topik:t?{kind:t.kind==='I'?'I':'II',level:t.level,expiresOn:t.expiresOn,daysLeft:t.daysLeft}:null,attendance:l.attendanceRate?{percent:l.attendanceRate.percent,recorded:l.attendanceRate.recorded}:null,
    fields,options:{stages:ST_STAGES.map(([id,label])=>({id,label})),visas:ST_VISAS.map(([id,label])=>({id,label})),staff:(c.staff||[]).map(s=>({id:s.id,label:s.name}))},
    error:students.card?.error||'',done:students.card?.done||'',saving:students.saving,hasRecord:Boolean(l.stay),desktopOld:students.desktopOld};
}
// 열린 카드를 다시 그릴 때(저장 시작 · 실패 · 다시 읽기) 쓰던 칸과 초점을 지킨다(카본 A1 · A7).
function studentsCardKeep(dialog){
  const form=dialog?.querySelector('[data-st-form]');if(!form||!students.card||dialog.dataset.key!==students.card.classId+':'+students.card.learnerId)return null;
  const draft={};for(const name of ST_FIELDS)if(form.elements[name])draft[name]=form.elements[name].value;
  const active=dialog.contains(document.activeElement)?document.activeElement:null;
  return {draft,focus:active?.name?`[name="${active.name}"]`:active?.dataset?.stAction?`[data-st-action="${active.dataset.stAction}"]`:null};
}
function studentsPaintCard(){
  let dialog=document.getElementById('st-card');
  if(!students.card){if(dialog?.open)dialog.close();return;}
  const card=students.card,found=studentsFind(card.classId,card.learnerId);if(!found){studentsCloseCard();return;}
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='st-card';dialog.className='st-card';dialog.setAttribute('aria-labelledby','st-card-t');
    // 저장하는 동안에는 Esc로도 닫지 않는다. 닫다가 실패 안내를 놓치지 않게 한다(카본 A2).
    dialog.addEventListener('cancel',event=>{if(students.saving)event.preventDefault();});
    dialog.addEventListener('close',()=>{const was=students.card;students.card=null;dialog.replaceChildren();delete dialog.dataset.key;if(!was)return;
      const opener=document.querySelector(`#students-root [data-st-action="card"][data-class="${CSS.escape(was.classId)}"][data-learner="${CSS.escape(was.learnerId)}"]`);opener?.focus();});
    document.body.append(dialog);
  }
  const kept=studentsCardKeep(dialog);if(kept&&!card.draftCleared)card.draft=kept.draft;card.draftCleared=false;
  dialog.dataset.key=card.classId+':'+card.learnerId;dialog.innerHTML=StudentsView.card(studentsCardModel(found.c,found.l));
  if(!dialog.open)dialog.showModal();
  const focus=kept?.focus&&dialog.querySelector(kept.focus);if(focus&&!focus.disabled)focus.focus();else if(kept?.focus)dialog.querySelector('[data-st-form]')?.focus?.();
}
async function studentsSaveCard(remove=false){
  const card=students.card,found=card&&studentsFind(card.classId,card.learnerId),form=document.querySelector('#st-card [data-st-form]');if(!found||!form||students.saving)return;
  if(!remove&&!form.reportValidity())return;
  const {c,l}=found,read=name=>form.elements[name]?.value??'';
  let body;
  if(remove)body={action:'delete',learnerId:l.id,id:l.stay.id,revision:l.stay.revision};
  else{
    const rate=read('universityAttendance');
    // 첫 저장은 화면이 읽은 공유 판을 함께 보낸다. 그사이 공유를 껐다 켰으면 중앙이 SCOPE_CHANGED로 거절한다.
    body={action:'save',learnerId:l.id,stage:read('stage'),visaKind:read('visaKind')||null,university:read('university'),program:read('program'),stayExpiresOn:read('stayExpiresOn')||null,enteredOn:read('enteredOn')||null,
      mentorStaffId:read('mentorStaffId')||null,universityAttendance:rate===''?null:Number(rate),universityAttendanceOn:read('universityAttendanceOn')||null,note:read('note'),
      ...(l.stay?{id:l.stay.id,revision:l.stay.revision}:{idempotencyKey:card.key||(card.key=crypto.randomUUID()),sharingRevision:l.sharingRevision})};
  }
  students.saving=true;card.error='';card.done='';studentsPaintCard();
  try{
    await studentsRequest('stay',{classId:c.id,body});students.notice=remove?'재학 기록을 지웠어요.':'재학 기록을 저장했어요.';card.done=students.notice;card.key=null;
    const typed=studentsCardKeep(document.getElementById('st-card'))?.draft||null;card.draft=null;card.draftCleared=true;
    // 저장은 됐는데 다시 읽기가 새 기록을 못 받았으면 옛 값으로 되돌리지 않고 쓴 칸을 두고 그렇게 알린다(Fable 다시 검수 FA2).
    if(!await studentsLoad({quiet:true})&&students.card===card){card.done+=' 새 값을 아직 다시 읽지 못했어요. 잠시 뒤 카드를 닫고 목록 위의 「새로 고침」을 눌러 주세요.';if(!remove){card.draft=typed;card.draftCleared=true;}}
  }catch(error){
    if(error.status===409){
      // 다른 곳에서 먼저 고쳤거나 공유가 바뀌었다. 새 판을 다시 읽되 쓰던 칸은 그대로 둔다.
      card.key=null;card.error=`${error.message} 새 기록을 다시 불러왔어요. 쓰신 칸은 그대로 두었으니 확인한 뒤 다시 저장해 주세요.`;await studentsLoad({quiet:true});
    }else card.error=studentsErrorText(error);
  }finally{students.saving=false;studentsPaintCard();}
}
// 저장 경로를 모르는 옛 PC 앱은 INVALID_REQUEST로 거절한다. 뜻 모를 글 대신 업데이트를 안내하고, 그 뒤로는 저장 단추를 막는다(Fable 최종 F2).
function studentsErrorText(error){
  if(window.synkDesktop?.teacher&&error?.code==='INVALID_REQUEST'){students.desktopOld=true;return ST_DESKTOP_OLD;}
  return error?.message||'저장하지 못했어요. 잠시 뒤 다시 해 주세요.';
}
const ST_DESKTOP_OLD='이 PC 앱은 아직 학생 기록 저장을 몰라요. PC 앱을 새 판으로 업데이트하거나 브라우저의 워크스페이스에서 저장해 주세요.';
// 지점 고르기: 처음 정할 때는 바로, 이미 정한 지점을 바꿀 때는 한 번 묻는다(Fable 최종 F7).
async function studentsSetBranch(classId,branchId,select){
  const c=students.data?.classes?.find(x=>x.id===classId);if(!branchId||branchId===c?.branch?.id)return;
  const name=students.data?.branches?.find(b=>b.id===branchId)?.name||'';
  if(c?.branch&&!confirm(`이 반의 지점을 「${name}」(으)로 바꿀까요? 반의 「오늘」 날짜와 지점별 집계가 그 지점 기준으로 바뀌어요.`)){if(select)select.value=c.branch.id;return;}
  try{await studentsRequest('classBranch',{classId,body:{action:'set',branchId,revision:c?.branch?.revision||0}});students.notice=c?.branch?'반의 지점을 바꿨어요.':'반의 지점을 정했어요.';students.error='';await studentsLoad({quiet:true});}
  catch(error){students.error=studentsErrorText(error);studentsPaint();}
}
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-st-action]');if(!target||!target.closest('#students-root, #st-card'))return;
  const action=target.dataset.stAction;
  if(action==='branch'){students.branch=target.dataset.branch;studentsPaint();}
  else if(action==='stage'){students.stage=students.stage===target.dataset.stage?'':target.dataset.stage;studentsPaint();}
  else if(action==='reload'){students.error='';students.notice='';studentsLoad({quiet:Boolean(students.data?.students)});}
  else if(action==='sign-in'){
    // 브라우저는 로그인 쪽으로 옮겨 갔다가 돌아온다. PC 앱처럼 그 자리에서 끝나면 바로 다시 읽는다(카본 A3).
    stReturnMark();const epoch=students.epoch;
    studentsBridge().then(bridge=>bridge.authSignIn()).then(auth=>{if(epoch===students.epoch&&auth?.signedIn){stReturnClear();studentsLoad();}})
      .catch(error=>{stReturnClear();if(epoch===students.epoch){students.error=error.message;studentsPaint();}});
  }
  else if(action==='card'){students.card={classId:target.dataset.class,learnerId:target.dataset.learner,error:'',key:null,draft:null};students.notice='';studentsPaintCard();}
  else if(action==='stay-close'){event.preventDefault();if(!students.saving)document.getElementById('st-card')?.close();}
  // 저장은 폼 제출로 한다. 칸에서 Enter를 눌러도 저장되고, 브라우저가 칸 검사(출석률 0~100 등)를 먼저 한다(카본 A1 · A2).
  else if(action==='stay-save'){event.preventDefault();target.form?.requestSubmit?.();}
  else if(action==='stay-delete'){event.preventDefault();if(!students.saving&&confirm('이 학생의 재학 기록을 지울까요? 지운 기록은 되돌릴 수 없어요.'))studentsSaveCard(true);}
});
document.addEventListener('submit',event=>{const form=event.target;if(!form?.matches?.('#st-card [data-st-form]'))return;event.preventDefault();studentsSaveCard(false);});
document.addEventListener('change',event=>{const select=event.target.closest?.('[data-st-branch-for]');if(select&&select.closest('#students-root'))studentsSetBranch(select.dataset.stBranchFor,select.value,select);});
window.addEventListener('pagehide',studentsReset);
