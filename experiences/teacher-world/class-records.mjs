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
    return {id:row.id,name:row.name||'이름 확인 필요',shared:sharing==='shared'&&row.topik?.shared===true,sharing,topik:row.topik||null,streak:Number.isSafeInteger(row.absentStreak)?row.absentStreak:0};
  }).sort(compareTeacherRows);
  return {classId,name:classroom.name||'',basisDate:classroom.attendance.basisDate,sessionDate:classroom.attendance.sessionDate||classroom.attendance.basisDate,rows:list(classroom.attendance.rows),learners,capacityReached:classroom.attendance.capacityReached===true};
}
// 저장할 묶음: 상태를 고른 공유 학생 모두. 그대로인 줄도 판을 함께 보내, 다른 화면이 먼저 고친 줄을 덮지 않고 409로 알린다.
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
  let stopped=false,model=null,sessionDate=null,saved=new Map(),draft=new Map(),key=null,busy=false,openTopik=null,editing=null,topikDraft=null,topikTouched=false,message='',focused=null,version=0;
  const shared=()=>model?.learners.filter(l=>l.shared)||[];
  const learner=id=>model?.learners.find(l=>l.id===id);
  const today=()=>localDate(now());
  const inRange=date=>!!model&&date<=addDays(model.basisDate,FUTURE_DAYS)&&date>=addDays(model.basisDate,-PAST_DAYS);
  const confirm=text=>{const view=documentObject?.defaultView;return typeof view?.confirm!=='function'||view.confirm(text)===true;};
  function setSaved(rows){saved=new Map(list(rows).map(row=>[row.learnerId,row]));}
  function clearTopikForm(){editing=null;topikDraft=null;topikTouched=false;}
  function fail(error){if(stopped||error?.code==='ACCOUNT_CHANGED')return;message=error?.message||'저장하지 못했어요. 잠시 뒤 다시 해 주세요.';notice(message,true);}
  async function call(path,body){guard();const result=await request(path,body);guard();if(stopped)throw Object.assign(new Error('닫힌 화면이에요.'),{code:'ACCOUNT_CHANGED'});return result;}
  // 한 번에 하나만 보낸다. 뒤에 시작한 요청이 있으면 앞 요청의 답은 버린다.
  async function run(task){
    if(busy)return;busy=true;paint();const ticket=++version;
    try{await task(()=>ticket===version);}catch(error){if(ticket===version)fail(error);}
    finally{if(ticket===version){busy=false;paint();}}
  }
  const loadDay=date=>run(async current=>{
    const result=await call('/api/teacher/attendance',{action:'day',sessionDate:date});if(!current())return;
    sessionDate=result.sessionDate;setSaved(result.attendance);draft=new Map();key=null;message='';
  });
  const save=()=>{
    const missing=attendanceMissingStatus(model.learners,saved,draft);
    if(missing.length){
      message=(missing.length===1?missing[0].name:missing[0].name+' 외 '+(missing.length-1)+'명')+'의 출결 상태를 먼저 골라 주세요. 사유 메모는 상태와 함께 저장돼요.';notice(message,true);
      paint('[data-att-status="present"][data-learner="'+missing[0].id+'"]');return;
    }
    const rows=attendanceRows(model.learners,saved,draft);if(!rows.length)return;
    key??=randomKey();const date=sessionDate;
    return run(async current=>{
      try{
        const result=await call('/api/teacher/attendance',{action:'save',sessionDate:date,idempotencyKey:key,rows});if(!current())return;
        setSaved(result.attendance);draft=new Map();key=null;message=rows.length+'명의 '+date+' 출결을 저장했어요.';notice(message);onSaved();
      }catch(error){
        if(error?.status!==409||!current())throw error;
        // 다른 화면이 먼저 고쳤으면 그날을 다시 받는다. 고르던 내용은 남겨 확인한 뒤 다시 저장할 수 있게 한다.
        const fresh=await call('/api/teacher/attendance',{action:'day',sessionDate:date});if(!current())return;
        setSaved(fresh.attendance);key=null;message='다른 화면에서 이 날 출결이 먼저 바뀌었어요. 바뀐 내용을 확인하고 다시 저장해 주세요.';notice(message,true);
      }
    });
  };
  const saveTopik=(learnerId,form)=>{
    const kind=form.kind,round=Number(form.round),level=Number(form.level),announcedOn=form.announcedOn;
    if(!['I','II'].includes(kind)||!Number.isSafeInteger(round)||round<1||round>999||!TOPIK_LEVELS[kind].includes(level)||!dateValue(announcedOn)){topikDraft={...form,key:topikDraft?.key??null};message='회차(숫자) · 급수 · 성적 발표일을 확인해 주세요.';paint();return;}
    if(!editing){topikDraft={...form,key:topikDraft?.key||randomKey()};}
    const body=editing?{action:'save',learnerId,id:editing.id,revision:editing.revision,kind,round,level,announcedOn}:{action:'save',learnerId,kind,round,level,announcedOn,idempotencyKey:topikDraft.key};
    return run(async current=>{const result=await call('/api/teacher/topik',body);if(!current())return;const l=learner(learnerId);if(l)l.topik=result.topik;clearTopikForm();message='TOPIK '+kind+' 제'+round+'회 성적을 저장했어요.';notice(message);onSaved();});
  };
  const removeTopik=(learnerId,record)=>{
    if(!confirm('TOPIK '+record.kind+' 제'+record.round+'회 성적을 지울까요?'))return;
    return run(async current=>{const result=await call('/api/teacher/topik',{action:'delete',learnerId,id:record.id,revision:record.revision});if(!current())return;const l=learner(learnerId);if(l)l.topik=result.topik;clearTopikForm();message='TOPIK '+record.kind+' 제'+record.round+'회 성적을 지웠어요.';notice(message);onSaved();});
  };
  function topikPanel(l){
    // editing은 고치는 원본 성적(머리글에 쓴다)이고, 입력칸 값은 topikDraft에 따로 둔다.
    const records=list(l.topik?.records),form=topikDraft||(editing?{kind:editing.kind,round:editing.round,level:editing.level,announcedOn:editing.announcedOn}:{kind:'II',round:'',level:4,announcedOn:''});
    const levels=TOPIK_LEVELS[form.kind]||TOPIK_LEVELS.II,max=addDays(model.basisDate,FUTURE_DAYS);
    return '<div class="att-topik-panel" id="att-topik-'+escape(l.id)+'">'
      +(records.length?'<table class="att-topik-table"><caption class="sr-only">'+escape(l.name)+' TOPIK 성적</caption><thead><tr><th scope="col">시험</th><th scope="col">급수</th><th scope="col">발표일</th><th scope="col">유효기간</th><th scope="col"><span class="sr-only">고치기</span></th></tr></thead><tbody>'
        +records.map(r=>{const badge=topikBadge(r);return '<tr><td>TOPIK '+escape(r.kind)+' 제'+escape(r.round)+'회</td><td>'+escape(levelLabel(r.level))+'</td><td>'+escape(r.announcedOn)+'</td><td><span class="status-badge '+escape(badge.tone)+'">'+escape(badge.label)+'</span> <small>'+escape(badge.detail)+'</small></td><td class="att-topik-actions"><button type="button" class="btn small quiet" data-att-topik-edit="'+escape(r.id)+'" data-learner="'+escape(l.id)+'"'+(busy?' disabled':'')+'>고치기</button><button type="button" class="btn small quiet" data-att-topik-delete="'+escape(r.id)+'" data-learner="'+escape(l.id)+'"'+(busy?' disabled':'')+'>지우기</button></td></tr>';}).join('')+'</tbody></table>'
        :'<p class="att-empty">아직 넣은 TOPIK 성적이 없어요.</p>')
      +(l.topik?.capacityReached&&!editing?'<p class="att-empty">성적은 한 학생에 20회까지 남겨요. 지난 기록을 지운 뒤 넣어 주세요.</p>':
      '<form class="att-topik-form" data-att-topik-form="'+escape(l.id)+'" novalidate><fieldset><legend>'+(editing?'TOPIK '+escape(editing.kind)+' 제'+escape(editing.round)+'회 고치기':'성적 넣기')+'</legend>'
        +'<label>시험<select name="kind" data-att-topik-kind="'+escape(l.id)+'"><option value="I"'+(form.kind==='I'?' selected':'')+'>TOPIK I</option><option value="II"'+(form.kind==='II'?' selected':'')+'>TOPIK II</option></select></label>'
        +'<label>회차<span class="att-round"><span aria-hidden="true">제</span><input name="round" type="number" inputmode="numeric" min="1" max="999" step="1" placeholder="105" value="'+escape(form.round)+'"><span aria-hidden="true">회</span></span></label>'
        +'<label>급수<select name="level">'+levels.map(v=>'<option value="'+v+'"'+(Number(form.level)===v?' selected':'')+'>'+levelLabel(v)+'</option>').join('')+'</select></label>'
        +'<label>성적 발표일<input name="announcedOn" type="date" max="'+escape(max)+'" value="'+escape(form.announcedOn)+'"></label>'
        +'<div class="att-topik-submit"><button class="btn primary small" type="submit"'+(busy?' disabled':'')+'>'+(editing?'고친 내용 저장':'성적 저장')+'</button>'+(editing?'<button type="button" class="btn small quiet" data-att-topik-cancel="'+escape(l.id)+'" data-learner="'+escape(l.id)+'"'+(busy?' disabled':'')+'>고치기 취소</button>':'')+'</div>'
        +'</fieldset><p class="att-hint">만료일은 성적 발표일로부터 2년 뒤로 자동으로 정해져요. 만료일 당일부터 「만료」로 보여요.</p></form>')
      +'</div>';
  }
  function rowHtml(l){
    if(!l.shared)return '<li class="att-row is-off" data-att-row="'+escape(l.id)+'"><div class="att-name"><strong>'+escape(l.name)+'</strong><small>'+escape(l.sharing==='unconnected'?'계정 연결 전':l.sharing==='revoked'?'연결 해제':'학습 공유 안 함')+' · 출결과 TOPIK을 남기지 않아요</small></div></li>';
    const {status,old}=effective(l,saved,draft),changed=rowChanged(l,saved,draft);
    const badge=topikBadge(l.topik?.representative),open=openTopik===l.id,rawNote=draft.get(l.id)?.note??old?.note??'';
    const meta=(old?escape(old.recordedByName||'선생님')+' · '+escape(savedTime(old.updatedAt))+' 저장':'아직 안 찍음')+(changed?' · <b class="att-changed">'+(status?'저장 전':'저장 전 · 출결 상태를 골라 주세요')+'</b>':'');
    return '<li class="att-row'+(focused===l.id?' is-focused':'')+(open?' is-open':'')+'" data-att-row="'+escape(l.id)+'">'
      +'<div class="att-name"><strong>'+escape(l.name)+'</strong><small>'+meta+'</small>'+(l.streak>=3?'<span class="status-badge bad att-streak">연속 결석 '+l.streak+'회</span>':'')+'</div>'
      +'<div class="segmented att-status" role="group" aria-label="'+escape(l.name)+' 출결">'+STATUSES.map(s=>'<button type="button" data-att-status="'+s+'" data-learner="'+escape(l.id)+'" aria-pressed="'+(status===s)+'"'+(busy?' disabled':'')+'>'+STATUS_LABELS[s]+'</button>').join('')+'</div>'
      +'<input class="att-note" type="text" maxlength="'+NOTE_LIMIT+'" placeholder="사유 메모" aria-label="'+escape(l.name)+' 사유 메모" data-att-note="'+escape(l.id)+'" value="'+escape(rawNote)+'"'+(busy?' disabled':'')+'>'
      +'<div class="att-topik">'+(badge?'<span class="att-topik-name">'+escape(badge.title)+'</span><span class="status-badge '+escape(badge.tone)+'" title="'+escape(badge.detail)+'">'+escape(badge.label)+'</span>':'<span class="att-topik-name is-muted">TOPIK 기록 없음</span>')
      +'<button type="button" class="btn small quiet" data-att-topik-open="'+escape(l.id)+'" aria-expanded="'+open+'" aria-controls="att-topik-'+escape(l.id)+'">TOPIK</button></div>'
      +(open?topikPanel(l):'')+'</li>';
  }
  function selectorFor(element){
    for(const name of ['attStatus','attNote','attTopikOpen','attTopikKind','attDate','attAll','attSave']){const value=element.dataset?.[name];if(value===undefined)continue;return '[data-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+value+'"]'+(element.dataset.learner?'[data-learner="'+element.dataset.learner+'"]':'');}
    return null;
  }
  function paint(focus){
    if(stopped||!model)return;
    const active=documentObject?.activeElement,keep=focus||(active&&root.contains?.(active)?selectorFor(active):null);
    const counts=attendanceCounts(model.learners,saved,draft),dirty=attendanceDirty(model.learners,saved,draft),people=shared().length;
    root.className='class-records';root.setAttribute?.('aria-label','출결과 TOPIK');
    root.innerHTML='<header class="att-head"><div><span class="att-kicker">'+escape(model.name)+'</span><h3>'+(sessionDate===today()?'오늘 출결':escape(sessionDate)+' 출결')+'</h3><p>계정을 잇고 학습 공유를 켠 학생만 찍어요. 저장하면 줄마다 찍은 사람과 시각이 남아요.</p></div>'
      +'<div class="att-controls"><label class="att-date">날짜<input type="date" data-att-date="1" value="'+escape(sessionDate)+'" min="'+escape(addDays(model.basisDate,-PAST_DAYS))+'" max="'+escape(addDays(model.basisDate,FUTURE_DAYS))+'"'+(busy?' disabled':'')+'></label>'
      +'<button type="button" class="btn" data-att-all="1"'+(busy||!counts.unrecorded?' disabled':'')+'>모두 출석</button><button type="button" class="btn primary" data-att-save="1"'+(busy||!dirty?' disabled':'')+'>출결 저장</button></div></header>'
      +'<p class="att-counts" role="status" aria-live="polite">'+STATUSES.map(s=>'<span>'+STATUS_LABELS[s]+' <b>'+counts[s]+'</b></span>').join('')+'<span>아직 <b>'+counts.unrecorded+'</b></span><span class="att-basis">TOPIK 만료 기준일 '+escape(model.basisDate)+'</span></p>'
      +(message?'<p class="att-message">'+escape(message)+'</p>':'')
      +(model.capacityReached?'<p class="att-message">이 반의 출결 기록이 가득 찼어요. 이미 찍은 날은 고칠 수 있어요.</p>':'')
      +(people?'':'<p class="att-empty">아직 학습 공유를 켠 학생이 없어요. 학생이 SYNK 계정을 잇고 공유를 켜면 여기서 출결을 찍을 수 있어요.</p>')
      +'<ul class="att-roster">'+model.learners.map(rowHtml).join('')+'</ul>';
    if(keep)focusFirst(keep);
  }
  // 비활성 단추로는 초점을 보내지 않는다(보내면 초점이 문서 처음으로 빠진다).
  function focusFirst(...selectors){for(const selector of selectors){const element=selector&&root.querySelector?.(selector);if(element&&!element.disabled){element.focus?.();return;}}}
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
    if(input.dataset?.attNote){const id=input.dataset.attNote;draft.set(id,{...(draft.get(id)||{}),note:String(input.value).slice(0,NOTE_LIMIT)});key=null;const button=root.querySelector?.('[data-att-save]');if(button)button.disabled=busy||!attendanceDirty(model.learners,saved,draft);return;}
    if(input.form?.dataset?.attTopikForm){topikDraft={...formValues(input.form),key:null};topikTouched=true;}
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
      if(stopped)return false;const next=classRecordsModel(workspace,classId);if(!next){model=null;root.replaceChildren?.();return false;}
      const first=!model||model.classId!==next.classId;model=next;focused=learnerId;
      if(first){sessionDate=next.sessionDate;setSaved(next.rows);draft=new Map();key=null;}
      paint();
      // 서버의 오늘(서울)과 이 기기의 오늘이 다르면 이 기기의 날짜로 다시 받는다(학원 현지 날짜).
      if(first&&today()!==sessionDate&&inRange(today()))void loadDay(today());
      return true;
    },
    // 저장 뒤 새로 받은 반 자료(교사 개요나 반 응답)로 학생 줄의 파생 표시(연속 결석 · TOPIK 배지 · 공유 상태)만 바꾼다.
    // 고른 날짜 · 저장본 · 고르던 내용은 그대로 둔다. 달라진 것이 없으면 다시 그리지 않는다(입력 중인 칸을 건드리지 않게).
    refresh(workspace){
      if(stopped||!model)return false;const next=classRecordsModel(workspace,model.classId);if(!next)return false;
      const shape=m=>JSON.stringify([m.name,m.basisDate,m.capacityReached,m.learners.map(l=>[l.id,l.name,l.shared,l.sharing,l.streak,l.topik])]);
      if(shape(next)===shape(model))return false;
      model={...model,name:next.name||model.name,basisDate:next.basisDate,capacityReached:next.capacityReached,learners:next.learners};
      if(openTopik&&!learner(openTopik)?.shared){openTopik=null;clearTopikForm();}
      paint();return true;
    },
    focus(learnerId){if(!model)return;focused=learnerId;paint();root.querySelector?.('[data-att-row="'+learnerId+'"]')?.scrollIntoView?.({block:'nearest',behavior:'instant'});},
    hasDraft:()=>!!model&&(attendanceDirty(model.learners,saved,draft)||topikTouched),
    stop(){if(stopped)return;stopped=true;version++;root.removeEventListener?.('click',onClick);root.removeEventListener?.('input',onInput);root.removeEventListener?.('change',onChange);root.removeEventListener?.('submit',onSubmit);root.replaceChildren?.();},
  });
}
