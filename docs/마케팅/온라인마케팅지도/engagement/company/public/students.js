'use strict';
// 학생 관리의 「틀」(자료 · 동작). 설계 docs/디자인/학생관리_20261127/설계.md.
// 해외 지점과 국내 담당이 한 화면에서 지점별 오늘 출결, 학생 한 명의 길, 재학생 만료 알림을 본다.
// 자료는 「LAB 한국어 수업」과 같은 SYNK ID 로그인으로 중앙 수업 서버의 교사 개요(/api/teacher/overview 붙임)에서 읽는다. 회사 서버에는 학생 자료를 두지 않는다.
// 볼 수 있는 반은 중앙의 반 배정이 정한다. 출결 찍기와 TOPIK 넣기는 LAB 반 화면이 맡고, 이 화면은 재학 기록과 반의 지점만 고친다.
// 겉(HTML)은 students-view.js(StudentsView)가 그린다. 이 파일은 보기 자료(vm)를 만들어 넘기고 단추의 data-st-action만 읽는다.
// 학생 카드는 시안 3 「한 장」대로 「챙길 차례」 목록 안에서 펼쳐진다. 목록을 다시 그릴 때 쓰던 칸 · 초점 · 고른 알약 자리를 지킨다.
const ST_FRESH=()=>({desktopOld:false,bridge:null,owner:null,canListen:false,unsubscribe:null,data:null,auth:null,loading:false,error:'',notice:'',branch:'all',stage:'',card:null,saving:false,away:false,others:false,focusNext:null,focusLater:null});
const students={...ST_FRESH(),epoch:0};
// 중앙 lib/synk-classroom-students.js의 STAGES · VISAS와 같은 값이다. 이름은 화면 글이다(맹검 「설명 없는 PATH」 지적으로 「유학 수속」).
const ST_STAGES=[['academy','어학원 재원','반에서 TOPIK · 회화 · 영어 수업'],['path','유학 수속','PATH로 서류 점검 · 번역 초안 · 면접 연습'],['arrived','입국 · 정착','주거 계약 · 정착 멘토'],['enrolled','한국 재학','출석 · 체류 · TOPIK 유지']];
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
// 계정이 바뀌거나 로그아웃하면 앞 계정의 학생 자료 · 거르기 · 안내 · 열린 카드를 모두 지운다(카본 A5). 카드는 목록 안에 있으므로 다음 그리기에서 사라진다.
function studentsCloseCard(){students.card=null;students.saving=false;}
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

