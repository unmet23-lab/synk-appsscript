import {createAccountView} from './account-view.mjs';
import {createLocalWorldClient} from './local-world-client.mjs';
import {createWorldClassroom} from './world-classroom.mjs';

export function mountLocalWorld({documentObject=document,windowObject=window,storage=sessionStorage,createView=createAccountView,createClassroom=createWorldClassroom,clientFactory=createLocalWorldClient}={}){
  const key='synk.local-world.connection.v1',$=id=>documentObject.getElementById(id);
  let token=null,generation=0,classroomGeneration=0,view=null,classroom=null,joining=false,resuming=false;
  const notice=(message,error=false)=>{const node=$('notice');node.textContent=message;node.className=`notice${error?' error':''}`;};
  const changed=()=>Object.assign(new Error('계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});
  function stopViews(){generation++;classroomGeneration++;view?.stop();classroom?.stop();view=null;classroom=null;}
  function clear(){stopViews();token=null;try{storage.removeItem(key);}catch{}$('local-join').hidden=false;$('local-reconnect').hidden=true;documentObject.documentElement.dataset.localWorld='disconnected';}
  function suspend(error){stopViews();$('local-join').hidden=true;$('local-reconnect').hidden=false;documentObject.documentElement.dataset.localWorld='retry';notice(`${error.message||'연결을 확인하지 못했어요.'} 기존 개발 연결은 유지했습니다. 다시 불러와 주세요.`,true);}
  function createClient(){const current=generation;return clientFactory({getToken:()=>token,guard:()=>{if(current!==generation)throw changed();},onUnauthorized:old=>{if(old===token){clear();notice('개발 연결이 끝났어요. 연결 코드로 다시 들어와 주세요.',true);}},onSharing:()=>{if(current===generation){classroom?.stop();classroom=null;void mountClassroom(current).catch(error=>{if(current===generation)suspend(error);});}}});}
  async function mountClassroom(current,client=createClient()){
    const mount=++classroomGeneration,student=await client.student();if(current!==generation||mount!==classroomGeneration)return;
    if(typeof student?.learner?.id!=='string')throw new Error('연결한 학생을 확인하지 못했어요.');
    classroom?.stop();classroom=createClassroom({root:$('world-classroom'),client,learnerId:student.learner.id,guard:()=>{if(current!==generation)throw changed();},notice,launchRun:run=>view?.launchRun(run),closeGame:()=>view?.closeGame?.()});
    await classroom.reload();
  }
  async function connected(){
    const current=generation,client=createClient(),guard=()=>{if(current!==generation||!token)throw changed();};
    view=createView({client,product:'world',guard,notice,localConnection:true,onGameRequest:gameId=>{if(!classroom)throw new Error('게임 목록을 불러오는 중이에요.');return classroom.openGame(gameId);},logout:async()=>{
      try{await client.logout();guard();clear();notice('이 창의 개발 연결을 종료했어요.');}
      catch(error){if(current!==generation)return;notice('서버의 연결 종료를 확인하지 못했어요. 연결을 유지하고 있으니 다시 눌러 주세요.',true);}
    }});
    await view.load();guard();$('local-join').hidden=true;await mountClassroom(current,client);guard();documentObject.documentElement.dataset.localWorld='connected';notice('WORLD와 교사 앱을 로컬 개발 계정으로 연결했어요. 실제 학습과 과제를 이어가세요.');
  }
  async function resume(){
    if(!token||resuming)return;resuming=true;stopViews();const current=generation;$('local-join').hidden=true;$('local-reconnect').hidden=true;$('local-retry-button').disabled=true;
    try{await connected();}catch(error){if(current===generation)suspend(error);}finally{resuming=false;$('local-retry-button').disabled=false;}
  }
  async function join(event){
    event.preventDefault();if(joining)return;const code=$('connection-code').value.trim(),consent=$('connection-consent').checked;if(!code||!consent){notice('연결 코드와 학습 공유 동의를 확인해 주세요.',true);return;}
    joining=true;$('local-join-button').disabled=true;clear();const current=generation;
    try{const result=await createClient().join(code,consent);if(current!==generation)return;if(typeof result?.token!=='string'||!result.token)throw new Error('연결 응답을 확인하지 못했어요.');token=result.token;try{storage.setItem(key,JSON.stringify({token}));}catch{}$('connection-code').value='';await resume();}
    catch(error){if(current===generation){clear();notice(error.message||'연결을 시작하지 못했어요.',true);}}
    finally{joining=false;$('local-join-button').disabled=false;}
  }
  const retry=()=>{void resume();},pagehide=()=>stopViews();
  $('local-join-form').addEventListener('submit',join);$('local-retry-button').addEventListener('click',retry);windowObject.addEventListener('pagehide',pagehide);
  try{const saved=JSON.parse(storage.getItem(key)||'null');if(typeof saved?.token==='string')token=saved.token;}catch{}
  if(token)void resume();else notice('선생님이 발급한 개발 연결 코드를 입력해 주세요. 실제 SYNK ID 로그인과는 별도입니다.');
  return Object.freeze({stop(){stopViews();$('local-join-form').removeEventListener('submit',join);$('local-retry-button').removeEventListener('click',retry);windowObject.removeEventListener('pagehide',pagehide);}});
}
if(typeof document!=='undefined')mountLocalWorld();
