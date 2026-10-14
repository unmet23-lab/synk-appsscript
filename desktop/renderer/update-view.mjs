const STATES=new Set(['disabled','idle','checking','current','available','downloading','ready','opening','error']);
const METHODS={check:'checkForUpdate',download:'downloadUpdate',install:'installUpdate'};
const version=value=>typeof value==='string'&&/^[0-9][0-9A-Za-z.+-]{0,47}$/.test(value)?value:null;
function updateMessage(snapshot,platform){
  const latest=version(snapshot.latestVersion),label=latest?'v'+latest:'새 버전';
  if(snapshot.state==='disabled')return '이 환경에서는 플랫폼 업데이트를 사용할 수 없어요. 현재 앱은 계속 이용할 수 있어요.';
  if(snapshot.state==='checking')return '새 버전이 있는지 확인하고 있어요. 현재 앱은 계속 이용할 수 있어요.';
  if(snapshot.state==='current')return '최신 Preview 버전입니다.';
  if(snapshot.state==='available')return `${label} Preview를 다운로드할 수 있어요. 설치 전까지 현재 앱을 계속 이용할 수 있어요.`;
  if(snapshot.state==='downloading')return `${label} Preview 설치 파일을 다운로드하고 있어요. 현재 앱은 계속 이용할 수 있어요.`;
  if(snapshot.state==='ready'){
    if(snapshot.code==='UPDATE_EXIT_CANCELLED')return '앱 종료를 취소했어요. 작성 중인 내용을 저장한 뒤 다시 설치를 시작할 수 있어요.';
    if(platform==='darwin')return snapshot.code==='UPDATE_MANUAL_INSTALL'?'설치 파일을 열었어요. 작성 중인 내용을 저장하고 SYNK Platform을 종료한 뒤, 열린 파일의 앱을 Applications 폴더로 옮겨 주세요.':`${label} Preview 설치 파일이 준비됐어요. 파일을 연 뒤 작성 중인 내용을 저장하고 SYNK Platform을 종료해 주세요. 열린 파일의 앱을 Applications 폴더로 옮기면 설치됩니다.`;
    return `${label} Preview 설치 파일이 준비됐어요. 작성 중인 내용을 저장한 뒤 진행해 주세요. 앱을 종료하고 설치 파일을 엽니다.`;
  }
  if(snapshot.state==='opening')return '설치를 준비하고 있어요. 앱이 종료된 뒤 열린 설치 파일에서 계속 진행해 주세요.';
  if(snapshot.state==='error'){
    const code=typeof snapshot.code==='string'?snapshot.code:'';
    if(code==='UPDATE_STORAGE_FAILED')return '설치 파일을 저장하지 못했어요. PC 저장 공간과 파일 권한을 확인한 뒤 다시 다운로드해 주세요. 현재 앱은 계속 이용할 수 있어요.';
    if(/SAME_VERSION|BUILD_MISMATCH|VERSION_CONFLICT/.test(code))return '현재 버전과 배포된 파일의 구성이 달라요. SYNK 홈페이지의 최신 설치 파일로 다시 설치해 주세요. 현재 앱은 계속 이용할 수 있어요.';
    if(/HASH|INTEGRITY|SIGNATURE|SIZE_MISMATCH|MANIFEST|UNTRUSTED|DOWNGRADE|INVALID_(RELEASE|ARTIFACT|CACHE|RESPONSE)/.test(code))return '업데이트 파일을 확인하지 못했어요. 최신 버전을 다시 확인해 주세요. 현재 앱은 계속 이용할 수 있어요.';
    if(/OPEN|INSTALL/.test(code))return '설치 파일을 열지 못했어요. 최신 버전을 다시 확인하고 시도해 주세요. 현재 앱은 계속 이용할 수 있어요.';
    return '업데이트를 확인하거나 다운로드하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. 현재 앱은 계속 이용할 수 있어요.';
  }
  return '최신 버전을 확인할 수 있어요. 다운로드와 설치는 직접 시작합니다.';
}
export function mountPlatformUpdates({bridge,document=globalThis.document,getEnvironment=()=>null,confirmInstall=async()=>false}={}){
  const ids=['platform-update-downloads','platform-update-settings'],roots=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const available=!!bridge&&['updateStatus','checkForUpdate','downloadUpdate','installUpdate','onUpdateChanged'].every(name=>typeof bridge[name]==='function');
  if(!available){for(const root of roots)root.hidden=true;return {refresh(){},ready:Promise.resolve()};}
  let snapshot={state:'idle'},revision=0,pending=null,disposed=false;
  const rows=roots.map(root=>{
    root.innerHTML=`<div class="platform-update-heading"><div><span class="label">SYNK PLATFORM · PREVIEW</span><h2 id="${root.id}-title">플랫폼 업데이트</h2></div><span class="mono version-tag" id="${root.id}-version"></span></div><p class="platform-update-status" id="${root.id}-status" role="status"></p><div class="platform-update-progress" id="${root.id}-progress-wrap" hidden><progress id="${root.id}-progress" max="100" value="0" aria-label="플랫폼 업데이트 다운로드"></progress><span class="mono" id="${root.id}-percent"></span></div><div class="platform-update-actions"><button class="ghost-button" id="${root.id}-check" type="button">최신 버전 확인</button><button class="solid-button" id="${root.id}-download" type="button" hidden>업데이트 다운로드</button><button class="solid-button" id="${root.id}-install" type="button" hidden>앱 종료 후 설치 파일 열기</button></div>`;
    root.setAttribute('aria-labelledby',root.id+'-title');
    const row={root};for(const key of ['version','status','progress-wrap','progress','percent','check','download','install'])row[key]=document.getElementById(root.id+'-'+key);
    for(const action of Object.keys(METHODS))row[action].addEventListener('click',()=>run(action));return row;
  });
  function render(){
    const state=snapshot.state,busy=!!pending||['checking','downloading','opening'].includes(state),env=getEnvironment()||{},current=version(snapshot.currentVersion)||version(env.version),progress=Number.isFinite(snapshot.progress)?Math.max(0,Math.min(100,snapshot.progress)):0;
    for(const row of rows){
      row.root.hidden=false;row.root.dataset.updateState=state;
      row.version.textContent=current?'현재 v'+current+' · Preview':'Preview';row.status.textContent=updateMessage(snapshot,env.platform);
      row['progress-wrap'].hidden=state!=='downloading';row.progress.value=progress;row.percent.textContent=Math.round(progress)+'%';
      row.check.textContent=state==='checking'?'확인 중…':'최신 버전 확인';row.check.disabled=busy||state==='disabled';
      row.download.hidden=state!=='available';row.download.disabled=busy;row.install.hidden=state!=='ready';row.install.disabled=busy;row.install.textContent=env.platform==='darwin'?'설치 파일 열기':'앱 종료 후 설치 파일 열기';
    }
  }
  function receive(value){
    if(disposed)return;const next=value?.state?value:value?.status;
    if(next&&STATES.has(next.state)){snapshot={...next};revision++;render();return true;}
    return false;
  }
  async function run(action){
    if(disposed||pending||['disabled','checking','downloading','opening'].includes(snapshot.state))return;
    if(action==='download'&&snapshot.state!=='available'||action==='install'&&snapshot.state!=='ready')return;
    pending=action;render();let start=revision;
    try{
      if(action==='install'){
        if(!await confirmInstall()||disposed||snapshot.state!=='ready'||revision!==start)return;
      }
      start=revision;const result=await bridge[METHODS[action]]();
      if(disposed||revision!==start)return;
      if(!receive(result)&&result?.ok===false)receive({...snapshot,state:'error',code:result.code||result.error?.code});
      else if(!result?.state&&!result?.status){const status=await bridge.updateStatus();if(revision===start)receive(status);}
    }catch{if(!disposed&&revision===start)receive({...snapshot,state:'error',code:action==='install'?'INSTALL_OPEN_FAILED':'UPDATE_UNAVAILABLE'});}
    finally{pending=null;if(!disposed)render();}
  }
  const unsubscribe=bridge.onUpdateChanged(receive);render();
  const ready=(async()=>{const start=revision;try{const result=await bridge.updateStatus();if(revision===start&&!receive(result))receive({...snapshot,state:'error',code:'UPDATE_UNAVAILABLE'});}catch{if(revision===start)receive({...snapshot,state:'error',code:'UPDATE_UNAVAILABLE'});}})();
  return {ready,refresh:render,dispose(){disposed=true;unsubscribe?.();}};
}
