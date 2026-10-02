import {APP_IDS} from './state.mjs';

// Only the native auth projection supplies membership/entitlement decisions.
// Local interests and saved selections cannot expand this list.
export function resolveLibrary(auth){
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

export function accountStorageKey(base,owner){
  return !owner||owner==='anonymous-local'?base:base+':account:'+encodeURIComponent(owner);
}

export function visibleSelection(selected,appIds){
  return appIds.includes(selected)?selected:appIds[0]||null;
}

export function libraryCopy(library){
  if(library.status==='guest')return {caption:'WORLD 둘러보기',note:'로그인하면 내 계정에 연결된 앱만 표시돼요.',title:'SYNK에 로그인',description:'같은 SYNK ID로 나에게 필요한 앱을 연결하세요.'};
  if(library.status==='loading')return {caption:'계정 확인 중',note:'이 계정의 앱을 확인하고 있어요.',title:'내 앱을 확인하고 있어요',description:'계정 연결을 마치면 이용할 수 있는 앱이 나타납니다.'};
  if(library.status==='unavailable')return {caption:'앱 목록 확인 필요',note:'계정 연결을 다시 확인해 주세요.',title:'앱 목록을 확인하지 못했어요',description:'계정 상태를 확인한 뒤 다시 불러와 주세요.'};
  return {caption:'내 라이브러리',note:'이 계정에 연결된 '+library.appIds.length+'개 앱',title:'아직 연결된 앱이 없어요',description:'기관이나 회사에서 이 계정에 앱 이용을 연결하면 여기에 표시됩니다.'};
}
