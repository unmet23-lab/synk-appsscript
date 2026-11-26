// 반 화면 위 「오늘 출결」 띠와 학생 줄 TOPIK 칸(학원 운영 최소판, docs/디자인/학원운영_출결_TOPIK_20261127/설계.md 9절).
// 계정을 잇고 학습 공유를 켠 학생만 찍는다. 서버(synk-classroom /api/teacher/attendance · /api/teacher/topik)가 범위 · 판 · 날짜를 다시 본다.
// 서버가 반 응답에 attendance를 싣지 않으면(기능 스위치 꺼짐) 이 띠는 그리지 않는다.
import {learnerOverview,compareTeacherRows} from './workspace-overview.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const list=value=>Array.isArray(value)?value:[];
export const STATUS_LABELS=Object.freeze({present:'출석',late:'지각',absent:'결석',excused:'공결'});
const STATUSES=Object.keys(STATUS_LABELS);
export const TOPIK_LEVELS=Object.freeze({I:[1,2,0],II:[3,4,5,6,0]});
const BADGE=Object.freeze({valid:['유효','good'],within90:['90일 안 만료','warn'],within30:['30일 안 만료','bad'],expired:['만료','bad']});
const NOTE_LIMIT=200,PAST_DAYS=400,FUTURE_DAYS=1;
// 통로마다 오류 꼴이 다르다: 계정 포털 · PC 앱은 서버 코드 그대로, 회사 워크스페이스 중계는 TEACHING_CLASSROOM_ 뒤에 서버 코드를 붙인다.
const reasonOf=error=>String(error?.code||'').replace(/^TEACHING_CLASSROOM_/,'');
const NOT_CONFLICT=['RECORDS_BUSY','ATTENDANCE_CAPACITY','IDEMPOTENCY_CONFLICT'];
const TOPIK_NOT_CONFLICT=['RECORDS_BUSY','IDEMPOTENCY_CONFLICT','TOPIK_DUPLICATE','TOPIK_CAPACITY'];
const BUSY_TEXT='반 명단이 방금 바뀌었어요. 고르던 내용은 그대로 있어요. 잠시 뒤 다시 저장해 주세요.';
// 코드별 문구. PC 앱 통로는 서버 문구를 지우고 코드만 넘기므로, 아는 코드는 어느 통로든 이 글로 까닭을 보인다. scope는 'attendance' · 'day' · 'topik'.
export function reasonText(reason,scope='attendance'){
  switch(reason){
    case 'RECORDS_BUSY':return BUSY_TEXT;
    case 'NETWORK_ERROR':return scope==='day'?'연결을 확인하지 못했어요. 날짜를 다시 골라 주세요.':'연결을 확인하지 못했어요. 고르던 내용은 그대로 있어요. 다시 저장해 주세요.';
    case 'TOPIK_DUPLICATE':return '같은 회차 TOPIK 성적이 이미 있어요. 표에서 그 성적을 고쳐 주세요.';
    case 'TOPIK_CAPACITY':return '이 학생의 TOPIK 성적이 20회로 가득 찼어요. 지난 성적을 지운 뒤 넣어 주세요.';
    case 'ATTENDANCE_CAPACITY':return '이 반의 출결 기록이 가득 찼어요. 이미 찍은 날은 이어서 고칠 수 있어요.';
    case 'SHARING_DISABLED':return scope==='topik'?'이 학생이 학습 공유를 꺼서 TOPIK 성적을 남길 수 없어요.':'학습 공유를 끈 학생이 있어 저장하지 못했어요. 명단을 확인한 뒤 다시 저장해 주세요.';
    case 'DATE_OUT_OF_RANGE':return scope==='topik'?'성적 발표일은 2000-01-01부터 내일까지 고를 수 있어요.':'출결 날짜는 오늘부터 400일 전까지, 내일까지만 고를 수 있어요.';
    default:return null;
  }
}
const missingText=missing=>(missing.length===1?missing[0].name:missing[0].name+' 외 '+(missing.length-1)+'명')+'의 출결 상태를 먼저 골라 주세요. 사유 메모는 상태와 함께 저장돼요.';
const dateValue=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
export const addDays=(value,days)=>{const [y,m,d]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)+days*86400000).toISOString().slice(0,10);};
// 학원 현지 날짜(이 기기의 달력). 서버는 범위만 본다.
export const localDate=(at=new Date())=>[at.getFullYear(),String(at.getMonth()+1).padStart(2,'0'),String(at.getDate()).padStart(2,'0')].join('-');
const savedTime=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
const randomKey=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);

