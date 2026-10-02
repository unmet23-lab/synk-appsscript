const $=id=>document.getElementById(id);
let token='',snapshot=null,requestPending=false,refreshing=false;
const galleryVersions=new Map();
const labels={unity:{'needs-install':'Unity 설치 창 열기','ready-project':'Unity 프로젝트 열기','ready-game':'Unity 게임 실행'},unreal:{'needs-install':'Unreal 설치 준비 열기','ready-project':'Unreal 프로젝트 열기','ready-game':'Unreal 게임 실행'}};
const phaseText={'needs-install':'엔진 설치 필요','ready-project':'프로젝트 열기 가능','ready-game':'게임 파일 준비됨'};
function selectRoute(){
  const engine=location.pathname.slice(1);
  for(const name of ['unity','unreal']){
    $(`${name}-card`).classList.toggle('selected',engine===name);
    const link=document.querySelector(`[data-engine-link="${name}"]`);
    if(engine===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
  document.title=(engine==='unity'?'Unity 남산 열기':engine==='unreal'?'Unreal 남산 열기':'남산 열기')+' · SYNK';
}
function paint(){
  if(!snapshot)return;
  const anyBusy=snapshot.unity.busy||snapshot.unreal.busy||requestPending;
  for(const name of ['unity','unreal']){
    const value=snapshot[name],phase=value.phase;
    $(`${name}-badge`).textContent=phaseText[phase]||'준비 상태 확인 필요';
    $(`${name}-badge`).classList.toggle('ready',phase==='ready-game');
    $(`${name}-status`).textContent=value.message;
    const button=$(`${name}-launch`);
    button.textContent=value.busy?'Windows 창을 확인해 주세요…':labels[name][phase]||'상태 다시 확인';
    button.disabled=anyBusy||value.canLaunch===false||!token;
    const index=['needs-install','ready-project','ready-game'].indexOf(phase);
    [...$(`${name}-steps`).children].forEach((item,i)=>{item.classList.toggle('active',i===index);item.classList.toggle('done',i<index);});
  }
  const when=new Date(snapshot.checkedAt);
  $('checked').textContent=Number.isNaN(when.getTime())?'현재 설치 상태 확인됨':new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(when)+' 확인';
  const built=['unity','unreal'].filter(name=>snapshot[name].gameBuilt);
  $('readiness').textContent=built.length===2
    ?'두 게임의 실행 파일을 찾았어요. 실제 동작과 휴대폰 성능은 별도 확인이 필요해요.'
    :built.length===1
      ?`${built[0]==='unity'?'Unity':'Unreal'} 실행 파일이 준비됐어요. 다른 엔진은 아직 설치·실행 준비가 필요해요. 현재 그래픽은 시험 제작 단계예요.`
      :'두 버전은 아직 실행 가능한 완성 게임이 아니에요. 이 화면에서 설치와 실행 준비를 이어갈 수 있어요.';
}
async function refreshRenders(){
  try{
    const response=await fetch('/api/renders',{cache:'no-store'});
    if(!response.ok)return;
    const galleries=await response.json();
    for(const engine of ['unity','unreal']){
      const gallery=galleries[engine];
      if(!gallery)continue;
      const version=JSON.stringify([gallery.available,gallery.updatedAt,gallery.frames?.map(frame=>frame.url)]);
      if(galleryVersions.get(engine)===version)continue;
      galleryVersions.set(engine,version);
      const frames=$(`${engine}-render-frames`),note=$(`${engine}-render-note`);
      frames.replaceChildren();
      if(!gallery.available||gallery.frames?.length!==3){note.textContent='실제 렌더 준비 중';continue;}
      const captured=new Date(gallery.updatedAt);
      const time=Number.isNaN(captured.getTime())?'':new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(captured);
      note.textContent=`실제 ${engine==='unity'?'URP':'Unreal'} 렌더${time?' · '+time:''}${gallery.artOnly?' · 풍경 장면':''}`;
      for(const frame of gallery.frames){
        // The same fixed URL shape is enforced by the server. Do not accept
        // externally supplied image links in the local launch page.
        if(!new RegExp(`^/renders/${engine}/(01-garden|02-mongle|03-terrace)\\.png\\?v=\\d+$`).test(frame.url))continue;
        const figure=document.createElement('figure'),link=document.createElement('a');
        const image=document.createElement('img'),caption=document.createElement('figcaption');
        link.href=frame.url;link.target='_blank';link.rel='noopener noreferrer';
        link.setAttribute('aria-label',`${engine==='unity'?'Unity URP':'Unreal 5'} ${frame.label} 큰 이미지 열기`);
        image.src=frame.url;image.alt=`${engine==='unity'?'Unity URP':'Unreal 5'} 실제 렌더: ${frame.label}`;
        image.width=1600;image.height=1000;image.loading='lazy';image.decoding='async';
        caption.textContent=frame.label+' ↗';link.append(image);figure.append(link,caption);frames.append(figure);
      }
    }
  }catch{/* Native launch controls remain usable while the gallery is unavailable. */}
}
async function refresh(){
  if(refreshing)return;
  refreshing=true;
  try{
    const response=await fetch('/api/status',{cache:'no-store'});
    if(!response.ok)throw new Error('상태 확인에 실패했어요.');
    const data=await response.json();
    if(!data.unity||!data.unreal)throw new Error('실행 준비 상태를 읽지 못했어요.');
    token=response.headers.get('x-namsan-token')||'';
    snapshot=data;$('connection').hidden=true;paint();await refreshRenders();
  }catch(error){
    token='';$('connection').hidden=false;
    $('connection').textContent='실행 도우미에 연결하지 못했어요. 이 컴퓨터에서 실행 화면을 다시 켠 뒤 새로고침해 주세요.';
    for(const name of ['unity','unreal'])$(`${name}-launch`).disabled=true;
  }finally{refreshing=false;}
}
async function launch(engine){
  if(!token||requestPending)return;
  requestPending=true;
  const result=$(`${engine}-result`);
  result.classList.remove('error');result.textContent='창을 열고 있어요. Windows 확인창이 나타나면 직접 응답해 주세요.';
  paint();
  try{
    const response=await fetch('/api/launch',{method:'POST',headers:{'Content-Type':'application/json','x-namsan-token':token},body:JSON.stringify({engine})});
    const body=await response.json();
    if(!response.ok||!body.ok)throw new Error(body.message||'창을 열지 못했어요.');
    result.textContent=body.message;
  }catch(error){result.classList.add('error');result.textContent=error.message||'실행 도우미에 연결하지 못했어요.';}
  finally{requestPending=false;await refresh();paint();}
}
document.querySelectorAll('[data-engine]').forEach(button=>button.addEventListener('click',()=>launch(button.dataset.engine)));
document.querySelectorAll('[data-engine-link]').forEach(link=>link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();history.pushState(null,'',link.getAttribute('href'));selectRoute();
}));
$('refresh').addEventListener('click',refresh);window.addEventListener('popstate',selectRoute);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden)refresh();},5000);
selectRoute();refresh();
