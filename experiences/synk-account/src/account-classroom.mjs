import {createAccountView} from './account-view.mjs';
import {createClassroomClient} from './classroom-client.mjs';
import {createWorldClassroom} from './world-classroom.mjs';
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
// One selected class, one learning host. Switching scope destroys the previous host first.
export function createAccountWorkspace({client,transport,product,guard,notice,logout}){
  let stopped=false,epoch=0,accountView=null,classroom=null,teacherFrame=null,selected=null,classes=[],context=null,host=null;
  const panel=node('section'),controls=node('div'),content=node('section');panel.className='sb-card classroom-connection';panel.hidden=true;content.id='world-classroom';content.hidden=true;panel.append(controls,content);document.getElementById('account').before(panel);
  function clear(){epoch++;classroom?.stop();classroom=null;accountView?.stop();accountView=null;teacherFrame?.remove();teacherFrame=null;if(window.SYNKClassroomHost===host)delete window.SYNKClassroomHost;host=null;context=null;}
  const current=version=>{guard();if(stopped||version!==epoch)throw Object.assign(new Error('수업 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
  function picker(){
    controls.replaceChildren(node('h2','나의 수업 연결'));
    const label=node('label','수업 공간'),select=node('select');select.setAttribute('aria-label','수업 공간');const empty=node('option','개인 학습');empty.value='';select.append(empty);
    for(const row of classes){const option=node('option',`${row.name} · ${row.role==='teacher'?'교사':'학생'}`);option.value=`${row.role}:${row.id}`;select.append(option);}select.value=selected?`${selected.role}:${selected.id}`:'';label.append(select);controls.append(label);
    select.onchange=()=>{const row=classes.find(c=>`${c.role}:${c.id}`===select.value)||null;void choose(row).catch(report);};
    const status=node('p');status.className='small';status.dataset.sharingStatus='';controls.append(status);
    const retry=node('button','수업 소속 다시 확인');retry.className='plain';retry.onclick=()=>{void load().catch(report);};controls.append(retry);
  }
  function report(error){if(!stopped&&error.code!=='ACCOUNT_CHANGED')notice(error.message,true);}
  function sharingUI(value,scoped,version){
    current(version);context=value;controls.querySelector('[data-sharing-toggle]')?.remove();
    const status=controls.querySelector('[data-sharing-status]');status.textContent='동의하면 계정에 이미 저장한 학습 기록과 앞으로 저장할 학습 기록, 이 수업의 과제 결과를 담당 선생님이 볼 수 있어요. 개인 기록 저장과 별도로 선택하며 언제든 끌 수 있어요.';
    const label=node('label'),input=node('input');label.className='toggle';label.dataset.sharingToggle='';input.type='checkbox';input.checked=value.sharing?.enabled===true;input.disabled=!input.checked&&value.accountLearning?.enabled===false;label.append(input,node('span',`${selected.name} 선생님에게 수업 기록 공유`));controls.append(label);
    if(input.disabled)status.textContent+=' 먼저 계정의 학습 기록 연결을 켜 주세요.';
    input.onchange=()=>{const enabled=input.checked,revision=context.sharing.revision;input.disabled=true;accountView?.closeGame();void (async()=>{current(version);await scoped.setSharing(enabled,revision);current(version);await choose(selected);})().catch(error=>{if(version===epoch){input.checked=context?.sharing.enabled===true;input.disabled=false;}report(error);});};
  }
  async function choose(row){
    clear();const version=epoch;selected=row;picker();content.hidden=true;
    const check=()=>current(version),scoped=row?createClassroomClient({transport,classId:row.id,guard:check}):null;
    if(row?.role==='teacher'){
      // Confirm server role/scope before opening a teacher renderer. No token crosses the frame boundary.
      await scoped.request('/api/workspace');check();
      accountView=createAccountView({client,product:'platform',guard:check,notice,logout});await accountView.load();check();
      host=Object.freeze({mode:'account-linked',classId:row.id,focusWorkspace:()=>{check();teacherFrame?.scrollIntoView({block:'start',behavior:'instant'});},request:(path,body)=>{check();return scoped.request(path,body);}});window.SYNKClassroomHost=host;
      teacherFrame=node('iframe');teacherFrame.title=`${row.name} 교사 공간`;teacherFrame.src=new URL('../teacher-world/?account=1',location.href).href;panel.append(teacherFrame);return;
    }
    accountView=createAccountView({client,product,guard:check,notice,logout,...(row?{classConnection:{classId:row.id,client:scoped,onContext:value=>sharingUI(value,scoped,version)},onGameRequest:gameId=>{check();if(!classroom)throw new Error('수업 목록을 불러오는 중이에요.');return classroom.openGame(gameId);}}:{})});
    await accountView.load();check();
    if(row){const student=await scoped.student();check();if(student?.learner?.id!==row.learnerId)throw new Error('수업의 학생 계정을 다시 확인해 주세요.');
      classroom=createWorldClassroom({root:content,client:scoped,learnerId:row.learnerId,guard:check,notice,launchRun:run=>accountView.launchRun(run),closeGame:()=>accountView?.closeGame(),onSharingChange:()=>{void choose(row).catch(report);}});await classroom.reload();check();}
  }
  async function load(){
    clear();const version=epoch;guard();
    if(!transport){await choose(null);return;}
    let result;try{result=await transport('classes');current(version);}catch(error){current(version);classes=[];selected=null;await choose(null);panel.hidden=false;controls.querySelector('[data-sharing-status]').textContent='수업 연결 서비스가 아직 준비되지 않았거나 소속을 확인하지 못했어요. 개인 계정의 학습은 계속 사용할 수 있어요.';return;}
    if(!Array.isArray(result.classes)||result.classes.some(c=>typeof c.id!=='string'||typeof c.name!=='string'||!['teacher','learner'].includes(c.role)))throw new Error('수업 목록 응답을 확인하지 못했어요.');
    classes=result.classes;panel.hidden=!classes.length;
    const row=classes.find(c=>c.id===selected?.id&&c.role===selected?.role)||(classes.length===1?classes[0]:null);await choose(row);
  }
  return Object.freeze({load,launchRun:run=>accountView?.launchRun(run),closeGame:()=>accountView?.closeGame(),stop(){stopped=true;clear();panel.remove();}});
}