export const levelLabel=level=>Number(level)>0?Number(level)+'급':'미달';
export function topikBadge(record){
  if(!record)return null;
  const failed=record.passed===false||record.level===0,[label,tone]=failed?['미달','neutral']:BADGE[record.state]||['확인 필요','neutral'];
  const detail=failed?record.announcedOn+' 발표':record.state==='expired'?record.expiresOn+' 만료':record.state==='valid'?'만료일 '+record.expiresOn:'D-'+record.daysLeft+' · 만료일 '+record.expiresOn;
  return {label,tone,title:'TOPIK '+record.kind+' '+levelLabel(record.level),detail};
}

// 반 응답(/api/workspace)에서 띠에 필요한 것만 꺼낸다. attendance가 없으면 null(띠를 그리지 않는다).
export function classRecordsModel(workspace,classId){
  const classroom=list(workspace?.classes).find(row=>row.id===classId);
  if(!classroom?.attendance||!dateValue(classroom.attendance.basisDate))return null;
  const learners=list(classroom.learners).filter(row=>typeof row.id==='string'&&row.id).map(row=>{
    const sharing=learnerOverview({...row,classId}).sharing;
    return {id:row.id,name:row.name||'이름 확인 필요',shared:sharing==='shared'&&row.topik?.shared===true,sharing,revision:Number.isSafeInteger(row.sharing?.revision)?row.sharing.revision:null,topik:row.topik||null,streak:Number.isSafeInteger(row.absentStreak)?row.absentStreak:0};
  }).sort(compareTeacherRows);
  return {classId,name:classroom.name||'',basisDate:classroom.attendance.basisDate,sessionDate:classroom.attendance.sessionDate||classroom.attendance.basisDate,rows:list(classroom.attendance.rows),learners,capacityReached:classroom.attendance.capacityReached===true};
}
// 저장할 묶음: 상태를 고른 공유 학생 모두. 그대로인 줄도 판을 함께 보내, 다른 화면이 먼저 고친 줄을 덮지 않고 409로 알린다.
// 판(revision)은 표 전체가 함께 쓰는 순번이라 1, 2, 3으로 오르지 않는다. 받은 값을 그대로 돌려보내고, 아직 없는 줄만 0이다.
export function attendanceRows(learners,saved,draft){
  return learners.filter(l=>l.shared).flatMap(l=>{
    const old=saved.get(l.id),next=draft.get(l.id),status=next?.status??old?.status;
    if(!status)return [];
    return [{learnerId:l.id,status,note:String(next?.note??old?.note??'').trim().slice(0,NOTE_LIMIT),revision:old?.revision||0}];
  });
}
const effective=(l,saved,draft)=>{const old=saved.get(l.id),next=draft.get(l.id);return {status:next?.status??old?.status??null,note:String(next?.note??old?.note??'').trim(),old};};
// 「저장 전」 판정과 저장 대상이 함께 쓰는 한 규칙: 공유 학생 줄의 상태나 메모가 저장본과 다르면 바뀐 줄이다.
const rowChanged=(l,saved,draft)=>{if(!l.shared||!draft.has(l.id))return false;const {status,note,old}=effective(l,saved,draft);return status!==(old?.status??null)||note!==(old?.note??'');};
export function attendanceDirty(learners,saved,draft){return learners.some(l=>rowChanged(l,saved,draft));}
// 바뀐 줄인데 상태가 없는 줄(상태 없이 메모만 쓴 줄). 저장하지 않고 상태를 먼저 고르라고 알린다.
export function attendanceMissingStatus(learners,saved,draft){return learners.filter(l=>rowChanged(l,saved,draft)&&!effective(l,saved,draft).status);}
export function attendanceCounts(learners,saved,draft){
  const counts={present:0,late:0,absent:0,excused:0,unrecorded:0};
  for(const l of learners.filter(row=>row.shared)){const {status}=effective(l,saved,draft);if(status)counts[status]++;else counts.unrecorded++;}
  return counts;
}

