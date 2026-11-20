import {notificationStore,isQuiet,installationEvents} from './convenience-state.mjs';
import {APPS} from './state.mjs';
import {isPortalActive} from './portal-entry.mjs';

// 검정 구 얼굴이 쓰는 데스크톱 편의만 든다(PC 0.5.0 설계 4.2-3).
// - 알림 설정: 설정 방의 「알림」이 이 통로로 읽고 바꾼다. 바꾼 값은 배너 판단에 바로 쓰인다.
// - 데스크톱 설정 알림: 닫기 버튼 값(트레이에 남기기)을 호스트에 넘긴다.
// - 화면 확대 키: Ctrl(⌘)과 +, −, 0. 설정 방의 「화면」 줄이 이 키를 안내한다.
// - 창이 뒤로 가면 data-background를 세워 얼굴의 움직임을 멈춘다.
// - 앱 설치 파일이 준비됐거나 실패했을 때의 알림.
// 옛 런처의 명령 메뉴, 알림함, 옛 설정 묶음, 단축키 대화상자, 앱 메뉴, Alt 화살표, 기억한 길은 옛 화면과 함께 거뒀다.
export function mountConvenience({bridge,storage,isPortalBlocked=()=>false,onToast=()=>{},onDesktopPreferences=()=>{},getAppIds=()=>Object.keys(APPS)}={}){
  const portalBlocked=()=>Boolean(isPortalBlocked?.())||isPortalActive(document);
  let desktop=null,pending=false,revision=0;
  const notices=notificationStore({storage});
  function received(snapshot){if(!snapshot?.ok)return;desktop=snapshot;onDesktopPreferences(snapshot);}
  async function update(patch){
    if(pending||!bridge?.updateDesktopPreferences)return;pending=true;
    try{const result=await bridge.updateDesktopPreferences(patch);if(result?.ok)received(result);}catch{/* 설정 방이 결과를 따로 읽는다 */}
    finally{pending=false;}
  }
  async function load(){const expected=++revision;try{const snapshot=await bridge?.getDesktopPreferences?.();if(expected===revision)received(snapshot);}catch{/* 다음 알림이 다시 준다 */}}
  bridge?.onDesktopPreferences?.(received);
  document.addEventListener('keydown',event=>{
    if(portalBlocked()||event.defaultPrevented||event.isComposing||event.keyCode===229)return;
    const mod=event.ctrlKey||event.metaKey;
    if(!mod||!desktop||!['+','=','-','0'].includes(event.key))return;
    event.preventDefault();
    const steps=[.8,.9,1,1.1,1.25,1.5],current=desktop.preferences?.zoomFactor||1;
    const value=event.key==='0'?1:event.key==='-'?[...steps].reverse().find(step=>step<current)||steps[0]:steps.find(step=>step>current)||steps.at(-1);
    void update({zoomFactor:value});
  });
  function visibility(){document.documentElement.dataset.background=String(document.hidden);}
  document.addEventListener('visibilitychange',visibility);visibility();void load();
  return {
    notifications:{get:()=>notices.get(),set:patch=>notices.set(patch)},
    clientsChanged(previous,next){
      for(const event of installationEvents(previous,next,getAppIds())){
        const name=APPS[event.appId]?.name||'앱';
        const title=event.type==='ready'?`${name} 설치 파일이 준비됐습니다.`:`${name} 설치 파일을 준비하지 못했습니다.`;
        const prefs=notices.get();
        if(prefs.banners&&!isQuiet(prefs)&&!document.hidden)onToast(title);
      }
    },
  };
}
