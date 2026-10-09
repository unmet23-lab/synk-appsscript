'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {TRAY_APPS}=require('./platform-tray.cjs');
const MAX_AGE=7*24*60*60*1000,MAX_BYTES=65536,SLOTS=['platform-library','member-home'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const appId=value=>typeof value==='string'&&Object.hasOwn(TRAY_APPS,value);
const text=(value,max)=>typeof value==='string'&&value.length<=max;
function validPayload(slot,value){
  if(!object(value))return false;
  if(slot==='member-home')return ['task','note'].includes(value.kind)&&appId(value.appId)&&text(value.title,80)&&text(value.body,1200);
  if(slot!=='platform-library')return false;
  const draft=entry=>object(entry)&&appId(entry.appId)&&text(entry.title,240);
  const editing=value.editing;
  return draft(value.draft)&&(value.parkedDraft===null||draft(value.parkedDraft))&&(editing===null||draft(editing)&&typeof editing.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(editing.id)&&typeof editing.done==='boolean'&&Number.isSafeInteger(editing.createdAt)&&editing.createdAt>0);
}
function cleanPayload(slot,value){if(slot==='member-home')return {kind:value.kind,appId:value.appId,title:value.title,body:value.body};const draft=entry=>entry===null?null:{appId:entry.appId,title:entry.title};return {draft:draft(value.draft),parkedDraft:draft(value.parkedDraft),editing:value.editing===null?null:{...draft(value.editing),id:value.editing.id,done:value.editing.done,createdAt:value.editing.createdAt}};}
function createDraftRecovery({directory,safeStorage,getAccount,configFingerprint='unconfigured',platform=process.platform,enabled=true,now=Date.now,onChange=()=>{}}){
  let queue=Promise.resolve();
  const ordered=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  function available(){try{return enabled&&['win32','darwin'].includes(platform)&&safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';}catch{return false;}}
  function identity(){const state=getAccount();return state?.signedIn===true&&state.status==='signed-in'&&typeof state.account?.synk_user_id==='string'&&state.account.synk_user_id.length>0&&state.account.synk_user_id.length<=128?{owner:state.account.synk_user_id,generation:state.sessionGeneration}:null;}
  const filename=owner=>path.join(directory,crypto.createHash('sha256').update(configFingerprint+'\0'+owner).digest('hex')+'.enc');
  const same=owner=>{const current=identity();return current&&current.owner===owner.owner&&current.generation===owner.generation;};
  const fault=code=>Object.assign(Error(code),{code});
  function authorize(){if(!available())throw fault('SECURE_STORAGE_UNAVAILABLE');const owner=identity();if(!owner)throw fault('AUTH_REQUIRED');return owner;}
  async function write(owner,record){
    if(!same(owner))throw fault('AUTH_CHANGED');
    const data=safeStorage.encryptString(JSON.stringify({...record,version:1,owner:owner.owner,configFingerprint}));if(data.length>MAX_BYTES)throw fault('INVALID_DRAFT');
    await fs.mkdir(directory,{recursive:true});const file=filename(owner.owner),temporary=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
    try{await fs.writeFile(temporary,data,{flag:'wx',mode:0o600});if(!same(owner))throw fault('AUTH_CHANGED');await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
  }
  async function read(owner){
    const file=filename(owner.owner);let data;try{data=await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return {enabled:false,slots:{}};throw error;}
    if(data.length>MAX_BYTES)throw fault('INVALID_DRAFT');let record;try{record=JSON.parse(safeStorage.decryptString(data));}catch{throw fault('INVALID_DRAFT');}
    if(record.version!==1||record.owner!==owner.owner||record.configFingerprint!==configFingerprint||record.enabled!==true||!object(record.slots))throw fault('INVALID_DRAFT');
    let expired=false;for(const [slot,item] of Object.entries(record.slots)){if(!SLOTS.includes(slot)||!object(item)||!validPayload(slot,item.value)||!Number.isFinite(item.updatedAt)||item.updatedAt>now()||now()-item.updatedAt>=MAX_AGE){delete record.slots[slot];expired=true;}}
    if(expired)await write(owner,record);if(!same(owner))throw fault('AUTH_CHANGED');return record;
  }
  const status=(record={enabled:false,slots:{}})=>({ok:true,available:available(),enabled:record.enabled===true});
  function run(operation){const expected=identity();return ordered(async()=>{try{if(expected?!same(expected):identity())throw fault('AUTH_CHANGED');return await operation();}catch(error){return {ok:false,available:available(),code:['SECURE_STORAGE_UNAVAILABLE','AUTH_REQUIRED','AUTH_CHANGED','INVALID_DRAFT'].includes(error.code)?error.code:'DRAFT_STORAGE_FAILED'};}});}
  return {
    available,
    status:()=>run(async()=>{if(!available())return {...status(),available:false};const owner=identity();if(!owner)return status();return status(await read(owner));}),
    setEnabled:enabledValue=>run(async()=>{if(typeof enabledValue!=='boolean')throw fault('INVALID_DRAFT');const owner=authorize();if(enabledValue){const record=await read(owner);await write(owner,{enabled:true,slots:record.slots});}else await fs.rm(filename(owner.owner),{force:true});if(!same(owner))throw fault('AUTH_CHANGED');const result={...status(),enabled:enabledValue};onChange(result);return result;}),
    load:slot=>run(async()=>{if(!SLOTS.includes(slot))throw fault('INVALID_DRAFT');const owner=authorize(),record=await read(owner),item=record.slots[slot];return {...status(record),draft:item?.value||null,...(item?{updatedAt:item.updatedAt,expiresAt:item.updatedAt+MAX_AGE}:{})};}),
    save:(slot,value)=>run(async()=>{if(!validPayload(slot,value))throw fault('INVALID_DRAFT');const owner=authorize(),record=await read(owner);if(!record.enabled)return {ok:false,code:'DRAFT_RECOVERY_DISABLED'};const updatedAt=now();record.slots[slot]={value:cleanPayload(slot,value),updatedAt};await write(owner,record);if(!same(owner))throw fault('AUTH_CHANGED');return {...status(record),updatedAt,expiresAt:updatedAt+MAX_AGE};}),
    clear:slot=>run(async()=>{if(!SLOTS.includes(slot))throw fault('INVALID_DRAFT');const owner=authorize(),record=await read(owner);if(record.enabled){delete record.slots[slot];await write(owner,record);}return status(record);}),
    clearAccount:owner=>ordered(async()=>{if(typeof owner==='string'&&owner)await fs.rm(filename(owner),{force:true});}),
  };
}
module.exports={createDraftRecovery,validPayload,MAX_AGE};
