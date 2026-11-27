import {createClassroomClient} from './classroom-client.mjs';
import {createTeacherOverview,compareTeacherRows} from '../../teacher-world/workspace-overview.mjs';
import {createClassRecords} from '../../teacher-world/class-records.mjs';

// All server-approved classes are visible; individual work uses one scoped host.
export function createTeacherWorkspace({root,transport,guard,notice,documentObject=document,windowObject=window,locationHref=location.href,pollMs=15000}){
  let stopped=false,epoch=0,requestVersion=0,overviewVersion=0,selected=null,selectedLearnerId=null,frame=null,host=null,records=null,recordsStale=false,staleFrom=0,timer=null,classes=[],online=true,overviewData=null,framePermissions=new Map();
  const make=(tag,text)=>{const element=documentObject.createElement(tag);if(text)element.textContent=text;return element;};
  const controls=make('div'),label=make('label','담당 반'),select=make('select'),refresh=make('button','반 목록 새로고침'),status=make('p'),overviewRoot=make('section'),mount=make('div');
  controls.className='teacher-class-controls';select.setAttribute('aria-label','담당 반');refresh.type='button';refresh.className='plain';status.className='small';mount.className='teacher-class-mount';
  label.append(select);controls.append(label,refresh);root.replaceChildren(controls,status,overviewRoot,mount);root.hidden=false;
  if(!documentObject.querySelector?.('link[data-teacher-overview-style]')){const style=make('link');style.rel='stylesheet';style.href=new URL('../teacher-world/workspace-overview.css',locationHref).href;style.setAttribute('data-teacher-overview-style','1');documentObject.head?.append(style);}
  const active=()=>{guard();if(stopped)throw Object.assign(new Error('내 수업 연결이 끊겼어요. 다시 열어 주세요.'),{code:'ACCOUNT_CHANGED'});};
  const current=version=>{active();if(version!==epoch)throw Object.assign(new Error('고른 반이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
  function clearFrame(){epoch++;records?.stop();records=null;recordsStale=false;frame?.remove();frame=null;if(windowObject.SYNKClassroomHost===host)delete windowObject.SYNKClassroomHost;delete windowObject.SYNKClassroomSelection;host=null;framePermissions=new Map();mount.replaceChildren();}
  const permission=row=>row&&({id:row.id,revision:row.sharing?.revision,enabled:row.sharing?.enabled,connected:row.accountConnected,revoked:row.revoked===true||row.accountConnectionStatus==='revoked',townRevision:row.activity?.town?.sharing?.revision,townEnabled:row.activity?.town?.sharing?.enabled});
  const knownLearner=id=>overviewData?.classes?.find(row=>row.id===selected?.id)?.learners?.find(row=>row.id===id);
  const permissionChanged=(previous,next)=>{if(!previous)return false;if(!next)return true;if(Number.isSafeInteger(previous.revision)&&Number.isSafeInteger(next.revision)){if(next.revision<previous.revision)return false;if(next.revision>previous.revision)return true;}return previous.enabled===true&&next.enabled===false||previous.connected===true&&next.connected===false||!previous.revoked&&next.revoked;};
  const townPermissionChanged=(previous,next)=>{if(!previous||!next)return false;if(Number.isSafeInteger(previous.townRevision)&&Number.isSafeInteger(next.townRevision)){if(next.townRevision<previous.townRevision)return false;if(next.townRevision>previous.townRevision)return true;}return previous.townEnabled===true&&next.townEnabled===false;};
  function rememberPermissions(data,classId){framePermissions=new Map((data.classes?.find(row=>row.id===classId)?.learners||[]).map(row=>[row.id,permission(row)]));}
  const sharingChanged=()=>Object.assign(new Error('학생의 공유 상태가 바뀌었어요. 다시 불러와 주세요.'),{code:'CLASSROOM_SNAPSHOT_CHANGED',status:409});
  // 응답을 받은 뒤 새로 받은 개요가 그 줄과 같은 판·같은 상태라는 보증. iframe이 이미 본 판보다 개요가 뒤처졌으면 보증하지 못한다.
  const vouches=(fresh,next,seen)=>!!fresh&&Number.isSafeInteger(next.revision)&&['revision','enabled','connected','revoked','townRevision','townEnabled'].every(key=>fresh[key]===next[key])&&!(seen?.revision>fresh.revision)&&!(seen?.townRevision>fresh.townRevision);
  // confirmed는 응답 뒤에 새로 받은 개요와 견줄 때다. 그 개요가 보증한 줄은 iframe이 그보다 앞서 본 상태(예: 연결 전)와 다시 견주지 않는다.
  function assertCurrentSnapshot(data,classId,confirmed=false){
    const known=overviewData?.classes?.find(row=>row.id===classId);if(!known){if(confirmed)throw sharingChanged();return;}
    const latest=new Map((known.learners||[]).map(row=>[row.id,permission(row)]));
    for(const row of data.classes?.find(row=>row.id===classId)?.learners||[]){
      const next=permission(row),fresh=latest.get(row.id),seen=framePermissions.get(row.id);
      if(permissionChanged(next,fresh)||townPermissionChanged(next,fresh)||seen&&!(confirmed&&vouches(fresh,next,seen))&&(permissionChanged(next,seen)||townPermissionChanged(next,seen)))throw sharingChanged();
    }
  }
  // 공유 판이 그대로인 채 바뀐 줄(학생이 반에 막 연결함·명부에 새로 든 학생)은 아직 안 갱신된 개요나 iframe이 본 상태와 어긋난다.
  // 그때는 개요를 새로 받아 다시 견준다. 철회·공유 끔 전의 낡은 응답은 새 개요와도 어긋나 그대로 막힌다.
  async function acceptSnapshot(data,classId,check,reselect){
    try{assertCurrentSnapshot(data,classId);}catch(error){
      if(error.code!=='CLASSROOM_SNAPSHOT_CHANGED')throw error;
      const since=requestVersion;await load({reselect});check();if(overviewVersion<=since)throw error;
      assertCurrentSnapshot(data,classId,true);
    }
  }
  // 고른 반 학생 모두의 확인된 공유 상태. 한 줄이라도 비면 null이다(iframe이 그 자리에서 거를 수 없다).
  function classPermissions(){
    if(!frame||!selected)return null;
    const learners=overviewData?.classes?.find(row=>row.id===selected.id)?.learners;if(!Array.isArray(learners))return null;
    if(learners.some(row=>!Number.isSafeInteger(row.sharing?.revision)||typeof row.sharing?.enabled!=='boolean'||typeof row.accountConnected!=='boolean'))return null;
    return learners.map(permission);
  }
  function publishPermissions(){const learners=classPermissions();if(learners)frame.contentWindow?.postMessage?.({type:'synk-teacher-sharing',classId:selected.id,learners},new URL(locationHref).origin);}
  // iframe이 바뀐 공유 상태로 그 자리에서 기록을 걸렀다고 바로 답할 때만 true다. 이때는 iframe을 다시 만들지 않아 쓰던 것이 남는다.
  function fenceFrame(){const learners=classPermissions();if(!learners)return false;try{return frame.contentWindow?.SYNKTeacherView?.applySharing?.({classId:selected.id,learners})===true;}catch{return false;}}
  function frameHasDraft(){try{return frame?.contentWindow?.SYNKTeacherView?.hasDraft?.()===true;}catch{return false;}}
  function report(error){if(!stopped&&error.code!=='ACCOUNT_CHANGED')notice(error.message,true);}
  const overview=createTeacherOverview({root:overviewRoot,onStudent:(classId,learnerId)=>{void choose(classes.find(row=>row.id===classId)||null,{learnerId,userInitiated:true}).catch(report);},onClass:classId=>{void choose(classes.find(row=>row.id===classId)||null,{userInitiated:true}).catch(report);},onAll:()=>{void choose(null,{userInitiated:true}).catch(report);}});
  const studentSelected=event=>{
    const data=event.data;if(stopped||event.source!==frame?.contentWindow||event.origin!==new URL(locationHref).origin||data?.type!=='synk-teacher-selected'||data.classId!==selected?.id)return;
    if(!overviewData?.classes?.find(row=>row.id===data.classId)?.learners?.some(row=>row.id===data.learnerId))return;
    if(selectedLearnerId===data.learnerId&&windowObject.SYNKClassroomSelection?.learnerId===data.learnerId)return;
    selectedLearnerId=data.learnerId;windowObject.SYNKClassroomSelection={classId:data.classId,learnerId:data.learnerId};renderOverview();
  };
  windowObject.addEventListener('message',studentSelected);
  function renderOverview(){if(!overviewData?.classes?.length&&classes.length){overviewRoot.className='teacher-overview';overviewRoot.replaceChildren(make('p',online?'담당 '+classes.length+'개 반의 학생 기록을 불러오고 있어요.':'담당 '+classes.length+'개 반의 학생 기록을 불러오지 못했어요. 연결되면 다시 불러와 주세요.'));return;}overview.render(overviewData||{classes:[]},{selectedClassId:selected?.id,selectedLearnerId,unavailable:!online});}
  function picker(){
    const empty=make('option',classes.length?'전체 반 보기':'담당 반이 없어요');empty.value='';select.replaceChildren(empty);
    for(const row of classes){const option=make('option',row.name);option.value=row.id;select.append(option);}select.value=selected?.id||'';
  }
  // 같은 반 안에서 학생만 바꿀 때는 띠(출결 · TOPIK)가 닫히지 않으니 수업 화면(iframe)에 쓰던 것만 묻는다.
  function canLeave(closesRecords=true){
    try{
      const frameDraft=frame?.contentWindow?.SYNKTeacherView?.hasDraft?.()===true,recordsDraft=closesRecords&&records?.hasDraft()===true;if(!frameDraft&&!recordsDraft)return true;
      return windowObject.confirm?.(frameDraft&&recordsDraft?'쓰던 과제·관찰·챙길 일과 저장하지 않은 출결 · TOPIK 성적이 닫혀요. 넘어갈까요?':frameDraft?'쓰던 과제·관찰·챙길 일이 닫혀요. 다른 학생으로 넘어갈까요?':'저장하지 않은 출결 · TOPIK 성적이 닫혀요. 넘어갈까요?')===true;
    }catch{return false;}
  }
  async function choose(row,{learnerId=null,userInitiated=false,refreshScope=false}={}){
    active();const stay=!!row&&selected?.id===row.id&&!!frame&&!refreshScope&&!permissionChanged(framePermissions.get(learnerId),permission(knownLearner(learnerId)));
    if(userInitiated&&!canLeave(!stay)){picker();return;}
    if(stay){
      selectedLearnerId=learnerId;windowObject.SYNKClassroomSelection={classId:row.id,learnerId};frame.contentWindow?.postMessage?.({type:'synk-teacher-select',classId:row.id,learnerId},new URL(locationHref).origin);picker();renderOverview();mount.scrollIntoView({block:'start',behavior:'instant'});records?.focus(learnerId);return;
    }
    clearFrame();selected=row;selectedLearnerId=learnerId;picker();renderOverview();const version=epoch;
    if(!row){status.textContent=classes.length?'담당 반 전체를 보고 있어요. 학생을 누르면 그 학생의 기록과 과제가 열려요.':'기관에서 담당 반을 등록하면 여기에 보여요.';return;}
    status.textContent='이 반을 볼 권한을 확인하고 있어요.';
    const check=()=>{current(version);if(!online)throw Object.assign(new Error('연결을 다시 확인하고 있어요. 잠시 뒤 다시 해 주세요.'),{code:'NETWORK_ERROR'});};
    const client=createClassroomClient({transport,classId:row.id,guard:check});
    let snapshotRequestSeq=0,snapshotAppliedSeq=0;
    const newerApplied=()=>Object.assign(new Error('그사이 새 기록이 들어왔어요. 다시 불러와 주세요.'),{code:'CLASSROOM_SNAPSHOT_CHANGED',status:409});
    const workspace=await client.request('/api/workspace');check();
    if(workspace.mode!=='account-linked'||!workspace.classes?.some(classroom=>classroom.id===row.id))throw new Error('이 반을 열지 못했어요. 「반 목록 새로고침」을 눌러 주세요.');
    // 여는 중에는 개요만 새로 받는다(반을 다시 열면 이 열기를 되풀이한다).
    await acceptSnapshot(workspace,row.id,check,false);check();rememberPermissions(workspace,row.id);
    host=Object.freeze({mode:'account-linked',classId:row.id,focusWorkspace:()=>{check();frame?.scrollIntoView({block:'start',behavior:'instant'});},request:(path,body)=>{check();const snapshotSeq=path==='/api/workspace'?++snapshotRequestSeq:0,pending=client.request(path,body);return pending.then(async result=>{check();if(path==='/api/workspace'){if(snapshotSeq<snapshotAppliedSeq)throw newerApplied();await acceptSnapshot(result,row.id,check,true);check();if(snapshotSeq<snapshotAppliedSeq)throw newerApplied();rememberPermissions(result,row.id);snapshotAppliedSeq=snapshotSeq;}if(body!==undefined)void load().catch(report);return result;});}});
    windowObject.SYNKClassroomHost=host;windowObject.SYNKClassroomSelection={classId:row.id,learnerId};
    // 「오늘 출결」 띠와 학생 줄 TOPIK 칸. 서버가 이 반 응답에 출결을 싣지 않으면(기능 스위치 꺼짐) 그리지 않는다.
    // 저장하면 개요를 다시 받고, 받은 개요로 띠의 연속 결석 · TOPIK 배지도 바꾼다(load 안에서 recordsStale을 본다).
    const recordsRoot=make('section');records=createClassRecords({root:recordsRoot,request:(path,body)=>client.request(path,body),guard:check,notice,documentObject,onSaved:()=>{recordsStale=true;staleFrom=requestVersion+1;void load().catch(report);}});
    if(records.render(workspace,row.id,{learnerId}))mount.append(recordsRoot);else{records.stop();records=null;}
    frame=make('iframe');frame.title=row.name+' · 학생별 기록과 과제';frame.src=new URL('../teacher-world/?account=1',locationHref).href;mount.append(frame);status.textContent='학생이 공유한 학습 기록으로 다음 수업과 과제를 준비해요.';
    if(userInitiated)mount.scrollIntoView({block:'start',behavior:'instant'});
    if(userInitiated&&learnerId)records?.focus(learnerId);
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
  async function load({reselect=true}={}){
    active();const version=++requestVersion,reconnecting=!online;let data,rows;
    try{
      const result=await transport('classes');active();if(version!==requestVersion)return;
      if(result?.mode!=='account-linked'||!Array.isArray(result.classes)||result.classes.some(row=>typeof row.id!=='string'||!row.id||typeof row.name!=='string'||!['teacher','learner'].includes(row.role)))throw Object.assign(new Error('반 목록을 불러오지 못했어요. 「반 목록 새로고침」을 눌러 주세요.'),{code:'INVALID_CLASSROOM_RESPONSE'});
      rows=result.classes.filter(row=>row.role==='teacher').sort(compareTeacherRows);const authorized=new Set(rows.map(row=>row.id));
      // A successful membership response is already revocation evidence, even
      // when the following aggregate request is offline or fails later.
      if(selected&&!authorized.has(selected.id)){clearFrame();selected=null;selectedLearnerId=null;}
      classes=rows;overviewData=restrictOverview(overviewData,authorized);picker();renderOverview();
      data=rows.length?await readOverview(rows):{mode:'account-linked',classes:[],care:[],assignments:[]};active();if(version!==requestVersion)return;
      if(data?.mode!=='account-linked'||!Array.isArray(data.classes)||data.classes.some(row=>typeof row.id!=='string'||!row.id))throw Object.assign(new Error('담당 반 기록을 불러오지 못했어요. 「반 목록 새로고침」을 눌러 주세요.'),{code:'INVALID_CLASSROOM_RESPONSE'});
      online=true;
    }catch(error){
      active();if(version!==requestVersion)return;online=false;
      if(error.status===401||error.status===403||error.code==='INVALID_CLASSROOM_RESPONSE'){clearFrame();selected=null;selectedLearnerId=null;classes=[];overviewData=null;picker();}
      renderOverview();status.textContent='반 목록을 불러오지 못했어요. 연결되면 「반 목록 새로고침」을 눌러 주세요.';throw error;
    }
    const allowed=new Set(rows.map(row=>row.id));overviewData=restrictOverview({...data,classes:data.classes.map(row=>({...row,name:row.name||rows.find(member=>member.id===row.id)?.name,learners:Array.isArray(row.learners)?row.learners:[]}))},allowed);overviewVersion=version;
    const visible=new Set(overviewData.classes.map(row=>row.id));classes=rows.filter(row=>visible.has(row.id));
    // 띠: 저장 뒤에는 개요로 파생 표시까지, 그 밖의 주기적 다시 받기에서는 명부와 공유 상태만 바꾼다.
    // 저장 뒤에 출발한 개요(순번 staleFrom 이상)만 파생 표시까지 바꾸고 표식을 지운다. 그보다 먼저 출발한 개요는 공유 상태만 본다.
    // 띠의 저장 전 내용은 다시 받기 전에 잰다. 공유를 끈 학생의 줄과 TOPIK 칸은 refresh가 바로 닫아, 뒤에서 재면 알림이 빠진다.
    const recordsDraftBefore=records?.hasDraft()===true;
    if(records){const fresh=recordsStale&&version>=staleFrom;records.refresh(overviewData,{sharingOnly:!fresh});if(fresh)recordsStale=false;}
    // 담당이 풀려 고른 반이 지워졌으면 아래 길로 내려가 상태 줄까지 맞춘다(여는 중이던 열기는 epoch가 바뀌어 끝난다).
    if(!reselect&&selected){picker();renderOverview();return;}
    const prior=selected&&classes.find(row=>row.id===selected.id),row=prior||(classes.length===1?classes[0]:null);
    if(prior&&frame){
      publishPermissions();
      const focused=selectedLearnerId||windowObject.SYNKClassroomSelection?.learnerId;
      // 고른 학생의 공유가 바뀌면 그 학생의 기록은 묻지 않고 바로 내린다. iframe이 그 자리에서 걸렀다고 답하면 그대로 두고
      // (명부 기준인 과제 첨삭 초안이 남는다), 답하지 못하면 지금처럼 다시 만든다 — 그때 닫힌 작성 내용이 있으면 알린다.
      if(focused&&permissionChanged(framePermissions.get(focused),permission(knownLearner(focused)))){
        // 다시 열면 띠(출결 · TOPIK)도 닫히니, 띠에 저장 전 내용이 있었어도 알린다(다시 열기 전에 잰다).
        if(!fenceFrame()){const frameDraft=frameHasDraft(),recordsDraft=recordsDraftBefore||records?.hasDraft()===true,reopened=choose(prior,{learnerId:knownLearner(focused)?focused:null,refreshScope:true});
          if((frameDraft||recordsDraft)&&!stopped)notice('학생의 공유 상태가 바뀌어 수업 화면을 새로 열었어요. 저장하지 않은 '+(frameDraft&&recordsDraft?'내용과 출결 · TOPIK은':recordsDraft?'출결 · TOPIK은':'내용은')+' 닫혔어요.',true);await reopened;return;}
        if(!knownLearner(focused)){selectedLearnerId=null;windowObject.SYNKClassroomSelection={classId:prior.id,learnerId:null};}
      }
      selected=prior;picker();renderOverview();status.textContent='학생이 공유한 학습 기록으로 다음 수업과 과제를 준비해요.';if(reconnecting)notice('다시 연결됐어요. 열어 둔 반에서 이어서 하면 돼요.');return;
    }
    await choose(row);
    if(reconnecting)notice('다시 연결됐어요. 담당 반을 새로 불러왔어요.');
  }
  select.onchange=()=>{void choose(classes.find(row=>row.id===select.value)||null,{userInitiated:true}).catch(report);};
  refresh.onclick=()=>{refresh.disabled=true;void load().catch(report).finally(()=>{if(!stopped)refresh.disabled=false;});};
  timer=setInterval(()=>{void load().catch(report);},pollMs);
  return Object.freeze({load,stop(){if(stopped)return;stopped=true;requestVersion++;clearInterval(timer);windowObject.removeEventListener('message',studentSelected);clearFrame();overview.stop();root.replaceChildren();root.hidden=true;}});
}
