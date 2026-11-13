import {APP_IDS} from './state.mjs';

// Account ownership remains separate from the development catalogue.
// Local interests and saved selections cannot grant product data access.
function resolveAccountLibrary(auth){
  const rawId=auth?.account?.synk_user_id;
  const accountId=typeof rawId==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(rawId)&&rawId!=='anonymous-local'?rawId:'';
  if(auth?.signedIn===true&&auth.status==='signed-in'&&accountId){
    const ready=auth.library?.status==='ready'&&Array.isArray(auth.library.appIds);
    return {status:ready?'ready':'unavailable',owner:accountId,appIds:ready?APP_IDS.filter(id=>auth.library.appIds.includes(id)):[]};
  }
  // Signed out is signed out, even with a note attached (a cancelled or timed-out sign-in, a session the server
  // ended): that note belongs to the account dialog, and the home stays the guest's. Only an unread account
  // (status 'error', usually the network) is a failed load.
  // A guest sees PULSE, the client's way in: WORLD is a phone app and the home points to it (2026-11-11).
  if(auth?.signedIn===false&&['unconfigured','signed-out'].includes(auth.status)){
    return {status:'guest',owner:'anonymous-local',appIds:['pulse']};
  }
  // phase keeps which wait it is: signing in waits for the member in the browser, restoring and signing out for the app.
  return {status:['restoring','signing-in','signing-out'].includes(auth?.status)?'loading':'unavailable',owner:null,appIds:[],...(auth?.status==='signing-in'?{phase:'signing-in'}:{})};
}

export function resolveLibrary(auth,environment){
  const library=resolveAccountLibrary(auth);
  if(environment?.clientId==='platform'&&environment.mode==='development'&&environment.nativeShell===true){
    return {...library,appIds:[...APP_IDS],developmentCatalog:true};
  }
  return library;
}

export function accountStorageKey(base,owner){
  return !owner||owner==='anonymous-local'?base:base+':account:'+encodeURIComponent(owner);
}

export function visibleSelection(selected,appIds){
  return appIds.includes(selected)?selected:appIds[0]||null;
}

// Teacher stays a distinct permission and launch target, inside Messenger's card.
export function displayLibraryAppId(id,library){
  return id==='teacher'&&library?.appIds?.includes('messenger')&&library.appIds.includes('teacher')?'messenger':id;
}
// Apps the platform does not list, without changing account grants or saved notes: PATH is hidden for now
// (2026-10-28) and WORLD is used on phones, so the home shows its phone way in instead (2026-11-11).
export const UNLISTED_APP_IDS=Object.freeze(['path','world']);
export function visibleLibraryAppIds(library){
  return (library?.appIds||[]).filter(id=>!UNLISTED_APP_IDS.includes(id));
}
export function displayLibraryAppIds(library){
  return [...new Set(visibleLibraryAppIds(library).map(id=>displayLibraryAppId(id,library)))];
}
export function moveLibraryFavorite(favorites,appIds,id,direction){
  if(![-1,1].includes(direction))return null;
  const visible=favorites.filter(entry=>appIds.includes(entry)),from=visible.indexOf(id),to=from+direction;
  if(from<0||to<0||to>=visible.length)return null;
  [visible[from],visible[to]]=[visible[to],visible[from]];
  let index=0;
  return favorites.map(entry=>appIds.includes(entry)?visible[index++]:entry);
}
export function projectLibraryPreferences(prefs,library){
  const favorites=[...new Set((prefs.favorites||[]).map(id=>displayLibraryAppId(id,library)))],lastLaunch={},launchEntries={};
  for(const [entry,at]of Object.entries(prefs.lastLaunch||{})){
    const id=displayLibraryAppId(entry,library);
    if(!(id in lastLaunch)||at>lastLaunch[id]){lastLaunch[id]=at;launchEntries[id]=library?.appIds?.includes(prefs.launchEntries?.[entry])?prefs.launchEntries[entry]:entry;}
  }
  return {...prefs,selected:displayLibraryAppId(prefs.selected,library),favorites,lastLaunch,launchEntries};
}

// granted: 계정 권한(걸러 내기 전 appIds). 런처는 목록용으로 걸러 낸 appIds를 넘기므로 WORLD 권한은 따로 받는다.
export function libraryCopy(library,{granted=library.appIds}={}){
  if(library.developmentCatalog===true)return {caption:'모든 앱',note:'앱 '+displayLibraryAppIds(library).length+'개 · 바로 열 수 있는 앱과 준비 중인 앱이 함께 보여요.',title:'SYNK 앱',description:'앱을 고르면 하는 일과 여는 방법이 나와요.'};
  if(library.status==='guest')return {caption:'PULSE 둘러보기',note:'로그인하면 내 계정에서 쓸 수 있는 앱이 나와요.',title:'SYNK에 로그인',description:'SYNK ID 하나로 Workspace · PULSE · 솔리오를 써요.'};
  if(library.status==='loading'&&library.phase==='signing-in')return {caption:'브라우저에서 로그인 중',note:'열린 SYNK ID 창에서 로그인하고 「연결하기」를 누르면 이 계정의 앱이 나와요.',title:'브라우저에서 로그인을 마쳐 주세요',description:'Google이나 이메일로 로그인한 뒤 「연결하기」를 누르면 이 앱으로 돌아와요.'};
  if(library.status==='loading')return {caption:'불러오는 중',note:'이 계정에서 쓸 수 있는 앱을 불러오고 있어요.',title:'내 앱을 불러오고 있어요',description:'잠시만 기다려 주세요.'};
  if(library.status==='unavailable')return {caption:'불러오기 실패',note:'인터넷 연결을 확인한 뒤 다시 불러와 주세요.',title:'앱 목록을 불러오지 못했어요',description:'인터넷 연결을 보고 「다시 불러오기」를 눌러 주세요.'};
  // WORLD 권한만 있는 학습자: 목록은 비어도 「쓸 수 있는 앱이 없다」고 하지 않고 휴대폰 칸으로 보낸다(2026-11-11).
  const listed=displayLibraryAppIds(library).length,worldOnPhone=!listed&&(granted||[]).includes('world');
  return {caption:'내 라이브러리',note:'이 계정의 앱 '+listed+'개',title:worldOnPhone?'한국어 공부는 휴대폰의 WORLD에서 해요':'아직 쓸 수 있는 앱이 없어요',description:worldOnPhone?'WORLD는 설치 없이 휴대폰 브라우저에서 열려요. 내 홈의 QR을 휴대폰 카메라로 찍어 보세요.':'학교나 회사에서 이 계정에 앱을 열어 주면 여기에 나와요.',worldOnPhone};
}