// ── 다시 그리기: 쓰던 칸 · 초점 · 고른 알약 자리를 지킨다 ──
// 화면은 innerHTML로 통째 다시 그린다. 그 전에 카드의 쓰던 칸(카본 A1 · A7)과 초점 자리([data-st-focus] 또는 칸 이름)를 읽고, 그린 뒤 되돌린다.
function studentsCardKeep(root){
  const form=root?.querySelector?.('[data-st-form]');if(!form||!students.card||form.dataset.key!==students.card.classId+':'+students.card.learnerId)return null;
  const draft={};for(const name of ST_FIELDS)if(form.elements[name])draft[name]=form.elements[name].value;
  return draft;
}
function studentsFocusRead(root){
  const el=document.activeElement;if(!el||!root.contains(el))return null;
  if(el.name&&el.form?.matches?.('[data-st-form]')){let caret=null;try{if(typeof el.selectionStart==='number')caret=[el.selectionStart,el.selectionEnd];}catch{}return {name:el.name,caret};}
  if(el.matches('[data-st-form]'))return students.focusLater?{key:students.focusLater}:{form:true};
  const key=el.closest('[data-st-focus]')?.dataset.stFocus;return key?{key}:null;
}
function studentsFocusWrite(root,kept){
  const moved=students.focusNext;students.focusNext=null;
  const want=moved?{key:moved}:kept;if(!want)return;
  let el=want.name?root.querySelector(`[data-st-form] [name="${CSS.escape(want.name)}"]`):want.key?root.querySelector(`[data-st-focus="${CSS.escape(want.key)}"]`):want.form?root.querySelector('[data-st-form]'):null;
  // 저장하는 동안 저장 단추가 잠기면 카드에 초점을 두었다가, 풀리면 그 단추로 돌려준다.
  // 그 자리가 사라졌으면(지우기 뒤의 지우기 단추, 옮겨 간 줄) 열린 카드에 초점을 둔다(카본 A4).
  if(!el&&students.card&&(want.name||want.form||/^(card-|ag:)/.test(want.key||'')))el=root.querySelector('[data-st-form]');
  if(el?.disabled){students.focusLater=want.key||null;el=root.querySelector('[data-st-form]');}else if(want.key)students.focusLater=null;
  if(!el)return;el.focus({preventScroll:true});
  if(want.caret)try{el.setSelectionRange(want.caret[0],want.caret[1]);}catch{}
  if(moved)el.scrollIntoView?.({block:'nearest'});
}
// 고르는 줄(지점 · 단계)은 회색 홈 안 흰 알약이다. 고른 칸이 바뀌면 앞 칸에서 새 칸으로 앞쪽 끝이 먼저 닿게 옮겨 간다(420ms). 움직임 줄이기면 바로 바뀐다.
function studentsJellyRead(root){
  const at={};for(const group of root.querySelectorAll('[data-st-jelly]')){const b=group.querySelector(':scope>[aria-pressed="true"]');at[group.dataset.stJelly]={scroll:group.scrollLeft,...(b&&b.offsetWidth?{id:b.dataset.stFocus,x:b.offsetLeft,w:b.offsetWidth}:{})};}
  return at;
}
function studentsJellyWrite(root,at){
  const still=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  for(const group of root.querySelectorAll('[data-st-jelly]')){
    const was=at[group.dataset.stJelly];if(!was)continue;group.scrollLeft=was.scroll;
    const b=group.querySelector(':scope>[aria-pressed="true"]');
    if(still||!was.id||!b||was.id===b.dataset.stFocus||!b.offsetWidth||typeof b.animate!=='function')continue;
    const pill=document.createElement('span');pill.className='st-jelly';pill.setAttribute('aria-hidden','true');group.prepend(pill);b.classList.add('st-arriving');
    const A={x:was.x,w:was.w},B={x:b.offsetLeft,w:b.offsetWidth},right=B.x>A.x,mix=(p,q,t)=>p+(q-p)*t;
    const lead=right?mix(A.x,B.x,.22):mix(A.x,B.x,.78),tail=right?mix(A.x+A.w,B.x+B.w,.78):mix(A.x+A.w,B.x+B.w,.22);
    const frame=(x,w,y)=>({transform:`translateX(${x}px) scaleY(${y})`,width:w+'px'});
    const motion=pill.animate([frame(A.x,A.w,1),{...frame(lead,tail-lead,.88),offset:.45},{...frame(B.x,B.w,1.05),offset:.78},frame(B.x,B.w,1)],{duration:420,easing:'cubic-bezier(.3,.7,.25,1)'});
    const done=()=>{pill.remove();b.classList.remove('st-arriving');};motion.onfinish=done;motion.oncancel=done;
  }
}
// 쓰던 칸은 사용자가 바꾼 칸만이다. 마지막으로 그린 저장값(card.base)과 다른 칸만 남긴다.
// 그래서 카드를 연 채 다시 읽으면 손대지 않은 칸에는 새 값이 들어오고, 옛 값이 새 판 번호와 함께 저장되어 남의 고침을 덮지 않는다(Fable 최종 F1).
function studentsChanged(typed,base){
  if(!base)return typed;const out={};
  for(const [name,value] of Object.entries(typed))if(String(value??'')!==String(base[name]??''))out[name]=value;
  return Object.keys(out).length?out:null;
}
function studentsPaint(){
  const root=document.getElementById('students-root');if(!root)return;
  const draft=studentsCardKeep(root),focus=studentsFocusRead(root),jelly=studentsJellyRead(root);
  if(students.card){if(draft&&!students.card.draftCleared)students.card.draft=studentsChanged(draft,students.card.base);students.card.draftCleared=false;}
  root.innerHTML=StudentsView.inner(studentsModel());studentsBars(root);studentsFocusWrite(root,focus);studentsJellyWrite(root,jelly);
}