export function createClassRecords({root,request,notice=()=>{},guard=()=>{},onSaved=()=>{},documentObject=globalThis.document,now=()=>new Date()}){
  let stopped=false,model=null,sessionDate=null,saved=new Map(),draft=new Map(),key=null,busy=false,openTopik=null,editing=null,topikDraft=null,topikTouched=false,topikError=null,message='',missingMessage='',focused=null,version=0;
  const shared=()=>model?.learners.filter(l=>l.shared)||[];
  const learner=id=>model?.learners.find(l=>l.id===id);
  const today=()=>localDate(now());
  const inRange=date=>!!model&&date<=addDays(model.basisDate,FUTURE_DAYS)&&date>=addDays(model.basisDate,-PAST_DAYS);
  const confirm=text=>{const view=documentObject?.defaultView;return typeof view?.confirm!=='function'||view.confirm(text)===true;};
  function setSaved(rows){saved=new Map(list(rows).map(row=>[row.learnerId,row]));}
  function clearTopikForm(){editing=null;topikDraft=null;topikTouched=false;topikError=null;}
  function fail(error,scope){
    if(stopped||error?.code==='ACCOUNT_CHANGED')return;const text=String(error?.message||'');
    message=reasonText(reasonOf(error),scope)||(text&&!/^[A-Z][A-Z0-9_]*$/.test(text)?text:'저장하지 못했어요. 잠시 뒤 다시 해 주세요.');notice(message,true);
  }
  async function call(path,body){guard();const result=await request(path,body);guard();if(stopped)throw Object.assign(new Error('닫힌 화면이에요.'),{code:'ACCOUNT_CHANGED'});return result;}
  // 한 번에 하나만 보낸다. 뒤에 시작한 요청이 있으면 앞 요청의 답은 버린다.
  // busy로 다시 그리면 조작 요소가 꺼져 초점이 빠진다. 그 전에 초점 자리를 기억해 두었다가 끝난 뒤 그 자리로(없어졌거나 꺼졌으면 다음 자리로) 돌려놓는다.
  async function run(task,{fallback=null,scope='attendance'}={}){
    if(busy)return;const back=activeSelector();busy=true;paint();const ticket=++version;
    try{await task(()=>ticket===version);}catch(error){if(ticket===version)fail(error,scope);}
    finally{if(ticket===version){busy=false;paint(null,back,fallback,'[data-att-message]');}}
  }
  const loadDay=date=>run(async current=>{
    const result=await call('/api/teacher/attendance',{action:'day',sessionDate:date});if(!current())return;
    sessionDate=result.sessionDate;setSaved(result.attendance);draft=new Map();key=null;message='';
  },{scope:'day'});
  const save=()=>{
    const missing=attendanceMissingStatus(model.learners,saved,draft);
    if(missing.length){
      message=missingMessage=missingText(missing);notice(message,true);
      paint('[data-att-status="present"][data-learner="'+missing[0].id+'"]');return;
    }
    const rows=attendanceRows(model.learners,saved,draft);if(!rows.length)return;
    key??=randomKey();const date=sessionDate;
    return run(async current=>{
      try{
        const result=await call('/api/teacher/attendance',{action:'save',sessionDate:date,idempotencyKey:key,rows});if(!current())return;
        // 재전송(duplicate)이면 앞서 저장된 것이고, 받은 기록은 지금 서버의 기록이다.
        setSaved(result.attendance);draft=new Map();key=null;message=result.duplicate===true?date+' 출결은 이미 저장돼 있어요. 지금 기록으로 보여 드려요.':rows.length+'명의 '+date+' 출결을 저장했어요.';notice(message);onSaved();
      }catch(error){
        // 판 충돌만 그날을 다시 받는다. 명단 잠금(RECORDS_BUSY)은 같은 묶음 · 같은 키로 잠시 뒤 다시 보내면 되고, 고르던 내용은 그대로 둔다.
        const reason=reasonOf(error);if(reason==='IDEMPOTENCY_CONFLICT')key=null;
        if(error?.status!==409||!current()||NOT_CONFLICT.includes(reason))throw error;
        // 다른 화면이 먼저 고쳤으면 그날을 다시 받는다. 고르던 내용은 남겨 확인한 뒤 다시 저장할 수 있게 한다.
        const fresh=await call('/api/teacher/attendance',{action:'day',sessionDate:date});if(!current())return;
        setSaved(fresh.attendance);key=null;message='다른 화면에서 이 날 출결이 먼저 바뀌었어요. 바뀐 내용을 확인하고 다시 저장해 주세요.';notice(message,true);
      }
    });
  };
  const saveTopik=(learnerId,form)=>{
    const kind=form.kind,round=Number(form.round),level=Number(form.level),announcedOn=form.announcedOn;
    // 틀린 칸이 있으면 그 패널 안에 알리고(role="alert"), 토스트도 띄우고, 그 칸으로 초점을 옮긴다.
    const max=addDays(model.basisDate,FUTURE_DAYS);
    const wrong=!['I','II'].includes(kind)?['kind','시험을 골라 주세요.']:!Number.isSafeInteger(round)||round<1||round>999?['round','회차는 1에서 999 사이 숫자로 적어 주세요.']:!TOPIK_LEVELS[kind].includes(level)?['level','급수를 골라 주세요.']
      :!dateValue(announcedOn)?['announcedOn','성적 발표일을 골라 주세요.']:announcedOn<'2000-01-01'||announcedOn>max?['announcedOn','성적 발표일은 2000-01-01부터 '+max+'까지 고를 수 있어요.']:null;
    if(wrong){topikDraft={...form,key:topikDraft?.key??null};topikError={learnerId,field:wrong[0],text:wrong[1]};notice(wrong[1],true);paint('[data-att-topik-form="'+learnerId+'"] [name="'+wrong[0]+'"]');return;}
    topikError=null;
    // 보낸 값을 입력칸 값으로 남긴다(실패하거나 고치던 성적이 다른 화면에서 지워져도 적던 내용이 남게). 넣기만 멱등 키를 쓴다.
    topikDraft={...form,key:editing?null:topikDraft?.key||randomKey()};
    const body=editing?{action:'save',learnerId,id:editing.id,revision:editing.revision,kind,round,level,announcedOn}:{action:'save',learnerId,kind,round,level,announcedOn,idempotencyKey:topikDraft.key};
    return run(async current=>{
      try{const result=await call('/api/teacher/topik',body);if(!current())return;const l=learner(learnerId);if(l)l.topik=result.topik;clearTopikForm();message='TOPIK '+kind+' 제'+round+'회 성적을 저장했어요.';notice(message);onSaved();}
      catch(error){await topikFailed(error,current,learnerId,null);}
    },{scope:'topik'});
  };
  const removeTopik=(learnerId,record)=>{
    if(!confirm('TOPIK '+record.kind+' 제'+record.round+'회 성적을 지울까요?'))return;
    return run(async current=>{
      try{const result=await call('/api/teacher/topik',{action:'delete',learnerId,id:record.id,revision:record.revision});if(!current())return;const l=learner(learnerId);if(l)l.topik=result.topik;clearTopikForm();message='TOPIK '+record.kind+' 제'+record.round+'회 성적을 지웠어요.';notice(message);onSaved();}
      catch(error){await topikFailed(error,current,learnerId,record);}
    },{fallback:'[data-att-topik-open="'+learnerId+'"]',scope:'topik'});
  };
  // 출결 save()와 같은 규칙: 멱등 키 충돌이면 다음 저장에 새 키를 쓰고, 명단 잠금 · 같은 회차 · 상한은 안내만 한다(입력값은 남는다).
  // 고치기 · 지우기의 판 충돌이면 그 반을 다시 받아 그 학생 성적과 고치기 상태를 바로잡는다.
  // 다른 화면이 먼저 지운 성적을 고치거나 지우면 서버는 403 FORBIDDEN을 준다(회사 중계는 TEACHING_CLASSROOM_FORBIDDEN). 그때도 다시 받아 본다.
  async function topikFailed(error,current,learnerId,removing){
    const reason=reasonOf(error),target=removing||editing;if(reason==='IDEMPOTENCY_CONFLICT'&&topikDraft)topikDraft={...topikDraft,key:null};
    const conflict=error?.status===409&&!TOPIK_NOT_CONFLICT.includes(reason),gone=error?.status===403&&['FORBIDDEN','TEACHING_CLASSROOM'].includes(reason);
    if(!current()||!target||!conflict&&!gone)throw error;
    const fresh=await call('/api/workspace');if(!current())return;absorb(fresh,false);
    const now=list(learner(learnerId)?.topik?.records).find(r=>r.id===target.id);
    // 성적이 그대로인데 403이면 권한 같은 다른 까닭이다. 그 글을 그대로 보인다.
    if(gone&&now)throw error;
    if(editing?.id===target.id){if(now)editing={...now};else{editing=null;if(topikDraft)topikDraft={...topikDraft,key:null};}}
    message=now?'다른 화면에서 이 성적이 먼저 바뀌었어요. 바뀐 내용을 확인하고 다시 '+(removing?'지워':'저장해')+' 주세요.':removing?'이 성적은 다른 화면에서 이미 지워졌어요.':'이 성적은 다른 화면에서 이미 지워졌어요. 적던 내용은 「성적 넣기」에 남겨 두었어요.';
    notice(message,true);
  }
  function topikPanel(l){
    // editing은 고치는 원본 성적(머리글에 쓴다)이고, 입력칸 값은 topikDraft에 따로 둔다.
    const records=list(l.topik?.records),form=topikDraft||(editing?{kind:editing.kind,round:editing.round,level:editing.level,announcedOn:editing.announcedOn}:{kind:'II',round:'',level:4,announcedOn:''});
    const levels=TOPIK_LEVELS[form.kind]||TOPIK_LEVELS.II,max=addDays(model.basisDate,FUTURE_DAYS),error=topikError?.learnerId===l.id?topikError:null,errorId='att-topik-error-'+escape(l.id);
    const invalid=field=>error?.field===field?' aria-invalid="true" aria-describedby="'+errorId+'"':'';
    return '<div class="att-topik-panel" id="att-topik-'+escape(l.id)+'">'
      +(records.length?'<table class="att-topik-table"><caption class="sr-only">'+escape(l.name)+' TOPIK 성적</caption><thead><tr><th scope="col">시험</th><th scope="col">급수</th><th scope="col">발표일</th><th scope="col">유효기간</th><th scope="col"><span class="sr-only">고치기</span></th></tr></thead><tbody>'
        +records.map(r=>{const badge=topikBadge(r);return '<tr><td>TOPIK '+escape(r.kind)+' 제'+escape(r.round)+'회</td><td>'+escape(levelLabel(r.level))+'</td><td>'+escape(r.announcedOn)+'</td><td><span class="status-badge '+escape(badge.tone)+'">'+escape(badge.label)+'</span> <small>'+escape(badge.detail)+'</small></td><td class="att-topik-actions"><button type="button" class="btn small quiet" data-att-topik-edit="'+escape(r.id)+'" data-learner="'+escape(l.id)+'"'+(busy?' disabled':'')+'>고치기</button><button type="button" class="btn small quiet" data-att-topik-delete="'+escape(r.id)+'" data-learner="'+escape(l.id)+'"'+(busy?' disabled':'')+'>지우기</button></td></tr>';}).join('')+'</tbody></table>'
        :'<p class="att-empty">아직 넣은 TOPIK 성적이 없어요.</p>')
      +(l.topik?.capacityReached&&!editing?'<p class="att-empty">성적은 한 학생에 20회까지 남겨요. 지난 기록을 지운 뒤 넣어 주세요.</p>':
      '<form class="att-topik-form" data-att-topik-form="'+escape(l.id)+'" novalidate><fieldset><legend>'+(editing?'TOPIK '+escape(editing.kind)+' 제'+escape(editing.round)+'회 고치기':'성적 넣기')+'</legend>'
        +'<label>시험<select name="kind" data-att-topik-kind="'+escape(l.id)+'"'+invalid('kind')+'><option value="I"'+(form.kind==='I'?' selected':'')+'>TOPIK I</option><option value="II"'+(form.kind==='II'?' selected':'')+'>TOPIK II</option></select></label>'
        +'<label>회차<span class="att-round"><span aria-hidden="true">제</span><input name="round" type="number" inputmode="numeric" min="1" max="999" step="1" placeholder="105" value="'+escape(form.round)+'"'+invalid('round')+'><span aria-hidden="true">회</span></span></label>'
        +'<label>급수<select name="level"'+invalid('level')+'>'+levels.map(v=>'<option value="'+v+'"'+(Number(form.level)===v?' selected':'')+'>'+levelLabel(v)+'</option>').join('')+'</select></label>'
        +'<label>성적 발표일<input name="announcedOn" type="date" max="'+escape(max)+'" value="'+escape(form.announcedOn)+'"'+invalid('announcedOn')+'></label>'
        +(error?'<p class="att-message" role="alert" id="'+errorId+'">'+escape(error.text)+'</p>':'')
        +'<div class="att-topik-submit"><button class="btn primary small" type="submit"'+(busy?' disabled':'')+'>'+(editing?'고친 내용 저장':'성적 저장')+'</button>'+(editing?'<button type="button" class="btn small quiet" data-att-topik-cancel="'+escape(l.id)+'" data-learner="'+escape(l.id)+'"'+(busy?' disabled':'')+'>고치기 취소</button>':'')+'</div>'
        +'</fieldset><p class="att-hint">만료일은 성적 발표일로부터 2년 뒤로 자동으로 정해져요. 만료일 당일부터 「만료」로 보여요.</p></form>')
      +'</div>';
  }
  // 줄의 찍은 사람 · 시각과 「저장 전」 표시. 메모를 쓰는 동안에도 이것만 바꿔 넣는다.
  function rowMeta(l){
    const {status,old}=effective(l,saved,draft),changed=rowChanged(l,saved,draft);
    return (old?escape(old.recordedByName||'선생님')+' · '+escape(savedTime(old.updatedAt))+' 저장':'아직 안 찍음')+(changed?' · <b class="att-changed">'+(status?'저장 전':'저장 전 · 출결 상태를 골라 주세요')+'</b>':'');
  }
  function rowHtml(l){
    if(!l.shared)return '<li class="att-row is-off" data-att-row="'+escape(l.id)+'"><div class="att-name"><strong>'+escape(l.name)+'</strong><small>'+escape(l.sharing==='unconnected'?'계정 연결 전':l.sharing==='revoked'?'연결 해제':'학습 공유 안 함')+' · 출결과 TOPIK을 남기지 않아요</small></div></li>';
    const {status,old}=effective(l,saved,draft);
    // 만료 배지는 담당 반 요약과 같은 기준: 유효한 4급 이상 가운데 가장 늦게 만료되는 성적(level4), 없으면 대표 성적.
    const badge=topikBadge(l.topik?.level4||l.topik?.representative),open=openTopik===l.id,rawNote=draft.get(l.id)?.note??old?.note??'';
    return '<li class="att-row'+(focused===l.id?' is-focused':'')+(open?' is-open':'')+'" data-att-row="'+escape(l.id)+'">'
      +'<div class="att-name"><strong>'+escape(l.name)+'</strong><small data-att-meta="'+escape(l.id)+'">'+rowMeta(l)+'</small>'+(l.streak>=3?'<span class="status-badge bad att-streak">연속 결석 '+l.streak+'회</span>':'')+'</div>'
      +'<div class="segmented att-status" role="group" aria-label="'+escape(l.name)+' 출결">'+STATUSES.map(s=>'<button type="button" data-att-status="'+s+'" data-learner="'+escape(l.id)+'" aria-pressed="'+(status===s)+'"'+(busy?' disabled':'')+'>'+STATUS_LABELS[s]+'</button>').join('')+'</div>'
      +'<input class="att-note" type="text" maxlength="'+NOTE_LIMIT+'" placeholder="사유 메모" aria-label="'+escape(l.name)+' 사유 메모" data-att-note="'+escape(l.id)+'" value="'+escape(rawNote)+'"'+(busy?' disabled':'')+'>'
      +'<div class="att-topik">'+(badge?'<span class="att-topik-name">'+escape(badge.title)+'</span><span class="status-badge '+escape(badge.tone)+'" title="'+escape(badge.detail)+'">'+escape(badge.label)+'</span>':'<span class="att-topik-name is-muted">TOPIK 기록 없음</span>')
      +'<button type="button" class="btn small quiet" data-att-topik-open="'+escape(l.id)+'" aria-expanded="'+open+'" aria-controls="att-topik-'+escape(l.id)+'">TOPIK</button></div>'
      +(open?topikPanel(l):'')+'</li>';
  }
  function selectorFor(element){
    for(const name of ['attStatus','attNote','attTopikOpen','attTopikKind','attTopikEdit','attTopikDelete','attTopikCancel','attDate','attAll','attSave']){const value=element.dataset?.[name];if(value===undefined)continue;return '[data-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+value+'"]'+(element.dataset.learner?'[data-learner="'+element.dataset.learner+'"]':'');}
    const form=element.form?.dataset?.attTopikForm;
    if(form!==undefined){if(element.name)return '[data-att-topik-form="'+form+'"] [name="'+element.name+'"]';if(element.type==='submit')return '[data-att-topik-form="'+form+'"] [type="submit"]';}
    return null;
  }
  function activeSelector(){const active=documentObject?.activeElement;return active&&root.contains?.(active)?selectorFor(active):null;}
  function paint(focus,...fallbacks){
    if(stopped||!model)return;
    const keep=[focus||activeSelector(),...fallbacks].filter(Boolean);
    const counts=attendanceCounts(model.learners,saved,draft),dirty=attendanceDirty(model.learners,saved,draft),people=shared().length;
    root.className='class-records';root.setAttribute?.('aria-label','출결과 TOPIK');
    root.innerHTML='<header class="att-head"><div><span class="att-kicker">'+escape(model.name)+'</span><h3>'+(sessionDate===today()?'오늘 출결':escape(sessionDate)+' 출결')+'</h3><p>계정을 잇고 학습 공유를 켠 학생만 찍어요. 저장하면 줄마다 찍은 사람과 시각이 남아요.</p></div>'
      +'<div class="att-controls"><label class="att-date">날짜<input type="date" data-att-date="1" value="'+escape(sessionDate)+'" min="'+escape(addDays(model.basisDate,-PAST_DAYS))+'" max="'+escape(addDays(model.basisDate,FUTURE_DAYS))+'"'+(busy?' disabled':'')+'></label>'
      +'<button type="button" class="btn" data-att-all="1"'+(busy||!counts.unrecorded?' disabled':'')+'>모두 출석</button><button type="button" class="btn primary" data-att-save="1"'+(busy||!dirty?' disabled':'')+'>출결 저장</button></div></header>'
      +'<p class="att-counts" role="status" aria-live="polite">'+STATUSES.map(s=>'<span>'+STATUS_LABELS[s]+' <b>'+counts[s]+'</b></span>').join('')+'<span>아직 <b>'+counts.unrecorded+'</b></span><span class="att-basis">TOPIK 만료 기준일 '+escape(model.basisDate)+'</span></p>'
      +(message?'<p class="att-message" data-att-message="1" tabindex="-1">'+escape(message)+'</p>':'')
      +(model.capacityReached?'<p class="att-message">이 반의 출결 기록이 가득 찼어요. 이미 찍은 날은 고칠 수 있어요.</p>':'')
      +(people?'':'<p class="att-empty">아직 학습 공유를 켠 학생이 없어요. 학생이 SYNK 계정을 잇고 공유를 켜면 여기서 출결을 찍을 수 있어요.</p>')
      +'<ul class="att-roster">'+model.learners.map(rowHtml).join('')+'</ul>';
    if(keep.length)focusFirst(...keep);
  }
  // 비활성 단추로는 초점을 보내지 않는다(보내면 초점이 문서 처음으로 빠진다).
  function focusFirst(...selectors){for(const selector of selectors){const element=selector&&root.querySelector?.(selector);if(element&&!element.disabled){element.focus?.();return;}}}
  // 새로 받은 반 자료를 띠 모형에 합친다. 바뀐 것이 있으면 true(그리기는 부른 쪽이 한다).
  function absorb(workspace,sharingOnly){
    const next=classRecordsModel(workspace,model.classId);if(!next)return false;
    const prev=new Map(model.learners.map(l=>[l.id,l]));
    const learners=next.learners.map(l=>{
      const old=prev.get(l.id);if(!old)return l;
      // 늦게 도착한 옛 개요(공유 판이 더 낮음)는 지금 줄을 되돌리지 못한다.
      if(Number.isSafeInteger(l.revision)&&Number.isSafeInteger(old.revision)&&l.revision<old.revision)return old;
      return sharingOnly&&old.shared===l.shared&&old.sharing===l.sharing?old:l;
    });
    const merged=sharingOnly?{...model,learners}:{...model,name:next.name||model.name,basisDate:next.basisDate,capacityReached:next.capacityReached,learners};
    const shape=m=>JSON.stringify([m.name,m.basisDate,m.capacityReached,m.learners.map(l=>[l.id,l.name,l.shared,l.sharing,l.streak,l.topik])]);
    if(shape(merged)===shape(model))return false;
    model=merged;
    if(openTopik&&!learner(openTopik)?.shared){openTopik=null;clearTopikForm();}
    return true;
  }
  const formValues=form=>({kind:form.elements.kind.value,round:form.elements.round.value,level:form.elements.level.value,announcedOn:form.elements.announcedOn.value});
  function onClick(event){
    const button=event.target.closest?.('button');if(!button||button.disabled||!model||root.contains&&!root.contains(button))return;
    const id=button.dataset.learner;
    if(button.dataset.attStatus){if(!learner(id)?.shared)return;draft.set(id,{...(draft.get(id)||{}),status:button.dataset.attStatus});key=null;message='';paint('[data-att-status="'+button.dataset.attStatus+'"][data-learner="'+id+'"]');return;}
    if(button.dataset.attAll){const empty=shared().filter(l=>!effective(l,saved,draft).status);if(!empty.length)return;for(const l of empty)draft.set(l.id,{...(draft.get(l.id)||{}),status:'present'});key=null;message='';paint('[data-att-save]');return;}
    if(button.dataset.attSave){void save();return;}
    if(button.dataset.attTopikOpen){const next=openTopik===button.dataset.attTopikOpen?null:button.dataset.attTopikOpen;if(topikTouched&&!confirm('넣던 TOPIK 성적이 닫혀요. 닫을까요?'))return;openTopik=next;clearTopikForm();paint('[data-att-topik-open="'+button.dataset.attTopikOpen+'"]');return;}
    if(button.dataset.attTopikEdit){const record=list(learner(id)?.topik?.records).find(r=>r.id===button.dataset.attTopikEdit);if(!record)return;clearTopikForm();editing={...record};paint();root.querySelector?.('[data-att-topik-form="'+id+'"] input[name="round"]')?.focus?.();return;}
    // 취소하면 고치기를 연 그 성적의 「고치기」 단추로 돌아간다. 그 줄이 없으면 학생의 「TOPIK」 단추로.
    if(button.dataset.attTopikCancel){const record=editing;clearTopikForm();paint();focusFirst(record&&'[data-att-topik-edit="'+record.id+'"][data-learner="'+id+'"]','[data-att-topik-open="'+id+'"]');return;}
    if(button.dataset.attTopikDelete){const record=list(learner(id)?.topik?.records).find(r=>r.id===button.dataset.attTopikDelete);if(record)void removeTopik(id,record);}
  }
  function onInput(event){
    const input=event.target;if(!model)return;
    if(input.dataset?.attNote){
      const id=input.dataset.attNote;draft.set(id,{...(draft.get(id)||{}),note:String(input.value).slice(0,NOTE_LIMIT)});key=null;
      const button=root.querySelector?.('[data-att-save]');if(button)button.disabled=busy||!attendanceDirty(model.learners,saved,draft);
      // 줄의 「저장 전」 표시와 「상태를 먼저 골라 주세요」 안내도 같은 규칙으로 바로 맞춘다. 입력칸은 다시 그리지 않는다(쓰던 글자와 한글 조합을 지키려고).
      const l=learner(id),meta=root.querySelector?.('[data-att-meta="'+id+'"]');if(l&&meta)meta.innerHTML=rowMeta(l);
      if(message&&message===missingMessage){
        const missing=attendanceMissingStatus(model.learners,saved,draft);message=missingMessage=missing.length?missingText(missing):'';
        const shown=root.querySelector?.('[data-att-message]');if(shown){if(message)shown.textContent=message;else shown.remove?.();}
      }
      return;
    }
    if(input.form?.dataset?.attTopikForm){topikDraft={...formValues(input.form),key:null};topikTouched=true;if(topikError&&input.name===topikError.field){topikError=null;input.removeAttribute?.('aria-invalid');input.removeAttribute?.('aria-describedby');root.querySelector?.('#att-topik-error-'+input.form.dataset.attTopikForm)?.remove?.();}}
  }
  function onChange(event){
    const input=event.target;if(!model)return;
    if(input.dataset?.attDate){
      if(!dateValue(input.value)||input.value===sessionDate)return;
      if(!inRange(input.value)){message='출결 날짜는 오늘부터 400일 전까지, 내일까지만 고를 수 있어요.';input.value=sessionDate;paint();return;}
      if(attendanceDirty(model.learners,saved,draft)&&!confirm('저장하지 않은 출결이 있어요. 다른 날짜로 넘어갈까요?')){input.value=sessionDate;return;}
      void loadDay(input.value);return;
    }
    if(input.dataset?.attTopikKind){const values=formValues(input.form),levels=TOPIK_LEVELS[values.kind],next={...values,level:levels.includes(Number(values.level))?values.level:String(levels[0])};topikDraft={...next,key:null};topikTouched=true;paint('[data-att-topik-kind="'+input.dataset.attTopikKind+'"]');}
  }
  function onSubmit(event){const form=event.target;if(!form.dataset?.attTopikForm||!model)return;event.preventDefault();void saveTopik(form.dataset.attTopikForm,formValues(form));}
  root.addEventListener?.('click',onClick);root.addEventListener?.('input',onInput);root.addEventListener?.('change',onChange);root.addEventListener?.('submit',onSubmit);
  return Object.freeze({
    // 반 응답을 받을 때마다 부른다. 띠를 그리면 true, 이 반에 출결 기능이 없으면 false.
    render(workspace,classId,{learnerId=null}={}){
      if(stopped)return false;const next=classRecordsModel(workspace,classId),first=!model||!next||model.classId!==next.classId;
      // 다른 반이나 출결 없는 반으로 바뀌면 그 반에서 쓰던 것(TOPIK 칸 · 안내 · 진행 중 요청)을 모두 내려놓는다. 진행 중이던 요청의 답은 버린다.
      if(first){version++;busy=false;openTopik=null;clearTopikForm();message='';missingMessage='';draft=new Map();key=null;}
      if(!next){model=null;root.replaceChildren?.();return false;}
      model=next;focused=learnerId;
      if(first){sessionDate=next.sessionDate;setSaved(next.rows);}
      paint();
      // 서버의 오늘(서울)과 이 기기의 오늘이 다르면 이 기기의 날짜로 다시 받는다(학원 현지 날짜).
      if(first&&today()!==sessionDate&&inRange(today()))void loadDay(today());
      return true;
    },
    // 새로 받은 반 자료(교사 개요나 반 응답)로 학생 줄의 파생 표시(연속 결석 · TOPIK 배지 · 공유 상태)만 바꾼다.
    // sharingOnly면 명부와 공유가 바뀐 줄만 받는다(개요를 주기적으로 다시 받을 때. 다른 학생이 공유를 끄면 그 줄을 바로 내린다).
    // 고른 날짜 · 저장본 · 고르던 내용은 그대로 둔다. 달라진 것이 없으면 다시 그리지 않는다(입력 중인 칸을 건드리지 않게).
    refresh(workspace,{sharingOnly=false}={}){if(stopped||!model||!absorb(workspace,sharingOnly))return false;paint();return true;},
    focus(learnerId){if(!model)return;focused=learnerId||null;paint();if(learnerId)root.querySelector?.('[data-att-row="'+learnerId+'"]')?.scrollIntoView?.({block:'nearest',behavior:'instant'});},
    hasDraft:()=>!!model&&(attendanceDirty(model.learners,saved,draft)||topikTouched),
    stop(){if(stopped)return;stopped=true;version++;root.removeEventListener?.('click',onClick);root.removeEventListener?.('input',onInput);root.removeEventListener?.('change',onChange);root.removeEventListener?.('submit',onSubmit);root.replaceChildren?.();},
  });
}
