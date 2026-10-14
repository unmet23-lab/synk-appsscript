const STATES=new Set(['checking','downloading','installing','error','ready']);
const METHODS={retry:'retry',current:'openCurrent',install:'install'};
const cleanVersion=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value)?value:null;
function errorMessage(code){
  if(code==='UPDATE_BRIDGE_FAILED')return '업데이트 창을 불러오지 못했어요. 앱을 종료한 뒤 다시 열어 주세요.';
  if(code==='UPDATE_RECOVERED')return '업데이트를 마치지 못해 이전 버전으로 돌아왔어요. 다시 시도하거나 현재 버전을 열 수 있어요.';
  if(code==='UPDATE_RECOVERY_INVALID')return '업데이트 복구 정보를 확인하지 못했어요. 다시 시도하거나 현재 버전을 열어 주세요.';
  if(code==='UPDATE_STORAGE_FAILED')return 'PC 저장 공간과 파일 권한을 확인한 뒤 다시 시도해 주세요.';
  if(code==='UPDATE_BUILD_MISMATCH')return '현재 앱과 배포된 버전의 구성이 달라요. 현재 버전을 연 뒤 홈페이지의 최신 설치 파일을 확인해 주세요.';
  if(/INTEGRITY|INVALID|UNTRUSTED|DOWNGRADE/.test(code))return '업데이트 파일을 확인하지 못했어요. 다시 시도해 주세요.';
  if(/INSTALL|OPEN|HANDOFF/.test(code))return '업데이트 설치를 마치지 못했어요. 다시 시도하거나 현재 버전을 열 수 있어요.';
  return '인터넷 연결을 확인한 뒤 다시 시도해 주세요. 현재 버전을 열어 계속 사용할 수도 있어요.';
}
function copy(snapshot){
  const latest=cleanVersion(snapshot.latestVersion),target=latest?'v'+latest+' Preview':'새 버전';
  if(snapshot.state==='checking')return ['시작 준비','최신 버전을 확인하고 있어요','잠시만 기다려 주세요. 확인이 끝나면 이어서 시작합니다.'];
  if(snapshot.state==='downloading')return ['업데이트 중','새 버전을 다운로드하고 있어요',target+'를 준비하고 있어요. 다운로드가 끝나면 다음 단계로 넘어갑니다.'];
  if(snapshot.state==='installing')return snapshot.platform==='darwin'?['설치 준비','설치 파일을 열고 있어요','열린 파일의 안내에 따라 업데이트해 주세요.']:['업데이트 중','업데이트를 설치하고 있어요','완료되면 자동으로 열립니다. 설치가 끝날 때까지 기다려 주세요.'];
  if(snapshot.state==='ready')return snapshot.code==='UPDATE_MANUAL_INSTALL'?['설치 준비','설치 파일을 열었어요','SYNK를 종료한 뒤 열린 파일의 앱을 Applications 폴더로 옮겨 교체해 주세요.']:['설치 준비','Mac 업데이트 파일이 준비됐어요','설치 파일을 연 뒤 SYNK를 종료하고, 앱을 Applications 폴더로 옮겨 교체해 주세요.'];
  return ['확인이 필요해요','업데이트를 진행하지 못했어요',errorMessage(typeof snapshot.code==='string'?snapshot.code:'')];
}
export function mountStartupUpdate({bridge=globalThis.synkStartupUpdate,document=globalThis.document}={}){
  const ids={root:'startup-update',title:'startup-title',description:'startup-description',stage:'startup-stage',version:'startup-version',progressWrap:'startup-progress-wrap',progress:'startup-progress',percent:'startup-percent',steps:'startup-steps',actions:'startup-actions',retry:'startup-retry',install:'startup-install',current:'startup-open-current'};
  const nodes=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,document.getElementById(id)]));
  const steps=['checking','downloading','installing'].map(state=>document.getElementById('startup-step-'+state));
  let snapshot={state:'checking'},revision=0,pending=null,disposed=false,unsubscribe;
  const capable=bridge&&['getStatus','retry','openCurrent','install','onChanged'].every(name=>typeof bridge[name]==='function');
  const allowed=action=>capable&&(action==='retry'?snapshot.state==='error'&&snapshot.canRetry===true:action==='install'?snapshot.state==='ready'&&snapshot.platform==='darwin'&&snapshot.canInstall===true:['error','ready'].includes(snapshot.state)&&snapshot.canOpenCurrent===true);
  function render(){
    const [stage,title,description]=copy(snapshot),current=cleanVersion(snapshot.currentVersion),progress=Number.isFinite(snapshot.progress)?Math.max(0,Math.min(100,snapshot.progress)):0;
    nodes.root.dataset.state=snapshot.state;nodes.root.setAttribute('aria-busy',String(['checking','downloading','installing'].includes(snapshot.state)));
    nodes.stage.textContent=stage;nodes.title.textContent=title;nodes.description.textContent=description;nodes.version.textContent=current?'v'+current+' · Preview':'Preview';
    nodes.progressWrap.hidden=snapshot.state!=='downloading';nodes.progress.value=progress;nodes.percent.textContent=Math.floor(progress)+'%';
    nodes.steps.hidden=['error','ready'].includes(snapshot.state);const active=['checking','downloading','installing'].indexOf(snapshot.state);
    steps.forEach((step,index)=>{if(index===active)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');step.dataset.complete=String(index<active);});
    for(const action of Object.keys(METHODS)){nodes[action].hidden=!allowed(action);nodes[action].disabled=!!pending||!allowed(action);}
    nodes.retry.textContent=pending==='retry'?'다시 확인 중…':'다시 시도';nodes.current.textContent=pending==='current'?'열고 있어요…':'현재 버전 열기';nodes.install.textContent=pending==='install'?'파일 여는 중…':'설치 파일 열기';
    nodes.actions.hidden=Object.keys(METHODS).every(action=>nodes[action].hidden);
    document.documentElement.dataset.startupReady='true';
  }
  function receive(value){
    if(disposed||!value||!STATES.has(value.state))return false;
    snapshot={...value};revision++;render();return true;
  }
  async function run(action){
    if(disposed||pending||!allowed(action))return;
    pending=action;const start=revision;render();
    try{const result=await bridge[METHODS[action]]();if(disposed||revision!==start)return;
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
  return {ready,dispose(){disposed=true;unsubscribe?.();}};
}
if(globalThis.document?.getElementById('startup-update'))mountStartupUpdate();
