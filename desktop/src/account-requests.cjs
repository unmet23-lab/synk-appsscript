'use strict';
const {classroomRequestSpec}=require('./classroom-requests.cjs');
const {PERSONAL_OPERATIONS,personalRequestSpec}=require('./personal-requests.cjs');
function requestSpec(operation,params={},appVersion='0.1.0',product,clientKey){
  if(['platformLoad','platformSave','platformDelete'].includes(operation)){
    if(product!=='platform'||clientKey!=='platform')throw Object.assign(new Error('플랫폼 계정 연결을 확인해 주세요.'),{code:'INVALID_REQUEST'});
    return personalRequestSpec(operation.replace('platform','personal'),params,product,'platform-library');
  }
  if(PERSONAL_OPERATIONS.includes(operation))return personalRequestSpec(operation,params,product,clientKey);
  const invalid=()=>{throw Object.assign(new Error('요청 형식을 확인해 주세요.'),{code:'INVALID_REQUEST'});};
  if(!params||typeof params!=='object'||Array.isArray(params))invalid();
  const keys=(allowed)=>{if(Object.keys(params).some(k=>!allowed.includes(k)))invalid();};
  const integer=(v,min=0)=>{if(!Number.isSafeInteger(v)||v<min)invalid();return v;};
  const uuid=v=>{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))invalid();return v;};
  const action=(action,body)=>({path:'synk-account',body:{action,...body}});
  switch(operation){
    case 'playLoad':keys([]);if(product!=='world'||clientKey!=='world')invalid();return {path:'synk-play'};
    case 'playMutate':{
      if(product!=='world'||clientKey!=='world')invalid();uuid(params.id);
      if(params.action==='wallet'){
        keys(['action','id','method','args']);
        if(!['buyItem','equipItem','setGameGoal','setBeginnerGoal','setWish','awardMiniGame','awardBeginnerPractice','awardRace'].includes(params.method)||!Array.isArray(params.args)||params.args.length>8)invalid();
      }else if(params.action==='progress'){
        keys(['action','id','changes']);if(!Array.isArray(params.changes)||params.changes.length>2048)invalid();
        for(const change of params.changes){if(!change||typeof change!=='object'||Array.isArray(change)||Object.keys(change).some(key=>!['key','previous','value'].includes(key))||typeof change.key!=='string'||!change.key||change.key.length>256||![change.previous,change.value].every(value=>value===null||typeof value==='string'))invalid();}
      }else if(params.action==='import'){
        keys(['action','id','expected_revision','state']);if(params.expected_revision!==0||!params.state||typeof params.state!=='object'||Array.isArray(params.state)||Object.keys(params.state).some(key=>!['wallet','records'].includes(key))||!params.state.wallet||!params.state.records)invalid();
      }else invalid();
      let serialized;try{serialized=JSON.stringify(params,(_key,value)=>{if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))invalid();return value;});}catch{invalid();}
      if(Buffer.byteLength(serialized,'utf8')>3*1024*1024)invalid();return {path:'synk-play',body:JSON.parse(serialized)};
    }
    case 'classroom':return classroomRequestSpec(params,product);
    case 'load':keys([]);return {path:'synk-account'};
    case 'atlasSummary':keys([]);return {path:'synk-account?view=atlas'};
    case 'release':keys([]);return {path:'release-policy?app_version='+encodeURIComponent(appVersion)};
    case 'setLearning':keys(['enabled','expected_revision']);if(typeof params.enabled!=='boolean')invalid();return action('learning-consent',{enabled:params.enabled,expected_revision:integer(params.expected_revision)});
    case 'updateProfile':{
      keys(['profile','expected_profile_revision']);const profile=params.profile;
      if(!profile||typeof profile!=='object'||Array.isArray(profile)||!Object.keys(profile).length||Object.keys(profile).some(k=>!['display_name','locale','time_zone'].includes(k)))invalid();
      if(profile.display_name!==undefined&&(typeof profile.display_name!=='string'||!profile.display_name.trim()||[...profile.display_name].length>60||/[\x00-\x1f\x7f]/.test(profile.display_name)))invalid();
      if(profile.locale!==undefined&&(typeof profile.locale!=='string'||profile.locale.length>24||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(profile.locale)))invalid();
      if(profile.time_zone!==undefined){if(typeof profile.time_zone!=='string'||profile.time_zone.length>64)invalid();try{new Intl.DateTimeFormat('en',{timeZone:profile.time_zone});}catch{invalid();}}
      return action('profile-update',{profile:{...profile},expected_profile_revision:integer(params.expected_profile_revision)});
    }
    case 'revokeSession':keys(['session_id']);return action('revoke-session',{session_id:uuid(params.session_id)});
    case 'revokeAll':keys([]);return action('revoke-all-sessions',{});
    case 'requestDeletion':keys(['request_id']);return action('delete-request',{request_id:uuid(params.request_id)});
    case 'exportPage':{keys(['after','until']);const after=integer(params.after??0),until=params.until==null?null:integer(params.until);return {path:`synk-account?view=export&after=${after}`+(until==null?'':`&until=${until}`)};}
    case 'learningGet':keys(['after','revision']);return {path:`synk-learning?after=${integer(params.after)}&revision=${integer(params.revision)}`};
    case 'learningPost':keys(['revision','events']);if(!Array.isArray(params.events)||params.events.length>256||Buffer.byteLength(JSON.stringify({revision:params.revision,events:params.events}))>262144)invalid();return {path:'synk-learning',body:{revision:integer(params.revision),events:params.events}};
    case 'memoryGet':keys(['revision']);return {path:`synk-learning?view=memory&revision=${integer(params.revision)}`};
    case 'memoryPost':keys(['revision','entries']);if(!Array.isArray(params.entries)||params.entries.length>256||Buffer.byteLength(JSON.stringify({revision:params.revision,memory:params.entries}))>262144)invalid();return {path:'synk-learning',body:{revision:integer(params.revision),memory:params.entries}};
    case 'careLoad':keys([]);if(product!=='platform')invalid();return {path:'synk-care'};
    case 'careSave':{
      keys(['expected_revision','state','messageLibraryVersion','checkinPreferenceVersion']);
      if(Object.hasOwn(params,'messageLibraryVersion')&&params.messageLibraryVersion!==1)invalid();
      if(Object.hasOwn(params,'checkinPreferenceVersion')&&(params.checkinPreferenceVersion!==1||clientKey!=='care'))invalid();
      const state=params.state;
      if(product!=='platform'||!state||typeof state!=='object'||Array.isArray(state)||state.version!==1||Object.keys(state).some(key=>!['version','people','events','drafts','completions','sources','memories','activities','followups','preparations'].includes(key))||!['people','events','drafts','completions'].every(key=>Array.isArray(state[key]))||!['sources','memories','activities','followups','preparations'].every(key=>state[key]===undefined||Array.isArray(state[key])))invalid();
      const body={action:'save',expected_revision:integer(params.expected_revision),state,...(Object.hasOwn(params,'messageLibraryVersion')?{messageLibraryVersion:1}:{}),...(Object.hasOwn(params,'checkinPreferenceVersion')?{checkinPreferenceVersion:1}:{})};
      let serialized;try{serialized=JSON.stringify(body,(_key,value)=>{if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))invalid();return value;});}catch{invalid();}
      if(Buffer.byteLength(serialized,'utf8')>4*1024*1024+32768)invalid();
      return {path:'synk-care',body:JSON.parse(serialized)};
    }
    case 'careDelete':keys(['expected_revision']);if(product!=='platform')invalid();return {path:'synk-care',body:{action:'delete',expected_revision:integer(params.expected_revision)}};
    case 'fortuneGet':keys([]);if(product!=='platform')invalid();return {path:'synk-fortune'};
    case 'fortunePut':{
      keys(['expected_revision','state']);if(product!=='platform'||!params.state||typeof params.state!=='object'||Array.isArray(params.state))invalid();
      const state=params.state;
      if(state.version!==1||Object.keys(state).some(key=>!['version','profile','preferences','entries'].includes(key))||!Object.hasOwn(state,'profile')||state.profile!==null&&(typeof state.profile!=='object'||Array.isArray(state.profile))||!state.preferences||typeof state.preferences!=='object'||Array.isArray(state.preferences)||!Array.isArray(state.entries)||state.entries.length>90)invalid();
      const body={action:'save',expected_revision:integer(params.expected_revision),state:params.state};
      let serialized;try{serialized=JSON.stringify(body,(_key,value)=>{if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))invalid();return value;});}catch{invalid();}
      if(Buffer.byteLength(serialized,'utf8')>65536)invalid();return {path:'synk-fortune',body};
    }
    case 'fortuneDelete':keys(['expected_revision']);if(product!=='platform')invalid();return {path:'synk-fortune',body:{action:'delete',expected_revision:integer(params.expected_revision)}};
    default:invalid();
  }
}
function redact(value,depth=0){if(depth>40)throw Error('INVALID_RESPONSE');if(Array.isArray(value))return value.map(v=>redact(v,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^(access_token|refresh_token|id_token|authorization|token|code_verifier|client_secret)$/i.test(key)).map(([k,v])=>[k,redact(v,depth+1)]));return value;}
function redactAccountResponse(value,operation,params){
  const clean=redact(value);
  // This explicit teacher-issued invitation is not an OAuth credential.
  if(operation==='classroom'&&params?.operation==='enrollmentInvite'&&value?.ok===true&&
    value.invite&&!Array.isArray(value.invite)&&typeof value.invite.token==='string'&&/^[a-f0-9]{32}$/.test(value.invite.token))clean.invite.token=value.invite.token;
  return clean;
}
module.exports={requestSpec,redact,redactAccountResponse};
