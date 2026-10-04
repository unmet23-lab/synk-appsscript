import {createClassroomClient} from './classroom-client.mjs';

// A dedicated teacher client owns this host. Its child renderer receives scoped
// classroom methods, never login credentials or a learner's learning/memory API.
export function createTeacherWorkspace({root,transport,guard,notice,documentObject=document,windowObject=window,locationHref=location.href,pollMs=15000}){
  let stopped=false,epoch=0,requestVersion=0,selected=null,frame=null,host=null,timer=null,classes=[],online=true;
  const make=(tag,text)=>{const el=documentObject.createElement(tag);if(text)el.textContent=text;return el;};
  const controls=make('div'),label=make('label','담당 수업'),select=make('select'),refresh=make('button','수업 소속 다시 확인'),status=make('p'),mount=make('div');
  controls.className='teacher-class-controls';select.setAttribute('aria-label','담당 수업');refresh.type='button';refresh.className='plain';status.className='small';mount.className='teacher-class-mount';
  label.append(select);controls.append(label,refresh);root.replaceChildren(controls,status,mount);root.hidden=false;
  const active=()=>{guard();if(stopped)throw Object.assign(new Error('교사 앱의 연결이 끝났어요.'),{code:'ACCOUNT_CHANGED'});};
  const current=version=>{active();if(version!==epoch)throw Object.assign(new Error('담당 수업이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
  function clearFrame(){epoch++;frame?.remove();frame=null;if(windowObject.SYNKClassroomHost===host)delete windowObject.SYNKClassroomHost;host=null;mount.replaceChildren();}
  function report(error){if(!stopped&&error.code!=='ACCOUNT_CHANGED')notice(error.message,true);}
  function picker(){
    const empty=make('option',classes.length?'수업을 선택해 주세요':'등록된 담당 수업이 없어요');empty.value='';select.replaceChildren(empty);
    for(const row of classes){const option=make('option',row.name);option.value=row.id;select.append(option);}select.value=selected?.id||'';
  }
  async function choose(row){
    active();clearFrame();selected=row;picker();const version=epoch;
    if(!row){status.textContent=classes.length?'수업을 선택하면 학생의 학습 기록과 보낸 과제를 볼 수 있어요.':'기관에서 교사 소속과 담당 반을 등록하면 이곳에 표시돼요.';return;}
    status.textContent='담당 수업의 접근 권한을 확인하고 있어요.';
    const check=()=>{current(version);if(!online)throw Object.assign(new Error('수업 연결을 다시 확인하고 있어요. 잠시 뒤 다시 시도해 주세요.'),{code:'NETWORK_ERROR'});};
    const client=createClassroomClient({transport,classId:row.id,guard:check});
    const workspace=await client.request('/api/workspace');check();
    if(workspace.mode!=='account-linked'||!workspace.classes?.some(c=>c.id===row.id))throw new Error('담당 수업을 확인하지 못했어요. 소속을 다시 확인해 주세요.');
    host=Object.freeze({mode:'account-linked',classId:row.id,focusWorkspace:()=>{check();frame?.scrollIntoView({block:'start',behavior:'instant'});},request:(path,body)=>{check();return client.request(path,body);}});
    windowObject.SYNKClassroomHost=host;
    frame=make('iframe');frame.title=`${row.name} · 교사 공간`;frame.src=new URL('../teacher-world/?account=1',locationHref).href;mount.append(frame);status.textContent='학생이 공유한 학습 기록으로 다음 수업과 과제를 준비해요.';
  }
  async function load(){
    active();const version=++requestVersion;
    let result;const reconnecting=!online;
    try{result=await transport('classes');active();if(version!==requestVersion)return;
      if(result?.mode!=='account-linked'||!Array.isArray(result.classes)||result.classes.some(c=>typeof c.id!=='string'||!c.id||typeof c.name!=='string'||!['teacher','learner'].includes(c.role)))throw Object.assign(new Error('수업 목록을 확인하지 못했어요.'),{code:'INVALID_CLASSROOM_RESPONSE'});
      online=true;}
    catch(error){active();if(version!==requestVersion)return;online=false;
      if(error.status===401||error.status===403||error.code==='INVALID_CLASSROOM_RESPONSE'){clearFrame();selected=null;classes=[];picker();}
      status.textContent='수업 소속을 확인하지 못했어요. 연결 후 다시 확인해 주세요.';throw error;
    }
    classes=result.classes.filter(c=>c.role==='teacher');
    const prior=selected&&classes.find(c=>c.id===selected.id),row=prior||(classes.length===1?classes[0]:null);
    if(prior&&frame){selected=prior;picker();status.textContent='학생이 공유한 학습 기록으로 다음 수업과 과제를 준비해요.';if(reconnecting)notice('수업 연결이 복구됐어요. 열어 둔 수업에서 계속할 수 있어요.');return;}
    await choose(row);
    if(reconnecting)notice('수업 연결이 복구됐어요. 담당 수업을 다시 확인했어요.');
  }
  select.onchange=()=>{void choose(classes.find(c=>c.id===select.value)||null).catch(report);};
  refresh.onclick=()=>{refresh.disabled=true;void load().catch(report).finally(()=>{if(!stopped)refresh.disabled=false;});};
  timer=setInterval(()=>{void load().catch(report);},pollMs);
  return Object.freeze({load,stop(){if(stopped)return;stopped=true;requestVersion++;clearInterval(timer);clearFrame();root.replaceChildren();root.hidden=true;}});
}
