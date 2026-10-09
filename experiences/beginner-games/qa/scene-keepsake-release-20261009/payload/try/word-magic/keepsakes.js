import {LAB_SETS,SPELLS,CHAPTERS} from './content.js';

export const KEEPSAKE_LIMIT=6;
const copy=x=>JSON.parse(JSON.stringify(x));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const sceneName=value=>typeof value==='string'?[...value.trim().replace(/[\u0000-\u001f\u007f]/g,'')].slice(0,30).join(''):'';
/** Persist semantic transforms only. Assets, coordinates, pixels and URLs are never
 * taken from stored input. The current canonical set supplies all drawing data. */
export function normalizeKeptScene(value){
 if(!value||!uuid.test(value.id)||!Object.hasOwn(LAB_SETS,value.set)||!sceneName(value.name)||!Number.isFinite(Date.parse(value.createdAt))||!Array.isArray(value.objects))return null;
 const base=LAB_SETS[value.set].objects;if(value.objects.length!==base.length||new Set(value.objects.map(o=>o?.id)).size!==base.length)return null;
 const objects=[];
 for(const object of base){const saved=value.objects.find(o=>o?.id===object.id);if(!saved||![.62,1,1.55].includes(saved.size)||typeof saved.open!=='boolean'||![0,1].includes(saved.level)||saved.open&&!['book','chest','door'].includes(object.asset))return null;objects.push({id:object.id,size:saved.size,open:saved.open,level:saved.level});}
 const words=[...new Set((Array.isArray(value.words)?value.words:[]).filter(id=>Object.hasOwn(SPELLS,id)))];if(!words.length)return null;
 return {id:value.id.toLowerCase(),name:sceneName(value.name),createdAt:new Date(value.createdAt).toISOString(),set:value.set,objects,words};
}
export function normalizeKeepsakes(value){const scenes=[],ids=new Set();for(const raw of Array.isArray(value)?value:[]){const scene=normalizeKeptScene(raw);if(!scene||ids.has(scene.id))continue;ids.add(scene.id);scenes.push(scene);if(scenes.length===KEEPSAKE_LIMIT)break;}return scenes;}
export function keptSceneObjects(value){const scene=normalizeKeptScene(value);return scene?LAB_SETS[scene.set].objects.map(o=>({...o,...scene.objects.find(v=>v.id===o.id)})):null;}
const outsideCollection=raw=>{if(raw===null)return null;try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return raw;delete value.keepsakes;return JSON.stringify(value);}catch{return raw;}};
/** Reading a refreshed account updates its observed CAS value. Never use that read
 * to overwrite another device's progress with this page's cached adventure. */
export function mergeSceneCollection(progress,previousRaw,latestRaw){
 if(outsideCollection(previousRaw)!==outsideCollection(latestRaw))return {ok:false,reason:'progress-changed'};
 let keepsakes=progress.keepsakes;try{const latest=JSON.parse(latestRaw);if(latest?.version===1)keepsakes=normalizeKeepsakes(latest.keepsakes);}catch{}
 return {ok:true,progress:{...progress,keepsakes:copy(keepsakes||[])}};
}
export function keepsakeSaveState(status={}){
 if(status.mode!=='account')return 'guest';
 if(status.phase==='stopped')return 'stopped';if(status.phase==='conflict')return 'conflict';if(status.phase==='offline')return 'offline';
 if(status.phase==='synced'&&!status.pending&&!status.rejected)return 'synced';return 'pending';
}
/** Modify only keepsakes on the most recent envelope. It preserves unfinished
 * adventures, introduction/check evidence, lab transforms and future JSON fields. */
export class KeepsakeStore{
 constructor({storage,key,initial,guard=()=>{},locks=globalThis.navigator?.locks}){Object.assign(this,{storage,key,initial,guard,locks});}
 read(){try{this.guard(false);const raw=this.storage.getItem(this.key),progress=raw===null?copy(this.initial()):JSON.parse(raw);if(!progress||progress.version!==1||typeof progress!=='object'||Array.isArray(progress))throw Error('invalid-progress');return {available:true,progress,scenes:normalizeKeepsakes(progress.keepsakes)};}catch(error){return {available:false,scenes:[],error};}}
 async update(action){
  const task=async()=>{try{this.guard(true);const current=this.read();if(!current.available)return {ok:false,reason:'unavailable'};const result=action(current.scenes,current.progress);if(!result.ok)return result;const progress={...current.progress,keepsakes:result.scenes};this.guard(true);await this.storage.setItem(this.key,JSON.stringify(progress));this.guard(true);const latest=this.read();if(!latest.available||JSON.stringify(latest.scenes)!==JSON.stringify(result.scenes))return {ok:false,reason:'unavailable'};return {ok:true,scenes:latest.scenes};}catch(error){return {ok:false,reason:error.code==='REVISION_CONFLICT'?'conflict':error.code==='PLAY_SESSION_ENDED'?'stopped':'storage',error};}};
  try{return this.locks?.request?await this.locks.request(this.key+':keepsakes',task):await task();}catch{return {ok:false,reason:'storage'};}
 }
 save(scene,replaceId=null){const canonical=normalizeKeptScene(scene);if(!canonical)return Promise.resolve({ok:false,reason:'invalid-scene'});return this.update((scenes,progress)=>{
  const introduced=Array.isArray(progress.introduced)?progress.introduced:[],known=new Set(CHAPTERS.filter(c=>introduced.includes(c.id)).flatMap(c=>c.pair));if(canonical.words.some(word=>!known.has(word)))return {ok:false,reason:'not-introduced'};
  if(scenes.some(item=>item.id===canonical.id))return {ok:true,scenes};
  if(replaceId&&!scenes.some(item=>item.id===replaceId))return {ok:false,reason:'missing-scene'};
  if(scenes.length===KEEPSAKE_LIMIT&&!replaceId)return {ok:false,reason:'full'};
  return {ok:true,scenes:[canonical,...scenes.filter(item=>item.id!==replaceId)]};
 });}
 rename(id,name){const next=sceneName(name);if(!next)return Promise.resolve({ok:false,reason:'name'});return this.update(scenes=>scenes.some(item=>item.id===id)?{ok:true,scenes:scenes.map(item=>item.id===id?{...item,name:next}:item)}:{ok:false,reason:'missing-scene'});}
 remove(id){return this.update(scenes=>scenes.some(item=>item.id===id)?{ok:true,scenes:scenes.filter(item=>item.id!==id)}:{ok:false,reason:'missing-scene'});}
}
