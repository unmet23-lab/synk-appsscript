import {normalizeGarage,emptyGarage,GARAGE_KEY} from '../korean-racing/garage-core.js';

export const PLAY_SCOPE='synk-play';
export const PLAY_WALLET_KEY=GARAGE_KEY;
export const PLAY_MAX_BYTES=2*1024*1024;
export const PLAY_RECORD_KEYS=Object.freeze([
  'synk.word-magic.progress.v1','synk.order-rush.beginner.v1','synk.order-rush.picnic.v1',
  'SYNK_SHIP_STARBOOK_V1','SYNK_LAB_PLAY_PROGRESS_V1','SYNK_RACING_TUTORIAL_V1',
  'synk.talk-rally.daily.v1','synk.order-rush.flow-mode','synk.windrun.best',
  'synk.blank-slice.v1','synk.entry-check.v1','synk.talk-rally.v1',
  'synk.life-korean.progress.v1'
]);
export const isPlayRecordKey=key=>PLAY_RECORD_KEYS.includes(key)||typeof key==='string'&&/^SYNK_SHIP_STARBOOK_V1:kept:[a-f0-9]{32}$/.test(key);
const fail=(code='INVALID_PLAY_STATE')=>{throw Object.assign(new Error(code),{code,status:code==='PLAY_DATA_TOO_LARGE'?413:400});};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const bytes=x=>new TextEncoder().encode(x).length;
// Only bounded JSON game records cross this boundary. OAuth, room credentials and
// Atlas consent/evidence stores are deliberately outside this contract.
function safe(value,depth=0){
  if(depth>20)fail();
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))fail();return;}
  if(typeof value==='string'){if(value.length>32000)fail();return;}
  if(Array.isArray(value)){if(value.length>20000)fail('PLAY_DATA_TOO_LARGE');for(const v of value)safe(v,depth+1);return;}
  if(!object(value))fail();
  for(const [key,v] of Object.entries(value)){
    if(key.length>240||['__proto__','prototype','constructor'].includes(key)||/^(?:token|access_?token|refresh_?token|authorization|password|secret|bearer|roomCode|participantToken)$/i.test(key))fail();
    safe(v,depth+1);
  }
}
export function validatePlayValue(key,value){
  if(!isPlayRecordKey(key)||typeof value!=='string')fail();
  if(key==='synk.order-rush.flow-mode'){if(!['auto','fixed'].includes(value))fail();return value;}
  if(bytes(value)>512*1024)fail('PLAY_DATA_TOO_LARGE');
  let parsed;try{parsed=JSON.parse(value);}catch{fail();}safe(parsed);return value;
}
export function validatePlayRecords(records){
  if(!object(records)||Object.keys(records).length>1024)fail();
  const result={};for(const [key,value]of Object.entries(records))result[key]=validatePlayValue(key,value);
  if(bytes(JSON.stringify(result))>PLAY_MAX_BYTES)fail('PLAY_DATA_TOO_LARGE');return result;
}
export function validatePlayWallet(value){
  if(!object(value))fail();safe(value);
  if(bytes(JSON.stringify(value))>PLAY_MAX_BYTES)fail('PLAY_DATA_TOO_LARGE');return normalizeGarage(value);
}
export function validatePlayState(value){
  if(!object(value)||Object.keys(value).some(k=>!['wallet','records','imported'].includes(k)))fail();
  const state={wallet:validatePlayWallet(value.wallet),records:validatePlayRecords(value.records),imported:value.imported===true};
  if(bytes(JSON.stringify(state))>PLAY_MAX_BYTES)fail('PLAY_DATA_TOO_LARGE');return state;
}
export const emptyPlayState=()=>({wallet:emptyGarage(),records:{},imported:false});
export function validatePlayChanges(changes){
  if(!Array.isArray(changes)||!changes.length||changes.length>100||new Set(changes.map(x=>x?.key)).size!==changes.length)fail();
  return changes.map(change=>{
    if(!object(change)||Object.keys(change).some(k=>!['key','previous','value'].includes(k))||!isPlayRecordKey(change.key))fail();
    for(const part of ['previous','value'])if(change[part]!==null)validatePlayValue(change.key,change[part]);
    return {key:change.key,previous:change.previous,value:change.value};
  });
}
export function readLegacyPlay(storage){
  const records={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(isPlayRecordKey(key)){const value=storage.getItem(key);if(value!==null)records[key]=validatePlayValue(key,value);}}
  let wallet=emptyGarage();const raw=storage.getItem(GARAGE_KEY);if(raw!==null)wallet=validatePlayWallet(JSON.parse(raw));
  return validatePlayState({wallet,records,imported:false});
}
