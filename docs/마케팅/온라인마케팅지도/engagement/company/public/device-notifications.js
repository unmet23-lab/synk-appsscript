(function(){
  'use strict';
  const API='/api/device-notifications',WORKER='/notification-sw.js';
  let identity={userId:null,csrf:'',generation:0},epoch=0,dialog=null,returnFocus=null,view=null,busy=false;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const snapshot=()=>({...identity,epoch});
  const current=stamp=>stamp.epoch===epoch&&stamp.userId===identity.userId&&stamp.generation===identity.generation&&stamp.csrf===identity.csrf;
  const changed=()=>Object.assign(new Error('로그인 상태가 바뀌었어요. 현재 계정에서 기기 알림을 다시 열어 주세요.'),{code:'SESSION_CHANGED'});
  function requireCurrent(stamp){if(!current(stamp))throw changed();}
  async function json(path,stamp,{method='GET',body}={}){
    requireCurrent(stamp);
    const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(method==='GET'?{}:{'X-CSRF-Token':stamp.csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json().catch(()=>({}));requireCurrent(stamp);if(!response.ok)throw Object.assign(new Error(data.error||`요청을 처리하지 못했어요. (${response.status})`),{status:response.status});return data;
  }
  function syncIdentity(next={}){
    const value={userId:next.userId||null,csrf:next.csrf||'',generation:next.generation??0};
    if(value.userId!==identity.userId||value.csrf!==identity.csrf||value.generation!==identity.generation){identity=value;epoch++;view=null;busy=false;if(dialog?.open)dialog.close();if(value.userId&&value.csrf)return sendMissingKeys();}
  }
  // A device switched on before the server kept subscription keys gets empty-body call wake-ups, which a notice already
  // on screen swallows silently. Sending the same subscription once more adds its keys: no permission prompt, no new
  // subscription, and nothing at all unless this browser is already subscribed for the signed-in account.
  async function sendMissingKeys(){
    const stamp=snapshot();
    try{
      const local=await localSubscription();if(!local.subscription)return;
      const server=await json(API,stamp),row=server.subscriptions?.find(item=>item.endpointHash===local.hash);
      if(row?.enabled&&row.currentSession&&row.callAlerts===false)await json(API,stamp,{method:'POST',body:{subscription:local.subscription.toJSON(),label:row.label}});
    }catch{}
  }
  function support(){
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const installed=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
    return {secure:window.isSecureContext===true,ios,installed,available:'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window,permission:'Notification'in window?Notification.permission:'unsupported'};
  }
  async function hashEndpoint(endpoint){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
  async function localSubscription(){
    if(!('serviceWorker'in navigator)||!window.isSecureContext)return {registration:null,subscription:null,hash:null};
    const registration=await navigator.serviceWorker.getRegistration('/');
    if(registration?.active?.scriptURL&&new URL(registration.active.scriptURL).pathname!==WORKER)return {registration:null,subscription:null,hash:null,foreignWorker:true};
    const subscription=await registration?.pushManager?.getSubscription();return {registration,subscription:subscription||null,hash:subscription?await hashEndpoint(subscription.endpoint):null};
  }
  function publicKey(value){
    if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('서버의 기기 알림 설정을 확인해야 해요.');
    const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),char=>char.charCodeAt(0));
    if(bytes.length!==65||bytes[0]!==4)throw new Error('서버의 기기 알림 설정을 확인해야 해요.');return bytes;
  }
  function deviceLabel(){const ua=navigator.userAgent;return /iPhone/.test(ua)?'내 iPhone':/iPad/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'내 iPad':/Android/.test(ua)?'내 Android':/Windows/.test(ua)?'내 Windows PC':/Mac/.test(ua)?'내 Mac':'내 브라우저';}
  function ensureDialog(){
    if(dialog?.isConnected)return;
    dialog=document.createElement('dialog');dialog.id='device-notifications-dialog';dialog.className='device-notifications-dialog';dialog.setAttribute('aria-labelledby','device-notifications-title');document.body.append(dialog);
    dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  }
  function frame(body){
    dialog.innerHTML=`<header class="device-notifications-head"><div><h2 id="device-notifications-title">기기 알림</h2><p>이 브라우저에서만 따로 켜고 끌 수 있어요.</p></div><button type="button" data-device-close aria-label="기기 알림 닫기">×</button></header><div class="device-notifications-body">${body}</div>`;
    dialog.querySelector('[data-device-close]').onclick=()=>dialog.close();
  }
  function render(){
    if(!dialog?.open||!view)return;const capabilities=support(),rows=Array.isArray(view.server?.subscriptions)?view.server.subscriptions:[],local=rows.find(row=>row.endpointHash===view.local.hash);
    const active=Boolean(local?.enabled&&local.currentSession&&view.local.subscription&&capabilities.permission==='granted'&&view.server?.configured);
    let status=active?'이 기기에서 켜져 있어요':'이 기기에서는 꺼져 있어요',note='켜면 브라우저를 보고 있지 않을 때도 새 업무 알림을 받을 수 있어요.',canEnable=true;
    if(view.unavailable){status='서버 준비가 필요해요';note='현재 서버에 기기 알림이 아직 준비되지 않았어요. 메신저 안의 알림은 계속 쓸 수 있어요.';canEnable=false;}
    else if(!capabilities.secure){status='안전한 회사 주소에서 열어 주세요';note='기기 알림은 HTTPS 회사 주소에서 사용할 수 있어요.';canEnable=false;}
    else if(capabilities.ios&&!capabilities.installed){status='iPhone·iPad 홈 화면에서 열어 주세요';note='Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택한 뒤, 추가한 SYNK 아이콘으로 열어 주세요. iOS·iPadOS 16.4 이상에서 사용할 수 있어요.';canEnable=false;}
    else if(!capabilities.available){status='이 브라우저에서는 지원하지 않아요';note='기기 알림을 지원하는 최신 브라우저에서 열어 주세요. 메신저 안의 알림은 계속 쓸 수 있어요.';canEnable=false;}
    else if(capabilities.permission==='denied'){status='브라우저에서 알림이 차단됐어요';note='주소창의 사이트 설정 또는 기기 설정에서 알림을 허용한 뒤 상태를 다시 확인해 주세요. 여기에서 권한 창을 반복해서 띄우지 않아요.';canEnable=false;}
    else if(view.local.foreignWorker){status='기존 알림 연결을 확인해야 해요';note='다른 서비스가 이미 이 주소에 연결되어 있어요. 관리자에게 확인해 주세요.';canEnable=false;}
    else if(!view.server?.configured||!view.server.publicKey){status='서버 준비가 필요해요';note='회사 서버의 기기 알림 설정이 완료되면 켤 수 있어요. 메신저 안의 알림은 계속 쓸 수 있어요.';canEnable=false;}
    else if(view.local.subscription&&!active){status='현재 로그인에 다시 연결해 주세요';note='브라우저의 알림 권한과 회사 계정 연결은 별개예요. 현재 계정으로 받으려면 아래 버튼을 눌러 주세요.';}
    frame(`<section class="device-notification-status"><strong>${esc(status)}</strong><p>${esc(note)}</p></section><p class="device-notifications-privacy">잠금 화면에는 ‘확인할 새 업무가 있어요’만 표시해요. 고객 이름이나 대화 내용은 알림에 넣지 않아요. 알림을 눌러도 자동으로 읽음 처리하지 않아요.</p>${!active&&canEnable?`<label class="device-label-field"><span>이 기기 이름</span><input id="device-notification-label" maxlength="80" value="${esc(view.label||deviceLabel())}" autocomplete="off"></label><button type="button" class="device-notification-primary" id="enable-device-notifications" ${busy?'disabled':''}>이 기기에서 켜기</button>`:''}${active?`<button type="button" class="device-notification-primary" data-remove-device="${esc(local.id)}" ${busy?'disabled':''}>이 기기 알림 끄기</button>`:''}<button type="button" class="device-notification-link" id="refresh-device-notifications" ${busy?'disabled':''}>상태 다시 확인</button>${view.error?`<p class="device-notification-error" role="alert">${esc(view.error)}</p>`:''}<section class="device-notification-devices"><h3>내 계정에 등록한 기기</h3>${rows.length?rows.map(row=>`<article><div><strong>${esc(row.label||'등록한 기기')}${row.endpointHash===view.local.hash?' · 이 기기':''}</strong><small>${row.enabled?(row.currentSession?'현재 로그인에 연결됨':'다른 로그인에서 등록됨'):'연결 해제됨'}</small></div><button type="button" class="device-notification-link" data-remove-device="${esc(row.id)}" ${busy?'disabled':''}>연결 해제</button></article>`).join(''):'<p>등록한 기기가 없어요.</p>'}</section>`);
    dialog.querySelector('#enable-device-notifications')?.addEventListener('click',enable);
    dialog.querySelector('#refresh-device-notifications').onclick=()=>refresh();
    dialog.querySelectorAll('[data-remove-device]').forEach(button=>button.onclick=()=>removeDevice(button.dataset.removeDevice));
  }
  async function refresh(){
    const stamp=snapshot();if(!stamp.userId)return;busy=true;if(view)render();
    try{
      const me=await json('/api/me',stamp);if(me.user?.id!==stamp.userId)throw changed();
      const [server,local]=await Promise.all([json(API,stamp).catch(error=>{if(error.status===404)return null;throw error;}),localSubscription()]);requireCurrent(stamp);
      view={server,local,unavailable:server===null,error:'',label:view?.label||deviceLabel()};
    }catch(error){if(current(stamp))view={...(view||{server:null,local:{},unavailable:false}),error:error.message};}
    finally{if(current(stamp)){busy=false;render();}}
  }
  async function open(){
    ensureDialog();returnFocus=document.activeElement;if(!dialog.open)dialog.showModal();
    if(!identity.userId){frame('<p class="device-notification-error" role="alert">회사 계정으로 로그인한 뒤 다시 열어 주세요.</p>');return;}
    frame('<p class="device-notifications-loading" role="status">이 기기의 알림 연결을 확인하고 있어요.</p>');await refresh();
  }
  async function activeRegistration(registration){
    if(registration.active)return registration;
    const worker=registration.installing||registration.waiting;if(!worker)throw new Error('기기 알림을 준비하지 못했어요. 다시 시도해 주세요.');
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(new Error('알림 준비가 지연됐어요. 다시 시도해 주세요.'));},15000);function check(){if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',check);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',check);reject(new Error('기기 알림을 준비하지 못했어요. 다시 시도해 주세요.'));}}worker.addEventListener('statechange',check);check();});return registration;
  }
  async function enable(){
    if(busy||!view?.server?.configured)return;const capabilities=support();if(!capabilities.secure||!capabilities.available||(capabilities.ios&&!capabilities.installed)||capabilities.permission==='denied')return;
    const stamp=snapshot();let created=null;view.label=dialog.querySelector('#device-notification-label')?.value.trim()||deviceLabel();view.error='';
    // Permission is requested directly in this top-level button's user gesture.
    let key,permission;try{key=publicKey(view.server.publicKey);permission=capabilities.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();}catch(error){view.error=error.message;render();return;}
    busy=true;render();
    try{
      const granted=await permission;requireCurrent(stamp);if(granted!=='granted'){view.error=granted==='denied'?'브라우저 설정에서 알림을 허용하면 다시 켤 수 있어요.':'알림 허용을 완료하지 않았어요. 원할 때 다시 켤 수 있어요.';return;}
      const me=await json('/api/me',stamp);if(me.user?.id!==stamp.userId)throw changed();
      let local=await localSubscription();requireCurrent(stamp);if(local.foreignWorker)throw new Error('기존 알림 연결을 먼저 확인해야 해요.');
      const registration=await activeRegistration(local.registration||await navigator.serviceWorker.register(WORKER,{scope:'/',updateViaCache:'none'}));requireCurrent(stamp);
      let subscription=await registration.pushManager.getSubscription();requireCurrent(stamp);
      if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=subscription;requireCurrent(stamp);}
      await json(API,stamp,{method:'POST',body:{subscription:subscription.toJSON(),label:view.label}});requireCurrent(stamp);created=null;
      await refresh();
    }catch(error){
      let cleaned=true;if(created&&current(stamp))try{cleaned=await created.unsubscribe();}catch{cleaned=false;}
      if(current(stamp))view.error=error.message+(!cleaned?' 브라우저 구독 정리가 남았어요. 사이트 설정에서 알림 권한을 해제해 주세요.':'');
    }finally{if(current(stamp)){busy=false;render();}}
  }
  async function removeDevice(id){
    if(busy)return;const stamp=snapshot(),row=view?.server?.subscriptions?.find(item=>item.id===id);if(!row)return;busy=true;view.error='';render();
    try{
      await json(API+'/'+encodeURIComponent(id),stamp,{method:'DELETE'});requireCurrent(stamp);
      if(row.endpointHash===view.local.hash&&view.local.subscription){const removed=await view.local.subscription.unsubscribe();requireCurrent(stamp);if(!removed)throw new Error('서버 연결은 해제됐지만 브라우저 구독 정리가 남았어요. 사이트 설정에서 알림을 해제해 주세요.');}
      await refresh();
    }catch(error){if(current(stamp))view.error=error.message+' 연결 상태를 다시 확인해 주세요.';}
    finally{if(current(stamp)){busy=false;render();}}
  }
  async function beforeLogout(){
    const stamp=snapshot();if(!stamp.userId)return {ok:true};
    try{const local=await localSubscription();requireCurrent(stamp);if(!local.subscription)return {ok:true};const server=await json(API,stamp);const row=server.subscriptions?.find(item=>item.endpointHash===local.hash);if(row)await json(API+'/'+encodeURIComponent(row.id),stamp,{method:'DELETE'});requireCurrent(stamp);const removed=await local.subscription.unsubscribe();return removed?{ok:true}:{ok:false,warning:'브라우저의 기기 알림 구독 정리가 남았어요. 사이트 설정에서 알림을 해제해 주세요.'};}
    catch(error){return {ok:false,warning:error.code==='SESSION_CHANGED'?'로그인 상태가 바뀌어 이전 기기의 알림 정리를 중단했어요.':'기기 알림 연결을 완전히 정리하지 못했어요. 브라우저 사이트 설정에서 알림을 해제해 주세요.'};}
  }
  async function isTrustedWorkerMessage(event){
    if(event.origin!==location.origin||event.data?.type!=='synk:open-notifications'||!event.source||!('serviceWorker'in navigator))return false;
    const registration=await navigator.serviceWorker.getRegistration('/');return Boolean(registration?.active&&new URL(registration.active.scriptURL).pathname===WORKER&&(event.source===registration.active||event.source===navigator.serviceWorker.controller));
  }
  window.SynkDeviceNotifications={open,syncIdentity,beforeLogout,isTrustedWorkerMessage};
})();
