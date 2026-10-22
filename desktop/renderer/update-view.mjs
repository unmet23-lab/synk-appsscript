const STATES=new Set(['disabled','idle','checking','current','available','downloading','ready','opening','error']);
const METHODS={check:'checkForUpdate',download:'downloadUpdate',install:'installUpdate'};
const version=value=>typeof value==='string'&&/^[0-9][0-9A-Za-z.+-]{0,47}$/.test(value)?value:null;
const automaticUpdate=(snapshot,platform)=>snapshot.automatic===true&&platform==='win32'&&snapshot.code!=='UPDATE_EXIT_CANCELLED';
function updateMessage(snapshot,platform){
  // 버전 번호는 괄호로 붙여 「v0.4.37을/를」처럼 받침에 따라 갈리는 조사를 피한다.
  const latest=version(snapshot.latestVersion),ver=latest?' (v'+latest+')':'',automatic=automaticUpdate(snapshot,platform);
  if(snapshot.state==='disabled')return '여기서는 업데이트를 받을 수 없어요. 지금 앱은 그대로 쓸 수 있어요.';
  if(snapshot.state==='checking')return '새 버전이 있는지 보는 중이에요.';
  if(snapshot.state==='current')return '최신 버전이에요. 쓰는 동안에도 새 버전이 있는지 저절로 확인해요.';
  if(snapshot.state==='available')return `새 버전이 나왔어요${ver}. 받는 동안에도 지금 앱을 쓸 수 있어요.`;
  if(snapshot.state==='downloading')return automatic?`새 버전을 받고 있어요${ver}. 다 받으면 업데이트한 뒤 다시 열어요. 받는 동안에도 지금 앱을 쓸 수 있어요.`:`새 버전 설치 파일을 받고 있어요${ver}. 받는 동안에도 지금 앱을 쓸 수 있어요.`;
  if(snapshot.state==='ready'){
    if(snapshot.code==='UPDATE_EXIT_CANCELLED')return '앱 끄기를 취소했어요. 쓰던 내용을 저장한 뒤 다시 설치해 주세요.';
    if(automatic)return `새 버전이 준비됐어요${ver}. 쓰던 내용이 있는지 확인한 뒤 업데이트하고 다시 열어요.`;
    if(platform==='darwin')return snapshot.code==='UPDATE_MANUAL_INSTALL'?'설치 파일을 열었어요. 쓰던 내용을 저장하고 SYNK Platform을 끈 뒤, 열린 창의 앱을 Applications 폴더로 옮겨 주세요.':`새 버전 설치 파일이 준비됐어요${ver}. 파일을 연 뒤 쓰던 내용을 저장하고 SYNK Platform을 꺼 주세요. 열린 창의 앱을 Applications 폴더로 옮기면 설치돼요.`;
    return `새 버전 설치 파일이 준비됐어요${ver}. 쓰던 내용을 저장한 뒤 진행해 주세요. 앱을 끄고 설치 파일을 열어요.`;
  }
  if(snapshot.state==='opening')return automatic?'업데이트를 준비하고 있어요. 앱이 꺼지면 설치하고, 끝나면 다시 열려요.':'설치를 준비하고 있어요. 앱이 꺼지면 열린 설치 파일에서 이어서 진행해 주세요.';
  if(snapshot.state==='error'){
    const code=typeof snapshot.code==='string'?snapshot.code:'';
    if(code==='UPDATE_STORAGE_FAILED')return '설치 파일을 저장하지 못했어요. PC 저장 공간을 비운 뒤 다시 받아 주세요. 지금 앱은 그대로 쓸 수 있어요.';
    if(/SAME_VERSION|BUILD_MISMATCH|VERSION_CONFLICT/.test(code))return '지금 버전과 올라온 설치 파일이 맞지 않아요. synk.im에서 최신 설치 파일을 받아 다시 설치해 주세요. 지금 앱은 그대로 쓸 수 있어요.';
    if(/HASH|INTEGRITY|SIGNATURE|SIZE_MISMATCH|MANIFEST|UNTRUSTED|DOWNGRADE|INVALID_(RELEASE|ARTIFACT|CACHE|RESPONSE)/.test(code))return '받은 업데이트 파일이 온전하지 않아요. 「최신 버전 확인」을 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있어요.';
    if(/OPEN|INSTALL/.test(code))return '설치 파일을 열지 못했어요. 「최신 버전 확인」을 누른 뒤 「'+(platform==='darwin'?'설치 파일 열기':'앱 끄고 설치 파일 열기')+'」를 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있어요.';
    return '업데이트를 받지 못했어요. 인터넷 연결을 확인한 뒤 「최신 버전 확인」을 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있어요.';
  }
  return platform==='darwin'?'켤 때와 쓰는 동안 새 버전을 저절로 확인하고 받아요. 받은 설치 파일을 열어 업데이트해 주세요.':'켤 때와 쓰는 동안 새 버전을 저절로 확인해요. 새 버전이 있으면 받아서 업데이트하고 다시 열어요.';
}
export function mountPlatformUpdates({bridge,document=globalThis.document,getEnvironment=()=>null,confirmInstall=async()=>false}={}){
  const ids=['platform-update-downloads','platform-update-settings'],roots=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const available=!!bridge&&['updateStatus','checkForUpdate','downloadUpdate','installUpdate','onUpdateChanged'].every(name=>typeof bridge[name]==='function');
  if(!available){for(const root of roots)root.hidden=true;return {refresh(){},ready:Promise.resolve()};}
  let snapshot={state:'idle'},revision=0,pending=null,disposed=false;
  const rows=roots.map(root=>{
    root.innerHTML=`<div class="platform-update-heading"><div><span class="label">SYNK PLATFORM · UPDATE</span><h2 id="${root.id}-title">플랫폼 업데이트</h2></div><span class="mono version-tag" id="${root.id}-version"></span></div><p class="platform-update-status" id="${root.id}-status" role="status"></p><div class="platform-update-progress" id="${root.id}-progress-wrap" hidden><progress id="${root.id}-progress" max="100" value="0" aria-label="플랫폼 업데이트 받는 중"></progress><span class="mono" id="${root.id}-percent"></span></div><div class="platform-update-actions"><button class="ghost-button" id="${root.id}-check" type="button">최신 버전 확인</button><button class="solid-button" id="${root.id}-download" type="button" hidden>업데이트 받기</button><button class="solid-button" id="${root.id}-install" type="button" hidden>앱 끄고 설치 파일 열기</button></div>`;
    root.setAttribute('aria-labelledby',root.id+'-title');
    const row={root};for(const key of ['version','status','progress-wrap','progress','percent','check','download','install'])row[key]=document.getElementById(root.id+'-'+key);
    for(const action of Object.keys(METHODS))row[action].addEventListener('click',()=>run(action));return row;
  });
  function render(){
    const state=snapshot.state,env=getEnvironment()||{},automatic=automaticUpdate(snapshot,env.platform),busy=!!pending||['checking','downloading','opening'].includes(state)||automatic&&state==='ready',current=version(snapshot.currentVersion)||version(env.version),progress=Number.isFinite(snapshot.progress)?Math.max(0,Math.min(100,snapshot.progress)):0;
    for(const row of rows){
      row.root.hidden=false;row.root.dataset.updateState=state;
      row.version.textContent=current?'지금 v'+current+(env.mode==='release'?'':' · 시험판'):(env.mode==='release'?'':'시험판');row.status.textContent=updateMessage(snapshot,env.platform);
      row['progress-wrap'].hidden=state!=='downloading';row.progress.value=progress;row.percent.textContent=Math.round(progress)+'%';
      row.check.textContent=state==='checking'?'확인 중…':'최신 버전 확인';row.check.disabled=busy||state==='disabled';
      row.download.hidden=state!=='available';row.download.disabled=busy;row.install.hidden=state!=='ready'||automatic;row.install.disabled=busy;row.install.textContent=env.platform==='darwin'?'설치 파일 열기':'앱 끄고 설치 파일 열기';
    }
  }
  function receive(value){
    if(disposed)return;const next=value?.state?value:value?.status;
    if(next&&STATES.has(next.state)){snapshot={...next};revision++;render();return true;}
    return false;
  }
  async function run(action){
    if(disposed||pending||['disabled','checking','downloading','opening'].includes(snapshot.state)||snapshot.state==='ready'&&automaticUpdate(snapshot,getEnvironment()?.platform))return;
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
