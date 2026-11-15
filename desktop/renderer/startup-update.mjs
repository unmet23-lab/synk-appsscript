import {createPortalOrb} from './portal-orb.mjs';

const STATES=new Set(['checking','downloading','installing','error','ready']);
const METHODS={retry:'retry',current:'openCurrent',install:'install'};
const cleanVersion=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value)?value:null;
const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

function errorMessage(code){
  if(code==='UPDATE_BRIDGE_FAILED')return '업데이트 창을 불러오지 못했어요. 앱을 끈 뒤 다시 열어 주세요.';
  if(code==='UPDATE_RECOVERED')return '업데이트를 마치지 못해 이전 버전으로 돌아왔어요. 다시 해 보거나 지금 버전을 열 수 있어요.';
  if(code==='UPDATE_RECOVERY_INVALID')return '업데이트를 되돌린 기록을 읽지 못했어요. 다시 해 보거나 지금 버전을 열어 주세요.';
  if(code==='UPDATE_STORAGE_FAILED')return 'PC 저장 공간을 비운 뒤 다시 해 주세요.';
  if(code==='UPDATE_BUILD_MISMATCH')return '지금 앱과 올라온 버전이 맞지 않아요. 지금 버전을 연 뒤 synk.im에서 최신 설치 파일을 받아 주세요.';
  if(/INTEGRITY|INVALID|UNTRUSTED|DOWNGRADE/.test(code))return '받은 업데이트 파일이 온전하지 않아요. 다시 해 주세요.';
  if(/INSTALL|OPEN|HANDOFF/.test(code))return '업데이트 설치를 마치지 못했어요. 다시 해 보거나 지금 버전을 열 수 있어요.';
  return '인터넷 연결을 확인한 뒤 다시 해 주세요. 지금 버전을 열어 그대로 써도 돼요.';
}

function copy(snapshot){
  // 버전이 없을 때 「새 버전를」처럼 조사가 틀리던 것을, 버전을 앞에 따로 적는 꼴로 바꿨다.
  const latest=cleanVersion(snapshot.latestVersion),target=latest?'v'+latest+' · ':'';
  if(snapshot.state==='checking')return ['시작 준비','최신 버전을 확인하고 있어요','잠시만 기다려 주세요. 확인이 끝나면 바로 열려요.'];
  if(snapshot.state==='downloading')return ['업데이트 중','새 버전을 받고 있어요',target+'다 받으면 바로 설치로 넘어가요.'];
  if(snapshot.state==='installing')return snapshot.platform==='darwin'?['설치 준비','설치 파일을 열고 있어요','열린 창의 안내대로 업데이트해 주세요.']:['업데이트 중','업데이트를 설치하고 있어요','끝나면 저절로 열려요. 조금만 기다려 주세요.'];
  if(snapshot.state==='ready')return snapshot.code==='UPDATE_MANUAL_INSTALL'?['설치 준비','설치 파일을 열었어요','SYNK를 끈 뒤 열린 창의 앱을 Applications 폴더로 옮겨 바꿔 주세요.']:['설치 준비','Mac 업데이트 파일이 준비됐어요','설치 파일을 연 뒤 SYNK를 끄고, 앱을 Applications 폴더로 옮겨 바꿔 주세요.'];
  return ['확인이 필요해요','업데이트를 진행하지 못했어요',errorMessage(typeof snapshot.code==='string'?snapshot.code:'')];
}

