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
  if(library.developmentCatalog===true)return {caption:'개발 중인 앱 모두 보기',note:'지원 앱 '+displayLibraryAppIds(library).length+'개 · 실행 가능한 앱과 준비 중인 앱을 함께 표시해요.',title:'SYNK 앱을 둘러보세요',description:'앱마다 현재 준비 상태와 여는 방법을 확인할 수 있어요.'};
  if(library.status==='guest')return {caption:'WORLD 둘러보기',note:'로그인하면 내 계정에 연결된 앱만 표시돼요.',title:'SYNK에 로그인',description:'같은 SYNK ID로 나에게 필요한 앱을 연결하세요.'};
  if(library.status==='loading')return {caption:'계정 확인 중',note:'이 계정의 앱을 확인하고 있어요.',title:'내 앱을 확인하고 있어요',description:'계정 연결을 마치면 이용할 수 있는 앱이 나타납니다.'};
  if(library.status==='unavailable')return {caption:'앱 목록 확인 필요',note:'계정 연결을 다시 확인해 주세요.',title:'앱 목록을 확인하지 못했어요',description:'계정 상태를 확인한 뒤 다시 불러와 주세요.'};
  return {caption:'내 라이브러리',note:'이 계정에 연결된 '+displayLibraryAppIds(library).length+'개 앱',title:'아직 연결된 앱이 없어요',description:'기관이나 회사에서 이 계정에 앱 이용을 연결하면 여기에 표시됩니다.'};
}
