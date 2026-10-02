'use strict';
const {classroomRequestSpec}=require('./classroom-requests.cjs');
function requestSpec(operation,params={},appVersion='0.1.0',product){
  const invalid=()=>{throw Object.assign(new Error('요청 형식을 확인해 주세요.'),{code:'INVALID_REQUEST'});};
  if(!params||typeof params!=='object'||Array.isArray(params))invalid();
  const keys=(allowed)=>{if(Object.keys(params).some(k=>!allowed.includes(k)))invalid();};
  const integer=(v,min=0)=>{if(!Number.isSafeInteger(v)||v<min)invalid();return v;};
  const uuid=v=>{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))invalid();return v;};
  const action=(action,body)=>({path:'synk-account',body:{action,...body}});
  switch(operation){
    case 'classroom':return classroomRequestSpec(params,product);
    case 'load':keys([]);return {path:'synk-account'};
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
    default:invalid();
  }
}
function redact(value,depth=0){if(depth>40)throw Error('INVALID_RESPONSE');if(Array.isArray(value))return value.map(v=>redact(v,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^(access_token|refresh_token|id_token|authorization|token|code_verifier|client_secret)$/i.test(key)).map(([k,v])=>[k,redact(v,depth+1)]));return value;}
module.exports={requestSpec,redact};
