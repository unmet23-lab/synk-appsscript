import Personalization from './world-learning-profile-core.mjs';

// Product storage only: Core owns declaration, consent, provenance and revision.
// These choices describe requested help; they never assert ability or personality.
const copy=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const error=(code,message)=>Object.assign(new Error(message),{code});
const persistentFields=Object.freeze(['goal','reasons','primaryReason','support','explanation','textSize','motion']);
const iso=at=>{
 if(!Number.isSafeInteger(at)||at<0||at>253402268399999)throw TypeError('Invalid profile time');
 return new Date(at).toISOString();
};
export function learningProfileDay(at){iso(at);return new Date(at+9*3600000).toISOString().slice(0,10);}
export function learningProfileScope(owner){return {personId:owner,productId:'world',contextId:'learning',domain:'LAB'};}
function todayValues(value){
 if(!exact(value,['minutes','audio']))throw TypeError('Only the current session time and sound environment are accepted');
 if(Object.hasOwn(value,'minutes')&&(!Number.isInteger(value.minutes)||value.minutes<1||value.minutes>240))throw TypeError('Invalid session time');
 if(Object.hasOwn(value,'audio')&&!Personalization.OPTIONS.audio.includes(value.audio))throw TypeError('Invalid sound environment');
 return copy(value);
}
function revision(profile,expectedRevision){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw TypeError('Expected profile revision required');
 if(profile.revision!==expectedRevision)throw error('PROFILE_CONFLICT','다른 곳에서 맞춤 설정이 바뀌었어요. 최신 설정을 확인한 뒤 다시 선택해 주세요.');
}
export function readWorldLearningProfile(value,{owner,at}={}){
 const timestamp=iso(at),scope=learningProfileScope(owner);
 if(value===undefined||value===null)return {profile:Personalization.createProfile({scope,at:timestamp}),today:null};
 try{
  if(!exact(value,['version','profile','today'])||value.version!==1||!Object.hasOwn(value,'profile'))throw TypeError();
  Personalization.validateProfile(value.profile);
  if(Object.keys(scope).some(key=>value.profile.scope[key]!==scope[key])||Object.keys(value.profile.values).some(key=>!persistentFields.includes(key)))throw TypeError();
  if(value.today!=null){
   if(!exact(value.today,['day','values','updatedAt'])||!value.profile.consent||typeof value.today.updatedAt!=='string'||new Date(value.today.updatedAt).toISOString()!==value.today.updatedAt
    ||value.today.day!==learningProfileDay(Date.parse(value.today.updatedAt))||Date.parse(value.today.updatedAt)<Date.parse(value.profile.createdAt)||Date.parse(value.today.updatedAt)>Date.parse(value.profile.updatedAt))throw TypeError();
   todayValues(value.today.values);
  }
  return {profile:copy(value.profile),today:value.today&&value.today.day===learningProfileDay(at)?copy(value.today):null};
 }catch(cause){throw error('LEARNING_PROFILE_UNREADABLE','맞춤 설정을 확인하지 못했어요. 기존 학습 기록은 보존했어요.');}
}
export function updateWorldLearningProfile(value,{owner,at,values={},consent,expectedRevision,today}={}){
 const current=readWorldLearningProfile(value,{owner,at});revision(current.profile,expectedRevision);
 if(!exact(values,persistentFields))throw TypeError('Session conditions and inferred traits cannot be persistent preferences');
 const update={values,expectedRevision,...(consent===undefined?{}:{consent})};
 const profile=Personalization.updateProfile(current.profile,update,iso(at));
 let session=profile.consent?current.today:null;
 if(today!==undefined){
  if(today!==null&&!profile.consent)throw TypeError('Explicit consent required before remembering session conditions');
  session=today===null?null:{day:learningProfileDay(at),values:todayValues(today),updatedAt:iso(at)};
 }
 return {version:1,profile,today:session};
}
export function clearWorldLearningProfile(value,{owner,at,mode='delete',expectedRevision}={}){
 const current=readWorldLearningProfile(value,{owner,at});revision(current.profile,expectedRevision);
 return {version:1,profile:Personalization.clearProfile(current.profile,{mode,at:iso(at)}),today:null};
}
export function worldLearningProfileValues(value,options){
 const current=readWorldLearningProfile(value,options);
 return current.profile.consent?{...copy(current.profile.values),...copy(current.today?.values||{})}:{};
}
