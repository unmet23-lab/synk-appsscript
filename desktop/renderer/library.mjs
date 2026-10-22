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
  if(auth?.signedIn===false&&!auth.error&&['unconfigured','signed-out'].includes(auth.status)){
    return {status:'guest',owner:'anonymous-local',appIds:['world']};
  }
  return {status:['restoring','signing-in','signing-out'].includes(auth?.status)?'loading':'unavailable',owner:null,appIds:[]};
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
export function displayLibraryAppIds(library){
  return [...new Set((library?.appIds||[]).map(id=>displayLibraryAppId(id,library)))];
}
export function projectLibraryPreferences(prefs,library){
  const favorites=[...new Set((prefs.favorites||[]).map(id=>displayLibraryAppId(id,library)))],lastLaunch={},launchEntries={};
  for(const [entry,at]of Object.entries(prefs.lastLaunch||{})){
    const id=displayLibraryAppId(entry,library);
    if(!(id in lastLaunch)||at>lastLaunch[id]){lastLaunch[id]=at;launchEntries[id]=library?.appIds?.includes(prefs.launchEntries?.[entry])?prefs.launchEntries[entry]:entry;}
  }
  return {...prefs,selected:displayLibraryAppId(prefs.selected,library),favorites,lastLaunch,launchEntries};
}

export function libraryCopy(library){
  if(library.developmentCatalog===true)return {caption:'모든 앱',note:'앱 '+displayLibraryAppIds(library).length+'개 · 바로 열 수 있는 앱과 준비 중인 앱이 함께 보여요.',title:'SYNK 앱',description:'앱을 고르면 하는 일과 여는 방법이 나와요.'};
  if(library.status==='guest')return {caption:'WORLD 둘러보기',note:'로그인하면 내 계정에서 쓸 수 있는 앱이 나와요.',title:'SYNK에 로그인',description:'SYNK ID 하나로 WORLD, Workspace, 회원 혜택을 써요.'};
  if(library.status==='loading')return {caption:'불러오는 중',note:'이 계정에서 쓸 수 있는 앱을 불러오고 있어요.',title:'내 앱을 불러오고 있어요',description:'잠시만 기다려 주세요.'};
  if(library.status==='unavailable')return {caption:'불러오기 실패',note:'인터넷 연결을 확인한 뒤 다시 불러와 주세요.',title:'앱 목록을 불러오지 못했어요',description:'인터넷 연결을 보고 「다시 불러오기」를 눌러 주세요.'};
  return {caption:'내 라이브러리',note:'이 계정의 앱 '+displayLibraryAppIds(library).length+'개',title:'아직 쓸 수 있는 앱이 없어요',description:'학교나 회사에서 이 계정에 앱을 열어 주면 여기에 나와요.'};
}