// ── 보기 자료(vm): 겉이 바뀌어도 그대로인 셈 ──
const stStage=id=>ST_STAGES.find(row=>row[0]===id)?.[1]||'어학원 재원';
const stJosa=(word,a,b)=>{const w=String(word||''),c=w.charCodeAt(w.length-1)-0xAC00;return c>=0&&c<11172&&c%28?a:b;};
const stMd=value=>{if(!value)return '';const [,m,d]=value.split('-').map(Number);return `${m}.${String(d).padStart(2,'0')}`;};
function stDateLabel(value){if(!value)return '';const [y,m,d]=value.split('-').map(Number);return `${m}월 ${d}일 ${'일월화수목금토'[new Date(Date.UTC(y,m-1,d)).getUTCDay()]}요일`;}
const stLeft=n=>n>0?`${n}일 남음`:n===0?'오늘 만료':`${-n}일 지남`;
// 알림 하나(학생 한 명의 한 종류)를 「챙길 차례」 한 줄로. 날짜 없는 알림(연속 결석 · 출석)과 이미 지난 만료는 「지금」에 둔다.
function stAgendaItems(alert,l){
  const v=l.stay||{},out=[],base={classId:alert.classId,learnerId:alert.learnerId,name:l.name||'이름 없음'},mentor=v.mentorName?`멘토 ${v.mentorName}`:'';
  const where=(...bits)=>[...bits,mentor].filter(Boolean).join(' · ');
  for(const k of alert.kinds){
    if(k.kind==='streak')out.push({...base,anchor:'streak',rank:0,date:null,what:`${k.count}회 이어서 결석`,say:`${k.count}회 연속 결석`,where:where(l.className),tone:'bad',tail:''});
    else if(k.kind==='attendance'){const uni=k.source==='university';out.push({...base,anchor:uni?'attendance-university':'attendance',rank:1,date:null,what:`${uni?'대학 ':''}출석 ${k.percent}%`,say:`${uni?'대학 ':''}출석 ${k.percent}%`,where:uni?where(v.university,v.program):where(l.className),tone:'bad',tail:''});}
    else if(k.kind==='stay'||k.kind==='topik'){
      const stay=k.kind==='stay',label=stay?'체류':'TOPIK',t=l.topikBest,n=k.daysLeft;
      out.push({...base,anchor:k.kind,rank:2,date:k.expiresOn||null,daysLeft:n,what:`${label} 만료`,
        say:n>0?`${label} 만료 ${n}일 전`:n===0?`오늘 ${label} 만료`:`이미 ${-n}일 지난 ${label} 만료`,
        where:stay?where(v.university||l.className,v.program,k.visaKind?`비자 ${k.visaKind}`:''):where(l.className,`TOPIK ${t?.kind==='I'?'I':'II'} ${k.level}급`),
        tone:n<=30?'bad':'warn',tail:n>0?`D-${n}`:`${stMd(k.expiresOn)} 만료`,spoken:`, ${stLeft(n)}`});
    }
  }
  return out;
}
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
  // 반 차례는 중앙 응답 차례에 기대지 않는다. 지점이 있는 반을 지점 이름 · 반 이름 차례로, 지점 미정 반을 끝에 둔다.
  const ko=(a,b)=>String(a||'').localeCompare(String(b||''),'ko');
  const classes=all.filter(c=>branch==='all'||(branch==='none'?!c.branch:c.branch?.id===branch)).sort((a,b)=>(a.branch?0:1)-(b.branch?0:1)||ko(a.branch?.name,b.branch?.name)||ko(a.name,b.name));
  const ids=new Set(classes.map(c=>c.id)),learners=classes.flatMap(c=>(c.learners||[]).map(l=>({...l,classId:c.id,className:c.name||''})));
  const alerts=s.alerts.filter(a=>ids.has(a.classId));
  const today={present:0,late:0,absent:0,excused:0,unrecorded:0};
  for(const c of classes)for(const key of Object.keys(today))today[key]+=c.branchToday?.counts?.[key]||0;
  const counted=today.present+today.late+today.absent,shared=learners.filter(l=>l.shared);
  let primary=false;
  const rows=classes.map(c=>{const k=c.branchToday?.counts||{},total=c.branchToday?.sharedLearnerCount||0,done=(k.present||0)+(k.late||0),marked=done+(k.absent||0)+(k.excused||0);
    const first=!primary&&total>0&&(k.unrecorded||0)>0;if(first)primary=true;
    return {id:c.id,name:c.name||'이름 없는 반',branchId:c.branch?.id||'',branchName:c.branch?.name||'',sessionDate:c.branchToday?.sessionDate||'',total,done,recorded:marked>0,primary:first,width:total?Math.round(done*100/total):0,counts:{absent:k.absent||0,late:k.late||0,excused:k.excused||0,unrecorded:k.unrecorded||0}};});
  // 챙길 차례: 알림을 종류마다 한 줄로 풀고, 날짜 없는 것 → 이미 지난 것 → 끝나는 날 차례로 둔다.
  const byKey=new Map(learners.map(l=>[l.classId+':'+l.id,l])),alerted=new Set(),items=[];
  for(const a of alerts){const l=byKey.get(a.classId+':'+a.learnerId);if(!l)continue;alerted.add(a.classId+':'+a.learnerId);if(stage&&l.stage!==stage)continue;items.push(...stAgendaItems(a,l));}
  const sortKey=i=>i.date===null?'0'+i.rank:(i.daysLeft<=0?'1':'2')+i.date;
  items.sort((a,b)=>sortKey(a).localeCompare(sortKey(b))||ko(a.name,b.name)||ko(a.anchor,b.anchor));
  const basisYear=String(s.basisDate||'').slice(0,4),groups=[];
  for(const i of items){
    const key=i.date===null||i.daysLeft<=0?'now':i.date.slice(0,7),[y,m]=key.split('-');
    if(groups.at(-1)?.key!==key)groups.push({key,label:key==='now'?'지금':`${y!==basisYear?y+'년 ':''}${Number(m)}월`,items:[]});
    groups.at(-1).items.push({...i,date:key==='now'?'':stMd(i.date)});
  }
  const others=shared.filter(l=>!alerted.has(l.classId+':'+l.id)&&(!stage||l.stage===stage)).sort((a,b)=>ko(a.name,b.name)).map(l=>({classId:l.classId,learnerId:l.id,anchor:'other',name:l.name||'이름 없음',date:'',what:stStage(l.stage),
    where:[l.className,l.stay?.university,l.stay?.program].filter(Boolean).join(' · '),tail:l.attendanceRate?`출석 ${l.attendanceRate.percent}%`:'',tone:''}));
  const off=learners.filter(l=>!l.shared).map(l=>l.name||'이름 없음');
  // 펼친 카드는 연 줄 아래에 선다. 그 줄이 다시 읽은 뒤 사라졌으면(저장으로 알림이 바뀜) 같은 학생의 첫 줄, 그것도 없으면 목록 위에 따로 선다.
  let othersOpen=students.others,cardVm=null,loose=false;
  const card=students.card,found=card&&studentsFind(card.classId,card.learnerId);
  if(card&&!found)students.card=null;
  else if(card){
    const mine=i=>i.classId===card.classId&&i.learnerId===card.learnerId,rowsNow=[...groups.flatMap(g=>g.items),...others];
    let at=groups.flatMap(g=>g.items).find(i=>mine(i)&&i.anchor===card.anchor)||(othersOpen||card.anchor==='other'?others.find(mine):null)||rowsNow.find(mine);
    if(at&&at.anchor==='other')othersOpen=students.others=true;
    if(at){at.open=true;card.anchor=at.anchor;card.from=`ag:${at.classId}:${at.learnerId}:${at.anchor}`;}else loose=true;
    cardVm=studentsCardModel(found.c,found.l);
  }
  const who=new Set(items.map(i=>i.classId+':'+i.learnerId)).size,top=items[0]||null;
  const branchLabel=chipList.find(c=>c.id===branch)?.label||'';
  const scope=branch==='all'?'오늘':branch==='none'?'오늘 지점을 정하지 않은 반은':`오늘 ${branchLabel}${stJosa(branchLabel,'은','는')}`;
  const ending=what=>/[%\d]$/.test(what)?'예요':stJosa(what,'이에요','예요');
  return {phase:'ready',notice,ready:{basisDate:s.basisDate,dateLabel:stDateLabel(s.basisDate),assignedClassCount:s.assignedClassCount,loading:students.loading,chips,rules:s.rules,
    // 공결만 찍힌 날도 찍은 것으로 센다. 출석률은 공결을 뺀 셈이고, 모두 공결이면 그렇게 말한다(카본 A5).
    // 챙길 학생 수와 가장 급한 일은 오른쪽 단계 거르기를 따르므로 단계 이름을 함께 말한다(카본 A2).
    say:{scope,classCount:classes.length,recorded:counted+today.excused>0,came:today.present+today.late,rate:counted?Math.round((today.present+today.late)*100/counted):null,who,stageLabel:stage?stStage(stage):'',
      top:top?{classId:top.classId,learnerId:top.learnerId,anchor:top.anchor,name:top.name,tone:top.tone,what:top.say,ending:ending(top.say)}:null},
    sharedCount:shared.length,stages:ST_STAGES.map(([id,label])=>({id,label,count:shared.filter(l=>l.stage===id).length,pressed:stage===id})),stageFilter:stage,
    desktopOld:Boolean(students.desktopOld),classes:rows,branchOptions:(o.branches||[]).filter(b=>b.active).map(b=>({id:b.id,name:b.name})),
    agenda:groups,emptyText:stage?`${stStage(stage)} 학생 가운데 지금 챙길 학생은 없어요.`:'지금 챙길 학생은 없어요.',
    others:{open:othersOpen,items:others,off},card:cardVm,cardLoose:loose}};
}
// ── 학생 카드 ──
function studentsFind(classId,learnerId){const c=students.data?.classes?.find(x=>x.id===classId);const l=c?.learners?.find(x=>x.id===learnerId);return c&&l&&l.shared?{c,l}:null;}
const ST_FIELDS=['stage','visaKind','university','program','stayExpiresOn','enteredOn','mentorStaffId','universityAttendance','universityAttendanceOn','note'];
function studentsSaved(l){const v=l.stay||{};return {stage:l.stage||'academy',visaKind:v.visaKind||'',university:v.university||'',program:v.program||'',stayExpiresOn:v.stayExpiresOn||'',enteredOn:v.enteredOn||'',mentorStaffId:v.mentorStaffId||'',universityAttendance:v.universityAttendance??'',universityAttendanceOn:v.universityAttendanceOn||'',note:v.note||''};}
function studentsCardModel(c,l){
  const v=l.stay||{},draft=students.card?.draft||null,t=l.topikBest,saved=studentsSaved(l);
  if(students.card)students.card.base=saved;
  const fields=draft?{...saved,...draft}:saved,step=ST_STAGES.findIndex(r=>r[0]===(l.stage||'academy')),e=v.expiry;
  return {key:c.id+':'+l.id,name:l.name||'이름 없음',className:c.name||'',branchName:c.branch?.name||'',steps:ST_STAGES.map(([,label],i)=>({label,state:i<step?'done':i===step?'now':''})),
    topik:t?{kind:t.kind==='I'?'I':'II',level:t.level,expiresOn:t.expiresOn,daysLeft:t.daysLeft}:null,attendance:l.attendanceRate?{percent:l.attendanceRate.percent,recorded:l.attendanceRate.recorded}:null,
    stay:e&&v.stayExpiresOn?{expiresOn:v.stayExpiresOn,daysLeft:e.daysLeft,tone:e.state==='expired'||e.state==='within30'?'bad':e.state==='within120'?'warn':''}:null,
    fields,options:{stages:ST_STAGES.map(([id,label])=>({id,label})),visas:ST_VISAS.map(([id,label])=>({id,label})),staff:(c.staff||[]).map(s=>({id:s.id,label:s.name}))},
    error:students.card?.error||'',done:students.card?.done||'',saving:students.saving,hasRecord:Boolean(l.stay),desktopOld:students.desktopOld};
}
// 카드는 대화 상자가 아니라 목록 안에 펼쳐지므로 다른 줄 · 지점 · 단계를 누르면 닫힌다. 쓰던 칸이 있으면 먼저 묻는다.
function studentsCardDirty(){
  const card=students.card,found=card&&studentsFind(card.classId,card.learnerId);if(!found)return false;
  const typed=studentsCardKeep(document.getElementById('students-root'))||card.draft;if(!typed)return false;
  const saved=studentsSaved(found.l);return ST_FIELDS.some(name=>name in typed&&String(typed[name]??'')!==String(saved[name]??''));
}
function studentsMayDropCard(){return !students.card||!students.saving&&(!studentsCardDirty()||confirm('쓰던 재학 기록을 저장하지 않고 닫을까요?'));}
function studentsCloseCardHere(){
  const card=students.card;if(!card||!studentsMayDropCard())return;
  students.card=null;students.focusNext=card.from||null;studentsPaint();
}
async function studentsSaveCard(remove=false){
  const card=students.card,found=card&&studentsFind(card.classId,card.learnerId),form=document.querySelector('#students-root [data-st-form]');if(!found||!form||students.saving)return;
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
  students.saving=true;card.error='';card.done='';studentsPaint();
  try{
    await studentsRequest('stay',{classId:c.id,body});card.done=remove?'재학 기록을 지웠어요.':'재학 기록을 저장했어요.';card.key=null;
    const typed=studentsCardKeep(document.getElementById('students-root'));card.draft=null;card.draftCleared=true;
    // 저장은 됐는데 다시 읽기가 새 기록을 못 받았으면 옛 값으로 되돌리지 않고 쓴 칸을 두고 그렇게 알린다(Fable 다시 검수 FA2).
    if(!await studentsLoad({quiet:true})&&students.card===card){card.done+=' 새 값을 아직 다시 읽지 못했어요. 잠시 뒤 카드를 닫고 「새로 고침」을 눌러 주세요.';if(!remove){card.draft=typed;card.draftCleared=true;}}
  }catch(error){
    if(error.status===409){
      // 다른 곳에서 먼저 고쳤거나 공유가 바뀌었다. 새 판을 다시 읽되 쓰던 칸은 그대로 둔다.
      card.key=null;card.error=`${error.message} 새 기록을 다시 불러왔어요. 쓰신 칸은 그대로 두었으니 확인한 뒤 다시 저장해 주세요.`;await studentsLoad({quiet:true});
    }else card.error=studentsErrorText(error);
  }finally{students.saving=false;studentsPaint();}
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
// 쓰던 칸이 있는 카드를 두고 다른 탭(「반에서 찍기」, 왼쪽 메뉴, 아래 탭)으로 가면 먼저 묻는다. 거절하면 이 화면에 남는다.
// 로그인이 풀려 지우는 길은 묻지 않는다. 앱의 탭 처리보다 먼저 듣도록 window에서 잡는다(Fable 최종 F2).
window.addEventListener('click',event=>{
  const go=event.target.closest?.('[data-action="tab"]');
  if(!go||go.dataset.tab==='students'||state.tab!=='students'||!students.card||students.saving||!studentsCardDirty())return;
  if(confirm('쓰던 재학 기록을 저장하지 않고 이 화면을 떠날까요?'))return;
  event.preventDefault();event.stopImmediatePropagation();
},true);
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-st-action]');if(!target||!target.closest('#students-root'))return;
  const action=target.dataset.stAction;
  if(action==='branch'){if(students.branch===target.dataset.branch||!studentsMayDropCard())return;students.card=null;students.branch=target.dataset.branch;studentsPaint();}
  else if(action==='stage'){if(students.stage===target.dataset.stage||!studentsMayDropCard())return;students.card=null;students.stage=target.dataset.stage;studentsPaint();}
  else if(action==='others'){if(students.others&&students.card?.anchor==='other'){if(!studentsMayDropCard())return;students.card=null;}students.others=!students.others;studentsPaint();}
  else if(action==='reload'){students.error='';students.notice='';studentsLoad({quiet:Boolean(students.data?.students)});}
  else if(action==='sign-in'){
    // 브라우저는 로그인 쪽으로 옮겨 갔다가 돌아온다. PC 앱처럼 그 자리에서 끝나면 바로 다시 읽는다(카본 A3).
    stReturnMark();const epoch=students.epoch;
    studentsBridge().then(bridge=>bridge.authSignIn()).then(auth=>{if(epoch===students.epoch&&auth?.signedIn){stReturnClear();studentsLoad();}})
      .catch(error=>{stReturnClear();if(epoch===students.epoch){students.error=error.message;studentsPaint();}});
  }
  else if(action==='card'){
    // 같은 줄을 다시 누르면 접는다. 문장 속 이름을 누르면 「챙길 차례」의 그 줄로 초점이 옮겨 간다.
    const next={classId:target.dataset.class,learnerId:target.dataset.learner,anchor:target.dataset.anchor||''},card=students.card;
    const same=card&&card.classId===next.classId&&card.learnerId===next.learnerId&&(card.anchor===next.anchor||target.dataset.stFocus==='say-name');
    if(same&&target.dataset.stFocus!=='say-name'){studentsCloseCardHere();return;}
    if(same){students.focusNext=card.from||null;studentsPaint();return;}
    if(!studentsMayDropCard())return;
    students.card={...next,error:'',done:'',key:null,draft:null};students.notice='';
    if(target.dataset.stFocus==='say-name')students.focusNext=`ag:${next.classId}:${next.learnerId}:${next.anchor}`;
    studentsPaint();
  }
  else if(action==='stay-close'){event.preventDefault();studentsCloseCardHere();}
  // 저장은 폼 제출로 한다. 칸에서 Enter를 눌러도 저장되고, 브라우저가 칸 검사(출석률 0~100 등)를 먼저 한다(카본 A1 · A2).
  else if(action==='stay-save'){event.preventDefault();target.form?.requestSubmit?.();}
  else if(action==='stay-delete'){event.preventDefault();if(!students.saving&&confirm('이 학생의 재학 기록을 지울까요? 지운 기록은 되돌릴 수 없어요.'))studentsSaveCard(true);}
});
document.addEventListener('submit',event=>{const form=event.target;if(!form?.matches?.('#students-root [data-st-form]'))return;event.preventDefault();studentsSaveCard(false);});
document.addEventListener('change',event=>{const select=event.target.closest?.('[data-st-branch-for]');if(select&&select.closest('#students-root'))studentsSetBranch(select.dataset.stBranchFor,select.value,select);});
// 펼친 카드 안에서 Esc를 누르면 카드를 접고 연 줄로 초점을 돌린다. 저장하는 동안에는 접지 않는다(카본 A2).
// 초점이 카드를 연 줄에 있어도 접는다(카본 A3).
document.addEventListener('keydown',event=>{if(event.key!=='Escape'||!students.card||!event.target.closest?.('#students-root [data-st-form], #students-root .st-ag[aria-expanded="true"]'))return;event.preventDefault();studentsCloseCardHere();});
window.addEventListener('pagehide',studentsReset);
