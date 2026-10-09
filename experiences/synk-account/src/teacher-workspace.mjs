import {createClassroomClient} from './classroom-client.mjs';
import {createTeacherOverview,compareTeacherRows} from '../../teacher-world/workspace-overview.mjs';

// All server-approved classes are visible; individual work uses one scoped host.
export function createTeacherWorkspace({root,transport,guard,notice,documentObject=document,windowObject=window,locationHref=location.href,pollMs=15000}){
  let stopped=false,epoch=0,requestVersion=0,selected=null,selectedLearnerId=null,frame=null,host=null,timer=null,classes=[],online=true,overviewData=null,framePermissions=new Map();
  const make=(tag,text)=>{const element=documentObject.createElement(tag);if(text)element.textContent=text;return element;};
  const controls=make('div'),label=make('label','담당 수업'),select=make('select'),refresh=make('button','수업 소속 다시 확인'),status=make('p'),overviewRoot=make('section'),mount=make('div');
  controls.className='teacher-class-controls';select.setAttribute('aria-label','담당 수업');refresh.type='button';refresh.className='plain';status.className='small';mount.className='teacher-class-mount';
  label.append(select);controls.append(label,refresh);root.replaceChildren(controls,status,overviewRoot,mount);root.hidden=false;
  if(!documentObject.querySelector?.('link[data-teacher-overview-style]')){const style=make('link');style.rel='stylesheet';style.href=new URL('../teacher-world/workspace-overview.css',locationHref).href;style.setAttribute('data-teacher-overview-style','1');documentObject.head?.append(style);}
  const active=()=>{guard();if(stopped)throw Object.assign(new Error('워크스페이스의 수업 연결이 끝났어요.'),{code:'ACCOUNT_CHANGED'});};
  const current=version=>{active();if(version!==epoch)throw Object.assign(new Error('담당 수업이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
  function clearFrame(){epoch++;frame?.remove();frame=null;if(windowObject.SYNKClassroomHost===host)delete windowObject.SYNKClassroomHost;delete windowObject.SYNKClassroomSelection;host=null;framePermissions=new Map();mount.replaceChildren();}
  const permission=row=>row&&({id:row.id,revision:row.sharing?.revision,enabled:row.sharing?.enabled,connected:row.accountConnected,revoked:row.revoked===true||row.accountConnectionStatus==='revoked',townRevision:row.activity?.town?.sharing?.revision,townEnabled:row.activity?.town?.sharing?.enabled});
  const knownLearner=id=>overviewData?.classes?.find(row=>row.id===selected?.id)?.learners?.find(row=>row.id===id);
  const permissionChanged=(previous,next)=>{if(!previous)return false;if(!next)return true;if(Number.isSafeInteger(previous.revision)&&Number.isSafeInteger(next.revision)){if(next.revision<previous.revision)return false;if(next.revision>previous.revision)return true;}return previous.enabled===true&&next.enabled===false||previous.connected===true&&next.connected===false||!previous.revoked&&next.revoked;};
  const townPermissionChanged=(previous,next)=>{if(!previous||!next)return false;if(Number.isSafeInteger(previous.townRevision)&&Number.isSafeInteger(next.townRevision)){if(next.townRevision<previous.townRevision)return false;if(next.townRevision>previous.townRevision)return true;}return previous.townEnabled===true&&next.townEnabled===false;};
  function rememberPermissions(data,classId){framePermissions=new Map((data.classes?.find(row=>row.id===classId)?.learners||[]).map(row=>[row.id,permission(row)]));}
  function assertCurrentSnapshot(data,classId){
    const known=overviewData?.classes?.find(row=>row.id===classId);if(!known)return;
    const latest=new Map((known.learners||[]).map(row=>[row.id,permission(row)]));
    for(const row of data.classes?.find(row=>row.id===classId)?.learners||[]){
      if(permissionChanged(permission(row),latest.get(row.id))||townPermissionChanged(permission(row),latest.get(row.id))||framePermissions.has(row.id)&&(permissionChanged(permission(row),framePermissions.get(row.id))||townPermissionChanged(permission(row),framePermissions.get(row.id))))throw Object.assign(new Error('학생의 공유 상태가 바뀌었어요. 최신 기록을 다시 확인해 주세요.'),{code:'CLASSROOM_SNAPSHOT_CHANGED',status:409});
    }
  }
  function publishPermissions(){
    if(!frame||!selected)return;
    const learners=overviewData?.classes?.find(row=>row.id===selected.id)?.learners;if(!Array.isArray(learners))return;
    if(learners.some(row=>!Number.isSafeInteger(row.sharing?.revision)||typeof row.sharing?.enabled!=='boolean'||typeof row.accountConnected!=='boolean'))return;
    frame.contentWindow?.postMessage?.({type:'synk-teacher-sharing',classId:selected.id,learners:learners.map(permission)},new URL(locationHref).origin);
  }
  function report(error){if(!stopped&&error.code!=='ACCOUNT_CHANGED')notice(error.message,true);}
  const overview=createTeacherOverview({root:overviewRoot,onStudent:(classId,learnerId)=>{void choose(classes.find(row=>row.id===classId)||null,{learnerId,userInitiated:true}).catch(report);},onClass:classId=>{void choose(classes.find(row=>row.id===classId)||null,{userInitiated:true}).catch(report);},onAll:()=>{void choose(null,{userInitiated:true}).catch(report);}});
  const studentSelected=event=>{
    const data=event.data;if(stopped||event.source!==frame?.contentWindow||event.origin!==new URL(locationHref).origin||data?.type!=='synk-teacher-selected'||data.classId!==selected?.id)return;
    if(!overviewData?.classes?.find(row=>row.id===data.classId)?.learners?.some(row=>row.id===data.learnerId))return;
    if(selectedLearnerId===data.learnerId&&windowObject.SYNKClassroomSelection?.learnerId===data.learnerId)return;
    selectedLearnerId=data.learnerId;windowObject.SYNKClassroomSelection={classId:data.classId,learnerId:data.learnerId};renderOverview();
  };
  windowObject.addEventListener('message',studentSelected);
  function renderOverview(){if(!overviewData?.classes?.length&&classes.length){overviewRoot.className='teacher-overview';overviewRoot.replaceChildren(make('p',online?'담당 '+classes.length+'개 반의 학생 기록을 불러오고 있어요.':'담당 '+classes.length+'개 반의 학생 기록을 확인하지 못했어요. 연결 후 다시 불러와 주세요.'));return;}overview.render(overviewData||{classes:[]},{selectedClassId:selected?.id,selectedLearnerId,unavailable:!online});}
  function picker(){
    const empty=make('option',classes.length?'담당 반 전체 보기':'등록된 담당 수업이 없어요');empty.value='';select.replaceChildren(empty);
    for(const row of classes){const option=make('option',row.name);option.value=row.id;select.append(option);}select.value=selected?.id||'';
  }
  function canLeave(){try{return !frame?.contentWindow?.SYNKTeacherView?.hasDraft?.()||windowObject.confirm?.('작성 중인 과제나 관찰·케어 내용을 닫고 다른 학생을 볼까요?')===true;}catch{return false;}}
  async function choose(row,{learnerId=null,userInitiated=false,refreshScope=false}={}){
    active();if(userInitiated&&!canLeave()){picker();return;}
    if(row&&selected?.id===row.id&&frame&&!refreshScope&&!permissionChanged(framePermissions.get(learnerId),permission(knownLearner(learnerId)))){
      selectedLearnerId=learnerId;windowObject.SYNKClassroomSelection={classId:row.id,learnerId};frame.contentWindow?.postMessage?.({type:'synk-teacher-select',classId:row.id,learnerId},new URL(locationHref).origin);picker();renderOverview();frame.scrollIntoView({block:'start',behavior:'instant'});return;
    }
    clearFrame();selected=row;selectedLearnerId=learnerId;picker();renderOverview();const version=epoch;
    if(!row){status.textContent=classes.length?'모든 담당 반의 학생과 후속 일을 함께 보고 있어요. 학생을 선택하면 상세와 처리 화면이 열려요.':'기관에서 교사 소속과 담당 반을 등록하면 이곳에 표시돼요.';return;}
    status.textContent='담당 수업의 접근 권한을 확인하고 있어요.';
    const check=()=>{current(version);if(!online)throw Object.assign(new Error('수업 연결을 다시 확인하고 있어요. 잠시 뒤 다시 시도해 주세요.'),{code:'NETWORK_ERROR'});};
    const client=createClassroomClient({transport,classId:row.id,guard:check});
    let snapshotRequestSeq=0,snapshotAppliedSeq=0;
    const workspace=await client.request('/api/workspace');check();
    if(workspace.mode!=='account-linked'||!workspace.classes?.some(classroom=>classroom.id===row.id))throw new Error('담당 수업을 확인하지 못했어요. 소속을 다시 확인해 주세요.');
    assertCurrentSnapshot(workspace,row.id);rememberPermissions(workspace,row.id);
    host=Object.freeze({mode:'account-linked',classId:row.id,focusWorkspace:()=>{check();frame?.scrollIntoView({block:'start',behavior:'instant'});},request:(path,body)=>{check();const snapshotSeq=path==='/api/workspace'?++snapshotRequestSeq:0,pending=client.request(path,body);return pending.then(result=>{check();if(path==='/api/workspace'){if(snapshotSeq<snapshotAppliedSeq)throw Object.assign(new Error('더 최신의 수업 기록을 확인했어요. 다시 불러와 주세요.'),{code:'CLASSROOM_SNAPSHOT_CHANGED',status:409});assertCurrentSnapshot(result,row.id);rememberPermissions(result,row.id);snapshotAppliedSeq=snapshotSeq;}if(body!==undefined)void load().catch(report);return result;});}});
    windowObject.SYNKClassroomHost=host;windowObject.SYNKClassroomSelection={classId:row.id,learnerId};
    frame=make('iframe');frame.title=row.name+' · 학생 상세와 수업 처리';frame.src=new URL('../teacher-world/?account=1',locationHref).href;mount.append(frame);status.textContent='학생이 공유한 학습 기록으로 다음 수업과 과제를 준비해요.';
    if(userInitiated)mount.scrollIntoView({block:'start',behavior:'instant'});
  }
  async function readOverview(rows){
    try{return await transport('teacherOverview');}
    catch(error){
      if(!['INVALID_REQUEST','NOT_FOUND'].includes(error.code)&&error.status!==404)throw error;
      const workspaces=await Promise.all(rows.map(row=>transport('workspace',{classId:row.id})));
      return {mode:'account-linked',classes:workspaces.flatMap(data=>data.classes||[]),care:workspaces.flatMap(data=>data.care||[]),assignments:workspaces.flatMap(data=>data.assignments||[]),asOf:workspaces[0]?.asOf};
    }
  }
  function restrictOverview(data,allowed){
    if(!data)return null;
    const scopedClasses=(data.classes||[]).filter(row=>allowed.has(row.id)),learnerIds=new Set(scopedClasses.flatMap(row=>(row.learners||[]).map(learner=>learner.id)));
    return {...data,classes:scopedClasses,care:(data.care||[]).filter(row=>allowed.has(row.classId)),assignments:(data.assignments||[]).filter(row=>allowed.has(row.classId)),observations:(data.observations||[]).filter(row=>row.classId?allowed.has(row.classId):learnerIds.has(row.learnerId)),careAssignees:(data.careAssignees||[]).filter(row=>!Array.isArray(row.classIds)||row.classIds.some(id=>allowed.has(id)))};
  }
  async function load(){
    active();const version=++requestVersion,reconnecting=!online;let data,rows;
    try{
      const result=await transport('classes');active();if(version!==requestVersion)return;
      if(result?.mode!=='account-linked'||!Array.isArray(result.classes)||result.classes.some(row=>typeof row.id!=='string'||!row.id||typeof row.name!=='string'||!['teacher','learner'].includes(row.role)))throw Object.assign(new Error('수업 목록을 확인하지 못했어요.'),{code:'INVALID_CLASSROOM_RESPONSE'});
      rows=result.classes.filter(row=>row.role==='teacher').sort(compareTeacherRows);const authorized=new Set(rows.map(row=>row.id));
      // A successful membership response is already revocation evidence, even
      // when the following aggregate request is offline or fails later.
      if(selected&&!authorized.has(selected.id)){clearFrame();selected=null;selectedLearnerId=null;}
      classes=rows;overviewData=restrictOverview(overviewData,authorized);picker();renderOverview();
      data=rows.length?await readOverview(rows):{mode:'account-linked',classes:[],care:[],assignments:[]};active();if(version!==requestVersion)return;
      if(data?.mode!=='account-linked'||!Array.isArray(data.classes)||data.classes.some(row=>typeof row.id!=='string'||!row.id))throw Object.assign(new Error('담당 반 전체의 기록을 확인하지 못했어요.'),{code:'INVALID_CLASSROOM_RESPONSE'});
      online=true;
    }catch(error){
      active();if(version!==requestVersion)return;online=false;
      if(error.status===401||error.status===403||error.code==='INVALID_CLASSROOM_RESPONSE'){clearFrame();selected=null;selectedLearnerId=null;classes=[];overviewData=null;picker();}
      renderOverview();status.textContent='수업 소속을 확인하지 못했어요. 연결 후 다시 확인해 주세요.';throw error;
    }
    const allowed=new Set(rows.map(row=>row.id));overviewData=restrictOverview({...data,classes:data.classes.map(row=>({...row,name:row.name||rows.find(member=>member.id===row.id)?.name,learners:Array.isArray(row.learners)?row.learners:[]}))},allowed);
    const visible=new Set(overviewData.classes.map(row=>row.id));classes=rows.filter(row=>visible.has(row.id));
    const prior=selected&&classes.find(row=>row.id===selected.id),row=prior||(classes.length===1?classes[0]:null);
    if(prior&&frame){
      publishPermissions();
      const focused=selectedLearnerId||windowObject.SYNKClassroomSelection?.learnerId;
      if(focused&&permissionChanged(framePermissions.get(focused),permission(knownLearner(focused)))){await choose(prior,{learnerId:knownLearner(focused)?focused:null,refreshScope:true});return;}
      selected=prior;picker();renderOverview();status.textContent='학생이 공유한 학습 기록으로 다음 수업과 과제를 준비해요.';if(reconnecting)notice('수업 연결이 복구됐어요. 열어 둔 수업에서 계속할 수 있어요.');return;
    }
    await choose(row);
    if(reconnecting)notice('수업 연결이 복구됐어요. 담당 수업을 다시 확인했어요.');
  }
  select.onchange=()=>{void choose(classes.find(row=>row.id===select.value)||null,{userInitiated:true}).catch(report);};
  refresh.onclick=()=>{refresh.disabled=true;void load().catch(report).finally(()=>{if(!stopped)refresh.disabled=false;});};
  timer=setInterval(()=>{void load().catch(report);},pollMs);
  return Object.freeze({load,stop(){if(stopped)return;stopped=true;requestVersion++;clearInterval(timer);windowObject.removeEventListener('message',studentSelected);clearFrame();overview.stop();root.replaceChildren();root.hidden=true;}});
}