export function mountStartupUpdate({
  bridge=globalThis.synkStartupUpdate,
  document=globalThis.document,
  window:windowOverride,
  createOrb=createPortalOrb,
}={}){
  const win=windowOverride||document?.defaultView||globalThis.window||globalThis;
  const ids={
    root:'startup-update',
    orbStage:'startup-orb-stage',
    surface:'startup-surface',
    title:'startup-title',
    description:'startup-description',
    stage:'startup-stage',
    version:'startup-version',
    progressWrap:'startup-progress-wrap',
    progress:'startup-progress',
    percent:'startup-percent',
    actions:'startup-actions',
    retry:'startup-retry',
    install:'startup-install',
    current:'startup-open-current',
  };
  const nodes=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,document.getElementById(id)]));
  let snapshot={state:'checking'},revision=0,pending=null,disposed=false,unsubscribe,lastRenderedState=null;
  let orb=null,mediaQuery=null,onMotionChange=null;

  function prefersReducedMotion(){
    if(document?.documentElement?.dataset?.motion==='reduced')return true;
    try{return win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;}
    catch{return false;}
  }

  if(nodes.orbStage&&typeof document?.createElement==='function'&&typeof nodes.orbStage.append==='function'){
    orb=createOrb(nodes.orbStage,{
      documentObj:document,
      windowObj:win,
      getReducedMotion:prefersReducedMotion,
    });
    try{
      mediaQuery=win?.matchMedia?.('(prefers-reduced-motion: reduce)')||null;
      if(mediaQuery&&typeof mediaQuery.addEventListener==='function'){
        onMotionChange=()=>{if(!disposed)orb?.refresh?.();};
        mediaQuery.addEventListener('change',onMotionChange);
      }
    }catch{mediaQuery=null;}
  }else if(nodes.orbStage?.dataset){
    nodes.orbStage.dataset.orbMode='static';
  }

  const capable=bridge&&['getStatus','retry','openCurrent','install','onChanged'].every(name=>typeof bridge[name]==='function');
  const allowed=action=>capable&&(action==='retry'?snapshot.state==='error'&&snapshot.canRetry===true:action==='install'?snapshot.state==='ready'&&snapshot.platform==='darwin'&&snapshot.canInstall===true:['error','ready'].includes(snapshot.state)&&snapshot.canOpenCurrent===true);

  function render(){
    const [stage,title,description]=copy(snapshot),current=cleanVersion(snapshot.currentVersion),progress=Number.isFinite(snapshot.progress)?Math.max(0,Math.min(100,snapshot.progress)):0;
    const prevState=lastRenderedState,stateChanged=prevState!==snapshot.state;
    lastRenderedState=snapshot.state;

    nodes.root.dataset.state=snapshot.state;
    nodes.root.setAttribute('aria-busy',String(['checking','downloading','installing'].includes(snapshot.state)));
    if(nodes.surface)nodes.surface.dataset.visible=String(snapshot.state!=='checking');
    setText(nodes.stage,stage);
    setText(nodes.title,title);
    setText(nodes.description,description);
    setText(nodes.version,current?'v'+current:'');

    const downloading=snapshot.state==='downloading';
    nodes.progressWrap.hidden=!downloading;
    nodes.progress.value=downloading?progress:0;
    setText(nodes.percent,downloading?Math.floor(progress)+'%':'0%');

    for(const action of Object.keys(METHODS)){
      const ok=allowed(action);
      nodes[action].hidden=!ok;
      nodes[action].disabled=!!pending||!ok;
    }
    setText(nodes.retry,pending==='retry'?'다시 확인 중…':'다시 시도');
    setText(nodes.current,pending==='current'?'열고 있어요…':'지금 버전 열기');
    setText(nodes.install,pending==='install'?'파일 여는 중…':'설치 파일 열기');
    nodes.actions.hidden=Object.keys(METHODS).every(action=>nodes[action].hidden);

    if(stateChanged){
      orb?.setScene?.({portal:0,interior:0,hover:0,pointerX:0,pointerY:0,active:true});
      if(!pending&&['error','ready'].includes(snapshot.state)){
        const firstAction=['retry','install','current'].map(key=>nodes[key]).find(btn=>btn&&!btn.hidden&&!btn.disabled);
        firstAction?.focus?.({preventScroll:true});
      }
    }

    document.documentElement.dataset.startupReady='true';
  }

  function receive(value){
    if(disposed||!value||!STATES.has(value.state))return false;
    snapshot={...value};revision++;render();return true;
  }

  async function run(action){
    if(disposed||pending||!allowed(action))return;
    pending=action;const start=revision;render();
    try{
      const result=await bridge[METHODS[action]]();if(disposed||revision!==start)return;
      if(!receive(result)){const status=await bridge.getStatus();if(!disposed&&revision===start&&!receive(status))throw Error('Invalid status');}
    }catch{if(!disposed&&revision===start){snapshot={...snapshot,state:'error',code:'UPDATE_BRIDGE_FAILED'};revision++;}}
    finally{pending=null;if(!disposed)render();}
  }

  for(const action of Object.keys(METHODS))nodes[action].addEventListener('click',()=>run(action));
  render();

  const ready=(async()=>{
    if(!capable){snapshot={state:'error',code:'UPDATE_BRIDGE_FAILED'};render();return;}
    try{unsubscribe=bridge.onChanged(receive);const start=revision,result=await bridge.getStatus();if(!disposed&&revision===start&&!receive(result))throw Error('Invalid status');}
    catch{if(!disposed&&revision===0){snapshot={state:'error',code:'UPDATE_BRIDGE_FAILED'};render();}}
  })();

  function dispose(){
    if(disposed)return;
    disposed=true;
    unsubscribe?.();
    unsubscribe=null;
    if(mediaQuery&&onMotionChange)mediaQuery.removeEventListener?.('change',onMotionChange);
    orb?.dispose?.();
    orb=null;
  }

  return {ready,dispose};
}

if(globalThis.document?.getElementById('startup-update')){
  const mounted=mountStartupUpdate();
  globalThis.window?.addEventListener?.('pagehide',()=>mounted.dispose(),{once:true});
}
