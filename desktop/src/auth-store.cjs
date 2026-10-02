'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createTokenStore({directory,safeStorage,scope,configFingerprint,platform=process.platform}){
  const file=path.join(directory,'auth-session.enc');
  function available(){try{return ['win32','darwin'].includes(platform)&&safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';}catch{return false;}}
  function requireEncryption(){if(!available())throw Object.assign(new Error('안전한 기기 저장소를 사용할 수 없어요.'),{code:'SECURE_STORAGE_UNAVAILABLE'});}
  let queue=Promise.resolve();const ordered=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const operations={
    available,
    async load(){requireEncryption();let encrypted;try{encrypted=await fs.readFile(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}if(encrypted.length>65536)throw Error('INVALID_TOKEN_STORE');
      const value=JSON.parse(safeStorage.decryptString(encrypted));if(value.version!==1||value.scope!==scope||value.configFingerprint!==configFingerprint||typeof value.refreshToken!=='string'||value.refreshToken.length>16384||value.subject!==null&&typeof value.subject!=='string')throw Error('INVALID_TOKEN_STORE');return {refreshToken:value.refreshToken,subject:value.subject};},
    async save({refreshToken,subject}){requireEncryption();const encoded=safeStorage.encryptString(JSON.stringify({version:1,scope,configFingerprint,refreshToken,subject}));await fs.mkdir(directory,{recursive:true});
      const temporary=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{await fs.writeFile(temporary,encoded,{mode:0o600,flag:'wx'});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}},
    async clear(){await fs.rm(file,{force:true});},
  };return {...operations,load:()=>ordered(operations.load),save:value=>ordered(()=>operations.save(value)),clear:()=>ordered(operations.clear)};
}
module.exports={createTokenStore};
