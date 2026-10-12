export class DeviceTimeout extends Error {
  constructor(message){super(message);this.name='DeviceTimeout';}
}

// Browser permission prompts can remain pending in embedded browsers. A pending
// browser promise must not lock the rest of the customer's project indefinitely.
export function withDeviceDeadline(promise,{milliseconds=15000,message='기기 알림 설정이 지연되고 있어요. 잠시 뒤 다시 시도해 주세요.',onTimeout}={}){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{onTimeout?.();reject(new DeviceTimeout(message));},milliseconds);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}

export function deviceAvailability({secure,serviceWorker,pushManager,notification,permission,ios,android,embedded,standalone}){
  if(ios&&!standalone)return 'iPhone·iPad는 iOS 16.4 이상에서 홈 화면에 추가한 PULSE를 열어 기기 알림을 켤 수 있어요. ‘앱 설치 · 알림’에서 순서를 확인해 주세요.';
  if(embedded)return '메신저 안 브라우저에서는 기기 알림을 켜기 어려울 수 있어요. 받은 초대 링크를 Chrome 또는 삼성 인터넷에서 열어 주세요. ‘앱 설치 · 알림’에서 방법을 확인할 수 있어요.';
  if(!secure||!serviceWorker||!pushManager||!notification){
    if(ios)return '기기 알림을 지원하지 않는 환경이에요. iOS·iPadOS를 16.4 이상으로 업데이트하고 홈 화면의 PULSE 앱에서 다시 확인해 주세요. 앱 안 알림은 계속 받을 수 있습니다.';
    if(android)return '이 브라우저는 기기 알림을 지원하지 않아요. 최신 Chrome 또는 삼성 인터넷에서 받은 초대 링크를 열어 주세요. 앱 안 알림은 계속 받을 수 있습니다.';
    return '이 브라우저는 기기 알림을 지원하지 않아요. PC에서는 Chrome 또는 Edge에서 PULSE를 열어 주세요. 앱 안 알림은 계속 받을 수 있습니다.';
  }
  if(permission==='denied'){
    if(ios)return '기기 설정 → 알림 → PULSE에서 알림을 허용한 뒤 앱으로 돌아와 주세요. 앱 안 알림은 계속 받을 수 있습니다.';
    if(android)return '브라우저 사이트 설정에서 알림을 허용해 주세요. 휴대폰 설정 → 앱 → PULSE 또는 사용 중인 브라우저 → 알림도 확인한 뒤 알림함을 다시 열어 주세요.';
    return '브라우저 사이트 설정에서 알림을 허용한 뒤 알림함을 다시 열어 주세요. 앱 안 알림은 계속 받을 수 있습니다.';
  }
  return '';
}

export function deviceConnectionNote({mode,enabled,configured,connection}){
  if(!configured)return '서버의 기기 알림 준비가 필요해요. 앱 안 알림은 계속 받을 수 있습니다.';
  if(mode==='staff')return enabled?'앱을 닫아도 새 알림을 받을 수 있어요. 로그아웃하거나 로그인이 만료되면 중단됩니다.':'원할 때 이 기기에서 켜 주세요. 잠금 화면에 고객 이름이나 의견 내용은 표시하지 않습니다.';
  const days=Math.max(1,Math.min(365,Number(connection?.renewalDays)||30));
  if(!enabled)return `알림을 켜면 이 기기에 고객 연결을 기억합니다. 마지막 이용 후 ${days}일 동안 다시 연결하거나 알림을 켤 필요가 없어요. 공용 기기에서는 켜지 마세요.`;
  if(!connection?.remembered)return '기존 기기 알림 연결을 새 방식으로 전환하고 있어요. 잠시 뒤 알림함을 다시 열어 주세요.';
  return `앱을 닫아도 알림을 받습니다. 이 기기 연결은 마지막 이용 후 ${days}일 동안 유지되며, 다시 이용하면 자동 연장됩니다. ‘연결 닫기’ 또는 ‘기기 알림 끄기’를 누르면 기억한 연결도 해제됩니다.`;
}

export function canMigrateDevice({mode,server,local,permission}){
  const existing=server?.subscriptions?.find(item=>local?.hash&&item.endpointHash===local.hash);
  return mode==='customer'&&!!server?.configured&&!server.deviceConnection?.remembered&&!!existing?.enabled&&!!existing.currentSession&&!!local?.subscription&&permission==='granted';
}

export function foregroundProjectOptions(path,settings={},visible=false){
  if(!['/pulse/api/project','/pulse/api/studio'].includes(path)||settings.body!==undefined||settings.file||(settings.method&&settings.method!=='GET'))return settings;
  const headers={...settings.headers};delete headers['X-Pulse-Active'];
  if(visible)headers['X-Pulse-Active']='1';
  return {...settings,headers};
}

// A lost response does not prove that registration failed. Keep the browser
// subscription so the next state read can reconcile an already committed opt-in.
export function rejectedDeviceRegistration(error){return Number(error?.status)>=400&&Number(error.status)<500&&Number(error.status)!==408;}

export function deviceKey(raw){
  raw=String(raw||'');
  if(!/^[A-Za-z0-9_-]+$/.test(raw))throw new Error('기기 알림 설정을 확인해 주세요.');
  const bytes=Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-raw.length%4)%4)),char=>char.charCodeAt(0));
  if(bytes.length!==65||bytes[0]!==4)throw new Error('기기 알림 설정을 확인해 주세요.');
  return bytes;
}
